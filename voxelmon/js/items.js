/**
 * Definiciones de objetos + wrappers de mutación (Fase 7 / 12.5).
 *
 * InventorySystem (inventory.js) es la única vía de escritura una vez attach().
 * Estas funciones delegan a él; el fallback legado cubre código que corre
 * antes de attach (tests de parseo, etc.).
 */

import { RESOURCES } from "./resources.js";
import { B, BLOCK_NAMES } from "./blocks.js";

export const ITEM_CATEGORIES = {
  all: { id: "all", name: "Todo" },
  capture: { id: "capture", name: "Captura" },
  healing: { id: "healing", name: "Cura" },
  resource: { id: "resource", name: "Recursos" },
  crafting: { id: "crafting", name: "Fabricación" },
  key: { id: "key", name: "Clave" },
  utility: { id: "utility", name: "Utilidad" },
  block: { id: "block", name: "Bloques" },
};

const RESOURCE_CATEGORY = {
  balls: "capture",
  mist_tonic: "healing",
  medicinal_herb: "healing",
  sky_herb: "healing",
  explorer_kit: "utility",
  ancient_core: "key",
  crimson_resonator: "key",
  apricorn: "crafting",
};

function resourceCategory(id, rec) {
  if (RESOURCE_CATEGORY[id]) return RESOURCE_CATEGORY[id];
  if (rec.crafted) return "crafting";
  return "resource";
}

export const ITEM_DEFS = {
  balls: {
    id: "balls",
    name: "Cubo de captura",
    description: "Un cubo de apricorno reforzado con cobre. Debilita a la criatura y lánzalo en combate para capturarla.",
    category: "capture",
    stackable: true,
    usable: false,
    icon: "▣",
    sellPrice: 12,
    buyPrice: 40,
    sort: 1,
  },
};

for (const r of Object.values(RESOURCES)) {
  ITEM_DEFS[r.id] = {
    id: r.id,
    name: r.name,
    description: r.futureUse
      ? `${r.name}. ${r.futureUse.charAt(0).toUpperCase() + r.futureUse.slice(1)}.`
      : r.name,
    category: resourceCategory(r.id, r),
    stackable: true,
    usable: r.id === "mist_tonic" || r.id === "explorer_kit",
    icon: r.icon ?? "•",
    rarity: r.rarity,
    block: r.block,
    sellPrice: null,
    buyPrice: null,
    sort: 10,
  };
}

ITEM_DEFS.mist_tonic.description = "Frasco de niebla destilada. Restaura un 40% de los PV de todo el equipo activo.";
ITEM_DEFS.explorer_kit.description = "Linterna de carbón y brújula. Aclara la niebla 90 s y señala estructuras cercanas.";
ITEM_DEFS.ancient_core.description = "Núcleo que responde al arco del Refugio Brumoso. No se vende ni se consume por error.";
ITEM_DEFS.crimson_resonator.description = "Pieza de forja que despierta el sello de la Ruina Carmesí. Objeto de progresión.";
ITEM_DEFS.medicinal_herb.description = "Hoja amarga de valle. Se usa en tónicos; no cura por sí sola.";
ITEM_DEFS.sky_herb.description = "Hierba de las mesetas. El viento la cura más dura; se vende bien en el puesto.";
ITEM_DEFS.coral_fragment.description = "Placa viva de arrecife. Los mercaderes de Puerto Azur la pagan; sirve para misiones y un farol futuro.";
ITEM_DEFS.tidal_pearl.description = "Perla de canales someros. Rara, valiosa, y la lente del faro parece reconocerla.";
ITEM_DEFS.coral_fragment.icon = "🪸";
ITEM_DEFS.tidal_pearl.icon = "⚪";
ITEM_DEFS.coral_fragment.sellPrice = 22;
ITEM_DEFS.tidal_pearl.sellPrice = 70;
ITEM_DEFS.apricorn.description = "Fruto naranja de caparazón duro. Tres unidades y un poco de cobre dan un cubo.";
ITEM_DEFS.wind_crystal.description = "Cristal que vibra con las corrientes. Se usa en misiones de altura y se vende.";
ITEM_DEFS.coal.description = "Carbón de veta. Combustible del kit de exploración.";
ITEM_DEFS.copper.description = "Cobre maleable. Componente de cubos de captura.";
ITEM_DEFS.iron.description = "Hierro de profundidad. Armazón del kit de exploración.";
ITEM_DEFS.crystal_shard.description = "Fragmento de cristal lumínico. Parte del núcleo antiguo.";
ITEM_DEFS.ancient_fragment.description = "Esquirla de ruina. Junto a cristal forma el núcleo antiguo.";
ITEM_DEFS.mist_bloom.description = "Flor que abre solo en bruma. Base del tónico.";
ITEM_DEFS.ember_ore.description = "Mena caliente de las Cumbres. El resonador carmesí la consume.";
ITEM_DEFS.red_crystal.description = "Cristal de forja. No se vende barato; despierta sellos.";

