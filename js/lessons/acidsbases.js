import { h, kid, term, stage, chips, figureFrame } from "../ui.js";
import { createViewer } from "../three/core.js";
import { createDissociation } from "../three/acidsbases-dissoc.js";
import { fmt } from "../chem.js";

// pH при титровании 20 мл 0,1 М кислоты 0,1 М NaOH: точное решение уравнения электронейтральности
const KW = 1e-14;
function pHof(Ka, Va, Ca, Vb, Cb) {
  const V = Va + Vb, A = (Ca * Va) / V, Na = (Cb * Vb) / V;
  const f = (hh) => hh + Na - KW / hh - (A * Ka) / (Ka + hh);
  let lo = -15, hi = 1;
  for (let i = 0; i < 70; i++) { const m = (lo + hi) / 2; if (f(10 ** m) > 0) hi = m; else lo = m; }
  return -(lo + hi) / 2;
}
const ACIDS = [
  { label: "HCl — сильная", Ka: 1e7, name: "соляная кислота" },
  { label: "CH₃COOH — слабая", Ka: 1.75e-5, name: "уксусная кислота" },
];
const mix = (a, b, t) => a.map((x, i) => Math.round(x + (b[i] - x) * Math.max(0, Math.min(1, t))));
const IND = [
  { label: "Фенолфталеин", range: [8.2, 10], color: (p) => (p < 8.2 ? [236, 240, 248] : mix([250, 200, 225], [214, 30, 120], (p - 8.2) / 1.8)) },
  { label: "Метилоранж", range: [3.1, 4.4], color: (p) => (p < 3.1 ? [230, 50, 50] : p < 4.4 ? mix([235, 90, 40], [245, 170, 40], (p - 3.1) / 1.3) : [250, 210, 60]) },
  { label: "Лакмус", range: [5, 8], color: (p) => (p < 5 ? [220, 60, 60] : p < 8 ? mix([200, 70, 110], [80, 110, 230], (p - 5) / 3) : [70, 110, 235]) },
];

