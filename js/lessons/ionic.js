import { h, kid, term, stage } from "../ui.js";
import { createViewer, THREE, easeInOut } from "../three/core.js";
import { makeKit, ionGroup, ballStick, PRODUCTS, IONS, rng, seg, lerpV } from "../three/y89-common.js";
import { pretty } from "../chem.js";

// ---------- данные ----------
// Ионы: символ в формуле, заряд, многоатомный ли (для скобок), id 3D-модели
const CAT = { H: [1, 0, "H+"], Na: [1, 0, "Na+"], K: [1, 0, "K+"], NH4: [1, 1, "NH4+"], Ba: [2, 0, "Ba2+"], Ca: [2, 0, "Ca2+"], Ag: [1, 0, "Ag+"], Cu: [2, 0, "Cu2+"], Fe: [3, 0, "Fe3+"] };
const AN = { OH: [1, 1, "OH-"], Cl: [1, 0, "Cl-"], NO3: [1, 1, "NO3-"], SO4: [2, 1, "SO42-"], CO3: [2, 1, "CO32-"], PO4: [3, 1, "PO43-"] };
// Фрагмент таблицы растворимости: р — растворимо, м — малорастворимо, н — нерастворимо, — — не существует в воде
const SOL = {
  H: { OH: "", Cl: "р", NO3: "р", SO4: "р", CO3: "р", PO4: "р" },
  Na: { OH: "р", Cl: "р", NO3: "р", SO4: "р", CO3: "р", PO4: "р" },
  K: { OH: "р", Cl: "р", NO3: "р", SO4: "р", CO3: "р", PO4: "р" },
  NH4: { OH: "р", Cl: "р", NO3: "р", SO4: "р", CO3: "р", PO4: "р" },
  Ba: { OH: "р", Cl: "р", NO3: "р", SO4: "н", CO3: "н", PO4: "н" },
  Ca: { OH: "м", Cl: "р", NO3: "р", SO4: "м", CO3: "н", PO4: "н" },
  Ag: { OH: "—", Cl: "н", NO3: "р", SO4: "м", CO3: "н", PO4: "н" },
  Cu: { OH: "н", Cl: "р", NO3: "р", SO4: "р", CO3: "—", PO4: "н" },
  Fe: { OH: "н", Cl: "р", NO3: "р", SO4: "р", CO3: "—", PO4: "н" },
};
const PPT_COLOR = { BaSO4: "белый", BaCO3: "белый", CaCO3: "белый", "Ca(OH)2": "белый, малорастворимый", CaSO4: "белый, малорастворимый", AgCl: "белый творожистый", Ag2SO4: "белый, малорастворимый", Ag2CO3: "светло-жёлтый", Ag3PO4: "жёлтый", "Cu(OH)2": "голубой студенистый", "Fe(OH)3": "бурый", "Ba3(PO4)2": "белый", "Ca3(PO4)2": "белый", "Cu3(PO4)2": "голубовато-зелёный", FePO4: "желтовато-белый" };
const COMPOUNDS = [
  ["HCl", "H", 1, "Cl", 1], ["H2SO4", "H", 2, "SO4", 1], ["HNO3", "H", 1, "NO3", 1],
  ["NaOH", "Na", 1, "OH", 1], ["Ba(OH)2", "Ba", 1, "OH", 2],
  ["BaCl2", "Ba", 1, "Cl", 2], ["AgNO3", "Ag", 1, "NO3", 1], ["Na2SO4", "Na", 2, "SO4", 1], ["Na2CO3", "Na", 2, "CO3", 1],
  ["CuSO4", "Cu", 1, "SO4", 1], ["FeCl3", "Fe", 1, "Cl", 3], ["NH4Cl", "NH4", 1, "Cl", 1], ["Na3PO4", "Na", 3, "PO4", 1],
  ["CaCl2", "Ca", 1, "Cl", 2], ["KNO3", "K", 1, "NO3", 1],
].map(([f, c, n, a, m]) => ({ f, c, n, a, m }));

