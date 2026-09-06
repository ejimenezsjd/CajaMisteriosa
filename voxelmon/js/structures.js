/**
 * Sistema de estructuras procedurales (Fase 2).
 *
 * Estrategia determinista y barata:
 *  - El mundo se divide en celdas grandes por tipo de estructura (cell).
 *  - Un hash por (celda, semilla, sal del tipo) decide si esa celda contiene
 *    una estructura y en qué posición dentro de la celda. Mismo seed → misma
 *    estructura siempre, sin búsquedas globales.
 *  - La validez usa solo world.terrainAt / biomas (funciones puras): nunca se
 *    tocan chunks al evaluar candidatos, así que puede llamarse durante la
 *    propia generación de chunks sin recursión.
 *  - El estampado ocurre en generateChunkData ANTES de aplicar las ediciones
 *    del jugador, de modo que los bloques que el jugador modifique sobre una
 *    estructura siempre prevalecen.
 *  - Los candidatos se cachean por celda para consultas de cercanía O(1).
 *
 * Una celda por tipo garantiza que dos estructuras del mismo tipo nunca se
 * solapan (margen >= radio dentro de la celda).
 */

import { B } from "./blocks.js";
import { columnHash, mulberry32 } from "./noise.js";
import { getBiomeDefinition } from "./biomes.js";
import { WATER_Y } from "./world.js";

const SALT = { camp: 11001, ruin: 22002, healing_shrine: 33003 };

/** Radio máximo entre todos los tipos: margen de solape chunk/estructura */
export const MAX_STRUCT_RADIUS = 4;

export const STRUCTURE_TYPES = {
  camp: {
    id: "camp",
    name: "Campamento",
    icon: "⛺",
    cell: 72, // una posible estructura por celda de 72×72 bloques
    chance: 0.3,
    radius: 3,
    maxSlope: 2,
    build: buildCamp,
  },
  ruin: {
    id: "ruin",
    name: "Ruinas",
    icon: "🏛",
    cell: 96,
    chance: 0.32,
    radius: 4,
    maxSlope: 3,
    build: buildRuin,
  },
  healing_shrine: {
    id: "healing_shrine",
    name: "Santuario curativo",
    icon: "✨",
    cell: 120,
    chance: 0.42,
    radius: 2,
    maxSlope: 2,
    build: buildShrine,
  },
};

// ---------- Plantillas (deterministas: usan solo el rng recibido) ----------

/** Rellena una columna de suelo desde el terreno real hasta la cota y */
function fillFloor(stamp, ground, x, y, z, dx, dz, block) {
  const g = ground(dx, dz);
  for (let yy = Math.min(g, y); yy <= y; yy++) stamp(x + dx, yy, z + dz, block);
}

function clearAir(stamp, x, y, z, radius, height) {
  for (let dx = -radius; dx <= radius; dx++) {
    for (let dz = -radius; dz <= radius; dz++) {
      for (let dy = 1; dy <= height; dy++) stamp(x + dx, y + dy, z + dz, B.AIR);
    }
  }
}

/** Campamento: suelo de tierra, fogata central y toldo de hojas */
function buildCamp(stamp, x, y, z, rng, ground) {
  clearAir(stamp, x, y, z, 3, 8); // altura 8: elimina árboles completos del footprint
  for (let dx = -2; dx <= 2; dx++) {
    for (let dz = -2; dz <= 2; dz++) {
      fillFloor(stamp, ground, x, y, z, dx, dz, B.DIRT);
    }
  }
  // Fogata: anillo de piedra con brasas de carbón
  stamp(x, y + 1, z, B.COAL_ORE);
  stamp(x + 1, y + 1, z, B.STONE);
  stamp(x - 1, y + 1, z, B.STONE);
  stamp(x, y + 1, z + 1, B.STONE);
  stamp(x, y + 1, z - 1, B.STONE);
  // Troncos-asiento en dos esquinas
  const corners = [[2, 2], [2, -2], [-2, 2], [-2, -2]];
  const first = Math.floor(rng() * 4);
  stamp(x + corners[first][0], y + 1, z + corners[first][1], B.WOOD);
  stamp(x + corners[(first + 2) % 4][0], y + 1, z + corners[(first + 2) % 4][1], B.WOOD);
  // Toldo lateral: dos postes y techo de hojas (orientación aleatoria)
  const side = rng() < 0.5 ? 1 : -1;
  stamp(x + side * 3, y + 1, z - 1, B.WOOD);
  stamp(x + side * 3, y + 2, z - 1, B.WOOD);
  stamp(x + side * 3, y + 1, z + 1, B.WOOD);
  stamp(x + side * 3, y + 2, z + 1, B.WOOD);
  for (let dz = -1; dz <= 1; dz++) {
    stamp(x + side * 2, y + 3, z + dz, B.LEAVES);
    stamp(x + side * 3, y + 3, z + dz, B.LEAVES);
  }
}

/** Ruina: suelo de piedra parcial, pilares incompletos y muros rotos */
function buildRuin(stamp, x, y, z, rng, ground) {
  clearAir(stamp, x, y, z, 4, 8);
  for (let dx = -3; dx <= 3; dx++) {
    for (let dz = -3; dz <= 3; dz++) {
      if (rng() < 0.68) fillFloor(stamp, ground, x, y, z, dx, dz, B.STONE);
    }
  }
  // Pilares incompletos en las esquinas
  for (const [cx, cz] of [[3, 3], [3, -3], [-3, 3], [-3, -3]]) {
    fillFloor(stamp, ground, x, y, z, cx, cz, B.STONE);
    const h = 2 + Math.floor(rng() * 3);
    for (let dy = 1; dy <= h; dy++) stamp(x + cx, y + dy, z + cz, B.STONE);
  }
  // Restos de muro en dos lados
  for (let d = -2; d <= 2; d++) {
    if (rng() < 0.55) {
      const h = 1 + Math.floor(rng() * 2);
      for (let dy = 1; dy <= h; dy++) stamp(x + d, y + dy, z - 3, B.STONE);
    }
    if (rng() < 0.55) {
      const h = 1 + Math.floor(rng() * 2);
      for (let dy = 1; dy <= h; dy++) stamp(x - 3, y + dy, z + d, B.STONE);
    }
  }
}

