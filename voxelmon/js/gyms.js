/**
 * GymSystem (Fases 5 y 8): gimnasios data-driven en el mismo módulo.
 *
 * Encaje: este módulo posee la DEFINICIÓN del gimnasio, el estado del puzzle,
 * el acceso condicionado y la resolución única de la victoria del líder.
 * No duplica TrainerSystem ni BattleSystem: los trainers internos y el líder
 * son entradas de TRAINERS; el NPCSystem los activa por anchors; el combate
 * es startTrainerBattle de siempre.
 *
 * Gym 1 (gym_verdant): puzzle de secuencia de pedestales.
 * Gym 2 (gym_mist): faros de bruma en cualquier orden, sin reset.
 * Gym 3 (gym_crimson): distribución de energía (reservorio 3).
 *
 * Anti-farm de insignia: resolveLeaderVictory() llama a trainers.resolveVictory
 * (dinero + trainerDefeated una sola vez) y solo entonces concede badge/unlocks
 * si el gimnasio no estaba completed. QuestSystem reacciona a esos eventos;
 * no vuelve a entregar la insignia.
 *
 * Consumidor de region_2_path_unlocked: RegionSystem / portón fronterizo.
 * Consumidor de region_3_path_unlocked: barrera sur del Gimnasio de las Brumas
 * (frontera funcional hacia las Cumbres Carmesí; no construye el Gimnasio 3).
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

/** Gimnasio de las Brumas: entrada al norte (hacia el arco del refugio). */
export const MIST_GYM_LAYOUT = {
  door: [0, -12],
  exit: [0, -13],
  reception: [0, -9],
  guide: [3, -9],
  leaderDoor: [0, 7],
  leaderRoom: [2, 10],
  beacons: {
    north: [0, -4],
    west: [-5, 1],
    east: [5, 1],
  },
  exitHook: [0, 15],
};

/** Gimnasio de la Forja: entrada al norte (desde la ruina / el boss). */
export const FORGE_GYM_LAYOUT = {
  door: [0, -12],
  exit: [0, -13],
  reception: [0, -9],
  guide: [3, -9],
  westDoor: [-4, -2],
  eastDoor: [4, -2],
  conduits: {
    west: [-5, -4],
    east: [5, -4],
    core: [0, 3],
  },
  leaderDoor: [0, 7],
  leaderRoom: [2, 10],
  passHook: [0, 15],
};

export const CONDUIT_LABELS = {
  west: "Conducto oeste",
  east: "Conducto este",
  core: "Núcleo de forja",
};

export const CONDUIT_CAPS = { west: 1, east: 1, core: 2 };
export const ENERGY_POOL = 3;

export const BEACON_LABELS = {
  north: "Faro Norte",
  west: "Faro Oeste",
  east: "Faro Este",
};

export const GYM_BY_STRUCTURE = {
  gym: "gym_verdant",
  gym_mist: "gym_mist",
  gym_crimson: "gym_crimson",
};

export function gymIdForStructure(s) {
  return s ? (GYM_BY_STRUCTURE[s.type] ?? null) : null;
}

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
    layout: GYM_LAYOUT,
    guideRole: "gym_guide",
    rewards: {
      unlocks: ["first_gym_completed", "region_2_path_unlocked"],
    },
  },

  gym_mist: {
    id: "gym_mist",
    name: "Gimnasio de las Brumas",
    badgeId: "mist_badge",
    badgeName: "Insignia Bruma",
    region: "region_2",
    structureType: "gym_mist",
    requirements: { progression: ["gym_2_clue_unlocked"] },
    trainers: ["gym_trainer_mist_1", "gym_trainer_mist_2"],
    leader: "leader_nyra",
    puzzle: { type: "mist_ruins", beacons: ["north", "west", "east"] },
    layout: MIST_GYM_LAYOUT,
    guideRole: "mist_gym_guide",
    rewards: {
      unlocks: ["second_gym_completed", "region_3_path_unlocked"],
    },
  },

  gym_crimson: {
    id: "gym_crimson",
    name: "Gimnasio de la Forja",
    badgeId: "crimson_badge",
    badgeName: "Insignia Forja",
    region: "region_3",
    structureType: "gym_crimson",
    requirements: { progression: ["gym_3_path_unlocked"] },
    trainers: ["gym_trainer_forge_1", "gym_trainer_forge_2"],
    leader: "leader_brann",
    puzzle: { type: "forge_energy", conduits: ["west", "east", "core"] },
    layout: FORGE_GYM_LAYOUT,
    guideRole: "crimson_gym_guide",
    rewards: {
      unlocks: ["third_gym_completed", "region_4_path_unlocked"],
    },
  },
};

export function defaultGymState(id = "gym_verdant") {
  const st = { puzzleSolved: false, puzzleAttempt: [], completed: false, entered: false };
  if (id === "gym_mist") st.beacons = { north: false, east: false, west: false };
  if (id === "gym_crimson") st.energy = { west: 0, east: 0, core: 0, pool: ENERGY_POOL };
  return st;
}

