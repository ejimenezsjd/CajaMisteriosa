/**
 * VoxelMon — mundo vóxel estilo Minecraft con captura y combate de criaturas.
 * Módulo principal: escena, bucle de juego, entrada, día/noche, batallas y guardado.
 */

import * as THREE from "three";
import { World, B, BLOCK_DROPS, BIOME_NAMES } from "./world.js";
import { getBiomeName, getBiomeDefinition } from "./biomes.js";
import { RESOURCES, resourceForBlock } from "./resources.js";
import { STRUCTURE_TYPES, MIST_SETTLEMENT_LAYOUT } from "./structures.js";
import { Player } from "./player.js";
import { Spawner } from "./creatures.js";
import { Battle, TrainerOpponent } from "./battle.js";
import { TRAINERS, trainers } from "./trainers.js";
import { GYMS, GYM_LAYOUT, MIST_GYM_LAYOUT, SWITCH_LABELS, BEACON_LABELS, gyms, gymIdForStructure } from "./gyms.js";
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
import { crafting, RECIPES } from "./crafting.js";
import { getItemCount, grantItems } from "./items.js";
import {
  regions, getRegionAt, getRegionName, nearestGymAnchor,
  REGION_1, REGION_2,
} from "./regions.js";

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

let mode = "title"; // title | starter | play | battle | pause | dex | dialogue | crafting | victory
let locked = false;
let perks = activePerks({});
let fogMistGym = null;

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
let lastRegion = null;
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
  else if (id === "mist_badge") {
    ui.toast("🏅 Has conseguido la Insignia Bruma", "legendary");
    const s = findMistGym(player?.pos.x ?? 0, player?.pos.z ?? 0);
    if (s) applyMistExitOpening(s);
  } else ui.toast(`🏅 ¡Insignia conseguida: ${id}!`, "legendary");
});
events.on("structureDiscovered", ({ structureType }) => {
  if (structureType === "gym_mist") ui.toast("🌫 Gimnasio de las Brumas descubierto", "good");
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
    ui.toast("🌄 La Insignia Verde abre el paso a las Tierras Brumosas.", "legendary");
  }
  if (id === "regional_explorer") {
    ui.toast("🗺 Has sido reconocido como explorador regional.", "good");
  }
  if (id === "basic_crafting_unlocked") {
    ui.toast("⚒ El banco de trabajo del refugio está listo.", "good");
  }
  if (id === "ancient_core_recipe_unlocked") {
    ui.toast("🔮 Talo te enseña a ensamblar el núcleo antiguo.", "good");
  }
  if (id === "gym_2_clue_unlocked") {
    ui.toast("🔮 El núcleo antiguo reacciona. El camino parece haberse activado.", "legendary");
    const s = findMistSettlement(player?.pos.x ?? 0, player?.pos.z ?? 0);
    if (s) applyAncientPathOpening(s);
  }
  if (id === "region_3_path_unlocked") {
    ui.toast("🌄 La Insignia Bruma abre un camino más al sur.", "legendary");
    const s = findMistGym(player?.pos.x ?? 0, player?.pos.z ?? 0);
    if (s) applyMistExitOpening(s);
  }
});
events.on("gymPuzzleProgress", ({ gymId, current, required, reset }) => {
  if (gymId === "gym_mist") ui.toast(`🌫 Faros de bruma: ${current}/${required}`);
  else if (reset) ui.toast("↺ Secuencia incorrecta. Los pedestales se reinician.", "bad");
  else ui.toast(`🌿 Pedestales activados: ${current}/${required}`);
  refreshGymTracker();
});
events.on("gymPuzzleSolved", ({ gymId }) => {
  if (gymId === "gym_mist") ui.toast("🌫 Los tres faros están encendidos.", "good");
  else ui.toast("🌿 ¡Puzzle resuelto! La puerta del líder puede abrirse.", "good");
  maybeLeaderRoomToast(gymId ?? "gym_verdant");
  refreshGymTracker();
});
events.on("gymEntered", ({ gymId }) => {
  if (gymId === "gym_mist") ui.toast("🌫 Gimnasio de las Brumas", "good");
  else ui.toast("🌿 Gimnasio Verde", "good");
});
events.on("trainerDefeated", ({ gymId }) => {
  if (gymId) maybeLeaderRoomToast(gymId);
});
events.on("regionDiscovered", ({ regionName }) => {
  ui.toast(`🌄 Nueva región descubierta: ${regionName}`, "good");
});
events.on("regionGateOpened", () => {
  ui.toast("🚪 El paso fronterizo se ha abierto.", "good");
});
events.on("craftCompleted", ({ recipeId }) => {
  const r = RECIPES[recipeId];
  ui.toast(`⚒ Has fabricado: ${r?.name ?? recipeId}`, "good");
  ui.refreshHud();
  if (crafting.open) crafting.render();
});
events.on("itemUsed", ({ itemId }) => {
  if (itemId === "mist_tonic") {
    ui.toast("🧪 El tónico restaura parte de la salud del equipo.", "good");
  }
  ui.refreshHud();
  if (crafting.open) crafting.render();
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
dialogue.registerAction("openRegionGate", (a) => {
  tryOpenRegionGate({
    regionId: a.regionId ?? REGION_2,
    x: player?.pos.x ?? 0,
    z: player?.pos.z ?? 0,
  });
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

crafting.onOpen = () => {
  if (mode !== "play") return;
  mode = "crafting";
  document.exitPointerLock();
  ui.setTargetPrompt(null);
  highlight.visible = false;
  keys.clear();
};
crafting.onClose = () => {
  if (mode !== "crafting") return;
  mode = "play";
  canvas.requestPointerLock();
  saveGame();
};

crafting.onUseItem = (itemId) => {
  useCraftedItem(itemId);
};
crafting.onCraftError = (msg) => ui.toast(msg, "bad");

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
  regions.attach(state);
  crafting.attach(state);
  // El bioma inicial cuenta como descubierto (sin toast en la carga)
  state.stats.biomesDiscovered[world.biomeAt(px, pz)] = true;
  lastBiome = world.biomeAt(px, pz);
  lastRegion = getRegionAt(px, pz);
  ui.setRegion(getRegionName(lastRegion), lastRegion !== REGION_1);
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
  if (mode === "crafting") {
    if (e.code === "Escape" || e.code === "KeyE") crafting.close();
    else if (e.code === "KeyF") crafting.trySelected();
    else if (e.code === "KeyC") useCraftedItem("mist_tonic");
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
  if (e.code === "KeyC") {
    useCraftedItem("mist_tonic");
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

const leaderRoomAnnounced = new Set();
function maybeLeaderRoomToast(gymId) {
  if (!gymId || leaderRoomAnnounced.has(gymId) || !gyms.canEnterLeader(gymId)) return;
  leaderRoomAnnounced.add(gymId);
  ui.toast("La cámara del líder se ha abierto", "good");
}

function gymWorldPos(s, local) {
  return { x: s.x + local[0] + 0.5, y: s.y + 1.2, z: s.z + local[1] + 0.5 };
}

function teleportPlayer(x, y, z) {
  player.pos.set(x, y, z);
  player.vel.set(0, 0, 0);
}

function isInsideMistGym(s, x, z) {
  return !!s && Math.abs(x - s.x) <= 8.5 && z >= s.z - 13.5 && z <= s.z + 15.5;
}

function isMistExitOpen() {
  return progression.hasBadge("mist_badge") || progression.isUnlocked("region_3_path_unlocked");
}

function registerGymInteractables(s, wanted) {
  const gymId = gymIdForStructure(s);
  const gym = gymId ? GYMS[gymId] : null;
  if (!gym) return;
  const layout = gym.layout ?? (gymId === "gym_mist" ? MIST_GYM_LAYOUT : GYM_LAYOUT);

  const put = (id, local, range, prompt, onInteract) => {
    wanted.add(id);
    const p = gymWorldPos(s, local);
    const existing = interaction.items.get(id);
    if (existing) {
      existing.prompt = prompt;
      existing.x = p.x;
      existing.y = p.y;
      existing.z = p.z;
      return;
    }
    interaction.register({
      id, type: "gym", x: p.x, y: p.y, z: p.z, range, prompt, data: s, onInteract,
    });
  };

  const open = gyms.canEnter(gymId);
  const closedPrompt = gymId === "gym_mist"
    ? "La puerta está sellada. El arco del refugio debe despertar primero."
    : "La puerta está cerrada. Necesitas demostrar tu experiencia como entrenador.";
  put(`gym:${s.id}:door`, layout.door, 3.2,
    open ? "Entrar al gimnasio" : closedPrompt,
    () => {
      if (!gyms.canEnter(gymId)) {
        ui.toast(closedPrompt, "bad");
        return;
      }
      const dest = gymWorldPos(s, layout.reception);
      teleportPlayer(dest.x, dest.y, dest.z);
      if (gyms.markEntered(gymId)) events.emit("gymEntered", { gymId, structureId: s.id });
      saveGame();
    });

  put(`gym:${s.id}:exit`, layout.reception, 2.8, "Salir del gimnasio", () => {
    const dest = gymWorldPos(s, layout.exit);
    teleportPlayer(dest.x, dest.y, dest.z);
  });

  const leaderOpen = gyms.canEnterLeader(gymId);
  put(`gym:${s.id}:leader`, layout.leaderDoor, 2.8,
    leaderOpen ? "Entrar a la sala del líder" : "La puerta del líder sigue cerrada.",
    () => {
      if (!gyms.canEnterLeader(gymId)) {
        ui.toast("La puerta del líder sigue cerrada.", "bad");
        return;
      }
      const dest = gymWorldPos(s, layout.leaderRoom);
      teleportPlayer(dest.x, dest.y, dest.z);
    });

  if (gym.puzzle?.type === "switch_sequence" && layout.switches) {
    for (const [sid, local] of Object.entries(layout.switches)) {
      put(`gym:${s.id}:switch:${sid}`, local, 2.4, SWITCH_LABELS[sid], () => {
        const r = gyms.activateSwitch(gymId, sid);
        if (r.already) ui.toast("El puzzle ya está resuelto.");
        saveGame();
      });
    }
  }

  if (gym.puzzle?.type === "mist_ruins" && layout.beacons) {
    const st = gyms.gymState(gymId);
    const kit = crafting.explorerActive();
    for (const [bid, local] of Object.entries(layout.beacons)) {
      const on = !!st.beacons?.[bid];
      let prompt = BEACON_LABELS[bid] ?? bid;
      if (on) prompt += " (activo)";
      else if (kit) prompt = `✦ ${prompt}`;
      put(`gym:${s.id}:beacon:${bid}`, local, 2.6, prompt, () => {
        const r = gyms.activateBeacon(gymId, bid);
        if (r.already) ui.toast("Los faros ya están encendidos.");
        else if (r.first === false) ui.toast(`${BEACON_LABELS[bid]} ya brillaba.`);
        saveGame();
      });
    }

    const hookOpen = isMistExitOpen();
    if (hookOpen) applyMistExitOpening(s);
    put(`gym:${s.id}:exit-hook`, layout.exitHook, 3.2,
      hookOpen ? "La barrera responde a la Insignia Bruma." : "Una antigua barrera bloquea el camino.",
      () => {
        if (isMistExitOpen()) {
          applyMistExitOpening(s);
          ui.toast("La barrera responde a la Insignia Bruma. El camino queda abierto.", "good");
          const [hx, hz] = layout.exitHook;
          const destX = s.x + hx + 0.5;
          const destZ = s.z + hz + 3.5;
          teleportPlayer(destX, world.surfaceY(destX, destZ) + 1, destZ);
          return;
        }
        ui.toast("Una antigua barrera bloquea el camino.", "bad");
      });
  }
}

function findRegionalGate(x, z) {
  if (!world) return null;
  const near = world.structures.near(x, z, 90).find((s) => s.type === "regional_gate");
  if (near) return near;
  const gym = nearestGymAnchor(x, z);
  if (!gym) return null;
  return world.structures.candidate("regional_gate", gym.cellX, gym.cellZ);
}

function applyGateOpening(gate) {
  if (!gate || !world) return;
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = 1; dy <= 5; dy++) {
      world.setBlock(gate.x + dx, gate.y + dy, gate.z, B.AIR);
    }
  }
}

function tryOpenRegionGate({ regionId = REGION_2, x, z } = {}) {
  const px = x ?? player?.pos.x ?? 0;
  const pz = z ?? player?.pos.z ?? 0;
  const opened = regions.openGate(regionId, { x: px, z: pz });
  const gate = findRegionalGate(px, pz);
  if (gate && regions.isGateOpened(regionId)) applyGateOpening(gate);
  if (opened) saveGame();
  return opened || regions.isGateOpened(regionId);
}

function canOpenRegionGate() {
  return progression.isUnlocked("region_2_path_unlocked") || progression.hasBadge("verdant_badge");
}

function registerGateInteractables(s, wanted) {
  const id = `gate:${s.id}:door`;
  wanted.add(id);
  const opened = regions.isGateOpened(REGION_2);
  if (opened) applyGateOpening(s);
  const allowed = canOpenRegionGate();
  let prompt;
  if (opened) prompt = "Cruzar el paso";
  else if (allowed) prompt = "Abrir paso";
  else prompt = "El paso está cerrado. Necesitas la Insignia Verde.";
  const existing = interaction.items.get(id);
  const x = s.x + 0.5;
  const y = s.y + 1.4;
  const z = s.z - 1.2;
  if (existing) {
    existing.prompt = prompt;
    existing.x = x;
    existing.y = y;
    existing.z = z;
    return;
  }
  interaction.register({
    id,
    type: "gate",
    x, y, z,
    range: 3.4,
    prompt,
    data: s,
    onInteract: () => {
      if (regions.isGateOpened(REGION_2)) {
        teleportPlayer(s.x + 0.5, world.surfaceY(s.x, s.z + 4) + 1, s.z + 4.5);
        return;
      }
      if (!canOpenRegionGate()) {
        ui.toast("El paso está cerrado. Necesitas la Insignia Verde.", "bad");
        return;
      }
      tryOpenRegionGate({ x: s.x, z: s.z });
    },
  });
}

function findMistSettlement(x, z) {
  if (!world) return null;
  const near = world.structures.near(x, z, 90).find((s) => s.type === "mist_settlement");
  if (near) return near;
  const gym = nearestGymAnchor(x, z);
  if (!gym) return null;
  return world.structures.candidate("mist_settlement", gym.cellX, gym.cellZ);
}

function applyAncientPathOpening(s) {
  if (!s || !world || !progression.isUnlocked("gym_2_clue_unlocked")) return;
  const [dx, dz] = MIST_SETTLEMENT_LAYOUT.ancientPath;
  for (let ox = -1; ox <= 1; ox++) {
    for (let dy = 1; dy <= 5; dy++) {
      world.setBlock(s.x + dx + ox, s.y + dy, s.z + dz, B.AIR);
    }
  }
}

function findMistGym(x, z) {
  if (!world) return null;
  const near = world.structures.near(x, z, 90).find((s) => s.type === "gym_mist");
  if (near) return near;
  const gym = nearestGymAnchor(x, z);
  if (!gym) return null;
  return world.structures.candidate("gym_mist", gym.cellX, gym.cellZ);
}

function applyMistExitOpening(s) {
  if (!s || !world || !isMistExitOpen()) return;
  const [dx, dz] = MIST_GYM_LAYOUT.exitHook;
  for (let ox = -1; ox <= 1; ox++) {
    for (let dy = 1; dy <= 5; dy++) {
      world.setBlock(s.x + dx + ox, s.y + dy, s.z + dz, B.AIR);
    }
  }
}

function registerMistInteractables(s, wanted) {
  const [wdx, wdz] = MIST_SETTLEMENT_LAYOUT.workbench;
  const benchId = `workbench:${s.id}`;
  wanted.add(benchId);
  const bx = s.x + wdx + 0.5;
  const by = s.y + 1.4;
  const bz = s.z + wdz + 0.5;
  const existingBench = interaction.items.get(benchId);
  if (existingBench) {
    existingBench.x = bx;
    existingBench.y = by;
    existingBench.z = bz;
  } else {
    interaction.register({
      id: benchId,
      type: "workbench",
      x: bx, y: by, z: bz,
      range: 3.2,
      prompt: "Usar banco de trabajo",
      data: s,
      onInteract: () => {
        if (dialogue.isOpen) return;
        crafting.show("basic_workbench");
      },
    });
  }

  const [pdx, pdz] = MIST_SETTLEMENT_LAYOUT.ancientPath;
  const pathId = `ancient_path:${s.id}`;
  wanted.add(pathId);
  const unlocked = progression.isUnlocked("gym_2_clue_unlocked");
  if (unlocked) applyAncientPathOpening(s);
  const prompt = unlocked
    ? "Cruzar hacia el Gimnasio de las Brumas"
    : "El camino está bloqueado por una energía extraña.";
  const px = s.x + pdx + 0.5;
  const py = s.y + 1.5;
  const pz = s.z + pdz - 0.6;
  const existingPath = interaction.items.get(pathId);
  if (existingPath) {
    existingPath.prompt = prompt;
    existingPath.x = px;
    existingPath.y = py;
    existingPath.z = pz;
    return;
  }
  interaction.register({
    id: pathId,
    type: "ancient_path",
    x: px, y: py, z: pz,
    range: 3.4,
    prompt,
    data: s,
    onInteract: () => {
      if (progression.isUnlocked("gym_2_clue_unlocked")) {
        applyAncientPathOpening(s);
        const [dx, dz] = MIST_SETTLEMENT_LAYOUT.ancientPath;
        const destX = s.x + dx + 0.5;
        const destZ = s.z + dz + 4.5;
        teleportPlayer(destX, world.surfaceY(destX, destZ) + 1, destZ);
        ui.toast("Cruzas el arco hacia el Gimnasio de las Brumas.", "good");
        return;
      }
      ui.toast("El camino está bloqueado por una energía extraña.", "bad");
    },
  });
}

function useCraftedItem(itemId) {
  if (!state) return;
  if (itemId === "mist_tonic") {
    const r = crafting.useTonic();
    if (!r.ok) {
      ui.toast(r.error, "bad");
      return;
    }
    sfx.heal();
    return;
  }
  if (itemId === "explorer_kit") {
    const r = crafting.useExplorerKit();
    if (!r.ok) {
      ui.toast(r.error, "bad");
      return;
    }
    ui.toast("🔦 El kit aclara la niebla durante 90 segundos.", "good");
    if (world && player) {
      const mist = findMistGym(player.pos.x, player.pos.z);
      const st = gyms.gymState("gym_mist");
      if (mist && !st.puzzleSolved && st.beacons) {
        const left = Object.entries(st.beacons)
          .filter(([, on]) => !on)
          .map(([id]) => BEACON_LABELS[id] ?? id);
        if (left.length) ui.toast(`✦ Faros por encender: ${left.join(" · ")}`, "good");
      }
      const near = world.structures.near(player.pos.x, player.pos.z, 80)
        .filter((s) => s.type !== "camp");
      if (near.length) {
        const names = near.slice(0, 4).map((s) => s.name).join(" · ");
        ui.toast(`🧭 Cerca: ${names}`, "good");
      }
    }
  }
}

function refreshGymTracker(nearGym = null) {
  if (!nearGym) {
    ui.updateGymTracker(null);
    return;
  }
  const gymId = gymIdForStructure(nearGym);
  if (!gymId || gyms.isCompleted(gymId)) {
    ui.updateGymTracker(null);
    return;
  }
  const st = gyms.gymState(gymId);
  const gym = GYMS[gymId];
  let label;
  if (gymId === "gym_mist") {
    label = st.puzzleSolved
      ? (st.leaderReady ? "Sala del líder abierta" : "Faros encendidos")
      : `Faros de bruma: ${st.beaconCount}/3`;
  } else {
    const cur = st.puzzleSolved ? 3 : st.puzzleAttempt.length;
    label = st.puzzleSolved
      ? (st.leaderReady ? "Sala del líder abierta" : "Puzzle resuelto")
      : `Pedestales activados: ${cur}/3`;
  }
  ui.updateGymTracker({ title: gym.name, label });
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
    [B.ANCIENT_FRAGMENT]: 0xb48ad8, [B.MIST_BLOOM]: 0x8fd4e4, [B.MIST_GRASS]: 0x3a6152,
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

  // Barrera lógica: sin portón abierto no se permanece en Región 2.
  if (playing && state && getRegionAt(player.pos.x, player.pos.z) === REGION_2 &&
      !regions.isGateOpened(REGION_2)) {
    const gate = findRegionalGate(player.pos.x, player.pos.z);
    if (gate) {
      const zx = gate.z - 4;
      teleportPlayer(gate.x + 0.5, world.surfaceY(gate.x, zx) + 1, zx + 0.5);
    }
  }

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

    const rid = getRegionAt(px, pz);
    if (rid !== lastRegion) {
      lastRegion = rid;
      ui.setRegion(getRegionName(rid), rid !== REGION_1);
      if (rid !== REGION_1) regions.discover(rid, px, pz);
    }

    // Descubrimiento + registro de interactuables de estructura cercanos
    const wantedShrines = new Set();
    const wantedGym = new Set();
    const wantedGate = new Set();
    const wantedMist = new Set();
    let nearGym = null;
    fogMistGym = null;
    for (const s of world.structures.near(px, pz, 24)) {
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
      if (s.type === "gym" || s.type === "gym_mist") {
        nearGym = s;
        registerGymInteractables(s, wantedGym);
        if (s.type === "gym_mist") fogMistGym = s;
      }
      if (s.type === "regional_gate") {
        registerGateInteractables(s, wantedGate);
      }
      if (s.type === "mist_settlement") {
        registerMistInteractables(s, wantedMist);
      }
    }
    for (const id of interaction.ids("shrine")) {
      if (!wantedShrines.has(id)) interaction.unregister(id);
    }
    for (const id of interaction.ids("gym")) {
      if (!wantedGym.has(id)) interaction.unregister(id);
    }
    for (const id of interaction.ids("gate")) {
      if (!wantedGate.has(id)) interaction.unregister(id);
    }
    for (const id of interaction.ids("workbench")) {
      if (!wantedMist.has(id)) interaction.unregister(id);
    }
    for (const id of interaction.ids("ancient_path")) {
      if (!wantedMist.has(id)) interaction.unregister(id);
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
  } else if (fogMistGym && isInsideMistGym(fogMistGym, camera.position.x, camera.position.z)) {
    const beacons = gyms.gymState("gym_mist").beaconCount ?? 0;
    const kit = crafting.explorerActive();
    scene.fog.near = kit ? 16 : 8;
    scene.fog.far = 22 + 22 * beacons + (kit ? 28 : 0);
    scene.fog.color.lerp(new THREE.Color(0x6a7a88), 0.55);
  } else if (getRegionAt(camera.position.x, camera.position.z) === REGION_2) {
    if (crafting.explorerActive()) {
      scene.fog.near = 28;
      scene.fog.far = 130;
      scene.fog.color.lerp(new THREE.Color(0x8aa090), 0.25);
    } else {
      scene.fog.near = 14;
      scene.fog.far = 82;
      scene.fog.color.lerp(new THREE.Color(0x6a8074), 0.45);
    }
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
  regionSystem: regions,
  craftingSystem: crafting,
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
    /** Coordenadas y estado del Gimnasio de las Brumas (Fase 8) */
    gym2() {
      if (!world || !player) return null;
      return findMistGym(player.pos.x, player.pos.z);
    },
    gym2State() {
      const s = this.gym2();
      const st = gyms.gymState("gym_mist");
      return {
        structure: s ? { id: s.id, x: s.x, y: s.y, z: s.z, biome: s.biome } : null,
        ...st,
        badge: progression.hasBadge("mist_badge"),
        clue: progression.isUnlocked("gym_2_clue_unlocked"),
        nextRegion: progression.isUnlocked("region_3_path_unlocked"),
        kit: crafting.explorerActive(),
        trainers: {
          nox: trainers.isDefeated("gym_trainer_mist_1"),
          lumen: trainers.isDefeated("gym_trainer_mist_2"),
          nyra: trainers.isDefeated("leader_nyra"),
        },
      };
    },
    gotoGym2() {
      const s = this.gym2();
      if (!s || !player || !world) return null;
      player.pos.set(s.x + 0.5, s.y + 2, s.z - 12.5);
      player.vel.set(0, 0, 0);
      return s;
    },
    /** [debug] resetea el puzzle del gimnasio (solo desarrollo) */
    resetGymPuzzle(id) { gyms.resetPuzzle(id); },
    fog() {
      return scene?.fog ? { near: scene.fog.near, far: scene.fog.far } : null;
    },
    badges() {
      return state ? { ...state.progression.badges } : {};
    },
    region() {
      if (!world || !player) return null;
      const x = player.pos.x;
      const z = player.pos.z;
      const id = getRegionAt(x, z);
      return {
        id,
        name: getRegionName(id),
        biome: world.biomeAt(x, z),
        baseBiome: world.baseBiomeAt(x, z),
        discovered: { ...(state?.regions.discovered ?? {}) },
        gates: JSON.parse(JSON.stringify(state?.regions.gates ?? {})),
      };
    },
    regionGate() {
      if (!world || !player) return null;
      const gate = findRegionalGate(player.pos.x, player.pos.z);
      return {
        opened: regions.isGateOpened(REGION_2),
        unlocked: canOpenRegionGate(),
        gate,
      };
    },
    regionalStructures(r = 400) {
      if (!world || !player) return [];
      return world.structures.near(player.pos.x, player.pos.z, r)
        .filter((s) => s.type === "regional_gate" || s.type === "watchtower" ||
          s.type === "ancient_outpost" || s.type === "mist_settlement" || s.type === "gym_mist");
    },
    mistSettlement() {
      if (!world || !player) return null;
      const s = findMistSettlement(player.pos.x, player.pos.z);
      const [wdx, wdz] = MIST_SETTLEMENT_LAYOUT.workbench;
      const [pdx, pdz] = MIST_SETTLEMENT_LAYOUT.ancientPath;
      return {
        settlement: s,
        npcs: npcs.list().filter((n) => n.role === "craftsman" || n.role === "herbalist" || n.role === "regional_guide"),
        workbench: s ? { x: s.x + wdx, y: s.y + 1, z: s.z + wdz } : null,
        ancientPath: s ? { x: s.x + pdx, y: s.y + 1, z: s.z + pdz } : null,
        clueUnlocked: progression.isUnlocked("gym_2_clue_unlocked"),
        pathBlock: s ? world.getBlock(s.x + pdx, s.y + 2, s.z + pdz) : null,
      };
    },
    crafting() {
      if (!state) return null;
      return {
        recipes: Object.values(RECIPES).map((r) => ({
          id: r.id,
          name: r.name,
          unlocked: crafting.isUnlocked(r),
          can: crafting.canCraft(r.id),
          inputs: r.inputs.map((c) => ({ itemId: c.itemId, need: c.amount, have: getItemCount(state, c.itemId) })),
          outputs: r.outputs,
        })),
        unlocks: {
          basic_crafting_unlocked: progression.isUnlocked("basic_crafting_unlocked"),
          mist_crafting_unlocked: progression.isUnlocked("mist_crafting_unlocked"),
          ancient_core_recipe_unlocked: progression.isUnlocked("ancient_core_recipe_unlocked"),
          gym_2_clue_unlocked: progression.isUnlocked("gym_2_clue_unlocked"),
        },
        items: {
          balls: state.balls,
          mist_tonic: getItemCount(state, "mist_tonic"),
          explorer_kit: getItemCount(state, "explorer_kit"),
          ancient_core: getItemCount(state, "ancient_core"),
        },
        buffs: { ...(state.buffs ?? {}) },
        open: crafting.open,
      };
    },
    giveCraftMats() {
      if (!state) return null;
      grantItems(state, [
        { itemId: "apricorn", amount: 12 },
        { itemId: "copper", amount: 4 },
        { itemId: "mist_bloom", amount: 4 },
        { itemId: "medicinal_herb", amount: 4 },
        { itemId: "coal", amount: 6 },
        { itemId: "iron", amount: 3 },
        { itemId: "ancient_fragment", amount: 3 },
        { itemId: "crystal_shard", amount: 3 },
      ]);
      ui.refreshHud();
      if (crafting.open) crafting.render();
      return this.crafting();
    },
    craft(id) {
      const r = crafting.craft(id);
      if (crafting.open) crafting.render();
      ui.refreshHud();
      return r;
    },
    useItem(id) {
      useCraftedItem(id);
      return this.crafting();
    },
    unlockCrafting() {
      progression.unlock("basic_crafting_unlocked");
      progression.unlock("ancient_core_recipe_unlocked");
    },
    gotoMist() {
      const s = this.mistSettlement()?.settlement;
      if (!s || !player || !world) return null;
      player.pos.set(s.x + 0.5, s.y + 2, s.z + 0.5);
      player.vel.set(0, 0, 0);
      return s;
    },
    unlockRegion2() {
      progression.addBadge("verdant_badge");
      progression.unlock("region_2_path_unlocked");
      progression.unlock("first_gym_completed");
    },
    unlockGym2Clue() {
      this.unlockRegion2();
      progression.unlock("gym_2_clue_unlocked");
    },
    openGate() {
      return tryOpenRegionGate({
        x: player?.pos.x ?? 0,
        z: player?.pos.z ?? 0,
      });
    },
    measureChunkGen(cx, cz) {
      if (!world) return null;
      const t0 = performance.now();
      world.generateChunkData(cx, cz);
      return { ms: performance.now() - t0, lastGenMs: world.lastGenMs, cx, cz };
    },
  },
};
