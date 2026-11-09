// Geometry shared by the build and the page: the numbers that place every part, and the few shapes
// that change while the figure runs (liquid in the burette and the flask, the stopcock key, the stir
// bar). The page inlines this file with its import and export words stripped, so it may only use `iso`.
import { iso } from "../../tools/anatomy/kit/iso-kit.mjs";

const RING = 40;

export const GEO = {
  azimuth: 60,
  base: { x: -64, y: -62, w: 172, d: 112, r: 6 },
  rod: [0, -48],
  stir: { plan: { x: -30, y: -30, w: 60, d: 60, r: 5 }, z0: 3, z1: 26, top: 28, front: 30 },
  flask: { c: [0, -1], z: 28, lip: 89 },
  bar: { half: 6.6, r: 1.25, z: 29.6 },
  burette: { c: [0, 2.5], rOut: 4.2, rIn: 3.4, glass: [112, 258], zero: 246, ml: 2.6, cock: 103, tip: 92.5 },
  cock: { z: 103, r: 3, front: 6, half: 6.4, wide: 1.2, thick: 1.3 },
  electrode: { c: [4.2, -4], r: 2.1, bulb: 2.5, top: 130, holder: 118 },
  clamp: 196,
  meter: { plan: { x: 50, y: -14, w: 46, d: 40, r: 3 }, z0: 2, z1: 24, front: 26 },
  bnc: [86, -4],
};

// Outside of the 100 mL conical flask as lathe knots [z above its base, r], and its inside.
export const FLASK_OUT = [
  [0, 0],
  [0, 25.4],
  [0.6, 26.6],
  [1.8, 27.3],
  [3.4, 27.4],
  [40, 9.8],
  [42.6, 8.6],
  [44.6, 8.4],
  [59, 8.4],
  [59, 0],
];
export const FLASK_INSIDE = [
  [0.9, 0.01],
  [1, 25.2],
  [3.2, 26.5],
  [39.8, 9],
  [42.4, 7.8],
  [59, 7.6],
];
export const BURETTE_INSIDE = [
  [GEO.burette.glass[0] - 4, 1.1],
  [GEO.burette.glass[0], GEO.burette.rIn],
  [GEO.burette.glass[1], GEO.burette.rIn],
];

const r1 = (value) => Math.round(value * 10) / 10;
export function elPath(points, closed = false) {
  if (!points.length) return "";
  return "M" + points.map(([x, y]) => `${r1(x)} ${r1(y)}`).join("L") + (closed ? "Z" : "");
}

export function elHull(points) {
  const sorted = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (sorted.length < 3) return sorted;
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [];
  for (const point of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], point) <= 0) lower.pop();
    lower.push(point);
  }
  const upper = [];
  for (let index = sorted.length - 1; index >= 0; index--) {
    const point = sorted[index];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], point) <= 0) upper.pop();
    upper.push(point);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

export function ringAt(cx, cy, r, z, P, from = 0, to = Math.PI * 2, n = RING, closed = true) {
  const out = [];
  const count = closed ? n : n + 1;
  for (let j = 0; j < count; j++) {
    const t = from + ((to - from) * j) / n;
    out.push(iso([cx + r * Math.cos(t), cy + r * Math.sin(t), z], P));
  }
  return out;
}

export function radiusIn(profile, z) {
  for (let index = 1; index < profile.length; index++) {
    const [z0, a] = profile[index - 1];
    const [z1, b] = profile[index];
    if (z <= z1) return a + ((b - a) * (z - z0)) / (z1 - z0 || 1);
  }
  return profile[profile.length - 1][1];
}

// The liquid below `level` (profile z measured from `base`): one convex frustum per profile band.
export function waterPath(cx, cy, profile, level, P, base = 0) {
  const parts = [];
  for (let index = 1; index < profile.length; index++) {
    const [z0raw] = profile[index - 1];
    if (z0raw >= level) break;
    const z0 = z0raw;
    const z1 = Math.min(profile[index][0], level);
    const a = radiusIn(profile, z0);
    const b = radiusIn(profile, z1);
    parts.push(elPath(elHull([...ringAt(cx, cy, a, base + z0, P), ...ringAt(cx, cy, b, base + z1, P)]), true));
  }
  return parts.join("");
}

export function surfaceOf(cx, cy, profile, level, P, base = 0) {
  const r = radiusIn(profile, level);
  const a = (GEO.azimuth * Math.PI) / 180;
  const z = base + level;
  return {
    top: elPath(ringAt(cx, cy, r, z, P), true),
    front: elPath(ringAt(cx, cy, r, z, P, a - Math.PI / 2, a + Math.PI / 2, 24, false)),
    back: elPath(ringAt(cx, cy, r, z, P, a + Math.PI / 2, a + Math.PI * 1.5, 24, false)),
  };
}

export const buretteLevel = (used) => GEO.burette.zero - used * GEO.burette.ml;

// The stopcock key: a flat paddle on the front of the barrel, across the tube when shut, along it when open.
export function keyOf(turn, P) {
  const c = GEO.cock;
  const [cx, cy] = GEO.burette.c;
  const s = Math.sin(turn);
  const q = Math.cos(turn);
  const corners = (y) =>
    [
      [-c.half, -c.wide],
      [c.half, -c.wide],
      [c.half, c.wide],
      [-c.half, c.wide],
    ].map(([u, v]) => iso([cx + u * q - v * s, y, c.z + u * s + v * q], P));
  const back = corners(cy + c.front);
  const face = corners(cy + c.front + c.thick);
  return { fill: elPath(elHull([...back, ...face]), true), face: elPath(face, true) };
}

// The stir bar: a PTFE capsule lying on the bottom, turned by `angle`.
export function barOf(angle, P) {
  const b = GEO.bar;
  const [cx, cy] = GEO.flask.c;
  const ring = [];
  for (let i = 0; i <= 10; i++) {
    const t = -Math.PI / 2 + (Math.PI * i) / 10;
    ring.push([b.half - b.r + Math.cos(t) * b.r, Math.sin(t) * b.r]);
  }
  for (let i = 0; i <= 10; i++) {
    const t = Math.PI / 2 + (Math.PI * i) / 10;
    ring.push([-b.half + b.r + Math.cos(t) * b.r, Math.sin(t) * b.r]);
  }
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const at = (z) => ring.map(([u, v]) => iso([cx + u * c - v * s, cy + u * s + v * c, z], P));
  const top = at(b.z + b.r * 1.6);
  const all = [...at(b.z), ...top];
  return { fill: elPath(elHull(all), true), top: elPath(top, true) };
}
