/* La Casa del Lobo — cliente (prototipo Fase 2).
   SPA sin dependencias: recibe por WebSocket la vista filtrada por el servidor y la pinta.
   Ninguna regla de juego vive aquí: el cliente solo muestra y pide. */

'use strict';

// ── Estado del cliente ────────────────────────────────────────────────────────
let session = null;      // { code, token, playerId }
let view = null;         // última vista del servidor
let ws = null;
let tab = 'juego';
let clockOffset = 0;     // serverNow - Date.now()
let inputs = {};         // valores de inputs que sobreviven al re-render
let prevPhase = null;
let prevNotifs = 0;

try { session = JSON.parse(localStorage.getItem('lcdl') || 'null'); } catch {}

const $app = document.getElementById('app');

// ── Utilidades ───────────────────────────────────────────────────────────────
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const NOMBRE_FASE = {
  lobby: 'Sala de espera', exploracion: 'Exploración', noche: 'Noche',
  resolucion: 'Amanecer', debate: 'Debate', votacion: 'Votación',
  cierre: 'Cierre de ronda', fin: 'Final',
};

async function api(path, body) {
  const res = await fetch(path, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Error de conexión.');
  return data;
}

async function act(action, params = {}) {
  try {
    const d = await api('/api/action', { code: session.code, token: session.token, action, params });
    if (d.view) setView(d.view);
    return d;
  } catch (e) { toast(e.message); return null; }
}

let toastTimer = null;
function toast(msg) {
  document.querySelector('.notif-burbuja')?.remove();
  const el = document.createElement('div');
  el.className = 'notif-burbuja';
  el.textContent = msg;
  document.body.appendChild(el);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.remove(), 4200);
}

function vibrar(patron) { try { navigator.vibrate?.(patron); } catch {} }

// ── Conexión ─────────────────────────────────────────────────────────────────
function conectar() {
  if (!session) return;
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(`${proto}//${location.host}/ws?code=${session.code}&token=${session.token}`);
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.type === 'state') setView(msg.view);
  };
  ws.onclose = (ev) => {
    if (ev.code === 4001) { salir(); return; }
    setTimeout(conectar, 2500);
  };
}

document.addEventListener('visibilitychange', async () => {
  if (!document.hidden && session) {
    try { const d = await api('/api/state', session); setView(d.view); } catch {}
  }
});

function setView(v) {
  const faseNueva = prevPhase !== null && v.phase !== prevPhase;
  const notifsNuevas = v.me.notifs.filter((n) => !n.leida).length;
  if (faseNueva) vibrar([120, 60, 120]);
  if (notifsNuevas > prevNotifs) {
    const ultima = v.me.notifs[v.me.notifs.length - 1];
    if (ultima && !ultima.leida) { toast(ultima.mensaje); if (ultima.prioridad === 'critica') vibrar([200, 80, 200, 80, 300]); }
  }
  prevPhase = v.phase;
  prevNotifs = notifsNuevas;
  view = v;
  clockOffset = v.serverNow - Date.now();
  document.body.classList.toggle('fantasma', v.me.state === 'fantasma');
  render();
}

function salir() {
  localStorage.removeItem('lcdl');
  session = null; view = null; prevPhase = null;
  try { ws?.close(); } catch {}
  ws = null;
  render();
}

// ── Entrada: crear / unirse ──────────────────────────────────────────────────
window.crearPartida = async () => {
  const name = document.getElementById('in-nombre-narrador').value;
  const demo = document.getElementById('in-demo').checked;
  try {
    const d = await api('/api/create', { name, demo });
    session = { code: d.code, token: d.token, playerId: d.playerId };
    localStorage.setItem('lcdl', JSON.stringify(session));
    tab = 'control';
    conectar(); render();
  } catch (e) { toast(e.message); }
};

window.unirsePartida = async () => {
  const code = document.getElementById('in-codigo').value;
  const name = document.getElementById('in-nombre').value;
  try {
    const d = await api('/api/join', { code, name });
    session = { code: d.code, token: d.token, playerId: d.playerId };
    localStorage.setItem('lcdl', JSON.stringify(session));
    tab = 'juego';
    conectar(); render();
  } catch (e) { toast(e.message); }
};

window.cambiarTab = (t) => {
  tab = t;
  if (t === 'avisos') act('markNotifsRead');
  render();
};

