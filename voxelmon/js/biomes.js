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

  crimson_highlands: {
    id: "crimson_highlands",
    name: "Altiplano Carmesí",
    climate: { temperature: 0.88, humidity: 0.18 },
    terrain: { surfaceBlock: B.CRIMSON_STONE, subsurfaceBlock: B.STONE },
    vegetation: { treeDensity: 0.006 },
    difficulty: 3,
    creatures: [
      { family: "emberin", weight: 4, time: "day", regions: ["region_3"] },
      { family: "piedrita", weight: 4, time: "any", regions: ["region_3"] },
      { family: "lucier", weight: 3, time: "day", regions: ["region_3"] },
      { family: "umbra", weight: 1, time: "night", regions: ["region_3"] },
    ],
    resources: [
      { id: "ember_ore", chance: 0.042 },
      { id: "red_crystal", chance: 0.007 },
      { id: "coal", chance: 0.06 },
      { id: "iron", chance: 0.04 },
      { id: "copper", chance: 0.03 },
      { id: "medicinal_herb", chance: 0.004 },
      { id: "crystal_shard", chance: 0.005 },
    ],
    structures: ["mining_camp", "crimson_ruin", "gym_crimson", "healing_shrine"],
    ambience: { heat: true },
  },

  wind_highlands: {
    id: "wind_highlands",
    name: "Altos del Vendaval",
    climate: { temperature: 0.28, humidity: 0.35 },
    terrain: { surfaceBlock: B.WINDSTONE, subsurfaceBlock: B.STONE },
    vegetation: { treeDensity: 0.018 },
    difficulty: 4,
    creatures: [
      { family: "brisin", weight: 5, time: "any", regions: ["region_4"] },
      { family: "plumin", weight: 3, time: "day", regions: ["region_4"] },
      { family: "chispin", weight: 3, time: "any", regions: ["region_4"] },
      { family: "lucier", weight: 2, time: "day", regions: ["region_4"] },
      { family: "umbra", weight: 1, time: "night", regions: ["region_4"] },
      { family: "cirrith", weight: 1, time: "any", regions: ["region_4"], minHeight: 36 },
    ],
    resources: [
      { id: "sky_herb", chance: 0.016 },
      { id: "wind_crystal", chance: 0.006 },
      { id: "coal", chance: 0.05 },
      { id: "iron", chance: 0.035 },
      { id: "copper", chance: 0.03 },
      { id: "crystal_shard", chance: 0.008 },
    ],
    structures: ["cliff_outpost", "wind_shrine", "storm_observatory", "healing_shrine"],
    ambience: { wind: true, fogFar: true },
  },

  azure_archipelago: {
    id: "azure_archipelago",
    name: "Archipiélago Azur",
    climate: { temperature: 0.68, humidity: 0.85 },
    terrain: { surfaceBlock: B.SAND, subsurfaceBlock: B.SAND },
    vegetation: { treeDensity: 0.012 },
    difficulty: 5,
    creatures: [
      { family: "riflin", weight: 5, time: "any", regions: ["region_5"] },
      { family: "gotita", weight: 2, time: "any", regions: ["region_5"] },
      { family: "plumin", weight: 2, time: "day", regions: ["region_5"] },
      { family: "lucier", weight: 2, time: "day", regions: ["region_5"] },
      { family: "umbra", weight: 2, time: "night", regions: ["region_5"] },
      { family: "fosmar", weight: 1, time: "night", regions: ["region_5"] },
    ],
    resources: [
      { id: "coral_fragment", chance: 0.014 },
      { id: "tidal_pearl", chance: 0.003 },
      { id: "medicinal_herb", chance: 0.006 },
      { id: "copper", chance: 0.025 },
      { id: "iron", chance: 0.02 },
      { id: "coal", chance: 0.03 },
    ],
    structures: ["azure_port", "tidal_ruins", "azure_lighthouse", "gym_tide", "reef_atoll", "healing_shrine"],
    ambience: { coast: true },
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
