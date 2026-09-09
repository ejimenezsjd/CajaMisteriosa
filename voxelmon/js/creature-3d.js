/**
 * Renderer 3D estilizado (Fase 10.6).
 *
 * Composición declarativa de partes + caché de geometría/materiales +
 * perfiles de animación + efectos elementales baratos.
 *
 * Las criaturas miran hacia -Z (igual que el voxel legado). El gameplay
 * sigue orientando el Group raíz.
 */

import * as THREE from "three";

const GEO = new Map();
const MAT = new Map();

function geo(key, factory) {
  if (!GEO.has(key)) GEO.set(key, factory());
  return GEO.get(key);
}

function hex(c) {
  return new THREE.Color(c);
}

function mat(kind, color, extra = {}) {
  const ei = extra.emissiveIntensity ?? (kind === "emissive" ? 0.85 : 0);
  const em = extra.emissive ?? (kind === "emissive" ? color : "#000000");
  const op = extra.opacity ?? (kind === "glass" ? 0.62 : 1);
  const key = `${kind}|${color}|${em}|${ei}|${op}`;
  if (MAT.has(key)) return MAT.get(key);
  const common = {
    color: hex(color),
    emissive: hex(em),
    emissiveIntensity: ei,
  };
  let m;
  if (kind === "glass") {
    m = new THREE.MeshLambertMaterial({
      ...common, transparent: true, opacity: op, depthWrite: false,
    });
  } else if (kind === "bright") {
    m = new THREE.MeshLambertMaterial({
      ...common, emissive: hex(color), emissiveIntensity: 0.18,
    });
  } else {
    m = new THREE.MeshLambertMaterial(common);
  }
  MAT.set(key, m);
  return m;
}

function geomFor(type, segs) {
  const s = segs ?? 10;
  switch (type) {
    case "sphere":
    case "ellipsoid":
      return geo(`sph_${s}`, () => new THREE.SphereGeometry(0.5, s, Math.max(6, s - 2)));
    case "icosahedron":
    case "polyhedron":
      return geo(`ico_${segs ?? 1}`, () => new THREE.IcosahedronGeometry(0.5, segs ?? 1));
    case "dodecahedron":
      return geo("dod", () => new THREE.DodecahedronGeometry(0.5, 0));
    case "cone":
      return geo(`cone_${s}`, () => new THREE.ConeGeometry(0.5, 1, s));
    case "cylinder":
      return geo(`cyl_${s}`, () => new THREE.CylinderGeometry(0.5, 0.5, 1, s));
    case "taper":
      return geo(`tap_${s}`, () => new THREE.CylinderGeometry(0.18, 0.5, 1, s));
    case "torus":
      return geo(`tor_${s}`, () => new THREE.TorusGeometry(0.5, 0.16, 8, s));
    default:
      return geo(`sph_${s}`, () => new THREE.SphereGeometry(0.5, s, Math.max(6, s - 2)));
  }
}

function meshFrom(def) {
  if (def.type === "group" || def.type === "eye") return null;
  const g = geomFor(def.type, def.segs);
  const kind = def.mat ?? (def.emissive ? "emissive" : "matte");
  const material = mat(kind, def.color ?? "#888888", {
    emissive: def.emissive,
    emissiveIntensity: def.emissiveIntensity,
    opacity: def.opacity,
  });
  const mesh = new THREE.Mesh(g, material);
  const sc = def.scale ?? 1;
  if (Array.isArray(sc)) mesh.scale.set(sc[0], sc[1], sc[2]);
  else mesh.scale.setScalar(sc);
  if (def.meshRot) mesh.rotation.set(def.meshRot[0], def.meshRot[1], def.meshRot[2]);
  if (def.meshPos) mesh.position.set(def.meshPos[0], def.meshPos[1], def.meshPos[2]);
  return mesh;
}

