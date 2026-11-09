import { h, kid, term, stage } from "../ui.js";
import { createViewer, THREE, sphereGeo, glossy, glowSprite } from "../three/core.js";
import { simClock, svgPlot, plotStyles } from "../three/y1011-kit.js";

const R = 8.314;
const fmtN = (x, d = 2) => Number(x).toLocaleString("ru-RU", { maximumFractionDigits: d });
const sci = (x) => {
  if (x === 0) return "0";
  if (x >= 0.001) return fmtN(x * 100, x > 0.1 ? 1 : 3) + " %";
  const e = Math.floor(Math.log10(x)), m = x / 10 ** e;
  return fmtN(m, 1) + "·10" + String(e).replace("-", "⁻").replace(/\d/g, (d) => "⁰¹²³⁴⁵⁶⁷⁸⁹"[d]);
};
// доля молекул с энергией выше E (распределение Максвелла — Больцмана по энергии)
function erfc(x) {
  const t = 1 / (1 + 0.3275911 * x);
  return t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429)))) * Math.exp(-x * x);
}
const tail = (Ea, T) => { const x = (Ea * 1000) / (R * T); return erfc(Math.sqrt(x)) + 2 * Math.sqrt(x / Math.PI) * Math.exp(-x); };
const fE = (E, T) => { const kT = (R * T) / 1000; return (2 / Math.sqrt(Math.PI)) * Math.pow(kT, -1.5) * Math.sqrt(E) * Math.exp(-E / kT); };

