import { h, kid, term, stage } from "../ui.js";
import { createViewer } from "../three/core.js";
import { frame } from "../three/molecule.js";
import { MODE_MOLS, computeModes, createModeScene } from "../three/spectro-modes.js";
import { num } from "../three/qm-linalg.js";

const RH = 1.09678e7; // постоянная Ридберга для водорода, м⁻¹
const SERIES = ["Лаймана", "Бальмера", "Пашена", "Брэкета", "Пфунда"];
const SER_COL = ["#a78bfa", "#4fb3ff", "#ff8a5c", "#f472b6", "#94a3b8"];

// Цвет видимого света по длине волны (приближение), нм → css
function wl2rgb(l) {
  let r = 0, g = 0, b = 0;
  if (l >= 380 && l < 440) { r = -(l - 440) / 60; b = 1; }
  else if (l < 490) { g = (l - 440) / 50; b = 1; }
  else if (l < 510) { g = 1; b = -(l - 510) / 20; }
  else if (l < 580) { r = (l - 510) / 70; g = 1; }
  else if (l < 645) { r = 1; g = -(l - 645) / 65; }
  else if (l <= 750) { r = 1; }
  const f = l < 420 ? 0.3 + (0.7 * (l - 380)) / 40 : l > 700 ? 0.3 + (0.7 * (750 - l)) / 50 : 1;
  const c = (x) => Math.round(255 * Math.pow(x * f, 0.8));
  return `rgb(${c(r)},${c(g)},${c(b)})`;
}
const lam = (n1, n2) => 1e9 / (RH * (1 / (n1 * n1) - 1 / (n2 * n2))); // нм

const DIATOMIC = [
  { id: "hcl", label: "H–³⁵Cl", k: 516, m1: 1.008, m2: 34.969, exp: 2886 },
  { id: "dcl", label: "D–³⁵Cl", k: 516, m1: 2.014, m2: 34.969, exp: 2091 },
  { id: "hf", label: "H–F", k: 966, m1: 1.008, m2: 18.998, exp: 3962 },
  { id: "co", label: "C≡O", k: 1902, m1: 12.0, m2: 15.995, exp: 2143 },
  { id: "nn", label: "N≡N", k: 2295, m1: 14.003, m2: 14.003, exp: 2331, inactive: true },
];

// Мультиплет как свёртка расщеплений: couplings = [[J, n], …]
function multiplet(center, couplings, total) {
  let lines = [[0, 1]];
  for (const [J, n] of couplings) for (let k = 0; k < n; k++) {
    const next = new Map();
    for (const [x, w] of lines) for (const s of [-J / 2, J / 2]) next.set(+(x + s).toFixed(4), (next.get(+(x + s).toFixed(4)) || 0) + w / 2);
    lines = [...next.entries()];
  }
  return lines.map(([x, w]) => [center, x, w * total]);
}

