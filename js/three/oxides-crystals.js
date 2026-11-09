// Строение оксидов: молекулярный кристалл CO₂ (сухой лёд), атомная сетка SiO₂ (кристобалит),
// ионная решётка CaO (тип NaCl), фрагмент корунда Al₂O₃. Координаты — в ангстремах из реальных параметров решёток.
import { THREE, sphereGeo, glossy } from "./core.js";
import { CPK } from "../data/molecules.js";

const S = 0.55; // ангстрем → единицы сцены
const R = { O: 0.42, C: 0.36, Si: 0.42, Ca: 0.62, Al: 0.36 }; // радиусы шаров (Å, для наглядности)

function cube(n, basis, a) {
  const out = [];
  for (let i = 0; i <= n; i++) for (let j = 0; j <= n; j++) for (let k = 0; k <= n; k++)
    for (const [el, f] of basis) {
      const p = [(i + f[0]) * a, (j + f[1]) * a, (k + f[2]) * a];
      if (p.some((x) => x > n * a + 1e-3)) continue;
      out.push({ el, p });
    }
  return out;
}

export const OXIDE_MODELS = {
  CO2: {
    title: "Сухой лёд CO₂", kind: "молекулярная решётка", note: "В узлах — целые молекулы O=C=O (длина связи 1,16 Å), между молекулами лишь слабые силы. Поэтому CO₂ — газ, а твёрдый «сухой лёд» уже при −78,5 °C испаряется, минуя жидкость (возгонка).",
    build() {
      // решётка Pa3, a = 5,62 Å: молекулы в позициях ГЦК, оси вдоль диагоналей куба
      const a = 5.62, d = 1.16, atoms = [], bonds = [];
      const sites = [[[0, 0, 0], [1, 1, 1]], [[0.5, 0.5, 0], [1, -1, -1]], [[0.5, 0, 0.5], [-1, 1, -1]], [[0, 0.5, 0.5], [-1, -1, 1]]];
      for (let i = 0; i <= 1; i++) for (let j = 0; j <= 1; j++) for (let k = 0; k <= 1; k++) for (const [f, ax] of sites) {
        const c = [(i + f[0]) * a, (j + f[1]) * a, (k + f[2]) * a];
        if (c.some((x) => x > a + 1e-3)) continue;
        const l = Math.hypot(...ax), u = ax.map((x) => (x / l) * d);
        const ci = atoms.push({ el: "C", p: c }) - 1;
        bonds.push([ci, atoms.push({ el: "O", p: c.map((x, q) => x + u[q]) }) - 1, 2]);
        bonds.push([ci, atoms.push({ el: "O", p: c.map((x, q) => x - u[q]) }) - 1, 2]);
      }
      return { atoms, bonds };
    },
  },
  SiO2: {
    title: "Кремнезём SiO₂", kind: "атомная (ковалентная) решётка", note: "Каждый атом кремния связан с четырьмя атомами кислорода (тетраэдр SiO₄), каждый кислород — мостик между двумя Si. Отдельных молекул нет: весь кристалл — одна гигантская сетка. Отсюда твёрдость и t пл ≈ 1700 °C. Показан кристобалит; в кварце те же тетраэдры уложены спиралями.",
    build() {
      const a = 7.16;
      const si = cube(1, [["Si", [0, 0, 0]], ["Si", [0.5, 0.5, 0]], ["Si", [0.5, 0, 0.5]], ["Si", [0, 0.5, 0.5]], ["Si", [0.25, 0.25, 0.25]], ["Si", [0.75, 0.75, 0.25]], ["Si", [0.75, 0.25, 0.75]], ["Si", [0.25, 0.75, 0.75]]], a);
      // у каждого Si — полный тетраэдр SiO₄; кислород-мостик посередине Si–Si (Si–O ≈ 1,55 Å)
      const atoms = [...si], bonds = [], seen = new Map();
      const T = [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]];
      si.forEach((s, i) => {
        const f = s.p.map((x) => ((x / a) * 4) % 2); // подрешётка: у «внутренних» атомов координаты нечётные в четвертях
        const sgn = Math.round(f[0]) % 2 ? -1 : 1;
        for (const t of T) {
          const p = s.p.map((x, q) => x + (sgn * t[q] * a) / 8);
          const key = p.map((x) => x.toFixed(2)).join();
          if (!seen.has(key)) seen.set(key, atoms.push({ el: "O", p }) - 1);
          bonds.push([i, seen.get(key), 1]);
        }
      });
      return { atoms, bonds };
    },
  },
  CaO: {
    title: "Негашёная известь CaO", kind: "ионная решётка", note: "Ионы Ca²⁺ и O²⁻ чередуются, как в поваренной соли: у каждого иона шесть соседей противоположного знака (a = 4,81 Å). Заряды 2+ и 2− притягиваются вчетверо сильнее, чем 1+ и 1−, поэтому t пл ≈ 2613 °C.",
    build() {
      const a = 4.81;
      const atoms = cube(2, [["O", [0, 0, 0]], ["O", [0.5, 0.5, 0]], ["O", [0.5, 0, 0.5]], ["O", [0, 0.5, 0.5]], ["Ca", [0.5, 0, 0]], ["Ca", [0, 0.5, 0]], ["Ca", [0, 0, 0.5]], ["Ca", [0.5, 0.5, 0.5]]], a);
      return { atoms, bonds: byDistance(atoms, "Ca", "O", a / 2 + 0.05) };
    },
  },
  Al2O3: {
    title: "Корунд Al₂O₃", kind: "ионно-ковалентная решётка", note: "Слои ионов O²⁻ уложены плотнейшей гексагональной упаковкой, ионы Al³⁺ занимают 2/3 октаэдрических пустот между слоями (Al–O ≈ 1,9 Å). Корунд — второй по твёрдости минерал после алмаза; рубин и сапфир — это корунд с примесями Cr и Fe/Ti.",
    build() {
      const d = 2.75, hL = 2.165, atoms = [];
      const site = (i, j, off) => [(i + off + (j + off) / 2) * d, ((j + off) * d * Math.sqrt(3)) / 2];
      const N = 4, inPatch = (x, z) => Math.hypot(x, z) < 6.4;
      for (let L = 0; L < 4; L++) {
        const off = L % 2 ? 1 / 3 : 0;
        for (let i = -N; i <= N; i++) for (let j = -N; j <= N; j++) {
          const [x, z] = site(i, j, off);
          if (inPatch(x, z)) atoms.push({ el: "O", p: [x, L * hL, z] });
          if (L < 3 && ((i - j) % 3 + 3) % 3 !== L % 3) {
            const [ax, az] = site(i, j, 2 / 3);
            if (inPatch(ax, az)) atoms.push({ el: "Al", p: [ax, L * hL + hL / 2, az] });
          }
        }
      }
      return { atoms, bonds: byDistance(atoms, "Al", "O", 2.05) };
    },
  },
};

