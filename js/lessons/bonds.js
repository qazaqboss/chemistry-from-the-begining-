import { h, kid, term, stage, chips } from "../ui.js";
import { createViewer, THREE, sphereGeo, glossy, glowSprite, easeInOut } from "../three/core.js";
import { createAtom } from "../three/atom.js";
import { createLattice } from "../three/lattice.js";
import { createMolecule } from "../three/molecule.js";
import { MOLECULES } from "../data/molecules.js";
import { ELEMENTS } from "../data/elements.js";
import { BY_SYMBOL } from "../chem.js";

const sub = (v, scene) => ({ scene, onFrame: v.onFrame, clear: v.clear, camera: v.camera, controls: v.controls });

export async function render(el) {
  el.appendChild(h(`<div>
    <p class="lead">Атомы соединяются, чтобы стать устойчивее: обычно — чтобы получить заполненную внешнюю оболочку, как у благородных газов (правило октета: 8 электронов). Добиться этого можно тремя способами.</p>
    ${kid("Атомы хотят «полный набор» электронов на верхнем этаже. Один способ — отдать или забрать электрон (ионная связь), другой — поделиться (ковалентная), третий — сложить всё в общий котёл (металлическая).")}
  </div>`));

  // ---------- ионная ----------
  const ionic = h(`<section id="ionic"><h2>Ионная связь: Na отдаёт, Cl забирает</h2>
    <p>У натрия на внешней оболочке один электрон, у хлора — семь. Натрию проще <b>отдать</b> электрон, хлору — <b>взять</b>. Получаются ионы Na⁺ и Cl⁻, которые притягиваются как разноимённые заряды. Это ${term("ionic", "ионная связь")}.</p></section>`);
  el.appendChild(ionic);
  const st1 = stage(`<div class="overlay"><span data-lbl1><b>Na</b> 2·8·1 &nbsp;&nbsp; <b>Cl</b> 2·8·7</span></div>`, { wide: true });
  ionic.appendChild(st1);
  const ctl1 = h(`<div class="row" style="margin:10px 0"><button class="btn primary" type="button" data-go>Передать электрон</button><button class="btn" type="button" data-reset>Сначала</button><button class="btn" type="button" data-cryst>Показать кристалл соли</button></div>`);
  ionic.appendChild(ctl1);
  const v1 = createViewer(st1, { camera: [0, 3, 17], autoRotate: false, minDistance: 6, maxDistance: 40 });
  const gNa = new THREE.Group(), gCl = new THREE.Group(), gCryst = new THREE.Group();
  gNa.position.x = -4.6; gCl.position.x = 4.6;
  v1.scene.add(gNa, gCl, gCryst);
  const na = createAtom(sub(v1, gNa), { z: 11, n: 12, e: 11, shells: [2, 8, 1] });
  const cl = createAtom(sub(v1, gCl), { z: 17, n: 18, e: 17, shells: [2, 8, 7] });
  const lat = createLattice(sub(v1, gCryst), "nacl", 2);
  gCryst.visible = false;
  const flyer = new THREE.Mesh(sphereGeo(0.12, 16), new THREE.MeshBasicMaterial({ color: 0x5fd4ff }));
  flyer.add(glowSprite(0x5fd4ff, 0.9, 1));
  flyer.visible = false;
  v1.scene.add(flyer);
  let anim = null;
  v1.onFrame((dt) => {
    if (!anim) return;
    anim.t += dt / 1.8;
    const u = easeInOut(Math.min(1, anim.t));
    const a = new THREE.Vector3(-4.6 + na.outerRadius(), 0, 0), b = new THREE.Vector3(4.6 - 3.0, 0, 0);
    flyer.position.lerpVectors(a, b, u);
    flyer.position.y = Math.sin(u * Math.PI) * 2.2;
    if (anim.t >= 1) {
      anim = null; flyer.visible = false;
      na.set({ e: 10, shells: [2, 8] });
      cl.set({ e: 18, shells: [2, 8, 8] });
      st1.querySelector("[data-lbl1]").innerHTML = `<b>Na⁺</b> 2·8 &nbsp;&nbsp; <b>Cl⁻</b> 2·8·8 — у обоих по 8 электронов снаружи!`;
    }
  });
  ctl1.querySelector("[data-go]").onclick = () => {
    if (gCryst.visible) return;
    na.set({ e: 11, shells: [2, 8, 1] });
    na.set({ e: 10, shells: [2, 8] });
    flyer.visible = true; anim = { t: 0 };
  };
  ctl1.querySelector("[data-reset]").onclick = () => {
    anim = null; flyer.visible = false; gCryst.visible = false; gNa.visible = gCl.visible = true;
    na.set({ e: 11, shells: [2, 8, 1] }); cl.set({ e: 17, shells: [2, 8, 7] });
    st1.querySelector("[data-lbl1]").innerHTML = `<b>Na</b> 2·8·1 &nbsp;&nbsp; <b>Cl</b> 2·8·7`;
  };
  ctl1.querySelector("[data-cryst]").onclick = () => {
    gCryst.visible = true; gNa.visible = gCl.visible = false; v1.controls.autoRotate = true;
    st1.querySelector("[data-lbl1]").innerHTML = `Кристалл NaCl: <span class="dot" style="background:#ab5cf2"></span>Na⁺ <span class="dot" style="background:#2fd35b"></span>Cl⁻ — каждый ион окружён шестью противоположными`;
  };
  ionic.appendChild(h(`<p class="small muted">Ионные вещества — соли, оксиды металлов — твёрдые, тугоплавкие (NaCl плавится при 801 °C), их растворы и расплавы проводят ток.</p>`));

  // ---------- ковалентная ----------
  const cov = h(`<section id="covalent"><h2>Ковалентная связь: делимся электронами</h2>
    <p>Если оба атома «жадные» до электронов (неметаллы), никто не отдаёт — они <b>делят</b> пару электронов. Это ${term("covalent", "ковалентная связь")}. Одна общая пара — одинарная связь (H–H), две — двойная (O=O), три — тройная (N≡N).</p>
    <ul><li><b>Неполярная</b> — между одинаковыми атомами (H₂, Cl₂): пара ровно посередине.</li><li><b>Полярная</b> — между разными (HCl, H₂O): пара смещена к более ${term("en", "электроотрицательному")} атому, на нём частичный заряд δ−.</li></ul>
  </section>`);
  el.appendChild(cov);
  const chipBox = h(`<div style="margin-bottom:10px"></div>`);
  cov.appendChild(chipBox);
  const st2 = stage(`<div class="overlay"><span data-lbl2></span></div>`);
  cov.appendChild(st2);
  const v2 = createViewer(st2, { camera: [0, 1, 7], minDistance: 3, maxDistance: 20 });
  const picks = ["H2", "Cl2", "HCl", "O2", "N2", "H2O"].map((id) => MOLECULES.find((m) => m.id === id));
  const mol = createMolecule(v2, picks[0].data, { labels: true });
  const showMol = (m) => { mol.set(m.data); st2.querySelector("[data-lbl2]").innerHTML = `<b>${m.name}</b> — ${m.note}`; };
  chips(chipBox, picks.map((m) => ({ ...m, label: m.formula.replace(/(\d)/g, (d) => "₀₁₂₃₄₅₆₇₈₉"[d]) })), showMol);
  showMol(picks[0]);

  // ---------- металлическая ----------
  const met = h(`<section id="metallic"><h2>Металлическая связь: общий «электронный газ»</h2>
    <p>Атомы металлов легко теряют внешние электроны. В куске металла положительные ионы стоят в узлах решётки, а оторвавшиеся электроны свободно движутся между ними — это ${term("metallic", "металлическая связь")}. Отсюда электропроводность, теплопроводность, блеск и ковкость.</p></section>`);
  el.appendChild(met);
  const st3 = stage(`<div class="overlay"><span><span class="dot" style="background:#ffb547"></span>ионы металла · <span class="dot" style="background:#5fd4ff"></span>свободные электроны</span></div>`);
  met.appendChild(st3);
  const field = h(`<label class="row small" style="margin-top:10px"><input type="checkbox"> Подключить батарейку (электроны потекут в одну сторону — это электрический ток)</label>`);
  met.appendChild(field);
  const v3 = createViewer(st3, { camera: [8, 6, 12] });
  const ionMat = glossy(0xffb547, { metalness: 0.6, roughness: 0.3 });
  const n = 4, a = 1.6;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) for (let k = 0; k < n; k++) {
    const m = new THREE.Mesh(sphereGeo(0.38, 24), ionMat);
    m.position.set((i - 1.5) * a, (j - 1.5) * a, (k - 1.5) * a);
    v3.scene.add(m);
  }
  const els = [];
  const L = (n / 2) * a;
  for (let i = 0; i < 70; i++) {
    const s = glowSprite(0x5fd4ff, 0.45, 1);
    s.position.set((Math.random() * 2 - 1) * L, (Math.random() * 2 - 1) * L, (Math.random() * 2 - 1) * L);
    s.userData.v = new THREE.Vector3().randomDirection().multiplyScalar(1.5);
    v3.scene.add(s);
    els.push(s);
  }
  let current = false;
  field.querySelector("input").onchange = (e) => (current = e.target.checked);
  v3.onFrame((dt) => {
    for (const s of els) {
      const vel = s.userData.v;
      if (current) vel.x += dt * 2.5;
      vel.multiplyScalar(current ? 0.985 : 1);
      if (!current && vel.length() < 1.2) vel.setLength(1.5);
      s.position.addScaledVector(vel, dt);
      for (const ax of ["x", "y", "z"]) {
        if (s.position[ax] > L) { if (current && ax === "x") s.position.x = -L; else { s.position[ax] = L; vel[ax] *= -1; } }
        if (s.position[ax] < -L) { s.position[ax] = -L; vel[ax] *= -1; }
      }
    }
  });

  // ---------- калькулятор типа связи ----------
  const calc = h(`<section id="which"><h2>Какая будет связь?</h2>
    <p>Тип связи можно предсказать по разнице электроотрицательностей Δχ:</p>
    <ul><li>Δχ &lt; 0,4 — ковалентная неполярная</li><li>0,4 ≤ Δχ &lt; 1,7 — ковалентная полярная</li><li>Δχ ≥ 1,7 — ионная (обычно металл + неметалл)</li><li>металл + металл — металлическая</li></ul>
    <div class="card pad row">
      <select data-a></select> <b>+</b> <select data-b></select>
      <div data-res style="flex-basis:100%;margin-top:8px"></div>
    </div>
    <p class="small muted adv">Границы условны: связь «плавно» переходит от ковалентной к ионной. Например, HF (Δχ = 1,78) — всё же полярная ковалентная молекула.</p>
  </section>`);
  el.appendChild(calc);
  const opts = ELEMENTS.filter((e) => e.en != null && e.z <= 86).map((e) => `<option value="${e.sym}">${e.sym} — ${e.name} (${e.en})</option>`).join("");
  const sa = calc.querySelector("[data-a]"), sb = calc.querySelector("[data-b]");
  sa.innerHTML = sb.innerHTML = opts;
  sa.value = "Na"; sb.value = "Cl";
  const metal = (e) => ["alkali", "alkaline", "transition", "post-transition", "lanthanide", "actinide"].includes(e.cat);
  const judge = () => {
    const A = BY_SYMBOL[sa.value], B = BY_SYMBOL[sb.value];
    const d = Math.abs(A.en - B.en);
    let type;
    if (metal(A) && metal(B)) type = "металлическая (сплав или металл)";
    else if (d >= 1.7) type = "ионная";
    else if (d >= 0.4) type = "ковалентная полярная";
    else type = "ковалентная неполярная";
    const pull = A.en === B.en ? "электроны поделены поровну" : `электроны сильнее тянет ${A.en > B.en ? A.name.toLowerCase() : B.name.toLowerCase()}`;
    calc.querySelector("[data-res]").innerHTML = `Δχ = |${A.en} − ${B.en}| = <b>${d.toFixed(2)}</b> → связь <b>${type}</b>; ${pull}.`;
  };
  sa.onchange = sb.onchange = judge;
  judge();
}

export const quiz = [
  { q: "Какая связь в поваренной соли NaCl?", options: ["Ковалентная неполярная", "Ковалентная полярная", "Ионная", "Металлическая"], answer: 2, why: "Na отдаёт электрон Cl, образуются ионы Na⁺ и Cl⁻." },
  { q: "Какая связь в молекуле H₂?", options: ["Ионная", "Ковалентная неполярная", "Ковалентная полярная", "Водородная"], answer: 1, why: "Два одинаковых атома делят пару поровну." },
  { q: "Почему металлы проводят ток?", options: ["У них много протонов", "В них есть свободные электроны", "Они тяжёлые", "Они блестят"], answer: 1, why: "Электронный газ свободно движется по решётке." },
  { q: "Сколько общих электронных пар в молекуле N₂?", options: ["1", "2", "3", "4"], answer: 2, why: "Тройная связь N≡N — три пары." },
  { q: "В молекуле HCl частичный отрицательный заряд на…", options: ["водороде", "хлоре", "поровну", "нет зарядов"], answer: 1, why: "Хлор более электроотрицателен (3,16 против 2,20)." },
];
