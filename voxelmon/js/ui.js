/** Interfaz: HUD, menús, batalla, dex y notificaciones */

import { SPECIES, TYPES, FAMILY_STARTERS, PERKS, movesFor, typeMultiplier } from "./data.js?v=13";
import { creatureArtIcon } from "./creature-renderer.js";
import { BLOCK_NAMES } from "./world.js";
import { RESOURCES } from "./resources.js";
import { ITEM_CATEGORIES, itemDef } from "./items.js";
import { inventory } from "./inventory.js";
import { dex } from "./dex.js";
import { creatureStorage } from "./pc.js";
import { sfx } from "./audio.js";
import { mulberry32 } from "./noise.js";

const $ = (id) => document.getElementById(id);

/** Icono pixel-art determinista por especie (estilo identicon, colores de la especie) */
const iconCache = {};
export function pixelIcon(speciesId, cell = 6, silhouette = false) {
  try {
    const fromArt = creatureArtIcon(speciesId, silhouette);
    if (fromArt) return fromArt;
  } catch { /* portrait 3D opcional: cae al identicon */ }
  const key = `${speciesId}-${cell}-${silhouette}`;
  if (iconCache[key]) return iconCache[key];
  const sp = SPECIES[speciesId];
  if (!sp) return "";
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
  22: "#6a2c28",
  23: "#c85020",
  24: "#e04048",
  26: "#9ab0c8",
  27: "#8a9a58",
  28: "#7ad4f0",
};

