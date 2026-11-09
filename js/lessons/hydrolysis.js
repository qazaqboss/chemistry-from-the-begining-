import { h, kid, term, stage, chips } from "../ui.js";
import { createViewer, THREE, easeInOut } from "../three/core.js";
import { makeKit, label, seg, lerpV, norm } from "../three/y89-common.js";
import { fmt } from "../chem.js";

// Классификатор солей: основание, кислота, их сила, уравнения и pH 0,1 М раствора
const SALTS = [
  { f: "NaCl", base: "NaOH", bs: 1, acid: "HCl", as: 1, ph: 7, ion: "—", eq: "Гидролиз не идёт: ни Na⁺, ни Cl⁻ не связывают ионы воды в слабый электролит." },
  { f: "KNO₃", base: "KOH", bs: 1, acid: "HNO₃", as: 1, ph: 7, ion: "—", eq: "Гидролиз не идёт — соль сильного основания и сильной кислоты." },
  { f: "Na₂CO₃", base: "NaOH", bs: 1, acid: "H₂CO₃", as: 0, ph: 11.6, ion: "CO₃²⁻ + H₂O ⇄ HCO₃⁻ + OH⁻", mol: "Na₂CO₃ + H₂O ⇄ NaHCO₃ + NaOH", eq: "Сода: раствор мылкий на ощупь, фенолфталеин малиновый." },
  { f: "K₂S", base: "KOH", bs: 1, acid: "H₂S", as: 0, ph: 12.5, ion: "S²⁻ + H₂O ⇄ HS⁻ + OH⁻", mol: "K₂S + H₂O ⇄ KHS + KOH", eq: "Раствор пахнет сероводородом — продуктом второй ступени гидролиза." },
  { f: "CH₃COONa", base: "NaOH", bs: 1, acid: "CH₃COOH", as: 0, ph: 8.9, ion: "CH₃COO⁻ + H₂O ⇄ CH₃COOH + OH⁻", mol: "CH₃COONa + H₂O ⇄ CH₃COOH + NaOH", eq: "Ацетат натрия: среда слабощелочная." },
  { f: "Na₃PO₄", base: "NaOH", bs: 1, acid: "H₃PO₄", as: 0, ph: 12.6, ion: "PO₄³⁻ + H₂O ⇄ HPO₄²⁻ + OH⁻", mol: "Na₃PO₄ + H₂O ⇄ Na₂HPO₄ + NaOH", eq: "Тринатрийфосфат — сильнощелочное моющее средство." },
  { f: "CuSO₄", base: "Cu(OH)₂", bs: 0, acid: "H₂SO₄", as: 1, ph: 4.2, ion: "Cu²⁺ + H₂O ⇄ CuOH⁺ + H⁺", mol: "2CuSO₄ + 2H₂O ⇄ (CuOH)₂SO₄ + H₂SO₄", eq: "Медный купорос: лакмус краснеет." },
  { f: "NH₄Cl", base: "NH₃·H₂O", bs: 0, acid: "HCl", as: 1, ph: 5.1, ion: "NH₄⁺ + H₂O ⇄ NH₃·H₂O + H⁺", mol: "NH₄Cl + H₂O ⇄ NH₃·H₂O + HCl", eq: "Нашатырь: слабокислая среда. Именно этот процесс показан в 3D выше." },
  { f: "ZnCl₂", base: "Zn(OH)₂", bs: 0, acid: "HCl", as: 1, ph: 5.2, ion: "Zn²⁺ + H₂O ⇄ ZnOH⁺ + H⁺", mol: "ZnCl₂ + H₂O ⇄ ZnOHCl + HCl", eq: "«Травленая кислота» для пайки — раствор ZnCl₂ — кислая за счёт гидролиза." },
  { f: "FeCl₃", base: "Fe(OH)₃", bs: 0, acid: "HCl", as: 1, ph: 2.0, ion: "Fe³⁺ + H₂O ⇄ FeOH²⁺ + H⁺", mol: "FeCl₃ + H₂O ⇄ FeOHCl₂ + HCl", eq: "Чем выше заряд и меньше радиус катиона, тем сильнее гидролиз: Fe³⁺ даёт заметно кислую среду." },
  { f: "Al₂(SO₄)₃", base: "Al(OH)₃", bs: 0, acid: "H₂SO₄", as: 1, ph: 3.2, ion: "Al³⁺ + H₂O ⇄ AlOH²⁺ + H⁺", mol: "Al₂(SO₄)₃ + 2H₂O ⇄ 2AlOHSO₄ + H₂SO₄", eq: "Сульфат алюминия используют для очистки воды: при гидролизе образуются хлопья Al(OH)₃, они собирают муть." },
  { f: "CH₃COONH₄", base: "NH₃·H₂O", bs: 0, acid: "CH₃COOH", as: 0, ph: 7.0, ion: "NH₄⁺ + CH₃COO⁻ + H₂O ⇄ NH₃·H₂O + CH₃COOH", eq: "Гидролиз и по катиону, и по аниону. Сила кислоты и основания почти одинакова, поэтому среда близка к нейтральной." },
  { f: "Al₂S₃", base: "Al(OH)₃", bs: 0, acid: "H₂S", as: 0, ph: null, ion: "Al₂S₃ + 6H₂O → 2Al(OH)₃↓ + 3H₂S↑", eq: "<b>Полный, необратимый гидролиз</b>: в воде соль не существует — в таблице растворимости у неё прочерк «—»." },
];

