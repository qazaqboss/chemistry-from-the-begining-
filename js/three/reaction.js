// Анимация реакции: старые связи рвутся, атомы перестраиваются, новые связи возникают.
// Число атомов каждого вида до и после одинаково — закон сохранения массы виден глазами.
import { THREE, sphereGeo, glossy, glowSprite, easeInOut, clamp01 } from "./core.js";
import { CPK, COV_R } from "../data/molecules.js";

// Вспомогательные позиции
const water = (cx, cy, rot = 0) => {
  const h = (104.5 * Math.PI) / 360, L = 0.96;
  const pts = [[0, 0], [Math.sin(h) * L, -Math.cos(h) * L], [-Math.sin(h) * L, -Math.cos(h) * L]];
  return pts.map(([x, y]) => [cx + x * Math.cos(rot) - y * Math.sin(rot), cy + x * Math.sin(rot) + y * Math.cos(rot), 0]);
};

export const REACTIONS = [
  {
    id: "water",
    eq: "2H₂ + O₂ → 2H₂O",
    name: "Горение водорода",
    note: "Водород сгорает в кислороде, образуя воду. Выделяется много тепла — так работают водородные двигатели ракет.",
    atoms: (() => {
      const w1 = water(1.6, 1.2, 0), w2 = water(1.6, -1.4, 0);
      return [
        { el: "H", from: [-3.6, 1.6, 0], to: w1[1] },
        { el: "H", from: [-2.86, 1.6, 0], to: w1[2] },
        { el: "H", from: [-3.6, -1.6, 0], to: w2[1] },
        { el: "H", from: [-2.86, -1.6, 0], to: w2[2] },
        { el: "O", from: [-0.6, 0, 0], to: w1[0] },
        { el: "O", from: [0.61, 0, 0], to: w2[0] },
      ];
    })(),
    before: [[0, 1, 1], [2, 3, 1], [4, 5, 2]],
    after: [[4, 0, 1], [4, 1, 1], [5, 2, 1], [5, 3, 1]],
  },
  {
    id: "hcl",
    eq: "H₂ + Cl₂ → 2HCl",
    name: "Синтез хлороводорода",
    note: "На свету водород и хлор реагируют со взрывом. Растворив HCl в воде, получают соляную кислоту.",
    atoms: [
      { el: "H", from: [-2.6, 0.37, 0], to: [0.2, 1.3, 0] },
      { el: "H", from: [-2.6, -0.37, 0], to: [0.2, -1.3, 0] },
      { el: "Cl", from: [1.6, 1.0, 0], to: [1.47, 1.3, 0] },
      { el: "Cl", from: [1.6, -1.0, 0], to: [1.47, -1.3, 0] },
    ],
    before: [[0, 1, 1], [2, 3, 1]],
    after: [[0, 2, 1], [1, 3, 1]],
  },
  {
    id: "methane",
    eq: "CH₄ + 2O₂ → CO₂ + 2H₂O",
    name: "Горение метана (природного газа)",
    note: "Так горит газ на кухонной плите: из метана и кислорода получаются углекислый газ и вода.",
    atoms: (() => {
      const t = [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]].map((v) => v.map((c) => (c / Math.sqrt(3)) * 1.09));
      const C0 = [-3.2, 0, 0];
      const w1 = water(2.4, 2.0, 0), w2 = water(2.4, -1.6, 0);
      return [
        { el: "C", from: C0, to: [-0.2, 0, 0] },
        ...t.map((v, i) => ({ el: "H", from: [C0[0] + v[0], C0[1] + v[1], C0[2] + v[2]], to: [w1[1], w1[2], w2[1], w2[2]][i] })),
        { el: "O", from: [0.4, 1.8, 0], to: [-1.36, 0, 0] },
        { el: "O", from: [1.61, 1.8, 0], to: [0.96, 0, 0] },
        { el: "O", from: [0.4, -1.8, 0], to: w1[0] },
        { el: "O", from: [1.61, -1.8, 0], to: w2[0] },
      ];
    })(),
    before: [[0, 1, 1], [0, 2, 1], [0, 3, 1], [0, 4, 1], [5, 6, 2], [7, 8, 2]],
    after: [[0, 5, 2], [0, 6, 2], [7, 1, 1], [7, 2, 1], [8, 3, 1], [8, 4, 1]],
  },
];

