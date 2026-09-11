/**
 * VoxelMon — mundo vóxel estilo Minecraft con captura y combate de criaturas.
 * Módulo principal: escena, bucle de juego, entrada, día/noche, batallas y guardado.
 */

import * as THREE from "three";
import { World, B, BLOCK_DROPS, BIOME_NAMES, WATER_Y } from "./world.js";
import { getBiomeName, getBiomeDefinition } from "./biomes.js";
import { RESOURCES, resourceForBlock } from "./resources.js";
import { STRUCTURE_TYPES, MIST_SETTLEMENT_LAYOUT, CRIMSON_RUIN_LAYOUT, STORM_OBSERVATORY_LAYOUT, TEMPEST_SPIRE_LAYOUT, HIGHLAND_EXIT_LAYOUT, SETTLEMENT_LAYOUT, CLIFF_OUTPOST_LAYOUT, AZURE_PORT_LAYOUT, AZURE_LIGHTHOUSE_LAYOUT, REEF_ATOLL_LAYOUT, OPEN_SEA_GATE_LAYOUT } from "./structures.js";
import { buildCreatureVisual, disposeCreatureVisual, preloadCreatureArt, creatureArtDebugSnapshot, textureCacheSize, inspectTextureCache, animateCreatureVisual, simulatePngLoadFailure, inspectGeometryCache, inspectMaterialCache, resolveCreatureRenderer, creatureArtIcon } from "./creature-renderer.js";
import { setPreferredRenderer, getPreferredRenderer, listPixelSpecies, getCreatureArt, listArtSpecies } from "./creature-art.js";
import { bosses, BOSSES, STORM_SEAL_ID, REEF_SEAL_ID } from "./bosses.js";
import { Player } from "./player.js";
import { Spawner, WildCreature } from "./creatures.js";
import { Battle, TrainerOpponent } from "./battle.js";
import { TRAINERS, trainers } from "./trainers.js";
import { GYMS, GYM_LAYOUT, MIST_GYM_LAYOUT, FORGE_GYM_LAYOUT, GALE_GYM_LAYOUT, TIDE_GYM_LAYOUT, SWITCH_LABELS, BEACON_LABELS, CONDUIT_LABELS, CHANNEL_LABELS, TIDE_BASIN_LABELS, TIDE_LEVEL_NAMES, gyms, gymIdForStructure } from "./gyms.js";
import { UI } from "./ui.js";
import { FAMILY_STARTERS, PERKS, SPECIES, TYPES, activePerks, familyOf, createMonster, gainXp } from "./data.js?v=15";
import { sfx, toggleMute } from "./audio.js";
import { events } from "./events.js";
import {
  SAVE_KEY, defaultState, loadSave, persistSave, hasPersistedSave,
  hasRecoverableBackup, snapshotSaveToBackup, restoreBackupSave,
} from "./state.js";
import { progression } from "./progression.js";
import { stats } from "./stats.js";
import { interaction } from "./interaction.js";
import { npcs } from "./npcs.js";
import { dialogue, DIALOGUES } from "./dialogue.js";
import { quests, QUESTS } from "./quests.js";
import { executeTrade } from "./trading.js";
import { crafting, RECIPES } from "./crafting.js";
import { getItemCount, grantItems } from "./items.js";
import { inventory } from "./inventory.js";
import { creatureStorage, PARTY_MAX } from "./pc.js";
import { dex } from "./dex.js";
import { economy, bindShopTabs, HEAL_COST, PRICE_CATALOG } from "./economy.js";
import {
  regions, getRegionAt, getRegionName, region3BoundsFor, region4BoundsFor, region5BoundsFor,
  REGION_1, REGION_2, REGION_3, REGION_4, REGION_5, REGION_GEOMETRY,
} from "./regions.js";
import { worldMap } from "./map.js";
import { traversal } from "./traversal.js";
import { buildAssist, AERIAL_UNLOCK } from "./build-assist.js";
import { pickups } from "./pickups.js";
import { ROUTE_SIGNS, routeSnapshot } from "./routes.js";

const DAY_LENGTH = 600; // segundos por ciclo completo
const HOTBAR = [B.DIRT, B.STONE, B.SAND, B.WOOD, B.LEAVES, B.SNOW];

// ---------- Escena ----------

const canvas = document.getElementById("game-canvas");
function createRenderer() {
  try {
    return new THREE.WebGLRenderer({ canvas, antialias: true, failIfMajorPerformanceCaveat: false });
  } catch (err) {
    console.error(err);
    try {
      return new THREE.WebGLRenderer({ canvas, antialias: false, failIfMajorPerformanceCaveat: false });
    } catch (err2) {
      console.error(err2);
      return null;
    }
  }
}
const renderer = createRenderer();
if (renderer) {
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
}

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
  if (renderer) renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------- Estado ----------

const ui = new UI();
try { preloadCreatureArt(); } catch (err) { console.warn("preloadCreatureArt", err); }
let world = null;
let player = null;
let spawner = null;
let battle = null;
let state = null;

