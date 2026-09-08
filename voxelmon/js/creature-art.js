/**
 * Catálogo data-driven de arte de criaturas (Fase 10.5).
 *
 * Una entrada por speciesId. El renderer decide pixel vs voxel; el gameplay
 * nunca consulta rutas de archivo. Sustituir un PNG en assets/creatures/
 * no requiere tocar este módulo salvo el frameSize si cambia la rejilla.
 *
 * Spritesheet (convención única):
 *   voxelmon/assets/creatures/<speciesId>.png
 *   columnas = 4 frames
 *   filas    = idle, walk, hurt, attack  (4)
 *   UV origin: esquina superior izquierda de cada frame
 */

export const SHEET_COLS = 4;
export const SHEET_ROWS = 4;
export const ANIM_ROWS = { idle: 0, walk: 1, hurt: 2, attack: 3 };

/** Preferencia de desarrollo: auto | pixel | voxel. No se persiste. */
let preferredRenderer = "auto";

export function getPreferredRenderer() {
  return preferredRenderer;
}

export function setPreferredRenderer(mode) {
  if (mode === "pixel" || mode === "voxel" || mode === "auto") preferredRenderer = mode;
  return preferredRenderer;
}

/**
 * Escala de mundo (bloques de alto visual). El archivo puede ser 32 o 48;
 * el tamaño en mundo lo marca `scale`, no la resolución.
 */
export const CREATURE_ART = {
  emberin: {
    speciesId: "emberin",
    renderer: "pixel",
    src: "assets/creatures/emberin.png",
    frameSize: { width: 32, height: 32 },
    scale: 1.05,
    anchorY: 0.02,
    shadow: true,
    shadowRadius: 0.32,
    concept: "mustélido volcánico de orejas de basalto y cola-brasa",
  },
  brasor: {
    speciesId: "brasor",
    renderer: "pixel",
    src: "assets/creatures/brasor.png",
    frameSize: { width: 32, height: 32 },
    scale: 1.45,
    anchorY: 0.02,
    shadow: true,
    shadowRadius: 0.42,
    concept: "evolución: crin de magma y pecho de carbón vivo",
  },
  gotita: {
    speciesId: "gotita",
    renderer: "pixel",
    src: "assets/creatures/gotita.png",
    frameSize: { width: 32, height: 32 },
    scale: 0.95,
    anchorY: 0.02,
    shadow: true,
    shadowRadius: 0.28,
    concept: "gota andante con cresta de espuma",
  },
  semilla: {
    speciesId: "semilla",
    renderer: "pixel",
    src: "assets/creatures/semilla.png",
    frameSize: { width: 32, height: 32 },
    scale: 1.0,
    anchorY: 0.02,
    shadow: true,
    shadowRadius: 0.3,
    concept: "bellota-sprout con dos cotiledones por orejas",
  },
  chispin: {
    speciesId: "chispin",
    renderer: "pixel",
    src: "assets/creatures/chispin.png",
    frameSize: { width: 32, height: 32 },
    scale: 0.98,
    anchorY: 0.02,
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
    anchorY: 0.02,
    shadow: true,
    shadowRadius: 0.34,
    concept: "gólem-canto con cristal incrustado",
  },
  titanor: {
    speciesId: "titanor",
    renderer: "pixel",
    src: "assets/creatures/titanor.png",
    frameSize: { width: 48, height: 48 },
    scale: 2.55,
    anchorY: 0.03,
    shadow: true,
    shadowRadius: 0.85,
    concept: "coloso mineral de placas y vetas de magma (presencia de boss)",
  },
  plumin: {
    speciesId: "plumin",
    renderer: "pixel",
    src: "assets/creatures/plumin.png",
    frameSize: { width: 32, height: 32 },
    scale: 0.92,
    anchorY: 0.04,
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
    anchorY: 0.02,
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
    anchorY: 0.03,
    shadow: true,
    shadowRadius: 0.3,
    concept: "linterna-bicho de abdomen farol y antenas",
  },
};

export function getCreatureArt(speciesId) {
  return CREATURE_ART[speciesId] ?? null;
}

export function isPixelSpecies(speciesId) {
  const art = CREATURE_ART[speciesId];
  if (!art || art.renderer !== "pixel") return false;
  if (preferredRenderer === "voxel") return false;
  return true;
}

export function listPixelSpecies() {
  return Object.keys(CREATURE_ART).filter((id) => CREATURE_ART[id].renderer === "pixel");
}
