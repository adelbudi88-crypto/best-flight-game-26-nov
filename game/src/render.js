// Every pixel the player sees: sky, sea and islands in perspective, the rings
// and the runway, the plane itself, the slim tape HUD and the mission bar.
// The world is drawn far-to-near so nearer terrain covers farther, and every
// number on the panel comes from the live flight state — nothing here is
// decoration that pretends to be an instrument.
//
// v3 — CINEMATIC REGRADE: one dramatic light per leg (golden morning, sunset,
// storm dusk), slope-shaded terrain with fine noise instead of the flat
// checker, a sun-glitter path on the sea, soft radial-gradient clouds plus a
// horizon cloud bank, bigger volcano smoke, and a redrawn plane with real
// volume and nav lights. The HUD went on a diet: slim speed/altitude tapes
// on the screen edges, a slim compass, a 96 px instrument strip with engine
// bars and a round radar minimap, narrow side panels — the world now fills
// ~75% of the frame. Gates carry in-world labels ("G-02 · 480m"), the next
// ring glows bigger, PAPI lights guard the approach, and a mission-brief bar
// tells the story at the bottom.
import { CAMERA, KT, LEGS, PALETTES, PLACES, PLANE, RING, ROUTE_STOPS, RUNWAY, UPGRADES, VIEW, rpShort } from './config.js';
import { createCamera } from './project.js';
import { createRandom } from './random.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_LEG = 'leg';

const ROW_Z = [10, 22, 38, 58, 82, 110, 142, 178, 218, 262, 310, 362, 418, 478, 542, 610, 682, 758, 838, 922, 1010];
const COL_STEP = 90;
const COLS = 15;
const PANEL_H = 96;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

// Mix two #rrggbb colours and return numeric channels; the caller formats.
function mixChannels(a, b, t) {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  return [
    ((pa >> 16) & 255) * (1 - t) + ((pb >> 16) & 255) * t,
    ((pa >> 8) & 255) * (1 - t) + ((pb >> 8) & 255) * t,
    (pa & 255) * (1 - t) + (pb & 255) * t,
  ];
}

function mixHex(a, b, t) {
  const [r, g, bl] = mixChannels(a, b, t);
  return `rgb(${Math.round(r)},${Math.round(g)},${Math.round(bl)})`;
}

