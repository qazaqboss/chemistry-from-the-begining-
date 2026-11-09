import { h, kid, term, stage, chips } from "../ui.js";
import { createViewer } from "../three/core.js";
import { createMolecule, frame } from "../three/molecule.js";
import {
  ethanol, glycerol, phenol, ethanal, acetone, aceticAcid, ethylAcetate, centerOf, haloGroup,
  condensation, createMorph, dirXY, mul, add, plotStyles,
} from "../three/y1011-kit.js";

const MOLS = [
  { label: "Этанол", f: "C₂H₅OH", data: centerOf(ethanol()), g: ["Oal", "Hy"], cls: "предельный одноатомный спирт", grp: "гидроксильная –OH", note: "Связь O–H полярна, а атом H несёт частичный «+»: между молекулами возникают водородные связи. Поэтому этанол (M = 46) кипит при 78 °C, а пропан (M = 44) — при −42 °C. С водой смешивается в любых отношениях." },
  { label: "Глицерин", f: "C₃H₅(OH)₃", data: centerOf(glycerol()), g: ["Og0", "Og1", "Og2", "Hg0", "Hg1", "Hg2"], cls: "многоатомный спирт", grp: "три группы –OH", note: "Три OH-группы у соседних атомов C — вязкая сладкая жидкость. Соседние OH-группы дают с Cu(OH)₂ ярко-синий раствор (глицерат меди) — качественная реакция." },
  { label: "Фенол", f: "C₆H₅OH", data: centerOf(phenol()), g: ["Oph", "Hph"], cls: "фенол", grp: "–OH при бензольном кольце", note: "Неподелённая пара кислорода втягивается в π-систему кольца, связь O–H ослабевает: фенол — слабая кислота (карболовая), реагирует со щёлочью. Кольцо, наоборот, активируется: бромная вода даёт белый осадок 2,4,6-трибромфенола." },
  { label: "Этаналь", f: "CH₃CHO", data: centerOf(ethanal()), g: ["Cco", "Oco", "Hald"], cls: "альдегид", grp: "альдегидная –CHO", note: "Карбонильная группа C=O на конце цепи. Атом C карбонила несёт частичный «+» и атакуется нуклеофилами; соседний H легко окисляется — отсюда «серебряное зеркало»." },
  { label: "Ацетон", f: "CH₃COCH₃", data: centerOf(acetone()), g: ["Cco", "Oco"], cls: "кетон", grp: "карбонильная >C=O внутри цепи", note: "Карбонил в середине цепи, у атома C нет водорода — поэтому кетоны трудно окисляются и не дают «серебряного зеркала». Ацетон — растворитель (жидкость для снятия лака)." },
  { label: "Уксусная кислота", f: "CH₃COOH", data: centerOf(aceticAcid()), g: ["Cco", "Oco", "Oac", "Hx"], cls: "карбоновая кислота", grp: "карбоксильная –COOH", note: "C=O оттягивает электроны от соседнего O–H, и протон отщепляется в воде: CH₃COOH ⇄ CH₃COO⁻ + H⁺ (Kₐ = 1,8·10⁻⁵, слабая кислота). Анион устойчив: заряд делокализован по двум атомам O." },
  { label: "Этилацетат", f: "CH₃COOC₂H₅", data: centerOf(ethylAcetate()), g: ["Cco", "Oco", "Oal"], cls: "сложный эфир", grp: "сложноэфирная –COO–", note: "Нет связи O–H — нет водородных связей между молекулами: этилацетат кипит при 77 °C, хотя M = 88. Запах груши; растворитель клеёв и лаков." },
];

// Тренажёр: формула → класс
const CLASSES = ["спирт", "фенол", "альдегид", "кетон", "карбоновая кислота", "сложный эфир", "простой эфир", "амин"];
const DRILL = [
  ["CH₃–CH₂–CH₂–OH", 0, "Группа –OH при насыщенном атоме C — пропанол-1."],
  ["C₆H₅–OH", 1, "OH прямо при бензольном кольце — фенол."],
  ["C₆H₅–CH₂–OH", 0, "Ловушка! OH отделена от кольца группой CH₂ — это бензиловый спирт, а не фенол."],
  ["CH₃–CH₂–CHO", 2, "–CHO на конце цепи — пропаналь."],
  ["CH₃–CO–CH₂–CH₃", 3, "C=O в середине цепи — бутанон (метилэтилкетон)."],
  ["CH₃–CH₂–COOH", 4, "–COOH — пропановая (пропионовая) кислота."],
  ["H–COO–CH₃", 5, "Метилформиат: остаток муравьиной кислоты + остаток метанола через –COO–."],
  ["CH₃–O–CH₃", 6, "Кислород между двумя углеводородными радикалами без C=O — диметиловый эфир, изомер этанола."],
  ["CH₃–CH₂–NH₂", 7, "–NH₂ — этиламин; амины — органические основания."],
  ["HO–CH₂–CH₂–OH", 0, "Две группы –OH — этиленгликоль, двухатомный спирт (антифриз, ядовит)."],
  ["H–CHO", 2, "Метаналь (формальдегид): у карбонила сразу два атома H."],
  ["CH₃–COO–C₂H₅", 5, "Этилацетат — уксусноэтиловый эфир."],
  ["HCOOH", 4, "Муравьиная кислота. Её особенность: в молекуле есть и альдегидный фрагмент H–C=O, поэтому она даёт «серебряное зеркало»."],
];

