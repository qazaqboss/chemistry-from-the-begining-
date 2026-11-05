// Библиотека молекул с реальной геометрией (длины связей в ангстремах, углы по VSEPR).
// Координаты считаются здесь же из длин связей и углов, а не рисуются «на глаз».

// Цвета атомов по традиции CPK (как в школьных моделях)
export const CPK = {
  H: 0xf2f4f8, C: 0x3a3f4b, N: 0x3d6bff, O: 0xff3b3b, F: 0x7ee05a, Cl: 0x2fd35b, Br: 0xa52a2a, I: 0x9b30d0,
  S: 0xffd23a, P: 0xff8c1a, Na: 0xab5cf2, K: 0x8f40d4, Ca: 0x3dff6e, Mg: 0x8aff00, B: 0xffb5b5, Xe: 0x42b8ff,
  Fe: 0xe06633, Cu: 0xc88033, Si: 0xf0c8a0, Al: 0xbfa6a6, He: 0xd9ffff, Ne: 0xb3e3f5, Ar: 0x80d1e3,
};
// Ковалентные радиусы (Å) — для шаростержневой модели
export const COV_R = { H: 0.31, C: 0.76, N: 0.71, O: 0.66, F: 0.57, Cl: 1.02, Br: 1.2, I: 1.39, S: 1.05, P: 1.07, B: 0.84, Xe: 1.4, Si: 1.11, Na: 1.66, Ca: 1.76 };
// Ван-дер-Ваальсовы радиусы (Å) — для «заполненной» модели
export const VDW_R = { H: 1.2, C: 1.7, N: 1.55, O: 1.52, F: 1.47, Cl: 1.75, Br: 1.85, I: 1.98, S: 1.8, P: 1.8, B: 1.92, Xe: 2.16, Si: 2.1 };

// ---------- вектора ----------
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const subv = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => { const l = Math.hypot(...a) || 1; return mul(a, 1 / l); };
const perp = (a) => norm(Math.abs(a[0]) < 0.9 ? cross(a, [1, 0, 0]) : cross(a, [0, 1, 0]));
const TET = Math.acos(-1 / 3); // 109.47°

// Достраивает недостающие направления связей вокруг атома
// geom: "tet" (sp3), "tri" (sp2), "lin" (sp); dirs — уже занятые направления
function freeDirs(dirs, geom, need, twist = 0) {
  if (geom === "lin") return dirs.length ? [mul(dirs[0], -1)] : [[1, 0, 0], [-1, 0, 0]];
  if (geom === "tri") {
    if (dirs.length === 0) return [0, 1, 2].map((i) => [Math.cos(i * 2.0944 + twist), Math.sin(i * 2.0944 + twist), 0]);
    if (dirs.length === 1) {
      const a = dirs[0], u = perp(a);
      return [-1, 1].map((s) => norm(add(mul(a, -0.5), mul(u, s * 0.866))));
    }
    return [norm(mul(add(dirs[0], dirs[1]), -1))];
  }
  // tet
  if (dirs.length === 0) return [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]].map(norm);
  if (dirs.length === 1) {
    const a = dirs[0];
    const u = perp(a), w = cross(a, u);
    const out = [];
    for (let i = 0; i < need; i++) {
      const phi = twist + (i * 2 * Math.PI) / 3;
      out.push(norm(add(mul(a, -1 / 3), mul(add(mul(u, Math.cos(phi)), mul(w, Math.sin(phi))), Math.sqrt(8 / 9)))));
    }
    return out;
  }
  if (dirs.length === 2) {
    const m = norm(mul(add(dirs[0], dirs[1]), -1));
    const n = norm(cross(dirs[0], dirs[1]));
    const h = TET / 2;
    return [1, -1].map((s) => norm(add(mul(m, Math.cos(h)), mul(n, s * Math.sin(h)))));
  }
  return [norm(mul(add(add(dirs[0], dirs[1]), dirs[2]), -1))];
}