export async function render(el) {
  el.classList.add("spx");
  el.appendChild(h(`<div>
    <style>
      .spx svg{width:100%;height:auto;display:block}
      .spx .plot{background:var(--surface-2);border-radius:12px;border:1px solid var(--line)}
      .spx .two{display:grid;grid-template-columns:1fr 1fr;gap:14px}
      @media (max-width:700px){.spx .two{grid-template-columns:1fr}}
      .spx .three{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
      @media (max-width:520px){.spx .three{grid-template-columns:1fr}}
      .spx .pas{font-family:var(--mono);text-align:center;line-height:1.7}
      .spx .pas .on{color:var(--accent);font-weight:800}
    </style>
    <p class="lead">Спектроскопия — главный способ «увидеть» молекулу. Энергия кванта света ΔE = hν попадает в резонанс с разностью уровней: электронных (УФ и видимый свет), колебательных (ИК), ядерных спиновых в магнитном поле (радиоволны, ЯМР). По положению, интенсивности и форме линий восстанавливают строение вещества.</p>
    ${kid("Каждое вещество «поёт» своей песенкой из света: поглощает или испускает только определённые цвета. Учёные, как музыканты по нотам, по этим цветам узнают, что за вещество перед ними, — даже если оно на далёкой звезде.")}
  </div>`));

  // ---------- Водород ----------
  const hy = h(`<section id="hydrogen"><h2>Линейчатый спектр водорода</h2>
    <p>Электрон в атоме H переходит между уровнями Eₙ = −13,6 эВ/n². Энергия испущенного фотона — разность уровней, откуда ${term("y12_rydberg", "формула Ридберга")}:</p>
    <div class="eq">1/λ = R<sub>H</sub>·(1/n₁² − 1/n₂²), &nbsp; R<sub>H</sub> = 1,0968·10⁷ м⁻¹, n₂ > n₁</div>
    <p>Все переходы на один нижний уровень n₁ образуют серию: Лаймана (n₁ = 1, ультрафиолет), Бальмера (n₁ = 2, видимая), Пашена (n₁ = 3, ИК)… Линии сгущаются к границе серии λ<sub>∞</sub> = n₁²/R<sub>H</sub>.</p>
    <div class="card pad">
      <div class="two"><label class="ctl">Нижний уровень n₁: <b data-a></b><input type="range" min="1" max="5" value="2" data-n1></label>
      <label class="ctl">Верхний уровень n₂: <b data-b></b><input type="range" min="3" max="12" value="3" data-n2></label></div>
      <svg class="plot" viewBox="0 0 700 150" style="margin-top:12px" data-all></svg>
      <svg class="plot" viewBox="0 0 700 90" style="margin-top:10px" data-vis></svg>
      <p data-out style="margin:10px 0 0"></p>
    </div>
  </section>`);
  el.appendChild(hy);
  const n1I = hy.querySelector("[data-n1]"), n2I = hy.querySelector("[data-n2]");
  const updH = () => {
    const n1 = +n1I.value;
    n2I.min = n1 + 1; if (+n2I.value <= n1) n2I.value = n1 + 1;
    const n2 = +n2I.value;
    hy.querySelector("[data-a]").textContent = `${n1} (серия ${SERIES[n1 - 1]})`;
    hy.querySelector("[data-b]").textContent = n2;
    const L0 = Math.log10(80), L1 = Math.log10(8000), X = (l) => 20 + ((Math.log10(l) - L0) / (L1 - L0)) * 660;
    let s = `<rect x="${X(380)}" y="20" width="${X(750) - X(380)}" height="90" fill="url(#rb)" opacity=".25"/>
      <defs><linearGradient id="rb" x1="0" x2="1">${[380, 440, 490, 510, 580, 645, 750].map((l, i) => `<stop offset="${i / 6}" stop-color="${wl2rgb(l)}"/>`).join("")}</linearGradient></defs>`;
    for (let a = 1; a <= 5; a++) for (let b = a + 1; b <= 14; b++) {
      const l = lam(a, b); if (l > 8000) continue;
      const on = a === n1, sel = on && b === n2;
      s += `<line x1="${X(l)}" x2="${X(l)}" y1="${sel ? 14 : 30}" y2="110" stroke="${SER_COL[a - 1]}" stroke-width="${sel ? 3.5 : 1.5}" opacity="${on ? 1 : 0.3}"/>`;
    }
    for (const t of [100, 200, 500, 1000, 2000, 5000]) s += `<line x1="${X(t)}" x2="${X(t)}" y1="110" y2="116" stroke="var(--text-3)"/><text x="${X(t)}" y="130" text-anchor="middle" font-size="12" fill="var(--text-3)">${t}</text>`;
    s += `<text x="680" y="145" text-anchor="end" font-size="11" fill="var(--text-3)">λ, нм (логарифмическая шкала)</text>
      <text x="${X(100)}" y="12" font-size="11" fill="var(--text-3)">УФ</text><text x="${X(500)}" y="12" font-size="11" fill="var(--text-3)">видимый</text><text x="${X(2500)}" y="12" font-size="11" fill="var(--text-3)">ИК</text>`;
    hy.querySelector("[data-all]").innerHTML = s;
    // видимая область
    const V = (l) => 20 + ((l - 380) / 370) * 660;
    let v = `<defs><linearGradient id="rb2" x1="0" x2="1">${Array.from({ length: 19 }, (_, i) => 380 + i * 20.5).map((l, i) => `<stop offset="${i / 18}" stop-color="${wl2rgb(l)}"/>`).join("")}</linearGradient></defs>
      <rect x="20" y="10" width="660" height="50" fill="#05060a"/><rect x="20" y="10" width="660" height="50" fill="url(#rb2)" opacity=".12"/>`;
    for (let b = 3; b <= 9; b++) {
      const l = lam(2, b);
      v += `<rect x="${V(l) - (b === n2 && n1 === 2 ? 2.5 : 1.5)}" y="10" width="${b === n2 && n1 === 2 ? 5 : 3}" height="50" fill="${wl2rgb(l)}"/>`;
      if (b <= 6) v += `<text x="${V(l)}" y="76" text-anchor="middle" font-size="11" fill="var(--text-2)">H${"αβγδ"[b - 3]} ${num(l, 1)}</text>`;
    }
    hy.querySelector("[data-vis]").innerHTML = v;
    const l = lam(n1, n2), E = 1239.84 / l;
    const zone = l < 380 ? "ультрафиолет" : l <= 750 ? `видимый свет <span style="display:inline-block;width:14px;height:14px;border-radius:4px;vertical-align:-2px;background:${wl2rgb(l)}"></span>` : "инфракрасный";
    hy.querySelector("[data-out]").innerHTML = `Переход ${n2} → ${n1}: 1/λ = ${num(RH * (1 / n1 ** 2 - 1 / n2 ** 2) / 100, 0)} см⁻¹, <b>λ = ${num(l, 1)} нм</b> (${zone}); E = ${num(E, 3)} эВ, ν = ${num(2.99792458e8 / (l * 1e-9) / 1e14, 3)}·10¹⁴ Гц. Граница серии: ${num((n1 * n1 * 1e9) / RH, 1)} нм. Нижняя полоса — видимая часть спектра (серия Бальмера), как в спектроскопе.`;
  };
  n1I.oninput = n2I.oninput = updH;
  updH();

  // ---------- Гармонический осциллятор ----------
  const ho = h(`<section id="oscillator"><h2>Колебания молекулы: гармонический осциллятор</h2>
    <p>Связь — пружина с силовой постоянной k. Для двухатомной молекулы колеблется «приведённая масса» μ = m₁m₂/(m₁ + m₂), а уровни энергии эквидистантны: E<sub>v</sub> = hν(v + ½). Разрешены переходы Δv = ±1, поэтому в ИК-спектре видна одна основная полоса:</p>
    <div class="eq">ν = (1/2π)·√(k/μ), &nbsp; ν̃ = ν/c (см⁻¹)</div>
    <div class="card pad">
      <div class="chips" data-d></div>
      <label class="ctl" style="margin-top:12px">Силовая постоянная k: <b data-k></b><input type="range" min="100" max="2500" step="1" data-ks></label>
      <p data-out style="margin:10px 0 0"></p>
    </div>
    <p class="small muted">Замена H на D почти вдвое увеличивает μ, но не меняет k (электронная структура та же): частота падает примерно в √2 раз — изотопный сдвиг, по которому отождествляют полосы.</p>
  </section>`);
  el.appendChild(ho);
  let dia = DIATOMIC[0];
  const ks = ho.querySelector("[data-ks]");
  const updO = () => {
    const k = +ks.value, mu = (dia.m1 * dia.m2) / (dia.m1 + dia.m2);
    const nu = Math.sqrt(k / (mu * 1.66054e-27)) / (2 * Math.PI);
    ho.querySelector("[data-k]").textContent = `${k} Н/м`;
    ho.querySelector("[data-out]").innerHTML = `μ = ${num(mu, 4)} а. е. м. → ν = ${num(nu / 1e13, 3)}·10¹³ Гц, <b>ν̃ = ${num(nu / 2.99792458e10, 0)} см⁻¹</b>, λ = ${num(1e4 / (nu / 2.99792458e10), 2)} мкм. Опыт: ${dia.exp} см⁻¹${dia.inactive ? " (только в спектре КР: у N₂ нет дипольного момента, и колебание его не создаёт — ИК-неактивно)" : ""}. Разница с опытом — ангармонизм реальной связи.`;
  };
  DIATOMIC.forEach((d, i) => {
    const b = h(`<button class="chip${i ? "" : " on"}" type="button">${d.label}</button>`);
    b.onclick = () => { ho.querySelectorAll("[data-d] .chip").forEach((x) => x.classList.toggle("on", x === b)); dia = d; ks.value = d.k; updO(); };
    ho.querySelector("[data-d]").appendChild(b);
  });
  ks.value = dia.k; ks.oninput = updO; updO();

  // ---------- Нормальные колебания в 3D ----------
  const ir = h(`<section id="ir"><h2>Нормальные колебания H₂O и CO₂ в 3D</h2>
    <p>У нелинейной молекулы из N атомов 3N − 6 ${term("y12_normalmode", "нормальных колебаний")}, у линейной 3N − 5. Это независимые «моды»: все атомы колеблются с одной частотой и в одной фазе. Найти их — снова задача на собственные значения. Строим матрицу вторых производных энергии (матрицу Гессе) 9×9 по декартовым смещениям, делим элементы на √(mᵢmⱼ) и диагонализуем методом Якоби. Собственные значения дают ω², векторы — формы колебаний. Ниже всё это посчитано прямо в браузере из простого силового поля (жёсткость связей, угла и их взаимодействие).</p>
    <p>Колебание ${term("y12_ir_active", "активно в ИК")}, только если меняет дипольный момент молекулы: ∂μ/∂Q ≠ 0.</p>
    <div class="chips" data-mol></div>
  </section>`);
  el.appendChild(ir);
  const st = stage(`<div class="overlay"><span data-a style="font-size:.95rem"></span><span data-b></span></div>`, { wide: true });
  ir.appendChild(st);
  const ctl = h(`<div class="card pad" style="margin-top:10px"><div class="chips" data-modes></div><p class="small" data-txt style="margin:10px 0 0"></p></div>`);
  ir.appendChild(ctl);
  const v = createViewer(st, { camera: [0, 1.2, 7], autoRotate: false, minDistance: 3 });
  const ms = createModeScene(v);
  const NAMES = {
    h2o: [["ножничное (деформационное) δ", "A₁"], ["симметричное валентное νₛ", "A₁"], ["антисимметричное валентное νₐₛ", "B₂"]],
    co2: [["деформационное δ (в плоскости xy)", "Πᵤ"], ["деформационное δ (в плоскости xz)", "Πᵤ"], ["симметричное валентное νₛ", "Σg⁺"], ["антисимметричное валентное νₐₛ", "Σᵤ⁺"]],
  };
  const setMol = (key) => {
    const mol = MODE_MOLS[key];
    ms.build(mol);
    frame(v, 2.3);
    const modes = computeModes(mol);
    const box = ctl.querySelector("[data-modes]");
    box.innerHTML = "";
    const maxMu = Math.max(...modes.map((m) => m.dmu));
    modes.forEach((md, i) => {
      const [nm, sym] = NAMES[key][i];
      const b = h(`<button class="chip" type="button">${num(md.nu, 0)} см⁻¹</button>`);
      b.onclick = () => {
        box.querySelectorAll(".chip").forEach((x) => x.classList.toggle("on", x === b));
        ms.setMode(md);
        const active = md.dmu > 0.02 * maxMu;
        st.querySelector("[data-a]").innerHTML = `<b>${mol.label}</b>: ${nm}`;
        st.querySelector("[data-b]").innerHTML = `${sym} · ${active ? "<b style='color:var(--good)'>ИК-активно</b>" : "<b style='color:var(--bad)'>ИК-неактивно</b>"}`;
        ctl.querySelector("[data-txt]").innerHTML = `Расчёт: <b>${num(md.nu, 0)} см⁻¹</b>, эксперимент: ${mol.exp[i]} см⁻¹. Изменение дипольного момента (модель точечных зарядов): |∂μ/∂Q| = ${num(md.dmu / maxMu, 2)} от максимального. ${active ? "Колебание меняет дипольный момент — поглощает ИК-излучение." : "Оба атома O симметрично удаляются от C: дипольный момент остаётся нулевым, полоса в ИК отсутствует (но видна в спектре комбинационного рассеяния)."} Жёлтые стрелки — смещения атомов; центр масс неподвижен.`;
      };
      box.appendChild(b);
    });
    box.querySelector(".chip").click();
  };
  Object.entries(MODE_MOLS).forEach(([k, m], i) => {
    const b = h(`<button class="chip${i ? "" : " on"}" type="button">${m.label}</button>`);
    b.onclick = () => { ir.querySelectorAll("[data-mol] .chip").forEach((x) => x.classList.toggle("on", x === b)); setMol(k); };
    ir.querySelector("[data-mol]").appendChild(b);
  });
  setMol("h2o");
  ir.appendChild(h(`<div class="callout"><b>Пример.</b> Почему CO₂ — парниковый газ, а N₂ и O₂ — нет? У CO₂ есть ИК-активные колебания: изгиб (667 см⁻¹, λ ≈ 15 мкм — как раз в максимуме теплового излучения Земли) и асимметричное валентное (2349 см⁻¹). У двухатомных N₂ и O₂ единственное колебание не меняет дипольный момент.</div>`));

  // ---------- ЯМР ----------
  const nmr = h(`<section id="nmr"><h2>ЯМР: химический сдвиг и мультиплеты</h2>
    <p>Ядро ¹H имеет спин ½ и в магнитном поле B₀ два уровня; переход между ними поглощает радиоволну ν = γB₀/2π (≈ 400 МГц при 9,4 Тл). Электроны вокруг ядра экранируют поле, поэтому протоны в разном окружении резонируют чуть по-разному. ${term("y12_shift", "Химический сдвиг")} δ = (ν − ν<sub>ТМС</sub>)/ν₀·10⁶ (м. д.) не зависит от прибора. Электроотрицательный кислород «оттягивает» электроны: CH₂ рядом с O сдвинут в слабое поле (3,7 м. д.), CH₃ — 1,2 м. д.</p>
    <p>Спин-спиновое взаимодействие с n эквивалентными соседними протонами расщепляет сигнал на n + 1 линий с интенсивностями из треугольника Паскаля; расстояние между линиями — константа J (Гц), она не зависит от поля.</p>
    <div class="two">
      <div class="card pad"><label class="ctl">Соседних протонов n: <b data-n></b><input type="range" min="0" max="6" value="3" data-ns></label><div class="pas" data-pas style="margin-top:8px"></div></div>
      <div class="card pad small"><b>Этанол CH₃–CH₂–OH</b><br>CH₃ (3H): соседи — 2H группы CH₂ → <b>триплет</b> 1:2:1<br>CH₂ (2H): соседи — 3H группы CH₃ → <b>квартет</b> 1:3:3:1<br>OH (1H): быстрый обмен протоном между молекулами усредняет спин — <b>синглет</b>. В очень чистом сухом спирте обмен медленный, и OH расщепляется на триплет, а CH₂ — на дублет квартетов.</div>
    </div>
    <div class="card pad" style="margin-top:12px">
      <div class="chips" data-f><button class="chip" type="button" data-mhz="60">60 МГц</button><button class="chip on" type="button" data-mhz="300">300 МГц</button></div>
      <div class="chips" style="margin-top:6px" data-dry><button class="chip on" type="button" data-v="0">обычный этанол</button><button class="chip" type="button" data-v="1">сухой этанол</button></div>
      <svg class="plot" viewBox="0 0 700 230" style="margin-top:10px" data-spec></svg>
      <div class="three" style="margin-top:10px" data-zoom></div>
    </div>
  </section>`);
  el.appendChild(nmr);
  const nsI = nmr.querySelector("[data-ns]");
  const updP = () => {
    const n = +nsI.value;
    nmr.querySelector("[data-n]").textContent = `${n} → ${n + 1} лини${n === 0 ? "я (синглет)" : n < 4 ? "и" : "й"}`;
    let rows = "", row = [1];
    for (let k = 0; k <= 6; k++) {
      rows += `<div class="${k === n ? "on" : ""}">${row.join("  ")}</div>`;
      row = [1, ...row.slice(1).map((x, i) => x + row[i]), 1];
    }
    nmr.querySelector("[data-pas]").innerHTML = rows;
  };
  nsI.oninput = updP; updP();
  let MHz = 300, dry = false;
  const updN = () => {
    const J = 7.0, Joh = 5.0;
    const groups = [
      { name: "CH₃", d: 1.18, H: 3, c: [[J, 2]] },
      { name: "CH₂", d: 3.69, H: 2, c: dry ? [[J, 3], [Joh, 1]] : [[J, 3]] },
      { name: "OH", d: dry ? 5.35 : 2.61, H: 1, c: dry ? [[Joh, 2]] : [] },
    ];
    const lines = groups.flatMap((g) => multiplet(g.d, g.c, g.H).map(([d, hz, w]) => [d + hz / MHz, w, g]));
    const X = (d) => 680 - (d / 6) * 660;
    const w = 0.9 / MHz; // ширина линии ~0,9 Гц в м. д.
    const spec = (d0, d1, N) => Array.from({ length: N + 1 }, (_, i) => { const d = d0 + ((d1 - d0) * i) / N; return [d, lines.reduce((s, [p, a]) => s + a / (1 + ((d - p) / w) ** 2), 0)]; });
    const pts = spec(0, 6, 3000);
    const mx = Math.max(...pts.map((p) => p[1]));
    const path = pts.map(([d, y], i) => `${i ? "L" : "M"}${X(d).toFixed(1)},${(190 - (y / mx) * 160).toFixed(1)}`).join("");
    let s = `<line x1="20" x2="680" y1="190" y2="190" stroke="var(--line-2)"/><path d="${path}" fill="none" stroke="#4fb3ff" stroke-width="1.5"/>`;
    for (let d = 0; d <= 6; d++) s += `<text x="${X(d)}" y="208" text-anchor="middle" font-size="12" fill="var(--text-3)">${d}</text>`;
    s += `<text x="680" y="225" text-anchor="end" font-size="11" fill="var(--text-3)">δ, м. д. (поле растёт →)</text><text x="${X(0)}" y="180" text-anchor="middle" font-size="10" fill="var(--text-3)">ТМС</text><line x1="${X(0)}" x2="${X(0)}" y1="186" y2="190" stroke="var(--text-3)"/>`;
    for (const g of groups) s += `<text x="${X(g.d)}" y="22" text-anchor="middle" font-size="12" fill="var(--text)">${g.name} · ${g.H}H</text>`;
    nmr.querySelector("[data-spec]").innerHTML = s;
    nmr.querySelector("[data-zoom]").innerHTML = groups.map((g) => {
      const half = 22 / MHz;
      const zp = spec(g.d - half, g.d + half, 400), zm = Math.max(...zp.map((p) => p[1]));
      const Z = (d) => 190 - ((d - (g.d - half)) / (2 * half)) * 180;
      const p = zp.map(([d, y], i) => `${i ? "L" : "M"}${Z(d).toFixed(1)},${(100 - (y / zm) * 80).toFixed(1)}`).join("");
      const kind = { 1: "синглет", 3: "триплет", 4: "квартет", 8: "дублет квартетов" }[multiplet(0, g.c, 1).length] || `${multiplet(0, g.c, 1).length} линий`;
      return `<div><svg class="plot" viewBox="0 0 200 120"><path d="${p}" fill="none" stroke="#ff8a5c" stroke-width="1.5"/><text x="8" y="14" font-size="11" fill="var(--text-2)">${g.name}: ${kind}</text><text x="8" y="114" font-size="10" fill="var(--text-3)">±22 Гц</text></svg></div>`;
    }).join("");
  };
  nmr.querySelectorAll("[data-mhz]").forEach((b) => (b.onclick = () => { nmr.querySelectorAll("[data-mhz]").forEach((x) => x.classList.toggle("on", x === b)); MHz = +b.dataset.mhz; updN(); }));
  nmr.querySelectorAll("[data-dry] .chip").forEach((b) => (b.onclick = () => { nmr.querySelectorAll("[data-dry] .chip").forEach((x) => x.classList.toggle("on", x === b)); dry = b.dataset.v === "1"; updN(); }));
  updN();
  nmr.appendChild(h(`<div class="callout warn"><b>Важно.</b> J измеряется в герцах и от поля не зависит, а химический сдвиг в герцах растёт с полем. Поэтому на 60 МГц мультиплет CH₃ занимает 14/60 = 0,23 м. д., а на 300 МГц — всего 0,047 м. д.: спектр «растягивается», и перекрывающиеся мультиплеты разделяются. Площадь под сигналом пропорциональна числу протонов: 3 : 2 : 1.</div>`));
}

