/**
 * VoxelMon — mundo vóxel estilo Minecraft con captura y combate de criaturas.
 * Módulo principal: escena, bucle de juego, entrada, día/noche, batallas y guardado.
 */

import * as THREE from "three";
import { World, B, BLOCK_DROPS, BIOME_NAMES } from "./world.js";
import { getBiomeName, getBiomeDefinition } from "./biomes.js";
import { RESOURCES, resourceForBlock } from "./resources.js";
import { STRUCTURE_TYPES } from "./structures.js";
import { Player } from "./player.js";
import { Spawner } from "./creatures.js";
import { Battle, TrainerOpponent } from "./battle.js";
import { TRAINERS, trainers } from "./trainers.js";
import { GYMS, GYM_LAYOUT, SWITCH_LABELS, gyms } from "./gyms.js";
import { UI } from "./ui.js";
import { FAMILY_STARTERS, PERKS, activePerks, familyOf, createMonster } from "./data.js";
import { sfx, toggleMute } from "./audio.js";
import { events } from "./events.js";
import { SAVE_KEY, defaultState, loadSave, persistSave } from "./state.js";
import { progression } from "./progression.js";
import { stats } from "./stats.js";
import { interaction } from "./interaction.js";
import { npcs } from "./npcs.js";
import { dialogue } from "./dialogue.js";
import { quests, QUESTS } from "./quests.js";
import { executeTrade } from "./trading.js";

const DAY_LENGTH = 600; // segundos por ciclo completo
const HOTBAR = [B.DIRT, B.STONE, B.SAND, B.WOOD, B.LEAVES, B.SNOW];

// ---------- Escena ----------

const canvas = document.getElementById("game-canvas");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.1, 400);
camera.rotation.order = "YXZ";

const sun = new THREE.DirectionalLight(0xffffff, 1);
scene.add(sun);
scene.add(sun.target);
const ambient = new THREE.AmbientLight(0xbfd4ff, 0.5);
scene.add(ambient);
scene.fog = new THREE.Fog(0x87ceeb, 40, 150);

const highlight = new THREE.LineSegments(
  new THREE.EdgesGeometry(new THREE.BoxGeometry(1.002, 1.002, 1.002)),
  new THREE.LineBasicMaterial({ color: 0x101018, transparent: true, opacity: 0.7 })
);
highlight.visible = false;
scene.add(highlight);

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------- Estado ----------

const ui = new UI();
let world = null;
let player = null;
let spawner = null;
let battle = null;
let state = null;

let mode = "title"; // title | starter | play | battle | pause | dex | dialogue | victory
let locked = false;
let perks = activePerks({});

/** Recalcula las habilidades activas según la dex y las aplica al jugador */
function refreshPerks() {
  perks = activePerks(state?.dex.caught ?? {});
  if (player) player.perks = perks;
}
const keys = new Set();
let selectedSlot = 0;
let dayTime = 0.3;
let regenTimer = 0;
let saveTimer = 0;
let pollTimer = 0; // sondeo periódico de bioma + estructuras cercanas
let lastBiome = null;
const shrineCooldowns = new Map(); // structureId -> timestamp fin de cooldown
const lastPos = new THREE.Vector2();
const particles = [];

// Avisos de gameplay desacoplados mediante el bus de eventos
events.on("biomeDiscovered", ({ biome, biomeName }) => {
  ui.toast(`🧭 Nuevo bioma descubierto: ${biomeName ?? BIOME_NAMES[biome] ?? biome}`, "good");
});
events.on("structureDiscovered", ({ structureType }) => {
  const def = STRUCTURE_TYPES[structureType];
  ui.toast(`${def?.icon ?? "🏛"} Has descubierto: ${def?.name ?? structureType}`, "good");
  if (structureType === "healing_shrine") progression.setFlag("discovered_healing_shrine");
  if (structureType === "settlement") progression.unlock("first_settlement_discovered");
});
events.on("partyHealed", ({ source }) => {
  ui.toast(source === "healer"
    ? "💚 Sena cura por completo a tu equipo."
    : "✨ El santuario restaura por completo a tu equipo.", "good");
});
events.on("resourceCollected", ({ resourceId, amount }) => {
  const res = RESOURCES[resourceId];
  if (!res) return;
  const total = state?.inventory[res.block] ?? 0;
  ui.toast(`${res.icon} +${amount} ${res.name} (${total})`, "good");
});
events.on("badgeEarned", ({ id }) => {
  if (id === "verdant_badge") ui.toast("🏅 Has conseguido la Insignia Verde", "legendary");
  else ui.toast(`🏅 ¡Insignia conseguida: ${id}!`, "legendary");
});
events.on("questStarted", ({ questId }) => {
  ui.toast(`◈ Nueva misión: ${QUESTS[questId]?.title ?? questId}`, "good");
  ui.updateQuestTracker(quests.trackerInfo());
});
events.on("questUpdated", ({ label, current, required }) => {
  if (required > 1) ui.toast(`◈ ${label}: ${current}/${required}`);
  ui.updateQuestTracker(quests.trackerInfo());
});
events.on("questCompleted", ({ title }) => {
  ui.toast(`✅ Misión completada: ${title}`, "legendary");
  ui.updateQuestTracker(quests.trackerInfo());
});
events.on("tradeCompleted", () => {
  progression.unlock("first_trade_completed");
});
events.on("trainerDefeated", ({ trainerId, rewardMoney }) => {
  const def = TRAINERS[trainerId];
  ui.toast(`🎖 ¡Has derrotado a ${def?.name ?? trainerId}! +${rewardMoney} ⌾`, "good");
});
events.on("progressUnlocked", ({ id }) => {
  if (id === "gym_path_unlocked") {
    ui.toast("🏆 Has demostrado que estás listo para buscar el primer gimnasio.", "legendary");
  }
  if (id === "region_2_path_unlocked") {
    ui.toast("🌄 Un nuevo camino se abre más allá del bosque… (próximamente)", "legendary");
  }
});
events.on("gymPuzzleProgress", ({ current, required, reset }) => {
  if (reset) ui.toast("↺ Secuencia incorrecta. Los pedestales se reinician.", "bad");
  else ui.toast(`🌿 Pedestales activados: ${current}/${required}`);
  refreshGymTracker();
});
events.on("gymPuzzleSolved", () => {
  ui.toast("🌿 ¡Puzzle resuelto! La puerta del líder puede abrirse.", "good");
  refreshGymTracker();
});
events.on("gymEntered", () => {
  ui.toast("🌿 Gimnasio Verde", "good");
});

