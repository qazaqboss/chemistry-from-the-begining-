import { h, kid, term, stage, chips } from "../ui.js";
import { createViewer, THREE, sphereGeo, textSprite, glowSprite } from "../three/core.js";
import { fmt } from "../chem.js";

// Цвет отвара краснокочанной капусты при pH 1…14 (по фотографиям реальных опытов)
const CABBAGE = ["#d0103a", "#df2e66", "#d6407f", "#b4458f", "#8e4a9e", "#734fa8", "#5b55b1", "#3e64c0", "#2c84b6", "#1f9b8e", "#28a45c", "#73b43a", "#c8c12a", "#ddb81c"];
const mix = (a, b, t) => new THREE.Color(a).lerp(new THREE.Color(b), Math.max(0, Math.min(1, t)));
const cabbage = (pH) => { const x = Math.max(1, Math.min(14, pH)) - 1, i = Math.floor(Math.min(x, 12.999)); return mix(CABBAGE[i], CABBAGE[i + 1], x - i); };
const CLEAR = "#e8f1ff";
const INDICATORS = [
  { name: "Капуста", color: cabbage, range: "меняется во всём диапазоне 1–14" },
  { name: "Лакмус", color: (p) => (p < 6.4 ? mix("#d23a3a", "#8a4a9a", (p - 4.5) / 1.9) : mix("#8a4a9a", "#3a52c8", (p - 6.4) / 1.9)), range: "красный < 4,5 · фиолетовый · синий > 8,3" },
  { name: "Фенолфталеин", color: (p) => (p < 12.5 ? mix(CLEAR, "#d0186e", (p - 8.2) / 1.8) : mix("#d0186e", CLEAR, (p - 12.5) / 1.5)), range: "бесцветный < 8,2 · малиновый 8,2–12" },
  { name: "Метилоранж", color: (p) => (p < 3.8 ? mix("#e0302a", "#f08a1e", (p - 3.1) / 0.7) : mix("#f08a1e", "#f2c919", (p - 3.8) / 0.6)), range: "красный < 3,1 · оранжевый · жёлтый > 4,4" },
];
const THINGS = [
  { name: "Желудочный сок", pH: 1.5 }, { name: "Лимонный сок", pH: 2.3 }, { name: "Столовый уксус", pH: 2.5 }, { name: "Газировка «кола»", pH: 2.5 },
  { name: "Апельсиновый сок", pH: 3.5 }, { name: "Кефир", pH: 4.4 }, { name: "Чёрный кофе", pH: 5 }, { name: "Молоко", pH: 6.6 },
  { name: "Чистая вода", pH: 7 }, { name: "Кровь", pH: 7.4 }, { name: "Морская вода", pH: 8.1 }, { name: "Раствор пищевой соды", pH: 8.3 },
  { name: "Хозяйственное мыло", pH: 10 }, { name: "Нашатырный спирт", pH: 11.6 }, { name: "Известковая вода", pH: 12.4 }, { name: "Средство для прочистки труб", pH: 13.5 },
];
const kind = (p) => (p < 6.5 ? "кислая" : p <= 7.5 ? "нейтральная" : "щелочная");

// Пробирка: стекло + жидкость (тело вращения)
function tube(group, x, z, height = 3) {
  const R = 0.32;
  const prof = (r, top, bot = -height / 2) => {
    const pts = [];
    for (let i = 0; i <= 10; i++) { const a = (Math.PI / 2) * (i / 10); pts.push(new THREE.Vector2(r * Math.sin(a), bot + r - r * Math.cos(a))); }
    pts.push(new THREE.Vector2(r, top));
    return pts;
  };
  const glass = new THREE.Mesh(new THREE.LatheGeometry(prof(R, height / 2), 40),
    new THREE.MeshPhysicalMaterial({ color: 0xe6f2ff, transparent: true, opacity: 0.2, roughness: 0.05, side: THREE.DoubleSide, depthWrite: false }));
  const rim = new THREE.Mesh(new THREE.TorusGeometry(R, 0.025, 8, 40), new THREE.MeshBasicMaterial({ color: 0xcfe4ff, transparent: true, opacity: 0.7 }));
  rim.rotation.x = Math.PI / 2; rim.position.y = height / 2;
  const liqMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.88, roughness: 0.15, clearcoat: 0.5 });
  const liquid = new THREE.Mesh(new THREE.LatheGeometry(prof(R - 0.035, 0.25, -height / 2 + 0.035), 40), liqMat);
  const cap = new THREE.Mesh(new THREE.CircleGeometry(R - 0.035, 40), liqMat);
  cap.rotation.x = -Math.PI / 2; cap.position.y = 0.25;
  const t = new THREE.Group();
  t.add(liquid, cap, glass, rim);
  t.position.set(x, 0, z);
  group.add(t);
  return { group: t, mat: liqMat };
}

