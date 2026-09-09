/**
 * InventorySystem (Fase 12.5): única API de mutación de objetos.
 *
 * Source of truth: state.inventory (mapa plano id → cantidad).
 * Tras normalizar, las claves son itemId (balls, coal, mist_tonic…) y, para
 * bloques colocables del hotbar, el id numérico de bloque.
 *
 * No expone el objeto interno para mutarlo. state.balls se mantiene como
 * espejo de inventory.balls para saves/lectores antiguos.
 */

import { events } from "./events.js";
import { B, BLOCK_NAMES } from "./blocks.js";
import { RESOURCES, resourceForBlock } from "./resources.js";
import { ITEM_DEFS, ITEM_CATEGORIES, blockForItem, itemDef, bindInventory } from "./items.js";

export const PARTY_MAX = 6;

const PLACEABLE = new Set([B.DIRT, B.STONE, B.SAND, B.WOOD, B.LEAVES, B.SNOW]);

function clampAmt(n) {
  const v = Math.floor(Number(n) || 0);
  return v < 0 ? 0 : v;
}

class InventorySystem {
  constructor() {
    this.state = null;
  }

  attach(state) {
    this.state = state;
    if (!state.inventory || typeof state.inventory !== "object" || Array.isArray(state.inventory)) {
      state.inventory = {};
    }
    this.normalizeLegacy();
    bindInventory(this);
    return this;
  }

  bag() {
    return this.state?.inventory ?? {};
  }

  /**
   * Migración idempotente (invNorm === 1).
   * - state.balls se absorbe una vez en inventory.balls
   * - stacks por bloque de recurso pasan a itemId
   * - B.HERB legado (sky_herb comparte bloque) → medicinal_herb
   */
  normalizeLegacy() {
    const s = this.state;
    if (!s) return;
    const inv = s.inventory;
    if (s.invNorm === 1) {
      s.balls = inv.balls ?? 0;
      return;
    }
    const fromBalls = Number(s.balls) || 0;
    if (inv.balls == null) inv.balls = fromBalls;
    else if ((Number(inv.balls) || 0) === 0 && fromBalls > 0) inv.balls = fromBalls;

    for (const r of Object.values(RESOURCES)) {
      if (r.block == null) continue;
      if (r.block === B.HERB) continue;
      const n = Number(inv[r.block]) || 0;
      if (n > 0) {
        inv[r.id] = (Number(inv[r.id]) || 0) + n;
        delete inv[r.block];
      }
    }
    const herb = Number(inv[B.HERB]) || 0;
    if (herb > 0) {
      inv.medicinal_herb = (Number(inv.medicinal_herb) || 0) + herb;
      delete inv[B.HERB];
    }

    s.balls = inv.balls ?? 0;
    s.invNorm = 1;
  }

  _syncBalls() {
    if (!this.state) return;
    this.state.balls = this.bag().balls ?? 0;
  }

  count(itemId) {
    if (!this.state || itemId == null) return 0;
    return Math.max(0, Number(this.bag()[itemId]) || 0);
  }

  countBlock(blockId) {
    if (PLACEABLE.has(blockId)) return this.count(blockId);
    const res = resourceForBlock(blockId);
    if (res) return this.count(res.id);
    return this.count(blockId);
  }

  get(itemId) {
    return this.count(itemId);
  }

  has(itemId, amount = 1) {
    return this.count(itemId) >= clampAmt(amount);
  }

  canAdd() {
    return !!this.state;
  }

  add(itemId, amount = 1, source = "unknown") {
    const n = clampAmt(amount);
    if (!this.state || !itemId || n <= 0) return 0;
    const bag = this.bag();
    bag[itemId] = this.count(itemId) + n;
    this._syncBalls();
    events.emit("inventoryChanged", {
      itemId, delta: n, total: bag[itemId], source,
    });
    return n;
  }

  /** Minado: distingue sky_herb vs medicinal_herb cuando el drop es HERB. */
  addMined(dropBlock, amount, biomeId, source = "mining") {
    const n = clampAmt(amount);
    if (!dropBlock || n <= 0) return 0;
    if (PLACEABLE.has(dropBlock)) return this.add(dropBlock, n, source);
    if (dropBlock === B.HERB && biomeId === "wind_highlands") {
      return this.add("sky_herb", n, source);
    }
    const res = resourceForBlock(dropBlock);
    if (res) return this.add(res.id, n, source);
    return this.add(dropBlock, n, source);
  }

  remove(itemId, amount = 1, source = "unknown") {
    const n = clampAmt(amount);
    if (!this.state || !itemId || n <= 0) return 0;
    const have = this.count(itemId);
    if (have < n) return 0;
    const bag = this.bag();
    const next = have - n;
    if (next <= 0) delete bag[itemId];
    else bag[itemId] = next;
    this._syncBalls();
    events.emit("inventoryChanged", {
      itemId, delta: -n, total: next, source,
    });
    return n;
  }

  getAll() {
    const bag = this.bag();
    const out = [];
    for (const [id, raw] of Object.entries(bag)) {
      const n = Number(raw) || 0;
      if (n <= 0) continue;
      const def = itemDef(id) ?? placeableDef(id);
      if (!def) continue;
      out.push({ ...def, count: n });
    }
    out.sort((a, b) => (a.sort ?? 50) - (b.sort ?? 50) || a.name.localeCompare(b.name, "es"));
    return out;
  }

  getByCategory(category) {
    if (!category || category === "all") return this.getAll();
    return this.getAll().filter((it) => it.category === category);
  }

  snapshot() {
    const items = {};
    for (const it of this.getAll()) items[it.id] = it.count;
    return { items, balls: this.count("balls"), invNorm: this.state?.invNorm ?? 0 };
  }
}

function placeableDef(id) {
  const n = Number(id);
  if (!PLACEABLE.has(n)) return null;
  return {
    id: n,
    name: BLOCK_NAMES[n] ?? `Bloque ${n}`,
    description: "Bloque de construcción. Equípalo en la barra (1–6) y colócalo con clic derecho.",
    category: "block",
    stackable: true,
    usable: false,
    icon: "🧱",
    sort: 80,
  };
}

export function isKeyItem(itemId) {
  return itemDef(itemId)?.category === "key";
}

export const inventory = new InventorySystem();
export { ITEM_CATEGORIES, ITEM_DEFS, blockForItem };
