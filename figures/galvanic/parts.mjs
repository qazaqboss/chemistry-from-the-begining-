// Geometry shared by the build and the page: the numbers that place every part, and the few shapes
// that change while the figure runs (the voltmeter needle, the switch blade). The page inlines this
// file with its import and export words stripped, so it may only use `iso`.
import { iso } from "../../tools/anatomy/kit/iso-kit.mjs";

const RING = 40;

export const GEO = {
  azimuth: 60,
  plate: { x: -104, y: -50, w: 210, d: 106, r: 8 },
  beakers: { zn: [-56, -16], cu: [56, -16] },
  beaker: { r: 22, rIn: 21.2, h: 52, lip: 53.6, level: 36 },
  lid: { z: 53.6, h: 3, half: 25.5, d: 6 },
  plate_: { half: 8, thick: 1.6, z0: 7, z1: 74 },
  terminal: { z0: 70, z1: 76 },
  bridge: { r: 3.2, y: -23, inset: 13, low: 20, high: 72 },
  meter: { plan: { x: -20, y: 12, w: 40, d: 24, r: 3 }, z0: 2, z1: 38, cx: 0, cz: 13, r: 15, span: 52 },
  posts: { minus: -11, plus: 11, y: 17 },
  sw: { plan: { x: 30, y: 28, w: 36, d: 14, r: 1.5 }, z: 3, hinge: [37, 35, 10], length: 22, open: 0.95, wide: 2.3, thick: 1.2 },
};

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

// The voltmeter needle for a reading in volts.
export function needleOf(volts, P, full) {
  const m = GEO.meter;
  const y = m.plan.y + m.plan.d + 0.1;
  const t = ((-m.span + (2 * m.span * Math.max(0, Math.min(volts, full))) / full) * Math.PI) / 180;
  const at = (r) => iso([m.cx + Math.sin(t) * r, y, m.cz + Math.cos(t) * r], P);
  return elPath([at(-2), at(m.r - 1.3)]);
}

// The knife switch's blade and its insulating handle, lifted by `lift` (0 closed … 1 open).
export function bladeOf(lift, P) {
  const s = GEO.sw;
  const [hx, hy, hz] = s.hinge;
  const a = lift * s.open;
  const c = Math.cos(a);
  const n = Math.sin(a);
  const map = (u, v, w) => iso([hx + u * c - v * n, hy + w, hz + u * n + v * c], P);
  const box = (u0, u1, v0, v1, w0, w1) => {
    const near = [[u0, v0], [u1, v0], [u1, v1], [u0, v1]].map(([u, v]) => map(u, v, w1));
    const far = [[u0, v0], [u1, v0], [u1, v1], [u0, v1]].map(([u, v]) => map(u, v, w0));
    return { fill: elPath(elHull([...near, ...far]), true), face: elPath(near, true) };
  };
  return {
    blade: box(-1.2, s.length, -s.wide, s.wide, -s.thick / 2, s.thick / 2),
    handle: box(s.length - 1.4, s.length + 2.4, s.wide, s.wide + 9, -1.9, 1.9),
  };
}
