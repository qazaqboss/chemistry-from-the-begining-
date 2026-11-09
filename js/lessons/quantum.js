import { h, kid, term, stage } from "../ui.js";
import { createViewer } from "../three/core.js";
import { createCloud, createBox2D, radial, angName } from "../three/quantum-cloud.js";
import { jacobiEigen, matrixHTML, num } from "../three/qm-linalg.js";

const H = 6.62607015e-34, ME = 9.1093837e-31, EV = 1.602176634e-19;
const fmtE = (x) => {
  if (!isFinite(x)) return "—";
  const e = Math.floor(Math.log10(Math.abs(x)));
  if (e >= -2 && e < 4) return num(x, 3);
  const m = x / Math.pow(10, e);
  return `${num(m, 2)}·10${String(e).replace("-", "⁻").replace(/\d/g, (d) => "⁰¹²³⁴⁵⁶⁷⁸⁹"[d])}`;
};

const PARTICLES = [
  { id: "e", label: "Электрон", m: ME, v: 2.2e6, note: "скорость электрона на первой боровской орбите" },
  { id: "p", label: "Протон", m: 1.67262e-27, v: 1e5, note: "протон в ускорителе на малых энергиях" },
  { id: "n", label: "Нейтрон (тепловой)", m: 1.67493e-27, v: 2200, note: "тепловые нейтроны — инструмент нейтронографии" },
  { id: "c60", label: "Фуллерен C₆₀", m: 720 * 1.66054e-27, v: 220, note: "в 1999 г. А. Цайлингер наблюдал интерференцию молекул C₆₀" },
  { id: "ball", label: "Теннисный мяч", m: 0.057, v: 50, note: "подача профессионала" },
];