export function createReaction(viewer) {
  const group = new THREE.Group();
  viewer.scene.add(group);
  let R = null, t = 0;
  let atomMeshes = [], bondMeshes = [], flash = null;
  const bondMat = new THREE.MeshPhysicalMaterial({ color: 0xc7d2ea, roughness: 0.4, transparent: true });
  const unitCyl = new THREE.CylinderGeometry(1, 1, 1, 16);

  function load(id) {
    viewer.clear(group);
    R = REACTIONS.find((r) => r.id === id) || REACTIONS[0];
    atomMeshes = R.atoms.map((a) => {
      const m = new THREE.Mesh(sphereGeo(Math.max(0.24, (COV_R[a.el] || 0.7) * 0.45), 32), glossy(CPK[a.el]));
      group.add(m);
      return m;
    });
    const mkBonds = (list, tag) => list.flatMap(([i, j, order]) => {
      const out = [];
      for (let k = 0; k < order; k++) {
        const mesh = new THREE.Mesh(unitCyl, bondMat.clone());
        mesh.userData = { i, j, k, order, tag };
        group.add(mesh);
        out.push(mesh);
      }
      return out;
    });
    bondMeshes = [...mkBonds(R.before, "before"), ...mkBonds(R.after, "after")];
    flash = glowSprite(0xffc46b, 0.1, 0);
    group.add(flash);
    setT(t);
    return R;
  }

  // 0…0.35 сближение, 0.35…0.55 разрыв старых связей, 0.55…1 сборка продуктов
  function posAt(a, tt) {
    const mid = a.from.map((c, k) => (c + a.to[k]) / 2);
    const exploded = mid.map((c, k) => c * 1.35 + (k === 2 ? Math.sin(c * 3) * 0.6 : 0));
    const approach = a.from.map((c, k) => c * 0.82);
    let p;
    if (tt < 0.35) { const u = easeInOut(tt / 0.35); p = a.from.map((c, k) => c + (approach[k] - c) * u); }
    else if (tt < 0.55) { const u = easeInOut((tt - 0.35) / 0.2); p = approach.map((c, k) => c + (exploded[k] - c) * u); }
    else { const u = easeInOut((tt - 0.55) / 0.45); p = exploded.map((c, k) => c + (a.to[k] - c) * u); }
    return new THREE.Vector3(...p);
  }

  function setT(tt) {
    t = clamp01(tt);
    if (!R) return;
    const P = R.atoms.map((a) => posAt(a, t));
    atomMeshes.forEach((m, i) => m.position.copy(P[i]));
    const beforeA = 1 - clamp01((t - 0.36) / 0.1);
    const afterA = clamp01((t - 0.72) / 0.18);
    for (const b of bondMeshes) {
      const { i, j, k, order, tag } = b.userData;
      const A = P[i], Bv = P[j];
      const d = Bv.clone().sub(A);
      const len = d.length();
      const dir = d.clone().normalize();
      let off = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 0, 1)).normalize();
      const g = order === 1 ? 0 : (k - (order - 1) / 2) * 0.2;
      const alpha = tag === "before" ? beforeA : afterA;
      b.visible = alpha > 0.01;
      b.material.opacity = alpha;
      const rad = order === 1 ? 0.085 : 0.06;
      b.scale.set(rad, len * (0.6 + 0.4 * alpha), rad);
      b.position.copy(A).add(Bv).multiplyScalar(0.5).addScaledVector(off, g);
      b.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    }
    // вспышка энергии в момент перестройки
    const f = Math.max(0, 1 - Math.abs(t - 0.6) / 0.15);
    flash.material.opacity = f * 0.9;
    flash.scale.setScalar(0.1 + f * 7);
  }

  return { load, setT, get t() { return t; } };
}
