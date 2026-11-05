import { h, kid, term, stage } from "../ui.js";
import { createViewer, THREE, sphereGeo, glossy } from "../three/core.js";
import { createAtom } from "../three/atom.js";
import { MOLECULES, CPK, COV_R } from "../data/molecules.js";

export async function render(el) {
  el.appendChild(h(`<div>
    <p class="lead">Химия — наука о веществах: из чего они состоят, как устроены и как превращаются друг в друга. Всё вокруг — воздух, вода, ты сам — состоит из веществ, а значит, химия везде.</p>
    ${kid("Химия — это как огромный конструктор LEGO. Детальки — это атомы. Из них природа собирает всё на свете: и камень, и яблоко, и тебя!")}
  </div>`));

  el.appendChild(h(`<section id="what"><h2>Тела и вещества</h2>
    <p><b>Физическое тело</b> — это любой предмет: ложка, гвоздь, стакан. <b>Вещество</b> — то, из чего тело сделано: сталь, медь, стекло. Из одного вещества можно сделать разные тела (стальные ложка и гвоздь), а одно тело — из разных веществ (карандаш: дерево, графит, краска).</p>
    <div class="table-wrap"><table class="data">
      <tr><th>Тело</th><th>Вещество</th></tr>
      <tr><td>Ложка</td><td>сталь, серебро или дерево</td></tr>
      <tr><td>Окно</td><td>стекло</td></tr>
      <tr><td>Снежинка</td><td>вода (лёд)</td></tr>
      <tr><td>Проволока</td><td>медь или алюминий</td></tr>
    </table></div>
    <h3>Чистые вещества и смеси</h3>
    <p><b>Чистое вещество</b> состоит из частиц одного вида: дистиллированная вода, сахар, кислород. <b>Смесь</b> — из нескольких веществ: морская вода, воздух, молоко. Смеси можно разделить физически: отстаиванием, фильтрованием, выпариванием, перегонкой, магнитом.</p>
    <p><b>Простые</b> вещества образованы атомами одного элемента (железо Fe, кислород O₂, алмаз C). <b>Сложные</b> — атомами разных элементов (вода H₂O, соль NaCl).</p>
    <div class="callout adv">Сейчас известно 118 химических элементов, но веществ — более 200 миллионов, и каждый день химики синтезируют новые.</div>
  </section>`));

  el.appendChild(h(`<section id="phenomena"><h2>Физические и химические явления</h2>
    <div class="grid-2">
      <div class="card pad"><h3 class="mt0">Физические</h3><p>Вещество остаётся тем же, меняется только форма или состояние.</p><ul><li>лёд тает → вода</li><li>сахар растворяется в чае</li><li>проволоку сгибают</li></ul></div>
      <div class="card pad"><h3 class="mt0">Химические (реакции)</h3><p>Из одних веществ получаются <b>новые</b>.</p><ul><li>железо ржавеет</li><li>дрова горят</li><li>молоко скисает</li></ul></div>
    </div>
    <p style="margin-top:14px">Признаки химической реакции: изменение цвета, выделение газа, выпадение осадка, появление запаха, выделение тепла или света.</p>
    ${kid("Если из вещества получилось что-то совсем новое (и обратно просто так не вернуть) — это химия. Сгоревшую спичку не «разжечь назад»!")}
  </section>`));

  // ---------- путешествие вглубь ----------
  const sec = h(`<section id="zoom"><h2>Путешествие вглубь капли</h2>
    <p>Сдвигай ползунок и уменьшайся: от капли воды до ядра атома. На каждом шаге мир становится в тысячи раз меньше.</p></section>`);
  el.appendChild(sec);
  const st = stage(`<div class="overlay"><span><b data-t></b></span><span data-s></span></div>`);
  sec.appendChild(st);
  const ctrl = h(`<div class="card pad" style="margin-top:10px"><label class="ctl">Масштаб<input type="range" min="0" max="4" step="1" value="0"></label><p data-d class="mt0" style="margin:10px 0 0"></p></div>`);
  sec.appendChild(ctrl);

  const STEPS = [
    { t: "Капля воды", s: "≈ 4 мм", d: "Капля кажется сплошной и гладкой. Но если её «увеличить» в миллионы раз…" },
    { t: "Молекулы воды", s: "≈ 1 нм (миллионная доля миллиметра)", d: "…видны отдельные молекулы. Они постоянно двигаются и толкаются. В одной капле их около 1,5 тысячи миллиардов миллиардов (1,5·10²¹)!" },
    { t: "Одна молекула H₂O", s: "≈ 0,3 нм", d: "Молекула воды — один атом кислорода (красный) и два атома водорода (белые). Угол между ними — 104,5°." },
    { t: "Атом кислорода", s: "≈ 0,12 нм", d: "Атом — это ядро и электроны вокруг. У кислорода 8 протонов, 8 нейтронов и 8 электронов. Почти весь атом — пустота!" },
    { t: "Ядро атома", s: "≈ 0,000006 нм (6 фемтометров)", d: "Ядро в 20 000 раз меньше атома, но в нём 99,97% массы. Если бы атом был размером со стадион, ядро было бы горошиной в центре." },
  ];

  const v = createViewer(st, { camera: [0, 1.5, 9], minDistance: 3, maxDistance: 30 });
  const groups = [new THREE.Group(), new THREE.Group(), new THREE.Group(), new THREE.Group(), new THREE.Group()];
  groups.forEach((g) => v.scene.add(g));
  // 0 — капля
  const drop = new THREE.Mesh(new THREE.SphereGeometry(2.4, 64, 48), new THREE.MeshPhysicalMaterial({ color: 0x5fb8ff, roughness: 0.05, transmission: 0.6, thickness: 1.5, transparent: true, opacity: 0.85, clearcoat: 1 }));
  drop.scale.y = 1.12;
  groups[0].add(drop);
  // 1 — много молекул
  const water = MOLECULES.find((m) => m.id === "H2O").data;
  const molMesh = () => {
    const g = new THREE.Group();
    for (const a of water.atoms) {
      const m = new THREE.Mesh(sphereGeo(a.el === "O" ? 0.42 : 0.3, 20), glossy(CPK[a.el]));
      m.position.set(...a.pos.map((c) => c * 0.75));
      g.add(m);
    }
    return g;
  };
  const swarm = [];
  for (let i = 0; i < 46; i++) {
    const g = molMesh();
    const p = new THREE.Vector3().randomDirection().multiplyScalar(Math.cbrt(Math.random()) * 3.2);
    g.position.copy(p);
    g.rotation.set(Math.random() * 6, Math.random() * 6, 0);
    g.userData.home = p.clone();
    g.userData.ph = Math.random() * 10;
    groups[1].add(g);
    swarm.push(g);
  }
  // 2 — одна молекула (крупно)
  const one = molMesh();
  one.scale.setScalar(2.6);
  groups[2].add(one);
  // 3 — атом кислорода
  const atomView = { scene: groups[3], onFrame: v.onFrame, clear: v.clear, camera: v.camera, controls: v.controls };
  const atom = createAtom(atomView, { z: 8, n: 8, e: 8, shells: [2, 6] });
  // 4 — ядро
  const nucView = { scene: groups[4], onFrame: v.onFrame, clear: v.clear, camera: v.camera, controls: v.controls };
  const nuc = createAtom(nucView, { z: 8, n: 8, e: 0, shells: [] });
  nuc.group.scale.setScalar(5.5);

  let target = 0;
  const shown = [1, 0, 0, 0, 0];
  v.onFrame((dt, t) => {
    groups.forEach((g, i) => {
      shown[i] += ((i === target ? 1 : 0) - shown[i]) * Math.min(1, dt * 5);
      g.visible = shown[i] > 0.02;
      // приближающийся слой растёт из центра, уходящий — «пролетает» мимо
      const s = i === target ? 0.4 + 0.6 * shown[i] : 1 + (1 - shown[i]) * 3;
      g.scale.setScalar(Math.max(0.001, s));
    });
    for (const m of swarm) {
      const ph = m.userData.ph + t;
      m.position.set(m.userData.home.x + Math.sin(ph * 1.3) * 0.25, m.userData.home.y + Math.cos(ph * 1.1) * 0.25, m.userData.home.z + Math.sin(ph * 0.9) * 0.25);
      m.rotation.x += dt * 0.6;
    }
  });
  const setStep = (i) => {
    target = i;
    st.querySelector("[data-t]").textContent = STEPS[i].t;
    st.querySelector("[data-s]").textContent = STEPS[i].s;
    ctrl.querySelector("[data-d]").textContent = STEPS[i].d;
  };
  ctrl.querySelector("input").oninput = (e) => setStep(+e.target.value);
  setStep(0);

  el.appendChild(h(`<section id="safety"><h2>Правила безопасности</h2>
    <p>Химия — наука экспериментальная, но опыты требуют аккуратности.</p>
    <ol>
      <li>Опыты проводят только со взрослыми или с учителем.</li>
      <li>Ничего не пробуют на вкус и не нюхают прямо из склянки — запах «подгоняют» к себе ладонью.</li>
      <li>Используют защитные очки и перчатки.</li>
      <li><b>Кислоту льют в воду</b>, а не наоборот («Сначала вода, потом кислота — иначе случится большая беда»).</li>
      <li>Пробирку при нагревании направляют отверстием от себя и от людей.</li>
      <li>Бытовую химию (отбеливатели, средства для труб) никогда не смешивают.</li>
    </ol>
    <div class="callout warn">Смешивание хлорсодержащего отбеливателя с кислотным средством выделяет ядовитый хлор. Это частая причина отравлений дома.</div>
  </section>`));
}

export const quiz = [
  { q: "Что из этого — вещество, а не тело?", options: ["Гвоздь", "Медь", "Стакан", "Карандаш"], answer: 1, why: "Медь — материал (вещество). Гвоздь, стакан и карандаш — предметы (тела)." },
  { q: "Какое явление химическое?", options: ["Таяние льда", "Растворение сахара", "Ржавление железа", "Сгибание проволоки"], answer: 2, why: "При ржавлении образуется новое вещество — оксид железа." },
  { q: "Где почти вся масса атома?", options: ["В электронах", "В ядре", "Распределена равномерно", "В пустоте между частицами"], answer: 1, why: "Ядро крошечное, но в нём 99,97% массы атома." },
  { q: "Как правильно разбавлять кислоту?", options: ["Лить воду в кислоту", "Лить кислоту в воду", "Без разницы", "Сразу нагреть"], answer: 1, why: "Кислоту тонкой струйкой вливают в воду — так тепло рассеивается и нет брызг." },
  { q: "Воздух — это…", options: ["чистое вещество", "простое вещество", "смесь газов", "химический элемент"], answer: 2, why: "Воздух — смесь: около 78% азота, 21% кислорода, аргон, CO₂ и пары воды." },
];