export async function render(el) {
  el.classList.add("qm-q");
  el.appendChild(h(`<div>
    <style>
      .qm-q svg{width:100%;height:auto;display:block}
      .qm-q .plot{background:var(--surface-2);border-radius:12px;border:1px solid var(--line)}
      .qm-q .two{display:grid;grid-template-columns:1fr 1fr;gap:14px}
      @media (max-width:700px){.qm-q .two{grid-template-columns:1fr}}
      .qm-q .big{font-family:var(--mono);font-size:1.25rem;font-weight:800;color:var(--text)}
      .qm-q .qn td,.qm-q .qn th{text-align:center}
    </style>
    <p class="lead">В начале XX века оказалось, что электрон в атоме не похож ни на шарик, ни на планету. Он ведёт себя как волна, а наблюдаемые величины — энергия, момент импульса — принимают только дискретные значения. Квантовая механика описывает это одним уравнением, а химия получает из него форму орбиталей и всю таблицу Менделеева.</p>
    ${kid("Представь гитарную струну: она звучит только определёнными нотами, потому что концы закреплены. Электрон в атоме — тоже «волна, зажатая со всех сторон», поэтому у него бывают только определённые энергии. Это и есть «кванты».")}
  </div>`));

  // ---------- Дуализм ----------
  const dual = h(`<section id="duality"><h2>Волна или частица: λ = h/p</h2>
    <p>Луи де Бройль (1924) предположил, что любой частице с импульсом <i>p</i> = <i>mv</i> соответствует волна длиной</p>
    <div class="eq">λ = h / p = h / (m·v), &nbsp; h = 6,626·10⁻³⁴ Дж·с</div>
    <p>В 1927 г. Дэвиссон и Джермер получили дифракцию электронов на кристалле никеля — так же, как рентгеновские лучи. Волновые свойства заметны, только если λ сравнима с размером препятствия. Для атомов и межатомных расстояний это ~10⁻¹⁰ м = 1 Å.</p>
    <div class="card pad">
      <div class="chips" data-p></div>
      <label class="ctl" style="margin-top:12px">Скорость: <b data-v></b><input type="range" min="0" max="7.4" step="0.01" data-vs></label>
      <p style="margin:10px 0 0">Длина волны де Бройля: <span class="big" data-l></span></p>
      <p class="small muted" data-note style="margin:6px 0 0"></p>
    </div>
    <div class="callout adv">Для электрона, ускоренного разностью потенциалов <i>U</i>: <i>p</i> = √(2<i>m</i>ₑ<i>eU</i>), λ ≈ 1,226/√<i>U</i> нм. При 100 В λ = 0,123 нм — ровно масштаб кристаллической решётки. На этом работает электронный микроскоп.</div>
  </section>`);
  el.appendChild(dual);
  let part = PARTICLES[0];
  const vs = dual.querySelector("[data-vs]");
  const updDual = () => {
    const v = Math.pow(10, +vs.value);
    const lam = H / (part.m * v);
    dual.querySelector("[data-v]").textContent = `${fmtE(v)} м/с`;
    let size = lam > 1e-6 ? "≫ размера атома: волна огромна" : lam > 1e-11 ? "сравнима с размером атома — дифракция на кристалле заметна" : lam > 1e-20 ? "намного меньше атома — волновые свойства почти не видны" : "в 10²⁰ раз меньше протона — частица ведёт себя классически";
    dual.querySelector("[data-l]").textContent = `${fmtE(lam)} м  (${fmtE(lam * 1e10)} Å)`;
    dual.querySelector("[data-note]").textContent = `m = ${fmtE(part.m)} кг · ${size}. Пример: ${part.note}.`;
  };
  PARTICLES.forEach((p, i) => {
    const b = h(`<button class="chip${i ? "" : " on"}" type="button">${p.label}</button>`);
    b.onclick = () => { dual.querySelectorAll("[data-p] .chip").forEach((x) => x.classList.remove("on")); b.classList.add("on"); part = p; vs.value = Math.log10(p.v); updDual(); };
    dual.querySelector("[data-p]").appendChild(b);
  });
  vs.value = Math.log10(part.v);
  vs.oninput = updDual;
  updDual();

  // ---------- Шрёдингер как задача на собственные значения ----------
  const sch = h(`<section id="schrodinger"><h2>Уравнение Шрёдингера — задача на собственные значения</h2>
    <p>Стационарное уравнение Шрёдингера для одной частицы:</p>
    <div class="eq">Ĥψ = Eψ, &nbsp; Ĥ = −(ħ²/2m)·d²/dx² + V(x)</div>
    <p>Здесь ${term("y12_wavefn", "волновая функция")} ψ(x) — амплитуда, а |ψ(x)|²·dx — вероятность найти частицу в интервале dx (интерпретация Борна). ${term("y12_hamiltonian", "Гамильтониан")} Ĥ — оператор полной энергии. Уравнение говорит: подействовать на ψ оператором — всё равно что умножить на число E. Это ровно определение ${term("y12_eigen", "собственного значения")}, как у матриц: <i>A</i><b>v</b> = λ<b>v</b>.</p>
    <p>Связь буквальная. Разобьём отрезок [0, L] на N внутренних точек с шагом Δx, а вторую производную заменим разностью: ψ″ ≈ (ψᵢ₋₁ − 2ψᵢ + ψᵢ₊₁)/Δx². Тогда Ĥ превращается в трёхдиагональную матрицу N×N, и её собственные значения приближают энергии уровней (V = 0 внутри ящика, ψ = 0 на стенках):</p>
    <div data-m style="overflow-x:auto"></div>
    <label class="ctl" style="margin-top:8px">Число точек сетки N: <b data-n></b><input type="range" min="3" max="40" value="6"></label>
    <div class="table-wrap"><table class="data" data-t></table></div>
    <p class="small muted" data-info></p>
  </section>`);
  el.appendChild(sch);
  const updSch = () => {
    const N = +sch.querySelector("input").value;
    sch.querySelector("[data-n]").textContent = N;
    const A = Array.from({ length: N }, (_, i) => Array.from({ length: N }, (_, j) => (i === j ? 2 : Math.abs(i - j) === 1 ? -1 : 0)));
    const shown = Math.min(N, 7);
    const small = A.slice(0, shown).map((r) => r.slice(0, shown));
    sch.querySelector("[data-m]").innerHTML = `<div class="qm-mats"><span class="op">Ĥ = (ħ²/2mΔx²)·</span>${matrixHTML(small, { fmt: (x) => num(x, 0), cls: (i, j, x) => (i === j ? "dg" : x ? "" : "z") })}${N > shown ? `<span class="op">… (${N}×${N})</span>` : ""}</div>`;
    const { values, rotations, sweeps } = jacobiEigen(A);
    // в единицах E₁(точное) = π²ħ²/(2mL²); Δx = L/(N+1)
    const k = (N + 1) ** 2 / (Math.PI ** 2);
    let rows = `<tr><th>n</th><th>Eₙ / E₁ (матрица)</th><th>Eₙ / E₁ = n² (точно)</th><th>ошибка</th></tr>`;
    for (let n = 1; n <= Math.min(4, N); n++) {
      const e = values[n - 1] * k;
      rows += `<tr><td>${n}</td><td>${num(e, 4)}</td><td>${n * n}</td><td>${num((100 * (n * n - e)) / (n * n), 2)} %</td></tr>`;
    }
    sch.querySelector("[data-t]").innerHTML = rows;
    sch.querySelector("[data-info]").textContent = `Собственные значения найдены методом вращений Якоби: ${rotations} вращений за ${sweeps} проходов. Чем мельче сетка, тем ближе к точному ответу n²: матрица «становится» оператором.`;
  };
  sch.querySelector("input").oninput = updSch;
  updSch();

  // ---------- Частица в ящике ----------
  const box = h(`<section id="box"><h2>Частица в одномерном ящике</h2>
    <p>Внутри ящика V = 0, снаружи V = ∞, поэтому ψ(0) = ψ(L) = 0. Решения — стоячие волны, на длине L укладывается целое число полуволн:</p>
    <div class="eq">ψₙ(x) = √(2/L)·sin(nπx/L), &nbsp; Eₙ = n²h² / (8mL²), &nbsp; n = 1, 2, 3…</div>
    <p>Три вывода, важные для химии: (1) энергия квантуется; (2) даже при n = 1 энергия не равна нулю — «нулевая энергия», следствие принципа неопределённости; (3) у ψₙ ровно n − 1 узлов — точек, где частицу найти нельзя.</p>
    <div class="card pad">
      <div class="two">
        <label class="ctl">Квантовое число n: <b data-n></b><input type="range" min="1" max="8" value="1" data-ns></label>
        <label class="ctl">Длина ящика L: <b data-L></b><input type="range" min="0.2" max="3" step="0.05" value="1" data-ls></label>
      </div>
      <div class="two" style="margin-top:12px">
        <svg class="plot" viewBox="0 0 400 240" data-psi></svg>
        <svg class="plot" viewBox="0 0 400 240" data-lev></svg>
      </div>
      <p class="small" data-out style="margin:10px 0 0"></p>
    </div>
    <div class="callout"><b>Пример.</b> π-электроны бутадиена «живут» на длине ≈ 0,58 нм. 4 электрона заполняют n = 1 и 2; поглощение — переход 2 → 3: ΔE = (9 − 4)h²/(8mL²) ≈ 5,6 эВ, λ = hc/ΔE ≈ 220 нм — опыт даёт 217 нм. Чем длиннее сопряжённая цепь, тем меньше ΔE: поэтому каротин (11 сопряжённых связей) окрашен.</div>
  </section>`);
  el.appendChild(box);
  const ns = box.querySelector("[data-ns]"), ls = box.querySelector("[data-ls]");
  const updBox = () => {
    const n = +ns.value, L = +ls.value;
    box.querySelector("[data-n]").textContent = n;
    box.querySelector("[data-L]").textContent = `${num(L, 2)} нм`;
    const W = 360, x0 = 20, mid = 120, A = 80;
    let p1 = "", p2 = `M${x0},${mid + A}`;
    for (let i = 0; i <= 200; i++) {
      const x = i / 200, s = Math.sin(n * Math.PI * x);
      p1 += `${i ? "L" : "M"}${(x0 + x * W).toFixed(1)},${(mid - A * 0.8 * s).toFixed(1)}`;
      p2 += `L${(x0 + x * W).toFixed(1)},${(mid + A - A * 1.6 * s * s * 0.5).toFixed(1)}`;
    }
    p2 += `L${x0 + W},${mid + A}Z`;
    let nodes = "";
    for (let k = 1; k < n; k++) nodes += `<circle cx="${x0 + (k / n) * W}" cy="${mid}" r="3.5" fill="var(--warn)"/>`;
    box.querySelector("[data-psi]").innerHTML = `
      <rect x="${x0 - 6}" y="20" width="6" height="200" fill="var(--text-3)"/><rect x="${x0 + W}" y="20" width="6" height="200" fill="var(--text-3)"/>
      <line x1="${x0}" x2="${x0 + W}" y1="${mid}" y2="${mid}" stroke="var(--line-2)"/>
      <path d="${p2}" fill="rgba(255,138,92,.28)" stroke="#ff8a5c" stroke-width="1.5"/>
      <path d="${p1}" fill="none" stroke="#4fb3ff" stroke-width="2.5"/>${nodes}
      <text x="28" y="18" font-size="13" fill="#4fb3ff">ψₙ(x)</text><text x="90" y="18" font-size="13" fill="#ff8a5c">|ψₙ|² (снизу)</text>
      <text x="${x0}" y="236" font-size="12" fill="var(--text-3)">0</text><text x="${x0 + W - 10}" y="236" font-size="12" fill="var(--text-3)">L</text>`;
    const E = (k) => (k * k * H * H) / (8 * ME * (L * 1e-9) ** 2) / EV;
    const Emax = E(8);
    let lev = "";
    for (let k = 1; k <= 8; k++) {
      const y = 220 - (E(k) / Emax) * 195;
      const on = k === n;
      lev += `<line x1="60" x2="250" y1="${y}" y2="${y}" stroke="${on ? "#4fb3ff" : "var(--text-3)"}" stroke-width="${on ? 3 : 1.5}"/>
        <text x="14" y="${y + 4}" font-size="12" fill="var(--text-2)">n=${k}</text><text x="260" y="${y + 4}" font-size="12" fill="${on ? "var(--text)" : "var(--text-3)"}">${num(E(k), E(k) < 1 ? 3 : 2)} эВ</text>`;
    }
    box.querySelector("[data-lev]").innerHTML = `<text x="14" y="16" font-size="13" fill="var(--text-2)">Уровни электрона, Eₙ ∝ n²</text>${lev}`;
    const dE = E(n + 1) - E(n);
    box.querySelector("[data-out]").innerHTML = `Электрон: E<sub>${n}</sub> = <b>${num(E(n), 3)} эВ</b>; узлов: ${n - 1}. Переход ${n} → ${n + 1}: ΔE = ${num(dE, 3)} эВ, λ = hc/ΔE = <b>${num(1239.84 / dE, 0)} нм</b>. Увеличь L — уровни сближаются как 1/L².`;
  };
  ns.oninput = ls.oninput = updBox;
  updBox();

  // ---------- 2D-ящик в 3D ----------
  const b2 = h(`<section id="box2d"><h2>Ящик в двух измерениях: вырождение</h2>
    <p>В квадратном ящике L×L переменные разделяются: ψ = ψₙₓ(x)·ψₙᵧ(y), E = (nₓ² + nᵧ²)·h²/(8mL²). Состояния (1, 2) и (2, 1) — разные функции с одинаковой энергией. Это <b>вырождение</b>, и оно — следствие симметрии квадрата (тот же механизм делает три p-орбитали равными по энергии). Поверхность ниже — ψ(x, y), колеблющаяся во времени как ψ·cos(Et/ħ): синий — ψ > 0, оранжевый — ψ < 0.</p>
  </section>`);
  el.appendChild(b2);
  const st2 = stage(`<div class="overlay"><span data-a></span><span data-b></span></div>`, { wide: true });
  b2.appendChild(st2);
  const c2 = h(`<div class="card pad" style="margin-top:10px"><div class="two">
    <label class="ctl">nₓ: <b data-x>1</b><input type="range" min="1" max="4" value="1" data-xs></label>
    <label class="ctl">nᵧ: <b data-y>2</b><input type="range" min="1" max="4" value="2" data-ys></label></div>
    <div class="chips" style="margin-top:10px"><button class="chip on" type="button" data-m="psi">ψ(x, y, t)</button><button class="chip" type="button" data-m="prob">|ψ|²</button></div></div>`);
  b2.appendChild(c2);
  const v2 = createViewer(st2, { camera: [5.5, 6, 7.5], autoRotateSpeed: 0.4, fitWidth: 5 });
  const surf = createBox2D(v2);
  let prob = false;
  const upd2 = () => {
    const a = +c2.querySelector("[data-xs]").value, b = +c2.querySelector("[data-ys]").value;
    c2.querySelector("[data-x]").textContent = a; c2.querySelector("[data-y]").textContent = b;
    surf.set(a, b, prob);
    const e = a * a + b * b;
    const deg = [];
    for (let i = 1; i <= 7; i++) for (let j = 1; j <= 7; j++) if (i * i + j * j === e) deg.push(`(${i},${j})`);
    st2.querySelector("[data-a]").innerHTML = `<b>ψ<sub>${a},${b}</sub></b> · E = ${e}·h²/(8mL²)`;
    st2.querySelector("[data-b]").textContent = deg.length > 1 ? `вырождение ${deg.length}: ${deg.join(" ")}` : "невырожденный уровень";
  };
  c2.querySelectorAll("input").forEach((i) => (i.oninput = upd2));
  c2.querySelectorAll("[data-m]").forEach((b) => (b.onclick = () => { c2.querySelectorAll("[data-m]").forEach((x) => x.classList.toggle("on", x === b)); prob = b.dataset.m === "prob"; upd2(); }));
  upd2();

  // ---------- Атом водорода ----------
  const hyd = h(`<section id="hydrogen"><h2>Атом водорода: облака |ψ|² в 3D</h2>
    <p>Для атома водорода уравнение Шрёдингера решается точно. В сферических координатах ψₙₗₘ(r, θ, φ) = Rₙₗ(r)·Yₗₘ(θ, φ): радиальная часть содержит многочлены Лагерра, угловая — сферические гармоники. Энергия зависит только от n:</p>
    <div class="eq">Eₙ = −13,6 эВ / n², &nbsp; Rₙₗ ∝ ρˡ e^(−ρ/2) L<sub>n−l−1</sub><sup>2l+1</sup>(ρ), ρ = 2r/(na₀)</div>
    <p>Ниже каждая точка — одно «измерение положения» электрона, разыгранное по распределению |ψ|². Радиус выбирается из r²R²ₙₗ(r), направление — методом отклонения по |Y|². Цвет — знак ψ. Видно, что у орбитали n − l − 1 радиальных узлов (сферических «пустот») и l угловых узловых поверхностей.</p>
  </section>`);
  el.appendChild(hyd);
  const st3 = stage(`<div class="overlay"><span data-a style="font-size:1rem"></span><span data-b></span></div>`, { wide: true });
  hyd.appendChild(st3);
  const c3 = h(`<div class="card pad" style="margin-top:10px">
    <div class="two"><div>
      <label class="ctl">Главное n: <b data-n></b><input type="range" min="1" max="4" value="2" data-n></label>
      <label class="ctl" style="margin-top:8px">Орбитальное l: <b data-l></b><input type="range" min="0" max="1" value="1" data-l></label>
      <label class="ctl" style="margin-top:8px">Магнитное m: <b data-m></b><input type="range" min="-1" max="1" value="0" data-m></label>
      <div class="chips" style="margin-top:10px">${[["1s", 1, 0, 0], ["2s", 2, 0, 0], ["2p", 2, 1, 0], ["3p", 3, 1, 1], ["3d", 3, 2, 0], ["3d_xy", 3, 2, -2], ["4f", 4, 3, 0]].map(([t, n, l, m]) => `<button class="chip" type="button" data-pre="${n},${l},${m}">${t.replace("_xy", "<sub>xy</sub>")}</button>`).join("")}</div>
    </div><svg class="plot" viewBox="0 0 400 220" data-rad></svg></div>
    <p class="small muted" style="margin:10px 0 0">Показаны действительные орбитали (p_x, p_y, d_xy…): это линейные комбинации функций с +m и −m, именно их рисуют химики. Число m при этом указывает на |m| и тип комбинации.</p>
  </div>`);
  hyd.appendChild(c3);
  const v3 = createViewer(st3, { camera: [14, 9, 18], autoRotateSpeed: 0.5, maxDistance: 160 });
  const cloud = createCloud(v3);
  const [nI, lI, mI] = ["n", "l", "m"].map((k) => c3.querySelector(`input[data-${k}]`));
  const updH = () => {
    const n = +nI.value;
    lI.max = n - 1; if (+lI.value > n - 1) lI.value = n - 1;
    const l = +lI.value;
    mI.min = -l; mI.max = l; if (Math.abs(+mI.value) > l) mI.value = 0;
    const m = +mI.value;
    c3.querySelector("b[data-n]").textContent = n; c3.querySelector("b[data-l]").textContent = `${l} (${"spdf"[l]})`; c3.querySelector("b[data-m]").textContent = m;
    const s = cloud.set(n, l, m, 9000 + 3500 * n);
    const R = Math.min(s.rMax, 2.2 * n * n + 2);
    const d = 2.6 * R + 6;
    v3.camera.position.setLength(d);
    const name = `${n}${angName(l, m).replace(/_(\S+)/, "<sub>$1</sub>")}`;
    st3.querySelector("[data-a]").innerHTML = `<b>${name}</b>`;
    st3.querySelector("[data-b]").textContent = `E = −13,6/${n}² = ${num(-13.6 / n / n, 3)} эВ · радиальных узлов ${n - l - 1}, угловых ${l}`;
    // радиальное распределение
    const rM = 2.2 * n * n + 4 * n;
    let pts = [], mx = 0;
    for (let i = 0; i <= 240; i++) { const r = (i / 240) * rM, R2 = r * r * radial(n, l, r) ** 2; pts.push([r, R2]); mx = Math.max(mx, R2); }
    const path = pts.map(([r, p], i) => `${i ? "L" : "M"}${(30 + (r / rM) * 355).toFixed(1)},${(195 - (p / mx) * 160).toFixed(1)}`).join("");
    const peak = pts.reduce((a, b) => (b[1] > a[1] ? b : a));
    c3.querySelector("[data-rad]").innerHTML = `<text x="30" y="18" font-size="13" fill="var(--text-2)">P(r) = r²R²ₙₗ — вероятность на расстоянии r</text>
      <line x1="30" x2="385" y1="195" y2="195" stroke="var(--line-2)"/><path d="${path}L385,195L30,195Z" fill="rgba(79,179,255,.25)" stroke="#4fb3ff" stroke-width="2"/>
      <text x="30" y="214" font-size="11" fill="var(--text-3)">0</text><text x="345" y="214" font-size="11" fill="var(--text-3)">${num(rM, 0)} a₀</text>
      <text x="${Math.min(300, 30 + (peak[0] / rM) * 355)}" y="${35 + 0}" font-size="11" fill="var(--text)">максимум ≈ ${num(peak[0], 1)} a₀</text>`;
  };
  [nI, lI, mI].forEach((i) => (i.oninput = updH));
  c3.querySelectorAll("[data-pre]").forEach((b) => (b.onclick = () => { const [n, l, m] = b.dataset.pre.split(",").map(Number); nI.value = n; lI.max = n - 1; lI.value = l; mI.min = -l; mI.max = l; mI.value = m; updH(); }));
  updH();
  hyd.appendChild(h(`<p class="small muted">Для 1s максимум P(r) — ровно при r = a₀ = 0,529 Å: это боровский радиус. Но электрон бывает и ближе, и дальше — «орбиты» нет, есть облако.</p>`));

  // ---------- Квантовые числа ----------
  const qn = h(`<section id="numbers"><h2>Четыре квантовых числа</h2>
    <p>Состояние электрона в атоме задаётся четырьмя ${term("y12_qnumbers", "квантовыми числами")}. Первые три приходят из решения уравнения Шрёдингера, четвёртое (спин) — из релятивистской теории Дирака.</p>
    <div class="table-wrap"><table class="data qn">
      <tr><th>Число</th><th>Значения</th><th>Что определяет</th></tr>
      <tr><td>n — главное</td><td>1, 2, 3, …</td><td>энергию (в H) и размер, ⟨r⟩ ∝ n²</td></tr>
      <tr><td>l — орбитальное</td><td>0 … n − 1 (s, p, d, f)</td><td>форму; |L| = ħ√(l(l+1))</td></tr>
      <tr><td>mₗ — магнитное</td><td>−l … +l</td><td>ориентацию; L_z = mₗħ</td></tr>
      <tr><td>mₛ — спиновое</td><td>+½, −½</td><td>проекцию спина; S_z = mₛħ</td></tr>
    </table></div>
    <p><b>Принцип Паули</b>: у двух электронов атома не может быть одинакового набора всех четырёх чисел. Отсюда — не больше 2 электронов на ${term("orbital", "орбитали")}, n² орбиталей и 2n² электронов на уровне.</p>
    <div class="card pad"><label class="ctl">Перечислить состояния для n = <b data-n>2</b><input type="range" min="1" max="4" value="2"></label><div data-list class="small" style="margin-top:10px;line-height:1.9"></div></div>
  </section>`);
  el.appendChild(qn);
  const updQ = () => {
    const n = +qn.querySelector("input").value;
    qn.querySelector("[data-n]").textContent = n;
    let html = "", cnt = 0;
    for (let l = 0; l < n; l++) {
      const ms = [];
      for (let m = -l; m <= l; m++) ms.push(`(${n}, ${l}, ${String(m).replace("-", "−")}, ±½)`);
      cnt += 2 * (2 * l + 1);
      html += `<div><b>${n}${"spdf"[l]}</b> — ${2 * l + 1} орбитал${2 * l + 1 === 1 ? "ь" : 2 * l + 1 < 5 ? "и" : "ей"}: <span class="muted">${ms.join(" ")}</span></div>`;
    }
    qn.querySelector("[data-list]").innerHTML = html + `<div style="margin-top:6px">Итого: <b>${n * n}</b> орбиталей, <b>${cnt}</b> электронов = 2n².</div>`;
  };
  qn.querySelector("input").oninput = updQ;
  updQ();
  qn.appendChild(h(`<div class="callout warn"><b>Важно.</b> В многоэлектронных атомах энергия зависит уже и от l: электроны экранируют ядро друг от друга, и s-орбиталь (проникает ближе к ядру) ниже p. Отсюда правило Клечковского (n + l) и то, что 4s заполняется раньше 3d.</div>`));
}

