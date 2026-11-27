// The chase camera: a pinhole projection from world space (x east, y up, z
// north) to screen space. The camera sits behind and above the plane, looks
// along the plane's heading, and rolls a little with the bank so a turn feels
// like a turn. Everything the renderer draws goes through project().
import { CAMERA, VIEW } from './config.js';

export function createCamera() {
  const focal = (VIEW.height / 2) / Math.tan(CAMERA.fov / 2);
  return {
    focal,
    // Returns { x, y, scale, depth } in screen pixels, or null behind the camera.
    project(worldX, worldY, worldZ, plane) {
      // Camera position: behind the plane along its heading, above it.
      const backX = -Math.sin(plane.heading) * CAMERA.distance;
      const backZ = -Math.cos(plane.heading) * CAMERA.distance;
      const camX = plane.x + backX;
      const camY = plane.alt + CAMERA.height;
      const camZ = plane.z + backZ;
      // Look direction: from the camera toward a point ahead of the plane.
      const lookX = plane.x + Math.sin(plane.heading) * 30;
      const lookY = plane.alt + Math.sin(plane.pitch) * 30;
      const lookZ = plane.z + Math.cos(plane.heading) * 30;
      let fx = lookX - camX;
      let fy = lookY - camY;
      let fz = lookZ - camZ;
      const fl = Math.hypot(fx, fy, fz) || 1;
      fx /= fl;
      fy /= fl;
      fz /= fl;
      // Right vector, rolled with the plane's bank (half the bank, so the
      // horizon tilts but the pilot can still read it). Banking right rolls
      // the camera frame the same way, so the world appears to rotate the
      // other way: the basis turns by -roll around the forward axis.
      const roll = -plane.roll * 0.55;
      const cosR = Math.cos(roll);
      const sinR = Math.sin(roll);
      const upX = 0;
      const upY = 1;
      const upZ = 0;
      // right = normalize(cross(worldUp, forward)): east when facing north.
      let rX = upY * fz - upZ * fy;
      let rY = upZ * fx - upX * fz;
      let rZ = upX * fy - upY * fx;
      const rl = Math.hypot(rX, rY, rZ) || 1;
      rX /= rl;
      rY /= rl;
      rZ /= rl;
      // up = cross(forward, right): the one order that points at the sky.
      let uX = fy * rZ - fz * rY;
      let uY = fz * rX - fx * rZ;
      let uZ = fx * rY - fy * rX;
      // Roll right/up around the forward axis.
      const rrX = rX * cosR + uX * sinR;
      const rrY = rY * cosR + uY * sinR;
      const rrZ = rZ * cosR + uZ * sinR;
      const ruX = uX * cosR - rX * sinR;
      const ruY = uY * cosR - rY * sinR;
      const ruZ = uZ * cosR - rZ * sinR;
      const dx = worldX - camX;
      const dy = worldY - camY;
      const dz = worldZ - camZ;
      const depth = dx * fx + dy * fy + dz * fz;
      if (depth < 0.5) return null;
      const px = dx * rrX + dy * rrY + dz * rrZ;
      const py = dx * ruX + dy * ruY + dz * ruZ;
      const scale = focal / depth;
      return {
        x: VIEW.width / 2 + px * scale,
        y: VIEW.height / 2 - py * scale,
        scale,
        depth,
      };
    },
  };
}

// A point on the screen for a world position the pilot should look at: used
// for the next-ring beacon arrow. Returns null when it is behind the camera.
export function bearingTo(plane, target) {
  const dx = target.x - plane.x;
  const dz = target.z - plane.z;
  const worldBearing = Math.atan2(dx, dz);
  let relative = worldBearing - plane.heading;
  while (relative > Math.PI) relative -= Math.PI * 2;
  while (relative < -Math.PI) relative += Math.PI * 2;
  return relative;
}
