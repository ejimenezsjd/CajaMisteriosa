/**
 * MapSystem (Fase 11): exploración, fog of war y mapa fullscreen 2D.
 *
 * Celdas de 16×16 (alineadas con CHUNK). Almacén sparse:
 *   state.map.discoveredCells["cx,cz"] = biomeId
 *   (saves antiguos pueden traer { biomeId, regionId })
 *   state.map.markers[structureId] = { type, x, z, ... }
 *
 * No recalcula terrain al pintar: usa la metadata guardada al revelar.
 */

import { events } from "./events.js";
import { getRegionName, regions, REGION_1 } from "./regions.js";
import { getBiomeName } from "./biomes.js";
import { progression } from "./progression.js";
import { gyms } from "./gyms.js";

export const MAP_CELL = 16;

export const MAP_PALETTE = {
  plains: "#6db84a",
  forest: "#2f7a3a",
  desert: "#d4c078",
  snow: "#d8e4f0",
  mountain: "#8a8a94",
  beach: "#e2d08f",
  ocean: "#3a6fb0",
  mist_forest: "#4a6a62",
  crimson_highlands: "#8a3028",
  wind_highlands: "#7aa0c8",
  azure_archipelago: "#3a9aaa",
  unknown: "#1a1c24",
};

export const MAP_MARKERS = {
  settlement: { icon: "🏘", color: "#e0c060", label: "Asentamiento", z: 2 },
  mist_settlement: { icon: "🏘", color: "#8fdcff", label: "Refugio Brumoso", z: 2 },
  gym: { icon: "🌿", color: "#6ee86e", label: "Gimnasio Verde", z: 3 },
  gym_mist: { icon: "🌫", color: "#9ad4e8", label: "Gimnasio de las Brumas", z: 3 },
  gym_crimson: { icon: "🔥", color: "#ff7040", label: "Gimnasio de la Forja", z: 3 },
  regional_gate: { icon: "🚪", color: "#c4a646", label: "Paso fronterizo", z: 2 },
  watchtower: { icon: "🗼", color: "#d0d8e8", label: "Atalaya", z: 2 },
  ancient_outpost: { icon: "🏛", color: "#b090d0", label: "Puesto ancestral", z: 2 },
  healing_shrine: { icon: "✨", color: "#f0e6a8", label: "Santuario", z: 1 },
  mining_camp: { icon: "⛏", color: "#e0a040", label: "Puesto minero", z: 2 },
  crimson_ruin: { icon: "🏛", color: "#e04048", label: "Ruina Carmesí", z: 2 },
  cliff_outpost: { icon: "🏕", color: "#a8c8e8", label: "Puesto del acantilado", z: 2 },
  wind_shrine: { icon: "🌬", color: "#90d8f8", label: "Santuario del viento", z: 2 },
  storm_observatory: { icon: "🔭", color: "#c0e8ff", label: "Observatorio de la Tormenta", z: 3 },
  gym_gale: { icon: "🌬", color: "#90d8f8", label: "Gimnasio del Vendaval", z: 3 },
  tempest_spire: { icon: "⚡", color: "#c8e8ff", label: "Pináculo del Vendaval", z: 2 },
  highland_exit: { icon: "↕", color: "#a0c0e0", label: "Arco de las alturas", z: 2 },
  azure_port: { icon: "🏘", color: "#7ee8d8", label: "Puerto Azur", z: 3 },
  tidal_ruins: { icon: "🏛", color: "#5aa0a8", label: "Ruinas de Marea", z: 2 },
  azure_lighthouse: { icon: "🗼", color: "#ffe58a", label: "Faro Azur", z: 3 },
  gym_tide: { icon: "🌊", color: "#3ec8b4", label: "Gimnasio de las Mareas", z: 3 },
  reef_atoll: { icon: "🐚", color: "#e8c878", label: "Atolón del Arrecife", z: 2 },
  tidal_bridge: { icon: "🌉", color: "#7ee8d8", label: "Puente de Marea", z: 2 },
  open_sea_gate: { icon: "↕", color: "#90d8f8", label: "Arco del mar abierto", z: 2 },
};

