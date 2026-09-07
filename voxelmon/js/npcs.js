/**
 * NPCSystem (Fase 3): NPC data-driven anclados a estructuras deterministas.
 *
 * Lifecycle sin duplicados:
 *  - La identidad de un NPC es determinista: `<structureId>:<role>`
 *    (p. ej. "settlement:3,-2:researcher").
 *  - `sync()` (llamado desde el sondeo periódico de main, no cada frame)
 *    consulta los asentamientos cercanos vía StructureIndex.near (cacheado),
 *    calcula el conjunto de NPC deseado y crea/destruye solo la diferencia.
 *    Al alejarse, el NPC se elimina; al volver, se recrea idéntico en su
 *    anchor. Nunca hay dos instancias con la misma identidad.
 *
 * En esta fase los NPC son estáticos: permanecen en su anchor, miran al
 * jugador cuando está cerca y tienen un balanceo idle sutil.
 */

import { makeLabel } from "./creatures.js";
import { buildNpcModel } from "./models.js";
import { npcAnchorsFor } from "./structures.js";
import { dialogue } from "./dialogue.js";
import { events } from "./events.js";
import { TRAINERS, trainerAnchorsFor, trainers } from "./trainers.js";
import { gymAnchorsFor, gyms } from "./gyms.js";
import { regions } from "./regions.js";
import { progression } from "./progression.js";

/** Definiciones data-driven de los NPC por rol */
export const NPC_DEFS = {
  researcher: {
    role: "researcher",
    name: "Alba",
    dialogueId: "researcher_intro",
    colors: { skin: "#e8b88a", outfit: "#3d6fb8", accent: "#2c3040" },
    quests: ["quest_apricorns"],
  },
  merchant: {
    role: "merchant",
    name: "Bruno",
    dialogueId: "merchant_intro",
    colors: { skin: "#d9a06a", outfit: "#8a5a2c", accent: "#c8a040" },
    quests: [],
  },
  healer: {
    role: "healer",
    name: "Sena",
    dialogueId: "healer_intro",
    colors: { skin: "#e8c49a", outfit: "#3dba7a", accent: "#aef0c8" },
    quests: [],
  },
  gym_guide: {
    role: "gym_guide",
    name: "Orla",
    dialogueId: "gym_guide_intro",
    dialogueCompletedId: "gym_guide_done",
    gymId: "gym_verdant",
    colors: { skin: "#e8c49a", outfit: "#2d6a44", accent: "#c8f0a8" },
    quests: [],
  },
  gatekeeper: {
    role: "gatekeeper",
    name: "Kael",
    dialogueId: "gatekeeper_closed",
    dialogueUnlockId: "gatekeeper_unlock",
    dialogueOpenedId: "gatekeeper_opened",
    colors: { skin: "#c9a078", outfit: "#3a3f52", accent: "#c4a646" },
    quests: ["quest_frontier"],
  },
};

const ACTIVATION_RADIUS = 90; // los asentamientos a menos de esto tienen NPC activos

class NPCSystem {
  constructor() {
    this.scene = null;
    this.world = null;
    this.interaction = null;
    this.active = new Map(); // npcId -> instancia
  }

  init(scene, world, interaction) {
    this.clear();
    this.scene = scene;
    this.world = world;
    this.interaction = interaction;
  }

  clear() {
    for (const id of [...this.active.keys()]) this.despawn(id);
  }

  /** Reconciliación por distancia: llamar desde el sondeo periódico */
  sync(px, pz) {
    if (!this.world) return;
    const wanted = new Map();
    for (const s of this.world.structures.near(px, pz, ACTIVATION_RADIUS)) {
      if (s.type === "settlement") {
        for (const a of npcAnchorsFor(s)) wanted.set(a.id, a);
        for (const a of trainerAnchorsFor(s)) wanted.set(a.id, a);
      } else if (s.type === "gym") {
        for (const a of gymAnchorsFor(s)) wanted.set(a.id, a);
      } else if (s.type === "regional_gate") {
        for (const a of npcAnchorsFor(s)) wanted.set(a.id, a);
      }
    }
    for (const id of [...this.active.keys()]) {
      if (!wanted.has(id)) this.despawn(id);
    }
    for (const [id, anchor] of wanted) {
      if (!this.active.has(id)) this.spawn(anchor);
    }
  }

