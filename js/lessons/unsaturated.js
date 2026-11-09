import { h, kid, term, stage, chips } from "../ui.js";
import { createViewer, THREE, easeInOut } from "../three/core.js";
import { createMolecule, frame } from "../three/molecule.js";
import { ethene, ethyne, benzene, butene2, plotStyles } from "../three/y1011-kit.js";

// Полупрозрачные облака: p-орбитали (две доли разного знака), π-облака, σ-связи
const lobeGeo = new THREE.SphereGeometry(1, 28, 20);
const lobeMat = (c, o = 0.34) => new THREE.MeshPhongMaterial({ color: c, transparent: true, opacity: o, depthWrite: false, shininess: 60, side: THREE.DoubleSide });
const PLUS = 0x4f8dff, MINUS = 0xff5a7a, PI = 0x58e0c8, SIGMA = 0xffd36e;

function pOrbital(at, axis, s = 1) {
  const g = new THREE.Group();
  [1, -1].forEach((k) => {
    const m = new THREE.Mesh(lobeGeo, lobeMat(k > 0 ? PLUS : MINUS));
    m.scale.set(0.4 * s, 0.78 * s, 0.4 * s);
    m.position.set(0, 0.74 * s * k, 0);
    g.add(m);
  });
  g.position.set(...at);
  g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(...axis).normalize());
  return g;
}
function sigmaBonds(data) {
  const g = new THREE.Group();
  for (const [i, j] of data.bonds) {
    const a = new THREE.Vector3(...data.atoms[i].pos), b = new THREE.Vector3(...data.atoms[j].pos);
    const m = new THREE.Mesh(lobeGeo, lobeMat(SIGMA, 0.28));
    const d = b.clone().sub(a);
    m.scale.set(0.26, d.length() / 2, 0.26);
    m.position.copy(a).add(b).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
    g.add(m);
  }
  return g;
}
function piCloud(kind) {
  const g = new THREE.Group();
  if (kind === "ethene") {
    [1, -1].forEach((k) => { const m = new THREE.Mesh(lobeGeo, lobeMat(PI, 0.4)); m.scale.set(1.25, 0.42, 0.5); m.position.set(0, 0, 0.62 * k); g.add(m); });
  } else if (kind === "ethyne") {
    const m = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.3, 20, 40), lobeMat(PI, 0.4));
    m.rotation.y = Math.PI / 2; m.scale.set(1, 1, 3.2); g.add(m);
  } else {
    [1, -1].forEach((k) => { const m = new THREE.Mesh(new THREE.TorusGeometry(1.4, 0.34, 20, 64), lobeMat(PI, 0.42)); m.position.z = 0.62 * k; m.scale.z = 0.7; g.add(m); });
  }
  return g;
}

const KINDS = [
  { id: "ethene", label: "Этен C₂H₄", data: ethene(), info: "sp²-гибридизация · угол ≈ 120° · C=C 1,34 Å · 614 кДж/моль", note: "Каждый атом C образует три σ-связи (sp²-гибридные орбитали лежат в одной плоскости под 120°), а оставшиеся негибридные p-орбитали стоят перпендикулярно плоскости и перекрываются «боками» — так возникает π-связь. π-облако лежит над и под плоскостью молекулы: здесь электроны доступнее всего, поэтому алкены легко присоединяют электрофилы (Br₂, HBr, H⁺)." },
  { id: "ethyne", label: "Этин C₂H₂", data: ethyne(), info: "sp-гибридизация · угол 180° · C≡C 1,20 Å · 839 кДж/моль", note: "У атома C в этине две sp-орбитали (линия, 180°) и две p-орбитали, перпендикулярные друг другу. Они дают две π-связи в двух взаимно перпендикулярных плоскостях; вместе их облака образуют цилиндрическую «муфту» вокруг оси молекулы. Тройная связь = 1σ + 2π." },
  { id: "benzene", label: "Бензол C₆H₆", data: benzene(), info: "sp² · плоское кольцо · все C–C 1,40 Å", note: "Шесть p-орбиталей кольца перекрываются все со всеми соседями — шесть π-электронов делокализованы над и под кольцом. Поэтому все связи C–C одинаковы (1,40 Å — между одинарной 1,54 Å и двойной 1,34 Å), а бензол устойчив и предпочитает реакции замещения, а не присоединения." },
];

