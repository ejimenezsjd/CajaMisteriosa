# La Casa del Lobo — Game Design Document (GDD)

> Documento 02 de 04. Las decisiones de diseño se justifican en `01-analisis-diseno.md` (referencias P‑01…P‑13).
> Versión 1.0 — base para la Fase 1 del plan de desarrollo.

---

## 1. Visión general

**La Casa del Lobo** es una experiencia híbrida presencial para 6–20 jugadores que combina:

- **Deducción social** (linaje de El Lobo/Werewolf): facciones secretas, eliminaciones nocturnas, asambleas y votaciones.
- **Escape room físico**: la casa rural es el tablero; sus habitaciones contienen pruebas, códigos y objetos reales.
- **Juego de rol ligero**: cada jugador tiene un rol con habilidades, y un narrador (humano o automático) conduce la historia.

La **aplicación móvil (PWA)** es el centro de control: reparte secretos, gestiona fases, valida pruebas, recoge votos y acciones nocturnas, y mantiene a cada jugador dentro de la ficción.

**Pilar central:** *nadie deja de jugar*. La muerte transforma al jugador en **fantasma** y le abre el **Otro Lado**: un segundo juego con pruebas, economía y misiones propias (P‑04).

### 1.1 Ficha

| | |
|---|---|
| Jugadores | 6–20 (óptimo 9–12) + narrador (dedicado recomendado) |
| Duración | 2–4 h configurable (ver §13) |
| Espacio | Casa con ≥ 4 estancias utilizables |
| Dispositivos | 1 móvil por jugador (navegador), 1 dispositivo para el narrador |
| Material físico | Kit del escenario: sobres, tarjetas, candados, objetos (checklist imprimible) |
| Edad | 12+ (terror psicológico ligero) |

### 1.2 Sinopsis del escenario base

> Habéis alquilado la vieja casa de los Garralda para un fin de semana. Al caer la tarde, las puertas se bloquean y un cuaderno aparece en la mesa del salón: *"La manada ya está dentro. Siempre lo estuvo."* Entre vosotros hay lobos con forma humana. Tenéis hasta el amanecer para descubrirlos… o para que no quede nadie que pueda contarlo.

---

## 2. Bucle de juego y máquina de fases

La partida es una secuencia de **rondas**; cada ronda recorre fases controladas por un motor de estados en servidor. El narrador puede avanzar, retroceder o alargar cualquier fase (P‑10); en modo autómata las fases avanzan por temporizador.

```
LOBBY → REPARTO_ROLES → PRÓLOGO
  └─► RONDA n:
        1. EXPLORACIÓN      (20–30 min)  los jugadores recorren la casa y resuelven pruebas
        2. INVESTIGACIÓN     (5–10 min)  puesta en común, intercambios, Expediente
        3. NOCHE             (5–8 min)   acciones privadas simultáneas en la app (P‑05)
        4. RESOLUCIÓN        (2–3 min)   el servidor procesa; el narrador dramatiza
        5. DEBATE            (8–15 min)  discusión abierta con temporizador visible
        6. VOTACIÓN          (2–3 min)   voto secreto en la app
        7. CIERRE DE RONDA   (1–2 min)   resultados, muertes, nuevos fantasmas, desbloqueos
  └─► ¿condición de victoria? ──sí──► EPÍLOGO + ACTA DE PARTIDA
                               no ──► RONDA n+1
```

Notas:

- **Exploración + Investigación** forman el "día"; el escenario puede fusionarlas en rondas tardías para acelerar el final.
- La **primera ronda no tiene votación** (configurable): da tiempo a que el escape room arranque antes de la primera asamblea.
- La fase de **acontecimientos especiales** no es una fase fija: son **eventos** que el escenario o el narrador inyectan en cualquier fase (ver §11).
- Todo cambio de fase genera una notificación global y, opcionalmente, un audio ambiental en el dispositivo del narrador.

---

## 3. Sistema de roles

### 3.1 Estructura de un rol

Cada rol se define por datos (configurable por escenario, P‑13 del análisis y §13 de contenido):

