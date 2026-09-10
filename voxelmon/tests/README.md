# F14.5 integrity regression checks

Run from `voxelmon/`, with Node 20 or newer:

```sh
npm ci
npx playwright install chromium
npm test
```

On a machine with Edge installed, `BROWSER_CHANNEL=msedge` uses that browser
instead of downloading Chromium. In PowerShell: `$env:BROWSER_CHANNEL='msedge'`.
`npm run test:core` runs only module checks; `npm run test:perf` samples the real
Gym 5 scene. The runner serves local files on an ephemeral loopback port and
uses isolated browser contexts/storage. No personal save is read.

Set `RESULT_FILE` to a path **outside the repository** to retain JSON results.
For a before/after comparison, `GAME_ROOT` can point to the `voxelmon` directory
of a separate checkout of `2a7c58cabc44b0097eccf7edca7492c2ad038daf`. Tests are
served from this checkout, game files from `GAME_ROOT`. Do not compare a nearby
procedural gym with the campaign gym: the performance fixture uses its explicit
home cell and seed 170753942.

## Coverage and limitations

- All five leaders: missing path, puzzle, each trainer; authorized entry;
  idempotent rewards/badges. Actual E/dialogue and direct main entry are exercised.
- Three fixed seeds: home, regional candidates, reload, actual far chunk unload,
  placed/mined edits and chunk regeneration. Canonical Gym 5 hashes were measured
  on the original post-F14 base and are kept as explicit compatibility fixtures.
- All five puzzle APIs; new, v1, old-v2, post-F14 and current startup fixtures.
- Inventory/Dex/map keys, PC terminal E, actual capture overflow to PC, tooltip,
  crafting/economy, evolution, boss policy, hover restrictions and final gate.
- No Region 6, no art changes, no save-version change.

Teleports prepare proximity; they do not simulate a complete walking campaign.
The capture fixture temporarily fixes RNG to exercise successful capture through
the real Battle/UI, then restores it. It does not estimate capture probability.
An isolated pointer-lock `NotAllowedError` caused by rapid headless panel toggles
is reported in `harnessWarnings`; other page errors fail the runtime checks.
Pointer-lock mouse movement and GPU performance require manual visible-browser
validation. Historical phase scripts from `/tmp/vmtest` are not available here.

Performance values are diagnostic samples, not CI timing thresholds. Cold chunk
generation, structure stamping, update CPU and dirty notifications are separate;
headless frame rate is not a GPU benchmark. The H3 contract is exact: equal voxel
writes preserve explicit edits and create **zero dirty notifications**. H2
intentionally removes noncanonical campaign copies/overlays; arbitrary old-world
hashes in those erroneous areas are not compatibility promises. Existing explicit
edits are retained, including edits made near a removed duplicate structure.