const ITEM_PRICES = {
  balls: { buy: 40, sell: 12 },
  mist_tonic: { buy: 60, sell: 25 },
  medicinal_herb: { buy: 25, sell: 10 },
  explorer_kit: { buy: 90, sell: 35 },
  coal: { sell: 8 },
  copper: { sell: 14 },
  iron: { sell: 22 },
  mist_bloom: { sell: 18 },
  ancient_fragment: { sell: 30 },
  ember_ore: { sell: 28 },
  red_crystal: { sell: 55 },
  wind_crystal: { sell: 40 },
  sky_herb: { sell: 14 },
  coral_fragment: { sell: 22 },
  tidal_pearl: { sell: 70 },
};
for (const [id, p] of Object.entries(ITEM_PRICES)) {
  if (!ITEM_DEFS[id]) continue;
  if (p.buy != null) ITEM_DEFS[id].buyPrice = p.buy;
  if (p.sell != null) ITEM_DEFS[id].sellPrice = p.sell;
}

export function itemDef(itemId) {
  if (itemId == null) return null;
  if (ITEM_DEFS[itemId]) return ITEM_DEFS[itemId];
  const n = Number(itemId);
  if (Number.isFinite(n) && BLOCK_NAMES[n]) {
    return {
      id: n,
      name: BLOCK_NAMES[n],
      description: "Bloque de construcción.",
      category: "block",
      stackable: true,
      usable: false,
      icon: "🧱",
      sort: 80,
    };
  }
  return null;
}

export function itemIdOf(spec) {
  return spec.itemId ?? spec.resourceId ?? spec.target;
}

export function blockForItem(itemId) {
  if (!itemId || itemId === "balls") return null;
  return RESOURCES[itemId]?.block ?? null;
}

let _inv = null;
export function bindInventory(sys) {
  _inv = sys;
}

function legacyCount(state, itemId) {
  if (!state) return 0;
  if (itemId === "balls") {
    if (state.inventory && state.inventory.balls != null) return state.inventory.balls ?? 0;
    return state.balls ?? 0;
  }
  if (state.inventory && state.inventory[itemId] != null) return state.inventory[itemId] ?? 0;
  const b = blockForItem(itemId);
  if (b == null) return 0;
  return state.inventory?.[b] ?? 0;
}

export function getItemCount(state, itemId) {
  if (_inv && _inv.state === state) return _inv.count(itemId);
  return legacyCount(state, itemId);
}

export function canAfford(state, costs) {
  if (!state) return false;
  for (const c of costs) {
    if (getItemCount(state, itemIdOf(c)) < c.amount) return false;
  }
  return true;
}

export function missingCost(state, costs) {
  for (const c of costs) {
    const id = itemIdOf(c);
    const have = getItemCount(state, id);
    if (have < c.amount) {
      const name = itemDef(id)?.name ?? (id === "balls" ? "cubos" : (RESOURCES[id]?.name ?? id));
      return `Necesitas ${c.amount} ${name.toLowerCase()} (tienes ${have}).`;
    }
  }
  return null;
}

export function consumeItems(state, costs) {
  for (const c of costs) {
    const id = itemIdOf(c);
    if (_inv && _inv.state === state) {
      _inv.remove(id, c.amount, "consume");
      continue;
    }
    if (id === "balls") {
      state.balls = Math.max(0, (state.balls ?? 0) - c.amount);
      if (state.inventory) state.inventory.balls = state.balls;
    } else if (state.inventory && state.inventory[id] != null) {
      state.inventory[id] = Math.max(0, (state.inventory[id] ?? 0) - c.amount);
    } else {
      const b = blockForItem(id);
      if (b == null) continue;
      state.inventory[b] = Math.max(0, (state.inventory[b] ?? 0) - c.amount);
    }
  }
}

export function grantItems(state, outputs) {
  for (const o of outputs) {
    const id = itemIdOf(o);
    if (_inv && _inv.state === state) {
      _inv.add(id, o.amount, "grant");
      continue;
    }
    if (id === "balls") {
      state.balls = (state.balls ?? 0) + o.amount;
      if (state.inventory) state.inventory.balls = state.balls;
    } else if (state.inventory) {
      if (RESOURCES[id] || id === "balls") {
        state.inventory[id] = (state.inventory[id] ?? 0) + o.amount;
      } else {
        const b = blockForItem(id);
        if (b == null) continue;
        state.inventory[b] = (state.inventory[b] ?? 0) + o.amount;
      }
    }
  }
}

export function executeTransaction(state, { costs = [], outputs = [] } = {}) {
  if (!state) return { ok: false, error: "Sin estado." };
  const err = missingCost(state, costs);
  if (err) return { ok: false, error: err };
  consumeItems(state, costs);
  grantItems(state, outputs);
  return { ok: true };
}

export { B };
