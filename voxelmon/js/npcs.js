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
import { economy } from "./economy.js";

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
  mist_gym_guide: {
    role: "mist_gym_guide",
    name: "Syl",
    dialogueId: "mist_gym_guide_intro",
    dialogueCompletedId: "mist_gym_guide_done",
    gymId: "gym_mist",
    colors: { skin: "#c9b8a0", outfit: "#3a3f58", accent: "#8fdcff" },
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
  craftsman: {
    role: "craftsman",
    name: "Talo",
    dialogueId: "craftsman_intro",
    colors: { skin: "#d4a074", outfit: "#8a5a32", accent: "#c8a060" },
    quests: ["quest_hands_on"],
  },
  herbalist: {
    role: "herbalist",
    name: "Mira",
    dialogueId: "herbalist_intro",
    colors: { skin: "#e0c098", outfit: "#4a7a48", accent: "#8fdc9a" },
    quests: ["quest_mist_remedy"],
  },
  regional_guide: {
    role: "regional_guide",
    name: "Eira",
    dialogueId: "regional_guide_intro",
    dialogueClueId: "regional_guide_clue",
    colors: { skin: "#c9b090", outfit: "#3a5a6e", accent: "#7ec8e8" },
    quests: ["quest_echo_past"],
  },
  regional_merchant: {
    role: "regional_merchant",
    name: "Kora",
    dialogueId: "regional_merchant_intro",
    colors: { skin: "#d8a070", outfit: "#8a3028", accent: "#e0a040" },
    quests: [],
  },
  prospector: {
    role: "prospector",
    name: "Bren",
    dialogueId: "prospector_intro",
    colors: { skin: "#c09068", outfit: "#4a3a32", accent: "#d07030" },
    quests: ["quest_mining_post"],
  },
  field_medic: {
    role: "field_medic",
    name: "Ysol",
    dialogueId: "field_medic_intro",
    colors: { skin: "#e8c4a8", outfit: "#7a3030", accent: "#f0c070" },
    quests: [],
  },
  crimson_gym_guide: {
    role: "crimson_gym_guide",
    name: "Rhed",
    dialogueId: "crimson_gym_guide_intro",
    dialogueCompletedId: "crimson_gym_guide_done",
    gymId: "gym_crimson",
    colors: { skin: "#c89060", outfit: "#6a2018", accent: "#ff7040" },
    quests: [],
  },
  wind_scout: {
    role: "wind_scout",
    name: "Nera",
    dialogueId: "wind_scout_intro",
    colors: { skin: "#e0c8a8", outfit: "#4a6a88", accent: "#c8e8ff" },
    quests: ["quest_wind_highlands"],
  },
  highland_merchant: {
    role: "highland_merchant",
    name: "Siro",
    dialogueId: "highland_merchant_intro",
    colors: { skin: "#d0a878", outfit: "#3a5a70", accent: "#e8d080" },
    quests: [],
  },
  storm_researcher: {
    role: "storm_researcher",
    name: "Vela",
    dialogueId: "storm_researcher_intro",
    colors: { skin: "#c8b8d0", outfit: "#2a4060", accent: "#90e0ff" },
    quests: ["quest_storm_eyes"],
  },
  gale_gym_guide: {
    role: "gale_gym_guide",
    name: "Aira",
    dialogueId: "gale_gym_guide_intro",
    dialogueCompletedId: "gale_gym_guide_done",
    gymId: "gym_gale",
    colors: { skin: "#e8d8c8", outfit: "#3a6088", accent: "#90e0ff" },
    quests: [],
  },
  tide_gym_guide: {
    role: "tide_gym_guide",
    name: "Nami",
    dialogueId: "tide_gym_guide_intro",
    dialogueCompletedId: "tide_gym_guide_done",
    gymId: "gym_tide",
    colors: { skin: "#e8d4c0", outfit: "#1a6878", accent: "#7ee8d8" },
    quests: [],
  },
  azure_guide: {
    role: "azure_guide",
    name: "Maris",
    dialogueId: "azure_guide_intro",
    dialogueCompletedId: "azure_guide_done",
    colors: { skin: "#e8d0b8", outfit: "#2a6a78", accent: "#7ee8d8" },
    quests: ["quest_azure_port"],
  },
  azure_healer: {
    role: "azure_healer",
    name: "Calla",
    dialogueId: "azure_healer_intro",
    dialogueCompletedId: "azure_healer_done",
    colors: { skin: "#f0d8c8", outfit: "#3dba9a", accent: "#b8fff0" },
    quests: [],
  },
  azure_merchant: {
    role: "azure_merchant",
    name: "Marea",
    dialogueId: "azure_merchant_intro",
    colors: { skin: "#d9a06a", outfit: "#3a5a70", accent: "#e0c060" },
    quests: [],
  },
  azure_researcher: {
    role: "azure_researcher",
    name: "Quill",
    dialogueId: "azure_researcher_intro",
    dialogueCompletedId: "azure_researcher_done",
    colors: { skin: "#c8b8d0", outfit: "#2a5060", accent: "#90e0ff" },
    quests: ["quest_ruin_echoes"],
  },
  sailor: {
    role: "sailor",
    name: "Bram",
    dialogueId: "azure_sailor_intro",
    dialogueCompletedId: "azure_sailor_done",
    colors: { skin: "#c89068", outfit: "#2a4060", accent: "#d0a040" },
    quests: [],
  },
  child_observer: {
    role: "child_observer",
    name: "Peb",
    dialogueId: "azure_child_intro",
    colors: { skin: "#e8c49a", outfit: "#4a8a78", accent: "#f0e080" },
    quests: [],
  },
  fisher: {
    role: "fisher",
    name: "Osa",
    dialogueId: "azure_fisher_intro",
    colors: { skin: "#d4a074", outfit: "#3a4a40", accent: "#8fdc9a" },
    quests: [],
  },
  traveler: {
    role: "traveler",
    name: "Kess",
    dialogueId: "azure_traveler_intro",
    colors: { skin: "#c9b090", outfit: "#5a3a48", accent: "#c8a060" },
    quests: [],
  },
  creature_keeper: {
    role: "creature_keeper",
    name: "Ryn",
    dialogueId: "azure_keeper_intro",
    colors: { skin: "#e0c098", outfit: "#3d7a68", accent: "#aef0c8" },
    quests: [],
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
      } else if (s.type === "gym" || s.type === "gym_mist" || s.type === "gym_crimson" || s.type === "gym_gale" || s.type === "gym_tide") {
        for (const a of gymAnchorsFor(s)) wanted.set(a.id, a);
      } else if (s.type === "regional_gate" || s.type === "mist_settlement" || s.type === "mining_camp" || s.type === "cliff_outpost") {
        for (const a of npcAnchorsFor(s)) wanted.set(a.id, a);
      } else if (s.type === "azure_port" || s.type === "tidal_ruins" || s.type === "coastal_gate" ||
                 s.type === "azure_bridge" || s.type === "azure_lighthouse") {
        for (const a of npcAnchorsFor(s)) wanted.set(a.id, a);
        for (const a of trainerAnchorsFor(s)) wanted.set(a.id, a);
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
      prompt: (anchor.role === "regional_merchant" || anchor.role === "highland_merchant" || anchor.role === "azure_merchant")
        ? "Comerciar"
        : (anchor.trainerId ? `Hablar con ${def.name} (entrenador)` : `Hablar con ${def.name}`),
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
    if (npc.role === "regional_merchant") {
      economy.show("Puesto de Kora");
      return;
    }
    let dialogueId = npc.def.dialogueId;
    if (npc.trainerId && npc.def.leader && gyms.isCompleted(npc.def.gymId) && npc.def.dialogueCompletedId) {
      dialogueId = npc.def.dialogueCompletedId;
    } else if (npc.trainerId && trainers.isDefeated(npc.trainerId) && !npc.def.repeatable) {
      dialogueId = npc.def.dialogueDefeatedId ?? dialogueId;
    } else if ((npc.role === "gym_guide" || npc.role === "mist_gym_guide" || npc.role === "crimson_gym_guide" || npc.role === "gale_gym_guide" || npc.role === "tide_gym_guide") && gyms.isCompleted(npc.def.gymId)) {
      dialogueId = npc.def.dialogueCompletedId ?? dialogueId;
    } else if ((npc.role === "azure_guide" || npc.role === "azure_healer" || npc.role === "azure_researcher" || npc.role === "sailor") && progression.isUnlocked("fifth_gym_completed")) {
      dialogueId = npc.def.dialogueCompletedId ?? dialogueId;
    } else if (npc.role === "gatekeeper") {
      if (regions.isGateOpened("region_2")) dialogueId = npc.def.dialogueOpenedId ?? dialogueId;
      else if (progression.isUnlocked("region_2_path_unlocked") || progression.hasBadge("verdant_badge")) {
        dialogueId = npc.def.dialogueUnlockId ?? dialogueId;
      }
    } else if (npc.role === "regional_guide" && progression.isUnlocked("gym_2_clue_unlocked")) {
      dialogueId = npc.def.dialogueClueId ?? dialogueId;
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