const REVEAL_RADIUS = {
  watchtower: 4,
  storm_observatory: 6,
  azure_lighthouse: 2,
};

export function cellKey(cx, cz) {
  return `${cx},${cz}`;
}

export function worldToCell(x, z) {
  return { cx: Math.floor(x / MAP_CELL), cz: Math.floor(z / MAP_CELL) };
}

class MapSystem {
  constructor() {
    this.data = null;
    this.world = null;
    this.open = false;
    this.panX = 0;
    this.panZ = 0;
    this.zoom = 4; // px per world block
    this.drag = null;
    this.canvas = null;
    this.ctx = null;
    this.player = null;
    this.bound = false;
    this.lastCell = null;
  }

  attach(state, world) {
    this.data = state.map;
    if (!this.data.discoveredCells) this.data.discoveredCells = {};
    if (!this.data.markers) this.data.markers = {};
    this.world = world;
    if (!this.bound) {
      this.bindEvents();
      this.bound = true;
    }
  }

  bindEvents() {
    events.on("structureDiscovered", (p) => {
      this.addMarker(p);
      const extra = REVEAL_RADIUS[p.structureType];
      if (extra && p.x != null) this.revealRadius(p.x, p.z, extra, p.structureType);
    });
    events.on("regionDiscovered", (p) => {
      if (p.x == null) return;
      this.revealAt(p.x, p.z);
    });
    events.on("regionGateOpened", (p) => {
      if (!this.data) return;
      for (const m of Object.values(this.data.markers)) {
        if (m.type === "regional_gate" || (p.regionId === "region_4" && m.type === "gym_crimson")) {
          m.opened = true;
        }
      }
    });
  }

  bindCanvas(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
  }

  discoveredCount() {
    return this.data ? Object.keys(this.data.discoveredCells).length : 0;
  }

  approxSaveBytes() {
    if (!this.data) return 0;
    try { return JSON.stringify(this.data).length; } catch { return 0; }
  }

