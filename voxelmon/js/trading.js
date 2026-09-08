/**
 * Intercambios simples con NPC (Fase 3). Trueque de recursos (Bruno).
 * La tienda monetaria vive en economy.js y coexiste con este módulo.
 * Toda mutación de inventario por trueque pasa por executeTrade / items.js.
 *

import { events } from "./events.js";
import { executeTransaction } from "./items.js";

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

  const costs = trade.cost.map((c) => ({ itemId: c.resourceId, amount: c.amount }));
  const outputs = [];
  if (trade.gives.balls) outputs.push({ itemId: "balls", amount: trade.gives.balls });

  const tx = executeTransaction(state, { costs, outputs });
  if (!tx.ok) return tx;

  events.emit("tradeCompleted", {
    traderId: trade.traderId,
    tradeId: trade.id,
    cost: trade.cost,
    rewards: trade.gives,
  });
  return { ok: true, trade };
}
