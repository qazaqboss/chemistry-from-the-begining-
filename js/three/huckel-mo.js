// Геометрия плоских сопряжённых молекул и 3D-сцена π-орбиталей для метода Хюккеля.
// Молекула лежит в плоскости xz сцены, p-орбитали торчат вдоль оси y.
import { THREE, sphereGeo, glossy, bondMesh, textSprite } from "./core.js";

const B = 1.4; // длина связи C–C в сопряжённой системе, Å

export function chainCoords(n) {
  const dx = B * Math.cos(Math.PI / 6), dz = B * Math.sin(Math.PI / 6);
  const pts = Array.from({ length: n }, (_, i) => [i * dx, (i % 2) * dz]);
  return center(pts);
}
export function ringCoords(n) {
  const R = B / (2 * Math.sin(Math.PI / n));
  return Array.from({ length: n }, (_, i) => {
    const t = Math.PI / 2 + (2 * Math.PI * i) / n;
    return [R * Math.cos(t), R * Math.sin(t)];
  });
}
export function naphthaleneCoords() {
  const c = B * Math.cos(Math.PI / 6);
  const pts = [];
  for (const cx of [-c, c]) for (let k = 0; k < 6; k++) {
    const t = Math.PI / 6 + (k * Math.PI) / 3;
    const p = [cx + B * Math.cos(t), B * Math.sin(t)];
    if (!pts.some((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) < 0.1)) pts.push(p);
  }
  // нумерация по кругу (по углу вокруг центра) — так матрица выглядит аккуратнее
  return pts.sort((a, b) => Math.atan2(a[1], a[0]) - Math.atan2(b[1], b[0]));
}
function center(pts) {
  const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length, cz = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  return pts.map(([x, z]) => [x - cx, z - cz]);
}
export function adjacency(pts) {
  const n = pts.length;
  return Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i !== j && Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1]) < B * 1.1 ? 1 : 0)));
}
export function bondsOf(A) {
  const b = [];
  for (let i = 0; i < A.length; i++) for (let j = i + 1; j < A.length; j++) if (A[i][j]) b.push([i, j]);
  return b;
}
// Направления связей C–H: на свободные места в sp²-«звезде»
function hydrogens(pts, A) {
  const H = [];
  pts.forEach((p, i) => {
    const nb = pts.filter((_, j) => A[i][j]).map((q) => { const d = [q[0] - p[0], q[1] - p[1]]; const l = Math.hypot(...d); return [d[0] / l, d[1] / l]; });
    let dirs = [];
    if (nb.length === 1) {
      const a = Math.atan2(nb[0][1], nb[0][0]);
      dirs = [a + (2 * Math.PI) / 3, a - (2 * Math.PI) / 3].map((t) => [Math.cos(t), Math.sin(t)]);
    } else if (nb.length === 2) {
      const s = [-(nb[0][0] + nb[1][0]), -(nb[0][1] + nb[1][1])], l = Math.hypot(...s) || 1;
      dirs = [[s[0] / l, s[1] / l]];
    }
    for (const d of dirs) H.push([p[0] + 1.08 * d[0], p[1] + 1.08 * d[1]]);
  });
  return H;
}

const POS = 0x3d8bff, NEG = 0xff5a3c;

export function createHuckelScene(viewer) {
  const group = new THREE.Group();
  viewer.scene.add(group);
  const lobeGeo = sphereGeo(1, 32);
  const matC = glossy(0x3a3f4b), matH = glossy(0xf2f4f8), bondMat = glossy(0xb8c2d8, { roughness: 0.45 });
  const mPos = new THREE.MeshPhysicalMaterial({ color: POS, transparent: true, opacity: 0.78, roughness: 0.3, clearcoat: 0.6 });
  const mNeg = new THREE.MeshPhysicalMaterial({ color: NEG, transparent: true, opacity: 0.78, roughness: 0.3, clearcoat: 0.6 });
  let lobes = []; // { up, down, cur, target }
  let labels = new THREE.Group();
  let pts = [];

  function build(points, A) {
    viewer.clear(group);
    group.add(labels = new THREE.Group());
    pts = points;
    lobes = [];
    const P = (p) => [p[0], 0, p[1]];
    points.forEach((p) => {
      const at = new THREE.Mesh(sphereGeo(0.3, 32), matC);
      at.position.set(...P(p));
      group.add(at);
      const up = new THREE.Mesh(lobeGeo, mPos), down = new THREE.Mesh(lobeGeo, mNeg);
      up.position.set(...P(p)); down.position.set(...P(p));
      group.add(up, down);
      lobes.push({ up, down, cur: 0, target: 0 });
    });
    for (const [i, j] of bondsOf(A)) group.add(bondMesh(P(points[i]), P(points[j]), 0.1, bondMat));
    for (const hp of hydrogens(points, A)) {
      const m = new THREE.Mesh(sphereGeo(0.18, 24), matH);
      m.position.set(...P(hp));
      group.add(m);
      // связь C–H к ближайшему углероду
      const c = points.reduce((a, b) => (Math.hypot(b[0] - hp[0], b[1] - hp[1]) < Math.hypot(a[0] - hp[0], a[1] - hp[1]) ? b : a));
      group.add(bondMesh(P(c), P(hp), 0.07, bondMat));
    }
    applyLobes();
  }
  function applyLobes() {
    for (const L of lobes) {
      const s = Math.min(1.35, Math.abs(L.cur) / 0.55);
      const vis = s > 0.02;
      L.up.visible = L.down.visible = vis;
      if (!vis) continue;
      const pos = L.cur > 0;
      L.up.material = pos ? mPos : mNeg;
      L.down.material = pos ? mNeg : mPos;
      L.up.scale.set(0.42 * s, 0.8 * s, 0.42 * s);
      L.down.scale.copy(L.up.scale);
      L.up.position.y = 0.8 * s + 0.05;
      L.down.position.y = -0.8 * s - 0.05;
    }
  }
  viewer.onFrame((dt) => {
    let moving = false;
    for (const L of lobes) {
      const d = L.target - L.cur;
      if (Math.abs(d) > 1e-4) { L.cur += d * Math.min(1, dt * 6 || 1); moving = true; }
    }
    if (moving) applyLobes();
  });
  return {
    build,
    radius() { return Math.max(...pts.map((p) => Math.hypot(...p))) + 2.2; },
    setCoeffs(c, instant = false) {
      lobes.forEach((L, i) => { L.target = c ? c[i] : 0; if (instant || matchMedia("(prefers-reduced-motion: reduce)").matches) L.cur = L.target; });
      applyLobes();
    },
    setLabels(items) {
      viewer.clear(labels);
      for (const it of items) {
        const t = textSprite(it.text, { size: 0.36, bg: "rgba(10,14,30,0.72)" });
        t.position.set(it.pos[0], it.y ?? 0, it.pos[1]);
        labels.add(t);
      }
    },
  };
}
