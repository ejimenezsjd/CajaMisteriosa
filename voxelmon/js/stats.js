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
    events.on("craftCompleted", inc("recipesCrafted"));
    events.on("biomeDiscovered", ({ biome }) => {
      if (this.s) this.s.biomesDiscovered[biome] = true;
    });
    events.on("structureDiscovered", ({ structureId }) => {
      if (this.s) this.s.structuresDiscovered[structureId] = true;
    });
    events.on("npcTalked", inc("npcsTalked"));
    events.on("questCompleted", inc("questsCompleted"));
    events.on("tradeCompleted", inc("tradesCompleted"));
    // Fase 4: los eventos genéricos llevan type para distinguir trainer/wild
    events.on("trainerDefeated", inc("trainersDefeated"));
    events.on("battleWon", (p) => {
      if (this.s && p?.type === "trainer") this.s.trainerBattlesWon += 1;
    });
    events.on("battleLost", (p) => {
      if (this.s && p?.type === "trainer") this.s.trainerBattlesLost += 1;
    });
    events.on("gymCompleted", inc("gymsCompleted"));
    events.on("trainerDefeated", (p) => {
      if (this.s && p?.gymId) this.s.gymTrainersDefeated += 1;
    });
    events.on("regionDiscovered", inc("regionsDiscovered"));
    events.on("structureDiscovered", ({ structureType }) => {
      if (this.s && (structureType === "watchtower" || structureType === "ancient_outpost" ||
          structureType === "regional_gate" || structureType === "mist_settlement" ||
          structureType === "mining_camp" || structureType === "crimson_ruin")) {
        this.s.regionalStructuresDiscovered += 1;
      }
    });
    events.on("itemPurchased", (p) => {
      if (this.s) this.s.itemsPurchased += (p?.amount ?? 1);
    });
    events.on("itemSold", (p) => {
      if (this.s) {
        this.s.itemsSold += (p?.amount ?? 1);
        this.s.moneyEarnedFromSales += (p?.total ?? 0);
      }
    });
    events.on("moneyChanged", (p) => {
      if (this.s && (p?.delta ?? 0) < 0) this.s.moneySpent += Math.abs(p.delta);
    });
    events.on("bossDefeated", inc("bossesDefeated"));
    events.on("structureDiscovered", ({ structureType }) => {
      if (this.s && structureType === "gym_crimson") {
        this.s.regionalStructuresDiscovered += 1;
      }
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

  structureCount() {
    return this.s ? Object.keys(this.s.structuresDiscovered).length : 0;
  }
}

export const stats = new StatsSystem();
