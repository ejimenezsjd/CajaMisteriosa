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
import { Battle } from "./battle.js";
import { UI } from "./ui.js";
import { FAMILY_STARTERS, PERKS, activePerks, familyOf, createMonster } from "./data.js";
import { sfx, toggleMute } from "./audio.js";
import { events } from "./events.js";
import { SAVE_KEY, defaultState, loadSave, persistSave } from "./state.js";
import { progression } from "./progression.js";
import { stats } from "./stats.js";

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

let mode = "title"; // title | starter | play | battle | pause | dex | victory
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
let nearShrine = null; // santuario curativo a distancia de interacción
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
});
events.on("partyHealed", () => {
  ui.toast("✨ El santuario restaura por completo a tu equipo.", "good");
});
events.on("resourceCollected", ({ resourceId, amount }) => {
  const res = RESOURCES[resourceId];
  if (!res) return;
  const total = state?.inventory[res.block] ?? 0;
  ui.toast(`${res.icon} +${amount} ${res.name} (${total})`, "good");
});
events.on("badgeEarned", ({ id }) => {
  ui.toast(`🏅 ¡Insignia conseguida: ${id}!`, "legendary");
});

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
  if (mode !== "play") return;
  keys.add(e.code);
  if (e.code === "KeyE") {
    const c = creatureInSight();
    if (c) startBattle(c.entity);
    else if (nearShrine) useShrine(nearShrine);
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
  const wildInfo = { speciesId: wild.monster.speciesId, level: wild.monster.level };
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

    nearShrine = null;
    for (const s of world.structures.near(px, pz, 14)) {
      if (!state.stats.structuresDiscovered[s.id]) {
        events.emit("structureDiscovered", {
          structureId: s.id, structureType: s.type, biomeId: s.biome, x: s.x, y: s.y, z: s.z,
        });
      }
      if (s.type === "healing_shrine" &&
          Math.hypot(s.x + 0.5 - px, s.z + 0.5 - pz) <= 4.5 &&
          Math.abs(s.y - player.pos.y) < 6) {
        nearShrine = s;
      }
    }
  }

  world.update(player.pos.x, player.pos.z, 2);
  spawner.update(dt, player, dayFactor, elapsed);

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

    // Objetivo bajo el punto de mira
    if (playing && locked) {
      const c = creatureInSight();
      const blockHit = world.raycast(player.eyePos(), player.lookDir(), 6);
      if (c) {
        const m = c.entity.monster;
        ui.setTargetPrompt(`⚔ ${m.name} · Nv ${m.level} — clic izquierdo o E para desafiar`);
        highlight.visible = false;
      } else {
        if (blockHit) {
          highlight.position.set(blockHit.x + 0.5, blockHit.y + 0.5, blockHit.z + 0.5);
          highlight.visible = true;
        } else {
          highlight.visible = false;
        }
        ui.setTargetPrompt(nearShrine ? "✨ Santuario curativo — pulsa E para curar a tu equipo" : null);
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
    get nearShrine() { return nearShrine; },
    useShrine() { if (nearShrine) useShrine(nearShrine); },
    save() { saveGame(); },
  },
};
