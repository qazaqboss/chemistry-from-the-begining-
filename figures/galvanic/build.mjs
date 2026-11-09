// Daniell–Jacobi galvanic cell with a voltmeter and a knife switch.  node build.mjs  /  node build.mjs --light
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../../tools/anatomy/kit/iso-kit.mjs";
import * as G from "../../tools/anatomy/kit/lathe.mjs";
import { tubePieces, tubeSvg } from "../../tools/anatomy/kit/tube.mjs";
import { kitScript } from "../../tools/anatomy/scripts/inline-kit.mjs";
import * as M from "./model.mjs";
import { GEO, needleOf, bladeOf } from "./parts.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--light") ? "light" : "dark";

const WIDTH = 600;
const HEIGHT = 440;
const PLATE = GEO.plate;
const PLATE_H = 9;
const FOOT_H = 4;

// The state the page opens in (and keeps under reduced motion): standard cell, key closed.
const START = { zn: 1, cu: 1, closed: true };

const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [GEO.beakers.zn[0], GEO.beakers.zn[1], 92], [GEO.beakers.cu[0], GEO.beakers.cu[1], 92], [-15, -38, 90]],
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
function thumbScrew(origin, axis, length = 4.4, r = 2.4) {
  const F = G.frameAlong(origin, axis);
  return (
    S(G.disc(0, 1.2, r * 0.45, F, P), { tone: "mid" }) +
    S(G.disc(1.2, length, r, F, P), { tone: "mid", inner: k.fadedSvg(G.ribsOf(F, 1.2, length, r, 18, P, { fade: [0.1, 0.55] }), { tone: "lo" }) })
  );
}
const ring = (cx, cy, r, z, from, to, n = 24) => path(Array.from({ length: n + 1 }, (_, i) => at([cx + r * Math.cos(from + ((to - from) * i) / n), cy + r * Math.sin(from + ((to - from) * i) / n), z])));

// ---------------------------------------------------------------- base board

