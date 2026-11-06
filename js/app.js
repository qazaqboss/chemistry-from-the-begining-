// Точка входа: маршрутизация, режимы «Детям/Взрослым», тема.
import { disposeAllViewers } from "./three/core.js";
import { $, $$, store, closePop } from "./ui.js";
import { renderHome, renderElement } from "./periodic.js";
import { renderCourse, renderLesson } from "./lessons/index.js";
import { renderLab } from "./lab.js";
import { renderGlossary } from "./glossary-page.js";
import { initGuide, guideAfterRoute } from "./guide.js";

const app = $("#app");

// ---------- режим ----------
function setMode(mode) {
  document.body.classList.toggle("kid", mode === "kid");
  $$("[data-mode]").forEach((b) => b.classList.toggle("on", b.dataset.mode === mode));
  store.set("mode", mode);
}
setMode(store.get("mode", "adult"));
$$("[data-mode]").forEach((b) => (b.onclick = () => setMode(b.dataset.mode)));

// ---------- тема ----------
$("#themeBtn").onclick = () => {
  const cur = document.documentElement.dataset.theme || (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
  const next = cur === "light" ? "dark" : "light";
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem("theme", next); } catch {}
  // перезагрузить фигуры Anatomy в нужной теме
  $$(".fig-frame").forEach((f) => (f.src = `${f.dataset.base}/index${next === "light" ? "-light" : ""}.html`));
};

$("#menuBtn").onclick = () => $("#nav").classList.toggle("open");

// ---------- маршруты ----------
// Адреса — простые имена после #: #home, #element-26, #lesson-atom, #course, #lab, #glossary-en
const routes = [
  [/^(?:home)?$/, (m, v) => renderHome(v), "home"],
  [/^element-(\d+)$/, (m, v) => renderElement(v, +m[1]), "home"],
  [/^course$/, (m, v) => renderCourse(v), "course"],
  [/^lesson-([\w-]+)$/, (m, v) => renderLesson(v, m[1]), "course"],
  [/^lab$/, (m, v) => renderLab(v), "lab"],
  [/^glossary(?:-([\w-]+))?$/, (m, v) => renderGlossary(v, m[1]), "glossary"],
];

async function route() {
  // старые ссылки вида #/lesson/atom тоже понимаем
  const path = decodeURIComponent(location.hash.replace(/^#\/?/, "")).replace(/@.*$/, "").replace(/\//g, "-");
  closePop();
  disposeAllViewers();
  $("#nav").classList.remove("open");
  app.innerHTML = "";
  const view = document.createElement("div");
  view.className = "view";
  app.appendChild(view);
  for (const [re, fn, nav] of routes) {
    const m = path.match(re);
    if (m) {
      $$("[data-nav]").forEach((a) => a.classList.toggle("on", a.dataset.nav === nav));
      try {
        await fn(m, view);
      } catch (err) {
        console.error(err);
        view.innerHTML = `<div class="card pad" style="margin:30px 0"><h2 class="mt0">Что-то пошло не так</h2><p class="muted">${err.message}</p><a class="btn" href="#home">На главную</a></div>`;
      }
      window.scrollTo(0, 0);
      guideAfterRoute();
      return;
    }
  }
  view.innerHTML = `<div class="card pad" style="margin:30px 0"><h2 class="mt0">Страница не найдена</h2><a class="btn" href="#home">На главную</a></div>`;
}
initGuide();
window.addEventListener("hashchange", route);
route();