// ---------- Diálogos: acciones controladas, condiciones y modo de juego ----------

trainers.setRewardHandler((money) => addMoney(money));

quests.setRewardHandler((rewards) => {
  if (rewards.money) addMoney(rewards.money);
  if (rewards.balls) state.balls += rewards.balls;
  if (rewards.badge) progression.addBadge(rewards.badge);
  if (rewards.unlock) progression.unlock(rewards.unlock);
  const parts = [];
  if (rewards.money) parts.push(`+${rewards.money} ⌾`);
  if (rewards.balls) parts.push(`+${rewards.balls} ▣`);
  if (parts.length) ui.toast(`🎁 Recompensa: ${parts.join(" · ")}`, "good");
  ui.refreshHud();
});

dialogue.setConditions({
  questAvailable: (id) => quests.isAvailable(id),
  questActive: (id) => quests.isActive(id),
  questCompleted: (id) => quests.isCompleted(id),
  flag: (id) => progression.hasFlag(id),
  unlocked: (id) => progression.isUnlocked(id),
});

dialogue.registerAction("startQuest", (a) => { quests.start(a.questId); });
dialogue.registerAction("setFlag", (a) => { progression.setFlag(a.id); });
dialogue.registerAction("trade", (a) => {
  const r = executeTrade(state, a.tradeId);
  if (!r.ok) {
    ui.toast(r.error, "bad");
    return false; // el diálogo permanece en el nodo actual
  }
  sfx.select();
  ui.toast(`▣ +${r.trade.gives.balls} cubo (tienes ${state.balls})`, "good");
  ui.refreshHud();
  saveGame();
});
dialogue.registerAction("heal", (a, ctx) => {
  for (const m of state.team) m.hp = m.maxHp;
  sfx.heal();
  events.emit("partyHealed", { source: "healer", structureId: ctx?.npc?.structureId });
  ui.refreshHud();
});
dialogue.registerAction("startTrainerBattle", (a, ctx) => {
  const check = trainers.canBattle(a.trainerId);
  if (!check.ok) {
    ui.toast(check.reason, "bad");
    return false; // el diálogo no avanza
  }
  const npc = ctx?.npc ?? null;
  // La batalla arranca tras cerrarse el diálogo (la opción lleva end: true)
  setTimeout(() => startTrainerBattle(a.trainerId, npc), 60);
});

dialogue.onOpen = () => {
  if (mode !== "play") return;
  mode = "dialogue";
  document.exitPointerLock();
  ui.setTargetPrompt(null);
  highlight.visible = false;
  keys.clear();
};
dialogue.onClose = () => {
  if (mode !== "dialogue") return;
  mode = "play";
  canvas.requestPointerLock();
  saveGame();
};

function saveGame() {
  if (!state || !player) return;
  state.edits = world.edits;
  state.dayTime = dayTime;
  state.pos = { x: player.pos.x, y: player.pos.y, z: player.pos.z, yaw: player.yaw, pitch: player.pitch };
  persistSave(state);
}

// ---------- Arranque de mundo ----------

async function startWorld(saved) {
  ui.showLoading("Generando el mundo vóxel…");
  await nextFrame();

  state = saved ?? state;
  ui.state = state;
  dayTime = state.dayTime ?? 0.3;

  world = new World(scene, state.seed, state.edits);
  const px = state.pos?.x ?? 8.5;
  const pz = state.pos?.z ?? 8.5;

  // Pregenera el área inicial
  let guard = 0;
  while (world.update(px, pz, 10) > 0 && guard++ < 400) {
    ui.showLoading(`Generando el mundo vóxel… (${world.chunks.size} chunks)`);
    await nextFrame();
  }

  const py = state.pos?.y ?? world.surfaceY(px, pz) + 2;
  player = new Player(px, py, pz);
  refreshPerks();
  progression.attach(state);
  stats.attach(state);
  interaction.clear();
  npcs.init(scene, world, interaction);
  quests.attach(state);
  trainers.attach(state);
  gyms.attach(state);
  gyms.setProgression(progression);
  // El bioma inicial cuenta como descubierto (sin toast en la carga)
  state.stats.biomesDiscovered[world.biomeAt(px, pz)] = true;
  lastBiome = world.biomeAt(px, pz);
  lastPos.set(px, pz);
  if (state.pos) {
    player.yaw = state.pos.yaw ?? 0;
    player.pitch = state.pos.pitch ?? 0;
  }

  spawner = new Spawner(scene, world);
  if (state.legendarySpawned && !state.dex.caught.prismaton) {
    spawner.spawnLegendary(player, world);
  }

  ui.buildHotbar(HOTBAR);
  ui.refreshHotbar(HOTBAR, state.inventory, selectedSlot);
  ui.refreshHud();
  ui.hideLoading();
  ui.show(ui.el.hud);
  ui.updateQuestTracker(quests.trackerInfo());
  mode = "play";
  ui.setTargetPrompt("Haz clic para tomar el control");
}

