import { h, kid, term, stage, chips, esc } from "../ui.js";
import { createViewer } from "../three/core.js";
import { createConveyor } from "../three/stoich-conveyor.js";
import { molarMass, pretty, fmt } from "../chem.js";

// Реакции для калькулятора: [формула, коэффициент, газ?]; сторона: первые r — реагенты
const RX = [
  { eq: "2H2 + O2 → 2H2O", r: 2, sp: [["H2", 2, 1], ["O2", 1, 1], ["H2O", 2, 0]] },
  { eq: "Zn + 2HCl → ZnCl2 + H2↑", r: 2, sp: [["Zn", 1, 0], ["HCl", 2, 0], ["ZnCl2", 1, 0], ["H2", 1, 1]] },
  { eq: "CaCO3 → CaO + CO2↑", r: 1, sp: [["CaCO3", 1, 0], ["CaO", 1, 0], ["CO2", 1, 1]] },
  { eq: "4P + 5O2 → 2P2O5", r: 2, sp: [["P", 4, 0], ["O2", 5, 1], ["P2O5", 2, 0]] },
  { eq: "Fe2O3 + 3H2 → 2Fe + 3H2O", r: 2, sp: [["Fe2O3", 1, 0], ["H2", 3, 1], ["Fe", 2, 0], ["H2O", 3, 0]] },
  { eq: "CuSO4 + 2NaOH → Cu(OH)2↓ + Na2SO4", r: 2, sp: [["CuSO4", 1, 0], ["NaOH", 2, 0], ["Cu(OH)2", 1, 0], ["Na2SO4", 1, 0]] },
  { eq: "CH4 + 2O2 → CO2 + 2H2O", r: 2, sp: [["CH4", 1, 1], ["O2", 2, 1], ["CO2", 1, 1], ["H2O", 2, 0]] },
  { eq: "2Al + 6HCl → 2AlCl3 + 3H2↑", r: 2, sp: [["Al", 2, 0], ["HCl", 6, 0], ["AlCl3", 2, 0], ["H2", 3, 1]] },
];
const M = (f) => molarMass(f).mass;
const P = (s) => pretty(s);

