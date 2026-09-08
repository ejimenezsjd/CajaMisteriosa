/**
 * Definiciones declarativas de modelos 3D estilizados (Fase 10.6).
 * Coordenadas: Y arriba, frente = -Z, pies en Y=0.
 * height ≈ 1 antes de art.scale.
 */

export const STYLIZED_MODELS = {};

const P = (o) => o;

STYLIZED_MODELS.emberin = {
  profile: "quadruped_small",
  height: 1,
  effects: ["ember_tail", "embers"],
  parts: [
    P({ name: "body", type: "ellipsoid", pos: [0, 0.38, 0.04], scale: [0.46, 0.34, 0.56], color: "#e07a3a" }),
    P({ name: "belly", type: "ellipsoid", parent: "body", pos: [0, -0.02, -0.06], scale: [0.28, 0.2, 0.32], color: "#ffd080", mat: "bright" }),
    P({ name: "head", type: "ellipsoid", parent: "body", pos: [0, 0.22, -0.28], scale: [0.38, 0.36, 0.36], color: "#e07a3a" }),
    P({ name: "snout", type: "ellipsoid", parent: "head", pos: [0, -0.04, -0.16], scale: [0.16, 0.12, 0.16], color: "#ffd080" }),
    P({ name: "ear_l", type: "cone", parent: "head", pos: [-0.12, 0.18, 0.02], rot: [0.15, 0, 0.35], scale: [0.12, 0.2, 0.1], color: "#4a3028", mat: "dark" }),
    P({ name: "ear_r", type: "cone", parent: "head", pos: [0.12, 0.18, 0.02], rot: [0.15, 0, -0.35], scale: [0.12, 0.2, 0.1], color: "#4a3028", mat: "dark" }),
    P({ name: "earin_l", type: "cone", parent: "ear_l", pos: [0, 0.02, -0.02], scale: [0.06, 0.1, 0.04], color: "#ff6a20", mat: "emissive", emissive: "#ff6a20" }),
    P({ name: "earin_r", type: "cone", parent: "ear_r", pos: [0, 0.02, -0.02], scale: [0.06, 0.1, 0.04], color: "#ff6a20", mat: "emissive", emissive: "#ff6a20" }),
    P({ name: "eye_l", type: "eye", parent: "head", pos: [-0.1, 0.04, -0.15], size: 0.055 }),
    P({ name: "eye_r", type: "eye", parent: "head", pos: [0.1, 0.04, -0.15], size: 0.055 }),
    P({ name: "leg_fl", type: "taper", parent: "body", pos: [-0.12, -0.16, -0.14], scale: [0.1, 0.22, 0.1], color: "#c46830", meshPos: [0, -0.11, 0] }),
    P({ name: "leg_fr", type: "taper", parent: "body", pos: [0.12, -0.16, -0.14], scale: [0.1, 0.22, 0.1], color: "#c46830", meshPos: [0, -0.11, 0] }),
    P({ name: "leg_bl", type: "taper", parent: "body", pos: [-0.12, -0.16, 0.16], scale: [0.1, 0.22, 0.1], color: "#c46830", meshPos: [0, -0.11, 0] }),
    P({ name: "leg_br", type: "taper", parent: "body", pos: [0.12, -0.16, 0.16], scale: [0.1, 0.22, 0.1], color: "#c46830", meshPos: [0, -0.11, 0] }),
    P({ name: "tail", type: "cone", parent: "body", pos: [0, 0.04, 0.28], rot: [1.1, 0, 0], scale: [0.12, 0.28, 0.12], color: "#ff6a20", mat: "emissive", emissive: "#ff6a20", emissiveIntensity: 1 }),
    P({ name: "tail_tip", type: "icosahedron", parent: "tail", pos: [0, 0.16, 0], scale: [0.1, 0.14, 0.1], color: "#ffd84a", mat: "emissive", emissive: "#ffd84a" }),
  ],
};

