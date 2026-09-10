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
import { REGION_GEOMETRY, regions } from "./regions.js";
import {
  stampBuilding, stampRoadSegment, stampProps, stampBoardwalk,
  stampRouteArch, stampMooredBoat,
} from "./settlement-kit.js";

const SALT = {
  camp: 11001, ruin: 22002, healing_shrine: 33003, settlement: 44004, gym: 55005,
  regional_gate: 66006, watchtower: 77007, ancient_outpost: 88008,
  mist_settlement: 99009,
  gym_mist: 11110,
  mining_camp: 12111,
  crimson_ruin: 13112,
  gym_crimson: 14113,
  cliff_outpost: 15114,
  wind_shrine: 16115,
  storm_observatory: 17116,
  tempest_spire: 18117,
  gym_gale: 19118,
  highland_exit: 20119,
  coastal_gate: 21120,
  azure_port: 22121,
  azure_bridge: 23122,
  tidal_ruins: 24123,
  azure_lighthouse: 25124,
  tide_lookout: 26125,
  fisherman_camp: 27126,
  weathered_shrine: 28127,
  broken_span: 29128,
  reef_atoll: 30129,
  tidal_bridge: 31130,
  gym_tide: 32131,
  open_sea_gate: 33132,
};

const REGIONAL_TYPES = new Set([
  "regional_gate", "watchtower", "ancient_outpost", "mist_settlement", "gym_mist",
  "mining_camp", "crimson_ruin", "gym_crimson",
  "cliff_outpost", "wind_shrine", "storm_observatory",
  "tempest_spire", "gym_gale", "highland_exit",
  "coastal_gate", "azure_port", "azure_bridge", "tidal_ruins", "azure_lighthouse",
  "tide_lookout", "fisherman_camp", "weathered_shrine", "broken_span",
  "reef_atoll", "tidal_bridge", "gym_tide", "open_sea_gate",
]);

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
  mist_settlement: {
    id: "mist_settlement",
    name: "Refugio Brumoso",
    icon: "🏘",
    cell: 260,
    chance: 1,
    radius: 11,
    maxSlope: 8,
    build: buildMistSettlement,
    npcAnchors: [
      { role: "craftsman", local: [6, 3], indoor: true },
      { role: "herbalist", local: [-6, 3], indoor: true },
      { role: "regional_guide", local: [0, -5], indoor: true },
    ],
  },
  gym_mist: {
    id: "gym_mist",
    name: "Gimnasio de las Brumas",
    icon: "🌫",
    cell: 260,
    chance: 1,
    radius: 16,
    maxSlope: 8,
    build: buildMistGym,
  },
  mining_camp: {
    id: "mining_camp",
    name: "Puesto minero",
    icon: "⛏",
    cell: 260,
    chance: 1,
    radius: 10,
    maxSlope: 8,
    build: buildMiningCamp,
    npcAnchors: [
      { role: "regional_merchant", local: [-4, 3] },
      { role: "prospector", local: [0, 0] },
      { role: "field_medic", local: [5, -2] },
    ],
  },
  crimson_ruin: {
    id: "crimson_ruin",
    name: "Ruina Carmesí",
    icon: "🏛",
    cell: 260,
    chance: 1,
    radius: 8,
    maxSlope: 8,
    build: buildCrimsonRuin,
  },
  gym_crimson: {
    id: "gym_crimson",
    name: "Gimnasio de la Forja",
    icon: "🔥",
    cell: 260,
    chance: 1,
    radius: 16,
    maxSlope: 8,
    build: buildForgeGym,
  },
  cliff_outpost: {
    id: "cliff_outpost",
    name: "Puesto del Acantilado",
    icon: "🏕",
    cell: 260,
    chance: 1,
    radius: 10,
    maxSlope: 12,
    build: buildCliffOutpost,
    npcAnchors: [
      { role: "wind_scout", local: [0, -4] },
      { role: "highland_merchant", local: [-4, 3] },
      { role: "storm_researcher", local: [5, 2] },
    ],
  },
  wind_shrine: {
    id: "wind_shrine",
    name: "Santuario del Viento",
    icon: "🌬",
    cell: 260,
    chance: 1,
    radius: 5,
    maxSlope: 12,
    build: buildWindShrine,
  },
  storm_observatory: {
    id: "storm_observatory",
    name: "Observatorio de la Tormenta",
    icon: "🔭",
    cell: 260,
    chance: 1,
    radius: 8,
    maxSlope: 14,
    build: buildStormObservatory,
  },
  tempest_spire: {
    id: "tempest_spire",
    name: "Pináculo del Vendaval",
    icon: "⚡",
    cell: 260,
    chance: 1,
    radius: 8,
    maxSlope: 14,
    build: buildTempestSpire,
  },
  gym_gale: {
    id: "gym_gale",
    name: "Gimnasio del Vendaval",
    icon: "🌬",
    cell: 260,
    chance: 1,
    radius: 13,
    maxSlope: 14,
    build: buildGaleGym,
  },
  highland_exit: {
    id: "highland_exit",
    name: "Arco de las alturas",
    icon: "↕",
    cell: 260,
    chance: 1,
    radius: 6,
    maxSlope: 14,
    build: buildHighlandExit,
  },
  coastal_gate: {
    id: "coastal_gate",
    name: "Arco de la costa",
    icon: "🚪",
    cell: 260,
    chance: 1,
    radius: 5,
    maxSlope: 16,
    build: buildCoastalGate,
  },
  azure_port: {
    id: "azure_port",
    name: "Puerto Azur",
    icon: "🏘",
    cell: 260,
    chance: 1,
    radius: 24,
    maxSlope: 16,
    safeZone: true,
    safeRadius: 12,
    build: buildAzurePort,
    npcAnchors: [
      { role: "azure_guide", local: [0, -8] },
      { role: "azure_healer", local: [-9, -4], indoor: true },
      { role: "azure_merchant", local: [9, -3] },
      { role: "sailor", local: [4, 16] },
      { role: "child_observer", local: [3, 2] },
      { role: "fisher", local: [-6, 14] },
      { role: "traveler", local: [6, -8] },
      { role: "creature_keeper", local: [-6, -1] },
    ],
  },
  azure_bridge: {
    id: "azure_bridge",
    name: "Puente de las mareas",
    icon: "🌉",
    cell: 260,
    chance: 1,
    radius: 8,
    maxSlope: 16,
    build: buildAzureBridge,
  },
  tidal_ruins: {
    id: "tidal_ruins",
    name: "Ruinas de Marea",
    icon: "🏛",
    cell: 260,
    chance: 1,
    radius: 12,
    maxSlope: 16,
    dungeon: true,
    wildAllowed: true,
    build: buildTidalRuins,
    npcAnchors: [
      { role: "azure_researcher", local: [6, -8] },
    ],
  },
  azure_lighthouse: {
    id: "azure_lighthouse",
    name: "Faro Azur",
    icon: "🗼",
    cell: 260,
    chance: 1,
    radius: 8,
    maxSlope: 16,
    build: buildAzureLighthouse,
  },
  tide_lookout: {
    id: "tide_lookout",
    name: "Mirador de la resaca",
    icon: "👁",
    cell: 260,
    chance: 1,
    radius: 4,
    maxSlope: 16,
    build: buildTideLookout,
  },
  fisherman_camp: {
    id: "fisherman_camp",
    name: "Campamento de redes",
    icon: "⛺",
    cell: 260,
    chance: 1,
    radius: 4,
    maxSlope: 16,
    build: buildFishermanCamp,
  },
  weathered_shrine: {
    id: "weathered_shrine",
    name: "Santuario erosionado",
    icon: "✨",
    cell: 260,
    chance: 1,
    radius: 3,
    maxSlope: 16,
    build: buildWeatheredShrine,
  },
  broken_span: {
    id: "broken_span",
    name: "Tramo roto",
    icon: "🪵",
    cell: 260,
    chance: 1,
    radius: 5,
    maxSlope: 16,
    build: buildBrokenSpan,
  },
  reef_atoll: {
    id: "reef_atoll",
    name: "Atolón del Arrecife",
    icon: "🐚",
    cell: 260,
    chance: 1,
    radius: 10,
    maxSlope: 16,
    safeZone: true,
    safeRadius: 10,
    build: buildReefAtoll,
  },
  tidal_bridge: {
    id: "tidal_bridge",
    name: "Puente de Marea",
    icon: "🌉",
    cell: 260,
    chance: 1,
    radius: 7,
    maxSlope: 16,
    build: buildTidalBridge,
  },
  gym_tide: {
    id: "gym_tide",
    name: "Gimnasio de las Mareas",
    icon: "🌊",
    cell: 260,
    chance: 1,
    radius: 14,
    maxSlope: 16,
    dungeon: true,
    safeZone: true,
    safeRadius: 14,
    build: buildTideGym,
  },
  open_sea_gate: {
    id: "open_sea_gate",
    name: "Arco del mar abierto",
    icon: "↕",
    cell: 260,
    chance: 1,
    radius: 6,
    maxSlope: 16,
    build: buildOpenSeaGate,
  },
};

