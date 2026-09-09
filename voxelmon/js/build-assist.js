/**
 * Build mode + asistencia aérea de construcción (Fase 11).
 *
 * No es Creative Mode ni vuelo libre. El hover solo existe con:
 *   1. buildMode activo (tecla B)
 *   2. unlock permanente `aerial_build_assist_unlocked`
 *
 * El unlock nace de capturar una especie con traversalAbilities: ["build_hover"].
 * Cambiar el equipo no lo quita. No se concede al cargar salvo que el Dex
 * ya tenga una captura compatible (saves antiguos).
 */

import { events } from "./events.js";
import { progression } from "./progression.js";
import { SPECIES } from "./data.js?v=13";
import {
  getRegionAt, gateIdForRegion, REGION_1, REGION_2, REGION_3, REGION_4, regions,
} from "./regions.js";

export const AERIAL_UNLOCK = "aerial_build_assist_unlocked";
export const MAX_HOVER_ABOVE = 28;
const HOVER_SPEED = 5.4;
const HOVER_VERT = 4.6;
const SAFE_EXIT_VERT = 12;
const CRITICAL_TYPES = new Set([
  "npc", "trainer", "gym", "gate", "boss", "seal",
  "ancient_path", "crimson_seal", "crimson_path", "storm_seal", "wind_seal",
  "tempest_boss", "highland_exit", "gale_channel", "pc",
]);

function speciesHasAbility(speciesId, ability) {
  return !!SPECIES[speciesId]?.traversalAbilities?.includes(ability);
}

class BuildAssist {
  constructor() {
    this.mode = false;
    this.hovering = false;
    this.safeExit = false;
    this.state = null;
    this.lastGateToast = 0;
    this.onToast = null;
  }

  attach(state) {
    this.state = state;
    this.mode = false;
    this.hovering = false;
    this.safeExit = false;
    this.reconcileUnlock();
  }

  isUnlocked() {
    return progression.isUnlocked(AERIAL_UNLOCK);
  }

  reconcileUnlock() {
    if (!this.state || this.isUnlocked()) return false;
    const caught = this.state.dex?.caught ?? {};
    for (const id of Object.keys(caught)) {
      if (caught[id] && speciesHasAbility(id, "build_hover")) {
        return progression.unlock(AERIAL_UNLOCK);
      }
    }
    return false;
  }

  considerCapture(speciesId) {
    if (speciesHasAbility(speciesId, "build_hover")) {
      return progression.unlock(AERIAL_UNLOCK);
    }
    return false;
  }

  toggleMode() {
    this.mode = !this.mode;
    if (!this.mode && this.hovering) this.beginSafeExit();
    return this.mode;
  }

  canHover() {
    return this.mode && this.isUnlocked();
  }

  beginHover() {
    if (!this.canHover()) return false;
    this.hovering = true;
    this.safeExit = false;
    return true;
  }

  beginSafeExit() {
    this.safeExit = true;
    this.hovering = true;
  }

  stopHover() {
    this.hovering = false;
    this.safeExit = false;
  }

  blocksCombat() {
    return this.mode;
  }

  blocksInteraction(item) {
    if (!this.hovering) return false;
    if (!item) return false;
    if (CRITICAL_TYPES.has(item.type)) return true;
    if (item.critical) return true;
    return false;
  }

  /**
   * ¿El destino cruza un gate cerrado o un sello de progresión?
   * No confía solo en paredes: compara región lógica origen/destino.
   */
  canMoveTo(fromX, fromZ, toX, toZ, extras = {}) {
    const fromR = getRegionAt(fromX, fromZ);
    const toR = getRegionAt(toX, toZ);
    if (toR !== fromR) {
      const gate = gateIdForRegion(toR);
      if (gate && !regions.isGateOpened(gate) && toR !== REGION_1) {
        return { ok: false, reason: "gate", regionId: toR };
      }
      // Salir hacia una región previa siempre está permitido.
      if (fromR === REGION_4 && toR !== REGION_4 && !regions.isGateOpened(REGION_4)) {
        return { ok: false, reason: "gate", regionId: REGION_4 };
      }
      if (fromR === REGION_3 && toR === REGION_4 && !regions.isGateOpened(REGION_4)) {
        return { ok: false, reason: "gate", regionId: REGION_4 };
      }
      if (fromR === REGION_2 && (toR === REGION_3 || toR === REGION_4) && !regions.isGateOpened(REGION_3)) {
        return { ok: false, reason: "gate", regionId: toR };
      }
      if (fromR === REGION_1 && toR !== REGION_1 && !regions.isGateOpened(toR === REGION_2 ? REGION_2 : toR)) {
        return { ok: false, reason: "gate", regionId: toR };
      }
    }
    if (extras.blockedZone && extras.blockedZone(toX, toZ)) {
      return { ok: false, reason: "seal" };
    }
    return { ok: true };
  }

  rejectMove(reason) {
    const now = performance.now();
    if (now - this.lastGateToast < 1600) return;
    this.lastGateToast = now;
    const msg = reason === "seal"
      ? "No puedes guiar a tu criatura más allá de este paso."
      : "No puedes guiar a tu criatura más allá de este paso.";
    this.onToast?.(msg, "bad");
  }

  hoverVelocity(keys, yaw) {
    let fx = 0, fz = 0;
    if (keys.has("KeyW")) fz -= 1;
    if (keys.has("KeyS")) fz += 1;
    if (keys.has("KeyA")) fx -= 1;
    if (keys.has("KeyD")) fx += 1;
    const len = Math.hypot(fx, fz);
    let vx = 0, vz = 0;
    if (len > 0) {
      fx /= len;
      fz /= len;
      const sin = Math.sin(yaw);
      const cos = Math.cos(yaw);
      vx = (fx * cos + fz * sin) * HOVER_SPEED;
      vz = (fz * cos - fx * sin) * HOVER_SPEED;
    }
    let vy = 0;
    if (this.safeExit) vy = -SAFE_EXIT_VERT;
    else {
      if (keys.has("Space")) vy += HOVER_VERT;
      if (keys.has("ShiftLeft") || keys.has("ShiftRight") || keys.has("ControlLeft") || keys.has("ControlRight")) {
        vy -= HOVER_VERT;
      }
    }
    return { vx, vy, vz };
  }

  snapshot() {
    const grantors = Object.values(SPECIES)
      .filter((s) => speciesHasAbility(s.id, "build_hover"))
      .map((s) => s.id);
    return {
      mode: this.mode,
      hovering: this.hovering,
      safeExit: this.safeExit,
      unlocked: this.isUnlocked(),
      grantors,
    };
  }
}

export const buildAssist = new BuildAssist();

events.on("creatureCaptured", ({ speciesId }) => {
  buildAssist.considerCapture(speciesId);
});
