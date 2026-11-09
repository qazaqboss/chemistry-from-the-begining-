import { h, kid, term, stage, chips } from "../ui.js";
import { createViewer } from "../three/core.js";
import { createMolecule, frame } from "../three/molecule.js";
import { createLattice } from "../three/lattice.js";
import { buildCentral, lonePairMeshes } from "../three/valence-vsepr.js";
import { MOLECULES } from "../data/molecules.js";
import { pretty, fmt, molarMass } from "../chem.js";

const O2 = { el: "O", order: 2 }, OH = { el: "O", order: 1, h: true }, O1 = { el: "O", order: 1 };
const MODELS = [
  { f: "CO2", name: "оксид углерода(IV)", cls: "кислотный оксид", data: buildCentral("C", [O2, O2]), note: "Углекислый газ. Валентность углерода IV — отсюда римская цифра в названии." },
  { f: "SO2", name: "оксид серы(IV)", cls: "кислотный оксид", data: buildCentral("S", [O2, O2], 1, 119), note: "Сернистый газ: при растворении в воде даёт сернистую кислоту H₂SO₃." },
  { f: "SO3", name: "оксид серы(VI)", cls: "кислотный оксид", data: buildCentral("S", [O2, O2, O2]), note: "Серный ангидрид: с водой даёт серную кислоту H₂SO₄. У серы высшая валентность VI." },
  { f: "H2CO3", name: "угольная кислота", cls: "кислота (соли — карбонаты)", data: buildCentral("C", [O2, OH, OH]), note: "Неустойчива: тут же распадается на CO₂ и H₂O — так шипит газировка." },
  { f: "HNO3", name: "азотная кислота", cls: "кислота (соли — нитраты)", data: buildCentral("N", [O2, O1, OH]), note: "На самом деле две концевые связи N–O одинаковые («полуторные»): электроны делокализованы." },
  { f: "H2SO4", name: "серная кислота", cls: "кислота (соли — сульфаты)", data: MOLECULES.find((m) => m.id === "H2SO4").data, note: "Самый массовый продукт химической промышленности." },
  { f: "H3PO4", name: "фосфорная кислота", cls: "кислота (соли — фосфаты)", data: buildCentral("P", [O2, OH, OH, OH]), note: "Три атома водорода — трёхосновная кислота: даёт фосфаты, гидрофосфаты и дигидрофосфаты." },
];

