// Воздух: смесь газов в коробке и газ в шприце (закон Бойля — Мариотта).
import { THREE, sphereGeo, glossy } from "./core.js";
import { rng, blobMol, setOpacity, reduced } from "./y12-kit.js";
import { CPK } from "../data/molecules.js";

const V = (x, y, z) => new THREE.Vector3(x, y, z);

// ---------- Состав воздуха: 100 молекул ----------
export function createAirMix(viewer) {
  const R = rng(21);
  const g = new THREE.Group();
  viewer.scene.add(g);
  const H = V(3.6, 2.6, 2.6);
  const box = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(H.x * 2, H.y * 2, H.z * 2)), new THREE.LineBasicMaterial({ color: 0x7fa8ff, transparent: true, opacity: 0.6 }));
  g.add(box);
  const list = [];
  const kinds = [...Array(78).fill("N2"), ...Array(21).fill("O2"), "Ar", "CO2"];
  kinds.forEach((k, i) => {
    let m;
    if (k === "Ar") m = new THREE.Group().add(new THREE.Mesh(sphereGeo(0.42, 20), glossy(CPK.Ar)));
    else m = blobMol(k, 0.42);
    m.position.set((R() * 2 - 1) * (H.x - 0.4), (R() * 2 - 1) * (H.y - 0.4), (R() * 2 - 1) * (H.z - 0.4));
    m.rotation.set(R() * 6, R() * 6, R() * 6);
    const vel = V(R() - 0.5, R() - 0.5, R() - 0.5).normalize().multiplyScalar(0.8 + R() * 1.2);
    g.add(m);
    list.push({ k, m, vel, spin: V(R() - 0.5, R() - 0.5, R() - 0.5).multiplyScalar(3) });
  });
  const co2 = list.at(-1);
  let focus = "all";
  const apply = () => {
    for (const p of list) {
      if (p.k === "CO2") { setOpacity(p.m, focus === "CO2" ? 1 : 0); continue; }
      setOpacity(p.m, focus === "all" || focus === p.k ? 1 : 0.1);
    }
  };
  apply();
  viewer.onFrame((dt) => {
    for (const p of list) {
      p.m.position.addScaledVector(p.vel, dt);
      for (const ax of ["x", "y", "z"]) {
        const lim = H[ax] - 0.35;
        if (Math.abs(p.m.position[ax]) > lim) { p.m.position[ax] = Math.sign(p.m.position[ax]) * lim; p.vel[ax] *= -1; }
      }
      p.m.rotation.x += p.spin.x * dt; p.m.rotation.y += p.spin.y * dt;
    }
  });
  return { focus(k) { focus = k; apply(); }, co2 };
}

// ---------- Газ в шприце ----------
export function createSyringe(viewer) {
  const R = rng(9);
  const g = new THREE.Group();
  viewer.scene.add(g);
  const r = 1.25, X0 = -4.2, LMAX = 8;
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(r + 0.08, r + 0.08, LMAX + 0.6, 48, 1, true), new THREE.MeshPhysicalMaterial({ color: 0xcfe8ff, transparent: true, opacity: 0.14, roughness: 0.05, side: THREE.DoubleSide, depthWrite: false }));
  barrel.rotation.z = Math.PI / 2; barrel.position.x = X0 + LMAX / 2 + 0.3;
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(r + 0.08, r + 0.08, 0.12, 48), new THREE.MeshPhysicalMaterial({ color: 0xcfe8ff, transparent: true, opacity: 0.35 }));
  cap.rotation.z = Math.PI / 2; cap.position.x = X0 - 0.06;
  // носик закрыт пробкой
  const nose = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.32, 0.8, 24), glossy(0xd8342c));
  nose.rotation.z = Math.PI / 2; nose.position.x = X0 - 0.5;
  g.add(barrel, cap, nose);
  // шкала
  for (let i = 0; i <= 8; i++) {
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.03, i % 2 ? 0.25 : 0.45, 0.03), new THREE.MeshBasicMaterial({ color: 0x5b6b8c }));
    t.position.set(X0 + i, r + 0.1, 0.0); g.add(t);
  }
  const piston = new THREE.Group();
  const head = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.35, 48), glossy(0x30343c, { roughness: 0.6 }));
  head.rotation.z = Math.PI / 2;
  const rod = new THREE.Mesh(new THREE.BoxGeometry(3, 0.3, 0.3), glossy(0xdde3ee));
  rod.position.x = 1.7;
  const thumb = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 0.18, 40), glossy(0xdde3ee));
  thumb.rotation.z = Math.PI / 2; thumb.position.x = 3.25;
  piston.add(head, rod, thumb);
  g.add(piston);
  g.position.x = -1.1;

  const ps = [];
  for (let i = 0; i < 46; i++) {
    const m = blobMol(i % 5 === 0 ? "O2" : "N2", 0.22);
    const a = R() * Math.PI * 2, rr = Math.sqrt(R()) * (r - 0.3);
    m.position.set(X0 + 0.3 + R() * (LMAX - 0.6), Math.cos(a) * rr, Math.sin(a) * rr);
    g.add(m);
    ps.push({ m, vel: V(R() - 0.5, R() - 0.5, R() - 0.5).normalize().multiplyScalar(3.2 + R() * 2.4) });
  }
  let L = LMAX, LT = LMAX, heat = 1;
  const hits = [];
  let simT = 0;
  piston.position.x = X0 + L + 0.17;
  viewer.onFrame((dt) => {
    simT += dt;
    L += (LT - L) * Math.min(1, dt * 4);
    const px = X0 + L;
    piston.position.x = px + 0.17;
    const n = 3, h = dt / n;
    for (let s = 0; s < n; s++) for (const p of ps) {
      const q = p.m.position;
      q.addScaledVector(p.vel, h * heat);
      if (q.x < X0 + 0.2) { q.x = X0 + 0.2; p.vel.x = Math.abs(p.vel.x); }
      if (q.x > px - 0.2) { q.x = px - 0.2; if (p.vel.x > 0) { p.vel.x = -p.vel.x; hits.push(simT); } }
      const rr = Math.hypot(q.y, q.z), lim = r - 0.22;
      if (rr > lim) {
        const ny = q.y / rr, nz = q.z / rr, vn = p.vel.y * ny + p.vel.z * nz;
        if (vn > 0) { p.vel.y -= 2 * vn * ny; p.vel.z -= 2 * vn * nz; }
        q.y = ny * lim; q.z = nz * lim;
      }
      p.m.rotation.y += h * 3;
    }
    while (hits.length && hits[0] < simT - 3) hits.shift();
  });
  return {
    set(volFrac, hot) { LT = LMAX * volFrac; heat = hot ? Math.sqrt(373 / 293) : 1; if (reduced()) L = LT; },
    rate() { return hits.length / Math.min(3, Math.max(0.5, simT)); },
  };
}