function newGame() {
  const seed = (Math.random() * 0xffffffff) >>> 0;
  state = defaultState(seed);
  ui.state = state;
  ui.hide(ui.el.title);
  ui.showStarters(["emberin", "gotita", "semilla"], (id) => {
    const starter = createMonster(id, 3);
    state.team.push(starter);
    state.dex.caught[id] = true;
    state.dex.seen[id] = true;
    startWorld(null);
  });
}

// ---------- Entrada ----------

document.addEventListener("keydown", (e) => {
  if (e.code === "Tab") {
    e.preventDefault();
    if (mode === "play" || mode === "dex") toggleDex();
    return;
  }
  if (mode === "dialogue" && (e.code === "Escape" || e.code === "KeyE")) {
    dialogue.close();
    return;
  }
  if (mode !== "play") return;
  keys.add(e.code);
  if (e.code === "KeyE") {
    // Prioridad: interactuable cercano (NPC, santuario…) > criatura en la mira
    if (interaction.interact(player.pos)) return;
    const c = creatureInSight();
    if (c) startBattle(c.entity);
    return;
  }
  const n = parseInt(e.key, 10);
  if (n >= 1 && n <= HOTBAR.length) {
    selectedSlot = n - 1;
    sfx.select();
    ui.refreshHotbar(HOTBAR, state.inventory, selectedSlot);
  }
});
document.addEventListener("keyup", (e) => keys.delete(e.code));
window.addEventListener("blur", () => keys.clear());

canvas.addEventListener("click", () => {
  if (mode === "play" && !locked) canvas.requestPointerLock();
});

document.addEventListener("pointerlockchange", () => {
  locked = document.pointerLockElement === canvas;
  if (locked) {
    ui.setTargetPrompt(null);
  } else if (mode === "play") {
    showPause();
  }
});

document.addEventListener("mousemove", (e) => {
  if (locked && mode === "play" && player) player.onMouseMove(e.movementX, e.movementY);
});

document.addEventListener("wheel", (e) => {
  if (mode !== "play" || !locked) return;
  selectedSlot = (selectedSlot + (e.deltaY > 0 ? 1 : -1) + HOTBAR.length) % HOTBAR.length;
  ui.refreshHotbar(HOTBAR, state.inventory, selectedSlot);
});

canvas.addEventListener("mousedown", (e) => {
  if (mode !== "play" || !locked) return;
  if (e.button === 0) onPrimary();
  else if (e.button === 2) onPlace();
});
canvas.addEventListener("contextmenu", (e) => e.preventDefault());

/**
 * Criatura bajo la mira, con asistencia de puntería generosa: se elige la
 * criatura cuyo centro queda más cerca del rayo de visión (distancia
 * perpendicular), visible y a menos de maxDist bloques.
 */
function creatureInSight(maxDist = 12) {
  if (!spawner?.creatures.length || !player) return null;
  const eye = player.eyePos();
  const look = player.lookDir();
  let best = null;
  for (const c of spawner.creatures) {
    if (c.dead || c.inBattle) continue;
    const center = c.group.position.clone();
    center.y += (c.group.userData.height ?? 1.5) * 0.5;
    const to = center.sub(eye);
    const dist = to.length();
    if (dist > maxDist || dist < 0.4) continue;
    const along = to.dot(look);
    if (along <= 0) continue; // detrás del jugador
    const perp = Math.sqrt(Math.max(0, dist * dist - along * along));
    const reach = 1.0 + dist * 0.14; // tolerancia creciente con la distancia
    if (perp > reach) continue;
    const dir = to.multiplyScalar(1 / dist);
    const hit = world.raycast(eye, dir, dist);
    if (hit && hit.dist < dist - 1.2) continue; // ocluida por terreno
    const score = perp / reach;
    if (!best || score < best.score) best = { entity: c, dist, score };
  }
  return best;
}

function onPrimary() {
  const c = creatureInSight();
  if (c) {
    startBattle(c.entity);
    return;
  }
  const blockHit = world.raycast(player.eyePos(), player.lookDir(), 6);
  if (!blockHit) return;
  mineBlockAt(blockHit.x, blockHit.y, blockHit.z);
}

/** Mina un bloque: drop al inventario y eventos (blockMined / resourceCollected) */
function mineBlockAt(x, y, z) {
  const block = world.getBlock(x, y, z);
  if (block === B.AIR || block === B.WATER) return;
  if (block === B.BEDROCK) {
    ui.toast("La roca madre es indestructible.");
    return;
  }
  world.setBlock(x, y, z, B.AIR);
  sfx.break();
  spawnBreakParticles(x, y, z, block);
  const drop = BLOCK_DROPS[block];
  let amount = 0;
  if (drop) {
    const bonus = Math.random() < perks.doubleDrop ? 1 : 0;
    amount = 1 + bonus;
    state.inventory[drop] = (state.inventory[drop] ?? 0) + amount;
    if (bonus) ui.toast("🪨 ¡Manos de roca: bloque doble!");
    ui.refreshHotbar(HOTBAR, state.inventory, selectedSlot);
  }
  events.emit("blockMined", { x, y, z, block, drop });
  // Evento específico de recurso: los sistemas futuros (misiones, crafting)
  // escuchan la identidad del recurso sin conocer ids de bloque.
  const res = resourceForBlock(block);
  if (res && amount > 0) {
    events.emit("resourceCollected", {
      resourceId: res.id,
      amount,
      source: "mining",
      biomeId: world.biomeAt(x, z),
      x, y, z,
    });
  }
}

