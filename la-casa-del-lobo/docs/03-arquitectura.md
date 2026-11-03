# La Casa del Lobo — Arquitectura técnica

> Documento 03 de 04. Decisiones de producto en `02-gdd.md`; problemas P‑xx en `01-analisis-diseno.md`.

---

## 1. Objetivos y restricciones

- **Desarrollador individual** trabajando con Cursor: minimizar infraestructura propia, maximizar servicios gestionados.
- 6–20 clientes móviles simultáneos + narrador, en Wi‑Fi doméstica potencialmente inestable (P‑08).
- **Confianza cero en el cliente** (P‑13): roles, votos, respuestas y acciones nocturnas jamás salen del servidor hacia quien no debe verlos.
- PWA instalable, sin tiendas de aplicaciones.
- Contenido (escenarios) desacoplado del código.

## 2. Evaluación de stack

| Opción | Pros | Contras | Veredicto |
|---|---|---|---|
| **Next.js + Supabase** (propuesta) | Un solo lenguaje (TS); Postgres real con RLS; Realtime integrado con canales privados; auth anónima integrada; Edge Functions para lógica sensible; hosting gratuito/barato (Vercel + Supabase) | Realtime de Supabase menos flexible que un servidor WS propio; vendor lock‑in moderado (mitigado: es Postgres estándar) | **Elegido** |
| Node + Socket.io + Postgres (VPS propio) | Control total del tiempo real | Toda la seguridad, despliegue, TLS y operación recaen en el desarrollador; sobredimensionado para 20 clientes | Descartado |
| Firebase (Firestore + RTDB) | Realtime excelente, push sencillo | Reglas de seguridad menos expresivas que RLS+SQL para un modelo relacional con votos/roles secretos; consultas relacionales pobres (el esquema del GDD es muy relacional) | Descartado |
| PartyKit / Cloudflare Durable Objects | Modelo de sala perfecto para juegos | Persistencia y panel de administración hay que construirlos; menos documentación; curva extra | Descartado para v1; candidato si Realtime se queda corto |
| SvelteKit en lugar de Next.js | Más ligero | Ecosistema/plantillas PWA+Supabase más maduro en Next; Cursor rinde mejor con el ecosistema React | Descartado |

**Stack final:**

- **Frontend:** Next.js (App Router) + TypeScript + Tailwind CSS + `serwist` (PWA/service worker). Estado de cliente: Zustand + suscripciones Realtime.
- **Backend:** Supabase — Postgres 15 (+RLS), Auth (sign‑in anónimo por dispositivo), Realtime (canales privados con autorización), Edge Functions (Deno/TS) para orquestación, Storage para imágenes de escenario y fotos de validación.
- **Infra:** Vercel (hosting Next, previews por PR) + Supabase cloud (BD gestionada, backups, logs). Variables de entorno en Vercel/Supabase; `SUPABASE_SERVICE_ROLE_KEY` solo en servidor. Logs: Vercel + Supabase + tabla `game_events` como log funcional de partida.

## 3. Visión general

```
 Móvil jugador (PWA Next.js)          Dispositivo narrador (misma PWA, vista admin)
        │  HTTPS (RPC/Edge)  ▲ Realtime (WS, canales segmentados)
        ▼                    │
 ┌─────────────────────────────────────────────┐
 │                 SUPABASE                    │
 │  Auth (anónima)                             │
 │  Postgres + RLS  ← única fuente de verdad   │
 │   ├─ funciones SQL SECURITY DEFINER         │   acciones de juego transaccionales
 │   └─ pg_cron (temporizadores de fase)       │
 │  Edge Functions                             │   motor de fases, resolución nocturna,
 │  Realtime (broadcast privado por canal)     │   import/export de escenarios
 │  Storage (imágenes, fotos de validación)    │
 └─────────────────────────────────────────────┘
```

**Principio:** el cliente **nunca escribe directamente** en tablas de juego. Toda acción (unirse, votar, responder prueba, acción nocturna, intercambio) es una **función SQL `SECURITY DEFINER`** (transaccional y rápida) o una **Edge Function** (orquestación compleja). El cliente solo tiene `SELECT` vía RLS sobre lo que su jugador puede ver.

## 4. Motor de juego

