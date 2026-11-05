// 3D-модель атома (по Бору) с ядром из протонов и нейтронов,
// электронами на оболочках и режимом «в разрезе».
import { THREE, sphereGeo, glossy, glowSprite } from "./core.js";

export const COLORS = {
  proton: 0xff5a6e,
  neutron: 0x9aa7c7,
  electron: 0x5fd4ff,
};

const SHELL_LETTERS = ["K", "L", "M", "N", "O", "P", "Q"];

// Плотная укладка нуклонов в шар (спираль Фибоначчи по слоям)
function nucleonPositions(count, r) {
  const pts = [];
  if (count === 1) return [[0, 0, 0]];
  const R = r * Math.cbrt(count) * 0.95;
  // Перебираем точки в шаре по сетке, сортируем по расстоянию от центра
  const step = r * 1.62;
  const cand = [];
  const lim = Math.ceil(R / step) + 2;
  for (let x = -lim; x <= lim; x++)
    for (let y = -lim; y <= lim; y++)
      for (let z = -lim; z <= lim; z++) {
        // гранецентрированная решётка — самая плотная упаковка шаров
        if ((x + y + z) % 2 !== 0) continue;
        const p = [x * step * 0.7071, y * step * 0.7071, z * step * 0.7071];
        cand.push([p, Math.hypot(...p) + Math.random() * 0.01]);
      }
  cand.sort((a, b) => a[1] - b[1]);
  for (let i = 0; i < count && i < cand.length; i++) pts.push(cand[i][0]);
  return pts;
}

// Перемешиваем протоны и нейтроны детерминированно
function mixedKinds(z, n) {
  const kinds = [];
  let p = z, q = n;
  const total = z + n;
  for (let i = 0; i < total; i++) {
    const wantP = p / (p + q || 1);
    // равномерное перемешивание по накопленной доле
    if (p > 0 && (q === 0 || ((i * 7919) % 97) / 97 < wantP)) { kinds.push("p"); p--; }
    else { kinds.push("n"); q--; }
  }
  return kinds;
}