/** Locales del banco y del arco sellado (Gym 2 hook) respecto al centro */
export const MIST_SETTLEMENT_LAYOUT = {
  workbench: [3, 1],
  ancientPath: [0, 10],
  pc: [4, -1],
};

/** Puesto minero (Fase 9): landmark central y sello de la ruina. */
export const MINING_CAMP_LAYOUT = {
  landmark: [0, 0],
  stall: [-4, 4],
};

export const CRIMSON_RUIN_LAYOUT = {
  seal: [0, 0],
  boss: [0, 4],
  pathGate: [0, 7],
};

export const SETTLEMENT_LAYOUT = {
  pc: [5, -3],
};

export const CLIFF_OUTPOST_LAYOUT = {
  stall: [-4, 4],
  lift: [0, 6],
  pc: [2, 5],
};

export const WIND_SHRINE_LAYOUT = {
  lift: [0, 0],
};

export const STORM_OBSERVATORY_LAYOUT = {
  seal: [0, 0],
  lift: [0, -4],
  beacon: [0, 0],
};

export const TEMPEST_SPIRE_LAYOUT = {
  boss: [0, 0],
  lift: [0, -5],
};

export const HIGHLAND_EXIT_LAYOUT = {
  arch: [0, 0],
  vista: [0, 4],
};

export const AZURE_PORT_LAYOUT = {
  plaza: [0, 0],
  clinic: [-9, -5],
  pc: [-9, -4],
  market: [9, -4],
  dock: [0, 16],
  home_nav: [-11, 7],
  home_net: [11, 6],
  warehouse: [-14, 14],
  lookout: [12, -11],
  sign: [0, -10],
};

export const TIDAL_RUINS_LAYOUT = {
  entrance: [0, -10],
  chamberA: [0, -2],
  chamberB: [-5, 4],
  chamberC: [5, 6],
  pickup: [0, 4],
};

export const AZURE_LIGHTHOUSE_LAYOUT = {
  door: [0, -5],
  lamp: [0, 0],
  lens: [0, 0],
  platform: [0, 0],
};

export const REEF_ATOLL_LAYOUT = {
  seal: [0, 0],
  boss: [0, 2],
  approach: [0, -8],
};

export const OPEN_SEA_GATE_LAYOUT = {
  arch: [0, 0],
  beacon: [0, 4],
};

export const COASTAL_GATE_LAYOUT = {
  arch: [0, 0],
  sign: [0, 2],
};

const AZURE_TYPES = new Set([
  "coastal_gate", "azure_port", "azure_bridge", "tidal_ruins", "azure_lighthouse",
  "tide_lookout", "fisherman_camp", "weathered_shrine", "broken_span",
  "reef_atoll", "tidal_bridge", "gym_tide", "open_sea_gate",
]);

export const PROTECTED_STRUCTURE_TYPES = new Set([
  "gym_gale", "tempest_spire", "highland_exit", "storm_observatory",
  "azure_lighthouse", "tidal_ruins",
  "gym_tide", "reef_atoll", "tidal_bridge", "open_sea_gate",
]);

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
    y: a.indoor ? s.y + 1 : undefined,
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
  // Terminal PC junto a la sanadora
  fillFloor(stamp, ground, x, y, z, 5, -3, B.STONE);
  stamp(x + 5, y + 1, z - 3, B.WOOD);
  stamp(x + 5, y + 2, z - 3, B.CRYSTAL);

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

/**
 * Refugio Brumoso (Fase 7): plaza, taller, herbolario, casa del guía
 * y arco sellado al sur (preparación del Gimnasio 2, no el gimnasio).
 */
function buildMistSettlement(stamp, x, y, z, rng, ground) {
  clearAir(stamp, x, y, z, 11, 10);

  for (let d = -10; d <= 10; d++) {
    fillFloor(stamp, ground, x, y, z, 0, d, B.STONE);
    fillFloor(stamp, ground, x, y, z, d, 0, B.MIST_GRASS);
  }
  for (let dx = -3; dx <= 3; dx++) {
    for (let dz = -3; dz <= 3; dz++) {
      fillFloor(stamp, ground, x, y, z, dx, dz, B.STONE);
    }
  }
  stamp(x, y + 1, z, B.WOOD);
  stamp(x, y + 2, z, B.CRYSTAL);

  // Taller del artesano (este) y banco de trabajo frente a la puerta
  buildHut(stamp, ground, x, y, z, 7, 4, 2, B.WOOD, B.MIST_GRASS, [-1, 0]);
  fillFloor(stamp, ground, x, y, z, 3, 1, B.WOOD);
  stamp(x + 3, y + 1, z + 1, B.WOOD);
  stamp(x + 3, y + 2, z + 1, B.COPPER_ORE);

  // Herbolario (oeste)
  buildHut(stamp, ground, x, y, z, -7, 4, 2, B.STONE, B.LEAVES, [1, 0]);
  for (let dx = -3; dx <= -1; dx++) {
    for (let dz = 7; dz <= 9; dz++) {
      fillFloor(stamp, ground, x, y, z, dx, dz, B.DIRT);
      if (rng() < 0.55) stamp(x + dx, y + 1, z + dz, B.MIST_BLOOM);
      else if (rng() < 0.4) stamp(x + dx, y + 1, z + dz, B.HERB);
    }
  }

  // Casa del explorador (norte de la plaza, dz negativo = hacia el gym)
  buildHut(stamp, ground, x, y, z, 0, -5, 2, B.STONE, B.WOOD, [0, 1]);
  fillFloor(stamp, ground, x, y, z, 4, -1, B.STONE);
  stamp(x + 4, y + 1, z - 1, B.WOOD);
  stamp(x + 4, y + 2, z - 1, B.CRYSTAL);

  // Arco sellado al sur: sendero hacia el futuro Gimnasio 2
  for (const dx of [-3, 3]) {
    for (let dy = 1; dy <= 6; dy++) stamp(x + dx, y + dy, z + 10, B.STONE);
    stamp(x + dx, y + 7, z + 10, B.CRYSTAL);
  }
  for (let dx = -2; dx <= 2; dx++) stamp(x + dx, y + 6, z + 10, B.STONE);
  for (const dx of [-1, 0, 1]) {
    for (let dy = 1; dy <= 5; dy++) stamp(x + dx, y + dy, z + 10, B.CRYSTAL);
  }
  for (let dx = -2; dx <= 2; dx++) fillFloor(stamp, ground, x, y, z, dx, 11, B.STONE);
}

/**
 * Gimnasio de las Brumas (Fase 8): piedra, musgo y cristal.
 * Norte → entrada (hacia el arco del refugio) → recepción → Nox
 * → cámara de faros → Lumen → sala de Nyra → barrera sur (hook R3).
 */