const ADD = [
  { label: "H₂ (Ni, t)", eq: "CH₂=CH–CH₃ + H₂ → CH₃–CH₂–CH₃", note: "Гидрирование: π-связь разрывается, к каждому атому C присоединяется H. Получается пропан." },
  { label: "Br₂ (бромная вода)", eq: "CH₂=CH–CH₃ + Br₂ → CH₂Br–CHBr–CH₃", note: "Бромная вода обесцвечивается — качественная реакция на кратную связь. Продукт — 1,2-дибромпропан." },
  { label: "HBr", eq: "CH₂=CH–CH₃ + HBr → CH₃–CHBr–CH₃", note: "Правило Марковникова: H идёт к более гидрированному атому C (CH₂=), Br — к менее гидрированному. Причина — промежуточный вторичный карбокатион CH₃–C⁺H–CH₃ устойчивее первичного. Главный продукт — 2-бромпропан." },
  { label: "H₂O (H⁺)", eq: "CH₂=CH–CH₃ + H₂O → CH₃–CH(OH)–CH₃", note: "Гидратация тоже идёт по Марковникову: получается пропанол-2 (изопропиловый спирт), а не пропанол-1." },
  { label: "KMnO₄ (H₂O, 0 °C)", eq: "3CH₂=CH–CH₃ + 2KMnO₄ + 4H₂O → 3CH₂(OH)–CH(OH)–CH₃ + 2MnO₂↓ + 2KOH", note: "Реакция Вагнера: фиолетовый раствор обесцвечивается, выпадает бурый MnO₂. Образуется двухатомный спирт пропандиол-1,2." },
  { label: "полимеризация", eq: "n CH₂=CH–CH₃ → (–CH₂–CH(CH₃)–)ₙ", note: "π-связи раскрываются и молекулы сцепляются в длинную цепь — полипропилен (трубы, контейнеры, волокна)." },
];

