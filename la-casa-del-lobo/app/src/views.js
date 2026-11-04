// Vista personalizada por jugador: el cliente SOLO recibe lo que su jugador puede ver.
// Ningún rol, voto, acción nocturna ni respuesta ajena sale de aquí hacia quien no debe.

import { ROLES, jugadores, vivos, rondaActual, opcionesDecoy } from './engine.js';

export function vistaPara(game, player) {
  const ronda = rondaActual(game);
  const esAdmin = player.isAdmin;
  const rol = player.role ? ROLES[player.role] : null;
  const esLobo = rol?.faccion === 'lobos';

  const vista = {
    code: game.code,
    status: game.status,
    phase: game.phase,
    round: game.round,
    phaseEndsAt: game.phaseEndsAt,
    serverNow: Date.now(),
    settings: {
      revelarEliminado: game.settings.revelarEliminado,
      empate: game.settings.empate,
      votoRonda1: game.settings.votoRonda1,
      timers: game.settings.timers,
    },
    players: jugadores(game).map((p) => ({
      id: p.id,
      name: p.name,
      state: p.state,
      connected: p.connected,
      // El rol de los demás solo se revela al terminar la partida
      role: game.status === 'finalizada' || p.id === player.id ? p.role : null,
    })),
    narrador: game.players.find((p) => p.isAdmin)?.name ?? 'Narrador',
    rooms: game.rooms.map((r) => ({ id: r.id, nombre: r.nombre })),
    puzzles: game.puzzles.map((pz) => ({
      id: pz.id, roomId: pz.roomId, nombre: pz.nombre, descripcion: pz.descripcion,
      pista: pz.pista, recompensa: pz.recompensa ? true : false,
      estado: pz.estado,
      completadaPor: pz.completadaPor ? (jugadores(game).find((p) => p.id === pz.completadaPor)?.name ?? null) : null,
    })),
    events: game.events.filter((e) => e.publico || esAdmin).slice(-60),
    winner: game.winner,
    me: {
      id: player.id,
      name: player.name,
      isAdmin: esAdmin,
      state: player.state,
      role: rol ? { slug: rol.slug, nombre: rol.nombre, faccion: rol.faccion, descripcion: rol.descripcion, objetivo: rol.objetivo } : null,
      manada: esLobo
        ? jugadores(game).filter((p) => ROLES[p.role]?.faccion === 'lobos' && p.id !== player.id)
            .map((p) => ({ name: p.name, state: p.state }))
        : null,
      notifs: (game.notifs[player.id] ?? []).slice(-30),
    },
    fase: {},
  };

  // ── Datos específicos de fase, filtrados ──
  if (game.phase === 'noche' && ronda && player.state === 'vivo' && !esAdmin) {
    if (esLobo) {
      vista.fase.caza = {
        objetivos: vivos(game).filter((p) => ROLES[p.role]?.faccion !== 'lobos').map((p) => ({ id: p.id, name: p.name })),
        miVoto: ronda.night.wolfVotes[player.id] ?? null,
        votosManada: Object.entries(ronda.night.wolfVotes).map(([lobId, tId]) => ({
          lobo: jugadores(game).find((p) => p.id === lobId)?.name,
          objetivo: jugadores(game).find((p) => p.id === tId)?.name,
        })),
      };
      if (player.role === 'saboteador') {
        vista.fase.sabotaje = {
          pruebas: game.puzzles.filter((p) => p.estado === 'disponible').map((p) => ({ id: p.id, nombre: p.nombre })),
          miSabotaje: ronda.night.sabotage[player.id] ?? null,
        };
      }
    } else if (player.role === 'medico') {
      vista.fase.proteger = {
        objetivos: vivos(game)
          .filter((p) => p.id !== player.lastProtected && (p.id !== player.id || !player.selfProtectUsed))
          .map((p) => ({ id: p.id, name: p.name })),
        miProteccion: ronda.night.protect[player.id] ?? null,
      };
    } else if (player.role === 'detective') {
      vista.fase.investigar = {
        objetivos: vivos(game).filter((p) => p.id !== player.id).map((p) => ({ id: p.id, name: p.name })),
        miInvestigacion: ronda.night.investigate[player.id] ?? null,
      };
    } else {
      vista.fase.decoy = {
        opciones: opcionesDecoy(),
        miOpcion: ronda.night.decoy[player.id] ?? null,
      };
    }
  }

  if (game.phase === 'votacion' && ronda) {
    vista.fase.votacion = {
      candidatos: vivos(game).filter((p) => p.id !== player.id).map((p) => ({ id: p.id, name: p.name })),
      miVoto: esAdmin ? null : (ronda.votes[player.id] ?? null),
      emitidos: Object.keys(ronda.votes).length,
      total: vivos(game).length,
    };
  }

  if ((game.phase === 'cierre' || game.phase === 'fin') && ronda?.voteResult) {
    vista.fase.resultadoVotacion = ronda.voteResult;
  }
  if ((game.phase === 'resolucion' || game.phase === 'debate') && ronda?.resolution) {
    vista.fase.resolucion = { textoPublico: ronda.resolution.textoPublico };
  }

  // ── Panel del narrador: visión completa ──
  if (esAdmin) {
    vista.admin = {
      roles: jugadores(game).map((p) => ({ id: p.id, name: p.name, role: p.role, state: p.state })),
      noche: ronda ? {
        wolfVotes: mapNombres(game, ronda.night.wolfVotes),
        protect: mapNombres(game, ronda.night.protect),
        investigate: mapNombres(game, ronda.night.investigate),
        sabotage: Object.fromEntries(Object.entries(ronda.night.sabotage).map(([pid, pzId]) => [
          nombre(game, pid), game.puzzles.find((x) => x.id === pzId)?.nombre ?? '?',
        ])),
        decoy: Object.fromEntries(Object.entries(ronda.night.decoy).map(([pid, i]) => [nombre(game, pid), opcionesDecoy()[i]])),
      } : null,
      votos: ronda ? Object.fromEntries(Object.entries(ronda.votes).map(([pid, t]) => [
        nombre(game, pid), t === 'abstencion' ? '(abstención)' : nombre(game, t),
      ])) : null,
      checklist: game.puzzles.map((pz) => ({
        id: pz.id, sala: game.rooms.find((r) => r.id === pz.roomId)?.nombre, nombre: pz.nombre,
        respuesta: pz.answerPlainAdmin, fisico: pz.fisico, estado: pz.estado,
      })),
      rolesDisponibles: Object.values(ROLES).map((r) => ({ slug: r.slug, nombre: r.nombre, faccion: r.faccion })),
      rolesOverride: game.settings.rolesOverride,
    };
  }

  return vista;
}

function nombre(game, playerId) {
  return game.players.find((p) => p.id === playerId)?.name ?? '?';
}
function mapNombres(game, obj) {
  return Object.fromEntries(Object.entries(obj).map(([a, b]) => [nombre(game, a), nombre(game, b)]));
}
