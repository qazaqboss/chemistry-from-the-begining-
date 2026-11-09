import { h, kid, term, stage } from "../ui.js";
import { createViewer } from "../three/core.js";
import { createCandle } from "../three/fire-candle.js";
import { createReaction } from "../three/reaction.js";

const SIDES = { fuel: "Топливо", o2: "Кислород", heat: "Тепло" };

export async function render(el) {
  el.appendChild(h(`<div>
    <p class="lead">${term("combustion", "Горение")} — это химическая реакция вещества с кислородом, при которой выделяется много тепла и света. Огонь согревал первых людей, готовит нам еду, двигает машины и ракеты. Но он же может быть очень опасен, поэтому важно понимать, как он устроен.</p>
    ${kid("Огонь — не волшебство и не «живое существо». Это очень быстрая реакция: молекулы топлива соединяются с кислородом из воздуха и при этом выделяют тепло и свет.")}
    <div class="callout warn"><b>Важно:</b> все опыты с огнём — только вместе со взрослыми, на негорючей поверхности, подальше от занавесок и бумаги. Волосы убери, рядом держи стакан воды.</div>
  </div>`));

  // ---------- Треугольник огня ----------
  const s1 = h(`<section id="triangle"><h2>Треугольник огня</h2>
    <p>Чтобы что-то горело, нужны сразу <b>три вещи</b>: <b>топливо</b> (то, что горит: воск, дерево, газ), <b>кислород</b> (из воздуха) и <b>тепло</b> (чтобы зажечь и поддерживать реакцию). Это ${term("firetriangle", "треугольник огня")}. Убери любую сторону — и огонь погаснет. Попробуй!</p></section>`);
  el.appendChild(s1);
  const wrap = h(`<div class="fr-wrap"></div>`);
  s1.appendChild(wrap);
  const st = stage(`<div class="overlay"><span data-t style="font-size:1rem"></span><span data-o></span></div>`);
  wrap.appendChild(st);
  const side = h(`<div class="card pad fr-side">
    <svg viewBox="0 0 220 200" style="width:100%;max-width:260px;display:block;margin:0 auto" role="img" aria-label="Треугольник огня">
      <line data-l="fuel" x1="20" y1="180" x2="200" y2="180" stroke-width="10" stroke-linecap="round"/>
      <line data-l="o2" x1="20" y1="180" x2="110" y2="22" stroke-width="10" stroke-linecap="round"/>
      <line data-l="heat" x1="200" y1="180" x2="110" y2="22" stroke-width="10" stroke-linecap="round"/>
      <text x="110" y="198" text-anchor="middle" font-size="13" fill="currentColor">топливо</text>
      <text x="40" y="95" text-anchor="middle" font-size="13" fill="currentColor" transform="rotate(-60 40 95)">кислород</text>
      <text x="180" y="95" text-anchor="middle" font-size="13" fill="currentColor" transform="rotate(60 180 95)">тепло</text>
      <text data-c x="110" y="130" text-anchor="middle" font-size="18" font-weight="800"></text>
    </svg>
    <div style="display:grid;gap:8px;margin-top:10px">
      <button class="btn" type="button" data-a="o2">🫙 Накрыть банкой (нет кислорода)</button>
      <button class="btn" type="button" data-a="fuel">✂️ Убрать топливо (фитиль)</button>
      <button class="btn" type="button" data-a="heat">💧 Охладить водой (нет тепла)</button>
      <button class="btn primary" type="button" data-a="light">🔥 Зажечь снова</button>
      <label class="row small"><input type="checkbox" data-z> Показать зоны пламени</label>
    </div>
    <p data-d class="small" style="margin:10px 0 0"></p>
  </div>`);
  wrap.appendChild(side);
  wrap.appendChild(h(`<style>.fr-wrap{display:grid;grid-template-columns:1.4fr 1fr;gap:16px;align-items:start}.fr-wrap .btn{justify-content:flex-start}@media (max-width:860px){.fr-wrap{grid-template-columns:1fr}}</style>`));
  const v = createViewer(st, { camera: [0, 0.5, 9.5], target: [0, -0.4, 0], minDistance: 4, maxDistance: 20, autoRotateSpeed: 0.5, fitWidth: 3 });
  const c = createCandle(v);
  const NOTE = {
    o2: "Банка отрезала свечу от свежего воздуха. Пламя тратит кислород внутри банки, становится всё меньше и гаснет. Так тушат огонь одеялом, песком или крышкой.",
    fuel: "Без фитиля расплавленному воску не по чему подниматься к пламени — топлива нет, огонь гаснет. Так пожарные тушат лесной пожар: вырубают просеку, чтобы огню нечего было есть.",
    heat: "Вода забирает тепло: она нагревается и испаряется, и пламя остывает ниже температуры, при которой воск может гореть. Так тушат костёр водой.",
    light: "Все три стороны треугольника на месте — свеча горит.",
  };
  let last = "light";
  const missing = () => ({ fuel: !c.state.fuel, o2: c.state.jar, heat: !c.state.heat });
  const draw = () => {
    const m = missing();
    for (const k of Object.keys(SIDES)) side.querySelector(`[data-l="${k}"]`).setAttribute("stroke", m[k] ? "var(--line-2)" : "var(--warn, #f5a524)");
    side.querySelector("[data-c]").textContent = c.lit ? "🔥 ОГОНЬ" : "нет огня";
    side.querySelector("[data-c]").setAttribute("fill", c.lit ? "var(--warn, #f5a524)" : "currentColor");
    st.querySelector("[data-t]").innerHTML = `<b>${c.lit ? "Свеча горит" : "Пламя погасло"}</b>`;
    st.querySelector("[data-o]").textContent = c.state.jar ? `кислорода в банке: ${Math.round(14 + c.state.o2 * 7)}%` : "";
  };
  side.querySelectorAll("[data-a]").forEach((b) => (b.onclick = () => {
    const a = b.dataset.a; last = a;
    if (a === "o2") c.oxygen(true);
    if (a === "fuel") c.fuel(false);
    if (a === "heat") c.cool();
    if (a === "light") c.relight();
    side.querySelector("[data-d]").textContent = NOTE[a];
    draw();
  }));
  side.querySelector("[data-z]").onchange = (e) => c.zones(e.target.checked);
  side.querySelector("[data-d]").textContent = NOTE[last];
  let acc = 0;
  v.onFrame((dt) => { acc += dt; if (acc > 0.25) { acc = 0; draw(); } });
  draw();
  s1.appendChild(h(`<p class="small muted" style="margin-top:10px">Свеча в банке гаснет, когда кислорода остаётся примерно 15–16% (а не ноль): при меньшей доле реакция уже не даёт достаточно тепла, чтобы поддерживать себя.</p>`));

  // ---------- Свеча ----------
  el.appendChild(h(`<section id="candle"><h2>Что на самом деле горит в свече</h2>
    <p>Свеча сделана из парафина — смеси длинных молекул из углерода и водорода (например, C₂₅H₅₂). Твёрдый воск сам не горит! Вот что происходит:</p>
    <ol>
      <li>Тепло пламени плавит воск у фитиля — образуется лужица.</li>
      <li>Жидкий воск поднимается по фитилю, как вода по салфетке.</li>
      <li>У верхушки фитиля воск испаряется — <b>горят именно пары воска</b>, смешиваясь с кислородом воздуха.</li>
    </ol>
    <div class="grid-2">
      <div class="card pad"><b>Тёмная зона</b> внизу, у фитиля: там пары воска, а кислорода мало — они ещё не горят (≈600 °C).</div>
      <div class="card pad"><b>Яркая жёлтая зона</b>: топливо сгорает не полностью, образуются крошечные частички сажи (углерода). Раскалённые до 1200 °C, они светятся — как спираль лампочки.</div>
    </div>
    <p style="margin-top:12px">Снаружи пламени, где много кислорода, всё догорает до конца — эта тонкая голубоватая оболочка самая горячая (≈1400 °C). Поэтому в газовой горелке, где газ заранее смешан с воздухом, пламя голубое и почти не светится.</p>
    <div class="card pad"><b>Опыт со взрослым: свеча из дыма</b><p class="small" style="margin:0">Задуй свечу и сразу поднеси горящую спичку к струйке белого «дыма» в 1–2 см над фитилём. Огонь пробежит по струйке вниз и снова зажжёт свечу! Этот «дым» — пары воска, а они горючие. Опыт придумал Майкл Фарадей почти 200 лет назад.</p></div>
  </section>`));

  // ---------- Продукты ----------
  const s3 = h(`<section id="products"><h2>Куда исчезает топливо</h2>
    <p>Свеча становится всё меньше, а дерево в костре превращается в горстку золы. Но вещество не исчезает — оно превращается в газы, которые улетают в воздух. Когда горит вещество из углерода и водорода, получаются <b>углекислый газ</b> и <b>вода</b> (в виде пара). Посмотри, как горит самое простое топливо — метан, бытовой газ на кухне:</p></section>`);
  el.appendChild(s3);
  const st2 = stage(`<div class="overlay"><span><b>CH₄ + 2O₂ → CO₂ + 2H₂O</b></span><span data-s></span></div>`, { wide: true });
  s3.appendChild(st2);
  const c2 = h(`<div class="card pad" style="margin-top:10px"><label class="ctl">Ход реакции<input type="range" min="0" max="1" step="0.01" value="0"></label><div class="row" style="margin-top:8px"><button class="btn small" type="button" data-play>▶ Показать</button></div></div>`);
  s3.appendChild(c2);
  const v2 = createViewer(st2, { camera: [0, 1, 11], minDistance: 4, maxDistance: 30, autoRotateSpeed: 0.3, fitWidth: 4.6 });
  const rx = createReaction(v2);
  rx.load("methane");
  const range = c2.querySelector("input");
  let playing = false;
  const name = (t) => (t < 0.05 ? "метан и кислород" : t < 0.35 ? "молекулы сближаются" : t < 0.6 ? "связи рвутся" : t < 0.95 ? "атомы соединяются по-новому" : "углекислый газ и вода");
  const setT = (t) => { rx.setT(t); range.value = t; st2.querySelector("[data-s]").textContent = name(t); };
  range.oninput = () => { playing = false; setT(+range.value); };
  c2.querySelector("[data-play]").onclick = () => { if (rx.t >= 0.999) setT(0); playing = true; };
  v2.onFrame((dt) => { if (playing) { const t = Math.min(1, rx.t + dt / 4); setT(t); if (t >= 1) playing = false; } });
  setT(0);
  s3.appendChild(h(`<p>Посчитай атомы: до реакции 1 углерод, 4 водорода и 4 кислорода — и после столько же. Атомы просто поменяли партнёров. Энергия, которая выделилась при этом, и есть тепло и свет пламени.</p>`));
  s3.appendChild(h(`<div class="card pad"><b>Опыт со взрослым: что в пламени</b><p class="small" style="margin:0">Подержи над свечой (высоко, 10–15 см!) холодную сухую ложку — она запотеет: это вода из пламени. Опусти ложку в яркую часть пламени на секунду — появится чёрная сажа: это несгоревший углерод.</p></div>`));

  // ---------- Безопасность ----------
  el.appendChild(h(`<section id="safety"><h2>Как тушить огонь правильно</h2>
    <div class="table-wrap"><table class="data">
      <tr><th>Что горит</th><th>Как тушить</th><th>Какая сторона треугольника убрана</th></tr>
      <tr><td>Бумага, дерево</td><td>водой</td><td>тепло (и немного кислород)</td></tr>
      <tr><td>Масло на сковороде</td><td>накрыть крышкой, выключить плиту. <b>Никогда не лить воду!</b></td><td>кислород</td></tr>
      <tr><td>Электроприбор</td><td>выдернуть вилку, огнетушитель (не вода!)</td><td>тепло/кислород</td></tr>
      <tr><td>Газовая конфорка</td><td>закрыть кран</td><td>топливо</td></tr>
    </table></div>
    <div class="callout warn"><b>Почему нельзя лить воду на масло:</b> вода тяжелее масла, она проваливается на дно раскалённой сковороды, мгновенно вскипает, и пар выбрасывает горящее масло огненным шаром.</div>
    ${kid("Если что-то загорелось — не прячься и не туши сам большой огонь. Сразу зови взрослых и уходи. Номер пожарных — 101 (или 112 с мобильного).", "Запомни")}
  </section>`));
}

