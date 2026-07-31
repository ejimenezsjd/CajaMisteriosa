export type ExerciseGuide = {
  slug: string;
  name: string;
  aliases: string[];
  muscles: string;
  image: string;
  summary: string;
  cues: string[];
  avoid: string[];
};

export const EXERCISE_CATALOG: ExerciseGuide[] = [
  {
    slug: "press-banca",
    name: "Press banca",
    aliases: ["bench press", "press de banca", "banca"],
    muscles: "Pecho, hombros, tríceps",
    image: "/exercises/press-banca.png",
    summary:
      "Empuje horizontal tumbado. Controla la bajada y empuja la barra en línea estable sobre el pecho.",
    cues: [
      "Omóplatos juntos y pies firmes en el suelo",
      "Baja la barra al pecho medio con control",
      "Empuja sin rebotar ni abrir los codos en exceso",
    ],
    avoid: [
      "Despegar la zona lumbar del banco de forma agresiva",
      "Bajar la barra al cuello",
    ],
  },
  {
    slug: "press-militar",
    name: "Press militar",
    aliases: ["overhead press", "press de hombros", "military press"],
    muscles: "Hombros, tríceps, core",
    image: "/exercises/press-militar.png",
    summary:
      "Empuje vertical de pie. Mantén el tronco estable y termina con los brazos bloqueados sobre la cabeza.",
    cues: [
      "Aprieta glúteos y abdomen antes de empujar",
      "Barra cerca de la cara en el recorrido",
      "Cabeza ligeramente atrás al pasar la barra, luego neutra",
    ],
    avoid: [
      "Inclinar la espalda baja para ayudar con la cadera",
      "Abrir demasiado los codos hacia fuera",
    ],
  },
  {
    slug: "fondos",
    name: "Fondos",
    aliases: ["dips", "fondos en paralelas"],
    muscles: "Pecho, tríceps, hombros",
    image: "/exercises/fondos.png",
    summary:
      "Descenso controlado entre paralelas y empuje hasta extender los codos sin bloquear de golpe.",
    cues: [
      "Hombros abajo y lejos de las orejas",
      "Baja hasta ~90° de codo o sin dolor",
      "Empuja hacia arriba manteniendo el control",
    ],
    avoid: [
      "Descender demasiado si duele el hombro",
      "Balancearte con impulso de piernas",
    ],
  },
  {
    slug: "peso-muerto",
    name: "Peso muerto",
    aliases: ["deadlift", "peso muerto convencional"],
    muscles: "Espalda, glúteos, isquios, core",
    image: "/exercises/peso-muerto.png",
    summary:
      "Bisagra de cadera para levantar la barra del suelo. Espalda neutra y barra cerca del cuerpo.",
    cues: [
      "Barra sobre el mediopié, hombros ligeramente delante",
      "Empuja el suelo con los pies y extiende cadera",
      "Mantén la barra pegada a piernas y muslos",
    ],
    avoid: [
      "Redondear la zona lumbar",
      "Tirar de la barra lejos del cuerpo",
    ],
  },
  {
    slug: "peso-muerto-rumano",
    name: "Peso muerto rumano",
    aliases: ["rdl", "romanian deadlift", "peso muerto rumano"],
    muscles: "Isquios, glúteos, espalda",
    image: "/exercises/peso-muerto-rumano.png",
    summary:
      "Bisagra de cadera con poca flexión de rodilla. Siente el estiramiento en isquios y vuelve empujando la cadera.",
    cues: [
      "Rodillas suaves, cadera atrás",
      "Espalda neutra y pecho abierto",
      "Sube apretando glúteos, sin hiperextender",
    ],
    avoid: [
      "Doblar demasiado las rodillas (se convierte en sentadilla)",
      "Curvar la espalda al bajar",
    ],
  },
  {
    slug: "dominadas",
    name: "Dominadas",
    aliases: ["pull ups", "pull-ups", "chin ups"],
    muscles: "Espalda, bíceps, core",
    image: "/exercises/dominadas.png",
    summary:
      "Tirón vertical hasta llevar la barbilla por encima de la barra. Controla también la bajada.",
    cues: [
      "Activa dorsales bajando los omóplatos",
      "Tirón hacia el pecho, no solo con brazos",
      "Baja con control hasta extensión casi completa",
    ],
    avoid: [
      "Balancearte en exceso (kipping) si buscas fuerza",
      "Encoger el cuello hacia los hombros",
    ],
  },
  {
    slug: "remo-barra",
    name: "Remo con barra",
    aliases: ["barbell row", "remo barra", "remo"],
    muscles: "Espalda, bíceps, core",
    image: "/exercises/remo-barra.png",
    summary:
      "Tirón horizontal con torso inclinado. Lleva la barra hacia el abdomen bajo manteniendo la espalda estable.",
    cues: [
      "Torso ~45° o más horizontal, espalda neutra",
      "Codos cerca del cuerpo",
      "Aprieta omóplatos al final del tirón",
    ],
    avoid: [
      "Usar solo impulso de cadera",
      "Redondear la espalda superior",
    ],
  },
  {
    slug: "sentadilla",
    name: "Sentadilla",
    aliases: ["squat", "back squat", "sentadillas"],
    muscles: "Cuádriceps, glúteos, core",
    image: "/exercises/sentadilla.png",
    summary:
      "Flexión de cadera y rodillas bajando con control y subiendo empujando el suelo. Rodillas alineadas con los pies.",
    cues: [
      "Pies a anchura de hombros (o algo más)",
      "Pecho arriba, núcleo firme",
      "Baja hasta profundidad cómoda sin perder tensión",
    ],
    avoid: [
      "Que las rodillas colapsen hacia dentro",
      "Levantar los talones del suelo",
    ],
  },
  {
    slug: "prensa",
    name: "Prensa",
    aliases: ["leg press", "prensa de piernas"],
    muscles: "Cuádriceps, glúteos",
    image: "/exercises/prensa.png",
    summary:
      "Empuje de piernas en máquina. Rango controlado sin bloquear las rodillas de golpe ni levantar la lumbar.",
    cues: [
      "Pies a media plataforma, espalda pegada al respaldo",
      "Baja hasta ~90° de rodilla o sin dolor",
      "Empuja sin despegar el sacro",
    ],
    avoid: [
      "Bloquear rodillas bruscamente arriba",
      "Bajar tan profundo que se redondee la lumbar",
    ],
  },
];

const GENERIC: ExerciseGuide = {
  slug: "generico",
  name: "Ejercicio",
  aliases: [],
  muscles: "Según el movimiento",
  image: "/exercises/ejercicio-generico.png",
  summary:
    "Prioriza técnica estable, rango controlado y respiración. Si no conoces el gesto, pide ayuda o reduce el peso.",
  cues: [
    "Calienta con pocas reps ligeras",
    "Mantén el core activo durante todo el set",
    "Para si aparece dolor articular (no el de esfuerzo)",
  ],
  avoid: ["Forzar el peso sacrificando la forma"],
};

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function findExerciseGuide(name: string): ExerciseGuide {
  const key = normalize(name);
  const found = EXERCISE_CATALOG.find((ex) => {
    const names = [ex.name, ...ex.aliases].map(normalize);
    return names.some((n) => key === n || key.includes(n) || n.includes(key));
  });
  if (found) return found;
  return { ...GENERIC, name };
}

export function catalogNames() {
  return EXERCISE_CATALOG.map((ex) => ex.name);
}