export async function render(el) {
  el.appendChild(h(`<div>${plotStyles()}
    <p class="lead">${term("functional_group", "Функциональная группа")} — атом или группа атомов, которая определяет химические свойства целого класса веществ. Углеводородный «хвост» почти инертен, а реагирует именно группа: –OH, –CHO, –COOH, –COO–. Зная группу, можно предсказать свойства тысяч соединений.</p>
    ${kid("Представь брелоки на одинаковых ключах. Ключи (углеводородные цепочки) похожи, а брелок — функциональная группа — сразу говорит, какую «дверь» открывает молекула: кислую, сладкую или душистую.")}
    <p class="small muted">Таблица классов впервые появилась в уроке <a href="#lesson-organic">«Органическая химия»</a>; углеводороды с кратными связями — в уроке <a href="#lesson-unsaturated">«Непредельные и ароматические»</a>.</p>
  </div>`));

  // ---------- 3D ----------
  const s1 = h(`<section id="groups3d"><h2>Функциональные группы в 3D</h2>
    <p>Выбери молекулу: функциональная группа подсвечена золотым ореолом. Обрати внимание на форму: у атома C карбонила (C=O) три соседа в одной плоскости под 120° (sp²), у спиртового C — тетраэдр (sp³).</p></section>`);
  el.appendChild(s1);
  const cb = h(`<div style="margin-bottom:10px"></div>`);
  s1.appendChild(cb);
  const st = stage(`<div class="overlay"><span data-t style="font-size:1rem"></span><span data-c></span></div>`, { wide: true });
  s1.appendChild(st);
  const ctl = h(`<div class="card pad" style="margin-top:10px">
    <div class="row"><div class="seg"><button type="button" class="on" data-s="ballstick">Шаростержневая</button><button type="button" data-s="spacefill">Заполненная</button></div>
    <label class="row small"><input type="checkbox" data-halo checked> Подсветить группу</label><label class="row small"><input type="checkbox" data-lbl> Подписи атомов</label></div>
    <p data-n style="margin:12px 0 0"></p></div>`);
  s1.appendChild(ctl);
  const v = createViewer(st, { camera: [0, 1.5, 9], fitWidth: 3.5, minDistance: 3, maxDistance: 30, autoRotateSpeed: 0.6 });
  const mol = createMolecule(v, MOLS[0].data);
  let halo = null, cur = MOLS[0];
  const show = (m) => {
    cur = m;
    mol.set(m.data);
    frame(v, mol.radius() - 0.2);
    if (halo) { v.clear(halo); v.scene.remove(halo); }
    halo = haloGroup(v, m.data, m.g);
    halo.visible = ctl.querySelector("[data-halo]").checked;
    st.querySelector("[data-t]").innerHTML = `<b>${m.label}</b> <span class="formula">${m.f}</span>`;
    st.querySelector("[data-c]").textContent = `${m.cls} · ${m.grp}`;
    ctl.querySelector("[data-n]").innerHTML = m.note;
  };
  chips(cb, MOLS, show);
  ctl.querySelectorAll("[data-s]").forEach((b) => (b.onclick = () => { ctl.querySelectorAll("[data-s]").forEach((x) => x.classList.toggle("on", x === b)); mol.setStyle(b.dataset.s); }));
  ctl.querySelector("[data-halo]").onchange = (e) => { if (halo) halo.visible = e.target.checked; };
  ctl.querySelector("[data-lbl]").onchange = (e) => mol.setLabels(e.target.checked);
  show(cur);

  el.appendChild(h(`<section id="alcohols"><h2>Спирты и фенол</h2>
    <p>Предельные одноатомные спирты: <span class="formula">CₙH₂ₙ₊₁OH</span>. Названия — по суффиксу <b>-ол</b>: метанол, этанол, пропанол-2. Метанол — сильный яд (10 мл вызывают слепоту), отличить его от этанола по запаху нельзя.</p>
    <div class="table-wrap"><table class="data">
      <tr><th>Реакция</th><th>Уравнение</th><th>Что важно</th></tr>
      <tr><td>с щелочными металлами</td><td class="formula">2C₂H₅OH + 2Na → 2C₂H₅ONa + H₂↑</td><td>спирты — очень слабые кислоты, со щёлочью не реагируют</td></tr>
      <tr><td>с галогеноводородами</td><td class="formula">C₂H₅OH + HBr → C₂H₅Br + H₂O</td><td>замещение группы OH</td></tr>
      <tr><td>внутримолекулярная дегидратация</td><td class="formula">C₂H₅OH —(H₂SO₄, t &gt; 140 °C)→ C₂H₄ + H₂O</td><td>по правилу Зайцева H уходит от менее гидрированного соседа</td></tr>
      <tr><td>межмолекулярная дегидратация</td><td class="formula">2C₂H₅OH —(H₂SO₄, t &lt; 140 °C)→ C₂H₅OC₂H₅ + H₂O</td><td>получается простой эфир</td></tr>
      <tr><td>окисление CuO</td><td class="formula">C₂H₅OH + CuO —t→ CH₃CHO + Cu + H₂O</td><td>первичный спирт → альдегид, вторичный → кетон</td></tr>
    </table></div>
    <p><b>Фенол</b> C₆H₅OH — кислота сильнее спиртов (но слабее угольной): C₆H₅OH + NaOH → C₆H₅ONa + H₂O, а CO₂ вытесняет фенол из фенолята. С FeCl₃ даёт фиолетовое окрашивание, с бромной водой — белый осадок C₆H₂Br₃OH.</p>
  </section>`));

  el.appendChild(h(`<section id="carbonyl"><h2>Альдегиды и кетоны</h2>
    <p>Общая формула предельных альдегидов и кетонов <span class="formula">CₙH₂ₙO</span> — они межклассовые изомеры (пропаналь и ацетон, C₃H₆O). Суффиксы: <b>-аль</b> (этаналь) и <b>-он</b> (пропанон).</p>
    <ul>
      <li><b>Восстановление</b> (H₂, Ni): CH₃CHO + H₂ → C₂H₅OH; кетоны дают вторичные спирты.</li>
      <li><b>Реакция «серебряного зеркала»:</b> CH₃CHO + 2[Ag(NH₃)₂]OH —t→ CH₃COONH₄ + 2Ag↓ + 3NH₃ + H₂O.</li>
      <li><b>С гидроксидом меди(II) при нагревании:</b> CH₃CHO + 2Cu(OH)₂ —t→ CH₃COOH + Cu₂O↓ + 2H₂O — голубой осадок становится кирпично-красным.</li>
      <li>Метаналь окисляется до конца: HCHO + 4[Ag(NH₃)₂]OH → (NH₄)₂CO₃ + 4Ag↓ + 6NH₃ + 2H₂O — на 1 моль вдвое больше серебра. Это частая «ловушка» в расчётных задачах ЕГЭ.</li>
    </ul>
  </section>`));

  el.appendChild(h(`<section id="acids"><h2>Карбоновые кислоты</h2>
    <p>Предельные одноосновные: <span class="formula">CₙH₂ₙ₊₁COOH</span>. Муравьиная HCOOH, уксусная CH₃COOH, пропионовая, масляная C₃H₇COOH (запах прогорклого масла); высшие — пальмитиновая C₁₅H₃₁COOH и стеариновая C₁₇H₃₅COOH (твёрдые), олеиновая C₁₇H₃₃COOH (одна C=C, жидкая).</p>
    <p>Они проявляют все свойства кислот: реагируют с активными металлами, основными оксидами, основаниями и солями более слабых кислот:</p>
    <div class="eq">2CH₃COOH + Na₂CO₃ → 2CH₃COONa + H₂O + CO₂↑</div>
    <p><b>Сила кислот</b> падает с удлинением радикала (HCOOH, Kₐ = 1,8·10⁻⁴, в 10 раз сильнее уксусной) и растёт при введении акцепторов: CCl₃COOH почти так же сильна, как соляная кислота.</p>
  </section>`));

  // ---------- этерификация ----------
  const s5 = h(`<section id="ester"><h2>Этерификация, жиры и мыло</h2>
    <p>${term("esterification", "Этерификация")} — обратимая реакция кислоты со спиртом; катализатор — концентрированная H₂SO₄, которая ещё и связывает воду, смещая равновесие вправо. Опыт с «мечеными» атомами ¹⁸O показал: кислота отдаёт группу <b>OH</b>, а спирт — только атом <b>H</b>. Двигай ползунок и следи, какие атомы образуют воду.</p></section>`);
  el.appendChild(s5);
  const st5 = stage(`<div class="overlay"><span data-e class="formula" style="font-size:.95rem">CH₃COOH + C₂H₅OH ⇄ CH₃COOC₂H₅ + H₂O</span><span data-p></span></div>`, { wide: true });
  s5.appendChild(st5);
  const c5 = h(`<div class="card pad" style="margin-top:10px"><div class="row"><button class="btn primary" type="button" data-go>▶ Пуск</button><input type="range" min="0" max="1" step="0.001" value="0" style="flex:1"></div><p data-n class="small" style="margin:10px 0 0"></p></div>`);
  s5.appendChild(c5);
  const v5 = createViewer(st5, { camera: [0, 0, 13], target: [1.5, -0.6, 0], fitWidth: 5.2, autoRotate: false, minDistance: 5, maxDistance: 30 });
  const prod = ethylAcetate();
  const O = prod.atoms.find((a) => a.tag === "Oal").pos;
  const R = condensation(prod, {
    acylC: "Cco", link: "Oal", right: ["Oal", "Ca", "Cb", "Ha0", "Ha1", "Hb0", "Hb1", "Hb2"],
    offset: mul(dirXY(33), 3.0), waterAt: add(O, [0.6, -2.9, 0]), hxAngle: -106,
  });
  const mo = createMorph(v5, R);
  const rng = c5.querySelector("input");
  let play = false;
  const phase = (t) => (t < 0.15 ? "кислота и спирт" : t < 0.45 ? "атом O спирта атакует C=O" : t < 0.6 ? "уходит молекула воды" : t < 0.95 ? "образуется связь C–O–C" : "этилацетат + вода");
  const set = (t) => {
    mo.setT(t); rng.value = t;
    st5.querySelector("[data-p]").textContent = phase(t);
    c5.querySelector("[data-n]").innerHTML = t < 0.5
      ? "Слева — уксусная кислота (группа C–OH), справа — этанол. Кислород спирта несёт неподелённые пары и атакует атом C карбоксила, на котором частичный «+»."
      : "Вода собрана из <b>OH кислоты</b> и <b>H спирта</b>. Кислород спирта остался в эфире — именно его нашли в продукте в опыте с ¹⁸O.";
  };
  rng.oninput = () => { play = false; set(+rng.value); };
  c5.querySelector("[data-go]").onclick = () => { if (mo.t >= 0.999) set(0); play = true; };
  let last = performance.now();
  v5.onFrame(() => { const n = performance.now(), dt = Math.min(0.05, (n - last) / 1000); last = n; if (play) { const t = Math.min(1, mo.t + dt / 5); set(t); if (t >= 1) play = false; } });
  set(0);
  s5.appendChild(h(`<div>
    <p><b>Гидролиз</b> сложного эфира — обратная реакция. В кислой среде он обратим, а в щелочной необратим, потому что кислота сразу превращается в соль: CH₃COOC₂H₅ + NaOH → CH₃COONa + C₂H₅OH. Щелочной гидролиз называют ${term("saponification", "омылением")}.</p>
    <p><b>Жиры</b> — сложные эфиры глицерина и высших карбоновых кислот (триглицериды). Твёрдые жиры содержат в основном остатки насыщенных кислот, жидкие масла — ненасыщенных (олеиновой, линолевой); гидрированием масла получают маргарин. Омыление жира щёлочью даёт <b>мыло</b>:</p>
    <div class="eq">(C₁₇H₃₅COO)₃C₃H₅ + 3NaOH → C₃H₅(OH)₃ + 3C₁₇H₃₅COONa</div>
    <p>Ион стеарата — длинный неполярный «хвост» и заряженная «голова» –COO⁻. Хвосты погружаются в каплю жира, головы смотрят в воду — капля окружается оболочкой (мицелла) и смывается. В жёсткой воде мыло образует нерастворимые соли кальция — «хлопья».</p>
  </div>`));

  // ---------- тренажёр ----------
  const s6 = h(`<section id="drill"><h2>Тренажёр: узнай функциональную группу</h2>
    <div class="card pad">
      <div class="row" style="justify-content:space-between"><b data-k></b><span class="small muted" data-sc></span></div>
      <div class="eq" data-f></div>
      <div class="row" data-o></div>
      <p data-m style="margin:12px 0 0;min-height:1.5em"></p>
      <button class="btn small" type="button" data-next style="margin-top:8px">Следующая формула →</button>
    </div>
    <h3 style="margin-top:22px">Качественные реакции — шпаргалка</h3>
    <div class="table-wrap"><table class="data">
      <tr><th>Что определяем</th><th>Реактив</th><th>Признак</th></tr>
      <tr><td>многоатомные спирты (–OH у соседних C)</td><td>свежий Cu(OH)₂</td><td>ярко-синий раствор</td></tr>
      <tr><td>фенол</td><td>FeCl₃ / бромная вода</td><td>фиолетовая окраска / белый осадок</td></tr>
      <tr><td>альдегиды, HCOOH, глюкоза</td><td>[Ag(NH₃)₂]OH, t</td><td>серебряное зеркало</td></tr>
      <tr><td>альдегиды</td><td>Cu(OH)₂, t</td><td>кирпично-красный осадок Cu₂O</td></tr>
      <tr><td>карбоновые кислоты</td><td>NaHCO₃ / индикатор</td><td>выделение CO₂ / лакмус краснеет</td></tr>
      <tr><td>кратная связь C=C, C≡C</td><td>бромная вода, KMnO₄</td><td>обесцвечивание</td></tr>
    </table></div>
  </section>`);
  el.appendChild(s6);
  let di = 0, ok = 0, tot = 0, done = false;
  const order = DRILL.map((_, i) => i).sort(() => Math.random() - 0.5);
  const drill = () => {
    const [f] = DRILL[order[di]];
    done = false;
    s6.querySelector("[data-k]").textContent = `Формула ${di + 1} из ${DRILL.length}`;
    s6.querySelector("[data-f]").textContent = f;
    s6.querySelector("[data-m]").innerHTML = "<span class='muted'>К какому классу относится вещество?</span>";
    s6.querySelector("[data-o]").innerHTML = CLASSES.map((c, i) => `<button class="chip" type="button" data-c="${i}">${c}</button>`).join("");
    s6.querySelector("[data-sc]").textContent = tot ? `верно ${ok} из ${tot}` : "";
  };
  s6.querySelector("[data-o]").addEventListener("click", (e) => {
    const b = e.target.closest("[data-c]");
    if (!b || done) return;
    done = true; tot++;
    const [, ans, why] = DRILL[order[di]];
    const right = +b.dataset.c === ans;
    if (right) ok++;
    s6.querySelectorAll("[data-c]").forEach((x) => { if (+x.dataset.c === ans) x.classList.add("on"); });
    if (!right) b.style.borderColor = "var(--bad)";
    s6.querySelector("[data-m]").innerHTML = (right ? "<b style='color:var(--good)'>Верно!</b> " : `<b style='color:var(--bad)'>Нет, это ${CLASSES[ans]}.</b> `) + why;
    s6.querySelector("[data-sc]").textContent = `верно ${ok} из ${tot}`;
  });
  s6.querySelector("[data-next]").onclick = () => { di = (di + 1) % DRILL.length; drill(); };
  drill();
}

