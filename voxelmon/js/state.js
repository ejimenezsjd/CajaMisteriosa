/**
 * Estado persistente del jugador y de la partida: formato de guardado
 * versionado con migración segura desde saves antiguos.
 *
 * Regla: nunca se pierde una partida por añadir un campo nuevo. Cualquier
 * propiedad ausente en un save viejo se rellena con su valor por defecto.
 */

export const SAVE_VERSION = 2;
// Se conserva la clave original para que los saves previos sigan encontrándose.
export const SAVE_KEY = "voxelmon.save.v1";

export function defaultStats() {
  return {
    blocksMined: 0,
    blocksPlaced: 0,
    creaturesSeen: 0,
    creaturesCaught: 0,
    creaturesDefeated: 0,
    battlesWon: 0,
    battlesLost: 0,
    itemsCrafted: 0,
    distanceTraveled: 0,
    biomesDiscovered: {},
    // id de estructura → true (Fase 2; los saves previos lo reciben por fillDefaults)
    structuresDiscovered: {},
    // Fase 3 (también rellenados por fillDefaults en saves previos)
    npcsTalked: 0,
    questsCompleted: 0,
    tradesCompleted: 0,
    // Fase 4
    trainersDefeated: 0,
    trainerBattlesWon: 0,
    trainerBattlesLost: 0,
    // Fase 5
    gymsCompleted: 0,
    gymTrainersDefeated: 0,
    // Fase 6
    regionsDiscovered: 0,
    regionalStructuresDiscovered: 0,
    // Fase 7
    recipesCrafted: 0,
  };
}

export function defaultProgression() {
  return {
    unlocked: {},
    flags: {},
    badges: {},
  };
}

export function defaultState(seed) {
  return {
    version: SAVE_VERSION,
    seed,
    team: [],
    balls: 10,
    money: 0,
    inventory: {},
    dex: { seen: {}, caught: {} },
    edits: {},
    dayTime: 0.3,
    pos: null,
    legendarySpawned: false,
    victoryShown: false,
    stats: defaultStats(),
    progression: defaultProgression(),
    // Fase 3: misiones (questId → {progress:[...]} en active; sets en el resto)
    quests: { active: {}, completed: {}, available: {} },
    // Fase 4: entrenadores (trainerId → true al derrotarlos)
    trainers: { defeated: {} },
    // Fase 5: estado por gimnasio (puzzle, entrada, completado)
    gyms: {
      gym_verdant: { puzzleSolved: false, puzzleAttempt: [], completed: false, entered: false },
      gym_mist: {
        puzzleSolved: false,
        puzzleAttempt: [],
        beacons: { north: false, east: false, west: false },
        completed: false,
        entered: false,
      },
    },
    // Fase 6: descubrimiento de regiones y estado de la frontera
    regions: {
      discovered: {},
      gates: { region_2: { opened: false } },
    },
    // Fase 7–8: buffs temporales (kit) y gym_mist. SAVE_VERSION sigue en 2.
    buffs: { explorerUntil: 0 },
  };
}

/**
 * Rellena recursivamente en `target` las claves que falten respecto a
 * `defaults`, sin sobrescribir valores existentes.
 */
function fillDefaults(target, defaults) {
  for (const key in defaults) {
    const def = defaults[key];
    if (!(key in target) || target[key] === undefined) {
      target[key] = def;
    } else if (def && typeof def === "object" && !Array.isArray(def) &&
               target[key] && typeof target[key] === "object" && !Array.isArray(target[key])) {
      fillDefaults(target[key], def);
    }
  }
  return target;
}

/** Migra un save de cualquier versión anterior al formato actual. */
export function migrateSave(raw) {
  if (!raw || typeof raw !== "object") return null;
  const s = raw;

  // v1 (sin campo version): añade dinero, estadísticas y progresión.
  // Las versiones futuras encadenarán sus pasos aquí.
  if (!s.version || s.version < 2) {
    s.version = 2;
  }

  // Red de seguridad para cualquier versión: completa campos ausentes.
  fillDefaults(s, defaultState(s.seed ?? 0));
  return s;
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? migrateSave(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function persistSave(state) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch { /* almacenamiento lleno o bloqueado: se ignora */ }
}
