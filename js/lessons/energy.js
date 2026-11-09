import { h, kid, term, stage, chips } from "../ui.js";
import { createViewer } from "../three/core.js";
import { createHill } from "../three/energy-hill.js";
import { createCalorimeter } from "../three/energy-calorimeter.js";
import { fmt } from "../chem.js";

// Теплота сгорания (кДж/моль, продукт — жидкая вода) и молярная масса
const FUELS = [
  { id: "H2", label: "Водород H₂", M: 2.016, Q: 286, eq: "2H₂ + O₂ → 2H₂O + 572 кДж", flame: 0x9fd8ff },
  { id: "CH4", label: "Метан CH₄", M: 16.04, Q: 890, eq: "CH₄ + 2O₂ → CO₂ + 2H₂O + 890 кДж", flame: 0x4dabf7 },
  { id: "C2H5OH", label: "Этанол C₂H₅OH", M: 46.07, Q: 1367, eq: "C₂H₅OH + 3O₂ → 2CO₂ + 3H₂O + 1367 кДж", flame: 0x748ffc },
  { id: "C", label: "Уголь C", M: 12.01, Q: 393.5, eq: "C + O₂ → CO₂ + 393,5 кДж", flame: 0xff922b },
];

export async function render(el) {
  el.appendChild(h(`<div>
    <p class="lead">Любая химическая реакция — это не только превращение веществ, но и обмен энергией. Одни реакции греют (горение, гашение извести), другие охлаждают (растворение селитры, разложение известняка). Разберёмся, откуда берётся это тепло и как его считать.</p>
    ${kid("Когда атомы расстаются, нужно потратить силы — как разорвать магнитики. Когда они соединяются, силы освобождаются — щёлк! — и выделяется тепло. Если «щёлков» больше, чем «разрываний», реакция греет. Если наоборот — холодит.")}
  </div>`));

  el.appendChild(h(`<section id="exo-endo"><h2>Экзо и эндо</h2>
    <p>Чтобы разорвать химическую связь, энергию надо <b>затратить</b>; когда связь образуется, энергия <b>выделяется</b>. Итог реакции зависит от того, что больше.</p>
    <div class="grid-2">
      <div class="card pad"><h3 class="mt0">${term("exotherm", "Экзотермические")}</h3><p class="small">Энергия выделяется в окружающую среду: смесь нагревается, часто видно пламя или свет. Продукты «беднее» энергией, чем реагенты: ΔH &lt; 0.</p><p class="small muted">Горение, дыхание, нейтрализация, гашение извести CaO + H₂O, ржавление железа (медленно).</p></div>
      <div class="card pad"><h3 class="mt0">${term("endotherm", "Эндотермические")}</h3><p class="small">Энергия поглощается: реакцию надо всё время нагревать или освещать. Продукты «богаче» энергией: ΔH &gt; 0.</p><p class="small muted">Разложение CaCO₃ при обжиге, фотосинтез, разложение воды электролизом, N₂ + O₂ → 2NO в молнии.</p></div>
    </div>
    <p style="margin-top:14px">Количество теплоты, которое выделяется или поглощается в реакции, называют ${term("heat_effect", "тепловым эффектом")} (Q, кДж). В термодинамике используют <b>изменение энтальпии ΔH</b>: у экзотермических реакций ΔH = −Q, то есть знак противоположный.</p>
    <div class="callout"><b>Важно не путать знаки.</b> «+ 572 кДж» в правой части уравнения и «ΔH = −572 кДж» означают одно и то же: тепло ушло из системы наружу. В школьных задачах ОГЭ обычно пишут Q в уравнении.</div>
  </section>`));

  // ---------- 3D-горка ----------
  const sec = h(`<section id="hill"><h2>Энергетическая горка в 3D</h2>
    <p>Даже экзотермическая реакция не начинается сама: спичку нужно чиркнуть, газ — поджечь. Частицам надо сначала «забраться на горку» — преодолеть ${term("activation", "энергию активации")} Eₐ. На вершине находится неустойчивое <b>переходное состояние</b>: старые связи наполовину разорваны, новые наполовину образованы.</p>
    <p>Шарик — это частицы реагентов. Задай высоту барьера и энергию толчка (нагрев) и нажми «Толкнуть». Если энергии меньше барьера, шарик скатится обратно — реакция не пошла.</p>
  </section>`);
  el.appendChild(sec);
  const chipBox = h(`<div style="margin-bottom:10px"></div>`);
  sec.appendChild(chipBox);
  const st = stage(`<div class="overlay"><span data-kind></span><span data-res></span></div>`, { wide: true });
  sec.appendChild(st);
  const ctl = h(`<div class="card pad" style="margin-top:10px">
    <div class="grid-2" style="gap:12px">
      <label class="ctl">Тепловой эффект |ΔH|: <b data-dhv></b><input type="range" min="20" max="300" step="10" value="200" data-dh></label>
      <label class="ctl">Энергия активации Eₐ: <b data-eav></b><input type="range" min="40" max="400" step="10" value="150" data-ea></label>
      <label class="ctl">Энергия толчка (нагрев): <b data-kv></b><input type="range" min="0" max="450" step="10" value="120" data-k></label>
      <label class="row small" style="align-self:end"><input type="checkbox" data-cat> Добавить ${term("catalyst", "катализатор")} (барьер ниже в 2 раза)</label>
    </div>
    <div class="row" style="margin-top:12px"><button class="btn primary" type="button" data-go>▶ Толкнуть</button><span data-msg class="small"></span></div>
  </div>`);
  sec.appendChild(ctl);
  const v = createViewer(st, { camera: [3.5, 3, 14], fitWidth: 6.3, autoRotate: false, minDistance: 6, maxDistance: 34 });
  const hill = createHill(v);
  let sign = -1;
  const q = (s) => ctl.querySelector(s);
  const upd = () => {
    const dh = sign * +q("[data-dh]").value;
    let ea = +q("[data-ea]").value;
    if (q("[data-cat]").checked) ea /= 2;
    if (dh > 0 && ea < dh + 20) ea = dh + 20; // барьер не может быть ниже уровня продуктов
    q("[data-dhv]").textContent = `${fmt(Math.abs(dh), 0)} кДж/моль`;
    q("[data-eav]").textContent = `${fmt(ea, 0)} кДж/моль${q("[data-cat]").checked ? " (с катализатором)" : ""}`;
    q("[data-kv]").textContent = `${q("[data-k]").value} кДж/моль`;
    hill.set({ dH: dh, Ea: ea });
    st.querySelector("[data-kind]").innerHTML = dh < 0 ? `<b>Экзотермическая</b> · ΔH &lt; 0` : `<b>Эндотермическая</b> · ΔH &gt; 0`;
    st.querySelector("[data-res]").textContent = "";
    q("[data-msg]").textContent = "";
    return ea;
  };
  chips(chipBox, [{ label: "Экзо: горение" }, { label: "Эндо: разложение" }], (_, i) => {
    sign = i ? 1 : -1;
    q("[data-dh]").value = i ? 180 : 200;
    q("[data-ea]").value = i ? 240 : 150;
    upd();
  });
  ["[data-dh]", "[data-ea]", "[data-cat]"].forEach((s) => (q(s).oninput = upd));
  q("[data-k]").oninput = () => (q("[data-kv]").textContent = `${q("[data-k]").value} кДж/моль`);
  q("[data-go]").onclick = () => {
    const ea = upd();
    const k = +q("[data-k]").value;
    const res = st.querySelector("[data-res]");
    res.textContent = "частицы движутся…";
    hill.push(k, () => {
      res.innerHTML = `<b>Барьер пройден!</b>`;
      q("[data-msg]").textContent = sign < 0 ? "Реакция пошла: на спуске выделилась энергия, она нагреет соседние частицы — поэтому горение поддерживает само себя." : "Реакция прошла, но продукты выше реагентов: энергию нужно подводить постоянно, иначе процесс остановится.";
    });
    setTimeout(() => {
      if (!hill.crossed) { res.innerHTML = `<b>Не хватило энергии</b>`; q("[data-msg]").textContent = `Толчок ${k} кДж/моль меньше барьера ${fmt(ea, 0)} кДж/моль — шарик скатился обратно. Нагрей сильнее или добавь катализатор.`; }
    }, 2600);
  };
  upd();
  sec.appendChild(h(`<p class="small muted">Катализатор не меняет ни уровень реагентов, ни уровень продуктов — значит, и тепловой эффект тот же. Он лишь открывает «обходную тропинку» с более низким перевалом, поэтому реакция идёт быстрее. Так работают ферменты в клетках и платина в автомобильном нейтрализаторе.</p>`));

  // ---------- Термохимические уравнения ----------
  el.appendChild(h(`<section id="thermo"><h2>Термохимические уравнения</h2>
    <p>${term("thermochem", "Термохимическое уравнение")} — уравнение реакции, в котором указан тепловой эффект. Он относится к <b>тем количествам вещества, что стоят в коэффициентах</b>:</p>
    <div class="eq">2H₂ + O₂ → 2H₂O + 572 кДж</div>
    <p>Это значит: при сгорании <b>2 моль</b> водорода (4 г) выделяется 572 кДж. Сгорит 1 моль — выделится вдвое меньше, 286 кДж. Тепловой эффект пропорционален количеству вещества — на этом построены все задачи.</p>
    <div class="card pad">
      <p class="mt0"><b>Задача (тип ОГЭ).</b> По уравнению CH₄ + 2O₂ → CO₂ + 2H₂O + 890 кДж вычислите, сколько теплоты выделится при сгорании 48 г метана.</p>
      <ol>
        <li>M(CH₄) = 12 + 4·1 = 16 г/моль.</li>
        <li>n(CH₄) = m / M = 48 / 16 = 3 моль.</li>
        <li>По уравнению: 1 моль CH₄ — 890 кДж, значит 3 моль — x кДж.</li>
        <li>x = 3 · 890 = <b>2670 кДж</b>.</li>
      </ol>
      <p class="small muted mt0">Обратная задача: сколько метана сжечь, чтобы получить 445 кДж? n = 445 / 890 = 0,5 моль → m = 0,5 · 16 = 8 г.</p>
    </div>
    <div class="callout adv">Строже тепловой эффект зависит от агрегатного состояния: 2H₂ + O₂ = 2H₂O(ж) даёт 572 кДж, а если вода получается паром — около 484 кДж, ведь часть энергии ушла на испарение. Поэтому в точных уравнениях пишут (г), (ж), (тв). Закон Гесса: тепловой эффект не зависит от пути, только от начального и конечного состояния.</div>
  </section>`));

  // ---------- Калориметр ----------
  const cal = h(`<section id="calorimeter"><h2>Калориметр: измеряем тепло</h2>
    <p>Как узнать, сколько энергии даёт топливо? Сжечь его под сосудом с водой и посмотреть, на сколько нагрелась вода. На нагрев 1 г воды на 1 °C нужно 4,18 Дж — это <b>удельная теплоёмкость</b> воды c.</p>
    <div class="eq">Q = c · m(воды) · ΔT</div>
  </section>`);
  el.appendChild(cal);
  const fBox = h(`<div style="margin-bottom:10px"></div>`);
  cal.appendChild(fBox);
  const st2 = stage(`<div class="overlay"><span data-fuel></span><span data-t></span></div>`);
  cal.appendChild(st2);
  const c2 = h(`<div class="card pad" style="margin-top:10px">
    <div class="grid-2" style="gap:12px">
      <label class="ctl">Масса топлива: <b data-mv></b><input type="range" min="0.1" max="3" step="0.1" value="1" data-m></label>
      <label class="ctl">Масса воды: <b data-wv></b><input type="range" min="100" max="1000" step="50" value="500" data-w></label>
    </div>
    <div class="row" style="margin-top:12px"><button class="btn primary" type="button" data-burn>🔥 Сжечь</button><button class="btn" type="button" data-reset>Сбросить</button></div>
    <div data-out style="margin-top:12px"></div>
  </div>`);
  cal.appendChild(c2);
  const v2 = createViewer(st2, { camera: [3, 3.2, 11], target: [0, 1.1, 0], minDistance: 4, maxDistance: 20, autoRotateSpeed: 0.4 });
  const calo = createCalorimeter(v2);
  let fuel = FUELS[1], anim = null;
  const g = (s) => c2.querySelector(s);
  const calc = () => {
    const m = +g("[data-m]").value, mw = +g("[data-w]").value;
    const n = m / fuel.M, Q = n * fuel.Q; // кДж
    const dT = (Q * 1000) / (4.18 * mw);
    g("[data-mv]").textContent = `${fmt(m, 1)} г`;
    g("[data-wv]").textContent = `${mw} г`;
    return { m, mw, n, Q, dT };
  };
  const show = (done) => {
    const r = calc();
    const T = 20 + r.dT;
    g("[data-out]").innerHTML = `<p class="formula small mt0">${fuel.eq}</p>
      <p class="mt0">n = ${fmt(r.m, 1)} / ${fmt(fuel.M, 2)} = ${fmt(r.n, 4)} моль → Q = ${fmt(r.n, 4)} · ${fmt(fuel.Q, 1)} ≈ <b>${fmt(r.Q, 1)} кДж</b>.<br>
      ΔT = Q / (c·m) = ${fmt(r.Q * 1000, 0)} / (4,18 · ${r.mw}) ≈ <b>${fmt(r.dT, 1)} °C</b>${done ? ` → вода нагреется до ${T >= 100 ? "кипения (100 °C), остаток тепла уйдёт на испарение" : fmt(T, 1) + " °C"}` : ""}.</p>
      <p class="small muted mt0">На 1 г: ${fmt(fuel.Q / fuel.M, 1)} кДж/г. В настоящем опыте часть тепла уходит в воздух и стекло, поэтому вода нагревается слабее расчёта.</p>`;
  };
  const reset = () => { anim = null; calo.set({ T: 20, fuelLeft: 1, burning: false, waterH: 0.6 + (+g("[data-w]").value / 1000) * 1.8, flame: fuel.flame }); st2.querySelector("[data-t]").textContent = "20 °C"; show(false); };
  chips(fBox, FUELS, (f) => { fuel = f; st2.querySelector("[data-fuel]").innerHTML = `<b>${f.label}</b>`; reset(); }, 1);
  st2.querySelector("[data-fuel]").innerHTML = `<b>${fuel.label}</b>`;
  g("[data-m]").oninput = g("[data-w]").oninput = reset;
  g("[data-reset]").onclick = reset;
  g("[data-burn]").onclick = () => { reset(); anim = { t: 0, dT: calc().dT }; calo.set({ burning: true }); };
  v2.onFrame((dt) => {
    if (!anim) return;
    anim.t = Math.min(1, anim.t + dt / 3.5);
    const T = Math.min(100, 20 + anim.dT * anim.t);
    calo.set({ T, fuelLeft: 1 - anim.t });
    st2.querySelector("[data-t]").textContent = `${fmt(T, 1)} °C`;
    if (anim.t >= 1) { calo.set({ burning: false }); anim = null; show(true); }
  });
  reset();
  cal.appendChild(h(`<div>${kid("Водород — чемпион по энергии на грамм: почти в 3 раза больше, чем у бензина. Поэтому им заправляют ракеты. Зато хранить его трудно — он лёгкий и пролезает через крошечные щели.", "Интересно")}</div>`));

  el.appendChild(h(`<section id="life"><h2>Энергия вокруг нас</h2>
    <ul>
      <li><b>Еда — тоже топливо.</b> В клетках глюкоза «сгорает» медленно, через десятки ступеней: C₆H₁₂O₆ + 6O₂ → 6CO₂ + 6H₂O + 2800 кДж. Калорийность на упаковке — это тепловой эффект, измеренный в калориметре (1 ккал = 4,18 кДж).</li>
      <li><b>Грелка-«хлопушка»</b> работает на кристаллизации ацетата натрия, а одноразовая грелка — на окислении железного порошка.</li>
      <li><b>Охлаждающий пакет</b> для травм: внутри нитрат аммония и вода. Растворение NH₄NO₃ поглощает тепло — пакет становится ледяным.</li>
      <li><b>Гашение извести:</b> CaO + H₂O → Ca(OH)₂ + 65 кДж — вода может даже закипеть. Подробнее — в уроке <a href="#lesson-oxides">«Оксиды»</a>.</li>
    </ul>
    <div class="callout warn">Опыты с горением проводят только со взрослыми, на негорючей подставке, вдали от занавесок и с ёмкостью воды под рукой.</div>
  </section>`));
}