| Campo | Descripción |
|---|---|
| `nombre` | Nombre visible para su portador |
| `faccion` | `humanos` \| `lobos` \| `neutral` |
| `descripcion` | Texto narrativo que ve el jugador al recibirlo |
| `objetivo` | Qué debe lograr, en una frase |
| `habilidades[]` | Acciones especiales: fase en la que se usan, objetivo, usos por ronda/partida, cooldown |
| `limitaciones[]` | Restricciones explícitas |
| `condicion_victoria` | Referencia a una condición (§10) |
| `info_visible` | Qué información extra recibe (p. ej. los lobos se conocen entre sí) |
| `conserva_al_morir` | Qué parte de su identidad afecta a su juego como fantasma |

El reparto es **aleatorio, secreto y servidor‑exclusivo**: ningún cliente recibe jamás un rol ajeno (P‑13).

### 3.2 Facción humana — objetivo: descubrir y eliminar a los lobos

| Rol | Habilidad | Usos | Limitaciones |
|---|---|---|---|
| **Investigador** | Tras cada fase de Investigación, recibe 1 fragmento extra del Expediente (§8.4) si esa ronda se completaron ≥ 2 pruebas | 1/ronda, pasiva | El fragmento puede ser ambiguo; no elige cuál |
| **Médico** | De noche protege a 1 jugador (puede ser él mismo 1 vez por partida) de la eliminación | 1/noche | No puede repetir objetivo dos noches seguidas |
| **Detective** | De noche investiga a 1 jugador: recibe `huele a lobo / no huele a lobo` | 1/noche | El Alfa y los neutrales devuelven resultado falso o ambiguo según escenario |
| **Guardián** | Blinda 1 prueba o habitación hasta la siguiente noche: el sabotaje sobre ella falla y deja rastro (P‑06) | 1/ronda | No puede blindar la misma prueba dos rondas seguidas |
| **Médium** | Una vez por ronda formula una pregunta cerrada al Otro Lado; los fantasmas votan y recibe la respuesta agregada (P‑03) | 1/ronda | Formatos cerrados: sí/no/no sabemos o elección de 1 símbolo entre 3 |
| **Explorador** | Ve 1 pista adicional en cada prueba iniciada y puede saltarse 1 condición de desbloqueo por ronda | pasiva + 1/ronda | No funciona en pruebas `solo_lobos`/`solo_fantasmas` |
| **Civil** | Sin habilidad especial; acción nocturna señuelo con microrrecompensa ocasional (P‑05) | — | — |

### 3.3 Facción de los lobos — objetivo: igualar/superar a los humanos sin ser descubiertos

Los lobos **se conocen entre sí** (`info_visible`) y comparten canal privado solo durante la Noche.

| Rol | Habilidad | Usos | Limitaciones |
|---|---|---|---|
| **Lobo** | Participa en la selección nocturna de víctima (voto de manada; debe ser unánime o por mayoría según configuración) | 1/noche | Si la manada no acuerda en el tiempo de fase, no hay víctima |
| **Alfa** | Una vez por partida altera un acontecimiento: anula una protección del Médico, falsea el resultado del Detective de esa noche o fuerza un evento del escenario | 1/partida | Debe declararlo durante la Noche; ante el Detective "no huele a lobo" |
| **Saboteador** | Bloquea o corrompe 1 prueba hasta el final de la siguiente Exploración (los que la intenten reciben una pista falsa marcada por el escenario) | 1/ronda | Falla contra pruebas blindadas por el Guardián y deja rastro |
| **Manipulador** | En una votación: duplica en secreto el peso de su voto **o** anula el voto de un jugador elegido (se anuncia "un voto se ha perdido", sin identidad) | 1/partida cada modo | No puede usar ambos efectos en la misma asamblea |

### 3.4 Roles neutrales — objetivos individuales

| Rol | Objetivo | Notas |
|---|---|---|
| **Traidor** | Que la asamblea elimine a un jugador concreto (asignado en secreto al repartir) | Si lo logra, gana y *sigue jugando* como civil; si su objetivo muere de noche, recibe un objetivo de reserva |
| **Superviviente** | Llegar vivo al final de la partida | Gana junto a la facción vencedora si sobrevive; pierde si muere, aunque puede redimirse con la puntuación de fantasma |
| **Maldito** | Condición secreta definida por el escenario (ej.: en el escenario base, si los lobos lo eliminan de noche se convierte en lobo en vez de morir) | El escenario define si los lobos lo saben |

