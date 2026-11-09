// Simple distillation of an ethanol–water mixture.  node build.mjs  /  node build.mjs --light
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../../tools/anatomy/kit/iso-kit.mjs";
import * as G from "../../tools/anatomy/kit/lathe.mjs";
import { tubePieces, tubeSvg } from "../../tools/anatomy/kit/tube.mjs";
import { kitScript } from "../../tools/anatomy/scripts/inline-kit.mjs";
import * as M from "./model.mjs";
import { GEO, FLASK_INSIDE, RECV_OUT, RECV_INSIDE, along, waterPath, surfaceOf, columnOf, pointerOf } from "./parts.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--light") ? "light" : "dark";

const WIDTH = 600;
const HEIGHT = 500;
const PLATE = GEO.plate;
const PLATE_H = 10;
const FOOT_H = 5;

// The state the page opens in (and keeps under reduced motion): the still has been running for a while.
const START = (() => {
  let s = M.freshStill();
  for (let t = 0; t < 24; t += 1 / 60) s = M.stepStill(s, 0.85, 1 / 60);
  return { ...s, power: 0.85 };
})();

const P = k.fitProjection(
  [
    ...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0),
    [-60, 0, GEO.therm.top + 4],
    [GEO.rods.flask[0], GEO.rods.flask[1], 150],
  ],
  WIDTH,
  HEIGHT,
  { pad: 22, azimuth: GEO.azimuth },
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

// ---------------------------------------------------------------- base plate

