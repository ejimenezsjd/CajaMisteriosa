/**
 * RegionSystem mínimo (Fases 6, 9 y 11).
 *
 * BIOMA  → tipo de entorno local (plains, forest, mist_forest, crimson_highlands, wind_highlands…)
 * REGIÓN → macrozona de progresión (region_1 … region_4)
 *
 * Estrategia geométrica O(1):
 *   Se localiza el gimnasio más cercano en la celda actual y sus 8 vecinas
 *   (candidate("gym") ya está cacheado).
 *
 *   Región 2: rectángulo al sur (+Z) de ese gimnasio (z +58 … +220).
 *   Región 3: continuación al sur del Gimnasio de las Brumas, empezando
 *             DESPUÉS de Región 2 (z +221 … +442, anclada a gym2).
 *   Región 4: continuación al sur de crimson_pass / Gym 3, empezando
 *             DESPUÉS de Región 3 (z +443 … +693, anclada a gym3).
 *             No solapa R3: el paso (gym3.z+15 = gym1.z+427) sigue en R3.
 *   El resto del mundo es region_1.
 *
 * No se altera terrainAt ni la clasificación base de R1–R3: los overlays
 * de bioma solo se aplican dentro de su rectángulo. La altura extra de R4
 * es un bonus de columna (region4HeightBonus) usado en generateChunkData,
 * no un cambio de terrainAt, así R1/R2/R3 permanecen bit-idénticos.
 *
 * El lookup del gimnasio se inyecta con bindGymLookup para no crear un
 * ciclo regions ↔ structures ↔ world.
 */

import { events } from "./events.js";
import { fbm2 } from "./noise.js";

export const REGION_1 = "region_1";
export const REGION_2 = "region_2";
export const REGION_3 = "region_3";
export const REGION_4 = "region_4";

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
  // Región 4: gym3.x ± 110, z = gym1.z+443 … gym1.z+693.
  // Empieza 1 bloque después de R3 para no recolorear el tramo final
  // del Paso Carmesí (gym1.z+427) ni el último anillo de R3.
  r4HalfW: 110,
  r4z0: 443,
  r4z1: 693,
  // Offset desde el centro de Gym 3 hasta un punto ya dentro de R4.
  r4EntranceDz: 39,
  windShrine: { dx: 18, dz: 470 },
  cliffOutpost: { dx: 38, dz: 520 },
  stormObservatory: { dx: 58, dz: 650 },
  windLiftA: { dx: 82, dz: 560 },
  windLiftB: { dx: -8, dz: 610 },
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
  [REGION_4]: {
    id: REGION_4,
    name: "Altos del Vendaval",
    shortName: "Vendaval",
    gateId: "region_4",
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

export function region4BoundsFor(gym) {
  const g = REGION_GEOMETRY;
  const gx = gym.x + g.gymCrimson.dx;
  const gz = gym.z + g.gymCrimson.dz;
  return {
    x0: gx - g.r4HalfW,
    x1: gx + g.r4HalfW,
    z0: gym.z + g.r4z0,
    z1: gym.z + g.r4z1,
    gym,
    gym3: { x: gx, z: gz },
    entranceZ: gz + (g.r4z0 - g.gymCrimson.dz) + 8,
  };
}

function smoothstep(a, b, x) {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/**
 * Extra de altura solo en Región 4. No entra en terrainAt, así las
 * columnas de R1–R3 no cambian. generateChunkData y las estructuras
 * regionales de R4 suman este bonus sobre t.h.
 */
export function region4HeightBonus(x, z, seed = 0) {
  const plateau = smoothstep(0.28, 0.78, fbm2(x * 0.016, z * 0.016, seed + 91001, 4));
  const ridge = smoothstep(0.4, 0.82, fbm2(x * 0.01, z * 0.028, seed + 91003, 3));
  const spire = smoothstep(0.7, 0.92, fbm2(x * 0.045 + 40, z * 0.045 - 20, seed + 91002, 3));
  return Math.floor(5 + plateau * 9 + ridge * 5 + spire * 7);
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
  const b4 = region4BoundsFor(gym);
  if (x >= b4.x0 && x <= b4.x1 && z >= b4.z0 && z <= b4.z1) return REGION_4;
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

export function isInRegion4(x, z) {
  return getRegionAt(x, z) === REGION_4;
}

/** Destino de una región: el gateId que hay que abrir para entrar. */
export function gateIdForRegion(regionId) {
  return REGIONS[regionId]?.gateId ?? null;
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