function board() {
  const out = [`<path class="iso-halo" d="${k.haloOf(PLATE, -PLATE_H - FOOT_H, PLATE_H, P)}"/>`];
  for (const [x, y] of byDepth(k.corners(PLATE, 18))) {
    out.push(S(k.cylinder(x, y, 6, -PLATE_H - FOOT_H, 1.4, P, 28), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 4.8, -PLATE_H - FOOT_H + 1.4, FOOT_H - 1.4, P, 28), { tone: "mid" }));
  }
  out.push(S(k.slabOf(PLATE, -PLATE_H, PLATE_H, P, 8, 1.6), { tone: "mid", inner: L(k.sideSeam(PLATE, -4, P, 8), { tone: "faint" }) }));
  out.push(L(k.planOutline(k.insetPlan(PLATE, 5), 0, P), { tone: "lo" }));
  const screws = k.corners(PLATE, 9);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 2.2, 0, P, 16)).join(""), { tone: "lo" }));
  out.push(D(screws.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
  // seats for the beakers
  for (const [cx, cy] of Object.values(GEO.beakers)) out.push(L(k.ring(cx, cy, GEO.beaker.r + 2.5, 0, P, 64), { tone: "faint" }));
  // label plate with the cell scheme
  const tag = { x: -94, y: 30, w: 52, d: 16, r: 1.5 };
  out.push(S(k.slabOf(tag, 0, 0.8, P, 3), { tone: "lo", crease: "none" }));
  out.push(L(k.planOutline(k.insetPlan(tag, 1.4), 0.8, P, 3), { tone: "faint" }));
  out.push(k.faceTextSvg(k.topMatrix([tag.x + tag.w / 2, tag.y + 7], 0.8, P, "x"), "Zn | ZnSO₄ || CuSO₄ | Cu", { size: 3, tone: "mid", anchor: "middle" }));
  out.push(L(k.lineOnTop([tag.x + 10, tag.y + 11.2], [tag.x + tag.w - 10, tag.y + 11.2], 0.8, P), { tone: "lo", free: true }));
  out.push(D([at([tag.x + 3, tag.y + tag.d / 2, 0.8]), at([tag.x + tag.w - 3, tag.y + tag.d / 2, 0.8])], { size: 0.45 }));
  return out.join("");
}

// ---------------------------------------------------------------- the voltmeter

const FULL = M.CELL.full;
function voltmeter() {
  const m = GEO.meter;
  const plan = m.plan;
  const face = plan.y + plan.d;
  const front = onFront(face);
  const out = [];
  out.push(`<path class="iso-halo" d="${k.haloOf(k.insetPlan(plan, 2), 0, 0.1, P)}" style="filter:blur(4px)"/>`);
  for (const [x, y] of byDepth(k.corners(plan, 4))) out.push(S(k.cylinder(x, y, 2.2, 0, m.z0, P, 18), { tone: "lo" }));
  out.push(S(k.slabOf(plan, m.z0, m.z1 - m.z0, P, 4, 0.8), { tone: "mid", inner: L(k.sideSeam(plan, m.z1 - 4, P, 4), { tone: "faint" }) }));
  out.push(D(k.corners(plan, 3.4).map(([x, y]) => at([x, y, m.z1])), { size: 0.45 }));
  // dial window, scale, needle
  const win = rrect(plan.x + 3.5, 7, plan.x + plan.w - 3.5, 33.5, 1.4).map(([u, v]) => front(u, v));
  out.push(`<path class="gv-window" d="${path(win, true)}"/>`);
  out.push(L(path(win, true), { tone: "lo" }));
  out.push(L(path(arcIn(front, m.cx, m.cz, m.r, -m.span, m.span, 40)), { tone: "lo" }));
  const ticks = dialTicks(front, m.cx, m.cz, m.r, -m.span, m.span, 16, 5, [1.4, 2.6]);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  // the 1,10 V mark of the standard cell
  const t = ((-m.span + (2 * m.span * M.CELL.standard) / FULL) * Math.PI) / 180;
  out.push(L(path([front(m.cx + Math.sin(t) * (m.r + 2.9), m.cz + Math.cos(t) * (m.r + 2.9)), front(m.cx + Math.sin(t) * (m.r + 4.2), m.cz + Math.cos(t) * (m.r + 4.2))]), { tone: "hi", free: true }));
  out.push(`<text class="iso-face-text" data-tone="mid" transform="${k.sideMatrix([m.cx, face], 22, P, "left")}" font-size="3.4" text-anchor="middle">V</text>`);
  out.push(`<path class="iso-line" data-tone="hi" data-free="" data-part="needle" d="${needleOf(START.closed ? M.emfOf(START.zn, START.cu) : 0, P, FULL)}" style="stroke-width:.9"/>`);
  out.push(D([front(m.cx, m.cz)], { size: 1.1, tone: "hi" }));
  // zero-adjust screw under the window
  const ZF = G.frameAlong([m.cx, face, 4.2], [0, 1, 0]);
  out.push(S(G.disc(0, 0.8, 1.6, ZF, P), { tone: "mid" }));
  out.push(L(path([at([m.cx - 1.1, face + 0.8, 4.2]), at([m.cx + 1.1, face + 0.8, 4.2])]), { tone: "lo" }));
  // binding posts on top, with − and + engraved beside them
  for (const [name, x] of [["−", GEO.posts.minus], ["+", GEO.posts.plus]]) {
    const F = G.frameOf([x, GEO.posts.y, 0], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
    out.push(S(G.disc(m.z1, m.z1 + 1.2, 3, F, P), { tone: "lo" }));
    out.push(S(G.disc(m.z1 + 1.2, m.z1 + 2.8, 1.3, F, P), { tone: "mid" }));
    out.push(S(G.disc(m.z1 + 2.8, m.z1 + 5.6, 2.5, F, P), { tone: "mid", inner: k.fadedSvg(G.ribsOf(F, m.z1 + 2.8, m.z1 + 5.6, 2.5, 18, P, { fade: [0.1, 0.55] }), { tone: "lo" }) }));
    out.push(S(G.disc(m.z1 + 5.6, m.z1 + 6.6, 1.2, F, P), { tone: "hi" }));
    out.push(k.faceTextSvg(k.topMatrix([x + 6, GEO.posts.y + 3.6], m.z1, P, "x"), name, { size: 4, tone: "mid", anchor: "middle" }));
  }
  return out.join("");
}
const POST_TOP = GEO.meter.z1 + 6.6;

// ---------------------------------------------------------------- the knife switch

const SW_TERMS = { left: [33.5, 31.2], right: [62.5, 31.2] };
function switchBack() {
  const s = GEO.sw;
  const out = [];
  out.push(`<path class="iso-halo" d="${k.haloOf(s.plan, 0, 0.1, P)}" style="filter:blur(3px)"/>`);
  out.push(S(k.slabOf(s.plan, 0, s.z, P, 3, 0.5), { tone: "lo", inner: L(k.sideSeam(s.plan, 1.5, P, 3), { tone: "faint" }) }));
  // brass strips from the terminals to the jaws
  out.push(S(k.slabOf({ x: 32, y: 30.4, w: 7, d: 1.6, r: 0.4 }, s.z, 0.4, P, 2), { tone: "hi", crease: "none" }));
  out.push(S(k.slabOf({ x: 57, y: 30.4, w: 7, d: 1.6, r: 0.4 }, s.z, 0.4, P, 2), { tone: "hi", crease: "none" }));
  for (const [x, y] of Object.values(SW_TERMS)) {
    out.push(S(k.cylinder(x, y, 2.1, s.z, 1.4, P, 18), { tone: "mid" }));
    out.push(S(k.cylinder(x, y, 1.1, s.z + 1.4, 1.2, P, 14), { tone: "hi" }));
  }
  // the back jaw of the hinge and of the contact
  const [hx, hy] = s.hinge;
  for (const x0 of [hx - 2, hx + 20]) out.push(S(k.slabOf({ x: x0, y: hy - s.thick / 2 - 0.9, w: 4, d: 0.8, r: 0.2 }, s.z, 9.6, P, 2), { tone: "hi" }));
  out.push(D(k.corners(s.plan, 2.2).map(([x, y]) => at([x, y, s.z])), { size: 0.4 }));
  return out.join("");
}
function blade() {
  const shape = bladeOf(START.closed ? 0 : 1, P);
  const solid = (name, part) => `<g class="iso-solid${name === "blade" ? " gv-blade" : ""}" data-part="${name}"><path class="iso-fill" d="${part.fill}"/><path class="iso-top" d="${part.face}"/><path class="iso-line iso-edge" data-tone="mid" d="${part.fill}"/></g>`;
  return `<g class="gv-cu">${solid("blade", shape.blade)}</g>` + solid("handle", shape.handle);
}
function switchFront() {
  const s = GEO.sw;
  const [hx, hy, hz] = s.hinge;
  const out = [];
  for (const x0 of [hx - 2, hx + 20]) out.push(S(k.slabOf({ x: x0, y: hy + s.thick / 2 + 0.1, w: 4, d: 0.8, r: 0.2 }, s.z, 9.6, P, 2), { tone: "hi" }));
  out.push(D([at([hx, hy + s.thick / 2 + 0.9, hz])], { size: 0.6, tone: "mid" }));
  return out.join("");
}

// ---------------------------------------------------------------- the salt bridge, cut into chunks so each beaker draws its legs

const BR = GEO.bridge;
const [ZX, ZY] = GEO.beakers.zn;
const [CX, CY] = GEO.beakers.cu;
const BRIDGE_ROUTE = G.fillet(
  [
    [ZX + BR.inset, BR.y, BR.low],
    [ZX + BR.inset, BR.y, BR.high],
    [CX - BR.inset, BR.y, BR.high],
    [CX - BR.inset, BR.y, BR.low],
  ],
  10,
  12,
  { P, tube: BR.r },
);
const BRIDGE = tubePieces(BRIDGE_ROUTE, BR.r, P, { maxLength: 8 });
const inside = (piece, sign) => piece.mid[2] < GEO.beaker.lip + 1 && Math.sign(piece.mid[0]) === sign;
const bridgeSvg = (pieces) => pieces.map((piece) => tubeSvg(piece, { tone: "hi" })).join("");
const plug = (x) => S(k.cylinder(x, BR.y, BR.r - 0.2, BR.low - 2.4, 2.4, P, 20), { tone: "lo", crease: "none" });

// ---------------------------------------------------------------- the beakers

function beaker(name) {
  const [cx, cy] = GEO.beakers[name];
  const B = GEO.beaker;
  const out = [];
  out.push(`<path class="iso-halo" d="${k.haloOf({ x: cx - B.r, y: cy - B.r, w: 2 * B.r, d: 2 * B.r, r: B.r }, 0, 0.1, P)}" style="filter:blur(4px)"/>`);
  const glass = k.cylinder(cx, cy, B.r, 0, B.h, P, 64);
  out.push(`<path class="iso-fill" d="${glass.fill}"/>`);
  const liquid = k.cylinder(cx, cy, B.rIn, 1, B.level - 1, P, 64);
  out.push(`<path class="gv-liquid" d="${liquid.fill}"/>`);
  if (name === "cu") out.push(`<path class="gv-blue" data-part="blue" d="${liquid.fill}" style="opacity:${(M.blueOf(START.cu) * 0.5).toFixed(2)}"/>`);
  out.push(`<path class="gv-liquid-top" d="${k.ring(cx, cy, B.rIn, B.level, P, 64)}"/>`);
  if (name === "cu") out.push(`<path class="gv-blue gv-blue-top" data-part="blue-top" d="${k.ring(cx, cy, B.rIn, B.level, P, 64)}" style="opacity:${(M.blueOf(START.cu) * 0.5).toFixed(2)}"/>`);
  out.push(L(ring(cx, cy, B.rIn, B.level, A + Math.PI / 2, A + Math.PI * 1.5), { tone: "faint" }));
  // the metal plate, standing in its solution
  const E = GEO.plate_;
  const plan = { x: cx - E.half, y: cy - E.thick / 2, w: 2 * E.half, d: E.thick, r: 0.3 };
  const metal = name === "cu" ? "gv-cu" : "gv-zn";
  out.push(S(k.slabOf(plan, E.z0, GEO.lid.z - E.z0, P, 2), { tone: name === "cu" ? "hi" : "mid", className: metal, crease: "none", inner: L(k.sideSeam(plan, B.level, P, 2), { tone: "faint" }) }));
  // the salt bridge's leg in this beaker, with its cotton plug
  const sign = name === "zn" ? 1 : -1;
  out.push(plug(name === "zn" ? ZX + BR.inset : CX - BR.inset));
  out.push(bridgeSvg(BRIDGE.filter((piece) => inside(piece, -sign))));
  out.push(L(ring(cx, cy, B.rIn, B.level, A - Math.PI / 2, A + Math.PI / 2), { tone: "hi" }));
  // glass in front: graduation, shine, outline, lip
  const scaleAt = A - (34 * Math.PI) / 180;
  const marks = [];
  for (let z = 10; z <= 46; z += 4) {
    const span = (z - 10) % 12 === 0 ? 0.42 : 0.24;
    marks.push(path(Array.from({ length: 7 }, (_, i) => surfacePoint(cx, cy, B.r + 0.05, scaleAt + (span * i) / 6, z))));
  }
  out.push(L(path([surfacePoint(cx, cy, B.r + 0.05, scaleAt, 10), surfacePoint(cx, cy, B.r + 0.05, scaleAt, 46)]), { tone: "lo", free: "start" }));
  out.push(L(marks.join(""), { tone: "mid", free: "end" }));
  out.push(k.fadeLineSvg([surfacePoint(cx, cy, B.r, A + 0.9, 5), surfacePoint(cx, cy, B.r, A + 0.9, 47)], { fade: [10, 10], tone: "mid" }));
  out.push(glassEdge(glass.outline));
  const F = G.frameOf([cx, cy, 0], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
  out.push(S(G.ringBand(B.h, B.lip, B.rIn, B.r + 0.9, F, P), { tone: "hi" }));
  return out.join("");
}

function beakerTop(name) {
  const [cx, cy] = GEO.beakers[name];
  const E = GEO.plate_;
  const plan = { x: cx - E.half, y: cy - E.thick / 2, w: 2 * E.half, d: E.thick, r: 0.3 };
  const metal = name === "cu" ? "gv-cu" : "gv-zn";
  const out = [];
  // the lid bar across the rim, the plate going through its slot, the terminal on top
  const Ld = GEO.lid;
  const lid = { x: cx - Ld.half, y: cy - Ld.d / 2, w: 2 * Ld.half, d: Ld.d, r: 1.2 };
  out.push(S(k.slabOf(lid, Ld.z, Ld.h, P, 3, 0.5), { tone: "mid" }));
  out.push(D([at([cx - Ld.half + 3, cy, Ld.z + Ld.h]), at([cx + Ld.half - 3, cy, Ld.z + Ld.h])], { size: 0.5 }));
  out.push(S(k.slabOf({ ...plan }, Ld.z + Ld.h, E.z1 - Ld.z - Ld.h, P, 2), { tone: name === "cu" ? "hi" : "mid", className: metal, crease: "none" }));
  const T = GEO.terminal;
  const block = { x: cx - 3.2, y: cy - 2.6, w: 6.4, d: 5.2, r: 0.8 };
  out.push(S(k.slabOf(block, T.z0, T.z1 - T.z0, P, 2, 0.3), { tone: "mid" }));
  out.push(thumbScrew([cx, cy + 2.6, T.z0 + 2.4], [0, 1, 0], 3, 1.8));
  out.push(k.faceTextSvg(k.topMatrix([cx - 12, cy + 0.8], Ld.z + Ld.h, P, "x"), name === "zn" ? "Zn" : "Cu", { size: 3.6, tone: "mid", anchor: "middle" }));
  return out.join("");
}

// ---------------------------------------------------------------- wires

const ZT = [ZX, ZY, GEO.terminal.z1];
const CT = [CX, CY, GEO.terminal.z1];
const WIRES = [
  G.fillet([[ZT[0], ZT[1], ZT[2]], [ZT[0], ZT[1], 90], [-22, ZT[1], 90], [GEO.posts.minus, GEO.posts.y, 64], [GEO.posts.minus, GEO.posts.y, POST_TOP]], 9, 12, { P, tube: 1 }),
  G.fillet([[GEO.posts.plus, GEO.posts.y, POST_TOP], [GEO.posts.plus, GEO.posts.y, 54], [SW_TERMS.left[0], SW_TERMS.left[1], 24], [SW_TERMS.left[0], SW_TERMS.left[1], GEO.sw.z + 2.6]], 9, 12, { P, tube: 1 }),
  G.fillet([[SW_TERMS.right[0], SW_TERMS.right[1], GEO.sw.z + 2.6], [SW_TERMS.right[0], SW_TERMS.right[1], 14], [88, 2, 14], [88, CT[1], 40], [88, CT[1], 90], [CT[0], CT[1], 90], [CT[0], CT[1], CT[2]]], 8, 12, { P, tube: 1 }),
];
const wiresSvg = () => WIRES.map((route) => tubePieces(route, 1, P, { maxLength: 400 }).map((piece) => tubeSvg(piece, { tone: "mid" })).join("")).join("");
// screen polylines for the electrons (Zn → meter → switch → Cu) and the ions in the bridge
const screenOf = (route, spacing = 1.5) => G.resample(route, spacing).map((p) => at(p).map((v) => Math.round(v * 10) / 10));
const TRACKS = WIRES.map((route) => screenOf(route));
const BRIDGE_TRACK = screenOf(BRIDGE_ROUTE.filter((p) => p[2] > GEO.beaker.lip + 4));

const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label:
    "Гальванический элемент Даниэля–Якоби: слева цинковая пластина в стакане с раствором сульфата цинка, справа медная пластина в стакане с голубым раствором сульфата меди. Стаканы соединены солевым мостиком — U-образной трубкой с гелем KCl. Провода идут от цинка к минусу вольтметра со стрелкой, от плюса вольтметра через рубильник к меди. При замкнутом ключе электроны бегут по проводу от цинка к меди.",
  body: [
    board(),
    beaker("zn"),
    beaker("cu"),
    bridgeSvg(BRIDGE.filter((piece) => !inside(piece, 1) && !inside(piece, -1))),
    `<g data-part="ions">${Array.from({ length: 24 }, (_, i) => `<circle class="${i % 2 ? "gv-cl" : "gv-k"}" r="0" cx="0" cy="0"/>`).join("")}</g>`,
    beakerTop("zn"),
    beakerTop("cu"),
    voltmeter(),
    switchBack(),
    blade(),
    switchFront(),
    wiresSvg(),
    `<g data-part="electrons">${Array.from({ length: 64 }, () => `<circle class="gv-e" r="0" cx="0" cy="0"/>`).join("")}</g>`,
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
const TRACKS = ${JSON.stringify(TRACKS)};
const BRIDGE_TRACK = ${JSON.stringify(BRIDGE_TRACK)};
const stage = document.querySelector(".iso-stage");
const svg = stage.querySelector("svg");
const part = (name) => svg.querySelector('[data-part="' + name + '"]');
const readout = document.querySelector("[data-readout]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const needle = part("needle"), bladeEl = part("blade"), handleEl = part("handle"), blue = part("blue"), blueTop = part("blue-top");
const eDots = [...part("electrons").children], ionDots = [...part("ions").children];
const inputs = { zn: document.querySelector('[data-ctl="zn"]'), cu: document.querySelector('[data-ctl="cu"]') };
const outs = { zn: document.querySelector('[data-out="zn"]'), cu: document.querySelector('[data-out="cu"]') };
const keyButton = document.querySelector('[data-ctl="key"]');

// lengths along each screen track, to place dots by distance
const measure = (track) => { const acc = [0]; for (let i = 1; i < track.length; i++) acc.push(acc[i - 1] + Math.hypot(track[i][0] - track[i - 1][0], track[i][1] - track[i - 1][1])); return acc; };
const lens = TRACKS.map(measure), bridgeLen = measure(BRIDGE_TRACK);
function pointAt(track, acc, d) {
  let i = 1;
  while (i < acc.length - 1 && acc[i] < d) i++;
  const f = (d - acc[i - 1]) / (acc[i] - acc[i - 1] || 1);
  return [track[i - 1][0] + (track[i][0] - track[i - 1][0]) * f, track[i - 1][1] + (track[i][1] - track[i - 1][1]) * f];
}

const s = { lzn: Math.log10(START.zn), lcu: Math.log10(START.cu), tzn: Math.log10(START.zn), tcu: Math.log10(START.cu), closed: START.closed, lift: START.closed ? 0 : 1, needle: { x: START.closed ? emfOf(START.zn, START.cu) : 0, v: 0 }, flow: START.closed ? 1 : 0, phase: 0 };
const conc = () => ({ zn: Math.pow(10, s.lzn), cu: Math.pow(10, s.lcu) });
const drawn = {};
function draw() {
  const c = conc();
  needle.setAttribute("d", needleOf(s.needle.x, P, CELL.full));
  const lk = s.lift.toFixed(3);
  if (drawn.lift !== lk) {
    drawn.lift = lk;
    const shape = bladeOf(s.lift, P);
    for (const [el, p] of [[bladeEl, shape.blade], [handleEl, shape.handle]]) { const [fill, top, edge] = el.children; fill.setAttribute("d", p.fill); top.setAttribute("d", p.face); edge.setAttribute("d", p.fill); }
  }
  const b = (blueOf(c.cu) * 0.5).toFixed(3);
  if (drawn.blue !== b) { drawn.blue = b; blue.style.opacity = b; blueTop.style.opacity = b; }
  // electrons: evenly spaced dots running along the three wires, fading with the current
  const gap = 11;
  let n = 0;
  TRACKS.forEach((track, t) => {
    const total = lens[t][lens[t].length - 1];
    for (let d = (s.phase % gap); d < total && n < eDots.length; d += gap, n++) {
      const [x, y] = pointAt(track, lens[t], d);
      const el = eDots[n];
      el.setAttribute("cx", x.toFixed(1)); el.setAttribute("cy", y.toFixed(1)); el.setAttribute("r", (1.15 * s.flow).toFixed(2));
    }
  });
  for (; n < eDots.length; n++) if (eDots[n].getAttribute("r") !== "0") eDots[n].setAttribute("r", "0");
  // ions in the bridge: K⁺ toward the copper, Cl⁻ toward the zinc
  const total = bridgeLen[bridgeLen.length - 1];
  ionDots.forEach((el, i) => {
    const k = Math.floor(i / 2), dir = i % 2 ? -1 : 1;
    let d = ((k + 0.5) * total) / (ionDots.length / 2) + dir * s.phase * 0.18 + (i % 2) * 4;
    d = ((d % total) + total) % total;
    const [x, y] = pointAt(BRIDGE_TRACK, bridgeLen, d);
    const edge = Math.min(d, total - d) / 14;
    el.setAttribute("cx", x.toFixed(1)); el.setAttribute("cy", y.toFixed(1)); el.setAttribute("r", (0.95 * s.flow * Math.min(1, edge)).toFixed(2));
  });
  const text = readoutOf({ zn: c.zn, cu: c.cu, closed: s.closed });
  if (readout.textContent !== text) readout.textContent = text;
  for (const name of ["zn", "cu"]) { const v = molar(c[name]) + " M"; if (outs[name].textContent !== v) outs[name].textContent = v; }
}

// ---- tour, input, loop
let touring = !still.matches, clock = 0, tourAt = 0, idle = 0, frame = 0, last = 0, visible = false;
function setInputs() { inputs.zn.value = s.tzn.toFixed(2); inputs.cu.value = s.tcu.toFixed(2); }
function tour() {
  const t = clock - tourAt;
  // a 20 s loop: the key closes, copper sulfate is diluted a thousandfold and restored, then zinc sulfate is
  const cyc = t % 20;
  if (cyc < 1) { if (!s.closed) toggle(true, true); }
  const wave = (from, len) => { const u = clamp((cyc - from) / len, 0, 1); return -3 * Math.sin(Math.PI * u) ** 2; };
  s.tcu = wave(2, 7);
  s.tzn = wave(11, 7);
  setInputs();
}
function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  clock += dt;
  if (touring) tour();
  const f = 1 - Math.exp(-dt / 0.25);
  s.lzn += (s.tzn - s.lzn) * f; s.lcu += (s.tcu - s.lcu) * f;
  if (Math.abs(s.tzn - s.lzn) < 1e-4) s.lzn = s.tzn;
  if (Math.abs(s.tcu - s.lcu) < 1e-4) s.lcu = s.tcu;
  const c = conc();
  const want = s.closed ? emfOf(c.zn, c.cu) : 0;
  for (let i = 0; i < 4; i++) { s.needle.v += ((want - s.needle.x) * 80 - s.needle.v * 10) * dt / 4; s.needle.x += s.needle.v * dt / 4; }
  if (Math.abs(want - s.needle.x) < 5e-4 && Math.abs(s.needle.v) < 5e-4) { s.needle.x = want; s.needle.v = 0; }
  const lift = s.closed ? 0 : 1;
  s.lift += (lift - s.lift) * (1 - Math.exp(-dt / 0.12));
  if (Math.abs(lift - s.lift) < 0.002) s.lift = lift;
  s.flow += ((s.closed && s.lift < 0.05 ? 1 : 0) - s.flow) * (1 - Math.exp(-dt / 0.2));
  if (s.flow < 0.01 && !s.closed) s.flow = 0;
  s.phase += dt * 16 * s.flow;
  draw();
  const settled = !touring && !s.closed && s.flow === 0 && s.lift === 1 && s.needle.v === 0 && s.lzn === s.tzn && s.lcu === s.tcu;
  frame = visible && !settled ? requestAnimationFrame(tick) : 0;
}
const run = () => { if (!frame && visible && !still.matches) { last = 0; frame = requestAnimationFrame(tick); } };
function describe() {
  const c = { zn: Math.pow(10, s.tzn), cu: Math.pow(10, s.tcu) };
  stage.setAttribute("aria-label", "Гальванический элемент: ключ " + (s.closed ? "замкнут" : "разомкнут") + ", ЭДС " + emfOf(c.zn, c.cu).toFixed(3).replace(".", ",") + " В. Пробел — ключ, стрелки влево-вправо — концентрация Zn²⁺, вверх-вниз — Cu²⁺.");
  keyButton.setAttribute("aria-pressed", String(s.closed));
  keyButton.textContent = s.closed ? "Ключ замкнут" : "Ключ разомкнут";
}
function hold() {
  touring = false;
  clearTimeout(idle);
  idle = setTimeout(() => { if (!still.matches) { touring = true; tourAt = clock; run(); } }, 6000);
}
function calm() {
  if (!still.matches) return;
  s.lzn = s.tzn; s.lcu = s.tcu; s.lift = s.closed ? 0 : 1; s.flow = 0;
  const c = conc(); s.needle.x = s.closed ? emfOf(c.zn, c.cu) : 0; s.needle.v = 0;
  draw();
}
function toggle(to, fromTour = false) {
  if (!fromTour) hold();
  s.closed = to === undefined ? !s.closed : to;
  describe(); calm(); run();
}
function setConc(name, value) {
  hold();
  const v = clamp(Math.round(value * 20) / 20, CELL.min, CELL.max);
  if (name === "zn") s.tzn = v; else s.tcu = v;
  setInputs(); describe(); calm(); run();
}
inputs.zn.addEventListener("input", () => setConc("zn", +inputs.zn.value));
inputs.cu.addEventListener("input", () => setConc("cu", +inputs.cu.value));
keyButton.addEventListener("click", () => toggle());
stage.addEventListener("click", () => toggle());
stage.addEventListener("keydown", (event) => {
  const step = event.shiftKey ? 1 : 0.25;
  if (event.key === " " || event.key === "Enter") { event.preventDefault(); toggle(); return; }
  if (event.key === "ArrowRight") { event.preventDefault(); setConc("zn", s.tzn + step); }
  if (event.key === "ArrowLeft") { event.preventDefault(); setConc("zn", s.tzn - step); }
  if (event.key === "ArrowUp") { event.preventDefault(); setConc("cu", s.tcu + step); }
  if (event.key === "ArrowDown") { event.preventDefault(); setConc("cu", s.tcu - step); }
});
new IntersectionObserver((entries) => { visible = entries[entries.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "120px 0px" }).observe(stage);
still.addEventListener?.("change", () => { if (still.matches) { touring = false; calm(); } else { touring = true; tourAt = clock; run(); } });
setInputs();
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
.iso{--gv-liquid:#1d2125;--gv-liquid-top:#262b30;--gv-blue:#2f6fd6;--gv-blue-top:#4b86e6;--gv-cu-top:#5a3f2a;--gv-cu-side:#3e2b1d;--gv-zn-top:#3a3d40;--gv-zn-side:#2a2c2e;--gv-e:#ffffff}
.iso[data-theme="light"]{--gv-liquid:#e8ecee;--gv-liquid-top:#f1f3f4;--gv-blue:#4dabf7;--gv-blue-top:#74c0fc;--gv-cu-top:#f1cfb3;--gv-cu-side:#ddb08c;--gv-zn-top:#e4e6e8;--gv-zn-side:#cfd2d5;--gv-e:#000000}
.iso-page{width:100%;max-width:820px;margin:0 auto;padding:12px}
html.embed .iso-page{max-width:none}
html.embed{color-scheme:normal}
html.embed,html.embed body{background:transparent;overflow:hidden}
.iso-figure{margin:0}
.iso-stage{outline:none;cursor:pointer;-webkit-tap-highlight-color:transparent}
.iso-stage:focus-visible{outline:1px solid var(--anatomy-muted);outline-offset:6px}
.gv-liquid{fill:var(--gv-liquid);stroke:none}
.gv-liquid-top{fill:var(--gv-liquid-top);stroke:none}
.gv-blue{fill:var(--gv-blue);stroke:none}
.gv-blue-top{fill:var(--gv-blue-top)}
.gv-cu>.iso-top{fill:var(--gv-cu-top)}
.gv-cu>.iso-shade,.gv-cu>.iso-fill{fill:var(--gv-cu-side)}
.gv-zn>.iso-top{fill:var(--gv-zn-top)}
.gv-zn>.iso-shade,.gv-zn>.iso-fill{fill:var(--gv-zn-side)}
.gv-blade>.iso-top{fill:var(--gv-cu-top)}
.gv-blade>.iso-fill{fill:var(--gv-cu-side)}
.gv-window{fill:var(--anatomy-face);stroke:none}
.gv-e{fill:var(--gv-e);stroke:none}
.gv-k{fill:var(--anatomy-paper);stroke:var(--anatomy-hi);stroke-width:.5}
.gv-cl{fill:var(--anatomy-mid);stroke:none}
.gv-controls{display:flex;flex-wrap:wrap;gap:10px 22px;align-items:center;padding:12px 2px 2px;font:12px/1.4 var(--anatomy-mono);color:var(--anatomy-text);letter-spacing:.04em}
.gv-controls label{display:flex;align-items:center;gap:10px;flex:1 1 220px;min-width:0}
.gv-controls input[type=range]{flex:1 1 auto;min-width:0;accent-color:var(--anatomy-hi)}
.gv-controls output{min-width:62px;text-align:right;color:var(--anatomy-strong);font-variant-numeric:tabular-nums}
.gv-controls button{font:inherit;color:var(--anatomy-strong);background:var(--anatomy-card);border:1px solid var(--anatomy-lo);border-radius:4px;padding:5px 12px;cursor:pointer}
.gv-controls button[aria-pressed="true"]{border-color:var(--anatomy-mid)}
.gv-controls button:focus-visible{outline:1px solid var(--anatomy-muted);outline-offset:3px}
@media (max-width:560px){.gv-controls label{flex-basis:100%}.iso-page{padding:6px}.iso-plate{overflow:hidden}.iso-plate .iso-svg{width:112%;margin:-3% -6% -4%}}
`;

const controls = `<div class="gv-controls">
<label><span>[Zn²⁺]</span><input type="range" min="${M.CELL.min}" max="${M.CELL.max}" step="0.05" value="0" data-ctl="zn" aria-label="Концентрация ионов цинка, десятичный логарифм"><output data-out="zn">1 M</output></label>
<label><span>[Cu²⁺]</span><input type="range" min="${M.CELL.min}" max="${M.CELL.max}" step="0.05" value="0" data-ctl="cu" aria-label="Концентрация ионов меди, десятичный логарифм"><output data-out="cu">1 M</output></label>
<button type="button" data-ctl="key" aria-pressed="true">Ключ замкнут</button>
</div>`;

const body = k
  .plateHtml({
    fig: "Рис. 1",
    title: "Элемент Даниэля–Якоби",
    hint: "Клик — ключ, ползунки — концентрации",
    readout: M.readoutOf(START),
    keys: [
      { mark: "lit", label: "Электроны идут по проводу от цинка (−) к меди (+)" },
      { mark: "raised", label: "Солевой мостик: K⁺ идут к меди, Cl⁻ к цинку" },
    ],
    caption:
      "Цинк отдаёт электроны: Zn → Zn²⁺ + 2e⁻, ионы меди их принимают: Cu²⁺ + 2e⁻ → Cu. Электроны идут по внешней цепи от цинка к меди, а солевой мостик замыкает цепь внутри и не даёт растворам смешаться. При концентрациях 1 M ЭДС равна 1,10 В. По уравнению Нернста E = 1,10 − 0,0296·lg([Zn²⁺]/[Cu²⁺]): чем больше ионов меди и меньше ионов цинка, тем выше напряжение; изменение концентрации в 10 раз сдвигает его на 0,03 В. Вольтметр включён в цепь последовательно с ключом, поэтому показывает напряжение только при замкнутом ключе.",
    body: `<div class="iso-stage" tabindex="0" role="group" aria-label="Гальванический элемент">${svg}</div>`,
  })
  .replace('<figcaption class="iso-legend">', `${controls}<figcaption class="iso-legend">`);

const file = theme === "light" ? "index-light.html" : "index.html";
const html = k
  .pageHtml({ title: "Гальванический элемент", theme, body, script: kitScript() + live })
  .replace('<html lang="en">', '<html lang="ru">')
  .replace("</style></head>", `${CSS}${theme === "light" ? "html{color-scheme:light}" : ""}</style></head>`);
writeFileSync(join(HERE, file), html);
console.log("wrote", file, (html.length / 1024).toFixed(0) + " KB");