export async function render(el) {
  el.appendChild(h(`<div>
    <p class="lead">Соль — продукт нейтрализации кислоты основанием. Казалось бы, её раствор должен быть нейтральным. Но раствор соды мылкий и щелочной, а раствор медного купороса — кислый. Причина — ${term("hydrolysis", "гидролиз")}: ионы соли отнимают у воды H⁺ или OH⁻.</p>
    ${kid("Вода сама чуть-чуть «распадается» на H⁺ и OH⁻ — поровну, поэтому она нейтральна. Если в воду попадает ион-«воришка», который утаскивает к себе H⁺, то остаются лишние OH⁻, и раствор становится щелочным. А если воришка забирает OH⁻ — лишними оказываются H⁺, и раствор кислый.")}
  </div>`));

  el.appendChild(h(`<section id="idea"><h2>Кто «победит» — сильный или слабый</h2>
    <p><b>Гидролиз соли</b> — обменное взаимодействие ионов соли с водой, при котором образуется слабый электролит и меняется среда раствора. Гидролизу подвергаются только ионы, которые «пришли» от <b>слабой</b> кислоты или <b>слабого</b> основания: они связывают ионы воды в малодиссоциирующие частицы.</p>
    <div class="table-wrap"><table class="data">
      <tr><th>Соль образована</th><th>Гидролиз</th><th>Среда</th><th>Пример</th></tr>
      <tr><td>сильным основанием и сильной кислотой</td><td>не идёт</td><td>нейтральная, pH = 7</td><td>NaCl, K₂SO₄, KNO₃</td></tr>
      <tr><td>сильным основанием и слабой кислотой</td><td>по аниону</td><td>щелочная, pH > 7</td><td>Na₂CO₃, K₂S, CH₃COONa</td></tr>
      <tr><td>слабым основанием и сильной кислотой</td><td>по катиону</td><td>кислая, pH < 7</td><td>CuSO₄, NH₄Cl, FeCl₃</td></tr>
      <tr><td>слабым основанием и слабой кислотой</td><td>по катиону и аниону</td><td>близка к нейтральной</td><td>CH₃COONH₄; Al₂S₃ — полностью</td></tr>
    </table></div>
    <div class="callout"><b>Правило-шпаргалка:</b> «Кто сильнее — того и среда». Сильная кислота → кислая среда, сильное основание → щелочная, оба сильные — нейтральная.</div>
  </section>`));

  // ---------- 3D ----------
  const sec = h(`<section id="model"><h2>Перенос протона в 3D</h2>
    <p>Гидролиз — это перенос протона H⁺ между ионом соли и молекулой воды. Карбонат-ион отрывает H⁺ от воды, оставляя гидроксид-ион OH⁻ (среда щелочная). Ион аммония, наоборот, сам отдаёт H⁺ воде — образуется ион гидроксония H₃O⁺ (среда кислая). Оба процесса обратимы (⇄) и идут в малой степени: в 0,1 М растворе соды гидролизовано лишь ~4% ионов CO₃²⁻.</p></section>`);
  el.appendChild(sec);
  const cbox = h(`<div style="margin-bottom:10px"></div>`);
  sec.appendChild(cbox);
  const st = stage(`<div class="overlay"><span><b data-eq class="formula" style="font-size:1rem"></b><br><span data-phase></span></span><span data-env style="text-align:right;font-weight:700"></span></div>`, { wide: true });
  sec.appendChild(st);
  const ctl = h(`<div class="card pad" style="margin-top:10px"><div class="row"><button class="btn primary" type="button" data-play>▶ Пуск</button><input type="range" min="0" max="1" step="0.001" value="0" style="flex:1;min-width:140px" aria-label="Ход переноса протона"></div><p class="small muted" style="margin:10px 0 0">Пунктир — водородная связь, по которой «перепрыгивает» протон (выделен свечением).</p></div>`);
  sec.appendChild(ctl);
  const v = createViewer(st, { camera: [0, 1.2, 10.5], fitWidth: 5.2, autoRotate: false, minDistance: 5, maxDistance: 30 });
  const pt = buildTransfer(v, st, ctl);
  chips(cbox, [{ label: "Na₂CO₃: CO₃²⁻ + H₂O", k: "co3" }, { label: "NH₄Cl: NH₄⁺ + H₂O", k: "nh4" }], (it) => pt.load(it.k));
  pt.load("co3");

  // ---------- классификатор ----------
  const cls = h(`<section id="classify"><h2>Классификатор солей</h2>
    <p>Выбери соль — увидишь, из каких кислоты и основания она «собрана», пойдёт ли гидролиз и какой будет среда (pH для 0,1 М раствора при 25 °C).</p>
    <div class="card pad hyd">
      <div data-chips></div>
      <div class="hyd-pair" data-pair></div>
      <div class="hyd-scale"><div class="hyd-bar"></div><div class="hyd-mark" data-mark><span data-ph></span></div><div class="hyd-ticks"><span>0</span><span>7</span><span>14</span></div></div>
      <div data-res></div>
    </div>
    <style>
      .hyd .hyd-pair{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:12px 0}
      .hyd .hyd-pair>div{padding:10px 12px;border-radius:12px;background:var(--surface-2);border:1px solid var(--line)}
      .hyd .hyd-pair b{display:block;font-family:var(--mono)}
      .hyd .st{color:var(--good);font-weight:700}.hyd .wk{color:var(--bad);font-weight:700}
      .hyd-scale{position:relative;margin:40px 0 8px}
      .hyd-bar{height:14px;border-radius:8px;background:linear-gradient(90deg,#e0302a,#f08a24 20%,#f2d22e 35%,#5cc85a 50%,#2aa3c8 65%,#3d5bd8 80%,#6a3fb8)}
      .hyd-mark{position:absolute;top:-38px;white-space:nowrap;transform:translateX(-50%);transition:left .5s;text-align:center;font-weight:800;font-size:.85rem}
      .hyd-mark::after{content:"";display:block;width:3px;height:30px;margin:2px auto 0;background:var(--text);border-radius:2px}
      .hyd-ticks{display:flex;justify-content:space-between;font-size:.75rem;color:var(--text-3)}
      @media (max-width:520px){.hyd .hyd-pair{grid-template-columns:1fr}}
    </style>
  </section>`);
  el.appendChild(cls);
  const show = (s) => {
    const str = (x) => (x ? "<span class='st'>сильное</span>" : "<span class='wk'>слабое</span>");
    const stra = (x) => (x ? "<span class='st'>сильная</span>" : "<span class='wk'>слабая</span>");
    cls.querySelector("[data-pair]").innerHTML = `<div>Основание <b>${s.base}</b>${str(s.bs)}</div><div>Кислота <b>${s.acid}</b>${stra(s.as)}</div>`;
    const type = s.ph == null ? "полный необратимый гидролиз" : s.bs && s.as ? "гидролиз не идёт" : s.bs ? "гидролиз по аниону" : s.as ? "гидролиз по катиону" : "гидролиз по катиону и аниону";
    const env = s.ph == null ? "—" : s.ph > 7.5 ? "щелочная" : s.ph < 6.5 ? "кислая" : "нейтральная";
    const litmus = s.ph == null ? "" : s.ph > 7.5 ? "лакмус синий" : s.ph < 6.5 ? "лакмус красный" : "лакмус фиолетовый";
    const mark = cls.querySelector("[data-mark]");
    mark.style.visibility = s.ph == null ? "hidden" : "visible";
    if (s.ph != null) { mark.style.left = (s.ph / 14) * 100 + "%"; cls.querySelector("[data-ph]").textContent = "pH ≈ " + fmt(s.ph, 1); }
    cls.querySelector("[data-res]").innerHTML = `<p class="mt0"><b>${type[0].toUpperCase() + type.slice(1)}</b>${s.ph != null ? ` · среда <b>${env}</b> · ${litmus}` : ""}</p>
      ${s.ion !== "—" ? `<div class="eq">${s.ion}${s.mol ? `<br><span class="small">${s.mol}</span>` : ""}</div>` : ""}<p class="small" style="margin:0">${s.eq}</p>`;
  };
  chips(cls.querySelector("[data-chips]"), SALTS.map((s) => ({ ...s, label: s.f })), show, 2);
  show(SALTS[2]);

  el.appendChild(h(`<section id="indicators"><h2>Как увидеть среду: индикаторы</h2>
    <div class="table-wrap"><table class="data">
      <tr><th>Индикатор</th><th>Кислая (pH < 7)</th><th>Нейтральная</th><th>Щелочная (pH > 7)</th></tr>
      <tr><td>Лакмус</td><td>красный</td><td>фиолетовый</td><td>синий</td></tr>
      <tr><td>Метиловый оранжевый</td><td>розово-красный</td><td>оранжевый</td><td>жёлтый</td></tr>
      <tr><td>Фенолфталеин</td><td>бесцветный</td><td>бесцветный</td><td>малиновый (pH > 8,2)</td></tr>
    </table></div>
    <p>Шкала ${term("ph", "pH")} логарифмическая: раствор с pH 4 в 10 раз «кислее», чем с pH 5, и в 1000 раз — чем с pH 7.</p>
    ${kid("Сок краснокочанной капусты — природный индикатор! В уксусе он розовеет, в воде фиолетовый, а в растворе соды становится зелёным. Попробуй со взрослыми.", "Опыт на кухне")}
  </section>`));

  el.appendChild(h(`<section id="deeper"><h2>Ступени, полный гидролиз и как им управлять</h2>
    <p>Гидролиз многозарядных ионов идёт <b>ступенчато</b>, и в обычных условиях практически только по первой ступени: CO₃²⁻ → HCO₃⁻ (а не сразу H₂CO₃). Поэтому в уравнениях ОГЭ/ЕГЭ пишут одну первую ступень.</p>
    <p>Если соль образована <b>слабым нерастворимым основанием и слабой летучей кислотой</b>, гидролиз идёт до конца: оба продукта уходят из раствора. Поэтому Al₂S₃, Cr₂S₃, Fe₂(CO₃)₃, Al₂(CO₃)₃ в воде не существуют, а при сливании растворов AlCl₃ и Na₂CO₃ выпадает не карбонат, а гидроксид:</p>
    <div class="eq">2AlCl₃ + 3Na₂CO₃ + 3H₂O → 2Al(OH)₃↓ + 3CO₂↑ + 6NaCl</div>
    <div class="callout adv"><b>Смещение равновесия гидролиза.</b> Гидролиз — эндотермический процесс, обратный нейтрализации, поэтому <b>нагревание</b> и <b>разбавление</b> его усиливают (горячий раствор соды моет лучше). Добавка кислоты подавляет гидролиз по катиону (так хранят растворы FeCl₃ и SnCl₂), добавка щёлочи — по аниону.</div>
    <div class="card pad"><p class="mt0"><b>Задание в формате ОГЭ.</b> Установите соответствие между солью и средой её раствора: А) K₂CO₃; Б) Zn(NO₃)₂; В) Na₂SO₄.</p>
      <p class="small" style="margin:0">K₂CO₃ — KOH (сильное) + H₂CO₃ (слабая) → <b>щелочная</b>. Zn(NO₃)₂ — Zn(OH)₂ (слабое) + HNO₃ (сильная) → <b>кислая</b>. Na₂SO₄ — оба сильные → <b>нейтральная</b>.</p></div>
    <p class="small muted">Связанные уроки: <a href="#lesson-electrolytes">сильные и слабые электролиты</a>, <a href="#lesson-ionic">ионные уравнения</a>.</p>
  </section>`));
}