### 3.5 Reparto por tamaño de grupo

Configuración por defecto (el narrador puede modificarla antes de empezar):

| Jugadores | Lobos | Roles lobo especiales | Roles humanos especiales | Neutrales |
|---|---|---|---|---|
| 6–8 | 2 | 1 Saboteador | Médico, Detective, Médium | 0–1 Superviviente |
| 9–12 | 3 | Saboteador + Alfa | + Investigador, Guardián | 1 (Traidor o Superviviente) |
| 13–16 | 4 | Saboteador + Alfa + Manipulador | + Explorador, 2.º Médium opcional | 2 |
| 17–20 | 5 | Todos | Todos (duplicando Explorador/Civil) | 2–3 |

Reglas de equilibrio: ratio lobos ≈ 25 % de los vivos; nunca más de 1 Alfa ni 1 Manipulador; los neutrales nunca superan el 15 % del grupo.

---

## 4. Los jugadores vivos

Un jugador vivo puede, según la fase:

- **Explorar** la casa y abrir la lista de pruebas de cada habitación (acceso directo por QR opcional en la puerta).
- **Resolver pruebas** físicas introduciendo el código/respuesta en la app (P‑01); iniciar pruebas cooperativas que exigen N participantes confirmados.
- **Recoger pistas y objetos** a su inventario (los objetos físicos tienen gemelo digital con código de reclamación impreso).
- **Hablar y negociar** libremente cara a cara; intercambiar objetos vía app si la partida lo permite (§9.3).
- **Usar habilidades** de su rol en la fase correspondiente.
- **Debatir y votar** en asamblea.
- **Consultar** su dashboard: rol (bajo "mantener pulsado para revelar"), objetivos, inventario, historial de eventos públicos y notificaciones.

---

## 5. El Otro Lado — sistema de fantasmas

Al morir, la app del jugador se transforma (transición visual completa: paleta espectral, tipografía distinta) y muestra el **Pacto de Silencio** (P‑03), que debe aceptar para continuar.

### 5.1 Pierde

- Voto en asambleas y voz en debates de vivos.
- Habilidades de su rol vivo (salvo las marcadas `conserva_al_morir`).
- Capacidad de revelar su rol o información de partida a los vivos (regla social reforzada por la app).
- Acceso a pruebas de vivos (desaparecen de su app).

### 5.2 Desbloquea

- **Pruebas espectrales** (`solo_fantasmas`): pruebas físicas repartidas por la casa que los vivos no ven en su app (p. ej. símbolos UV, textos escondidos bajo muebles que solo el Otro Lado "sabe mirar"). Recompensan **Ectoplasma**.
- **Misiones del Otro Lado**: encargos del narrador/escenario (§9.4) con recompensas en Ectoplasma y fragmentos de historia.
- **Fragmentos de historia ocultos**: el trasfondo real de la casa, visible solo para fantasmas (recompensa narrativa por morir).
- **Canales de influencia** (todo mediado por el sistema, P‑03):

| Acción espectral | Coste (Ectoplasma) | Efecto |
|---|---|---|
| **Susurro al Médium** | participar es gratis | Vota en la respuesta agregada a la pregunta del Médium de esa ronda |
| **Materializar pista** | medio | Una pista del escenario (contenido predefinido, verdadero o falso según la facción del fantasma) aparece como prueba desbloqueada en la habitación que elija |
| **Perturbación** | bajo | Evento ambiental global ("las luces del pasillo parpadean…") que el fantasma programa para un momento concreto |
| **Marca espectral** | alto | Durante la siguiente Exploración, 1 prueba elegida muestra a los vivos un aviso: "una presencia la señala" (sin más información) |

- Los fantasmas **conservan facción**: las pistas que materializa un lobo muerto provienen del mazo de pistas falsas del escenario. Los vivos saben que el Otro Lado habla, pero no si dice la verdad.

