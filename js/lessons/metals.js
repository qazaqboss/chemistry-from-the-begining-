import { h, kid, term, stage, chips, figureFrame } from "../ui.js";
import { createViewer, THREE, easeInOut } from "../three/core.js";
import { makeKit, beaker, rng, seg, lerpV, COLORS } from "../three/y89-common.js";
import { pretty } from "../chem.js";

// Электрохимический ряд активности (упрощённый школьный)
const SERIES = ["Li", "K", "Ba", "Ca", "Na", "Mg", "Al", "Zn", "Cr", "Fe", "Ni", "Sn", "Pb", "H₂", "Cu", "Hg", "Ag", "Pt", "Au"];
const METALS = {
  Mg: { q: 2, name: "магний", color: 0xc9ccd2 }, Zn: { q: 2, name: "цинк", color: 0x9fa6b8 }, Fe: { q: 2, name: "железо", color: 0x8a8f99 },
  Pb: { q: 2, name: "свинец", color: 0x6a6f7c }, Cu: { q: 2, name: "медь", color: 0xc8743a }, Ag: { q: 1, name: "серебро", color: 0xe4e6ea },
};
const SOLS = [
  { id: "ZnSO4", m: "Zn", a: "SO4", aq: 2, tint: 0xdfe8f2 }, { id: "FeSO4", m: "Fe", a: "SO4", aq: 2, tint: 0xb9e3b0 },
  { id: "Pb(NO3)2", m: "Pb", a: "NO3", aq: 1, tint: 0xdfe8f2 }, { id: "CuSO4", m: "Cu", a: "SO4", aq: 2, tint: 0x3d8cff },
  { id: "AgNO3", m: "Ag", a: "NO3", aq: 1, tint: 0xdfe8f2 }, { id: "HCl", m: "H", a: "Cl", aq: 1, tint: 0xdfe8f2 },
];
const SALT_TINT = { Mg: 0xdfe8f2, Zn: 0xdfe8f2, Fe: 0xb9e3b0, Pb: 0xdfe8f2, Cu: 0x3d8cff, Ag: 0xdfe8f2 };
const POLY = { SO4: 1, NO3: 1, Cl: 0 };
const gcd = (a, b) => (b ? gcd(b, a % b) : a);
const salt = (M, q, A, aq) => {
  const L = (q * aq) / gcd(q, aq), p = L / q, n = L / aq;
  return { f: `${M}${p > 1 ? p : ""}${n > 1 ? (POLY[A] ? `(${A})${n}` : `${A}${n}`) : A}`, p, n };
};
const coef = (k) => (k === 1 ? "" : k);