// ---------- 3D: перенос протона ----------
// Ключевые кадры: 0 — частицы порознь, 1 — водородная связь, 2 — протон перешёл, 3 — продукты разошлись
const KT = [0, 0.35, 0.6, 1];
function systems() {
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const mul = (a, k) => a.map((x) => x * k);
  const dirAt = (deg, z = 0) => norm([Math.cos((deg * Math.PI) / 180), Math.sin((deg * Math.PI) / 180), z]);
  // --- CO3 ---
  const C = [-1.2, 0, 0];
  const O1 = add(C, [1.28, 0, 0]), O2 = add(C, mul(dirAt(120), 1.28)), O3 = add(C, mul(dirAt(240), 1.28));
  const Ht1 = add(O1, mul(dirAt(70), 0.97)); // в HCO3⁻ угол C–O–H ≈ 110°
  const wA = [4.6, 1.6, 0.6], wB = add(O1, [2.75, 0, 0]), wD = [4.6, -1.8, 0.8];
  const co3 = {
    eq0: "CO₃²⁻ + H₂O", eq1: "HCO₃⁻ + OH⁻", env: "в растворе копятся OH⁻ → среда щелочная", envCls: "#3d6bff",
    atoms: [
      { el: "C", k: [C, C, C, C] }, { el: "O", k: [O1, O1, O1, O1] }, { el: "O", k: [O2, O2, O2, O2] }, { el: "O", k: [O3, O3, O3, O3] },
      // переносимый протон
      { el: "H", k: [add(wA, mul(norm([-1, -0.5, -0.2]), 0.97)), add(wB, [-0.97, 0, 0]), Ht1, Ht1], hot: true },
      { el: "O", k: [wA, wB, add(wB, [0.25, -0.1, 0]), wD] },
      { el: "H", k: [add(wA, mul(dirAt(40), 0.96)), add(wB, mul(dirAt(75.5), 0.96)), add(add(wB, [0.25, -0.1, 0]), mul(dirAt(10), 0.97)), add(wD, mul(dirAt(-10), 0.97))] },
    ],
    before: [[0, 1], [0, 2], [0, 3], [5, 4], [5, 6]], after: [[0, 1], [0, 2], [0, 3], [1, 4], [5, 6]],
    hb: { h: 4, from: 5, to: 1 },
    labels: [{ t: "CO₃²⁻", at: 0, ph: 0 }, { t: "H₂O", at: 5, ph: 0 }, { t: "HCO₃⁻", at: 0, ph: 1 }, { t: "OH⁻", at: 5, ph: 1 }],
  };
  // --- NH4 ---
  const N = [-1.2, 0, 0];
  const T = [[1, 0, 0], [-1 / 3, 0.9428, 0], [-1 / 3, -0.4714, 0.8165], [-1 / 3, -0.4714, -0.8165]];
  const Hn = T.map((d) => add(N, mul(d, 1.03)));
  const oA = [4.4, 1.8, 0.4], oB = add(Hn[0], [1.75, 0, 0]), oC = add(Hn[0], [0.95, 0, 0]), oD = [4.6, -1.6, 0.8];
  // H3O+: пирамида, протон приходит со стороны −x
  const h3o = (o) => [add(o, mul(norm([-1, 0, 0.35]), 0.98)), add(o, mul(norm([0.45, 0.85, 0.3]), 0.98)), add(o, mul(norm([0.45, -0.85, 0.3]), 0.98))];
  const nh4 = {
    eq0: "NH₄⁺ + H₂O", eq1: "NH₃ + H₃O⁺", env: "в растворе копятся H₃O⁺ (H⁺) → среда кислая", envCls: "#e0302a",
    atoms: [
      { el: "N", k: [N, N, N, N] },
      { el: "H", k: [Hn[0], Hn[0], h3o(oC)[0], h3o(oD)[0]], hot: true },
      { el: "H", k: [Hn[1], Hn[1], Hn[1], Hn[1]] }, { el: "H", k: [Hn[2], Hn[2], Hn[2], Hn[2]] }, { el: "H", k: [Hn[3], Hn[3], Hn[3], Hn[3]] },
      { el: "O", k: [oA, oB, oC, oD] },
      { el: "H", k: [add(oA, mul(dirAt(40), 0.96)), add(oB, mul(dirAt(52), 0.96)), h3o(oC)[1], h3o(oD)[1]] },
      { el: "H", k: [add(oA, mul(dirAt(-64), 0.96)), add(oB, mul(dirAt(-52), 0.96)), h3o(oC)[2], h3o(oD)[2]] },
    ],
    before: [[0, 1], [0, 2], [0, 3], [0, 4], [5, 6], [5, 7]], after: [[0, 2], [0, 3], [0, 4], [5, 1], [5, 6], [5, 7]],
    hb: { h: 1, from: 0, to: 5 },
    labels: [{ t: "NH₄⁺", at: 0, ph: 0 }, { t: "H₂O", at: 5, ph: 0 }, { t: "NH₃", at: 0, ph: 1 }, { t: "H₃O⁺", at: 5, ph: 1 }],
  };
  return { co3, nh4 };
}