function buildMistGym(stamp, x, y, z, rng, ground) {
  clearAir(stamp, x, y, z, 16, 10);

  for (let dx = -8; dx <= 8; dx++) {
    for (let dz = -13; dz <= 15; dz++) {
      fillFloor(stamp, ground, x, y, z, dx, dz, B.STONE);
      if (dz <= 13) stamp(x + dx, y + 6, z + dz, B.MIST_GRASS);
    }
  }

  const wall = (dx, dz, block = B.STONE) => {
    for (let dy = 1; dy <= 5; dy++) stamp(x + dx, y + dy, z + dz, block);
  };

  for (let dx = -8; dx <= 8; dx++) {
    for (let dz = -12; dz <= 13; dz++) {
      const edge = Math.abs(dx) === 8 || dz === -12 || dz === 13;
      if (!edge) continue;
      const mainDoor = dx === 0 && dz === -12;
      if (mainDoor) {
        stamp(x + dx, y + 1, z + dz, B.CRYSTAL);
        stamp(x + dx, y + 2, z + dz, B.CRYSTAL);
        for (let dy = 3; dy <= 5; dy++) stamp(x + dx, y + dy, z + dz, B.STONE);
      } else {
        wall(dx, dz);
      }
    }
  }

  // Tabique de la sala del líder (dz = 7)
  for (let dx = -7; dx <= 7; dx++) {
    if (dx === 0) {
      stamp(x, y + 1, z + 7, B.CRYSTAL);
      stamp(x, y + 2, z + 7, B.CRYSTAL);
      for (let dy = 3; dy <= 5; dy++) stamp(x, y + dy, z + 7, B.STONE);
    } else {
      wall(dx, 7);
    }
  }

  // Separación recepción / cámara de faros (dz = -6) con pasillo
  for (let dx = -7; dx <= 7; dx++) {
    if (dx === 0) continue;
    wall(dx, -6);
  }

  // Sala oeste de Nox
  for (let dz = -8; dz <= -1; dz++) {
    if (dz === -3) continue;
    wall(-3, dz);
  }
  // Sala este de Lumen
  for (let dz = 2; dz <= 6; dz++) {
    if (dz === 4) continue;
    wall(3, dz);
  }

  // Faros: madera + cristal (cualquier orden)
  for (const [dx, dz] of [[0, -4], [-5, 1], [5, 1]]) {
    stamp(x + dx, y + 1, z + dz, B.STONE);
    stamp(x + dx, y + 2, z + dz, B.CRYSTAL);
    stamp(x + dx, y + 3, z + dz, B.ANCIENT_FRAGMENT);
  }

  stamp(x, y + 1, z - 9, B.STONE);
  stamp(x, y + 2, z - 9, B.CRYSTAL);
  stamp(x, y + 1, z + 10, B.STONE);
  stamp(x, y + 2, z + 10, B.CRYSTAL);
  // Madera oscura: pilares de recepción
  stamp(x - 6, y + 1, z - 10, B.WOOD);
  stamp(x - 6, y + 2, z - 10, B.WOOD);
  stamp(x + 6, y + 1, z - 10, B.WOOD);
  stamp(x + 6, y + 2, z - 10, B.WOOD);

  for (let dx = -2; dx <= 2; dx++) fillFloor(stamp, ground, x, y, z, dx, -13, B.STONE);
  stamp(x - 2, y + 1, z - 13, B.CRYSTAL);
  stamp(x + 2, y + 1, z - 13, B.CRYSTAL);

  // Barrera sur: hook hacia la siguiente región (no es Región 3)
  for (let dx = -3; dx <= 3; dx++) {
    fillFloor(stamp, ground, x, y, z, dx, 15, B.STONE);
    if (Math.abs(dx) <= 1) {
      for (let dy = 1; dy <= 5; dy++) stamp(x + dx, y + dy, z + 15, B.CRYSTAL);
    } else {
      wall(dx, 15);
    }
  }
}

/**
 * Puesto minero (Fase 9): plaza, forja-landmark, tenderete y tienda médica.
 * Útil: NPCs de economía, no decoración vacía.
 */
function buildMiningCamp(stamp, x, y, z, rng, ground) {
  clearAir(stamp, x, y, z, 10, 10);

  for (let dx = -8; dx <= 8; dx++) {
    for (let dz = -8; dz <= 8; dz++) {
      if (Math.abs(dx) + Math.abs(dz) > 14) continue;
      fillFloor(stamp, ground, x, y, z, dx, dz, B.CRIMSON_STONE);
    }
  }
  for (let dx = -3; dx <= 3; dx++) {
    for (let dz = -3; dz <= 3; dz++) {
      fillFloor(stamp, ground, x, y, z, dx, dz, B.STONE);
    }
  }

  // Landmark: pilar de forja
  stamp(x, y + 1, z, B.STONE);
  stamp(x, y + 2, z, B.COAL_ORE);
  stamp(x, y + 3, z, B.EMBER_ORE);
  stamp(x, y + 4, z, B.RED_CRYSTAL);

  // Tenderete del mercader (oeste)
  buildHut(stamp, ground, x, y, z, -5, 4, 2, B.WOOD, B.CRIMSON_STONE, [1, 0]);
  stamp(x - 4, y + 1, z + 4, B.WOOD);
  stamp(x - 4, y + 2, z + 4, B.COPPER_ORE);

  // Tienda médica (este)
  buildHut(stamp, ground, x, y, z, 6, -2, 2, B.STONE, B.WOOD, [-1, 0]);
  stamp(x + 4, y + 1, z - 2, B.HERB);

  // Vagoneta / vetas a la vista (sur)
  stamp(x - 1, y + 1, z + 6, B.WOOD);
  stamp(x, y + 1, z + 6, B.EMBER_ORE);
  stamp(x + 1, y + 1, z + 6, B.WOOD);
  if (rng() < 0.9) stamp(x + 2, y + 1, z + 5, B.RED_CRYSTAL);
  stamp(x - 6, y + 1, z - 5, B.IRON_ORE);
  stamp(x + 7, y + 1, z + 3, B.COAL_ORE);
}

/**
 * Ruina Carmesí: lore, recursos y sello inerte del tercer arco.
 * No es un gimnasio ni un boss.
 */
function buildCrimsonRuin(stamp, x, y, z, rng, ground) {
  clearAir(stamp, x, y, z, 6, 8);

  for (let dx = -5; dx <= 5; dx++) {
    for (let dz = -5; dz <= 5; dz++) {
      if (rng() < 0.82) fillFloor(stamp, ground, x, y, z, dx, dz, B.CRIMSON_STONE);
    }
  }
  for (const [cx, cz] of [[5, 5], [5, -5], [-5, 5], [-5, -5]]) {
    fillFloor(stamp, ground, x, y, z, cx, cz, B.STONE);
    const h = 2 + Math.floor(rng() * 3);
    for (let dy = 1; dy <= h; dy++) stamp(x + cx, y + dy, z + cz, B.CRIMSON_STONE);
  }
  for (let d = -4; d <= 4; d++) {
    if (rng() < 0.65) stamp(x + d, y + 1, z - 5, B.CRIMSON_STONE);
    if (rng() < 0.65) stamp(x + 5, y + 1, z + d, B.CRIMSON_STONE);
  }

  // Sello mineral (inerte hasta gym_3_clue_unlocked)
  stamp(x, y + 1, z, B.STONE);
  stamp(x, y + 2, z, B.CRYSTAL);

  stamp(x + 2, y + 1, z + 1, B.EMBER_ORE);
  stamp(x - 2, y + 1, z - 1, B.RED_CRYSTAL);
  if (rng() < 0.8) stamp(x - 1, y + 1, z + 3, B.EMBER_ORE);
  if (rng() < 0.7) stamp(x + 3, y + 1, z - 2, B.RED_CRYSTAL);

  // Patio del guardián (sur del sello)
  for (let dx = -2; dx <= 2; dx++) {
    for (let dz = 3; dz <= 5; dz++) {
      fillFloor(stamp, ground, x, y, z, dx, dz, B.STONE);
    }
  }
  stamp(x, y + 1, z + 4, B.CRIMSON_STONE);
  stamp(x, y + 2, z + 4, B.EMBER_ORE);

  // Barrera sur: camino al Gym 3 (se perfora con gym_3_path_unlocked)
  for (let dx = -3; dx <= 3; dx++) {
    fillFloor(stamp, ground, x, y, z, dx, 7, B.CRIMSON_STONE);
    if (Math.abs(dx) <= 1) {
      for (let dy = 1; dy <= 5; dy++) stamp(x + dx, y + dy, z + 7, B.RED_CRYSTAL);
    } else {
      for (let dy = 1; dy <= 4; dy++) stamp(x + dx, y + dy, z + 7, B.CRIMSON_STONE);
    }
  }
}

/**
 * Gimnasio de la Forja: calor, conductos de energía y cámara del líder.
 * Distinto de Gym 1 (secuencia) y Gym 2 (faros). Entrada al norte.
 */