export async function render(el) {
  el.appendChild(h(`<div>
    <p class="lead">Уравнение реакции — это не только «что получится», но и точный рецепт: в каких пропорциях вещества реагируют. Зная массу одного участника, можно рассчитать массы и объёмы всех остальных. Это главный тип расчётных задач ОГЭ.</p>
    ${kid("Рецепт бутерброда: 2 ломтика хлеба + 1 кусок сыра → 1 бутерброд. Если у тебя 10 ломтиков и 3 куска сыра, бутербродов будет только 3 — сыр кончится первым, а 4 ломтика хлеба останутся лишними. С молекулами всё точно так же!")}
  </div>`));

  el.appendChild(h(`<section id="ratio"><h2>Коэффициенты — это моли</h2>
    <p>Коэффициенты в уравнении показывают соотношение <b>количеств вещества</b> (${term("mole", "моль")}), а не масс:</p>
    <div class="eq">2H₂ + O₂ → 2H₂O &nbsp;⇒&nbsp; n(H₂) : n(O₂) : n(H₂O) = 2 : 1 : 2</div>
    <p>По массе это 4 г : 32 г : 36 г — совсем другие числа. Поэтому любая задача решается по одной схеме:</p>
    <ol>
      <li>Записать уравнение и проверить коэффициенты.</li>
      <li>Перевести данное в моли: n = m / M, для газа n = V / 22,4 л/моль (при н. у.).</li>
      <li>По коэффициентам найти моли искомого: n(X) = n(дано) · k(X) / k(дано).</li>
      <li>Перевести обратно: m = n · M или V = n · 22,4.</li>
    </ol>
    <div class="callout"><b>Важно:</b> пропорцию по уравнению составляют только для молей (или объёмов газов). Массы напрямую делить «по коэффициентам» нельзя — у веществ разные молярные массы.</div>
  </section>`));

  // ---------- 3D-конвейер ----------
  const sec = h(`<section id="conveyor"><h2>Молекулярный конвейер</h2>
    <p>Задай, сколько молекул водорода и кислорода положить на ленту, и запусти реактор. Каждые две H₂ и одна O₂ превращаются в две H₂O. Молекулы, которым не хватило пары, остаются на ленте и светятся — это ${term("limiting", "избыток")}.</p>
  </section>`);
  el.appendChild(sec);
  const st = stage(`<div class="overlay"><span class="formula" style="font-size:1rem">2H₂ + O₂ → 2H₂O</span><span data-res></span></div>`, { wide: true });
  sec.appendChild(st);
  const ctl = h(`<div class="card pad" style="margin-top:10px">
    <div class="grid-2" style="gap:12px">
      <label class="ctl">Молекул H₂: <b data-hv></b><input type="range" min="2" max="12" step="2" value="6" data-h></label>
      <label class="ctl">Молекул O₂: <b data-ov></b><input type="range" min="1" max="8" step="1" value="5" data-o></label>
    </div>
    <div class="row" style="margin-top:12px"><button class="btn primary" type="button" data-play>▶ Запустить реактор</button><input type="range" min="0" max="1" step="0.001" value="0" data-t style="flex:1;min-width:140px"></div>
    <p data-note style="margin:10px 0 0"></p>
  </div>`);
  sec.appendChild(ctl);
  const v = createViewer(st, { camera: [0, 10, 9], target: [0, 0.3, 0.3], fitWidth: 9.8, autoRotate: false, minDistance: 6, maxDistance: 40 });
  const conv = createConveyor(v);
  const q = (s) => ctl.querySelector(s);
  const rebuild = () => {
    const nH = +q("[data-h]").value, nO = +q("[data-o]").value;
    q("[data-hv]").textContent = nH; q("[data-ov]").textContent = nO;
    const r = conv.build(nH, nO);
    q("[data-t]").value = 0;
    const lim = nH / 2 < nO ? "H₂" : nH / 2 > nO ? "O₂" : null;
    st.querySelector("[data-res]").innerHTML = `→ <b>${r.water} H₂O</b>${r.leftH2 ? ` · избыток H₂: ${r.leftH2}` : ""}${r.leftO2 ? ` · избыток O₂: ${r.leftO2}` : ""}`;
    q("[data-note]").innerHTML = `Сравниваем n / k: для H₂ ${nH} / 2 = ${fmt(nH / 2, 1)}, для O₂ ${nO} / 1 = ${nO}. ` +
      (lim ? `Меньше у <b>${lim}</b> — он в недостатке, по нему и считаем продукт: n(H₂O) = ${r.water}. Второй реагент в избытке — ${r.leftH2 ? r.leftH2 + " H₂" : r.leftO2 + " O₂"} останется.` : `Числа равны — реагенты взяты точно по уравнению, ничего не останется.`);
  };
  q("[data-h]").oninput = q("[data-o]").oninput = rebuild;
  q("[data-play]").onclick = () => conv.play();
  q("[data-t]").oninput = (e) => conv.setT(+e.target.value);
  v.onFrame(() => { q("[data-t]").value = conv.t; });
  rebuild();

  // ---------- Калькулятор ----------
  const calc = h(`<section id="calc"><h2>Калькулятор задач по уравнению</h2>
    <p>Выбери реакцию, укажи, что известно, — калькулятор покажет ход решения и количества всех участников. Включи второй реагент, чтобы решать задачи на избыток и недостаток, и задай ${term("yield", "выход продукта")}.</p>
    <div class="card pad">
      <div data-rx style="margin-bottom:12px"></div>
      <div class="row">
        <label class="ctl">Дано вещество<select data-s1></select></label>
        <label class="ctl">Величина<select data-u1><option value="m">масса, г</option><option value="n">количество, моль</option><option value="V">объём газа, л</option></select></label>
        <label class="ctl">Значение<input type="number" min="0" step="any" value="10" data-v1 style="width:120px"></label>
      </div>
      <label class="row small" style="margin-top:10px"><input type="checkbox" data-two> Дан и второй реагент (задача на избыток)</label>
      <div class="row" data-second hidden style="margin-top:8px">
        <label class="ctl">Второй реагент<select data-s2></select></label>
        <label class="ctl">Масса, г<input type="number" min="0" step="any" value="10" data-v2 style="width:120px"></label>
      </div>
      <label class="ctl" style="margin-top:10px;max-width:420px">Выход продукта η: <b data-etav></b><input type="range" min="10" max="100" value="100" data-eta></label>
      <div data-out style="margin-top:12px"></div>
    </div>
  </section>`);
  el.appendChild(calc);
  let rx = RX[0];
  const c = (s) => calc.querySelector(s);
  const fillSelects = () => {
    c("[data-s1]").innerHTML = rx.sp.map(([f], i) => `<option value="${i}">${P(f)}</option>`).join("");
    c("[data-s2]").innerHTML = rx.sp.slice(0, rx.r).map(([f], i) => `<option value="${i}">${P(f)}</option>`).join("");
    c("[data-s2]").value = rx.r > 1 ? 1 : 0;
  };
  const toN = (i, u, val) => {
    const [f, , gas] = rx.sp[i];
    if (u === "n") return val;
    if (u === "V") return gas ? val / 22.4 : NaN;
    return val / M(f);
  };
  const run = () => {
    const out = c("[data-out]");
    const i1 = +c("[data-s1]").value, u1 = c("[data-u1]").value, v1 = +c("[data-v1]").value;
    const eta = +c("[data-eta]").value / 100;
    c("[data-etav]").textContent = `${Math.round(eta * 100)}%`;
    c("[data-second]").hidden = !c("[data-two]").checked;
    const [f1, k1] = rx.sp[i1];
    const n1 = toN(i1, u1, v1);
    if (!(n1 >= 0)) { out.innerHTML = `<p style="color:var(--bad)">${P(f1)} — не газ, объём через 22,4 л/моль считать нельзя. Выбери массу или количество.</p>`; return; }
    const steps = [];
    steps.push(u1 === "m" ? `n(${P(f1)}) = m / M = ${fmt(v1, 3)} / ${fmt(M(f1), 2)} = ${fmt(n1, 4)} моль` : u1 === "V" ? `n(${P(f1)}) = V / Vₘ = ${fmt(v1, 3)} / 22,4 = ${fmt(n1, 4)} моль` : `n(${P(f1)}) = ${fmt(n1, 4)} моль`);
    let xi = n1 / k1; // «число пробегов» реакции
    let given = [[i1, n1]];
    if (c("[data-two]").checked) {
      const i2 = +c("[data-s2]").value, v2 = +c("[data-v2]").value;
      if (i1 >= rx.r) { out.innerHTML = `<p style="color:var(--bad)">Для задачи на избыток первым тоже выбери реагент (левая часть уравнения).</p>`; return; }
      if (i2 === i1) { out.innerHTML = `<p style="color:var(--bad)">Выбери два разных реагента.</p>`; return; }
      const [f2, k2] = rx.sp[i2], n2 = v2 / M(f2);
      steps.push(`n(${P(f2)}) = ${fmt(v2, 3)} / ${fmt(M(f2), 2)} = ${fmt(n2, 4)} моль`);
      steps.push(`Сравниваем n / k: ${P(f1)} — ${fmt(n1 / k1, 4)}, ${P(f2)} — ${fmt(n2 / k2, 4)}. ${n1 / k1 === n2 / k2 ? "Равны: оба прореагируют полностью." : `В недостатке <b>${P(n1 / k1 < n2 / k2 ? f1 : f2)}</b>, расчёт ведём по нему.`}`);
      xi = Math.min(n1 / k1, n2 / k2);
      given.push([i2, n2]);
    }
    const rows = rx.sp.map(([f, k, gas], i) => {
      const n = xi * k, isProd = i >= rx.r;
      const g = given.find((x) => x[0] === i);
      const left = g && !isProd ? g[1] - n : 0;
      const np = isProd ? n * eta : n;
      return `<tr><td>${P(f)}</td><td>${k}</td><td>${fmt(M(f), 2)}</td><td>${isProd ? "образуется" : "расходуется"}: <b>${fmt(np, 4)}</b> моль${left > 1e-9 ? `<br><span class="small" style="color:var(--warn)">остаётся в избытке ${fmt(left, 4)} моль (${fmt(left * M(f), 2)} г)</span>` : ""}</td><td><b>${fmt(np * M(f), 3)}</b> г</td><td>${gas ? fmt(np * 22.4, 3) + " л" : "—"}</td></tr>`;
    }).join("");
    const pIdx = rx.r, [fp, kp] = rx.sp[pIdx];
    steps.push(`n(${P(fp)}) = ${fmt(xi, 4)} · ${kp} = ${fmt(xi * kp, 4)} моль → m = ${fmt(xi * kp, 4)} · ${fmt(M(fp), 2)} = ${fmt(xi * kp * M(fp), 3)} г${eta < 1 ? `; практически: ${fmt(xi * kp * M(fp), 3)} · ${fmt(eta, 2)} = <b>${fmt(xi * kp * M(fp) * eta, 3)} г</b>` : ""}`);
    out.innerHTML = `<div class="eq" style="font-size:1rem">${esc(P(rx.eq))}</div>
      <ol class="small">${steps.map((s) => `<li>${s}</li>`).join("")}</ol>
      <div class="table-wrap"><table class="data"><tr><th>Вещество</th><th>k</th><th>M, г/моль</th><th>n</th><th>m</th><th>V (н. у.)</th></tr>${rows}</table></div>
      ${eta < 1 ? `<p class="small muted">Продукты пересчитаны с выходом ${Math.round(eta * 100)}%: m(практ.) = η · m(теор.).</p>` : ""}`;
  };
  chips(c("[data-rx]"), RX.map((r) => ({ ...r, label: P(r.eq) })), (r) => { rx = r; fillSelects(); run(); });
  fillSelects();
  calc.querySelectorAll("select, input").forEach((x) => (x.oninput = x.onchange = run));
  run();

  // ---------- Разбор задач ----------
  el.appendChild(h(`<section id="tasks"><h2>Разбор задач ОГЭ</h2>
    <div class="card pad">
      <p class="mt0"><b>1. Масса осадка из раствора.</b> К 160 г раствора сульфата меди(II) с массовой долей 10% добавили избыток гидроксида натрия. Найдите массу осадка.</p>
      <ol>
        <li>CuSO₄ + 2NaOH → Cu(OH)₂↓ + Na₂SO₄</li>
        <li>m(CuSO₄) = 160 · 0,10 = 16 г; n = 16 / 160 = 0,1 моль.</li>
        <li>n(Cu(OH)₂) = n(CuSO₄) = 0,1 моль (коэффициенты 1 : 1).</li>
        <li>m(Cu(OH)₂) = 0,1 · 98 = <b>9,8 г</b>.</li>
      </ol>
    </div>
    <div class="card pad" style="margin-top:12px">
      <p class="mt0"><b>2. Избыток и недостаток.</b> 6,5 г цинка опустили в раствор, содержащий 3,65 г HCl. Какой объём водорода выделился (н. у.)?</p>
      <ol>
        <li>Zn + 2HCl → ZnCl₂ + H₂↑</li>
        <li>n(Zn) = 6,5 / 65 = 0,1 моль; n(HCl) = 3,65 / 36,5 = 0,1 моль.</li>
        <li>n / k: Zn — 0,1 / 1 = 0,1; HCl — 0,1 / 2 = 0,05. Кислота в недостатке.</li>
        <li>n(H₂) = n(HCl) / 2 = 0,05 моль; V = 0,05 · 22,4 = <b>1,12 л</b>. Половина цинка не растворится.</li>
      </ol>
    </div>
    <div class="card pad" style="margin-top:12px">
      <p class="mt0"><b>3. Выход продукта.</b> При обжиге 100 г известняка CaCO₃ получили 50,4 г негашёной извести. Каков выход?</p>
      <ol>
        <li>CaCO₃ → CaO + CO₂↑; n(CaCO₃) = 100 / 100 = 1 моль.</li>
        <li>Теоретически m(CaO) = 1 · 56 = 56 г.</li>
        <li>η = m(практ.) / m(теор.) = 50,4 / 56 = 0,9 = <b>90%</b>.</li>
      </ol>
    </div>
    <div class="callout adv">Закон объёмных отношений Гей-Люссака: для газов коэффициенты — это и соотношение объёмов (при одинаковых условиях). В реакции 2H₂ + O₂ на 10 л водорода нужно ровно 5 л кислорода — без перевода в моли.</div>
  </section>`));
}

