// Geometry shared by the build and the page: the numbers that place every part, and the few
// shapes that change while the figure runs (water, menisci, stopcock keys, needle, knob pointer).
// The page inlines this file with its import and export words stripped, so it may only use `iso`.
import { iso } from "../../tools/anatomy/kit/iso-kit.mjs";

const RING = 40;
const R_O = 6;
const R_I = 5;
const bulbAt = (z, r) => Math.sqrt(Math.max(0, r * r - (z - 212) ** 2));

export const GEO = {
  azimuth: 60,
  rOut: R_O,
  rIn: R_I,
  glass: [26, 201],
  plug: 30,
  zero: 196,
  ml: 2.6,
  collar: [196, 201],
  foil: { half: 3.5, z0: 33, z1: 50 },
  tubes: { h2: [-42, 0], o2: [42, 0] },
  cross: { z: 56, r: 4 },
  res: [0, 0],
  bulb: { c: 212, r: 17, stem: 4, top: 244 },
  resZero: 197,
  cock: { body: [201, 206], z: 208.5, r: 3, front: 6.5, half: 7, wide: 1.3, thick: 1.3 },
  meter: { cx: 92, cz: 17.5, r: 12, y: 12, span: 50, full: 1.5 },
  knob: { x: 127, z: 25, y: 10, face: 17.2, ring: 4.6, span: 135 },
};

export const bulbRadius = (z) => bulbAt(z, 17);

// Inside of the reservoir, [z, r] from the cross tube up to the neck.
export const RES_INSIDE = (() => {
  const ri = GEO.bulb.stem - 0.8;
  const inner = GEO.bulb.r - 0.8;
  const join = GEO.bulb.c - Math.sqrt(inner * inner - ri * ri);
  const rows = [[GEO.cross.z, ri], [join, ri]];
  for (let z = Math.ceil(join); z < 2 * GEO.bulb.c - join; z += 1) rows.push([z, bulbAt(z, inner)]);
  rows.push([2 * GEO.bulb.c - join, ri], [GEO.bulb.top, ri]);
  return rows;
})();

export const OUT_INSIDE = [[GEO.plug, R_I], [GEO.collar[1], R_I]];

export const tubeLevel = (ml) => GEO.zero - ml * GEO.ml;

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

// The water body below `level`: one convex frustum per profile band, all wound the same way.
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

// The water surface and its rim: back half faint, front half lit.
export function surfaceOf(cx, cy, profile, level, P) {
  const r = radiusIn(profile, level);
  const a = (GEO.azimuth * Math.PI) / 180;
  return {
    top: elPath(ringAt(cx, cy, r, level, P), true),
    front: elPath(ringAt(cx, cy, r, level, P, a - Math.PI / 2, a + Math.PI / 2, 24, false)),
    back: elPath(ringAt(cx, cy, r, level, P, a + Math.PI / 2, a + Math.PI * 1.5, 24, false)),
  };
}

// The stopcock key: a flat paddle on the front of the barrel, horizontal when shut, upright when open.
export function keyOf(cx, turn, P) {
  const c = GEO.cock;
  const s = Math.sin(turn);
  const q = Math.cos(turn);
  const corners = (y) =>
    [
      [-c.half, -c.wide],
      [c.half, -c.wide],
      [c.half, c.wide],
      [-c.half, c.wide],
    ].map(([u, v]) => iso([cx + u * q - v * s, y, c.z + u * s + v * q], P));
  const back = corners(c.front);
  const face = corners(c.front + c.thick);
  return { fill: elPath(elHull([...back, ...face]), true), face: elPath(face, true) };
}

export function needleOf(amps, P) {
  const m = GEO.meter;
  const t = ((-m.span + (2 * m.span * Math.min(amps, m.full)) / m.full) * Math.PI) / 180;
  const at = (r) => iso([m.cx + Math.sin(t) * r, m.y + 0.1, m.cz + Math.cos(t) * r], P);
  return elPath([at(-1.6), at(m.r - 1.2)]);
}

export function pointerOf(volts, P) {
  const n = GEO.knob;
  const t = ((-n.span + (2 * n.span * volts) / 12) * Math.PI) / 180;
  const at = (r) => iso([n.x + Math.sin(t) * r, n.face, n.z + Math.cos(t) * r], P);
  return elPath([at(0), at(n.ring)]);
}