export async function render(el) {
  el.appendChild(h(`<div>
    <p class="lead">${term("acid", "Кислоты")} и ${term("base", "основания")} — два противоположных класса веществ. Встречаясь, они «гасят» друг друга, образуя соль и воду. На этом построены и изжога с таблеткой от неё, и точнейший метод анализа — титрование. Шкалу pH и индикаторы мы уже разобрали в уроке <a href="#lesson-solutions">«Растворы, кислоты и основания»</a>.</p>
    ${kid("Кислота — как вредный мальчишка, который раздаёт всем «колючки» H⁺. Щёлочь раздаёт «губки» OH⁻. Колючка + губка = капелька воды, и от вредности ничего не остаётся. Это и есть нейтрализация!")}
  </div>`));

  el.appendChild(h(`<section id="classes"><h2>Состав и классификация</h2>
    <div class="grid-2">
      <div class="card pad"><h3 class="mt0">Кислоты</h3><p class="small">Сложные вещества из атомов водорода, способных замещаться на металл, и кислотного остатка. В воде отщепляют ион H⁺.</p>
        <ul class="small"><li>по кислороду: бескислородные (HCl, H₂S) и кислородсодержащие (H₂SO₄, HNO₃)</li><li>по основности — числу H⁺: одноосновные HNO₃, двухосновные H₂SO₄, трёхосновные H₃PO₄</li><li>по силе: сильные и слабые</li></ul></div>
      <div class="card pad"><h3 class="mt0">Основания</h3><p class="small">Сложные вещества из атома металла и гидроксогрупп OH. В воде дают ион OH⁻.</p>
        <ul class="small"><li>растворимые — ${term("shcheloch", "щёлочи")}: NaOH, KOH, Ba(OH)₂, Ca(OH)₂ (малорастворим)</li><li>нерастворимые: Cu(OH)₂, Fe(OH)₃, Mg(OH)₂</li><li>амфотерные гидроксиды: Zn(OH)₂, Al(OH)₃ — ведут себя и как основания, и как кислоты</li></ul></div>
    </div>
    <div class="table-wrap"><table class="data">
      <tr><th>Кислота</th><th>Название</th><th>Остаток</th><th>Сила</th></tr>
      <tr><td>HCl</td><td>соляная (хлороводородная)</td><td>Cl⁻ хлорид</td><td>сильная</td></tr>
      <tr><td>HNO₃</td><td>азотная</td><td>NO₃⁻ нитрат</td><td>сильная</td></tr>
      <tr><td>H₂SO₄</td><td>серная</td><td>SO₄²⁻ сульфат</td><td>сильная</td></tr>
      <tr><td>H₃PO₄</td><td>фосфорная</td><td>PO₄³⁻ фосфат</td><td>средней силы</td></tr>
      <tr><td>H₂SO₃</td><td>сернистая</td><td>SO₃²⁻ сульфит</td><td>слабая, неустойчива</td></tr>
      <tr><td>H₂CO₃</td><td>угольная</td><td>CO₃²⁻ карбонат</td><td>слабая, распадается на CO₂ и H₂O</td></tr>
      <tr><td>H₂S</td><td>сероводородная</td><td>S²⁻ сульфид</td><td>слабая</td></tr>
      <tr><td>H₂SiO₃</td><td>кремниевая</td><td>SiO₃²⁻ силикат</td><td>слабая, нерастворима</td></tr>
      <tr><td>CH₃COOH</td><td>уксусная</td><td>CH₃COO⁻ ацетат</td><td>слабая</td></tr>
    </table></div>
  </section>`));

  // ---------- 3D-диссоциация ----------
  const sec = h(`<section id="dissociation"><h2>Диссоциация кислоты в 3D</h2>
    <p>Что происходит, когда кислоту наливают в воду? Молекула воды своей неподелённой парой электронов «выдёргивает» протон H⁺ из молекулы кислоты. Получается ион гидроксония <b>H₃O⁺</b> — именно он и есть «кислотность» раствора. Этот распад на ионы называют ${term("dissociation", "электролитической диссоциацией")}.</p>
    <div class="eq">HCl + H₂O → H₃O⁺ + Cl⁻ &nbsp;&nbsp;(кратко: HCl → H⁺ + Cl⁻)</div>
  </section>`);
  el.appendChild(sec);
  const chipBox = h(`<div style="margin-bottom:10px"></div>`);
  sec.appendChild(chipBox);
  const st = stage(`<div class="overlay"><span data-t></span><span data-c></span></div>`, { wide: true });
  sec.appendChild(st);
  const note = h(`<div class="card pad" style="margin-top:10px"><p data-n class="mt0"></p><button class="btn small" type="button" data-again>↺ Повторить</button></div>`);
  sec.appendChild(note);
  const v = createViewer(st, { camera: [0, 9, 8], fitWidth: 5.4, minDistance: 4, maxDistance: 30, autoRotateSpeed: 0.3 });
  const dis = createDissociation(v);
  const NOTES = {
    HCl: "Сильная кислота: протоны отдают практически все молекулы, степень диссоциации α ≈ 100%. Стрелка в уравнении одна (→). Таковы HCl, HBr, HI, HNO₃, H₂SO₄, HClO₄.",
    CH3COOH: "Слабая кислота: в 0,1 М растворе распадается лишь ≈ 1,3% молекул, и тут же ионы снова собираются обратно — устанавливается равновесие (⇄). На модели протон перепрыгивает туда-обратно у одной молекулы из шести; в реальности — примерно у одной из 75. Поэтому уксус кислый, но не обжигает, как соляная кислота той же концентрации.",
  };
  let kind = "HCl";
  chips(chipBox, [{ k: "HCl", label: "HCl — сильная" }, { k: "CH3COOH", label: "CH₃COOH — слабая" }], (it) => {
    kind = it.k; dis.build(kind);
    note.querySelector("[data-n]").textContent = NOTES[kind];
    st.querySelector("[data-t]").innerHTML = kind === "HCl" ? `<b>HCl + H₂O → H₃O⁺ + Cl⁻</b>` : `<b>CH₃COOH + H₂O ⇄ H₃O⁺ + CH₃COO⁻</b>`;
  });
  note.querySelector("[data-again]").onclick = () => dis.restart();
  dis.build("HCl");
  note.querySelector("[data-n]").textContent = NOTES.HCl;
  st.querySelector("[data-t]").innerHTML = `<b>HCl + H₂O → H₃O⁺ + Cl⁻</b>`;
  v.onFrame(() => { st.querySelector("[data-c]").textContent = `ионов H₃O⁺: ${dis.count()} из 6`; });
  sec.appendChild(h(`<p class="small muted">Цвета: <span style="color:#2fd35b">●</span> Cl, <span style="color:#ff3b3b">●</span> O, <span style="color:#9aa2b4">●</span> C, ○ H. Щёлочи диссоциируют по-другому: в кристалле NaOH уже есть ионы Na⁺ и OH⁻, вода просто растаскивает их: NaOH → Na⁺ + OH⁻.</p>`));

  // ---------- Свойства ----------
  el.appendChild(h(`<section id="props"><h2>Химические свойства</h2>
    <h3>Кислоты реагируют…</h3>
    <ul>
      <li>с <b>металлами</b>, стоящими в ${term("activity_series", "ряду активности")} левее водорода: <span class="formula">Zn + 2HCl → ZnCl₂ + H₂↑</span>. Медь, серебро, золото с HCl не реагируют. Азотная и концентрированная серная кислоты ведут себя иначе — водород не выделяют.</li>
      <li>с <b>основными и амфотерными оксидами</b>: <span class="formula">CuO + H₂SO₄ → CuSO₄ + H₂O</span></li>
      <li>с <b>основаниями</b> (нейтрализация): <span class="formula">NaOH + HCl → NaCl + H₂O</span></li>
      <li>с <b>солями</b>, если выпадает осадок или выделяется газ: <span class="formula">Na₂CO₃ + 2HCl → 2NaCl + H₂O + CO₂↑</span></li>
    </ul>
    <div class="eq" style="font-size:0.95rem">Li K Ba Ca Na Mg Al Zn Fe Ni Sn Pb (H) Cu Hg Ag Pt Au</div>
    <h3>Щёлочи реагируют…</h3>
    <ul>
      <li>с кислотами: <span class="formula">2KOH + H₂SO₄ → K₂SO₄ + 2H₂O</span></li>
      <li>с кислотными оксидами: <span class="formula">Ca(OH)₂ + CO₂ → CaCO₃↓ + H₂O</span> — помутнение известковой воды</li>
      <li>с солями, если образуется осадок: <span class="formula">CuSO₄ + 2NaOH → Cu(OH)₂↓ + Na₂SO₄</span> — голубой студенистый осадок</li>
    </ul>
    <p><b>Нерастворимые основания</b> при нагревании разлагаются: <span class="formula">Cu(OH)₂ →(t) CuO + H₂O</span>. <b>Амфотерные</b> растворяются и в кислотах, и в щелочах: <span class="formula">Al(OH)₃ + NaOH → Na[Al(OH)₄]</span>.</p>
    <div class="callout warn"><b>Сначала вода, потом кислота!</b> При разбавлении серной кислоты выделяется очень много тепла. Кислоту льют тонкой струйкой в воду, а не наоборот, иначе вода вскипит и разбрызгает кислоту.</div>
  </section>`));

  // ---------- Нейтрализация и титрование ----------
  const tit = h(`<section id="titration"><h2>Нейтрализация и титрование</h2>
    <p>${term("neutralization", "Нейтрализация")} — реакция кислоты с основанием. Какую бы пару ни взять, суть одна: <span class="formula">H⁺ + OH⁻ → H₂O</span>. Если кислоты и щёлочи взяли поровну (в молях H⁺ и OH⁻), раствор станет нейтральным.</p>
    <p>На этом основано ${term("titration", "титрование")}: к точно отмеренному объёму кислоты из бюретки по каплям приливают щёлочь известной концентрации, пока ${term("indicator", "индикатор")} не сменит цвет. По израсходованному объёму вычисляют концентрацию кислоты: c₁V₁ = c₂V₂.</p>
  </section>`);
  el.appendChild(tit);
  const fig = h(`<figure class="figure" style="margin:16px 0"></figure>`);
  fig.appendChild(figureFrame("figures/titration", "Титрование — бюретка и колба"));
  fig.appendChild(h(`<figcaption>Бюретка и колба для титрования (навык Anatomy): открой кран и следи за цветом раствора.</figcaption>`));
  tit.appendChild(fig);
  const box = h(`<div class="card pad">
    <p class="mt0 small">Модель: в колбе 20 мл 0,1 М кислоты, в бюретке 0,1 М NaOH. Двигай ползунок — это объём прилитой щёлочи.</p>
    <div data-acid style="margin-bottom:6px"></div><div data-ind style="margin-bottom:10px"></div>
    <div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap">
      <svg viewBox="0 0 600 360" style="flex:1 1 320px;min-width:0;max-width:100%;height:auto" data-svg role="img" aria-label="Кривая титрования"></svg>
      <div style="flex:0 0 120px;text-align:center">
        <svg viewBox="0 0 100 130" width="110" height="140" aria-hidden="true"><path d="M38 6h24v36l30 70a8 8 0 0 1-7 12H15a8 8 0 0 1-7-12l30-70z" fill="none" stroke="currentColor" stroke-width="3" opacity="0.6"/><path data-liq d="M24 76h52l16 36a8 8 0 0 1-7 12H15a8 8 0 0 1-7-12z"/></svg>
        <div class="small" data-ph style="font-weight:800;font-size:1.2rem"></div>
      </div>
    </div>
    <label class="ctl" style="margin-top:8px">Прилито NaOH: <b data-vv></b><input type="range" min="0" max="40" step="0.05" value="10" data-v></label>
    <div class="row" style="margin-top:8px"><button class="btn small" type="button" data-d="-1">−1 мл</button><button class="btn small" type="button" data-d="0.05">+ капля</button><button class="btn small" type="button" data-d="1">+1 мл</button></div>
    <p data-msg class="small" style="margin:10px 0 0"></p>
  </div>`);
  tit.appendChild(box);
  let acid = ACIDS[0], ind = IND[0];
  const svg = box.querySelector("[data-svg]");
  const X = (vb) => 50 + (vb / 40) * 530, Y = (p) => 330 - (p / 14) * 310;
  const draw = () => {
    const vb = +box.querySelector("[data-v]").value;
    let path = "";
    for (let x = 0; x <= 40.001; x += 0.1) path += `${x ? "L" : "M"}${X(x).toFixed(1)},${Y(pHof(acid.Ka, 20, 0.1, x, 0.1)).toFixed(1)}`;
    const pH = pHof(acid.Ka, 20, 0.1, vb, 0.1), pE = pHof(acid.Ka, 20, 0.1, 20, 0.1);
    const grid = [0, 2, 4, 6, 7, 8, 10, 12, 14].map((p) => `<line x1="50" x2="580" y1="${Y(p)}" y2="${Y(p)}" stroke="currentColor" opacity="${p === 7 ? 0.35 : 0.12}"/><text x="40" y="${Y(p) + 4}" font-size="12" text-anchor="end" fill="currentColor" opacity="0.7">${p}</text>`).join("")
      + [0, 10, 20, 30, 40].map((x) => `<text x="${X(x)}" y="350" font-size="12" text-anchor="middle" fill="currentColor" opacity="0.7">${x}</text>`).join("");
    const [r0, r1] = ind.range, c = ind.color((r0 + r1) / 2);
    svg.innerHTML = `${grid}
      <rect x="50" width="530" y="${Y(r1)}" height="${Y(r0) - Y(r1)}" fill="rgb(${c})" opacity="0.18"/>
      <text x="575" y="${Y(r1) - 4}" font-size="11" text-anchor="end" fill="currentColor" opacity="0.8">переход: ${ind.label.toLowerCase()} ${fmt(r0, 1)}–${fmt(r1, 1)}</text>
      <line x1="${X(20)}" x2="${X(20)}" y1="20" y2="330" stroke="currentColor" stroke-dasharray="4 4" opacity="0.4"/>
      <text x="${X(20) + 6}" y="34" font-size="12" fill="currentColor" opacity="0.8">точка эквивалентности, pH ${fmt(pE, 2)}</text>
      <path d="${path}" fill="none" stroke="var(--accent)" stroke-width="3"/>
      <circle cx="${X(vb)}" cy="${Y(pH)}" r="7" fill="rgb(${ind.color(pH)})" stroke="currentColor" stroke-width="2"/>
      <text x="315" y="16" font-size="12" text-anchor="middle" fill="currentColor" opacity="0.7">pH</text>
      <text x="580" y="322" font-size="12" text-anchor="end" fill="currentColor" opacity="0.7">V(NaOH), мл</text>`;
    box.querySelector("[data-liq]").setAttribute("fill", `rgb(${ind.color(pH)})`);
    box.querySelector("[data-ph]").textContent = `pH ${fmt(pH, 2)}`;
    box.querySelector("[data-vv]").textContent = `${fmt(vb, 2)} мл`;
    const m = box.querySelector("[data-msg]");
    if (Math.abs(vb - 20) < 0.06) m.innerHTML = `<b>Точка эквивалентности:</b> кислоты и щёлочи поровну. ${acid.Ka > 1 ? "Получился раствор NaCl, pH = 7." : "Получился раствор CH₃COONa, а ацетат-ион слегка гидролизуется — pH ≈ 8,7, среда щелочная."}`;
    else if (vb < 20) m.textContent = `Кислота ещё в избытке: прореагировало ${fmt(vb * 0.1, 2)} ммоль из 2 ммоль. ${acid.Ka < 1 && vb > 2 && vb < 18 ? "Пологий участок — буферная зона: смесь CH₃COOH и CH₃COONa сопротивляется изменению pH." : ""}`;
    else m.textContent = `Щёлочь в избытке на ${fmt((vb - 20) * 0.1, 2)} ммоль — среда щелочная. Обрати внимание: возле 20 мл одна капля меняет pH на несколько единиц — это «скачок титрования».`;
  };
  chips(box.querySelector("[data-acid]"), ACIDS, (a) => { acid = a; draw(); });
  chips(box.querySelector("[data-ind]"), IND, (i) => { ind = i; draw(); });
  box.querySelector("[data-v]").oninput = draw;
  box.querySelectorAll("[data-d]").forEach((b) => (b.onclick = () => { const r = box.querySelector("[data-v]"); r.value = Math.max(0, Math.min(40, +r.value + +b.dataset.d)); draw(); }));
  draw();
  tit.appendChild(h(`<div class="callout adv">Для слабой кислоты скачок начинается выше (около pH 7) и заканчивается в щелочной области, поэтому метилоранж (переход 3,1–4,4) поменяет цвет слишком рано — нужен фенолфталеин. Для сильной кислоты подходят оба индикатора: скачок от pH ≈ 4 до 10 перекрывает обе зоны.</div>`));
  tit.appendChild(h(`<div>${kid("Изжога — это когда желудочная соляная кислота попала туда, где ей не место. Таблетка от изжоги содержит слабое основание (например, гидроксид магния или соду), которое нейтрализует лишнюю кислоту.", "Из жизни")}</div>`));
}

