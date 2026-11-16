# B-2 simulation upgrade

## Preserved asset and architecture

The player still uses the supplied `public/models/aircraft/b2-spirit.glb`. No alternate demo, replacement aircraft or duplicate flight controller was introduced. Its SHA-256 remains:

`e3bb91bfe6bbdc8c1602825bf775d269a8c7b3b8367fdc803998e83ea456ffbf`

`src/config/aircraft.ts` records the audited 56 × 3.830313444 × 23.053176403 GLB bounds. Its model wrapper now applies **π yaw and uniform scale 4**, giving a 224-unit visual wingspan with unchanged proportions. The source nose (+Z) maps to logical −Z; FlightSystems still renders yaw −heading and physics forward `[sin(heading), -cos(heading)]`. The environment is not rotated.

The landscape is artistic rather than geographic. Display units use nominal B-2 wingspan **52.4 m / 224 world units**. Speed = world units/s × that conversion × 3.6. Altitude uses the same conversion with a declared world datum; AGL is relative to terrain height. The source model does not include full standing landing-gear reference height.

Reference-only F-16/F-22/C-130 dimensions and speed profiles are centralized. They have null asset paths and are not selectable/rendered because no models were supplied. This is configuration readiness, not a claim of four functioning aircraft.

## Mechanics

- Persistent throttle, profile maximum speed, acceleration/braking inertia, smoothed turning/banking/climb.
- B-2 normal maximum: 950 world units/s (~800 km/h). Boost ceiling: 1450 world units/s (~1221 km/h). These are fictional arcade profiles, not a real aerodynamic flight model.
- Shift boost drains 100% energy in ~5 seconds, imposes depletion lockout, and recharges after release. Simulation time drives energy/reload; pause, open UI and aircraft loading freeze them.
- Airframe-footprint clearance scales with the 224-unit span and includes bank/pitch allowance. Speed-dependent swept lookahead avoids late ridge contacts. Conservative landmark envelopes remain, not exact mesh collision.
- Sized follow/cinematic/overview camera fits use the smaller horizontal/vertical FOV and a conservative bounding sphere. Portrait framing is further back rather than distorting aircraft. Reset/teleport clears stale interpolation.

## Mode-based controls

The default is peaceful exploration with fictional effects OFF.

| Input | Exploration / FX OFF | Fictional FX ON |
|---|---|---|
| W/S, arrows | Increase/decrease throttle | Same |
| A/D, arrows | Turn | Same |
| Q/E | Descend/ascend | Same |
| Shift | Boost | Boost |
| F | Nearby portfolio information | Held dual-wing light effects |
| R | Reset | Reload |
| Home | Always reset | Always reset |
| Left drag | Camera | Held fire |
| Right drag | — | Camera |
| X | Enable FX | Disable FX |
| Space | Flight/hover | Same |
| Esc | Navigation/back | Same |

Visible information/reset controls remain available. UI/form/model clicks never fire or simultaneously open a model when FX is enabled. Focus, pointer cancellation, blur, hidden visibility and dialogs clear held actions. Mobile includes joystick, existing hold controls, independent camera pad, boost/FX/fire/reload buttons.

## Fictional light effects

No targeting, damage, weapons engineering or combat mechanics. Emission is decorative only.

- Exactly two simultaneous origins follow logical aircraft yaw/pitch/roll.
- Fixed 192-projectile and 32-impact storage; one paired emission consumes two of 120 charge units.
- 0.12s paired interval, 2.5s reload, 1.2s projectile lifetime; contacts sample terrain and conservative landmark heights.
- Instanced/shared rendering; no second RAF or controller. Reduced motion suppresses flashes/puffs and shrinks streaks.
- Reset clears effects, ammo/history counters and held input. The HUD explicitly calls this FICTIONAL FX.

## Audio

Procedural synthesized ambience and one-shots, **not authentic recorded B-2 sounds**. Audio is OFF on load and starts only from an explicit Audio ON gesture. Master, engine/boost, wind, effects and UI volumes are independently configurable. Voice cap is 8; ended nodes and stopped loops disconnect; OFF/unmount destroys the context. Hidden tabs stop audio and require another ON gesture.

Throttle/speed/boost modulate continuous engine pitch/gain. Grounded transitions trigger takeoff/landing sounds; actual paired emission and decorative contact events trigger fire/impact. Listener and engine positions use WebAudio panners. The simulation's ground-clearance mode is not a runway/landing-gear simulator.

## Lighting

The earlier explicit shadow-free policy remains: no cast/receive/contact shadows or screen-space AO. Existing ACES/sRGB/PBR maps/PMREM reflections and quality/DPR controls are reused. No extra postprocessing dependency or source model changes.

## Verification

- Final `npm run lint`: 0 warnings/errors. `npm run build`: passed; graphics chunk size advisory remains. **57 regression checks passed**, including 20 focused audio/effects/simulator checks.
- The first effects timing test had one anomalously slow host run; subsequent focused and full re-runs completed normally and passed. No persistent timing failure was reproduced.
- Full prior and new checks cover source asset preservation, uniform scaling/yaw, finite input and clock handling, 30/60/120 Hz mechanics, boost depletion/recharge, camera fit, dual origins/forward transform, ammo/reload/release, pool reuse/capacity/expiry and bounded audio lifecycle/autoplay cases.
- Live built-page HUD/effects were verified. In the same app's development verification mode, a bounded W+Shift synthetic hold raised speed from 160 to 572.49 units/s, throttle17%→89.84%, boost active, energy100%→75.67%.
- A bounded 800ms synthetic F hold emitted7 pairs/14 projectiles, ammo120→106. Release stopped firing with no extra pair. Reload returned ammo to120, no active projectiles/impacts.
- Audio ON keyboard activation returned a running context and ON state; OFF was subsequently confirmed. **Audible authenticity/output quality was not independently heard/verified.**
- Follow/cinematic/overview live distances exceeded calculated fit minima. Portrait viewport390×844 had no document overflow; a portrait screenshot timed out and is not marked visually accepted. Native touch and sustained performance/memory soak checks remain device-testing work.
- Browser driver sometimes times out or pauses hidden pages; documented synthetic checks are not substituted for complete native mouse/touch testing. No universal smoothness or real-world flight fidelity claim.

Use `node tests/run.mjs` for all regressions; optional file filters, e.g. `node tests/run.mjs simulator projectiles audio`, run focused checks. Preview is local only; no deployment.