export function displacement(M, S) {
  const iM = SERIES.indexOf(M), iN = SERIES.indexOf(S.m === "H" ? "H₂" : S.m);
  if (M === S.m) return { go: false, text: "Металл в растворе собственной соли — обмениваться не с кем." };
  if (iM > iN) return { go: false, text: `${METALS[M].name[0].toUpperCase() + METALS[M].name.slice(1)} стоит в ряду активности <b>правее</b> ${S.m === "H" ? "водорода" : S.m} — он менее активен и не может отдать электроны ионам ${S.m === "H" ? "H⁺" : S.m + (S.m === "Ag" ? "⁺" : "²⁺")}. Реакция не идёт.` };
  const q = METALS[M].q, nq = S.m === "H" ? 1 : METALS[S.m].q;
  const A = salt(M, q, S.a, S.aq);
  const B = S.m === "H" ? { f: "HCl", p: 1, n: 1 } : salt(S.m, nq, S.a, S.aq);
  let k = null;
  for (let a = 1; a <= 6 && !k; a++) for (let b = 1; b <= 6 && !k; b++) for (let c = 1; c <= 6 && !k; c++) for (let d = 1; d <= 6 && !k; d++) {
    const dN = S.m === "H" ? 2 * d : d;
    if (a === c * A.p && b * B.p === dN && b * B.n === c * A.n) k = [a, b, c, d];
  }
  const [a, b, c, d] = k;
  const prod = S.m === "H" ? `${coef(d)}H₂↑` : `${coef(d)}${S.m}↓`;
  let note = "";
  if (M === "Pb" && (S.a === "Cl" || S.a === "SO4")) note = ` <span class="muted">Но на практике реакция быстро останавливается: малорастворимый ${S.a === "Cl" ? "PbCl₂" : "PbSO₄"} покрывает свинец плёнкой.</span>`;
  const eM = `${M}⁰ − ${q}e⁻ → ${M}${q === 1 ? "⁺" : "²⁺"}`;
  const eN = S.m === "H" ? "2H⁺ + 2e⁻ → H₂⁰" : `${S.m}${nq === 1 ? "⁺" : "²⁺"} + ${nq}e⁻ → ${S.m}⁰`;
  return {
    go: true, q, nq, gas: S.m === "H",
    eq: `${coef(a)}${M} + ${coef(b)}${pretty(B.f)} → ${coef(c)}${pretty(A.f)} + ${prod}`,
    text: `${METALS[M].name[0].toUpperCase() + METALS[M].name.slice(1)} активнее ${S.m === "H" ? "водорода" : S.m}: он отдаёт электроны и переходит в раствор, а ${S.m === "H" ? "ионы H⁺ превращаются в пузырьки водорода" : `на его поверхности оседает ${METALS[S.m].name}`}.${note}`,
    ox: `${eM} (восстановитель, окисляется) · ${eN} (окислитель)`,
  };
}

