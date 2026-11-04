// Partida completa contra el servidor real por HTTP (crear → unirse → rondas → victoria),
// incluyendo comprobaciones de seguridad en negativo (P-13).

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { crearServidor } from '../server.js';

let server, base;

before(async () => {
  server = crearServidor();
  await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

async function post(path, body) {
  const res = await fetch(base + path, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  return { status: res.status, data: await res.json() };
}

test('partida completa de 6 jugadores por HTTP hasta la victoria humana', async () => {
  // Crear y unirse
  const { data: adminSesion } = await post('/api/create', { name: 'Narradora', demo: true });
  assert.match(adminSesion.code, /^[A-Z2-9]{6}$/);
  const code = adminSesion.code;

  const jugadores = [];
  for (const n of ['Ana', 'Bruno', 'Clara', 'David', 'Elena', 'Fran']) {
    const { status, data } = await post('/api/join', { code, name: n });
    assert.equal(status, 200);
    jugadores.push({ name: n, ...data });
  }

  // Nombre duplicado y partida inexistente
  assert.equal((await post('/api/join', { code, name: 'ana' })).status, 400);
  assert.equal((await post('/api/join', { code: 'XXXXXX', name: 'Nadie' })).status, 404);

  // Token inválido rechazado
  assert.equal((await post('/api/action', { code, token: 'falso', action: 'start' })).status, 403);

  // Un jugador no puede empezar la partida; la narradora sí
  assert.equal((await post('/api/action', { code, token: jugadores[0].token, action: 'start' })).status, 400);
  assert.equal((await post('/api/action', { code, token: adminSesion.token, action: 'start' })).status, 200);

  // Seguridad: cada jugador ve SU rol y ninguno ajeno; el narrador los ve todos
  const vistas = {};
  for (const j of jugadores) {
    const { data } = await post('/api/state', { code, token: j.token });
    vistas[j.name] = data.view;
    assert.ok(data.view.me.role.slug, `${j.name} tiene rol`);
    for (const otro of data.view.players.filter((p) => p.id !== j.playerId)) {
      assert.equal(otro.role, null, `rol de ${otro.name} oculto para ${j.name}`);
    }
    assert.equal(data.view.admin, undefined, 'sin panel de narrador');
    for (const pz of data.view.puzzles) {
      assert.equal(pz.answerHash, undefined);
      assert.equal(pz.answerPlainAdmin, undefined);
      assert.equal(pz.salt, undefined);
    }
  }
  const { data: va } = await post('/api/state', { code, token: adminSesion.token });
  assert.equal(va.view.admin.roles.length, 6);
  const lobos = va.view.admin.roles.filter((r) => ['lobo', 'alfa', 'saboteador'].includes(r.role));
  const humanos = va.view.admin.roles.filter((r) => !['lobo', 'alfa', 'saboteador'].includes(r.role));
  assert.equal(lobos.length, 2);

  // Los lobos se ven entre sí
  const lobo1 = jugadores.find((j) => j.playerId === lobos[0].id);
  assert.equal(vistas[lobo1.name].me.manada.length, 1);

  // Exploración: un humano resuelve una prueba de la demo (respuesta con tilde y minúsculas)
  const humano1 = jugadores.find((j) => j.playerId === humanos[0].id);
  const pzReceta = vistas[humano1.name].puzzles.find((p) => p.nombre === 'La receta cifrada');
  const r1 = await post('/api/action', { code, token: humano1.token, action: 'answerPuzzle', params: { puzzleId: pzReceta.id, respuesta: 'belladóna' } });
  assert.equal(r1.data.acierto, true);

  const avanzar = async () => {
    const r = await post('/api/action', { code, token: adminSesion.token, action: 'advancePhase' });
    assert.equal(r.status, 200, JSON.stringify(r.data));
    return r.data.view;
  };

  // Noche R1: la manada caza a un humano; un fantasma nace
  let v = await avanzar(); // noche
  const victimaId = humanos[1].id;
  const victima = jugadores.find((x) => x.playerId === victimaId);
  for (const lobo of lobos) {
    const j = jugadores.find((x) => x.playerId === lobo.id);
    const r = await post('/api/action', { code, token: j.token, action: 'nightAction', params: { tipo: 'matar', targetId: victimaId } });
    assert.equal(r.status, 200);
  }
  // Un civil intenta la acción de otro rol → rechazado
  const civilObj = va.view.admin.roles.find((r) => r.role === 'civil');
  if (civilObj) {
    const civilJ = jugadores.find((x) => x.playerId === civilObj.id);
    const r = await post('/api/action', { code, token: civilJ.token, action: 'nightAction', params: { tipo: 'investigar', targetId: lobos[0].id } });
    assert.equal(r.status, 400);
  }
  v = await avanzar(); // resolución: muere la víctima
  const { data: vVictima } = await post('/api/state', { code, token: victima.token });
  assert.equal(vVictima.view.me.state, 'fantasma');

  v = await avanzar(); // debate
  v = await avanzar(); // cierre (R1 sin votación por defecto)
  assert.equal(v.phase, 'cierre');
  v = await avanzar(); // ronda 2
  assert.equal(v.round, 2);

  v = await avanzar(); // noche R2 (nadie actúa)
  v = await avanzar(); // resolución: noche tranquila
  v = await avanzar(); // debate
  v = await avanzar(); // votación
  assert.equal(v.phase, 'votacion');

  // El fantasma no puede votar; los vivos linchan a un lobo
  const rFantasma = await post('/api/action', { code, token: victima.token, action: 'vote', params: { targetId: lobos[0].id } });
  assert.equal(rFantasma.status, 400);
  for (const j of jugadores.filter((x) => x.playerId !== victima.playerId && x.playerId !== lobos[0].id)) {
    const r = await post('/api/action', { code, token: j.token, action: 'vote', params: { targetId: lobos[0].id } });
    assert.equal(r.status, 200);
  }
  v = await avanzar(); // cierre: lobo eliminado (facción revelada)
  assert.match(v.events.at(-1).texto, /lobos/);

  v = await avanzar(); // ronda 3
  v = await avanzar(); // noche R3
  v = await avanzar(); // resolución
  v = await avanzar(); // debate
  v = await avanzar(); // votación: cae el segundo lobo → victoria humana
  for (const j of jugadores.filter((x) => x.playerId !== victima.playerId && x.playerId !== lobos[0].id && x.playerId !== lobos[1].id)) {
    await post('/api/action', { code, token: j.token, action: 'vote', params: { targetId: lobos[1].id } });
  }
  v = await avanzar();
  assert.equal(v.phase, 'fin');
  assert.equal(v.winner.faccion, 'humanos');
  // Al final, los roles se revelan a todos
  const { data: vFinal } = await post('/api/state', { code, token: humano1.token });
  assert.ok(vFinal.view.players.every((p) => p.role));
});
