/**
 * CreatureRenderer (Fase 10.5 + 10.6): fachada visual.
 *
 *   stylized3d → pixel → voxel
 *
 * El resto del juego pide un THREE.Group con userData.height y anima con
 * animateCreatureVisual. No conoce Sprite vs Mesh vs modelo 3D.
 */

import * as THREE from "three";
import { buildCreatureModel, animateModel } from "./models.js";
import {
  ANIM_ROWS, SHEET_COLS, SHEET_ROWS, getCreatureArt, hasPixelArt,
  getPreferredRenderer, listPixelSpecies,
} from "./creature-art.js";
import { hasPainter, renderSheet, sheetToCanvas } from "./creature-pixels.js";
import { buildStylized3d, inspectGeometryCache, inspectMaterialCache, countMeshes } from "./creature-3d.js";
import { getStylizedModel, listStylizedSpecies } from "./creature-3d-defs.js";
import { getCreaturePortrait, preloadPortraitPngs } from "./creature-portraits.js";

const TEX_CACHE = new Map(); // speciesId -> { texture, canvas, source: "png"|"paint", art }
let loader = null;
const pngFailed = new Set();
let pngTried = false;

function getLoader() {
  if (!loader) loader = new THREE.TextureLoader();
  return loader;
}

function makeNearestTexture(image) {
  const tex = new THREE.Texture(image);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function paintTexture(speciesId) {
  const sheet = renderSheet(speciesId);
  if (!sheet) return null;
  const canvas = sheetToCanvas(sheet);
  const texture = makeNearestTexture(canvas);
  return { texture, canvas, source: "paint", art: getCreatureArt(speciesId), sheet };
}

function ensurePainted(speciesId) {
  if (TEX_CACHE.has(speciesId) && TEX_CACHE.get(speciesId).texture) return TEX_CACHE.get(speciesId);
  const packed = paintTexture(speciesId);
  if (packed) TEX_CACHE.set(speciesId, packed);
  return packed;
}

/** Precarga pintores (síncrono) y intenta PNG (async, sustituye la caché). */
export function preloadCreatureArt() {
  preloadPortraitPngs(listStylizedSpecies());
  for (const id of listPixelSpecies()) {
    if (hasPainter(id)) ensurePainted(id);
  }
  if (pngTried) return;
  pngTried = true;
  for (const id of listPixelSpecies()) {
    const art = getCreatureArt(id);
    if (!art?.src) continue;
    getLoader().load(
      art.src,
      (tex) => {
        tex.magFilter = THREE.NearestFilter;
        tex.minFilter = THREE.NearestFilter;
        tex.generateMipmaps = false;
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.needsUpdate = true;
        const prev = TEX_CACHE.get(id);
        TEX_CACHE.set(id, {
          texture: tex,
          canvas: prev?.canvas ?? null,
          source: "png",
          art,
          sheet: prev?.sheet ?? null,
        });
      },
      undefined,
      () => {
        pngFailed.add(id);
        if (!TEX_CACHE.has(id)) ensurePainted(id);
        console.info(`[creature-art] PNG no disponible para ${id}, usando pintor / voxel.`);
      },
    );
  }
}

export function getCachedArt(speciesId) {
  return TEX_CACHE.get(speciesId) ?? null;
}

function instanceMap(baseTex) {
  const t = baseTex.clone();
  t.needsUpdate = true;
  t.repeat.set(1 / SHEET_COLS, 1 / SHEET_ROWS);
  t.offset.set(0, 1 - 1 / SHEET_ROWS);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  return t;
}

function setFrame(tex, row, frame) {
  const col = ((frame % SHEET_COLS) + SHEET_COLS) % SHEET_COLS;
  tex.offset.set(col / SHEET_COLS, 1 - (row + 1) / SHEET_ROWS);
}

function buildShadow(radius) {
  const geo = new THREE.CircleGeometry(radius, 14);
  const mat = new THREE.MeshBasicMaterial({
    color: 0x000000, opacity: 0.32, transparent: true, depthWrite: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.03;
  mesh.renderOrder = -1;
  return mesh;
}

function buildPixelGroup(speciesId, packed) {
  const art = packed.art;
  const g = new THREE.Group();
  const map = instanceMap(packed.texture);
  const mat = new THREE.SpriteMaterial({
    map,
    transparent: true,
    alphaTest: 0.15,
    depthTest: true,
    depthWrite: true,
  });
  const sprite = new THREE.Sprite(mat);
  sprite.center.set(0.5, 0);
  const h = art.scale;
  const aspect = art.frameSize.width / art.frameSize.height;
  sprite.scale.set(h * aspect, h, 1);
  sprite.position.y = art.anchorY ?? 0;
  g.add(sprite);
  if (art.shadow !== false) g.add(buildShadow(art.shadowRadius ?? h * 0.28));

  const visual = {
    type: "pixel",
    speciesId,
    sprite,
    map,
    art,
    anim: "idle",
    frame: 0,
    fps: 4,
    source: packed.source,
    lockUntil: 0,
    setAnimation(name) {
      this.anim = ANIM_ROWS[name] != null ? name : "idle";
      this.fps = name === "walk" ? 8 : name === "attack" ? 10 : name === "hurt" ? 6 : 4;
      if (name === "attack" || name === "hurt") this.lockUntil = performance.now() + 420;
    },
    update(t) {
      if (this.lockUntil && performance.now() > this.lockUntil) {
        this.lockUntil = 0;
        this.anim = "idle";
        this.fps = 4;
      }
      const row = ANIM_ROWS[this.anim] ?? 0;
      this.frame = Math.floor(t * this.fps) % SHEET_COLS;
      setFrame(this.map, row, this.frame);
    },
  };
  visual.setAnimation("idle");
  visual.update(0);

  g.userData = {
    speciesId,
    height: h,
    renderer: "pixel",
    visual,
    disposeVisual() {
      g.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
          if (o.material.map && o.material.map !== packed.texture) o.material.map.dispose();
          o.material.dispose();
        }
      });
    },
  };
  return g;
}

