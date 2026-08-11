/** Tipos elementales y tabla de efectividad */

export const TYPES = {
  fuego: { id: "fuego", name: "Fuego", color: "#e07a3a", emoji: "▲" },
  agua: { id: "agua", name: "Agua", color: "#3a9fe0", emoji: "◈" },
  planta: { id: "planta", name: "Planta", color: "#3dba7a", emoji: "♣" },
  electrico: { id: "electrico", name: "Eléctrico", color: "#e0c23a", emoji: "⚡" },
  tierra: { id: "tierra", name: "Tierra", color: "#c4925a", emoji: "■" },
  volador: { id: "volador", name: "Volador", color: "#8eb6e0", emoji: "☁" },
  sombra: { id: "sombra", name: "Sombra", color: "#7a5aa0", emoji: "◆" },
  luz: { id: "luz", name: "Luz", color: "#f0e6a8", emoji: "✦" },
};

/**
 * Multiplicador de daño: atacante -> defensor
 * 2 = súper eficaz, 0.5 = poco eficaz, 1 = normal
 */
const CHART = {
  fuego: { planta: 2, agua: 0.5, tierra: 0.5, sombra: 1.5 },
  agua: { fuego: 2, tierra: 2, planta: 0.5, electrico: 0.5 },
  planta: { agua: 2, tierra: 2, fuego: 0.5, volador: 0.5 },
  electrico: { agua: 2, volador: 2, tierra: 0.5, planta: 0.5 },
  tierra: { fuego: 2, electrico: 2, volador: 0.5, planta: 0.5 },
  volador: { planta: 2, tierra: 1.5, electrico: 0.5, sombra: 0.5 },
  sombra: { luz: 2, volador: 1.5, fuego: 0.5 },
  luz: { sombra: 2, tierra: 1.5, fuego: 0.5 },
};

export function typeMultiplier(attackerType, defenderType) {
  const row = CHART[attackerType];
  if (!row) return 1;
  return row[defenderType] ?? 1;
}

export function typeLabel(typeId) {
  return TYPES[typeId]?.name ?? typeId;
}

export function typeColor(typeId) {
  return TYPES[typeId]?.color ?? "#999";
}