// Мини-конструктор молекулы
function mol() {
  const atoms = [], bonds = [];
  const api = {
    atoms, bonds,
    at(el, pos) { atoms.push({ el, pos }); return atoms.length - 1; },
    link(a, b, order = 1) { bonds.push([a, b, order]); },
    dirsOf(i) { return bonds.filter((b) => b[0] === i || b[1] === i).map((b) => norm(subv(atoms[b[0] === i ? b[1] : b[0]].pos, atoms[i].pos))); },
    grow(from, el, dir, len, order = 1) { const j = api.at(el, add(atoms[from].pos, mul(norm(dir), len))); api.link(from, j, order); return j; },
    // заполнить атом водородами по геометрии
    fillH(i, geom, count, len = 1.09, twist = 0) {
      const dirs = freeDirs(api.dirsOf(i), geom, count, twist).slice(0, count);
      return dirs.map((d) => api.grow(i, "H", d, len));
    },
    done(extra) { return { atoms, bonds, ...extra }; },
  };
  return api;
}

function centered(m) {
  const c = mul(m.atoms.reduce((s, a) => add(s, a.pos), [0, 0, 0]), 1 / m.atoms.length);
  m.atoms.forEach((a) => (a.pos = subv(a.pos, c)));
  return m;
}

// ---------- молекулы ----------
function diatomic(a, b, len, order) {
  const m = mol();
  const i = m.at(a, [-len / 2, 0, 0]);
  const j = m.at(b, [len / 2, 0, 0]);
  m.link(i, j, order);
  return m.done();
}

function bent(center, lig, len, angleDeg, orders = [1, 1]) {
  const m = mol();
  const c = m.at(center, [0, 0, 0]);
  const h = (angleDeg * Math.PI) / 360;
  m.link(c, m.at(lig, [Math.sin(h) * len, -Math.cos(h) * len, 0]), orders[0]);
  m.link(c, m.at(lig, [-Math.sin(h) * len, -Math.cos(h) * len, 0]), orders[1]);
  return centered(m.done());
}

function pyramid(center, lig, len, angleDeg, n = 3) {
  // три связи с заданным углом между ними (как у NH3)
  const m = mol();
  const c = m.at(center, [0, 0, 0]);
  const t = (angleDeg * Math.PI) / 180;
  // угол между связью и осью симметрии
  const cosA = Math.sqrt((1 + 2 * Math.cos(t)) / 3);
  const sinA = Math.sqrt(1 - cosA * cosA);
  for (let i = 0; i < n; i++) {
    const phi = (i * 2 * Math.PI) / 3;
    m.link(c, m.at(lig, [sinA * Math.cos(phi) * len, -cosA * len, sinA * Math.sin(phi) * len]));
  }
  return centered(m.done());
}

function methane() {
  const m = mol();
  const c = m.at("C", [0, 0, 0]);
  m.fillH(c, "tet", 4);
  return m.done();
}

function alkane(n) {
  // зигзаг: C–C 1,54 Å, угол 109,5°
  const m = mol();
  const dx = 1.54 * Math.sin(TET / 2), dy = 1.54 * Math.cos(TET / 2);
  const cs = [];
  for (let i = 0; i < n; i++) cs.push(m.at("C", [i * dx, i % 2 ? dy : 0, 0]));
  for (let i = 1; i < n; i++) m.link(cs[i - 1], cs[i]);
  cs.forEach((c, i) => m.fillH(c, "tet", n === 1 ? 4 : i === 0 || i === n - 1 ? 3 : 2, 1.09, i === 0 ? 0 : Math.PI / 3));
  return centered(m.done());
}

function alkene(n = 2) {
  const m = mol();
  const c1 = m.at("C", [-0.67, 0, 0]);
  const c2 = m.at("C", [0.67, 0, 0]);
  m.link(c1, c2, 2);
  if (n === 2) {
    m.fillH(c1, "tri", 2, 1.087);
    m.fillH(c2, "tri", 2, 1.087);
  }
  return m.done();
}

function ethyne() {
  const m = mol();
  const c1 = m.at("C", [-0.6, 0, 0]);
  const c2 = m.at("C", [0.6, 0, 0]);
  m.link(c1, c2, 3);
  m.grow(c1, "H", [-1, 0, 0], 1.06);
  m.grow(c2, "H", [1, 0, 0], 1.06);
  return m.done();
}

function benzene() {
  const m = mol();
  const cs = [];
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3;
    cs.push(m.at("C", [Math.cos(a) * 1.39, Math.sin(a) * 1.39, 0]));
  }
  for (let i = 0; i < 6; i++) m.link(cs[i], cs[(i + 1) % 6], i % 2 ? 1 : 2);
  cs.forEach((c, i) => {
    const a = (i * Math.PI) / 3;
    m.grow(c, "H", [Math.cos(a), Math.sin(a), 0], 1.09);
  });
  return m.done({ aromatic: true });
}

