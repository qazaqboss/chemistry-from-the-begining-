import { h, kid, term, stage, chips } from "../ui.js";
import { createViewer, THREE, sphereGeo, glossy, textSprite, bondMesh } from "../three/core.js";
import { fmt } from "../chem.js";

// Плотности при ~20 °C, г/см³
const MATERIALS = [
  { id: "foam", name: "пенопласт", rho: 0.03, color: 0xf4f6fb },
  { id: "cork", name: "пробка", rho: 0.24, color: 0xc9935a },
  { id: "pine", name: "сосна (сухая)", rho: 0.5, color: 0xe8c38a },
  { id: "ice", name: "лёд", rho: 0.917, color: 0xcfeaff },
  { id: "al", name: "алюминий", rho: 2.7, color: 0xc4ccd6 },
  { id: "fe", name: "железо", rho: 7.87, color: 0x8a8f99 },
  { id: "cu", name: "медь", rho: 8.96, color: 0xd08048 },
  { id: "pb", name: "свинец", rho: 11.34, color: 0x6c7280 },
  { id: "au", name: "золото", rho: 19.3, color: 0xffcc33 },
];

// Башня из жидкостей (снизу вверх)
const LIQ = [
  { name: "мёд", rho: 1.42, color: 0xd98a12, op: 0.82, visc: 0.35 },
  { name: "вода (подкрашена)", rho: 1.0, color: 0x3d8bff, op: 0.45, visc: 2.6 },
  { name: "подсолнечное масло", rho: 0.92, color: 0xf2cf3c, op: 0.6, visc: 1.6 },
  { name: "спирт (подкрашен)", rho: 0.79, color: 0xff5ea8, op: 0.35, visc: 2.8 },
];
const OBJ = [
  { name: "Пробка", rho: 0.24, m: 1.9, V: 8, shape: "cube", color: 0xc9935a },
  { name: "Сосновый брусок", rho: 0.5, m: 4, V: 8, shape: "cube", color: 0xe8c38a },
  { name: "Бусина из полипропилена", rho: 0.9, m: 3.8, V: 4.2, shape: "ball", color: 0x46d39a },
  { name: "Перепелиное яйцо", rho: 1.07, m: 11, V: 10.3, shape: "egg", color: 0xf4ead8 },
  { name: "Кусочек ПЭТ-бутылки", rho: 1.38, m: 2.8, V: 2, shape: "chip", color: 0x9fd8ff },
  { name: "Стальная гайка", rho: 7.8, m: 9.4, V: 1.2, shape: "nut", color: 0x9aa1ad },
];