function addEye(parent, def) {
  const g = new THREE.Group();
  const s = def.size ?? 0.06;
  const white = new THREE.Mesh(geomFor("sphere", 8), mat("bright", def.white ?? "#f4f0e8"));
  white.scale.set(s, s * 1.05, s * 0.7);
  const pupil = new THREE.Mesh(geomFor("sphere", 6), mat("dark", def.iris ?? "#1a1210", { emissive: "#000000", emissiveIntensity: 0 }));
  pupil.scale.set(s * 0.45, s * 0.5, s * 0.35);
  pupil.position.z = -s * 0.28;
  pupil.position.x = def.lookX ?? 0;
  const hi = new THREE.Mesh(geomFor("sphere", 6), mat("bright", "#ffffff"));
  hi.scale.setScalar(s * 0.16);
  hi.position.set(s * 0.16, s * 0.18, -s * 0.38);
  g.add(white, pupil, hi);
  if (def.brow) {
    const brow = new THREE.Mesh(geomFor("ellipsoid", 8), mat("dark", def.brow));
    brow.scale.set(s * 1.1, s * 0.22, s * 0.3);
    brow.position.set(0, s * 0.7, -s * 0.1);
    brow.rotation.z = def.browTilt ?? 0;
    g.add(brow);
  }
  g.position.set(...(def.pos ?? [0, 0, 0]));
  if (def.rot) g.rotation.set(...def.rot);
  parent.add(g);
  return g;
}

function restOf(obj) {
  obj.userData.rest = {
    px: obj.position.x, py: obj.position.y, pz: obj.position.z,
    rx: obj.rotation.x, ry: obj.rotation.y, rz: obj.rotation.z,
    sx: obj.scale.x, sy: obj.scale.y, sz: obj.scale.z,
  };
}

function resetRest(obj) {
  const r = obj.userData.rest;
  if (!r) return;
  obj.position.set(r.px, r.py, r.pz);
  obj.rotation.set(r.rx, r.ry, r.rz);
  obj.scale.set(r.sx, r.sy, r.sz);
}

function attachEffect(nodes, name, color) {
  const host = nodes.body || nodes.torso || nodes.root;
  if (!host) return null;
  const g = new THREE.Group();
  g.name = `fx_${name}`;
  const n = name === "embers" || name === "spark" ? 5 : 4;
  for (let i = 0; i < n; i++) {
    const p = new THREE.Mesh(
      geomFor("icosahedron", 0),
      mat("emissive", color, { emissive: color, emissiveIntensity: 1.1 }),
    );
    p.scale.setScalar(0.045 + (i % 3) * 0.012);
    p.userData.k = i;
    g.add(p);
  }
  host.add(g);
  nodes[g.name] = g;
  restOf(g);
  return g;
}

function tickEffects(nodes, t, effects) {
  for (const name of effects) {
    const g = nodes[`fx_${name}`];
    if (!g) continue;
    g.children.forEach((p, i) => {
      const k = p.userData.k ?? i;
      const a = t * (1.6 + k * 0.35) + k;
      if (name === "embers" || name === "flame" || name === "ember_tail") {
        p.position.set(Math.sin(a) * 0.08, 0.12 + (a % 1.2) * 0.22, Math.cos(a * 0.7) * 0.06);
        p.scale.setScalar(0.03 + Math.abs(Math.sin(a * 2)) * 0.03);
      } else if (name === "mist" || name === "leaf" || name === "shadow_wisp") {
        p.position.set(Math.sin(a) * 0.16, 0.05 + Math.sin(a * 0.8) * 0.1, Math.cos(a) * 0.12);
      } else if (name === "spark") {
        p.position.set(Math.sin(a * 3) * 0.14, 0.2 + Math.sin(a * 5) * 0.08, Math.cos(a * 2) * 0.1);
      } else if (name === "storm") {
        p.position.set(Math.sin(a * 2.2) * 0.22, 0.18 + Math.abs(Math.sin(a * 4)) * 0.16, Math.cos(a * 1.6) * 0.16);
        p.scale.setScalar(0.04 + Math.abs(Math.sin(a * 3)) * 0.03);
      } else if (name === "glow" || name === "crystal" || name === "prism") {
        const s = 0.05 + Math.sin(t * 3 + k) * 0.015;
        p.position.set((k - 1.5) * 0.06, 0.08 + Math.sin(t * 2 + k) * 0.04, 0);
        p.scale.setScalar(s);
      } else {
        p.position.set(Math.sin(a) * 0.1, 0.1 + Math.sin(a) * 0.06, Math.cos(a) * 0.08);
      }
    });
  }
}

