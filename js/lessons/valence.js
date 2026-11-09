import { h, kid, term, stage, chips } from "../ui.js";
import { createViewer } from "../three/core.js";
import { createMolecule, frame } from "../three/molecule.js";
import { buildCentral, lonePairMeshes } from "../three/valence-vsepr.js";
import { pretty, fmt, molarMass } from "../chem.js";

const ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII"];
const gcd = (a, b) => (b ? gcd(b, a % b) : a);
const lcm = (a, b) => (a * b) / gcd(a, b);
const idx = (n) => (n > 1 ? n : "");

// Центральные атомы: символ, валентность, валентные электроны (для числа неподелённых пар)
const CENTERS = [
  { el: "C", v: 4, ve: 4, name: "углерод" }, { el: "Si", v: 4, ve: 4, name: "кремний" },
  { el: "N", v: 3, ve: 5, name: "азот" }, { el: "P", v: 3, ve: 5, name: "фосфор" }, { el: "P", v: 5, ve: 5, name: "фосфор" },
  { el: "O", v: 2, ve: 6, name: "кислород" }, { el: "S", v: 2, ve: 6, name: "сера" }, { el: "S", v: 4, ve: 6, name: "сера" }, { el: "S", v: 6, ve: 6, name: "сера" },
  { el: "B", v: 3, ve: 3, name: "бор" },
];
const LIGANDS = [{ el: "H", v: 1 }, { el: "F", v: 1 }, { el: "Cl", v: 1 }, { el: "O", v: 2 }];
// Реальные углы и примечания (ключ — формула)
const REAL = {
  CH4: ["метан", 109.5], SiH4: ["силан", 109.5], CF4: ["тетрафторметан", 109.5], CCl4: ["тетрахлорметан", 109.5], SiF4: ["фторид кремния(IV)", 109.5], SiCl4: ["хлорид кремния(IV)", 109.5],
  CO2: ["углекислый газ", 180], NH3: ["аммиак", 107], NF3: ["фторид азота(III)", 102], NCl3: ["хлорид азота(III)", 107], PH3: ["фосфин", 93.5], PF3: ["фторид фосфора(III)", 97.7], PCl3: ["хлорид фосфора(III)", 100],
  PF5: ["фторид фосфора(V)", 90], PCl5: ["хлорид фосфора(V)", 90], H2O: ["вода", 104.5], OF2: ["фторид кислорода", 103], Cl2O: ["оксид хлора(I)", 111],
  H2S: ["сероводород", 92], SF2: ["фторид серы(II)", 98], SCl2: ["хлорид серы(II)", 103], SO2: ["сернистый газ", 119], SF4: ["фторид серы(IV)", 102], SCl4: ["хлорид серы(IV) — неустойчив, разлагается выше −30 °C", 102],
  SO3: ["серный ангидрид", 120], SF6: ["гексафторид серы", 90], BF3: ["трифторид бора", 120], BCl3: ["трихлорид бора", 120], BH3: ["боран — на деле существует как димер B₂H₆", 120],
};
const NOT_EXIST = { PH5: "PH₅ не существует: валентность V фосфор проявляет только с сильными окислителями (F, Cl, O).", H6S: "SH₆ не существует.", H4S: "SH₄ не существует.", SCl6: "SCl₆ не существует: шесть крупных атомов хлора не помещаются вокруг серы.", SO: "Молекула SO неустойчива.", O2: "Это простое вещество O₂ — валентность там не «центральная».", OO: "" };

// Формула AₓBᵧ по валентностям (метод «крест-накрест» через НОК)
function cross(A, va, B, vb) {
  const L = lcm(va, vb);
  const x = L / va, y = L / vb;
  // порядок: менее электроотрицательный первым (H пишем первым с неметаллами VI–VII групп)
  const hFirst = B === "H" && ["O", "S", "F", "Cl"].includes(A);
  let f = hFirst ? `${B}${idx(y)}${A}${idx(x)}` : `${A}${idx(x)}${B}${idx(y)}`;
  if (f === "OCl2") f = "Cl2O";
  return { x, y, L, f };
}

