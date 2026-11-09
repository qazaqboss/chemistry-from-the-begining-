import { h, kid, term, stage } from "../ui.js";
import { createViewer, THREE, sphereGeo, glossy } from "../three/core.js";
import { fmt } from "../chem.js";

// Вязкость воды, мПа·с (формула Фогеля, точна в пределах ~1 % для 0…100 °C)
const etaWater = (t) => 0.02939 * Math.exp(507.88 / (t + 273.15 - 149.3));
// Коэффициент диффузии перманганат-иона в воде: ~1,6·10⁻⁹ м²/с при 25 °C; D ∝ T/η (Стокс — Эйнштейн)
const Dreal = (t) => 1.6e-9 * ((t + 273.15) / 298.15) * (etaWater(25) / etaWater(t));
const gauss = () => { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };

// ---------- сцена 1: капля краски в стакане ----------
function dropScene(v) {
  const N = 900, RAD = 2.4, BOT = -2.3, TOP = 2.1;
  const g = new THREE.Group();
  v.scene.add(g);
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(RAD + 0.12, RAD + 0.12, 5.2, 64, 1, true),
    new THREE.MeshPhysicalMaterial({ color: 0xcfe8ff, transparent: true, opacity: 0.16, roughness: 0.05, side: THREE.DoubleSide, depthWrite: false }));
  glass.position.y = -0.1;
  const bottom = new THREE.Mesh(new THREE.CylinderGeometry(RAD + 0.12, RAD + 0.12, 0.12, 64), new THREE.MeshPhysicalMaterial({ color: 0xcfe8ff, transparent: true, opacity: 0.3, roughness: 0.1 }));
  bottom.position.y = BOT - 0.12;
  const water = new THREE.Mesh(new THREE.CylinderGeometry(RAD, RAD, TOP - BOT, 64),
    new THREE.MeshPhysicalMaterial({ color: 0x5aa8ff, transparent: true, opacity: 0.1, roughness: 0.2, depthWrite: false }));
  water.position.y = (TOP + BOT) / 2;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(RAD, 0.02, 8, 96), new THREE.MeshBasicMaterial({ color: 0x9fd0ff, transparent: true, opacity: 0.6 }));
  rim.rotation.x = Math.PI / 2; rim.position.y = TOP;
  g.add(glass, bottom, water, rim);

  const im = new THREE.InstancedMesh(sphereGeo(0.055, 10), glossy(0xffffff, { roughness: 0.5, clearcoat: 0 }), N);
  const col = new THREE.Color();
  for (let i = 0; i < N; i++) im.setColorAt(i, col.setHSL(0.79 + Math.random() * 0.04, 0.85, 0.42 + Math.random() * 0.12));
  g.add(im);
  const P = new Float32Array(N * 3), V = new Float32Array(N);
  const m4 = new THREE.Matrix4();
  let T = 20, simTime = 0;
  function reset() {
    simTime = 0;
    for (let i = 0; i < N; i++) {
      const r = 0.22 * Math.cbrt(Math.random()), th = Math.random() * 6.283, ph = Math.acos(2 * Math.random() - 1);
      P[i * 3] = r * Math.sin(ph) * Math.cos(th);
      P[i * 3 + 1] = 1.7 + r * Math.cos(ph);
      P[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
      V[i] = 0.6 + Math.random() * 0.5; // капля немного «падает» по инерции
    }
  }
  reset();
  v.onFrame((dt) => {
    if (!dt) return;
    simTime += dt;
    const D = 0.03 * (Dreal(T) / Dreal(20));
    const s = Math.sqrt(2 * D * dt);
    for (let i = 0; i < N; i++) {
      let x = P[i * 3] + s * gauss(), y = P[i * 3 + 1] + s * gauss() - V[i] * dt, z = P[i * 3 + 2] + s * gauss();
      V[i] *= Math.exp(-dt * 0.9);
      const rr = Math.hypot(x, z);
      if (rr > RAD - 0.06) { const k = (2 * (RAD - 0.06) - rr) / rr; x *= k; z *= k; }
      if (y < BOT + 0.06) { y = 2 * (BOT + 0.06) - y; V[i] = 0; }
      if (y > TOP - 0.06) y = 2 * (TOP - 0.06) - y;
      P[i * 3] = x; P[i * 3 + 1] = y; P[i * 3 + 2] = z;
      m4.makeTranslation(x, y, z);
      im.setMatrixAt(i, m4);
    }
    im.instanceMatrix.needsUpdate = true;
  });
  return {
    reset,
    setT(t) { T = t; },
    spread() { // среднеквадратичное удаление частиц от центра капли
      let s = 0;
      for (let i = 0; i < N; i++) s += P[i * 3] ** 2 + (P[i * 3 + 1] - 1.7) ** 2 + P[i * 3 + 2] ** 2;
      return Math.sqrt(s / N);
    },
    time: () => simTime,
  };
}

