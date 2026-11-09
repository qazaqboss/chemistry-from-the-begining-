import { h, kid, term, stage } from "../ui.js";
import { createViewer } from "../three/core.js";
import { frame } from "../three/molecule.js";
import { jacobiEigen, matrixHTML, matRow, op, num, charPoly, polyHTML } from "../three/qm-linalg.js";
import { chainCoords, ringCoords, naphthaleneCoords, adjacency, bondsOf, createHuckelScene } from "../three/huckel-mo.js";

const MOLS = [
  { id: "ethene", label: "Этен", make: () => chainCoords(2), ne: 2, formula: "C₂H₄" },
  { id: "allyl", label: "Аллил", make: () => chainCoords(3), ne: 3, formula: "C₃H₅•" },
  { id: "butadiene", label: "Бутадиен", make: () => chainCoords(4), ne: 4, formula: "C₄H₆" },
  { id: "hexatriene", label: "Гексатриен", make: () => chainCoords(6), ne: 6, formula: "C₆H₈" },
  { id: "cbd", label: "Циклобутадиен", make: () => ringCoords(4), ne: 4, formula: "C₄H₄" },
  { id: "cp", label: "Циклопентадиенил⁻", make: () => ringCoords(5), ne: 6, formula: "C₅H₅⁻" },
  { id: "benzene", label: "Бензол", make: () => ringCoords(6), ne: 6, formula: "C₆H₆" },
  { id: "trop", label: "Тропилий⁺", make: () => ringCoords(7), ne: 6, formula: "C₇H₇⁺" },
  { id: "naph", label: "Нафталин", make: naphthaleneCoords, ne: 10, formula: "C₁₀H₈" },
  { id: "chainN", label: "Цепь из N", custom: "chain" },
  { id: "ringN", label: "Кольцо из N", custom: "ring" },
];

// Заселение уровней: по убыванию x (β < 0, значит большой x — низкая энергия), правило Хунда для вырожденных
function occupy(xs, ne) {
  const order = xs.map((x, i) => i).sort((a, b) => xs[b] - xs[a]);
  const occ = new Array(xs.length).fill(0);
  let left = ne, k = 0;
  while (k < order.length && left > 0) {
    let g = 1;
    while (k + g < order.length && Math.abs(xs[order[k + g]] - xs[order[k]]) < 1e-6) g++;
    const grp = order.slice(k, k + g);
    if (left >= 2 * g) { grp.forEach((i) => (occ[i] = 2)); left -= 2 * g; }
    else { grp.forEach((i, j) => (occ[i] = (left > j ? 1 : 0) + (left > g + j ? 1 : 0))); left = 0; }
    k += g;
  }
  return occ;
}