### 5.3 Objetivos y reconocimiento

Cada fantasma acumula **puntuación espectral** (misiones completadas, pruebas espectrales, influencia usada). El acta final nombra al **Fantasma más influyente** y los fantasmas de la facción ganadora comparten la victoria. Morir pronto cambia el juego, no lo termina.

---

## 6. Fases en detalle

### 6.1 Exploración

- La app muestra: habitaciones desbloqueadas con nº de pruebas disponibles, pruebas activas, objetivos personales, misiones y pistas descubiertas.
- Las pruebas se filtran por visibilidad: estado, exclusividad (`solo_lobos`, `solo_fantasmas`), condiciones de desbloqueo cumplidas.
- Completar una prueba exige el **código/respuesta** (P‑01); el servidor valida, registra autor y hora, reparte recompensas y notifica a quien corresponda. Las pruebas tipo foto quedan `pendiente_validacion` para el narrador.
- Intentos fallidos tienen **rate‑limit** (p. ej. 1 intento/20 s con backoff) para impedir fuerza bruta.

### 6.2 Investigación

- Puesta en común presencial. La app habilita: compartir una pista descubierta al tablón público de la partida (decisión del jugador), intercambiar objetos (si está activado) y consultar el **Expediente** (§8.4).
- Pasivas de Investigador/Médium se resuelven aquí.

### 6.3 Noche (P‑05)

- Interfaz nocturna; todos los vivos sentados, todos interactuando con su móvil durante toda la fase (duración fija).
- Cada rol recibe su pantalla privada: la manada vota víctima en su canal; Médico protege; Detective investiga; el resto recibe acciones señuelo (decisión narrativa o minijuego, con microrrecompensa ocasional para que no se identifiquen como señuelo).
- El narrador puede inyectar eventos nocturnos del escenario.

### 6.4 Resolución nocturna

El servidor procesa en orden determinista: `protecciones → alteraciones del Alfa → eliminación de la manada → investigaciones → sabotajes → eventos`. Contempla protegidos, empates de manada (sin víctima o azar, configurable), acciones incompatibles (prioridad por orden anterior) y eventos aleatorios del escenario. Resultado: notificaciones privadas (Detective), conversiones a fantasma y texto narrativo global que el narrador lee en voz alta.

### 6.5 Debate

Temporizador configurable visible en todas las apps. El tablón público muestra las pistas compartidas y los hechos públicos de la ronda. Sin chat (decisión de diseño, análisis §3).

### 6.6 Votación

- Voto secreto desde la app; solo vivos (validado en servidor, P‑13); cambiable hasta el cierre; abstención permitida.
- Al cerrar: recuento público (número de votos por candidato; la identidad del votante solo si la partida se configura con "voto público", off por defecto).
- **Empate:** segunda votación solo entre empatados → si persiste: `nadie muere` (defecto) | `azar` | `decide un rol designado`.
- El narrador configura si se revela el rol del eliminado (defecto: solo facción).
- Historial completo en el acta.

### 6.7 Cierre de ronda

Actualización de estados, nuevos fantasmas (con su onboarding del Otro Lado), desbloqueos de habitaciones/pruebas programados por el escenario para la ronda siguiente, y chequeo de condiciones de victoria.

---

## 7. Escape room físico

### 7.1 Habitaciones

Creadas por el narrador o importadas del escenario: nombre, descripción ambiental, estado (`bloqueada`/`desbloqueada`), condiciones de desbloqueo (ronda, prueba previa, objeto, evento), QR opcional. Lista base del escenario: salón, cocina, dormitorio principal, dormitorio secundario, baño, jardín, garaje, sótano — el narrador adapta a la casa real y puede desactivar las que no existan.

### 7.2 Modelo de prueba