export async function render(el) {
  el.appendChild(h(`<div>${plotStyles()}
    <p class="lead">Термодинамика отвечает, <i>может ли</i> реакция идти, а кинетика — <i>как быстро</i>. Ржавление железа и горение бензина обе «разрешены», но одна идёт годами, другая — за миллисекунды. Скорость определяется тем, как часто молекулы сталкиваются и какая доля столкновений достаточно энергична.</p>
    ${kid("Чтобы молекулы прореагировали, им мало встретиться — нужно стукнуться достаточно сильно, как будто перепрыгнуть через забор. Высота забора — это энергия активации. Нагрев даёт молекулам разбег, а катализатор делает в заборе калитку пониже.")}
  </div>`));

  el.appendChild(h(`<section id="rate"><h2>Скорость реакции и закон действующих масс</h2>
    <p>${term("reaction_rate", "Скорость")} гомогенной реакции — изменение концентрации вещества в единицу времени: <span class="formula">v = ±Δc / Δt</span>, моль/(л·с). Для гетерогенной (на границе фаз) — изменение количества вещества на единицу площади поверхности; поэтому измельчение твёрдого вещества ускоряет реакцию.</p>
    <p><b>Закон действующих масс</b> (К. Гульдберг и П. Вааге, 1867): при постоянной температуре скорость пропорциональна произведению концентраций реагентов в степенях, равных порядкам:</p>
    <div class="eq">v = k · [A]ᵃ · [B]ᵇ</div>
    <p>Здесь k — ${term("rate_constant", "константа скорости")} (зависит от природы веществ, температуры и катализатора, но не от концентраций). Для <b>элементарных</b> реакций (идущих в одну стадию) порядки совпадают с коэффициентами; в общем случае их находят опытом. Концентрации твёрдых веществ в выражение не входят: для C(тв) + O₂ → CO₂ скорость v = k[O₂].</p>
  </section>`));

  // ---------- 3D-газ ----------
  const s2 = h(`<section id="collisions"><h2>Столкновения в 3D: симуляция</h2>
    <p>В коробке летают молекулы A (красные) и B (синие). При каждом столкновении A–B считается энергия удара вдоль линии центров. Если она не меньше энергии активации <b>Eₐ</b> — столкновение эффективное: вспышка, и появляется продукт AB (зелёный). Остальные столкновения упругие — молекулы просто отскакивают. По теории столкновений доля эффективных ударов равна <span class="formula">e^(−Eₐ/RT)</span>; сравни с тем, что насчитает симуляция.</p></section>`);
  el.appendChild(s2);
  const st = stage(`<div class="overlay"><span data-a></span><span data-b></span></div>`, { wide: true });
  s2.appendChild(st);
  const ctl = h(`<div class="card pad" style="margin-top:10px">
    <div class="yk-grid">
      <label class="ctl">Температура: <b data-tv></b><input type="range" data-T min="200" max="800" step="10" value="300"></label>
      <label class="ctl">Начальное число молекул A и B: <b data-nv></b><input type="range" data-n min="8" max="45" value="30"></label>
    </div>
    <div class="row" style="margin-top:10px"><label class="row small"><input type="checkbox" data-cat> Катализатор (Eₐ: 9 → 4 кДж/моль)</label><button class="btn small" type="button" data-reset>↺ Заново</button></div>
    <div data-plot style="margin-top:12px"></div>
    <div class="yk-leg"><span><i style="background:var(--good)"></i>скорость: эффективных столкновений в секунду</span><span><i style="background:var(--accent-2)"></i>осталось A, % от начального (правая шкала)</span></div>
    <p class="small muted" style="margin:8px 0 0">В симуляции Eₐ занижена в 5–20 раз, чтобы реакции было видно за секунды. У реальных реакций Eₐ = 40–200 кДж/моль.</p>
  </div>`);
  s2.appendChild(ctl);
  const v = createViewer(st, { camera: [9, 6, 15], fitWidth: 6, minDistance: 6, maxDistance: 50, autoRotateSpeed: 0.25 });
  const B = 4, RAD = 0.4, SIG300 = 2.2, MAX = 120;
  v.scene.add(new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(2 * B, 2 * B, 2 * B)), new THREE.LineBasicMaterial({ color: 0x7fa8ff, transparent: true, opacity: 0.5 })));
  const mk = (r, c) => { const m = new THREE.InstancedMesh(sphereGeo(r, 20), glossy(c), MAX); m.count = 0; v.scene.add(m); return m; };
  const meshes = { A: mk(RAD, 0xff5a5a), B: mk(RAD, 0x4f8dff), C: mk(0.5, 0x3ddc84) };
  let P = [], T = 300, Tstart = 300, hist = [], events = [], colls = [], simT = 0, sampleT = 0;
  const flashes = [];
  const gauss = () => Math.sqrt(-2 * Math.log(Math.random() + 1e-12)) * Math.cos(2 * Math.PI * Math.random());
  const sig = () => SIG300 * Math.sqrt(T / 300);
  const reset = () => {
    const n = +ctl.querySelector("[data-n]").value;
    P = [];
    for (const k of ["A", "B"]) for (let i = 0; i < n; i++) {
      let p;
      do { p = new THREE.Vector3((Math.random() * 2 - 1) * (B - RAD), (Math.random() * 2 - 1) * (B - RAD), (Math.random() * 2 - 1) * (B - RAD)); } while (P.some((q) => q.p.distanceTo(p) < 2.2 * RAD));
      P.push({ k, p, v: new THREE.Vector3(gauss(), gauss(), gauss()).multiplyScalar(sig()) });
    }
    hist = []; events = []; colls = []; simT = 0; sampleT = 0;
  };
  const Ea = () => (ctl.querySelector("[data-cat]").checked ? 4 : 9);
  const toKJ = (0.5 * 0.5 * (R * 300) / 1000) / (SIG300 * SIG300); // ½μv² → кДж/моль
  const M = new THREE.Matrix4();
  const tick = (dt) => {
    simT += dt;
    for (const q of P) {
      q.p.addScaledVector(q.v, dt);
      const r = q.k === "C" ? 0.5 : RAD;
      for (const ax of ["x", "y", "z"]) {
        if (q.p[ax] > B - r) { q.p[ax] = B - r; q.v[ax] = -Math.abs(q.v[ax]); }
        if (q.p[ax] < -B + r) { q.p[ax] = -B + r; q.v[ax] = Math.abs(q.v[ax]); }
      }
    }
    const As = P.filter((q) => q.k === "A"), Bs = P.filter((q) => q.k === "B");
    const dead = new Set();
    const d = new THREE.Vector3(), rv = new THREE.Vector3();
    for (const a of As) for (const b of Bs) {
      if (dead.has(a) || dead.has(b)) continue;
      d.subVectors(b.p, a.p);
      const dist = d.length();
      if (dist > 2 * RAD || dist === 0) continue;
      d.divideScalar(dist);
      rv.subVectors(a.v, b.v);
      const vn = rv.dot(d);
      if (vn <= 0) continue;
      colls.push(simT);
      const E = vn * vn * toKJ;
      if (E >= Ea()) {
        dead.add(a); dead.add(b);
        events.push(simT);
        const c = { k: "C", p: a.p.clone().add(b.p).multiplyScalar(0.5), v: a.v.clone().add(b.v).multiplyScalar(0.5) };
        P.push(c);
        const f = glowSprite(0xfff1a8, 2.2, 1); f.position.copy(c.p); f.userData.life = 0.6; v.scene.add(f); flashes.push(f);
      } else {
        a.v.addScaledVector(d, -vn); b.v.addScaledVector(d, vn);
      }
    }
    if (dead.size) P = P.filter((q) => !dead.has(q));
  };
  const plotBox = ctl.querySelector("[data-plot]");
  const drawPlot = () => {
    const n0 = +ctl.querySelector("[data-n]").value;
    const tMax = Math.max(30, Math.ceil(simT / 10) * 10);
    const yMax = Math.max(2, Math.ceil(Math.max(...hist.map((x) => x[1]), 1) / 2) * 2);
    plotBox.innerHTML = svgPlot({
      h: 220, pad: [46, 46, 18, 34], xr: [Math.max(0, tMax - 60), tMax], yr: [0, yMax], xt: [0, 1, 2, 3, 4, 5, 6].map((i) => Math.max(0, tMax - 60) + i * 10).filter((x) => x <= tMax),
      yt: [0, yMax / 2, yMax], xl: "время, с", yl: "v, 1/с",
      series: [{ pts: hist.map((x) => [x[0], x[1]]), cls: "l3" }, { pts: hist.map((x) => [x[0], (x[2] / n0) * yMax]), cls: "l4" }],
      extra: (X, Y) => [0, 50, 100].map((q) => `<text class="t" x="${X(tMax) + 6}" y="${Y((q / 100) * yMax) + 4}">${q} %</text>`).join(""),
    });
  };
  const clock = simClock();
  v.onFrame(() => {
    const dt = clock();
    for (let s = 0; s < 3; s++) tick(dt / 3);
    for (const k of ["A", "B", "C"]) {
      const list = P.filter((q) => q.k === k);
      meshes[k].count = list.length;
      list.forEach((q, i) => { M.makeTranslation(q.p.x, q.p.y, q.p.z); meshes[k].setMatrixAt(i, M); });
      meshes[k].instanceMatrix.needsUpdate = true;
    }
    for (let i = flashes.length - 1; i >= 0; i--) {
      const f = flashes[i]; f.userData.life -= dt; f.material.opacity = Math.max(0, f.userData.life / 0.6);
      if (f.userData.life <= 0) { v.scene.remove(f); f.material.dispose(); flashes.splice(i, 1); }
    }
    sampleT += dt;
    if (sampleT > 0.5) {
      sampleT = 0;
      const w = Math.max(1, Math.min(4, simT));
      const eff = events.filter((t) => t > simT - 4).length / w, all = colls.filter((t) => t > simT - 4).length / w;
      events = events.filter((t) => t > simT - 4); colls = colls.filter((t) => t > simT - 4);
      const nA = P.filter((q) => q.k === "A").length;
      hist.push([simT, eff, nA]); hist = hist.filter((x) => x[0] > simT - 60);
      st.querySelector("[data-a]").innerHTML = `<b>A: ${nA} · B: ${P.filter((q) => q.k === "B").length} · AB: ${P.filter((q) => q.k === "C").length}</b>`;
      st.querySelector("[data-b]").textContent = `столкновений A–B: ${fmtN(all, 1)}/с · эффективных: ${fmtN(eff, 1)}/с${all ? ` (${fmtN((eff / all) * 100, 0)} %)` : ""} · теория e^(−Eₐ/RT) = ${fmtN(Math.exp(-(Ea() * 1000) / (R * T)) * 100, 1)} %`;
      drawPlot();
    }
  });
  const setT = () => {
    const nT = +ctl.querySelector("[data-T]").value;
    const k = Math.sqrt(nT / T); P.forEach((q) => q.v.multiplyScalar(k)); T = nT;
    ctl.querySelector("[data-tv]").textContent = `${T} K (${T - 273} °C)`;
  };
  ctl.querySelector("[data-T]").oninput = setT;
  ctl.querySelector("[data-n]").oninput = () => { ctl.querySelector("[data-nv]").textContent = ctl.querySelector("[data-n]").value; reset(); };
  ctl.querySelector("[data-reset]").onclick = reset;
  ctl.querySelector("[data-nv]").textContent = ctl.querySelector("[data-n]").value;
  setT(); reset(); drawPlot();
  s2.appendChild(h(`<p class="small">Что заметно: <b>концентрация</b> меняет число столкновений (вдвое больше A и B — вчетверо больше ударов A–B), но не их долю; <b>температура</b> немного увеличивает число столкновений и сильно — долю эффективных; <b>катализатор</b> не меняет ни число, ни энергию ударов, а снижает порог. По мере расходования A и B скорость падает — кривая на графике идёт вниз.</p>`));

  // ---------- температура ----------
  const s3 = h(`<section id="temperature"><h2>Температура: Вант-Гофф и Аррениус</h2>
    <p><b>Правило Вант-Гоффа</b> (эмпирическое): при нагревании на 10 °C скорость большинства реакций возрастает в γ = 2–4 раза: <span class="formula">v₂ = v₁ · γ^((t₂ − t₁)/10)</span>.</p>
    <p><b>Уравнение Аррениуса</b> (1889) объясняет почему: <span class="formula">k = A · e^(−Eₐ/RT)</span>, где ${term("activation_energy", "Eₐ")} — энергия активации, A — предэкспоненциальный множитель (частота и геометрия столкновений). Множитель e^(−Eₐ/RT) — это доля молекул с энергией выше Eₐ. На графике распределение молекул по энергиям (Максвелл — Больцман) при T и при T + 10 K; красным закрашена доля, способная прореагировать.</p></section>`);
  el.appendChild(s3);
  const mx = h(`<div class="card pad">
    <div class="yk-grid"><label class="ctl">T: <b data-tv></b><input type="range" data-T min="200" max="1000" step="10" value="300"></label>
    <label class="ctl">Eₐ: <b data-ev></b><input type="range" data-E min="5" max="100" value="15"></label></div>
    <div data-plot style="margin-top:10px"></div>
    <div class="yk-leg"><span><i style="background:var(--accent)"></i>T</span><span><i style="background:var(--accent-2)"></i>T + 10 K</span><span><i style="background:var(--bad)"></i>E ≥ Eₐ при T</span></div>
    <p data-o class="yk-out"></p></div>`);
  s3.appendChild(mx);
  const drawMx = () => {
    const T1 = +mx.querySelector("[data-T]").value, E = +mx.querySelector("[data-E]").value, kT = (R * T1) / 1000;
    const Emax = Math.max(E * 1.35, 7 * kT);
    const N = 160, pts = (T) => Array.from({ length: N + 1 }, (_, i) => { const x = (Emax * i) / N; return [x, fE(x, T)]; });
    const p1 = pts(T1), p2 = pts(T1 + 10), ymax = Math.max(...p1.map((p) => p[1])) * 1.12;
    const shade = [[E, 0], ...p1.filter((p) => p[0] >= E), [Emax, 0]];
    const step = Emax > 60 ? 20 : Emax > 25 ? 10 : 5;
    mx.querySelector("[data-plot]").innerHTML = svgPlot({
      xr: [0, Emax], yr: [0, ymax], xt: Array.from({ length: Math.floor(Emax / step) + 1 }, (_, i) => i * step), xl: "E, кДж/моль", yl: "доля молекул",
      series: [{ pts: shade, cls: "f1", fill: true }, { pts: p2, cls: "l4" }, { pts: p1, cls: "l1" }],
      extra: (X, Y) => `<line class="mk" x1="${X(E)}" x2="${X(E)}" y1="${Y(0)}" y2="${Y(ymax * 0.95)}"/><text class="lab" x="${X(E) + 6}" y="${Y(ymax * 0.88)}">Eₐ</text>`,
    });
    const f1 = tail(E, T1), f2 = tail(E, T1 + 10), a1 = Math.exp((-E * 1000) / (R * T1)), a2 = Math.exp((-E * 1000) / (R * (T1 + 10)));
    mx.querySelector("[data-tv]").textContent = `${T1} K`;
    mx.querySelector("[data-ev]").textContent = `${E} кДж/моль`;
    mx.querySelector("[data-o]").innerHTML = `Доля молекул с E ≥ Eₐ: <b>${sci(f1)}</b> при ${T1} K и <b>${sci(f2)}</b> при ${T1 + 10} K. Множитель Аррениуса e^(−Eₐ/RT): ${sci(a1)} → ${sci(a2)}, то есть при нагревании на 10 K константа скорости растёт в <b>γ ≈ ${fmtN(a2 / a1, 2)}</b> раза. Попробуй Eₐ = 50–100 кДж/моль при 300 K: доля крошечная, но растёт с температурой в разы — отсюда правило Вант-Гоффа.`;
  };
  mx.querySelectorAll("input").forEach((i) => (i.oninput = drawMx));
  drawMx();
  const calc = h(`<div class="card pad" style="margin-top:14px"><b>Калькулятор Аррениуса</b>
    <div class="yk-grid" style="margin-top:10px">
      <label class="ctl">Eₐ, кДж/моль<input type="number" data-e value="75" min="1" max="400"></label>
      <label class="ctl">T₁, K<input type="number" data-t1 value="298" min="50" max="3000"></label>
      <label class="ctl">T₂, K<input type="number" data-t2 value="310" min="50" max="3000"></label>
    </div><p data-o class="yk-out"></p></div>`);
  s3.appendChild(calc);
  const doCalc = () => {
    const E = +calc.querySelector("[data-e]").value, t1 = +calc.querySelector("[data-t1]").value, t2 = +calc.querySelector("[data-t2]").value;
    if (!(E > 0 && t1 > 0 && t2 > 0)) return;
    const r = Math.exp(((E * 1000) / R) * (1 / t1 - 1 / t2));
    const g = t2 !== t1 ? Math.pow(r, 10 / (t2 - t1)) : 1;
    calc.querySelector("[data-o]").innerHTML = `ln(k₂/k₁) = (Eₐ/R)·(1/T₁ − 1/T₂) = ${fmtN(Math.log(r), 3)} → <b>k₂/k₁ = ${r > 1e4 || r < 1e-3 ? r.toExponential(2).replace(".", ",") : fmtN(r, 3)}</b>. Эквивалентный температурный коэффициент γ = ${fmtN(g, 2)}. <span class="muted">Пример: при Eₐ = 75 кДж/моль нагрев от 25 °C до 37 °C (температура тела) ускоряет реакцию в ≈ 3,2 раза.</span>`;
  };
  calc.querySelectorAll("input").forEach((i) => (i.oninput = doCalc));
  doCalc();

  // ---------- катализ ----------
  const prof = (cat) => {
    const W = 640, H = 250;
    const p = cat ? "M30 170 C90 170 110 170 150 150 C190 128 200 105 230 105 C260 105 275 150 300 150 C330 150 345 120 375 120 C405 120 430 200 470 205 C520 210 560 210 610 210" : "M30 170 C110 170 160 170 210 120 C250 75 270 45 320 45 C370 45 390 110 440 175 C480 205 540 210 610 210";
    return p;
  };
  el.appendChild(h(`<section id="catalysis"><h2>Катализ</h2>
    <p>${term("catalyst", "Катализатор")} ускоряет реакцию, открывая другой путь — через промежуточные соединения с меньшей энергией активации — и в итоге остаётся неизменным. Он одинаково ускоряет прямую и обратную реакции, поэтому <b>не смещает равновесие</b> и не меняет ΔH.</p>
    <div class="card pad"><svg viewBox="0 0 640 250" class="yk-plot" role="img" aria-label="Энергетическая диаграмма реакции с катализатором и без">
      <line class="ax" x1="30" y1="230" x2="620" y2="230"/><line class="ax" x1="30" y1="20" x2="30" y2="230"/>
      <path class="l2" d="${prof(false)}"/><path class="l3" d="${prof(true)}" style="stroke-dasharray:7 5"/>
      <line class="mk" x1="60" y1="170" x2="60" y2="45"/><text class="lab" x="66" y="70">Eₐ</text>
      <line class="mk" x1="250" y1="170" x2="250" y2="105"/><text class="lab" x="256" y="140">Eₐ(кат)</text>
      <line class="mk" x1="590" y1="170" x2="590" y2="210"/><text class="lab" x="540" y="196">ΔH &lt; 0</text>
      <line class="g" x1="30" y1="170" x2="600" y2="170"/><line class="g" x1="30" y1="45" x2="320" y2="45"/>
      <text class="t" x="34" y="162">реагенты</text><text class="t" x="560" y="225">продукты</text><text class="t" x="300" y="36">активированный комплекс</text>
      <text class="t" x="36" y="16">энергия</text><text class="t" x="560" y="246">ход реакции</text>
    </svg>
    <div class="yk-leg"><span><i style="background:#ff8a4c"></i>без катализатора</span><span><i style="background:var(--good)"></i>с катализатором (через промежуточное соединение)</span></div></div>
    <ul>
      <li><b>Гомогенный катализ</b> — катализатор в той же фазе: 2SO₂ + O₂ ⇄ 2SO₃ с NO (старый нитрозный способ), разложение H₂O₂ ионами I⁻.</li>
      <li><b>Гетерогенный</b> — на поверхности твёрдого катализатора: синтез аммиака на Fe, окисление SO₂ на V₂O₅, дожиг выхлопа на Pt/Pd/Rh в автомобильных нейтрализаторах.</li>
      <li><b>Ферменты</b> — белковые катализаторы с огромной избирательностью: каталаза разлагает до 10⁷ молекул H₂O₂ в секунду. Работают в узком интервале температур и pH (денатурация).</li>
      <li><b>Ингибиторы</b> замедляют реакции: добавки против коррозии, антиоксиданты в пище.</li>
    </ul>
  </section>`));

  el.appendChild(h(`<section id="problems"><h2>Разбор задач</h2>
    <div class="card pad">
      <p><b>1.</b> При повышении температуры на 30 °C скорость реакции возросла в 27 раз. Найдите γ.<br><i>Решение:</i> γ³ = 27, <b>γ = 3</b>.</p>
      <p><b>2.</b> Как изменится скорость элементарной реакции 2NO + O₂ → 2NO₂, если увеличить давление в 3 раза?<br><i>Решение:</i> концентрации газов растут в 3 раза: v = k[NO]²[O₂] → 3² · 3 = <b>в 27 раз</b>.</p>
      <p><b>3.</b> Во сколько раз уменьшится скорость при охлаждении от 70 до 40 °C, если γ = 2?<br><i>Решение:</i> 2^(30/10) = <b>в 8 раз</b>.</p>
      <p style="margin:0"><b>4.</b> Eₐ = 100 кДж/моль. Во сколько раз катализатор, снижающий Eₐ до 60 кДж/моль, ускорит реакцию при 300 K (A не меняется)?<br><i>Решение:</i> k₂/k₁ = e^(40 000 / (8,314 · 300)) = e^16,0 ≈ <b>9·10⁶ раз</b>.</p>
    </div>
  </section>`));
}

