/**
 * Mutación centralizada de inventario legado (Fase 7).
 *
 * No es un InventorySystem: el almacenamiento sigue siendo
 *   state.inventory[blockId]  +  state.balls
 * Trading y crafting pasan por aquí para no duplicar restas/sumas ni
 * permitir cantidades negativas.
 */

import { RESOURCES } from "./resources.js";

export function itemIdOf(spec) {
  return spec.itemId ?? spec.resourceId ?? spec.target;
}

export function blockForItem(itemId) {
  if (!itemId || itemId === "balls") return null;
  return RESOURCES[itemId]?.block ?? null;
}

export function getItemCount(state, itemId) {
  if (!state) return 0;
  if (itemId === "balls") return state.balls ?? 0;
  const b = blockForItem(itemId);
  if (b == null) return 0;
  return state.inventory[b] ?? 0;
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
      const name = id === "balls" ? "cubos" : (RESOURCES[id]?.name ?? id);
      return `Necesitas ${c.amount} ${name.toLowerCase()} (tienes ${have}).`;
    }
  }
  return null;
}

/** Resta costes ya validados. No usar sin canAfford. */
export function consumeItems(state, costs) {
  for (const c of costs) {
    const id = itemIdOf(c);
    if (id === "balls") {
      state.balls = Math.max(0, (state.balls ?? 0) - c.amount);
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
    if (id === "balls") {
      state.balls = (state.balls ?? 0) + o.amount;
    } else {
      const b = blockForItem(id);
      if (b == null) continue;
      state.inventory[b] = (state.inventory[b] ?? 0) + o.amount;
    }
  }
}

/**
 * Transacción atómica: valida todo, luego consume y otorga.
 * Devuelve { ok: true } o { ok: false, error } sin efectos parciales.
 */
export function executeTransaction(state, { costs = [], outputs = [] } = {}) {
  if (!state) return { ok: false, error: "Sin estado." };
  const err = missingCost(state, costs);
  if (err) return { ok: false, error: err };
  consumeItems(state, costs);
  grantItems(state, outputs);
  return { ok: true };
}
