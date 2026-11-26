// Every pixel the player sees: sky, sea and islands in perspective, the rings
// and the runway, the plane itself, the lit instrument panel and the HUD. The
// world is drawn far-to-near so nearer terrain covers farther, and every number
// on the panel comes from the live flight state — nothing here is decoration
// that pretends to be an instrument.
import { CAMERA, KT, LEGS, PALETTES, PLANE, RING, RUNWAY, VIEW } from './config.js';
import { bearingTo, createCamera } from './project.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_LEG = 'leg';

const ROW_Z = [10, 22, 38, 58, 82, 110, 142, 178, 218, 262, 310, 362, 418, 478, 542, 610, 682, 758, 838, 922, 1010];
const COL_STEP = 90;
const COLS = 15;

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

function terrainColor(height, palette, depth, x, z) {
  let base;
  if (height <= 0.6) base = palette.sea;
  else if (height <= 3) base = palette.sand;
  else if (height <= 26) base = palette.grass;
  else if (height <= 70) base = palette.forest;
  else if (height <= 120) base = palette.rock;
  else base = palette.snow;
  // A faint checker in the sea and grass so the ground reads as moving.
  const checker = (Math.floor(x / 90) + Math.floor(z / 90)) % 2 === 0 ? 0.97 : 1.0;
  const fog = clamp(depth * palette.fog, 0, 0.85);
  const [r, g, b] = mixChannels(base, palette.skyLow, fog);
  return `rgb(${Math.round(r * checker)},${Math.round(g * checker)},${Math.round(b * checker)})`;
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

  function drawSky(palette, plane, time) {
    const grad = ctx.createLinearGradient(0, 0, 0, VIEW.height * 0.62);
    grad.addColorStop(0, palette.skyTop);
    grad.addColorStop(0.55, palette.skyMid);
    grad.addColorStop(1, palette.skyLow);
    ctx.fillStyle = grad;
    // The sky fills the whole frame; the sea is painted over it below the horizon.
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    // Sun, low and warm, drifting slowly with the heading so it stays put.
    const sunX = VIEW.width * 0.68 - Math.sin(plane.heading) * 60;
    const sunY = VIEW.height * 0.16;
    const glow = ctx.createRadialGradient(sunX, sunY, 4, sunX, sunY, 130);
    glow.addColorStop(0, palette.sunGlow);
    glow.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(sunX - 130, sunY - 130, 260, 260);
    ctx.fillStyle = palette.sun;
    ctx.beginPath();
    ctx.arc(sunX, sunY, 26, 0, Math.PI * 2);
    ctx.fill();
    // Distant volcano silhouettes on the horizon, one per far island.
    void time;
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
    const horizonY = VIEW.height * 0.52 - plane.pitch * 260 + plane.roll * 0;
    ctx.fillStyle = palette.sea;
    ctx.fillRect(0, horizonY, VIEW.width, VIEW.height - horizonY);
    const rows = ROW_Z.map((offset) => plane.z + offset);
    for (let r = rows.length - 1; r >= 0; r -= 1) {
      const zFar = rows[r];
      const zNear = r === 0 ? plane.z - 30 : rows[r - 1];
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
        drawQuad(p1, p2, p3, p4, terrainColor(height, palette, depth, xLeft, zFar));
      }
    }
  }

  function drawClouds(world, plane, palette) {
    for (const cloud of world.clouds) {
      const dz = cloud.z - plane.z;
      if (dz < -100 || dz > 1400) continue;
      const p = camera.project(cloud.x, cloud.y, cloud.z, plane);
      if (!p) continue;
      const size = cloud.scale * p.scale * 0.9;
      if (size < 4 || size > 900) continue;
      const alpha = clamp(1 - p.depth / 1500, 0.15, 0.9);
      ctx.fillStyle = palette.cloud.replace(/[\d.]+\)$/, `${alpha})`);
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, size, size * 0.36, 0, 0, Math.PI * 2);
      ctx.ellipse(p.x - size * 0.55, p.y + size * 0.08, size * 0.62, size * 0.3, 0, 0, Math.PI * 2);
      ctx.ellipse(p.x + size * 0.55, p.y + size * 0.06, size * 0.58, size * 0.28, 0, 0, Math.PI * 2);
      ctx.fill();
    }
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
    for (const ring of sorted) {
      const dz = ring.z - plane.z;
      if (dz < -60 || dz > 1500) continue;
      const p = camera.project(ring.x, ring.y, ring.z, plane);
      if (!p) continue;
      const radius = RING.radius * p.scale;
      if (radius < 3 || radius > 1200) continue;
      const next = world.nextRing();
      const isNext = next && next.index === ring.index;
      const pulse = isNext ? 0.75 + 0.25 * Math.sin(time * 5) : 1;
      ctx.save();
      ctx.globalAlpha = clamp(1.15 - p.depth / 1400, 0.25, 1) * pulse;
      if (isNext) {
        ctx.shadowColor = '#22e6c8';
        ctx.shadowBlur = 26;
      }
      ctx.strokeStyle = ring.passed ? '#8a94a6' : isNext ? '#22e6c8' : '#ff9f2e';
      ctx.lineWidth = Math.max(2, radius * 0.14);
      ctx.beginPath();
      ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
      ctx.stroke();
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
        ctx.fillStyle = '#eafffb';
        ctx.font = `bold ${Math.max(11, Math.min(20, radius * 0.28))}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(`RING ${ring.index + 1}`, p.x, p.y - radius - 10);
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
    ctx.strokeStyle = 'rgba(210, 225, 240, 0.4)';
    ctx.lineWidth = 1;
    for (let i = 0; i < intensity * 90; i += 1) {
      const x = ((i * 137.5 + time * 900) % (VIEW.width + 80)) - 40;
      const y = ((i * 89.3 + time * 1400) % (VIEW.height + 40)) - 20;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - 7, y + 22);
      ctx.stroke();
    }
    void palette;
  }

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
    ctx.globalAlpha = clamp(0.28 - plane.alt / 900, 0.06, 0.28);
    ctx.fillStyle = '#06283f';
    ctx.beginPath();
    ctx.ellipse(cx + plane.roll * 30, 566, 86 - clamp(plane.alt / 6, 0, 52), 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(bank);
    // Tail wings.
    ctx.fillStyle = '#0f7a6e';
    ctx.beginPath();
    ctx.moveTo(-14, -58);
    ctx.lineTo(-86, -92);
    ctx.lineTo(-92, -78);
    ctx.lineTo(-16, -46);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(14, -58);
    ctx.lineTo(86, -92);
    ctx.lineTo(92, -78);
    ctx.lineTo(16, -46);
    ctx.closePath();
    ctx.fill();
    // Main wings, low and wide.
    ctx.fillStyle = '#f4f1e8';
    ctx.beginPath();
    ctx.moveTo(-16, -18);
    ctx.lineTo(-138, 26);
    ctx.lineTo(-128, 44);
    ctx.lineTo(-14, 26);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(16, -18);
    ctx.lineTo(138, 26);
    ctx.lineTo(128, 44);
    ctx.lineTo(14, 26);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ff7a1a';
    ctx.fillRect(-138, 26, 22, 7);
    ctx.fillRect(116, 26, 22, 7);
    // Fuselage: a tapered body with a teal cheatline and orange nose.
    ctx.fillStyle = '#f4f1e8';
    ctx.beginPath();
    ctx.moveTo(0, -108);
    ctx.quadraticCurveTo(20, -70, 17, -10);
    ctx.quadraticCurveTo(15, 42, 7, 62);
    ctx.quadraticCurveTo(0, 70, -7, 62);
    ctx.quadraticCurveTo(-15, 42, -17, -10);
    ctx.quadraticCurveTo(-20, -70, 0, -108);
    ctx.fill();
    ctx.fillStyle = '#0f7a6e';
    ctx.beginPath();
    ctx.moveTo(-17, -38);
    ctx.quadraticCurveTo(0, -30, 17, -38);
    ctx.lineTo(16, -22);
    ctx.quadraticCurveTo(0, -15, -16, -22);
    ctx.closePath();
    ctx.fill();
    // Tail fin with the roundel.
    ctx.fillStyle = '#0f7a6e';
    ctx.beginPath();
    ctx.moveTo(-10, -52);
    ctx.lineTo(0, -118);
    ctx.lineTo(11, -52);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ff7a1a';
    ctx.beginPath();
    ctx.arc(0, -82, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f4f1e8';
    ctx.beginPath();
    ctx.arc(0, -82, 4.5, 0, Math.PI * 2);
    ctx.fill();
    // Cockpit windows.
    ctx.fillStyle = '#12324a';
    ctx.beginPath();
    ctx.moveTo(-11, -66);
    ctx.quadraticCurveTo(0, -74, 11, -66);
    ctx.lineTo(9, -52);
    ctx.quadraticCurveTo(0, -57, -9, -52);
    ctx.closePath();
    ctx.fill();
    // Nose and spinning prop.
    ctx.fillStyle = '#ff7a1a';
    ctx.beginPath();
    ctx.ellipse(0, -104, 9, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.translate(0, -106);
    ctx.rotate(propAngle);
    ctx.fillStyle = 'rgba(30, 40, 50, 0.85)';
    ctx.fillRect(-2.5, -52, 5, 104);
    ctx.fillRect(-52, -2.5, 104, 5);
    ctx.restore();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.10)';
    ctx.beginPath();
    ctx.arc(0, -106, 46, 0, Math.PI * 2);
    ctx.fill();
    // Registration on the fuselage.
    ctx.fillStyle = '#12324a';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PK-NAC', 0, 34);
    ctx.restore();
  }

  function drawPanel(flight, time) {
    const panelY = VIEW.height - 122;
    ctx.fillStyle = 'rgba(10, 16, 24, 0.92)';
    ctx.fillRect(0, panelY, VIEW.width, 122);
    ctx.fillStyle = 'rgba(34, 230, 200, 0.25)';
    ctx.fillRect(0, panelY, VIEW.width, 2);
    const cx = VIEW.width / 2;
    // --- artificial horizon -------------------------------------------------
    const hx = cx - 300;
    const hy = panelY + 61;
    const hr = 46;
    ctx.save();
    ctx.beginPath();
    ctx.arc(hx, hy, hr, 0, Math.PI * 2);
    ctx.clip();
    ctx.translate(hx, hy);
    ctx.rotate(-flight.roll * 0.9);
    ctx.translate(0, flight.pitch * 120);
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
    ctx.moveTo(hx - 16, hy);
    ctx.lineTo(hx + 16, hy);
    ctx.lineTo(hx, hy + 7);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#9fd8cf';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ATTITUDE', hx, hy + hr + 11);
    // --- altimeter ------------------------------------------------------------
    const ax = cx - 150;
    ctx.fillStyle = '#0d1a24';
    ctx.fillRect(ax - 62, panelY + 12, 124, 78);
    ctx.strokeStyle = '#22e6c8';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(ax - 62, panelY + 12, 124, 78);
    ctx.fillStyle = '#7dffd9';
    ctx.font = 'bold 30px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(String(Math.round(flight.alt)).padStart(4, '0'), ax, panelY + 52);
    ctx.fillStyle = '#9fd8cf';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('ALT  m', ax, panelY + 72);
    ctx.fillText(flight.verticalSpeed >= 0 ? `▲ ${flight.verticalSpeed.toFixed(1)} m/s` : `▼ ${Math.abs(flight.verticalSpeed).toFixed(1)} m/s`, ax, panelY + 86);
    // --- airspeed ---------------------------------------------------------------
    const sx = cx + 10;
    ctx.fillStyle = '#0d1a24';
    ctx.fillRect(sx - 62, panelY + 12, 124, 78);
    ctx.strokeStyle = '#22e6c8';
    ctx.strokeRect(sx - 62, panelY + 12, 124, 78);
    ctx.fillStyle = '#7dffd9';
    ctx.font = 'bold 30px monospace';
    ctx.fillText(String(Math.round(flight.speed / KT)), sx, panelY + 52);
    ctx.fillStyle = '#9fd8cf';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('SPEED  kt', sx, panelY + 72);
    ctx.fillText(flight.stalled ? '⚠ STALL' : `THR ${Math.round(flight.throttle * 100)}%`, sx, panelY + 86);
    // --- throttle + fuel -----------------------------------------------------------
    const tx = cx + 170;
    ctx.fillStyle = '#0d1a24';
    ctx.fillRect(tx - 14, panelY + 14, 16, 74);
    ctx.fillStyle = '#ff7a1a';
    ctx.fillRect(tx - 14, panelY + 88 - flight.throttle * 74, 16, flight.throttle * 74);
    ctx.strokeStyle = '#22e6c8';
    ctx.strokeRect(tx - 14, panelY + 14, 16, 74);
    ctx.fillStyle = '#9fd8cf';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('THR', tx + 8, panelY + 30);
    ctx.fillStyle = '#0d1a24';
    ctx.fillRect(tx + 44, panelY + 14, 16, 74);
    ctx.fillStyle = flight.fuel < 20 ? '#ff5252' : '#22e6c8';
    ctx.fillRect(tx + 44, panelY + 88 - (flight.fuel / 100) * 74, 16, (flight.fuel / 100) * 74);
    ctx.strokeStyle = '#22e6c8';
    ctx.strokeRect(tx + 44, panelY + 14, 16, 74);
    ctx.fillStyle = '#9fd8cf';
    ctx.fillText('FUEL', tx + 66, panelY + 30);
    ctx.fillText(`${Math.round(flight.fuel)}%`, tx + 66, panelY + 48);
    // --- hull + lives ----------------------------------------------------------------
    const lx = cx + 330;
    ctx.fillStyle = '#9fd8cf';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('HULL', lx, panelY + 30);
    ctx.fillStyle = '#0d1a24';
    ctx.fillRect(lx, panelY + 38, 110, 12);
    ctx.fillStyle = flight.hull < 40 ? '#ff5252' : '#22e6c8';
    ctx.fillRect(lx, panelY + 38, 110 * (flight.hull / 100), 12);
    ctx.fillStyle = '#9fd8cf';
    ctx.fillText('✈'.repeat(Math.max(0, flight.lives)), lx, panelY + 72);
    ctx.fillText(`LIVES ${flight.lives}`, lx + 56, panelY + 72);
    void time;
  }

  function drawCompass(flight) {
    const headingDeg = ((flight.heading * 180 / Math.PI) % 360 + 360) % 360;
    const cx = VIEW.width / 2;
    const y = 44;
    ctx.fillStyle = 'rgba(10, 16, 24, 0.78)';
    ctx.fillRect(cx - 220, y - 18, 440, 34);
    ctx.strokeStyle = 'rgba(34, 230, 200, 0.5)';
    ctx.strokeRect(cx - 220, y - 18, 440, 34);
    const points = [['N', 0], ['NE', 45], ['E', 90], ['SE', 135], ['S', 180], ['SW', 225], ['W', 270], ['NW', 315]];
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    for (const [label, deg] of points) {
      let diff = deg - headingDeg;
      while (diff > 180) diff -= 360;
      while (diff < -180) diff += 360;
      if (Math.abs(diff) > 105) continue;
      const x = cx + diff * 2.1;
      ctx.fillStyle = Math.abs(diff) < 8 ? '#ff7a1a' : '#cfe9f7';
      ctx.fillText(label, x, y + 5);
      ctx.fillStyle = '#9fd8cf';
      ctx.font = '10px monospace';
      ctx.fillText(String(deg).padStart(3, '0'), x, y + 16);
      ctx.font = 'bold 13px sans-serif';
    }
    ctx.fillStyle = '#ff7a1a';
    ctx.beginPath();
    ctx.moveTo(cx - 7, y - 20);
    ctx.lineTo(cx + 7, y - 20);
    ctx.lineTo(cx, y - 10);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#7dffd9';
    ctx.font = 'bold 15px monospace';
    ctx.fillText(`${String(Math.round(headingDeg)).padStart(3, '0')}°`, cx, y - 26);
  }

  function drawHud(flight, world, leg, best) {
    const headingDeg = ((flight.heading * 180 / Math.PI) % 360 + 360) % 360;
    // Top-left: the three numbers the brief demands, big and lit.
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(10, 16, 24, 0.78)';
    ctx.fillRect(14, 12, 330, 102);
    ctx.strokeStyle = 'rgba(34, 230, 200, 0.5)';
    ctx.strokeRect(14, 12, 330, 102);
    ctx.fillStyle = '#7dffd9';
    ctx.font = 'bold 24px monospace';
    ctx.fillText(`ALT ${String(Math.round(flight.alt)).padStart(4, '0')} m`, 26, 42);
    ctx.fillText(`SPD ${String(Math.round(flight.speed / KT)).padStart(3, '0')} kt`, 26, 72);
    ctx.fillText(`HDG ${String(Math.round(headingDeg)).padStart(3, '0')}°`, 26, 102);
    // Top-right: score, leg, rings, time, wind.
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(10, 16, 24, 0.78)';
    ctx.fillRect(VIEW.width - 344, 12, 330, 102);
    ctx.strokeStyle = 'rgba(34, 230, 200, 0.5)';
    ctx.strokeRect(VIEW.width - 344, 12, 330, 102);
    ctx.fillStyle = '#7dffd9';
    ctx.font = 'bold 20px monospace';
    ctx.fillText(`SCORE ${flight.score}`, VIEW.width - 26, 38);
    ctx.fillStyle = '#cfe9f7';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText(`${leg.name}  ·  RING ${flight.ringsHit}/${leg.rings}`, VIEW.width - 26, 60);
    const minutes = Math.floor(flight.legTime / 60);
    const seconds = Math.floor(flight.legTime % 60);
    const windKt = Math.round(Math.hypot(flight.windX, flight.windZ) / KT);
    ctx.fillText(`TIME ${minutes}:${String(seconds).padStart(2, '0')}  ·  WIND ${windKt} kt`, VIEW.width - 26, 80);
    ctx.fillStyle = '#9fd8cf';
    ctx.font = '11px sans-serif';
    ctx.fillText(`BEST ${best}`, VIEW.width - 26, 100);
    drawCompass(flight);
    // Next-ring beacon: distance and a steering arrow.
    const next = world.nextRing();
    if (next) {
      const dist = Math.hypot(next.x - flight.x, next.y - flight.alt, next.z - flight.z);
      const rel = bearingTo(flight, next);
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(10, 16, 24, 0.7)';
      ctx.fillRect(VIEW.width / 2 - 110, 108, 220, 30);
      ctx.fillStyle = '#22e6c8';
      ctx.font = 'bold 15px sans-serif';
      const arrow = rel > 0.25 ? '▶' : rel < -0.25 ? '◀' : '▲';
      ctx.fillText(`${arrow} NEXT RING ${Math.round(dist)} m`, VIEW.width / 2, 129);
    } else {
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(10, 16, 24, 0.7)';
      ctx.fillRect(VIEW.width / 2 - 150, 108, 300, 30);
      ctx.fillStyle = '#ff9f2e';
      ctx.font = 'bold 15px sans-serif';
      ctx.fillText('▼ LAND ON THE RUNWAY — FLARE SLOW', VIEW.width / 2, 129);
    }
    // Centre message and warnings.
    if (flight.messageTimer > 0 && flight.message) {
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(10, 16, 24, 0.75)';
      const w = ctx.measureText(flight.message).width + 36;
      ctx.fillRect(VIEW.width / 2 - w / 2, 158, w, 34);
      ctx.fillStyle = '#ffe9a8';
      ctx.font = 'bold 17px sans-serif';
      ctx.fillText(flight.message, VIEW.width / 2, 181);
    }
    if (flight.stalled) {
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ff5252';
      ctx.font = 'bold 26px sans-serif';
      ctx.fillText('⚠ STALL — NOSE DOWN, FULL THROTTLE', VIEW.width / 2, 210);
    } else if (flight.fuel < 20 && flight.fuel > 0) {
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffb02e';
      ctx.font = 'bold 22px sans-serif';
      ctx.fillText('⚠ LOW FUEL', VIEW.width / 2, 210);
    }
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
    ctx.fillRect(VIEW.width / 2 - 330, 286, 660, 150);
    ctx.strokeStyle = 'rgba(34, 230, 200, 0.6)';
    ctx.strokeRect(VIEW.width / 2 - 330, 286, 660, 150);
    ctx.fillStyle = '#7dffd9';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'left';
    const lines = [
      '← → / A D ......... bank kiri-kanan        ↑ ↓ / W S ......... naik-turun',
      'SHIFT / CTRL ..... throttle naik-turun     MOUSE ............ kemudikan pesawat',
      'SPASI / klik ....... rem (saat mendarat)   P pause · M suara · R ulangi',
      'Terbang lewati RING hijau berurutan, lalu mendarat di RUNWAY pulau tujuan.',
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
    ctx.font = 'bold 54px sans-serif';
    ctx.fillText(`SELAMAT DATANG DI ${leg.to.toUpperCase()}!`, VIEW.width / 2, 280);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 28px monospace';
    ctx.fillText(`BONUS MENDARAT +${bonus}`, VIEW.width / 2, 336);
    ctx.fillStyle = '#cfe9f7';
    ctx.font = '20px sans-serif';
    ctx.fillText(`Skor sementara: ${flight.score}  ·  Ring: ${flight.ringsHit}/${leg.rings}`, VIEW.width / 2, 376);
    ctx.fillStyle = '#ffe9a8';
    ctx.font = 'bold 22px sans-serif';
    const next = LEGS[Math.min(flight.leg + 1, LEGS.length - 1)];
    ctx.fillText(flight.leg + 1 < LEGS.length ? `Rute berikutnya: ${next.name} — tekan ENTER` : 'Semua rute selesai — tekan ENTER untuk terbang lagi', VIEW.width / 2, 436);
  }

  return {
    draw(state, screen, best, time, extra) {
      const { flight, world } = state;
      const leg = LEGS[Math.min(flight.leg, LEGS.length - 1)];
      const palette = PALETTES[leg.palette];
      ctx.clearRect(0, 0, VIEW.width, VIEW.height);
      drawSky(palette, flight, time);
      drawFarIslands(world, flight, palette);
      drawTerrain(world, flight, palette);
      drawRunway(world, flight, palette);
      drawRings(world, flight, time);
      drawPalms(world, flight);
      drawClouds(world, flight, palette);
      drawBirds(world, flight, time);
      if (leg.palette === 'storm') drawRain(palette, time, 0.7);
      drawPlane(flight, time);
      if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED || screen === SCREEN_LEG) {
        drawHud(flight, world, leg, best);
        drawPanel(flight, time);
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