export const quiz = [
  { q: "Какой ион образуется при диссоциации любой кислоты в воде?", options: ["OH⁻", "H₃O⁺ (H⁺)", "Na⁺", "O²⁻"], answer: 1, why: "Кислота отдаёт протон молекуле воды — образуется ион гидроксония." },
  { q: "Какая кислота слабая?", options: ["HNO₃", "HCl", "H₂SO₄", "CH₃COOH"], answer: 3, why: "Уксусная кислота диссоциирует лишь на ~1% и обратимо." },
  { q: "Какой металл НЕ вытесняет водород из соляной кислоты?", options: ["Zn", "Fe", "Mg", "Cu"], answer: 3, why: "Медь стоит в ряду активности правее водорода." },
  { q: "Сокращённое уравнение реакции нейтрализации сильной кислоты щёлочью:", options: ["Na⁺ + Cl⁻ → NaCl", "H⁺ + OH⁻ → H₂O", "2H⁺ + O²⁻ → H₂O", "H₂ + O₂ → H₂O"], answer: 1, why: "Остальные ионы остаются в растворе без изменений." },
  { q: "Каков pH в точке эквивалентности при титровании HCl раствором NaOH?", options: ["1", "7", "9", "14"], answer: 1, why: "Получается раствор NaCl — нейтральная среда." },
  { q: "Что произойдёт при нагревании Cu(OH)₂?", options: ["ничего", "разложится на CuO и H₂O", "расплавится", "выделится водород"], answer: 1, why: "Нерастворимые основания при нагревании разлагаются на оксид и воду." },
];
