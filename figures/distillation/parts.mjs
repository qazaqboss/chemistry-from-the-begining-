// Geometry shared by the build and the page: the numbers that place every part, and the few shapes
// that change while the figure runs (liquid in the flask and the receiver, thermometer column,
// hotplate knob pointer, glow). The page inlines this file with its import and export words stripped,
// so it may only use `iso`.
import { iso } from "../../tools/anatomy/kit/iso-kit.mjs";

const RING = 40;
const TILT = (14 * Math.PI) / 180;

export const GEO = {
  azimuth: 60,
  plate: { x: -122, y: -56, w: 290, d: 108, r: 8 },
  hot: { plan: { x: -94, y: -30, w: 68, d: 60, r: 4 }, z0: 4, z1: 26, disc: 21, discTop: 29, front: 30 },
  knob: { x: -79, z: 14, face: 35.4, span: 135, ring: 3.6 },
  flask: { c: [-60, 0, 54], R: 24, r: 23.2, neck: 5.4, neckIn: 4.6, neckTop: 124 },
  stopper: [124, 130],
  therm: { bulb: [95, 103], r: 2.3, zero: 136, k: 0.6, top: 206 },
  // the side arm, condenser and adapter all lie on one axis tilted down by 14° from the neck at z 106
  axis: { o: [-60, 0, 106], u: [Math.cos(TILT), 0, -Math.sin(TILT)], tilt: TILT },
  arm: { r: 2.4, s0: 5, s1: 31 },
  sleeve: [[26, 36], [170, 180]],
  inner: { r: 2.3, s0: 31, s1: 176 },
  jacket: { s0: 40, s1: 156, R: 8, neck: 3.2, taper: 7 },
  nipples: { out: 52, in: 144 },
  clampAt: 98,
  rods: { flask: [-60, -44], cond: [32, -44] },
  recv: { c: [124, 0], lip: 46 },
  tip: [124, 0, 51],
  water: { y: 31, block: 7 },
};

export const along = (s) => {
  const { o, u } = GEO.axis;
  return [o[0] + u[0] * s, o[1] + u[1] * s, o[2] + u[2] * s];
};

const sphereAt = (z, r) => Math.sqrt(Math.max(0, r * r - (z - GEO.flask.c[2]) ** 2));

// Inside of the flask, [z, r] from the bottom up into the neck.
export const FLASK_INSIDE = (() => {
  const { c, r, neckIn } = GEO.flask;
  const bottom = c[2] - r;
  const join = c[2] + Math.sqrt(r * r - neckIn * neckIn);
  const rows = [[bottom, 0.01]];
  for (let z = Math.ceil(bottom); z < join; z += 1) rows.push([z, sphereAt(z, r)]);
  rows.push([join, neckIn], [GEO.flask.neckTop, neckIn]);
  return rows;
})();

// Outside of the receiver (a 100 mL conical flask), as lathe knots [z, r]; the inside is 0.8 thinner.
export const RECV_OUT = [
  [0, 0],
  [0, 18.8],
  [0.5, 19.9, 1],
  [1.6, 20.6, 1],
  [2.8, 20.7],
  [29.6, 7.6, 1],
  [31.6, 6.6, 1],
  [33.2, 6.4],
  [44.4, 6.4],
  [44.4, 0],
];
export const RECV_INSIDE = [
  [0.8, 0.01],
  [0.9, 18.6],
  [2.6, 19.8],
  [29.2, 6.9],
  [31.4, 5.8],
  [44.4, 5.6],
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

// The liquid below `level`: one convex frustum per profile band.
export function waterPath(cx, cy, profile, level, P, from = -Infinity) {
  const parts = [];
  for (let index = 1; index < profile.length; index++) {
    const [z0raw] = profile[index - 1];
    if (z0raw >= level) break;
    const [z1raw] = profile[index];
    if (z1raw <= from) continue;
    const z0 = Math.max(z0raw, from);
    const z1 = Math.min(z1raw, level);
    const a = radiusIn(profile, z0);
    const b = radiusIn(profile, z1);
    parts.push(elPath(elHull([...ringAt(cx, cy, a, z0, P), ...ringAt(cx, cy, b, z1, P)]), true));
  }
  return parts.join("");
}

// The liquid surface and its rim: back half faint, front half lit.
export function surfaceOf(cx, cy, profile, level, P) {
  const r = radiusIn(profile, level);
  const a = (GEO.azimuth * Math.PI) / 180;
  return {
    top: elPath(ringAt(cx, cy, r, level, P), true),
    front: elPath(ringAt(cx, cy, r, level, P, a - Math.PI / 2, a + Math.PI / 2, 24, false)),
    back: elPath(ringAt(cx, cy, r, level, P, a + Math.PI / 2, a + Math.PI * 1.5, 24, false)),
  };
}

// The thermometer column above the stopper, from the stopper to the reading.
export function columnOf(celsius, P) {
  const t = GEO.therm;
  const top = Math.max(GEO.stopper[1] + 0.5, t.zero + celsius * t.k);
  return elPath([iso([-60, 0, GEO.stopper[1]], P), iso([-60, 0, top], P)]);
}

export function pointerOf(power, P) {
  const n = GEO.knob;
  const t = ((-n.span + 2 * n.span * power) * Math.PI) / 180;
  const at = (r) => iso([n.x + Math.sin(t) * r, n.face, n.z + Math.cos(t) * r], P);
  return elPath([at(0), at(n.ring)]);
}
