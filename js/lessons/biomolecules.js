import { h, kid, term, stage, chips, esc } from "../ui.js";
import { createViewer, THREE, sphereGeo, glossy } from "../three/core.js";
import { createMolecule, frame } from "../three/molecule.js";
import { CPK } from "../data/molecules.js";
import { betaGlucose, glyAla, condensation, createMorph, centerOf, haloGroup, dirXY, mul, add, plotStyles } from "../three/y1011-kit.js";

// ---------- ДНК ----------
const BASE_COL = { A: 0xff5d5d, T: 0xffc93c, G: 0x3ddc84, C: 0x4f8dff };
const PAIR = { A: "T", T: "A", G: "C", C: "G" };
const S = 0.2; // масштаб: 1 Å = 0.2 единицы сцены
const RISE = 3.38 * S, RP = 9 * S, TWIST = 360 / 10.5, GROOVE = 144; // B-форма: 10,5 пары на виток

function buildDNA(group, seq, T) {
  group.clear();
  const n = seq.length;
  const z0 = ((n - 1) * RISE) / 2;
  const pts1 = [], pts2 = [];
  const gc = (i) => { let s = 0, k = 0; for (let j = Math.max(0, i - 3); j <= Math.min(n - 1, i + 3); j++) { k++; if ("GC".includes(seq[j])) s++; } return s / k; };
  const slabGeo = new THREE.BoxGeometry(1, 0.1, 0.34);
  const pMat = glossy(CPK.P), hbMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const mats = Object.fromEntries(Object.entries(BASE_COL).map(([k, c]) => [k, glossy(c, { emissive: c, emissiveIntensity: 0.28 })]));
  let open = 0;
  for (let i = 0; i < n; i++) {
    const end = Math.min(i, n - 1 - i);
    const tm = 52 + 34 * gc(i) - 9 * Math.exp(-end / 2);
    const o = Math.min(1, Math.max(0, (T - tm) / 5));
    if (o > 0.5) open++;
    const a1 = (i * TWIST * Math.PI) / 180, a2 = a1 + (GROOVE * Math.PI) / 180;
    const z = i * RISE - z0;
    const P1c = new THREE.Vector3(RP * Math.cos(a1), RP * Math.sin(a1), z), P2c = new THREE.Vector3(RP * Math.cos(a2), RP * Math.sin(a2), z);
    const M = P1c.clone().add(P2c).multiplyScalar(0.5);
    const r = RP * (1 + 0.9 * o);
    const P1 = new THREE.Vector3(r * Math.cos(a1 - 0.25 * o), r * Math.sin(a1 - 0.25 * o), z), P2 = new THREE.Vector3(r * Math.cos(a2 + 0.25 * o), r * Math.sin(a2 + 0.25 * o), z);
    pts1.push(P1); pts2.push(P2);
    const half = P1c.distanceTo(M) - 0.05;
    [[P1, P1c, seq[i]], [P2, P2c, PAIR[seq[i]]]].forEach(([P, Pc, b]) => {
      const dir = M.clone().sub(Pc).normalize();
      const slab = new THREE.Mesh(slabGeo, mats[b]);
      slab.scale.x = half;
      slab.position.copy(P).addScaledVector(dir, half / 2);
      slab.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir);
      group.add(slab);
      const p = new THREE.Mesh(sphereGeo(0.17, 16), pMat); p.position.copy(P); group.add(p);
    });
    if (o < 0.3) {
      const k = "GC".includes(seq[i]) ? 3 : 2;
      const across = P2c.clone().sub(P1c).normalize(), side = new THREE.Vector3(-across.y, across.x, 0);
      for (let j = 0; j < k; j++) {
        const s = new THREE.Mesh(sphereGeo(0.045, 8), hbMat);
        s.position.copy(M).addScaledVector(side, (j - (k - 1) / 2) * 0.13);
        group.add(s);
      }
    }
  }
  [[pts1, 0xe8edf8], [pts2, 0x9fb1d6]].forEach(([pts, c]) => {
    const curve = new THREE.CatmullRomCurve3(pts);
    group.add(new THREE.Mesh(new THREE.TubeGeometry(curve, pts.length * 6, 0.09, 8, false), glossy(c, { roughness: 0.5 })));
  });
  return open;
}