/** Anchors de NPC/trainers de un gimnasio (identidad `<structureId>:<role|trainerId>`) */
export function gymAnchorsFor(s) {
  const gymId = gymIdForStructure(s);
  const gym = gymId ? GYMS[gymId] : null;
  if (!gym) return [];
  const layout = gym.layout;
  const floorY = s.y + 1;
  const out = [{
    id: `${s.id}:${gym.guideRole}`,
    role: gym.guideRole,
    structureId: s.id,
    x: s.x + layout.guide[0],
    z: s.z + layout.guide[1],
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
    if (this.g && !this.g.gym_verdant) this.g.gym_verdant = defaultGymState("gym_verdant");
    if (this.g && !this.g.gym_mist) this.g.gym_mist = defaultGymState("gym_mist");
    if (this.g && !this.g.gym_crimson) this.g.gym_crimson = defaultGymState("gym_crimson");
  }

  setProgression(p) {
    this.progression = p;
  }

  ensure(id) {
    if (!this.g) return defaultGymState(id);
    if (!this.g[id]) this.g[id] = defaultGymState(id);
    if (id === "gym_mist" && !this.g[id].beacons) {
      this.g[id].beacons = { north: false, east: false, west: false };
    }
    if (id === "gym_crimson" && !this.g[id].energy) {
      this.g[id].energy = { west: 0, east: 0, core: 0, pool: ENERGY_POOL };
    }
    return this.g[id];
  }

  gymState(id = "gym_verdant") {
    const st = this.ensure(id);
    const gym = GYMS[id];
    const beacons = st.beacons ? { ...st.beacons } : null;
    const beaconCount = beacons ? Object.values(beacons).filter(Boolean).length : 0;
    const energy = st.energy ? { ...st.energy } : null;
    return {
      id,
      name: gym.name,
      puzzleSolved: !!st.puzzleSolved,
      puzzleAttempt: [...(st.puzzleAttempt ?? [])],
      beacons,
      beaconCount,
      energy,
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

  /**
   * Faros de bruma: cualquier orden, sin reset. Idempotente por faro.
   */
  activateBeacon(id, beaconId) {
    const gym = GYMS[id];
    const st = this.ensure(id);
    const keys = gym.puzzle.beacons ?? ["north", "west", "east"];
    if (!st.beacons) st.beacons = { north: false, east: false, west: false };
    if (!(beaconId in st.beacons)) return { ok: false, error: "Faro desconocido." };
    const required = keys.length;
    if (st.puzzleSolved) {
      return { ok: true, already: true, current: required, required };
    }
    const first = !st.beacons[beaconId];
    st.beacons[beaconId] = true;
    const current = keys.filter((k) => st.beacons[k]).length;
    if (first) {
      events.emit("gymPuzzleProgress", { gymId: id, current, required, reset: false, beaconId });
    }
    if (current === required) {
      st.puzzleSolved = true;
      events.emit("gymPuzzleSolved", { gymId: id });
      return { ok: true, solved: true, current, required, first };
    }
    return { ok: true, current, required, first };
  }

  /** [debug] reinicia el puzzle de un gimnasio no completado */
  resetPuzzle(id = "gym_verdant") {
    const st = this.ensure(id);
    st.puzzleSolved = false;
    st.puzzleAttempt = [];
    if (st.beacons) st.beacons = { north: false, east: false, west: false };
    if (st.energy) st.energy = { west: 0, east: 0, core: 0, pool: ENERGY_POOL };
  }

  /**
   * Distribución de energía: reservorio compartido de 3 cargas.
   * Conductos: oeste/este cap 1 (puertas de trainers), núcleo cap 2 (líder).
   * Asignar o recuperar una carga por interacción. Sin timing.
   */
  assignEnergy(id, conduitId) {
    const st = this.ensure(id);
    if (!st.energy) st.energy = { west: 0, east: 0, core: 0, pool: ENERGY_POOL };
    const cap = CONDUIT_CAPS[conduitId];
    if (cap == null) return { ok: false, error: "Conducto desconocido." };
    if (st.energy.pool <= 0) {
      return { ok: false, error: "No queda energía en el reservorio.", energy: { ...st.energy } };
    }
    if (st.energy[conduitId] >= cap) {
      return { ok: false, error: "Ese conducto ya está saturado.", energy: { ...st.energy } };
    }
    st.energy[conduitId] += 1;
    st.energy.pool -= 1;
    const current = st.energy.core;
    events.emit("gymPuzzleProgress", {
      gymId: id, current, required: CONDUIT_CAPS.core, reset: false, conduitId, energy: { ...st.energy },
    });
    if (st.energy.core >= CONDUIT_CAPS.core && !st.puzzleSolved) {
      st.puzzleSolved = true;
      events.emit("gymPuzzleSolved", { gymId: id });
      return { ok: true, solved: true, assigned: true, energy: { ...st.energy } };
    }
    return { ok: true, assigned: true, energy: { ...st.energy } };
  }

  recoverEnergy(id, conduitId) {
    const st = this.ensure(id);
    if (!st.energy) st.energy = { west: 0, east: 0, core: 0, pool: ENERGY_POOL };
    if (!(conduitId in CONDUIT_CAPS)) return { ok: false, error: "Conducto desconocido." };
    if (st.energy[conduitId] <= 0) {
      return { ok: false, error: "Ese conducto no tiene energía.", energy: { ...st.energy } };
    }
    st.energy[conduitId] -= 1;
    st.energy.pool += 1;
    events.emit("gymPuzzleProgress", {
      gymId: id, current: st.energy.core, required: CONDUIT_CAPS.core, reset: false,
      conduitId, recovered: true, energy: { ...st.energy },
    });
    return { ok: true, recovered: true, energy: { ...st.energy } };
  }

  conduitOpen(id, conduitId) {
    const st = this.ensure(id);
    const need = CONDUIT_CAPS[conduitId] ?? 1;
    return (st.energy?.[conduitId] ?? 0) >= need;
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
