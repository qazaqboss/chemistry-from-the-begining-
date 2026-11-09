// Простой калориметр: стакан воды с термометром над горелкой.
// Тепло сгорания топлива нагревает воду: Q = c·m·ΔT.
import { THREE, glossy, glowSprite, textSprite } from "./core.js";

export function createCalorimeter(viewer) {
  const g = new THREE.Group();
  g.position.y = -0.6;
  viewer.scene.add(g);
  const glass = new THREE.MeshPhysicalMaterial({ color: 0xcfe8ff, transparent: true, opacity: 0.18, roughness: 0.05, side: THREE.DoubleSide, depthWrite: false });
  // стакан
  const R = 1.5, H = 2.6, y0 = 0.6;
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(R, R * 0.95, H, 48, 1, true), glass);
  cup.position.y = y0 + H / 2;
  const bottom = new THREE.Mesh(new THREE.CircleGeometry(R * 0.95, 48), glass);
  bottom.rotation.x = -Math.PI / 2; bottom.position.y = y0;
  g.add(cup, bottom);
  const waterMat = new THREE.MeshPhysicalMaterial({ color: 0x3d8bff, transparent: true, opacity: 0.5, roughness: 0.1, transmission: 0.2 });
  const water = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.94, R * 0.92, 1, 48), waterMat);
  g.add(water);
  // термометр
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 4, 16), glass);
  tube.position.set(0.7, y0 + 2.5, 0.3);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.16, 20, 16), glossy(0xff3b3b));
  bulb.position.set(0.7, y0 + 0.55, 0.3);
  const col = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1, 12), glossy(0xff3b3b));
  g.add(tube, bulb, col);
  const tLabel = { s: null };
  // треножник и горелка
  const metal = glossy(0x8a93a8, { metalness: 0.6, roughness: 0.4 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(R * 1.02, 0.05, 8, 48), metal);
  ring.rotation.x = Math.PI / 2; ring.position.y = y0 - 0.02;
  g.add(ring);
  for (let i = 0; i < 3; i++) {
    const a = (i * 2 * Math.PI) / 3 + 0.5;
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.3, 8), metal);
    leg.position.set(Math.cos(a) * R, y0 - 1.15, Math.sin(a) * R);
    g.add(leg);
  }
  const dish = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.35, 0.3, 32), glossy(0xd0d6e2, { metalness: 0.3 }));
  dish.position.y = -1.6;
  g.add(dish);
  const fuel = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 1, 32), glossy(0xf8f0d0, { roughness: 0.6 }));
  g.add(fuel);
  const flames = [];
  for (let i = 0; i < 6; i++) {
    const s = glowSprite(0x4dabf7, 0.8, 0);
    g.add(s);
    flames.push(s);
  }
  // пузырьки тепла в воде
  const bubbles = [];
  const bMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 });
  for (let i = 0; i < 18; i++) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), bMat);
    b.userData = { a: Math.random() * 6.28, r: Math.random() * 1.1, ph: Math.random() };
    b.visible = false;
    g.add(b);
    bubbles.push(b);
  }

  let st = { T: 20, waterH: 1.6, fuelLeft: 1, burning: false, flame: 0x4dabf7 };
  function apply() {
    water.scale.y = st.waterH;
    water.position.y = y0 + st.waterH / 2 + 0.01;
    // шкала термометра: 0…100 °C на высоте 3,4
    const hCol = 0.15 + (Math.min(100, Math.max(0, st.T)) / 100) * 3.4;
    col.scale.y = hCol;
    col.position.set(0.7, y0 + 0.55 + hCol / 2, 0.3);
    const warm = Math.min(1, (st.T - 20) / 60);
    waterMat.color.setRGB(0.24 + warm * 0.6, 0.55 - warm * 0.1, 1 - warm * 0.6);
    fuel.scale.y = 0.05 + st.fuelLeft * 0.5;
    fuel.position.y = -1.45 + fuel.scale.y / 2;
    const txt = `${st.T.toFixed(1).replace(".", ",")} °C`;
    if (tLabel.t !== txt) {
      if (tLabel.s) { g.remove(tLabel.s); tLabel.s.material.map.dispose(); tLabel.s.material.dispose(); }
      tLabel.s = textSprite(txt, { size: 0.42 });
      tLabel.t = txt;
      g.add(tLabel.s);
    }
    tLabel.s.position.set(1.65, y0 + 0.55 + hCol, 0.3);
  }
  viewer.onFrame((dt, t) => {
    flames.forEach((f, i) => {
      const on = st.burning ? 1 : 0;
      f.material.color.set(st.flame);
      const k = 0.5 + 0.5 * Math.sin(t * 9 + i * 1.7);
      f.position.set(Math.sin(t * 5 + i) * 0.08, fuel.position.y + fuel.scale.y / 2 + 0.25 + i * 0.22, Math.cos(t * 4 + i) * 0.08);
      f.scale.setScalar((1.1 - i * 0.13) * (0.85 + 0.3 * k));
      f.material.opacity = on * (0.9 - i * 0.1);
    });
    bubbles.forEach((b) => {
      b.visible = st.burning;
      if (!st.burning) return;
      b.userData.ph = (b.userData.ph + dt * 0.5) % 1;
      b.position.set(Math.cos(b.userData.a) * b.userData.r, y0 + 0.1 + b.userData.ph * st.waterH, Math.sin(b.userData.a) * b.userData.r);
    });
  });
  apply();
  return {
    set(next) { st = { ...st, ...next }; apply(); },
    get state() { return st; },
  };
}
