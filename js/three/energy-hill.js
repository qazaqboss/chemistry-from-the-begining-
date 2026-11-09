// Энергетическая «горка» реакции: профиль энергии как жёлоб, по которому катится шарик-частица.
// Масштаб: 1 единица высоты = 100 кДж/моль. Физика шарика — честная механика с трением:
// если кинетической энергии меньше барьера, шарик скатывается обратно.
import { THREE, sphereGeo, glossy, glowSprite, textSprite } from "./core.js";

const X0 = -5, X1 = 5, W = 1.6; // протяжённость по x и ширина жёлоба
const ER = 3.2; // уровень реагентов

export function createHill(viewer) {
  const root = new THREE.Group();
  root.position.y = -3.2;
  viewer.scene.add(root);
  const dyn = new THREE.Group();
  root.add(dyn);
  let p = { dH: -200, Ea: 120 };

  // профиль: плавный переход Er→Ep + «горб» с вершиной ≈ Er + Ea
  const Ep = () => ER + p.dH / 100;
  const peak = () => ER + p.Ea / 100;
  const ss = (t) => t * t * (3 - 2 * t);
  function E(x) {
    const u = Math.min(1, Math.max(0, (x - X0) / (X1 - X0)));
    const base = ER + (Ep() - ER) * ss(Math.min(1, Math.max(0, (u - 0.18) / 0.64)));
    const A = peak() - (ER + Ep()) / 2;
    return base + A * Math.exp(-(((u - 0.5) / 0.12) ** 2));
  }
  const dE = (x) => (E(x + 1e-3) - E(x - 1e-3)) / 2e-3;

  function build() {
    viewer.clear(dyn);
    const NX = 160, NZ = 10;
    const pos = [], col = [], idx = [];
    const cLow = new THREE.Color(0x3d8bff), cHigh = new THREE.Color(0xff8a3d), c = new THREE.Color();
    for (let i = 0; i <= NX; i++) {
      const x = X0 + ((X1 - X0) * i) / NX, y = E(x);
      for (let j = 0; j <= NZ; j++) {
        const z = -W / 2 + (W * j) / NZ;
        pos.push(x, y + 0.5 * (z / W) ** 2 * 1.2, z);
        c.copy(cLow).lerp(cHigh, Math.min(1, Math.max(0, (y - 0.2) / 6.5)));
        col.push(c.r, c.g, c.b);
      }
    }
    for (let i = 0; i < NX; i++) for (let j = 0; j < NZ; j++) {
      const a = i * (NZ + 1) + j, b = a + NZ + 1;
      idx.push(a, a + 1, b, b, a + 1, b + 1);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    dyn.add(new THREE.Mesh(g, new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.35, clearcoat: 0.5, side: THREE.DoubleSide })));

    // «стенка» под графиком — как лист миллиметровки
    const shape = new THREE.Shape();
    shape.moveTo(X0, 0);
    for (let i = 0; i <= 120; i++) { const x = X0 + ((X1 - X0) * i) / 120; shape.lineTo(x, E(x)); }
    shape.lineTo(X1, 0);
    const wall = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshBasicMaterial({ color: 0x7fa8ff, transparent: true, opacity: 0.1, side: THREE.DoubleSide, depthWrite: false }));
    wall.position.z = -W / 2 - 0.02;
    dyn.add(wall);

    const line = (pts, color, dashed = false) => {
      const geo = new THREE.BufferGeometry().setFromPoints(pts.map((q) => new THREE.Vector3(...q)));
      const m = dashed ? new THREE.LineDashedMaterial({ color, dashSize: 0.18, gapSize: 0.12 }) : new THREE.LineBasicMaterial({ color });
      const l = new THREE.Line(geo, m);
      if (dashed) l.computeLineDistances();
      dyn.add(l);
      return l;
    };
    const zB = -W / 2;
    // оси
    line([[X0 - 0.4, 0, zB], [X1 + 0.3, 0, zB]], 0x9aa7c7);
    line([[X0 - 0.4, 0, zB], [X0 - 0.4, 7.8, zB]], 0x9aa7c7);
    // уровни реагентов и продуктов
    const xPk = X0 + 0.5 * (X1 - X0);
    line([[X0, ER, zB], [X1, ER, zB]], 0x9fd8ff, true);
    line([[xPk, Ep(), zB], [X1, Ep(), zB]], 0xffd23a, true);
    // стрелки Eа и ΔH
    const arrow = (x, y0, y1, color) => {
      line([[x, y0, zB], [x, y1, zB]], color);
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.25, 12), new THREE.MeshBasicMaterial({ color }));
      cone.position.set(x, y1 - Math.sign(y1 - y0) * 0.12, zB);
      if (y1 < y0) cone.rotation.z = Math.PI;
      dyn.add(cone);
    };
    arrow(xPk, ER, peak() - 0.05, 0xff6b6b);
    arrow(X1 - 0.8, ER, Ep(), p.dH < 0 ? 0x51cf66 : 0x4dabf7);
    const lbl = (t, x, y, o = {}) => { const s = textSprite(t, { size: 0.36, ...o }); s.position.set(x, y, zB + 0.05); dyn.add(s); };
    lbl("Реагенты", X0 + 1.2, ER + 0.55);
    lbl("Продукты", X1 - 1.1, Ep() + (p.dH < 0 ? -0.5 : 0.55));
    lbl(`Eₐ = ${Math.round(p.Ea)} кДж`, xPk - 1.75, (ER + peak()) / 2 + 0.3, { color: "#ffb3b3" });
    lbl(`ΔH = ${p.dH > 0 ? "+" : "−"}${Math.abs(Math.round(p.dH))} кДж`, X1 - 0.8, (ER + Ep()) / 2 + (Math.abs(p.dH) < 60 ? 0.6 : 0), { color: p.dH < 0 ? "#9be7a8" : "#a5d8ff" });
    lbl("переходное состояние", xPk, peak() + 0.55, { size: 0.3, color: "#ffd8a8" });
    lbl("Энергия, кДж", X0 + 0.6, 7.9, { size: 0.3 });
    lbl("ход реакции →", X1 - 1, -0.4, { size: 0.3 });
  }

  // шарик
  const ball = new THREE.Mesh(sphereGeo(0.32, 32), glossy(0xf2f4f8));
  const glow = glowSprite(0xffc078, 1.6, 0);
  root.add(ball, glow);
  const burst = glowSprite(0xff922b, 1, 0);
  root.add(burst);
  let x = X0 + 0.5, vx = 0, crossed = false, onCross = null, burstT = 0;
  function place() {
    const s = dE(x), n = new THREE.Vector2(-s, 1).normalize();
    ball.position.set(x + n.x * 0.32, E(x) + n.y * 0.32, 0);
    glow.position.copy(ball.position);
    glow.material.opacity = Math.min(0.9, Math.abs(vx) * 0.12);
  }
  const xPeak = X0 + 0.5 * (X1 - X0);
  viewer.onFrame((dt) => {
    const steps = 6, h = dt / steps;
    for (let k = 0; k < steps; k++) {
      const s = dE(x);
      const a = (-9 * s) / Math.sqrt(1 + s * s) - (crossed || vx < 0 ? 0.8 : 0) * vx; // до вершины без потерь
      vx += a * h;
      x += (vx * h) / Math.sqrt(1 + s * s);
      if (x < X0 + 0.1) { x = X0 + 0.1; vx = Math.abs(vx) * 0.5; }
      if (x > X1 - 0.1) { x = X1 - 0.1; vx = -Math.abs(vx) * 0.5; }
    }
    if (!crossed && x > xPeak) { crossed = true; burstT = 1; onCross?.(); }
    if (burstT > 0) {
      burstT = Math.max(0, burstT - dt * 0.8);
      burst.position.set(xPeak + 1.6, Ep() + 0.4, 0);
      burst.material.color.set(p.dH < 0 ? 0xff922b : 0x4dabf7);
      burst.scale.setScalar(1 + (1 - burstT) * 5);
      burst.material.opacity = burstT * 0.85;
    }
    place();
  });

  build();
  place();
  return {
    set(next) { p = { ...p, ...next }; build(); this.reset(); },
    // толчок: кинетическая энергия kJ (в тех же 100 кДж-единицах), v = √(2gK)
    push(kJ, cb) { this.reset(); vx = Math.sqrt(2 * 9 * (kJ / 100)); onCross = cb; },
    reset() { x = X0 + 0.5; vx = 0; crossed = false; burstT = 0; place(); },
    get crossed() { return crossed; },
    get moving() { return Math.abs(vx) > 0.05; },
  };
}