const gcd = (a, b) => (b ? gcd(b, a % b) : a);
const lcm = (a, b) => (a * b) / gcd(a, b);
const ionName = (id) => IONS[id].name;
const coef = (k) => (k === 1 ? "" : k);

function formula(c, nc, a, na) {
  const cs = nc > 1 ? (CAT[c][1] ? `(${c})${nc}` : `${c}${nc}`) : c;
  const as = na > 1 ? (AN[a][1] ? `(${a})${na}` : `${a}${na}`) : a;
  return cs + as;
}
// Продукт обмена: тип и формула
function product(c, a) {
  const L = lcm(CAT[c][0], AN[a][0]);
  const e = L / CAT[c][0], f = L / AN[a][0];
  const base = { c, a, e, f, f0: formula(c, e, a, f) };
  if (c === "H" && a === "OH") return { ...base, type: "water", show: "H₂O", species: [["H2O", 1]] };
  if (c === "H" && a === "CO3") return { ...base, type: "gas", show: "CO₂↑ + H₂O", species: [["CO2", 1, "↑"], ["H2O", 1]], gas: "CO₂" };
  if (c === "NH4" && a === "OH") return { ...base, type: "gas", show: "NH₃↑ + H₂O", species: [["NH3", 1, "↑"], ["H2O", 1]], gas: "NH₃" };
  if (c === "H" && a === "PO4") return { ...base, type: "weak", show: "H₃PO₄", species: [["H3PO4", 1]] };
  const s = SOL[c][a];
  if (s === "—") return { ...base, type: "undef" };
  if (s === "р") return { ...base, type: "sol" };
  return { ...base, type: "ppt", show: pretty(base.f0) + "↓", species: [[base.f0, 1, "↓"]], small: s === "м" };
}

