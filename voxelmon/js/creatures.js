/** Criaturas salvajes: spawner por bioma/hora, IA de deambulación y etiquetas */

import * as THREE from "three";
import { SPECIES, FAMILY_STARTERS, createMonster } from "./data.js";
import { buildCreatureModel, animateModel } from "./models.js";
import { WATER_Y } from "./world.js";
import { events } from "./events.js";

function makeLabel(text, color = "#ffffff") {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  ctx.font = "bold 30px 'Figtree', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "rgba(10,12,20,0.55)";
  const w = ctx.measureText(text).width + 26;
  ctx.beginPath();
  ctx.roundRect((256 - w) / 2, 8, w, 48, 12);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.fillText(text, 128, 34);
  const tex = new THREE.CanvasTexture(canvas);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: true, transparent: true }));
  sprite.scale.set(2.6, 0.65, 1);
  return sprite;
}

export class WildCreature {
  constructor(scene, speciesId, level, x, z, world) {
    this.scene = scene;
    this.monster = createMonster(speciesId, level);
    this.sp = SPECIES[speciesId];
    this.flies = this.sp.type === "volador" || this.sp.legendary;
    this.group = buildCreatureModel(speciesId);
    this.group.userData.entity = this;
    this.pos = new THREE.Vector3(x, world.surfaceY(x, z) + 1, z);
    this.yaw = Math.random() * Math.PI * 2;
    this.speed = 1.1 + Math.random() * 0.6;
    this.timer = 0;
    this.moving = false;
    this.dead = false;
    this.inBattle = false;

    const label = makeLabel(`${this.sp.name} · Nv ${level}`, this.sp.legendary ? "#9fe8ff" : "#ffffff");
    label.position.y = this.group.userData.height + 0.5;
    this.group.add(label);
    this.label = label;

    scene.add(this.group);
    this.syncTransform();
  }

  syncTransform() {
    const hover = this.flies ? 1.4 + Math.sin(performance.now() * 0.002 + this.yaw) * 0.25 : 0;
    this.group.position.set(this.pos.x, this.pos.y + hover, this.pos.z);
    this.group.rotation.y = this.yaw;
  }

  update(dt, world, t) {
    if (this.dead || this.inBattle) return;
    this.timer -= dt;
    if (this.timer <= 0) {
      this.moving = Math.random() < 0.75;
      this.yaw = Math.random() * Math.PI * 2;
      this.timer = 1.5 + Math.random() * 3.5;
    }

    if (this.moving) {
      const dx = -Math.sin(this.yaw) * this.speed * dt;
      const dz = -Math.cos(this.yaw) * this.speed * dt;
      const nx = this.pos.x + dx;
      const nz = this.pos.z + dz;
      const groundY = world.surfaceY(nx, nz) + 1;
      const stepUp = groundY - this.pos.y;
      const intoWater = groundY <= WATER_Y + 1 && world.isWater(nx, groundY - 0.5, nz);
      if (!this.flies && (stepUp > 1.4 || intoWater)) {
        this.yaw += Math.PI * (0.6 + Math.random() * 0.8);
        this.timer = Math.min(this.timer, 0.6);
      } else {
        this.pos.x = nx;
        this.pos.z = nz;
        this.pos.y += (groundY - this.pos.y) * Math.min(1, 10 * dt);
      }
    } else {
      const groundY = world.surfaceY(this.pos.x, this.pos.z) + 1;
      this.pos.y += (groundY - this.pos.y) * Math.min(1, 10 * dt);
    }

    animateModel(this.group, t + this.speed * 10, this.moving ? "walk" : "idle", this.speed / 1.7);
    this.syncTransform();
  }

  remove() {
    this.dead = true;
    this.scene.remove(this.group);
    this.group.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        if (o.material.map) o.material.map.dispose();
        o.material.dispose();
      }
    });
  }
}

export class Spawner {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.creatures = [];
    this.targetCount = 13;
    this.cooldown = 0;
  }

  /** dayFactor: 1 = mediodía, 0 = medianoche */
  pickSpecies(dist, dayFactor) {
    const weights = FAMILY_STARTERS.map((fam) => {
      const type = SPECIES[fam].type;
      let w = 1;
      if (type === "sombra") w = 0.5 + (1 - dayFactor) * 2.2;
      if (type === "luz") w = 0.5 + dayFactor * 1.6;
      return { fam, w };
    });
    const total = weights.reduce((s, e) => s + e.w, 0);
    let r = Math.random() * total;
    let fam = weights[0].fam;
    for (const e of weights) {
      r -= e.w;
      if (r <= 0) { fam = e.fam; break; }
    }
    // Etapas superiores lejos del origen del mundo
    let id = fam;
    if (dist > 150 && Math.random() < 0.32) id = SPECIES[id].evolvesTo ?? id;
    if (dist > 320 && Math.random() < 0.3) id = SPECIES[id].evolvesTo ?? id;
    return id;
  }

  update(dt, player, dayFactor, t) {
    this.cooldown -= dt;

    for (const c of this.creatures) c.update(dt, this.world, t);

    // Despawn lejano
    for (let i = this.creatures.length - 1; i >= 0; i--) {
      const c = this.creatures[i];
      if (c.dead) {
        this.creatures.splice(i, 1);
        continue;
      }
      if (!c.sp.legendary && !c.inBattle && c.pos.distanceTo(player.pos) > 90) {
        c.remove();
        this.creatures.splice(i, 1);
      }
    }

    if (this.cooldown <= 0 && this.creatures.length < this.targetCount) {
      this.cooldown = 0.8;
      const a = Math.random() * Math.PI * 2;
      const d = 26 + Math.random() * 30;
      const x = player.pos.x + Math.cos(a) * d;
      const z = player.pos.z + Math.sin(a) * d;
      const y = this.world.surfaceY(x, z);
      if (y <= WATER_Y) return; // no spawnear en agua
      const distOrigin = Math.hypot(x, z);
      const id = this.pickSpecies(distOrigin, dayFactor);
      const level = Math.max(1, Math.min(15,
        1 + Math.floor(distOrigin / 55) + Math.floor(Math.random() * 3) + (SPECIES[id].stage - 1) * 2));
      this.creatures.push(new WildCreature(this.scene, id, level, x, z, this.world));
      events.emit("creatureSpawned", { speciesId: id, level });
    }
  }

  spawnLegendary(player, world) {
    const a = Math.random() * Math.PI * 2;
    let x = player.pos.x + Math.cos(a) * 14;
    let z = player.pos.z + Math.sin(a) * 14;
    if (world.surfaceY(x, z) <= WATER_Y) { x = player.pos.x; z = player.pos.z + 10; }
    const c = new WildCreature(this.scene, "prismaton", 18, x, z, world);
    this.creatures.push(c);
    return c;
  }

  removeCreature(c) {
    c.remove();
    const i = this.creatures.indexOf(c);
    if (i >= 0) this.creatures.splice(i, 1);
  }
}
