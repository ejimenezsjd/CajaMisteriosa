/** Interfaz: HUD, menús, batalla, dex y notificaciones */

import { SPECIES, TYPES, FAMILY_STARTERS, PERKS, movesFor, typeMultiplier } from "./data.js";
import { BLOCK_NAMES } from "./world.js";
import { RESOURCES } from "./resources.js";
import { sfx } from "./audio.js";
import { mulberry32 } from "./noise.js";

const $ = (id) => document.getElementById(id);

/** Icono pixel-art determinista por especie (estilo identicon, colores de la especie) */
const iconCache = {};
export function pixelIcon(speciesId, cell = 6, silhouette = false) {
  const key = `${speciesId}-${cell}-${silhouette}`;
  if (iconCache[key]) return iconCache[key];
  const sp = SPECIES[speciesId];
  let h = 0;
  for (const ch of speciesId) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const rnd = mulberry32(h);
  const N = 10;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = N * cell;
  const ctx = canvas.getContext("2d");
  const colors = silhouette ? ["#2c3040", "#232636"] : [sp.color, sp.color2];
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < Math.ceil(N / 2); x++) {
      const edge = y === 0 || y === N - 1 || x === 0;
      const on = !edge && rnd() < 0.62;
      if (!on) continue;
      const color = colors[rnd() < 0.72 ? 0 : 1];
      ctx.fillStyle = color;
      ctx.fillRect(x * cell, y * cell, cell, cell);
      ctx.fillRect((N - 1 - x) * cell, y * cell, cell, cell);
    }
  }
  if (!silhouette) {
    ctx.fillStyle = "#101018";
    ctx.fillRect(3 * cell, 3 * cell, cell, cell);
    ctx.fillRect(6 * cell, 3 * cell, cell, cell);
  }
  iconCache[key] = canvas.toDataURL();
  return iconCache[key];
}

const BLOCK_CSS = {
  2: "#8a6642",
  3: "#8d8d94",
  4: "#e2d08f",
  6: "#7d5a30",
  7: "#48a03c",
  8: "#eef2f5",
};

export class UI {
  constructor() {
    this.el = {
      hud: $("hud"),
      title: $("screen-title"),
      starter: $("screen-starter"),
      pause: $("screen-pause"),
      dex: $("screen-dex"),
      victory: $("screen-victory"),
      loading: $("screen-loading"),
      battle: $("battle-ui"),
      teamStrip: $("team-strip"),
      infoBalls: $("info-balls"),
      infoDex: $("info-dex"),
      infoClock: $("info-clock"),
      hotbar: $("hotbar"),
      toasts: $("toasts"),
      targetPrompt: $("target-prompt"),
      battleLog: $("battle-log"),
      battleActions: $("battle-actions"),
      loadingText: $("loading-text"),
    };
    this.state = null; // lo asigna main
    this.hotbarSlots = [];
  }

  // ---------- Overlays básicos ----------

  show(el) { el.classList.remove("hidden"); }
  hide(el) { el.classList.add("hidden"); }

  showTitle(hasSave) {
    this.show(this.el.title);
    $("btn-continue").classList.toggle("hidden", !hasSave);
  }

  showLoading(text) {
    this.el.loadingText.textContent = text;
    this.show(this.el.loading);
  }

  hideLoading() { this.hide(this.el.loading); }

  showStarters(ids, cb) {
    const grid = $("starter-cards");
    grid.innerHTML = "";
    for (const id of ids) {
      const sp = SPECIES[id];
      const card = document.createElement("button");
      card.className = "starter-card";
      card.style.setProperty("--c1", sp.color);
      card.style.setProperty("--c2", sp.color2);
      card.innerHTML = `
        <img alt="${sp.name}" src="${pixelIcon(id, 8)}" />
        <span class="starter-name">${sp.name}</span>
        <span class="type-chip" style="--tc:${TYPES[sp.type].color}">${TYPES[sp.type].name}</span>`;
      card.addEventListener("click", () => {
        sfx.select();
        this.hide(this.el.starter);
        cb(id);
      });
      grid.appendChild(card);
    }
    this.show(this.el.starter);
  }

  // ---------- HUD ----------

  buildHotbar(slotBlocks) {
    this.el.hotbar.innerHTML = "";
    this.hotbarSlots = slotBlocks.map((b, i) => {
      const slot = document.createElement("div");
      slot.className = "hb-slot";
      slot.innerHTML = `<span class="hb-key">${i + 1}</span><span class="hb-block" style="--bc:${BLOCK_CSS[b]}"></span><span class="hb-count">0</span><span class="hb-name">${BLOCK_NAMES[b]}</span>`;
      this.el.hotbar.appendChild(slot);
      return slot;
    });
  }

