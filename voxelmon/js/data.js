/**
 * Datos del juego: tipos elementales, tabla de efectividad, especies
 * (mismas familias que Caja Misteriosa) y lógica de estadísticas/XP.
 */

export const TYPES = {
  fuego: { id: "fuego", name: "Fuego", color: "#e07a3a" },
  agua: { id: "agua", name: "Agua", color: "#3a9fe0" },
  planta: { id: "planta", name: "Planta", color: "#3dba7a" },
  electrico: { id: "electrico", name: "Eléctrico", color: "#e0c23a" },
  tierra: { id: "tierra", name: "Tierra", color: "#c4925a" },
  volador: { id: "volador", name: "Volador", color: "#8eb6e0" },
  sombra: { id: "sombra", name: "Sombra", color: "#7a5aa0" },
  luz: { id: "luz", name: "Luz", color: "#f0e6a8" },
};

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

export function typeMultiplier(att, def) {
  return CHART[att]?.[def] ?? 1;
}

export const SPECIES = {
  emberin: { id: "emberin", name: "Emberín", type: "fuego", stage: 1, base: { hp: 42, atk: 14, def: 8, spd: 12 }, evolvesTo: "brasor", evolveLevel: 5, color: "#e07a3a", color2: "#ffb070" },
  brasor: { id: "brasor", name: "Brasor", type: "fuego", stage: 2, base: { hp: 62, atk: 22, def: 14, spd: 16 }, evolvesTo: "infernak", evolveLevel: 10, color: "#d45520", color2: "#ff9040" },
  infernak: { id: "infernak", name: "Infernak", type: "fuego", stage: 3, base: { hp: 88, atk: 34, def: 22, spd: 20 }, evolvesTo: null, evolveLevel: null, color: "#b83210", color2: "#ff6a20" },

  gotita: { id: "gotita", name: "Gotita", type: "agua", stage: 1, base: { hp: 46, atk: 12, def: 10, spd: 11 }, evolvesTo: "riazor", evolveLevel: 5, color: "#3a9fe0", color2: "#80d0ff" },
  riazor: { id: "riazor", name: "Ríazor", type: "agua", stage: 2, base: { hp: 68, atk: 20, def: 16, spd: 15 }, evolvesTo: "tsunark", evolveLevel: 10, color: "#2080c8", color2: "#50b8f0" },
  tsunark: { id: "tsunark", name: "Tsunark", type: "agua", stage: 3, base: { hp: 95, atk: 30, def: 26, spd: 18 }, evolvesTo: null, evolveLevel: null, color: "#1060a0", color2: "#40a0e0" },

  semilla: { id: "semilla", name: "Semilla", type: "planta", stage: 1, base: { hp: 44, atk: 11, def: 12, spd: 10 }, evolvesTo: "arbusto", evolveLevel: 5, color: "#3dba7a", color2: "#80e0a8" },
  arbusto: { id: "arbusto", name: "Arbusto", type: "planta", stage: 2, base: { hp: 70, atk: 18, def: 20, spd: 13 }, evolvesTo: "silvax", evolveLevel: 10, color: "#2a9860", color2: "#60d090" },
  silvax: { id: "silvax", name: "Silvax", type: "planta", stage: 3, base: { hp: 100, atk: 28, def: 30, spd: 16 }, evolvesTo: null, evolveLevel: null, color: "#187848", color2: "#40c070" },

  chispin: { id: "chispin", name: "Chispín", type: "electrico", stage: 1, base: { hp: 38, atk: 15, def: 7, spd: 16 }, evolvesTo: "voltajo", evolveLevel: 5, color: "#e0c23a", color2: "#ffe680" },
  voltajo: { id: "voltajo", name: "Voltajo", type: "electrico", stage: 2, base: { hp: 56, atk: 24, def: 12, spd: 22 }, evolvesTo: "truena", evolveLevel: 10, color: "#d0a820", color2: "#f0d050" },
  truena: { id: "truena", name: "Truena", type: "electrico", stage: 3, base: { hp: 78, atk: 36, def: 18, spd: 28 }, evolvesTo: null, evolveLevel: null, color: "#c09010", color2: "#ffd030" },

  piedrita: { id: "piedrita", name: "Piedrita", type: "tierra", stage: 1, base: { hp: 50, atk: 12, def: 14, spd: 7 }, evolvesTo: "rocal", evolveLevel: 5, color: "#c4925a", color2: "#e0b888" },
  rocal: { id: "rocal", name: "Rocal", type: "tierra", stage: 2, base: { hp: 76, atk: 20, def: 24, spd: 9 }, evolvesTo: "titanor", evolveLevel: 10, color: "#a87840", color2: "#d0a060" },
  titanor: { id: "titanor", name: "Titanor", type: "tierra", stage: 3, base: { hp: 110, atk: 30, def: 34, spd: 11 }, evolvesTo: null, evolveLevel: null, color: "#8a6030", color2: "#c09050" },

  plumin: { id: "plumin", name: "Plumín", type: "volador", stage: 1, base: { hp: 40, atk: 13, def: 8, spd: 15 }, evolvesTo: "alazan", evolveLevel: 5, color: "#8eb6e0", color2: "#c0dcf0" },
  alazan: { id: "alazan", name: "Alazán", type: "volador", stage: 2, base: { hp: 58, atk: 21, def: 13, spd: 24 }, evolvesTo: "celestor", evolveLevel: 10, color: "#6090c8", color2: "#90b8e8" },
  celestor: { id: "celestor", name: "Celestor", type: "volador", stage: 3, base: { hp: 82, atk: 32, def: 20, spd: 30 }, evolvesTo: null, evolveLevel: null, color: "#4070b0", color2: "#70a0e0" },

  umbra: { id: "umbra", name: "Umbra", type: "sombra", stage: 1, base: { hp: 41, atk: 14, def: 9, spd: 13 }, evolvesTo: "sombrio", evolveLevel: 5, color: "#7a5aa0", color2: "#b090d0" },
  sombrio: { id: "sombrio", name: "Sombrío", type: "sombra", stage: 2, base: { hp: 60, atk: 23, def: 15, spd: 18 }, evolvesTo: "nocrix", evolveLevel: 10, color: "#5a3a80", color2: "#9070b8" },
  nocrix: { id: "nocrix", name: "Nocrix", type: "sombra", stage: 3, base: { hp: 85, atk: 35, def: 22, spd: 24 }, evolvesTo: null, evolveLevel: null, color: "#3a2060", color2: "#7040a0" },

  lucier: { id: "lucier", name: "Luciér", type: "luz", stage: 1, base: { hp: 43, atk: 12, def: 10, spd: 14 }, evolvesTo: "clarion", evolveLevel: 5, color: "#f0e6a8", color2: "#fff8d0" },
  clarion: { id: "clarion", name: "Clarion", type: "luz", stage: 2, base: { hp: 64, atk: 20, def: 16, spd: 19 }, evolvesTo: "aureon", evolveLevel: 10, color: "#e8d878", color2: "#fff0a0" },
  aureon: { id: "aureon", name: "Aureon", type: "luz", stage: 3, base: { hp: 90, atk: 31, def: 24, spd: 25 }, evolvesTo: null, evolveLevel: null, color: "#d8c050", color2: "#ffe870" },

  // Legendario exclusivo de VoxelMon: aparece al capturar las 8 familias.
  prismaton: { id: "prismaton", name: "Prismatón", type: "luz", stage: 3, legendary: true, base: { hp: 140, atk: 42, def: 34, spd: 32 }, evolvesTo: null, evolveLevel: null, color: "#c9f0ff", color2: "#ffd6f8" },
};

