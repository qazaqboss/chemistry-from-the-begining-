import { h, kid, term, stage, chips, esc } from "../ui.js";
import { createViewer } from "../three/core.js";
import { frame } from "../three/molecule.js";
import { createOxideViewer } from "../three/oxides-crystals.js";

const TYPES = { b: "основный", a: "кислотный", m: "амфотерный", n: "несолеобразующий" };
// Тренажёр: формула, тип, пояснение
const DRILL = [
  ["Na₂O", "b", "Na — щелочной металл, степень окисления +1."], ["CaO", "b", "Металл со степенью окисления +2 (кроме Zn, Be, Pb, Sn)."],
  ["MgO", "b", "Mg⁺² — типичный металл, оксиду соответствует основание Mg(OH)₂."], ["CuO", "b", "Cu⁺²: ему соответствует основание Cu(OH)₂."],
  ["FeO", "b", "Железо в низшей степени окисления +2 даёт основный оксид."], ["BaO", "b", "Ba — щёлочноземельный металл, +2."], ["K₂O", "b", "K — щелочной металл."],
  ["CO₂", "a", "Неметалл; оксиду соответствует угольная кислота H₂CO₃."], ["SO₃", "a", "Неметалл, ему соответствует серная кислота H₂SO₄."],
  ["P₂O₅", "a", "Оксиду фосфора(V) соответствует фосфорная кислота H₃PO₄."], ["SiO₂", "a", "Кислотный, хотя с водой не реагирует: ему соответствует H₂SiO₃."],
  ["SO₂", "a", "Ему соответствует сернистая кислота H₂SO₃."], ["N₂O₅", "a", "Ему соответствует азотная кислота HNO₃."],
  ["CrO₃", "a", "Металл в высокой степени окисления (+6) образует кислотный оксид (кислота H₂CrO₄)."], ["Mn₂O₇", "a", "Mn⁺⁷ — кислотный оксид, ему соответствует HMnO₄."],
  ["ZnO", "m", "Цинк — классический пример амфотерности."], ["Al₂O₃", "m", "Реагирует и с кислотами, и со щелочами."], ["BeO", "m", "Бериллий, как и Zn, Al, даёт амфотерный оксид."],
  ["Fe₂O₃", "m", "Железо(III): амфотерные свойства (сплавление со щелочами даёт ферриты)."], ["Cr₂O₃", "m", "Хром в промежуточной степени окисления +3."],
  ["CO", "n", "Не образует солей: нет ни соответствующей кислоты, ни основания."], ["NO", "n", "Несолеобразующий оксид азота."], ["N₂O", "n", "«Веселящий газ» — несолеобразующий."],
];
// Матрица «оксид × реагент»
const RG = ["H₂O", "HCl", "NaOH", "CO₂", "CaO"];
const NO = (why) => ({ no: why });
const MATRIX = {
  "CaO": [{ eq: "CaO + H₂O → Ca(OH)₂", why: "Гашение извести, выделяется много тепла." }, { eq: "CaO + 2HCl → CaCl₂ + H₂O" }, NO("Основный оксид со щёлочью не реагирует."), { eq: "CaO + CO₂ → CaCO₃" }, NO("Два основных оксида друг с другом не реагируют.")],
  "Na₂O": [{ eq: "Na₂O + H₂O → 2NaOH", why: "Образуется щёлочь." }, { eq: "Na₂O + 2HCl → 2NaCl + H₂O" }, NO("Основный оксид со щёлочью не реагирует."), { eq: "Na₂O + CO₂ → Na₂CO₃" }, NO("Два основных оксида не реагируют.")],
  "CuO": [NO("С водой реагируют только оксиды щелочных и щёлочноземельных металлов (их основания растворимы)."), { eq: "CuO + 2HCl → CuCl₂ + H₂O", why: "Чёрный порошок растворяется, раствор становится сине-зелёным." }, NO("Основный оксид со щёлочью не реагирует."), NO("Слабоосновный CuO с CO₂ в обычных условиях не реагирует."), NO("Два основных оксида не реагируют.")],
  "CO₂": [{ eq: "CO₂ + H₂O ⇄ H₂CO₃", why: "Реакция обратима, угольная кислота слабая и неустойчивая — так получается газировка." }, NO("Кислотный оксид с кислотой не реагирует."), { eq: "CO₂ + 2NaOH → Na₂CO₃ + H₂O", why: "При избытке CO₂ образуется кислая соль NaHCO₃." }, NO("Это одно и то же вещество."), { eq: "CaO + CO₂ → CaCO₃" }],
  "SO₃": [{ eq: "SO₃ + H₂O → H₂SO₄", why: "Так получают серную кислоту в промышленности." }, NO("Кислотный оксид с кислотой не реагирует."), { eq: "SO₃ + 2NaOH → Na₂SO₄ + H₂O" }, NO("Два кислотных оксида не реагируют."), { eq: "CaO + SO₃ → CaSO₄" }],
  "SiO₂": [NO("Единственный кислотный оксид, не реагирующий с водой: H₂SiO₃ получают обходным путём."), NO("С кислотами не реагирует (кроме плавиковой HF — ею травят стекло)."), { eq: "SiO₂ + 2NaOH →(t) Na₂SiO₃ + H₂O", why: "При сплавлении. Поэтому щёлочи хранят не в стеклянной посуде с притёртой пробкой." }, NO("Два кислотных оксида не реагируют."), { eq: "CaO + SiO₂ →(t) CaSiO₃", why: "Сплавление — основа получения стекла и шлаков." }],
  "ZnO": [NO("Амфотерный оксид с водой не реагирует."), { eq: "ZnO + 2HCl → ZnCl₂ + H₂O", why: "Проявляет основные свойства." }, { eq: "ZnO + 2NaOH + H₂O → Na₂[Zn(OH)₄]", why: "Проявляет кислотные свойства. При сплавлении: ZnO + 2NaOH → Na₂ZnO₂ + H₂O." }, NO("С CO₂ в обычных условиях не реагирует."), { eq: "ZnO + CaO →(t) CaZnO₂", why: "При сплавлении с основным оксидом ZnO ведёт себя как кислотный." }],
  "Al₂O₃": [NO("Амфотерный оксид с водой не реагирует."), { eq: "Al₂O₃ + 6HCl → 2AlCl₃ + 3H₂O" }, { eq: "Al₂O₃ + 2NaOH →(t) 2NaAlO₂ + H₂O", why: "Сплавление; в растворе образуется Na[Al(OH)₄]." }, NO("С CO₂ не реагирует."), { eq: "Al₂O₃ + CaO →(t) Ca(AlO₂)₂" }],
  "CO": [NO("Несолеобразующий."), NO("Несолеобразующий."), NO("Несолеобразующий — не реагирует ни с кислотами, ни со щелочами."), NO("—"), NO("Несолеобразующий.")],
};

