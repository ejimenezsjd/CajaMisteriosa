/**
 * Modelos vóxel de criaturas: cuadrúpedo base construido con cajas de colores
 * + accesorios distintivos por tipo. Devuelve un THREE.Group con referencias
 * animables en userData (legs, wings, flames, halo).
 */

import * as THREE from "three";
import { SPECIES } from "./data.js";

function box(group, w, h, d, x, y, z, color, opts = {}) {
  const mat = new THREE.MeshLambertMaterial({ color });
  if (opts.emissive) {
    mat.emissive = new THREE.Color(opts.emissive);
    mat.emissiveIntensity = opts.emissiveIntensity ?? 0.6;
  }
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  if (opts.ry) m.rotation.y = opts.ry;
  if (opts.rz) m.rotation.z = opts.rz;
  if (opts.rx) m.rotation.x = opts.rx;
  group.add(m);
  return m;
}

const STAGE_SCALE = { 1: 0.72, 2: 1.0, 3: 1.3 };

/** Construye el modelo de una especie. Mira hacia -Z. */
export function buildCreatureModel(speciesId) {
  const sp = SPECIES[speciesId];
  const g = new THREE.Group();
  const c1 = sp.color;
  const c2 = sp.color2;
  const legs = [];
  const wings = [];
  const flames = [];
  let halo = null;

  if (sp.legendary) {
    buildLegendary(g, c1, c2, flames);
    g.scale.setScalar(1.6);
    g.userData = { legs, wings, flames, halo, height: 3.6, speciesId };
    return g;
  }

  // Cuerpo y cabeza
  const bodyW = sp.type === "tierra" ? 1.1 : 0.9;
  box(g, bodyW, 0.62, 1.2, 0, 0.72, 0.1, c1);
  const head = box(g, 0.72, 0.66, 0.66, 0, 1.12, -0.78, c1);

  // Ojos
  const eyeColor = sp.type === "sombra" ? c2 : "#ffffff";
  const eyeOpts = sp.type === "sombra" || sp.type === "luz" ? { emissive: eyeColor, emissiveIntensity: 0.9 } : {};
  box(g, 0.14, 0.16, 0.06, -0.19, 1.2, -1.12, eyeColor, eyeOpts);
  box(g, 0.14, 0.16, 0.06, 0.19, 1.2, -1.12, eyeColor, eyeOpts);
  if (!eyeOpts.emissive) {
    box(g, 0.07, 0.09, 0.04, -0.19, 1.19, -1.14, "#1a1a24");
    box(g, 0.07, 0.09, 0.04, 0.19, 1.19, -1.14, "#1a1a24");
  }

  // Patas
  const legW = sp.type === "tierra" ? 0.3 : 0.22;
  for (const [lx, lz] of [[-0.32, -0.38], [0.32, -0.38], [-0.32, 0.52], [0.32, 0.52]]) {
    const leg = box(g, legW, 0.44, legW, lx, 0.22, lz, c2);
    leg.geometry.translate(0, -0.22, 0); // pivote en la cadera
    leg.position.y = 0.44;
    legs.push(leg);
  }

  // Accesorios por tipo
  switch (sp.type) {
    case "fuego": {
      flames.push(box(g, 0.24, 0.34, 0.24, 0, 1.6, -0.78, c2, { emissive: c2, emissiveIntensity: 1 }));
      flames.push(box(g, 0.16, 0.24, 0.16, 0.12, 1.78, -0.7, "#ffd84a", { emissive: "#ffd84a", emissiveIntensity: 1 }));
      flames.push(box(g, 0.2, 0.3, 0.2, 0, 0.95, 0.85, c2, { emissive: c2, emissiveIntensity: 1 }));
      break;
    }
    case "agua": {
      box(g, 0.12, 0.4, 0.5, 0, 1.2, 0.2, c2, { rx: 0.3 });
      box(g, 0.12, 0.34, 0.4, 0, 0.8, 0.85, c2, { rx: -0.5 });
      box(g, 0.2, 0.28, 0.2, 0, 1.56, -0.78, c2);
      break;
    }
    case "planta": {
      box(g, 0.5, 0.06, 0.8, 0, 1.52, -0.7, "#2a9860", { rx: 0.25 });
      box(g, 0.8, 0.06, 0.5, 0, 1.5, -0.75, "#3dba7a", { rz: 0.2 });
      box(g, 0.1, 0.3, 0.1, 0, 1.1, 0.6, "#2a9860");
      box(g, 0.4, 0.05, 0.4, 0, 1.28, 0.6, "#3dba7a");
      break;
    }
    case "electrico": {
      box(g, 0.14, 0.5, 0.14, -0.24, 1.62, -0.78, c2, { rz: 0.25 });
      box(g, 0.14, 0.5, 0.14, 0.24, 1.62, -0.78, c2, { rz: -0.25 });
      box(g, 0.12, 0.4, 0.12, 0, 1.1, 0.78, c2, { rx: 0.8, emissive: c2, emissiveIntensity: 0.7 });
      box(g, 0.12, 0.34, 0.12, 0, 1.36, 0.98, c2, { rx: -0.6, emissive: c2, emissiveIntensity: 0.7 });
      break;
    }
    case "tierra": {
      box(g, 0.42, 0.3, 0.42, -0.18, 1.12, 0.15, "#9c9ca4");
      box(g, 0.32, 0.26, 0.32, 0.24, 1.08, 0.4, "#8d8d94");
      box(g, 0.26, 0.2, 0.26, 0.05, 1.14, -0.25, "#aeaeb6");
      break;
    }
    case "volador": {
      const wingL = box(g, 1.0, 0.08, 0.6, -0.95, 1.0, 0.1, c2);
      wingL.geometry.translate(-0.5, 0, 0);
      wingL.position.x = -0.45;
      const wingR = box(g, 1.0, 0.08, 0.6, 0.95, 1.0, 0.1, c2);
      wingR.geometry.translate(0.5, 0, 0);
      wingR.position.x = 0.45;
      wings.push(wingL, wingR);
      box(g, 0.16, 0.14, 0.3, 0, 1.05, -1.22, "#f0b040");
      break;
    }
    case "sombra": {
      box(g, 0.18, 0.4, 0.18, -0.2, 1.15, 0.3, c2, { rz: 0.4 });
      box(g, 0.18, 0.5, 0.18, 0.1, 1.2, 0.05, c2, { rz: -0.3 });
      box(g, 0.14, 0.34, 0.14, 0.25, 1.1, 0.5, c2, { rz: 0.5 });
      break;
    }
    case "luz": {
      halo = new THREE.Group();
      const hr = 0.42;
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        box(halo, 0.3, 0.06, 0.1, Math.cos(a) * hr, 0, Math.sin(a) * hr, c2, {
          ry: -a, emissive: c2, emissiveIntensity: 1,
        });
      }
      halo.position.set(0, 1.75, -0.78);
      g.add(halo);
      box(g, 0.18, 0.18, 0.18, 0, 1.0, 0.82, "#fff8d0", { emissive: "#fff8d0", emissiveIntensity: 1 });
      break;
    }
  }

  const s = STAGE_SCALE[sp.stage] ?? 1;
  g.scale.setScalar(s);
  g.userData = { legs, wings, flames, halo, height: 1.9 * s, speciesId };
  return g;
}