/** Interacción con el santuario curativo: cura al equipo con cooldown corto */
function useShrine(s) {
  const now = performance.now();
  if ((shrineCooldowns.get(s.id) ?? 0) > now) {
    ui.toast("El santuario aún recarga su energía…");
    return;
  }
  shrineCooldowns.set(s.id, now + 20000);
  for (const m of state.team) m.hp = m.maxHp;
  sfx.heal();
  events.emit("partyHealed", { source: "healing_shrine", structureId: s.id });
  ui.refreshHud();
  saveGame();
}

function gymWorldPos(s, local) {
  return { x: s.x + local[0] + 0.5, y: s.y + 1.2, z: s.z + local[1] + 0.5 };
}

function teleportPlayer(x, y, z) {
  player.pos.set(x, y, z);
  player.vel.set(0, 0, 0);
}

function registerGymInteractables(s, wanted) {
  const put = (id, local, range, prompt, onInteract) => {
    wanted.add(id);
    const p = gymWorldPos(s, local);
    const existing = interaction.items.get(id);
    if (existing) {
      existing.prompt = prompt;
      return;
    }
    interaction.register({
      id, type: "gym", x: p.x, y: p.y, z: p.z, range, prompt, data: s, onInteract,
    });
  };

  const open = gyms.canEnter();
  put(`gym:${s.id}:door`, GYM_LAYOUT.door, 3.2,
    open ? "Entrar al gimnasio" : "La puerta está cerrada. Necesitas demostrar tu experiencia como entrenador.",
    () => {
      if (!gyms.canEnter()) {
        ui.toast("La puerta está cerrada. Necesitas demostrar tu experiencia como entrenador.", "bad");
        return;
      }
      const dest = gymWorldPos(s, GYM_LAYOUT.reception);
      teleportPlayer(dest.x, dest.y, dest.z);
      if (gyms.markEntered()) events.emit("gymEntered", { gymId: "gym_verdant", structureId: s.id });
      saveGame();
    });

  put(`gym:${s.id}:exit`, GYM_LAYOUT.reception, 2.8, "Salir del gimnasio", () => {
    const dest = gymWorldPos(s, GYM_LAYOUT.exit);
    teleportPlayer(dest.x, dest.y, dest.z);
  });

  const leaderOpen = gyms.canEnterLeader();
  put(`gym:${s.id}:leader`, GYM_LAYOUT.leaderDoor, 2.8,
    leaderOpen ? "Entrar a la sala del líder" : "La puerta del líder sigue cerrada.",
    () => {
      if (!gyms.canEnterLeader()) {
        ui.toast("La puerta del líder sigue cerrada.", "bad");
        return;
      }
      const dest = gymWorldPos(s, GYM_LAYOUT.leaderRoom);
      teleportPlayer(dest.x, dest.y, dest.z);
    });

  for (const [sid, local] of Object.entries(GYM_LAYOUT.switches)) {
    put(`gym:${s.id}:switch:${sid}`, local, 2.4, SWITCH_LABELS[sid], () => {
      const r = gyms.activateSwitch("gym_verdant", sid);
      if (r.already) ui.toast("El puzzle ya está resuelto.");
      saveGame();
    });
  }
}

function refreshGymTracker(nearGym = null) {
  if (!nearGym || gyms.isCompleted()) {
    ui.updateGymTracker(null);
    return;
  }
  const st = gyms.gymState();
  const cur = st.puzzleSolved ? 3 : st.puzzleAttempt.length;
  ui.updateGymTracker({
    title: GYMS.gym_verdant.name,
    label: st.puzzleSolved
      ? (st.leaderReady ? "Sala del líder abierta" : "Puzzle resuelto")
      : `Pedestales activados: ${cur}/3`,
  });
}

function onPlace() {
  const b = HOTBAR[selectedSlot];
  if ((state.inventory[b] ?? 0) <= 0) {
    ui.toast("No tienes ese bloque. ¡Mina para conseguirlo!");
    return;
  }
  const hit = world.raycast(player.eyePos(), player.lookDir(), 6);
  if (!hit) return;
  const x = hit.x + hit.nx;
  const y = hit.y + hit.ny;
  const z = hit.z + hit.nz;
  if (player.occupiesBlock(x, y, z)) return;
  const existing = world.getBlock(x, y, z);
  if (existing !== B.AIR && existing !== B.WATER) return;
  world.setBlock(x, y, z, b);
  state.inventory[b] -= 1;
  sfx.place();
  ui.refreshHotbar(HOTBAR, state.inventory, selectedSlot);
  events.emit("blockPlaced", { x, y, z, block: b });
}

/** Suma o resta monedas y lo anuncia */
function addMoney(delta) {
  state.money = Math.max(0, (state.money ?? 0) + delta);
  events.emit("moneyChanged", { money: state.money, delta });
  ui.refreshHud();
}