function alcohol(nC) {
  // метанол / этанол: цепь + O–H
  const m = mol();
  const dx = 1.54 * Math.sin(TET / 2), dy = 1.54 * Math.cos(TET / 2);
  const cs = [];
  for (let i = 0; i < nC; i++) cs.push(m.at("C", [i * dx, i % 2 ? dy : 0, 0]));
  for (let i = 1; i < nC; i++) m.link(cs[i - 1], cs[i]);
  const last = cs[nC - 1];
  // кислород продолжает зигзаг
  const oDir = nC === 1 ? [1, 0, 0] : [dx, nC % 2 ? dy : -dy, 0];
  const o = m.grow(last, "O", oDir, 1.43);
  cs.forEach((c, i) => m.fillH(c, "tet", nC === 1 ? 3 : i === 0 ? 3 : 2, 1.09, i === 0 ? Math.PI / 3 : 0));
  // H у кислорода: угол C–O–H ≈ 108°
  const back = norm(subv(m.atoms[last].pos, m.atoms[o].pos));
  const u = norm(cross(back, [0, 0, 1]));
  const t = (108 * Math.PI) / 180;
  m.grow(o, "H", add(mul(back, Math.cos(t)), mul(u, -Math.sin(t))), 0.96);
  return centered(m.done());
}

function aceticAcid() {
  const m = mol();
  const c1 = m.at("C", [0, 0, 0]);
  const c2 = m.grow(c1, "C", [1, 0, 0], 1.52);
  const [dO1, dO2] = freeDirs(m.dirsOf(c2), "tri", 2);
  m.grow(c2, "O", dO1, 1.21, 2);
  const o2 = m.grow(c2, "O", dO2, 1.34);
  const back = norm(subv(m.atoms[c2].pos, m.atoms[o2].pos));
  m.grow(o2, "H", freeDirs([back], "tet", 1, 0.6)[0], 0.97);
  m.fillH(c1, "tet", 3);
  return centered(m.done());
}

function formaldehyde() {
  const m = mol();
  const c = m.at("C", [0, 0, 0]);
  m.grow(c, "O", [0, 1, 0], 1.21, 2);
  m.fillH(c, "tri", 2, 1.11);
  return centered(m.done());
}

function planar3(center, lig, len) {
  const m = mol();
  const c = m.at(center, [0, 0, 0]);
  for (let i = 0; i < 3; i++) m.grow(c, lig, [Math.cos(i * 2.0944 + Math.PI / 2), Math.sin(i * 2.0944 + Math.PI / 2), 0], len);
  return m.done();
}

function octahedral(center, lig, len) {
  const m = mol();
  const c = m.at(center, [0, 0, 0]);
  [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]].forEach((d) => m.grow(c, lig, d, len));
  return m.done();
}

function bipyramid(center, lig, lenAx, lenEq) {
  const m = mol();
  const c = m.at(center, [0, 0, 0]);
  m.grow(c, lig, [0, 1, 0], lenAx);
  m.grow(c, lig, [0, -1, 0], lenAx);
  for (let i = 0; i < 3; i++) m.grow(c, lig, [Math.cos(i * 2.0944), 0, Math.sin(i * 2.0944)], lenEq);
  return m.done();
}

function squarePlanar(center, lig, len) {
  const m = mol();
  const c = m.at(center, [0, 0, 0]);
  [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]].forEach((d) => m.grow(c, lig, d, len));
  return m.done();
}

function linear3(a, b, len, order = 2) {
  const m = mol();
  const c = m.at(a, [0, 0, 0]);
  m.grow(c, b, [1, 0, 0], len, order);
  m.grow(c, b, [-1, 0, 0], len, order);
  return m.done();
}

function hcn() {
  const m = mol();
  const c = m.at("C", [0, 0, 0]);
  m.grow(c, "H", [-1, 0, 0], 1.07);
  m.grow(c, "N", [1, 0, 0], 1.16, 3);
  return centered(m.done());
}

