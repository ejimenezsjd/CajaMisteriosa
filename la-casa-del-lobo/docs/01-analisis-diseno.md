# La Casa del Lobo — Análisis del concepto y decisiones de diseño

> Documento 01 de 04. Lectura previa recomendada antes del GDD (`02-gdd.md`).

Este documento analiza el concepto propuesto, identifica los problemas de diseño más graves de un híbrido físico‑digital de deducción social, y justifica las decisiones que el GDD adopta para resolverlos. Cada problema tiene un identificador (P‑01, P‑02…) que se referencia desde el GDD y la arquitectura.

---

## 1. Fortalezas del concepto

1. **La casa como tablero** elimina el principal problema de los juegos de deducción por app: la gente mirando el móvil en círculo. Aquí el móvil es una herramienta de campo, no el juego entero.
2. **Los fantasmas como segunda vida** ataca el defecto histórico de El Lobo / Werewolf: la eliminación temprana expulsa al jugador de la fiesta. Convertir la muerte en un cambio de modo de juego es la mejor idea del concepto y debe tratarse como mecánica de primera clase, no como consuelo.
3. **El narrador asistido por la app** permite partidas largas (2–4 h) sin que el narrador tenga que memorizar estados: la app lleva la contabilidad y el narrador aporta teatro.
4. **Escenarios reutilizables** convierten el desarrollo en una plataforma: el coste de crear "El Culto del Bosque" después de "La Casa del Lobo" es contenido, no código.

---

## 2. Problemas de diseño detectados y soluciones adoptadas

### P‑01 — La app no puede verificar el mundo físico

**Problema.** Un candado físico abierto, un objeto encontrado o un rompecabezas montado no son verificables por software. Si "marcar como completada" basta, los lobos (o los tramposos) pueden falsear el progreso.

**Solución adoptada.**
- Toda prueba cuya resolución importe mecánicamente debe terminar en un **código verificable** introducido en la app: la respuesta del acertijo, el número del candado, una palabra escondida dentro de la caja que abre el candado, etc. El mundo físico produce el código; la app lo valida en servidor.
- Las pruebas sin respuesta verificable (p. ej. "haz una foto del símbolo del lobo") pasan a un estado `pendiente_validacion` y las valida el narrador desde su panel con un toque.
- "Marcar como hecha" sin código solo existe para tareas de ambientación sin recompensa mecánica.

### P‑02 — La muerte es físicamente visible

**Problema.** En una casa, todos ven quién está "muerto". No se puede ocultar, y fingir que el muerto desaparece es impracticable.

**Solución adoptada.** No luchar contra ello: en El Lobo clásico las muertes también son públicas. Se formaliza:
- La muerte se anuncia con un **evento narrativo** (notificación global + lectura del narrador).
- El fantasma recibe un **distintivo físico** (propuesto en el kit del escenario: una vela LED o un colgante) y pasa a regirse por el **Pacto de Silencio** (ver P‑03).
- Lo que sí permanece secreto es el **rol** del muerto, salvo que la configuración de partida indique revelarlo.

### P‑03 — Fuga de información de los fantasmas

**Problema.** El mayor riesgo del sistema de fantasmas: un muerto conoce información decisiva (quién le mató, lo que vio, a veces roles) y comparte espacio físico con los vivos. Una ceja levantada puede romper la partida.

**Solución adoptada.** Tres capas:
1. **Regla social dura — Pacto de Silencio:** los fantasmas no hablan con vivos sobre la partida, no gesticulan, no responden preguntas. Es una regla de mesa impresa en pantalla al morir y recordada por la app. Los juegos de rol en vivo demuestran que esta regla se respeta si el fantasma tiene *cosas mejores que hacer* (ver P‑04).
2. **Limitación de información en la app:** el fantasma NO ve los roles de los demás ni las acciones nocturnas en curso. Ve una capa de información *distinta* (el "Otro Lado"): pistas espectrales, misiones propias, fragmentos de historia. Saber quién te mató se revela solo si el escenario lo decide, y normalmente de forma parcial.
3. **Canales de comunicación con ancho de banda limitado y mediado por el sistema:**
   - El **Médium** vivo puede recibir, una vez por ronda, una respuesta de los fantasmas restringida a un formato cerrado (p. ej. sí/no/no sabemos, o elegir 1 carta de 3 símbolos). Los fantasmas votan la respuesta en su panel; el sistema entrega el resultado agregado, nunca texto libre.
   - Los fantasmas pueden **cargar pistas espectrales**: al completar misiones de fantasma, "materializan" una pista que aparece como prueba desbloqueable para los vivos en una habitación (los vivos deben encontrarla y resolverla; el contenido lo controla el escenario, no el fantasma).
   - El narrador puede convertir logros de fantasmas en **eventos globales** ambientales ("se oye un aullido en el sótano…"), que insinúan sin revelar.

### P‑04 — Fantasmas sin propósito = fantasmas que molestan

