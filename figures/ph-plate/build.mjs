// Рис. 2 «Шкала pH»: фарфоровый капельный планшет с универсальным индикатором,
// капельница и электрод на каретке портала и pH-метр со стрелкой.
// node build.mjs           -> index.html (тёмная тема)
// node build.mjs --light   -> index-light.html (светлая тема)
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../../tools/anatomy/kit/iso-kit.mjs";
import * as G from "../../tools/anatomy/kit/lathe.mjs";
import { kitScript } from "../../tools/anatomy/scripts/inline-kit.mjs";
import { COLOURS, WELLS, describe } from "./model.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--light") ? "light" : "dark";

const WIDTH = 600;
const HEIGHT = 372;
const AZIMUTH = 60;

// ---- world (units ~ px, z up, viewer toward +x +y) ----
const BENCH = { x: -188, y: -62, w: 374, d: 120, r: 8 };
const BENCH_H = 10;
const FOOT_H = 5;

const POST_W = 12;
const POSTS = [
  { x: -148, y: -50, w: POST_W, d: 14, r: 1.5 },
  { x: 120, y: -50, w: POST_W, d: 14, r: 1.5 },
];
const POST_TOP = 86;
const RAIL = { x: -136, y: -48, w: 256, d: 8, r: 1 };
const RAIL_Z = [64, 76];
const RAIL_FACE = RAIL.y + RAIL.d;

const PITCH = 28;
const WELL_X = WELLS.map((_, index) => -84 + PITCH * index);
const WELL_Y = 10;
const WELL_R = 10;
const PLATE = { x: -104, y: -8, w: 208, d: 36, r: 6 };
const PLATE_H = 8;
const LIQUID_Z = 6.4;
const LIQUID_R = 9.3;

const CHART = { x: -107, y: 35, w: 214, d: 13, r: 1 };
const CHART_H = 0.8;
const SWATCH = 14;
const swatchX = (ph) => -98 + SWATCH * ph;

const DROP_Y = 5;
const PROBE_Y = 15;
const HEAD = { x: -6.5, y: 0, w: 13, d: 21, r: 2 };
const HEAD_Z = [57, 69];

const METER = { x: 122, y: -8, w: 56, d: 46, r: 3 };
const METER_Z = [1.4, 22];
const METER_TOP = METER_Z[1];
const DIAL = [151, 9];
const DIAL_R = 15;
const FACE_Z = METER_TOP + 2;
const SOCKET = [131, 0];
const SOCKET_TOP = METER_TOP + 9;
const KNOB = [170, 30];
const FRONT_Y = METER.y + METER.d;

const BOTTLE = [-166, -4];

const DIAL_FROM = (-165 * Math.PI) / 180; // pH 0 (scale centred on the far side of the dial)
const DIAL_SPAN = (270 * Math.PI) / 180;

const CABLE_TOP = 82;
const CABLE_R = 0.9;

const P = k.fitProjection(
  [
    ...k.boxCorners(BENCH, -BENCH_H - FOOT_H, 0),
    [POSTS[0].x, POSTS[0].y, POST_TOP + 3],
    [POSTS[1].x + POST_W, POSTS[1].y + 14, POST_TOP + 3],
    [WELL_X[0], DROP_Y, 87],
    [WELL_X[0] + 40, 10, 104],
  ],
  WIDTH,
  HEIGHT,
  { pad: 22, azimuth: AZIMUTH },
);

const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const byDepth = (points) => [...points].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));
const up = (x, y, z) => G.frameAlong([x, y, z], [0, 0, 1]);
const along = (x, y, z, axis) => G.frameAlong([x, y, z], axis);
const circleTop = (cx, cy, r, z, steps = 48) => k.onTop(k.circleRing(cx, cy, r, steps), z, P, true);
const halo = (plan, z, h, blur = 9) => `<path class="iso-halo" d="${k.haloOf(plan, z, h, P)}"${blur !== 9 ? ` style="filter:blur(${blur}px)"` : ""}/>`;

