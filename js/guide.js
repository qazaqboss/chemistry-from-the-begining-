// Голосовой гид: экскурсия по странице с подсветкой, чтение уроков вслух
// и режим «Что это?» — нажми на любой предмет, и гид объяснит, что он означает.
// Голос — встроенный синтезатор речи браузера (Web Speech API), без внешних сервисов.
import { ELEMENTS } from "./data/elements.js";
import { GLOSSARY } from "./data/glossary.js";
import { CAT_NAMES, STATE_NAMES } from "./periodic-layout.js";
import { LESSONS } from "./lessons/meta.js";
import { h, $, $$, esc, store, isKid, closePop } from "./ui.js";
import { fmt } from "./chem.js";

const BY_SYM = Object.fromEntries(ELEMENTS.map((e) => [e.sym, e]));
const isTouch = () => matchMedia("(hover: none), (pointer: coarse)").matches;
const narrow = () => innerWidth < 720;

// =====================================================================
// 1. Речь
// =====================================================================
const synth = typeof window !== "undefined" && "speechSynthesis" in window ? window.speechSynthesis : null;
let ruVoices = [];
let renderVoiceSelect = null; // задаётся, когда построена карточка гида
let allVoicesCount = 0;
function loadVoices() {
  if (!synth) return;
  const all = synth.getVoices();
  allVoicesCount = all.length;
  const score = (v) => (/natural|neural|online/i.test(v.name) ? 4 : 0) + (/google/i.test(v.name) ? 2 : 0) + (/milena|svetlana|dariya|irina|alena|katya|yandex/i.test(v.name) ? 1 : 0);
  ruVoices = all.filter((v) => /^ru/i.test(v.lang)).sort((a, b) => score(b) - score(a));
  renderVoiceSelect?.();
}
if (synth) {
  loadVoices();
  synth.addEventListener?.("voiceschanged", loadVoices);
}
const settings = {
  get rate() { return store.get("guideRate", 1); },
  get muted() { return store.get("guideMuted", false); },
  get voice() { return ruVoices.find((v) => v.voiceURI === store.get("guideVoice", "")) || ruVoices[0] || null; },
};
// можно ли говорить вслух: синтезатор есть, и есть русский голос
// (если список голосов ещё пуст — пробуем: многие телефоны отдают его не сразу)
const canSpeak = () => !!synth && !settings.muted && (ruVoices.length > 0 || allVoicesCount === 0);