const PROFILES = {
  quadruped_small: {
    idle(p, t) {
      if (p.body) p.body.scale.y = (p.body.userData.rest?.sy ?? 1) * (1 + Math.sin(t * 2.2) * 0.035);
      if (p.head) p.head.rotation.y = Math.sin(t * 0.8) * 0.12;
      if (p.tail) p.tail.rotation.x = Math.sin(t * 3) * 0.18;
      if (p.ear_l) p.ear_l.rotation.z = 0.15 + Math.sin(t * 2.4) * 0.08;
      if (p.ear_r) p.ear_r.rotation.z = -0.15 - Math.sin(t * 2.4 + 0.4) * 0.08;
    },
    walk(p, t, spd) {
      const w = t * 8 * (0.7 + spd);
      ["leg_fl", "leg_br"].forEach((n) => { if (p[n]) p[n].rotation.x = Math.sin(w) * 0.55; });
      ["leg_fr", "leg_bl"].forEach((n) => { if (p[n]) p[n].rotation.x = -Math.sin(w) * 0.55; });
      if (p.body) p.body.position.y = (p.body.userData.rest?.py ?? 0) + Math.abs(Math.sin(w)) * 0.04;
      if (p.tail) p.tail.rotation.y = Math.sin(w) * 0.25;
    },
    attack(p, k) {
      if (p.body) p.body.position.z = -0.12 * Math.sin(k * Math.PI);
      if (p.head) p.head.rotation.x = -0.25 * Math.sin(k * Math.PI);
    },
    hurt(p, k) {
      if (p.body) { p.body.position.z = 0.1 * k; p.body.rotation.x = 0.2 * k; }
    },
    faint(p, k) {
      if (p.body) p.body.rotation.z = k * 0.9;
    },
  },
  quadruped_athletic: {
    idle(p, t) {
      if (p.body) p.body.scale.y = (p.body.userData.rest?.sy ?? 1) * (1 + Math.sin(t * 1.8) * 0.028);
      if (p.head) p.head.rotation.y = Math.sin(t * 0.6) * 0.08;
      if (p.tail) p.tail.rotation.x = Math.sin(t * 2.6) * 0.14;
      if (p.mane) p.mane.scale.y = 1 + Math.sin(t * 5) * 0.08;
    },
    walk(p, t, spd) {
      const w = t * 7 * (0.7 + spd);
      ["leg_fl", "leg_br"].forEach((n) => { if (p[n]) p[n].rotation.x = Math.sin(w) * 0.65; });
      ["leg_fr", "leg_bl"].forEach((n) => { if (p[n]) p[n].rotation.x = -Math.sin(w) * 0.65; });
      if (p.body) p.body.position.y = (p.body.userData.rest?.py ?? 0) + Math.abs(Math.sin(w)) * 0.05;
    },
    attack(p, k) {
      if (p.body) p.body.position.z = -0.18 * Math.sin(k * Math.PI);
      if (p.head) p.head.rotation.x = -0.35 * Math.sin(k * Math.PI);
    },
    hurt(p, k) {
      if (p.body) p.body.rotation.x = 0.25 * k;
    },
    faint(p, k) { if (p.body) p.body.rotation.z = k * 0.8; },
  },
  quadruped_mythic: {
    idle(p, t) {
      if (p.body) p.body.scale.y = (p.body.userData.rest?.sy ?? 1) * (1 + Math.sin(t * 1.4) * 0.02);
      if (p.mane) p.mane.rotation.z = Math.sin(t * 3) * 0.06;
      if (p.tail) p.tail.rotation.x = Math.sin(t * 2) * 0.1;
      if (p.flame_l) p.flame_l.scale.y = 1 + Math.sin(t * 6) * 0.12;
      if (p.flame_r) p.flame_r.scale.y = 1 + Math.sin(t * 6 + 1) * 0.12;
    },
    walk(p, t, spd) {
      const w = t * 5.5 * (0.6 + spd);
      ["leg_fl", "leg_br"].forEach((n) => { if (p[n]) p[n].rotation.x = Math.sin(w) * 0.4; });
      ["leg_fr", "leg_bl"].forEach((n) => { if (p[n]) p[n].rotation.x = -Math.sin(w) * 0.4; });
      if (p.body) p.body.position.y = (p.body.userData.rest?.py ?? 0) + Math.abs(Math.sin(w)) * 0.03;
    },
    attack(p, k) {
      if (p.body) p.body.position.z = -0.22 * Math.sin(k * Math.PI);
      if (p.head) p.head.rotation.x = -0.3 * Math.sin(k * Math.PI);
    },
    hurt(p, k) { if (p.body) p.body.rotation.x = 0.15 * k; },
    faint(p, k) { if (p.body) p.body.rotation.z = k * 0.6; },
  },
  sprout: {
    idle(p, t) {
      if (p.body) p.body.scale.y = (p.body.userData.rest?.sy ?? 1) * (1 + Math.sin(t * 2) * 0.04);
      if (p.leaf_l) p.leaf_l.rotation.z = 0.4 + Math.sin(t * 1.6) * 0.12;
      if (p.leaf_r) p.leaf_r.rotation.z = -0.4 - Math.sin(t * 1.6 + 0.3) * 0.12;
      if (p.head) p.head.rotation.z = Math.sin(t * 1.2) * 0.08;
    },
    walk(p, t, spd) {
      const w = t * 7 * (0.7 + spd);
      if (p.body) p.body.position.y = (p.body.userData.rest?.py ?? 0) + Math.abs(Math.sin(w)) * 0.07;
      if (p.leg_l) p.leg_l.rotation.x = Math.sin(w) * 0.4;
      if (p.leg_r) p.leg_r.rotation.x = -Math.sin(w) * 0.4;
    },
    attack(p, k) { if (p.head) p.head.rotation.x = -0.4 * Math.sin(k * Math.PI); },
    hurt(p, k) { if (p.body) p.body.rotation.z = 0.3 * k; },
    faint(p, k) { if (p.body) p.body.rotation.z = k * 1.1; },
  },
  forest: {
    idle(p, t) {
      if (p.body) p.body.scale.y = (p.body.userData.rest?.sy ?? 1) * (1 + Math.sin(t * 1.6) * 0.03);
      if (p.leaf_l) p.leaf_l.rotation.y = Math.sin(t * 1.4) * 0.15;
      if (p.leaf_r) p.leaf_r.rotation.y = -Math.sin(t * 1.4) * 0.15;
      if (p.arm_l) p.arm_l.rotation.z = 0.2 + Math.sin(t * 1.2) * 0.08;
      if (p.arm_r) p.arm_r.rotation.z = -0.2 - Math.sin(t * 1.2) * 0.08;
    },
    walk(p, t, spd) {
      const w = t * 6 * (0.7 + spd);
      if (p.leg_l) p.leg_l.rotation.x = Math.sin(w) * 0.5;
      if (p.leg_r) p.leg_r.rotation.x = -Math.sin(w) * 0.5;
      if (p.arm_l) p.arm_l.rotation.x = -Math.sin(w) * 0.35;
      if (p.arm_r) p.arm_r.rotation.x = Math.sin(w) * 0.35;
    },
    attack(p, k) {
      if (p.arm_r) p.arm_r.rotation.x = -0.8 * Math.sin(k * Math.PI);
    },
    hurt(p, k) { if (p.body) p.body.rotation.x = 0.2 * k; },
    faint(p, k) { if (p.body) p.body.rotation.z = k * 0.85; },
  },
  totem: {
    idle(p, t) {
      if (p.body) p.body.scale.y = (p.body.userData.rest?.sy ?? 1) * (1 + Math.sin(t * 1.1) * 0.018);
      if (p.crown) p.crown.rotation.y = Math.sin(t * 0.5) * 0.06;
      if (p.flower) p.flower.scale.setScalar(1 + Math.sin(t * 2.2) * 0.06);
    },
    walk(p, t, spd) {
      const w = t * 4.2 * (0.6 + spd);
      if (p.leg_l) p.leg_l.rotation.x = Math.sin(w) * 0.28;
      if (p.leg_r) p.leg_r.rotation.x = -Math.sin(w) * 0.28;
      if (p.body) p.body.rotation.z = Math.sin(w) * 0.04;
    },
    attack(p, k) { if (p.arm_l) p.arm_l.rotation.x = -0.7 * Math.sin(k * Math.PI); },
    hurt(p, k) { if (p.body) p.body.position.z = 0.08 * k; },
    faint(p, k) { if (p.body) p.body.rotation.z = k * 0.5; },
  },
  floater: {
    idle(p, t) {
      if (p.body) {
        p.body.position.y = (p.body.userData.rest?.py ?? 0) + Math.sin(t * 1.8) * 0.06;
        p.body.scale.x = (p.body.userData.rest?.sx ?? 1) * (1 + Math.sin(t * 2.4) * 0.04);
      }
      if (p.crest) p.crest.rotation.z = Math.sin(t * 2) * 0.12;
    },
    walk(p, t, spd) {
      const w = t * 5 * (0.7 + spd);
      if (p.body) {
        p.body.position.y = (p.body.userData.rest?.py ?? 0) + 0.08 + Math.sin(w) * 0.05;
        p.body.rotation.z = Math.sin(w) * 0.12;
      }
    },
    attack(p, k) { if (p.body) p.body.position.z = -0.14 * Math.sin(k * Math.PI); },
    hurt(p, k) { if (p.body) p.body.scale.setScalar(1 - 0.12 * k); },
    faint(p, k) { if (p.body) p.body.rotation.z = k * 1.2; },
  },
  aquatic: {
    idle(p, t) {
      if (p.body) p.body.rotation.y = Math.sin(t * 1.4) * 0.06;
      if (p.fin_l) p.fin_l.rotation.z = 0.4 + Math.sin(t * 3) * 0.2;
      if (p.fin_r) p.fin_r.rotation.z = -0.4 - Math.sin(t * 3) * 0.2;
      if (p.tail) p.tail.rotation.y = Math.sin(t * 2.4) * 0.22;
    },
    walk(p, t, spd) {
      const w = t * 6.5 * (0.7 + spd);
      if (p.body) p.body.position.y = (p.body.userData.rest?.py ?? 0) + Math.abs(Math.sin(w)) * 0.04;
      if (p.tail) p.tail.rotation.y = Math.sin(w) * 0.4;
      if (p.fin_l) p.fin_l.rotation.z = 0.5 + Math.sin(w) * 0.25;
      if (p.fin_r) p.fin_r.rotation.z = -0.5 - Math.sin(w) * 0.25;
    },
    attack(p, k) { if (p.head) p.head.rotation.x = -0.3 * Math.sin(k * Math.PI); },
    hurt(p, k) { if (p.body) p.body.rotation.x = 0.2 * k; },
    faint(p, k) { if (p.body) p.body.rotation.z = k * 0.9; },
  },
  aquatic_guardian: {
    idle(p, t) {
      if (p.body) p.body.scale.y = (p.body.userData.rest?.sy ?? 1) * (1 + Math.sin(t * 1.2) * 0.02);
      if (p.crest) p.crest.rotation.z = Math.sin(t * 2) * 0.05;
      if (p.tail) p.tail.rotation.y = Math.sin(t * 1.6) * 0.1;
    },
    walk(p, t, spd) {
      const w = t * 4.8 * (0.6 + spd);
      if (p.leg_l) p.leg_l.rotation.x = Math.sin(w) * 0.3;
      if (p.leg_r) p.leg_r.rotation.x = -Math.sin(w) * 0.3;
      if (p.tail) p.tail.rotation.y = Math.sin(w) * 0.2;
    },
    attack(p, k) { if (p.head) p.head.rotation.x = -0.25 * Math.sin(k * Math.PI); },
    hurt(p, k) { if (p.body) p.body.rotation.x = 0.12 * k; },
    faint(p, k) { if (p.body) p.body.rotation.z = k * 0.55; },
  },
  heavy: {
    idle(p, t) {
      if (p.body) p.body.scale.y = (p.body.userData.rest?.sy ?? 1) * (1 + Math.sin(t * 0.9) * 0.015);
      if (p.core) p.core.scale.setScalar(1 + Math.sin(t * 2.8) * 0.08);
      if (p.head) p.head.rotation.y = Math.sin(t * 0.4) * 0.05;
    },
    walk(p, t, spd) {
      const w = t * 3.4 * (0.55 + spd);
      if (p.leg_l) p.leg_l.rotation.x = Math.sin(w) * 0.22;
      if (p.leg_r) p.leg_r.rotation.x = -Math.sin(w) * 0.22;
      if (p.body) p.body.rotation.z = Math.sin(w) * 0.035;
      if (p.arm_l) p.arm_l.rotation.x = -Math.sin(w) * 0.12;
      if (p.arm_r) p.arm_r.rotation.x = Math.sin(w) * 0.12;
    },
    attack(p, k) {
      if (p.arm_r) p.arm_r.rotation.x = -0.9 * Math.sin(k * Math.PI);
      if (p.body) p.body.position.z = -0.1 * Math.sin(k * Math.PI);
    },
    hurt(p, k) { if (p.body) p.body.rotation.x = 0.08 * k; },
    faint(p, k) { if (p.body) p.body.rotation.z = k * 0.35; },
  },
  electric_runner: {
    idle(p, t) {
      if (p.body) p.body.scale.y = (p.body.userData.rest?.sy ?? 1) * (1 + Math.sin(t * 3.2) * 0.03);
      if (p.ear_l) p.ear_l.rotation.z = 0.2 + Math.sin(t * 6) * 0.12;
      if (p.ear_r) p.ear_r.rotation.z = -0.2 - Math.sin(t * 6 + 0.5) * 0.12;
      if (p.horn_l) p.horn_l.rotation.z = 0.18 + Math.sin(t * 4.2) * 0.06;
      if (p.horn_r) p.horn_r.rotation.z = -0.18 - Math.sin(t * 4.2 + 0.4) * 0.06;
      if (p.tail) p.tail.rotation.y = Math.sin(t * 5) * 0.2;
    },
    walk(p, t, spd) {
      const w = t * 11 * (0.8 + spd);
      ["leg_fl", "leg_br"].forEach((n) => { if (p[n]) p[n].rotation.x = Math.sin(w) * 0.7; });
      ["leg_fr", "leg_bl"].forEach((n) => { if (p[n]) p[n].rotation.x = -Math.sin(w) * 0.7; });
      if (p.body) p.body.position.y = (p.body.userData.rest?.py ?? 0) + Math.abs(Math.sin(w)) * 0.06;
    },
    attack(p, k) {
      if (p.body) p.body.position.z = -0.2 * Math.sin(k * Math.PI);
      if (p.tail) p.tail.rotation.x = -0.4 * Math.sin(k * Math.PI);
    },
    hurt(p, k) { if (p.body) p.body.rotation.z = 0.25 * k; },
    faint(p, k) { if (p.body) p.body.rotation.z = k * 0.9; },
  },
  flyer_small: {
    idle(p, t) {
      if (p.body) p.body.position.y = (p.body.userData.rest?.py ?? 0) + Math.sin(t * 2.4) * 0.04;
      if (p.wing_l) p.wing_l.rotation.z = 0.35 + Math.sin(t * 8) * 0.35;
      if (p.wing_r) p.wing_r.rotation.z = -0.35 - Math.sin(t * 8) * 0.35;
      if (p.head) p.head.rotation.y = Math.sin(t * 1.1) * 0.1;
    },
    walk(p, t, spd) {
      const w = t * 10 * (0.7 + spd);
      if (p.wing_l) p.wing_l.rotation.z = 0.5 + Math.sin(w) * 0.5;
      if (p.wing_r) p.wing_r.rotation.z = -0.5 - Math.sin(w) * 0.5;
      if (p.body) p.body.rotation.z = Math.sin(w) * 0.08;
    },
    attack(p, k) { if (p.body) p.body.position.z = -0.16 * Math.sin(k * Math.PI); },
    hurt(p, k) { if (p.wing_l) p.wing_l.rotation.z = 0.8 * k; },
    faint(p, k) { if (p.body) p.body.rotation.z = k * 1.1; },
  },
  flyer_mythic: {
    idle(p, t) {
      if (p.body) p.body.position.y = (p.body.userData.rest?.py ?? 0) + Math.sin(t * 1.4) * 0.03;
      if (p.wing_l) p.wing_l.rotation.z = 0.25 + Math.sin(t * 3.2) * 0.18;
      if (p.wing_r) p.wing_r.rotation.z = -0.25 - Math.sin(t * 3.2) * 0.18;
      if (p.tail) p.tail.rotation.y = Math.sin(t * 1.2) * 0.08;
      if (p.crown) p.crown.rotation.y = Math.sin(t * 0.6) * 0.05;
    },
    walk(p, t, spd) {
      const w = t * 5.5 * (0.6 + spd);
      if (p.wing_l) p.wing_l.rotation.z = 0.35 + Math.sin(w) * 0.28;
      if (p.wing_r) p.wing_r.rotation.z = -0.35 - Math.sin(w) * 0.28;
    },
    attack(p, k) { if (p.wing_l) p.wing_l.rotation.x = -0.3 * Math.sin(k * Math.PI); },
    hurt(p, k) { if (p.body) p.body.rotation.x = 0.12 * k; },
    faint(p, k) { if (p.body) p.body.rotation.z = k * 0.5; },
  },
  shadow_stalker: {
    idle(p, t) {
      if (p.cloak) p.cloak.rotation.y = Math.sin(t * 1.3) * 0.08;
      if (p.head) p.head.rotation.y = Math.sin(t * 0.7) * 0.14;
      if (p.tail) p.tail.rotation.x = Math.sin(t * 2) * 0.1;
    },
    walk(p, t, spd) {
      const w = t * 6 * (0.65 + spd);
      if (p.leg_l || p.leg_fl) {
        if (p.leg_fl) p.leg_fl.rotation.x = Math.sin(w) * 0.45;
        if (p.leg_fr) p.leg_fr.rotation.x = -Math.sin(w) * 0.45;
        if (p.arm_l) p.arm_l.rotation.x = -Math.sin(w) * 0.35;
        if (p.arm_r) p.arm_r.rotation.x = Math.sin(w) * 0.35;
      }
      if (p.leg_l) p.leg_l.rotation.x = Math.sin(w) * 0.4;
      if (p.leg_r) p.leg_r.rotation.x = -Math.sin(w) * 0.4;
    },
    attack(p, k) {
      if (p.arm_r) p.arm_r.rotation.x = -0.9 * Math.sin(k * Math.PI);
      if (p.body) p.body.position.z = -0.14 * Math.sin(k * Math.PI);
    },
    hurt(p, k) { if (p.body) p.body.rotation.x = 0.2 * k; },
    faint(p, k) { if (p.body) p.body.rotation.z = k * 0.85; },
  },
  light_floater: {
    idle(p, t) {
      if (p.body) p.body.position.y = (p.body.userData.rest?.py ?? 0) + Math.sin(t * 1.8) * 0.05;
      if (p.core) p.core.scale.setScalar(1 + Math.sin(t * 3) * 0.08);
      if (p.orb_l) p.orb_l.position.y = (p.orb_l.userData.rest?.py ?? 0) + Math.sin(t * 2.2) * 0.04;
      if (p.orb_r) p.orb_r.position.y = (p.orb_r.userData.rest?.py ?? 0) + Math.sin(t * 2.2 + 1) * 0.04;
    },
    walk(p, t, spd) {
      const w = t * 4.5 * (0.6 + spd);
      if (p.body) p.body.rotation.z = Math.sin(w) * 0.08;
      if (p.leg_l) p.leg_l.rotation.x = Math.sin(w) * 0.25;
      if (p.leg_r) p.leg_r.rotation.x = -Math.sin(w) * 0.25;
    },
    attack(p, k) { if (p.core) p.core.scale.setScalar(1 + 0.35 * Math.sin(k * Math.PI)); },
    hurt(p, k) { if (p.body) p.body.scale.setScalar(1 - 0.08 * k); },
    faint(p, k) { if (p.body) p.body.rotation.z = k * 0.9; },
  },
  crystal_entity: {
    idle(p, t) {
      if (p.plate_a) p.plate_a.rotation.y = t * 0.4;
      if (p.plate_b) p.plate_b.rotation.y = -t * 0.3;
      if (p.orb_l) p.orb_l.position.y = (p.orb_l.userData.rest?.py ?? 0) + Math.sin(t * 1.6) * 0.05;
      if (p.orb_r) p.orb_r.position.y = (p.orb_r.userData.rest?.py ?? 0) + Math.sin(t * 1.6 + 2) * 0.05;
      if (p.core) p.core.scale.setScalar(1 + Math.sin(t * 2.2) * 0.06);
    },
    walk(p, t, spd) {
      if (p.body) p.body.position.y = (p.body.userData.rest?.py ?? 0) + Math.sin(t * 2 * (0.6 + spd)) * 0.04;
    },
    attack(p, k) { if (p.plate_a) p.plate_a.rotation.z = 0.4 * Math.sin(k * Math.PI); },
    hurt(p, k) { if (p.body) p.body.rotation.x = 0.1 * k; },
    faint(p, k) { if (p.body) p.body.rotation.z = k * 0.4; },
  },
};