function rackScene(v) {
  const g = new THREE.Group();
  v.scene.add(g);
  const wood = new THREE.MeshStandardMaterial({ color: 0xb98652, roughness: 0.7 });
  const plank = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.16, 1.1), wood); plank.position.y = -1.6; g.add(plank);
  const top = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.12, 1.1), wood); top.position.y = 0.4; g.add(top);
  const tubes = INDICATORS.map((I, i) => {
    const x = (i - 1.5) * 1.75;
    const t = tube(g, x, 0);
    const lab = textSprite(I.name, { size: 0.24 }); lab.position.set(x, -2.05, 0.6); g.add(lab);
    return { ...t, cur: new THREE.Color(CLEAR), target: new THREE.Color(CLEAR) };
  });
  const drops = tubes.map((t) => { const d = new THREE.Mesh(sphereGeo(0.09, 16), new THREE.MeshPhysicalMaterial({ color: 0xcfe4ff, transparent: true, opacity: 0.8 })); d.visible = false; t.group.add(d); return d; });
  let dropT = 2;
  v.onFrame((dt) => {
    dropT += dt;
    drops.forEach((d) => { d.visible = dropT < 0.5; d.position.y = 2.2 - dropT * 4; });
    const k = dropT < 0.5 ? 0 : Math.min(1, dt * 2.5);
    for (const t of tubes) { t.cur.lerp(t.target, k); t.mat.color.copy(t.cur); }
  });
  return {
    set(pH, animate) {
      tubes.forEach((t, i) => t.target.copy(INDICATORS[i].color(pH)));
      if (animate) dropT = 0;
    },
  };
}

function rainbowScene(v) {
  const g = new THREE.Group();
  v.scene.add(g);
  const tubes = [];
  for (let i = 0; i < 14; i++) {
    const a = ((i - 6.5) / 13) * 2.2; // дуга
    const x = Math.sin(a) * 6, z = -Math.cos(a) * 6 + 6;
    const t = tube(g, x, z, 2.6);
    t.mat.color.copy(cabbage(i + 1));
    t.group.rotation.y = -a;
    const lab = textSprite(String(i + 1), { size: 0.34 }); lab.position.set(x, -1.75, z); g.add(lab);
    const glow = glowSprite(0xffffff, 2.2, 0.0); glow.position.set(x, 0, z - 0.1); g.add(glow);
    tubes.push({ ...t, glow, y: 0, ty: 0 });
  }
  v.onFrame((dt) => {
    for (const t of tubes) { t.y += (t.ty - t.y) * Math.min(1, dt * 5); t.group.position.y = t.y; t.glow.position.y = t.y; t.glow.material.opacity = t.y * 1.2; }
  });
  return { pick(pH) { tubes.forEach((t, i) => (t.ty = Math.abs(i + 1 - pH) < 0.5 || (pH === 14 && i === 13) ? 0.5 : 0)); } };
}

