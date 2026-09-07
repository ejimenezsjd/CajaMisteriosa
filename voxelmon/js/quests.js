/**
 * QuestSystem mínimo data-driven (Fase 3).
 *
 * Estados por quest: locked (no está en ninguna lista) → available → active
 * → completed. La progresión de objetivos avanza EXCLUSIVAMENTE escuchando
 * el EventBus (los emisores no conocen este sistema) y persiste en
 * state.quests con SAVE_VERSION = 2 (fillDefaults rellena saves antiguos).
 *
 * Objetivos soportados (intérpretes genéricos, filtros opcionales):
 *   collectResource   ← resourceCollected  (resourceId)
 *   captureCreature   ← creatureCaptured   (speciesId opcional)
 *   discoverStructure ← structureDiscovered(structureType opcional)
 *   discoverBiome     ← biomeDiscovered    (biomeId opcional)
 *   talkToNPC         ← npcTalked          (role opcional)
 *   trade             ← tradeCompleted     (traderId opcional)
 *   mineBlock         ← blockMined         (block opcional)
 *
 * Idempotencia: una quest completada nunca vuelve a activarse ni a entregar
 * recompensas; complete() ignora quests ya completadas.
 *
 * Las recompensas se entregan mediante un handler inyectado por main
 * (setRewardHandler), manteniendo el sistema desacoplado de dinero/cubos.
 */

import { events } from "./events.js";

export const QUESTS = {
  quest_welcome: {
    id: "quest_welcome",
    title: "Bienvenida al asentamiento",
    description: "Se rumorea que hay un asentamiento cerca. Encuéntralo y habla con Alba, la investigadora.",
    autoStart: true,
    objectives: [
      { type: "talkToNPC", role: "researcher", amount: 1, label: "Habla con Alba, la investigadora" },
    ],
    rewards: { money: 20 },
    next: "quest_apricorns",
  },
  quest_apricorns: {
    id: "quest_apricorns",
    title: "Frutos del bosque",
    description: "Alba necesita apricornos para sus cubos experimentales. Crecen como arbustos naranjas en bosques y llanuras.",
    // Se acepta hablando con Alba (acción startQuest del diálogo)
    objectives: [
      { type: "collectResource", resourceId: "apricorn", amount: 3, label: "Recoge apricornos" },
    ],
    rewards: { money: 40 },
    next: "quest_trade",
  },
  quest_trade: {
    id: "quest_trade",
    title: "Primer intercambio",
    description: "Bruno, el comerciante, cambia apricornos por cubos de captura. Haz tu primer trato con él.",
    startOnAvailable: true,
    objectives: [
      { type: "trade", traderId: "merchant", amount: 1, label: "Cambia apricornos por un cubo con Bruno" },
    ],
    rewards: { money: 30 },
    next: "quest_capture",
  },
  quest_capture: {
    id: "quest_capture",
    title: "Compañero salvaje",
    description: "Estrena tus cubos: captura una criatura salvaje para tu equipo.",
    startOnAvailable: true,
    objectives: [
      { type: "captureCreature", amount: 1, label: "Captura una criatura" },
    ],
    rewards: { money: 60, balls: 3 },
    next: "quest_explorer",
  },
  quest_explorer: {
    id: "quest_explorer",
    title: "Explorador de ruinas",
    description: "Alba estudia las ruinas antiguas. Encuentra unas y quedarán registradas para su investigación.",
    startOnAvailable: true,
    objectives: [
      { type: "discoverStructure", structureType: "ruin", amount: 1, label: "Descubre unas ruinas" },
    ],
    rewards: { money: 80, badge: "explorador", unlock: "intro_questline_completed" },
    next: "quest_first_challenge",
  },

  // ---------- Fase 4: camino del entrenador ----------

  quest_first_challenge: {
    id: "quest_first_challenge",
    title: "Primer desafío",
    description: "Alba te habló de Milo, un joven entrenador que busca rival junto al huerto del asentamiento.",
    // Se acepta hablando con Alba tras completar la cadena introductoria
    objectives: [
      { type: "defeatTrainer", trainerId: "trainer_milo", amount: 1, label: "Derrota a Milo, el novato" },
    ],
    rewards: { money: 60 },
    next: "quest_trainer_road",
  },
  quest_trainer_road: {
    id: "quest_trainer_road",
    title: "Camino del entrenador",
    description: "Vera, la exploradora, entrena en el camino al este del asentamiento. Su equipo tiene dos criaturas.",
    startOnAvailable: true,
    objectives: [
      { type: "defeatTrainer", trainerId: "trainer_vera", amount: 1, label: "Derrota a Vera, la exploradora" },
    ],
    rewards: { money: 90, balls: 3 },
    next: "quest_final_test",
  },
  quest_final_test: {
    id: "quest_final_test",
    title: "Prueba final",
    description: "Ross, el guardabosques, decide quién está listo para el gimnasio. Vive en las colinas del noreste con tres criaturas.",
    startOnAvailable: true,
    objectives: [
      { type: "defeatTrainer", trainerId: "trainer_ross", amount: 1, label: "Derrota a Ross, el guardabosques" },
    ],
    rewards: { money: 150, unlock: "gym_path_unlocked" },
    next: "quest_find_gym",
  },

  // ---------- Fase 5: gimnasio ----------

  quest_find_gym: {
    id: "quest_find_gym",
    title: "El camino del gimnasio",
    description: "Ross te consideró listo. Busca el Gimnasio Verde en las llanuras o el bosque.",
    startOnAvailable: true,
    objectives: [
      { type: "discoverStructure", structureType: "gym", amount: 1, label: "Descubre el Gimnasio Verde" },
    ],
    rewards: { money: 40 },
    next: "quest_gym_trial",
  },
  quest_gym_trial: {
    id: "quest_gym_trial",
    title: "Supera la prueba",
    description: "Dentro del gimnasio: derrota a Nilo y a Lira, y resuelve el puzzle de los pedestales.",
    startOnAvailable: true,
    objectives: [
      { type: "defeatTrainer", trainerId: "gym_trainer_leaf_1", amount: 1, label: "Derrota a Nilo" },
      { type: "defeatTrainer", trainerId: "gym_trainer_leaf_2", amount: 1, label: "Derrota a Lira" },
      { type: "solveGymPuzzle", gymId: "gym_verdant", amount: 1, label: "Resuelve el puzzle de los pedestales" },
    ],
    rewards: { money: 80 },
    next: "quest_verdant_badge",
  },
  quest_verdant_badge: {
    id: "quest_verdant_badge",
    title: "Insignia Verde",
    description: "La sala de Iris está abierta. Derrota a la líder para ganar la Insignia Verde.",
    startOnAvailable: true,
    objectives: [
      { type: "defeatTrainer", trainerId: "leader_iris", amount: 1, label: "Derrota a Iris, líder del gimnasio" },
    ],
    // La insignia y los unlocks los concede GymSystem.resolveLeaderVictory, no esta quest
    rewards: { money: 50 },
  },
};

