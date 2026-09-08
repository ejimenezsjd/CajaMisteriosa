/**
 * Recursos especiales del mundo (Fase 2). Cada recurso existe con una función
 * futura planificada (economía/crafting de fases posteriores):
 *
 *   iron           → herramientas y componentes de captura
 *   copper         → crafting tecnológico futuro
 *   coal           → combustible / antorchas
 *   apricorn       → fabricación de Cubos de captura
 *   medicinal_herb → pociones curativas
 *   crystal_shard  → objetos avanzados / evolución / especiales
 *
 * Todos son bloques vóxel: se generan proceduralmente por bioma (ver las
 * reglas `resources` de biomes.js), se minan con la mecánica existente y se
 * acumulan en state.inventory (clave = id de bloque), por lo que persisten
 * sin cambios de esquema del save.
 *
 * `depth` controla dónde puede aparecer la veta dentro de la columna:
 *   - minY: altura absoluta mínima
 *   - belowSurface: la veta queda como mucho a (h - belowSurface)
 *   - maxY: tope absoluto opcional (p. ej. cristales solo en profundidad)
 * Los recursos `surface: true` brotan sobre el bloque de hierba superficial.
 */

import { B } from "./blocks.js";

export const RESOURCES = {
  coal: {
    id: "coal",
    name: "Carbón",
    icon: "⚫",
    block: B.COAL_ORE,
    rarity: "común",
    depth: { minY: 6, belowSurface: 4 },
    futureUse: "combustible y antorchas",
  },
  copper: {
    id: "copper",
    name: "Cobre",
    icon: "🟠",
    block: B.COPPER_ORE,
    rarity: "común",
    depth: { minY: 4, belowSurface: 6 },
    futureUse: "crafting tecnológico",
  },
  iron: {
    id: "iron",
    name: "Hierro",
    icon: "⛓",
    block: B.IRON_ORE,
    rarity: "media",
    depth: { minY: 2, belowSurface: 8 },
    futureUse: "herramientas y componentes de captura",
  },
  crystal_shard: {
    id: "crystal_shard",
    name: "Fragmento de cristal",
    icon: "💎",
    block: B.CRYSTAL,
    rarity: "rara",
    depth: { minY: 2, maxY: 8, belowSurface: 6 },
    futureUse: "objetos avanzados y evolución",
  },
  apricorn: {
    id: "apricorn",
    name: "Apricorno",
    icon: "🍊",
    block: B.APRICORN,
    rarity: "poco común",
    surface: true,
    futureUse: "fabricar Cubos de captura",
  },
  medicinal_herb: {
    id: "medicinal_herb",
    name: "Hierba medicinal",
    icon: "🌿",
    block: B.HERB,
    rarity: "común",
    surface: true,
    futureUse: "pociones curativas",
  },
  ancient_fragment: {
    id: "ancient_fragment",
    name: "Fragmento antiguo",
    icon: "🟣",
    block: B.ANCIENT_FRAGMENT,
    rarity: "rara",
    depth: { minY: 2, maxY: 10, belowSurface: 5 },
    futureUse: "crafting avanzado, llave de ruinas y evoluciones especiales",
  },
  mist_bloom: {
    id: "mist_bloom",
    name: "Flor de bruma",
    icon: "💠",
    block: B.MIST_BLOOM,
    rarity: "poco común",
    surface: true,
    futureUse: "medicina avanzada y consumibles",
  },
  mist_tonic: {
    id: "mist_tonic",
    name: "Tónico de bruma",
    icon: "🧪",
    block: B.MIST_TONIC,
    rarity: "poco común",
    crafted: true,
    futureUse: "cura portátil del equipo (40% PV)",
  },
  explorer_kit: {
    id: "explorer_kit",
    name: "Kit de exploración",
    icon: "🔦",
    block: B.EXPLORER_KIT,
    rarity: "poco común",
    crafted: true,
    futureUse: "aclara la niebla y señala estructuras cercanas",
  },
  ancient_core: {
    id: "ancient_core",
    name: "Núcleo antiguo",
    icon: "🔮",
    block: B.ANCIENT_CORE,
    rarity: "rara",
    crafted: true,
    futureUse: "activar el sendero hacia el segundo gimnasio",
  },
  ember_ore: {
    id: "ember_ore",
    name: "Mena de ascuas",
    icon: "🔶",
    block: B.EMBER_ORE,
    rarity: "rara",
    depth: { minY: 6, maxY: 28, belowSurface: 5 },
    futureUse: "mejora de equipo y crafting de calor (Fase 10)",
  },
  red_crystal: {
    id: "red_crystal",
    name: "Cristal rojo",
    icon: "♦️",
    block: B.RED_CRYSTAL,
    rarity: "muy rara",
    surface: true,
    futureUse: "quest del tercer arco, evolución y sello del gimnasio 3",
  },
  crimson_resonator: {
    id: "crimson_resonator",
    name: "Resonador carmesí",
    icon: "🔶",
    block: B.CRIMSON_RESONATOR,
    rarity: "rara",
    crafted: true,
    futureUse: "activar el sello de la Ruina Carmesí y despertar al guardián",
  },
};

const BY_BLOCK = Object.fromEntries(
  Object.values(RESOURCES).map((r) => [r.block, r])
);

/** Definición de recurso asociada a un bloque, o null si es un bloque normal */
export function resourceForBlock(blockId) {
  return BY_BLOCK[blockId] ?? null;
}
