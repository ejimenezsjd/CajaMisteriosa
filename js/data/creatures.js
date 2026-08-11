/** Catálogo de criaturas originales con líneas evolutivas */

export const SPECIES = {
  // Línea Fuego
  emberin: {
    id: "emberin",
    name: "Emberín",
    type: "fuego",
    stage: 1,
    base: { hp: 42, atk: 14, def: 8, spd: 12 },
    evolvesTo: "brasor",
    evolveLevel: 5,
    color: "#e07a3a",
    color2: "#ffb070",
    blurb: "Una chispa viva que cabría en una caja.",
  },
  brasor: {
    id: "brasor",
    name: "Brasor",
    type: "fuego",
    stage: 2,
    base: { hp: 62, atk: 22, def: 14, spd: 16 },
    evolvesTo: "infernak",
    evolveLevel: 10,
    color: "#d45520",
    color2: "#ff9040",
    blurb: "Sus brazos son antorchas andantes.",
  },
  infernak: {
    id: "infernak",
    name: "Infernak",
    type: "fuego",
    stage: 3,
    base: { hp: 88, atk: 34, def: 22, spd: 20 },
    evolvesTo: null,
    evolveLevel: null,
    color: "#b83210",
    color2: "#ff6a20",
    blurb: "El calor de un horno en forma de bestia.",
  },

  // Línea Agua
  gotita: {
    id: "gotita",
    name: "Gotita",
    type: "agua",
    stage: 1,
    base: { hp: 46, atk: 12, def: 10, spd: 11 },
    evolvesTo: "riazor",
    evolveLevel: 5,
    color: "#3a9fe0",
    color2: "#80d0ff",
    blurb: "Una gota curiosa que nunca se evaporó.",
  },
  riazor: {
    id: "riazor",
    name: "Ríazor",
    type: "agua",
    stage: 2,
    base: { hp: 68, atk: 20, def: 16, spd: 15 },
    evolvesTo: "tsunark",
    evolveLevel: 10,
    color: "#2080c8",
    color2: "#50b8f0",
    blurb: "Corre como un arroyo furioso.",
  },
  tsunark: {
    id: "tsunark",
    name: "Tsunark",
    type: "agua",
    stage: 3,
    base: { hp: 95, atk: 30, def: 26, spd: 18 },
    evolvesTo: null,
    evolveLevel: null,
    color: "#1060a0",
    color2: "#40a0e0",
    blurb: "Levanta olas con un solo paso.",
  },

  // Línea Planta
  semilla: {
    id: "semilla",
    name: "Semilla",
    type: "planta",
    stage: 1,
    base: { hp: 44, atk: 11, def: 12, spd: 10 },
    evolvesTo: "arbusto",
    evolveLevel: 5,
    color: "#3dba7a",
    color2: "#80e0a8",
    blurb: "Una semilla que eligió caminar.",
  },
  arbusto: {
    id: "arbusto",
    name: "Arbusto",
    type: "planta",
    stage: 2,
    base: { hp: 70, atk: 18, def: 20, spd: 13 },
    evolvesTo: "silvax",
    evolveLevel: 10,
    color: "#2a9860",
    color2: "#60d090",
    blurb: "Se camufla entre la maleza del piso.",
  },
  silvax: {
    id: "silvax",
    name: "Silvax",
    type: "planta",
    stage: 3,
    base: { hp: 100, atk: 28, def: 30, spd: 16 },
    evolvesTo: null,
    evolveLevel: null,
    color: "#187848",
    color2: "#40c070",
    blurb: "Un bosque entero concentrado en un cuerpo.",
  },

  // Línea Eléctrico
  chispin: {
    id: "chispin",
    name: "Chispín",
    type: "electrico",
    stage: 1,
    base: { hp: 38, atk: 15, def: 7, spd: 16 },
    evolvesTo: "voltajo",
    evolveLevel: 5,
    color: "#e0c23a",
    color2: "#ffe680",
    blurb: "Estática con patas.",
  },
  voltajo: {
    id: "voltajo",
    name: "Voltajo",
    type: "electrico",
    stage: 2,
    base: { hp: 56, atk: 24, def: 12, spd: 22 },
    evolvesTo: "truena",
    evolveLevel: 10,
    color: "#d0a820",
    color2: "#f0d050",
    blurb: "Sus bigotes lanzan arco voltaico.",
  },
  truena: {
    id: "truena",
    name: "Truena",
    type: "electrico",
    stage: 3,
    base: { hp: 78, atk: 36, def: 18, spd: 28 },
    evolvesTo: null,
    evolveLevel: null,
    color: "#c09010",
    color2: "#ffd030",
    blurb: "El eco de un rayo sellado en carne.",
  },

  // Línea Tierra
  piedrita: {
    id: "piedrita",
    name: "Piedrita",
    type: "tierra",
    stage: 1,
    base: { hp: 50, atk: 12, def: 14, spd: 7 },
    evolvesTo: "rocal",
    evolveLevel: 5,
    color: "#c4925a",
    color2: "#e0b888",
    blurb: "Una roca que rodó hasta cobrar vida.",
  },
  rocal: {
    id: "rocal",
    name: "Rocal",
    type: "tierra",
    stage: 2,
    base: { hp: 76, atk: 20, def: 24, spd: 9 },
    evolvesTo: "titanor",
    evolveLevel: 10,
    color: "#a87840",
    color2: "#d0a060",
    blurb: "Su caparazón es una cantera.",
  },
  titanor: {
    id: "titanor",
    name: "Titanor",
    type: "tierra",
    stage: 3,
    base: { hp: 110, atk: 30, def: 34, spd: 11 },
    evolvesTo: null,
    evolveLevel: null,
    color: "#8a6030",
    color2: "#c09050",
    blurb: "Montaña con voluntad propia.",
  },

  // Línea Volador
  plumin: {
    id: "plumin",
    name: "Plumín",
    type: "volador",
    stage: 1,
    base: { hp: 40, atk: 13, def: 8, spd: 15 },
    evolvesTo: "alazan",
    evolveLevel: 5,
    color: "#8eb6e0",
    color2: "#c0dcf0",
    blurb: "Una pluma que aprendió a pelear.",
  },
  alazan: {
    id: "alazan",
    name: "Alazán",
    type: "volador",
    stage: 2,
    base: { hp: 58, atk: 21, def: 13, spd: 24 },
    evolvesTo: "celestor",
    evolveLevel: 10,
    color: "#6090c8",
    color2: "#90b8e8",
    blurb: "Planea entre las antorchas de la cripta.",
  },
  celestor: {
    id: "celestor",
    name: "Celestor",
    type: "volador",
    stage: 3,
    base: { hp: 82, atk: 32, def: 20, spd: 30 },
    evolvesTo: null,
    evolveLevel: null,
    color: "#4070b0",
    color2: "#70a0e0",
    blurb: "Dueño de corrientes invisibles.",
  },

  // Línea Sombra
  umbra: {
    id: "umbra",
    name: "Umbra",
    type: "sombra",
    stage: 1,
    base: { hp: 41, atk: 14, def: 9, spd: 13 },
    evolvesTo: "sombrio",
    evolveLevel: 5,
    color: "#7a5aa0",
    color2: "#b090d0",
    blurb: "La sombra que se quedó cuando te fuiste.",
  },
  sombrio: {
    id: "sombrio",
    name: "Sombrío",
    type: "sombra",
    stage: 2,
    base: { hp: 60, atk: 23, def: 15, spd: 18 },
    evolvesTo: "nocrix",
    evolveLevel: 10,
    color: "#5a3a80",
    color2: "#9070b8",
    blurb: "Habla en susurros que no oyes del todo.",
  },
  nocrix: {
    id: "nocrix",
    name: "Nocrix",
    type: "sombra",
    stage: 3,
    base: { hp: 85, atk: 35, def: 22, spd: 24 },
    evolvesTo: null,
    evolveLevel: null,
    color: "#3a2060",
    color2: "#7040a0",
    blurb: "La noche hecha depredador.",
  },

  // Línea Luz
  lucier: {
    id: "lucier",
    name: "Luciér",
    type: "luz",
    stage: 1,
    base: { hp: 43, atk: 12, def: 10, spd: 14 },
    evolvesTo: "clarion",
    evolveLevel: 5,
    color: "#f0e6a8",
    color2: "#fff8d0",
    blurb: "Un farolito con corazón.",
  },
  clarion: {
    id: "clarion",
    name: "Clarion",
    type: "luz",
    stage: 2,
    base: { hp: 64, atk: 20, def: 16, spd: 19 },
    evolvesTo: "aureon",
    evolveLevel: 10,
    color: "#e8d878",
    color2: "#fff0a0",
    blurb: "Ilumina pasillos que preferirías no ver.",
  },
  aureon: {
    id: "aureon",
    name: "Aureon",
    type: "luz",
    stage: 3,
    base: { hp: 90, atk: 31, def: 24, spd: 25 },
    evolvesTo: null,
    evolveLevel: null,
    color: "#d8c050",
    color2: "#ffe870",
    blurb: "Una aurora sellada en forma de guardián.",
  },
};

