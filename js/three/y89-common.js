// Общие 3D-помощники для уроков 8–9 года (электролиты, ионы, гидролиз, неметаллы, азот, металлы).
// Ионы и молекулы как шаростержневые модели с общими (кэшированными) материалами и геометриями.
import { THREE, sphereGeo, glossy, textSprite } from "./core.js";
import { CPK, COV_R } from "../data/molecules.js";

export const COLORS = { ...CPK, Ba: 0xf5a524, Ca: 0xff9ec7, Ag: 0xc0c0c0, Zn: 0x7d80b0, Mg: 0x8aff00, Pb: 0x575961, Al: 0xbfa6a6, Sn: 0x668080, Hg: 0xb8b8d0, Au: 0xffd123, Ni: 0x50d050, Cr: 0x8a99c7 };
export const lerp = (a, b, t) => a + (b - a) * t;
export const lerpV = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
export const seg = (t, a, b) => Math.max(0, Math.min(1, (t - a) / (b - a)));
export const norm = (v) => { const l = Math.hypot(...v) || 1; return v.map((x) => x / l); };

// Детерминированный генератор случайных чисел — чтобы сцена не «прыгала» при перестройке
export function rng(seed = 1) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

export const TET = [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]].map(norm);
export const TRI = [0, 1, 2].map((i) => [Math.cos((i * 2 * Math.PI) / 3), Math.sin((i * 2 * Math.PI) / 3), 0]);

// Набор материалов/геометрий с кэшем: сотни молекул воды не создают сотни материалов
export function makeKit() {
  const mats = new Map(), geos = new Map();
  const kit = {
    mat(color, extra) {
      const key = color + (extra ? JSON.stringify(extra) : "");
      if (!mats.has(key)) mats.set(key, glossy(color, extra));
      return mats.get(key);
    },
    geo(r) {
      const k = r.toFixed(3);
      if (!geos.has(k)) geos.set(k, sphereGeo(r, 28));
      return geos.get(k);
    },
    bondMat: glossy(0xb8c2d8, { roughness: 0.45 }),
    cyl: new THREE.CylinderGeometry(1, 1, 1, 14, 1),
    atomR: (el) => Math.max(0.22, (COV_R[el] ?? 0.9) * 0.42),
    sphere(el, r, color) {
      const m = new THREE.Mesh(kit.geo(r ?? kit.atomR(el)), kit.mat(color ?? COLORS[el] ?? 0xff66cc));
      m.userData.el = el;
      return m;
    },
    // цилиндр-связь между точками a и b (в локальных координатах группы)
    bond(a, b, r = 0.08, mat) {
      const m = new THREE.Mesh(kit.cyl, mat || kit.bondMat);
      kit.placeBond(m, a, b, r);
      return m;
    },
    placeBond(m, a, b, r = 0.08) {
      const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b);
      const len = va.distanceTo(vb) || 0.0001;
      m.position.copy(va).add(vb).multiplyScalar(0.5);
      m.scale.set(r, len, r);
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.sub(va).normalize());
    },
  };
  return kit;
}

// Шаростержневая модель: atoms [{el, pos, r?, color?}], bonds [[i, j, order]]
export function ballStick(kit, atoms, bonds = [], { bondR = 0.08 } = {}) {
  const g = new THREE.Group();
  atoms.forEach((a) => {
    const m = kit.sphere(a.el, a.r, a.color);
    m.position.set(...a.pos);
    g.add(m);
  });
  for (const [i, j, order = 1] of bonds) {
    const A = atoms[i].pos, B = atoms[j].pos;
    const d = norm([B[0] - A[0], B[1] - A[1], B[2] - A[2]]);
    let off = [d[1] * 1 - d[2] * 0, d[2] * 0 - d[0] * 1, 0]; // d × z
    if (Math.hypot(...off) < 0.1) off = [0, d[2], -d[1]];
    off = norm(off);
    const gaps = order === 2 ? [-0.1, 0.1] : order === 3 ? [-0.15, 0, 0.15] : [0];
    for (const s of gaps) {
      const o = off.map((x) => x * s);
      g.add(kit.bond([A[0] + o[0], A[1] + o[1], A[2] + o[2]], [B[0] + o[0], B[1] + o[1], B[2] + o[2]], order === 1 ? bondR : bondR * 0.72));
    }
  }
  return g;
}

// Подпись над объектом
export function label(text, { size = 0.36, color = "#ffffff", bg = "rgba(10,14,30,0.7)" } = {}) {
  return textSprite(text, { size, color, bg });
}

// Молекула воды: O в начале координат, биссектриса угла H–O–H направлена по +x
export const WATER_H = [[0.587, 0.759, 0], [0.587, -0.759, 0]];
export function water(kit) {
  return ballStick(kit, [{ el: "O", pos: [0, 0, 0] }, { el: "H", pos: WATER_H[0] }, { el: "H", pos: WATER_H[1] }], [[0, 1], [0, 2]], { bondR: 0.07 });
}

// Центр + лиганды по направлениям
function star(center, lig, dirs, d, order = 1, extra = []) {
  const atoms = [{ el: center, pos: [0, 0, 0] }, ...dirs.map((v) => ({ el: lig, pos: v.map((x) => x * d) })), ...extra];
  return { atoms, bonds: dirs.map((_, i) => [0, i + 1, order]) };
}

