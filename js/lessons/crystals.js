import { h, kid, stage, chips } from "../ui.js";
import { createViewer } from "../three/core.js";
import { createLattice, LATTICES } from "../three/lattice.js";

export async function render(el) {
  el.appendChild(h(`<div>
    <p class="lead">В кристалле частицы стоят не как попало, а строгими рядами — в кристаллической решётке. Наименьший повторяющийся «кирпичик» решётки называют <b>элементарной ячейкой</b>. Из одинаковых ячеек, как из кубиков, сложен весь кристалл.</p>
    ${kid("Кристалл — как ящик с апельсинами, уложенными идеально ровно: ряд за рядом, слой за слоем. Поэтому у кристаллов соли ровные грани, а снежинки такие красивые и правильные.")}
  </div>`));

  const sec = h(`<section id="cut"><h2>Кристалл в разрезе</h2>
    <p>Выбери решётку. Ползунок «разрез» снимает слои атомов плоскостью, проходящей наискосок через куб, — так видно, что внутри всё устроено так же, как снаружи. Включи «элементарную ячейку», чтобы выделить один «кирпичик».</p></section>`);
  el.appendChild(sec);
  const chipBox = h(`<div style="margin-bottom:10px"></div>`);
  sec.appendChild(chipBox);
  const st = stage(`<div class="overlay"><span data-name style="font-size:1rem"></span></div>`);
  sec.appendChild(st);
  const ctl = h(`<div class="card pad" style="margin-top:10px">
    <label class="ctl">Разрез<input type="range" min="0" max="1" step="0.01" value="0" data-cut></label>
    <div class="row" style="margin-top:10px">
      <label class="row small"><input type="checkbox" data-cell> Элементарная ячейка</label>
      <label class="ctl" style="display:flex;align-items:center;gap:8px">Размер <select data-n><option>2</option><option selected>3</option><option>4</option></select> ячеек</label>
    </div>
    <div data-info style="margin-top:12px"></div>
  </div>`);
  sec.appendChild(ctl);
  const v = createViewer(st, { camera: [9, 7, 11], autoRotateSpeed: 0.5, minDistance: 5, maxDistance: 40 });
  const lat = createLattice(v, "nacl", 3);
  const info = (k) => {
    const L = LATTICES[k];
    st.querySelector("[data-name]").innerHTML = `<b>${L.name}</b>`;
    ctl.querySelector("[data-info]").innerHTML = `<p class="mt0">${L.note}</p>
      <div class="row small"><span class="tag">Примеры: ${L.example}</span><span class="tag">В ячейке: ${L.perCell}</span><span class="tag">Соседей у атома: ${L.coord}</span></div>`;
  };
  const keys = Object.keys(LATTICES);
  chips(chipBox, keys.map((k) => ({ k, label: LATTICES[k].name.split(" (")[0] })), (it) => { lat.set({ kind: it.k }); info(it.k); }, keys.indexOf("nacl"));
  info("nacl");
  ctl.querySelector("[data-cut]").oninput = (e) => lat.set({ cut: +e.target.value });
  ctl.querySelector("[data-cell]").onchange = (e) => lat.set({ cell: e.target.checked });
  ctl.querySelector("[data-n]").onchange = (e) => lat.set({ n: +e.target.value });

  el.appendChild(h(`<section id="count"><h2>Сколько атомов в ячейке?</h2>
    <p>Атом в вершине куба делится между <b>8</b> соседними ячейками — ячейке принадлежит ⅛ его. Атом на грани — между двумя (½), на ребре — между четырьмя (¼), а атом в центре целиком принадлежит ячейке.</p>
    <div class="table-wrap"><table class="data">
      <tr><th>Решётка</th><th>Подсчёт</th><th>Атомов</th><th>Заполнение объёма</th></tr>
      <tr><td>Простая кубическая</td><td>8 · ⅛</td><td>1</td><td>52%</td></tr>
      <tr><td>ОЦК</td><td>8 · ⅛ + 1</td><td>2</td><td>68%</td></tr>
      <tr><td>ГЦК</td><td>8 · ⅛ + 6 · ½</td><td>4</td><td>74%</td></tr>
    </table></div>
  </section>`));

  el.appendChild(h(`<section id="types"><h2>Типы кристаллов</h2>
    <div class="table-wrap"><table class="data">
      <tr><th>Решётка</th><th>В узлах</th><th>Свойства</th><th>Примеры</th></tr>
      <tr><td>Ионная</td><td>ионы</td><td>твёрдые, хрупкие, тугоплавкие; расплавы проводят ток</td><td>NaCl, CaO</td></tr>
      <tr><td>Атомная</td><td>атомы, связанные ковалентно</td><td>очень твёрдые и тугоплавкие</td><td>алмаз, кварц SiO₂, кремний</td></tr>
      <tr><td>Молекулярная</td><td>молекулы</td><td>мягкие, легкоплавкие, летучие</td><td>лёд, сахар, иод, «сухой лёд»</td></tr>
      <tr><td>Металлическая</td><td>ионы металла + электронный газ</td><td>пластичные, блестят, проводят ток и тепло</td><td>Fe, Cu, Al</td></tr>
    </table></div>
    <div class="callout">Алмаз и графит состоят из одного и того же углерода, но в алмазе каждый атом связан с четырьмя соседями в объёмную сетку, а в графите атомы образуют плоские слои, легко скользящие друг по другу. Поэтому алмаз — самый твёрдый минерал, а графитом можно писать.</div>
  </section>`));
}

export const quiz = [
  { q: "Сколько атомов приходится на ячейку ГЦК?", options: ["1", "2", "4", "14"], answer: 2, why: "8 · ⅛ + 6 · ½ = 4." },
  { q: "Какая доля атома в вершине куба принадлежит ячейке?", options: ["½", "¼", "⅛", "целиком"], answer: 2, why: "Вершину делят 8 ячеек." },
  { q: "Какой тип решётки у поваренной соли?", options: ["Молекулярная", "Атомная", "Ионная", "Металлическая"], answer: 2, why: "В узлах — ионы Na⁺ и Cl⁻." },
  { q: "Почему алмаз такой твёрдый?", options: ["Он из металла", "Каждый атом C прочно связан с 4 соседями по всей решётке", "Он очень тяжёлый", "Он молекулярный"], answer: 1, why: "Атомная решётка из прочных ковалентных связей." },
];