/** IDs de etapa 1 (aparecen en cajas / iniciales) */
export const STARTER_IDS = [
  "emberin",
  "gotita",
  "semilla",
  "chispin",
  "piedrita",
  "plumin",
  "umbra",
  "lucier",
];

/** Ataques por tipo */
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
    { id: "látigo", name: "Látigo hoja", power: 1, type: "planta" },
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
    { id: "ráfaga", name: "Ráfaga", power: 1.4, type: "volador" },
  ],
  sombra: [
    { id: "sombra", name: "Toque umbrío", power: 1, type: "sombra" },
    { id: "pesadilla", name: "Pesadilla", power: 1.5, type: "sombra" },
  ],
  luz: [
    { id: "destello", name: "Destello", power: 1, type: "luz" },
    { id: "fulgor", name: "Fulgor", power: 1.45, type: "luz" },
  ],
};

export function movesFor(typeId, stage) {
  const list = MOVES[typeId] ?? MOVES.fuego;
  if (stage >= 2) return list;
  return [list[0]];
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

export function xpNeeded(level) {
  return 12 + level * 8;
}

export function recalculateStats(monster) {
  const sp = SPECIES[monster.speciesId];
  const scale = 1 + (monster.level - 1) * 0.12;
  const ratio = monster.hp / monster.maxHp;
  monster.maxHp = Math.round(sp.base.hp * scale);
  monster.hp = Math.max(1, Math.round(monster.maxHp * ratio));
  monster.atk = Math.round(sp.base.atk * scale);
  monster.def = Math.round(sp.base.def * scale);
  monster.spd = Math.round(sp.base.spd * scale);
  monster.name = sp.name;
  monster.type = sp.type;
  monster.stage = sp.stage;
}

export function gainXp(monster, amount) {
  monster.xp += amount;
  const events = [];
  while (monster.xp >= monster.xpToNext) {
    monster.xp -= monster.xpToNext;
    monster.level += 1;
    monster.xpToNext = xpNeeded(monster.level);
    recalculateStats(monster);
    events.push({ type: "level", monster, level: monster.level });

    const sp = SPECIES[monster.speciesId];
    if (sp.evolvesTo && sp.evolveLevel && monster.level >= sp.evolveLevel) {
      const next = SPECIES[sp.evolvesTo];
      const fromName = monster.name;
      monster.speciesId = next.id;
      recalculateStats(monster);
      monster.hp = monster.maxHp;
      events.push({ type: "evolve", monster, fromName, toName: next.name });
    }
  }
  return events;
}

export function randomStarters(count = 3) {
  const pool = [...STARTER_IDS];
  const picks = [];
  while (picks.length < count && pool.length) {
    const i = Math.floor(Math.random() * pool.length);
    picks.push(pool.splice(i, 1)[0]);
  }
  return picks.map((id) => createMonster(id, 1));
}

export function randomWild(floor) {
  const level = Math.max(1, floor + Math.floor(Math.random() * 2) - (Math.random() < 0.3 ? 1 : 0));
  // Higher floors can spawn stage 2
  let pool = [...STARTER_IDS];
  if (floor >= 4) {
    pool = pool.concat(
      Object.values(SPECIES)
        .filter((s) => s.stage === 2)
        .map((s) => s.id)
    );
  }
  if (floor >= 8) {
    pool = pool.concat(
      Object.values(SPECIES)
        .filter((s) => s.stage === 3)
        .map((s) => s.id)
    );
  }
  const id = pool[Math.floor(Math.random() * pool.length)];
  return createMonster(id, Math.min(level + (SPECIES[id].stage - 1) * 2, 15));
}

export function randomBoxMonster(floor) {
  const level = Math.max(1, Math.floor(floor / 2) + 1);
  const id = STARTER_IDS[Math.floor(Math.random() * STARTER_IDS.length)];
  return createMonster(id, level);
}