// Полный разбор реакции обмена A + B
export function exchange(A, B) {
  if (A.f === B.f) return { none: "Это одно и то же вещество — обмениваться нечем." };
  if (A.c === B.c || A.a === B.a) return { none: `У веществ общий ион (${ionName(A.c === B.c ? CAT[A.c][2] : AN[A.a][2])}) — при обмене получились бы те же вещества. Реакция не идёт.` };
  const P = product(A.c, B.a), Q = product(B.c, A.a);
  for (const X of [P, Q]) if (X.type === "undef") return { none: `В таблице растворимости для ${pretty(X.f0)} стоит прочерк: в воде такое вещество не существует (разлагается водой). В заданиях ОГЭ такие пары не встречаются.` };
  let k = null;
  for (let s = 2; s <= 24 && !k; s++) for (let k1 = 1; k1 <= 12 && !k; k1++) for (let k2 = 1; k2 <= 12 && !k; k2++) for (let k3 = 1; k3 < s && !k; k3++) {
    const k4 = s - k3;
    if (k1 * A.n === k3 * P.e && k1 * A.m === k4 * Q.f && k2 * B.n === k4 * Q.e && k2 * B.m === k3 * P.f) k = [k1, k2, k3, k4];
  }
  const [k1, k2, k3, k4] = k;
  // вода и газы — в конце, как принято записывать
  const late = (X) => ["water", "gas", "weak"].includes(X.type);
  const prods = late(P) && !late(Q) ? [[Q, k4], [P, k3]] : [[P, k3], [Q, k4]];
  const molec = `${coef(k1)}${pretty(A.f)} + ${coef(k2)}${pretty(B.f)} → ${prods.map(([X, kx]) => prodStr(X, kx)).join(" + ")}`;
  if (P.type === "sol" && Q.type === "sol") {
    return { none: "Оба возможных продукта растворимы и являются сильными электролитами — ни осадка, ни газа, ни воды. Все ионы просто остаются в растворе, реакция не идёт.", molecFake: molec };
  }
  // ионы слева / справа
  const left = new Map(), right = new Map(), rightMol = [];
  const addIon = (m, id, n) => m.set(id, (m.get(id) || 0) + n);
  addIon(left, CAT[A.c][2], k1 * A.n); addIon(left, AN[A.a][2], k1 * A.m);
  addIon(left, CAT[B.c][2], k2 * B.n); addIon(left, AN[B.a][2], k2 * B.m);
  for (const [X, kx] of prods) {
    if (X.type === "sol") { addIon(right, CAT[X.c][2], kx * X.e); addIon(right, AN[X.a][2], kx * X.f); }
    else for (const [sp, n, mark] of X.species) rightMol.push([sp, n * kx, mark || "", X]);
  }
  const both = new Set([...right.keys()].filter((id) => left.has(id)));
  const ionsStr = (m) => [...m].filter(([, n]) => n > 0).map(([id, n]) => (both.has(id) ? `<s title="ион-наблюдатель">${coef(n)}${ionName(id)}</s>` : `${coef(n)}${ionName(id)}`));
  const molStr = (arr, d = 1) => arr.map(([sp, n, mark]) => `${coef(n / d)}${pretty(sp)}${mark}`);
  const full = `${ionsStr(left).join(" + ")} → ${[...molStr(rightMol), ...ionsStr(right)].join(" + ")}`;
  const spect = [];
  for (const [id, n] of right) { if (left.has(id)) { spect.push(id); left.set(id, left.get(id) - n); } }
  let d = 0;
  for (const n of left.values()) if (n > 0) d = gcd(d, n);
  for (const [, n] of rightMol) d = gcd(d, n);
  const netL = [...left].filter(([, n]) => n > 0).sort((a, b) => IONS[b[0]].q - IONS[a[0]].q).map(([id, n]) => `${coef(n / d)}${ionName(id)}`);
  const net = `${netL.join(" + ")} → ${molStr(rightMol, d).join(" + ")}`;
  const signs = [P, Q].filter((X) => X.type !== "sol").map((X) =>
    X.type === "ppt" ? `выпадает осадок ${pretty(X.f0)} (${PPT_COLOR[X.f0] || "белый"}${X.small ? "; в сильно разбавленных растворах может не выпасть" : ""})` : X.type === "gas" ? `выделяется газ ${X.gas}${X.gas === "NH₃" ? " с резким запахом (при нагревании)" : " — «вскипание»"}` : X.type === "water" ? "образуется вода — нейтрализация, раствор нагревается" : "образуется слабая кислота H₃PO₄");
  return { molec, full, net, spect: spect.map(ionName), signs, k, P, Q };
}
function prodStr(X, k) {
  if (X.type === "sol" || X.type === "ppt" || X.type === "weak") return `${coef(k)}${X.type === "weak" ? "H₃PO₄" : pretty(X.f0)}${X.type === "ppt" ? "↓" : ""}`;
  return X.species.map(([sp, n, mark]) => `${coef(n * k)}${pretty(sp)}${mark || ""}`).join(" + ");
}

