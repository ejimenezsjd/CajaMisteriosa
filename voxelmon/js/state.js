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