function buildForgeGym(stamp, x, y, z, rng, ground) {
  clearAir(stamp, x, y, z, 16, 10);

  for (let dx = -8; dx <= 8; dx++) {
    for (let dz = -13; dz <= 15; dz++) {
      fillFloor(stamp, ground, x, y, z, dx, dz, B.CRIMSON_STONE);
      if (dz <= 13) stamp(x + dx, y + 6, z + dz, B.STONE);
    }
  }

  const wall = (dx, dz, block = B.CRIMSON_STONE) => {
    for (let dy = 1; dy <= 5; dy++) stamp(x + dx, y + dy, z + dz, block);
  };

  for (let dx = -8; dx <= 8; dx++) {
    for (let dz = -12; dz <= 13; dz++) {
      const edge = Math.abs(dx) === 8 || dz === -12 || dz === 13;
      if (!edge) continue;
      const mainDoor = dx === 0 && dz === -12;
      if (mainDoor) {
        stamp(x + dx, y + 1, z + dz, B.EMBER_ORE);
        stamp(x + dx, y + 2, z + dz, B.RED_CRYSTAL);
        for (let dy = 3; dy <= 5; dy++) stamp(x + dx, y + dy, z + dz, B.CRIMSON_STONE);
      } else {
        wall(dx, dz);
      }
    }
  }

  // Tabique de la sala del líder (dz = 7)
  for (let dx = -7; dx <= 7; dx++) {
    if (dx === 0) {
      stamp(x, y + 1, z + 7, B.EMBER_ORE);
      stamp(x, y + 2, z + 7, B.RED_CRYSTAL);
      for (let dy = 3; dy <= 5; dy++) stamp(x, y + dy, z + 7, B.CRIMSON_STONE);
    } else {
      wall(dx, 7);
    }
  }

  // Separación recepción / cámara de energía (dz = -6)
  for (let dx = -7; dx <= 7; dx++) {
    if (dx === 0) continue;
    wall(dx, -6);
  }

  // Sala oeste de Pyra: puerta en (-4, -2)
  for (let dz = -8; dz <= 3; dz++) {
    if (dz === -2) continue;
    wall(-3, dz);
  }
  for (let dx = -7; dx <= -4; dx++) {
    if (dx === -4) continue;
    wall(dx, -2);
  }
  stamp(x - 4, y + 1, z - 2, B.COPPER_ORE);
  stamp(x - 4, y + 2, z - 2, B.CRYSTAL);

  // Sala este de Flint: puerta en (4, -2)
  for (let dz = -8; dz <= 6; dz++) {
    if (dz === -2) continue;
    wall(3, dz);
  }
  for (let dx = 4; dx <= 7; dx++) {
    if (dx === 4) continue;
    wall(dx, -2);
  }
  stamp(x + 4, y + 1, z - 2, B.IRON_ORE);
  stamp(x + 4, y + 2, z - 2, B.CRYSTAL);

  // Conductos: cobre / hierro / carmesí (asignación de energía)
  stamp(x - 5, y + 1, z - 4, B.COPPER_ORE);
  stamp(x - 5, y + 2, z - 4, B.CRYSTAL);
  stamp(x + 5, y + 1, z - 4, B.IRON_ORE);
  stamp(x + 5, y + 2, z - 4, B.CRYSTAL);
  stamp(x, y + 1, z + 3, B.EMBER_ORE);
  stamp(x, y + 2, z + 3, B.RED_CRYSTAL);

  stamp(x, y + 1, z - 9, B.STONE);
  stamp(x, y + 2, z - 9, B.EMBER_ORE);
  stamp(x, y + 1, z + 10, B.STONE);
  stamp(x, y + 2, z + 10, B.RED_CRYSTAL);
  stamp(x - 6, y + 1, z - 10, B.COAL_ORE);
  stamp(x + 6, y + 1, z - 10, B.COAL_ORE);

  for (let dx = -2; dx <= 2; dx++) fillFloor(stamp, ground, x, y, z, dx, -13, B.CRIMSON_STONE);
  stamp(x - 2, y + 1, z - 13, B.EMBER_ORE);
  stamp(x + 2, y + 1, z - 13, B.EMBER_ORE);

  // Crimson Pass: hook sur hacia Región 4 (el hueco se abre al usar el paso)
  for (let dx = -3; dx <= 3; dx++) {
    fillFloor(stamp, ground, x, y, z, dx, 15, B.CRIMSON_STONE);
    if (Math.abs(dx) <= 1) {
      for (let dy = 1; dy <= 5; dy++) stamp(x + dx, y + dy, z + 15, B.RED_CRYSTAL);
    } else {
      wall(dx, 15);
    }
  }
}

/** Hub pequeño de los Altos del Vendaval: plaza, puesto y corriente. */
function buildCliffOutpost(stamp, x, y, z, rng, ground) {
  clearAir(stamp, x, y, z, 10, 12);
  for (let dx = -8; dx <= 8; dx++) {
    for (let dz = -8; dz <= 8; dz++) {
      if (Math.abs(dx) + Math.abs(dz) > 14) continue;
      fillFloor(stamp, ground, x, y, z, dx, dz, B.WINDSTONE);
    }
  }
  const hut = (ox, oz) => {
    for (let dx = -2; dx <= 2; dx++) {
      for (let dz = -2; dz <= 2; dz++) {
        fillFloor(stamp, ground, x, y, z, ox + dx, oz + dz, B.STONE);
        const edge = Math.abs(dx) === 2 || Math.abs(dz) === 2;
        if (edge && !(dx === 0 && dz === 2)) {
          for (let dy = 1; dy <= 3; dy++) stamp(x + ox + dx, y + dy, z + oz + dz, B.WOOD);
        }
        stamp(x + ox + dx, y + 4, z + oz + dz, B.LEAVES);
      }
    }
    stamp(x + ox, y + 1, z + oz + 2, B.AIR);
    stamp(x + ox, y + 2, z + oz + 2, B.AIR);
  };
  hut(-5, 2);
  hut(5, 1);
  hut(0, -5);
  stamp(x, y + 1, z, B.WOOD);
  stamp(x, y + 2, z, B.WIND_CRYSTAL);
  for (let dy = 1; dy <= 4; dy++) {
    stamp(x, y + dy, z + 6, B.AIR);
  }
  stamp(x, y + 1, z + 6, B.CRYSTAL);
  fillFloor(stamp, ground, x, y, z, 2, 5, B.STONE);
  stamp(x + 2, y + 1, z + 5, B.WOOD);
  stamp(x + 2, y + 2, z + 5, B.CRYSTAL);
  if (rng() < 0.9) stamp(x + 3, y + 1, z - 2, B.HERB);
  if (rng() < 0.7) stamp(x - 3, y + 1, z + 4, B.HERB);
}

/** Landmark + tutorial de wind lift (no es un santuario curativo). */
function buildWindShrine(stamp, x, y, z, rng, ground) {
  clearAir(stamp, x, y, z, 5, 14);
  for (let dx = -4; dx <= 4; dx++) {
    for (let dz = -4; dz <= 4; dz++) {
      fillFloor(stamp, ground, x, y, z, dx, dz, B.WINDSTONE);
    }
  }
  for (const [cx, cz] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) {
    for (let dy = 1; dy <= 5; dy++) stamp(x + cx, y + dy, z + cz, B.STONE);
    stamp(x + cx, y + 6, z + cz, B.CRYSTAL);
  }
  stamp(x, y + 1, z, B.CRYSTAL);
  stamp(x, y + 2, z, B.WIND_CRYSTAL);
  for (let dy = 1; dy <= 8; dy++) {
    if (dy !== 1 && dy !== 2) stamp(x, y + dy, z, B.AIR);
  }
  if (rng() < 0.8) stamp(x + 2, y + 1, z, B.HERB);
}

/**
 * Observatorio alto: lore, revelado de mapa, criatura rara y sello del Gym 4.
 * No es el Gimnasio 4.
 */
function buildStormObservatory(stamp, x, y, z, rng, ground) {
  clearAir(stamp, x, y, z, 8, 18);
  for (let dx = -6; dx <= 6; dx++) {
    for (let dz = -6; dz <= 6; dz++) {
      fillFloor(stamp, ground, x, y, z, dx, dz, B.WINDSTONE);
    }
  }
  for (let dy = 1; dy <= 12; dy++) {
    for (const [dx, dz] of [[-3, -3], [-3, 3], [3, -3], [3, 3]]) {
      stamp(x + dx, y + dy, z + dz, dy > 8 ? B.CRYSTAL : B.STONE);
    }
  }
  for (let dx = -4; dx <= 4; dx++) {
    for (let dz = -4; dz <= 4; dz++) {
      stamp(x + dx, y + 9, z + dz, B.WINDSTONE);
      if (Math.abs(dx) === 4 || Math.abs(dz) === 4) stamp(x + dx, y + 10, z + dz, B.STONE);
    }
  }
  stamp(x, y + 1, z, B.STONE);
  stamp(x, y + 2, z, B.WIND_CRYSTAL);
  stamp(x, y + 11, z, B.WOOD);
  stamp(x, y + 12, z, B.WIND_CRYSTAL);
  stamp(x, y + 13, z, B.CRYSTAL);
  stamp(x, y + 1, z - 4, B.CRYSTAL);
  if (rng() < 0.95) stamp(x + 2, y + 10, z, B.WIND_CRYSTAL);
  if (rng() < 0.8) stamp(x - 2, y + 1, z + 2, B.HERB);
}

/** Arena elevada del Guardián del Vendaval. */
function buildTempestSpire(stamp, x, y, z, rng, ground) {
  clearAir(stamp, x, y, z, 8, 16);
  for (let dx = -7; dx <= 7; dx++) {
    for (let dz = -7; dz <= 7; dz++) {
      if (dx * dx + dz * dz > 52) continue;
      fillFloor(stamp, ground, x, y, z, dx, dz, B.WINDSTONE);
    }
  }
  for (const [cx, cz] of [[-5, -5], [5, -5], [-5, 5], [5, 5], [0, -6], [0, 6]]) {
    for (let dy = 1; dy <= 6; dy++) stamp(x + cx, y + dy, z + cz, dy > 4 ? B.CRYSTAL : B.STONE);
    stamp(x + cx, y + 7, z + cz, B.WIND_CRYSTAL);
  }
  stamp(x, y + 1, z, B.CRYSTAL);
  stamp(x, y + 2, z, B.WIND_CRYSTAL);
  for (let dx = -2; dx <= 2; dx++) fillFloor(stamp, ground, x, y, z, dx, -7, B.WINDSTONE);
}

