// Элементарные ячейки: 14 решёток Браве, плоскости Миллера и плотная упаковка.
// Координаты «кристаллографические» (x, y, z), в three.js: (x, z, −y).
import { THREE, sphereGeo, glossy, textSprite } from "./core.js";

const D = Math.PI / 180;
export const SYSTEMS = {
  cubic: { name: "кубическая", p: { a: 3, b: 3, c: 3, al: 90, be: 90, ga: 90 }, free: ["a"], tie: (p) => ({ ...p, b: p.a, c: p.a, al: 90, be: 90, ga: 90 }), rule: "a = b = c, α = β = γ = 90°" },
  tetragonal: { name: "тетрагональная", p: { a: 2.8, b: 2.8, c: 4.2, al: 90, be: 90, ga: 90 }, free: ["a", "c"], tie: (p) => ({ ...p, b: p.a, al: 90, be: 90, ga: 90 }), rule: "a = b ≠ c, α = β = γ = 90°" },
  orthorhombic: { name: "ромбическая", p: { a: 2.6, b: 3.2, c: 4, al: 90, be: 90, ga: 90 }, free: ["a", "b", "c"], tie: (p) => ({ ...p, al: 90, be: 90, ga: 90 }), rule: "a ≠ b ≠ c, α = β = γ = 90°" },
  hexagonal: { name: "гексагональная", p: { a: 3, b: 3, c: 4.8, al: 90, be: 90, ga: 120 }, free: ["a", "c"], tie: (p) => ({ ...p, b: p.a, al: 90, be: 90, ga: 120 }), rule: "a = b ≠ c, α = β = 90°, γ = 120°" },
  rhombohedral: { name: "ромбоэдрическая", p: { a: 3.2, b: 3.2, c: 3.2, al: 75, be: 75, ga: 75 }, free: ["a", "al"], tie: (p) => ({ ...p, b: p.a, c: p.a, be: p.al, ga: p.al }), rule: "a = b = c, α = β = γ ≠ 90°" },
  monoclinic: { name: "моноклинная", p: { a: 2.8, b: 3.4, c: 3.8, al: 90, be: 108, ga: 90 }, free: ["a", "b", "c", "be"], tie: (p) => ({ ...p, al: 90, ga: 90 }), rule: "a ≠ b ≠ c, α = γ = 90° ≠ β" },
  triclinic: { name: "триклинная", p: { a: 2.8, b: 3.2, c: 3.6, al: 80, be: 96, ga: 106 }, free: ["a", "b", "c", "al", "be", "ga"], tie: (p) => p, rule: "a ≠ b ≠ c, α ≠ β ≠ γ" },
};
const CENT = {
  P: [[0, 0, 0]], I: [[0, 0, 0], [0.5, 0.5, 0.5]], F: [[0, 0, 0], [0.5, 0.5, 0], [0.5, 0, 0.5], [0, 0.5, 0.5]], C: [[0, 0, 0], [0.5, 0.5, 0]], R: [[0, 0, 0]],
};
export const CENT_NAME = { P: "примитивная", I: "объёмноцентрированная", F: "гранецентрированная", C: "базоцентрированная", R: "ромбоэдрическая (примитивная)" };
export const BRAVAIS = [
  ["cubic", "P"], ["cubic", "I"], ["cubic", "F"], ["tetragonal", "P"], ["tetragonal", "I"],
  ["orthorhombic", "P"], ["orthorhombic", "C"], ["orthorhombic", "I"], ["orthorhombic", "F"],
  ["hexagonal", "P"], ["rhombohedral", "R"], ["monoclinic", "P"], ["monoclinic", "C"], ["triclinic", "P"],
];