export async function render(el) {
  el.appendChild(h(`<div>
    <p class="lead">Из 118 элементов больше 90 — металлы. Их объединяет особый тип связи: положительные ионы в узлах решётки и «общие» электроны, свободно гуляющие по всему куску металла. Отсюда блеск, ковкость, электро- и теплопроводность — и главное химическое свойство: металлы <b>отдают электроны</b>, то есть являются восстановителями.</p>
    ${kid("Представь металл как ящик с апельсинами (ионы), залитый газировкой из электронов. Электроны-пузырьки свободно бегают между апельсинами и склеивают их. Если нажать на ящик, апельсины сдвинутся, но не рассыплются — поэтому металл можно согнуть или расплющить, а стекло — нет.")}
  </div>`));

  // ---------- 3D: металлическая решётка ----------
  const s1 = h(`<section id="bond"><h2>Металлическая связь и «электронный газ»</h2>
    <p>${term("metallic", "Металлическая связь")} — связь между положительными ионами металла посредством обобществлённых валентных электронов (${term("egas", "электронного газа")}). Включи напряжение: электроны начнут дрейфовать вдоль проводника — это и есть ток. Нагрей металл: ионы сильнее колеблются, мешают электронам, и сопротивление растёт. Сдвинь слой — связь не рвётся, металл пластичен.</p></section>`);
  el.appendChild(s1);
  const st1 = stage(`<div class="overlay"><span><b style="font-size:1rem">Кристалл металла</b><br><span data-st></span></span><span style="text-align:right"><span style="color:#9aa3b5">●</span> ионы Me⁺ &nbsp;<span style="color:#5ab0ff">●</span> e⁻</span></div>`, { wide: true });
  s1.appendChild(st1);
  const c1 = h(`<div class="card pad" style="margin-top:10px">
    <div class="row"><button class="chip" type="button" data-v>⚡ Подать напряжение</button><button class="chip" type="button" data-sh>↔ Сдвинуть слой</button></div>
    <label class="ctl" style="margin-top:10px">Температура: <b data-tv></b><input type="range" min="0" max="1" step="0.01" value="0.25"></label>
  </div>`);
  s1.appendChild(c1);
  buildMetal(createViewer(st1, { camera: [0, 5, 17], fitWidth: 7.5, autoRotateSpeed: 0.3, minDistance: 6, maxDistance: 40 }), st1, c1);
  s1.appendChild(h(`<div class="table-wrap"><table class="data">
    <tr><th>Свойство</th><th>Объяснение</th><th>Рекордсмены</th></tr>
    <tr><td>электро- и теплопроводность</td><td>свободные электроны переносят заряд и энергию</td><td>Ag, Cu, Au, Al</td></tr>
    <tr><td>пластичность, ковкость</td><td>слои ионов скользят, электронный газ их удерживает</td><td>Au (лист толщиной 0,1 мкм)</td></tr>
    <tr><td>металлический блеск</td><td>электроны отражают свет</td><td>Ag, Pd, Al — зеркала</td></tr>
    <tr><td>температура плавления</td><td>зависит от прочности связи</td><td>W 3422 °C; Hg −39 °C</td></tr>
    <tr><td>плотность</td><td>лёгкие (&lt; 5 г/см³) и тяжёлые</td><td>Li 0,53; Os 22,6 г/см³</td></tr>
  </table></div>`));

  // ---------- ряд активности ----------
  const s2 = h(`<section id="series"><h2>Ряд активности: идёт ли реакция?</h2>
    <p>Металлы выстроены по способности отдавать электроны в водном растворе (${term("actseries", "электрохимический ряд напряжений")}, Н. Н. Бекетов, 1865):</p>
    <div class="ser" data-ser></div>
    <ul>
      <li>Металлы <b>левее водорода</b> вытесняют его из растворов кислот (кроме HNO₃ и конц. H₂SO₄): Zn + 2HCl → ZnCl₂ + H₂↑.</li>
      <li>Каждый металл вытесняет <b>правее стоящие</b> металлы из растворов их солей: Fe + CuSO₄ → FeSO₄ + Cu.</li>
      <li>Щелочные и щёлочноземельные металлы (Li…Na) в растворах солей реагируют прежде всего <b>с водой</b>, поэтому для вытеснения их не используют.</li>
    </ul>
    <p>Опусти пластинку металла в раствор и посмотри, что получится:</p>
    <div class="card pad"><div class="row"><span class="small muted">Металл:</span><span data-m></span></div><div class="row" style="margin-top:8px"><span class="small muted">Раствор:</span><span data-s></span></div></div>
  </section>`);
  el.appendChild(s2);
  s2.appendChild(h(`<style>.ser{display:flex;flex-wrap:wrap;gap:4px;margin:10px 0}.ser span{padding:4px 7px;border-radius:8px;background:var(--surface-2);border:1px solid var(--line);font-weight:700;font-size:.85rem;font-family:var(--mono)}.ser span.h{border-style:dashed}.ser span.m{background:var(--accent);color:#fff;border-color:var(--accent)}.ser span.n{outline:2px solid var(--accent-2);outline-offset:1px}</style>`));
  const st2 = stage(`<div class="overlay"><span><b data-t style="font-size:1rem"></b><br><span data-ph></span></span><span data-res style="text-align:right;font-weight:700"></span></div>`, { wide: true });
  st2.style.marginTop = "10px";
  s2.appendChild(st2);
  const c2 = h(`<div class="card pad" style="margin-top:10px"><div class="row"><button class="btn primary" type="button" data-play>▶ Опустить пластинку</button><input type="range" min="0" max="1" step="0.001" value="0" style="flex:1;min-width:140px" aria-label="Ход реакции"></div><div data-out style="margin-top:10px"></div></div>`);
  s2.appendChild(c2);
  const cell = buildCell(createViewer(st2, { camera: [0, 3, 17], fitWidth: 6.5, autoRotate: false, minDistance: 7, maxDistance: 40 }), st2, c2);
  let M = "Zn", S = SOLS[3];
  const upd = () => {
    const r = displacement(M, S);
    s2.querySelector("[data-ser]").innerHTML = SERIES.map((x) => `<span class="${x === "H₂" ? "h" : ""} ${x === M ? "m" : ""} ${(S.m === "H" ? "H₂" : S.m) === x ? "n" : ""}">${x}</span>`).join("");
    c2.querySelector("[data-out]").innerHTML = r.go
      ? `<p class="mt0">${r.text}</p><div class="eq">${r.eq}</div><p class="small muted" style="margin:0">${r.ox}</p>`
      : `<p class="mt0">${r.text}</p>`;
    st2.querySelector("[data-t]").innerHTML = `${M} в растворе ${pretty(S.id)}`;
    cell.load(M, S, r);
  };
  chips(s2.querySelector("[data-m]"), Object.keys(METALS).map((k) => ({ k, label: k })), (it) => { M = it.k; upd(); }, 1);
  chips(s2.querySelector("[data-s]"), SOLS.map((s) => ({ ...s, label: pretty(s.id) })), (it) => { S = it; upd(); }, 3);
  upd();

  // ---------- гальванический элемент ----------
  const s3 = h(`<section id="galvanic"><h2>Гальванический элемент</h2>
    <p>Если разделить окислитель и восстановитель и соединить их проводом, электроны пойдут по проводу — получится источник тока, ${term("galvanic", "гальванический элемент")}. В элементе Даниэля — Якоби цинковая пластинка стоит в растворе ZnSO₄, медная — в CuSO₄, растворы соединены солевым мостиком.</p>
    <div class="grid-2">
      <div class="card pad"><b>Анод (−), цинк</b><p class="formula small" style="margin:6px 0 0">Zn⁰ − 2e⁻ → Zn²⁺</p><p class="small muted" style="margin:4px 0 0">окисление: пластинка растворяется</p></div>
      <div class="card pad"><b>Катод (+), медь</b><p class="formula small" style="margin:6px 0 0">Cu²⁺ + 2e⁻ → Cu⁰</p><p class="small muted" style="margin:4px 0 0">восстановление: медь оседает</p></div>
    </div>
    <div class="eq">Zn + Cu²⁺ → Zn²⁺ + Cu &nbsp;&nbsp; ЭДС ≈ 0,76 + 0,34 = 1,10 В</div>
    <p>Чем дальше друг от друга металлы в ряду активности, тем больше напряжение элемента. Батарейки, аккумуляторы телефонов и автомобилей работают по тому же принципу.</p>
  </section>`);
  el.appendChild(s3);
  const fig = h(`<figure class="figure" style="margin:16px 0"></figure>`);
  fig.appendChild(figureFrame("figures/galvanic", "Гальванический элемент Даниэля — Якоби"));
  fig.appendChild(h(`<figcaption>Элемент Даниэля — Якоби (навык Anatomy): электроны идут по внешней цепи от цинка к меди, ионы — через солевой мостик. Обратный процесс — электролиз — в уроке <a href="#lesson-redox">«ОВР и электролиз»</a>.</figcaption>`));
  s3.appendChild(fig);

  el.appendChild(h(`<section id="corrosion"><h2>Коррозия и защита</h2>
    <p>${term("corrosion", "Коррозия")} — самопроизвольное разрушение металлов под действием окружающей среды. Ржавление железа — это ОВР с участием кислорода и воды:</p>
    <div class="eq">4Fe + 3O₂ + 6H₂O → 4Fe(OH)₃ &nbsp;(→ ржавчина Fe₂O₃·nH₂O)</div>
    <p>Особенно быстро идёт <b>электрохимическая коррозия</b>: когда два металла соприкасаются в растворе электролита (морская вода, соль на дорогах), возникает микро-гальванический элемент, и разрушается <b>более активный</b> металл.</p>
    <div class="table-wrap"><table class="data">
      <tr><th>Способ защиты</th><th>Как работает</th></tr>
      <tr><td>оцинковка (Zn на Fe)</td><td>Zn активнее Fe: даже при царапине корродирует цинк, железо цело (протекторная защита)</td></tr>
      <tr><td>лужение (Sn на Fe, консервные банки)</td><td>Sn менее активен: пока покрытие цело — защищает, но при царапине железо ржавеет <b>быстрее</b></td></tr>
      <tr><td>протектор</td><td>к корпусу корабля или трубе крепят пластины Zn или Mg — они растворяются вместо стали</td></tr>
      <tr><td>краска, эмаль, смазка</td><td>изолируют металл от воды и кислорода</td></tr>
      <tr><td>нержавеющая сталь</td><td>добавка ≥ 12% Cr даёт плотную оксидную плёнку (${term("passivation", "пассивация")})</td></tr>
    </table></div>
    <div class="callout"><b>Важно:</b> алюминий активнее железа, но почти не ржавеет — его защищает тончайшая плёнка Al₂O₃. Если её снять (например, ртутью), алюминий бурно реагирует с водой.</div>
  </section>`));

  el.appendChild(h(`<section id="alloys"><h2>Сплавы и получение металлов</h2>
    <p>Чистые металлы часто мягки. ${term("alloy", "Сплавы")} — однородные смеси металла с другими металлами или неметаллами — бывают твёрже, прочнее и устойчивее к коррозии. Атомы добавки искажают решётку и мешают слоям скользить.</p>
    <div class="table-wrap"><table class="data">
      <tr><th>Сплав</th><th>Состав</th><th>Применение</th></tr>
      <tr><td>сталь</td><td>Fe + C (до 2,14%)</td><td>конструкции, инструменты</td></tr>
      <tr><td>чугун</td><td>Fe + C (2,14–6,67%)</td><td>литьё: батареи, станины, сковороды</td></tr>
      <tr><td>нержавеющая сталь</td><td>Fe + Cr 18% + Ni 10%</td><td>посуда, медицина</td></tr>
      <tr><td>бронза</td><td>Cu + Sn</td><td>колокола, скульптуры, подшипники</td></tr>
      <tr><td>латунь</td><td>Cu + Zn</td><td>трубы, музыкальные инструменты</td></tr>
      <tr><td>дюралюминий</td><td>Al + Cu, Mg, Mn</td><td>самолёты: лёгкий и прочный</td></tr>
      <tr><td>припой</td><td>Sn + Pb (или Sn + Ag + Cu)</td><td>пайка: плавится ниже 200 °C</td></tr>
      <tr><td>золото 585 пробы</td><td>Au 58,5% + Ag, Cu</td><td>ювелирные изделия</td></tr>
    </table></div>
    <p><b>Металлургия</b> — получение металлов восстановлением из руд: <span class="formula">Fe₂O₃ + 3CO → 2Fe + 3CO₂</span> (доменная печь), <span class="formula">Cr₂O₃ + 2Al → 2Cr + Al₂O₃</span> (алюмотермия), <span class="formula">CuO + H₂ → Cu + H₂O</span>. Самые активные металлы (Na, K, Ca, Mg, Al) получают электролизом расплавов.</p>
    <div class="card pad"><p class="mt0"><b>Задача.</b> Железную пластинку массой 10 г опустили в раствор CuSO₄. Через время её масса стала 10,4 г. Сколько меди осело?</p>
      <p class="small" style="margin:0">Fe + CuSO₄ → FeSO₄ + Cu: на каждый моль растворившегося Fe (56 г) оседает моль Cu (64 г) — масса растёт на 8 г. Прирост 0,4 г → 0,4 / 8 = 0,05 моль; m(Cu) = 0,05 · 64 = <b>3,2 г</b>.</p></div>
  </section>`));
}

