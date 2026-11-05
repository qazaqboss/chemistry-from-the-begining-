// Небольшие химические расчёты, общие для всего сайта.
import { ELEMENTS } from "./data/elements.js";

export const BY_SYMBOL = Object.fromEntries(ELEMENTS.map((e) => [e.sym, e]));
export const byZ = (z) => ELEMENTS[z - 1];

const SUP = { "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹", "+": "⁺", "-": "⁻", "−": "⁻" };
const SUB = { "0": "₀", "1": "₁", "2": "₂", "3": "₃", "4": "₄", "5": "₅", "6": "₆", "7": "₇", "8": "₈", "9": "₉" };
export const sup = (s) => String(s).replace(/[0-9+\-−]/g, (c) => SUP[c] || c);
export const sub = (s) => String(s).replace(/[0-9]/g, (c) => SUB[c] || c);
// "H2SO4" → "H₂SO₄"
export const pretty = (f) => String(f).replace(/([A-Za-z\)\]])(\d+)/g, (_, a, d) => a + sub(d));

export const L_LETTER = ["s", "p", "d", "f", "g"];
export const L_CAP = [2, 6, 10, 14, 18];

// Порядок заполнения по правилу Клечковского (n + l, затем n)
export const MADELUNG = (() => {
  const list = [];
  for (let n = 1; n <= 8; n++) for (let l = 0; l < Math.min(n, 4); l++) list.push({ n, l });
  list.sort((a, b) => a.n + a.l - (b.n + b.l) || a.n - b.n);
  return list;
})();

// Идеальная (по правилу) конфигурация для числа электронов
export function madelung(count) {
  const out = [];
  let left = count;
  for (const { n, l } of MADELUNG) {
    if (left <= 0) break;
    const k = Math.min(L_CAP[l], left);
    out.push({ n, l, count: k });
    left -= k;
  }
  return out;
}

// Разбор строки конфигурации из данных ("[Ne] 3s² 3p⁴") в подуровни
const NOBLE = { He: 2, Ne: 10, Ar: 18, Kr: 36, Xe: 54, Rn: 86 };
const UNSUP = Object.fromEntries(Object.entries(SUP).map(([a, b]) => [b, a]));
export function parseConfig(str) {
  if (!str) return [];
  let out = [];
  const m = str.match(/\[(\w+)\]/);
  if (m && NOBLE[m[1]]) out = madelung(NOBLE[m[1]]);
  const re = /(\d)([spdfg])([⁰¹²³⁴⁵⁶⁷⁸⁹]+|\d+)?/g;
  let t;
  const body = str.replace(/\[\w+\]/, "");
  while ((t = re.exec(body))) {
    const n = +t[1];
    const l = L_LETTER.indexOf(t[2]);
    const cnt = t[3] ? +[...t[3]].map((c) => UNSUP[c] ?? c).join("") : 1;
    const ex = out.find((s) => s.n === n && s.l === l);
    if (ex) ex.count = cnt; else out.push({ n, l, count: cnt });
  }
  return out;
}

export function configString(subs) {
  return subs.map((s) => `${s.n}${L_LETTER[s.l]}${sup(s.count)}`).join(" ");
}

export function shellsFrom(subs) {
  const shells = [];
  for (const s of subs) shells[s.n - 1] = (shells[s.n - 1] || 0) + s.count;
  for (let i = 0; i < shells.length; i++) shells[i] = shells[i] || 0;
  return shells;
}

// Распределение электронов по оболочкам для любого числа электронов:
// берём нейтральный атом с тем же числом электронов (изоэлектронный)
export function shellsForElectrons(e) {
  if (e <= 0) return [];
  const el = byZ(Math.min(e, 118));
  if (el && el.shells && el.z === e) return el.shells.slice();
  return shellsFrom(madelung(e));
}

// Формула → { элемент: число }. Понимает скобки и гидраты: "CuSO4·5H2O"
export function parseFormula(f) {
  const parts = String(f).replace(/\s/g, "").split(/[·*.]/);
  const total = {};
  for (const part of parts) {
    const m = part.match(/^(\d+)(.*)$/);
    const mult = m ? +m[1] : 1;
    const body = m ? m[2] : part;
    const counts = parseGroup(body);
    for (const [k, v] of Object.entries(counts)) total[k] = (total[k] || 0) + v * mult;
  }
  return total;
}
function parseGroup(s) {
  let i = 0;
  function group() {
    const acc = {};
    while (i < s.length) {
      const c = s[i];
      if (c === "(" || c === "[") {
        i++;
        const inner = group();
        i++; // закрывающая скобка
        const n = num();
        for (const [k, v] of Object.entries(inner)) acc[k] = (acc[k] || 0) + v * n;
      } else if (c === ")" || c === "]") {
        return acc;
      } else if (/[A-Z]/.test(c)) {
        let sym = c; i++;
        while (i < s.length && /[a-z]/.test(s[i])) sym += s[i++];
        if (!BY_SYMBOL[sym]) throw new Error(`Неизвестный элемент «${sym}»`);
        const n = num();
        acc[sym] = (acc[sym] || 0) + n;
      } else {
        throw new Error(`Непонятный символ «${c}»`);
      }
    }
    return acc;
  }
  function num() {
    let d = "";
    while (i < s.length && /\d/.test(s[i])) d += s[i++];
    return d ? +d : 1;
  }
  const r = group();
  if (i < s.length) throw new Error("Лишняя скобка");
  return r;
}

export function molarMass(f) {
  const counts = parseFormula(f);
  let m = 0;
  const parts = [];
  for (const [sym, n] of Object.entries(counts)) {
    const a = BY_SYMBOL[sym].mass;
    m += a * n;
    parts.push({ sym, n, a, sub: a * n });
  }
  return { mass: m, parts };
}

export const fmt = (x, d = 2) => (x == null || Number.isNaN(x) ? "—" : Number(x).toLocaleString("ru-RU", { maximumFractionDigits: d }));
