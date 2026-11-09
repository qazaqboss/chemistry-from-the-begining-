import { h, kid, term, stage } from "../ui.js";
import { createViewer, THREE } from "../three/core.js";
import { structureGallery } from "../three/y89-gallery.js";
import { p4, redP, hno3, nh4, h3po4, diatomic } from "../three/y89-structures.js";
import { makeKit, ballStick, PRODUCTS, rng } from "../three/y89-common.js";
import { MOLECULES } from "../data/molecules.js";
import { fmt } from "../chem.js";

const GALLERY = [
  { label: "N₂", name: "Азот N₂", info: "N≡N 1,10 Å · 945 кДж/моль", data: () => diatomic("N", 1.1, 3), note: "Тройная связь N≡N — одна из самых прочных в химии (945 кДж/моль). Поэтому азот воздуха так инертен: при обычных условиях реагирует только с литием. С водородом и кислородом — лишь при высокой температуре, давлении или в электрическом разряде (N₂ + O₂ ⇄ 2NO — при грозе)." },
  { label: "NH₃", name: "Аммиак NH₃", info: "пирамида · 107°", data: () => MOLECULES.find((m) => m.id === "NH3").data, note: "Бесцветный газ с резким запахом, легче воздуха, прекрасно растворяется в воде (≈700 объёмов в 1 объёме воды). Неподелённая пара азота присоединяет протон — поэтому аммиак основание: NH₃ + H₂O ⇄ NH₄⁺ + OH⁻, NH₃ + HCl → NH₄Cl («дым без огня»)." },
  { label: "NH₄⁺", name: "Ион аммония NH₄⁺", info: "тетраэдр · 109,5°", data: nh4, note: "Четвёртая связь N–H образована по донорно-акцепторному механизму, но в готовом ионе все четыре связи одинаковы. Соли аммония — удобрения; при нагревании со щёлочью выделяют аммиак (качественная реакция)." },
  { label: "HNO₃", name: "Азотная кислота HNO₃", info: "плоская молекула", data: hno3, note: "Сильная кислота и сильный окислитель (N⁺⁵). Бесцветная жидкость, на свету желтеет: 4HNO₃ → 4NO₂ + O₂ + 2H₂O. Две связи N–O равноценны (резонанс), третья — с группой OH." },
  { label: "P₄", name: "Белый фосфор P₄", info: "тетраэдр · P–P 2,21 Å · 60°", data: p4, note: "Молекулярная решётка из тетраэдров P₄. Угол 60° сильно «напряжён» — отсюда огромная активность: белый фосфор светится в темноте (медленно окисляется), самовоспламеняется на воздухе, ядовит. Хранят под водой." },
  { label: "красный P", name: "Красный фосфор (фрагмент)", info: "полимерные цепи", data: () => redP(3), note: "Тетраэдры P₄ «раскрываются» и сшиваются в длинные цепи — получается полимер. Он гораздо устойчивее и не ядовит; из него делают намазку спичечных коробков." },
  { label: "H₃PO₄", name: "Ортофосфорная кислота", info: "тетраэдр вокруг P", data: h3po4, note: "Твёрдая, хорошо растворимая кислота средней силы, трёхосновная: даёт три ряда солей — фосфаты (Na₃PO₄), гидрофосфаты (Na₂HPO₄) и дигидрофосфаты (NaH₂PO₄). Окислительных свойств не проявляет." },
];

// Круговорот азота: узлы схемы
const CYCLE = {
  air: { x: 320, y: 40, t: "N₂ воздуха (78%)", d: "Огромный, но почти недоступный резерв: из-за тройной связи растения не могут усвоить N₂ напрямую." },
  fix: { x: 112, y: 150, t: "Азотфиксация", d: "Клубеньковые бактерии бобовых (фермент нитрогеназа) превращают N₂ в NH₃. Около 10% даёт молния: N₂ + O₂ → 2NO → NO₂ → HNO₃ с дождём. Промышленность (процесс Габера) сейчас фиксирует столько же азота, сколько вся природа." },
  soil: { x: 320, y: 250, t: "NH₄⁺, NO₃⁻ в почве", d: "Нитрифицирующие бактерии окисляют аммоний: NH₄⁺ → NO₂⁻ → NO₃⁻. Нитраты и ионы аммония растения всасывают корнями." },
  plant: { x: 528, y: 150, t: "Растения, животные", d: "Из азота растения строят аминокислоты, белки и нуклеиновые кислоты; животные получают азот с пищей." },
  dec: { x: 528, y: 350, t: "Гниение", d: "Аммонификация: бактерии-гнилостники разлагают белки мёртвых организмов и отходы до аммиака NH₃ / NH₄⁺ — азот возвращается в почву." },
  den: { x: 112, y: 350, t: "Денитрификация", d: "В бедных кислородом почвах бактерии восстанавливают нитраты обратно до N₂ — азот возвращается в атмосферу, круг замкнулся." },
};
const ARROWS = [["air", "fix"], ["fix", "soil"], ["soil", "plant"], ["plant", "dec"], ["dec", "soil"], ["soil", "den"], ["den", "air"], ["air", "plant", "удобрения (Габер)"]];

