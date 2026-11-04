# La Casa del Lobo — Aplicación (prototipo jugable)

Prototipo funcional del juego: núcleo social completo (Fase 2 del plan) + base del escape room (parte de la Fase 3). Servidor Node autocontenido con toda la lógica y los secretos en el servidor; los móviles solo necesitan un navegador.

## Cómo probarlo

Requisitos: [Node.js](https://nodejs.org) 18 o superior en un ordenador.

```bash
cd la-casa-del-lobo/app
npm install
npm start
```

El servidor queda en `http://localhost:3000`.

**Para jugar con móviles (misma Wi‑Fi):**

1. Averigua la IP local del ordenador (Mac: `ipconfig getifaddr en0`; Windows: `ipconfig`; Linux: `hostname -I`).
2. En cada móvil, abre `http://IP_DEL_ORDENADOR:3000` (ejemplo: `http://192.168.1.20:3000`).
3. Una persona crea la partida (será el narrador, no juega como personaje) y comparte el código de sala o el enlace de invitación.
4. El resto se une con el código y su nombre. Mínimo 4 jugadores (6+ recomendado).
5. El narrador ajusta lo que quiera y pulsa «Empezar la partida».

Funciona sin internet: basta la Wi‑Fi local de la casa. En el móvil puedes «Añadir a pantalla de inicio» para jugar a pantalla completa.

> ⚠️ **GitHub Pages no sirve para esta app** (a diferencia de los otros juegos del repositorio): necesita un servidor Node corriendo. Para jugar presencialmente basta el ordenador en la misma Wi‑Fi. Si quieres una URL pública, cualquier hosting de Node gratuito vale (Render, Railway, Fly.io): es una app Node estándar que respeta la variable `PORT`.

## Qué está implementado

- Crear partida, código de sala, enlace de invitación, sala de espera en tiempo real.
- Reparto secreto de roles según el GDD (lobo, alfa, saboteador, médico, detective, civil), automático por nº de jugadores o ajustado a mano.
- Motor de fases por ronda: exploración → noche → amanecer → debate → votación → cierre, con temporizadores orientativos y avance controlado por el narrador.
- Noche universal: todos los vivos tienen acción nocturna (caza de la manada con voto conjunto, protección del médico con sus límites, investigación del detective con el engaño del alfa, sabotaje, y acciones señuelo para quien no tiene poder).
- Resolución nocturna determinista, votación secreta y cambiable con reglas de empate configurables, revelación del eliminado configurable, condiciones de victoria y pantalla final con todas las máscaras caídas.
- Conversión a fantasma con Pacto de Silencio (pantalla espectral; los fantasmas no votan ni actúan).
- Escape room básico: habitaciones y pruebas con respuesta verificada en servidor (hash + normalización de tildes/mayúsculas), pistas, rate‑limit de intentos, sabotaje que inutiliza pruebas una exploración, escenario demo con 8 pruebas y checklist de montaje físico para el narrador.
- Panel del narrador: ajustes, control de fases, acciones nocturnas y votos en vivo, matar/revivir (modo emergencia), mensajes globales e individuales, editor de habitaciones y pruebas, registro completo.
- Tiempo real por WebSocket con vistas filtradas por jugador en servidor (nadie recibe roles, votos ni respuestas ajenas), reconexión automática y persistencia a disco (las partidas sobreviven a un reinicio del servidor).

## Qué falta (fases 3–6 del plan)

- El Otro Lado completo: pruebas espectrales, Ectoplasma, misiones de fantasma, Médium. Hoy el fantasma solo observa.
- Roles Guardián, Explorador, Médium, Manipulador y neutrales; Expediente, inventario, intercambio, recompensas mecánicas (hoy las recompensas son narrativas).
- Eventos especiales, escenarios importables JSON, condiciones de victoria alternativas, audio, notificaciones push.
- Pruebas cooperativas y validación por foto.

## Tests

```bash
npm test
```

21 pruebas: unitarias del motor (reparto, resolución nocturna, votaciones y empates, victoria, pruebas y rate‑limit) y una partida completa de 6 jugadores contra el servidor real por HTTP, incluyendo comprobaciones de seguridad en negativo (tokens inválidos, votos de muertos, roles ajenos ocultos, hashes nunca expuestos).

## Arquitectura del prototipo

- `src/engine.js` — todas las reglas, puro y sin dependencias (portable a Edge Functions en fases futuras).
- `src/views.js` — vista filtrada por jugador: lo único que viaja al cliente.
- `server.js` — HTTP estático + API JSON + WebSocket + persistencia.
- `public/` — PWA móvil sin dependencias ni paso de build.

Nota sobre el plan: la Fase 2 preveía Supabase; se ha optado por este servidor Node autocontenido para que el juego sea probable de inmediato (sin cuentas ni despliegues) y para jugar sin internet en una casa rural. El diseño de `docs/03-arquitectura.md` sigue vigente como camino de producción si algún día hace falta hosting gestionado; el motor está aislado precisamente para poder migrarlo.
