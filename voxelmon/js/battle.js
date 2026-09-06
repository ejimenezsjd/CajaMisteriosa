/**
 * Combate por turnos en el propio mundo 3D: cámara cinematográfica orbitando
 * la arena, animaciones de embestida, captura con cubo-ball, XP y evolución.
 */

import * as THREE from "three";
import { SPECIES, movesFor, typeMultiplier, gainXp } from "./data.js";
import { buildCreatureModel, buildCubeBall, animateModel } from "./models.js";
import { sfx } from "./audio.js";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const nextFrame = () => new Promise((r) => requestAnimationFrame(r));

async function animate(dur, fn) {
  const t0 = performance.now();
  while (true) {
    const k = Math.min(1, (performance.now() - t0) / dur);
    fn(k);
    if (k >= 1) return;
    await nextFrame();
  }
}

const easeOut = (k) => 1 - (1 - k) * (1 - k);

export class Battle {
  /**
   * @param {object} o {scene, camera, world, player, wild, team, state, ui}
   * state: {balls} — se decrementa al lanzar cubos
   */
  constructor(o) {
    Object.assign(this, o);
    this.active = this.team.find((m) => m.hp > 0);
    this.enemy = this.wild.monster;
    this.allyModel = null;
    this.done = false;
    this.camT = 0;
  }

  setupArena() {
    this.wild.inBattle = true;
    this.wild.label.visible = false;

    const p = this.player.pos;
    const e = this.wild.pos;
    const dir = new THREE.Vector3(e.x - p.x, 0, e.z - p.z).normalize();
    if (dir.lengthSq() === 0) dir.set(0, 0, -1);

    // El aliado se coloca entre el jugador y el enemigo
    const ax = e.x - dir.x * 4.5;
    const az = e.z - dir.z * 4.5;
    this.allyPos = new THREE.Vector3(ax, this.world.surfaceY(ax, az) + 1, az);
    this.enemyPos = this.wild.pos.clone();
    this.mid = this.allyPos.clone().add(this.enemyPos).multiplyScalar(0.5);
    this.mid.y = Math.max(this.allyPos.y, this.enemyPos.y) + 1.2;

    this.spawnAllyModel();

    // Orienta enemigo y aliado cara a cara
    this.wild.yaw = Math.atan2(-(this.allyPos.x - this.enemyPos.x), -(this.allyPos.z - this.enemyPos.z));
    this.wild.syncTransform();
  }

  spawnAllyModel() {
    if (this.allyModel) {
      this.scene.remove(this.allyModel);
    }
    this.allyModel = buildCreatureModel(this.active.speciesId);
    this.allyModel.position.copy(this.allyPos);
    this.allyModel.rotation.y = Math.atan2(
      -(this.enemyPos.x - this.allyPos.x),
      -(this.enemyPos.z - this.allyPos.z)
    );
    this.scene.add(this.allyModel);
  }

  /** Llamado desde el bucle principal mientras dura la batalla */
  update(dt, t) {
    this.camT += dt;
    const r = 7.5;
    const a = this.camT * 0.12 + Math.PI / 2;
    const axis = new THREE.Vector3().subVectors(this.enemyPos, this.allyPos).normalize();
    const side = new THREE.Vector3(-axis.z, 0, axis.x);
    const camPos = this.mid.clone()
      .addScaledVector(side, Math.cos(a) * r)
      .addScaledVector(axis, Math.sin(a) * r * 0.45);
    camPos.y = this.mid.y + 2.6;
    // Evita meter la cámara bajo el terreno
    const ground = this.world.surfaceY(camPos.x, camPos.z) + 1.4;
    if (camPos.y < ground) camPos.y = ground;
    this.camera.position.lerp(camPos, Math.min(1, dt * 3));
    this.camera.lookAt(this.mid);

    if (this.allyModel) animateModel(this.allyModel, t, "idle", 0);
    animateModel(this.wild.group, t, "idle", 0);
  }

  damage(attacker, defender, move) {
    const mult = move.type ? typeMultiplier(move.type, defender.type) : 1;
    const rand = 0.85 + Math.random() * 0.3;
    const raw = attacker.atk * move.power * mult * rand - defender.def * 0.45;
    return { dmg: Math.max(1, Math.round(raw)), mult };
  }

  async lungeAttack(attackerModel, defenderModel) {
    const start = attackerModel.position.clone();
    const target = start.clone().lerp(defenderModel.position, 0.55);
    await animate(200, (k) => attackerModel.position.lerpVectors(start, target, easeOut(k)));
    // Impacto: rebote del defensor
    const s0 = defenderModel.scale.x;
    const baseY = defenderModel.position.y;
    await animate(140, (k) => {
      const s = s0 * (1 + Math.sin(k * Math.PI) * 0.18);
      defenderModel.scale.setScalar(s);
      defenderModel.position.y = baseY + Math.sin(k * Math.PI) * 0.15;
    });
    defenderModel.scale.setScalar(s0);
    defenderModel.position.y = baseY;
    await animate(180, (k) => attackerModel.position.lerpVectors(target, start, k));
    attackerModel.position.copy(start);
  }

