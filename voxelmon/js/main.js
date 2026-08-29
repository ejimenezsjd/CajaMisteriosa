/**
 * VoxelMon — mundo vóxel estilo Minecraft con captura y combate de criaturas.
 * Módulo principal: escena, bucle de juego, entrada, día/noche, batallas y guardado.
 */

import * as THREE from "three";
import { World, B, BLOCK_DROPS } from "./world.js";
import { Player } from "./player.js";
import { Spawner } from "./creatures.js";
import { Battle } from "./battle.js";
import { UI } from "./ui.js";
import { FAMILY_STARTERS, createMonster } from "./data.js";
import { sfx, toggleMute } from "./audio.js";

const SAVE_KEY = "voxelmon.save.v1";
const DAY_LENGTH = 300; // segundos por ciclo completo
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
const keys = new Set();
let selectedSlot = 0;
let dayTime = 0.3;
let regenTimer = 0;
let saveTimer = 0;
const particles = [];

function defaultState(seed) {
  return {
    seed,
    team: [],
    balls: 10,
    inventory: {},
    dex: { seen: {}, caught: {} },
    edits: {},
    dayTime: 0.3,
    pos: null,
    legendarySpawned: false,
    victoryShown: false,
  };
}

function saveGame() {
  if (!state || !player) return;
  state.edits = world.edits;
  state.dayTime = dayTime;
  state.pos = { x: player.pos.x, y: player.pos.y, z: player.pos.z, yaw: player.yaw, pitch: player.pitch };
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch { /* almacenamiento lleno o bloqueado: se ignora */ }
}

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
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

const raycaster = new THREE.Raycaster();

function creatureInSight(maxDist = 8) {
  if (!spawner?.creatures.length) return null;
  raycaster.setFromCamera({ x: 0, y: 0 }, camera);
  raycaster.far = maxDist;
  const groups = spawner.creatures.filter((c) => !c.dead).map((c) => c.group);
  const hits = raycaster.intersectObjects(groups, true);
  for (const hit of hits) {
    let o = hit.object;
    while (o && !o.userData.entity) o = o.parent;
    if (o?.userData.entity) return { entity: o.userData.entity, dist: hit.distance };
  }
  return null;
}

function onPrimary() {
  const c = creatureInSight();
  const blockHit = world.raycast(player.eyePos(), player.lookDir(), 6);
  if (c && (!blockHit || c.dist < blockHit.dist)) {
    startBattle(c.entity);
    return;
  }
  if (!blockHit) return;
  const { x, y, z, block } = blockHit;
  if (block === B.BEDROCK) {
    ui.toast("La roca madre es indestructible.");
    return;
  }
  world.setBlock(x, y, z, B.AIR);
  sfx.break();
  spawnBreakParticles(x, y, z, block);
  const drop = BLOCK_DROPS[block];
  if (drop) {
    state.inventory[drop] = (state.inventory[drop] ?? 0) + 1;
    ui.refreshHotbar(HOTBAR, state.inventory, selectedSlot);
  }
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
}

function spawnBreakParticles(x, y, z, block) {
  const colors = { [B.GRASS]: 0x5aa338, [B.DIRT]: 0x8a6642, [B.STONE]: 0x8d8d94, [B.SAND]: 0xe2d08f, [B.WOOD]: 0x7d5a30, [B.LEAVES]: 0x48a03c, [B.SNOW]: 0xeef2f5 };
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
  state.dex.seen[wild.monster.speciesId] = true;

  battle = new Battle({ scene, camera, world, player, wild, team: state.team, state, ui });
  ui.onEvolve = (m) => {
    state.dex.caught[m.speciesId] = true;
    state.dex.seen[m.speciesId] = true;
    ui.refreshHud();
  };
  const result = await battle.run();
  battle = null;

  if (result === "win") {
    spawner.removeCreature(wild);
  } else if (result === "caught") {
    spawner.removeCreature(wild);
    const m = wild.monster;
    state.dex.caught[m.speciesId] = true;
    if (state.team.length < 6) {
      state.team.push(m);
      ui.toast(`${m.name} se unió a tu equipo.`, "good");
    } else {
      ui.toast(`${m.name} fue enviado a la Caja (equipo lleno).`);
    }
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
    for (const m of state.team) m.hp = m.maxHp;
    player.pos.set(8.5, world.surfaceY(8.5, 8.5) + 2, 8.5);
    player.vel.set(0, 0, 0);
    ui.toast("Todo tu equipo cayó… Despiertas en el punto de origen, recuperado.", "bad");
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
const SKY_NIGHT = new THREE.Color(0x0a0e22);

function updateDayNight(dt) {
  dayTime = (dayTime + dt / DAY_LENGTH) % 1;
  const angle = dayTime * Math.PI * 2;
  const elev = Math.sin(angle); // >0 día
  const dayFactor = Math.max(0, Math.min(1, elev * 1.6));

  sun.position.set(Math.cos(angle) * 80, elev * 100, 30);
  sun.target.position.set(0, 0, 0);
  sun.intensity = 0.25 + dayFactor * 0.85;
  ambient.intensity = 0.22 + dayFactor * 0.42;

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
      if (c && (!blockHit || c.dist < blockHit.dist)) {
        const m = c.entity.monster;
        ui.setTargetPrompt(`⚔ ${m.name} · Nv ${m.level} — clic izquierdo para desafiar`);
        highlight.visible = false;
      } else if (blockHit) {
        highlight.position.set(blockHit.x + 0.5, blockHit.y + 0.5, blockHit.z + 0.5);
        highlight.visible = true;
        ui.setTargetPrompt(null);
      } else {
        highlight.visible = false;
        ui.setTargetPrompt(null);
      }
    } else {
      highlight.visible = false;
    }

    // Regeneración fuera de combate
    regenTimer += dt;
    if (regenTimer >= 2 && state) {
      regenTimer = 0;
      let changed = false;
      for (const m of state.team) {
        if (m.hp < m.maxHp) {
          m.hp = Math.min(m.maxHp, m.hp + Math.max(1, Math.round(m.maxHp * 0.02)));
          changed = true;
        }
      }
      if (changed) ui.refreshHud();
    }
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