// ---------- сцена 2: броуновская частица среди молекул ----------
function brownScene(v) {
  const B = 2.8, N = 420, Rg = 0.5, M = 30;
  const g = new THREE.Group();
  v.scene.add(g);
  g.add(new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(2 * B, 2 * B, 2 * B)), new THREE.LineBasicMaterial({ color: 0x7fa8ff, transparent: true, opacity: 0.45 })));
  const grain = new THREE.Mesh(sphereGeo(Rg, 40), glossy(0xf0b23a, { roughness: 0.55 }));
  g.add(grain);
  const im = new THREE.InstancedMesh(sphereGeo(0.05, 8), new THREE.MeshStandardMaterial({ color: 0x6fb6ff, roughness: 0.4 }), N);
  g.add(im);
  const TR = 700;
  const trailPos = new Float32Array(TR * 3);
  const trailGeo = new THREE.BufferGeometry();
  trailGeo.setAttribute("position", new THREE.BufferAttribute(trailPos, 3));
  trailGeo.setDrawRange(0, 0);
  const trail = new THREE.Line(trailGeo, new THREE.LineBasicMaterial({ color: 0xffd36b, transparent: true, opacity: 0.85 }));
  g.add(trail);
  let nTrail = 0, acc = 0, T = 20;
  const p = [], vel = [];
  const vT = () => 3.2 * Math.sqrt((T + 273) / 293);
  for (let i = 0; i < N; i++) {
    let q;
    do q = new THREE.Vector3((Math.random() * 2 - 1) * B, (Math.random() * 2 - 1) * B, (Math.random() * 2 - 1) * B); while (q.length() < Rg + 0.2);
    p.push(q);
    vel.push(new THREE.Vector3(gauss(), gauss(), gauss()).multiplyScalar(vT() / Math.sqrt(3)));
  }
  const G = new THREE.Vector3(), GV = new THREE.Vector3();
  const m4 = new THREE.Matrix4(), n = new THREE.Vector3(), rel = new THREE.Vector3();
  function clearTrail() { nTrail = 0; trailGeo.setDrawRange(0, 0); }
  v.onFrame((dt) => {
    if (!dt) return;
    const steps = 3, h_ = dt / steps;
    for (let s = 0; s < steps; s++) {
      let e2 = 0;
      for (let i = 0; i < N; i++) {
        const q = p[i], w = vel[i];
        q.addScaledVector(w, h_);
        for (const ax of ["x", "y", "z"]) {
          if (q[ax] > B) { q[ax] = 2 * B - q[ax]; w[ax] = -Math.abs(w[ax]); }
          if (q[ax] < -B) { q[ax] = -2 * B - q[ax]; w[ax] = Math.abs(w[ax]); }
        }
        n.subVectors(q, G);
        const d = n.length();
        if (d < Rg + 0.05) {
          n.divideScalar(d || 1);
          const un = rel.subVectors(w, GV).dot(n);
          if (un < 0) { // упругий удар: масса молекулы 1, частицы M
            const J = (2 * un) / (1 + 1 / M);
            w.addScaledVector(n, -J);
            GV.addScaledVector(n, J / M);
          }
          q.copy(G).addScaledVector(n, Rg + 0.05);
        }
        e2 += w.lengthSq();
      }
      // мягкий термостат: средняя скорость молекул соответствует температуре
      const k = Math.pow(vT() ** 2 / (e2 / N), 0.02);
      for (const w of vel) w.multiplyScalar(k);
      G.addScaledVector(GV, h_);
      for (const ax of ["x", "y", "z"]) {
        if (G[ax] > B - Rg) { G[ax] = B - Rg; GV[ax] = -Math.abs(GV[ax]); }
        if (G[ax] < -B + Rg) { G[ax] = -B + Rg; GV[ax] = Math.abs(GV[ax]); }
      }
    }
    grain.position.copy(G);
    for (let i = 0; i < N; i++) { m4.makeTranslation(p[i].x, p[i].y, p[i].z); im.setMatrixAt(i, m4); }
    im.instanceMatrix.needsUpdate = true;
    acc += dt;
    if (acc > 0.04) {
      acc = 0;
      if (nTrail >= TR) { trailPos.copyWithin(0, 3); nTrail = TR - 1; }
      trailPos.set([G.x, G.y, G.z], nTrail * 3);
      nTrail++;
      trailGeo.attributes.position.needsUpdate = true;
      trailGeo.setDrawRange(0, nTrail);
    }
  });
  return { setT(t) { T = t; }, showMolecules(b) { im.visible = b; }, clearTrail };
}