  async doMove(attacker, defender, move, attackerModel, defenderModel, label) {
    this.ui.battleLog(`${label} usó ${move.name}.`);
    const { dmg, mult } = this.damage(attacker, defender, move);
    await this.lungeAttack(attackerModel, defenderModel);
    defender.hp = Math.max(0, defender.hp - dmg);
    if (mult >= 1.5) { sfx.superHit(); this.ui.battleLog("¡Es súper eficaz!"); }
    else if (mult <= 0.5) { sfx.weakHit(); this.ui.battleLog("No es muy eficaz…"); }
    else sfx.hit();
    this.ui.setBattleHp(this.active, this.enemy);
    await sleep(420);
  }

  enemyPickMove() {
    const moves = movesFor(this.enemy);
    if (Math.random() < 0.3) return moves[Math.floor(Math.random() * moves.length)];
    let best = moves[0];
    let bestScore = -1;
    for (const mv of moves) {
      const mult = mv.type ? typeMultiplier(mv.type, this.active.type) : 1;
      const score = mv.power * mult;
      if (score > bestScore) { bestScore = score; best = mv; }
    }
    return best;
  }

  async enemyTurn() {
    if (this.enemy.hp <= 0) return;
    const mv = this.enemyPickMove();
    await this.doMove(this.enemy, this.active, mv, this.wild.group, this.allyModel, `${this.enemy.name} salvaje`);
    if (this.active.hp <= 0) {
      sfx.faint();
      this.ui.battleLog(`¡${this.active.name} se debilitó!`);
      await animate(400, (k) => { this.allyModel.scale.setScalar(Math.max(0.01, 1 - k)); this.allyModel.rotation.z = k * 1.2; });
      await sleep(300);
      const next = this.team.find((m) => m.hp > 0);
      if (!next) return; // derrota total, se gestiona en run()
      this.active = next;
      this.ui.battleLog(`¡Adelante, ${next.name}!`);
      this.spawnAllyModel();
      this.ui.setBattleHp(this.active, this.enemy);
      await sleep(500);
    }
  }

  async tryCatch() {
    if (this.state.balls <= 0) {
      this.ui.battleLog("¡No te quedan cubos! Consíguelos ganando combates.");
      await sleep(700);
      return null;
    }
    this.state.balls -= 1;
    this.ui.refreshHud();
    this.ui.battleLog(`Lanzaste un cubo… (quedan ${this.state.balls})`);
    sfx.throw();

    const ball = buildCubeBall();
    this.scene.add(ball);
    const from = this.allyModel.position.clone().add(new THREE.Vector3(0, 1.6, 0));
    const to = this.wild.group.position.clone().add(new THREE.Vector3(0, 1, 0));
    await animate(500, (k) => {
      ball.position.lerpVectors(from, to, k);
      ball.position.y += Math.sin(k * Math.PI) * 2.2;
      ball.rotation.x = k * 9;
    });

    // La criatura se absorbe en el cubo
    const gScale = this.wild.group.scale.x;
    await animate(300, (k) => this.wild.group.scale.setScalar(gScale * (1 - k) + 0.01 * k));

    const sp = SPECIES[this.enemy.speciesId];
    const base = sp.legendary ? 0.3 : sp.stage === 1 ? 0.85 : sp.stage === 2 ? 0.6 : 0.42;
    const hpRatio = this.enemy.hp / this.enemy.maxHp;
    const chance = Math.min(0.95, Math.max(0.06, base * (1.15 - hpRatio)));

    let caught = true;
    const bounces = 3;
    for (let i = 0; i < bounces; i++) {
      sfx.bounce();
      await animate(380, (k) => { ball.position.y = to.y + Math.abs(Math.sin(k * Math.PI)) * (0.7 - i * 0.18); ball.rotation.y += 0.1; });
      if (Math.random() > Math.pow(chance, 1 / bounces)) { caught = false; break; }
    }

    if (caught) {
      sfx.catch();
      await animate(300, (k) => ball.scale.setScalar(1 + Math.sin(k * Math.PI) * 0.4));
      this.scene.remove(ball);
      this.ui.battleLog(`¡${this.enemy.name} fue capturado!`);
      await sleep(650);
      return "caught";
    }

    // Se escapa del cubo
    this.scene.remove(ball);
    sfx.escape();
    await animate(250, (k) => this.wild.group.scale.setScalar(0.01 + (gScale - 0.01) * k));
    this.wild.group.scale.setScalar(gScale);
    this.ui.battleLog(`¡${this.enemy.name} se liberó del cubo!`);
    await sleep(500);
    return "stay";
  }

