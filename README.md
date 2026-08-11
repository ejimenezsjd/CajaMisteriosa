# Caja Misteriosa

Roguelike de criaturas con tipos y evoluciones. Explora criptas procedurales, abre cajas misteriosas, combate con ventajas elementales y evoluciona tu equipo.

## Jugar

Abre `index.html` en un navegador moderno (o sirve la carpeta con cualquier servidor estático):

```bash
python3 -m http.server 8080
```

Luego visita `http://localhost:8080`.

### Desde el iPhone (misma Wi‑Fi)

1. En el ordenador, dentro de la carpeta del juego:
   ```bash
   python3 -m http.server 8080 --bind 0.0.0.0
   ```
2. Averigua la IP local del PC (ej. en Mac: Ajustes → Red; o `ipconfig getifaddr en0`).
3. En Safari del iPhone abre: `http://IP:8080` (ejemplo: `http://192.168.1.20:8080`).
4. Usa el **pad táctil** (▲◀▶▼) para moverte por la mazmorra.

### Publicarlo en internet (GitHub Pages)

En el repo de GitHub: **Settings → Pages → Branch: `main` (o esta rama) / root → Save**.  
Cuando esté activo, la URL será algo como  
`https://ejimenezsjd.github.io/CajaMisteriosa/`  
y podrás abrirla desde cualquier iPhone con datos o Wi‑Fi.

## Cómo se juega

- **Movimiento:** flechas o WASD
- **Líder:** teclas 1–4
- **Cajas doradas:** reclutan criaturas (máx. 4 en el equipo)
- **Enemigos rojos / encuentros:** combate por turnos
- **Escaleras:** bajan al siguiente piso (victoria al superar el piso 12)
- **Evolución:** al subir de nivel (nv. 5 y nv. 10)

## Tipos

Fuego · Agua · Planta · Eléctrico · Tierra · Volador · Sombra · Luz

Cada tipo tiene fortalezas y debilidades. Elige ataques con ventaja para ganar más fácil.

## Líneas evolutivas

Ocho familias de tres etapas, por ejemplo:

| Etapa 1 | Etapa 2 | Etapa 3 | Tipo |
|---------|---------|---------|------|
| Emberín | Brasor | Infernak | Fuego |
| Gotita | Ríazor | Tsunark | Agua |
| Semilla | Arbusto | Silvax | Planta |
| Chispín | Voltajo | Truena | Eléctrico |
| Piedrita | Rocal | Titanor | Tierra |
| Plumín | Alazán | Celestor | Volador |
| Umbra | Sombrío | Nocrix | Sombra |
| Luciér | Clarion | Aureon | Luz |

## Estructura

```
index.html
css/game.css
js/
  main.js
  data/types.js
  data/creatures.js
  engine/dungeon.js
  engine/battle.js
  engine/game.js
  ui/render.js
```
