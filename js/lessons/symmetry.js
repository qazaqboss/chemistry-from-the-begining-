import { h, kid, term, stage } from "../ui.js";
import { createViewer } from "../three/core.js";
import { frame } from "../three/molecule.js";
import { SYM_MOLS, createSymScene, opMatrix } from "../three/symmetry-ops.js";
import { matMul, det, trace, matrixHTML, matRow, op, num } from "../three/qm-linalg.js";

// Красивые значения элементов матриц: ½, √3/2, 1/√2…
const NICE = [[0, "0"], [1, "1"], [0.5, "½"], [Math.sqrt(3) / 2, "√3/2"], [Math.SQRT1_2, "1/√2"], [1 / 3, "⅓"], [2 / 3, "⅔"]];
const nice = (x) => {
  for (const [v, s] of NICE) {
    if (Math.abs(Math.abs(x) - v) < 1e-6) return v === 0 ? "0" : (x < 0 ? "−" : "") + s;
  }
  return num(x, 3);
};
const M = (o) => opMatrix(o, 1).map((r) => r.map((x) => (Math.abs(x) < 1e-12 ? 0 : x)));
const same = (A, B) => A.every((r, i) => r.every((x, j) => Math.abs(x - B[i][j]) < 1e-6));

const C2V = SYM_MOLS.h2o.ops;
const CHAR = [
  ["A₁", [1, 1, 1, 1], "z", "x², y², z²"],
  ["A₂", [1, 1, -1, -1], "R_z", "xy"],
  ["B₁", [1, -1, 1, -1], "x, R_y", "xz"],
  ["B₂", [1, -1, -1, 1], "y, R_x", "yz"],
];
const REPS = [
  { id: "xyz", label: "Γ(x, y, z)", chi: C2V.map((o) => Math.round(trace(M(o)))), note: "характеры = следы матриц 3×3 из урока: 3, −1, 1, 1" },
  { id: "3n", label: "Γ₃N (все смещения H₂O)", chi: [9, -1, 1, 3], note: "χ = (число атомов, оставшихся на месте) × (след матрицы): E — 3·3, C₂ — 1·(−1), σᵥ(xz) — 1·1, σᵥ′(yz) — 3·1" },
  { id: "oh", label: "Γ(связи O–H)", chi: [2, 0, 0, 2], note: "χ = число связей O–H, оставшихся на месте" },
];

