// Разделение смеси «вода + соль + песок + железные опилки»:
// магнит → отстаивание → фильтрование → выпаривание.
import { THREE, sphereGeo, glossy, glowSprite, easeInOut, clamp01 } from "./core.js";
import { rng, glass, reduced } from "./y12-kit.js";

const A = new THREE.Vector3(-2.2, 0, 0), B = new THREE.Vector3(2.2, 0, 0);
const BOT = -2, R = 1.75, FULL = 2.6;

export function createSeparation(viewer) {
  const rnd = rng(11);
  const group = new THREE.Group();
  viewer.scene.add(group);
  const gA = glass(1.9, 4); gA.position.copy(A);
  const gB = glass(1.9, 4); gB.position.copy(B);
  group.add(gA, gB);

  // жидкость в стаканах
  const liqMat = () => new THREE.MeshPhysicalMaterial({ color: 0x3fa9ff, transparent: true, opacity: 0.28, roughness: 0.1, depthWrite: false });
  const mkLiq = (p) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.1, R + 0.1, 1, 40), liqMat()); m.position.x = p.x; group.add(m); return m; };
  const liqA = mkLiq(A), liqB = mkLiq(B);
  const level = { A: FULL, B: 0.001 }, levelT = { A: FULL, B: 0.001 };
  const setLiq = (m, l) => { m.scale.y = Math.max(0.001, l); m.position.y = BOT + l / 2; m.visible = l > 0.02; };

  // магнит
  const magnet = new THREE.Group();
  const arc = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.22, 16, 40, Math.PI), glossy(0xd8342c));
  const legGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.9, 20);
  const l1 = new THREE.Mesh(legGeo, glossy(0xd8342c)); l1.position.set(0.7, -0.45, 0);
  const l2 = new THREE.Mesh(legGeo, glossy(0x2f6bd8)); l2.position.set(-0.7, -0.45, 0);
  const tipGeo = new THREE.CylinderGeometry(0.23, 0.23, 0.25, 20);
  const t1 = new THREE.Mesh(tipGeo, glossy(0xdfe4ee, { metalness: 0.8, roughness: 0.25 })); t1.position.set(0.7, -1.0, 0);
  const t2 = t1.clone(); t2.position.x = -0.7;
  magnet.add(arc, l1, l2, t1, t2);
  magnet.position.set(A.x, 6.5, 0);
  group.add(magnet);
  const magT = new THREE.Vector3(A.x, 6.5, 0);

  // воронка с фильтром над вторым стаканом
  const funnel = new THREE.Group();
  const prof = [[0.12, -1.0], [0.12, -0.2], [1.3, 1.2], [1.34, 1.25]].map(([x, y]) => new THREE.Vector2(x, y));
  funnel.add(new THREE.Mesh(new THREE.LatheGeometry(prof, 40), new THREE.MeshPhysicalMaterial({ color: 0xbfe3ff, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false })));
  const paper = new THREE.Mesh(new THREE.ConeGeometry(1.1, 1.25, 40, 1, true), new THREE.MeshStandardMaterial({ color: 0xf6f1e6, emissive: 0x9a958a, side: THREE.DoubleSide, roughness: 0.9, transparent: true, opacity: 0.9 }));
  paper.rotation.x = Math.PI; paper.position.y = 0.55;
  funnel.add(paper);
  funnel.position.set(B.x, 3.1, 0);
  group.add(funnel);

  // горелка (для выпаривания)
  const burner = new THREE.Group();
  const flame = glowSprite(0xff9a3c, 1.6, 0.9); flame.position.y = 0.2;
  const core = glowSprite(0x6fa8ff, 0.7, 0.9); core.position.y = 0.05;
  burner.add(flame, core);
  burner.position.set(B.x, BOT - 0.55, 0);
  burner.visible = false;
  group.add(burner);
  const steam = [];
  for (let i = 0; i < 18; i++) { const s = glowSprite(0xffffff, 0.7, 0); s.userData.ph = rnd(); group.add(s); steam.push(s); }

  // частицы
  const parts = [];
  const add = (kind, mesh) => { group.add(mesh); parts.push({ kind, mesh, from: new THREE.Vector3(), to: new THREE.Vector3(), ctrl: new THREE.Vector3(), delay: 0, dur: 1, seed: rnd() * 10 }); };
  const ironGeo = new THREE.BoxGeometry(0.05, 0.05, 0.26), ironMat = glossy(0x5a5f69, { metalness: 0.9, roughness: 0.35 });
  for (let i = 0; i < 36; i++) add("iron", new THREE.Mesh(ironGeo, ironMat));
  const sandMat = glossy(0xd9b36c, { roughness: 0.9, clearcoat: 0 }), sandMat2 = glossy(0xb98f4c, { roughness: 0.9, clearcoat: 0 });
  for (let i = 0; i < 60; i++) { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.09 + rnd() * 0.07, 0), i % 3 ? sandMat : sandMat2); m.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3); add("sand", m); }
  const naMat = glossy(0xab5cf2), clMat = glossy(0x2fd35b);
  for (let i = 0; i < 32; i++) add(i % 2 ? "cl" : "na", new THREE.Mesh(sphereGeo(i % 2 ? 0.1 : 0.065, 14), i % 2 ? clMat : naMat));

  const inLiquid = (c, l) => { const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * (R - 0.2); return new THREE.Vector3(c.x + Math.cos(a) * r, BOT + 0.15 + rnd() * Math.max(0.1, l - 0.3), Math.sin(a) * r); };
  let ionCell = 0;
  function target(p, step) {
    if (p.kind === "iron") {
      if (step === 0) return inLiquid(A, FULL);
      const side = rnd() < 0.5 ? -0.7 : 0.7;
      const a = rnd() * Math.PI * 2, r = rnd() * 0.22;
      return new THREE.Vector3(A.x + side + Math.cos(a) * r, magT.y - 1.2 - rnd() * 0.25, Math.sin(a) * r);
    }
    if (p.kind === "sand") {
      if (step <= 1) return inLiquid(A, FULL);
      if (step === 2) { const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * (R - 0.15); return new THREE.Vector3(A.x + Math.cos(a) * r, BOT + 0.08 + rnd() * 0.18 * (1 - r / R), Math.sin(a) * r); }
      const h = 0.15 + rnd() * 0.45, a = rnd() * Math.PI * 2, r = 0.1 + h * 0.85;
      return new THREE.Vector3(B.x + Math.cos(a) * r * 0.85, funnel.position.y - 0.05 + h, Math.sin(a) * r * 0.85);
    }
    // ионы соли
    if (step <= 2) return inLiquid(A, FULL);
    if (step === 3) return inLiquid(B, 2.3);
    const k = ionCell++ % 32;
    // NaCl-кубик 4×4×2: на чётных узлах Na⁺, на нечётных Cl⁻
    const cells = [];
    for (let z = 0; z < 2; z++) for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) cells.push([x, y, z]);
    const want = p.kind === "na" ? 0 : 1;
    const mine = cells.filter(([x, y, z]) => (x + y + z) % 2 === want);
    const idx = Math.floor(k / 2) % 16;
    const [x, y, z] = mine[idx];
    return new THREE.Vector3(B.x + (x - 1.5) * 0.21, BOT + 0.12 + z * 0.21, (y - 1.5) * 0.21);
  }

  let step = 0, clock = 0;
  function go(s, instant = false) {
    step = s; ionCell = 0; clock = 0;
    magT.set(A.x, s >= 1 ? 3.3 : 6.5, 0);
    levelT.A = s >= 3 ? 0.001 : FULL;
    levelT.B = s === 3 ? 2.3 : 0.001;
    burner.visible = s === 4;
    for (const p of parts) {
      p.from.copy(p.mesh.position);
      p.to.copy(target(p, s));
      const lift = s === 3 && p.kind !== "iron" ? 4 : 0;
      p.ctrl.copy(p.from).add(p.to).multiplyScalar(0.5); p.ctrl.y = Math.max(p.from.y, p.to.y) + lift;
      p.delay = rnd() * (s === 2 ? 1.2 : 0.7) + (s === 4 ? 2.2 : 0);
      p.dur = s === 2 ? 2.2 + rnd() * 1.5 : s === 3 ? 1.8 : 1.4;
      if (s === 1 && p.kind === "iron") p.delay += 0.5;
      if (instant || reduced()) p.mesh.position.copy(p.to);
    }
    if (instant || reduced()) { level.A = levelT.A; level.B = levelT.B; magnet.position.copy(magT); clock = 99; }
  }
  for (const p of parts) p.mesh.position.copy(target(p, 0));
  go(0, true);

  const tmp = new THREE.Vector3();
  viewer.onFrame((dt, t) => {
    clock += dt;
    magnet.position.lerp(magT, Math.min(1, dt * 3));
    const spd = step === 4 ? 0.45 : step === 3 ? 1.2 : 2;
    level.A += (levelT.A - level.A) * Math.min(1, dt * spd);
    level.B += (levelT.B - level.B) * Math.min(1, dt * (step === 4 ? 0.35 : 1));
    setLiq(liqA, level.A); setLiq(liqB, level.B);
    // мутная вода, пока песок во взвеси
    const murky = step <= 1 ? 1 : clamp01(1 - clock / 3);
    liqA.material.color.setHex(0x3fa9ff).lerp(new THREE.Color(0xa08a55), murky * 0.7);
    for (const p of parts) {
      const u = easeInOut(clamp01((clock - p.delay) / p.dur));
      const a = p.from, b = p.to, c = p.ctrl;
      tmp.set(
        (1 - u) * (1 - u) * a.x + 2 * (1 - u) * u * c.x + u * u * b.x,
        (1 - u) * (1 - u) * a.y + 2 * (1 - u) * u * c.y + u * u * b.y,
        (1 - u) * (1 - u) * a.z + 2 * (1 - u) * u * c.z + u * u * b.z
      );
      // броуновское дрожание в жидкости
      const wet = (p.kind === "na" || p.kind === "cl") ? step < 4 : step <= (p.kind === "sand" ? 1 : 0);
      if (wet && u >= 1) tmp.add(new THREE.Vector3(Math.sin(t * 1.3 + p.seed) * 0.08, Math.sin(t * 1.7 + p.seed * 2) * 0.06, Math.cos(t * 1.1 + p.seed) * 0.08));
      if (p.kind === "iron" && step >= 1 && u >= 1) tmp.add(new THREE.Vector3().subVectors(magnet.position, magT));
      p.mesh.position.copy(tmp);
      if (p.kind === "iron") p.mesh.lookAt(step >= 1 && u > 0.5 ? magnet.position : tmp.clone().add(new THREE.Vector3(Math.sin(p.seed), 0.3, Math.cos(p.seed))));
    }
    steam.forEach((s, i) => {
      const ph = (t * 0.35 + s.userData.ph) % 1;
      s.position.set(B.x + Math.sin(i * 2.1 + t) * 0.8, BOT + level.B + ph * 3.5, Math.cos(i * 1.7) * 0.6);
      s.material.opacity = step === 4 && level.B > 0.05 ? 0.35 * Math.sin(ph * Math.PI) : 0;
    });
    flame.scale.setScalar(1.5 + Math.sin(t * 9) * 0.12);
  });
  return { go, get step() { return step; } };
}