- **Máquina de estados en servidor**: `games.phase` + `game_rounds` modelan la fase actual. Transiciones solo vía función `advance_phase(game_id)` (invocada por el narrador o por `pg_cron` cuando expira `phase_ends_at`). Cada transición es una transacción que: cierra la fase anterior (p. ej. sella votos), ejecuta efectos (resolución nocturna), programa la siguiente y emite notificaciones.
- **Resolución nocturna determinista** (GDD §6.4): función pura `resolve_night(actions, estado) → efectos`, implementada en SQL/Edge con batería de tests unitarios; el orden de prioridad vive en datos del escenario, no hardcodeado.
- **Idempotencia:** `advance_phase` toma un lock (`SELECT … FOR UPDATE` sobre la partida) y verifica la fase esperada; reintentos del narrador o del cron no duplican efectos.
- **Condiciones de victoria** evaluadas al cierre de cada ronda por el motor contra la configuración de la partida.

## 5. Modelo de seguridad (P‑13)

1. **Roles secretos:** `player_roles` solo legible por el propio jugador (RLS); el reparto lo hace una función de servidor con `ORDER BY random()` auditada en `game_events` (payload cifrado para el acta).
2. **Votos privados:** `INSERT/UPDATE` solo vía `cast_vote()` que valida: jugador vivo, fase = votación, ronda actual, un voto por ronda (`UNIQUE (round_id, voter_id)` — previene duplicados a nivel de BD). Lectura RLS: solo el propio voto hasta que la ronda sella resultados; los agregados se publican vía función.
3. **Acciones nocturnas:** mismas garantías; `UNIQUE (round_id, player_id, action_type)`.
4. **Respuestas de pruebas:** almacenadas como `sha256(salt || normalizar(respuesta))`; el texto plano nunca existe en BD ni viaja al cliente. Normalización: minúsculas, sin tildes, trim. Rate‑limit de intentos en `check_puzzle_answer()` (tabla `puzzle_attempts` + ventana temporal).
5. **Visibilidad de pruebas:** el `SELECT` de `puzzles` pasa por una **vista segura** que filtra por estado del jugador (vivo/fantasma/facción/rol) y oculta `answer_hash`, recompensas no reveladas y exclusividades ajenas (P‑06: un humano ni siquiera sabe que existe una prueba `solo_lobos`).
6. **Realtime segmentado:** canales privados con autorización en servidor — `game:{id}:public`, `game:{id}:player:{pid}`, `game:{id}:wolves`, `game:{id}:ghosts`, `game:{id}:admin`. La pertenencia se valida contra `game_players`/`player_roles` al suscribirse. Jamás se difunde un payload sensible por el canal público.
7. **Acceso por partida:** auth anónima por dispositivo + `game_players (game_id, user_id)`; todas las políticas RLS comprueban pertenencia a la partida. Códigos de sala de 6 caracteres sin ambigüedad (sin 0/O, 1/I) con caducidad.
8. **Admin:** `game_players.is_admin`; las funciones de narrador validan ese flag; las acciones de emergencia se registran siempre en `game_events` (GDD §12).

## 6. Resiliencia (P‑08)

- Estado 100 % en servidor; al (re)conectar, el cliente llama a `get_my_game_state()` (una función que devuelve todo lo visible para ese jugador) y re‑suscribe canales. Sin estado crítico en el cliente.
- Temporizadores con `phase_ends_at` en BD: un cliente que vuelve calcula el tiempo restante contra el reloj del servidor.
- Heartbeat de presencia (Realtime Presence) para que el narrador vea qué jugadores están conectados y actúe en nombre de los caídos.

## 7. PWA y notificaciones (P‑09)

**Limitaciones investigadas:**

- **iOS (Safari):** Web Push disponible desde iOS 16.4 **solo si la PWA está instalada en pantalla de inicio** y el usuario concede permiso. Safari en pestaña normal: sin push. Las PWA instaladas en iOS pueden suspender el service worker agresivamente.
- **Android (Chrome/Edge/Firefox):** Web Push funciona en navegador y PWA instalada, con permiso. Modos de ahorro de batería pueden retrasar entregas.
- **Conclusión de diseño:** el juego **no depende de push**. Con la app abierta (caso normal durante la partida), todo llega por WebSocket al instante, con sonido/vibración (`navigator.vibrate`, no disponible en iOS: se compensa con sonido). Los momentos síncronos se refuerzan con audio desde el dispositivo del narrador. Push (VAPID + Edge Function de envío) se implementa en Fase 5 como mejora para avisos entre fases largas, con onboarding que invita a instalar la PWA sin exigirlo.

