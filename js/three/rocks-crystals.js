// Минералы снаружи и внутри (кварц, пирит, галит) и выплавка железа из руды.
import { THREE, sphereGeo, glossy, bondMesh, easeInOut, clamp01 } from "./core.js";
import { CPK } from "../data/molecules.js";
import { rng, makeMol, GEOM, setOpacity } from "./y12-kit.js";

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const wrap01 = (x) => ((x % 1) + 1) % 1;

// ---------- атомные структуры ----------
function quartzAtoms() {
  // α-кварц, пр. гр. P3₂21: a = 4,913 Å, c = 5,405 Å; Si 3a, O 6c
  const a = 4.913, c = 5.405;
  const ops = [(p) => [p[0], p[1], p[2]], (p) => [-p[1], p[0] - p[1], p[2] + 2 / 3], (p) => [-p[0] + p[1], -p[0], p[2] + 1 / 3], (p) => [p[1], p[0], -p[2]], (p) => [p[0] - p[1], -p[1], -p[2] + 1 / 3], (p) => [-p[0], -p[0] + p[1], -p[2] + 2 / 3]];
  const uniq = (arr) => arr.filter((p, i) => arr.findIndex((q) => q.every((x, k) => Math.abs(x - p[k]) < 1e-4)) === i);
  const si = uniq(ops.map((f) => f([0.4697, 0, 2 / 3]).map(wrap01)));
  const o = uniq(ops.map((f) => f([0.4135, 0.2669, 0.1191 + 2 / 3]).map(wrap01)));
  const cart = (x, y, z) => V(a * x - (a / 2) * y, c * z, ((a * Math.sqrt(3)) / 2) * y);
  const atoms = [];
  const N = 3;
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) for (let k = 0; k < 2; k++) {
    si.forEach((p) => atoms.push({ el: "Si", p: cart(p[0] + i, p[1] + j, p[2] + k) }));
    o.forEach((p) => atoms.push({ el: "O", p: cart(p[0] + i, p[1] + j, p[2] + k) }));
  }
  return { atoms, bond: 1.7 };
}
function pyriteAtoms() {
  // пирит FeS₂, Pa-3: a = 5,418 Å, S (u,u,u), u = 0,385; пары S–S ≈ 2,16 Å
  const a = 5.418, u = 0.385;
  const fe = [[0, 0, 0], [0.5, 0.5, 0], [0.5, 0, 0.5], [0, 0.5, 0.5]];
  const s0 = [[u, u, u], [0.5 + u, 0.5 - u, -u], [-u, 0.5 + u, 0.5 - u], [0.5 - u, -u, 0.5 + u]];
  const s = [...s0, ...s0.map((p) => p.map((x) => -x))].map((p) => p.map(wrap01));
  const atoms = [];
  for (let i = -1; i <= 2; i++) for (let j = -1; j <= 2; j++) for (let k = -1; k <= 2; k++) {
    for (const p of fe) { const f = [p[0] + i, p[1] + j, p[2] + k]; if (f.every((x) => x >= -1e-6 && x <= 1.5 + 1e-6)) atoms.push({ el: "Fe", p: V(...f).multiplyScalar(a) }); }
    for (const p of s) { const f = [p[0] + i, p[1] + j, p[2] + k]; if (f.every((x) => x >= -0.12 && x <= 1.62)) atoms.push({ el: "S", p: V(...f).multiplyScalar(a) }); }
  }
  return { atoms, bond: 2.3, only: "S" };
}
function haliteAtoms() {
  const a = 5.64, atoms = [];
  for (let i = 0; i <= 4; i++) for (let j = 0; j <= 4; j++) for (let k = 0; k <= 4; k++) atoms.push({ el: (i + j + k) % 2 ? "Na" : "Cl", p: V(i, j, k).multiplyScalar(a / 2) });
  return { atoms, bond: 0 };
}