function build(c, L) {
  const { x, y, f } = cross(c.el, c.v, L.el, L.v);
  if (c.el === L.el) return { f, status: "same" };
  if (NOT_EXIST[f]) return { f, status: "none", note: NOT_EXIST[f] };
  if (x !== 1) return { f, status: "multi", note: `В ${pretty(f)} не один центральный атом: на ${x} атома ${c.el} приходится ${y} ${y < 5 ? "атома" : "атомов"} ${L.el}. ${c.el === "Si" || c.el === "B" || c.el === "P" ? "Это твёрдое вещество" : "Это молекула"} посложнее — формулу мы нашли, а модель здесь не строим.` };
  if (c.el === "Si" && L.el === "O") return { f, status: "none", note: "SiO₂ (кварц, песок) — не молекула, а кристалл: каждый атом Si связан с четырьмя атомами O, каждый O — с двумя Si." };
  const real = REAL[f];
  if (!real) return { f, status: "none", note: "Такое вещество не получено." };
  const lp = (c.ve - c.v) / 2;
  const order = L.v; // кратность связи
  const ligs = Array.from({ length: y }, () => ({ el: L.el, order }));
  return { f, status: "ok", name: real[0], angle: real[1], data: buildCentral(c.el, ligs, lp, real[1]), lp };
}

// Графическая формула для простых молекул
function graphic(c, L, n) {
  const b = L.v === 2 ? "=" : "–";
  if (n === 1) return `${c.el}${b}${L.el}`;
  if (n === 2) return `${L.el}${b}${c.el}${b}${L.el}`;
  return `${c.el} и ${n} ${n < 5 ? "связи" : "связей"} «${b}» с атомами ${L.el}`;
}