function buildLegendary(g, c1, c2, flames) {
  // Cuerpo cristalino flotante
  const core = box(g, 0.9, 0.9, 0.9, 0, 1.5, 0, c1, { emissive: c1, emissiveIntensity: 0.5 });
  core.rotation.set(Math.PI / 5, Math.PI / 5, 0);
  const core2 = box(g, 0.65, 0.65, 0.65, 0, 1.5, 0, c2, { emissive: c2, emissiveIntensity: 0.8 });
  core2.rotation.set(-Math.PI / 6, Math.PI / 3, Math.PI / 7);
  flames.push(core, core2);
  box(g, 0.5, 0.5, 0.5, 0, 2.35, -0.2, "#ffffff", { emissive: "#dff6ff", emissiveIntensity: 0.9, ry: 0.5 });
  box(g, 0.12, 0.2, 0.06, -0.14, 2.42, -0.46, "#3ec6ff", { emissive: "#3ec6ff", emissiveIntensity: 1 });
  box(g, 0.12, 0.2, 0.06, 0.14, 2.42, -0.46, "#3ec6ff", { emissive: "#3ec6ff", emissiveIntensity: 1 });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const orb = box(g, 0.2, 0.34, 0.2, Math.cos(a) * 1.15, 1.5 + Math.sin(a * 2) * 0.3, Math.sin(a) * 1.15,
      i % 2 ? "#ffd6f8" : "#c9f0ff", { emissive: i % 2 ? "#ff9ce8" : "#7fd8ff", emissiveIntensity: 1 });
    orb.userData.orbAngle = a;
    flames.push(orb);
  }
}

/** Anima las piezas del modelo. mode: "walk" | "idle". t = tiempo, speed = 0..1 */
export function animateModel(g, t, mode = "idle", speed = 0) {
  const u = g.userData;
  if (!u) return;
  const walk = mode === "walk" ? Math.max(speed, 0.4) : 0;
  u.legs?.forEach((leg, i) => {
    leg.rotation.x = walk ? Math.sin(t * 8 + (i % 2 ? Math.PI : 0)) * 0.6 * walk : 0;
  });
  u.wings?.forEach((w, i) => {
    w.rotation.z = (i === 0 ? 1 : -1) * (Math.sin(t * 9) * 0.5 + 0.15);
  });
  u.flames?.forEach((f, i) => {
    const s = 1 + Math.sin(t * 10 + i * 1.7) * 0.12;
    f.scale.set(s, 1 / s + (s - 1), s);
    f.rotation.y += 0.02;
    if (f.userData.orbAngle !== undefined) {
      const a = f.userData.orbAngle + t * 0.9;
      f.position.x = Math.cos(a) * 1.15;
      f.position.z = Math.sin(a) * 1.15;
      f.position.y = 1.5 + Math.sin(a * 2 + t) * 0.3;
    }
  });
  if (u.halo) u.halo.rotation.y = t * 1.4;
  if (SPECIES[u.speciesId]?.legendary) {
    g.children.forEach((ch) => { ch.position.y += Math.sin(t * 2) * 0.0015; });
  }
}

/** Cubo de captura (la "cubo-ball" de VoxelMon) */
export function buildCubeBall() {
  const g = new THREE.Group();
  box(g, 0.3, 0.16, 0.3, 0, 0.08, 0, "#e04040");
  box(g, 0.3, 0.14, 0.3, 0, -0.07, 0, "#f0f0f0");
  box(g, 0.1, 0.1, 0.06, 0, 0.02, -0.16, "#20242c", { emissive: "#8fdcff", emissiveIntensity: 0.8 });
  return g;
}