// ---------- α-спираль: 3,6 остатка на виток, шаг 5,4 Å ----------
function alphaHelix(n = 18) {
  const g = new THREE.Group();
  const sc = 0.42;
  const P = (r, adeg, z) => new THREE.Vector3(r * Math.cos((adeg * Math.PI) / 180), r * Math.sin((adeg * Math.PI) / 180), z).multiplyScalar(sc);
  const mat = (e) => glossy(CPK[e]);
  const bMat = glossy(0xb8c2d8);
  const ball = (p, e, r) => { const m = new THREE.Mesh(sphereGeo(r, 18), mat(e)); m.position.copy(p); g.add(m); };
  const bond = (a, b, r = 0.06, m = bMat) => {
    const d = b.clone().sub(a);
    const c = new THREE.Mesh(new THREE.CylinderGeometry(r, r, d.length(), 10), m);
    c.position.copy(a).add(b).multiplyScalar(0.5);
    c.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
    g.add(c);
  };
  const res = [];
  for (let i = 0; i < n; i++) {
    const z = i * 1.5 - (n * 1.5) / 2, a = i * 100;
    const N = P(1.55, a - 28, z - 0.7), CA = P(2.3, a, z), C = P(1.6, a + 28, z + 0.7);
    const O = C.clone().add(new THREE.Vector3(0, 0, 1.23 * sc)), H = N.clone().add(new THREE.Vector3(0, 0, -1.0 * sc));
    const CB = P(3.6, a, z - 0.3);
    res.push({ N, CA, C, O, H });
    ball(N, "N", 0.16); ball(CA, "C", 0.17); ball(C, "C", 0.15); ball(O, "O", 0.15); ball(H, "H", 0.09);
    const sb = new THREE.Mesh(sphereGeo(0.2, 16), glossy(0x3ddc84)); sb.position.copy(CB); g.add(sb);
    bond(N, CA); bond(CA, C); bond(C, O, 0.05); bond(N, H, 0.04); bond(CA, CB, 0.05);
    if (i) bond(res[i - 1].C, N, 0.07, glossy(0xffd36e));
  }
  const hb = new THREE.LineDashedMaterial({ color: 0xffd36e, dashSize: 0.08, gapSize: 0.07 });
  for (let i = 0; i + 4 < n; i++) {
    const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints([res[i].O, res[i + 4].H]), hb);
    l.computeLineDistances(); g.add(l);
  }
  g.rotation.x = -Math.PI / 2;
  return g;
}

function subMol(R, tags) {
  const idx = {}; const atoms = tags.map((t, i) => { idx[t] = i; return { el: R.el[t], pos: [...R.start[t]], tag: t }; });
  const bonds = R.sb.filter(([a, b]) => a in idx && b in idx).map(([a, b, o]) => [idx[a], idx[b], o]);
  return centerOf({ atoms, bonds });
}

