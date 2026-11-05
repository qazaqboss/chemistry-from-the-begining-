import { h, kid, term, stage, chips } from "../ui.js";
import { createViewer } from "../three/core.js";
import { createOrbital, ORBITALS } from "../three/orbitals.js";
import { byZ, parseConfig, MADELUNG, L_LETTER, L_CAP, sup } from "../chem.js";

export async function render(el) {
  el.appendChild(h(`<div>
    <p class="lead">Электроны не летают по аккуратным орбитам, как планеты. Квантовая механика говорит: у электрона есть только <b>вероятность</b> оказаться в той или иной точке. Область, где он бывает чаще всего, называют ${term("orbital", "орбиталью")}.</p>
  </div>`));

  el.appendChild(h(`<section id="levels"><h2>Уровни и подуровни</h2>
    <p>Электроны расположены ${term("shells", "энергетическими уровнями")} n = 1, 2, 3… (оболочки K, L, M, N…). Каждый уровень делится на подуровни:</p>
    <div class="table-wrap"><table class="data">
      <tr><th>Подуровень</th><th>Орбиталей</th><th>Максимум электронов</th><th>Форма</th></tr>
      <tr><td><b>s</b></td><td>1</td><td>2</td><td>шар</td></tr>
      <tr><td><b>p</b></td><td>3</td><td>6</td><td>гантели вдоль осей x, y, z</td></tr>
      <tr><td><b>d</b></td><td>5</td><td>10</td><td>«клеверы» и гантель с бубликом</td></tr>
      <tr><td><b>f</b></td><td>7</td><td>14</td><td>сложные многолепестковые</td></tr>
    </table></div>
    <p>На уровне n помещается не больше <b>2n²</b> электронов: 2, 8, 18, 32.</p>
    ${kid("Атом — как многоэтажный дом. Этажи — это уровни, квартиры на этаже — орбитали, а в каждой квартире могут жить максимум два электрона-соседа.")}
  </section>`));

  // ---------- 3D-орбитали ----------
  const sec = h(`<section id="orbitals"><h2>Формы орбиталей в 3D</h2><p>Выбери орбиталь. Голубой и оранжевый цвета — разные знаки волновой функции (это важно, когда орбитали соседних атомов перекрываются и образуют связь).</p></section>`);
  el.appendChild(sec);
  const st = stage(`<div class="overlay"><span><b data-l>1s</b></span></div>`);
  const desc = h(`<p class="muted" style="margin:10px 0 0"></p>`);
  const chipBox = h(`<div style="margin-bottom:10px"></div>`);
  sec.appendChild(chipBox);
  sec.appendChild(st);
  const cutRow = h(`<label class="row small" style="margin-top:10px"><input type="checkbox"> Разрезать орбиталь пополам (видно, что внутри 2s есть узел — слой, где электрона не бывает)</label>`);
  sec.appendChild(cutRow);
  sec.appendChild(desc);
  const v = createViewer(st, { camera: [4, 3, 6], clipping: true, minDistance: 3, maxDistance: 20 });
  const orb = createOrbital(v);
  const pick = (o) => { orb.show(o.id); st.querySelector("[data-l]").textContent = o.label; desc.textContent = o.desc; };
  chips(chipBox, ORBITALS.map((o) => ({ ...o, label: o.label })), pick);
  pick(ORBITALS[0]);
  cutRow.querySelector("input").onchange = (e) => orb.setCut(e.target.checked);

  // ---------- заполнение ----------
  const fill = h(`<section id="filling"><h2>Как заполняются орбитали</h2>
    <p>Три правила:</p>
    <ol>
      <li><b>Принцип наименьшей энергии</b> (правило Клечковского): сначала заполняются подуровни с меньшей суммой n + l. Поэтому 4s заполняется <i>раньше</i> 3d.</li>
      <li><b>Принцип Паули:</b> на одной орбитали не больше двух электронов, и их спины противоположны (↑↓).</li>
      <li><b>Правило Хунда:</b> в пределах подуровня электроны сначала занимают пустые орбитали по одному (↑ ↑ ↑), а потом спариваются.</li>
    </ol>
    <div class="eq">1s → 2s → 2p → 3s → 3p → 4s → 3d → 4p → 5s → 4d → 5p → 6s → 4f → 5d → 6p → 7s → 5f → 6d → 7p</div>
    <div class="card pad">
      <label class="ctl">Выбери элемент: <span data-name></span><input type="range" min="1" max="54" value="8"></label>
      <div data-cfg class="mono" style="font-size:1.1rem;margin:12px 0"></div>
      <div data-boxes style="display:flex;flex-wrap:wrap;gap:14px"></div>
      <p data-note class="small muted" style="margin:12px 0 0"></p>
    </div>
  </section>`);
  el.appendChild(fill);
  const range = fill.querySelector("input");
  const drawBoxes = () => {
    const e = byZ(+range.value);
    const subs = parseConfig(e.config);
    fill.querySelector("[data-name]").innerHTML = `<b>${e.z}. ${e.name} (${e.sym})</b>`;
    fill.querySelector("[data-cfg]").textContent = e.config;
    const order = MADELUNG.map(({ n, l }) => subs.find((s) => s.n === n && s.l === l)).filter(Boolean);
    fill.querySelector("[data-boxes]").innerHTML = order.map((s) => {
      const k = L_CAP[s.l] / 2;
      const cells = Array.from({ length: k }, (_, i) => {
        const up = s.count > i, down = s.count > k + i;
        return `<span style="display:inline-grid;place-items:center;width:30px;height:34px;border:1.5px solid var(--line-2);border-radius:6px;margin-left:-1.5px;font-weight:800;color:var(--accent)">${up ? "↑" : ""}${down ? "↓" : ""}</span>`;
      }).join("");
      return `<div><div style="display:flex">${cells}</div><div class="small muted mono" style="text-align:center">${s.n}${L_LETTER[s.l]}${sup(s.count)}</div></div>`;
    }).join("");
    const ideal = (() => {
      // сравнить с «идеальным» заполнением
      let left = e.z, out = [];
      for (const { n, l } of MADELUNG) { if (left <= 0) break; const c = Math.min(L_CAP[l], left); out.push(`${n}${l}${c}`); left -= c; }
      return out.join();
    })();
    const real = order.map((s) => `${s.n}${s.l}${s.count}`).join();
    fill.querySelector("[data-note]").innerHTML = ideal !== real
      ? `<b style="color:var(--warn)">Исключение!</b> У ${e.name} один электрон «перескакивает» с s- на d-подуровень: наполовину или полностью заполненный d-подуровень особенно выгоден.`
      : `Внешний уровень: ${e.shells[e.shells.length - 1]} электрон(а/ов). Именно они участвуют в химических реакциях.`;
  };
  range.oninput = drawBoxes;
  drawBoxes();
  fill.appendChild(h(`${kid("Подвигай ползунок до хрома (24) или меди (29) — увидишь, как электрон «переезжает» в другую квартиру, потому что там уютнее.")}`));
}

export const quiz = [
  { q: "Сколько электронов максимум помещается на одной орбитали?", options: ["1", "2", "6", "8"], answer: 1, why: "По принципу Паули — два, с противоположными спинами." },
  { q: "Какую форму имеет p-орбиталь?", options: ["Шар", "Гантель", "Куб", "Кольцо"], answer: 1, why: "Две доли по обе стороны от ядра — гантель." },
  { q: "Сколько электронов вмещает второй уровень (n = 2)?", options: ["2", "8", "18", "32"], answer: 1, why: "2n² = 2·2² = 8: 2s² + 2p⁶." },
  { q: "Какой подуровень заполняется раньше?", options: ["3d", "4s", "Одновременно", "4p"], answer: 1, why: "У 4s сумма n + l = 4, у 3d — 5. Меньшая сумма заполняется раньше." },
  { q: "Конфигурация кислорода (Z = 8):", options: ["1s² 2s² 2p⁴", "1s² 2s² 2p⁶", "1s² 2p⁶", "1s² 2s⁶"], answer: 0, why: "2 + 2 + 4 = 8 электронов." },
];