/** Orden de la cadena (para el tracker y el panel de misiones) */
export const QUEST_ORDER = [
  "quest_welcome", "quest_apricorns", "quest_trade", "quest_capture", "quest_explorer",
  "quest_first_challenge", "quest_trainer_road", "quest_final_test",
  "quest_find_gym", "quest_gym_trial", "quest_verdant_badge",
];

/** eventName → [tipo de objetivo, función de filtro, cantidad del payload] */
const EVENT_OBJECTIVES = {
  resourceCollected: ["collectResource", (o, p) => !o.resourceId || o.resourceId === p.resourceId, (p) => p.amount ?? 1],
  creatureCaptured: ["captureCreature", (o, p) => !o.speciesId || o.speciesId === p.speciesId, () => 1],
  structureDiscovered: ["discoverStructure", (o, p) => !o.structureType || o.structureType === p.structureType, () => 1],
  biomeDiscovered: ["discoverBiome", (o, p) => !o.biomeId || o.biomeId === (p.biomeId ?? p.biome), () => 1],
  npcTalked: ["talkToNPC", (o, p) => !o.role || o.role === p.role, () => 1],
  tradeCompleted: ["trade", (o, p) => !o.traderId || o.traderId === p.traderId, () => 1],
  blockMined: ["mineBlock", (o, p) => !o.block || o.block === p.block, () => 1],
  trainerDefeated: ["defeatTrainer",
    (o, p) => (!o.trainerId || o.trainerId === p.trainerId) && (!o.trainerClass || o.trainerClass === p.trainerClass),
    () => 1],
  gymPuzzleSolved: ["solveGymPuzzle", (o, p) => !o.gymId || o.gymId === p.gymId, () => 1],
  badgeEarned: ["earnBadge", (o, p) => !o.badgeId || o.badgeId === p.id, () => 1],
};

class QuestSystem {
  constructor() {
    this.q = null; // state.quests
    this.bound = false;
    this.rewardHandler = null;
  }

