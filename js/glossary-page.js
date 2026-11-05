import { GLOSSARY } from "./data/glossary.js";
import { LESSONS } from "./lessons/meta.js";
import { h, esc } from "./ui.js";

export function renderGlossary(root, focus) {
  const items = Object.entries(GLOSSARY).sort((a, b) => a[1].term.localeCompare(b[1].term, "ru"));
  root.appendChild(h(`<section style="padding-top:30px">
    <span class="tag">Словарь</span>
    <h1 style="margin-top:12px">Химический словарь</h1>
    <p class="lead muted">${items.length} понятий: строгое определение и объяснение «по-простому». На страницах элементов и в уроках эти слова можно нажимать.</p>
    <input type="search" placeholder="Найти понятие…" style="width:320px;max-width:100%;margin:8px 0 18px" aria-label="Поиск по словарю">
    <div class="lessons" data-list style="grid-template-columns:repeat(auto-fill,minmax(320px,1fr))"></div>
  </section>`));
  const list = root.querySelector("[data-list]");
  list.innerHTML = items.map(([id, g]) => {
    const l = LESSONS.find((x) => x.id === g.lesson);
    return `<div class="card pad" id="g-${id}" data-q="${esc((g.term + " " + g.def).toLowerCase())}">
      <h3 class="mt0">${esc(g.term)}</h3>
      <p>${esc(g.def)}</p>
      <div class="kid-box" style="margin:8px 0"><b class="kid-title">Просто</b><p>${esc(g.kid)}</p></div>
      ${l ? `<a class="small" href="#lesson-${l.id}">Урок «${esc(l.title)}» →</a>` : ""}
    </div>`;
  }).join("");
  root.querySelector("input").oninput = (e) => {
    const q = e.target.value.trim().toLowerCase();
    list.querySelectorAll("[data-q]").forEach((c) => (c.style.display = !q || c.dataset.q.includes(q) ? "" : "none"));
  };
  if (focus) {
    const c = document.getElementById("g-" + focus);
    if (c) setTimeout(() => { c.scrollIntoView({ block: "center" }); c.style.borderColor = "var(--accent)"; }, 50);
  }
}