STYLIZED_MODELS.brasor = {
  profile: "quadruped_athletic",
  height: 1,
  effects: ["flame", "embers"],
  parts: [
    P({ name: "body", type: "ellipsoid", pos: [0, 0.52, 0.02], scale: [0.52, 0.4, 0.72], color: "#d45520" }),
    P({ name: "shoulder_l", type: "icosahedron", parent: "body", pos: [-0.22, 0.12, -0.12], scale: [0.22, 0.18, 0.2], color: "#5a2418", mat: "dark" }),
    P({ name: "shoulder_r", type: "icosahedron", parent: "body", pos: [0.22, 0.12, -0.12], scale: [0.22, 0.18, 0.2], color: "#5a2418", mat: "dark" }),
    P({ name: "belly", type: "ellipsoid", parent: "body", pos: [0, -0.04, -0.04], scale: [0.3, 0.22, 0.4], color: "#ff9040", mat: "bright" }),
    P({ name: "head", type: "ellipsoid", parent: "body", pos: [0, 0.2, -0.38], scale: [0.34, 0.32, 0.34], color: "#d45520" }),
    P({ name: "jaw", type: "ellipsoid", parent: "head", pos: [0, -0.08, -0.14], scale: [0.2, 0.1, 0.18], color: "#5a2418", mat: "dark" }),
    P({ name: "mane", type: "cone", parent: "head", pos: [0, 0.18, 0.04], rot: [-0.4, 0, 0], scale: [0.22, 0.28, 0.16], color: "#ff6a20", mat: "emissive", emissive: "#ff6a20" }),
    P({ name: "mane2", type: "icosahedron", parent: "mane", pos: [0, 0.12, 0], scale: [0.12, 0.16, 0.1], color: "#ffd84a", mat: "emissive", emissive: "#ffd84a" }),
    P({ name: "ear_l", type: "cone", parent: "head", pos: [-0.12, 0.14, 0.04], rot: [0.1, 0, 0.45], scale: [0.08, 0.16, 0.07], color: "#3a1810", mat: "dark" }),
    P({ name: "ear_r", type: "cone", parent: "head", pos: [0.12, 0.14, 0.04], rot: [0.1, 0, -0.45], scale: [0.08, 0.16, 0.07], color: "#3a1810", mat: "dark" }),
    P({ name: "eye_l", type: "eye", parent: "head", pos: [-0.09, 0.04, -0.15], size: 0.048, brow: "#3a1810", browTilt: 0.25 }),
    P({ name: "eye_r", type: "eye", parent: "head", pos: [0.09, 0.04, -0.15], size: 0.048, brow: "#3a1810", browTilt: -0.25 }),
    P({ name: "leg_fl", type: "taper", parent: "body", pos: [-0.16, -0.18, -0.2], scale: [0.12, 0.36, 0.12], color: "#5a2418", meshPos: [0, -0.18, 0] }),
    P({ name: "leg_fr", type: "taper", parent: "body", pos: [0.16, -0.18, -0.2], scale: [0.12, 0.36, 0.12], color: "#5a2418", meshPos: [0, -0.18, 0] }),
    P({ name: "leg_bl", type: "taper", parent: "body", pos: [-0.16, -0.18, 0.22], scale: [0.13, 0.36, 0.13], color: "#5a2418", meshPos: [0, -0.18, 0] }),
    P({ name: "leg_br", type: "taper", parent: "body", pos: [0.16, -0.18, 0.22], scale: [0.13, 0.36, 0.13], color: "#5a2418", meshPos: [0, -0.18, 0] }),
    P({ name: "tail", type: "cone", parent: "body", pos: [0, 0.06, 0.36], rot: [0.9, 0, 0], scale: [0.16, 0.42, 0.16], color: "#ff6a20", mat: "emissive", emissive: "#ff6a20" }),
    P({ name: "plate", type: "dodecahedron", parent: "body", pos: [0, 0.16, 0.04], scale: [0.18, 0.1, 0.28], color: "#3a1810", mat: "dark" }),
  ],
};

