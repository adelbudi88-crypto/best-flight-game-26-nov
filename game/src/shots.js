// The screenshot scenes behind ?shot=cover|ring|approach|storm. Each one plays
// the real rules forward from a fresh world for a fixed number of steps, steered
// by a simple autopilot (bank toward the next ring or the runway, pitch to hold
// its height, throttle for the right speed), so the frame is what a real flight
// looks like and the same seed always gives the same frame.
import { PLANE, STEP } from './config.js';
import { EVENT_LANDED, EVENT_LEG_COMPLETE, EVENT_RING } from './flight.js';
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
  const heightError = target.y - state.alt;
  return {
    roll: Math.max(-1, Math.min(1, Math.asin(sinRoll) / PLANE.maxRoll)),
    pitch: Math.max(-0.8, Math.min(0.8, heightError * 0.015)),
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
    if (flight.state.lives <= 0) break;
    if (stopWhen && stopWhen(flight, world)) break;
  }
}

// The cover: mid-leg, a ring dead ahead with the runway island on the horizon,
// instruments lit, HUD full. The pilot threads three rings first so the frame
// shows a ring just ahead and the score already moving.
function stageCover(flight, world) {
  flySteps(flight, world, 30, (f, w) => {
    const next = w.nextRing();
    if (!next) return autopilot(f, w, { x: w.runway.x, y: 90, z: w.runway.z }, 55);
    return autopilot(f, w, next, 62);
  });
  return { screen: SCREEN_PLAY, best: 1250 };
}

// Passing through a ring: the pilot is lined up so the ring fills the frame.
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
  return { screen: SCREEN_PLAY, best: 1250 };
}

// Final approach: the pilot threads every ring first (about a minute of
// flying at cruise), then slows, descends and lines up on the runway with
// the lights ahead.
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
  return { screen: SCREEN_PLAY, best: 2450 };
}

// The storm leg at dusk: rain, low cloud, a ring glowing through the murk.
function stageStorm(flight, world) {
  flight.resetForLeg(2, true);
  world.startLeg(2);
  flySteps(flight, world, 16, (f, w) => {
    const next = w.nextRing();
    if (!next) return autopilot(f, w, { x: w.runway.x, y: 90, z: w.runway.z }, 55);
    return autopilot(f, w, next, 58);
  });
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
