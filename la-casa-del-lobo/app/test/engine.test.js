import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../src/engine.js';

// ── Utilidades de test ────────────────────────────────────────────────────────
function partidaConJugadores(n, { demo = false } = {}) {
  const { game, admin } = E.crearPartida({ nombreNarrador: 'Narrador', demo });
  const players = [];
  for (let i = 0; i < n; i++) players.push(E.unirse(game, `Jugador${i + 1}`));
  return { game, admin, players };
}

function porRol(game, slug) {
  return E.jugadores(game).filter((p) => p.role === slug);
}

function empezada(n, opts) {
  const ctx = partidaConJugadores(n, opts);
  E.empezarPartida(ctx.game, ctx.admin);
  return ctx;
}

// ── Reparto de roles ─────────────────────────────────────────────────────────
test('reparto por defecto respeta las cantidades del GDD §3.5', () => {
  const casos = [
    [6, 2], [8, 2], [9, 3], [12, 3], [13, 4], [16, 4], [17, 5], [20, 5],
  ];
  for (const [n, lobosEsperados] of casos) {
    const r = E.repartoPorDefecto(n);
    const total = Object.values(r).reduce((a, b) => a + b, 0);
    const lobos = r.lobo + r.alfa + r.saboteador;
    assert.equal(total, n, `total para ${n}`);
    assert.equal(lobos, lobosEsperados, `lobos para ${n}`);
    assert.ok(r.medico === 1 && r.detective === 1, `especiales para ${n}`);
  }
});

test('el reparto asigna un rol secreto a cada jugador y nunca al narrador', () => {
  const { game, admin } = empezada(10);
  for (const p of E.jugadores(game)) assert.ok(E.ROLES[p.role], `${p.name} tiene rol`);
  assert.equal(admin.role, null);
  assert.equal(game.phase, 'exploracion');
  assert.equal(game.round, 1);
});

test('no se puede empezar con menos de 4 jugadores ni dos veces', () => {
  const { game, admin } = partidaConJugadores(3);
  assert.throws(() => E.empezarPartida(game, admin), /al menos 4/);
  E.unirse(game, 'Cuarto');
  E.empezarPartida(game, admin);
  assert.throws(() => E.empezarPartida(game, admin), /ya está en marcha/);
});

test('un jugador no admin no puede empezar la partida ni avanzar fases', () => {
  const { game, players } = partidaConJugadores(6);
  assert.throws(() => E.empezarPartida(game, players[0]), /narrador/);
});

// ── Noche y resolución ───────────────────────────────────────────────────────
test('la víctima de la manada muere si no está protegida', () => {
  const { game, admin } = empezada(8);
  const lobo = E.lobosVivos(game)[0];
  const victima = E.humanosVivos(game)[0];
  E.avanzarFase(game, admin); // exploracion → noche
  E.accionNocturna(game, lobo, { tipo: 'matar', targetId: victima.id });
  E.avanzarFase(game, admin); // noche → resolucion (resuelve)
  assert.equal(victima.state, 'fantasma');
  assert.equal(victima.diedRound, 1);
});

test('la protección del médico salva a la víctima', () => {
  const { game, admin } = empezada(8);
  const lobo = E.lobosVivos(game)[0];
  const medico = porRol(game, 'medico')[0];
  const victima = E.humanosVivos(game).find((p) => p.id !== medico.id);
  E.avanzarFase(game, admin);
  E.accionNocturna(game, lobo, { tipo: 'matar', targetId: victima.id });
  E.accionNocturna(game, medico, { tipo: 'proteger', targetId: victima.id });
  E.avanzarFase(game, admin);
  assert.equal(victima.state, 'vivo');
  assert.match(E.rondaActual(game).resolution.textoPublico, /Nadie ha muerto/);
});

test('empate en el voto de manada: no hay víctima', () => {
  const { game, admin } = empezada(9); // 3 lobos
  const lobos = E.lobosVivos(game);
  const [h1, h2] = E.humanosVivos(game);
  E.avanzarFase(game, admin);
  E.accionNocturna(game, lobos[0], { tipo: 'matar', targetId: h1.id });
  E.accionNocturna(game, lobos[1], { tipo: 'matar', targetId: h2.id });
  E.avanzarFase(game, admin);
  assert.equal(h1.state, 'vivo');
  assert.equal(h2.state, 'vivo');
});