  attach(state) {
    this.q = state.quests;
    if (!this.bound) {
      this.bind();
      this.bound = true;
    }
    // Quests de arranque automático (idempotente entre cargas)
    for (const id of QUEST_ORDER) {
      if (QUESTS[id].autoStart) {
        this.makeAvailable(id);
        this.start(id, { silent: false });
      }
    }
    // Reconciliación de cadena: si una quest completada tiene `next` que aún
    // no está en ninguna lista (p. ej. saves previos a una fase nueva), se
    // desbloquea ahora. Mantiene las cadenas vivas entre versiones.
    for (const id of QUEST_ORDER) {
      const def = QUESTS[id];
      if (!def.next || !this.isCompleted(id)) continue;
      if (this.isCompleted(def.next) || this.isActive(def.next) || this.q.available[def.next]) continue;
      this.makeAvailable(def.next);
      if (QUESTS[def.next].startOnAvailable) this.start(def.next);
    }
  }

  setRewardHandler(fn) {
    this.rewardHandler = fn;
  }

  bind() {
    for (const [event, [type, filter, amountOf]] of Object.entries(EVENT_OBJECTIVES)) {
      events.on(event, (payload) => this.progress(type, filter, amountOf(payload), payload));
    }
  }

  // ---------- Estado ----------

  isCompleted(id) { return !!this.q?.completed[id]; }
  isActive(id) { return !!this.q?.active[id]; }
  isAvailable(id) { return !!this.q?.available[id] && !this.isActive(id) && !this.isCompleted(id); }

  makeAvailable(id) {
    if (!this.q || !QUESTS[id] || this.isCompleted(id) || this.isActive(id)) return;
    this.q.available[id] = true;
  }

  start(id, { silent = false } = {}) {
    const def = QUESTS[id];
    if (!this.q || !def || this.isActive(id) || this.isCompleted(id)) return false;
    delete this.q.available[id];
    this.q.active[id] = { progress: def.objectives.map(() => 0) };
    if (!silent) events.emit("questStarted", { questId: id });
    return true;
  }

  // ---------- Progreso ----------

  progress(type, filter, amount, payload) {
    if (!this.q || amount <= 0) return;
    for (const id in this.q.active) {
      const def = QUESTS[id];
      if (!def) continue;
      const st = this.q.active[id];
      let changed = false;
      def.objectives.forEach((obj, i) => {
        if (obj.type !== type || !filter(obj, payload)) return;
        const before = st.progress[i];
        if (before >= obj.amount) return;
        st.progress[i] = Math.min(obj.amount, before + amount);
        changed = true;
        events.emit("questUpdated", {
          questId: id,
          objectiveIndex: i,
          label: obj.label,
          current: st.progress[i],
          required: obj.amount,
        });
      });
      if (changed && def.objectives.every((obj, i) => st.progress[i] >= obj.amount)) {
        this.complete(id);
      }
    }
  }

  complete(id) {
    const def = QUESTS[id];
    if (!this.q || !def || this.isCompleted(id)) return; // idempotente
    delete this.q.active[id];
    delete this.q.available[id];
    this.q.completed[id] = true;
    if (def.rewards) this.rewardHandler?.(def.rewards, def);
    events.emit("questCompleted", { questId: id, title: def.title });
    if (def.next && QUESTS[def.next]) {
      this.makeAvailable(def.next);
      if (QUESTS[def.next].startOnAvailable) this.start(def.next);
    }
  }

  // ---------- Consultas para UI/debug ----------

  /** Quest activa prioritaria para el tracker del HUD (o null) */
  trackerInfo() {
    if (!this.q) return null;
    for (const id of QUEST_ORDER) {
      const st = this.q.active[id];
      if (!st) continue;
      const def = QUESTS[id];
      const i = def.objectives.findIndex((obj, k) => st.progress[k] < obj.amount);
      const idx = i === -1 ? def.objectives.length - 1 : i;
      const obj = def.objectives[idx];
      return {
        questId: id,
        title: def.title,
        label: obj.label,
        current: st.progress[idx],
        required: obj.amount,
      };
    }
    return null;
  }

  /** Resumen completo para el panel de pausa */
  summary() {
    if (!this.q) return { active: [], completed: [] };
    const active = [];
    const completed = [];
    for (const id of QUEST_ORDER) {
      const def = QUESTS[id];
      if (this.q.active[id]) {
        active.push({
          title: def.title,
          description: def.description,
          objectives: def.objectives.map((obj, i) => ({
            label: obj.label,
            current: this.q.active[id].progress[i],
            required: obj.amount,
          })),
        });
      } else if (this.q.completed[id]) {
        completed.push({ title: def.title });
      }
    }
    return { active, completed };
  }
}

export const quests = new QuestSystem();
