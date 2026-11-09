// «Конвейер» 2H₂ + O₂ → 2H₂O: каждый атом едет из молекулы реагента в молекулу продукта.
// Число атомов сохраняется, лишние молекулы (избыток) остаются на ленте и подсвечиваются.
import { THREE, sphereGeo, glossy, glowSprite, textSprite, easeInOut, clamp01 } from "./core.js";
import { CPK } from "../data/molecules.js";

const RH = 0.3, RO = 0.46;
const HH = 0.56, OO = 0.78, OH = 0.62, ANG = (104.5 * Math.PI) / 180;
const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
const lerp3 = (a, b, t) => a.clone().lerp(b, t);

export function createConveyor(viewer) {
  const root = new THREE.Group();
  viewer.scene.add(root);
  // лента
  const beltMat = glossy(0x2b3245, { roughness: 0.8, clearcoat: 0 });
  const belt = new THREE.Mesh(new THREE.BoxGeometry(17, 0.2, 5), beltMat);
  belt.position.y = -0.55;
  root.add(belt);
  const slats = [];
  const slatMat = glossy(0x4a5470, { roughness: 0.6 });
  for (let i = 0; i < 24; i++) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.04, 4.9), slatMat);
    s.position.set(-8.4 + i * 0.72, -0.43, 0);
    root.add(s); slats.push(s);
  }
  for (const x of [-8.5, 8.5]) {
    const roller = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 5.1, 24), glossy(0x8a93a8, { metalness: 0.6 }));
    roller.rotation.x = Math.PI / 2; roller.position.set(x, -0.6, 0);
    root.add(roller);
  }
  const reactor = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.06, 10, 48), new THREE.MeshBasicMaterial({ color: 0x7fd3ff, transparent: true, opacity: 0.6 }));
  reactor.rotation.x = Math.PI / 2; reactor.position.set(0, 1.4, 0);
  root.add(reactor);
  const flash = glowSprite(0xffc078, 3, 0);
  flash.position.set(0, 1.5, 0);
  root.add(flash);
  for (const [t, x] of [["реагенты", -5.2], ["реактор", 0], ["продукты", 5.2]]) {
    const s = textSprite(t, { size: 0.4 }); s.position.set(x, 3.1, -2.4); root.add(s);
  }

  const atomsG = new THREE.Group();
  root.add(atomsG);
  const matH = glossy(CPK.H), matO = glossy(CPK.O);
  let atoms = [], extras = [], K = 0, t = 0, spare = [];

  // расположение молекулы: центр, ось
  const pairAt = (c, d, r = 0) => [c.clone().add(v3(Math.cos(r) * d / 2, 0, Math.sin(r) * d / 2)), c.clone().add(v3(-Math.cos(r) * d / 2, 0, -Math.sin(r) * d / 2))];
  const waterAt = (c) => {
    const hx = Math.sin(ANG / 2) * OH, hy = Math.cos(ANG / 2) * OH;
    return [c.clone(), c.clone().add(v3(hx, -0.1, hy)), c.clone().add(v3(-hx, -0.1, hy))];
  };

  function build(nH2, nO2) {
    viewer.clear(atomsG);
    extras.forEach((e) => root.remove(e)); extras = [];
    atoms = []; spare = [];
    K = Math.min(Math.floor(nH2 / 2), nO2);
    const mk = (el, p) => {
      const m = new THREE.Mesh(sphereGeo(el === "H" ? RH : RO, 24), el === "H" ? matH : matO);
      m.position.copy(p); atomsG.add(m);
      const a = { m, keys: [p.clone()], k: -1 };
      atoms.push(a);
      return a;
    };
    // стартовые места
    const h2Pos = (i) => v3(-7.4 + (i % 6) * 0.95, 0.05, -1.85 + Math.floor(i / 6) * 1.3);
    const o2Pos = (i) => v3(-7.2 + (i % 4) * 1.85, 0.15, 0.9 + Math.floor(i / 4) * 1.15);
    const H2 = [], O2 = [];
    for (let i = 0; i < nH2; i++) H2.push(pairAt(h2Pos(i), HH, Math.PI / 2).map((p) => mk("H", p)));
    for (let i = 0; i < nO2; i++) O2.push(pairAt(o2Pos(i), OO).map((p) => mk("O", p)));
    // реакции: k-я забирает H₂ №2k, 2k+1 и O₂ №k
    const C = v3(0, 1.5, 0);
    for (let k = 0; k < K; k++) {
      const [ha, hb] = [H2[2 * k], H2[2 * k + 1]], o = O2[k];
      const preH1 = pairAt(C.clone().add(v3(-1.05, 0, -0.55)), HH, 0.6), preH2 = pairAt(C.clone().add(v3(-1.05, 0, 0.55)), HH, -0.6);
      const preO = pairAt(C.clone().add(v3(0.5, 0, 0)), OO, Math.PI / 2);
      const w1c = waterAt(C.clone().add(v3(-0.55, 0.2, 0))), w2c = waterAt(C.clone().add(v3(0.75, 0.2, 0)));
      const slot = (j) => v3(2.6 + (j % 5) * 1.15, 0.25, -1.7 + Math.floor(j / 5) * 1.2);
      const w1e = waterAt(slot(2 * k)), w2e = waterAt(slot(2 * k + 1));
      const plan = [[o[0], preO[0], w1c[0], w1e[0]], [o[1], preO[1], w2c[0], w2e[0]],
        [ha[0], preH1[0], w1c[1], w1e[1]], [ha[1], preH1[1], w1c[2], w1e[2]],
        [hb[0], preH2[0], w2c[1], w2e[1]], [hb[1], preH2[1], w2c[2], w2e[2]]];
      for (const [a, p1, p2, p3] of plan) { a.keys.push(p1, p2, p3); a.k = k; }
    }
    // избыток — подсветка
    for (let i = 2 * K; i < nH2; i++) spare.push(...H2[i]);
    for (let i = K; i < nO2; i++) spare.push(...O2[i]);
    for (const a of spare) {
      const g = glowSprite(0xffd23a, 1.4, 0);
      g.position.copy(a.keys[0]); root.add(g); extras.push(g);
    }
    setT(0);
    return { K, leftH2: nH2 - 2 * K, leftO2: nO2 - K, water: 2 * K };
  }

  function setT(nt) {
    t = nt;
    const w = K > 1 ? 0.42 : 1, d = K > 1 ? (1 - w) / (K - 1) : 0;
    let fl = 0;
    for (const a of atoms) {
      if (a.k < 0) { a.m.position.copy(a.keys[0]); continue; }
      const u = clamp01((t - a.k * d) / w);
      const [p0, p1, p2, p3] = a.keys;
      let p;
      if (u < 0.4) p = lerp3(p0, p1, easeInOut(u / 0.4));
      else if (u < 0.6) p = lerp3(p1, p2, easeInOut((u - 0.4) / 0.2));
      else p = lerp3(p2, p3, easeInOut((u - 0.6) / 0.4));
      if (u > 0.05 && u < 0.95) p = p.clone().add(v3(0, Math.sin(u * Math.PI) * 0.25, 0));
      a.m.position.copy(p);
      if (u > 0.4 && u < 0.6) fl = Math.max(fl, Math.sin(((u - 0.4) / 0.2) * Math.PI));
    }
    flash.material.opacity = fl * 0.9;
    const done = t >= 0.999;
    extras.forEach((g) => (g.material.opacity = done ? 0.75 : 0.2));
  }
  let beltOff = 0;
  viewer.onFrame((dt, el) => {
    if (playing) {
      setT(Math.min(1, t + dt / (2.2 + K * 0.9)));
      beltOff = (beltOff + dt * 0.9) % 0.72;
      slats.forEach((s, i) => (s.position.x = -8.4 + i * 0.72 + beltOff));
      if (t >= 1) playing = false;
    }
    if (t >= 0.999) extras.forEach((g, i) => g.scale.setScalar(1.3 + 0.2 * Math.sin(el * 4 + i)));
  });
  let playing = false;
  return {
    build,
    play() { if (t >= 0.999) setT(0); playing = true; },
    setT(v) { playing = false; setT(v); },
    get t() { return t; },
  };
}
