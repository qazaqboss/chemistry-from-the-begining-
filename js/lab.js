// 3D-лаборатория: молекулы, кристаллы и реакции на одной странице.
import { h, stage, chips, term } from "./ui.js";
import { createViewer } from "./three/core.js";
import { createMolecule, frame } from "./three/molecule.js";
import { MOLECULES } from "./data/molecules.js";
import { pretty, molarMass, fmt } from "./chem.js";

export function moleculeExplorer(container, ids) {
  const list = ids ? ids.map((id) => MOLECULES.find((m) => m.id === id)).filter(Boolean) : MOLECULES;
  const chipBox = h(`<div style="margin-bottom:10px"></div>`);
  container.appendChild(chipBox);
  const st = stage(`<div class="overlay"><span data-title></span><span data-shape></span></div>`);
  container.appendChild(st);
  const ctl = h(`<div class="card pad" style="margin-top:10px">
    <div class="row">
      <div class="seg"><button type="button" class="on" data-s="ballstick">Шаростержневая</button><button type="button" data-s="spacefill">Заполненная</button></div>
      <label class="row small"><input type="checkbox" data-lbl> Подписи атомов</label>
    </div>
    <p data-note style="margin:12px 0 0"></p>
  </div>`);
  container.appendChild(ctl);
  const v = createViewer(st, { camera: [0, 1.5, 8], minDistance: 2, maxDistance: 30 });
  const mol = createMolecule(v, list[0].data);
  const show = (m) => {
    mol.set(m.data);
    frame(v, mol.radius());
    let M = "";
    try { M = ` · M = ${fmt(molarMass(m.formula).mass, 2)} г/моль`; } catch {}
    st.querySelector("[data-title]").innerHTML = `<b style="font-size:1rem">${m.name}</b> <span class="formula">${pretty(m.formula)}</span>`;
    st.querySelector("[data-shape]").innerHTML = `${m.shape}${m.angle !== "—" ? ` · ${m.angle}` : ""}`;
    ctl.querySelector("[data-note]").innerHTML = `${m.note} <span class="muted small">${M}</span>`;
  };
  chips(chipBox, list.map((m) => ({ ...m, label: pretty(m.formula) })), show);
  ctl.querySelectorAll("[data-s]").forEach((b) => (b.onclick = () => {
    ctl.querySelectorAll("[data-s]").forEach((x) => x.classList.toggle("on", x === b));
    mol.setStyle(b.dataset.s);
  }));
  ctl.querySelector("[data-lbl]").onchange = (e) => mol.setLabels(e.target.checked);
  show(list[0]);
}

export async function renderLab(root) {
  root.appendChild(h(`<section style="padding-top:30px">
    <span class="tag">3D-лаборатория</span>
    <h1 style="margin-top:12px">Молекулы в 3D</h1>
    <p class="lead muted" style="max-width:760px">${MOLECULES.length} молекул с настоящей геометрией: длины связей в ангстремах и углы по теории отталкивания электронных пар. Крути, приближай, переключай модели.</p>
  </section>`));
  const sec = h(`<section></section>`);
  root.appendChild(sec);
  moleculeExplorer(sec);
  root.appendChild(h(`<section><h2>Ещё 3D в уроках</h2>
    <div class="lessons">
      <a class="lesson-card" href="#/lesson/atom"><h3>Конструктор атома</h3><p>Собери атом из протонов, нейтронов и электронов и разрежь его.</p></a>
      <a class="lesson-card" href="#/lesson/shells"><h3>Орбитали s, p, d</h3><p>Формы электронных облаков и разрез 2s-орбитали.</p></a>
      <a class="lesson-card" href="#/lesson/crystals"><h3>Кристаллы в разрезе</h3><p>Соль, алмаз, металлы — режем решётку слой за слоем.</p></a>
      <a class="lesson-card" href="#/lesson/reactions"><h3>Реакции в 3D</h3><p>Как рвутся и возникают связи при горении.</p></a>
      <a class="lesson-card" href="#/lesson/states"><h3>Лёд, вода и пар</h3><p>Нагревай молекулы и смотри, как меняется состояние.</p></a>
      <a class="lesson-card" href="#/lesson/periodic"><h3>Таблица-город</h3><p>Свойства элементов как башни разной высоты.</p></a>
    </div></section>`));
}
