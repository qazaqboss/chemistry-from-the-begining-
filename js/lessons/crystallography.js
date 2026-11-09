import { h, kid, term, stage } from "../ui.js";
import { createViewer } from "../three/core.js";
import { frame } from "../three/molecule.js";
import { SYSTEMS, BRAVAIS, CENT_NAME, cellMatrix, createBravais, createMiller, createPacking } from "../three/crystal-cell.js";
import { matMul, transpose, det, inverse, matrixHTML, matRow, op, num } from "../three/qm-linalg.js";

const PNAME = { a: "a, Å", b: "b, Å", c: "c, Å", al: "α, °", be: "β, °", ga: "γ, °" };
const RANGE = { a: [2, 4.5, 0.05], b: [2, 4.5, 0.05], c: [2, 5.5, 0.05], al: [60, 120, 1], be: [90, 125, 1], ga: [60, 120, 1] };
const SHORT = { cubic: "куб.", tetragonal: "тетраг.", orthorhombic: "ромб.", hexagonal: "гекс.", rhombohedral: "ромбоэдр.", monoclinic: "монокл.", triclinic: "трикл." };
const LAMBDA = [["Cu Kα", 1.5406], ["Mo Kα", 0.7107], ["Co Kα", 1.7890]];
const bar = (x) => (x < 0 ? `<span style="text-decoration:overline">${-x}</span>` : `${x}`);
const hklStr = (h_, k, l) => `(${bar(h_)}${bar(k)}${bar(l)})`;

