/**
 * Mundo vóxel infinito por chunks: generación procedural (biomas, lagos,
 * montañas, árboles), meshing con culling de caras y colores por vértice,
 * edición de bloques con persistencia y raycast DDA.
 */

import * as THREE from "three";
import { fbm2, columnHash } from "./noise.js";
import { B, BLOCK_NAMES, BLOCK_DROPS, COLORS } from "./blocks.js";
import { BIOME_NAMES, getBiomeDefinition } from "./biomes.js";
import { RESOURCES } from "./resources.js";
import { StructureIndex } from "./structures.js";
import { bindGymLookup, getRegionAt, REGION_2, REGION_3, REGION_4, REGION_5, region4HeightBonus, region5Height, regions } from "./regions.js";
import { stampRegionalPaths } from "./routes.js";

// Reexportados para los consumidores existentes (main.js, ui.js…)
export { B, BLOCK_NAMES, BLOCK_DROPS } from "./blocks.js";
export { BIOME_NAMES } from "./biomes.js";

export const CHUNK = 16;
export const HEIGHT = 64;
export const WATER_Y = 12;

// [dx,dy,dz, sombreado, 4 vértices de la cara] — orden CCW visto desde fuera
const FACES = [
  { dir: [1, 0, 0], shade: 0.8, corners: [[1, 1, 0], [1, 1, 1], [1, 0, 0], [1, 0, 1]] },
  { dir: [-1, 0, 0], shade: 0.8, corners: [[0, 1, 1], [0, 1, 0], [0, 0, 1], [0, 0, 0]] },
  { dir: [0, 1, 0], shade: 1.0, corners: [[0, 1, 1], [1, 1, 1], [0, 1, 0], [1, 1, 0]] },
  { dir: [0, -1, 0], shade: 0.5, corners: [[0, 0, 0], [1, 0, 0], [0, 0, 1], [1, 0, 1]] },
  { dir: [0, 0, 1], shade: 0.7, corners: [[1, 1, 1], [0, 1, 1], [1, 0, 1], [0, 0, 1]] },
  { dir: [0, 0, -1], shade: 0.7, corners: [[0, 1, 0], [1, 1, 0], [0, 0, 0], [1, 0, 0]] },
];

const idx = (x, y, z) => x + z * CHUNK + y * CHUNK * CHUNK;
const chunkKey = (cx, cz) => `${cx},${cz}`;

