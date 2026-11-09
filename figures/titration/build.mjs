// Acid–base titration with a burette, a magnetic stirrer and a pH meter.  node build.mjs  /  node build.mjs --light
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../../tools/anatomy/kit/iso-kit.mjs";
import * as G from "../../tools/anatomy/kit/lathe.mjs";
import { tubePieces, tubeSvg } from "../../tools/anatomy/kit/tube.mjs";
import { kitScript } from "../../tools/anatomy/scripts/inline-kit.mjs";
import * as M from "./model.mjs";
import { GEO, FLASK_OUT, FLASK_INSIDE, BURETTE_INSIDE, waterPath, surfaceOf, buretteLevel, keyOf, barOf } from "./parts.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--light") ? "light" : "dark";

const WIDTH = 600;
const HEIGHT = 560;
const BASE = GEO.base;
const BASE_H = 8;

// The state the page opens in (and keeps under reduced motion): a little before the end point.
const START = { added: 18, open: 0.6, angle: 0.4 };

const P = k.fitProjection(
  [...k.boxCorners(BASE, -BASE_H - 3, 0), [GEO.rod[0], GEO.rod[1], 270], [GEO.burette.c[0], GEO.burette.c[1], GEO.burette.glass[1] + 3]],
  WIDTH,
  HEIGHT,
  { pad: 24, azimuth: GEO.azimuth },
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
const glassEdge = (d) => L(d, { tone: "hi", className: "iso-edge" });
function thumbScrew(origin, axis, length = 4.4) {
  const F = G.frameAlong(origin, axis);
  return (
    S(G.disc(0, 1.4, 1.1, F, P), { tone: "mid" }) +
    S(G.disc(1.4, length, 2.4, F, P), { tone: "mid", inner: k.fadedSvg(G.ribsOf(F, 1.4, length, 2.4, 20, P, { fade: [0.1, 0.55] }), { tone: "lo" }) })
  );
}

// ---------------------------------------------------------------- volumes

const FZ = GEO.flask.z;
const TABLE = M.volumeTable(FLASK_INSIDE, FLASK_INSIDE[0][0]);
const PER_ML = M.volumeAt(TABLE, 40) / 100; // the flask holds 100 mL up to the shoulder

// ---------------------------------------------------------------- the stand's base and rod

function base() {
  const out = [`<path class="iso-halo" d="${k.haloOf(BASE, -BASE_H - 3, BASE_H, P)}"/>`];
  for (const [x, y] of byDepth(k.corners(BASE, 12))) out.push(S(k.cylinder(x, y, 5, -BASE_H - 3, 3, P, 24), { tone: "lo" }));
  out.push(S(k.slabOf(BASE, -BASE_H, BASE_H, P, 6, 1.4), { tone: "mid", inner: L(k.sideSeam(BASE, -3, P, 6), { tone: "faint" }) }));
  out.push(L(k.planOutline(k.insetPlan(BASE, 5), 0, P), { tone: "lo" }));
  const screws = k.corners(BASE, 9);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 2, 0, P, 16)).join(""), { tone: "lo" }));
  out.push(D(screws.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
  const tag = { x: -58, y: 33, w: 54, d: 13, r: 1.5 };
  out.push(S(k.slabOf(tag, 0, 0.8, P, 3), { tone: "lo", crease: "none" }));
  out.push(L(k.planOutline(k.insetPlan(tag, 1.4), 0.8, P, 3), { tone: "faint" }));
  out.push(k.faceTextSvg(k.topMatrix([tag.x + tag.w / 2, tag.y + 7.6], 0.8, P, "x"), "HCl + NaOH → NaCl + H₂O", { size: 3, tone: "mid", anchor: "middle" }));
  out.push(D([at([tag.x + 3, tag.y + tag.d / 2, 0.8]), at([tag.x + tag.w - 3, tag.y + tag.d / 2, 0.8])], { size: 0.45 }));
  return out.join("");
}

const BOSSES = [GEO.electrode.holder - 5, GEO.clamp - 5];
function rod() {
  const [rx, ry] = GEO.rod;
  const out = [];
  out.push(S(k.cylinder(rx, ry, 8, 0, 6, P, 40, 0.5), { tone: "mid", inner: L(k.sideArc(rx, ry, 8, 2.5, P, 24), { tone: "faint" }) }));
  out.push(thumbScrew([rx + 8, ry, 3], [1, 0, 0]));
  let from = 6;
  for (const zb of BOSSES) {
    out.push(S(k.cylinder(rx, ry, 3, from, zb - from, P, 28), { tone: "mid", crease: "none" }));
    const boss = { x: rx - 5, y: ry - 5, w: 10, d: 10, r: 1.5 };
    out.push(S(k.slabOf(boss, zb, 10, P, 3, 0.5), { tone: "mid", inner: L(k.sideSeam(boss, zb + 5, P, 3), { tone: "faint" }) }));
    out.push(L(k.ring(rx, ry, 3.6, zb + 10, P, 24), { tone: "faint" }));
    out.push(thumbScrew([rx + 5, ry, zb + 5], [1, 0, 0], 5));
    from = zb + 10;
  }
  out.push(S(k.cylinder(rx, ry, 3, from, 270 - from, P, 28), { tone: "mid", crease: "none" }));
  out.push(S(k.cylinder(rx, ry, 3.5, 270, 2, P, 28, 0.4), { tone: "mid" }));
  return out.join("");
}

function arm(y1, z, x = GEO.rod[0]) {
  const [, ry] = GEO.rod;
  const F = G.frameAlong([x, ry + 5, z], [0, 1, 0]);
  return S(G.disc(0, y1 - ry - 5, 1.8, F, P), { tone: "mid" });
}

// ---------------------------------------------------------------- burette clamp (a jaw on each side of the tube)

function clampBack() {
  const z = GEO.clamp;
  const [bx, by] = GEO.burette.c;
  const R = GEO.burette.rOut;
  const out = [arm(by - R - 4.4, z + 2.5)];
  out.push(S(k.slabOf({ x: bx - R - 4.6, y: by - R - 4.4, w: 2 * R + 9.2, d: 3.4, r: 1 }, z, 5, P, 3, 0.4), { tone: "mid" }));
  out.push(S(k.slabOf({ x: bx - R - 4.6, y: by - R - 1, w: 3.4, d: 2 * R + 3, r: 1 }, z, 5, P, 3, 0.4), { tone: "mid" }));
  out.push(S(k.slabOf({ x: bx - R - 1.2, y: by - 2.5, w: 1.2, d: 5, r: 0.4 }, z + 0.6, 3.8, P, 2), { tone: "lo", crease: "none" }));
  out.push(D([at([bx, by - R - 2.7, z + 5])], { size: 0.45 }));
  return out.join("");
}
function clampFront() {
  const z = GEO.clamp;
  const [bx, by] = GEO.burette.c;
  const R = GEO.burette.rOut;
  const out = [];
  out.push(S(k.slabOf({ x: bx + R, y: by - 2.5, w: 1.2, d: 5, r: 0.4 }, z + 0.6, 3.8, P, 2), { tone: "lo", crease: "none" }));
  out.push(S(k.slabOf({ x: bx + R + 1.2, y: by - R - 1, w: 3.4, d: 2 * R + 3, r: 1 }, z, 5, P, 3, 0.4), { tone: "mid" }));
  out.push(thumbScrew([bx + R + 4.6, by + 1, z + 2.5], [1, 0, 0], 5));
  return out.join("");
}

// ---------------------------------------------------------------- the magnetic stirrer

function stirrer() {
  const T = GEO.stir;
  const plan = T.plan;
  const out = [];
  out.push(`<path class="iso-halo" d="${k.haloOf(k.insetPlan(plan, 2), 0, 0.1, P)}" style="filter:blur(5px)"/>`);
  for (const [x, y] of byDepth(k.corners(plan, 7))) out.push(S(k.cylinder(x, y, 2.6, 0, T.z0, P, 20), { tone: "lo" }));
  out.push(S(k.slabOf(plan, T.z0, T.z1 - T.z0, P, 5, 0.8), { tone: "mid", inner: L(k.sideSeam(plan, T.z1 - 4, P, 5), { tone: "faint" }) }));
  const side = onSide(plan.x + plan.w);
  for (let i = 0; i < 6; i++) out.push(L(path(rrect(-22 + i * 7.6, 8, -18 + i * 7.6, 16, 1.2).map(([u, v]) => side(u, v)), true), { tone: "lo" }));
  // the ceramic top plate
  const top = k.insetPlan(plan, 3);
  out.push(S(k.slabOf(top, T.z1, T.top - T.z1, P, 4, 0.6), { tone: "hi", crease: "faint" }));
  out.push(L(k.ring(GEO.flask.c[0], GEO.flask.c[1], 24, T.top, P, 64), { tone: "faint" }));
  // front panel: speed knob, heater knob (off), pilot lamp, name plate
  const front = onFront(T.front);
  out.push(L(path(rrect(plan.x + 3, T.z0 + 3, plan.x + plan.w - 3, T.z1 - 6, 1.5).map(([u, v]) => front(u, v)), true), { tone: "faint" }));
  for (const [x, turn] of [[-16, 0.55], [14, 0]]) {
    out.push(L(path(arcIn(front, x, 13, 7.6, -135, 135, 36)), { tone: "lo" }));
    const kt = dialTicks(front, x, 13, 7.6, -135, 135, 11, 5, [1, 1.9]);
    out.push(L(kt.minor, { tone: "lo" }), L(kt.major, { tone: "mid" }));
    const KF = G.frameAlong([x, T.front, 13], [0, 1, 0]);
    out.push(S(G.disc(0, 1, 5.8, KF, P), { tone: "mid" }));
    out.push(S(G.disc(1, 5, 4.7, KF, P), { tone: "mid", inner: k.fadedSvg(G.ribsOf(KF, 1, 5, 4.7, 36, P, { fade: [0.1, 0.55] }), { tone: "lo" }) }));
    const t = ((-135 + 270 * turn) * Math.PI) / 180;
    out.push(L(path([at([x, T.front + 5, 13]), at([x + Math.sin(t) * 3.2, T.front + 5, 13 + Math.cos(t) * 3.2])]), { tone: "hi" }));
    out.push(D([at([x, T.front + 5, 13])], { size: 0.6, tone: "hi" }));
  }
  const LF = G.frameAlong([-1, T.front, 18], [0, 1, 0]);
  out.push(S(G.disc(0, 1, 2.2, LF, P), { tone: "mid" }));
  out.push(S(G.disc(1, 2, 1.4, LF, P), { tone: "hi" }));
  const lamp = at([-1, T.front + 2, 18]);
  out.push(`<circle class="tt-lamp" cx="${lamp[0].toFixed(1)}" cy="${lamp[1].toFixed(1)}" r="0.9"/>`);
  out.push(L(path([front(-4.5, 9), front(2.5, 9)]), { tone: "lo", free: true }), L(path([front(-3.5, 7), front(1.5, 7)]), { tone: "faint", free: true }));
  return out.join("");
}

// ---------------------------------------------------------------- a wash bottle with distilled water

function washBottle() {
  const [x, y] = [-44, 12];
  const F = G.frameOf([x, y, 0], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
  const out = [`<path class="iso-halo" d="${k.haloOf({ x: x - 9, y: y - 9, w: 18, d: 18, r: 9 }, 0, 0.1, P)}" style="filter:blur(3px)"/>`];
  out.push(S(G.solidOf([[0, 8.4], [0.7, 9.2, 1], [1.6, 9.4, 1], [25, 9.4], [27.6, 7.8, 1], [29.4, 4.6, 1], [30.6, 4]], F, P), { tone: "hi", inner: L(G.arcOf(F, 9, 9.4, P) + G.arcOf(F, 19, 9.4, P), { tone: "faint" }) }));
  out.push(k.fadeLineSvg([surfacePoint(x, y, 9.4, A + 0.95, 4), surfacePoint(x, y, 9.4, A + 0.95, 23)], { fade: [6, 6], tone: "mid" }));
  out.push(S(G.disc(30.6, 35.4, 4.6, F, P), { tone: "mid", inner: k.fadedSvg(G.ribsOf(F, 30.6, 35.4, 4.6, 26, P, { fade: [0.1, 0.55] }), { tone: "lo" }) }));
  out.push(S(G.disc(35.4, 37, 1.6, F, P), { tone: "mid" }));
  const route = G.fillet([[x, y, 36.6], [x, y, 46], [x + 9, y, 47], [x + 13, y, 42]], 3.2, 10, { P, tube: 0.75 });
  out.push(tubePieces(route, 0.75, P, { maxLength: 400, caps: [false, true] }).map((piece) => tubeSvg(piece, { tone: "hi" })).join(""));
  return out.join("");
}

// ---------------------------------------------------------------- the conical flask with the solution, stir bar and electrode

function flask() {
  const [cx, cy] = GEO.flask.c;
  const F = G.frameOf([cx, cy, FZ], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
  const out = [];
  const glass = waterPath(cx, cy, FLASK_OUT, FLASK_OUT[FLASK_OUT.length - 1][0], P, FZ);
  out.push(`<path class="tt-edge" d="${glass}"/><path class="iso-fill" d="${glass}"/>`);
  const level = M.levelFor(TABLE, (M.TIT.acid + START.added) * PER_ML);
  const surf = surfaceOf(cx, cy, FLASK_INSIDE, level, P, FZ);
  const pink = (M.pinkOf(M.phOf(START.added)) * 0.88).toFixed(2);
  out.push(`<path class="tt-liquid" data-part="sol" d="${waterPath(cx, cy, FLASK_INSIDE, level, P, FZ)}"/>`);
  out.push(`<path class="tt-pink" data-part="sol-pink" style="opacity:${pink}" d="${waterPath(cx, cy, FLASK_INSIDE, level, P, FZ)}"/>`);
  out.push(`<path class="tt-liquid-top" data-part="sol-top" d="${surf.top}"/>`);
  out.push(`<path class="tt-pink tt-pink-top" data-part="sol-top-pink" style="opacity:${pink}" d="${surf.top}"/>`);
  const bar = barOf(START.angle, P);
  out.push(`<g class="tt-bar" data-part="bar"><path class="tt-bar-side" d="${bar.fill}"/><path class="tt-bar-top" d="${bar.top}"/><path class="iso-line" data-tone="mid" d="${bar.fill}"/></g>`);
  // the electrode's glass bulb and the lower stem, inside the flask
  const E = GEO.electrode;
  const EF = G.frameOf([E.c[0], E.c[1], 0], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
  const bulbZ = FZ + 6.4;
  out.push(S(G.sphereOf([E.c[0], E.c[1], bulbZ], E.bulb, P, { steps: 40 }), { tone: "hi" }));
  out.push(S(G.solidOf([[bulbZ + 1.2, E.r], [FZ + 59, E.r]], EF, P), { tone: "hi", crease: "none", inner: L(G.arcOf(EF, bulbZ + 12, E.r, P), { tone: "faint" }) }));
  out.push(`<path class="tt-flash" data-part="flash" d="" style="opacity:0"/>`);
  out.push(`<path class="iso-line" data-tone="faint" data-part="sol-back" d="${surf.back}"/>`);
  out.push(`<path class="iso-line" data-tone="hi" data-part="sol-front" d="${surf.front}"/>`);
  // graduations every 25 mL on the cone, on a printed spine
  const outR = (z) => 27.4 + ((9.8 - 27.4) * (z - 3.4)) / (40 - 3.4);
  const gradAt = A + (6 * Math.PI) / 180;
  const marks = [];
  for (const ml of [25, 50, 75, 100]) {
    const z = M.levelFor(TABLE, ml * PER_ML);
    const span = ml % 50 === 0 ? 0.5 : 0.32;
    marks.push(path(Array.from({ length: 9 }, (_, i) => surfacePoint(cx, cy, outR(z) + 0.05, gradAt - (span * i) / 8, FZ + z))));
  }
  const z100 = M.levelFor(TABLE, 100 * PER_ML);
  out.push(L(path([surfacePoint(cx, cy, outR(5) + 0.05, gradAt, FZ + 5), surfacePoint(cx, cy, outR(z100) + 0.05, gradAt, FZ + z100)]), { tone: "lo", free: "start" }));
  out.push(L(marks.join(""), { tone: "mid", free: "end" }));
  out.push(k.fadeLineSvg([surfacePoint(cx, cy, outR(6), A + 0.9, FZ + 6), surfacePoint(cx, cy, outR(36), A + 0.9, FZ + 36)], { fade: [8, 8], tone: "mid" }));
  // lip
  out.push(S(G.ringBand(59, GEO.flask.lip - FZ, 7.6, 9.2, F, P), { tone: "hi" }));
  out.push(`<path class="tt-void" d="${G.circleOf(F, GEO.flask.lip - FZ, 7.6, P)}"/>`);
  out.push(L(G.circleOf(F, GEO.flask.lip - FZ, 7.6, P), { tone: "mid" }));
  return out.join("");
}

// the electrode above the flask, its holder and the cable to the meter
function electrodeTop() {
  const E = GEO.electrode;
  const F = G.frameOf([E.c[0], E.c[1], 0], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
  const out = [arm(E.c[1] - 3.1, E.holder, E.c[0])];
  out.push(S(G.solidOf([[GEO.flask.lip, E.r], [E.top - 8, E.r]], F, P), { tone: "hi", crease: "none" }));
  out.push(S(G.ringBand(E.holder - 2.4, E.holder + 2.4, E.r, E.r + 1.1, F, P), { tone: "mid" }));
  out.push(thumbScrew([E.c[0] + E.r + 1.1, E.c[1], E.holder], [1, 0, 0], 3.6));
  out.push(S(G.solidOf([[E.top - 8, E.r + 0.5], [E.top - 1.5, E.r + 0.5], [E.top, E.r - 0.4, 1]], F, P), { tone: "lo", inner: L(G.arcOf(F, E.top - 6, E.r + 0.5, P), { tone: "faint" }) }));
  out.push(S(G.solidOf([[E.top, 1.3], [E.top + 3, 1.1]], F, P), { tone: "lo" }));
  return out.join("");
}

function cable() {
  const E = GEO.electrode;
  const [bx, by] = GEO.bnc;
  const plugTop = GEO.meter.z1 + 9;
  const route = G.fillet([[E.c[0], E.c[1], E.top + 2.6], [E.c[0], E.c[1], E.top + 14], [44, E.c[1], E.top + 14], [bx, by, 70], [bx, by, plugTop]], 12, 12, { P, tube: 1 });
  return tubePieces(route, 1, P, { maxLength: 400 }).map((piece) => tubeSvg(piece, { tone: "mid" })).join("");
}

// ---------------------------------------------------------------- the pH meter

function meter() {
  const Mt = GEO.meter;
  const plan = Mt.plan;
  const out = [];
  out.push(`<path class="iso-halo" d="${k.haloOf(k.insetPlan(plan, 2), 0, 0.1, P)}" style="filter:blur(4px)"/>`);
  for (const [x, y] of byDepth(k.corners(plan, 5))) out.push(S(k.cylinder(x, y, 2.2, 0, Mt.z0, P, 18), { tone: "lo" }));
  out.push(S(k.slabOf(plan, Mt.z0, Mt.z1 - Mt.z0, P, 4, 0.7), { tone: "mid", inner: L(k.sideSeam(plan, Mt.z1 - 3.5, P, 4), { tone: "faint" }) }));
  out.push(D(k.corners(plan, 3.5).map(([x, y]) => at([x, y, Mt.z1])), { size: 0.45 }));
  const front = onFront(Mt.front);
  // LCD window and its bezel
  const bezel = rrect(plan.x + 5, 10, plan.x + plan.w - 5, 21, 1.2).map(([u, v]) => front(u, v));
  out.push(`<path class="tt-bezel" d="${path(bezel, true)}"/>`);
  const lcd = rrect(plan.x + 7, 11.6, plan.x + plan.w - 7, 19.4, 0.8).map(([u, v]) => front(u, v));
  out.push(`<path class="tt-lcd" d="${path(lcd, true)}"/>`);
  out.push(`<text class="tt-lcd-unit" transform="${k.sideMatrix([plan.x + 9, Mt.front], 13.4, P, "left")}" font-size="3">pH</text>`);
  out.push(`<text class="tt-lcd-text" data-part="lcd" transform="${k.sideMatrix([plan.x + plan.w - 9, Mt.front], 13, P, "left")}" font-size="6.2" text-anchor="end">${M.phText(M.phOf(START.added))}</text>`);
  // three buttons and a power LED
  for (const x of [60, 70, 80]) out.push(S(k.slabOf({ x: x - 3, y: Mt.front, w: 6, d: 1, r: 0.6 }, 4, 3, P, 2, 0.3), { tone: "mid" }));
  const led = at([90, Mt.front, 5.5]);
  out.push(`<circle class="tt-led" cx="${led[0].toFixed(1)}" cy="${led[1].toFixed(1)}" r="0.9"/>`);
  // BNC socket on top, the plug in it
  const [bx, by] = GEO.bnc;
  const F = G.frameOf([bx, by, 0], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
  out.push(S(G.disc(Mt.z1, Mt.z1 + 2.4, 3, F, P), { tone: "hi" }));
  out.push(S(G.solidOf([[Mt.z1 + 2.4, 2.4], [Mt.z1 + 6.5, 2.4], [Mt.z1 + 9, 1.3, 1]], F, P), { tone: "lo", inner: k.fadedSvg(G.ribsOf(F, Mt.z1 + 2.6, Mt.z1 + 6.3, 2.4, 16, P, { fade: [0.1, 0.55] }), { tone: "faint" }) }));
  return out.join("");
}

// ---------------------------------------------------------------- the burette

function burette() {
  const B = GEO.burette;
  const [cx, cy] = B.c;
  const out = [];
  const F = G.frameOf([cx, cy, 0], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
  // tip and lower stem
  out.push(S(G.solidOf([[B.tip, 0.7], [B.cock - 2.5, 1.5], [B.cock, 1.7]], F, P), { tone: "hi", crease: "none" }));
  out.push(S(G.solidOf([[B.cock, 1.7], [B.glass[0] - 4, 1.8], [B.glass[0] - 1, B.rOut - 0.6, 1], [B.glass[0], B.rOut]], F, P), { tone: "hi", crease: "none" }));
  // stopcock barrel across the stem, with its PTFE key
  const CF = G.frameAlong([cx, cy, GEO.cock.z], [0, 1, 0]);
  out.push(S(G.solidOf([[-GEO.cock.front, 2.2], [-GEO.cock.front + 1.2, GEO.cock.r, 1], [GEO.cock.front - 1.2, GEO.cock.r, 1], [GEO.cock.front, 2.2]], CF, P), { tone: "hi" }));
  const key = keyOf(START.open * (Math.PI / 2), P);
  out.push(`<g class="iso-solid" data-part="key"><path class="iso-fill" d="${key.fill}"/><path class="iso-top" d="${key.face}"/><path class="iso-line iso-crease" data-tone="faint" d="${key.face}"/><path class="iso-line iso-edge" data-tone="mid" d="${key.fill}"/></g>`);
  out.push(D([at([cx, cy + GEO.cock.front + GEO.cock.thick, GEO.cock.z])], { size: 0.6, tone: "mid" }));
  // the graduated tube with the NaOH solution
  const [g0, g1] = B.glass;
  const glass = k.cylinder(cx, cy, B.rOut, g0, g1 - g0, P, 40);
  out.push(`<path class="iso-fill" d="${glass.fill}"/>`);
  const level = buretteLevel(START.added);
  const surf = surfaceOf(cx, cy, BURETTE_INSIDE, level, P);
  out.push(`<path class="tt-liquid" data-part="bur" d="${waterPath(cx, cy, BURETTE_INSIDE, level, P)}"/>`);
  out.push(`<path class="tt-liquid-top" data-part="bur-top" d="${surf.top}"/>`);
  out.push(`<path class="iso-line" data-tone="faint" data-part="bur-back" d="${surf.back}"/>`);
  out.push(`<path class="iso-line" data-tone="lit" data-part="bur-front" d="${surf.front}" style="stroke-width:.9"/>`);
  const scaleAt = A - (20 * Math.PI) / 180;
  const minor = [];
  const major = [];
  for (let n = 0; n <= M.TIT.scale; n++) {
    const z = B.zero - n * B.ml;
    const span = n % 10 === 0 ? 62 : n % 5 === 0 ? 46 : 28;
    const d = path([0, 1].map((f) => surfacePoint(cx, cy, B.rOut + 0.05, scaleAt + (f * span * Math.PI) / 180, z)));
    (n % 5 === 0 ? major : minor).push(d);
  }
  out.push(L(path([surfacePoint(cx, cy, B.rOut + 0.05, scaleAt, B.zero), surfacePoint(cx, cy, B.rOut + 0.05, scaleAt, B.zero - M.TIT.scale * B.ml)]), { tone: "lo" }));
  out.push(L(minor.join(""), { tone: "lo", free: "end" }), L(major.join(""), { tone: "mid", free: "end" }));
  const shineAt = A + (50 * Math.PI) / 180;
  out.push(k.fadeLineSvg([surfacePoint(cx, cy, B.rOut, shineAt, g0 + 6), surfacePoint(cx, cy, B.rOut, shineAt, g1 - 6)], { fade: [20, 20], tone: "mid" }));
  out.push(glassEdge(glass.outline));
  // fire-polished rim
  out.push(S(G.ringBand(g1, g1 + 1.6, B.rIn, B.rOut + 0.5, F, P), { tone: "hi" }));
  out.push(`<path class="tt-void" d="${G.circleOf(F, g1 + 1.6, B.rIn, P)}"/>`);
  out.push(L(G.circleOf(F, g1 + 1.6, B.rIn, P), { tone: "mid" }));
  // drops and the thin stream when the cock is wide open
  out.push(`<path class="tt-stream" data-part="stream" d="" style="opacity:0"/>`);
  out.push(`<g data-part="drops">${Array.from({ length: 8 }, () => `<circle class="tt-drop" r="0" cx="0" cy="0"/>`).join("")}</g>`);
  return out.join("");
}

const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label:
    "Титрование: на штативе в лапке закреплена бюретка с раствором гидроксида натрия, внизу у неё стеклянный кран. Под бюреткой на магнитной мешалке стоит коническая колба с соляной кислотой и фенолфталеином; на дне вращается якорь мешалки. В колбу опущен стеклянный электрод, кабель от него идёт к pH-метру, который показывает pH раствора. После точки эквивалентности раствор становится малиновым.",
  body: [base(), rod(), clampBack(), washBottle(), stirrer(), flask(), electrodeTop(), meter(), cable(), burette(), clampFront()],
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
const FZ = ${FZ};
const TABLE = volumeTable(FLASK_INSIDE, FLASK_INSIDE[0][0]);
const PER_ML = ${PER_ML};
const stage = document.querySelector(".iso-stage");
const svg = stage.querySelector("svg");
const part = (name) => svg.querySelector('[data-part="' + name + '"]');
const readout = document.querySelector("[data-readout]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const sol = { water: part("sol"), pink: part("sol-pink"), top: part("sol-top"), topPink: part("sol-top-pink"), front: part("sol-front"), back: part("sol-back") };
const bur = { water: part("bur"), top: part("bur-top"), front: part("bur-front"), back: part("bur-back") };
const key = part("key"), bar = part("bar"), lcd = part("lcd"), flash = part("flash"), stream = part("stream");
const dropDots = [...part("drops").children];
const [FX, FY] = GEO.flask.c;
const [BX, BY] = GEO.burette.c;

const s = { added: START.added, open: START.open, target: START.open, turn: START.open * Math.PI / 2, angle: START.angle, flash: 0, refill: null };
let drops = [], dropAcc = 0, solLevel = 0;
const drawn = {};
function drawLiquids() {
  const k = s.added.toFixed(3);
  if (drawn.added === k) return;
  drawn.added = k;
  solLevel = levelFor(TABLE, (TIT.acid + s.added) * PER_ML);
  const body = waterPath(FX, FY, FLASK_INSIDE, solLevel, P, FZ);
  const f = surfaceOf(FX, FY, FLASK_INSIDE, solLevel, P, FZ);
  sol.water.setAttribute("d", body); sol.pink.setAttribute("d", body);
  sol.top.setAttribute("d", f.top); sol.topPink.setAttribute("d", f.top); sol.front.setAttribute("d", f.front); sol.back.setAttribute("d", f.back);
  const pink = (pinkOf(phOf(s.added)) * 0.88).toFixed(3);
  sol.pink.style.opacity = pink; sol.topPink.style.opacity = pink;
  const lv = buretteLevel(s.added);
  const g = surfaceOf(BX, BY, BURETTE_INSIDE, lv, P);
  bur.water.setAttribute("d", waterPath(BX, BY, BURETTE_INSIDE, lv, P));
  bur.top.setAttribute("d", g.top); bur.front.setAttribute("d", g.front); bur.back.setAttribute("d", g.back);
  lcd.textContent = phText(phOf(s.added));
}
function drawKey() {
  const k = s.turn.toFixed(3);
  if (drawn.turn === k) return;
  drawn.turn = k;
  const shape = keyOf(s.turn, P);
  const [fill, top, crease, edge] = key.children;
  fill.setAttribute("d", shape.fill); top.setAttribute("d", shape.face); crease.setAttribute("d", shape.face); edge.setAttribute("d", shape.fill);
}
function drawBar() {
  const shape = barOf(s.angle, P);
  const [side, top, edge] = bar.children;
  side.setAttribute("d", shape.fill); top.setAttribute("d", shape.top); edge.setAttribute("d", shape.fill);
}
function draw() {
  drawLiquids();
  drawKey();
  drawBar();
  const surfaceZ = FZ + solLevel;
  const rate = flowOf(s.open);
  if (rate > 0.7 && !s.refill) {
    stream.setAttribute("d", elPath([iso([BX, BY, GEO.burette.tip], P), iso([BX, BY, surfaceZ], P)]));
    stream.style.opacity = clamp((rate - 0.7) / 0.6, 0, 1).toFixed(2);
    stream.style.strokeWidth = (0.5 + rate * 0.35).toFixed(2);
  } else stream.style.opacity = "0";
  dropDots.forEach((el, i) => {
    const d = drops[i];
    if (!d) { if (el.getAttribute("r") !== "0") el.setAttribute("r", "0"); return; }
    const [x, y] = iso([BX, BY, d.z], P);
    el.setAttribute("cx", x.toFixed(1)); el.setAttribute("cy", y.toFixed(1)); el.setAttribute("r", (d.r * P.scale * 1.26).toFixed(2));
  });
  if (s.flash > 0.01) {
    flash.setAttribute("d", elPath(ringAt(BX, BY, 2 + (1 - s.flash) * 6, surfaceZ, P, 0, Math.PI * 2, 28), true));
    flash.style.opacity = (s.flash * 0.85).toFixed(2);
  } else if (flash.style.opacity !== "0") flash.style.opacity = "0";
  const text = readoutOf(s);
  if (readout.textContent !== text) readout.textContent = text;
}

// ---- tour, input, loop
let touring = !still.matches, phase = "fast", phaseAt = 0, clock = 0, idle = 0, frame = 0, last = 0, visible = false;
function startRefill() { s.refill = { from: s.added, t: 0 }; s.target = 0; }
function tour() {
  const age = clock - phaseAt;
  const go = (next) => { phase = next; phaseAt = clock; };
  const eq = equivalence();
  if (phase === "fast") { s.target = 0.9; if (s.added >= eq - 5) go("slow"); }
  else if (phase === "slow") { s.target = 0.42; if (s.added >= eq - 1.2) go("drop"); }
  else if (phase === "drop") { s.target = 0.2; if (s.added >= eq + 0.25) go("hold"); }
  else if (phase === "hold") { s.target = 0; if (age > 4) { startRefill(); go("refill"); } }
  else if (phase === "refill") { if (!s.refill && age > 2.6) go("fast"); }
}
function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  clock += dt;
  if (touring) tour();
  s.open += (s.target - s.open) * (1 - Math.exp(-dt / 0.18));
  if (Math.abs(s.target - s.open) < 0.002) s.open = s.target;
  const want = s.open * Math.PI / 2;
  s.turn += (want - s.turn) * (1 - Math.exp(-dt / 0.08));
  if (Math.abs(want - s.turn) < 0.002) s.turn = want;
  if (s.refill) {
    s.refill.t = Math.min(1, s.refill.t + dt / 1.6);
    s.added = s.refill.from * Math.pow(1 - s.refill.t, 3);
    if (s.refill.t >= 1) { s.added = 0; s.refill = null; }
  } else {
    const rate = flowOf(s.open);
    const room = TIT.scale - s.added;
    s.added = Math.min(TIT.scale, s.added + rate * dt);
    if (room <= 0) s.target = 0;
    dropAcc += dt * Math.min(9, rate / TIT.drop);
    while (dropAcc >= 1) { dropAcc -= 1; if (drops.length < dropDots.length && rate < 1.1) drops.push({ z: GEO.burette.tip - 1, v: 0, r: 0.6 }); }
  }
  s.angle += dt * 9;
  const surfaceZ = FZ + solLevel;
  for (const d of drops) { d.v += 300 * dt; d.z -= d.v * dt; d.r = Math.min(0.95, d.r + dt * 3); }
  const before = drops.length;
  drops = drops.filter((d) => d.z > surfaceZ);
  if (drops.length < before) s.flash = 1;
  s.flash = Math.max(0, s.flash - dt / 0.7);
  draw();
  frame = visible ? requestAnimationFrame(tick) : 0;
}
const run = () => { if (!frame && visible && !still.matches) { last = 0; frame = requestAnimationFrame(tick); } };
function describe() {
  if (still.matches) {
    stage.setAttribute("aria-valuenow", s.added.toFixed(1));
    stage.setAttribute("aria-valuetext", "Добавлено " + s.added.toFixed(1).replace(".", ",") + " мл, pH " + phText(phOf(s.added)));
  } else {
    stage.setAttribute("aria-valuenow", String(Math.round(s.target * 100)));
    stage.setAttribute("aria-valuetext", s.target === 0 ? "Кран закрыт" : "Кран открыт на " + Math.round(s.target * 100) + " %");
  }
}
function hold() {
  touring = false;
  clearTimeout(idle);
  idle = setTimeout(() => {
    if (still.matches) return;
    touring = true;
    const eq = equivalence();
    phase = s.added >= eq + 0.25 ? "hold" : s.added >= eq - 1.2 ? "drop" : s.added >= eq - 5 ? "slow" : "fast";
    phaseAt = clock; run();
  }, 3600);
}
// under reduced motion nothing flows: the controls set the added volume directly and the figure redraws once
function steer(open) {
  hold();
  if (still.matches) { s.added = Math.round(clamp(open, 0, 1) * 40 * 10) / 10; s.open = s.target = 0; s.turn = 0; describe(); draw(); return; }
  s.target = Math.round(clamp(open, 0, 1) * 100) / 100;
  describe();
  run();
}
function reset() {
  hold();
  if (still.matches) { s.added = 0; describe(); draw(); return; }
  startRefill();
  run();
}
let down = null;
stage.addEventListener("pointermove", (event) => {
  const box = svg.getBoundingClientRect();
  if (down && event.pointerType !== "mouse") {
    if (Math.abs(event.clientX - down.x) > 6) down.moved = true;
    steer(down.value + (event.clientX - down.x) / box.width * 1.6);
    return;
  }
  if (event.pointerType === "mouse") {
    if (down && Math.abs(event.clientX - down.x) > 6) down.moved = true;
    steer(((event.clientX - box.left) / box.width - 0.14) / 0.72);
  }
});
stage.addEventListener("pointerdown", (event) => {
  down = { x: event.clientX, value: still.matches ? s.added / 40 : s.target, at: performance.now(), moved: false };
  if (event.pointerType !== "mouse") { try { stage.setPointerCapture(event.pointerId); } catch {} }
});
const release = (event) => {
  if (down && !down.moved && event.type === "pointerup" && performance.now() - down.at < 600) reset();
  down = null;
};
stage.addEventListener("pointerup", release);
stage.addEventListener("pointercancel", release);
stage.addEventListener("pointerleave", (event) => { if (event.pointerType === "mouse" && !still.matches) { s.target = 0; describe(); } });
stage.addEventListener("keydown", (event) => {
  const calm = still.matches;
  const step = calm ? (event.shiftKey ? 5 : 0.5) / 40 : event.shiftKey ? 0.25 : 0.05;
  const from = calm ? s.added / 40 : touring ? Math.round(s.open * 20) / 20 : s.target;
  let to = null;
  if (event.key === "ArrowRight" || event.key === "ArrowUp") to = from + step;
  if (event.key === "ArrowLeft" || event.key === "ArrowDown") to = from - step;
  if (event.key === "Home") to = 0;
  if (event.key === "End") to = 1;
  if (event.key === " " || event.key === "Enter") { event.preventDefault(); reset(); return; }
  if (to === null) return;
  event.preventDefault();
  steer(to);
});
new IntersectionObserver((entries) => { visible = entries[entries.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "120px 0px" }).observe(stage);
still.addEventListener?.("change", () => { if (still.matches) { touring = false; s.open = s.target = 0; s.turn = 0; drops = []; s.flash = 0; draw(); } else { touring = true; run(); } describe(); });
if (still.matches) { s.open = s.target = 0; s.turn = 0; }
describe();
draw();
}
{
const embedded = window.parent !== window;
if (embedded) document.documentElement.classList.add("embed");
const heightOf = () => { const main = document.querySelector(".iso-page"); return main ? Math.ceil(main.getBoundingClientRect().height) : document.documentElement.scrollHeight; };
const post = () => { if (embedded) parent.postMessage({ type: "figure-height", height: heightOf() }, "*"); };
addEventListener("load", post);
addEventListener("resize", post);
if (window.ResizeObserver) new ResizeObserver(post).observe(document.body);
post();
}
`;

const CSS = `
.iso{--tt-liquid:#202428;--tt-liquid-top:#292e33;--tt-pink:#c2255c;--tt-pink-top:#d6336c;--tt-lcd:#0b0d0b;--tt-lcd-ink:#d9e6d6;--tt-led:#7ee08a;--tt-bar:#e6e6e6}
.iso[data-theme="light"]{--tt-liquid:#e4e8eb;--tt-liquid-top:#eef1f3;--tt-pink:#e64980;--tt-pink-top:#f06595;--tt-lcd:#dfe4d8;--tt-lcd-ink:#1e231d;--tt-led:#2f9e44;--tt-bar:#ffffff}
.iso-page{width:100%;max-width:820px;margin:0 auto;padding:12px}
html.embed .iso-page{max-width:none}
html.embed{color-scheme:normal}
html.embed,html.embed body{background:transparent;overflow:hidden}
.iso-figure{margin:0}
.iso-stage{touch-action:pan-y;outline:none;cursor:ew-resize;-webkit-tap-highlight-color:transparent}
.iso-stage:focus-visible{outline:1px solid var(--anatomy-muted);outline-offset:6px}
.tt-edge{fill:none;stroke:var(--anatomy-hi);stroke-width:1.25;stroke-linejoin:round}
.tt-liquid{fill:var(--tt-liquid);stroke:none}
.tt-liquid-top{fill:var(--tt-liquid-top);stroke:none}
.tt-pink{fill:var(--tt-pink);stroke:none}
.tt-pink-top{fill:var(--tt-pink-top)}
.tt-flash{fill:var(--tt-pink-top);stroke:none}
.tt-bar-side{fill:var(--tt-bar);stroke:none;opacity:.85}
.tt-bar-top{fill:var(--tt-bar);stroke:none}
.tt-void{fill:var(--anatomy-shade-0);stroke:none}
.tt-drop{fill:var(--anatomy-hi);stroke:none}
.tt-stream{fill:none;stroke:var(--anatomy-hi);stroke-linecap:round}
.tt-bezel{fill:var(--anatomy-shade-1);stroke:var(--anatomy-lo);stroke-width:var(--anatomy-weight)}
.tt-lcd{fill:var(--tt-lcd);stroke:var(--anatomy-mid);stroke-width:var(--anatomy-weight)}
.tt-lcd-text{fill:var(--tt-lcd-ink);font-family:var(--anatomy-mono);font-variant-numeric:tabular-nums}
.tt-lcd-unit{fill:var(--tt-lcd-ink);opacity:.7;font-family:var(--anatomy-mono)}
.tt-led,.tt-lamp{fill:var(--tt-led);stroke:none}
@media (max-width:560px){.iso-page{padding:6px}.iso-plate{overflow:hidden}.iso-plate .iso-svg{width:112%;margin:-3% -6% -4%}}
`;

const body = k.plateHtml({
  fig: "Рис. 1",
  title: "Титрование",
  hint: "Кран ← →, клик — заново",
  readout: M.readoutOf(START),
  keys: [
    { mark: "lit", label: "Уровень щёлочи в бюретке: шкала 0–50 мл сверху вниз" },
    { mark: "raised", label: "Колба с HCl и фенолфталеином на магнитной мешалке" },
  ],
  caption:
    "В колбе 25 мл 0,1 M соляной кислоты и несколько капель фенолфталеина, в бюретке 0,1 M раствор NaOH. Каждая капля щёлочи нейтрализует часть кислоты: H⁺ + OH⁻ → H₂O, и pH растёт сначала медленно, а у точки эквивалентности (25,00 мл, pH 7) — скачком на несколько единиц от одной-двух капель. Фенолфталеин бесцветен в кислой среде и становится малиновым при pH выше ~8,2, поэтому розовое облачко от капли сначала исчезает при перемешивании, а после точки эквивалентности окраска остаётся. Вблизи конца титруют по каплям.",
  body: `<div class="iso-stage" tabindex="0" role="slider" aria-label="Титрование: стрелки открывают и закрывают кран бюретки, пробел или Enter — начать заново" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(START.open * 100)}">${svg}</div>`,
});

const file = theme === "light" ? "index-light.html" : "index.html";
const html = k
  .pageHtml({ title: "Титрование", theme, body, script: kitScript() + live })
  .replace('<html lang="en">', '<html lang="ru">')
  .replace("</style></head>", `${CSS}${theme === "light" ? "html{color-scheme:light}" : ""}</style></head>`);
writeFileSync(join(HERE, file), html);
console.log("wrote", file, (html.length / 1024).toFixed(0) + " KB");
