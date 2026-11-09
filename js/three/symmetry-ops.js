// Операции симметрии как матрицы 3×3 и 3D-сцена, где молекула плавно
// поворачивается, отражается и инвертируется. Координаты «химические»:
// ось z — главная ось; в three.js она смотрит вверх: (x, y, z) → (x, z, −y).
import { THREE, sphereGeo, glossy, textSprite, easeInOut } from "./core.js";
import { CPK, COV_R } from "../data/molecules.js";
import { matMul } from "./qm-linalg.js";

const nrm = (v) => { const l = Math.hypot(...v); return v.map((x) => x / l); };
export function rotM(u, t) {
  const [x, y, z] = nrm(u), c = Math.cos(t), s = Math.sin(t), C = 1 - c;
  return [
    [c + x * x * C, x * y * C - z * s, x * z * C + y * s],
    [y * x * C + z * s, c + y * y * C, y * z * C - x * s],
    [z * x * C - y * s, z * y * C + x * s, c + z * z * C],
  ];
}
export function reflM(n, t = 1) {
  const v = nrm(n);
  return [0, 1, 2].map((i) => [0, 1, 2].map((j) => (i === j ? 1 : 0) - 2 * t * v[i] * v[j]));
}
const I3 = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
const scal = (k) => I3.map((r) => r.map((x) => x * k));

// Операция: kind = E | C | σ | i | S
export function opMatrix(o, t = 1) {
  switch (o.kind) {
    case "E": return I3;
    case "C": return rotM(o.axis, t * o.angle);
    case "σ": return reflM(o.normal, t);
    case "i": return scal(1 - 2 * t);
    case "S": return t < 0.5 ? rotM(o.axis, 2 * t * o.angle) : matMul(reflM(o.axis, 2 * t - 1), rotM(o.axis, o.angle));
  }
}

const deg = Math.PI / 180;
const C = (name, axis, n, k = 1, note = "") => ({ name, kind: "C", axis, angle: (2 * Math.PI * k) / n, note });
const SIG = (name, normal, note = "") => ({ name, kind: "σ", normal, note });
const S = (name, axis, n, k = 1, note = "") => ({ name, kind: "S", axis, angle: (2 * Math.PI * k) / n, note });
const E = { name: "E", kind: "E", note: "тождественная операция: ничего не делать" };
const INV = { name: "i", kind: "i", note: "инверсия через центр: r → −r" };

const tet = 1.09 / Math.sqrt(3);
const nh = (k) => [0.94 * Math.cos((k * 120) * deg), 0.94 * Math.sin((k * 120) * deg), -0.11];
const ring = (r, z = 0) => Array.from({ length: 6 }, (_, k) => [r * Math.cos(k * 60 * deg), r * Math.sin(k * 60 * deg), z]);

export const SYM_MOLS = {
  h2o: {
    label: "H₂O", group: "C₂v", order: 4,
    atoms: [["O", [0, 0, 0.12]], ["H", [0, 0.757, -0.466]], ["H", [0, -0.757, -0.466]]],
    bonds: [[0, 1], [0, 2]],
    ops: [E, C("C₂(z)", [0, 0, 1], 2, 1, "поворот на 180° вокруг оси z"), SIG("σᵥ(xz)", [0, 1, 0], "плоскость xz, перпендикулярная молекуле"), SIG("σᵥ′(yz)", [1, 0, 0], "плоскость молекулы yz")],
  },
  nh3: {
    label: "NH₃", group: "C₃v", order: 6,
    atoms: [["N", [0, 0, 0.27]], ["H", nh(0)], ["H", nh(1)], ["H", nh(2)]],
    bonds: [[0, 1], [0, 2], [0, 3]],
    ops: [E, C("C₃", [0, 0, 1], 3, 1, "поворот на 120°"), C("C₃²", [0, 0, 1], 3, 2, "поворот на 240°"),
      SIG("σᵥ(1)", [0, 1, 0], "через H1 и ось"), SIG("σᵥ(2)", [-Math.sin(120 * deg), Math.cos(120 * deg), 0], "через H2"), SIG("σᵥ(3)", [-Math.sin(240 * deg), Math.cos(240 * deg), 0], "через H3")],
  },
  ch4: {
    label: "CH₄", group: "T_d", order: 24,
    atoms: [["C", [0, 0, 0]], ["H", [tet, tet, tet]], ["H", [tet, -tet, -tet]], ["H", [-tet, tet, -tet]], ["H", [-tet, -tet, tet]]],
    bonds: [[0, 1], [0, 2], [0, 3], [0, 4]],
    ops: [E, C("C₃ (1,1,1)", [1, 1, 1], 3, 1, "ось через связь C–H1; таких осей 4, операций 8C₃"), C("C₂(z)", [0, 0, 1], 2, 1, "ось через середины противоположных рёбер куба: 3C₂"),
      S("S₄(z)", [0, 0, 1], 4, 1, "поворот на 90° и отражение в плоскости xy: 6S₄"), SIG("σd", [1, -1, 0], "плоскость через C, H1 и H4: 6σd")],
  },
  c6h6: {
    label: "C₆H₆", group: "D₆h", order: 24,
    atoms: [...ring(1.39).map((p) => ["C", p]), ...ring(2.47).map((p) => ["H", p])],
    bonds: [...Array.from({ length: 6 }, (_, k) => [k, (k + 1) % 6]), ...Array.from({ length: 6 }, (_, k) => [k, k + 6])],
    ops: [E, C("C₆", [0, 0, 1], 6, 1, "поворот на 60°"), C("C₃", [0, 0, 1], 3, 1, "поворот на 120°"), C("C₂(z)", [0, 0, 1], 2, 1, "поворот на 180° вокруг главной оси"),
      C("C₂′", [1, 0, 0], 2, 1, "ось в плоскости через атомы C1 и C4"), C("C₂″", [Math.cos(30 * deg), Math.sin(30 * deg), 0], 2, 1, "ось через середины связей"),
      INV, SIG("σh", [0, 0, 1], "плоскость молекулы"), SIG("σᵥ", [0, 1, 0], "через атомы C1, C4 и ось z"), SIG("σd", [-Math.sin(30 * deg), Math.cos(30 * deg), 0], "через середины связей и ось z"),
      S("S₆", [0, 0, 1], 6, 1, "поворот на 60° + σh"), S("S₃", [0, 0, 1], 3, 1, "поворот на 120° + σh")],
  },
};