export async function render(el) {
  el.appendChild(h(`<div>
    <p class="lead">В растворах электролитов реагируют не «молекулы солей», а ${term("ion", "ионы")}. Поэтому реакцию обмена удобно записывать <b>ионным уравнением</b>: оно показывает, какие частицы на самом деле встретились и изменились, а какие только «постояли рядом».</p>
    ${kid("Представь школьную дискотеку: в зале много пар. Если поменяться партнёрами, ничего нового не случится — все так и будут танцевать. А вот если двое вдруг «слиплись» и ушли из зала (выпали в осадок или улетели газом) — это и есть реакция!")}
  </div>`));

  el.appendChild(h(`<section id="rule"><h2>Когда реакция обмена идёт до конца</h2>
    <p>Реакция ионного обмена протекает практически необратимо, если ионы связываются в частицы, которые «уходят» из раствора (правило Бертолле):</p>
    <div class="grid-2">
      <div class="card pad"><b>1. Выпадает ${term("precipitate", "осадок")}</b><p class="formula small" style="margin:6px 0 0">Ba²⁺ + SO₄²⁻ → BaSO₄↓</p><p class="small muted" style="margin:4px 0 0">Ag⁺ + Cl⁻ → AgCl↓</p></div>
      <div class="card pad"><b>2. Выделяется газ</b><p class="formula small" style="margin:6px 0 0">2H⁺ + CO₃²⁻ → CO₂↑ + H₂O</p><p class="small muted" style="margin:4px 0 0">NH₄⁺ + OH⁻ → NH₃↑ + H₂O</p></div>
      <div class="card pad"><b>3. Образуется слабый электролит</b><p class="formula small" style="margin:6px 0 0">H⁺ + OH⁻ → H₂O</p><p class="small muted" style="margin:4px 0 0">вода, слабые кислоты</p></div>
      <div class="card pad"><b>Иначе — реакция не идёт</b><p class="small" style="margin:6px 0 0">NaCl + KNO₃: все четыре иона Na⁺, Cl⁻, K⁺, NO₃⁻ так и остаются в растворе — нового вещества нет.</p></div>
    </div>
  </section>`));

  el.appendChild(h(`<section id="how"><h2>Как записать ионное уравнение</h2>
    <ol>
      <li>Составить <b>молекулярное</b> уравнение и расставить коэффициенты: <span class="formula">BaCl₂ + Na₂SO₄ → BaSO₄↓ + 2NaCl</span></li>
      <li>По таблице растворимости решить, что распадается на ионы.</li>
      <li>Записать <b>полное ионное</b> уравнение — сильные растворимые электролиты в виде ионов:
        <div class="eq">Ba²⁺ + 2Cl⁻ + 2Na⁺ + SO₄²⁻ → BaSO₄↓ + 2Na⁺ + 2Cl⁻</div></li>
      <li>Вычеркнуть одинаковые ионы слева и справа — ${term("spectator", "ионы-наблюдатели")} (здесь Na⁺ и Cl⁻).</li>
      <li>Записать <b>сокращённое ионное</b> уравнение; если все коэффициенты делятся на общее число — сократить:
        <div class="eq">Ba²⁺ + SO₄²⁻ → BaSO₄↓</div></li>
    </ol>
    <div class="callout warn"><b>Важно: на ионы не раскладывают</b> осадки (н, м), газы, воду и другие слабые электролиты, оксиды и простые вещества. Проверка: суммарный заряд слева равен суммарному заряду справа.</div>
    <p>Сокращённое уравнение раскрывает <b>суть</b> реакции: Ba²⁺ + SO₄²⁻ → BaSO₄↓ описывает сразу и BaCl₂ + Na₂SO₄, и Ba(NO₃)₂ + K₂SO₄, и BaCl₂ + H₂SO₄ — любой растворимой соли бария с любым растворимым сульфатом.</p>
  </section>`));

  // ---------- тренажёр ----------
  const sec = h(`<section id="trainer"><h2>Тренажёр: слей два раствора</h2>
    <p>Выбери два раствора. Сначала сделай прогноз, потом посмотри уравнения и 3D-модель: ионы из двух стаканов перемешиваются, а те, что образуют осадок, газ или воду, «уходят» из раствора.</p>
    <div class="card pad ion-pick">
      <div class="row"><select data-a aria-label="Первый раствор"></select><b>+</b><select data-b aria-label="Второй раствор"></select></div>
      <div class="row" style="margin-top:10px" data-guess><span class="small muted">Твой прогноз:</span><button class="chip" type="button" data-g="1">Реакция пойдёт</button><button class="chip" type="button" data-g="0">Не пойдёт</button><button class="chip" type="button" data-g="show">Сразу показать</button></div>
      <div data-out hidden style="margin-top:10px"></div>
    </div>
  </section>`);
  el.appendChild(sec);
  const st = stage(`<div class="overlay"><span><b data-title style="font-size:1rem"></b><br><span data-phase></span></span><span data-legend style="text-align:right"></span></div>`, { wide: true });
  st.style.marginTop = "10px";
  sec.appendChild(st);
  const ctl = h(`<div class="card pad" style="margin-top:10px"><div class="row"><button class="btn primary" type="button" data-play>▶ Слить растворы</button><input type="range" min="0" max="1" step="0.001" value="0" style="flex:1;min-width:140px" aria-label="Ход реакции"></div></div>`);
  sec.appendChild(ctl);
  sec.appendChild(h(`<style>.ion-pick select{flex:1;min-width:120px;max-width:260px}.ion-pick .eq{text-align:left;font-size:1rem;margin:8px 0}.ion-pick s{text-decoration-color:var(--bad);text-decoration-thickness:2px;opacity:.75}.ion-pick .lbl{font-size:.8rem;font-weight:700;color:var(--text-2);margin-top:8px}</style>`));
  const selA = sec.querySelector("[data-a]"), selB = sec.querySelector("[data-b]");
  for (const s of [selA, selB]) s.innerHTML = COMPOUNDS.map((c, i) => `<option value="${i}">${pretty(c.f)}</option>`).join("");
  selA.value = 5; selB.value = 7;
  const out = sec.querySelector("[data-out]");
  const v = createViewer(st, { camera: [0, 3, 20], fitWidth: 9.5, autoRotate: false, minDistance: 8, maxDistance: 45 });
  const anim = buildMix(v, st, ctl);
  let res = null;
  const showOut = (guess) => {
    const goes = !res.none;
    const verdict = guess == null ? "" : (+guess === (goes ? 1 : 0) ? "<b style='color:var(--good)'>Прогноз верный!</b> " : "<b style='color:var(--bad)'>Прогноз не подтвердился.</b> ");
    out.hidden = false;
    out.innerHTML = res.none
      ? `<p class="mt0">${verdict}${res.none}</p>${res.molecFake ? `<p class="small muted">«Уравнение» ${res.molecFake.replace("→", "⇸")} писать не нужно.</p>` : ""}`
      : `<p class="mt0">${verdict}Признак: ${res.signs.join("; ")}.</p>
        <div class="lbl">Молекулярное</div><div class="eq">${res.molec}</div>
        <div class="lbl">Полное ионное</div><div class="eq">${res.full}</div>
        <div class="lbl">Сокращённое ионное</div><div class="eq">${res.net}</div>
        <p class="small muted" style="margin:0">${res.spect.length ? `Ионы-наблюдатели: ${res.spect.join(", ")}.` : "Ионов-наблюдателей нет: все ионы участвуют в реакции."}</p>`;
  };
  const update = () => {
    const A = COMPOUNDS[+selA.value], B = COMPOUNDS[+selB.value];
    res = exchange(A, B);
    out.hidden = true;
    sec.querySelectorAll("[data-g]").forEach((b) => b.classList.remove("on"));
    anim.load(A, B, res);
  };
  sec.querySelectorAll("[data-g]").forEach((b) => (b.onclick = () => {
    sec.querySelectorAll("[data-g]").forEach((x) => x.classList.toggle("on", x === b));
    showOut(b.dataset.g === "show" ? null : b.dataset.g);
  }));
  selA.onchange = selB.onchange = update;
  update();

  // ---------- таблица растворимости ----------
  const cats = Object.keys(SOL), ans = Object.keys(AN);
  const cell = (s) => (s === "" ? "<td class='muted'>H₂O</td>" : `<td class="sol-${{ "р": "r", "м": "m", "н": "n", "—": "x" }[s]}">${s}</td>`);
  el.appendChild(h(`<section id="table"><h2>Таблица растворимости (фрагмент)</h2>
    <div class="table-wrap"><table class="data sol-tab"><tr><th></th>${cats.map((c) => `<th>${ionName(CAT[c][2])}</th>`).join("")}</tr>
      ${ans.map((a) => `<tr><th>${ionName(AN[a][2])}</th>${cats.map((c) => cell(SOL[c][a])).join("")}</tr>`).join("")}
    </table></div>
    <p class="small muted">р — растворимо (больше 1 г в 100 г воды), м — малорастворимо (0,01–1 г), н — нерастворимо (меньше 0,01 г), «—» — в водном растворе не существует. Все соли натрия, калия, аммония и все нитраты растворимы.</p>
    <style>.sol-tab td,.sol-tab th{text-align:center;padding:6px 8px}.sol-tab .sol-n{color:var(--bad);font-weight:800}.sol-tab .sol-m{color:var(--warn,#e0a030);font-weight:800}.sol-tab .sol-r{color:var(--good)}</style>
  </section>`));

  el.appendChild(h(`<section id="reverse"><h2>Обратная задача и качественные реакции</h2>
    <p>Часто дают сокращённое уравнение и просят подобрать молекулярное. Рецепт: к каждому иону слева «пристрой» такой противоион, чтобы вещество было <b>растворимым сильным электролитом</b>, а противоионы не давали осадка между собой.</p>
    <div class="card pad"><p class="mt0"><b>Пример.</b> Cu²⁺ + 2OH⁻ → Cu(OH)₂↓</p>
      <p class="small" style="margin-bottom:0">Cu²⁺ возьмём из CuSO₄ или CuCl₂, OH⁻ — из NaOH или KOH: <span class="formula">CuSO₄ + 2NaOH → Cu(OH)₂↓ + Na₂SO₄</span>. А вот Cu(OH)₂ + … не подойдёт: гидроксид меди нерастворим и ионов Cu²⁺ «свободно» не даёт.</p></div>
    <p>На сокращённых уравнениях основаны <b>качественные реакции</b> — способы узнать ион по яркому признаку:</p>
    <div class="table-wrap"><table class="data">
      <tr><th>Определяемый ион</th><th>Реактив</th><th>Признак</th></tr>
      <tr><td>Cl⁻</td><td>AgNO₃ (Ag⁺)</td><td>белый творожистый осадок AgCl</td></tr>
      <tr><td>SO₄²⁻</td><td>BaCl₂ (Ba²⁺)</td><td>белый осадок BaSO₄, не растворяется в кислотах</td></tr>
      <tr><td>CO₃²⁻</td><td>кислота (H⁺)</td><td>«вскипание» — пузырьки CO₂, газ мутит известковую воду</td></tr>
      <tr><td>PO₄³⁻</td><td>AgNO₃ (Ag⁺)</td><td>жёлтый осадок Ag₃PO₄</td></tr>
      <tr><td>NH₄⁺</td><td>щёлочь (OH⁻), нагрев</td><td>запах аммиака, влажная лакмусовая бумажка синеет</td></tr>
      <tr><td>Cu²⁺</td><td>щёлочь</td><td>голубой осадок Cu(OH)₂</td></tr>
      <tr><td>Fe³⁺</td><td>щёлочь</td><td>бурый осадок Fe(OH)₃</td></tr>
    </table></div>
    <p class="small muted">Повторить, что такое электролиты и как они диссоциируют, можно в уроке <a href="#lesson-electrolytes">«Электролитическая диссоциация»</a>.</p>
  </section>`));
}

