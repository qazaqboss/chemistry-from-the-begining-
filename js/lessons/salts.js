import { h, kid, term, stage, esc } from "../ui.js";
import { createViewer } from "../three/core.js";
import { createDissolve } from "../three/salts-dissolve.js";
import { parseFormula, pretty } from "../chem.js";

// ---------- Таблица растворимости (вода, ~20 °C) ----------
// Р — растворимо (> 1 г на 100 г воды), М — малорастворимо, Н — нерастворимо (< 0,01 г), «—» — не существует или разлагается водой
const CAT = [
  ["H", "H⁺", 1, "водорода"], ["Na", "Na⁺", 1, "натрия"], ["K", "K⁺", 1, "калия"], ["NH4", "NH₄⁺", 1, "аммония"],
  ["Ba", "Ba²⁺", 2, "бария"], ["Ca", "Ca²⁺", 2, "кальция"], ["Mg", "Mg²⁺", 2, "магния"], ["Al", "Al³⁺", 3, "алюминия"],
  ["Zn", "Zn²⁺", 2, "цинка"], ["Fe", "Fe²⁺", 2, "железа(II)"], ["Fe", "Fe³⁺", 3, "железа(III)"], ["Cu", "Cu²⁺", 2, "меди(II)"],
  ["Ag", "Ag⁺", 1, "серебра"], ["Pb", "Pb²⁺", 2, "свинца(II)"],
];
const AN = [
  ["OH", "OH⁻", 1, "гидроксид", "вода"], ["F", "F⁻", 1, "фторид", "фтороводородная (плавиковая) кислота"], ["Cl", "Cl⁻", 1, "хлорид", "соляная кислота"],
  ["Br", "Br⁻", 1, "бромид", "бромоводородная кислота"], ["I", "I⁻", 1, "иодид", "иодоводородная кислота"], ["S", "S²⁻", 2, "сульфид", "сероводородная кислота"],
  ["SO3", "SO₃²⁻", 2, "сульфит", "сернистая кислота (неустойчива)"], ["SO4", "SO₄²⁻", 2, "сульфат", "серная кислота"], ["NO3", "NO₃⁻", 1, "нитрат", "азотная кислота"],
  ["PO4", "PO₄³⁻", 3, "фосфат", "фосфорная кислота"], ["CO3", "CO₃²⁻", 2, "карбонат", "угольная кислота (распадается на CO₂ и H₂O)"],
  ["SiO3", "SiO₃²⁻", 2, "силикат", "кремниевая кислота"], ["CH3COO", "CH₃COO⁻", 1, "ацетат", "уксусная кислота"],
];
const SOL = [
  "-RRRRRRRRRRNR", "RRRRRRRRRRRRR", "RRRRRRRRRRRRR", "RRRRRRRRRRR-R", "RMRRRRNNRNNNR", "MNRRRMNMRNNNR", "NMRRR-MRRNMNR",
  "NMRRR--RRN-NM", "NMRRRNMRRNNNR", "NMRRRNNRRNNNR", "NMRR---RRN-NR", "NMRR-N-RRN-NR", "-RNNNNNMRNNNM", "NMMMNNNNRNNNR",
].map((r) => r.replace(/R/g, "Р").replace(/M/g, "М").replace(/N/g, "Н").replace(/-/g, "—"));
const POLY = new Set(["NH4", "OH", "SO3", "SO4", "NO3", "PO4", "CO3", "SiO3", "CH3COO"]);
const COLORS = { AgCl: "белый творожистый", AgBr: "светло-жёлтый", AgI: "жёлтый", BaSO4: "белый, мелкокристаллический", "Cu(OH)2": "голубой студенистый", "Fe(OH)3": "бурый", "Fe(OH)2": "серо-зелёный, буреет на воздухе", PbI2: "ярко-жёлтый («золотой дождь»)", CuS: "чёрный", PbS: "чёрный", ZnS: "белый", Ag3PO4: "жёлтый", CaCO3: "белый", BaCO3: "белый", "Al(OH)3": "белый студенистый", "Zn(OH)2": "белый", "Mg(OH)2": "белый", FeS: "чёрный", Ag2S: "чёрный", H2SiO3: "бесцветный студенистый (гель)", PbSO4: "белый", Ag2CO3: "желтоватый" };
const gcd = (a, b) => (b ? gcd(b, a % b) : a);
function formula(ci, ai) {
  const [c, , qc] = CAT[ci], [a, , qa] = AN[ai];
  if (c === "H" && a === "OH") return "H2O";
  if (c === "H" && a === "CH3COO") return "CH3COOH";
  const l = (qc * qa) / gcd(qc, qa), nc = l / qc, na = l / qa;
  const part = (s, n) => (n === 1 ? s : POLY.has(s) ? `(${s})${n}` : s + n);
  return part(c, nc) + part(a, na);
}
const solName = (ci, ai) => (ci === 0 ? AN[ai][4] : `${AN[ai][3]} ${CAT[ci][3]}`);
const MEAN = { "Р": "растворимо", "М": "малорастворимо", "Н": "нерастворимо — выпадает в осадок", "—": "не существует в воде или разлагается водой" };

