/**
 * EconomySystem ligero (Fase 9).
 *
 * Centraliza compra/venta monetaria y el cobro de servicios.
 * No sustituye a trading.js (trueque de Bruno) ni a crafting.js.
 *
 * Mutación de ítems: items.executeTransaction / grantItems.
 * Mutación de dinero: grantMoney / spendMoney (única vía nueva).
 *
 * Catálogo de precios FIJO. buy > sell. Sin inflación ni fórmulas.
 */

import { events } from "./events.js";
import { RESOURCES } from "./resources.js";
import { executeTransaction, getItemCount, itemDef } from "./items.js";

export const HEAL_COST = 60;

/** Precio de mostrador. `buy` = lo que cobra el mercader; `sell` = lo que paga. */
export const PRICE_CATALOG = {
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

/** El mercader regional vende estas 4 cosas. Nunca recursos raros de Región 3. */
export const SHOP_STOCK = ["balls", "mist_tonic", "medicinal_herb", "explorer_kit"];

/** Subconjunto vendible. ancient_core queda fuera a propósito. */
export const SHOP_BUYS = [
  "coal", "copper", "iron", "mist_bloom", "ancient_fragment", "ember_ore", "red_crystal",
  "wind_crystal", "sky_herb", "coral_fragment", "tidal_pearl",
];

const NO_SELL = new Set(["ancient_core", "crimson_resonator"]);

export function itemLabel(itemId) {
  return itemDef(itemId)?.name ?? RESOURCES[itemId]?.name ?? itemId;
}

const $ = (id) => document.getElementById(id);

class EconomySystem {
  constructor() {
    this.state = null;
    this.open = false;
    this.tab = "buy";
    this.selected = "balls";
    this.onOpen = null;
    this.onClose = null;
    this.onError = null;
    this.boundUi = false;
  }

  attach(state) {
    this.state = state;
    this.bindUi();
  }

  bindUi() {
    if (this.boundUi) return;
    const buyBtn = $("btn-shop-buy");
    const sellBtn = $("btn-shop-sell");
    const closeBtn = $("btn-shop-close");
    if (!buyBtn || !sellBtn || !closeBtn) return;
    this.boundUi = true;
    buyBtn.addEventListener("click", () => this.tryBuy());
    sellBtn.addEventListener("click", () => this.trySell());
    closeBtn.addEventListener("click", () => this.close());
  }

  money() {
    return this.state?.money ?? 0;
  }

  getPrice(itemId) {
    return PRICE_CATALOG[itemId] ?? null;
  }

  grantMoney(amount, meta = {}) {
    const n = Math.floor(Number(amount) || 0);
    if (!this.state || n <= 0) return false;
    this.state.money = (this.state.money || 0) + n;
    events.emit("moneyChanged", {
      money: this.state.money,
      delta: n,
      total: this.state.money,
      ...meta,
    });
    return true;
  }

  spendMoney(amount, meta = {}) {
    const n = Math.floor(Number(amount) || 0);
    if (!this.state || n <= 0) return false;
    if ((this.state.money || 0) < n) return false;
    this.state.money -= n;
    events.emit("moneyChanged", {
      money: this.state.money,
      delta: -n,
      total: this.state.money,
      ...meta,
    });
    return true;
  }

  canBuy(itemId, amount = 1) {
    const n = Math.floor(Number(amount) || 0);
    if (n <= 0 || !this.state) return false;
    if (!SHOP_STOCK.includes(itemId)) return false;
    const price = this.getPrice(itemId)?.buy;
    if (price == null) return false;
    return this.money() >= price * n;
  }

  canSell(itemId, amount = 1) {
    const n = Math.floor(Number(amount) || 0);
    if (n <= 0 || !this.state) return false;
    if (NO_SELL.has(itemId) || !SHOP_BUYS.includes(itemId)) return false;
    const price = this.getPrice(itemId)?.sell;
    if (price == null) return false;
    return getItemCount(this.state, itemId) >= n;
  }

  /**
   * Compra atómica: valida dinero, cobra y otorga. Sin negativos ni parciales.
   */
  buy(itemId, amount = 1) {
    const n = Math.floor(Number(amount) || 0);
    if (n <= 0) return { ok: false, error: "Cantidad inválida." };
    if (!this.state) return { ok: false, error: "Sin estado." };
    if (!SHOP_STOCK.includes(itemId)) return { ok: false, error: "Eso no está a la venta." };
    const unit = this.getPrice(itemId)?.buy;
    if (unit == null) return { ok: false, error: "Sin precio de compra." };
    const total = unit * n;
    if (this.money() < total) {
      return { ok: false, error: `Te faltan ${total - this.money()} ⌾.` };
    }
    if (!this.spendMoney(total, { source: "shop_buy", itemId })) {
      return { ok: false, error: "No tienes dinero suficiente." };
    }
    const tx = executeTransaction(this.state, { outputs: [{ itemId, amount: n }] });
    if (!tx.ok) {
      this.grantMoney(total, { source: "shop_buy_rollback", itemId });
      return tx;
    }
    events.emit("itemPurchased", { itemId, amount: n, unitPrice: unit, total });
    return { ok: true, itemId, amount: n, unitPrice: unit, total };
  }

  /**
   * Venta atómica: valida ítem, consume y paga. ancient_core no se vende.
   */
  sell(itemId, amount = 1) {
    const n = Math.floor(Number(amount) || 0);
    if (n <= 0) return { ok: false, error: "Cantidad inválida." };
    if (!this.state) return { ok: false, error: "Sin estado." };
    if (NO_SELL.has(itemId)) return { ok: false, error: "Eso no se vende: es demasiado importante." };
    if (!SHOP_BUYS.includes(itemId)) return { ok: false, error: "El mercader no compra eso." };
    const unit = this.getPrice(itemId)?.sell;
    if (unit == null) return { ok: false, error: "Sin precio de venta." };
    if (getItemCount(this.state, itemId) < n) {
      return { ok: false, error: `No tienes ${itemLabel(itemId).toLowerCase()} para vender.` };
    }
    const tx = executeTransaction(this.state, { costs: [{ itemId, amount: n }] });
    if (!tx.ok) return tx;
    const total = unit * n;
    this.grantMoney(total, { source: "shop_sell", itemId });
    events.emit("itemSold", { itemId, amount: n, unitPrice: unit, total });
    return { ok: true, itemId, amount: n, unitPrice: unit, total };
  }

  /** Cura completa del equipo a cambio de dinero. No sustituye al santuario. */
  healParty() {
    if (!this.state) return { ok: false, error: "Sin estado." };
    if (this.money() < HEAL_COST) {
      return { ok: false, error: `La cura cuesta ${HEAL_COST} ⌾ (tienes ${this.money()}).` };
    }
    if (!this.spendMoney(HEAL_COST, { source: "field_medic" })) {
      return { ok: false, error: "No tienes dinero suficiente." };
    }
    for (const m of this.state.team) m.hp = m.maxHp;
    events.emit("partyHealed", { source: "field_medic", cost: HEAL_COST });
    return { ok: true, cost: HEAL_COST };
  }

  tryBuy() {
    if (!this.open) return { ok: false };
    const r = this.buy(this.selected, 1);
    if (!r.ok && r.error) this.onError?.(r.error);
    this.render();
    return r;
  }

  trySell() {
    if (!this.open) return { ok: false };
    const r = this.sell(this.selected, 1);
    if (!r.ok && r.error) this.onError?.(r.error);
    this.render();
    return r;
  }

  show(title = "Puesto") {
    if (this.open) return;
    this.bindUi();
    this.open = true;
    this.tab = "buy";
    this.selected = SHOP_STOCK[0];
    const el = $("shop-title");
    if (el) {
      const money = el.querySelector("#shop-money");
      el.childNodes[0].textContent = `${title} `;
      if (!money) {
        const span = document.createElement("span");
        span.id = "shop-money";
        el.appendChild(span);
      }
    }
    this.onOpen?.();
    this.render();
  }

  close() {
    if (!this.open) return;
    this.open = false;
    $("shop-ui")?.classList.add("hidden");
    this.onClose?.();
  }

  snapshot() {
    return {
      money: this.money(),
      catalog: { ...PRICE_CATALOG },
      stock: [...SHOP_STOCK],
      buys: [...SHOP_BUYS],
      healCost: HEAL_COST,
      open: this.open,
      selected: this.selected,
      tab: this.tab,
    };
  }

  render() {
    const ui = $("shop-ui");
    if (!ui || !this.open) return;
    ui.classList.remove("hidden");
    const moneyEl = $("shop-money");
    if (moneyEl) moneyEl.textContent = `⌾ ${this.money()}`;

    const list = $("shop-list");
    if (!list) return;
    list.innerHTML = "";
    const ids = this.tab === "buy" ? SHOP_STOCK : SHOP_BUYS;
    for (const id of ids) {
      const btn = document.createElement("button");
      btn.className = "btn craft-recipe" + (id === this.selected ? " selected" : "");
      const price = this.tab === "buy" ? this.getPrice(id)?.buy : this.getPrice(id)?.sell;
      btn.textContent = `${itemLabel(id)} · ${price} ⌾`;
      btn.addEventListener("click", () => { this.selected = id; this.render(); });
      list.appendChild(btn);
    }

    const detail = $("shop-detail");
    const id = this.selected;
    const have = getItemCount(this.state, id);
    const buyP = this.getPrice(id)?.buy;
    const sellP = this.getPrice(id)?.sell;
    detail.innerHTML = `
      <p class="craft-result">${itemLabel(id)}</p>
      <div class="craft-ing">En mochila: <b>${have}</b></div>
      ${buyP != null ? `<div class="craft-ing ${this.money() >= buyP ? "ok" : "missing"}">Comprar: <b>${buyP}</b> ⌾</div>` : ""}
      ${sellP != null ? `<div class="craft-ing ${have >= 1 ? "ok" : "missing"}">Vender: <b>${sellP}</b> ⌾</div>` : "<div class=\"craft-ing missing\">El mercader no compra esto.</div>"}`;

    const buyBtn = $("btn-shop-buy");
    const sellBtn = $("btn-shop-sell");
    if (buyBtn) {
      const ok = this.canBuy(id, 1);
      buyBtn.disabled = !ok;
      buyBtn.textContent = ok ? "Comprar 1" : "Sin fondos";
    }
    if (sellBtn) {
      const ok = this.canSell(id, 1);
      sellBtn.disabled = !ok;
      sellBtn.textContent = ok ? "Vender 1" : "Nada que vender";
    }

    $("btn-shop-tab-buy")?.classList.toggle("selected", this.tab === "buy");
    $("btn-shop-tab-sell")?.classList.toggle("selected", this.tab === "sell");
  }
}

export const economy = new EconomySystem();

export function bindShopTabs() {
  $("btn-shop-tab-buy")?.addEventListener("click", () => {
    economy.tab = "buy";
    economy.selected = SHOP_STOCK[0];
    economy.render();
  });
  $("btn-shop-tab-sell")?.addEventListener("click", () => {
    economy.tab = "sell";
    economy.selected = SHOP_BUYS[0];
    economy.render();
  });
}
