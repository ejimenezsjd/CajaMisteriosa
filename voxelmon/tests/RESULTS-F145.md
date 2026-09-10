# F14.5 validation — 2026-09-10

Base: `2a7c58cabc44b0097eccf7edca7492c2ad038daf` (PR #23 integrated into
`cursor/voxelmon-fase13-archipielago-7092`). `origin/main` remains `518b11e`.

Edge headless / Playwright 1.62.1: **188 PASS, 0 FAIL**, plus syntax checks on all
45 game JavaScript modules. One explicitly classified headless warning:
rapid panel toggles can reject pointer-lock requests. No other page errors.

The initial core reproduction had 31 failures: 25 missing leader guards,
three seeds with secondary regional copies, three redundant-dirty checks.
Final tests add real dialog/E paths, all puzzle APIs, save boots, capture to PC,
tooltips, management UI, progression hooks and Build Assist guards.

## Before / after, same canonical Gym 5 position

Seed 170753942; position (437.5, 16, 992.5). Five seconds settling, then two
seconds stationary. Sequential runs; timings are indicative, not thresholds.

| Measurement | Base | F14.5 |
|---|---:|---:|
| setBlock calls / equal-value calls | 550 / 542 | 550 / 542 |
| markDirty calls | 930 | 16 |
| update calls | 121 | 120 |
| update CPU total | 67.7 ms | 37.3 ms |
| generated chunks / generation CPU | 2 / 11.4 ms | 2 / 8.8 ms |
| stamping calls / CPU | 2 / 4.2 ms | 2 / 2.8 ms |

Pure 1,000-equal-write fixtures produce zero dirty calls on all three seeds.
The sample retains eight actual changing writes; the fix does not suppress them.
DOM timing was not benchmarked. GPU performance is unavailable in this setup.

Canonical Gym 5 chunk hashes match the base for seeds 170753942, 12345 and
987654321. All 27 regional structure coordinates per seed remain identical.
Home, placed/mined edits and edited chunk hashes survive save/reload and real
far-chunk unloading. SAVE_VERSION stays 2.

H2 intentionally removes secondary regional copies and their biome overlays.
Explicit old edits and map history are preserved; an old save can retain a
marker or edited blocks from a removed duplicate. No cleanup/destructive
migration was added. Original procedural Gym 1 structures remain procedural.

Remaining debt: repeated polling calls (now cheap for identical writes), large
main integration, label disposal, first-request Dex silhouette, duplicate Gale
statistics handler, unbounded save/map growth and visible-browser traversal QA.
Historical temporary phase suites were unavailable; these are new tracked tests.

**NO REGION 6. No automatic merge. Next work: W0 — World Scale Audit.**