// ---------- реакции обмена ----------
const REAG = [["AgNO3", 12, 8], ["BaCl2", 4, 2], ["Na2SO4", 1, 7], ["Na2CO3", 1, 10], ["HCl", 0, 2], ["H2SO4", 0, 7], ["NaOH", 1, 0], ["CuSO4", 11, 7], ["FeCl3", 10, 2], ["KNO3", 2, 8], ["NH4Cl", 3, 2], ["Pb(NO3)2", 13, 8], ["KI", 2, 4], ["Na2S", 1, 5], ["Ca(OH)2", 5, 0]];
// продукт пары ионов: { subs: [[формула, знак]], kind: "s"|"p"|"g"|"w"|"x", net }
function product(ci, ai) {
  const c = CAT[ci][0], a = AN[ai][0];
  if (c === "H" && a === "OH") return { subs: [["H2O", ""]], kind: "w", net: "H⁺ + OH⁻ → H₂O" };
  if (c === "H" && a === "CO3") return { subs: [["H2O", ""], ["CO2", "↑"]], kind: "g", net: "2H⁺ + CO₃²⁻ → H₂O + CO₂↑" };
  if (c === "H" && a === "SO3") return { subs: [["H2O", ""], ["SO2", "↑"]], kind: "g", net: "2H⁺ + SO₃²⁻ → H₂O + SO₂↑" };
  if (c === "H" && a === "S") return { subs: [["H2S", "↑"]], kind: "g", net: "2H⁺ + S²⁻ → H₂S↑" };
  if (c === "NH4" && a === "OH") return { subs: [["NH3", "↑"], ["H2O", ""]], kind: "g", net: "NH₄⁺ + OH⁻ → NH₃↑ + H₂O" };
  if (c === "Ag" && a === "OH") return { subs: [["Ag2O", "↓"], ["H2O", ""]], kind: "p", net: "2Ag⁺ + 2OH⁻ → Ag₂O↓ + H₂O" };
  const s = SOL[ci][ai], f = formula(ci, ai);
  if (s === "Н" || s === "М") {
    const l = parseFormula(f), nc = CAT[ci][0] === "NH4" ? 1 : l[CAT[ci][0]] ?? 1;
    const na = (nc * CAT[ci][2]) / AN[ai][2];
    return { subs: [[f, "↓"]], kind: "p", net: `${nc > 1 ? nc : ""}${CAT[ci][1]} + ${na > 1 ? na : ""}${AN[ai][1]} → ${pretty(f)}↓`, weak: s === "М" };
  }
  if (s === "—") return { subs: [[f, ""]], kind: "x" };
  return { subs: [[f, ""]], kind: "s" };
}
function balance(left, right) {
  const all = [...left, ...right].map((f) => parseFormula(f));
  const els = [...new Set(all.flatMap((o) => Object.keys(o)))];
  const n = all.length, c = new Array(n).fill(1);
  const rec = (i) => {
    if (i === n) return els.every((e) => all.reduce((s, o, k) => s + (k < left.length ? 1 : -1) * c[k] * (o[e] || 0), 0) === 0);
    for (let k = 1; k <= 6; k++) { c[i] = k; if (rec(i + 1)) return true; }
    return false;
  };
  return rec(0) ? c : null;
}