function buildTransfer(v, st, ctl) {
  const kit = makeKit();
  const root = new THREE.Group();
  root.position.x = -1.6;
  v.scene.add(root);
  const SYS = systems();
  const range = ctl.querySelector("input");
  let sys = null, atoms = [], bonds = [], labels = [], hbLine = null, glowM = null, t = 0, playing = false, time = 0;
  const hbMat = new THREE.LineDashedMaterial({ color: 0x4f8dff, dashSize: 0.14, gapSize: 0.1 });
  function load(k) {
    v.clear(root);
    sys = SYS[k];
    atoms = sys.atoms.map((a) => { const m = kit.sphere(a.el, a.el === "H" ? 0.24 : undefined); root.add(m); return m; });
    const hot = sys.atoms.findIndex((a) => a.hot);
    glowM = new THREE.Mesh(kit.geo(0.42), new THREE.MeshBasicMaterial({ color: 0xffe066, transparent: true, opacity: 0.35, depthWrite: false }));
    atoms[hot].add(glowM);
    const nb = Math.max(sys.before.length, sys.after.length);
    bonds = Array.from({ length: nb }, () => { const b = kit.bond([0, 0, 0], [0, 1, 0], 0.08); root.add(b); return b; });
    labels = sys.labels.map((L) => { const s = label(L.t, { size: 0.42 }); root.add(s); return { s, ...L }; });
    const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(1, 0, 0)]);
    hbLine = new THREE.Line(g, hbMat);
    root.add(hbLine);
    st.querySelector("[data-env]").textContent = "";
    t = 0; range.value = 0; playing = false;
    apply();
  }
  const posAt = (a) => {
    let i = 0;
    while (i < KT.length - 2 && t > KT[i + 1]) i++;
    const p = easeInOut(seg(t, KT[i], KT[i + 1]));
    return lerpV(a.k[i], a.k[i + 1], p);
  };
  function apply() {
    const P = sys.atoms.map((a, i) => {
      const p = posAt(a);
      const j = 0.04;
      return [p[0] + Math.sin(time * 3 + i) * j, p[1] + Math.cos(time * 2.6 + i * 2) * j, p[2]];
    });
    atoms.forEach((m, i) => m.position.set(...P[i]));
    const list = t < 0.5 ? sys.before : sys.after;
    bonds.forEach((b, i) => {
      b.visible = i < list.length;
      if (b.visible) kit.placeBond(b, P[list[i][0]], P[list[i][1]], 0.08);
    });
    // водородная связь: от протона к атому, которому он ещё (или уже) не принадлежит
    const { h: hI, from, to } = sys.hb;
    const showHb = t > 0.2 && t < 0.75;
    hbLine.visible = showHb;
    if (showHb) {
      hbLine.geometry.setFromPoints([new THREE.Vector3(...P[hI]), new THREE.Vector3(...P[t < 0.5 ? to : from])]);
      hbLine.computeLineDistances();
    }
    glowM.material.opacity = 0.2 + 0.25 * Math.sin(time * 5) ** 2;
    labels.forEach((L) => {
      L.s.visible = t < 0.5 ? L.ph === 0 : L.ph === 1;
      const p = P[L.at];
      L.s.position.set(p[0], p[1] + 1.9, p[2]);
    });
    st.querySelector("[data-eq]").textContent = `${sys.eq0} ⇄ ${sys.eq1}`;
    st.querySelector("[data-phase]").textContent = t < 0.15 ? "ион и молекула воды сближаются" : t < 0.45 ? "водородная связь: протон между двумя атомами" : t < 0.65 ? "протон перешёл" : "продукты расходятся";
    const env = st.querySelector("[data-env]");
    env.textContent = t > 0.65 ? sys.env : "";
    env.style.color = sys.envCls;
  }
  range.oninput = () => { playing = false; t = +range.value; apply(); };
  ctl.querySelector("[data-play]").onclick = () => { if (t >= 0.999) t = 0; playing = true; };
  v.onFrame((dt) => {
    time += dt;
    if (playing) { t = Math.min(1, t + dt / 6); range.value = t; if (t >= 1) playing = false; }
    if (sys) apply();
  });
  return { load };
}

