import { h, kid, term, stage, esc } from "../ui.js";
import { createViewer } from "../three/core.js";
import { createEquationScene } from "../three/genetic-models.js";

// Узлы схемы (координаты в viewBox 720×330)
const NODES = {
  Ca: [60, 60, "Ca", "металл"], CaO: [220, 60, "CaO", "основный оксид"], CaOH2: [390, 60, "Ca(OH)₂", "основание"], CaCO3: [600, 60, "CaCO₃", "соль"],
  S: [60, 270, "S", "неметалл"], SO2: [200, 270, "SO₂", "кислотный оксид"], SO3: [340, 270, "SO₃", "кислотный оксид"], H2SO4: [490, 270, "H₂SO₄", "кислота"], Na2SO4: [650, 270, "Na₂SO₄", "соль"],
  CaSO4: [500, 165, "CaSO₄", "соль обоих рядов"],
};
const EDGES = [
  { a: "Ca", b: "CaO", eq: "2Ca + O₂ → 2CaO", type: "соединение, горение", note: "Кальций горит кирпично-красным пламенем. Металл + кислород → основный оксид.", L: [[2, "Ca"], [1, "O2"]], R: [[2, "CaO"]] },
  { a: "CaO", b: "CaOH2", eq: "CaO + H₂O → Ca(OH)₂ + Q", type: "соединение, экзотермическая", note: "«Гашение извести»: смесь сильно разогревается. Основный оксид + вода → щёлочь (только для активных металлов).", L: [[1, "CaO"], [1, "H2O"]], R: [[1, "Ca(OH)2"]] },
  { a: "CaOH2", b: "CaCO3", eq: "Ca(OH)₂ + CO₂ → CaCO₃↓ + H₂O", type: "обмен с кислотным оксидом", note: "Качественная реакция на CO₂: известковая вода мутнеет. Так твердеет известковая штукатурка.", L: [[1, "Ca(OH)2"], [1, "CO2"]], R: [[1, "CaCO3"], [1, "H2O"]] },
  { a: "CaCO3", b: "CaO", eq: "CaCO₃ →(t ≈ 900 °C) CaO + CO₂↑", type: "разложение, эндотермическая", note: "Обжиг известняка в печах — так получают негашёную известь. Круг замкнулся: из соли снова оксид.", L: [[1, "CaCO3"]], R: [[1, "CaO"], [1, "CO2"]], curve: true },
  { a: "S", b: "SO2", eq: "S + O₂ → SO₂", type: "соединение, горение", note: "Сера горит синим пламенем, образуя едкий сернистый газ. Неметалл + кислород → кислотный оксид. (На модели — кольцо S₈; в уравнении для простоты пишут S.)", L: [[1, "S"], [1, "O2"]], R: [[1, "SO2"]] },
  { a: "SO2", b: "SO3", eq: "2SO₂ + O₂ ⇄ 2SO₃ (кат. V₂O₅, t)", type: "соединение, обратимая, каталитическая", note: "Ключевая стадия производства серной кислоты: без катализатора оксид ванадия(V) реакция почти не идёт.", L: [[2, "SO2"], [1, "O2"]], R: [[2, "SO3"]] },
  { a: "SO3", b: "H2SO4", eq: "SO₃ + H₂O → H₂SO₄", type: "соединение", note: "Кислотный оксид + вода → кислота. На заводе SO₃ поглощают концентрированной серной кислотой, чтобы не образовался кислотный туман.", L: [[1, "SO3"], [1, "H2O"]], R: [[1, "H2SO4"]] },
  { a: "H2SO4", b: "Na2SO4", eq: "H₂SO₄ + 2NaOH → Na₂SO₄ + 2H₂O", type: "обмен, нейтрализация", note: "Кислота + щёлочь → соль + вода. Сульфат натрия — «глауберова соль».", L: [[1, "H2SO4"], [2, "NaOH"]], R: [[1, "Na2SO4"], [2, "H2O"]] },
  { a: "CaOH2", b: "CaSO4", eq: "Ca(OH)₂ + H₂SO₄ → CaSO₄ + 2H₂O", type: "обмен, нейтрализация", note: "Здесь встречаются два ряда: основание металла и кислота неметалла дают соль. CaSO₄ малорастворим — это гипс.", L: [[1, "Ca(OH)2"], [1, "H2SO4"]], R: [[1, "CaSO4"], [2, "H2O"]] },
  { a: "SO3", b: "CaSO4", eq: "CaO + SO₃ → CaSO₄", type: "соединение оксидов", note: "Основный оксид + кислотный оксид → соль. Так известь связывает оксиды серы в дымовых газах электростанций.", L: [[1, "CaO"], [1, "SO3"]], R: [[1, "CaSO4"]] },
];
const PUZ = [
  { chain: ["Na", "Na₂O", "X", "NaCl"], opts: ["NaOH", "Na₂CO₃", "NaH", "Na₂SO₄"], ans: 0, why: "Na₂O + H₂O → 2NaOH; NaOH + HCl → NaCl + H₂O. Остальные варианты тоже могут дать NaCl, но из Na₂O одним шагом с водой получается только щёлочь." },
  { chain: ["P", "X", "H₃PO₄", "Na₃PO₄"], opts: ["PH₃", "P₂O₅", "Na₃P", "P₂O₃"], ans: 1, why: "4P + 5O₂ → 2P₂O₅; P₂O₅ + 3H₂O → 2H₃PO₄. Из P₂O₃ получилась бы фосфористая кислота H₃PO₃." },
  { chain: ["Cu", "CuO", "CuCl₂", "X", "CuO"], opts: ["Cu", "CuSO₄", "Cu(OH)₂", "Cu₂O"], ans: 2, why: "CuCl₂ + 2NaOH → Cu(OH)₂↓ + 2NaCl; Cu(OH)₂ →(t) CuO + H₂O — нерастворимое основание разлагается." },
  { chain: ["Zn", "ZnO", "ZnCl₂", "X", "Na₂[Zn(OH)₄]"], opts: ["ZnSO₄", "Zn(OH)₂", "Zn", "ZnS"], ans: 1, why: "ZnCl₂ + 2NaOH → Zn(OH)₂↓ + 2NaCl; амфотерный Zn(OH)₂ растворяется в избытке щёлочи: Zn(OH)₂ + 2NaOH → Na₂[Zn(OH)₄]." },
];

