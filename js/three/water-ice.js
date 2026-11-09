// Вода: молекула с зарядами, лёд Ih ↔ жидкость ↔ пар, круговорот воды.
import { THREE, sphereGeo, glossy, glowSprite, textSprite, easeInOut, clamp01 } from "./core.js";
import { rng, mol, GEOM, dashLines, reduced } from "./y12-kit.js";

const V = (x, y, z) => new THREE.Vector3(x, y, z);

// ---------- 1. Молекула воды и водородная связь ----------
export function createWaterPair(viewer) {
  const g = new THREE.Group();
  viewer.scene.add(g);
  const make = () => {
    const w = new THREE.Group();
    w.add(mol("H2O", { k: 0.7, bond: 0.12 }));
    // неподелённые пары кислорода — по тетраэдру, «за спиной» у водородов
    const lpMat = new THREE.MeshPhysicalMaterial({ color: 0xff8a8a, transparent: true, opacity: 0.28, roughness: 0.3, depthWrite: false });
    for (const s of [1, -1]) {
      const lp = new THREE.Mesh(sphereGeo(0.32, 20), lpMat);
      lp.scale.set(1, 1.6, 1);
      const d = V(0, Math.cos((109.5 * Math.PI) / 360), s * Math.sin((109.5 * Math.PI) / 360)).normalize();
      lp.position.copy(d.clone().multiplyScalar(0.55));
      lp.quaternion.setFromUnitVectors(V(0, 1, 0), d);
      w.add(lp);
    }
    return w;
  };
  const w1 = make(), w2 = make();
  g.add(w1, w2);
  const lab = (t, color, p, parent) => { const s = textSprite(t, { color, size: 0.28 }); s.position.copy(p); parent.add(s); return s; };
  const hp = GEOM.H2O.atoms;
  lab("δ−", "#ff8a8a", V(0, 0.75, 0), w1);
  lab("δ+", "#cfe3ff", V(hp[1].pos[0] * 1.6, hp[1].pos[1] * 1.6, 0), w1);
  lab("δ+", "#cfe3ff", V(hp[2].pos[0] * 1.6, hp[2].pos[1] * 1.6, 0), w1);
  const ang = lab("104,5°", "#ffd27a", V(0, -1.05, 0), w1);
  ang.scale.multiplyScalar(0.8);
  // вторая молекула: её кислород смотрит на H первой (O···H ≈ 1,8 Å, O···O ≈ 2,8 Å)
  const hPos = V(...hp[1].pos);
  const dir = hPos.clone().normalize();
  const o2 = dir.clone().multiplyScalar(2.8);
  // одна из неподелённых пар второй молекулы направлена на водород первой
  const lpDir = V(0, Math.cos((109.5 * Math.PI) / 360), Math.sin((109.5 * Math.PI) / 360)).normalize();
  w2.quaternion.setFromUnitVectors(lpDir, dir.clone().negate());
  const far = o2.clone().add(dir.clone().multiplyScalar(4));
  const hb = dashLines(1, 0x7fd3ff);
  g.add(hb.lines);
  const hbLab = textSprite("водородная связь", { color: "#7fd3ff", size: 0.3 });
  g.add(hbLab);
  let m = 0, mt = 0;
  const apply = () => {
    const u = easeInOut(m);
    w2.position.lerpVectors(far, o2, u);
    w2.visible = u > 0.01;
    const show = u > 0.97;
    hb.set(show ? [[hPos, w2.position]] : []);
    hbLab.visible = show;
    hbLab.position.copy(hPos).add(w2.position).multiplyScalar(0.5).add(V(0, 0.45, 0));
    g.position.x = -o2.x * 0.5 * u;
    g.position.y = -o2.y * 0.5 * u;
  };
  apply();
  viewer.onFrame((dt) => { if (m !== mt) { m = mt > m ? Math.min(mt, m + dt * 0.8) : Math.max(mt, m - dt * 0.8); apply(); } });
  return { pair(on) { mt = on ? 1 : 0; if (reduced()) { m = mt; apply(); } } };
}

