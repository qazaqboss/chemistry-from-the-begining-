import { h, kid, term, esc } from "../ui.js";
import { molarMass, pretty, fmt, BY_SYMBOL, sup } from "../chem.js";
const sci = (x) => { if (!x) return "0"; const e = Math.floor(Math.log10(x)); return `${fmt(x / 10 ** e, 3)}·10${sup(e)}`; };

const NA = 6.02214076e23;

export async function render(el) {
  el.appendChild(h(`<div>
    <p class="lead">Атомы так малы, что считать их поштучно невозможно. Химики считают «пачками» — ${term("mole", "молями")}. В одном моле любого вещества ровно 6,022·10²³ частиц — это число Авогадро.</p>
    ${kid("Яйца считают десятками, бумагу — пачками по 500 листов. А атомы — молями: 602 214 076 000 000 000 000 000 штук в одной «пачке»! Если сложить столько горошин, они покроют всю Землю слоем в несколько метров.")}
  </div>`));

  el.appendChild(h(`<section id="molar"><h2>Молярная масса</h2>
    <p>Главное удобство: <b>масса 1 моль вещества в граммах численно равна его атомной или молекулярной массе</b>. Атомная масса углерода 12,011 → 1 моль углерода весит 12,011 г. Молярную массу молекулы находят сложением масс всех её атомов.</p>
    <div class="eq">M(H₂O) = 2·1,008 + 16,00 = 18,02 г/моль</div>
    <h3>Три главные формулы</h3>
    <div class="eq">n = m / M &nbsp;&nbsp;·&nbsp;&nbsp; N = n · Nₐ &nbsp;&nbsp;·&nbsp;&nbsp; V = n · 22,4 л (газ при н. у.)</div>
    <p class="small muted">n — количество вещества (моль), m — масса (г), M — молярная масса (г/моль), N — число частиц, Nₐ = 6,022·10²³ моль⁻¹, V — объём газа при 0 °C и 1 атм.</p>
  </section>`));

  const calc = h(`<section id="calc"><h2>Калькулятор</h2>
    <p>Введи формулу (понимает скобки и кристаллогидраты, например <span class="formula">Ca(OH)2</span>, <span class="formula">CuSO4·5H2O</span>) и массу.</p>
    <div class="card pad">
      <div class="row"><label class="ctl">Формула<input type="text" value="H2O" data-f style="width:220px"></label><label class="ctl">Масса, г<input type="number" value="100" min="0" step="any" data-m style="width:140px"></label></div>
      <div data-out style="margin-top:14px"></div>
      <div class="row" style="margin-top:10px"><span class="small muted">Примеры:</span>${["NaCl", "CO2", "C6H12O6", "H2SO4", "Ca(OH)2", "CuSO4·5H2O", "Fe2O3", "C2H5OH"].map((f) => `<button class="chip" type="button" data-ex="${f}">${pretty(f)}</button>`).join("")}</div>
    </div>
  </section>`);
  el.appendChild(calc);
  const fIn = calc.querySelector("[data-f]"), mIn = calc.querySelector("[data-m]"), out = calc.querySelector("[data-out]");
  const run = () => {
    try {
      const { mass, parts } = molarMass(fIn.value);
      const m = +mIn.value || 0;
      const n = m / mass;
      out.innerHTML = `<div class="table-wrap"><table class="data"><tr><th>Элемент</th><th>Атомов</th><th>Ar</th><th>Вклад</th><th>Доля по массе</th></tr>
        ${parts.map((p) => `<tr><td><a href="#element-${BY_SYMBOL[p.sym].z}">${p.sym}</a></td><td>${p.n}</td><td>${fmt(p.a, 3)}</td><td>${fmt(p.sub, 3)}</td><td>${fmt((p.sub / mass) * 100, 1)}%</td></tr>`).join("")}
        </table></div>
        <div class="eq">M(${pretty(esc(fIn.value))}) = ${fmt(mass, 3)} г/моль</div>
        <p>${fmt(m, 3)} г — это <b>n = ${fmt(n, 4)} моль</b>, то есть <b>N ≈ ${sci(n * NA)}</b> частиц${n ? `; если это газ — ${fmt(n * 22.414, 3)} л при н. у.` : ""}.</p>`;
    } catch (e) {
      out.innerHTML = `<p style="color:var(--bad)">${esc(e.message)}. Пиши символы с заглавной буквы: Na, Cl, O.</p>`;
    }
  };
  fIn.oninput = mIn.oninput = run;
  calc.querySelectorAll("[data-ex]").forEach((b) => (b.onclick = () => { fIn.value = b.dataset.ex; run(); }));
  run();

  el.appendChild(h(`<section id="tasks"><h2>Разбор задачи</h2>
    <div class="card pad">
      <p><b>Задача.</b> Сколько граммов воды образуется при сгорании 4 г водорода?</p>
      <ol>
        <li>Уравнение: <span class="formula">2H₂ + O₂ → 2H₂O</span> — из 2 моль H₂ получается 2 моль H₂O (1 : 1).</li>
        <li>n(H₂) = m / M = 4 / 2,016 ≈ 1,98 моль.</li>
        <li>n(H₂O) = n(H₂) ≈ 1,98 моль.</li>
        <li>m(H₂O) = n · M = 1,98 · 18,02 ≈ <b>35,7 г</b>.</li>
      </ol>
      <p class="small muted mt0">Проверка законом сохранения массы: 4 г H₂ + 31,7 г O₂ = 35,7 г H₂O.</p>
    </div>
  </section>`));
}

export const quiz = [
  { q: "Сколько частиц в 1 моль вещества?", options: ["1000", "6,022·10²³", "22,4", "12"], answer: 1, why: "Это число Авогадро." },
  { q: "Молярная масса CO₂ (C = 12, O = 16):", options: ["28 г/моль", "44 г/моль", "32 г/моль", "60 г/моль"], answer: 1, why: "12 + 2·16 = 44." },
  { q: "Сколько моль в 36 г воды (M = 18 г/моль)?", options: ["0,5", "1", "2", "18"], answer: 2, why: "n = 36 / 18 = 2 моль." },
  { q: "Какой объём занимает 1 моль любого газа при н. у.?", options: ["1 л", "22,4 л", "6,02 л", "100 л"], answer: 1, why: "Закон Авогадро: 22,4 л при 0 °C и 1 атм." },
];