export const quiz = [
  { q: "Что показывают коэффициенты в уравнении реакции?", options: ["соотношение масс", "соотношение количеств вещества (моль)", "плотность веществ", "скорость реакции"], answer: 1, why: "Коэффициенты — это мольные соотношения; для газов — ещё и объёмные." },
  { q: "Смешали 4 моль H₂ и 3 моль O₂ (2H₂ + O₂ → 2H₂O). Что в избытке?", options: ["H₂", "O₂", "ничего", "вода"], answer: 1, why: "n/k: H₂ — 4/2 = 2, O₂ — 3/1 = 3. Водород кончится первым, останется 1 моль O₂." },
  { q: "Сколько граммов CaO получится из 50 г CaCO₃ (M = 100 и 56 г/моль)?", options: ["50 г", "28 г", "56 г", "22 г"], answer: 1, why: "n = 50/100 = 0,5 моль, m(CaO) = 0,5 · 56 = 28 г." },
  { q: "Какой объём водорода (н. у.) выделится при растворении 0,2 моль Zn в избытке соляной кислоты?", options: ["2,24 л", "4,48 л", "22,4 л", "0,2 л"], answer: 1, why: "n(H₂) = n(Zn) = 0,2 моль; V = 0,2 · 22,4 = 4,48 л." },
  { q: "Теоретически можно получить 40 г продукта, получили 30 г. Выход продукта:", options: ["30%", "75%", "133%", "10%"], answer: 1, why: "η = 30 / 40 = 0,75 = 75%." },
  { q: "Расчёт продукта ведут по веществу, которое…", options: ["взято в избытке", "находится в недостатке", "имеет большую массу", "является газом"], answer: 1, why: "Реагент в недостатке расходуется полностью и ограничивает количество продукта." },
];
