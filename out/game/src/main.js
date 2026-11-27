// Boot and the one loop, v4 — the flight model is unchanged from v2/v3
// (fixed 1/60 s steps, rings, runway, economy, manifest, refits), only the
// renderer is new: render3d.js paints a real Three.js WebGL world and a
// crisp 2D HUD overlay on top of it. The game moves between five screens:
// title, play, paused, leg complete and game over.
//
// ?seed=N fixes the archipelago. ?shot=cover|ring|approach|storm (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { BEST_KEY, LEGS, STEP } from './config.js';
import { createWorld } from './world.js';
import { EVENT_CRASH, EVENT_LANDED, EVENT_LEG_COMPLETE, EVENT_RING, createFlight } from './flight.js';
import { ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, ACTION_RESTART, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer, SCREEN_LEG, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render3d.js';
import { autopilot, stageShot } from './shots.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(seed);
const flight = createFlight(seed);
const renderer = createRenderer(canvas);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, flight, world);
  let painted = 0;
  function paint() {
    renderer.draw({ flight: flight.state, world }, scene.screen, scene.best, 12, {});
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  let time = 0;
  let crashTimer = 0;
  let legBonus = 0;
  let demoMode = true;
  let routeOverlay = false; // v2 — TAB toggles the big route map

  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    world.startLeg(0);
    flight.resetForLeg(0, false);
    screen = SCREEN_PLAY;
    demoMode = false;
    crashTimer = 0;
    announce(`Playing. ${flight.state.lives} lives. Fly the rings, then land.`);
    audio.unlock();
    audio.click();
  }

  function endGame() {
    screen = SCREEN_OVER;
    if (flight.state.score > best) {
      best = flight.state.score;
      saveBest(best);
    }
    announce(`Flight over. Score ${flight.state.score}. Best ${best}.`);
    audio.crash();
  }

  function nextLeg() {
    if (flight.state.leg + 1 >= LEGS.length) {
      startGame();
      return;
    }
    const nextIndex = flight.state.leg + 1;
    world.startLeg(nextIndex);
    flight.resetForLeg(nextIndex, true);
    screen = SCREEN_PLAY;
    announce(`${LEGS[nextIndex].name} — fly the rings, then land.`);
    audio.click();
  }

  function handleEvent(event) {
    if (!event) return;
    if (event.type === EVENT_RING) audio.ring();
    if (event.type === EVENT_LANDED) {
      legBonus = event.data?.bonus ?? 0;
      audio.land();
    }
    if (event.type === EVENT_CRASH) {
      audio.crash();
      if (event.data?.lives > 0) {
        crashTimer = 1.4;
      } else {
        endGame();
      }
    }
    if (event.type === EVENT_LEG_COMPLETE) {
      screen = SCREEN_LEG;
      announce(`Landed at ${LEGS[flight.state.leg].to}. Press Enter for the next leg.`);
    }
  }

  function stepWorld(dt) {
    world.animate(dt, time);
    const control = {
      roll: input.roll(),
      pitch: input.pitch(),
      throttleUp: input.throttleUp(),
      throttleDown: input.throttleDown(),
      brake: input.brake(),
    };
    flight.step(control, world.groundHeight, world.rings, world.runway);
    handleEvent(flight.consumeEvent());
    audio.update(flight.state.throttle, flight.state.speed / 95, !flight.state.onGround);
  }

  function stepDemo(dt) {
    // The title screen flies itself: the autopilot threads rings forever.
    world.animate(dt, time);
    const next = world.nextRing();
    const target = next ?? { x: world.runway.x, y: 90, z: world.runway.z };
    const control = autopilot(flight, world, target, 58);
    flight.step(control, world.groundHeight, world.rings, world.runway);
    const event = flight.consumeEvent();
    if (event && event.type === EVENT_LEG_COMPLETE) {
      world.startLeg(0);
      flight.resetForLeg(0, false);
    }
    // The demo never sits wrecked on a mountainside: a crash puts the plane
    // straight back at the last ring it cleared, so the title always shows
    // flying.
    if (event && event.type === EVENT_CRASH) {
      flight.respawn(world.rings);
    }
    if (flight.state.lives <= 0) {
      world.startLeg(0);
      flight.resetForLeg(0, false);
    }
  }

  function frame(now) {
    const elapsed = Math.min(MAX_FRAME, (now - last) / 1000);
    last = now;
    time += elapsed;
    const pressed = input.takePressed();
    if (pressed.has(ACTION_MUTE)) audio.setMuted(!audio.isMuted());
    if (pressed.has(ACTION_RESTART) && screen !== SCREEN_TITLE) startGame();
    if (pressed.has('Tab') && screen === SCREEN_PLAY) routeOverlay = !routeOverlay;
    if (pressed.has('e') && screen === SCREEN_PLAY) flight.radio();
    // v2 — refit: buy upgrades with earned rupiah on the leg-complete screen.
    if (screen === SCREEN_LEG) {
      if (pressed.has('1')) flight.buyUpgrade('fuel');
      if (pressed.has('2')) flight.buyUpgrade('hull');
      if (pressed.has('3')) flight.buyUpgrade('engine');
    }
    if (pressed.has(ACTION_PAUSE)) {
      if (screen === SCREEN_PLAY) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      } else if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    }
    if (pressed.has(ACTION_CONFIRM)) {
      audio.unlock();
      if (screen === SCREEN_TITLE) startGame();
      else if (screen === SCREEN_OVER) startGame();
      else if (screen === SCREEN_LEG) nextLeg();
    }

    if (screen === SCREEN_TITLE) {
      accumulator += elapsed;
      while (accumulator >= STEP) {
        stepDemo(STEP);
        accumulator -= STEP;
      }
    } else if (screen === SCREEN_PLAY) {
      if (crashTimer > 0) {
        crashTimer -= elapsed;
        if (crashTimer <= 0) flight.respawn(world.rings);
      } else {
        accumulator += elapsed;
        while (accumulator >= STEP) {
          stepWorld(STEP);
          accumulator -= STEP;
        }
      }
    }
    // Paused, leg-complete and game-over screens hold the last frame.

    renderer.draw(
      { flight: flight.state, world },
      screen,
      best,
      time,
      { bonus: legBonus, routeOverlay },
    );
    requestAnimationFrame(frame);
  }

  canvas.addEventListener('mousedown', () => {
    audio.unlock();
    if (screen === SCREEN_TITLE) startGame();
    else if (screen === SCREEN_OVER) startGame();
    else if (screen === SCREEN_LEG) nextLeg();
  });

  announce('Nusantara Air Courier. Press Enter to fly.');
  requestAnimationFrame(frame);
  // demoMode is only read by startGame (it clears it); kept so the title
  // autopilot's intent stays visible in the code, not as a hidden flag.
  void demoMode;
}

if (shot) runShot(shot);
else runGame();