// ---------- 3D: решётка + электроны ----------
function buildMetal(v, st, ctl) {
  const kit = makeKit();
  const root = new THREE.Group();
  v.scene.add(root);
  const NX = 7, NY = 4, NZ = 3, a = 1.55;
  const ionMat = kit.mat(0x9aa3b5, { metalness: 0.6, roughness: 0.3 });
  const ions = [];
  for (let x = 0; x < NX; x++) for (let y = 0; y < NY; y++) for (let z = 0; z < NZ; z++) {
    const m = new THREE.Mesh(kit.geo(0.47), ionMat);
    const p = new THREE.Vector3((x - (NX - 1) / 2) * a, (y - (NY - 1) / 2) * a, (z - (NZ - 1) / 2) * a);
    m.position.copy(p);
    root.add(m);
    ions.push({ m, p, top: y >= NY / 2, ph: Math.random() * 6.28 });
  }
  const eMat = new THREE.MeshBasicMaterial({ color: 0x5ab0ff });
  const half = new THREE.Vector3((NX * a) / 2, (NY * a) / 2, (NZ * a) / 2);
  const R = rng(9);
  const els = Array.from({ length: 70 }, () => {
    const m = new THREE.Mesh(kit.geo(0.14), eMat);
    root.add(m);
    return { m, p: new THREE.Vector3((R() - 0.5) * 2 * half.x, (R() - 0.5) * 2 * half.y, (R() - 0.5) * 2 * half.z), v: new THREE.Vector3(R() - 0.5, R() - 0.5, R() - 0.5).normalize().multiplyScalar(3) };
  });
  let volt = false, shiftTarget = 0, shift = 0, temp = 0.25;
  const range = ctl.querySelector("input");
  const info = () => {
    ctl.querySelector("[data-tv]").textContent = temp < 0.2 ? "холодно" : temp < 0.6 ? "комнатная" : "раскалён";
    st.querySelector("[data-st]").textContent = volt ? (temp > 0.6 ? "ток идёт, но сопротивление высокое" : "электроны дрейфуют → ток") : "электроны движутся хаотично, тока нет";
  };
  ctl.querySelector("[data-v]").onclick = (e) => { volt = !volt; e.currentTarget.classList.toggle("on", volt); info(); };
  ctl.querySelector("[data-sh]").onclick = (e) => { shiftTarget = shiftTarget ? 0 : a; e.currentTarget.classList.toggle("on", !!shiftTarget); };
  range.oninput = () => { temp = +range.value; info(); };
  info();
  v.onFrame((dt, t) => {
    shift += (shiftTarget - shift) * Math.min(1, dt * 2.5);
    const amp = 0.04 + temp * 0.22;
    for (const i of ions) {
      i.m.position.set(i.p.x + (i.top ? shift : 0) + Math.sin(t * 9 + i.ph) * amp, i.p.y + Math.cos(t * 8 + i.ph * 2) * amp, i.p.z + Math.sin(t * 7 + i.ph * 3) * amp);
    }
    for (const e of els) {
      e.v.x += (Math.random() - 0.5) * 30 * dt * (1 + temp * 2);
      e.v.y += (Math.random() - 0.5) * 30 * dt * (1 + temp * 2);
      e.v.z += (Math.random() - 0.5) * 30 * dt * (1 + temp * 2);
      e.v.clampLength(0, 4);
      const drift = volt ? 2.2 * (1 - temp * 0.6) : 0;
      e.p.x += (e.v.x + drift) * dt; e.p.y += e.v.y * dt; e.p.z += e.v.z * dt;
      if (e.p.x > half.x) e.p.x = volt ? -half.x : (e.v.x = -Math.abs(e.v.x), half.x);
      if (e.p.x < -half.x) e.p.x = volt ? half.x : (e.v.x = Math.abs(e.v.x), -half.x);
      for (const k of ["y", "z"]) {
        if (e.p[k] > half[k]) { e.p[k] = half[k]; e.v[k] = -Math.abs(e.v[k]); }
        if (e.p[k] < -half[k]) { e.p[k] = -half[k]; e.v[k] = Math.abs(e.v[k]); }
      }
      e.m.position.copy(e.p);
    }
  });
}