export async function render(el) {
  el.appendChild(h(`<div>
    <p class="lead">Почему вода — H₂O, а не HO или H₃O? Почему у метана четыре атома водорода, а у аммиака три? Всё определяет ${term("valency", "валентность")} — число химических связей, которые атом образует с другими атомами.</p>
    ${kid("Представь, что у каждого атома есть «руки». У водорода одна рука, у кислорода две, у азота три, у углерода четыре. В молекуле все руки должны быть заняты: каждая держит руку соседа. Вода H₂O: кислород держит двумя руками два водорода — и все довольны!")}
  </div>`));

  el.appendChild(h(`<section id="what"><h2>Что такое валентность</h2>
    <p><b>Валентность</b> — способность атома образовывать определённое число химических связей. Её обозначают римской цифрой над символом: H<sup>I</sup>, O<sup>II</sup>, N<sup>III</sup>, C<sup>IV</sup>. За единицу принята валентность водорода: он всегда образует одну связь.</p>
    <div class="grid-2">
      <div class="card pad"><b>Постоянная валентность</b>
        <p class="small" style="margin:8px 0 0">I — H, Li, Na, K, F, Ag<br>II — O, Be, Mg, Ca, Ba, Zn<br>III — B, Al</p></div>
      <div class="card pad"><b>${term("variable_valence", "Переменная валентность")}</b>
        <p class="small" style="margin:8px 0 0">Fe — II, III · Cu — I, II · Cr — II, III, VI<br>S — II, IV, VI · C — II, IV · N — I…IV<br>P — III, V · Cl — I, III, V, VII</p></div>
    </div>
    <p>Высшая валентность элемента главной подгруппы обычно равна номеру его группы (S в VI группе — до VI), а валентность по водороду у неметаллов = 8 − номер группы (S: 8 − 6 = II, отсюда H₂S).</p>
    <p class="adv">Почему так? Связь — это общая пара электронов. Атом образует столько связей, сколько у него неспаренных электронов на внешнем уровне (или может «распарить» при возбуждении). У кислорода 2 неспаренных электрона → валентность II; у серы есть свободные 3d-орбитали, поэтому пары могут распариваться → IV и VI.</p>
  </section>`));

  // ---------- конструктор ----------
  const s2 = h(`<section id="builder"><h2>Конструктор молекул по валентности</h2>
    <p>Выбери центральный атом и его валентность, а потом «соседа». Программа найдёт формулу (все «руки» заняты) и построит 3D-модель с реальными углами. Голубые облачка — неподелённые пары электронов: они не образуют связей, но занимают место и сжимают углы.</p></section>`);
  el.appendChild(s2);
  const pick = h(`<div class="card pad" style="margin-bottom:10px"><div class="small muted">Центральный атом:</div><div data-c></div><div class="small muted" style="margin-top:8px">Присоединяем:</div><div data-l></div></div>`);
  s2.appendChild(pick);
  const st = stage(`<div class="overlay"><span data-a style="font-size:1rem"></span><span data-b style="text-align:right"></span></div>`, { wide: true });
  s2.appendChild(st);
  const info = h(`<div class="card pad" style="margin-top:10px"><p data-msg style="margin:0"></p></div>`);
  s2.appendChild(info);
  const v = createViewer(st, { camera: [0, 1.5, 9], minDistance: 3, maxDistance: 30, autoRotateSpeed: 0.7 });
  const mol = createMolecule(v, buildCentral("C", [{ el: "H" }, { el: "H" }, { el: "H" }, { el: "H" }]));
  let lpGroup = null;
  let C = CENTERS[0], L = LIGANDS[0];
  const upd = () => {
    const r = build(C, L);
    const { x, y, L: N } = cross(C.el, C.v, L.el, L.v);
    if (lpGroup) { v.clear(lpGroup); v.scene.remove(lpGroup); lpGroup = null; }
    const calc = `${C.el}<sup>${ROMAN[C.v]}</sup> и ${L.el}<sup>${ROMAN[L.v]}</sup>: НОК(${C.v}, ${L.v}) = ${N}; ${N} : ${C.v} = ${x}, ${N} : ${L.v} = ${y}`;
    st.querySelector("[data-a]").innerHTML = `<b class="formula">${pretty(r.f)}</b>`;
    if (r.status === "ok") {
      mol.group.visible = true;
      mol.set(r.data);
      lpGroup = lonePairMeshes(r.data);
      mol.group.add(lpGroup);
      frame(v, mol.radius() + 0.4);
      st.querySelector("[data-b]").innerHTML = `${r.name}<br>угол ${{ PCl5: "90° и 120°", PF5: "90° и 120°", SF4: "≈102° и 173°", SCl4: "≈102° и 173°" }[r.f] ?? fmt(r.angle, 1) + "°"} · неподел. пар: ${r.lp}`;
      let M = ""; try { M = ` · M = ${fmt(molarMass(r.f).mass, 1)} г/моль`; } catch {}
      info.querySelector("[data-msg]").innerHTML = `${calc}. <b>Формула ${pretty(r.f)}</b>${M}. Графически: <span class="formula">${graphic(C, L, y)}</span>. ${L.v === 2 ? "Кислород двухвалентен, поэтому связи двойные." : ""}`;
    } else {
      mol.group.visible = false;
      st.querySelector("[data-b]").textContent = r.status === "same" ? "простое вещество" : "модель не строим";
      info.querySelector("[data-msg]").innerHTML = r.status === "same" ? "Выбери другой атом-соседа: здесь центральный и присоединяемый атомы одинаковые." : `${calc}. ${r.note}`;
    }
  };
  chips(pick.querySelector("[data-c]"), CENTERS.map((c) => ({ ...c, label: `${c.el} (${ROMAN[c.v]})` })), (c) => { C = c; upd(); });
  chips(pick.querySelector("[data-l]"), LIGANDS.map((l) => ({ ...l, label: `${l.el} (${ROMAN[l.v]})` })), (l) => { L = l; upd(); });
  upd();
  s2.appendChild(h(`<p class="small muted">Попробуй: N(III) + H → аммиак, «зонтик» с углом 107°; S(VI) + O → SO₃, плоский треугольник; P(V) + Cl → PCl₅, двойная пирамида; S(IV) + F → SF₄, «качели».</p>`));

  // ---------- определить валентность ----------
  el.appendChild(h(`<section id="find"><h2>Валентность по формуле</h2>
    <p>Если известна валентность одного элемента (чаще всего кислорода — II), легко найти валентность другого. Правило: <b>число единиц валентности у всех атомов одного элемента равно числу единиц у атомов другого</b>.</p>
    <div class="eq">Fe₂O₃: &nbsp; O — II, всего 3 · II = 6 &nbsp;→&nbsp; Fe: 6 : 2 = III</div>
    <div class="eq">Cl₂O₇: &nbsp; 7 · II = 14 &nbsp;→&nbsp; Cl: 14 : 2 = VII</div>
    <div class="eq">CH₄: &nbsp; 4 · I = 4 &nbsp;→&nbsp; C: IV</div>
    ${kid("Это как разделить конфеты поровну: у трёх атомов кислорода всего 6 «рук». Их держат два атома железа — значит, у каждого железа по 3 руки.")}
  </section>`));

  // ---------- тренажёр ----------
  const TASKS = [
    ["Al", 3, "O", 2], ["Na", 1, "O", 2], ["Ca", 2, "Cl", 1], ["Fe", 3, "Cl", 1], ["Fe", 2, "O", 2], ["Fe", 3, "O", 2], ["P", 5, "O", 2], ["N", 4, "O", 2],
    ["S", 6, "O", 2], ["Cu", 1, "O", 2], ["Mg", 2, "N", 3], ["Al", 3, "S", 2], ["C", 4, "S", 2], ["Cl", 7, "O", 2], ["Ca", 2, "P", 3], ["K", 1, "S", 2],
    ["Si", 4, "H", 1], ["Ba", 2, "O", 2], ["Cr", 3, "O", 2], ["Mn", 7, "O", 2], ["Li", 1, "N", 3], ["Zn", 2, "Br", 1], ["N", 5, "O", 2], ["Al", 3, "C", 4],
  ];
  const s4 = h(`<section id="trainer"><h2>Тренажёр «крест-накрест»</h2>
    <p>Как составить формулу по валентностям: 1) напиши символы и над ними валентности; 2) найди наименьшее общее кратное (НОК); 3) раздели НОК на валентность каждого элемента — получишь индексы. Короткий путь — «крест-накрест»: валентность одного становится индексом другого (и сокращаем, если можно): Al<sup>III</sup>O<sup>II</sup> → Al₂O₃.</p>
    <div class="card pad val-tr">
      <div class="row" style="justify-content:space-between"><b data-num></b><button class="btn small" type="button" data-next>Следующее →</button></div>
      <div class="val-f" data-f></div>
      <p data-msg style="text-align:center;margin:10px 0 0;font-weight:700"></p>
      <div class="row" style="justify-content:center;margin-top:10px"><button class="btn small primary" type="button" data-check>Проверить</button><button class="btn small" type="button" data-hint>Подсказка</button></div>
      <p class="small muted" style="text-align:center;margin:10px 0 0">Счёт: <b data-score>0</b></p>
    </div>
    <style>
      .val-tr .val-f{display:flex;justify-content:center;align-items:flex-end;gap:18px;margin-top:14px;flex-wrap:wrap}
      .val-tr .val-el{display:grid;justify-items:center;gap:4px}
      .val-tr .val-el sup{font-size:.9rem;color:var(--accent);font-weight:800}
      .val-tr .val-el .s{font-family:var(--mono);font-size:2rem;font-weight:800;line-height:1}
      .val-tr .val-el .ix{display:flex;align-items:center;gap:6px}
      .val-tr .val-el .ix b{min-width:1.4em;text-align:center;font-size:1.2rem}
      .val-tr .val-el button{width:30px;height:30px;border-radius:8px;border:1px solid var(--line-2);background:var(--surface-2);color:var(--text);cursor:pointer;font-weight:800}
    </style>
  </section>`);
  el.appendChild(s4);
  let ti = Math.floor(Math.random() * TASKS.length), ix = [1, 1], score = 0, done = false;
  const draw = (msg = "") => {
    const [A, va, B, vb] = TASKS[ti];
    s4.querySelector("[data-num]").textContent = `Составь формулу`;
    s4.querySelector("[data-f]").innerHTML = [[A, va], [B, vb]].map(([e, val], k) => `<div class="val-el"><sup>${ROMAN[val]}</sup><span class="s">${e}<sub style="font-size:1.1rem">${ix[k] > 1 ? ix[k] : ""}</sub></span><span class="ix"><button type="button" data-k="${k}" data-d="-1" aria-label="меньше">−</button><b>${ix[k]}</b><button type="button" data-k="${k}" data-d="1" aria-label="больше">+</button></span></div>`).join("");
    s4.querySelector("[data-msg]").innerHTML = msg;
  };
  s4.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    const [A, va, B, vb] = TASKS[ti];
    const c = cross(A, va, B, vb);
    if (b.dataset.k != null) { const k = +b.dataset.k; ix[k] = Math.max(1, Math.min(9, ix[k] + +b.dataset.d)); draw(); }
    if ("next" in b.dataset) { ti = (ti + 1 + Math.floor(Math.random() * 5)) % TASKS.length; ix = [1, 1]; done = false; draw(); }
    if ("hint" in b.dataset) draw(`<span class="muted">НОК(${va}, ${vb}) = ${c.L}. Индекс ${A}: ${c.L} : ${va}; индекс ${B}: ${c.L} : ${vb}.</span>`);
    if ("check" in b.dataset) {
      const ok = ix[0] === c.x && ix[1] === c.y;
      const sameRatio = ix[0] * c.y === ix[1] * c.x;
      if (ok && !done) { score++; done = true; }
      s4.querySelector("[data-score]").textContent = score;
      draw(ok ? `<span style="color:var(--good)">Верно! ${pretty(`${A}${idx(c.x)}${B}${idx(c.y)}`)}: ${c.x}·${va} = ${c.y}·${vb} = ${c.L} 🎉</span>`
        : sameRatio ? `<span style="color:var(--warn)">Соотношение верное, но индексы можно сократить.</span>`
        : `<span style="color:var(--bad)">Проверь: у ${A} ${ix[0]}·${va} = ${ix[0] * va} единиц валентности, у ${B} ${ix[1]}·${vb} = ${ix[1] * vb}. Они должны быть равны.</span>`);
    }
  });
  draw();

  el.appendChild(h(`<section id="indices"><h2>Индексы, коэффициенты и графические формулы</h2>
    <p><b>${term("formula_index", "Индекс")}</b> — маленькая цифра справа внизу: сколько атомов элемента в одной частице вещества. <b>Коэффициент</b> — большая цифра перед формулой: сколько таких частиц. Запись 3H₂O означает три молекулы воды, в них 6 атомов водорода и 3 атома кислорода.</p>
    <p>${term("structural_formula", "Графическая (структурная) формула")} показывает, кто с кем связан, — каждая чёрточка это одна связь (одна единица валентности):</p>
    <div class="eq">H–O–H &nbsp;&nbsp; O=C=O &nbsp;&nbsp; H–C≡N &nbsp;&nbsp; N≡N</div>
    <div class="callout"><b>Важно:</b> правило «крест-накрест» даёт формулу, но не доказывает, что вещество существует, и не работает для веществ, где атомы одного элемента связаны между собой: в пероксиде водорода H–O–O–H кислород двухвалентен, хотя формула H₂O₂ «подсказывает» I. Валентность — про связи, а не про индексы.</div>
  </section>`));
}

