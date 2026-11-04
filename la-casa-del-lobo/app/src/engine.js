// Motor de juego de La Casa del Lobo (prototipo Fase 2).
// Lógica pura sobre el objeto `game`: sin red, sin disco. El servidor (server.js)
// solo transporta; todas las reglas y validaciones viven aquí (confianza cero, P-13).

import { randomUUID, createHash } from 'node:crypto';

// ── Catálogo de roles del prototipo ─────────────────────────────────────────
export const ROLES = {
  lobo: {
    slug: 'lobo', nombre: 'Lobo', faccion: 'lobos',
    descripcion: 'Eres uno de los lobos. Conoces a tu manada. Cada noche votaréis juntos una víctima.',
    objetivo: 'Igualad o superad en número a los humanos sin ser descubiertos.',
  },
  alfa: {
    slug: 'alfa', nombre: 'Lobo Alfa', faccion: 'lobos',
    descripcion: 'Lideras la manada. Tu olor engaña: el Detective te verá como inocente.',
    objetivo: 'Igualad o superad en número a los humanos sin ser descubiertos.',
  },
  saboteador: {
    slug: 'saboteador', nombre: 'Saboteador', faccion: 'lobos',
    descripcion: 'Perteneces a la manada. Cada noche puedes además corromper una prueba: quedará inutilizada durante la siguiente exploración.',
    objetivo: 'Frena la investigación y protege a la manada.',
  },
  medico: {
    slug: 'medico', nombre: 'Médico', faccion: 'humanos',
    descripcion: 'Cada noche eliges a quién proteger de los lobos. No puedes repetir objetivo dos noches seguidas y solo puedes protegerte a ti una vez por partida.',
    objetivo: 'Descubre a los lobos y mantén con vida a los tuyos.',
  },
  detective: {
    slug: 'detective', nombre: 'Detective', faccion: 'humanos',
    descripcion: 'Cada noche investigas a un jugador y sabrás si huele a lobo… aunque dicen que el Alfa no deja rastro.',
    objetivo: 'Descubre a los lobos y haz que la asamblea los elimine.',
  },
  civil: {
    slug: 'civil', nombre: 'Civil', faccion: 'humanos',
    descripcion: 'No tienes poderes, pero tienes ojos, oídos y un voto. Las pruebas de la casa esconden la verdad.',
    objetivo: 'Descubre a los lobos y sobrevive.',
  },
};

export const FASES = ['lobby', 'exploracion', 'noche', 'resolucion', 'debate', 'votacion', 'cierre', 'fin'];

const DECOY_OPCIONES = [
  'Atrancas la puerta de tu habitación',
  'Espías el pasillo por la cerradura',
  'Finges dormir y escuchas en la oscuridad',
];