// ---------- 3D: пластинка в растворе ----------
function buildCell(v, st, ctl) {
  const kit = makeKit();
  const root = new THREE.Group();
  v.scene.add(root);
  root.position.y = -0.5;
  const bk = beaker(4.6, 7, 0.8);
  root.add(bk);
  const liquid = bk.userData.liquid;
  liquid.material.opacity = 0.3;
  const range = ctl.querySelector("input");
  let t = 0, playing = false, time = 0, plate = null, atoms = [], ions = [], bubbles = [], res = null, tint0 = new THREE.Color(), tint1 = new THREE.Color();
  const dynamic = new THREE.Group();
  root.add(dynamic);
  function load(M, S, r) {
    v.clear(dynamic);
    res = r; t = 0; playing = false; range.value = 0;
    const R = rng(4);
    const mc = METALS[M].color;
    plate = new THREE.Mesh(new THREE.BoxGeometry(1.6, 6.4, 0.3), new THREE.MeshStandardMaterial({ color: mc, metalness: 0.25, roughness: 0.4 }));
    dynamic.add(plate);
    // поверхностные атомы пластинки (растворяются)
    atoms = [];
    const nIons = 12;
    const dissolveCount = r.go ? (r.gas ? 6 : Math.round((nIons * r.nq) / r.q)) : 0;
    for (let i = 0; i < 16; i++) {
      const side = i % 2 ? 1 : -1;
      const p = [(((i >> 1) % 2) - 0.5) * 0.7, -1.6 - Math.floor(i / 4) * 0.55 + 0.9, side * 0.24];
      const m = new THREE.Mesh(kit.geo(0.24), kit.mat(mc, { metalness: 0.2, roughness: 0.35 }));
      dynamic.add(m);
      const go = i < dissolveCount;
      atoms.push({ m, atomMat: m.material, ionMat: M === "Cu" ? kit.mat(0x2f8fff) : M === "Fe" ? kit.mat(0x9be08a) : m.material, go, p, end: [(R() - 0.5) * 6.5, (R() - 0.5) * 3 - 0.8, side * (1.4 + R() * 1.6)], ph: R() * 6 });
    }
    // ионы раствора
    const ionColor = S.m === "H" ? 0xf2f4f8 : S.m === "Cu" ? 0x2f8fff : COLORS[S.m] ?? 0xcccccc;
    ions = [];
    for (let i = 0; i < nIons; i++) {
      const m = new THREE.Mesh(kit.geo(S.m === "H" ? 0.18 : 0.26), kit.mat(ionColor));
      dynamic.add(m);
      let p;
      do p = [(R() - 0.5) * 7, (R() - 0.5) * 4 - 0.6, (R() - 0.5) * 6]; while (Math.abs(p[0]) < 1.4 && Math.abs(p[2]) < 1);
      const side = p[2] >= 0 ? 1 : -1;
      const tgt = [(R() - 0.5) * 1.3, -2.4 + R() * 4.2, side * (0.42 + R() * 0.12)];
      ions.push({ m, p, tgt, ph: R() * 6, ionMat: m.material, atomMat: S.m === "H" ? m.material : kit.mat(METALS[S.m].color, { metalness: 0.2, roughness: 0.35 }) });
    }
    // пузырьки водорода
    bubbles = [];
    if (r.gas) for (let i = 0; i < 6; i++) {
      const g = new THREE.Group();
      [-0.37, 0.37].forEach((x) => { const s = new THREE.Mesh(kit.geo(0.24), kit.mat(0xf2f4f8)); s.position.x = x; g.add(s); });
      g.add(kit.bond([-0.37, 0, 0], [0.37, 0, 0], 0.07));
      g.visible = false;
      dynamic.add(g);
      bubbles.push({ g, src: ions[i * 2].tgt, ph: R() * 6 });
    }
    tint0.setHex(S.tint);
    tint1.setHex(r.go && !r.gas ? SALT_TINT[M] : r.go ? SALT_TINT[M] : S.tint);
    if (r.go && !r.gas && S.m === "Cu" && M === "Fe") tint1.setHex(0xb9e3b0);
    st.querySelector("[data-res]").textContent = r.go ? (r.gas ? "выделяется H₂" : `оседает ${S.m}`) : "реакции нет";
    st.querySelector("[data-res]").style.color = r.go ? "var(--good)" : "var(--bad)";
    apply();
  }
  function apply() {
    const pIn = easeInOut(seg(t, 0, 0.25)), pR = easeInOut(seg(t, 0.25, 0.9));
    const y = lerpV([0, 6, 0], [0, -0.3, 0], pIn);
    plate.position.set(...y);
    for (const a of atoms) {
      let p = [a.p[0] + y[0], a.p[1] + y[1], a.p[2]];
      if (a.go && res.go) p = lerpV(p, a.end, pR);
      a.m.material = a.go && res.go && pR > 0.3 ? a.ionMat : a.atomMat; // атом металла стал ионом
      const j = a.go && pR > 0 ? 0.12 : 0;
      a.m.position.set(p[0] + Math.sin(time * 2 + a.ph) * j, p[1] + Math.cos(time * 1.7 + a.ph) * j, p[2]);
    }
    for (const i of ions) {
      const jig = [Math.sin(time * 1.3 + i.ph) * 0.2, Math.cos(time * 1.1 + i.ph) * 0.2, Math.sin(time * 0.9 + i.ph) * 0.2];
      let p = [i.p[0] + jig[0], i.p[1] + jig[1], i.p[2] + jig[2]];
      if (res.go) p = lerpV(p, i.tgt, pR);
      i.m.position.set(...p);
      i.m.material = res.go && pR > 0.85 ? i.atomMat : i.ionMat; // осевший ион стал атомом металла
      i.m.visible = !(res.gas && t > 0.92);
    }
    bubbles.forEach((b, k) => {
      b.g.visible = res.gas && t > 0.88;
      const rise = seg(t, 0.88, 1) * 5;
      b.g.position.set(b.src[0] + Math.sin(time * 3 + b.ph) * 0.15, b.src[1] + rise, b.src[2] * 1.4);
    });
    liquid.material.color.copy(tint0).lerp(tint1, pR);
    st.querySelector("[data-ph]").textContent = t < 0.02 ? "пластинка над стаканом" : t < 0.25 ? "погружаем…" : !res.go ? "ничего не происходит" : t < 0.9 ? "обмен электронами на поверхности" : "готово";
  }
  range.oninput = () => { playing = false; t = +range.value; apply(); };
  ctl.querySelector("[data-play]").onclick = () => { if (t >= 0.999) t = 0; playing = true; };
  v.onFrame((dt) => {
    time += dt;
    if (playing) { t = Math.min(1, t + dt / 7); range.value = t; if (t >= 1) playing = false; }
    if (plate) apply();
  });
  return { load };
}

