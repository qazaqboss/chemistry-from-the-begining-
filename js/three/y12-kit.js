// Общие 3D-помощники для уроков 1–2 года (matter, mixtures, water, air, fire, rocks, kitchen).
import { THREE, sphereGeo, glossy, bondMesh } from "./core.js";
import { CPK, COV_R } from "../data/molecules.js";

// Детерминированный генератор случайных чисел (одинаковая картинка при каждом запуске)
export function rng(seed = 1) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

const matCache = new Map();
export function atomMat(el) {
  if (!matCache.has(el)) matCache.set(el, glossy(CPK[el] ?? 0xff66cc));
  return matCache.get(el);
}
const bondMat = glossy(0xb8c2d8, { roughness: 0.45 });

// Шаростержневая молекула в собственной группе. atoms: [{el, pos}], bonds: [[i, j, order]]
export function makeMol(atoms, bonds = [], { k = 0.42, min = 0.2, bond = 0.08, own = false } = {}) {
  const g = new THREE.Group();
  const mat = (el) => (own ? glossy(CPK[el] ?? 0xff66cc) : atomMat(el));
  for (const a of atoms) {
    const r = Math.max(min, (COV_R[a.el] ?? 0.7) * k);
    const m = new THREE.Mesh(sphereGeo(r, 24), mat(a.el));
    m.position.set(...a.pos);
    g.add(m);
  }
  const bm = own ? bondMat.clone() : bondMat;
  for (const [i, j, order = 1] of bonds) {
    const A = atoms[i].pos, B = atoms[j].pos;
    const d = new THREE.Vector3(B[0] - A[0], B[1] - A[1], B[2] - A[2]).normalize();
    let off = new THREE.Vector3().crossVectors(d, new THREE.Vector3(0, 0, 1));
    if (off.lengthSq() < 0.01) off = new THREE.Vector3().crossVectors(d, new THREE.Vector3(0, 1, 0));
    off.normalize();
    const gaps = order === 2 ? [-0.1, 0.1] : order === 3 ? [-0.14, 0, 0.14] : [0];
    for (const gp of gaps) {
      const o = off.clone().multiplyScalar(gp);
      g.add(bondMesh([A[0] + o.x, A[1] + o.y, A[2] + o.z], [B[0] + o.x, B[1] + o.y, B[2] + o.z], order === 1 ? bond : bond * 0.72, bm));
    }
  }
  return g;
}

// Готовые молекулы с настоящей геометрией (Å)
const HOH = (104.5 * Math.PI) / 180;
export const GEOM = {
  H2O: { atoms: [{ el: "O", pos: [0, 0, 0] }, { el: "H", pos: [Math.sin(HOH / 2) * 0.96, -Math.cos(HOH / 2) * 0.96, 0] }, { el: "H", pos: [-Math.sin(HOH / 2) * 0.96, -Math.cos(HOH / 2) * 0.96, 0] }], bonds: [[0, 1, 1], [0, 2, 1]] },
  N2: { atoms: [{ el: "N", pos: [-0.55, 0, 0] }, { el: "N", pos: [0.55, 0, 0] }], bonds: [[0, 1, 3]] },
  O2: { atoms: [{ el: "O", pos: [-0.605, 0, 0] }, { el: "O", pos: [0.605, 0, 0] }], bonds: [[0, 1, 2]] },
  CO2: { atoms: [{ el: "C", pos: [0, 0, 0] }, { el: "O", pos: [-1.16, 0, 0] }, { el: "O", pos: [1.16, 0, 0] }], bonds: [[0, 1, 2], [0, 2, 2]] },
  CO: { atoms: [{ el: "C", pos: [-0.56, 0, 0] }, { el: "O", pos: [0.57, 0, 0] }], bonds: [[0, 1, 3]] },
};
export const mol = (id, opts) => makeMol(GEOM[id].atoms, GEOM[id].bonds, opts);

// Заполненная (без стержней) маленькая молекула — для «толпы» частиц
export function blobMol(id, scale = 0.5) {
  const g = new THREE.Group();
  for (const a of GEOM[id].atoms) {
    const r = (a.el === "H" ? 0.55 : 0.85) * scale;
    const m = new THREE.Mesh(sphereGeo(r, 16), atomMat(a.el));
    m.position.set(a.pos[0] * scale * 1.1, a.pos[1] * scale * 1.1, a.pos[2] * scale * 1.1);
    g.add(m);
  }
  return g;
}

// Прозрачный стакан/цилиндр с контуром
export function glass(r, hgt, { color = 0x9fd8ff, opacity = 0.1, open = true } = {}) {
  const g = new THREE.Group();
  const wall = new THREE.Mesh(
    new THREE.CylinderGeometry(r, r, hgt, 48, 1, open),
    new THREE.MeshPhysicalMaterial({ color, transparent: true, opacity, roughness: 0.05, side: THREE.DoubleSide, depthWrite: false })
  );
  const ringMat = new THREE.LineBasicMaterial({ color: 0x8fb8ff, transparent: true, opacity: 0.7 });
  const ring = (y) => {
    const pts = [];
    for (let i = 0; i <= 64; i++) { const a = (i / 64) * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r)); }
    return new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), ringMat);
  };
  const bottom = new THREE.Mesh(new THREE.CircleGeometry(r, 48), wall.material);
  bottom.rotation.x = -Math.PI / 2; bottom.position.y = -hgt / 2;
  g.add(wall, ring(hgt / 2), ring(-hgt / 2), bottom);
  return g;
}

// Плавно задать прозрачность всем материалам группы (материалы клонируются один раз)
export function setOpacity(group, a) {
  group.visible = a > 0.01;
  group.traverse((o) => {
    if (!o.material) return;
    if (!o.userData.ownMat) { o.material = o.material.clone(); o.userData.ownMat = true; o.userData.baseOp = o.material.opacity ?? 1; }
    o.material.transparent = true;
    o.material.opacity = o.userData.baseOp * a;
    o.material.depthWrite = a > 0.98;
  });
}

// Пунктирные линии (водородные связи и т. п.) с заранее выделенным буфером
export function dashLines(max, color = 0x7fd3ff, opacity = 0.85) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(max * 6), 3));
  geo.setDrawRange(0, 0);
  const mat = new THREE.LineDashedMaterial({ color, dashSize: 0.18, gapSize: 0.12, transparent: true, opacity });
  const lines = new THREE.LineSegments(geo, mat);
  lines.frustumCulled = false;
  return {
    lines,
    set(pairs) {
      const arr = geo.attributes.position.array;
      let n = 0;
      for (const [a, b] of pairs) {
        if (n >= max) break;
        arr.set([a.x, a.y, a.z, b.x, b.y, b.z], n * 6);
        n++;
      }
      geo.attributes.position.needsUpdate = true;
      geo.setDrawRange(0, n * 2);
      lines.computeLineDistances();
    },
  };
}

// Контрол «ползунок» в карточке: возвращает {el, input, out}
export function lerp(a, b, t) { return a + (b - a) * t; }

export const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
