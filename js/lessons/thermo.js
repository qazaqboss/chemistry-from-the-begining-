import { h, kid, term, stage, chips } from "../ui.js";
import { createViewer, THREE, sphereGeo, glossy, easeInOut } from "../three/core.js";
import { simClock, svgPlot, plotStyles } from "../three/y1011-kit.js";

const R = 8.314;
const fmtN = (x, d = 1) => Number(x).toLocaleString("ru-RU", { maximumFractionDigits: d, minimumFractionDigits: 0 }).replace("-", "−");

// Стандартные величины при 298 K: ΔfH°, кДж/моль; S°, Дж/(моль·K)
const DATA = {
  "H₂(г)": [0, 130.7], "O₂(г)": [0, 205.2], "N₂(г)": [0, 191.6], "O₃(г)": [142.7, 238.9],
  "H₂O(ж)": [-285.8, 70.0], "H₂O(г)": [-241.8, 188.8], "H₂O₂(ж)": [-187.8, 109.6],
  "C(графит)": [0, 5.7], "CO(г)": [-110.5, 197.7], "CO₂(г)": [-393.5, 213.8], "CH₄(г)": [-74.8, 186.3],
  "NH₃(г)": [-45.9, 192.8], "HCl(г)": [-92.3, 186.9], "NH₄Cl(тв)": [-314.4, 94.6],
  "NO₂(г)": [33.2, 240.1], "N₂O₄(г)": [9.2, 304.3], "SO₂(г)": [-296.8, 248.2], "SO₃(г)": [-395.7, 256.8],
  "CaCO₃(тв)": [-1206.9, 92.9], "CaO(тв)": [-635.1, 39.8],
  "Fe₂O₃(тв)": [-824.2, 87.4], "Fe(тв)": [0, 27.3], "Al(тв)": [0, 28.3], "Al₂O₃(тв)": [-1675.7, 50.9],
  "C₆H₁₂O₆(тв)": [-1273.3, 212.1],
};
const RX = [
  { n: "Горение водорода", l: [[2, "H₂(г)"], [1, "O₂(г)"]], r: [[2, "H₂O(ж)"]] },
  { n: "Обжиг известняка", l: [[1, "CaCO₃(тв)"]], r: [[1, "CaO(тв)"], [1, "CO₂(г)"]] },
  { n: "Синтез аммиака", l: [[1, "N₂(г)"], [3, "H₂(г)"]], r: [[2, "NH₃(г)"]] },
  { n: "Диссоциация N₂O₄", l: [[1, "N₂O₄(г)"]], r: [[2, "NO₂(г)"]] },
  { n: "Горение метана", l: [[1, "CH₄(г)"], [2, "O₂(г)"]], r: [[1, "CO₂(г)"], [2, "H₂O(ж)"]] },
  { n: "Реакция Будуара", l: [[1, "C(графит)"], [1, "CO₂(г)"]], r: [[2, "CO(г)"]] },
  { n: "Алюминотермия (термит)", l: [[1, "Fe₂O₃(тв)"], [2, "Al(тв)"]], r: [[1, "Al₂O₃(тв)"], [2, "Fe(тв)"]] },
  { n: "Разложение NH₄Cl", l: [[1, "NH₄Cl(тв)"]], r: [[1, "NH₃(г)"], [1, "HCl(г)"]] },
  { n: "Окисление SO₂", l: [[2, "SO₂(г)"], [1, "O₂(г)"]], r: [[2, "SO₃(г)"]] },
  { n: "Окисление глюкозы", l: [[1, "C₆H₁₂O₆(тв)"], [6, "O₂(г)"]], r: [[6, "CO₂(г)"], [6, "H₂O(ж)"]] },
  { n: "Образование озона", l: [[3, "O₂(г)"]], r: [[2, "O₃(г)"]] },
];
const CASES = [
  { label: "ΔH < 0, ΔS > 0", H: -196, S: 126, t: "Идёт при любой температуре", ex: "2H₂O₂(ж) → 2H₂O(ж) + O₂(г): выделяется тепло и газ — оба фактора «за». ΔG < 0 всегда (кинетически реакция может быть медленной — ей помогает катализатор MnO₂)." },
  { label: "ΔH < 0, ΔS < 0", H: -92, S: -198, t: "Идёт при низких температурах", ex: "N₂ + 3H₂ → 2NH₃: энтальпия «за», энтропия «против». Ниже T = ΔH/ΔS ≈ 465 K ΔG < 0, выше — реакция идёт в обратную сторону." },
  { label: "ΔH > 0, ΔS > 0", H: 178, S: 161, t: "Идёт при высоких температурах", ex: "CaCO₃ → CaO + CO₂: нужна энергия, но образуется газ. Выше ≈ 1110 K (837 °C) энтропийный член TΔS перевешивает — известняк обжигают в печах при 900–1000 °C." },
  { label: "ΔH > 0, ΔS < 0", H: 285, S: -138, t: "Не идёт ни при какой температуре", ex: "3O₂ → 2O₃: оба фактора «против», ΔG > 0 всегда. Озон получают только за счёт внешней энергии — электрического разряда или УФ-излучения." },
];