const FX_COLOR = {
  ember_tail: "#ff6a20",
  embers: "#ffd84a",
  flame: "#ff6a20",
  mist: "#80d0ff",
  leaf: "#60d090",
  spark: "#ffe680",
  storm: "#b8e0ff",
  glow: "#fff0a0",
  crystal: "#ff6a40",
  prism: "#80d8ff",
  shadow_wisp: "#6a48a0",
};

export function composeStylizedModel(def) {
  const root = new THREE.Group();
  const rig = new THREE.Group();
  rig.name = "rig";
  const nodes = { root: rig };
  for (const part of def.parts) {
    const node = new THREE.Group();
    node.name = part.name;
    node.position.set(...(part.pos ?? [0, 0, 0]));
    if (part.rot) node.rotation.set(part.rot[0], part.rot[1], part.rot[2]);
    if (part.type === "eye") {
      addEye(node, { ...part, pos: [0, 0, 0] });
    } else {
      const mesh = meshFrom(part);
      if (mesh) node.add(mesh);
    }
    const parent = nodes[part.parent] || rig;
    parent.add(node);
    nodes[part.name] = node;
    restOf(node);
  }
  for (const fx of def.effects ?? []) {
    attachEffect(nodes, fx, FX_COLOR[fx] ?? "#ffcc66");
  }
  root.add(rig);
  return { root, rig, nodes };
}