// Названия для тренажёра (реально существующие вещества)
const BANK = [
  ["Na2O", "оксид натрия", "ox"], ["CaO", "оксид кальция", "ox"], ["MgO", "оксид магния", "ox"], ["Al2O3", "оксид алюминия", "ox"], ["FeO", "оксид железа(II)", "ox"], ["Fe2O3", "оксид железа(III)", "ox"],
  ["CuO", "оксид меди(II)", "ox"], ["Cu2O", "оксид меди(I)", "ox"], ["CO", "оксид углерода(II)", "ox"], ["CO2", "оксид углерода(IV)", "ox"], ["SO2", "оксид серы(IV)", "ox"], ["SO3", "оксид серы(VI)", "ox"],
  ["P2O5", "оксид фосфора(V)", "ox"], ["NO2", "оксид азота(IV)", "ox"], ["N2O5", "оксид азота(V)", "ox"], ["ZnO", "оксид цинка", "ox"],
  ["HCl", "соляная (хлороводородная) кислота", "ac"], ["HNO3", "азотная кислота", "ac"], ["HNO2", "азотистая кислота", "ac"], ["H2SO4", "серная кислота", "ac"], ["H2SO3", "сернистая кислота", "ac"],
  ["H2S", "сероводородная кислота", "ac"], ["H2CO3", "угольная кислота", "ac"], ["H3PO4", "фосфорная кислота", "ac"], ["H2SiO3", "кремниевая кислота", "ac"], ["HF", "фтороводородная (плавиковая) кислота", "ac"],
  ["NaOH", "гидроксид натрия", "ba"], ["KOH", "гидроксид калия", "ba"], ["Ca(OH)2", "гидроксид кальция", "ba"], ["Ba(OH)2", "гидроксид бария", "ba"], ["Fe(OH)2", "гидроксид железа(II)", "ba"],
  ["Fe(OH)3", "гидроксид железа(III)", "ba"], ["Cu(OH)2", "гидроксид меди(II)", "ba"], ["Al(OH)3", "гидроксид алюминия", "ba"], ["Zn(OH)2", "гидроксид цинка", "ba"],
  ["NaCl", "хлорид натрия", "sa"], ["KNO3", "нитрат калия", "sa"], ["CaCO3", "карбонат кальция", "sa"], ["Na2SO4", "сульфат натрия", "sa"], ["CuSO4", "сульфат меди(II)", "sa"], ["FeCl3", "хлорид железа(III)", "sa"],
  ["FeCl2", "хлорид железа(II)", "sa"], ["AgNO3", "нитрат серебра", "sa"], ["Ca3(PO4)2", "фосфат кальция", "sa"], ["Na2S", "сульфид натрия", "sa"], ["K2CO3", "карбонат калия", "sa"], ["BaSO4", "сульфат бария", "sa"],
  ["Na2SiO3", "силикат натрия", "sa"], ["Al2(SO4)3", "сульфат алюминия", "sa"], ["Na2SO3", "сульфит натрия", "sa"], ["NaNO2", "нитрит натрия", "sa"], ["MgCl2", "хлорид магния", "sa"], ["Pb(NO3)2", "нитрат свинца(II)", "sa"],
  ["NaHCO3", "гидрокарбонат натрия", "sa"], ["KBr", "бромид калия", "sa"], ["ZnS", "сульфид цинка", "sa"], ["Fe2(SO4)3", "сульфат железа(III)", "sa"], ["FeSO4", "сульфат железа(II)", "sa"],
].map(([f, n, c]) => ({ f, n, c }));
const CLS = { ox: "оксид", ac: "кислота", ba: "основание", sa: "соль" };
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const firstEl = (f) => f.match(/^(H(?=[A-Z])|[A-Z][a-z]?)/)?.[0];
const P = pretty;

