// Агрегатные состояния: «коробка» с молекулами воды.
// Ниже 0 °C — кристалл (лёд), 0…100 °C — жидкость, выше 100 °C — пар.
import { THREE, sphereGeo, glossy } from "./core.js";

export function createParticles(viewer, { count = 48 } = {}) {
  const group = new THREE.Group();
  viewer.scene.add(group);
  const B = 3.2; // половина ребра коробки

  // Стеклянная коробка
  const box = new THREE.Mesh(
    new THREE.BoxGeometry(B * 2, B * 2, B * 2),
    new THREE.MeshPhysicalMaterial({ color: 0x9fd8ff, transparent: true, opacity: 0.06, roughness: 0.1, side: THREE.BackSide, depthWrite: false })
  );
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(B * 2, B * 2, B * 2)), new THREE.LineBasicMaterial({ color: 0x7fa8ff, transparent: true, opacity: 0.6 }));
  group.add(box, edges);

  const oMat = glossy(0xff4b4b), hMat = glossy(0xf2f4f8);
  const oGeo = sphereGeo(0.22, 20), hGeo = sphereGeo(0.13, 14);
  const mols = [];
  // узлы «кристалла» — шестиугольный лёд упрощённо: слоистая сетка внизу коробки
  const side = Math.ceil(Math.cbrt(count));
  for (let i = 0; i < count; i++) {
    const g = new THREE.Group();
    const o = new THREE.Mesh(oGeo, oMat);
    const h1 = new THREE.Mesh(hGeo, hMat); h1.position.set(0.24, -0.18, 0);
    const h2 = new THREE.Mesh(hGeo, hMat); h2.position.set(-0.24, -0.18, 0);
    g.add(o, h1, h2);
    group.add(g);
    const ix = i % side, iy = Math.floor(i / (side * side)), iz = Math.floor(i / side) % side;
    const sp = 0.95;
    const home = new THREE.Vector3((ix - (side - 1) / 2) * sp + (iy % 2) * 0.3, -B + 0.45 + iy * sp * 0.9, (iz - (side - 1) / 2) * sp);
    mols.push({
      g, home, pos: home.clone(), vel: new THREE.Vector3(),
      spin: new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5),
      phase: Math.random() * 10,
    });
  }

  let T = -20; // °C
  const phaseOf = (t) => (t < 0 ? "solid" : t < 100 ? "liquid" : "gas");

  viewer.onFrame((dt, time) => {
    if (dt === 0) return;
    const phase = phaseOf(T);
    const kT = Math.max(0.05, (T + 273) / 373); // относительная тепловая энергия
    const steps = 2;
    const h = dt / steps;
    for (let s = 0; s < steps; s++) {
      for (const m of mols) {
        const f = new THREE.Vector3();
        if (phase === "solid") {
          // пружина к узлу + тепловое дрожание
          f.add(m.home.clone().sub(m.pos).multiplyScalar(40));
          m.vel.multiplyScalar(0.8);
          f.add(new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(60 * kT));
        } else if (phase === "liquid") {
          f.y -= 6; // тяжесть: жидкость собирается внизу
          f.add(new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(30 * kT));
          m.vel.multiplyScalar(0.96);
        } else {
          // газ: поддерживаем скорость, пропорциональную √T
          const target = 2.2 * Math.sqrt(kT * 2);
          const sp = m.vel.length() || 0.001;
          m.vel.multiplyScalar(1 + (target / sp - 1) * 0.05);
          if (sp < 0.05) m.vel.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5);
        }
        m.vel.addScaledVector(f, h);
      }
      // отталкивание и (для жидкости) притяжение соседей
      if (phase !== "solid") {
        for (let i = 0; i < mols.length; i++) for (let j = i + 1; j < mols.length; j++) {
          const d = mols[j].pos.clone().sub(mols[i].pos);
          const L = d.length();
          if (L < 0.001) continue;
          let k = 0;
          if (L < 0.62) k = (0.62 - L) * 60; // не проникают друг в друга
          else if (phase === "liquid" && L < 1.1) k = -(1.1 - L) * 4; // слабое притяжение
          if (k) {
            d.multiplyScalar(k / L * h);
            mols[i].vel.sub(d);
            mols[j].vel.add(d);
          }
        }
      }
      for (const m of mols) {
        m.pos.addScaledVector(m.vel, h);
        // стенки
        for (const ax of ["x", "y", "z"]) {
          const lim = B - 0.28;
          if (m.pos[ax] > lim) { m.pos[ax] = lim; m.vel[ax] = -Math.abs(m.vel[ax]); }
          if (m.pos[ax] < -lim) { m.pos[ax] = -lim; m.vel[ax] = Math.abs(m.vel[ax]); }
        }
      }
    }
    for (const m of mols) {
      m.g.position.copy(m.pos);
      const spinRate = phase === "solid" ? 0.3 : phase === "liquid" ? 1.5 : 3;
      if (phase === "solid") m.g.rotation.set(Math.sin(time * 3 + m.phase) * 0.15 * kT, m.phase, 0);
      else {
        m.g.rotation.x += m.spin.x * dt * spinRate;
        m.g.rotation.y += m.spin.y * dt * spinRate;
        m.g.rotation.z += m.spin.z * dt * spinRate;
      }
    }
  });

  return {
    setTemperature(t) {
      const before = phaseOf(T);
      T = t;
      const after = phaseOf(T);
      // при замерзании молекулы плавно «встают» в узлы решётки — пружина сделает это сама
      if (before === "solid" && after !== "solid") for (const m of mols) m.vel.set(Math.random() - 0.5, Math.random() * 0.5, Math.random() - 0.5).multiplyScalar(1.5);
    },
    phase: () => phaseOf(T),
  };
}