// Константа равновесия ½N₂ + 3/2H₂ ⇄ NH₃ (Gillespie & Beattie), Kp в атм⁻¹
const Kp = (T) => 10 ** (2250.322 / T - 0.8534 - 1.51049 * Math.log10(T) - 25.8987e-5 * T + 14.8961e-8 * T * T);
// Мольная доля NH₃ в равновесии для смеси N₂ : H₂ = 1 : 3 (идеальный газ)
function nh3Yield(tC, P) {
  const K = Kp(tC + 273.15);
  let lo = 0, hi = 0.999999;
  for (let i = 0; i < 60; i++) {
    const x = (lo + hi) / 2, n = 4 - 2 * x;
    const q = (2 * x / n) / (((1 - x) / n) ** 0.5 * ((3 - 3 * x) / n) ** 1.5 * P);
    if (q < K) lo = x; else hi = x;
  }
  const x = (lo + hi) / 2;
  return { y: (2 * x) / (4 - 2 * x), xi: x };
}

export async function render(el) {
  el.appendChild(h(`<div>
    <p class="lead">Азот и фосфор — элементы VA-группы (5 валентных электронов: ns² np³). Азота в воздухе 78%, фосфор входит в кости, ДНК и молекулу-«батарейку» АТФ. Оба — главные элементы питания растений, поэтому их соединения выпускают миллионами тонн как удобрения.</p>
    ${kid("Азот — как замок с тремя тяжёлыми засовами (тройная связь). Растения плавают в «море» азота, но открыть замок сами не могут. Им помогают крошечные бактерии на корнях гороха и фасоли — и химики на заводах, где делают удобрения.")}
  </div>`));

  el.appendChild(h(`<section id="nitrogen"><h2>Азот: от −3 до +5</h2>
    <p>Степени окисления азота: −3 (NH₃, нитриды), 0 (N₂), +1 (N₂O), +2 (NO), +3 (HNO₂), +4 (NO₂), +5 (HNO₃, нитраты). Валентность азота не больше IV: у него нет d-подуровня, а четвёртую связь он образует по донорно-акцепторному механизму (в NH₄⁺, HNO₃).</p>
    <div class="grid-2">
      <div class="card pad"><b>Азот как окислитель</b><p class="formula small" style="margin:6px 0 0;white-space:normal">N₂ + 3H₂ ⇄ 2NH₃<br>6Li + N₂ → 2Li₃N</p></div>
      <div class="card pad"><b>Азот как восстановитель</b><p class="formula small" style="margin:6px 0 0;white-space:normal">N₂ + O₂ ⇄ 2NO<br>(t ≈ 2000 °C, молния)</p></div>
    </div>
    <p><b>Аммиак</b> в лаборатории получают нагреванием соли аммония со щёлочью:</p><div class="eq">2NH₄Cl + Ca(OH)₂ → CaCl₂ + 2NH₃↑ + 2H₂O</div><p>Собирают в перевёрнутую пробирку (легче воздуха). Аммиак горит в кислороде (4NH₃ + 3O₂ → 2N₂ + 6H₂O), а на платиновом катализаторе окисляется до NO — первая стадия получения азотной кислоты.</p>
  </section>`));

  const gal = h(`<section id="gallery"><h2>Молекулы азота и фосфора в 3D</h2></section>`);
  el.appendChild(gal);
  structureGallery(gal, GALLERY, { initial: 0 });

  // ---------- Габер ----------
  const hb = h(`<section id="haber"><h2>Синтез аммиака: процесс Габера</h2>
    <div class="eq">N₂ + 3H₂ ⇄ 2NH₃ + 92 кДж</div>
    <p>Реакция обратимая и экзотермическая, идёт с уменьшением числа молекул газа (4 → 2). По ${term("lechatelier", "принципу Ле Шателье")} выход NH₃ растёт при <b>повышении давления</b> и <b>понижении температуры</b>. Но на холоде реакция идёт мучительно медленно даже с катализатором (губчатое железо с добавками K₂O, Al₂O₃). Компромисс промышленности: ≈ 450 °C, 200–300 атм, непрореагировавшие N₂ и H₂ возвращают в цикл. Подвигай ползунки — расчёт ${term("equilibrium", "равновесия")} идёт по реальной константе Kp(T).</p>
  </section>`);
  el.appendChild(hb);
  const st = stage(`<div class="overlay"><span><b style="font-size:1rem">Реактор</b><br><span data-mix></span></span><span style="text-align:right"><span style="color:#3d6bff">●●</span> N₂ &nbsp;○○ H₂<br><span style="color:#3d6bff">●</span>○ NH₃</span></div>`, { wide: true });
  hb.appendChild(st);
  const ctl = h(`<div class="card pad hab" style="margin-top:10px">
    <label class="ctl">Температура: <b data-tv></b><input type="range" min="200" max="700" step="10" value="450" data-t></label>
    <label class="ctl" style="margin-top:10px">Давление: <b data-pv></b><input type="range" min="0" max="3" step="0.01" value="2.35" data-p></label>
    <div class="hab-out"><div class="hab-big" data-y></div><div data-note class="small"></div></div>
    <svg viewBox="0 0 320 170" class="hab-svg" role="img" aria-label="Выход аммиака от давления"></svg>
    <style>
      .hab .hab-out{display:flex;gap:16px;align-items:center;margin-top:12px;flex-wrap:wrap}
      .hab .hab-big{font-size:2rem;font-weight:800;color:var(--accent);min-width:110px}
      .hab .hab-out .small{flex:1;min-width:200px}
      .hab-svg{width:100%;max-width:520px;display:block;margin-top:10px}
      .hab-svg text{fill:var(--text-2);font-size:10px}
    </style>
  </div>`);
  hb.appendChild(ctl);
  const v = createViewer(st, { camera: [0, 4, 22], fitWidth: 9, autoRotateSpeed: 0.4, minDistance: 8, maxDistance: 50 });
  const reactor = buildReactor(v);
  const svg = ctl.querySelector("svg");
  const pOf = () => Math.round(10 ** +ctl.querySelector("[data-p]").value);
  const updH = () => {
    const T = +ctl.querySelector("[data-t]").value, P = pOf();
    const { y, xi } = nh3Yield(T, P);
    ctl.querySelector("[data-tv]").textContent = `${T} °C`;
    ctl.querySelector("[data-pv]").textContent = `${P} атм`;
    ctl.querySelector("[data-y]").textContent = `${fmt(y * 100, 1)}%`;
    const speed = T < 350 ? "очень медленно — равновесие не успевает установиться" : T < 420 ? "медленно" : T <= 550 ? "достаточно быстро на железном катализаторе" : "быстро, но выход мал";
    ctl.querySelector("[data-note]").innerHTML = `Равновесная доля NH₃ в смеси (по объёму). Скорость реакции: <b>${speed}</b>.${P > 400 ? " Давление выше 300–400 атм обходится слишком дорого: толстостенная аппаратура и компрессоры." : ""}`;
    st.querySelector("[data-mix]").textContent = `${T} °C · ${P} атм · NH₃ ${fmt(y * 100, 0)}%`;
    reactor.set(T, P, xi);
    drawChart(svg, T, P);
  };
  ctl.querySelectorAll("input").forEach((i) => (i.oninput = updH));
  updH();
  hb.appendChild(h(`<p class="small muted">Расчёт для идеального газа и смеси N₂ : H₂ = 1 : 3; при сотнях атмосфер реальный выход на несколько процентов выше. Подробнее о равновесии — в курсе 10 класса.</p>`));

  el.appendChild(h(`<section id="nitric"><h2>Азотная кислота и нитраты</h2>
    <p>Промышленное получение: NH₃ → NO → NO₂ → HNO₃ (4NO₂ + O₂ + 2H₂O → 4HNO₃). HNO₃ — сильная кислота, но с металлами ведёт себя по-особому: окислитель в ней — N⁺⁵, а не H⁺, поэтому <b>водород не выделяется никогда</b>.</p>
    <div class="table-wrap"><table class="data">
      <tr><th>Кислота</th><th>Металл</th><th>Главный продукт восстановления</th></tr>
      <tr><td>концентрированная</td><td>Cu, Ag, Hg (неактивные)</td><td>NO₂ — бурый газ</td></tr>
      <tr><td>концентрированная</td><td>Fe, Al, Cr (на холоду)</td><td>пассивация — реакции нет</td></tr>
      <tr><td>разбавленная</td><td>Cu, Ag</td><td>NO — бесцветный, на воздухе буреет</td></tr>
      <tr><td>разбавленная</td><td>Zn, Mg, Ca (активные)</td><td>N₂O, N₂ или NH₄NO₃ (чем активнее металл и разбавленнее кислота, тем глубже восстановление)</td></tr>
    </table></div>
    <div class="eq">Cu + 4HNO₃(конц.) → Cu(NO₃)₂ + 2NO₂↑ + 2H₂O<br>3Cu + 8HNO₃(разб.) → 3Cu(NO₃)₂ + 2NO↑ + 4H₂O</div>
    <p>Нитраты при нагревании разлагаются по-разному: нитраты активных металлов (до Mg) → нитрит + O₂ (2KNO₃ → 2KNO₂ + O₂); от Mg до Cu → оксид + NO₂ + O₂; после Cu → металл + NO₂ + O₂. Смесь «азотной и соляной» кислот (1 : 3) — царская водка — растворяет даже золото.</p>
    <div class="callout warn"><b>Осторожно:</b> азотная кислота разрушает кожу (белки желтеют — ксантопротеиновая реакция), а пары NO₂ ядовиты. Опыты — только в вытяжном шкафу.</div>
  </section>`));

  el.appendChild(h(`<section id="phosphorus"><h2>Фосфор и удобрения</h2>
    <p>Фосфор активнее азота как простое вещество (связь P–P слабее N≡N), но менее электроотрицателен. Горит ослепительно: 4P + 5O₂ → 2P₂O₅. Оксид P₂O₅ жадно поглощает воду: P₂O₅ + 3H₂O → 2H₃PO₄. Качественная реакция на фосфат-ион — жёлтый осадок с AgNO₃: 3Ag⁺ + PO₄³⁻ → Ag₃PO₄↓.</p>
    <div class="table-wrap"><table class="data">
      <tr><th>Удобрение</th><th>Формула</th><th>Питательный элемент</th></tr>
      <tr><td>аммиачная селитра</td><td>NH₄NO₃</td><td>N (35%)</td></tr>
      <tr><td>карбамид (мочевина)</td><td>(NH₂)₂CO</td><td>N (46%)</td></tr>
      <tr><td>суперфосфат двойной</td><td>Ca(H₂PO₄)₂</td><td>P</td></tr>
      <tr><td>аммофос</td><td>NH₄H₂PO₄</td><td>N и P</td></tr>
      <tr><td>калийная селитра</td><td>KNO₃</td><td>K и N</td></tr>
    </table></div>
    <div class="card pad"><p class="mt0"><b>Задача.</b> Какая массовая доля азота в аммиачной селитре NH₄NO₃?</p><p class="small" style="margin:0">M(NH₄NO₃) = 14 + 4 + 14 + 48 = 80 г/моль; в ней 2 атома N: ω(N) = 2 · 14 / 80 = 0,35 = <b>35%</b>.</p></div>
  </section>`));

  // ---------- круговорот ----------
  const cyc = h(`<section id="cycle"><h2>Круговорот азота</h2>
    <p>Нажми на этап схемы, чтобы узнать, что на нём происходит. Важнейшие посредники — бактерии: ${term("nfixation", "азотфиксаторы")}, нитрификаторы, денитрификаторы.</p>
    <div class="card pad"><svg viewBox="0 0 640 400" class="ncy" role="img" aria-label="Схема круговорота азота"></svg><p data-d style="margin:8px 0 0"></p></div>
    <style>
      .ncy{width:100%;display:block}
      .ncy .nd rect{fill:var(--surface-2);stroke:var(--line-2);stroke-width:1.5;transition:stroke .2s}
      .ncy .nd{cursor:pointer}.ncy .nd:hover rect,.ncy .nd.on rect{stroke:var(--accent);stroke-width:2.5}
      .ncy .nd text{fill:var(--text);font-size:18px;font-weight:700;text-anchor:middle}
      .ncy .ar{stroke:var(--accent);stroke-width:2;fill:none;marker-end:url(#ncyArr)}
      .ncy .al{fill:var(--text-2);font-size:15px;text-anchor:middle}
    </style>
  </section>`);
  el.appendChild(cyc);
  const s = cyc.querySelector("svg");
  let inner = `<defs><marker id="ncyArr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0L10,5L0,10z" style="fill:var(--accent)"/></marker></defs>`;
  for (const [a, b, lab] of ARROWS) {
    const A = CYCLE[a], B = CYCLE[b];
    const dx = B.x - A.x, dy = B.y - A.y, L = Math.hypot(dx, dy);
    const sx = A.x + (dx / L) * 70, sy = A.y + (dy / L) * 26, ex = B.x - (dx / L) * 74, ey = B.y - (dy / L) * 28;
    const bend = a === "den" && b === "air" ? -95 : a === "air" && b === "plant" ? -30 : 0;
    const mx = (sx + ex) / 2 - (dy / L) * bend, my = (sy + ey) / 2 + (dx / L) * bend;
    inner += `<path class="ar" d="M${sx},${sy} Q${mx},${my} ${ex},${ey}"/>`;
    if (lab) inner += `<text class="al" x="${B.x + 10}" y="${B.y - 36}">${lab}</text>`;
  }
  for (const [k, n] of Object.entries(CYCLE)) {
    const w = Math.max(140, n.t.length * 11);
    inner += `<g class="nd" data-k="${k}" tabindex="0" role="button"><rect x="${n.x - w / 2}" y="${n.y - 22}" width="${w}" height="44" rx="12"/><text x="${n.x}" y="${n.y + 5}">${n.t}</text></g>`;
  }
  s.innerHTML = inner;
  const pickN = (k) => {
    s.querySelectorAll(".nd").forEach((g) => g.classList.toggle("on", g.dataset.k === k));
    cyc.querySelector("[data-d]").innerHTML = `<b>${CYCLE[k].t}.</b> ${CYCLE[k].d}`;
  };
  s.querySelectorAll(".nd").forEach((g) => { g.onclick = () => pickN(g.dataset.k); g.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pickN(g.dataset.k); } }; });
  pickN("air");
  cyc.appendChild(h(`<div>${kid("Горох, фасоль и клевер — «живые фабрики удобрений». После них в земле остаётся много азота, поэтому опытные огородники сажают их перед капустой или картошкой.", "Это интересно")}</div>`));
}

