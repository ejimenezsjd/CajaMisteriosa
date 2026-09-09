/**
 * Rutas nombradas y corredores de camino (Fase 13).
 *
 * Metadata ligera: id, nombre, origen/destino, puntos de control, dificultad.
 * Los senderos se estampan de forma determinista por chunk (AABB vs corridor),
 * sin scans globales. Curvas vía Bézier encadenada; ancho 2–4.
 */

import { B } from "./blocks.js";
import { REGION_GEOMETRY, regions } from "./regions.js";

/** Igual que WATER_Y en world.js. No importar world (ciclo routes ↔ world). */
const WATER_SURFACE = 12;

export const ROUTES = {
  azure_route_1: {
    id: "azure_route_1",
    name: "Camino del Acantilado",
    regionId: "region_5",
    from: "highland_exit",
    to: "azure_port",
    difficulty: 5,
    width: 3,
    block: "packed_sand",
    landmarks: ["coastal_gate", "azure_port"],
    // Offsets desde el gimnasio de origen (misma convención que REGION_GEOMETRY).
    controls: [
      { dx: 97, dz: 686 },
      { dx: 104, dz: 702 },
      { dx: 92, dz: 718 },
      { dx: 86, dz: 744 },
      { dx: 90, dz: 768 },
    ],
  },
  azure_route_2: {
    id: "azure_route_2",
    name: "Sendero de las Mareas",
    regionId: "region_5",
    from: "azure_port",
    to: "tidal_ruins",
    difficulty: 5,
    width: 3,
    block: "wood",
    landmarks: ["azure_bridge", "tidal_ruins"],
    controls: [
      { dx: 90, dz: 792 },
      { dx: 72, dz: 808 },
      { dx: 50, dz: 828 },
      { dx: 32, dz: 848 },
      { dx: 18, dz: 864 },
    ],
  },
  azure_route_3: {
    id: "azure_route_3",
    name: "Camino del Faro",
    regionId: "region_5",
    from: "tidal_ruins",
    to: "azure_lighthouse",
    difficulty: 5,
    width: 3,
    block: "packed_sand",
    landmarks: ["broken_span", "azure_lighthouse"],
    controls: [
      { dx: 22, dz: 872 },
      { dx: 48, dz: 888 },
      { dx: 88, dz: 902 },
      { dx: 122, dz: 916 },
      { dx: 146, dz: 926 },
    ],
  },
};

export const ROUTE_SIGNS = [
  {
    id: "sign_cliff_south",
    routeId: "azure_route_1",
    localFrom: "coastal_gate",
    offset: [0, 2],
    text: "Puerto Azur →\nAltos del Vendaval ←",
  },
  {
    id: "sign_port_north",
    routeId: "azure_route_1",
    localFrom: "azure_port",
    offset: [0, -10],
    text: "Altos del Vendaval ←\nPuerto Azur · plaza",
  },
  {
    id: "sign_port_west",
    routeId: "azure_route_2",
    localFrom: "azure_port",
    offset: [-8, 8],
    text: "Ruinas de Marea ↑\nSendero de las Mareas",
  },
  {
    id: "sign_bridge",
    routeId: "azure_route_2",
    localFrom: "azure_bridge",
    offset: [0, -2],
    text: "Puerto Azur ←\nRuinas de Marea →",
  },
  {
    id: "sign_ruins",
    routeId: "azure_route_3",
    localFrom: "tidal_ruins",
    offset: [6, 0],
    text: "Faro Azur →\nCamino del Faro",
  },
  {
    id: "sign_lighthouse",
    routeId: "azure_route_3",
    localFrom: "azure_lighthouse",
    offset: [-8, 4],
    text: "Ruinas de Marea ←\nFaro Azur",
  },
];

const PATH_BLOCKS = {
  packed_sand: B.PACKED_SAND,
  wood: B.WOOD,
  stone: B.STONE,
  sand: B.SAND,
};

export function pathBlockId(name) {
  return PATH_BLOCKS[name] ?? B.PACKED_SAND;
}