export const quiz = [
  { q: "Какая серия спектра водорода лежит в видимой области?", options: ["Лаймана", "Бальмера", "Пашена", "Пфунда"], answer: 1, why: "Переходы на n₁ = 2: Hα 656 нм (красная), Hβ 486 нм, Hγ 434 нм, Hδ 410 нм." },
  { q: "Длина волны линии Hα (переход 3 → 2):", options: ["122 нм", "486 нм", "656 нм", "1875 нм"], answer: 2, why: "1/λ = R(1/4 − 1/9) = 5R/36 → λ ≈ 656 нм." },
  { q: "Сколько нормальных колебаний у молекулы CO₂?", options: ["3", "4", "5", "6"], answer: 1, why: "Линейная молекула: 3N − 5 = 9 − 5 = 4 (одно из них — дважды вырожденный изгиб)." },
  { q: "Какое колебание CO₂ неактивно в ИК-спектре?", options: ["Изгиб", "Антисимметричное валентное", "Симметричное валентное", "Все активны"], answer: 2, why: "При симметричном растяжении дипольный момент остаётся нулевым." },
  { q: "Как изменится частота колебания H–Cl при замене H на D?", options: ["Вырастет в 2 раза", "Почти не изменится", "Уменьшится примерно в √2 раз", "Уменьшится в 2 раза"], answer: 2, why: "ν ∝ 1/√μ, а μ почти удваивается (k не меняется)." },
  { q: "Сигнал CH₂ в спектре ЯМР этанола (обычного) — это…", options: ["синглет", "дублет", "триплет", "квартет"], answer: 3, why: "Три соседних протона CH₃: n + 1 = 4 линии 1:3:3:1." },
];
