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
import { REGION_GEOMETRY } from "./regions.js";

const SALT = {
  camp: 11001, ruin: 22002, healing_shrine: 33003, settlement: 44004, gym: 55005,
  regional_gate: 66006, watchtower: 77007, ancient_outpost: 88008,
};

const REGIONAL_TYPES = new Set(["regional_gate", "watchtower", "ancient_outpost"]);

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
  settlement: {
    id: "settlement",
    name: "Asentamiento",
    icon: "🏘",
    cell: 220, // hub poco frecuente: como mucho uno por celda de 220×220
    chance: 0.55,
    radius: 12,
    maxSlope: 3,
    build: buildSettlement,
    /**
     * Puntos de anclaje de NPC en coordenadas locales (dx, dz) respecto al
     * centro. La altura se resuelve en runtime con world.surfaceY.
     */
    npcAnchors: [
      { role: "researcher", local: [3, 6] },  // frente a la casa de la investigadora
      { role: "merchant", local: [-4, 4] },   // frente al puesto del comerciante
      { role: "healer", local: [3, -6] },     // frente a la casa de la sanadora
    ],
  },
  gym: {
    id: "gym",
    name: "Gimnasio Verde",
    icon: "🌿",
    cell: 260,
    chance: 0.5,
    radius: 14,
    maxSlope: 3,
    build: buildGym,
  },
  regional_gate: {
    id: "regional_gate",
    name: "Paso fronterizo",
    icon: "🚪",
    cell: 260,
    chance: 1,
    radius: 10,
    maxSlope: 8,
    build: buildRegionalGate,
    npcAnchors: [
      { role: "gatekeeper", local: [4, -4] },
    ],
  },
  watchtower: {
    id: "watchtower",
    name: "Atalaya brumosa",
    icon: "🗼",
    cell: 260,
    chance: 1,
    radius: 4,
    maxSlope: 8,
    build: buildWatchtower,
  },
  ancient_outpost: {
    id: "ancient_outpost",
    name: "Puesto ancestral",
    icon: "🏛",
    cell: 260,
    chance: 1,
    radius: 5,
    maxSlope: 8,
    build: buildAncientOutpost,
  },
};

/** Radio máximo entre todos los tipos: margen de solape chunk/estructura */
export const MAX_STRUCT_RADIUS = Math.max(...Object.values(STRUCTURE_TYPES).map((d) => d.radius));

/** Anchors de NPC de una estructura, resueltos a coordenadas de mundo (x,z) */
export function npcAnchorsFor(s) {
  const def = STRUCTURE_TYPES[s.type];
  if (!def?.npcAnchors) return [];
  return def.npcAnchors.map((a) => ({
    id: `${s.id}:${a.role}`,
    role: a.role,
    structureId: s.id,
    x: s.x + a.local[0],
    z: s.z + a.local[1],
  }));
}

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

/**
 * Cabaña sencilla: muros huecos, tejado, suelo con soporte y puerta de 1×2.
 * (cx, cz) = centro local; half = semiancho; doorSide = [-1|1, 0] o [0, -1|1].
 */
function buildHut(stamp, ground, x, y, z, cx, cz, half, wallBlock, roofBlock, doorSide) {
  for (let dx = -half; dx <= half; dx++) {
    for (let dz = -half; dz <= half; dz++) {
      const wx = cx + dx;
      const wz = cz + dz;
      fillFloor(stamp, ground, x, y, z, wx, wz, B.STONE);
      const isWall = Math.abs(dx) === half || Math.abs(dz) === half;
      if (isWall) {
        const isDoor = dx === doorSide[0] * half && dz === doorSide[1] * half &&
          (doorSide[0] === 0 ? dx === 0 : dz === 0);
        for (let dy = 1; dy <= 3; dy++) {
          if (isDoor && dy <= 2) continue; // hueco de puerta
          stamp(x + wx, y + dy, z + wz, wallBlock);
        }
      }
      stamp(x + wx, y + 4, z + wz, roofBlock);
    }
  }
}

/**
 * Asentamiento: plaza central con farola de cristal, caminos en cruz,
 * casa de la investigadora, casa de la sanadora, puesto del comerciante,
 * cobertizo y un pequeño huerto. Los NPC se anclan vía npcAnchors.
 */