export const quiz = [
  { q: "Реакция, при которой теплота выделяется, называется…", options: ["эндотермической", "экзотермической", "каталитической", "обратимой"], answer: 1, why: "«Экзо» — наружу: энергия уходит в окружающую среду, ΔH &lt; 0." },
  { q: "Какая из реакций эндотермическая?", options: ["горение угля", "CaO + H₂O → Ca(OH)₂", "CaCO₃ → CaO + CO₂ при нагревании", "нейтрализация HCl щёлочью"], answer: 2, why: "Разложение известняка идёт только при сильном нагревании и поглощает тепло (≈ 178 кДж/моль)." },
  { q: "По уравнению 2H₂ + O₂ → 2H₂O + 572 кДж сколько теплоты выделится при сгорании 1 моль H₂?", options: ["572 кДж", "1144 кДж", "286 кДж", "143 кДж"], answer: 2, why: "572 кДж относятся к 2 моль H₂, на 1 моль — вдвое меньше." },
  { q: "Что делает катализатор?", options: ["увеличивает тепловой эффект", "снижает энергию активации", "меняет продукты реакции", "расходуется в реакции"], answer: 1, why: "Он открывает путь с более низким барьером, а ΔH остаётся прежним." },
  { q: "При сгорании 32 г метана (CH₄ + 2O₂ → CO₂ + 2H₂O + 890 кДж) выделится:", options: ["890 кДж", "1780 кДж", "445 кДж", "2848 кДж"], answer: 1, why: "n = 32 / 16 = 2 моль, Q = 2 · 890 = 1780 кДж." },
  { q: "Если ΔH реакции = −100 кДж, то тепловой эффект Q равен…", options: ["−100 кДж (поглощается)", "+100 кДж (выделяется)", "0", "нельзя сказать"], answer: 1, why: "Q = −ΔH: отрицательная энтальпия означает выделение теплоты." },
];