export async function render(el) {
  el.appendChild(h(`<div>
    <p class="lead">Есть вещества-«шпионы», которые меняют цвет в зависимости от того, куда попали — в кислоту или в щёлочь. Их называют ${term("indicator_acidbase", "индикаторами")}. Один из лучших индикаторов растёт на грядке: это краснокочанная капуста.</p>
    ${kid("Лимон кислый, а мыло скользкое и горькое. Пробовать химические вещества на вкус нельзя — зато можно спросить у индикатора! Он покраснеет в кислоте и позеленеет или посинеет в щёлочи. Как светофор, только химический.")}
  </div>`));

  el.appendChild(h(`<section id="acid-base"><h2>Кислоты и щёлочи</h2>
    <div class="grid-2">
      <div class="card pad"><b>Кислоты</b> — кислые на вкус (лимонная кислота, уксус). В воде дают много ионов водорода H⁺. Сильные кислоты (серная, соляная) разъедают кожу и ткань.</div>
      <div class="card pad"><b>Щёлочи</b> — мылкие на ощупь, горькие. В воде дают ионы OH⁻. Пищевая сода — очень слабая щёлочь, а средство для труб — сильная и опасная.</div>
    </div>
    <p>Кислота и щёлочь «гасят» друг друга — это <b>нейтрализация</b>: H⁺ + OH⁻ → H₂O. Поэтому соду бросают в уксус: шипит и получается почти нейтральный раствор.</p>
    <p>Насколько среда кислая или щелочная, показывает число ${term("ph", "pH")} от 0 до 14. pH = 7 — нейтрально (чистая вода), меньше 7 — кислая среда, больше 7 — щелочная. Шаг на 1 означает, что ионов H⁺ стало в 10 раз больше или меньше: лимонный сок (pH ≈ 2) в 100 000 раз кислее чистой воды!</p>
    <div class="callout warn"><b>Безопасность:</b> не пробуй вещества на вкус и не нюхай их близко. Работай в перчатках и очках, а нашатырь, средства для чистки и уксусную эссенцию бери только вместе со взрослыми.</div>
  </section>`));

  // ---------- 4 индикатора ----------
  const s2 = h(`<section id="rack"><h2>Четыре индикатора в одном растворе</h2>
    <p>Нальём в четыре пробирки одинаковый раствор и капнем в каждую свой индикатор. Двигай pH или выбери вещество из жизни:</p></section>`);
  el.appendChild(s2);
  const st2 = stage(`<div class="overlay"><span data-a style="font-size:1rem"></span><span data-b></span></div>`, { wide: true });
  s2.appendChild(st2);
  const c2 = h(`<div class="card pad" style="margin-top:10px">
    <label class="ctl">pH раствора: <b data-pv></b><input type="range" min="1" max="14" step="0.1" value="7"></label>
    <div data-scale style="height:14px;border-radius:7px;margin:8px 0 4px"></div>
    <div class="row small muted" style="justify-content:space-between"><span>кислая</span><span>нейтральная</span><span>щелочная</span></div>
    <div data-ch style="margin-top:10px"></div>
  </div>`);
  s2.appendChild(c2);
  c2.querySelector("[data-scale]").style.background = `linear-gradient(90deg, ${CABBAGE.join(",")})`;
  const v2 = createViewer(st2, { camera: [0, 0.6, 9.5], target: [0, -0.4, 0], autoRotateSpeed: 0.3, fitWidth: 4 });
  const rack = rackScene(v2);
  const r2 = c2.querySelector("input");
  let last = -1;
  const upd2 = (anim) => {
    const p = +r2.value;
    rack.set(p, anim);
    c2.querySelector("[data-pv]").textContent = `${fmt(p, 1)} — среда ${kind(p)}`;
    st2.querySelector("[data-a]").innerHTML = `<b>pH ${fmt(p, 1)}</b>`;
    st2.querySelector("[data-b]").textContent = `среда ${kind(p)}`;
  };
  r2.oninput = () => { const p = Math.round(+r2.value); upd2(p !== last); last = p; };
  chips(c2.querySelector("[data-ch]"), THINGS.map((t) => ({ ...t, label: t.name })), (t) => {
    r2.value = t.pH; upd2(true);
    st2.querySelector("[data-a]").innerHTML = `<b>${t.name}</b> · pH ${fmt(t.pH, 1)}`;
  }, 8);
  upd2(true);
  s2.appendChild(h(`<div class="table-wrap"><table class="data">
    <tr><th>Индикатор</th><th>Кислая среда</th><th>Нейтральная</th><th>Щелочная</th></tr>
    <tr><td>${term("litmus", "Лакмус")}</td><td>красный</td><td>фиолетовый</td><td>синий</td></tr>
    <tr><td>${term("phenolphthalein", "Фенолфталеин")}</td><td>бесцветный</td><td>бесцветный</td><td>малиновый</td></tr>
    <tr><td>${term("methyl_orange", "Метиловый оранжевый")}</td><td>красный</td><td>жёлтый</td><td>жёлтый</td></tr>
    <tr><td>Капустный отвар</td><td>красный, розовый</td><td>фиолетовый</td><td>синий, зелёный, жёлтый</td></tr>
  </table></div>`));
  s2.appendChild(h(`<p>Обрати внимание: у каждого индикатора свой <b>интервал перехода</b>. Фенолфталеин «не замечает» разницу между кислотой и водой — он только сообщает, что среда стала щелочной (pH > 8,2). Метилоранж, наоборот, желтеет уже при pH 4,4 и не отличит слабую кислоту от щёлочи. Поэтому химики подбирают индикатор под задачу, а капуста хороша тем, что меняет цвет много раз.</p>`));
  s2.appendChild(h(`<p class="adv small muted">Фенолфталеин в очень сильной щёлочи (pH > 13) снова обесцвечивается — это видно, если сдвинуть ползунок до конца. Лакмус добывают из лишайников, а слово «лакмусовая бумажка» стало крылатым: так называют любой простой и надёжный признак.</p>`));

  // ---------- радуга ----------
  const s3 = h(`<section id="rainbow"><h2>Капустная радуга</h2>
    <p>Четырнадцать пробирок с растворами pH от 1 до 14 и по ложке капустного отвара в каждой. Выбери вещество — и пробирка с его pH поднимется.</p></section>`);
  el.appendChild(s3);
  const st3 = stage(`<div class="overlay"><span data-a style="font-size:1rem"><b>pH 1 → 14</b></span><span data-b></span></div>`, { wide: true });
  s3.appendChild(st3);
  const c3 = h(`<div class="card pad" style="margin-top:10px"><div data-ch></div></div>`);
  s3.appendChild(c3);
  const v3 = createViewer(st3, { camera: [0, 3.2, 13], target: [0, -0.3, 2], autoRotate: false, fitWidth: 6.8, maxDistance: 40 });
  const rb = rainbowScene(v3);
  chips(c3.querySelector("[data-ch]"), THINGS.map((t) => ({ ...t, label: `${t.name} · ${fmt(t.pH, 1)}` })), (t) => {
    rb.pick(Math.round(t.pH));
    st3.querySelector("[data-a]").innerHTML = `<b>${t.name}</b>`;
    st3.querySelector("[data-b]").textContent = `pH ${fmt(t.pH, 1)} · ${kind(t.pH)}`;
  }, -1);

  el.appendChild(h(`<section id="experiment"><h2>Опыт: индикатор из капусты</h2>
    <ol>
      <li>Мелко нарежь 3–4 листа краснокочанной капусты, залей стаканом горячей воды (это делает взрослый) и оставь на 15–20 минут.</li>
      <li>Процеди: получится фиолетовый отвар — это и есть индикатор. Хранить его можно в холодильнике пару дней.</li>
      <li>Налей в прозрачные стаканчики понемногу: лимонного сока, уксуса, воды, раствора соды, раствора мыла.</li>
      <li>Добавь в каждый по 2–3 ложки отвара и запиши цвета. Сравни с капустной радугой выше и оцени pH.</li>
      <li>Фокус: в стаканчик с содой понемногу подливай уксус — цвет пойдёт от зелёного через синий и фиолетовый к розовому. Это нейтрализация, которую видно глазами!</li>
    </ol>
    ${kid("Можно сделать индикаторную бумагу: пропитай полоски бумажного фильтра отваром и высуши. Капни на полоску лимонным соком — она порозовеет, а мыльной водой — позеленеет.", "Попробуй сам")}
  </section>`));

  el.appendChild(h(`<section id="how"><h2>Почему меняется цвет</h2>
    <p>В капусте, чернике, вишне, лепестках роз и васильков есть красящие вещества — ${term("anthocyanin", "антоцианы")}. Их молекулы могут присоединять или терять ион водорода H⁺. При этом слегка меняется строение молекулы, а значит, и то, какой свет она поглощает. Мы видим остальные цвета — и каждый вариант молекулы окрашен по-своему.</p>
    <p>Природа сама ставит такие опыты. Чай с лимоном светлеет, а черничный сок на мыльной губке зеленеет. Цвет гортензии зависит от почвы: в кислой почве растению доступен алюминий, и цветы голубые, а в щелочной — розовые.</p>
    <div class="callout adv">Индикатор — это слабая кислота HInd, у которой «кислая» и «щелочная» формы окрашены по-разному: HInd ⇄ H⁺ + Ind⁻. В кислой среде много H⁺, равновесие сдвинуто влево — виден цвет HInd; в щелочной H⁺ связываются с OH⁻ в воду, и преобладает Ind⁻. Переход заметен примерно в интервале pK ± 1.</div>
  </section>`));
}

