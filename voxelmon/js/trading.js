/**
 * Intercambios simples con NPC (Fase 3). Puente hacia el futuro
 * EconomySystem/InventorySystem: toda mutación de inventario/cubos por
 * comercio pasa por executeTrade — nunca se muta disperso desde la UI.
 *
 * Nota deliberada: state.balls sigue siendo el contador legado de cubos;
 * aquí solo se incrementa de forma centralizada y validada.
 */

import { RESOURCES } from "./resources.js";
import { events } from "./events.js";

export const TRADES = {
  apricorn_balls: {
    id: "apricorn_balls",
    traderId: "merchant",
    label: "3 Apricornos → 1 Cubo",
    cost: [{ resourceId: "apricorn", amount: 3 }],
    gives: { balls: 1 },
  },
};

/**
 * Valida y ejecuta un intercambio sobre el estado.
 * Devuelve { ok: true } o { ok: false, error } sin efectos parciales.
 */
export function executeTrade(state, tradeId) {
  const trade = TRADES[tradeId];
  if (!trade || !state) return { ok: false, error: "Intercambio no disponible." };

  // Validación completa antes de mutar nada
  for (const c of trade.cost) {
    const res = RESOURCES[c.resourceId];
    const have = state.inventory[res.block] ?? 0;
    if (have < c.amount) {
      return { ok: false, error: `Necesitas ${c.amount} ${res.name.toLowerCase()}${c.amount === 1 ? "" : "s"} (tienes ${have}).` };
    }
  }

  for (const c of trade.cost) {
    const res = RESOURCES[c.resourceId];
    state.inventory[res.block] -= c.amount;
  }
  if (trade.gives.balls) state.balls += trade.gives.balls;

  events.emit("tradeCompleted", {
    traderId: trade.traderId,
    tradeId: trade.id,
    cost: trade.cost,
    rewards: trade.gives,
  });
  return { ok: true, trade };
}