  async grantXp() {
    const amount = 14 + this.enemy.level * 7 + (SPECIES[this.enemy.speciesId].legendary ? 120 : 0);
    this.ui.battleLog(`${this.active.name} ganó ${amount} XP.`);
    const events = gainXp(this.active, amount);
    for (const ev of events) {
      await sleep(500);
      if (ev.type === "level") {
        sfx.levelUp();
        this.ui.battleLog(`¡${this.active.name} subió al nivel ${ev.level}!`);
      } else if (ev.type === "evolve") {
        sfx.evolve();
        this.ui.battleLog(`✦ ¡${ev.fromName} está evolucionando…!`);
        await animate(900, (k) => {
          const s = 1 + Math.sin(k * Math.PI * 6) * 0.15;
          this.allyModel.scale.setScalar(s);
          this.allyModel.rotation.y += 0.15;
        });
        this.spawnAllyModel();
        this.ui.battleLog(`✦ ¡…se convirtió en ${ev.toName}!`);
        this.ui.onEvolve?.(this.active);
        await sleep(700);
      }
      this.ui.setBattleHp(this.active, this.enemy);
    }
  }

  /** Bucle principal de la batalla. Devuelve "win"|"caught"|"fled"|"lost" */
  async run() {
    this.setupArena();
    sfx.battleStart();
    this.ui.showBattle(this.active, this.enemy);
    const spName = SPECIES[this.enemy.speciesId];
    this.ui.battleLog(spName.legendary
      ? `⚡ ¡El legendario ${this.enemy.name} bloquea tu camino!`
      : `¡Un ${this.enemy.name} salvaje (Nv ${this.enemy.level}) apareció!`);
    await sleep(800);

    while (true) {
      const action = await this.ui.promptBattleAction(this);

      if (action.kind === "flee") {
        const chance = Math.min(0.95, Math.max(0.3, 0.55 + (this.active.spd - this.enemy.spd) * 0.03));
        if (Math.random() < chance) {
          sfx.escape();
          this.ui.battleLog("¡Escapaste sin problemas!");
          await sleep(650);
          return this.finish("fled");
        }
        this.ui.battleLog("¡No lograste escapar!");
        await sleep(450);
        await this.enemyTurn();
        if (this.teamWiped()) return this.finish("lost");
        continue;
      }

      if (action.kind === "switch") {
        this.active = action.monster;
        this.ui.battleLog(`¡Adelante, ${this.active.name}!`);
        this.spawnAllyModel();
        this.ui.setBattleHp(this.active, this.enemy);
        await sleep(450);
        await this.enemyTurn();
        if (this.teamWiped()) return this.finish("lost");
        continue;
      }

      if (action.kind === "ball") {
        const res = await this.tryCatch();
        if (res === "caught") return this.finish("caught");
        if (res === "stay") {
          await this.enemyTurn();
          if (this.teamWiped()) return this.finish("lost");
        }
        continue;
      }

      // Ataque
      const move = action.move;
      const allyFirst = this.active.spd >= this.enemy.spd;
      const acts = allyFirst ? ["ally", "enemy"] : ["enemy", "ally"];
      for (const who of acts) {
        if (who === "ally") {
          if (this.active.hp <= 0) continue;
          await this.doMove(this.active, this.enemy, move, this.allyModel, this.wild.group, this.active.name);
          if (this.enemy.hp <= 0) {
            sfx.faint();
            this.ui.battleLog(`¡El ${this.enemy.name} salvaje se debilitó!`);
            await animate(450, (k) => {
              this.wild.group.scale.setScalar(Math.max(0.01, this.wild.group.scale.x * (1 - k * 0.2)));
              this.wild.group.position.y -= k * 0.02;
              this.wild.group.rotation.z = k * 1.3;
            });
            this.state.balls += 2;
            this.ui.battleLog("Recuperaste 2 cubos del combate.");
            await this.grantXp();
            await sleep(600);
            return this.finish("win");
          }
        } else {
          await this.enemyTurn();
          if (this.teamWiped()) return this.finish("lost");
          if (this.active.hp <= 0) break; // ya cambió en enemyTurn
        }
      }
    }
  }

  teamWiped() {
    return this.team.every((m) => m.hp <= 0);
  }

  finish(result) {
    this.done = true;
    if (this.allyModel) {
      this.scene.remove(this.allyModel);
      this.allyModel = null;
    }
    this.wild.inBattle = false;
    this.wild.label.visible = true;
    this.ui.hideBattle();
    return result;
  }
}
