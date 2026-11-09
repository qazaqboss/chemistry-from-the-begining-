import { h, kid, term, stage, chips, esc } from "../ui.js";
import { createViewer, THREE, sphereGeo, glossy, textSprite, glowSprite } from "../three/core.js";
import { ELEMENTS } from "../data/elements.js";
import { layoutOf, CAT_COLORS } from "../periodic-layout.js";
import { fmt } from "../chem.js";

// Год открытия: null в данных — «известен с древности»
const yr = (e) => e.year ?? -Infinity;
const SORTED = ELEMENTS.slice().sort((a, b) => yr(a) - yr(b) || a.z - b.z);
const knownBy = (Y) => ELEMENTS.filter((e) => yr(e) <= Y);
const MIN_Y = 1600, MAX_Y = 2026;

const ERAS = [
  { label: "Древность", y: 1600, text: "До XVII века люди знали 11 элементов: 7 металлов древности (золото, серебро, медь, железо, олово, свинец, ртуть), углерод (уголь), серу, а также сурьму и мышьяк, описанные алхимиками." },
  { label: "Алхимики", y: 1700, text: "1669 год: гамбургский алхимик Хенниг Бранд искал «философский камень» в выпаренной моче и получил светящееся в темноте вещество — фосфор. Первое открытие элемента, автор и дата которого известны." },
  { label: "Лавуазье", y: 1789, text: "1789: Антуан Лавуазье публикует первый список простых веществ — 33 «элемента». В него попали и ошибки: свет, «теплород», известь и магнезия (позже оказавшиеся оксидами)." },
  { label: "Электролиз", y: 1808, text: "1807–1808: Гемфри Дэви пропускает ток через расплавы щелочей и получает калий, натрий, а затем кальций, магний, барий, стронций. Электричество разрывает связи, которые не берёт огонь." },
  { label: "Спектроскопия", y: 1868, text: "1860–1868: Бунзен и Кирхгоф изобретают спектральный анализ и по новым цветным линиям находят цезий и рубидий. В 1868 году гелий нашли в спектре Солнца — раньше, чем на Земле." },
  { label: "Менделеев", y: 1869, text: "1869: Д. И. Менделееву известно 63 элемента. Он расставляет их по периодическому закону и оставляет пустые клетки для неоткрытых." },
  { label: "Предсказания сбылись", y: 1886, text: "1875 — галлий, 1879 — скандий, 1886 — германий: открыты три элемента, свойства которых Менделеев предсказал заранее. Периодический закон признан всеми." },
  { label: "Газы и лучи", y: 1900, text: "1894–1898: Рэлей и Рамзай открывают целую новую группу — благородные газы (аргон, неон, криптон, ксенон). 1898: Мария и Пьер Кюри находят радиоактивные полоний и радий." },
  { label: "Синтез", y: 1955, text: "1937: первый искусственный элемент — технеций. С 1940 года в реакторах и ускорителях получают элементы тяжелее урана: нептуний, плутоний, а в 1955 — менделевий, названный в честь Менделеева." },
  { label: "Сегодня", y: 2026, text: "2010: синтезирован теннессин, и 7-й период заполнен. Пять последних элементов (114–118) впервые получены в Дубне, в Лаборатории Г. Н. Флёрова. Оганесон (118) назван в честь Ю. Ц. Оганесяна — второй элемент, названный при жизни учёного." },
];

