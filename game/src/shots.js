// The screenshot scenes behind ?shot=cover|ring|approach|storm. Each one plays
// the real rules forward from a fresh world for a fixed number of steps, steered
// by a simple autopilot (bank toward the next ring or the runway, pitch to hold
// its height, throttle for the right speed), so the frame is what a real flight
// looks like and the same seed always gives the same frame.
import { PLANE, STEP } from './config.js';
import { EVENT_CRASH, EVENT_LANDED, EVENT_LEG_COMPLETE, EVENT_RING } from './flight.js';
import { SCREEN_PLAY } from './render.js';

// Steer the plane toward a point: bank for a heading rate proportional to the
// heading error (so the turn tightens gently and never overshoots into a
// bank-oscillation), pitch to hold the target height, throttle for the right
// speed. The same pilot flies every scene.
export function autopilot(flight, world, target, speedTarget) {
  const state = flight.state;
  const dx = target.x - state.x;
  const dz = target.z - state.z;
  const wantedHeading = Math.atan2(dx, dz);
  let error = wantedHeading - state.heading;
  while (error > Math.PI) error -= Math.PI * 2;
  while (error < -Math.PI) error += Math.PI * 2;
  const desiredRate = Math.max(-0.5, Math.min(0.5, error * 0.6));
  const speedFactor = Math.max(0.4, state.speed / PLANE.cruiseSpeed);
  const sinRoll = Math.max(-0.85, Math.min(0.85, desiredRate / (PLANE.turnRate * speedFactor)));
  // v3 — terrain clearance: sample the ground along the path to the target
  // and never let the target height drop below the highest ground + margin,
  // so the staging flight cannot fly into a volcano slope (the leg-2 cover
  // used to crash three times in 30 s). Climb hard when still below it.
  let safeY = target.y;
  const dxT = target.x - state.x;
  const dzT = target.z - state.z;
  const distT = Math.hypot(dxT, dzT);
  const samples = Math.min(8, Math.max(2, Math.ceil(distT / 90)));
  for (let i = 1; i <= samples; i += 1) {
    // Only the first 70% of the path: the last stretch is the descent to
    // the ring (or the runway on final), which must not be held up.
    const t = (i / samples) * 0.7;
    safeY = Math.max(safeY, world.groundHeight(state.x + dxT * t, state.z + dzT * t) + 55);
  }
  const heightError = safeY - state.alt;
  const pitchRaw = heightError * 0.015;
  const pitchDemand = state.alt < safeY - 25 ? Math.max(pitchRaw, 0.55) : pitchRaw;
  return {
    roll: Math.max(-1, Math.min(1, Math.asin(sinRoll) / PLANE.maxRoll)),
    pitch: Math.max(-0.8, Math.min(0.8, pitchDemand)),
    throttleUp: state.speed < speedTarget - 4,
    throttleDown: state.speed > speedTarget + 4,
    brake: false,
  };
}

function flySteps(flight, world, seconds, steer, stopWhen) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    const control = steer(flight, world, i);
    flight.step(control, world.groundHeight, world.rings, world.runway);
    const event = flight.consumeEvent();
    if (event && (event.type === EVENT_LANDED || event.type === EVENT_LEG_COMPLETE)) break;
    // v3 — a staged scene must never show a wreck: a crash puts the plane
    // back at the last ring it cleared and the staging flies on.
    if (event && event.type === EVENT_CRASH) flight.respawn(world.rings);
    if (flight.state.lives <= 0) break;
    if (stopWhen && stopWhen(flight, world)) break;
  }
}

// v3 — the cover is now leg 2 (Krakatau — Bali) at SUNSET: the low orange sun,
// its glitter path on the sea, a ring dead ahead and a smoking volcano on the
// horizon. The pilot threads three rings first so the frame shows a ring just
// ahead and the score already moving.
function stageCover(flight, world) {
  flight.resetForLeg(1, true);
  world.startLeg(1);
  flySteps(flight, world, 30, (f, w) => {
    const next = w.nextRing();
    if (!next) return autopilot(f, w, { x: w.runway.x, y: 90, z: w.runway.z }, 55);
    return autopilot(f, w, next, 62);
  });
  // v3 — the cover must show the density: a live dialog line + delivered cargo.
  flight.state.dialog = { who: 'PAK MADE', line: '"Canang sarinya sampai sebelum upacara!" +Rp135rb (tepat waktu, tip!)', timer: 99 };
  return { screen: SCREEN_PLAY, best: 1250 };
}