// ---------------- bench ----------------
function bench() {
  const out = [halo(BENCH, -BENCH_H - FOOT_H, BENCH_H)];
  for (const [x, y] of byDepth(k.corners(BENCH, 22))) {
    out.push(S(k.cylinder(x, y, 7, -BENCH_H - FOOT_H, 1.6, P, 28), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 5.4, -BENCH_H - FOOT_H + 1.6, FOOT_H - 1.6, P, 28), { tone: "mid" }));
  }
  out.push(S(k.slabOf(BENCH, -BENCH_H, BENCH_H, P, 8, 1.6), { tone: "mid", inner: L(k.sideSeam(BENCH, -BENCH_H + 3.4, P, 8), { tone: "faint" }) }));
  out.push(L(k.planOutline(k.insetPlan(BENCH, 5), 0, P), { tone: "lo" }));
  const screws = k.corners(BENCH, 10);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 2.2, 0, P, 16)).join(""), { tone: "lo" }));
  out.push(D(screws.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
  // label plate, front left
  const label = { x: -176, y: 36, w: 42, d: 13, r: 1.2 };
  out.push(S(k.slabOf(label, 0, 0.8, P, 4), { tone: "lo", crease: "none" }));
  out.push(L(k.planOutline(k.insetPlan(label, 1.6), 0.8, P), { tone: "faint" }));
  out.push(L(k.lineOnTop([label.x + 5, label.y + 4.6], [label.x + 30, label.y + 4.6], 0.8, P), { tone: "lo", free: true }));
  out.push(L(k.lineOnTop([label.x + 5, label.y + 7.2], [label.x + 24, label.y + 7.2], 0.8, P), { tone: "lo", free: true }));
  out.push(L(k.lineOnTop([label.x + 5, label.y + 9.6], [label.x + 34, label.y + 9.6], 0.8, P), { tone: "lo", free: true }));
  out.push(D([at([label.x + 2.4, label.y + 6.5, 0.8]), at([label.x + label.w - 2.4, label.y + 6.5, 0.8])], { size: 0.45 }));
  return out.join("");
}

// ---------------- gantry: two posts and a rail ----------------
function post(plan) {
  const out = [];
  const foot = k.insetPlan(plan, -4);
  out.push(S(k.slabOf(foot, 0, 3, P, 3, 0.5), { tone: "lo" }));
  out.push(D(k.corners(foot, 2.2).map(([x, y]) => at([x, y, 3])), { size: 0.45 }));
  out.push(S(k.slabOf(plan, 3, POST_TOP - 3, P, 3, 0.5), { tone: "mid", inner: L(k.sideSeam(plan, 40, P, 3), { tone: "faint" }) }));
  const cap = k.insetPlan(plan, -1);
  out.push(S(k.slabOf(cap, POST_TOP, 3, P, 3, 0.5), { tone: "mid" }));
  out.push(D([at([plan.x + plan.w / 2, plan.y + plan.d / 2, POST_TOP + 3])], { size: 0.5, tone: "mid" }));
  return out.join("");
}

function rail() {
  const out = [];
  out.push(S(k.slabOf(RAIL, RAIL_Z[0], RAIL_Z[1] - RAIL_Z[0], P, 3, 0.5), { tone: "mid" }));
  // ruler on the rail's front face, majors over the wells
  const ticks = k.sideTicks(-124, 112, 4, 7, RAIL_FACE, RAIL_Z[1], [1.6, 3.4], P);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  out.push(L(k.lineOnTop([RAIL.x, RAIL.y + 4], [RAIL.x + RAIL.w, RAIL.y + 4], RAIL_Z[1], P), { tone: "faint" }));
  out.push(D([RAIL.x + 5, RAIL.x + RAIL.w - 5].map((x) => at([x, RAIL.y + 4, RAIL_Z[1]])), { size: 0.45 }));
  return out.join("");
}

// ---------------- spot plate with wells ----------------
function plate() {
  const out = [halo(k.insetPlan(PLATE, 2), 0, 1, 6)];
  out.push(S(k.slabOf(PLATE, 0, PLATE_H, P, 8, 1.2), { tone: "hi", crease: "lo", className: "ph-plate", inner: L(k.sideSeam(PLATE, 1.6, P, 8), { tone: "faint" }) }));
  out.push(L(k.planOutline(k.insetPlan(PLATE, 3.2), PLATE_H, P, 8), { tone: "faint" }));
  WELLS.forEach((ph, index) => {
    const x = WELL_X[index];
    const opening = circleTop(x, WELL_Y, WELL_R, PLATE_H, 64);
    const liquid = circleTop(x, WELL_Y, LIQUID_R, LIQUID_Z, 64);
    const id = `ph-well-${index}`;
    out.push(`<clipPath id="${id}"><path d="${opening}"/></clipPath>`);
    out.push(`<path class="ph-wall" d="${opening}"/>`);
    out.push(`<g clip-path="url(#${id})">`);
    out.push(`<path class="ph-liquid" d="${liquid}" style="fill:${COLOURS[ph]}"/>`);
    out.push(`<path class="ph-menisc" d="${circleTop(x, WELL_Y, LIQUID_R - 0.9, LIQUID_Z, 64)}"/>`);
    // a soft window glint on the back-left of the liquid
    const glint = [];
    for (let step = 0; step <= 12; step++) {
      const angle = ((200 + step * 6.5) * Math.PI) / 180;
      glint.push([x + 6.2 * Math.cos(angle), WELL_Y + 6.2 * Math.sin(angle)]);
    }
    out.push(`<path class="ph-glint" d="${k.onTop(glint, LIQUID_Z, P)}"/>`);
    out.push(`</g>`);
    out.push(L(opening, { tone: "mid" }));
    out.push(L(circleTop(x, WELL_Y, WELL_R + 1.4, PLATE_H, 64), { tone: "faint" }));
  });
  // a single row of dots under the wells, one per well, at the plate's front edge
  out.push(D(WELL_X.map((x) => at([x, PLATE.y + PLATE.d - 2.6, PLATE_H])), { size: 0.5, tone: "mid" }));
  return out.join("");
}

// ---------------- colour chart lying in front ----------------
function chart() {
  const out = [];
  out.push(S(k.slabOf(CHART, 0, CHART_H, P, 3), { tone: "hi", crease: "none", className: "ph-card" }));
  for (let ph = 0; ph <= 14; ph++) {
    const plan = { x: swatchX(ph) - 6.2, y: CHART.y + 2, w: 12.4, d: 8, r: 0.6 };
    out.push(`<path class="ph-swatch" d="${k.planOutline(plan, CHART_H, P, 3)}" style="fill:${COLOURS[ph]}"/>`);
  }
  // little ticks hanging from the swatch row toward the front edge (from the card's swatch strip)
  const ticks = [];
  for (let ph = 0; ph <= 14; ph++) ticks.push(k.lineOnTop([swatchX(ph), CHART.y + 10], [swatchX(ph), CHART.y + (ph % 7 === 0 ? 12.4 : 11.4)], CHART_H, P));
  out.push(L(ticks.join(""), { tone: "lo", free: "end" }));
  out.push(L(k.lineOnTop([CHART.x, CHART.y + 10], [CHART.x + CHART.w, CHART.y + 10], CHART_H, P), { tone: "faint" }));
  return out.join("");
}

function chartMarker() {
  const plan = { x: swatchX(0) - 7.1, y: CHART.y + 1.1, w: 14.2, d: 9.8, r: 1 };
  return `<g data-part="marker" transform="${k.translateAlong(P, [SWATCH * WELLS[0], 0, 0])}">${L(k.planOutline(plan, CHART_H, P, 3), { tone: "hi" })}</g>`;
}

// ---------------- reagent bottle ----------------
function bottle() {
  const [bx, by] = BOTTLE;
  const out = [halo({ x: bx - 12, y: by - 12, w: 24, d: 24, r: 12 }, 0, 1, 5)];
  const coasterTop = 2;
  const bodyTop = coasterTop + 30;
  out.push(S(k.cylinder(bx, by, 13, 0, coasterTop, P, 44), { tone: "mid" }));
  out.push(L(circleTop(bx, by, 11.6, coasterTop, 40), { tone: "faint" }));
  const body = G.solidOf(
    [
      [0, 10],
      [bodyTop - coasterTop - 1, 10, 1],
      [bodyTop - coasterTop + 1.4, 8.6, 1],
      [bodyTop - coasterTop + 2.6, 5.6, 1],
      [bodyTop - coasterTop + 3.6, 4.4],
    ],
    up(bx, by, coasterTop),
    P,
  );
  const F = up(bx, by, 0);
  out.push(S(body, { tone: "hi", crease: "faint", className: "ph-glass", inner: L(G.arcOf(F, 9, 10, P) + G.arcOf(F, 23, 10, P), { tone: "lo" }) }));
  const neckTop = bodyTop + 3.6;
  out.push(S(G.disc(neckTop, neckTop + 3, 5.2, F, P), { tone: "mid" }));
  out.push(S(k.cylinder(bx, by, 6.2, neckTop + 3, 9, P, 36), { tone: "mid" }));
  out.push(L(k.knurl(bx, by, 6.2, neckTop + 3, neckTop + 12, 26, P), { tone: "lo" }));
  const bulb = G.solidOf(
    [
      [0, 2.6],
      [2, 3.6, 1],
      [6, 3.9, 1],
      [9, 3.2, 1],
      [10.6, 1.6, 1],
      [11.2, 0],
    ],
    up(bx, by, neckTop + 12),
    P,
  );
  out.push(S(bulb, { tone: "mid", crease: "none" }));
  // the colour scale printed on the label band, between the two band lines
  const runs = [];
  const [vx, vy] = k.towardViewer(P);
  const face = Math.atan2(vy, vx);
  for (let ph = 0; ph <= 14; ph++) {
    const a0 = face - 1.25 + (2.5 * ph) / 15;
    const a1 = face - 1.25 + (2.5 * (ph + 1)) / 15;
    const pts = [];
    for (let s = 0; s <= 3; s++) {
      const a = a0 + ((a1 - a0) * s) / 3;
      pts.push(at([bx + 10.05 * Math.cos(a), by + 10.05 * Math.sin(a), coasterTop + 11]));
    }
    for (let s = 3; s >= 0; s--) {
      const a = a0 + ((a1 - a0) * s) / 3;
      pts.push(at([bx + 10.05 * Math.cos(a), by + 10.05 * Math.sin(a), coasterTop + 13.4]));
    }
    runs.push(`<path class="ph-band" d="${k.pathOf(pts, true)}" style="fill:${COLOURS[ph]}"/>`);
  }
  out.push(runs.join(""));
  return out.join("");
}

// ---------------- carriage: block, arm, head, dropper, electrode ----------------
function carriage() {
  const out = [];
  const lip = { x: -12, y: -49, w: 24, d: 19, r: 1.5 };
  const block = { x: -11, y: RAIL_FACE, w: 22, d: 10, r: 1.2 };
  out.push(S(k.slabOf(block, 54, RAIL_Z[1] - 54, P, 3, 0.4), { tone: "mid", inner: L(k.sideSeam(block, 62, P, 3), { tone: "faint" }) }));
  out.push(S(k.slabOf(lip, RAIL_Z[1], 4, P, 3, 0.5), { tone: "mid" }));
  out.push(D(k.corners(lip, 2.6).map(([x, y]) => at([x, y, RAIL_Z[1] + 4])), { size: 0.45 }));
  // index pointer on the lip, over the rail ruler
  out.push(L(k.lineOnTop([0, lip.y + lip.d - 5], [0, lip.y + lip.d], RAIL_Z[1] + 4, P), { tone: "hi", free: "start" }));
  // clamp knob on the block front (along +y)
  const Fk = along(6, block.y + block.d, 69, [0, 1, 0]);
  out.push(S(G.disc(0, 2, 1.6, Fk, P), { tone: "mid" }));
  out.push(S(G.disc(2, 5.2, 3, Fk, P), { tone: "mid" }));
  out.push(L(G.circleOf(Fk, 5.2, 1.6, P), { tone: "lo" }));
  // arm
  const arm = { x: -4, y: block.y + block.d, w: 8, d: HEAD.y - block.y - block.d, r: 0.8 };
  out.push(S(k.slabOf(arm, 59, 6, P, 2, 0.4), { tone: "mid" }));
  // dropper below the head
  const Fd = up(0, DROP_Y, 8);
  out.push(S(G.solidOf([[0, 0.55], [2.6, 0.7], [3.6, 1.5], [HEAD_Z[0] - 8, 1.5]], Fd, P), { tone: "hi", crease: "faint", className: "ph-glass" }));
  out.push(S(G.sphereOf([0, DROP_Y, 6.7], 1.15, P, { steps: 32 }), { tone: "hi", className: "ph-glass" }));
  // electrode below the head
  const Fe = up(0, PROBE_Y, LIQUID_Z);
  out.push(
    S(
      G.solidOf(
        [
          [0, 0.4],
          [0.5, 1.3, 1],
          [1.3, 1.8, 1],
          [2.3, 1.7, 1],
          [3.1, 1.3],
          [4.2, 1.3],
          [4.2, 2.3],
          [HEAD_Z[0] - LIQUID_Z, 2.3],
        ],
        Fe,
        P,
      ),
      { tone: "hi", crease: "faint", className: "ph-glass", inner: L(G.arcOf(Fe, 16, 2.3, P) + G.arcOf(Fe, 40, 2.3, P), { tone: "faint" }) },
    ),
  );
  // head clamp
  out.push(S(k.slabOf(HEAD, HEAD_Z[0], HEAD_Z[1] - HEAD_Z[0], P, 3, 0.5), { tone: "mid", inner: L(k.sideSeam(HEAD, 63, P, 3), { tone: "faint" }) }));
  out.push(D([at([-3.6, 10, HEAD_Z[1]]), at([3.6, 10, HEAD_Z[1]])], { size: 0.45 }));
  // dropper above: collar and rubber bulb
  const Fu = up(0, DROP_Y, HEAD_Z[1]);
  out.push(S(G.disc(0, 3, 2.2, Fu, P), { tone: "mid" }));
  out.push(
    S(
      G.solidOf(
        [
          [3, 1.8],
          [4.6, 3.7, 1],
          [8, 4.4, 1],
          [12.5, 4.1, 1],
          [15.5, 2.8, 1],
          [16.8, 1.2, 1],
          [17.1, 0],
        ],
        Fu,
        P,
      ),
      { tone: "lo", crease: "none" },
    ),
  );
  // electrode cap and cable gland
  const Fc = up(0, PROBE_Y, HEAD_Z[1]);
  out.push(S(G.disc(0, 10, 3, Fc, P), { tone: "mid", inner: L(G.arcOf(Fc, 2, 3, P) + G.arcOf(Fc, 8, 3, P), { tone: "faint" }) }));
  out.push(S(G.solidOf([[10, 2.2], [11.2, 1.5, 1], [CABLE_TOP - HEAD_Z[1], 1.3]], Fc, P), { tone: "mid" }));
  return out.join("");
}

// ---------------- pH meter ----------------
const polar = (r, angle, z) => [DIAL[0] + r * Math.sin(angle), DIAL[1] - r * Math.cos(angle), z];
const angleOf = (ph) => DIAL_FROM + (DIAL_SPAN * ph) / 14;

function needleAt(ph) {
  const a = angleOf(ph);
  return k.lineOnTop([DIAL[0] - Math.sin(a) * 3.2, DIAL[1] + Math.cos(a) * 3.2], [DIAL[0] + Math.sin(a) * (DIAL_R - 4.2), DIAL[1] - Math.cos(a) * (DIAL_R - 4.2)], FACE_Z + 0.25, P);
}

function meter() {
  const out = [halo(METER, 0, 2, 7)];
  for (const [x, y] of byDepth(k.corners(METER, 5))) out.push(S(k.cylinder(x, y, 2.6, 0, METER_Z[0], P, 18), { tone: "lo" }));
  out.push(S(k.slabOf(METER, METER_Z[0], METER_TOP - METER_Z[0], P, 6, 0.8), { tone: "mid", inner: L(k.sideSeam(METER, 5, P, 6), { tone: "faint" }) }));
  out.push(L(k.planOutline(k.insetPlan(METER, 2.4), METER_TOP, P, 6), { tone: "faint" }));
  out.push(D(k.corners(METER, 4.4).map(([x, y]) => at([x, y, METER_TOP])), { size: 0.45 }));
  // LCD on the front face
  const lcdAt = [128, FRONT_Y];
  const M = k.sideMatrix(lcdAt, 18, P, "left");
  out.push(`<g transform="${M}">`);
  out.push(`<rect class="ph-bezel" x="0" y="1" width="34" height="12.4" rx="1.2"/>`);
  out.push(`<rect class="ph-lcd" x="1.6" y="2.6" width="30.8" height="9.2" rx="0.6"/>`);
  out.push(`<text class="ph-lcd-unit" x="3.2" y="10.4" font-size="3">pH</text>`);
  out.push(`<text class="ph-lcd-text" data-part="lcd" x="30.6" y="10.6" font-size="7.4" text-anchor="end">${WELLS[0].toFixed(1)}</text>`);
  out.push(`</g>`);
  // power lamp and two keys on the front face
  const Fl = along(168, FRONT_Y, 12.5, [0, 1, 0]);
  out.push(S(G.disc(0, 0.8, 1.6, Fl, P), { tone: "lo" }));
  out.push(`<path class="ph-led" d="${G.circleOf(Fl, 0.8, 1.0, P)}"/>`);
  for (const x of [166, 172]) {
    out.push(S(k.slabOf({ x: x - 2, y: FRONT_Y, w: 4, d: 1.2, r: 0.5 }, 4.6, 3.6, P, 2), { tone: "mid" }));
  }
  // dial: bezel ring, face, coloured pH band, ticks
  out.push(S(k.cylinder(DIAL[0], DIAL[1], DIAL_R, METER_TOP, 2, P, 72, 0.6), { tone: "mid" }));
  out.push(S(k.cylinder(DIAL[0], DIAL[1], DIAL_R - 1.6, METER_TOP + 2 - 0.01, 0.01, P, 72), { tone: "hi", crease: "none", flat: true, className: "ph-face" }));
  for (let ph = 0; ph < 14; ph++) {
    const a0 = angleOf(ph);
    const a1 = angleOf(ph + 1);
    const pts = [];
    for (let s = 0; s <= 4; s++) pts.push(polar(DIAL_R - 2.4, a0 + ((a1 - a0) * s) / 4, FACE_Z));
    for (let s = 4; s >= 0; s--) pts.push(polar(DIAL_R - 4.4, a0 + ((a1 - a0) * s) / 4, FACE_Z));
    out.push(`<path class="ph-band" d="${k.pathOf(pts.map(at), true)}" style="fill:${mixHalf(ph)}"/>`);
  }
  const ticks = k.radialTicks(DIAL[0], DIAL[1], DIAL_R - 4.4, 28, 2, FACE_Z, [1.0, 2.2], P, DIAL_FROM, DIAL_SPAN);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  out.push(L(circleTop(DIAL[0], DIAL[1], DIAL_R - 1.6, FACE_Z, 72), { tone: "lo" }));
  out.push(k.faceTextSvg(k.topMatrix([DIAL[0] - 2.6, DIAL[1] + 8.6], FACE_Z, P, "x"), "pH", { size: 2.6, tone: "lo" }));
  // knob
  out.push(S(k.cylinder(KNOB[0], KNOB[1], 3.4, METER_TOP, 4, P, 32), { tone: "mid" }));
  out.push(L(k.knurl(KNOB[0], KNOB[1], 3.4, METER_TOP, METER_TOP + 4, 28, P), { tone: "lo" }));
  out.push(L(k.lineOnTop([KNOB[0], KNOB[1]], [KNOB[0] - 2.4, KNOB[1] - 2.4], METER_TOP + 4, P), { tone: "hi", free: "end" }));
  // socket for the electrode cable
  const Fs = up(SOCKET[0], SOCKET[1], METER_TOP);
  out.push(S(G.disc(0, 2, 3, Fs, P), { tone: "mid" }));
  out.push(S(G.disc(2, 5.4, 2, Fs, P), { tone: "mid", inner: L(G.arcOf(Fs, 3.6, 2, P), { tone: "faint" }) }));
  out.push(S(G.solidOf([[5.4, 1.7], [7, 1.5, 1], [SOCKET_TOP - METER_TOP, 1.2]], Fs, P), { tone: "lo" }));
  return out.join("");
}
// band colours sit at the middle of each unit: blend this step with the next
function mixHalf(ph) {
  const a = COLOURS[ph];
  const b = COLOURS[ph + 1];
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return "#" + pa.map((v, i) => Math.round((v + pb[i]) / 2).toString(16).padStart(2, "0")).join("");
}

// ---------------- the electrode cable (rebuilt each frame) ----------------
function cablePoints(x) {
  const p0 = [x, PROBE_Y, CABLE_TOP];
  const p1 = [x, PROBE_Y, CABLE_TOP + 34];
  const p2 = [SOCKET[0], SOCKET[1], SOCKET_TOP + 44];
  const p3 = [SOCKET[0], SOCKET[1], SOCKET_TOP];
  const out = [];
  for (let i = 0; i <= 40; i++) {
    const t = i / 40;
    const u = 1 - t;
    const b = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t];
    out.push([0, 1, 2].map((c) => b[0] * p0[c] + b[1] * p1[c] + b[2] * p2[c] + b[3] * p3[c]));
  }
  return out;
}
const cableAt = (x) => k.pathOf(cablePoints(x).map((p) => k.iso(p, P)));
const CABLE_W = 2 * CABLE_R * P.scale * Math.cos((30 * Math.PI) / 180);