function buildVoxelGroup(speciesId) {
  const g = buildCreatureModel(speciesId);
  g.userData.renderer = "voxel";
  g.userData.visual = {
    type: "voxel",
    speciesId,
    anim: "idle",
    source: "voxel",
    setAnimation(name) { this.anim = name; },
    update() {},
  };
  const voxelDispose = () => {
    g.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        if (o.material.map) o.material.map.dispose();
        o.material.dispose();
      }
    });
  };
  g.userData.disposeVisual = voxelDispose;
  return g;
}

export function resolveCreatureRenderer(speciesId) {
  const pref = getPreferredRenderer();
  const art = getCreatureArt(speciesId);
  const has3d = !!getStylizedModel(speciesId);
  const hasPix = hasPixelArt(speciesId) || hasPainter(speciesId);
  if (pref === "voxel") return "voxel";
  if (pref === "pixel") return hasPix ? "pixel" : "voxel";
  if (pref === "stylized3d") return has3d ? "stylized3d" : (hasPix ? "pixel" : "voxel");
  if (has3d && (art?.renderer === "stylized3d" || !art)) return "stylized3d";
  if (has3d) return "stylized3d";
  if (hasPix) return "pixel";
  return "voxel";
}

function buildStylizedGroup(speciesId) {
  const art = getCreatureArt(speciesId) ?? { speciesId, scale: 1, visual: {} };
  const model = getStylizedModel(speciesId);
  return buildStylized3d(speciesId, art, model);
}

function buildPixelOrNull(speciesId) {
  let packed = TEX_CACHE.get(speciesId);
  if (!packed && hasPainter(speciesId)) packed = ensurePainted(speciesId);
  if (!packed?.texture) return null;
  return buildPixelGroup(speciesId, packed);
}

/**
 * Construye el visual de una especie. Nunca devuelve null.
 */
export function buildCreatureVisual(speciesId) {
  const want = resolveCreatureRenderer(speciesId);
  if (want === "stylized3d") {
    try {
      return buildStylizedGroup(speciesId);
    } catch (err) {
      console.warn(`[creature-art] error stylized3d ${speciesId}, pixel/voxel:`, err);
    }
  }
  if (want === "stylized3d" || want === "pixel") {
    try {
      const pix = buildPixelOrNull(speciesId);
      if (pix) return pix;
    } catch (err) {
      console.warn(`[creature-art] error pixel ${speciesId}, voxel:`, err);
    }
  }
  if (want !== "voxel") console.info(`[creature-art] fallback voxel para ${speciesId}`);
  return buildVoxelGroup(speciesId);
}

