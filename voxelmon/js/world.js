/**
 * Mundo vóxel infinito por chunks: generación procedural (biomas, lagos,
 * montañas, árboles), meshing con culling de caras y colores por vértice,
 * edición de bloques con persistencia y raycast DDA.
 */

import * as THREE from "three";
import { fbm2, columnHash } from "./noise.js";

export const CHUNK = 16;
export const HEIGHT = 64;
export const WATER_Y = 12;

export const B = {
  AIR: 0,
  GRASS: 1,
  DIRT: 2,
  STONE: 3,
  SAND: 4,
  WATER: 5,
  WOOD: 6,
  LEAVES: 7,
  SNOW: 8,
  BEDROCK: 9,
};

export const BLOCK_NAMES = {
  [B.GRASS]: "Hierba",
  [B.DIRT]: "Tierra",
  [B.STONE]: "Piedra",
  [B.SAND]: "Arena",
  [B.WOOD]: "Madera",
  [B.LEAVES]: "Hojas",
  [B.SNOW]: "Nieve",
};

/** Qué suelta cada bloque al minarlo */
export const BLOCK_DROPS = {
  [B.GRASS]: B.DIRT,
  [B.DIRT]: B.DIRT,
  [B.STONE]: B.STONE,
  [B.SAND]: B.SAND,
  [B.WOOD]: B.WOOD,
  [B.LEAVES]: B.LEAVES,
  [B.SNOW]: B.SNOW,
};

const COLORS = {
  [B.GRASS]: { top: [0.42, 0.72, 0.29], side: [0.48, 0.4, 0.25], bottom: [0.48, 0.37, 0.23] },
  [B.DIRT]: { top: [0.54, 0.4, 0.26], side: [0.54, 0.4, 0.26], bottom: [0.5, 0.37, 0.24] },
  [B.STONE]: { top: [0.56, 0.56, 0.59], side: [0.55, 0.55, 0.58], bottom: [0.5, 0.5, 0.53] },
  [B.SAND]: { top: [0.89, 0.82, 0.58], side: [0.86, 0.79, 0.55], bottom: [0.82, 0.75, 0.52] },
  [B.WATER]: { top: [0.25, 0.46, 0.9], side: [0.23, 0.43, 0.85], bottom: [0.2, 0.4, 0.8] },
  [B.WOOD]: { top: [0.62, 0.47, 0.26], side: [0.49, 0.35, 0.19], bottom: [0.62, 0.47, 0.26] },
  [B.LEAVES]: { top: [0.28, 0.63, 0.24], side: [0.26, 0.58, 0.22], bottom: [0.22, 0.5, 0.19] },
  [B.SNOW]: { top: [0.93, 0.95, 0.97], side: [0.88, 0.91, 0.94], bottom: [0.82, 0.85, 0.9] },
  [B.BEDROCK]: { top: [0.22, 0.22, 0.24], side: [0.22, 0.22, 0.24], bottom: [0.22, 0.22, 0.24] },
};

// [dx,dy,dz, sombreado, 4 vértices de la cara]
const FACES = [
  { dir: [1, 0, 0], shade: 0.8, corners: [[1, 1, 0], [1, 0, 0], [1, 1, 1], [1, 0, 1]] },
  { dir: [-1, 0, 0], shade: 0.8, corners: [[0, 1, 1], [0, 0, 1], [0, 1, 0], [0, 0, 0]] },
  { dir: [0, 1, 0], shade: 1.0, corners: [[0, 1, 1], [1, 1, 1], [0, 1, 0], [1, 1, 0]] },
  { dir: [0, -1, 0], shade: 0.5, corners: [[0, 0, 0], [1, 0, 0], [0, 0, 1], [1, 0, 1]] },
  { dir: [0, 0, 1], shade: 0.7, corners: [[1, 1, 1], [1, 0, 1], [0, 1, 1], [0, 0, 1]] },
  { dir: [0, 0, -1], shade: 0.7, corners: [[0, 1, 0], [0, 0, 0], [1, 1, 0], [1, 0, 0]] },
];

const idx = (x, y, z) => x + z * CHUNK + y * CHUNK * CHUNK;
const chunkKey = (cx, cz) => `${cx},${cz}`;