// ---------------- assemble ----------------
const start = WELLS[0];
const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label:
    "Капельный фарфоровый планшет на лабораторном столике. В семи лунках — растворы с универсальным индикатором: pH 1, 3, 5, 7, 9, 11 и 13, их цвет меняется от красного через жёлтый и зелёный к синему и фиолетовому. Над рядом лунок по рейке портала ездит каретка с капельницей и стеклянным электродом; кабель электрода идёт к pH-метру справа, стрелка и табло которого показывают pH лунки под электродом. Перед планшетом лежит цветная шкала pH от 0 до 14.",
  body: [
    bench(),
    post(POSTS[0]),
    rail(),
    post(POSTS[1]),
    bottle(),
    plate(),
    chart(),
    chartMarker(),
    `<g data-part="carriage" transform="${k.translateAlong(P, [WELL_X[0], 0, 0])}">${carriage()}</g>`,
    meter(),
    `<path data-part="needle" class="iso-line" data-tone="lit" data-free="start" d="${needleAt(start)}" style="stroke-width:1.1"/>`,
    S(k.cylinder(DIAL[0], DIAL[1], 1.5, FACE_Z, 0.8, P, 20), { tone: "hi", crease: "none" }),
    `<g class="ph-cable"><path class="ph-cable-out" data-part="cable-out" d="${cableAt(WELL_X[0])}" style="stroke-width:${(CABLE_W + 0.9).toFixed(2)}"/><path class="ph-cable-in" data-part="cable-in" d="${cableAt(WELL_X[0])}" style="stroke-width:${Math.max(0.4, CABLE_W - 0.6).toFixed(2)}"/></g>`,
  ],
});