function spiralScene(v, onPick) {
  const g = new THREE.Group();
  v.scene.add(g);
  const N = SORTED.length, H = 9;
  const items = SORTED.map((e, i) => {
    const a = i * 0.36, R = 3.4, y = -H / 2 + (i / (N - 1)) * H;
    const mat = glossy(new THREE.Color(CAT_COLORS[e.cat] || "#999"), { transparent: true });
    const m = new THREE.Mesh(sphereGeo(0.24, 20), mat);
    m.position.set(Math.cos(a) * R, y, Math.sin(a) * R);
    m.userData.el = e;
    g.add(m);
    const t = textSprite(e.sym, { size: 0.24, bg: "rgba(10,14,30,0.55)", font: 800 });
    t.position.copy(m.position).add(new THREE.Vector3(Math.cos(a) * 0.48, 0, Math.sin(a) * 0.48));
    g.add(t);
    return { e, m, t, s: 1, ts: 1 };
  });
  // «нить» времени
  const pts = items.map((it) => it.m.position.clone().multiplyScalar(0.9));
  g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x7fa8ff, transparent: true, opacity: 0.35 })));
  // метки веков — у первого элемента, открытого после рубежа
  for (const [Y, lab] of [[-Infinity, "древность"], [1700, "1700"], [1800, "1800"], [1850, "1850"], [1900, "1900"], [1950, "1950"], [2000, "2000"]]) {
    const it = items.find((x) => yr(x.e) >= Y);
    if (!it) continue;
    const s = textSprite(lab, { size: 0.32, color: "#ffd36b" });
    s.position.set(0, it.m.position.y, 0);
    g.add(s);
  }
  const glow = glowSprite(0xffe08a, 1.6, 0.9);
  g.add(glow);
  v.onFrame((dt) => {
    for (const it of items) {
      it.s += (it.ts - it.s) * Math.min(1, dt * 5);
      it.m.scale.setScalar(it.s);
      it.m.material.opacity = 0.15 + 0.85 * ((it.s - 0.45) / 0.55);
      it.t.material.opacity = it.m.material.opacity;
    }
  });
  const ray = new THREE.Raycaster(), ptr = new THREE.Vector2();
  v.renderer.domElement.addEventListener("click", (ev) => {
    const r = v.renderer.domElement.getBoundingClientRect();
    ptr.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ptr, v.camera);
    const hit = ray.intersectObjects(items.map((i) => i.m))[0];
    if (hit) { glow.position.copy(hit.object.position); onPick(hit.object.userData.el); }
  });
  return {
    setYear(Y) {
      let newest = null;
      for (const it of items) { const k = yr(it.e) <= Y; it.ts = k ? 1 : 0.45; if (k) newest = it; }
      if (newest) glow.position.copy(newest.m.position);
      return newest?.e;
    },
  };
}

function chartSVG() {
  const W = 600, Hh = 200, x = (Y) => 40 + ((Y - MIN_Y) / (MAX_Y - MIN_Y)) * (W - 55), y = (n) => Hh - 25 - (n / 118) * (Hh - 40);
  let d = `M${x(MIN_Y)},${y(knownBy(MIN_Y).length)}`;
  for (let Y = MIN_Y + 1; Y <= MAX_Y; Y++) d += ` H${x(Y)} V${y(knownBy(Y).length)}`;
  const ticks = [1600, 1700, 1800, 1900, 2000].map((Y) => `<line x1="${x(Y)}" x2="${x(Y)}" y1="${y(0)}" y2="${y(118)}" stroke="currentColor" opacity=".12"/><text x="${x(Y)}" y="${Hh - 6}" font-size="12" text-anchor="middle" fill="currentColor" opacity=".7">${Y}</text>`).join("");
  const yt = [0, 40, 80, 118].map((n) => `<text x="32" y="${y(n) + 4}" font-size="11" text-anchor="end" fill="currentColor" opacity=".7">${n}</text>`).join("");
  return `<svg viewBox="0 0 ${W} ${Hh}" width="100%" role="img" aria-label="Число известных элементов по годам">${ticks}${yt}
    <path d="${d}" fill="none" stroke="var(--accent)" stroke-width="2.5"/>
    <line data-mark x1="0" x2="0" y1="${y(0)}" y2="${y(118)}" stroke="var(--warn)" stroke-width="2"/>
    <circle data-dot r="5" fill="var(--warn)"/></svg>`;
}

