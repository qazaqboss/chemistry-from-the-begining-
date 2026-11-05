// Просмотр молекулы: шаростержневая или «заполненная» модель.
import { THREE, sphereGeo, glossy, bondMesh, textSprite } from "./core.js";
import { CPK, COV_R, VDW_R } from "../data/molecules.js";

export function createMolecule(viewer, data, opts = {}) {
  const group = new THREE.Group();
  viewer.scene.add(group);
  let style = opts.style || "ballstick";
  let labels = !!opts.labels;
  let current = data;

  const matCache = new Map();
  const mat = (el) => {
    if (!matCache.has(el)) matCache.set(el, glossy(CPK[el] ?? 0xff66cc));
    return matCache.get(el);
  };
  const bondMat = glossy(0xb8c2d8, { roughness: 0.45 });

  function build() {
    viewer.clear(group);
    matCache.clear();
    const { atoms, bonds } = current;
    for (const a of atoms) {
      const r = style === "spacefill" ? (VDW_R[a.el] ?? 1.6) : Math.max(0.22, (COV_R[a.el] ?? 0.7) * 0.42);
      const m = new THREE.Mesh(sphereGeo(r, 40), mat(a.el));
      m.position.set(...a.pos);
      group.add(m);
      if (labels) {
        const t = textSprite(a.el, { size: 0.32, bg: "rgba(10,14,30,0.6)" });
        t.position.set(a.pos[0], a.pos[1] + r + 0.22, a.pos[2]);
        group.add(t);
      }
    }
    if (style !== "spacefill") {
      for (const [i, j, order] of bonds) {
        const A = atoms[i].pos, B = atoms[j].pos;
        const d = new THREE.Vector3(B[0] - A[0], B[1] - A[1], B[2] - A[2]).normalize();
        // смещение для двойных/тройных связей — перпендикулярно связи, «к зрителю» в плоскости молекулы
        let off = new THREE.Vector3().crossVectors(d, new THREE.Vector3(0, 0, 1));
        if (off.lengthSq() < 0.01) off = new THREE.Vector3().crossVectors(d, new THREE.Vector3(0, 1, 0));
        off.normalize();
        const r = order === 1 ? 0.09 : 0.065;
        const gap = order === 2 ? [-0.11, 0.11] : order === 3 ? [-0.16, 0, 0.16] : [0];
        for (const g of gap) {
          const o = off.clone().multiplyScalar(g);
          group.add(bondMesh([A[0] + o.x, A[1] + o.y, A[2] + o.z], [B[0] + o.x, B[1] + o.y, B[2] + o.z], r, bondMat));
        }
      }
    }
  }
  build();

  return {
    group,
    set(next) { current = next; build(); },
    setStyle(s) { style = s; build(); },
    setLabels(v) { labels = v; build(); },
    radius() {
      return Math.max(...current.atoms.map((a) => Math.hypot(...a.pos))) + 1.2;
    },
  };
}

// Подогнать камеру под размер объекта
export function frame(viewer, radius) {
  const dist = radius / Math.sin((viewer.camera.fov * Math.PI) / 360) * 0.85;
  const dir = viewer.camera.position.clone().sub(viewer.controls.target).normalize();
  viewer.camera.position.copy(viewer.controls.target).add(dir.multiplyScalar(dist));
  viewer.controls.update();
}
