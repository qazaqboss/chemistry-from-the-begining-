// Hofmann voltameter: electrolysis of water.  node build.mjs  /  node build.mjs --light
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../../tools/anatomy/kit/iso-kit.mjs";
import * as G from "../../tools/anatomy/kit/lathe.mjs";
import { tubePieces, tubeSvg } from "../../tools/anatomy/kit/tube.mjs";
import { kitScript } from "../../tools/anatomy/scripts/inline-kit.mjs";
import * as M from "./model.mjs";
import { GEO, RES_INSIDE, OUT_INSIDE, tubeLevel, bulbRadius, waterPath, surfaceOf, keyOf, needleOf, pointerOf } from "./parts.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--light") ? "light" : "dark";

const WIDTH = 600;
const HEIGHT = 540;

const PLATE = { x: -126, y: -42, w: 290, d: 90, r: 8 };
const PLATE_H = 12;
const FOOT_H = 5;
const ROD = [0, -26];
const ROD_TOP = 256;
const BARS = [118, 174];
const SUP = { x: 74, y: -30, w: 74, d: 40, r: 3 };
const SUP_Z = 3;
const SUP_TOP = 40;
const FRONT = SUP.y + SUP.d;
const POSTS = { o2: 84, h2: 98 };
const POST_Z = 8;

// The state the page opens in (and keeps under reduced motion): 6 V for a while.
const START = { volts: 6, h2: 20, o2: 10 };
START.amps = M.cellCurrent(START.volts);

const P = k.fitProjection(
  [
    ...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0),
    [ROD[0], ROD[1], ROD_TOP + 2],
    [0, 0, GEO.bulb.top + 3],
    [GEO.tubes.h2[0] - 8, 0, 223],
    [GEO.tubes.o2[0] + 8, 0, 223],
  ],
  WIDTH,
  HEIGHT,
  { pad: 26, azimuth: GEO.azimuth },
);
const A = (GEO.azimuth * Math.PI) / 180;

const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const path = (points, closed = false) => k.pathOf(points, closed);
const byDepth = (points) => [...points].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));
const onFront = (y) => (x, z) => at([x, y, z]);
const onSide = (x) => (y, z) => at([x, y, z]);
// a rounded rectangle in a vertical plane, as [u, v] points
function rrect(u0, v0, u1, v1, r, steps = 4) {
  const out = [];
  const arc = (cu, cv, from) => {
    for (let i = 0; i <= steps; i++) {
      const t = from + (i / steps) * (Math.PI / 2);
      out.push([cu + Math.cos(t) * r, cv + Math.sin(t) * r]);
    }
  };
  arc(u1 - r, v1 - r, 0);
  arc(u0 + r, v1 - r, Math.PI / 2);
  arc(u0 + r, v0 + r, Math.PI);
  arc(u1 - r, v0 + r, Math.PI * 1.5);
  return out;
}
const arcIn = (map, cu, cv, r, from, to, n = 24) =>
  Array.from({ length: n + 1 }, (_, i) => {
    const t = ((from + ((to - from) * i) / n) * Math.PI) / 180;
    return map(cu + Math.sin(t) * r, cv + Math.cos(t) * r);
  });
function dialTicks(map, cu, cv, r, from, to, count, every, [minor, major]) {
  const out = { minor: [], major: [] };
  for (let i = 0; i < count; i++) {
    const t = ((from + ((to - from) * i) / (count - 1)) * Math.PI) / 180;
    const big = i % every === 0;
    const len = big ? major : minor;
    const d = path([map(cu + Math.sin(t) * r, cv + Math.cos(t) * r), map(cu + Math.sin(t) * (r + len), cv + Math.cos(t) * (r + len))]);
    (big ? out.major : out.minor).push(d);
  }
  return { minor: out.minor.join(""), major: out.major.join("") };
}
const surfacePoint = (cx, cy, r, theta, z) => at([cx + r * Math.cos(theta), cy + r * Math.sin(theta), z]);

// ---------------------------------------------------------------- base plate

