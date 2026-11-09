// Набор для уроков 10–11 класса: конструктор молекул с «метками» атомов,
// готовые молекулы органики, «морф» реакции (атомы переезжают из реагентов в продукты),
// подсветка групп, часы для симуляций и маленький SVG-график.
import { THREE, sphereGeo, glossy, glowSprite, easeInOut } from "./core.js";
import { CPK, COV_R } from "../data/molecules.js";

// ---------- векторы ----------
export const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const subv = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
export const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const norm = (a) => { const l = Math.hypot(...a) || 1; return mul(a, 1 / l); };
export const deg = (d) => (d * Math.PI) / 180;
export const dirXY = (a) => [Math.cos(deg(a)), Math.sin(deg(a)), 0];
const perp = (a) => norm(Math.abs(a[2]) < 0.9 ? cross([0, 0, 1], a) : cross(a, [1, 0, 0]));

// Свободные направления связей вокруг атома (sp3 — tet, sp2 — tri, sp — lin)
export function freeDirs(dirs, geom, need, twist = 0) {
  if (geom === "lin") return dirs.length ? [mul(dirs[0], -1)] : [[1, 0, 0], [-1, 0, 0]];
  if (geom === "tri") {
    if (dirs.length === 0) return [0, 1, 2].map((i) => [Math.cos(i * 2.0944 + twist), Math.sin(i * 2.0944 + twist), 0]);
    if (dirs.length === 1) { const a = dirs[0], u = perp(a); return [-1, 1].map((s) => norm(add(mul(a, -0.5), mul(u, s * 0.866)))); }
    return [norm(mul(add(dirs[0], dirs[1]), -1))];
  }
  if (dirs.length === 0) return [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]].map(norm);
  if (dirs.length === 1) {
    const a = dirs[0], u = perp(a), w = cross(a, u), out = [];
    for (let i = 0; i < need; i++) {
      const phi = twist + (i * 2 * Math.PI) / 3;
      out.push(norm(add(mul(a, -1 / 3), mul(add(mul(u, Math.cos(phi)), mul(w, Math.sin(phi))), Math.sqrt(8 / 9)))));
    }
    return out;
  }
  if (dirs.length === 2) {
    const m = norm(mul(add(dirs[0], dirs[1]), -1)), n = norm(cross(dirs[0], dirs[1])), h = Math.acos(-1 / 3) / 2;
    return [1, -1].map((s) => norm(add(mul(m, Math.cos(h)), mul(n, s * Math.sin(h)))));
  }
  return [norm(mul(add(add(dirs[0], dirs[1]), dirs[2]), -1))];
}

// Конструктор: у каждого атома есть метка tag — по ней атомы «узнаются» в реагентах и продуктах
export function mol() {
  const atoms = [], bonds = [];
  let auto = 0;
  const api = {
    atoms, bonds,
    at(el, pos, tag) { atoms.push({ el, pos, tag: tag || el + "#" + auto++ }); return atoms.length - 1; },
    link(a, b, o = 1) { bonds.push([a, b, o]); },
    dirsOf(i) { return bonds.filter((b) => b[0] === i || b[1] === i).map((b) => norm(subv(atoms[b[0] === i ? b[1] : b[0]].pos, atoms[i].pos))); },
    grow(from, el, dir, len, order = 1, tag) { const j = api.at(el, add(atoms[from].pos, mul(norm(dir), len)), tag); api.link(from, j, order); return j; },
    fillH(i, geom, count, len = 1.09, twist = 0, tagp) {
      return freeDirs(api.dirsOf(i), geom, count, twist).slice(0, count).map((d, k) => api.grow(i, "H", d, len, 1, tagp ? tagp + k : undefined));
    },
    idx(tag) { return atoms.findIndex((a) => a.tag === tag); },
    pos(tag) { return atoms[api.idx(tag)].pos; },
    done() { return { atoms, bonds }; },
  };
  return api;
}
export function centerOf(data) {
  const c = mul(data.atoms.reduce((s, a) => add(s, a.pos), [0, 0, 0]), 1 / data.atoms.length);
  data.atoms.forEach((a) => (a.pos = subv(a.pos, c)));
  return data;
}

