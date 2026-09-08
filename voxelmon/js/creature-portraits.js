/**
 * Portraits 3D (Fase 10.7): render offscreen del mismo modelo stylized3d.
 * Orden: cache runtime → PNG pre-render (si existe) → null (pixel fallback).
 */

import * as THREE from "three";
import { getCreatureArt } from "./creature-art.js";
import { getStylizedModel } from "./creature-3d-defs.js";
import { buildStylized3d } from "./creature-3d.js";

const cache = new Map(); // `${id}|${sil}` -> dataURL
const pngTried = new Set();
const pngOk = new Map();
let off = null;

function studio() {
  if (off) return off;
  const canvas = document.createElement("canvas");
  canvas.width = 96;
  canvas.height = 96;
  const renderer = new THREE.WebGLRenderer({
    canvas, alpha: true, antialias: true, preserveDrawingBuffer: true,
  });
  renderer.setSize(96, 96, false);
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  scene.add(new THREE.AmbientLight(0xffffff, 0.7));
  const key = new THREE.DirectionalLight(0xfff4e0, 0.95);
  key.position.set(1.4, 2.2, 1.6);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xc8d8ff, 0.35);
  fill.position.set(-1.6, 0.8, -0.6);
  scene.add(fill);
  const cam = new THREE.PerspectiveCamera(32, 1, 0.1, 40);
  off = { renderer, scene, cam, canvas };
  return off;
}

function poseCamera(cam, art, height) {
  const ps = art.portraitScale ?? 1;
  const yaw = art.portraitYaw ?? 0.42;
  const pitch = art.portraitPitch ?? -0.1;
  const ox = art.portraitOffsetX ?? 0;
  const oy = art.portraitOffsetY ?? 0;
  const dist = Math.max(1.4, (height || 1) * 2.15) / ps;
  const lookY = height * 0.48 + oy;
  cam.position.set(Math.sin(yaw) * dist + ox, lookY - Math.sin(pitch) * dist * 0.35, Math.cos(yaw) * dist);
  cam.lookAt(ox, lookY, 0);
  cam.updateProjectionMatrix();
}

function renderOnce(speciesId) {
  const art = getCreatureArt(speciesId) ?? { speciesId, scale: 1, visual: {} };
  const def = getStylizedModel(speciesId);
  if (!def) return null;
  const { renderer, scene, cam, canvas } = studio();
  const group = buildStylized3d(speciesId, art, def);
  const sh = group.userData.visual?.shadow;
  if (sh) sh.visible = false;
  scene.add(group);
  poseCamera(cam, art, group.userData.height ?? 1);
  renderer.render(scene, cam);
  const url = canvas.toDataURL("image/png");
  scene.remove(group);
  group.userData.disposeVisual?.();
  return url;
}

function toSilhouette(dataUrl) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = img.width; c.height = img.height;
      const ctx = c.getContext("2d");
      ctx.drawImage(img, 0, 0);
      const data = ctx.getImageData(0, 0, c.width, c.height);
      for (let i = 0; i < data.data.length; i += 4) {
        if (data.data[i + 3] < 16) continue;
        data.data[i] = 40; data.data[i + 1] = 44; data.data[i + 2] = 58;
      }
      ctx.putImageData(data, 0, 0);
      resolve(c.toDataURL());
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

export function getCreaturePortrait(speciesId, silhouette = false) {
  const key = `${speciesId}|${silhouette ? 1 : 0}`;
  if (cache.has(key)) return cache.get(key);
  const png = pngOk.get(speciesId);
  if (png && !silhouette) {
    cache.set(key, png);
    return png;
  }
  try {
    const url = renderOnce(speciesId);
    if (!url) return null;
    cache.set(`${speciesId}|0`, url);
    if (silhouette) {
      toSilhouette(url).then((s) => cache.set(`${speciesId}|1`, s));
      return url;
    }
    return url;
  } catch {
    return null;
  }
}

export function invalidatePortrait(speciesId) {
  cache.delete(`${speciesId}|0`);
  cache.delete(`${speciesId}|1`);
}

export function warmupPortraits(ids) {
  const out = [];
  for (const id of ids) {
    const url = getCreaturePortrait(id, false);
    if (url) out.push(id);
  }
  return out;
}

export function portraitCacheSize() {
  return cache.size;
}

/** Precarga PNG pre-renderizados si existen (no bloquea). */
export function preloadPortraitPngs(ids) {
  for (const id of ids) {
    if (pngTried.has(id)) continue;
    pngTried.add(id);
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = img.width; c.height = img.height;
      c.getContext("2d").drawImage(img, 0, 0);
      const url = c.toDataURL("image/png");
      pngOk.set(id, url);
      cache.set(`${id}|0`, url);
    };
    img.src = `assets/creature-portraits/${id}.png`;
  }
}

export function dumpPortrait(speciesId) {
  return getCreaturePortrait(speciesId, false);
}
