// Свеча с пламенем из частиц и «треугольник огня»: топливо, кислород, тепло.
import { THREE, glossy, glowSprite, textSprite, clamp01 } from "./core.js";
import { rng, glass, reduced } from "./y12-kit.js";

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const FLAME_H = 1.9;

export function createCandle(viewer) {
  const R = rng(4);
  const g = new THREE.Group();
  viewer.scene.add(g);
  const wax = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.78, 3, 48), glossy(0xf3ead6, { roughness: 0.55, clearcoat: 0.2, sheen: 0.6 }));
  wax.position.y = -1.5;
  const pool = new THREE.Mesh(new THREE.CircleGeometry(0.62, 40), glossy(0xfff4dc, { roughness: 0.1 }));
  pool.rotation.x = -Math.PI / 2; pool.position.y = 0.005;
  const wick = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.42, 10), glossy(0x1d1d1f));
  wick.geometry.translate(0, 0.21, 0);
  const plate = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.6, 0.15, 48), glossy(0x9aa3b5, { metalness: 0.6, roughness: 0.3 }));
  plate.position.y = -3.07;
  g.add(wax, pool, wick, plate);
  const light = new THREE.PointLight(0xffa040, 6, 9, 1.6);
  light.position.y = 0.9;
  g.add(light);

  // частицы пламени
  const flame = [];
  for (let i = 0; i < 150; i++) {
    const s = glowSprite(0xffc04d, 0.4, 0);
    s.material.blending = THREE.NormalBlending;
    g.add(s);
    flame.push({ s, life: R(), sp: 0.8 + R() * 0.5, ang: R() * Math.PI * 2, edge: R() });
  }
  // дым
  const smoke = [];
  const smokeTex = glowSprite(0x777777, 1, 0).material.map;
  for (let i = 0; i < 40; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, color: 0x6b6f78, transparent: true, opacity: 0, depthWrite: false }));
    g.add(s);
    smoke.push({ s, life: R(), dx: (R() - 0.5) * 0.6 });
  }
  // стеклянная банка
  const jar = glass(1.35, 3.4, { opacity: 0.12, open: false });
  jar.rotation.x = Math.PI; // дно сверху
  jar.position.y = 9;
  g.add(jar);
  // брызги воды
  const drops = [];
  for (let i = 0; i < 30; i++) { const s = glowSprite(0x59a8ff, 0.18, 0); g.add(s); drops.push({ s, ph: R() }); }
  // подписи зон
  const zones = new THREE.Group();
  const zl = (t, y, x) => { const s = textSprite(t, { size: 0.24 }); s.position.set(x, y, 0); zones.add(s); };
  zl("≈1400 °C: внешняя зона", 2.35, 1.6);
  zl("≈1200 °C: светится сажа", 1.35, 1.6);
  zl("≈600 °C: пары воска", 0.55, 1.5);
  zones.visible = false;
  g.add(zones);

  const st = { fuel: true, heat: true, o2: 1, jar: false, I: 1, smokeT: 0, cool: 0 };
  const cBlue = new THREE.Color(0x4f7dff), cYel = new THREE.Color(0xffd36b), cOr = new THREE.Color(0xff7a1a);
  const tmpC = new THREE.Color();
  let wasLit = true;

  viewer.onFrame((dt, t) => {
    // банка: опускается и «съедает» кислород
    jar.position.y += ((st.jar ? 0.6 : 9) - jar.position.y) * Math.min(1, dt * 3);
    if (st.jar && jar.position.y < 0.8) st.o2 = Math.max(0, st.o2 - dt * 0.11 * (0.3 + st.I));
    if (!st.jar) st.o2 = Math.min(1, st.o2 + dt * 0.5);
    wick.scale.y += ((st.fuel ? 1 : 0.02) - wick.scale.y) * Math.min(1, dt * 2);
    st.cool = Math.max(0, st.cool - dt);
    const want = st.fuel && st.heat && wick.scale.y > 0.3 ? clamp01((st.o2 - 0.25) / 0.45) : 0;
    st.I += (want - st.I) * Math.min(1, dt * (want < st.I ? 2.5 : 1.5));
    if (st.I < 0.03 && wasLit) { wasLit = false; st.smokeT = 4; st.I = 0; }
    if (st.I > 0.05) wasLit = true;
    st.smokeT = Math.max(0, st.smokeT - dt);
    const I = st.I;
    const top = 0.42 * wick.scale.y;
    light.intensity = I * (5 + Math.sin(t * 13) * 0.6 + Math.sin(t * 7.3) * 0.4);
    for (const p of flame) {
      p.life += dt * p.sp * 1.3;
      if (p.life > 1) { p.life -= 1; p.ang = Math.random() * Math.PI * 2; p.edge = Math.random(); }
      const u = p.life;
      const H = FLAME_H * (0.35 + 0.65 * I);
      const y = top + 0.05 + u * H;
      const prof = 0.34 * Math.pow(Math.sin(Math.PI * Math.min(1, u * 1.15 + 0.08)), 0.7) * (0.5 + 0.5 * I);
      const r = prof * (0.35 + 0.65 * p.edge);
      const sway = Math.sin(t * 2.3) * 0.05 * u;
      p.s.position.set(Math.cos(p.ang) * r + sway, y, Math.sin(p.ang) * r);
      if (u < 0.18) tmpC.copy(cBlue).lerp(cYel, u / 0.18 * (1 - p.edge * 0.6));
      else tmpC.copy(cYel).lerp(cOr, (u - 0.18) / 0.82);
      p.s.material.color.copy(tmpC);
      p.s.material.opacity = I * 0.42 * Math.sin(Math.PI * u) * (p.edge > 0.7 && u < 0.3 ? 0.6 : 1);
      p.s.scale.setScalar((0.28 + 0.3 * (1 - u)) * (0.6 + 0.4 * I));
    }
    for (const s of smoke) {
      s.life += dt * 0.35;
      if (s.life > 1) s.life -= 1;
      const y = top + 0.2 + s.life * 4.5;
      s.s.position.set(Math.sin(s.life * 6 + s.dx * 10) * 0.25 * s.life + s.dx * s.life, Math.min(y, st.jar ? 3.6 : 99), s.dx * 0.5);
      s.s.scale.setScalar(0.3 + s.life * 1.1);
      s.s.material.opacity = (st.smokeT / 4) * 0.45 * Math.sin(Math.PI * s.life);
    }
    drops.forEach((d, i) => {
      const u = (t * 0.9 + d.ph) % 1;
      d.s.position.set(-3 + u * 3, 1.6 - u * 0.6 + Math.sin(i) * 0.25, Math.cos(i * 2.3) * 0.3);
      d.s.material.opacity = st.cool > 0 ? 0.9 * Math.sin(Math.PI * u) : 0;
    });
  });
  if (reduced()) st.I = 1;
  return {
    state: st,
    oxygen(off) { st.jar = off; },
    fuel(on) { st.fuel = on; },
    cool() { st.heat = false; st.cool = 1.8; },
    relight() { st.fuel = true; st.heat = true; st.jar = false; st.o2 = 1; st.I = reduced() ? 1 : 0.2; },
    zones(on) { zones.visible = on; },
    get lit() { return st.I > 0.05; },
  };
}
