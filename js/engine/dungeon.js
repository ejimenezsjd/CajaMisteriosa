/** Generación procedural de mazmorras en cuadrícula */

export const TILE = {
  WALL: 0,
  FLOOR: 1,
  BOX: 2,
  STAIRS: 3,
  ENEMY: 4,
};

const DIRS = [
  [0, -1],
  [0, 1],
  [-1, 0],
  [1, 0],
];

function randInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Genera un mapa con habitaciones conectadas por pasillos.
 * @returns {{ width, height, tiles, player, enemies, boxes, stairs }}
 */
export function generateDungeon(floor = 1, width = 36, height = 26) {
  const tiles = Array.from({ length: height }, () => Array(width).fill(TILE.WALL));
  const rooms = [];
  const roomCount = randInt(5, 8);

  for (let attempt = 0; attempt < 80 && rooms.length < roomCount; attempt++) {
    const w = randInt(4, 8);
    const h = randInt(4, 7);
    const x = randInt(1, width - w - 2);
    const y = randInt(1, height - h - 2);
    const room = { x, y, w, h, cx: x + Math.floor(w / 2), cy: y + Math.floor(h / 2) };
    if (rooms.some((r) => roomsOverlap(r, room, 1))) continue;
    carveRoom(tiles, room);
    rooms.push(room);
  }

  // Conectar habitaciones
  for (let i = 1; i < rooms.length; i++) {
    carveCorridor(tiles, rooms[i - 1].cx, rooms[i - 1].cy, rooms[i].cx, rooms[i].cy);
  }

  const floors = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (tiles[y][x] === TILE.FLOOR) floors.push({ x, y });
    }
  }
  shuffle(floors);

  const playerRoom = rooms[0];
  const player = { x: playerRoom.cx, y: playerRoom.cy };

  // Quitar casilla del jugador de candidatos
  const free = floors.filter((c) => !(c.x === player.x && c.y === player.y));

  const stairsRoom = rooms[rooms.length - 1];
  const stairs = { x: stairsRoom.cx, y: stairsRoom.cy };
  // Asegurar que stairs esté en suelo
  tiles[stairs.y][stairs.x] = TILE.STAIRS;

  const boxCount = Math.min(3 + Math.floor(floor / 2), 6);
  const enemyCount = Math.min(4 + floor, 12);
  const boxes = [];
  const enemies = [];

  let idx = 0;
  for (let i = 0; i < boxCount && idx < free.length; i++, idx++) {
    const c = free[idx];
    if (c.x === stairs.x && c.y === stairs.y) {
      i--;
      continue;
    }
    boxes.push({ x: c.x, y: c.y, taken: false });
  }

  for (let i = 0; i < enemyCount && idx < free.length; i++, idx++) {
    const c = free[idx];
    if (c.x === stairs.x && c.y === stairs.y) {
      i--;
      continue;
    }
    if (boxes.some((b) => b.x === c.x && b.y === c.y)) {
      i--;
      continue;
    }
    // No spawnear encima del jugador
    if (Math.abs(c.x - player.x) + Math.abs(c.y - player.y) < 3) {
      i--;
      continue;
    }
    enemies.push({ x: c.x, y: c.y, alive: true });
  }

  return { width, height, tiles, player, enemies, boxes, stairs, rooms };
}

function roomsOverlap(a, b, pad = 0) {
  return !(
    a.x + a.w + pad <= b.x ||
    b.x + b.w + pad <= a.x ||
    a.y + a.h + pad <= b.y ||
    b.y + b.h + pad <= a.y
  );
}

function carveRoom(tiles, room) {
  for (let y = room.y; y < room.y + room.h; y++) {
    for (let x = room.x; x < room.x + room.w; x++) {
      tiles[y][x] = TILE.FLOOR;
    }
  }
}

function carveCorridor(tiles, x1, y1, x2, y2) {
  let x = x1;
  let y = y1;
  while (x !== x2) {
    tiles[y][x] = TILE.FLOOR;
    x += x < x2 ? 1 : -1;
  }
  while (y !== y2) {
    tiles[y][x] = TILE.FLOOR;
    y += y < y2 ? 1 : -1;
  }
  tiles[y2][x2] = TILE.FLOOR;
}

export function canWalk(dungeon, x, y) {
  if (y < 0 || x < 0 || y >= dungeon.height || x >= dungeon.width) return false;
  return dungeon.tiles[y][x] !== TILE.WALL;
}

export function enemyAt(dungeon, x, y) {
  return dungeon.enemies.find((e) => e.alive && e.x === x && e.y === y);
}

export function boxAt(dungeon, x, y) {
  return dungeon.boxes.find((b) => !b.taken && b.x === x && b.y === y);
}

export function isStairs(dungeon, x, y) {
  return dungeon.stairs.x === x && dungeon.stairs.y === y;
}

/** Enemigos dan un paso aleatorio (o hacia el jugador a veces) */
export function tickEnemies(dungeon) {
  for (const e of dungeon.enemies) {
    if (!e.alive) continue;
    if (Math.random() < 0.35) continue;

    let dx = 0;
    let dy = 0;
    const dist =
      Math.abs(e.x - dungeon.player.x) + Math.abs(e.y - dungeon.player.y);
    if (dist <= 6 && Math.random() < 0.55) {
      dx = Math.sign(dungeon.player.x - e.x);
      dy = Math.sign(dungeon.player.y - e.y);
      if (Math.random() < 0.5) {
        if (dx !== 0 && dy !== 0) {
          if (Math.random() < 0.5) dy = 0;
          else dx = 0;
        }
      } else if (dx !== 0 && dy !== 0) {
        if (Math.random() < 0.5) dx = 0;
        else dy = 0;
      }
    } else {
      const [rdx, rdy] = DIRS[Math.floor(Math.random() * DIRS.length)];
      dx = rdx;
      dy = rdy;
    }

    const nx = e.x + dx;
    const ny = e.y + dy;
    if (!canWalk(dungeon, nx, ny)) continue;
    if (nx === dungeon.player.x && ny === dungeon.player.y) continue;
    if (enemyAt(dungeon, nx, ny)) continue;
    if (isStairs(dungeon, nx, ny)) continue;
    e.x = nx;
    e.y = ny;
  }
}