  refreshHotbar(slotBlocks, inventory, selected) {
    this.hotbarSlots.forEach((slot, i) => {
      slot.classList.toggle("selected", i === selected);
      slot.querySelector(".hb-count").textContent = inventory[slotBlocks[i]] ?? 0;
    });
  }

  refreshHud() {
    const s = this.state;
    if (!s) return;
    this.el.infoBalls.textContent = `▣ Cubos: ${s.balls}`;
    $("info-money").textContent = `⌾ Monedas: ${s.money ?? 0}`;
    const fams = FAMILY_STARTERS.filter((f) => this.familyCaught(f)).length;
    this.el.infoDex.textContent = `◆ Dex: ${fams}/8${s.dex.caught.prismaton ? " ✦" : ""}`;

    const strip = this.el.teamStrip;
    strip.innerHTML = "";
    s.team.forEach((m, i) => {
      const row = document.createElement("div");
      row.className = "team-row" + (m.hp <= 0 ? " ko" : "") + (i === 0 ? " leader" : "");
      const pct = Math.round((m.hp / m.maxHp) * 100);
      row.innerHTML = `
        <img src="${pixelIcon(m.speciesId, 4)}" alt="" />
        <div class="team-info">
          <span class="team-name">${m.name} <em>Nv ${m.level}</em></span>
          <div class="hp-track mini"><div class="hp-fill ${pct < 25 ? "low" : ""}" style="width:${pct}%"></div></div>
        </div>`;
      row.title = "Clic: poner primero";
      row.addEventListener("click", () => {
        if (i > 0) {
          s.team.unshift(s.team.splice(i, 1)[0]);
          sfx.select();
          this.refreshHud();
        }
      });
      strip.appendChild(row);
    });
  }

  familyCaught(fam) {
    let id = fam;
    while (id) {
      if (this.state.dex.caught[id]) return true;
      id = SPECIES[id].evolvesTo;
    }
    return false;
  }

  /** Bloque de estadísticas del menú de pausa */
  renderStats() {
    const box = $("pause-stats");
    const st = this.state?.stats;
    if (!st) { box.classList.add("hidden"); return; }
    const km = st.distanceTraveled >= 1000
      ? `${(st.distanceTraveled / 1000).toFixed(1)} km`
      : `${Math.round(st.distanceTraveled)} m`;
    const resources = Object.values(RESOURCES)
      .map((r) => ({ r, n: this.state.inventory?.[r.block] ?? 0 }))
      .filter((e) => e.n > 0)
      .map((e) => `${e.r.icon} ${e.r.name}: <b>${e.n}</b>`)
      .join(" · ");
    box.innerHTML = `
      <span>⛏ Minados: <b>${st.blocksMined}</b></span>
      <span>🧱 Colocados: <b>${st.blocksPlaced}</b></span>
      <span>👁 Vistas: <b>${st.creaturesSeen}</b></span>
      <span>▣ Capturas: <b>${st.creaturesCaught}</b></span>
      <span>⚔ Victorias: <b>${st.battlesWon}</b></span>
      <span>💀 Derrotas: <b>${st.battlesLost}</b></span>
      <span>🥾 Distancia: <b>${km}</b></span>
      <span>🧭 Biomas: <b>${Object.keys(st.biomesDiscovered).length}</b></span>
      <span>🏛 Estructuras: <b>${Object.keys(st.structuresDiscovered ?? {}).length}</b></span>
      <span>📜 Misiones: <b>${st.questsCompleted ?? 0}</b></span>
      <span>🤝 Tratos: <b>${st.tradesCompleted ?? 0}</b></span>
      <span>💬 Charlas: <b>${st.npcsTalked ?? 0}</b></span>
      <span>🎖 Entrenadores: <b>${st.trainersDefeated ?? 0}</b></span>
      <span>🏅 Insignias: <b>${this.badgeCount()}</b>${this.badgeList()}</span>
      <span>🏟 Gimnasios: <b>${st.gymsCompleted ?? 0}</b></span>` +
      (resources ? `<span class="stats-wide">🎒 Recursos: ${resources}</span>` : "");
    box.classList.remove("hidden");
  }

  /**
   * Tracker de misión activa en el HUD.
   * info = { title, label, current, required } o null para ocultarlo.
   */
  updateQuestTracker(info) {
    const box = $("quest-tracker");
    if (!info) { box.classList.add("hidden"); return; }
    $("qt-title").textContent = info.title;
    $("qt-obj").textContent = info.required > 1
      ? `${info.label} · ${info.current}/${info.required}`
      : info.label;
    box.classList.remove("hidden");
  }