function drawChart(svg, T, P) {
  const X = (p) => 40 + (Math.log10(p) / 3) * 270, Y = (y) => 150 - y * 135;
  let out = `<line x1="40" y1="150" x2="312" y2="150" stroke="currentColor" opacity=".3"/><line x1="40" y1="12" x2="40" y2="150" stroke="currentColor" opacity=".3"/>`;
  for (const p of [1, 10, 100, 1000]) out += `<text x="${X(p)}" y="164" text-anchor="middle">${p}</text>`;
  for (const y of [0, 0.5, 1]) out += `<text x="34" y="${Y(y) + 3}" text-anchor="end">${y * 100}%</text>`;
  const curves = [[300, "#e0a030"], [450, "#3d6bff"], [600, "#e0302a"], [T, "var(--accent)"]];
  curves.forEach(([t, c], i) => {
    let d = "";
    for (let k = 0; k <= 60; k++) { const p = 10 ** (k / 20); d += (k ? "L" : "M") + X(p).toFixed(1) + "," + Y(nh3Yield(t, p).y).toFixed(1); }
    out += `<path d="${d}" fill="none" stroke="${c}" stroke-width="${i === 3 ? 3 : 1.5}" ${i === 3 ? "" : 'stroke-dasharray="4 3"'}/>`;
    if (i < 3) out += `<text x="${X(1000) - 2}" y="${Y(nh3Yield(t, 1000).y) - 4}" text-anchor="end">${t} °C</text>`;
  });
  out += `<circle cx="${X(P)}" cy="${Y(nh3Yield(T, P).y)}" r="5" fill="var(--accent)"/><text x="176" y="12" text-anchor="middle">выход NH₃ от давления (атм)</text>`;
  svg.innerHTML = out;
}

