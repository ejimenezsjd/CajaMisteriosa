import { typeMultiplier } from "../data/types.js";
import { movesFor, SPECIES } from "../data/creatures.js";

/**
 * Calcula daño de un movimiento.
 */
export function calcDamage(attacker, defender, move) {
  const variance = 0.85 + Math.random() * 0.3;
  const mult = typeMultiplier(move.type, defender.type);
  const raw =
    ((attacker.atk * move.power) / Math.max(1, defender.def * 0.55)) * 6 * variance * mult;
  const dmg = Math.max(1, Math.round(raw));
  return { dmg, mult };
}

export function effectivenessText(mult) {
  if (mult >= 2) return "¡Es muy eficaz!";
  if (mult > 1) return "Es eficaz.";
  if (mult <= 0.5) return "No es muy eficaz...";
  return null;
}

export function getMoves(monster) {
  return movesFor(monster.type, monster.stage);
}

/**
 * IA simple: elige el golpe con más daño esperado.
 */
export function chooseEnemyMove(enemy, ally) {
  const moves = getMoves(enemy);
  let best = moves[0];
  let bestScore = -1;
  for (const m of moves) {
    const mult = typeMultiplier(m.type, ally.type);
    const score = m.power * mult + Math.random() * 0.2;
    if (score > bestScore) {
      bestScore = score;
      best = m;
    }
  }
  return best;
}

export function isFainted(monster) {
  return monster.hp <= 0;
}

export function healParty(party, ratio = 0.35) {
  for (const m of party) {
    if (m.hp <= 0) continue;
    m.hp = Math.min(m.maxHp, m.hp + Math.round(m.maxHp * ratio));
  }
}

export function livingMembers(party) {
  return party.filter((m) => m.hp > 0);
}

export function partyPower(party) {
  return party.reduce((s, m) => s + m.level * m.stage, 0);
}

export function speciesOf(monster) {
  return SPECIES[monster.speciesId];
}
