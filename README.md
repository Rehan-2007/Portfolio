<<<<<<< HEAD
# ANTI-AI — Human Intelligence

Existing React/TypeScript/Vite portfolio, extended with source-derived 3D assets and a streamed voxel landscape. This is a **local preview**, not a verified public release or a claim of third-party asset redistribution rights.

## Run

```bash
npm install
npm run dev -- --host 127.0.0.1
```

Use Vite's HTTP URL, not the raw `index.html` preview.

## Verify

```bash
npm run lint
npm run build
node tests/run.mjs
npm run preview
```

## Integrated supplied assets

- B-2 FBX → `public/models/aircraft/b2-spirit.glb` — sole visible player aircraft, 8,154 source triangles; scalar roughness because the source roughness map is missing.
- Predator BLEND → `public/models/laptop/predator-laptop.glb` — original keyboard/hinges/materials preserved. The landmark is a **Predator asset**, not an Aurora 16 CAD model. Aurora 16 specifications remain personal setup content.
- Rubik FBX → `public/models/rubiks-cube/rubiks-cube.glb` — 26 original visible components, seven color materials, genuine layer turns, scramble, and solve-from-history.
- Frankie OBJ → `public/models/shawarma/frankie-wrap.glb` — original three geometry groups; missing MTL reconstructed from supplied maps, no AO.
- Legacy Minecraft crop → `public/models/projects/minecraft-archive.glb` — actual bounded structure, **not the entire world-save import**. Unsupported decorative fidelity and missing fringe documented.

The laboratory slot remains empty pending a laboratory model. All originals remain unchanged in their supplied archives. Trusted conversion scripts are under `tools/assets/`; untrusted extracted data is staged outside their directory.

## Controls

| Input | Action |
|---|---|
| W / ↑ | Accelerate |
| S / ↓ | Brake |
| A / ←, D / → | Turn and bank |
| Q, E | Descend, ascend |
| Mouse drag / wheel | Camera orbit / zoom |
| Space | Flight / hover |
| R | Reset in exploration; reload when fictional FX is ON |
| Home | Always reset aircraft |
| Shift | Temporary energy-limited boost |
| X | Toggle fictional dual-wing light effects (OFF by default) |
| Esc | Navigation / back |
| F / model click | Portfolio information with FX OFF; held F/left mouse fires with FX ON |

Mouse: left-drag camera in exploration, right-drag camera with FX ON, wheel zoom. Mobile: analog joystick, throttle/brake, accessible hold controls, independent touch-camera pad, boost/fire/reload actions. Audio is OFF until explicitly enabled; sounds are synthesized, not authentic recordings.

## Simulator configuration

`src/config/aircraft.ts` records the measured B-2 bounds, π yaw correction, uniform four-times scale (224-unit span), reference-only future aircraft dimensions, speed/boost profiles and meter conversion. No source GLB geometry changes or substitute models. See [Simulator upgrade and test notes](docs/simulator-upgrade.md) for controls, pooling, audio and verification limitations.

## Architecture and safety

- 11,760-unit seeded landscape: coarse distant chunks plus bounded near/mid LOD, worker generation, shared instance buffers.
- ACES/sRGB renderer, limited DPR, correct data/color map handling, procedural PMREM reflections.
- Shadow maps off; imported casting/receiving and AO maps disabled. Baked albedo lighting cannot be removed by renderer flags.
- Asset-specific Suspense/error state, aircraft load notice, direct DOM information panels and WebGL2 fallback (`?fallback`).
- Birth date is not stored in source/public configuration or browser bundles.
- No configured mail backend; contact validates drafts and explicitly says they were **not sent**. Real success requires a configured service acknowledgement.

## Reports

- [Visual reference report](docs/visual-reference-report.md)
- [Model import guide](docs/model-import-guide.md)
- [Laptop conversion details](docs/laptop-conversion.md)
- [Minecraft crop limitations](docs/minecraft-conversion.md)
- [Verification notes](docs/verification.md)

GLB/image byte sizes and renderer counts are measured locally; they are not a promise of AAA rendering, universal mobile frame rates, or complete vanilla Minecraft fidelity.
=======
# Portfolio
Best site till date
>>>>>>> 303537eb74346956571eb9bfda1bce3f396c82eb