export const FAMILY_STARTERS = ["emberin", "gotita", "semilla", "chispin", "piedrita", "plumin", "umbra", "lucier"];

/** Habilidad pasiva permanente que otorga cada familia al capturarla */
export const PERKS = {
  emberin: { icon: "🔥", name: "Brasa viva", desc: "+25% de XP en cada combate" },
  gotita: { icon: "💧", name: "Branquias", desc: "Nadas mucho más rápido" },
  semilla: { icon: "🌿", name: "Fotosíntesis", desc: "Tu equipo se regenera el doble de rápido" },
  chispin: { icon: "⚡", name: "Reflejos", desc: "Te mueves un 20% más rápido" },
  piedrita: { icon: "🪨", name: "Manos de roca", desc: "25% de probabilidad de minar un bloque doble" },
  plumin: { icon: "🪶", name: "Plumas ligeras", desc: "Saltas notablemente más alto" },
  umbra: { icon: "🌙", name: "Visión nocturna", desc: "Las noches son mucho más claras" },
  lucier: { icon: "✨", name: "Aura radiante", desc: "+15% de probabilidad de captura con cubos" },
};

/** Efectos combinados de las habilidades activas según las familias capturadas */
export function activePerks(dexCaught) {
  const has = (fam) => {
    let id = fam;
    while (id) {
      if (dexCaught[id]) return true;
      id = SPECIES[id].evolvesTo;
    }
    return false;
  };
  return {
    xpMult: has("emberin") ? 1.25 : 1,
    swimMult: has("gotita") ? 1.6 : 1,
    regenMult: has("semilla") ? 2 : 1,
    speedMult: has("chispin") ? 1.2 : 1,
    doubleDrop: has("piedrita") ? 0.25 : 0,
    jumpMult: has("plumin") ? 1.18 : 1,
    nightVision: has("umbra"),
    catchBonus: has("lucier") ? 0.15 : 0,
  };
}