export async function render(el) {
  el.appendChild(h(`<div>
    <p class="lead">Капни краску в стакан воды и не трогай его — краска сама расползётся по всей воде. Открой флакон духов — через минуту запах почувствуют в другом конце комнаты. Это ${term("diffusion", "диффузия")}: частицы веществ всё время движутся и сами перемешиваются.</p>
    ${kid("Молекулы — непоседы! Они никогда не стоят на месте: толкаются, отскакивают друг от друга и потихоньку разбредаются во все стороны. Поэтому запах пирога из кухни доходит до твоей комнаты, даже если никто его не несёт.")}
  </div>`));

  // ---------- капля ----------
  const s1 = h(`<section id="drop"><h2>Капля краски в воде</h2>
    <p>В модели — 900 частиц краски (например, марганцовки) в стакане воды. Каждую частицу со всех сторон бомбардируют молекулы воды, и она шагает в случайную сторону. Ни одна частица не «знает», куда идти, — но вместе они неизбежно расползаются из тесноты туда, где их меньше.</p></section>`);
  el.appendChild(s1);
  const st1 = stage(`<div class="overlay"><span data-a style="font-size:1rem"></span><span data-b></span></div>`, { wide: true });
  s1.appendChild(st1);
  const c1 = h(`<div class="card pad" style="margin-top:10px">
    <label class="ctl">Температура воды: <b data-tv></b><input type="range" min="0" max="90" step="1" value="20"></label>
    <div class="row" style="margin-top:10px"><button class="btn small primary" type="button" data-reset>💧 Капнуть заново</button><span class="small muted" data-d></span></div>
  </div>`);
  s1.appendChild(c1);
  const v1 = createViewer(st1, { camera: [0, 1.6, 10.5], target: [0, -0.1, 0], autoRotateSpeed: 0.35, fitWidth: 3.2 });
  const drop = dropScene(v1);
  const r1 = c1.querySelector("input");
  const upd1 = () => {
    const t = +r1.value;
    drop.setT(t);
    c1.querySelector("[data-tv]").textContent = `${t} °C`;
    const rel = Dreal(t) / Dreal(20);
    c1.querySelector("[data-d]").innerHTML = `Скорость расплывания ×${fmt(rel, 2)} по сравнению с 20 °C <span class="adv">· D ≈ ${fmt(Dreal(t) * 1e9, 2)}·10⁻⁹ м²/с</span>`;
  };
  r1.oninput = upd1;
  c1.querySelector("[data-reset]").onclick = () => drop.reset();
  upd1();
  const ov1 = () => {
    st1.querySelector("[data-a]").innerHTML = `<b>${r1.value} °C</b>`;
    st1.querySelector("[data-b]").textContent = `размер облака: ${fmt(drop.spread(), 2)}`;
  };
  let ovAcc = 0;
  v1.onFrame((dt) => { ovAcc += dt; if (ovAcc > 0.25) { ovAcc = 0; ov1(); } });
  ov1();
  s1.appendChild(h(`<div class="callout"><b>Важно:</b> в горячей воде краска расплывается заметно быстрее. Нагревание ускоряет движение молекул, а вода становится менее вязкой: при 80 °C её вязкость почти втрое меньше, чем при 20 °C. Поэтому чай в кипятке заваривается за минуты, а в холодной воде — часами.</div>`));
  s1.appendChild(h(`<p class="small muted">Время в модели сильно ускорено. Чистая диффузия очень медленная: за час частица марганцовки уходит в среднем всего на 3 мм. В настоящем стакане краску быстрее разносят течения — тёплая вода поднимается, холодная опускается (конвекция).</p>`));

  // ---------- броуновское движение ----------
  const s2 = h(`<section id="brown"><h2>Броуновское движение</h2>
    <p>В 1827 году ботаник Роберт Броун рассматривал в микроскоп частички из пыльцы растений в воде и увидел, что они беспрерывно дрожат и мечутся, хотя воду никто не трогает. Объяснение нашли почти через 80 лет: крупинку со всех сторон толкают невидимые молекулы воды, и толчки никогда не уравновешиваются точно. Это ${term("brownian_motion", "броуновское движение")} — прямое доказательство, что молекулы существуют и движутся.</p></section>`);
  el.appendChild(s2);
  const st2 = stage(`<div class="overlay"><span data-a style="font-size:1rem"><b>Крупинка в воде</b></span><span data-b></span></div>`);
  s2.appendChild(st2);
  const c2 = h(`<div class="card pad" style="margin-top:10px">
    <label class="ctl">Температура: <b data-tv></b><input type="range" min="0" max="100" step="1" value="20"></label>
    <div class="row" style="margin-top:10px"><label class="row small"><input type="checkbox" data-show checked> Показать молекулы воды</label><button class="btn small" type="button" data-clear>Стереть след</button></div>
    <p class="small muted" style="margin:10px 0 0">Выключи молекулы — и увидишь то, что видел Броун: одну крупинку, которая сама собой рисует ломаную линию.</p>
  </div>`);
  s2.appendChild(c2);
  const v2 = createViewer(st2, { camera: [5, 3.5, 8], autoRotateSpeed: 0.3 });
  const br = brownScene(v2);
  const r2 = c2.querySelector("input");
  const upd2 = () => {
    br.setT(+r2.value);
    c2.querySelector("[data-tv]").textContent = `${r2.value} °C`;
    st2.querySelector("[data-b]").textContent = `скорость молекул ×${fmt(Math.sqrt((+r2.value + 273) / 293), 2)}`;
  };
  r2.oninput = upd2;
  c2.querySelector("[data-show]").onchange = (e) => br.showMolecules(e.target.checked);
  c2.querySelector("[data-clear]").onclick = () => br.clearTrail();
  upd2();
  s2.appendChild(h(`<p class="adv small muted">Масштаб в модели условный: настоящая крупинка в 10 000 раз больше молекулы воды и тяжелее её в триллионы раз. Альберт Эйнштейн (1905) вывел формулу для такого блуждания: среднее смещение растёт как √t — за вчетверо большее время частица уходит только вдвое дальше. Жан Перрен (1908) проверил формулу опытом и по ней нашёл число Авогадро.</p>`));

  // ---------- запахи ----------
  const s3 = h(`<section id="smell"><h2>Как распространяются запахи</h2>
    <p>Молекулы воздуха летают очень быстро: молекула азота при комнатной температуре мчится со скоростью около <b>500 м/с</b> — быстрее пули из старинного ружья. Почему же запах из кухни идёт к нам секунды и минуты? Потому что молекула не летит по прямой: каждую секунду она сталкивается с соседями миллиарды раз и после каждого удара меняет направление. Её путь — запутанная ломаная, как у крупинки Броуна.</p>
    ${kid("Представь, что ты бежишь через толпу на школьной перемене: бежишь быстро, но всё время на кого-то натыкаешься и отлетаешь. До двери доберёшься нескоро! Так и молекулы духов пробираются сквозь толпу молекул воздуха.")}
    <h3 class="adv">Опыт с двумя ватками</h3>
    <p class="adv">В длинную трубку с одного конца кладут ватку с нашатырным спиртом (выделяется аммиак NH₃), с другого — с соляной кислотой (выделяется HCl). Где газы встретятся, появится белое кольцо хлорида аммония: NH₃ + HCl → NH₄Cl. Кольцо возникает ближе к ватке с кислотой: лёгкие молекулы NH₃ (M = 17 г/моль) движутся быстрее тяжёлых HCl (M = 36,5 г/моль). Скорость обратно пропорциональна √M — это закон Грэма.</p>
    <div class="card pad adv" data-tube>
      <svg viewBox="0 0 400 70" width="100%" role="img" aria-label="Трубка с аммиаком и хлороводородом">
        <rect x="10" y="22" width="380" height="26" rx="13" fill="none" stroke="currentColor" opacity=".4"/>
        <rect x="14" y="26" width="0" height="18" rx="9" fill="#6fb6ff" opacity=".55" data-l/>
        <rect x="386" y="26" width="0" height="18" rx="9" fill="#ffd36b" opacity=".55" data-r/>
        <rect x="0" y="20" width="0" height="30" fill="#fff" data-ring/>
        <text x="16" y="15" font-size="12" fill="currentColor">NH₃</text><text x="356" y="15" font-size="12" fill="currentColor">HCl</text>
      </svg>
      <div class="row" style="margin-top:8px"><button class="btn small" type="button" data-go>▶ Запустить опыт</button><span class="small muted" data-msg></span></div>
    </div>
  </section>`);
  el.appendChild(s3);
  {
    const box = s3.querySelector("[data-tube]");
    const L = box.querySelector("[data-l]"), Rr = box.querySelector("[data-r]"), ring = box.querySelector("[data-ring]");
    const vA = 1 / Math.sqrt(17), vB = 1 / Math.sqrt(36.5), len = 372;
    const meet = (len * vA) / (vA + vB);
    let raf = 0;
    box.querySelector("[data-go]").onclick = () => {
      cancelAnimationFrame(raf);
      ring.setAttribute("width", 0);
      const t0 = performance.now(), dur = 3500;
      const step = (now) => {
        const k = Math.min(1, (now - t0) / dur);
        const a = meet * k, b = (len - meet) * k;
        L.setAttribute("width", a); Rr.setAttribute("x", 386 - b); Rr.setAttribute("width", b);
        if (k < 1) raf = requestAnimationFrame(step);
        else {
          ring.setAttribute("x", 14 + meet - 3); ring.setAttribute("width", 6);
          box.querySelector("[data-msg]").textContent = `Кольцо NH₄Cl на ${fmt((meet / len) * 100, 0)} % длины от аммиака: √(36,5/17) ≈ 1,47 — во столько раз NH₃ быстрее.`;
        }
      };
      raf = requestAnimationFrame(step);
    };
  }

  // ---------- где быстрее ----------
  el.appendChild(h(`<section id="states"><h2>В газах, жидкостях и твёрдых телах</h2>
    <p>Диффузия идёт везде, но с очень разной скоростью — всё решает, насколько тесно стоят частицы и насколько сильно держат друг друга.</p>
    <div class="table-wrap"><table class="data">
      <tr><th>Среда</th><th>Пример</th><th>Как быстро</th></tr>
      <tr><td>Газ</td><td>запах духов в комнате</td><td>сантиметры за секунды (без сквозняка)</td></tr>
      <tr><td>Жидкость</td><td>сахар в неразмешанном чае</td><td>миллиметры за час</td></tr>
      <tr><td>Твёрдое тело</td><td>золото в свинце</td><td>доли миллиметра за годы</td></tr>
    </table></div>
    <p>Опыт Уильяма Робертс-Остена (1896): на свинцовый брусок положили золотую пластинку и оставили при комнатной температуре. Через четыре года атомы золота обнаружили внутри свинца на глубине в несколько миллиметров. Даже в твёрдом металле атомы потихоньку меняются местами!</p>
    <div class="callout adv">Скорость диффузии описывают коэффициентом диффузии D (м²/с). Для газов в воздухе D ~ 10⁻⁵ м²/с, для молекул в воде ~ 10⁻⁹ м²/с, для атомов в металлах при комнатной температуре — 10⁻²⁰ м²/с и меньше. Характерное расстояние за время t: x ≈ √(2Dt).</div>
  </section>`));

  el.appendChild(h(`<section id="life"><h2>Диффузия вокруг нас</h2>
    <ul>
      <li><b>Дыхание.</b> Кислород из лёгких проходит в кровь через тончайшие стенки альвеол именно диффузией, а углекислый газ — обратно.</li>
      <li><b>Растения</b> получают углекислый газ через устьица листьев, а корни всасывают растворённые вещества.</li>
      <li><b>Кухня.</b> Соль проникает в огурцы при засолке, сахар — в ягоды при варке варенья.</li>
      <li><b>Техника.</b> Сталь «насыщают» углеродом или азотом при нагреве, чтобы сделать поверхность твёрдой; в кремний вводят примеси, чтобы получить микросхемы.</li>
    </ul>
    <h3>Опыт дома</h3>
    <p>Возьми два прозрачных стакана: один с холодной водой из-под крана, другой с горячей (пусть нальёт взрослый). Одновременно опусти в каждый по чайному пакетику и не размешивай. Через 2–3 минуты сравни: где окрашенное облако больше? Запиши, сколько минут нужно, чтобы цвет дошёл до дна в каждом стакане.</p>
    ${kid("Ещё опыт: попроси взрослого брызнуть духами в углу комнаты, а сам встань в другом углу и засеки время по часам, когда почувствуешь запах. Ты измерил скорость диффузии!", "Попробуй сам")}
  </section>`));
}