export function animateCreatureVisual(group, t, mode = "idle", speed = 0) {
  const vis = group?.userData?.visual;
  if (!vis) {
    animateModel(group, t, mode, speed);
    return;
  }
  if (vis.type === "pixel") {
    if (!vis.lockUntil && (vis.anim === "idle" || vis.anim === "walk")) {
      vis.setAnimation(mode === "walk" ? "walk" : "idle");
    }
    vis.update(t);
    if (vis.sprite && mode === "walk") {
      vis.sprite.position.x = Math.sin(t * 9) * 0.03;
    } else if (vis.sprite) {
      vis.sprite.position.x = 0;
    }
    return;
  }
  if (vis.type === "stylized3d") {
    vis.update(t, mode, speed);
    return;
  }
  animateModel(group, t, vis.anim === "attack" ? "idle" : mode, speed);
}

export function setCreatureAnimation(group, name) {
  group?.userData?.visual?.setAnimation(name);
}

/** Aparición breve en combate: scale-in. No cambia reglas. */
export function playCreatureIntro(group, ms = 320) {
  if (!group) return;
  group.scale.setScalar(0.05);
  const t0 = performance.now();
  const tick = () => {
    const k = Math.min(1, (performance.now() - t0) / ms);
    const e = 1 - (1 - k) ** 2;
    group.scale.setScalar(0.05 + 0.95 * e);
    if (k < 1) requestAnimationFrame(tick);
    else group.scale.setScalar(1);
  };
  requestAnimationFrame(tick);
}

export function disposeCreatureVisual(group) {
  if (!group) return;
  if (typeof group.userData.disposeVisual === "function") {
    group.userData.disposeVisual();
    return;
  }
  group.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) {
      if (o.material.map) o.material.map.dispose();
      o.material.dispose();
    }
  });
}

/** Icono HUD/Dex: portrait 3D → recorte pixel → null. */
export function creatureArtIcon(speciesId, silhouette = false) {
  const portrait = getCreaturePortrait(speciesId, silhouette);
  if (portrait) return portrait;
  const packed = TEX_CACHE.get(speciesId) ?? (hasPainter(speciesId) ? ensurePainted(speciesId) : null);
  const art = getCreatureArt(speciesId);
  if (!packed?.canvas || !art) return null;
  const fw = art.frameSize.width, fh = art.frameSize.height;
  const c = document.createElement("canvas");
  c.width = fw; c.height = fh;
  const ctx = c.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(packed.canvas, 0, 0, fw, fh, 0, 0, fw, fh);
  if (silhouette) {
    const img = ctx.getImageData(0, 0, fw, fh);
    for (let i = 0; i < img.data.length; i += 4) {
      if (img.data[i + 3] < 16) continue;
      img.data[i] = 40; img.data[i + 1] = 44; img.data[i + 2] = 58;
    }
    ctx.putImageData(img, 0, 0);
  }
  return c.toDataURL();
}

export function creatureArtDebugSnapshot(group) {
  const vis = group?.userData?.visual;
  const id = group?.userData?.speciesId ?? vis?.speciesId;
  const cached = id ? TEX_CACHE.get(id) : null;
  const renderer = group?.userData?.renderer ?? vis?.type ?? "unknown";
  return {
    species: id ?? null,
    renderer,
    spriteLoaded: !!(cached && cached.texture),
    source: cached?.source ?? vis?.source ?? null,
    animation: vis?.anim ?? null,
    animationProfile: vis?.profile ?? null,
    frame: vis?.frame ?? null,
    scale: vis?.art?.scale ?? group?.scale?.x ?? null,
    effects: vis?.effects ?? [],
    partCount: vis?.partCount ?? null,
    meshes: countMeshes(group),
    fallback: renderer === "voxel" || renderer === "pixel",
    preferred: getPreferredRenderer(),
    resolved: id ? resolveCreatureRenderer(id) : null,
    cacheSize: TEX_CACHE.size,
    geoCache: inspectGeometryCache().size,
    matCache: inspectMaterialCache().size,
    pngFailed: [...pngFailed],
    stylized: listStylizedSpecies(),
  };
}

export function textureCacheSize() {
  return TEX_CACHE.size;
}

export { inspectGeometryCache, inspectMaterialCache, countMeshes };

export function inspectTextureCache() {
  const out = {};
  for (const [id, v] of TEX_CACHE) out[id] = { source: v.source, image: !!v.texture?.image };
  return out;
}

/** Quita la textura cacheada y simula un 404: el siguiente build usa pintor o voxel. */
export function simulatePngLoadFailure(speciesId) {
  pngFailed.add(speciesId);
  TEX_CACHE.delete(speciesId);
  if (hasPainter(speciesId)) {
    ensurePainted(speciesId);
    return "paint";
  }
  return "voxel";
}