export const quiz = [
  { q: "Какова валентность азота в аммиаке NH₃?", options: ["I", "II", "III", "IV"], answer: 2, why: "Три атома водорода (по I) — значит, у азота III." },
  { q: "Формула соединения алюминия (III) с кислородом:", options: ["AlO", "Al₃O₂", "Al₂O₃", "AlO₃"], answer: 2, why: "НОК(3, 2) = 6: Al — 6 : 3 = 2, O — 6 : 2 = 3." },
  { q: "Валентность железа в Fe₂O₃:", options: ["II", "III", "VI", "I"], answer: 1, why: "3 · II = 6 единиц, делим на 2 атома Fe → III." },
  { q: "У какого элемента валентность всегда I?", options: ["кислород", "углерод", "водород", "сера"], answer: 2, why: "Водород образует только одну связь." },
  { q: "Почему молекула CO₂ линейная, а H₂O — угловая?", options: ["Атомы разного размера", "У кислорода в воде две неподелённые пары, у углерода в CO₂ их нет", "Вода — жидкость", "Случайно"], answer: 1, why: "Неподелённые пары занимают место и «отгибают» связи." },
  { q: "Что означает запись 2H₂SO₄?", options: ["2 атома водорода", "2 молекулы серной кислоты", "4 молекулы", "2 атома серы в одной молекуле"], answer: 1, why: "Коэффициент 2 — число молекул, индексы — состав одной молекулы." },
];