export async function render(el) {
  el.appendChild(h(`<style>
    .salts-sol { border-collapse: separate; border-spacing: 2px; font-size: 0.8rem; margin: 10px 0; }
    .salts-sol th { font-weight: 800; padding: 4px 3px; color: var(--text-2); white-space: nowrap; text-align: center; }
    .salts-sol td button { width: 100%; min-width: 30px; height: 30px; border: 1px solid transparent; border-radius: 6px; font: inherit; font-weight: 800; cursor: pointer; color: var(--text); }
    .salts-sol td button.R { background: color-mix(in srgb, var(--good) 22%, var(--surface)); }
    .salts-sol td button.M { background: color-mix(in srgb, var(--warn) 28%, var(--surface)); }
    .salts-sol td button.N { background: color-mix(in srgb, var(--bad) 26%, var(--surface)); }
    .salts-sol td button.X { background: var(--surface-2); color: var(--text-3); }
    .salts-sol td button.on, .salts-sol td button:hover { border-color: var(--accent); box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 40%, transparent); }
    .salts-sol tr.hl th, .salts-sol th.hl { color: var(--accent); }
  </style>`));
  el.appendChild(h(`<div>
    <p class="lead">${term("salt", "Соли")} — сложные вещества, состоящие из катионов металла (или аммония NH₄⁺) и анионов кислотного остатка. Это самый многочисленный класс неорганических веществ: поваренная соль, мел и мрамор, гипс, медный купорос, селитра, сода — всё это соли.</p>
    ${kid("Соль получается, когда кислота и основание «меняются партнёрами»: металл из основания берёт себе кислотный остаток, а H⁺ и OH⁻ уходят в воду. Получается вещество-«ребёнок» — соль.")}
  </div>`));

  el.appendChild(h(`<section id="types"><h2>Средние, кислые и основные соли</h2>
    <div class="table-wrap"><table class="data">
      <tr><th>Тип</th><th>Что это</th><th>Пример</th></tr>
      <tr><td><b>Средние</b></td><td>все атомы H кислоты заменены на металл</td><td>Na₂SO₄ сульфат натрия, CaCO₃ карбонат кальция</td></tr>
      <tr><td><b>${term("acid_salt", "Кислые")}</b></td><td>в остатке сохранились атомы H (только у многоосновных кислот)</td><td>NaHCO₃ гидрокарбонат натрия (пищевая сода), KH₂PO₄ дигидрофосфат калия</td></tr>
      <tr><td><b>${term("basic_salt", "Основные")}</b></td><td>кроме остатка есть группы OH</td><td>(CuOH)₂CO₃ гидроксокарбонат меди(II) — малахит; Mg(OH)Cl</td></tr>
      <tr class="adv"><td><b>Двойные и комплексные</b></td><td>два разных катиона / сложный ион</td><td>KAl(SO₄)₂·12H₂O алюмокалиевые квасцы; K₄[Fe(CN)₆]</td></tr>
    </table></div>
    <p><b>Как назвать:</b> название кислотного остатка + металл в родительном падеже + степень окисления (если переменная): FeCl₃ — хлорид железа(III), Cu(NO₃)₂ — нитрат меди(II). Кислые соли получают приставку «гидро-»: NaHSO₄ — гидросульфат натрия.</p>
    <div class="callout">Кислородсодержащие кислоты с высшей степенью окисления дают остатки на «-ат» (сульфат SO₄²⁻, нитрат NO₃⁻), с низшей — на «-ит» (сульфит SO₃²⁻, нитрит NO₂⁻), бескислородные — на «-ид» (хлорид, сульфид).</div>
  </section>`));

  // ---------- 3D: растворение ----------
  const sec = h(`<section id="dissolve"><h2>Кристалл соли растворяется в 3D</h2>
    <p>Кристалл NaCl — решётка из ионов Na⁺ (фиолетовые) и Cl⁻ (зелёные). Полярные молекулы воды облепляют ионы на поверхности и растаскивают их. Первыми уходят ионы с вершин и рёбер — у них меньше соседей, их слабее держит решётка. Каждый ион уносит с собой «шубу» из молекул воды (гидратацию): к Na⁺ вода повёрнута кислородом, к Cl⁻ — водородами.</p>
  </section>`);
  el.appendChild(sec);
  const st = stage(`<div class="overlay"><span><b>NaCl → Na⁺ + Cl⁻</b></span><span data-c></span></div>`, { wide: true });
  sec.appendChild(st);
  const ctl = h(`<div class="card pad" style="margin-top:10px"><div class="row"><button class="btn primary" type="button" data-play>▶ Бросить в воду</button><input type="range" min="0" max="1" step="0.001" value="0" data-t style="flex:1;min-width:140px"></div>
    <p class="small muted" style="margin:10px 0 0">Ионный радиус Cl⁻ (1,81 Å) почти вдвое больше, чем у Na⁺ (1,02 Å); в «шубе» на модели 4 молекулы воды, в реальности около шести. Мел CaCO₃ так не растворяется: ионы Ca²⁺ и CO₃²⁻ держатся друг за друга сильнее, чем вода может их оттащить.</p></div>`);
  sec.appendChild(ctl);
  const v = createViewer(st, { camera: [7, 5, 14], fitWidth: 7.2, minDistance: 3, maxDistance: 30, autoRotateSpeed: 0.5 });
  const dis = createDissolve(v);
  ctl.querySelector("[data-play]").onclick = () => dis.play();
  ctl.querySelector("[data-t]").oninput = (e) => dis.set(+e.target.value);
  v.onFrame(() => {
    if (dis.playing) ctl.querySelector("[data-t]").value = dis.t;
    st.querySelector("[data-c]").textContent = `в растворе: ${dis.dissolved} из ${dis.total} ионов`;
  });

  // ---------- Таблица растворимости ----------
  const tb = h(`<section id="solubility"><h2>Таблица растворимости</h2>
    <p>Главная «шпаргалка» на ОГЭ — она лежит прямо в справочных материалах. Нажми на клетку: увидишь формулу и название вещества, его растворимость и цвет осадка.</p>
    <div class="table-wrap"><table class="salts-sol">
      <tr><th></th>${AN.map((a, j) => `<th data-col="${j}">${a[1]}</th>`).join("")}</tr>
      ${CAT.map((c, i) => `<tr data-row="${i}"><th>${c[1]}</th>${AN.map((a, j) => { const s = SOL[i][j]; return `<td><button type="button" class="${{ "Р": "R", "М": "M", "Н": "N", "—": "X" }[s]}" data-i="${i}" data-j="${j}" aria-label="${esc(solName(i, j))}: ${MEAN[s]}">${s}</button></td>`; }).join("")}</tr>`).join("")}
    </table></div>
    <p class="small muted">Р — растворимо (больше 1 г в 100 г воды), М — малорастворимо, Н — нерастворимо (меньше 0,01 г), «—» — в водном растворе не существует (разлагается водой или вступает в окислительно-восстановительную реакцию).</p>
    <div class="card pad" data-info></div>
  </section>`);
  el.appendChild(tb);
  const info = tb.querySelector("[data-info]");
  const pick = (i, j) => {
    tb.querySelectorAll(".on, .hl").forEach((x) => x.classList.remove("on", "hl"));
    tb.querySelector(`[data-i="${i}"][data-j="${j}"]`).classList.add("on");
    tb.querySelector(`[data-row="${i}"]`).classList.add("hl");
    tb.querySelector(`[data-col="${j}"]`).classList.add("hl");
    const s = SOL[i][j], f = formula(i, j);
    const col = COLORS[f];
    let extra = "";
    if (s === "—") extra = i === 0 ? "Вода — продукт нейтрализации H⁺ + OH⁻." : AN[j][0] === "I" ? "Ионы Fe³⁺ и Cu²⁺ окисляют иодид до свободного иода I₂ — соль не образуется." : AN[j][0] === "OH" ? "Вместо AgOH сразу выпадает бурый оксид Ag₂O." : "Слабое основание + слабая кислота: вода разлагает такую соль (полный гидролиз), выпадает гидроксид и выделяется газ.";
    else if (s === "Н" || s === "М") {
      const ag = REAG.find((r) => r[1] === i), bg = REAG.find((r) => r[2] === j && r[1] !== i);
      extra = `${col ? `Цвет осадка: <b>${col}</b>. ` : ""}${ag && bg ? `Получить: <span class="formula">${pretty(ag[0])} + ${pretty(bg[0])}</span> — смешать растворы.` : ""}`;
    }
    info.innerHTML = `<p class="mt0" style="font-size:1.15rem"><b class="formula">${pretty(f)}</b> — ${esc(solName(i, j))}</p>
      <p class="mt0"><b>${s}</b>: ${MEAN[s]}. ${extra}</p>`;
  };
  tb.querySelectorAll("[data-i]").forEach((b) => (b.onclick = () => pick(+b.dataset.i, +b.dataset.j)));
  pick(12, 2);

  // ---------- Реакции обмена ----------
  const rx = h(`<section id="exchange"><h2>Свойства солей и реакции обмена</h2>
    <p>Соли реагируют с кислотами, щелочами и другими солями по типу ${term("exchange", "обмена")}: ионы «меняются партнёрами». Но реакция в растворе идёт до конца только если образуется <b>осадок</b> (↓), <b>газ</b> (↑) или <b>вода</b> (правило Бертолле). Иначе ионы просто плавают вперемешку. Выбери два раствора — программа проверит по таблице растворимости:</p>
    <div class="card pad">
      <div class="row"><label class="ctl">Раствор 1<select data-a>${REAG.map((r, i) => `<option value="${i}">${pretty(r[0])}</option>`).join("")}</select></label>
      <span style="font-weight:800;font-size:1.3rem;margin-top:16px">+</span>
      <label class="ctl">Раствор 2<select data-b>${REAG.map((r, i) => `<option value="${i}">${pretty(r[0])}</option>`).join("")}</select></label></div>
      <div data-out style="margin-top:12px"></div>
    </div>
  </section>`);
  el.appendChild(rx);
  rx.querySelector("[data-a]").value = 0; rx.querySelector("[data-b]").value = 1;
  const runRx = () => {
    const A = REAG[+rx.querySelector("[data-a]").value], B = REAG[+rx.querySelector("[data-b]").value];
    const out = rx.querySelector("[data-out]");
    if (A[1] === B[1] || A[2] === B[2]) { out.innerHTML = `<p class="mt0"><b>Реакция не идёт:</b> ${A[1] === B[1] ? "одинаковые катионы" : "одинаковые анионы"} — обмениваться нечем.</p>`; return; }
    if (A[1] === 0 && B[1] === 0) { out.innerHTML = `<p class="mt0"><b>Реакция не идёт:</b> две кислоты друг с другом не реагируют.</p>`; return; }
    const p1 = product(A[1], B[2]), p2 = product(B[1], A[2]);
    if (p1.kind === "x" || p2.kind === "x") { out.innerHTML = `<p class="mt0"><b>Сложный случай:</b> одно из веществ (${pretty(p1.kind === "x" ? p1.subs[0][0] : p2.subs[0][0])}) в воде не существует — идёт гидролиз или окислительно-восстановительная реакция. Это разбирается в старших классах.</p>`; return; }
    const prods = [...p1.subs, ...p2.subs];
    const good = [p1, p2].filter((p) => p.kind !== "s");
    const c = balance([A[0], B[0]], prods.map((s) => s[0]));
    const k = (n) => (n > 1 ? n : "");
    const eq = c ? `${k(c[0])}${pretty(A[0])} + ${k(c[1])}${pretty(B[0])} → ${prods.map((s, i) => `${k(c[i + 2])}${pretty(s[0])}${s[1]}`).join(" + ")}` : "";
    if (!good.length) { out.innerHTML = `<p class="mt0"><b style="color:var(--bad)">Реакция практически не идёт.</b> Оба возможных продукта (${pretty(p1.subs[0][0])}, ${pretty(p2.subs[0][0])}) растворимы — нет ни осадка, ни газа, ни воды. В растворе просто смесь ионов.</p>`; return; }
    const why = good.map((p) => (p.kind === "p" ? `осадок ${pretty(p.subs[0][0])}${COLORS[p.subs[0][0]] ? ` (${COLORS[p.subs[0][0]]})` : ""}${p.weak ? " — малорастворим, выпадает при достаточной концентрации" : ""}` : p.kind === "g" ? `газ ${pretty(p.subs.find((s) => s[1] === "↑")[0])}` : "вода")).join(", ");
    out.innerHTML = `<div class="eq mt0" style="margin-top:0">${eq}</div><p class="mt0"><b style="color:var(--good)">Реакция идёт:</b> образуется ${why}.</p>
      <p class="small muted mt0">Сокращённое ионное уравнение: <span class="formula">${good.map((p) => p.net).join("; ")}</span> — подробнее в уроке <a href="#lesson-ionic">«Ионные уравнения»</a>.</p>`;
  };
  rx.querySelectorAll("select").forEach((s) => (s.onchange = runRx));
  runRx();
  rx.appendChild(h(`<ul>
    <li><b>Соль + металл:</b> более активный металл вытесняет менее активный из раствора его соли: <span class="formula">Fe + CuSO₄ → FeSO₄ + Cu</span> (гвоздь краснеет).</li>
    <li><b>Разложение при нагревании:</b> <span class="formula">CaCO₃ →(t) CaO + CO₂↑</span>, <span class="formula">2KNO₃ →(t) 2KNO₂ + O₂↑</span>.</li>
    <li><b>Качественные реакции</b> — узнаём ионы по осадку: Cl⁻ — AgNO₃ (белый творожистый AgCl), SO₄²⁻ — BaCl₂ (белый BaSO₄), CO₃²⁻ — кислота (вскипание CO₂).</li>
  </ul>`));
  rx.appendChild(h(`<div>${kid("Опыт: капни лимонным соком или уксусом на кусочек мела или яичную скорлупу (это CaCO₃). Зашипит — выделяется углекислый газ. Так же проверяют, есть ли в камне известняк.", "Опыт")}</div>`));
}

