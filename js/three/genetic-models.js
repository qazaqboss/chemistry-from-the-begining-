// Модели участников генетических рядов кальция и серы (длины связей в ангстремах).
// Каждая частица — одна формульная единица, чтобы атомы можно было пересчитать по уравнению.
// Ионные соединения: ионы рядом, без палочек-связей между катионом и анионом.
import { THREE, textSprite } from "./core.js";
import { createMolecule } from "./molecule.js";
import { MOLECULES } from "../data/molecules.js";

const D = Math.PI / 180;
const M = (atoms, bonds = []) => {
  const c = [0, 1, 2].map((q) => atoms.reduce((s, a) => s + a.pos[q], 0) / atoms.length);
  return { atoms: atoms.map((a) => ({ el: a.el, pos: a.pos.map((x, q) => x - c[q]) })), bonds };
};
const at = (el, x, y = 0, z = 0) => ({ el, pos: [x, y, z] });
const tetra = (cx, len) => [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]].map((d) => d.map((v, q) => cx[q] + (v / Math.sqrt(3)) * len));
const so4 = (cx = [0, 0, 0], el = "S") => { const o = tetra(cx, 1.47); return [at(el, ...cx), ...o.map((p) => at("O", ...p))]; };
const so4Bonds = (s) => [1, 2, 3, 4].map((k) => [s, s + k, k < 3 ? 2 : 1]);

export const MODELS = {
  Ca: () => M([at("Ca", 0)]),
  O2: () => M([at("O", 0), at("O", 1.21)], [[0, 1, 2]]),
  H2O: () => M([at("O", 0), at("H", Math.sin(52.25 * D) * 0.96, -Math.cos(52.25 * D) * 0.96), at("H", -Math.sin(52.25 * D) * 0.96, -Math.cos(52.25 * D) * 0.96)], [[0, 1, 1], [0, 2, 1]]),
  CO2: () => M([at("O", -1.16), at("C", 0), at("O", 1.16)], [[0, 1, 2], [1, 2, 2]]),
  CaO: () => M([at("Ca", 0), at("O", 2.4)]),
  "Ca(OH)2": () => M([at("Ca", 0), at("O", 2.35, 0.2), at("H", 3.2, 0.62), at("O", -2.35, -0.2), at("H", -3.2, -0.62)], [[1, 2, 1], [3, 4, 1]]),
  CaCO3: () => {
    const c = [2.9, 0, 0];
    const o = [0, 120, 240].map((t) => at("O", c[0] + Math.cos(t * D + Math.PI) * 1.28, Math.sin(t * D + Math.PI) * 1.28, 0));
    return M([at("Ca", 0), at("C", ...c), ...o], [[1, 2, 2], [1, 3, 1], [1, 4, 1]]);
  },
  S: () => M([at("S", 0)]),
  SO2: () => M([at("S", 0), at("O", Math.sin(59.5 * D) * 1.43, -Math.cos(59.5 * D) * 1.43), at("O", -Math.sin(59.5 * D) * 1.43, -Math.cos(59.5 * D) * 1.43)], [[0, 1, 2], [0, 2, 2]]),
  SO3: () => M([at("S", 0), ...[90, 210, 330].map((t) => at("O", Math.cos(t * D) * 1.42, Math.sin(t * D) * 1.42))], [[0, 1, 2], [0, 2, 2], [0, 3, 2]]),
  H2SO4: () => MOLECULES.find((m) => m.id === "H2SO4").data,
  NaOH: () => M([at("Na", -2.3), at("O", 0), at("H", 0.96)], [[1, 2, 1]]),
  Na2SO4: () => M([...so4(), at("Na", 2.9, 1.2, 0.3), at("Na", -2.9, -1.2, -0.3)], so4Bonds(0)),
  CaSO4: () => M([...so4([2.6, 0, 0]), at("Ca", -0.6, 0, 0)], so4Bonds(0)),
};

// Сцена уравнения: [[коэф, модель], ...] → [[коэф, модель], ...]
export function createEquationScene(viewer) {
  const root = new THREE.Group();
  viewer.scene.add(root);
  let mols = [];
  return {
    show(left, right) {
      mols.forEach((m) => { viewer.clear(m.group); viewer.scene.remove(m.group); });
      mols = [];
      viewer.clear(root);
      const items = [];
      left.forEach((x, i) => { if (i) items.push("+"); items.push(x); });
      items.push("→");
      right.forEach((x, i) => { if (i) items.push("+"); items.push(x); });
      let x = 0;
      const placed = [];
      for (const it of items) {
        if (typeof it === "string") { placed.push({ sign: it, x: x + 0.8 }); x += 1.6; continue; }
        const [k, id] = it;
        const data = MODELS[id]();
        const w = Math.max(...data.atoms.map((a) => Math.abs(a.pos[0]))) + 0.9;
        if (k > 1) { placed.push({ coef: k, x: x + 0.45 }); x += 0.9; }
        const mol = createMolecule(viewer, data);
        mols.push(mol);
        placed.push({ mol, x: x + w });
        x += 2 * w;
      }
      const shift = x / 2;
      for (const p of placed) {
        if (p.mol) { p.mol.group.position.x = p.x - shift; continue; }
        const s = textSprite(p.sign ?? String(p.coef), { size: 0.7, color: p.sign ? "#ffffff" : "#ffd23a", font: 800 });
        s.position.x = p.x - shift;
        root.add(s);
      }
      return x / 2 + 0.5; // полуширина
    },
  };
}