export const quiz = [
  { q: "Какой pH у нейтрального раствора (чистой воды)?", options: ["0", "1", "7", "14"], answer: 2, why: "Меньше 7 — кислая среда, больше 7 — щелочная." },
  { q: "Каким становится лакмус в кислоте?", options: ["синим", "красным", "зелёным", "бесцветным"], answer: 1, why: "Лакмус: красный в кислоте, синий в щёлочи." },
  { q: "Фенолфталеин малиновый. Какая среда?", options: ["кислая", "нейтральная", "щелочная", "любая"], answer: 2, why: "Фенолфталеин окрашивается при pH > 8,2." },
  { q: "Капустный отвар в лимонном соке будет…", options: ["красно-розовым", "зелёным", "жёлтым", "синим"], answer: 0, why: "Лимонный сок — кислая среда, pH ≈ 2." },
  { q: "Что произойдёт с цветом капустного индикатора в растворе соды, если подливать уксус?", options: ["Ничего", "Станет зелёным", "Пойдёт от зелёного к фиолетовому и розовому", "Станет чёрным"], answer: 2, why: "Уксус нейтрализует соду, pH падает — цвет меняется по радуге в обратную сторону." },
  { q: "Как называются красители капусты и черники, меняющие цвет?", options: ["Антоцианы", "Хлорофиллы", "Белки", "Крахмалы"], answer: 0, why: "Антоцианы присоединяют или теряют H⁺, и их цвет меняется." },
];