// Матрица ячейки: столбцы — векторы a, b, c в декартовых координатах
export function cellMatrix({ a, b, c, al, be, ga }) {
  const ca = Math.cos(al * D), cb = Math.cos(be * D), cg = Math.cos(ga * D), sg = Math.sin(ga * D);
  const cy = (ca - cb * cg) / sg;
  const cz = Math.sqrt(Math.max(0, 1 - cb * cb - cy * cy));
  return [[a, b * cg, c * cb], [0, b * sg, c * cy], [0, 0, c * cz]];
}
const mv = (M, f) => [0, 1, 2].map((i) => M[i][0] * f[0] + M[i][1] * f[1] + M[i][2] * f[2]);
const toT = (p) => new THREE.Vector3(p[0], p[2], -p[1]);
const CORNERS = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1], [1, 1, 0], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
const EDGES = [[0, 1], [0, 2], [0, 3], [1, 4], [1, 5], [2, 4], [2, 6], [3, 5], [3, 6], [4, 7], [5, 7], [6, 7]];

function cellLines(M, color = 0x9fb0d8, opacity = 1) {
  const pts = [];
  for (const [i, j] of EDGES) pts.push(toT(mv(M, CORNERS[i])), toT(mv(M, CORNERS[j])));
  return new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color, transparent: opacity < 1, opacity }));
}
function centerOf(M) { return toT(mv(M, [0.5, 0.5, 0.5])); }

// ---------- Решётки Браве ----------
export function createBravais(viewer) {
  const group = new THREE.Group();
  viewer.scene.add(group);
  const cornerMat = glossy(0x6ea8ff), centMat = glossy(0xff8a5c);
  return {
    set(M, cent) {
      viewer.clear(group);
      const off = centerOf(M).negate();
      const g = new THREE.Group();
      g.position.copy(off);
      group.add(g);
      // соседние ячейки — бледно, для ощущения решётки
      for (const s of [[1, 0, 0], [0, 1, 0], [0, 0, 1]]) {
        const l = cellLines(M, 0x9fb0d8, 0.18);
        l.position.copy(toT(mv(M, s)));
        g.add(l);
      }
      g.add(cellLines(M, 0xc9d4f0));
      const basis = CENT[cent];
      const seen = new Set();
      for (const b of basis) for (const t of CORNERS) {
        const f = [b[0] + t[0], b[1] + t[1], b[2] + t[2]];
        if (f.some((x) => x > 1.001)) continue;
        const key = f.map((x) => x.toFixed(2)).join();
        if (seen.has(key)) continue;
        seen.add(key);
        const isCorner = f.every((x) => x === 0 || x === 1);
        const m = new THREE.Mesh(sphereGeo(isCorner ? 0.2 : 0.24, 24), isCorner ? cornerMat : centMat);
        m.position.copy(toT(mv(M, f)));
        g.add(m);
      }
      [["a", 0xff6b81], ["b", 0x3ddc97], ["c", 0x6ea8ff]].forEach(([n, col], k) => {
        const e = [0, 0, 0]; e[k] = 1;
        const v = toT(mv(M, e));
        const ar = new THREE.ArrowHelper(v.clone().normalize(), new THREE.Vector3(), v.length() * 1.18, col, 0.25, 0.15);
        g.add(ar);
        const t = textSprite(n, { size: 0.36, color: "#fff", bg: `#${col.toString(16).padStart(6, "0")}` });
        t.position.copy(v.clone().multiplyScalar(1.28));
        g.add(t);
      });
    },
  };
}