function spawnBreakParticles(x, y, z, block) {
  const colors = {
    [B.GRASS]: 0x5aa338, [B.DIRT]: 0x8a6642, [B.STONE]: 0x8d8d94, [B.SAND]: 0xe2d08f,
    [B.WOOD]: 0x7d5a30, [B.LEAVES]: 0x48a03c, [B.SNOW]: 0xeef2f5,
    [B.COAL_ORE]: 0x44464e, [B.COPPER_ORE]: 0xc07a4a, [B.IRON_ORE]: 0xc9b69e,
    [B.CRYSTAL]: 0x8ee4fa, [B.APRICORN]: 0xd98438, [B.HERB]: 0x8cd455,
  };
  for (let i = 0; i < 8; i++) {
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(0.09, 0.09, 0.09),
      new THREE.MeshLambertMaterial({ color: colors[block] ?? 0x999999 })
    );
    m.position.set(x + Math.random(), y + Math.random(), z + Math.random());
    scene.add(m);
    particles.push({
      mesh: m,
      vel: new THREE.Vector3((Math.random() - 0.5) * 3, Math.random() * 3.5, (Math.random() - 0.5) * 3),
      life: 0.65,
    });
  }
}

// ---------- Menús ----------

function showPause() {
  if (mode !== "play") return;
  mode = "pause";
  ui.renderQuests(quests.summary());
  ui.renderStats();
  ui.show(ui.el.pause);
  saveGame();
}

document.getElementById("btn-resume").addEventListener("click", () => {
  ui.hide(ui.el.pause);
  if (world) {
    mode = "play";
    canvas.requestPointerLock();
  } else {
    mode = "title";
  }
});

document.getElementById("btn-mute").addEventListener("click", (e) => {
  e.target.textContent = toggleMute() ? "Activar sonido" : "Silenciar sonido";
});

document.getElementById("btn-reset").addEventListener("click", () => {
  if (confirm("¿Borrar la partida guardada y empezar de cero?")) {
    localStorage.removeItem(SAVE_KEY);
    location.reload();
  }
});

function toggleDex() {
  if (mode === "dex") {
    ui.hide(ui.el.dex);
    mode = "play";
    canvas.requestPointerLock();
  } else if (mode === "play") {
    mode = "dex";
    document.exitPointerLock();
    ui.renderDex();
    ui.show(ui.el.dex);
  }
}
document.getElementById("btn-dex-close").addEventListener("click", toggleDex);

document.getElementById("btn-new").addEventListener("click", () => {
  const existing = loadSave();
  if (existing && !confirm("Hay una partida guardada. ¿Empezar de cero y borrarla?")) return;
  localStorage.removeItem(SAVE_KEY);
  sfx.select();
  newGame();
});

document.getElementById("btn-continue").addEventListener("click", () => {
  sfx.select();
  ui.hide(ui.el.title);
  startWorld(loadSave());
});

document.getElementById("btn-help-title").addEventListener("click", () => {
  ui.show(ui.el.pause);
});

document.getElementById("btn-victory-close").addEventListener("click", () => {
  ui.hide(ui.el.victory);
  mode = "play";
  canvas.requestPointerLock();
});

// ---------- Batalla ----------

async function startBattle(wild) {
  if (mode !== "play" || battle) return;
  mode = "battle";
  document.exitPointerLock();
  ui.setTargetPrompt(null);
  const wildInfo = { speciesId: wild.monster.speciesId, level: wild.monster.level, type: "wild" };
  if (!state.dex.seen[wildInfo.speciesId]) events.emit("creatureSeen", wildInfo);
  state.dex.seen[wildInfo.speciesId] = true;
  events.emit("battleStarted", wildInfo);

  battle = new Battle({ scene, camera, world, player, wild, team: state.team, state, ui });
  ui.onEvolve = (m) => {
    state.dex.caught[m.speciesId] = true;
    state.dex.seen[m.speciesId] = true;
    events.emit("creatureEvolved", { speciesId: m.speciesId });
    ui.refreshHud();
  };
  const result = await battle.run();
  battle = null;

  if (result === "win") {
    spawner.removeCreature(wild);
    events.emit("creatureDefeated", wildInfo);
    events.emit("battleWon", wildInfo);
    const reward = 4 + wildInfo.level * 2;
    addMoney(reward);
    ui.toast(`+${reward} ⌾ por la victoria.`, "good");
  } else if (result === "caught") {
    spawner.removeCreature(wild);
    const m = wild.monster;
    const fam = familyOf(m.speciesId);
    const famWasNew = fam && PERKS[fam] && !ui.familyCaught(fam);
    state.dex.caught[m.speciesId] = true;
    if (state.team.length < 6) {
      state.team.push(m);
      ui.toast(`${m.name} se unió a tu equipo.`, "good");
    } else {
      ui.toast(`${m.name} fue enviado a la Caja (equipo lleno).`);
    }
    if (famWasNew) {
      const p = PERKS[fam];
      refreshPerks();
      ui.toast(`${p.icon} Habilidad desbloqueada: ${p.name} — ${p.desc}`, "good");
    }
    events.emit("creatureCaptured", wildInfo);
    events.emit("battleWon", wildInfo);
    if (m.speciesId === "prismaton" && !state.victoryShown) {
      state.victoryShown = true;
      mode = "victory";
      document.getElementById("victory-text").textContent =
        "Capturaste al legendario Prismatón y completaste la aventura. El mundo sigue siendo tuyo: construye, explora y entrena sin límite.";
      ui.show(ui.el.victory);
      saveGame();
      return;
    }
    checkLegendary();
  } else if (result === "lost") {
    events.emit("battleLost", wildInfo);
    for (const m of state.team) m.hp = m.maxHp;
    player.pos.set(8.5, world.surfaceY(8.5, 8.5) + 2, 8.5);
    player.vel.set(0, 0, 0);
    ui.toast("Todo tu equipo cayó… Despiertas en el punto de origen, recuperado.", "bad");
  } else if (result === "fled") {
    events.emit("battleFled", wildInfo);
  }

  ui.refreshHud();
  saveGame();
  mode = "play";
  ui.setTargetPrompt("Haz clic para tomar el control");
}