/** Santuario curativo: plataforma de piedra con columna de cristal */
function buildShrine(stamp, x, y, z, rng, ground) {
  clearAir(stamp, x, y, z, 2, 8);
  for (let dx = -2; dx <= 2; dx++) {
    for (let dz = -2; dz <= 2; dz++) {
      fillFloor(stamp, ground, x, y, z, dx, dz, B.STONE);
    }
  }
  // Postes en las esquinas
  for (const [cx, cz] of [[2, 2], [2, -2], [-2, 2], [-2, -2]]) {
    stamp(x + cx, y + 1, z + cz, B.STONE);
    if (rng() < 0.5) stamp(x + cx, y + 2, z + cz, B.CRYSTAL);
  }
  // Columna central coronada por el cristal sanador
  stamp(x, y + 1, z, B.STONE);
  stamp(x, y + 2, z, B.STONE);
  stamp(x, y + 3, z, B.CRYSTAL);
}

// ---------- Índice determinista por celdas ----------

export class StructureIndex {
  constructor(world) {
    this.world = world;
    this.cache = new Map(); // "type:cellX,cellZ" -> candidato | null
  }

  /** Candidato (o null) de un tipo en una celda concreta. Cacheado. */
  candidate(type, cellX, cellZ) {
    const key = `${type}:${cellX},${cellZ}`;
    if (this.cache.has(key)) return this.cache.get(key);

    const def = STRUCTURE_TYPES[type];
    const seed = this.world.seed;
    const salt = SALT[type];
    let result = null;

    if (columnHash(cellX, cellZ, seed + salt) < def.chance) {
      // Posición dentro de la celda con margen para no invadir celdas vecinas
      const m = def.radius + 2;
      const span = def.cell - 2 * m;
      const x = cellX * def.cell + m + Math.floor(columnHash(cellX, cellZ, seed + salt + 1) * span);
      const z = cellZ * def.cell + m + Math.floor(columnHash(cellX, cellZ, seed + salt + 2) * span);

      const t = this.world.terrainAt(x, z);
      const biome = this.world.biomeAt(x, z);
      let ok = getBiomeDefinition(biome).structures.includes(type) && t.h > WATER_Y + 1;
      if (ok) {
        // Terreno razonablemente plano y sin agua en el contorno
        const r = def.radius;
        for (const [dx, dz] of [[r, r], [r, -r], [-r, r], [-r, -r]]) {
          const hc = this.world.terrainAt(x + dx, z + dz).h;
          if (Math.abs(hc - t.h) > def.maxSlope || hc <= WATER_Y) { ok = false; break; }
        }
      }
      if (ok) {
        result = {
          id: `${type}:${cellX},${cellZ}`,
          type,
          name: def.name,
          icon: def.icon,
          cellX,
          cellZ,
          x,
          y: t.h,
          z,
          biome,
        };
      }
    }
    this.cache.set(key, result);
    return result;
  }

  /** Estructuras cuyo footprint intersecta el rectángulo dado */
  inRect(xMin, zMin, xMax, zMax) {
    const out = [];
    for (const type in STRUCTURE_TYPES) {
      const def = STRUCTURE_TYPES[type];
      const r = def.radius;
      const c0x = Math.floor((xMin - r) / def.cell);
      const c1x = Math.floor((xMax + r) / def.cell);
      const c0z = Math.floor((zMin - r) / def.cell);
      const c1z = Math.floor((zMax + r) / def.cell);
      for (let cz = c0z; cz <= c1z; cz++) {
        for (let cx = c0x; cx <= c1x; cx++) {
          const s = this.candidate(type, cx, cz);
          if (s && s.x + r >= xMin && s.x - r <= xMax && s.z + r >= zMin && s.z - r <= zMax) {
            out.push(s);
          }
        }
      }
    }
    return out;
  }

  /** Estructuras cuyo centro está a menos de `radius` bloques (horizontal) */
  near(x, z, radius) {
    return this.inRect(x - radius, z - radius, x + radius, z + radius)
      .filter((s) => Math.hypot(s.x - x, s.z - z) <= radius);
  }

  /** Estampa en un chunk (x0,z0 esquina, size bloques) las estructuras que lo tocan */
  stampChunk(x0, z0, size, stamp) {
    const list = this.inRect(x0 - MAX_STRUCT_RADIUS, z0 - MAX_STRUCT_RADIUS,
      x0 + size - 1 + MAX_STRUCT_RADIUS, z0 + size - 1 + MAX_STRUCT_RADIUS);
    for (const s of list) {
      const def = STRUCTURE_TYPES[s.type];
      const rng = mulberry32((this.world.seed ^ Math.imul(s.cellX, 73856093) ^ Math.imul(s.cellZ, 19349663) ^ SALT[s.type]) >>> 0);
      const ground = (dx, dz) => this.world.terrainAt(s.x + dx, s.z + dz).h;
      def.build(stamp, s.x, s.y, s.z, rng, ground);
    }
  }
}