STYLIZED_MODELS.infernak = {
  profile: "quadruped_mythic",
  height: 1,
  effects: ["flame", "embers", "crystal"],
  parts: [
    P({ name: "body", type: "ellipsoid", pos: [0, 0.55, 0.04], scale: [0.7, 0.48, 0.95], color: "#8a2010" }),
    P({ name: "plate_s", type: "dodecahedron", parent: "body", pos: [0, 0.2, -0.05], scale: [0.42, 0.16, 0.7], color: "#1a1010", mat: "dark" }),
    P({ name: "crack", type: "ellipsoid", parent: "body", pos: [0, 0.08, -0.02], scale: [0.12, 0.06, 0.55], color: "#ff6a20", mat: "emissive", emissive: "#ff6a20", emissiveIntensity: 1.2 }),
    P({ name: "shoulder_l", type: "icosahedron", parent: "body", pos: [-0.32, 0.14, -0.18], scale: [0.32, 0.26, 0.28], color: "#1a1010", mat: "dark" }),
    P({ name: "shoulder_r", type: "icosahedron", parent: "body", pos: [0.32, 0.14, -0.18], scale: [0.32, 0.26, 0.28], color: "#1a1010", mat: "dark" }),
    P({ name: "head", type: "ellipsoid", parent: "body", pos: [0, 0.16, -0.5], scale: [0.32, 0.28, 0.34], color: "#b83210" }),
    P({ name: "muzzle", type: "ellipsoid", parent: "head", pos: [0, -0.04, -0.16], scale: [0.2, 0.12, 0.2], color: "#3a1010", mat: "dark" }),
    P({ name: "mane", type: "cone", parent: "head", pos: [0, 0.16, 0.1], rot: [-0.7, 0, 0], scale: [0.28, 0.42, 0.2], color: "#ff6a20", mat: "emissive", emissive: "#ff6a20" }),
    P({ name: "mane2", type: "icosahedron", parent: "mane", pos: [0.08, 0.14, 0], scale: [0.12, 0.22, 0.1], color: "#ffd84a", mat: "emissive", emissive: "#ffd84a" }),
    P({ name: "horn_l", type: "cone", parent: "head", pos: [-0.1, 0.14, -0.04], rot: [0.2, 0, 0.5], scale: [0.07, 0.2, 0.07], color: "#1a1010", mat: "dark" }),
    P({ name: "horn_r", type: "cone", parent: "head", pos: [0.1, 0.14, -0.04], rot: [0.2, 0, -0.5], scale: [0.07, 0.2, 0.07], color: "#1a1010", mat: "dark" }),
    P({ name: "eye_l", type: "eye", parent: "head", pos: [-0.08, 0.05, -0.14], size: 0.05, iris: "#3a0808", white: "#ffd0a0", brow: "#1a1010", browTilt: 0.4 }),
    P({ name: "eye_r", type: "eye", parent: "head", pos: [0.08, 0.05, -0.14], size: 0.05, iris: "#3a0808", white: "#ffd0a0", brow: "#1a1010", browTilt: -0.4 }),
    P({ name: "leg_fl", type: "taper", parent: "body", pos: [-0.22, -0.16, -0.26], scale: [0.16, 0.42, 0.16], color: "#1a1010", meshPos: [0, -0.21, 0] }),
    P({ name: "leg_fr", type: "taper", parent: "body", pos: [0.22, -0.16, -0.26], scale: [0.16, 0.42, 0.16], color: "#1a1010", meshPos: [0, -0.21, 0] }),
    P({ name: "leg_bl", type: "taper", parent: "body", pos: [-0.22, -0.16, 0.28], scale: [0.18, 0.42, 0.18], color: "#1a1010", meshPos: [0, -0.21, 0] }),
    P({ name: "leg_br", type: "taper", parent: "body", pos: [0.22, -0.16, 0.28], scale: [0.18, 0.42, 0.18], color: "#1a1010", meshPos: [0, -0.21, 0] }),
    P({ name: "claw_fl", type: "cone", parent: "leg_fl", pos: [0, -0.38, -0.04], rot: [1.2, 0, 0], scale: [0.06, 0.1, 0.06], color: "#2a0808", mat: "dark" }),
    P({ name: "tail", type: "cone", parent: "body", pos: [0, 0.04, 0.48], rot: [0.7, 0, 0], scale: [0.18, 0.36, 0.18], color: "#b83210" }),
    P({ name: "flame_l", type: "cone", parent: "tail", pos: [-0.08, 0.2, 0], rot: [0.2, 0, 0.4], scale: [0.1, 0.32, 0.1], color: "#ff6a20", mat: "emissive", emissive: "#ff6a20" }),
    P({ name: "flame_r", type: "cone", parent: "tail", pos: [0.08, 0.2, 0], rot: [0.2, 0, -0.4], scale: [0.1, 0.32, 0.1], color: "#ffd84a", mat: "emissive", emissive: "#ffd84a" }),
    P({ name: "core", type: "icosahedron", parent: "body", pos: [0, 0.02, -0.2], scale: [0.14, 0.14, 0.1], color: "#ffd84a", mat: "emissive", emissive: "#ffd84a" }),
  ],
};

