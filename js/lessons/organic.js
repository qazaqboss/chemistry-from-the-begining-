import { h, kid, stage } from "../ui.js";
import { createViewer } from "../three/core.js";
import { createMolecule, frame } from "../three/molecule.js";
import { alkane, ALKANE_NAMES } from "../data/molecules.js";
import { moleculeExplorer } from "../lab.js";
import { sub, molarMass, fmt } from "../chem.js";

// Температуры кипения алканов, °C
const ALKANE_BP = [-161.5, -88.6, -42.1, -0.5, 36.1, 68.7, 98.4, 125.7, 150.8, 174.1];

export async function render(el) {
  el.appendChild(h(`<div>
    <p class="lead">Органическая химия — химия соединений углерода. Их известно больше 100 миллионов: из них состоят все живые существа, нефть и газ, пластмассы, лекарства, ткани, красители.</p>
    ${kid("Углерод — чемпион по «держанию за руки»: у него четыре руки (связи), и он может цепляться за другие атомы углерода, образуя длиннющие цепочки и кольца. Поэтому из него можно собрать почти что угодно!")}
  </div>`));

  el.appendChild(h(`<section id="carbon"><h2>Почему углерод особенный</h2>
    <ul>
      <li>Углерод четырёхвалентен: образует 4 ковалентные связи.</li>
      <li>Атомы углерода соединяются между собой в цепи — прямые, разветвлённые и кольца.</li>
      <li>Связи бывают одинарными (C–C), двойными (C=C) и тройными (C≡C).</li>
      <li>По теории строения А. М. Бутлерова (1861) свойства вещества зависят не только от состава, но и от порядка соединения атомов. Вещества с одинаковым составом, но разным строением — <b>изомеры</b>.</li>
    </ul>
  </section>`));

  const sec = h(`<section id="alkanes"><h2>Алканы: строим цепочку</h2>
    <p>Алканы — углеводороды только с одинарными связями. Общая формула <span class="formula">CₙH₂ₙ₊₂</span>. Каждый следующий отличается от предыдущего на группу CH₂ — это <b>гомологический ряд</b>. Цепочка не прямая, а зигзагом: угол C–C–C ≈ 109,5°.</p></section>`);
  el.appendChild(sec);
  const st = stage(`<div class="overlay"><span data-name style="font-size:1rem"></span><span data-bp></span></div>`, { wide: true });
  sec.appendChild(st);
  const ctl = h(`<div class="card pad" style="margin-top:10px"><label class="ctl">Число атомов углерода: <b data-n></b><input type="range" min="1" max="10" value="3"></label><p data-d style="margin:10px 0 0"></p></div>`);
  sec.appendChild(ctl);
  const v = createViewer(st, { camera: [0, 2, 12], minDistance: 3, maxDistance: 40, autoRotateSpeed: 0.5 });
  const mol = createMolecule(v, alkane(3));
  const upd = () => {
    const n = +ctl.querySelector("input").value;
    mol.set(alkane(n));
    frame(v, mol.radius());
    const f = `C${n > 1 ? n : ""}H${2 * n + 2}`;
    const state = ALKANE_BP[n - 1] < 20 ? "газ" : "жидкость";
    ctl.querySelector("[data-n]").textContent = n;
    st.querySelector("[data-name]").innerHTML = `<b>${ALKANE_NAMES[n - 1][0].toUpperCase() + ALKANE_NAMES[n - 1].slice(1)}</b> <span class="formula">${sub(f)}</span>`;
    st.querySelector("[data-bp]").textContent = `кипит при ${fmt(ALKANE_BP[n - 1], 1)} °C · при 20 °C — ${state}`;
    const uses = ["основа природного газа", "в природном газе", "баллонный газ для плит", "газ для зажигалок", "растворитель, компонент бензина", "растворитель", "эталон «0» октанового числа", "изооктан — эталон «100» в бензине", "в керосине", "в керосине и дизеле"];
    ctl.querySelector("[data-d]").innerHTML = `M = ${fmt(molarMass(f).mass, 2)} г/моль · ${uses[n - 1]}. Чем длиннее цепочка, тем сильнее молекулы притягиваются и тем выше температура кипения.`;
  };
  ctl.querySelector("input").oninput = upd;
  upd();
  sec.appendChild(h(`<p class="small muted">Названия первых четырёх исторические (метан, этан, пропан, бутан), дальше — от греческих числительных: пента- (5), гекса- (6), гепта- (7), окта- (8)…</p>`));

  el.appendChild(h(`<section id="groups"><h2>Функциональные группы</h2>
    <p>Группа атомов, которая определяет свойства целого класса веществ:</p>
    <div class="table-wrap"><table class="data">
      <tr><th>Класс</th><th>Группа</th><th>Пример</th></tr>
      <tr><td>Алкены</td><td class="formula">C=C</td><td>этилен C₂H₄</td></tr>
      <tr><td>Алкины</td><td class="formula">C≡C</td><td>ацетилен C₂H₂</td></tr>
      <tr><td>Арены</td><td>бензольное кольцо</td><td>бензол C₆H₆</td></tr>
      <tr><td>Спирты</td><td class="formula">–OH</td><td>этанол C₂H₅OH</td></tr>
      <tr><td>Альдегиды</td><td class="formula">–CHO</td><td>формальдегид HCHO</td></tr>
      <tr><td>Карбоновые кислоты</td><td class="formula">–COOH</td><td>уксусная CH₃COOH</td></tr>
      <tr class="adv"><td>Амины</td><td class="formula">–NH₂</td><td>метиламин CH₃NH₂</td></tr>
    </table></div>
  </section>`));
  const gal = h(`<section id="gallery"><h2>Органические молекулы в 3D</h2></section>`);
  el.appendChild(gal);
  moleculeExplorer(gal, ["CH4", "C2H6", "C2H4", "C2H2", "C6H6", "CH3OH", "C2H5OH", "CH2O", "CH3COOH", "C6H12O6"]);

  el.appendChild(h(`<section id="life"><h2>Химия жизни</h2>
    <p>Четыре главных класса веществ в живых организмах: <b>углеводы</b> (глюкоза, крахмал, целлюлоза — энергия и строительный материал), <b>жиры</b> (запас энергии, мембраны клеток), <b>белки</b> (цепочки из 20 видов аминокислот — ферменты, мышцы, антитела) и <b>нуклеиновые кислоты</b> (ДНК и РНК — хранение наследственной информации).</p>
    <div class="eq">6CO₂ + 6H₂O —(свет)→ C₆H₁₂O₆ + 6O₂ &nbsp; (фотосинтез)</div>
  </section>`));
}

export const quiz = [
  { q: "Общая формула алканов:", options: ["CₙH₂ₙ", "CₙH₂ₙ₊₂", "CₙH₂ₙ₋₂", "CₙHₙ"], answer: 1, why: "Например, пропан C₃H₈: 2·3 + 2 = 8." },
  { q: "Сколько связей образует атом углерода?", options: ["2", "3", "4", "6"], answer: 2, why: "Углерод четырёхвалентен." },
  { q: "Какая группа есть у всех спиртов?", options: ["–COOH", "–OH", "–NH₂", "C=C"], answer: 1, why: "Гидроксильная группа –OH." },
  { q: "Как меняется температура кипения алканов с ростом цепи?", options: ["Растёт", "Падает", "Не меняется", "Сначала падает"], answer: 0, why: "Длинные молекулы сильнее притягиваются друг к другу." },
  { q: "Вещества с одинаковым составом, но разным строением — это…", options: ["изотопы", "гомологи", "изомеры", "ионы"], answer: 2, why: "Например, бутан и изобутан (C₄H₁₀)." },
];