// ---------- 3D: реактор ----------
function buildReactor(v) {
  const kit = makeKit();
  const root = new THREE.Group();
  v.scene.add(root);
  const boxMat = new THREE.LineBasicMaterial({ color: 0x6ea8ff, transparent: true, opacity: 0.5 });
  const box = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(2, 2, 2)), boxMat);
  root.add(box);
  const R = rng(5);
  const mk = (kind) => {
    const m = kind === "N2" ? diatomicModel("N", 1.1, 3) : kind === "H2" ? diatomicModel("H", 0.74, 1) : PRODUCTS.NH3();
    const g = ballStick(kit, m.atoms, m.bonds, { bondR: 0.07 });
    root.add(g);
    return { g, kind, p: new THREE.Vector3((R() - 0.5) * 8, (R() - 0.5) * 6, (R() - 0.5) * 6), v: new THREE.Vector3(R() - 0.5, R() - 0.5, R() - 0.5).normalize(), spin: new THREE.Vector3(R(), R(), R()) };
  };
  const pool = { N2: Array.from({ length: 12 }, () => mk("N2")), H2: Array.from({ length: 36 }, () => mk("H2")), NH3: Array.from({ length: 24 }, () => mk("NH3")) };
  let half = new THREE.Vector3(5, 3.5, 3.5), speed = 2;
  const all = [...pool.N2, ...pool.H2, ...pool.NH3];
  v.onFrame((dt, t) => {
    for (const m of all) {
      if (!m.g.visible) continue;
      m.p.addScaledVector(m.v, dt * speed);
      for (const k of ["x", "y", "z"]) {
        const lim = half[k] - 0.6;
        if (m.p[k] > lim) { m.p[k] = lim; m.v[k] = -Math.abs(m.v[k]); }
        if (m.p[k] < -lim) { m.p[k] = -lim; m.v[k] = Math.abs(m.v[k]); }
      }
      m.g.position.copy(m.p);
      m.g.rotation.set(t * m.spin.x * 2, t * m.spin.y * 2, 0);
    }
  });
  return {
    set(T, P, xi) {
      const nNH3 = 2 * Math.round(12 * xi);
      const show = { N2: 12 - nNH3 / 2, H2: 36 - 1.5 * nNH3, NH3: nNH3 };
      for (const k of Object.keys(pool)) pool[k].forEach((m, i) => (m.g.visible = i < show[k]));
      const s = Math.max(0.55, Math.min(1.5, (100 / P) ** (1 / 6)));
      half = new THREE.Vector3(5.5 * s, 3.8 * s, 3.8 * s);
      box.scale.copy(half);
      speed = 1.2 * Math.sqrt((T + 273) / 723) * 2;
    },
  };
}
function diatomicModel(el, d, order) {
  return { atoms: [{ el, pos: [-d / 2, 0, 0] }, { el, pos: [d / 2, 0, 0] }], bonds: [[0, 1, order]] };
}