// ---------- готовые молекулы (длины связей, Å) ----------
export function ethene() {
  const m = mol();
  const c1 = m.at("C", [-0.67, 0, 0]), c2 = m.at("C", [0.67, 0, 0]);
  m.link(c1, c2, 2);
  for (const s of [-1, 1]) { m.grow(c1, "H", dirXY(s * 121.3), 1.087); m.grow(c2, "H", dirXY(s * 58.7), 1.087); }
  return m.done();
}
export function ethyne() {
  const m = mol();
  const c1 = m.at("C", [-0.6, 0, 0]), c2 = m.at("C", [0.6, 0, 0]);
  m.link(c1, c2, 3); m.grow(c1, "H", [-1, 0, 0], 1.063); m.grow(c2, "H", [1, 0, 0], 1.063);
  return m.done();
}
export function benzene() {
  const m = mol(), cs = [];
  for (let i = 0; i < 6; i++) cs.push(m.at("C", mul(dirXY(i * 60), 1.397)));
  for (let i = 0; i < 6; i++) m.link(cs[i], cs[(i + 1) % 6], 1.5);
  cs.forEach((c, i) => m.grow(c, "H", dirXY(i * 60), 1.084));
  return m.done();
}
// Бутен-2 с поворотом правой половины вокруг оси C=C на угол theta (0 — цис, 180 — транс)
export function butene2(theta) {
  const m = mol();
  const c2 = m.at("C", [-0.67, 0, 0], "C2"), c3 = m.at("C", [0.67, 0, 0], "C3");
  m.link(c2, c3, 2);
  const c1 = m.grow(c2, "C", dirXY(124), 1.5, 1, "C1");
  m.grow(c2, "H", dirXY(-119), 1.09);
  const t = deg(theta);
  const rot = (v) => [v[0], v[1] * Math.cos(t) - v[2] * Math.sin(t), v[1] * Math.sin(t) + v[2] * Math.cos(t)];
  const c4 = m.grow(c3, "C", rot(dirXY(56)), 1.5, 1, "C4");
  m.grow(c3, "H", rot(dirXY(-61)), 1.09);
  m.fillH(c1, "tet", 3, 1.09, 0.5);
  m.fillH(c4, "tet", 3, 1.09, 0.5 + t);
  return m.done();
}

