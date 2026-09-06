/**
 * ProgressionSystem: hitos, desbloqueos, flags narrativos e insignias.
 * Persiste dentro de state.progression y anuncia los cambios por el EventBus
 * para que misiones, UI o logros reaccionen sin acoplarse.
 */

import { events } from "./events.js";

class ProgressionSystem {
  constructor() {
    this.data = null;
  }

  /** Conecta el sistema al estado cargado/creado de la partida. */
  attach(state) {
    this.data = state.progression;
  }

  isUnlocked(id) {
    return !!this.data?.unlocked[id];
  }

  unlock(id) {
    if (!this.data || this.data.unlocked[id]) return false;
    this.data.unlocked[id] = true;
    events.emit("progressUnlocked", { id });
    return true;
  }

  hasFlag(id) {
    return !!this.data?.flags[id];
  }

  setFlag(id) {
    if (!this.data || this.data.flags[id]) return false;
    this.data.flags[id] = true;
    events.emit("flagSet", { id });
    return true;
  }

  hasBadge(id) {
    return !!this.data?.badges[id];
  }

  addBadge(id) {
    if (!this.data || this.data.badges[id]) return false;
    this.data.badges[id] = true;
    events.emit("badgeEarned", { id });
    return true;
  }

  badgeCount() {
    return this.data ? Object.keys(this.data.badges).length : 0;
  }
}

export const progression = new ProgressionSystem();
