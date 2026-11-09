// Диссоциация кислоты в воде: протон H⁺ переходит от молекулы кислоты к молекуле воды → H₃O⁺.
// Сильная кислота (HCl) отдаёт протоны все, слабая (CH₃COOH) — лишь изредка и обратимо.
import { THREE, sphereGeo, glossy, glowSprite, textSprite, easeInOut, clamp01 } from "./core.js";
import { CPK, COV_R, MOLECULES } from "../data/molecules.js";

const S = 0.62; // Å → сцена
const rad = (el) => Math.max(0.2, (COV_R[el] ?? 0.7) * 0.42) * 1.15;

// Кислота в локальной системе: донор в начале координат, кислотный H вдоль +x
function acidLocal(kind) {
  if (kind === "HCl") return { atoms: [{ el: "Cl", p: new THREE.Vector3(0, 0, 0) }, { el: "H", p: new THREE.Vector3(1.27, 0, 0) }], bonds: [], donor: 0, h: 1, anion: "Cl⁻" };
  const m = MOLECULES.find((x) => x.id === "CH3COOH").data;
  // в модели: 3 — O гидроксила, 4 — его H
  const O = new THREE.Vector3(...m.atoms[3].pos), H = new THREE.Vector3(...m.atoms[4].pos);
  const q = new THREE.Quaternion().setFromUnitVectors(H.clone().sub(O).normalize(), new THREE.Vector3(1, 0, 0));
  const atoms = m.atoms.map((a) => ({ el: a.el, p: new THREE.Vector3(...a.pos).sub(O).applyQuaternion(q) }));
  return { atoms, bonds: m.bonds.filter(([i, j]) => !(i === 4 || j === 4)), donor: 3, h: 4, anion: "CH₃COO⁻" };
}

export function createDissociation(viewer) {
  const root = new THREE.Group();
  root.scale.setScalar(S);
  viewer.scene.add(root);
  const bondMat = glossy(0xb8c2d8, { roughness: 0.45 });
  const cyl = new THREE.CylinderGeometry(0.1, 0.1, 1, 12);
  const mats = {};
  const mat = (el) => (mats[el] ||= glossy(CPK[el]));
  const setBond = (m, a, b) => {
    const d = b.clone().sub(a);
    m.position.copy(a).add(b).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize());
    m.scale.set(1, d.length(), 1);
  };
  let pairs = [], kind = "HCl", clock = 0;

  function build(k) {
    kind = k;
    clock = 0;
    viewer.clear(root);
    pairs = [];
    const A = acidLocal(k);
    const dXH = A.atoms[A.h].p.x;
    const cols = [-4.3, 4.3], rows = [-5, 0, 5];
    let n = 0;
    for (const z of rows) for (const x of cols) {
      const g = new THREE.Group();
      g.position.set(x - 0.8, (n % 2 ? 0.6 : -0.6), z);
      g.rotation.set(0, (n * 1.7) % 0.6 - 0.3, ((n * 2.3) % 0.5) - 0.25);
      root.add(g);
      const meshes = A.atoms.map((a) => { const m = new THREE.Mesh(sphereGeo(rad(a.el), 24), mat(a.el)); m.position.copy(a.p); g.add(m); return m; });
      A.bonds.forEach(([i, j]) => { const b = new THREE.Mesh(cyl, bondMat); setBond(b, A.atoms[i].p, A.atoms[j].p); g.add(b); });
      // вода: O на расстоянии водородной связи, её атомы H смотрят «от» кислоты
      const Ow = new THREE.Vector3(dXH + 1.75, 0, 0);
      const th = (66 * Math.PI) / 180; // даёт угол H–O–H ≈ 104,5°
      const Hw = [new THREE.Vector3(Math.cos(th), Math.sin(th), 0), new THREE.Vector3(Math.cos(th), -Math.sin(th) * 0.5, Math.sin(th) * 0.87)].map((d) => Ow.clone().add(d.multiplyScalar(0.96)));
      const wO = new THREE.Mesh(sphereGeo(rad("O"), 24), mat("O")); wO.position.copy(Ow); g.add(wO);
      Hw.forEach((p) => { const m = new THREE.Mesh(sphereGeo(rad("H"), 24), mat("H")); m.position.copy(p); g.add(m); const b = new THREE.Mesh(cyl, bondMat); setBond(b, Ow, p); g.add(b); });
      const hStart = A.atoms[A.h].p.clone(), hEnd = new THREE.Vector3(Ow.x - 0.98, 0.05, -0.25);
      const old = new THREE.Mesh(cyl, bondMat), neu = new THREE.Mesh(cyl, bondMat);
      g.add(old, neu);
      const glow = glowSprite(0xff6bb5, 2.4, 0); glow.position.copy(Ow); g.add(glow);
      const lblC = textSprite("H₃O⁺", { size: 0.7, color: "#ffc9e3" }); lblC.position.set(Ow.x + 0.3, 1.7, 0); g.add(lblC);
      const lblA = textSprite(A.anion, { size: 0.7, color: "#c5f6c9" }); lblA.position.set(-0.6, 1.9, 0); g.add(lblA);
      pairs.push({ g, H: meshes[A.h], donor: A.atoms[A.donor].p, Ow, hStart, hEnd, old, neu, glow, lblC, lblA, p: 0, ph: n * 0.7 });
      n++;
    }
    apply();
  }

  function apply() {
    for (const P of pairs) {
      const e = easeInOut(clamp01(P.p));
      const hp = P.hStart.clone().lerp(P.hEnd, e);
      P.H.position.copy(hp);
      P.old.visible = e < 0.55; P.neu.visible = e > 0.45;
      setBond(P.old, P.donor, hp); setBond(P.neu, P.Ow, hp);
      const done = clamp01((e - 0.8) / 0.2);
      P.glow.material.opacity = done * 0.55;
      P.lblC.material.opacity = done; P.lblA.material.opacity = done;
    }
  }
  viewer.onFrame((dt, t) => {
    clock += dt;
    pairs.forEach((P, i) => {
      if (kind === "HCl") P.p = clamp01((clock - 0.6 - i * 0.45) / 0.9);
      else if (i === 2) { const c = (clock % 6) / 6; P.p = c < 0.15 ? 0 : c < 0.3 ? (c - 0.15) / 0.15 : c < 0.65 ? 1 : c < 0.8 ? 1 - (c - 0.65) / 0.15 : 0; }
      else P.p = 0;
      P.g.position.y += Math.sin(t * 1.3 + P.ph) * 0.002;
    });
    apply();
  });
  return {
    build,
    count: () => pairs.filter((P) => P.p > 0.9).length,
    restart() { clock = 0; },
  };
}
