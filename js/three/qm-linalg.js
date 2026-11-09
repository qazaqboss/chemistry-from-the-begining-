// Маленькая линейная алгебра для уроков 12-го года (без внешних библиотек):
// умножение матриц, определитель, обратная матрица, метод Якоби для
// собственных значений симметричной матрицы и вывод матриц в HTML.

export const zeros = (n, m = n) => Array.from({ length: n }, () => new Array(m).fill(0));
export const identity = (n) => zeros(n).map((r, i) => { r[i] = 1; return r; });
export const transpose = (A) => A[0].map((_, j) => A.map((r) => r[j]));
export const clone = (A) => A.map((r) => r.slice());

export function matMul(A, B) {
  const n = A.length, m = B[0].length, k = B.length;
  const C = zeros(n, m);
  for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) {
    let s = 0;
    for (let t = 0; t < k; t++) s += A[i][t] * B[t][j];
    C[i][j] = s;
  }
  return C;
}
export const matVec = (A, v) => A.map((r) => r.reduce((s, a, j) => s + a * v[j], 0));
export const trace = (A) => A.reduce((s, r, i) => s + r[i], 0);

// Определитель методом Гаусса с выбором главного элемента
export function det(A) {
  const M = clone(A), n = M.length;
  let d = 1;
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    if (Math.abs(M[p][c]) < 1e-14) return 0;
    if (p !== c) { [M[p], M[c]] = [M[c], M[p]]; d = -d; }
    d *= M[c][c];
    for (let r = c + 1; r < n; r++) {
      const f = M[r][c] / M[c][c];
      for (let k = c; k < n; k++) M[r][k] -= f * M[c][k];
    }
  }
  return d;
}

// Обратная матрица (Гаусс — Жордан)
export function inverse(A) {
  const n = A.length, M = A.map((r, i) => [...r, ...identity(n)[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[p], M[c]] = [M[c], M[p]];
    const d = M[c][c];
    for (let k = 0; k < 2 * n; k++) M[c][k] /= d;
    for (let r = 0; r < n; r++) if (r !== c) {
      const f = M[r][c];
      for (let k = 0; k < 2 * n; k++) M[r][k] -= f * M[c][k];
    }
  }
  return M.map((r) => r.slice(n));
}

// Метод вращений Якоби для симметричной матрицы.
// Возвращает собственные значения по возрастанию, векторы (столбцы V → vectors[k] — k-й вектор),
// число вращений и историю «внедиагональной нормы».
export function jacobiEigen(A, { tol = 1e-12, maxSweeps = 100, snap = false } = {}) {
  const n = A.length;
  const a = clone(A);
  const V = identity(n);
  const off = () => { let s = 0; for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) s += a[i][j] * a[i][j]; return Math.sqrt(2 * s); };
  const history = [off()];
  const snapshots = snap ? [clone(a)] : null;
  let rotations = 0;
  for (let sweep = 0; sweep < maxSweeps && history[history.length - 1] > tol; sweep++) {
    for (let p = 0; p < n - 1; p++) for (let q = p + 1; q < n; q++) {
      if (Math.abs(a[p][q]) < 1e-300) continue;
      // угол поворота, обнуляющий a[p][q]
      const theta = (a[q][q] - a[p][p]) / (2 * a[p][q]);
      const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
      const c = 1 / Math.sqrt(t * t + 1), s = t * c;
      for (let k = 0; k < n; k++) { // столбцы p, q
        const akp = a[k][p], akq = a[k][q];
        a[k][p] = c * akp - s * akq;
        a[k][q] = s * akp + c * akq;
      }
      for (let k = 0; k < n; k++) { // строки p, q
        const apk = a[p][k], aqk = a[q][k];
        a[p][k] = c * apk - s * aqk;
        a[q][k] = s * apk + c * aqk;
      }
      for (let k = 0; k < n; k++) {
        const vkp = V[k][p], vkq = V[k][q];
        V[k][p] = c * vkp - s * vkq;
        V[k][q] = s * vkp + c * vkq;
      }
      rotations++;
    }
    history.push(off());
    if (snap) snapshots.push(clone(a));
  }
  const order = [...Array(n).keys()].sort((i, j) => a[i][i] - a[j][j]);
  const values = order.map((i) => a[i][i]);
  const vectors = order.map((i) => {
    const v = V.map((r) => r[i]);
    // знак: первая заметно ненулевая компонента положительна (для воспроизводимости)
    const f = v.find((x) => Math.abs(x) > 1e-6) || 1;
    return f < 0 ? v.map((x) => -x) : v;
  });
  return { values, vectors, rotations, sweeps: history.length - 1, history, snapshots };
}