window.guardarInput = (k, v) => { inputs[k] = v; };
window.salirPartida = () => { if (confirm('¿Abandonar esta sesión en el dispositivo?')) salir(); };

// ── Render raíz ──────────────────────────────────────────────────────────────
function render() {
  if (!session) return renderPortada();
  if (!view) { $app.innerHTML = '<p class="centro suave" style="margin-top:40vh">Conectando con la casa…</p>'; return; }
  const esAdmin = view.me.isAdmin;
  const tabsValidas = esAdmin ? ['control', 'jugadores', 'pruebas', 'registro'] : ['juego', 'pruebas', 'registro', 'avisos'];
  if (!tabsValidas.includes(tab)) tab = tabsValidas[0];
  const html = [];
  html.push(renderCabecera());
  if (view.me.state === 'fantasma') {
    html.push(`<div class="carta peligro centro"><strong>Eres un fantasma.</strong><br>
      <span class="suave">Pacto de Silencio: no hables de la partida con los vivos. Observa… el Otro Lado llegará en la Fase 5.</span></div>`);
  }
  if (esAdmin) {
    if (tab === 'control') html.push(renderAdminControl());
    else if (tab === 'jugadores') html.push(renderAdminJugadores());
    else if (tab === 'pruebas') html.push(renderAdminPruebas());
    else if (tab === 'registro') html.push(renderRegistro());
  } else {
    if (tab === 'juego') html.push(renderJuego());
    else if (tab === 'pruebas') html.push(renderPruebas());
    else if (tab === 'registro') html.push(renderRegistro());
    else if (tab === 'avisos') html.push(renderAvisos());
  }
  html.push(renderBarra(esAdmin));
  $app.innerHTML = html.join('');
}

function renderPortada() {
  const codigoUrl = new URLSearchParams(location.search).get('code') ?? '';
  $app.innerHTML = `
    <div style="margin-top:7vh"></div>
    <h1>🌕 La Casa del Lobo</h1>
    <p class="centro suave">La casa es el tablero. Vosotros, la historia.</p>
    <div class="carta">
      <h2>Unirse a una partida</h2>
      <label>Código de la sala</label>
      <input id="in-codigo" maxlength="6" autocapitalize="characters" style="text-transform:uppercase;letter-spacing:.3em;text-align:center" value="${esc(codigoUrl)}" />
      <label>Tu nombre</label>
      <input id="in-nombre" maxlength="24" placeholder="¿Quién llega a la casa?" />
      <button class="primario" onclick="unirsePartida()">Entrar en la casa</button>
    </div>
    <div class="carta">
      <h2>Crear una partida</h2>
      <p class="suave">Serás el narrador: controlas las fases y no juegas como personaje.</p>
      <label>Nombre del narrador</label>
      <input id="in-nombre-narrador" maxlength="24" placeholder="Narrador" />
      <label style="display:flex;align-items:center;gap:8px;margin-top:10px">
        <input type="checkbox" id="in-demo" checked style="width:auto;margin:0" /> Cargar escenario demo (6 habitaciones, 8 pruebas)
      </label>
      <button onclick="crearPartida()">Crear partida</button>
    </div>
    <p class="centro suave">Prototipo Fase 2 · Los roles, votos y respuestas viven solo en el servidor.</p>`;
}

function renderCabecera() {
  const t = view.phaseEndsAt ? Math.max(0, Math.round((view.phaseEndsAt - (Date.now() + clockOffset)) / 1000)) : null;
  return `
  <div class="cabecera">
    <div>
      <span class="fase-chip">${esc(NOMBRE_FASE[view.phase] ?? view.phase)}</span>
      ${view.round ? `<span class="suave"> · Ronda ${view.round}</span>` : ''}
    </div>
    <div class="temporizador" id="temporizador">${t !== null ? formatoTiempo(t) : ''}</div>
  </div>`;
}

function formatoTiempo(s) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

setInterval(() => {
  if (!view?.phaseEndsAt) return;
  const el = document.getElementById('temporizador');
  if (!el) return;
  const t = Math.max(0, Math.round((view.phaseEndsAt - (Date.now() + clockOffset)) / 1000));
  el.textContent = formatoTiempo(t);
  el.classList.toggle('agotado', t === 0);
}, 1000);