/**
 * Combate contra entrenador (Fase 4): reutiliza Battle con un
 * TrainerOpponent y contexto de equipo rival. La recompensa pasa
 * exclusivamente por trainers.resolveVictory (idempotente).
 */
async function startTrainerBattle(trainerId, npc = null) {
  if (mode !== "play" || battle) return;
  const check = trainers.canBattle(trainerId);
  if (!check.ok) {
    ui.toast(check.reason, "bad");
    return;
  }
  const def = TRAINERS[trainerId];
  mode = "battle";
  document.exitPointerLock();
  ui.setTargetPrompt(null);

  const teamMonsters = def.team.map((t) => createMonster(t.speciesId, t.level));

  // El oponente aparece entre el entrenador y el jugador (o frente al
  // jugador si el combate se lanzó por debug sin NPC cercano)
  let ox, oz;
  if (npc?.group) {
    const nx = npc.group.position.x;
    const nz = npc.group.position.z;
    let dx = player.pos.x - nx;
    let dz = player.pos.z - nz;
    const len = Math.hypot(dx, dz);
    if (len < 0.01) { dx = 0; dz = 1; } else { dx /= len; dz /= len; }
    ox = nx + dx * 2.5;
    oz = nz + dz * 2.5;
  } else {
    const look = player.lookDir();
    ox = player.pos.x + look.x * 5;
    oz = player.pos.z + look.z * 5;
  }
  const opponent = new TrainerOpponent(scene, world, teamMonsters[0], ox, oz);

  events.emit("trainerBattleStarted", { trainerId });
  events.emit("battleStarted", {
    type: "trainer", trainerId, speciesId: teamMonsters[0].speciesId, level: teamMonsters[0].level,
  });

  battle = new Battle({
    scene, camera, world, player, wild: opponent, team: state.team, state, ui,
    ctx: { type: "trainer", trainer: def, queue: teamMonsters.slice(1) },
  });
  const result = await battle.run();
  battle = null;
  opponent.dispose();

  if (result === "win") {
    const reward = def.leader
      ? gyms.resolveLeaderVictory(trainerId)
      : trainers.resolveVictory(trainerId);
    events.emit("battleWon", { type: "trainer", trainerId });
    if (!reward) ui.toast(`Buen combate de entrenamiento contra ${def.name}.`, "good");
  } else if (result === "lost") {
    events.emit("trainerBattleLost", { trainerId });
    events.emit("battleLost", { type: "trainer", trainerId });
    for (const m of state.team) m.hp = m.maxHp;
    ui.toast(`Perdiste contra ${def.name}… Tu equipo se recupera. ¡Vuelve a intentarlo!`, "bad");
  }

  ui.refreshHud();
  saveGame();
  mode = "play";
  ui.setTargetPrompt("Haz clic para tomar el control");
}

function checkLegendary() {
  if (state.legendarySpawned) return;
  const fams = FAMILY_STARTERS.filter((f) => ui.familyCaught(f)).length;
  if (fams >= 8) {
    state.legendarySpawned = true;
    sfx.legendary();
    spawner.spawnLegendary(player, world);
    ui.toast("✦ El cielo tiembla… ¡El legendario PRISMATÓN ha aparecido cerca! ✦", "legendary");
  }
}

// ---------- Día / noche ----------

const SKY_DAY = new THREE.Color(0x87ceeb);
const SKY_SUNSET = new THREE.Color(0xf2a35c);
const SKY_NIGHT = new THREE.Color(0x141a36);

function updateDayNight(dt) {
  dayTime = (dayTime + dt / DAY_LENGTH) % 1;
  const angle = dayTime * Math.PI * 2;
  const elev = Math.sin(angle); // >0 día
  const dayFactor = Math.max(0, Math.min(1, elev * 1.6));

  sun.position.set(Math.cos(angle) * 80, elev * 100, 30);
  sun.target.position.set(0, 0, 0);
  // Visión nocturna: sube el mínimo de luz cuando es de noche
  const nv = perks.nightVision ? (1 - dayFactor) * 0.3 : 0;
  sun.intensity = 0.38 + nv + dayFactor * 0.75;
  ambient.intensity = 0.34 + nv * 0.8 + dayFactor * 0.34;

  const sky = new THREE.Color();
  if (elev > 0.18) sky.copy(SKY_DAY);
  else if (elev > -0.12) {
    const k = (elev + 0.12) / 0.3;
    sky.lerpColors(k < 0.5 ? SKY_NIGHT : SKY_SUNSET, k < 0.5 ? SKY_SUNSET : SKY_DAY, k < 0.5 ? k * 2 : (k - 0.5) * 2);
  } else sky.copy(SKY_NIGHT);
  scene.background = sky;
  scene.fog.color.copy(sky);

  ui.setClock(dayFactor);
  return dayFactor;
}

// ---------- Bucle principal ----------

let last = performance.now();
let elapsed = 0;

