// The flight model: throttle, speed, pitch, bank, heading, wind and fuel. Pure
// numbers in, pure numbers out — no canvas, no sound — so the screenshot scenes
// can fly the same physics as the player, and a test can step it headlessly.
import { DIALOGS, GOALS, LEGS, MANIFESTS, PLANE, RING, RUNWAY, STEP, UPGRADES } from './config.js';

const RING_PASS_DISTANCE = 40;
const RING_RADIUS = RING.radius;
const RUNWAY_LENGTH = RUNWAY.length;
const RUNWAY_WIDTH = RUNWAY.width;

export const EVENT_RING = 'ring';
export const EVENT_RING_MISSED = 'ring-missed';
export const EVENT_LANDED = 'landed';
export const EVENT_CRASH = 'crash';
export const EVENT_FUEL_LOW = 'fuel-low';
export const EVENT_STALL = 'stall';
export const EVENT_LEG_COMPLETE = 'leg-complete';

// Heading 0 flies north (+Z). Position x is east, z is north, alt is metres.
export function createFlight(seed) {
  const state = {
    seed,
    leg: 0,
    x: 0,
    z: 0,
    alt: 120,
    heading: 0,
    pitch: 0,
    roll: 0,
    speed: 55,
    throttle: 0.7,
    fuel: PLANE.fuelCapacity,
    hull: PLANE.hull,
    lives: PLANE.lives,
    score: 0,
    ringsHit: 0,
    ringsTotal: 0,
    legTime: 0,
    totalTime: 0,
    windX: 0,
    windZ: 0,
    gustPhase: seed * 0.7,
    verticalSpeed: 0,
    stalled: false,
    landed: false,
    onGround: false,
    lastEvent: null,
    eventData: null,
    message: '',
    messageTimer: 0,
    // --- v2 economy / manifest / goals / dialog / refit ---------------------
    earnings: 0, // rupiah earned this run (fare + tip + landing pay)
    lastPay: 0, // rupiah of the most recent delivery / landing
    lastPayLabel: '',
    combo: 0, // consecutive rings threaded without a miss
    streak: 0, // consecutive on-time deliveries
    bestStreak: 0,
    delivered: 0, // cargo items delivered this leg
    manifest: [],
    goals: [],
    dialog: null, // { who, line, timer }
    dialogCount: 0,
    upgrades: { fuel: 0, hull: 0, engine: 0 },
    smoothLanding: false,
    crashedThisLeg: false,
  };

  function setDialog(who, line, seconds) {
    state.dialog = { who, line, timer: seconds };
    state.dialogCount += 1;
  }

  function manifestFor(legIndex) {
    return (MANIFESTS[legIndex] ?? []).map((item) => ({ ...item, status: 'pending', paid: 0 }));
  }

  function goalsFor(legIndex) {
    return (GOALS[legIndex] ?? []).map((goal) => ({ ...goal, done: false, progress: 0 }));
  }

  // v2 — E (radio): the co-pilot answers with a line about the flight.
  function radio() {
    const lines = DIALOGS.radio;
    const line = lines[state.dialogCount % lines.length];
    setDialog(line.who, line.line, 3.5);
  }

  // v2 — buy a refit upgrade between legs. Returns true when bought.
  function buyUpgrade(id) {
    const def = UPGRADES.find((u) => u.id === id);
    if (!def) return false;
    const level = state.upgrades[id] ?? 0;
    if (level >= def.max) return false;
    const price = def.base + def.step * level;
    if (state.earnings < price) return false;
    state.earnings -= price;
    state.upgrades[id] = level + 1;
    if (id === 'hull') state.hull = Math.min(100, state.hull + 40);
    setDialog('SARI (co-pilot)', `${def.name} terpasang! Level ${level + 1}.`, 3);
    return true;
  }

  function legDef() {
    return LEGS[Math.min(state.leg, LEGS.length - 1)];
  }

  function setEvent(type, data) {
    state.lastEvent = type;
    state.eventData = data ?? null;
  }

  function announce(text, seconds) {
    state.message = text;
    state.messageTimer = seconds;
  }

  function resetForLeg(legIndex, keepScore) {
    const leg = LEGS[Math.min(legIndex, LEGS.length - 1)];
    state.leg = legIndex;
    state.x = 0;
    state.z = 0;
    state.alt = 130;
    state.heading = 0;
    state.pitch = 0;
    state.roll = 0;
    state.speed = 58;
    state.throttle = 0.72;
    state.fuel = PLANE.fuelCapacity + state.upgrades.fuel * 20;
    state.legTime = 0;
    state.verticalSpeed = 0;
    state.stalled = false;
    state.landed = false;
    state.onGround = false;
    state.ringsHit = 0;
    state.ringsTotal = leg.rings;
    state.combo = 0;
    state.delivered = 0;
    state.smoothLanding = false;
    state.crashedThisLeg = false;
    state.manifest = manifestFor(legIndex);
    state.goals = goalsFor(legIndex);
    const takeoff = DIALOGS.takeoff[legIndex % DIALOGS.takeoff.length];
    setDialog(takeoff.who, takeoff.line, 5);
    if (!keepScore) {
      state.score = 0;
      state.totalTime = 0;
      state.lives = PLANE.lives;
      state.hull = PLANE.hull;
      state.earnings = 0;
      state.lastPay = 0;
      state.lastPayLabel = '';
      state.combo = 0;
      state.streak = 0;
      state.bestStreak = 0;
      state.upgrades = { fuel: 0, hull: 0, engine: 0 };
    }
    announce(`${leg.from} → ${leg.to} — ${leg.rings} rings, then land`, 4);
  }

  resetForLeg(0, false);

  return {
    state,
    legDef,
    resetForLeg,
    announce,
    radio,
    buyUpgrade,

    // One fixed step. `control` is { roll, pitch, throttleUp, throttleDown, brake }
    // in -1..1 / booleans; `terrain` answers ground height at (x, z); `rings` is
    // the live ring list with { x, y, z, passed, missed } and `runway` the strip.
    step(control, terrain, rings, runway) {
      const leg = legDef();
      const dt = STEP;
      state.legTime += dt;
      state.totalTime += dt;
      if (state.messageTimer > 0) state.messageTimer -= dt;
      if (state.dialog && state.dialog.timer > 0) state.dialog.timer -= dt;

      // --- throttle and speed -------------------------------------------------
      if (control.throttleUp) state.throttle = Math.min(1, state.throttle + dt * 0.45);
      if (control.throttleDown) state.throttle = Math.max(0, state.throttle - dt * 0.6);
      // v2 refit: turbo engine adds +6 kt per level to the target speed.
      let targetSpeed = PLANE.minSpeed + state.throttle * (PLANE.cruiseSpeed - PLANE.minSpeed) + state.upgrades.engine * 6;
      if (control.brake) targetSpeed = Math.min(targetSpeed, 30);
      const accel = state.speed < targetSpeed ? 9 : 13;
      state.speed += Math.max(-accel * dt, Math.min(accel * dt, targetSpeed - state.speed));

      // --- attitude -----------------------------------------------------------
      const rollTarget = control.roll * PLANE.maxRoll;
      const pitchTarget = control.pitch * PLANE.maxPitch;
      state.roll += Math.max(-PLANE.rollRate * dt, Math.min(PLANE.rollRate * dt, rollTarget - state.roll));
      state.pitch += Math.max(-PLANE.pitchRate * dt, Math.min(PLANE.pitchRate * dt, pitchTarget - state.pitch));

      // --- wind: steady crosswind plus a slow gust that breathes ---------------
      state.gustPhase += dt * 0.45;
      const gust = Math.sin(state.gustPhase) * leg.gust + Math.sin(state.gustPhase * 2.7) * leg.gust * 0.4;
      const windSpeed = leg.wind + gust;
      state.windX = Math.sin(leg.windDir) * windSpeed;
      state.windZ = Math.cos(leg.windDir) * windSpeed;

      // --- motion --------------------------------------------------------------
      state.stalled = state.speed < PLANE.stallSpeed && !state.onGround;
      const climb = state.stalled
        ? -PLANE.sinkRate * 1.6
        : state.speed * Math.sin(state.pitch) * 0.9 + (state.throttle - 0.55) * PLANE.climbRate * 0.35;
      const prevAlt = state.alt;
      state.alt += climb * dt;
      state.verticalSpeed = (state.alt - prevAlt) / dt;
      // A right bank (roll > 0) turns the nose right: heading grows toward east.
      state.heading += Math.sin(state.roll) * PLANE.turnRate * (state.speed / PLANE.cruiseSpeed) * dt;
      const forwardX = Math.sin(state.heading);
      const forwardZ = Math.cos(state.heading);
      state.x += (forwardX * state.speed + state.windX * 0.35) * dt;
      state.z += (forwardZ * state.speed + state.windZ * 0.35) * dt;
      if (state.onGround) {
        state.speed = Math.max(0, state.speed - 14 * dt);
        if (state.speed < 2) state.speed = 0;
        state.roll *= 0.8;
        state.pitch *= 0.8;
      }

      // --- fuel ------------------------------------------------------------------
      if (!state.onGround) {
        state.fuel -= (0.12 + state.throttle * PLANE.fuelBurn) * dt;
        if (state.fuel <= 20 && state.fuel + (0.12 + state.throttle * PLANE.fuelBurn) * dt > 20) {
          setEvent(EVENT_FUEL_LOW, { fuel: state.fuel });
          announce('LOW FUEL — land soon', 3);
        }
        if (state.fuel <= 0) {
          state.fuel = 0;
          state.throttle = 0;
        }
      }

      // --- rings -------------------------------------------------------------------
      for (const ring of rings) {
        if (ring.passed || ring.missed) continue;
        const dz = ring.z - state.z;
        if (dz < -RING_PASS_DISTANCE) {
          ring.missed = true;
          state.combo = 0;
          setEvent(EVENT_RING_MISSED, { ring: ring.index });
          announce(`Ring ${ring.index + 1} missed`, 2);
          continue;
        }
        const dx = ring.x - state.x;
        const dy = ring.y - state.alt;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (dist < RING_RADIUS + 4) {
          ring.passed = true;
          state.ringsHit += 1;
          state.combo += 1;
          const bonus = leg.ringBonus + Math.round(state.speed * 0.4);
          state.score += bonus;
          // v2 — deliver the manifest item tied to this ring: fare always,
          // tip only when still inside the item's due time (on-time streak).
          const item = state.manifest.find((m) => m.ring === ring.index && m.status === 'pending');
          if (item) {
            const onTime = state.legTime <= item.due;
            const tip = onTime ? item.tip : 0;
            const paid = item.fare + tip;
            item.status = 'delivered';
            item.paid = paid;
            state.delivered += 1;
            state.earnings += paid;
            state.lastPay = paid;
            state.lastPayLabel = `${item.name} — ${item.cargo}`;
            if (onTime) {
              state.streak += 1;
              state.bestStreak = Math.max(state.bestStreak, state.streak);
            } else {
              state.streak = 0;
            }
            const cargoGoal = state.goals.find((g) => g.id === 'cargo');
            if (cargoGoal) {
              cargoGoal.progress = state.delivered;
              if (state.delivered >= cargoGoal.target) cargoGoal.done = true;
            }
            setDialog(item.name.toUpperCase(), `"${item.cargo}" diterima! +Rp${paid.toLocaleString('id-ID')}${onTime ? ' (tepat waktu, tip!)' : ''}`, 4);
          }
          setEvent(EVENT_RING, { ring: ring.index, bonus });
          announce(`RING ${ring.index + 1}/${leg.rings}  +${bonus}`, 1.6);
        }
      }

      // --- runway landing ----------------------------------------------------------
      if (runway && !state.landed) {
        const relZ = state.z - runway.z;
        const relX = state.x - runway.x;
        const overStrip = Math.abs(relX) < RUNWAY_WIDTH / 2 + 6 && relZ > -RUNWAY_LENGTH / 2 && relZ < RUNWAY_LENGTH / 2;
        const ground = terrain(state.x, state.z);
        if (overStrip && state.alt <= ground + 3.5 && state.speed < 52 && Math.abs(state.verticalSpeed) < 9) {
          state.landed = true;
          state.onGround = true;
          state.alt = ground + 1.2;
          state.pitch = 0;
          state.roll = 0;
          const smooth = Math.max(0, 1 - Math.abs(state.verticalSpeed) / 9);
          const timeBonus = Math.max(0, Math.round((leg.parTime - state.legTime) * 2));
          const bonus = leg.landingBonus + Math.round(smooth * 300) + timeBonus;
          state.score += bonus;
          // v2 — landing pay in rupiah + goals: smooth landing and no-damage.
          const landingPay = bonus * 100;
          state.earnings += landingPay;
          state.lastPay = landingPay;
          state.lastPayLabel = `Landing ${leg.to}`;
          state.smoothLanding = smooth >= 0.7;
          const smoothGoal = state.goals.find((g) => g.id === 'smooth');
          if (smoothGoal && state.smoothLanding) { smoothGoal.done = true; smoothGoal.progress = 1; }
          const hullGoal = state.goals.find((g) => g.id === 'hull');
          if (hullGoal && !state.crashedThisLeg && state.hull >= 100) { hullGoal.done = true; hullGoal.progress = 1; }
          const landingLine = DIALOGS.landing[state.leg % DIALOGS.landing.length];
          setDialog(landingLine.who, `${landingLine.line} (+Rp${landingPay.toLocaleString('id-ID')})`, 5);
          setEvent(EVENT_LANDED, { leg: state.leg, bonus, smooth });
          announce(`TOUCHDOWN — ${leg.to}!  +${bonus}`, 3);
        }
      }

      // --- terrain collision ---------------------------------------------------------
      const ground = terrain(state.x, state.z);
      if (state.alt <= ground + 1.5 && !state.onGround) {
        const overRunway = runway
          && Math.abs(state.x - runway.x) < RUNWAY_WIDTH / 2 + 6
          && state.z - runway.z > -RUNWAY_LENGTH / 2
          && state.z - runway.z < RUNWAY_LENGTH / 2;
        if (overRunway && state.speed < 52 && Math.abs(state.verticalSpeed) < 9) {
          // Handled above as a landing; if we are here the approach was too hot.
          state.landed = true;
          state.onGround = true;
          state.alt = ground + 1.2;
          state.score += Math.round(leg.landingBonus * 0.4);
          setEvent(EVENT_LANDED, { leg: state.leg, bonus: Math.round(leg.landingBonus * 0.4), smooth: 0.2 });
          announce(`Rough landing — ${leg.to}  +${Math.round(leg.landingBonus * 0.4)}`, 3);
        } else {
          state.hull -= 34;
          state.lives -= 1;
          state.combo = 0;
          state.streak = 0;
          state.crashedThisLeg = true;
          state.alt = ground + 1.5;
          setEvent(EVENT_CRASH, { ground, hull: state.hull, lives: state.lives });
          announce(state.lives > 0 ? 'CRASH — hull damaged!' : 'CRASH — no planes left', 3);
          setDialog('SARI (co-pilot)', 'Aduh! Hull rusak — kargo masih selamat, terbang hati-hati!', 4);
        }
      }
      if (state.alt < 2) state.alt = 2;

      // --- leg complete: landed and rolled out ---------------------------------------
      if (state.landed && state.onGround && state.speed < 3) {
        setEvent(EVENT_LEG_COMPLETE, { leg: state.leg, score: state.score });
      }
      return state.lastEvent;
    },

    consumeEvent() {
      const event = state.lastEvent;
      const data = state.eventData;
      state.lastEvent = null;
      state.eventData = null;
      return event ? { type: event, data } : null;
    },

    // Respawn at the last passed ring (or the start) after a crash.
    respawn(rings) {
      let at = { x: 0, z: -40, y: 130 };
      for (let i = rings.length - 1; i >= 0; i -= 1) {
        if (rings[i].passed) {
          at = { x: rings[i].x, z: rings[i].z - 60, y: rings[i].y };
          break;
        }
      }
      state.x = at.x;
      state.z = at.z;
      state.alt = Math.max(90, at.y);
      state.heading = 0;
      state.pitch = 0;
      state.roll = 0;
      state.speed = 55;
      state.throttle = 0.7;
      state.fuel = Math.max(state.fuel, 45);
      state.hull = Math.max(state.hull, 34);
      announce('Back in the air — fly careful', 2.5);
    },
  };
}
