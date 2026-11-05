import { h, kid, term, stage } from "../ui.js";
import { createViewer } from "../three/core.js";
import { createAtom } from "../three/atom.js";
import { byZ, shellsForElectrons, sup } from "../chem.js";

// Стабильные изотопы (для подсказки в конструкторе), Z: [массовые числа]
const STABLE = {
  1: [1, 2], 2: [3, 4], 3: [6, 7], 4: [9], 5: [10, 11], 6: [12, 13], 7: [14, 15], 8: [16, 17, 18], 9: [19], 10: [20, 21, 22],
  11: [23], 12: [24, 25, 26], 13: [27], 14: [28, 29, 30], 15: [31], 16: [32, 33, 34, 36], 17: [35, 37], 18: [36, 38, 40],
  19: [39, 41], 20: [40, 42, 43, 44, 46, 48],
};

export async function render(el) {
  el.appendChild(h(`<div>
    <p class="lead">Атом — мельчайшая частица химического элемента. Слово «атом» по-гречески значит «неделимый», но в XX веке выяснилось: атом состоит из ещё более мелких частиц.</p>
  </div>`));

  el.appendChild(h(`<section id="parts"><h2>Три частицы</h2>
    <div class="table-wrap"><table class="data">
      <tr><th>Частица</th><th>Где</th><th>Заряд</th><th>Масса, а. е. м.</th></tr>
      <tr><td><span class="dot" style="background:#ff5a6e"></span>${term("proton", "Протон")} p⁺</td><td>ядро</td><td>+1</td><td>1,0073</td></tr>
      <tr><td><span class="dot" style="background:#9aa7c7"></span>${term("neutron", "Нейтрон")} n⁰</td><td>ядро</td><td>0</td><td>1,0087</td></tr>
      <tr><td><span class="dot" style="background:#5fd4ff"></span>${term("electron", "Электрон")} e⁻</td><td>оболочка</td><td>−1</td><td>0,00055</td></tr>
    </table></div>
    <ul>
      <li><b>Число протонов = ${term("z", "атомный номер Z")}.</b> Оно и определяет элемент: 6 протонов — всегда углерод.</li>
      <li><b>Массовое число A = протоны + нейтроны.</b> Отсюда нейтронов N = A − Z.</li>
      <li>В нейтральном атоме электронов столько же, сколько протонов. Если электронов меньше или больше — это ${term("ion", "ион")}.</li>
      <li>Атомы одного элемента с разным числом нейтронов — ${term("isotope", "изотопы")}: ¹²C, ¹³C, ¹⁴C.</li>
    </ul>
    ${kid("Представь фрукт-сливу: косточка — это ядро (протоны и нейтроны), а мякоть вокруг — электроны. Только у атома «мякоть» почти пустая, а косточка крошечная.")}
    <div class="callout adv">История: Дж. Томсон открыл электрон (1897), Э. Резерфорд — ядро (1911), Н. Бор предложил модель с оболочками (1913), Дж. Чедвик открыл нейтрон (1932). Сегодня электрон описывают квантовой механикой — как «облако» вероятности (см. следующий урок).</div>
  </section>`));

  // ---------- конструктор ----------
  const sec = h(`<section id="builder"><h2>Конструктор атома</h2>
    <p>Добавляй и убирай частицы. Компьютер подскажет, какой получился элемент, его заряд и устойчиво ли ядро. Ползунок «разрез» снимает половину электронного облака, чтобы заглянуть внутрь.</p></section>`);
  el.appendChild(sec);
  const st = stage(`<div class="overlay"><span data-name style="font-size:1rem"></span><span data-sym></span></div>`);
  sec.appendChild(st);
  const panel = h(`<div class="card pad" style="margin-top:10px">
    <div class="builder">
      ${counter("p", "протоны", "#ff5a6e")}
      ${counter("n", "нейтроны", "#9aa7c7")}
      ${counter("e", "электроны", "#5fd4ff")}
    </div>
    <label class="ctl" style="margin-top:14px">Разрез<input type="range" min="0" max="1" step="0.01" value="0"></label>
    <div data-info style="margin-top:12px"></div>
    <div class="row" style="margin-top:8px">
      <span class="small muted">Быстро:</span>
      <button class="chip" data-p="1,0,1">Водород ¹H</button>
      <button class="chip" data-p="1,1,1">Дейтерий ²H</button>
      <button class="chip" data-p="6,6,6">Углерод-12</button>
      <button class="chip" data-p="6,8,6">Углерод-14</button>
      <button class="chip" data-p="11,12,10">Ион Na⁺</button>
      <button class="chip" data-p="17,18,18">Ион Cl⁻</button>
    </div>
  </div>`);
  sec.appendChild(panel);

  const s = { p: 6, n: 6, e: 6 };
  const v = createViewer(st, { camera: [0, 3, 11], clipping: true });
  const atom = createAtom(v, { z: s.p, n: s.n, e: s.e, shells: shellsForElectrons(s.e) });

  function update() {
    atom.set({ z: s.p, n: s.n, e: s.e, shells: shellsForElectrons(s.e) });
    for (const k of ["p", "n", "e"]) panel.querySelector(`[data-v=${k}]`).textContent = s[k];
    const el0 = s.p > 0 ? byZ(s.p) : null;
    const A = s.p + s.n;
    const q = s.p - s.e;
    const charge = q === 0 ? "" : sup(Math.abs(q) === 1 ? (q > 0 ? "+" : "−") : Math.abs(q) + (q > 0 ? "+" : "−"));
    st.querySelector("[data-name]").innerHTML = el0 ? `<b>${el0.name}</b>${A ? `-${A}` : ""}` : "<b>Нет протонов — нет элемента</b>";
    st.querySelector("[data-sym]").innerHTML = el0 ? `<b style="font-size:1.4rem">${sup(A)}${el0.sym}${charge}</b>` : "";
    let notes = [];
    if (!el0) notes.push("Добавь хотя бы один протон: именно протоны определяют, какой это элемент.");
    else {
      notes.push(`Z = ${s.p} → это <a href="#element-${s.p}">${el0.name}</a>. Массовое число A = ${s.p} + ${s.n} = <b>${A}</b>.`);
      if (q === 0) notes.push("Электронов столько же, сколько протонов — атом <b>нейтрален</b>.");
      else if (q > 0) notes.push(`Электронов не хватает ${q} — это <b>катион</b> (положительный ион) с зарядом +${q}.`);
      else notes.push(`Лишних электронов ${-q} — это <b>анион</b> (отрицательный ион) с зарядом ${q}.`);
      const stable = STABLE[s.p];
      if (stable) {
        if (stable.includes(A)) notes.push(`<span style="color:var(--good)">Ядро устойчиво</span> — такой изотоп встречается в природе.`);
        else notes.push(`<span style="color:var(--warn)">Ядро неустойчиво (радиоактивно)</span>. Устойчивые изотопы этого элемента: ${stable.map((a) => sup(a) + el0.sym).join(", ")}.`);
      } else {
        const ratio = s.n / s.p;
        const ideal = 1 + 0.0062 * s.p; // грубо: у тяжёлых ядер нейтронов больше
        notes.push(Math.abs(ratio - ideal) < 0.12 ? "Соотношение нейтронов и протонов близко к устойчивому." : `<span style="color:var(--warn)">Скорее всего ядро неустойчиво</span>: для Z = ${s.p} нужно около ${Math.round(s.p * ideal)} нейтронов.`);
      }
      if (Math.abs(q) > 3) notes.push("Ионы с таким большим зарядом в обычной химии почти не встречаются.");
    }
    panel.querySelector("[data-info]").innerHTML = notes.map((n) => `<p class="mt0" style="margin-bottom:6px">${n}</p>`).join("");
  }
  panel.addEventListener("click", (ev) => {
    const b = ev.target.closest("button");
    if (!b) return;
    if (b.dataset.k) {
      const k = b.dataset.k, d = +b.dataset.d;
      const max = k === "p" ? 36 : k === "n" ? 50 : 40;
      s[k] = Math.max(0, Math.min(max, s[k] + d));
      update();
    } else if (b.dataset.p) {
      [s.p, s.n, s.e] = b.dataset.p.split(",").map(Number);
      update();
    }
  });
  panel.querySelector("input[type=range]").oninput = (e) => atom.setCut(+e.target.value);
  update();

  el.appendChild(h(`<section id="size"><h2>Насколько атом мал?</h2>
    <p>Диаметр атома — около 0,1 нанометра (10⁻¹⁰ м). В толщину человеческого волоса уложится около полумиллиона атомов. А ядро ещё в 10–100 тысяч раз меньше самого атома.</p>
    ${kid("Если увеличить яблоко до размеров Земли, то атомы яблока станут размером с само яблоко!")}
    <div class="callout adv"><b>Атомная единица массы:</b> 1 а. е. м. = 1/12 массы атома ¹²C ≈ 1,6605·10⁻²⁷ кг. Атомная масса в таблице — средняя по природной смеси изотопов, поэтому она дробная: у хлора 35,45, потому что в природе ~76% ³⁵Cl и ~24% ³⁷Cl.</div>
  </section>`));
}