export async function render(el) {
  el.classList.add("hk");
  el.appendChild(h(`<div>
    <style>
      .hk .levels svg{width:100%;height:auto;display:block}
      .hk .levels .lv{cursor:pointer}
      .hk .levels .lv:hover line.bar{stroke-width:5}
      .hk .bench{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(0,1fr);gap:14px;align-items:start}
      @media (max-width:860px){.hk .bench{grid-template-columns:minmax(0,1fr)}}
      .hk .res b{font-family:var(--mono)}
      .hk .poly{font-family:var(--mono);font-weight:700;overflow-x:auto;padding:8px 0}
    </style>
    <p class="lead">Метод Хюккеля (1931) — самая простая квантово-химическая модель, которая всё же предсказывает реальные вещи: почему бензол необычно устойчив, а циклобутадиен — нет, почему связи в бутадиене разной длины и куда атакует реагент. Вся химия здесь сводится к одной матрице и её собственным значениям.</p>
    ${kid("Атомы углерода в плоской молекуле держат над и под собой «гантельки» p-орбиталей. Соседние гантельки перекрываются, и электроны могут бегать по всей молекуле, как по кольцевой дороге. Метод Хюккеля — способ посчитать, какие «дороги» для электронов удобнее всего.")}
  </div>`));

  el.appendChild(h(`<section id="pi"><h2>π-приближение и секулярные уравнения</h2>
    <p>В сопряжённой молекуле каждый sp²-атом углерода даёт одну 2p<sub>z</sub>-орбиталь φᵣ, перпендикулярную плоскости. σ-остов считаем «жёстким» и рассматриваем только π-электроны. Молекулярную орбиталь ищем как линейную комбинацию атомных (ЛКАО):</p>
    <div class="eq">ψ = c₁φ₁ + c₂φ₂ + … + c<sub>N</sub>φ<sub>N</sub></div>
    <p>Вариационный принцип (минимум энергии по cᵣ) приводит к системе однородных линейных уравнений Σₛ(Hᵣₛ − E·Sᵣₛ)cₛ = 0. Нетривиальное решение есть, только если ${term("y12_secular", "секулярный определитель")} равен нулю: det(H − ES) = 0. Хюккель предложил грубые, но удачные упрощения:</p>
    <ul>
      <li>Sᵣₛ = δᵣₛ — перекрыванием пренебрегаем;</li>
      <li>Hᵣᵣ = α — ${term("y12_coulomb", "кулоновский интеграл")}, энергия электрона на изолированной p-орбитали;</li>
      <li>Hᵣₛ = β — резонансный интеграл, если атомы r и s связаны, и 0 иначе. Оба отрицательны; β ≈ −2,4…−3 эВ.</li>
    </ul>
    <p>Тогда H = α·I + β·A, где A — <b>матрица смежности</b> графа молекулы (1 у соседей). Подставляя E = α + xβ, получаем det(A − xI) = 0: числа x — просто ${term("y12_eigen", "собственные значения")} матрицы смежности, а коэффициенты c — её собственные векторы. Химия свелась к теории графов!</p>
  </section>`));

  // ---------- Рабочий стол ----------
  const wb = h(`<section id="matrix"><h2>Матрица Гамильтониана выбранной молекулы</h2>
    <div class="chips" data-mols></div>
    <div class="row" style="margin-top:10px;display:none" data-custom>
      <label class="ctl" style="flex:1;min-width:200px">Число атомов N: <b data-nn>8</b><input type="range" min="2" max="12" value="8" data-ns></label>
    </div>
    <div class="row" style="margin-top:10px"><label class="ctl" style="flex:1;min-width:200px">Число π-электронов: <b data-ne></b><input type="range" min="0" max="24" data-es></label></div>
    <h3 style="margin-top:18px">Гамильтониан в базисе p-орбиталей</h3>
    <div data-H style="overflow-x:auto"></div>
    <h3>Секулярное уравнение</h3>
    <p class="small muted">Делим каждую строку det(H − EI) на β и вводим x = (E − α)/β:</p>
    <div data-S style="overflow-x:auto"></div>
    <div class="poly" data-poly></div>
  </section>`);
  el.appendChild(wb);

  const solve = h(`<section id="solve"><h2>Решаем: метод вращений Якоби</h2>
    <p>Корни многочлена степени N > 4 в радикалах в общем случае не находятся, поэтому матрицу диагонализуют численно. ${term("y12_jacobi", "Метод Якоби")}: берём внедиагональный элемент a<sub>pq</sub> (в классическом варианте — наибольший, в циклическом, как здесь, — все по очереди за один «проход») и поворачиваем базис в плоскости (p, q) на угол φ, tg 2φ = 2a<sub>pq</sub>/(a<sub>qq</sub> − a<sub>pp</sub>). После поворота a<sub>pq</sub> = 0. Соседние элементы снова «портятся», но сумма квадратов внедиагональных элементов строго убывает — после нескольких проходов матрица становится диагональной: Vᵀ A V = diag(x₁…x<sub>N</sub>). На диагонали — собственные значения, в столбцах V — коэффициенты МО.</p>
    <div class="row"><button class="btn primary" type="button" data-go>▶ Решить (Якоби)</button><span class="small muted" data-st></span></div>
    <div data-J style="overflow-x:auto;margin-top:10px"></div>
  </section>`);
  el.appendChild(solve);

  const lv = h(`<section id="levels"><h2>Уровни энергии и π-орбитали в 3D</h2>
    <p>Щёлкни по уровню на диаграмме — в 3D покажется эта МО: размер лепестка ∝ |cᵣ|, цвет — знак (синий +, красный −). Между атомами, где знаки соседних лепестков разные, проходит узловая плоскость: чем больше узлов, тем выше энергия орбитали.</p>
    <div class="bench">
      <div data-stage></div>
      <div class="card pad levels"><svg viewBox="0 0 320 360" data-lv></svg><p class="small muted" style="margin:6px 0 0">Снизу — связывающие (x > 0), сверху — разрыхляющие (x < 0). ↑↓ — электроны.</p></div>
    </div>
    <div class="chips" style="margin-top:10px"><button class="chip" type="button" data-lab="none">без подписей</button><button class="chip on" type="button" data-lab="c">коэффициенты cᵣ</button><button class="chip" type="button" data-lab="p">порядки связей</button><button class="chip" type="button" data-lab="q">π-заряды</button></div>
    <div class="card pad res" style="margin-top:12px" data-res></div>
  </section>`);
  el.appendChild(lv);
  const st = stage(`<div class="overlay"><span data-a style="font-size:.95rem"></span><span data-b></span></div>`);
  lv.querySelector("[data-stage]").appendChild(st);
  const v = createViewer(st, { camera: [0, 7, 7], autoRotateSpeed: 0.6, maxDistance: 50 });
  const scene = createHuckelScene(v);

  let mol = MOLS[2], N = 4, ne = 4, pts, A, sol = null, sel = 0, labMode = "c", anim = 0;

  const mk = wb.querySelector("[data-mols]");
  MOLS.forEach((m) => {
    const b = h(`<button class="chip${m === mol ? " on" : ""}" type="button">${m.label}</button>`);
    b.onclick = () => { mk.querySelectorAll(".chip").forEach((x) => x.classList.toggle("on", x === b)); mol = m; setup(true); };
    mk.appendChild(b);
  });
  const nsI = wb.querySelector("[data-ns]"), esI = wb.querySelector("[data-es]");
  nsI.oninput = () => setup(true);
  esI.oninput = () => { ne = +esI.value; wb.querySelector("[data-ne]").textContent = ne; if (sol) finish(false); };

  function setup(resetNe) {
    wb.querySelector("[data-custom]").style.display = mol.custom ? "" : "none";
    if (mol.custom) {
      N = +nsI.value;
      wb.querySelector("[data-nn]").textContent = N;
      pts = mol.custom === "chain" ? chainCoords(N) : ringCoords(Math.max(3, N));
    } else pts = mol.make();
    N = pts.length;
    A = adjacency(pts);
    if (resetNe) ne = mol.ne ?? N;
    esI.max = 2 * N; esI.value = ne;
    wb.querySelector("[data-ne]").textContent = ne;
    const sym = (i, j, x) => (i === j ? "α" : x ? "β" : "0");
    const cls = (i, j, x) => (i === j ? "dg" : x ? "hi" : "z");
    wb.querySelector("[data-H]").innerHTML = matRow(op("H ="), matrixHTML(A.map((r, i) => r.map((x, j) => sym(i, j, x))), { cls: (i, j) => cls(i, j, A[i][j]) }), op("= αI + β·"), matrixHTML(A, { fmt: (x) => num(x, 0), cls: (i, j, x) => (x ? "hi" : "z") }));
    wb.querySelector("[data-S]").innerHTML = matRow(op("det"), matrixHTML(A.map((r, i) => r.map((x, j) => (i === j ? "−x" : x ? "1" : "0"))), { cls: (i, j) => (i === j ? "dg" : A[i][j] ? "hi" : "z") }), op("= 0"));
    const poly = polyHTML(charPoly(A));
    wb.querySelector("[data-poly]").innerHTML = `Характеристический многочлен: det(xI − A) = ${poly} = 0`;
    scene.build(pts, A);
    frame(v, scene.radius());
    sol = null; sel = 0;
    scene.setCoeffs(null, true);
    scene.setLabels([]);
    solve.querySelector("[data-J]").innerHTML = "";
    solve.querySelector("[data-st]").textContent = `Матрица ${N}×${N}: нажми «Решить».`;
    lv.querySelector("[data-lv]").innerHTML = `<text x="160" y="180" text-anchor="middle" font-size="14" fill="var(--text-3)">Сначала нажми «Решить» выше</text>`;
    lv.querySelector("[data-res]").innerHTML = `<span class="muted">Здесь появятся энергии, энергия делокализации и порядки связей.</span>`;
    st.querySelector("[data-a]").innerHTML = `<b>${mol.custom ? (mol.custom === "chain" ? `Цепь C${N}` : `Кольцо C${N}`) : mol.label}</b> ${mol.formula || ""}`;
    st.querySelector("[data-b]").textContent = "σ-остов и p-орбитали";
  }

  function run(animate) {
    const res = jacobiEigen(A, { snap: true });
    // перевод: x по убыванию (снизу вверх по энергии), векторы в том же порядке
    const idx = res.values.map((_, i) => i).sort((a, b) => res.values[b] - res.values[a]);
    sol = { xs: idx.map((i) => res.values[i]), cs: idx.map((i) => res.vectors[i]), res };
    // вырожденную пару поворачиваем к «учебному» виду: у второй функции c₁ = 0
    for (let k = 0; k + 1 < N; k++) {
      if (Math.abs(sol.xs[k] - sol.xs[k + 1]) > 1e-6) continue;
      const [a, b] = [sol.cs[k], sol.cs[k + 1]];
      const t = Math.atan2(b[0], a[0]), c = Math.cos(t), s = Math.sin(t);
      let w1 = a.map((x, i) => c * x + s * b[i]), w2 = a.map((x, i) => -s * x + c * b[i]);
      const fix = (w) => { const f = w.find((x) => Math.abs(x) > 1e-6) || 1; return f < 0 ? w.map((x) => -x) : w; };
      sol.cs[k] = fix(w1); sol.cs[k + 1] = fix(w2);
      k++;
    }
    const snaps = res.snapshots;
    const showSnap = (k) => {
      const M = snaps[k];
      solve.querySelector("[data-J]").innerHTML = matRow(op(k === 0 ? "A =" : `после ${k}-го прохода:`), matrixHTML(M, { fmt: (x) => num(x, 2), cls: (i, j, x) => (i === j ? "dg" : Math.abs(x) > 1e-3 ? "hi" : "z") }));
      solve.querySelector("[data-st]").textContent = `Проход ${k} из ${snaps.length - 1} · внедиагональная норма ${num(res.history[k], 6)}`;
    };
    clearInterval(anim);
    if (animate && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
      let k = 0;
      showSnap(0);
      anim = setInterval(() => {
        k++;
        if (k >= snaps.length) { clearInterval(anim); finish(true); return; }
        showSnap(k);
      }, 550);
    } else { showSnap(snaps.length - 1); finish(true); }
  }

  function finish(selectHomo) {
    const { xs, cs, res } = sol;
    const occ = occupy(xs, ne);
    if (selectHomo) { sel = 0; occ.forEach((o, i) => { if (o) sel = i; }); }
    solve.querySelector("[data-st]").textContent = `Готово: ${res.rotations} вращений Якоби за ${res.sweeps} проходов, внедиагональная норма < 10⁻¹².`;
    // диаграмма уровней
    const xmin = Math.min(...xs), xmax = Math.max(...xs), span = Math.max(1e-6, xmax - xmin);
    const yOf = (x) => 40 + ((xmax - x) / span) * 280; // выше энергия — меньше x
    const groups = [];
    xs.forEach((x, i) => { const g = groups.find((g) => Math.abs(g.x - x) < 1e-6); g ? g.ids.push(i) : groups.push({ x, ids: [i] }); });
    let svg = `<line x1="40" x2="40" y1="20" y2="340" stroke="var(--line-2)"/><text x="10" y="16" font-size="12" fill="var(--text-3)">E</text>
      <line x1="44" x2="250" y1="${yOf(0)}" y2="${yOf(0)}" stroke="var(--text-3)" stroke-dasharray="4 4"/><text x="252" y="${yOf(0) + 4}" font-size="11" fill="var(--text-3)">E = α</text>`;
    for (const g of groups) {
      const y = yOf(g.x), w = 150 / g.ids.length;
      g.ids.forEach((i, j) => {
        const x0 = 60 + j * w + 4, x1 = 60 + (j + 1) * w - 4, on = i === sel;
        const e = occ[i] === 2 ? "↑↓" : occ[i] === 1 ? "↑" : "";
        svg += `<g class="lv" data-i="${i}"><rect x="${x0 - 4}" y="${y - 16}" width="${x1 - x0 + 8}" height="26" fill="transparent"/>
          <line class="bar" x1="${x0}" x2="${x1}" y1="${y}" y2="${y}" stroke="${on ? "#3d8bff" : "var(--text)"}" stroke-width="${on ? 5 : 3}" stroke-linecap="round"/>
          <text x="${(x0 + x1) / 2}" y="${y - 4}" text-anchor="middle" font-size="14" fill="#ffb02e" font-weight="700">${e}</text></g>`;
      });
      svg += `<text x="218" y="${y + 4}" font-size="11.5" fill="var(--text-2)">${Math.abs(g.x) < 1e-6 ? "α" : `α ${g.x >= 0 ? "+" : "−"} ${num(Math.abs(g.x), 3) === "1" ? "" : num(Math.abs(g.x), 3)}β`}</text>`;
    }
    const svgEl = lv.querySelector("[data-lv]");
    svgEl.innerHTML = svg;
    svgEl.querySelectorAll(".lv").forEach((g) => g.addEventListener("click", () => { sel = +g.dataset.i; finish(false); }));
    // результаты
    const sumX = occ.reduce((s, o, i) => s + o * xs[i], 0);
    const loc = 2 * Math.min(Math.floor(ne / 2), Math.floor(N / 2)); // изолированные C=C + неподелённые пары на уровне α
    const deloc = sumX - loc;
    const bonds = bondsOf(A);
    const P = (r, s) => occ.reduce((acc, o, k) => acc + o * cs[k][r] * cs[k][s], 0);
    const q = (r) => 1 - P(r, r);
    const homo = occ.reduce((a, o, i) => (o ? i : a), -1), lumo = occ.findIndex((o) => o < 2 && o === 0);
    const gap = homo >= 0 && lumo >= 0 ? xs[homo] - xs[lumo] : null;
    const name = (i) => `ψ${String(i + 1).replace(/\d/g, (d) => "₀₁₂₃₄₅₆₇₈₉"[d])}`;
    const nodes = bonds.filter(([r, s]) => cs[sel][r] * cs[sel][s] < -1e-9).length;
    st.querySelector("[data-b]").innerHTML = `<b>${name(sel)}${sel === homo ? " · ВЗМО" : sel === lumo ? " · НСМО" : ""}</b> · E = α ${xs[sel] >= 0 ? "+" : "−"} ${num(Math.abs(xs[sel]), 3)}β · узлов между атомами: ${nodes}`;
    scene.setCoeffs(cs[sel]);
    const labs = labMode === "c" ? pts.map((p, r) => ({ pos: p, y: -1.9 * Math.min(1.35, Math.abs(cs[sel][r]) / 0.55) - 0.55, text: num(cs[sel][r], 3) }))
      : labMode === "p" ? bonds.map(([r, s]) => ({ pos: [(pts[r][0] + pts[s][0]) / 2, (pts[r][1] + pts[s][1]) / 2], y: 0.45, text: num(P(r, s), 3) }))
      : labMode === "q" ? pts.map((p, r) => ({ pos: p, y: 0.55, text: (q(r) > 0 ? "+" : "") + num(q(r), 3) })) : [];
    scene.setLabels(labs);
    const bondRows = bonds.slice(0, 16).map(([r, s]) => { const p = P(r, s); return `<tr><td>C${r + 1}–C${s + 1}</td><td>${num(p, 3)}</td><td>${num(1.517 - 0.18 * p, 3)} Å</td></tr>`; }).join("");
    lv.querySelector("[data-res]").innerHTML = `
      <p style="margin-top:0">Корни: x = ${xs.map((x) => num(x, 3)).join("; ")}.</p>
      <p>Энергия π-электронов: E<sub>π</sub> = Σ nₖEₖ = <b>${ne}α ${sumX >= 0 ? "+" : "−"} ${num(Math.abs(sumX), 3)}β</b>.</p>
      <p>Локализованная модель (${loc / 2} изолированных C=C, как в этене${ne > loc + 1 ? "; остальные электроны — неподелённые пары на уровне α" : ""}): ${ne}α + ${loc}β. ${term("y12_deloc", "Энергия делокализации")}: <b>${num(deloc, 3)}β</b>${Math.abs(deloc) > 1e-6 ? ` ≈ ${num(-deloc * 75, 0)} кДж/моль (при β ≈ −75 кДж/моль)` : ""}.</p>
      ${gap != null ? `<p>Щель ВЗМО–НСМО: ${num(gap, 3)}|β|${gap < 1e-6 ? " — вырожденные полузаполненные уровни: бирадикал, молекула неустойчива" : ""}.</p>` : ""}
      <div class="table-wrap"><table class="data"><tr><th>Связь</th><th>Порядок π-связи pᵣₛ</th><th>Длина по Коулсону</th></tr>${bondRows}</table></div>`;
  }

  lv.querySelectorAll("[data-lab]").forEach((b) => (b.onclick = () => { lv.querySelectorAll("[data-lab]").forEach((x) => x.classList.toggle("on", x === b)); labMode = b.dataset.lab; if (sol) finish(false); }));
  solve.querySelector("[data-go]").onclick = () => run(true);

  setup(true);
  run(false); // первый раз — сразу, чтобы было что покрутить

  // ---------- Ароматичность ----------
  const ar = h(`<section id="aromatic"><h2>Правило Хюккеля 4n + 2 и круг Фроста</h2>
    <p>Для кольца из N атомов матрица смежности циркулянтная, и собственные значения находятся точно: xₖ = 2cos(2πk/N), k = 0…N − 1. Геометрически это ${term("y12_frost", "круг Фроста")}: впишите правильный N-угольник вершиной вниз в окружность радиуса 2|β| — вершины дадут уровни. Нижний уровень одиночный, остальные — парами. Замкнутая оболочка получается при 2 + 4n электронах: 2, 6, 10… Это и есть правило ароматичности.</p>
    <div class="table-wrap"><table class="data" data-ar></table></div>
    <div class="callout warn"><b>Важно.</b> Циклобутадиен (4 π-электрона) по Хюккелю имеет нулевую энергию делокализации и два неспаренных электрона на вырожденных несвязывающих уровнях — он <b>антиароматичен</b>. В реальности молекула искажается в прямоугольник и живёт лишь при 4 К в матрице аргона.</div>
  </section>`);
  el.appendChild(ar);
  let rows = `<tr><th>Кольцо</th><th>π-e</th><th>Уровни x</th><th>E делок., |β|</th><th>Вывод</th></tr>`;
  for (const [n, e, nm] of [[3, 2, "C₃H₃⁺ циклопропенил"], [4, 4, "C₄H₄ циклобутадиен"], [5, 6, "C₅H₅⁻ циклопентадиенил"], [6, 6, "C₆H₆ бензол"], [7, 6, "C₇H₇⁺ тропилий"], [8, 8, "C₈H₈ циклооктатетраен (плоский)"]]) {
    const R = jacobiEigen(adjacency(ringCoords(n)));
    const xs = R.values.slice().reverse();
    const occ = occupy(xs, e);
    const d = occ.reduce((s, o, i) => s + o * xs[i], 0) - 2 * Math.min(Math.floor(e / 2), Math.floor(n / 2));
    const arom = (e - 2) % 4 === 0;
    rows += `<tr><td>${nm}</td><td>${e}</td><td class="small">${[...new Set(xs.map((x) => num(x, 3)))].join("; ")}</td><td>${num(d, 3)}</td><td>${arom ? "ароматичен (4n+2)" : "антиароматичен (4n)"}</td></tr>`;
  }
  ar.querySelector("[data-ar]").innerHTML = rows;

  el.appendChild(h(`<section id="example"><h2>Разбор: бутадиен вручную</h2>
    <p>Нумеруем атомы C1=C2–C3=C4. Секулярный определитель:</p>
    <div class="eq">| −x 1 0 0 ; 1 −x 1 0 ; 0 1 −x 1 ; 0 0 1 −x | = x⁴ − 3x² + 1 = 0</div>
    <p>Это биквадратное уравнение: x² = (3 ± √5)/2, откуда x = ±1,618 и ±0,618 (золотое сечение — не случайно, для цепи xₖ = 2cos(kπ/(N+1))). Четыре π-электрона занимают ψ₁ (α + 1,618β) и ψ₂ (α + 0,618β):</p>
    <div class="eq">E<sub>π</sub> = 4α + 2·(1,618 + 0,618)β = 4α + 4,472β; E<sub>делок</sub> = 0,472β ≈ −35 кДж/моль</div>
    <p>Коэффициенты ψ₁ = 0,372φ₁ + 0,602φ₂ + 0,602φ₃ + 0,372φ₄. Порядок π-связи C1–C2: p = 2·0,372·0,602 + 2·0,602·0,372 = 0,894; C2–C3: 2·0,602² − 2·0,372² = 0,447. Значит, «двойные» связи не совсем двойные, а «одинарная» частично двойная — что и видно по длинам: 1,34 и 1,45 Å вместо 1,33 и 1,54 Å. Проверь всё это на рабочем столе выше.</p>
    <p class="small muted">Порядок связи по Коулсону: pᵣₛ = Σₖ nₖ cᵣₖ cₛₖ; эмпирическая связь с длиной r ≈ 1,517 − 0,18·p Å.</p>
  </section>`));
}