export function buildStylized3d(speciesId, art, modelDef) {
  const { root, rig, nodes } = composeStylizedModel(modelDef);
  const scale = art.scale ?? 1;
  rig.scale.setScalar(scale);

  const shadowR = art.visual?.shadowScale ?? art.shadowRadius ?? scale * 0.28;
  const shadow = new THREE.Mesh(
    geo("shadow", () => new THREE.CircleGeometry(1, 16)),
    mat("glass", "#000000", { opacity: 0.34 }),
  );
  shadow.material = new THREE.MeshBasicMaterial({ color: 0x000000, opacity: 0.32, transparent: true, depthWrite: false });
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.03;
  shadow.scale.setScalar(shadowR);
  shadow.renderOrder = -1;
  root.add(shadow);

  const height = (modelDef.height ?? 1) * scale;
  const profileName = art.visual?.animationSet ?? modelDef.profile ?? "quadruped_small";
  const profile = PROFILES[profileName] ?? PROFILES.quadruped_small;
  const effects = art.visual?.effects ?? modelDef.effects ?? [];

  const visual = {
    type: "stylized3d",
    speciesId,
    art,
    nodes,
    rig,
    shadow,
    anim: "idle",
    profile: profileName,
    effects,
    partCount: Object.keys(nodes).length,
    source: "stylized3d",
    lockUntil: 0,
    lockName: null,
    setAnimation(name) {
      const n = name === "move" ? "walk" : name;
      this.anim = n;
      if (n === "attack" || n === "hurt" || n === "faint") {
        this.lockUntil = performance.now() + (n === "faint" ? 700 : 420);
        this.lockName = n;
        this.lockT0 = performance.now();
      }
    },
    setFacing() {},
    update(t, mode, speed) {
      const now = performance.now();
      if (this.lockUntil && now > this.lockUntil) {
        this.lockUntil = 0;
        this.lockName = null;
        this.anim = "idle";
      }
      if (!this.lockUntil && (mode === "walk" || mode === "idle")) this.anim = mode;
      for (const key of Object.keys(this.nodes)) {
        const n = this.nodes[key];
        if (n?.userData?.rest && key !== "root") resetRest(n);
      }
      const fn = profile[this.anim] ?? profile.idle;
      if (this.lockName && (this.lockName === "attack" || this.lockName === "hurt" || this.lockName === "faint")) {
        const dur = this.lockName === "faint" ? 700 : 420;
        const k = Math.min(1, (now - (this.lockT0 ?? now)) / dur);
        fn(this.nodes, k, speed ?? 0);
      } else if (this.anim === "walk") {
        profile.walk(this.nodes, t, speed ?? 1);
      } else {
        profile.idle(this.nodes, t);
      }
      tickEffects(this.nodes, t, this.effects);
      const hover = root.userData.hover ?? 0;
      if (this.shadow) this.shadow.position.y = 0.03 - hover;
      const blink = Math.sin(t * 0.7);
      if (blink > 0.96) {
        ["eye_l", "eye_r"].forEach((n) => {
          if (this.nodes[n]) this.nodes[n].scale.y = 0.15;
        });
      }
    },
  };
  visual.setAnimation("idle");

  root.userData = {
    speciesId,
    height,
    renderer: "stylized3d",
    visual,
    disposeVisual() {
      // Geometrías y materiales de la caché se reutilizan: no se liberan.
      if (shadow.material && !MAT.has("shadow_basic")) shadow.material.dispose();
    },
  };
  return root;
}

export function inspectGeometryCache() {
  return { size: GEO.size, keys: [...GEO.keys()] };
}

export function inspectMaterialCache() {
  return { size: MAT.size };
}

export function countMeshes(group) {
  let n = 0;
  group?.traverse((o) => { if (o.isMesh) n++; });
  return n;
}

export { GEO, MAT, PROFILES };
