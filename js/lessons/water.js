import { h, kid, term, stage } from "../ui.js";
import { createViewer } from "../three/core.js";
import { createWaterPair, createIceWater, createWaterCycle } from "../three/water-ice.js";
import { fmt } from "../chem.js";

// Плотность воды, г/см³ (справочные данные)
const RHO = [[0, 0.99984], [1, 0.9999], [2, 0.99994], [3, 0.99996], [4, 0.99997], [5, 0.99996], [6, 0.99994], [8, 0.99985], [10, 0.9997], [12, 0.9995], [15, 0.99910], [20, 0.99820], [25, 0.99705]];

const STATES = [
  { t: "Лёд", d: "Каждая молекула держится водородными связями ровно за четырёх соседей (два раза «даёт» свой водород, два раза «принимает» чужой). Получается ажурная решётка с шестиугольными каналами — посмотри на неё сверху. Пустоты делают лёд лёгким: 0,92 г/см³." },
  { t: "Вода", d: "При 0 °C часть водородных связей рвётся, решётка рушится, и молекулы упаковываются плотнее: 1,00 г/см³. Связи всё время рвутся и тут же возникают снова — миллиарды раз за секунду." },
  { t: "Пар", d: "При кипении молекулы вырываются на свободу и разлетаются далеко друг от друга. Водородных связей между ними почти нет. Пар занимает в 1700 раз больший объём, чем та же вода." },
];

