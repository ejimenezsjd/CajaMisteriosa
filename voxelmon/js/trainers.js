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

  // ---------- Gimnasio Verde (Fase 5) ----------

  gym_trainer_leaf_1: {
    id: "gym_trainer_leaf_1",
    name: "Nilo",
    role: "trainer",
    trainerClass: "ranger",
    gymId: "gym_verdant",
    dialogueId: "gym_trainer_nilo",
    dialogueDefeatedId: "gym_trainer_nilo_done",
    team: [
      { speciesId: "semilla", level: 11 },
      { speciesId: "gotita", level: 11 },
    ],
    rewardMoney: 160,
    repeatable: false,
    anchorOffset: [-5, 3],
    colors: { skin: "#d4b07a", outfit: "#3d7a48", accent: "#a8e070" },
  },
  gym_trainer_leaf_2: {
    id: "gym_trainer_leaf_2",
    name: "Lira",
    role: "trainer",
    trainerClass: "ace",
    gymId: "gym_verdant",
    dialogueId: "gym_trainer_lira",
    dialogueDefeatedId: "gym_trainer_lira_done",
    team: [
      { speciesId: "arbusto", level: 12 },
      { speciesId: "plumin", level: 12 },
      { speciesId: "lucier", level: 11 },
    ],
    rewardMoney: 200,
    repeatable: false,
    anchorOffset: [5, 3],
    colors: { skin: "#e0c090", outfit: "#2a6a50", accent: "#f0e6a8" },
  },
  leader_iris: {
    id: "leader_iris",
    name: "Iris",
    role: "trainer",
    trainerClass: "ace",
    gymId: "gym_verdant",
    leader: true,
    dialogueId: "gym_leader_iris",
    dialogueDefeatedId: "gym_leader_iris_done",
    team: [
      { speciesId: "silvax", level: 13 },
      { speciesId: "riazor", level: 12 },
      { speciesId: "clarion", level: 13 },
    ],
    rewardMoney: 500,
    repeatable: false,
    anchorOffset: [3, -10],
    colors: { skin: "#e8c49a", outfit: "#1e5a38", accent: "#7dffb0" },
  },

  // ---------- Gimnasio de las Brumas (Fase 8) ----------

  gym_trainer_mist_1: {
    id: "gym_trainer_mist_1",
    name: "Nox",
    role: "trainer",
    trainerClass: "ranger",
    gymId: "gym_mist",
    dialogueId: "gym_trainer_nox",
    dialogueDefeatedId: "gym_trainer_nox_done",
    team: [
      { speciesId: "umbra", level: 14 },
      { speciesId: "gotita", level: 15 },
    ],
    rewardMoney: 240,
    repeatable: false,
    anchorOffset: [-5, -3],
    colors: { skin: "#c9b090", outfit: "#3a3a58", accent: "#7a5aa0" },
  },
  gym_trainer_mist_2: {
    id: "gym_trainer_mist_2",
    name: "Lumen",
    role: "trainer",
    trainerClass: "ace",
    gymId: "gym_mist",
    dialogueId: "gym_trainer_lumen",
    dialogueDefeatedId: "gym_trainer_lumen_done",
    team: [
      { speciesId: "umbra", level: 15 },
      { speciesId: "arbusto", level: 15 },
      { speciesId: "lucier", level: 16 },
    ],
    rewardMoney: 320,
    repeatable: false,
    anchorOffset: [5, 4],
    colors: { skin: "#e8d8b0", outfit: "#4a6a78", accent: "#f0e6a8" },
  },
  leader_nyra: {
    id: "leader_nyra",
    name: "Nyra",
    role: "trainer",
    trainerClass: "ace",
    gymId: "gym_mist",
    leader: true,
    dialogueId: "gym_leader_nyra",
    dialogueDefeatedId: "gym_leader_nyra_done",
    team: [
      { speciesId: "sombrio", level: 17 },
      { speciesId: "riazor", level: 16 },
      { speciesId: "clarion", level: 18 },
    ],
    rewardMoney: 800,
    repeatable: false,
    anchorOffset: [2, 10],
    colors: { skin: "#d4c4b0", outfit: "#2a2438", accent: "#c9f0ff" },
  },
};

/** Anchors deterministas de entrenadores asociados a un settlement */
export function trainerAnchorsFor(s) {
  if (s.type !== "settlement") return [];
  return Object.values(TRAINERS).filter((t) => !t.gymId).map((t) => ({
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
      gymId: def.gymId ?? null,
    });
    return def.rewardMoney;
  }

  defeatedList() {
    return Object.keys(this.t?.defeated ?? {});
  }
}

export const trainers = new TrainerSystem();
