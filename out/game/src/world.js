// The archipelago: a seeded heightfield of volcanic islands in a wide sea, the
// ring course that winds between them, and the destination runway island. The
// terrain is a pure function of (x, z), so the flight model, the renderer and
// the screenshot autopilot all agree on where the ground is.
import { LEGS, RING, RUNWAY } from './config.js';
import { createRandom } from './random.js';

const ISLAND_SPACING = 420;
const COURSE_WANDER = 260;

function smooth(t) {
  return t * t * (3 - 2 * t);
}

export function createWorld(seed) {
  const random = createRandom(seed);
  const islands = [];
  // A chain of islands marching north, one every ~420 m, alternating sides so
  // the course weaves. A few are volcanoes: tall cones with a crater ring.
  for (let i = 0; i < 46; i += 1) {
    const z = 300 + i * ISLAND_SPACING + random.range(-90, 90);
    const side = i % 2 === 0 ? -1 : 1;
    const x = side * random.range(120, 560) * (i % 5 === 0 ? 0.4 : 1);
    const radius = random.range(120, 300);
    const height = random.range(28, 150);
    const volcano = random.next() < 0.22;
    islands.push({
      x, z, radius, height,
      volcano,
      peak: volcano ? height * 1.7 : height,
      seed: random.next() * 100,
    });
  }
  // The home island under the start line and the destination island far north.
  islands.push({ x: 0, z: -160, radius: 320, height: 60, volcano: false, peak: 60, seed: 7 });
  islands.push({ x: 0, z: 5200, radius: 420, height: 55, volcano: false, peak: 55, seed: 11 });

  const clouds = [];
  for (let i = 0; i < 42; i += 1) {
    clouds.push({
      x: random.range(-1400, 1400),
      y: random.range(230, 340),
      z: random.range(-400, 5600),
      scale: random.range(50, 120),
      speed: random.range(1, 4),
    });
  }
  const birds = [];
  for (let i = 0; i < 14; i += 1) {
    birds.push({
      x: random.range(-300, 300),
      y: random.range(90, 180),
      z: random.range(200, 4200),
      phase: random.range(0, Math.PI * 2),
      speed: random.range(6, 12),
    });
  }

  function groundHeight(x, z) {
    let height = 0;
    for (const island of islands) {
      const dx = (x - island.x) / island.radius;
      const dz = (z - island.z) / (island.radius * 1.25);
      const d2 = dx * dx + dz * dz;
      if (d2 >= 1) continue;
      const fall = 1 - smooth(Math.min(1, d2));
      const bump = 0.75 + 0.25 * Math.sin(island.seed + x * 0.02) * Math.cos(island.seed + z * 0.017);
      let h = island.peak * fall * fall * bump;
      if (island.volcano && d2 < 0.05) h *= 0.55; // crater dip
      if (h > height) height = h;
    }
    return height;
  }

  function buildCourse(legIndex) {
    const leg = LEGS[Math.min(legIndex, LEGS.length - 1)];
    const courseRandom = createRandom(seed * 31 + legIndex * 101 + 7);
    const rings = [];
    const startZ = 260;
    const endZ = 260 + (leg.rings + 1) * 430;
    for (let i = 0; i < leg.rings; i += 1) {
      const t = (i + 1) / (leg.rings + 1);
      const z = startZ + t * (endZ - startZ);
      const x = Math.sin(t * Math.PI * 2.2 + legIndex) * COURSE_WANDER * (0.5 + t * 0.5)
        + courseRandom.range(-70, 70);
      const ground = groundHeight(x, z);
      const y = Math.max(75, ground + courseRandom.range(55, 130));
      rings.push({ index: i, x, y, z, passed: false, missed: false });
    }
    const runway = {
      x: Math.sin(Math.PI * 2.2 + legIndex) * COURSE_WANDER * 0.9,
      z: endZ + 420,
      y: 0,
      heading: 0,
      length: RUNWAY.length,
      width: RUNWAY.width,
    };
    // The destination gets its own flat-topped island, so the runway never
    // floats on open sea and never lands on a volcano slope.
    const hasIsland = islands.some((island) => Math.hypot(island.x - runway.x, island.z - runway.z) < 60);
    if (!hasIsland) {
      islands.push({
        x: runway.x, z: runway.z, radius: 400, height: 22,
        volcano: false, peak: 22, seed: 99 + legIndex,
      });
    }
    runway.y = groundHeight(runway.x, runway.z);
    return { rings, runway, endZ };
  }

  let course = buildCourse(0);

  return {
    islands,
    clouds,
    birds,
    groundHeight,
    get rings() {
      return course.rings;
    },
    get runway() {
      return course.runway;
    },
    get endZ() {
      return course.endZ;
    },
    nextRing() {
      return course.rings.find((ring) => !ring.passed && !ring.missed) ?? null;
    },
    ringsRemaining() {
      return course.rings.filter((ring) => !ring.passed && !ring.missed).length;
    },
    startLeg(legIndex) {
      course = buildCourse(legIndex);
      return course;
    },
    // Clouds drift slowly with the wind; birds flap past the course.
    animate(dt, time) {
      for (const cloud of clouds) {
        cloud.x += cloud.speed * dt;
        if (cloud.x > 1600) cloud.x = -1600;
      }
      for (const bird of birds) {
        bird.z -= bird.speed * dt;
        bird.x += Math.sin(time * 0.7 + bird.phase) * dt * 6;
        if (bird.z < -300) {
          bird.z = 4400;
          bird.x = (bird.x + 600) % 600 - 300;
        }
      }
    },
    ringRadius: RING.radius,
  };
}