export async function render(el) {
  el.classList.add("sym");
  el.appendChild(h(`<div>
    <style>
      .sym .mt{border-collapse:collapse;margin:10px 0;font-family:var(--mono)}
      .sym .mt td,.sym .mt th{border:1px solid var(--line-2);padding:8px 10px;text-align:center;min-width:56px}
      .sym .mt th{background:var(--surface-2);color:var(--text-2)}
      .sym .mt td.cell{cursor:pointer}
      .sym .mt td.cell:hover,.sym .mt td.cell.on{background:color-mix(in srgb,var(--accent) 22%,transparent)}
      .sym .mt td.e{color:var(--good)}
      .sym .info{display:grid;grid-template-columns:auto 1fr;gap:6px 14px;align-items:center}
      @media (max-width:600px){.sym .info{grid-template-columns:1fr}}
    </style>
    <p class="lead">Симметрия молекулы — не украшение, а мощный вычислительный инструмент. Она заранее говорит, какие орбитали могут смешиваться, какие колебания видны в ИК-спектре, какие переходы разрешены. А каждая операция симметрии — это просто матрица 3×3, и работать с ними можно обычной линейной алгеброй.</p>
    ${kid("Если повернуть снежинку на шестую часть круга, она будет выглядеть точно так же. Молекулы тоже бывают «снежинками»: их можно повернуть или отразить в зеркале, и ничего не изменится. Химики считают, сколько у молекулы таких «волшебных движений», — и многое о ней узнают.")}
  </div>`));

  el.appendChild(h(`<section id="ops"><h2>Операции и элементы симметрии</h2>
    <p>${term("y12_symop", "Операция симметрии")} — движение, после которого молекула совпадает сама с собой (каждый атом встаёт на место такого же атома). Элемент симметрии — геометрический объект, относительно которого операция выполняется. Каждая операция линейна: r′ = R·r, где R — ортогональная матрица 3×3 (RᵀR = I).</p>
    <div class="table-wrap"><table class="data">
      <tr><th>Операция</th><th>Элемент</th><th>Матрица (ось z / плоскость xy)</th><th>det</th></tr>
      <tr><td>E — тождество</td><td>—</td><td>${matrixHTML([[1, 0, 0], [0, 1, 0], [0, 0, 1]], { fmt: nice })}</td><td>+1</td></tr>
      <tr><td>Cₙ — поворот на 2π/n</td><td>ось</td><td>${matrixHTML([["cos φ", "−sin φ", 0], ["sin φ", "cos φ", 0], [0, 0, 1]], { fmt: nice })}</td><td>+1</td></tr>
      <tr><td>σ — отражение</td><td>плоскость</td><td>${matrixHTML([[1, 0, 0], [0, 1, 0], [0, 0, -1]], { fmt: nice })}</td><td>−1</td></tr>
      <tr><td>i — инверсия</td><td>центр</td><td>${matrixHTML([[-1, 0, 0], [0, -1, 0], [0, 0, -1]], { fmt: nice })}</td><td>−1</td></tr>
      <tr><td>Sₙ — зеркальный поворот (Cₙ, затем σh)</td><td>зеркально-поворотная ось</td><td>${matrixHTML([["cos φ", "−sin φ", 0], ["sin φ", "cos φ", 0], [0, 0, -1]], { fmt: nice })}</td><td>−1</td></tr>
    </table></div>
    <p class="small muted">Собственные операции (det = +1) можно выполнить с реальным предметом; несобственные (det = −1) превращают правую руку в левую. Заметьте: S₂ = i, S₁ = σ. Молекула, у которой нет ни одной Sₙ, хиральна.</p>
  </section>`));

  // ---------- 3D ----------
  const sec = h(`<section id="viewer"><h2>Операции в 3D</h2>
    <p>Выбери молекулу и операцию. Молекула плавно выполнит её, а атомы-«двойники» с номерами покажут, кто куда переехал: молекула совпала сама с собой, но атомы переставились. Жёлтая линия — ось, голубой диск — плоскость.</p>
    <div class="chips" data-mols></div>
  </section>`);
  el.appendChild(sec);
  const st = stage(`<div class="overlay"><span data-a style="font-size:.95rem"></span><span data-b></span></div>`, { wide: true });
  sec.appendChild(st);
  const ctl = h(`<div class="card pad" style="margin-top:10px">
    <div class="chips" data-ops></div>
    <div class="row" style="margin-top:10px"><button class="btn small" type="button" data-reset>↺ Вернуть нумерацию</button></div>
    <div class="info" style="margin-top:12px"><div data-mat></div><div class="small" data-txt></div></div>
  </div>`);
  sec.appendChild(ctl);
  const v = createViewer(st, { camera: [4, 3.5, 6], autoRotateSpeed: 0.35 });
  const scene = createSymScene(v);
  let key = "h2o";
  const describe = (o) => {
    const R = M(o);
    ctl.querySelector("[data-mat]").innerHTML = matRow(op(`${o.name} =`), matrixHTML(R, { fmt: nice }));
    const d = Math.round(det(R)), tr = trace(R);
    ctl.querySelector("[data-txt]").innerHTML = `<b>${o.name}</b>: ${o.note}.<br>det = ${d > 0 ? "+1 (собственная)" : "−1 (несобственная)"} · след χ = ${nice(tr)}<br><span class="muted">След — это ${term("y12_character", "характер")} операции в представлении (x, y, z).</span>`;
  };
  const opsBox = ctl.querySelector("[data-ops]");
  const setMol = (k) => {
    key = k;
    const mol = scene.setMolecule(k);
    frame(v, k === "c6h6" ? 3.4 : 1.9);
    opsBox.innerHTML = "";
    mol.ops.forEach((o) => {
      const b = h(`<button class="chip" type="button">${o.name}</button>`);
      b.onclick = () => {
        if (scene.busy()) return;
        opsBox.querySelectorAll(".chip").forEach((x) => x.classList.toggle("on", x === b));
        describe(o);
        st.querySelector("[data-b]").textContent = `выполняется ${o.name}…`;
        scene.apply(o, () => { st.querySelector("[data-b]").textContent = `${o.name} выполнена: молекула совпала сама с собой`; });
      };
      opsBox.appendChild(b);
    });
    st.querySelector("[data-a]").innerHTML = `<b>${mol.label}</b> · точечная группа <b>${mol.group.replace("_d", "<sub>d</sub>")}</b>, порядок h = ${mol.order}`;
    st.querySelector("[data-b]").textContent = "выбери операцию";
    scene.showElement({ kind: "E" });
    describe(mol.ops[0]);
  };
  Object.entries(SYM_MOLS).forEach(([k, m], i) => {
    const b = h(`<button class="chip${i ? "" : " on"}" type="button">${m.label} · ${m.group.replace("_d", "d")}</button>`);
    b.onclick = () => { sec.querySelectorAll("[data-mols] .chip").forEach((x) => x.classList.toggle("on", x === b)); setMol(k); };
    sec.querySelector("[data-mols]").appendChild(b);
  });
  ctl.querySelector("[data-reset]").onclick = () => scene.reset();
  setMol("h2o");

  el.appendChild(h(`<section id="groups"><h2>Точечные группы</h2>
    <p>Все операции симметрии молекулы образуют ${term("y12_pointgroup", "точечную группу")} (при всех операциях хотя бы одна точка — центр масс — остаётся на месте). Это группа в строгом алгебраическом смысле:</p>
    <ul>
      <li><b>замкнутость</b>: произведение AB двух операций (сначала B, потом A) — тоже операция группы; для матриц это просто матричное произведение;</li>
      <li><b>ассоциативность</b>: (AB)C = A(BC) — автоматически, как у матриц;</li>
      <li><b>единица</b> E: EA = AE = A;</li>
      <li><b>обратный элемент</b>: для каждой A есть A⁻¹ = Aᵀ, и AA⁻¹ = E.</li>
    </ul>
    <p>Число операций — порядок группы h. Примеры: H₂O — C₂v (h = 4), NH₃ — C₃v (h = 6), CH₄ — T<sub>d</sub> (h = 24), бензол — D₆h (h = 24), CO₂ — D∞h. Алгоритм определения: есть ли особая группа (линейная, T<sub>d</sub>, O<sub>h</sub>)? → найти главную ось Cₙ → есть ли n осей C₂ ⟂ Cₙ (группы D) → есть ли σh (…h), n плоскостей σᵥ (…v) или σd (…d).</p>
  </section>`));

  // ---------- Таблица умножения ----------
  const mt = h(`<section id="table"><h2>Таблица умножения группы C₂v</h2>
    <p>Строка — операция A, столбец — B, в клетке — AB (сначала B, затем A). Таблица вычисляется прямо сейчас перемножением матриц и сравнением результата с матрицами группы. Нажми на клетку — увидишь само умножение, а молекула воды в 3D выполнит обе операции подряд.</p>
    <div class="table-wrap"><table class="mt" data-t></table></div>
    <div class="card pad" data-prod><span class="muted">Нажми на любую клетку таблицы.</span></div>
    <p class="small muted">Каждая операция встречается в каждой строке и каждом столбце ровно один раз (как в судоку) — это верно для любой группы. C₂v абелева: AB = BA, таблица симметрична.</p>
  </section>`);
  el.appendChild(mt);
  const mats = C2V.map(M);
  const find = (P) => C2V.findIndex((o, i) => same(mats[i], P));
  let html = `<tr><th>A \\ B</th>${C2V.map((o) => `<th>${o.name}</th>`).join("")}</tr>`;
  C2V.forEach((a, i) => {
    html += `<tr><th>${a.name}</th>${C2V.map((b, j) => { const k = find(matMul(mats[i], mats[j])); return `<td class="cell${k === 0 ? " e" : ""}" data-i="${i}" data-j="${j}">${k >= 0 ? C2V[k].name : "?"}</td>`; }).join("")}</tr>`;
  });
  mt.querySelector("[data-t]").innerHTML = html;
  mt.querySelectorAll("td.cell").forEach((td) => (td.onclick = () => {
    mt.querySelectorAll("td.cell").forEach((x) => x.classList.toggle("on", x === td));
    const i = +td.dataset.i, j = +td.dataset.j, P = matMul(mats[i], mats[j]), k = find(P);
    mt.querySelector("[data-prod]").innerHTML = `${matRow(matrixHTML(mats[i], { fmt: nice }), op("·"), matrixHTML(mats[j], { fmt: nice }), op("="), matrixHTML(P, { fmt: nice }))}
      <p style="margin:8px 0 0"><b>${C2V[i].name} · ${C2V[j].name} = ${C2V[k].name}</b>: сначала ${C2V[j].name}, потом ${C2V[i].name}. Результат совпал с матрицей ${C2V[k].name} — проверено произведением.</p>`;
    if (key !== "h2o") { sec.querySelectorAll("[data-mols] .chip").forEach((x, n) => x.classList.toggle("on", n === 0)); setMol("h2o"); }
    if (scene.busy()) return;
    scene.reset();
    st.querySelector("[data-b]").textContent = `${C2V[i].name}·${C2V[j].name}: сначала ${C2V[j].name}…`;
    scene.apply(C2V[j], () => scene.apply(C2V[i], () => { st.querySelector("[data-b]").textContent = `итог = ${C2V[k].name}`; scene.showElement(C2V[k]); }));
  }));

  // ---------- Характеры ----------
  const ch = h(`<section id="characters"><h2>Характеры и таблица характеров C₂v</h2>
    <p>Матрицы операций образуют <b>представление</b> группы. Если перейти в другой базис, матрицы изменятся (R → T⁻¹RT), но их след — нет. Поэтому представление удобно описывать набором следов — характеров χ(R). Любое представление раскладывается на неприводимые; для C₂v их четыре, все одномерные:</p>
    <div class="table-wrap"><table class="mt"><tr><th>C₂v</th>${C2V.map((o) => `<th>${o.name}</th>`).join("")}<th>линейные, вращения</th><th>квадратичные</th></tr>
      ${CHAR.map(([n, c, l, q]) => `<tr><th>${n}</th>${c.map((x) => `<td>${x > 0 ? "1" : "−1"}</td>`).join("")}<td>${l.replace(/R_(\w)/g, "R<sub>$1</sub>")}</td><td>${q}</td></tr>`).join("")}</table></div>
    <p>Число вхождений неприводимого представления Γᵢ в приводимое Γ даёт <b>формула разложения</b>:</p>
    <div class="eq">nᵢ = (1/h) · Σ<sub>R</sub> χ(R) · χᵢ(R)</div>
    <div class="chips" data-reps></div>
    <div class="card pad" style="margin-top:10px" data-red></div>
    <div class="callout good">Итог для воды: из 9 степеней свободы Γ₃N = 3A₁ + A₂ + 2B₁ + 3B₂ вычитаем трансляции (A₁ + B₁ + B₂) и вращения (A₂ + B₁ + B₂) — остаются колебания <b>2A₁ + B₂</b>: симметричное валентное, ножничное и антисимметричное валентное. Все три ИК-активны, потому что A₁ и B₂ преобразуются как z и y. Их анимация — в уроке «Спектроскопия».</div>
  </section>`);
  el.appendChild(ch);
  const reduce = (r) => {
    const parts = CHAR.map(([n, c]) => {
      const terms = r.chi.map((x, k) => `${num(x, 0)}·${c[k] < 0 ? "(−1)" : "1"}`).join(" + ").replace(/\+ −/g, "− ");
      const ni = r.chi.reduce((s, x, k) => s + x * c[k], 0) / 4;
      return { n, ni, line: `n(${n}) = ¼(${terms}) = <b>${num(ni, 2)}</b>` };
    });
    const sum = parts.filter((p) => p.ni).map((p) => `${p.ni > 1 ? num(p.ni, 0) : ""}${p.n}`).join(" + ");
    ch.querySelector("[data-red]").innerHTML = `<p style="margin-top:0">χ = (${r.chi.map((x) => num(x, 0)).join(", ")}) — ${r.note}.</p>${parts.map((p) => `<div class="small" style="font-family:var(--mono)">${p.line}</div>`).join("")}<p style="margin-bottom:0">${r.label} = <b>${sum}</b></p>`;
  };
  REPS.forEach((r, i) => {
    const b = h(`<button class="chip${i ? "" : " on"}" type="button">${r.label}</button>`);
    b.onclick = () => { ch.querySelectorAll("[data-reps] .chip").forEach((x) => x.classList.toggle("on", x === b)); reduce(r); };
    ch.querySelector("[data-reps]").appendChild(b);
  });
  reduce(REPS[0]);
}