STYLIZED_MODELS.semilla = {
  profile: "sprout",
  height: 1,
  effects: ["leaf"],
  parts: [
    P({ name: "body", type: "ellipsoid", pos: [0, 0.32, 0], scale: [0.4, 0.42, 0.38], color: "#8a6030" }),
    P({ name: "belly", type: "ellipsoid", parent: "body", pos: [0, -0.04, -0.08], scale: [0.22, 0.2, 0.18], color: "#c4925a" }),
    P({ name: "head", type: "sphere", parent: "body", pos: [0, 0.28, -0.04], scale: [0.36, 0.34, 0.34], color: "#3dba7a" }),
    P({ name: "stem", type: "cylinder", parent: "head", pos: [0, 0.18, 0], scale: [0.05, 0.16, 0.05], color: "#187848" }),
    P({ name: "leaf_l", type: "ellipsoid", parent: "stem", pos: [-0.14, 0.06, 0], rot: [0, 0, 0.9], scale: [0.22, 0.08, 0.14], color: "#2a9860" }),
    P({ name: "leaf_r", type: "ellipsoid", parent: "stem", pos: [0.14, 0.06, 0], rot: [0, 0, -0.9], scale: [0.22, 0.08, 0.14], color: "#2a9860" }),
    P({ name: "eye_l", type: "eye", parent: "head", pos: [-0.09, 0.02, -0.14], size: 0.05 }),
    P({ name: "eye_r", type: "eye", parent: "head", pos: [0.09, 0.02, -0.14], size: 0.05 }),
    P({ name: "leg_l", type: "taper", parent: "body", pos: [-0.1, -0.18, 0.02], scale: [0.1, 0.2, 0.1], color: "#8a6030", meshPos: [0, -0.1, 0] }),
    P({ name: "leg_r", type: "taper", parent: "body", pos: [0.1, -0.18, 0.02], scale: [0.1, 0.2, 0.1], color: "#8a6030", meshPos: [0, -0.1, 0] }),
    P({ name: "cheek_l", type: "sphere", parent: "head", pos: [-0.14, -0.04, -0.08], scale: [0.08, 0.07, 0.06], color: "#80e0a8" }),
    P({ name: "cheek_r", type: "sphere", parent: "head", pos: [0.14, -0.04, -0.08], scale: [0.08, 0.07, 0.06], color: "#80e0a8" }),
  ],
};