function towerScene(v) {
  const g = new THREE.Group();
  v.scene.add(g);
  const RAD = 1.6, LH = 1.1, BOT = -2.4;
  const tops = LIQ.map((_, i) => BOT + (i + 1) * LH);
  LIQ.forEach((L, i) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(RAD, RAD, LH, 64),
      new THREE.MeshPhysicalMaterial({ color: L.color, transparent: true, opacity: L.op, roughness: 0.15, depthWrite: false }));
    m.position.y = BOT + (i + 0.5) * LH;
    m.renderOrder = 1;
    g.add(m);
    const t = textSprite(`${L.name} · ${fmt(L.rho, 2)} г/см³`, { size: 0.26 });
    t.position.set(RAD + 1.55, m.position.y, 0);
    g.add(t);
  });
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(RAD + 0.1, RAD + 0.1, 6.2, 64, 1, true),
    new THREE.MeshPhysicalMaterial({ color: 0xdff0ff, transparent: true, opacity: 0.14, roughness: 0.05, side: THREE.DoubleSide, depthWrite: false }));
  glass.position.y = BOT + 3.1;
  g.add(glass);

  const geos = {
    cube: new THREE.BoxGeometry(0.5, 0.5, 0.5),
    ball: sphereGeo(0.26, 28),
    egg: (() => { const s = sphereGeo(0.3, 28); s.scale(0.8, 1, 0.8); return s; })(),
    chip: new THREE.BoxGeometry(0.55, 0.06, 0.4),
    nut: (() => { const s = new THREE.CylinderGeometry(0.28, 0.28, 0.2, 6); return s; })(),
  };
  const halfH = { cube: 0.25, ball: 0.26, egg: 0.3, chip: 0.03, nut: 0.1 };
  const items = [];
  function drop(o, slot) {
    const mesh = new THREE.Mesh(geos[o.shape], glossy(o.color, { roughness: 0.5 }));
    const ang = slot * 2.4, r = 0.35 + (slot % 3) * 0.33;
    mesh.position.set(Math.cos(ang) * r, 3.6, Math.sin(ang) * r);
    mesh.rotation.y = Math.random() * 3;
    g.add(mesh);
    items.push({ mesh, o, vy: 0, target: centerY(o) });
  }
  // центр тела: нижняя часть (доля f) погружена в нижнюю жидкость → центр = граница − hh + 2hh·f
  function centerY(o) {
    const hh = halfH[o.shape];
    const dens = [...LIQ.map((l) => l.rho), 0.0012];
    for (let i = 0; i < LIQ.length; i++) {
      const lo = dens[i], up = dens[i + 1];
      if (o.rho < lo && o.rho >= up) { const f = (o.rho - up) / (lo - up); return tops[i] + hh - 2 * hh * f; }
    }
    return BOT + hh;
  }
  v.onFrame((dt) => {
    for (const it of items) {
      const y = it.mesh.position.y;
      const li = Math.max(0, Math.min(LIQ.length - 1, Math.floor((y - BOT) / LH)));
      const inAir = y > tops[LIQ.length - 1] + 0.3;
      const k = inAir ? 9 : LIQ[li].visc;
      const dy = it.target - y;
      it.vy += (Math.sign(dy) * Math.min(Math.abs(dy) * 30, 25) - it.vy * k) * dt;
      it.mesh.position.y += it.vy * dt;
      if (Math.abs(dy) < 0.004 && Math.abs(it.vy) < 0.02) { it.mesh.position.y = it.target; it.vy = 0; }
      if (it.o.shape !== "nut" || Math.abs(dy) > 0.01) it.mesh.rotation.y += dt * 0.2;
    }
  });
  return {
    drop(o) { drop(o, items.length); },
    clear() { for (const it of items) g.remove(it.mesh); items.length = 0; },
  };
}

function scalesScene(v) {
  const g = new THREE.Group();
  v.scene.add(g);
  const metal = glossy(0xb8c2d8, { metalness: 0.6, roughness: 0.3 });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.4, 0.25, 48), metal); base.position.y = -2.4;
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 3.6, 24), metal); post.position.y = -0.6;
  g.add(base, post);
  const beam = new THREE.Group(); beam.position.y = 1.2; g.add(beam);
  beam.add(new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.14, 0.2), metal));
  const pointer = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.9, 12), glossy(0xff6b81)); pointer.position.y = 0.5; beam.add(pointer);
  const pans = [-2.6, 2.6].map(() => {
    const p = new THREE.Group();
    const dish = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.7, 0.12, 48), metal);
    p.add(dish);
    for (const a of [0, 2.09, 4.19]) p.add(bondMesh([Math.cos(a) * 0.8, 0.05, Math.sin(a) * 0.8], [0, 2.2, 0], 0.014, metal));
    g.add(p);
    return p;
  });
  const cubes = [0, 1].map((i) => { const c = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), glossy(0xffffff)); pans[i].add(c); return c; });
  let ang = 0, angT = 0;
  const sizes = [1, 1], sizesT = [1, 1];
  v.onFrame((dt) => {
    ang += (angT - ang) * Math.min(1, dt * 2.5);
    beam.rotation.z = ang;
    [-2.6, 2.6].forEach((x, i) => {
      pans[i].position.set(x * Math.cos(ang), 1.2 + x * Math.sin(ang) - 2.2, 0);
      sizes[i] += (sizesT[i] - sizes[i]) * Math.min(1, dt * 4);
      cubes[i].scale.setScalar(sizes[i]);
      cubes[i].position.y = 0.06 + sizes[i] / 2;
    });
  });
  return {
    set(a, b, sameMass) {
      // одинаковый объём (8 см³) или одинаковая масса (20 г)
      const V = sameMass ? [20 / a.rho, 20 / b.rho] : [8, 8];
      const m = [V[0] * a.rho, V[1] * b.rho];
      const edge = V.map((x) => Math.cbrt(x) / 2 * 0.95);
      const big = Math.max(...edge);
      [a, b].forEach((M, i) => { cubes[i].material.color.setHex(M.color); sizesT[i] = Math.min(1.6, edge[i] / Math.max(1, big / 1.6)); });
      angT = -Math.atan((m[1] - m[0]) / (m[0] + m[1]) * 2) * 0.28;
      return { m, V };
    },
  };
}