export async function render(el) {
  el.appendChild(h(`<div>
    <p class="lead">${term("oxide", "Оксиды")} — сложные вещества из двух элементов, один из которых кислород в степени окисления −2. Песок, ржавчина, углекислый газ, вода, негашёная известь, глинозём — всё это оксиды. Почти все элементы образуют оксиды, и по ним удобно понимать характер элемента.</p>
    ${kid("Кислород очень общительный: он соединяется почти со всеми элементами. Получается «элемент + кислород» — оксид. Ржавчина на гвозде — оксид железа, а пузырьки в газировке — оксид углерода!")}
  </div>`));

  el.appendChild(h(`<section id="classes"><h2>Классификация оксидов</h2>
    <div class="table-wrap"><table class="data">
      <tr><th>Тип</th><th>Кто образует</th><th>Примеры</th><th>Гидроксид</th></tr>
      <tr><td><b>${term("basic_oxide", "Основные")}</b></td><td>металлы со степенью окисления +1, +2</td><td>Na₂O, CaO, MgO, CuO, FeO</td><td>основание: NaOH, Cu(OH)₂</td></tr>
      <tr><td><b>${term("acidic_oxide", "Кислотные")}</b></td><td>неметаллы; металлы в степени окисления +5…+7</td><td>CO₂, SO₃, P₂O₅, SiO₂, CrO₃, Mn₂O₇</td><td>кислота: H₂CO₃, H₂SO₄</td></tr>
      <tr><td><b>${term("amphoteric", "Амфотерные")}</b></td><td>Zn, Be, Al; металлы в степени +3, +4</td><td>ZnO, Al₂O₃, BeO, Fe₂O₃, Cr₂O₃</td><td>амфотерный гидроксид: Zn(OH)₂, Al(OH)₃</td></tr>
      <tr><td><b>Несолеобразующие</b></td><td>некоторые неметаллы в низших степенях</td><td>CO, NO, N₂O, SiO</td><td>нет</td></tr>
    </table></div>
    <div class="callout"><b>Правило-подсказка:</b> чем выше степень окисления элемента в оксиде, тем сильнее кислотные свойства. У хрома: CrO (+2) — основный, Cr₂O₃ (+3) — амфотерный, CrO₃ (+6) — кислотный.</div>
    <p>Название: «оксид» + элемент в родительном падеже + степень окисления, если она переменная: Fe₂O₃ — оксид железа(III), SO₂ — оксид серы(IV). Тривиальные названия: CaO — негашёная известь, CO₂ — углекислый газ, SiO₂ — кремнезём (кварц, песок), Al₂O₃ — глинозём (корунд).</p>
  </section>`));

  // ---------- 3D ----------
  const sec = h(`<section id="structure"><h2>Строение оксидов в 3D</h2>
    <p>Почему CO₂ — газ, а SiO₂ — твёрдый песок, хотя формулы похожи? Всё решает тип кристаллической решётки. Переключай модели и сравни.</p>
  </section>`);
  el.appendChild(sec);
  const chipBox = h(`<div style="margin-bottom:10px"></div>`);
  sec.appendChild(chipBox);
  const st = stage(`<div class="overlay"><span data-t style="font-size:1rem"></span><span data-k></span></div>`);
  sec.appendChild(st);
  const note = h(`<div class="card pad" style="margin-top:10px"><p data-n class="mt0"></p><p class="small muted mt0">Цвета: <span style="color:#ff3b3b">●</span> O &nbsp;<span style="color:#9aa2b4">●</span> C &nbsp;<span style="color:#f0c8a0">●</span> Si &nbsp;<span style="color:#3dff6e">●</span> Ca &nbsp;<span style="color:#bfa6a6">●</span> Al</p></div>`);
  sec.appendChild(note);
  const v = createViewer(st, { camera: [6, 4, 10], minDistance: 3, maxDistance: 40, autoRotateSpeed: 0.6 });
  const ox = createOxideViewer(v);
  const MP = { CO2: "возгонка −78,5 °C", SiO2: "t пл ≈ 1713 °C", CaO: "t пл ≈ 2613 °C", Al2O3: "t пл ≈ 2072 °C" };
  const showOx = (it) => {
    const m = ox.show(it.id);
    frame(v, ox.radius());
    st.querySelector("[data-t]").innerHTML = `<b>${m.title}</b>`;
    st.querySelector("[data-k]").textContent = `${m.kind} · ${MP[it.id]}`;
    note.querySelector("[data-n]").textContent = m.note;
  };
  const items = [{ id: "CO2", label: "CO₂ — сухой лёд" }, { id: "SiO2", label: "SiO₂ — кремнезём" }, { id: "CaO", label: "CaO — известь" }, { id: "Al2O3", label: "Al₂O₃ — корунд" }];
  chips(chipBox, items, showOx);
  showOx(items[0]);

  // ---------- Тренажёр ----------
  const tr = h(`<section id="drill"><h2>Тренажёр: какой это оксид?</h2>
    <p>Определи тип оксида. Подсказка: смотри на элемент и его степень окисления.</p>
    <div class="card pad" style="text-align:center">
      <div data-f class="formula" style="font-size:2.4rem;font-weight:800;margin:6px 0 14px"></div>
      <div class="row" style="justify-content:center" data-btns>${Object.entries(TYPES).map(([k, t]) => `<button class="btn" type="button" data-a="${k}">${t}</button>`).join("")}</div>
      <p data-fb style="min-height:3em;margin:14px 0 4px"></p>
      <p class="small muted mt0" data-sc></p>
    </div>
  </section>`);
  el.appendChild(tr);
  let cur, right = 0, total = 0, streak = 0, last = -1;
  const next = () => {
    let i; do i = Math.floor(Math.random() * DRILL.length); while (i === last);
    last = i; cur = DRILL[i];
    tr.querySelector("[data-f]").textContent = cur[0];
    tr.querySelectorAll("[data-a]").forEach((b) => { b.disabled = false; b.classList.remove("primary"); });
  };
  tr.querySelectorAll("[data-a]").forEach((b) => (b.onclick = () => {
    const ok = b.dataset.a === cur[1];
    total++; if (ok) { right++; streak++; } else streak = 0;
    tr.querySelectorAll("[data-a]").forEach((x) => { x.disabled = true; if (x.dataset.a === cur[1]) x.classList.add("primary"); });
    tr.querySelector("[data-fb]").innerHTML = `${ok ? "<b style='color:var(--good)'>Верно!</b>" : `<b style='color:var(--bad)'>Нет</b> — это ${TYPES[cur[1]]} оксид.`} ${esc(cur[2])}`;
    tr.querySelector("[data-sc]").textContent = `Счёт: ${right} из ${total}${streak > 2 ? ` · серия ${streak} 🔥` : ""}`;
    setTimeout(next, ok ? 1400 : 2600);
  }));
  next();

  // ---------- Свойства ----------
  const pr = h(`<section id="props"><h2>Химические свойства: кто с кем реагирует</h2>
    <p>Главная идея: <b>противоположности притягиваются</b>. Основные оксиды реагируют с кислотами и кислотными оксидами, кислотные — с основаниями и основными оксидами. Амфотерные — и с теми, и с другими. Выбери оксид и реагент:</p>
    <div data-o style="margin-bottom:8px"></div>
    <div data-r style="margin-bottom:12px"></div>
    <div class="card pad" data-res></div>
  </section>`);
  el.appendChild(pr);
  let oxSel = "CaO", rgSel = 0;
  const showRes = () => {
    const r = MATRIX[oxSel][rgSel];
    pr.querySelector("[data-res]").innerHTML = r.no
      ? `<p class="mt0"><b style="color:var(--bad)">Не реагирует.</b> ${esc(r.no)}</p><p class="small muted mt0">${esc(oxSel)} + ${RG[rgSel]} → ✗</p>`
      : `<div class="eq mt0" style="margin-top:0">${r.eq}</div>${r.why ? `<p class="small mt0">${r.why}</p>` : ""}`;
  };
  chips(pr.querySelector("[data-o]"), Object.keys(MATRIX).map((k) => ({ k, label: k })), (it) => { oxSel = it.k; showRes(); });
  chips(pr.querySelector("[data-r]"), RG.map((k, i) => ({ i, label: "+ " + k })), (it) => { rgSel = it.i; showRes(); });
  showRes();
  pr.appendChild(h(`<div class="grid-2" style="margin-top:14px">
    <div class="card pad"><h3 class="mt0">Основные оксиды</h3><ul class="small"><li>+ вода → щёлочь (только Li…Cs, Ca, Sr, Ba)</li><li>+ кислота → соль + вода</li><li>+ кислотный оксид → соль</li></ul></div>
    <div class="card pad"><h3 class="mt0">Кислотные оксиды</h3><ul class="small"><li>+ вода → кислота (кроме SiO₂)</li><li>+ щёлочь → соль + вода</li><li>+ основный оксид → соль</li></ul></div>
  </div>`));

  el.appendChild(h(`<section id="obtain"><h2>Как получают оксиды</h2>
    <ol>
      <li><b>Горение простых веществ:</b> <span class="formula">S + O₂ → SO₂</span>, <span class="formula">4P + 5O₂ → 2P₂O₅</span>, <span class="formula">2Mg + O₂ → 2MgO</span> (ослепительная вспышка).</li>
      <li><b>Горение сложных веществ:</b> <span class="formula">CH₄ + 2O₂ → CO₂ + 2H₂O</span>, обжиг руды <span class="formula">2ZnS + 3O₂ → 2ZnO + 2SO₂</span>.</li>
      <li><b>Разложение нерастворимых оснований:</b> <span class="formula">Cu(OH)₂ →(t) CuO + H₂O</span> — голубой осадок чернеет.</li>
      <li><b>Разложение солей:</b> <span class="formula">CaCO₃ →(t) CaO + CO₂↑</span> — так получают известь в обжиговых печах.</li>
    </ol>
    ${kid("Опыт с родителями: подыши через трубочку в прозрачную известковую воду (её продают в аптеке или делают из гашёной извести). Вода помутнеет — это углекислый газ из твоих лёгких превратился в мел CaCO₃!", "Опыт")}
    <p class="small muted">Что дальше: из оксидов получают основания и кислоты — урок <a href="#lesson-acidsbases">«Кислоты и основания»</a>, а вся цепочка превращений собрана в уроке <a href="#lesson-genetic">«Генетическая связь веществ»</a>.</p>
  </section>`));
}

