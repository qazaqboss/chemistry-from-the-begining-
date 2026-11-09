import { h, kid, term, stage } from "../ui.js";
import { createViewer, THREE, sphereGeo, glossy } from "../three/core.js";
import { simClock, svgPlot, plotStyles } from "../three/y1011-kit.js";

const R = 8.314, DH = 57200; // N₂O₄ ⇄ 2NO₂, ΔH = +57,2 кДж/моль
const fmtN = (x, d = 2) => Number(x).toLocaleString("ru-RU", { maximumFractionDigits: d });
const S = 40; // молекул на «1 моль/л» при V = 1 (условные единицы)
const K_T = (T) => 0.5 * Math.exp((-DH / R) * (1 / T - 1 / 298));

export async function render(el) {
  el.appendChild(h(`<div>${plotStyles()}
    <p class="lead">Многие реакции идут одновременно в обе стороны. Когда скорости прямой и обратной реакций сравниваются, концентрации перестают меняться — наступает ${term("equilibrium", "химическое равновесие")}. Снаружи всё замерло, но на уровне молекул превращения не прекращаются ни на миг.</p>
    ${kid("Представь два магазина и покупателей, которые ходят туда-обратно. Когда из первого во второй каждую минуту уходит столько же людей, сколько возвращается, число людей в каждом магазине не меняется — хотя все бегают!")}
  </div>`));

  el.appendChild(h(`<section id="reversible"><h2>Обратимые реакции и динамическое равновесие</h2>
    <p>Необратимые реакции идут практически до конца — обычно когда продукт уходит из сферы реакции (газ, осадок, вода) или выделяется очень много энергии (горение). Обратимые записывают со знаком ⇄:</p>
    <div class="eq">N₂ + 3H₂ ⇄ 2NH₃ &nbsp;&nbsp; N₂O₄ ⇄ 2NO₂ &nbsp;&nbsp; CH₃COOH + C₂H₅OH ⇄ CH₃COOC₂H₅ + H₂O</div>
    <p>В начале скорость прямой реакции максимальна, обратной — ноль. По мере накопления продуктов v→ падает, v← растёт, пока не станет <b>v→ = v←</b>. Признаки равновесия: оно <b>динамическое</b>, достигается с обеих сторон (из реагентов и из продуктов), устойчиво при неизменных условиях и смещается при их изменении. О том, как быстро оно устанавливается, — урок <a href="#lesson-kinetics">«Скорость реакций и катализ»</a>.</p>
  </section>`));

  // ---------- K ----------
  const s2 = h(`<section id="constant"><h2>Константа равновесия</h2>
    <p>Для реакции aA + bB ⇄ cC + dD в состоянии равновесия выполняется (закон действующих масс для равновесия):</p>
    <div class="eq">K = [C]ᶜ·[D]ᵈ / ([A]ᵃ·[B]ᵇ)</div>
    <p>${term("eq_constant", "Константа")} K зависит только от природы реакции и <b>температуры</b> — не от концентраций, давления и катализатора. Твёрдые вещества и растворитель в выражение не входят: для CaCO₃(тв) ⇄ CaO(тв) + CO₂ K = [CO₂]. K ≫ 1 — равновесие сдвинуто к продуктам, K ≪ 1 — к реагентам. Если подставить текущие концентрации, получится <b>коэффициент реакции Q</b>: при Q &lt; K реакция идёт вправо, при Q &gt; K — влево.</p>
    <p>Решим «таблицей изменений»: <span class="formula">H₂ + I₂ ⇄ 2HI</span>, при 448 °C K ≈ 50. Задай начальные концентрации:</p></section>`);
  el.appendChild(s2);
  const ice = h(`<div class="card pad">
    <div class="yk-grid"><label class="ctl">[H₂]₀, моль/л<input type="number" data-a value="1" min="0" step="0.1"></label><label class="ctl">[I₂]₀, моль/л<input type="number" data-b value="1" min="0" step="0.1"></label><label class="ctl">[HI]₀, моль/л<input type="number" data-c value="0" min="0" step="0.1"></label><label class="ctl">K<input type="number" data-k value="50" min="0.01" step="1"></label></div>
    <div class="table-wrap" style="margin-top:12px"><table class="data" data-t></table></div><p data-o class="yk-out small"></p></div>`);
  s2.appendChild(ice);
  const solve = () => {
    const a = +ice.querySelector("[data-a]").value, b = +ice.querySelector("[data-b]").value, c = +ice.querySelector("[data-c]").value, K = +ice.querySelector("[data-k]").value;
    if (!(a >= 0 && b >= 0 && c >= 0 && K > 0) || (a + b + c === 0)) return;
    // (c + 2x)² = K (a − x)(b − x)
    const A = 4 - K, Bq = 4 * c + K * (a + b), C = c * c - K * a * b;
    const lo = -c / 2, hi = Math.min(a, b);
    let x;
    if (Math.abs(A) < 1e-9) x = -C / Bq;
    else { const D = Math.sqrt(Bq * Bq - 4 * A * C); x = [(-Bq + D) / (2 * A), (-Bq - D) / (2 * A)].find((r) => r >= lo - 1e-9 && r <= hi + 1e-9); }
    const f = (v) => fmtN(v, 3);
    const Q = a * b > 0 ? (c * c) / (a * b) : Infinity;
    ice.querySelector("[data-t]").innerHTML = `<tr><th></th><th>H₂</th><th>I₂</th><th>HI</th></tr>
      <tr><td>начало</td><td>${f(a)}</td><td>${f(b)}</td><td>${f(c)}</td></tr>
      <tr><td>изменение</td><td>−x</td><td>−x</td><td>+2x</td></tr>
      <tr><td><b>равновесие</b></td><td><b>${f(a - x)}</b></td><td><b>${f(b - x)}</b></td><td><b>${f(c + 2 * x)}</b></td></tr>`;
    ice.querySelector("[data-o]").innerHTML = `Q₀ = ${Q === Infinity ? "∞" : fmtN(Q, 3)} ${Q < K ? "&lt; K → реакция идёт вправо" : Q > K ? "&gt; K → реакция идёт влево" : "= K → уже равновесие"}. Уравнение (${f(c)} + 2x)² = ${K}·(${f(a)} − x)(${f(b)} − x) даёт x = <b>${f(x)}</b> моль/л. Выход HI: ${a && b ? fmtN(((2 * x) / (2 * Math.min(a, b))) * 100, 1) + " %" : "—"}. Проверка: [HI]²/([H₂][I₂]) = ${fmtN(((c + 2 * x) ** 2) / ((a - x) * (b - x)), 2)}.`;
  };
  ice.querySelectorAll("input").forEach((i) => (i.oninput = solve));
  solve();

  // ---------- симуляция ----------
  const s3 = h(`<section id="sim"><h2>Живая симуляция: N₂O₄ ⇄ 2NO₂</h2>
    <p>Бесцветный N₂O₄ (пары бледных шариков) распадается на бурый NO₂, а молекулы NO₂, встречаясь, снова соединяются. Чем больше NO₂, тем бурее газ в коробке. Прямая реакция эндотермическая: <span class="formula">N₂O₄ ⇄ 2NO₂, ΔH = +57 кДж/моль</span>. Нажимай кнопки и смотри, как система отвечает на «вмешательство», — это и есть ${term("le_chatelier", "принцип Ле Шателье")}.</p></section>`);
  el.appendChild(s3);
  const st = stage(`<div class="overlay"><span data-a></span><span data-b></span></div>`, { wide: true });
  s3.appendChild(st);
  const ctl = h(`<div class="card pad" style="margin-top:10px">
    <div class="row"><button class="btn small" type="button" data-x="add1">+ N₂O₄</button><button class="btn small" type="button" data-x="add2">+ NO₂</button><button class="btn small" type="button" data-x="hot">🔥 Нагреть</button><button class="btn small" type="button" data-x="cold">❄ Охладить</button><button class="btn small" type="button" data-x="press">⇲ Сжать</button><button class="btn small" type="button" data-x="exp">⇱ Расширить</button><button class="btn small" type="button" data-x="reset">↺ Сначала</button></div>
    <div data-plot style="margin-top:12px"></div>
    <div class="yk-leg"><span><i style="background:var(--accent)"></i>[N₂O₄]</span><span><i style="background:#ff8a4c"></i>[NO₂]</span><span><i style="background:var(--warn)"></i>воздействие</span></div>
    <p data-m class="yk-out"></p></div>`);
  s3.appendChild(ctl);
  const v = createViewer(st, { camera: [8, 5, 14], fitWidth: 6.5, minDistance: 6, maxDistance: 50, autoRotateSpeed: 0.25 });
  const MAX = 400;
  const boxGeo = new THREE.BoxGeometry(2, 2, 2);
  const tint = new THREE.Mesh(boxGeo, new THREE.MeshBasicMaterial({ color: 0x9a4a12, transparent: true, opacity: 0.1, depthWrite: false, side: THREE.BackSide }));
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(boxGeo), new THREE.LineBasicMaterial({ color: 0x7fa8ff, transparent: true, opacity: 0.6 }));
  v.scene.add(tint, edges);
  const mNO2 = new THREE.InstancedMesh(sphereGeo(0.32, 18), glossy(0xb8501a), MAX); mNO2.count = 0;
  const mN2O4 = new THREE.InstancedMesh(sphereGeo(0.3, 18), glossy(0xe6e2d6), MAX * 2); mN2O4.count = 0;
  v.scene.add(mNO2, mN2O4);
  let T, V, P, hist, marks, simT, sampleT, c1s, c2s;
  const half = () => 4 * Math.cbrt(V);
  const gauss = () => Math.sqrt(-2 * Math.log(Math.random() + 1e-12)) * Math.cos(2 * Math.PI * Math.random());
  const vel = (k = 1) => new THREE.Vector3(gauss(), gauss(), gauss()).multiplyScalar(1.6 * k * Math.sqrt(T / 298));
  const rndPos = () => { const b = half() - 0.4; return new THREE.Vector3((Math.random() * 2 - 1) * b, (Math.random() * 2 - 1) * b, (Math.random() * 2 - 1) * b); };
  const add = (k, n) => { for (let i = 0; i < n; i++) P.push({ k, p: rndPos(), v: vel(k === 1 ? 0.7 : 1), q: new THREE.Quaternion().random() }); };
  const reset = () => {
    T = 298; V = 1; P = []; hist = []; marks = []; simT = 0; sampleT = 0;
    add(1, 40); c1s = 1; c2s = 0;
  };
  const count = (k) => P.reduce((s, q) => s + (q.k === k), 0);
  const mark = (txt) => marks.push([simT, txt]);
  const msg = {
    add1: "Добавили N₂O₄: Q стало меньше K, и часть добавленного распадается — [NO₂] растёт. Равновесие сместилось вправо, но [N₂O₄] всё равно выше, чем было: система лишь частично компенсирует воздействие.",
    add2: "Добавили NO₂: Q > K, молекулы NO₂ чаще встречаются и соединяются — смещение влево, в сторону N₂O₄.",
    hot: "Нагрели: эндотермическая прямая реакция «поглощает» лишнее тепло — равновесие смещается вправо, газ буреет. Меняется сама константа K!",
    cold: "Охладили: смещение в сторону экзотермической реакции (влево, к N₂O₄) — газ светлеет. Так в опыте с двумя ампулами NO₂ в горячей и ледяной воде цвет различается на глаз.",
    press: "Сжали вдвое: все концентрации подскочили, а с ними давление. Равновесие смещается в сторону меньшего числа молекул газа — к N₂O₄ (1 молекула вместо 2). Цвет сразу темнеет (концентрация NO₂ выросла), а затем немного бледнеет.",
    exp: "Расширили вдвое: давление упало — смещение в сторону большего числа молекул газа, к NO₂.",
  };
  ctl.addEventListener("click", (e) => {
    const b = e.target.closest("[data-x]"); if (!b) return;
    const x = b.dataset.x;
    if (x === "reset") { reset(); ctl.querySelector("[data-m]").textContent = "Начинаем с чистого N₂O₄: смотри, как концентрации выходят на «полку»."; return; }
    const tot = count(1) * 2 + count(2);
    if (x === "add1" && tot < 300) { add(1, 15); mark("+N₂O₄"); }
    if (x === "add2" && tot < 300) { add(2, 25); mark("+NO₂"); }
    if (x === "hot" && T < 370) { const k = Math.sqrt((T + 25) / T); T += 25; P.forEach((q) => q.v.multiplyScalar(k)); mark("нагрев"); }
    if (x === "cold" && T > 250) { const k = Math.sqrt((T - 25) / T); T -= 25; P.forEach((q) => q.v.multiplyScalar(k)); mark("охлаждение"); }
    if (x === "press" && V > 0.3) { V /= 2; P.forEach((q) => q.p.multiplyScalar(Math.cbrt(0.5))); mark("сжатие"); }
    if (x === "exp" && V < 1.9) { V *= 2; P.forEach((q) => q.p.multiplyScalar(Math.cbrt(2))); mark("расширение"); }
    if (msg[x]) ctl.querySelector("[data-m]").innerHTML = msg[x];
  });
  const k2 = 0.25;
  const M4 = new THREE.Matrix4(), off = new THREE.Vector3();
  const plotBox = ctl.querySelector("[data-plot]");
  const draw = () => {
    const t1 = Math.max(40, Math.ceil(simT / 10) * 10), t0 = t1 - 40;
    const ym = Math.max(1.5, Math.ceil(Math.max(...hist.map((x) => Math.max(x[1], x[2])), 0) * 2 + 0.2) / 2);
    plotBox.innerHTML = svgPlot({
      h: 220, xr: [t0, t1], yr: [0, ym], xt: [0, 10, 20, 30, 40].map((d) => t0 + d), yt: [0, ym / 2, ym].map((y) => +y.toFixed(2)), xl: "время, с", yl: "c, усл. моль/л",
      series: [{ pts: hist.filter((x) => x[0] >= t0).map((x) => [x[0], x[1]]), cls: "l1" }, { pts: hist.filter((x) => x[0] >= t0).map((x) => [x[0], x[2]]), cls: "l2" }],
      extra: (X, Y) => marks.filter((m) => m[0] >= t0).map((m) => `<line class="mk" x1="${X(m[0])}" x2="${X(m[0])}" y1="${Y(0)}" y2="${Y(ym)}"/><text class="lab" x="${X(m[0]) + 4}" y="${Y(ym) + 12}">${m[1]}</text>`).join(""),
    });
  };
  const clock = simClock();
  v.onFrame(() => {
    const dt = clock();
    simT += dt;
    const b = half();
    for (const q of P) {
      q.p.addScaledVector(q.v, dt);
      for (const ax of ["x", "y", "z"]) {
        if (q.p[ax] > b - 0.35) { q.p[ax] = b - 0.35; q.v[ax] = -Math.abs(q.v[ax]); }
        if (q.p[ax] < -b + 0.35) { q.p[ax] = -b + 0.35; q.v[ax] = Math.abs(q.v[ax]); }
      }
    }
    // случайные превращения с вероятностями из констант скорости
    const K = K_T(T), k1 = K * k2;
    const n1 = count(1), n2 = count(2);
    const draws = (lam) => Math.floor(lam) + (Math.random() < lam % 1 ? 1 : 0);
    let f = draws(k1 * n1 * dt), r = draws((k2 * n2 * n2 / (V * S)) * dt);
    while (f-- > 0) {
      const ids = P.map((q, i) => (q.k === 1 ? i : -1)).filter((i) => i >= 0);
      if (!ids.length) break;
      const i = ids[(Math.random() * ids.length) | 0], q = P[i];
      const d = new THREE.Vector3().randomDirection();
      P.splice(i, 1);
      P.push({ k: 2, p: q.p.clone().addScaledVector(d, 0.35), v: q.v.clone().addScaledVector(d, 1.2), q: new THREE.Quaternion() });
      P.push({ k: 2, p: q.p.clone().addScaledVector(d, -0.35), v: q.v.clone().addScaledVector(d, -1.2), q: new THREE.Quaternion() });
    }
    while (r-- > 0) {
      const ids = P.map((q, i) => (q.k === 2 ? i : -1)).filter((i) => i >= 0);
      if (ids.length < 2) break;
      const i = ids[(Math.random() * ids.length) | 0];
      let j = -1, best = 1e9;
      for (const k of ids) if (k !== i) { const dd = P[k].p.distanceToSquared(P[i].p); if (dd < best) { best = dd; j = k; } }
      const a = P[i], c = P[j];
      P = P.filter((_, k) => k !== i && k !== j);
      P.push({ k: 1, p: a.p.clone().add(c.p).multiplyScalar(0.5), v: a.v.clone().add(c.v).multiplyScalar(0.5), q: new THREE.Quaternion().random() });
    }
    // отрисовка
    let i2 = 0, i4 = 0;
    for (const q of P) {
      if (q.k === 2) { M4.makeTranslation(q.p.x, q.p.y, q.p.z); mNO2.setMatrixAt(i2++, M4); }
      else {
        off.set(0.27, 0, 0).applyQuaternion(q.q);
        M4.makeTranslation(q.p.x + off.x, q.p.y + off.y, q.p.z + off.z); mN2O4.setMatrixAt(i4++, M4);
        M4.makeTranslation(q.p.x - off.x, q.p.y - off.y, q.p.z - off.z); mN2O4.setMatrixAt(i4++, M4);
      }
    }
    mNO2.count = i2; mN2O4.count = i4;
    mNO2.instanceMatrix.needsUpdate = true; mN2O4.instanceMatrix.needsUpdate = true;
    tint.scale.setScalar(b); edges.scale.setScalar(b);
    const c1 = count(1) / (V * S), c2 = count(2) / (V * S);
    const a = Math.min(1, dt * 0.8);
    c1s += (c1 - c1s) * a; c2s += (c2 - c2s) * a;
    tint.material.opacity = Math.min(0.55, 0.04 + c2 * 0.22);
    sampleT += dt;
    if (sampleT > 0.25) {
      sampleT = 0;
      hist.push([simT, c1, c2]); hist = hist.filter((x) => x[0] > simT - 45);
      const Q = c1s > 0.005 ? (c2s * c2s) / c1s : Infinity;
      st.querySelector("[data-a]").innerHTML = `<b>T = ${T} K · V = ${fmtN(V, 2)}</b>`;
      st.querySelector("[data-b]").innerHTML = `[N₂O₄] = ${fmtN(c1, 2)} · [NO₂] = ${fmtN(c2, 2)} · Q ≈ ${Q === Infinity ? "∞" : fmtN(Q, 2)} · K = ${fmtN(K, 2)} ${Math.abs(Math.log(Q / K)) < 0.35 ? "≈ равновесие" : Q < K ? "→ вправо" : "← влево"}`;
      draw();
    }
  });
  reset();
  ctl.querySelector("[data-m]").textContent = "Начинаем с чистого N₂O₄: смотри, как концентрации выходят на «полку». Q вычисляется по сглаженным концентрациям: в маленькой коробке они «шумят» — это настоящие флуктуации.";
  s3.appendChild(h(`<p class="small muted">Концентрации и K здесь в условных единицах (40 молекул в коробке V = 1 — это «1 моль/л»), но зависимость K от температуры настоящая — по уравнению Вант-Гоффа с ΔH = 57,2 кДж/моль: при нагревании на 25 K K растёт примерно в 5–7 раз. Реальная Kc при 25 °C ≈ 0,0061 моль/л.</p>`));

  el.appendChild(h(`<section id="lechatelier"><h2>Принцип Ле Шателье</h2>
    <p>Если на систему в равновесии оказать внешнее воздействие, равновесие смещается в сторону, <b>ослабляющую это воздействие</b> (А. Ле Шателье, 1884).</p>
    <div class="table-wrap"><table class="data">
      <tr><th>Воздействие</th><th>Куда смещается равновесие</th></tr>
      <tr><td>↑ концентрации реагента / ↓ продукта</td><td>вправо (к продуктам)</td></tr>
      <tr><td>↑ температуры</td><td>в сторону <b>эндотермической</b> реакции (ΔH &gt; 0)</td></tr>
      <tr><td>↑ давления (сжатие)</td><td>в сторону <b>меньшего числа моль газов</b>; если числа равны (H₂ + I₂ ⇄ 2HI) — не смещается</td></tr>
      <tr><td>катализатор, инертный газ при V = const</td><td>не смещается (катализатор лишь ускоряет достижение равновесия)</td></tr>
    </table></div>
    <div class="callout"><b>Синтез аммиака (процесс Габера — Боша):</b> N₂ + 3H₂ ⇄ 2NH₃, ΔH = −92 кДж. Выгодны высокое давление (4 моль газа → 2) и низкая температура. Но при низкой T реакция идёт слишком медленно, поэтому выбирают компромисс: 400–500 °C, 20–30 МПа, железный катализатор, а аммиак непрерывно выводят из системы, сжижая. Так равновесие и кинетика работают вместе.</div>
    <p class="adv">Связь с термодинамикой: <span class="formula">ΔG° = −RT·ln K</span>. Если ΔG° &lt; 0, то K &gt; 1. Подробнее — в уроке <a href="#lesson-thermo">«Термодинамика»</a>.</p>
  </section>`));

  el.appendChild(h(`<section id="eq-task"><h2>Разбор задачи</h2>
    <div class="card pad">
      <p><b>Условие.</b> В реакторе объёмом 1 л смешали 4 моль SO₂ и 3 моль O₂. К моменту равновесия прореагировало 60 % SO₂ (2SO₂ + O₂ ⇄ 2SO₃). Найдите K.</p>
      <p style="margin:0"><b>Решение.</b> Прореагировало 2,4 моль SO₂ и 1,2 моль O₂, образовалось 2,4 моль SO₃. Равновесные концентрации: [SO₂] = 1,6, [O₂] = 1,8, [SO₃] = 2,4 моль/л.<br>K = [SO₃]² / ([SO₂]²·[O₂]) = 5,76 / (2,56 · 1,8) = <b>1,25</b> л/моль.</p>
    </div>
  </section>`));
}