export async function render(el) {
  el.appendChild(h(`<div>
    <p class="lead">Почему огромный деревянный плот плавает, а маленький железный гвоздь тонет? Почему мешок пуха лёгкий, а такой же мешок песка не поднять? Ответ — в ${term("density", "плотности")}: сколько массы «упаковано» в каждый кусочек объёма.</p>
    ${kid("Набей рюкзак подушками — он большой, но лёгкий. Набей такой же рюкзак книгами — его еле поднимешь! Объём одинаковый, а масса разная. Вот это и есть разная плотность.")}
  </div>`));

  el.appendChild(h(`<section id="mass-volume"><h2>Масса и объём</h2>
    <div class="grid-2">
      <div class="card pad"><b>Масса</b> — сколько вещества в теле. Измеряют на весах в граммах (г) и килограммах (кг): 1 кг = 1000 г. Масса не меняется, если тело растянуть, сплющить или растопить.</div>
      <div class="card pad"><b>Объём</b> — сколько места занимает тело. Измеряют в кубических сантиметрах (см³) и литрах: 1 л = 1000 см³, а 1 мл = 1 см³. Объём жидкости меряют мензуркой.</div>
    </div>
    <p>Объём кубика легко посчитать: длина × ширина × высота. А как узнать объём камня неправильной формы? Опустить его в мензурку с водой: насколько поднимется уровень — таков и объём камня. Так, по легенде, Архимед проверил, не подмешал ли ювелир серебро в золотую корону царя: золото плотнее серебра, и корона той же массы, но с примесью, вытесняла бы больше воды.</p>
    ${kid("Опыт: налей в мерный стакан 200 мл воды и опусти туда яблоко, придавив его пальцем, чтобы оно утонуло целиком. Вода поднимется, скажем, до 350 мл — значит, объём яблока 150 см³.", "Попробуй сам")}
  </section>`));

  // ---------- весы ----------
  const s2 = h(`<section id="formula"><h2>Плотность: ρ = m / V</h2>
    <p>Плотность показывает, какая масса приходится на 1 см³ вещества. Её обозначают греческой буквой ρ («ро»):</p>
    <div class="eq">ρ = m / V &nbsp; → &nbsp; m = ρ · V &nbsp; → &nbsp; V = m / ρ</div>
    <p>Плотность — свойство <b>вещества</b>, а не предмета: и гвоздь, и рельс из железа имеют одинаковую плотность 7,87 г/см³. Положи на весы кубики из разных веществ:</p></section>`);
  el.appendChild(s2);
  const segBox = h(`<div class="row" style="margin-bottom:10px"><div class="seg"><button type="button" class="on" data-m="0">Одинаковый объём</button><button type="button" data-m="1">Одинаковая масса</button></div></div>`);
  s2.appendChild(segBox);
  const st2 = stage(`<div class="overlay"><span data-l></span><span data-r style="text-align:right"></span></div>`, { wide: true });
  s2.appendChild(st2);
  const cc = h(`<div class="card pad" style="margin-top:10px"><div class="small muted">Левая чаша:</div><div data-a></div><div class="small muted" style="margin-top:8px">Правая чаша:</div><div data-b></div><p data-msg style="margin:10px 0 0"></p></div>`);
  s2.appendChild(cc);
  const v2 = createViewer(st2, { camera: [0, 1, 11], autoRotate: false, fitWidth: 4.2 });
  const sc = scalesScene(v2);
  let A = MATERIALS[2], Bm = MATERIALS[5], same = false;
  const upd2 = () => {
    const { m, V } = sc.set(A, Bm, same);
    st2.querySelector("[data-l]").innerHTML = `<b>${A.name}</b><br>V = ${fmt(V[0], 1)} см³ · m = ${fmt(m[0], 1)} г`;
    st2.querySelector("[data-r]").innerHTML = `<b>${Bm.name}</b><br>V = ${fmt(V[1], 1)} см³ · m = ${fmt(m[1], 1)} г`;
    cc.querySelector("[data-msg]").innerHTML = same
      ? `Массы равны — весы в равновесии. Но кубик из вещества с меньшей плотностью <b>больше</b>: V = m / ρ.`
      : m[0] === m[1] ? "Вещества одинаковые — весы в равновесии." : `Объёмы равны, а ${m[0] > m[1] ? "левый" : "правый"} кубик тяжелее в ${fmt(Math.max(...m) / Math.min(...m), 1)} раза — ровно во столько, во сколько больше его плотность.`;
  };
  chips(cc.querySelector("[data-a]"), MATERIALS.map((m) => ({ ...m, label: m.name })), (m) => { A = m; upd2(); }, 2);
  chips(cc.querySelector("[data-b]"), MATERIALS.map((m) => ({ ...m, label: m.name })), (m) => { Bm = m; upd2(); }, 5);
  segBox.querySelectorAll("button").forEach((b) => (b.onclick = () => {
    segBox.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b));
    same = b.dataset.m === "1"; upd2();
  }));
  upd2();

  el.appendChild(h(`<section id="table"><h2>Плотность разных веществ</h2>
    <div class="table-wrap"><table class="data">
      <tr><th>Вещество</th><th>ρ, г/см³</th><th>В воде</th></tr>
      <tr><td>Воздух (20 °C)</td><td>0,0012</td><td>—</td></tr>
      <tr><td>Пробка</td><td>0,24</td><td>плавает</td></tr>
      <tr><td>Сосна (сухая)</td><td>0,5</td><td>плавает</td></tr>
      <tr><td>Спирт</td><td>0,79</td><td>смешивается</td></tr>
      <tr><td>Лёд</td><td>0,917</td><td>плавает (⁹⁄₁₀ под водой)</td></tr>
      <tr><td>Вода</td><td>1,00</td><td>—</td></tr>
      <tr><td>Морская вода</td><td>1,025</td><td>—</td></tr>
      <tr><td>Мёд</td><td>1,42</td><td>опускается на дно</td></tr>
      <tr><td>Алюминий</td><td>2,70</td><td>тонет</td></tr>
      <tr><td>Железо</td><td>7,87</td><td>тонет</td></tr>
      <tr><td>Ртуть</td><td>13,5</td><td>тонет</td></tr>
      <tr><td>Золото</td><td>19,3</td><td>тонет</td></tr>
    </table></div>
    <div class="callout"><b>Важно:</b> тело плавает в жидкости, если его средняя плотность меньше плотности жидкости, и тонет, если больше. Стальной корабль плавает, потому что внутри него много воздуха: средняя плотность «железо + воздух» меньше 1 г/см³. В ртути (13,5 г/см³) плавает даже железо!</div>
    <p class="adv">Почему так? Жидкость выталкивает погружённое тело вверх с силой, равной весу вытесненной жидкости (${term("archimedes_force", "закон Архимеда")}): F = ρ<sub>ж</sub>·g·V. Если ρ<sub>тела</sub> &lt; ρ<sub>ж</sub>, выталкивающая сила при полном погружении больше силы тяжести, и тело всплывает, пока не погрузится ровно на долю ρ<sub>тела</sub> / ρ<sub>ж</sub>. Поэтому лёд погружён в воду на 0,917 / 1,00 ≈ 92 %.</p>
  </section>`));

  // ---------- башня ----------
  const s4 = h(`<section id="tower"><h2>Башня из жидкостей</h2>
    <p>Если осторожно наливать жидкости по ложке, по стенке стакана, они лягут слоями: самая плотная внизу, самая лёгкая сверху. Масло к тому же не смешивается ни с водой, ни (почти) со спиртом и служит «перегородкой» между ними. Бросай в стакан предметы и смотри, где каждый остановится:</p></section>`);
  el.appendChild(s4);
  const st4 = stage(`<div class="overlay"><span data-o style="font-size:0.95rem"></span></div>`, { wide: true });
  s4.appendChild(st4);
  const c4 = h(`<div class="card pad" style="margin-top:10px"><div data-ch></div><div class="row" style="margin-top:10px"><button class="btn small" type="button" data-clear>Вынуть всё</button></div><p data-msg style="margin:10px 0 0"></p></div>`);
  s4.appendChild(c4);
  const v4 = createViewer(st4, { camera: [2.2, 1.6, 12], target: [0.9, 0.3, 0], autoRotate: false, fitWidth: 3.8 });
  const tw = towerScene(v4);
  const where = (o) => {
    if (o.rho > LIQ[0].rho) return "тонет до самого дна — он плотнее мёда.";
    for (let i = LIQ.length - 1; i >= 0; i--) if (o.rho < LIQ[i].rho) return i === LIQ.length - 1 ? "плавает на поверхности спирта." : `тонет в слое «${LIQ[i + 1].name}», но плавает на слое «${LIQ[i].name}».`;
    return "";
  };
  const row = h(`<div class="chips"></div>`);
  c4.querySelector("[data-ch]").appendChild(row);
  OBJ.forEach((o) => {
    const b = h(`<button class="chip" type="button">+ ${o.name}</button>`);
    b.onclick = () => {
      tw.drop(o);
      st4.querySelector("[data-o]").innerHTML = `<b>${o.name}</b>: m = ${fmt(o.m, 1)} г, V = ${fmt(o.V, 1)} см³ → ρ = ${fmt(o.m / o.V, 2)} г/см³`;
      c4.querySelector("[data-msg]").innerHTML = `${o.name} (ρ ≈ ${fmt(o.rho, 2)} г/см³) ${where(o)}`;
    };
    row.appendChild(b);
  });
  c4.querySelector("[data-clear]").onclick = () => { tw.clear(); c4.querySelector("[data-msg]").textContent = ""; };
  setTimeout(() => { if (row.isConnected) row.children[3].click(); }, 300);
  s4.appendChild(h(`<p class="small muted">Предмет на границе двух жидкостей погружается в нижнюю ровно настолько, чтобы его средняя плотность совпала с плотностью «смеси» вытесненных жидкостей. В модели это посчитано честно, а через мёд предметы опускаются медленно — он очень вязкий.</p>`));

  // ---------- калькулятор ----------
  const s5 = h(`<section id="calc"><h2>Калькулятор плотности</h2>
    <p>Взвесь предмет, найди его объём (линейкой или мензуркой) и узнай, из чего он может быть сделан.</p>
    <div class="card pad">
      <div class="row"><label class="ctl" style="flex:1;min-width:130px">Масса m, г<input type="number" min="0" step="any" value="54" data-m style="width:100%;box-sizing:border-box"></label><label class="ctl" style="flex:1;min-width:130px">Объём V, см³<input type="number" min="0" step="any" value="20" data-v style="width:100%;box-sizing:border-box"></label></div>
      <div class="eq" data-out style="margin-bottom:6px"></div>
      <p data-verdict style="margin:0"></p>
    </div></section>`);
  el.appendChild(s5);
  const calc = () => {
    const m = parseFloat(s5.querySelector("[data-m]").value), V = parseFloat(s5.querySelector("[data-v]").value);
    if (!(m > 0) || !(V > 0)) { s5.querySelector("[data-out]").textContent = "Введи массу и объём больше нуля"; s5.querySelector("[data-verdict]").textContent = ""; return; }
    const r = m / V;
    s5.querySelector("[data-out]").textContent = `ρ = ${fmt(m, 2)} г / ${fmt(V, 2)} см³ = ${fmt(r, 3)} г/см³ = ${fmt(r * 1000, 0)} кг/м³`;
    const near = MATERIALS.concat([{ name: "вода", rho: 1 }, { name: "мёд", rho: 1.42 }]).reduce((a, b) => (Math.abs(Math.log(b.rho / r)) < Math.abs(Math.log(a.rho / r)) ? b : a));
    s5.querySelector("[data-verdict]").innerHTML = `${r < 1 ? "🛟 В воде <b>плавает</b>" : r > 1 ? "⚓ В воде <b>тонет</b>" : "В воде «зависает»"}. Ближе всего по плотности: <b>${near.name}</b> (${fmt(near.rho, 2)} г/см³).`;
  };
  s5.querySelectorAll("input").forEach((i) => (i.oninput = calc));
  calc();

  el.appendChild(h(`<section id="task"><h2>Решаем задачи</h2>
    <div class="card pad"><b>Задача 1.</b> Брусок массой 135 г имеет размеры 5 × 3 × 3,3 см. Из чего он?
      <p style="margin:8px 0 0">V = 5 · 3 · 3,3 = 49,5 см³; ρ = 135 / 49,5 ≈ 2,73 г/см³ — это <b>алюминий</b>.</p></div>
    <div class="card pad" style="margin-top:12px"><b>Задача 2.</b> Сколько весит литр подсолнечного масла?
      <p style="margin:8px 0 0">V = 1 л = 1000 см³; m = ρ · V = 0,92 · 1000 = 920 г. Литровая бутылка масла легче литра воды на 80 г.</p></div>
    <div class="card pad adv" style="margin-top:12px"><b>Задача 3.</b> Какой объём займёт 1 кг золота?
      <p style="margin:8px 0 0">V = m / ρ = 1000 / 19,3 ≈ 52 см³ — кубик с ребром всего 3,7 см. Такой же по массе кубик пробки имел бы ребро около 16 см.</p></div>
    ${kid("Запомни формулу треугольником: наверху m, внизу ρ и V. Закрой пальцем то, что ищешь, — и увидишь, что делать с остальными: m = ρ·V, ρ = m : V, V = m : ρ.")}
  </section>`));
}