  spawn(anchor) {
    const def = anchor.trainerId ? TRAINERS[anchor.trainerId] : NPC_DEFS[anchor.role];
    if (!def) return;
    const group = buildNpcModel(def);
    // Los anchors de interior (gimnasio) traen y explícita: surfaceY
    // devolvería el tejado y colocaría al NPC encima del edificio.
    const y = anchor.y ?? (this.world.surfaceY(anchor.x, anchor.z) + 1);
    group.position.set(anchor.x + 0.5, y, anchor.z + 0.5);

    const label = makeLabel(def.name, "#ffe9b0");
    label.position.y = group.userData.height + 0.35;
    group.add(label);
    this.scene.add(group);

    const npc = {
      id: anchor.id,
      role: anchor.role,
      def,
      trainerId: anchor.trainerId ?? null,
      structureId: anchor.structureId,
      group,
      baseY: y,
      yaw: Math.random() * Math.PI * 2, // orientación inicial (solo estética)
    };
    this.active.set(anchor.id, npc);

    this.interaction.register({
      id: `npc:${anchor.id}`,
      type: "npc",
      x: group.position.x,
      y: y + 1,
      z: group.position.z,
      range: 3.5,
      prompt: anchor.trainerId ? `Hablar con ${def.name} (entrenador)` : `Hablar con ${def.name}`,
      data: npc,
      onInteract: () => this.talk(npc),
    });
  }

  despawn(id) {
    const npc = this.active.get(id);
    if (!npc) return;
    this.active.delete(id);
    this.interaction.unregister(`npc:${id}`);
    this.scene.remove(npc.group);
    npc.group.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        if (o.material.map) o.material.map.dispose();
        o.material.dispose();
      }
    });
  }

  talk(npc) {
    if (dialogue.isOpen) return;
    events.emit("npcTalked", {
      npcId: npc.id,
      role: npc.role,
      name: npc.def.name,
      structureId: npc.structureId,
    });
    let dialogueId = npc.def.dialogueId;
    if (npc.trainerId && trainers.isDefeated(npc.trainerId) && !npc.def.repeatable) {
      dialogueId = npc.def.dialogueDefeatedId ?? dialogueId;
    } else if (npc.role === "gym_guide" && gyms.isCompleted(npc.def.gymId)) {
      dialogueId = npc.def.dialogueCompletedId ?? dialogueId;
    } else if (npc.role === "gatekeeper") {
      if (regions.isGateOpened("region_2")) dialogueId = npc.def.dialogueOpenedId ?? dialogueId;
      else if (progression.isUnlocked("region_2_path_unlocked") || progression.hasBadge("verdant_badge")) {
        dialogueId = npc.def.dialogueUnlockId ?? dialogueId;
      }
    }
    dialogue.start(dialogueId, { npc });
  }

  /** Animación ligera por frame: solo sobre los pocos NPC activos */
  update(dt, playerPos, t) {
    for (const npc of this.active.values()) {
      const dx = playerPos.x - npc.group.position.x;
      const dz = playerPos.z - npc.group.position.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 7) {
        // El modelo mira hacia -Z: forward = (-sin yaw, -cos yaw) = (dx,dz)/d
        const target = Math.atan2(-dx, -dz);
        let diff = target - npc.yaw;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        npc.yaw += diff * Math.min(1, 6 * dt);
      }
      npc.group.rotation.y = npc.yaw;
      npc.group.position.y = npc.baseY + Math.sin(t * 1.6 + npc.baseY) * 0.03;
    }
  }

  list() {
    return [...this.active.values()].map((n) => ({
      id: n.id,
      role: n.role,
      name: n.def.name,
      trainerId: n.trainerId,
      x: n.group.position.x,
      y: n.group.position.y,
      z: n.group.position.z,
      structureId: n.structureId,
    }));
  }
}

export const npcs = new NPCSystem();