function renderBarra(esAdmin) {
  const noLeidas = view.me.notifs.filter((n) => !n.leida).length;
  const items = esAdmin
    ? [['control', 'Control'], ['jugadores', 'Jugadores'], ['pruebas', 'Pruebas'], ['registro', 'Registro']]
    : [['juego', 'Juego'], ['pruebas', 'Pruebas'], ['registro', 'Registro'], ['avisos', `Avisos${noLeidas ? `<span class="contador">${noLeidas}</span>` : ''}`]];
  return `<nav class="barra-inferior">${items.map(([id, nombre]) =>
    `<button class="${tab === id ? 'activa' : ''}" onclick="cambiarTab('${id}')">${nombre}</button>`).join('')}</nav>`;
}

// ── Vista del jugador ────────────────────────────────────────────────────────
function renderJuego() {
  const h = [];
  if (view.status === 'lobby') {
    h.push(`<div class="carta centro">
      <h2>Sala de espera</h2>
      <p class="suave">Comparte el código con el resto. El narrador (${esc(view.narrador)}) iniciará la partida.</p>
      <div class="codigo-sala">${esc(view.code)}</div>
    </div>`);
    h.push(renderListaJugadores());
    h.push(`<button onclick="salirPartida()">Salir de la partida</button>`);
    return h.join('');
  }

  h.push(renderMiRol());

  switch (view.phase) {
    case 'exploracion':
      h.push(`<div class="carta destacada"><h2>Exploración</h2>
        <p>La casa está abierta. Recorred las habitaciones, encontrad los componentes físicos y resolved las pruebas desde la pestaña <strong>Pruebas</strong>.</p>
        <p class="suave">Compartid (o callad) lo que descubráis. No todo el mundo juega para el mismo bando.</p></div>`);
      break;
    case 'noche':
      h.push(renderNoche());
      break;
    case 'resolucion':
      h.push(`<div class="carta peligro"><h2>Amanecer</h2><p>${esc(view.fase.resolucion?.textoPublico ?? 'La noche termina…')}</p></div>`);
      break;
    case 'debate':
      if (view.fase.resolucion) h.push(`<div class="carta"><p class="suave">${esc(view.fase.resolucion.textoPublico)}</p></div>`);
      h.push(`<div class="carta destacada"><h2>Debate</h2>
        <p>Reuníos y hablad: sospechas, coartadas, descubrimientos. La votación llegará al terminar el tiempo.</p></div>`);
      break;
    case 'votacion':
      h.push(renderVotacion());
      break;
    case 'cierre':
      h.push(renderResultadoVotacion());
      h.push(`<div class="carta centro suave">El narrador abrirá la siguiente ronda…</div>`);
      break;
    case 'fin':
      h.push(renderFinal());
      break;
  }
  h.push(renderListaJugadores());
  return h.join('');
}

function renderMiRol() {
  const r = view.me.role;
  if (!r) return '';
  const manada = view.me.manada?.length
    ? `<p><strong>Tu manada:</strong> ${view.me.manada.map((m) => `${esc(m.name)}${m.state === 'fantasma' ? ' †' : ''}`).join(', ')}</p>`
    : '';
  return `<div class="carta">
    <div class="rol-oculto" id="rol-tapa"
      onpointerdown="document.getElementById('rol-detalle').style.display='block';this.style.display='none'">
      🜏 Mantén pulsado para ver tu identidad secreta
    </div>
    <div id="rol-detalle" style="display:none"
      onpointerup="this.style.display='none';document.getElementById('rol-tapa').style.display='block'"
      onpointerleave="this.style.display='none';document.getElementById('rol-tapa').style.display='block'">
      <h2>${esc(r.nombre)} <span class="etiqueta ${r.faccion === 'lobos' ? 'lobo' : 'humano'}">${esc(r.faccion)}</span></h2>
      <p>${esc(r.descripcion)}</p>
      <p class="suave"><strong>Objetivo:</strong> ${esc(r.objetivo)}</p>
      ${manada}
      <p class="suave centro">(suelta para ocultar)</p>
    </div>
  </div>`;
}