function buildAtoms({ atoms, bond, only }, scale) {
  const g = new THREE.Group();
  const cen = atoms.reduce((s, a) => s.add(a.p), V(0, 0, 0)).multiplyScalar(1 / atoms.length);
  const rad = { Si: 0.45, O: 0.32, Fe: 0.5, S: 0.45, Na: 0.42, Cl: 0.75 };
  const byEl = {};
  atoms.forEach((a) => (byEl[a.el] ||= []).push(a.p.clone().sub(cen)));
  const m = new THREE.Object3D();
  for (const [el, ps] of Object.entries(byEl)) {
    const im = new THREE.InstancedMesh(sphereGeo(rad[el], 20), glossy(el === "Si" ? 0xf0c8a0 : CPK[el]), ps.length);
    ps.forEach((p, i) => { m.position.copy(p); m.updateMatrix(); im.setMatrixAt(i, m.matrix); });
    g.add(im);
  }
  if (bond) {
    const bm = glossy(0xc7d2ea, { roughness: 0.5 });
    const all = Object.entries(byEl).flatMap(([el, ps]) => ps.map((p) => ({ el, p })));
    for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
      const A = all[i], B = all[j];
      if (only ? A.el !== only || B.el !== only : A.el === B.el) continue;
      if (A.p.distanceTo(B.p) < bond) g.add(bondMesh(A.p.toArray(), B.p.toArray(), 0.1, bm));
    }
  }
  g.scale.setScalar(scale);
  return g;
}

// ---------- внешний вид кристаллов ----------
function quartzShape() {
  const g = new THREE.Group();
  const mat = new THREE.MeshPhysicalMaterial({ color: 0xf2f6ff, roughness: 0.05, transmission: 0.6, thickness: 1, transparent: true, opacity: 0.75, clearcoat: 1, flatShading: true });
  const one = (h, r) => {
    const c = new THREE.Group();
    const prism = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 6), mat); prism.position.y = h / 2;
    const tip = new THREE.Mesh(new THREE.ConeGeometry(r, r * 1.3, 6), mat); tip.position.y = h + r * 0.65;
    c.add(prism, tip);
    return c;
  };
  [[3, 0.6, 0, 0], [2.2, 0.45, 0.5, 0.35], [1.8, 0.4, -0.45, -0.3], [1.4, 0.32, 0.2, -0.6]].forEach(([hh, r, rx, rz], i) => {
    const c = one(hh, r); c.rotation.set(rx, i, rz); g.add(c);
  });
  const base = new THREE.Mesh(new THREE.DodecahedronGeometry(1.3, 0), glossy(0x8a7f74, { roughness: 0.9, clearcoat: 0 }));
  base.scale.set(1.4, 0.5, 1.2); base.position.y = -0.2;
  g.add(base);
  g.position.y = -1.6;
  return g;
}
function cubes(color, extra, list) {
  const g = new THREE.Group();
  const mat = glossy(color, extra);
  list.forEach(([s, x, y, z, ry, rx]) => { const m = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), mat); m.position.set(x, y, z); m.rotation.set(rx || 0, ry, 0); g.add(m); });
  return g;
}

export const MINERALS = {
  quartz: { shape: quartzShape, atoms: () => buildAtoms(quartzAtoms(), 0.36) },
  pyrite: { shape: () => cubes(0xd9b54a, { metalness: 1, roughness: 0.28, clearcoat: 0.3 }, [[1.9, 0, 0, 0, 0.2], [1.3, 1.2, 0.7, 0.4, 0.7, 0.3], [1.0, -1.1, -0.6, 0.6, -0.4, 0.5]]), atoms: () => buildAtoms(pyriteAtoms(), 0.42) },
  halite: { shape: () => cubes(0xf6f2ee, { roughness: 0.15, transmission: 0.5, transparent: true, opacity: 0.85, clearcoat: 1 }, [[2, 0, 0, 0, 0.5], [1.2, 1.4, -0.4, 0.5, 0.2, 0.15], [0.9, -1.3, -0.7, -0.4, 0.9]]), atoms: () => buildAtoms(haliteAtoms(), 0.36) },
};

export function createMinerals(viewer) {
  const root = new THREE.Group();
  viewer.scene.add(root);
  const cache = {};
  let cur = null;
  function show(id, inside) {
    if (cur) cur.visible = false;
    const key = id + (inside ? ":in" : ":out");
    if (!cache[key]) { cache[key] = inside ? MINERALS[id].atoms() : MINERALS[id].shape(); root.add(cache[key]); }
    cur = cache[key];
    cur.visible = true;
  }
  return { show };
}

