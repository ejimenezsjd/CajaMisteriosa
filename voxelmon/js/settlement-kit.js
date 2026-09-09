/**
 * Kit reutilizable de asentamiento (Fase 13).
 *
 * Huellas, props y tramos de camino data-driven. No es un city generator:
 * las ciudades concretas (Puerto Azur, futuras) declaran layout + props.
 * Los microprops NUNCA se registran como structures globales.
 */

import { B } from "./blocks.js";

/** Rellena suelo desde el terreno real hasta la cota y. */
export function fillFloor(stamp, ground, x, y, z, dx, dz, block) {
  const g = ground(dx, dz);
  for (let yy = Math.min(g, y); yy <= y; yy++) stamp(x + dx, yy, z + dz, block);
}

export function clearAir(stamp, x, y, z, radius, height) {
  for (let dx = -radius; dx <= radius; dx++) {
    for (let dz = -radius; dz <= radius; dz++) {
      for (let dy = 1; dy <= height; dy++) stamp(x + dx, y + dy, z + dz, B.AIR);
    }
  }
}

/**
 * Cabaña hueca con puerta 1×2. Semiabierta: tejado perimetral opcional.
 * doorSide = [-1|1, 0] o [0, -1|1].
 */
export function stampBuilding(stamp, ground, x, y, z, cx, cz, half, opts = {}) {
  const wall = opts.wall ?? B.WOOD;
  const roof = opts.roof ?? B.WOOD;
  const floor = opts.floor ?? B.STONE;
  const door = opts.door ?? [0, 1];
  const wallH = opts.wallH ?? 3;
  const openRoof = opts.openRoof !== false;
  for (let dx = -half; dx <= half; dx++) {
    for (let dz = -half; dz <= half; dz++) {
      const wx = cx + dx;
      const wz = cz + dz;
      fillFloor(stamp, ground, x, y, z, wx, wz, floor);
      const isWall = Math.abs(dx) === half || Math.abs(dz) === half;
      if (isWall) {
        const isDoor = dx === door[0] * half && dz === door[1] * half &&
          (door[0] === 0 ? dx === 0 : dz === 0);
        for (let dy = 1; dy <= wallH; dy++) {
          if (isDoor && dy <= 2) continue;
          stamp(x + wx, y + dy, z + wz, wall);
        }
      }
      const rim = Math.abs(dx) === half || Math.abs(dz) === half;
      if (!openRoof || rim) {
        stamp(x + wx, y + wallH + 1, z + wz, roof);
      }
    }
  }
}

/** Tramo de camino local (dx0,dz0)→(dx1,dz1) de ancho `width`. */
export function stampRoadSegment(stamp, ground, x, y, z, a, b, width, block) {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const len = Math.max(1, Math.hypot(dx, dz));
  const steps = Math.ceil(len) + 1;
  const nx = -dz / len;
  const nz = dx / len;
  const half = Math.max(0, (width - 1) / 2);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const px = a[0] + dx * t;
    const pz = a[1] + dz * t;
    for (let w = -half; w <= half; w += 0.5) {
      const lx = Math.round(px + nx * w);
      const lz = Math.round(pz + nz * w);
      fillFloor(stamp, ground, x, y, z, lx, lz, block);
    }
  }
}