function plate() {
  const out = [`<path class="iso-halo" d="${k.haloOf(PLATE, -PLATE_H - FOOT_H, PLATE_H, P)}"/>`];
  for (const [x, y] of byDepth(k.corners(PLATE, 22))) {
    out.push(S(k.cylinder(x, y, 7, -PLATE_H - FOOT_H, 1.6, P, 28), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 5.4, -PLATE_H - FOOT_H + 1.6, FOOT_H - 1.6, P, 28), { tone: "mid" }));
  }
  out.push(S(k.slabOf(PLATE, -PLATE_H, PLATE_H, P, 8, 1.6), { tone: "mid", inner: L(k.sideSeam(PLATE, -4, P, 8), { tone: "faint" }) }));
  out.push(L(k.planOutline(k.insetPlan(PLATE, 5), 0, P), { tone: "lo" }));
  const screws = k.corners(PLATE, 10);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 2.2, 0, P, 16)).join(""), { tone: "lo" }));
  out.push(D(screws.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
  // label plate with the equation engraved on it
  const tag = { x: -114, y: 14, w: 50, d: 22, r: 1.5 };
  out.push(S(k.slabOf(tag, 0, 0.8, P, 3), { tone: "lo", crease: "none" }));
  out.push(L(k.planOutline(k.insetPlan(tag, 1.6), 0.8, P, 3), { tone: "faint" }));
  out.push(k.faceTextSvg(k.topMatrix([tag.x + tag.w / 2, tag.y + 9.5], 0.8, P, "x"), "2H₂O → 2H₂ + O₂", { size: 3.4, tone: "mid", anchor: "middle" }));
  out.push(L(k.lineOnTop([tag.x + 9, tag.y + 14.5], [tag.x + tag.w - 9, tag.y + 14.5], 0.8, P), { tone: "lo", free: true }));
  out.push(L(k.lineOnTop([tag.x + 15, tag.y + 17.5], [tag.x + tag.w - 15, tag.y + 17.5], 0.8, P), { tone: "faint", free: true }));
  out.push(D([at([tag.x + 4, tag.y + tag.d / 2, 0.8]), at([tag.x + tag.w - 4, tag.y + tag.d / 2, 0.8])], { size: 0.5 }));
  return out.join("");
}

// ---------------------------------------------------------------- stand: rod, bosses, bars, clips, pillar

function thumbScrew(origin, axis, length = 4.4) {
  const F = G.frameAlong(origin, axis);
  return (
    S(G.disc(0, 1.4, 1.1, F, P), { tone: "mid" }) +
    S(G.disc(1.4, length, 2.4, F, P), { tone: "mid", inner: k.fadedSvg(G.ribsOf(F, 1.4, length, 2.4, 20, P, { fade: [0.1, 0.55] }), { tone: "lo" }) })
  );
}

function stand() {
  const out = [];
  const [rx, ry] = ROD;
  out.push(`<path class="iso-halo" d="${k.haloOf({ x: rx - 7, y: ry - 7, w: 14, d: 14, r: 7 }, 0, 0.1, P)}" style="filter:blur(3px)"/>`);
  out.push(S(k.cylinder(rx, ry, 7, 0, 6, P, 40, 0.5), { tone: "mid" }));
  out.push(thumbScrew([rx + 7, ry, 3], [1, 0, 0]));
  let from = 6;
  for (const zb of BARS) {
    out.push(S(k.cylinder(rx, ry, 3, from, zb - 3 - from, P, 28), { tone: "mid", crease: "none" }));
    const boss = { x: rx - 5, y: ry - 5, w: 10, d: 10, r: 1.5 };
    out.push(S(k.slabOf(boss, zb - 3, 10, P, 3, 0.5), { tone: "mid", inner: L(k.sideSeam(boss, zb + 2, P, 3), { tone: "faint" }) }));
    out.push(L(k.ring(rx, ry, 3.6, zb + 7, P, 24), { tone: "faint" }));
    out.push(thumbScrew([rx + 5, ry, zb + 2], [1, 0, 0], 5));
    const bar = { x: -49, y: ry + 5, w: 98, d: 4, r: 1 };
    out.push(S(k.slabOf(bar, zb, 4, P, 3, 0.4), { tone: "mid" }));
    for (const [cx, reach] of [[GEO.tubes.h2[0], GEO.rOut], [0, GEO.bulb.stem], [GEO.tubes.o2[0], GEO.rOut]]) {
      const clip = { x: cx - 3.5, y: bar.y + bar.d, w: 7, d: -reach + 0.6 - (bar.y + bar.d), r: 1 };
      out.push(S(k.slabOf(clip, zb - 1.5, 7, P, 3, 0.4), { tone: "mid" }));
      out.push(D([at([cx, clip.y + 3, zb + 5.5])], { size: 0.5 }));
      out.push(L(k.ring(cx, clip.y + 3, 1.3, zb + 5.5, P, 14), { tone: "lo" }));
    }
    out.push(D([at([bar.x + 3, bar.y + 2, zb + 4]), at([bar.x + bar.w - 3, bar.y + 2, zb + 4])], { size: 0.45 }));
    from = zb + 7;
  }
  out.push(S(k.cylinder(rx, ry, 3, from, ROD_TOP - from, P, 28), { tone: "mid", crease: "none" }));
  out.push(S(k.cylinder(rx, ry, 3.5, ROD_TOP, 2, P, 28, 0.4), { tone: "mid" }));
  return out.join("");
}

function pillar() {
  const out = [];
  const [cx, cy] = GEO.res;
  const seat = GEO.cross.z - GEO.cross.r;
  out.push(S(k.cylinder(cx, cy, 7.5, 0, 2, P, 40, 0.4), { tone: "lo" }));
  out.push(S(k.cylinder(cx, cy, 4, 2, seat - 6 - 2, P, 32), { tone: "mid", crease: "none", inner: L(k.sideArc(cx, cy, 4, 10, P, 16), { tone: "faint" }) }));
  const saddle = { x: cx - 6.5, y: cy - 5, w: 13, d: 10, r: 1.2 };
  out.push(S(k.slabOf(saddle, seat - 6, 6, P, 3, 0.4), { tone: "mid", inner: L(k.sideSeam(saddle, seat - 2, P, 3), { tone: "faint" }) }));
  return out.join("");
}

// ---------------------------------------------------------------- the two graduated tubes

function outerTube(name) {
  const [cx, cy] = GEO.tubes[name];
  const { rOut, rIn, plug, zero, ml } = GEO;
  const [g0, g1] = GEO.glass;
  const out = [];
  // electrode terminal under the stopper
  out.push(S(k.cylinder(cx, cy, 0.9, 11, 9, P, 16), { tone: "hi", crease: "none" }));
  out.push(S(k.cylinder(cx, cy, 2, 13.4, 2.2, P, 20), { tone: "mid", inner: L(k.knurl(cx, cy, 2, 13.4, 15.6, 10, P), { tone: "lo" }) }));
  out.push(S(k.cylinder(cx, cy, 5.8, 20, g0 - 20, P, 40, 0.4), { tone: "lo", inner: L(k.sideArc(cx, cy, 5.8, 23, P, 24), { tone: "faint" }) }));
  // glass
  const glass = k.cylinder(cx, cy, rOut, g0, g1 - g0, P, 48);
  out.push(`<path class="iso-fill" d="${glass.fill}"/>`);
  // water and what is in it
  const level = tubeLevel(START[name]);
  const surf = surfaceOf(cx, cy, OUT_INSIDE, level, P);
  out.push(`<path class="el-water" data-part="water-${name}" d="${waterPath(cx, cy, OUT_INSIDE, level, P)}"/>`);
  out.push(`<path class="el-water-top" data-part="top-${name}" d="${surf.top}"/>`);
  out.push(S(k.cylinder(cx, cy, rIn, g0, plug - g0, P, 40), { tone: "lo" }));
  const foilPlan = { x: cx - GEO.foil.half, y: cy - 0.3, w: GEO.foil.half * 2, d: 0.6, r: 0.2 };
  out.push(L(path([at([cx, cy, plug]), at([cx, cy + 0.3, GEO.foil.z0])]), { tone: "hi" }));
  out.push(D([at([cx, cy, plug])], { size: 0.6, tone: "hi" }));
  out.push(S(k.slabOf(foilPlan, GEO.foil.z0, GEO.foil.z1 - GEO.foil.z0, P, 2), { tone: "hi", crease: "lo" }));
  out.push(`<g data-part="bubbles-${name}">${Array.from({ length: name === "h2" ? 70 : 44 }, () => `<circle class="el-bubble" r="0" cx="0" cy="0"/>`).join("")}</g>`);
  out.push(`<path class="iso-line" data-tone="faint" data-part="back-${name}" d="${surf.back}"/>`);
  out.push(`<path class="iso-line" data-tone="lit" data-part="front-${name}" d="${surf.front}" style="stroke-width:.9"/>`);
  // the glass in front: inner wall, a shine, the graduation
  const walls = [A + Math.PI / 2, A - Math.PI / 2].map((t) => path([surfacePoint(cx, cy, rIn, t, plug), surfacePoint(cx, cy, rIn, t, g1 - 2)])).join("");
  out.push(L(walls, { tone: "faint" }));
  const shineAt = A + (48 * Math.PI) / 180;
  out.push(k.fadeLineSvg([surfacePoint(cx, cy, rOut, shineAt, 36), surfacePoint(cx, cy, rOut, shineAt, 188)], { fade: [18, 24], tone: "mid" }));
  const scaleAt = A + (24 * Math.PI) / 180;
  const tick = (n) => {
    const z = zero - n * ml;
    const span = n % 10 === 0 ? 40 : n % 5 === 0 ? 31 : 19;
    const pts = [0, 1].map((f) => surfacePoint(cx, cy, rOut + 0.05, scaleAt - (f * span * Math.PI) / 180, z));
    return path(pts);
  };
  const minor = [];
  const major = [];
  for (let n = 1; n <= M.CELL.scale; n++) (n % 5 === 0 ? major : minor).push(tick(n));
  out.push(L(path([surfacePoint(cx, cy, rOut + 0.05, scaleAt, zero), surfacePoint(cx, cy, rOut + 0.05, scaleAt, zero - M.CELL.scale * ml)]), { tone: "lo" }));
  out.push(L(minor.join(""), { tone: "lo" }), L(major.join(""), { tone: "mid" }));
  out.push(L(glass.outline, { tone: "hi", className: "iso-edge" }));
  // ground-glass collar and the stopcock
  const [c0, c1] = GEO.collar;
  out.push(S(k.cylinder(cx, cy, rOut + 0.8, c0, c1 - c0, P, 48, 0.4), { tone: "mid", inner: L(k.sideArc(cx, cy, rOut + 0.8, c0 + 2.5, P, 32), { tone: "faint" }) }));
  const c = GEO.cock;
  out.push(S(k.cylinder(cx, cy, 3.4, c.body[0], c.body[1] - c.body[0], P, 32), { tone: "hi" }));
  out.push(S(k.cylinder(cx, cy, 1.4, c.z, 13, P, 20), { tone: "hi", crease: "none" }));
  out.push(S(k.cylinder(cx, cy, 1.9, c.z + 11.6, 1.6, P, 20), { tone: "hi" }));
  const F = G.frameAlong([cx, cy, c.z], [0, 1, 0]);
  out.push(S(G.disc(-c.front, c.front, c.r, F, P), { tone: "hi", inner: L(G.arcOf(F, c.front - 2, c.r, P), { tone: "faint" }) }));
  const key = keyOf(cx, 0, P);
  out.push(
    `<g class="iso-solid" data-part="key-${name}"><path class="iso-fill" d="${key.fill}"/><path class="iso-top" d="${key.face}"/><path class="iso-line iso-crease" data-tone="faint" d="${key.face}"/><path class="iso-line iso-edge" data-tone="mid" d="${key.fill}"/></g>`,
  );
  out.push(D([at([cx, cy + c.front + c.thick, c.z])], { size: 0.6, tone: "mid" }));
  return out.join("");
}

// ---------------------------------------------------------------- the reservoir with its bulb, and the cross tube

function reservoir() {
  const [cx, cy] = GEO.res;
  const F = G.frameOf([cx, cy, 0], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
  const { c, r, stem, top } = GEO.bulb;
  const meet = c - Math.sqrt(r * r - stem * stem);
  const join = RES_INSIDE[1][0];
  const out = [];
  // stem, full of water up into the bulb
  const tube = k.cylinder(cx, cy, stem, GEO.cross.z, meet + 1 - GEO.cross.z, P, 32);
  out.push(`<path class="iso-fill" d="${tube.fill}"/>`);
  out.push(`<path class="el-water" d="${waterPath(cx, cy, RES_INSIDE, join, P)}"/>`);
  const shineAt = A + (48 * Math.PI) / 180;
  out.push(k.fadeLineSvg([surfacePoint(cx, cy, stem, shineAt, 64), surfacePoint(cx, cy, stem, shineAt, 186)], { fade: [18, 24], tone: "mid" }));
  out.push(L(tube.outline, { tone: "hi", className: "iso-edge" }));
  // the bulb: a sphere of glass
  const ball = G.sphereOf([cx, cy, c], r, P, { steps: 96 });
  out.push(`<path class="iso-fill" d="${ball.fill}"/>`);
  const level = M.levelFor(M.volumeTable(RES_INSIDE, GEO.resZero), (START.h2 + START.o2) * Math.PI * GEO.rIn ** 2 * GEO.ml);
  const surf = surfaceOf(cx, cy, RES_INSIDE, level, P);
  out.push(`<path class="el-water" data-part="water-res" d="${waterPath(cx, cy, RES_INSIDE, level, P, join)}"/>`);
  out.push(`<path class="el-water-top" data-part="top-res" d="${surf.top}"/>`);
  out.push(`<path class="iso-line" data-tone="faint" data-part="back-res" d="${surf.back}"/>`);
  out.push(`<path class="iso-line" data-tone="hi" data-part="front-res" d="${surf.front}"/>`);
  const arc = [];
  const [sx, sy] = at([cx, cy, c]);
  const rho = r * G.scaleOf(P) * 0.8;
  for (let a = 196; a <= 252; a += 4) arc.push([sx + rho * Math.cos((a * Math.PI) / 180), sy + rho * Math.sin((a * Math.PI) / 180)]);
  out.push(k.fadeLineSvg(arc, { fade: [9, 9], tone: "mid" }));
  out.push(L(ball.outline, { tone: "hi", className: "iso-edge" }));
  // neck and lip
  const neck0 = 2 * c - meet - 1;
  const neck = k.cylinder(cx, cy, stem, neck0, top - neck0, P, 32);
  out.push(S(neck, { tone: "hi", flat: true, crease: "none" }));
  out.push(S(G.ringBand(top, top + 3, stem - 0.8, stem + 1.4, F, P), { tone: "hi" }));
  out.push(`<path class="el-void" d="${G.circleOf(F, top + 3, stem - 0.8, P)}"/>`);
  out.push(L(G.circleOf(F, top + 3, stem - 0.8, P), { tone: "mid" }));
  return out.join("");
}

function crossTube() {
  const { z, r } = GEO.cross;
  const reach = Math.abs(GEO.tubes.h2[0]) - Math.sqrt(GEO.rOut ** 2 - r ** 2);
  const F = G.frameAlong([0, 0, z], [1, 0, 0]);
  const body = G.disc(-reach, reach, r, F, P);
  const shine = [];
  const t = G.angleToward(F, [-0.6, 0.5, 0.62]);
  for (let s = -reach + 2; s <= reach - 2; s += 4) shine.push(at(G.pointOf(F, s, r, t)));
  return `<path class="el-water" d="${body.fill}"/>${k.fadeLineSvg(shine, { fade: [10, 10], tone: "mid" })}${L(body.outline, { tone: "hi", className: "iso-edge" })}`;
}

// ---------------------------------------------------------------- the power supply

function supply() {
  const out = [];
  const front = onFront(FRONT);
  out.push(`<path class="iso-halo" d="${k.haloOf(k.insetPlan(SUP, 2), 0, 0.1, P)}" style="filter:blur(5px)"/>`);
  for (const [x, y] of byDepth(k.corners(SUP, 7))) out.push(S(k.cylinder(x, y, 2.6, 0, SUP_Z, P, 20), { tone: "lo" }));
  out.push(S(k.slabOf(SUP, SUP_Z, SUP_TOP - SUP_Z, P, 4, 0.8), { tone: "mid", inner: L(k.sideSeam(SUP, 33, P, 4), { tone: "faint" }) }));
  // vents on top and on the side, handle
  for (let i = 0; i < 8; i++) out.push(L(k.planOutline({ x: 96 + i * 5, y: SUP.y + 3, w: 2, d: 10, r: 1 }, SUP_TOP, P, 3), { tone: "lo" }));
  const side = onSide(SUP.x + SUP.w);
  for (let i = 0; i < 3; i++) out.push(L(path(rrect(-24, 12 + i * 6, -4, 14 + i * 6, 1).map(([u, v]) => side(u, v)), true), { tone: "lo" }));
  for (const x of [86, 136]) out.push(S(k.cylinder(x, -8, 1.6, SUP_TOP, 5, P, 16), { tone: "mid", crease: "none" }));
  out.push(S(k.slabOf({ x: 83, y: -10, w: 56, d: 4, r: 2 }, SUP_TOP + 5, 3, P, 4, 0.4), { tone: "mid" }));
  out.push(D([at([SUP.x + 4, SUP.y + 4, SUP_TOP]), at([SUP.x + SUP.w - 4, SUP.y + 4, SUP_TOP]), at([SUP.x + 4, FRONT - 4, SUP_TOP]), at([SUP.x + SUP.w - 4, FRONT - 4, SUP_TOP])], { size: 0.45 }));
  // panel
  out.push(L(path(rrect(SUP.x + 2.5, SUP_Z + 2.2, SUP.x + SUP.w - 2.5, SUP_TOP - 4.5, 1.5).map(([u, v]) => front(u, v)), true), { tone: "faint" }));
  // meter
  const m = GEO.meter;
  out.push(S(k.slabOf({ x: 78, y: FRONT, w: 28, d: m.y - FRONT, r: 0.6 }, 14, 22, P, 2), { tone: "mid" }));
  const face = onFront(m.y);
  out.push(`<path class="el-window" d="${path(rrect(80, 16, 104, 34, 1).map(([u, v]) => face(u, v)), true)}"/>`);
  out.push(L(path(rrect(80, 16, 104, 34, 1).map(([u, v]) => face(u, v)), true), { tone: "lo" }));
  out.push(L(path(arcIn(face, m.cx, m.cz, m.r, -m.span, m.span)), { tone: "lo" }));
  const mt = dialTicks(face, m.cx, m.cz, m.r, -m.span, m.span, 16, 5, [1.2, 2.2]);
  out.push(L(mt.minor, { tone: "lo" }), L(mt.major, { tone: "mid" }));
  out.push(`<path class="iso-line" data-tone="hi" data-free="" data-part="needle" d="${needleOf(START.amps, P)}" style="stroke-width:.9"/>`);
  out.push(D([face(m.cx, m.cz)], { size: 1, tone: "hi" }));
  // knob with its scale
  const n = GEO.knob;
  out.push(L(path(arcIn(front, n.x, n.z, 9.5, -n.span, n.span, 36)), { tone: "lo" }));
  const kt = dialTicks(front, n.x, n.z, 9.5, -n.span, n.span, 13, 6, [1.2, 2.2]);
  out.push(L(kt.minor, { tone: "lo" }), L(kt.major, { tone: "mid" }));
  const KF = G.frameAlong([n.x, FRONT, n.z], [0, 1, 0]);
  out.push(S(G.disc(0, 1.2, 7.6, KF, P), { tone: "mid" }));
  out.push(S(G.disc(1.2, n.face - FRONT, 6.2, KF, P), { tone: "mid", inner: k.fadedSvg(G.ribsOf(KF, 1.2, n.face - FRONT, 6.2, 44, P, { fade: [0.1, 0.55] }), { tone: "lo" }) }));
  out.push(L(G.circleOf(KF, n.face - FRONT, n.ring, P), { tone: "faint" }));
  out.push(`<path class="iso-line" data-tone="hi" data-part="pointer" d="${pointerOf(START.volts, P)}" style="stroke-width:.9"/>`);
  out.push(D([at([n.x, n.face, n.z])], { size: 0.7, tone: "hi" }));
  // switch and pilot lamp
  out.push(S(k.slabOf({ x: 136.5, y: FRONT, w: 7, d: 1.6, r: 0.6 }, 6, 6, P, 2, 0.3), { tone: "mid" }));
  out.push(D([at([140, FRONT + 1.6, 7.6])], { size: 0.5, tone: "mid" }));
  const LF = G.frameAlong([140, FRONT, 18], [0, 1, 0]);
  out.push(S(G.disc(0, 1, 2.6, LF, P), { tone: "mid" }));
  out.push(S(G.disc(1, 2.2, 1.7, LF, P), { tone: "hi" }));
  out.push(`<circle class="el-lamp" data-part="lamp" data-on="" cx="${at([140, FRONT + 2.2, 18])[0].toFixed(1)}" cy="${at([140, FRONT + 2.2, 18])[1].toFixed(1)}" r="1.1"/>`);
  // binding posts with banana plugs
  for (const [name, x] of Object.entries(POSTS)) {
    const PF = G.frameAlong([x, FRONT, POST_Z], [0, 1, 0]);
    out.push(S(G.disc(0, 1.4, 2.8, PF, P), { tone: "lo" }));
    out.push(S(G.disc(1.4, 3.6, 1.3, PF, P), { tone: "mid" }));
    out.push(S(G.disc(3.6, 6.4, 2.4, PF, P), { tone: "mid", inner: k.fadedSvg(G.ribsOf(PF, 3.6, 6.4, 2.4, 18, P, { fade: [0.1, 0.55] }), { tone: "lo" }) }));
    out.push(S(G.disc(6.4, 7.8, 1.5, PF, P), { tone: "hi" }));
    out.push(S(G.disc(7.8, 9, 1.9, PF, P), { tone: "hi" }));
    out.push(S(G.disc(9, 10.4, 1.5, PF, P), { tone: "hi" }));
    out.push(k.faceTextSvg(k.sideMatrix([x + 5, FRONT], POST_Z - 1.2, P, "left"), name === "h2" ? "−" : "+", { size: 3.6, tone: "mid", anchor: "middle" }));
  }
  return out.join("");
}

// ---------------------------------------------------------------- cables from the posts to the electrodes

function cables() {
  const tail = 10.4;
  const routes = [
    [[POSTS.h2, FRONT + tail, POST_Z], [POSTS.h2, FRONT + 16, POST_Z], [POSTS.h2, 36, 0.9], [GEO.tubes.h2[0], 36, 0.9], [GEO.tubes.h2[0], 0, 0.9], [GEO.tubes.h2[0], 0, 11]],
    [[POSTS.o2, FRONT + tail, POST_Z], [POSTS.o2, FRONT + 15, POST_Z], [POSTS.o2, 29, 0.9], [GEO.tubes.o2[0], 29, 0.9], [GEO.tubes.o2[0], 0, 0.9], [GEO.tubes.o2[0], 0, 11]],
  ];
  return routes
    .map((route) =>
      tubePieces(G.fillet(route, 3.2, 8, { P, tube: 0.85 }), 0.85, P, { maxLength: 400 })
        .map((piece) => tubeSvg(piece, { tone: "mid" }))
        .join(""),
    )
    .join("");
}

const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label:
    "Прибор Гофмана для электролиза воды: три стеклянные трубки на штативе, соединённые внизу поперечной трубкой. В двух крайних градуированных трубках внизу стоят платиновые электроды, провода идут к источнику постоянного тока с ручкой напряжения и стрелочным амперметром. Над катодом собирается водород, над анодом кислород, водорода всегда вдвое больше; вытесненная вода поднимается в шар средней трубки.",
  body: [plate(), stand(), pillar(), outerTube("h2"), reservoir(), crossTube(), outerTube("o2"), supply(), cables()],
});

