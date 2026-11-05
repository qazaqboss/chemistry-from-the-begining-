import { h, kid, term, stage, chips } from "../ui.js";
import { createViewer } from "../three/core.js";
import { createReaction, REACTIONS } from "../three/reaction.js";
import { parseFormula, pretty } from "../chem.js";

// Тренажёр уравнивания: [реагенты], [продукты], правильные коэффициенты
const PUZZLES = [
  { l: ["H2", "O2"], r: ["H2O"], ans: [2, 1, 2] },
  { l: ["Fe", "O2"], r: ["Fe2O3"], ans: [4, 3, 2] },
  { l: ["CH4", "O2"], r: ["CO2", "H2O"], ans: [1, 2, 1, 2] },
  { l: ["Na", "H2O"], r: ["NaOH", "H2"], ans: [2, 2, 2, 1] },
  { l: ["Al", "HCl"], r: ["AlCl3", "H2"], ans: [2, 6, 2, 3] },
  { l: ["N2", "H2"], r: ["NH3"], ans: [1, 3, 2] },
  { l: ["C3H8", "O2"], r: ["CO2", "H2O"], ans: [1, 5, 3, 4] },
  { l: ["KClO3"], r: ["KCl", "O2"], ans: [2, 2, 3] },
];

export async function render(el) {
  el.appendChild(h(`<div>
    <p class="lead">Химическая реакция — это превращение одних веществ в другие. При этом атомы не появляются и не исчезают: старые связи рвутся, атомы перегруппировываются, возникают новые связи.</p>
  </div>`));

  el.appendChild(h(`<section id="signs"><h2>Признаки и условия реакций</h2>
    <div class="grid-2">
      <div class="card pad"><b>Признаки</b><ul class="small"><li>изменение цвета</li><li>выделение газа (пузырьки)</li><li>выпадение осадка</li><li>появление запаха</li><li>выделение или поглощение тепла, света</li></ul></div>
      <div class="card pad"><b>Что ускоряет реакцию</b><ul class="small"><li>нагревание</li><li>измельчение (больше поверхность)</li><li>перемешивание, выше концентрация</li><li>${term("catalyst", "катализатор")}</li></ul></div>
    </div>
    ${kid("Попробуй дома со взрослым: капни уксус на пищевую соду. Зашипело? Это выделяется углекислый газ — верный признак реакции!")}
  </section>`));

  const sec = h(`<section id="anim"><h2>Реакция в 3D</h2><p>Тяни ползунок или нажми «Пуск»: увидишь, как молекулы сближаются, старые связи рвутся (вспышка — энергия) и собираются новые молекулы. Посчитай атомы до и после — их столько же!</p></section>`);
  el.appendChild(sec);
  const chipBox = h(`<div style="margin-bottom:10px"></div>`);
  sec.appendChild(chipBox);
  const st = stage(`<div class="overlay"><span data-eq class="formula" style="font-size:1.1rem"></span><span data-stage></span></div>`, { wide: true });
  sec.appendChild(st);
  const ctl = h(`<div class="card pad" style="margin-top:10px">
    <div class="row"><button class="btn primary" type="button" data-play>▶ Пуск</button><input type="range" min="0" max="1" step="0.001" value="0" style="flex:1"></div>
    <p data-note style="margin:10px 0 0"></p>
  </div>`);
  sec.appendChild(ctl);
  const v = createViewer(st, { camera: [0, 2, 12], fitWidth: 5.2, autoRotate: false, minDistance: 5, maxDistance: 30 });
  const rx = createReaction(v);
  const range = ctl.querySelector("input");
  let playing = false;
  const stageName = (t) => (t < 0.05 ? "реагенты" : t < 0.35 ? "сближение" : t < 0.6 ? "разрыв связей" : t < 0.95 ? "образование новых связей" : "продукты");
  const setT = (t) => { rx.setT(t); range.value = t; st.querySelector("[data-stage]").textContent = stageName(t); };
  const load = (r) => { rx.load(r.id); st.querySelector("[data-eq]").textContent = r.eq; ctl.querySelector("[data-note]").innerHTML = `<b>${r.name}.</b> ${r.note}`; setT(0); };
  chips(chipBox, REACTIONS.map((r) => ({ ...r, label: r.name })), load);
  load(REACTIONS[0]);
  range.oninput = () => { playing = false; setT(+range.value); };
  ctl.querySelector("[data-play]").onclick = () => { if (rx.t >= 0.999) setT(0); playing = true; };
  v.onFrame((dt) => { if (playing) { const t = Math.min(1, rx.t + dt / 4); setT(t); if (t >= 1) playing = false; } });

  el.appendChild(h(`<section id="types"><h2>Типы реакций</h2>
    <div class="table-wrap"><table class="data">
      <tr><th>Тип</th><th>Схема</th><th>Пример</th></tr>
      <tr><td>Соединение</td><td class="formula">A + B → AB</td><td class="formula">2H₂ + O₂ → 2H₂O</td></tr>
      <tr><td>Разложение</td><td class="formula">AB → A + B</td><td class="formula">CaCO₃ → CaO + CO₂↑</td></tr>
      <tr><td>Замещение</td><td class="formula">A + BC → AC + B</td><td class="formula">Fe + CuSO₄ → FeSO₄ + Cu</td></tr>
      <tr><td>Обмен</td><td class="formula">AB + CD → AD + CB</td><td class="formula">NaOH + HCl → NaCl + H₂O</td></tr>
    </table></div>
    <p class="adv">Реакции также делят на <b>экзотермические</b> (тепло выделяется: горение) и <b>эндотермические</b> (тепло поглощается: разложение известняка), обратимые и необратимые, каталитические и некаталитические.</p>
  </section>`));

  // ---------- уравнивание ----------
  const bal = h(`<section id="balance"><h2>Закон сохранения массы и уравнивание</h2>
    <p>М. В. Ломоносов (1748) и А. Лавуазье (1789) установили: <b>масса веществ до реакции равна массе веществ после неё</b>. Значит, атомов каждого вида слева и справа от стрелки должно быть поровну. Числа перед формулами — <b>коэффициенты</b> — уравнивают атомы. Менять индексы в формулах нельзя: H₂O и H₂O₂ — разные вещества!</p>
    <div class="card pad">
      <div class="row" style="justify-content:space-between"><b data-num></b><div class="row"><button class="btn small" type="button" data-prev>←</button><button class="btn small" type="button" data-next>Следующее →</button></div></div>
      <div class="balance" data-eq style="margin-top:12px"></div>
      <div class="atom-count" data-count></div>
      <p data-msg style="text-align:center;margin:12px 0 0;font-weight:700"></p>
    </div>
  </section>`);
  el.appendChild(bal);
  let pi = 0, coefs = [];
  const drawPuzzle = () => {
    const P = PUZZLES[pi];
    const all = [...P.l, ...P.r];
    if (coefs.length !== all.length) coefs = all.map(() => 1);
    bal.querySelector("[data-num]").textContent = `Уравнение ${pi + 1} из ${PUZZLES.length}`;
    const term_ = (f, i) => `<span class="coef"><button type="button" data-i="${i}" data-d="-1" aria-label="меньше">−</button><b>${coefs[i]}</b><button type="button" data-i="${i}" data-d="1" aria-label="больше">+</button></span><span>${pretty(f)}</span>`;
    bal.querySelector("[data-eq]").innerHTML =
      P.l.map((f, i) => term_(f, i)).join("<span>+</span>") + "<span>→</span>" + P.r.map((f, i) => term_(f, i + P.l.length)).join("<span>+</span>");
    // подсчёт атомов
    const count = (side, off) => {
      const c = {};
      side.forEach((f, i) => { for (const [k, n] of Object.entries(parseFormula(f))) c[k] = (c[k] || 0) + n * coefs[i + off]; });
      return c;
    };
    const L = count(P.l, 0), R = count(P.r, P.l.length);
    const keys = [...new Set([...Object.keys(L), ...Object.keys(R)])];
    const ok = keys.every((k) => L[k] === R[k]);
    bal.querySelector("[data-count]").innerHTML = keys.map((k) => `<span class="${L[k] === R[k] ? "ok" : "no"}">${k}: ${L[k] || 0} | ${R[k] || 0}</span>`).join("");
    const g = coefs.reduce((a, b) => { while (b) [a, b] = [b, a % b]; return a; });
    bal.querySelector("[data-msg]").innerHTML = ok
      ? g > 1 ? `<span style="color:var(--warn)">Атомы сходятся, но коэффициенты можно сократить в ${g} раза.</span>` : `<span style="color:var(--good)">Уравнено! 🎉 Атомов слева и справа поровну.</span>`
      : `<span class="muted">Слева | справа — подбирай коэффициенты, пока все счётчики не станут зелёными.</span>`;
  };
  bal.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.i != null) { const i = +b.dataset.i; coefs[i] = Math.max(1, Math.min(12, coefs[i] + +b.dataset.d)); }
    if ("next" in b.dataset) { pi = (pi + 1) % PUZZLES.length; coefs = []; }
    if ("prev" in b.dataset) { pi = (pi - 1 + PUZZLES.length) % PUZZLES.length; coefs = []; }
    drawPuzzle();
  });
  drawPuzzle();
}

export const quiz = [
  { q: "Что происходит с атомами в химической реакции?", options: ["Исчезают", "Превращаются в другие элементы", "Перегруппировываются", "Делятся пополам"], answer: 2, why: "Рвутся старые связи и образуются новые; сами атомы сохраняются." },
  { q: "Fe + CuSO₄ → FeSO₄ + Cu — это реакция…", options: ["соединения", "разложения", "замещения", "обмена"], answer: 2, why: "Железо замещает медь в соли." },
  { q: "Какие коэффициенты в уравнении _H₂ + _O₂ → _H₂O?", options: ["1, 1, 1", "2, 1, 2", "1, 2, 1", "2, 2, 2"], answer: 1, why: "4 H и 2 O с обеих сторон." },
  { q: "Можно ли при уравнивании менять индексы (H₂O → H₂O₂)?", options: ["Да", "Нет — это изменит вещество", "Только у кислорода", "Только в продуктах"], answer: 1, why: "Индексы задают состав вещества; меняют только коэффициенты." },
  { q: "Кто открыл закон сохранения массы?", options: ["Менделеев", "Ломоносов и Лавуазье", "Бор", "Ньютон"], answer: 1, why: "Ломоносов (1748) и независимо Лавуазье (1789)." },
];