**Problema.** Si el "modo fantasma" es solo mirar, los muertos se aburren y la tentación de romper P‑03 crece.

**Solución adoptada.** Los fantasmas tienen **economía, misiones y condición de victoria propias**:
- Ganan **Ectoplasma** (recurso exclusivo) resolviendo pruebas espectrales (pruebas físicas marcadas como `solo_fantasmas`, repartidas por la casa e invisibles en la app de los vivos).
- Gastan Ectoplasma en materializar pistas, susurros al Médium o perturbaciones (eventos ambientales).
- Conservan **lealtad de facción**: un lobo muerto ayuda a los lobos (sus materializaciones son pistas falsas del escenario), un humano muerto ayuda a los humanos. Esto mantiene la tensión: los vivos no pueden fiarse ciegamente del Otro Lado.
- Tienen una **puntuación de fantasma** y un reconocimiento al final ("Fantasma más influyente"), de modo que morir pronto no significa perder la noche.

### P‑05 — Las acciones nocturnas delatan por comportamiento

**Problema.** En el salón de una casa, si solo los lobos tocan el móvil durante la noche, todos saben quiénes son.

**Solución adoptada.** La **Noche es 100 % digital y universal**: al empezar la fase nocturna, *todos* los jugadores vivos se sientan (idealmente en el mismo espacio, con la luz bajada) y *todos* interactúan con su móvil durante toda la fase. Quien no tiene acción nocturna real recibe una **acción señuelo** (un minijuego o decisión narrativa sin efecto mecánico visible, aunque algunas pueden otorgar pequeñas recompensas para que no se perciban como vacías). La fase dura un tiempo fijo para todos, independientemente de cuándo termine cada uno.

### P‑06 — El sabotaje físico delata al lobo

**Problema.** Si el Saboteador tiene que esconder físicamente una pieza del puzle, puede ser visto.

**Solución adoptada.** El sabotaje es **digital y anónimo**: bloquear una prueba en la app, falsear temporalmente una pista, retrasar un desbloqueo. El efecto se manifiesta narrativamente ("el candado del sótano parece atascado…"). Nada obliga al lobo a exponerse físicamente. Los lobos tienen además pruebas exclusivas (`solo_lobos`) que pueden resolver *a plena vista*, porque en la app de un humano esa prueba aparece como una prueba normal distinta: nadie puede saber qué está resolviendo otro jugador mirándole.

### P‑07 — Carrera de puzles vs. juego social

**Problema.** Si completar pruebas diera la victoria directamente, los humanos óptimos ignorarían el debate y harían speedrun de puzles; los lobos no podrían impedirlo.

**Solución adoptada.** Las pruebas **no ganan la partida por sí mismas**: producen *ventaja informativa y recursos* (pistas sobre los lobos, objetos, puntos de investigación, desbloqueos de habilidades). La victoria se decide en el juego social (eliminar lobos / igualar a los humanos), con condiciones alternativas configurables (ver GDD §10) que siempre pasan por un embudo social (p. ej. "desbloquear la salida" exige un código compuesto que requiere cooperación y se puede sabotear). El porcentaje de pruebas completadas funciona como *reloj de presión* para los lobos (sabotaje) más que como vía rápida humana.

### P‑08 — Conectividad y baterías en una casa rural

**Problema.** Cobertura móvil irregular, Wi‑Fi doméstico saturado, baterías agotadas a mitad de partida.

**Solución adoptada.**
- La app es una PWA ligera con **reconexión automática y estado reconstruible**: todo el estado vive en servidor; al reconectar, el cliente se resincroniza completo. Perder la conexión 2 minutos no rompe nada.
- Las fases avanzan por **temporizador de servidor o por el narrador**, nunca dependen de que todos los clientes estén conectados.
- El **narrador puede actuar en nombre de un jugador** (votar, usar habilidad) desde el panel de administración si un móvil muere (modo emergencia, GDD §8).
- Recomendación operativa en el manual: regleta de carga en el salón y partida en la Wi‑Fi de la casa.

### P‑09 — Notificaciones push no fiables en móvil web

**Problema.** En iOS, Web Push solo funciona si la PWA está instalada en pantalla de inicio (iOS ≥ 16.4) y el usuario acepta permisos; muchos no lo harán.

**Solución adoptada.** El juego se diseña para funcionar **sin push**: la app abierta recibe todo por canal realtime (WebSocket) con sonido/vibración; los momentos que exigen atención simultánea (noche, asamblea, votación) se anuncian además **por el altavoz del narrador o un dispositivo central** (la app del narrador puede reproducir audio ambiental y avisos). Web Push se ofrece como mejora opcional, nunca como dependencia. Detalle técnico en `03-arquitectura.md` §7.

### P‑10 — Carga del narrador

**Problema.** Preparar la casa, controlar fases, validar fotos, improvisar… puede quemar al narrador.