// Passing through a ring: the pilot is lined up so the ring fills the frame.
// v3 — golden-morning leg 1, the gate label "G-0n · 480m" close ahead.
function stageRing(flight, world) {
  flySteps(flight, world, 30, (f, w) => {
    const next = w.nextRing();
    if (!next) return autopilot(f, w, { x: w.runway.x, y: 90, z: w.runway.z }, 55);
    return autopilot(f, w, next, 62);
  });
  // Ease off the last seconds so the ring sits just ahead, not behind us.
  flySteps(flight, world, 1.2, (f, w) => {
    const next = w.nextRing();
    if (!next) return { roll: 0, pitch: 0, throttleUp: false, throttleDown: true, brake: false };
    return autopilot(f, w, next, 40);
  });
  // v2 — ring shot: the next cargo owner talks while the ring glows ahead.
  flight.state.dialog = { who: 'PAK DEDI', line: 'Pompa bisa jalan lagi kalau suku cadang ini sampai. Hati-hati, Kapten!', timer: 99 };
  return { screen: SCREEN_PLAY, best: 1250 };
}

// Final approach: the pilot threads every ring first (about a minute of
// flying at cruise), then slows, descends and lines up on the runway with
// the lights ahead.
// v3 — the PAPI lights and the runway perspective carry this shot; the dialog
// now names Krakatau (leg 1), not Bali.
function stageApproach(flight, world) {
  flySteps(flight, world, 58, (f, w) => {
    const next = w.nextRing();
    if (!next) return autopilot(f, w, { x: w.runway.x, y: 90, z: w.runway.z }, 55);
    return autopilot(f, w, next, 62);
  });
  // Stop on short final, about 350 m out: the runway fills the frame, the
  // plane is lined up and descending, and it has not overshot the threshold.
  flySteps(flight, world, 26, (f, w) => {
    const runway = w.runway;
    const dz = runway.z - f.state.z;
    const target = {
      x: runway.x,
      y: Math.max(60, runway.y + Math.max(12, dz * 0.045)),
      z: runway.z - 60,
    };
    return autopilot(f, w, target, dz > 500 ? 50 : 38);
  }, (f, w) => w.runway.z - 60 - f.state.z < 350);
  // v3 — approach shot: co-pilot calls the landing with Anak Krakatau abeam.
  flight.state.dialog = { who: 'SARI (co-pilot)', line: 'Runway di depan! Anak Krakatau di kiri — turun pelan, flare lembut.', timer: 99 };
  return { screen: SCREEN_PLAY, best: 2450 };
}

// The storm leg at dusk: rain, low cloud, a ring glowing through the murk.
// v3 — the deterministic lightning bolt fires at shot time 12, and the rain
// is heavier (palette rain 1.0).
function stageStorm(flight, world) {
  flight.resetForLeg(2, true);
  world.startLeg(2);
  flySteps(flight, world, 16, (f, w) => {
    const next = w.nextRing();
    if (!next) return autopilot(f, w, { x: w.runway.x, y: 90, z: w.runway.z }, 55);
    return autopilot(f, w, next, 58);
  });
  // v2 — storm shot: the storm warning dialog + the urgent cargo on the board.
  flight.state.dialog = { who: 'SARI (co-pilot)', line: 'Badai di depan! Vaksin Kak Yosua prioritas satu — terbang rendah dan stabil.', timer: 99 };
  return { screen: SCREEN_PLAY, best: 3800 };
}

export function stageShot(name, flight, world) {
  switch (name) {
    case 'ring':
      return stageRing(flight, world);
    case 'approach':
      return stageApproach(flight, world);
    case 'storm':
      return stageStorm(flight, world);
    case 'cover':
    default:
      return stageCover(flight, world);
  }
}

// Keep the event names the scenes use visible to the reader.
void EVENT_RING;