export const quiz = [
  { q: "Чему равна матрица инверсии i?", options: ["Единичной матрице", "−I (минус единичная)", "diag(1, 1, −1)", "Матрице поворота на 90°"], answer: 1, why: "Инверсия переводит (x, y, z) в (−x, −y, −z)." },
  { q: "Определитель матрицы отражения σ:", options: ["0", "+1", "−1", "2"], answer: 2, why: "Отражение — несобственная операция, она меняет «правое» на «левое»." },
  { q: "Точечная группа молекулы воды:", options: ["C₃v", "C₂v", "D₆h", "T_d"], answer: 1, why: "Ось C₂ и две плоскости σᵥ: всего 4 операции." },
  { q: "Чему равно произведение C₂ · σᵥ(xz) в группе C₂v?", options: ["E", "C₂", "σᵥ(xz)", "σᵥ′(yz)"], answer: 3, why: "diag(−1, −1, 1)·diag(1, −1, 1) = diag(−1, 1, 1) — это отражение в плоскости yz." },
  { q: "Характер операции в представлении — это…", options: ["определитель матрицы", "след матрицы (сумма диагональных элементов)", "наибольший элемент", "порядок группы"], answer: 1, why: "След не зависит от выбора базиса, поэтому характеризует представление." },
  { q: "Сколько колебаний у молекулы H₂O и какой они симметрии?", options: ["3: 2A₁ + B₂", "3: A₁ + A₂ + B₁", "6: 3A₁ + 3B₂", "9: все"], answer: 0, why: "3N − 6 = 3; разложение Γ₃N без трансляций и вращений даёт 2A₁ + B₂." },
];