export async function render(el) {
  el.appendChild(h(`<div>
    <p class="lead">Вода — самое привычное и одновременно самое странное вещество на Земле. Её твёрдая форма легче жидкой, она растворяет больше веществ, чем любая другая жидкость, и встречается в природе сразу в трёх состояниях: льдом, водой и паром.</p>
    ${kid("Молекула воды похожа на голову Микки-Мауса: большой кислород и два маленьких «уха»-водорода. Эти молекулы любят держаться друг за друга — и из-за этого у воды столько чудес!")}
  </div>`));

  // ---------- Молекула ----------
  const s1 = h(`<section id="molecule"><h2>Молекула воды</h2>
    <p>Формула воды — H₂O: один атом кислорода и два атома водорода. Молекула не прямая, а изогнутая уголком: угол между связями 104,5°. Кислород сильнее тянет к себе общие электроны, поэтому на нём собирается небольшой отрицательный заряд (δ−), а на водородах — положительный (δ+). Такую молекулу называют <b>полярной</b>: у неё есть «минус-сторона» и «плюс-сторона».</p></section>`);
  el.appendChild(s1);
  const st1 = stage(`<div class="overlay"><span><b>H₂O</b> · O–H 0,96 Å · угол 104,5°</span><span data-p></span></div>`);
  s1.appendChild(st1);
  const c1 = h(`<div class="card pad" style="margin-top:10px"><div class="seg"><button type="button" class="on" data-p="0">Одна молекула</button><button type="button" data-p="1">Добавить соседа</button></div>
    <p class="small" style="margin:10px 0 0">Розовые облачка — две неподелённые пары электронов кислорода. Плюс-водород одной молекулы притягивается к минус-облачку другой — это и есть ${term("hbond", "водородная связь")}: в 20 раз слабее обычной химической связи, но её хватает, чтобы молекулы «держались за руки».</p></div>`);
  s1.appendChild(c1);
  const v1 = createViewer(st1, { camera: [0, 0.6, 7], minDistance: 3, maxDistance: 16, autoRotateSpeed: 0.7 });
  const pair = createWaterPair(v1);
  c1.querySelectorAll("[data-p]").forEach((b) => (b.onclick = () => {
    c1.querySelectorAll("[data-p]").forEach((x) => x.classList.toggle("on", x === b));
    pair.pair(b.dataset.p === "1");
    st1.querySelector("[data-p]").textContent = b.dataset.p === "1" ? "O···O ≈ 2,8 Å" : "";
  }));

  // ---------- Лёд и вода ----------
  const s2 = h(`<section id="ice"><h2>Лёд, вода и пар изнутри</h2>
    <p>Перед тобой 72 молекулы воды. Голубые пунктиры — водородные связи. Переключай состояния и смотри, что происходит со связями.</p></section>`);
  el.appendChild(s2);
  const st2 = stage(`<div class="overlay"><span data-t style="font-size:1rem"></span><span data-b></span></div>`, { wide: true });
  s2.appendChild(st2);
  const c2 = h(`<div class="card pad" style="margin-top:10px">
    <div class="row"><div class="seg">${STATES.map((s, i) => `<button type="button" data-s="${i}"${i ? "" : ' class="on"'}>${s.t}</button>`).join("")}</div>
    <button class="btn small" type="button" data-top>Взгляд сверху: шестиугольники</button></div>
    <p data-d style="margin:12px 0 0"></p></div>`);
  s2.appendChild(c2);
  const v2 = createViewer(st2, { camera: [7, 5, 11], minDistance: 5, maxDistance: 40, autoRotateSpeed: 0.4, fitWidth: 4.2 });
  const ice = createIceWater(v2);
  let cur = 0;
  const showS = (i) => {
    cur = i; ice.set(i);
    st2.querySelector("[data-t]").innerHTML = `<b>${STATES[i].t}</b>`;
    c2.querySelector("[data-d]").textContent = STATES[i].d;
    c2.querySelectorAll("[data-s]").forEach((b) => b.classList.toggle("on", +b.dataset.s === i));
  };
  c2.querySelectorAll("[data-s]").forEach((b) => (b.onclick = () => showS(+b.dataset.s)));
  c2.querySelector("[data-top]").onclick = () => {
    showS(0);
    v2.controls.autoRotate = false;
    const d = v2.camera.position.distanceTo(v2.controls.target);
    v2.camera.position.set(0, d, 0.001);
    v2.controls.update();
  };
  showS(0);
  v2.onFrame(() => { st2.querySelector("[data-b]").textContent = `водородных связей: ${ice.bonds}`; });

  // ---------- Почему лёд плавает ----------
  const s3 = h(`<section id="floats"><h2>Почему лёд плавает</h2>
    <p>Почти все вещества, замерзая, сжимаются: твёрдый воск тонет в расплавленном. А вода, замерзая, <b>расширяется</b> примерно на 9%. Значит, один литр льда весит меньше, чем литр воды, — у льда меньше ${term("density", "плотность")} (0,92 против 1,00 г/см³), и он всплывает. Над водой видна лишь десятая часть айсберга.</p>
    <p>Ещё одна странность: самая плотная вода — не ледяная, а при <b>+4 °C</b>. Подвигай ползунок:</p>
    <div class="card pad">
      <svg viewBox="0 0 520 220" style="width:100%;height:auto;display:block" role="img" aria-label="График плотности воды от температуры"><g data-g></g></svg>
      <label class="ctl">Температура: <b data-tv></b><input type="range" min="0" max="25" step="1" value="4"></label>
      <p data-rv class="small" style="margin:8px 0 0"></p>
    </div>
    <p style="margin-top:14px">Зимой вода в пруду остывает, при 4 °C самая тяжёлая вода опускается на дно и там остаётся. Сверху вода охлаждается дальше и замерзает. Лёд — как одеяло: он не даёт замёрзнуть всему пруду, и рыбы спокойно зимуют на дне при +4 °C.</p>
    <div class="callout warn"><b>Важно:</b> расширяясь, лёд разрывает бутылки, трубы и даже камни. Не клади стеклянную бутылку с водой в морозилку!</div>
  </section>`);
  el.appendChild(s3);
  {
    const g = s3.querySelector("[data-g]");
    const X = (t) => 50 + (t / 25) * 450, Y = (r) => 190 - ((r - 0.997) / 0.0031) * 170;
    const path = RHO.map(([t, r], i) => `${i ? "L" : "M"}${X(t).toFixed(1)},${Y(r).toFixed(1)}`).join(" ");
    const ticks = [0, 5, 10, 15, 20, 25].map((t) => `<text x="${X(t)}" y="208" font-size="11" text-anchor="middle" fill="currentColor" opacity=".7">${t} °C</text>`).join("");
    const yt = [0.997, 0.998, 0.999, 1.0].map((r) => `<line x1="50" x2="500" y1="${Y(r)}" y2="${Y(r)}" stroke="currentColor" opacity=".12"/><text x="44" y="${Y(r) + 4}" font-size="11" text-anchor="end" fill="currentColor" opacity=".7">${fmt(r, 3)}</text>`).join("");
    g.innerHTML = `${yt}${ticks}<path d="${path}" fill="none" stroke="var(--accent)" stroke-width="3"/><circle data-pt r="7" fill="var(--warn, #f5a524)"/><text x="54" y="16" font-size="11" fill="currentColor" opacity=".7">плотность, г/см³</text>`;
    const inp = s3.querySelector("input"), pt = g.querySelector("[data-pt]");
    const rho = (t) => { for (let i = 1; i < RHO.length; i++) if (t <= RHO[i][0]) { const [t0, r0] = RHO[i - 1], [t1, r1] = RHO[i]; return r0 + ((r1 - r0) * (t - t0)) / (t1 - t0); } return RHO.at(-1)[1]; };
    const upd = () => {
      const t = +inp.value, r = rho(t);
      pt.setAttribute("cx", X(t)); pt.setAttribute("cy", Y(r));
      s3.querySelector("[data-tv]").textContent = `${t} °C`;
      s3.querySelector("[data-rv]").innerHTML = `Плотность воды при ${t} °C: <b>${fmt(r, 5)} г/см³</b>. ${t === 4 ? "Это максимум!" : t < 4 ? "Холоднее 4 °C вода снова становится легче: в ней уже появляются «ледяные» ажурные группы молекул." : "Чем теплее, тем быстрее молекулы и тем дальше они друг от друга."} Лёд при 0 °C: 0,9167 г/см³.`;
    };
    inp.oninput = upd; upd();
  }

  // ---------- Растворитель ----------
  el.appendChild(h(`<section id="solvent"><h2>Вода — великий растворитель</h2>
    <p>Полярные молекулы воды облепляют частицы соли или сахара своими «плюс-» и «минус-сторонами» и растаскивают их. Поэтому в воде растворяется очень многое: соль, сахар, сода, газы (кислород, которым дышат рыбы). А вот жир и масло не растворяются: их молекулы неполярные, и воде не за что их «ухватить».</p>
    <div class="card pad"><b>Опыт: перец убегает</b>
      <ol class="small"><li>Насыпь в тарелку с водой молотый чёрный перец — он плавает на поверхности.</li><li>Капни в центр каплю жидкого мыла.</li></ol>
      <p class="small" style="margin:0">Перец мгновенно разбегается к краям! Молекулы воды на поверхности крепко держатся друг за друга водородными связями — получается упругая «плёнка» (поверхностное натяжение). Мыло ослабляет плёнку в центре, а края тянут её — вместе с перцем — к себе. Благодаря той же плёнке водомерки бегают по пруду.</p>
    </div>
    <p class="adv" style="margin-top:12px">Водородные связи объясняют и необычно высокую температуру кипения воды: похожие по размеру молекулы H₂S кипят при −60 °C, а вода — при +100 °C. Без водородных связей вода на Земле была бы газом, и жизни, какой мы её знаем, не было бы.</p>
  </section>`));

  // ---------- Круговорот ----------
  const s5 = h(`<section id="cycle"><h2>Круговорот воды</h2>
    <p>Вода на Земле не исчезает и не появляется заново — она ходит по кругу. Солнце нагревает моря, вода испаряется. Пар поднимается, охлаждается и ${term("condensation", "конденсируется")} в крошечные капельки — так рождаются облака. Капли сливаются, тяжелеют и падают дождём или снегом. Ручьи и реки несут воду обратно в море.</p></section>`);
  el.appendChild(s5);
  const st5 = stage(`<div class="overlay"><span><b>Круговорот воды</b></span><span data-h></span></div>`, { wide: true });
  s5.appendChild(st5);
  const c5 = h(`<div class="card pad" style="margin-top:10px"><label class="ctl">Солнце греет сильнее<input type="range" min="0.3" max="2" step="0.1" value="1"></label></div>`);
  s5.appendChild(c5);
  const v5 = createViewer(st5, { camera: [0, 5, 14], target: [0, 2, 0], minDistance: 6, maxDistance: 30, autoRotateSpeed: 0.3, fitWidth: 6.5 });
  const cyc = createWaterCycle(v5);
  const hi = c5.querySelector("input");
  const updH = () => { cyc.heat(+hi.value); st5.querySelector("[data-h]").textContent = +hi.value > 1.4 ? "жарко: испарение и ливни сильнее" : +hi.value < 0.6 ? "прохладно: всё идёт медленно" : "обычный день"; };
  hi.oninput = updH; updH();
  s5.appendChild(h(kid("Вода, которую ты пьёшь сегодня, когда-то могла быть в облаке над океаном, в айсберге или даже в луже, из которой пил динозавр! Вода путешествует по кругу уже миллиарды лет.")));
}

