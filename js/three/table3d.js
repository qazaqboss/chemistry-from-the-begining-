// Таблица Менделеева в 3D: высота столбика = значение свойства.
import { THREE } from "./core.js";
import { ELEMENTS } from "../data/elements.js";
import { layoutOf, CAT_COLORS } from "../periodic-layout.js";

export const PROPS3D = {
  en: { label: "Электроотрицательность", get: (e) => e.en },
  mass: { label: "Атомная масса", get: (e) => e.mass },
  density: { label: "Плотность", get: (e) => e.density },
  mp: { label: "Температура плавления", get: (e) => (e.mp == null ? null : e.mp + 273.15) },
  valence: { label: "Внешние электроны", get: (e) => e.shells?.[e.shells.length - 1] ?? null },
};

export function createTable3D(viewer, onHover) {
  const group = new THREE.Group();
  viewer.scene.add(group);
  const geo = new THREE.BoxGeometry(0.9, 1, 0.9);
  geo.translate(0, 0.5, 0);
  const meshes = [];
  for (const e of ELEMENTS) {
    const { col, row } = layoutOf(e);
    const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(CAT_COLORS[e.cat] || "#888"), roughness: 0.45, metalness: 0.1 });
    const m = new THREE.Mesh(geo, mat);
    m.position.set(col - 9.5, 0, row - 5.5 + (row > 7 ? 0.4 : 0));
    m.userData.el = e;
    m.userData.h = 0.1;
    m.userData.target = 0.1;
    group.add(m);
    meshes.push(m);
  }
  // подложка
  const base = new THREE.Mesh(new THREE.BoxGeometry(19.5, 0.1, 11.4), new THREE.MeshStandardMaterial({ color: 0x1c2340, roughness: 0.9 }));
  base.position.set(0, -0.06, 0.3);
  group.add(base);

  function setProp(key) {
    const P = PROPS3D[key];
    const vals = ELEMENTS.map(P.get).filter((v) => v != null && v > 0);
    const max = Math.max(...vals);
    meshes.forEach((m) => {
      const v = P.get(m.userData.el);
      m.userData.target = v == null || v <= 0 ? 0.04 : 0.15 + (v / max) * 5;
      m.material.opacity = v == null ? 0.25 : 1;
      m.material.transparent = v == null;
    });
  }

  viewer.onFrame((dt) => {
    for (const m of meshes) {
      m.userData.h += (m.userData.target - m.userData.h) * Math.min(1, dt * 4);
      m.scale.y = m.userData.h;
    }
  });

  // наведение — подсказка
  const ray = new THREE.Raycaster();
  const ptr = new THREE.Vector2();
  let hovered = null;
  viewer.renderer.domElement.addEventListener("pointermove", (ev) => {
    const r = viewer.renderer.domElement.getBoundingClientRect();
    ptr.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ptr, viewer.camera);
    const hit = ray.intersectObjects(meshes)[0];
    const m = hit?.object || null;
    if (m !== hovered) {
      if (hovered) hovered.material.emissive?.setHex(0x000000);
      hovered = m;
      if (m) m.material.emissive.setHex(0x333333);
      onHover?.(m?.userData.el || null);
    }
  });

  return { setProp };
}