// ---------------------------------------------------------------- the page

const strip = (file) =>
  readFileSync(join(HERE, file), "utf8")
    .replace(/^import .*$/gm, "")
    .replace(/^export /gm, "");

const live = `{
${strip("model.mjs")}
${strip("parts.mjs")}
const P = ${JSON.stringify(P)};
const START = ${JSON.stringify(START)};
const stage = document.querySelector(".iso-stage");
const svg = stage.querySelector("svg");
const part = (name) => svg.querySelector('[data-part="' + name + '"]');
const readout = document.querySelector("[data-readout]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const TABLE = volumeTable(RES_INSIDE, GEO.resZero);
const PER_ML = Math.PI * GEO.rIn ** 2 * GEO.ml;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const tubes = ["h2", "o2"].map((name) => ({
  name,
  at: GEO.tubes[name],
  water: part("water-" + name), top: part("top-" + name), front: part("front-" + name), back: part("back-" + name),
  key: part("key-" + name),
  dots: [...part("bubbles-" + name).children],
  live: [], emit: 0, size: name === "h2" ? [0.45, 0.8] : [0.6, 1.1],
}));
const res = { water: part("water-res"), top: part("top-res"), front: part("front-res"), back: part("back-res") };
const needle = part("needle"), pointer = part("pointer"), lamp = part("lamp");

const s = {
  volts: START.volts, target: START.volts, gas: { h2: START.h2, o2: START.o2 },
  needle: { x: START.amps, v: 0 }, turn: 0, open: false, openAt: 0, clock: 0,
};
let drawn = {};
function drawLevels() {
  const key = s.gas.h2.toFixed(3);
  if (drawn.levels === key) return;
  drawn.levels = key;
  for (const t of tubes) {
    const level = tubeLevel(s.gas[t.name]);
    const f = surfaceOf(t.at[0], t.at[1], OUT_INSIDE, level, P);
    t.water.setAttribute("d", waterPath(t.at[0], t.at[1], OUT_INSIDE, level, P));
    t.top.setAttribute("d", f.top); t.front.setAttribute("d", f.front); t.back.setAttribute("d", f.back);
  }
  const level = levelFor(TABLE, (s.gas.h2 + s.gas.o2) * PER_ML);
  const f = surfaceOf(GEO.res[0], GEO.res[1], RES_INSIDE, level, P);
  res.water.setAttribute("d", waterPath(GEO.res[0], GEO.res[1], RES_INSIDE, level, P, RES_INSIDE[1][0]));
  res.top.setAttribute("d", f.top); res.front.setAttribute("d", f.front); res.back.setAttribute("d", f.back);
}
function drawKeys() {
  const key = s.turn.toFixed(3);
  if (drawn.turn === key) return;
  drawn.turn = key;
  for (const t of tubes) {
    const shape = keyOf(t.at[0], s.turn, P);
    const [fill, top, crease, edge] = t.key.children;
    fill.setAttribute("d", shape.fill); top.setAttribute("d", shape.face); crease.setAttribute("d", shape.face); edge.setAttribute("d", shape.fill);
  }
}
function drawBubbles() {
  for (const t of tubes) {
    t.dots.forEach((dot, i) => {
      const b = t.live[i];
      if (!b) { if (dot.getAttribute("r") !== "0") dot.setAttribute("r", "0"); return; }
      const [x, y] = iso([t.at[0] + b.x + Math.sin(b.ph + b.z * 0.21) * 0.45, t.at[1] + b.y, b.z], P);
      dot.setAttribute("cx", x.toFixed(1)); dot.setAttribute("cy", y.toFixed(1)); dot.setAttribute("r", (b.r * P.scale * 1.26).toFixed(2));
    });
  }
}
function draw() {
  const amps = cellCurrent(s.volts);
  drawLevels();
  drawKeys();
  drawBubbles();
  needle.setAttribute("d", needleOf(s.needle.x, P));
  pointer.setAttribute("d", pointerOf(s.volts, P));
  if (amps > 0) lamp.setAttribute("data-on", ""); else lamp.removeAttribute("data-on");
  const text = readoutOf({ volts: s.volts, amps, h2: s.gas.h2, o2: s.gas.o2 });
  if (readout.textContent !== text) readout.textContent = text;
}
function spawn(t, dt, amps) {
  const made = gasRates(amps)[t.name] * CELL.speed;
  t.emit += made * dt * 2.6;
  while (t.emit >= 1) {
    t.emit -= 1;
    if (t.live.length >= t.dots.length) continue;
    const [lo, hi] = t.size;
    t.live.push({ x: (Math.random() * 2 - 1) * (GEO.foil.half - 1.1), y: 0.7 + Math.random() * 1.6, z: GEO.foil.z0 + 2 + Math.random() * (GEO.foil.z1 - GEO.foil.z0 - 2), r: lo + Math.random() * (hi - lo), v: 0, ph: Math.random() * 6.3 });
  }
  const level = tubeLevel(s.gas[t.name]);
  for (const b of t.live) { b.v = Math.min(b.v + 160 * dt, 44 + b.r * 18); b.z += b.v * dt; }
  t.live = t.live.filter((b) => b.z + b.r < level - 0.2);
}

// ---- tour, input, loop
let touring = !still.matches, phase = "run", phaseAt = 0, idle = 0, frame = 0, last = 0, visible = false;
function vent() { s.open = true; s.openAt = s.clock; }
function tour() {
  const age = s.clock - phaseAt;
  const go = (next) => { phase = next; phaseAt = s.clock; };
  if (phase === "run") { s.target = 7.5; if (s.gas.h2 >= 36) go("off"); }
  else if (phase === "off") { s.target = 0; if (age > 1.3) { vent(); go("vent"); } }
  else if (phase === "vent") { s.target = 0; if (age > 2.4) go("low"); }
  else if (phase === "low") { s.target = 1.5; if (age > 2.6) go("run"); }
}
function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  s.clock += dt;
  if (touring) tour();
  s.volts += (s.target - s.volts) * (1 - Math.exp(-dt / 0.2));
  if (Math.abs(s.target - s.volts) < 0.004) s.volts = s.target;
  const amps = cellCurrent(s.volts);
  if (s.open && s.clock - s.openAt > 1.6 && s.gas.h2 === 0) s.open = false;
  s.gas = stepGas(s.gas, amps, dt, s.open);
  if (!s.open && s.gas.h2 >= CELL.scale) vent();
  const want = s.open ? Math.PI / 2 : 0;
  s.turn += (want - s.turn) * (1 - Math.exp(-dt / 0.12));
  if (Math.abs(want - s.turn) < 0.002) s.turn = want;
  for (let i = 0; i < 4; i++) { s.needle.v += ((amps - s.needle.x) * 90 - s.needle.v * 11) * dt / 4; s.needle.x += s.needle.v * dt / 4; }
  if (Math.abs(amps - s.needle.x) < 5e-4 && Math.abs(s.needle.v) < 5e-4) { s.needle.x = amps; s.needle.v = 0; }
  for (const t of tubes) spawn(t, dt, amps);
  draw();
  const settled = !touring && s.volts === s.target && amps === 0 && !s.open && s.turn === 0 && s.needle.v === 0 && tubes.every((t) => !t.live.length);
  frame = visible && !settled ? requestAnimationFrame(tick) : 0;
}
const run = () => { if (!frame && visible && !still.matches) { last = 0; frame = requestAnimationFrame(tick); } };
function describe() {
  stage.setAttribute("aria-valuenow", s.target.toFixed(1));
  stage.setAttribute("aria-valuetext", "Напряжение " + s.target.toFixed(1).replace(".", ",") + " В");
}
function hold() {
  touring = false;
  clearTimeout(idle);
  idle = setTimeout(() => { if (!still.matches) { touring = true; phase = s.gas.h2 >= 36 ? "off" : "run"; phaseAt = s.clock; run(); } }, 3600);
}
function calmDraw() {
  if (!still.matches) return;
  s.volts = s.target; s.needle.x = cellCurrent(s.volts); s.needle.v = 0; s.turn = 0;
  draw();
}
function steer(volts) {
  hold();
  s.target = Math.round(clamp(volts, 0, CELL.maxVolts) * 10) / 10;
  describe();
  calmDraw();
  run();
}
function reset() {
  hold();
  if (still.matches) { s.gas = { h2: 0, o2: 0 }; calmDraw(); return; }
  vent();
  run();
}
let down = null;
stage.addEventListener("pointermove", (event) => {
  const box = svg.getBoundingClientRect();
  if (down && event.pointerType !== "mouse") {
    if (Math.abs(event.clientX - down.x) > 6) down.moved = true;
    steer(down.volts + ((event.clientX - down.x) / box.width) * 20);
    return;
  }
  if (event.pointerType === "mouse") {
    if (down && Math.abs(event.clientX - down.x) > 6) down.moved = true;
    steer(((event.clientX - box.left) / box.width - 0.14) / 0.72 * CELL.maxVolts);
  }
});
stage.addEventListener("pointerdown", (event) => {
  down = { x: event.clientX, volts: s.target, at: performance.now(), moved: false };
  if (event.pointerType !== "mouse") { try { stage.setPointerCapture(event.pointerId); } catch {} }
});
const release = (event) => {
  if (down && !down.moved && event.type === "pointerup" && performance.now() - down.at < 600) reset();
  down = null;
};
stage.addEventListener("pointerup", release);
stage.addEventListener("pointercancel", release);
stage.addEventListener("keydown", (event) => {
  const step = event.shiftKey ? 2 : 0.5;
  const from = touring ? Math.round(s.volts * 2) / 2 : s.target;
  let to = null;
  if (event.key === "ArrowRight" || event.key === "ArrowUp") to = from + step;
  if (event.key === "ArrowLeft" || event.key === "ArrowDown") to = from - step;
  if (event.key === "Home") to = 0;
  if (event.key === "End") to = CELL.maxVolts;
  if (event.key === " " || event.key === "Enter") { event.preventDefault(); reset(); return; }
  if (to === null) return;
  event.preventDefault();
  steer(to);
});
new IntersectionObserver((entries) => { visible = entries[entries.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "120px 0px" }).observe(stage);
still.addEventListener?.("change", () => { if (still.matches) { touring = false; for (const t of tubes) t.live = []; calmDraw(); } else { touring = true; run(); } });
describe();
draw();
}
{
const embedded = window.parent !== window;
if (embedded) document.documentElement.classList.add("embed");
// documentElement.scrollHeight never drops below the iframe's own height, so measure the content
// the same way it would (page box plus its margins) to let the parent shrink the frame as well as grow it.
const heightOf = () => { const main = document.querySelector(".iso-page"); return main ? Math.ceil(main.getBoundingClientRect().height) : document.documentElement.scrollHeight; };
const post = () => { if (embedded) parent.postMessage({ type: "figure-height", height: heightOf() }, "*"); };
addEventListener("load", post);
addEventListener("resize", post);
if (window.ResizeObserver) new ResizeObserver(post).observe(document.body);
post();
}
`;

