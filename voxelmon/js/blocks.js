/**
 * Catálogo de bloques: ids, nombres, drops y colores de vértice.
 * Vive en su propio módulo para que biomes/resources/structures puedan
 * importarlo sin crear ciclos con world.js (que lo reexporta).
 */

export const B = {
  AIR: 0,
  GRASS: 1,
  DIRT: 2,
  STONE: 3,
  SAND: 4,
  WATER: 5,
  WOOD: 6,
  LEAVES: 7,
  SNOW: 8,
  BEDROCK: 9,
  // Recursos especiales (Fase 2 — Mundo vivo)
  COAL_ORE: 10,
  COPPER_ORE: 11,
  IRON_ORE: 12,
  CRYSTAL: 13,
  APRICORN: 14,
  HERB: 15,
  // Recursos regionales (Fase 6 — Tierras Brumosas)
  ANCIENT_FRAGMENT: 16,
  MIST_BLOOM: 17,
  // Superficie visual del bosque brumoso (no es recurso)
  MIST_GRASS: 18,
  // Objetos crafteados (Fase 7 — no se generan en el mundo)
  MIST_TONIC: 19,
  EXPLORER_KIT: 20,
  ANCIENT_CORE: 21,
};

export const BLOCK_NAMES = {
  [B.GRASS]: "Hierba",
  [B.DIRT]: "Tierra",
  [B.STONE]: "Piedra",
  [B.SAND]: "Arena",
  [B.WOOD]: "Madera",
  [B.LEAVES]: "Hojas",
  [B.SNOW]: "Nieve",
  [B.COAL_ORE]: "Mena de carbón",
  [B.COPPER_ORE]: "Mena de cobre",
  [B.IRON_ORE]: "Mena de hierro",
  [B.CRYSTAL]: "Cristal luminoso",
  [B.APRICORN]: "Apricorno",
  [B.HERB]: "Hierba medicinal",
  [B.ANCIENT_FRAGMENT]: "Fragmento antiguo",
  [B.MIST_BLOOM]: "Flor de bruma",
  [B.MIST_GRASS]: "Musgo brumoso",
  [B.MIST_TONIC]: "Tónico de bruma",
  [B.EXPLORER_KIT]: "Kit de exploración",
  [B.ANCIENT_CORE]: "Núcleo antiguo",
};

/** Qué suelta cada bloque al minarlo */
export const BLOCK_DROPS = {
  [B.GRASS]: B.DIRT,
  [B.DIRT]: B.DIRT,
  [B.STONE]: B.STONE,
  [B.SAND]: B.SAND,
  [B.WOOD]: B.WOOD,
  [B.LEAVES]: B.LEAVES,
  [B.SNOW]: B.SNOW,
  // Los recursos sueltan su propio bloque; el mapeo a recurso lo hace resources.js
  [B.COAL_ORE]: B.COAL_ORE,
  [B.COPPER_ORE]: B.COPPER_ORE,
  [B.IRON_ORE]: B.IRON_ORE,
  [B.CRYSTAL]: B.CRYSTAL,
  [B.APRICORN]: B.APRICORN,
  [B.HERB]: B.HERB,
  [B.ANCIENT_FRAGMENT]: B.ANCIENT_FRAGMENT,
  [B.MIST_BLOOM]: B.MIST_BLOOM,
  [B.MIST_GRASS]: B.DIRT,
  [B.MIST_TONIC]: B.MIST_TONIC,
  [B.EXPLORER_KIT]: B.EXPLORER_KIT,
  [B.ANCIENT_CORE]: B.ANCIENT_CORE,
};

/** Colores por cara (top/side/bottom) para el meshing con vertex colors */
export const COLORS = {
  [B.GRASS]: { top: [0.42, 0.72, 0.29], side: [0.48, 0.4, 0.25], bottom: [0.48, 0.37, 0.23] },
  [B.DIRT]: { top: [0.54, 0.4, 0.26], side: [0.54, 0.4, 0.26], bottom: [0.5, 0.37, 0.24] },
  [B.STONE]: { top: [0.56, 0.56, 0.59], side: [0.55, 0.55, 0.58], bottom: [0.5, 0.5, 0.53] },
  [B.SAND]: { top: [0.89, 0.82, 0.58], side: [0.86, 0.79, 0.55], bottom: [0.82, 0.75, 0.52] },
  [B.WATER]: { top: [0.25, 0.46, 0.9], side: [0.23, 0.43, 0.85], bottom: [0.2, 0.4, 0.8] },
  [B.WOOD]: { top: [0.62, 0.47, 0.26], side: [0.49, 0.35, 0.19], bottom: [0.62, 0.47, 0.26] },
  [B.LEAVES]: { top: [0.28, 0.63, 0.24], side: [0.26, 0.58, 0.22], bottom: [0.22, 0.5, 0.19] },
  [B.SNOW]: { top: [0.93, 0.95, 0.97], side: [0.88, 0.91, 0.94], bottom: [0.82, 0.85, 0.9] },
  [B.BEDROCK]: { top: [0.22, 0.22, 0.24], side: [0.22, 0.22, 0.24], bottom: [0.22, 0.22, 0.24] },
  [B.COAL_ORE]: { top: [0.3, 0.3, 0.33], side: [0.27, 0.27, 0.3], bottom: [0.24, 0.24, 0.27] },
  [B.COPPER_ORE]: { top: [0.75, 0.48, 0.3], side: [0.68, 0.42, 0.27], bottom: [0.6, 0.38, 0.25] },
  [B.IRON_ORE]: { top: [0.8, 0.72, 0.62], side: [0.74, 0.66, 0.56], bottom: [0.66, 0.6, 0.52] },
  [B.CRYSTAL]: { top: [0.62, 0.9, 0.98], side: [0.5, 0.82, 0.94], bottom: [0.42, 0.72, 0.86] },
  [B.APRICORN]: { top: [0.44, 0.66, 0.28], side: [0.85, 0.52, 0.22], bottom: [0.6, 0.4, 0.2] },
  [B.HERB]: { top: [0.62, 0.85, 0.35], side: [0.5, 0.76, 0.32], bottom: [0.38, 0.6, 0.28] },
  [B.ANCIENT_FRAGMENT]: { top: [0.72, 0.58, 0.86], side: [0.52, 0.4, 0.64], bottom: [0.38, 0.3, 0.48] },
  [B.MIST_BLOOM]: { top: [0.72, 0.88, 0.92], side: [0.42, 0.62, 0.7], bottom: [0.28, 0.42, 0.48] },
  [B.MIST_GRASS]: { top: [0.22, 0.38, 0.32], side: [0.32, 0.28, 0.22], bottom: [0.28, 0.22, 0.18] },
  [B.MIST_TONIC]: { top: [0.45, 0.82, 0.78], side: [0.28, 0.55, 0.58], bottom: [0.22, 0.4, 0.44] },
  [B.EXPLORER_KIT]: { top: [0.7, 0.58, 0.32], side: [0.38, 0.32, 0.24], bottom: [0.28, 0.24, 0.18] },
  [B.ANCIENT_CORE]: { top: [0.82, 0.55, 0.95], side: [0.48, 0.28, 0.62], bottom: [0.32, 0.18, 0.42] },
};