STYLIZED_MODELS.arbusto = {
  profile: "forest",
  height: 1,
  effects: ["leaf"],
  parts: [
    P({ name: "body", type: "ellipsoid", pos: [0, 0.5, 0], scale: [0.42, 0.55, 0.36], color: "#2a9860" }),
    P({ name: "bark", type: "taper", parent: "body", pos: [0, -0.08, 0], scale: [0.28, 0.4, 0.24], color: "#6a4420", mat: "dark" }),
    P({ name: "head", type: "icosahedron", parent: "body", pos: [0, 0.32, -0.04], scale: [0.36, 0.34, 0.34], color: "#3dba7a" }),
    P({ name: "leaf_l", type: "ellipsoid", parent: "head", pos: [-0.2, 0.1, 0.04], rot: [0, 0.3, 0.6], scale: [0.28, 0.1, 0.18], color: "#187848" }),
    P({ name: "leaf_r", type: "ellipsoid", parent: "head", pos: [0.2, 0.1, 0.04], rot: [0, -0.3, -0.6], scale: [0.28, 0.1, 0.18], color: "#187848" }),
    P({ name: "leaf_c", type: "cone", parent: "head", pos: [0, 0.2, 0.02], scale: [0.14, 0.22, 0.1], color: "#60d090" }),
    P({ name: "eye_l", type: "eye", parent: "head", pos: [-0.09, 0.02, -0.14], size: 0.05, brow: "#187848", browTilt: 0.15 }),
    P({ name: "eye_r", type: "eye", parent: "head", pos: [0.09, 0.02, -0.14], size: 0.05, brow: "#187848", browTilt: -0.15 }),
    P({ name: "arm_l", type: "taper", parent: "body", pos: [-0.22, 0.08, 0], rot: [0, 0, 0.6], scale: [0.1, 0.32, 0.1], color: "#6a4420", meshPos: [0, -0.14, 0] }),
    P({ name: "arm_r", type: "taper", parent: "body", pos: [0.22, 0.08, 0], rot: [0, 0, -0.6], scale: [0.1, 0.32, 0.1], color: "#6a4420", meshPos: [0, -0.14, 0] }),
    P({ name: "leg_l", type: "taper", parent: "body", pos: [-0.1, -0.22, 0.02], scale: [0.12, 0.32, 0.12], color: "#5a3818", meshPos: [0, -0.16, 0] }),
    P({ name: "leg_r", type: "taper", parent: "body", pos: [0.1, -0.22, 0.02], scale: [0.12, 0.32, 0.12], color: "#5a3818", meshPos: [0, -0.16, 0] }),
  ],
};

STYLIZED_MODELS.silvax = {
  profile: "totem",
  height: 1,
  effects: ["leaf", "glow"],
  parts: [
    P({ name: "body", type: "taper", pos: [0, 0.55, 0], scale: [0.55, 0.85, 0.42], color: "#187848" }),
    P({ name: "bark", type: "cylinder", parent: "body", pos: [0, -0.1, 0], scale: [0.36, 0.5, 0.3], color: "#4a3018", mat: "dark" }),
    P({ name: "head", type: "icosahedron", parent: "body", pos: [0, 0.38, -0.04], scale: [0.38, 0.36, 0.36], color: "#2a9860" }),
    P({ name: "crown", type: "cone", parent: "head", pos: [-0.12, 0.22, 0], rot: [0.2, 0, 0.5], scale: [0.08, 0.36, 0.08], color: "#6a4420", mat: "dark" }),
    P({ name: "crown_r", type: "cone", parent: "head", pos: [0.12, 0.22, 0], rot: [0.2, 0, -0.5], scale: [0.08, 0.36, 0.08], color: "#6a4420", mat: "dark" }),
    P({ name: "crown_c", type: "cone", parent: "head", pos: [0, 0.28, 0.02], scale: [0.07, 0.3, 0.07], color: "#8a6030", mat: "dark" }),
    P({ name: "flower", type: "icosahedron", parent: "crown_c", pos: [0, 0.16, 0], scale: [0.12, 0.1, 0.12], color: "#e8d878", mat: "emissive", emissive: "#e8d878", emissiveIntensity: 0.55 }),
    P({ name: "leaf_l", type: "ellipsoid", parent: "body", pos: [-0.28, 0.2, 0.04], rot: [0, 0.2, 0.7], scale: [0.36, 0.1, 0.22], color: "#40c070" }),
    P({ name: "leaf_r", type: "ellipsoid", parent: "body", pos: [0.28, 0.2, 0.04], rot: [0, -0.2, -0.7], scale: [0.36, 0.1, 0.22], color: "#40c070" }),
    P({ name: "eye_l", type: "eye", parent: "head", pos: [-0.09, 0.02, -0.14], size: 0.055, iris: "#143018", brow: "#0e4020", browTilt: 0.2 }),
    P({ name: "eye_r", type: "eye", parent: "head", pos: [0.09, 0.02, -0.14], size: 0.055, iris: "#143018", brow: "#0e4020", browTilt: -0.2 }),
    P({ name: "arm_l", type: "taper", parent: "body", pos: [-0.28, 0.1, 0], rot: [0, 0, 0.45], scale: [0.12, 0.4, 0.12], color: "#4a3018", meshPos: [0, -0.18, 0] }),
    P({ name: "arm_r", type: "taper", parent: "body", pos: [0.28, 0.1, 0], rot: [0, 0, -0.45], scale: [0.12, 0.4, 0.12], color: "#4a3018", meshPos: [0, -0.18, 0] }),
    P({ name: "leg_l", type: "taper", parent: "body", pos: [-0.14, -0.28, 0.02], scale: [0.16, 0.4, 0.16], color: "#3a2410", meshPos: [0, -0.2, 0] }),
    P({ name: "leg_r", type: "taper", parent: "body", pos: [0.14, -0.28, 0.02], scale: [0.16, 0.4, 0.16], color: "#3a2410", meshPos: [0, -0.2, 0] }),
    P({ name: "moss", type: "ellipsoid", parent: "body", pos: [0, 0.08, 0.12], scale: [0.3, 0.12, 0.16], color: "#60d090" }),
  ],
};

