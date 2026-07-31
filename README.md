# GymRival

App social de gimnasio: crea tu rutina, comparte con amigos, anota series/peso y compite por superar sus marcas.

> **Puerto:** esta app usa **`http://localhost:3456`** por defecto para no chocar con otras apps en el puerto 3000.

## Características

- Registro e inicio de sesión
- Crear rutinas con ejercicios (series y reps objetivo)
- Guía visual por ejercicio: imagen, músculos, claves de ejecución y errores a evitar
- Anotar series: número de serie, repeticiones y peso (kg)
- Sistema de amigos (solicitudes y acceso mutuo a rutinas)
- Ranking de competencia por ejercicio (mejor peso entre tú y tus amigos)

## Stack

- Next.js (App Router) + TypeScript
- Prisma + SQLite
- Tailwind CSS

## Arranque (listo en 2 comandos)

```bash
npm run setup
npm run dev
```

Abre **[http://localhost:3456](http://localhost:3456)** — no usa el puerto 3000.

### Alternativa paso a paso

```bash
npm install
cp .env.example .env
npx prisma db push
npm run db:seed
npm run dev
```

### Usuarios demo

| Usuario | Contraseña |
|---------|------------|
| alex    | demo1234   |
| maria   | demo1234   |
| luis    | demo1234   |

Alex, María y Luis ya son amigos y tienen rutinas con levantamientos de ejemplo.

### Producción local

```bash
npm run build
npm start
```

También queda en **3456**.
