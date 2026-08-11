import {
  createMonster,
  randomStarters,
  randomWild,
  randomBoxMonster,
  gainXp,
  SPECIES,
} from "../data/creatures.js";
import {
  generateDungeon,
  canWalk,
  enemyAt,
  boxAt,
  isStairs,
  tickEnemies,
} from "./dungeon.js";
import {
  calcDamage,
  effectivenessText,
  getMoves,
  chooseEnemyMove,
  livingMembers,
  healParty,
} from "./battle.js";
import {
  showScreen,
  renderParty,
  renderRunStats,
  pushLog,
  setBattleLog,
  renderBattleFighters,
  renderStarterChoices,
  drawDungeon,
  renderEnd,
  applySprite,
} from "../ui/render.js";

const MAX_PARTY = 4;
const WIN_FLOOR = 12;

export function createGame() {
  const state = {
    running: false,
    floor: 1,
    party: [],
    leaderIndex: 0,
    dungeon: null,
    boxesOpened: 0,
    wins: 0,
    battle: null,
    pendingEvolutions: [],
    animFrame: null,
  };

  const canvas = document.getElementById("dungeon");

  function refreshUI() {
    renderParty(state.party, state.leaderIndex);
    renderRunStats(state);
    // En móvil: tocar un miembro del equipo lo hace líder
    document.querySelectorAll("#party-list .party-item").forEach((el, i) => {
      el.style.cursor = "pointer";
      el.onclick = () => {
        if (!state.party[i] || state.party[i].hp <= 0) return;
        state.leaderIndex = i;
        refreshUI();
        pushLog(`Líder: ${state.party[i].name}`);
      };
    });
  }

  function startMenu() {
    state.running = false;
    showScreen("screen-menu");
    renderRunStats(state);
  }

  function beginStarterSelect() {
    const choices = randomStarters(3);
    showScreen("screen-starter");
    renderStarterChoices(choices, (picked) => {
      state.party = [picked];
      state.leaderIndex = 0;
      state.floor = 1;
      state.boxesOpened = 0;
      state.wins = 0;
      state.running = true;
      pushLog(`Elegiste a ${picked.name}. ¡La run comienza!`, true);
      enterFloor();
    });
  }

  function enterFloor() {
    state.dungeon = generateDungeon(state.floor);
    showScreen("screen-game");
    refreshUI();
    pushLog(`Piso ${state.floor}: una nueva cripta se abre.`);
    startAnim();
  }

  function startAnim() {
    cancelAnimationFrame(state.animFrame);
    const loop = () => {
      if (state.dungeon && document.getElementById("screen-game").classList.contains("active")) {
        drawDungeon(canvas, state.dungeon);
      }
      state.animFrame = requestAnimationFrame(loop);
    };
    state.animFrame = requestAnimationFrame(loop);
  }

  function tryMove(dx, dy) {
    if (!state.running || !state.dungeon) return;
    if (state.battle) return;
    if (!document.getElementById("screen-game").classList.contains("active")) return;

    const { player } = state.dungeon;
    const nx = player.x + dx;
    const ny = player.y + dy;
    if (!canWalk(state.dungeon, nx, ny)) return;

    const foe = enemyAt(state.dungeon, nx, ny);
    if (foe) {
      startBattle(foe);
      return;
    }

    player.x = nx;
    player.y = ny;

    // Caja
    const box = boxAt(state.dungeon, nx, ny);
    if (box) {
      openBox(box);
    }

    // Escaleras
    if (isStairs(state.dungeon, nx, ny)) {
      descend();
      return;
    }

    tickEnemies(state.dungeon);

    // ¿Un enemigo pisó al jugador?
    const bump = enemyAt(state.dungeon, player.x, player.y);
    if (bump) {
      startBattle(bump);
      return;
    }

    // Encuentro aleatorio leve en corredores
    if (Math.random() < 0.04) {
      startBattle(null);
    }
  }

  function openBox(box) {
    box.taken = true;
    state.boxesOpened += 1;
    const mon = randomBoxMonster(state.floor);
    pushLog(`¡Caja abierta! Aparece ${mon.name} (${SPECIES[mon.speciesId].type}).`, true);

    if (state.party.length < MAX_PARTY) {
      state.party.push(mon);
      pushLog(`${mon.name} se une a tu equipo.`);
    } else {
      // Sustituye al más débil o cura / XP si no cabe
      const weakest = state.party.reduce((a, b) =>
        a.level * a.stage <= b.level * b.stage ? a : b
      );
      if (mon.level >= weakest.level && mon.stage >= weakest.stage && weakest.hp > 0) {
        const idx = state.party.indexOf(weakest);
        state.party[idx] = mon;
        if (state.leaderIndex === idx) state.leaderIndex = idx;
        pushLog(`${mon.name} reemplaza a ${weakest.name}.`);
      } else {
        // Bonus XP al líder
        const leader = state.party[state.leaderIndex];
        applyXpEvents(gainXp(leader, 8 + state.floor * 2));
        pushLog(`El equipo está lleno. ${leader.name} gana experiencia.`);
      }
    }
    refreshUI();
  }

  function descend() {
    healParty(state.party, 0.4);
    // Revivir débiles al 30%
    for (const m of state.party) {
      if (m.hp <= 0) m.hp = Math.max(1, Math.round(m.maxHp * 0.3));
    }
    state.floor += 1;
    if (state.floor > WIN_FLOOR) {
      endRun(true);
      return;
    }
    pushLog(`Bajas las escaleras... Piso ${state.floor}.`, true);
    enterFloor();
  }

  function startBattle(mapEnemy) {
    const living = livingMembers(state.party);
    if (!living.length) {
      endRun(false);
      return;
    }

    // Asegurar líder vivo
    if (state.party[state.leaderIndex].hp <= 0) {
      state.leaderIndex = state.party.findIndex((m) => m.hp > 0);
    }

    const wild = randomWild(state.floor);
    // Jefe cada 4 pisos
    if (state.floor % 4 === 0 && !mapEnemy) {
      wild.level += 2;
      wild.name = `Jefe ${wild.name}`;
      // Recalc roughly
      wild.maxHp = Math.round(wild.maxHp * 1.35);
      wild.hp = wild.maxHp;
      wild.atk = Math.round(wild.atk * 1.2);
    }

    state.battle = {
      enemy: wild,
      mapEnemy,
      busy: false,
      captureAvailable: false,
    };

    showScreen("screen-battle");
    renderBattleFighters(state.party[state.leaderIndex], wild);
    setBattleLog(
      mapEnemy
        ? `¡Un ${wild.name} salvaje bloquea el paso!`
        : `¡Encuentro! Un ${wild.name} emerge de las sombras.`
    );
    renderBattleActions();
  }

  function renderBattleActions() {
    const root = document.getElementById("battle-actions");
    root.innerHTML = "";
    if (!state.battle || state.battle.busy) return;

    const ally = state.party[state.leaderIndex];
    const moves = getMoves(ally);

    for (const move of moves) {
      const btn = document.createElement("button");
      btn.className = "btn move";
      btn.innerHTML = `${move.name}<small>Poder ${move.power.toFixed(1)} · ${move.type}</small>`;
      btn.addEventListener("click", () => playerAttack(move));
      root.appendChild(btn);
    }

    // Cambiar
    const switchBtn = document.createElement("button");
    switchBtn.className = "btn ghost";
    switchBtn.textContent = "Cambiar";
    switchBtn.addEventListener("click", () => showSwitchMenu());
    root.appendChild(switchBtn);

    if (state.battle.captureAvailable) {
      const cap = document.createElement("button");
      cap.className = "btn primary";
      cap.textContent = "Capturar en caja";
      cap.addEventListener("click", () => tryCapture());
      root.appendChild(cap);
    }

    const run = document.createElement("button");
    run.className = "btn ghost";
    run.textContent = "Huir";
    run.addEventListener("click", () => tryFlee());
    root.appendChild(run);
  }

  function showSwitchMenu() {
    const root = document.getElementById("battle-actions");
    root.innerHTML = "";
    state.party.forEach((m, i) => {
      if (m.hp <= 0 || i === state.leaderIndex) return;
      const btn = document.createElement("button");
      btn.className = "btn move";
      btn.innerHTML = `${m.name}<small>Nv.${m.level} · ${m.hp}/${m.maxHp}</small>`;
      btn.addEventListener("click", () => {
        state.leaderIndex = i;
        renderBattleFighters(m, state.battle.enemy);
        setBattleLog(`¡Adelante, ${m.name}!`);
        refreshUI();
        // Cambiar consume el turno del jugador: el enemigo ataca
        setTimeout(() => enemyTurn(), 400);
      });
      root.appendChild(btn);
    });
    const back = document.createElement("button");
    back.className = "btn ghost";
    back.textContent = "Atrás";
    back.addEventListener("click", () => renderBattleActions());
    root.appendChild(back);
  }

  async function playerAttack(move) {
    if (!state.battle || state.battle.busy) return;
    state.battle.busy = true;
    renderBattleActions();

    const ally = state.party[state.leaderIndex];
    const enemy = state.battle.enemy;
    const { dmg, mult } = calcDamage(ally, enemy, move);
    enemy.hp = Math.max(0, enemy.hp - dmg);
    renderBattleFighters(ally, enemy);

    let msg = `${ally.name} usa ${move.name}. Inflige ${dmg} de daño.`;
    const eff = effectivenessText(mult);
    if (eff) msg += ` ${eff}`;
    setBattleLog(msg);

    await wait(550);

    if (enemy.hp <= 0) {
      await onEnemyDefeated();
      return;
    }

    await enemyTurn();
  }

  async function enemyTurn() {
    if (!state.battle) return;
    state.battle.busy = true;

    const ally = state.party[state.leaderIndex];
    const enemy = state.battle.enemy;
    const move = chooseEnemyMove(enemy, ally);
    const { dmg, mult } = calcDamage(enemy, ally, move);
    ally.hp = Math.max(0, ally.hp - dmg);
    renderBattleFighters(ally, enemy);
    refreshUI();

    let msg = `${enemy.name} usa ${move.name}. Recibes ${dmg}.`;
    const eff = effectivenessText(mult);
    if (eff) msg += ` ${eff}`;
    setBattleLog(msg);

    await wait(550);

    if (ally.hp <= 0) {
      const living = livingMembers(state.party);
      if (!living.length) {
        endRun(false);
        return;
      }
      setBattleLog(`${ally.name} ha caído. Elige otro compañero.`);
      state.battle.busy = false;
      // Forzar cambio
      const root = document.getElementById("battle-actions");
      root.innerHTML = "";
      living.forEach((m) => {
        const i = state.party.indexOf(m);
        const btn = document.createElement("button");
        btn.className = "btn move";
        btn.innerHTML = `${m.name}<small>Nv.${m.level} · ${m.hp}/${m.maxHp}</small>`;
        btn.addEventListener("click", () => {
          state.leaderIndex = i;
          renderBattleFighters(m, enemy);
          setBattleLog(`¡Adelante, ${m.name}!`);
          refreshUI();
          state.battle.busy = false;
          renderBattleActions();
        });
        root.appendChild(btn);
      });
      return;
    }

    state.battle.busy = false;
    renderBattleActions();
  }

  async function onEnemyDefeated() {
    const enemy = state.battle.enemy;
    if (state.battle.mapEnemy) state.battle.mapEnemy.alive = false;

    state.wins += 1;
    setBattleLog(`¡${enemy.name} derrotado!`);

    const xpGain = 10 + enemy.level * 4 + state.floor * 2;
    const events = [];
    for (const m of livingMembers(state.party)) {
      const share = m === state.party[state.leaderIndex] ? xpGain : Math.floor(xpGain * 0.45);
      events.push(...gainXp(m, share));
    }

    // Ofrecer captura si hay hueco y no es jefe nombrado raro
    const canCapture =
      state.party.length < MAX_PARTY &&
      !String(enemy.name).startsWith("Jefe") &&
      Math.random() < 0.55;

    await wait(500);

    if (canCapture) {
      state.battle.captureAvailable = true;
      state.battle.busy = false;
      setBattleLog(`¡${enemy.name} está agotado! Puedes capturarlo o continuar.`);
      const root = document.getElementById("battle-actions");
      root.innerHTML = "";
      const cap = document.createElement("button");
      cap.className = "btn primary";
      cap.textContent = `Capturar a ${enemy.name}`;
      cap.addEventListener("click", () => {
        // Reset name if needed
        const caught = {
          ...enemy,
          name: SPECIES[enemy.speciesId].name,
          hp: Math.max(1, Math.round(enemy.maxHp * 0.4)),
          uid: `${enemy.speciesId}-${Math.random().toString(36).slice(2, 8)}`,
        };
        state.party.push(caught);
        pushLog(`Capturaste a ${caught.name}.`, true);
        finishBattle(events);
      });
      const skip = document.createElement("button");
      skip.className = "btn ghost";
      skip.textContent = "Dejarlo ir";
      skip.addEventListener("click", () => finishBattle(events));
      root.appendChild(cap);
      root.appendChild(skip);
      return;
    }

    finishBattle(events);
  }

  function finishBattle(events) {
    state.battle = null;
    refreshUI();
    showScreen("screen-game");
    pushLog(`Combate ganado. Victorias: ${state.wins}.`);
    processEvents(events);
  }

  function tryCapture() {
    // unused path kept for safety
  }

  function tryFlee() {
    if (!state.battle || state.battle.busy) return;
    if (Math.random() < 0.6) {
      setBattleLog("¡Escapaste!");
      if (state.battle.mapEnemy) {
        // Empuja al enemigo mentalmente: solo cierras combate
      }
      state.battle = null;
      showScreen("screen-game");
      pushLog("Huiste del combate.");
    } else {
      setBattleLog("¡No pudiste escapar!");
      state.battle.busy = true;
      renderBattleActions();
      setTimeout(() => enemyTurn(), 500);
    }
  }

  function processEvents(events) {
    const evo = events.filter((e) => e.type === "evolve");
    for (const e of events) {
      if (e.type === "level") {
        pushLog(`${e.monster.name} subió al nivel ${e.level}.`);
      }
    }
    if (evo.length) {
      state.pendingEvolutions = evo;
      showEvolution();
    } else {
      refreshUI();
    }
  }

  function applyXpEvents(events) {
    processEvents(events);
  }

  function showEvolution() {
    const next = state.pendingEvolutions.shift();
    if (!next) {
      showScreen("screen-game");
      refreshUI();
      return;
    }
    showScreen("screen-evolve");
    const visual = document.getElementById("evolve-visual");
    const fromSp = Object.values(SPECIES).find((s) => s.name === next.fromName);
    visual.innerHTML = `
      <div class="sprite-preview" id="evo-from"></div>
      <div class="arrow">→</div>
      <div class="sprite-preview" id="evo-to"></div>
    `;
    if (fromSp) applySprite(document.getElementById("evo-from"), fromSp.id);
    applySprite(document.getElementById("evo-to"), next.monster.speciesId);
    document.getElementById("evolve-text").textContent =
      `¡${next.fromName} evolucionó a ${next.toName}!`;
    pushLog(`¡${next.fromName} evolucionó a ${next.toName}!`, true);
  }

  function endRun(victory) {
    state.running = false;
    state.battle = null;
    renderEnd(state, victory);
    showScreen("screen-end");
    renderRunStats(state);
  }

  function wait(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  // Controles
  const keyMap = {
    ArrowUp: [0, -1],
    ArrowDown: [0, 1],
    ArrowLeft: [-1, 0],
    ArrowRight: [1, 0],
    w: [0, -1],
    W: [0, -1],
    s: [0, 1],
    S: [0, 1],
    a: [-1, 0],
    A: [-1, 0],
    d: [1, 0],
    D: [1, 0],
  };

  window.addEventListener("keydown", (ev) => {
    if (ev.key in keyMap) {
      ev.preventDefault();
      const [dx, dy] = keyMap[ev.key];
      tryMove(dx, dy);
    }
    if (ev.key >= "1" && ev.key <= "4") {
      const idx = Number(ev.key) - 1;
      if (state.party[idx] && state.party[idx].hp > 0) {
        state.leaderIndex = idx;
        refreshUI();
        pushLog(`Líder: ${state.party[idx].name}`);
      }
    }
  });

  // Pad táctil (iPhone / móvil)
  document.querySelectorAll(".pad-btn").forEach((btn) => {
    const fire = (ev) => {
      ev.preventDefault();
      const dx = Number(btn.dataset.dx);
      const dy = Number(btn.dataset.dy);
      tryMove(dx, dy);
    };
    btn.addEventListener("pointerdown", fire);
  });

  // Botones UI
  document.getElementById("btn-start").addEventListener("click", beginStarterSelect);
  document.getElementById("btn-howto").addEventListener("click", () => showScreen("screen-howto"));
  document.getElementById("btn-howto-back").addEventListener("click", () => showScreen("screen-menu"));
  document.getElementById("btn-retry").addEventListener("click", beginStarterSelect);
  document.getElementById("btn-evolve-ok").addEventListener("click", () => {
    if (state.pendingEvolutions.length) showEvolution();
    else {
      showScreen("screen-game");
      refreshUI();
    }
  });

  return { startMenu, state };
}