function nextFrame() {
  return new Promise((r) => requestAnimationFrame(r));
}

function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min((now - last) / 1000, 0.1);
  last = now;
  elapsed += dt;

  if (!world || !player) {
    renderer.render(scene, camera);
    return;
  }

  const dayFactor = updateDayNight(dt);

  const playing = mode === "play";
  if (playing && locked) {
    player.update(dt, world, keys);
    stats.addDistance(Math.hypot(player.pos.x - lastPos.x, player.pos.z - lastPos.y));
  }
  lastPos.set(player.pos.x, player.pos.z);

  // Sondeo periódico: descubrimiento de biomas/estructuras y santuario cercano.
  // Las consultas son O(celdas vecinas) gracias al índice por celdas cacheado.
  pollTimer += dt;
  if (pollTimer >= 0.75 && playing && state) {
    pollTimer = 0;
    const px = player.pos.x;
    const pz = player.pos.z;

    const biome = world.biomeAt(px, pz);
    if (biome !== lastBiome) {
      lastBiome = biome;
      if (!state.stats.biomesDiscovered[biome]) {
        events.emit("biomeDiscovered", { biome, biomeId: biome, biomeName: getBiomeName(biome), x: px, z: pz });
      }
    }

    // Descubrimiento + registro de interactuables de estructura cercanos
    const wantedShrines = new Set();
    const wantedGym = new Set();
    let nearGym = null;
    for (const s of world.structures.near(px, pz, 20)) {
      if (!state.stats.structuresDiscovered[s.id]) {
        events.emit("structureDiscovered", {
          structureId: s.id, structureType: s.type, biomeId: s.biome, x: s.x, y: s.y, z: s.z,
        });
      }
      if (s.type === "healing_shrine") {
        const id = `shrine:${s.id}`;
        wantedShrines.add(id);
        if (!interaction.has(id)) {
          interaction.register({
            id,
            type: "shrine",
            x: s.x + 0.5, y: s.y + 2, z: s.z + 0.5,
            range: 4.5,
            prompt: "Curar a tu equipo (santuario)",
            data: s,
            onInteract: () => useShrine(s),
          });
        }
      }
      if (s.type === "gym") {
        nearGym = s;
        registerGymInteractables(s, wantedGym);
      }
    }
    for (const id of interaction.ids("shrine")) {
      if (!wantedShrines.has(id)) interaction.unregister(id);
    }
    for (const id of interaction.ids("gym")) {
      if (!wantedGym.has(id)) interaction.unregister(id);
    }
    refreshGymTracker(nearGym);

    // NPC de asentamientos: reconciliación por distancia, sin duplicados
    npcs.sync(px, pz);
  }

  world.update(player.pos.x, player.pos.z, 2);
  spawner.update(dt, player, dayFactor, elapsed);
  npcs.update(dt, player.pos, elapsed);

  // Partículas de minado
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    p.vel.y -= 12 * dt;
    p.mesh.position.addScaledVector(p.vel, dt);
    p.mesh.scale.setScalar(Math.max(0.05, p.life / 0.65));
    if (p.life <= 0) {
      scene.remove(p.mesh);
      p.mesh.geometry.dispose();
      p.mesh.material.dispose();
      particles.splice(i, 1);
    }
  }

  if (mode === "battle" && battle) {
    battle.update(dt, elapsed);
    highlight.visible = false;
  } else {
    // Cámara en primera persona
    camera.position.copy(player.eyePos());
    camera.rotation.y = player.yaw;
    camera.rotation.x = player.pitch;

    // Objetivo bajo el punto de mira / interactuable cercano
    if (playing && locked) {
      const inter = interaction.current(player.pos);
      const c = creatureInSight();
      const blockHit = world.raycast(player.eyePos(), player.lookDir(), 6);
      if (blockHit && !c) {
        highlight.position.set(blockHit.x + 0.5, blockHit.y + 0.5, blockHit.z + 0.5);
        highlight.visible = true;
      } else {
        highlight.visible = false;
      }
      if (inter) {
        ui.setTargetPrompt(`E — ${inter.prompt}`);
      } else if (c) {
        const m = c.entity.monster;
        ui.setTargetPrompt(`⚔ ${m.name} · Nv ${m.level} — clic izquierdo o E para desafiar`);
      } else {
        ui.setTargetPrompt(null);
      }
    } else {
      highlight.visible = false;
    }

    // Regeneración fuera de combate (Fotosíntesis la duplica)
    regenTimer += dt;
    if (regenTimer >= 2 && state) {
      regenTimer = 0;
      let changed = false;
      for (const m of state.team) {
        if (m.hp < m.maxHp) {
          m.hp = Math.min(m.maxHp, m.hp + Math.max(1, Math.round(m.maxHp * 0.02 * perks.regenMult)));
          changed = true;
        }
      }
      if (changed) ui.refreshHud();
    }
  }

  // Efecto submarino cuando la cámara está dentro del agua
  const underwater = world.isWater(camera.position.x, camera.position.y, camera.position.z);
  document.getElementById("water-overlay").classList.toggle("hidden", !underwater);
  if (underwater) {
    scene.fog.near = 1;
    scene.fog.far = 22;
    scene.fog.color.set(0x2a5fae);
  } else {
    scene.fog.near = 40;
    scene.fog.far = 150;
  }

  // Autoguardado
  saveTimer += dt;
  if (saveTimer > 8 && mode === "play") {
    saveTimer = 0;
    saveGame();
  }

  renderer.render(scene, camera);
}

window.addEventListener("beforeunload", saveGame);