export function isPathBlock(id) {
  return id === B.PACKED_SAND || id === B.WOOD;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function quad(p0, p1, p2, t) {
  const u = 1 - t;
  return {
    x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x,
    z: u * u * p0.z + 2 * u * t * p1.z + t * t * p2.z,
  };
}

function worldPoint(gym, p) {
  return { x: gym.x + p.dx, z: gym.z + p.dz };
}

function corridorBounds(gym, route) {
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  const pad = (route.width ?? 3) + 2;
  for (const p of route.controls) {
    const wx = gym.x + p.dx;
    const wz = gym.z + p.dz;
    if (wx < x0) x0 = wx;
    if (wz < z0) z0 = wz;
    if (wx > x1) x1 = wx;
    if (wz > z1) z1 = wz;
  }
  return { x0: x0 - pad, z0: z0 - pad, x1: x1 + pad, z1: z1 + pad };
}

function chunkHits(b, x0, z0, size) {
  const x1 = x0 + size - 1;
  const z1 = z0 + size - 1;
  return !(x1 < b.x0 || x0 > b.x1 || z1 < b.z0 || z0 > b.z1);
}

/**
 * Estampa los corredores de R5 que tocan este chunk.
 * `stamp(wx, wy, wz, block)` escribe en generateChunkData.
 */
let _stamping = false;

export function stampRegionalPaths(world, x0, z0, size, stamp) {
  if (_stamping) return;
  _stamping = true;
  try {
    stampRegionalPathsInner(world, x0, z0, size, stamp);
  } finally {
    _stamping = false;
  }
}

function stampRegionalPathsInner(world, x0, z0, size, stamp) {
  const gym = regions.homeGym();
  if (!gym) return;
  const g = REGION_GEOMETRY;
  const r5z0 = gym.z + g.r5z0;
  const r5z1 = gym.z + g.r5z1;
  // Un poco de R4 junto al arco para el descenso.
  if (z0 + size < gym.z + g.highlandExit.dz - 4 || z0 > r5z1 + 4) return;
  if (x0 + size < gym.x + g.highlandExit.dx - g.r5HalfW - 8 ||
      x0 > gym.x + g.highlandExit.dx + g.r5HalfW + 8) return;

  for (const route of Object.values(ROUTES)) {
    const bb = corridorBounds(gym, route);
    if (!chunkHits(bb, x0, z0, size)) continue;
    stampRoute(world, gym, route, x0, z0, size, stamp);
  }
}

function stampRoute(world, gym, route, x0, z0, size, stamp) {
  const pts = route.controls.map((p) => worldPoint(gym, p));
  if (pts.length < 2) return;
  const block = pathBlockId(route.block);
  const width = route.width ?? 3;
  const half = (width - 1) / 2;
  const x1 = x0 + size - 1;
  const z1 = z0 + size - 1;

  const segs = [];
  if (pts.length === 2) {
    segs.push([pts[0], {
      x: lerp(pts[0].x, pts[1].x, 0.5) + 4,
      z: lerp(pts[0].z, pts[1].z, 0.5),
    }, pts[1]]);
  } else {
    for (let i = 0; i < pts.length - 2; i += 2) {
      const a = pts[i];
      const b = pts[i + 1];
      const c = pts[Math.min(i + 2, pts.length - 1)];
      segs.push([a, b, c]);
    }
    if (pts.length % 2 === 0) {
      const a = pts[pts.length - 2];
      const c = pts[pts.length - 1];
      segs.push([a, {
        x: lerp(a.x, c.x, 0.5) + (iOddJitter(a, c)),
        z: lerp(a.z, c.z, 0.5),
      }, c]);
    }
  }

  for (const [a, b, c] of segs) {
    const dist = Math.hypot(c.x - a.x, c.z - a.z) + Math.hypot(b.x - a.x, b.z - a.z) * 0.5;
    const steps = Math.max(8, Math.ceil(dist));
    for (let i = 0; i <= steps; i++) {
      const p = quad(a, b, c, i / steps);
      for (let ox = -half; ox <= half; ox++) {
        for (let oz = -half; oz <= half; oz++) {
          if (Math.hypot(ox, oz) > half + 0.2) continue;
          const wx = Math.round(p.x + ox);
          const wz = Math.round(p.z + oz);
          if (wx < x0 || wx > x1 || wz < z0 || wz > z1) continue;
          const h = world.columnHeight ? world.columnHeight(wx, wz) : world.terrainAt(wx, wz).h;
          const y = Math.max(h, 1);
          stamp(wx, y, wz, block);
          // No llamar world.getBlock aquí: dispara ensureChunkData → generateChunkData
          // → stampRegionalPaths (stack overflow). Si la columna está bajo el agua,
          // se abre un hueco de aire sobre el sendero con el stamp del chunk actual.
          if (h <= WATER_SURFACE) {
            stamp(wx, y + 1, wz, B.AIR);
          }
        }
      }
    }
  }
}

function iOddJitter(a, c) {
  return ((Math.round(a.x + c.z) & 1) ? 5 : -5);
}

/** Pozas de agua deterministas en las anclas de corriente (sin getBlock). */
export function stampAzureCurrents(world, x0, z0, size, stamp) {
  const gym = regions.homeGym();
  if (!gym) return;
  const g = REGION_GEOMETRY;
  const pts = [g.currentA, g.currentB, g.currentC];
  const x1 = x0 + size - 1;
  const z1 = z0 + size - 1;
  for (const p of pts) {
    const cx = gym.x + p.dx;
    const cz = gym.z + p.dz;
    if (cx + 4 < x0 || cx - 4 > x1 || cz + 4 < z0 || cz - 4 > z1) continue;
    for (let dx = -3; dx <= 3; dx++) {
      for (let dz = -3; dz <= 3; dz++) {
        if (Math.hypot(dx, dz) > 3.5) continue;
        const wx = cx + dx;
        const wz = cz + dz;
        if (wx < x0 || wx > x1 || wz < z0 || wz > z1) continue;
        stamp(wx, WATER_SURFACE - 1, wz, B.SAND);
        stamp(wx, WATER_SURFACE, wz, B.WATER);
        stamp(wx, WATER_SURFACE + 1, wz, B.AIR);
      }
    }
  }
}

export function routeSnapshot() {
  return Object.values(ROUTES).map((r) => ({
    id: r.id,
    name: r.name,
    from: r.from,
    to: r.to,
    difficulty: r.difficulty,
    landmarks: [...(r.landmarks ?? [])],
    controls: r.controls.length,
    width: r.width,
  }));
}