// Ионы для тренажёров. scale — радиус «одноатомных» ионов (Å·0,5)
export const IONS = {
  "H+": { name: "H⁺", q: 1, model: () => ({ atoms: [{ el: "H", pos: [0, 0, 0], r: 0.26 }], bonds: [] }) },
  "Na+": { name: "Na⁺", q: 1, model: () => ({ atoms: [{ el: "Na", pos: [0, 0, 0], r: 0.5 }], bonds: [] }) },
  "K+": { name: "K⁺", q: 1, model: () => ({ atoms: [{ el: "K", pos: [0, 0, 0], r: 0.66 }], bonds: [] }) },
  "Ag+": { name: "Ag⁺", q: 1, model: () => ({ atoms: [{ el: "Ag", pos: [0, 0, 0], r: 0.56 }], bonds: [] }) },
  "Ba2+": { name: "Ba²⁺", q: 2, model: () => ({ atoms: [{ el: "Ba", pos: [0, 0, 0], r: 0.67 }], bonds: [] }) },
  "Ca2+": { name: "Ca²⁺", q: 2, model: () => ({ atoms: [{ el: "Ca", pos: [0, 0, 0], r: 0.5 }], bonds: [] }) },
  "Cu2+": { name: "Cu²⁺", q: 2, model: () => ({ atoms: [{ el: "Cu", pos: [0, 0, 0], r: 0.4, color: 0x2f8fff }], bonds: [] }) },
  "Fe3+": { name: "Fe³⁺", q: 3, model: () => ({ atoms: [{ el: "Fe", pos: [0, 0, 0], r: 0.36 }], bonds: [] }) },
  "NH4+": { name: "NH₄⁺", q: 1, model: () => star("N", "H", TET, 1.03) },
  "Cl-": { name: "Cl⁻", q: -1, model: () => ({ atoms: [{ el: "Cl", pos: [0, 0, 0], r: 0.9 }], bonds: [] }) },
  "OH-": { name: "OH⁻", q: -1, model: () => ({ atoms: [{ el: "O", pos: [0, 0, 0] }, { el: "H", pos: [0.97, 0, 0] }], bonds: [[0, 1]] }) },
  "NO3-": { name: "NO₃⁻", q: -1, model: () => star("N", "O", TRI, 1.25) },
  "SO42-": { name: "SO₄²⁻", q: -2, model: () => star("S", "O", TET, 1.49) },
  "CO32-": { name: "CO₃²⁻", q: -2, model: () => star("C", "O", TRI, 1.28) },
  "PO43-": { name: "PO₄³⁻", q: -3, model: () => star("P", "O", TET, 1.54) },
};

// Нейтральные продукты для анимаций
export const PRODUCTS = {
  H2O: () => ({ atoms: [{ el: "O", pos: [0, 0, 0] }, { el: "H", pos: WATER_H[0] }, { el: "H", pos: WATER_H[1] }], bonds: [[0, 1], [0, 2]] }),
  CO2: () => ({ atoms: [{ el: "C", pos: [0, 0, 0] }, { el: "O", pos: [1.16, 0, 0] }, { el: "O", pos: [-1.16, 0, 0] }], bonds: [[0, 1, 2], [0, 2, 2]] }),
  NH3: () => {
    const d = [[0.94, 0, -0.38], [-0.47, 0.814, -0.38], [-0.47, -0.814, -0.38]];
    return { atoms: [{ el: "N", pos: [0, 0, 0] }, ...d.map((v) => ({ el: "H", pos: v }))], bonds: [[0, 1], [0, 2], [0, 3]] };
  },
  H3PO4: () => {
    const m = star("P", "O", TET, 1.55);
    m.bonds[0][2] = 2;
    [2, 3, 4].forEach((i) => {
      // О–H под углом ≈ 110° к связи P–O
      const p = m.atoms[i].pos, n = norm(p);
      const w = norm([n[1] - n[2], n[2] - n[0], n[0] - n[1]]);
      const d = norm([n[0] * 0.34 + w[0] * 0.94, n[1] * 0.34 + w[1] * 0.94, n[2] * 0.34 + w[2] * 0.94]);
      m.atoms.push({ el: "H", pos: [p[0] + d[0] * 0.96, p[1] + d[1] * 0.96, p[2] + d[2] * 0.96] });
      m.bonds.push([i, m.atoms.length - 1]);
    });
    return m;
  },
};

export function ionGroup(kit, id, { withLabel = true, labelSize = 0.34 } = {}) {
  const I = IONS[id];
  const { atoms, bonds } = I.model();
  const g = ballStick(kit, atoms, bonds, { bondR: 0.07 });
  if (withLabel) {
    const top = Math.max(...atoms.map((a) => a.pos[1] + (a.r ?? kit.atomR(a.el))));
    const t = label(I.name, { size: labelSize, color: I.q > 0 ? "#ffd0d6" : "#cfe2ff" });
    t.position.set(0, top + 0.35, 0);
    g.add(t);
  }
  return g;
}

// Прозрачный «стакан» (цилиндр без крышки) с водой
export function beaker(radius = 4, height = 6, waterLevel = 0.8, tint = 0x4aa3ff) {
  const g = new THREE.Group();
  const glass = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, height, 48, 1, true),
    new THREE.MeshPhysicalMaterial({ color: 0xcfe6ff, transparent: true, opacity: 0.13, roughness: 0.05, side: THREE.DoubleSide, depthWrite: false })
  );
  g.add(glass);
  const wh = height * waterLevel;
  const liquid = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.985, radius * 0.985, wh, 48),
    new THREE.MeshPhysicalMaterial({ color: tint, transparent: true, opacity: 0.12, roughness: 0.2, depthWrite: false })
  );
  liquid.position.y = -height / 2 + wh / 2;
  g.add(liquid);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.04, 8, 64), new THREE.MeshBasicMaterial({ color: 0xbcd4ff, transparent: true, opacity: 0.5 }));
  rim.rotation.x = Math.PI / 2;
  rim.position.y = height / 2;
  g.add(rim);
  g.userData = { liquid, wh, height, radius };
  return g;
}
