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
 *   discoverRegion    ← regionDiscovered   (regionId opcional)
 *   openRegionGate    ← regionGateOpened   (regionId opcional)
 *   craftRecipe       ← craftCompleted     (recipeId opcional)
 *   buyItem           ← itemPurchased      (itemId opcional)
 *   sellItem          ← itemSold           (itemId opcional)
 *   solveGymPuzzle    ← gymPuzzleSolved    (gymId opcional)
 *   earnBadge         ← badgeEarned        (badgeId opcional)
 *   defeatTrainer     ← trainerDefeated    (trainerId / trainerClass)
 *
 * Idempotencia: una quest completada nunca vuelve a activarse ni a entregar
 * recompensas; complete() ignora quests ya completadas.
 *
 * Las recompensas se entregan mediante un handler inyectado por main
 * (setRewardHandler), manteniendo el sistema desacoplado de dinero/cubos.
 */

import { events } from "./events.js";
import { progression } from "./progression.js";
import { trainers } from "./trainers.js";
import { gyms } from "./gyms.js";
import { regions } from "./regions.js";
import { getItemCount } from "./items.js";

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
    next: "quest_frontier",
  },

  // ---------- Fase 6: frontera y Región 2 ----------

  quest_frontier: {
    id: "quest_frontier",
    title: "La frontera",
    description: "La Insignia Verde abre el paso al sur del Gimnasio Verde. Habla con Kael y abre la frontera.",
    startOnAvailable: true,
    objectives: [
      { type: "openRegionGate", regionId: "region_2", amount: 1, label: "Abre el paso fronterizo" },
    ],
    rewards: { money: 40 },
    next: "quest_beyond_pass",
  },
  quest_beyond_pass: {
    id: "quest_beyond_pass",
    title: "Más allá del paso",
    description: "Cruza el portón y pisa las Tierras Brumosas por primera vez.",
    startOnAvailable: true,
    objectives: [
      { type: "discoverRegion", regionId: "region_2", amount: 1, label: "Descubre las Tierras Brumosas" },
    ],
    rewards: { money: 50 },
    next: "quest_unknown_lands",
  },
  quest_unknown_lands: {
    id: "quest_unknown_lands",
    title: "Tierras desconocidas",
    description: "Explora el bosque brumoso: su bioma, una flor de bruma y la atalaya.",
    startOnAvailable: true,
    objectives: [
      { type: "discoverBiome", biomeId: "mist_forest", amount: 1, label: "Descubre el Bosque Brumoso" },
      { type: "collectResource", resourceId: "mist_bloom", amount: 1, label: "Recoge una flor de bruma" },
      { type: "discoverStructure", structureType: "watchtower", amount: 1, label: "Descubre la atalaya brumosa" },
    ],
    rewards: { money: 120, unlock: "regional_explorer" },
    next: "quest_mist_refuge",
  },

  // ---------- Fase 7: refugio regional y crafting ----------

  quest_mist_refuge: {
    id: "quest_mist_refuge",
    title: "Refugio entre la niebla",
    description: "Más adentro de las Tierras Brumosas hay un refugio. Encuéntralo.",
    startOnAvailable: true,
    objectives: [
      { type: "discoverStructure", structureType: "mist_settlement", amount: 1, label: "Descubre el Refugio Brumoso" },
    ],
    rewards: { money: 50, unlock: "basic_crafting_unlocked" },
    next: "quest_hands_on",
  },
  quest_hands_on: {
    id: "quest_hands_on",
    title: "Manos a la obra",
    description: "Talo, el artesano del refugio, te enseña el banco de trabajo. Fabrica un cubo de captura.",
    startOnAvailable: true,
    objectives: [
      { type: "craftRecipe", recipeId: "recipe_capture_cube", amount: 1, label: "Fabrica un cubo de captura" },
    ],
    rewards: { money: 40, unlock: "ancient_core_recipe_unlocked" },
    next: "quest_mist_remedy",
  },
  quest_mist_remedy: {
    id: "quest_mist_remedy",
    title: "Remedio de las Tierras Brumosas",
    description: "Mira necesita que prepares medicina portátil: flor de bruma y tónico.",
    startOnAvailable: true,
    objectives: [
      { type: "collectResource", resourceId: "mist_bloom", amount: 1, label: "Recoge una flor de bruma" },
      { type: "craftRecipe", recipeId: "recipe_mist_tonic", amount: 1, label: "Fabrica un tónico de bruma" },
    ],
    rewards: { money: 70, unlock: "mist_crafting_unlocked" },
    next: "quest_echo_past",
  },
  quest_echo_past: {
    id: "quest_echo_past",
    title: "Eco del pasado",
    description: "El puesto ancestral guarda fragmentos. Ensambla un núcleo y despierta el sendero del próximo gimnasio.",
    startOnAvailable: true,
    objectives: [
      { type: "collectResource", resourceId: "ancient_fragment", amount: 1, label: "Recoge un fragmento antiguo" },
      { type: "discoverStructure", structureType: "ancient_outpost", amount: 1, label: "Descubre el puesto ancestral" },
      { type: "craftRecipe", recipeId: "recipe_ancient_core", amount: 1, label: "Fabrica un núcleo antiguo" },
    ],
    rewards: { money: 120, unlock: "gym_2_clue_unlocked" },
    next: "quest_into_mist",
  },

  // ---------- Fase 8: Gimnasio de las Brumas ----------

  quest_into_mist: {
    id: "quest_into_mist",
    title: "Entre la bruma",
    description: "El arco del Refugio Brumoso está abierto. Sigue el sendero al sur hasta el Gimnasio de las Brumas.",
    startOnAvailable: true,
    objectives: [
      { type: "discoverStructure", structureType: "gym_mist", amount: 1, label: "Descubre el Gimnasio de las Brumas" },
    ],
    rewards: { money: 50 },
    next: "quest_mist_lights",
  },
  quest_mist_lights: {
    id: "quest_mist_lights",
    title: "Luces en la niebla",
    description: "Enciende los tres faros de bruma. No hay orden: cada uno despeja un tramo.",
    startOnAvailable: true,
    objectives: [
      { type: "solveGymPuzzle", gymId: "gym_mist", amount: 1, label: "Enciende los tres faros de bruma" },
    ],
    rewards: { money: 80 },
    next: "quest_mist_trial",
  },
  quest_mist_trial: {
    id: "quest_mist_trial",
    title: "Prueba de las Brumas",
    description: "Derrota a Nox y a Lumen, los guardianes del gimnasio.",
    startOnAvailable: true,
    objectives: [
      { type: "defeatTrainer", trainerId: "gym_trainer_mist_1", amount: 1, label: "Derrota a Nox" },
      { type: "defeatTrainer", trainerId: "gym_trainer_mist_2", amount: 1, label: "Derrota a Lumen" },
    ],
    rewards: { money: 100 },
    next: "quest_mist_badge",
  },
  quest_mist_badge: {
    id: "quest_mist_badge",
    title: "Insignia Bruma",
    description: "La cámara de Nyra está abierta. Gana la Insignia Bruma.",
    startOnAvailable: true,
    objectives: [
      { type: "earnBadge", badgeId: "mist_badge", amount: 1, label: "Consigue la Insignia Bruma" },
    ],
    rewards: { money: 80 },
    next: "quest_beyond_mist",
  },

  // ---------- Fase 9: Cumbres Carmesí y economía regional ----------

  quest_beyond_mist: {
    id: "quest_beyond_mist",
    title: "Más allá de la bruma",
    description: "La Insignia Bruma ha despertado la barrera sur. Ábrela y sigue el camino.",
    startOnAvailable: true,
    objectives: [
      { type: "openRegionGate", regionId: "region_3", amount: 1, label: "Abre el camino hacia las Cumbres Carmesí" },
    ],
    rewards: { money: 50 },
    next: "quest_crimson_peaks",
  },
  quest_crimson_peaks: {
    id: "quest_crimson_peaks",
    title: "Cumbres Carmesí",
    description: "Cruza la barrera y pisa el altiplano de piedra roja.",
    startOnAvailable: true,
    objectives: [
      { type: "discoverRegion", regionId: "region_3", amount: 1, label: "Descubre las Cumbres Carmesí" },
    ],
    rewards: { money: 60 },
    next: "quest_mining_post",
  },
  quest_mining_post: {
    id: "quest_mining_post",
    title: "El puesto minero",
    description: "Más al sur hay un campamento. Encuéntralo y habla con el prospector.",
    startOnAvailable: true,
    objectives: [
      { type: "discoverStructure", structureType: "mining_camp", amount: 1, label: "Descubre el puesto minero" },
      { type: "talkToNPC", role: "prospector", amount: 1, label: "Habla con Bren" },
    ],
    rewards: { money: 70 },
    next: "quest_mountain_wealth",
  },
  quest_mountain_wealth: {
    id: "quest_mountain_wealth",
    title: "Riqueza de la montaña",
    description: "Reúne mena de ascuas, véndela a Kora y localiza la Ruina Carmesí.",
    startOnAvailable: true,
    objectives: [
      { type: "collectResource", resourceId: "ember_ore", amount: 1, label: "Recolecta mena de ascuas" },
      { type: "sellItem", itemId: "ember_ore", amount: 1, label: "Vende mena de ascuas" },
      { type: "discoverStructure", structureType: "crimson_ruin", amount: 1, label: "Descubre la Ruina Carmesí" },
    ],
    rewards: { money: 120, unlock: "gym_3_clue_unlocked" },
  },
};

