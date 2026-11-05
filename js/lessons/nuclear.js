import { h, kid, term, stage } from "../ui.js";
import { createViewer, THREE, glowSprite } from "../three/core.js";
import { createAtom } from "../three/atom.js";

const ISOTOPES = [
  { id: "c14", name: "Углерод-14", T: "5730 лет", years: 5730, unit: "лет", note: "По нему определяют возраст древних находок (радиоуглеродный анализ)." },
  { id: "i131", name: "Иод-131", T: "8 суток", years: 8, unit: "суток", note: "Используют в медицине для лечения щитовидной железы." },
  { id: "u238", name: "Уран-238", T: "4,47 млрд лет", years: 4.47, unit: "млрд лет", note: "Его период полураспада сравним с возрастом Земли (≈4,5 млрд лет)." },
];

export async function render(el) {
  el.appendChild(h(`<div>
    <p class="lead">Ядра некоторых атомов неустойчивы: они сами собой распадаются, испуская частицы и энергию. Это явление открыл А. Беккерель в 1896 году, а Мария и Пьер Кюри дали ему название — <b>радиоактивность</b>.</p>
    ${kid("Некоторые ядра — как башня из кубиков, которая стоит неровно. Рано или поздно кусочек отваливается, и башня становится другой. Так один элемент может превратиться в другой!")}
  </div>`));

  // ---------- 3D-распад ----------
  const sec = h(`<section id="types"><h2>Три вида излучения</h2>
    <div class="table-wrap"><table class="data">
      <tr><th>Излучение</th><th>Что это</th><th>Что происходит с ядром</th><th>Что задерживает</th></tr>
      <tr><td><b>α (альфа)</b></td><td>ядро гелия ⁴He: 2p + 2n</td><td>Z − 2, A − 4</td><td>лист бумаги</td></tr>
      <tr><td><b>β (бета)</b></td><td>электрон</td><td>нейтрон → протон: Z + 1, A не меняется</td><td>алюминиевая фольга</td></tr>
      <tr><td><b>γ (гамма)</b></td><td>жёсткий электромагнитный луч</td><td>ядро теряет энергию, состав прежний</td><td>толстый слой свинца, бетон</td></tr>
    </table></div>
    <div class="eq">²³⁸U → ²³⁴Th + ⁴He (α) &nbsp;&nbsp;·&nbsp;&nbsp; ¹⁴C → ¹⁴N + e⁻ (β)</div>
    <p>Нажми кнопку — ядро выпустит частицу.</p>
  </section>`);
  el.appendChild(sec);
  const st = stage(`<div class="overlay"><span data-name style="font-size:1rem"></span></div>`);
  sec.appendChild(st);
  const ctl = h(`<div class="row" style="margin:10px 0"><button class="btn primary" type="button" data-a>α-распад</button><button class="btn" type="button" data-b>β-распад</button><button class="btn" type="button" data-g>γ-излучение</button><button class="btn" type="button" data-r>Сначала</button></div>`);
  sec.appendChild(ctl);
  const v = createViewer(st, { camera: [0, 1.5, 6], minDistance: 2, maxDistance: 20, autoRotateSpeed: 0.4 });
  // показываем только ядро — крупно
  const g = new THREE.Group(); v.scene.add(g); g.scale.setScalar(2.2);
  const sv = { scene: g, onFrame: v.onFrame, clear: v.clear, camera: v.camera, controls: v.controls };
  let nuc = { z: 6, n: 8 };
  const label = () => {
    const names = { 6: "Углерод", 7: "Азот", 4: "Бериллий", 5: "Бор", 3: "Литий", 2: "Гелий", 8: "Кислород", 1: "Водород" };
    st.querySelector("[data-name]").innerHTML = `<b>${names[nuc.z] || "Z=" + nuc.z}-${nuc.z + nuc.n}</b> · ${nuc.z} p, ${nuc.n} n`;
  };
  const atom = createAtom(sv, { z: nuc.z, n: nuc.n, e: 0, shells: [] });
  label();
  const shots = [];
  const shoot = (color, size, speed, mesh) => {
    const s = mesh || glowSprite(color, size, 1);
    s.position.set(0, 0, 0);
    s.userData.v = new THREE.Vector3().randomDirection().multiplyScalar(speed);
    s.userData.life = 2.5;
    v.scene.add(s);
    shots.push(s);
  };
  v.onFrame((dt) => {
    for (let i = shots.length - 1; i >= 0; i--) {
      const s = shots[i];
      s.position.addScaledVector(s.userData.v, dt);
      s.userData.life -= dt;
      if (s.material) s.material.opacity = Math.max(0, s.userData.life / 2.5);
      if (s.userData.life <= 0) { v.scene.remove(s); shots.splice(i, 1); }
    }
  });
  ctl.querySelector("[data-a]").onclick = () => {
    if (nuc.z < 3) return;
    nuc = { z: nuc.z - 2, n: nuc.n - 2 };
    atom.set({ z: nuc.z, n: nuc.n });
    const he = new THREE.Group();
    const mini = createAtom({ scene: he, onFrame: v.onFrame, clear: v.clear, camera: v.camera, controls: v.controls }, { z: 2, n: 2, e: 0, shells: [] });
    he.scale.setScalar(2.2);
    shoot(0, 0, 2.2, he);
    label();
  };
  ctl.querySelector("[data-b]").onclick = () => {
    if (nuc.n < 1) return;
    nuc = { z: nuc.z + 1, n: nuc.n - 1 };
    atom.set({ z: nuc.z, n: nuc.n });
    shoot(0x5fd4ff, 0.35, 5);
    label();
  };
  ctl.querySelector("[data-g]").onclick = () => { for (let i = 0; i < 3; i++) shoot(0xb4ff7a, 0.6, 7); };
  ctl.querySelector("[data-r]").onclick = () => { nuc = { z: 6, n: 8 }; atom.set({ z: 6, n: 8 }); label(); };

  // ---------- полураспад ----------
  const hl = h(`<section id="halflife"><h2>Период полураспада</h2>
    <p>Нельзя предсказать, когда распадётся конкретное ядро, — это случайность. Но для большого числа ядер работает точный закон: за ${term("halflife", "период полураспада")} T распадается ровно <b>половина</b> оставшихся ядер.</p>
    <div class="card pad">
      <div class="row" style="justify-content:space-between"><select data-iso>${ISOTOPES.map((i) => `<option value="${i.id}">${i.name} (T = ${i.T})</option>`).join("")}</select>
        <div class="row"><button class="btn primary small" type="button" data-run>▶ Запустить</button><button class="btn small" type="button" data-reset>Сброс</button></div></div>
      <div class="decay-grid" data-grid style="margin-top:12px"></div>
      <div class="row" style="justify-content:space-between;margin-top:10px"><b data-left></b><span data-time class="muted"></span></div>
      <canvas data-chart width="800" height="200" style="width:100%;height:160px;margin-top:10px;border-radius:12px;background:var(--surface-2)"></canvas>
      <p data-note class="small muted" style="margin:10px 0 0"></p>
    </div>
  </section>`);
  el.appendChild(hl);
  const N0 = 200;
  const grid = hl.querySelector("[data-grid]");
  grid.innerHTML = Array.from({ length: N0 }, () => "<i></i>").join("");
  const dots = [...grid.children];
  let alive, t, timer, hist;
  const iso = () => ISOTOPES.find((i) => i.id === hl.querySelector("[data-iso]").value);
  const reset = () => {
    clearInterval(timer); timer = null;
    alive = dots.map(() => true); t = 0; hist = [[0, N0]];
    dots.forEach((d) => d.classList.remove("gone"));
    draw();
  };
  const draw = () => {
    const left = alive.filter(Boolean).length;
    hl.querySelector("[data-left]").textContent = `Осталось ядер: ${left} из ${N0}`;
    const I = iso();
    hl.querySelector("[data-time]").textContent = `прошло ${(t).toFixed(1)} T ≈ ${(t * I.years).toLocaleString("ru-RU", { maximumFractionDigits: 2 })} ${I.unit}`;
    hl.querySelector("[data-note]").textContent = I.note;
    const c = hl.querySelector("[data-chart]"), g2 = c.getContext("2d");
    const W = c.width, H = c.height, pad = 24;
    g2.clearRect(0, 0, W, H);
    const css = getComputedStyle(document.documentElement);
    g2.strokeStyle = css.getPropertyValue("--line-2"); g2.lineWidth = 1;
    g2.fillStyle = css.getPropertyValue("--text-3"); g2.font = "20px Manrope, sans-serif";
    for (let k = 0; k <= 5; k++) {
      const x = pad + (k / 5) * (W - 2 * pad);
      g2.beginPath(); g2.moveTo(x, pad); g2.lineTo(x, H - pad); g2.stroke();
      g2.fillText(`${k}T`, x - 8, H - 4);
    }
    // теория: N0 / 2^t
    g2.strokeStyle = "#9b7bff"; g2.lineWidth = 3; g2.setLineDash([8, 6]);
    g2.beginPath();
    for (let s = 0; s <= 100; s++) { const tt = (s / 100) * 5; const x = pad + (tt / 5) * (W - 2 * pad), y = H - pad - (N0 / 2 ** tt / N0) * (H - 2 * pad); s ? g2.lineTo(x, y) : g2.moveTo(x, y); }
    g2.stroke(); g2.setLineDash([]);
    g2.strokeStyle = "#ffcb5c"; g2.lineWidth = 4;
    g2.beginPath();
    hist.forEach(([tt, n], i) => { const x = pad + (tt / 5) * (W - 2 * pad), y = H - pad - (n / N0) * (H - 2 * pad); i ? g2.lineTo(x, y) : g2.moveTo(x, y); });
    g2.stroke();
  };
  hl.querySelector("[data-run]").onclick = () => {
    if (timer) return;
    if (t >= 5) reset();
    const dt = 0.05;
    const p = 1 - Math.pow(0.5, dt); // вероятность распада за шаг
    timer = setInterval(() => {
      t += dt;
      alive.forEach((a, i) => { if (a && Math.random() < p) { alive[i] = false; dots[i].classList.add("gone"); } });
      hist.push([t, alive.filter(Boolean).length]);
      draw();
      if (t >= 5 - 1e-9) { clearInterval(timer); timer = null; }
    }, 60);
  };
  hl.querySelector("[data-reset]").onclick = reset;
  hl.querySelector("[data-iso]").onchange = reset;
  reset();
  hl.appendChild(h(`<p class="small muted">Жёлтая линия — наш случайный опыт, фиолетовый пунктир — закон N = N₀ / 2^(t/T). Чем больше ядер, тем точнее они совпадают.</p>`));

  el.appendChild(h(`<section id="use"><h2>Где применяют</h2>
    <ul>
      <li><b>Атомные электростанции:</b> деление ядер урана-235 даёт огромную энергию без выбросов CO₂.</li>
      <li><b>Медицина:</b> лучевая терапия опухолей, диагностика (ПЭТ), стерилизация инструментов.</li>
      <li><b>Археология и геология:</b> датирование по ¹⁴C, ⁴⁰K, урану.</li>
      <li><b>Космос:</b> радиоизотопные генераторы питают зонды «Вояджер» и марсоходы.</li>
    </ul>
    <div class="callout warn">Ионизирующее излучение опасно для живых клеток. Источники хранят в защитных контейнерах, а работают с ними только специалисты.</div>
  </section>`));
}

export const quiz = [
  { q: "Что такое α-частица?", options: ["Электрон", "Ядро гелия (2p + 2n)", "Фотон", "Нейтрон"], answer: 1, why: "Альфа-частица — ядро ⁴He." },
  { q: "При β-распаде заряд ядра…", options: ["уменьшается на 2", "увеличивается на 1", "не меняется", "уменьшается на 1"], answer: 1, why: "Нейтрон превращается в протон, Z растёт на 1." },
  { q: "Было 800 ядер. Сколько останется через 3 периода полураспада?", options: ["400", "200", "100", "0"], answer: 2, why: "800 → 400 → 200 → 100." },
  { q: "Какое излучение самое проникающее?", options: ["α", "β", "γ", "Все одинаковые"], answer: 2, why: "γ-лучи задерживает только толстый слой свинца или бетона." },
];