// ── Utilidades ──────────────────────────────────────────────────────────────
export function normalizar(texto) {
  return String(texto ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function hashRespuesta(salt, respuesta) {
  return createHash('sha256').update(salt + '::' + normalizar(respuesta)).digest('hex');
}

function generarCodigo(rng = Math.random) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sin 0/O ni 1/I
  let out = '';
  for (let i = 0; i < 6; i++) out += chars[Math.floor(rng() * chars.length)];
  return out;
}

function barajar(arr, rng = Math.random) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export class GameError extends Error {}
function exigir(cond, msg) { if (!cond) throw new GameError(msg); }

// ── Reparto por defecto (GDD §3.5, adaptado al prototipo; mínimo 4 para pruebas) ──
export function repartoPorDefecto(n) {
  const lobos = n >= 17 ? 5 : n >= 13 ? 4 : n >= 9 ? 3 : n >= 6 ? 2 : 1;
  const reparto = { lobo: lobos, alfa: 0, saboteador: 0, medico: 0, detective: 0, civil: 0 };
  if (lobos >= 2) { reparto.saboteador = 1; reparto.lobo--; }
  if (lobos >= 3) { reparto.alfa = 1; reparto.lobo--; }
  if (n >= 5) reparto.medico = 1;
  if (n >= 4) reparto.detective = 1;
  reparto.civil = n - Object.values(reparto).reduce((a, b) => a + b, 0) + reparto.civil;
  return reparto;
}

// ── Eventos y notificaciones ────────────────────────────────────────────────
export function addEvento(game, { tipo, publico = true, texto, meta = {} }) {
  game.events.push({
    id: game.events.length + 1,
    ts: Date.now(),
    round: game.round,
    phase: game.phase,
    tipo, publico, texto, meta,
  });
}

export function notificar(game, playerId, { tipo = 'info', mensaje, prioridad = 'info' }) {
  (game.notifs[playerId] ??= []).push({
    id: randomUUID(), ts: Date.now(), tipo, mensaje, prioridad, leida: false,
  });
}

function notificarVivos(game, notif) {
  for (const p of jugadores(game)) if (p.state === 'vivo') notificar(game, p.id, notif);
}

// ── Consultas ───────────────────────────────────────────────────────────────
export function jugadores(game) { return game.players.filter((p) => !p.isAdmin); }
export function vivos(game) { return jugadores(game).filter((p) => p.state === 'vivo'); }
export function lobosVivos(game) { return vivos(game).filter((p) => ROLES[p.role]?.faccion === 'lobos'); }
export function humanosVivos(game) { return vivos(game).filter((p) => ROLES[p.role]?.faccion === 'humanos'); }
export function rondaActual(game) { return game.rounds[game.rounds.length - 1] ?? null; }
export function playerPorToken(game, token) { return game.players.find((p) => p.token === token) ?? null; }
export function playerPorId(game, id) { return game.players.find((p) => p.id === id) ?? null; }

// ── Creación y lobby ────────────────────────────────────────────────────────
export function crearPartida({ nombreNarrador, demo = true, codigosExistentes = new Set(), rng = Math.random }) {
  let code = generarCodigo(rng);
  while (codigosExistentes.has(code)) code = generarCodigo(rng);
  const admin = {
    id: randomUUID(), token: randomUUID(), name: nombreNarrador || 'Narrador',
    isAdmin: true, state: 'narrador', role: null, connected: false,
    lastProtected: null, selfProtectUsed: false,
  };
  const game = {
    code,
    createdAt: Date.now(),
    status: 'lobby',
    phase: 'lobby',
    round: 0,
    phaseEndsAt: null,
    settings: {
      revelarEliminado: 'faccion', // 'rol' | 'faccion' | 'nada'
      empate: 'nadie',             // 'nadie' | 'azar'
      votoRonda1: false,
      timers: { exploracion: 20 * 60, noche: 5 * 60, debate: 10 * 60, votacion: 3 * 60 },
      rolesOverride: null,         // {lobo: n, ...} si el narrador lo ajusta
    },
    players: [admin],
    rooms: [],
    puzzles: [],
    rounds: [],
    events: [],
    notifs: {},
    attempts: {}, // rate-limit: `${playerId}:${puzzleId}` -> ts último intento
    winner: null,
  };
  if (demo) sembrarDemo(game);
  addEvento(game, { tipo: 'partida_creada', texto: `La partida ${code} ha sido creada. La casa espera.` });
  return { game, admin };
}

export function unirse(game, nombre) {
  exigir(game.status === 'lobby', 'La partida ya ha empezado.');
  const name = String(nombre ?? '').trim().slice(0, 24);
  exigir(name.length >= 2, 'Introduce un nombre (mínimo 2 letras).');
  exigir(!game.players.some((p) => normalizar(p.name) === normalizar(name)), 'Ese nombre ya está en uso.');
  exigir(jugadores(game).length < 20, 'La partida está completa (máximo 20 jugadores).');
  const player = {
    id: randomUUID(), token: randomUUID(), name,
    isAdmin: false, state: 'vivo', role: null, connected: false,
    lastProtected: null, selfProtectUsed: false,
  };
  game.players.push(player);
  addEvento(game, { tipo: 'jugador_unido', texto: `${name} ha llegado a la casa.` });
  return player;
}

// ── Inicio y reparto secreto ────────────────────────────────────────────────
export function empezarPartida(game, actor, rng = Math.random) {
  exigir(actor.isAdmin, 'Solo el narrador puede empezar la partida.');
  exigir(game.status === 'lobby', 'La partida ya está en marcha.');
  const js = jugadores(game);
  exigir(js.length >= 4, 'Hacen falta al menos 4 jugadores (6 o más recomendado).');

  const reparto = game.settings.rolesOverride ?? repartoPorDefecto(js.length);
  const total = Object.values(reparto).reduce((a, b) => a + b, 0);
  exigir(total === js.length, `El reparto suma ${total} roles para ${js.length} jugadores.`);
  const nLobos = (reparto.lobo ?? 0) + (reparto.alfa ?? 0) + (reparto.saboteador ?? 0);
  exigir(nLobos >= 1, 'Debe haber al menos un lobo.');
  exigir(nLobos < js.length / 2, 'Demasiados lobos: deben ser menos de la mitad.');

  const bolsa = [];
  for (const [slug, n] of Object.entries(reparto)) for (let i = 0; i < n; i++) bolsa.push(slug);
  const mezclados = barajar(bolsa, rng);
  js.forEach((p, i) => { p.role = mezclados[i]; });

  game.status = 'en_curso';
  nuevaRonda(game);
  addEvento(game, {
    tipo: 'partida_iniciada', publico: true,
    texto: `Las puertas se bloquean. Entre vosotros hay ${nLobos} lobo${nLobos > 1 ? 's' : ''}. Comienza la exploración.`,
  });
  for (const p of js) {
    notificar(game, p.id, {
      tipo: 'rol', prioridad: 'critica',
      mensaje: `Tu destino está sellado: eres ${ROLES[p.role].nombre}. Mantenlo en secreto.`,
    });
  }
  return reparto;
}

function nuevaRonda(game) {
  game.round += 1;
  game.rounds.push({
    number: game.round,
    night: { wolfVotes: {}, protect: {}, investigate: {}, sabotage: {}, decoy: {} },
    votes: {},
    resolution: null,
    voteResult: null,
  });
  entrarFase(game, 'exploracion');
}

function entrarFase(game, fase) {
  game.phase = fase;
  const t = game.settings.timers[fase];
  game.phaseEndsAt = t ? Date.now() + t * 1000 : null;
}

// ── Avance de fases (solo narrador en el prototipo) ─────────────────────────
export function avanzarFase(game, actor) {
  exigir(actor.isAdmin, 'Solo el narrador puede avanzar de fase.');
  exigir(game.status === 'en_curso', 'La partida no está en curso.');

  switch (game.phase) {
    case 'exploracion':
      // El sabotaje dura hasta el final de la exploración siguiente a la noche
      // en que se ejecutó (GDD §3.3): al cerrar la exploración, las pruebas vuelven.
      for (const pz of game.puzzles) if (pz.estado === 'saboteada') pz.estado = 'disponible';
      entrarFase(game, 'noche');
      addEvento(game, { tipo: 'fase', texto: 'La noche ha caído sobre la casa. Buscad refugio y mirad vuestro móvil: todos tenéis algo que hacer.' });
      notificarVivos(game, { tipo: 'fase', prioridad: 'alta', mensaje: 'La noche ha comenzado. Abre tu acción nocturna.' });
      break;

    case 'noche': {
      entrarFase(game, 'resolucion');
      resolverNoche(game);
      break;
    }

    case 'resolucion':
      if (comprobarVictoria(game)) return;
      entrarFase(game, 'debate');
      addEvento(game, { tipo: 'fase', texto: 'Amanece. Reuníos: es la hora del debate.' });
      break;

    case 'debate':
      if (game.round === 1 && !game.settings.votoRonda1) {
        entrarFase(game, 'cierre');
        addEvento(game, { tipo: 'fase', texto: 'La primera asamblea se disuelve sin juicio. La casa aún guarda silencio.' });
      } else {
        entrarFase(game, 'votacion');
        addEvento(game, { tipo: 'fase', texto: 'Se ha convocado la votación. Elegid a vuestro sospechoso en secreto.' });
        notificarVivos(game, { tipo: 'votacion', prioridad: 'alta', mensaje: 'La votación está abierta. Tu voto es secreto y puedes cambiarlo hasta el cierre.' });
      }
      break;

    case 'votacion':
      entrarFase(game, 'cierre');
      sellarVotacion(game);
      break;

    case 'cierre':
      if (comprobarVictoria(game)) return;
      nuevaRonda(game);
      addEvento(game, { tipo: 'fase', texto: `Comienza la ronda ${game.round}. La casa vuelve a abrirse.` });
      break;

    default:
      throw new GameError(`No se puede avanzar desde la fase ${game.phase}.`);
  }
}

// ── Acciones nocturnas ──────────────────────────────────────────────────────
export function accionNocturna(game, player, { tipo, targetId, puzzleId, opcion }) {
  exigir(game.phase === 'noche', 'No es de noche.');
  exigir(!player.isAdmin, 'El narrador no tiene acción nocturna.');
  exigir(player.state === 'vivo', 'Los fantasmas no actúan de noche (todavía).');
  const ronda = rondaActual(game);
  const rol = ROLES[player.role];

  switch (tipo) {
    case 'matar': {
      exigir(rol.faccion === 'lobos', 'Tu rol no participa en la caza.');
      const objetivo = playerPorId(game, targetId);
      exigir(objetivo && objetivo.state === 'vivo' && !objetivo.isAdmin, 'Objetivo no válido.');
      exigir(ROLES[objetivo.role].faccion !== 'lobos', 'La manada no se devora a sí misma.');
      ronda.night.wolfVotes[player.id] = objetivo.id;
      break;
    }
    case 'proteger': {
      exigir(player.role === 'medico', 'No eres el Médico.');
      const objetivo = playerPorId(game, targetId);
      exigir(objetivo && objetivo.state === 'vivo' && !objetivo.isAdmin, 'Objetivo no válido.');
      exigir(objetivo.id !== player.lastProtected, 'No puedes proteger a la misma persona dos noches seguidas.');
      if (objetivo.id === player.id) exigir(!player.selfProtectUsed, 'Solo puedes protegerte a ti mismo una vez por partida.');
      ronda.night.protect[player.id] = objetivo.id;
      break;
    }
    case 'investigar': {
      exigir(player.role === 'detective', 'No eres el Detective.');
      const objetivo = playerPorId(game, targetId);
      exigir(objetivo && objetivo.state === 'vivo' && !objetivo.isAdmin, 'Objetivo no válido.');
      exigir(objetivo.id !== player.id, 'Investigarte a ti mismo no te dirá nada nuevo.');
      ronda.night.investigate[player.id] = objetivo.id;
      break;
    }
    case 'sabotear': {
      exigir(player.role === 'saboteador', 'No eres el Saboteador.');
      const pz = game.puzzles.find((x) => x.id === puzzleId);
      exigir(pz, 'Prueba no encontrada.');
      exigir(pz.estado === 'disponible', 'Esa prueba no se puede sabotear.');
      ronda.night.sabotage[player.id] = pz.id;
      break;
    }
    case 'decoy': {
      exigir(Number.isInteger(opcion) && opcion >= 0 && opcion < DECOY_OPCIONES.length, 'Opción no válida.');
      ronda.night.decoy[player.id] = opcion;
      break;
    }
    default:
      throw new GameError('Acción nocturna desconocida.');
  }
}

export function opcionesDecoy() { return [...DECOY_OPCIONES]; }

// ── Resolución nocturna determinista (GDD §6.4) ─────────────────────────────
export function resolverNoche(game, rng = Math.random) {
  const ronda = rondaActual(game);
  const protegidos = new Set(Object.values(ronda.night.protect));

  // Memoria del Médico (no repetir objetivo; autoprotección única)
  for (const [medicoId, targetId] of Object.entries(ronda.night.protect)) {
    const medico = playerPorId(game, medicoId);
    if (medico) {
      medico.lastProtected = targetId;
      if (targetId === medicoId) medico.selfProtectUsed = true;
    }
  }

  // Voto de manada: pluralidad; empate → sin víctima
  const recuento = {};
  for (const t of Object.values(ronda.night.wolfVotes)) recuento[t] = (recuento[t] ?? 0) + 1;
  let victimaId = null;
  const max = Math.max(0, ...Object.values(recuento));
  if (max > 0) {
    const lideres = Object.keys(recuento).filter((t) => recuento[t] === max);
    if (lideres.length === 1) victimaId = lideres[0];
  }

  let textoPublico;
  let muerto = null;
  if (!victimaId) {
    textoPublico = 'La noche pasó en un silencio extraño. Nadie ha desaparecido… esta vez.';
  } else if (protegidos.has(victimaId)) {
    textoPublico = 'Se oyeron arañazos en una puerta durante la madrugada, pero alguien veló por su presa. Nadie ha muerto.';
  } else {
    muerto = playerPorId(game, victimaId);
    muerto.state = 'fantasma';
    muerto.diedRound = game.round;
    textoPublico = `Al amanecer, ${muerto.name} no responde. La casa se ha cobrado una víctima.`;
    notificar(game, muerto.id, {
      tipo: 'muerte', prioridad: 'critica',
      mensaje: 'Tu destino ha cambiado: ahora eres un fantasma. Pacto de Silencio: no hables de la partida con los vivos. El Otro Lado se abrirá en próximas versiones.',
    });
  }

  // Investigación del Detective (el Alfa engaña)
  for (const [detId, targetId] of Object.entries(ronda.night.investigate)) {
    const objetivo = playerPorId(game, targetId);
    const esLobo = ROLES[objetivo.role].faccion === 'lobos' && objetivo.role !== 'alfa';
    notificar(game, detId, {
      tipo: 'investigacion', prioridad: 'alta',
      mensaje: `Tu investigación sobre ${objetivo.name}: ${esLobo ? 'HUELE A LOBO.' : 'no huele a lobo.'}`,
    });
  }

  // Sabotaje (anónimo, retrasa una ronda)
  const saboteadas = [];
  for (const pzId of Object.values(ronda.night.sabotage)) {
    const pz = game.puzzles.find((x) => x.id === pzId);
    if (pz && pz.estado === 'disponible') {
      pz.estado = 'saboteada';
      saboteadas.push(pz);
    }
  }

  ronda.resolution = {
    victimaId, protegido: victimaId ? protegidos.has(victimaId) : false,
    muertoId: muerto?.id ?? null,
    saboteadas: saboteadas.map((p) => p.id),
    textoPublico,
  };
  addEvento(game, { tipo: 'resolucion', texto: textoPublico, meta: { muertoId: muerto?.id ?? null } });
  for (const pz of saboteadas) {
    addEvento(game, { tipo: 'sabotaje', texto: `La prueba «${pz.nombre}» (${nombreSala(game, pz.roomId)}) ha amanecido forzada e inutilizada. Alguien no quiere que se resuelva.` });
  }
  comprobarVictoria(game);
  return ronda.resolution;
}

// ── Votación de asamblea ────────────────────────────────────────────────────
export function votar(game, player, targetId) {
  exigir(game.phase === 'votacion', 'La votación no está abierta.');
  exigir(!player.isAdmin, 'El narrador no vota.');
  exigir(player.state === 'vivo', 'Los muertos no votan.');
  if (targetId !== 'abstencion') {
    const objetivo = playerPorId(game, targetId);
    exigir(objetivo && objetivo.state === 'vivo' && !objetivo.isAdmin, 'Objetivo no válido.');
    exigir(objetivo.id !== player.id, 'No puedes votarte a ti mismo.');
  }
  rondaActual(game).votes[player.id] = targetId; // upsert: cambiable hasta el cierre
}

export function sellarVotacion(game, rng = Math.random) {
  const ronda = rondaActual(game);
  const recuento = {};
  let abstenciones = 0;
  const vivosAhora = vivos(game);
  for (const p of vivosAhora) {
    const v = ronda.votes[p.id];
    if (!v || v === 'abstencion') abstenciones++;
    else recuento[v] = (recuento[v] ?? 0) + 1;
  }
  const max = Math.max(0, ...Object.values(recuento));
  let eliminadoId = null;
  let empate = false;
  if (max > 0) {
    const lideres = Object.keys(recuento).filter((t) => recuento[t] === max);
    if (lideres.length === 1) eliminadoId = lideres[0];
    else {
      empate = true;
      if (game.settings.empate === 'azar') eliminadoId = lideres[Math.floor(rng() * lideres.length)];
    }
  }

  let texto;
  if (!eliminadoId) {
    texto = empate
      ? 'La asamblea no logró ponerse de acuerdo: empate. Nadie ha sido expulsado.'
      : 'La asamblea guardó silencio. Nadie ha sido expulsado.';
  } else {
    const eliminado = playerPorId(game, eliminadoId);
    eliminado.state = 'fantasma';
    eliminado.diedRound = game.round;
    const rol = ROLES[eliminado.role];
    const revela = game.settings.revelarEliminado;
    const revelacion = revela === 'rol' ? ` Era ${rol.nombre}.`
      : revela === 'faccion' ? ` Pertenecía a la facción de los ${rol.faccion === 'lobos' ? 'lobos' : 'humanos'}.`
      : '';
    texto = `La asamblea ha condenado a ${eliminado.name}.${revelacion}`;
    notificar(game, eliminado.id, {
      tipo: 'muerte', prioridad: 'critica',
      mensaje: 'La asamblea te ha condenado. Ahora eres un fantasma. Pacto de Silencio: no hables de la partida con los vivos.',
    });
  }

  const recuentoNombres = Object.fromEntries(
    Object.entries(recuento).map(([id, n]) => [playerPorId(game, id)?.name ?? '?', n])
  );
  ronda.voteResult = { recuento: recuentoNombres, abstenciones, eliminadoId, empate, texto };
  addEvento(game, { tipo: 'votacion', texto, meta: { recuento: recuentoNombres, abstenciones } });
  comprobarVictoria(game);
  return ronda.voteResult;
}

// ── Condiciones de victoria ─────────────────────────────────────────────────
export function comprobarVictoria(game) {
  if (game.status !== 'en_curso') return game.winner;
  const nLobos = lobosVivos(game).length;
  const nHumanos = humanosVivos(game).length;
  let winner = null;
  if (nLobos === 0) {
    winner = { faccion: 'humanos', texto: 'El último lobo ha caído. Al amanecer, las puertas de la casa se abren solas. Los humanos han sobrevivido para contarlo.' };
  } else if (nLobos >= nHumanos) {
    winner = { faccion: 'lobos', texto: 'Los aullidos ya no se esconden. La manada iguala a sus presas: la casa pertenece a los lobos.' };
  }
  if (winner) {
    game.winner = winner;
    game.status = 'finalizada';
    game.phase = 'fin';
    game.phaseEndsAt = null;
    addEvento(game, { tipo: 'fin', texto: winner.texto, meta: { faccion: winner.faccion } });
  }
  return winner;
}

// ── Pruebas (escape room, subconjunto Fase 3) ───────────────────────────────
function nombreSala(game, roomId) {
  return game.rooms.find((r) => r.id === roomId)?.nombre ?? '¿?';
}

export function crearSala(game, actor, nombre) {
  exigir(actor.isAdmin, 'Solo el narrador crea habitaciones.');
  const n = String(nombre ?? '').trim().slice(0, 40);
  exigir(n.length >= 2, 'Nombre de habitación no válido.');
  const room = { id: randomUUID(), nombre: n };
  game.rooms.push(room);
  return room;
}

export function crearPrueba(game, actor, { roomId, nombre, descripcion, respuesta, pista = '', recompensa = '', fisico = '' }) {
  exigir(actor.isAdmin, 'Solo el narrador crea pruebas.');
  const room = game.rooms.find((r) => r.id === roomId);
  exigir(room, 'Habitación no encontrada.');
  exigir(String(nombre ?? '').trim().length >= 2, 'La prueba necesita un nombre.');
  exigir(normalizar(respuesta).length >= 1, 'La prueba necesita una respuesta verificable.');
  const salt = randomUUID();
  const pz = {
    id: randomUUID(), roomId,
    nombre: String(nombre).trim().slice(0, 60),
    descripcion: String(descripcion ?? '').trim().slice(0, 500),
    pista: String(pista ?? '').trim().slice(0, 300),
    recompensa: String(recompensa ?? '').trim().slice(0, 200),
    fisico: String(fisico ?? '').trim().slice(0, 300), // checklist de montaje para el narrador
    salt,
    answerHash: hashRespuesta(salt, respuesta),
    answerPlainAdmin: String(respuesta).trim(), // SOLO visible en la vista del narrador (checklist)
    estado: 'disponible',
    completadaPor: null,
    completadaEn: null,
  };
  game.puzzles.push(pz);
  return pz;
}

export function borrarPrueba(game, actor, puzzleId) {
  exigir(actor.isAdmin, 'Solo el narrador borra pruebas.');
  const i = game.puzzles.findIndex((p) => p.id === puzzleId);
  exigir(i >= 0, 'Prueba no encontrada.');
  game.puzzles.splice(i, 1);
}

const RATE_LIMIT_MS = 15_000;

export function responderPrueba(game, player, puzzleId, respuesta, now = Date.now()) {
  exigir(game.status === 'en_curso', 'La partida no está en curso.');
  exigir(game.phase === 'exploracion', 'Las pruebas solo pueden resolverse durante la exploración.');
  exigir(!player.isAdmin, 'El narrador no resuelve pruebas.');
  exigir(player.state === 'vivo', 'Los fantasmas no pueden tocar las pruebas de los vivos.');
  const pz = game.puzzles.find((x) => x.id === puzzleId);
  exigir(pz, 'Prueba no encontrada.');
  exigir(pz.estado === 'disponible', pz.estado === 'saboteada'
    ? 'Esta prueba está inutilizada: alguien la ha forzado esta noche.'
    : 'Esta prueba ya está completada.');

  const key = `${player.id}:${pz.id}`;
  const ultimo = game.attempts[key] ?? 0;
  exigir(now - ultimo >= RATE_LIMIT_MS, `Espera ${Math.ceil((RATE_LIMIT_MS - (now - ultimo)) / 1000)} s antes de volver a intentarlo.`);
  game.attempts[key] = now;

  const acierto = hashRespuesta(pz.salt, respuesta) === pz.answerHash;
  if (acierto) {
    pz.estado = 'completada';
    pz.completadaPor = player.id;
    pz.completadaEn = now;
    addEvento(game, { tipo: 'prueba', texto: `${player.name} ha resuelto «${pz.nombre}» en ${nombreSala(game, pz.roomId)}.` });
    if (pz.recompensa) {
      notificar(game, player.id, { tipo: 'recompensa', prioridad: 'alta', mensaje: `Recompensa de «${pz.nombre}»: ${pz.recompensa}` });
    }
  }
  return { acierto };
}

// ── Herramientas del narrador (modo emergencia, GDD §12) ────────────────────
export function adminMatar(game, actor, targetId) {
  exigir(actor.isAdmin, 'Solo el narrador.');
  const p = playerPorId(game, targetId);
  exigir(p && !p.isAdmin && p.state === 'vivo', 'Jugador no válido.');
  p.state = 'fantasma';
  p.diedRound = game.round;
  addEvento(game, { tipo: 'emergencia', texto: `${p.name} ha desaparecido por designio del narrador.` });
  notificar(game, p.id, { tipo: 'muerte', prioridad: 'critica', mensaje: 'El narrador ha sellado tu destino: ahora eres un fantasma.' });
  comprobarVictoria(game);
}

export function adminRevivir(game, actor, targetId) {
  exigir(actor.isAdmin, 'Solo el narrador.');
  const p = playerPorId(game, targetId);
  exigir(p && !p.isAdmin && p.state === 'fantasma', 'Jugador no válido.');
  p.state = 'vivo';
  addEvento(game, { tipo: 'emergencia', texto: `${p.name} ha vuelto a la vida. La casa tiene caprichos extraños.` });
  notificar(game, p.id, { tipo: 'vida', prioridad: 'critica', mensaje: 'El narrador te ha devuelto a la vida. Vuelves al juego.' });
}

export function adminMensaje(game, actor, { targetId = null, mensaje }) {
  exigir(actor.isAdmin, 'Solo el narrador.');
  const m = String(mensaje ?? '').trim().slice(0, 300);
  exigir(m.length >= 1, 'Mensaje vacío.');
  if (targetId) {
    const p = playerPorId(game, targetId);
    exigir(p, 'Jugador no encontrado.');
    notificar(game, p.id, { tipo: 'narrador', prioridad: 'alta', mensaje: `El narrador susurra: ${m}` });
  } else {
    addEvento(game, { tipo: 'narrador', texto: m });
    for (const p of jugadores(game)) notificar(game, p.id, { tipo: 'narrador', prioridad: 'alta', mensaje: m });
  }
}

export function adminAjustes(game, actor, ajustes) {
  exigir(actor.isAdmin, 'Solo el narrador.');
  exigir(game.status === 'lobby', 'Los ajustes solo se cambian en la sala de espera.');
  const s = game.settings;
  if (ajustes.revelarEliminado && ['rol', 'faccion', 'nada'].includes(ajustes.revelarEliminado)) s.revelarEliminado = ajustes.revelarEliminado;
  if (ajustes.empate && ['nadie', 'azar'].includes(ajustes.empate)) s.empate = ajustes.empate;
  if (typeof ajustes.votoRonda1 === 'boolean') s.votoRonda1 = ajustes.votoRonda1;
  if (ajustes.rolesOverride === null) s.rolesOverride = null;
  else if (ajustes.rolesOverride && typeof ajustes.rolesOverride === 'object') {
    const limpio = {};
    for (const slug of Object.keys(ROLES)) {
      const v = Number(ajustes.rolesOverride[slug] ?? 0);
      exigir(Number.isInteger(v) && v >= 0 && v <= 20, 'Reparto no válido.');
      limpio[slug] = v;
    }
    s.rolesOverride = limpio;
  }
  if (ajustes.timers && typeof ajustes.timers === 'object') {
    for (const k of ['exploracion', 'noche', 'debate', 'votacion']) {
      const v = Number(ajustes.timers[k]);
      if (Number.isInteger(v) && v >= 30 && v <= 7200) s.timers[k] = v;
    }
  }
}

// ── Contenido demo del escenario base ───────────────────────────────────────
export function sembrarDemo(game) {
  const salas = {};
  for (const n of ['Salón', 'Cocina', 'Dormitorio', 'Baño', 'Sótano', 'Jardín']) {
    const room = { id: randomUUID(), nombre: n };
    game.rooms.push(room);
    salas[n] = room;
  }
  const demo = [
    ['Salón', 'El reloj parado', 'El viejo reloj del salón se detuvo en la hora en que todo empezó. Introduce las 4 cifras (HHMM).', '2147',
      'Mira la esfera: las agujas no mienten.', 'Fragmento del Expediente nº 1', 'Parar un reloj (o dibujarlo en papel) marcando las 21:47 y dejarlo visible en el salón.'],
    ['Salón', 'El retrato familiar', '¿Cuántos lobos se esconden en el cuadro de la familia Garralda?', '3',
      'Algunos lobos no tienen forma de lobo: busca ojos ámbar.', 'Pista: la manada era pequeña', 'Imprimir/dibujar un retrato con 3 lobos camuflados y colgarlo en el salón.'],
    ['Cocina', 'La despensa cerrada', 'Un candado protege la despensa. Dentro hay una tarjeta con una palabra: escríbela aquí.', 'CENIZA',
      'El código del candado está en la receta clavada en el corcho.', 'Llave del sótano (narrativa)', 'Candado de 4 dígitos (código a tu elección) en un armario; dentro, tarjeta con la palabra CENIZA.'],
    ['Cocina', 'La receta cifrada', 'La receta de la abuela esconde un ingrediente imposible, escrito al revés. ¿Cuál es?', 'BELLADONA',
      'Léela frente a un espejo.', 'Fragmento del Expediente nº 2', 'Escribir una receta con la palabra ANODALLEB intercalada y dejarla en la cocina.'],
    ['Dormitorio', 'Bajo el colchón', 'Alguien durmió aquí su última noche y escondió una advertencia de dos palabras. Encuéntrala.', 'LUNA LLENA',
      'Los secretos pesan: busca debajo de donde se sueña.', 'Pista sobre la próxima noche', 'Tarjeta con «LUNA LLENA» escondida bajo un colchón.'],
    ['Baño', 'El mensaje del espejo', 'Con el vaho del agua caliente, una palabra aparece en el espejo. ¿Qué palabra es?', 'AULLIDO',
      'El vapor revela lo que el dedo escribió.', 'Fragmento del Expediente nº 3', 'Escribir AULLIDO con el dedo en el espejo (o tarjeta pegada detrás del espejo).'],
    ['Sótano', 'La caja del cazador', 'La caja del viejo cazador solo se abre con el nombre del único metal que temen. ', 'PLATA',
      'Las leyendas aciertan más de lo que crees.', 'Amuleto del cazador (narrativa)', 'Caja o sobre en el sótano con la pregunta impresa; dentro, la siguiente pista física.'],
    ['Jardín', 'Huellas en la tierra', 'Junto al pozo hay huellas de un animal enorme. ¿Cuántos dedos marca cada pisada?', '4',
      'Cuenta solo lo que se clava en el barro.', 'Fragmento del Expediente nº 4', 'Dibujar/imprimir huellas de lobo (4 dedos) y colocarlas junto a una maceta o el acceso al jardín.'],
  ];
  for (const [sala, nombre, descripcion, respuesta, pista, recompensa, fisico] of demo) {
    const salt = randomUUID();
    game.puzzles.push({
      id: randomUUID(), roomId: salas[sala].id,
      nombre, descripcion, pista, recompensa, fisico, salt,
      answerHash: hashRespuesta(salt, respuesta),
      answerPlainAdmin: respuesta,
      estado: 'disponible', completadaPor: null, completadaEn: null,
    });
  }
}