export async function render(el) {
  el.appendChild(h(`<div>
    <p class="lead">Химических веществ известно больше ста миллионов, и у каждого должно быть имя, по которому любой химик в мире поймёт его состав. Правила составления названий называют ${term("nomenclature", "номенклатурой")}. Для неорганических веществ они простые — освоим их за один урок.</p>
    ${kid("Название вещества — как адрес: «сульфат меди» говорит, из каких «кирпичиков» оно собрано. Зная несколько правил, по названию можно написать формулу, а по формуле — прочитать название.")}
  </div>`));

  el.appendChild(h(`<section id="classes"><h2>Четыре главных класса</h2>
    <div class="table-wrap"><table class="data">
      <tr><th>Класс</th><th>Состав</th><th>Пример</th><th>Название</th></tr>
      <tr><td>Оксиды</td><td>элемент + кислород (O<sup>II</sup>)</td><td class="formula">CaO</td><td>оксид кальция</td></tr>
      <tr><td>Кислоты</td><td>водород + ${term("acid_residue", "кислотный остаток")}</td><td class="formula">H₂SO₄</td><td>серная кислота</td></tr>
      <tr><td>Основания</td><td>металл + группы OH</td><td class="formula">NaOH</td><td>гидроксид натрия</td></tr>
      <tr><td>Соли</td><td>металл + кислотный остаток</td><td class="formula">CuSO₄</td><td>сульфат меди(II)</td></tr>
    </table></div>
    <p>Общий принцип русских названий: <b>сначала называют «отрицательную» часть</b> (оксид, хлорид, сульфат, гидроксид) <b>в именительном падеже, затем «положительную»</b> (металл или неметалл) в родительном: «хлорид чего?» — натрия. В формуле — наоборот: металл пишут первым, NaCl.</p>
  </section>`));

  el.appendChild(h(`<section id="oxides"><h2>Оксиды и римские цифры</h2>
    <p>Если элемент имеет постоянную валентность, её не указывают: Na₂O — оксид натрия, Al₂O₃ — оксид алюминия. Если валентность переменная, её пишут римской цифрой в скобках сразу после названия, без пробела (это система Штока):</p>
    <div class="eq">FeO — оксид железа(II) &nbsp;·&nbsp; Fe₂O₃ — оксид железа(III)</div>
    <div class="eq">CO — оксид углерода(II) &nbsp;·&nbsp; CO₂ — оксид углерода(IV)</div>
    <p>Как найти цифру: у кислорода валентность II. В Fe₂O₃ три атома O дают 3 · 2 = 6 единиц, они делятся между двумя атомами Fe — значит, Fe(III). Обратная задача: «оксид азота(V)» → N<sup>V</sup>O<sup>II</sup> → НОК 10 → N₂O₅.</p>
    <p class="adv small muted">Встречаются и названия с греческими приставками: CO₂ — диоксид углерода, SO₃ — триоксид серы, P₂O₅ (на деле P₄O₁₀) — декаоксид тетрафосфора. Обе системы допустимы; в школе чаще используют римские цифры.</p>
  </section>`));

  el.appendChild(h(`<section id="acids"><h2>Кислоты и кислотные остатки</h2>
    <p>Кислоты называют по элементу, образующему кислотный остаток. Если элемент в высшей степени окисления — окончание <b>-ная</b> (серная), если в низшей — <b>-истая</b> (сернистая). Бескислородные кислоты — <b>-водородная</b> (хлороводородная). Название соли строится от остатка:</p>
    <div class="table-wrap"><table class="data">
      <tr><th>Кислота</th><th>Название</th><th>Остаток</th><th>Соли</th></tr>
      <tr><td class="formula">HCl</td><td>соляная (хлороводородная)</td><td class="formula">Cl⁻</td><td>хлориды</td></tr>
      <tr><td class="formula">HF</td><td>фтороводородная (плавиковая)</td><td class="formula">F⁻</td><td>фториды</td></tr>
      <tr><td class="formula">H₂S</td><td>сероводородная</td><td class="formula">S²⁻</td><td>сульфиды</td></tr>
      <tr><td class="formula">HNO₃</td><td>азотная</td><td class="formula">NO₃⁻</td><td>нитраты</td></tr>
      <tr><td class="formula">HNO₂</td><td>азотистая</td><td class="formula">NO₂⁻</td><td>нитриты</td></tr>
      <tr><td class="formula">H₂SO₄</td><td>серная</td><td class="formula">SO₄²⁻</td><td>сульфаты</td></tr>
      <tr><td class="formula">H₂SO₃</td><td>сернистая</td><td class="formula">SO₃²⁻</td><td>сульфиты</td></tr>
      <tr><td class="formula">H₂CO₃</td><td>угольная</td><td class="formula">CO₃²⁻</td><td>карбонаты</td></tr>
      <tr><td class="formula">H₂SiO₃</td><td>кремниевая</td><td class="formula">SiO₃²⁻</td><td>силикаты</td></tr>
      <tr><td class="formula">H₃PO₄</td><td>фосфорная</td><td class="formula">PO₄³⁻</td><td>фосфаты</td></tr>
    </table></div>
    <p>Заметь закономерность: у кислородсодержащих остатков с «полной» валентностью окончание <b>-ат</b> (сульфат, нитрат), с меньшей — <b>-ит</b> (сульфит, нитрит), у бескислородных — <b>-ид</b> (хлорид, сульфид). Валентность остатка равна числу атомов водорода в кислоте: SO₄ — II, PO₄ — III.</p>
  </section>`));

  el.appendChild(h(`<section id="salts"><h2>Основания и соли</h2>
    <p><b>Основания:</b> «гидроксид + металл (валентность, если переменная)»: NaOH — гидроксид натрия, Fe(OH)₃ — гидроксид железа(III). Группа OH одновалентна, поэтому число групп равно валентности металла.</p>
    <p><b>Соли:</b> «название остатка + металл»: K₂CO₃ — карбонат калия, CuSO₄ — сульфат меди(II), Al₂(SO₄)₃ — сульфат алюминия. Формулу соли составляют по валентностям металла и остатка, как в уроке про валентность. Если остатков несколько, их берут в скобки: Ca(NO₃)₂, а не CaN₂O₆.</p>
    <div class="eq">Al<sup>III</sup> + SO₄<sup>II</sup> → НОК 6 → Al₂(SO₄)₃ — сульфат алюминия</div>
    <p class="adv">Кислые соли содержат водород в остатке, к названию добавляют приставку <b>гидро-</b>: NaHCO₃ — гидрокарбонат натрия (пищевая сода), KH₂PO₄ — дигидрофосфат калия. Основные соли содержат OH: (CuOH)₂CO₃ — гидроксокарбонат меди(II), это малахит.</p>
    <div class="callout"><b>Важно:</b> у многих веществ есть ${term("trivial_name", "тривиальные названия")}, которые нужно знать: NaCl — поваренная соль, NaHCO₃ — пищевая сода, Na₂CO₃ — кальцинированная сода, CaCO₃ — мел, мрамор, известняк, CaO — негашёная известь, Ca(OH)₂ — гашёная известь, CuSO₄·5H₂O — медный купорос, KMnO₄ — марганцовка, NaOH — едкий натр.</div>
    ${kid("Правило-подсказка: «-ид» — когда кислорода в остатке нет (хлорИД — только хлор), «-ат» — когда кислорода много, «-ит» — когда кислорода чуть поменьше.")}
  </section>`));

  // ---------- 3D-модели ----------
  const s5 = h(`<section id="models"><h2>Как выглядят эти вещества</h2>
    <p>Оксиды неметаллов и кислоты состоят из молекул. Выбери вещество — увидишь его модель: в кислородсодержащих кислотах водород всегда присоединён к кислороду (группа O–H), а центральный атом окружён атомами кислорода.</p></section>`);
  el.appendChild(s5);
  const chipBox = h(`<div style="margin-bottom:10px"></div>`);
  s5.appendChild(chipBox);
  const st = stage(`<div class="overlay"><span data-a style="font-size:1rem"></span><span data-b style="text-align:right"></span></div>`, { wide: true });
  s5.appendChild(st);
  const note = h(`<div class="card pad" style="margin-top:10px"><p data-n style="margin:0"></p></div>`);
  s5.appendChild(note);
  const v = createViewer(st, { camera: [0, 1.5, 9], minDistance: 3, maxDistance: 30, autoRotateSpeed: 0.7 });
  const mol = createMolecule(v, MODELS[0].data);
  let lp = null;
  const show = (m) => {
    mol.set(m.data);
    lp = lonePairMeshes(m.data); mol.group.add(lp);
    frame(v, mol.radius() + 0.3);
    st.querySelector("[data-a]").innerHTML = `<b class="formula">${pretty(m.f)}</b>`;
    st.querySelector("[data-b]").innerHTML = `<b>${m.name}</b><br>${m.cls}`;
    note.querySelector("[data-n]").innerHTML = `${m.note} <span class="muted small">M = ${fmt(molarMass(m.f).mass, 1)} г/моль</span>`;
  };
  chips(chipBox, MODELS.map((m) => ({ ...m, label: pretty(m.f) })), show);
  show(MODELS[0]);

  s5.appendChild(h(`<p style="margin-top:18px">А вот соль — <b>хлорид натрия</b> NaCl. Молекул здесь нет: кристалл собран из ионов Na⁺ (фиолетовые) и Cl⁻ (зелёные). Формула лишь показывает их соотношение 1 : 1, а название — из каких ионов он собран.</p>`));
  const st2 = stage(`<div class="overlay"><span style="font-size:1rem"><b>NaCl — хлорид натрия</b></span><span>Na⁺ : Cl⁻ = 1 : 1</span></div>`);
  s5.appendChild(st2);
  const v2 = createViewer(st2, { camera: [6, 4.5, 7.5], autoRotateSpeed: 0.5 });
  createLattice(v2, "nacl", 2);

  // ---------- тренажёр ----------
  const s6 = h(`<section id="trainer"><h2>Тренажёр названий</h2>
    <div class="card pad nm-tr">
      <div class="row" style="justify-content:space-between"><div class="seg"><button type="button" class="on" data-mode="0">Формула → название</button><button type="button" data-mode="1">Название → формула</button></div><span class="small muted">Верно: <b data-score>0</b> из <b data-total>0</b></span></div>
      <div data-ask class="nm-ask"></div>
      <div data-opts class="nm-opts"></div>
      <p data-msg style="margin:10px 0 0;min-height:1.4em"></p>
      <button class="btn small" type="button" data-next>Следующий вопрос →</button>
    </div>
    <style>
      .nm-tr .nm-ask{font-size:1.6rem;font-weight:800;text-align:center;margin:18px 0 12px}
      .nm-tr .nm-ask small{display:block;font-size:.8rem;font-weight:600;color:var(--text-3);margin-bottom:4px}
      .nm-tr .nm-opts{display:grid;grid-template-columns:1fr 1fr;gap:8px}
      @media (max-width:560px){.nm-tr .nm-opts{grid-template-columns:1fr}}
      .nm-tr .nm-opts .opt{text-align:left}
    </style>
  </section>`);
  el.appendChild(s6);
  let mode = 0, score = 0, total = 0, cur = null, answered = false;
  const next = () => {
    cur = BANK[Math.floor(Math.random() * BANK.length)];
    answered = false;
    // отвлекающие ответы: того же класса, лучше с тем же первым элементом
    const same = shuffle(BANK.filter((b) => b !== cur && b.c === cur.c));
    same.sort((a, b) => (firstEl(b.f) === firstEl(cur.f)) - (firstEl(a.f) === firstEl(cur.f)));
    const opts = shuffle([cur, ...same.slice(0, 3)]);
    s6.querySelector("[data-ask]").innerHTML = mode === 0 ? `<small>Как называется вещество?</small><span class="formula">${P(cur.f)}</span>` : `<small>Выбери формулу</small>${cur.n}`;
    const box = s6.querySelector("[data-opts]");
    box.innerHTML = "";
    for (const o of opts) {
      const b = h(`<button class="opt" type="button">${mode === 0 ? o.n : `<span class="formula">${P(o.f)}</span>`}</button>`);
      b.onclick = () => {
        if (answered) return;
        answered = true; total++;
        box.querySelectorAll(".opt").forEach((x, j) => { x.disabled = true; if (opts[j] === cur) x.classList.add("right"); });
        const ok = o === cur;
        if (ok) score++; else b.classList.add("wrong");
        s6.querySelector("[data-score]").textContent = score;
        s6.querySelector("[data-total]").textContent = total;
        s6.querySelector("[data-msg]").innerHTML = `${ok ? "<b style='color:var(--good)'>Верно!</b>" : "<b style='color:var(--bad)'>Не совсем.</b>"} ${P(cur.f)} — ${cur.n} (${CLS[cur.c]}).`;
      };
      box.appendChild(b);
    }
    s6.querySelector("[data-msg]").textContent = "";
  };
  s6.querySelector("[data-next]").onclick = next;
  s6.querySelectorAll("[data-mode]").forEach((b) => (b.onclick = () => {
    s6.querySelectorAll("[data-mode]").forEach((x) => x.classList.toggle("on", x === b));
    mode = +b.dataset.mode; next();
  }));
  next();
}