export const quiz = [
  { q: "Чем объясняется электропроводность металлов?", options: ["Ионами в растворе", "Свободными (обобществлёнными) электронами", "Ковалентными связями", "Протонами"], answer: 1, why: "Электронный газ свободно движется по кристаллу и переносит заряд." },
  { q: "Какая реакция идёт?", options: ["Cu + ZnSO₄", "Ag + CuSO₄", "Fe + CuSO₄", "Cu + HCl"], answer: 2, why: "Железо левее меди в ряду активности и вытесняет её из соли." },
  { q: "Какой металл НЕ вытесняет водород из соляной кислоты?", options: ["Zn", "Mg", "Fe", "Cu"], answer: 3, why: "Медь стоит в ряду активности правее водорода." },
  { q: "Железное ведро покрыто цинком. Что будет при глубокой царапине?", options: ["Быстро заржавеет железо", "Будет разрушаться цинк, железо останется целым", "Ничего", "Цинк превратится в железо"], answer: 1, why: "Цинк активнее железа — он становится анодом микрогальванического элемента (протекторная защита)." },
  { q: "Бронза — это сплав меди с…", options: ["цинком", "оловом", "железом", "золотом"], answer: 1, why: "Cu + Sn — бронза; Cu + Zn — латунь." },
  { q: "В элементе Даниэля — Якоби анодом (−) служит…", options: ["медь", "цинк", "солевой мостик", "раствор CuSO₄"], answer: 1, why: "Цинк окисляется: Zn − 2e⁻ → Zn²⁺, отдавая электроны во внешнюю цепь." },
];
