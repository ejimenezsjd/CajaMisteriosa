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
 *   setFlag           ← flagSet            (flagId opcional)
 *   defeatBoss        ← bossDefeated       (bossId opcional)
 *   useTraversal      ← traversalUsed      (traversalType / traversalId)
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
import { bosses } from "./bosses.js";

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
    next: "quest_crimson_seal",
  },

  // ---------- Fase 10: resonador, boss regional y Gimnasio de la Forja ----------

  quest_crimson_seal: {
    id: "quest_crimson_seal",
    title: "El sello carmesí",
    description: "Habla con Bren y fabrica un resonador carmesí para despertar el sello.",
    startOnAvailable: true,
    objectives: [
      { type: "talkToNPC", role: "prospector", amount: 1, label: "Habla con Bren" },
      { type: "craftRecipe", recipeId: "recipe_crimson_resonator", amount: 1, label: "Fabrica un resonador carmesí" },
    ],
    rewards: { money: 80 },
    next: "quest_ruin_guardian",
  },
  quest_ruin_guardian: {
    id: "quest_ruin_guardian",
    title: "El guardián de la ruina",
    description: "Activa el sello con el resonador y derrota al Guardián Carmesí.",
    startOnAvailable: true,
    objectives: [
      { type: "setFlag", flagId: "crimson_seal_activated", amount: 1, label: "Activa el sello de la ruina" },
      { type: "defeatBoss", bossId: "crimson_guardian", amount: 1, label: "Derrota al Guardián Carmesí" },
    ],
    rewards: { money: 100 },
    next: "quest_the_forge",
  },
  quest_the_forge: {
    id: "quest_the_forge",
    title: "La forja",
    description: "El camino al sur de la ruina está abierto. Encuentra el Gimnasio de la Forja.",
    startOnAvailable: true,
    objectives: [
      { type: "discoverStructure", structureType: "gym_crimson", amount: 1, label: "Descubre el Gimnasio de la Forja" },
    ],
    rewards: { money: 70 },
    next: "quest_forge_trial",
  },
  quest_forge_trial: {
    id: "quest_forge_trial",
    title: "Prueba de la forja",
    description: "Derrota a Pyra y a Flint, y reparte la energía del núcleo.",
    startOnAvailable: true,
    objectives: [
      { type: "defeatTrainer", trainerId: "gym_trainer_forge_1", amount: 1, label: "Derrota a Pyra" },
      { type: "defeatTrainer", trainerId: "gym_trainer_forge_2", amount: 1, label: "Derrota a Flint" },
      { type: "solveGymPuzzle", gymId: "gym_crimson", amount: 1, label: "Carga el núcleo de forja" },
    ],
    rewards: { money: 110 },
    next: "quest_forge_badge",
  },
  quest_forge_badge: {
    id: "quest_forge_badge",
    title: "Insignia Forja",
    description: "La cámara de Brann está abierta. Gana la Insignia Forja.",
    startOnAvailable: true,
    objectives: [
      { type: "earnBadge", badgeId: "crimson_badge", amount: 1, label: "Consigue la Insignia Forja" },
    ],
    rewards: { money: 90 },
    next: "quest_crimson_pass",
  },
  quest_crimson_pass: {
    id: "quest_crimson_pass",
    title: "El Paso Carmesí",
    description: "La Insignia Forja ha despertado el mecanismo del paso sur. Ábrelo.",
    startOnAvailable: true,
    objectives: [
      { type: "openRegionGate", regionId: "region_4", amount: 1, label: "Abre el Paso Carmesí" },
    ],
    rewards: { money: 50 },
    next: "quest_wind_highlands",
  },
  quest_wind_highlands: {
    id: "quest_wind_highlands",
    title: "Altos del Vendaval",
    description: "Cruza el paso y pisa la cuarta región.",
    startOnAvailable: true,
    objectives: [
      { type: "discoverRegion", regionId: "region_4", amount: 1, label: "Descubre los Altos del Vendaval" },
    ],
    rewards: { money: 60 },
    next: "quest_against_wind",
  },
  quest_against_wind: {
    id: "quest_against_wind",
    title: "Contra el viento",
    description: "El santuario del viento enseña las corrientes. Encuéntralo y úsalo.",
    startOnAvailable: true,
    objectives: [
      { type: "discoverStructure", structureType: "wind_shrine", amount: 1, label: "Descubre el Santuario del Viento" },
      { type: "useTraversal", traversalType: "wind_lift", amount: 1, label: "Usa una corriente ascendente" },
    ],
    rewards: { money: 70 },
    next: "quest_cliff_outpost",
  },
  quest_cliff_outpost: {
    id: "quest_cliff_outpost",
    title: "El puesto del acantilado",
    description: "Hay un hub pequeño entre las mesetas. Habla con quien vigila el viento.",
    startOnAvailable: true,
    objectives: [
      { type: "discoverStructure", structureType: "cliff_outpost", amount: 1, label: "Descubre el Puesto del Acantilado" },
      { type: "talkToNPC", roles: ["wind_scout", "storm_researcher"], amount: 1, label: "Habla con Nera o Vela" },
    ],
    rewards: { money: 80 },
    next: "quest_storm_eyes",
  },
  quest_storm_eyes: {
    id: "quest_storm_eyes",
    title: "Ojos en la tormenta",
    description: "Cristal de viento, observatorio y el mecanismo dormido. El cuarto gimnasio aún no abre.",
    startOnAvailable: true,
    objectives: [
      { type: "collectResource", resourceId: "wind_crystal", amount: 1, label: "Recolecta cristal de viento" },
      { type: "discoverStructure", structureType: "storm_observatory", amount: 1, label: "Descubre el Observatorio de la Tormenta" },
      { type: "setFlag", flagId: "storm_anomaly_inspected", amount: 1, label: "Inspecciona la anomalía del observatorio" },
    ],
    rewards: { money: 120, unlock: "gym_4_clue_unlocked" },
    next: "quest_storm_seal",
  },

  // ---------- Fase 12: sello, guardián y Gimnasio del Vendaval ----------

  quest_storm_seal: {
    id: "quest_storm_seal",
    title: "El sello del vendaval",
    description: "Los cristales del observatorio responden. Activa el mecanismo dormido.",
    startOnAvailable: true,
    objectives: [
      { type: "activateSeal", sealId: "storm_observatory", amount: 1, label: "Activa el sello de la tormenta" },
    ],
    rewards: { money: 80 },
    next: "quest_storm_eye",
  },
  quest_storm_eye: {
    id: "quest_storm_eye",
    title: "Ojo de la tormenta",
    description: "El pináculo despierta. Derrota al Guardián del Vendaval.",
    startOnAvailable: true,
    objectives: [
      { type: "defeatBoss", bossId: "tempest_guardian", amount: 1, label: "Derrota al Guardián del Vendaval" },
    ],
    rewards: { money: 100, unlock: "gym_4_path_unlocked" },
    next: "quest_gale_gym",
  },
  quest_gale_gym: {
    id: "quest_gale_gym",
    title: "Gimnasio en las alturas",
    description: "Las corrientes abren un camino hacia el Gimnasio del Vendaval.",
    startOnAvailable: true,
    objectives: [
      { type: "discoverStructure", structureType: "gym_gale", amount: 1, label: "Descubre el Gimnasio del Vendaval" },
    ],
    rewards: { money: 60 },
    next: "quest_master_wind",
  },
  quest_master_wind: {
    id: "quest_master_wind",
    title: "Dominar el viento",
    description: "Derrota a Kaia y a Orin, y alinea los tres canales de viento.",
    startOnAvailable: true,
    objectives: [
      { type: "defeatTrainer", trainerId: "gym_trainer_gale_1", amount: 1, label: "Derrota a Kaia" },
      { type: "defeatTrainer", trainerId: "gym_trainer_gale_2", amount: 1, label: "Derrota a Orin" },
      { type: "solveGymPuzzle", gymId: "gym_gale", amount: 1, label: "Alinea los canales de viento" },
    ],
    rewards: { money: 120 },
    next: "quest_gale_badge",
  },
  quest_gale_badge: {
    id: "quest_gale_badge",
    title: "Insignia Vendaval",
    description: "La terraza de Zephra está abierta. Gana la Insignia Vendaval.",
    startOnAvailable: true,
    objectives: [
      { type: "earnBadge", badgeId: "gale_badge", amount: 1, label: "Consigue la Insignia Vendaval" },
    ],
    rewards: { money: 100 },
    next: "quest_beyond_heights",
  },
  quest_beyond_heights: {
    id: "quest_beyond_heights",
    title: "Más allá de las alturas",
    description: "El arco de las alturas se ha abierto. Baja hacia el mar.",
    startOnAvailable: true,
    objectives: [
      { type: "useTraversal", traversalType: "highland_exit", amount: 1, label: "Usa el Arco de las alturas" },
      { type: "discoverRegion", regionId: "region_5", amount: 1, label: "Entra en el Archipiélago Azur" },
    ],
    rewards: { money: 80 },
    next: "quest_azure_port",
  },
  quest_azure_port: {
    id: "quest_azure_port",
    title: "Puerto Azur",
    description: "Sigue el Camino del Acantilado hasta el puerto y habla con Maris.",
    startOnAvailable: true,
    objectives: [
      { type: "discoverRegion", regionId: "region_5", amount: 1, label: "Descubre el Archipiélago Azur" },
      { type: "discoverStructure", structureType: "azure_port", amount: 1, label: "Descubre Puerto Azur" },
      { type: "talkToNPC", role: "azure_guide", amount: 1, label: "Habla con Maris" },
    ],
    rewards: { money: 90 },
    next: "quest_tide_paths",
  },
  quest_tide_paths: {
    id: "quest_tide_paths",
    title: "Caminos de marea",
    description: "Prueba una corriente, encuentra un hito de ruta y cruza el puente.",
    startOnAvailable: true,
    objectives: [
      { type: "useTraversal", traversalType: "water_current", amount: 1, label: "Usa una corriente de agua" },
      { type: "discoverStructure", structureType: "azure_bridge", amount: 1, label: "Descubre el Puente de las mareas" },
      { type: "discoverStructure", structureType: "coastal_gate", amount: 1, label: "Pasa el Arco de la costa" },
    ],
    rewards: { money: 90 },
    next: "quest_ruin_echoes",
  },
  quest_ruin_echoes: {
    id: "quest_ruin_echoes",
    title: "Ecos de las ruinas",
    description: "Explora las Ruinas de Marea, recoge un tesoro de arrecife y habla con Quill.",
    startOnAvailable: true,
    objectives: [
      { type: "discoverStructure", structureType: "tidal_ruins", amount: 1, label: "Descubre las Ruinas de Marea" },
      { type: "collectResource", resourceIds: ["coral_fragment", "tidal_pearl"], amount: 1, label: "Recoge fragmento de coral o perla de marea" },
      { type: "talkToNPC", role: "azure_researcher", amount: 1, label: "Habla con Quill" },
    ],
    rewards: { money: 110 },
    next: "quest_horizon_light",
  },
  quest_horizon_light: {
    id: "quest_horizon_light",
    title: "La luz del horizonte",
    description: "El Faro Azur espera una mano en la lente.",
    startOnAvailable: true,
    objectives: [
      { type: "discoverStructure", structureType: "azure_lighthouse", amount: 1, label: "Descubre el Faro Azur" },
      { type: "setFlag", flagId: "lighthouse_activated", amount: 1, label: "Activa el faro" },
    ],
    rewards: { money: 140, unlock: "gym_5_clue_unlocked" },
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
  "quest_crimson_seal", "quest_ruin_guardian", "quest_the_forge", "quest_forge_trial", "quest_forge_badge",
  "quest_crimson_pass", "quest_wind_highlands", "quest_against_wind", "quest_cliff_outpost", "quest_storm_eyes",
  "quest_storm_seal", "quest_storm_eye", "quest_gale_gym", "quest_master_wind", "quest_gale_badge",
  "quest_beyond_heights", "quest_azure_port", "quest_tide_paths", "quest_ruin_echoes", "quest_horizon_light",
];

