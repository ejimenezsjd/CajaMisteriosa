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
/** Copia de la campaña anterior (nueva partida / borrar). No se pisa en el autoguardado. */
export const SAVE_BACKUP_KEY = "voxelmon.save.v1.bak";

export function defaultStats() {
  return {
    blocksMined: 0,
    blocksPlaced: 0,
    creaturesSeen: 0,
    creaturesCaught: 0,
    uniqueSpeciesSeen: 0,
    uniqueSpeciesCaught: 0,
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
    // Fase 9
    moneySpent: 0,
    moneyEarnedFromSales: 0,
    itemsPurchased: 0,
    itemsSold: 0,
    // Fase 10
    bossesDefeated: 0,
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
    invNorm: 0,
    creatureStorage: { creatures: [] },
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
      gym_crimson: {
        puzzleSolved: false,
        puzzleAttempt: [],
        energy: { west: 0, east: 0, core: 0, pool: 3 },
        completed: false,
        entered: false,
      },
      gym_gale: {
        puzzleSolved: false,
        puzzleAttempt: [],
        channels: { north: false, east: false, west: false },
        completed: false,
        entered: false,
      },
    },
    // Fase 10–12: jefes regionales y sellos (fillDefaults cubre saves previos)
    bosses: {
      crimson_guardian: { defeated: false },
      tempest_guardian: { defeated: false },
    },
    seals: {
      crimson_ruin: { activated: false },
      storm_observatory: { activated: false },
    },
    // Fase 6: descubrimiento de regiones y estado de la frontera
    regions: {
      discovered: {},
      gates: {
        region_2: { opened: false },
        region_3: { opened: false },
        region_4: { opened: false },
      },
      home: null,
    },
    // Fase 7–8: buffs temporales (kit) y gym_mist. SAVE_VERSION sigue en 2.
    buffs: { explorerUntil: 0 },
    // Fase 12.5: inventario normalizado y PC. SAVE_VERSION sigue en 2.
    // Fase 11: mapa (celdas sparse + markers). Pan/zoom no se persisten.
    map: {
      discoveredCells: {},
      markers: {},
      waypoint: null,
    },
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

export function rawSave(key = SAVE_KEY) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Hay bytes de partida (activa o copia). No parsea: sirve para mostrar Continuar. */
export function hasPersistedSave() {
  return !!(rawSave(SAVE_KEY) || rawSave(SAVE_BACKUP_KEY));
}

/** Hay una copia distinta de la partida activa (se puede recuperar). */
export function hasRecoverableBackup() {
  const cur = rawSave(SAVE_KEY);
  const bak = rawSave(SAVE_BACKUP_KEY);
  return !!(bak && bak !== cur);
}

function parseSave(raw) {
  if (!raw) return null;
  try {
    return migrateSave(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function loadSave() {
  const primary = parseSave(rawSave(SAVE_KEY));
  if (primary) return primary;
  const backup = parseSave(rawSave(SAVE_BACKUP_KEY));
  if (backup) {
    // La activa se perdió o está corrupta: restaura la copia para que Continuar funcione.
    try { localStorage.setItem(SAVE_KEY, rawSave(SAVE_BACKUP_KEY)); } catch { /* ignore */ }
    return backup;
  }
  return null;
}

/** Guarda la partida activa en la copia de seguridad (antes de nueva partida / borrar). */
export function snapshotSaveToBackup() {
  const cur = rawSave(SAVE_KEY);
  if (!cur) return false;
  try {
    localStorage.setItem(SAVE_BACKUP_KEY, cur);
    return true;
  } catch {
    return false;
  }
}

/** Restaura la copia de seguridad como partida activa. */
export function restoreBackupSave() {
  const bak = rawSave(SAVE_BACKUP_KEY);
  if (!bak) return null;
  try {
    localStorage.setItem(SAVE_KEY, bak);
  } catch { /* ignore */ }
  return parseSave(bak);
}

export function persistSave(state) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch { /* almacenamiento lleno o bloqueado: se ignora */ }
}
