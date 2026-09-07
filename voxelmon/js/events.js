/**
 * EventBus ligero para desacoplar sistemas (misiones, estadísticas, logros…)
 * del código de gameplay. Sin dependencias.
 *
 * Eventos actualmente emitidos por el juego:
 *  - blockMined      { x, y, z, block, drop }
 *  - blockPlaced     { x, y, z, block }
 *  - creatureSeen    { speciesId, level }
 *  - creatureSpawned { speciesId, level }
 *  - creatureDefeated{ speciesId, level }
 *  - creatureCaptured{ speciesId, level }
 *  - creatureEvolved { speciesId }
 *  - battleStarted   { speciesId, level, type: "wild" } | { type: "trainer", trainerId, speciesId, level }
 *  - battleWon       { speciesId, level, type: "wild" } | { type: "trainer", trainerId }
 *  - battleLost      { speciesId, level, type: "wild" } | { type: "trainer", trainerId }
 *  - battleFled      { speciesId, level }
 *  - trainerBattleStarted { trainerId }
 *  - trainerDefeated { trainerId, trainerClass, rewardMoney, gymId? }
 *  - trainerBattleLost   { trainerId }
 *  - biomeDiscovered { biome, biomeId, biomeName, x, z }
 *  - structureDiscovered { structureId, structureType, biomeId, x, y, z }
 *  - resourceCollected   { resourceId, amount, source, biomeId, x, y, z }
 *  - partyHealed     { source, structureId }
 *  - npcTalked       { npcId, role, name, structureId }
 *  - tradeCompleted  { traderId, tradeId, cost, rewards }
 *  - questStarted    { questId }
 *  - questUpdated    { questId, objectiveIndex, label, current, required }
 *  - questCompleted  { questId, title }
 *  - moneyChanged    { money, delta }
 *  - progressUnlocked{ id }
 *  - flagSet         { id }
 *  - badgeEarned     { id }
 *  - gymPuzzleProgress { gymId, current, required, reset }
 *  - gymPuzzleSolved   { gymId }
 *  - gymEntered        { gymId, structureId }
 *  - gymCompleted      { gymId, badgeId, trainerId }
 * (futuros: itemCrafted, itemCollected, regionUnlocked)
 */

const handlers = new Map();

export const events = {
  on(event, fn) {
    if (!handlers.has(event)) handlers.set(event, new Set());
    handlers.get(event).add(fn);
    return fn;
  },

  off(event, fn) {
    handlers.get(event)?.delete(fn);
  },

  emit(event, payload = {}) {
    const set = handlers.get(event);
    if (!set) return;
    for (const fn of [...set]) {
      try {
        fn(payload);
      } catch (err) {
        console.error(`[events] manejador de "${event}" falló:`, err);
      }
    }
  },
};
