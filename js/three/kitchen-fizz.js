// Кухня: сода + уксус надувают шарик углекислым газом; карамелизация сахара на сковороде.
import { THREE, sphereGeo, glossy, glowSprite } from "./core.js";
import { rng, reduced } from "./y12-kit.js";

const V = (x, y, z) => new THREE.Vector3(x, y, z);
export const M_SODA = 84.01, M_ACID = 60.05, VM = 24.0; // г/моль, г/моль, л/моль при ~20 °C

export function createFizz(viewer) {
  const R = rng(8);
  const g = new THREE.Group();
  viewer.scene.add(g);
  // бутылка
  const prof = [[0, -3], [1.45, -3], [1.55, -2.85], [1.55, 0.4], [1.2, 1.3], [0.5, 2.0], [0.45, 2.6], [0.52, 2.65]].map(([x, y]) => new THREE.Vector2(x, y));
  const bottle = new THREE.Mesh(new THREE.LatheGeometry(prof, 48), new THREE.MeshPhysicalMaterial({ color: 0xd8f0ff, transparent: true, opacity: 0.16, roughness: 0.05, side: THREE.DoubleSide, depthWrite: false }));
  g.add(bottle);
  const liquid = new THREE.Mesh(new THREE.CylinderGeometry(1.45, 1.45, 1, 40), new THREE.MeshPhysicalMaterial({ color: 0xffe9b0, transparent: true, opacity: 0.35, roughness: 0.1, depthWrite: false }));
  g.add(liquid);
  // горка соды на дне
  const sodaGeo = new THREE.BoxGeometry(0.12, 0.12, 0.12), sodaMat = glossy(0xffffff, { roughness: 0.8, clearcoat: 0 });
  const soda = [];
  for (let i = 0; i < 90; i++) {
    const m = new THREE.Mesh(sodaGeo, sodaMat);
    const a = R() * Math.PI * 2, r = Math.sqrt(R()) * 1.0;
    m.position.set(Math.cos(a) * r, -2.94 + (1 - r) * 0.35 * R(), Math.sin(a) * r);
    m.rotation.set(R() * 3, R() * 3, R() * 3);
    m.userData.k = R();
    g.add(m); soda.push(m);
  }
  // шарик на горлышке
  const balloon = new THREE.Group();
  const bMat = glossy(0xff4f7a, { roughness: 0.35, clearcoat: 1, transparent: true, opacity: 0.92 });
  const skin = new THREE.Mesh(sphereGeo(1, 40), bMat);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.56, 0.56, 0.5, 24), bMat);
  neck.position.y = 2.5;
  balloon.add(skin);
  g.add(balloon, neck);
  // пузырьки
  const bubbles = [];
  const bubMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, roughness: 0, clearcoat: 1 });
  for (let i = 0; i < 80; i++) { const m = new THREE.Mesh(sphereGeo(0.05 + R() * 0.07, 10), bubMat); m.visible = false; g.add(m); bubbles.push({ m, y: 0, x: 0, z: 0, sp: 1 + R() * 1.5, on: false }); }

  const st = { soda0: 0, soda: 0, acid: 0, co2: 0, rate: 0, vol: 0 };
  const LIQ_PER_ML = 1 / 50 * 1.2; // высота столба жидкости на мл (условно)
  const updateStatic = () => {
    const hgt = Math.min(3.2, st.vol * LIQ_PER_ML);
    liquid.scale.y = Math.max(0.01, hgt); liquid.position.y = -3 + hgt / 2; liquid.visible = st.vol > 0;
    const frac = st.soda0 > 0 ? st.soda / st.soda0 : 0;
    soda.forEach((m) => (m.visible = st.soda0 > 0 && m.userData.k < frac * Math.min(1, st.soda0 / 0.12)));
    const L = st.co2 * VM; // литров CO₂ (шарик, без учёта растворения)
    const r = Math.cbrt((3 * Math.max(L, 0.002)) / (4 * Math.PI)); // дм
    const s = 0.3 + r * 1.3;
    skin.scale.set(s, s * 1.12, s);
    balloon.position.y = 2.6 + s * 1.05;
  };
  updateStatic();
  let acc = 0;
  viewer.onFrame((dt, t) => {
    // скорость реакции пропорциональна произведению «остатков» (упрощённо)
    const k = 1.6;
    let d = Math.min(st.soda, st.acid) > 0 ? k * dt * Math.min(st.soda, st.acid) * (1 + 3 * Math.min(1, st.soda / Math.max(1e-6, st.soda0))) : 0;
    d = Math.min(d, st.soda, st.acid);
    st.soda -= d; st.acid -= d; st.co2 += d;
    st.rate = dt > 0 ? d / dt : 0;
    if (st.soda < 1e-5) st.soda = Math.max(0, st.soda);
    updateStatic();
    acc += st.rate * 900 * dt;
    for (const b of bubbles) {
      if (!b.on && acc >= 1) {
        acc -= 1; b.on = true; const a = Math.random() * Math.PI * 2, r = Math.random() * 1.1;
        b.x = Math.cos(a) * r; b.z = Math.sin(a) * r; b.y = -2.85; b.m.visible = true;
      }
      if (b.on) {
        b.y += dt * b.sp;
        const top = liquid.position.y + liquid.scale.y / 2;
        b.m.position.set(b.x + Math.sin(t * 5 + b.sp) * 0.04, b.y, b.z);
        if (b.y > top) { b.on = false; b.m.visible = false; }
      }
    }
    acc = Math.min(acc, 5);
    skin.rotation.y = t * 0.2;
  });
  return {
    state: st,
    addSoda(g5) { const n = g5 / M_SODA; st.soda += n; st.soda0 = Math.max(st.soda, st.soda0 + n); if (reduced()) settle(); },
    addVinegar(ml, pct = 9) { const n = (ml * 1.01 * pct) / 100 / M_ACID; st.acid += n; st.vol += ml; if (reduced()) settle(); },
    reset() { Object.assign(st, { soda0: 0, soda: 0, acid: 0, co2: 0, rate: 0, vol: 0 }); updateStatic(); },
  };
  function settle() { const d = Math.min(st.soda, st.acid); st.soda -= d; st.acid -= d; st.co2 += d; updateStatic(); }
}