function sulfuricAcid() {
  const m = mol();
  const s = m.at("S", [0, 0, 0]);
  const d = freeDirs([], "tet", 4);
  m.grow(s, "O", d[0], 1.42, 2);
  m.grow(s, "O", d[1], 1.42, 2);
  const o3 = m.grow(s, "O", d[2], 1.57);
  const o4 = m.grow(s, "O", d[3], 1.57);
  for (const o of [o3, o4]) {
    const back = norm(subv(m.atoms[s].pos, m.atoms[o].pos));
    m.grow(o, "H", freeDirs([back], "tet", 1, 1.2)[0], 0.97);
  }
  return m.done();
}

function hydrogenPeroxide() {
  const m = mol();
  const o1 = m.at("O", [-0.74, 0, 0]);
  const o2 = m.at("O", [0.74, 0, 0]);
  m.link(o1, o2);
  // двугранный угол ≈ 111°
  const t = (95 * Math.PI) / 180;
  m.grow(o1, "H", [-Math.cos(Math.PI - t), Math.sin(Math.PI - t), 0], 0.95);
  const dih = (111 * Math.PI) / 180;
  m.grow(o2, "H", [Math.cos(Math.PI - t), Math.sin(Math.PI - t) * Math.cos(dih), Math.sin(Math.PI - t) * Math.sin(dih)], 0.95);
  return centered(m.done());
}

function glucoseLike() {
  // упрощённый шестичленный цикл (кресло) — для красоты в уроке органики
  const m = mol();
  const ring = [];
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3;
    ring.push(m.at(i === 0 ? "O" : "C", [Math.cos(a) * 1.45, (i % 2 ? 0.25 : -0.25), Math.sin(a) * 1.45]));
  }
  for (let i = 0; i < 6; i++) m.link(ring[i], ring[(i + 1) % 6]);
  // OH-группы и H на углеродах
  for (let i = 1; i < 6; i++) {
    const c = ring[i];
    const [d1, d2] = freeDirs(m.dirsOf(c), "tet", 2);
    if (i === 5) {
      const c6 = m.grow(c, "C", d1, 1.53);
      const o6 = m.grow(c6, "O", freeDirs(m.dirsOf(c6), "tet", 1)[0], 1.43);
      m.fillH(c6, "tet", 2);
      m.fillH(o6, "tet", 1, 0.97);
      m.grow(c, "H", d2, 1.09);
    } else {
      const o = m.grow(c, "O", d1, 1.43);
      m.fillH(o, "tet", 1, 0.97);
      m.grow(c, "H", d2, 1.09);
    }
  }
  return centered(m.done());
}

