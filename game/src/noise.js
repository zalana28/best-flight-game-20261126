// Seeded random numbers and smooth value noise for Gullwing Courier's world.
// Every number the world is built from comes from here, so the same seed always
// grows the same islands, runways and ring course.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash2(ix, iz, seed) {
  let h = (ix * 374761393 + iz * 668265263 + seed * 974634211) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (((h ^ (h >>> 16)) >>> 0) / 4294967296) * 2 - 1;
}

function smooth(t) {
  return t * t * (3 - 2 * t);
}

// One octave of value noise over the x/z plane, in roughly [-1, 1].
export function valueNoise(x, z, cell, seed) {
  const gx = x / cell;
  const gz = z / cell;
  const ix = Math.floor(gx);
  const iz = Math.floor(gz);
  const fx = smooth(gx - ix);
  const fz = smooth(gz - iz);
  const a = hash2(ix, iz, seed);
  const b = hash2(ix + 1, iz, seed);
  const c = hash2(ix, iz + 1, seed);
  const d = hash2(ix + 1, iz + 1, seed);
  const top = a + (b - a) * fx;
  const bottom = c + (d - c) * fx;
  return top + (bottom - top) * fz;
}

// Four octaves of value noise, normalised to roughly [-1, 1].
export function fbm(x, z, seed) {
  let sum = 0;
  let amp = 0.55;
  let cell = 260;
  for (let i = 0; i < 4; i++) {
    sum += valueNoise(x, z, cell, seed + i * 101) * amp;
    amp *= 0.5;
    cell *= 0.45;
  }
  return sum;
}

// Pick n items from an array with a seeded rng, Fisher-Yates style.
export function shuffledPick(rng, list, n) {
  const copy = list.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = copy[i];
    copy[i] = copy[j];
    copy[j] = tmp;
  }
  return copy.slice(0, n);
}
