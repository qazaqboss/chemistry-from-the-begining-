// Построение простых молекул «центральный атом + лиганды» по VSEPR
// (для уроков «Валентность» и «Как называют вещества»).
// Возвращает данные в формате createMolecule: { atoms:[{el,pos}], bonds:[[i,j,order]], lps:[[x,y,z]] }.
import { THREE, sphereGeo } from "./core.js";
import { COV_R } from "../data/molecules.js";

const R = { ...COV_R, Si: 1.11, P: 1.07, B: 0.84 };
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const norm = (a) => { const l = Math.hypot(...a) || 1; return mul(a, 1 / l); };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const DEG = Math.PI / 180;

// длина связи из ковалентных радиусов; кратные связи короче
export function bondLen(a, b, order = 1) {
  const k = order === 2 ? 0.87 : order === 3 ? 0.78 : 1;
  return ((R[a] ?? 0.75) + (R[b] ?? 0.75)) * k;
}

// Направления электронных пар: bonds связей + lp неподелённых пар.
// angle — реальный угол между связями (для молекул с неподелёнными парами).
export function pairDirs(nb, lp, angle) {
  const sn = nb + lp;
  if (sn === 1) return { b: [[1, 0, 0]], l: [] };
  if (sn === 2) return { b: [[-1, 0, 0], [1, 0, 0]].slice(0, nb), l: [] };
  if (sn === 3) {
    if (lp === 0) return { b: [90, 210, 330].map((d) => [Math.cos(d * DEG), Math.sin(d * DEG), 0]), l: [] };
    const h = ((angle || 119) * DEG) / 2; // угловая (SO₂)
    return { b: [[Math.sin(h), -Math.cos(h), 0], [-Math.sin(h), -Math.cos(h), 0]], l: [[0, 1, 0]] };
  }
  if (sn === 4) {
    if (lp === 0) return { b: [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]].map(norm), l: [] };
    if (lp === 1) {
      const t = (angle || 107) * DEG;
      const cosA = Math.sqrt((1 + 2 * Math.cos(t)) / 3), sinA = Math.sqrt(1 - cosA * cosA);
      return { b: [0, 1, 2].map((i) => [sinA * Math.cos((i * 2 * Math.PI) / 3), -cosA, sinA * Math.sin((i * 2 * Math.PI) / 3)]), l: [[0, 1, 0]] };
    }
    const h = ((angle || 104.5) * DEG) / 2;
    const lh = (114 * DEG) / 2;
    return {
      b: [[Math.sin(h), -Math.cos(h), 0], [-Math.sin(h), -Math.cos(h), 0]],
      l: [[0, Math.cos(lh), Math.sin(lh)], [0, Math.cos(lh), -Math.sin(lh)]],
    };
  }
  if (sn === 5) {
    const eq = [0, 120, 240].map((d) => [Math.cos(d * DEG), 0, Math.sin(d * DEG)]);
    const ax = [[0, 1, 0], [0, -1, 0]];
    if (lp === 0) return { b: [...ax, ...eq], l: [] };
    // «качели» (SF₄): неподелённая пара в экваторе
    return { b: [...ax, eq[1], eq[2]], l: [eq[0]] };
  }
  const six = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
  return { b: six.slice(0, nb), l: six.slice(nb) };
}

// center — символ; ligands — [{ el, order, h:true (группа –OH) }]
export function buildCentral(center, ligands, lp = 0, angle) {
  const atoms = [{ el: center, pos: [0, 0, 0] }];
  const bonds = [];
  const { b, l } = pairDirs(ligands.length, lp, angle);
  ligands.forEach((L, i) => {
    const d = b[i];
    const len = bondLen(center, L.el, L.order || 1);
    const p = mul(d, len);
    atoms.push({ el: L.el, pos: p });
    const li = atoms.length - 1;
    bonds.push([0, li, L.order || 1]);
    if (L.h) {
      // атом H на кислороде: угол C–O–H ≈ 106°
      let w = cross(d, [0, 1, 0.3]);
      w = norm(cross(w, d));
      const t = (180 - 106) * DEG;
      const hd = norm(add(mul(d, Math.cos(t)), mul(w, Math.sin(t))));
      atoms.push({ el: "H", pos: add(p, mul(hd, 0.97)) });
      bonds.push([li, atoms.length - 1, 1]);
    }
  });
  // центрирование
  const c = mul(atoms.reduce((s, a) => add(s, a.pos), [0, 0, 0]), 1 / atoms.length);
  atoms.forEach((a) => (a.pos = add(a.pos, mul(c, -1))));
  return { atoms, bonds, lps: l.map((d) => ({ dir: d, at: mul(c, -1) })) };
}

// Полупрозрачные «облачка» неподелённых пар
export function lonePairMeshes(data, color = 0x9fd0ff) {
  const g = new THREE.Group();
  const mat = new THREE.MeshPhysicalMaterial({ color, transparent: true, opacity: 0.28, roughness: 0.3, depthWrite: false });
  for (const lp of data.lps || []) {
    const m = new THREE.Mesh(sphereGeo(0.34, 24), mat);
    m.scale.set(1, 1.7, 1);
    const d = new THREE.Vector3(...lp.dir);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d);
    m.position.set(...lp.at).addScaledVector(d, 0.62);
    g.add(m);
  }
  return g;
}