export const quiz = [
  { q: "Какой оксид основный?", options: ["SO₃", "CaO", "ZnO", "CO"], answer: 1, why: "Кальций — металл со степенью окисления +2, его гидроксид Ca(OH)₂ — основание." },
  { q: "Какой оксид НЕ реагирует с водой?", options: ["SO₃", "Na₂O", "SiO₂", "CO₂"], answer: 2, why: "SiO₂ — кислотный оксид, но с водой не реагирует." },
  { q: "Амфотерный оксид — это…", options: ["Al₂O₃", "MgO", "P₂O₅", "N₂O"], answer: 0, why: "Al₂O₃ реагирует и с кислотами, и со щелочами." },
  { q: "Продукт реакции CaO + CO₂ — это…", options: ["Ca(OH)₂", "CaCO₃", "CaC₂", "реакция не идёт"], answer: 1, why: "Основный оксид + кислотный оксид → соль (карбонат кальция)." },
  { q: "Почему CO₂ — газ, а SiO₂ — твёрдое вещество?", options: ["у SiO₂ больше молярная масса", "у CO₂ молекулярная решётка, у SiO₂ — атомная", "кремний — металл", "CO₂ — ионное вещество"], answer: 1, why: "В SiO₂ все атомы связаны прочными ковалентными связями в единую сетку." },
  { q: "С каким веществом реагирует оксид серы(VI)?", options: ["HCl", "CO₂", "NaOH", "O₂"], answer: 2, why: "Кислотный оксид реагирует со щёлочью: SO₃ + 2NaOH → Na₂SO₄ + H₂O." },
];