export const quiz = [
  { q: "Что такое диффузия?", options: ["Растворение только сахара", "Самопроизвольное перемешивание веществ из-за движения частиц", "Нагревание воды", "Превращение жидкости в газ"], answer: 1, why: "Частицы непрерывно движутся и сами проникают между частицами другого вещества." },
  { q: "Где краска расплывётся быстрее?", options: ["В холодной воде", "В горячей воде", "Одинаково", "Только в солёной воде"], answer: 1, why: "При нагревании молекулы движутся быстрее, а вязкость воды уменьшается." },
  { q: "Почему крупинка пыльцы в воде дрожит (броуновское движение)?", options: ["Она живая", "Её неравномерно толкают молекулы воды", "Из-за света микроскопа", "Её притягивает Земля"], answer: 1, why: "Удары молекул с разных сторон никогда точно не уравновешиваются." },
  { q: "В какой среде диффузия идёт быстрее всего?", options: ["В твёрдом теле", "В жидкости", "В газе", "Везде одинаково"], answer: 2, why: "В газе частицы далеко друг от друга и почти не мешают двигаться." },
  { q: "Молекулы воздуха летят со скоростью ~500 м/с. Почему запах идёт медленно?", options: ["Запах тяжелее воздуха", "Молекулы постоянно сталкиваются и меняют направление", "Молекулы духов неподвижны", "Нос медленно работает"], answer: 1, why: "Путь молекулы — ломаная из миллиардов столкновений в секунду." },
];
