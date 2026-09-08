/**
 * CraftingSystem data-driven (Fase 7).
 *
 * Recetas declarativas; la mutación de inventario pasa por items.js
 * (la misma vía que trading). Sin colas, tiempos ni calidad.
 *
 * La UI del banco vive aquí (como DialogueSystem) para no acoplar
 * recetas a main.js. main solo abre/cierra y gestiona el modo de juego.
 */

import { events } from "./events.js";
import { RESOURCES } from "./resources.js";
import { progression } from "./progression.js";
import { executeTransaction, getItemCount, consumeItems } from "./items.js";

export const RECIPES = {
  recipe_capture_cube: {
    id: "recipe_capture_cube",
    name: "Cubo de captura",
    station: "basic_workbench",
    unlock: "basic_crafting_unlocked",
    inputs: [
      { itemId: "apricorn", amount: 3 },
      { itemId: "copper", amount: 1 },
    ],
    outputs: [{ itemId: "balls", amount: 1 }],
    resultLabel: "1 cubo de captura",
  },
  recipe_mist_tonic: {
    id: "recipe_mist_tonic",
    name: "Tónico de bruma",
    station: "basic_workbench",
    unlock: "basic_crafting_unlocked",
    inputs: [
      { itemId: "mist_bloom", amount: 1 },
      { itemId: "medicinal_herb", amount: 1 },
    ],
    outputs: [{ itemId: "mist_tonic", amount: 1 }],
    resultLabel: "1 tónico de bruma (cura 40% PV del equipo)",
  },
  recipe_explorer_kit: {
    id: "recipe_explorer_kit",
    name: "Kit de exploración",
    station: "basic_workbench",
    unlock: "basic_crafting_unlocked",
    inputs: [
      { itemId: "coal", amount: 2 },
      { itemId: "iron", amount: 1 },
    ],
    outputs: [{ itemId: "explorer_kit", amount: 1 }],
    resultLabel: "1 kit: aclara la niebla 90 s y señala estructuras",
  },
  recipe_ancient_core: {
    id: "recipe_ancient_core",
    name: "Núcleo antiguo",
    station: "basic_workbench",
    unlock: "ancient_core_recipe_unlocked",
    inputs: [
      { itemId: "ancient_fragment", amount: 1 },
      { itemId: "crystal_shard", amount: 1 },
    ],
    outputs: [{ itemId: "ancient_core", amount: 1 }],
    resultLabel: "1 núcleo antiguo (despierta el sendero del próximo gimnasio)",
  },
};

const $ = (id) => document.getElementById(id);

class CraftingSystem {
  constructor() {
    this.state = null;
    this.open = false;
    this.stationId = null;
    this.selected = "recipe_capture_cube";
    this.onOpen = null;
    this.onClose = null;
    this.onUseItem = null; // main inyecta toasts / revelar estructuras
    this.onCraftError = null;
    this.boundUi = false;
  }

  attach(state) {
    this.state = state;
    this.bindUi();
  }

  bindUi() {
    if (this.boundUi) return;
    const craftBtn = $("btn-craft");
    const closeBtn = $("btn-craft-close");
    if (!craftBtn || !closeBtn) return;
    this.boundUi = true;
    craftBtn.addEventListener("click", () => this.trySelected());
    closeBtn.addEventListener("click", () => this.close());
  }

  trySelected() {
    if (!this.open || !this.selected) return { ok: false, error: "Sin receta." };
    const r = this.craft(this.selected, this.stationId ?? "basic_workbench");
    if (!r.ok && r.error) this.onCraftError?.(r.error);
    this.render();
    return r;
  }

  isUnlocked(recipe) {
    if (!recipe.unlock) return true;
    return progression.isUnlocked(recipe.unlock);
  }

  list(station = "basic_workbench") {
    return Object.values(RECIPES).filter((r) => r.station === station && this.isUnlocked(r));
  }

  canCraft(recipeId) {
    const r = RECIPES[recipeId];
    if (!r || !this.state || !this.isUnlocked(r)) return false;
    return !missingPreview(this.state, r.inputs);
  }

  /** Fabrica una receta. Atómico: sin efectos parciales ni negativos. */
  craft(recipeId, stationId = "basic_workbench") {
    const recipe = RECIPES[recipeId];
    if (!recipe || !this.state) return { ok: false, error: "Receta desconocida." };
    if (recipe.station !== stationId) return { ok: false, error: "Esta receta no se fabrica aquí." };
    if (!this.isUnlocked(recipe)) return { ok: false, error: "Aún no conoces esta receta." };
    const tx = executeTransaction(this.state, { costs: recipe.inputs, outputs: recipe.outputs });
    if (!tx.ok) return tx;
    events.emit("craftCompleted", {
      recipeId: recipe.id,
      inputs: recipe.inputs,
      outputs: recipe.outputs,
      stationId,
    });
    events.emit("itemCrafted", { recipeId: recipe.id, stationId });
    return { ok: true, recipe };
  }