export const quiz = [
  { q: "Плотность — это…", options: ["масса тела", "масса единицы объёма вещества", "объём тела", "вес на Луне"], answer: 1, why: "ρ = m / V, например, в г/см³." },
  { q: "Кубики одного объёма из пробки и из железа. Какой тяжелее?", options: ["Пробковый", "Железный", "Одинаковые", "Зависит от цвета"], answer: 1, why: "У железа плотность 7,87 г/см³ — в 33 раза больше, чем у пробки." },
  { q: "Масса 50 г, объём 25 см³. Плотность равна…", options: ["0,5 г/см³", "2 г/см³", "75 г/см³", "1250 г/см³"], answer: 1, why: "ρ = 50 / 25 = 2 г/см³." },
  { q: "В башне из мёда, воды, масла и спирта сверху окажется…", options: ["мёд", "вода", "масло", "спирт"], answer: 3, why: "У спирта наименьшая плотность — 0,79 г/см³." },
  { q: "Почему стальной корабль не тонет?", options: ["Сталь легче воды", "Его средняя плотность (сталь + воздух внутри) меньше плотности воды", "Его держат волны", "Вода под ним твёрдая"], answer: 1, why: "Корпус вытесняет много воды, а внутри — воздух." },
  { q: "Лёд плавает в воде, потому что…", options: ["он холодный", "его плотность (0,917) меньше плотности воды", "в нём пузырьки", "он твёрдый"], answer: 1, why: "Тело плавает, если его плотность меньше плотности жидкости." },
];