export async function render(el) {
  el.appendChild(h(`<div>
    <p class="lead">Классы неорганических веществ не живут сами по себе: из металла можно получить оксид, из оксида — основание, из основания — соль. Такая цепочка превращений, связывающая вещества одного элемента, называется ${term("genetic_series", "генетическим рядом")}. «Генетический» — от слова «происхождение»: все вещества ряда «родственники» и содержат один и тот же элемент.</p>
    ${kid("Это как родословное дерево: атом кальция переходит от «бабушки» (металл) к «маме» (оксид), к «дочке» (основание) и к «внучке» (соль). Меняется «одежда» — соседи атома, а сам кальций остаётся тем же!")}
  </div>`));

  el.appendChild(h(`<section id="series"><h2>Два главных ряда</h2>
    <div class="grid-2">
      <div class="card pad"><h3 class="mt0">Ряд металла</h3><p class="formula">металл → основный оксид → основание → соль</p><p class="small muted mt0">Ca → CaO → Ca(OH)₂ → CaCO₃. Для неактивных металлов (Cu, Fe) основание получают не из оксида, а из соли действием щёлочи: CuO → CuCl₂ → Cu(OH)₂.</p></div>
      <div class="card pad"><h3 class="mt0">Ряд неметалла</h3><p class="formula">неметалл → кислотный оксид → кислота → соль</p><p class="small muted mt0">S → SO₂ → SO₃ → H₂SO₄ → Na₂SO₄; C → CO₂ → H₂CO₃ → CaCO₃; P → P₂O₅ → H₃PO₄ → Ca₃(PO₄)₂.</p></div>
    </div>
    <div class="callout"><b>Главное правило:</b> вещества разных рядов реагируют между собой — основный оксид с кислотным, основание с кислотой, — и в точке встречи всегда получается <b>соль</b>. Ряды амфотерных металлов (Zn, Al) «умеют» вести себя и как ряд металла, и как ряд неметалла.</div>
  </section>`));

  // ---------- Интерактивная схема + 3D ----------
  const sec = h(`<section id="scheme"><h2>Интерактивная схема превращений</h2>
    <p>Нажимай на стрелки (или на номера): под схемой появится уравнение реакции, а в 3D — модели всех участников с коэффициентами. Посчитай атомы слева и справа — их поровну.</p>
    <div class="card pad" style="padding:10px">
      <svg viewBox="0 0 720 330" style="width:100%;height:auto;display:block" data-svg role="group" aria-label="Схема генетических рядов кальция и серы"></svg>
    </div>
  </section>`);
  el.appendChild(sec);
  const svg = sec.querySelector("[data-svg]");
  const W = 64, H = 22; // полуширина/полувысота узла
  const ends = (e) => {
    const [x1, y1] = NODES[e.a], [x2, y2] = NODES[e.b];
    const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L;
    const cut = (ux, uy) => Math.min(Math.abs(ux) > 1e-6 ? (W - 6) / Math.abs(ux) : 1e9, Math.abs(uy) > 1e-6 ? (H + 4) / Math.abs(uy) : 1e9);
    const c = cut(ux, uy);
    return [x1 + ux * c, y1 + uy * c, x2 - ux * c, y2 - uy * c];
  };
  const edgePath = (e) => {
    if (e.curve) { const [x1, y1] = NODES[e.a], [x2] = NODES[e.b]; return `M${x1},${y1 - H} C${x1 - 40},${y1 - 75} ${x2 + 40},${y1 - 75} ${x2 + 10},${y1 - H - 2}`; }
    const [a, b, c, d] = ends(e);
    return `M${a},${b} L${c},${d}`;
  };
  const mid = (e) => {
    if (e.curve) { const [x1, y1] = NODES[e.a], [x2] = NODES[e.b]; return [(x1 + x2) / 2, y1 - 57]; }
    const [a, b, c, d] = ends(e); return [(a + c) / 2, (b + d) / 2];
  };
  // при заголовке «CaO + SO₃» стрелка идёт от SO₃; CaO как партнёр указан в уравнении
  svg.innerHTML = `<defs><marker id="gen-ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0L10,5L0,10z" fill="currentColor"/></marker></defs>
    <text x="8" y="16" font-size="12" fill="currentColor" opacity="0.6">ряд кальция</text><text x="8" y="322" font-size="12" fill="currentColor" opacity="0.6">ряд серы</text>
    ${EDGES.map((e, i) => { const [mx, my] = mid(e); return `<g class="gen-edge" data-e="${i}" tabindex="0" role="button" aria-label="${esc(e.eq)}" style="cursor:pointer">
      <path d="${edgePath(e)}" fill="none" stroke="transparent" stroke-width="18"/>
      <path d="${edgePath(e)}" fill="none" stroke="currentColor" stroke-width="2.5" marker-end="url(#gen-ar)" data-line opacity="0.55"/>
      <circle cx="${mx}" cy="${my}" r="11" fill="var(--surface-2)" stroke="currentColor" stroke-width="1.5" data-dot/><text x="${mx}" y="${my + 4}" font-size="12" font-weight="800" text-anchor="middle" fill="currentColor">${i + 1}</text></g>`; }).join("")}
    ${Object.entries(NODES).map(([k, [x, y, f, t]]) => `<g data-n="${k}"><rect x="${x - W}" y="${y - H}" width="${W * 2}" height="${H * 2}" rx="12" fill="var(--surface)" stroke="var(--line-2)" stroke-width="1.5"/>
      <text x="${x}" y="${y + 1}" font-size="17" font-weight="800" text-anchor="middle" fill="currentColor">${f}</text><text x="${x}" y="${y + 15}" font-size="9.5" text-anchor="middle" fill="currentColor" opacity="0.65">${t}</text></g>`).join("")}`;
  const st = stage(`<div class="overlay"><span data-eq style="font-size:0.95rem"></span><span data-n></span></div>`, { wide: true });
  sec.appendChild(st);
  const card = h(`<div class="card pad" style="margin-top:10px"><div class="eq mt0" data-big style="margin-top:0"></div><p class="mt0"><b data-type></b></p><p class="mt0" data-note></p></div>`);
  sec.appendChild(card);
  const v = createViewer(st, { camera: [0, 2.5, 14], minDistance: 4, maxDistance: 60, autoRotate: false });
  const scene = createEquationScene(v);
  const pickEdge = (i) => {
    const e = EDGES[i];
    svg.querySelectorAll(".gen-edge").forEach((g) => {
      const on = +g.dataset.e === i;
      g.querySelector("[data-line]").setAttribute("opacity", on ? "1" : "0.55");
      g.querySelector("[data-line]").setAttribute("stroke", on ? "var(--accent)" : "currentColor");
      g.querySelector("[data-dot]").setAttribute("fill", on ? "var(--accent)" : "var(--surface-2)");
    });
    svg.querySelectorAll("[data-n] rect").forEach((r) => r.setAttribute("stroke", "var(--line-2)"));
    [e.a, e.b].forEach((k) => svg.querySelector(`[data-n="${k}"] rect`).setAttribute("stroke", "var(--accent)"));
    const half = scene.show(e.L, e.R);
    // камера: вся строка уравнения должна поместиться по ширине
    const fov = (v.camera.fov * Math.PI) / 360;
    const dist = Math.max(9, (half / (Math.tan(fov) * v.camera.aspect)) * 1.05, 4.5 / Math.tan(fov));
    v.camera.position.set(0, dist * 0.18, dist); v.controls.target.set(0, 0, 0); v.controls.update();
    st.querySelector("[data-eq]").innerHTML = `<b>${i + 1}.</b> ${NODES[e.a][2]} → ${NODES[e.b][2]}`;
    st.querySelector("[data-n]").textContent = e.type;
    card.querySelector("[data-big]").textContent = e.eq;
    card.querySelector("[data-type]").textContent = `Тип: ${e.type}`;
    card.querySelector("[data-note]").textContent = e.note;
  };
  svg.querySelectorAll(".gen-edge").forEach((g) => {
    g.addEventListener("click", () => pickEdge(+g.dataset.e));
    g.addEventListener("keydown", (ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); pickEdge(+g.dataset.e); } });
  });
  pickEdge(0);
  sec.appendChild(h(`<p class="small muted">Цвета атомов: <span style="color:#3dff6e">●</span> Ca, <span style="color:#ffd23a">●</span> S, <span style="color:#ff3b3b">●</span> O, <span style="color:#9aa2b4">●</span> C, <span style="color:#ab5cf2">●</span> Na, ○ H. Металл кальций показан фрагментом его гранецентрированной решётки, ионные соединения — формульной единицей (ионы без «палочек»).</p>`));

  // ---------- Тренажёр ----------
  const tr = h(`<section id="chains"><h2>Тренажёр: найди пропущенное вещество</h2>
    <p>В цепочке одно звено заменено на X. Какое вещество подходит? Каждая стрелка — одна реакция.</p>
    <div data-list></div>
  </section>`);
  el.appendChild(tr);
  PUZ.forEach((p) => {
    const card = h(`<div class="card pad" style="margin-bottom:12px">
      <div class="formula" style="font-size:1.15rem;font-weight:800;margin-bottom:10px">${p.chain.map((c) => (c === "X" ? `<span style="color:var(--accent)">X</span>` : c)).join(" → ")}</div>
      <div class="row">${p.opts.map((o, i) => `<button class="btn small" type="button" data-o="${i}">${o}</button>`).join("")}</div>
      <p class="small" data-fb style="margin:10px 0 0" hidden></p></div>`);
    card.querySelectorAll("[data-o]").forEach((b) => (b.onclick = () => {
      const ok = +b.dataset.o === p.ans;
      card.querySelectorAll("[data-o]").forEach((x) => { x.disabled = true; if (+x.dataset.o === p.ans) x.classList.add("primary"); });
      const fb = card.querySelector("[data-fb]");
      fb.hidden = false;
      fb.innerHTML = `${ok ? "<b style='color:var(--good)'>Верно!</b>" : `<b style='color:var(--bad)'>Не то.</b> Правильно: ${p.opts[p.ans]}.`} ${p.why}`;
    }));
    tr.querySelector("[data-list]").appendChild(card);
  });

  el.appendChild(h(`<section id="how"><h2>Как решать цепочки на ОГЭ</h2>
    <ol>
      <li>Подпиши под каждой формулой её класс: металл, оксид, основание, кислота, соль.</li>
      <li>Для каждой стрелки вспомни, какой реагент переводит один класс в другой: металл → оксид (+O₂), оксид → основание/кислота (+H₂O), основание → соль (+кислота или кислотный оксид), соль → нерастворимое основание (+щёлочь), соль → другая соль (+соль, если выпадает осадок).</li>
      <li>Проверь условия по таблице растворимости и ряду активности: реакция обмена идёт, только если есть осадок, газ или вода.</li>
      <li>Расставь коэффициенты и проверь число атомов.</li>
    </ol>
    <div class="callout warn"><b>Частая ошибка:</b> писать CuO + H₂O → Cu(OH)₂. Оксид меди с водой не реагирует! Нерастворимые основания получают только через соль: CuO → CuSO₄ → Cu(OH)₂.</div>
    <p class="small muted">Подробнее о каждом классе: <a href="#lesson-oxides">Оксиды</a> · <a href="#lesson-acidsbases">Кислоты и основания</a> · <a href="#lesson-salts">Соли</a>.</p>
  </section>`));
}

