# Creature art pipeline (Fase 10.5)

## Convención de spritesheet

Un archivo por especie:

```
voxelmon/assets/creatures/<speciesId>.png
```

Rejilla fija:

| | col 0 | col 1 | col 2 | col 3 |
|---|---|---|---|---|
| row 0 | idle | idle | idle | idle |
| row 1 | walk | walk | walk | walk |
| row 2 | hurt | hurt | hurt | hurt |
| row 3 | attack | attack | attack | attack |

- Tamaño de frame: el de `CREATURE_ART[id].frameSize` (32×32 o 48×48).
- Filtro: nearest / sin mipmaps.
- Transparencia: alpha 0 = vacío.

Sustituir el PNG **no requiere cambiar JS** si se mantiene la rejilla y el `frameSize`.

Los PNG del primer lote se generan con:

```
node voxelmon/scripts/export-creature-pngs.mjs
```

Son **DEV / PLACEHOLDER**: siluetas originales pintadas en canvas, no arte final.
Sustituye el archivo en esta carpeta para publicar arte definitivo.

## Fallback

1. Si hay metadata `renderer: "pixel"` y textura lista → billboard pixel.
2. Si el PNG 404 → hoja pintada en canvas (`creature-pixels.js`).
3. Si no hay arte o `debug.setCreatureRenderer("voxel")` → modelo voxel legado.

## Debug

```
__vm.debug.creatureArt()
__vm.debug.setCreatureRenderer("pixel"|"voxel"|"auto")
__vm.debug.spawnSpecies("emberin")
```
