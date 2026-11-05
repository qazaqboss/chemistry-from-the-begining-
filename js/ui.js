// Небольшие помощники для интерфейса: разметка, термины, викторины, хранилище.
import { GLOSSARY } from "./data/glossary.js";

export function h(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// ---------- хранилище (безопасно в приватном режиме) ----------
export const store = {
  get(key, def) { try { const v = localStorage.getItem(key); return v == null ? def : JSON.parse(v); } catch { return def; } },
  set(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch {} },
};

export const isKid = () => document.body.classList.contains("kid");

// ---------- термины ----------
// <button class="term" data-term="en">электроотрицательность</button>
export const term = (id, text) => `<button type="button" class="term" data-term="${id}">${text ?? GLOSSARY[id]?.term ?? id}</button>`;

let popEl = null;
export function closePop() { popEl?.remove(); popEl = null; }
export function showTerm(id, anchor) {
  const g = GLOSSARY[id];
  if (!g) return;
  closePop();
  popEl = h(`<div class="pop" role="dialog" aria-label="${esc(g.term)}">
    <button class="close" aria-label="Закрыть">×</button>
    <h4>${esc(g.term)}</h4>
    ${isKid() ? `<p class="kid-line">${esc(g.kid)}</p><p class="muted small">${esc(g.def)}</p>` : `<p>${esc(g.def)}</p><p class="kid-line small">Просто: ${esc(g.kid)}</p>`}
    ${g.lesson ? `<a href="#/lesson/${g.lesson}">Подробнее в уроке →</a> · ` : ""}<a href="#/glossary/${id}">В словарь</a>
  </div>`);
  document.body.appendChild(popEl);
  const r = anchor.getBoundingClientRect();
  const pw = popEl.offsetWidth, ph = popEl.offsetHeight;
  let left = Math.min(Math.max(12, r.left), window.innerWidth - pw - 12);
  let top = r.bottom + 8;
  if (top + ph > window.innerHeight - 12) top = Math.max(12, r.top - ph - 8);
  popEl.style.left = left + "px";
  popEl.style.top = top + "px";
  popEl.querySelector(".close").onclick = closePop;
  popEl.querySelectorAll("a").forEach((a) => a.addEventListener("click", closePop));
}
document.addEventListener("click", (e) => {
  const t = e.target.closest("[data-term]");
  if (t) { e.preventDefault(); showTerm(t.dataset.term, t); return; }
  if (popEl && !e.target.closest(".pop")) closePop();
});
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closePop(); });
window.addEventListener("scroll", closePop, { passive: true });

// ---------- блок «Детям» ----------
export const kid = (text, title = "Просто о сложном") => `<div class="kid-box"><b class="kid-title">${title}</b><p>${text}</p></div>`;

// ---------- викторина ----------
// questions: [{ q, options: [...], answer: index, why }]
export function quiz(container, questions, onDone) {
  const box = h(`<div class="quiz"><h2>Проверь себя</h2><p class="muted">Выбери ответ — сразу узнаешь, прав ли ты.</p><div class="qs"></div><p class="score" aria-live="polite"></p></div>`);
  const qs = box.querySelector(".qs");
  let answered = 0, right = 0;
  questions.forEach((q, qi) => {
    const el = h(`<div class="q"><div class="qt">${qi + 1}. ${q.q}</div><div class="opts"></div><div class="why" hidden></div></div>`);
    const opts = el.querySelector(".opts");
    q.options.forEach((o, i) => {
      const b = h(`<button class="opt" type="button">${o}</button>`);
      b.onclick = () => {
        opts.querySelectorAll(".opt").forEach((x, j) => {
          x.disabled = true;
          if (j === q.answer) x.classList.add("right");
        });
        if (i !== q.answer) b.classList.add("wrong"); else right++;
        answered++;
        const why = el.querySelector(".why");
        why.hidden = false;
        why.innerHTML = (i === q.answer ? "<b style='color:var(--good)'>Верно!</b> " : "<b style='color:var(--bad)'>Не совсем.</b> ") + (q.why || "");
        if (answered === questions.length) {
          const pct = Math.round((right / questions.length) * 100);
          box.querySelector(".score").innerHTML = `Результат: ${right} из ${questions.length} (${pct}%). ${pct >= 70 ? "Отлично, урок пройден! 🎉" : "Перечитай урок и попробуй ещё раз."} <button class="btn small" type="button">Ещё раз</button>`;
          box.querySelector(".score button").onclick = () => { box.replaceWith(quiz(container, questions, onDone)); };
          onDone?.(pct);
        }
      };
      opts.appendChild(b);
    });
    qs.appendChild(el);
  });
  container?.appendChild(box);
  return box;
}

// ---------- переключатель вкладок ----------
export function chips(container, items, onPick, initial = 0) {
  const row = h(`<div class="chips"></div>`);
  items.forEach((it, i) => {
    const b = h(`<button class="chip${i === initial ? " on" : ""}" type="button">${it.label}</button>`);
    b.onclick = () => { row.querySelectorAll(".chip").forEach((x) => x.classList.remove("on")); b.classList.add("on"); onPick(it, i); };
    row.appendChild(b);
  });
  container.appendChild(row);
  return row;
}

// ---------- 3D-сцена в карточке ----------
export function stage(html = "", { wide = false } = {}) {
  return h(`<div class="stage${wide ? " wide" : ""}">${html}<div class="hint">Крути мышкой или пальцем · колесо — масштаб</div></div>`);
}

// ---------- фигура Anatomy во фрейме ----------
export function figureFrame(path, title) {
  const theme = document.documentElement.dataset.theme === "light" ? "-light" : "";
  const f = h(`<iframe class="fig-frame" title="${esc(title)}" loading="lazy" src="${path}/index${theme}.html"></iframe>`);
  f.dataset.base = path;
  return f;
}
window.addEventListener("message", (e) => {
  if (e.data?.type !== "figure-height") return;
  for (const f of document.querySelectorAll(".fig-frame")) {
    if (f.contentWindow === e.source) f.style.height = Math.ceil(e.data.height) + "px";
  }
});