let mode = "title"; // title | starter | play | battle | pause | dex | dialogue | crafting | victory
let locked = false;
let perks = activePerks({});
let fogMistGym = null;
let stormFlashT = 0;

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
  if (structureType === "azure_port" || structureType === "tidal_ruins" || structureType === "azure_lighthouse") {
    showLocationBanner(def?.name ?? structureType);
  }
});
events.on("partyHealed", ({ source }) => {
  ui.toast(source === "healing_shrine"
    ? "✨ El santuario restaura por completo a tu equipo."
    : "💚 Tu equipo está como nuevo.", "good");
});
events.on("itemPickedUp", ({ itemId, amount }) => {
  if (itemId === "coins") {
    ui.toast(`⌾ +${amount} monedas`, "good");
    return;
  }
  if (RESOURCES[itemId]) return;
  const total = inventory.count(itemId);
  ui.toast(`+${amount} (${total})`, "good");
});
events.on("regionDiscovered", ({ regionId, regionName }) => {
  if (regionId === REGION_5) showLocationBanner(regionName);
});
events.on("resourceCollected", ({ resourceId, amount }) => {
  const res = RESOURCES[resourceId];
  if (!res) return;
  const total = inventory.count(resourceId);
  ui.toast(`${res.icon} +${amount} ${res.name} (${total})`, "good");
});
events.on("badgeEarned", ({ id }) => {
  if (id === "verdant_badge") ui.toast("🏅 Has conseguido la Insignia Verde", "legendary");
  else if (id === "mist_badge") {
    ui.toast("🏅 Has conseguido la Insignia Bruma", "legendary");
    const s = findMistGym(player?.pos.x ?? 0, player?.pos.z ?? 0);
    if (s) applyMistExitOpening(s);
  } else if (id === "gale_badge") ui.toast("🏅 Has conseguido la Insignia Vendaval", "legendary");
  else if (id === "tide_badge") {
    ui.toast("🏅 Has conseguido la Insignia Marea", "legendary");
    const gate = findAzure("open_sea_gate", player?.pos.x ?? 0, player?.pos.z ?? 0);
    if (gate) applyOpenSeaGateOpening(gate);
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
events.on("flagSet", ({ id }) => {
  if (id === "lighthouse_signal") {
    ui.toast("🗼 El haz señala un atolón al este. Una corriente despierta.", "legendary");
    const lh = findAzure("azure_lighthouse", player?.pos.x ?? 0, player?.pos.z ?? 0);
    if (lh) applyLighthouseBeam(lh);
  }
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
  }
  if (id === "gym_3_clue_unlocked") {
    progression.unlock("crimson_resonator_recipe_unlocked");
    ui.toast("♦️ El sello mineral de las cumbres comienza a resonar.", "legendary");
    const ruin = findCrimsonRuin(player?.pos.x ?? 0, player?.pos.z ?? 0);
    if (ruin) applyCrimsonSeal(ruin);
  }
  if (id === "crimson_resonator_recipe_unlocked") {
    ui.toast("🔶 Bren te describe cómo forjar el resonador carmesí.", "good");
  }
  if (id === "gym_3_path_unlocked") {
    ui.toast("🔥 El sello se abre. Un camino mineral baja hacia la forja.", "legendary");
    const ruin = findCrimsonRuin(player?.pos.x ?? 0, player?.pos.z ?? 0);
    if (ruin) applyGym3PathOpening(ruin);
  }
  if (id === "region_4_path_unlocked") {
    ui.toast("🌄 La Insignia Forja activa el mecanismo del Paso Carmesí. Pulsa E para abrirlo.", "legendary");
  }
  if (id === "gym_4_clue_unlocked") {
    ui.toast("🔭 Los cristales del observatorio responden al vendaval.", "legendary");
    const obs = findStormObservatory(player?.pos.x ?? 0, player?.pos.z ?? 0);
    if (obs) applyStormSeal(obs);
  }
  if (id === "gym_4_path_unlocked") {
    ui.toast("🌬 El pináculo abre una corriente hacia el Gimnasio del Vendaval.", "legendary");
    const gym4 = findGaleGym(player?.pos.x ?? 0, player?.pos.z ?? 0);
    if (gym4) applyGaleGymOpening(gym4);
  }
  if (id === "region_5_path_unlocked") {
    ui.toast("🌄 La Insignia Vendaval abre el Arco de las alturas. El mar espera al sur.", "legendary");
    const hook = findHighlandExit(player?.pos.x ?? 0, player?.pos.z ?? 0);
    if (hook) applyHighlandExitOpening(hook);
  }
  if (id === "gym_5_clue_unlocked") {
    ui.toast("🗼 La lente del faro apunta más allá del horizonte.", "legendary");
    const lh = findAzure("azure_lighthouse", player?.pos.x ?? 0, player?.pos.z ?? 0);
    if (lh) applyLighthouseBeam(lh);
  }
  if (id === "gym_5_path_unlocked") {
    ui.toast("🌊 El guardián cede. Un puente de marea abre el gimnasio.", "legendary");
    const br = findAzure("tidal_bridge", player?.pos.x ?? 0, player?.pos.z ?? 0);
    if (br) applyTidalBridgeOpening(br);
    const g5 = findAzure("gym_tide", player?.pos.x ?? 0, player?.pos.z ?? 0);
    if (g5) applyTideGymOpening(g5);
  }
  if (id === "region_6_path_unlocked") {
    ui.toast("↕ El Arco del mar abierto responde. El horizonte continúa.", "legendary");
    const gate = findAzure("open_sea_gate", player?.pos.x ?? 0, player?.pos.z ?? 0);
    if (gate) applyOpenSeaGateOpening(gate);
  }
  if (id === AERIAL_UNLOCK) {
    ui.toast("🪶 Asistencia aérea de construcción desbloqueada. Pulsa B y luego Espacio.", "good");
  }
});
events.on("gymPuzzleProgress", ({ gymId, current, required, reset, recovered }) => {
  if (gymId === "gym_mist") ui.toast(`🌫 Faros de bruma: ${current}/${required}`);
  else if (gymId === "gym_crimson") {
    ui.toast(recovered ? "🔥 Energía recuperada al reservorio." : `🔥 Energía del núcleo: ${current}/${required}`);
  } else if (gymId === "gym_gale") ui.toast(`🌬 Canales de viento: ${current}/${required}`);
  else if (gymId === "gym_tide") ui.toast(`🌊 Niveles de marea: ${current}/${required}`);
  else if (reset) ui.toast("↺ Secuencia incorrecta. Los pedestales se reinician.", "bad");
  else ui.toast(`🌿 Pedestales activados: ${current}/${required}`);
  refreshGymTracker();
});
events.on("gymPuzzleSolved", ({ gymId }) => {
  if (gymId === "gym_mist") ui.toast("🌫 Los tres faros están encendidos.", "good");
  else if (gymId === "gym_crimson") ui.toast("🔥 El núcleo de forja está cargado.", "good");
  else if (gymId === "gym_gale") ui.toast("🌬 Los tres canales fluyen hacia la terraza.", "good");
  else if (gymId === "gym_tide") ui.toast("🌊 Las tres cuencas forman una ruta hasta Talassa.", "good");
  else ui.toast("🌿 ¡Puzzle resuelto! La puerta del líder puede abrirse.", "good");
  maybeLeaderRoomToast(gymId ?? "gym_verdant");
  refreshGymTracker();
});
events.on("gymEntered", ({ gymId }) => {
  if (gymId === "gym_mist") ui.toast("🌫 Gimnasio de las Brumas", "good");
  else if (gymId === "gym_crimson") ui.toast("🔥 Gimnasio de la Forja", "good");
  else if (gymId === "gym_gale") ui.toast("🌬 Gimnasio del Vendaval", "good");
  else if (gymId === "gym_tide") ui.toast("🌊 Gimnasio de las Mareas", "good");
  else ui.toast("🌿 Gimnasio Verde", "good");
});
events.on("bossDefeated", ({ bossId }) => {
  if (bossId === "crimson_guardian") ui.toast("⚠ El Guardián Carmesí se desmorona. El camino al sur se abre.", "legendary");
  if (bossId === "tempest_guardian") ui.toast("⚠ El Guardián del Vendaval se disipa. Las corrientes abren el gimnasio.", "legendary");
  if (bossId === "reef_guardian") ui.toast("⚠ El Guardián del Arrecife se retira. El puente de marea responde.", "legendary");
});
events.on("trainerDefeated", ({ gymId }) => {
  if (gymId) maybeLeaderRoomToast(gymId);
});
events.on("regionDiscovered", ({ regionName }) => {
  ui.toast(`🌄 Nueva región descubierta: ${regionName}`, "good");
});
events.on("regionGateOpened", ({ regionId }) => {
  if (regionId === REGION_4) ui.toast("🚪 El Paso Carmesí se ha abierto. Los Altos del Vendaval esperan.", "good");
  else if (regionId === REGION_3) ui.toast("🚪 El camino hacia las Cumbres Carmesí se ha abierto.", "good");
  else ui.toast("🚪 El paso fronterizo se ha abierto.", "good");
});
events.on("itemPurchased", ({ itemId, total }) => {
  ui.toast(`💱 Comprado: ${itemId === "balls" ? "cubo" : itemId} (−${total} ⌾)`, "good");
  ui.refreshHud();
  if (economy.open) economy.render();
});
events.on("itemSold", ({ itemId, total }) => {
  ui.toast(`💱 Vendido: ${itemId} (+${total} ⌾)`, "good");
  ui.refreshHud();
  if (economy.open) economy.render();
});
events.on("partyHealed", ({ source, cost }) => {
  if (source === "field_medic") ui.toast(`✚ Ysol cura al equipo (−${cost ?? HEAL_COST} ⌾).`, "good");
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
  if (mode === "inventory") ui.renderInventory();
});
events.on("inventoryChanged", () => {
  if (!state) return;
  ui.refreshHud();
  ui.refreshHotbar(HOTBAR, state.inventory, selectedSlot);
  if (mode === "inventory") ui.renderInventory();
  if (crafting.open) crafting.render();
  if (economy.open) economy.render();
});
events.on("speciesCaught", () => {
  ui.refreshHud();
  if (mode === "dex") ui.renderDex();
});
events.on("speciesSeen", () => {
  ui.refreshHud();
  if (mode === "dex") ui.renderDex();
});

// ---------- Diálogos: acciones controladas, condiciones y modo de juego ----------

trainers.setRewardHandler((money) => addMoney(money));

quests.setRewardHandler((rewards) => {
  if (rewards.money) addMoney(rewards.money);
  if (rewards.balls) inventory.add("balls", rewards.balls, "quest");
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
  ui.toast(`▣ +${r.trade.gives.balls} cubo (tienes ${inventory.count("balls")})`, "good");
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
dialogue.registerAction("openShop", (a) => {
  setTimeout(() => economy.show(a.title ?? "Puesto"), 80);
});
dialogue.registerAction("paidHeal", () => {
  const r = economy.healParty();
  if (!r.ok) {
    ui.toast(r.error, "bad");
    return false;
  }
  sfx.heal();
  ui.refreshHud();
  saveGame();
});
dialogue.registerAction("startTrainerBattle", (a, ctx) => {
  if (buildAssist.blocksCombat()) {
    ui.toast("Sal del modo construcción para combatir.", "bad");
    return false;
  }
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

economy.onOpen = () => {
  if (mode !== "play") return;
  mode = "shop";
  document.exitPointerLock();
  ui.setTargetPrompt(null);
  highlight.visible = false;
  keys.clear();
};
economy.onClose = () => {
  if (mode !== "shop") return;
  mode = "play";
  canvas.requestPointerLock();
  saveGame();
};
economy.onError = (msg) => ui.toast(msg, "bad");
bindShopTabs();

function saveGame() {
  if (!state || !player) return;
  state.edits = world.edits;
  state.dayTime = dayTime;
  state.pos = { x: player.pos.x, y: player.pos.y, z: player.pos.z, yaw: player.yaw, pitch: player.pitch };
  persistSave(state);
}

// ---------- Arranque de mundo ----------

function abortBoot(message) {
  console.error(message);
  ui.hideLoading();
  ui.hide(ui.el.hud);
  ui.hide(ui.el.starter);
  if (world || player) {
    // Mundo a medias: recargar es más seguro que reutilizar chunks a medias.
    location.reload();
    return;
  }
  mode = "title";
  ui.setTitleError(message || "No se pudo arrancar el mundo. Tu partida sigue guardada.");
  ui.showTitle(hasPersistedSave(), hasRecoverableBackup());
}

async function startWorld(saved) {
  if (!renderer) {
    abortBoot("Este navegador no pudo iniciar el gráfico 3D. Cierra otras pestañas de VoxelMon y recarga.");
    return;
  }
  ui.showLoading("Generando el mundo vóxel…");
  ui.setTitleError("");
  try {
    await bootWorld(saved);
    persistSave(state);
  } catch (err) {
    abortBoot(err?.message ? `No se pudo arrancar el mundo: ${err.message}` : "No se pudo arrancar el mundo. Tu partida sigue guardada.");
  }
}

async function bootWorld(saved) {
  await nextFrame();

  state = saved ?? state;
  ui.state = state;
  dayTime = state.dayTime ?? 0.3;

  world = new World(scene, state.seed, state.edits);
  const px = state.pos?.x ?? 8.5;
  const pz = state.pos?.z ?? 8.5;
  regions.attach(state);
  // El corredor R2–R4 se ancla al gym de origen ANTES de generar chunks.
  regions.ensureHome(8.5, 8.5);

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
  economy.attach(state);
  crafting.attach(state);
  inventory.attach(state);
  creatureStorage.attach(state);
  dex.attach(state);
  ui.bindMgmtUi();
  interaction.clear();
  npcs.init(scene, world, interaction);
  trainers.attach(state);
  gyms.attach(state);
  gyms.setProgression(progression);
  bosses.attach(state);
  bosses.setRewardHandler((money) => addMoney(money));
  quests.attach(state);
  worldMap.attach(state, world);
  pickups.attach(state, world);
  traversal.attach(world);
  buildAssist.attach(state);
  buildAssist.onToast = (msg, cls) => ui.toast(msg, cls);
  const mapCanvas = document.getElementById("map-canvas");
  if (mapCanvas) worldMap.bindCanvas(mapCanvas);
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
  worldMap.pollPlayer(player);
  traversal.sync(player.pos.x, player.pos.z);

  ui.buildHotbar(HOTBAR);
  ui.refreshHotbar(HOTBAR, state.inventory, selectedSlot);
  ui.refreshHud();
  ui.hideLoading();
  ui.show(ui.el.hud);
  ui.updateQuestTracker(quests.trackerInfo());
  bindBattleEvolve();
  mode = "play";
  ui.setTargetPrompt("Haz clic para tomar el control");
}

function beginNewGame() {
  snapshotSaveToBackup();
  sfx.select();
  const seed = (Math.random() * 0xffffffff) >>> 0;
  state = defaultState(seed);
  ui.state = state;
  ui.hide(ui.el.title);
  try {
    ui.showStarters(["emberin", "gotita", "semilla"], (id) => {
      try {
        const starter = createMonster(id, 3);
        state.team.push(starter);
        state.dex.caught[id] = true;
        state.dex.seen[id] = true;
        startWorld(state);
      } catch (err) {
        abortBoot(err?.message || "No se pudo crear el inicial.");
      }
    });
  } catch (err) {
    abortBoot(err?.message || "No se pudo mostrar la elección de inicial.");
  }
}

// ---------- Entrada ----------

document.addEventListener("keydown", (e) => {
  if (e.code === "Tab") {
    e.preventDefault();
    if (mode === "inventory" || mode === "pc") return;
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
  if (mode === "map") {
    if (e.code === "Escape" || e.code === "KeyM") {
      e.preventDefault();
      toggleMap();
    }
    return;
  }
  if (mode === "shop") {
    if (e.code === "Escape" || e.code === "KeyE") economy.close();
    return;
  }
  if (mode === "inventory") {
    if (e.code === "Escape" || e.code === "KeyI") toggleInventory();
    return;
  }
  if (mode === "pc") {
    if (e.code === "Escape" || e.code === "KeyE") closePc();
    return;
  }
  if (mode === "dex") {
    if (e.code === "Escape" || e.code === "KeyK") toggleDex();
    return;
  }
  if (mode !== "play") return;
  if (e.code === "KeyM") {
    e.preventDefault();
    toggleMap();
    return;
  }
  if (e.code === "KeyI") {
    e.preventDefault();
    toggleInventory();
    return;
  }
  if (e.code === "KeyK") {
    e.preventDefault();
    toggleDex();
    return;
  }
  if (e.code === "KeyB") {
    const on = buildAssist.toggleMode();
    ui.setBuildHud({
      mode: on,
      hovering: buildAssist.hovering,
      unlocked: buildAssist.isUnlocked(),
    });
    ui.toast(on ? "MODO CONSTRUCCIÓN" : "Modo construcción desactivado");
    if (!on) keys.delete("Space");
    return;
  }
  keys.add(e.code);
  if (e.code === "KeyE") {
    const it = interaction.current(player.pos);
    if (it && buildAssist.blocksInteraction(it)) {
      ui.toast("Sal del modo aéreo para interactuar.", "bad");
      return;
    }
    if (interaction.interact(player.pos)) return;
    if (buildAssist.blocksCombat()) return;
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
  if (buildAssist.blocksCombat()) {
    const blockHit = world.raycast(player.eyePos(), player.lookDir(), 6);
    if (blockHit) mineBlockAt(blockHit.x, blockHit.y, blockHit.z);
    return;
  }
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
  if (world.structures?.protectedAt?.(x, z)) {
    ui.toast("La estructura está protegida.");
    return;
  }
  world.setBlock(x, y, z, B.AIR);
  sfx.break();
  spawnBreakParticles(x, y, z, block);
  const drop = BLOCK_DROPS[block];
  const biomeId = world.biomeAt(x, z);
  let amount = 0;
  if (drop) {
    const bonus = Math.random() < perks.doubleDrop ? 1 : 0;
    amount = 1 + bonus;
    inventory.addMined(drop, amount, biomeId);
    if (bonus) ui.toast("🪨 ¡Manos de roca: bloque doble!");
    ui.refreshHotbar(HOTBAR, state.inventory, selectedSlot);
  }
  events.emit("blockMined", { x, y, z, block, drop });
  // Evento específico de recurso: los sistemas futuros (misiones, crafting)
  // escuchan la identidad del recurso sin conocer ids de bloque.
  const res = resourceForBlock(block);
  if (res && amount > 0) {
    const resourceId = (block === B.HERB && biomeId === "wind_highlands") ? "sky_herb" : res.id;
    events.emit("resourceCollected", {
      resourceId,
      amount,
      source: "mining",
      biomeId,
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
  return { x: s.x + local[0] + 0.5, y: s.y + 1.2 + (local[2] ?? 0), z: s.z + local[1] + 0.5 };
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

function isRegion3GateOpened() {
  return regions.isGateOpened(REGION_3);
}

function localStormAt(x, z) {
  if (!world) return false;
  return world.structures.near(x, z, 36).some((s) => {
    if (s.type === "tempest_spire" || s.type === "gym_gale") return true;
    return s.type === "storm_observatory" && bosses.isSealActivated(STORM_SEAL_ID);
  });
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
    : gymId === "gym_crimson"
      ? "La puerta está sellada. El guardián de la ruina debe caer primero."
      : gymId === "gym_gale"
        ? "La puerta está sellada. El guardián del pináculo debe caer primero."
        : gymId === "gym_tide"
          ? "La puerta está sellada. El guardián del arrecife debe caer primero."
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

    const hookOpen = isRegion3GateOpened();
    if (hookOpen) applyMistExitOpening(s);
    let hookPrompt;
    if (hookOpen) hookPrompt = "Cruzar hacia las Cumbres Carmesí";
    else if (isMistExitOpen()) hookPrompt = "Abrir camino";
    else hookPrompt = "Una antigua barrera bloquea el camino.";
    put(`gym:${s.id}:exit-hook`, layout.exitHook, 3.2, hookPrompt,
      () => {
        if (!isMistExitOpen()) {
          ui.toast("Una antigua barrera bloquea el camino.", "bad");
          return;
        }
        if (!isRegion3GateOpened()) {
          tryOpenRegion3Gate({ x: s.x, z: s.z });
        } else {
          applyMistExitOpening(s);
        }
        const [hx, hz] = layout.exitHook;
        const destX = s.x + hx + 0.5;
        const destZ = s.z + hz + 18;
        teleportPlayer(destX, world.surfaceY(destX, destZ) + 1, destZ);
      });
  }

  if (gym.puzzle?.type === "forge_energy" && layout.conduits) {
    applyForgeEnergyVisuals(s);
    const st = gyms.gymState(gymId);
    for (const [cid, local] of Object.entries(layout.conduits)) {
      const assigned = st.energy?.[cid] ?? 0;
      const cap = cid === "core" ? 2 : 1;
      const pool = st.energy?.pool ?? 0;
      const label = CONDUIT_LABELS[cid] ?? cid;
      const prompt = (assigned < cap && pool > 0)
        ? `${label} (${assigned}/${cap}) — Asignar energía`
        : assigned > 0
          ? `${label} (${assigned}/${cap}) — Recuperar energía`
          : `${label} (0/${cap}) — Sin energía en el reservorio`;
      put(`gym:${s.id}:conduit:${cid}`, local, 2.6, prompt, () => {
        const en = gyms.gymState(gymId).energy ?? { west: 0, east: 0, core: 0, pool: 3 };
        const cur = en[cid] ?? 0;
        const capNow = cid === "core" ? 2 : 1;
        const r = (cur < capNow && en.pool > 0)
          ? gyms.assignEnergy(gymId, cid)
          : gyms.recoverEnergy(gymId, cid);
        if (!r.ok && r.error) ui.toast(r.error, "bad");
        applyForgeEnergyVisuals(s);
        saveGame();
      });
    }

    const westOpen = gyms.conduitOpen(gymId, "west") || trainers.isDefeated("gym_trainer_forge_1");
    put(`gym:${s.id}:west-door`, layout.westDoor, 2.6,
      westOpen ? "Entrar al ala oeste" : "El conducto oeste no tiene energía.",
      () => {
        if (!gyms.conduitOpen(gymId, "west") && !trainers.isDefeated("gym_trainer_forge_1")) {
          ui.toast("El conducto oeste no tiene energía.", "bad");
          return;
        }
        teleportPlayer(s.x - 5 + 0.5, s.y + 1.2, s.z + 2 + 0.5);
      });

    const eastOpen = gyms.conduitOpen(gymId, "east") || trainers.isDefeated("gym_trainer_forge_2");
    put(`gym:${s.id}:east-door`, layout.eastDoor, 2.6,
      eastOpen ? "Entrar al ala este" : "El conducto este no tiene energía.",
      () => {
        if (!gyms.conduitOpen(gymId, "east") && !trainers.isDefeated("gym_trainer_forge_2")) {
          ui.toast("El conducto este no tiene energía.", "bad");
          return;
        }
        teleportPlayer(s.x + 5 + 0.5, s.y + 1.2, s.z + 4 + 0.5);
      });

    const passOpen = isCrimsonPassOpen();
    if (passOpen) applyCrimsonPassOpening(s);
    let passPrompt;
    if (passOpen) passPrompt = "Cruzar el Paso Carmesí";
    else if (canOpenRegion4Gate()) passPrompt = "Abrir el Paso Carmesí";
    else passPrompt = "El paso está bloqueado.";
    put(`gym:${s.id}:pass-hook`, layout.passHook, 3.2, passPrompt,
      () => {
        if (isCrimsonPassOpen()) {
          const destZ = s.z + REGION_GEOMETRY.r4EntranceDz;
          const destX = s.x + 0.5;
          teleportPlayer(destX, world.surfaceY(destX, destZ) + 1, destZ);
          return;
        }
        if (!canOpenRegion4Gate()) {
          ui.toast("El paso está bloqueado.", "bad");
          return;
        }
        tryOpenRegion4Gate({ x: s.x, z: s.z });
        const destZ = s.z + REGION_GEOMETRY.r4EntranceDz;
        const destX = s.x + 0.5;
        teleportPlayer(destX, world.surfaceY(destX, destZ) + 1, destZ);
      });
  }

  if (gym.puzzle?.type === "wind_channels" && layout.channels) {
    applyGaleGymOpening(s);
    applyGaleLeaderOpening(s);
    applyGaleChannelVisuals(s);
    const st = gyms.gymState(gymId);
    for (const [cid, local] of Object.entries(layout.channels)) {
      const on = !!st.channels?.[cid];
      const label = CHANNEL_LABELS[cid] ?? cid;
      const prompt = on ? `${label} (activo)` : `${label} — Alinear corriente`;
      put(`gym:${s.id}:channel:${cid}`, local, 2.6, prompt, () => {
        const r = gyms.activateChannel(gymId, cid);
        if (r.already) ui.toast("Los canales ya fluyen hacia la terraza.");
        else if (r.first === false) ui.toast(`${label} ya fluía.`);
        applyGaleChannelVisuals(s);
        applyGaleLeaderOpening(s);
        saveGame();
      });
    }
  }

  if (gym.puzzle?.type === "tidal_levels" && layout.controls) {
    applyTideGymOpening(s);
    applyTideLeaderOpening(s);
    applyTideBasinVisuals(s);
    const st = gyms.gymState(gymId);
    for (const [bid, local] of Object.entries(layout.controls)) {
      const lv = st.tides?.[bid] ?? 0;
      const label = TIDE_BASIN_LABELS[bid] ?? bid;
      const prompt = st.puzzleSolved
        ? `${label} (${TIDE_LEVEL_NAMES[lv]}) — alineada`
        : `${label} (${TIDE_LEVEL_NAMES[lv]}) — Cambiar nivel`;
      put(`gym:${s.id}:tide:${bid}`, local, 2.6, prompt, () => {
        const r = gyms.cycleBasin(gymId, bid);
        if (r.already) ui.toast("Las mareas ya abren el camino a Talassa.");
        applyTideBasinVisuals(s);
        applyTideLeaderOpening(s);
        saveGame();
      });
    }
  }
}

function findRegionalGate(x, z) {
  if (!world) return null;
  const gym = regions.homeGym() || regions.ensureHome();
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
  if (regionId === REGION_3) return tryOpenRegion3Gate({ x, z });
  if (regionId === REGION_4) return tryOpenRegion4Gate({ x, z });
  const px = x ?? player?.pos.x ?? 0;
  const pz = z ?? player?.pos.z ?? 0;
  const opened = regions.openGate(regionId, { x: px, z: pz });
  const gate = findRegionalGate(px, pz);
  if (gate && regions.isGateOpened(regionId)) applyGateOpening(gate);
  if (opened) saveGame();
  return opened || regions.isGateOpened(regionId);
}

function tryOpenRegion3Gate({ x, z } = {}) {
  const px = x ?? player?.pos.x ?? 0;
  const pz = z ?? player?.pos.z ?? 0;
  const opened = regions.openGate(REGION_3, { x: px, z: pz });
  const gym2 = findMistGym(px, pz);
  if (gym2 && regions.isGateOpened(REGION_3)) applyMistExitOpening(gym2);
  if (opened) saveGame();
  return opened || regions.isGateOpened(REGION_3);
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
  const gym = regions.homeGym() || regions.ensureHome();
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
  const gym = regions.homeGym() || regions.ensureHome();
  if (!gym) return null;
  return world.structures.candidate("gym_mist", gym.cellX, gym.cellZ);
}

function applyMistExitOpening(s) {
  if (!s || !world || !isRegion3GateOpened()) return;
  const [dx, dz] = MIST_GYM_LAYOUT.exitHook;
  for (let ox = -1; ox <= 1; ox++) {
    for (let dy = 1; dy <= 5; dy++) {
      world.setBlock(s.x + dx + ox, s.y + dy, s.z + dz, B.AIR);
    }
  }
}

function findCrimsonRuin(x, z) {
  if (!world) return null;
  const gym = regions.homeGym() || regions.ensureHome();
  if (!gym) return null;
  return world.structures.candidate("crimson_ruin", gym.cellX, gym.cellZ);
}

function findMiningCamp(x, z) {
  if (!world) return null;
  const gym = regions.homeGym() || regions.ensureHome();
  if (!gym) return null;
  return world.structures.candidate("mining_camp", gym.cellX, gym.cellZ);
}

function applyCrimsonSeal(s) {
  if (!s || !world) return;
  const [dx, dz] = CRIMSON_RUIN_LAYOUT.seal;
  const phase = bosses.sealPhase();
  if (phase === "activated") {
    world.setBlock(s.x + dx, s.y + 2, s.z + dz, B.EMBER_ORE);
    world.setBlock(s.x + dx, s.y + 3, s.z + dz, B.RED_CRYSTAL);
  } else if (phase === "resonating") {
    world.setBlock(s.x + dx, s.y + 2, s.z + dz, B.RED_CRYSTAL);
  }
}

function applyGym3PathOpening(s) {
  if (!s || !world || !progression.isUnlocked("gym_3_path_unlocked")) return;
  const [dx, dz] = CRIMSON_RUIN_LAYOUT.pathGate;
  for (let ox = -1; ox <= 1; ox++) {
    for (let dy = 1; dy <= 5; dy++) {
      world.setBlock(s.x + dx + ox, s.y + dy, s.z + dz, B.AIR);
    }
  }
}

function applyCrimsonPassOpening(s) {
  if (!s || !world || !isCrimsonPassOpen()) return;
  const [dx, dz] = FORGE_GYM_LAYOUT.passHook;
  for (let ox = -1; ox <= 1; ox++) {
    for (let dy = 1; dy <= 5; dy++) {
      world.setBlock(s.x + dx + ox, s.y + dy, s.z + dz, B.AIR);
    }
  }
}

function applyForgeEnergyVisuals(s) {
  if (!s || !world) return;
  const layout = FORGE_GYM_LAYOUT;
  const westOn = gyms.conduitOpen("gym_crimson", "west") || trainers.isDefeated("gym_trainer_forge_1");
  const eastOn = gyms.conduitOpen("gym_crimson", "east") || trainers.isDefeated("gym_trainer_forge_2");
  const [wdx, wdz] = layout.westDoor;
  const [edx, edz] = layout.eastDoor;
  for (let dy = 1; dy <= 2; dy++) {
    world.setBlock(s.x + wdx, s.y + dy, s.z + wdz, westOn ? B.AIR : B.CRYSTAL);
    world.setBlock(s.x + edx, s.y + dy, s.z + edz, eastOn ? B.AIR : B.CRYSTAL);
  }
  const en = gyms.gymState("gym_crimson").energy ?? {};
  for (const [cid, local] of Object.entries(layout.conduits)) {
    const top = (en[cid] ?? 0) > 0 ? B.RED_CRYSTAL : B.CRYSTAL;
    world.setBlock(s.x + local[0], s.y + 2, s.z + local[1], top);
  }
}

function tryOpenRegion4Gate({ x, z } = {}) {
  const px = x ?? player?.pos.x ?? 0;
  const pz = z ?? player?.pos.z ?? 0;
  const opened = regions.openGate(REGION_4, { x: px, z: pz });
  const g3 = findForgeGym(px, pz);
  if (g3 && regions.isGateOpened(REGION_4)) applyCrimsonPassOpening(g3);
  if (opened) saveGame();
  return opened || regions.isGateOpened(REGION_4);
}

function canOpenRegion4Gate() {
  return progression.isUnlocked("region_4_path_unlocked") || progression.hasBadge("crimson_badge");
}

function isCrimsonPassOpen() {
  return regions.isGateOpened(REGION_4);
}

function findForgeGym(x, z) {
  if (!world) return null;
  const gym = regions.homeGym() || regions.ensureHome();
  if (!gym) return null;
  return world.structures.candidate("gym_crimson", gym.cellX, gym.cellZ);
}

function findStormObservatory(x, z) {
  if (!world) return null;
  const gym = regions.homeGym() || regions.ensureHome();
  if (!gym) return null;
  return world.structures.candidate("storm_observatory", gym.cellX, gym.cellZ);
}

function findCliffOutpost(x, z) {
  if (!world) return null;
  const gym = regions.homeGym() || regions.ensureHome();
  if (!gym) return null;
  return world.structures.candidate("cliff_outpost", gym.cellX, gym.cellZ);
}

function findWindShrine(x, z) {
  if (!world) return null;
  const gym = regions.homeGym() || regions.ensureHome();
  if (!gym) return null;
  return world.structures.candidate("wind_shrine", gym.cellX, gym.cellZ);
}

function findTempestSpire(x, z) {
  if (!world) return null;
  const gym = regions.homeGym() || regions.ensureHome();
  if (!gym) return null;
  return world.structures.candidate("tempest_spire", gym.cellX, gym.cellZ);
}

function findGaleGym(x, z) {
  if (!world) return null;
  const gym = regions.homeGym() || regions.ensureHome();
  if (!gym) return null;
  return world.structures.candidate("gym_gale", gym.cellX, gym.cellZ);
}

function findHighlandExit(x, z) {
  if (!world) return null;
  const gym = regions.homeGym() || regions.ensureHome();
  if (!gym) return null;
  return world.structures.candidate("highland_exit", gym.cellX, gym.cellZ);
}

function applyGaleGymOpening(s) {
  if (!s || !world || !progression.isUnlocked("gym_4_path_unlocked")) return;
  for (let ox = -1; ox <= 1; ox++) {
    for (let dy = 1; dy <= 4; dy++) {
      world.setBlock(s.x + ox, s.y + dy, s.z - 12, B.AIR);
    }
  }
  for (let dz = -4; dz <= 6; dz++) {
    for (let dy = 1; dy <= 5; dy++) {
      world.setBlock(s.x - 10, s.y + dy, s.z + dz, B.AIR);
    }
  }
}

function applyGaleLeaderOpening(s) {
  if (!s || !world || !gyms.canEnterLeader("gym_gale")) return;
  world.setBlock(s.x, s.y + 17, s.z + 10, B.AIR);
  world.setBlock(s.x, s.y + 18, s.z + 10, B.AIR);
}

function applyGaleChannelVisuals(s) {
  if (!s || !world) return;
  const layout = GALE_GYM_LAYOUT;
  const st = gyms.gymState("gym_gale");
  for (const [cid, local] of Object.entries(layout.channels)) {
    const on = !!st.channels?.[cid];
    const y = s.y + 2 + (local[2] ?? 0);
    world.setBlock(s.x + local[0], y, s.z + local[1], on ? B.WIND_CRYSTAL : B.STONE);
  }
}

function applyGaleSpireOpening(s) {
  if (!s || !world) return;
  if (!bosses.isSealActivated(STORM_SEAL_ID)) return;
  world.setBlock(s.x, s.y + 2, s.z, B.WIND_CRYSTAL);
}

function applyHighlandExitOpening(s) {
  if (!s || !world || !progression.isUnlocked("region_5_path_unlocked")) return;
  for (let ox = -1; ox <= 1; ox++) {
    for (let dy = 1; dy <= 5; dy++) {
      world.setBlock(s.x + ox, s.y + dy, s.z, B.AIR);
    }
  }
  for (let dz = 1; dz <= 4; dz++) {
    world.setBlock(s.x, s.y + 1, s.z + dz, B.WIND_CRYSTAL);
  }
}

function applyTideGymOpening(s) {
  if (!s || !world || !gyms.canEnter("gym_tide")) return;
  for (let ox = -1; ox <= 1; ox++) {
    for (let dy = 1; dy <= 4; dy++) {
      world.setBlock(s.x + ox, s.y + dy, s.z - 13, B.AIR);
    }
  }
}

function applyTideLeaderOpening(s) {
  if (!s || !world || !gyms.canEnterLeader("gym_tide")) return;
  world.setBlock(s.x, s.y + 3, s.z + 10, B.AIR);
  world.setBlock(s.x, s.y + 4, s.z + 10, B.AIR);
}

function applyTideBasinVisuals(s) {
  if (!s || !world) return;
  const layout = TIDE_GYM_LAYOUT;
  const st = gyms.gymState("gym_tide");
  const caps = [B.STONE, B.CRYSTAL, B.WIND_CRYSTAL];
  for (const [bid, local] of Object.entries(layout.basins)) {
    const lv = st.tides?.[bid] ?? 0;
    const bx = s.x + local[0];
    const bz = s.z + local[1];
    for (let ox = -1; ox <= 1; ox++) {
      for (let oz = -1; oz <= 1; oz++) {
        world.setBlock(bx + ox, s.y, bz + oz, B.SAND);
        world.setBlock(bx + ox, s.y + 1, bz + oz, B.WATER);
        world.setBlock(bx + ox, s.y + 2, bz + oz, lv >= 1 ? B.WATER : B.AIR);
        world.setBlock(bx + ox, s.y + 3, bz + oz, lv >= 2 ? B.WATER : B.AIR);
      }
    }
    world.setBlock(bx, s.y + 4, bz, lv >= 2 ? B.TIDAL_PEARL : B.AIR);
  }
  for (const [bid, local] of Object.entries(layout.controls)) {
    const lv = st.tides?.[bid] ?? 0;
    world.setBlock(s.x + local[0], s.y + 1, s.z + local[1], caps[lv] ?? B.STONE);
    world.setBlock(s.x + local[0], s.y + 2, s.z + local[1], st.puzzleSolved ? B.TIDAL_PEARL : B.STONE);
  }
}

function applyTidalBridgeOpening(s) {
  if (!s || !world || !progression.isUnlocked("gym_5_path_unlocked")) return;
  for (let ox = -1; ox <= 1; ox++) {
    for (let dy = 1; dy <= 5; dy++) {
      world.setBlock(s.x + ox, s.y + dy, s.z, B.AIR);
    }
  }
  world.setBlock(s.x, s.y + 1, s.z, B.WOOD);
  world.setBlock(s.x, s.y + 5, s.z, B.WIND_CRYSTAL);
}

function applyOpenSeaGateOpening(s) {
  if (!s || !world || !progression.isUnlocked("region_6_path_unlocked")) return;
  for (let ox = -1; ox <= 1; ox++) {
    for (let dy = 1; dy <= 6; dy++) {
      world.setBlock(s.x + ox, s.y + dy, s.z, B.AIR);
    }
  }
  world.setBlock(s.x - 3, s.y + 8, s.z, B.WIND_CRYSTAL);
  world.setBlock(s.x + 3, s.y + 8, s.z, B.WIND_CRYSTAL);
  world.setBlock(s.x, s.y + 2, s.z + 4, B.WIND_CRYSTAL);
  world.setBlock(s.x, s.y + 1, s.z + 5, B.CORAL_ROCK);
}

function applyReefSeal(s) {
  if (!s || !world) return;
  const [dx, dz] = REEF_ATOLL_LAYOUT.seal;
  const phase = bosses.sealPhase(REEF_SEAL_ID);
  if (phase === "activated") {
    world.setBlock(s.x + dx, s.y + 2, s.z + dz, B.WIND_CRYSTAL);
    world.setBlock(s.x + dx, s.y + 7, s.z + dz, B.WIND_CRYSTAL);
    world.setBlock(s.x + dx, s.y + 8, s.z + dz, B.TIDAL_PEARL);
  } else if (phase === "resonating") {
    world.setBlock(s.x + dx, s.y + 2, s.z + dz, B.CRYSTAL);
    world.setBlock(s.x + dx, s.y + 7, s.z + dz, B.CRYSTAL);
  } else {
    world.setBlock(s.x + dx, s.y + 2, s.z + dz, B.CORAL_ROCK);
  }
}

function refreshGaleLifts(px, pz) {
  const gym = regions.homeGym() || regions.ensureHome();
  if (!gym || !world) {
    traversal.setExtras([]);
    return;
  }
  const g = REGION_GEOMETRY;
  const extras = [];
  const add = (id, wx, wz, y, r = 2.3, h = 14) => {
    extras.push({
      id,
      type: "wind_lift",
      x: wx + 0.5,
      y,
      z: wz + 0.5,
      radius: r,
      height: h,
      regionId: getRegionAt(wx, wz),
    });
  };
  const sealOn = bosses.isSealActivated(STORM_SEAL_ID);
  const pathOn = progression.isUnlocked("gym_4_path_unlocked");
  if (sealOn) {
    add("gale:path_a", gym.x + g.galePathA.dx, gym.z + g.galePathA.dz,
      world.surfaceY(gym.x + g.galePathA.dx, gym.z + g.galePathA.dz), 2.4, 16);
    add("gale:spire", gym.x + g.tempestSpire.dx, gym.z + g.tempestSpire.dz,
      world.surfaceY(gym.x + g.tempestSpire.dx, gym.z + g.tempestSpire.dz), 2.6, 14);
  }
  if (pathOn) {
    add("gale:path_b", gym.x + g.galePathB.dx, gym.z + g.galePathB.dz,
      world.surfaceY(gym.x + g.galePathB.dx, gym.z + g.galePathB.dz), 2.4, 16);
    add("gale:gym_approach", gym.x + g.gymGale.dx, gym.z + g.gymGale.dz - 12,
      world.surfaceY(gym.x + g.gymGale.dx, gym.z + g.gymGale.dz - 12), 2.4, 12);
  }
  const gs = findGaleGym(px, pz);
  if (gs) {
    const ch = gyms.gymState("gym_gale").channels ?? {};
    const L = GALE_GYM_LAYOUT.lifts;
    add("gale:recovery", gs.x + L.recovery[0], gs.z + L.recovery[1], gs.y, 2.4, 10);
    if (ch.north) add("gale:low", gs.x + L.low[0], gs.z + L.low[1], gs.y + (L.low[2] ?? 0), 2.2, 8);
    if (ch.east) add("gale:mid", gs.x + L.mid[0], gs.z + L.mid[1], gs.y + (L.mid[2] ?? 0), 2.2, 8);
    if (ch.west) add("gale:high", gs.x + L.high[0], gs.z + L.high[1], gs.y + (L.high[2] ?? 0), 2.2, 8);
  }
  if (progression.isUnlocked("region_5_path_unlocked")) {
    add("gale:exit", gym.x + g.highlandExit.dx, gym.z + g.highlandExit.dz,
      world.surfaceY(gym.x + g.highlandExit.dx, gym.z + g.highlandExit.dz), 2.4, 12);
  }
  const addCurrent = (id, dx, dz, fx, fz) => {
    const wx = gym.x + dx;
    const wz = gym.z + dz;
    if (Math.hypot(wx - px, wz - pz) > 90) return;
    extras.push({
      id,
      type: "water_current",
      x: wx + 0.5,
      y: WATER_Y - 1,
      z: wz + 0.5,
      radius: 4.2,
      height: 5,
      fx,
      fz,
      regionId: REGION_5,
    });
  };
  addCurrent("azure:current_a", g.currentA.dx, g.currentA.dz, -2.8, 1.6);
  addCurrent("azure:current_b", g.currentB.dx, g.currentB.dz, -1.4, 3.2);
  addCurrent("azure:current_c", g.currentC.dx, g.currentC.dz, 3.0, 1.2);
  if (progression.hasFlag("lighthouse_signal")) {
    addCurrent("gym5:signal", g.currentSignal.dx, g.currentSignal.dz, 3.4, 0.6);
  }
  if (progression.isUnlocked("gym_5_path_unlocked")) {
    addCurrent("gym5:approach", g.currentApproach.dx, g.currentApproach.dz, 2.8, 1.8);
  }
  const tideGym = findAzure("gym_tide", px, pz);
  if (tideGym && Math.hypot(tideGym.x - px, tideGym.z - pz) < 40) {
    const tides = gyms.gymState("gym_tide").tides ?? { a: 0, b: 0, c: 0 };
    const L = TIDE_GYM_LAYOUT;
    extras.push({
      id: "gym5:recovery",
      type: "water_current",
      x: tideGym.x + L.recovery[0] + 0.5,
      y: WATER_Y - 1,
      z: tideGym.z + L.recovery[1] + 0.5,
      radius: 3.2,
      height: 6,
      fx: 0,
      fz: -3.2,
      regionId: REGION_5,
    });
    if (tides.a === 2) {
      extras.push({
        id: "gym5:high",
        type: "water_current",
        x: tideGym.x + L.basins.a[0] + 0.5,
        y: WATER_Y - 1,
        z: tideGym.z + L.basins.a[1] + 0.5,
        radius: 2.6,
        height: 6,
        fx: 0,
        fz: 2.8,
        regionId: REGION_5,
      });
    }
    if (tides.c === 1) {
      extras.push({
        id: "gym5:mid",
        type: "water_current",
        x: tideGym.x + L.basins.c[0] + 0.5,
        y: WATER_Y - 1,
        z: tideGym.z + L.basins.c[1] + 0.5,
        radius: 2.6,
        height: 6,
        fx: 0,
        fz: 2.8,
        regionId: REGION_5,
      });
    }
    if (tides.b === 0) {
      extras.push({
        id: "gym5:low",
        type: "water_current",
        x: tideGym.x + L.basins.b[0] + 0.5,
        y: WATER_Y - 1,
        z: tideGym.z + L.basins.b[1] + 0.5,
        radius: 2.4,
        height: 5,
        fx: 0,
        fz: 1.6,
        regionId: REGION_5,
      });
    }
  }
  traversal.setExtras(extras);
}

function applyStormSeal(s) {
  if (!s || !world) return;
  const [dx, dz] = STORM_OBSERVATORY_LAYOUT.seal;
  const phase = bosses.sealPhase(STORM_SEAL_ID);
  if (phase === "activated") {
    world.setBlock(s.x + dx, s.y + 2, s.z + dz, B.WIND_CRYSTAL);
    world.setBlock(s.x + dx, s.y + 12, s.z + dz, B.WIND_CRYSTAL);
    world.setBlock(s.x + dx, s.y + 13, s.z + dz, B.CRYSTAL);
    for (let i = 3; i <= 7; i++) {
      world.setBlock(s.x + i, s.y + 2, s.z + dz, B.WIND_CRYSTAL);
    }
    world.setBlock(s.x + 8, s.y + 3, s.z + dz, B.CRYSTAL);
  } else if (phase === "resonating") {
    world.setBlock(s.x + dx, s.y + 2, s.z + dz, B.WIND_CRYSTAL);
    world.setBlock(s.x + dx, s.y + 12, s.z + dz, B.WIND_CRYSTAL);
    world.setBlock(s.x + dx, s.y + 13, s.z + dz, B.CRYSTAL);
  } else {
    world.setBlock(s.x + dx, s.y + 2, s.z + dz, B.STONE);
  }
}

function hoverBlockedZone(x, z) {
  if (!world) return false;
  for (const s of world.structures.near(x, z, 22)) {
    const dist = Math.hypot(s.x - x, s.z - z);
    if (s.type === "gym_gale" && dist < 16) return true;
    if (s.type === "gym_tide" && dist < 16) return true;
    if (s.type === "tempest_spire" && dist < 10 && !bosses.isSealActivated(STORM_SEAL_ID)) return true;
    if (s.type === "reef_atoll" && dist < 11) {
      const already = Math.hypot(player.pos.x - s.x, player.pos.z - s.z) < 11;
      if (!already && !bosses.isSealActivated(REEF_SEAL_ID)) return true;
    }
    if (s.type === "tidal_bridge" && dist < 8) {
      const already = Math.hypot(player.pos.x - s.x, player.pos.z - s.z) < 8;
      if (!already && !progression.isUnlocked("gym_5_path_unlocked")) return true;
    }
    if (s.type === "open_sea_gate" && dist < 8) {
      const already = Math.hypot(player.pos.x - s.x, player.pos.z - s.z) < 8;
      if (!already && !progression.isUnlocked("region_6_path_unlocked")) return true;
    }
    if (s.type === "highland_exit" && dist < 8 && !progression.isUnlocked("region_5_path_unlocked")) return true;
    if (s.type === "gym" || s.type === "gym_mist" || s.type === "gym_crimson") {
      if (dist > 16) continue;
      const gid = gymIdForStructure(s);
      if (!gid) continue;
      const already = Math.hypot(player.pos.x - s.x, player.pos.z - s.z) < 16;
      if (already) continue;
      if (!gyms.canEnter(gid) && !gyms.isCompleted(gid)) return true;
    }
    if (s.type === "crimson_ruin" && dist < 9) {
      const already = Math.hypot(player.pos.x - s.x, player.pos.z - s.z) < 9;
      if (already) continue;
      if (!progression.isUnlocked("gym_3_path_unlocked")) return true;
    }
  }
  return false;
}

function toggleInventory() {
  const el = document.getElementById("inventory-ui");
  if (mode === "inventory") {
    el?.classList.add("hidden");
    mode = "play";
    canvas.requestPointerLock();
    saveGame();
    return;
  }
  if (mode !== "play") return;
  mode = "inventory";
  document.exitPointerLock();
  keys.clear();
  ui.setTargetPrompt(null);
  ui.setInspectCard(null);
  highlight.visible = false;
  ui.renderInventory();
  el?.classList.remove("hidden");
}

function openPc() {
  if (mode !== "play") return;
  mode = "pc";
  document.exitPointerLock();
  keys.clear();
  ui.setTargetPrompt(null);
  ui.setInspectCard(null);
  highlight.visible = false;
  ui.renderPc();
  document.getElementById("pc-ui")?.classList.remove("hidden");
}

function closePc() {
  if (mode !== "pc") return;
  document.getElementById("pc-ui")?.classList.add("hidden");
  mode = "play";
  canvas.requestPointerLock();
  saveGame();
}

function registerPcTerminal(s, local, wanted) {
  const [dx, dz] = local;
  const id = `pc:${s.id}`;
  wanted.add(id);
  const x = s.x + dx + 0.5;
  const y = s.y + 1.6;
  const z = s.z + dz + 0.5;
  const onInteract = () => openPc();
  const existing = interaction.items.get(id);
  if (existing) {
    existing.x = x; existing.y = y; existing.z = z;
    existing.onInteract = onInteract;
    return;
  }
  interaction.register({
    id, type: "pc", x, y, z, range: 3.2, prompt: "Usar PC", data: s, onInteract, critical: true,
  });
}

function bindBattleEvolve() {
  ui.onEvolve = (m) => {
    dex.markCaught(m.speciesId, { source: "evolution" });
    events.emit("creatureEvolved", { speciesId: m.speciesId });
    ui.refreshHud();
  };
}

function toggleMap() {
  const el = document.getElementById("map-ui");
  if (mode === "map") {
    worldMap.hide();
    el?.classList.add("hidden");
    mode = "play";
    canvas.requestPointerLock();
    return;
  }
  if (mode !== "play") return;
  mode = "map";
  document.exitPointerLock();
  keys.clear();
  ui.setTargetPrompt(null);
  ui.setInspectCard(null);
  highlight.visible = false;
  worldMap.show();
  el?.classList.remove("hidden");
}

let bossVisual = null;
let tempestVisual = null;
let reefVisual = null;

function rebuildCreatureVisuals() {
  if (!spawner) return 0;
  let n = 0;
  for (const c of spawner.creatures) {
    if (c.dead || c.inBattle) continue;
    const label = c.label;
    if (label && c.group) c.group.remove(label);
    scene.remove(c.group);
    disposeCreatureVisual(c.group);
    c.group = buildCreatureVisual(c.monster.speciesId);
    c.group.userData.entity = c;
    if (label) {
      label.position.y = (c.group.userData.height ?? 1.5) + 0.5;
      c.group.add(label);
    }
    scene.add(c.group);
    c.syncTransform();
    n++;
  }
  if (bossVisual) {
    const pos = bossVisual.position.clone();
    const sid = bossVisual.userData.bossSpeciesId || "titanor";
    scene.remove(bossVisual);
    disposeCreatureVisual(bossVisual);
    bossVisual = buildCreatureVisual(sid);
    bossVisual.userData.bossSpeciesId = sid;
    bossVisual.position.copy(pos);
    scene.add(bossVisual);
  }
  if (tempestVisual) {
    const pos = tempestVisual.position.clone();
    scene.remove(tempestVisual);
    disposeCreatureVisual(tempestVisual);
    tempestVisual = buildCreatureVisual("nimbora");
    tempestVisual.userData.bossSpeciesId = "nimbora";
    tempestVisual.position.copy(pos);
    scene.add(tempestVisual);
  }
  if (reefVisual) {
    const pos = reefVisual.position.clone();
    scene.remove(reefVisual);
    disposeCreatureVisual(reefVisual);
    reefVisual = buildCreatureVisual("mariscol");
    reefVisual.userData.bossSpeciesId = "mariscol";
    reefVisual.position.copy(pos);
    scene.add(reefVisual);
  }
  return n;
}
function disposeBossVisual() {
  if (!bossVisual) return;
  scene.remove(bossVisual);
  disposeCreatureVisual(bossVisual);
  bossVisual = null;
}
function disposeTempestVisual() {
  if (!tempestVisual) return;
  scene.remove(tempestVisual);
  disposeCreatureVisual(tempestVisual);
  tempestVisual = null;
}
function disposeReefVisual() {
  if (!reefVisual) return;
  scene.remove(reefVisual);
  disposeCreatureVisual(reefVisual);
  reefVisual = null;
}

function syncBossVisual(s) {
  const want = !!s && bosses.isSealActivated() && !bosses.isDefeated("crimson_guardian");
  if (!want) {
    disposeBossVisual();
    return;
  }
  const [dx, dz] = CRIMSON_RUIN_LAYOUT.boss;
  const x = s.x + dx + 0.5;
  const y = (s.y ?? world.surfaceY(s.x + dx, s.z + dz)) + 1;
  const z = s.z + dz + 0.5;
  if (!bossVisual) {
    bossVisual = buildCreatureVisual("titanor");
    bossVisual.userData.bossSpeciesId = "titanor";
    scene.add(bossVisual);
  }
  bossVisual.position.set(x, y, z);
}

function syncTempestVisual(s) {
  const want = !!s && bosses.isSealActivated(STORM_SEAL_ID) && !bosses.isDefeated("tempest_guardian");
  if (!want) {
    disposeTempestVisual();
    return;
  }
  const [dx, dz] = TEMPEST_SPIRE_LAYOUT.boss;
  const x = s.x + dx + 0.5;
  const y = (s.y ?? world.surfaceY(s.x + dx, s.z + dz)) + 1;
  const z = s.z + dz + 0.5;
  if (!tempestVisual) {
    tempestVisual = buildCreatureVisual("nimbora");
    tempestVisual.userData.bossSpeciesId = "nimbora";
    scene.add(tempestVisual);
  }
  tempestVisual.position.set(x, y, z);
}

function syncReefVisual(s) {
  const want = !!s && bosses.isSealActivated(REEF_SEAL_ID) && !bosses.isDefeated("reef_guardian");
  if (!want) {
    disposeReefVisual();
    return;
  }
  const [dx, dz] = REEF_ATOLL_LAYOUT.boss;
  const x = s.x + dx + 0.5;
  const y = (s.y ?? world.surfaceY(s.x + dx, s.z + dz)) + 1;
  const z = s.z + dz + 0.5;
  if (!reefVisual) {
    reefVisual = buildCreatureVisual("mariscol");
    reefVisual.userData.bossSpeciesId = "mariscol";
    scene.add(reefVisual);
  }
  reefVisual.position.set(x, y, z);
}

function registerRuinInteractables(s, wanted) {
  applyCrimsonSeal(s);
  if (progression.isUnlocked("gym_3_path_unlocked")) applyGym3PathOpening(s);
  syncBossVisual(s);

  const putRuin = (id, type, local, range, prompt, onInteract) => {
    wanted.add(id);
    const x = s.x + local[0] + 0.5;
    const y = s.y + 1.6;
    const z = s.z + local[1] + 0.5;
    const existing = interaction.items.get(id);
    if (existing) {
      existing.prompt = prompt;
      existing.x = x;
      existing.y = y;
      existing.z = z;
      return;
    }
    interaction.register({ id, type, x, y, z, range, prompt, data: s, onInteract });
  };

  const phase = bosses.sealPhase();
  let sealPrompt;
  if (phase === "activated") sealPrompt = "El sello se abre.";
  else if (phase === "resonating") {
    sealPrompt = bosses.canActivateSeal().ok
      ? "Activar sello"
      : "El sello mineral comienza a resonar. Parece faltarle energía.";
  } else {
    sealPrompt = "El sello permanece inerte.";
  }
  putRuin(`crimson_seal:${s.id}`, "crimson_seal", CRIMSON_RUIN_LAYOUT.seal, 3.2, sealPrompt, () => {
    const p = bosses.sealPhase();
    if (p === "inert") {
      ui.toast("El sello permanece inerte.", "bad");
      return;
    }
    if (p === "activated") {
      applyCrimsonSeal(s);
      ui.toast("El sello se abre.", "good");
      return;
    }
    const r = bosses.activateSeal();
    if (!r.ok) {
      applyCrimsonSeal(s);
      ui.toast(r.reason ?? "El sello mineral comienza a resonar. Parece faltarle energía.", "bad");
      return;
    }
    applyCrimsonSeal(s);
    syncBossVisual(s);
    ui.toast("El sello se abre. Un eco mineral despierta en el patio.", "legendary");
    ui.refreshHud();
    saveGame();
  });

  const pathOpen = progression.isUnlocked("gym_3_path_unlocked");
  putRuin(`crimson_path:${s.id}`, "crimson_path", CRIMSON_RUIN_LAYOUT.pathGate, 3.2,
    pathOpen ? "Cruzar hacia el Gimnasio de la Forja" : "El camino hacia la forja está sellado.",
    () => {
      if (!pathOpen) {
        ui.toast("El camino hacia la forja está sellado.", "bad");
        return;
      }
      applyGym3PathOpening(s);
      const [hx, hz] = CRIMSON_RUIN_LAYOUT.pathGate;
      const destX = s.x + hx + 0.5;
      const destZ = s.z + hz + 12;
      teleportPlayer(destX, world.surfaceY(destX, destZ) + 1, destZ);
    });

  if (phase === "activated") {
    const defeated = bosses.isDefeated("crimson_guardian");
    putRuin(`crimson_boss:${s.id}`, "boss", CRIMSON_RUIN_LAYOUT.boss, 3.4,
      defeated ? "El guardián mineral descansa." : "Desafiar al Guardián Carmesí",
      () => {
        if (defeated) {
          ui.toast("El guardián mineral descansa.", "good");
          return;
        }
        startBossBattle("crimson_guardian");
      });
  }
}

function registerObservatoryInteractables(s, wanted) {
  applyStormSeal(s);
  const id = `storm_seal:${s.id}`;
  wanted.add(id);
  const [dx, dz] = STORM_OBSERVATORY_LAYOUT.seal;
  const x = s.x + dx + 0.5;
  const y = s.y + 2.2;
  const z = s.z + dz + 0.5;
  const phase = bosses.sealPhase(STORM_SEAL_ID);
  let prompt;
  if (phase === "activated") prompt = "El sello del vendaval está activo.";
  else if (phase === "resonating") prompt = "E — Activar sello";
  else prompt = "El mecanismo está dormido.";
  const onInteract = () => {
    progression.setFlag("storm_anomaly_inspected");
    const p = bosses.sealPhase(STORM_SEAL_ID);
    if (p === "dormant") {
      applyStormSeal(s);
      ui.toast("El mecanismo está dormido.", "bad");
      return;
    }
    if (p === "activated") {
      applyStormSeal(s);
      ui.toast("El sello del vendaval está activo.", "good");
      return;
    }
    const r = bosses.activateStormSeal();
    applyStormSeal(s);
    const spire = findTempestSpire(s.x, s.z);
    if (spire) syncTempestVisual(spire);
    if (r.already) {
      ui.toast("El sello ya está activo.", "good");
      return;
    }
    if (!r.ok) {
      ui.toast(r.reason ?? "El mecanismo está dormido.", "bad");
      return;
    }
    ui.toast("Los cristales se encienden. Una corriente señala el pináculo del este.", "legendary");
    ui.refreshHud();
    saveGame();
  };
  const existing = interaction.items.get(id);
  if (existing) {
    existing.prompt = prompt;
    existing.x = x; existing.y = y; existing.z = z;
    existing.onInteract = onInteract;
  } else {
    interaction.register({
      id,
      type: "storm_seal",
      x, y, z,
      range: 3.4,
      prompt,
      data: s,
      onInteract,
    });
  }
}

function registerSpireInteractables(s, wanted) {
  applyGaleSpireOpening(s);
  syncTempestVisual(s);
  if (!bosses.isSealActivated(STORM_SEAL_ID)) return;
  const id = `tempest_boss:${s.id}`;
  wanted.add(id);
  const [dx, dz] = TEMPEST_SPIRE_LAYOUT.boss;
  const x = s.x + dx + 0.5;
  const y = s.y + 1.8;
  const z = s.z + dz + 0.5;
  const defeated = bosses.isDefeated("tempest_guardian");
  const prompt = defeated ? "El guardián del vendaval descansa." : "Desafiar al Guardián del Vendaval";
  const onInteract = () => {
    if (defeated) {
      ui.toast("El guardián del vendaval descansa.", "good");
      return;
    }
    startBossBattle("tempest_guardian");
  };
  const existing = interaction.items.get(id);
  if (existing) {
    existing.prompt = prompt;
    existing.x = x; existing.y = y; existing.z = z;
    existing.onInteract = onInteract;
  } else {
    interaction.register({
      id, type: "boss", x, y, z, range: 3.6, prompt, data: s, onInteract, critical: true,
    });
  }
}

function registerReefInteractables(s, wanted) {
  applyReefSeal(s);
  syncReefVisual(s);
  const [dx, dz] = REEF_ATOLL_LAYOUT.seal;
  const id = `reef_seal:${s.id}`;
  wanted.add(id);
  const x = s.x + dx + 0.5;
  const y = s.y + 2.2;
  const z = s.z + dz + 0.5;
  const phase = bosses.sealPhase(REEF_SEAL_ID);
  let prompt = "El corazón de coral duerme.";
  if (phase === "resonating") prompt = "Despertar el corazón de coral";
  if (phase === "activated") prompt = "El corazón de coral late.";
  const onInteract = () => {
    if (phase === "activated") {
      applyReefSeal(s);
      ui.toast("El corazón de coral ya late.", "good");
      return;
    }
    const r = bosses.activateReefSeal();
    applyReefSeal(s);
    syncReefVisual(s);
    if (r.already) {
      ui.toast("El corazón de coral ya late.", "good");
      return;
    }
    if (!r.ok) {
      ui.toast(r.reason ?? "El atolón duerme.", "bad");
      return;
    }
    ui.toast("El coral se abre. El guardián emerge de la marea.", "legendary");
    ui.refreshHud();
    saveGame();
  };
  const existing = interaction.items.get(id);
  if (existing) {
    existing.prompt = prompt;
    existing.x = x; existing.y = y; existing.z = z;
    existing.onInteract = onInteract;
  } else {
    interaction.register({
      id, type: "reef_seal", x, y, z, range: 3.4, prompt, data: s, onInteract, critical: true,
    });
  }
  if (!bosses.isSealActivated(REEF_SEAL_ID)) return;
  const bid = `reef_boss:${s.id}`;
  wanted.add(bid);
  const [bdx, bdz] = REEF_ATOLL_LAYOUT.boss;
  const bx = s.x + bdx + 0.5;
  const by = s.y + 1.8;
  const bz = s.z + bdz + 0.5;
  const defeated = bosses.isDefeated("reef_guardian");
  const bPrompt = defeated ? "El guardián del arrecife descansa." : "Desafiar al Guardián del Arrecife";
  const onBoss = () => {
    if (defeated) {
      ui.toast("El guardián del arrecife descansa.", "good");
      return;
    }
    startBossBattle("reef_guardian");
  };
  const bex = interaction.items.get(bid);
  if (bex) {
    bex.prompt = bPrompt;
    bex.x = bx; bex.y = by; bex.z = bz;
    bex.onInteract = onBoss;
  } else {
    interaction.register({
      id: bid, type: "boss", x: bx, y: by, z: bz, range: 3.6, prompt: bPrompt, data: s, onInteract: onBoss, critical: true,
    });
  }
}

function registerBridgeInteractables(s, wanted) {
  applyTidalBridgeOpening(s);
  const open = progression.isUnlocked("gym_5_path_unlocked");
  const id = `tidal_bridge:${s.id}`;
  wanted.add(id);
  const prompt = open ? "Cruzar el Puente de Marea" : "El puente está ciego. El guardián aún custodia el paso.";
  const onInteract = () => {
    if (!open) {
      ui.toast("El puente está ciego. El guardián aún custodia el paso.", "bad");
      return;
    }
    applyTidalBridgeOpening(s);
    const destX = s.x + 0.5;
    const destZ = s.z + 6.5;
    teleportPlayer(destX, world.surfaceY(destX, destZ) + 1, destZ);
  };
  const existing = interaction.items.get(id);
  if (existing) {
    existing.prompt = prompt;
    existing.x = s.x + 0.5; existing.y = s.y + 1.6; existing.z = s.z + 0.5;
    existing.onInteract = onInteract;
  } else {
    interaction.register({
      id, type: "tidal_bridge", x: s.x + 0.5, y: s.y + 1.6, z: s.z + 0.5, range: 3.2, prompt, data: s, onInteract,
    });
  }
}

function registerSeaGateInteractables(s, wanted) {
  applyOpenSeaGateOpening(s);
  const open = progression.isUnlocked("region_6_path_unlocked");
  const id = `open_sea_gate:${s.id}`;
  wanted.add(id);
  const [dx, dz] = OPEN_SEA_GATE_LAYOUT.arch;
  const prompt = open
    ? "El arco mira al horizonte. Aún no hay tierra más allá."
    : "El Arco del mar abierto está cerrado.";
  const onInteract = () => {
    if (!open) {
      ui.toast("El arco permanece ciego. Falta la Insignia Marea.", "bad");
      return;
    }
    applyOpenSeaGateOpening(s);
    ui.toast("El horizonte continúa. Todavía no hay región más allá.", "good");
    showLocationBanner("MAR ABIERTO");
  };
  const existing = interaction.items.get(id);
  if (existing) {
    existing.prompt = prompt;
    existing.x = s.x + dx + 0.5; existing.y = s.y + 1.6; existing.z = s.z + dz + 0.5;
    existing.onInteract = onInteract;
  } else {
    interaction.register({
      id, type: "open_sea_gate", x: s.x + dx + 0.5, y: s.y + 1.6, z: s.z + dz + 0.5,
      range: 3.4, prompt, data: s, onInteract, critical: true,
    });
  }
}

function showLocationBanner(name) {
  const el = document.getElementById("location-banner");
  if (!el || !name) {
    ui.toast(name, "good");
    return;
  }
  el.textContent = name;
  el.classList.remove("hidden");
  el.classList.add("show");
  clearTimeout(showLocationBanner._t);
  showLocationBanner._t = setTimeout(() => {
    el.classList.remove("show");
    el.classList.add("hidden");
  }, 2800);
}

function findAzure(type, x, z) {
  if (!world) return null;
  const gym = regions.homeGym() || regions.ensureHome();
  if (!gym) return null;
  return world.structures.candidate(type, gym.cellX, gym.cellZ);
}

function applyLighthouseBeam(s) {
  if (!s || !world) return;
  const on = progression.hasFlag("lighthouse_activated") || progression.isUnlocked("gym_5_clue_unlocked");
  const clue = progression.isUnlocked("gym_5_clue_unlocked");
  const signal = progression.hasFlag("lighthouse_signal");
  const [dx, dz] = AZURE_LIGHTHOUSE_LAYOUT.lens;
  if (on) {
    stampLighthouseCrystal(s, dx, dz, true, clue, signal);
    worldMap.revealRadius(s.x, s.z, 6, "azure_lighthouse");
  } else {
    stampLighthouseCrystal(s, dx, dz, false, false, false);
  }
}

function stampLighthouseCrystal(s, dx, dz, on, clue = false, signal = false) {
  world.setBlock(s.x + dx, s.y + 15, s.z + dz, B.CRYSTAL);
  world.setBlock(s.x + dx, s.y + 16, s.z + dz, on ? B.WIND_CRYSTAL : B.CRYSTAL);
  world.setBlock(s.x + dx, s.y + 17, s.z + dz, on ? B.WIND_CRYSTAL : B.AIR);
  if (on) {
    for (let i = 1; i <= 6; i++) {
      world.setBlock(s.x + dx + i, s.y + 16, s.z + dz + 1, B.CRYSTAL);
    }
  }
  // Consumidor físico de gym_5_clue_unlocked: haz extra hacia el este.
  if (clue) {
    for (let i = 7; i <= 14; i++) {
      world.setBlock(s.x + dx + i, s.y + 16, s.z + dz, B.WIND_CRYSTAL);
    }
  }
  // Señal hacia el atolón (quest 47): haz más largo + peldaños de coral.
  if (signal) {
    for (let i = 15; i <= 22; i++) {
      world.setBlock(s.x + dx + i, s.y + 16, s.z + dz + Math.floor((i - 14) / 4), B.WIND_CRYSTAL);
    }
    for (let i = 3; i <= 10; i++) {
      world.setBlock(s.x + dx + i * 2, s.y + 1, s.z + dz + 1, B.CORAL_ROCK);
    }
  }
}

function registerAzurePortInteractables(s, wanted) {
  registerPcTerminal(s, AZURE_PORT_LAYOUT.pc, wanted);
}

function registerLighthouseInteractables(s, wanted) {
  applyLighthouseBeam(s);
  const id = `lighthouse_lens:${s.id}`;
  wanted.add(id);
  const [dx, dz] = AZURE_LIGHTHOUSE_LAYOUT.lens;
  const x = s.x + dx + 0.5;
  const y = s.y + 15.6;
  const z = s.z + dz + 0.5;
  const on = progression.hasFlag("lighthouse_activated");
  const clue = progression.isUnlocked("gym_5_clue_unlocked");
  const signal = progression.hasFlag("lighthouse_signal");
  let prompt = "Activar lente del faro";
  if (signal) prompt = "El haz señala el atolón del este.";
  else if (clue && on) prompt = "Enfocar el haz hacia el este";
  else if (on) prompt = "La lente ya mira al horizonte.";
  const onInteract = () => {
    if (!on) {
      progression.setFlag("lighthouse_activated");
      applyLighthouseBeam(s);
      ui.toast("La lente despierta. El horizonte señala más allá del mar.", "legendary");
      showLocationBanner("FARO AZUR");
    } else if (clue && !signal) {
      progression.setFlag("lighthouse_signal");
      applyLighthouseBeam(s);
      ui.toast("El haz se afila. Una corriente de coral apunta al atolón del este.", "legendary");
      showLocationBanner("SEÑAL DEL FARO");
    } else if (signal) {
      applyLighthouseBeam(s);
      ui.toast("Sigue la corriente al este. El atolón espera.", "good");
    } else {
      applyLighthouseBeam(s);
      ui.toast("El haz sigue el agua hacia el este. Todavía no hay gimnasio allí.", "good");
    }
  };
  const existing = interaction.items.get(id);
  if (existing) {
    existing.prompt = prompt;
    existing.x = x; existing.y = y; existing.z = z;
    existing.onInteract = onInteract;
  } else {
    interaction.register({
      id, type: "lighthouse_lens", x, y, z, range: 3.4, prompt, data: s, onInteract, critical: true,
    });
  }
}

function registerSigns(px, pz, wanted) {
  const gym = regions.homeGym();
  if (!gym || !world) return;
  const structOf = {
    coastal_gate: findAzure("coastal_gate", px, pz),
    azure_port: findAzure("azure_port", px, pz),
    azure_bridge: findAzure("azure_bridge", px, pz),
    tidal_ruins: findAzure("tidal_ruins", px, pz),
    azure_lighthouse: findAzure("azure_lighthouse", px, pz),
  };
  for (const sign of ROUTE_SIGNS) {
    const s = structOf[sign.localFrom];
    if (!s) continue;
    const x = s.x + (sign.offset?.[0] ?? 0);
    const z = s.z + (sign.offset?.[1] ?? 0);
    if (Math.hypot(x - px, z - pz) > 28) continue;
    const id = `sign:${sign.id}`;
    wanted.add(id);
    const y = world.surfaceY(x, z) + 1.4;
    const onInteract = () => {
      if (DIALOGUES.azure_sign) DIALOGUES.azure_sign.nodes.start.text = sign.text;
      dialogue.start("azure_sign");
    };
    const existing = interaction.items.get(id);
    if (existing) {
      existing.x = x + 0.5; existing.y = y; existing.z = z + 0.5;
      existing.onInteract = onInteract;
    } else {
      interaction.register({
        id, type: "sign", x: x + 0.5, y, z: z + 0.5, range: 3.2,
        prompt: "Leer señal", data: sign, onInteract,
      });
    }
  }
}

function registerPickups(px, pz, wanted) {
  if (!pickups.data) return;
  for (const p of pickups.nearby(px, pz, 26)) {
    const id = `pickup:${p.id}`;
    wanted.add(id);
    const onInteract = () => {
      const r = pickups.collect(p.id);
      if (!r.ok) {
        ui.toast(r.error ?? "Nada que recoger.", "bad");
        return;
      }
      interaction.unregister(id);
      ui.refreshHud();
      saveGame();
    };
    const existing = interaction.items.get(id);
    const y = (p.y ?? 12) + 0.6;
    if (existing) {
      existing.x = p.x + 0.5; existing.y = y; existing.z = p.z + 0.5;
      existing.onInteract = onInteract;
    } else {
      interaction.register({
        id, type: "pickup", x: p.x + 0.5, y, z: p.z + 0.5, range: 2.8,
        prompt: p.hidden ? "Recoger (escondido)" : "Recoger",
        data: p, onInteract,
      });
    }
  }
}

function registerHighlandInteractables(s, wanted) {
  applyHighlandExitOpening(s);
  const id = `highland_exit:${s.id}`;
  wanted.add(id);
  const [dx, dz] = HIGHLAND_EXIT_LAYOUT.arch;
  const x = s.x + dx + 0.5;
  const y = s.y + 1.6;
  const z = s.z + dz + 0.5;
  const open = progression.isUnlocked("region_5_path_unlocked");
  const prompt = open
    ? "El arco señala más allá del vendaval."
    : "El arco está sellado.";
  const onInteract = () => {
    if (!open) {
      ui.toast("El arco está sellado. El viento aún no concede el paso.", "bad");
      return;
    }
    applyHighlandExitOpening(s);
    events.emit("traversalUsed", {
      traversalId: "highland_exit",
      traversalType: "highland_exit",
      regionId: REGION_5,
      x: player?.pos.x ?? s.x,
      y: player?.pos.y ?? s.y,
      z: player?.pos.z ?? s.z,
    });
    regions.openGate(REGION_5, { x: s.x, z: s.z });
    ui.toast("El arco se abre al sur: descenso, acantilado, mar.", "good");
  };
  const existing = interaction.items.get(id);
  if (existing) {
    existing.prompt = prompt;
    existing.x = x; existing.y = y; existing.z = z;
    existing.onInteract = onInteract;
  } else {
    interaction.register({
      id, type: "highland_exit", x, y, z, range: 3.2, prompt, data: s, onInteract, critical: true,
    });
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
  } else if (gymId === "gym_crimson") {
    const e = st.energy ?? { west: 0, east: 0, core: 0, pool: 3 };
    label = st.leaderReady
      ? "Sala del líder abierta"
      : `Energía O${e.west} E${e.east} Núcleo ${e.core}/2 · reserva ${e.pool}`;
  } else if (gymId === "gym_gale") {
    const n = st.channelCount ?? 0;
    label = st.leaderReady
      ? "Terraza del líder abierta"
      : st.puzzleSolved
        ? "Canales alineados"
        : `Canales de viento: ${n}/3`;
  } else if (gymId === "gym_tide") {
    const n = st.tideMatch ?? 0;
    label = st.leaderReady
      ? "Sala del líder abierta"
      : st.puzzleSolved
        ? "Mareas alineadas"
        : `Niveles de marea: ${n}/3`;
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
  if (inventory.countBlock(b) <= 0) {
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
  if (world.structures?.protectedAt?.(x, z)) {
    ui.toast("La estructura está protegida.");
    return;
  }
  world.setBlock(x, y, z, b);
  inventory.remove(b, 1, "place");
  sfx.place();
  ui.refreshHotbar(HOTBAR, state.inventory, selectedSlot);
  events.emit("blockPlaced", { x, y, z, block: b });
}

/** Suma o resta monedas y lo anuncia. Las tiendas usan economy.buy/sell. */
function addMoney(delta, meta = {}) {
  const n = Math.floor(Number(delta) || 0);
  if (n > 0) economy.grantMoney(n, meta);
  else if (n < 0) economy.spendMoney(Math.min(state.money || 0, -n), meta);
  ui.refreshHud();
}

function spawnBreakParticles(x, y, z, block) {
  const colors = {
    [B.GRASS]: 0x5aa338, [B.DIRT]: 0x8a6642, [B.STONE]: 0x8d8d94, [B.SAND]: 0xe2d08f,
    [B.WOOD]: 0x7d5a30, [B.LEAVES]: 0x48a03c, [B.SNOW]: 0xeef2f5,
    [B.COAL_ORE]: 0x44464e, [B.COPPER_ORE]: 0xc07a4a, [B.IRON_ORE]: 0xc9b69e,
    [B.CRYSTAL]: 0x8ee4fa, [B.APRICORN]: 0xd98438, [B.HERB]: 0x8cd455,
    [B.ANCIENT_FRAGMENT]: 0xb48ad8, [B.MIST_BLOOM]: 0x8fd4e4, [B.MIST_GRASS]: 0x3a6152,
    [B.CRIMSON_STONE]: 0x6a2c28, [B.EMBER_ORE]: 0xc85020, [B.RED_CRYSTAL]: 0xe04048,
    [B.CRIMSON_RESONATOR]: 0xe86828,
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
  if (confirm("¿Borrar la partida guardada y empezar de cero? Se conservará una copia de seguridad.")) {
    snapshotSaveToBackup();
    try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
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
    keys.clear();
    ui.setTargetPrompt(null);
    ui.setInspectCard(null);
    ui.renderDex();
    ui.show(ui.el.dex);
  }
}
document.getElementById("btn-dex-close").addEventListener("click", toggleDex);

ui.onCloseInventory = () => { if (mode === "inventory") toggleInventory(); };
ui.onClosePc = () => closePc();
ui.onUseItem = (itemId) => {
  useCraftedItem(itemId);
  if (mode === "inventory") ui.renderInventory();
};
ui.onPcAction = (action, a, b) => {
  let r = { ok: false };
  if (action === "deposit") r = creatureStorage.deposit(a);
  else if (action === "withdraw") r = creatureStorage.withdraw(a);
  else if (action === "swap") r = creatureStorage.swap(a, b);
  else if (action === "up") r = creatureStorage.moveParty(a, -1);
  else if (action === "down") r = creatureStorage.moveParty(a, 1);
  else if (action === "lead") r = creatureStorage.setLead(a);
  if (!r.ok) {
    if (r.error) ui.toast(r.error, "bad");
    return;
  }
  ui.renderPc();
  ui.refreshHud();
  saveGame();
};

document.getElementById("btn-map-close")?.addEventListener("click", () => {
  if (mode === "map") toggleMap();
});
document.getElementById("btn-map-center")?.addEventListener("click", () => {
  worldMap.centerOnPlayer();
  worldMap.draw();
});
for (const [id, action] of [
  ["btn-map-region", () => worldMap.frameRegion()],
  ["btn-map-explored", () => worldMap.frameExplored()],
  ["btn-map-waypoint", () => worldMap.beginWaypoint()],
  ["btn-map-waypoint-center", () => worldMap.centerWaypoint()],
  ["btn-map-waypoint-remove", () => worldMap.removeWaypoint()],
]) {
  document.getElementById(id)?.addEventListener("click", () => { action(); worldMap.draw(); });
}
const mapCanvasEl = document.getElementById("map-canvas");
if (mapCanvasEl) {
  mapCanvasEl.addEventListener("wheel", (e) => {
    if (mode !== "map") return;
    e.preventDefault();
    worldMap.onWheel(e);
  }, { passive: false });
  mapCanvasEl.addEventListener("pointerdown", (e) => worldMap.onPointerDown(e));
  window.addEventListener("pointermove", (e) => worldMap.onPointerMove(e));
  window.addEventListener("pointerup", () => worldMap.onPointerUp());
  window.addEventListener("pointercancel", () => worldMap.onPointerUp());
  mapCanvasEl.addEventListener("contextmenu", (e) => e.preventDefault());
}

document.getElementById("btn-new").addEventListener("click", () => {
  ui.setTitleError("");
  if (!hasPersistedSave()) {
    beginNewGame();
    return;
  }
  ui.showNewGameConfirm();
});

document.getElementById("btn-confirm-new")?.addEventListener("click", () => {
  ui.hideNewGameConfirm();
  beginNewGame();
});

document.getElementById("btn-cancel-new")?.addEventListener("click", () => {
  ui.hideNewGameConfirm();
});

document.getElementById("btn-continue").addEventListener("click", () => {
  sfx.select();
  ui.setTitleError("");
  const saved = loadSave();
  if (!saved) {
    ui.setTitleError("No hay una partida válida. Si ves Recuperar, usa esa copia.");
    ui.showTitle(hasPersistedSave(), hasRecoverableBackup());
    return;
  }
  ui.hide(ui.el.title);
  startWorld(saved);
});

document.getElementById("btn-recover")?.addEventListener("click", () => {
  sfx.select();
  ui.setTitleError("");
  const saved = restoreBackupSave();
  if (!saved) {
    ui.setTitleError("No hay una copia de seguridad que recuperar.");
    ui.showTitle(hasPersistedSave(), hasRecoverableBackup());
    return;
  }
  ui.hide(ui.el.title);
  startWorld(saved);
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
  ui.setInspectCard(null);
  const wildInfo = { speciesId: wild.monster.speciesId, level: wild.monster.level, type: "wild" };
  dex.markSeen(wildInfo.speciesId, { source: "wild", level: wildInfo.level });
  events.emit("battleStarted", wildInfo);

  battle = new Battle({ scene, camera, world, player, wild, team: state.team, state, ui });
  bindBattleEvolve();
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
    const first = dex.markCaught(m.speciesId, { source: "capture", level: m.level });
    const { dest } = creatureStorage.receiveCapture(m);
    if (dest === "party") {
      ui.toast(`¡${m.name} fue capturado! Se unió al equipo.`, "good");
    } else {
      ui.toast(`¡${m.name} fue capturado!`, "good");
      ui.toast(`Tu equipo está completo. ${m.name} fue enviado al PC.`);
    }
    if (first) ui.toast("¡Nueva entrada registrada en la VoxelDex!", "good");
    if (famWasNew) {
      const p = PERKS[fam];
      refreshPerks();
      ui.toast(`${p.icon} Habilidad desbloqueada: ${p.name} — ${p.desc}`, "good");
    }
    events.emit("creatureCaptured", {
      ...wildInfo, uid: m.uid, dest, firstCaught: first,
    });
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
  if (buildAssist.blocksCombat()) return;
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

  for (const m of teamMonsters) dex.markSeen(m.speciesId, { source: "trainer", trainerId });
  events.emit("trainerBattleStarted", { trainerId });
  events.emit("battleStarted", {
    type: "trainer", trainerId, speciesId: teamMonsters[0].speciesId, level: teamMonsters[0].level,
  });

  battle = new Battle({
    scene, camera, world, player, wild: opponent, team: state.team, state, ui,
    ctx: { type: "trainer", trainer: def, queue: teamMonsters.slice(1) },
  });
  bindBattleEvolve();
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

/**
 * Combate contra jefe regional (Fase 10): reutiliza Battle + TrainerOpponent
 * con ctx.type === "boss". Recompensa solo vía bosses.resolveVictory.
 */
async function startBossBattle(bossId) {
  if (mode !== "play" || battle) return;
  if (buildAssist.blocksCombat()) return;
  const check = bosses.canBattle(bossId);
  if (!check.ok) {
    ui.toast(check.reason, "bad");
    return;
  }
  const def = BOSSES[bossId];
  mode = "battle";
  document.exitPointerLock();
  ui.setTargetPrompt(null);

  const teamMonsters = def.team.map((t) => createMonster(t.speciesId, t.level));
  const [bdx, bdz] = def.anchorOffset ?? [0, 0];
  const arena = def.structureType === "tempest_spire"
    ? findTempestSpire(player.pos.x, player.pos.z)
    : def.structureType === "reef_atoll"
      ? findAzure("reef_atoll", player.pos.x, player.pos.z)
      : findCrimsonRuin(player.pos.x, player.pos.z);
  let ox, oz;
  if (arena) {
    ox = arena.x + bdx + 0.5;
    oz = arena.z + bdz + 0.5;
  } else {
    const look = player.lookDir();
    ox = player.pos.x + look.x * 5;
    oz = player.pos.z + look.z * 5;
  }
  const opponent = new TrainerOpponent(scene, world, teamMonsters[0], ox, oz);
  if (bossId === "tempest_guardian") disposeTempestVisual();
  else if (bossId === "reef_guardian") disposeReefVisual();
  else disposeBossVisual();

  events.emit("battleStarted", {
    type: "boss", bossId, speciesId: teamMonsters[0].speciesId, level: teamMonsters[0].level,
  });
  for (const m of teamMonsters) dex.markSeen(m.speciesId, { source: "boss", bossId });

  battle = new Battle({
    scene, camera, world, player, wild: opponent, team: state.team, state, ui,
    ctx: { type: "boss", boss: def, queue: teamMonsters.slice(1) },
  });
  bindBattleEvolve();
  const result = await battle.run();
  battle = null;
  opponent.dispose();

  if (result === "win") {
    const reward = bosses.resolveVictory(bossId);
    events.emit("battleWon", { type: "boss", bossId });
    if (bossId === "crimson_guardian") {
      const ruinNow = findCrimsonRuin(player.pos.x, player.pos.z);
      if (ruinNow) applyGym3PathOpening(ruinNow);
    }
    if (bossId === "tempest_guardian") {
      const gym4 = findGaleGym(player.pos.x, player.pos.z);
      if (gym4) applyGaleGymOpening(gym4);
    }
    if (bossId === "reef_guardian") {
      const br = findAzure("tidal_bridge", player.pos.x, player.pos.z);
      if (br) applyTidalBridgeOpening(br);
      const g5 = findAzure("gym_tide", player.pos.x, player.pos.z);
      if (g5) applyTideGymOpening(g5);
    }
    if (!reward) ui.toast(`El ${def.name} permanece derrotado.`, "good");
  } else if (result === "lost") {
    events.emit("battleLost", { type: "boss", bossId });
    for (const m of state.team) m.hp = m.maxHp;
    ui.toast(`Caíste ante el ${def.name}… Tu equipo se recupera. El sello sigue abierto.`, "bad");
    if (bossId === "reef_guardian") {
      const atoll = findAzure("reef_atoll", player.pos.x, player.pos.z);
      if (atoll) syncReefVisual(atoll);
    }
    if (bossId === "tempest_guardian") {
      const spire = findTempestSpire(player.pos.x, player.pos.z);
      if (spire) syncTempestVisual(spire);
    }
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
    if (renderer) renderer.render(scene, camera);
    return;
  }

  const dayFactor = updateDayNight(dt);

  const playing = mode === "play";
  if (playing && locked) {
    refreshGaleLifts(player.pos.x, player.pos.z);
    traversal.sync(player.pos.x, player.pos.z);
    const lift = traversal.sample(player);
    if (lift) player.envForce.set(lift.x, lift.y, lift.z);
    else player.envForce.set(0, 0, 0);
    document.getElementById("water-overlay")?.classList.toggle("current", lift?.lift?.type === "water_current");

    if (buildAssist.canHover() && !buildAssist.hovering && keys.has("Space") && !lift) {
      buildAssist.beginHover();
    }
    const hovering = buildAssist.hovering;
    const groundY = world.surfaceY(player.pos.x, player.pos.z);
    player.update(dt, world, keys, {
      hover: hovering,
      hoverVel: hovering ? buildAssist.hoverVelocity(keys, player.yaw) : null,
      maxHoverY: groundY + 28,
      safeExit: buildAssist.safeExit,
      onSafeLand: () => {
        buildAssist.stopHover();
        ui.setBuildHud({ mode: buildAssist.mode, hovering: false, unlocked: buildAssist.isUnlocked() });
      },
      gateCheck: hovering
        ? (fx, fz, tx, tz) => buildAssist.canMoveTo(fx, fz, tx, tz, { blockedZone: hoverBlockedZone })
        : null,
      onGateBlocked: (r) => buildAssist.rejectMove(r.reason),
    });
    if (buildAssist.mode) {
      ui.setBuildHud({ mode: true, hovering: buildAssist.hovering, unlocked: buildAssist.isUnlocked() });
    }
    stats.addDistance(Math.hypot(player.pos.x - lastPos.x, player.pos.z - lastPos.y));
  }
  lastPos.set(player.pos.x, player.pos.z);

  if (playing && player) worldMap.pollPlayer(player);

  // Barrera lógica: sin portón abierto no se permanece en Región 2.
  if (playing && state && getRegionAt(player.pos.x, player.pos.z) === REGION_2 &&
      !regions.isGateOpened(REGION_2)) {
    const gate = findRegionalGate(player.pos.x, player.pos.z);
    if (gate) {
      const zx = gate.z - 4;
      teleportPlayer(gate.x + 0.5, world.surfaceY(gate.x, zx) + 1, zx + 0.5);
    }
  }
  // Barrera lógica Región 3: sin gate abierta se empuja al norte de la frontera.
  if (playing && state && getRegionAt(player.pos.x, player.pos.z) === REGION_3 &&
      !regions.isGateOpened(REGION_3)) {
    const gym2 = findMistGym(player.pos.x, player.pos.z);
    if (gym2) {
      const [hx, hz] = MIST_GYM_LAYOUT.exitHook;
      const zx = gym2.z + hz - 3;
      teleportPlayer(gym2.x + hx + 0.5, world.surfaceY(gym2.x + hx, zx) + 1, zx + 0.5);
    }
  }
  if (playing && state && getRegionAt(player.pos.x, player.pos.z) === REGION_4 &&
      !regions.isGateOpened(REGION_4) && !buildAssist.hovering) {
    const g3 = findForgeGym(player.pos.x, player.pos.z);
    if (g3) {
      const zx = g3.z + 12;
      teleportPlayer(g3.x + 0.5, world.surfaceY(g3.x, zx) + 1, zx + 0.5);
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

    worldMap.pollPlayer(player);
    refreshGaleLifts(px, pz);
    traversal.sync(px, pz);
    traversal.highlight = crafting.explorerActive();

    // Descubrimiento + registro de interactuables de estructura cercanos
    const wantedShrines = new Set();
    const wantedGym = new Set();
    const wantedGate = new Set();
    const wantedMist = new Set();
    const wantedRuin = new Set();
    const wantedWind = new Set();
    const wantedPc = new Set();
    const wantedSign = new Set();
    const wantedPickup = new Set();
    let nearGym = null;
    fogMistGym = null;
    for (const s of world.structures.near(px, pz, 32)) {
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
      if (s.type === "gym" || s.type === "gym_mist" || s.type === "gym_crimson" || s.type === "gym_gale" || s.type === "gym_tide") {
        nearGym = s;
        registerGymInteractables(s, wantedGym);
        if (s.type === "gym_mist") fogMistGym = s;
      }
      if (s.type === "regional_gate") {
        registerGateInteractables(s, wantedGate);
      }
      if (s.type === "mist_settlement") {
        registerMistInteractables(s, wantedMist);
        registerPcTerminal(s, MIST_SETTLEMENT_LAYOUT.pc, wantedPc);
      }
      if (s.type === "settlement") {
        registerPcTerminal(s, SETTLEMENT_LAYOUT.pc, wantedPc);
      }
      if (s.type === "cliff_outpost") {
        registerPcTerminal(s, CLIFF_OUTPOST_LAYOUT.pc, wantedPc);
      }
      if (s.type === "crimson_ruin") {
        registerRuinInteractables(s, wantedRuin);
      }
      if (s.type === "storm_observatory") {
        registerObservatoryInteractables(s, wantedWind);
      }
      if (s.type === "tempest_spire") {
        registerSpireInteractables(s, wantedWind);
      }
      if (s.type === "highland_exit") {
        registerHighlandInteractables(s, wantedWind);
      }
      if (s.type === "azure_port") {
        registerAzurePortInteractables(s, wantedPc);
      }
      if (s.type === "azure_lighthouse") {
        registerLighthouseInteractables(s, wantedWind);
      }
      if (s.type === "azure_port") {
        registerAzurePortInteractables(s, wantedPc);
      }
      if (s.type === "azure_lighthouse") {
        registerLighthouseInteractables(s, wantedWind);
      }
      if (s.type === "reef_atoll") {
        registerReefInteractables(s, wantedWind);
      }
      if (s.type === "tidal_bridge") {
        registerBridgeInteractables(s, wantedWind);
      }
      if (s.type === "gym_tide") {
        applyTideGymOpening(s);
        applyTideLeaderOpening(s);
        applyTideBasinVisuals(s);
      }
      if (s.type === "open_sea_gate") {
        registerSeaGateInteractables(s, wantedWind);
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
    for (const id of interaction.ids("crimson_seal")) {
      if (!wantedRuin.has(id)) interaction.unregister(id);
    }
    for (const id of interaction.ids("crimson_path")) {
      if (!wantedRuin.has(id)) interaction.unregister(id);
    }
    for (const id of interaction.ids("boss")) {
      if (!wantedRuin.has(id) && !wantedWind.has(id)) interaction.unregister(id);
    }
    for (const id of interaction.ids("storm_seal")) {
      if (!wantedWind.has(id)) interaction.unregister(id);
    }
    for (const id of interaction.ids("highland_exit")) {
      if (!wantedWind.has(id)) interaction.unregister(id);
    }
    for (const id of interaction.ids("pc")) {
      if (!wantedPc.has(id)) interaction.unregister(id);
    }
    registerSigns(px, pz, wantedSign);
    registerPickups(px, pz, wantedPickup);
    for (const id of interaction.ids("sign")) {
      if (!wantedSign.has(id)) interaction.unregister(id);
    }
    for (const id of interaction.ids("pickup")) {
      if (!wantedPickup.has(id)) interaction.unregister(id);
    }
    for (const id of interaction.ids("lighthouse_lens")) {
      if (!wantedWind.has(id)) interaction.unregister(id);
    }
    for (const id of interaction.ids("reef_seal")) {
      if (!wantedWind.has(id)) interaction.unregister(id);
    }
    for (const id of interaction.ids("tidal_bridge")) {
      if (!wantedWind.has(id)) interaction.unregister(id);
    }
    for (const id of interaction.ids("open_sea_gate")) {
      if (!wantedWind.has(id)) interaction.unregister(id);
    }
    if (![...wantedRuin].some((id) => id.startsWith("crimson_boss:"))) disposeBossVisual();
    if (![...wantedWind].some((id) => id.startsWith("tempest_boss:"))) disposeTempestVisual();
    if (![...wantedWind].some((id) => id.startsWith("reef_boss:"))) disposeReefVisual();
    refreshGymTracker(nearGym);

    // NPC de asentamientos: reconciliación por distancia, sin duplicados
    npcs.sync(px, pz);
  }

  world.update(player.pos.x, player.pos.z, 2);
  spawner.update(dt, player, dayFactor, elapsed);
  npcs.update(dt, player.pos, elapsed);
  if (bossVisual) animateCreatureVisual(bossVisual, elapsed, "idle", 0);
  if (tempestVisual) animateCreatureVisual(tempestVisual, elapsed, "idle", 0);
  if (reefVisual) animateCreatureVisual(reefVisual, elapsed, "idle", 0);

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
    ui.setInspectCard(null);
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
      const hideInspect = buildAssist.mode || mode !== "play";
      if (!hideInspect && c) {
        const m = c.entity.monster;
        dex.markSeen(m.speciesId, { source: "world", level: m.level });
        ui.setInspectCard({
          name: m.name,
          level: m.level,
          typeName: TYPES[m.type]?.name ?? m.type,
          caught: dex.isCaught(m.speciesId),
        });
      } else {
        ui.setInspectCard(null);
      }
    } else {
      highlight.visible = false;
      ui.setInspectCard(null);
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
  } else if (localStormAt(camera.position.x, camera.position.z)) {
    stormFlashT -= dt;
    if (stormFlashT <= 0) stormFlashT = 2.8 + Math.random() * 3.5;
    const flash = stormFlashT > 2.55 ? 0.45 : 0;
    scene.fog.near = 12;
    scene.fog.far = 72;
    scene.fog.color.lerp(new THREE.Color(0x6a88b0).lerp(new THREE.Color(0xe8f4ff), flash), 0.55);
  } else if (getRegionAt(camera.position.x, camera.position.z) === REGION_4) {
    const kit = crafting.explorerActive();
    scene.fog.near = kit ? 36 : 24;
    scene.fog.far = kit ? 170 : 130;
    scene.fog.color.lerp(new THREE.Color(0x8eb4d4), 0.35);
  } else if (getRegionAt(camera.position.x, camera.position.z) === REGION_3) {
    scene.fog.near = 28;
    scene.fog.far = 95;
    scene.fog.color.lerp(new THREE.Color(0x3a2818), 0.4);
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

  if (mode === "map") worldMap.draw();

  // Autoguardado
  saveTimer += dt;
  if (saveTimer > 8 && mode === "play") {
    saveTimer = 0;
    saveGame();
  }

  if (renderer) renderer.render(scene, camera);
}

window.addEventListener("beforeunload", saveGame);

// ---------- Inicio ----------

ui.showTitle(hasPersistedSave(), hasRecoverableBackup());
if (!renderer) {
  ui.setTitleError("Este navegador no pudo iniciar el gráfico 3D. Cierra otras pestañas de VoxelMon y recarga.");
}
if (window.__vmBoot) window.__vmBoot.hideStatus();
requestAnimationFrame(loop);

// Ganchos de depuración/pruebas (no afectan al juego)
window.__vm = {
  get world() { return world; },
  get player() { return player; },
  get spawner() { return spawner; },
  get state() { return state; },
  get mode() { return mode; },
  get locked() { return locked; },
  setLocked(v) { locked = !!v; },
  get ui() { return ui; },
  creatureInSight,
  startBattle,
  createMonster,
  gainXp,
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
  bossSystem: bosses,
  regionSystem: regions,
  craftingSystem: crafting,
  economySystem: economy,
  mapSystem: worldMap,
  traversalSystem: traversal,
  buildAssist,
  inventory,
  creatureStorage,
  dex,
  pickups,
  PARTY_MAX,
  toggleInventory,
  toggleDex,
  openPc,
  closePc,
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
    pause() { showPause(); },
    // ---- Fase 3 ----
    /** NPC actualmente activos (cercanos) */
    npcs() { return npcs.list(); },
    creatureArt() {
      const list = (spawner?.creatures ?? []).slice(0, 12).map((c) => ({
        ...creatureArtDebugSnapshot(c.group),
        dist: player ? Math.hypot(c.pos.x - player.pos.x, c.pos.z - player.pos.z) : null,
      }));
      return {
        preferred: getPreferredRenderer(),
        pixelSpecies: listPixelSpecies(),
        stylizedSpecies: listArtSpecies().filter((id) => getCreatureArt(id)?.renderer === "stylized3d"),
        cacheSize: textureCacheSize(),
        cache: inspectTextureCache(),
        geoCache: inspectGeometryCache(),
        matCache: inspectMaterialCache(),
        nearby: list,
        sample: list[0] ?? creatureArtDebugSnapshot(bossVisual),
        boss: bossVisual ? creatureArtDebugSnapshot(bossVisual) : null,
      };
    },
    setCreatureRenderer(mode) {
      const r = setPreferredRenderer(mode);
      const rebuilt = rebuildCreatureVisuals();
      return { preferred: r, rebuilt };
    },
    spawnSpecies(id, level = 8, at = null) {
      if (!spawner || !player || !world) return null;
      if (!SPECIES[id]) return { error: "unknown species", speciesId: id };
      const look = player.lookDir();
      const px = at?.x ?? (player.pos.x + look.x * 6);
      const pz = at?.z ?? (player.pos.z + look.z * 6);
      const c = new WildCreature(scene, id, level, px, pz, world);
      spawner.creatures.push(c);
      return {
        speciesId: id,
        renderer: c.group.userData.renderer,
        x: px, z: pz,
        height: c.group.userData.height,
        ...creatureArtDebugSnapshot(c.group),
      };
    },
    despawnAllWild() {
      if (!spawner) return 0;
      let n = 0;
      for (const c of [...spawner.creatures]) {
        c.remove();
        n++;
      }
      spawner.creatures.length = 0;
      return n;
    },
    previewVisual(id) {
      const g = buildCreatureVisual(id);
      const snap = creatureArtDebugSnapshot(g);
      disposeCreatureVisual(g);
      return snap;
    },
    previewCreature(id) {
      this.despawnAllWild();
      return this.spawnSpecies(id, 8);
    },
    dumpPortrait(id) {
      const icon = creatureArtIcon(id, false);
      return {
        speciesId: id,
        hasIcon: !!icon,
        icon: icon ?? null,
        resolved: resolveCreatureRenderer(id),
      };
    },
    measureMixedSpawn(n) {
      const ids = Object.keys(SPECIES);
      this.despawnAllWild();
      const t0 = performance.now();
      const spawned = [];
      for (let i = 0; i < n; i++) {
        spawned.push(this.spawnSpecies(ids[i % ids.length], 6));
      }
      const ms = performance.now() - t0;
      return {
        n, ms, per: ms / n,
        renderers: spawned.map((s) => s.renderer),
        geo: inspectGeometryCache(),
        mat: inspectMaterialCache(),
      };
    },
    artCatalog() {
      return Object.keys(SPECIES).map((id) => {
        const art = getCreatureArt(id);
        const sp = SPECIES[id];
        return {
          speciesId: id,
          name: sp?.name ?? id,
          stage: sp?.stage ?? null,
          type: sp?.type ?? null,
          renderer: art.renderer,
          resolved: resolveCreatureRenderer(id),
          scale: art.scale,
          profile: art.visual?.animationSet ?? null,
          effects: art.visual?.effects ?? [],
          concept: art.concept,
        };
      });
    },
    simulatePngFail(id) {
      const fallback = simulatePngLoadFailure(id);
      return { speciesId: id, fallback, cache: inspectTextureCache() };
    },
    rendererInfo() {
      const info = renderer.info;
      return {
        calls: info.render.calls,
        triangles: info.render.triangles,
        geometries: info.memory.geometries,
        textures: info.memory.textures,
      };
    },
    measureCreatureSpawn(n, speciesId = "emberin") {
      if (!spawner || !player) return null;
      const t0 = performance.now();
      const spawned = [];
      for (let i = 0; i < n; i++) {
        spawned.push(this.spawnSpecies(speciesId, 6));
      }
      const ms = performance.now() - t0;
      return {
        n,
        speciesId,
        ms,
        per: ms / n,
        cacheSize: textureCacheSize(),
        renderer: spawned[0]?.renderer ?? null,
        cache: inspectTextureCache(),
      };
    },
    /** Asentamientos cercanos (centro a menos de r bloques) */
    settlements(r = 400) {
      return world && player
        ? world.structures.near(player.pos.x, player.pos.z, r).filter((s) => s.type === "settlement")
        : [];
    },
    gotoSettlement() {
      const s = this.settlements(800)[0];
      if (!s || !player) return null;
      teleportPlayer(s.x + SETTLEMENT_LAYOUT.pc[0] + 0.5, s.y + 2, s.z + SETTLEMENT_LAYOUT.pc[1] + 1.5);
      return s;
    },
    gotoMistPc() {
      const s = findMistSettlement(player?.pos.x ?? 0, player?.pos.z ?? 0);
      if (!s || !player) return null;
      teleportPlayer(s.x + MIST_SETTLEMENT_LAYOUT.pc[0] + 0.5, s.y + 2, s.z + MIST_SETTLEMENT_LAYOUT.pc[1] + 1.5);
      return s;
    },
    gotoCliffPc() {
      const s = findCliffOutpost(player?.pos.x ?? 0, player?.pos.z ?? 0);
      if (!s || !player) return null;
      teleportPlayer(s.x + CLIFF_OUTPOST_LAYOUT.pc[0] + 0.5, s.y + 2, s.z + CLIFF_OUTPOST_LAYOUT.pc[1] + 1.5);
      return s;
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
        bossId: battle.boss?.id ?? null,
        enemy: { speciesId: battle.enemy.speciesId, level: battle.enemy.level, hp: battle.enemy.hp },
        queueLeft: battle.ctx.queue?.length ?? 0,
        banner: document.getElementById("battle-trainer")?.textContent ?? "",
      };
    },
    startBossBattle(id = "crimson_guardian") {
      startBossBattle(id);
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
          s.type === "ancient_outpost" || s.type === "mist_settlement" || s.type === "gym_mist" ||
          s.type === "mining_camp" || s.type === "crimson_ruin" || s.type === "gym_crimson");
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
          crimson_resonator_recipe_unlocked: progression.isUnlocked("crimson_resonator_recipe_unlocked"),
        },
        items: {
          balls: state.balls,
          mist_tonic: getItemCount(state, "mist_tonic"),
          explorer_kit: getItemCount(state, "explorer_kit"),
          ancient_core: getItemCount(state, "ancient_core"),
          crimson_resonator: getItemCount(state, "crimson_resonator"),
          ember_ore: getItemCount(state, "ember_ore"),
          red_crystal: getItemCount(state, "red_crystal"),
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
        { itemId: "ember_ore", amount: 6 },
        { itemId: "red_crystal", amount: 4 },
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
      progression.unlock("crimson_resonator_recipe_unlocked");
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
    region3() {
      if (!world || !player) return null;
      const gym = regions.homeGym() || regions.ensureHome();
      const b = gym ? region3BoundsFor(gym) : null;
      const camp = findMiningCamp(player.pos.x, player.pos.z);
      const ruin = findCrimsonRuin(player.pos.x, player.pos.z);
      const gym2 = findMistGym(player.pos.x, player.pos.z);
      const [hx, hz] = MIST_GYM_LAYOUT.exitHook;
      const hook = gym2 ? { x: gym2.x + hx, z: gym2.z + hz } : null;
      const hookBlock = gym2 ? world.getBlock(gym2.x + hx, gym2.y + 2, gym2.z + hz) : null;
      return {
        id: REGION_3,
        name: getRegionName(REGION_3),
        at: getRegionAt(player.pos.x, player.pos.z),
        bounds: b,
        gate: {
          unlocked: isMistExitOpen(),
          opened: regions.isGateOpened(REGION_3),
          hook,
          hookBlock,
        },
        miningCamp: camp,
        crimsonRuin: ruin,
        seal: ruin ? {
          x: ruin.x, z: ruin.z,
          block: world.getBlock(ruin.x, ruin.y + 2, ruin.z),
          clue: progression.isUnlocked("gym_3_clue_unlocked"),
          phase: bosses.sealPhase(),
          activated: bosses.isSealActivated(),
        } : null,
        discovered: !!state?.regions.discovered[REGION_3],
      };
    },
    shop() {
      return {
        ...economy.snapshot(),
        inventory: {
          balls: state?.balls,
          ember_ore: getItemCount(state, "ember_ore"),
          red_crystal: getItemCount(state, "red_crystal"),
          coal: getItemCount(state, "coal"),
          mist_tonic: getItemCount(state, "mist_tonic"),
          ancient_core: getItemCount(state, "ancient_core"),
        },
        catalog: PRICE_CATALOG,
        healCost: HEAL_COST,
      };
    },
    buy(id, n = 1) { const r = economy.buy(id, n); ui.refreshHud(); if (economy.open) economy.render(); return r; },
    sell(id, n = 1) { const r = economy.sell(id, n); ui.refreshHud(); if (economy.open) economy.render(); return r; },
    healCamp() { const r = economy.healParty(); ui.refreshHud(); return r; },
    gotoCamp() {
      const s = findMiningCamp(player?.pos.x ?? 0, player?.pos.z ?? 0);
      if (!s || !player || !world) return null;
      player.pos.set(s.x + 0.5, s.y + 2, s.z + 0.5);
      player.vel.set(0, 0, 0);
      return s;
    },
    gotoRuin() {
      const s = findCrimsonRuin(player?.pos.x ?? 0, player?.pos.z ?? 0);
      if (!s || !player || !world) return null;
      player.pos.set(s.x + 0.5, s.y + 2, s.z + 0.5);
      player.vel.set(0, 0, 0);
      return s;
    },
    unlockRegion3() {
      this.unlockGym2Clue();
      this.openGate();
      progression.addBadge("mist_badge");
      progression.unlock("second_gym_completed");
      progression.unlock("region_3_path_unlocked");
    },
    openRegion3Gate() {
      return tryOpenRegion3Gate({
        x: player?.pos.x ?? 0,
        z: player?.pos.z ?? 0,
      });
    },
    unlockGym3Clue() {
      this.unlockRegion3();
      this.openRegion3Gate();
      progression.unlock("gym_3_clue_unlocked");
    },
    crimsonBoss() {
      if (!world || !player) return null;
      const ruin = findCrimsonRuin(player.pos.x, player.pos.z);
      const def = BOSSES.crimson_guardian;
      const [bdx, bdz] = CRIMSON_RUIN_LAYOUT.boss;
      const [gdx, gdz] = CRIMSON_RUIN_LAYOUT.pathGate;
      return {
        boss: {
          id: def.id,
          name: def.name,
          level: def.team[0].level,
          speciesId: def.team[0].speciesId,
          defeated: bosses.isDefeated(def.id),
          canBattle: bosses.canBattle(def.id),
          coords: ruin ? { x: ruin.x + bdx, y: ruin.y + 1, z: ruin.z + bdz } : null,
          reward: def.rewardMoney,
          unlock: "gym_3_path_unlocked",
        },
        recipe: {
          id: "recipe_crimson_resonator",
          unlocked: progression.isUnlocked("crimson_resonator_recipe_unlocked"),
          can: crafting.canCraft("recipe_crimson_resonator"),
          have: {
            ember_ore: getItemCount(state, "ember_ore"),
            red_crystal: getItemCount(state, "red_crystal"),
            crystal_shard: getItemCount(state, "crystal_shard"),
            crimson_resonator: getItemCount(state, "crimson_resonator"),
          },
        },
        seal: {
          phase: bosses.sealPhase(),
          activated: bosses.isSealActivated(),
          coords: ruin ? { x: ruin.x, y: ruin.y + 2, z: ruin.z } : null,
          block: ruin ? world.getBlock(ruin.x, ruin.y + 2, ruin.z) : null,
        },
        path: {
          unlocked: progression.isUnlocked("gym_3_path_unlocked"),
          gate: ruin ? { x: ruin.x + gdx, z: ruin.z + gdz } : null,
          gateBlock: ruin ? world.getBlock(ruin.x + gdx, ruin.y + 2, ruin.z + gdz) : null,
        },
      };
    },
    gym3() {
      if (!world || !player) return null;
      const s = findForgeGym(player.pos.x, player.pos.z);
      const st = gyms.gymState("gym_crimson");
      const [hx, hz] = FORGE_GYM_LAYOUT.passHook;
      return {
        structure: s ? { id: s.id, x: s.x, y: s.y, z: s.z, biome: s.biome } : null,
        ...st,
        badge: progression.hasBadge("crimson_badge"),
        path: progression.isUnlocked("gym_3_path_unlocked"),
        nextArc: progression.isUnlocked("region_4_path_unlocked"),
        pass: s ? {
          x: s.x + hx, z: s.z + hz,
          block: world.getBlock(s.x + hx, s.y + 2, s.z + hz),
          open: isCrimsonPassOpen(),
        } : null,
        trainers: {
          pyra: trainers.isDefeated("gym_trainer_forge_1"),
          flint: trainers.isDefeated("gym_trainer_forge_2"),
          brann: trainers.isDefeated("leader_brann"),
        },
        leader: {
          id: "leader_brann",
          name: "Brann",
          team: TRAINERS.leader_brann.team,
          reward: TRAINERS.leader_brann.rewardMoney,
        },
      };
    },
    gotoGym3() {
      const s = findForgeGym(player?.pos.x ?? 0, player?.pos.z ?? 0);
      if (!s || !player || !world) return null;
      player.pos.set(s.x + 0.5, s.y + 2, s.z - 12.5);
      player.vel.set(0, 0, 0);
      return s;
    },
    unlockGym3Path() {
      this.unlockGym3Clue();
      progression.setFlag("crimson_seal_activated");
      bosses.ensureSeal().activated = true;
      bosses.ensure("crimson_guardian").defeated = true;
      progression.unlock("gym_3_path_unlocked");
    },
    activateSeal() {
      const r = bosses.activateSeal();
      const ruin = findCrimsonRuin(player?.pos.x ?? 0, player?.pos.z ?? 0);
      if (ruin) {
        applyCrimsonSeal(ruin);
        syncBossVisual(ruin);
      }
      ui.refreshHud();
      return r;
    },
    assignForge(cid) {
      const r = gyms.assignEnergy("gym_crimson", cid);
      const s = findForgeGym(player?.pos.x ?? 0, player?.pos.z ?? 0);
      if (s) applyForgeEnergyVisuals(s);
      return r;
    },
    recoverForge(cid) {
      const r = gyms.recoverEnergy("gym_crimson", cid);
      const s = findForgeGym(player?.pos.x ?? 0, player?.pos.z ?? 0);
      if (s) applyForgeEnergyVisuals(s);
      return r;
    },
    giveResonatorMats() {
      if (!state) return null;
      grantItems(state, [
        { itemId: "ember_ore", amount: 4 },
        { itemId: "red_crystal", amount: 4 },
        { itemId: "crystal_shard", amount: 2 },
      ]);
      ui.refreshHud();
      if (crafting.open) crafting.render();
      return this.crafting();
    },
    giveShopGoods() {
      if (!state) return null;
      grantItems(state, [
        { itemId: "coal", amount: 4 },
        { itemId: "copper", amount: 3 },
        { itemId: "iron", amount: 2 },
        { itemId: "mist_bloom", amount: 2 },
        { itemId: "ancient_fragment", amount: 1 },
        { itemId: "ember_ore", amount: 3 },
        { itemId: "red_crystal", amount: 1 },
        { itemId: "wind_crystal", amount: 2 },
        { itemId: "sky_herb", amount: 3 },
      ]);
      economy.grantMoney(200, { source: "debug" });
      ui.refreshHud();
      if (economy.open) economy.render();
      return this.shop();
    },
    region4() {
      if (!world || !player) return null;
      const gym = regions.homeGym() || regions.ensureHome();
      const b = gym ? region4BoundsFor(gym) : null;
      const pass = this.gym3()?.pass;
      return {
        name: getRegionName(REGION_4),
        at: getRegionAt(player.pos.x, player.pos.z),
        biome: world.biomeAt(player.pos.x, player.pos.z),
        bounds: b,
        gate: regions.isGateOpened(REGION_4),
        canOpen: canOpenRegion4Gate(),
        pathUnlock: progression.isUnlocked("region_4_path_unlocked"),
        gym4Clue: progression.isUnlocked("gym_4_clue_unlocked"),
        gym4Path: progression.isUnlocked("gym_4_path_unlocked"),
        fourthGym: progression.isUnlocked("fourth_gym_completed"),
        region5Path: progression.isUnlocked("region_5_path_unlocked"),
        aerial: progression.isUnlocked(AERIAL_UNLOCK),
        pass,
        shrine: findWindShrine(player.pos.x, player.pos.z),
        outpost: findCliffOutpost(player.pos.x, player.pos.z),
        observatory: findStormObservatory(player.pos.x, player.pos.z),
        heightBonus: world.region4BonusAt(player.pos.x, player.pos.z),
      };
    },
    gotoRegion4() {
      this.unlockGym3Path();
      progression.addBadge("crimson_badge");
      progression.unlock("third_gym_completed");
      progression.unlock("region_4_path_unlocked");
      const home = regions.homeGym() || regions.ensureHome();
      const g3 = home
        ? world.structures.candidate("gym_crimson", home.cellX, home.cellZ)
        : findForgeGym(player.pos.x, player.pos.z);
      if (g3) tryOpenRegion4Gate({ x: g3.x, z: g3.z });
      else tryOpenRegion4Gate({ x: player.pos.x, z: player.pos.z });
      if (!g3) return null;
      const destZ = g3.z + REGION_GEOMETRY.r4EntranceDz;
      teleportPlayer(g3.x + 0.5, world.surfaceY(g3.x, destZ) + 1, destZ);
      world.update(g3.x, destZ, 3);
      return this.region4();
    },
    gotoCliffOutpost() {
      const s = findCliffOutpost(player?.pos.x ?? 0, player?.pos.z ?? 0);
      if (!s) return null;
      teleportPlayer(s.x + 0.5, s.y + 1.2, s.z + 1.5);
      return s;
    },
    gotoWindShrine() {
      const s = findWindShrine(player?.pos.x ?? 0, player?.pos.z ?? 0);
      if (!s) return null;
      teleportPlayer(s.x + 1.5, s.y + 1.2, s.z + 1.5);
      return s;
    },
    gotoObservatory() {
      const s = findStormObservatory(player?.pos.x ?? 0, player?.pos.z ?? 0);
      if (!s) return null;
      applyStormSeal(s);
      teleportPlayer(s.x + 1.5, s.y + 1.2, s.z + 1.5);
      return s;
    },
    stormSeal() {
      const s = findStormObservatory(player?.pos.x ?? 0, player?.pos.z ?? 0);
      return {
        structure: s ? { id: s.id, x: s.x, y: s.y, z: s.z } : null,
        phase: bosses.sealPhase(STORM_SEAL_ID),
        activated: bosses.isSealActivated(STORM_SEAL_ID),
        clue: progression.isUnlocked("gym_4_clue_unlocked"),
        can: bosses.canActivateStormSeal(),
      };
    },
    activateStormSeal() {
      const r = bosses.activateStormSeal();
      const obs = findStormObservatory(player?.pos.x ?? 0, player?.pos.z ?? 0);
      if (obs) applyStormSeal(obs);
      const spire = findTempestSpire(player?.pos.x ?? 0, player?.pos.z ?? 0);
      if (spire) syncTempestVisual(spire);
      ui.refreshHud();
      return r;
    },
    tempest() {
      const s = findTempestSpire(player?.pos.x ?? 0, player?.pos.z ?? 0);
      const def = BOSSES.tempest_guardian;
      return {
        structure: s ? { id: s.id, x: s.x, y: s.y, z: s.z } : null,
        defeated: bosses.isDefeated("tempest_guardian"),
        can: bosses.canBattle("tempest_guardian"),
        seal: bosses.isSealActivated(STORM_SEAL_ID),
        path: progression.isUnlocked("gym_4_path_unlocked"),
        boss: def ? { id: def.id, name: def.name, speciesId: def.speciesId, level: def.team[0].level, reward: def.rewardMoney } : null,
      };
    },
    gotoSpire() {
      const s = findTempestSpire(player?.pos.x ?? 0, player?.pos.z ?? 0);
      if (!s) return null;
      teleportPlayer(s.x + 0.5, s.y + 1.4, s.z - 4.5);
      syncTempestVisual(s);
      return s;
    },
    gym4() {
      const s = findGaleGym(player?.pos.x ?? 0, player?.pos.z ?? 0);
      const st = gyms.gymState("gym_gale");
      return {
        structure: s ? { id: s.id, x: s.x, y: s.y, z: s.z, biome: s.biome } : null,
        ...st,
        badge: progression.hasBadge("gale_badge"),
        path: progression.isUnlocked("gym_4_path_unlocked"),
        nextArc: progression.isUnlocked("region_5_path_unlocked"),
        fourth: progression.isUnlocked("fourth_gym_completed"),
        trainers: {
          kaia: trainers.isDefeated("gym_trainer_gale_1"),
          orin: trainers.isDefeated("gym_trainer_gale_2"),
          zephra: trainers.isDefeated("leader_zephra"),
        },
        leader: {
          id: "leader_zephra",
          name: "Zephra",
          team: TRAINERS.leader_zephra.team,
          reward: TRAINERS.leader_zephra.rewardMoney,
        },
        hoverBlocked: s ? hoverBlockedZone(s.x, s.z) : null,
      };
    },
    gotoGym4() {
      const s = findGaleGym(player?.pos.x ?? 0, player?.pos.z ?? 0);
      if (!s || !player) return null;
      teleportPlayer(s.x + 0.5, s.y + 2, s.z - 13.5);
      return s;
    },
    unlockGym4Path() {
      progression.unlock("gym_4_clue_unlocked");
      bosses.ensureSeal(STORM_SEAL_ID).activated = true;
      bosses.ensure("tempest_guardian").defeated = true;
      progression.unlock("gym_4_path_unlocked");
      const g4 = findGaleGym(player?.pos.x ?? 0, player?.pos.z ?? 0);
      if (g4) applyGaleGymOpening(g4);
      return this.gym4();
    },
    activateChannel(id) {
      const r = gyms.activateChannel("gym_gale", id);
      const s = findGaleGym(player?.pos.x ?? 0, player?.pos.z ?? 0);
      if (s) {
        applyGaleChannelVisuals(s);
        applyGaleLeaderOpening(s);
      }
      return r;
    },
    highlandExit() {
      const s = findHighlandExit(player?.pos.x ?? 0, player?.pos.z ?? 0);
      const open = progression.isUnlocked("region_5_path_unlocked");
      if (s && open) applyHighlandExitOpening(s);
      return {
        structure: s ? { id: s.id, x: s.x, y: s.y, z: s.z } : null,
        unlocked: open,
        block: s ? world.getBlock(s.x, s.y + 2, s.z) : null,
      };
    },
    gotoHighlandExit() {
      const s = findHighlandExit(player?.pos.x ?? 0, player?.pos.z ?? 0);
      if (!s) return null;
      teleportPlayer(s.x + 0.5, s.y + 1.4, s.z - 3.5);
      return s;
    },
    region5() {
      if (!world || !player) return null;
      const gym = regions.homeGym() || regions.ensureHome();
      const b = gym ? region5BoundsFor(gym) : null;
      return {
        name: getRegionName(REGION_5),
        at: getRegionAt(player.pos.x, player.pos.z),
        biome: world.biomeAt(player.pos.x, player.pos.z),
        bounds: b,
        pathUnlock: progression.isUnlocked("region_5_path_unlocked"),
        gate: regions.isGateOpened(REGION_5),
        clue: progression.isUnlocked("gym_5_clue_unlocked"),
        lighthouse: progression.hasFlag("lighthouse_activated"),
        signal: progression.hasFlag("lighthouse_signal"),
        gym5path: progression.isUnlocked("gym_5_path_unlocked"),
        region6path: progression.isUnlocked("region_6_path_unlocked"),
        routes: routeSnapshot(),
        port: findAzure("azure_port", player.pos.x, player.pos.z),
        ruins: findAzure("tidal_ruins", player.pos.x, player.pos.z),
        lighthouseS: findAzure("azure_lighthouse", player.pos.x, player.pos.z),
        atoll: findAzure("reef_atoll", player.pos.x, player.pos.z),
        gym5: findAzure("gym_tide", player.pos.x, player.pos.z),
        seaGate: findAzure("open_sea_gate", player.pos.x, player.pos.z),
        pickups: pickups.snapshot(),
      };
    },
    gotoAzurePort() {
      const s = findAzure("azure_port", player?.pos.x ?? 0, player?.pos.z ?? 0);
      if (!s) return null;
      teleportPlayer(s.x + 0.5, s.y + 1.4, s.z - 8.5);
      return s;
    },
    gotoTidalRuins() {
      const s = findAzure("tidal_ruins", player?.pos.x ?? 0, player?.pos.z ?? 0);
      if (!s) return null;
      teleportPlayer(s.x + 0.5, s.y + 1.4, s.z - 11);
      return s;
    },
    gotoLighthouse() {
      const s = findAzure("azure_lighthouse", player?.pos.x ?? 0, player?.pos.z ?? 0);
      if (!s) return null;
      teleportPlayer(s.x + 0.5, s.y + 1.4, s.z - 6);
      applyLighthouseBeam(s);
      return s;
    },
    gotoLighthouseTop() {
      const s = findAzure("azure_lighthouse", player?.pos.x ?? 0, player?.pos.z ?? 0);
      if (!s) return null;
      teleportPlayer(s.x + 0.5, s.y + 15.2, s.z + 0.5);
      return s;
    },
    activateLighthouse() {
      const s = findAzure("azure_lighthouse", player?.pos.x ?? 0, player?.pos.z ?? 0);
      progression.setFlag("lighthouse_activated");
      if (s) applyLighthouseBeam(s);
      return { flag: progression.hasFlag("lighthouse_activated"), clue: progression.isUnlocked("gym_5_clue_unlocked") };
    },
    signalLighthouse() {
      progression.setFlag("lighthouse_activated");
      progression.unlock("gym_5_clue_unlocked");
      progression.setFlag("lighthouse_signal");
      const s = findAzure("azure_lighthouse", player?.pos.x ?? 0, player?.pos.z ?? 0);
      if (s) applyLighthouseBeam(s);
      return {
        flag: progression.hasFlag("lighthouse_activated"),
        clue: progression.isUnlocked("gym_5_clue_unlocked"),
        signal: progression.hasFlag("lighthouse_signal"),
      };
    },
    reef() {
      const s = findAzure("reef_atoll", player?.pos.x ?? 0, player?.pos.z ?? 0);
      const def = BOSSES.reef_guardian;
      return {
        structure: s ? { id: s.id, x: s.x, y: s.y, z: s.z } : null,
        defeated: bosses.isDefeated("reef_guardian"),
        can: bosses.canBattle("reef_guardian"),
        seal: bosses.isSealActivated(REEF_SEAL_ID),
        phase: bosses.sealPhase(REEF_SEAL_ID),
        path: progression.isUnlocked("gym_5_path_unlocked"),
        signal: progression.hasFlag("lighthouse_signal"),
        boss: def ? { id: def.id, name: def.name, speciesId: def.speciesId, level: def.team[0].level, reward: def.rewardMoney } : null,
      };
    },
    gotoReef() {
      const s = findAzure("reef_atoll", player?.pos.x ?? 0, player?.pos.z ?? 0);
      if (!s) return null;
      teleportPlayer(s.x + 0.5, s.y + 1.4, s.z - 8);
      applyReefSeal(s);
      syncReefVisual(s);
      return s;
    },
    activateReefSeal() {
      const r = bosses.activateReefSeal();
      const s = findAzure("reef_atoll", player?.pos.x ?? 0, player?.pos.z ?? 0);
      if (s) {
        applyReefSeal(s);
        syncReefVisual(s);
      }
      ui.refreshHud();
      return r;
    },
    gym5() {
      const s = findAzure("gym_tide", player?.pos.x ?? 0, player?.pos.z ?? 0);
      const st = gyms.gymState("gym_tide");
      return {
        structure: s ? { id: s.id, x: s.x, y: s.y, z: s.z, biome: s.biome } : null,
        ...st,
        badge: progression.hasBadge("tide_badge"),
        path: progression.isUnlocked("gym_5_path_unlocked"),
        nextArc: progression.isUnlocked("region_6_path_unlocked"),
        fifth: progression.isUnlocked("fifth_gym_completed"),
        trainers: {
          luma: trainers.isDefeated("gym_trainer_tide_1"),
          daro: trainers.isDefeated("gym_trainer_tide_2"),
          talassa: trainers.isDefeated("leader_talassa"),
        },
        leader: {
          id: "leader_talassa",
          name: "Talassa",
          team: TRAINERS.leader_talassa.team,
          reward: TRAINERS.leader_talassa.rewardMoney,
        },
        hoverBlocked: s ? hoverBlockedZone(s.x, s.z) : null,
      };
    },
    gotoGym5() {
      const s = findAzure("gym_tide", player?.pos.x ?? 0, player?.pos.z ?? 0);
      if (!s || !player) return null;
      teleportPlayer(s.x + 0.5, s.y + 2, s.z - 14.5);
      return s;
    },
    unlockGym5Path() {
      progression.setFlag("lighthouse_activated");
      progression.unlock("gym_5_clue_unlocked");
      progression.setFlag("lighthouse_signal");
      bosses.ensureSeal(REEF_SEAL_ID).activated = true;
      bosses.ensure("reef_guardian").defeated = true;
      progression.unlock("gym_5_path_unlocked");
      const br = findAzure("tidal_bridge", player?.pos.x ?? 0, player?.pos.z ?? 0);
      if (br) applyTidalBridgeOpening(br);
      const g5 = findAzure("gym_tide", player?.pos.x ?? 0, player?.pos.z ?? 0);
      if (g5) applyTideGymOpening(g5);
      return this.gym5();
    },
    cycleBasin(id) {
      const r = gyms.cycleBasin("gym_tide", id);
      const s = findAzure("gym_tide", player?.pos.x ?? 0, player?.pos.z ?? 0);
      if (s) {
        applyTideBasinVisuals(s);
        applyTideLeaderOpening(s);
      }
      return r;
    },
    seaGate() {
      const s = findAzure("open_sea_gate", player?.pos.x ?? 0, player?.pos.z ?? 0);
      const open = progression.isUnlocked("region_6_path_unlocked");
      if (s && open) applyOpenSeaGateOpening(s);
      return {
        structure: s ? { id: s.id, x: s.x, y: s.y, z: s.z } : null,
        unlocked: open,
        block: s ? world.getBlock(s.x, s.y + 2, s.z) : null,
      };
    },
    gotoSeaGate() {
      const s = findAzure("open_sea_gate", player?.pos.x ?? 0, player?.pos.z ?? 0);
      if (!s) return null;
      teleportPlayer(s.x + 0.5, s.y + 1.4, s.z - 4);
      return s;
    },
    unlockRegion5() {
      progression.addBadge("gale_badge");
      progression.unlock("fourth_gym_completed");
      progression.unlock("region_5_path_unlocked");
      // El atajo de debug no pasa por Gyms 1–4: sin estas gates la barrera
      // de R4 expulsa al jugador del arco en cada frame.
      regions.openGate(REGION_2, { x: 0, z: 0 });
      regions.openGate(REGION_3, { x: 0, z: 0 });
      regions.openGate(REGION_4, { x: 0, z: 0 });
      const s = findHighlandExit(player?.pos.x ?? 0, player?.pos.z ?? 0);
      if (s) applyHighlandExitOpening(s);
      regions.openGate(REGION_5, { x: s?.x ?? 0, z: s?.z ?? 0 });
      return this.region5();
    },
    collectPickup(id) {
      return pickups.collect(id);
    },
    giveCoastGoods() {
      grantItems(state, [
        { itemId: "coral_fragment", amount: 3 },
        { itemId: "tidal_pearl", amount: 1 },
        { itemId: "balls", amount: 5 },
      ]);
      ui.refreshHud();
      return { coral: inventory.count("coral_fragment"), pearl: inventory.count("tidal_pearl") };
    },
    hoverBlockedAt(x, z) {
      return hoverBlockedZone(x, z);
    },
    windLifts() {
      refreshGaleLifts(player?.pos.x ?? 0, player?.pos.z ?? 0);
      traversal.sync(player?.pos.x ?? 0, player?.pos.z ?? 0);
      return traversal.snapshot();
    },
    map() {
      worldMap.pollPlayer(player);
      return worldMap.snapshot();
    },
    revealMapRadius(n) {
      return worldMap.debugRevealRadius(n);
    },
    fillMapCells(n) {
      return worldMap.debugFillCells(n);
    },
    buildMode() {
      return buildAssist.snapshot();
    },
    aerialBuildAssist() {
      return {
        ...buildAssist.snapshot(),
        unlockId: AERIAL_UNLOCK,
      };
    },
    toggleBuildMode() {
      const on = buildAssist.toggleMode();
      ui.setBuildHud({ mode: on, hovering: buildAssist.hovering, unlocked: buildAssist.isUnlocked() });
      return buildAssist.snapshot();
    },
    grantAerial() {
      progression.unlock(AERIAL_UNLOCK);
      return this.aerialBuildAssist();
    },
    captureGrantor(id = "alazan") {
      if (!state) return null;
      dex.markCaught(id, { source: "debug" });
      events.emit("creatureCaptured", { speciesId: id, level: 20 });
      ui.refreshHud();
      return this.aerialBuildAssist();
    },
    inventory() {
      return inventory.snapshot();
    },
    dex() {
      return dex.snapshot();
    },
    storage() {
      return creatureStorage.snapshot();
    },
    markSeen(id) {
      return dex.markSeen(id, { source: "debug" });
    },
    markCaught(id) {
      return dex.markCaught(id, { source: "debug" });
    },
    giveCreature(id, level = 5) {
      if (!state) return null;
      const m = createMonster(id, level);
      const first = dex.markCaught(id, { source: "debug" });
      const { dest } = creatureStorage.receiveCapture(m);
      events.emit("creatureCaptured", {
        speciesId: id, uid: m.uid, dest, firstCaught: first, level, type: "wild",
      });
      ui.refreshHud();
      return { dest, uid: m.uid, speciesId: m.speciesId, level: m.level, first, hp: m.hp, xp: m.xp, snapshot: creatureStorage.snapshot() };
    },
    forceEvolve(uid, xp = 50000) {
      const found = creatureStorage.find(uid) ?? { monster: state.team[0], where: "party" };
      const m = found.monster;
      if (!m) return null;
      const evs = gainXp(m, xp);
      if (evs.some((e) => e.type === "evolve")) ui.onEvolve?.(m);
      ui.refreshHud();
      return { speciesId: m.speciesId, level: m.level, events: evs };
    },
    resumePlay() {
      if (mode === "battle") return mode;
      ui.hide(ui.el.pause);
      ui.hide?.(ui.el.dex);
      document.getElementById("inventory-ui")?.classList.add("hidden");
      document.getElementById("pc-ui")?.classList.add("hidden");
      document.getElementById("map-ui")?.classList.add("hidden");
      worldMap.hide?.();
      if (mode !== "play") mode = "play";
      locked = true;
      return mode;
    },
    openInventory() { toggleInventory(); return mode; },
    openDex() { toggleDex(); return mode; },
    openPc() { openPc(); return mode; },
    fillParty(n = 6) {
      const ids = ["emberin", "gotita", "semilla", "chispin", "piedrita", "plumin"];
      while (creatureStorage.partySize() < Math.min(PARTY_MAX, n)) {
        this.giveCreature(ids[creatureStorage.partySize() % ids.length], 8);
      }
      return creatureStorage.snapshot();
    },
    seedPc(n, id = "brisin") {
      const out = [];
      for (let i = 0; i < n; i++) out.push(this.giveCreature(id, 10 + (i % 20)));
      return { added: out.length, ...creatureStorage.snapshot() };
    },
    showInspect(info) {
      ui.setInspectCard(info);
      return !document.getElementById("inspect-card")?.classList.contains("hidden");
    },
    inspectNearest() {
      const c = spawner?.creatures?.[0];
      if (!c || c.dead) return { target: null };
      const m = c.monster;
      dex.markSeen(m.speciesId, { source: "world", level: m.level });
      ui.setInspectCard({
        name: m.name,
        level: m.level,
        typeName: TYPES[m.type]?.name ?? m.type,
        caught: dex.isCaught(m.speciesId),
      });
      return {
        speciesId: m.speciesId,
        name: m.name,
        level: m.level,
        type: m.type,
        typeName: TYPES[m.type]?.name ?? m.type,
        caught: dex.isCaught(m.speciesId),
      };
    },
    inspectAim() {
      const c = creatureInSight();
      if (!c) return { target: null, cardHidden: document.getElementById("inspect-card")?.classList.contains("hidden") };
      const m = c.entity.monster;
      dex.markSeen(m.speciesId, { source: "world", level: m.level });
      ui.setInspectCard({
        name: m.name,
        level: m.level,
        typeName: TYPES[m.type]?.name ?? m.type,
        caught: dex.isCaught(m.speciesId),
      });
      return {
        speciesId: m.speciesId,
        name: m.name,
        level: m.level,
        type: m.type,
        typeName: TYPES[m.type]?.name ?? m.type,
        caught: dex.isCaught(m.speciesId),
        dist: c.dist,
      };
    },
    pcTerminals() {
      return interaction.ids("pc").map((id) => {
        const it = interaction.items.get(id);
        return { id, x: it.x, y: it.y, z: it.z, prompt: it.prompt };
      });
    },
  },
};