export const quiz = [
  { q: "Как изменится скорость реакции 2A(г) + B(г) → C (элементарной), если концентрацию A увеличить в 2 раза?", options: ["в 2 раза", "в 4 раза", "в 8 раз", "не изменится"], answer: 1, why: "v = k[A]²[B], 2² = 4." },
  { q: "Температурный коэффициент γ = 2. Во сколько раз возрастёт скорость при нагревании на 40 °C?", options: ["в 8 раз", "в 16 раз", "в 80 раз", "в 4 раза"], answer: 1, why: "2⁴ = 16." },
  { q: "Что делает катализатор?", options: ["увеличивает ΔH", "снижает энергию активации", "смещает равновесие вправо", "повышает температуру"], answer: 1, why: "Он открывает путь с меньшей Eₐ и одинаково ускоряет прямую и обратную реакции." },
  { q: "От чего НЕ зависит скорость реакции Zn(тв) + 2HCl → ZnCl₂ + H₂?", options: ["от концентрации HCl", "от степени измельчения цинка", "от давления водорода над раствором", "от температуры"], answer: 2, why: "H₂ — продукт; скорость определяется концентрацией HCl, поверхностью цинка и температурой." },
  { q: "Почему при нагревании скорость растёт гораздо сильнее, чем число столкновений?", options: ["растёт доля молекул с E ≥ Eₐ", "уменьшается Eₐ", "молекулы становятся больше", "растёт константа равновесия"], answer: 0, why: "Доля e^(−Eₐ/RT) экспоненциально чувствительна к T, а частота столкновений растёт лишь как √T." },
];