export const STRUCTURE_PROP_DEFS = {
  crate: {
    id: "crate",
    stamp(stamp, x, y, z, dx, dz) {
      stamp(x + dx, y + 1, z + dz, B.WOOD);
    },
  },
  barrel: {
    id: "barrel",
    stamp(stamp, x, y, z, dx, dz) {
      stamp(x + dx, y + 1, z + dz, B.WOOD);
      stamp(x + dx, y + 2, z + dz, B.SAND);
    },
  },
  lantern: {
    id: "lantern",
    stamp(stamp, x, y, z, dx, dz) {
      stamp(x + dx, y + 1, z + dz, B.WOOD);
      stamp(x + dx, y + 2, z + dz, B.CRYSTAL);
    },
  },
  bench: {
    id: "bench",
    stamp(stamp, x, y, z, dx, dz) {
      stamp(x + dx, y + 1, z + dz, B.WOOD);
      stamp(x + dx + 1, y + 1, z + dz, B.WOOD);
    },
  },
  net: {
    id: "net",
    stamp(stamp, x, y, z, dx, dz) {
      stamp(x + dx, y + 1, z + dz, B.WOOD);
      stamp(x + dx, y + 2, z + dz, B.LEAVES);
    },
  },
  buoy: {
    id: "buoy",
    stamp(stamp, x, y, z, dx, dz) {
      stamp(x + dx, y + 1, z + dz, B.WOOD);
      stamp(x + dx, y + 2, z + dz, B.CRYSTAL);
    },
  },
  post: {
    id: "post",
    stamp(stamp, x, y, z, dx, dz) {
      stamp(x + dx, y + 1, z + dz, B.WOOD);
      stamp(x + dx, y + 2, z + dz, B.WOOD);
    },
  },
  planter: {
    id: "planter",
    stamp(stamp, x, y, z, dx, dz) {
      stamp(x + dx, y + 1, z + dz, B.DIRT);
      stamp(x + dx, y + 2, z + dz, B.LEAVES);
    },
  },
  fence: {
    id: "fence",
    stamp(stamp, x, y, z, dx, dz) {
      stamp(x + dx, y + 1, z + dz, B.WOOD);
    },
  },
  signpost: {
    id: "signpost",
    stamp(stamp, x, y, z, dx, dz) {
      stamp(x + dx, y + 1, z + dz, B.WOOD);
      stamp(x + dx, y + 2, z + dz, B.WOOD);
    },
  },
  boat: {
    id: "boat",
    stamp(stamp, x, y, z, dx, dz) {
      for (let ox = -1; ox <= 2; ox++) {
        stamp(x + dx + ox, y + 1, z + dz, B.WOOD);
      }
      stamp(x + dx, y + 1, z + dz - 1, B.WOOD);
      stamp(x + dx + 1, y + 1, z + dz - 1, B.WOOD);
      stamp(x + dx + 1, y + 2, z + dz, B.WOOD);
    },
  },
};

export function stampProp(stamp, x, y, z, kind, dx, dz) {
  STRUCTURE_PROP_DEFS[kind]?.stamp(stamp, x, y, z, dx, dz);
}

export function stampProps(stamp, x, y, z, list) {
  for (const p of list) stampProp(stamp, x, y, z, p.kind, p.dx, p.dz);
}

/** Pasarela de madera sobre agua (muelle / boardwalk). */
export function stampBoardwalk(stamp, ground, x, y, z, from, to, width = 2) {
  stampRoadSegment(stamp, ground, x, y, z, from, to, width, B.WOOD);
  const dx = to[0] - from[0];
  const dz = to[1] - from[1];
  const len = Math.max(1, Math.hypot(dx, dz));
  const steps = Math.ceil(len);
  for (let i = 0; i <= steps; i += 3) {
    const t = i / steps;
    stamp(x + Math.round(from[0] + dx * t), y + 1, z + Math.round(from[1] + dz * t), B.WOOD);
  }
}

/** Arco de ruta: dos pilares y dintel. */
export function stampRouteArch(stamp, ground, x, y, z, dx, dz, facingZ = 1) {
  fillFloor(stamp, ground, x, y, z, dx - 2, dz, B.STONE);
  fillFloor(stamp, ground, x, y, z, dx + 2, dz, B.STONE);
  for (let dy = 1; dy <= 4; dy++) {
    stamp(x + dx - 2, y + dy, z + dz, B.STONE);
    stamp(x + dx + 2, y + dy, z + dz, B.STONE);
  }
  stamp(x + dx - 1, y + 4, z + dz, B.STONE);
  stamp(x + dx, y + 4, z + dz, B.STONE);
  stamp(x + dx + 1, y + 4, z + dz, B.STONE);
  stamp(x + dx, y + 5, z + dz, B.CRYSTAL);
  stamp(x + dx, y + 1, z + dz + facingZ, B.WOOD);
}

/** Barca decorativa estática (no montable). */
export function stampMooredBoat(stamp, x, y, z, dx, dz) {
  STRUCTURE_PROP_DEFS.boat.stamp(stamp, x, y, z, dx, dz);
}
