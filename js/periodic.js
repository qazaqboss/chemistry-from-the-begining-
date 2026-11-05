// Главная страница (таблица Менделеева) и страница элемента.
import { ELEMENTS } from "./data/elements.js";
import { layoutOf, CAT_COLORS, CAT_NAMES, STATE_NAMES } from "./periodic-layout.js";
import { h, $, $$, esc, term, kid, stage, store } from "./ui.js";
import { fmt, parseConfig, L_LETTER, sup } from "./chem.js";
import { LESSONS } from "./lessons/meta.js";

// ---------- раскраска ----------
const STOPS = ["#3b2a8f", "#2f5fd0", "#20a3c9", "#3ddc97", "#d6e65a", "#ffb547", "#ff5d5d"];
function ramp(t) {
  t = Math.max(0, Math.min(1, t));
  const x = t * (STOPS.length - 1);
  const i = Math.min(Math.floor(x), STOPS.length - 2);
  const f = x - i;
  const a = parseInt(STOPS[i].slice(1), 16), b = parseInt(STOPS[i + 1].slice(1), 16);
  const ch = (s) => Math.round(((a >> s) & 255) * (1 - f) + ((b >> s) & 255) * f);
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}
const BLOCK_COLORS = { s: "#ff6b6b", p: "#4dabf7", d: "#ffd43b", f: "#da77f2" };
const STATE_COLORS = { solid: "#8c9bc0", liquid: "#4dabf7", gas: "#ffd36e", unknown: "#4a5578" };

const MODES = {
  cat: { label: "Семейства", color: (e) => CAT_COLORS[e.cat] },
  state: { label: "Агрегатное состояние", color: (e) => STATE_COLORS[e.state] },
  block: { label: "Блоки s, p, d, f", color: (e) => BLOCK_COLORS[e.block] },
  en: { label: "Электроотрицательность", num: (e) => e.en, unit: "" },
  mass: { label: "Атомная масса", num: (e) => e.mass, unit: " а. е. м." },
  density: { label: "Плотность (лог. шкала)", num: (e) => e.density, log: true, unit: " г/см³" },
  mp: { label: "Температура плавления", num: (e) => e.mp, unit: " °C" },
  year: { label: "Год открытия", num: (e) => e.year, unit: "" },
};

function colorFor(mode, e, range) {
  const M = MODES[mode];
  if (M.color) return M.color(e) || "#4a5578";
  const v = M.num(e);
  if (v == null) return "#3a4260";
  const tv = M.log ? Math.log10(v) : v;
  return ramp((tv - range[0]) / (range[1] - range[0] || 1));
}
function rangeOf(mode) {
  const M = MODES[mode];
  if (!M.num) return null;
  const vals = ELEMENTS.map(M.num).filter((v) => v != null).map((v) => (M.log ? Math.log10(v) : v));
  return [Math.min(...vals), Math.max(...vals)];
}