  /** Sección de misiones del menú de pausa. summary = { active, completed } */
  renderQuests(summary) {
    const box = $("pause-quests");
    if (!summary || (!summary.active.length && !summary.completed.length)) {
      box.classList.add("hidden");
      return;
    }
    const active = summary.active.map((q) => `
      <div class="quest-row active">
        <span class="quest-title">◈ ${q.title}</span>
        ${q.objectives.map((o) => `<span class="quest-obj">${o.label} · <b>${o.current}/${o.required}</b></span>`).join("")}
      </div>`).join("");
    const completed = summary.completed.map((q) =>
      `<div class="quest-row done"><span class="quest-title">✓ ${q.title}</span></div>`).join("");
    box.innerHTML = `<h3 class="quests-heading">Misiones</h3>${active}${completed}`;
    box.classList.remove("hidden");
  }

  setClock(dayFactor) {
    const day = dayFactor > 0.28;
    this.el.infoClock.textContent = day ? "☀ Día" : "☾ Noche";
  }

  setTargetPrompt(text) {
    if (text) {
      this.el.targetPrompt.textContent = text;
      this.show(this.el.targetPrompt);
    } else {
      this.hide(this.el.targetPrompt);
    }
  }

  toast(msg, cls = "") {
    const div = document.createElement("div");
    div.className = `toast ${cls}`;
    div.textContent = msg;
    this.el.toasts.appendChild(div);
    setTimeout(() => div.classList.add("out"), 3400);
    setTimeout(() => div.remove(), 3900);
  }

  // ---------- Dex ----------

  renderDex() {
    const grid = $("dex-grid");
    grid.innerHTML = "";
    const order = [...FAMILY_STARTERS.flatMap((f) => {
      const line = [];
      let id = f;
      while (id) { line.push(id); id = SPECIES[id].evolvesTo; }
      return line;
    }), "prismaton"];
    for (const id of order) {
      const sp = SPECIES[id];
      const caught = !!this.state.dex.caught[id];
      const seen = !!this.state.dex.seen[id];
      const cell = document.createElement("div");
      cell.className = "dex-cell" + (caught ? " caught" : seen ? " seen" : "");
      cell.innerHTML = `
        <img src="${pixelIcon(id, 5, !caught)}" alt="" />
        <span class="dex-name">${caught || seen ? sp.name : "???"}</span>
        ${caught ? `<span class="type-chip" style="--tc:${TYPES[sp.type].color}">${TYPES[sp.type].name}</span>` : ""}
        ${sp.legendary ? '<span class="dex-leg">✦</span>' : ""}`;
      grid.appendChild(cell);
    }
    const fams = FAMILY_STARTERS.filter((f) => this.familyCaught(f)).length;
    $("dex-progress").textContent = `Familias capturadas: ${fams}/8` +
      (this.state.dex.caught.prismaton ? " · ✦ Prismatón obtenido" : fams >= 8 ? " · ¡El legendario te espera!" : "");

    const perkGrid = $("dex-perks");
    perkGrid.innerHTML = "";
    for (const fam of FAMILY_STARTERS) {
      const p = PERKS[fam];
      const unlocked = this.familyCaught(fam);
      const cell = document.createElement("div");
      cell.className = "perk-cell" + (unlocked ? " unlocked" : "");
      cell.innerHTML = `
        <span class="perk-icon">${unlocked ? p.icon : "🔒"}</span>
        <div class="perk-info">
          <span class="perk-name">${p.name}</span>
          <span class="perk-desc">${unlocked ? p.desc : `Captura a la familia de ${SPECIES[fam].name}`}</span>
        </div>`;
      perkGrid.appendChild(cell);
    }
  }

  // ---------- Batalla ----------

  showBattle(ally, enemy) {
    this.show(this.el.battle);
    this.el.battleLog.innerHTML = "";
    this.setBattleHp(ally, enemy);
  }

  hideBattle() {
    this.hide(this.el.battle);
    this.el.battleActions.innerHTML = "";
    this.setTrainerBanner(null);
  }

  badgeCount() {
    return this.state?.progression ? Object.keys(this.state.progression.badges ?? {}).length : 0;
  }

  badgeList() {
    const badges = this.state?.progression?.badges ?? {};
    const names = { explorador: "Explorador", verdant_badge: "Insignia Verde" };
    const list = Object.keys(badges).filter((k) => badges[k]).map((k) => names[k] ?? k);
    return list.length ? ` · ${list.join(", ")}` : "";
  }