// ---------- Inicio ----------

ui.showTitle(!!loadSave());
requestAnimationFrame(loop);

// Ganchos de depuración/pruebas (no afectan al juego)
window.__vm = {
  get world() { return world; },
  get player() { return player; },
  get spawner() { return spawner; },
  get state() { return state; },
  get mode() { return mode; },
  creatureInSight,
  startBattle,
  setDayTime(v) { dayTime = ((v % 1) + 1) % 1; },
  events,
  progression,
  stats,
  addMoney,
  questSystem: quests,
  npcSystem: npcs,
  dialogueSystem: dialogue,
  interactionSystem: interaction,
  trainerSystem: trainers,
  gymSystem: gyms,
  /** Herramientas de inspección del mundo vivo (Fase 2) */
  debug: {
    pos() {
      return player ? { x: player.pos.x, y: player.pos.y, z: player.pos.z } : null;
    },
    biome() {
      if (!world || !player) return null;
      const id = world.biomeAt(player.pos.x, player.pos.z);
      const def = getBiomeDefinition(id);
      return { id, name: def.name, difficulty: def.difficulty, climate: def.climate };
    },
    /** Estructuras cercanas (centro a menos de r bloques) */
    structures(r = 96) {
      return world && player ? world.structures.near(player.pos.x, player.pos.z, r) : [];
    },
    /** Bloques de recurso en un cubo de radio r alrededor del jugador */
    resourcesNear(r = 10) {
      if (!world || !player) return [];
      const out = [];
      const R = Math.min(16, r);
      const cx = Math.floor(player.pos.x);
      const cy = Math.floor(player.pos.y);
      const cz = Math.floor(player.pos.z);
      for (let y = Math.max(1, cy - R); y <= cy + R; y++) {
        for (let z = cz - R; z <= cz + R; z++) {
          for (let x = cx - R; x <= cx + R; x++) {
            const res = resourceForBlock(world.getBlock(x, y, z));
            if (res) out.push({ id: res.id, name: res.name, x, y, z });
          }
        }
      }
      return out;
    },
    discovered() {
      return {
        biomes: { ...(state?.stats.biomesDiscovered ?? {}) },
        structures: { ...(state?.stats.structuresDiscovered ?? {}) },
      };
    },
    mine(x, y, z) { mineBlockAt(x, y, z); },
    get nearShrine() {
      const it = player ? interaction.current(player.pos) : null;
      return it?.type === "shrine" ? it.data : null;
    },
    useShrine() {
      const s = this.nearShrine;
      if (s) useShrine(s);
    },
    save() { saveGame(); },
    // ---- Fase 3 ----
    /** NPC actualmente activos (cercanos) */
    npcs() { return npcs.list(); },
    /** Asentamientos cercanos (centro a menos de r bloques) */
    settlements(r = 400) {
      return world && player
        ? world.structures.near(player.pos.x, player.pos.z, r).filter((s) => s.type === "settlement")
        : [];
    },
    /** Interactuable válido más cercano ahora mismo */
    interaction() {
      const it = player ? interaction.current(player.pos) : null;
      return it ? { id: it.id, type: it.type, prompt: it.prompt, x: it.x, y: it.y, z: it.z } : null;
    },
    /** Estado completo de misiones */
    questState() {
      return state ? {
        active: JSON.parse(JSON.stringify(state.quests.active)),
        completed: Object.keys(state.quests.completed),
        available: Object.keys(state.quests.available),
      } : null;
    },
    /** [debug] fuerza el inicio de una quest disponible */
    startQuest(id) { quests.start(id); },
    /** [debug] abre el diálogo con un NPC activo por rol */
    talk(role) {
      const npc = npcs.list().find((n) => n.role === role);
      if (npc) interaction.items.get(`npc:${npc.id}`)?.onInteract();
    },
    /** [debug] ejecuta un intercambio directamente (sin diálogo) */
    trade(id = "apricorn_balls") { return executeTrade(state, id); },
    /** Entrenadores: activos en el mundo y derrotados (Fase 4) */
    trainers() {
      return {
        defs: Object.keys(TRAINERS),
        active: npcs.list().filter((n) => n.trainerId),
        defeated: trainers.defeatedList(),
      };
    },
    /** Contexto de la batalla en curso (null si no hay) */
    battleContext() {
      if (!battle) return null;
      return {
        type: battle.ctx.type,
        trainerId: battle.trainer?.id ?? null,
        enemy: { speciesId: battle.enemy.speciesId, level: battle.enemy.level, hp: battle.enemy.hp },
        queueLeft: battle.ctx.queue?.length ?? 0,
      };
    },
    /** [debug] lanza un combate contra un entrenador por id */
    startTrainerBattle(id) {
      const npc = npcs.list().find((n) => n.trainerId === id);
      const inst = npc ? npcs.active.get(npc.id) : null;
      startTrainerBattle(id, inst ?? null);
    },
    gymsNear(r = 2500) {
      return world && player
        ? world.structures.near(player.pos.x, player.pos.z, r).filter((s) => s.type === "gym")
        : [];
    },
    gym() {
      const list = this.gymsNear(90);
      return list[0] ?? this.gymsNear(2500)[0] ?? null;
    },
    gymState() {
      return gyms.gymState();
    },
    /** [debug] resetea el puzzle del gimnasio (solo desarrollo) */
    resetGymPuzzle() { gyms.resetPuzzle(); },
    badges() {
      return state ? { ...state.progression.badges } : {};
    },
  },
};