function buildSettlement(stamp, x, y, z, rng, ground) {
  clearAir(stamp, x, y, z, 12, 10);

  // Caminos en cruz de tierra
  for (let d = -11; d <= 11; d++) {
    fillFloor(stamp, ground, x, y, z, d, 0, B.DIRT);
    fillFloor(stamp, ground, x, y, z, 0, d, B.DIRT);
  }

  // Plaza central de piedra 5×5 con farola
  for (let dx = -2; dx <= 2; dx++) {
    for (let dz = -2; dz <= 2; dz++) {
      fillFloor(stamp, ground, x, y, z, dx, dz, B.STONE);
    }
  }
  stamp(x, y + 1, z, B.WOOD);
  stamp(x, y + 2, z, B.WOOD);
  stamp(x, y + 3, z, B.CRYSTAL);

  // Casa de la investigadora (piedra, tejado de madera), puerta hacia la plaza
  buildHut(stamp, ground, x, y, z, 7, 6, 2, B.STONE, B.WOOD, [-1, 0]);
  // Casa de la sanadora (madera, tejado de hojas), puerta hacia la plaza
  buildHut(stamp, ground, x, y, z, 7, -6, 2, B.WOOD, B.LEAVES, [-1, 0]);

  // Puesto del comerciante: 4 postes, techo de hojas y mostrador
  for (const [px, pz] of [[-9, 2], [-9, 6], [-5, 2], [-5, 6]]) {
    fillFloor(stamp, ground, x, y, z, px, pz, B.WOOD);
    stamp(x + px, y + 1, z + pz, B.WOOD);
    stamp(x + px, y + 2, z + pz, B.WOOD);
  }
  for (let dx = -9; dx <= -5; dx++) {
    for (let dz = 2; dz <= 6; dz++) {
      fillFloor(stamp, ground, x, y, z, dx, dz, B.DIRT);
      stamp(x + dx, y + 3, z + dz, B.LEAVES);
    }
  }
  for (let dz = 3; dz <= 5; dz++) stamp(x - 5, y + 1, z + dz, B.WOOD); // mostrador

  // Cobertizo pequeño
  buildHut(stamp, ground, x, y, z, -7, -6, 1, B.WOOD, B.STONE, [1, 0]);

  // Huerto decorativo con hierbas medicinales
  for (let dx = -3; dx <= -1; dx++) {
    for (let dz = -10; dz <= -8; dz++) {
      fillFloor(stamp, ground, x, y, z, dx, dz, B.DIRT);
      if (rng() < 0.45) stamp(x + dx, y + 1, z + dz, B.HERB);
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

/**
 * Gimnasio Verde (Fase 5): edificio compacto de madera y hojas.
 * Sur → entrada (barrera de cristal) → recepción → salas laterales
 * (trainers) → sala puzzle (3 pedestales) → sala del líder (barrera).
 * Coordenadas locales alineadas con GYM_LAYOUT / TRAINERS.anchorOffset.
 */
function buildGym(stamp, x, y, z, rng, ground) {
  clearAir(stamp, x, y, z, 14, 10);

  // Plataforma de piedra y tejado de hojas
  for (let dx = -8; dx <= 8; dx++) {
    for (let dz = -13; dz <= 13; dz++) {
      fillFloor(stamp, ground, x, y, z, dx, dz, B.STONE);
      if (Math.abs(dx) <= 8 && dz >= -13 && dz <= 12) {
        stamp(x + dx, y + 6, z + dz, B.LEAVES);
      }
    }
  }

  const wall = (dx, dz, block = B.WOOD) => {
    for (let dy = 1; dy <= 5; dy++) stamp(x + dx, y + dy, z + dz, block);
  };

  // Perímetro: muro sur con puerta ceremonial de cristal en (0, 12)
  for (let dx = -8; dx <= 8; dx++) {
    for (let dz = -13; dz <= 12; dz++) {
      const edge = Math.abs(dx) === 8 || dz === -13 || dz === 12;
      if (!edge) continue;
      const mainDoor = dx === 0 && dz === 12;
      if (mainDoor) {
        stamp(x + dx, y + 1, z + dz, B.CRYSTAL);
        stamp(x + dx, y + 2, z + dz, B.CRYSTAL);
        for (let dy = 3; dy <= 5; dy++) stamp(x + dx, y + dy, z + dz, B.WOOD);
      } else {
        wall(dx, dz);
      }
    }
  }

  // Tabique de la sala del líder (dz = -7) con puerta de cristal en (0, -7)
  for (let dx = -7; dx <= 7; dx++) {
    if (dx === 0) {
      stamp(x, y + 1, z - 7, B.CRYSTAL);
      stamp(x, y + 2, z - 7, B.CRYSTAL);
      for (let dy = 3; dy <= 5; dy++) stamp(x, y + dy, z - 7, B.WOOD);
    } else {
      wall(dx, -7);
    }
  }

  // Tabique recepción / puzzle (dz = -1) con pasillo central
  for (let dx = -7; dx <= 7; dx++) {
    if (dx === 0) continue;
    wall(dx, -1);
  }

  // Salas laterales de trainers (dx = ±3, dz 0..6) con paso a dz = 3
  for (let dz = 0; dz <= 6; dz++) {
    if (dz === 3) continue;
    wall(-3, dz);
    wall(3, dz);
  }

  // Pedestales del puzzle: hoja / luz / agua (madera + cristal)
  for (const [dx, dz] of [[-4, -4], [0, -4], [4, -4]]) {
    stamp(x + dx, y + 1, z + dz, B.WOOD);
    stamp(x + dx, y + 2, z + dz, B.CRYSTAL);
  }

  // Farolas de cristal en recepción y sala del líder
  stamp(x, y + 1, z + 8, B.WOOD);
  stamp(x, y + 2, z + 8, B.CRYSTAL);
  stamp(x, y + 1, z - 10, B.WOOD);
  stamp(x, y + 2, z - 10, B.CRYSTAL);

  // Porche sur y hierbas decorativas
  for (let dx = -2; dx <= 2; dx++) fillFloor(stamp, ground, x, y, z, dx, 13, B.STONE);
  stamp(x - 2, y + 1, z + 13, B.CRYSTAL);
  stamp(x + 2, y + 1, z + 13, B.CRYSTAL);
  for (const [dx, dz] of [[-6, 13], [6, 13], [-7, 11], [7, 11]]) {
    if (rng() < 0.7) stamp(x + dx, y + 1, z + dz, B.HERB);
  }
}

/**
 * Portón fronterizo (Fase 6): dos torres, arco de piedra y verja de cristal.
 * El hueco se abre persistiendo ediciones de AIR cuando el jugador abre el paso.
 */
function buildRegionalGate(stamp, x, y, z, rng, ground) {
  clearAir(stamp, x, y, z, 10, 10);

  for (let dx = -8; dx <= 8; dx++) {
    for (let dz = -2; dz <= 2; dz++) {
      fillFloor(stamp, ground, x, y, z, dx, dz, B.STONE);
    }
  }

  const tower = (tx) => {
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        fillFloor(stamp, ground, x, y, z, tx + dx, dz, B.STONE);
        for (let dy = 1; dy <= 7; dy++) {
          const edge = Math.abs(dx) === 1 || Math.abs(dz) === 1;
          if (edge) stamp(x + tx + dx, y + dy, z + dz, B.STONE);
        }
        stamp(x + tx + dx, y + 8, z + dz, B.STONE);
      }
    }
    stamp(x + tx, y + 9, z, B.CRYSTAL);
  };
  tower(-6);
  tower(6);

  // Muro almenado a ambos lados del vano central
  for (const dx of [-4, -3, -2, 2, 3, 4]) {
    for (let dy = 1; dy <= 5; dy++) stamp(x + dx, y + dy, z, B.STONE);
    stamp(x + dx, y + 6, z, B.STONE);
  }
  for (let dx = -4; dx <= 4; dx++) stamp(x + dx, y + 6, z, B.STONE);

  // Verja de cristal (cerrada de serie; se abre con world edits)
  for (const dx of [-1, 0, 1]) {
    for (let dy = 1; dy <= 5; dy++) stamp(x + dx, y + dy, z, B.CRYSTAL);
  }

  stamp(x - 8, y + 1, z - 2, B.CRYSTAL);
  stamp(x + 8, y + 1, z - 2, B.CRYSTAL);
}

/** Atalaya alta con faro de cristal: landmark visible a distancia. */
function buildWatchtower(stamp, x, y, z, rng, ground) {
  clearAir(stamp, x, y, z, 4, 16);
  for (let dx = -2; dx <= 2; dx++) {
    for (let dz = -2; dz <= 2; dz++) {
      fillFloor(stamp, ground, x, y, z, dx, dz, B.STONE);
    }
  }
  for (let dy = 1; dy <= 12; dy++) {
    for (const [dx, dz] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
      stamp(x + dx, y + dy, z + dz, dy > 8 ? B.WOOD : B.STONE);
    }
  }
  for (let dx = -2; dx <= 2; dx++) {
    for (let dz = -2; dz <= 2; dz++) {
      stamp(x + dx, y + 10, z + dz, B.WOOD);
      if (Math.abs(dx) === 2 || Math.abs(dz) === 2) stamp(x + dx, y + 11, z + dz, B.WOOD);
    }
  }
  stamp(x, y + 13, z, B.WOOD);
  stamp(x, y + 14, z, B.CRYSTAL);
  if (rng() < 0.9) stamp(x + 2, y + 1, z, B.MIST_BLOOM);
}

/** Puesto ancestral: ruina con fragmentos y flores de bruma (lore / quest). */
function buildAncientOutpost(stamp, x, y, z, rng, ground) {
  clearAir(stamp, x, y, z, 5, 8);
  for (let dx = -4; dx <= 4; dx++) {
    for (let dz = -4; dz <= 4; dz++) {
      if (rng() < 0.8) fillFloor(stamp, ground, x, y, z, dx, dz, B.STONE);
    }
  }
  for (const [cx, cz] of [[4, 4], [4, -4], [-4, 4], [-4, -4]]) {
    fillFloor(stamp, ground, x, y, z, cx, cz, B.STONE);
    const h = 2 + Math.floor(rng() * 3);
    for (let dy = 1; dy <= h; dy++) stamp(x + cx, y + dy, z + cz, B.STONE);
  }
  for (let d = -3; d <= 3; d++) {
    if (rng() < 0.6) stamp(x + d, y + 1, z - 4, B.STONE);
    if (rng() < 0.6) stamp(x - 4, y + 1, z + d, B.STONE);
  }
  stamp(x, y + 1, z, B.STONE);
  stamp(x, y + 2, z, B.ANCIENT_FRAGMENT);
  stamp(x, y + 3, z, B.CRYSTAL);
  stamp(x + 2, y + 1, z + 1, B.ANCIENT_FRAGMENT);
  stamp(x - 2, y + 1, z - 1, B.MIST_BLOOM);
  stamp(x + 1, y + 1, z - 2, B.MIST_BLOOM);
  stamp(x - 1, y + 1, z + 2, B.MIST_BLOOM);
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

    if (REGIONAL_TYPES.has(type)) {
      result = this.regionalCandidate(type, cellX, cellZ);
      this.cache.set(key, result);
      return result;
    }

    if (columnHash(cellX, cellZ, seed + salt) < def.chance) {
      // Posición dentro de la celda con margen para no invadir celdas vecinas
      const m = def.radius + 2;
      const span = def.cell - 2 * m;
      const x = cellX * def.cell + m + Math.floor(columnHash(cellX, cellZ, seed + salt + 1) * span);
      const z = cellZ * def.cell + m + Math.floor(columnHash(cellX, cellZ, seed + salt + 2) * span);

      const t = this.world.terrainAt(x, z);
      // Tipos clásicos usan el bioma BASE para no desaparecer si el overlay
      // de Región 2 reclasifica plains/forest como mist_forest.
      const biome = this.world.baseBiomeAt(x, z);
      let ok = getBiomeDefinition(biome).structures.includes(type) && t.h > WATER_Y + 1;
      if (ok) {
        // Terreno razonablemente plano y sin agua en el contorno
        // (esquinas + puntos medios: importante para footprints grandes)
        const r = def.radius;
        for (const [dx, dz] of [[r, r], [r, -r], [-r, r], [-r, -r], [r, 0], [-r, 0], [0, r], [0, -r]]) {
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

  /**
   * Gate / atalaya / puesto: anclados al gimnasio de la misma celda.
   * Existen si y solo si existe el gimnasio (sin chance extra).
   */
  regionalCandidate(type, cellX, cellZ) {
    const gym = this.candidate("gym", cellX, cellZ);
    if (!gym) return null;
    const def = STRUCTURE_TYPES[type];
    const g = REGION_GEOMETRY;
    let x = gym.x;
    let z = gym.z;
    if (type === "regional_gate") {
      z = gym.z + g.gateZ;
    } else if (type === "watchtower") {
      x = gym.x + g.watchtower.dx;
      z = gym.z + g.watchtower.dz;
    } else if (type === "ancient_outpost") {
      x = gym.x + g.outpost.dx;
      z = gym.z + g.outpost.dz;
    }
    const t = this.world.terrainAt(x, z);
    return {
      id: `${type}:${cellX},${cellZ}`,
      type,
      name: def.name,
      icon: def.icon,
      cellX,
      cellZ,
      x,
      y: Math.max(t.h, WATER_Y + 1),
      z,
      biome: this.world.biomeAt(x, z),
    };
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
