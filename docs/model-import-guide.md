# Real-model import and integration guide

## Current source-derived assets

The following exact existing paths are configured in `src/config/models.ts`:

| Slot | Asset | Origin and limitation |
|---|---|---|
| aircraft | `/models/aircraft/b2-spirit.glb` | Actual supplied B-2 FBX; 8,154 triangles, repaired supplied diffuse/normal/metallic maps, scalar roughness 0.46 because source roughness is absent. Only visible player aircraft. |
| about | `/models/laptop/predator-laptop.glb` | Actual Predator Blender asset; original evaluated geometry/materials/packed images preserved. Not an exact Aurora 16 CAD model. |
| cube | `/models/rubiks-cube/rubiks-cube.glb` | Actual FBX's 26 visible loose components; 10 non-rendering vertices omitted, original seven colors retained. Genuine layer turns around source transforms. |
| shawarma | `/models/shawarma/frankie-wrap.glb` | Actual three-group OBJ, absent MTL reconstructed from supplied semantic groups/maps; AO maps omitted. |
| archive | `/models/projects/minecraft-archive.glb` | Actual bounded legacy world crop, not whole save import; partial shapes/UV and missing fringe limitations in separate report. |

Lab/contact/environment slots stay null unless real model assets are provided. No placeholder model is generated. All original ZIPs are unchanged. No bundled licence establishes redistribution rights; this remains local integration, not a deployment.

## Future packages

Keep each source archive/extracted package in its own new data directory. Trusted conversion scripts live separately under `tools/assets` and take paths as arguments. Do not execute scripts from uploaded archives. Use Blender `--disable-autoexec` and Python isolated mode.

Registry fields: actual asset path, wrapper position/rotation/scale, visibility, desired dimensions, interaction station, named animation, decoder path, face-node maps. Use radians for rotation. +Y up and −Z nose are the airplane runtime conventions. Do not invent filenames or auto-distort a source mesh to fit a platform.

## Loading/material policy

- Optional models have per-slot Suspense/error state and retries; failure does not remove the world or navigation.
- Aircraft has no procedural visible fallback; loading/failure notice is explicit and flight waits for actual readiness.
- Hierarchy, materials and texture samplers are cloned; geometry and image pixels remain source data.
- Base color/emissive use sRGB. Normal, roughness, metallic and other data maps are linear/no-color.
- Renderer-capped anisotropy, mipmaps and linear filtering are used for smooth assets; Minecraft archive retains nearest sampling.
- Cast/receive flags and AO maps are disabled; embedded lights are hidden. Baked base-color darkness cannot be removed with flags and is not claimed removed.
- Animation requires an exact real clip name. The supplied assets have no clips; cube turns are real imported-node animation, not falsely named source clips.
- Draco code is imported only for explicitly configured local decoder assets.

## Cube functionality

`CubeController` animates nine original cubelet groups per quarter turn, preserves nonuniform original center-cap origins, and snaps transforms from integer signed-permutation orientations. `Scramble` adds 12 deterministic moves; `Solve history` reverses actions committed in this session. It is not an arbitrary-state solver. Six categories remain accessible by DOM panels and actual cube surface clicks.

## Interaction/portfolio

E remains ascend. F/click/direct navigation opens destination information. The Predator screen uses a runtime OS splash placed on measured display geometry; full content is an accessible DOM interface, not a copied reference image. Setup data is Alienware Aurora 16 AC16250 and is separate from the Predator visual asset.

Contact validates required fields but never reports delivery without an explicitly configured service returning successful acknowledgement. Empty contact/social/project links stay empty. Date of birth is not written to project/public configuration.

## Verification

Run `npm run lint`, `npm run build`, `node tests/run.mjs`. The suite includes synthetic loader fixtures, actual GLB file inventories, imported cubelet motion/history restoration, contact success/error semantics, frame-rate/flight/terrain and shadow checks. Browser verification notes and its input-driver limitations are in `docs/verification.md`.