export async function render(el) {
  el.appendChild(h(`<div>${plotStyles()}
    <p class="lead">Почему лёд тает сам при +5 °C, а при −5 °C — нет? Почему одни реакции идут сами, а другие — только при нагревании или вообще никогда? Ответ даёт термодинамика: у каждого процесса есть «баланс» двух стремлений — к минимуму энергии (${term("enthalpy", "энтальпия")}) и к максимуму беспорядка (${term("entropy", "энтропия")}).</p>
    ${kid("Мячик сам скатывается с горки вниз (меньше энергии), а кубики в коробке сами перемешиваются, если трясти, но никогда сами не сложатся в башню (больше беспорядка). Химические реакции слушаются обоих правил сразу.")}
  </div>`));

  el.appendChild(h(`<section id="enthalpy"><h2>Энтальпия и закон Гесса</h2>
    <p>Тепловой эффект реакции при постоянном давлении равен изменению энтальпии ΔH. <b>ΔH &lt; 0</b> — тепло выделяется (экзотермическая реакция), <b>ΔH &gt; 0</b> — поглощается (эндотермическая). В школьных термохимических уравнениях пишут Q = −ΔH: 2H₂ + O₂ = 2H₂O(ж) + 572 кДж.</p>
    <p><b>Закон Гесса</b> (Г. И. Гесс, 1840): тепловой эффект зависит только от начального и конечного состояний, а не от пути. Отсюда главное следствие — расчёт через <b>стандартные энтальпии образования</b> ΔfH° (для простых веществ в устойчивой форме ΔfH° = 0):</p>
    <div class="eq">ΔrH° = Σ ν·ΔfH°(продуктов) − Σ ν·ΔfH°(реагентов)</div>
    <p class="small muted">Пример пути: C + O₂ → CO₂ (−393,5 кДж) можно провести в две стадии: C + ½O₂ → CO (−110,5) и CO + ½O₂ → CO₂ (−283,0). Сумма та же: −393,5 кДж.</p>
  </section>`));

  // ---------- энтропия 3D ----------
  const s2 = h(`<section id="entropy"><h2>Энтропия: от кристалла к газу</h2>
    <p>Энтропия — мера числа способов W, которыми можно реализовать состояние системы (микросостояний): <span class="formula">S = k·ln W</span> (Л. Больцман). В кристалле каждая молекула привязана к своему узлу — W мало. В жидкости молекулы меняются местами, в газе каждая может оказаться в любой точке огромного объёма — W астрономически велико. Переключай состояния 64 молекул.</p></section>`);
  el.appendChild(s2);
  const cb = h(`<div style="margin-bottom:10px"></div>`);
  s2.appendChild(cb);
  const st = stage(`<div class="overlay"><span data-t style="font-size:1rem"></span><span data-s></span></div>`, { wide: true });
  s2.appendChild(st);
  const c2 = h(`<div class="card pad" style="margin-top:10px"><div data-bars></div><div class="row" data-wall style="margin-top:10px;display:none"><button class="btn primary small" type="button">Убрать перегородку</button></div><p data-n style="margin:10px 0 0"></p></div>`);
  s2.appendChild(c2);
  const v = createViewer(st, { camera: [7, 5, 13], fitWidth: 5.6, minDistance: 5, maxDistance: 40, autoRotateSpeed: 0.3 });
  const B = 4, N = 64, r0 = 0.3;
  v.scene.add(new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(2 * B, 2 * B, 2 * B)), new THREE.LineBasicMaterial({ color: 0x7fa8ff, transparent: true, opacity: 0.5 })));
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(2 * B, 2 * B), new THREE.MeshBasicMaterial({ color: 0x9fd8ff, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false }));
  wall.rotation.y = Math.PI / 2; v.scene.add(wall);
  const matA = glossy(0x4f8dff), matB = glossy(0xff5a5a);
  const geo = sphereGeo(r0, 20);
  const M = [];
  for (let i = 0; i < N; i++) { const m = new THREE.Mesh(geo, matA); v.scene.add(m); M.push({ m, p: new THREE.Vector3(), v: new THREE.Vector3(), home: new THREE.Vector3(), from: new THREE.Vector3(), to: new THREE.Vector3() }); }
  const rand = (a) => (Math.random() * 2 - 1) * a;
  const gauss = () => Math.sqrt(-2 * Math.log(Math.random() + 1e-12)) * Math.cos(2 * Math.PI * Math.random());
  const lattice = (i) => new THREE.Vector3((i % 4) * 0.75 - 1.125, -B + 0.4 + Math.floor(i / 16) * 0.75, (Math.floor(i / 4) % 4) * 0.75 - 1.125);
  const MODES = [
    { label: "Кристалл (лёд)", id: "s", S: 41, t: "Лёд, 0 °C", n: "Молекулы колеблются около узлов решётки. Порядок почти полный — энтропия мала: S°(лёд) ≈ 41 Дж/(моль·K). При 0 K у идеального кристалла W = 1 и S = 0 (третье начало термодинамики)." },
    { label: "Жидкость (вода)", id: "l", S: 70, t: "Вода, 25 °C", n: "Молекулы по-прежнему рядом, но решётки нет: они скользят и меняются местами. S°(H₂O, ж) = 70 Дж/(моль·K). Плавление: ΔH > 0, ΔS > 0 — поэтому лёд тает только выше 0 °C, где TΔS > ΔH." },
    { label: "Газ (пар)", id: "g", S: 189, t: "Пар, 25 °C", n: "Молекулы разлетелись по всему объёму: S°(H₂O, г) = 189 Дж/(моль·K) — почти втрое больше, чем у жидкости. Вывод для реакций: если число моль газов растёт, ΔS > 0; если падает — ΔS < 0." },
    { label: "Смешение газов", id: "m", S: 0, t: "Два газа и перегородка", n: "Слева синий газ, справа красный. Убери перегородку: газы перемешаются сами, хотя энергия не изменилась (ΔH = 0). Обратно сами они не разделятся никогда: вероятность, что все 64 молекулы случайно соберутся «по своим» половинам, ≈ 10⁻¹⁹. Для 1 + 1 моль идеальных газов ΔS = 2R·ln 2 ≈ 11,5 Дж/K." },
  ];
  let mode = MODES[0], tr = 1, wallOn = false;
  const go = (m) => {
    mode = m; tr = 0;
    wallOn = m.id === "m"; wall.visible = wallOn;
    c2.querySelector("[data-wall]").style.display = m.id === "m" ? "" : "none";
    M.forEach((q, i) => {
      q.from.copy(q.p);
      q.m.material = m.id === "m" && i % 2 ? matB : matA;
      if (m.id === "s") q.to.copy(lattice(i));
      else if (m.id === "l") { q.home.set(rand(1.9), -B + 0.4 + Math.random() * 1.6, rand(1.9)); q.to.copy(q.home); }
      else { const sx = m.id === "m" ? (i % 2 ? 1 : -1) : 0; q.to.set(m.id === "m" ? sx * (0.4 + Math.random() * (B - 0.8)) : rand(B - 0.4), rand(B - 0.4), rand(B - 0.4)); }
      q.v.set(gauss(), gauss(), gauss()).multiplyScalar(2.2);
    });
    st.querySelector("[data-t]").innerHTML = `<b>${m.t}</b>`;
    st.querySelector("[data-s]").textContent = m.S ? `S° ≈ ${m.S} Дж/(моль·K)` : "ΔH = 0, ΔS > 0";
    c2.querySelector("[data-bars]").innerHTML = ["s", "l", "g"].map((k) => { const mm = MODES.find((x) => x.id === k); return `<div class="row small" style="flex-wrap:nowrap;gap:8px;margin:4px 0"><span style="width:110px;flex:none">${mm.label.split(" ")[0]}</span><span style="flex:1;height:10px;border-radius:5px;background:var(--surface-2);overflow:hidden"><i style="display:block;height:100%;width:${(mm.S / 189) * 100}%;background:${k === m.id ? "var(--accent)" : "var(--line-2)"}"></i></span><b class="yk-num" style="width:44px;text-align:right">${mm.S}</b></div>`; }).join("");
    c2.querySelector("[data-n]").innerHTML = m.n;
  };
  c2.querySelector("[data-wall] button").onclick = () => { wallOn = false; wall.visible = false; };
  M.forEach((q, i) => q.p.copy(lattice(i)));
  chips(cb, MODES, go);
  go(MODES[0]);
  const clock = simClock();
  let time = 0;
  v.onFrame(() => {
    const dt = clock(); time += dt;
    if (tr < 1) {
      tr = Math.min(1, tr + dt / 1.3);
      const k = easeInOut(tr);
      M.forEach((q) => { q.p.lerpVectors(q.from, q.to, k); q.m.position.copy(q.p); });
      return;
    }
    M.forEach((q, i) => {
      if (mode.id === "s") {
        q.p.copy(lattice(i)).add(new THREE.Vector3(Math.sin(time * 9 + i), Math.sin(time * 11 + i * 2), Math.sin(time * 10 + i * 3)).multiplyScalar(0.045));
      } else if (mode.id === "l") {
        q.home.add(new THREE.Vector3(gauss(), gauss() * 0.5, gauss()).multiplyScalar(0.6 * dt));
        q.home.x = THREE.MathUtils.clamp(q.home.x, -B + 0.4, B - 0.4); q.home.z = THREE.MathUtils.clamp(q.home.z, -B + 0.4, B - 0.4);
        q.home.y = THREE.MathUtils.clamp(q.home.y, -B + 0.35, -B + 2.0);
        q.p.lerp(q.home, Math.min(1, dt * 4));
      } else {
        q.p.addScaledVector(q.v, dt);
        for (const ax of ["x", "y", "z"]) {
          if (q.p[ax] > B - r0) { q.p[ax] = B - r0; q.v[ax] = -Math.abs(q.v[ax]); }
          if (q.p[ax] < -B + r0) { q.p[ax] = -B + r0; q.v[ax] = Math.abs(q.v[ax]); }
        }
        if (wallOn) {
          const left = i % 2 === 0;
          if (left && q.p.x > -r0) { q.p.x = -r0; q.v.x = -Math.abs(q.v.x); }
          if (!left && q.p.x < r0) { q.p.x = r0; q.v.x = Math.abs(q.v.x); }
        }
      }
      q.m.position.copy(q.p);
    });
  });

  // ---------- ΔG ----------
  const s3 = h(`<section id="gibbs"><h2>Энергия Гиббса: ΔG = ΔH − TΔS</h2>
    <p>Самопроизвольность при постоянных T и p решает ${term("gibbs", "энергия Гиббса")}: процесс может идти сам, если <b>ΔG &lt; 0</b>; при ΔG = 0 — равновесие; при ΔG &gt; 0 сама идёт обратная реакция. Энтропия входит с множителем T, поэтому при нагревании её роль растёт. Двигай ползунки или выбери один из четырёх случаев знаков. Внимание к единицам: ΔS в Дж/K, а ΔH в кДж — переведи!</p></section>`);
  el.appendChild(s3);
  const gc = h(`<div style="margin-bottom:10px"></div>`);
  s3.appendChild(gc);
  const gp = h(`<div class="card pad">
    <div class="yk-grid"><label class="ctl">ΔH: <b data-hv></b><input type="range" data-H min="-300" max="300" value="-92"></label><label class="ctl">ΔS: <b data-sv></b><input type="range" data-S min="-400" max="400" value="-198"></label></div>
    <div data-plot style="margin-top:10px"></div>
    <div class="yk-leg"><span><i style="background:var(--accent)"></i>ΔG(T)</span><span><i style="background:var(--good)"></i>ΔG &lt; 0 — идёт сама</span><span><i style="background:var(--bad)"></i>ΔG &gt; 0 — не идёт</span></div>
    <p data-o class="yk-out"></p></div>`);
  s3.appendChild(gp);
  const TMAX = 1500;
  const drawG = (note) => {
    const H = +gp.querySelector("[data-H]").value, Sv = +gp.querySelector("[data-S]").value;
    const G = (T) => H - (T * Sv) / 1000;
    const m = Math.max(50, Math.abs(G(0)), Math.abs(G(TMAX))) * 1.1, step = m > 400 ? 200 : m > 150 ? 100 : 50;
    const ys = []; for (let y = -Math.floor(m / step) * step; y <= m; y += step) ys.push(y);
    const pts = [[0, G(0)], [TMAX, G(TMAX)]];
    const seg = Array.from({ length: 61 }, (_, i) => (TMAX * i) / 60);
    const Tinv = Sv !== 0 ? (H * 1000) / Sv : NaN;
    gp.querySelector("[data-plot]").innerHTML = svgPlot({
      xr: [0, TMAX], yr: [-m, m], xt: [0, 300, 600, 900, 1200, 1500], yt: ys, xl: "T, K", yl: "ΔG, кДж/моль",
      series: [
        { pts: [[0, 0], ...seg.map((T) => [T, Math.min(0, G(T))]), [TMAX, 0]], cls: "f2", fill: true },
        { pts: [[0, 0], ...seg.map((T) => [T, Math.max(0, G(T))]), [TMAX, 0]], cls: "f1", fill: true },
        { pts, cls: "l1" },
      ],
      extra: (X, Y) => `<line class="ax" x1="${X(0)}" x2="${X(TMAX)}" y1="${Y(0)}" y2="${Y(0)}"/><line class="mk" x1="${X(298)}" x2="${X(298)}" y1="${Y(-m)}" y2="${Y(m)}"/><text class="lab" x="${X(298) + 4}" y="${Y(m) + 12}">298 K</text>` +
        (Tinv > 0 && Tinv < TMAX ? `<circle cx="${X(Tinv)}" cy="${Y(0)}" r="5" fill="var(--warn)"/><text class="lab" x="${X(Tinv) + 8}" y="${Y(0) - 8}">T = ${Math.round(Tinv)} K</text>` : ""),
    });
    gp.querySelector("[data-hv]").textContent = `${fmtN(H)} кДж/моль`;
    gp.querySelector("[data-sv]").textContent = `${fmtN(Sv)} Дж/(моль·K)`;
    const g298 = G(298);
    let verdict;
    if (H < 0 && Sv >= 0) verdict = "ΔG < 0 при любой T — процесс идёт всегда.";
    else if (H > 0 && Sv <= 0) verdict = "ΔG > 0 при любой T — сам процесс не идёт никогда.";
    else if (H < 0) verdict = `Идёт при T &lt; ${Math.round(Tinv)} K (ниже температуры, где ΔH = TΔS).`;
    else if (H > 0) verdict = `Идёт при T &gt; ${Math.round(Tinv)} K (${Math.round(Tinv - 273)} °C).`;
    else verdict = Sv > 0 ? "ΔH = 0: процесс движет только рост энтропии — идёт всегда." : "ΔH = 0, ΔS ≤ 0: сам не идёт.";
    gp.querySelector("[data-o]").innerHTML = `${note ? note + "<br>" : ""}ΔG°₂₉₈ = ${fmtN(H)} − 298·(${fmtN(Sv)}/1000) = <b>${fmtN(g298, 1)} кДж/моль</b>. ${verdict}`;
  };
  gp.querySelectorAll("input").forEach((i) => (i.oninput = () => drawG()));
  chips(gc, CASES, (c) => { gp.querySelector("[data-H]").value = c.H; gp.querySelector("[data-S]").value = c.S; drawG(`<b>${c.t}.</b> ${c.ex}`); }, 1);
  drawG(`<b>${CASES[1].t}.</b> ${CASES[1].ex}`);
  s3.appendChild(h(`<div class="table-wrap"><table class="data">
    <tr><th>ΔH</th><th>ΔS</th><th>ΔG = ΔH − TΔS</th><th>Пример</th></tr>
    <tr><td>&lt; 0</td><td>&gt; 0</td><td>всегда &lt; 0</td><td>горение, 2H₂O₂ → 2H₂O + O₂</td></tr>
    <tr><td>&lt; 0</td><td>&lt; 0</td><td>&lt; 0 при низких T</td><td>синтез NH₃, замерзание воды</td></tr>
    <tr><td>&gt; 0</td><td>&gt; 0</td><td>&lt; 0 при высоких T</td><td>разложение CaCO₃, плавление льда</td></tr>
    <tr><td>&gt; 0</td><td>&lt; 0</td><td>всегда &gt; 0</td><td>3O₂ → 2O₃</td></tr>
  </table></div>
  <div class="callout warn"><b>Важно:</b> ΔG &lt; 0 говорит, что реакция <i>может</i> идти, но ничего не говорит о скорости. Для горения бумаги на воздухе ΔG ≪ 0, но без поджигания она лежит годами: мешает энергия активации (урок <a href="#lesson-kinetics">«Скорость реакций»</a>). А связь с равновесием: ΔG° = −RT·ln K (урок <a href="#lesson-equilibrium">«Химическое равновесие»</a>).</div>`));

  // ---------- калькулятор ----------
  const s4 = h(`<section id="calculator"><h2>Калькулятор по стандартным величинам</h2>
    <p>Выбери реакцию — расчёт ΔH°, ΔS° и ΔG° по таблице стандартных величин (298 K, 1 бар; справочные данные). Можно задать свою температуру: в первом приближении считаем ΔH и ΔS не зависящими от T.</p></section>`);
  el.appendChild(s4);
  const rc = h(`<div style="margin-bottom:10px"></div>`);
  s4.appendChild(rc);
  const calc = h(`<div class="card pad"><div class="eq" data-eq style="margin-top:0"></div>
    <div class="table-wrap"><table class="data" data-t></table></div>
    <label class="ctl" style="margin-top:12px;max-width:340px">Температура, K<input type="number" data-T value="298" min="1" max="5000"></label>
    <div data-o class="yk-out"></div></div>`);
  s4.appendChild(calc);
  let cur = RX[0];
  const side = (arr) => arr.map(([k, f]) => (k > 1 ? k : "") + f.replace(/\(.*\)/, "")).join(" + ");
  const sum = (arr, j) => arr.reduce((s, [k, f]) => s + k * DATA[f][j], 0);
  const showRx = (r) => {
    cur = r;
    const dH = sum(r.r, 0) - sum(r.l, 0), dS = sum(r.r, 1) - sum(r.l, 1);
    const T = Math.max(1, +calc.querySelector("[data-T]").value || 298);
    const G = dH - (T * dS) / 1000, G298 = dH - (298 * dS) / 1000;
    const Tinv = (dH * 1000) / dS;
    const lnK = (-G * 1000) / (R * T);
    calc.querySelector("[data-eq]").textContent = side(r.l) + " → " + side(r.r);
    calc.querySelector("[data-t]").innerHTML = `<tr style="text-transform:none"><th style="text-transform:none">Вещество</th><th style="text-transform:none">ν</th><th style="text-transform:none">ΔfH°, кДж/моль</th><th style="text-transform:none">S°, Дж/(моль·K)</th></tr>` +
      [...r.l.map((x) => [...x, "реагент"]), ...r.r.map((x) => [...x, "продукт"])].map(([k, f, role]) => `<tr><td>${f} <span class="muted small">${role}</span></td><td>${k}</td><td>${fmtN(DATA[f][0], 1)}</td><td>${fmtN(DATA[f][1], 1)}</td></tr>`).join("");
    const Kstr = Math.abs(lnK) > 690 ? (lnK > 0 ? "≫ 10³⁰⁰" : "≪ 10⁻³⁰⁰") : Math.abs(lnK) < 7 ? fmtN(Math.exp(lnK), 3) : "10<sup>" + fmtN(lnK / Math.LN10, 1) + "</sup>";
    calc.querySelector("[data-o]").innerHTML = `
      <p>ΔH° = Σν·ΔfH°(прод) − Σν·ΔfH°(реаг) = ${fmtN(sum(r.r, 0), 1)} − (${fmtN(sum(r.l, 0), 1)}) = <b>${fmtN(dH, 1)} кДж</b> ${dH < 0 ? "(экзотермическая)" : "(эндотермическая)"}</p>
      <p>ΔS° = ${fmtN(sum(r.r, 1), 1)} − ${fmtN(sum(r.l, 1), 1)} = <b>${fmtN(dS, 1)} Дж/K</b></p>
      <p>ΔG°₂₉₈ = ${fmtN(dH, 1)} − 298·(${fmtN(dS / 1000, 4)}) = <b>${fmtN(G298, 1)} кДж</b> → при 25 °C реакция ${G298 < 0 ? "<b style='color:var(--good)'>возможна</b>" : "<b style='color:var(--bad)'>сама не идёт</b>"}.</p>
      <p>При T = ${T} K: ΔG = <b>${fmtN(G, 1)} кДж</b>, K = e^(−ΔG/RT) ≈ <b>${Kstr}</b>. ${Tinv > 0 ? `Знак ΔG меняется при T = ΔH/ΔS ≈ <b>${Math.round(Tinv)} K</b> (${Math.round(Tinv - 273)} °C).` : "Знак ΔG от температуры не зависит."}</p>`;
  };
  chips(rc, RX.map((r) => ({ ...r, label: r.n })), showRx);
  calc.querySelector("[data-T]").oninput = () => showRx(cur);
  showRx(RX[0]);

  el.appendChild(h(`<section id="thermo-task"><h2>Разбор задачи</h2>
    <div class="card pad">
      <p><b>Условие.</b> При какой температуре начнётся разложение карбоната кальция? Сколько теплоты нужно для получения 1 т негашёной извести?</p>
      <p style="margin:0"><b>Решение.</b> По таблице: ΔH° = −635,1 − 393,5 − (−1206,9) = +178,3 кДж; ΔS° = 39,8 + 213,8 − 92,9 = +160,7 Дж/K.<br>
      T = ΔH/ΔS = 178 300 / 160,7 ≈ <b>1110 K (≈ 837 °C)</b> — выше неё ΔG &lt; 0.<br>
      n(CaO) = 10⁶ г / 56 г/моль = 17 857 моль; Q = 17 857 · 178,3 ≈ <b>3,2·10⁶ кДж</b> (3,2 ГДж), без учёта нагрева сырья.</p>
    </div>
  </section>`));
}