**PWA:** manifest con iconos/tema, service worker (`serwist`) con precache del shell y estrategia network‑first para datos; pantalla completa standalone; wake lock opcional (`navigator.wakeLock`) durante fases activas para que la pantalla no se apague.

## 8. Escenarios: formato de intercambio

Paquete JSON versionado, importable/exportable desde el panel (validación con Zod en Edge Function):

```jsonc
{
  "schema_version": 1,
  "meta": { "id": "la-casa-del-lobo", "nombre": "La Casa del Lobo", "version": "1.0.0", "idioma": "es" },
  "narrativa": { "prologo": "…", "epilogos": { "humanos_exterminio": "…", "humanos_escape": "…", "lobos": "…", "nadie": "…" } },
  "facciones": [ { "id": "humanos", … }, { "id": "lobos", … }, { "id": "neutral", … } ],
  "roles": [ { "id": "medico", "faccion": "humanos", "habilidades": [ { "fase": "noche", "tipo": "proteger", "usos_por_ronda": 1, "restricciones": ["no_repetir_objetivo"] } ], … } ],
  "repartos": { "6-8": { "lobo": 2, "medico": 1, … }, "9-12": { … } },
  "habitaciones": [ { "id": "sotano", "nombre": "Sótano", "desbloqueo": { "ronda": 2 } } ],
  "pruebas": [ { "id": "candado-bodega", "tipo": "candado", "habitacion": "sotano", "respuesta_plana": "4718", "pistas": [...], "recompensas": [...], "exclusividad": "todos", "componentes_fisicos": ["candado 4 dígitos", "tarjeta #12 dentro de la caja"] } ],
  "mazos_pistas": { "verdaderas": [...], "falsas": [...] },
  "eventos": [ { "id": "apagon", "disparador": { "tipo": "manual" }, "efectos": [...] } ],
  "misiones": { "rotatorias": [...], "fantasmas": [...] },
  "victoria": { "humanos": [...], "lobos": [...], "presets_duracion": { … } }
}
```

`respuesta_plana` solo existe en el JSON de autoría; al importar se transforma en hash y el archivo original no se guarda en BD. La exportación emite una versión sin respuestas o con ellas según elija el narrador (para backup propio). Del mismo paquete se genera el **checklist de montaje** imprimible.

## 9. Esquema de base de datos

Convenciones: PK `id uuid default gen_random_uuid()`, timestamps `created_at timestamptz default now()`, enums como tipos Postgres, **RLS activado en todas las tablas** (deny‑by‑default; escrituras solo vía funciones `SECURITY DEFINER`).