// Многоугольник сечения единичного куба плоскостью h·f = n (в долях ячейки)
export function planePolygon(hkl, n) {
  const pts = [];
  for (const [i, j] of EDGES) {
    const p0 = CORNERS[i], p1 = CORNERS[j];
    const a = hkl[0] * p0[0] + hkl[1] * p0[1] + hkl[2] * p0[2];
    const b = hkl[0] * p1[0] + hkl[1] * p1[1] + hkl[2] * p1[2];
    if (Math.abs(b - a) < 1e-9) continue;
    const t = (n - a) / (b - a);
    if (t < -1e-9 || t > 1 + 1e-9) continue;
    const p = p0.map((x, k) => x + t * (p1[k] - x));
    if (!pts.some((q) => Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]) < 1e-6)) pts.push(p);
  }
  if (pts.length < 3) return null;
  const c = [0, 1, 2].map((k) => pts.reduce((s, p) => s + p[k], 0) / pts.length);
  const nn = hkl.map((x) => x / Math.hypot(...hkl));
  let u = Math.abs(nn[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
  const dd = u[0] * nn[0] + u[1] * nn[1] + u[2] * nn[2];
  u = u.map((x, k) => x - dd * nn[k]);
  const w = [nn[1] * u[2] - nn[2] * u[1], nn[2] * u[0] - nn[0] * u[2], nn[0] * u[1] - nn[1] * u[0]];
  const ang = (p) => { const d = p.map((x, k) => x - c[k]); return Math.atan2(d[0] * w[0] + d[1] * w[1] + d[2] * w[2], d[0] * u[0] + d[1] * u[1] + d[2] * u[2]); };
  return pts.sort((p, q) => ang(p) - ang(q));
}

export function createMiller(viewer) {
  const group = new THREE.Group();
  viewer.scene.add(group);
  return {
    set(M, hkl) {
      viewer.clear(group);
      const g = new THREE.Group();
      g.position.copy(centerOf(M).negate());
      group.add(g);
      g.add(cellLines(M, 0xc9d4f0));
      for (const f of CORNERS) {
        const m = new THREE.Mesh(sphereGeo(0.12, 16), glossy(0x9fb0d8));
        m.position.copy(toT(mv(M, f)));
        g.add(m);
      }
      if (hkl.every((x) => x === 0)) return 0;
      const vals = CORNERS.map((p) => hkl[0] * p[0] + hkl[1] * p[1] + hkl[2] * p[2]);
      const lo = Math.ceil(Math.min(...vals) - 1e-9), hi = Math.floor(Math.max(...vals) + 1e-9);
      let count = 0;
      for (let n = lo; n <= hi; n++) {
        const poly = planePolygon(hkl, n);
        if (!poly) continue;
        count++;
        const main = n === 1 || (hi < 1 && n === lo) ;
        const verts = poly.map((p) => toT(mv(M, p)));
        const pos = [];
        for (let k = 1; k + 1 < verts.length; k++) pos.push(...verts[0].toArray(), ...verts[k].toArray(), ...verts[k + 1].toArray());
        const geo = new THREE.BufferGeometry();
        geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
        g.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: main ? 0xffb02e : 0x6ea8ff, transparent: true, opacity: main ? 0.55 : 0.22, side: THREE.DoubleSide, depthWrite: false })));
        g.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(verts), new THREE.LineBasicMaterial({ color: main ? 0xffb02e : 0x6ea8ff })));
      }
      return count;
    },
  };
}

// ---------- Плотная упаковка: шары, обрезанные гранями куба ----------
export function createPacking(viewer) {
  const group = new THREE.Group();
  viewer.scene.add(group);
  const a = 3, s = a / 2;
  const planes = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]].map((n) => new THREE.Plane(new THREE.Vector3(...n), s + 1e-3));
  return {
    set(kind) {
      viewer.clear(group);
      const M = [[a, 0, 0], [0, a, 0], [0, 0, a]];
      const off = new THREE.Vector3(-s, -s, s);
      const lines = cellLines(M, 0xc9d4f0);
      lines.position.copy(off);
      group.add(lines);
      const r = kind === "sc" ? a / 2 : kind === "bcc" ? (Math.sqrt(3) * a) / 4 : (Math.SQRT2 * a) / 4;
      const basis = kind === "sc" ? CENT.P : kind === "bcc" ? CENT.I : CENT.F;
      const mat = new THREE.MeshPhysicalMaterial({ color: kind === "sc" ? 0x9aa7c7 : kind === "bcc" ? 0xe0773a : 0xd8a03c, roughness: 0.3, clearcoat: 0.5, clippingPlanes: planes, side: THREE.DoubleSide });
      const seen = new Set();
      for (const b of basis) for (const t of CORNERS) {
        const f = [b[0] + t[0], b[1] + t[1], b[2] + t[2]];
        if (f.some((x) => x > 1.001)) continue;
        const key = f.join();
        if (seen.has(key)) continue;
        seen.add(key);
        const m = new THREE.Mesh(sphereGeo(r, 40), mat);
        m.position.copy(toT(mv(M, f))).add(off);
        group.add(m);
      }
      return r / a;
    },
  };
}
