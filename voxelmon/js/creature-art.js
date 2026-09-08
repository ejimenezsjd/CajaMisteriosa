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
  },
  infernak: {
    speciesId: "infernak",
    renderer: "stylized3d",
    scale: 2.08,
    shadow: true,
    shadowRadius: 0.62,
    concept: "felino volcánico mítico, obsidiana y melena de fuego",
    visual: { model: "infernak", shadowScale: 0.62, animationSet: "quadruped_mythic", effects: ["flame", "embers", "crystal"] },
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
  },
  riazor: {
    speciesId: "riazor",
    renderer: "stylized3d",
    scale: 1.32,
    shadow: true,
    shadowRadius: 0.4,
    concept: "nutria-aleta de río, no una gota agrandada",
    visual: { model: "riazor", shadowScale: 0.4, animationSet: "aquatic", effects: ["mist"] },
  },
  tsunark: {
    speciesId: "tsunark",
    renderer: "stylized3d",
    scale: 1.95,
    shadow: true,
    shadowRadius: 0.58,
    concept: "guardián de marea, cresta y núcleo de agua",
    visual: { model: "tsunark", shadowScale: 0.58, animationSet: "aquatic_guardian", effects: ["mist", "glow"] },
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
  },
  arbusto: {
    speciesId: "arbusto",
    renderer: "stylized3d",
    scale: 1.28,
    shadow: true,
    shadowRadius: 0.38,
    concept: "caminante del sotobosque, brazos de rama",
    visual: { model: "arbusto", shadowScale: 0.38, animationSet: "forest", effects: ["leaf"] },
  },
  silvax: {
    speciesId: "silvax",
    renderer: "stylized3d",
    scale: 2.02,
    shadow: true,
    shadowRadius: 0.6,
    concept: "tótem vegetal ancestral, astas-rama y flor",
    visual: { model: "silvax", shadowScale: 0.6, animationSet: "totem", effects: ["leaf", "glow"] },
  },
  chispin: {
    speciesId: "chispin",
    renderer: "pixel",
    src: "assets/creatures/chispin.png",
    frameSize: { width: 32, height: 32 },
    scale: 0.98,
    shadow: true,
    shadowRadius: 0.28,
    concept: "roedor de orejas-rayo y cola chispa",
  },
  piedrita: {
    speciesId: "piedrita",
    renderer: "pixel",
    src: "assets/creatures/piedrita.png",
    frameSize: { width: 32, height: 32 },
    scale: 1.0,
    shadow: true,
    shadowRadius: 0.34,
    concept: "gólem-canto con cristal incrustado",
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
  },
  plumin: {
    speciesId: "plumin",
    renderer: "pixel",
    src: "assets/creatures/plumin.png",
    frameSize: { width: 32, height: 32 },
    scale: 0.92,
    shadow: true,
    shadowRadius: 0.26,
    concept: "polluelo de pico corto y moño de pluma",
  },
  umbra: {
    speciesId: "umbra",
    renderer: "pixel",
    src: "assets/creatures/umbra.png",
    frameSize: { width: 32, height: 32 },
    scale: 1.08,
    shadow: true,
    shadowRadius: 0.3,
    concept: "manto hueco con dos ojos-luna y jirones",
  },
  lucier: {
    speciesId: "lucier",
    renderer: "pixel",
    src: "assets/creatures/lucier.png",
    frameSize: { width: 32, height: 32 },
    scale: 1.02,
    shadow: true,
    shadowRadius: 0.3,
    concept: "linterna-bicho de abdomen farol y antenas",
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