const CSS = `
.iso{--el-water:#202428;--el-water-top:#292e33}
.iso[data-theme="light"]{--el-water:#e7eaec;--el-water-top:#f0f2f3}
.iso-page{width:100%;max-width:820px;margin:0 auto;padding:12px}
html.embed .iso-page{max-width:none}
html.embed{color-scheme:normal}
html.embed,html.embed body{background:transparent;overflow:hidden}
.iso-figure{margin:0}
.iso-stage{touch-action:pan-y;outline:none;cursor:ew-resize;-webkit-tap-highlight-color:transparent}
.iso-stage:focus-visible{outline:1px solid var(--anatomy-muted);outline-offset:6px}
.el-water{fill:var(--el-water);stroke:none}
.el-water-top{fill:var(--el-water-top);stroke:none}
.el-bubble{fill:var(--anatomy-paper);stroke:var(--anatomy-mid);stroke-width:.5}
.el-void{fill:var(--anatomy-shade-0);stroke:none}
.el-window{fill:var(--anatomy-face);stroke:none}
.el-lamp{fill:var(--anatomy-dot);opacity:.12;transition:opacity .3s}
.el-lamp[data-on]{opacity:.9}
@media (max-width:560px){.iso-page{padding:6px}.iso-plate{overflow:hidden}.iso-plate .iso-svg{width:118%;margin:-4% -9% -6%}}
`;