// ---------- Руда → металл: Fe₂O₃ + 3CO → 2Fe + 3CO₂ ----------
export function createSmelting(viewer) {
  const R = rng(17);
  const g = new THREE.Group();
  viewer.scene.add(g);
  const corners = [];
  for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) corners.push(V(x, y, z));
  const edges = [];
  for (let i = 0; i < 8; i++) for (let j = i + 1; j < 8; j++) if (corners[i].distanceTo(corners[j]) === 2) edges.push([i, j]);
  const feMat = glossy(CPK.Fe, { metalness: 0.2 });
  const fe = corners.map((c) => { const m = new THREE.Mesh(sphereGeo(0.55, 28), feMat); g.add(m); return { m, from: c.clone().multiplyScalar(1.9), to: c.clone().multiplyScalar(1.3) }; });
  const oMat = glossy(CPK.O);
  const oxy = edges.map(([i, j]) => { const m = new THREE.Mesh(sphereGeo(0.42, 24), oMat); const p = corners[i].clone().add(corners[j]).multiplyScalar(0.5 * 1.9); m.position.copy(p); g.add(m); return { m, home: p }; });
  // CO-молекулы прилетают к каждому кислороду
  const co = oxy.map((o, i) => {
    const dir = o.home.clone().normalize();
    const mm = makeMol(GEOM.CO.atoms, GEOM.CO.bonds, { k: 0.7, own: true });
    // повернём так, чтобы C смотрел на руду
    const holder = new THREE.Group(); holder.add(mm);
    const nb = new THREE.Group();
    for (const dz of [-0.08, 0.08]) nb.add(bondMesh([-0.56, 0, dz], [-1.72, 0, dz], 0.06, glossy(0xb8c2d8)));
    holder.add(nb);
    holder.quaternion.setFromUnitVectors(V(-1, 0, 0), dir.clone().negate());
    g.add(holder);
    const start = 0.04 + (i / oxy.length) * 0.55 + R() * 0.03;
    return { holder, dir, start, o, nb };
  });
  const glow = new THREE.PointLight(0xff5a1a, 0, 30, 1.5);
  glow.position.set(0, -4, 3);
  g.add(glow);
  let t = 0;
  function set(tt) {
    t = tt;
    glow.intensity = 30 * Math.sin(Math.PI * clamp01(t * 1.2));
    let left = 0;
    for (const c of co) {
      const u = clamp01((t - c.start) / 0.3);
      // 0–0,45: подлёт CO; 0,45–1: CO₂ улетает
      const contact = c.o.home.clone().add(c.dir.clone().multiplyScalar(1.16 + 0.56));
      const far = c.o.home.clone().add(c.dir.clone().multiplyScalar(9));
      if (u < 0.45) {
        const k = easeInOut(u / 0.45);
        c.holder.position.lerpVectors(far, contact, k);
        c.o.m.position.copy(c.o.home);
        c.nb.visible = false;
        left++;
      } else {
        const k = easeInOut((u - 0.45) / 0.55);
        c.holder.position.lerpVectors(contact, far.clone().add(V(0, 3, 0)), k);
        c.nb.visible = true;
        // кислород уходит вместе с CO и становится CO₂ (O=C=O на одной прямой)
        c.o.m.position.copy(c.holder.position).add(c.dir.clone().multiplyScalar(-(0.56 + 1.16)));
      }
      const fade = 1 - clamp01((u - 0.85) / 0.15);
      setOpacity(c.holder, u <= 0 ? 0 : fade);
      setOpacity(c.o.m, u < 0.45 ? 1 : fade);
    }
    const k = easeInOut(clamp01((t - 0.35) / 0.6));
    for (const f of fe) f.m.position.lerpVectors(f.from, f.to, k);
    feMat.color.setHex(CPK.Fe).lerp(new THREE.Color(0xb9c0cc), k);
    feMat.metalness = 0.2 + 0.75 * k;
    feMat.roughness = 0.32 - 0.12 * k;
    return { oLeft: left, co2: co.length - left };
  }
  set(0);
  viewer.onFrame((dt, time) => { g.rotation.y = time * 0.15; });
  return { set, get t() { return t; } };
}
