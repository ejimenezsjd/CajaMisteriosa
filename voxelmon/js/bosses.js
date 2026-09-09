/**
 * BossSystem mínimo (Fase 10): catálogo y resolución, no un segundo combate.
 *
 * El encuentro reutiliza Battle + TrainerOpponent con ctx.type === "boss".
 * Este módulo solo declara el jefe, valida el arranque, persiste la derrota
 * y entrega la recompensa una sola vez. No hay IA propia ni lógica por frame.
 */

import { events } from "./events.js";
import { progression } from "./progression.js";
import { consumeItems, getItemCount } from "./items.js";

export const BOSSES = {
  crimson_guardian: {
    id: "crimson_guardian",
    name: "Guardián Carmesí",
    banner: "⚠ GUARDIÁN CARMESÍ",
    regionId: "region_3",
    structureType: "crimson_ruin",
    sealId: "crimson_ruin",
    speciesId: "titanor",
    team: [{ speciesId: "titanor", level: 26 }],
    rewardMoney: 500,
    unlocks: ["gym_3_path_unlocked"],
    capture: false,
    flee: false,
    repeatable: false,
    // Patio sur del sello (coordenadas locales de crimson_ruin)
    anchorOffset: [0, 4],
  },
  tempest_guardian: {
    id: "tempest_guardian",
    name: "Guardián del Vendaval",
    banner: "⚠ GUARDIÁN DEL VENDAVAL",
    regionId: "region_4",
    structureType: "tempest_spire",
    sealId: "storm_observatory",
    speciesId: "nimbora",
    team: [{ speciesId: "nimbora", level: 35 }],
    rewardMoney: 650,
    unlocks: ["gym_4_path_unlocked"],
    capture: false,
    flee: false,
    repeatable: false,
    anchorOffset: [0, 0],
  },
};

export const SEAL_ID = "crimson_ruin";
export const STORM_SEAL_ID = "storm_observatory";
export const RESONATOR_ID = "crimson_resonator";

export function defaultBossState() {
  return { defeated: false };
}

export function defaultSealState() {
  return { activated: false };
}

class BossSystem {
  constructor() {
    this.b = null; // state.bosses
    this.seals = null; // state.seals
    this.state = null;
    this.rewardHandler = null;
  }

  attach(state) {
    this.state = state;
    if (!state.bosses) state.bosses = {};
    if (!state.seals) state.seals = {};
    if (!state.bosses.crimson_guardian) state.bosses.crimson_guardian = defaultBossState();
    if (!state.bosses.tempest_guardian) state.bosses.tempest_guardian = defaultBossState();
    if (!state.seals.crimson_ruin) state.seals.crimson_ruin = defaultSealState();
    if (!state.seals.storm_observatory) state.seals.storm_observatory = defaultSealState();
    this.b = state.bosses;
    this.seals = state.seals;
  }

  setRewardHandler(fn) {
    this.rewardHandler = fn;
  }

  ensure(id) {
    if (!this.b) return defaultBossState();
    if (!this.b[id]) this.b[id] = defaultBossState();
    return this.b[id];
  }

  ensureSeal(id = SEAL_ID) {
    if (!this.seals) return defaultSealState();
    if (!this.seals[id]) this.seals[id] = defaultSealState();
    return this.seals[id];
  }

  isDefeated(id) {
    return !!this.ensure(id).defeated;
  }

  isSealActivated(id = SEAL_ID) {
    return !!this.ensureSeal(id).activated;
  }

  /**
   * crimson: inert → resonating (gym_3_clue) → activated (resonador).
   * storm: dormant → resonating (gym_4_clue) → activated (E, sin ítem).
   */
  sealPhase(id = SEAL_ID) {
    if (this.isSealActivated(id)) return "activated";
    if (id === STORM_SEAL_ID) {
      if (progression.isUnlocked("gym_4_clue_unlocked")) return "resonating";
      return "dormant";
    }
    if (progression.isUnlocked("gym_3_clue_unlocked")) return "resonating";
    return "inert";
  }

  canActivateSeal(id = SEAL_ID) {
    if (this.isSealActivated(id)) return { ok: false, already: true, reason: "El sello ya está abierto." };
    if (!progression.isUnlocked("gym_3_clue_unlocked")) {
      return { ok: false, reason: "El sello permanece inerte." };
    }
    if (!this.state || getItemCount(this.state, RESONATOR_ID) < 1) {
      return { ok: false, reason: "El sello mineral comienza a resonar. Parece faltarle energía." };
    }
    return { ok: true };
  }

  /**
   * Activa el sello consumiendo un resonador. Idempotente: no gasta de nuevo.
   */
  activateSeal(id = SEAL_ID) {
    const check = this.canActivateSeal(id);
    if (check.already) return { ok: true, already: true };
    if (!check.ok) return check;
    consumeItems(this.state, [{ itemId: RESONATOR_ID, amount: 1 }]);
    this.ensureSeal(id).activated = true;
    progression.setFlag("crimson_seal_activated");
    events.emit("sealActivated", { sealId: id, regionId: "region_3" });
    return { ok: true, activated: true };
  }

  canActivateStormSeal() {
    if (this.isSealActivated(STORM_SEAL_ID)) {
      return { ok: false, already: true, reason: "El sello ya está activo." };
    }
    if (!progression.isUnlocked("gym_4_clue_unlocked")) {
      return { ok: false, reason: "El mecanismo está dormido." };
    }
    return { ok: true };
  }

  /**
   * Activa el sello de la tormenta sin consumir ítems. Idempotente.
   */
  activateStormSeal() {
    const check = this.canActivateStormSeal();
    if (check.already) return { ok: true, already: true };
    if (!check.ok) return check;
    this.ensureSeal(STORM_SEAL_ID).activated = true;
    events.emit("sealActivated", { sealId: STORM_SEAL_ID, regionId: "region_4" });
    return { ok: true, activated: true };
  }

  canBattle(id) {
    const def = BOSSES[id];
    if (!def) return { ok: false, reason: "Ese guardián no existe." };
    if (!this.b) return { ok: false, reason: "Partida no iniciada." };
    const sealId = def.sealId ?? SEAL_ID;
    if (!this.isSealActivated(sealId)) {
      return { ok: false, reason: "El sello aún no ha sido activado." };
    }
    if (this.isDefeated(id) && !def.repeatable) {
      return { ok: false, reason: `El ${def.name} ya fue derrotado.` };
    }
    return { ok: true };
  }

  /**
   * Única vía de recompensa. Idempotente: no paga ni emite bossDefeated
   * si ya estaba derrotado.
   */
  resolveVictory(id) {
    const def = BOSSES[id];
    if (!def || !this.b) return 0;
    const st = this.ensure(id);
    if (st.defeated && !def.repeatable) return 0;
    const first = !st.defeated;
    st.defeated = true;
    if (!first) return 0;
    this.rewardHandler?.(def.rewardMoney);
    for (const u of def.unlocks ?? []) progression.unlock(u);
    const level = def.team[0]?.level ?? 0;
    events.emit("bossDefeated", {
      bossId: id,
      regionId: def.regionId,
      level,
      rewardMoney: def.rewardMoney,
    });
    return def.rewardMoney;
  }
}

export const bosses = new BossSystem();
