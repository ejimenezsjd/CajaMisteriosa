/**
 * Catálogo data-driven de arte de criaturas (Fase 10.5 + 10.6).
 *
 * Renderer preferido por especie: stylized3d | pixel | voxel.
 * El gameplay nunca consulta rutas. El fallback es:
 *   stylized3d → pixel → voxel
 *
 * Spritesheet pixel (sigue vigente como fallback/dev):
 *   voxelmon/assets/creatures/<speciesId>.png
 *   4×4 idle/walk/hurt/attack
 */

export const SHEET_COLS = 4;
export const SHEET_ROWS = 4;
export const ANIM_ROWS = { idle: 0, walk: 1, hurt: 2, attack: 3 };

/** Preferencia de desarrollo: auto | stylized3d | pixel | voxel. No se persiste. */
let preferredRenderer = "auto";

export function getPreferredRenderer() {
  return preferredRenderer;
}

export function setPreferredRenderer(mode) {
  if (mode === "pixel" || mode === "voxel" || mode === "auto" || mode === "stylized3d") {
    preferredRenderer = mode;
  }
  return preferredRenderer;
}

export const CREATURE_ART = {
  emberin: {
    speciesId: "emberin",
    renderer: "stylized3d",
    src: "assets/creatures/emberin.png",
    frameSize: { width: 32, height: 32 },
    scale: 0.94,
    anchorY: 0.02,
    shadow: true,
    shadowRadius: 0.28,
    concept: "mustélido volcánico de orejas de basalto y cola-brasa",
    visual: { model: "emberin", shadowScale: 0.3, animationSet: "quadruped_small", effects: ["ember_tail", "embers"] },
    portraitScale: 1.15, portraitYaw: 0.4, portraitPitch: -0.08, portraitOffsetY: -0.05,
  },
  brasor: {
    speciesId: "brasor",
    renderer: "stylized3d",
    src: "assets/creatures/brasor.png",
    frameSize: { width: 32, height: 32 },
    scale: 1.38,
    shadow: true,
    shadowRadius: 0.4,
    concept: "depredador juvenil de magma, placas y cola de fuego",
    visual: { model: "brasor", shadowScale: 0.42, animationSet: "quadruped_athletic", effects: ["flame", "embers"] },
    portraitScale: 0.95, portraitYaw: 0.4, portraitPitch: -0.1, portraitOffsetY: -0.08,
  },
  infernak: {
    speciesId: "infernak",
    renderer: "stylized3d",
    scale: 2.08,
    shadow: true,
    shadowRadius: 0.62,
    concept: "felino volcánico mítico, obsidiana y melena de fuego",
    visual: { model: "infernak", shadowScale: 0.62, animationSet: "quadruped_mythic", effects: ["flame", "embers", "crystal"] },
    portraitScale: 0.72, portraitYaw: 0.35, portraitPitch: -0.12, portraitOffsetY: -0.12,
  },
  gotita: {
    speciesId: "gotita",
    renderer: "stylized3d",
    src: "assets/creatures/gotita.png",
    frameSize: { width: 32, height: 32 },
    scale: 0.78,
    shadow: true,
    shadowRadius: 0.24,
    concept: "gota andante con cresta de espuma",
    visual: { model: "gotita", shadowScale: 0.24, animationSet: "floater", effects: ["mist"] },
    portraitScale: 1.2, portraitYaw: 0.35, portraitPitch: -0.05, portraitOffsetY: -0.06,
  },
  riazor: {
    speciesId: "riazor",
    renderer: "stylized3d",
    scale: 1.32,
    shadow: true,
    shadowRadius: 0.4,
    concept: "nutria-aleta de río, no una gota agrandada",
    visual: { model: "riazor", shadowScale: 0.4, animationSet: "aquatic", effects: ["mist"] },
    portraitScale: 0.95, portraitYaw: 0.45, portraitPitch: -0.08, portraitOffsetY: -0.08,
  },
  tsunark: {
    speciesId: "tsunark",
    renderer: "stylized3d",
    scale: 1.95,
    shadow: true,
    shadowRadius: 0.58,
    concept: "guardián de marea, cresta y núcleo de agua",
    visual: { model: "tsunark", shadowScale: 0.58, animationSet: "aquatic_guardian", effects: ["mist", "glow"] },
    portraitScale: 0.75, portraitYaw: 0.4, portraitPitch: -0.1, portraitOffsetY: -0.1,
  },
  semilla: {
    speciesId: "semilla",
    renderer: "stylized3d",
    src: "assets/creatures/semilla.png",
    frameSize: { width: 32, height: 32 },
    scale: 0.82,
    shadow: true,
    shadowRadius: 0.26,
    concept: "bellota-sprout con cotiledones por orejas",
    visual: { model: "semilla", shadowScale: 0.26, animationSet: "sprout", effects: ["leaf"] },
    portraitScale: 1.15, portraitYaw: 0.35, portraitPitch: -0.06, portraitOffsetY: -0.05,
  },
  arbusto: {
    speciesId: "arbusto",
    renderer: "stylized3d",
    scale: 1.28,
    shadow: true,
    shadowRadius: 0.38,
    concept: "caminante del sotobosque, brazos de rama",
    visual: { model: "arbusto", shadowScale: 0.38, animationSet: "forest", effects: ["leaf"] },
    portraitScale: 0.95, portraitYaw: 0.35, portraitPitch: -0.08, portraitOffsetY: -0.08,
  },
  silvax: {
    speciesId: "silvax",
    renderer: "stylized3d",
    scale: 2.02,
    shadow: true,
    shadowRadius: 0.6,
    concept: "tótem vegetal ancestral, astas-rama y flor",
    visual: { model: "silvax", shadowScale: 0.6, animationSet: "totem", effects: ["leaf", "glow"] },
    portraitScale: 0.7, portraitYaw: 0.3, portraitPitch: -0.12, portraitOffsetY: -0.12,
  },
  chispin: {
    speciesId: "chispin",
    renderer: "stylized3d",
    src: "assets/creatures/chispin.png",
    frameSize: { width: 32, height: 32 },
    scale: 0.86,
    shadow: true,
    shadowRadius: 0.26,
    concept: "batería viva de antenas conductoras y cola-chispa",
    visual: { model: "chispin", shadowScale: 0.26, animationSet: "electric_runner", effects: ["spark"] },
    portraitScale: 1.15, portraitYaw: 0.4, portraitPitch: -0.06, portraitOffsetY: -0.04,
  },
  voltajo: {
    speciesId: "voltajo",
    renderer: "stylized3d",
    scale: 1.34,
    shadow: true,
    shadowRadius: 0.4,
    concept: "corredor de tormenta, placas y cola horquilla",
    visual: { model: "voltajo", shadowScale: 0.4, animationSet: "electric_runner", effects: ["spark"] },
    portraitScale: 0.95, portraitYaw: 0.4, portraitPitch: -0.1, portraitOffsetY: -0.08,
  },
  truena: {
    speciesId: "truena",
    renderer: "stylized3d",
    scale: 1.98,
    shadow: true,
    shadowRadius: 0.56,
    concept: "depredador de tormenta, cresta-relámpago y cola partida",
    visual: { model: "truena", shadowScale: 0.56, animationSet: "electric_runner", effects: ["spark", "glow"] },
    portraitScale: 0.72, portraitYaw: 0.35, portraitPitch: -0.12, portraitOffsetY: -0.1,
  },
  piedrita: {
    speciesId: "piedrita",
    renderer: "stylized3d",
    src: "assets/creatures/piedrita.png",
    frameSize: { width: 32, height: 32 },
    scale: 0.84,
    shadow: true,
    shadowRadius: 0.3,
    concept: "mineral bebé con cristal ámbar heredado por Titanor",
    visual: { model: "piedrita", shadowScale: 0.3, animationSet: "sprout", effects: ["crystal"] },
    portraitScale: 1.15, portraitYaw: 0.35, portraitPitch: -0.06, portraitOffsetY: -0.04,
  },
  rocal: {
    speciesId: "rocal",
    renderer: "stylized3d",
    scale: 1.42,
    shadow: true,
    shadowRadius: 0.48,
    concept: "cuadrúpedo blindado, placas y grieta de magma",
    visual: { model: "rocal", shadowScale: 0.48, animationSet: "heavy", effects: ["crystal"] },
    portraitScale: 0.9, portraitYaw: 0.4, portraitPitch: -0.1, portraitOffsetY: -0.08,
  },
  titanor: {
    speciesId: "titanor",
    renderer: "stylized3d",
    src: "assets/creatures/titanor.png",
    frameSize: { width: 48, height: 48 },
    scale: 3.15,
    shadow: true,
    shadowRadius: 1.05,
    concept: "coloso mineral ancestral, núcleo de magma, cabeza pequeña",
    visual: { model: "titanor", shadowScale: 1.05, animationSet: "heavy", effects: ["crystal", "embers"] },
    portraitScale: 0.55, portraitYaw: 0.35, portraitPitch: -0.14, portraitOffsetY: -0.16,
  },
  plumin: {
    speciesId: "plumin",
    renderer: "stylized3d",
    src: "assets/creatures/plumin.png",
    frameSize: { width: 32, height: 32 },
    scale: 0.8,
    shadow: true,
    shadowRadius: 0.24,
    concept: "planeador curioso de alas cortas y moño",
    visual: { model: "plumin", shadowScale: 0.24, animationSet: "flyer_small", effects: ["mist"] },
    portraitScale: 1.2, portraitYaw: 0.45, portraitPitch: -0.05, portraitOffsetY: -0.04,
  },
  alazan: {
    speciesId: "alazan",
    renderer: "stylized3d",
    scale: 1.36,
    shadow: true,
    shadowRadius: 0.4,
    concept: "planeador atlántico, cresta y cola larga",
    visual: { model: "alazan", shadowScale: 0.4, animationSet: "flyer_small", effects: ["mist"] },
    portraitScale: 0.95, portraitYaw: 0.5, portraitPitch: -0.08, portraitOffsetY: -0.08,
  },
  celestor: {
    speciesId: "celestor",
    renderer: "stylized3d",
    scale: 1.92,
    shadow: true,
    shadowRadius: 0.55,
    concept: "guardián celeste, alas amplias y corona de viento",
    visual: { model: "celestor", shadowScale: 0.55, animationSet: "flyer_mythic", effects: ["mist", "glow"] },
    portraitScale: 0.7, portraitYaw: 0.45, portraitPitch: -0.1, portraitOffsetY: -0.1,
  },
  umbra: {
    speciesId: "umbra",
    renderer: "stylized3d",
    src: "assets/creatures/umbra.png",
    frameSize: { width: 32, height: 32 },
    scale: 0.88,
    shadow: true,
    shadowRadius: 0.26,
    concept: "manto esquivo con ojos-luna, no una bola negra",
    visual: { model: "umbra", shadowScale: 0.26, animationSet: "shadow_stalker", effects: ["shadow_wisp"] },
    portraitScale: 1.15, portraitYaw: 0.35, portraitPitch: -0.06, portraitOffsetY: -0.05,
  },
  sombrio: {
    speciesId: "sombrio",
    renderer: "stylized3d",
    scale: 1.36,
    shadow: true,
    shadowRadius: 0.38,
    concept: "predador enmascarado de extremidades largas",
    visual: { model: "sombrio", shadowScale: 0.38, animationSet: "shadow_stalker", effects: ["shadow_wisp"] },
    portraitScale: 0.92, portraitYaw: 0.35, portraitPitch: -0.1, portraitOffsetY: -0.08,
  },
  nocrix: {
    speciesId: "nocrix",
    renderer: "stylized3d",
    scale: 1.95,
    shadow: true,
    shadowRadius: 0.52,
    concept: "depredador nocturno, manto y cuernos, aún capturable",
    visual: { model: "nocrix", shadowScale: 0.52, animationSet: "shadow_stalker", effects: ["shadow_wisp", "glow"] },
    portraitScale: 0.72, portraitYaw: 0.35, portraitPitch: -0.12, portraitOffsetY: -0.1,
  },
  lucier: {
    speciesId: "lucier",
    renderer: "stylized3d",
    src: "assets/creatures/lucier.png",
    frameSize: { width: 32, height: 32 },
    scale: 0.82,
    shadow: true,
    shadowRadius: 0.24,
    concept: "linterna-saltarín con núcleo y antenas",
    visual: { model: "lucier", shadowScale: 0.24, animationSet: "light_floater", effects: ["glow"] },
    portraitScale: 1.18, portraitYaw: 0.35, portraitPitch: -0.05, portraitOffsetY: -0.04,
  },
  clarion: {
    speciesId: "clarion",
    renderer: "stylized3d",
    scale: 1.34,
    shadow: true,
    shadowRadius: 0.36,
    concept: "elegancia de luz, cristales orbitales y cola luminosa",
    visual: { model: "clarion", shadowScale: 0.36, animationSet: "light_floater", effects: ["glow"] },
    portraitScale: 0.95, portraitYaw: 0.35, portraitPitch: -0.08, portraitOffsetY: -0.08,
  },
  aureon: {
    speciesId: "aureon",
    renderer: "stylized3d",
    scale: 2.0,
    shadow: true,
    shadowRadius: 0.52,
    concept: "ace de luz, halo roto y orbes, emissive contenido",
    visual: { model: "aureon", shadowScale: 0.52, animationSet: "light_floater", effects: ["glow"] },
    portraitScale: 0.7, portraitYaw: 0.35, portraitPitch: -0.12, portraitOffsetY: -0.1,
  },
  prismaton: {
    speciesId: "prismaton",
    renderer: "stylized3d",
    scale: 2.15,
    shadow: true,
    shadowRadius: 0.6,
    concept: "entidad prismática legendaria, placas y órbitas, no un cristal suelto",
    visual: { model: "prismaton", shadowScale: 0.6, animationSet: "crystal_entity", effects: ["prism", "glow"] },
    portraitScale: 0.68, portraitYaw: 0.4, portraitPitch: -0.1, portraitOffsetY: -0.12,
  },
  brisin: {
    speciesId: "brisin",
    renderer: "stylized3d",
    scale: 0.82,
    shadow: true,
    shadowRadius: 0.24,
    concept: "mamífero bebé con orejas-vela, no un pájaro",
    visual: { model: "brisin", shadowScale: 0.24, animationSet: "quadruped_small", effects: ["mist"] },
    portraitScale: 1.2, portraitYaw: 0.4, portraitPitch: -0.05, portraitOffsetY: -0.04,
  },
  vendal: {
    speciesId: "vendal",
    renderer: "stylized3d",
    scale: 1.4,
    shadow: true,
    shadowRadius: 0.4,
    concept: "planeador de membranas, silueta de cometa viva",
    visual: { model: "vendal", shadowScale: 0.4, animationSet: "flyer_small", effects: ["mist"] },
    portraitScale: 0.92, portraitYaw: 0.45, portraitPitch: -0.08, portraitOffsetY: -0.08,
  },
  cefiron: {
    speciesId: "cefiron",
    renderer: "stylized3d",
    scale: 2.05,
    shadow: true,
    shadowRadius: 0.6,
    concept: "bestia del vendaval, velas épicas y quilla luminosa",
    visual: { model: "cefiron", shadowScale: 0.6, animationSet: "flyer_mythic", effects: ["mist", "glow"] },
    portraitScale: 0.68, portraitYaw: 0.4, portraitPitch: -0.12, portraitOffsetY: -0.1,
    battleCameraDistance: 9.6,
    battleVisualOffset: 0.4,
  },
  cirrith: {
    speciesId: "cirrith",
    renderer: "stylized3d",
    scale: 1.28,
    shadow: true,
    shadowRadius: 0.34,
    concept: "cometa de cristal eléctrico, rara de las cumbres",
    visual: { model: "cirrith", shadowScale: 0.34, animationSet: "crystal_entity", effects: ["glow"] },
    portraitScale: 1.05, portraitYaw: 0.35, portraitPitch: -0.08, portraitOffsetY: -0.06,
  },
  nimbora: {
    speciesId: "nimbora",
    renderer: "stylized3d",
    scale: 2.35,
    shadow: true,
    shadowRadius: 0.72,
    concept: "centinela de tormenta: veleta viva, placas de viento y corona de cristal, no un dragón",
    visual: { model: "nimbora", shadowScale: 0.72, animationSet: "flyer_mythic", effects: ["storm", "mist", "spark"] },
    portraitScale: 0.58, portraitYaw: 0.38, portraitPitch: -0.14, portraitOffsetY: -0.12,
    battleCameraDistance: 10.5,
    battleVisualOffset: 0.55,
  },
};

export function getCreatureArt(speciesId) {
  return CREATURE_ART[speciesId] ?? null;
}

export function hasPixelArt(speciesId) {
  const art = CREATURE_ART[speciesId];
  return !!(art && (art.src || art.renderer === "pixel" || art.frameSize));
}

export function isPixelSpecies(speciesId) {
  if (preferredRenderer === "voxel" || preferredRenderer === "stylized3d") return false;
  return hasPixelArt(speciesId);
}

export function listPixelSpecies() {
  return Object.keys(CREATURE_ART).filter((id) => CREATURE_ART[id].src || CREATURE_ART[id].frameSize);
}

export function listArtSpecies() {
  return Object.keys(CREATURE_ART);
}