// ---------- 3D: смешивание растворов ----------
function buildMix(v, st, ctl) {
  const kit = makeKit();
  const root = new THREE.Group();
  v.scene.add(root);
  const range = ctl.querySelector("input");
  let parts = [], units = [], t = 0, playing = false, time = 0, info = null;
  const PRODUCT_MODEL = { H2O: PRODUCTS.H2O, CO2: PRODUCTS.CO2, NH3: PRODUCTS.NH3, H3PO4: PRODUCTS.H3PO4 };

  function load(A, B, res) {
    v.clear(root);
    parts = []; units = [];
    t = 0; playing = false; range.value = 0;
    info = res;
    const R = rng(11);
    const per = A.n + A.m + B.n + B.m;
    const kA = res.k ? res.k[0] : 1, kB = res.k ? res.k[1] : 1;
    const perEq = kA * (A.n + A.m) + kB * (B.n + B.m);
    const mult = Math.max(1, Math.min(4, Math.floor(28 / (res.k ? perEq : per))));
    const add = (id, side) => {
      const g = ionGroup(kit, id, { labelSize: 0.42 });
      root.add(g);
      const s = side < 0 ? [-6.5 + (R() - 0.5) * 4.5, (R() - 0.5) * 5, (R() - 0.5) * 4] : [6.5 + (R() - 0.5) * 4.5, (R() - 0.5) * 5, (R() - 0.5) * 4];
      const m = [(R() - 0.5) * 15, (R() - 0.5) * 6 + 0.5, (R() - 0.5) * 5];
      parts.push({ id, g, s, m, ph: R() * 6.28, used: false });
    };
    for (let i = 0; i < kA * mult; i++) { for (let j = 0; j < A.n; j++) add(CAT[A.c][2], -1); for (let j = 0; j < A.m; j++) add(AN[A.a][2], -1); }
    for (let i = 0; i < kB * mult; i++) { for (let j = 0; j < B.n; j++) add(CAT[B.c][2], 1); for (let j = 0; j < B.m; j++) add(AN[B.a][2], 1); }
    const take = (id, n) => {
      const out = [];
      for (const p of parts) if (!p.used && p.id === id && out.length < n) { p.used = true; out.push(p); }
      return out;
    };
    let slot = 0;
    const slotPos = () => {
      const i = slot++;
      const layer = Math.floor(i / 12), r = i % 12;
      return [(r % 4 - 1.5) * 2.1 + (layer % 2) * 1.05, -3.8 + layer * 1.9, (Math.floor(r / 4) - 1) * 2.1];
    };
    if (res.k) {
      const [, , k3, k4] = res.k;
      for (const [X, kx] of [[res.P, k3], [res.Q, k4]]) {
        if (X.type === "sol") continue;
        for (let u = 0; u < kx * mult; u++) {
          const cs = take(CAT[X.c][2], X.e), as = take(AN[X.a][2], X.f);
          const members = [...cs, ...as];
          if (X.type === "ppt") {
            // ионы встают в «решётку» осадка на дне, чередуясь
            const seq = [];
            for (let i = 0; i < Math.max(cs.length, as.length); i++) { if (cs[i]) seq.push(cs[i]); if (as[i]) seq.push(as[i]); }
            seq.forEach((p) => { p.target = slotPos(); p.kind = "ppt"; });
            continue;
          }
          const c = members.reduce((acc, p) => acc.map((x, i) => x + p.m[i] / members.length), [0, 0, 0]);
          const prods = X.species.map(([sp], i) => {
            const g = ballStick(kit, PRODUCT_MODEL[sp]().atoms, PRODUCT_MODEL[sp]().bonds, { bondR: 0.07 });
            g.scale.setScalar(0.001);
            root.add(g);
            return { g, gas: X.species[i][2] === "↑", off: [i * 1.6 - 0.8, 0, 0] };
          });
          members.forEach((p) => { p.target = c; p.kind = "merge"; });
          units.push({ c, prods, rot: R() * 6.28 });
        }
      }
    }
    // Подписи сосудов
    st.querySelector("[data-title]").innerHTML = `${pretty(A.f)} + ${pretty(B.f)}`;
    st.querySelector("[data-legend]").innerHTML = res.none ? "ионы только перемешиваются" : res.signs.map((s) => s.split(" (")[0].split(" —")[0]).join("<br>");
    apply();
  }
  function apply() {
    const pMix = easeInOut(seg(t, 0, 0.3)), pGo = easeInOut(seg(t, 0.3, 0.62)), pProd = easeInOut(seg(t, 0.62, 1));
    for (const p of parts) {
      const j = 0.18;
      const jig = [Math.sin(time * 1.3 + p.ph) * j, Math.cos(time * 1.1 + p.ph * 2) * j, Math.sin(time * 0.9 + p.ph * 3) * j];
      let pos = lerpV(p.s, p.m, pMix);
      if (p.target) pos = lerpV(pos, p.target, pGo);
      const damp = p.kind === "ppt" ? 1 - pGo * 0.9 : 1;
      p.g.position.set(pos[0] + jig[0] * damp, pos[1] + jig[1] * damp, pos[2] + jig[2] * damp);
      const vis = p.kind === "merge" ? 1 - seg(t, 0.62, 0.7) : 1;
      p.g.scale.setScalar(Math.max(0.001, vis));
      p.g.visible = vis > 0.01;
    }
    for (const u of units) {
      u.prods.forEach((pr, i) => {
        const appear = easeInOut(seg(t, 0.62, 0.72));
        const rise = pr.gas ? pProd * 10 : 0;
        pr.g.position.set(u.c[0] + pr.off[0], u.c[1] + rise + (pr.gas ? 0 : Math.sin(time + i) * 0.15), u.c[2] + pr.off[2]);
        const fade = pr.gas ? 1 - seg(t, 0.9, 1) : 1;
        pr.g.scale.setScalar(Math.max(0.001, appear * fade));
        pr.g.rotation.set(time * 0.6 + u.rot, time * 0.4, 0);
      });
    }
    st.querySelector("[data-phase]").textContent = t < 0.02 ? "два раствора: слева и справа" : t < 0.3 ? "растворы смешиваются" : info?.none ? "ионы так и остались в растворе" : t < 0.62 ? "ионы встречаются и связываются" : "продукты уходят из раствора";
  }
  range.oninput = () => { playing = false; t = +range.value; apply(); };
  ctl.querySelector("[data-play]").onclick = () => { if (t >= 0.999) t = 0; playing = true; };
  v.onFrame((dt) => {
    time += dt;
    if (playing) { t = Math.min(1, t + dt / 7); range.value = t; if (t >= 1) playing = false; }
    apply();
  });
  return { load };
}

