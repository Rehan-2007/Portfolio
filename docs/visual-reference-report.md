# Visual reference report — 2026-11-15

Five uploaded images were visually inspected **before modifying the project**. Copies are kept in separate folders under `docs/references/`, outside public/runtime assets. Original uploads are not modified. These images are design references only, not texture sources; no image licence or permission to redistribute a production texture is assumed.

## 01 — Alienware laptop

[Reference](references/laptop/reference.png)

- A low-resolution two-view product image: front three-quarter open view and rear/lid view.
- Dark blue/charcoal matte chassis; relatively thin screen border; broad keyboard deck, recessed trackpad, small luminous alien-head emblem.
- Neutral studio lighting rather than the dramatic RGB treatment in the world illustration.
- Model identity, exact dimensions, ports, underside, hinge detail and full keyboard layout cannot be established from this image.
- Use to inspect the user's future model. **Do not generate a stand-in laptop.** User-provided Aurora 16 specifications are content, not facts extracted from this image.

## 02 — Rubik's Cube

[Reference](references/rubiks-cube/reference.png)

- Solved 3×3 cube from an elevated corner view; blue top, red left, yellow right.
- Distinct pieces with thick black gaps, subtly rounded colored tile corners and satin surfaces.
- Hidden faces, internal mechanism, and exact dimensions are not visible.
- A future model must expose individual cubelets/layers or documented named nodes for physical rotations. A single fused mesh cannot be claimed to support them.
- Color orientation differs from the world illustration because the cube may be rotated; do not infer hidden face arrangements from this single view.

## 03 — Shawarma

[Reference](references/shawarma/reference.png)

- Stylized smooth wrap shown diagonally, open end toward the viewer.
- Warm tan bread, rounded golden edges, faint toasted pattern, folded green leaves, red tomato slices and yellow sauce.
- Soft studio highlights and rounded rather than voxel food geometry.
- Rear/closed end is not fully specified. This is visibly **Vecteezy-watermarked stock imagery**. Do not remove the watermark, copy the image into a texture, or assume an asset licence.
- Reserve an empty model slot for the user's food model.

## 04 — Environment composition

[Reference](references/world/reference.png)

- Wide, elevated chase view: smooth bomber foreground; oversized laptop left, cube right, river/valley corridor between them.
- Actual stepped grass/dirt/stone cliffs, snowy mountain ridges, green/pink voxel trees, stairs, bridges, terraces and waterfalls.
- Connected plateaus, multiple landscape depths, small intentional floating islands and extensive mist in valleys.
- Orange sunset and cool cyan accents; dark graphite landmarks contrast with bright vegetation.
- Distant laboratory/archive architecture is visible only as exteriors; no detailed room/equipment reference is supplied.
- Guides terrain/scale/color/composition, not exact aircraft or laptop modelling. Expand into a continuous landscape rather than a small isolated diorama.
- **Conflict resolved:** cast shadows present in the illustration are not reproduced. The user's explicit no-shadows requirement takes precedence. Use normal material lighting, color variation and fog instead.

## 05 — B-2 photograph

[Reference](references/b2/reference.png)

- Oblique upper-surface photograph with a wide swept flying wing, thin edges, angular trailing-edge cutouts and smoothly blended centre body.
- Forward cockpit glazing, dark recessed openings, restrained panel seams and markings, graphite-blue satin surface.
- No conventional tail or separate tube fuselage. Avoid uniform slab wings, obvious stacked spheres, glossy black double-darkening, and fictional glowing engine flames.
- Primary aircraft reference; supersedes the stylized bomber in image 04.
- Underside, exact orthographic plan, landing gear and full inlet/exhaust structure are not documented. Procedural refinements remain approximations; do not claim those unseen details came from the photograph.
- No photographic markings/insignia are copied into textures. Replace the procedural aircraft with the user's actual GLB/GLTF when supplied and successfully loaded.

## Project inspection and implementation boundaries

At analysis time: React 19 / TypeScript / Vite / Three.js 0.187 / R3F 9.8 / Drei 10.7 were installed. No actual GLB/GLTF models were present. Landmark placeholders consisted only of the six platform/pole/octahedron beacon assemblies; no complete laptop, cube, shawarma, or lab model existed.

- Cleanup targets: Canvas, aircraft casting/receiving, sunlight shadow rig, voxel batch flags and beacon stand-ins.
- Expansion targets: voxel world config/sampling/generation/LOD/materials and atmosphere.
- Aircraft targets: existing B2Spirit geometry/materials, frame-clock units, terrain safety and camera interpolation.
- New infrastructure: null-path model registry, isolated GLTF loading/errors/status, model inspection/animations and direct accessible information panels.

No cast shadows, contact shadows, shadow catchers, or AO passes are permitted. Imported AO maps are disabled on cloned materials; shadows baked into a supplied base-color texture require reporting/revised textures, not a false claim that flags removed them.

## Assets still needed

Actual laptop, cube, shawarma, laboratory, project and optional aircraft model packages (GLB or complete GLTF plus buffers/textures). Higher-resolution laptop views and B-2 top/front/side views would improve precision but are not blockers for world cleanup or loader preparation. All production model asset paths remain null until real files are provided.
