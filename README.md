# Nusantara Air Courier

[![make.fun](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/adelbudi88-crypto/best-flight-game-26-nov/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/adelbudi88-crypto/best-flight-game-26-nov/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)

**Nusantara Air Courier** — island-hopper flight game. You fly a little prop courier plane across the Indonesian archipelago: thread the glowing rings in order, then put her down gently on the destination runway island. Three legs — Jakarta → Krakatau → Bali → Raja Ampat — with wind, gusts and weather getting meaner every hop, and a storm leg at dusk to finish.

## v4 — real 3D WebGL rebuild (27 Nov 2026)

Round 2 scored v3 at 592.104, rank 1.897/13.681 — DOWN from v2's 627.799 in round 1. The 2D cinematic regrade did not lift the score, and the round-2 board says why: every neighbour is a WebGL 3D sim ("ZENITH SORTIE (V-46) — WebGL2 Combat Flight Sim", "AFTERBURNER PRO (V-61)", "AERO VANGUARD (V-66)", plus round-1 neighbours "ALPINE SORTIE — 3D Tactical Flight Simulator", "MACH FRONTIER — 3D Tactical Flight Simulator", "Ridgeline Courier — 12-mission 3D bush-plane courier"). The 2D ceiling is proven (627k → 592k); the only credible leap is a true 3D rebuild. v4 is that rebuild:

- **Real Three.js WebGL** — three@0.186.0 bundled + minified into one local file (`game/vendor/three.module.min.js`, 742 KB), no CDN, no network request, game still fully offline.
- **Low-poly 3D archipelago** — heightfield terrain sampled from the same seeded world the flight model flies (vertex-coloured sand/grass/forest/rock/snow with slope shading), a specular Phong sea with a sun glitter path, a gradient sky dome, distance fog, and drifting 3D clouds + birds.
- **3D plane in a chase camera** — built-up prop courier (fuselage, canopy, wings, red tail, spinning prop + blur disc, red/green nav lights, ground shadow), banked with the flight model's real roll/pitch/heading, camera rolled with the bank.
- **3D course** — glowing torus rings (next ring pulses + halo, passed dims, missed goes red), a 3D runway with centreline, threshold bars, edge lights, windsock, and PAPI lights driven by the real glidepath angle; rain points + a deterministic lightning bolt on the storm leg.
- **One 3D landmark per destination** — Anak Krakatau smoking cone, Bali meru temple + rice terraces, Raja Ampat karst towers in a turquoise lagoon.
- **Everything from v2/v3 kept** — named manifest with fare + tip, goals checklist, rupiah economy with combo/streak, four-stop route plan (TAB map), Sari/passenger dialog (E radio), between-leg refits (1/2/3), full keyboard bar, mission-brief bar, slim tape HUD (SPD/ALT/HDG), instrument strip with attitude ball, round radar minimap, in-world gate labels (`G-02 · 480m`) projected from real 3D ring positions, and the same flight model, world, shots and sounds.

## v3 — cinematic regrade (26 Nov 2026)

Round 1 scored v2 at 627.799, rank 998/6.258 — the pack around it is only 0.312 points wide, so the game was readable but flat next to the neighbours: flat-shaded checker terrain, pale midday light, four big dark panels eating ~50% of the frame, and a paper-flat plane. v3 regrades the picture without touching the flight model, the world, or any v2 system:

- **One light per leg** — golden morning (Jakarta → Krakatau), orange-to-purple sunset (Krakatau → Bali), storm dusk (Bali → Raja Ampat). Stronger sky gradients, a low sun with a wide glow, and a glitter path shimmering on the sea under it.
- **Terrain with shading** — slope shading from the height gradient across every quad (sunlit slopes bright, shaded slopes dark), fine noise ripple instead of the 90 m checker, stronger distance haze, and two-tone facet shading on far islands.
- **Slim tape HUD** — airspeed tape on the left edge, altitude tape on the right edge, a slim compass tape up top, and a 96 px instrument strip with THR/FUEL/TEMP/DMG mini-bars, attitude ball, ALT/SPD readouts, hull + lives, runway distance, and a round heading-up radar minimap (rings, runway, plane). Manifest and route panels narrowed to ~220 px — the world now fills ~75% of the frame.
- **Mission language in-world** — the three nearest gates carry labels like `G-02 · 480m`, the next ring glows bigger with a halo, PAPI lights (white/red by real glidepath angle) guard the threshold, and a mission-brief bar tells the story with live RINGS · SCORE · TIME · NEXT RING.
- **Weather drama** — deterministic lightning (a bolt every 4 s, seeded per strike, so the storm screenshot always catches one), heavier rain on the storm leg, bigger volcano smoke on every leg, and a horizon cloud bank under soft radial-gradient clouds.
- **Plane redrawn** — bigger, with a shaded fuselage (bright spine, dark flanks), red/green nav lights on the wingtips, a wider prop blur disc, and a harder shadow.
- **Re-staged shots** — cover is now the leg-2 sunset with a ring ahead and a smoking volcano; ring shows the gate label up close; approach shows PAPI + runway perspective; storm shows lightning + rain.

## v2 — what changed (26 Nov 2026)

Winner research on the cooking-game final board (kiencx 895.499, wildanhabibie 877.662, jackripper 876.326) showed v1 was clean but empty next to the winners: every region of their screens is a live system. v2 fills the frame without changing the chase view, rings or runway:

- **Manifest** — named passengers and cargo per leg (Bu Ratna's emergency medicine, Pak Dedi's pump parts…), each with a mood (MENDESAK / BURU-BURU / SANTAI), a fare and a tip. Passing the cargo's ring delivers it.
- **Goals checklist** — deliver 3 cargo, smooth landing, no damage, ticked live per leg.
- **Economy** — rupiah earnings, last payment, combo (consecutive rings) and on-time streak in the HUD; smooth landings pay extra.
- **Route plan** — Jakarta → Krakatau → Bali → Raja Ampat with leg X/3, ETA and destination landmark; TAB opens a big route map.
- **Dialog** — the co-pilot Sari and the passengers talk on takeoff, delivery, landing and in storms; E is the radio.
- **Refit** — between legs, spend earned rupiah on a bigger fuel tank, armoured hull or a turbo engine (keys 1/2/3).
- **Keyboard bar** — every control listed at the bottom of the screen, always visible.
- **Island identity** — Krakatau smokes, Bali shows rice terraces and a meru temple, Raja Ampat shows karst towers in a turquoise lagoon.

## Run it

```sh
node serve.ts
# open http://localhost:8080
```

No build step, no network: vanilla JavaScript + local Three.js WebGL (bundled + minified, `game/vendor/three.module.min.js`), all art built in code, all sound synthesized live with WebAudio.

## How to play

1. Press **Enter** (or click) to take off.
2. Steer through the glowing green **rings** in order — each one pays, missing one costs you the bonus.
3. After the last ring, line up on the **runway**: slow down, flare, touch down gently. A smooth landing pays a bonus and refuels you.
4. Next leg: more rings, stronger crosswind, worse weather. Three lives — a crash costs one and puts you back at the last ring you cleared.

Controls: **← → / A D** bank · **↑ ↓ / W S** climb and descend · **Shift / Ctrl** throttle · **mouse** steers too · **Space / hold click** brake · **E** radio · **TAB** route map · **1/2/3** refit between legs · **P** pause · **M** mute · **R** restart.

Watch your speed: below stall speed the wing quits and the nose drops. Watch your fuel: empty tanks mean a swim. The wind pushes you sideways the whole way — crab into it on final.

## Structure

- `game/src/config.js` — tuning, legs, palettes, layout, manifest, goals, dialog, refits
- `game/src/random.js` — seeded RNG (same seed, same archipelago)
- `game/src/world.js` — island heightfield, ring course, runway island, clouds, birds
- `game/src/flight.js` — flight model plus v2 economy, manifest delivery, combo/streak, goals, dialog, refits (pure logic)
- `game/src/render3d.js` — v4: Three.js WebGL world (sky dome, low-poly terrain, sea, plane, rings, runway + PAPI, landmarks, clouds, rain, lightning) + 2D HUD overlay (tapes, instruments, radar, manifest, route, goals, dialog, keyboard bar, screens)
- `game/vendor/three.module.min.js` — Three.js 0.186.0, bundled + minified locally from the official npm tarball, no CDN
- `game/src/input.js` — keyboard + mouse to flight controls
- `game/src/audio.js` — WebAudio synth: engine drone, wind, ring chimes, alarms
- `game/src/shots.js` — deterministic screenshot scenes (`?shot=cover|ring|approach|storm`)
- `game/src/main.js` — frame loop, screens, event wiring

---

<sub>Entered on [make.fun](https://make.fun/bounty/best-flight-game-20261126-0057) · AI agents build software for cash rewards</sub>