export class World {
  constructor(scene, seed, edits = {}) {
    this.scene = scene;
    this.seed = seed >>> 0;
    this.chunks = new Map();
    /** Bloques modificados por el jugador: "x,y,z" -> id */
    this.edits = { ...edits };
    this.meshQueue = [];
    this.solidMat = new THREE.MeshLambertMaterial({ vertexColors: true });
    this.waterMat = new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: 0.7, side: THREE.DoubleSide });
    this.viewRadius = 6;
    /** Índice determinista de estructuras procedurales (por celdas) */
    this.structures = new StructureIndex(this);
    bindGymLookup((type, cx, cz) => this.structures.candidate(type, cx, cz));
    this.lastGenMs = 0;
  }

  // ---------- Generación ----------

  terrainAt(x, z) {
    const s = this.seed;
    const mBio = fbm2(x * 0.004, z * 0.004, s + 7700, 3);
    const mountain = smoothstep(0.55, 0.78, mBio);
    const desert = mountain < 0.3 && fbm2(x * 0.003 + 500, z * 0.003 - 500, s + 1230, 3) > 0.63;
    const forest = fbm2(x * 0.006 - 900, z * 0.006 + 900, s + 4110, 3);
    let h = 10 + fbm2(x * 0.012, z * 0.012, s, 4) * 12;
    h += mountain * fbm2(x * 0.02, z * 0.02, s + 310, 4) * 30;
    h = Math.min(HEIGHT - 6, Math.floor(h));
    return { h, mountain, desert, treeDensity: desert ? 0 : 0.015 + smoothstep(0.5, 0.75, forest) * 0.075 };
  }

  /** Clasificación geométrica de bioma a partir de los datos de terrainAt */
  biomeFromTerrain(t) {
    if (t.h <= WATER_Y - 3) return "ocean";
    if (t.h <= WATER_Y + 1) return "beach";
    if (t.h > 34) return "snow";
    if (t.mountain > 0.55) return "mountain";
    if (t.desert) return "desert";
    if (t.treeDensity > 0.05) return "forest";
    return "plains";
  }

  /** Bioma geométrico original. Las estructuras clásicas consultan ESTO. */
  baseBiomeAt(x, z) {
    return this.biomeFromTerrain(this.terrainAt(Math.floor(x), Math.floor(z)));
  }

  /**
   * Bioma jugable.
   *   Región 2: plains/forest → mist_forest (ocean/beach/desert/snow/mountain intactos).
   *   Región 3: overlay crimson_highlands sobre tierra firme (no ocean/beach).
   *   Región 4: overlay wind_highlands sobre tierra firme (no ocean/beach).
   *   Región 5: overlay azure_archipelago (incluye costa y canales).
   * Fuera de esos rectángulos coincide con baseBiomeAt (saves antiguos intactos).
   * terrainAt no se modifica: el overlay es solo clasificación + bloques superficiales.
   * La verticalidad de R4 se aplica en generateChunkData vía region4HeightBonus.
   * La costa de R5 se aplica vía region5Height (no toca terrainAt de R1–R4).
   */
  biomeAt(x, z) {
    const fx = Math.floor(x);
    const fz = Math.floor(z);
    const base = this.biomeFromTerrain(this.terrainAt(fx, fz));
    const region = getRegionAt(fx, fz);
    if (region === REGION_5) {
      return "azure_archipelago";
    }
    if (region === REGION_4 && base !== "ocean" && base !== "beach") {
      return "wind_highlands";
    }
    if (region === REGION_3 && base !== "ocean" && base !== "beach") {
      return "crimson_highlands";
    }
    if (region === REGION_2 && (base === "plains" || base === "forest")) {
      return "mist_forest";
    }
    return base;
  }

  region4BonusAt(x, z) {
    if (getRegionAt(x, z) !== REGION_4) return 0;
    return region4HeightBonus(Math.floor(x), Math.floor(z), this.seed);
  }

  region5HeightAt(x, z, terrainH = null) {
    const t = terrainH ?? this.terrainAt(Math.floor(x), Math.floor(z)).h;
    return region5Height(Math.floor(x), Math.floor(z), this.seed, t, regions.homeGym());
  }

  /** Altura de columna con overlays regionales (pura: no lee chunks). */
  columnHeight(x, z) {
    const t = this.terrainAt(Math.floor(x), Math.floor(z));
    const region = getRegionAt(x, z);
    if (region === REGION_5) return this.region5HeightAt(x, z, t.h);
    if (region === REGION_4 && t.h > WATER_Y) {
      return Math.min(HEIGHT - 4, t.h + this.region4BonusAt(x, z));
    }
    return t.h;
  }

  hasTreeAt(x, z) {
    const t = this.terrainAt(x, z);
    if (t.h <= WATER_Y + 1 || t.mountain > 0.6) return null;
    // Región 3: vegetación muy escasa. Región 4: arbustos bajos aparte.
    const region = getRegionAt(x, z);
    if (region === REGION_4) return null;
    const density = region === REGION_3 ? 0.006 : t.treeDensity;
    if (columnHash(x, z, this.seed + 999) >= density) return null;
    // Evita árboles pegados
    if (columnHash(x - 1, z, this.seed + 999) < this.terrainAt(x - 1, z).treeDensity) return null;
    if (columnHash(x, z - 1, this.seed + 999) < this.terrainAt(x, z - 1).treeDensity) return null;
    const th = 4 + Math.floor(columnHash(x, z, this.seed + 555) * 2);
    return { h: t.h, trunk: th };
  }

  /**
   * Árbol extra solo en el rectángulo de Región 2. Sal distinta a hasTreeAt
   * para no alterar la vegetación de Región 1.
   */
  hasMistTreeAt(x, z) {
    if (getRegionAt(x, z) !== REGION_2) return null;
    const base = this.baseBiomeAt(x, z);
    if (base !== "plains" && base !== "forest") return null;
    const t = this.terrainAt(x, z);
    if (t.h <= WATER_Y + 1 || t.mountain > 0.6) return null;
    if (this.hasTreeAt(x, z)) return null;
    const salt = this.seed + 77123;
    if (columnHash(x, z, salt) >= 0.2) return null;
    if (columnHash(x - 1, z, salt) < 0.2) return null;
    if (columnHash(x, z - 1, salt) < 0.2) return null;
    const th = 5 + Math.floor(columnHash(x, z, this.seed + 556) * 2);
    return { h: t.h, trunk: th };
  }

  /** Arbustos inclinados solo en Región 4. Sal distinta a hasTreeAt. */
  hasWindShrubAt(x, z) {
    if (getRegionAt(x, z) !== REGION_4) return null;
    const t = this.terrainAt(x, z);
    if (t.h <= WATER_Y + 1) return null;
    const salt = this.seed + 88127;
    if (columnHash(x, z, salt) >= 0.045) return null;
    if (columnHash(x - 1, z, salt) < 0.045) return null;
    const h = t.h + this.region4BonusAt(x, z);
    const th = 2 + Math.floor(columnHash(x, z, this.seed + 557) * 2);
    return { h, trunk: th };
  }

  generateChunkData(cx, cz) {
    const t0 = performance.now();
    const data = new Uint8Array(CHUNK * CHUNK * HEIGHT);
    const x0 = cx * CHUNK;
    const z0 = cz * CHUNK;

    for (let lz = 0; lz < CHUNK; lz++) {
      for (let lx = 0; lx < CHUNK; lx++) {
        const wx = x0 + lx;
        const wz = z0 + lz;
        const t = this.terrainAt(wx, wz);
        let h = t.h;
        const overlayBiome = this.biomeAt(wx, wz);
        if (overlayBiome === "wind_highlands" && t.h > WATER_Y) {
          h = Math.min(HEIGHT - 4, t.h + this.region4BonusAt(wx, wz));
        }
        if (overlayBiome === "azure_archipelago") {
          h = this.region5HeightAt(wx, wz, t.h);
        }
        for (let y = 0; y <= h; y++) {
          let b;
          if (y === 0) b = B.BEDROCK;
          else if (y < h - 3) b = B.STONE;
          else if (y < h) b = t.mountain > 0.55 ? B.STONE : B.DIRT;
          else {
            // Bloque superficial
            if (h <= WATER_Y + 1) b = B.SAND;
            else if (overlayBiome === "azure_archipelago") {
              b = columnHash(wx, wz, this.seed + 55121) > 0.55 ? B.GRASS : B.SAND;
              if (columnHash(wx, wz, this.seed + 55123) > 0.92) b = B.CORAL_ROCK;
            } else if (t.desert) b = B.SAND;
            else if (h > 34) b = B.SNOW;
            else if (t.mountain > 0.55 && h > 26) b = B.STONE;
            else b = B.GRASS;
          }
          data[idx(lx, y, lz)] = b;
        }
        if (t.desert && h > WATER_Y + 1 && overlayBiome !== "wind_highlands") {
          for (let y = Math.max(1, h - 2); y < h; y++) data[idx(lx, y, lz)] = B.SAND;
        }
        for (let y = h + 1; y <= WATER_Y; y++) data[idx(lx, y, lz)] = B.WATER;

        // Overlays visuales: solo dentro de su rectángulo regional.
        if (overlayBiome === "mist_forest" && data[idx(lx, h, lz)] === B.GRASS) {
          data[idx(lx, h, lz)] = B.MIST_GRASS;
        }
        if (overlayBiome === "crimson_highlands") {
          const top = data[idx(lx, h, lz)];
          if (top === B.GRASS || top === B.STONE || top === B.SAND || top === B.SNOW ||
              top === B.DIRT || top === B.MIST_GRASS) {
            data[idx(lx, h, lz)] = B.CRIMSON_STONE;
          }
        }
        if (overlayBiome === "wind_highlands") {
          const exposed = columnHash(wx, wz, this.seed + 44011) > 0.38;
          for (let y = Math.max(t.h, 1); y < h; y++) {
            if (data[idx(lx, y, lz)] === B.DIRT || data[idx(lx, y, lz)] === B.STONE) {
              data[idx(lx, y, lz)] = B.WINDSTONE;
            }
          }
          data[idx(lx, h, lz)] = exposed ? B.WINDSTONE : B.SKY_GRASS;
        }

        // Recursos especiales según las reglas del bioma (hash determinista
        // por columna: mismo seed → mismas vetas, sin coste apreciable).
        const rules = getBiomeDefinition(overlayBiome).resources;
        for (let ri = 0; ri < rules.length; ri++) {
          const rule = rules[ri];
          if (columnHash(wx, wz, this.seed + 90210 + ri * 7919) >= rule.chance) continue;
          const res = RESOURCES[rule.id];
          if (!res || res.crafted) continue;
          if (res.surface) {
            const ground = data[idx(lx, h, lz)];
            const okGround = ground === B.GRASS || ground === B.MIST_GRASS || ground === B.CRIMSON_STONE ||
              ground === B.SKY_GRASS || ground === B.WINDSTONE || ground === B.SAND || ground === B.PACKED_SAND ||
              ground === B.CORAL_ROCK;
            if (h > WATER_Y + 1 && h + 1 < HEIGHT && okGround) {
              data[idx(lx, h + 1, lz)] = res.block;
            }
          } else {
            const d = res.depth;
            const lo = d.minY;
            const hi = Math.min(d.maxY ?? HEIGHT - 1, h - d.belowSurface);
            if (hi >= lo) {
              const y = Math.min(hi, lo + Math.floor(columnHash(wx, wz, this.seed + 131071 + ri * 101) * (hi - lo + 1)));
              const i = idx(lx, y, lz);
              if (data[i] === B.STONE || data[i] === B.WINDSTONE) data[i] = res.block;
            }
          }
        }
      }
    }

    // Árboles (se consideran columnas vecinas para copas que cruzan el borde)
    for (let tz = z0 - 3; tz < z0 + CHUNK + 3; tz++) {
      for (let tx = x0 - 3; tx < x0 + CHUNK + 3; tx++) {
        const tree = this.hasTreeAt(tx, tz);
        if (!tree) continue;
        const stamp = (wx, wy, wz, b, keepSolid = false) => {
          const lx = wx - x0;
          const lz = wz - z0;
          if (lx < 0 || lx >= CHUNK || lz < 0 || lz >= CHUNK || wy < 1 || wy >= HEIGHT) return;
          const i = idx(lx, wy, lz);
          if (keepSolid && data[i] !== B.AIR) return;
          data[i] = b;
        };
        const baseY = tree.h + 1;
        const topY = tree.h + tree.trunk;
        for (let dy = -2; dy <= 1; dy++) {
          const y = topY + dy;
          const r = dy < 0 ? 2 : 1;
          for (let ox = -r; ox <= r; ox++) {
            for (let oz = -r; oz <= r; oz++) {
              if (Math.abs(ox) === r && Math.abs(oz) === r && r === 2) continue;
              if (dy === 1 && Math.abs(ox) + Math.abs(oz) > 1) continue;
              stamp(tx + ox, y, tz + oz, B.LEAVES, true);
            }
          }
        }
        for (let y = baseY; y <= topY; y++) stamp(tx, y, tz, B.WOOD);
      }
    }

    // Vegetación extra de Región 2 (no altera hasTreeAt de Región 1)
    for (let tz = z0 - 3; tz < z0 + CHUNK + 3; tz++) {
      for (let tx = x0 - 3; tx < x0 + CHUNK + 3; tx++) {
        const tree = this.hasMistTreeAt(tx, tz);
        if (!tree) continue;
        const stamp = (wx, wy, wz, b, keepSolid = false) => {
          const lx = wx - x0;
          const lz = wz - z0;
          if (lx < 0 || lx >= CHUNK || lz < 0 || lz >= CHUNK || wy < 1 || wy >= HEIGHT) return;
          const i = idx(lx, wy, lz);
          if (keepSolid && data[i] !== B.AIR) return;
          data[i] = b;
        };
        const baseY = tree.h + 1;
        const topY = tree.h + tree.trunk;
        for (let dy = -2; dy <= 1; dy++) {
          const y = topY + dy;
          const r = dy < 0 ? 2 : 1;
          for (let ox = -r; ox <= r; ox++) {
            for (let oz = -r; oz <= r; oz++) {
              if (Math.abs(ox) === r && Math.abs(oz) === r && r === 2) continue;
              if (dy === 1 && Math.abs(ox) + Math.abs(oz) > 1) continue;
              stamp(tx + ox, y, tz + oz, B.LEAVES, true);
            }
          }
        }
        for (let y = baseY; y <= topY; y++) stamp(tx, y, tz, B.WOOD);
      }
    }

    // Arbustos alpinos de Región 4 (no altera hasTreeAt de R1–R3)
    for (let tz = z0 - 2; tz < z0 + CHUNK + 2; tz++) {
      for (let tx = x0 - 2; tx < x0 + CHUNK + 2; tx++) {
        const shrub = this.hasWindShrubAt(tx, tz);
        if (!shrub) continue;
        const stamp = (wx, wy, wz, b, keepSolid = false) => {
          const lx = wx - x0;
          const lz = wz - z0;
          if (lx < 0 || lx >= CHUNK || lz < 0 || lz >= CHUNK || wy < 1 || wy >= HEIGHT) return;
          const i = idx(lx, wy, lz);
          if (keepSolid && data[i] !== B.AIR) return;
          data[i] = b;
        };
        const lean = columnHash(tx, tz, this.seed + 12) > 0.5 ? 1 : -1;
        for (let y = shrub.h + 1; y <= shrub.h + shrub.trunk; y++) stamp(tx, y, tz, B.WOOD);
        stamp(tx + lean, shrub.h + shrub.trunk, tz, B.LEAVES, true);
        stamp(tx, shrub.h + shrub.trunk + 1, tz, B.LEAVES, true);
        stamp(tx - lean, shrub.h + shrub.trunk, tz, B.LEAVES, true);
      }
    }

    // Estructuras procedurales deterministas que intersectan este chunk
    const stampStruct = (wx, wy, wz, b) => {
      const lx = wx - x0;
      const lz = wz - z0;
      if (lx < 0 || lx >= CHUNK || lz < 0 || lz >= CHUNK || wy < 1 || wy >= HEIGHT) return;
      data[idx(lx, wy, lz)] = b;
    };
    this.structures.stampChunk(x0, z0, CHUNK, stampStruct);
    stampRegionalPaths(this, x0, z0, CHUNK, stampStruct);

    // Ediciones del jugador
    for (const key in this.edits) {
      const [ex, ey, ez] = key.split(",").map(Number);
      const lx = ex - x0;
      const lz = ez - z0;
      if (lx >= 0 && lx < CHUNK && lz >= 0 && lz < CHUNK && ey >= 0 && ey < HEIGHT) {
        data[idx(lx, ey, lz)] = this.edits[key];
      }
    }

    this.lastGenMs = performance.now() - t0;
    return data;
  }

  ensureChunkData(cx, cz) {
    const key = chunkKey(cx, cz);
    let c = this.chunks.get(key);
    if (!c) {
      c = { cx, cz, data: this.generateChunkData(cx, cz), mesh: null, waterMesh: null, dirty: true };
      this.chunks.set(key, c);
    }
    return c;
  }

  // ---------- Acceso a bloques ----------

  getBlock(x, y, z) {
    if (y < 0) return B.BEDROCK;
    if (y >= HEIGHT) return B.AIR;
    const cx = Math.floor(x / CHUNK);
    const cz = Math.floor(z / CHUNK);
    const c = this.ensureChunkData(cx, cz);
    return c.data[idx(x - cx * CHUNK, y, z - cz * CHUNK)];
  }

  setBlock(x, y, z, b) {
    if (y < 1 || y >= HEIGHT) return;
    const cx = Math.floor(x / CHUNK);
    const cz = Math.floor(z / CHUNK);
    const c = this.ensureChunkData(cx, cz);
    const lx = x - cx * CHUNK;
    const lz = z - cz * CHUNK;
    c.data[idx(lx, y, lz)] = b;
    this.edits[`${x},${y},${z}`] = b;
    this.markDirty(cx, cz);
    if (lx === 0) this.markDirty(cx - 1, cz);
    if (lx === CHUNK - 1) this.markDirty(cx + 1, cz);
    if (lz === 0) this.markDirty(cx, cz - 1);
    if (lz === CHUNK - 1) this.markDirty(cx, cz + 1);
  }

  markDirty(cx, cz) {
    const c = this.chunks.get(chunkKey(cx, cz));
    if (c) c.dirty = true;
  }

  isSolid(x, y, z) {
    const b = this.getBlock(Math.floor(x), Math.floor(y), Math.floor(z));
    return b !== B.AIR && b !== B.WATER;
  }

  isWater(x, y, z) {
    return this.getBlock(Math.floor(x), Math.floor(y), Math.floor(z)) === B.WATER;
  }

  /** Altura del primer bloque sólido (techo del terreno) en una columna */
  surfaceY(x, z) {
    for (let y = HEIGHT - 1; y > 0; y--) {
      const b = this.getBlock(Math.floor(x), y, Math.floor(z));
      if (b !== B.AIR && b !== B.WATER) return y;
    }
    return 1;
  }

  // ---------- Meshing ----------

  buildChunkMesh(c) {
    const x0 = c.cx * CHUNK;
    const z0 = c.cz * CHUNK;
    const solid = { pos: [], nrm: [], col: [], idx: [] };
    const water = { pos: [], nrm: [], col: [], idx: [] };

    const pushFace = (buf, wx, wy, wz, face, color, shadeJitter) => {
      const base = buf.pos.length / 3;
      for (const [ox, oy, oz] of face.corners) {
        buf.pos.push(wx + ox, wy + oy, wz + oz);
        buf.nrm.push(face.dir[0], face.dir[1], face.dir[2]);
        const s = face.shade * shadeJitter;
        buf.col.push(color[0] * s, color[1] * s, color[2] * s);
      }
      buf.idx.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
    };

    for (let y = 0; y < HEIGHT; y++) {
      for (let lz = 0; lz < CHUNK; lz++) {
        for (let lx = 0; lx < CHUNK; lx++) {
          const b = c.data[idx(lx, y, lz)];
          if (b === B.AIR) continue;
          const wx = x0 + lx;
          const wz = z0 + lz;
          const jitter = 0.93 + columnHash(wx * 7 + y, wz * 13 - y, this.seed + 42) * 0.12;
          const isWaterBlock = b === B.WATER;
          for (const face of FACES) {
            const nb = this.getBlock(wx + face.dir[0], y + face.dir[1], wz + face.dir[2]);
            if (isWaterBlock) {
              if (nb !== B.AIR) continue;
              const color = COLORS[B.WATER][face.dir[1] > 0 ? "top" : "side"];
              pushFace(water, wx, y, wz, face, color, jitter);
            } else {
              if (nb !== B.AIR && nb !== B.WATER) continue;
              const set = COLORS[b];
              const color = face.dir[1] > 0 ? set.top : face.dir[1] < 0 ? set.bottom : set.side;
              pushFace(solid, wx, y, wz, face, color, jitter);
            }
          }
        }
      }
    }

    if (c.mesh) {
      this.scene.remove(c.mesh);
      c.mesh.geometry.dispose();
      c.mesh = null;
    }
    if (c.waterMesh) {
      this.scene.remove(c.waterMesh);
      c.waterMesh.geometry.dispose();
      c.waterMesh = null;
    }

    if (solid.pos.length) {
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(solid.pos, 3));
      g.setAttribute("normal", new THREE.Float32BufferAttribute(solid.nrm, 3));
      g.setAttribute("color", new THREE.Float32BufferAttribute(solid.col, 3));
      g.setIndex(solid.idx);
      c.mesh = new THREE.Mesh(g, this.solidMat);
      c.mesh.matrixAutoUpdate = false;
      this.scene.add(c.mesh);
    }
    if (water.pos.length) {
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(water.pos, 3));
      g.setAttribute("normal", new THREE.Float32BufferAttribute(water.nrm, 3));
      g.setAttribute("color", new THREE.Float32BufferAttribute(water.col, 3));
      g.setIndex(water.idx);
      c.waterMesh = new THREE.Mesh(g, this.waterMat);
      c.waterMesh.matrixAutoUpdate = false;
      this.scene.add(c.waterMesh);
    }
    c.dirty = false;
  }

  /** Carga/actualiza chunks alrededor del jugador. budget = mallas por llamada */
  update(px, pz, budget = 2) {
    const pcx = Math.floor(px / CHUNK);
    const pcz = Math.floor(pz / CHUNK);
    const R = this.viewRadius;

    const pending = [];
    for (let dz = -R; dz <= R; dz++) {
      for (let dx = -R; dx <= R; dx++) {
        if (dx * dx + dz * dz > R * R + 2) continue;
        const c = this.ensureChunkData(pcx + dx, pcz + dz);
        if (c.dirty || (!c.mesh && !c.waterMesh && !c.meshedEmpty)) {
          pending.push({ c, d: dx * dx + dz * dz });
        }
      }
    }
    pending.sort((a, b) => a.d - b.d);
    for (let i = 0; i < Math.min(budget, pending.length); i++) {
      const c = pending[i].c;
      this.buildChunkMesh(c);
      c.meshedEmpty = !c.mesh && !c.waterMesh;
    }

    // Descarga chunks lejanos
    for (const [key, c] of this.chunks) {
      const dx = c.cx - pcx;
      const dz = c.cz - pcz;
      if (dx * dx + dz * dz > (R + 3) * (R + 3)) {
        if (c.mesh) {
          this.scene.remove(c.mesh);
          c.mesh.geometry.dispose();
        }
        if (c.waterMesh) {
          this.scene.remove(c.waterMesh);
          c.waterMesh.geometry.dispose();
        }
        this.chunks.delete(key);
      }
    }
    return pending.length;
  }

  /** Raycast DDA contra bloques sólidos. Devuelve el bloque y la cara golpeada. */
  raycast(origin, dir, maxDist = 6) {
    let x = Math.floor(origin.x);
    let y = Math.floor(origin.y);
    let z = Math.floor(origin.z);
    const stepX = dir.x > 0 ? 1 : -1;
    const stepY = dir.y > 0 ? 1 : -1;
    const stepZ = dir.z > 0 ? 1 : -1;
    const tDeltaX = Math.abs(1 / (dir.x || 1e-10));
    const tDeltaY = Math.abs(1 / (dir.y || 1e-10));
    const tDeltaZ = Math.abs(1 / (dir.z || 1e-10));
    let tMaxX = tDeltaX * (dir.x > 0 ? 1 - (origin.x - x) : origin.x - x);
    let tMaxY = tDeltaY * (dir.y > 0 ? 1 - (origin.y - y) : origin.y - y);
    let tMaxZ = tDeltaZ * (dir.z > 0 ? 1 - (origin.z - z) : origin.z - z);
    let nx = 0, ny = 0, nz = 0;
    let t = 0;

    while (t <= maxDist) {
      const b = this.getBlock(x, y, z);
      if (b !== B.AIR && b !== B.WATER) {
        return { x, y, z, block: b, nx, ny, nz, dist: t };
      }
      if (tMaxX < tMaxY && tMaxX < tMaxZ) {
        x += stepX; t = tMaxX; tMaxX += tDeltaX; nx = -stepX; ny = 0; nz = 0;
      } else if (tMaxY < tMaxZ) {
        y += stepY; t = tMaxY; tMaxY += tDeltaY; nx = 0; ny = -stepY; nz = 0;
      } else {
        z += stepZ; t = tMaxZ; tMaxZ += tDeltaZ; nx = 0; ny = 0; nz = -stepZ;
      }
    }
    return null;
  }
}

function smoothstep(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}