export async function render(el) {
  el.classList.add("cry");
  el.appendChild(h(`<div>
    <style>
      .cry svg{width:100%;height:auto;display:block}
      .cry .plot{background:var(--surface-2);border-radius:12px;border:1px solid var(--line)}
      .cry .two{display:grid;grid-template-columns:1fr 1fr;gap:14px}
      @media (max-width:700px){.cry .two{grid-template-columns:1fr}}
      .cry .three{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
      @media (max-width:560px){.cry .three{grid-template-columns:1fr}}
    </style>
    <p class="lead">Кристалл — это трёхмерный узор, повторяющийся с идеальной точностью. Чтобы описать его, достаточно одной элементарной ячейки — трёх векторов a, b, c — и того, что лежит внутри. Всё остальное — линейная алгебра: координаты, расстояния, углы, объём и даже картина дифракции рентгеновских лучей.</p>
    ${kid("Представь обои с повторяющимся рисунком: достаточно знать один кусочек-«плитку», чтобы оклеить всю стену. В кристалле такая плитка — объёмная коробочка-ячейка, а складывают её во все три стороны.")}
  </div>`));

  // ---------- Браве ----------
  const br = h(`<section id="bravais"><h2>14 решёток Браве</h2>
    <p>Решётка — бесконечный набор точек r = n₁a + n₂b + n₃c (nᵢ — целые). По форме ячейки решётки делятся на 7 сингоний, а с учётом центрирования (P — только вершины, I — ещё центр, F — центры граней, C — центры двух граней) получается ровно 14 ${term("y12_bravais", "решёток Браве")} (О. Браве, 1848). Другие варианты сводятся к этим: например, «базоцентрированная тетрагональная» — это просто примитивная с меньшей ячейкой.</p>
    <div class="chips" data-br></div>
  </section>`);
  el.appendChild(br);
  const st = stage(`<div class="overlay"><span data-a style="font-size:.95rem"></span><span data-b></span></div>`, { wide: true });
  br.appendChild(st);
  const ctl = h(`<div class="card pad" style="margin-top:10px"><div class="three" data-sl></div>
    <h3 style="margin:16px 0 4px">Матрица ячейки и метрический тензор</h3>
    <p class="small muted" style="margin:0">Столбцы M — декартовы координаты векторов a, b, c (a вдоль x, b в плоскости xy). Метрический тензор G = MᵀM содержит все скалярные произведения: Gᵢⱼ = aᵢ·aⱼ, то есть длины на диагонали и ab·cos γ и т. п. вне неё.</p>
    <div data-mat style="overflow-x:auto"></div><p data-v style="margin:6px 0 0"></p></div>`);
  br.appendChild(ctl);
  const v = createViewer(st, { camera: [7, 5, 9], autoRotateSpeed: 0.5 });
  const bv = createBravais(v);
  let sys = "cubic", cent = "F", P = { ...SYSTEMS.cubic.p };
  const sl = ctl.querySelector("[data-sl]");
  const updB = () => {
    const S = SYSTEMS[sys];
    P = S.tie(P);
    sl.querySelectorAll("label").forEach((l) => (l.querySelector("b").textContent = num(P[l.dataset.k], l.dataset.k.length > 1 ? 0 : 2)));
    const M = cellMatrix(P);
    bv.set(M, cent);
    const G = matMul(transpose(M), M), dG = det(G), V = Math.sqrt(dG);
    const ca = Math.cos((P.al * Math.PI) / 180), cb = Math.cos((P.be * Math.PI) / 180), cg = Math.cos((P.ga * Math.PI) / 180);
    const V2 = P.a * P.b * P.c * Math.sqrt(1 - ca * ca - cb * cb - cg * cg + 2 * ca * cb * cg);
    ctl.querySelector("[data-mat]").innerHTML = matRow(op("M ="), matrixHTML(M, { fmt: (x) => num(x, 3) }), op("G = MᵀM ="), matrixHTML(G, { fmt: (x) => num(x, 3) }));
    const Z = { P: 1, R: 1, I: 2, C: 2, F: 4 }[cent];
    ctl.querySelector("[data-v]").innerHTML = `det G = ${num(dG, 3)} Å⁶ → <b>V = √det G = ${num(V, 3)} Å³</b> (проверка по формуле abc√(1 − cos²α − cos²β − cos²γ + 2cosα cosβ cosγ) = ${num(V2, 3)} Å³). Узлов на ячейку: ${Z}.`;
    st.querySelector("[data-a]").innerHTML = `<b>${S.name} ${cent}</b> · ${CENT_NAME[cent]}`;
    st.querySelector("[data-b]").textContent = S.rule;
  };
  const buildSliders = () => {
    sl.innerHTML = "";
    for (const k of SYSTEMS[sys].free) {
      const [mn, mx, step] = RANGE[k];
      const lab = h(`<label class="ctl" data-k="${k}">${PNAME[k]}: <b></b><input type="range" min="${mn}" max="${mx}" step="${step}" value="${P[k]}"></label>`);
      lab.querySelector("input").oninput = (e) => { P[k] = +e.target.value; updB(); };
      sl.appendChild(lab);
    }
  };
  BRAVAIS.forEach(([s, c]) => {
    const b = h(`<button class="chip${s === sys && c === cent ? " on" : ""}" type="button">${SHORT[s]} ${c}</button>`);
    b.title = `${SYSTEMS[s].name}, ${CENT_NAME[c]}`;
    b.onclick = () => { br.querySelectorAll("[data-br] .chip").forEach((x) => x.classList.toggle("on", x === b)); if (s !== sys) P = { ...SYSTEMS[s].p }; sys = s; cent = c; buildSliders(); updB(); frame(v, 4.6); };
    br.querySelector("[data-br]").appendChild(b);
  });
  buildSliders(); updB(); frame(v, 4.6);
  br.appendChild(h(`<p class="small muted">Синие шары — узлы в вершинах (каждый принадлежит 8 ячейкам, вклад ⅛), оранжевые — центрирующие узлы (в центре грани — ½, в центре ячейки — 1). Расстояние между точками с дробными координатами Δf: d² = Δfᵀ G Δf — метрический тензор работает в любой, даже косоугольной, ячейке.</p>`));

  // ---------- Миллер ----------
  const mi = h(`<section id="miller"><h2>Плоскости Миллера (hkl)</h2>
    <p>Семейство параллельных плоскостей решётки задают ${term("y12_miller", "индексами Миллера")} (hkl): берём отрезки, которые плоскость отсекает на осях в долях a, b, c, обращаем и приводим к целым. Плоскость (hkl) пересекает оси в точках a/h, b/k, c/l; уравнение семейства в дробных координатах: hx + ky + lz = n, n — целое. Отрицательный индекс пишут с чертой сверху: (<span style="text-decoration:overline">1</span>10).</p>
    <p>Межплоскостное расстояние в общем случае даёт обратный метрический тензор G* = G⁻¹: <b>1/d² = hᵀG*h</b>. Для кубической ячейки это превращается в знакомое d = a/√(h² + k² + l²).</p>
    <div class="chips" data-sys></div>
  </section>`);
  el.appendChild(mi);
  const st2 = stage(`<div class="overlay"><span data-a style="font-size:1rem"></span><span data-b></span></div>`, { wide: true });
  mi.appendChild(st2);
  const c2 = h(`<div class="card pad" style="margin-top:10px"><div class="three">
    <label class="ctl">h: <b data-h>1</b><input type="range" min="-3" max="3" value="1" data-i="0"></label>
    <label class="ctl">k: <b data-k>1</b><input type="range" min="-3" max="3" value="1" data-i="1"></label>
    <label class="ctl">l: <b data-l>1</b><input type="range" min="-3" max="3" value="1" data-i="2"></label></div>
    <div data-mat style="overflow-x:auto;margin-top:10px"></div><p data-out style="margin:6px 0 0"></p></div>`);
  mi.appendChild(c2);
  const v2 = createViewer(st2, { camera: [7, 5, 9], autoRotateSpeed: 0.4 });
  const mv = createMiller(v2);
  const MSYS = [["cubic", "кубическая a = 4"], ["tetragonal", "тетрагональная"], ["orthorhombic", "ромбическая"], ["hexagonal", "гексагональная"]];
  const MP = { cubic: { a: 4, b: 4, c: 4, al: 90, be: 90, ga: 90 }, tetragonal: { a: 3.2, b: 3.2, c: 4.8, al: 90, be: 90, ga: 90 }, orthorhombic: { a: 3, b: 3.8, c: 4.6, al: 90, be: 90, ga: 90 }, hexagonal: { a: 3.2, b: 3.2, c: 5.2, al: 90, be: 90, ga: 120 } };
  let msys = "cubic";
  let dCur = 4 / Math.sqrt(3);
  const updM = () => {
    const hkl = [0, 1, 2].map((i) => +c2.querySelector(`[data-i="${i}"]`).value);
    ["h", "k", "l"].forEach((n, i) => (c2.querySelector(`[data-${n}]`).textContent = String(hkl[i]).replace("-", "−")));
    const M = cellMatrix(MP[msys]);
    const cnt = mv.set(M, hkl);
    const G = matMul(transpose(M), M), Gs = inverse(G);
    c2.querySelector("[data-mat]").innerHTML = matRow(op("G* = G⁻¹ ="), matrixHTML(Gs, { fmt: (x) => num(x, 4) }));
    if (hkl.every((x) => x === 0)) {
      st2.querySelector("[data-a]").innerHTML = "<b>(000)</b>";
      st2.querySelector("[data-b]").textContent = "такой плоскости нет";
      c2.querySelector("[data-out]").textContent = "Хотя бы один индекс должен быть ненулевым.";
      return;
    }
    const q = hkl.reduce((s, x, i) => s + x * hkl.reduce((t, y, j) => t + Gs[i][j] * y, 0), 0);
    const d = 1 / Math.sqrt(q);
    dCur = d;
    const cub = msys === "cubic" ? ` = a/√(h²+k²+l²) = 4/√${hkl.reduce((s, x) => s + x * x, 0)}` : "";
    st2.querySelector("[data-a]").innerHTML = `<b>${hklStr(...hkl)}</b>`;
    st2.querySelector("[data-b]").textContent = `d = ${num(d, 3)} Å · плоскостей в ячейке: ${cnt}`;
    c2.querySelector("[data-out]").innerHTML = `1/d² = hᵀG*h = ${num(q, 4)} Å⁻² → <b>d${hklStr(...hkl)} = ${num(d, 3)} Å</b>${cub}. Жёлтая — плоскость hx + ky + lz = 1, голубые — остальные плоскости семейства внутри ячейки. Чем больше индексы, тем плотнее плоскости и меньше d. Это d подставлено в закон Брэгга ниже.`;
    bragg?.();
  };
  let bragg = null;
  c2.querySelectorAll("input").forEach((i) => (i.oninput = updM));
  MSYS.forEach(([k, n], i) => {
    const b = h(`<button class="chip${i ? "" : " on"}" type="button">${n}</button>`);
    b.onclick = () => { mi.querySelectorAll("[data-sys] .chip").forEach((x) => x.classList.toggle("on", x === b)); msys = k; updM(); frame(v2, 5.6); };
    mi.querySelector("[data-sys]").appendChild(b);
  });
  updM(); frame(v2, 5.6);

  // ---------- Брэгг ----------
  const bg = h(`<section id="bragg"><h2>Дифракция: закон Брэгга</h2>
    <p>Рентгеновские лучи с длиной волны λ ≈ 1 Å «отражаются» от каждой плоскости семейства. Лучи от соседних плоскостей проходят разный путь; разность хода равна 2d·sin θ. Если она кратна λ, волны складываются в фазе — возникает яркий рефлекс (У. Г. и У. Л. Брэгги, 1913):</p>
    <div class="eq">nλ = 2d·sin θ</div>
    <div class="card pad">
      <div class="chips" data-lam></div>
      <div class="two" style="margin-top:10px"><label class="ctl">Угол θ: <b data-t></b><input type="range" min="3" max="87" step="0.1" value="20" data-ts></label>
      <label class="ctl">d (из раздела Миллера, можно менять): <b data-d></b><input type="range" min="0.8" max="5" step="0.01" data-ds></label></div>
      <div class="two" style="margin-top:10px"><svg class="plot" viewBox="0 0 400 260" data-ray></svg><svg class="plot" viewBox="0 0 400 260" data-int></svg></div>
      <p data-out style="margin:10px 0 0"></p>
    </div>
  </section>`);
  el.appendChild(bg);
  let lamV = LAMBDA[0][1];
  const ts = bg.querySelector("[data-ts]"), ds = bg.querySelector("[data-ds]");
  const NPL = 20;
  const I = (th, d) => { const ph = (2 * Math.PI * 2 * d * Math.sin((th * Math.PI) / 180)) / lamV; const s = Math.sin(ph / 2); return Math.abs(s) < 1e-6 ? 1 : (Math.sin((NPL * ph) / 2) / (NPL * s)) ** 2; };
  const updG = () => {
    const th = +ts.value, d = +ds.value, t = (th * Math.PI) / 180;
    bg.querySelector("[data-t]").textContent = `${num(th, 1)}°`;
    bg.querySelector("[data-d]").textContent = `${num(d, 3)} Å`;
    // лучи
    const gap = 46, y0 = 120, cx = 200, L = 150;
    let s = "";
    for (let p = 0; p < 3; p++) for (let x = 30; x <= 370; x += 28) s += `<circle cx="${x}" cy="${y0 + p * gap}" r="5" fill="var(--text-3)"/>`;
    for (let p = 0; p < 3; p++) s += `<line x1="20" x2="380" y1="${y0 + p * gap}" y2="${y0 + p * gap}" stroke="var(--line-2)"/>`;
    const ray = (yy, col) => `<path d="M${cx - L * Math.cos(t)},${yy - L * Math.sin(t)} L${cx},${yy} L${cx + L * Math.cos(t)},${yy - L * Math.sin(t)}" fill="none" stroke="${col}" stroke-width="2.5"/>`;
    s += ray(y0, "#4fb3ff") + ray(y0 + gap, "#ff8a5c");
    // лишний путь: от перпендикуляров к лучам до точки отражения на 2-й плоскости
    const px = cx - gap * Math.sin(t) * Math.cos(t), py = y0 + gap - gap * Math.sin(t) * Math.sin(t);
    const qx = cx + gap * Math.sin(t) * Math.cos(t);
    s += `<line x1="${cx}" y1="${y0}" x2="${px}" y2="${py}" stroke="var(--text-2)" stroke-dasharray="3 3"/><line x1="${cx}" y1="${y0}" x2="${qx}" y2="${py}" stroke="var(--text-2)" stroke-dasharray="3 3"/>
      <path d="M${px},${py} L${cx},${y0 + gap} L${qx},${py}" fill="none" stroke="#ffb02e" stroke-width="5" opacity=".8"/>
      <text x="${cx + 8}" y="${y0 + gap - 6}" font-size="12" fill="#ffb02e">2d·sin θ</text>
      <line x1="${cx - 60}" x2="${cx - 60}" y1="${y0}" y2="${y0 + gap}" stroke="var(--text-2)"/><text x="${cx - 74}" y="${y0 + gap / 2 + 4}" font-size="12" fill="var(--text-2)">d</text>
      <text x="14" y="22" font-size="13" fill="var(--text-2)">θ = ${num(th, 1)}°</text>`;
    bg.querySelector("[data-ray]").innerHTML = s;
    // интенсивность от угла
    let path = "";
    for (let i = 0; i <= 600; i++) { const a = 3 + (84 * i) / 600; path += `${i ? "L" : "M"}${(20 + ((a - 3) / 84) * 360).toFixed(1)},${(225 - I(a, d) * 190).toFixed(1)}`; }
    const mx = 20 + ((th - 3) / 84) * 360;
    let marks = "";
    for (let n = 1; n * lamV / (2 * d) <= 1; n++) { const a = (Math.asin((n * lamV) / (2 * d)) * 180) / Math.PI; if (a >= 3) marks += `<text x="${20 + ((a - 3) / 84) * 360}" y="30" text-anchor="middle" font-size="11" fill="var(--text-2)">n=${n}</text>`; }
    bg.querySelector("[data-int]").innerHTML = `<line x1="20" x2="380" y1="225" y2="225" stroke="var(--line-2)"/><path d="${path}" fill="none" stroke="#4fb3ff" stroke-width="1.6"/>${marks}
      <line x1="${mx}" x2="${mx}" y1="20" y2="230" stroke="#ffb02e" stroke-width="2"/><text x="20" y="250" font-size="11" fill="var(--text-3)">3°</text><text x="380" y="250" text-anchor="end" font-size="11" fill="var(--text-3)">θ → 87°</text><text x="200" y="250" text-anchor="middle" font-size="11" fill="var(--text-3)">интенсивность от ${NPL} плоскостей</text>`;
    const n = (2 * d * Math.sin(t)) / lamV;
    const list = [];
    for (let k = 1; k * lamV / (2 * d) <= 1; k++) list.push(`n = ${k}: θ = ${num((Math.asin((k * lamV) / (2 * d)) * 180) / Math.PI, 2)}°`);
    bg.querySelector("[data-out]").innerHTML = `2d·sin θ / λ = <b>${num(n, 3)}</b> ${Math.abs(n - Math.round(n)) < 0.03 && Math.round(n) > 0 ? `<b style="color:var(--good)">— целое: рефлекс ${Math.round(n)}-го порядка!</b>` : "— не целое: волны гасят друг друга"}. Брэгговские углы: ${list.join("; ") || "нет (λ > 2d)"}.`;
  };
  LAMBDA.forEach(([n, l], i) => {
    const b = h(`<button class="chip${i ? "" : " on"}" type="button">${n} λ = ${num(l, 4)} Å</button>`);
    b.onclick = () => { bg.querySelectorAll("[data-lam] .chip").forEach((x) => x.classList.toggle("on", x === b)); lamV = l; updG(); };
    bg.querySelector("[data-lam]").appendChild(b);
  });
  ts.oninput = updG; ds.oninput = updG;
  bragg = () => { ds.value = Math.min(5, Math.max(0.8, dCur)); updG(); };
  bragg();

  // ---------- Порошковая дифрактограмма ----------
  const pw = h(`<section id="powder"><h2>Порошковая дифрактограмма кубического кристалла</h2>
    <p>В порошке есть кристаллики всех ориентаций, и каждое семейство (hkl) даёт кольцо под углом 2θ. Но не все рефлексы видны: в центрированной ячейке волны от узлов в вершинах и в центрах гасят друг друга (систематические погасания). Структурный фактор даёт правила: ОЦК (I) — видны только h + k + l чётные; ГЦК (F) — h, k, l все чётные или все нечётные.</p>
    <div class="card pad"><div class="chips" data-pt></div>
    <label class="ctl" style="margin-top:10px">Параметр ячейки a: <b data-a></b><input type="range" min="2.5" max="6" step="0.01" value="4.05" data-as></label>
    <svg class="plot" viewBox="0 0 700 200" style="margin-top:10px" data-pp></svg><p class="small" data-out style="margin:8px 0 0"></p></div>
  </section>`);
  el.appendChild(pw);
  let ptype = "F";
  const PT = [["P", "ПК (Po)", 3.35], ["I", "ОЦК (Fe, a = 2,87)", 2.87], ["F", "ГЦК (Al, a = 4,05)", 4.05]];
  const updP = () => {
    const a = +pw.querySelector("[data-as]").value;
    pw.querySelector("[data-a]").textContent = `${num(a, 2)} Å`;
    const refl = new Map();
    for (let h_ = 0; h_ <= 6; h_++) for (let k = 0; k <= h_; k++) for (let l = 0; l <= k; l++) {
      const s = h_ * h_ + k * k + l * l;
      if (!s || refl.has(s)) continue;
      const ok = ptype === "P" || (ptype === "I" ? (h_ + k + l) % 2 === 0 : [h_, k, l].every((x) => x % 2 === 0) || [h_, k, l].every((x) => x % 2 === 1));
      if (!ok) continue;
      const sn = (1.5406 * Math.sqrt(s)) / (2 * a);
      if (sn >= 1) continue;
      const tt = (2 * Math.asin(sn) * 180) / Math.PI;
      if (tt <= 120) refl.set(s, { hkl: `${h_}${k}${l}`, tt, d: a / Math.sqrt(s) });
    }
    const X = (tt) => 20 + ((tt - 10) / 110) * 660;
    const list = [...refl.values()].sort((p, q) => p.tt - q.tt);
    let s = `<line x1="20" x2="680" y1="160" y2="160" stroke="var(--line-2)"/>`;
    list.forEach((r, i) => {
      const hgt = 120 / (1 + i * 0.25);
      s += `<line x1="${X(r.tt)}" x2="${X(r.tt)}" y1="160" y2="${160 - hgt}" stroke="#4fb3ff" stroke-width="3"/><text x="${X(r.tt)}" y="${150 - hgt}" text-anchor="middle" font-size="11" fill="var(--text)">${r.hkl}</text>`;
    });
    for (let tt = 20; tt <= 120; tt += 20) s += `<text x="${X(tt)}" y="178" text-anchor="middle" font-size="11" fill="var(--text-3)">${tt}°</text>`;
    s += `<text x="680" y="195" text-anchor="end" font-size="11" fill="var(--text-3)">2θ, Cu Kα</text>`;
    pw.querySelector("[data-pp]").innerHTML = s;
    pw.querySelector("[data-out]").innerHTML = `Видимые рефлексы: ${list.slice(0, 7).map((r) => `(${r.hkl}) 2θ = ${num(r.tt, 2)}°`).join("; ")}. Последовательность h² + k² + l²: ${list.map((r) => Math.round((a / r.d) ** 2)).slice(0, 8).join(", ")} — по ней и определяют тип решётки. Высоты условные.`;
  };
  PT.forEach(([k, n, a], i) => {
    const b = h(`<button class="chip${i === 2 ? " on" : ""}" type="button">${n}</button>`);
    b.onclick = () => { pw.querySelectorAll("[data-pt] .chip").forEach((x) => x.classList.toggle("on", x === b)); ptype = k; pw.querySelector("[data-as]").value = a; updP(); };
    pw.querySelector("[data-pt]").appendChild(b);
  });
  pw.querySelector("[data-as]").oninput = updP;
  updP();

  // ---------- Упаковка ----------
  const pk = h(`<section id="packing"><h2>Плотность упаковки ПК, ОЦК, ГЦК</h2>
    <p>Пусть атомы — касающиеся шары радиуса r. ${term("y12_packing", "Коэффициент упаковки")} — доля объёма ячейки, занятая шарами: η = Z·(4/3)πr³ / a³. Шары касаются вдоль ребра (ПК: a = 2r), диагонали куба (ОЦК: a√3 = 4r) или диагонали грани (ГЦК: a√2 = 4r). Ниже шары обрезаны гранями ячейки — видно, какая доля каждого атома ей принадлежит.</p>
    <div class="chips" data-pk></div>
  </section>`);
  el.appendChild(pk);
  const st3 = stage(`<div class="overlay"><span data-a style="font-size:.95rem"></span><span data-b></span></div>`);
  pk.appendChild(st3);
  const v3 = createViewer(st3, { camera: [5.5, 4.5, 7], clipping: true, autoRotateSpeed: 0.6 });
  const pack = createPacking(v3);
  const PK = { sc: ["ПК", 1, "a = 2r", "8 × ⅛ = 1", 6], bcc: ["ОЦК", 2, "a√3 = 4r", "8 × ⅛ + 1 = 2", 8], fcc: ["ГЦК", 4, "a√2 = 4r", "8 × ⅛ + 6 × ½ = 4", 12] };
  Object.entries(PK).forEach(([k, d], i) => {
    const b = h(`<button class="chip${i === 2 ? " on" : ""}" type="button">${d[0]}</button>`);
    b.onclick = () => { pk.querySelectorAll("[data-pk] .chip").forEach((x) => x.classList.toggle("on", x === b)); setPk(k); };
    pk.querySelector("[data-pk]").appendChild(b);
  });
  const setPk = (k) => {
    const ra = pack.set(k), d = PK[k];
    const eta = (d[1] * 4 / 3) * Math.PI * ra ** 3;
    st3.querySelector("[data-a]").innerHTML = `<b>${d[0]}</b>: ${d[2]}, Z = ${d[3]}`;
    st3.querySelector("[data-b]").innerHTML = `η = <b>${num(eta * 100, 1)} %</b> · КЧ ${d[4]}`;
  };
  setPk("fcc"); frame(v3, 3.2);
  pk.appendChild(h(`<div class="callout"><b>Пример.</b> Медь (ГЦК, a = 3,615 Å, M = 63,55 г/моль). Плотность ρ = Z·M/(N<sub>A</sub>·V) = 4·63,55 / (6,022·10²³ · 3,615³·10⁻²⁴ см³) = <b>8,93 г/см³</b> — совпадает с измеренной. Радиус атома r = a√2/4 = 1,278 Å. ГЦК и гексагональная плотнейшая упаковка дают максимально возможные 74,05 % (гипотеза Кеплера, доказана Т. Хейлсом в 1998 г.).</div>`));
}

