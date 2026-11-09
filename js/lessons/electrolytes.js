import { h, kid, term, stage, chips } from "../ui.js";
import { createViewer, THREE, glowSprite, textSprite, easeInOut } from "../three/core.js";
import { makeKit, ionGroup, water, beaker, rng, seg, lerpV, norm, WATER_H, COLORS } from "../three/y89-common.js";
import { fmt } from "../chem.js";

// Уравнения диссоциации для тренажёра
const DISS = [
  { f: "HCl", eq: ["HCl → H⁺ + Cl⁻"], note: "Сильная кислота: распадается практически полностью, поэтому стрелка одна (→)." },
  { f: "H₂SO₄", eq: ["H₂SO₄ → H⁺ + HSO₄⁻", "HSO₄⁻ ⇄ H⁺ + SO₄²⁻", "суммарно: H₂SO₄ ⇄ 2H⁺ + SO₄²⁻"], note: "Многоосновные кислоты диссоциируют <b>ступенчато</b>; каждая следующая ступень идёт слабее предыдущей." },
  { f: "H₃PO₄", eq: ["H₃PO₄ ⇄ H⁺ + H₂PO₄⁻", "H₂PO₄⁻ ⇄ H⁺ + HPO₄²⁻", "HPO₄²⁻ ⇄ H⁺ + PO₄³⁻"], note: "Кислота средней силы: уже первая ступень обратима, а ионов PO₄³⁻ в растворе совсем мало." },
  { f: "CH₃COOH", eq: ["CH₃COOH ⇄ CH₃COO⁻ + H⁺"], note: "Слабая кислота: в 0,1 М растворе распадается лишь ≈ 1,3% молекул. Знак ⇄ — процесс обратим." },
  { f: "NaOH", eq: ["NaOH → Na⁺ + OH⁻"], note: "Щёлочь — сильное основание. Именно ионы OH⁻ окрашивают фенолфталеин в малиновый цвет." },
  { f: "Ba(OH)₂", eq: ["Ba(OH)₂ → Ba²⁺ + 2OH⁻"], note: "Индекс после скобки становится коэффициентом перед ионом." },
  { f: "Al₂(SO₄)₃", eq: ["Al₂(SO₄)₃ → 2Al³⁺ + 3SO₄²⁻"], note: "Средние соли распадаются на катионы металла и анионы кислотного остатка. Проверь: 2·(+3) + 3·(−2) = 0." },
  { f: "NaHCO₃", eq: ["NaHCO₃ → Na⁺ + HCO₃⁻", "HCO₃⁻ ⇄ H⁺ + CO₃²⁻ (очень слабо)"], note: "Кислая соль: сначала отщепляется катион металла, а гидрокарбонат-ион почти не распадается дальше." },
  { f: "C₁₂H₂₂O₁₁", eq: ["сахароза на ионы не распадается"], note: "Неэлектролит: в молекуле ковалентные малополярные связи, раствор тока не проводит." },
];

// Вещества для «прибора проводимости»: α — в 0,1 М растворе
const CELL = [
  { id: "NaCl", label: "NaCl", a: 1, cat: "Na", an: "Cl", rc: 0.5, ra: 0.9, kind: "сильный электролит", note: "Соль: ионный кристалл распадается на ионы полностью." },
  { id: "HCl", label: "HCl", a: 1, cat: "H", an: "Cl", rc: 0.26, ra: 0.9, kind: "сильный электролит", note: "Молекулы HCl полярны; вода разрывает связь H–Cl, и ион H⁺ переходит к молекуле воды (H₃O⁺)." },
  { id: "AcOH", label: "CH₃COOH", a: 0.013, cat: "H", an: "C", rc: 0.26, ra: 0.85, kind: "слабый электролит", note: "Уксусная кислота: из каждой сотни молекул распадается примерно одна. Лампочка еле тлеет." },
  { id: "NH3", label: "NH₃·H₂O", a: 0.013, cat: "N", an: "O", rc: 0.6, ra: 0.6, kind: "слабый электролит", note: "Раствор аммиака: NH₃ + H₂O ⇄ NH₄⁺ + OH⁻. Ионов мало — проводимость слабая." },
  { id: "sugar", label: "сахар", a: 0, cat: "C", an: "O", rc: 0.7, ra: 0.7, kind: "неэлектролит", note: "Сахар растворяется молекулами, ионов нет — цепь разомкнута." },
];

