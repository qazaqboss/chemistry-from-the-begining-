// Зум «кубик сахара → кристаллики → кристаллическая решётка → молекула сахарозы → атом углерода».
import { THREE, sphereGeo, glossy, glowSprite, easeInOut } from "./core.js";
import { CPK } from "../data/molecules.js";
import { rng, makeMol, setOpacity, reduced } from "./y12-kit.js";

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const TET = (109.47 * Math.PI) / 180;

// Две оставшиеся тетраэдрические связи у атома с двумя известными соседями (a, b — единичные направления к ним)
function twoFree(a, b) {
  const m = a.clone().add(b).normalize().negate();
  const p = new THREE.Vector3().crossVectors(a, b).normalize();
  const c = Math.cos(TET / 2), s = Math.sin(TET / 2);
  return [m.clone().multiplyScalar(c).add(p.clone().multiplyScalar(s)), m.clone().multiplyScalar(c).sub(p.clone().multiplyScalar(s))];
}
function perp(a) {
  const t = Math.abs(a.y) < 0.9 ? V(0, 1, 0) : V(1, 0, 0);
  return new THREE.Vector3().crossVectors(a, t).normalize();
}

// Упрощённая, но химически честная модель сахарозы C₁₂H₂₂O₁₁:
// α-глюкопираноза (кресло) + β-фруктофураноза (конверт), связанные кислородным мостиком.
export function sucrose() {
  const atoms = [], bonds = [];
  const add = (el, p) => { atoms.push({ el, pos: p }); return atoms.length - 1; };
  const P = (i) => V(...atoms[i].pos);
  const link = (i, j) => bonds.push([i, j, 1]);
  const grow = (i, el, dir, len) => { const j = add(el, P(i).add(dir.clone().normalize().multiplyScalar(len)).toArray()); link(i, j); return j; };
  const hydroxyl = (c, dir) => { const o = grow(c, "O", dir, 1.43); const a = P(c).sub(P(o)).normalize(); grow(o, "H", a.clone().multiplyScalar(Math.cos(TET)).add(perp(a).multiplyScalar(Math.sin(TET))), 0.97); return o; };
  const ch2oh = (c, dir) => {
    const c6 = grow(c, "C", dir, 1.53);
    const a = P(c).sub(P(c6)).normalize();
    const od = a.clone().multiplyScalar(Math.cos(TET)).add(perp(a).multiplyScalar(Math.sin(TET)));
    const o = hydroxyl(c6, od);
    twoFree(a, P(o).sub(P(c6)).normalize()).forEach((d) => grow(c6, "H", d, 1.09));
    return c6;
  };
  const ring = (n, R, pucker, center, els) => {
    const ids = [];
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      const z = n === 6 ? (k % 2 ? -pucker : pucker) : k === 0 ? pucker * 1.6 : 0;
      ids.push(add(els[k], [center.x + Math.cos(a) * R, center.y + z, center.z + Math.sin(a) * R]));
    }
    for (let k = 0; k < n; k++) link(ids[k], ids[(k + 1) % n]);
    return ids;
  };
  // свободные направления у атома кольца: [аксиальное, экваториальное]
  const free = (ids, k) => {
    const n = ids.length, p = P(ids[k]);
    const d = twoFree(P(ids[(k + 1) % n]).sub(p).normalize(), P(ids[(k + n - 1) % n]).sub(p).normalize());
    return Math.abs(d[0].y) > Math.abs(d[1].y) ? d : [d[1], d[0]];
  };
  // глюкоза: кольцо O5, C1, C2, C3, C4, C5
  const g = ring(6, 1.42, 0.25, V(-2.3, 0, 0), ["O", "C", "C", "C", "C", "C"]);
  const [ax1, eq1] = free(g, 1);
  const oLink = grow(g[1], "O", ax1, 1.43); // α-связь — аксиальная
  grow(g[1], "H", eq1, 1.09);
  [2, 3, 4].forEach((k) => { const [ax, eq] = free(g, k); hydroxyl(g[k], eq); grow(g[k], "H", ax, 1.09); });
  { const [ax, eq] = free(g, 5); ch2oh(g[5], eq); grow(g[5], "H", ax, 1.09); }

  // фруктоза строится отдельно и пристраивается к мостиковому кислороду
  const start = atoms.length;
  const f = ring(5, 1.28, 0.25, V(0, 0, 0), ["C", "C", "C", "C", "O"]); // C2, C3, C4, C5, O5
  const [toO, other] = free(f, 0);
  const fLinkDir = toO.clone();
  ch2oh(f[0], other); // C1
  [1, 2].forEach((k) => { const [a, b] = free(f, k); hydroxyl(f[k], b); grow(f[k], "H", a, 1.09); });
  { const [a, b] = free(f, 3); ch2oh(f[3], b); grow(f[3], "H", a, 1.09); }
  // поворот и перенос фруктозного фрагмента
  const O = P(oLink);
  const aDir = P(g[1]).sub(O).normalize();
  const ang = (114 * Math.PI) / 180;
  const px = V(1, 0, 0).sub(aDir.clone().multiplyScalar(aDir.x)).normalize();
  const v = aDir.clone().multiplyScalar(Math.cos(ang)).add(px.multiplyScalar(Math.sin(ang))).normalize();
  const c2 = P(f[0]);
  const baseQ = new THREE.Quaternion().setFromUnitVectors(fLinkDir.clone().normalize(), v.clone().negate());
  const local = atoms.slice(start).map((a) => V(...a.pos).sub(c2));
  let best = null, bestD = -1;
  for (let t = 0; t < 24; t++) {
    const q = new THREE.Quaternion().setFromAxisAngle(v, (t / 24) * Math.PI * 2).multiply(baseQ);
    const pos = local.map((p) => p.clone().applyQuaternion(q).add(O.clone().add(v.clone().multiplyScalar(1.43))));
    let dmin = 99;
    for (const p of pos) for (let i = 0; i < start; i++) dmin = Math.min(dmin, p.distanceTo(P(i)));
    if (dmin > bestD) { bestD = dmin; best = pos; }
  }
  best.forEach((p, i) => (atoms[start + i].pos = p.toArray()));
  link(oLink, f[0]);
  // центрируем
  const c = atoms.reduce((s, a) => s.add(V(...a.pos)), V(0, 0, 0)).multiplyScalar(1 / atoms.length);
  atoms.forEach((a) => (a.pos = V(...a.pos).sub(c).toArray()));
  return { atoms, bonds };
}