```sql
-- ── Identidad y partidas ─────────────────────────────────────────
create table users (            -- espejo ligero de auth.users (anónimos)
  id uuid primary key references auth.users(id),
  display_name text,
  created_at timestamptz default now()
);

create type game_status as enum ('lobby','en_curso','pausada','finalizada');
create type game_phase  as enum ('lobby','reparto','prologo','exploracion','investigacion',
                                 'noche','resolucion','debate','votacion','cierre_ronda','epilogo');

create table scenarios (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  nombre text not null,
  version text not null,
  data jsonb not null,              -- paquete del §8 (sin respuestas planas)
  created_by uuid references users(id),
  created_at timestamptz default now()
);

create table games (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,        -- código de sala (6 chars, sin ambiguos)
  scenario_id uuid references scenarios(id),
  status game_status not null default 'lobby',
  phase  game_phase  not null default 'lobby',
  current_round int not null default 0,
  phase_ends_at timestamptz,        -- temporizador de servidor
  created_by uuid not null references users(id),
  created_at timestamptz default now(),
  finished_at timestamptz
);
create index on games (code) where status <> 'finalizada';

create table game_settings (        -- clave/valor tipado por partida
  game_id uuid references games(id) on delete cascade,
  key text not null,                -- 'duracion_preset','empate','revelar_rol',...
  value jsonb not null,
  primary key (game_id, key)
);

create type player_state as enum ('vivo','fantasma','retirado');
create table game_players (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  user_id uuid not null references users(id),
  display_name text not null,
  state player_state not null default 'vivo',
  is_admin boolean not null default false,
  connected_at timestamptz,         -- presencia (actualizada por heartbeat)
  died_in_round int,
  ghost_score int not null default 0,
  unique (game_id, user_id)
);
create index on game_players (game_id, state);

-- ── Roles y facciones ────────────────────────────────────────────
create table factions (
  id uuid primary key default gen_random_uuid(),
  scenario_id uuid not null references scenarios(id) on delete cascade,
  slug text not null, nombre text not null, data jsonb not null,
  unique (scenario_id, slug)
);

create table roles (
  id uuid primary key default gen_random_uuid(),
  scenario_id uuid not null references scenarios(id) on delete cascade,
  faction_id uuid not null references factions(id),
  slug text not null, nombre text not null,
  data jsonb not null,              -- habilidades, limitaciones, info_visible…
  unique (scenario_id, slug)
);

create table player_roles (         -- ¡tabla más sensible del sistema!
  game_id uuid not null references games(id) on delete cascade,
  player_id uuid not null references game_players(id) on delete cascade,
  role_id uuid not null references roles(id),
  secret_data jsonb not null default '{}',  -- objetivo del Traidor, etc.
  primary key (game_id, player_id)
);

-- ── Casa y pruebas ───────────────────────────────────────────────
create table rooms (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  nombre text not null, descripcion text,
  unlocked boolean not null default true,
  unlock_conditions jsonb not null default '[]',
  sort_order int not null default 0
);

create type puzzle_state as enum ('bloqueada','disponible','iniciada',
                                  'pendiente_validacion','completada','saboteada');
create type puzzle_validation as enum ('codigo','narrador','marcar');
create table puzzles (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  room_id uuid not null references rooms(id) on delete cascade,
  nombre text not null, descripcion text not null,
  tipo text not null,               -- acertijo|codigo|candado|busqueda|cifrado|…
  dificultad int not null default 2 check (dificultad between 1 and 5),
  validation puzzle_validation not null default 'codigo',
  answer_hash text,                 -- sha256(salt||normalizado); null si validación narrador/marcar
  answer_salt text,
  pistas jsonb not null default '[]',
  recompensas jsonb not null default '[]',
  unlock_conditions jsonb not null default '[]',
  exclusividad text not null default 'todos',   -- todos|solo_lobos|solo_fantasmas|rol:<slug>
  min_cooperadores int not null default 1,
  estado puzzle_state not null default 'bloqueada',
  completed_at timestamptz
);
create index on puzzles (game_id, room_id, estado);

create table puzzle_attempts (
  id uuid primary key default gen_random_uuid(),
  puzzle_id uuid not null references puzzles(id) on delete cascade,
  player_id uuid not null references game_players(id),
  answer_normalized_hash text,      -- para auditoría sin guardar texto plano
  success boolean not null,
  created_at timestamptz default now()
);
create index on puzzle_attempts (puzzle_id, player_id, created_at desc); -- rate-limit

create table discoveries (          -- pistas/fragmentos encontrados
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  player_id uuid references game_players(id),   -- null = global/narrador
  source text not null,             -- puzzle:<id> | fantasma:<id> | narrador | evento:<id>
  tipo text not null,               -- pista_verdadera|pista_falsa|fragmento_expediente|historia
  contenido jsonb not null,
  shared_public boolean not null default false, -- compartida al tablón (GDD §6.2)
  created_at timestamptz default now()
);

create table inventory (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  player_id uuid not null references game_players(id),
  item_slug text not null, item_data jsonb not null default '{}',
  qty int not null default 1 check (qty >= 0),
  unique (game_id, player_id, item_slug)
);

-- ── Rondas, votos y noche ────────────────────────────────────────
create table game_rounds (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  number int not null,
  started_at timestamptz default now(),
  ended_at timestamptz,
  resolution jsonb,                 -- resultado sellado de la ronda
  unique (game_id, number)
);

create table votes (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references game_rounds(id) on delete cascade,
  voter_id uuid not null references game_players(id),
  target_id uuid references game_players(id),   -- null = abstención
  weight int not null default 1,                -- Manipulador
  updated_at timestamptz default now(),
  unique (round_id, voter_id)       -- previene voto duplicado a nivel BD
);

create table night_actions (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references game_rounds(id) on delete cascade,
  player_id uuid not null references game_players(id),
  action_type text not null,        -- matar|proteger|investigar|sabotear|señuelo|…
  target jsonb not null default '{}',
  resolved jsonb,                   -- resultado privado tras la resolución
  created_at timestamptz default now(),
  unique (round_id, player_id, action_type)
);

-- ── Eventos, notificaciones, fantasmas ───────────────────────────
create table game_events (          -- log funcional + acta de partida
  id bigint generated always as identity primary key,
  game_id uuid not null references games(id) on delete cascade,
  round int, phase game_phase,
  actor text not null,              -- player:<id> | narrador | sistema
  tipo text not null,               -- fase_cambiada|prueba_completada|voto_sellado|emergencia|…
  audiencia text not null default 'privada', -- publica|privada|admin
  payload jsonb not null,
  created_at timestamptz default now()
);
create index on game_events (game_id, created_at);

create type notif_priority as enum ('info','alta','critica');
create table notifications (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  recipient_player_id uuid references game_players(id), -- null = ver audience
  audience text,                    -- global|lobos|fantasmas (si recipient null)
  tipo text not null, mensaje text not null,
  priority notif_priority not null default 'info',
  read_at timestamptz,
  created_at timestamptz default now()
);
create index on notifications (game_id, recipient_player_id, created_at desc);

create table ghost_missions (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  player_id uuid not null references game_players(id),
  mission_slug text not null,
  data jsonb not null default '{}',
  status text not null default 'activa',   -- activa|completada|fallida
  reward_ectoplasma int not null default 0,
  completed_at timestamptz
);
```