/**
 * Gimnasio semiabierto: plaza, terrazas, canales y terraza del líder.
 * El techo no cierra el cielo. Los lifts se registran en runtime.
 */
function buildGaleGym(stamp, x, y, z, rng, ground) {
  clearAir(stamp, x, y, z, 13, 22);

  for (let dx = -10; dx <= 10; dx++) {
    for (let dz = -12; dz <= 14; dz++) {
      fillFloor(stamp, ground, x, y, z, dx, dz, B.WINDSTONE);
    }
  }

  const col = (dx, dz, h = 8) => {
    for (let dy = 1; dy <= h; dy++) stamp(x + dx, y + dy, z + dz, dy > h - 2 ? B.CRYSTAL : B.STONE);
    stamp(x + dx, y + h + 1, z + dz, B.WIND_CRYSTAL);
  };
  for (const [cx, cz] of [[-9, -11], [9, -11], [-9, 13], [9, 13], [-9, 0], [9, 0]]) {
    col(cx, cz, 9);
  }

  // Pozo de recuperación (centro-sur de la plaza)
  for (let dx = -1; dx <= 1; dx++) {
    for (let dz = 7; dz <= 9; dz++) {
      stamp(x + dx, y, z + dz, B.STONE);
      for (let dy = 1; dy <= 4; dy++) stamp(x + dx, y + dy, z + dz, B.AIR);
    }
  }
  stamp(x, y + 1, z + 8, B.CRYSTAL);

  // Terraza este (media altura) — Orin / canal este
  for (let dx = 4; dx <= 8; dx++) {
    for (let dz = 1; dz <= 6; dz++) {
      stamp(x + dx, y + 6, z + dz, B.WINDSTONE);
    }
  }
  for (let dx = 4; dx <= 8; dx++) {
    stamp(x + dx, y + 7, z + 1, B.STONE);
    stamp(x + dx, y + 7, z + 6, B.STONE);
  }

  // Terraza oeste (alta) — canal oeste
  for (let dx = -8; dx <= -4; dx++) {
    for (let dz = 4; dz <= 8; dz++) {
      stamp(x + dx, y + 11, z + dz, B.WINDSTONE);
    }
  }

  // Terraza del líder (sur, más alta)
  for (let dx = -5; dx <= 5; dx++) {
    for (let dz = 10; dz <= 14; dz++) {
      stamp(x + dx, y + 16, z + dz, B.WINDSTONE);
    }
  }
  for (let dx = -5; dx <= 5; dx++) {
    if (dx === 0) {
      stamp(x, y + 17, z + 10, B.WIND_CRYSTAL);
      stamp(x, y + 18, z + 10, B.CRYSTAL);
      continue;
    }
    for (let dy = 17; dy <= 20; dy++) stamp(x + dx, y + dy, z + 10, B.STONE);
  }

  // Canales: norte (suelo), este (media), oeste (alta)
  stamp(x, y + 1, z - 4, B.CRYSTAL);
  stamp(x, y + 2, z - 4, B.STONE);
  stamp(x + 6, y + 7, z + 4, B.CRYSTAL);
  stamp(x + 6, y + 8, z + 4, B.STONE);
  stamp(x - 6, y + 12, z + 6, B.CRYSTAL);
  stamp(x - 6, y + 13, z + 6, B.STONE);

  // Puerta norte: cristales (se abren al tener gym_4_path)
  for (let dx = -1; dx <= 1; dx++) {
    fillFloor(stamp, ground, x, y, z, dx, -12, B.WINDSTONE);
    for (let dy = 1; dy <= 4; dy++) stamp(x + dx, y + dy, z - 12, B.CRYSTAL);
  }
  stamp(x - 2, y + 1, z - 12, B.STONE);
  stamp(x + 2, y + 1, z - 12, B.STONE);

  // Barrera oeste (hacia el pináculo) hasta que el path abra
  for (let dz = -4; dz <= 6; dz++) {
    for (let dy = 1; dy <= 5; dy++) stamp(x - 10, y + dy, z + dz, B.CRYSTAL);
  }

  // Perímetro este y sur: no se entra andando por detrás
  for (let dz = -11; dz <= 14; dz++) {
    for (let dy = 1; dy <= 5; dy++) stamp(x + 10, y + dy, z + dz, B.STONE);
  }
  for (let dx = -9; dx <= 9; dx++) {
    if (dx === 0) continue;
    for (let dy = 1; dy <= 5; dy++) stamp(x + dx, y + dy, z + 14, B.STONE);
  }

  stamp(x, y + 1, z - 8, B.WOOD);
  stamp(x, y + 2, z - 8, B.WIND_CRYSTAL);
  stamp(x, y + 17, z + 13, B.WIND_CRYSTAL);
  if (rng() < 0.8) stamp(x + 3, y + 1, z - 6, B.HERB);
}

/** Hook físico hacia Región 5: arco cerrado hasta la cuarta insignia. */
function buildHighlandExit(stamp, x, y, z, rng, ground) {
  clearAir(stamp, x, y, z, 6, 12);
  for (let dx = -4; dx <= 4; dx++) {
    for (let dz = -3; dz <= 5; dz++) {
      fillFloor(stamp, ground, x, y, z, dx, dz, B.WINDSTONE);
    }
  }
  for (let dx = -3; dx <= 3; dx++) {
    for (let dy = 1; dy <= 6; dy++) {
      if (Math.abs(dx) === 3) stamp(x + dx, y + dy, z, B.STONE);
    }
  }
  stamp(x - 3, y + 7, z, B.WIND_CRYSTAL);
  stamp(x + 3, y + 7, z, B.WIND_CRYSTAL);
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = 1; dy <= 5; dy++) stamp(x + dx, y + dy, z, B.CRYSTAL);
  }
  stamp(x, y + 1, z + 4, B.CRYSTAL);
}

function plat(stamp, ground, x, y, z, dx, dz, r, block) {
  for (let ox = -r; ox <= r; ox++) {
    for (let oz = -r; oz <= r; oz++) {
      fillFloor(stamp, ground, x, y, z, dx + ox, dz + oz, block);
    }
  }
}

function buildCoastalGate(stamp, x, y, z, rng, ground) {
  clearAir(stamp, x, y, z, 5, 10);
  plat(stamp, ground, x, y, z, 0, 0, 4, B.PACKED_SAND);
  stampRouteArch(stamp, ground, x, y, z, 0, 0, 1);
  stamp(x, y + 1, z + 2, B.WOOD);
  stamp(x, y + 2, z + 2, B.WOOD);
}