export async function render(el) {
  el.appendChild(h(`<div>${plotStyles()}
    <p class="lead">Живая клетка на 70 % состоит из воды, а остальное — в основном четыре класса органических веществ: углеводы, липиды (жиры), белки и нуклеиновые кислоты. Их молекулы огромны, но собраны из простых «кирпичиков» знакомыми реакциями конденсации.</p>
    ${kid("Белки, ДНК и крахмал — как бусы. Бусинки — маленькие молекулы (аминокислоты, нуклеотиды, глюкоза), а нитка — химические связи между ними. Когда бусинки соединяются, каждый раз «выпадает» капелька воды!")}
    <p class="small muted">Жиры и мыла разобраны в уроке <a href="#lesson-functional">«Спирты, альдегиды, кислоты»</a>.</p>
  </div>`));

  el.appendChild(h(`<section id="carbs"><h2>Углеводы</h2>
    <p>${term("carbohydrate", "Углеводы")} — альдегидо- и кетоноспирты и их полимеры, общая формула многих из них Cₙ(H₂O)ₘ. Делятся на <b>моносахариды</b> (глюкоза, фруктоза C₆H₁₂O₆; рибоза C₅H₁₀O₅), <b>дисахариды</b> (сахароза, мальтоза, лактоза C₁₂H₂₂O₁₁) и <b>полисахариды</b> (крахмал, гликоген, целлюлоза (C₆H₁₀O₅)ₙ).</p>
    <p><b>Глюкоза</b> в растворе существует в равновесии: открытая цепь (альдегид с пятью OH-группами, менее 0,1 %) ⇄ кольцевые α- и β-формы. В кольце OH при атоме C1 может смотреть «вниз» (α) или «вверх» (β); у β-глюкозы все крупные группы экваториальны, поэтому её в растворе больше (≈ 64 %).</p>
    <div class="table-wrap"><table class="data">
      <tr><th>Свойство глюкозы</th><th>Реакция</th></tr>
      <tr><td>многоатомный спирт</td><td>с Cu(OH)₂ на холоду — ярко-синий раствор</td></tr>
      <tr><td>альдегид</td><td>«серебряное зеркало»; с Cu(OH)₂ при нагревании — красный Cu₂O</td></tr>
      <tr><td>спиртовое брожение (дрожжи)</td><td class="formula">C₆H₁₂O₆ → 2C₂H₅OH + 2CO₂</td></tr>
      <tr><td>молочнокислое брожение</td><td class="formula">C₆H₁₂O₆ → 2CH₃–CH(OH)–COOH</td></tr>
      <tr><td>дыхание</td><td class="formula">C₆H₁₂O₆ + 6O₂ → 6CO₂ + 6H₂O, ΔH = −2803 кДж</td></tr>
    </table></div>
    <p><b>Крахмал</b> — полимер α-глюкозы (связи α-1,4; спирали, синее окрашивание с иодом), <b>целлюлоза</b> — полимер β-глюкозы (прямые цепи, сшитые водородными связями в прочные волокна). Разница в одной «ориентации» OH-группы делает картофель съедобным, а бумагу — нет: у человека нет фермента для β-связей. Сахароза — не восстанавливающий дисахарид (глюкоза + фруктоза связаны через оба «альдегидных» атома), «серебряного зеркала» не даёт.</p>
  </section>`));

  // ---------- 3D молекулы ----------
  const s2 = h(`<section id="mol3d"><h2>Глюкоза, аминокислоты и пептидная связь в 3D</h2>
    <p>${term("amino_acid", "Аминокислоты")} несут две группы: основную –NH₂ и кислотную –COOH, поэтому они амфотерны и в растворе существуют в виде внутренней соли (цвиттер-иона) H₃N⁺–CHR–COO⁻. Карбоксил одной аминокислоты и аминогруппа другой соединяются ${term("peptide_bond", "пептидной связью")} –CO–NH– с отщеплением воды. Все 19 хиральных аминокислот белков — L-формы.</p></section>`);
  el.appendChild(s2);
  const cb = h(`<div style="margin-bottom:10px"></div>`);
  s2.appendChild(cb);
  const st2 = stage(`<div class="overlay"><span data-t style="font-size:1rem"></span><span data-i></span></div>`, { wide: true });
  s2.appendChild(st2);
  const c2 = h(`<div class="card pad" style="margin-top:10px"><div class="row" data-pl><button class="btn primary" type="button" data-go>▶ Соединить</button><input type="range" min="0" max="1" step="0.001" value="0" style="flex:1"></div><p data-n style="margin:10px 0 0"></p></div>`);
  s2.appendChild(c2);
  const v2 = createViewer(st2, { camera: [0, 1.5, 11], fitWidth: 4.2, minDistance: 3, maxDistance: 40, autoRotateSpeed: 0.5 });
  const prod = glyAla();
  const NAL = prod.atoms.find((a) => a.tag === "Nal").pos;
  const R = condensation(prod, {
    acylC: "Cg", link: "Nal", right: ["Nal", "Hn2", "Ca2", "Haa", "Cb", "Hb0", "Hb1", "Hb2", "C2", "O2a", "O2b", "Ht"],
    offset: mul(dirXY(-30), 2.8), waterAt: add(NAL, [-0.4, -3.1, 0]), hxAngle: -106,
  });
  const center = mul(prod.atoms.reduce((s, a) => add(s, a.pos), [0, 0, 0]), -1 / prod.atoms.length);
  const gly = subMol(R, ["N1", "Hn0", "Hn1", "Ca1", "Hag0", "Hag1", "Cg", "Og", "Ow", "Hw1"]);
  const ala = subMol(R, ["Nal", "Hn2", "Hw2", "Ca2", "Haa", "Cb", "Hb0", "Hb1", "Hb2", "C2", "O2a", "O2b", "Ht"]);
  const glu = betaGlucose();
  const mol = createMolecule(v2, glu);
  const morph = createMorph(v2, R); morph.group.position.set(...center);
  const helix = alphaHelix(); v2.scene.add(helix);
  let halo = null;
  const ITEMS = [
    { label: "β-глюкоза", kind: "mol", data: glu, t: "β-D-глюкопираноза", i: "C₆H₁₂O₆ · кольцо «кресло»", n: "Шестичленное кольцо из пяти атомов C и одного O (красный в кольце) в конформации «кресло» — как у циклогексана. Все четыре OH и группа CH₂OH экваториальны (торчат «вбок»), атомы H — аксиальны (вверх-вниз). Поэтому β-глюкоза — самый устойчивый и самый распространённый моносахарид на Земле." },
    { label: "Глицин", kind: "mol", data: gly, t: "Глицин (Gly)", i: "H₂N–CH₂–COOH · единственная нехиральная", n: "Простейшая аминокислота: R = H. У атома Cα два одинаковых заместителя (H), поэтому зеркальных изомеров нет." },
    { label: "L-аланин", kind: "mol", data: ala, t: "L-аланин (Ala)", i: "H₂N–CH(CH₃)–COOH", n: "R = CH₃. Атом Cα связан с четырьмя разными группами — он хиральный. В белках встречается только L-форма (по правилам CIP — S): зеркальный D-аланин клеткой не используется." },
    { label: "Gly + Ala → дипептид", kind: "morph", t: "Образование пептидной связи", i: "Gly + Ala → Gly–Ala + H₂O", n: "Группа OH карбоксила глицина и атом H аминогруппы аланина уходят в виде воды; атомы C и N соединяются. Связь C–N в пептидной группе частично двойная (1,33 Å вместо 1,47 Å): группа –CO–NH– плоская и не вращается — это задаёт форму белков." },
    { label: "α-спираль", kind: "helix", t: "α-спираль (вторичная структура)", i: "3,6 остатка на виток · шаг 5,4 Å", n: "Цепь закручена в правую спираль. Группа C=O каждого остатка (красный) связана водородной связью (жёлтый пунктир) с N–H остатка, стоящего на четыре позиции дальше. Зелёные шарики — радикалы R, они торчат наружу. Открыта Л. Полингом в 1951 г." },
  ];
  const rng = c2.querySelector("input");
  let play = false;
  const show = (it) => {
    mol.group.visible = it.kind === "mol"; morph.group.visible = it.kind === "morph"; helix.visible = it.kind === "helix";
    c2.querySelector("[data-pl]").style.display = it.kind === "morph" ? "" : "none";
    if (halo) { v2.clear(halo); v2.scene.remove(halo); halo = null; }
    if (it.kind === "mol") { mol.set(it.data); mol.group.rotation.x = it.data === glu ? -1.15 : 0; frame(v2, mol.radius() + (it.data === glu ? 0.3 : -0.2)); }
    if (it.kind === "morph") { morph.setT(0); rng.value = 0; frame(v2, 6.2); }
    if (it.kind === "helix") frame(v2, 6.4);
    st2.querySelector("[data-t]").innerHTML = `<b>${it.t}</b>`;
    st2.querySelector("[data-i]").textContent = it.i;
    c2.querySelector("[data-n]").innerHTML = it.n;
  };
  chips(cb, ITEMS, show);
  rng.oninput = () => { play = false; morph.setT(+rng.value); };
  c2.querySelector("[data-go]").onclick = () => { if (morph.t >= 0.999) morph.setT(0); play = true; };
  let last = performance.now();
  v2.onFrame(() => { const n = performance.now(), dt = Math.min(0.05, (n - last) / 1000); last = n; if (play) { const t = Math.min(1, morph.t + dt / 5); morph.setT(t); rng.value = t; if (t >= 1) play = false; } });
  show(ITEMS[0]);

  el.appendChild(h(`<section id="proteins"><h2>Белки</h2>
    <p>Белки — полипептиды из 20 видов α-аминокислот, от ~50 до десятков тысяч остатков. Их пространственное строение описывают четырьмя уровнями:</p>
    <div class="table-wrap"><table class="data">
      <tr><th>Структура</th><th>Что это</th><th>Чем удерживается</th></tr>
      <tr><td>первичная</td><td>последовательность аминокислот</td><td>пептидные (ковалентные) связи</td></tr>
      <tr><td>вторичная</td><td>α-спираль, β-складчатый слой</td><td>водородные связи C=O···H–N остова</td></tr>
      <tr><td>третичная</td><td>укладка цепи в глобулу</td><td>дисульфидные мостики –S–S–, ионные, водородные, гидрофобные взаимодействия радикалов</td></tr>
      <tr><td>четвертичная</td><td>несколько цепей вместе (гемоглобин — 4)</td><td>те же нековалентные взаимодействия</td></tr>
    </table></div>
    <p><b>Денатурация</b> — разрушение вторичной–четвертичной структуры при нагревании, действии кислот, щелочей, солей тяжёлых металлов, спирта; первичная структура сохраняется (свёрнутый яичный белок). <b>Гидролиз</b> (кислота/щёлочь при нагревании или ферменты) разрушает и пептидные связи — до аминокислот. Белки-${term("enzyme", "ферменты")} ускоряют реакции в клетке в 10⁶–10¹² раз (см. урок <a href="#lesson-kinetics">«Скорость реакций и катализ»</a>).</p>
    <div class="callout"><b>Цветные реакции белков.</b> <b>Биуретовая</b>: NaOH + CuSO₄ → фиолетовое окрашивание (на пептидные связи, есть у любых белков). <b>Ксантопротеиновая</b>: HNO₃ конц. → жёлтое окрашивание (нитрование ароматических колец остатков тирозина, фенилаланина).</div>
  </section>`));

  // ---------- ДНК ----------
  const s4 = h(`<section id="dna"><h2>ДНК: двойная спираль в 3D</h2>
    <p>Нуклеиновые кислоты — полимеры из ${term("nucleotide", "нуклеотидов")}: азотистое основание + пентоза (дезоксирибоза в ДНК, рибоза в РНК) + остаток фосфорной кислоты. Сахар и фосфат образуют «перила» (оранжевые шарики — атомы фосфора), основания — «ступеньки». Пары строго ${term("complementarity", "комплементарны")}: <b style="color:#ff5d5d">A</b>–<b style="color:#e0a800">T</b> держатся двумя водородными связями, <b style="color:#2fbf6f">G</b>–<b style="color:#4f8dff">C</b> — тремя (белые точки). Модель — B-форма: 10,5 пары на виток, 3,4 Å между парами, диаметр 20 Å; видны широкая (большая) и узкая (малая) бороздки.</p></section>`);
  el.appendChild(s4);
  const st4 = stage(`<div class="overlay"><span data-t style="font-size:1rem"></span><span data-i></span></div>`, { wide: true });
  s4.appendChild(st4);
  const c4 = h(`<div class="card pad" style="margin-top:10px">
    <label class="ctl">Последовательность одной цепи 5′→3′ (буквы A, T, G, C; до 42)<input class="yk-in" data-seq type="text" maxlength="42" value="ATGCGCTTAAGCGGATCCTATAAATGCGC" spellcheck="false" autocomplete="off" style="font-family:var(--mono)"></label>
    <label class="ctl" style="margin-top:10px">Температура: <b data-tv></b><input type="range" data-T min="20" max="100" value="25"></label>
    <p data-n class="small" style="margin:10px 0 0;font-family:var(--mono);word-break:break-all"></p>
    <p data-m class="small" style="margin:6px 0 0"></p></div>`);
  s4.appendChild(c4);
  const v4 = createViewer(st4, { camera: [0, 0, 16], autoRotate: false, minDistance: 3, maxDistance: 60 });
  v4.onFrame((dt) => { dna.rotation.z += dt * 0.35; });
  let lastN = 0;
  const dna = new THREE.Group(); v4.scene.add(dna); dna.rotation.x = -Math.PI / 2; dna.rotation.z = 0.3;
  const helixHolder = new THREE.Group(); v4.scene.add(helixHolder); helixHolder.add(dna); helixHolder.rotation.z = Math.PI / 2;
  const redraw = () => {
    let seq = c4.querySelector("[data-seq]").value.toUpperCase().replace(/[^ATGC]/g, "");
    if (seq.length < 4) seq = "ATGC";
    const T = +c4.querySelector("[data-T]").value;
    v4.clear(dna);
    const open = buildDNA(dna, seq, T);
    const n = seq.length, g = [...seq].filter((b) => "GC".includes(b)).length;
    if (n !== lastN) { lastN = n; frame(v4, (n * RISE) / 2 + 0.6); }
    const comp = [...seq].map((b) => PAIR[b]).join("");
    const tm = n < 14 ? 2 * (n - g) + 4 * g : 64.9 + (41 * (g - 16.4)) / n;
    c4.querySelector("[data-tv]").textContent = T + " °C";
    st4.querySelector("[data-t]").innerHTML = `<b>${n} пар · ${(n / 10.5).toFixed(1).replace(".", ",")} витка</b>`;
    st4.querySelector("[data-i]").textContent = open ? `расплетено пар: ${open} из ${n}` : `GC = ${Math.round((g / n) * 100)} %`;
    c4.querySelector("[data-n]").innerHTML = `5′-${esc(seq)}-3′<br>3′-${esc(comp)}-5′`;
    c4.querySelector("[data-m]").innerHTML = `Оценка температуры плавления: <b>${Math.round(tm)} °C</b> (${n < 14 ? "правило Уоллеса: 2·(A+T) + 4·(G+C)" : "формула 64,9 + 41·(G+C − 16,4)/N"}). Нагревай: сначала «плавятся» концы и участки, богатые A–T, а GC-богатые держатся дольше — у пары G–C три водородные связи. Так работает ПЦР: при 95 °C цепи расходятся, при охлаждении снова находят комплементарного партнёра.`;
  };
  c4.querySelector("[data-seq]").oninput = redraw;
  c4.querySelector("[data-T]").oninput = redraw;
  redraw();
  s4.appendChild(h(`<div class="yk-leg"><span><i style="background:#ff5d5d"></i>аденин A</span><span><i style="background:#ffc93c"></i>тимин T</span><span><i style="background:#3ddc84"></i>гуанин G</span><span><i style="background:#4f8dff"></i>цитозин C</span><span><i style="background:#ff8c1a"></i>фосфор P</span></div>`));

  el.appendChild(h(`<section id="chargaff"><h2>ДНК и РНК: сравнение и задача</h2>
    <div class="table-wrap"><table class="data">
      <tr><th></th><th>ДНК</th><th>РНК</th></tr>
      <tr><td>пентоза</td><td>дезоксирибоза C₅H₁₀O₄</td><td>рибоза C₅H₁₀O₅</td></tr>
      <tr><td>основания</td><td>A, G, C, <b>T</b></td><td>A, G, C, <b>U</b> (урацил)</td></tr>
      <tr><td>строение</td><td>две антипараллельные цепи</td><td>обычно одна цепь</td></tr>
      <tr><td>функция</td><td>хранение наследственной информации</td><td>перенос и реализация информации (мРНК, тРНК, рРНК)</td></tr>
    </table></div>
    <p>Структуру ДНК предложили Дж. Уотсон и Ф. Крик (1953) по рентгенограммам Р. Франклин и М. Уилкинса; ключевой подсказкой стали <b>правила Чаргаффа</b>: в любой двухцепочечной ДНК A = T и G = C.</p>
    <div class="card pad"><p><b>Задача.</b> В молекуле ДНК 22 % нуклеотидов — адениловые. Сколько процентов цитидиловых? Сколько водородных связей между цепями, если всего 1000 пар нуклеотидов?</p>
    <p style="margin:0"><b>Решение.</b> T = A = 22 %; G + C = 100 − 44 = 56 %, C = <b>28 %</b>. Пар A–T: 1000 · 0,44 = 440 (по 2 связи), пар G–C: 560 (по 3). Водородных связей: 440 · 2 + 560 · 3 = <b>2560</b>. Длина такого фрагмента: 1000 · 0,34 нм = 340 нм.</p></div>
  </section>`));
}