export const quiz = [
  { q: "Сколько существует решёток Браве?", options: ["7", "14", "32", "230"], answer: 1, why: "7 сингоний × допустимые типы центрирования = 14. (32 — точечные группы, 230 — пространственные.)" },
  { q: "Объём ячейки через метрический тензор G:", options: ["V = det G", "V = √det G", "V = tr G", "V = 1/det G"], answer: 1, why: "G = MᵀM, det G = (det M)², а det M — объём параллелепипеда." },
  { q: "Межплоскостное расстояние d(110) кубической ячейки с a = 4 Å:", options: ["4 Å", "2 Å", "2,83 Å", "5,66 Å"], answer: 2, why: "d = a/√(1 + 1 + 0) = 4/√2 ≈ 2,83 Å." },
  { q: "Как изменится брэгговский угол для той же плоскости, если взять Mo Kα (0,71 Å) вместо Cu Kα (1,54 Å)?", options: ["Увеличится", "Уменьшится", "Не изменится", "Станет 90°"], answer: 1, why: "sin θ = nλ/(2d): меньше λ — меньше угол." },
  { q: "Какой рефлекс запрещён для ГЦК-решётки?", options: ["(111)", "(200)", "(100)", "(220)"], answer: 2, why: "В ГЦК h, k, l должны быть одной чётности; у (100) смешанная." },
  { q: "Коэффициент упаковки ОЦК-решётки:", options: ["52 %", "68 %", "74 %", "100 %"], answer: 1, why: "η = 2·(4/3)π(√3a/4)³/a³ = π√3/8 ≈ 0,68." },
];
