# Phase checkpoints

## Phase 1 — 2026-11-15

- Five reference files copied unchanged; SHA-256 equality verified against uploads.
- Reference report completed before source edits.
- All renderer/light/mesh casting and receiving disabled. Beacon poles, gem toppers and labels removed; site platforms preserved.
- `npm run lint`: 0 warnings/errors. `npm run build`: passed (lazy graphics chunk advisory only).
- Shadow regression tests: 3 passed.

## Phase 2 — 2026-11-15

- Landscape extent: 11,760 units; 196 coarse background chunks plus bounded fine/mid terrain around the aircraft.
- Worker-based generation and transferable typed buffers. No external environment assets.
- Added stable tree locations/dimensions, stepped pools/waterfalls, expanded ridges, coasts and floating plateaus.
- Tests: 5 terrain invariants plus shadow checks passed.
- Browser: expanded terrain captured visibly, 196/196 base chunks and 25/25 detail chunks loaded at high quality; 129 draw calls and ~940k triangles observed at the starting view. These are a single-view measurement, not a device-wide performance guarantee.
- Runtime shadow map disabled, 0 casters and 0 receivers verified.

## Phase 3 — 2026-11-15

- Refined photo-informed smooth B-2 shell, thin edges, faceted glazing and recessed openings. Procedural approximation, not an uploaded aircraft asset.
- Fixed milliseconds-to-seconds frame clock and corrected stalled-RAF fallback schedule.
- Bounded simulation substeps; 30/60/120 Hz comparisons passed. Exact pause/reset, control direction and safe teleport tests passed.
- Clean compiler/lint run after fixing two geometry-expression syntax errors. All 14 regression tests passed.
- Browser screenshot confirmed improved aircraft silhouette. Hot-reload resource replacement exposed stale instance transforms; effect dependencies corrected and clean reload scheduled for final verification.

## Supplied-asset integration — 2026-11-15

### Conversion verification

- Official Blender 5.3 installed using WinGet; installer hash verified by WinGet. Scripts executed with factory startup and automatic source-script execution disabled.
- ZIP safety checks and CRC passes; originals unchanged. Duplicate laptop texture filenames retained separately, never overwritten.
- B-2 GLB: 1 mesh / 8,154 triangles / 56×3.83×23.05 runtime units / diffuse, normal and metallic channels. Initial axis errors were caught before mounting and corrected. Missing roughness remains explicitly scalar 0.46.
- Predator GLB: original evaluated 45,573 triangles, actual keyboard and hinges, packed maps verified. It is labelled Predator, not an Aurora CAD model.
- Rubik GLB: 26 original visible components, 2,204 triangles, 7 source colors. 10 zero-face orphan vertices omitted. Source cap origins preserved by the real controller rather than coerced to uniform spacing.
- Wrap GLB: actual 3 groups / 4,352 triangles. Source MTL missing; semantic material mappings reconstructed and reported; no AO.
- Minecraft crop GLB: actual selected block geometry / 219,288 triangles, 49 textured groups. Not a full save import; missing fringe and decorative-shape/UV limitations retained in the conversion report.
- Multiangle validation images rendered and opened before integration. Images are review artifacts; source textures unchanged.

### Application checks

- `npm run lint`: 0 warnings / 0 errors at final integration checkpoint.
- `npm run build`: passed; optional lazy graphics chunk warning remains, not an error.
- Regression suite: 37 checks passed (asset files/privacy, actual cube rig, contact, frame-rate/flight, loader, terrain, giant-landmark proximity and shadow policy).
- Live browser model status: aircraft, laptop, cube, wrap and archive all reported `ready`. GLTF geometry and material inventories match converted outputs.
- Runtime traversal: shadowMap disabled, 0 casters and 0 receivers after all supplied models loaded.
- Clean production preview at `http://127.0.0.1:4173/` loaded the built HUD/world and profile panel; About/My setup showed the supplied Aurora specifications while clearly labelling the Predator visual asset. Runtime error/unhandled-rejection monitor recorded no errors during these checks. Production screenshot captured.
- Browser UI: navigation opens, destination panels read imported-ready state, cube scramble reaches 12 recorded turns and solve returns to 0. Contact empty submit displays all four errors, focuses first field and does not show delivery success.
- Native `press('Enter')` worked for navigation/reset, but later browser driver calls timed out/reset the test page. Subsequent successful UI tests used explicit synthetic DOM clicks; they are not claimed comprehensive native mouse/touch acceptance.
- Actual world/cube/aircraft browser screenshots were captured. Screen/model appearance is source-limited and not represented as AAA fidelity.
- Renderer snapshots at high quality after asset load: 147 draw calls / ~886k triangles in one visited view; final sample reached 341 calls / ~1.98M triangles. These are view-dependent measurements, not a device-wide performance guarantee. All five models remained ready, with shadow maps off and zero casters/receivers. Native low-quality switching timed out before a valid measured result; universal mobile smoothness is not claimed.
- All 196 base terrain chunks loaded, detail cache bounded to configured limit. Repeated travel/quality soak testing and native touch input still need broader human/device testing.

### Remaining configuration and limitations

- Contact service, email/social handles, and project/demo URLs are intentionally unconfigured. No fake URLs, claims or message success.
- Laboratory/contact 3D models are still absent; corresponding content and integration slots remain usable.
- No date of birth is stored in source/public configuration. No deployment or assertion of third-party asset redistribution permission.
- Collider envelopes around the giant assets are conservative bounds, not exact mesh collisions. Final review caught a ground-referenced proximity gate that made the cube's F interaction unreachable; proximity now uses configured model interaction height and radius, with a regression test above the clearance envelope.
- Total source-derived GLB payload is approximately 46.17 MiB. Original texture resolutions are retained; payload compression and longer mobile/device soak tests remain future optimisation work.
- Source B-2 has 1K maps, missing roughness, and limited authored detail. Rendering cannot manufacture unseen source geometry. Minecraft partial-block UV/alpha/decor fidelity is documented separately.

## Aircraft simulation upgrade

- Existing supplied GLB retained byte-for-byte; SHA-256 `e3bb91bfe6bbdc8c1602825bf775d269a8c7b3b8367fdc803998e83ea456ffbf`.
- Model wrapper π yaw correction, uniform scale 4, measured visible span 224 world units; no environment rotation or additional aircraft.
- Central reference-only aircraft profiles, explicit meter conversion, faster persistent throttle and energy-limited boost. All frame/input/boost/pool tests and existing portfolio regressions passed: **57 tests**. Final lint/build passed with zero lint warnings/errors and an advisory graphics chunk-size warning only.
- Live bounded synthetic W+Shift check: speed160→572.49 world units/s, throttle17%→89.84%, energy100%→75.67%, boosting true. Keys released by the test.
- Live bounded F check: 7 synchronized pairs/14 projectiles, ammo120→106. Release produced firing=false and no extra pair. Reload returned ammo120 and active effects0.
- Explicit Audio ON keyboard gesture produced a running ON state; OFF subsequently confirmed. Audio output was not independently heard; it is procedural synth, not an authentic B-2 recording.
- Follow/cinematic/overview live camera distances exceeded computed fit minima. Portrait390×844 document dimensions had no overflow; portrait screenshot timed out, so no portrait visual pass is claimed. Native mouse/touch and extended GPU/audio soak checks remain broader device-testing tasks.
- See [Simulator upgrade report](simulator-upgrade.md) for exact mode-dependent controls, pooling, audio lifecycle and scale policy. Production starts with fictional effects and audio OFF, preserving peaceful portfolio exploration and direct navigation.