export const quiz = [
  { q: "Реакция идёт самопроизвольно при постоянных T и p, если…", options: ["ΔH > 0", "ΔS < 0", "ΔG < 0", "ΔG > 0"], answer: 2, why: "Критерий самопроизвольности — убыль энергии Гиббса." },
  { q: "Для какого процесса ΔS > 0?", options: ["N₂ + 3H₂ → 2NH₃", "H₂O(г) → H₂O(ж)", "CaCO₃(тв) → CaO(тв) + CO₂(г)", "2SO₂ + O₂ → 2SO₃"], answer: 2, why: "Из твёрдого вещества образуется газ — беспорядок растёт." },
  { q: "ΔH > 0 и ΔS > 0. Когда реакция пойдёт сама?", options: ["при любой T", "только при высоких T", "только при низких T", "никогда"], answer: 1, why: "ΔG = ΔH − TΔS станет отрицательной, когда TΔS > ΔH." },
  { q: "Чему равна ΔfH° простого вещества в стандартном состоянии (O₂, графит)?", options: ["0", "1", "его S°", "−RT"], answer: 0, why: "Это точка отсчёта для расчётов по закону Гесса." },
  { q: "ΔH = −100 кДж, ΔS = −200 Дж/K. Выше какой температуры реакция не идёт?", options: ["200 K", "500 K", "2000 K", "50 K"], answer: 1, why: "T = ΔH/ΔS = 100 000 / 200 = 500 K." },
  { q: "Что означает ΔG° ≪ 0 для скорости реакции?", options: ["реакция очень быстрая", "ничего: скорость определяет энергия активации", "реакция мгновенная", "нужен нагрев"], answer: 1, why: "Термодинамика говорит «можно», кинетика — «как быстро»." },
];