export const MOLECULES = [
  { id: "H2", name: "Водород", formula: "H2", shape: "линейная", angle: "—", data: diatomic("H", "H", 0.74, 1), note: "Самая простая молекула: два протона делят одну пару электронов." },
  { id: "O2", name: "Кислород", formula: "O2", shape: "линейная", angle: "—", data: diatomic("O", "O", 1.21, 2), note: "Двойная связь. Им мы дышим." },
  { id: "N2", name: "Азот", formula: "N2", shape: "линейная", angle: "—", data: diatomic("N", "N", 1.1, 3), note: "Тройная связь — одна из самых прочных. Поэтому азот воздуха так инертен." },
  { id: "Cl2", name: "Хлор", formula: "Cl2", shape: "линейная", angle: "—", data: diatomic("Cl", "Cl", 1.99, 1), note: "Жёлто-зелёный ядовитый газ." },
  { id: "HCl", name: "Хлороводород", formula: "HCl", shape: "линейная", angle: "—", data: diatomic("H", "Cl", 1.27, 1), note: "Полярная связь: хлор сильнее тянет электроны. Раствор — соляная кислота." },
  { id: "H2O", name: "Вода", formula: "H2O", shape: "угловая", angle: "104,5°", data: bent("O", "H", 0.96, 104.5), note: "Две неподелённые пары на кислороде сжимают угол со 109,5° до 104,5°." },
  { id: "CO2", name: "Углекислый газ", formula: "CO2", shape: "линейная", angle: "180°", data: linear3("C", "O", 1.16, 2), note: "Две двойные связи направлены в противоположные стороны — молекула неполярна." },
  { id: "O3", name: "Озон", formula: "O3", shape: "угловая", angle: "117°", data: bent("O", "O", 1.28, 116.8, [2, 1]), note: "Защищает Землю от ультрафиолета. Связи на самом деле одинаковые (резонанс)." },
  { id: "NH3", name: "Аммиак", formula: "NH3", shape: "тригональная пирамида", angle: "107°", data: pyramid("N", "H", 1.01, 107), note: "Неподелённая пара азота поднимает «зонтик» из трёх водородов." },
  { id: "CH4", name: "Метан", formula: "CH4", shape: "тетраэдр", angle: "109,5°", data: methane(), note: "Четыре связи расходятся как можно дальше друг от друга — получается тетраэдр." },
  { id: "BF3", name: "Трифторид бора", formula: "BF3", shape: "плоский треугольник", angle: "120°", data: planar3("B", "F", 1.31), note: "Всего три пары у бора — они лежат в одной плоскости." },
  { id: "CH2O", name: "Формальдегид", formula: "CH2O", shape: "плоский треугольник", angle: "≈120°", data: formaldehyde(), note: "Двойная связь C=O; основа формалина." },
  { id: "HCN", name: "Синильная кислота", formula: "HCN", shape: "линейная", angle: "180°", data: hcn(), note: "Тройная связь C≡N. Очень ядовита." },
  { id: "PCl5", name: "Пентахлорид фосфора", formula: "PCl5", shape: "тригональная бипирамида", angle: "90° и 120°", data: bipyramid("P", "Cl", 2.14, 2.02), note: "Пять пар: три в «экваторе», две на «полюсах»." },
  { id: "SF6", name: "Гексафторид серы", formula: "SF6", shape: "октаэдр", angle: "90°", data: octahedral("S", "F", 1.56), note: "Шесть связей направлены вдоль осей x, y, z." },
  { id: "XeF4", name: "Тетрафторид ксенона", formula: "XeF4", shape: "плоский квадрат", angle: "90°", data: squarePlanar("Xe", "F", 1.95), note: "Благородный газ, который всё-таки вступил в реакцию! Две неподелённые пары — сверху и снизу." },
  { id: "H2O2", name: "Пероксид водорода", formula: "H2O2", shape: "«открытая книга»", angle: "≈95°", data: hydrogenPeroxide(), note: "Перекись водорода из аптечки." },
  { id: "H2SO4", name: "Серная кислота", formula: "H2SO4", shape: "тетраэдр вокруг S", angle: "≈109°", data: sulfuricAcid(), note: "Самый крупнотоннажный продукт химпромышленности." },
  { id: "C2H6", name: "Этан", formula: "C2H6", shape: "два тетраэдра", angle: "109,5°", data: alkane(2), note: "Вокруг одинарной связи C–C группы свободно вращаются." },
  { id: "C2H4", name: "Этилен", formula: "C2H4", shape: "плоская", angle: "≈120°", data: alkene(2), note: "Двойная связь не даёт вращаться — молекула плоская. Из неё делают полиэтилен." },
  { id: "C2H2", name: "Ацетилен", formula: "C2H2", shape: "линейная", angle: "180°", data: ethyne(), note: "Тройная связь; горит очень жарким пламенем (сварка)." },
  { id: "C6H6", name: "Бензол", formula: "C6H6", shape: "плоское кольцо", angle: "120°", data: benzene(), note: "Электроны «размазаны» по всему кольцу — особая ароматическая связь." },
  { id: "CH3OH", name: "Метанол", formula: "CH3OH", shape: "тетраэдры", angle: "≈109°", data: alcohol(1), note: "Древесный спирт. Ядовит!" },
  { id: "C2H5OH", name: "Этанол", formula: "C2H5OH", shape: "тетраэдры", angle: "≈109°", data: alcohol(2), note: "Винный спирт. Группа –OH делает вещество спиртом." },
  { id: "CH3COOH", name: "Уксусная кислота", formula: "CH3COOH", shape: "смешанная", angle: "≈120° и 109°", data: aceticAcid(), note: "Карбоксильная группа –COOH даёт кислотные свойства. Столовый уксус — её 9%-й раствор." },
  { id: "C6H12O6", name: "Глюкоза (цикл)", formula: "C6H12O6", shape: "кольцо-«кресло»", angle: "≈109°", data: glucoseLike(), note: "Главное «топливо» клеток. Упрощённая модель кольцевой формы." },
];

export const ALKANE_NAMES = ["метан", "этан", "пропан", "бутан", "пентан", "гексан", "гептан", "октан", "нонан", "декан"];
export { alkane };