// Ацил CH3–C(=O)– в плоскости xy; карбонильный C в начале координат.
function acyl(m, oTag) {
  const c2 = m.at("C", [0, 0, 0], "Cco");
  const c1 = m.grow(c2, "C", dirXY(210), 1.5, 1, "Cme");
  m.grow(c2, "O", dirXY(90), 1.21, 2, "Oco");
  const o = m.grow(c2, "O", dirXY(330), 1.35, 1, oTag);
  m.fillH(c1, "tet", 3, 1.09, 0.4, "Hme");
  return o;
}
function ethylOn(m, o) {
  const ca = m.grow(o, "C", dirXY(33), 1.45, 1, "Ca");
  const cb = m.grow(ca, "C", dirXY(-37.5), 1.52, 1, "Cb");
  m.fillH(ca, "tet", 2, 1.09, 0, "Ha");
  m.fillH(cb, "tet", 3, 1.09, 0.3, "Hb");
}
export function aceticAcid() { const m = mol(); const o = acyl(m, "Oac"); m.grow(o, "H", dirXY(44), 0.97, 1, "Hx"); return m.done(); }
export function ethylAcetate() { const m = mol(); const o = acyl(m, "Oal"); ethylOn(m, o); return m.done(); }
export function ethanol() {
  const m = mol();
  const o = m.at("O", [0, 0, 0], "Oal");
  ethylOn(m, o);
  m.grow(o, "H", dirXY(150), 0.97, 1, "Hy");
  return m.done();
}
export function ethanal() {
  const m = mol();
  const c2 = m.at("C", [0, 0, 0], "Cco");
  const c1 = m.grow(c2, "C", dirXY(210), 1.5, 1, "Cme");
  m.grow(c2, "O", dirXY(90), 1.21, 2, "Oco");
  m.grow(c2, "H", dirXY(330), 1.11, 1, "Hald");
  m.fillH(c1, "tet", 3, 1.09, 0.4, "Hme");
  return m.done();
}
export function acetone() {
  const m = mol();
  const c = m.at("C", [0, 0, 0], "Cco");
  m.grow(c, "O", dirXY(90), 1.21, 2, "Oco");
  const a = m.grow(c, "C", dirXY(210), 1.51), b = m.grow(c, "C", dirXY(330), 1.51);
  m.fillH(a, "tet", 3, 1.09, 0.4); m.fillH(b, "tet", 3, 1.09, 0.4);
  return m.done();
}
export function phenol() {
  const m = mol(), cs = [];
  for (let i = 0; i < 6; i++) cs.push(m.at("C", mul(dirXY(i * 60), 1.397), i ? undefined : "Cph"));
  for (let i = 0; i < 6; i++) m.link(cs[i], cs[(i + 1) % 6], 1.5);
  const o = m.grow(cs[0], "O", [1, 0, 0], 1.36, 1, "Oph");
  m.grow(o, "H", dirXY(-71), 0.96, 1, "Hph");
  cs.slice(1).forEach((c, i) => m.grow(c, "H", dirXY((i + 1) * 60), 1.084));
  return m.done();
}
export function glycerol() {
  const m = mol();
  const c = [m.at("C", [-1.25, 0, 0]), m.at("C", [0, 0.72, 0]), m.at("C", [1.25, 0, 0])];
  m.link(c[0], c[1]); m.link(c[1], c[2]);
  c.forEach((ci, k) => {
    const o = m.grow(ci, "O", freeDirs(m.dirsOf(ci), "tet", 3, k === 2 ? 0.2 : 2.3)[0], 1.43, 1, "Og" + k);
    m.grow(o, "H", freeDirs(m.dirsOf(o), "tet", 1, 1)[0], 0.97, 1, "Hg" + k);
    m.fillH(ci, "tet", k === 1 ? 1 : 2);
  });
  return m.done();
}

// ---------- биомолекулы ----------
// β-D-глюкопираноза в конформации «кресло»: все OH и CH2OH экваториальны
export function betaGlucose() {
  const m = mol();
  // кольцо O5, C1…C5 по часовой стрелке (вид сверху); s — «вверх/вниз» кресла
  const names = ["O5", "C1", "C2", "C3", "C4", "C5"];
  const pucker = [1, -1, 1, -1, 1, -1];
  const ring = names.map((n, i) => {
    const a = 30 - i * 60;
    return m.at(n[0], [1.435 * Math.cos(deg(a)), 1.435 * Math.sin(deg(a)), 0.25 * pucker[i]], n);
  });
  for (let i = 0; i < 6; i++) m.link(ring[i], ring[(i + 1) % 6]);
  for (let i = 1; i < 6; i++) {
    const p = m.atoms[ring[i]].pos, s = pucker[i];
    const r = norm([p[0], p[1], 0]);
    const eq = norm(add(mul(r, 0.94), [0, 0, -0.34 * s]));
    m.grow(ring[i], "H", [0, 0, s], 1.09);
    if (i === 5) {
      const c6 = m.grow(ring[i], "C", eq, 1.52, 1, "C6");
      const o6 = m.grow(c6, "O", freeDirs(m.dirsOf(c6), "tet", 1, 2.1)[0], 1.43, 1, "O6");
      m.fillH(c6, "tet", 2);
      m.grow(o6, "H", freeDirs(m.dirsOf(o6), "tet", 1, 0.4)[0], 0.97);
    } else {
      const o = m.grow(ring[i], "O", eq, 1.43, 1, "O" + i);
      m.grow(o, "H", freeDirs(m.dirsOf(o), "tet", 1, 0.8 + i)[0], 0.97);
    }
  }
  return centerOf(m.done());
}

