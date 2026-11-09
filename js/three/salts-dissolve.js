// Кристалл NaCl растворяется в воде: ионы с углов и рёбер (меньше соседей) отрываются первыми,
// каждый уходящий ион окружается гидратной «шубой»: к Na⁺ вода повёрнута кислородом (δ−), к Cl⁻ — водородами (δ+).
import { THREE, sphereGeo, glossy, easeInOut, clamp01 } from "./core.js";
import { CPK } from "../data/molecules.js";

const N = 4, A = 0.85; // ионов по ребру, расстояние Na–Cl в сцене (≈ 2,82 Å)
const RNa = 0.26, RCl = 0.42; // относительные ионные радиусы 1,02 и 1,81 Å
const WN = 4; // молекул воды в «шубе» (на самом деле около 6)

export function createDissolve(viewer) {
  const root = new THREE.Group();
  viewer.scene.add(root);
  const ions = [];
  const half = ((N - 1) * A) / 2;
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) for (let k = 0; k < N; k++) {
    const na = (i + j + k) % 2 === 0;
    const p = new THREE.Vector3(i * A - half, j * A - half, k * A - half);
    // число соседей в кристалле: чем меньше, тем раньше ион уходит
    const nb = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]].filter(([a, b, c]) => [i + a, j + b, k + c].every((x) => x >= 0 && x < N)).length;
    ions.push({ na, p, nb, key: nb + p.length() * -0.05 + Math.random() * 0.6 });
  }
  ions.sort((a, b) => a.key - b.key);
  // направление ухода: от центра, со случайным разбросом; конечная точка — в «растворе»
  ions.forEach((o, n) => {
    const dir = o.p.clone().normalize().add(new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(0.9)).normalize();
    o.end = dir.multiplyScalar(4.2 + Math.random() * 2.8);
    o.order = n / ions.length;
    // молекулы воды вокруг иона: по вершинам тетраэдра
    o.w = [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]].slice(0, WN).map((d) => new THREE.Vector3(...d).normalize());
  });
  const mNa = new THREE.InstancedMesh(sphereGeo(RNa, 24), glossy(CPK.Na), ions.filter((o) => o.na).length);
  const mCl = new THREE.InstancedMesh(sphereGeo(RCl, 24), glossy(CPK.Cl), ions.filter((o) => !o.na).length);
  const mO = new THREE.InstancedMesh(sphereGeo(0.16, 14), glossy(CPK.O), ions.length * WN);
  const mH = new THREE.InstancedMesh(sphereGeo(0.1, 12), glossy(CPK.H), ions.length * WN * 2);
  root.add(mNa, mCl, mO, mH);
  // «вода» — полупрозрачный объём
  const water = new THREE.Mesh(new THREE.BoxGeometry(14, 9, 14), new THREE.MeshPhysicalMaterial({ color: 0x3d8bff, transparent: true, opacity: 0.06, side: THREE.BackSide, depthWrite: false }));
  root.add(water);

  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), ONE = new THREE.Vector3(1, 1, 1), ZERO = new THREE.Vector3(0, 0, 0);
  let t = 0;
  function setT(nt, time = 0) {
    t = nt;
    let iNa = 0, iCl = 0, iW = 0, gone = 0;
    for (const o of ions) {
      const u = clamp01((t * 1.25 - o.order) / 0.25);
      if (u > 0.5) gone++;
      const e = easeInOut(u);
      const pos = o.p.clone().lerp(o.end, e);
      if (u > 0.999) pos.add(V.set(Math.sin(time * 0.7 + o.order * 40), Math.cos(time * 0.6 + o.order * 31), Math.sin(time * 0.5 + o.order * 17)).multiplyScalar(0.25));
      M.makeTranslation(pos.x, pos.y, pos.z);
      if (o.na) mNa.setMatrixAt(iNa++, M); else mCl.setMatrixAt(iCl++, M);
      // гидратная оболочка проявляется по мере отрыва
      const s = clamp01((u - 0.15) / 0.5);
      const r = (o.na ? RNa + 0.2 : RCl + 0.36) * (0.6 + 0.4 * s) + 0.0;
      for (const d of o.w) {
        const c = pos.clone().add(d.clone().multiplyScalar(r));
        const sc = s > 0.01 ? ONE : ZERO;
        M.compose(c, Q, sc); mO.setMatrixAt(iW, M);
        // у Na⁺ атомы H смотрят наружу, у Cl⁻ — один H направлен к иону
        const perp = new THREE.Vector3(d.y, -d.x, 0.3).normalize();
        const hs = o.na
          ? [d.clone().multiplyScalar(0.18).add(perp.clone().multiplyScalar(0.15)), d.clone().multiplyScalar(0.18).sub(perp.clone().multiplyScalar(0.15))]
          : [d.clone().multiplyScalar(-0.22), d.clone().multiplyScalar(0.07).add(perp.clone().multiplyScalar(0.21))];
        hs.forEach((hh, q) => { M.compose(c.clone().add(hh), Q, sc); mH.setMatrixAt(iW * 2 + q, M); });
        iW++;
      }
    }
    [mNa, mCl, mO, mH].forEach((m) => (m.instanceMatrix.needsUpdate = true));
    return gone;
  }
  let playing = false, gone = 0;
  viewer.onFrame((dt, time) => {
    if (playing) { t = Math.min(1, t + dt / 12); if (t >= 1) playing = false; }
    gone = setT(t, time);
  });
  setT(0);
  return {
    play() { if (t >= 1) t = 0; playing = true; },
    pause() { playing = false; },
    set(v) { playing = false; t = v; },
    get t() { return t; },
    get playing() { return playing; },
    get dissolved() { return gone; },
    total: ions.length,
  };
}