export const quiz = [
  { q: "В методе Хюккеля матрица H равна…", options: ["α·A + β·I", "α·I + β·A, где A — матрица смежности", "β·I", "единичной матрице"], answer: 1, why: "α на диагонали, β у связанных соседей, 0 в остальных местах." },
  { q: "Собственные значения x для бензола (E = α + xβ):", options: ["±1, ±1, ±1", "2, 1, 1, −1, −1, −2", "±1,618, ±0,618", "2, 0, 0, −2, …"], answer: 1, why: "xₖ = 2cos(2πk/6): 2, 1, 1, −1, −1, −2." },
  { q: "Энергия делокализации бензола по Хюккелю:", options: ["0", "0,472β", "2β", "6β"], answer: 2, why: "Eπ = 6α + 8β, а у трёх изолированных C=C — 6α + 6β; разница 2β ≈ −150 кДж/моль." },
  { q: "Почему уровень с x = +1,618 ниже по энергии, чем с x = −1,618?", options: ["Потому что β < 0", "Потому что α > 0", "Из-за перекрывания S", "Они равны"], answer: 0, why: "E = α + xβ, и β отрицателен: чем больше x, тем ниже E." },
  { q: "Какое из колец ароматично по правилу Хюккеля?", options: ["Циклобутадиен, 4 π-e", "Циклооктатетраен, 8 π-e", "Циклопентадиенил-анион, 6 π-e", "Циклопропенил-анион, 4 π-e"], answer: 2, why: "6 = 4·1 + 2: замкнутая оболочка, как у бензола." },
  { q: "Что делает одно вращение Якоби?", options: ["Удваивает матрицу", "Обнуляет выбранный внедиагональный элемент a_pq", "Находит определитель", "Меняет местами строки"], answer: 1, why: "Поворот в плоскости (p, q) на угол φ, при котором a_pq становится 0; сумма квадратов внедиагональных элементов убывает." },
];