// --- как произносить химию ---
const SAY_SYM = {
  H: "аш", O: "о", C: "цэ", N: "эн", S: "эс", P: "пэ", F: "фтор", B: "бор", I: "йод", K: "калий", U: "уран",
  Na: "натрий", Cl: "хлор", Ca: "кальций", Fe: "феррум", Cu: "купрум", Ag: "аргентум", Au: "аурум",
  Al: "алюминий", Mg: "магний", Zn: "цинк", Si: "силициум", Br: "бром", Mn: "марганец", Pb: "плюмбум",
  Hg: "гидраргирум", Sn: "станнум", Ba: "барий", Li: "литий", He: "гелий", Ne: "неон", Ar: "аргон",
  Cr: "хром", Ni: "никель", Co: "кобальт", Ti: "титан", Sr: "стронций", Ra: "радий", Rn: "радон",
  Pu: "плутоний", Pt: "платина", Kr: "криптон", Xe: "ксенон", Cs: "цезий", Rb: "рубидий", Be: "бериллий",
  As: "арсеникум", Sb: "стибиум", Bi: "висмут", W: "вольфрам", Mo: "молибден", V: "ванадий", Ge: "германий", Ga: "галлий", Se: "селен", Te: "теллур",
};
const SUBS = "₀₁₂₃₄₅₆₇₈₉", SUPS = "⁰¹²³⁴⁵⁶⁷⁸⁹";
const deSub = (s) => s.replace(/[₀-₉]/g, (c) => SUBS.indexOf(c)).replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/g, (c) => SUPS.indexOf(c));
function sayFormula(tok) {
  // tok: H₂SO₄, CO₂, Fe, NaCl, Ca(OH)₂, Na⁺, SO₄²⁻
  // одиночную латинскую букву без индекса (K, L, M — оболочки; A, B в схемах) не трогаем, римские цифры тоже
  if (/^[A-Z]$/.test(tok) || /^[IVX]+$/.test(tok) || /^[ABCD]+$/.test(tok)) return null;
  let charge = "";
  tok = tok.replace(/([⁰¹²³⁴⁵⁶⁷⁸⁹]*)([⁺⁻])$/, (m, n, sgn) => { charge = ` ${n ? deSub(n) + " " : ""}${sgn === "⁺" ? "плюс" : "минус"}`; return ""; });
  const parts = [];
  const re = /([A-Z][a-z]?)([₀-₉0-9]*)|\(|\)([₀-₉0-9]*)/g;
  let m, used = 0;
  while ((m = re.exec(tok))) {
    used += m[0].length;
    if (m[1]) {
      if (!BY_SYM[m[1]]) return null;
      parts.push(SAY_SYM[m[1]] || BY_SYM[m[1]].name.toLowerCase());
      if (m[2]) parts.push(deSub(m[2]));
    } else if (m[0].startsWith(")") && m[3]) { const k = deSub(m[3]); parts.push(k === "2" ? "дважды" : k === "3" ? "трижды" : `${k} раза`); }
  }
  if (used !== tok.length) return null;
  return parts.join(" ") + charge;
}
const ELECTRONS = (n) => `${n ? n + " " : ""}${n ? plural(+n, "электрон", "электрона", "электронов") : "электрон"}`;
export function toSpeech(t) {
  return String(t)
    .replace(/\.{2,}(?!\.)/g, ".")
    // изотопы: ¹⁴C → углерод-14
    .replace(/([⁰¹²³⁴⁵⁶⁷⁸⁹]+)([A-Z][a-z]?)(?![a-z])/g, (m, n, sym) => (BY_SYM[sym] ? `${BY_SYM[sym].name.toLowerCase()} ${deSub(n)}` : m))
    .replace(/(\d*)e⁻/g, (m, n) => ELECTRONS(n))
    .replace(/(?<![A-Za-z])p⁺/g, "протон").replace(/(?<![A-Za-z])n⁰/g, "нейтрон")
    .replace(/Δχ/g, "разность электроотрицательностей")
    .replace(/α/g, "альфа").replace(/β/g, "бета").replace(/γ/g, "гамма")
    .replace(/(\d)\s?·\s?(?=\d)/g, "$1 умножить на ")
    .replace(/\s?·\s?/g, ", ")
    .replace(/≤/g, " меньше или равно ").replace(/≥/g, " больше или равно ")
    .replace(/\s<\s/g, " меньше ").replace(/\s>\s/g, " больше ")
    .replace(/(^|[\s(])[−-](?=\d)/g, "$1минус ")
    .replace(/\s[−]\s/g, " минус ")
    .replace(/(\d)°(?!C)/g, "$1 градусов")    .replace(/\p{Extended_Pictographic}|️/gu, "")
    .replace(/г\/см³/g, " грамм на кубический сантиметр")
    .replace(/г\/моль/g, " грамм на моль")
    .replace(/моль\/л/g, " моль на литр")
    .replace(/а\.\s?е\.\s?м\./g, " атомных единиц массы")
    .replace(/°C/g, " градусов Цельсия")
    .replace(/\bpH\b/g, "пэ аш")
    .replace(/(\d)\s?Å/g, "$1 ангстрема")
    .replace(/10([⁰¹²³⁴⁵⁶⁷⁸⁹⁻]+)/g, (m, p) => ` десять в степени ${p.startsWith("⁻") ? "минус " : ""}${deSub(p.replace("⁻", ""))}`)
    .replace(/(^|[^A-Za-z])((?:[A-Z][a-z]?[₀-₉0-9]*|\((?:[A-Z][a-z]?[₀-₉0-9]*)+\)[₀-₉0-9]*)+[⁰¹²³⁴⁵⁶⁷⁸⁹]*[⁺⁻]?)(?![A-Za-z])/g, (m, pre, tok) => {
      const s = sayFormula(tok);
      // «2H₂» → «2 аш 2»
      return pre + (s ? (/\d$/.test(pre) ? " " : "") + s : tok);
    })
    .replace(/\s*→\s*/g, ", получается, ")
    .replace(/\s*⇄\s*/g, ", обратимо, ")
    .replace(/[↑↓]/g, "")
    .replace(/\s\+\s/g, " плюс ")
    .replace(/≈/g, " примерно ")
    .replace(/\s=\s/g, " равно ")
    .replace(/([⁰¹²³⁴⁵⁶⁷⁸⁹₀-₉]+)/g, (m) => " " + deSub(m))
    .replace(/×/g, " умножить на ")
    .replace(/\s[—–]\s/g, ", ")
    .replace(/[«»"]/g, "")
    .replace(/(\d)[\s\u00a0\u202f](?=\d{3}(?!\d))/g, "$1")
    .replace(/(?<![А-Яа-яЁё])[А-ЯЁ]{3,}(?![А-Яа-яЁё])/g, (w) => w.toLowerCase())
    .replace(/([,.:;!?])\s*,/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
}
function sentences(text) {
  const clean = String(text).replace(/\s+/g, " ").trim();
  if (!clean) return [];
  const out = [];
  // не режем на инициалах: «М. В. Ломоносов»
  for (const s of clean.split(/(?<=[.!?…])(?<!(?:^|\s)[А-ЯЁA-Z]\.)\s+(?=[«"(А-ЯЁA-Z0-9—–-])/)) {
    if (s.length <= 220) { out.push(s); continue; }
    // слишком длинное — режем по запятым, чтобы синтезатор не обрывался
    let cur = "";
    for (const piece of s.split(/(?<=[,;:])\s+/)) {
      if ((cur + " " + piece).length > 200 && cur) { out.push(cur); cur = piece; } else cur = cur ? cur + " " + piece : piece;
    }
    if (cur) out.push(cur);
  }
  return out;
}

let gen = 0, timer = 0;
function stopSpeech() {
  gen++;
  if (typeof clip !== "undefined" && clip && !clip.paused) clip.pause();
  clearTimeout(timer);
  try { synth?.cancel(); } catch {}
}
// произнести список фраз, начиная с from; onIdx — какая фраза звучит; onDone — всё сказано
function speak(list, from, onIdx, onDone) {
  stopSpeech();
  const my = gen;
  let i = from;
  const next = () => {
    if (my !== gen) return;
    if (i >= list.length) return onDone?.();
    onIdx?.(i);
    const s = list[i];
    let fired = false;
    const go = () => { if (fired) return; fired = true; clearTimeout(timer); if (my !== gen) return; i++; next(); };
    const rate = settings.rate;
    if (!canSpeak()) {
      // без звука — субтитры сменяются по времени чтения
      timer = setTimeout(go, Math.max(1800, (s.length * 62) / rate));
      return;
    }
    const u = new SpeechSynthesisUtterance(toSpeech(s));
    u.lang = "ru-RU";
    const v = settings.voice;
    if (v) u.voice = v;
    u.rate = rate;
    u.onend = go;
    u.onerror = (e) => {
      if (e.error === "interrupted" || e.error === "canceled") return;
      // голос не смог — показываем фразу субтитром нужное время
      clearTimeout(timer);
      timer = setTimeout(go, Math.max(1800, (s.length * 62) / rate));
    };
    try { synth.speak(u); } catch { return go(); }
    // страховка: некоторые браузеры не присылают onend
    timer = setTimeout(go, 6000 + (s.length * 140) / rate);
  };
  // Chrome: если синтезатор «завис» на паузе — разбудить
  try { synth?.resume(); } catch {}
  next();
}
export function sayText(text) { speak(sentences(text), 0); }

// =====================================================================
// 2. Интерфейс гида
// =====================================================================
const AVATAR = `<svg viewBox="0 0 64 64" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="4"><ellipse cx="32" cy="32" rx="27" ry="10.5"/><ellipse cx="32" cy="32" rx="27" ry="10.5" transform="rotate(60 32 32)"/><ellipse cx="32" cy="32" rx="27" ry="10.5" transform="rotate(120 32 32)"/></g><circle cx="32" cy="32" r="6" fill="#ff5a6e"/></svg>`;
const ICON = {
  play: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`,
  pause: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 5h4v14H7zM13 5h4v14h-4z"/></svg>`,
  prev: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg>`,
  next: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>`,
  again: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M4 12a8 8 0 1 0 2.4-5.7M4 4v4h4"/></svg>`,
  gear: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>`,
  speaker: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5L6 9H3v6h3l5 4z" fill="currentColor"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/></svg>`,
};

let fab, menu, spot, card, banner;


function buildUI() {
  fab = h(`<button class="guide-fab" type="button" aria-haspopup="true" aria-expanded="false">${AVATAR}<span>Гид</span></button>`);
  menu = h(`<div class="guide-menu" role="menu" hidden></div>`);
  spot = h(`<div class="guide-spot" aria-hidden="true" hidden><span class="guide-tag"></span></div>`);
  card = h(`<div class="guide-card" role="dialog" aria-live="polite" hidden>
    <div class="gc-head"><span class="gc-ava">${AVATAR}</span><div class="gc-tt"><b data-title></b><span data-count></span></div><button class="gc-x" type="button" aria-label="Закрыть гида">×</button></div>
    <div class="gc-text" data-text></div>
    <p class="gc-note small" data-note hidden></p>
    <div class="gc-ctl">
      <button type="button" data-prev aria-label="Назад">${ICON.prev}</button>
      <button type="button" data-play class="gc-play" aria-label="Пауза">${ICON.pause}</button>
      <button type="button" data-next aria-label="Дальше">${ICON.next}</button>
      <span class="gc-sp"></span>
      <button type="button" data-exitx class="gc-exit" hidden>Выйти из «Что это?»</button>
      <button type="button" data-gear aria-label="Настройки голоса">${ICON.gear}</button>
    </div>
    <div class="gc-set" hidden>
      <label>Скорость <span class="seg" data-rate><button type="button" data-r="0.8">медленно</button><button type="button" data-r="1">обычно</button><button type="button" data-r="1.25">быстро</button></span></label>
      <label data-voice-row>Голос <select data-voice></select></label>
      <label class="row"><input type="checkbox" data-mute> Без звука — только субтитры</label>
    </div>
  </div>`);
  banner = h(`<div class="guide-banner" hidden><b>Режим «Что это?»</b><span>Нажми на любой предмет — расскажу, что он означает.</span><button type="button" class="btn small">Выйти</button></div>`);
  document.body.append(spot, card, banner, menu, fab);

  fab.onclick = (e) => { e.stopPropagation(); toggleMenu(); };
  // в режиме «Что это?» крестик закрывает только карточку — режим остаётся
  card.querySelector(".gc-x").onclick = () => {
    if (explain) { stopSpeech(); tour = null; card.hidden = true; spot.hidden = true; banner.hidden = false; document.body.classList.remove("guide-open"); }
    else stopAll();
  };
  card.querySelector("[data-prev]").onclick = () => tour && goStep(tour.i - 1, -1);
  card.querySelector("[data-next]").onclick = () => tour && goStep(tour.i + 1, 1);
  card.querySelector("[data-play]").onclick = togglePlay;
  card.querySelector("[data-exitx]").onclick = () => stopAll();
  card.querySelector("[data-gear]").onclick = () => { const s = card.querySelector(".gc-set"); s.hidden = !s.hidden; };
  banner.querySelector("button").onclick = () => stopAll();

  // настройки
  const rateSeg = card.querySelector("[data-rate]");
  const paintRate = () => $$("button", rateSeg).forEach((b) => b.classList.toggle("on", +b.dataset.r === settings.rate));
  $$("button", rateSeg).forEach((b) => (b.onclick = () => { store.set("guideRate", +b.dataset.r); paintRate(); replayCurrent(); }));
  paintRate();
  const mute = card.querySelector("[data-mute]");
  mute.checked = settings.muted;
  mute.onchange = () => { store.set("guideMuted", mute.checked); replayCurrent(); };
  const sel = card.querySelector("[data-voice]");
  renderVoiceSelect = () => {
    sel.innerHTML = ruVoices.map((v) => `<option value="${esc(v.voiceURI)}">${esc(v.name)}</option>`).join("");
    if (settings.voice) sel.value = settings.voice.voiceURI;
    card.querySelector("[data-voice-row]").hidden = ruVoices.length < 2;
  };
  renderVoiceSelect();
  sel.onchange = () => { store.set("guideVoice", sel.value); replayCurrent(); };

  document.addEventListener("click", (e) => { if (!menu.hidden && !e.target.closest(".guide-menu")) closeMenu(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && (tour || explain)) stopAll(); });
  document.addEventListener("click", onExplainClick, true);
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-say-sec]");
    if (b) { e.preventDefault(); startLesson(b.dataset.saySec); }
  });
  // озвучка из всплывающих подсказок терминов
  window.addEventListener("guide:say", (e) => { stopAll(); sayText(e.detail); });

  // первое знакомство — пузырёк у кнопки
  if (!store.get("guideHello", false)) {
    const bub = h(`<div class="guide-hello" role="dialog" aria-label="Голосовой гид">
      <div class="gh-top"><span class="gc-ava">${AVATAR}</span><b>Привет! Я голосовой гид.</b></div>
      <p>Хочешь, я сама покажу весь сайт — куда нажимать и что всё означает? Включи звук 🔊</p>
      <div class="gh-btns"><button type="button" class="btn primary" data-go>▶ Покажи мне всё</button><button type="button" class="btn" data-later>Позже</button></div>
    </div>`);
    document.body.appendChild(bub);
    const hide = () => { bub.remove(); store.set("guideHello", true); };
    bub.querySelector("[data-go]").onclick = (e) => { e.stopPropagation(); hide(); startAuto(); };
    bub.querySelector("[data-later]").onclick = (e) => { e.stopPropagation(); hide(); };
    fab.addEventListener("click", hide, { once: true });

  }
}

// ---------- меню ----------
function pageKind() {
  const p = decodeURIComponent(location.hash.replace(/^#\/?/, "")).replace(/@.*$/, "").replace(/\//g, "-");
  if (/^element-\d+$/.test(p)) return { kind: "element", z: +p.slice(8) };
  if (/^lesson-/.test(p)) return { kind: "lesson", id: p.slice(7) };
  if (/^course$/.test(p)) return { kind: "course" };
  if (/^lab$/.test(p)) return { kind: "lab" };
  if (/^glossary/.test(p)) return { kind: "glossary" };
  return { kind: "home" };
}
function toggleMenu() {
  if (!menu.hidden) return closeMenu();
  const pk = pageKind();
  const items = [["auto", "▶ Покажи мне всё сам", "Голосовая экскурсия по всему сайту: гид сам переходит по страницам и нажимает кнопки"]];
  if (pk.kind === "lesson") {
    items.push(["lesson", "Прочитать урок вслух", "Покажу и объясню всё по порядку"]);
    items.push(["tour", "Как устроена страница", "Где оглавление, тест и кнопки"]);
  } else if (pk.kind === "element") {
    items.push(["tour", "Рассказать об элементе", "Что значат номер, масса, оболочки и 3D-атом"]);
  } else {
    items.push(["tour", "Экскурсия по странице", "Подсвечу каждую часть и объясню, что она значит"]);
  }
  items.push(["explain", "Что это?", "Нажми на любой предмет — я объясню"]);
  if (!synth) items.push(["", "Голос недоступен", "Этот браузер не умеет говорить — будут субтитры"]);
  menu.innerHTML = items.map(([k, t, d]) => `<button type="button" role="menuitem" ${k ? `data-k="${k}"` : "disabled"}><b>${t}</b><span>${d}</span></button>`).join("");
  $$("[data-k]", menu).forEach((b) => (b.onclick = (e) => {
    e.stopPropagation();
    closeMenu();
    if (b.dataset.k === "auto") startAuto();
    else if (b.dataset.k === "tour") startTour();
    else if (b.dataset.k === "lesson") startLesson();
    else startExplain();
  }));
  menu.hidden = false;
  fab.setAttribute("aria-expanded", "true");
}
function closeMenu() { menu.hidden = true; fab.setAttribute("aria-expanded", "false"); }

// =====================================================================
// 3. Подсветка и карточка
// =====================================================================
let focusEl = null, raf = 0;
function headerH() { return $("header.top")?.getBoundingClientRect().bottom ?? 0; }
function setFocus(el, label) {
  focusEl = el;
  spot.hidden = !el;
  spot.querySelector(".guide-tag").textContent = label || "";
  spot.querySelector(".guide-tag").hidden = !label;
  if (!raf) raf = requestAnimationFrame(tick);
}
function tick() {
  raf = 0;
  document.body.classList.toggle("guide-open", !card.hidden);
  if (card.hidden) return;
  const pad = 6;
  if (focusEl && focusEl.isConnected) {
    const r = focusEl.getBoundingClientRect();
    const inHeader = !!focusEl.closest("header.top");
    const top = Math.max(r.top - pad, inHeader ? 2 : headerH() + 2), bottom = Math.min(r.bottom + pad, innerHeight - 2);
    const left = Math.max(r.left - pad, 2), right = Math.min(r.right + pad, innerWidth - 2);
    const vis = bottom > top + 4 && right > left + 4;
    spot.style.opacity = vis ? 1 : 0;
    Object.assign(spot.style, { top: top + "px", left: left + "px", width: Math.max(0, right - left) + "px", height: Math.max(0, bottom - top) + "px" });
    spot.classList.toggle("tag-below", inHeader || top < headerH() + 34);
    spot.classList.toggle("tag-right", left > innerWidth * 0.5);
    placeCard(r);
  } else {
    spot.style.opacity = 0;
    placeCard(null);
  }
  raf = requestAnimationFrame(tick);
}
function placeCard(r) {
  if (narrow()) { card.classList.add("docked"); card.style.left = card.style.top = ""; return; }
  card.classList.remove("docked");
  const cw = card.offsetWidth, ch = card.offsetHeight, m = 14;
  let left, top;
  if (r) {
    left = Math.min(Math.max(12, r.left), innerWidth - cw - 12);
    if (r.bottom + m + ch < innerHeight - 10) top = r.bottom + m;
    else if (r.top - m - ch > headerH() + 8) top = r.top - m - ch;
    else { top = innerHeight - ch - 18; left = innerWidth - cw - 18; }
  } else { top = innerHeight - ch - 18; left = innerWidth - cw - 18; }
  card.style.left = Math.round(left) + "px";
  card.style.top = Math.round(top) + "px";
}
// прокрутить так, чтобы предмет был виден и не прятался под карточкой
function reveal(el) {
  // горизонтальная прокрутка внутри таблицы и т. п.
  let p = el.parentElement;
  while (p && p !== document.body) {
    if (p.scrollWidth > p.clientWidth + 4 && /(auto|scroll)/.test(getComputedStyle(p).overflowX)) {
      const pr = p.getBoundingClientRect(), r = el.getBoundingClientRect();
      if (r.width < pr.width) p.scrollLeft += r.left + r.width / 2 - (pr.left + pr.width / 2);
    }
    p = p.parentElement;
  }
  if (el.closest("header.top")) return;
  const r = el.getBoundingClientRect();
  const topLimit = headerH() + 12;
  const bottomLimit = innerHeight - (narrow() ? card.offsetHeight + 20 : 20);
  const space = bottomLimit - topLimit;
  if (r.top >= topLimit && r.bottom <= bottomLimit) return;
  let y = r.height <= space ? r.top - topLimit - (space - r.height) / 2 : r.top - topLimit;
  if (!narrow() && r.height <= space) y = r.top - topLimit - Math.min(60, (space - r.height) / 2);
  window.scrollTo({ top: window.scrollY + y, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
}

// =====================================================================
// 4. Экскурсия (последовательность шагов)
// =====================================================================
// шаг: { el: () => Element | null, title, text }
let tour = null; // { steps, i, playing, sent, si, kind }
let explain = false;

function visible(el) { return el && el.isConnected && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden"; }

function runSteps(steps, kind, start = 0) {
  stopAll(true);
  if (!steps.length) return;
  tour = { steps, i: -1, playing: true, sent: [], si: 0, kind };
  card.hidden = false;
  card.classList.toggle("explain", false);
  card.querySelector("[data-exitx]").hidden = true;
  card.querySelector("[data-prev]").hidden = card.querySelector("[data-next]").hidden = false;
  card.classList.toggle("auto", kind === "auto");
  if (kind === "auto" && !settings.muted) card.querySelector("[data-note]").hidden = true; else noteIfSilent();
  goStep(start, 1);
}
async function goStep(i, dir = 1) {
  if (!tour) return;
  const { steps } = tour;
  runCleanup();
  // шаг экскурсии-автопилота может сам открыть нужную страницу
  const target = steps[Math.max(0, Math.min(i, steps.length - 1))];
  if (i >= 0 && i < steps.length && target.go && location.hash !== target.go) {
    const my = tour;
    stopSpeech();
    setFocus(null);
    card.querySelector("[data-title]").textContent = "Открываю страницу…";
    card.querySelector("[data-text]").innerHTML = "";
    await navigate(target.go);
    if (tour !== my) return;
  }
  // пропускаем шаги, чей предмет скрыт на этом экране
  while (i >= 0 && i < steps.length) {
    const el = steps[i].el ? steps[i].el() : null;
    if (!steps[i].el || visible(el)) { tour.el = el; break; }
    if (steps[i].soft) { tour.el = null; break; } // предмет скрыт, но рассказ нужен — без подсветки
    i += dir;
  }
  if (i < 0) i = 0;
  if (i >= steps.length) return finish();
  stopSpeech();
  tour.i = i;
  const st = steps[i];
  tour.sent = sentences(st.text);
  tour.si = 0;
  card.querySelector("[data-title]").textContent = st.title || "";
  card.querySelector("[data-count]").textContent = steps.length > 1 ? `${i + 1} / ${steps.length}` : "";
  card.querySelector("[data-text]").innerHTML = tour.sent.map((s, k) => `<span data-s="${k}">${esc(s)}</span>`).join(" ");
  card.querySelector("[data-prev]").disabled = i === 0;
  card.querySelector("[data-next]").disabled = false;
  setFocus(tour.el, st.tag ?? st.title);
  if (tour.el) reveal(tour.el);
  if (tour.playing) play(); else paintPlay();
  if (st.act) runAct(st, i);
}
function markSentence(k) {
  if (!tour) return;
  tour.si = k;
  $$("[data-s]", card).forEach((s) => s.classList.toggle("on", +s.dataset.s === k));
  const cur = card.querySelector(`[data-s="${k}"]`);
  const box = card.querySelector("[data-text]");
  if (cur && box.scrollHeight > box.clientHeight) box.scrollTop = cur.offsetTop - box.offsetTop - 8;
}
function play() {
  if (!tour) return;
  tour.playing = true;
  paintPlay();
  const myStep = tour.i;
  const done = () => {
    if (!tour || tour.i !== myStep) return;
    tour.si = 0;
    if (tour.steps.length > 1 && tour.i < tour.steps.length - 1) timer = setTimeout(() => tour && tour.playing && goStep(tour.i + 1, 1), 650);
    else finish();
  };
  const st = tour.steps[tour.i];
  if (st.audio && !settings.muted) return playClip(st, myStep, done);
  speak(tour.sent, tour.si, markSentence, done);
}

// --- записанный голос (ElevenLabs): один mp3 на шаг ---
const clip = typeof Audio !== "undefined" ? new Audio() : null;
if (clip) clip.preload = "auto";
function playClip(st, myStep, done) {
  stopSpeech();
  const my = gen;
  const total = tour.sent.reduce((a, s) => a + s.length, 0) || 1;
  const src = new URL(st.audio, document.baseURI).href;
  if (clip.src !== src) clip.src = src;
  clip.playbackRate = settings.rate;
  clip.ontimeupdate = () => {
    if (my !== gen || !tour || tour.i !== myStep || !clip.duration) return;
    // подсветка фразы — по доле прочитанного текста
    const pos = (clip.currentTime / clip.duration) * total;
    let acc = 0, k = 0;
    for (; k < tour.sent.length - 1; k++) { acc += tour.sent[k].length; if (acc > pos) break; }
    if (k !== tour.si || !card.querySelector("[data-s].on")) markSentence(k);
  };
  clip.onended = () => { if (my === gen) done(); };
  // запись не загрузилась — читаем встроенным голосом
  clip.onerror = () => { if (my === gen) speak(tour.sent, tour.si, markSentence, done); };
  const pr = clip.play();
  pr?.catch?.((e) => { if (my === gen && e?.name !== "AbortError") speak(tour.sent, tour.si, markSentence, done); });
}
function stopClip() { if (clip && !clip.paused) clip.pause(); }

// --- переходы и действия автопилота ---
let autoNav = false, routeWaiters = [];
function navigate(hash) {
  return new Promise((res) => {
    routeWaiters.push(res);
    autoNav = true;
    location.hash = hash;
    setTimeout(res, 6000); // страховка
  }).then(() => new Promise((r) => setTimeout(r, 500)));
}
let cleanups = [];
function runCleanup() { const c = cleanups; cleanups = []; c.forEach((f) => { try { f(); } catch {} }); }
function runAct(st, stepIdx) {
  const my = tour;
  const alive = () => tour === my && tour.i === stepIdx;
  const wait = (ms) => new Promise((r) => {
    // во время паузы действия тоже ждут
    let left = ms, last = performance.now();
    const t = () => {
      const now = performance.now();
      if (tour?.playing) left -= now - last;
      last = now;
      if (!alive() || left <= 0) return r();
      setTimeout(t, 100);
    };
    setTimeout(t, 100);
  });
  const ctx = {
    alive, wait,
    focus: (el, label, still) => { if (alive() && el) { tour.el = el; setFocus(el, label ?? st.tag ?? st.title); if (!still) reveal(el); } },
    cleanup: (f) => cleanups.push(f),
    click: (el) => el && alive() && el.click(),
    set: (el, v, ev = "input") => { if (!el || !alive()) return; el.value = v; el.dispatchEvent(new Event(ev, { bubbles: true })); },
    async type(el, text) { for (let k = 1; k <= text.length && alive(); k++) { el.value = text.slice(0, k); el.dispatchEvent(new Event("input", { bubbles: true })); await wait(140); } },
    async slide(el, from, to, ms) { const n = Math.max(1, Math.round(ms / 50)); for (let k = 0; k <= n && alive(); k++) { el.value = from + ((to - from) * k) / n; el.dispatchEvent(new Event("input", { bubbles: true })); await wait(50); } },
  };
  Promise.resolve().then(() => st.act(ctx)).catch((e) => console.warn("guide act", e));
}
function finish() {
  if (!tour) return;
  stopSpeech();
  stopClip();
  tour.playing = false;
  tour.ended = true;
  $$("[data-s]", card).forEach((s) => s.classList.remove("on"));
  paintPlay();
  card.querySelector("[data-next]").disabled = true;
}
function togglePlay() {
  if (!tour) return;
  if (tour.ended) { tour.ended = false; tour.playing = true; return goStep(tour.steps.length > 1 ? 0 : tour.i, 1); }
  const st = tour.steps[tour.i];
  if (tour.playing) { tour.playing = false; stopSpeech(); stopClip(); paintPlay(); }
  else if (st?.audio && !settings.muted && clip.src && clip.currentTime > 0 && !clip.ended) { tour.playing = true; paintPlay(); clip.play().catch(() => {}); }
  else play();
}
function paintPlay() {
  const b = card.querySelector("[data-play]");
  const ended = tour?.ended;
  b.innerHTML = ended ? ICON.again : tour?.playing ? ICON.pause : ICON.play;
  b.setAttribute("aria-label", ended ? "Сначала" : tour?.playing ? "Пауза" : "Слушать");
}
function replayCurrent() { if (tour && tour.playing && !tour.ended) play(); }
function noteIfSilent() {
  const n = card.querySelector("[data-note]");
  let msg = "";
  if (!synth) msg = "Этот браузер не умеет говорить — читай субтитры, они сменяются сами.";
  else if (settings.muted) msg = "Звук выключен в настройках (шестерёнка) — показываю субтитры.";
  else if (allVoicesCount > 0 && !ruVoices.length) msg = "На устройстве нет русского голоса — показываю субтитры. Голос можно добавить в настройках системы (Специальные возможности → Речь).";
  n.textContent = msg;
  n.hidden = !msg;
}
export function stopAll(keepCard = false) {
  stopSpeech();
  stopClip();
  runCleanup();
  tour = null;
  explain = false;
  document.body.classList.remove("guide-explain");
  banner.hidden = true;
  setFocus(null);
  if (!keepCard) { card.hidden = true; spot.hidden = true; document.body.classList.remove("guide-open"); }
}

// =====================================================================
// 5. Сценарии страниц
// =====================================================================
const q = (sel) => () => $(sel);
const K = (adult, child) => (isKid() && child ? child : adult);
const gt = (id) => GLOSSARY[id];
const num = (v, d = 2) => (v == null ? null : fmt(Math.round(v * 10 ** d) / 10 ** d, d + 2));

function commonHeaderSteps() {
  return [
    { el: () => $(".top-tools .seg"), title: "Детям или взрослым", text: K("Переключатель «Детям — Взрослым» меняет глубину объяснений. В режиме «Детям» — простые слова, сравнения и крупный текст. В режиме «Взрослым» — точные определения, формулы и подробности.", "Видишь кнопки «Детям» и «Взрослым»? Нажми «Детям» — и всё будет объясняться простыми словами. «Взрослым» — это для мам, пап и учителей, там больше формул.") },
    { el: () => (visible($("#nav")) ? $("#nav") : $("#menuBtn")), title: "Разделы сайта", text: K("Здесь разделы сайта. Таблица — периодическая система, с неё всё начинается. Курс — уроки по порядку, от атома до радиоактивности. 3D-лаборатория — молекулы, которые можно крутить. Словарь — все химические слова с объяснениями.", "Здесь живут разделы сайта: Таблица элементов, Курс с уроками, 3D-лаборатория с молекулами и Словарь, где объяснены все трудные слова.") },
    { el: q("#themeBtn"), title: "Тема", text: "Эта кнопка переключает светлую и тёмную тему. Выбирай, как удобнее глазам." },
  ];
}

function homeSteps() {
  const fe = () => $('.el[href="#element-26"]');
  return [
    { el: q(".hero h1"), title: "Добро пожаловать", text: K("Привет! Я гид по сайту «Химия с нуля». Сейчас я покажу, что где находится и что означает. Слушай, а подсветка будет показывать, о чём я говорю. Остановить меня можно кнопкой паузы.", "Привет! Я твой гид по химии. Я покажу и расскажу, что здесь что. Смотри туда, где светится рамка!") },
    { el: q(".hero-stats"), title: "Цифры", text: "Здесь сводка: 118 химических элементов, 14 уроков с 3D-моделями и сколько уроков ты уже прошёл. Прогресс запоминается в этом браузере." },
    ...commonHeaderSteps(),
    { el: q(".pt"), title: "Таблица Менделеева", text: K("Это периодическая таблица Менделеева — карта всех известных элементов. Элементы стоят по порядку номеров. Строки называются периодами: номер периода равен числу электронных оболочек атома. Столбцы — группы: у элементов одной группы похожие свойства, потому что одинаково устроена внешняя оболочка.", "Это таблица Менделеева — домик, где живут все 118 элементов, из которых сделано всё на свете: ты, вода, воздух и звёзды. Каждая клеточка — один элемент. Элементы в одном столбике похожи, как родственники.") },
    { el: fe, title: "Одна клетка", tag: "Железо", text: K("Посмотри на одну клетку — железо. Маленькое число в углу — атомный номер, 26: столько протонов в ядре атома железа и столько же электронов вокруг. Крупные буквы Fe — химический символ, от латинского слова феррум. Внизу — название по-русски. Цвет клетки показывает семейство: железо — переходный металл.", "Вот клеточка железа. Число 26 — это номер элемента: в серединке атома железа 26 маленьких частичек-протонов. Буквы Fe — короткое имя железа, учёные всего мира пишут его одинаково. А внизу написано по-русски: железо.") },
    { el: q('.el[href="#element-80"]'), title: "Значки в углу", tag: "Ртуть", text: "Маленький значок в углу клетки показывает состояние при комнатной температуре. Голубая точка — жидкость, как у ртути и брома. Пустой кружок — газ, как у кислорода или гелия. Без значка — твёрдое вещество." },
    { el: q('.el[href="#element-57"]'), title: "Две строки внизу", tag: "Лантаноиды", text: "Две отдельные строки внизу — лантаноиды и актиноиды. На самом деле они стоят внутри шестого и седьмого периодов, но если вставить их на место, таблица станет очень длинной. Поэтому их выносят вниз — в таблице на их месте видны подписи 57–71 и 89–103." },
    { el: q(".pt-tools input[type=search]"), title: "Поиск", text: "Поиск: напиши название, символ или номер элемента — например «железо», Fe или 26 — и нужная клетка подсветится. Нажми Enter, чтобы сразу открыть элемент." },
    { el: q(".pt-tools select"), title: "Раскраска", text: "Раскраска меняет смысл цветов. Можно раскрасить по семействам, по агрегатному состоянию, по блокам s, p, d, f, по электроотрицательности, массе, плотности, температуре плавления или году открытия. Так видно, как свойства меняются по таблице." },
    { el: () => $(".legend") || $(".scale-bar"), title: "Легенда", text: K("Легенда объясняет цвета. Каждый цвет — семейство элементов: щелочные металлы, галогены, благородные газы и другие. Нажми на семейство, и в таблице подсветятся только его элементы.", "Легенда рассказывает, что значит каждый цвет. Нажми на цвет — и в таблице останутся только элементы этого семейства.") },
    { el: q(".pt-view"), title: "Вид таблицы", text: "Кнопки «Таблица» и «Плитки» меняют вид. «Таблица» — классическая форма. «Плитки» — все элементы крупными квадратиками по порядку, это удобно на телефоне." },
    { el: q(".lessons"), title: "Курс", text: "Ниже начинается курс. Каждая карточка — урок с 3D-моделями и маленьким тестом в конце. Лучше проходить их по порядку: каждый следующий опирается на предыдущий." },
    { el: () => fab, soft: true, title: "Я всегда рядом", text: K("Я живу в этой кнопке внизу. Нажми её на любой странице: я расскажу о странице, прочитаю урок вслух или включу режим «Что это?» — тогда можно нажать на любой предмет, и я объясню, что он означает. А теперь нажми на любую клетку таблицы!", "Я живу в этой кнопочке. Нажми её, когда что-то непонятно, выбери «Что это?» и ткни в любую вещь на экране — я объясню. А теперь нажми на любой элемент в таблице!") },
  ];
}

function elementSteps(z) {
  const e = ELEMENTS[z - 1];
  if (!e) return [];
  const n = Math.max(0, Math.round(e.mass) - e.z);
  const val = e.shells[e.shells.length - 1];
  const say = (v) => num(v, 2);
  return [
    { el: q(".el-tile"), title: "Карточка элемента", tag: e.name, text: K(`Это ${e.name}, элемент номер ${e.z}. Число вверху — атомный номер: в ядре ${e.z} ${plural(e.z, "протон", "протона", "протонов")}. Химический символ — ${e.sym}, от латинского названия ${e.latin}. Число внизу — атомная масса, ${say(e.mass)} атомной единицы: во столько раз атом тяжелее одной двенадцатой атома углерода.`, `Это ${e.name}. Его номер ${e.z} — значит, в серединке атома ${e.z} ${plural(e.z, "протон", "протона", "протонов")}. Его короткое имя из латинских букв — ${e.sym}. А число внизу говорит, сколько весит атом.`) },
    { el: q(".el-head .muted"), title: "Семейство", text: `${e.name} относится к семейству «${CAT_NAMES[e.cat]}». ${gt(e.cat) ? K(gt(e.cat).def, gt(e.cat).kid) : ""}` },
    { el: () => $(".el-page .stage"), title: "3D-атом", text: K(`Это модель атома: в центре ядро, красные шарики — протоны, серые — нейтроны. У этого атома ${e.z} ${plural(e.z, "протон", "протона", "протонов")} и примерно ${n} ${plural(n, "нейтрон", "нейтрона", "нейтронов")}. Голубые шарики — электроны, они летают по кольцам-оболочкам. ${isTouch() ? "Веди пальцем вбок, чтобы повернуть атом, двумя пальцами — приблизить." : "Крути атом мышкой, колёсиком приближай."}`, `Это атом крупным планом. В серединке — ядро из красных протонов и серых нейтронов. Вокруг летают голубые электроны. ${isTouch() ? "Покрути атом пальцем!" : "Покрути атом мышкой!"}`) },
    { el: () => $(".stage-controls .ctl"), title: "Разрез", text: "Ползунок разреза снимает половину атома, как будто мы разрезали его ножом. Тяни его вправо — откроется ядро внутри. Флажок «облако оболочек» показывает оболочки прозрачными сферами." },
    { el: () => $(".el-page .kid-box"), title: "Для ребят", text: e.kid },
    { el: () => $(".el-page .kid-box + p"), title: "Описание", text: e.desc },
    { el: q(".props"), title: "Свойства", text: [
      `Это свойства элемента. Каждое название можно нажать, чтобы прочитать его определение.`,
      e.group ? `Группа ${e.group} — номер столбика в таблице.` : "Этот элемент из f-блока, у него нет номера группы.",
      `Период ${e.period}: значит, у атома ${e.period} ${plural(e.period, "электронная оболочка", "электронные оболочки", "электронных оболочек")}.`,
      `Состояние при двадцати градусах — ${STATE_NAMES[e.state]}.`,
      e.en != null ? `Электроотрицательность ${say(e.en)} — показывает, как сильно атом тянет к себе чужие электроны; у самого «жадного», фтора, почти 4.` : "",
      `Внешних электронов — ${val}: именно они участвуют в химических реакциях.`,
      e.density != null ? `Плотность ${num(e.density, e.density < 0.01 ? 4 : 2)} г/см³.` : "",
      e.mp != null ? `Плавится при ${num(e.mp, 0)} °C${e.bp != null ? `, кипит при ${num(e.bp, 0)} °C` : ""}.` : "",
    ].filter(Boolean).join(" ") },
    { el: q(".shell-bar"), title: "Оболочки", text: `Электроны по оболочкам: ${e.shells.map((x, i) => `на ${i + 1}-й — ${x}`).join(", ")}. Оболочки обозначают буквами K, L, M, N и дальше. Строка выше — электронная конфигурация: она показывает подуровни s, p, d, f и сколько электронов на каждом.` },
    { el: () => $$(".prop").find((p) => /Где встречается/.test(p.textContent)), title: "Где применяется", text: e.uses },
    { el: () => $(".view > div .chips"), title: "Родственники", text: `Это родственники по группе ${e.group}: элементы того же столбика. У них похожая внешняя оболочка, поэтому похожи и свойства. Нажми на любой, чтобы сравнить.` },
    { el: () => $(".view > .pager"), title: "Соседи", text: `Кнопки внизу ведут к соседям по таблице: элементам номер ${e.z - 1 || "—"} и ${e.z + 1}. ${isTouch() ? "" : "Можно листать и стрелками на клавиатуре."}` },
  ];
}

function courseSteps() {
  return [
    { el: q(".view h1"), title: "Курс", text: "Это весь курс: 14 уроков от «Что такое химия» до радиоактивности. Проходи их по порядку." },
    { el: q(".view .progress"), title: "Прогресс", text: "Полоска показывает, сколько уроков ты прошёл. Урок засчитывается, если в тесте в конце набрать 70 процентов или больше." },
    { el: q(".lesson-card"), title: "Карточка урока", text: "Каждая карточка — урок: номер, название, о чём он и метки, например «3D-конструктор» или «разрез». Галочка с процентами появится, когда урок пройден. Нажми на карточку, чтобы начать." },
    ...commonHeaderSteps().slice(0, 1),
  ];
}
function labSteps() {
  return [
    { el: q(".view h1"), title: "3D-лаборатория", text: "Это 3D-лаборатория: настоящие формы молекул. Длины связей и углы между ними — как у реальных молекул." },
    { el: q(".view .chips"), title: "Выбор молекулы", text: "Кнопки с формулами выбирают молекулу: вода, углекислый газ, метан, аммиак и другие. Нажми на любую." },
    { el: q(".view .stage"), title: "Модель", text: `Это сама модель. Шарики — атомы, палочки — химические связи. Цвета стандартные: белый — водород, красный — кислород, чёрный — углерод, синий — азот. Двойная палочка — двойная связь. ${isTouch() ? "Поворачивай пальцем, приближай двумя пальцами." : "Крути мышкой, приближай колёсиком."} Вверху — название, форма молекулы и угол между связями.` },
    { el: () => $(".view .stage")?.nextElementSibling?.querySelector(".seg"), title: "Вид модели", text: "«Шаростержневая» модель показывает связи. «Заполненная» — как атомы на самом деле заполняют пространство и прижимаются друг к другу. Флажок «Подписи» пишет над атомами их символы." },
    { el: () => $(".view .stage")?.nextElementSibling?.querySelector("[data-note]"), title: "Пояснение", text: "Здесь пояснение к выбранной молекуле и её молярная масса — сколько граммов весит один моль вещества." },
  ];
}
function glossarySteps() {
  return [
    { el: q(".view h1"), title: "Словарь", text: "Это словарь: все химические понятия сайта. У каждого есть строгое определение и объяснение по-простому." },
    { el: q(".view input[type=search]"), title: "Поиск", text: "Напиши слово, например «моль» или «ион», и останутся только нужные карточки." },
    { el: q(".view [data-list] .card"), title: "Карточка понятия", text: "В карточке сверху — строгое определение, в жёлтой рамке — «просто», объяснение для ребят. Ссылка внизу ведёт в урок, где это понятие разбирается подробно." },
  ];
}
function lessonPageSteps() {
  return [
    { el: q(".article h1"), title: "Урок", text: "Это страница урока. Её можно читать самому или нажать «Прочитать урок вслух» в моём меню — я буду показывать и объяснять всё по порядку. Кнопка-динамик рядом с каждым заголовком читает только этот раздел." },
    { el: q(".toc"), title: "Оглавление", text: "Оглавление: разделы урока. Нажми на любой, чтобы перейти к нему. Раздел, который ты сейчас читаешь, подсвечен." },
    { el: () => $(".article .stage"), title: "3D-модели", text: `В уроке есть 3D-модели. ${isTouch() ? "Веди пальцем вбок, чтобы вращать, двумя пальцами — масштаб. Вверх-вниз страница прокручивается как обычно." : "Крути их мышкой, колёсиком приближай."}` },
    { el: () => $(".article .term"), title: "Слова с пунктиром", text: "Слова, подчёркнутые пунктиром, — это понятия из словаря. Нажми на такое слово, и появится его определение. Там есть кнопка «Послушать»." },
    { el: q("#quiz"), title: "Тест", text: "В конце урока — тест. Выбери ответ, и сразу узнаешь, прав ли ты, и почему. Если наберёшь 70 процентов, урок засчитается." },
    { el: q(".article .pager"), title: "Дальше", text: "Кнопки внизу ведут к предыдущему и следующему уроку." },
  ];
}

// --- чтение урока по блокам ---
// видимый текст (скрытое режимом «Детям/Взрослым» не попадает): обходим узлы,
// пропускаем значки и кнопки «+ / −», блоки превращаем во фразы
function cleanText(root) {
  const parts = [];
  const walk = (n) => {
    for (const c of n.childNodes) {
      if (c.nodeType === 3) { parts.push(c.textContent); continue; }
      if (c.nodeType !== 1 || !visible(c)) continue;
      if (c.matches("svg, canvas, script, style, input, select, textarea, .say-sec, .hint")) continue;
      if (c.matches("button, [role=button]:not(.term)") && c.textContent.trim().length <= 2) continue;
      const block = !/inline/.test(getComputedStyle(c).display);
      if (block || c.tagName === "BR") parts.push("\n");
      walk(c);
      if (block) parts.push("\n");
    }
  };
  if (root.nodeType === 1 && visible(root)) walk(root);
  return parts.join("").split(/\n+/).map((l) => l.replace(/[▶←]/g, "").replace(/\s+/g, " ").trim()).filter(Boolean)
    .map((l) => (/[.!?:;…,]$/.test(l) ? l : l + ".")).join(" ").replace(/\s+/g, " ").trim();
}
function blockSteps(el, heading, out) {
  if (!visible(el)) return;
  const cls = el.classList;
  if (/^H[1-6]$/.test(el.tagName)) { heading.pending = cleanText(el); return; }
  const push = (text, title) => {
    text = String(text || "").trim();
    if (!text) return;
    const pre = heading.pending ? heading.pending.replace(/[.\s]+$/, "") + ". " : "";
    out.push({ el: () => el, title: title || heading.pending || heading.section || "", text: pre + text });
    heading.pending = "";
  };
  if (cls.contains("stage")) {
    const ov = el.querySelector(".overlay");
    push(`Это 3D-модель. ${ov ? cleanText(ov) + ". " : ""}${isTouch() ? "Поворачивай её пальцем, приближай двумя пальцами." : "Крути её мышкой, приближай колёсиком."}`, "3D-модель");
    return;
  }
  if (el.tagName === "IFRAME") { push(`Это схема: ${el.title}. Рассмотри её — на ней подписаны все части.`, "Схема"); return; }
  if (cls.contains("table-wrap") || el.tagName === "TABLE") {
    const rows = $$("tr", el).filter((r) => visible(r));
    const cell = (c) => cleanText(c).replace(/\.$/, "");
    const head = rows[0] ? $$("th,td", rows[0]).map(cell) : [];
    const lines = rows.slice(1, 8).map((r) => $$("td,th", r).map((c, i) => (i === 0 || !head[i] ? cell(c) : `${head[i]}: ${cell(c)}`)).join(", "));
    push(`Посмотри на таблицу${head.length ? `: ${head.join(", ")}` : ""}. ${lines.map((l) => l + ".").join(" ")}`, "Таблица");
    return;
  }
  if (el.querySelector?.(".builder")) {
    push("Это конструктор атома. Кнопками плюс и минус добавляй и убирай протоны, нейтроны и электроны — модель сразу перестроится. Ползунок «Разрез» разрезает атом пополам. Ниже я подскажу, какой элемент получился. " + cleanText(el.querySelector("[data-info]") || el), "Конструктор");
    return;
  }
  if (el.querySelector?.(".coef")) {
    push("Это тренажёр уравнивания. Кнопками плюс и минус меняй коэффициенты — числа перед формулами. Под уравнением счётчики: сколько атомов каждого вида слева и справа. Когда все счётчики станут зелёными, уравнение уравнено. Кнопка «Следующее» даёт новое уравнение.", "Тренажёр");
    return;
  }
  if (el.querySelector?.(".chips") && el.children.length === 1) {
    const labels = $$(".chip", el).map((c) => c.innerText.trim()).slice(0, 10);
    push(`Кнопками можно выбрать вариант: ${labels.join(", ")}.`, "Переключатели");
    return;
  }
  if (cls.contains("grid-2") || cls.contains("grid-3") || (el.tagName === "DIV" && !cls.contains("card") && !cls.contains("kid-box") && !cls.contains("callout") && el.children.length > 1 && [...el.children].some((c) => /^(P|UL|OL|DIV|SECTION|TABLE|H[2-4])$/.test(c.tagName)))) {
    [...el.children].forEach((c) => blockSteps(c, heading, out));
    return;
  }
  if (el.tagName === "DIV" && el.children.length === 1 && !cls.length) { blockSteps(el.firstElementChild, heading, out); return; }
  let t = cleanText(el);
  if (t.length > 900) t = t.slice(0, 900).replace(/\s\S*$/, "") + "…";
  push(t, cls.contains("kid-box") ? "Просто о сложном" : null);
}
function lessonSteps(fromSec) {
  const art = $(".article");
  if (!art) return [];
  const body = $(".body", art);
  const id = pageKind().id;
  const idx = LESSONS.findIndex((l) => l.id === id);
  const out = [];
  if (!fromSec) out.push({ el: () => $("h1", art), title: `Урок ${idx + 1}`, text: `Урок ${idx + 1}. ${LESSONS[idx]?.title}. ${LESSONS[idx]?.desc}` });
  let started = !fromSec;
  for (const block of [...body.children]) {
    if (block.id === "quiz") {
      if (started) out.push({ el: () => block, title: "Проверь себя", text: `А теперь проверь себя: ответь на ${$$(".q", block).length} вопросов. Нажми на ответ, который считаешь верным, — я подожду. Правильный ответ подсветится зелёным, а ниже появится объяснение.` });
      continue;
    }
    if (block.classList.contains("pager")) continue;
    if (fromSec && block.id === fromSec) started = true;
    else if (fromSec && block.tagName === "SECTION" && started) break;
    if (!started) continue;
    const heading = { pending: "", section: "" };
    if (block.tagName === "SECTION") {
      heading.section = cleanText($("h2", block) || block).slice(0, 60);
      [...block.children].forEach((c) => blockSteps(c, heading, out));
    } else blockSteps(block, heading, out);
  }
  return out;
}
// кнопки 🔊 у заголовков разделов урока
function addSectionButtons() {
  $$(".article .body > section[id] > h2").forEach((h2) => {
    if (h2.querySelector(".say-sec")) return;
    h2.appendChild(h(`<button type="button" class="say-sec" data-say-sec="${h2.parentElement.id}" aria-label="Прочитать раздел вслух" title="Прочитать раздел вслух">${ICON.speaker}</button>`));
  });
}

// --- «Покажи мне всё»: экскурсия-автопилот с записанным голосом ---
const A = (n) => `audio/tour/${String(n).padStart(2, "0")}.mp3`;
const SILENT = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";
function autoSteps() {
  return [
    { go: "#home", audio: A(1), el: q(".hero h1"), title: "Привет!", text: "Привет! Я голосовой гид по химии. Сейчас я сама покажу тебе весь сайт: куда нажимать, что всё означает и как здесь учиться. Просто смотри и слушай. Остановить меня можно кнопкой паузы." },
    { go: "#home", audio: A(2), el: q(".pt"), title: "Таблица Менделеева", text: "Это главная карта химии — таблица Менделеева. В ней сто восемнадцать элементов. Из них сделано всё вокруг: вода, воздух, ты сам и даже звёзды. Элементы стоят по порядку номеров. Строки называются периодами, а столбцы — группами. Элементы одной группы похожи друг на друга, как родственники." },
    { go: "#home", audio: A(3), el: q('.el[href="#element-26"]'), title: "Одна клетка", tag: "Железо", text: "Давай рассмотрим одну клетку — железо. Маленькое число в углу, двадцать шесть, — это атомный номер: столько протонов в ядре атома. Крупные латинские буквы — химический символ, его пишут одинаково во всём мире. Внизу — название по-русски. А цвет клетки показывает семейство: железо — переходный металл." },
    { go: "#home", audio: A(4), el: q(".pt-tools select"), title: "Раскраска", text: "Цвета можно менять. Смотри: я включаю раскраску по электроотрицательности. Это то, насколько сильно атом притягивает к себе электроны. Чем теплее цвет, тем сильнее. Видишь? Самые «жадные» до электронов элементы — справа вверху, у фтора и кислорода.",
      async act(c) {
        await c.wait(2200);
        c.set($(".pt-tools select"), "en", "change");
        await c.wait(8000);
        c.focus($('.el[href="#element-9"]'), "Фтор — самый «жадный»");
        c.cleanup(() => { const s = $(".pt-tools select"); if (s && s.value !== "cat") { s.value = "cat"; s.dispatchEvent(new Event("change", { bubbles: true })); } });
      } },
    { go: "#home", audio: A(5), el: () => $(".legend"), title: "Легенда", text: "Я вернула раскраску по семействам. Под таблицей — легенда: каждый цвет означает семейство элементов. Нажимаю на «Галогены» — и в таблице остались только они: фтор, хлор, бром и йод. Это очень активные неметаллы. Если нажать на цвет ещё раз, подсветка снимется.",
      async act(c) {
        const s = $(".pt-tools select");
        if (s.value !== "cat") { c.set(s, "cat", "change"); c.focus($(".legend"), "Легенда"); }
        await c.wait(7600);
        c.click($('.legend button[data-k="halogen"]'));
        c.focus($('.el[href="#element-17"]'), "Галогены: F, Cl, Br, I");
        c.cleanup(() => { const b = $('.legend button[data-k="halogen"].on'); b?.click(); });
      } },
    { go: "#home", audio: A(6), el: q(".pt-tools input[type=search]"), title: "Поиск", text: "А это поиск. Я пишу слово «кислород» — и нужная клетка сразу подсвечивается. Искать можно и по названию, и по символу, и по номеру. А если нажать «Ввод», сразу откроется страница элемента.",
      async act(c) {
        const inp = $(".pt-tools input[type=search]");
        c.cleanup(() => { inp.value = ""; inp.dispatchEvent(new Event("input", { bubbles: true })); });
        await c.wait(1200);
        await c.type(inp, "кислород");
        await c.wait(600);
        c.focus($('.el[href="#element-8"]'), "Кислород");
        reveal($('.el[href="#element-8"]'));
      } },
    { go: "#element-26", audio: A(7), el: q(".el-tile"), title: "Страница элемента", tag: "Железо", text: "Теперь я открываю страницу железа. Здесь собрано всё об элементе. На карточке — номер и символ, а число внизу — атомная масса: во сколько раз атом железа тяжелее одной двенадцатой части атома углерода." },
    { go: "#element-26", audio: A(8), el: () => $(".el-page .stage"), title: "Атом в 3D", text: "А это сам атом железа в 3D. В центре — ядро: красные шарики — протоны, серые — нейтроны. Вокруг по кольцам-оболочкам летают голубые электроны. Смотри, я двигаю ползунок разреза — и атом разрезается пополам, как яблоко. Модель можно крутить пальцем или мышкой.",
      async act(c) {
        await c.wait(10200);
        const r = $(".stage-controls input[type=range]");
        if (!r) return;
        c.focus(r.closest(".card"), "Разрез");
        await c.slide(r, 0, 0.9, 2600);
      } },
    { go: "#element-26", audio: A(9), el: q(".props"), title: "Свойства", text: "Ниже — свойства элемента, и каждое название можно нажать. Я нажимаю на «Электроотрицательность» — и появляется объяснение, что это значит. Так на сайте устроены все трудные слова. Слова, подчёркнутые пунктиром, тоже нажимаются.",
      async act(c) {
        c.cleanup(closePop);
        await c.wait(3800);
        const b = $('.prop .k[data-term="en"]');
        if (!b || !c.alive()) return;
        // кнопку — к верху экрана, чтобы определение раскрылось над карточкой гида
        window.scrollTo({ top: b.getBoundingClientRect().top + window.scrollY - headerH() - 16, behavior: "smooth" });
        await c.wait(900);
        b.click();
        await c.wait(150);
        // без прокрутки: всплывающее определение закрывается, если страницу двигать
        c.focus($(".pop"), "Определение", true);
      } },
    { go: "#course", audio: A(10), el: () => $(".view .lessons"), title: "Курс", text: "Это курс: четырнадцать уроков — от самого начала, что такое химия, до радиоактивности. Проходи их по порядку. В конце каждого урока — небольшой тест. Если ответишь правильно хотя бы на семьдесят процентов, урок засчитается, и на карточке появится галочка." },
    { go: "#lesson-atom", audio: A(11), el: () => $(".builder")?.closest(".card"), title: "Конструктор атома", text: "Вот урок о строении атома. Здесь есть конструктор: кнопками плюс и минус можно добавлять протоны, нейтроны и электроны. Смотри: я нажимаю «Водород» — это самый простой атом, один протон и один электрон. А теперь «Углерод» — шесть протонов. Сайт сам подсказывает, какой элемент получился.",
      async act(c) {
        await c.wait(8600);
        c.click($('#builder [data-p="1,0,1"]'));
        c.focus($("#builder .stage"), "Водород");
        await c.wait(5300);
        c.click($('#builder [data-p="6,6,6"]'));
        c.focus($("#builder .stage"), "Углерод");
      } },
    { audio: A(12), el: q(".top-tools .seg"), title: "Детям или взрослым", text: "Наверху есть переключатель «Детям — Взрослым». В режиме «Детям» всё объясняется простыми словами и крупным текстом. В режиме «Взрослым» — точные определения и формулы. Выбирай, как тебе удобнее." },
    { go: "#lab", audio: A(13), el: () => $(".view .stage"), title: "3D-лаборатория", text: "А это 3D-лаборатория. Здесь живут молекулы с настоящей формой. Я выбираю воду: шарики — это атомы, палочки — связи между ними. Красный шарик — кислород, белые — водород. Теперь включаю «заполненную» модель — так атомы выглядят на самом деле, плотно прижавшись друг к другу.",
      async act(c) {
        await c.wait(4200);
        c.click($$(".view .chip").find((x) => x.textContent.trim() === "H₂O"));
        await c.wait(7400);
        c.click($('.view [data-s="spacefill"]'));
      } },
    { go: "#home", audio: A(14), el: () => fab, soft: true, title: "Я всегда рядом", text: "Вот и всё! Я живу в этой кнопке. Нажми её на любой странице: я расскажу об этой странице, прочитаю урок вслух или включу режим «Что это?» — тогда нажимай на любой предмет, и я объясню, что он значит. Удачи в изучении химии!" },
  ];
}
export function startAuto(start = 0) {
  // разблокировать звук на iPhone: первый play() должен быть прямо в обработчике нажатия,
  // а экскурсия может начаться после перехода на главную — проигрываем пустой звук
  if (clip && location.hash.replace(/^#\/?/, "") !== "home" && location.hash !== "") {
    try { clip.src = SILENT; clip.play().catch(() => {}); } catch {}
  }
  runSteps(autoSteps(), "auto", start);
}

function startTour() {
  const pk = pageKind();
  const steps = pk.kind === "element" ? elementSteps(pk.z) : pk.kind === "course" ? courseSteps() : pk.kind === "lab" ? labSteps() : pk.kind === "glossary" ? glossarySteps() : pk.kind === "lesson" ? lessonPageSteps() : homeSteps();
  runSteps(steps, "tour");
}
function startLesson(fromSec) { runSteps(lessonSteps(fromSec), "lesson"); }

// =====================================================================
// 6. Режим «Что это?»
// =====================================================================
function plural(n, one, few, many) {
  const a = Math.abs(n) % 100, b = a % 10;
  return a > 10 && a < 20 ? many : b === 1 ? one : b >= 2 && b <= 4 ? few : many;
}
const termText = (id) => { const g = gt(id); return g ? `${g.term}. ${K(g.def + " Проще говоря: " + g.kid, g.kid)}` : ""; };

// [селектор, (найденный элемент, исходный клик) => { title, text } | null]
const EXPLAIN = [
  [".el", (el) => {
    const z = +el.getAttribute("href").replace(/\D/g, "");
    const e = ELEMENTS[z - 1];
    return { title: `${e.name}, ${e.sym}`, text: K(`${e.name}, символ ${e.sym}, элемент номер ${e.z}. Номер означает, что в ядре ${e.z} ${plural(e.z, "протон", "протона", "протонов")}. Семейство: ${CAT_NAMES[e.cat]}. При комнатной температуре — ${STATE_NAMES[e.state]}. ${e.desc}`, `Это ${e.name}, номер ${e.z}. ${e.kid}`) + " Чтобы открыть элемент, выйди из режима «Что это?» и нажми на клетку." };
  }],
  [".el-tile", (el) => {
    const z = +$(".n", el).textContent, e = ELEMENTS[z - 1];
    return { title: "Карточка элемента", text: `Вверху атомный номер — ${e.z}: число протонов в ядре. В центре символ ${e.sym}. Внизу атомная масса — ${num(e.mass, 2)}: средняя масса атома в атомных единицах.` };
  }],
  [".prop", (el) => {
    const k = el.querySelector("[data-term]");
    const v = el.querySelector(".v");
    if (!k) return { title: "Применение", text: cleanText(el) };
    return { title: k.textContent, text: `${termText(k.dataset.term)} ${v ? `У этого элемента: ${cleanText(v)}.` : ""}` };
  }],
  ["[data-term]", (el) => ({ title: gt(el.dataset.term)?.term || el.textContent, text: termText(el.dataset.term) })],
  [".shell-bar", (el) => ({ title: "Оболочки", text: `Электроны по оболочкам K, L, M, N…: ${cleanText(el)}. Каждая оболочка — свой «этаж» вокруг ядра. Чем дальше этаж, тем больше энергия электрона.` })],
  [".stage", (el) => ({ title: "3D-модель", text: `Это трёхмерная модель. ${el.querySelector(".overlay") ? cleanText(el.querySelector(".overlay")) + ". " : ""}${isTouch() ? "Веди пальцем вбок, чтобы её повернуть, двумя пальцами — приблизить." : "Крути её мышкой, приближай колёсиком."}` })],
  ["input[type=range]", (el) => ({ title: "Ползунок", text: `Это ползунок. Тяни его, чтобы менять значение. ${cleanText(el.closest("label, .ctl, .row, .card") || el).slice(0, 300)}` })],
  ["label", (el) => (el.querySelector("input[type=checkbox]") ? { title: "Флажок", text: `Флажок «${cleanText(el)}». Поставь или сними галочку, чтобы включить или выключить это.` } : null)],
  [".coef", () => ({ title: "Коэффициент", text: "Это коэффициент — число перед формулой. Плюс и минус меняют его. Коэффициент показывает, сколько молекул участвует в реакции. Подбирай коэффициенты, пока атомов каждого вида слева и справа не станет поровну." })],
  [".atom-count", () => ({ title: "Счётчики атомов", text: "Счётчики показывают, сколько атомов каждого вида слева и справа от стрелки. Зелёный — поровну, красный — ещё не уравнено." })],
  ["[data-mode]", (el) => ({ title: el.textContent, text: el.dataset.mode === "kid" ? "Режим «Детям»: простые объяснения, сравнения и крупный текст." : "Режим «Взрослым»: точные определения, формулы и подробности." })],
  ["#themeBtn", () => ({ title: "Тема", text: "Переключает светлую и тёмную тему." })],
  ["#menuBtn", () => ({ title: "Меню", text: "Открывает меню разделов: Таблица, Курс, 3D-лаборатория и Словарь." })],
  [".nav a", (el) => ({ title: el.textContent, text: { home: "Таблица Менделеева — главная страница. Нажми любой элемент, чтобы открыть его 3D-атом.", course: "Курс: 14 уроков по порядку, с 3D-моделями и тестами.", lab: "3D-лаборатория: молекулы с настоящей геометрией, их можно крутить.", glossary: "Словарь: все химические понятия с объяснениями." }[el.dataset.nav] })],
  [".brand", () => ({ title: "Химия с нуля", text: "Логотип: атом с ядром и орбитами электронов. Нажми, чтобы вернуться на главную, к таблице." })],
  [".pt-tools input[type=search], .view input[type=search]", () => ({ title: "Поиск", text: "Поле поиска. Напиши слово, и останется только то, что подходит." })],
  [".pt-tools select", () => ({ title: "Раскраска", text: "Выбирает, что показывают цвета таблицы: семейства, состояние, блоки или числовые свойства, например электроотрицательность или плотность." })],
  [".pt-view", () => ({ title: "Вид таблицы", text: "«Таблица» — классический вид, «Плитки» — крупные квадратики по порядку, удобно на телефоне." })],
  [".legend button", (el) => {
    const k = el.dataset.k;
    if (gt(k)) return { title: el.textContent, text: termText(k) + " Нажми на этот цвет без режима «Что это?», и в таблице подсветятся только эти элементы." };
    return { title: el.textContent, text: `Цвет «${el.textContent}». ${k?.length === 1 ? termText("block") : ""}` };
  }],
  [".scale-bar, .scale-lbl", () => ({ title: "Шкала", text: "Цветовая шкала: слева — самые маленькие значения, справа — самые большие. Чем «теплее» цвет клетки, тем больше значение." })],
  [".pt .gap", () => ({ title: "Лантаноиды и актиноиды", text: "Здесь должны стоять лантаноиды (57–71) или актиноиды (89–103). Их вынесли в две нижние строки, чтобы таблица не была слишком широкой." })],
  [".hero-stats .stat", (el) => {
    const t = el.innerText.replace(/\s+/g, " ").trim();
    const why = /пройдено/.test(t) ? "Столько уроков ты уже прошёл. Урок засчитывается, если тест в конце сдан на 70 процентов. Прогресс хранится в этом браузере."
      : /урок/.test(t) ? "Столько уроков в курсе. В каждом есть 3D-модели и небольшой тест."
      : "Столько химических элементов известно людям сегодня. Все они стоят в таблице ниже — от водорода, номер 1, до оганесона, номер 118.";
    return { title: t, text: `${t}. ${why}` };
  }],
  [".lesson-card", (el) => ({ title: $("h3", el)?.textContent, text: `Урок «${$("h3", el)?.textContent}». ${$("p", el)?.textContent || ""} Нажми на карточку без режима «Что это?», чтобы начать урок.` })],
  [".chip", (el) => ({ title: el.textContent, text: `Кнопка-переключатель «${cleanText(el)}». Нажми её, чтобы выбрать этот вариант.${/^#element-/.test(el.getAttribute("href") || "") ? " Она ведёт на страницу элемента." : ""}` })],
  [".kid-box", (el) => ({ title: "Просто о сложном", text: `Жёлтая рамка — объяснение для ребят простыми словами. ${cleanText(el)}` })],
  [".callout", (el) => ({ title: "Важно", text: cleanText(el) })],
  [".quiz .opt", () => ({ title: "Вариант ответа", text: "Это вариант ответа в тесте. Выйди из режима «Что это?» и нажми ответ, который считаешь верным." })],
  [".quiz", () => ({ title: "Тест", text: "Тест по уроку. Выбери ответ, и сразу узнаешь, верно ли, и почему. 70 процентов — урок пройден." })],
  [".toc", () => ({ title: "Оглавление", text: "Оглавление урока: нажми на раздел, чтобы перейти к нему." })],
  [".progress", () => ({ title: "Прогресс", text: "Полоска прогресса: сколько уроков уже пройдено." })],
  [".say-sec", () => ({ title: "Динамик", text: "Кнопка-динамик читает вслух этот раздел урока." })],
  [".pager a, .crumbs a", (el) => ({ title: "Переход", text: `Ссылка «${cleanText(el)}». Ведёт на другую страницу.` })],
  [".formula", (el) => ({ title: "Формула", text: `Формула: ${cleanText(el)}. Читается так: ${toSpeech(cleanText(el))}. Маленькие цифры внизу — индексы: сколько атомов в молекуле.` })],
  ["table.data", (el, ev) => { const td = ev.target.closest("td,th"); return { title: "Таблица", text: td ? `В этой клетке таблицы: ${cleanText(td)}.` : cleanText(el).slice(0, 400) }; }],
  [".btn, button", (el) => ({ title: "Кнопка", text: `Кнопка «${cleanText(el) || el.getAttribute("aria-label") || ""}».` })],
  ["h1, h2, h3, h4, p, li, td, .card, .tag", (el) => { const t = cleanText(el); return t ? { title: "Здесь написано", text: t.length > 500 ? t.slice(0, 500).replace(/\s\S*$/, "") + "…" : t } : null; }],
];

function startExplain() {
  stopAll(true);
  explain = true;
  document.body.classList.add("guide-explain");
  banner.hidden = false;
  card.hidden = true;
  spot.hidden = true;
}
function onExplainClick(ev) {
  if (!explain) return;
  if (ev.target.closest(".pop")) return;
  if (ev.target.closest(".guide-card, .guide-banner, .guide-fab, .guide-menu")) return;
  ev.preventDefault();
  ev.stopPropagation();
  let res = null, hit = null;
  for (const [sel, fn] of EXPLAIN) {
    const el = ev.target.closest(sel);
    if (!el || el.closest("header.top") && !/data-mode|themeBtn|menuBtn|nav|brand/.test(sel)) continue;
    const r = fn(el, ev);
    if (r && r.text) { res = r; hit = el; break; }
  }
  if (!res) return;
  tour = { steps: [{ el: () => hit, title: res.title, text: res.text }], i: -1, playing: true, sent: [], si: 0, kind: "explain" };
  card.hidden = false;
  card.classList.add("explain");
  card.querySelector("[data-exitx]").hidden = false;
  card.querySelector("[data-prev]").hidden = card.querySelector("[data-next]").hidden = true;
  banner.hidden = true;
  noteIfSilent();
  goStep(0, 1);
}

// =====================================================================
// 7. Подключение
// =====================================================================
export function initGuide() {
  buildUI();
  window.addEventListener("hashchange", () => {
    closeMenu();
    if (autoNav) { autoNav = false; return; }
    stopAll();
  });
}
// вызывается после отрисовки каждой страницы
export function guideAfterRoute() {
  const w = routeWaiters; routeWaiters = []; w.forEach((r) => r());
  if (pageKind().kind === "lesson") addSectionButtons();
}
// для проверки: тексты всех шагов текущей страницы (как они будут произнесены)
export function guideScript(kind = "lesson") {
  const pk = pageKind();
  const steps = kind === "lesson" ? lessonSteps() : pk.kind === "element" ? elementSteps(pk.z) : pk.kind === "course" ? courseSteps() : pk.kind === "lab" ? labSteps() : pk.kind === "glossary" ? glossarySteps() : pk.kind === "lesson" ? lessonPageSteps() : homeSteps();
  return steps.map((s) => ({ title: s.title, found: !s.el || visible(s.el()), say: toSpeech(s.text) }));
}