// ---------- 2. Лёд ↔ вода ↔ пар ----------
function iceLattice(nx = 3, ny = 3, nz = 2) {
  const a = 4.52, c = 7.36, u = 3 / 8;
  const A1 = V(a, 0, 0), A2 = V(-a / 2, 0, (a * Math.sqrt(3)) / 2), C = V(0, c, 0);
  const basis = [[1 / 3, 2 / 3, 0], [2 / 3, 1 / 3, 0.5], [1 / 3, 2 / 3, u], [2 / 3, 1 / 3, 0.5 + u]];
  const frac = [];
  for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) for (let k = 0; k < nz; k++)
    for (const b of basis) frac.push([(i + b[0]) / nx, (j + b[1]) / ny, ((k + b[2]) / nz) % 1]);
  const cart = (f) => A1.clone().multiplyScalar(f[0] * nx).add(A2.clone().multiplyScalar(f[1] * ny)).add(C.clone().multiplyScalar(f[2] * nz));
  const pos = frac.map(cart);
  // соседи с учётом периодичности (минимальный образ)
  const adj = pos.map(() => []);
  const edges = [];
  for (let i = 0; i < frac.length; i++) for (let j = i + 1; j < frac.length; j++) {
    const d = frac[i].map((x, k) => { let t = frac[j][k] - x; return t - Math.round(t); });
    const v = cart(d);
    if (v.length() < 3.0) { const e = { i, j, v, used: false }; edges.push(e); adj[i].push(e); adj[j].push(e); }
  }
  // Эйлеров цикл: каждая молекула отдаёт ровно 2 протона и принимает 2 (правила льда Бернала–Фаулера)
  const donor = new Map();
  const stack = [0], path = [];
  const ptr = adj.map(() => 0);
  const via = [null];
  while (stack.length) {
    const vtx = stack[stack.length - 1];
    let e = null;
    while (ptr[vtx] < adj[vtx].length && !e) { const c2 = adj[vtx][ptr[vtx]++]; if (!c2.used) e = c2; }
    if (e) { e.used = true; const w = e.i === vtx ? e.j : e.i; donor.set(e, vtx); stack.push(w); via.push(e); }
    else { stack.pop(); path.push(via.pop()); }
  }
  const hDirs = pos.map(() => []);
  for (const e of edges) {
    const d = donor.get(e);
    const dir = d === e.i ? e.v.clone() : e.v.clone().negate();
    hDirs[d].push(dir.normalize());
  }
  const cen = pos.reduce((s, p) => s.add(p), V(0, 0, 0)).multiplyScalar(1 / pos.length);
  pos.forEach((p) => p.sub(cen));
  return { pos, hDirs };
}

// кватернион, поворачивающий модель H₂O так, чтобы водороды смотрели по d1, d2
function orient(d1, d2) {
  const x = d1.clone().sub(d2).normalize();
  const y = d1.clone().add(d2).normalize().negate();
  const z = new THREE.Vector3().crossVectors(x, y).normalize();
  const y2 = new THREE.Vector3().crossVectors(z, x);
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y2, z));
}

export function createIceWater(viewer) {
  const R = rng(5);
  const root = new THREE.Group();
  root.scale.setScalar(0.42);
  viewer.scene.add(root);
  const { pos, hDirs } = iceLattice();
  const N = pos.length;
  const mols = [];
  // случайные места для жидкости: чуть плотнее льда, без перекрытий
  const half = V(7, 7.4, 6.4);
  const liq = [];
  for (let i = 0; i < N; i++) {
    let p, ok = false, tries = 0;
    while (!ok && tries++ < 400) {
      p = V((R() * 2 - 1) * half.x * 0.93, (R() * 2 - 1) * half.y * 0.93, (R() * 2 - 1) * half.z * 0.93);
      ok = liq.every((q) => q.distanceTo(p) > 2.65);
    }
    liq.push(p);
  }
  for (let i = 0; i < N; i++) {
    const g = mol("H2O", { k: 0.75, bond: 0.13 });
    root.add(g);
    const qIce = orient(hDirs[i][0], hDirs[i][1]);
    const axis = V(R() - 0.5, R() - 0.5, R() - 0.5).normalize();
    mols.push({ g, ice: pos[i], liq: liq[i], gas: liq[i].clone().multiplyScalar(2.4).add(V(R() - 0.5, R() - 0.5, R() - 0.5).multiplyScalar(6)), qIce, qLiq: new THREE.Quaternion().random(), axis, ph: R() * 10, sp: 0.6 + R() });
  }
  const hb = dashLines(400, 0x7fd3ff, 0.9);
  root.add(hb.lines);
  let st = 0, stT = 0; // 0 — лёд, 1 — вода, 2 — пар
  const tmpQ = new THREE.Quaternion(), spinQ = new THREE.Quaternion();
  const H1 = V(...GEOM.H2O.atoms[1].pos), H2 = V(...GEOM.H2O.atoms[2].pos);
  let bonds = 0;
  function update(t) {
    const a = clamp01(st), b = clamp01(st - 1);
    const ua = easeInOut(a), ub = easeInOut(b);
    for (const m of mols) {
      const wob = V(Math.sin(t * m.sp + m.ph), Math.sin(t * m.sp * 1.3 + m.ph * 2), Math.cos(t * m.sp * 0.9 + m.ph)).multiplyScalar(0.12 + 0.5 * ua + 1.6 * ub);
      m.g.position.lerpVectors(m.ice, m.liq, ua).lerp(m.gas, ub).add(wob);
      spinQ.setFromAxisAngle(m.axis, t * m.sp * (0.15 + 1.5 * ub) * ua);
      tmpQ.copy(m.qLiq).multiply(spinQ);
      m.g.quaternion.slerpQuaternions(m.qIce, tmpQ, ua);
    }
    // водородные связи: H одной молекулы близко к O другой
    const pairs = [];
    const hW = mols.map((m) => [H1.clone().applyQuaternion(m.g.quaternion).add(m.g.position), H2.clone().applyQuaternion(m.g.quaternion).add(m.g.position)]);
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
      if (i === j) continue;
      const O = mols[j].g.position;
      if (O.distanceToSquared(mols[i].g.position) > 10.5) continue;
      for (const hp of hW[i]) if (hp.distanceToSquared(O) < 2.4 * 2.4) pairs.push([hp, O]);
    }
    bonds = pairs.length;
    hb.set(pairs);
  }
  update(0);
  viewer.onFrame((dt, t) => {
    if (st !== stT) st = stT > st ? Math.min(stT, st + dt * 0.5) : Math.max(stT, st - dt * 0.5);
    update(t);
  });
  return {
    set(s) { stT = s; if (reduced()) { st = s; update(0); } },
    get bonds() { return bonds; },
    get count() { return N; },
  };
}