// Красивое число с десятичной запятой и настоящим минусом
export function num(x, d = 3) {
  if (Math.abs(x) < 0.5 * Math.pow(10, -d)) x = 0;
  let s = (+x.toFixed(d)).toString();
  return s.replace("-", "−").replace(".", ",");
}

let styled = false;
function ensureStyle() {
  if (styled || typeof document === "undefined") return;
  styled = true;
  const st = document.createElement("style");
  st.textContent = `
  .qm-mat{display:inline-table;border-collapse:separate;border-spacing:0;position:relative;margin:4px 6px;vertical-align:middle;font-family:var(--mono);font-size:.86rem}
  .qm-mat td{padding:2px 7px;text-align:center;white-space:nowrap;border-radius:5px}
  .qm-mat::before,.qm-mat::after{content:"";position:absolute;top:0;bottom:0;width:7px;border:2px solid var(--text-2)}
  .qm-mat::before{left:-2px;border-right:0;border-radius:6px 0 0 6px}
  .qm-mat::after{right:-2px;border-left:0;border-radius:0 6px 6px 0}
  .qm-mat td.hi{background:color-mix(in srgb,var(--accent) 22%,transparent);color:var(--text)}
  .qm-mat td.dg{color:var(--warn)}
  .qm-mat td.z{color:var(--text-3)}
  .qm-mats{display:flex;flex-wrap:wrap;align-items:center;gap:4px;overflow-x:auto;max-width:100%;padding:4px 2px}
  .qm-mats .op{font-family:var(--mono);font-weight:700;font-size:1.05rem;padding:0 2px}`;
  document.head.appendChild(st);
}

// Матрица как HTML-таблица в скобках.
// fmtCell(value, i, j) → строка; cls(i, j, value) → класс ячейки
export function matrixHTML(M, { fmt = (x) => num(x, 2), cls = null, title = "" } = {}) {
  ensureStyle();
  const rows = M.map((r, i) => `<tr>${r.map((x, j) => {
    const c = cls ? cls(i, j, x) : (typeof x === "number" && Math.abs(x) < 1e-9 ? "z" : "");
    return `<td class="${c || ""}">${typeof x === "number" ? fmt(x, i, j) : x}</td>`;
  }).join("")}</tr>`).join("");
  return `<table class="qm-mat"${title ? ` aria-label="${title}"` : ""}>${rows}</table>`;
}
export const matRow = (...parts) => { ensureStyle(); return `<div class="qm-mats">${parts.join("")}</div>`; };
// Характеристический многочлен det(xI − A) методом Фаддеева — Леверье.
// Возвращает коэффициенты c[0..n] при x^0..x^n.
export function charPoly(A) {
  const n = A.length, c = new Array(n + 1).fill(0);
  c[n] = 1;
  let M = zeros(n);
  for (let k = 1; k <= n; k++) {
    const AM = matMul(A, M);
    for (let i = 0; i < n; i++) AM[i][i] += c[n - k + 1];
    M = AM;
    c[n - k] = -trace(matMul(A, M)) / k;
  }
  return c;
}
const SUPD = "⁰¹²³⁴⁵⁶⁷⁸⁹";
export const supNum = (k) => String(k).split("").map((d) => SUPD[d]).join("");
export function polyHTML(c, v = "x") {
  let out = "";
  for (let k = c.length - 1; k >= 0; k--) {
    const a = Math.round(c[k]);
    if (!a) continue;
    const sgn = a < 0 ? " − " : out ? " + " : "";
    const abs = Math.abs(a);
    const coef = abs === 1 && k > 0 ? "" : abs;
    out += sgn + coef + (k > 0 ? v + (k > 1 ? supNum(k) : "") : "");
  }
  return out.trim().replace(/^− /, "−") || "0";
}
export const op = (s) => `<span class="op">${s}</span>`;