// Дипептид Gly–Ala (плоский вытянутый остов). Метки: Cg — карбонильный C глицина, Nal — N аланина.
export function glyAla() {
  const m = mol();
  const n1 = m.at("N", [0, 0, 0], "N1");
  const ca1 = m.grow(n1, "C", dirXY(-30), 1.46, 1, "Ca1");
  const c1 = m.grow(ca1, "C", dirXY(30), 1.52, 1, "Cg");
  m.grow(c1, "O", dirXY(90), 1.23, 2, "Og");
  const n2 = m.grow(c1, "N", dirXY(-30), 1.33, 1, "Nal");
  m.grow(n2, "H", dirXY(-90), 1.01, 1, "Hn2");
  const ca2 = m.grow(n2, "C", dirXY(30), 1.46, 1, "Ca2");
  const c2 = m.grow(ca2, "C", dirXY(-30), 1.52, 1, "C2");
  m.grow(c2, "O", dirXY(-90), 1.21, 2, "O2a");
  const ob = m.grow(c2, "O", dirXY(30), 1.35, 1, "O2b");
  m.grow(ob, "H", dirXY(-30), 0.97, 1, "Ht");
  m.fillH(n1, "tet", 2, 1.01, 0.3, "Hn");
  m.fillH(ca1, "tet", 2, 1.09, 0, "Hag");
  // L-аланин (S): проверяем знак смешанного произведения N, COOH, CH3 и при необходимости меняем местами
  let [dA, dB] = freeDirs(m.dirsOf(ca2), "tet", 2);
  const P = m.atoms[ca2].pos, rel = (i) => subv(m.atoms[i].pos, P);
  if (dot(cross(rel(n2), rel(c2)), dA) < 0) [dA, dB] = [dB, dA];
  const cb = m.grow(ca2, "C", dA, 1.53, 1, "Cb");
  m.grow(ca2, "H", dB, 1.09, 1, "Haa");
  m.fillH(cb, "tet", 3, 1.09, 0.2, "Hb");
  return m.done();
}

// Реакция конденсации (этерификация, пептидная связь): из продукта «вынимаем» воду.
// acylC — атом, у которого была группа OH; link — атом второго реагента, который с ним связался.
export function condensation(prod, { acylC, link, right, offset, waterAt, hxAngle }) {
  const P = {}; prod.atoms.forEach((a) => (P[a.tag] = a.pos));
  const el = {}; prod.atoms.forEach((a) => (el[a.tag] = a.el));
  const T = (i) => prod.atoms[i].tag;
  const pb = prod.bonds.map(([i, j, o]) => [T(i), T(j), o]);
  const isR = (t) => right.includes(t);
  const u = norm(subv(P[acylC], P[link]));
  const start = {}, end = { ...P };
  for (const t in P) start[t] = isR(t) ? add(P[t], offset) : P[t];
  // кислотный OH стоит на месте будущего атома link
  start.Ow = P[link];
  const toC = norm(subv(P[acylC], P[link]));
  const ang = hxAngle;
  const hx = [toC[0] * Math.cos(deg(ang)) - toC[1] * Math.sin(deg(ang)), toC[0] * Math.sin(deg(ang)) + toC[1] * Math.cos(deg(ang)), 0];
  start.Hw1 = add(P[link], mul(hx, 0.97));
  start.Hw2 = add(start[link], mul(u, 1.0));
  end.Ow = waterAt;
  end.Hw1 = add(waterAt, mul(dirXY(142), 0.96));
  end.Hw2 = add(waterAt, mul(dirXY(38), 0.96));
  el.Ow = "O"; el.Hw1 = "H"; el.Hw2 = "H";
  const sb = pb.filter(([a, b]) => !((a === acylC && b === link) || (a === link && b === acylC))).concat([[acylC, "Ow", 1], ["Ow", "Hw1", 1], [link, "Hw2", 1]]);
  const eb = pb.concat([["Ow", "Hw1", 1], ["Ow", "Hw2", 1]]);
  return { el, start, end, sb, eb, flashAt: P[link] };
}