export async function render(el) {
  el.appendChild(h(`<div>${plotStyles()}
    <p class="lead">Непредельные углеводороды содержат кратные связи C=C или C≡C, ароматические — бензольное кольцо. Ключ ко всей их химии — ${term("pi_bond", "π-связь")}: облако электронов над и под линией связи, которое легко атакуют реагенты.</p>
    ${kid("В алканах атомы углерода держатся друг за друга одной рукой. А в алкенах — двумя: одна рука крепкая (σ), вторая «запасная» (π) и легко отпускается. Поэтому алкены охотно хватают новые атомы — им есть чем!")}
    <p class="small muted">Основы — цепочки, гомологи, алканы — в уроке <a href="#lesson-organic">«Органическая химия»</a>.</p>
  </div>`));

  // ---------- σ и π ----------
  const s1 = h(`<section id="sigma-pi"><h2>σ- и π-связи в 3D</h2>
    <p><b>σ-связь</b> — перекрывание орбиталей по линии, соединяющей ядра; вокруг неё возможно вращение. <b>π-связь</b> — боковое перекрывание p-орбиталей над и под этой линией; она слабее (≈ 266 кДж/моль против 348 у σ-связи C–C) и «запирает» вращение. Переключай слои: σ-скелет, отдельные p-орбитали (синий и красный — разные знаки волновой функции) и общее π-облако.</p></section>`);
  el.appendChild(s1);
  const chipBox = h(`<div style="margin-bottom:10px"></div>`);
  s1.appendChild(chipBox);
  const st = stage(`<div class="overlay"><span data-t style="font-size:1rem"></span><span data-i></span></div>`, { wide: true });
  s1.appendChild(st);
  const ctl = h(`<div class="card pad" style="margin-top:10px">
    <div class="seg"><button type="button" data-m="sigma">σ-скелет</button><button type="button" data-m="p" class="on">p-орбитали</button><button type="button" data-m="pi">π-облако</button></div>
    <p data-n style="margin:12px 0 0"></p></div>`);
  s1.appendChild(ctl);
  const v = createViewer(st, { camera: [3, 4, 9], fitWidth: 3.4, minDistance: 3, maxDistance: 30, autoRotateSpeed: 0.6 });
  const mol = createMolecule(v, KINDS[0].data);
  const layer = new THREE.Group(); v.scene.add(layer);
  let kind = KINDS[0], mode = "p";
  const draw = () => {
    v.clear(layer);
    const cs = kind.data.atoms.filter((a) => a.el === "C");
    if (mode === "sigma") layer.add(sigmaBonds(kind.data));
    if (mode === "p") {
      if (kind.id === "ethyne") cs.forEach((a) => { layer.add(pOrbital(a.pos, [0, 0, 1], 0.9)); layer.add(pOrbital(a.pos, [0, 1, 0], 0.9)); });
      else cs.forEach((a) => layer.add(pOrbital(a.pos, [0, 0, 1])));
    }
    if (mode === "pi") layer.add(piCloud(kind.id));
    st.querySelector("[data-t]").innerHTML = `<b>${kind.label}</b>`;
    st.querySelector("[data-i]").textContent = kind.info;
    ctl.querySelector("[data-n]").innerHTML = kind.note;
  };
  chips(chipBox, KINDS, (k) => { kind = k; mol.set(k.data); frame(v, mol.radius() - 0.2); draw(); });
  ctl.querySelectorAll("[data-m]").forEach((b) => (b.onclick = () => { ctl.querySelectorAll("[data-m]").forEach((x) => x.classList.toggle("on", x === b)); mode = b.dataset.m; draw(); }));
  frame(v, mol.radius() - 0.2); draw();

  el.appendChild(h(`<section id="alkenes"><h2>Алкены и алкины: строение и изомерия</h2>
    <div class="table-wrap"><table class="data">
      <tr><th>Класс</th><th>Общая формула</th><th>Гибридизация</th><th>Связь</th><th>Пример</th></tr>
      <tr><td>Алкены</td><td class="formula">CₙH₂ₙ (n ≥ 2)</td><td>sp², 120°</td><td>C=C (σ + π)</td><td>этен CH₂=CH₂, пропен</td></tr>
      <tr><td>Алкины</td><td class="formula">CₙH₂ₙ₋₂ (n ≥ 2)</td><td>sp, 180°</td><td>C≡C (σ + 2π)</td><td>этин HC≡CH</td></tr>
      <tr><td>Алкадиены</td><td class="formula">CₙH₂ₙ₋₂ (n ≥ 3)</td><td>sp²</td><td>две C=C</td><td>бутадиен-1,3 CH₂=CH–CH=CH₂</td></tr>
      <tr><td>Арены</td><td class="formula">CₙH₂ₙ₋₆ (n ≥ 6)</td><td>sp², плоское кольцо</td><td>ароматическая</td><td>бензол, толуол C₆H₅CH₃</td></tr>
    </table></div>
    <p><b>Виды изомерии алкенов:</b> углеродного скелета (бутен-1 и 2-метилпропен), положения двойной связи (бутен-1 и бутен-2), межклассовая с циклоалканами (C₄H₈ — бутен и циклобутан) и пространственная ${term("cis_trans", "цис-транс-изомерия")}. Алкины изомерны алкадиенам (C₄H₆: бутин-1 и бутадиен-1,3).</p>
    <p><b>Название</b> строят от самой длинной цепи, содержащей кратную связь; нумеруют с того конца, к которому ближе кратная связь, и ставят её номер перед суффиксом: CH₃–CH=CH–CH₃ — бутен-2, CH≡C–CH₂–CH₃ — бутин-1.</p>
  </section>`));

  // ---------- цис / транс ----------
  const s2 = h(`<section id="cis-trans"><h2>Цис- и транс-бутен-2: вращение запрещено</h2>
    <p>Попробуй «повернуть» правую половину молекулы вокруг двойной связи. Пока p-орбитали параллельны, π-связь цела. При повороте их перекрывание падает как cos θ, и при 90° π-связь полностью рвётся — на это нужно ≈ 270 кДж/моль. При комнатной температуре такой энергии у молекул нет, поэтому цис- и транс-изомеры — <b>разные вещества</b>, которые сами друг в друга не переходят.</p></section>`);
  el.appendChild(s2);
  const st2 = stage(`<div class="overlay"><span data-t style="font-size:1rem"></span><span data-e></span></div>`, { wide: true });
  s2.appendChild(st2);
  const c2 = h(`<div class="card pad" style="margin-top:10px">
    <label class="ctl">Угол поворота вокруг C=C: <b data-a></b><input type="range" min="0" max="180" value="0" step="1"></label>
    <div class="row" style="margin-top:10px"><button class="btn small" type="button" data-cis>цис (0°)</button><button class="btn small" type="button" data-tr>транс (180°)</button><button class="btn primary small" type="button" data-go>▶ Повернуть</button></div>
    <div style="margin-top:12px;height:12px;border-radius:6px;background:var(--surface-2);overflow:hidden"><i data-bar style="display:block;height:100%;width:0;background:linear-gradient(90deg,var(--good),var(--warn),var(--bad))"></i></div>
    <p data-n class="small" style="margin:10px 0 0"></p></div>`);
  s2.appendChild(c2);
  const v2 = createViewer(st2, { camera: [2.5, 3, 9], fitWidth: 3.6, autoRotate: false, minDistance: 3, maxDistance: 30 });
  const m2 = createMolecule(v2, butene2(0));
  frame(v2, m2.radius() - 0.1);
  const lobes = new THREE.Group(); v2.scene.add(lobes);
  const rng = c2.querySelector("input");
  let anim = null;
  const setA = (a) => {
    rng.value = a;
    const d = butene2(a);
    m2.set(d);
    v2.clear(lobes);
    const t = (a * Math.PI) / 180;
    lobes.add(pOrbital(d.atoms[0].pos, [0, 0, 1], 0.95));
    lobes.add(pOrbital(d.atoms[1].pos, [0, -Math.sin(t), Math.cos(t)], 0.95));
    const ov = Math.abs(Math.cos(t)), E = 270 * Math.sin(t) ** 2;
    c2.querySelector("[data-a]").textContent = a + "°";
    c2.querySelector("[data-bar]").style.width = (E / 270) * 100 + "%";
    const name = a < 3 ? "цис-бутен-2" : a > 177 ? "транс-бутен-2" : "переходное состояние";
    st2.querySelector("[data-t]").innerHTML = `<b>${name}</b>`;
    st2.querySelector("[data-e]").textContent = `перекрывание p-орбиталей ${Math.round(ov * 100)} % · ΔE ≈ ${Math.round(E)} кДж/моль`;
    c2.querySelector("[data-n]").innerHTML = a < 3
      ? "Обе группы CH₃ по одну сторону двойной связи. t<sub>кип</sub> = 3,7 °C, t<sub>пл</sub> = −139 °C; молекула слабо полярна (μ ≈ 0,3 D)."
      : a > 177 ? "Группы CH₃ по разные стороны. t<sub>кип</sub> = 0,9 °C, t<sub>пл</sub> = −106 °C (симметричные молекулы плотнее упаковываются в кристалле); μ = 0."
      : a > 80 && a < 100 ? "<b>θ ≈ 90°: p-орбитали перпендикулярны, перекрывания нет — π-связь разорвана.</b> Для сравнения: вращение вокруг одинарной связи C–C в бутане требует лишь 14–25 кДж/моль и идёт миллиарды раз в секунду."
      : "π-связь ослабевает: p-орбитали всё хуже перекрываются. Энергия растёт как sin²θ (оценка).";
  };
  rng.oninput = () => { anim = null; setA(+rng.value); };
  c2.querySelector("[data-cis]").onclick = () => { anim = null; setA(0); };
  c2.querySelector("[data-tr]").onclick = () => { anim = null; setA(180); };
  c2.querySelector("[data-go]").onclick = () => { anim = { from: +rng.value, to: +rng.value > 90 ? 0 : 180, t: 0 }; };
  let last = performance.now();
  v2.onFrame(() => {
    const now = performance.now(), dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (!anim) return;
    anim.t = Math.min(1, anim.t + dt / 3);
    setA(Math.round(anim.from + (anim.to - anim.from) * easeInOut(anim.t)));
    if (anim.t >= 1) anim = null;
  });
  setA(0);
  s2.appendChild(h(`<div class="callout"><b>Условие цис-транс-изомерии:</b> у <i>каждого</i> из двух атомов C при двойной связи должны быть два <i>разных</i> заместителя. У бутена-2 (CH₃ и H на обоих концах) она есть, а у бутена-1 CH₂=CH–CH₂CH₃ — нет: на одном конце два одинаковых H.</div>`));

  // ---------- реакции присоединения ----------
  const s3 = h(`<section id="addition"><h2>Реакции присоединения: тренажёр на пропене</h2>
    <p>Для алкенов характерно <b>электрофильное присоединение</b> по месту π-связи. Выбери реагент — увидишь продукт и объяснение. Несимметричные реагенты (HBr, H₂O) присоединяются по ${term("markovnikov", "правилу Марковникова")} (1869).</p>
    <div data-c style="margin-bottom:10px"></div>
    <div class="card pad"><div class="eq" data-eq style="margin-top:0"></div><p data-n style="margin:0"></p></div>
  </section>`);
  el.appendChild(s3);
  const out = (r) => { s3.querySelector("[data-eq]").textContent = r.eq; s3.querySelector("[data-n]").innerHTML = r.note; };
  chips(s3.querySelector("[data-c]"), ADD, out); out(ADD[0]);
  s3.appendChild(h(`<div class="callout warn adv"><b>Исключение — перекисный эффект (М. Хараш).</b> В присутствии пероксидов HBr присоединяется радикально и <i>против</i> правила: получается 1-бромпропан. Правило Марковникова также «переворачивается» у алкенов с акцепторными группами: CH₂=CH–COOH + HBr → CH₂Br–CH₂–COOH.</div>`));

  el.appendChild(h(`<section id="alkynes"><h2>Алкины и диены</h2>
    <ul>
      <li><b>Получение ацетилена:</b> CaC₂ + 2H₂O → HC≡CH↑ + Ca(OH)₂; в промышленности — пиролиз метана: 2CH₄ → C₂H₂ + 3H₂ (1500 °C).</li>
      <li><b>Присоединение идёт в две ступени:</b> HC≡CH + Br₂ → CHBr=CHBr, затем + Br₂ → CHBr₂–CHBr₂.</li>
      <li><b>Реакция Кучерова</b> (Hg²⁺, H⁺): HC≡CH + H₂O → [CH₂=CH–OH] → CH₃–CHO. Енол неустойчив и перестраивается в уксусный альдегид; гомологи дают кетоны.</li>
      <li><b>Кислотность концевых алкинов:</b> атом H при sp-углероде подвижен: HC≡CH + 2[Ag(NH₃)₂]OH → AgC≡CAg↓ + 4NH₃ + 2H₂O — серовато-белый осадок ацетиленида. Бутин-2 так не реагирует — это способ их различить.</li>
      <li><b>Тримеризация</b> (Н. Д. Зелинский, C<sub>акт</sub>, 600 °C): 3HC≡CH → C₆H₆.</li>
      <li><b>Сопряжённые диены</b> (бутадиен-1,3) присоединяют и в 1,2-, и в 1,4-положения: CH₂=CH–CH=CH₂ + Br₂ → CH₂Br–CH=CH–CH₂Br (1,4-продукт). Их полимеризация даёт каучуки; С. В. Лебедев в 1932 г. впервые наладил промышленный синтез бутадиенового каучука из этанола.</li>
    </ul>
  </section>`));

  el.appendChild(h(`<section id="arenes"><h2>Бензол и ароматичность</h2>
    <p>${term("aromaticity", "Ароматичность")} — особая устойчивость плоских циклов с замкнутой системой из (4n + 2) π-электронов (правило Хюккеля; у бензола n = 1, 6 π-электронов). Энергия «лишней» стабилизации — около 150 кДж/моль: столько бензол выигрывает по сравнению с гипотетическим циклогексатриеном с тремя изолированными C=C. Поэтому бензол <b>не обесцвечивает</b> бромную воду и раствор KMnO₄, а вступает в <b>реакции замещения</b>, сохраняющие кольцо:</p>
    <div class="eq">C₆H₆ + Br₂ —(FeBr₃)→ C₆H₅Br + HBr</div>
    <div class="eq">C₆H₆ + HNO₃ —(H₂SO₄ конц.)→ C₆H₅NO₂ + H₂O</div>
    <p>Присоединение возможно лишь в жёстких условиях: C₆H₆ + 3H₂ —(Ni, t, p)→ C₆H₁₂; C₆H₆ + 3Cl₂ —(свет)→ C₆H₆Cl₆.</p>
    <p class="adv"><b>Гомологи бензола.</b> В толуоле C₆H₅–CH₃ группа CH₃ — ориентант I рода: замещение идёт в орто- и пара-положения (2,4,6-тринитротолуол — тротил), и быстрее, чем у бензола. Боковая цепь окисляется перманганатом: C₆H₅CH₃ → C₆H₅COOH (бензойная кислота) — этим толуол отличают от бензола. Группы –NO₂, –COOH — ориентанты II рода (мета-положение), они замедляют замещение.</p>
  </section>`));

  el.appendChild(h(`<section id="task"><h2>Разбор задачи</h2>
    <div class="card pad">
      <p><b>Условие.</b> Какую массу брома может присоединить 2,24 л (н. у.) смеси этена и этина, если объёмная доля этина 40 %?</p>
      <p><b>Решение.</b> n(смеси) = 2,24 / 22,4 = 0,1 моль; n(C₂H₂) = 0,04 моль, n(C₂H₄) = 0,06 моль.<br>
      C₂H₄ + Br₂ → C₂H₄Br₂: Br₂ — 0,06 моль. C₂H₂ + 2Br₂ → C₂H₂Br₄: Br₂ — 0,08 моль.<br>
      n(Br₂) = 0,14 моль; m = 0,14 · 160 = <b>22,4 г</b>.</p>
      <p class="small muted" style="margin:0">Главное — помнить, что тройная связь присоединяет вдвое больше реагента, чем двойная.</p>
    </div>
  </section>`));
}