| Campo | Detalle |
|---|---|
| `nombre`, `descripcion` | Lo que ve el jugador |
| `habitacion` | Dónde está el componente físico |
| `tipo` | Ver §7.3 |
| `dificultad` | 1–5 (informativa y usada por el generador de checklist) |
| `respuesta` | Hash de la(s) respuesta(s) válida(s); normalización de tildes/mayúsculas |
| `pistas[]` | 0–3 pistas progresivas, con coste opcional en puntos de investigación |
| `recompensas[]` | Objetos, fragmentos de Expediente, puntos, desbloqueos, habilidades de un uso |
| `condiciones_desbloqueo[]` | Ronda mínima, prueba previa, objeto en inventario, evento |
| `exclusividad` | `todos` \| `solo_lobos` \| `solo_fantasmas` \| rol concreto |
| `cooperativa` | nº mínimo de participantes confirmados |
| `validacion` | `codigo` (automática) \| `narrador` (foto/manual) \| `marcar` (solo ambientación, P‑01) |
| `estado` | `bloqueada` → `disponible` → `iniciada` → `completada` (+ `saboteada`, `pendiente_validacion`) |

### 7.3 Tipos de prueba (sistema modular, configurables sin código)

1. **Acertijo** — texto en la app o en tarjeta física; respuesta escrita.
2. **Código numérico** — cifras repartidas por la habitación.
3. **Candado físico** — el candado custodia una tarjeta con el código de confirmación que se introduce en la app (así la app verifica sin electrónica, P‑01).
4. **Búsqueda de objetos** — el objeto lleva impreso su código de reclamación.
5. **Mensaje cifrado** — césar, espejo, UV, plantilla…; el escenario incluye la clave en otra prueba.
6. **Rompecabezas** — físico; al montarlo revela el código.
7. **Fotografía** — validación por narrador.
8. **Lógica** — formulario en la app.
9. **Cooperativa** — N jugadores confirman participación antes de poder responder.
10. **Individual** — ligada a un jugador o rol.
11. **Solo lobos** — camuflada: en la app de un humano no existe o aparece como otra prueba (P‑06).
12. **Solo fantasmas** — invisible para vivos (§5.2).

Al completarse: registro de autor(es) y hora, progreso global, recompensas y notificaciones segmentadas.

---

## 8. Economía y progresión

Sin dinero real ni compras. Cuatro recursos:

| Recurso | Quién | Fuente | Uso |
|---|---|---|---|
| **Puntos de investigación (PI)** | vivos | pruebas, misiones | comprar pistas progresivas, ciertos desbloqueos |
| **Objetos** | vivos | pruebas, búsqueda | llaves (desbloqueos), amuletos (defensas de un uso), herramientas (ventajas en tipos de prueba), piezas de código compuesto |
| **Poderes de un solo uso** | vivos | recompensas raras | p. ej. "segunda opinión" (repetir una investigación), "coartada" (anular 1 voto contra ti) |
| **Ectoplasma** | fantasmas | pruebas/misiones espectrales | acciones del Otro Lado (§5.2) |

### 8.1 Intercambio

Entre vivos, vía app, solo en Investigación y si la partida lo permite. Transacción atómica con confirmación de ambos.

### 8.2 Equilibrio anti‑bola de nieve

- Recompensas con **rendimiento decreciente**: el coste en PI de pistas sube con cada compra del mismo jugador.
- Los poderes de un uso son **raros y mayoritariamente defensivos**.
- El sabotaje lobo no destruye progreso: lo **retrasa** (una ronda), para que el escape room nunca se bloquee del todo.

### 8.3 Para los lobos

Los lobos ganan **Puntos de Sabotaje** (resolviendo pruebas `solo_lobos` y con sabotajes exitosos) que alimentan su condición de victoria alternativa (§10) y desbloquean mejoras de manada (p. ej. un segundo sabotaje en una ronda).

### 8.4 El Expediente (reloj de presión, análisis §3.5)

Meta‑progreso global de los humanos: cada prueba relevante aporta fragmentos. Umbrales (configurables): 25 % → nº de lobos iniciales confirmado; 50 % → pista de identidad (ambigua); 75 % → el Detective gana un uso extra; 100 % → se desbloquea la prueba final del escenario. Los sabotajes congelan el Expediente esa ronda. Así los lobos tienen motivo constante para intervenir en el escape room y los humanos para completarlo, sin que el puzle sustituya al juego social (P‑07).

---

## 9. Misiones secundarias