// Морф: атомы плавно переезжают из start в end, «старые» связи тают, «новые» появляются
export function createMorph(viewer, R) {
  const group = new THREE.Group();
  viewer.scene.add(group);
  const tags = Object.keys(R.el);
  const meshes = {};
  const mats = {};
  const matOf = (e) => (mats[e] ||= glossy(CPK[e] ?? 0xff66cc));
  for (const t of tags) {
    const e = R.el[t];
    const mm = new THREE.Mesh(sphereGeo(Math.max(0.22, (COV_R[e] ?? 0.7) * 0.42), 32), matOf(e));
    meshes[t] = mm; group.add(mm);
  }
  const key = (a, b, o) => [a, b].sort().join("|") + "|" + o;
  const all = new Map();
  for (const [a, b, o] of R.sb) all.set(key(a, b, o), { a, b, o, s: 1, e: 0 });
  for (const [a, b, o] of R.eb) { const k = key(a, b, o); if (all.has(k)) all.get(k).e = 1; else all.set(k, { a, b, o, s: 0, e: 1 }); }
  const bondMat = glossy(0xb8c2d8, { roughness: 0.45 });
  const cyl = new THREE.CylinderGeometry(1, 1, 1, 14);
  const bonds = [...all.values()].map((b) => {
    const n = b.o === 2 ? 2 : 1;
    b.m = Array.from({ length: n }, () => { const c = new THREE.Mesh(cyl, bondMat); group.add(c); return c; });
    return b;
  });
  const flash = glowSprite(0xffe08a, 2.4, 0);
  group.add(flash);
  const Y = new THREE.Vector3(0, 1, 0), A = new THREE.Vector3(), B = new THREE.Vector3(), D = new THREE.Vector3();
  let t = 0;
  function setT(x) {
    t = x;
    const k = easeInOut(Math.min(1, Math.max(0, (x - 0.15) / 0.7)));
    for (const tg of tags) {
      const s = R.start[tg], e = R.end[tg];
      meshes[tg].position.set(s[0] + (e[0] - s[0]) * k, s[1] + (e[1] - s[1]) * k, s[2] + (e[2] - s[2]) * k);
    }
    for (const b of bonds) {
      const w = b.s && b.e ? 1 : b.s ? 1 - Math.min(1, Math.max(0, (k - 0.35) / 0.15)) : Math.min(1, Math.max(0, (k - 0.5) / 0.15));
      A.copy(meshes[b.a].position); B.copy(meshes[b.b].position);
      D.subVectors(B, A); const len = D.length(); D.normalize();
      const off = new THREE.Vector3().crossVectors(D, new THREE.Vector3(0, 0, 1)).normalize().multiplyScalar(0.11);
      b.m.forEach((c, i) => {
        c.visible = w > 0.02;
        const r = (b.o === 1 ? 0.09 : 0.065) * w;
        c.scale.set(r, len, r);
        c.position.copy(A).add(B).multiplyScalar(0.5);
        if (b.m.length === 2) c.position.addScaledVector(off, i ? 1 : -1);
        c.quaternion.setFromUnitVectors(Y, D);
      });
    }
    const f = Math.max(0, 1 - Math.abs(k - 0.45) / 0.15);
    flash.material.opacity = f * 0.9;
    flash.position.set(...R.flashAt);
  }
  setT(0);
  return { group, setT, get t() { return t; } };
}

// Полупрозрачные ореолы вокруг атомов группы
export function haloGroup(viewer, data, tags, color = 0xffd36e) {
  const g = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.22, depthWrite: false });
  data.atoms.forEach((a) => { if (tags.includes(a.tag)) { const s = new THREE.Mesh(sphereGeo(0.62, 24), mat); s.position.set(...a.pos); g.add(s); } });
  viewer.scene.add(g);
  return g;
}