function buildAzurePort(stamp, x, y, z, rng, ground) {
  clearAir(stamp, x, y, z, 24, 12);
  const L = AZURE_PORT_LAYOUT;

  for (let dx = -16; dx <= 16; dx++) {
    for (let dz = -12; dz <= 18; dz++) {
      const d = Math.hypot(dx / 16, dz / 16);
      if (d > 1.05) continue;
      fillFloor(stamp, ground, x, y, z, dx, dz, B.PACKED_SAND);
    }
  }

  stampRoadSegment(stamp, ground, x, y, z, [0, -12], [0, 16], 3, B.PACKED_SAND);
  stampRoadSegment(stamp, ground, x, y, z, [-12, 0], [12, 0], 3, B.PACKED_SAND);
  stampRoadSegment(stamp, ground, x, y, z, L.clinic, L.plaza, 2, B.STONE);
  stampRoadSegment(stamp, ground, x, y, z, L.market, L.plaza, 2, B.STONE);
  stampRoadSegment(stamp, ground, x, y, z, L.plaza, L.dock, 3, B.PACKED_SAND);

  for (let dx = -3; dx <= 3; dx++) {
    for (let dz = -3; dz <= 3; dz++) {
      fillFloor(stamp, ground, x, y, z, dx, dz, B.STONE);
    }
  }
  stamp(x, y + 1, z, B.SAND);
  stamp(x, y + 2, z, B.CRYSTAL);
  stamp(x, y + 3, z, B.CRYSTAL);

  stampBuilding(stamp, ground, x, y, z, L.clinic[0], L.clinic[1], 3, {
    wall: B.STONE, roof: B.WOOD, floor: B.STONE, door: [1, 0], openRoof: true, wallH: 3,
  });
  stamp(x + L.pc[0], y + 1, z + L.pc[1], B.WOOD);
  stamp(x + L.pc[0], y + 2, z + L.pc[1], B.CRYSTAL);

  stampBuilding(stamp, ground, x, y, z, L.market[0], L.market[1], 3, {
    wall: B.WOOD, roof: B.LEAVES, floor: B.PACKED_SAND, door: [-1, 0], openRoof: true,
  });
  stamp(x + L.market[0], y + 1, z + L.market[1], B.WOOD);
  stamp(x + L.market[0] + 1, y + 1, z + L.market[1], B.WOOD);

  stampBuilding(stamp, ground, x, y, z, L.home_nav[0], L.home_nav[1], 2, {
    wall: B.WOOD, roof: B.WOOD, floor: B.STONE, door: [0, -1], openRoof: true,
  });
  stampBuilding(stamp, ground, x, y, z, L.home_net[0], L.home_net[1], 2, {
    wall: B.WOOD, roof: B.LEAVES, floor: B.STONE, door: [0, -1], openRoof: true,
  });
  stampBuilding(stamp, ground, x, y, z, L.warehouse[0], L.warehouse[1], 2, {
    wall: B.STONE, roof: B.WOOD, floor: B.STONE, door: [1, 0], openRoof: true,
  });

  stampBoardwalk(stamp, ground, x, y, z, [0, 12], [0, 22], 3);
  for (let dx = -4; dx <= 4; dx++) {
    fillFloor(stamp, ground, x, y, z, dx, 16, B.WOOD);
  }
  stampMooredBoat(stamp, x, y, z, 5, 20);
  stampMooredBoat(stamp, x, y, z, -6, 19);

  plat(stamp, ground, x, y, z, L.lookout[0], L.lookout[1], 2, B.STONE);
  for (let dy = 1; dy <= 4; dy++) stamp(x + L.lookout[0], y + dy, z + L.lookout[1], B.WOOD);
  stamp(x + L.lookout[0], y + 5, z + L.lookout[1], B.CRYSTAL);

  stamp(x + L.sign[0], y + 1, z + L.sign[1], B.WOOD);
  stamp(x + L.sign[0], y + 2, z + L.sign[1], B.WOOD);

  stampProps(stamp, x, y, z, [
    { kind: "lantern", dx: -4, dz: -4 },
    { kind: "lantern", dx: 4, dz: -4 },
    { kind: "lantern", dx: -4, dz: 4 },
    { kind: "lantern", dx: 4, dz: 4 },
    { kind: "bench", dx: 2, dz: -2 },
    { kind: "planter", dx: -3, dz: 2 },
    { kind: "planter", dx: 3, dz: 2 },
    { kind: "crate", dx: -13, dz: 13 },
    { kind: "crate", dx: -12, dz: 15 },
    { kind: "barrel", dx: 3, dz: 15 },
    { kind: "barrel", dx: 4, dz: 17 },
    { kind: "net", dx: -5, dz: 17 },
    { kind: "buoy", dx: 8, dz: 18 },
    { kind: "fence", dx: -8, dz: 10 },
    { kind: "fence", dx: 8, dz: 10 },
    { kind: "post", dx: -2, dz: 12 },
    { kind: "post", dx: 2, dz: 12 },
  ]);
}

function buildAzureBridge(stamp, x, y, z, rng, ground) {
  clearAir(stamp, x, y, z, 8, 8);
  for (let dz = -6; dz <= 6; dz++) {
    const curve = Math.round(Math.sin(dz * 0.45) * 2);
    for (let dx = -1; dx <= 1; dx++) {
      fillFloor(stamp, ground, x, y, z, dx + curve, dz, B.WOOD);
      stamp(x + dx + curve, y + 1, z + dz, B.WOOD);
    }
    if ((dz & 1) === 0) {
      stamp(x - 2 + curve, y + 1, z + dz, B.WOOD);
      stamp(x + 2 + curve, y + 1, z + dz, B.WOOD);
    }
  }
}

function buildTidalRuins(stamp, x, y, z, rng, ground) {
  clearAir(stamp, x, y, z, 12, 10);
  const L = TIDAL_RUINS_LAYOUT;
  plat(stamp, ground, x, y, z, 0, -8, 4, B.STONE);
  plat(stamp, ground, x, y, z, 0, -2, 4, B.STONE);
  plat(stamp, ground, x, y, z, -5, 4, 3, B.CORAL_ROCK);
  plat(stamp, ground, x, y, z, 5, 6, 3, B.STONE);

  for (let dx = -3; dx <= 3; dx++) {
    fillFloor(stamp, ground, x, y, z, dx, -10, B.STONE);
    const door = dx === 0;
    for (let dy = 1; dy <= 4; dy++) {
      if (door && dy <= 2) continue;
      stamp(x + dx, y + dy, z - 10, B.STONE);
    }
  }
  stamp(x, y + 5, z - 10, B.CRYSTAL);

  for (const [cx, cz] of [[-4, -2], [4, -2], [-4, 2], [4, 2]]) {
    fillFloor(stamp, ground, x, y, z, cx, cz, B.STONE);
    for (let dy = 1; dy <= 3 + Math.floor(rng() * 2); dy++) stamp(x + cx, y + dy, z + cz, B.STONE);
  }

  for (let dz = -8; dz <= 6; dz++) {
    fillFloor(stamp, ground, x, y, z, 0, dz, B.PACKED_SAND);
  }
  for (let dx = -4; dx <= 0; dx++) fillFloor(stamp, ground, x, y, z, dx, 4, B.PACKED_SAND);
  for (let dx = 0; dx <= 5; dx++) fillFloor(stamp, ground, x, y, z, dx, 5, B.PACKED_SAND);

  for (let dx = -2; dx <= 2; dx++) {
    for (let dz = 3; dz <= 5; dz++) {
      stamp(x + dx, y, z + dz, B.WATER);
      if (y > WATER_Y) stamp(x + dx, WATER_Y, z + dz, B.WATER);
    }
  }
  // Canal somero fijo en la cámara central (no depende de rng).
  for (let dx = -1; dx <= 1; dx++) {
    for (let dz = -1; dz <= 2; dz++) {
      stamp(x + dx, Math.min(y, WATER_Y), z + dz, B.WATER);
    }
  }
  stamp(x + L.pickup[0], y + 1, z + L.pickup[1], B.TIDAL_PEARL);
  stamp(x - 4, y + 1, z + 1, B.CORAL_ROCK);
}

function buildAzureLighthouse(stamp, x, y, z, rng, ground) {
  clearAir(stamp, x, y, z, 8, 18);
  plat(stamp, ground, x, y, z, 0, 0, 5, B.STONE);
  for (let dy = 1; dy <= 14; dy++) {
    const r = dy < 12 ? 2 : 1;
    for (let dx = -r; dx <= r; dx++) {
      for (let dz = -r; dz <= r; dz++) {
        const edge = Math.abs(dx) === r || Math.abs(dz) === r;
        if (!edge) continue;
        const door = dy <= 2 && dx === 0 && dz === -2;
        if (door) continue;
        stamp(x + dx, y + dy, z + dz, B.STONE);
      }
    }
    if (dy % 3 === 0) {
      stamp(x + 1, y + dy, z, B.WOOD);
      stamp(x, y + dy, z + 1, B.WOOD);
    }
  }
  plat(stamp, ground, x, y + 14, z, 0, 0, 2, B.STONE);
  stamp(x, y + 15, z, B.CRYSTAL);
  stamp(x, y + 16, z, B.CRYSTAL);
  stamp(x, y + 1, z - 3, B.WOOD);
}

function buildTideLookout(stamp, x, y, z, rng, ground) {
  clearAir(stamp, x, y, z, 4, 8);
  plat(stamp, ground, x, y, z, 0, 0, 3, B.STONE);
  for (let dy = 1; dy <= 5; dy++) stamp(x, y + dy, z, B.WOOD);
  stamp(x, y + 6, z, B.CRYSTAL);
  stamp(x + 1, y + 1, z, B.WOOD);
  stamp(x - 1, y + 1, z, B.WOOD);
}

function buildFishermanCamp(stamp, x, y, z, rng, ground) {
  buildCamp(stamp, x, y, z, rng, ground);
  stamp(x + 2, y + 1, z, B.WOOD);
  stamp(x + 2, y + 2, z, B.LEAVES);
}

function buildWeatheredShrine(stamp, x, y, z, rng, ground) {
  buildShrine(stamp, x, y, z, rng, ground);
  stamp(x, y + 1, z + 1, B.CORAL_ROCK);
}

function buildBrokenSpan(stamp, x, y, z, rng, ground) {
  clearAir(stamp, x, y, z, 5, 6);
  for (let dz = -4; dz <= 1; dz++) {
    fillFloor(stamp, ground, x, y, z, 0, dz, B.WOOD);
    stamp(x, y + 1, z + dz, B.WOOD);
  }
  for (let dz = 3; dz <= 4; dz++) {
    fillFloor(stamp, ground, x, y, z, 1, dz, B.WOOD);
  }
}