// screen x of each well centre, to map the pointer onto the row
const WELL_SX = WELL_X.map((x) => k.iso([x, WELL_Y, PLATE_H], P)[0]);

const modelSource = readFileSync(join(HERE, "model.mjs"), "utf8").replace(/^export /gm, "");

const live = `
${modelSource}
const P = ${JSON.stringify(P)};
const WELL_X = ${JSON.stringify(WELL_X)};
const WELL_SX = ${JSON.stringify(WELL_SX)};
const VIEW_W = ${WIDTH};
const DIAL = ${JSON.stringify(DIAL)}, DIAL_R = ${DIAL_R}, FACE_Z = ${FACE_Z}, DIAL_FROM = ${DIAL_FROM}, DIAL_SPAN = ${DIAL_SPAN};
const PROBE_Y = ${PROBE_Y}, CABLE_TOP = ${CABLE_TOP}, SOCKET = ${JSON.stringify(SOCKET)}, SOCKET_TOP = ${SOCKET_TOP};
const SWATCH = ${SWATCH};
const angleOf = ${angleOf.toString()};
const needleAt = ${needleAt.toString().replace(/k\./g, "")};
const cablePoints = ${cablePoints.toString()};
const cableAt = (x) => pathOf(cablePoints(x).map((p) => iso(p, P)));

const stage = document.querySelector(".iso-stage");
const svg = stage.querySelector("svg");
const carriage = svg.querySelector('[data-part="carriage"]');
const needle = svg.querySelector('[data-part="needle"]');
const marker = svg.querySelector('[data-part="marker"]');
const lcd = svg.querySelector('[data-part="lcd"]');
const cableOut = svg.querySelector('[data-part="cable-out"]');
const cableIn = svg.querySelector('[data-part="cable-in"]');
const readout = document.querySelector("[data-readout]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const wide = matchMedia("(min-width: 620px)");
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

let index = 0;               // well the carriage is sent to
let x = WELL_X[0];           // carriage position
let held = 0;                // well the electrode is in (last one it reached)
const hand = { at: WELLS[0], rate: 0 };  // meter needle, in pH
let frame = 0, last = 0, clock = 0, visible = false, idleTimer = 0;
let touring = !still.matches;
const TOUR_STEP = 2.6;

function readoutText() {
  const d = describe(WELLS[held]);
  return wide.matches ? d.readout + " · [H⁺] = " + d.hydrogenText : d.readout;
}
function announce() {
  const d = describe(WELLS[held]);
  stage.setAttribute("aria-valuenow", String(d.ph));
  stage.setAttribute("aria-valuetext", "Лунка " + (held + 1) + ": pH " + d.ph + ", " + d.example + ", " + d.medium + ", концентрация ионов водорода " + d.hydrogenText);
}
function draw() {
  carriage.setAttribute("transform", translateAlong(P, [x, 0, 0]));
  const d = cableAt(x);
  cableOut.setAttribute("d", d);
  cableIn.setAttribute("d", d);
  needle.setAttribute("d", needleAt(hand.at));
  marker.setAttribute("transform", translateAlong(P, [SWATCH * hand.at, 0, 0]));
  const shown = clamp(hand.at, 0, 14).toFixed(1);
  if (lcd.textContent !== shown) lcd.textContent = shown;
  const text = readoutText();
  if (readout.textContent !== text) readout.textContent = text;
}
function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  const calm = still.matches;
  if (touring) {
    clock += dt;
    index = Math.floor(clock / TOUR_STEP) % WELLS.length;
  }
  const target = WELL_X[index];
  x = calm ? target : x + (target - x) * (1 - Math.exp(-dt / 0.32));
  if (Math.abs(target - x) < 0.02) x = target;
  // the electrode reads the well it is dipped in
  const near = WELL_X.findIndex((wx) => Math.abs(wx - x) < 1.2);
  if (near >= 0 && near !== held) { held = near; announce(); }
  const want = WELLS[held];
  if (calm) { hand.at = want; hand.rate = 0; }
  else {
    const stiff = 38, drag = 7.5;
    for (let i = 0; i < 4; i++) { hand.rate += ((want - hand.at) * stiff - hand.rate * drag) * dt / 4; hand.at += hand.rate * dt / 4; }
    if (Math.abs(want - hand.at) < 5e-4 && Math.abs(hand.rate) < 5e-4) { hand.at = want; hand.rate = 0; }
  }
  draw();
  const settled = !touring && x === target && hand.rate === 0 && hand.at === want;
  frame = visible && !settled ? requestAnimationFrame(tick) : 0;
}
const run = () => { if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); } };
const steer = (to) => {
  touring = false;
  index = clamp(to, 0, WELLS.length - 1);
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => { if (!still.matches) { touring = true; clock = index * TOUR_STEP + TOUR_STEP * 0.5; run(); } }, 3600);
  run();
};
new IntersectionObserver((entries) => { visible = entries[entries.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "120px 0px" }).observe(stage);
const wellAt = (clientX) => {
  const box = svg.getBoundingClientRect();
  const sx = ((clientX - box.left) / box.width) * VIEW_W;
  let best = 0;
  WELL_SX.forEach((w, i) => { if (Math.abs(w - sx) < Math.abs(WELL_SX[best] - sx)) best = i; });
  return best;
};
let dragging = false;
stage.addEventListener("pointermove", (event) => { if (event.pointerType === "mouse" || dragging) steer(wellAt(event.clientX)); });
stage.addEventListener("pointerdown", (event) => { dragging = true; try { stage.setPointerCapture(event.pointerId); } catch {} steer(wellAt(event.clientX)); });
const release = (event) => { dragging = false; try { stage.releasePointerCapture(event.pointerId); } catch {} };
stage.addEventListener("pointerup", release);
stage.addEventListener("pointercancel", release);
stage.addEventListener("keydown", (event) => {
  let to = null;
  if (event.key === "ArrowRight" || event.key === "ArrowUp") to = index + 1;
  if (event.key === "ArrowLeft" || event.key === "ArrowDown") to = index - 1;
  if (event.key === "Home") to = 0;
  if (event.key === "End") to = WELLS.length - 1;
  if (to === null) return;
  event.preventDefault();
  steer(to);
});
stage.addEventListener("focus", () => { if (touring) steer(index); });
wide.addEventListener?.("change", draw);
announce();
draw();

// tell the host page how tall we are
const postHeight = () => { try { parent.postMessage({ type: "figure-height", height: document.documentElement.scrollHeight }, "*"); } catch {} };
addEventListener("load", postHeight);
addEventListener("resize", postHeight);
if (typeof ResizeObserver === "function") new ResizeObserver(postHeight).observe(document.body);
postHeight();
`;

