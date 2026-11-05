// Кристаллические решётки с послойным «разрезом».
import { THREE, sphereGeo, glossy, bondMesh } from "./core.js";

// Базисы в долях ребра ячейки
export const LATTICES = {
  sc: {
    name: "Простая кубическая", example: "полоний (Po)", perCell: "8 × ⅛ = 1 атом",
    species: [{ color: 0x9aa7c7, r: 0.5, basis: [[0, 0, 0]] }], coord: 6,
    note: "Атомы только в вершинах куба. Самая «рыхлая» упаковка — заполнено лишь 52% объёма.",
  },
  bcc: {
    name: "Объёмно-центрированная (ОЦК)", example: "железо (Fe), натрий, хром", perCell: "8 × ⅛ + 1 = 2 атома",
    species: [{ color: 0xe0773a, r: 0.433, basis: [[0, 0, 0], [0.5, 0.5, 0.5]] }], coord: 8,
    note: "Ещё один атом в центре куба. Заполнено 68% объёма.",
  },
  fcc: {
    name: "Гранецентрированная (ГЦК)", example: "медь (Cu), алюминий, золото", perCell: "8 × ⅛ + 6 × ½ = 4 атома",
    species: [{ color: 0xd88a3c, r: 0.3536, basis: [[0, 0, 0], [0.5, 0.5, 0], [0.5, 0, 0.5], [0, 0.5, 0.5]] }], coord: 12,
    note: "Атомы в вершинах и в центрах граней. Плотнейшая упаковка — 74% объёма. Такие металлы пластичны.",
  },
  nacl: {
    name: "Хлорид натрия (поваренная соль)", example: "NaCl, KCl, MgO", perCell: "4 Na⁺ + 4 Cl⁻",
    species: [
      { color: 0x2fd35b, r: 0.3, label: "Cl⁻", basis: [[0, 0, 0], [0.5, 0.5, 0], [0.5, 0, 0.5], [0, 0.5, 0.5]] },
      { color: 0xab5cf2, r: 0.17, label: "Na⁺", basis: [[0.5, 0, 0], [0, 0.5, 0], [0, 0, 0.5], [0.5, 0.5, 0.5]] },
    ], coord: 6, bonds: 0.5,
    note: "Каждый ион натрия окружён шестью ионами хлора и наоборот. Молекул NaCl в кристалле нет — только ионы!",
  },
  diamond: {
    name: "Алмаз", example: "алмаз (C), кремний (Si), германий", perCell: "8 атомов",
    species: [{ color: 0x9fd8ff, r: 0.12, basis: [[0, 0, 0], [0.5, 0.5, 0], [0.5, 0, 0.5], [0, 0.5, 0.5], [0.25, 0.25, 0.25], [0.75, 0.75, 0.25], [0.75, 0.25, 0.75], [0.25, 0.75, 0.75]] }],
    coord: 4, bonds: Math.sqrt(3) / 4,
    note: "Каждый атом углерода прочно связан с четырьмя соседями по тетраэдру — поэтому алмаз самый твёрдый природный минерал.",
  },
};

export function createLattice(viewer, kind = "nacl", n = 3) {
  const group = new THREE.Group();
  viewer.scene.add(group);
  let state = { kind, n, cut: 0, cell: false };
  let items = []; // { im, positions[], r }
  const cellBox = new THREE.Group();
  group.add(cellBox);
  const cutPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ color: 0x7fd3ff, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false })
  );
  group.add(cutPlane);
  const N = new THREE.Vector3(1, 1, 1).normalize(); // разрез по плоскости (111)
  let bondsGroup = new THREE.Group();
  group.add(bondsGroup);

  function build() {
    const L = LATTICES[state.kind];
    for (const it of items) { it.im.geometry.dispose(); it.im.material.dispose(); group.remove(it.im); }
    items = [];
    viewer.clear(cellBox);
    viewer.clear(bondsGroup);
    const n = state.n;
    const a = 2; // ребро ячейки в единицах сцены
    const half = (n * a) / 2;
    const allPos = [];
    for (const sp of L.species) {
      const positions = [];
      for (let i = 0; i <= n; i++) for (let j = 0; j <= n; j++) for (let k = 0; k <= n; k++) {
        for (const b of sp.basis) {
          const f = [i + b[0], j + b[1], k + b[2]];
          if (f.some((x) => x > n + 1e-6)) continue;
          positions.push(new THREE.Vector3(f[0] * a - half, f[2] * a - half, f[1] * a - half));
        }
      }
      const im = new THREE.InstancedMesh(sphereGeo(sp.r * a, 28), glossy(sp.color), positions.length);
      group.add(im);
      items.push({ im, positions, r: sp.r * a, basePositions: positions });
      positions.forEach((p) => allPos.push(p));
    }
    // связи между ближайшими соседями (для алмаза и соли)
    if (L.bonds) {
      const dBond = L.bonds * a;
      const bondMat = glossy(0xc7d2ea, { roughness: 0.5 });
      for (let i = 0; i < allPos.length; i++) for (let j = i + 1; j < allPos.length; j++) {
        if (Math.abs(allPos[i].distanceTo(allPos[j]) - dBond) < 0.02) {
          const m = bondMesh(allPos[i].toArray(), allPos[j].toArray(), 0.05, bondMat);
          m.userData.a = allPos[i]; m.userData.b = allPos[j];
          bondsGroup.add(m);
        }
      }
    }
    // контур элементарной ячейки
    const box = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(a, a, a)),
      new THREE.LineBasicMaterial({ color: 0xffd36e })
    );
    box.position.set(-half + a / 2, -half + a / 2, -half + a / 2);
    cellBox.add(box);
    cutPlane.scale.setScalar(n * a * 1.9);
    apply();
  }

  function apply() {
    const n = state.n, a = 2;
    const half = (n * a) / 2;
    // глубина плоскости разреза вдоль (111): от «дальнего» угла к ближнему
    const maxD = Math.sqrt(3) * half;
    const d = maxD - state.cut * 2 * maxD;
    const m = new THREE.Matrix4();
    const cellMin = -half - 1e-6, cellMax = -half + a + 1e-6;
    for (const it of items) {
      it.positions.forEach((p, idx) => {
        let show = p.dot(N) <= d + 1e-6;
        let scale = 1;
        if (state.cell) {
          const inside = [p.x, p.y, p.z].every((c) => c >= cellMin && c <= cellMax);
          if (!inside) scale = 0.35;
        }
        m.makeScale(show ? scale : 0, show ? scale : 0, show ? scale : 0).setPosition(p);
        it.im.setMatrixAt(idx, m);
      });
      it.im.instanceMatrix.needsUpdate = true;
      it.im.material.transparent = state.cell;
    }
    bondsGroup.children.forEach((b) => { b.visible = b.userData.a.dot(N) <= d + 1e-6 && b.userData.b.dot(N) <= d + 1e-6; });
    cutPlane.visible = state.cut > 0.001 && state.cut < 0.999;
    cutPlane.position.copy(N).multiplyScalar(d);
    cutPlane.lookAt(N.clone().multiplyScalar(d + 1));
    cellBox.visible = state.cell;
  }

  build();
  return {
    group,
    set(next) {
      const rebuild = ("kind" in next && next.kind !== state.kind) || ("n" in next && next.n !== state.n);
      state = { ...state, ...next };
      rebuild ? build() : apply();
    },
    get info() { return LATTICES[state.kind]; },
  };
}
