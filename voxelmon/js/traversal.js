/**
 * TraversalSystem (Fase 11): corrientes ascendentes y fuerzas de entorno.
 *
 * Reusable: no conoce la narrativa de Región 4. Las estructuras y anclas
 * registran volúmenes `wind_lift`; Player aplica envForce.
 *
 * `traversalUsed` se emite UNA vez al entrar en un volumen, no cada frame.
 */

import { events } from "./events.js";
import { getRegionAt, REGION_GEOMETRY, nearestGymAnchor, REGION_4 } from "./regions.js";

const BOOST_Y = 9.2;
const HORIZ = 2.4;

class TraversalSystem {
  constructor() {
    this.lifts = [];
    this.inside = new Set();
    this.world = null;
    this.highlight = false;
  }

  attach(world) {
    this.world = world;
    this.lifts = [];
    this.inside.clear();
  }

  /** Volúmenes deterministas cerca del jugador (anclas regionales + estructuras). */
  sync(px, pz) {
    const gym = nearestGymAnchor(px, pz);
    const next = [];
    if (gym) {
      const g = REGION_GEOMETRY;
      const add = (id, dx, dz, r = 2.2, h = 14) => {
        const x = gym.x + dx;
        const z = gym.z + dz;
        if (Math.hypot(x - px, z - pz) > 90) return;
        const y = this.world ? this.world.surfaceY(x, z) : 20;
        next.push({
          id,
          type: "wind_lift",
          x: x + 0.5,
          y,
          z: z + 0.5,
          radius: r,
          height: h,
          regionId: getRegionAt(x, z),
        });
      };
      add("wind_shrine:lift", g.windShrine.dx, g.windShrine.dz, 2.6, 16);
      add("cliff_outpost:lift", g.cliffOutpost.dx, g.cliffOutpost.dz + 6, 2.2, 14);
      add("storm_observatory:lift", g.stormObservatory.dx, g.stormObservatory.dz, 2.8, 18);
      add("region_4:lift_a", g.windLiftA.dx, g.windLiftA.dz, 2.4, 16);
      add("region_4:lift_b", g.windLiftB.dx, g.windLiftB.dz, 2.4, 16);
    }
    this.lifts = next;
  }

  liftAt(x, y, z) {
    for (const lift of this.lifts) {
      if (Math.hypot(x - lift.x, z - lift.z) > lift.radius) continue;
      if (y < lift.y - 1 || y > lift.y + lift.height) continue;
      return lift;
    }
    return null;
  }

  /**
   * Devuelve la fuerza de entorno para este frame y emite traversalUsed
   * al entrar. { x, y, z } o null.
   */
  sample(player) {
    const lift = this.liftAt(player.pos.x, player.pos.y, player.pos.z);
    const now = new Set();
    if (!lift) {
      this.inside = now;
      return null;
    }
    now.add(lift.id);
    if (!this.inside.has(lift.id)) {
      events.emit("traversalUsed", {
        traversalId: lift.id,
        traversalType: lift.type,
        regionId: lift.regionId ?? getRegionAt(player.pos.x, player.pos.z),
        x: player.pos.x,
        y: player.pos.y,
        z: player.pos.z,
      });
    }
    this.inside = now;
    const cx = (lift.x - player.pos.x) * 0.35;
    const cz = (lift.z - player.pos.z) * 0.35;
    const top = lift.y + lift.height - 1.2;
    const yBoost = player.pos.y >= top ? 1.2 : BOOST_Y;
    return { x: cx * HORIZ, y: yBoost, z: cz * HORIZ, lift };
  }

  snapshot() {
    return {
      count: this.lifts.length,
      lifts: this.lifts.map((l) => ({ ...l })),
      inside: [...this.inside],
      region4: this.lifts.filter((l) => l.regionId === REGION_4).length,
    };
  }
}

export const traversal = new TraversalSystem();