const CSS = `
html,body{overflow:hidden}
.iso-plate-corner[data-corner="title"]{text-transform:none;letter-spacing:.06em}
.iso-page{width:100%;margin:0;padding:6px}
.iso-figure{margin:0}
.iso-legend{padding:0 2px 4px}
.ph-stage{border-radius:4px;cursor:ew-resize;touch-action:pan-y;-webkit-tap-highlight-color:transparent;user-select:none;-webkit-user-select:none}
.ph-stage:focus-visible{outline:1px solid var(--anatomy-muted);outline-offset:6px}
.iso{--ph-wall:#090909;--ph-plate-top:#222222;--ph-glass-top:#1f1f1f;--ph-card-top:#1e1e1e;--ph-lcd:#0b0d0b;--ph-lcd-ink:#d9e6d6;--ph-bezel:#1a1a1a;--ph-glint:#ffffff;--ph-glint-o:.5;--ph-menisc:#ffffff;--ph-menisc-o:.16;--ph-liquid-o:.9;--ph-led:#7ee08a;--ph-cable:#0d0d0d;--ph-cable-edge:#5a5a5a}
.iso[data-theme="light"]{--ph-wall:#d9d9d5;--ph-plate-top:#ffffff;--ph-glass-top:#ffffff;--ph-card-top:#ffffff;--ph-lcd:#dfe4d8;--ph-lcd-ink:#1e231d;--ph-bezel:#f1f1ee;--ph-glint:#ffffff;--ph-glint-o:.85;--ph-menisc:#ffffff;--ph-menisc-o:.35;--ph-liquid-o:.95;--ph-led:#2f9e44;--ph-cable:#6a6a70;--ph-cable-edge:#2e2e32}
.ph-plate>.iso-top{fill:var(--ph-plate-top)}
.ph-glass>.iso-top{fill:var(--ph-glass-top)}
.ph-card>.iso-top{fill:var(--ph-card-top)}
.ph-wall{fill:var(--ph-wall);stroke:none}
.ph-liquid{stroke:none;opacity:var(--ph-liquid-o)}
.ph-menisc{fill:none;stroke:var(--ph-menisc);stroke-opacity:var(--ph-menisc-o);stroke-width:.8}
.ph-glint{fill:none;stroke:var(--ph-glint);stroke-opacity:var(--ph-glint-o);stroke-width:1.1;stroke-linecap:round}
.ph-swatch,.ph-band{stroke:none}
.ph-bezel{fill:var(--ph-bezel);stroke:var(--anatomy-lo);stroke-width:var(--anatomy-weight)}
.ph-lcd{fill:var(--ph-lcd);stroke:var(--anatomy-mid);stroke-width:var(--anatomy-weight)}
.ph-lcd-text{fill:var(--ph-lcd-ink);font-family:var(--anatomy-mono);font-variant-numeric:tabular-nums;letter-spacing:.02em}
.ph-lcd-unit{fill:var(--ph-lcd-ink);opacity:.7;font-family:var(--anatomy-mono)}
.ph-led{fill:var(--ph-led);stroke:none}
.ph-cable path{fill:none;stroke-linecap:round;stroke-linejoin:round;vector-effect:none}
.ph-cable-out{stroke:var(--ph-cable-edge)}
.ph-cable-in{stroke:var(--ph-cable)}
@media (max-width:560px){
  .iso-plate{overflow:hidden}
  .iso-plate .ph-stage .iso-svg{width:118%;margin:-4% -9% -2%}
}
`;