export const quiz = [
  { q: "Какой реактив позволяет отличить глицерин от этанола?", options: ["Na", "свежий Cu(OH)₂", "бромная вода", "NaHCO₃"], answer: 1, why: "Многоатомные спирты с соседними OH-группами растворяют Cu(OH)₂ с образованием ярко-синего раствора." },
  { q: "При внутримолекулярной дегидратации пропанола-1 образуется:", options: ["пропаналь", "пропен", "дипропиловый эфир", "пропан"], answer: 1, why: "При t > 140 °C с H₂SO₄ отщепляется вода внутри молекулы — получается алкен." },
  { q: "В реакции этерификации вода образуется из…", options: ["H кислоты и OH спирта", "OH кислоты и H спирта", "двух OH-групп кислоты", "H₂SO₄"], answer: 1, why: "Это доказали опытом с изотопом ¹⁸O: метка из спирта оказывается в эфире, а не в воде." },
  { q: "Какое вещество даёт реакцию «серебряного зеркала»?", options: ["ацетон", "этанол", "муравьиная кислота", "уксусная кислота"], answer: 2, why: "В HCOOH есть альдегидный фрагмент H–C=O." },
  { q: "Щелочной гидролиз жиров называют…", options: ["этерификацией", "омылением", "гидрированием", "крекингом"], answer: 1, why: "Получаются глицерин и соли высших кислот — мыла." },
  { q: "Межклассовым изомером этанола является:", options: ["этаналь", "диметиловый эфир", "этиленгликоль", "уксусная кислота"], answer: 1, why: "C₂H₆O: CH₃–CH₂–OH и CH₃–O–CH₃." },
];