STYLIZED_MODELS.gotita = {
  profile: "floater",
  height: 1,
  effects: ["mist"],
  parts: [
    P({ name: "body", type: "ellipsoid", pos: [0, 0.4, 0], scale: [0.4, 0.52, 0.4], color: "#3a9fe0", mat: "glass", opacity: 0.82 }),
    P({ name: "core", type: "sphere", parent: "body", pos: [0, -0.04, 0], scale: [0.22, 0.24, 0.22], color: "#80d0ff", mat: "bright" }),
    P({ name: "head", type: "sphere", parent: "body", pos: [0, 0.16, -0.04], scale: [0.28, 0.26, 0.28], color: "#3a9fe0" }),
    P({ name: "crest", type: "ellipsoid", parent: "head", pos: [0, 0.16, 0], scale: [0.16, 0.1, 0.1], color: "#e8f6ff", mat: "bright" }),
    P({ name: "eye_l", type: "eye", parent: "head", pos: [-0.07, 0.02, -0.12], size: 0.048, iris: "#1a4a70" }),
    P({ name: "eye_r", type: "eye", parent: "head", pos: [0.07, 0.02, -0.12], size: 0.048, iris: "#1a4a70" }),
    P({ name: "nub_l", type: "sphere", parent: "body", pos: [-0.1, -0.22, 0.02], scale: [0.1, 0.08, 0.1], color: "#80d0ff" }),
    P({ name: "nub_r", type: "sphere", parent: "body", pos: [0.1, -0.22, 0.02], scale: [0.1, 0.08, 0.1], color: "#80d0ff" }),
  ],
};

STYLIZED_MODELS.riazor = {
  profile: "aquatic",
  height: 1,
  effects: ["mist"],
  parts: [
    P({ name: "body", type: "ellipsoid", pos: [0, 0.42, 0.04], scale: [0.36, 0.34, 0.78], color: "#2080c8" }),
    P({ name: "belly", type: "ellipsoid", parent: "body", pos: [0, -0.06, 0], scale: [0.22, 0.16, 0.5], color: "#80d0ff", mat: "bright" }),
    P({ name: "head", type: "ellipsoid", parent: "body", pos: [0, 0.08, -0.36], scale: [0.3, 0.26, 0.32], color: "#2080c8" }),
    P({ name: "snout", type: "ellipsoid", parent: "head", pos: [0, -0.02, -0.16], scale: [0.14, 0.1, 0.18], color: "#50b8f0" }),
    P({ name: "fin_l", type: "ellipsoid", parent: "body", pos: [-0.2, 0.02, -0.04], rot: [0, 0.2, 0.9], scale: [0.28, 0.06, 0.16], color: "#50b8f0" }),
    P({ name: "fin_r", type: "ellipsoid", parent: "body", pos: [0.2, 0.02, -0.04], rot: [0, -0.2, -0.9], scale: [0.28, 0.06, 0.16], color: "#50b8f0" }),
    P({ name: "dorsal", type: "cone", parent: "body", pos: [0, 0.18, 0], rot: [0.2, 0, 0], scale: [0.08, 0.22, 0.16], color: "#1060a0" }),
    P({ name: "tail", type: "ellipsoid", parent: "body", pos: [0, 0.02, 0.4], scale: [0.08, 0.22, 0.2], color: "#50b8f0" }),
    P({ name: "eye_l", type: "eye", parent: "head", pos: [-0.08, 0.04, -0.12], size: 0.046, iris: "#0a3050" }),
    P({ name: "eye_r", type: "eye", parent: "head", pos: [0.08, 0.04, -0.12], size: 0.046, iris: "#0a3050" }),
    P({ name: "leg_l", type: "taper", parent: "body", pos: [-0.1, -0.14, -0.12], scale: [0.08, 0.16, 0.1], color: "#1060a0", meshPos: [0, -0.08, 0] }),
    P({ name: "leg_r", type: "taper", parent: "body", pos: [0.1, -0.14, -0.12], scale: [0.08, 0.16, 0.1], color: "#1060a0", meshPos: [0, -0.08, 0] }),
  ],
};