function byDistance(atoms, A, B, max) {
  const out = [];
  atoms.forEach((x, i) => { if (x.el !== A) return; atoms.forEach((y, j) => { if (y.el === B && Math.hypot(...x.p.map((v, q) => v - y.p[q])) < max) out.push([i, j, 1]); }); });
  return out;
}

export function createOxideViewer(viewer) {
  const g = new THREE.Group();
  viewer.scene.add(g);
  let radius = 5;
  return {
    show(id) {
      viewer.clear(g);
      const { atoms, bonds } = OXIDE_MODELS[id].build();
      const c = [0, 1, 2].map((q) => atoms.reduce((s, a) => s + a.p[q], 0) / atoms.length);
      const P = atoms.map((a) => new THREE.Vector3(...a.p.map((x, q) => (x - c[q]) * S)));
      radius = Math.max(...P.map((p) => p.length())) + 0.8;
      const byEl = {};
      atoms.forEach((a, i) => (byEl[a.el] ||= []).push(i));
      const m4 = new THREE.Matrix4();
      for (const [el, idx] of Object.entries(byEl)) {
        const im = new THREE.InstancedMesh(sphereGeo(R[el] * S * 1.25, 28), glossy(CPK[el]), idx.length);
        idx.forEach((i, k) => im.setMatrixAt(k, m4.makeTranslation(P[i].x, P[i].y, P[i].z)));
        g.add(im);
      }
      const geo = new THREE.CylinderGeometry(0.06, 0.06, 1, 10);
      const im = new THREE.InstancedMesh(geo, glossy(0xb8c2d8, { roughness: 0.45 }), bonds.length);
      const up = new THREE.Vector3(0, 1, 0), q = new THREE.Quaternion(), sc = new THREE.Vector3();
      bonds.forEach(([i, j], k) => {
        const d = P[j].clone().sub(P[i]);
        q.setFromUnitVectors(up, d.clone().normalize());
        sc.set(1, d.length(), 1);
        im.setMatrixAt(k, m4.compose(P[i].clone().add(P[j]).multiplyScalar(0.5), q, sc));
      });
      g.add(im);
      return OXIDE_MODELS[id];
    },
    radius: () => radius,
  };
}
