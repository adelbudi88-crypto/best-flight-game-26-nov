// Nusantara Air Courier — tuning, legs and layout in one place. Every number the
// flight model, the world and the renderer share lives here, so a balance change
// is one edit, never a hunt through the drawing code.
export const VIEW = { width: 1280, height: 720 };

export const STEP = 1 / 60;
export const KT = 0.514444; // metres per second in one knot

export const PLANE = {
  cruiseSpeed: 62, // m/s at full throttle, level flight
  minSpeed: 24, // below this the wing stops flying and the nose drops
  maxSpeed: 98,
  stallSpeed: 29,
  climbRate: 9.5, // m/s at full power, nose up
  sinkRate: 6.5,
  rollRate: 1.9, // rad/s toward the target bank
  pitchRate: 1.1,
  maxRoll: 1.05,
  maxPitch: 0.38,
  turnRate: 0.55, // heading change per second at full bank
  fuelBurn: 0.55, // percent per second at full throttle
  fuelCapacity: 100,
  hull: 100,
  lives: 3,
};

export const CAMERA = {
  distance: 11, // metres behind the plane
  height: 3.4, // metres above the plane
  fov: 1.15, // vertical field of view, radians
};

// One leg is one island hop: rings to thread, then a runway landing. The wind,
// the light and the weather get harsher every hop, and the pay gets better.
export const LEGS = [
  {
    name: 'Jakarta — Krakatau',
    from: 'Jakarta',
    to: 'Krakatau',
    rings: 6,
    wind: 2.5,
    windDir: 0.6,
    gust: 1.2,
    palette: 'day',
    ringBonus: 150,
    landingBonus: 400,
    parTime: 150,
  },
  {
    name: 'Krakatau — Bali',
    from: 'Krakatau',
    to: 'Bali',
    rings: 8,
    wind: 5.5,
    windDir: -0.9,
    gust: 2.6,
    palette: 'dusk',
    ringBonus: 200,
    landingBonus: 600,
    parTime: 180,
  },
  {
    name: 'Bali — Raja Ampat',
    from: 'Bali',
    to: 'Raja Ampat',
    rings: 10,
    wind: 9,
    windDir: 0.4,
    gust: 4.5,
    palette: 'storm',
    ringBonus: 250,
    landingBonus: 900,
    parTime: 220,
  },
];

export const PALETTES = {
  day: {
    skyTop: '#2f7fd0', skyMid: '#7ec0ee', skyLow: '#cfe9f7',
    sun: '#fff3b0', sunGlow: 'rgba(255, 240, 170, 0.55)',
    seaDeep: '#0b4f7a', sea: '#1478a8', seaShallow: '#2fa8a0',
    sand: '#e8d29a', grass: '#4d9b4f', forest: '#2e7d46',
    rock: '#8a7a6a', snow: '#f4f6f8', cloud: 'rgba(255,255,255,0.92)',
    haze: 'rgba(207, 233, 247, 0.55)', fog: 0.0016,
  },
  dusk: {
    skyTop: '#3a2d6b', skyMid: '#c65f6e', skyLow: '#ffb37a',
    sun: '#ffcf8a', sunGlow: 'rgba(255, 150, 80, 0.5)',
    seaDeep: '#1c2f5e', sea: '#2c4f7e', seaShallow: '#3f7d8c',
    sand: '#d9b078', grass: '#4a7d4a', forest: '#2c5c3e',
    rock: '#6e5a52', snow: '#e8d8d0', cloud: 'rgba(255, 205, 180, 0.85)',
    haze: 'rgba(255, 179, 122, 0.45)', fog: 0.0021,
  },
  storm: {
    skyTop: '#1c2436', skyMid: '#3c4a63', skyLow: '#6b7a8c',
    sun: '#cfd8e2', sunGlow: 'rgba(200, 210, 225, 0.3)',
    seaDeep: '#0a2438', sea: '#123f58', seaShallow: '#1d5f66',
    sand: '#b09a72', grass: '#3d7040', forest: '#244d33',
    rock: '#5e564e', snow: '#c9ced4', cloud: 'rgba(120, 130, 145, 0.9)',
    haze: 'rgba(107, 122, 140, 0.5)', fog: 0.0028,
  },
};

export const RING = { radius: 26, tube: 2.2, scoreFlash: 1.2 };
export const RUNWAY = { length: 260, width: 26, heading: 0 };
export const BEST_KEY = 'nusantara-air-courier-best';
export const SCORE_KEY = 'nusantara-air-courier-last';