// ---------- главная ----------
export function renderHome(root) {
  const done = store.get("done", {});
  const doneCount = Object.keys(done).length;
  root.appendChild(h(`<section class="hero">
    <div>
      <span class="tag">Интерактивный курс · для детей и взрослых</span>
      <h1 style="margin-top:12px">Химия <span class="grad">с самого начала</span></h1>
      <p class="lead">Нажми на любой элемент — откроется его 3D-атом, который можно крутить и разрезать. А в курсе — от строения атома до реакций, кристаллов и радиоактивности.</p>
    </div>
    <div class="hero-stats">
      <div class="stat"><b>118</b><span>элементов</span></div>
      <div class="stat"><b>${LESSONS.length}</b><span>уроков с 3D</span></div>
      <div class="stat"><b>${doneCount}/${LESSONS.length}</b><span>пройдено</span></div>
    </div>
  </section>`));

  const tools = h(`<div class="pt-tools">
    <input type="search" placeholder="Найти: железо, Fe, 26…" aria-label="Поиск элемента">
    <label class="row small muted" style="gap:8px">Раскраска:
      <select aria-label="Раскраска таблицы">${Object.entries(MODES).map(([k, m]) => `<option value="${k}">${m.label}</option>`).join("")}</select>
    </label>
    <div class="seg pt-view" role="group" aria-label="Вид таблицы"><button type="button" data-v="table" class="on">Таблица</button><button type="button" data-v="tiles">Плитки</button></div>
    <span class="small muted kid-only mouse-only">Подсказка: наведи на клетку, а потом нажми!</span>
  </div>`);
  root.appendChild(tools);

  const swipe = h(`<p class="small muted touch-hint">Таблица шире экрана — листай её пальцем влево-вправо или включи «Плитки».</p>`);
  root.appendChild(swipe);
  const scroll = h(`<div class="pt-scroll"></div>`);
  const grid = h(`<div class="pt" role="grid" aria-label="Периодическая таблица"></div>`);
  scroll.appendChild(grid);
  root.appendChild(scroll);

  const preview = h(`<div class="pt-preview" aria-hidden="true"></div>`);
  grid.appendChild(preview);
  const cells = new Map();
  for (const e of ELEMENTS) {
    const { col, row } = layoutOf(e);
    const a = h(`<a class="el" href="#element-${e.z}" style="grid-column:${col};grid-row:${row === 9 ? 9 : row === 10 ? 10 : row}" title="${esc(e.name)}">
      <span class="n">${e.z}</span><span class="s">${e.sym}</span><span class="nm">${esc(e.name)}</span>
      ${e.state === "liquid" || e.state === "gas" ? `<i class="st ${e.state}"></i>` : ""}
    </a>`);
    a.addEventListener("mouseenter", () => showPreview(e));
    a.addEventListener("focus", () => showPreview(e));
    grid.appendChild(a);
    cells.set(e.z, a);
  }
  grid.appendChild(h(`<div class="gap" style="grid-row:6">57–71</div>`));
  grid.appendChild(h(`<div class="gap" style="grid-row:7">89–103</div>`));
  grid.appendChild(h(`<div class="spacer" style="grid-row:8"></div>`));
  grid.appendChild(h(`<div class="gap" style="grid-row:9;grid-column:1 / span 2;border:0;justify-content:end;text-align:right">Лантаноиды</div>`));
  grid.appendChild(h(`<div class="gap" style="grid-row:10;grid-column:1 / span 2;border:0;justify-content:end;text-align:right">Актиноиды</div>`));

  function showPreview(e) {
    preview.style.setProperty("--c", CAT_COLORS[e.cat]);
    const kidMode = document.body.classList.contains("kid");
    preview.innerHTML = `<div class="big"><span class="n">${e.z}</span><span class="s">${e.sym}</span><span class="small muted">${fmt(e.mass, 3)}</span></div>
      <div><h3>${esc(e.name)} <span class="muted small">${esc(e.latin)}</span></h3>
      <div class="small" style="color:${CAT_COLORS[e.cat]};font-weight:700">${CAT_NAMES[e.cat]} · ${STATE_NAMES[e.state]}</div>
      <p>${esc(kidMode ? e.kid : e.desc)}</p></div>`;
  }
  showPreview(ELEMENTS[0]);

  const legend = h(`<div></div>`);
  root.appendChild(legend);

  let mode = "cat";
  let filter = null;
  function paint() {
    const range = rangeOf(mode);
    for (const e of ELEMENTS) cells.get(e.z).style.setProperty("--c", colorFor(mode, e, range));
    // легенда
    const M = MODES[mode];
    if (M.num) {
      const unit = M.unit;
      const lo = M.log ? 10 ** range[0] : range[0], hi = M.log ? 10 ** range[1] : range[1];
      legend.innerHTML = `<div class="scale-bar" style="background:linear-gradient(90deg,${STOPS.join(",")})"></div>
        <div class="scale-lbl"><span>${fmt(lo, 4)}${unit}</span><span>${M.label}</span><span>${fmt(hi, 1)}${unit}</span></div>
        <p class="small muted">Тёмные клетки — значение неизвестно. ${mode === "en" ? "Видно правило: электроотрицательность растёт вправо и вверх." : ""}</p>`;
    } else {
      const entries = mode === "cat" ? Object.entries(CAT_NAMES).map(([k, n]) => [k, n, CAT_COLORS[k]])
        : mode === "state" ? Object.entries(STATE_NAMES).map(([k, n]) => [k, n, STATE_COLORS[k]])
        : Object.entries(BLOCK_COLORS).map(([k, c]) => [k, `${k}-блок`, c]);
      legend.innerHTML = `<div class="legend">${entries.map(([k, n, c]) => `<button type="button" data-k="${k}" style="--c:${c}"><i></i>${n}</button>`).join("")}</div>
        ${mode === "cat" ? `<p class="small muted" style="margin-top:8px">Нажми на семейство, чтобы подсветить его. Что это за семьи — ${term("cat", "смотри здесь")}.</p>` : ""}`;
      $$("button[data-k]", legend).forEach((b) => {
        b.onclick = () => {
          filter = filter === b.dataset.k ? null : b.dataset.k;
          $$("button[data-k]", legend).forEach((x) => x.classList.toggle("on", x.dataset.k === filter));
          applyFilter();
        };
      });
    }
    applyFilter();
  }
  function applyFilter() {
    const q = $("input", tools).value.trim().toLowerCase();
    for (const e of ELEMENTS) {
      const key = mode === "cat" ? e.cat : mode === "state" ? e.state : mode === "block" ? e.block : null;
      const famOk = !filter || key === filter;
      const qOk = !q || e.name.toLowerCase().includes(q) || e.sym.toLowerCase() === q || String(e.z) === q || e.latin.toLowerCase().includes(q);
      const c = cells.get(e.z);
      c.classList.toggle("dim", !(famOk && qOk));
      c.classList.toggle("hit", !!q && qOk);
    }
  }
  const setView = (v) => {
    grid.classList.toggle("tiles", v === "tiles");
    swipe.hidden = v === "tiles";
    $$(".pt-view button", tools).forEach((b) => b.classList.toggle("on", b.dataset.v === v));
    store.set("ptView", v);
  };
  $$(".pt-view button", tools).forEach((b) => (b.onclick = () => setView(b.dataset.v)));
  setView(store.get("ptView", "table"));
  $("select", tools).onchange = (ev) => { mode = ev.target.value; filter = null; paint(); };
  $("input", tools).oninput = applyFilter;
  $("input", tools).onkeydown = (ev) => {
    if (ev.key !== "Enter") return;
    const hit = $(".el.hit", grid);
    if (hit) location.hash = hit.getAttribute("href");
  };
  paint();

  // ---------- начало курса ----------
  root.appendChild(h(`<section>
    <h2>Курс: от атома до реакций</h2>
    <p class="muted">${LESSONS.length} уроков по порядку. В каждом — 3D-модели, опыты и короткий тест. Переключатель <b>«Детям / Взрослым»</b> вверху меняет глубину объяснений.</p>
    <div class="lessons">${LESSONS.slice(0, 6).map((l, i) => lessonCard(l, i, done)).join("")}</div>
    <a class="btn primary" href="#course">Все уроки →</a>
  </section>`));
}