export const quiz = [
  { q: "Что верно для химического равновесия?", options: ["реакции прекратились", "скорости прямой и обратной реакций равны", "концентрации реагентов и продуктов равны", "K = 1"], answer: 1, why: "Равновесие динамическое: реакции идут, но с одинаковой скоростью." },
  { q: "Куда сместится равновесие N₂ + 3H₂ ⇄ 2NH₃ (ΔH < 0) при нагревании?", options: ["вправо", "влево", "не сместится", "зависит от катализатора"], answer: 1, why: "Нагрев смещает равновесие в сторону эндотермической (обратной) реакции." },
  { q: "На какое равновесие НЕ влияет изменение давления?", options: ["N₂ + 3H₂ ⇄ 2NH₃", "H₂ + I₂(г) ⇄ 2HI", "N₂O₄ ⇄ 2NO₂", "2SO₂ + O₂ ⇄ 2SO₃"], answer: 1, why: "Слева и справа по 2 моль газов." },
  { q: "Выражение константы для CaCO₃(тв) ⇄ CaO(тв) + CO₂(г):", options: ["[CaO][CO₂]/[CaCO₃]", "[CO₂]", "1/[CO₂]", "[CaCO₃]/[CaO]"], answer: 1, why: "Твёрдые вещества в выражение K не входят." },
  { q: "Как катализатор влияет на равновесие?", options: ["смещает вправо", "смещает влево", "не смещает, но ускоряет его достижение", "увеличивает K"], answer: 2, why: "Он в равной мере ускоряет прямую и обратную реакции." },
  { q: "Добавили продукт в равновесную смесь. Тогда Q…", options: ["станет больше K, реакция пойдёт влево", "станет меньше K, реакция пойдёт вправо", "останется равным K", "K изменится"], answer: 0, why: "Числитель Q вырос; чтобы вернуться к K, часть продукта превращается обратно." },
];