function renderNoche() {
  if (view.me.state !== 'vivo') {
    return `<div class="carta"><h2>Noche</h2><p class="suave">Los vivos se esconden. Tú ya no necesitas esconderte.</p></div>`;
  }
  const f = view.fase;
  const h = [`<div class="carta destacada"><h2>🌑 Noche</h2><p class="suave">No levantes la vista del móvil: todos están haciendo algo ahora mismo.</p>`];

  if (f.caza) {
    h.push(`<h3>La caza</h3><p class="suave">Elegid víctima con la manada. Pluralidad simple; empate = nadie cae.</p>`);
    h.push(f.caza.objetivos.map((o) => `
      <div class="opcion ${f.caza.miVoto === o.id ? 'elegida' : ''}" onclick="act('nightAction',{tipo:'matar',targetId:'${o.id}'})">${esc(o.name)}</div>`).join(''));
    if (f.caza.votosManada.length) {
      h.push(`<p class="suave">Manada: ${f.caza.votosManada.map((v) => `${esc(v.lobo)} → ${esc(v.objetivo)}`).join(' · ')}</p>`);
    }
  }
  if (f.sabotaje) {
    h.push(`<hr class="separador"/><h3>Sabotaje</h3><p class="suave">Opcional: inutiliza una prueba durante la próxima exploración.</p>`);
    h.push(f.sabotaje.pruebas.map((p) => `
      <div class="opcion ${f.sabotaje.miSabotaje === p.id ? 'elegida' : ''}" onclick="act('nightAction',{tipo:'sabotear',puzzleId:'${p.id}'})">${esc(p.nombre)}</div>`).join(''));
  }
  if (f.proteger) {
    h.push(`<h3>Protección</h3><p class="suave">Elige a quién velar esta noche.</p>`);
    h.push(f.proteger.objetivos.map((o) => `
      <div class="opcion ${f.proteger.miProteccion === o.id ? 'elegida' : ''}" onclick="act('nightAction',{tipo:'proteger',targetId:'${o.id}'})">${esc(o.name)}</div>`).join(''));
  }
  if (f.investigar) {
    h.push(`<h3>Investigación</h3><p class="suave">Elige a quién seguir el rastro. Sabrás el resultado al amanecer.</p>`);
    h.push(f.investigar.objetivos.map((o) => `
      <div class="opcion ${f.investigar.miInvestigacion === o.id ? 'elegida' : ''}" onclick="act('nightAction',{tipo:'investigar',targetId:'${o.id}'})">${esc(o.name)}</div>`).join(''));
  }
  if (f.decoy) {
    h.push(`<h3>¿Qué haces esta noche?</h3><p class="suave">Elige cómo pasas la noche. Quizá importe. Quizá no.</p>`);
    h.push(f.decoy.opciones.map((texto, i) => `
      <div class="opcion ${f.decoy.miOpcion === i ? 'elegida' : ''}" onclick="act('nightAction',{tipo:'decoy',opcion:${i}})">${esc(texto)}</div>`).join(''));
  }
  h.push('</div>');
  return h.join('');
}

function renderVotacion() {
  const v = view.fase.votacion;
  if (!v) return '';
  if (view.me.state !== 'vivo') {
    return `<div class="carta"><h2>Votación</h2><p class="suave">Los muertos no votan. Emitidos: ${v.emitidos}/${v.total}.</p></div>`;
  }
  return `<div class="carta destacada"><h2>⚖️ Votación</h2>
    <p class="suave">Voto secreto. Puedes cambiarlo hasta que el narrador cierre la asamblea. Emitidos: ${v.emitidos}/${v.total}.</p>
    ${v.candidatos.map((c) => `
      <div class="opcion ${v.miVoto === c.id ? 'elegida' : ''}" onclick="act('vote',{targetId:'${c.id}'})">${esc(c.name)}</div>`).join('')}
    <div class="opcion ${v.miVoto === 'abstencion' ? 'elegida' : ''}" onclick="act('vote',{targetId:'abstencion'})">🤐 Abstenerse</div>
  </div>`;
}

function renderResultadoVotacion() {
  const r = view.fase.resultadoVotacion;
  if (!r) return '';
  const recuento = Object.entries(r.recuento).sort((a, b) => b[1] - a[1])
    .map(([n, c]) => `<li><span>${esc(n)}</span><span>${c} voto${c > 1 ? 's' : ''}</span></li>`).join('');
  return `<div class="carta peligro"><h2>La asamblea ha hablado</h2>
    <p>${esc(r.texto)}</p>
    <ul class="lista">${recuento}</ul>
    <p class="suave">Abstenciones o silencios: ${r.abstenciones}</p>
  </div>`;
}