  useTonic() {
    if (!this.state) return { ok: false, error: "Sin estado." };
    if (getItemCount(this.state, "mist_tonic") < 1) {
      return { ok: false, error: "No te queda tónico de bruma." };
    }
    consumeItems(this.state, [{ itemId: "mist_tonic", amount: 1 }]);
    for (const m of this.state.team) {
      const heal = Math.max(8, Math.round(m.maxHp * 0.4));
      m.hp = Math.min(m.maxHp, m.hp + heal);
    }
    events.emit("itemUsed", { itemId: "mist_tonic", healPercent: 0.4 });
    return { ok: true };
  }

  useExplorerKit() {
    if (!this.state) return { ok: false, error: "Sin estado." };
    if (getItemCount(this.state, "explorer_kit") < 1) {
      return { ok: false, error: "No te queda ningún kit de exploración." };
    }
    if (!this.state.buffs) this.state.buffs = { explorerUntil: 0 };
    consumeItems(this.state, [{ itemId: "explorer_kit", amount: 1 }]);
    this.state.buffs.explorerUntil = Date.now() + 90_000;
    events.emit("itemUsed", { itemId: "explorer_kit", until: this.state.buffs.explorerUntil });
    return { ok: true, until: this.state.buffs.explorerUntil };
  }

  explorerActive() {
    return Date.now() < (this.state?.buffs?.explorerUntil ?? 0);
  }

  show(stationId = "basic_workbench") {
    if (this.open) return;
    this.bindUi();
    this.stationId = stationId;
    this.open = true;
    const list = this.list(stationId);
    if (list.length && !list.some((r) => r.id === this.selected)) this.selected = list[0].id;
    this.onOpen?.();
    this.render();
  }

  close() {
    if (!this.open) return;
    this.open = false;
    this.stationId = null;
    $("crafting-ui")?.classList.add("hidden");
    this.onClose?.();
  }

  render() {
    const ui = $("crafting-ui");
    if (!ui || !this.open) return;
    const list = this.list(this.stationId);
    const box = $("crafting-list");
    box.innerHTML = "";
    if (!list.length) {
      box.innerHTML = `<p class="craft-empty">Todavía no conoces recetas. Habla con el artesano del refugio.</p>`;
    }
    for (const r of list) {
      const btn = document.createElement("button");
      btn.className = "btn craft-recipe" + (r.id === this.selected ? " selected" : "");
      btn.textContent = r.name;
      btn.addEventListener("click", () => { this.selected = r.id; this.render(); });
      box.appendChild(btn);
    }

    const detail = $("crafting-detail");
    const recipe = RECIPES[this.selected];
    if (recipe && this.isUnlocked(recipe)) {
      const rows = recipe.inputs.map((c) => {
        const have = getItemCount(this.state, c.itemId);
        const name = c.itemId === "balls" ? "Cubos" : (RESOURCES[c.itemId]?.name ?? c.itemId);
        const ok = have >= c.amount;
        return `<div class="craft-ing ${ok ? "ok" : "missing"}">${name}: <b>${have}</b> / ${c.amount}</div>`;
      }).join("");
      detail.innerHTML = `
        <p class="craft-result">Resultado: ${recipe.resultLabel}</p>
        ${rows}`;
      const craftBtn = $("btn-craft");
      const affordable = !missingPreview(this.state, recipe.inputs);
      craftBtn.disabled = !affordable;
      craftBtn.textContent = affordable ? "Fabricar" : "Faltan materiales";
    } else {
      detail.innerHTML = `<p class="craft-empty">Elige una receta.</p>`;
      $("btn-craft").disabled = true;
      $("btn-craft").textContent = "Fabricar";
    }

    const extras = $("crafting-extras");
    const tonicN = getItemCount(this.state, "mist_tonic");
    const kitN = getItemCount(this.state, "explorer_kit");
    extras.innerHTML = "";
    if (tonicN > 0) {
      const b = document.createElement("button");
      b.className = "btn";
      b.textContent = `Usar tónico (${tonicN})`;
      b.addEventListener("click", () => this.onUseItem?.("mist_tonic"));
      extras.appendChild(b);
    }
    if (kitN > 0) {
      const b = document.createElement("button");
      b.className = "btn";
      b.textContent = `Usar kit (${kitN})`;
      b.addEventListener("click", () => this.onUseItem?.("explorer_kit"));
      extras.appendChild(b);
    }

    ui.classList.remove("hidden");
  }
}

function missingPreview(state, inputs) {
  return inputs.some((c) => getItemCount(state, c.itemId) < c.amount);
}

export const crafting = new CraftingSystem();
