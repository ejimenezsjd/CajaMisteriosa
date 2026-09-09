/**
 * CreatureStorage / PC (Fase 12.5).
 *
 * Party = state.team (criaturas activas, máximo PARTY_MAX).
 * PC    = state.creatureStorage.creatures (instancias reales, no speciesId).
 *
 * Deposit/withdraw/swap operan por uid. Nunca se recrea la criatura.
 * Mínimo 1 en party. Depositar no cura.
 */

import { events } from "./events.js";
import { SPECIES } from "./data.js?v=13";
import { PARTY_MAX } from "./inventory.js";

export { PARTY_MAX };

function ensureUid(m) {
  if (m && !m.uid) {
    m.uid = `${m.speciesId || "mon"}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  }
  return m;
}

class CreatureStorage {
  constructor() {
    this.state = null;
  }

  attach(state) {
    this.state = state;
    if (!state.creatureStorage || typeof state.creatureStorage !== "object") {
      state.creatureStorage = { creatures: [] };
    }
    if (!Array.isArray(state.creatureStorage.creatures)) {
      state.creatureStorage.creatures = [];
    }
    for (const m of state.team ?? []) ensureUid(m);
    for (const m of state.creatureStorage.creatures) ensureUid(m);
    return this;
  }

  box() {
    return this.state?.creatureStorage?.creatures ?? [];
  }

  party() {
    return this.state?.team ?? [];
  }

  partySize() {
    return this.party().length;
  }

  storageSize() {
    return this.box().length;
  }

  find(uid) {
    const p = this.party().find((m) => m.uid === uid);
    if (p) return { monster: p, where: "party" };
    const s = this.box().find((m) => m.uid === uid);
    if (s) return { monster: s, where: "pc" };
    return null;
  }

  /**
   * Destino de una captura. No muta Dex.
   * @returns {{ dest: "party"|"pc", monster }}
   */
  receiveCapture(monster) {
    ensureUid(monster);
    if (this.partySize() < PARTY_MAX) {
      this.party().push(monster);
      events.emit("creatureStored", { uid: monster.uid, dest: "party", speciesId: monster.speciesId });
      return { dest: "party", monster };
    }
    this.box().push(monster);
    events.emit("creatureStored", { uid: monster.uid, dest: "pc", speciesId: monster.speciesId });
    return { dest: "pc", monster };
  }

  canDeposit() {
    return this.partySize() > 1;
  }

  deposit(uid) {
    if (!this.canDeposit()) return { ok: false, error: "Tu equipo no puede quedar vacío." };
    const i = this.party().findIndex((m) => m.uid === uid);
    if (i < 0) return { ok: false, error: "Esa criatura no está en el equipo." };
    const [m] = this.party().splice(i, 1);
    this.box().push(m);
    events.emit("creatureStored", { uid: m.uid, dest: "pc", speciesId: m.speciesId, action: "deposit" });
    return { ok: true, monster: m };
  }

  canWithdraw() {
    return this.partySize() < PARTY_MAX;
  }

  withdraw(uid) {
    if (!this.canWithdraw()) return { ok: false, error: "El equipo está completo (6)." };
    const i = this.box().findIndex((m) => m.uid === uid);
    if (i < 0) return { ok: false, error: "Esa criatura no está en el PC." };
    const [m] = this.box().splice(i, 1);
    this.party().push(m);
    events.emit("creatureStored", { uid: m.uid, dest: "party", speciesId: m.speciesId, action: "withdraw" });
    return { ok: true, monster: m };
  }

  swap(partyUid, pcUid) {
    const pi = this.party().findIndex((m) => m.uid === partyUid);
    const si = this.box().findIndex((m) => m.uid === pcUid);
    if (pi < 0 || si < 0) return { ok: false, error: "Selecciona una del equipo y una del PC." };
    const tmp = this.party()[pi];
    this.party()[pi] = this.box()[si];
    this.box()[si] = tmp;
    events.emit("creatureStored", {
      uid: this.party()[pi].uid, dest: "swap", speciesId: this.party()[pi].speciesId, action: "swap",
    });
    return { ok: true };
  }

  moveParty(uid, dir) {
    const arr = this.party();
    const i = arr.findIndex((m) => m.uid === uid);
    if (i < 0) return { ok: false };
    const j = i + (dir < 0 ? -1 : 1);
    if (j < 0 || j >= arr.length) return { ok: false };
    [arr[i], arr[j]] = [arr[j], arr[i]];
    return { ok: true, lead: arr[0] };
  }

  setLead(uid) {
    const arr = this.party();
    const i = arr.findIndex((m) => m.uid === uid);
    if (i <= 0) return { ok: i === 0 };
    arr.unshift(arr.splice(i, 1)[0]);
    return { ok: true, lead: arr[0] };
  }

  cardInfo(m) {
    const sp = SPECIES[m.speciesId];
    return {
      uid: m.uid,
      speciesId: m.speciesId,
      name: m.name ?? sp?.name ?? m.speciesId,
      type: m.type ?? sp?.type,
      stage: m.stage ?? sp?.stage,
      level: m.level,
      hp: m.hp,
      maxHp: m.maxHp,
      xp: m.xp,
      xpToNext: m.xpToNext,
    };
  }

  snapshot() {
    return {
      party: this.partySize(),
      storage: this.storageSize(),
      lead: this.party()[0]?.speciesId ?? null,
    };
  }
}

export const creatureStorage = new CreatureStorage();