export async function render(el) {
  el.appendChild(h(`<div>
    <p class="lead">Сегодня известно 118 химических элементов. Но ещё 400 лет назад люди знали лишь дюжину из них. Каждое открытие — это история: случайная находка алхимика, новый прибор, смелое предсказание или многолетняя работа целых лабораторий.</p>
    ${kid("Представь, что ты собираешь коллекцию наклеек, но не знаешь, сколько их всего. Учёные так и собирали элементы — по одному, за сотни лет. А Менделеев догадался, как устроен весь альбом, и показал, где пустые места!")}
  </div>`));

  // ---------- спираль ----------
  const s1 = h(`<section id="spiral"><h2>Спираль открытий</h2>
    <p>Каждый шарик — элемент, они выстроены по спирали в порядке открытия, снизу вверх. Цвет — семейство элемента, как в таблице. Двигай ползунок года: тусклые шарики ещё не открыты. Нажми на шарик — узнаешь, кто его открыл.</p></section>`);
  el.appendChild(s1);
  const st = stage(`<div class="overlay"><span data-a style="font-size:1rem"></span><span data-b style="text-align:right"></span></div>`, { wide: true });
  s1.appendChild(st);
  const ctl = h(`<div class="card pad" style="margin-top:10px">
    <label class="ctl">Год: <b data-yv></b><input type="range" min="${MIN_Y}" max="${MAX_Y}" step="1" value="1869"></label>
    <div data-eras style="margin-top:10px"></div>
    <p data-text style="margin:10px 0 0"></p>
    <p data-pick class="small muted" style="margin:6px 0 0"></p>
  </div>`);
  s1.appendChild(ctl);
  const v = createViewer(st, { camera: [0, 2.2, 16.5], autoRotateSpeed: 0.5, fitWidth: 4.8, maxDistance: 40 });
  const pickInfo = (e) => {
    ctl.querySelector("[data-pick]").innerHTML = `<b>${e.z}. ${esc(e.name)} (${e.sym})</b> — ${e.year ? `открыт в ${e.year} г.` : "известен с древности"}; ${esc(e.discoverer || "")}. <a href="#element-${e.z}">Карточка элемента →</a>`;
  };
  const sp = spiralScene(v, pickInfo);

  // ---------- мини-таблица и график ----------
  const tbl = h(`<div class="disc-pt" aria-label="Элементы, известные к выбранному году"></div>`);
  ELEMENTS.forEach((e) => {
    const { col, row } = layoutOf(e);
    tbl.appendChild(h(`<div class="disc-c" data-z="${e.z}" style="grid-column:${col};grid-row:${row + (row > 7 ? 1 : 0)}" title="${esc(e.name)} — ${e.year ?? "древность"}">${e.sym}</div>`));
  });
  const chart = h(`<div class="card pad" style="margin-top:12px"><b data-cnt></b><div data-svg style="color:var(--text-2)">${chartSVG()}</div></div>`);

  const upd = () => {
    const Y = +ctl.querySelector("input").value;
    const known = knownBy(Y);
    const newest = sp.setYear(Y);
    ctl.querySelector("[data-yv]").textContent = Y === MIN_Y ? "до 1600" : Y;
    st.querySelector("[data-a]").innerHTML = `<b>${Y === MIN_Y ? "до 1600" : Y + " год"}</b>`;
    st.querySelector("[data-b]").innerHTML = `известно <b>${known.length}</b> из 118${newest?.year ? `<br>последний: ${esc(newest.name)} (${newest.year})` : ""}`;
    const set = new Set(known.map((e) => e.z));
    tbl.querySelectorAll(".disc-c").forEach((c) => {
      const z = +c.dataset.z;
      c.classList.toggle("on", set.has(z));
      c.classList.toggle("new", set.has(z) && ELEMENTS[z - 1].year != null && ELEMENTS[z - 1].year > Y - 10);
    });
    chart.querySelector("[data-cnt]").textContent = `К ${Y === MIN_Y ? "1600" : Y} году известно элементов: ${known.length}`;
    const svg = chart.querySelector("svg");
    const X = 40 + ((Y - MIN_Y) / (MAX_Y - MIN_Y)) * 545, YY = 175 - (known.length / 118) * 160;
    svg.querySelector("[data-mark]").setAttribute("x1", X); svg.querySelector("[data-mark]").setAttribute("x2", X);
    svg.querySelector("[data-dot]").setAttribute("cx", X); svg.querySelector("[data-dot]").setAttribute("cy", YY);
    const era = ERAS.slice().reverse().find((e) => Y >= e.y) || ERAS[0];
    ctl.querySelector("[data-text]").textContent = era.text;
  };
  ctl.querySelector("input").oninput = upd;
  chips(ctl.querySelector("[data-eras]"), ERAS, (e) => { ctl.querySelector("input").value = e.y; upd(); }, 5);

  const s2 = h(`<section id="table"><h2>Таблица растёт</h2>
    <p>Та же картина в виде таблицы Менделеева: подсвечены элементы, известные к году на ползунке выше, а золотой рамкой — открытые за последние 10 лет. Видно, как заполнялись целые семейства: благородные газы — почти разом в 1890-е, лантаноиды — долгие 70 лет (их очень трудно отделить друг от друга).</p></section>`);
  el.appendChild(s2);
  s2.appendChild(tbl);
  s2.appendChild(chart);
  s2.appendChild(h(`<style>
    .disc-pt{display:grid;grid-template-columns:repeat(18,1fr);gap:2px;margin-top:10px}
    .disc-c{aspect-ratio:1;display:grid;place-items:center;font-size:clamp(7px,1.15vw,12px);font-weight:700;border-radius:4px;background:var(--surface);border:1px solid var(--line);color:var(--text-3);opacity:.45;transition:background .3s,opacity .3s}
    .disc-c.on{background:color-mix(in srgb,var(--accent) 30%,var(--surface));color:var(--text);opacity:1}
    .disc-c.new{outline:2px solid var(--warn);outline-offset:-1px}
  </style>`));
  upd();

  // ---------- методы ----------
  el.appendChild(h(`<section id="methods"><h2>Как находили новые элементы</h2>
    <div class="table-wrap"><table class="data">
      <tr><th>Метод</th><th>Что делали</th><th>Примеры</th></tr>
      <tr><td>Выплавка из руд</td><td>руду нагревали с углём, металл восстанавливался</td><td>Cu, Fe, Sn, Pb — древность; Co, Ni — XVIII век</td></tr>
      <tr><td>Анализ газов</td><td>собирали газы, выделяющиеся в реакциях</td><td>H (Кавендиш), O (Шееле, Пристли), N, Cl</td></tr>
      <tr><td>Электролиз</td><td>ток разлагал расплавы, которые не разлагал огонь</td><td>K, Na, Ca, Mg, Ba (Дэви), F (Муассан, 1886)</td></tr>
      <tr><td>${term("spectral_analysis", "Спектральный анализ")}</td><td>новые линии в спектре пламени или Солнца</td><td>Cs, Rb, Tl, In, He</td></tr>
      <tr><td>Радиохимия</td><td>следили за излучением при разделении руды</td><td>Po, Ra (Кюри), Rn, Ac</td></tr>
      <tr><td>Ядерный синтез</td><td>облучали ядра нейтронами или ионами в ускорителе</td><td>Tc, Pu, Md … Og — ${term("synthetic_element", "синтезированные элементы")}</td></tr>
    </table></div>
    <p>${term("alchemy", "Алхимики")} так и не превратили свинец в золото, но придумали перегонку, кристаллизацию и множество приборов — без них не было бы химии. Кстати, превращение элементов всё-таки возможно: это ядерные реакции, но в золото так выгоднее не превращать — оно получится дороже настоящего.</p>
  </section>`));

  el.appendChild(h(`<section id="mendeleev"><h2>Предсказание Менделеева</h2>
    <p>В 1871 году Менделеев описал ещё не открытый элемент под кремнием и назвал его «экасилицием». Через 15 лет Клеменс Винклер нашёл в минерале аргиродите новый элемент — германий. Сравни:</p>
    <div class="table-wrap"><table class="data">
      <tr><th>Свойство</th><th>Экасилиций (прогноз 1871)</th><th>Германий (опыт 1886)</th></tr>
      <tr><td>Атомная масса</td><td>≈ 72</td><td>72,6</td></tr>
      <tr><td>Плотность, г/см³</td><td>5,5</td><td>5,35</td></tr>
      <tr><td>Формула оксида</td><td>EsO₂, плотность 4,7</td><td>GeO₂, плотность 4,7</td></tr>
      <tr><td>Хлорид</td><td>EsCl₄, жидкость, кипит ниже 100 °C</td><td>GeCl₄, кипит при 84 °C</td></tr>
    </table></div>
    <div class="callout"><b>Важно:</b> сила научного закона — в предсказаниях. Менделеев не просто упорядочил известные элементы, а точно описал неизвестные. Когда прогнозы сбылись, периодический закон стал фундаментом всей химии.</div>
    ${kid("Это как в пазле: по форме пустого места и картинке вокруг можно догадаться, какая деталь там должна быть, ещё до того, как ты её нашёл.")}
  </section>`));

  el.appendChild(h(`<section id="names"><h2>Откуда берутся названия</h2>
    <ul>
      <li><b>По свойствам:</b> водород — «рождающий воду», хлор — «жёлто-зелёный» (греч.), фосфор — «несущий свет», бром — «зловонный».</li>
      <li><b>По странам и городам:</b> галлий (Франция), германий, рутений (лат. Ruthenia — Русь), полоний (Польша), америций, дубний (Дубна), московий (Московская область).</li>
      <li><b>По небесным телам:</b> гелий (Солнце), селен (Луна), теллур (Земля), уран, нептуний, плутоний.</li>
      <li><b>В честь учёных:</b> кюрий, эйнштейний, менделевий, резерфордий, флеровий, оганесон.</li>
    </ul>
    <p class="adv">Сегодня новые элементы признаёт Международный союз теоретической и прикладной химии (ИЮПАК): открытие должно быть подтверждено независимыми группами. Следующие кандидаты — 119 и 120: их уже пытаются синтезировать в Дубне, в Японии и США. Они начнут 8-й период таблицы.</p>
  </section>`));
}