/** Orden de la cadena (para el tracker y el panel de misiones) */
export const QUEST_ORDER = [
  "quest_welcome", "quest_apricorns", "quest_trade", "quest_capture", "quest_explorer",
  "quest_first_challenge", "quest_trainer_road", "quest_final_test",
  "quest_find_gym", "quest_gym_trial", "quest_verdant_badge",
  "quest_frontier", "quest_beyond_pass", "quest_unknown_lands",
  "quest_mist_refuge", "quest_hands_on", "quest_mist_remedy", "quest_echo_past",
  "quest_into_mist", "quest_mist_lights", "quest_mist_trial", "quest_mist_badge",
  "quest_beyond_mist", "quest_crimson_peaks", "quest_mining_post", "quest_mountain_wealth",
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
  regionDiscovered: ["discoverRegion", (o, p) => !o.regionId || o.regionId === p.regionId, () => 1],
  regionGateOpened: ["openRegionGate", (o, p) => !o.regionId || o.regionId === p.regionId, () => 1],
  craftCompleted: ["craftRecipe", (o, p) => !o.recipeId || o.recipeId === p.recipeId, () => 1],
  itemPurchased: ["buyItem", (o, p) => !o.itemId || o.itemId === p.itemId, (p) => p.amount ?? 1],
  itemSold: ["sellItem", (o, p) => !o.itemId || o.itemId === p.itemId, (p) => p.amount ?? 1],
};