STYLIZED_MODELS.tsunark = {
  profile: "aquatic_guardian",
  height: 1,
  effects: ["mist", "glow"],
  parts: [
    P({ name: "body", type: "ellipsoid", pos: [0, 0.55, 0.02], scale: [0.62, 0.55, 0.85], color: "#1060a0" }),
    P({ name: "belly", type: "ellipsoid", parent: "body", pos: [0, -0.08, -0.04], scale: [0.36, 0.28, 0.5], color: "#40a0e0", mat: "bright" }),
    P({ name: "head", type: "icosahedron", parent: "body", pos: [0, 0.16, -0.42], scale: [0.4, 0.34, 0.38], color: "#1060a0" }),
    P({ name: "crest", type: "cone", parent: "head", pos: [0, 0.2, 0.02], rot: [-0.2, 0, 0], scale: [0.1, 0.36, 0.22], color: "#40a0e0", mat: "bright" }),
    P({ name: "jaw", type: "ellipsoid", parent: "head", pos: [0, -0.1, -0.12], scale: [0.24, 0.12, 0.22], color: "#0a4068", mat: "dark" }),
    P({ name: "fin_l", type: "ellipsoid", parent: "body", pos: [-0.32, 0.06, -0.04], rot: [0, 0.15, 0.75], scale: [0.4, 0.08, 0.22], color: "#40a0e0" }),
    P({ name: "fin_r", type: "ellipsoid", parent: "body", pos: [0.32, 0.06, -0.04], rot: [0, -0.15, -0.75], scale: [0.4, 0.08, 0.22], color: "#40a0e0" }),
    P({ name: "tail", type: "ellipsoid", parent: "body", pos: [0, 0.04, 0.46], scale: [0.12, 0.32, 0.28], color: "#40a0e0" }),
    P({ name: "eye_l", type: "eye", parent: "head", pos: [-0.1, 0.05, -0.14], size: 0.055, iris: "#041828", white: "#d8f0ff", brow: "#0a3050", browTilt: 0.2 }),
    P({ name: "eye_r", type: "eye", parent: "head", pos: [0.1, 0.05, -0.14], size: 0.055, iris: "#041828", white: "#d8f0ff", brow: "#0a3050", browTilt: -0.2 }),
    P({ name: "leg_l", type: "taper", parent: "body", pos: [-0.16, -0.2, -0.12], scale: [0.14, 0.32, 0.16], color: "#0a4068", meshPos: [0, -0.16, 0] }),
    P({ name: "leg_r", type: "taper", parent: "body", pos: [0.16, -0.2, -0.12], scale: [0.14, 0.32, 0.16], color: "#0a4068", meshPos: [0, -0.16, 0] }),
    P({ name: "core", type: "sphere", parent: "body", pos: [0, 0.04, -0.16], scale: [0.14, 0.14, 0.1], color: "#80d0ff", mat: "emissive", emissive: "#80d0ff", emissiveIntensity: 0.7 }),
  ],
};