export class World {
  constructor(scene, seed, edits = {}) {
    this.scene = scene;
    this.seed = seed >>> 0;
    this.chunks = new Map();
    /** Bloques modificados por el jugador: "x,y,z" -> id */
    this.edits = { ...edits };
    this.meshQueue = [];
    this.solidMat = new THREE.MeshLambertMaterial({ vertexColors: true });
    this.waterMat = new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: 0.7, side: THREE.DoubleSide });
    this.viewRadius = 6;
  }

  // ---------- Generación ----------

  terrainAt(x, z) {
    const s = this.seed;
    const mBio = fbm2(x * 0.004, z * 0.004, s + 7700, 3);
    const mountain = smoothstep(0.55, 0.78, mBio);
    const desert = mountain < 0.3 && fbm2(x * 0.003 + 500, z * 0.003 - 500, s + 1230, 3) > 0.63;
    const forest = fbm2(x * 0.006 - 900, z * 0.006 + 900, s + 4110, 3);
    let h = 10 + fbm2(x * 0.012, z * 0.012, s, 4) * 12;
    h += mountain * fbm2(x * 0.02, z * 0.02, s + 310, 4) * 30;
    h = Math.min(HEIGHT - 6, Math.floor(h));
    return { h, mountain, desert, treeDensity: desert ? 0 : 0.015 + smoothstep(0.5, 0.75, forest) * 0.075 };
  }

  hasTreeAt(x, z) {
    const t = this.terrainAt(x, z);
    if (t.h <= WATER_Y + 1 || t.mountain > 0.6) return null;
    if (columnHash(x, z, this.seed + 999) >= t.treeDensity) return null;
    // Evita árboles pegados
    if (columnHash(x - 1, z, this.seed + 999) < this.terrainAt(x - 1, z).treeDensity) return null;
    if (columnHash(x, z - 1, this.seed + 999) < this.terrainAt(x, z - 1).treeDensity) return null;
    const th = 4 + Math.floor(columnHash(x, z, this.seed + 555) * 2);
    return { h: t.h, trunk: th };
  }

  generateChunkData(cx, cz) {
    const data = new Uint8Array(CHUNK * CHUNK * HEIGHT);
    const x0 = cx * CHUNK;
    const z0 = cz * CHUNK;

    for (let lz = 0; lz < CHUNK; lz++) {
      for (let lx = 0; lx < CHUNK; lx++) {
        const wx = x0 + lx;
        const wz = z0 + lz;
        const t = this.terrainAt(wx, wz);
        const h = t.h;
        for (let y = 0; y <= h; y++) {
          let b;
          if (y === 0) b = B.BEDROCK;
          else if (y < h - 3) b = B.STONE;
          else if (y < h) b = t.mountain > 0.55 ? B.STONE : B.DIRT;
          else {
            // Bloque superficial
            if (h <= WATER_Y + 1) b = B.SAND;
            else if (t.desert) b = B.SAND;
            else if (h > 34) b = B.SNOW;
            else if (t.mountain > 0.55 && h > 26) b = B.STONE;
            else b = B.GRASS;
          }
          data[idx(lx, y, lz)] = b;
        }
        if (t.desert && h > WATER_Y + 1) {
          for (let y = Math.max(1, h - 2); y < h; y++) data[idx(lx, y, lz)] = B.SAND;
        }
        for (let y = h + 1; y <= WATER_Y; y++) data[idx(lx, y, lz)] = B.WATER;
      }
    }

    // Árboles (se consideran columnas vecinas para copas que cruzan el borde)
    for (let tz = z0 - 3; tz < z0 + CHUNK + 3; tz++) {
      for (let tx = x0 - 3; tx < x0 + CHUNK + 3; tx++) {
        const tree = this.hasTreeAt(tx, tz);
        if (!tree) continue;
        const stamp = (wx, wy, wz, b, keepSolid = false) => {
          const lx = wx - x0;
          const lz = wz - z0;
          if (lx < 0 || lx >= CHUNK || lz < 0 || lz >= CHUNK || wy < 1 || wy >= HEIGHT) return;
          const i = idx(lx, wy, lz);
          if (keepSolid && data[i] !== B.AIR) return;
          data[i] = b;
        };
        const baseY = tree.h + 1;
        const topY = tree.h + tree.trunk;
        for (let dy = -2; dy <= 1; dy++) {
          const y = topY + dy;
          const r = dy < 0 ? 2 : 1;
          for (let ox = -r; ox <= r; ox++) {
            for (let oz = -r; oz <= r; oz++) {
              if (Math.abs(ox) === r && Math.abs(oz) === r && r === 2) continue;
              if (dy === 1 && Math.abs(ox) + Math.abs(oz) > 1) continue;
              stamp(tx + ox, y, tz + oz, B.LEAVES, true);
            }
          }
        }
        for (let y = baseY; y <= topY; y++) stamp(tx, y, tz, B.WOOD);
      }
    }

    // Ediciones del jugador
    for (const key in this.edits) {
      const [ex, ey, ez] = key.split(",").map(Number);
      const lx = ex - x0;
      const lz = ez - z0;
      if (lx >= 0 && lx < CHUNK && lz >= 0 && lz < CHUNK && ey >= 0 && ey < HEIGHT) {
        data[idx(lx, ey, lz)] = this.edits[key];
      }
    }

    return data;
  }

  ensureChunkData(cx, cz) {
    const key = chunkKey(cx, cz);
    let c = this.chunks.get(key);
    if (!c) {
      c = { cx, cz, data: this.generateChunkData(cx, cz), mesh: null, waterMesh: null, dirty: true };
      this.chunks.set(key, c);
    }
    return c;
  }

  // ---------- Acceso a bloques ----------

  getBlock(x, y, z) {
    if (y < 0) return B.BEDROCK;
    if (y >= HEIGHT) return B.AIR;
    const cx = Math.floor(x / CHUNK);
    const cz = Math.floor(z / CHUNK);
    const c = this.ensureChunkData(cx, cz);
    return c.data[idx(x - cx * CHUNK, y, z - cz * CHUNK)];
  }

  setBlock(x, y, z, b) {
    if (y < 1 || y >= HEIGHT) return;
    const cx = Math.floor(x / CHUNK);
    const cz = Math.floor(z / CHUNK);
    const c = this.ensureChunkData(cx, cz);
    const lx = x - cx * CHUNK;
    const lz = z - cz * CHUNK;
    c.data[idx(lx, y, lz)] = b;
    this.edits[`${x},${y},${z}`] = b;
    this.markDirty(cx, cz);
    if (lx === 0) this.markDirty(cx - 1, cz);
    if (lx === CHUNK - 1) this.markDirty(cx + 1, cz);
    if (lz === 0) this.markDirty(cx, cz - 1);
    if (lz === CHUNK - 1) this.markDirty(cx, cz + 1);
  }

  markDirty(cx, cz) {
    const c = this.chunks.get(chunkKey(cx, cz));
    if (c) c.dirty = true;
  }

  isSolid(x, y, z) {
    const b = this.getBlock(Math.floor(x), Math.floor(y), Math.floor(z));
    return b !== B.AIR && b !== B.WATER;
  }

  isWater(x, y, z) {
    return this.getBlock(Math.floor(x), Math.floor(y), Math.floor(z)) === B.WATER;
  }

  /** Altura del primer bloque sólido (techo del terreno) en una columna */
  surfaceY(x, z) {
    for (let y = HEIGHT - 1; y > 0; y--) {
      const b = this.getBlock(Math.floor(x), y, Math.floor(z));
      if (b !== B.AIR && b !== B.WATER) return y;
    }
    return 1;
  }

  // ---------- Meshing ----------

  buildChunkMesh(c) {
    const x0 = c.cx * CHUNK;
    const z0 = c.cz * CHUNK;
    const solid = { pos: [], nrm: [], col: [], idx: [] };
    const water = { pos: [], nrm: [], col: [], idx: [] };

    const pushFace = (buf, wx, wy, wz, face, color, shadeJitter) => {
      const base = buf.pos.length / 3;
      for (const [ox, oy, oz] of face.corners) {
        buf.pos.push(wx + ox, wy + oy, wz + oz);
        buf.nrm.push(face.dir[0], face.dir[1], face.dir[2]);
        const s = face.shade * shadeJitter;
        buf.col.push(color[0] * s, color[1] * s, color[2] * s);
      }
      buf.idx.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
    };

    for (let y = 0; y < HEIGHT; y++) {
      for (let lz = 0; lz < CHUNK; lz++) {
        for (let lx = 0; lx < CHUNK; lx++) {
          const b = c.data[idx(lx, y, lz)];
          if (b === B.AIR) continue;
          const wx = x0 + lx;
          const wz = z0 + lz;
          const jitter = 0.93 + columnHash(wx * 7 + y, wz * 13 - y, this.seed + 42) * 0.12;
          const isWaterBlock = b === B.WATER;
          for (const face of FACES) {
            const nb = this.getBlock(wx + face.dir[0], y + face.dir[1], wz + face.dir[2]);
            if (isWaterBlock) {
              if (nb !== B.AIR) continue;
              const color = COLORS[B.WATER][face.dir[1] > 0 ? "top" : "side"];
              pushFace(water, wx, y, wz, face, color, jitter);
            } else {
              if (nb !== B.AIR && nb !== B.WATER) continue;
              const set = COLORS[b];
              const color = face.dir[1] > 0 ? set.top : face.dir[1] < 0 ? set.bottom : set.side;
              pushFace(solid, wx, y, wz, face, color, jitter);
            }
          }
        }
      }
    }

    if (c.mesh) {
      this.scene.remove(c.mesh);
      c.mesh.geometry.dispose();
      c.mesh = null;
    }
    if (c.waterMesh) {
      this.scene.remove(c.waterMesh);
      c.waterMesh.geometry.dispose();
      c.waterMesh = null;
    }

    if (solid.pos.length) {
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(solid.pos, 3));
      g.setAttribute("normal", new THREE.Float32BufferAttribute(solid.nrm, 3));
      g.setAttribute("color", new THREE.Float32BufferAttribute(solid.col, 3));
      g.setIndex(solid.idx);
      c.mesh = new THREE.Mesh(g, this.solidMat);
      c.mesh.matrixAutoUpdate = false;
      this.scene.add(c.mesh);
    }
    if (water.pos.length) {
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(water.pos, 3));
      g.setAttribute("normal", new THREE.Float32BufferAttribute(water.nrm, 3));
      g.setAttribute("color", new THREE.Float32BufferAttribute(water.col, 3));
      g.setIndex(water.idx);
      c.waterMesh = new THREE.Mesh(g, this.waterMat);
      c.waterMesh.matrixAutoUpdate = false;
      this.scene.add(c.waterMesh);
    }
    c.dirty = false;
  }

  /** Carga/actualiza chunks alrededor del jugador. budget = mallas por llamada */
  update(px, pz, budget = 2) {
    const pcx = Math.floor(px / CHUNK);
    const pcz = Math.floor(pz / CHUNK);
    const R = this.viewRadius;

    const pending = [];
    for (let dz = -R; dz <= R; dz++) {
      for (let dx = -R; dx <= R; dx++) {
        if (dx * dx + dz * dz > R * R + 2) continue;
        const c = this.ensureChunkData(pcx + dx, pcz + dz);
        if (c.dirty || (!c.mesh && !c.waterMesh && !c.meshedEmpty)) {
          pending.push({ c, d: dx * dx + dz * dz });
        }
      }
    }
    pending.sort((a, b) => a.d - b.d);
    for (let i = 0; i < Math.min(budget, pending.length); i++) {
      const c = pending[i].c;
      this.buildChunkMesh(c);
      c.meshedEmpty = !c.mesh && !c.waterMesh;
    }

    // Descarga chunks lejanos
    for (const [key, c] of this.chunks) {
      const dx = c.cx - pcx;
      const dz = c.cz - pcz;
      if (dx * dx + dz * dz > (R + 3) * (R + 3)) {
        if (c.mesh) {
          this.scene.remove(c.mesh);
          c.mesh.geometry.dispose();
        }
        if (c.waterMesh) {
          this.scene.remove(c.waterMesh);
          c.waterMesh.geometry.dispose();
        }
        this.chunks.delete(key);
      }
    }
    return pending.length;
  }

  /** Raycast DDA contra bloques sólidos. Devuelve el bloque y la cara golpeada. */
  raycast(origin, dir, maxDist = 6) {
    let x = Math.floor(origin.x);
    let y = Math.floor(origin.y);
    let z = Math.floor(origin.z);
    const stepX = dir.x > 0 ? 1 : -1;
    const stepY = dir.y > 0 ? 1 : -1;
    const stepZ = dir.z > 0 ? 1 : -1;
    const tDeltaX = Math.abs(1 / (dir.x || 1e-10));
    const tDeltaY = Math.abs(1 / (dir.y || 1e-10));
    const tDeltaZ = Math.abs(1 / (dir.z || 1e-10));
    let tMaxX = tDeltaX * (dir.x > 0 ? 1 - (origin.x - x) : origin.x - x);
    let tMaxY = tDeltaY * (dir.y > 0 ? 1 - (origin.y - y) : origin.y - y);
    let tMaxZ = tDeltaZ * (dir.z > 0 ? 1 - (origin.z - z) : origin.z - z);
    let nx = 0, ny = 0, nz = 0;
    let t = 0;

    while (t <= maxDist) {
      const b = this.getBlock(x, y, z);
      if (b !== B.AIR && b !== B.WATER) {
        return { x, y, z, block: b, nx, ny, nz, dist: t };
      }
      if (tMaxX < tMaxY && tMaxX < tMaxZ) {
        x += stepX; t = tMaxX; tMaxX += tDeltaX; nx = -stepX; ny = 0; nz = 0;
      } else if (tMaxY < tMaxZ) {
        y += stepY; t = tMaxY; tMaxY += tDeltaY; nx = 0; ny = -stepY; nz = 0;
      } else {
        z += stepZ; t = tMaxZ; tMaxZ += tDeltaZ; nx = 0; ny = 0; nz = -stepZ;
      }
    }
    return null;
  }
}

function smoothstep(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}
