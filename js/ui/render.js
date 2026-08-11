import { SPECIES } from "../data/creatures.js";
import { TYPES, typeColor } from "../data/types.js";
import { TILE } from "../engine/dungeon.js";

const TILE_SIZE = 20;

/** Dibuja un sprite procedural de criatura en un canvas offscreen / CSS gradient box */
export function spriteStyle(speciesId) {
  const sp = SPECIES[speciesId];
  if (!sp) return "background:#666";
  const stage = sp.stage;
  const r = 30 + stage * 8;
  return `
    background:
      radial-gradient(circle at 35% 30%, ${sp.color2}, transparent 42%),
      radial-gradient(circle at 70% 70%, rgba(0,0,0,0.25), transparent 50%),
      linear-gradient(145deg, ${sp.color2}, ${sp.color});
    box-shadow: inset 0 -8px 16px rgba(0,0,0,0.2), 0 0 0 ${stage}px rgba(255,255,255,0.08);
    border-radius: ${28 - stage * 4}% ${22 + stage * 4}% ${30}% ${24}%;
  `.replace(/\s+/g, " ");
}

export function applySprite(el, speciesId) {
  if (!el) return;
  el.style.cssText = spriteStyle(speciesId);
  el.title = SPECIES[speciesId]?.name ?? "";
}

export function typePillHtml(typeId) {
  const t = TYPES[typeId];
  if (!t) return "";
  return `<span class="type-pill" style="background:${t.color}33;color:${t.color};border:1px solid ${t.color}55">${t.name}</span>`;
}

export function showScreen(id) {
  document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
  const el = document.getElementById(id);
  if (el) el.classList.add("active");
}

export function renderParty(party, leaderIndex) {
  const root = document.getElementById("party-list");
  if (!root) return;
  root.innerHTML = party
    .map((m, i) => {
      const pct = Math.max(0, (m.hp / m.maxHp) * 100);
      const fainted = m.hp <= 0;
      return `
        <div class="party-item ${i === leaderIndex ? "leader" : ""}" style="${fainted ? "opacity:0.45" : ""}">
          <div class="mini-sprite" data-sp="${m.speciesId}"></div>
          <div class="meta">
            <div class="name">${m.name}${i === leaderIndex ? " ★" : ""}</div>
            <div class="sub">Nv.${m.level} · ${TYPES[m.type]?.name ?? m.type} · ${m.hp}/${m.maxHp}</div>
            <div class="mini-hp"><span style="width:${pct}%"></span></div>
          </div>
        </div>`;
    })
    .join("");
  root.querySelectorAll(".mini-sprite").forEach((el) => applySprite(el, el.dataset.sp));
}

export function renderRunStats(state) {
  const floor = document.getElementById("stat-floor");
  const hp = document.getElementById("stat-hp");
  const boxes = document.getElementById("stat-boxes");
  const wrap = document.getElementById("run-stats");
  if (!wrap) return;
  wrap.classList.toggle("hidden", !state.running);
  if (!state.running) return;
  const leader = state.party[state.leaderIndex];
  floor.textContent = `Piso ${state.floor}`;
  hp.textContent = leader ? `PV ${leader.hp}/${leader.maxHp}` : "PV —";
  boxes.textContent = `Cajas ${state.boxesOpened}`;
}

export function pushLog(msg, important = false) {
  const log = document.getElementById("log");
  if (!log) return;
  const entry = document.createElement("div");
  entry.className = `entry${important ? " important" : ""}`;
  entry.textContent = msg;
  log.prepend(entry);
  while (log.children.length > 40) log.lastChild.remove();
}

export function setBattleLog(msg) {
  const el = document.getElementById("battle-log");
  if (el) el.textContent = msg;
}