**Solución adoptada.**
- Modo recomendado para las primeras partidas: **narrador dedicado** (no juega).
- Modo alternativo soportado desde el diseño: **narrador‑autómata**, donde las fases avanzan por temporizador, la resolución nocturna es automática y el "admin" solo interviene en emergencias (puede entonces incluso jugar, con la limitación de que ve el panel; se desaconseja pero se permite para grupos pequeños).
- El escenario incluye un **checklist de montaje imprimible** (qué esconder, dónde, qué escribir en cada sobre) generado a partir de los datos del escenario.

### P‑11 — Empates, abstenciones y casos límite de votación

**Problema.** Empates en la asamblea, jugadores que no votan, votos al borde del cierre.

**Solución adoptada.** Reglas explícitas y configurables (GDD §6.6): desempate por segunda votación restringida a los empatados → si persiste, regla configurable (nadie muere / azar / decide el alcalde si el escenario usa ese rol). La abstención es válida y pública como recuento (no como identidad). El cierre lo marca el servidor; los cambios de voto valen hasta el cierre.

### P‑12 — Jugadores pasivos o desenganchados

**Problema.** En grupos grandes, un civil tímido puede pasarse una ronda sin nada que hacer.

**Solución adoptada.** Toda ronda, todo jugador vivo tiene como mínimo: 1 objetivo personal ligero (misión secundaria rotatoria), acceso a pruebas abiertas y la acción nocturna (real o señuelo). El sistema de misiones secundarias (GDD §9.4) garantiza actividad individual, y las pruebas cooperativas obligan a mezclarse.

### P‑13 — Confianza cero en el cliente

**Problema.** Es una app web: cualquiera puede abrir las herramientas de desarrollador. Si el rol, los votos o las respuestas de los puzles llegan al navegador, el juego está roto.

**Solución adoptada.** Principio rector de toda la arquitectura (ver `03-arquitectura.md` §5): el cliente solo recibe la información que su jugador puede ver; todas las validaciones (respuestas de pruebas, permisos de voto, habilidades) ocurren en servidor; las respuestas correctas se almacenan con hash; los canales realtime están segmentados por audiencia (global / facción / jugador / fantasmas / admin).

---

## 3. Mejoras propuestas sobre el concepto original

Aceptadas e integradas en el GDD:

1. **El Otro Lado como "segundo juego" completo** (P‑04): economía de Ectoplasma, misiones y ranking de fantasmas.
2. **Noche universal con acciones señuelo** (P‑05): elimina el metajuego de observación.
3. **Pistas con contenido controlado por el escenario, no por el jugador** (P‑03): los fantasmas eligen *cuándo y dónde* aparece una pista, el escenario decide *qué dice*. Imposible dictar nombres.
4. **Sabotaje digital anónimo con contramedida** (P‑06): el Guardián puede blindar una prueba; el sabotaje a una prueba blindada falla y deja un rastro ("alguien ha intentado forzar la vitrina"), creando un mini‑juego de gato y ratón.
5. **Reloj de presión dual**: los humanos sienten presión por las eliminaciones nocturnas; los lobos, por el avance del "Expediente" (meta‑progreso de investigación que acumulan las pruebas resueltas y que va revelando información sobre la manada: primero cuántos lobos quedan, luego pistas de identidad). Así ambas facciones quieren controlar el ritmo del escape room.
6. **Acta de partida**: registro cronológico exportable al final (quién hizo qué) para la sobremesa, que suele ser la mejor parte de estos juegos.

Descartadas (con motivo):

- **Chat de texto entre vivos dentro de la app**: descartado en v1. El juego es presencial; un chat compite con la conversación cara a cara y multiplica la superficie de fugas. Solo existen mensajes del sistema/narrador y el canal nocturno de la manada.
- **Geolocalización o balizas por habitación (QR obligatorio para entrar)**: descartado como requisito; los QR por habitación existen pero como *acceso rápido opcional* a la lista de pruebas de esa sala, no como control de presencia (demasiado frágil en interiores).
- **Mapa gráfico interactivo de la casa en v1**: se sustituye por listado de habitaciones con estado; un plano bonito es contenido del escenario, no mecánica.

---

## 4. Riesgos residuales asumidos

| Riesgo | Mitigación | Aceptación |
|---|---|---|
| Un fantasma rompe el Pacto de Silencio verbalmente | Regla social + diseño que le da alternativas mejores; el narrador puede penalizar (quitar Ectoplasma) | No es resoluble por software; se asume |
| Dos jugadores miran la misma pantalla | Aviso de privacidad en pantallas sensibles (fondo oscuro, botón "mantener pulsado para revelar") | Mitigado, no eliminable |
| El narrador‑jugador hace trampas | Modo narrador dedicado recomendado; log íntegro de acciones de admin en el acta | Asumido en modo autómata |
| Wi‑Fi se cae por completo > 10 min | Fases por narrador con la app del narrador en datos móviles; manual de contingencia | Caso extremo asumido |
