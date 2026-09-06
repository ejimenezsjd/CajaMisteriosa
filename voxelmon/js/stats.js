/**
 * Estadísticas de la partida: se alimentan del EventBus (sin que el gameplay
 * las conozca) y persisten en state.stats. Servirán para misiones, logros y
 * progresión.
 */

import { events } from "./events.js";

class StatsSystem {
  constructor() {
    this.s = null;
    this.bound = false;
  }

  attach(state) {
    this.s = state.stats;
    if (!this.bound) {
      this.bind();
      this.bound = true;
    }
  }

  bind() {
    const inc = (key) => () => { if (this.s) this.s[key] += 1; };
    events.on("blockMined", inc("blocksMined"));
    events.on("blockPlaced", inc("blocksPlaced"));
    events.on("creatureSeen", inc("creaturesSeen"));
    events.on("creatureCaptured", inc("creaturesCaught"));
    events.on("creatureDefeated", inc("creaturesDefeated"));
    events.on("battleWon", inc("battlesWon"));
    events.on("battleLost", inc("battlesLost"));
    events.on("itemCrafted", inc("itemsCrafted"));
    events.on("biomeDiscovered", ({ biome }) => {
      if (this.s) this.s.biomesDiscovered[biome] = true;
    });
  }

  /** Distancia horizontal recorrida; llamar desde el bucle con el delta del frame. */
  addDistance(d) {
    // Ignora teletransportes y respawns.
    if (this.s && d > 0 && d < 5) this.s.distanceTraveled += d;
  }

  biomeCount() {
    return this.s ? Object.keys(this.s.biomesDiscovered).length : 0;
  }
}

export const stats = new StatsSystem();