function renderFinal() {
  const w = view.winner;
  return `<div class="carta destacada centro">
    <h2>${w?.faccion === 'lobos' ? '🐺 Victoria de los lobos' : '🏠 Victoria de los humanos'}</h2>
    <p>${esc(w?.texto ?? '')}</p>
    <hr class="separador"/>
    <h3>Las máscaras caen</h3>
    <ul class="lista">${view.players.map((p) => `
      <li><span>${esc(p.name)}${p.state === 'fantasma' ? ' †' : ''}</span>
      <span class="etiqueta">${esc(p.role ?? '?')}</span></li>`).join('')}
    </ul>
    <button onclick="salirPartida()">Cerrar sesión de esta partida</button>
  </div>`;
}

function renderListaJugadores() {
  return `<div class="carta"><h3>En la casa (${view.players.length})</h3>
    <ul class="lista">${view.players.map((p) => `
      <li><span><span class="punto ${p.connected ? 'on' : ''}"></span>${esc(p.name)}${p.id === view.me.id ? ' (tú)' : ''}</span>
      ${p.state === 'fantasma' ? '<span class="etiqueta fantasma">fantasma</span>' : ''}</li>`).join('')}
    </ul></div>`;
}

// ── Pruebas (jugador) ────────────────────────────────────────────────────────
window.responderPrueba = async (pzId) => {
  const respuesta = inputs['pz-' + pzId] ?? '';
  if (!respuesta.trim()) { toast('Escribe una respuesta.'); return; }
  const d = await act('answerPuzzle', { puzzleId: pzId, respuesta });
  if (d) {
    if (d.acierto) { toast('✦ Correcto. La casa cede un secreto.'); inputs['pz-' + pzId] = ''; }
    else toast('No es eso. La casa guarda silencio…');
    const st = await api('/api/state', session).catch(() => null);
    if (st) setView(st.view);
  }
};

function renderPruebas() {
  if (view.me.isAdmin) return '';
  if (view.me.state !== 'vivo') {
    return `<div class="carta centro suave">Las pruebas de los vivos ya no responden a tus manos.<br>Las pruebas espectrales llegarán con el Otro Lado (Fase 5).</div>`;
  }
  const puedeResolver = view.phase === 'exploracion';
  const h = [];
  if (!puedeResolver) h.push(`<div class="carta suave centro">Las pruebas solo pueden resolverse durante la exploración.</div>`);
  for (const room of view.rooms) {
    const pzs = view.puzzles.filter((p) => p.roomId === room.id);
    if (!pzs.length) continue;
    const hechas = pzs.filter((p) => p.estado === 'completada').length;
    h.push(`<details ${puedeResolver ? 'open' : ''}><summary>${esc(room.nombre)} · ${hechas}/${pzs.length}</summary>`);
    for (const pz of pzs) {
      h.push(`<div class="prueba ${pz.estado}">
        <h3>${esc(pz.nombre)} ${pz.estado === 'completada' ? '✓' : pz.estado === 'saboteada' ? '⚠ forzada' : ''}</h3>
        <p class="suave">${esc(pz.descripcion)}</p>
        ${pz.estado === 'completada'
          ? `<p class="suave">Resuelta por ${esc(pz.completadaPor ?? '?')}.</p>`
          : pz.estado === 'saboteada'
            ? `<p class="suave">Alguien la ha inutilizado esta noche. Volverá a estar disponible la próxima ronda.</p>`
            : puedeResolver
              ? `${pz.pista ? `<details><summary class="suave">Ver pista</summary><p class="suave">${esc(pz.pista)}</p></details>` : ''}
                 <input placeholder="Respuesta…" value="${esc(inputs['pz-' + pz.id] ?? '')}" oninput="guardarInput('pz-${pz.id}', this.value)" />
                 <button class="mini primario" onclick="responderPrueba('${pz.id}')">Probar respuesta</button>`
              : ''}
      </div>`);
    }
    h.push('</details>');
  }
  return `<div class="carta"><h2>Pruebas de la casa</h2>${h.join('') || '<p class="suave">No hay pruebas configuradas.</p>'}</div>`;
}

