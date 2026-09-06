/**
 * TrainerSystem (Fase 4): entrenadores NPC data-driven.
 *
 * Un entrenador ES un NPC (rol "trainer") gestionado por el NPCSystem: se
 * ancla de forma determinista al asentamiento (anchorOffset respecto a su
 * centro), comparte lifecycle/interacción, y añade datos de combate.
 *
 * Anti-farming: la única vía de recompensa es resolveVictory(), que es
 * idempotente (guard sobre state.trainers.defeated). Un trainer no
 * repeatable derrotado muestra diálogo alternativo y canBattle() lo veta.
 *
 * Decisión de alcance: la derrota se persiste por trainerId GLOBAL (los
 * "Milo" de distintos asentamientos son el mismo entrenador lógico). Evita
 * farming entre asentamientos y encaja con la cadena de quests 6→8.
 */

import { events } from "./events.js";

export const TRAINER_CLASSES = {
  rookie: { id: "rookie", name: "Novato" },
  explorer: { id: "explorer", name: "Exploradora" },
  ranger: { id: "ranger", name: "Guardabosques" },
  ace: { id: "ace", name: "As" },
};

export const TRAINERS = {
  trainer_milo: {
    id: "trainer_milo",
    name: "Milo",
    role: "trainer",
    trainerClass: "rookie",
    dialogueId: "trainer_milo",
    dialogueDefeatedId: "trainer_milo_done",
    team: [
      { speciesId: "chispin", level: 5 },
    ],
    rewardMoney: 75,
    repeatable: false,
    // Junto al huerto del asentamiento
    anchorOffset: [-7, 10],
    colors: { skin: "#e8b88a", outfit: "#c84a3a", accent: "#f0d050" },
  },
  trainer_vera: {
    id: "trainer_vera",
    name: "Vera",
    role: "trainer",
    trainerClass: "explorer",
    dialogueId: "trainer_vera",
    dialogueDefeatedId: "trainer_vera_done",
    team: [
      { speciesId: "gotita", level: 7 },
      { speciesId: "plumin", level: 8 },
    ],
    rewardMoney: 120,
    repeatable: false,
    // En el camino, a las afueras del asentamiento
    anchorOffset: [30, -8],
    colors: { skin: "#d9a06a", outfit: "#3d8a5a", accent: "#8a5a2c" },
  },
  trainer_ross: {
    id: "trainer_ross",
    name: "Ross",
    role: "trainer",
    trainerClass: "ranger",
    dialogueId: "trainer_ross",
    dialogueDefeatedId: "trainer_ross_done",
    team: [
      { speciesId: "semilla", level: 10 },
      { speciesId: "piedrita", level: 11 },
      { speciesId: "brasor", level: 12 },
    ],
    rewardMoney: 200,
    repeatable: false,
    // Alejado del asentamiento: la prueba final antes del gimnasio
    anchorOffset: [62, 48],
    colors: { skin: "#c89060", outfit: "#4a5a30", accent: "#e0b840" },
  },
};

/** Anchors deterministas de entrenadores asociados a un settlement */
export function trainerAnchorsFor(s) {
  if (s.type !== "settlement") return [];
  return Object.values(TRAINERS).map((t) => ({
    id: `${s.id}:${t.id}`,
    role: "trainer",
    trainerId: t.id,
    structureId: s.id,
    x: s.x + t.anchorOffset[0],
    z: s.z + t.anchorOffset[1],
  }));
}

class TrainerSystem {
  constructor() {
    this.t = null; // state.trainers
    this.rewardHandler = null; // inyectado por main (addMoney)
  }

  attach(state) {
    this.t = state.trainers;
  }

  setRewardHandler(fn) {
    this.rewardHandler = fn;
  }

  isDefeated(id) {
    return !!this.t?.defeated[id];
  }

  /** Valida si se puede iniciar el combate. Devuelve { ok, reason? } */
  canBattle(id) {
    const def = TRAINERS[id];
    if (!def) return { ok: false, reason: "Ese entrenador no existe." };
    if (!this.t) return { ok: false, reason: "Partida no iniciada." };
    if (this.isDefeated(id) && !def.repeatable) {
      return { ok: false, reason: `Ya has derrotado a ${def.name}.` };
    }
    return { ok: true };
  }

  /**
   * Única vía de recompensa tras ganar a un entrenador. Idempotente:
   * si ya estaba derrotado (y no es repeatable) no vuelve a pagar ni a
   * emitir trainerDefeated. Devuelve el dinero entregado (0 si nada).
   */
  resolveVictory(id) {
    const def = TRAINERS[id];
    if (!def || !this.t) return 0;
    if (this.t.defeated[id] && !def.repeatable) return 0;
    const first = !this.t.defeated[id];
    this.t.defeated[id] = true;
    if (!first) return 0;
    this.rewardHandler?.(def.rewardMoney);
    events.emit("trainerDefeated", {
      trainerId: id,
      trainerClass: def.trainerClass,
      rewardMoney: def.rewardMoney,
    });
    return def.rewardMoney;
  }

  defeatedList() {
    return Object.keys(this.t?.defeated ?? {});
  }
}

export const trainers = new TrainerSystem();