export async function render(el) {
  el.appendChild(h(`<div>
    <p class="lead">Чистая вода почти не проводит ток, сухая соль — тоже. А раствор соли проводит! Разгадка — в ${term("ion", "ионах")}: при растворении многие вещества распадаются на заряженные частицы, и они переносят заряд. Этот распад называют ${term("dissociation", "электролитической диссоциацией")}.</p>
    ${kid("Представь кристалл соли как плотную толпу, где все держатся за руки: плюсики-натрии и минусики-хлоры. Молекулы воды — как вежливые растаскиватели: облепляют каждого и уводят по одному. В воде получаются свободные заряженные «путешественники» — они и бегут по проводу тока внутри раствора.")}
  </div>`));

  el.appendChild(h(`<section id="what"><h2>Электролиты и неэлектролиты</h2>
    <p>${term("electrolyte", "Электролиты")} — вещества, растворы или расплавы которых проводят электрический ток. Это соли, кислоты и щёлочи: в них есть ионные или сильно полярные связи. ${term("nonelectrolyte", "Неэлектролиты")} — вещества с ковалентными малополярными связями: сахар, спирт, глюкоза, кислород, бензин. Их растворы состоят из молекул и ток не проводят.</p>
    <div class="grid-2">
      <div class="card pad"><b>Положения теории С. Аррениуса (1887)</b><ol class="small">
        <li>При растворении электролиты распадаются на положительные ${term("cation", "катионы")} и отрицательные ${term("anion", "анионы")}.</li>
        <li>Под действием тока катионы движутся к катоду (−), анионы — к аноду (+).</li>
        <li>Диссоциация — процесс обратимый, у слабых электролитов в растворе одновременно есть и ионы, и молекулы.</li>
      </ol></div>
      <div class="card pad"><b>Свойства ионов ≠ свойства атомов</b><p class="small" style="margin:6px 0 0">Атом натрия бурно реагирует с водой, а ион Na⁺ в растворе поваренной соли совершенно спокоен. Хлор — ядовитый жёлто-зелёный газ, а ион Cl⁻ бесцветен и безвреден. У иона устойчивая электронная оболочка — отсюда и другое поведение.</p></div>
    </div>
  </section>`));

  // ---------- 3D: растворение NaCl ----------
  const s1 = h(`<section id="dissolve"><h2>Как вода разбирает кристалл соли</h2>
    <p>Молекула воды полярна: на атоме кислорода — частичный отрицательный заряд δ−, на атомах водорода — δ+. Поэтому к катиону Na⁺ молекулы воды поворачиваются <b>кислородом</b>, а к аниону Cl⁻ — <b>водородом</b>. Окружая ион «шубой» из воды (${term("hydration", "гидратация")}), они ослабляют его притяжение к кристаллу и уводят в раствор. Тяни ползунок или нажми «Растворить».</p></section>`);
  el.appendChild(s1);
  const st1 = stage(`<div class="overlay"><span><b style="font-size:1rem">NaCl в воде</b><br><span data-phase></span></span><span style="text-align:right"><span style="color:#c48cff">●</span> Na⁺ &nbsp;<span style="color:#2fd35b">●</span> Cl⁻<br><span style="color:#ff5b5b">●</span> O &nbsp;<span>○</span> H</span></div>`, { wide: true });
  s1.appendChild(st1);
  const c1 = h(`<div class="card pad" style="margin-top:10px">
    <div class="row"><button class="btn primary" type="button" data-play>▶ Растворить</button><input type="range" min="0" max="1" step="0.001" value="0" style="flex:1;min-width:140px" aria-label="Ход растворения"></div>
    <p class="small muted" style="margin:10px 0 0">Na⁺ окружают 6 молекул воды (≈ 2,4 Å до кислорода), Cl⁻ — 6 молекул, повёрнутых к нему одним атомом водорода (≈ 2,2 Å). Свободные молекулы воды тоже есть — они всё время толкаются тепловым движением.</p>
  </div>`);
  s1.appendChild(c1);
  const v1 = createViewer(st1, { camera: [0, 6, 26], fitWidth: 13, autoRotateSpeed: 0.35, minDistance: 8, maxDistance: 60 });
  buildDissolve(v1, st1, c1);

  // ---------- уравнения ----------
  const s2 = h(`<section id="equations"><h2>Уравнения диссоциации</h2>
    <ul>
      <li><b>Кислоты</b> → катионы водорода H⁺ и анионы кислотного остатка. Именно H⁺ дают кислый вкус и меняют цвет индикаторов.</li>
      <li><b>Основания (щёлочи)</b> → катионы металла и гидроксид-ионы OH⁻.</li>
      <li><b>Средние соли</b> → катионы металла (или NH₄⁺) и анионы кислотного остатка.</li>
    </ul>
    <div class="card pad"><div data-chips></div><div class="eq" data-eq></div><p data-note class="small" style="margin:0"></p></div>
    <div class="callout"><b>Важно.</b> Сумма зарядов ионов в уравнении равна нулю — раствор в целом электронейтрален. Нерастворимые вещества (BaSO₄, AgCl, Cu(OH)₂) на ионы в растворе не записывают: ионов в растворе от них почти нет.</div>
    <p class="adv small muted">На самом деле свободных протонов в воде нет: H⁺ сразу присоединяется к молекуле воды, образуя ион гидроксония H₃O⁺. Запись H⁺ — общепринятое сокращение.</p>
  </section>`);
  el.appendChild(s2);
  const showD = (d) => {
    s2.querySelector("[data-eq]").innerHTML = d.eq.join("<br>");
    s2.querySelector("[data-note]").innerHTML = d.note;
  };
  chips(s2.querySelector("[data-chips]"), DISS.map((d) => ({ ...d, label: d.f })), showD);
  showD(DISS[0]);

  // ---------- 3D: прибор проводимости ----------
  const s3 = h(`<section id="strength"><h2>Сильные и слабые: степень диссоциации</h2>
    <p>Насколько полно распадается электролит, показывает ${term("dissdegree", "степень диссоциации")}:</p>
    <div class="eq">α = N<sub>расп</sub> / N<sub>общ</sub> · 100%</div>
    <p><b>Сильные электролиты</b> (α → 100%): все растворимые соли, щёлочи (NaOH, KOH, Ba(OH)₂), сильные кислоты (HCl, HBr, HI, HNO₃, H₂SO₄, HClO₄). <b>Слабые</b> (α ≪ 100%): H₂O, CH₃COOH и другие органические кислоты, H₂S, H₂CO₃, H₂SO₃, HF, HNO₂, NH₃·H₂O, нерастворимые основания. Выбери раствор и подвигай α — лампочка прибора покажет, сколько в растворе носителей заряда.</p>
  </section>`);
  el.appendChild(s3);
  const chipBox = h(`<div style="margin-bottom:10px"></div>`);
  s3.appendChild(chipBox);
  const st2 = stage(`<div class="overlay"><span><b data-name style="font-size:1rem"></b><br><span data-kind></span></span><span data-lamp style="text-align:right"></span></div>`, { wide: true });
  s3.appendChild(st2);
  const c2 = h(`<div class="card pad" style="margin-top:10px">
    <label class="ctl">Степень диссоциации α: <b data-a></b><input type="range" min="0" max="100" step="0.1" value="100"></label>
    <p data-note style="margin:10px 0 0"></p>
  </div>`);
  s3.appendChild(c2);
  const v2 = createViewer(st2, { camera: [0, 3, 19], fitWidth: 8, autoRotate: false, minDistance: 8, maxDistance: 40 });
  const cell = buildCell(v2);
  const range = c2.querySelector("input");
  let cur = CELL[0];
  const updCell = () => {
    const a = cur.id === "sugar" ? 0 : +range.value / 100;
    range.disabled = cur.id === "sugar";
    cell.setAlpha(a);
    const N = cell.units;
    const n = Math.round(a * N);
    c2.querySelector("[data-a]").textContent = `${fmt(a * 100, a < 0.1 ? 1 : 0)}% — распалось ${n} из ${N} частиц`;
    st2.querySelector("[data-lamp]").innerHTML = a > 0.6 ? "💡 горит ярко" : a > 0.15 ? "💡 горит" : a > 0.004 ? "лампа еле тлеет" : "лампа не горит";
  };
  const pick = (c) => {
    cur = c;
    cell.setSubstance(c);
    range.value = c.a * 100;
    st2.querySelector("[data-name]").textContent = c.label;
    st2.querySelector("[data-kind]").textContent = c.kind + (c.a ? ` · в 0,1 М растворе α ≈ ${fmt(c.a * 100, c.a < 0.1 ? 1 : 0)}%` : "");
    c2.querySelector("[data-note]").innerHTML = c.note + " <span class='muted small'>Катионы дрейфуют к катоду (−, слева), анионы — к аноду (+, справа).</span>";
    updCell();
  };
  range.oninput = updCell;
  chips(chipBox, CELL, pick);
  pick(CELL[0]);
  s3.appendChild(h(`<div class="callout adv">Степень диссоциации слабого электролита растёт при <b>разбавлении</b> (ионам труднее встретиться и снова соединиться) и при <b>нагревании</b>. Например, для CH₃COOH: в 1 М растворе α ≈ 0,4%, в 0,1 М — 1,3%, в 0,001 М — около 12%.</div>`));

  el.appendChild(h(`<section id="task"><h2>Разбор задач</h2>
    <div class="card pad">
      <p class="mt0"><b>Задача 1.</b> В растворе слабой кислоты HA из каждых 500 молекул на ионы распались 15. Найдите α.</p>
      <p class="small">Решение: α = 15 / 500 = 0,03 = <b>3%</b>. Кислота слабая (α ≪ 30%).</p>
      <p><b>Задача 2.</b> Сколько моль ионов образуется при полной диссоциации 0,2 моль сульфата алюминия?</p>
      <p class="small" style="margin-bottom:0">Al₂(SO₄)₃ → 2Al³⁺ + 3SO₄²⁻: из 1 моль соли — 5 моль ионов. Значит, n(ионов) = 0,2 · 5 = <b>1 моль</b> (0,4 моль Al³⁺ и 0,6 моль SO₄²⁻).</p>
    </div>
    ${kid("Дома можно сделать «детектор ионов»: батарейка, светодиод и два провода. Опусти концы проводов в стакан с солёной водой — светодиод загорится. В сладкой воде — нет: сахар не даёт ионов.", "Опыт")}
    <p class="small muted">Дальше: как ионы встречаются и реагируют — в уроке <a href="#lesson-ionic">«Ионные уравнения»</a>; почему некоторые соли меняют среду раствора — в уроке <a href="#lesson-hydrolysis">«Гидролиз солей»</a>.</p>
  </section>`));
}