const body = k.plateHtml({
  fig: "Рис. 1",
  title: "Электролиз воды",
  hint: "Крутите ручку ← →, клик — сброс",
  readout: M.readoutOf({ volts: START.volts, amps: START.amps, h2: START.h2, o2: START.o2 }),
  keys: [
    { mark: "lit", label: "Граница воды и газа в трубках" },
    { mark: "raised", label: "Слева катод (−) и водород, справа анод (+) и кислород" },
  ],
  caption:
    "Прибор Гофмана. Постоянный ток разлагает воду: 2H₂O → 2H₂ + O₂. У катода (−) выделяется водород, у анода (+) кислород, и водорода всегда ровно вдвое больше по объёму. Газ вытесняет воду вниз, и она поднимается в шар средней трубки. Ниже примерно 1,8 В (теоретический порог 1,23 В) реакция не идёт; выше — газа тем больше, чем больше ток. В воду добавлено немного соли или кислоты, чтобы она проводила ток. Время ускорено в 60 раз.",
  body: `<div class="iso-stage" tabindex="0" role="slider" aria-label="Электролиз воды: стрелки меняют напряжение от 0 до 12 В, пробел или Enter открывает краны и выпускает газ" aria-valuemin="0" aria-valuemax="12" aria-valuenow="${START.volts}">${svg}</div>`,
});

const file = theme === "light" ? "index-light.html" : "index.html";
const html = k
  .pageHtml({ title: "Электролиз воды", theme, body, script: kitScript() + live })
  .replace('<html lang="en">', '<html lang="ru">')
  .replace("</style></head>", `${CSS}${theme === "light" ? "html{color-scheme:light}" : ""}</style></head>`);
writeFileSync(join(HERE, file), html);
console.log("wrote", file, (html.length / 1024).toFixed(0) + " KB");