export function createAtom(viewer, initial = {}) {
  const group = new THREE.Group();
  viewer.scene.add(group);

  const nucleus = new THREE.Group();
  const shellsGroup = new THREE.Group();
  const cloud = new THREE.Group();
  group.add(nucleus, shellsGroup, cloud);

  const clipPlane = new THREE.Plane(new THREE.Vector3(0, 0, -1), 100);
  let state = { z: 1, n: 0, e: 1, shells: [1], cut: 0, showCloud: false, ...initial };
  let electrons = []; // { mesh, shell, angle, speed, radius, tilt }
  const NUC_R = 0.16;

  function shellRadius(i, count) {
    return 1.25 + i * (count > 5 ? 0.78 : 0.95);
  }

  function build() {
    viewer.clear(nucleus);
    viewer.clear(shellsGroup);
    viewer.clear(cloud);
    electrons = [];

    // --- Ядро ---
    const A = state.z + state.n;
    const pos = nucleonPositions(A, NUC_R);
    const kinds = mixedKinds(state.z, state.n);
    const geo = sphereGeo(NUC_R, 18);
    const matP = glossy(COLORS.proton);
    const matN = glossy(COLORS.neutron);
    const pIdx = [], nIdx = [];
    kinds.forEach((k, i) => (k === "p" ? pIdx : nIdx).push(i));
    const mk = (idx, mat) => {
      if (!idx.length) return;
      const im = new THREE.InstancedMesh(geo, mat, idx.length);
      const m = new THREE.Matrix4();
      idx.forEach((pi, j) => { m.makeTranslation(...pos[pi]); im.setMatrixAt(j, m); });
      nucleus.add(im);
    };
    mk(pIdx, matP);
    mk(nIdx, matN);
    const halo = glowSprite(0xff8899, NUC_R * Math.cbrt(Math.max(A, 1)) * 6, 0.35);
    nucleus.add(halo);
    // крупное ядро немного уменьшаем, чтобы влезали оболочки
    const nucScale = A > 60 ? 0.75 : 1;
    nucleus.scale.setScalar(nucScale);

    // --- Оболочки и электроны ---
    const shells = state.shells;
    const ringMat = new THREE.LineBasicMaterial({ color: 0x7fa8ff, transparent: true, opacity: 0.35 });
    const eGeo = sphereGeo(0.085, 16);
    const eMat = new THREE.MeshBasicMaterial({ color: COLORS.electron });
    shells.forEach((count, i) => {
      if (!count) return;
      const r = shellRadius(i, shells.length);
      const holder = new THREE.Group();
      // каждая оболочка слегка наклонена — так модель читается объёмно
      holder.rotation.set(0.35 + i * 0.42, i * 0.9, 0.2 * i);
      shellsGroup.add(holder);
      const pts = [];
      for (let a = 0; a <= 128; a++) pts.push(new THREE.Vector3(Math.cos((a / 128) * Math.PI * 2) * r, 0, Math.sin((a / 128) * Math.PI * 2) * r));
      const ring = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), ringMat);
      holder.add(ring);
      for (let k = 0; k < count; k++) {
        const mesh = new THREE.Mesh(eGeo, eMat);
        const glow = glowSprite(COLORS.electron, 0.42, 0.85);
        mesh.add(glow);
        holder.add(mesh);
        electrons.push({ mesh, angle: (k / count) * Math.PI * 2, speed: 1.4 / Math.pow(i + 1, 0.8), radius: r });
      }
      // «облако» оболочки для режима разреза
      const sph = new THREE.Mesh(
        new THREE.SphereGeometry(r, 48, 32),
        new THREE.MeshPhysicalMaterial({
          color: 0x4aa8ff, transparent: true, opacity: 0.09 + 0.03 * (shells.length - i) / shells.length,
          roughness: 0.2, side: THREE.DoubleSide, depthWrite: false, clippingPlanes: [clipPlane],
        })
      );
      cloud.add(sph);
      // кромка среза — светлое кольцо в плоскости разреза
      const edge = new THREE.Mesh(
        new THREE.RingGeometry(r - 0.02, r + 0.02, 96),
        new THREE.MeshBasicMaterial({ color: 0x9fd8ff, transparent: true, opacity: 0.55, side: THREE.DoubleSide })
      );
      edge.userData.isEdge = true;
      edge.userData.r = r;
      cloud.add(edge);
    });
    applyCut();
  }

  function outerRadius() {
    const s = state.shells.filter(Boolean).length;
    return s ? shellRadius(s - 1, state.shells.length) : 1;
  }

  function applyCut() {
    // cut: 0 — облако скрыто; 1 — разрезано до центра
    const R = outerRadius();
    const show = state.showCloud || state.cut > 0;
    cloud.visible = show;
    const depth = R - state.cut * R; // положение плоскости по оси z
    clipPlane.constant = state.cut > 0 ? depth : 100;
    // Плоскость разреза всегда обращена к зрителю: срезаем ближнюю половину
    const v = viewer.camera.position.clone().sub(viewer.controls.target).normalize();
    clipPlane.normal.copy(v).negate();
    cloud.children.forEach((c) => {
      if (c.userData.isEdge) {
        const r = c.userData.r;
        const visible = state.cut > 0 && Math.abs(depth) < r;
        c.visible = visible;
        if (visible) {
          const rr = Math.sqrt(Math.max(r * r - depth * depth, 0.0001));
          c.scale.setScalar(rr / r);
          c.position.copy(v).multiplyScalar(depth);
          c.lookAt(c.position.clone().add(v));
        }
      }
    });
  }

  viewer.onFrame((dt) => {
    for (const e of electrons) {
      e.angle += dt * e.speed;
      e.mesh.position.set(Math.cos(e.angle) * e.radius, 0, Math.sin(e.angle) * e.radius);
    }
    nucleus.rotation.y += dt * 0.15;
    if (state.cut > 0) applyCut();
  });

  build();

  return {
    group,
    set(next) {
      const changed = ["z", "n", "e", "shells"].some((k) => k in next && JSON.stringify(next[k]) !== JSON.stringify(state[k]));
      state = { ...state, ...next };
      if (changed) build(); else applyCut();
    },
    setCut(v) { state.cut = v; applyCut(); },
    setCloud(v) { state.showCloud = v; applyCut(); },
    outerRadius,
    get state() { return state; },
  };
}

export { SHELL_LETTERS };