export class UI {
  constructor() {
    this.el = {
      hud: $("hud"),
      title: $("screen-title"),
      starter: $("screen-starter"),
      pause: $("screen-pause"),
      dex: $("screen-dex"),
      inventory: $("inventory-ui"),
      pc: $("pc-ui"),
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
    this.invCategory = "all";
    this.invSelected = null;
    this.dexFilter = "all";
    this.dexQuery = "";
    this.dexSelected = null;
    this.pcPartyUid = null;
    this.pcBoxUid = null;
    this.pcPage = 0;
    this.pcPageSize = 30;
    this.onUseItem = null;
    this.onPcAction = null;
    this.onCloseInventory = null;
    this.onClosePc = null;
    this._mgmtBound = false;
  }

  // ---------- Overlays básicos ----------

  show(el) { el.classList.remove("hidden"); }
  hide(el) { el.classList.add("hidden"); }

  showTitle(hasSave, hasBackup = false) {
    this.show(this.el.title);
    this.hideNewGameConfirm();
    $("btn-continue").classList.toggle("hidden", !hasSave);
    const recover = $("btn-recover");
    if (recover) recover.classList.toggle("hidden", !hasBackup);
  }

  setTitleError(msg) {
    const el = $("title-error");
    if (!el) return;
    el.textContent = msg || "";
    el.classList.toggle("hidden", !msg);
  }

  showNewGameConfirm() {
    const box = $("title-confirm");
    const actions = $("title-actions");
    if (box) box.classList.remove("hidden");
    if (actions) actions.classList.add("hidden");
  }

  hideNewGameConfirm() {
    const box = $("title-confirm");
    const actions = $("title-actions");
    if (box) box.classList.add("hidden");
    if (actions) actions.classList.remove("hidden");
  }

  showLoading(text) {
    this.el.loadingText.textContent = text;
    this.show(this.el.loading);
  }

  hideLoading() { this.hide(this.el.loading); }

  showStarters(ids, cb) {
    const grid = $("starter-cards");
    if (!grid) throw new Error("No se encontró la pantalla de iniciales.");
    grid.innerHTML = "";
    for (const id of ids) {
      const sp = SPECIES[id];
      if (!sp) continue;
      const card = document.createElement("button");
      card.className = "starter-card";
      card.style.setProperty("--c1", sp.color);
      card.style.setProperty("--c2", sp.color2);
      let icon = "";
      try { icon = pixelIcon(id, 8); } catch { icon = ""; }
      card.innerHTML = `
        <img alt="${sp.name}" src="${icon}" />
        <span class="starter-name">${sp.name}</span>
        <span class="type-chip" style="--tc:${TYPES[sp.type].color}">${TYPES[sp.type].name}</span>`;
      card.addEventListener("click", () => {
        sfx.select();
        this.hide(this.el.starter);
        cb(id);
      });
      grid.appendChild(card);
    }
    if (!grid.childElementCount) throw new Error("No hay iniciales disponibles.");
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

  refreshHotbar(slotBlocks, bag, selected) {
    this.hotbarSlots.forEach((slot, i) => {
      slot.classList.toggle("selected", i === selected);
      const id = slotBlocks[i];
      const n = inventory.state === this.state ? inventory.countBlock(id) : (bag?.[id] ?? 0);
      slot.querySelector(".hb-count").textContent = n;
    });
  }

  refreshHud() {
    const s = this.state;
    if (!s) return;
    const cubes = inventory.state === s ? inventory.count("balls") : (s.balls ?? 0);
    this.el.infoBalls.textContent = `▣ Cubos: ${cubes}`;
    $("info-money").textContent = `⌾ Monedas: ${s.money ?? 0}`;
    const seenN = dex.state === s ? dex.seenCount() : Object.keys(s.dex?.seen ?? {}).length;
    const caughtN = dex.state === s ? dex.obtainableCaughtCount() : Object.keys(s.dex?.caught ?? {}).length;
    const obt = dex.state === s ? dex.obtainableIds().length : 29;
    const cat = dex.state === s ? dex.catalogSize() : 30;
    this.el.infoDex.textContent = `◆ Dex: ${seenN}/${cat} · ${caughtN}/${obt}`;

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
    while (id && SPECIES[id]) {
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
      .map((r) => {
        const n = inventory.state === this.state
          ? inventory.count(r.id)
          : (this.state.inventory?.[r.id] ?? this.state.inventory?.[r.block] ?? 0);
        return { r, n };
      })
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
      <span>🏟 Gimnasios: <b>${st.gymsCompleted ?? 0}</b></span>
      <span>🗺 Regiones: <b>${st.regionsDiscovered ?? 0}</b></span>
      <span>⚒ Fabricados: <b>${st.itemsCrafted ?? 0}</b></span>` +
      (st.itemsPurchased || st.itemsSold ? `<span>💱 Compras/ventas: <b>${st.itemsPurchased ?? 0}</b>/<b>${st.itemsSold ?? 0}</b></span>` : "") +
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

  setRegion(name, visible) {
    const el = $("info-region");
    if (!el) return;
    el.textContent = `🗺 ${name}`;
    el.classList.toggle("hidden", !visible);
  }

  setBuildHud(info) {
    const box = $("build-hud");
    if (!box) return;
    if (!info || !info.mode) {
      box.classList.add("hidden");
      return;
    }
    $("build-hud-title").textContent = info.hovering ? "MODO CONSTRUCCIÓN · AIRE" : "MODO CONSTRUCCIÓN";
    $("build-hud-sub").textContent = info.unlocked
      ? (info.hovering ? "WASD mover · Espacio subir · Shift bajar · B salir" : "ASISTENCIA AÉREA DISPONIBLE · Espacio para elevarte")
      : "Captura una criatura voladora capaz para desbloquear asistencia aérea.";
    box.classList.remove("hidden");
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
    if (!this.el.toasts) return;
    const div = document.createElement("div");
    div.className = `toast ${cls}`;
    div.textContent = msg;
    this.el.toasts.appendChild(div);
    setTimeout(() => div.classList.add("out"), 3400);
    setTimeout(() => div.remove(), 3900);
  }

  // ---------- Dex ----------

  bindMgmtUi() {
    if (this._mgmtBound) return;
    this._mgmtBound = true;
    $("btn-inv-close")?.addEventListener("click", () => this.onCloseInventory?.());
    $("btn-pc-close")?.addEventListener("click", () => this.onClosePc?.());
    $("dex-search")?.addEventListener("input", (e) => {
      this.dexQuery = e.target.value;
      this.renderDex();
    });
    $("dex-filters")?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-filter]");
      if (!btn) return;
      this.dexFilter = btn.dataset.filter;
      this.renderDex();
    });
  }

  renderDex() {
    this.bindMgmtUi();
    const grid = $("dex-grid");
    if (!grid) return;
    grid.innerHTML = "";
    const list = dex.list({ filter: this.dexFilter, query: this.dexQuery });
    const snap = dex.snapshot();
    $("dex-progress").textContent =
      `Vistas ${snap.seen}/${snap.catalog} · Capturadas ${snap.obtainableCaught}/${snap.obtainable}` +
      (this.state?.dex?.caught?.prismaton ? " · ✦ Prismatón" : "");
    for (const btn of document.querySelectorAll(".dex-filter")) {
      btn.classList.toggle("selected", btn.dataset.filter === this.dexFilter);
    }
    for (const e of list) {
      const cell = document.createElement("div");
      const st = e.status;
      cell.className = `dex-cell ${st}` + (this.dexSelected === e.id ? " selected" : "");
      const sil = st !== "caught";
      const shownImg = st === "unseen" ? pixelIcon(e.id, 5, true) : pixelIcon(e.id, 5, sil);
      cell.innerHTML = `
        <img src="${shownImg}" alt="" />
        <span class="dex-name">${e.name}</span>
        ${st === "caught" && e.type ? `<span class="type-chip" style="--tc:${TYPES[e.type].color}">${TYPES[e.type].name}</span>` : ""}
        ${e.legendary && st !== "unseen" ? '<span class="dex-leg">✦</span>' : ""}`;
      cell.title = st === "unseen" ? "???" : `${e.name} · ${st === "caught" ? "✓ Capturado" : "Visto"}`;
      cell.addEventListener("mouseenter", () => {
        if (st === "unseen") return;
        cell.title = `${e.name}\n${TYPES[e.type]?.name ?? ""}\n${st === "caught" ? "✓ Capturado" : "○ Visto"}`;
      });
      cell.addEventListener("click", () => {
        this.dexSelected = e.id;
        this.renderDex();
      });
      grid.appendChild(cell);
    }
    this.renderDexDetail();

    const perkGrid = $("dex-perks");
    if (!perkGrid) return;
    perkGrid.innerHTML = "";
    for (const fam of FAMILY_STARTERS) {
      const p = PERKS[fam];
      if (!p) continue;
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

  renderDexDetail() {
    const box = $("dex-detail");
    if (!box) return;
    const id = this.dexSelected;
    if (!id) {
      box.innerHTML = `<p class="lede">Elige una especie.</p>`;
      return;
    }
    const e = dex.entry(id);
    const chain = dex.chain(id);
    if (e.status === "unseen") {
      box.innerHTML = `
        <img class="dex-portrait" src="${pixelIcon(id, 8, true)}" alt="" />
        <h3>??? · Nº ${String(e.dexIndex).padStart(3, "0")}</h3>
        <p>Aún no has encontrado a esta criatura.</p>`;
      return;
    }
    const status = e.status === "caught"
      ? `<span class="dex-status-caught">✓ CAPTURADO</span>`
      : `<span class="dex-status-seen">○ AVISTADA</span>`;
    const evo = chain.map((c) => c.known ? c.name : "???").join(" → ");
    box.innerHTML = `
      <img class="dex-portrait" src="${pixelIcon(id, 8, e.status !== "caught")}" alt="" />
      <h3>${e.name} · Nº ${String(e.dexIndex).padStart(3, "0")}</h3>
      <p>${status}</p>
      <p><span class="type-chip" style="--tc:${TYPES[e.type].color}">${TYPES[e.type].name}</span>
         · Etapa ${e.stage}${e.legendary ? " · Legendaria" : e.boss ? " · Guardián" : e.rare ? " · Rara" : ""}</p>
      <p>${e.description}</p>
      ${e.habitat ? `<p class="lede">Hábitat: ${e.habitat}</p>` : ""}
      <div class="dex-evo">${evo}</div>`;
  }

  renderInventory() {
    this.bindMgmtUi();
    const tabs = $("inv-tabs");
    const grid = $("inv-grid");
    const detail = $("inv-detail");
    if (!tabs || !grid) return;
    const cats = ["all", "capture", "healing", "resource", "key", "utility", "block"];
    tabs.innerHTML = "";
    for (const id of cats) {
      const b = document.createElement("button");
      b.className = "btn ghost" + (this.invCategory === id ? " selected" : "");
      b.textContent = ITEM_CATEGORIES[id]?.name ?? id;
      b.addEventListener("click", () => { this.invCategory = id; this.renderInventory(); });
      tabs.appendChild(b);
    }
    const items = inventory.getByCategory(this.invCategory);
    grid.innerHTML = "";
    if (!items.length) {
      grid.innerHTML = `<p class="lede">Nada en esta categoría.</p>`;
    }
    for (const it of items) {
      const cell = document.createElement("button");
      cell.className = "inv-cell" + (String(this.invSelected) === String(it.id) ? " selected" : "");
      cell.innerHTML = `<span class="inv-icon">${it.icon ?? "•"}</span>
        <span class="inv-name">${it.name}</span>
        <span class="inv-count">×${it.count}</span>`;
      cell.title = `${it.name} ×${it.count}`;
      cell.addEventListener("click", () => { this.invSelected = it.id; this.renderInventory(); });
      grid.appendChild(cell);
    }
    const sel = items.find((it) => String(it.id) === String(this.invSelected)) ?? items[0];
    if (!sel) {
      detail.innerHTML = `<p class="lede">Selecciona un objeto.</p>`;
      return;
    }
    this.invSelected = sel.id;
    const useable = !!sel.usable;
    const key = sel.category === "key";
    detail.innerHTML = `
      <h3>${sel.icon ?? ""} ${sel.name}</h3>
      <p>${sel.description ?? ""}</p>
      <p>Cantidad: <b>×${sel.count}</b> · ${ITEM_CATEGORIES[sel.category]?.name ?? sel.category}</p>
      ${sel.buyPrice ? `<p>Compra: ${sel.buyPrice} ⌾</p>` : ""}
      ${sel.sellPrice ? `<p>Venta: ${sel.sellPrice} ⌾</p>` : ""}
      ${key ? `<p>Objeto clave: no se vende.</p>` : ""}
      ${useable ? `<button id="btn-inv-use" class="btn primary">Usar</button>` : `<p class="lede">${useable ? "" : "No usable aquí."}</p>`}`;
    $("btn-inv-use")?.addEventListener("click", () => this.onUseItem?.(sel.id));
  }

  renderPc() {
    this.bindMgmtUi();
    const partyEl = $("pc-party");
    const boxEl = $("pc-box");
    const pagesEl = $("pc-pages");
    const detail = $("pc-detail");
    const actions = $("pc-actions");
    if (!partyEl || !boxEl) return;
    const party = creatureStorage.party();
    const box = creatureStorage.box();
    $("pc-count").textContent = `(${box.length})`;
    partyEl.innerHTML = "";
    party.forEach((m, i) => {
      const row = document.createElement("div");
      row.className = "pc-row" + (m.uid === this.pcPartyUid ? " selected" : "") + (i === 0 ? " lead" : "");
      row.innerHTML = `<img src="${pixelIcon(m.speciesId, 4)}" alt="" />
        <div><div class="pc-name">${i + 1}. ${m.name}</div>
        <small>Nv ${m.level} · ${TYPES[m.type]?.name ?? m.type} · ${m.hp}/${m.maxHp}</small></div>`;
      row.title = `${m.name} Nv ${m.level}\n${TYPES[m.type]?.name}\n${m.hp}/${m.maxHp} PV`;
      row.addEventListener("click", () => { this.pcPartyUid = m.uid; this.renderPc(); });
      partyEl.appendChild(row);
    });
    const pages = Math.max(1, Math.ceil(box.length / this.pcPageSize));
    if (this.pcPage >= pages) this.pcPage = pages - 1;
    pagesEl.innerHTML = "";
    if (pages > 1) {
      for (let p = 0; p < pages; p++) {
        const b = document.createElement("button");
        b.className = "btn ghost" + (p === this.pcPage ? " selected" : "");
        b.textContent = String(p + 1);
        b.addEventListener("click", () => { this.pcPage = p; this.renderPc(); });
        pagesEl.appendChild(b);
      }
    }
    const slice = box.slice(this.pcPage * this.pcPageSize, (this.pcPage + 1) * this.pcPageSize);
    boxEl.innerHTML = "";
    if (!slice.length) boxEl.innerHTML = `<p class="lede">El PC está vacío.</p>`;
    for (const m of slice) {
      const cell = document.createElement("button");
      cell.className = "pc-cell" + (m.uid === this.pcBoxUid ? " selected" : "");
      cell.innerHTML = `<img src="${pixelIcon(m.speciesId, 4)}" alt="" />
        <span class="inv-name">${m.name}</span>
        <small>Nv ${m.level}</small>`;
      cell.title = `${m.name}\nNv ${m.level} · ${TYPES[m.type]?.name}\n${m.hp}/${m.maxHp} PV · etapa ${m.stage}`;
      cell.addEventListener("click", () => { this.pcBoxUid = m.uid; this.renderPc(); });
      boxEl.appendChild(cell);
    }
    const sel = party.find((m) => m.uid === this.pcPartyUid) || box.find((m) => m.uid === this.pcBoxUid);
    if (sel) {
      detail.innerHTML = `<b>${sel.name}</b> · Nv ${sel.level} · ${TYPES[sel.type]?.name ?? sel.type}
        · ${sel.hp}/${sel.maxHp} PV · etapa ${sel.stage}`;
    } else {
      detail.innerHTML = `<p class="lede">Selecciona una criatura del equipo o del PC.</p>`;
    }
    actions.innerHTML = "";
    const mk = (label, fn, disabled) => {
      const b = document.createElement("button");
      b.className = "btn ghost";
      b.textContent = label;
      b.disabled = !!disabled;
      b.addEventListener("click", fn);
      actions.appendChild(b);
    };
    mk("Depositar → PC", () => this.onPcAction?.("deposit", this.pcPartyUid), !this.pcPartyUid || party.length <= 1);
    mk("Retirar → equipo", () => this.onPcAction?.("withdraw", this.pcBoxUid), !this.pcBoxUid || party.length >= 6);
    mk("Intercambiar", () => this.onPcAction?.("swap", this.pcPartyUid, this.pcBoxUid), !this.pcPartyUid || !this.pcBoxUid);
    mk("Subir en equipo", () => this.onPcAction?.("up", this.pcPartyUid), !this.pcPartyUid);
    mk("Bajar en equipo", () => this.onPcAction?.("down", this.pcPartyUid), !this.pcPartyUid);
    mk("Poner de primero", () => this.onPcAction?.("lead", this.pcPartyUid), !this.pcPartyUid);
  }

  setInspectCard(info) {
    const el = $("inspect-card");
    if (!el) return;
    if (!info) {
      el.classList.add("hidden");
      return;
    }
    $("inspect-name").textContent = `${info.name}    Nv ${info.level}`;
    $("inspect-meta").textContent = info.typeName ?? "";
    const st = $("inspect-status");
    if (info.caught) {
      st.textContent = "✓ CAPTURADO";
      st.className = "caught";
    } else {
      st.textContent = "○ NO CAPTURADO";
      st.className = "uncaught";
    }
    el.classList.remove("hidden");
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
    const names = {
      explorador: "Explorador",
      verdant_badge: "Insignia Verde",
      mist_badge: "Insignia Bruma",
      crimson_badge: "Insignia Forja",
      gale_badge: "Insignia Vendaval",
    };
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
    if (this.el.inventory && !this.el.inventory.classList.contains("hidden")) this.renderInventory();
    if (this.el.pc && !this.el.pc.classList.contains("hidden")) this.renderPc();
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
        const restricted = battle.isRestrictedBattle
          ?? (battle.ctx?.type === "trainer" || battle.ctx?.type === "boss");
        mk("⚔ Atacar", "attack", movesMenu);
        mk(
          restricted ? "▣ Cubo <small>bloqueado</small>" : `▣ Cubo <small>×${inventory.count("balls")}</small>`,
          "ball",
          () => { actions.innerHTML = ""; resolve({ kind: "ball" }); },
          restricted
        );
        mk("⇄ Cambiar", "switch", switchMenu, battle.team.filter((m) => m.hp > 0).length <= 1);
        mk("✕ Huir", "flee", () => { actions.innerHTML = ""; resolve({ kind: "flee" }); }, restricted);
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