test('el médico no puede repetir objetivo dos noches seguidas', () => {
  const { game, admin } = empezada(8);
  const medico = porRol(game, 'medico')[0];
  const objetivo = E.humanosVivos(game).find((p) => p.id !== medico.id);
  E.avanzarFase(game, admin);
  E.accionNocturna(game, medico, { tipo: 'proteger', targetId: objetivo.id });
  E.avanzarFase(game, admin); // resolucion
  E.avanzarFase(game, admin); // debate
  E.avanzarFase(game, admin); // cierre (ronda 1 sin voto)
  E.avanzarFase(game, admin); // nueva ronda → exploracion
  E.avanzarFase(game, admin); // noche
  assert.throws(() => E.accionNocturna(game, medico, { tipo: 'proteger', targetId: objetivo.id }), /dos noches seguidas/);
});

test('el detective detecta lobos, pero el alfa engaña', () => {
  const { game, admin } = empezada(10); // 3 lobos: lobo + alfa + saboteador
  const detective = porRol(game, 'detective')[0];
  const alfa = porRol(game, 'alfa')[0];
  const lobo = porRol(game, 'lobo')[0];

  E.avanzarFase(game, admin);
  E.accionNocturna(game, detective, { tipo: 'investigar', targetId: lobo.id });
  E.avanzarFase(game, admin);
  let notifs = game.notifs[detective.id].filter((n) => n.tipo === 'investigacion');
  assert.match(notifs.at(-1).mensaje, /HUELE A LOBO/);

  E.avanzarFase(game, admin); E.avanzarFase(game, admin); E.avanzarFase(game, admin); // → ronda 2, noche
  E.avanzarFase(game, admin);
  E.accionNocturna(game, detective, { tipo: 'investigar', targetId: alfa.id });
  E.avanzarFase(game, admin);
  notifs = game.notifs[detective.id].filter((n) => n.tipo === 'investigacion');
  assert.match(notifs.at(-1).mensaje, /no huele a lobo/);
});

test('los lobos no pueden matar a un lobo y los muertos no actúan', () => {
  const { game, admin } = empezada(9);
  const [lobo1, lobo2] = E.lobosVivos(game);
  E.avanzarFase(game, admin);
  assert.throws(() => E.accionNocturna(game, lobo1, { tipo: 'matar', targetId: lobo2.id }), /manada/);
  const civil = porRol(game, 'civil')[0];
  civil.state = 'fantasma';
  assert.throws(() => E.accionNocturna(game, civil, { tipo: 'decoy', opcion: 0 }), /fantasmas/i);
});

test('sabotaje: la prueba queda inutilizada durante la exploración siguiente y después vuelve', () => {
  const { game, admin } = empezada(9, { demo: true });
  const saboteador = porRol(game, 'saboteador')[0];
  const pz = game.puzzles[0];
  E.avanzarFase(game, admin); // noche R1
  E.accionNocturna(game, saboteador, { tipo: 'sabotear', puzzleId: pz.id });
  E.avanzarFase(game, admin); // resolución R1
  assert.equal(pz.estado, 'saboteada');
  E.avanzarFase(game, admin); // debate
  E.avanzarFase(game, admin); // cierre (R1 sin voto)
  E.avanzarFase(game, admin); // exploración R2: sigue saboteada
  assert.equal(game.phase, 'exploracion');
  const civil = porRol(game, 'civil')[0];
  assert.throws(() => E.responderPrueba(game, civil, pz.id, 'lo que sea'), /inutilizada/);
  E.avanzarFase(game, admin); // noche R2: la prueba se recupera
  assert.equal(pz.estado, 'disponible');
});

// ── Votación ─────────────────────────────────────────────────────────────────
function llegarAVotacion(game, admin) {
  E.avanzarFase(game, admin); // noche
  E.avanzarFase(game, admin); // resolucion (sin acciones)
  E.avanzarFase(game, admin); // debate
  E.avanzarFase(game, admin); // cierre (R1 sin voto)
  E.avanzarFase(game, admin); // ronda 2 exploracion
  E.avanzarFase(game, admin); // noche
  E.avanzarFase(game, admin); // resolucion
  E.avanzarFase(game, admin); // debate
  E.avanzarFase(game, admin); // votacion
  assert.equal(game.phase, 'votacion');
}

