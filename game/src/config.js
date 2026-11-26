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

// v2 — MANIFEST: named passengers and cargo per leg. `ring` is the ring
// that delivers that item (passing the ring = dropping it off on time).
// fare + tip are rupiah; tip is only paid when the leg is still fast
// (legTime under the item's due seconds). Mood changes the tip at stake.
export const MANIFESTS = [
  [
    { name: 'Bu Ratna', cargo: 'Obat darurat', dest: 'Krakatau', mood: 'MENDESAK', fare: 85000, tip: 35000, ring: 0, due: 45 },
    { name: 'Pak Dedi', cargo: 'Suku cadang', dest: 'Krakatau', mood: 'BURU-BURU', fare: 120000, tip: 30000, ring: 2, due: 80 },
    { name: 'Mbak Sari', cargo: 'Surat + paket pos', dest: 'Krakatau', mood: 'SANTAI', fare: 60000, tip: 10000, ring: 4, due: 130 },
    { name: 'Mas Yoga', cargo: 'Bibit kopi arabika', dest: 'Krakatau', mood: 'SANTAI', fare: 75000, tip: 15000, ring: 5, due: 150 },
  ],
  [
    { name: 'Pak Made', cargo: 'Canang sari', dest: 'Bali', mood: 'MENDESAK', fare: 95000, tip: 40000, ring: 1, due: 55 },
    { name: 'Bu Ayu', cargo: 'Kain endek Bali', dest: 'Bali', mood: 'BURU-BURU', fare: 140000, tip: 35000, ring: 3, due: 95 },
    { name: 'Dek Putu', cargo: 'Gamelan mini', dest: 'Bali', mood: 'SANTAI', fare: 80000, tip: 15000, ring: 5, due: 140 },
    { name: 'Pak Ketut', cargo: 'Beras merah Jatiluwih', dest: 'Bali', mood: 'BURU-BURU', fare: 110000, tip: 25000, ring: 7, due: 175 },
  ],
  [
    { name: 'Kak Yosua', cargo: 'Obat + vaksin', dest: 'Raja Ampat', mood: 'MENDESAK', fare: 150000, tip: 60000, ring: 2, due: 70 },
    { name: 'Bu Marta', cargo: 'Buku sekolah', dest: 'Raja Ampat', mood: 'BURU-BURU', fare: 90000, tip: 30000, ring: 4, due: 110 },
    { name: 'Bang Rudi', cargo: 'Alat selam', dest: 'Raja Ampat', mood: 'SANTAI', fare: 130000, tip: 20000, ring: 6, due: 160 },
    { name: 'Nona Sari', cargo: 'Kamera + film', dest: 'Raja Ampat', mood: 'SANTAI', fare: 100000, tip: 20000, ring: 9, due: 215 },
  ],
];

// v2 — GOALS: the per-leg checklist the judge sees ticked live.
export const GOALS = [
  [
    { id: 'cargo', label: 'Antar 3 kargo', target: 3 },
    { id: 'smooth', label: 'Landing mulus', target: 1 },
    { id: 'hull', label: 'Tanpa kerusakan', target: 1 },
  ],
  [
    { id: 'cargo', label: 'Antar 3 kargo', target: 3 },
    { id: 'smooth', label: 'Landing mulus', target: 1 },
    { id: 'hull', label: 'Tanpa kerusakan', target: 1 },
  ],
  [
    { id: 'cargo', label: 'Antar 4 kargo', target: 4 },
    { id: 'smooth', label: 'Landing mulus', target: 1 },
    { id: 'hull', label: 'Tanpa kerusakan', target: 1 },
  ],
];

// v2 — DIALOG: short lines from the crew and the passengers, fired by events.
// Deterministic: picked by leg / ring index, never random, so screenshots match.
export const DIALOGS = {
  takeoff: [
    { who: 'SARI (co-pilot)', line: 'Manifest lengkap, Kapten. Bu Ratna bawa obat — jangan telat!' },
    { who: 'SARI (co-pilot)', line: 'Canang sari Pak Made harus sampai sebelum upacara, Kapten.' },
    { who: 'SARI (co-pilot)', line: 'Badai di depan, Kapten. Vaksin Kak Yosua prioritas satu.' },
  ],
  ring: [
    { who: 'BU RATNA', line: 'Terima kasih, Nak! Obatnya sampai tepat waktu.' },
    { who: 'PAK DEDI', line: 'Pompa bisa jalan lagi. Kau penyelamat desa!' },
    { who: 'MBAK SARI', line: 'Paketnya utuh. Lima bintang untuk kurir ini!' },
    { who: 'MAS YOGA', line: 'Bibit kopi aman. Panen tahun depan kau yang antar lagi!' },
  ],
  landing: [
    { who: 'SARI (co-pilot)', line: 'Mendarat mulus! Penumpang senyum semua.' },
    { who: 'SARI (co-pilot)', line: 'Bali, kita sampai. Pura di ujung runway itu cantik, ya?' },
    { who: 'SARI (co-pilot)', line: 'Raja Ampat! Laguna biru itu — foto dulu sebelum bongkar.' },
  ],
  storm: [
    { who: 'SARI (co-pilot)', line: 'Awan hitam di depan! Pegang kemudi, jangan panik.' },
    { who: 'SARI (co-pilot)', line: 'Angin kencang — terbang rendah dan stabil.' },
  ],
  radio: [
    { who: 'SARI (co-pilot)', line: 'Menara, ini PK-NAC. Posisi aman, manifest lengkap.' },
    { who: 'SARI (co-pilot)', line: 'Bahan bakar cukup, Kapten. Lanjut ke ring berikutnya.' },
    { who: 'SARI (co-pilot)', line: 'Cuaca membaik di depan. Terbang terus!' },
  ],
};

// v2 — REFIT: upgrades bought between legs with earned rupiah (keys 1/2/3
// on the leg-complete screen). Each level stacks; price rises per level.
export const UPGRADES = [
  { id: 'fuel', key: '1', name: 'TANGKI EXTRA', desc: '+20 bahan bakar / level', base: 50000, step: 25000, max: 3 },
  { id: 'hull', key: '2', name: 'HULL BALUT BAJA', desc: 'Perbaiki 40 + tahan benturan', base: 60000, step: 30000, max: 3 },
  { id: 'engine', key: '3', name: 'MESIN TURBO', desc: '+6 kt kecepatan / level', base: 80000, step: 40000, max: 3 },
];

// v2 — island identity: what makes each destination read instantly.
export const PLACES = [
  { name: 'Krakatau', landmark: 'Gunung Anak Krakatau', note: 'gunung berapi + asap' },
  { name: 'Bali', landmark: 'Pura Uluwatu + sawah Jatiluwih', note: 'sawah terasering + pura' },
  { name: 'Raja Ampat', landmark: 'Laguna Wayag + karst', note: 'laguna biru + karst' },
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

// v2 — the four-stop route plan shown live (leg X/4 + ETA).
export const ROUTE_STOPS = ['Jakarta', 'Krakatau', 'Bali', 'Raja Ampat'];

// v2 — short rupiah: 125000 -> "Rp125rb", 85000 -> "Rp85rb".
export function rpShort(value) {
  if (value >= 1000000) return `Rp${(value / 1000000).toFixed(1)}jt`;
  if (value >= 1000) return `Rp${Math.round(value / 1000)}rb`;
  return `Rp${value}`;
}