STYLIZED_MODELS.titanor = {
  profile: "heavy",
  height: 1,
  effects: ["crystal", "embers"],
  parts: [
    P({ name: "body", type: "dodecahedron", pos: [0, 0.58, 0.04], scale: [0.85, 0.7, 0.62], color: "#8a6030" }),
    P({ name: "chest", type: "icosahedron", parent: "body", pos: [0, 0.02, -0.18], scale: [0.55, 0.48, 0.32], color: "#5a3c20", mat: "dark" }),
    P({ name: "core", type: "icosahedron", parent: "chest", pos: [0, 0.02, -0.12], scale: [0.2, 0.22, 0.12], color: "#e07030", mat: "emissive", emissive: "#ff6a30", emissiveIntensity: 1.15 }),
    P({ name: "shoulder_l", type: "dodecahedron", parent: "body", pos: [-0.42, 0.18, -0.04], scale: [0.38, 0.32, 0.32], color: "#5a3c20", mat: "dark" }),
    P({ name: "shoulder_r", type: "icosahedron", parent: "body", pos: [0.48, 0.12, 0.02], scale: [0.32, 0.36, 0.3], color: "#6a4424", mat: "dark" }),
    P({ name: "head", type: "icosahedron", parent: "body", pos: [0, 0.28, -0.28], scale: [0.26, 0.24, 0.26], color: "#8a6030" }),
    P({ name: "brow", type: "ellipsoid", parent: "head", pos: [0, 0.08, -0.08], scale: [0.22, 0.06, 0.1], color: "#3a2410", mat: "dark" }),
    P({ name: "eye_l", type: "eye", parent: "head", pos: [-0.06, 0.02, -0.1], size: 0.045, iris: "#1a0808", white: "#f0e0c0" }),
    P({ name: "eye_r", type: "eye", parent: "head", pos: [0.06, 0.02, -0.1], size: 0.045, iris: "#1a0808", white: "#f0e0c0" }),
    P({ name: "horn_l", type: "cone", parent: "head", pos: [-0.08, 0.12, 0], rot: [0.15, 0, 0.4], scale: [0.07, 0.16, 0.07], color: "#c04040", mat: "emissive", emissive: "#c04040", emissiveIntensity: 0.5 }),
    P({ name: "horn_r", type: "cone", parent: "head", pos: [0.1, 0.1, 0.02], rot: [0.2, 0, -0.55], scale: [0.06, 0.14, 0.06], color: "#e07030", mat: "emissive", emissive: "#e07030" }),
    P({ name: "arm_l", type: "taper", parent: "shoulder_l", pos: [-0.08, -0.18, 0], scale: [0.2, 0.45, 0.2], color: "#8a6030", meshPos: [0, -0.22, 0] }),
    P({ name: "arm_r", type: "taper", parent: "shoulder_r", pos: [0.06, -0.16, 0], scale: [0.18, 0.4, 0.18], color: "#8a6030", meshPos: [0, -0.2, 0] }),
    P({ name: "fist_l", type: "dodecahedron", parent: "arm_l", pos: [0, -0.4, 0], scale: [0.2, 0.16, 0.2], color: "#5a3c20", mat: "dark" }),
    P({ name: "leg_l", type: "taper", parent: "body", pos: [-0.18, -0.28, 0.04], scale: [0.22, 0.42, 0.22], color: "#5a3c20", meshPos: [0, -0.21, 0] }),
    P({ name: "leg_r", type: "taper", parent: "body", pos: [0.2, -0.28, 0.06], scale: [0.2, 0.4, 0.2], color: "#5a3c20", meshPos: [0, -0.2, 0] }),
    P({ name: "crack", type: "ellipsoid", parent: "body", pos: [0.08, 0.04, 0.1], scale: [0.06, 0.4, 0.08], color: "#e07030", mat: "emissive", emissive: "#ff6a30" }),
  ],
};

export function getStylizedModel(id) {
  return STYLIZED_MODELS[id] ?? null;
}

export function listStylizedSpecies() {
  return Object.keys(STYLIZED_MODELS);
}