const toT = (p) => new THREE.Vector3(p[0], p[2], -p[1]);

export function createSymScene(viewer) {
  const group = new THREE.Group();
  viewer.scene.add(group);
  const elemGroup = new THREE.Group();
  viewer.scene.add(elemGroup);
  const bondMat = glossy(0xb8c2d8, { roughness: 0.45 });
  const bondGeo = new THREE.CylinderGeometry(0.08, 0.08, 1, 16);
  let mol, base, cur, meshes = [], bonds = [], labels = [], anim = null;

  function place() {
    meshes.forEach((m, i) => m.position.copy(toT(cur[i])));
    labels.forEach((l, i) => l && l.position.copy(toT(cur[i])).add(new THREE.Vector3(0, 0.42, 0)));
    const up = new THREE.Vector3(0, 1, 0);
    bonds.forEach(({ m, a, b }) => {
      const A = toT(cur[a]), B = toT(cur[b]);
      const d = B.clone().sub(A);
      m.position.copy(A).add(B).multiplyScalar(0.5);
      m.scale.set(1, d.length(), 1);
      m.quaternion.setFromUnitVectors(up, d.normalize());
    });
  }
  function setMolecule(key) {
    mol = SYM_MOLS[key];
    viewer.clear(group);
    base = mol.atoms.map((a) => a[1].slice());
    cur = base.map((p) => p.slice());
    meshes = mol.atoms.map(([el]) => { const m = new THREE.Mesh(sphereGeo(Math.max(0.22, COV_R[el] * 0.42), 32), glossy(CPK[el])); group.add(m); return m; });
    bonds = mol.bonds.map(([a, b]) => { const m = new THREE.Mesh(bondGeo, bondMat); group.add(m); return { m, a, b }; });
    let hN = 0, cN = 0;
    labels = mol.atoms.map(([el]) => {
      if (key === "c6h6" && el === "H") return null;
      const n = el === "H" ? ++hN : el === "C" && key === "c6h6" ? ++cN : 0;
      if (!n) return null;
      const t = textSprite(`${el}${n}`, { size: 0.3, bg: el === "H" ? "rgba(40,90,200,0.85)" : "rgba(10,14,30,0.75)" });
      group.add(t);
      return t;
    });
    viewer.clear(elemGroup);
    anim = null;
    place();
    return mol;
  }
  function showElement(o) {
    viewer.clear(elemGroup);
    const R = mol === SYM_MOLS.c6h6 ? 3.1 : 1.45;
    const yellow = new THREE.MeshBasicMaterial({ color: 0xffc23d, transparent: true, opacity: 0.9 });
    if (o.kind === "C" || o.kind === "S") {
      const ax = toT(nrm(o.axis));
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 2 * R, 10), yellow);
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), ax);
      elemGroup.add(m);
    }
    if (o.kind === "σ" || o.kind === "S") {
      const n = toT(nrm(o.kind === "S" ? o.axis : o.normal));
      const p = new THREE.Mesh(new THREE.CircleGeometry(R * 0.95, 48), new THREE.MeshBasicMaterial({ color: 0x6ea8ff, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false }));
      p.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
      elemGroup.add(p);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(R * 0.95, 0.015, 6, 64), new THREE.MeshBasicMaterial({ color: 0x6ea8ff }));
      ring.quaternion.copy(p.quaternion);
      elemGroup.add(ring);
    }
    if (o.kind === "i") elemGroup.add(new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 12), yellow));
  }
  viewer.onFrame((dt) => {
    if (!anim) return;
    anim.t = dt === 0 ? 1 : Math.min(1, anim.t + dt / anim.dur);
    const M = opMatrix(anim.op, easeInOut(anim.t));
    cur = anim.start.map((p) => M.map((r) => r[0] * p[0] + r[1] * p[1] + r[2] * p[2]));
    place();
    if (anim.t >= 1) {
      // привязка к исходным положениям: молекула совпала сама с собой
      cur = cur.map((p) => base.reduce((a, b) => (Math.hypot(b[0] - p[0], b[1] - p[1], b[2] - p[2]) < Math.hypot(a[0] - p[0], a[1] - p[1], a[2] - p[2]) ? b : a)).slice());
      place();
      const done = anim.done;
      anim = null;
      done?.();
    }
  });
  return {
    setMolecule, showElement,
    apply(o, done) {
      showElement(o);
      if (o.kind === "E") { done?.(); return; }
      anim = { op: o, t: 0, dur: o.kind === "S" ? 2.4 : 1.6, start: cur.map((p) => p.slice()), done };
    },
    reset() { cur = base.map((p) => p.slice()); anim = null; place(); },
    busy: () => !!anim,
    // какой атом (по номеру) стоит сейчас на месте исходного атома k
    perm() { return base.map((b) => cur.findIndex((p) => Math.hypot(b[0] - p[0], b[1] - p[1], b[2] - p[2]) < 1e-3)); },
  };
}