export const quiz = [
  { q: "Какая последовательность — генетический ряд металла?", options: ["S → SO₂ → H₂SO₃", "Ca → CaO → Ca(OH)₂ → CaCl₂", "C → CO₂ → H₂CO₃", "P → P₂O₅ → H₃PO₄"], answer: 1, why: "Металл → основный оксид → основание → соль." },
  { q: "Что нужно добавить, чтобы осуществить превращение SO₃ → H₂SO₄?", options: ["O₂", "H₂O", "NaOH", "H₂"], answer: 1, why: "Кислотный оксид + вода → кислота." },
  { q: "Вещество X в цепочке CuCl₂ → X → CuO:", options: ["Cu", "Cu(OH)₂", "CuSO₄", "Cu₂O"], answer: 1, why: "Щёлочь осаждает Cu(OH)₂, который при нагревании разлагается на CuO и воду." },
  { q: "Вещества двух разных генетических рядов, вступая в реакцию, образуют…", options: ["металл", "оксид", "соль", "кислоту"], answer: 2, why: "Основный оксид + кислотный оксид, основание + кислота — всегда соль." },
  { q: "Какое превращение невозможно в одну стадию?", options: ["CaO → Ca(OH)₂", "CuO → Cu(OH)₂", "SO₂ → SO₃", "CaCO₃ → CaO"], answer: 1, why: "CuO не реагирует с водой; нужно сначала получить соль меди." },
];
