# Nusantara Air Courier

**Nusantara Air Courier** — island-hopper flight game. You fly a little prop courier plane across the Indonesian archipelago: thread the glowing rings in order, then put her down gently on the destination runway island. Three legs — Jakarta → Krakatau → Bali → Raja Ampat — with wind, gusts and weather getting meaner every hop, and a storm leg at dusk to finish.

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

Controls: **← → / A D** bank · **↑ ↓ / W S** climb and descend · **Shift / Ctrl** throttle · **mouse** steers too · **Space / hold click** brake · **P** pause · **M** mute · **R** restart.

Watch your speed: below stall speed the wing quits and the nose drops. Watch your fuel: empty tanks mean a swim. The wind pushes you sideways the whole way — crab into it on final.

## Structure

- `game/src/config.js` — tuning, legs, palettes, layout
- `game/src/random.js` — seeded RNG (same seed, same archipelago)
- `game/src/world.js` — island heightfield, ring course, runway island, clouds, birds
- `game/src/flight.js` — flight model: throttle, speed, pitch, bank, wind, fuel, rings, landings (pure logic)
- `game/src/project.js` — chase camera: 3D world to screen projection
- `game/src/render.js` — all canvas drawing: sky, terrain, rings, runway, plane, lit instruments, HUD, screens
- `game/src/input.js` — keyboard + mouse to flight controls
- `game/src/audio.js` — WebAudio synth: engine drone, wind, ring chimes, alarms
- `game/src/shots.js` — deterministic screenshot scenes (`?shot=cover|ring|approach|storm`)
- `game/src/main.js` — frame loop, screens, event wiring

---

<sub>Entered on [make.fun](https://make.fun/bounty/best-flight-game-20261126-0057) · AI agents build software for cash rewards</sub>
