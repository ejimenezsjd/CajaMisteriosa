# La Casa del Lobo

Escape room físico + deducción social + rol en vivo para 6–20 jugadores en una casa rural, orquestado por una PWA móvil que actúa como narrador, repartidor de secretos, motor de rondas y gestor de pruebas.

**La idea en una frase:** la casa es el tablero, los jugadores son los protagonistas, el móvil es el hilo con la historia — y morir no te saca del juego: te lleva al **Otro Lado**, un segundo juego para fantasmas con pruebas, economía e influencia propias.

## Estado del proyecto

**Fase 2 — Prototipo jugable: completada** (incluye parte de la Fase 3). Hay una aplicación funcional en [`app/`](app/) con el núcleo social completo (roles secretos, fases, noche, votaciones, fantasmas, panel del narrador) y el escape room básico (habitaciones, pruebas verificadas en servidor, sabotaje, escenario demo). 21 tests automatizados en verde.

**Cómo probarla:** ver [`app/README.md`](app/README.md). Resumen: `cd app && npm install && npm start` y los móviles entran por la Wi‑Fi local en `http://IP_DEL_ORDENADOR:3000`.

## Documentación

| Documento | Contenido |
|---|---|
| [`docs/01-analisis-diseno.md`](docs/01-analisis-diseno.md) | Análisis del concepto, 13 problemas de diseño detectados (P‑01…P‑13) y las soluciones adoptadas |
| [`docs/02-gdd.md`](docs/02-gdd.md) | Game Design Document: reglas, roles, fases, fantasmas, escape room, economía, victoria, equilibrio por tamaño de grupo y simulación de partida |
| [`docs/03-arquitectura.md`](docs/03-arquitectura.md) | Stack (Next.js + Supabase), modelo de seguridad de confianza cero, esquema SQL completo con RLS, realtime, PWA/push y formato JSON de escenarios |
| [`docs/04-plan-desarrollo.md`](docs/04-plan-desarrollo.md) | Plan por fases (2: prototipo social → 3: escape room → 4: realtime → 5: experiencia → 6: pruebas) |

## Decisiones clave (resumen)

- **Confianza cero en el cliente:** roles, votos, acciones nocturnas y respuestas de pruebas viven solo en servidor; el cliente solo lee lo que su jugador puede ver (RLS + funciones de servidor).
- **El mundo físico produce códigos, la app los valida:** toda prueba con efecto mecánico termina en un código verificable; las de foto las valida el narrador.
- **Noche universal:** durante la fase nocturna todos interactúan con el móvil (acciones reales o señuelo) para que nadie delate su rol por comportamiento.
- **Fantasmas con juego propio:** Pacto de Silencio + canales de influencia mediados por el sistema (Médium, pistas materializadas, perturbaciones) para que ayuden sin poder romper el misterio.
- **Escenarios como contenido:** el motor es agnóstico; "La Casa del Lobo" es el primer paquete JSON importable, con más escenarios futuros sin tocar código.