export const quiz = [
  { q: "Какая соль кислая?", options: ["Na₂CO₃", "NaHCO₃", "(CuOH)₂CO₃", "NaCl"], answer: 1, why: "В гидрокарбонате HCO₃⁻ остался атом водорода кислоты." },
  { q: "Название соли Fe₂(SO₄)₃:", options: ["сульфит железа(II)", "сульфат железа(III)", "сульфид железа", "сульфат железа(II)"], answer: 1, why: "SO₄²⁻ — сульфат; железо здесь +3: 2x = 3·2." },
  { q: "Какое вещество нерастворимо в воде?", options: ["NaNO₃", "K₂SO₄", "BaSO₄", "CuCl₂"], answer: 2, why: "Сульфат бария — белый осадок, по нему узнают ион SO₄²⁻." },
  { q: "Какая пара растворов реагирует с образованием осадка?", options: ["KNO₃ + NaCl", "AgNO₃ + NaCl", "Na₂SO₄ + KCl", "NH₄Cl + KNO₃"], answer: 1, why: "Ag⁺ + Cl⁻ → AgCl↓ — белый творожистый осадок." },
  { q: "Реакция Na₂CO₃ + 2HCl идёт, потому что…", options: ["выпадает осадок", "выделяется газ CO₂", "образуется металл", "она не идёт"], answer: 1, why: "Угольная кислота распадается на воду и углекислый газ." },
  { q: "Почему при растворении NaCl ионы Na⁺ окружены молекулами воды, повёрнутыми кислородом?", options: ["кислород тяжелее", "на кислороде частичный отрицательный заряд", "так случайно", "Na⁺ отрицательный"], answer: 1, why: "Противоположные заряды притягиваются: δ− на кислороде к катиону." },
];