// ---------- Карамель ----------
const STOPS = [[20, 0xffffff], [160, 0xfdf6e3], [170, 0xf2c66d], [180, 0xd9952f], [190, 0xa3601c], [200, 0x6b3810], [215, 0x2a160a]];
const colorAt = (T) => {
  for (let i = 1; i < STOPS.length; i++) if (T <= STOPS[i][0]) { const [t0, c0] = STOPS[i - 1], [t1, c1] = STOPS[i]; return new THREE.Color(c0).lerp(new THREE.Color(c1), (T - t0) / (t1 - t0)); }
  return new THREE.Color(STOPS.at(-1)[1]);
};

export function createCaramel(viewer) {
  const R = rng(13);
  const g = new THREE.Group();
  viewer.scene.add(g);
  const pan = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.3, 0.5, 64, 1, true), glossy(0x3a3f4b, { metalness: 0.7, roughness: 0.35, side: THREE.DoubleSide }));
  const bottom = new THREE.Mesh(new THREE.CircleGeometry(2.3, 64), glossy(0x30343c, { metalness: 0.7, roughness: 0.4 }));
  bottom.rotation.x = -Math.PI / 2; bottom.position.y = -0.24;
  const handle = new THREE.Mesh(new THREE.BoxGeometry(3, 0.18, 0.35), glossy(0x1d1f24));
  handle.position.set(3.9, 0.05, 0);
  const burner = glowSprite(0xff7a2a, 5.5, 0);
  burner.position.y = -0.8;
  g.add(pan, bottom, handle, burner);
  const grains = [];
  const gMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.2, clearcoat: 1 });
  for (let i = 0; i < 220; i++) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.11, 0.13), gMat);
    const a = R() * Math.PI * 2, r = Math.sqrt(R()) * 1.6;
    m.position.set(Math.cos(a) * r, -0.17 + R() * 0.12, Math.sin(a) * r);
    m.rotation.set(R() * 3, R() * 3, R() * 3);
    m.userData.k = R();
    g.add(m); grains.push(m);
  }
  const meltMat = glossy(0xfdf6e3, { roughness: 0.05, clearcoat: 1, transparent: true, opacity: 0.85 });
  const melt = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.12, 64), meltMat);
  melt.position.y = -0.17;
  g.add(melt);
  const puffs = [];
  for (let i = 0; i < 24; i++) { const s = glowSprite(0xffffff, 1, 0); s.material.blending = THREE.NormalBlending; g.add(s); puffs.push({ s, ph: R(), x: (R() - 0.5) * 2.5, z: (R() - 0.5) * 2.5 }); }
  let T = 20;
  function apply() {
    const m = Math.min(1, Math.max(0, (T - 160) / 26)); // доля расплавленного
    grains.forEach((gr) => (gr.visible = gr.userData.k > m));
    melt.visible = m > 0.01;
    const r = 0.5 + 1.6 * Math.sqrt(m);
    melt.scale.set(r, 1, r);
    meltMat.color.copy(colorAt(T));
    burner.material.opacity = T > 25 ? Math.min(0.9, (T - 20) / 160) : 0;
  }
  apply();
  viewer.onFrame((dt, t) => {
    for (const p of puffs) {
      const u = (t * 0.3 + p.ph) % 1;
      p.s.position.set(p.x * (1 + u * 0.3), 0 + u * 3, p.z);
      p.s.scale.setScalar(0.5 + u * 1.2);
      const steam = Math.max(0, Math.min(1, (T - 165) / 30));
      const smoke = Math.max(0, Math.min(1, (T - 200) / 15));
      p.s.material.color.setHex(0xffffff).lerp(new THREE.Color(0x4a4038), smoke);
      p.s.material.opacity = (0.1 * steam + 0.3 * smoke) * Math.sin(Math.PI * u);
    }
  });
  return { set(v) { T = v; apply(); }, color: colorAt };
}