function coralCol(stamp, x, y, z, dx, dz, h, cap = B.CRYSTAL) {
  for (let dy = 1; dy <= h; dy++) {
    stamp(x + dx, y + dy, z + dz, dy > h - 2 ? B.CORAL_ROCK : B.STONE);
  }
  stamp(x + dx, y + h + 1, z + dz, cap);
}

function buildReefAtoll(stamp, x, y, z, rng, ground) {
  clearAir(stamp, x, y, z, 10, 12);
  for (let dx = -9; dx <= 9; dx++) {
    for (let dz = -9; dz <= 9; dz++) {
      const d = Math.hypot(dx, dz);
      if (d > 9.2) continue;
      const ring = d > 7.2;
      fillFloor(stamp, ground, x, y, z, dx, dz, ring ? B.CORAL_ROCK : B.PACKED_SAND);
      if (ring && d < 8.4) {
        stamp(x + dx, y, z + dz, B.SAND);
        stamp(x + dx, y + 1, z + dz, B.WATER);
      }
    }
  }
  plat(stamp, ground, x, y, z, 0, 0, 3, B.CORAL_ROCK);
  for (let dy = 1; dy <= 6; dy++) stamp(x, y + dy, z, B.CORAL_ROCK);
  stamp(x, y + 7, z, B.TIDAL_PEARL);
  stamp(x, y + 8, z, B.CRYSTAL);
  stamp(x + 1, y + 1, z, B.CORAL_ROCK);
  stamp(x - 1, y + 1, z, B.CORAL_ROCK);
  stamp(x, y + 1, z + 1, B.WOOD);
  stamp(x, y + 2, z + 1, B.CRYSTAL);
  for (const [ox, oz] of [[-6, -2], [6, -1], [-4, 5], [5, 4], [-7, 3], [7, -4]]) {
    stamp(x + ox, y + 1, z + oz, B.CORAL_ROCK);
    stamp(x + ox, y + 2, z + oz, rng() < 0.5 ? B.TIDAL_PEARL : B.CRYSTAL);
  }
  for (let a = 0; a < 8; a++) {
    const ox = Math.round(Math.cos(a * 0.785) * 8);
    const oz = Math.round(Math.sin(a * 0.785) * 8);
    stamp(x + ox, y + 1, z + oz, B.WOOD);
  }
}

function buildTidalBridge(stamp, x, y, z, rng, ground) {
  clearAir(stamp, x, y, z, 7, 8);
  for (let dz = -6; dz <= 6; dz++) {
    for (let dx = -1; dx <= 1; dx++) {
      fillFloor(stamp, ground, x, y, z, dx, dz, B.CORAL_ROCK);
      if (Math.abs(dz) % 3 === 0) stamp(x + dx, y + 1, z + dz, B.WOOD);
    }
  }
  for (let dx = -2; dx <= 2; dx++) {
    fillFloor(stamp, ground, x, y, z, dx, 0, B.PACKED_SAND);
  }
  // Hueco central cerrado con cristal hasta gym_5_path_unlocked.
  for (let dy = 1; dy <= 4; dy++) {
    stamp(x, y + dy, z, B.CRYSTAL);
    stamp(x - 1, y + dy, z, B.CRYSTAL);
    stamp(x + 1, y + dy, z, B.CRYSTAL);
  }
  stamp(x, y + 5, z, B.TIDAL_PEARL);
  coralCol(stamp, x, y, z, -5, -5, 5, B.CRYSTAL);
  coralCol(stamp, x, y, z, 5, 5, 5, B.WIND_CRYSTAL);
}

function buildTideGym(stamp, x, y, z, rng, ground) {
  clearAir(stamp, x, y, z, 14, 18);

  for (let dx = -12; dx <= 12; dx++) {
    for (let dz = -14; dz <= 14; dz++) {
      const d = Math.hypot(dx / 12, dz / 14);
      if (d > 1.08) continue;
      fillFloor(stamp, ground, x, y, z, dx, dz, B.CORAL_ROCK);
    }
  }
  for (let dx = -8; dx <= 8; dx++) {
    for (let dz = -10; dz <= 10; dz++) {
      fillFloor(stamp, ground, x, y, z, dx, dz, B.PACKED_SAND);
    }
  }

  // Silueta: pilares, anillos, cúpula.
  for (const [cx, cz] of [[-11, -12], [11, -12], [-11, 13], [11, 13], [-11, 0], [11, 0]]) {
    coralCol(stamp, x, y, z, cx, cz, 10, B.TIDAL_PEARL);
  }
  for (let a = 0; a < 12; a++) {
    const ox = Math.round(Math.cos(a * 0.523) * 9);
    const oz = Math.round(Math.sin(a * 0.523) * 9);
    stamp(x + ox, y + 8, z + oz, B.CORAL_ROCK);
    stamp(x + ox, y + 9, z + oz, a % 2 ? B.CRYSTAL : B.WIND_CRYSTAL);
  }
  for (let dx = -2; dx <= 2; dx++) {
    for (let dz = -2; dz <= 2; dz++) {
      if (Math.abs(dx) === 2 || Math.abs(dz) === 2) stamp(x + dx, y + 12, z + dz, B.CORAL_ROCK);
    }
  }
  stamp(x, y + 13, z, B.CRYSTAL);
  stamp(x, y + 14, z, B.TIDAL_PEARL);

  // Cascadas en la cara norte (visibles desde el faro).
  for (let dy = 4; dy >= 1; dy--) {
    stamp(x - 3, y + dy, z - 13, B.WATER);
    stamp(x + 3, y + dy, z - 13, B.WATER);
  }

  // Canales de agua (trinchera).
  const trench = (dx0, dz0, dx1, dz1) => {
    const steps = Math.max(Math.abs(dx1 - dx0), Math.abs(dz1 - dz0), 1);
    for (let i = 0; i <= steps; i++) {
      const tx = Math.round(dx0 + (dx1 - dx0) * (i / steps));
      const tz = Math.round(dz0 + (dz1 - dz0) * (i / steps));
      stamp(x + tx, y, z + tz, B.SAND);
      stamp(x + tx, y + 1, z + tz, B.WATER);
      stamp(x + tx, y + 2, z + tz, B.AIR);
    }
  };
  trench(-6, -3, -6, 8);
  trench(6, -3, 6, 8);
  trench(-5, 2, 5, 2);

  // Pasarelas de madera (siempre transitables hacia los controladores).
  for (let dx = -8; dx <= 8; dx++) {
    stamp(x + dx, y + 1, z - 6, B.WOOD);
  }
  for (let dz = -8; dz <= 8; dz++) {
    stamp(x - 8, y + 1, z + dz, B.WOOD);
    stamp(x + 8, y + 1, z + dz, B.WOOD);
  }

  // Controladores.
  stamp(x - 6, y + 1, z - 4, B.CRYSTAL);
  stamp(x - 6, y + 2, z - 4, B.STONE);
  stamp(x, y + 1, z - 2, B.CRYSTAL);
  stamp(x, y + 2, z - 2, B.STONE);
  stamp(x + 6, y + 1, z - 4, B.CRYSTAL);
  stamp(x + 6, y + 2, z - 4, B.STONE);

  // Pozo de recuperación.
  for (let dx = -1; dx <= 1; dx++) {
    for (let dz = 7; dz <= 9; dz++) {
      stamp(x + dx, y, z + dz, B.SAND);
      stamp(x + dx, y + 1, z + dz, B.WATER);
      for (let dy = 2; dy <= 4; dy++) stamp(x + dx, y + dy, z + dz, B.AIR);
    }
  }
  stamp(x, y + 1, z + 8, B.CRYSTAL);

  // Terraza del líder (sur, semiabierta).
  for (let dx = -5; dx <= 5; dx++) {
    for (let dz = 10; dz <= 14; dz++) {
      stamp(x + dx, y + 2, z + dz, B.CORAL_ROCK);
    }
  }
  for (let dx = -5; dx <= 5; dx++) {
    if (dx === 0) {
      stamp(x, y + 3, z + 10, B.CRYSTAL);
      stamp(x, y + 4, z + 10, B.CRYSTAL);
      continue;
    }
    for (let dy = 3; dy <= 5; dy++) stamp(x + dx, y + dy, z + 10, B.STONE);
  }
  stamp(x, y + 3, z + 13, B.TIDAL_PEARL);
  stamp(x, y + 4, z + 13, B.WIND_CRYSTAL);

  // Puerta norte (cristales hasta gym_5_path).
  for (let dx = -1; dx <= 1; dx++) {
    fillFloor(stamp, ground, x, y, z, dx, -13, B.PACKED_SAND);
    for (let dy = 1; dy <= 4; dy++) stamp(x + dx, y + dy, z - 13, B.CRYSTAL);
  }
  stamp(x - 2, y + 1, z - 13, B.STONE);
  stamp(x + 2, y + 1, z - 13, B.STONE);

  // Perímetro suave: no se entra andando por detrás.
  for (let dz = -12; dz <= 14; dz++) {
    for (let dy = 1; dy <= 4; dy++) {
      if (dz === -13) continue;
      stamp(x + 12, y + dy, z + dz, B.CORAL_ROCK);
      stamp(x - 12, y + dy, z + dz, B.CORAL_ROCK);
    }
  }
  for (let dx = -11; dx <= 11; dx++) {
    if (dx === 0) continue;
    for (let dy = 1; dy <= 4; dy++) stamp(x + dx, y + dy, z + 14, B.CORAL_ROCK);
  }

  stamp(x, y + 1, z - 9, B.WOOD);
  stamp(x, y + 2, z - 9, B.WIND_CRYSTAL);
  if (rng() < 0.8) stamp(x + 3, y + 1, z - 7, B.HERB);
}