export const quiz = [
  { q: "Какие три вещи нужны для горения?", options: ["топливо, кислород, тепло", "вода, воздух, свет", "азот, кислород, тепло", "топливо, вода, ветер"], answer: 0, why: "Это треугольник огня: без любой из сторон огонь гаснет." },
  { q: "Почему свеча под банкой гаснет?", options: ["в банке темно", "кончается кислород", "банка холодная", "воск замерзает"], answer: 1, why: "Свежий воздух не поступает, а кислород в банке расходуется." },
  { q: "Что на самом деле горит в свече?", options: ["фитиль", "твёрдый воск", "пары воска", "воздух"], answer: 2, why: "Воск плавится, поднимается по фитилю и испаряется — горят пары." },
  { q: "Почему пламя свечи жёлтое и яркое?", options: ["в нём светятся раскалённые частички сажи", "воск жёлтый", "так светится кислород", "из-за фитиля"], answer: 0, why: "Несгоревший углерод раскаляется до ~1200 °C и светится." },
  { q: "Что получается при полном сгорании метана CH₄?", options: ["сажа и водород", "углекислый газ и вода", "кислород и вода", "ничего — он исчезает"], answer: 1, why: "CH₄ + 2O₂ → CO₂ + 2H₂O. Атомы не исчезают." },
  { q: "Как тушить горящее масло на сковороде?", options: ["залить водой", "накрыть крышкой", "подуть", "посыпать сахаром"], answer: 1, why: "Крышка перекрывает доступ кислорода. Вода вызовет выброс горящего масла." },
];