export function renderBattleFighters(ally, enemy) {
  document.getElementById("ally-name").textContent = `${ally.name} Nv.${ally.level}`;
  document.getElementById("enemy-name").textContent = `${enemy.name} Nv.${enemy.level}`;

  const allyType = document.getElementById("ally-type");
  const enemyType = document.getElementById("enemy-type");
  allyType.textContent = TYPES[ally.type]?.name ?? ally.type;
  enemyType.textContent = TYPES[enemy.type]?.name ?? enemy.type;
  allyType.style.background = `${typeColor(ally.type)}33`;
  allyType.style.color = typeColor(ally.type);
  enemyType.style.background = `${typeColor(enemy.type)}33`;
  enemyType.style.color = typeColor(enemy.type);

  applySprite(document.getElementById("ally-sprite"), ally.speciesId);
  applySprite(document.getElementById("enemy-sprite"), enemy.speciesId);

  setHpBar("ally-hp", ally.hp, ally.maxHp);
  setHpBar("enemy-hp", enemy.hp, enemy.maxHp);
}

function setHpBar(id, hp, max) {
  const el = document.getElementById(id);
  if (!el) return;
  const pct = Math.max(0, (hp / max) * 100);
  el.style.width = `${pct}%`;
  el.classList.toggle("low", pct <= 30);
}

export function renderStarterChoices(monsters, onPick) {
  const root = document.getElementById("starter-choices");
  root.innerHTML = "";
  monsters.forEach((m) => {
    const sp = SPECIES[m.speciesId];
    const btn = document.createElement("button");
    btn.className = "creature-card";
    btn.innerHTML = `
      <div class="sprite-preview"></div>
      <h3>${m.name}</h3>
      ${typePillHtml(m.type)}
      <p>${sp.blurb}</p>
      <p style="margin-top:0.4rem">PV ${m.maxHp} · Atq ${m.atk} · Def ${m.def}</p>
    `;
    applySprite(btn.querySelector(".sprite-preview"), m.speciesId);
    btn.addEventListener("click", () => onPick(m));
    root.appendChild(btn);
  });
}

/**
 * Renderiza la mazmorra en canvas.
 */