- **Rotatorias personales** (P‑12): cada ronda, todo vivo recibe 1 misión ligera opcional ("comparte una pista con alguien con quien no hayas hablado", "resuelve una prueba en el jardín"). Recompensa: PI.
- **De rol**: ligadas a la habilidad (el Médium: "consigue que los fantasmas respondan 2 preguntas").
- **Del Otro Lado**: misiones de fantasma, encadenadas con la historia oculta.

---

## 10. Condiciones de victoria y finales

Configurables por partida; se evalúan en cada cierre de ronda. Por defecto en el escenario base:

**Humanos ganan si:** no queda ningún lobo vivo, **o** completan la **prueba final** (desbloqueada con Expediente 100 %: un código compuesto que exige piezas en manos de ≥ 3 jugadores distintos — embudo cooperativo y saboteable, P‑07) identificando correctamente a toda la manada en una acusación formal única.

**Lobos ganan si:** igualan o superan en número a los humanos vivos, **o** alcanzan el umbral de Puntos de Sabotaje antes de la ronda límite, **o** (variante) el Alfa sobrevive hasta el final sin haber sido nunca el más votado.

**Neutrales:** su condición individual, compatible con cualquier final.

**Finales alternativos:** el escenario define epílogos distintos según cómo se gana (manada exterminada / éxodo al amanecer / la casa gana — nadie cumple su condición al agotarse las rondas, final "malo" compartido). El epílogo se muestra en todas las apps y lo lee el narrador.

---

## 11. Notificaciones y eventos

Toda notificación: destinatario (global / facción / fantasmas / jugador), tipo, mensaje, prioridad (`info`/`alta`/`critica`), fecha y estado de lectura. Entrega por canal realtime con sonido/vibración según prioridad; push web opcional, nunca requerido (P‑09).

**Eventos especiales**: piezas del escenario que el narrador (o un disparador automático: ronda, umbral del Expediente, acción de fantasma) inyecta en cualquier fase. Ejemplos del escenario base: *El Apagón* (5 min sin lista de pruebas en la app: hay que buscar a ciegas), *El Aullido* (la próxima noche la manada puede elegir 2 víctimas pero el Médico protege a 2), *La Niebla* (los resultados del Detective se entregan con 1 ronda de retraso).

---

## 12. Panel del narrador

Funciones (detalle de pantallas en §14.3 de `03-arquitectura.md`):

- Crear partida desde escenario; configurar jugadores, duración, rondas, roles y cantidades, condiciones de victoria, reglas de empate y revelación de roles.
- Editor de habitaciones y pruebas (CRUD completo sin código) + **generador de checklist de montaje** imprimible.
- Control de partida: iniciar, pausar, avanzar/retroceder fase, alargar temporizadores.
- Validar pruebas `pendiente_validacion`; consultar todas las acciones en vivo.
- Mensajes globales e individuales "del narrador" (integrados en la ficción).
- Lanzar eventos especiales; concesiones manuales de recursos.
- **Modo emergencia**: matar/revivir jugadores, deshacer un voto, actuar en nombre de un jugador sin móvil (P‑08), recomputar una resolución nocturna. Toda acción de emergencia queda sellada en el acta.

---

## 13. Equilibrio, ritmo y configuraciones

### 13.1 Duración

| Preset | Rondas | Exploración | Debate | Total aprox. |
|---|---|---|---|---|
| Corta (2 h) | 3 | 20 min | 8 min | ~2 h |
| Estándar (3 h) | 4 | 25 min | 10 min | ~3 h |
| Larga (4 h) | 5 | 30 min | 12 min | ~4 h |

### 13.2 Por tamaño de grupo

| Jugadores | Preset recomendado | Pruebas activas/ronda | Notas de ritmo |
|---|---|---|---|
| 6–8 | Corta/Estándar, 3–4 rondas | 4–6 | 2 lobos; sin Manipulador; cooperativas de 2 |
| 9–12 | Estándar | 6–9 | Configuración de referencia; cooperativas de 3 |
| 13–16 | Estándar/Larga | 9–12 | Dividir pruebas por zonas para evitar colas |
| 17–20 | Larga, 5 rondas | 12–16 | 2 asambleas pueden usar "voto por mesas" (debate en subgrupos); Médium ×2 |

