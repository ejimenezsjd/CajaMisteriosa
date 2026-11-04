// Servidor de La Casa del Lobo (prototipo Fase 2).
// HTTP estático + API JSON + WebSocket de estado en tiempo real.
// Estado autoritativo en memoria con persistencia a disco (data/games.json).

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import * as engine from './src/engine.js';
import { vistaPara } from './src/views.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_FILE = path.join(__dirname, 'data', 'games.json');
const PORT = Number(process.env.PORT ?? 3000);

// ── Almacén ──────────────────────────────────────────────────────────────────
const games = new Map(); // code -> game

function cargar() {
  try {
    const raw = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    for (const g of raw) {
      for (const p of g.players) p.connected = false;
      games.set(g.code, g);
    }
    console.log(`Cargadas ${games.size} partidas de ${DATA_FILE}`);
  } catch { /* primera ejecución */ }
}

let saveTimer = null;
function guardar() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify([...games.values()]));
  }, 300);
}

// ── WebSockets: un socket por jugador, empuje de vista personalizada ─────────
const sockets = new Map(); // ws -> { code, playerId }

function difundir(game) {
  for (const [ws, info] of sockets) {
    if (info.code !== game.code || ws.readyState !== ws.OPEN) continue;
    const player = game.players.find((p) => p.id === info.playerId);
    if (player) ws.send(JSON.stringify({ type: 'state', view: vistaPara(game, player) }));
  }
}

// ── API ──────────────────────────────────────────────────────────────────────
async function manejarApi(req, res, ruta) {
  let body = {};
  try {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    if (chunks.length) body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch { return responder(res, 400, { error: 'JSON no válido.' }); }

  try {
    if (ruta === '/api/create') {
      const { game, admin } = engine.crearPartida({
        nombreNarrador: body.name,
        demo: body.demo !== false,
        codigosExistentes: new Set(games.keys()),
      });
      games.set(game.code, game);
      guardar();
      return responder(res, 200, { code: game.code, token: admin.token, playerId: admin.id });
    }

    const game = games.get(String(body.code ?? '').toUpperCase().trim());
    if (!game) return responder(res, 404, { error: 'Partida no encontrada. Revisa el código.' });

    if (ruta === '/api/join') {
      const player = engine.unirse(game, body.name);
      guardar(); difundir(game);
      return responder(res, 200, { code: game.code, token: player.token, playerId: player.id });
    }

    const player = engine.playerPorToken(game, String(body.token ?? ''));
    if (!player) return responder(res, 403, { error: 'Sesión no válida para esta partida.' });

    if (ruta === '/api/state') {
      return responder(res, 200, { view: vistaPara(game, player) });
    }

    if (ruta === '/api/action') {
      const { action, params = {} } = body;
      switch (action) {
        case 'start': engine.empezarPartida(game, player); break;
        case 'advancePhase': engine.avanzarFase(game, player); break;
        case 'nightAction': engine.accionNocturna(game, player, params); break;
        case 'vote': engine.votar(game, player, params.targetId); break;
        case 'answerPuzzle': {
          const r = engine.responderPrueba(game, player, params.puzzleId, params.respuesta);
          guardar(); difundir(game);
          return responder(res, 200, { ok: true, acierto: r.acierto });
        }
        case 'markNotifsRead':
          for (const n of game.notifs[player.id] ?? []) n.leida = true;
          break;
        case 'adminSettings': engine.adminAjustes(game, player, params); break;
        case 'adminKill': engine.adminMatar(game, player, params.targetId); break;
        case 'adminRevive': engine.adminRevivir(game, player, params.targetId); break;
        case 'adminMessage': engine.adminMensaje(game, player, params); break;
        case 'adminCreateRoom': engine.crearSala(game, player, params.nombre); break;
        case 'adminCreatePuzzle': engine.crearPrueba(game, player, params); break;
        case 'adminDeletePuzzle': engine.borrarPrueba(game, player, params.puzzleId); break;
        default: return responder(res, 400, { error: `Acción desconocida: ${action}` });
      }
      guardar(); difundir(game);
      return responder(res, 200, { ok: true, view: vistaPara(game, player) });
    }

    return responder(res, 404, { error: 'Ruta no encontrada.' });
  } catch (e) {
    if (e instanceof engine.GameError) return responder(res, 400, { error: e.message });
    console.error(e);
    return responder(res, 500, { error: 'Error interno.' });
  }
}

function responder(res, status, obj) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}

// ── Estáticos ────────────────────────────────────────────────────────────────
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json', '.png': 'image/png',
};

function servirEstatico(res, ruta) {
  let rel = ruta === '/' ? '/index.html' : ruta;
  const file = path.join(PUBLIC_DIR, path.normalize(rel));
  if (!file.startsWith(PUBLIC_DIR) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    // SPA: cualquier otra ruta sirve el index (enlaces /unirse?code=XXX)
    res.writeHead(200, { 'Content-Type': MIME['.html'] });
    return res.end(fs.readFileSync(path.join(PUBLIC_DIR, 'index.html')));
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] ?? 'application/octet-stream' });
  res.end(fs.readFileSync(file));
}

// ── Servidor ─────────────────────────────────────────────────────────────────
export function crearServidor() {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    if (url.pathname.startsWith('/api/')) {
      if (req.method !== 'POST') return responder(res, 405, { error: 'Usa POST.' });
      return manejarApi(req, res, url.pathname);
    }
    servirEstatico(res, url.pathname);
  });

  const wss = new WebSocketServer({ server, path: '/ws' });
  wss.on('connection', (ws, req) => {
    const url = new URL(req.url, 'http://x');
    const game = games.get(String(url.searchParams.get('code') ?? '').toUpperCase());
    const player = game ? engine.playerPorToken(game, String(url.searchParams.get('token') ?? '')) : null;
    if (!game || !player) { ws.close(4001, 'Sesión no válida'); return; }
    sockets.set(ws, { code: game.code, playerId: player.id });
    player.connected = true;
    ws.send(JSON.stringify({ type: 'state', view: vistaPara(game, player) }));
    difundir(game);
    ws.on('close', () => {
      sockets.delete(ws);
      player.connected = false;
      difundir(game);
    });
    ws.on('message', () => { /* el cliente no envía nada por WS: acciones por HTTP */ });
  });

  return server;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  cargar();
  const server = crearServidor();
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`La Casa del Lobo escuchando en http://0.0.0.0:${PORT}`);
    console.log('Los móviles de la misma Wi-Fi pueden entrar con la IP local de este equipo.');
  });
}