export function drawDungeon(canvas, dungeon, fog = true) {
  const ctx = canvas.getContext("2d");
  const tw = TILE_SIZE;
  const viewW = Math.floor(canvas.width / tw);
  const viewH = Math.floor(canvas.height / tw);

  let ox = dungeon.player.x - Math.floor(viewW / 2);
  let oy = dungeon.player.y - Math.floor(viewH / 2);
  ox = Math.max(0, Math.min(dungeon.width - viewW, ox));
  oy = Math.max(0, Math.min(dungeon.height - viewH, oy));

  ctx.fillStyle = "#041012";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let vy = 0; vy < viewH; vy++) {
    for (let vx = 0; vx < viewW; vx++) {
      const x = ox + vx;
      const y = oy + vy;
      if (x < 0 || y < 0 || x >= dungeon.width || y >= dungeon.height) continue;

      const px = vx * tw;
      const py = vy * tw;
      const tile = dungeon.tiles[y][x];

      if (tile === TILE.WALL) {
        ctx.fillStyle = (x + y) % 2 === 0 ? "#0a2a2e" : "#0c3035";
        ctx.fillRect(px, py, tw, tw);
        ctx.fillStyle = "rgba(0,0,0,0.25)";
        ctx.fillRect(px, py + tw - 3, tw, 3);
      } else {
        ctx.fillStyle = (x + y) % 2 === 0 ? "#163e44" : "#1a484f";
        ctx.fillRect(px, py, tw, tw);
        // musgo
        if ((x * 7 + y * 13) % 11 === 0) {
          ctx.fillStyle = "rgba(61,186,122,0.12)";
          ctx.fillRect(px + 4, py + 4, 6, 6);
        }
      }
    }
  }

  // Escaleras
  {
    const sx = dungeon.stairs.x - ox;
    const sy = dungeon.stairs.y - oy;
    if (sx >= 0 && sy >= 0 && sx < viewW && sy < viewH) {
      const px = sx * tw;
      const py = sy * tw;
      ctx.fillStyle = "#2a6a72";
      ctx.fillRect(px + 3, py + 3, tw - 6, tw - 6);
      ctx.strokeStyle = "#e0a83a";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(px + 5, py + 5, tw - 10, tw - 10);
      ctx.beginPath();
      ctx.moveTo(px + 7, py + 8);
      ctx.lineTo(px + tw - 7, py + tw - 8);
      ctx.stroke();
    }
  }

  // Cajas
  for (const b of dungeon.boxes) {
    if (b.taken) continue;
    const sx = b.x - ox;
    const sy = b.y - oy;
    if (sx < 0 || sy < 0 || sx >= viewW || sy >= viewH) continue;
    const px = sx * tw + tw / 2;
    const py = sy * tw + tw / 2;
    const glow = 0.45 + Math.sin(Date.now() / 350 + b.x) * 0.2;
    ctx.fillStyle = `rgba(224,168,58,${glow})`;
    ctx.beginPath();
    ctx.arc(px, py, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#e0a83a";
    ctx.fillRect(px - 5, py - 5, 10, 10);
    ctx.fillStyle = "#c56b3a";
    ctx.fillRect(px - 5, py - 1, 10, 2);
    ctx.fillRect(px - 1, py - 5, 2, 10);
  }

  // Enemigos
  for (const e of dungeon.enemies) {
    if (!e.alive) continue;
    const sx = e.x - ox;
    const sy = e.y - oy;
    if (sx < 0 || sy < 0 || sx >= viewW || sy >= viewH) continue;
    const px = sx * tw + tw / 2;
    const py = sy * tw + tw / 2;
    ctx.fillStyle = "#e85d5d";
    ctx.beginPath();
    ctx.ellipse(px, py + 1, 6, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#1a1010";
    ctx.fillRect(px - 3, py - 1, 2, 2);
    ctx.fillRect(px + 1, py - 1, 2, 2);
  }

  // Jugador
  {
    const sx = dungeon.player.x - ox;
    const sy = dungeon.player.y - oy;
    const px = sx * tw + tw / 2;
    const py = sy * tw + tw / 2;
    ctx.fillStyle = "#f0c96a";
    ctx.beginPath();
    ctx.arc(px, py, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#0c2a2e";
    ctx.beginPath();
    ctx.arc(px - 2.5, py - 1, 1.4, 0, Math.PI * 2);
    ctx.arc(px + 2.5, py - 1, 1.4, 0, Math.PI * 2);
    ctx.fill();
  }

  // Viñeta suave
  const grad = ctx.createRadialGradient(
    canvas.width / 2,
    canvas.height / 2,
    canvas.height * 0.2,
    canvas.width / 2,
    canvas.height / 2,
    canvas.height * 0.75
  );
  grad.addColorStop(0, "rgba(0,0,0,0)");
  grad.addColorStop(1, "rgba(0,0,0,0.45)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

export function renderEnd(state, victory) {
  document.getElementById("end-title").textContent = victory
    ? "¡Santuario alcanzado!"
    : "La caja se cierra";
  document.getElementById("end-summary").textContent = victory
    ? `Dominaste ${state.floor} pisos, abriste ${state.boxesOpened} cajas y forjaste un equipo legendario.`
    : `Caíste en el piso ${state.floor}. Abriste ${state.boxesOpened} cajas y venciste ${state.wins} combates.`;

  const root = document.getElementById("end-party");
  root.innerHTML = state.party
    .map(
      (m) => `
      <div class="chip">
        <div class="mini-sprite" data-sp="${m.speciesId}"></div>
        <span>${m.name} Nv.${m.level}</span>
      </div>`
    )
    .join("");
  root.querySelectorAll(".mini-sprite").forEach((el) => applySprite(el, el.dataset.sp));
}
