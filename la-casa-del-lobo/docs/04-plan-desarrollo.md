# La Casa del Lobo — Plan de desarrollo

> Documento 04 de 04. Se trabaja por módulos; cada fase termina con sus pruebas en verde, el README actualizado y un commit/PR propio. No se avanza con funcionalidades simuladas sin marcarlas como tales.

## Fase 1 — Diseño ✅ (este PR)

**Entregables:** análisis y decisiones (`01`), GDD con reglas, roles, mecánicas y flujo (`02`), arquitectura y esquema de BD (`03`), este plan (`04`).
**Criterio de salida:** diseño aprobado por el propietario del proyecto.

## Fase 2 — Prototipo funcional (núcleo social)

El corazón del juego sin escape room: una partida de deducción jugable de principio a fin.

- Proyecto Next.js + TS + Tailwind; proyecto Supabase con migraciones del esquema (§9 de arquitectura) y RLS.
- Auth anónima; crear partida, código de sala, QR, unirse, sala de espera.
- Reparto secreto de roles (escenario base mínimo embebido); pantalla de revelación.
- Máquina de fases con `advance_phase` (manual por narrador + temporizador), noche con acciones reales y señuelo, resolución nocturna determinista, debate, votación con desempates, conversión a fantasma (sin Otro Lado completo: pantalla de espectador básica).
- Panel del narrador mínimo: configuración, avance de fases, matar/revivir, mensajes.
- **Pruebas:** unitarias de resolución nocturna y votos; integración de seguridad RLS (lectura de rol ajeno, voto duplicado, voto de muerto → todos deben fallar).
- **Hito de verificación:** una partida de 6 simulada con varios navegadores.

## Fase 3 — Escape room

- CRUD de habitaciones y pruebas desde el panel; estados y condiciones de desbloqueo.
- `check_puzzle_answer` con hash, normalización y rate‑limit; pruebas cooperativas; validación por narrador (fotos a Storage); recompensas, inventario y descubrimientos; tablón público; el Expediente.
- Generador de checklist de montaje imprimible.
- **Pruebas:** unitarias de desbloqueos/recompensas; integración de visibilidad (vista segura: exclusividades invisibles, `answer_hash` nunca expuesto).

## Fase 4 — Multijugador en tiempo real

- Canales Realtime segmentados con autorización; notificaciones con prioridades, sonido y estado de lectura; presencia y reconexión (`get_my_game_state`); temporizadores servidor‑cliente; sabotaje/blindaje en vivo.
- **Pruebas:** e2e multi‑contexto de sincronización (voto, cambio de fase, notificación segmentada); corte y reconexión.

## Fase 5 — Experiencia completa

- Dirección de arte definitiva (dos pieles: vivos / Otro Lado), animaciones y transición de muerte; sonidos de aviso y audio ambiental en el dispositivo del narrador.
- Otro Lado completo: pruebas espectrales, Ectoplasma, misiones, Médium, materializar pista, perturbaciones, marca espectral, puntuación de fantasma.
- Eventos especiales; misiones rotatorias; intercambio de objetos; acta de partida exportable.
- Import/export de escenarios JSON (validación Zod); escenario base "La Casa del Lobo" completo como seed; PWA instalable + Web Push opcional.
- **Pruebas:** unitarias del validador de escenarios y economía; e2e de flujo fantasma.

## Fase 6 — Pruebas y endurecimiento

- E2E de la **simulación de referencia** (GDD §13.3) con 10 clientes: test de regresión principal.
- Batería de seguridad en negativo ampliada; prueba de carga ligera (20 clientes); pruebas reales en iOS Safari y Android Chrome (instalación, suspensión, reconexión, batería).
- Playtest presencial guiado con checklist de observación (ritmo, fugas de fantasmas, cuellos de botella en pruebas) → ajustes de equilibrio en datos de escenario.
- Corrección de errores y congelación de la v1.

## Reglas de trabajo (vigentes todo el proyecto)

- Un módulo por PR; commits descriptivos por unidad lógica; nunca romper fases anteriores (la suite completa corre en CI en cada PR).
- Nada simulado sin etiquetar: los placeholders se marcan `// SIMULADO:` y se listan en el README hasta eliminarse. Sin datos falsos presentados como reales.
- Al cerrar cada fase: resumen de lo construido, lo que funciona, lo que falta, resultado de las pruebas y propuesta del siguiente paso.