/** eventName → [tipo de objetivo, función de filtro, cantidad del payload] */
const EVENT_OBJECTIVES = {
  resourceCollected: ["collectResource", (o, p) => {
    if (o.resourceIds) return o.resourceIds.includes(p.resourceId);
    return !o.resourceId || o.resourceId === p.resourceId;
  }, (p) => p.amount ?? 1],
  creatureCaptured: ["captureCreature", (o, p) => !o.speciesId || o.speciesId === p.speciesId, () => 1],
  structureDiscovered: ["discoverStructure", (o, p) => !o.structureType || o.structureType === p.structureType, () => 1],
  biomeDiscovered: ["discoverBiome", (o, p) => !o.biomeId || o.biomeId === (p.biomeId ?? p.biome), () => 1],
  npcTalked: ["talkToNPC", (o, p) => !o.role && !o.roles || o.role === p.role || (o.roles && o.roles.includes(p.role)), () => 1],
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
  flagSet: ["setFlag", (o, p) => !o.flagId || o.flagId === p.id, () => 1],
  bossDefeated: ["defeatBoss", (o, p) => !o.bossId || o.bossId === p.bossId, () => 1],
  traversalUsed: ["useTraversal", (o, p) => (!o.traversalType || o.traversalType === p.traversalType) && (!o.traversalId || o.traversalId === p.traversalId), () => 1],
  sealActivated: ["activateSeal", (o, p) => !o.sealId || o.sealId === p.sealId, () => 1],
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
    if (progression.isUnlocked("gym_3_clue_unlocked")) {
      progression.unlock("crimson_resonator_recipe_unlocked");
      if (!this.isCompleted("quest_crimson_seal") && !this.isActive("quest_crimson_seal")) {
        this.makeAvailable("quest_crimson_seal");
        this.start("quest_crimson_seal");
      }
    }
    if (progression.isUnlocked("region_4_path_unlocked") &&
        !this.isCompleted("quest_crimson_pass") && !this.isActive("quest_crimson_pass")) {
      this.makeAvailable("quest_crimson_pass");
      this.start("quest_crimson_pass");
    }
    if (progression.isUnlocked("gym_4_clue_unlocked") &&
        !this.isCompleted("quest_storm_seal") && !this.isActive("quest_storm_seal")) {
      this.makeAvailable("quest_storm_seal");
      this.start("quest_storm_seal");
    }
    if (progression.isUnlocked("region_5_path_unlocked") &&
        !this.isCompleted("quest_beyond_heights") && !this.isActive("quest_beyond_heights")) {
      this.makeAvailable("quest_beyond_heights");
      this.start("quest_beyond_heights");
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
      if (id === "gym_3_clue_unlocked") {
        progression.unlock("crimson_resonator_recipe_unlocked");
        if (this.isCompleted("quest_crimson_seal") || this.isActive("quest_crimson_seal")) return;
        this.makeAvailable("quest_crimson_seal");
        this.start("quest_crimson_seal");
      }
      if (id === "region_4_path_unlocked") {
        if (this.isCompleted("quest_crimson_pass") || this.isActive("quest_crimson_pass")) return;
        this.makeAvailable("quest_crimson_pass");
        this.start("quest_crimson_pass");
      }
      if (id === "gym_4_clue_unlocked") {
        if (this.isCompleted("quest_storm_seal") || this.isActive("quest_storm_seal")) return;
        this.makeAvailable("quest_storm_seal");
        this.start("quest_storm_seal");
      }
      if (id === "region_5_path_unlocked") {
        if (this.isCompleted("quest_beyond_heights") || this.isActive("quest_beyond_heights")) return;
        this.makeAvailable("quest_beyond_heights");
        this.start("quest_beyond_heights");
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
      } else if (obj.type === "collectResource" && this.state) {
        const ids = obj.resourceIds ?? (obj.resourceId ? [obj.resourceId] : []);
        const n = ids.reduce((acc, id) => acc + getItemCount(this.state, id), 0);
        if (n >= (obj.amount ?? 1)) st.progress[i] = obj.amount;
      } else if (obj.type === "craftRecipe" && obj.recipeId === "recipe_crimson_resonator") {
        if (getItemCount(this.state, "crimson_resonator") >= 1 ||
            progression.hasFlag("crimson_seal_activated")) {
          st.progress[i] = obj.amount;
        }
      } else if (obj.type === "setFlag" && obj.flagId && progression.hasFlag(obj.flagId)) {
        st.progress[i] = obj.amount;
      } else if (obj.type === "defeatBoss" && obj.bossId && bosses.isDefeated(obj.bossId)) {
        st.progress[i] = obj.amount;
      } else if (obj.type === "activateSeal" && obj.sealId && bosses.isSealActivated(obj.sealId)) {
        st.progress[i] = obj.amount;
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