Reglas de ritmo: ~1 muerte nocturna + ~1 eliminación por asamblea y ronda ⇒ en 4 rondas mueren ~8 jugadores; con 10–12 vivos la partida acaba de forma natural entre las rondas 3 y 5. El motor avisa al narrador si el ritmo de muertes amenaza con acabar la partida demasiado pronto o tarde.

### 13.3 Simulación de referencia (10 jugadores, preset Estándar)

Composición: 3 lobos (Lobo, Alfa, Saboteador) + Médico, Detective, Médium, Investigador, Guardián, Civil + 1 Traidor.

- **R1:** Exploración: se completan 5/8 pruebas; Expediente 25 % (se confirma: 3 lobos). Noche: manada elimina al Investigador (el Médico protegió al Médium); Detective investiga al Civil (limpio). Sin votación (regla R1). El Investigador entra al Otro Lado y completa su primera prueba espectral.
- **R2:** El Saboteador corrompe la prueba del sótano; el Guardián había blindado la de la cocina (rastro: "alguien intentó forzarla" → dato público). Expediente 45 %. El fantasma materializa una pista (verdadera: era humano). Asamblea: el Traidor empuja contra su objetivo; eliminan al Civil (50 % de acierto percibido, facción revelada: humano). Noche: muere el Guardián.
- **R3:** 3 fantasmas activos: responden 2 preguntas del Médium (sí/no) y lanzan una Perturbación. Expediente 75 % (uso extra del Detective → caza al Saboteador). Asamblea: eliminado el Saboteador (¡lobo!).
- **R4:** Quedan 2 lobos vs 4 humanos. La manada va a por el Detective; el Médico acierta la protección. Expediente 100 % → prueba final: los humanos reúnen las 3 piezas del código y acusan a Alfa + Lobo. Aciertan 2/2 → **victoria humana, final "éxodo al amanecer"**. El Traidor no cumplió; el Investigador es nombrado Fantasma más influyente.

Validaciones que muestra la simulación: ningún jugador pasó una ronda sin acciones; los 3 muertos jugaron una media de 2 acciones espectrales por ronda; los lobos tuvieron decisiones significativas hasta el final. Este guion se convertirá en el **test de integración de referencia** del motor (plan, Fase 6).

---

## 14. Escenarios reutilizables

Un **escenario** es un paquete de contenido (JSON importable/exportable, esquema en `03-arquitectura.md` §8): narrativa (prólogo, epílogos, textos de eventos), roles y cantidades por tamaño, habitaciones y pruebas con sus componentes físicos (checklist), mazos de pistas verdaderas/falsas, eventos especiales, misiones, condiciones de victoria y presets de duración. El motor es agnóstico al tema: *La Casa del Lobo* es el primer escenario; *El Asesino de la Mansión*, *El Culto del Bosque*, etc. son futuros paquetes sin cambios de código.

---

## 15. Dirección de arte y UX

- **Tono:** misterio rural, terror psicológico ligero, estética cinematográfica. Paleta: negros azulados, ámbar de vela, rojo sangre desaturado. Texturas de papel antiguo, madera y piedra; iconografía de lobos, bosque y símbolos.
- **Dos pieles**: la de los vivos (papel/vela) y la del Otro Lado (espectral, fría, invertida). La transición de muerte es un momento de producción cuidado.
- **UX:** una mano, pantallas de una sola intención, botones grandes, texto legible en penumbra; información sensible siempre tras "mantener pulsado para revelar"; la app jamás parece una herramienta de empresa: todos los textos de sistema están escritos en la voz del narrador.
- **Sonido:** opcional y ligero en los móviles (avisos); el ambiente sonoro principal sale del dispositivo del narrador.

Pantallas (14): Inicio · Unirse · Sala de espera · Revelación de rol · Dashboard · Habitaciones · Pruebas · Inventario · Mensajes · Asamblea (debate+voto) · Panel del Otro Lado · Perfil y habilidades · Historial/Acta · Panel del narrador.
