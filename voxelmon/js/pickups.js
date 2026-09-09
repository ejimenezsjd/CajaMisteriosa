/**
 * Pickups de mundo data-driven (Fase 13).
 *
 * Deterministas, one-shot, persistidos como set sparse de ids:
 *   state.worldPickups.collected[pickupId] = true
 *
 * Nunca loot tables. Nunca markers de mapa. InventorySystem.add() es la
 * única mutación de inventario.
 */

import { events } from "./events.js";
import { REGION_GEOMETRY, getRegionAt, regions } from "./regions.js";
import { inventory } from "./inventory.js";
import { itemDef } from "./items.js";
import { economy } from "./economy.js";

export const WORLD_PICKUPS = [
  {
    id: "azure_plaza_herb",
    itemId: "medicinal_herb",
    amount: 2,
    structure: "azure_port",
    local: [4, 3],
    hidden: false,
    oneTime: true,
  },
  {
    id: "azure_dock_cubes",
    itemId: "balls",
    amount: 3,
    structure: "azure_port",
    local: [6, 18],
    hidden: false,
    oneTime: true,
  },
  {
    id: "azure_warehouse_coins",
    itemId: "coins",
    amount: 40,
    structure: "azure_port",
    local: [-16, 15],
    hidden: false,
    oneTime: true,
  },
  {
    id: "azure_dock_end_coral",
    itemId: "coral_fragment",
    amount: 1,
    structure: "azure_port",
    local: [1, 22],
    hidden: true,
    oneTime: true,
  },
  {
    id: "azure_lookout_kit",
    itemId: "explorer_kit",
    amount: 1,
    structure: "tide_lookout",
    local: [0, 0],
    hidden: false,
    oneTime: true,
  },
  {
    id: "azure_camp_herb",
    itemId: "medicinal_herb",
    amount: 1,
    structure: "fisherman_camp",
    local: [2, 1],
    hidden: false,
    oneTime: true,
  },
  {
    id: "azure_shrine_pearl",
    itemId: "tidal_pearl",
    amount: 1,
    structure: "weathered_shrine",
    local: [0, 0],
    hidden: true,
    oneTime: true,
  },
  {
    id: "azure_bridge_under",
    itemId: "coral_fragment",
    amount: 1,
    structure: "azure_bridge",
    local: [0, 3],
    hidden: true,
    oneTime: true,
  },
  {
    id: "azure_ruins_pearl",
    itemId: "tidal_pearl",
    amount: 1,
    structure: "tidal_ruins",
    local: [0, 4],
    hidden: false,
    oneTime: true,
  },
  {
    id: "azure_ruins_coral",
    itemId: "coral_fragment",
    amount: 2,
    structure: "tidal_ruins",
    local: [-4, 1],
    hidden: true,
    oneTime: true,
  },
  {
    id: "azure_lighthouse_cubes",
    itemId: "balls",
    amount: 2,
    structure: "azure_lighthouse",
    local: [3, -2],
    hidden: false,
    oneTime: true,
  },
];

class PickupSystem {
  constructor() {
    this.data = null;
    this.world = null;
  }

  attach(state, world) {
    if (!state.worldPickups || typeof state.worldPickups !== "object") {
      state.worldPickups = { collected: {} };
    }
    if (!state.worldPickups.collected || typeof state.worldPickups.collected !== "object") {
      state.worldPickups.collected = {};
    }
    this.data = state.worldPickups;
    this.world = world ?? this.world;
    this.state = state;
  }

  isCollected(id) {
    return !!this.data?.collected[id];
  }

  def(id) {
    return WORLD_PICKUPS.find((p) => p.id === id) ?? null;
  }

  /** Resuelve posición mundial a partir del StructureIndex. */
  worldPos(def) {
    const gym = regions.homeGym();
    if (!gym || !this.world) return null;
    const s = this.world.structures.candidate(def.structure, gym.cellX, gym.cellZ);
    if (!s) return null;
    const [lx, lz] = def.local;
    return { x: s.x + lx, y: s.y + 1, z: s.z + lz, structure: s };
  }

  nearby(px, pz, radius = 28) {
    const out = [];
    for (const def of WORLD_PICKUPS) {
      if (this.isCollected(def.id)) continue;
      const pos = this.worldPos(def);
      if (!pos) continue;
      if (Math.hypot(pos.x - px, pos.z - pz) > radius) continue;
      out.push({ ...def, ...pos });
    }
    return out;
  }

  collect(id) {
    const def = this.def(id);
    if (!def || !this.data || this.isCollected(id)) {
      return { ok: false, error: "Ya recogido." };
    }
    const pos = this.worldPos(def);
    if (def.itemId === "coins") {
      economy.grantMoney(def.amount, { source: "pickup", pickupId: id });
    } else {
      inventory.add(def.itemId, def.amount, "world_pickup");
    }
    this.data.collected[id] = true;
    const regionId = pos ? getRegionAt(pos.x, pos.z) : null;
    const payload = {
      pickupId: id,
      itemId: def.itemId,
      amount: def.amount,
      regionId,
      hidden: !!def.hidden,
    };
    events.emit("itemPickedUp", payload);
    if (def.itemId !== "coins") {
      events.emit("resourceCollected", {
        resourceId: def.itemId,
        amount: def.amount,
        source: "pickup",
        pickupId: id,
      });
    }
    return { ok: true, ...payload, label: itemDef(def.itemId)?.name ?? def.itemId };
  }

  snapshot() {
    return {
      total: WORLD_PICKUPS.length,
      collected: Object.keys(this.data?.collected ?? {}),
      remaining: WORLD_PICKUPS.filter((p) => !this.isCollected(p.id)).map((p) => p.id),
    };
  }
}

export const pickups = new PickupSystem();

export function pickupOffsetFromGym(def) {
  const g = REGION_GEOMETRY;
  const key = {
    azure_port: g.azurePort,
    azure_bridge: g.azureBridge,
    tidal_ruins: g.tidalRuins,
    azure_lighthouse: g.azureLighthouse,
    tide_lookout: g.tideLookout,
    fisherman_camp: g.fishermanCamp,
    weathered_shrine: g.weatheredShrine,
    coastal_gate: g.coastalGate,
    broken_span: g.brokenSpan,
  }[def.structure];
  if (!key) return null;
  return { dx: key.dx + def.local[0], dz: key.dz + def.local[1] };
}
