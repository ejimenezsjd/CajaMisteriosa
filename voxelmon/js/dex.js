/**
 * DexSystem (Fase 12.5): conocimiento del jugador, no el PC ni el party.
 *
 * seen  = avistada (wild cercano, batalla, trainer, boss)
 * caught = obtenida históricamente (captura o evolución). Sigue true
 *          aunque la instancia evolucione o se deposite.
 *
 * Nímbora: seen en el encuentro, never caught (no capturable).
 * Prismatón: oculto hasta seen.
 */

import { events } from "./events.js";
import { SPECIES, DEX_ORDER, familyOf, isSpeciesObtainable, speciesDexMeta } from "./data.js?v=13";

class DexSystem {
  constructor() {
    this.state = null;
  }

  attach(state) {
    this.state = state;
    if (!state.dex) state.dex = { seen: {}, caught: {} };
    if (!state.dex.seen) state.dex.seen = {};
    if (!state.dex.caught) state.dex.caught = {};
    this.reconcileOwned();
    if (state.stats) {
      state.stats.uniqueSpeciesSeen = Math.max(state.stats.uniqueSpeciesSeen ?? 0, this.seenCount());
      state.stats.uniqueSpeciesCaught = Math.max(state.stats.uniqueSpeciesCaught ?? 0, this.caughtCount());
    }
    return this;
  }

  seenMap() { return this.state?.dex?.seen ?? {}; }
  caughtMap() { return this.state?.dex?.caught ?? {}; }

  isSeen(id) { return !!this.seenMap()[id]; }
  isCaught(id) { return !!this.caughtMap()[id]; }

  status(id) {
    if (this.isCaught(id)) return "caught";
    if (this.isSeen(id)) return "seen";
    return "unseen";
  }

  markSeen(speciesId, meta = {}) {
    if (!this.state || !SPECIES[speciesId]) return false;
    if (this.seenMap()[speciesId]) return false;
    this.seenMap()[speciesId] = true;
    events.emit("speciesSeen", { speciesId, first: true, ...meta });
    events.emit("creatureSeen", { speciesId, level: meta.level, ...meta });
    return true;
  }

  markCaught(speciesId, meta = {}) {
    if (!this.state || !SPECIES[speciesId]) return false;
    this.markSeen(speciesId, meta);
    if (this.caughtMap()[speciesId]) return false;
    this.caughtMap()[speciesId] = true;
    events.emit("speciesCaught", { speciesId, first: true, ...meta });
    return true;
  }

  /** Une party + PC al Dex caught/seen sin inventar etapas previas. */
  reconcileOwned() {
    if (!this.state) return;
    const owned = [...(this.state.team ?? []), ...(this.state.creatureStorage?.creatures ?? [])];
    for (const m of owned) {
      if (!m?.speciesId) continue;
      this.seenMap()[m.speciesId] = true;
      this.caughtMap()[m.speciesId] = true;
    }
  }

  catalogSize() {
    return DEX_ORDER.length;
  }

  obtainableIds() {
    return DEX_ORDER.filter((id) => isSpeciesObtainable(id));
  }

  seenCount() {
    return DEX_ORDER.filter((id) => this.isSeen(id)).length;
  }

  caughtCount() {
    return DEX_ORDER.filter((id) => this.isCaught(id)).length;
  }

  obtainableCaughtCount() {
    return this.obtainableIds().filter((id) => this.isCaught(id)).length;
  }

  entry(id) {
    const sp = SPECIES[id];
    if (!sp) return null;
    const meta = speciesDexMeta(id);
    const st = this.status(id);
    return {
      id,
      dexIndex: DEX_ORDER.indexOf(id) + 1,
      name: st === "unseen" ? "???" : sp.name,
      type: st === "unseen" ? null : sp.type,
      stage: sp.stage,
      family: familyOf(id),
      status: st,
      obtainable: isSpeciesObtainable(id),
      legendary: !!sp.legendary,
      rare: !!sp.rare,
      boss: !!sp.boss,
      description: st === "unseen" ? "Aún no has encontrado a esta criatura." : meta.description,
      habitat: st === "caught" || st === "seen" ? meta.habitat : null,
      rarity: meta.rarity,
      evolvesTo: sp.evolvesTo,
      evolveLevel: sp.evolveLevel,
    };
  }

  chain(id) {
    const fam = familyOf(id);
    const line = [];
    if (fam && SPECIES[fam]?.evolvesTo !== undefined) {
      let cur = fam;
      while (cur && SPECIES[cur]) {
        line.push(cur);
        cur = SPECIES[cur].evolvesTo;
      }
    } else {
      line.push(id);
    }
    return line.map((sid) => ({
      id: sid,
      name: this.isSeen(sid) || this.isCaught(sid) ? SPECIES[sid].name : "???",
      known: this.isSeen(sid) || this.isCaught(sid),
    }));
  }

  list({ filter = "all", query = "", type = null } = {}) {
    const q = normalizeSearch(query);
    const out = [];
    for (const id of DEX_ORDER) {
      const st = this.status(id);
      if (filter === "seen" && st === "unseen") continue;
      if (filter === "caught" && st !== "caught") continue;
      const sp = SPECIES[id];
      if (type && sp.type !== type) continue;
      if (q) {
        if (st === "unseen") continue;
        if (!normalizeSearch(sp.name).includes(q)) continue;
      }
      out.push(this.entry(id));
    }
    return out;
  }

  snapshot() {
    return {
      seen: this.seenCount(),
      caught: this.caughtCount(),
      obtainableCaught: this.obtainableCaughtCount(),
      catalog: this.catalogSize(),
      obtainable: this.obtainableIds().length,
      seenIds: DEX_ORDER.filter((id) => this.isSeen(id)),
      caughtIds: DEX_ORDER.filter((id) => this.isCaught(id)),
    };
  }
}

export function normalizeSearch(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export const dex = new DexSystem();
