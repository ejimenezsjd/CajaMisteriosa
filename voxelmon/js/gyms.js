/**
 * GymSystem (Fase 5): primer gimnasio data-driven.
 *
 * Encaje: este módulo posee la DEFINICIÓN del gimnasio, el estado del puzzle,
 * el acceso condicionado y la resolución única de la victoria del líder.
 * No duplica TrainerSystem ni BattleSystem: los trainers internos y el líder
 * son entradas de TRAINERS; el NPCSystem los activa por anchors; el combate
 * es startTrainerBattle de siempre.
 *
 * Anti-farm de insignia: resolveLeaderVictory() llama a trainers.resolveVictory
 * (dinero + trainerDefeated una sola vez) y solo entonces concede badge/unlocks
 * si el gimnasio no estaba completed. QuestSystem reacciona a esos eventos;
 * no vuelve a entregar la insignia.
 *
 * Consumidor de region_2_path_unlocked: RegionSystem / portón fronterizo
 * (Fase 6). Aquí solo se emite el unlock.
 */

import { events } from "./events.js";
import { TRAINERS, trainers } from "./trainers.js";

/** Coordenadas locales (dx, dz) respecto al centro de la estructura gym */
export const GYM_LAYOUT = {
  door: [0, 12],
  exit: [0, 13],
  reception: [0, 9],
  guide: [3, 9],
  leaderDoor: [0, -7],
  leaderRoom: [2, -10],
  switches: {
    leaf: [-4, -4],
    light: [0, -4],
    water: [4, -4],
  },
};

export const SWITCH_LABELS = {
  leaf: "Pedestal de la hoja",
  light: "Pedestal de la luz",
  water: "Pedestal del agua",
};

export const GYMS = {
  gym_verdant: {
    id: "gym_verdant",
    name: "Gimnasio Verde",
    badgeId: "verdant_badge",
    badgeName: "Insignia Verde",
    biomes: ["plains", "forest"],
    requirements: { progression: ["gym_path_unlocked"] },
    trainers: ["gym_trainer_leaf_1", "gym_trainer_leaf_2"],
    leader: "leader_iris",
    puzzle: {
      type: "switch_sequence",
      sequence: ["leaf", "light", "water"],
    },
    rewards: {
      unlocks: ["first_gym_completed", "region_2_path_unlocked"],
    },
  },
};

export function defaultGymState() {
  return { puzzleSolved: false, puzzleAttempt: [], completed: false, entered: false };
}

/** Anchors de NPC/trainers de un gimnasio (identidad `<structureId>:<role|trainerId>`) */
export function gymAnchorsFor(s) {
  if (s.type !== "gym") return [];
  const gym = GYMS.gym_verdant;
  const floorY = s.y + 1;
  const out = [{
    id: `${s.id}:gym_guide`,
    role: "gym_guide",
    structureId: s.id,
    x: s.x + GYM_LAYOUT.guide[0],
    z: s.z + GYM_LAYOUT.guide[1],
    y: floorY,
  }];
  for (const tid of [...gym.trainers, gym.leader]) {
    const t = TRAINERS[tid];
    if (!t) continue;
    out.push({
      id: `${s.id}:${t.id}`,
      role: "trainer",
      trainerId: t.id,
      structureId: s.id,
      x: s.x + t.anchorOffset[0],
      z: s.z + t.anchorOffset[1],
      y: floorY,
    });
  }
  return out;
}

class GymSystem {
  constructor() {
    this.g = null; // state.gyms
    this.progression = null;
  }

  attach(state) {
    this.g = state.gyms;
    if (this.g && !this.g.gym_verdant) this.g.gym_verdant = defaultGymState();
  }

  setProgression(p) {
    this.progression = p;
  }

  ensure(id) {
    if (!this.g) return defaultGymState();
    if (!this.g[id]) this.g[id] = defaultGymState();
    return this.g[id];
  }

  gymState(id = "gym_verdant") {
    const st = this.ensure(id);
    const gym = GYMS[id];
    return {
      id,
      name: gym.name,
      puzzleSolved: !!st.puzzleSolved,
      puzzleAttempt: [...(st.puzzleAttempt ?? [])],
      completed: !!st.completed,
      entered: !!st.entered,
      trainersRequired: gym.trainers,
      trainersDefeated: gym.trainers.filter((t) => trainers.isDefeated(t)),
      leaderDefeated: trainers.isDefeated(gym.leader),
      leaderReady: this.canEnterLeader(id),
      canEnter: this.canEnter(id),
    };
  }

  canEnter(id = "gym_verdant") {
    const gym = GYMS[id];
    if (!gym || !this.progression) return false;
    return gym.requirements.progression.every((u) => this.progression.isUnlocked(u));
  }

  canEnterLeader(id = "gym_verdant") {
    const gym = GYMS[id];
    if (!this.isPuzzleSolved(id)) return false;
    return gym.trainers.every((t) => trainers.isDefeated(t));
  }

  isPuzzleSolved(id = "gym_verdant") {
    return !!this.ensure(id).puzzleSolved;
  }

  isCompleted(id = "gym_verdant") {
    return !!this.ensure(id).completed;
  }

  markEntered(id = "gym_verdant") {
    const st = this.ensure(id);
    if (st.entered) return false;
    st.entered = true;
    return true;
  }

  /**
   * Activa un pedestal. Secuencia correcta o reset sin castigo.
   * Idempotente una vez resuelto.
   */
  activateSwitch(id, switchId) {
    const gym = GYMS[id];
    const st = this.ensure(id);
    const seq = gym.puzzle.sequence;
    if (st.puzzleSolved) {
      return { ok: true, already: true, current: seq.length, required: seq.length };
    }
    st.puzzleAttempt = st.puzzleAttempt ?? [];
    st.puzzleAttempt.push(switchId);
    const i = st.puzzleAttempt.length - 1;
    if (st.puzzleAttempt[i] !== seq[i]) {
      st.puzzleAttempt = [];
      events.emit("gymPuzzleProgress", { gymId: id, current: 0, required: seq.length, reset: true });
      return { ok: false, reset: true, current: 0, required: seq.length };
    }
    const current = st.puzzleAttempt.length;
    events.emit("gymPuzzleProgress", { gymId: id, current, required: seq.length, reset: false });
    if (current === seq.length) {
      st.puzzleSolved = true;
      events.emit("gymPuzzleSolved", { gymId: id });
      return { ok: true, solved: true, current, required: seq.length };
    }
    return { ok: true, current, required: seq.length };
  }

  /** [debug] reinicia el puzzle de un gimnasio no completado */
  resetPuzzle(id = "gym_verdant") {
    const st = this.ensure(id);
    st.puzzleSolved = false;
    st.puzzleAttempt = [];
  }

  /**
   * Única vía de recompensa del líder. Encadena resolveVictory (dinero +
   * trainerDefeated, ya idempotente) y concede badge/unlocks solo la primera
   * vez que el gimnasio se completa.
   */
  resolveLeaderVictory(trainerId) {
    const def = TRAINERS[trainerId];
    if (!def?.leader || !def.gymId) return trainers.resolveVictory(trainerId);
    const gym = GYMS[def.gymId];
    const st = this.ensure(gym.id);
    const money = trainers.resolveVictory(trainerId);
    if (st.completed || money === 0) return 0;
    st.completed = true;
    this.progression?.addBadge(gym.badgeId);
    for (const u of gym.rewards.unlocks) this.progression?.unlock(u);
    events.emit("gymCompleted", { gymId: gym.id, badgeId: gym.badgeId, trainerId });
    return money;
  }
}

export const gyms = new GymSystem();
