// Страница курса и общий «каркас» урока.
import { LESSONS } from "./meta.js";
import { h, $$, esc, store, quiz } from "../ui.js";
import { lessonCard } from "../periodic.js";

export { LESSONS };

export function renderCourse(root) {
  const done = store.get("done", {});
  const n = Object.keys(done).length;
  root.appendChild(h(`<section style="padding-top:30px">
    <span class="tag">Курс</span>
    <h1 style="margin-top:12px">Химия от начала до конца</h1>
    <p class="lead muted" style="max-width:720px">Проходи уроки по порядку: каждый следующий опирается на предыдущий. В конце урока — тест; результат сохранится в этом браузере.</p>
    <div class="row" style="max-width:520px;margin-top:10px"><div class="progress" style="flex:1"><i style="width:${(n / LESSONS.length) * 100}%"></i></div><b>${n} / ${LESSONS.length}</b></div>
    <div class="lessons">${LESSONS.map((l, i) => lessonCard(l, i, done)).join("")}</div>
  </section>`));
}

export async function renderLesson(root, id) {
  const idx = LESSONS.findIndex((l) => l.id === id);
  if (idx < 0) throw new Error("Нет такого урока");
  const meta = LESSONS[idx];
  const mod = await import(`./${id}.js`);

  const layout = h(`<div class="lesson-layout">
    <aside class="toc"><div class="tt">Урок ${idx + 1} из ${LESSONS.length}</div><nav></nav></aside>
    <article class="article">
      <div class="crumbs"><a href="#course">Курс</a> › <span>Урок ${idx + 1}</span></div>
      <h1>${esc(meta.title)}</h1>
      <div class="body"></div>
    </article>
  </div>`);
  root.appendChild(layout);
  const body = layout.querySelector(".body");
  await mod.render(body);

  // оглавление из разделов
  const nav = layout.querySelector(".toc nav");
  const secs = $$("section[id]", body);
  secs.forEach((s) => {
    nav.appendChild(h(`<a href="#lesson-${id}" data-sec="${s.id}">${esc(s.querySelector("h2")?.textContent || s.id)}</a>`));
  });
  if (mod.quiz?.length) nav.appendChild(h(`<a href="#lesson-${id}" data-sec="quiz">Проверь себя</a>`));
  nav.addEventListener("click", (e) => {
    const a = e.target.closest("[data-sec]");
    if (!a) return;
    e.preventDefault();
    document.getElementById(a.dataset.sec)?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
  const io = new IntersectionObserver((ents) => {
    for (const en of ents) if (en.isIntersecting) {
      $$("a", nav).forEach((a) => a.classList.toggle("on", a.dataset.sec === en.target.id));
    }
  }, { rootMargin: "-30% 0px -60% 0px" });
  secs.forEach((s) => io.observe(s));

  if (mod.quiz?.length) {
    const q = quiz(null, mod.quiz, (pct) => {
      if (pct >= 70) {
        const done = store.get("done", {});
        done[id] = Math.max(pct, done[id] || 0);
        store.set("done", done);
      }
    });
    q.id = "quiz";
    body.appendChild(q);
  }

  const prev = LESSONS[idx - 1], next = LESSONS[idx + 1];
  body.appendChild(h(`<div class="pager">
    ${prev ? `<a class="btn" href="#lesson-${prev.id}">← ${esc(prev.title)}</a>` : `<a class="btn" href="#course">← Все уроки</a>`}
    ${next ? `<a class="btn primary" href="#lesson-${next.id}">${esc(next.title)} →</a>` : `<a class="btn primary" href="#course">К списку уроков</a>`}
  </div>`));
}
