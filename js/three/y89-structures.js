// Геометрия молекул и фрагментов кристаллов для уроков «Неметаллы» и «Азот и фосфор».
// Все координаты — в ангстремах, центрированы; формат { atoms: [{el, pos}], bonds: [[i, j, order]] }.

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
function center(atoms) {
  const c = [0, 1, 2].map((k) => atoms.reduce((s, a) => s + a.pos[k], 0) / atoms.length);
  atoms.forEach((a) => (a.pos = a.pos.map((x, k) => x - c[k])));
  return atoms;
}
function bondsByDistance(atoms, d, tol = 0.12) {
  const out = [];
  for (let i = 0; i < atoms.length; i++) for (let j = i + 1; j < atoms.length; j++) if (Math.abs(dist(atoms[i].pos, atoms[j].pos) - d) < tol) out.push([i, j, 1]);
  return out;
}

// Корона S₈: два параллельных квадрата, повёрнутых на 45°. S–S 2,05 Å, угол S–S–S 108°
export function s8() {
  const b = 2.05, ang = (108 * Math.PI) / 180;
  const r = (2 * b * Math.sin(ang / 2)) / Math.SQRT2;
  const chord = 2 * r * Math.sin(Math.PI / 8);
  const hh = Math.sqrt(b * b - chord * chord) / 2;
  const atoms = [];
  for (let k = 0; k < 8; k++) {
    const phi = (k * Math.PI) / 4;
    atoms.push({ el: "S", pos: [r * Math.cos(phi), k % 2 ? hh : -hh, r * Math.sin(phi)] });
  }
  return { atoms, bonds: atoms.map((_, k) => [k, (k + 1) % 8, 1]) };
}

// Фрагмент решётки типа алмаза вокруг одного атома
export function diamondCluster(el = "C", bond = 1.54, R = 4.4) {
  const a = (bond * 4) / Math.sqrt(3);
  const basis = [[0, 0, 0], [0.5, 0.5, 0], [0.5, 0, 0.5], [0, 0.5, 0.5]];
  const atoms = [];
  for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) for (let k = -2; k <= 2; k++) for (const s of [0, 0.25]) for (const b of basis) {
    const p = [(i + b[0] + s) * a, (j + b[1] + s) * a, (k + b[2] + s) * a];
    if (Math.hypot(...p) <= R) atoms.push({ el, pos: p });
  }
  // убираем «висячие» атомы с одной связью, чтобы фрагмент выглядел аккуратно
  let bonds = bondsByDistance(atoms, bond);
  const deg = atoms.map((_, i) => bonds.filter(([p, q]) => p === i || q === i).length);
  const map = new Map(), kept = [];
  atoms.forEach((a, i) => { if (deg[i] >= 2) { map.set(i, kept.length); kept.push(a); } });
  bonds = bonds.filter(([p, q]) => map.has(p) && map.has(q)).map(([p, q]) => [map.get(p), map.get(q), 1]);
  return { atoms: center(kept), bonds };
}

// Кварц/кристобалит (идеализированно): каркас из тетраэдров SiO₄, атом O — мостик Si–O–Si
export function silica(R = 6.6) {
  const si = diamondCluster("Si", 3.08, R);
  const atoms = si.atoms.map((a) => ({ el: "Si", pos: a.pos }));
  const bonds = [];
  for (const [p, q] of si.bonds) {
    const A = atoms[p].pos, B = atoms[q].pos;
    const m = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2, (A[2] + B[2]) / 2];
    atoms.push({ el: "O", pos: m });
    const o = atoms.length - 1;
    bonds.push([p, o, 1], [o, q, 1]);
  }
  return { atoms, bonds };
}

// Графит: три слоя «пчелиных сот», C–C 1,42 Å, между слоями 3,35 Å (упаковка ABA)
export function graphite(R = 4.3) {
  const b = 1.42, a = b * Math.sqrt(3);
  const atoms = [];
  const layers = [-3.35, 0, 3.35];
  layers.forEach((y, li) => {
    const shift = li % 2 ? b : 0;
    for (let i = -6; i <= 6; i++) for (let j = -6; j <= 6; j++) for (const s of [0, b]) {
      const x = i * a + j * (a / 2);
      const z = j * (a * Math.sqrt(3)) / 2 + s + shift;
      if (Math.hypot(x, z - b / 2) <= R) atoms.push({ el: "C", pos: [x, y, z - b / 2] });
    }
  });
  let bonds = bondsByDistance(atoms, b, 0.05);
  return { atoms: center(atoms), bonds };
}