export const quiz = [
  { q: "Какая связь образуется между аминокислотами в белке?", options: ["сложноэфирная", "гликозидная", "пептидная –CO–NH–", "водородная"], answer: 2, why: "Карбоксил одной аминокислоты и аминогруппа другой соединяются с отщеплением воды." },
  { q: "Сколько пар нуклеотидов приходится на один виток B-ДНК?", options: ["3,6", "≈ 10,5", "20", "64"], answer: 1, why: "Поворот ≈ 34° на пару, виток ≈ 3,4–3,6 нм. 3,6 — это α-спираль белка (остатков на виток)." },
  { q: "Если в ДНК 30 % гуаниловых нуклеотидов, то тимидиловых:", options: ["30 %", "20 %", "40 %", "70 %"], answer: 1, why: "C = G = 30 %, A + T = 40 %, T = 20 %." },
  { q: "Биуретовая реакция — это появление…", options: ["жёлтой окраски с HNO₃", "фиолетовой окраски с Cu(OH)₂ в щёлочи", "синей окраски с иодом", "серебряного зеркала"], answer: 1, why: "Реакция на пептидные связи — дают все белки." },
  { q: "Чем отличается целлюлоза от крахмала?", options: ["составом: в целлюлозе есть азот", "мономером: β-глюкоза вместо α-глюкозы", "целлюлоза — дисахарид", "ничем"], answer: 1, why: "Оба — (C₆H₁₀O₅)ₙ, но крахмал построен из α-, а целлюлоза — из β-глюкозы." },
  { q: "При денатурации белка сохраняется…", options: ["первичная структура", "вторичная структура", "третичная структура", "четвертичная структура"], answer: 0, why: "Пептидные связи при денатурации не рвутся; их разрушает только гидролиз." },
];