function buildOpenSeaGate(stamp, x, y, z, rng, ground) {
  clearAir(stamp, x, y, z, 6, 12);
  plat(stamp, ground, x, y, z, 0, 0, 5, B.PACKED_SAND);
  for (let dx = -3; dx <= 3; dx++) {
    for (let dy = 1; dy <= 7; dy++) {
      if (Math.abs(dx) === 3) stamp(x + dx, y + dy, z, B.CORAL_ROCK);
    }
  }
  stamp(x - 3, y + 8, z, B.TIDAL_PEARL);
  stamp(x + 3, y + 8, z, B.TIDAL_PEARL);
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = 1; dy <= 6; dy++) stamp(x + dx, y + dy, z, B.CRYSTAL);
  }
  stamp(x, y + 1, z + 4, B.WOOD);
  stamp(x, y + 2, z + 4, B.CRYSTAL);
}

export function isWildSpawnBlocked(world, x, z) {
  if (!world?.structures) return false;
  for (const s of world.structures.near(x, z, 28)) {
    const def = STRUCTURE_TYPES[s.type];
    if (!def?.safeZone) continue;
    const r = def.safeRadius ?? def.radius;
    if (Math.hypot(s.x - x, s.z - z) <= r) return true;
  }
  return false;
}

// ---------- Índice determinista por celdas ----------

export class StructureIndex {
  constructor(world) {
    this.world = world;
    this.cache = new Map(); // "type:cellX,cellZ" -> candidato | null
  }

  /** Candidato (o null) de un tipo en una celda concreta. Cacheado. */
  candidate(type, cellX, cellZ) {
    // Check before the cache: a secondary procedural gym must never supply
    // campaign structures, even if queried before attach/ensureHome.
    if (REGIONAL_TYPES.has(type)) {
      const home = regions.homeGym() || regions.ensureHome();
      if (!home || cellX !== home.cellX || cellZ !== home.cellZ) return null;
    }
    const key = `${type}:${cellX},${cellZ}`;
    if (this.cache.has(key)) return this.cache.get(key);

    const def = STRUCTURE_TYPES[type];
    if (!def) {
      this.cache.set(key, null);
      return null;
    }
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
   * Contenido de campaña: solo en la celda del gimnasio de origen guardado.
   * Los gimnasios procedurales secundarios no crean copias regionales.
   */
  regionalCandidate(type, cellX, cellZ) {
    const home = regions.homeGym() || regions.ensureHome();
    if (!home || cellX !== home.cellX || cellZ !== home.cellZ) return null;
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
    } else if (type === "mist_settlement") {
      x = gym.x + g.settlement.dx;
      z = gym.z + g.settlement.dz;
    } else if (type === "gym_mist") {
      x = gym.x + g.gymMist.dx;
      z = gym.z + g.gymMist.dz;
    } else if (type === "mining_camp") {
      x = gym.x + g.miningCamp.dx;
      z = gym.z + g.miningCamp.dz;
    } else if (type === "crimson_ruin") {
      x = gym.x + g.crimsonRuin.dx;
      z = gym.z + g.crimsonRuin.dz;
    } else if (type === "gym_crimson") {
      x = gym.x + g.gymCrimson.dx;
      z = gym.z + g.gymCrimson.dz;
    } else if (type === "cliff_outpost") {
      x = gym.x + g.cliffOutpost.dx;
      z = gym.z + g.cliffOutpost.dz;
    } else if (type === "wind_shrine") {
      x = gym.x + g.windShrine.dx;
      z = gym.z + g.windShrine.dz;
    } else if (type === "storm_observatory") {
      x = gym.x + g.stormObservatory.dx;
      z = gym.z + g.stormObservatory.dz;
    } else if (type === "tempest_spire") {
      x = gym.x + g.tempestSpire.dx;
      z = gym.z + g.tempestSpire.dz;
    } else if (type === "gym_gale") {
      x = gym.x + g.gymGale.dx;
      z = gym.z + g.gymGale.dz;
    } else if (type === "highland_exit") {
      x = gym.x + g.highlandExit.dx;
      z = gym.z + g.highlandExit.dz;
    } else if (type === "coastal_gate") {
      x = gym.x + g.coastalGate.dx;
      z = gym.z + g.coastalGate.dz;
    } else if (type === "azure_port") {
      x = gym.x + g.azurePort.dx;
      z = gym.z + g.azurePort.dz;
    } else if (type === "azure_bridge") {
      x = gym.x + g.azureBridge.dx;
      z = gym.z + g.azureBridge.dz;
    } else if (type === "tidal_ruins") {
      x = gym.x + g.tidalRuins.dx;
      z = gym.z + g.tidalRuins.dz;
    } else if (type === "azure_lighthouse") {
      x = gym.x + g.azureLighthouse.dx;
      z = gym.z + g.azureLighthouse.dz;
    } else if (type === "tide_lookout") {
      x = gym.x + g.tideLookout.dx;
      z = gym.z + g.tideLookout.dz;
    } else if (type === "fisherman_camp") {
      x = gym.x + g.fishermanCamp.dx;
      z = gym.z + g.fishermanCamp.dz;
    } else if (type === "weathered_shrine") {
      x = gym.x + g.weatheredShrine.dx;
      z = gym.z + g.weatheredShrine.dz;
    } else if (type === "broken_span") {
      x = gym.x + g.brokenSpan.dx;
      z = gym.z + g.brokenSpan.dz;
    } else if (type === "reef_atoll") {
      x = gym.x + g.reefAtoll.dx;
      z = gym.z + g.reefAtoll.dz;
    } else if (type === "tidal_bridge") {
      x = gym.x + g.tidalBridge.dx;
      z = gym.z + g.tidalBridge.dz;
    } else if (type === "gym_tide") {
      x = gym.x + g.gymTide.dx;
      z = gym.z + g.gymTide.dz;
    } else if (type === "open_sea_gate") {
      x = gym.x + g.openSeaGate.dx;
      z = gym.z + g.openSeaGate.dz;
    }
    const t = this.world.terrainAt(x, z);
    let y = Math.max(t.h, WATER_Y + 1);
    if (type === "cliff_outpost" || type === "wind_shrine" || type === "storm_observatory" ||
        type === "tempest_spire" || type === "gym_gale" || type === "highland_exit") {
      y = Math.min(60, y + this.world.region4BonusAt(x, z));
    }
    if (AZURE_TYPES.has(type) && this.world.region5HeightAt) {
      y = Math.max(WATER_Y + 1, this.world.region5HeightAt(x, z, t.h));
    }
    return {
      id: `${type}:${cellX},${cellZ}`,
      type,
      name: def.name,
      icon: def.icon,
      cellX,
      cellZ,
      x,
      y,
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
      if (REGIONAL_TYPES.has(type)) {
        const home = regions.homeGym() || regions.ensureHome();
        const s = home && this.candidate(type, home.cellX, home.cellZ);
        if (s && s.x + r >= xMin && s.x - r <= xMax && s.z + r >= zMin && s.z - r <= zMax) out.push(s);
        continue;
      }
      // Tipos procedurales clásicos: solo las celdas que intersectan.
      const pad = 0;
      const c0x = Math.floor((xMin - r) / def.cell) - pad;
      const c1x = Math.floor((xMax + r) / def.cell) + pad;
      const c0z = Math.floor((zMin - r) / def.cell) - pad;
      const c1z = Math.floor((zMax + r) / def.cell) + pad;
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

  /** Huella protegida (Gym 4, pináculo, arco, observatorio): minería/colocación mínima. */
  protectedAt(x, z) {
    for (const s of this.near(x, z, 16)) {
      if (!PROTECTED_STRUCTURE_TYPES.has(s.type)) continue;
      const r = STRUCTURE_TYPES[s.type]?.radius ?? 8;
      if (Math.hypot(s.x - x, s.z - z) <= r) return s;
    }
    return null;
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