// Фуллерен C₆₀ — усечённый икосаэдр. Связи 6:6 (между шестиугольниками) — двойные
export function c60() {
  const f = (1 + Math.sqrt(5)) / 2;
  const base = [[0, 1, 3 * f], [1, 2 + f, 2 * f], [f, 2, 2 * f + 1]];
  const pts = [];
  for (const [x, y, z] of base) {
    for (const [p, q, r] of [[x, y, z], [y, z, x], [z, x, y]]) {
      for (const sx of [1, -1]) for (const sy of [1, -1]) for (const sz of [1, -1]) {
        const v = [p * sx, q * sy, r * sz];
        if (!pts.some((u) => dist(u, v) < 1e-6)) pts.push(v);
      }
    }
  }
  const k = 1.43 / 2; // ребро 2 → 1,43 Å
  const atoms = pts.map((p) => ({ el: "C", pos: p.map((x) => x * k) }));
  const nb = atoms.map((a, i) => atoms.map((b, j) => j).filter((j) => j !== i && Math.abs(dist(a.pos, atoms[j].pos) - 1.43) < 0.05));
  const bonds = [];
  for (let i = 0; i < atoms.length; i++) {
    const [a, b, c] = nb[i];
    const ang = (u, w) => {
      const p = atoms[i].pos, U = atoms[u].pos.map((x, t) => x - p[t]), W = atoms[w].pos.map((x, t) => x - p[t]);
      return Math.acos((U[0] * W[0] + U[1] * W[1] + U[2] * W[2]) / (Math.hypot(...U) * Math.hypot(...W)));
    };
    // пара соседей под углом 108° — ребро пятиугольника; третий сосед — связь 6:6
    const pairs = [[a, b, c], [a, c, b], [b, c, a]];
    const pent = pairs.reduce((m, p) => (ang(p[0], p[1]) < ang(m[0], m[1]) ? p : m));
    for (const j of nb[i]) if (j > i) bonds.push([i, j, j === pent[2] ? 2 : 1]);
  }
  return { atoms, bonds };
}

export function diatomic(el, d, order) {
  return { atoms: [{ el, pos: [-d / 2, 0, 0] }, { el, pos: [d / 2, 0, 0] }], bonds: [[0, 1, order]] };
}

// Белый фосфор P₄: правильный тетраэдр, P–P 2,21 Å, угол 60°
export function p4() {
  const d = 2.21, s = d / (2 * Math.SQRT2);
  const atoms = [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]].map((v) => ({ el: "P", pos: v.map((x) => x * s) }));
  const bonds = [];
  for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) bonds.push([i, j, 1]);
  return { atoms, bonds };
}

// Красный фосфор (упрощённо): цепочка тетраэдров P₄ с одной разорванной связью
export function redP(n = 3) {
  const one = p4();
  const atoms = [], bonds = [];
  for (let k = 0; k < n; k++) {
    const off = k * 3.125 - ((n - 1) * 3.125) / 2; // мостик между тетраэдрами тоже 2,21 Å
    const base = atoms.length;
    one.atoms.forEach((a) => atoms.push({ el: "P", pos: [a.pos[0] + off, a.pos[1], a.pos[2]] }));
    one.bonds.forEach(([i, j]) => { if (!(i === 0 && j === 3)) bonds.push([base + i, base + j, 1]); });
    if (k > 0) bonds.push([base - 4 + 0, base + 3, 1]);
  }
  return { atoms, bonds };
}

// Азотная кислота HNO₃: плоская; N–O 1,21 Å (две), N–OH 1,41 Å, O–H 0,96 Å
export function hno3() {
  const rad = (d) => (d * Math.PI) / 180;
  const at = (d, ang) => [d * Math.cos(rad(ang)), d * Math.sin(rad(ang)), 0];
  const atoms = [
    { el: "N", pos: [0, 0, 0] },
    { el: "O", pos: at(1.41, 180) },
    { el: "O", pos: at(1.21, 64) },
    { el: "O", pos: at(1.21, -66) },
  ];
  const o = atoms[1].pos;
  atoms.push({ el: "H", pos: [o[0] - 0.96 * Math.cos(rad(78)), o[1] + 0.96 * Math.sin(rad(78)), 0] });
  return { atoms: center(atoms), bonds: [[0, 1, 1], [0, 2, 2], [0, 3, 1], [1, 4, 1]] };
}

// Ион аммония NH₄⁺ — правильный тетраэдр
export function nh4() {
  const s = 1.03 / Math.sqrt(3);
  const atoms = [{ el: "N", pos: [0, 0, 0] }, ...[[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]].map((v) => ({ el: "H", pos: v.map((x) => x * s) }))];
  return { atoms, bonds: [[0, 1, 1], [0, 2, 1], [0, 3, 1], [0, 4, 1]] };
}

// Фосфорная кислота H₃PO₄: тетраэдр вокруг P, P=O 1,52 Å, P–OH 1,57 Å
export function h3po4() {
  const T = [[0, 1, 0], [0.9428, -1 / 3, 0], [-0.4714, -1 / 3, 0.8165], [-0.4714, -1 / 3, -0.8165]];
  const atoms = [{ el: "P", pos: [0, 0, 0] }];
  T.forEach((d, i) => atoms.push({ el: "O", pos: d.map((x) => x * (i ? 1.57 : 1.52)) }));
  const bonds = [[0, 1, 2], [0, 2, 1], [0, 3, 1], [0, 4, 1]];
  [2, 3, 4].forEach((i) => {
    // О–H под углом ≈ 110° к связи P–O, в сторону «вниз»
    const p = atoms[i].pos, n = p.map((x) => x / 1.57);
    const down = [0, -1, 0], dn = n[1] * -1;
    let w = down.map((x, k) => x - dn * n[k]);
    const wl = Math.hypot(...w); w = w.map((x) => x / wl);
    const d = n.map((x, k) => x * 0.34 + w[k] * 0.94);
    atoms.push({ el: "H", pos: p.map((x, k) => x + d[k] * 0.96) });
    bonds.push([i, atoms.length - 1, 1]);
  });
  return { atoms, bonds };
}