export function lessonCard(l, i, done) {
  return `<a class="lesson-card" href="#lesson-${l.id}">
    <svg class="ico" viewBox="0 0 100 100">${l.icon}</svg>
    <span class="num">Урок ${String(i + 1).padStart(2, "0")}</span>
    <h3>${esc(l.title)}</h3>
    <p>${esc(l.desc)}</p>
    <div class="lvl">${l.tags.map((t) => `<span class="tag">${t}</span>`).join("")}</div>
    ${done[l.id] != null ? `<span class="done">✓ ${done[l.id]}%</span>` : ""}
  </a>`;
}

// ---------- страница элемента ----------
export async function renderElement(root, z) {
  const e = ELEMENTS[z - 1];
  if (!e) throw new Error("Нет такого элемента");
  const c = CAT_COLORS[e.cat];
  const neutrons = Math.max(0, Math.round(e.mass) - e.z);
  const subs = parseConfig(e.config);
  const valence = e.shells[e.shells.length - 1];

  root.appendChild(h(`<div class="crumbs"><a href="#home">Таблица</a> › <span>${esc(CAT_NAMES[e.cat])}</span> › <b>${esc(e.name)}</b></div>`));
  const page = h(`<div class="el-page"></div>`);
  root.appendChild(page);

  // левая колонка — 3D-атом
  const left = h(`<div class="card" style="overflow:hidden"></div>`);
  const st = stage(`<div class="overlay"><span><b>${e.z}</b> <span class="dot" style="background:#ff5a6e"></span>протонов · <b>${neutrons}</b> <span class="dot" style="background:#9aa7c7"></span>нейтронов · <b>${e.z}</b> <span class="dot" style="background:#5fd4ff"></span>электронов</span></div>`);
  st.style.borderRadius = "0"; st.style.border = "0";
  left.appendChild(st);
  const ctl = h(`<div class="stage-controls">
    <label class="ctl">Разрез атома — сними половину «электронного облака»<input type="range" min="0" max="1" step="0.01" value="0"></label>
    <div class="row">
      <label class="row small"><input type="checkbox" data-c="cloud"> Показать облако оболочек</label>
      <label class="row small"><input type="checkbox" data-c="spin" checked> Вращать</label>
    </div>
    <p class="small muted" style="margin:0">Модель Бора: электроны на кольцах-оболочках. Масштаб условный — настоящее ядро в ~100 000 раз меньше атома! ${term("orbital", "Как на самом деле?")}</p>
  </div>`);
  left.appendChild(ctl);
  page.appendChild(left);

  // правая колонка — сведения
  const kidMode = document.body.classList.contains("kid");
  const right = h(`<div>
    <div class="el-head" style="--c:${c}">
      <div class="el-tile" style="--c:${c}"><span class="n">${e.z}</span><span class="s">${e.sym}</span><span class="m">${fmt(e.mass, 4)}</span></div>
      <div>
        <h1>${esc(e.name)}</h1>
        <div class="muted">${esc(e.latin)} · <button type="button" class="term" data-term="${e.cat}" style="color:${c};font-weight:700">${CAT_NAMES[e.cat]}</button></div>
      </div>
    </div>
    ${kid(esc(e.kid), "Для ребят")}
    <p>${esc(e.desc)}</p>
    <div class="props">
      ${prop("z", "Атомный номер", e.z)}
      ${prop("mass", "Атомная масса", `${fmt(e.mass, 4)} а. е. м.`)}
      ${prop("group", "Группа", e.group ?? "— (f-блок)")}
      ${prop("period", "Период", e.period)}
      ${prop("block", "Блок", `${e.block}-блок`)}
      ${prop("state", "Состояние при 20 °C", STATE_NAMES[e.state])}
      ${prop("en", "Электроотрицательность", e.en == null ? "—" : fmt(e.en, 2))}
      ${prop("valence", "Внешних электронов", valence)}
      ${prop("density", "Плотность", e.density == null ? "—" : `${fmt(e.density, e.density < 0.01 ? 6 : 3)} г/см³`)}
      ${prop("mp", "Плавление", e.mp == null ? "—" : `${fmt(e.mp, 2)} °C`)}
      ${prop("bp", "Кипение", e.bp == null ? "—" : `${fmt(e.bp, 2)} °C`)}
      ${prop("year", "Открыт", e.year ? `${e.year}` : "в древности")}
    </div>
    <div class="prop" style="margin-bottom:8px">
      <button type="button" class="k" data-term="config">Электронная конфигурация</button>
      <div class="v mono">${esc(e.config)}</div>
      <div class="shell-bar" aria-label="Электроны по оболочкам">${e.shells.map((n, i) => `<span>${"KLMNOPQ"[i]}: ${n}</span>`).join("")}</div>
      <div class="small muted adv" style="margin-top:6px">Полностью: ${subs.map((s) => `${s.n}${L_LETTER[s.l]}${sup(s.count)}`).join(" ")}</div>
    </div>
    <div class="prop"><span class="k" style="cursor:default">Где встречается и применяется</span><div>${esc(e.uses)}</div></div>
    <p class="small muted" style="margin-top:10px">Открыл: ${esc(e.discoverer)}${e.year ? `, ${e.year}` : ""}</p>
  </div>`);
  page.appendChild(right);

  // соседи по группе
  const family = ELEMENTS.filter((x) => x.group && x.group === e.group && x.z !== e.z);
  if (family.length) {
    root.appendChild(h(`<div><h3>Родственники по группе ${e.group}</h3><div class="chips">${family.map((x) => `<a class="chip" href="#element-${x.z}">${x.sym} · ${esc(x.name)}</a>`).join("")}</div></div>`));
  }
  const prev = ELEMENTS[z - 2], next = ELEMENTS[z];
  root.appendChild(h(`<div class="pager">
    ${prev ? `<a class="btn" href="#element-${prev.z}">← ${prev.z}. ${esc(prev.name)}</a>` : "<span></span>"}
    ${next ? `<a class="btn" href="#element-${next.z}">${next.z}. ${esc(next.name)} →</a>` : "<span></span>"}
  </div>`));

  // клавиши ← →
  const onKey = (ev) => {
    if (!location.hash.startsWith("#element-")) return document.removeEventListener("keydown", onKey);
    if (ev.target.closest("input,select,textarea")) return;
    if (ev.key === "ArrowLeft" && prev) location.hash = `#element-${prev.z}`;
    if (ev.key === "ArrowRight" && next) location.hash = `#element-${next.z}`;
  };
  document.addEventListener("keydown", onKey);

  // 3D
  const { createViewer } = await import("./three/core.js");
  const { createAtom } = await import("./three/atom.js");
  const viewer = createViewer(st, { camera: [0, 3, 12], clipping: true, minDistance: 3, maxDistance: 40 });
  const atom = createAtom(viewer, { z: e.z, n: neutrons, e: e.z, shells: e.shells });
  const R = atom.outerRadius();
  viewer.camera.position.set(0, R * 0.6, R * 2.9 + 2);
  $("input[type=range]", ctl).oninput = (ev) => atom.setCut(+ev.target.value);
  $("[data-c=cloud]", ctl).onchange = (ev) => atom.setCloud(ev.target.checked);
  $("[data-c=spin]", ctl).onchange = (ev) => (viewer.controls.autoRotate = ev.target.checked);
}

function prop(id, label, value) {
  return `<div class="prop"><button type="button" class="k" data-term="${id}">${label}</button><div class="v">${value}</div></div>`;
}