  revealAt(x, z, neighbors = true) {
    if (!this.data || !this.world) return 0;
    const { cx, cz } = worldToCell(x, z);
    let n = this._revealCell(cx, cz);
    if (neighbors) {
      for (let dz = -1; dz <= 1; dz++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx || dz) n += this._revealCell(cx + dx, cz + dz);
        }
      }
    }
    return n;
  }

  revealRadius(x, z, radiusCells, source = "tower") {
    if (!this.data || !this.world) return 0;
    const { cx, cz } = worldToCell(x, z);
    let n = 0;
    const r = Math.max(1, radiusCells | 0);
    for (let dz = -r; dz <= r; dz++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dz * dz > r * r + 1) continue;
        n += this._revealCell(cx + dx, cz + dz);
      }
    }
    if (n > 0) {
      events.emit("mapAreaRevealed", {
        source,
        centerX: x,
        centerZ: z,
        radius: r,
        newCells: n,
      });
    }
    return n;
  }

  _revealCell(cx, cz) {
    const key = cellKey(cx, cz);
    if (this.data.discoveredCells[key]) return 0;
    const wx = cx * MAP_CELL + MAP_CELL / 2;
    const wz = cz * MAP_CELL + MAP_CELL / 2;
    const biomeId = this.world.biomeAt(wx, wz);
    this.data.discoveredCells[key] = biomeId;
    return 1;
  }

  addMarker(p) {
    if (!this.data || !p?.structureId || !MAP_MARKERS[p.structureType]) return;
    const prev = this.data.markers[p.structureId];
    this.data.markers[p.structureId] = {
      id: p.structureId,
      type: p.structureType,
      x: p.x,
      z: p.z,
      y: p.y,
      opened: prev?.opened ?? false,
    };
  }

  pollPlayer(player) {
    if (!player || !this.data) return;
    this.player = player;
    const { cx, cz } = worldToCell(player.pos.x, player.pos.z);
    const key = `${cx},${cz}`;
    if (this.lastCell !== key) {
      this.lastCell = key;
      this.revealAt(player.pos.x, player.pos.z, true);
    }
  }

  centerOnPlayer() {
    if (!this.player) return;
    this.panX = this.player.pos.x;
    this.panZ = this.player.pos.z;
  }

  show() {
    this.open = true;
    this.centerOnPlayer();
    this.resize();
    this.draw();
  }

  hide() {
    this.open = false;
    this.drag = null;
  }

  resize() {
    if (!this.canvas) return;
    const wrap = this.canvas.parentElement;
    const w = wrap?.clientWidth || window.innerWidth;
    const h = wrap?.clientHeight || window.innerHeight - 80;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.max(64, w * dpr);
    this.canvas.height = Math.max(64, h * dpr);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  worldToScreen(x, z, cssW, cssH) {
    const px = cssW / 2 + (x - this.panX) * this.zoom;
    const py = cssH / 2 + (z - this.panZ) * this.zoom;
    return { px, py };
  }

  screenToWorld(px, py, cssW, cssH) {
    return {
      x: this.panX + (px - cssW / 2) / this.zoom,
      z: this.panZ + (py - cssH / 2) / this.zoom,
    };
  }

  onWheel(e) {
    if (!this.open) return;
    const dir = e.deltaY > 0 ? 0.9 : 1.1;
    this.zoom = Math.max(1.2, Math.min(14, this.zoom * dir));
    this.draw();
  }

  onPointerDown(e) {
    if (!this.open) return;
    if (e.button === 2) {
      const rect = this.canvas.getBoundingClientRect();
      const w = this.worldFromEvent(e, rect);
      this.data.waypoint = { x: w.x, z: w.z };
      this.draw();
      return;
    }
    this.drag = { x: e.clientX, y: e.clientY, panX: this.panX, panZ: this.panZ };
  }

  onPointerMove(e) {
    if (!this.drag) return;
    this.panX = this.drag.panX - (e.clientX - this.drag.x) / this.zoom;
    this.panZ = this.drag.panZ - (e.clientY - this.drag.y) / this.zoom;
    this.draw();
  }

  onPointerUp() {
    this.drag = null;
  }

  worldFromEvent(e, rect) {
    return this.screenToWorld(e.clientX - rect.left, e.clientY - rect.top, rect.width, rect.height);
  }

  draw() {
    if (!this.canvas || !this.ctx || !this.data) return;
    const ctx = this.ctx;
    const rect = this.canvas.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    ctx.fillStyle = "#0c0e14";
    ctx.fillRect(0, 0, w, h);

    const z = this.zoom;
    const margin = MAP_CELL * 2;
    const x0 = this.panX - w / (2 * z) - margin;
    const x1 = this.panX + w / (2 * z) + margin;
    const z0 = this.panZ - h / (2 * z) - margin;
    const z1 = this.panZ + h / (2 * z) + margin;
    const c0x = Math.floor(x0 / MAP_CELL);
    const c1x = Math.floor(x1 / MAP_CELL);
    const c0z = Math.floor(z0 / MAP_CELL);
    const c1z = Math.floor(z1 / MAP_CELL);

    for (let cz = c0z; cz <= c1z; cz++) {
      for (let cx = c0x; cx <= c1x; cx++) {
        const cell = this.data.discoveredCells[cellKey(cx, cz)];
        const wx = cx * MAP_CELL;
        const wz = cz * MAP_CELL;
        const { px, py } = this.worldToScreen(wx, wz, w, h);
        const s = MAP_CELL * z;
        const biomeId = typeof cell === "string" ? cell : cell?.biomeId;
        if (biomeId) {
          ctx.fillStyle = MAP_PALETTE[biomeId] ?? MAP_PALETTE.plains;
          ctx.globalAlpha = 0.92;
          ctx.fillRect(px, py, s + 0.5, s + 0.5);
          ctx.globalAlpha = 1;
        } else {
          ctx.fillStyle = "#141824";
          ctx.fillRect(px, py, s + 0.5, s + 0.5);
          if (z >= 5) {
            ctx.strokeStyle = "rgba(255,255,255,0.04)";
            ctx.strokeRect(px, py, s, s);
          }
        }
      }
    }

    const markers = Object.values(this.data.markers).sort(
      (a, b) => (MAP_MARKERS[a.type]?.z ?? 0) - (MAP_MARKERS[b.type]?.z ?? 0)
    );
    for (const m of markers) {
      const def = MAP_MARKERS[m.type];
      if (!def) continue;
      const { cx, cz } = worldToCell(m.x, m.z);
      if (!this.data.discoveredCells[cellKey(cx, cz)]) continue;
      const { px, py } = this.worldToScreen(m.x, m.z, w, h);
      ctx.beginPath();
      ctx.fillStyle = def.color;
      ctx.arc(px, py, Math.max(4, z * 0.55), 0, Math.PI * 2);
      ctx.fill();
      if (m.type === "regional_gate") {
        ctx.strokeStyle = m.opened || regions.isGateOpened("region_2") ? "#6ee86e" : "#c04040";
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      if (m.type.startsWith("gym")) {
        const gid = m.type === "gym" ? "gym_verdant" : m.type;
        const badge = gid === "gym_verdant" ? "verdant_badge"
          : gid === "gym_mist" ? "mist_badge"
          : gid === "gym_crimson" ? "crimson_badge"
          : gid === "gym_gale" ? "gale_badge"
          : gid === "gym_tide" ? "tide_badge"
          : null;
        const done = gyms.isCompleted?.(gid) || (badge && progression.hasBadge(badge));
        ctx.strokeStyle = done ? "#6ee86e" : "#f0d878";
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      if (z >= 3.2) {
        ctx.fillStyle = "#f4f6ff";
        ctx.font = `${Math.max(10, Math.min(16, z * 2.2))}px Figtree, sans-serif`;
        ctx.fillText(def.icon, px + 6, py - 4);
      }
    }

    if (this.data.waypoint) {
      const { px, py } = this.worldToScreen(this.data.waypoint.x, this.data.waypoint.z, w, h);
      ctx.strokeStyle = "#ffe08a";
      ctx.beginPath();
      ctx.moveTo(px, py - 10);
      ctx.lineTo(px, py + 10);
      ctx.moveTo(px - 10, py);
      ctx.lineTo(px + 10, py);
      ctx.stroke();
    }

    if (this.player) {
      const { px, py } = this.worldToScreen(this.player.pos.x, this.player.pos.z, w, h);
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(this.player.yaw);
      ctx.fillStyle = "#fff";
      ctx.strokeStyle = "#101018";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -9);
      ctx.lineTo(6, 7);
      ctx.lineTo(0, 3);
      ctx.lineTo(-6, 7);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }

  waypointHud(player) {
    const wp = this.data?.waypoint;
    if (!wp || !player) return null;
    const dx = wp.x - player.pos.x;
    const dz = wp.z - player.pos.z;
    const dist = Math.hypot(dx, dz);
    return { dist, dx, dz };
  }

  snapshot() {
    const { cx, cz } = this.player ? worldToCell(this.player.pos.x, this.player.pos.z) : { cx: 0, cz: 0 };
    return {
      cell: `${cx},${cz}`,
      discovered: this.discoveredCount(),
      markers: Object.keys(this.data?.markers ?? {}).length,
      markerTypes: Object.values(this.data?.markers ?? {}).map((m) => m.type),
      approxBytes: this.approxSaveBytes(),
      zoom: this.zoom,
      open: this.open,
    };
  }

  /** Debug/cheat: revela un radio de celdas. No es gameplay. */
  debugRevealRadius(n) {
    if (!this.player) return 0;
    return this.revealRadius(this.player.pos.x, this.player.pos.z, n, "debug");
  }

  debugFillCells(count) {
    if (!this.player || !this.world) return 0;
    const { cx, cz } = worldToCell(this.player.pos.x, this.player.pos.z);
    let n = 0;
    const side = Math.ceil(Math.sqrt(count));
    for (let dz = 0; dz < side && n < count; dz++) {
      for (let dx = 0; dx < side && n < count; dx++) {
        n += this._revealCell(cx + dx, cz + dz);
      }
    }
    return n;
  }
}

export const worldMap = new MapSystem();
void getRegionName;
void getBiomeName;
void REGION_1;
