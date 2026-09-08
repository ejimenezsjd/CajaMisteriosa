/**
 * RegionSystem mínimo (Fases 6 y 9).
 *
 * BIOMA  → tipo de entorno local (plains, forest, mist_forest, crimson_highlands…)
 * REGIÓN → macrozona de progresión (region_1, region_2, region_3)
 *
 * Estrategia geométrica O(1):
 *   Se localiza el gimnasio más cercano en la celda actual y sus 8 vecinas
 *   (candidate("gym") ya está cacheado).
 *
 *   Región 2: rectángulo al sur (+Z) de ese gimnasio (z +58 … +220).
 *   Región 3: continuación al sur del Gimnasio de las Brumas, empezando
 *             DESPUÉS de Región 2 (z +221 … +442, anclada a gym2).
 *   El resto del mundo es region_1.
 *
 * No se altera terrainAt ni la clasificación base: los overlays de bioma
 * (mist_forest, crimson_highlands) solo se aplican dentro de su rectángulo.
 * Los saves antiguos siguen viendo el mismo mundo en Región 1 y 2.
 *
 * El lookup del gimnasio se inyecta con bindGymLookup para no crear un
 * ciclo regions ↔ structures ↔ world.
 */

import { events } from "./events.js";

export const REGION_1 = "region_1";
export const REGION_2 = "region_2";
export const REGION_3 = "region_3";

/** Offsets y tamaño de los corredores post-gimnasio (bloques). */
export const REGION_GEOMETRY = {
  gymCell: 260,
  halfW: 68,
  z0: 58,
  // +220: deja margen para el Gimnasio de las Brumas (dz 192, radio 16)
  // y su barrera sur (hook). No mueve gate/atalaya/puesto/refugio.
  z1: 220,
  gateZ: 52,
  watchtower: { dx: -24, dz: 100 },
  outpost: { dx: 22, dz: 155 },
  settlement: { dx: 6, dz: 122 },
  gymMist: { dx: 6, dz: 192 },
  // Región 3: gym2.x ± 80, z = gym1.z+221 … gym1.z+442
  // (= gym2.z+29 … gym2.z+250). Empieza 1 bloque después de R2.
  r3HalfW: 80,
  r3z0: 221,
  r3z1: 442,
  miningCamp: { dx: -12, dz: 272 },
  crimsonRuin: { dx: 30, dz: 362 },
  // Gym 3: al sur de la ruina, aún dentro de r3z1=442 (radio 16 → z≤428)
  gymCrimson: { dx: 38, dz: 412 },
};

export const REGIONS = {
  [REGION_1]: {
    id: REGION_1,
    name: "Valle Inicial",
    shortName: "Valle",
  },
  [REGION_2]: {
    id: REGION_2,
    name: "Tierras Brumosas",
    shortName: "Bruma",
    gateId: "region_2",
  },
  [REGION_3]: {
    id: REGION_3,
    name: "Cumbres Carmesí",
    shortName: "Carmesí",
    gateId: "region_3",
  },
};

const NEIGHBORS = [
  [0, 0], [1, 0], [-1, 0], [0, 1], [0, -1],
  [1, 1], [1, -1], [-1, 1], [-1, -1],
];

let _gymCandidate = null;

/** Inyecta StructureIndex.candidate. Llamar desde World tras crear el índice. */
export function bindGymLookup(fn) {
  _gymCandidate = fn;
}

export function getRegionDefinition(id) {
  return REGIONS[id] ?? REGIONS[REGION_1];
}

export function getRegionName(id) {
  return getRegionDefinition(id).name;
}

export function region2BoundsFor(gym) {
  const g = REGION_GEOMETRY;
  return {
    x0: gym.x - g.halfW,
    x1: gym.x + g.halfW,
    z0: gym.z + g.z0,
    z1: gym.z + g.z1,
    gateX: gym.x,
    gateZ: gym.z + g.gateZ,
    gym,
  };
}

export function region3BoundsFor(gym) {
  const g = REGION_GEOMETRY;
  const gx = gym.x + g.gymMist.dx;
  const gz = gym.z + g.gymMist.dz;
  return {
    x0: gx - g.r3HalfW,
    x1: gx + g.r3HalfW,
    z0: gym.z + g.r3z0,
    z1: gym.z + g.r3z1,
    gym,
    gym2: { x: gx, z: gz },
  };
}

/** Gimnasio más cercano en la vecindad de celdas 3×3. O(1) con caché. */
export function nearestGymAnchor(x, z) {
  if (!_gymCandidate) return null;
  const cs = REGION_GEOMETRY.gymCell;
  const cx = Math.floor(x / cs);
  const cz = Math.floor(z / cs);
  let best = null;
  let bestD = Infinity;
  for (const [dx, dz] of NEIGHBORS) {
    const c = _gymCandidate("gym", cx + dx, cz + dz);
    if (!c) continue;
    const d = (c.x - x) * (c.x - x) + (c.z - z) * (c.z - z);
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best;
}

/** Región lógica en (x, z). Coste constante: 9 lookups cacheados. */
export function getRegionAt(x, z) {
  const gym = nearestGymAnchor(x, z);
  if (!gym) return REGION_1;
  const b3 = region3BoundsFor(gym);
  if (x >= b3.x0 && x <= b3.x1 && z >= b3.z0 && z <= b3.z1) return REGION_3;
  const b2 = region2BoundsFor(gym);
  if (x >= b2.x0 && x <= b2.x1 && z >= b2.z0 && z <= b2.z1) return REGION_2;
  return REGION_1;
}

export function isInRegion2(x, z) {
  return getRegionAt(x, z) === REGION_2;
}

export function isInRegion3(x, z) {
  return getRegionAt(x, z) === REGION_3;
}

class RegionSystem {
  constructor() {
    this.s = null;
  }

  attach(state) {
    this.s = state.regions;
    // La región de partida cuenta como conocida (sin toast).
    if (this.s && !this.s.discovered[REGION_1]) {
      this.s.discovered[REGION_1] = true;
    }
  }

  isDiscovered(id) {
    return !!this.s?.discovered[id];
  }

  discover(id, x, z) {
    if (!this.s || !REGIONS[id] || this.s.discovered[id]) return false;
    this.s.discovered[id] = true;
    const def = REGIONS[id];
    events.emit("regionDiscovered", {
      regionId: id,
      regionName: def.name,
      x,
      z,
    });
    return true;
  }

  isGateOpened(id = REGION_2) {
    return !!this.s?.gates[id]?.opened;
  }

  /** Abre la frontera. Idempotente: una vez abierta no se vuelve a cerrar. */
  openGate(id = REGION_2, pos = {}) {
    if (!this.s) return false;
    if (!this.s.gates[id]) this.s.gates[id] = { opened: false };
    if (this.s.gates[id].opened) return false;
    this.s.gates[id].opened = true;
    const def = REGIONS[id];
    events.emit("regionGateOpened", {
      regionId: id,
      regionName: def?.name ?? id,
      x: pos.x ?? 0,
      z: pos.z ?? 0,
    });
    return true;
  }

  snapshot() {
    return {
      at: null,
      discovered: { ...(this.s?.discovered ?? {}) },
      gates: JSON.parse(JSON.stringify(this.s?.gates ?? {})),
    };
  }
}

export const regions = new RegionSystem();