// ---------- 3. Круговорот воды ----------
export function createWaterCycle(viewer) {
  const R = rng(3);
  const g = new THREE.Group();
  viewer.scene.add(g);
  const sea = new THREE.Mesh(new THREE.BoxGeometry(6, 0.4, 5), glossy(0x2f86d8, { roughness: 0.15 }));
  sea.position.set(-3, -0.2, 0);
  const land = new THREE.Mesh(new THREE.BoxGeometry(6, 0.6, 5), glossy(0x5aa04a, { roughness: 0.8, clearcoat: 0 }));
  land.position.set(3, -0.1, 0);
  const mount = new THREE.Mesh(new THREE.ConeGeometry(2.2, 3.4, 7), glossy(0x7c6a58, { roughness: 0.9, clearcoat: 0, flatShading: true }));
  mount.position.set(3.6, 1.9, -0.6);
  const snow = new THREE.Mesh(new THREE.ConeGeometry(0.75, 1.15, 7), glossy(0xffffff, { roughness: 0.6 }));
  snow.position.set(3.6, 3.03, -0.6);
  g.add(sea, land, mount, snow);
  // река по склону
  const river = new THREE.CatmullRomCurve3([V(3.2, 1.2, 0.6), V(2.4, 0.4, 1.2), V(1.0, 0.22, 1.4), V(-0.4, 0.05, 1.2)]);
  g.add(new THREE.Mesh(new THREE.TubeGeometry(river, 40, 0.12, 8), glossy(0x3f9be8)));
  const sun = glowSprite(0xffd24a, 3.2, 1); sun.position.set(-5, 5.5, -2); g.add(sun);
  const cloud = new THREE.Group();
  const cMat = glossy(0xf4f7fb, { roughness: 0.9, clearcoat: 0 });
  for (let i = 0; i < 9; i++) { const s = new THREE.Mesh(sphereGeo(0.5 + R() * 0.45, 20), cMat); s.position.set((i - 4) * 0.45, R() * 0.4, (R() - 0.5) * 0.8); cloud.add(s); }
  cloud.position.set(1.2, 4.6, 0);
  g.add(cloud);
  const labs = [["Испарение", V(-3.4, 2.4, 1.6)], ["Конденсация", V(0, 5.8, 0)], ["Осадки", V(3.6, 4.6, 1.8)], ["Сток", V(1.4, 0.9, 2.2)]];
  labs.forEach(([t, p]) => { const s = textSprite(t, { size: 0.42 }); s.position.copy(p); g.add(s); });
  const drops = [];
  const dGeo = sphereGeo(0.06, 8), vMat = new THREE.MeshBasicMaterial({ color: 0x6fb8ff, transparent: true, opacity: 0.8 }), rMat = glossy(0x5fb6ff);
  for (let i = 0; i < 70; i++) { const m = new THREE.Mesh(dGeo, i < 30 ? vMat : rMat); g.add(m); drops.push({ m, kind: i < 30 ? "vap" : i < 55 ? "rain" : "river", ph: R(), x: R(), z: R() }); }
  let heat = 1;
  viewer.onFrame((dt, t) => {
    cloud.position.x = 1.2 + Math.sin(t * 0.3) * 0.5;
    for (const d of drops) {
      const p = (t * 0.25 * (d.kind === "river" ? 0.8 : heat) + d.ph) % 1;
      if (d.kind === "vap") { d.m.position.set(-5.5 + d.x * 5 + p * 2.5 * (1 + d.x), 0.1 + p * 4.4, (d.z - 0.5) * 3); d.m.material.opacity = 0.8 * Math.sin(p * Math.PI); }
      else if (d.kind === "rain") { d.m.position.set(cloud.position.x + 1 + d.x * 2.2, 4.1 - p * 3, (d.z - 0.5) * 1.6 + 0.4); d.m.scale.set(0.7, 2.2, 0.7); }
      else d.m.position.copy(river.getPoint(p)).add(V(0, 0.12, 0));
    }
  });
  return { heat(v) { heat = v; } };
}