function counter(k, label, color) {
  return `<div class="counter"><button type="button" data-k="${k}" data-d="-1" aria-label="Убрать ${label}">−</button>
    <div class="val"><b data-v="${k}">0</b><span><span class="dot" style="background:${color}"></span>${label}</span></div>
    <button type="button" data-k="${k}" data-d="1" aria-label="Добавить ${label}">+</button></div>`;
}

export const quiz = [
  { q: "Что определяет, какой это химический элемент?", options: ["Число нейтронов", "Число протонов", "Число электронов", "Масса атома"], answer: 1, why: "Число протонов — атомный номер. Меняешь протоны — меняется элемент." },
  { q: "Сколько нейтронов в атоме ²³Na (Z = 11)?", options: ["11", "23", "12", "34"], answer: 2, why: "N = A − Z = 23 − 11 = 12." },
  { q: "Атом отдал один электрон. Что получилось?", options: ["Анион с зарядом −1", "Катион с зарядом +1", "Изотоп", "Другой элемент"], answer: 1, why: "Протонов стало больше, чем электронов, — заряд +1, это катион." },
  { q: "¹²C и ¹⁴C — это…", options: ["разные элементы", "изотопы углерода", "ионы углерода", "молекулы"], answer: 1, why: "Протонов одинаково (6), нейтронов разное число (6 и 8) — это изотопы." },
  { q: "Почему атомная масса хлора дробная (35,45)?", options: ["Ошибка измерения", "В ядре есть половинки протонов", "Это среднее по смеси изотопов ³⁵Cl и ³⁷Cl", "Из-за массы электронов"], answer: 2, why: "В природе хлор — смесь двух изотопов, а таблица даёт среднее." },
];