  /** Tracker de puzzle del gimnasio (visible solo durante la prueba) */
  updateGymTracker(info) {
    const box = $("gym-tracker");
    if (!box) return;
    if (!info) { box.classList.add("hidden"); return; }
    $("gt-title").textContent = info.title;
    $("gt-obj").textContent = info.label;
    box.classList.remove("hidden");
  }

  /** Banner de combate contra entrenador ("Milo · Novato · 2 restantes") */
  setTrainerBanner(text) {
    const el = $("battle-trainer");
    if (!el) return;
    if (text) {
      el.textContent = text;
      el.classList.remove("hidden");
    } else {
      el.classList.add("hidden");
    }
  }

  battleLog(msg) {
    const p = document.createElement("p");
    p.textContent = msg;
    this.el.battleLog.appendChild(p);
    while (this.el.battleLog.children.length > 4) this.el.battleLog.firstChild.remove();
  }

  setBattleHp(ally, enemy, enemyLabel = null) {
    $("b-enemy-name").textContent = enemyLabel ?? `${enemy.name} salvaje`;
    $("b-enemy-level").textContent = `Nv ${enemy.level}`;
    $("b-enemy-hp").style.width = `${(enemy.hp / enemy.maxHp) * 100}%`;
    $("b-enemy-hp").classList.toggle("low", enemy.hp / enemy.maxHp < 0.25);
    $("b-ally-name").textContent = ally.name;
    $("b-ally-level").textContent = `Nv ${ally.level} · ${ally.hp}/${ally.maxHp} PV`;
    $("b-ally-hp").style.width = `${(ally.hp / ally.maxHp) * 100}%`;
    $("b-ally-hp").classList.toggle("low", ally.hp / ally.maxHp < 0.25);
    $("b-ally-xp").style.width = `${(ally.xp / ally.xpToNext) * 100}%`;
    this.refreshHud();
  }

  /** Devuelve una promesa con la acción elegida */
  promptBattleAction(battle) {
    return new Promise((resolve) => {
      const actions = this.el.battleActions;

      const mainMenu = () => {
        actions.innerHTML = "";
        const mk = (label, cls, fn, disabled = false) => {
          const b = document.createElement("button");
          b.className = `btn battle-btn ${cls}`;
          b.innerHTML = label;
          b.disabled = disabled;
          b.addEventListener("click", () => { sfx.select(); fn(); });
          actions.appendChild(b);
        };
        const isTrainer = battle.ctx?.type === "trainer";
        mk("⚔ Atacar", "attack", movesMenu);
        mk(
          isTrainer ? "▣ Cubo <small>bloqueado</small>" : `▣ Cubo <small>×${battle.state.balls}</small>`,
          "ball",
          () => { actions.innerHTML = ""; resolve({ kind: "ball" }); },
          isTrainer // no se captura a criaturas de otro entrenador
        );
        mk("⇄ Cambiar", "switch", switchMenu, battle.team.filter((m) => m.hp > 0).length <= 1);
        mk("✕ Huir", "flee", () => { actions.innerHTML = ""; resolve({ kind: "flee" }); }, isTrainer);
      };

      const movesMenu = () => {
        actions.innerHTML = "";
        for (const mv of movesFor(battle.active)) {
          const mult = mv.type ? typeMultiplier(mv.type, battle.enemy.type) : 1;
          const eff = mult >= 1.5 ? "▲▲" : mult > 1 ? "▲" : mult < 1 ? "▽" : "";
          const b = document.createElement("button");
          b.className = "btn battle-btn move";
          if (mv.type) b.style.setProperty("--tc", TYPES[mv.type].color);
          b.innerHTML = `${mv.name} <small>${mv.type ? TYPES[mv.type].name : "Normal"} ${eff}</small>`;
          b.addEventListener("click", () => { actions.innerHTML = ""; resolve({ kind: "attack", move: mv }); });
          actions.appendChild(b);
        }
        backBtn(mainMenu);
      };

      const switchMenu = () => {
        actions.innerHTML = "";
        for (const m of battle.team) {
          if (m === battle.active || m.hp <= 0) continue;
          const b = document.createElement("button");
          b.className = "btn battle-btn";
          b.innerHTML = `${m.name} <small>Nv ${m.level} · ${m.hp}/${m.maxHp} PV</small>`;
          b.addEventListener("click", () => { actions.innerHTML = ""; resolve({ kind: "switch", monster: m }); });
          actions.appendChild(b);
        }
        backBtn(mainMenu);
      };

      const backBtn = (fn) => {
        const b = document.createElement("button");
        b.className = "btn battle-btn back";
        b.textContent = "← Volver";
        b.addEventListener("click", () => { sfx.select(); fn(); });
        actions.appendChild(b);
      };

      mainMenu();
    });
  }
}