// Часы для симуляций: идут и при prefers-reduced-motion (это не украшение, а опыт)
export function simClock() {
  let last = performance.now();
  return () => { const n = performance.now(); const d = Math.min(0.05, (n - last) / 1000); last = n; return d; };
}

// Мини-график на SVG: series = [{ pts:[[x,y]], cls }]
export function svgPlot({ w = 640, h = 260, pad = [46, 16, 18, 34], xr, yr, xt = [], yt = [], xl = "", yl = "", series = [], extra = "" }) {
  const [L, R, T, B] = pad;
  const X = (x) => L + ((x - xr[0]) / (xr[1] - xr[0])) * (w - L - R);
  const Yf = (y) => h - B - ((y - yr[0]) / (yr[1] - yr[0])) * (h - T - B);
  const path = (pts) => pts.map((p, i) => (i ? "L" : "M") + X(p[0]).toFixed(1) + " " + Yf(p[1]).toFixed(1)).join("");
  return `<svg viewBox="0 0 ${w} ${h}" class="yk-plot" role="img">
    ${yt.map((y) => `<line class="g" x1="${L}" x2="${w - R}" y1="${Yf(y)}" y2="${Yf(y)}"/><text class="t" x="${L - 6}" y="${Yf(y) + 4}" text-anchor="end">${String(y).replace(".", ",")}</text>`).join("")}
    ${xt.map((x) => `<text class="t" x="${X(x)}" y="${h - B + 16}" text-anchor="middle">${String(x).replace(".", ",")}</text>`).join("")}
    <line class="ax" x1="${L}" x2="${w - R}" y1="${h - B}" y2="${h - B}"/><line class="ax" x1="${L}" x2="${L}" y1="${T}" y2="${h - B}"/>
    ${extra && typeof extra === "function" ? extra(X, Yf) : ""}
    ${series.map((s) => `<path class="${s.cls}" d="${s.fill ? path(s.pts) + "Z" : path(s.pts)}"/>`).join("")}
    <text class="t" x="${w - R}" y="${h - 4}" text-anchor="end">${xl}</text><text class="t" x="${L + 4}" y="${T + 10}">${yl}</text>
  </svg>`;
}

// Общие стили графиков (вставляются один раз)
export function plotStyles() {
  if (document.getElementById("yk-style")) return "";
  return `<style id="yk-style">
  .yk-plot{width:100%;height:auto;display:block}
  .yk-plot .g{stroke:var(--line);stroke-width:1}
  .yk-plot .ax{stroke:var(--line-2);stroke-width:1.5}
  .yk-plot .t{fill:var(--text-3);font-size:12px;font-family:var(--font)}
  .yk-plot .l1{fill:none;stroke:var(--accent);stroke-width:2.5}
  .yk-plot .l2{fill:none;stroke:#ff8a4c;stroke-width:2.5}
  .yk-plot .l3{fill:none;stroke:var(--good);stroke-width:2.5}
  .yk-plot .l4{fill:none;stroke:var(--accent-2);stroke-width:2;stroke-dasharray:6 5}
  .yk-plot .f1{fill:color-mix(in srgb,var(--bad) 35%,transparent);stroke:none}
  .yk-plot .f2{fill:color-mix(in srgb,var(--good) 22%,transparent);stroke:none}
  .yk-plot .mk{stroke:var(--warn);stroke-width:1.5;stroke-dasharray:4 4}
  .yk-plot .lab{fill:var(--text-2);font-size:12px;font-weight:700;font-family:var(--font)}
  .yk-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px}
  .yk-num{font-family:var(--mono);font-weight:700}
  .yk-out{margin:10px 0 0}
  .yk-leg{display:flex;flex-wrap:wrap;gap:12px;font-size:.82rem;color:var(--text-2);margin-top:6px}
  .yk-leg i{display:inline-block;width:14px;height:4px;border-radius:2px;vertical-align:middle;margin-right:6px}
  .yk-in{width:100%;max-width:100%;box-sizing:border-box}
  </style>`;
}
