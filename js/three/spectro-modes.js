// Нормальные колебания H₂O и CO₂: силовое поле → матрица Гессе (численно) →
// масс-взвешивание → собственные значения методом Якоби → частоты и формы колебаний.
import { THREE, sphereGeo, glossy, bondMesh } from "./core.js";
import { CPK, COV_R } from "../data/molecules.js";
import { jacobiEigen } from "./qm-linalg.js";

const TH = (104.52 * Math.PI) / 180, R = 0.9572;
export const MODE_MOLS = {
  h2o: {
    label: "H₂O", r0: R, kr: 7.68, krr: -0.1, kt: 0.645,
    atoms: [{ el: "O", m: 15.995, q: -0.66, p: [0, 0, 0] }, { el: "H", m: 1.008, q: 0.33, p: [R * Math.sin(TH / 2), -R * Math.cos(TH / 2), 0] }, { el: "H", m: 1.008, q: 0.33, p: [-R * Math.sin(TH / 2), -R * Math.cos(TH / 2), 0] }],
    bonds: [[0, 1], [0, 2]], angle: [1, 0, 2, TH], exp: [1595, 3657, 3756],
  },
  co2: {
    label: "CO₂", r0: 1.16, kr: 15.5, krr: 1.0, kt: 0.77,
    atoms: [{ el: "O", m: 15.995, q: -0.35, p: [-1.16, 0, 0] }, { el: "C", m: 12.0, q: 0.7, p: [0, 0, 0] }, { el: "O", m: 15.995, q: -0.35, p: [1.16, 0, 0] }],
    bonds: [[1, 0], [1, 2]], angle: [0, 1, 2, Math.PI], exp: [667, 667, 1333, 2349],
  },
};

const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const len = (a) => Math.hypot(...a);

export function computeModes(mol) {
  const n = mol.atoms.length, N = 3 * n;
  const x0 = mol.atoms.flatMap((a) => a.p);
  const P = (x, i) => [x[3 * i], x[3 * i + 1], x[3 * i + 2]];
  // потенциал валентного силового поля, мдин/Å·Å² = 10⁻¹⁸ Дж
  const V = (x) => {
    const dr = mol.bonds.map(([i, j]) => len(sub3(P(x, i), P(x, j))) - mol.r0);
    let v = 0.5 * mol.kr * (dr[0] ** 2 + dr[1] ** 2) + mol.krr * dr[0] * dr[1];
    const [i, j, k, t0] = mol.angle;
    const u = sub3(P(x, i), P(x, j)), w = sub3(P(x, k), P(x, j));
    const t = Math.acos(Math.max(-1, Math.min(1, (u[0] * w[0] + u[1] * w[1] + u[2] * w[2]) / len(u) / len(w))));
    return v + 0.5 * mol.kt * (t - t0) ** 2;
  };
  const h = 1e-3;
  const H = Array.from({ length: N }, () => new Array(N).fill(0));
  for (let i = 0; i < N; i++) for (let j = i; j < N; j++) {
    const f = (a, b) => { const x = x0.slice(); x[i] += a; x[j] += b; return V(x); };
    H[i][j] = H[j][i] = (f(h, h) - f(h, -h) - f(-h, h) + f(-h, -h)) / (4 * h * h);
  }
  const m = mol.atoms.flatMap((a) => [a.m, a.m, a.m]);
  const F = H.map((r, i) => r.map((x, j) => x / Math.sqrt(m[i] * m[j])));
  const { values, vectors } = jacobiEigen(F);
  // 1302,8 — перевод √(мдин/(Å·а.е.м.)) в см⁻¹
  let modes = values.map((l, k) => ({ nu: Math.sign(l) * Math.sqrt(Math.abs(l)) * 1302.79, d: vectors[k].map((x, i) => x / Math.sqrt(m[i])) }))
    .filter((md) => md.nu > 150);
  // вырожденную пару (изгиб CO₂) поворачиваем: одна — в плоскости xy, другая — xz
  for (let k = 0; k + 1 < modes.length; k++) {
    if (Math.abs(modes[k].nu - modes[k + 1].nu) > 1) continue;
    const a = modes[k].d, b = modes[k + 1].d;
    const t = Math.atan2(a[2], -b[2]);
    const c = Math.cos(t), s = Math.sin(t);
    modes[k].d = a.map((x, i) => c * x + s * b[i]);
    modes[k + 1].d = a.map((x, i) => -s * x + c * b[i]);
    k++;
  }
  modes = modes.map((md) => {
    const mx = Math.max(...mol.atoms.map((_, i) => len(md.d.slice(3 * i, 3 * i + 3))));
    const d = md.d.map((x) => x / mx);
    // изменение дипольного момента в модели точечных зарядов
    const dmu = [0, 1, 2].map((c) => mol.atoms.reduce((s, a, i) => s + a.q * d[3 * i + c], 0));
    return { ...md, d, dmu: len(dmu) };
  });
  return modes;
}

// 3D: шарики и стержни, колеблющиеся по форме моды, + стрелки смещений
export function createModeScene(viewer) {
  const group = new THREE.Group();
  viewer.scene.add(group);
  let mol, mode, meshes = [], bonds = [], arrows = [], phase = 0, amp = 0.28;
  const bondMat = glossy(0xb8c2d8, { roughness: 0.45 });
  const toT = (p) => new THREE.Vector3(p[0], p[1], p[2]);
  function build(m) {
    mol = m;
    viewer.clear(group);
    meshes = mol.atoms.map((a) => { const s = new THREE.Mesh(sphereGeo(Math.max(0.24, COV_R[a.el] * 0.45), 32), glossy(CPK[a.el])); group.add(s); return s; });
    bonds = mol.bonds.map(([i, j]) => { const b = bondMesh([0, 0, 0], [0, 1, 0], 0.09, bondMat); group.add(b); return { b, i, j }; });
    arrows = mol.atoms.map(() => { const a = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(), 1, 0xffb000, 0.26, 0.18); group.add(a); return a; });
  }
  function place() {
    const s = Math.sin(phase) * amp;
    const pos = mol.atoms.map((a, i) => toT(a.p).add(mode ? toT(mode.d.slice(3 * i, 3 * i + 3)).multiplyScalar(s) : new THREE.Vector3()));
    meshes.forEach((m, i) => m.position.copy(pos[i]));
    bonds.forEach(({ b, i, j }) => {
      const d = pos[j].clone().sub(pos[i]);
      b.position.copy(pos[i]).add(pos[j]).multiplyScalar(0.5);
      b.scale.set(1, d.length(), 1);
      b.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
    });
    arrows.forEach((a, i) => {
      const v = mode ? toT(mode.d.slice(3 * i, 3 * i + 3)) : new THREE.Vector3();
      const L = v.length();
      a.visible = L > 0.05;
      if (!a.visible) return;
      a.position.copy(toT(mol.atoms[i].p));
      a.setDirection(v.clone().normalize());
      a.setLength(0.45 + L * 0.9, 0.26, 0.18);
    });
  }
  viewer.onFrame((dt) => {
    if (!mol) return;
    phase += dt * 5;
    place();
  });
  return {
    build,
    setMode(md) { mode = md; phase = Math.PI / 2; place(); },
  };
}