// ---------- сцена растворения ----------
function buildDissolve(v, st, ctl) {
  const kit = makeKit();
  const root = new THREE.Group();
  v.scene.add(root);
  const R = rng(7);
  const a = 2.82; // Na–Cl, Å
  const ions = [];
  for (let x = 0; x < 3; x++) for (let y = 0; y < 2; y++) for (let z = 0; z < 2; z++) {
    const cat = (x + y + z) % 2 === 0;
    const g = ionGroup(kit, cat ? "Na+" : "Cl-", { labelSize: 0.5 });
    const start = [(x - 1) * a, (y - 0.5) * a, (z - 0.5) * a];
    root.add(g);
    ions.push({ g, cat, start });
  }
  // конечные положения: разбросаны по раствору, не ближе 6 Å друг к другу
  const finals = [];
  while (finals.length < ions.length) {
    const p = [(R() - 0.5) * 22, (R() - 0.5) * 12, (R() - 0.5) * 12];
    if (finals.every((q) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]) > 6.2)) finals.push(p);
  }
  // самые удалённые от центра ионы уходят первыми
  ions.forEach((ion, i) => { ion.final = finals[i]; ion.dist = Math.hypot(...ion.start); });
  const order = [...ions].sort((p, q) => q.dist - p.dist || (q.cat ? 1 : -1));
  order.forEach((ion, k) => (ion.delay = 0.08 + (k / ions.length) * 0.5));

  const randQuat = () => new THREE.Quaternion().setFromEuler(new THREE.Euler(R() * 6.28, R() * 6.28, R() * 6.28));
  const randStart = () => {
    for (;;) {
      const p = [(R() - 0.5) * 30, (R() - 0.5) * 16, (R() - 0.5) * 16];
      if (Math.hypot(p[0] / 1.6, p[1], p[2]) > 6) return p;
    }
  };
  const OCT = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
  const X = new THREE.Vector3(1, 0, 0), HDIR = new THREE.Vector3(...norm(WATER_H[0]));
  const waters = [];
  for (const ion of ions) {
    OCT.forEach((d) => {
      const g = water(kit);
      root.add(g);
      const dist = ion.cat ? 2.4 : 3.15;
      const off = d.map((c) => c * dist);
      // к Na⁺ — кислородом (биссектриса от иона), к Cl⁻ — одним водородом
      const toIon = new THREE.Vector3(...d).negate();
      const q = ion.cat
        ? new THREE.Quaternion().setFromUnitVectors(X, new THREE.Vector3(...d))
        : new THREE.Quaternion().setFromUnitVectors(HDIR, toIon);
      const twist = new THREE.Quaternion().setFromAxisAngle(ion.cat ? new THREE.Vector3(...d) : toIon, R() * 6.28);
      waters.push({ g, ion, off, start: randStart(), q0: randQuat(), q1: twist.multiply(q), ph: R() * 6.28 });
    });
  }
  for (let i = 0; i < 40; i++) {
    const g = water(kit);
    root.add(g);
    waters.push({ g, ion: null, start: randStart(), q0: randQuat(), ph: R() * 6.28 });
  }

  let t = 0, playing = false, time = 0;
  const range = ctl.querySelector("input");
  const phase = st.querySelector("[data-phase]");
  const qtmp = new THREE.Quaternion();
  const ionPos = (ion) => {
    const p = easeInOut(seg(t, ion.delay, ion.delay + 0.42));
    const w = p * 0.12;
    const j = [Math.sin(time * 1.7 + ion.dist) * w, Math.cos(time * 1.3 + ion.dist * 2) * w, Math.sin(time * 1.1 + ion.dist * 3) * w];
    const b = lerpV(ion.start, ion.final, p);
    return [b[0] + j[0], b[1] + j[1], b[2] + j[2]];
  };
  function apply() {
    for (const ion of ions) { ion.cur = ionPos(ion); ion.g.position.set(...ion.cur); }
    for (const w of waters) {
      const jig = [Math.sin(time * 1.4 + w.ph) * 0.25, Math.cos(time * 1.1 + w.ph) * 0.25, Math.sin(time * 0.9 + w.ph * 2) * 0.25];
      if (!w.ion) {
        w.g.position.set(w.start[0] + jig[0], w.start[1] + jig[1], w.start[2] + jig[2]);
        w.g.quaternion.copy(w.q0).multiply(qtmp.setFromAxisAngle(X, Math.sin(time + w.ph) * 0.6));
        continue;
      }
      const p = easeInOut(seg(t, w.ion.delay - 0.08, w.ion.delay + 0.2));
      const target = [w.ion.cur[0] + w.off[0], w.ion.cur[1] + w.off[1], w.ion.cur[2] + w.off[2]];
      const s = [w.start[0] + jig[0], w.start[1] + jig[1], w.start[2] + jig[2]];
      w.g.position.set(...lerpV(s, target, p));
      w.g.quaternion.slerpQuaternions(w.q0, w.q1, p);
    }
    phase.textContent = t < 0.06 ? "ионный кристалл и полярные молекулы воды" : t < 0.95 ? "вода ориентируется и вырывает ионы" : "гидратированные ионы Na⁺ и Cl⁻ в растворе";
  }
  range.oninput = () => { playing = false; t = +range.value; apply(); };
  ctl.querySelector("[data-play]").onclick = () => { if (t >= 0.999) t = 0; playing = true; };
  v.onFrame((dt) => {
    time += dt;
    if (playing) { t = Math.min(1, t + dt / 9); range.value = t; if (t >= 1) playing = false; }
    apply();
  });
  apply();
}