/** Familia (id de etapa 1) a la que pertenece una especie */
export function familyOf(speciesId) {
  for (const fam of FAMILY_STARTERS) {
    let id = fam;
    while (id) {
      if (id === speciesId) return fam;
      id = SPECIES[id].evolvesTo;
    }
  }
  return speciesId === "prismaton" ? "prismaton" : null;
}

export const MOVES = {
  fuego: [
    { id: "ascua", name: "Ascua", power: 1, type: "fuego" },
    { id: "llamarada", name: "Llamarada", power: 1.45, type: "fuego" },
  ],
  agua: [
    { id: "chorro", name: "Chorro", power: 1, type: "agua" },
    { id: "marea", name: "Marea", power: 1.45, type: "agua" },
  ],
  planta: [
    { id: "latigo", name: "Látigo hoja", power: 1, type: "planta" },
    { id: "enredadera", name: "Enredadera", power: 1.45, type: "planta" },
  ],
  electrico: [
    { id: "chispa", name: "Chispa", power: 1, type: "electrico" },
    { id: "rayo", name: "Rayo", power: 1.5, type: "electrico" },
  ],
  tierra: [
    { id: "golpe", name: "Golpe tierra", power: 1, type: "tierra" },
    { id: "avalancha", name: "Avalancha", power: 1.4, type: "tierra" },
  ],
  volador: [
    { id: "pico", name: "Picotazo", power: 1, type: "volador" },
    { id: "rafaga", name: "Ráfaga", power: 1.4, type: "volador" },
  ],
  sombra: [
    { id: "umbrio", name: "Toque umbrío", power: 1, type: "sombra" },
    { id: "pesadilla", name: "Pesadilla", power: 1.5, type: "sombra" },
  ],
  luz: [
    { id: "destello", name: "Destello", power: 1, type: "luz" },
    { id: "fulgor", name: "Fulgor", power: 1.45, type: "luz" },
  ],
};

const TACKLE = { id: "placaje", name: "Placaje", power: 0.85, type: null };

export function movesFor(monster) {
  const own = MOVES[SPECIES[monster.speciesId].type] ?? [];
  const list = monster.stage >= 2 ? [...own] : [own[0]];
  list.push(TACKLE);
  return list;
}

export function xpNeeded(level) {
  return 12 + level * 8;
}

export function createMonster(speciesId, level = 1) {
  const sp = SPECIES[speciesId];
  if (!sp) throw new Error(`Especie desconocida: ${speciesId}`);
  const scale = 1 + (level - 1) * 0.12;
  const maxHp = Math.round(sp.base.hp * scale);
  return {
    uid: `${speciesId}-${Math.random().toString(36).slice(2, 8)}`,
    speciesId,
    name: sp.name,
    type: sp.type,
    stage: sp.stage,
    level,
    xp: 0,
    xpToNext: xpNeeded(level),
    maxHp,
    hp: maxHp,
    atk: Math.round(sp.base.atk * scale),
    def: Math.round(sp.base.def * scale),
    spd: Math.round(sp.base.spd * scale),
  };
}

export function recalculateStats(m) {
  const sp = SPECIES[m.speciesId];
  const scale = 1 + (m.level - 1) * 0.12;
  const ratio = m.maxHp > 0 ? m.hp / m.maxHp : 1;
  m.maxHp = Math.round(sp.base.hp * scale);
  m.hp = Math.max(1, Math.round(m.maxHp * ratio));
  m.atk = Math.round(sp.base.atk * scale);
  m.def = Math.round(sp.base.def * scale);
  m.spd = Math.round(sp.base.spd * scale);
  m.name = sp.name;
  m.type = sp.type;
  m.stage = sp.stage;
}

/** Suma XP y devuelve eventos [{type:"level"|"evolve", ...}] */
export function gainXp(m, amount) {
  m.xp += amount;
  const events = [];
  while (m.xp >= m.xpToNext) {
    m.xp -= m.xpToNext;
    m.level += 1;
    m.xpToNext = xpNeeded(m.level);
    recalculateStats(m);
    events.push({ type: "level", level: m.level });
    const sp = SPECIES[m.speciesId];
    if (sp.evolvesTo && sp.evolveLevel && m.level >= sp.evolveLevel) {
      const next = SPECIES[sp.evolvesTo];
      const fromName = m.name;
      m.speciesId = next.id;
      recalculateStats(m);
      m.hp = m.maxHp;
      events.push({ type: "evolve", fromName, toName: next.name });
    }
  }
  return events;
}