class QuestSystem {
  constructor() {
    this.q = null; // state.quests
    this.bound = false;
    this.rewardHandler = null;
  }

  attach(state) {
    this.q = state.quests;
    this.state = state;
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
    // Saves que ya tenían la insignia antes de existir esta cadena
    if (progression.isUnlocked("region_2_path_unlocked") &&
        !this.isCompleted("quest_frontier") && !this.isActive("quest_frontier")) {
      this.makeAvailable("quest_frontier");
      this.start("quest_frontier");
    }
    // Saves que ya exploraron Región 2 antes de existir el Refugio Brumoso
    if (progression.isUnlocked("gym_2_clue_unlocked") &&
        !this.isCompleted("quest_into_mist") && !this.isActive("quest_into_mist")) {
      this.makeAvailable("quest_into_mist");
      this.start("quest_into_mist");
    }
    if (progression.isUnlocked("region_3_path_unlocked") &&
        !this.isCompleted("quest_beyond_mist") && !this.isActive("quest_beyond_mist")) {
      this.makeAvailable("quest_beyond_mist");
      this.start("quest_beyond_mist");
    }
  }

  setRewardHandler(fn) {
    this.rewardHandler = fn;
  }

  bind() {
    for (const [event, [type, filter, amountOf]] of Object.entries(EVENT_OBJECTIVES)) {
      events.on(event, (payload) => this.progress(type, filter, amountOf(payload), payload));
    }
    events.on("progressUnlocked", ({ id }) => {
      if (id === "region_2_path_unlocked") {
        if (this.isCompleted("quest_frontier") || this.isActive("quest_frontier")) return;
        this.makeAvailable("quest_frontier");
        this.start("quest_frontier");
      }
      if (id === "gym_2_clue_unlocked") {
        if (this.isCompleted("quest_into_mist") || this.isActive("quest_into_mist")) return;
        this.makeAvailable("quest_into_mist");
        this.start("quest_into_mist");
      }
      if (id === "region_3_path_unlocked") {
        if (this.isCompleted("quest_beyond_mist") || this.isActive("quest_beyond_mist")) return;
        this.makeAvailable("quest_beyond_mist");
        this.start("quest_beyond_mist");
      }
    });
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
    this.hydrate(id);
    if (!silent) events.emit("questStarted", { questId: id });
    if (this.q.active[id] && def.objectives.every((obj, i) => this.q.active[id].progress[i] >= obj.amount)) {
      this.complete(id);
    }
    return true;
  }

  /** Rellena objetivos ya cumplidos (p. ej. trainers derrotados antes de aceptar). */
  hydrate(id) {
    const def = QUESTS[id];
    const st = this.q?.active[id];
    if (!def || !st) return;
    def.objectives.forEach((obj, i) => {
      if (st.progress[i] >= obj.amount) return;
      if (obj.type === "defeatTrainer" && obj.trainerId && trainers.isDefeated(obj.trainerId)) {
        st.progress[i] = obj.amount;
      } else if (obj.type === "solveGymPuzzle" && obj.gymId && gyms.isPuzzleSolved(obj.gymId)) {
        st.progress[i] = obj.amount;
      } else if (obj.type === "earnBadge" && obj.badgeId && progression.hasBadge(obj.badgeId)) {
        st.progress[i] = obj.amount;
      } else if (obj.type === "discoverStructure" && obj.structureType && this.state?.stats) {
        const hit = Object.keys(this.state.stats.structuresDiscovered ?? {})
          .some((id) => id.startsWith(`${obj.structureType}:`));
        if (hit) st.progress[i] = obj.amount;
      } else if (obj.type === "discoverRegion" && obj.regionId && regions.isDiscovered(obj.regionId)) {
        st.progress[i] = obj.amount;
      } else if (obj.type === "openRegionGate" && obj.regionId && regions.isGateOpened(obj.regionId)) {
        st.progress[i] = obj.amount;
      } else if (obj.type === "collectResource" && obj.resourceId && this.state) {
        const n = getItemCount(this.state, obj.resourceId);
        if (n >= (obj.amount ?? 1)) st.progress[i] = obj.amount;
      }
    });
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