export const quiz = [
  { q: "Сколько элементов было известно Менделееву в 1869 году?", options: ["12", "33", "63", "118"], answer: 2, why: "63 элемента — и пустые клетки для неоткрытых." },
  { q: "Какой элемент первым был открыт человеком, имя которого известно (1669)?", options: ["Золото", "Фосфор", "Кислород", "Гелий"], answer: 1, why: "Хенниг Бранд получил фосфор, ища философский камень." },
  { q: "Гелий сначала обнаружили…", options: ["в воздухе", "в спектре Солнца", "в морской воде", "в ускорителе"], answer: 1, why: "В 1868 году по жёлтой линии в солнечном спектре." },
  { q: "Какой способ позволил Дэви получить калий и натрий?", options: ["Нагревание с углём", "Электролиз", "Спектральный анализ", "Ядерный синтез"], answer: 1, why: "Ток разложил расплавы щелочей." },
  { q: "«Экасилиций» Менделеева — это…", options: ["галлий", "скандий", "германий", "кремний"], answer: 2, why: "Германий, открытый Винклером в 1886 году." },
  { q: "Где синтезированы многие сверхтяжёлые элементы, включая оганесон?", options: ["В Дубне", "В Париже", "В Лондоне", "В Стокгольме"], answer: 0, why: "В Лаборатории ядерных реакций им. Г. Н. Флёрова ОИЯИ." },
];