function plate() {
  const out = [`<path class="iso-halo" d="${k.haloOf(PLATE, -PLATE_H - FOOT_H, PLATE_H, P)}"/>`];
  for (const [x, y] of byDepth(k.corners(PLATE, 20))) {
    out.push(S(k.cylinder(x, y, 7, -PLATE_H - FOOT_H, 1.6, P, 28), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 5.4, -PLATE_H - FOOT_H + 1.6, FOOT_H - 1.6, P, 28), { tone: "mid" }));
  }
  out.push(S(k.slabOf(PLATE, -PLATE_H, PLATE_H, P, 8, 1.6), { tone: "mid", inner: L(k.sideSeam(PLATE, -4, P, 8), { tone: "faint" }) }));
  out.push(L(k.planOutline(k.insetPlan(PLATE, 5), 0, P), { tone: "lo" }));
  const screws = k.corners(PLATE, 10);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 2.2, 0, P, 16)).join(""), { tone: "lo" }));
  out.push(D(screws.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
  // label plate: the two boiling points
  const tag = { x: 8, y: 16, w: 54, d: 26, r: 1.5 };
  out.push(S(k.slabOf(tag, 0, 0.8, P, 3), { tone: "lo", crease: "none" }));
  out.push(L(k.planOutline(k.insetPlan(tag, 1.6), 0.8, P, 3), { tone: "faint" }));
  out.push(k.faceTextSvg(k.topMatrix([tag.x + tag.w / 2, tag.y + 8.5], 0.8, P, "x"), "C₂H₅OH  78,4 °C", { size: 3.3, tone: "mid", anchor: "middle" }));
  out.push(k.faceTextSvg(k.topMatrix([tag.x + tag.w / 2, tag.y + 14.5], 0.8, P, "x"), "H₂O  100 °C", { size: 3.3, tone: "mid", anchor: "middle" }));
  out.push(L(k.lineOnTop([tag.x + 9, tag.y + 19], [tag.x + tag.w - 9, tag.y + 19], 0.8, P), { tone: "lo", free: true }));
  out.push(L(k.lineOnTop([tag.x + 15, tag.y + 22], [tag.x + tag.w - 15, tag.y + 22], 0.8, P), { tone: "faint", free: true }));
  out.push(D([at([tag.x + 4, tag.y + tag.d / 2, 0.8]), at([tag.x + tag.w - 4, tag.y + tag.d / 2, 0.8])], { size: 0.5 }));
  return out.join("");
}

// ---------------------------------------------------------------- stands: rods, bosses, clamp arms

function thumbScrew(origin, axis, length = 4.4) {
  const F = G.frameAlong(origin, axis);
  return (
    S(G.disc(0, 1.4, 1.1, F, P), { tone: "mid" }) +
    S(G.disc(1.4, length, 2.4, F, P), { tone: "mid", inner: k.fadedSvg(G.ribsOf(F, 1.4, length, 2.4, 20, P, { fade: [0.1, 0.55] }), { tone: "lo" }) })
  );
}

function rod([rx, ry], top, bosses) {
  const out = [];
  out.push(`<path class="iso-halo" d="${k.haloOf({ x: rx - 8, y: ry - 8, w: 16, d: 16, r: 8 }, 0, 0.1, P)}" style="filter:blur(3px)"/>`);
  out.push(S(k.cylinder(rx, ry, 7.5, 0, 6, P, 40, 0.5), { tone: "mid", inner: L(k.sideArc(rx, ry, 7.5, 2.4, P, 24), { tone: "faint" }) }));
  out.push(thumbScrew([rx + 7.5, ry, 3], [1, 0, 0]));
  let from = 6;
  for (const zb of bosses) {
    out.push(S(k.cylinder(rx, ry, 3, from, zb - from, P, 28), { tone: "mid", crease: "none" }));
    const boss = { x: rx - 5, y: ry - 5, w: 10, d: 10, r: 1.5 };
    out.push(S(k.slabOf(boss, zb, 10, P, 3, 0.5), { tone: "mid", inner: L(k.sideSeam(boss, zb + 5, P, 3), { tone: "faint" }) }));
    out.push(L(k.ring(rx, ry, 3.6, zb + 10, P, 24), { tone: "faint" }));
    out.push(thumbScrew([rx + 5, ry, zb + 5], [1, 0, 0], 5));
    from = zb + 10;
  }
  out.push(S(k.cylinder(rx, ry, 3, from, top - from, P, 28), { tone: "mid", crease: "none" }));
  out.push(S(k.cylinder(rx, ry, 3.5, top, 2, P, 28, 0.4), { tone: "mid" }));
  return out.join("");
}

// the round arm of a clamp, from the boss on the rod toward +y
function clampArm(x, y0, y1, z) {
  const F = G.frameAlong([x, y0, z], [0, 1, 0]);
  return S(G.disc(0, y1 - y0, 1.8, F, P), { tone: "mid" }) + S(G.disc(y1 - y0 - 0.1, y1 - y0 + 1.2, 2.3, F, P), { tone: "mid" });
}

const FLASK_CLAMP = { z: 86, h: 5 };
function flaskClampBack() {
  const [rx, ry] = GEO.rods.flask;
  const z = FLASK_CLAMP.z;
  const out = [clampArm(rx, ry + 5, -16, z + FLASK_CLAMP.h / 2)];
  // the yoke behind the neck, and the left prong with its cork pad
  out.push(S(k.slabOf({ x: -70, y: -15, w: 20, d: 4, r: 1 }, z, FLASK_CLAMP.h, P, 3, 0.4), { tone: "mid" }));
  out.push(S(k.slabOf({ x: -70, y: -11, w: 3.4, d: 15, r: 1 }, z, FLASK_CLAMP.h, P, 3, 0.4), { tone: "mid" }));
  out.push(S(k.slabOf({ x: -66.6, y: -4, w: 1.2, d: 8, r: 0.4 }, z + 0.6, FLASK_CLAMP.h - 1.2, P, 2), { tone: "lo", crease: "none" }));
  out.push(D([at([-65, -13, z + FLASK_CLAMP.h])], { size: 0.45 }));
  return out.join("");
}
function flaskClampFront() {
  const z = FLASK_CLAMP.z;
  const out = [];
  out.push(S(k.slabOf({ x: -54.6, y: -4, w: 1.2, d: 8, r: 0.4 }, z + 0.6, FLASK_CLAMP.h - 1.2, P, 2), { tone: "lo", crease: "none" }));
  out.push(S(k.slabOf({ x: -53.4, y: -11, w: 3.4, d: 15, r: 1 }, z, FLASK_CLAMP.h, P, 3, 0.4), { tone: "mid" }));
  // wing screw that closes the jaws
  out.push(thumbScrew([-50, 0, z + FLASK_CLAMP.h / 2], [1, 0, 0], 5));
  out.push(D([at([-51.7, -9, z + FLASK_CLAMP.h])], { size: 0.45 }));
  return out.join("");
}

const C = along(GEO.clampAt);
const JAW = { top: C[2] + GEO.jacket.R / Math.cos(GEO.axis.tilt), bottom: C[2] - GEO.jacket.R / Math.cos(GEO.axis.tilt) };
function condClampBack() {
  const [rx, ry] = GEO.rods.cond;
  const out = [clampArm(rx, ry + 5, -18, C[2])];
  out.push(S(k.slabOf({ x: C[0] - 3.5, y: -18, w: 7, d: 4, r: 1 }, JAW.bottom - 3.2, JAW.top - JAW.bottom + 6.6, P, 3, 0.4), { tone: "mid" }));
  out.push(S(k.slabOf({ x: C[0] - 3.5, y: -14, w: 7, d: 19, r: 1 }, JAW.bottom - 3.2, 2.6, P, 3, 0.4), { tone: "mid" }));
  out.push(S(k.slabOf({ x: C[0] - 2.8, y: -8, w: 5.6, d: 12, r: 0.6 }, JAW.bottom - 0.6, 0.9, P, 2), { tone: "lo", crease: "none" }));
  out.push(D([at([C[0], -16, JAW.top + 3.4])], { size: 0.45 }));
  return out.join("");
}
function condClampFront() {
  const out = [];
  out.push(S(k.slabOf({ x: C[0] - 2.8, y: -8, w: 5.6, d: 12, r: 0.6 }, JAW.top - 0.4, 1.1, P, 2), { tone: "lo", crease: "none" }));
  out.push(S(k.slabOf({ x: C[0] - 3.5, y: -14, w: 7, d: 19, r: 1 }, JAW.top + 0.7, 2.6, P, 3, 0.4), { tone: "mid" }));
  out.push(D([at([C[0], 1.5, JAW.top + 3.3])], { size: 0.5, tone: "mid" }));
  return out.join("");
}

// ---------------------------------------------------------------- the hotplate

function hotplate() {
  const H = GEO.hot;
  const plan = H.plan;
  const out = [];
  out.push(`<path class="iso-halo" d="${k.haloOf(k.insetPlan(plan, 2), 0, 0.1, P)}" style="filter:blur(5px)"/>`);
  for (const [x, y] of byDepth(k.corners(plan, 7))) out.push(S(k.cylinder(x, y, 2.8, 0, H.z0, P, 20), { tone: "lo" }));
  out.push(S(k.slabOf(plan, H.z0, H.z1 - H.z0, P, 4, 0.8), { tone: "mid", inner: L(k.sideSeam(plan, H.z1 - 4, P, 4), { tone: "faint" }) }));
  // vents on the side face
  const side = onSide(plan.x + plan.w);
  for (let i = 0; i < 6; i++) out.push(L(path(rrect(-22 + i * 7.4, 8, -18 + i * 7.4, 17, 1.2).map(([u, v]) => side(u, v)), true), { tone: "lo" }));
  // a chrome ring and the cast-iron disc
  const [cx, cy] = GEO.flask.c;
  out.push(S(k.cylinder(cx, cy, H.disc + 3, H.z1, 1.4, P, 64, 0.4), { tone: "hi", crease: "lo" }));
  out.push(S(k.cylinder(cx, cy, H.disc, H.z1 + 1.4, H.discTop - H.z1 - 1.4, P, 64, 0.5), { tone: "lo", crease: "faint" }));
  for (const r of [7, 13, 18.5]) out.push(L(k.ring(cx, cy, r, H.discTop, P, 56), { tone: "faint" }));
  out.push(`<g data-part="glow">${[10, 15.8].map((r) => `<path class="ds-glow" d="${k.ring(cx, cy, r, H.discTop, P, 56)}"/>`).join("")}</g>`);
  out.push(D(k.corners(plan, 4).map(([x, y]) => at([x, y, H.z1])), { size: 0.45 }));
  // front panel: knob with its scale, pilot lamp, a name plate
  const front = onFront(H.front);
  out.push(L(path(rrect(plan.x + 3, H.z0 + 3, plan.x + plan.w - 3, H.z1 - 6, 1.5).map(([u, v]) => front(u, v)), true), { tone: "faint" }));
  const n = GEO.knob;
  out.push(L(path(arcIn(front, n.x, n.z, 8.8, -n.span, n.span, 36)), { tone: "lo" }));
  const kt = dialTicks(front, n.x, n.z, 8.8, -n.span, n.span, 11, 5, [1.1, 2.1]);
  out.push(L(kt.minor, { tone: "lo" }), L(kt.major, { tone: "mid" }));
  const KF = G.frameAlong([n.x, H.front, n.z], [0, 1, 0]);
  out.push(S(G.disc(0, 1, 6.8, KF, P), { tone: "mid" }));
  out.push(S(G.disc(1, n.face - H.front, 5.6, KF, P), { tone: "mid", inner: k.fadedSvg(G.ribsOf(KF, 1, n.face - H.front, 5.6, 40, P, { fade: [0.1, 0.55] }), { tone: "lo" }) }));
  out.push(L(G.circleOf(KF, n.face - H.front, n.ring + 0.6, P), { tone: "faint" }));
  out.push(`<path class="iso-line" data-tone="hi" data-part="pointer" d="${pointerOf(START.power, P)}" style="stroke-width:.9"/>`);
  out.push(D([at([n.x, n.face, n.z])], { size: 0.7, tone: "hi" }));
  const LF = G.frameAlong([-62, H.front, 14], [0, 1, 0]);
  out.push(S(G.disc(0, 1, 2.6, LF, P), { tone: "mid" }));
  out.push(S(G.disc(1, 2.2, 1.7, LF, P), { tone: "hi" }));
  const lamp = at([-62, H.front + 2.2, 14]);
  out.push(`<circle class="ds-lamp" data-part="lamp" data-on="" cx="${lamp[0].toFixed(1)}" cy="${lamp[1].toFixed(1)}" r="1.1"/>`);
  const tag = rrect(-54, 9.5, -33, 18.5, 0.8).map(([u, v]) => front(u, v));
  out.push(S({ fill: path(tag, true), outline: path(tag, true), crease: "", top: "", shades: ["", "", "", ""] }, { tone: "lo" }));
  out.push(L(path([front(-51, 15.6), front(-36, 15.6)]), { tone: "lo", free: true }), L(path([front(-51, 12.4), front(-40, 12.4)]), { tone: "faint", free: true }));
  // the mains cable leaves the back through a grommet and runs off the plate's back edge
  return out.join("");
}

// ---------------------------------------------------------------- water hoses with their floor fittings

function hose(s, tap) {
  const [x] = along(s);
  const bottom = along(s)[2] - GEO.jacket.R / Math.cos(GEO.axis.tilt);
  const W = GEO.water;
  const out = [];
  // floor fitting with a barb pointing back at the hose
  const block = { x: x - 5, y: W.y, w: 10, d: W.block, r: 1.2 };
  out.push(S(k.slabOf(block, 0, 9, P, 3, 0.5), { tone: "mid", inner: L(k.sideSeam(block, 3, P, 3), { tone: "faint" }) }));
  out.push(D([at([x - 3, W.y + W.block - 1.6, 9]), at([x + 3, W.y + W.block - 1.6, 9])], { size: 0.45 }));
  if (tap) {
    out.push(S(k.cylinder(x, W.y + W.block / 2, 2, 9, 3, P, 20), { tone: "mid" }));
    out.push(S(k.slabOf({ x: x - 1, y: W.y + 0.4, w: 2, d: W.block - 0.8, r: 0.6 }, 12, 1.6, P, 2, 0.3), { tone: "hi" }));
  }
  const BF = G.frameAlong([x, W.y, 5], [0, -1, 0]);
  out.push(S(G.disc(0, 3, 1.4, BF, P), { tone: "hi" }));
  // the nipple under the jacket, with its barb
  out.push(S(k.cylinder(x, 0, 1.5, bottom - 8, 9, P, 20), { tone: "hi", crease: "none" }));
  // the rubber hose: down from the nipple, then forward to the fitting
  const route = G.fillet([[x, 0, bottom - 3.4], [x, 0, 5], [x, W.y - 2.4, 5]], 6, 10, { P, tube: 2.3 });
  out.push(tubePieces(route, 2.3, P, { maxLength: 400 }).map((piece) => tubeSvg(piece, { tone: "mid" })).join(""));
  return out.join("");
}

// ---------------------------------------------------------------- the distillation flask

function flask() {
  const { c, R, neck, neckTop } = GEO.flask;
  const [cx, cy] = c;
  const out = [];
  const ball = G.sphereOf(c, R, P, { steps: 96 });
  out.push(`<path class="iso-fill" d="${ball.fill}"/>`);
  const level = M.levelFor(TABLE.flask, M.potVolume(START) * PER_ML.flask);
  const surf = surfaceOf(cx, cy, FLASK_INSIDE, level, P);
  out.push(`<path class="ds-liquid" data-part="pot" d="${waterPath(cx, cy, FLASK_INSIDE, level, P)}"/>`);
  out.push(`<path class="ds-liquid-top" data-part="pot-top" d="${surf.top}"/>`);
  // boiling chips on the bottom, and the bubbles that rise from them
  const chips = [[-4, 3], [5, -2], [1, 7], [-7, -5], [8, 6]].map(([dx, dy]) => at([cx + dx, cy + dy, c[2] - R + 1.6 + (dx * dx + dy * dy) / 46]));
  out.push(chips.map(([x, y]) => `<circle class="ds-chip" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="1.2"/>`).join(""));
  out.push(`<g data-part="bubbles">${Array.from({ length: 46 }, () => `<circle class="ds-bubble" r="0" cx="0" cy="0"/>`).join("")}</g>`);
  out.push(`<path class="iso-line" data-tone="faint" data-part="pot-back" d="${surf.back}"/>`);
  out.push(`<path class="iso-line" data-tone="hi" data-part="pot-front" d="${surf.front}"/>`);
  const arc = [];
  const [sx, sy] = at(c);
  const rho = R * G.scaleOf(P) * 0.8;
  for (let a = 196; a <= 252; a += 4) arc.push([sx + rho * Math.cos((a * Math.PI) / 180), sy + rho * Math.sin((a * Math.PI) / 180)]);
  out.push(k.fadeLineSvg(arc, { fade: [9, 9], tone: "mid" }));
  out.push(glassEdge(ball.outline));
  // the neck, with the thermometer bulb and stem inside it
  const z0 = c[2] + Math.sqrt(R * R - neck * neck) - 1;
  const tube = k.cylinder(cx, cy, neck, z0, neckTop - z0, P, 40);
  out.push(`<path class="iso-fill" d="${tube.fill}"/>`);
  const T = GEO.therm;
  const TF = G.frameOf([cx, cy, 0], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
  out.push(S(G.solidOf([[T.bulb[0], 0.4, 1], [T.bulb[0] + 0.6, 1.5, 1], [T.bulb[0] + 2, T.r, 1], [T.bulb[1] - 1, T.r, 1], [T.bulb[1], 1.3]], TF, P), { tone: "hi" }));
  out.push(S(k.cylinder(cx, cy, 1.3, T.bulb[1], neckTop - T.bulb[1], P, 20), { tone: "hi", crease: "none" }));
  out.push(L(path([at([cx, cy, T.bulb[1] - 1]), at([cx, cy, neckTop])]), { tone: "lit", className: "ds-column" }));
  for (const t of [A + Math.PI / 2, A - Math.PI / 2]) out.push(k.fadeLineSvg([surfacePoint(cx, cy, GEO.flask.neckIn, t, z0 + 1), surfacePoint(cx, cy, GEO.flask.neckIn, t, neckTop)], { fade: [8, 3], tone: "faint" }));
  const shineAt = A + (48 * Math.PI) / 180;
  out.push(k.fadeLineSvg([surfacePoint(cx, cy, neck, shineAt, z0 + 4), surfacePoint(cx, cy, neck, shineAt, neckTop - 2)], { fade: [8, 8], tone: "mid" }));
  out.push(glassEdge(tube.outline));
  return out.join("");
}

// the side arm from the neck down to the condenser, and the rubber sleeve over the joint
function sideArm() {
  const F = G.frameAlong(GEO.axis.o, GEO.axis.u);
  const out = [];
  const body = G.disc(GEO.arm.s0, GEO.arm.s1, GEO.arm.r, F, P);
  out.push(`<path class="iso-fill" d="${body.fill}"/>`);
  out.push(L(G.arcOf(F, GEO.arm.s0 + 0.4, GEO.arm.r, P), { tone: "faint" }));
  out.push(glassEdge(body.outline));
  const [s0, s1] = GEO.sleeve[0];
  out.push(S(G.disc(s0, s1, 3.4, F, P), { tone: "lo", inner: L(G.arcOf(F, (s0 + s1) / 2, 3.4, P), { tone: "faint" }) }));
  return out.join("");
}

function stopperAndStem() {
  const [cx, cy] = GEO.flask.c;
  const [z0, z1] = GEO.stopper;
  const F = G.frameOf([cx, cy, 0], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
  const T = GEO.therm;
  const out = [];
  out.push(S(G.solidOf([[z0, 5.6], [z1, 6.6]], F, P), { tone: "lo", inner: L(G.arcOf(F, z0 + 2.5, 5.9, P, { slope: 0.17 }), { tone: "faint" }) }));
  // the stem above the stopper: glass, column, scale
  const stem = k.cylinder(cx, cy, T.r, z1, T.top - z1, P, 28);
  out.push(`<path class="iso-fill" d="${stem.fill}"/>`);
  out.push(`<path class="iso-line ds-column" data-tone="lit" data-free="" data-part="column" d="${columnOf(START.th, P)}"/>`);
  const scaleAt = A - (28 * Math.PI) / 180;
  const minor = [];
  const major = [];
  const marks = [];
  for (let t = 0; t <= 110; t += 5) {
    const z = T.zero + t * T.k;
    const span = t % 10 === 0 ? 46 : 26;
    const d = path([0, 1].map((f) => surfacePoint(cx, cy, T.r + 0.05, scaleAt - (f * span * Math.PI) / 180, z)));
    (t % 10 === 0 ? major : minor).push(d);
  }
  for (const t of [78.4, 100]) {
    const z = T.zero + t * T.k;
    marks.push(path([0, 1].map((f) => surfacePoint(cx, cy, T.r + 0.05, scaleAt - (f * 58 * Math.PI) / 180, z))));
  }
  out.push(L(path([surfacePoint(cx, cy, T.r + 0.05, scaleAt, T.zero), surfacePoint(cx, cy, T.r + 0.05, scaleAt, T.zero + 110 * T.k)]), { tone: "lo" }));
  out.push(L(minor.join(""), { tone: "lo" }), L(major.join(""), { tone: "mid" }), L(marks.join(""), { tone: "hi" }));
  out.push(k.fadeLineSvg([surfacePoint(cx, cy, T.r, A + Math.PI * 0.32, z1 + 3), surfacePoint(cx, cy, T.r, A + Math.PI * 0.32, T.top - 3)], { fade: [10, 10], tone: "mid" }));
  out.push(glassEdge(stem.outline));
  out.push(S(G.solidOf([[T.top, T.r], [T.top + 1.6, T.r, 1], [T.top + 2.6, 1.3, 1], [T.top + 3, 0.3]], F, P), { tone: "hi" }));
  return out.join("");
}

// ---------------------------------------------------------------- the Liebig condenser

function condenser() {
  const F = G.frameAlong(GEO.axis.o, GEO.axis.u);
  const J = GEO.jacket;
  const out = [];
  // the jacket narrows to the inner tube in two blown shoulders (quarter ellipses)
  const jacketOf = (inset) => {
    const R = J.R - inset;
    const n = J.neck - inset * 0.75;
    const rows = [[J.s0 + inset, 0], [J.s0 + inset, n]];
    for (let i = 1; i <= 8; i++) {
      const t = (i / 8) * (Math.PI / 2);
      rows.push([J.s0 + inset + (J.taper - inset) * Math.sin(t), n + (R - n) * (1 - Math.cos(t)), 1]);
    }
    for (let i = 8; i >= 1; i--) {
      const t = (i / 8) * (Math.PI / 2);
      rows.push([J.s1 - inset - (J.taper - inset) * Math.sin(t), n + (R - n) * (1 - Math.cos(t)), 1]);
    }
    rows.push([J.s1 - inset, n], [J.s1 - inset, 0]);
    return rows;
  };
  const shell = G.outlineOf(jacketOf(0), F, P);
  out.push(`<path class="iso-fill" d="${shell.fill}"/>`);
  // cooling water fills the jacket
  const water = G.outlineOf(jacketOf(0.8), F, P);
  out.push(`<path class="ds-water" d="${water.fill}"/>`);
  // the inner tube, the vapour path, runs right through
  const I = GEO.inner;
  const tube = G.disc(I.s0, I.s1, I.r, F, P);
  out.push(`<path class="ds-inner" d="${tube.fill}"/>`);
  out.push(`<g data-part="condensate">${Array.from({ length: 18 }, () => `<circle class="ds-drop" r="0" cx="0" cy="0"/>`).join("")}</g>`);
  out.push(L(tube.outline, { tone: "mid" }));
  // the jacket glass in front: seams where it narrows, a long shine
  const t = G.angleToward(F, [-0.4, 0.5, 0.8]);
  out.push(k.fadeLineSvg([at(G.pointOf(F, J.s0 + 9, J.R, t)), at(G.pointOf(F, J.s1 - 9, J.R, t))], { fade: [20, 20], tone: "mid" }));
  out.push(glassEdge(shell.outline));
  // rubber sleeve to the adapter
  const [s0, s1] = GEO.sleeve[1];
  out.push(S(G.disc(s0, s1, 3.4, F, P), { tone: "lo", inner: L(G.arcOf(F, (s0 + s1) / 2, 3.4, P), { tone: "faint" }) }));
  return out.join("");
}

// the bent adapter that carries the distillate down into the receiver
function adapter() {
  const end = along(GEO.sleeve[1][1] - 2);
  const [tx, ty, tz] = GEO.tip;
  const route = G.fillet([end, along(GEO.sleeve[1][1] + 8), [tx, ty, tz + 9], [tx, ty, tz]], 7, 12, { P, tube: 2.6 });
  return tubePieces(route, (t) => 2.7 - 1.1 * Math.max(0, (t - 0.55) / 0.45), P, { maxLength: 400, caps: [false, true] })
    .map((piece) => tubeSvg(piece, { tone: "hi" }))
    .join("");
}

// ---------------------------------------------------------------- the receiver

function receiver() {
  const [cx, cy] = GEO.recv.c;
  const F = G.frameOf([cx, cy, 0], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
  const out = [];
  out.push(`<path class="iso-halo" d="${k.haloOf({ x: cx - 19, y: cy - 19, w: 38, d: 38, r: 19 }, 0, 0.1, P)}" style="filter:blur(4px)"/>`);
  // a cork ring under it
  out.push(S(k.cylinder(cx, cy, 16, 0, 1.6, P, 56, 0.4), { tone: "lo" }));
  // the glass is the union of its frusta: a wide stroke behind the fill leaves exactly its outline
  const glass = waterPath(cx, cy, RECV_OUT, RECV_OUT[RECV_OUT.length - 1][0], P);
  out.push(`<path class="ds-edge" d="${glass}"/><path class="iso-fill" d="${glass}"/>`);
  const level = M.levelFor(TABLE.recv, M.collected(START) * PER_ML.recv);
  const surf = surfaceOf(cx, cy, RECV_INSIDE, level, P);
  out.push(`<path class="ds-liquid" data-part="recv" d="${waterPath(cx, cy, RECV_INSIDE, level, P)}"/>`);
  out.push(`<path class="ds-liquid-top" data-part="recv-top" d="${surf.top}"/>`);
  out.push(`<path class="iso-line" data-tone="faint" data-part="recv-back" d="${surf.back}"/>`);
  out.push(`<path class="iso-line" data-tone="hi" data-part="recv-front" d="${surf.front}"/>`);
  // graduation every 25 mL on the cone, with a white marking field
  const outR = (z) => 20.7 + ((7.6 - 20.7) * (z - 2.8)) / (29.6 - 2.8);
  const gradAt = A + (8 * Math.PI) / 180;
  const marks = [];
  for (const ml of [25, 50, 75, 100]) {
    const z = M.levelFor(TABLE.recv, ml * PER_ML.recv);
    const r = outR(z) + 0.05;
    const span = ml % 50 === 0 ? 0.62 : 0.4;
    marks.push(path(Array.from({ length: 9 }, (_, i) => surfacePoint(cx, cy, r, gradAt - (span * i) / 8, z))));
  }
  const z100 = M.levelFor(TABLE.recv, 100 * PER_ML.recv);
  out.push(L(path([surfacePoint(cx, cy, outR(4) + 0.05, gradAt, 4), surfacePoint(cx, cy, outR(z100) + 0.05, gradAt, z100)]), { tone: "lo" }));
  out.push(L(marks.join(""), { tone: "mid", free: "end" }));
  out.push(k.fadeLineSvg([surfacePoint(cx, cy, outR(5), A + 0.85, 5), surfacePoint(cx, cy, outR(26), A + 0.85, 26)], { fade: [6, 6], tone: "mid" }));
  // lip
  const lip = GEO.recv.lip;
  out.push(S(G.ringBand(44.4, lip, 5.6, 7.2, F, P), { tone: "hi" }));
  out.push(`<path class="ds-void" d="${G.circleOf(F, lip, 5.6, P)}"/>`);
  out.push(L(G.circleOf(F, lip, 5.6, P), { tone: "mid" }));
  out.push(`<g data-part="drips">${Array.from({ length: 8 }, () => `<circle class="ds-drip" r="0" cx="0" cy="0"/>`).join("")}</g>`);
  return out.join("");
}

// ---------------------------------------------------------------- volumes

const TABLE = { flask: M.volumeTable(FLASK_INSIDE, FLASK_INSIDE[0][0]), recv: M.volumeTable(RECV_INSIDE, RECV_INSIDE[0][0]) };
// the flask holds 250 mL to the neck, the receiver 100 mL to its top mark (just under the shoulder)
const PER_ML = {
  flask: M.volumeAt(TABLE.flask, GEO.flask.c[2] + GEO.flask.r - 1) / 250,
  recv: M.volumeAt(TABLE.recv, 26.5) / 100,
};

const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label:
    "Установка для перегонки: колба Вюрца со смесью спирта и воды стоит на электроплитке и закреплена лапкой штатива. В горле колбы термометр, его шарик на уровне отводной трубки. Отводная трубка уходит в наклонный холодильник Либиха, по рубашке которого снизу вверх течёт холодная вода. Через изогнутый аллонж конденсат капает в коническую колбу-приёмник.",
  body: [
    plate(),
    rod(GEO.rods.flask, 150, [FLASK_CLAMP.z - 2.5]),
    rod(GEO.rods.cond, 104, [C[2] - 5]),
    flaskClampBack(),
    hotplate(),
    hose(GEO.nipples.out, false),
    flask(),
    sideArm(),
    flaskClampFront(),
    stopperAndStem(),
    condClampBack(),
    hose(GEO.nipples.in, true),
    condenser(),
    condClampFront(),
    receiver(),
    adapter(),
  ],
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
const TABLE = { flask: volumeTable(FLASK_INSIDE, FLASK_INSIDE[0][0]), recv: volumeTable(RECV_INSIDE, RECV_INSIDE[0][0]) };
const PER_ML = ${JSON.stringify(PER_ML)};
const stage = document.querySelector(".iso-stage");
const svg = stage.querySelector("svg");
const part = (name) => svg.querySelector('[data-part="' + name + '"]');
const readout = document.querySelector("[data-readout]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const pot = { water: part("pot"), top: part("pot-top"), front: part("pot-front"), back: part("pot-back"), at: GEO.flask.c, profile: FLASK_INSIDE, table: TABLE.flask, per: PER_ML.flask };
const recv = { water: part("recv"), top: part("recv-top"), front: part("recv-front"), back: part("recv-back"), at: GEO.recv.c, profile: RECV_INSIDE, table: TABLE.recv, per: PER_ML.recv };
const column = part("column"), pointer = part("pointer"), lamp = part("lamp"), glow = part("glow");
const bubbleDots = [...part("bubbles").children], dropDots = [...part("condensate").children], dripDots = [...part("drips").children];

let s = { ...START };
let power = START.power, target = START.power;
let refill = null;
const live = { bubbles: [], drops: [], drips: [], emit: 0, dripAcc: 0, dropAcc: 0 };
const drawn = {};
function drawVessel(v, ml) {
  const level = levelFor(v.table, ml * v.per);
  const key = level.toFixed(2);
  if (v.key === key) return level;
  v.key = key;
  const f = surfaceOf(v.at[0], v.at[1], v.profile, level, P);
  v.water.setAttribute("d", waterPath(v.at[0], v.at[1], v.profile, level, P));
  v.top.setAttribute("d", f.top); v.front.setAttribute("d", f.front); v.back.setAttribute("d", f.back);
  return level;
}
const dot = (el, x, y, r) => { el.setAttribute("cx", x.toFixed(1)); el.setAttribute("cy", y.toFixed(1)); el.setAttribute("r", r.toFixed(2)); };
const hide = (el) => { if (el.getAttribute("r") !== "0") el.setAttribute("r", "0"); };
function draw() {
  pot.level = drawVessel(pot, potVolume(s));
  recv.level = drawVessel(recv, collected(s));
  const c = s.th.toFixed(2);
  if (drawn.th !== c) { drawn.th = c; column.setAttribute("d", columnOf(s.th, P)); }
  pointer.setAttribute("d", pointerOf(power, P));
  if (power > 0.01 && potVolume(s) > MIX.minLeft) lamp.setAttribute("data-on", ""); else lamp.removeAttribute("data-on");
  const g = clamp((s.plate - 90) / 170, 0, 1);
  const gk = g.toFixed(2);
  if (drawn.glow !== gk) { drawn.glow = gk; glow.style.opacity = gk; }
  bubbleDots.forEach((el, i) => { const b = live.bubbles[i]; if (!b) return hide(el); const [x, y] = iso([GEO.flask.c[0] + b.x + Math.sin(b.ph + b.z * 0.3) * 0.5, GEO.flask.c[1] + b.y, b.z], P); dot(el, x, y, b.r * P.scale * 1.26); });
  dropDots.forEach((el, i) => { const d = live.drops[i]; if (!d) return hide(el); const [x, y] = iso(along(d.s).map((v, j) => (j === 2 ? v - 1.3 : v)), P); dot(el, x, y, 0.9 * P.scale * 1.26); });
  dripDots.forEach((el, i) => { const d = live.drips[i]; if (!d) return hide(el); const [x, y] = iso([GEO.tip[0], GEO.tip[1], d.z], P); dot(el, x, y, d.r * P.scale * 1.26); });
  const text = readoutOf(s);
  if (readout.textContent !== text) readout.textContent = text;
}
function animate(dt) {
  // bubbles in the boiling pot, more the harder it boils
  if (s.boiling) live.emit += dt * (6 + 40 * power);
  while (live.emit >= 1) {
    live.emit -= 1;
    if (live.bubbles.length >= bubbleDots.length) continue;
    const a = Math.random() * 6.283, r = Math.sqrt(Math.random()) * 11;
    live.bubbles.push({ x: Math.cos(a) * r, y: Math.sin(a) * r, z: GEO.flask.c[2] - GEO.flask.r + 2 + r * r / 40, r: 0.5 + Math.random() * 0.8, v: 0, ph: Math.random() * 6.3 });
  }
  for (const b of live.bubbles) { b.v = Math.min(b.v + 90 * dt, 30); b.z += b.v * dt; b.r = Math.min(b.r + dt * 0.4, 1.6); }
  live.bubbles = live.bubbles.filter((b) => b.z + b.r < pot.level - 0.2);
  // condensate beads sliding down the inner tube; as many as the flow keeps on it
  live.dropAcc += dt * Math.min(9, s.flow * 4 + (s.pE + s.pW > 0.002 ? 1.5 : 0));
  while (live.dropAcc >= 1) { live.dropAcc -= 1; if (live.drops.length < dropDots.length) live.drops.push({ s: GEO.jacket.s0 + 8 + Math.random() * 40, v: 8 + Math.random() * 6 }); }
  for (const d of live.drops) { d.v = Math.min(d.v + 14 * dt, 40); d.s += d.v * dt; }
  live.drops = live.drops.filter((d) => d.s < GEO.inner.s1 - 1);
  // drips from the tip of the adapter: about four to a millilitre, at most eight a second
  live.dripAcc += dt * Math.min(8, s.flow * 4);
  while (live.dripAcc >= 1) { live.dripAcc -= 1; if (live.drips.length < dripDots.length) live.drips.push({ z: GEO.tip[2] - 1.2, v: 0, r: 0.7 }); }
  for (const d of live.drips) { d.v += 260 * dt; d.z -= d.v * dt; d.r = Math.min(0.85, d.r + dt * 3); }
  live.drips = live.drips.filter((d) => d.z > recv.level + 0.5);
}

// ---- tour, input, loop
let touring = !still.matches, phase = "heat", phaseAt = 0, clock = 0, idle = 0, frame = 0, last = 0, visible = false;
function startRefill() { refill = { from: s, t: 0 }; }
function stepRefill(dt) {
  refill.t = Math.min(1, refill.t + dt / 1.6);
  const e = 1 - Math.pow(1 - refill.t, 3);
  const f = refill.from, z = freshStill();
  const mix = (a, b) => a + (b - a) * e;
  s = { ...s, nE: mix(f.nE, z.nE), nW: mix(f.nW, z.nW), dE: mix(f.dE, 0), dW: mix(f.dW, 0), pE: 0, pW: 0, T: mix(f.T, z.T), th: mix(f.th, z.th), boiling: false, flow: 0 };
  if (refill.t >= 1) { s = { ...z, plate: s.plate }; refill = null; }
}
function tour() {
  const age = clock - phaseAt;
  const go = (next) => { phase = next; phaseAt = clock; };
  if (phase === "heat") { target = 0.9; if (collected(s) >= 46) go("off"); }
  else if (phase === "off") { target = 0; if (age > 5) { startRefill(); go("refill"); } }
  else if (phase === "refill") { target = 0; if (!refill && age > 2.4) go("heat"); }
}
function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  clock += dt;
  if (touring) tour();
  power += (target - power) * (1 - Math.exp(-dt / 0.2));
  if (Math.abs(target - power) < 0.002) power = target;
  if (refill) stepRefill(dt); else s = stepStill(s, power, dt);
  animate(dt);
  draw();
  const settled = !touring && !refill && power === target && power === 0 && !s.boiling && s.plate < 30 && Math.abs(s.th - 20) < 0.3 && !live.drips.length && !live.drops.length && !live.bubbles.length && s.pE + s.pW < 1e-4;
  frame = visible && !settled ? requestAnimationFrame(tick) : 0;
}
const run = () => { if (!frame && visible && !still.matches) { last = 0; frame = requestAnimationFrame(tick); } };
function describe() {
  stage.setAttribute("aria-valuenow", String(Math.round(target * 100)));
  stage.setAttribute("aria-valuetext", "Нагрев " + Math.round(target * 100) + " %");
}
function hold() {
  touring = false;
  clearTimeout(idle);
  idle = setTimeout(() => { if (!still.matches) { touring = true; phase = collected(s) >= 46 ? "off" : "heat"; phaseAt = clock; run(); } }, 3600);
}
// under reduced motion the still jumps to where it would settle: boiling at this power, or cold
function calmDraw() {
  if (!still.matches) return;
  power = target;
  live.bubbles = []; live.drops = []; live.drips = [];
  draw();
}
function steer(value) {
  hold();
  target = Math.round(clamp(value, 0, 1) * 100) / 100;
  describe();
  calmDraw();
  run();
}
function reset() {
  hold();
  if (still.matches) { s = { ...freshStill(), plate: s.plate }; calmDraw(); return; }
  startRefill();
  run();
}
let down = null;
stage.addEventListener("pointermove", (event) => {
  const box = svg.getBoundingClientRect();
  if (down && event.pointerType !== "mouse") {
    if (Math.abs(event.clientX - down.x) > 6) down.moved = true;
    steer(down.power + (event.clientX - down.x) / box.width * 1.6);
    return;
  }
  if (event.pointerType === "mouse") {
    if (down && Math.abs(event.clientX - down.x) > 6) down.moved = true;
    steer(((event.clientX - box.left) / box.width - 0.14) / 0.72);
  }
});
stage.addEventListener("pointerdown", (event) => {
  down = { x: event.clientX, power: target, at: performance.now(), moved: false };
  if (event.pointerType !== "mouse") { try { stage.setPointerCapture(event.pointerId); } catch {} }
});
const release = (event) => {
  if (down && !down.moved && event.type === "pointerup" && performance.now() - down.at < 600) reset();
  down = null;
};
stage.addEventListener("pointerup", release);
stage.addEventListener("pointercancel", release);
stage.addEventListener("keydown", (event) => {
  const step = event.shiftKey ? 0.25 : 0.05;
  const from = touring ? Math.round(power * 20) / 20 : target;
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
still.addEventListener?.("change", () => { if (still.matches) { touring = false; calmDraw(); } else { touring = true; run(); } });
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
.iso{--ds-liquid:#202428;--ds-liquid-top:#292e33;--ds-water:#181c20;--ds-inner:#1d2023;--ds-glow:#ff5a3c}
.iso[data-theme="light"]{--ds-liquid:#e4e8eb;--ds-liquid-top:#eef1f3;--ds-water:#eaf0f3;--ds-inner:#fbfbfa;--ds-glow:#e5484d}
.iso-page{width:100%;max-width:820px;margin:0 auto;padding:12px}
html.embed .iso-page{max-width:none}
html.embed{color-scheme:normal}
html.embed,html.embed body{background:transparent;overflow:hidden}
.iso-figure{margin:0}
.iso-stage{touch-action:pan-y;outline:none;cursor:ew-resize;-webkit-tap-highlight-color:transparent}
.iso-stage:focus-visible{outline:1px solid var(--anatomy-muted);outline-offset:6px}
.ds-liquid{fill:var(--ds-liquid);stroke:none}
.ds-liquid-top{fill:var(--ds-liquid-top);stroke:none}
.ds-water{fill:var(--ds-water);stroke:none}
.ds-inner{fill:var(--ds-inner);stroke:none}
.ds-column{stroke-width:1.1}
.ds-glow{fill:none;stroke:var(--ds-glow);stroke-width:1.2;opacity:.85}
.ds-chip{fill:var(--anatomy-paper);stroke:var(--anatomy-mid);stroke-width:.5}
.ds-bubble{fill:var(--ds-liquid-top);stroke:var(--anatomy-mid);stroke-width:.5}
.ds-drop{fill:var(--anatomy-hi);stroke:none;opacity:.55}
.ds-drip{fill:var(--anatomy-hi);stroke:none}
.ds-edge{fill:none;stroke:var(--anatomy-hi);stroke-width:1.25;stroke-linejoin:round}
.ds-void{fill:var(--anatomy-shade-0);stroke:none}
.ds-lamp{fill:var(--ds-glow);opacity:.12;transition:opacity .3s}
.ds-lamp[data-on]{opacity:.95}
@media (max-width:560px){.iso-page{padding:6px}.iso-plate{overflow:hidden}.iso-plate .iso-svg{width:116%;margin:-3% -8% -5%}}
`;

const body = k.plateHtml({
  fig: "Рис. 1",
  title: "Перегонка",
  hint: "Нагрев ← →, клик — заново",
  readout: M.readoutOf(START),
  keys: [
    { mark: "lit", label: "Столбик термометра: температура пара у отводной трубки" },
    { mark: "raised", label: "Холодильник Либиха: вода входит снизу, выходит сверху" },
  ],
  caption:
    "В колбе 100 мл смеси: 70 мл спирта и 30 мл воды. Спирт кипит при 78,4 °C, вода — при 100 °C, а смесь закипает около 80 °C. Пар над ней богаче спиртом, чем жидкость, поэтому первый дистиллят — это примерно 84-процентный спирт. Пар конденсируется в холодильнике и стекает в приёмник. Спирта в колбе становится меньше, и температура кипения постепенно растёт к 100 °C. Если греть слабо, тепло уходит в воздух и смесь не закипает. Время ускорено в 10 раз.",
  body: `<div class="iso-stage" tabindex="0" role="slider" aria-label="Перегонка: стрелки меняют нагрев плитки от 0 до 100 %, пробел или Enter — заново наполнить колбу" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(START.power * 100)}">${svg}</div>`,
});

const file = theme === "light" ? "index-light.html" : "index.html";
const html = k
  .pageHtml({ title: "Перегонка", theme, body, script: kitScript() + live })
  .replace('<html lang="en">', '<html lang="ru">')
  .replace("</style></head>", `${CSS}${theme === "light" ? "html{color-scheme:light}" : ""}</style></head>`);
writeFileSync(join(HERE, file), html);
console.log("wrote", file, (html.length / 1024).toFixed(0) + " KB");