// ---------- прибор для проверки проводимости ----------
function buildCell(v) {
  const kit = makeKit();
  const root = new THREE.Group();
  v.scene.add(root);
  root.position.y = -1.5;
  const W = 5.4, H = 6;
  const bk = beaker(W, H, 0.85, 0x5aa9ff);
  root.add(bk);
  const elMat = new THREE.MeshStandardMaterial({ color: 0x777f8f, metalness: 0.7, roughness: 0.35 });
  const wireMat = new THREE.MeshStandardMaterial({ color: 0xd08a3a, metalness: 0.6, roughness: 0.4 });
  const lampY = H / 2 + 3.2;
  [-1, 1].forEach((s) => {
    const e = new THREE.Mesh(new THREE.BoxGeometry(0.35, H * 0.9, 1.6), elMat);
    e.position.set(s * (W - 1.0), 0.2, 0);
    root.add(e);
    const sign = ionLabel(s < 0 ? "−" : "+", s < 0 ? "#cfe2ff" : "#ffd0d6");
    sign.position.set(s * (W - 1.0), H / 2 + 0.9, 0.9);
    root.add(sign);
    root.add(kit.bond([s * (W - 1), H * 0.45 + 0.2, 0], [s * (W - 1), lampY, 0], 0.06, wireMat));
    root.add(kit.bond([s * (W - 1), lampY, 0], [s * 0.55, lampY, 0], 0.06, wireMat));
  });
  // батарейка в разрыв справа
  const bat = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 1.6, 24), new THREE.MeshStandardMaterial({ color: 0x2a3550, metalness: 0.3, roughness: 0.5 }));
  bat.rotation.z = Math.PI / 2;
  bat.position.set(2.6, lampY, 0);
  root.add(bat);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.62, 32, 24), new THREE.MeshPhysicalMaterial({ color: 0xfff3c4, emissive: 0xffc94a, emissiveIntensity: 0, transparent: true, opacity: 0.85, roughness: 0.1 }));
  bulb.position.set(0, lampY + 0.1, 0);
  root.add(bulb);
  const glow = glowSprite(0xffd36a, 5, 0);
  glow.position.copy(bulb.position);
  root.add(glow);

  const R = rng(3);
  const N = 24;
  const units = [];
  const inR = W - 1.6, top = H * 0.85 / 2 - 0.4;
  let sub = null, alpha = 1;
  const mats = {};
  const mat = (el) => (mats[el] ??= kit.mat(COLORS[el] ?? 0xaaaaaa));
  function setSubstance(c) {
    sub = c;
    for (const u of units) { root.remove(u.c); root.remove(u.a); }
    units.length = 0;
    for (let i = 0; i < N; i++) {
      const cM = new THREE.Mesh(kit.geo(c.rc * 0.5), c.id === "sugar" ? kit.mat(0xd9c49a) : c.cat === "H" ? kit.mat(0xf2f4f8) : mat(c.cat));
      const aM = new THREE.Mesh(kit.geo(c.ra * 0.5), c.id === "sugar" ? kit.mat(0xd9c49a) : c.id === "AcOH" ? kit.mat(0x6b7280) : mat(c.an));
      root.add(cM, aM);
      const p = new THREE.Vector3((R() - 0.5) * 2 * inR * 0.95, (R() - 0.5) * 2 * top * 0.9 - 0.4, (R() - 0.5) * 5.6);
      units.push({ c: cM, a: aM, pc: p.clone(), pa: p.clone().add(new THREE.Vector3(c.rc + c.ra, 0, 0)), vc: new THREE.Vector3(), va: new THREE.Vector3(), ph: R() * 6.28, d: i / N + 0.5 / N });
    }
  }
  // броуновское движение: случайные толчки + вязкость + слабый дрейф в поле
  const step = (p, vel, drift, dt) => {
    vel.x += ((Math.random() - 0.5) * 9 + drift * (1 - Math.min(1, Math.abs(p.x) / inR) ** 4 * (Math.sign(p.x) === Math.sign(drift) ? 1 : 0))) * dt;
    vel.y += (Math.random() - 0.5) * 9 * dt;
    vel.z += (Math.random() - 0.5) * 6 * dt;
    vel.multiplyScalar(1 - Math.min(1, dt * 1.6));
    p.addScaledVector(vel, dt);
    const lim = [[-inR, inR, "x"], [-H / 2 + 0.9, top, "y"], [-3, 3, "z"]];
    for (const [lo, hi, k] of lim) {
      if (p[k] < lo) { p[k] = lo; vel[k] = Math.abs(vel[k]); }
      if (p[k] > hi) { p[k] = hi; vel[k] = -Math.abs(vel[k]); }
    }
  };
  let time = 0;
  v.onFrame((dt) => {
    time += dt;
    for (const u of units) {
      const free = u.d < alpha;
      if (free) {
        step(u.pc, u.vc, -1.2, dt);
        step(u.pa, u.va, 1.2, dt);
      } else {
        step(u.pc, u.vc, 0, dt);
        // молекула: вторая частица держится рядом с первой
        const dir = new THREE.Vector3(Math.cos(time * 0.7 + u.ph), Math.sin(time * 0.5 + u.ph), 0.3).normalize();
        const target = u.pc.clone().add(dir.multiplyScalar((sub.rc + sub.ra) * 0.55));
        u.pa.lerp(target, Math.min(1, dt * 6));
        u.va.set(0, 0, 0);
      }
      u.c.position.copy(u.pc);
      u.a.position.copy(u.pa);
    }
    const b = Math.min(1, Math.sqrt(alpha) * 1.05);
    bulb.material.emissiveIntensity = b * 2.2;
    glow.material.opacity = b * 0.9;
  });
  return {
    units: N,
    setSubstance,
    setAlpha(a) { alpha = a; },
  };
}