export const quiz = [
  { q: "Сколько σ- и π-связей между атомами углерода в молекуле этина?", options: ["1σ и 1π", "1σ и 2π", "3σ", "2σ и 1π"], answer: 1, why: "Тройная связь = одна σ + две π (в двух перпендикулярных плоскостях)." },
  { q: "Главный продукт реакции пропена с HCl:", options: ["1-хлорпропан", "2-хлорпропан", "1,2-дихлорпропан", "хлорпропен"], answer: 1, why: "По правилу Марковникова H присоединяется к CH₂=, хлор — к среднему атому C." },
  { q: "У какого вещества возможна цис-транс-изомерия?", options: ["бутен-1", "2-метилпропен", "пентен-2", "этен"], answer: 2, why: "CH₃–CH=CH–C₂H₅: у каждого атома C при двойной связи два разных заместителя." },
  { q: "Каким реактивом можно отличить бутин-1 от бутина-2?", options: ["бромной водой", "аммиачным раствором оксида серебра", "водородом", "раствором KMnO₄"], answer: 1, why: "Концевой атом H у тройной связи замещается на серебро — выпадает осадок; бутин-2 концевого H не имеет." },
  { q: "Почему бензол не обесцвечивает бромную воду?", options: ["в нём нет π-электронов", "ароматическая π-система устойчива, характерно замещение", "бензол не растворяется в воде", "бром не реагирует с углеводородами"], answer: 1, why: "Присоединение разрушило бы ароматическую систему из 6 π-электронов; бромирование идёт только с катализатором FeBr₃ и как замещение." },
  { q: "Гибридизация атомов углерода в бензоле:", options: ["sp³", "sp²", "sp", "sp³d"], answer: 1, why: "Каждый C образует три σ-связи под 120°, а p-орбиталь участвует в общем π-облаке." },
];