test('mayoría simple elimina; el voto es cambiable y único por votante', () => {
  const { game, admin } = empezada(8);
  llegarAVotacion(game, admin);
  const vs = E.vivos(game);
  const [a, b, c, d] = vs;
  E.votar(game, a, b.id);
  E.votar(game, a, c.id); // cambia su voto
  E.votar(game, b, c.id);
  E.votar(game, d, c.id);
  for (const otro of vs.slice(4)) E.votar(game, otro, 'abstencion');
  E.avanzarFase(game, admin); // cierra y sella
  assert.equal(c.state, 'fantasma');
  const r = E.rondaActual(game).voteResult;
  assert.equal(r.recuento[c.name], 3);
  assert.equal(r.recuento[b.name], undefined); // el cambio de voto no deja rastro
});

test('empate con regla "nadie": no muere nadie', () => {
  const { game, admin } = empezada(8);
  llegarAVotacion(game, admin);
  const [a, b] = E.vivos(game);
  E.votar(game, a, b.id);
  E.votar(game, b, a.id);
  E.avanzarFase(game, admin);
  assert.equal(a.state, 'vivo');
  assert.equal(b.state, 'vivo');
  assert.equal(E.rondaActual(game).voteResult.empate, true);
});

test('empate con regla "azar": muere uno de los empatados', () => {
  const { game, admin } = empezada(8);
  game.settings.empate = 'azar';
  llegarAVotacion(game, admin);
  const [a, b] = E.vivos(game);
  E.votar(game, a, b.id);
  E.votar(game, b, a.id);
  E.avanzarFase(game, admin);
  const muertos = [a, b].filter((p) => p.state === 'fantasma');
  assert.equal(muertos.length, 1);
});

test('los muertos y el narrador no pueden votar; nadie vota fuera de fase', () => {
  const { game, admin, players } = empezada(8);
  assert.throws(() => E.votar(game, players[0], players[1].id), /no está abierta/);
  llegarAVotacion(game, admin);
  const fantasma = E.vivos(game)[0];
  fantasma.state = 'fantasma';
  assert.throws(() => E.votar(game, fantasma, E.vivos(game)[0].id), /muertos no votan/i);
  assert.throws(() => E.votar(game, admin, E.vivos(game)[0].id), /narrador/);
});

// ── Victoria ─────────────────────────────────────────────────────────────────
test('victoria humana al caer el último lobo', () => {
  const { game, admin } = empezada(6); // 2 lobos
  for (const lobo of E.lobosVivos(game)) E.adminMatar(game, admin, lobo.id);
  assert.equal(game.status, 'finalizada');
  assert.equal(game.winner.faccion, 'humanos');
});

test('victoria de los lobos al igualar a los humanos', () => {
  const { game, admin } = empezada(6); // 2 lobos, 4 humanos
  const humanos = E.humanosVivos(game);
  E.adminMatar(game, admin, humanos[0].id);
  assert.equal(game.status, 'en_curso');
  E.adminMatar(game, admin, humanos[1].id); // 2 vs 2
  assert.equal(game.winner.faccion, 'lobos');
  assert.equal(game.phase, 'fin');
});

// ── Pruebas (escape room) ────────────────────────────────────────────────────
test('respuesta correcta con normalización de tildes/mayúsculas; hash sin texto plano accesible al jugador', () => {
  const { game, admin } = empezada(6, { demo: true });
  const civil = porRol(game, 'civil')[0] ?? E.humanosVivos(game)[0];
  const pz = game.puzzles.find((p) => p.answerPlainAdmin === 'BELLADONA');
  const r1 = E.responderPrueba(game, civil, pz.id, '  belladóna ', Date.now());
  assert.equal(r1.acierto, true);
  assert.equal(pz.estado, 'completada');
  assert.equal(pz.completadaPor, civil.id);
  assert.notEqual(pz.answerHash, 'BELLADONA');
});

test('rate limit: dos intentos seguidos del mismo jugador se bloquean 15 s', () => {
  const { game } = empezada(6, { demo: true });
  const jugador = E.vivos(game)[0];
  const pz = game.puzzles[0];
  const t0 = Date.now();
  E.responderPrueba(game, jugador, pz.id, 'mal', t0);
  assert.throws(() => E.responderPrueba(game, jugador, pz.id, 'otra', t0 + 3000), /Espera/);
  const r = E.responderPrueba(game, jugador, pz.id, 'mal otra vez', t0 + 16000);
  assert.equal(r.acierto, false);
});

test('las pruebas solo se resuelven en exploración y nunca por fantasmas', () => {
  const { game, admin } = empezada(6, { demo: true });
  const jugador = E.vivos(game)[0];
  const pz = game.puzzles[0];
  E.avanzarFase(game, admin); // noche
  assert.throws(() => E.responderPrueba(game, jugador, pz.id, 'x'), /exploración/);
});