export function createSugarZoom(viewer) {
  const R = rng(7);
  const levels = [];
  const white = (op = 1) => new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.25, clearcoat: 0.8, transparent: op < 1, opacity: op, sheen: 0.4 });

  // 0 — кубик сахара из спрессованных крупинок
  {
    const g = new THREE.Group();
    const n = 9, s = 4.2 / n;
    const im = new THREE.InstancedMesh(new THREE.BoxGeometry(s * 1.05, s * 1.05, s * 1.05), white(), n * n * n);
    const m = new THREE.Object3D();
    let k = 0;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) for (let l = 0; l < n; l++) {
      m.position.set((i - (n - 1) / 2) * s, (j - (n - 1) / 2) * s, (l - (n - 1) / 2) * s);
      m.rotation.set((R() - 0.5) * 0.5, (R() - 0.5) * 0.5, (R() - 0.5) * 0.5);
      m.updateMatrix();
      im.setMatrixAt(k++, m.matrix);
    }
    g.add(im);
    levels.push(g);
  }
  // 1 — отдельные кристаллики (моноклинные призмы)
  {
    const g = new THREE.Group();
    const geo = new THREE.BoxGeometry(1, 0.62, 0.8);
    geo.applyMatrix4(new THREE.Matrix4().makeShear(0, 0, 0.22, 0, 0, 0));
    const mat = white(0.92);
    for (let i = 0; i < 14; i++) {
      const c = new THREE.Mesh(geo, mat);
      const a = R() * Math.PI * 2, r = 0.6 + R() * 2.1;
      c.position.set(Math.cos(a) * r, (R() - 0.5) * 2.4, Math.sin(a) * r);
      c.rotation.set(R() * 3, R() * 3, R() * 3);
      c.scale.setScalar(0.7 + R() * 0.7);
      g.add(c);
    }
    levels.push(g);
  }
  const suc = sucrose();
  // 2 — кристалл: молекулы ровными рядами (моноклинная ячейка, 2 молекулы, винтовая ось 2₁)
  {
    const g = new THREE.Group();
    const a = 7.76, b = 8.7, c = 10.86, beta = (102.9 * Math.PI) / 180;
    const A = V(a, 0, 0), B = V(0, b, 0), C = V(c * Math.cos(beta), 0, c * Math.sin(beta));
    const per = {};
    const sites = [];
    for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) for (let k = 0; k < 2; k++) {
      const o = A.clone().multiplyScalar(i).add(B.clone().multiplyScalar(j)).add(C.clone().multiplyScalar(k));
      sites.push({ o, flip: false }, { o: o.clone().add(B.clone().multiplyScalar(0.5)).add(A.clone().multiplyScalar(0.5)).add(C.clone().multiplyScalar(0.5)), flip: true });
    }
    for (const s of sites) for (const at of suc.atoms) {
      const p = V(...at.pos).multiplyScalar(0.62);
      if (s.flip) { p.x = -p.x; p.z = -p.z; }
      (per[at.el] ||= []).push(p.add(s.o));
    }
    const all = Object.values(per).flat();
    const cen = all.reduce((s, p) => s.add(p), V(0, 0, 0)).multiplyScalar(1 / all.length);
    const m = new THREE.Object3D();
    for (const [el, ps] of Object.entries(per)) {
      const im = new THREE.InstancedMesh(sphereGeo(el === "H" ? 0.55 : 0.85, 10), glossy(CPK[el]), ps.length);
      ps.forEach((p, i) => { m.position.copy(p).sub(cen); m.updateMatrix(); im.setMatrixAt(i, m.matrix); });
      g.add(im);
    }
    g.scale.setScalar(3.2 / 13);
    const wrap = new THREE.Group(); wrap.add(g);
    levels.push(wrap);
  }
  // 3 — одна молекула сахарозы
  {
    const g = makeMol(suc.atoms, suc.bonds, { own: true });
    g.scale.setScalar(0.62);
    const w = new THREE.Group(); w.add(g);
    levels.push(w);
  }
  // 4 — атом углерода: крошечное ядро и облако электронов
  {
    const g = new THREE.Group();
    const nuc = new THREE.Group();
    for (let i = 0; i < 12; i++) {
      const s = new THREE.Mesh(sphereGeo(0.09, 12), glossy(i % 2 ? 0xff5a5a : 0x9aa7c7));
      s.position.set((R() - 0.5) * 0.2, (R() - 0.5) * 0.2, (R() - 0.5) * 0.2);
      nuc.add(s);
    }
    g.add(nuc, glowSprite(0xffd27a, 0.7, 0.8));
    const pts = [];
    for (let i = 0; i < 2600; i++) {
      // 1s — плотно у ядра, 2s/2p — дальше (радиальная плотность ~ r²e^{-r})
      const inner = i < 700;
      let r = 0; for (let k = 0; k < 3; k++) r -= Math.log(R() + 1e-6);
      r *= inner ? 0.12 : 0.55;
      const u = R() * 2 - 1, ph = R() * Math.PI * 2, sq = Math.sqrt(1 - u * u);
      pts.push(r * sq * Math.cos(ph), r * u, r * sq * Math.sin(ph));
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    g.add(new THREE.Points(geo, new THREE.PointsMaterial({ color: 0x7fd3ff, size: 0.05, transparent: true, opacity: 0.55, depthWrite: false })));
    levels.push(g);
  }
  levels.forEach((g) => viewer.scene.add(g));

  // поле зрения (м) на каждом уровне — для подписи масштаба
  const FIELD = [-2, -2.7, -8.4, -9, -9.7];
  let s = 0, target = 0;
  function apply() {
    levels.forEach((g, i) => {
      const d = s - i;
      const w = Math.max(0, 1 - Math.abs(d) * 1.35);
      setOpacity(g, easeInOut(w));
      g.scale.setScalar(Math.pow(9, d) * (i === 4 ? 2.2 : 1));
    });
  }
  apply();
  viewer.onFrame((dt, t) => {
    if (Math.abs(target - s) > 1e-3) { s += (target - s) * Math.min(1, dt * 6); apply(); }
    levels[4].children[0].rotation.y = t * 2;
  });
  return {
    set(v, instant = false) { target = v; if (instant || reduced()) { s = v; apply(); } },
    field(v) {
      const i = Math.min(3, Math.floor(v)), f = v - i;
      return Math.pow(10, FIELD[i] + (FIELD[i + 1] - FIELD[i]) * f);
    },
  };
}
