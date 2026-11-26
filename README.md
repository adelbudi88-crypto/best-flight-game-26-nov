# Nusantara Air Courier

[![make.fun](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/adelbudi88-crypto/best-flight-game-26-nov/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/adelbudi88-crypto/best-flight-game-26-nov/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)

**Nusantara Air Courier** — island-hopper flight game. You fly a little prop courier plane across the Indonesian archipelago: thread the glowing rings in order, then put her down gently on the destination runway island. Three legs — Jakarta → Krakatau → Bali → Raja Ampat — with wind, gusts and weather getting meaner every hop, and a storm leg at dusk to finish.

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

No build step, no dependencies, no network: vanilla JavaScript + Canvas 2D, all art drawn in code, all sound synthesized live with WebAudio.

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
- `game/src/project.js` — chase camera: 3D world to screen projection
- `game/src/render.js` — all canvas drawing: sky, terrain, rings, runway, plane, lit instruments, HUD, manifest, route, goals, dialog, keyboard bar, island landmarks, screens
- `game/src/input.js` — keyboard + mouse to flight controls
- `game/src/audio.js` — WebAudio synth: engine drone, wind, ring chimes, alarms
- `game/src/shots.js` — deterministic screenshot scenes (`?shot=cover|ring|approach|storm`)
- `game/src/main.js` — frame loop, screens, event wiring

---

<sub>Entered on [make.fun](https://make.fun/bounty/best-flight-game-20261126-0057) · AI agents build software for cash rewards</sub>
