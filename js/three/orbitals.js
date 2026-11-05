// Атомные орбитали: поверхность, на которой |ψ|² одинакова.
// Угловая часть — действительные сферические гармоники; s-орбитали 2s/3s
// показаны с внутренним узлом (в разрезе).
import { THREE } from "./core.js";

// Действительные сферические гармоники (без нормировочных множителей — нам важна форма)
const Y = {
  s: () => 1,
  px: (x, y, z) => x,
  py: (x, y, z) => y,
  pz: (x, y, z) => z,
  dxy: (x, y, z) => x * y,
  dxz: (x, y, z) => x * z,
  dyz: (x, y, z) => y * z,
  dx2y2: (x, y, z) => (x * x - y * y) / 2,
  dz2: (x, y, z) => (3 * z * z - 1) / (2 * Math.sqrt(3)),
};

export const ORBITALS = [
  { id: "1s", label: "1s", fn: "s", desc: "Шар. На первой оболочке есть только она — 2 электрона." },
  { id: "2s", label: "2s", fn: "s", node: true, desc: "Тоже шар, но больше, и внутри есть «пустой» слой — узел. Включите разрез!" },
  { id: "px", label: "2pₓ", fn: "px", desc: "Гантель вдоль оси x. Цвета — разные знаки волновой функции." },
  { id: "py", label: "2pᵧ", fn: "py", desc: "Такая же гантель, но вдоль оси y." },
  { id: "pz", label: "2p_z", fn: "pz", desc: "И вдоль оси z. Три p-орбитали = 6 электронов." },
  { id: "dxy", label: "3d_xy", fn: "dxy", desc: "Четырёхлепестковый «клевер» между осями x и y." },
  { id: "dxz", label: "3d_xz", fn: "dxz", desc: "Клевер в плоскости xz." },
  { id: "dyz", label: "3d_yz", fn: "dyz", desc: "Клевер в плоскости yz." },
  { id: "dx2y2", label: "3d_x²−y²", fn: "dx2y2", desc: "Лепестки прямо вдоль осей x и y." },
  { id: "dz2", label: "3d_z²", fn: "dz2", desc: "Гантель с «бубликом» посередине." },
];

const POS = 0x4fb3ff, NEG = 0xff7a59;

function lobeMesh(fn, sign, clip) {
  // r(θ,φ) = |Y| — поверхность, построенная из угловой части
  const geo = new THREE.SphereGeometry(1, 96, 64);
  const p = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).normalize();
    // переставляем оси: в three.js «вверх» — y, а в химии — z
    const val = Y[fn](v.x, v.z, v.y);
    const r = val * sign > 0 ? Math.abs(val) : 0;
    const k = fn === "s" ? 1 : 2.4;
    p.setXYZ(i, v.x * r * k, v.y * r * k, v.z * r * k);
  }
  geo.computeVertexNormals();
  const m = new THREE.MeshPhysicalMaterial({
    color: sign > 0 ? POS : NEG, roughness: 0.25, transmission: 0, transparent: true, opacity: 0.82,
    clearcoat: 0.8, side: THREE.DoubleSide, clippingPlanes: clip ? [clip] : [],
  });
  return new THREE.Mesh(geo, m);
}

export function createOrbital(viewer) {
  const group = new THREE.Group();
  viewer.scene.add(group);
  const clip = new THREE.Plane(new THREE.Vector3(0, 0, -1), 100);
  let cut = false;

  // Оси координат
  const axes = new THREE.Group();
  const axisMat = new THREE.LineBasicMaterial({ color: 0x8792b0, transparent: true, opacity: 0.5 });
  for (const d of [[1, 0, 0], [0, 1, 0], [0, 0, 1]]) {
    const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...d).multiplyScalar(-3.2), new THREE.Vector3(...d).multiplyScalar(3.2)]);
    axes.add(new THREE.Line(g, axisMat));
  }
  viewer.scene.add(axes);
  const nucleus = new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 12), new THREE.MeshBasicMaterial({ color: 0xff5a6e }));
  viewer.scene.add(nucleus);

  function show(id) {
    viewer.clear(group);
    const o = ORBITALS.find((x) => x.id === id) || ORBITALS[0];
    if (o.fn === "s") {
      const outer = new THREE.Mesh(
        new THREE.SphereGeometry(o.node ? 2.2 : 1.4, 64, 48),
        new THREE.MeshPhysicalMaterial({ color: POS, transparent: true, opacity: 0.55, roughness: 0.2, side: THREE.DoubleSide, clippingPlanes: [clip], depthWrite: false })
      );
      group.add(outer);
      if (o.node) {
        // внутренняя часть другого знака и узловая сфера между ними
        const inner = new THREE.Mesh(new THREE.SphereGeometry(0.75, 48, 32), new THREE.MeshPhysicalMaterial({ color: NEG, transparent: true, opacity: 0.85, roughness: 0.2, clippingPlanes: [clip] }));
        group.add(inner);
        const node = new THREE.Mesh(new THREE.SphereGeometry(1.1, 48, 32), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.08, wireframe: true, clippingPlanes: [clip] }));
        group.add(node);
      }
    } else {
      group.add(lobeMesh(o.fn, +1, clip), lobeMesh(o.fn, -1, clip));
    }
    return o;
  }

  viewer.onFrame(() => {
    if (!cut) { clip.constant = 100; return; }
    const v = viewer.camera.position.clone().sub(viewer.controls.target).normalize();
    clip.normal.copy(v).negate();
    clip.constant = 0;
  });

  return {
    show,
    setCut(v) { cut = v; },
  };
}