export const quiz = [
  { q: "Как изменится длина волны де Бройля электрона, если его скорость увеличить вдвое?", options: ["Увеличится вдвое", "Уменьшится вдвое", "Уменьшится в 4 раза", "Не изменится"], answer: 1, why: "λ = h/(mv): обратно пропорциональна скорости." },
  { q: "Энергия частицы в ящике Eₙ = n²h²/(8mL²). Во сколько раз E₃ больше E₁?", options: ["3", "6", "9", "27"], answer: 2, why: "Отношение n²: 3² / 1² = 9." },
  { q: "Как изменятся уровни, если ящик сделать вдвое длиннее?", options: ["Вырастут в 2 раза", "Уменьшатся в 2 раза", "Уменьшатся в 4 раза", "Не изменятся"], answer: 2, why: "E ∝ 1/L². Поэтому длинные сопряжённые молекулы поглощают видимый свет." },
  { q: "Сколько радиальных узлов у орбитали 3s?", options: ["0", "1", "2", "3"], answer: 2, why: "n − l − 1 = 3 − 0 − 1 = 2." },
  { q: "Какой набор квантовых чисел (n, l, mₗ) невозможен?", options: ["(2, 1, −1)", "(3, 2, 2)", "(2, 2, 0)", "(4, 0, 0)"], answer: 2, why: "l может быть только от 0 до n − 1; при n = 2 l = 2 нельзя." },
  { q: "Почему уравнение Ĥψ = Eψ называют задачей на собственные значения?", options: ["Его решают только численно", "Оператор, действуя на ψ, умножает её на число E — как A·v = λv", "В нём нет производных", "Оно описывает только собственный атом"], answer: 1, why: "Дискретизация превращает Ĥ в матрицу, а энергии — в её собственные числа." },
];
