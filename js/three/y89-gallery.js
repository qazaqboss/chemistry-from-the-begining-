// Галерея 3D-структур с переключателем (для уроков «Неметаллы», «Азот и фосфор»)
import { h, stage, chips } from "../ui.js";
import { createViewer } from "./core.js";
import { createMolecule, frame } from "./molecule.js";

// items: [{ label, name, info, note, data: () => ({atoms, bonds}) }]
export function structureGallery(container, items, { initial = 0 } = {}) {
  const chipBox = h(`<div style="margin-bottom:10px"></div>`);
  container.appendChild(chipBox);
  const st = stage(`<div class="overlay"><span data-title></span><span data-info style="text-align:right"></span></div>`, { wide: true });
  container.appendChild(st);
  const ctl = h(`<div class="card pad" style="margin-top:10px">
    <div class="seg"><button type="button" class="on" data-s="ballstick">Шаростержневая</button><button type="button" data-s="spacefill">Заполненная</button></div>
    <p data-note style="margin:12px 0 0"></p>
  </div>`);
  container.appendChild(ctl);
  const v = createViewer(st, { camera: [0, 2, 12], minDistance: 3, maxDistance: 60, autoRotateSpeed: 0.6 });
  const cache = new Map();
  const get = (it) => { if (!cache.has(it)) cache.set(it, it.data()); return cache.get(it); };
  const mol = createMolecule(v, get(items[initial]));
  const show = (it) => {
    mol.set(get(it));
    frame(v, mol.radius());
    st.querySelector("[data-title]").innerHTML = `<b style="font-size:1rem">${it.name}</b>`;
    st.querySelector("[data-info]").innerHTML = it.info || "";
    ctl.querySelector("[data-note]").innerHTML = it.note;
  };
  chips(chipBox, items, show, initial);
  ctl.querySelectorAll("[data-s]").forEach((b) => (b.onclick = () => {
    ctl.querySelectorAll("[data-s]").forEach((x) => x.classList.toggle("on", x === b));
    mol.setStyle(b.dataset.s);
  }));
  show(items[initial]);
  return { viewer: v, show };
}