const body = k.plateHtml({
  fig: "Рис. 2",
  title: "Шкала pH",
  hint: "Ведите по планшету или ← →",
  readout: describe(start).readout,
  keys: [
    { mark: "lit", label: "Стрелка pH-метра: показывает pH лунки под электродом" },
    { mark: "raised", label: "Фарфоровый планшет: 7 лунок, pH 1, 3, 5, 7, 9, 11, 13" },
  ],
  caption:
    "Универсальный индикатор — смесь нескольких красителей, поэтому его цвет меняется по всей шкале: красный в сильнокислой среде, жёлтый в слабокислой, зелёный при pH 7 и синий, затем фиолетовый в щелочной. Шаг шкалы на одну единицу означает, что ионов водорода H⁺ в 10 раз меньше: при pH 3 (уксус) их в 10 000 раз больше, чем в чистой воде при pH 7.",
  body: `<div class="iso-stage ph-stage" tabindex="0" role="slider" aria-label="Шкала pH: стрелки влево и вправо переводят электрод от лунки к лунке" aria-valuemin="1" aria-valuemax="13" aria-valuenow="${start}">${svg}</div>`,
});

const html = k
  .pageHtml({ title: "Шкала pH", theme, body, script: kitScript() + live, width: 4000 })
  .replace('<html lang="en">', '<html lang="ru">')
  .replace("</style>", `${CSS}</style>`);
const file = theme === "light" ? "index-light.html" : "index.html";
writeFileSync(join(HERE, file), html);
console.log("wrote", file, `· card ${WIDTH}×${HEIGHT}`);