// ── Registro y avisos ────────────────────────────────────────────────────────
function renderRegistro() {
  const evs = [...view.events].reverse();
  return `<div class="carta registro"><h2>Historial de acontecimientos</h2>
    ${evs.map((e) => `<div class="evento"><time>${new Date(e.ts).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}${e.round ? ` · R${e.round}` : ''}</time>${esc(e.texto)}</div>`).join('') || '<p class="suave">Aún no ha pasado nada… que sepas.</p>'}
  </div>`;
}

function renderAvisos() {
  const ns = [...view.me.notifs].reverse();
  return `<div class="carta registro"><h2>Mensajes</h2>
    ${ns.map((n) => `<div class="evento"><time>${new Date(n.ts).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</time>${esc(n.mensaje)}</div>`).join('') || '<p class="suave">Nadie te ha susurrado nada todavía.</p>'}
  </div>`;
}

// ── Panel del narrador ───────────────────────────────────────────────────────
const SIGUIENTE_FASE = {
  exploracion: 'pasar a la Noche', noche: 'resolver la Noche', resolucion: 'abrir el Debate',
  debate: 'abrir la Votación', votacion: 'cerrar la Votación', cierre: 'empezar nueva Ronda',
};

window.adminAjustesEnviar = () => {
  const params = {
    revelarEliminado: document.getElementById('aj-revelar').value,
    empate: document.getElementById('aj-empate').value,
    votoRonda1: document.getElementById('aj-voto1').checked,
    timers: {
      exploracion: Number(document.getElementById('aj-t-exploracion').value) * 60,
      noche: Number(document.getElementById('aj-t-noche').value) * 60,
      debate: Number(document.getElementById('aj-t-debate').value) * 60,
      votacion: Number(document.getElementById('aj-t-votacion').value) * 60,
    },
  };
  const usarOverride = document.getElementById('aj-override').checked;
  if (usarOverride) {
    params.rolesOverride = {};
    for (const r of view.admin.rolesDisponibles) {
      params.rolesOverride[r.slug] = Number(document.getElementById('aj-rol-' + r.slug).value || 0);
    }
  } else params.rolesOverride = null;
  act('adminSettings', params).then((d) => d && toast('Ajustes guardados.'));
};

function renderAdminControl() {
  const h = [`<div class="carta destacada"><h2>Panel del narrador</h2>
    <p class="suave">Código de sala:</p><div class="codigo-sala">${esc(view.code)}</div>
    <button class="mini" onclick="navigator.clipboard?.writeText(location.origin + '/?code=${view.code}').then(()=>toast('Enlace copiado.'))">Copiar enlace de invitación</button>
  </div>`];

  if (view.status === 'lobby') {
    const t = view.settings.timers;
    h.push(`<div class="carta"><h3>Ajustes de partida</h3>
      <label>Al eliminar a alguien se revela…</label>
      <select id="aj-revelar">
        <option value="faccion" ${view.settings.revelarEliminado === 'faccion' ? 'selected' : ''}>Solo su facción</option>
        <option value="rol" ${view.settings.revelarEliminado === 'rol' ? 'selected' : ''}>Su rol completo</option>
        <option value="nada" ${view.settings.revelarEliminado === 'nada' ? 'selected' : ''}>Nada</option>
      </select>
      <label>Empate en la asamblea</label>
      <select id="aj-empate">
        <option value="nadie" ${view.settings.empate === 'nadie' ? 'selected' : ''}>Nadie muere</option>
        <option value="azar" ${view.settings.empate === 'azar' ? 'selected' : ''}>Azar entre empatados</option>
      </select>
      <label style="display:flex;align-items:center;gap:8px"><input type="checkbox" id="aj-voto1" ${view.settings.votoRonda1 ? 'checked' : ''} style="width:auto;margin:0"/> Votación ya en la ronda 1</label>
      <div class="grid2">
        <div><label>Exploración (min)</label><input id="aj-t-exploracion" type="number" min="1" value="${t.exploracion / 60}"/></div>
        <div><label>Noche (min)</label><input id="aj-t-noche" type="number" min="1" value="${t.noche / 60}"/></div>
        <div><label>Debate (min)</label><input id="aj-t-debate" type="number" min="1" value="${t.debate / 60}"/></div>
        <div><label>Votación (min)</label><input id="aj-t-votacion" type="number" min="1" value="${t.votacion / 60}"/></div>
      </div>
      <label style="display:flex;align-items:center;gap:8px;margin-top:10px">
        <input type="checkbox" id="aj-override" ${view.admin.rolesOverride ? 'checked' : ''} style="width:auto;margin:0"/> Ajustar reparto de roles a mano
      </label>
      <div class="grid2">
        ${view.admin.rolesDisponibles.map((r) => `
          <div><label>${esc(r.nombre)} (${r.faccion})</label>
          <input id="aj-rol-${r.slug}" type="number" min="0" value="${view.admin.rolesOverride?.[r.slug] ?? 0}"/></div>`).join('')}
      </div>
      <p class="suave">Si no lo ajustas, el reparto es automático según el número de jugadores (GDD §3.5).</p>
      <button onclick="adminAjustesEnviar()">Guardar ajustes</button>
      <hr class="separador"/>
      <p class="suave">Jugadores en la sala: ${view.players.length} (mínimo 4, recomendado 6+).</p>
      <button class="primario" onclick="act('start')">🌕 Empezar la partida y repartir roles</button>
    </div>`);
  } else if (view.status === 'en_curso') {
    h.push(`<div class="carta">
      <h3>Fase actual: ${esc(NOMBRE_FASE[view.phase])} · Ronda ${view.round}</h3>
      ${view.fase.resolucion ? `<p class="suave">${esc(view.fase.resolucion.textoPublico)}</p>` : ''}
      ${view.fase.resultadoVotacion ? `<p class="suave">${esc(view.fase.resultadoVotacion.texto)}</p>` : ''}
      ${view.fase.votacion ? `<p class="suave">Votos emitidos: ${view.fase.votacion.emitidos}/${view.fase.votacion.total}</p>` : ''}
      <button class="primario" onclick="act('advancePhase')">▶ ${esc(SIGUIENTE_FASE[view.phase] ?? 'Avanzar')}</button>
      <p class="suave">El temporizador es orientativo: tú decides cuándo avanzar.</p>
    </div>`);
    h.push(renderAdminNoche());
  } else {
    h.push(renderFinal());
  }

  h.push(`<div class="carta"><h3>Mensajes del narrador</h3>
    <textarea id="msg-texto" rows="2" placeholder="«Una nueva pista ha aparecido en la cocina…»">${esc(inputs['msg-texto'] ?? '')}</textarea>
    <select id="msg-destino">
      <option value="">📣 A todos</option>
      ${view.players.map((p) => `<option value="${p.id}">🤫 Solo a ${esc(p.name)}</option>`).join('')}
    </select>
    <button onclick="enviarMensajeNarrador()">Enviar</button>
  </div>`);
  return h.join('');
}

window.enviarMensajeNarrador = () => {
  const mensaje = document.getElementById('msg-texto').value;
  const targetId = document.getElementById('msg-destino').value || null;
  act('adminMessage', { mensaje, targetId }).then((d) => {
    if (d) { toast('Mensaje enviado.'); inputs['msg-texto'] = ''; render(); }
  });
};

function renderAdminNoche() {
  const n = view.admin.noche;
  if (!n || view.phase !== 'noche') return '';
  const fila = (obj) => Object.entries(obj).map(([a, b]) => `${esc(a)} → ${esc(b)}`).join('<br>') || '<span class="suave">—</span>';
  return `<div class="carta"><h3>Acciones nocturnas en vivo</h3>
    <table class="tabla">
      <tr><th>Caza de la manada</th><td>${fila(n.wolfVotes)}</td></tr>
      <tr><th>Protección</th><td>${fila(n.protect)}</td></tr>
      <tr><th>Investigación</th><td>${fila(n.investigate)}</td></tr>
      <tr><th>Sabotaje</th><td>${fila(n.sabotage)}</td></tr>
      <tr><th>Sin poderes</th><td>${fila(n.decoy)}</td></tr>
    </table></div>`;
}

function renderAdminJugadores() {
  const votos = view.admin.votos && Object.keys(view.admin.votos).length
    ? `<div class="carta"><h3>Votos (en secreto para ellos)</h3><table class="tabla">
        ${Object.entries(view.admin.votos).map(([v, t]) => `<tr><td>${esc(v)}</td><td>${esc(t)}</td></tr>`).join('')}
      </table></div>` : '';
  return `<div class="carta"><h2>Jugadores</h2>
    <table class="tabla">
      <tr><th>Nombre</th><th>Rol</th><th>Estado</th><th></th></tr>
      ${view.admin.roles.map((p) => `
        <tr><td>${esc(p.name)}</td><td>${esc(p.role ?? '—')}</td><td>${esc(p.state)}</td>
        <td>${p.state === 'vivo'
          ? `<button class="mini peligro" onclick="if(confirm('¿Matar a ${esc(p.name)}?'))act('adminKill',{targetId:'${p.id}'})">☠</button>`
          : p.state === 'fantasma'
            ? `<button class="mini" onclick="act('adminRevive',{targetId:'${p.id}'})">⟲ revivir</button>` : ''}</td></tr>`).join('')}
    </table>
    <p class="suave">Modo emergencia: toda intervención queda en el registro.</p>
  </div>${votos}`;
}

window.adminCrearSala = () => {
  act('adminCreateRoom', { nombre: inputs['nueva-sala'] ?? '' }).then((d) => { if (d) { inputs['nueva-sala'] = ''; toast('Habitación creada.'); } });
};
window.adminCrearPrueba = () => {
  act('adminCreatePuzzle', {
    roomId: document.getElementById('np-sala').value,
    nombre: inputs['np-nombre'] ?? '', descripcion: inputs['np-desc'] ?? '',
    respuesta: inputs['np-resp'] ?? '', pista: inputs['np-pista'] ?? '',
    recompensa: inputs['np-rec'] ?? '', fisico: inputs['np-fis'] ?? '',
  }).then((d) => {
    if (d) { for (const k of ['np-nombre', 'np-desc', 'np-resp', 'np-pista', 'np-rec', 'np-fis']) inputs[k] = ''; toast('Prueba creada.'); render(); }
  });
};

function renderAdminPruebas() {
  const ck = view.admin.checklist;
  return `<div class="carta"><h2>Pruebas y montaje</h2>
    <p class="suave">Checklist para preparar la casa antes de jugar. Las respuestas solo las ves tú.</p>
    ${ck.map((p) => `<div class="prueba ${p.estado}">
      <h3>${esc(p.nombre)} <span class="etiqueta">${esc(p.sala ?? '?')}</span> <span class="etiqueta">${esc(p.estado)}</span></h3>
      <p class="suave">Respuesta: <strong>${esc(p.respuesta)}</strong></p>
      ${p.fisico ? `<p class="suave">Montaje: ${esc(p.fisico)}</p>` : ''}
      <button class="mini peligro" onclick="if(confirm('¿Borrar esta prueba?'))act('adminDeletePuzzle',{puzzleId:'${p.id}'})">Borrar</button>
    </div>`).join('') || '<p class="suave">No hay pruebas todavía.</p>'}
    <hr class="separador"/>
    <h3>Nueva habitación</h3>
    <input placeholder="Nombre de la habitación" value="${esc(inputs['nueva-sala'] ?? '')}" oninput="guardarInput('nueva-sala', this.value)"/>
    <button class="mini" onclick="adminCrearSala()">Crear habitación</button>
    <hr class="separador"/>
    <h3>Nueva prueba</h3>
    <select id="np-sala">${view.rooms.map((r) => `<option value="${r.id}">${esc(r.nombre)}</option>`).join('')}</select>
    <input placeholder="Nombre de la prueba" value="${esc(inputs['np-nombre'] ?? '')}" oninput="guardarInput('np-nombre', this.value)"/>
    <textarea rows="2" placeholder="Descripción que verán los jugadores" oninput="guardarInput('np-desc', this.value)">${esc(inputs['np-desc'] ?? '')}</textarea>
    <input placeholder="Respuesta correcta (verificable)" value="${esc(inputs['np-resp'] ?? '')}" oninput="guardarInput('np-resp', this.value)"/>
    <input placeholder="Pista opcional" value="${esc(inputs['np-pista'] ?? '')}" oninput="guardarInput('np-pista', this.value)"/>
    <input placeholder="Recompensa (texto, opcional)" value="${esc(inputs['np-rec'] ?? '')}" oninput="guardarInput('np-rec', this.value)"/>
    <input placeholder="Montaje físico (solo para ti)" value="${esc(inputs['np-fis'] ?? '')}" oninput="guardarInput('np-fis', this.value)"/>
    <button class="mini primario" onclick="adminCrearPrueba()">Crear prueba</button>
  </div>`;
}

// ── Arranque ─────────────────────────────────────────────────────────────────
if (session) { tab = 'juego'; conectar(); }
render();