export const quiz = [
  { q: "Как называется Fe₂O₃?", options: ["оксид железа(II)", "оксид железа(III)", "диоксид железа", "железная окись(VI)"], answer: 1, why: "3 · II = 6 единиц на 2 атома железа → Fe(III)." },
  { q: "Соли серной кислоты называются…", options: ["сульфиды", "сульфиты", "сульфаты", "сернаты"], answer: 2, why: "SO₄²⁻ — сульфат; сульфит — SO₃²⁻, сульфид — S²⁻." },
  { q: "Формула нитрата кальция:", options: ["CaNO₃", "Ca(NO₃)₂", "Ca₂NO₃", "CaN₂O₆"], answer: 1, why: "Ca — II, NO₃ — I: нужно два остатка, берём их в скобки." },
  { q: "Как называется KOH?", options: ["оксид калия", "гидрид калия", "гидроксид калия", "калиевая кислота"], answer: 2, why: "Металл + группа OH — гидроксид." },
  { q: "Окончание «-ид» в названии соли означает, что кислотный остаток…", options: ["содержит много кислорода", "не содержит кислорода", "содержит водород", "двухвалентный"], answer: 1, why: "Хлорид, сульфид, бромид — остатки бескислородных кислот." },
  { q: "Тривиальное название NaHCO₃:", options: ["поваренная соль", "пищевая сода", "мел", "гашёная известь"], answer: 1, why: "Гидрокарбонат натрия — пищевая (питьевая) сода." },
];
