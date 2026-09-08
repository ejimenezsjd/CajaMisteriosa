/**
 * Definición central data-driven de biomas.
 *
 * Separación de responsabilidades:
 *   world.js  → determina QUÉ bioma existe en unas coordenadas (biomeAt)
 *   biomes.js → define QUÉ SIGNIFICA ese bioma para el gameplay
 *
 * Cada definición reúne clima, terreno, vegetación, reglas de spawn de
 * criaturas, recursos especiales, estructuras permitidas y dificultad.
 * Los sistemas (generación, spawner, estructuras, UI) consultan esta
 * fuente común en lugar de repartir if/else por el código.
 *
 * Reglas de criaturas: { family, weight, time }
 *   - family: id de la etapa 1 (el spawner decide etapa/nivel por distancia)
 *   - time: "day" | "night" | "any" (se pondera con el dayFactor actual)
 *
 * Reglas de recursos: { id, chance }
 *   - id: clave de RESOURCES (resources.js)
 *   - chance: probabilidad por columna (hash determinista por semilla)
 */

import { B } from "./blocks.js";

export const BIOMES = {
  plains: {
    id: "plains",
    name: "Llanuras",
    climate: { temperature: 0.6, humidity: 0.5 },
    terrain: { surfaceBlock: B.GRASS, subsurfaceBlock: B.DIRT },
    vegetation: { treeDensity: 0.02 },
    difficulty: 1,
    creatures: [
      { family: "chispin", weight: 3, time: "day" },
      { family: "plumin", weight: 2, time: "day" },
      { family: "lucier", weight: 2, time: "day" },
      { family: "semilla", weight: 1, time: "any" },
      { family: "umbra", weight: 3, time: "night" },
    ],
    resources: [
      { id: "medicinal_herb", chance: 0.009 },
      { id: "apricorn", chance: 0.004 },
      { id: "coal", chance: 0.05 },
      { id: "copper", chance: 0.04 },
      { id: "iron", chance: 0.02 },
    ],
    structures: ["camp", "healing_shrine", "settlement", "gym"],
    ambience: {},
  },

  forest: {
    id: "forest",
    name: "Bosque",
    climate: { temperature: 0.55, humidity: 0.8 },
    terrain: { surfaceBlock: B.GRASS, subsurfaceBlock: B.DIRT },
    vegetation: { treeDensity: 0.08 },
    difficulty: 1,
    creatures: [
      { family: "semilla", weight: 4, time: "any" },
      { family: "plumin", weight: 2, time: "day" },
      { family: "lucier", weight: 1, time: "day" },
      { family: "umbra", weight: 3, time: "night" },
    ],
    resources: [
      { id: "apricorn", chance: 0.011 },
      { id: "medicinal_herb", chance: 0.005 },
      { id: "coal", chance: 0.05 },
      { id: "copper", chance: 0.035 },
      { id: "iron", chance: 0.02 },
    ],
    structures: ["camp", "ruin", "healing_shrine", "settlement", "gym"],
    ambience: {},
  },

  desert: {
    id: "desert",
    name: "Desierto",
    climate: { temperature: 0.95, humidity: 0.1 },
    terrain: { surfaceBlock: B.SAND, subsurfaceBlock: B.SAND },
    vegetation: { treeDensity: 0 },
    difficulty: 2,
    creatures: [
      { family: "piedrita", weight: 3, time: "any" },
      { family: "emberin", weight: 3, time: "day" },
      { family: "umbra", weight: 2, time: "night" },
    ],
    resources: [
      { id: "coal", chance: 0.04 },
      { id: "copper", chance: 0.05 },
      { id: "iron", chance: 0.025 },
      { id: "crystal_shard", chance: 0.004 },
    ],
    structures: ["ruin"],
    ambience: {},
  },

  mountain: {
    id: "mountain",
    name: "Montaña",
    climate: { temperature: 0.35, humidity: 0.4 },
    terrain: { surfaceBlock: B.STONE, subsurfaceBlock: B.STONE },
    vegetation: { treeDensity: 0.01 },
    difficulty: 2,
    creatures: [
      { family: "piedrita", weight: 4, time: "any" },
      { family: "emberin", weight: 2, time: "day" },
      { family: "plumin", weight: 2, time: "day" },
      { family: "umbra", weight: 2, time: "night" },
    ],
    resources: [
      { id: "coal", chance: 0.07 },
      { id: "iron", chance: 0.05 },
      { id: "copper", chance: 0.04 },
      { id: "crystal_shard", chance: 0.008 },
    ],
    structures: ["ruin", "healing_shrine"],
    ambience: {},
  },

  snow: {
    id: "snow",
    name: "Cumbres nevadas",
    climate: { temperature: 0.05, humidity: 0.5 },
    terrain: { surfaceBlock: B.SNOW, subsurfaceBlock: B.STONE },
    vegetation: { treeDensity: 0.005 },
    difficulty: 3,
    creatures: [
      { family: "gotita", weight: 3, time: "any" },
      { family: "lucier", weight: 2, time: "day" },
      { family: "piedrita", weight: 1, time: "any" },
      { family: "umbra", weight: 2, time: "night" },
    ],
    resources: [
      { id: "coal", chance: 0.05 },
      { id: "iron", chance: 0.04 },
      { id: "crystal_shard", chance: 0.012 },
    ],
    structures: ["healing_shrine"],
    ambience: {},
  },

  beach: {
    id: "beach",
    name: "Playa",
    climate: { temperature: 0.7, humidity: 0.7 },
    terrain: { surfaceBlock: B.SAND, subsurfaceBlock: B.SAND },
    vegetation: { treeDensity: 0 },
    difficulty: 1,
    creatures: [
      { family: "gotita", weight: 4, time: "any" },
      { family: "plumin", weight: 2, time: "day" },
      { family: "umbra", weight: 1, time: "night" },
    ],
    resources: [
      { id: "copper", chance: 0.02 },
    ],
    structures: [],
    ambience: {},
  },

  mist_forest: {
    id: "mist_forest",
    name: "Bosque Brumoso",
    climate: { temperature: 0.45, humidity: 0.9 },
    terrain: { surfaceBlock: B.GRASS, subsurfaceBlock: B.DIRT },
    vegetation: { treeDensity: 0.14 },
    difficulty: 2,
    creatures: [
      { family: "umbra", weight: 5, time: "any", regions: ["region_2"] },
      { family: "semilla", weight: 4, time: "any", regions: ["region_2"] },
      { family: "lucier", weight: 2, time: "day", regions: ["region_2"] },
      { family: "gotita", weight: 2, time: "any", regions: ["region_2"] },
      { family: "plumin", weight: 1, time: "day", regions: ["region_2"] },
    ],
    resources: [
      { id: "mist_bloom", chance: 0.018 },
      { id: "ancient_fragment", chance: 0.01 },
      { id: "medicinal_herb", chance: 0.008 },
      { id: "apricorn", chance: 0.004 },
      { id: "coal", chance: 0.05 },
      { id: "iron", chance: 0.03 },
      { id: "copper", chance: 0.03 },
      { id: "crystal_shard", chance: 0.006 },
    ],
    structures: ["watchtower", "ancient_outpost", "mist_settlement", "gym_mist", "healing_shrine", "ruin"],
    ambience: { fog: true },
  },

  ocean: {
    id: "ocean",
    name: "Océano",
    climate: { temperature: 0.5, humidity: 1 },
    terrain: { surfaceBlock: B.SAND, subsurfaceBlock: B.STONE },
    vegetation: { treeDensity: 0 },
    difficulty: 2,
    // El spawner nunca coloca criaturas bajo el nivel del agua, así que estas
    // reglas solo actúan en islotes clasificados como océano.
    creatures: [
      { family: "gotita", weight: 1, time: "any" },
    ],
    resources: [],
    structures: [],
    ambience: {},
  },
};

/** Nombres visibles (id → nombre). Derivado de las definiciones. */
export const BIOME_NAMES = Object.fromEntries(
  Object.values(BIOMES).map((b) => [b.id, b.name])
);

export function getBiomeDefinition(id) {
  return BIOMES[id] ?? BIOMES.plains;
}

export function getBiomeName(id) {
  return BIOME_NAMES[id] ?? id;
}