// v3 — slope shading: `shade` comes from the height gradient across the quad
// (sun low in the west, so east- and north-facing slopes go dark), times a
// fine deterministic noise ripple that replaces the old 90 m checker.
function terrainColor(height, palette, depth, shade) {
  let base;
  if (height <= 0.6) base = palette.sea;
  else if (height <= 3) base = palette.sand;
  else if (height <= 26) base = palette.grass;
  else if (height <= 70) base = palette.forest;
  else if (height <= 120) base = palette.rock;
  else base = palette.snow;
  const fog = clamp(depth * palette.fog, 0, 0.85);
  const [r, g, b] = mixChannels(base, palette.skyLow, fog);
  return `rgb(${Math.round(r * shade)},${Math.round(g * shade)},${Math.round(b * shade)})`;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const camera = createCamera();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = VIEW.width * dpr;
  canvas.height = VIEW.height * dpr;
  ctx.scale(dpr, dpr);

  function drawQuad(p1, p2, p3, p4, fill) {
    if (!p1 || !p2 || !p3 || !p4) return;
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.lineTo(p3.x, p3.y);
    ctx.lineTo(p4.x, p4.y);
    ctx.closePath();
    ctx.fill();
  }

  function sunScreenX(plane) {
    return VIEW.width * 0.68 - Math.sin(plane.heading) * 60;
  }

  function horizonY(plane) {
    return VIEW.height * 0.52 - plane.pitch * 260;
  }

  function drawSky(palette, plane) {
    const grad = ctx.createLinearGradient(0, 0, 0, VIEW.height * 0.62);
    grad.addColorStop(0, palette.skyTop);
    grad.addColorStop(0.45, palette.skyMid);
    grad.addColorStop(0.75, mixHex(palette.skyMid, palette.skyLow, 0.55));
    grad.addColorStop(1, palette.skyLow);
    ctx.fillStyle = grad;
    // The sky fills the whole frame; the sea is painted over it below the horizon.
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    // Sun: low and warm, drifting slowly with the heading so it stays put.
    // v3 — height and size come from the palette: the sunset sun sits low
    // and big with a wide glow, the storm sun is a pale disc behind cloud.
    const sunX = sunScreenX(plane);
    const sunY = VIEW.height * palette.sunElev;
    const glowR = palette.sunSize * 5;
    const glow = ctx.createRadialGradient(sunX, sunY, 4, sunX, sunY, glowR);
    glow.addColorStop(0, palette.sunGlow);
    glow.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(sunX - glowR, sunY - glowR, glowR * 2, glowR * 2);
    ctx.save();
    if (palette.lightning) ctx.globalAlpha = 0.55;
    ctx.fillStyle = palette.sun;
    ctx.beginPath();
    ctx.arc(sunX, sunY, palette.sunSize, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawFarIslands(world, plane, palette) {
    for (const island of world.islands) {
      const dz = island.z - plane.z;
      if (dz < 950 || dz > 2600) continue;
      const dx = island.x - plane.x;
      if (Math.abs(dx) > 1600) continue;
      const peak = camera.project(island.x, island.peak, island.z, plane);
      const baseL = camera.project(island.x - island.radius, 0, island.z, plane);
      const baseR = camera.project(island.x + island.radius, 0, island.z, plane);
      if (!peak || !baseL || !baseR) continue;
      const haze = clamp(peak.depth * palette.fog, 0, 0.8);
      ctx.fillStyle = mixHex(palette.forest, palette.skyLow, haze);
      ctx.beginPath();
      ctx.moveTo(baseL.x, baseL.y);
      ctx.lineTo(peak.x, peak.y);
      ctx.lineTo(baseR.x, baseR.y);
      ctx.closePath();
      ctx.fill();
      // v3 — facet shading: the slope away from the sun goes dark, the
      // sunlit slope gets a warm kiss, so far islands read as solid rock.
      const midX = (baseL.x + baseR.x) / 2;
      const midY = (baseL.y + baseR.y) / 2;
      ctx.fillStyle = 'rgba(15, 20, 40, 0.22)';
      ctx.beginPath();
      ctx.moveTo(baseL.x, baseL.y);
      ctx.lineTo(peak.x, peak.y);
      ctx.lineTo(midX, midY);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(255, 220, 160, 0.10)';
      ctx.beginPath();
      ctx.moveTo(midX, midY);
      ctx.lineTo(peak.x, peak.y);
      ctx.lineTo(baseR.x, baseR.y);
      ctx.closePath();
      ctx.fill();
      if (island.volcano) {
        ctx.fillStyle = mixHex(palette.snow, palette.skyLow, haze);
        ctx.beginPath();
        ctx.moveTo(peak.x - (baseR.x - baseL.x) * 0.08, peak.y + (baseL.y - peak.y) * 0.22);
        ctx.lineTo(peak.x, peak.y);
        ctx.lineTo(peak.x + (baseR.x - baseL.x) * 0.08, peak.y + (baseL.y - peak.y) * 0.22);
        ctx.closePath();
        ctx.fill();
      }
    }
  }

  function drawTerrain(world, plane, palette) {
    // Sea base below the horizon line, then the grid far-to-near.
    const hY = horizonY(plane);
    ctx.fillStyle = palette.sea;
    ctx.fillRect(0, hY, VIEW.width, VIEW.height - hY);
    const rows = ROW_Z.map((offset) => plane.z + offset);
    for (let r = rows.length - 1; r >= 0; r -= 1) {
      const zFar = rows[r];
      const zNear = r === 0 ? plane.z - 30 : rows[r - 1];
      const dzStep = Math.max(1, zFar - zNear);
      for (let c = 0; c < COLS; c += 1) {
        const xLeft = plane.x - COLS * COL_STEP / 2 + c * COL_STEP;
        const xRight = xLeft + COL_STEP;
        const h1 = world.groundHeight(xLeft, zFar);
        const h2 = world.groundHeight(xRight, zFar);
        const h3 = world.groundHeight(xRight, zNear);
        const h4 = world.groundHeight(xLeft, zNear);
        const p1 = camera.project(xLeft, h1, zFar, plane);
        const p2 = camera.project(xRight, h2, zFar, plane);
        const p3 = camera.project(xRight, h3, zNear, plane);
        const p4 = camera.project(xLeft, h4, zNear, plane);
        if (!p1 || !p2 || !p3 || !p4) continue;
        const height = Math.max(h1, h2, h3, h4);
        const depth = (p1.depth + p2.depth + p3.depth + p4.depth) / 4;
        // v3 — slope shading from the height gradient across this quad,
        // plus a fine deterministic noise ripple (no more checker).
        const slopeX = ((h2 + h3) - (h1 + h4)) / (2 * COL_STEP);
        const slopeZ = ((h3 + h4) - (h1 + h2)) / (2 * dzStep);
        let shade = 1 - slopeX * 1.1 - slopeZ * 0.7;
        shade = clamp(shade, 0.68, 1.22);
        const ripple = 0.96 + 0.04 * Math.sin(xLeft * 0.11 + zFar * 0.073) * Math.sin(xLeft * 0.031 - zFar * 0.053);
        drawQuad(p1, p2, p3, p4, terrainColor(height, palette, depth, shade * ripple));
      }
    }
    drawGlitter(palette, plane, hY);
  }

  // v3 — the sun's glitter path on the sea: short bright dashes in a widening
  // triangle under the sun, from the horizon toward the camera. Deterministic:
  // every dash is a pure function of its index and the paint time.
  function drawGlitter(palette, plane, hY) {
    if (!palette.glitter) return;
    const sunX = sunScreenX(plane);
    ctx.save();
    ctx.lineWidth = 2;
    for (let i = 0; i < 46; i += 1) {
      const t = i / 46;
      const y = hY + 12 + t * t * 210;
      const spread = 26 + t * 190;
      const hash = (((i * 2654435761) % 1000) + 1000) % 1000 / 1000;
      const x = sunX + (hash - 0.5) * 2 * spread;
      const len = 8 + hash * 30 * (1 - t * 0.5);
      const alpha = 0.22 * (1 - t) * (0.6 + 0.4 * Math.sin(i * 2.7 + 12 * 0.8));
      ctx.strokeStyle = `rgba(255, 240, 190, ${alpha.toFixed(3)})`;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + len, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  function cloudFill(palette, alpha) {
    return palette.cloud.replace(/[\d.]+\)$/, `${alpha})`);
  }

  function drawClouds(world, plane, palette, time) {
    for (const cloud of world.clouds) {
      const dz = cloud.z - plane.z;
      if (dz < -100 || dz > 1400) continue;
      const p = camera.project(cloud.x, cloud.y, cloud.z, plane);
      if (!p) continue;
      const size = cloud.scale * p.scale * 0.9;
      if (size < 4 || size > 900) continue;
      const alpha = clamp(1 - p.depth / 1500, 0.15, 0.9);
      // v3 — soft radial-gradient puffs instead of flat ellipses.
      const puffs = [
        [0, 0, 1], [-0.55, 0.08, 0.62], [0.55, 0.06, 0.58],
      ];
      for (const [ox, oy, s] of puffs) {
        const px = p.x + ox * size;
        const py = p.y + oy * size;
        const pr = size * s;
        const grad = ctx.createRadialGradient(px, py, 0, px, py, pr);
        grad.addColorStop(0, cloudFill(palette, alpha));
        grad.addColorStop(1, cloudFill(palette, 0));
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(px, py, pr, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // v3 — a cloud bank hugging the horizon, so the sky has a floor.
    const hY = horizonY(plane);
    for (let i = 0; i < 9; i += 1) {
      const px = 60 + i * 150 + (i % 3) * 40;
      const py = hY - 8 - (i % 4) * 12;
      const pr = 70 + (i % 3) * 30;
      const grad = ctx.createRadialGradient(px, py, 0, px, py, pr);
      grad.addColorStop(0, cloudFill(palette, 0.5));
      grad.addColorStop(1, cloudFill(palette, 0));
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(px, py, pr, 0, Math.PI * 2);
      ctx.fill();
    }
    void time;
  }

  function drawRunway(world, plane, palette) {
    const runway = world.runway;
    const dz = runway.z - plane.z;
    if (dz < -RUNWAY.length || dz > 1600) return;
    const halfW = runway.width / 2;
    const halfL = runway.length / 2;
    const corners = [
      camera.project(runway.x - halfW, runway.y + 0.4, runway.z - halfL, plane),
      camera.project(runway.x + halfW, runway.y + 0.4, runway.z - halfL, plane),
      camera.project(runway.x + halfW, runway.y + 0.4, runway.z + halfL, plane),
      camera.project(runway.x - halfW, runway.y + 0.4, runway.z + halfL, plane),
    ];
    if (corners.some((p) => !p)) return;
    drawQuad(corners[0], corners[1], corners[2], corners[3], '#3a3f46');
    // Centreline dashes.
    ctx.fillStyle = '#f5f5f0';
    for (let i = 0; i < 8; i += 1) {
      const z0 = runway.z - halfL + 12 + i * 30;
      const z1 = z0 + 14;
      const a = camera.project(runway.x - 1.2, runway.y + 0.6, z0, plane);
      const b = camera.project(runway.x + 1.2, runway.y + 0.6, z0, plane);
      const c = camera.project(runway.x + 1.2, runway.y + 0.6, z1, plane);
      const d = camera.project(runway.x - 1.2, runway.y + 0.6, z1, plane);
      drawQuad(a, b, c, d, '#f5f5f0');
    }
    // Threshold bars and edge lights.
    const edge = (side) => {
      for (let i = 0; i <= 10; i += 1) {
        const z = runway.z - halfL + (i / 10) * runway.length;
        const p = camera.project(runway.x + side * halfW, runway.y + 1, z, plane);
        if (!p) continue;
        ctx.fillStyle = '#ffb02e';
        ctx.beginPath();
        ctx.arc(p.x, p.y, clamp(90 / p.depth, 1, 5), 0, Math.PI * 2);
        ctx.fill();
      }
    };
    edge(-1);
    edge(1);
    // v3 — PAPI: four lights beside the threshold, white when high on the
    // glidepath, red when low, two-and-two when on it. The colour comes from
    // the real geometry: the angle from the plane to the threshold.
    const glideDeg = Math.atan2(plane.alt - runway.y, Math.max(1, dz)) * 180 / Math.PI;
    const papiColors = glideDeg > 3.0
      ? ['#ffffff', '#ffffff', '#ffffff', '#ffffff']
      : glideDeg >= 2.4
        ? ['#ffffff', '#ffffff', '#ff2a2a', '#ff2a2a']
        : ['#ff2a2a', '#ff2a2a', '#ff2a2a', '#ff2a2a'];
    for (let i = 0; i < 4; i += 1) {
      const p = camera.project(runway.x - halfW - 10 - i * 7, runway.y + 1.5, runway.z - halfL + 14, plane);
      if (!p) continue;
      ctx.save();
      ctx.shadowColor = papiColors[i];
      ctx.shadowBlur = 12;
      ctx.fillStyle = papiColors[i];
      ctx.beginPath();
      ctx.arc(p.x, p.y, clamp(140 / p.depth, 2.5, 7), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    // Windsocks and a tiny terminal beside the strip.
    const sock = camera.project(runway.x + halfW + 18, runway.y + 9, runway.z - halfL + 30, plane);
    if (sock) {
      ctx.strokeStyle = '#e8e8e8';
      ctx.lineWidth = Math.max(1, 60 / sock.depth);
      ctx.beginPath();
      ctx.moveTo(sock.x, sock.y + 26 * sock.scale * 0.4);
      ctx.lineTo(sock.x, sock.y);
      ctx.stroke();
      ctx.fillStyle = '#ff6b35';
      ctx.beginPath();
      ctx.moveTo(sock.x, sock.y);
      ctx.lineTo(sock.x + 16 * sock.scale * 0.4, sock.y + 3);
      ctx.lineTo(sock.x, sock.y + 6);
      ctx.closePath();
      ctx.fill();
    }
    void palette;
  }

  function drawRings(world, plane, time) {
    const sorted = [...world.rings].sort((a, b) => b.z - a.z);
    // v3 — the three nearest unpassed gates get in-world labels with distance.
    const upcoming = world.rings
      .filter((ring) => !ring.passed && !ring.missed)
      .sort((a, b) => (a.z - plane.z) - (b.z - plane.z))
      .slice(0, 3);
    const next = world.nextRing();
    for (const ring of sorted) {
      const dz = ring.z - plane.z;
      if (dz < -60 || dz > 1500) continue;
      const p = camera.project(ring.x, ring.y, ring.z, plane);
      if (!p) continue;
      const radius = RING.radius * p.scale;
      if (radius < 3 || radius > 1200) continue;
      const isNext = next && next.index === ring.index;
      const pulse = isNext ? 0.75 + 0.25 * Math.sin(time * 5) : 1;
      ctx.save();
      ctx.globalAlpha = clamp(1.15 - p.depth / 1400, 0.25, 1) * pulse;
      if (isNext) {
        ctx.shadowColor = '#22e6c8';
        ctx.shadowBlur = 34;
      }
      ctx.strokeStyle = ring.passed ? '#8a94a6' : isNext ? '#22e6c8' : '#ff9f2e';
      ctx.lineWidth = Math.max(2, radius * (isNext ? 0.17 : 0.14));
      ctx.beginPath();
      ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
      ctx.stroke();
      // v3 — the next ring gets a halo so it reads from far away.
      if (isNext) {
        ctx.shadowBlur = 0;
        ctx.globalAlpha = clamp(1.15 - p.depth / 1400, 0.25, 1) * 0.45 * pulse;
        ctx.strokeStyle = '#22e6c8';
        ctx.lineWidth = Math.max(1.5, radius * 0.06);
        ctx.beginPath();
        ctx.arc(p.x, p.y, radius * 1.18, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = clamp(1.15 - p.depth / 1400, 0.25, 1) * pulse;
      }
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = Math.max(1, radius * 0.03);
      ctx.beginPath();
      ctx.arc(p.x, p.y, radius * 0.82, 0, Math.PI * 2);
      ctx.stroke();
      // A light beam down to the ground so the next ring is findable.
      if (isNext) {
        const ground = camera.project(ring.x, world.groundHeight(ring.x, ring.z), ring.z, plane);
        if (ground) {
          ctx.strokeStyle = 'rgba(34, 230, 200, 0.5)';
          ctx.lineWidth = Math.max(1, radius * 0.05);
          ctx.beginPath();
          ctx.moveTo(p.x, p.y + radius);
          ctx.lineTo(ground.x, ground.y);
          ctx.stroke();
        }
      }
      // v3 — gate labels: "G-02 · 480m" on the three nearest gates.
      const labelled = upcoming.find((u) => u.index === ring.index);
      if (labelled && radius > 14) {
        const dist = Math.round(Math.hypot(ring.x - plane.x, ring.y - plane.alt, ring.z - plane.z));
        ctx.fillStyle = isNext ? '#eafffb' : '#ffd9a0';
        ctx.font = `bold ${Math.max(11, Math.min(18, radius * 0.22))}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(`G-${String(ring.index + 1).padStart(2, '0')} · ${dist}m`, p.x, p.y - radius - 12);
      }
      ctx.restore();
    }
  }

  function drawPalms(world, plane) {
    for (const island of world.islands) {
      const dz = island.z - plane.z;
      if (dz < 0 || dz > 900 || Math.abs(island.x - plane.x) > 800) continue;
      if (island.height < 8) continue;
      for (let i = 0; i < 5; i += 1) {
        const angle = island.seed + i * 1.7;
        const px = island.x + Math.cos(angle) * island.radius * 0.55;
        const pz = island.z + Math.sin(angle) * island.radius * 0.6;
        const py = world.groundHeight(px, pz);
        if (py < 2) continue;
        const p = camera.project(px, py, pz, plane);
        if (!p) continue;
        const h = 12 * p.scale;
        if (h < 2 || h > 90) continue;
        ctx.strokeStyle = '#6b4a2f';
        ctx.lineWidth = Math.max(1, h * 0.08);
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + h * 0.08, p.y - h);
        ctx.stroke();
        ctx.strokeStyle = '#2e7d46';
        ctx.lineWidth = Math.max(1, h * 0.06);
        for (let f = 0; f < 5; f += 1) {
          const a = -Math.PI / 2 + (f - 2) * 0.55;
          ctx.beginPath();
          ctx.moveTo(p.x + h * 0.08, p.y - h);
          ctx.quadraticCurveTo(
            p.x + h * 0.08 + Math.cos(a) * h * 0.5,
            p.y - h + Math.sin(a) * h * 0.4,
            p.x + h * 0.08 + Math.cos(a) * h * 0.85,
            p.y - h + Math.sin(a) * h * 0.75 + h * 0.25,
          );
          ctx.stroke();
        }
      }
    }
  }

  function drawBirds(world, plane, time) {
    for (const bird of world.birds) {
      const dz = bird.z - plane.z;
      if (dz < 0 || dz > 700) continue;
      const y = bird.y + Math.sin(time * 2 + bird.phase) * 4;
      const p = camera.project(bird.x, y, bird.z, plane);
      if (!p) continue;
      const size = clamp(140 / p.depth, 2, 14);
      const flap = Math.sin(time * 9 + bird.phase) * size * 0.5;
      ctx.strokeStyle = '#22282e';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(p.x - size, p.y - flap);
      ctx.quadraticCurveTo(p.x, p.y + size * 0.3, p.x + size, p.y - flap);
      ctx.stroke();
    }
  }

  function drawRain(palette, time, intensity) {
    if (intensity <= 0) return;
    ctx.strokeStyle = 'rgba(210, 225, 240, 0.42)';
    ctx.lineWidth = 1;
    for (let i = 0; i < intensity * 170; i += 1) {
      const x = ((i * 137.5 + time * 900) % (VIEW.width + 80)) - 40;
      const y = ((i * 89.3 + time * 1400) % (VIEW.height + 40)) - 20;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - 7, y + 26);
      ctx.stroke();
    }
    void palette;
  }

  // v3 — deterministic lightning: a bolt flashes for half a second every four
  // seconds (a pure function of the paint time, so the storm screenshot at
  // time=12 always catches one), each strike seeded by its cycle number.
  // Returns the screen-flash alpha for the overlay the caller paints.
  function drawLightning(plane, time) {
    const cycle = time % 4;
    if (cycle > 0.5) return 0;
    const rand = createRandom(Math.floor(time / 4) * 977 + 13);
    const startX = VIEW.width * (0.25 + rand.next() * 0.5);
    let x = startX;
    let y = 40 + rand.next() * 40;
    const points = [[x, y]];
    for (let i = 0; i < 7; i += 1) {
      x += rand.range(-45, 45);
      y += rand.range(45, 70);
      points.push([x, y]);
    }
    ctx.save();
    ctx.shadowColor = '#bcd2ff';
    ctx.shadowBlur = 20;
    ctx.strokeStyle = '#dfe9ff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i][0], points[i][1]);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.restore();
    void plane;
    return 0.16 * (1 - cycle / 0.5);
  }

  // v3 — the plane redrawn bigger and with volume: a shaded fuselage (bright
  // spine, dark flanks), red/green nav lights on the wingtips, a wider prop
  // blur disc and a harder shadow, so it reads as a machine, not paper.
  function drawPlane(plane, time) {
    const cx = VIEW.width / 2 + plane.roll * 46;
    const cy = 452 - plane.pitch * 90;
    // Canvas rotates clockwise for positive angles: a right bank rolls the
    // sprite clockwise, right wing down.
    const bank = plane.roll * 0.85;
    const propSpeed = 0.25 + plane.throttle * 0.9;
    const propAngle = time * 40 * propSpeed;
    // Shadow on the sea below, for height: it sits on the water under the
    // plane (above the instrument panel) and shrinks as the plane climbs.
    ctx.save();
    ctx.globalAlpha = clamp(0.34 - plane.alt / 900, 0.07, 0.34);
    ctx.fillStyle = '#06283f';
    ctx.beginPath();
    ctx.ellipse(cx + plane.roll * 30, 566, 110 - clamp(plane.alt / 6, 0, 66), 11, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(bank);
    // Tail wings.
    ctx.fillStyle = '#0f7a6e';
    ctx.beginPath();
    ctx.moveTo(-18, -72);
    ctx.lineTo(-110, -118);
    ctx.lineTo(-118, -100);
    ctx.lineTo(-20, -58);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(18, -72);
    ctx.lineTo(110, -118);
    ctx.lineTo(118, -100);
    ctx.lineTo(20, -58);
    ctx.closePath();
    ctx.fill();
    // Main wings, low and wide.
    ctx.fillStyle = '#f4f1e8';
    ctx.beginPath();
    ctx.moveTo(-20, -22);
    ctx.lineTo(-178, 32);
    ctx.lineTo(-166, 54);
    ctx.lineTo(-18, 32);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(20, -22);
    ctx.lineTo(178, 32);
    ctx.lineTo(166, 54);
    ctx.lineTo(18, 32);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ff7a1a';
    ctx.fillRect(-178, 32, 26, 8);
    ctx.fillRect(152, 32, 26, 8);
    // Nav lights: red port, green starboard, glowing.
    ctx.save();
    ctx.shadowColor = '#ff2a2a';
    ctx.shadowBlur = 12;
    ctx.fillStyle = '#ff2a2a';
    ctx.beginPath();
    ctx.arc(-180, 36, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowColor = '#22e65a';
    ctx.fillStyle = '#22e65a';
    ctx.beginPath();
    ctx.arc(180, 36, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // Fuselage: a tapered body, then a volume gradient over the same path —
    // bright spine down the middle, dark flanks — plus the teal cheatline.
    const fuselage = () => {
      ctx.beginPath();
      ctx.moveTo(0, -138);
      ctx.quadraticCurveTo(26, -88, 22, -12);
      ctx.quadraticCurveTo(19, 54, 9, 80);
      ctx.quadraticCurveTo(0, 90, -9, 80);
      ctx.quadraticCurveTo(-19, 54, -22, -12);
      ctx.quadraticCurveTo(-26, -88, 0, -138);
      ctx.closePath();
    };
    ctx.fillStyle = '#f4f1e8';
    fuselage();
    ctx.fill();
    const volume = ctx.createLinearGradient(-24, 0, 24, 0);
    volume.addColorStop(0, 'rgba(60, 70, 90, 0.30)');
    volume.addColorStop(0.35, 'rgba(255, 255, 255, 0.10)');
    volume.addColorStop(0.6, 'rgba(255, 255, 255, 0.18)');
    volume.addColorStop(1, 'rgba(60, 70, 90, 0.24)');
    ctx.fillStyle = volume;
    fuselage();
    ctx.fill();
    ctx.fillStyle = '#0f7a6e';
    ctx.beginPath();
    ctx.moveTo(-22, -48);
    ctx.quadraticCurveTo(0, -38, 22, -48);
    ctx.lineTo(21, -28);
    ctx.quadraticCurveTo(0, -19, -21, -28);
    ctx.closePath();
    ctx.fill();
    // Tail fin with the roundel.
    ctx.fillStyle = '#0f7a6e';
    ctx.beginPath();
    ctx.moveTo(-13, -66);
    ctx.lineTo(0, -150);
    ctx.lineTo(14, -66);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ff7a1a';
    ctx.beginPath();
    ctx.arc(0, -104, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f4f1e8';
    ctx.beginPath();
    ctx.arc(0, -104, 5.5, 0, Math.PI * 2);
    ctx.fill();
    // Cockpit windows.
    ctx.fillStyle = '#12324a';
    ctx.beginPath();
    ctx.moveTo(-14, -84);
    ctx.quadraticCurveTo(0, -94, 14, -84);
    ctx.lineTo(12, -66);
    ctx.quadraticCurveTo(0, -72, -12, -66);
    ctx.closePath();
    ctx.fill();
    // Nose and spinning prop.
    ctx.fillStyle = '#ff7a1a';
    ctx.beginPath();
    ctx.ellipse(0, -132, 11, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.translate(0, -134);
    ctx.rotate(propAngle);
    ctx.fillStyle = 'rgba(30, 40, 50, 0.85)';
    ctx.fillRect(-3, -66, 6, 132);
    ctx.fillRect(-66, -3, 132, 6);
    ctx.restore();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.10)';
    ctx.beginPath();
    ctx.arc(0, -134, 58, 0, Math.PI * 2);
    ctx.fill();
    // Registration on the fuselage.
    ctx.fillStyle = '#12324a';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PK-NAC', 0, 44);
    ctx.restore();
  }

  // v3 — the slim 96 px instrument strip: engine mini-bars (THR/FUEL/TEMP/
  // DMG), the attitude ball, ALT and SPD readouts, hull + lives + last pay,
  // the runway distance, and the round radar minimap at the far right.
  function drawPanel(flight, world, best, time) {
    const panelY = VIEW.height - PANEL_H;
    ctx.fillStyle = 'rgba(10, 16, 24, 0.92)';
    ctx.fillRect(0, panelY, VIEW.width, PANEL_H);
    ctx.fillStyle = 'rgba(34, 230, 200, 0.25)';
    ctx.fillRect(0, panelY, VIEW.width, 2);
    // --- engine mini-bars -----------------------------------------------------
    const tempC = Math.round(58 + flight.throttle * 52 + flight.speed * 0.06);
    const bars = [
      { label: 'THR', frac: flight.throttle, color: '#ff7a1a', text: `${Math.round(flight.throttle * 100)}%` },
      { label: 'FUEL', frac: flight.fuel / 100, color: flight.fuel < 20 ? '#ff5252' : '#22e6c8', text: `${Math.round(flight.fuel)}%` },
      { label: 'TEMP', frac: clamp((tempC - 40) / 90, 0, 1), color: tempC > 120 ? '#ff5252' : '#ffb02e', text: `${tempC}°` },
      { label: 'DMG', frac: (100 - flight.hull) / 100, color: '#ff5252', text: `${Math.round(100 - flight.hull)}%` },
    ];
    bars.forEach((bar, i) => {
      const bx = 20 + i * 46;
      ctx.fillStyle = '#9fd8cf';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(bar.label, bx + 8, panelY + 16);
      ctx.fillStyle = '#0d1a24';
      ctx.fillRect(bx, panelY + 24, 16, 52);
      ctx.fillStyle = bar.color;
      ctx.fillRect(bx, panelY + 76 - bar.frac * 52, 16, bar.frac * 52);
      ctx.strokeStyle = '#22e6c8';
      ctx.lineWidth = 1;
      ctx.strokeRect(bx, panelY + 24, 16, 52);
      ctx.fillStyle = '#cfe9f7';
      ctx.font = '10px monospace';
      ctx.fillText(bar.text, bx + 8, panelY + 90);
    });
    // --- artificial horizon ---------------------------------------------------
    const hx = 300;
    const hy = panelY + 48;
    const hr = 36;
    ctx.save();
    ctx.beginPath();
    ctx.arc(hx, hy, hr, 0, Math.PI * 2);
    ctx.clip();
    ctx.translate(hx, hy);
    ctx.rotate(-flight.roll * 0.9);
    ctx.translate(0, flight.pitch * 95);
    ctx.fillStyle = '#2f7fd0';
    ctx.fillRect(-hr - 2, -hr * 2 - 2, hr * 2 + 4, hr * 2 + 2);
    ctx.fillStyle = '#7a5a38';
    ctx.fillRect(-hr - 2, 0, hr * 2 + 4, hr * 2 + 2);
    ctx.fillStyle = '#f4f1e8';
    ctx.fillRect(-hr - 2, -1.5, hr * 2 + 4, 3);
    ctx.restore();
    ctx.strokeStyle = '#22e6c8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(hx, hy, hr, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#ff7a1a';
    ctx.beginPath();
    ctx.moveTo(hx - 13, hy);
    ctx.lineTo(hx + 13, hy);
    ctx.lineTo(hx, hy + 6);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#9fd8cf';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ATTITUDE', hx, panelY + 92);
    // --- altimeter --------------------------------------------------------------
    const ax = 432;
    ctx.fillStyle = '#0d1a24';
    ctx.fillRect(ax - 60, panelY + 12, 120, 72);
    ctx.strokeStyle = '#22e6c8';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(ax - 60, panelY + 12, 120, 72);
    ctx.fillStyle = '#7dffd9';
    ctx.font = 'bold 24px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(String(Math.round(flight.alt)).padStart(4, '0'), ax, panelY + 44);
    ctx.fillStyle = '#9fd8cf';
    ctx.font = 'bold 10px sans-serif';
    ctx.fillText('ALT  m', ax, panelY + 62);
    ctx.fillText(flight.verticalSpeed >= 0 ? `▲ ${flight.verticalSpeed.toFixed(1)} m/s` : `▼ ${Math.abs(flight.verticalSpeed).toFixed(1)} m/s`, ax, panelY + 78);
    // --- airspeed -----------------------------------------------------------------
    const sx = 568;
    ctx.fillStyle = '#0d1a24';
    ctx.fillRect(sx - 60, panelY + 12, 120, 72);
    ctx.strokeStyle = '#22e6c8';
    ctx.strokeRect(sx - 60, panelY + 12, 120, 72);
    ctx.fillStyle = '#7dffd9';
    ctx.font = 'bold 24px monospace';
    ctx.fillText(String(Math.round(flight.speed / KT)), sx, panelY + 44);
    ctx.fillStyle = '#9fd8cf';
    ctx.font = 'bold 10px sans-serif';
    ctx.fillText('SPEED  kt', sx, panelY + 62);
    ctx.fillText(flight.stalled ? '⚠ STALL' : `THR ${Math.round(flight.throttle * 100)}%`, sx, panelY + 78);
    // --- hull + lives + last pay ----------------------------------------------------
    const lx = 652;
    ctx.fillStyle = '#9fd8cf';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('HULL', lx, panelY + 24);
    ctx.fillStyle = '#0d1a24';
    ctx.fillRect(lx, panelY + 32, 148, 12);
    ctx.fillStyle = flight.hull < 40 ? '#ff5252' : '#22e6c8';
    ctx.fillRect(lx, panelY + 32, 148 * (flight.hull / 100), 12);
    ctx.fillStyle = '#9fd8cf';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText('✈'.repeat(Math.max(0, flight.lives)), lx, panelY + 68);
    ctx.fillText(`LIVES ${flight.lives}`, lx + 56, panelY + 68);
    ctx.fillStyle = '#ffe9a8';
    ctx.font = '10px sans-serif';
    if (flight.lastPay > 0) {
      const payName = flight.lastPayLabel.split(' — ')[0];
      ctx.fillText(`+${rpShort(flight.lastPay)} · ${payName}`, lx, panelY + 86);
    } else {
      ctx.fillText(`BEST ${best}`, lx, panelY + 86);
    }
    // --- runway distance + destination ----------------------------------------------
    const runway = world.runway;
    const runwayDist = Math.round(Math.hypot(runway.x - flight.x, runway.z - flight.z));
    const place = PLACES[flight.leg] ?? PLACES[0];
    ctx.textAlign = 'center';
    ctx.fillStyle = '#7dffd9';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText(`RUNWAY ${runwayDist} m`, 985, panelY + 44);
    ctx.fillStyle = '#9fd8cf';
    ctx.font = '11px sans-serif';
    ctx.fillText(`TUJUAN ${flight.leg < LEGS.length ? LEGS[flight.leg].to.toUpperCase() : ''} — ${place.landmark}`, 985, panelY + 68);
    drawRadar(flight, world);
    void time;
  }

  // v3 — round radar minimap, heading-up: rings as dots (next green, passed
  // grey, future orange), the runway as a white bar, the plane as a triangle.
  function drawRadar(flight, world) {
    const cx = 1212;
    const cy = VIEW.height - PANEL_H / 2;
    const r = 40;
    const range = 1000;
    const scale = r / range;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = 'rgba(8, 20, 16, 0.92)';
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    ctx.strokeStyle = 'rgba(34, 230, 200, 0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, r / 2, 0, Math.PI * 2);
    ctx.stroke();
    const heading = flight.heading;
    const sinH = Math.sin(heading);
    const cosH = Math.cos(heading);
    const toRadar = (wx, wz) => {
      const dx = wx - flight.x;
      const dz = wz - flight.z;
      const fwd = dx * sinH + dz * cosH;
      const right = dx * cosH - dz * sinH;
      return [cx + right * scale, cy - fwd * scale];
    };
    // Runway bar.
    const runway = world.runway;
    const [rx1, ry1] = toRadar(runway.x, runway.z - runway.length / 2);
    const [rx2, ry2] = toRadar(runway.x, runway.z + runway.length / 2);
    ctx.strokeStyle = '#f5f5f0';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(rx1, ry1);
    ctx.lineTo(rx2, ry2);
    ctx.stroke();
    const next = world.nextRing();
    for (const ring of world.rings) {
      const [sx, sy] = toRadar(ring.x, ring.z);
      if (Math.hypot(sx - cx, sy - cy) > r - 3) continue;
      const isNext = next && next.index === ring.index;
      ctx.fillStyle = ring.passed ? '#8a94a6' : isNext ? '#22e6c8' : '#ff9f2e';
      ctx.beginPath();
      ctx.arc(sx, sy, isNext ? 3.5 : 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    // The plane, pointing up (heading-up).
    ctx.fillStyle = '#7dffd9';
    ctx.beginPath();
    ctx.moveTo(cx, cy - 6);
    ctx.lineTo(cx + 4, cy + 5);
    ctx.lineTo(cx - 4, cy + 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = '#22e6c8';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  // v3 — the slim compass tape: one row of cardinal points, an orange caret
  // and the heading digits underneath.
  function drawCompass(flight) {
    const headingDeg = ((flight.heading * 180 / Math.PI) % 360 + 360) % 360;
    const cx = VIEW.width / 2;
    const y = 8;
    ctx.fillStyle = 'rgba(10, 16, 24, 0.72)';
    ctx.fillRect(cx - 160, y, 320, 26);
    ctx.strokeStyle = 'rgba(34, 230, 200, 0.5)';
    ctx.strokeRect(cx - 160, y, 320, 26);
    const points = [['N', 0], ['NE', 45], ['E', 90], ['SE', 135], ['S', 180], ['SW', 225], ['W', 270], ['NW', 315]];
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    for (const [label, deg] of points) {
      let diff = deg - headingDeg;
      while (diff > 180) diff -= 360;
      while (diff < -180) diff += 360;
      if (Math.abs(diff) > 95) continue;
      const x = cx + diff * 1.6;
      ctx.fillStyle = Math.abs(diff) < 8 ? '#ff7a1a' : '#cfe9f7';
      ctx.fillText(label, x, y + 19);
    }
    ctx.fillStyle = '#ff7a1a';
    ctx.beginPath();
    ctx.moveTo(cx - 6, y + 26);
    ctx.lineTo(cx + 6, y + 26);
    ctx.lineTo(cx, y + 34);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#7dffd9';
    ctx.font = 'bold 14px monospace';
    ctx.fillText(`${String(Math.round(headingDeg)).padStart(3, '0')}°`, cx, y + 52);
  }

  // v3 — slim edge tapes: the speed tape on the left edge, the altitude tape
  // on the right edge. The tape scrolls; the current value stays centred in
  // an orange marker with its number in a pill just inside the frame.
  function drawSpeedTape(flight) {
    const spd = flight.speed / KT;
    const top = 120;
    const bottom = 600;
    const midY = (top + bottom) / 2;
    const pxPerKt = (bottom - top) / 2 / 40;
    ctx.fillStyle = 'rgba(10, 16, 24, 0.55)';
    ctx.fillRect(0, top, 44, bottom - top);
    ctx.strokeStyle = 'rgba(34, 230, 200, 0.4)';
    ctx.strokeRect(0, top, 44, bottom - top);
    ctx.textAlign = 'right';
    ctx.font = '10px monospace';
    const first = Math.max(0, Math.floor((spd - 40) / 10) * 10);
    for (let kt = first; kt <= spd + 40; kt += 10) {
      const y = midY - (kt - spd) * pxPerKt;
      if (y < top + 6 || y > bottom - 6) continue;
      ctx.strokeStyle = 'rgba(207, 233, 247, 0.7)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(36, y);
      ctx.lineTo(44, y);
      ctx.stroke();
      if (kt % 20 === 0) {
        ctx.fillStyle = '#cfe9f7';
        ctx.fillText(String(kt), 32, y + 3);
      }
    }
    ctx.fillStyle = 'rgba(255, 122, 26, 0.9)';
    ctx.fillRect(0, midY - 9, 44, 18);
    ctx.fillStyle = 'rgba(10, 16, 24, 0.85)';
    ctx.fillRect(48, midY - 10, 54, 20);
    ctx.fillStyle = '#7dffd9';
    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`${Math.round(spd)} kt`, 52, midY + 5);
    ctx.fillStyle = '#9fd8cf';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SPD', 22, top + 12);
  }

  function drawAltTape(flight) {
    const alt = flight.alt;
    const top = 120;
    const bottom = 600;
    const midY = (top + bottom) / 2;
    const pxPerM = (bottom - top) / 2 / 150;
    ctx.fillStyle = 'rgba(10, 16, 24, 0.55)';
    ctx.fillRect(VIEW.width - 44, top, 44, bottom - top);
    ctx.strokeStyle = 'rgba(34, 230, 200, 0.4)';
    ctx.strokeRect(VIEW.width - 44, top, 44, bottom - top);
    ctx.textAlign = 'left';
    ctx.font = '10px monospace';
    const first = Math.max(0, Math.floor((alt - 150) / 25) * 25);
    for (let m = first; m <= alt + 150; m += 25) {
      const y = midY - (m - alt) * pxPerM;
      if (y < top + 6 || y > bottom - 6) continue;
      ctx.strokeStyle = 'rgba(207, 233, 247, 0.7)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(VIEW.width - 44, y);
      ctx.lineTo(VIEW.width - 36, y);
      ctx.stroke();
      if (m % 50 === 0) {
        ctx.fillStyle = '#cfe9f7';
        ctx.fillText(String(m), VIEW.width - 32, y + 3);
      }
    }
    ctx.fillStyle = 'rgba(255, 122, 26, 0.9)';
    ctx.fillRect(VIEW.width - 44, midY - 9, 44, 18);
    ctx.fillStyle = 'rgba(10, 16, 24, 0.85)';
    ctx.fillRect(VIEW.width - 106, midY - 10, 54, 20);
    ctx.fillStyle = '#7dffd9';
    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`${Math.round(alt)} m`, VIEW.width - 56, midY + 5);
    ctx.fillStyle = '#9fd8cf';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ALT', VIEW.width - 22, top + 12);
  }

  // v3 — the mission-brief bar: the story line on the left, the live numbers
  // (rings, score, time, next gate) on the right, like the neighbours'.
  function drawMissionBar(flight, world, leg) {
    const barW = 840;
    const barX = VIEW.width / 2 - barW / 2;
    const barY = VIEW.height - PANEL_H - 22 - 30;
    ctx.fillStyle = 'rgba(10, 16, 24, 0.8)';
    ctx.fillRect(barX, barY, barW, 30);
    ctx.strokeStyle = 'rgba(255, 159, 46, 0.55)';
    ctx.strokeRect(barX, barY, barW, 30);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffe9a8';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText(leg.brief, barX + 12, barY + 20);
    const windKt = Math.round(Math.hypot(flight.windX, flight.windZ) / KT);
    const next = world.nextRing();
    const nextText = next
      ? `NEXT G-${String(next.index + 1).padStart(2, '0')} · ${Math.round(Math.hypot(next.x - flight.x, next.y - flight.alt, next.z - flight.z))}m`
      : 'LAND ON THE RUNWAY';
    ctx.textAlign = 'right';
    ctx.fillStyle = '#7dffd9';
    ctx.font = 'bold 12px monospace';
    ctx.fillText(`RINGS ${flight.ringsHit}/${leg.rings} · SCORE ${flight.score} · WIND ${windKt} kt · ${nextText}`, barX + barW - 12, barY + 20);
  }

  // --- v2: MANIFEST (left) — named passengers/cargo, mood, fare + tip -------
  // v3 — narrowed to 220 px, smaller type, more transparent, tucked beside
  // the speed tape so the world shows through.
  function drawManifest(flight, leg) {
    const x = 52;
    const y = 56;
    const w = 218;
    const items = flight.manifest ?? [];
    const h = 28 + items.length * 38 + 6;
    ctx.fillStyle = 'rgba(10, 16, 24, 0.68)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(255, 159, 46, 0.5)';
    ctx.strokeRect(x, y, w, h);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ff9f2e';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText(`✈ MANIFEST · ${leg.from} → ${leg.to}`, x + 10, y + 18);
    items.forEach((item, i) => {
      const iy = y + 28 + i * 38;
      const done = item.status === 'delivered';
      ctx.fillStyle = done ? 'rgba(34, 230, 200, 0.14)' : 'rgba(255,255,255,0.05)';
      ctx.fillRect(x + 6, iy, w - 12, 34);
      ctx.fillStyle = done ? '#22e6c8' : '#ffe9a8';
      ctx.font = 'bold 12px sans-serif';
      const moodColor = item.mood === 'MENDESAK' ? '#ff6b5e' : item.mood === 'BURU-BURU' ? '#ffb02e' : '#9fd8cf';
      ctx.fillText(`${done ? '✓' : '○'} ${item.name}`, x + 12, iy + 14);
      ctx.fillStyle = moodColor;
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(item.mood, x + w - 10, iy + 14);
      ctx.textAlign = 'left';
      ctx.fillStyle = '#cfe9f7';
      ctx.font = 'bold 10px monospace';
      const priceText = done ? `+${rpShort(item.paid)} ✓` : `${rpShort(item.fare)} + ${rpShort(item.tip)} tip`;
      const priceW = ctx.measureText(priceText).width;
      // The cargo text is truncated with an ellipsis so it can never run
      // into the right-aligned price in the narrowed 218 px panel.
      ctx.font = '10px sans-serif';
      let cargoText = `R${item.ring + 1} · ${item.cargo}`;
      const maxCargoW = w - 24 - priceW - 12;
      let truncated = false;
      while (cargoText.length > 3 && ctx.measureText(cargoText).width > maxCargoW) {
        cargoText = cargoText.slice(0, -1);
        truncated = true;
      }
      if (truncated) cargoText += '…';
      ctx.fillText(cargoText, x + 12, iy + 29);
      ctx.textAlign = 'right';
      ctx.fillStyle = done ? '#22e6c8' : '#7dffd9';
      ctx.font = 'bold 10px monospace';
      ctx.fillText(priceText, x + w - 10, iy + 29);
      ctx.textAlign = 'left';
    });
  }

  // --- v2: ROUTE PLAN + GOALS (right) -----------------------------------------
  // v3 — narrowed to 218 px beside the altitude tape, same content.
  function drawRouteGoals(flight, leg, extra) {
    const x = VIEW.width - 44 - 8 - 218;
    const y = 56;
    const w = 218;
    const goals = flight.goals ?? [];
    const h = 28 + ROUTE_STOPS.length * 24 + 14 + goals.length * 22 + 34;
    ctx.fillStyle = 'rgba(10, 16, 24, 0.68)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(34, 230, 200, 0.5)';
    ctx.strokeRect(x, y, w, h);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#22e6c8';
    ctx.font = 'bold 12px sans-serif';
    const etaMin = Math.max(0, Math.round((leg.parTime - flight.legTime) / 60));
    ctx.fillText(`RUTE — LEG ${flight.leg + 1}/3 · ETA ${etaMin} mnt`, x + 10, y + 18);
    ROUTE_STOPS.forEach((stop, i) => {
      const sy = y + 34 + i * 24;
      const reached = i <= flight.leg;
      const current = i === flight.leg + 1;
      ctx.fillStyle = reached ? '#22e6c8' : current ? '#ffb02e' : '#5a6b7a';
      ctx.beginPath();
      ctx.arc(x + 16, sy - 4, 6, 0, Math.PI * 2);
      ctx.fill();
      if (i < ROUTE_STOPS.length - 1) {
        ctx.strokeStyle = reached ? '#22e6c8' : '#33424f';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x + 16, sy + 2);
        ctx.lineTo(x + 16, sy + 20);
        ctx.stroke();
      }
      ctx.fillStyle = reached ? '#eafffb' : current ? '#ffe9a8' : '#8fa3b3';
      ctx.font = `bold ${current ? 13 : 12}px sans-serif`;
      ctx.fillText(`${reached ? '✓ ' : ''}${stop}${current ? '  ← TUJUAN' : ''}`, x + 30, sy);
    });
    const gy = y + 34 + ROUTE_STOPS.length * 24 + 8;
    ctx.fillStyle = '#ff9f2e';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText('MISI LEG INI', x + 10, gy);
    goals.forEach((goal, i) => {
      const yy = gy + 19 + i * 22;
      ctx.fillStyle = goal.done ? '#22e6c8' : '#cfe9f7';
      ctx.font = '12px sans-serif';
      ctx.fillText(`${goal.done ? '☑' : '☐'} ${goal.label}${goal.id === 'cargo' ? `  (${Math.min(goal.progress, goal.target)}/${goal.target})` : ''}`, x + 10, yy);
    });
    const place = PLACES[flight.leg] ?? PLACES[0];
    ctx.fillStyle = '#9fd8cf';
    ctx.font = 'italic 10px sans-serif';
    ctx.fillText(`${place.landmark}`, x + 10, gy + 19 + goals.length * 22 + 6);
    if (extra?.routeOverlay) {
      ctx.fillStyle = 'rgba(10, 16, 24, 0.92)';
      ctx.fillRect(VIEW.width / 2 - 260, 150, 520, 150);
      ctx.strokeStyle = '#22e6c8';
      ctx.strokeRect(VIEW.width / 2 - 260, 150, 520, 150);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#7dffd9';
      ctx.font = 'bold 16px sans-serif';
      ctx.fillText('PETA RUTE — NUSANTARA AIR COURIER', VIEW.width / 2, 178);
      ctx.fillStyle = '#cfe9f7';
      ctx.font = '14px sans-serif';
      ctx.fillText('Jakarta → Krakatau → Bali → Raja Ampat', VIEW.width / 2, 206);
      ctx.fillText('4 pemberhentian · 3 leg · cuaca makin buruk tiap leg', VIEW.width / 2, 230);
      ctx.fillStyle = '#ffe9a8';
      ctx.font = 'bold 13px sans-serif';
      ctx.fillText(`Leg ${flight.leg + 1}/3: ${leg.name} — ${flight.ringsHit}/${leg.rings} ring`, VIEW.width / 2, 258);
      ctx.fillText('Tekan TAB lagi untuk menutup peta', VIEW.width / 2, 282);
      ctx.textAlign = 'left';
    }
  }

  // --- v2: DIALOG bubble (centre, under the beacon) ---------------------------
  // v3 — moved up (y 118) now the beacon bar is gone; hidden while the route
  // map overlay is open, so the two never collide.
  function drawDialog(flight, extra) {
    const dialog = flight.dialog;
    if (!dialog || dialog.timer <= 0) return;
    if (extra?.routeOverlay) return;
    const boxW = 620;
    const boxX = VIEW.width / 2 - boxW / 2;
    const boxY = 118;
    ctx.fillStyle = 'rgba(10, 16, 24, 0.88)';
    ctx.fillRect(boxX, boxY, boxW, 56);
    ctx.strokeStyle = 'rgba(255, 233, 168, 0.7)';
    ctx.strokeRect(boxX, boxY, boxW, 56);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffb02e';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText(`${dialog.who}`, boxX + 14, boxY + 19);
    ctx.fillStyle = '#ffffff';
    ctx.font = '15px sans-serif';
    // Wrap the line to the box width.
    const words = dialog.line.split(' ');
    let line = '';
    let ly = boxY + 40;
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > boxW - 28 && line) {
        ctx.fillText(line, boxX + 14, ly);
        line = word;
        ly += 0; // one extra line would overflow the bubble; keep it short
      } else {
        line = test;
      }
    }
    if (line) ctx.fillText(line, boxX + 14, ly);
  }

  // --- v2: KEYBOARD BAR — every control, always visible ------------------------
  // v3 — sits just above the slim 96 px instrument strip.
  function drawKeyboardBar() {
    const y = VIEW.height - PANEL_H - 22;
    ctx.fillStyle = 'rgba(10, 16, 24, 0.9)';
    ctx.fillRect(0, y, VIEW.width, 22);
    ctx.fillStyle = 'rgba(34, 230, 200, 0.4)';
    ctx.fillRect(0, y, VIEW.width, 1);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#9fd8cf';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText('WASD / ←↑↓→ TERBANG   ·   SHIFT / CTRL THROTTLE   ·   SPACE REM   ·   E RADIO   ·   TAB PETA RUTE   ·   1/2/3 REFIT ANTAR LEG   ·   P JEDA   ·   M SUARA   ·   R ULANG   ·   KLIK KEMUDI', VIEW.width / 2, y + 16);
  }

  // --- v2: ISLAND IDENTITY — each destination reads differently ---------------
  // v3 — volcano smoke now rises on every leg (any volcano in view), taller
  // and thicker; the leg-specific landmarks stay as they were.
  function drawLandmarks(world, plane, palette, legIndex, time) {
    // Smoke over every volcano in view, on any leg — out to the same range
    // as the far-island silhouettes, so a distant volcano reads as active.
    for (const island of world.islands) {
      if (!island.volcano) continue;
      const dz = island.z - plane.z;
      if (dz < 0 || dz > 2600 || Math.abs(island.x - plane.x) > 1600) continue;
      const peak = camera.project(island.x, island.peak, island.z, plane);
      if (!peak) continue;
      const s = peak.scale;
      for (let i = 0; i < 6; i += 1) {
        const rise = ((time * 12 + i * 26) % 160);
        const px = peak.x + Math.sin(i * 2.1) * 10 * s * 0.4 + rise * 0.3;
        const py = peak.y - rise * s * 0.55;
        ctx.fillStyle = `rgba(205, 205, 210, ${0.6 - rise * 0.003})`;
        ctx.beginPath();
        ctx.arc(px, py, (12 + i * 9) * s * 0.55, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    if (legIndex === 0) {
      // Krakatau: label the volcano.
      for (const island of world.islands) {
        if (!island.volcano) continue;
        const dz = island.z - plane.z;
        if (dz < 0 || dz > 1200 || Math.abs(island.x - plane.x) > 900) continue;
        const peak = camera.project(island.x, island.peak, island.z, plane);
        if (!peak) continue;
        const s = peak.scale;
        ctx.fillStyle = '#e8e8e8';
        ctx.font = `bold ${Math.max(11, Math.min(18, 14 * s))}px sans-serif`;
        ctx.textAlign = 'center';
        // Never let a centred label bleed in from off-screen.
        if (peak.x > 130 && peak.x < VIEW.width - 130) ctx.fillText('ANAK KRAKATAU', peak.x, peak.y - 130 * s * 0.5);
        break;
      }
    } else if (legIndex === 1) {
      // Bali: rice terraces + a meru temple on the nearest green islands.
      for (const island of world.islands) {
        if (island.height < 20 || island.volcano) continue;
        const dz = island.z - plane.z;
        if (dz < 0 || dz > 800 || Math.abs(island.x - plane.x) > 700) continue;
        const top = camera.project(island.x, island.peak, island.z, plane);
        if (!top) continue;
        const s = top.scale;
        if (s < 0.25) continue;
        // Terraces: stacked green arcs down the slope.
        ctx.strokeStyle = 'rgba(120, 200, 90, 0.85)';
        ctx.lineWidth = Math.max(1, 2 * s);
        for (let t = 0; t < 4; t += 1) {
          ctx.beginPath();
          ctx.arc(top.x, top.y + t * 14 * s, (18 + t * 16) * s, Math.PI * 1.15, Math.PI * 1.85);
          ctx.stroke();
        }
        // Meru temple: three stacked roofs on the peak.
        ctx.fillStyle = '#8a5a2e';
        for (let r = 0; r < 3; r += 1) {
          const rw = (26 - r * 7) * s;
          ctx.beginPath();
          ctx.moveTo(top.x - rw, top.y - r * 12 * s);
          ctx.lineTo(top.x, top.y - (r * 12 + 10) * s);
          ctx.lineTo(top.x + rw, top.y - r * 12 * s);
          ctx.closePath();
          ctx.fill();
        }
        ctx.fillStyle = '#ffe9a8';
        ctx.font = `bold ${Math.max(11, Math.min(17, 13 * s))}px sans-serif`;
        ctx.textAlign = 'center';
        if (top.x > 140 && top.x < VIEW.width - 140) ctx.fillText('PURA + SAWAH JATILUWIH', top.x, top.y - 46 * s);
        break; // one labelled island is enough per frame
      }
    } else {
      // Raja Ampat: karst towers rising from a turquoise lagoon.
      for (const island of world.islands) {
        if (island.height > 40) continue;
        const dz = island.z - plane.z;
        if (dz < 0 || dz > 900 || Math.abs(island.x - plane.x) > 800) continue;
        const base = camera.project(island.x, 0, island.z, plane);
        if (!base) continue;
        const s = base.scale;
        if (s < 0.3) continue;
        ctx.fillStyle = 'rgba(64, 224, 208, 0.35)';
        ctx.beginPath();
        ctx.ellipse(base.x, base.y, 90 * s, 18 * s, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#3f6b4f';
        ctx.beginPath();
        ctx.moveTo(base.x - 22 * s, base.y);
        ctx.lineTo(base.x - 8 * s, base.y - 70 * s);
        ctx.lineTo(base.x + 6 * s, base.y - 78 * s);
        ctx.lineTo(base.x + 20 * s, base.y);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#eafffb';
        ctx.font = `bold ${Math.max(11, Math.min(17, 13 * s))}px sans-serif`;
        ctx.textAlign = 'center';
        if (base.x > 160 && base.x < VIEW.width - 160) ctx.fillText('LAGUNA WAYAG — RAJA AMPAT', base.x, base.y - 88 * s);
        break;
      }
    }
    void palette;
  }

  // v3 — the slim HUD: a leg chip top-left, the economy strip top-right, the
  // slim compass, edge tapes, the mission bar, and the centre messages. The
  // old 330 px ALT/SPD/HDG box and the 330 px score box are gone.
  function drawHud(flight, world, leg, best, extra) {
    // Top-left: leg chip.
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(10, 16, 24, 0.72)';
    ctx.fillRect(52, 10, 252, 30);
    ctx.strokeStyle = 'rgba(34, 230, 200, 0.5)';
    ctx.strokeRect(52, 10, 252, 30);
    ctx.fillStyle = '#7dffd9';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText(`LEG ${flight.leg + 1}/3 · ${leg.from.toUpperCase()} → ${leg.to.toUpperCase()}`, 64, 30);
    // Top-right: score + live economy strip. It starts clear of the compass
    // tape (which ends at x 800), so SCORE is never covered.
    ctx.fillStyle = 'rgba(10, 16, 24, 0.72)';
    ctx.fillRect(820, 10, 408, 30);
    ctx.strokeStyle = 'rgba(34, 230, 200, 0.5)';
    ctx.strokeRect(820, 10, 408, 30);
    ctx.fillStyle = '#7dffd9';
    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`SCORE ${flight.score}`, 832, 30);
    const minutes = Math.floor(flight.legTime / 60);
    const seconds = Math.floor(flight.legTime % 60);
    ctx.fillStyle = '#ffe9a8';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`${rpShort(flight.earnings)} · COMBO x${flight.combo} · RING ${flight.ringsHit}/${leg.rings} · TIME ${minutes}:${String(seconds).padStart(2, '0')}`, 1216, 30);
    drawCompass(flight);
    drawSpeedTape(flight);
    drawAltTape(flight);
    drawMissionBar(flight, world, leg);
    // Centre message and warnings — hidden under the route map overlay.
    if (flight.messageTimer > 0 && flight.message && !extra?.routeOverlay) {
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(10, 16, 24, 0.75)';
      const w = ctx.measureText(flight.message).width + 36;
      ctx.fillRect(VIEW.width / 2 - w / 2, 188, w, 34);
      ctx.fillStyle = '#ffe9a8';
      ctx.font = 'bold 17px sans-serif';
      ctx.fillText(flight.message, VIEW.width / 2, 211);
    }
    if (flight.stalled) {
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ff5252';
      ctx.font = 'bold 26px sans-serif';
      ctx.fillText('⚠ STALL — NOSE DOWN, FULL THROTTLE', VIEW.width / 2, 240);
    } else if (flight.fuel < 20 && flight.fuel > 0) {
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffb02e';
      ctx.font = 'bold 22px sans-serif';
      ctx.fillText('⚠ LOW FUEL', VIEW.width / 2, 240);
    }
    void best;
  }

  function drawTitle(flight, world, best, time) {
    ctx.fillStyle = 'rgba(6, 18, 32, 0.45)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 64px sans-serif';
    ctx.fillText('NUSANTARA', VIEW.width / 2, 150);
    ctx.fillStyle = '#ff7a1a';
    ctx.font = 'bold 64px sans-serif';
    ctx.fillText('AIR COURIER', VIEW.width / 2, 216);
    ctx.fillStyle = '#cfe9f7';
    ctx.font = '20px sans-serif';
    ctx.fillText('Kurir udara antar pulau — terbang lewati ring, lalu mendarat mulus di runway.', VIEW.width / 2, 256);
    ctx.fillStyle = 'rgba(10, 16, 24, 0.85)';
    ctx.fillRect(VIEW.width / 2 - 330, 286, 660, 174);
    ctx.strokeStyle = 'rgba(34, 230, 200, 0.6)';
    ctx.strokeRect(VIEW.width / 2 - 330, 286, 660, 174);
    ctx.fillStyle = '#7dffd9';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'left';
    const lines = [
      '← → / A D ......... bank kiri-kanan        ↑ ↓ / W S ......... naik-turun',
      'SHIFT / CTRL ..... throttle naik-turun     MOUSE ............ kemudikan pesawat',
      'SPASI / klik ....... rem (saat mendarat)   E radio · TAB peta rute · 1/2/3 refit',
      'Terbang lewati RING hijau berurutan, lalu mendarat di RUNWAY pulau tujuan.',
      'Tiap ring mengantar kargo bernama — tepat waktu = fare + tip. Jaga combo!',
      'Hati-hati: kecepatan rendah = STALL, bahan bakar habis = jatuh ke laut.',
    ];
    lines.forEach((line, i) => {
      ctx.fillText(line, VIEW.width / 2 - 310, 316 + i * 24);
    });
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffe9a8';
    ctx.font = 'bold 22px sans-serif';
    const blink = 0.65 + 0.35 * Math.sin(time * 4);
    ctx.globalAlpha = blink;
    ctx.fillText('TEKAN ENTER ATAU KLIK UNTUK TERBANG', VIEW.width / 2, 486);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#9fd8cf';
    ctx.font = '16px sans-serif';
    ctx.fillText(`Skor terbaik: ${best}  ·  3 rute: Jakarta → Krakatau → Bali → Raja Ampat`, VIEW.width / 2, 520);
    void flight;
    void world;
  }

  function drawPaused() {
    ctx.fillStyle = 'rgba(6, 18, 32, 0.6)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 48px sans-serif';
    ctx.fillText('PAUSED', VIEW.width / 2, 330);
    ctx.fillStyle = '#cfe9f7';
    ctx.font = '20px sans-serif';
    ctx.fillText('Tekan P untuk lanjut terbang · M suara · R ulangi dari awal', VIEW.width / 2, 372);
  }

  function drawOver(flight, best) {
    ctx.fillStyle = 'rgba(6, 18, 32, 0.72)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff6b5e';
    ctx.font = 'bold 54px sans-serif';
    ctx.fillText('PENERBANGAN BERAKHIR', VIEW.width / 2, 280);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 30px monospace';
    ctx.fillText(`SKOR ${flight.score}`, VIEW.width / 2, 340);
    ctx.fillStyle = '#cfe9f7';
    ctx.font = '20px sans-serif';
    ctx.fillText(`Ring dilewati: ${flight.ringsHit}  ·  Skor terbaik: ${best}`, VIEW.width / 2, 380);
    ctx.fillStyle = '#ffe9a8';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText('Tekan R atau ENTER untuk terbang lagi', VIEW.width / 2, 440);
  }

  function drawLegComplete(flight, leg, bonus) {
    ctx.fillStyle = 'rgba(6, 18, 32, 0.55)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#22e6c8';
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(`SELAMAT DATANG DI ${leg.to.toUpperCase()}!`, VIEW.width / 2, 170);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 28px monospace';
    ctx.fillText(`BONUS MENDARAT +${bonus}  ·  UANG ${rpShort(flight.earnings)}`, VIEW.width / 2, 226);
    ctx.fillStyle = '#cfe9f7';
    ctx.font = '20px sans-serif';
    ctx.fillText(`Skor sementara: ${flight.score}  ·  Ring: ${flight.ringsHit}/${leg.rings}  ·  Kargo antar: ${flight.delivered}`, VIEW.width / 2, 262);
    // v2 — goals checklist for the finished leg.
    ctx.fillStyle = '#ffe9a8';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText('MISI LEG INI:', VIEW.width / 2, 300);
    ctx.fillStyle = '#cfe9f7';
    ctx.font = '17px sans-serif';
    (flight.goals ?? []).forEach((goal, i) => {
      ctx.fillText(`${goal.done ? '☑' : '☐'} ${goal.label}`, VIEW.width / 2, 328 + i * 26);
    });
    // v2 — REFIT: spend earned rupiah before the next leg (keys 1/2/3).
    const refitY = 328 + (flight.goals ?? []).length * 26 + 18;
    ctx.fillStyle = 'rgba(10, 16, 24, 0.9)';
    ctx.fillRect(VIEW.width / 2 - 420, refitY, 840, 118);
    ctx.strokeStyle = 'rgba(255, 159, 46, 0.7)';
    ctx.strokeRect(VIEW.width / 2 - 420, refitY, 840, 118);
    ctx.fillStyle = '#ff9f2e';
    ctx.font = 'bold 17px sans-serif';
    ctx.fillText('REFIT — BELI UPGRADE DENGAN UANGMU (tekan 1 / 2 / 3)', VIEW.width / 2, refitY + 26);
    UPGRADES.forEach((up, i) => {
      const level = flight.upgrades[up.id] ?? 0;
      const price = up.base + up.step * level;
      const afford = flight.earnings >= price && level < up.max;
      const ux = VIEW.width / 2 - 390 + i * 280;
      ctx.fillStyle = afford ? '#7dffd9' : '#8fa3b3';
      ctx.font = 'bold 15px sans-serif';
      ctx.fillText(`[${up.key}] ${up.name}  Lv${level}/${up.max}`, ux, refitY + 56);
      ctx.fillStyle = '#cfe9f7';
      ctx.font = '13px sans-serif';
      ctx.fillText(`${up.desc}`, ux, refitY + 78);
      ctx.fillText(level >= up.max ? 'MAX' : `${rpShort(price)}`, ux, refitY + 98);
    });
    ctx.fillStyle = '#ffe9a8';
    ctx.font = 'bold 22px sans-serif';
    const next = LEGS[Math.min(flight.leg + 1, LEGS.length - 1)];
    ctx.fillText(flight.leg + 1 < LEGS.length ? `Rute berikutnya: ${next.name} — tekan ENTER` : 'Semua rute selesai — tekan ENTER untuk terbang lagi', VIEW.width / 2, refitY + 140);
  }

  return {
    draw(state, screen, best, time, extra) {
      const { flight, world } = state;
      const leg = LEGS[Math.min(flight.leg, LEGS.length - 1)];
      const palette = PALETTES[leg.palette];
      ctx.clearRect(0, 0, VIEW.width, VIEW.height);
      drawSky(palette, flight);
      drawFarIslands(world, flight, palette);
      drawTerrain(world, flight, palette);
      drawRunway(world, flight, palette);
      drawRings(world, flight, time);
      drawPalms(world, flight);
      drawClouds(world, flight, palette, time);
      drawBirds(world, flight, time);
      drawLandmarks(world, flight, palette, flight.leg, time);
      if (palette.rain > 0) drawRain(palette, time, palette.rain);
      const flash = palette.lightning ? drawLightning(flight, time) : 0;
      drawPlane(flight, time);
      if (flash > 0) {
        ctx.fillStyle = `rgba(220, 232, 255, ${flash.toFixed(3)})`;
        ctx.fillRect(0, 0, VIEW.width, VIEW.height);
      }
      if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED || screen === SCREEN_LEG) {
        // v2 — on the leg-complete screen the HUD beacon/message and the
        // dialog bubble stay off: the leg screen owns the centre (title,
        // goals, refit) and the side panels stay visible at the edges.
        if (screen !== SCREEN_LEG) {
          drawHud(flight, world, leg, best, extra);
          drawDialog(flight, extra);
        }
        drawManifest(flight, leg);
        drawRouteGoals(flight, leg, extra);
        drawKeyboardBar();
        drawPanel(flight, world, best, time);
      }
      if (screen === SCREEN_TITLE) drawTitle(flight, world, best, time);
      if (screen === SCREEN_PAUSED) drawPaused();
      if (screen === SCREEN_OVER) drawOver(flight, best);
      if (screen === SCREEN_LEG) drawLegComplete(flight, leg, extra?.bonus ?? 0);
      // A thin vignette so the frame reads as one picture.
      const vignette = ctx.createRadialGradient(
        VIEW.width / 2, VIEW.height / 2, VIEW.height * 0.45,
        VIEW.width / 2, VIEW.height / 2, VIEW.height * 0.95,
      );
      vignette.addColorStop(0, 'rgba(0,0,0,0)');
      vignette.addColorStop(1, 'rgba(0,0,0,0.22)');
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    },
  };
}