const ionLabel = (t, color) => textSprite(t, { size: 0.8, color, bg: "rgba(10,14,30,0.6)" });

export const quiz = [
  { q: "Какое вещество — неэлектролит?", options: ["NaOH", "HNO₃", "глюкоза C₆H₁₂O₆", "KCl"], answer: 2, why: "В глюкозе ковалентные малополярные связи, при растворении ионы не образуются." },
  { q: "К иону Na⁺ молекулы воды поворачиваются…", options: ["атомами водорода", "атомом кислорода", "как попало", "не подходят вовсе"], answer: 1, why: "На кислороде частичный заряд δ−, он притягивается к катиону." },
  { q: "Сколько ионов образуется при полной диссоциации одной «формульной единицы» Fe₂(SO₄)₃?", options: ["2", "3", "5", "17"], answer: 2, why: "Fe₂(SO₄)₃ → 2Fe³⁺ + 3SO₄²⁻: 2 + 3 = 5 ионов." },
  { q: "Какой электролит слабый?", options: ["HCl", "H₂SO₄", "KOH", "CH₃COOH"], answer: 3, why: "Уксусная кислота распадается на ионы лишь частично (α ≈ 1% в 0,1 М)." },
  { q: "Из 200 молекул электролита на ионы распалось 50. Степень диссоциации:", options: ["4%", "25%", "50%", "250%"], answer: 1, why: "α = 50 / 200 = 0,25 = 25%." },
  { q: "Как меняется α слабого электролита при разбавлении раствора?", options: ["Растёт", "Падает", "Не меняется", "Становится 0"], answer: 0, why: "В разбавленном растворе ионам реже удаётся встретиться и снова собраться в молекулу." },
];