### 9.1 Políticas RLS (patrón)

Deny‑by‑default; solo `SELECT` para clientes, con pertenencia a partida como condición base:

```sql
alter table player_roles enable row level security;
-- Un jugador solo lee SU rol:
create policy pr_select_own on player_roles for select using (
  player_id in (select id from game_players where user_id = auth.uid())
);
-- Sin policies de insert/update/delete: solo funciones SECURITY DEFINER escriben.

alter table votes enable row level security;
create policy votes_select_own on votes for select using (
  voter_id in (select id from game_players where user_id = auth.uid())
);

alter table puzzles enable row level security;
-- Los clientes NO leen puzzles directamente: leen la vista segura
-- visible_puzzles (security_invoker=false) que filtra exclusividad/estado
-- y proyecta solo columnas públicas (nunca answer_hash/salt).
```

Mismo patrón para el resto: `notifications` (propias o de audiencia a la que perteneces), `discoveries` (propias o `shared_public`), `night_actions` (solo las propias, y `resolved` solo tras la resolución), `game_events` (solo `audiencia='publica'`, admin ve todo), `inventory` (propio). El narrador (`is_admin`) tiene policies ampliadas de lectura; sus escrituras también pasan por funciones.

### 9.2 Funciones de servidor (API del juego)

`create_game(scenario, settings)` · `join_game(code, name)` · `start_game()` (reparte roles) · `advance_phase()` · `check_puzzle_answer(puzzle, answer)` · `cast_vote(target)` · `submit_night_action(type, target)` · `use_ability(ability, target)` · `trade_items(...)` · `ghost_action(type, params)` · `medium_question(...)` / `ghost_answer(...)` · `admin_emergency(action, params)` · `get_my_game_state()` · `import_scenario(json)` / `export_scenario(id)` · `export_game_log(game)` (acta).

## 10. Estructura del repositorio (previsión Fase 2)

```
la-casa-del-lobo/
  docs/                  ← estos documentos
  app/                   ← Next.js (App Router)
    src/app/(player)/…   ← pantallas de jugador
    src/app/(ghost)/…    ← el Otro Lado
    src/app/admin/…      ← panel del narrador
    src/lib/…            ← cliente Supabase, tipos generados, stores
  supabase/
    migrations/…         ← SQL del §9 como migraciones versionadas
    functions/…          ← Edge Functions (motor, import/export, push)
    seed/escenario-base/ ← La Casa del Lobo (JSON de autoría)
  tests/                 ← unitarios (resolución nocturna, votos) + e2e (Playwright)
```

## 11. Estrategia de pruebas

- **Unitarias** (Vitest): resolución nocturna (tabla de casos: protecciones, Alfa, empates, incompatibilidades), recuento de votos y desempates, condiciones de victoria, normalización/hash de respuestas, validador de escenarios.
- **Integración** (BD local `supabase start`): funciones de servidor con RLS activo — verificar que un cliente anónimo **no puede** leer roles ajenos, votar dos veces, votar muerto, ni ver `answer_hash` (tests de seguridad en negativo, P‑13).
- **E2E** (Playwright, multi‑contexto): la simulación de referencia del GDD §13.3 completa con 10 navegadores simulados — es el test de regresión principal del motor.
- **Manual**: checklist iOS Safari + Android Chrome (instalación PWA, reconexión, suspensión de pantalla) antes de cada fase cerrada.