export const quiz = [
  { q: "Какая пара ионов не может одновременно находиться в растворе в заметных количествах?", options: ["Na⁺ и Cl⁻", "Ba²⁺ и SO₄²⁻", "K⁺ и NO₃⁻", "Cu²⁺ и Cl⁻"], answer: 1, why: "Они связываются в нерастворимый BaSO₄." },
  { q: "Сокращённое ионное уравнение H⁺ + OH⁻ → H₂O соответствует реакции…", options: ["Cu(OH)₂ + 2HCl", "NaOH + HNO₃", "Ba(OH)₂ + H₂SO₄", "NH₃ + HCl"], answer: 1, why: "NaOH и HNO₃ — сильные растворимые электролиты; Cu(OH)₂ нерастворим, а в случае Ba(OH)₂ + H₂SO₄ ещё и выпадает BaSO₄." },
  { q: "Сумма всех коэффициентов в сокращённом ионном уравнении Na₂CO₃ + 2HCl:", options: ["3", "4", "5", "6"], answer: 2, why: "2H⁺ + CO₃²⁻ → CO₂ + H₂O: 2 + 1 + 1 + 1 = 5." },
  { q: "Какие ионы — наблюдатели в реакции AgNO₃ + NaCl?", options: ["Ag⁺ и Cl⁻", "Na⁺ и NO₃⁻", "Ag⁺ и Na⁺", "все четыре"], answer: 1, why: "Ag⁺ и Cl⁻ уходят в осадок AgCl, а Na⁺ и NO₃⁻ остаются в растворе без изменений." },
  { q: "Реакция обмена НЕ идёт между растворами…", options: ["CuSO₄ и NaOH", "Na₂CO₃ и H₂SO₄", "KNO₃ и NaCl", "FeCl₃ и KOH"], answer: 2, why: "Все возможные продукты растворимы — ни осадка, ни газа, ни воды." },
  { q: "Реактив на сульфат-ион SO₄²⁻:", options: ["AgNO₃", "BaCl₂", "фенолфталеин", "HCl"], answer: 1, why: "Ионы Ba²⁺ дают белый осадок BaSO₄, нерастворимый даже в кислотах." },
];