export const quiz = [
  { q: "Какой угол между связями в молекуле воды?", options: ["180°", "120°", "104,5°", "90°"], answer: 2, why: "Неподелённые пары кислорода сжимают угол со 109,5° до 104,5°." },
  { q: "Почему лёд плавает в воде?", options: ["в нём есть воздух", "его плотность меньше, чем у воды", "он холодный", "он твёрже воды"], answer: 1, why: "Водородные связи держат молекулы льда в ажурной решётке с пустотами — 0,92 г/см³ против 1,00." },
  { q: "При какой температуре вода самая плотная?", options: ["0 °C", "+4 °C", "+20 °C", "+100 °C"], answer: 1, why: "Поэтому на дне замёрзшего озера вода остаётся +4 °C." },
  { q: "Что такое водородная связь?", options: ["связь двух атомов водорода", "притяжение δ+ водорода одной молекулы к кислороду другой", "связь в молекуле H₂", "магнитное притяжение"], answer: 1, why: "Она слабее обычной химической связи, но именно она держит молекулы воды вместе." },
  { q: "Как образуется облако?", options: ["водяной пар охлаждается и конденсируется в капельки", "из дыма", "вода закипает в небе", "ветер поднимает брызги моря"], answer: 0, why: "Пар невидим; облако — это множество крошечных капелек или льдинок." },
  { q: "Почему масло не растворяется в воде?", options: ["оно тяжёлое", "его молекулы неполярные — воде не за что их ухватить", "оно горячее", "масло — не вещество"], answer: 1, why: "«Подобное растворяется в подобном»: полярная вода растворяет полярные и ионные вещества." },
];