export const quiz = [
  { q: "Какая среда у раствора карбоната калия K₂CO₃?", options: ["кислая", "нейтральная", "щелочная", "зависит от посуды"], answer: 2, why: "Соль сильного основания KOH и слабой кислоты H₂CO₃: гидролиз по аниону, накапливаются OH⁻." },
  { q: "Не подвергается гидролизу соль…", options: ["NH₄NO₃", "K₂SO₄", "Na₂S", "AlCl₃"], answer: 1, why: "K₂SO₄ образован сильным основанием KOH и сильной кислотой H₂SO₄." },
  { q: "Лакмус в растворе CuCl₂ станет…", options: ["синим", "красным", "фиолетовым", "бесцветным"], answer: 1, why: "Гидролиз по катиону Cu²⁺ даёт H⁺ — среда кислая." },
  { q: "Сокращённое уравнение первой ступени гидролиза Na₂S:", options: ["S²⁻ + H₂O ⇄ HS⁻ + OH⁻", "S²⁻ + 2H₂O → H₂S + 2OH⁻", "Na⁺ + H₂O ⇄ NaOH + H⁺", "S²⁻ + H⁺ → HS⁻"], answer: 0, why: "Гидролиз идёт ступенчато; в обычных условиях — по первой ступени, с образованием гидросульфид-иона." },
  { q: "Почему Al₂S₃ нельзя получить в водном растворе?", options: ["Он взрывается", "Подвергается полному необратимому гидролизу", "Он нерастворим", "Алюминий не реагирует с серой"], answer: 1, why: "Al₂S₃ + 6H₂O → 2Al(OH)₃↓ + 3H₂S↑: оба продукта уходят из раствора." },
  { q: "Как ускорить гидролиз соды (усилить моющее действие раствора)?", options: ["Охладить", "Нагреть", "Добавить щёлочи", "Упарить"], answer: 1, why: "Гидролиз эндотермичен: нагревание смещает равновесие в сторону продуктов." },
];