export const quiz = [
  { q: "Почему азот воздуха химически инертен?", options: ["Он благородный газ", "В молекуле N₂ очень прочная тройная связь", "Азот — металл", "Его мало в воздухе"], answer: 1, why: "Энергия связи N≡N ≈ 945 кДж/моль — чтобы её разорвать, нужны жёсткие условия." },
  { q: "Как сместить равновесие N₂ + 3H₂ ⇄ 2NH₃ + Q в сторону аммиака?", options: ["Повысить T, понизить p", "Понизить T, повысить p", "Добавить катализатор", "Понизить p"], answer: 1, why: "Реакция экзотермическая и идёт с уменьшением объёма газов. Катализатор равновесие не смещает — только ускоряет его достижение." },
  { q: "Какой газ выделяется при реакции меди с концентрированной HNO₃?", options: ["H₂", "NO", "NO₂", "N₂"], answer: 2, why: "Бурый NO₂. Водород с азотной кислотой не выделяется никогда." },
  { q: "Массовая доля азота в карбамиде (NH₂)₂CO (M = 60 г/моль):", options: ["23%", "35%", "46,7%", "60%"], answer: 2, why: "ω(N) = 28 / 60 ≈ 0,467." },
  { q: "Какая модификация фосфора светится в темноте и самовоспламеняется?", options: ["красный", "белый", "чёрный", "все"], answer: 1, why: "Белый фосфор — напряжённые тетраэдры P₄ с углом 60°, очень реакционноспособен." },
  { q: "Денитрифицирующие бактерии превращают…", options: ["N₂ → NH₃", "NH₄⁺ → NO₃⁻", "NO₃⁻ → N₂", "белки → NH₃"], answer: 2, why: "Денитрификация возвращает азот в атмосферу и замыкает круговорот." },
];
