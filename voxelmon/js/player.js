/** Jugador en primera persona: física AABB contra vóxeles, salto, nado y sprint */

import * as THREE from "three";

const WIDTH = 0.6;
const HEIGHT_P = 1.8;
export const EYE = 1.62;

const GRAVITY = -26;
const JUMP_V = 8.6;
const WALK = 4.5;
const SPRINT = 7.2;
const SWIM = 3.0;

export class Player {
  constructor(x, y, z) {
    this.pos = new THREE.Vector3(x, y, z); // pies
    this.vel = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = 0;
    this.onGround = false;
    this.inWater = false;
  }

  eyePos() {
    return new THREE.Vector3(this.pos.x, this.pos.y + EYE, this.pos.z);
  }

  lookDir() {
    const cp = Math.cos(this.pitch);
    return new THREE.Vector3(-Math.sin(this.yaw) * cp, Math.sin(this.pitch), -Math.cos(this.yaw) * cp).normalize();
  }

  onMouseMove(dx, dy) {
    this.yaw -= dx * 0.0024;
    this.pitch -= dy * 0.0024;
    const lim = Math.PI / 2 - 0.01;
    this.pitch = Math.max(-lim, Math.min(lim, this.pitch));
  }

  update(dt, world, keys) {
    dt = Math.min(dt, 0.05);

    const headIn = world.isWater(this.pos.x, this.pos.y + 1.2, this.pos.z);
    const feetIn = world.isWater(this.pos.x, this.pos.y + 0.3, this.pos.z);
    this.inWater = headIn || feetIn;

    // Dirección de movimiento en el plano según el yaw
    let fx = 0, fz = 0;
    if (keys.has("KeyW")) fz -= 1;
    if (keys.has("KeyS")) fz += 1;
    if (keys.has("KeyA")) fx -= 1;
    if (keys.has("KeyD")) fx += 1;
    const len = Math.hypot(fx, fz);
    let speed = this.inWater ? SWIM : keys.has("ShiftLeft") || keys.has("ShiftRight") ? SPRINT : WALK;
    if (len > 0) {
      fx /= len;
      fz /= len;
      const sin = Math.sin(this.yaw);
      const cos = Math.cos(this.yaw);
      const wx = fx * cos - fz * sin;
      const wz = fz * cos + fx * sin;
      const accel = this.onGround || this.inWater ? 40 : 12;
      this.vel.x += (wx * speed - this.vel.x) * Math.min(1, accel * dt);
      this.vel.z += (wz * speed - this.vel.z) * Math.min(1, accel * dt);
    } else {
      const damp = this.onGround ? 12 : this.inWater ? 6 : 1.2;
      this.vel.x -= this.vel.x * Math.min(1, damp * dt);
      this.vel.z -= this.vel.z * Math.min(1, damp * dt);
    }

    if (this.inWater) {
      this.vel.y += (GRAVITY * 0.18) * dt;
      this.vel.y *= 1 - Math.min(1, 3.2 * dt);
      if (keys.has("Space")) this.vel.y = Math.min(this.vel.y + 24 * dt, 3.4);
    } else {
      this.vel.y += GRAVITY * dt;
      if (keys.has("Space") && this.onGround) {
        this.vel.y = JUMP_V;
        this.onGround = false;
      }
    }
    this.vel.y = Math.max(this.vel.y, -42);

    this.moveAxis(world, this.vel.x * dt, 0, 0);
    this.moveAxis(world, 0, this.vel.y * dt, 0);
    this.moveAxis(world, 0, 0, this.vel.z * dt);
  }

  collides(world) {
    const h = WIDTH / 2;
    const x0 = Math.floor(this.pos.x - h);
    const x1 = Math.floor(this.pos.x + h);
    const y0 = Math.floor(this.pos.y);
    const y1 = Math.floor(this.pos.y + HEIGHT_P - 0.001);
    const z0 = Math.floor(this.pos.z - h);
    const z1 = Math.floor(this.pos.z + h);
    for (let y = y0; y <= y1; y++) {
      for (let z = z0; z <= z1; z++) {
        for (let x = x0; x <= x1; x++) {
          if (world.isSolid(x, y, z)) return true;
        }
      }
    }
    return false;
  }

  moveAxis(world, dx, dy, dz) {
    this.pos.x += dx;
    this.pos.y += dy;
    this.pos.z += dz;
    if (!this.collides(world)) {
      if (dy !== 0) this.onGround = false;
      return;
    }
    // Retrocede en pasos pequeños hasta salir de la colisión
    const steps = 8;
    const sx = dx / steps, sy = dy / steps, sz = dz / steps;
    for (let i = 0; i < steps && this.collides(world); i++) {
      this.pos.x -= sx;
      this.pos.y -= sy;
      this.pos.z -= sz;
    }
    if (dy < 0) {
      this.onGround = true;
      this.vel.y = 0;
    } else if (dy > 0) {
      this.vel.y = 0;
    }
    if (dx !== 0) this.vel.x = 0;
    if (dz !== 0) this.vel.z = 0;
  }

  /** true si el AABB del jugador ocupa el bloque (para no colocar dentro de uno mismo) */
  occupiesBlock(bx, by, bz) {
    const h = WIDTH / 2;
    return (
      bx + 1 > this.pos.x - h && bx < this.pos.x + h &&
      bz + 1 > this.pos.z - h && bz < this.pos.z + h &&
      by + 1 > this.pos.y && by < this.pos.y + HEIGHT_P
    );
  }
}
