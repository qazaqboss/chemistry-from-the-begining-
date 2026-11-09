// Облако точек |ψ|² для атома водорода и 2D «ящик» в 3D.
// Точки разыгрываются честно: r — из радиального распределения r²R²ₙₗ (обратная функция
// распределения на сетке), направление — выборкой с отклонением по |Y|².
import { THREE } from "./core.js";

// Обобщённый многочлен Лагерра L_k^α(x) по рекуррентной формуле
export function laguerre(k, a, x) {
  if (k === 0) return 1;
  let L0 = 1, L1 = 1 + a - x;
  for (let i = 1; i < k; i++) {
    const L2 = ((2 * i + 1 + a - x) * L1 - (i + a) * L0) / (i + 1);
    L0 = L1; L1 = L2;
  }
  return L1;
}
// Радиальная функция (без нормировки), r в боровских радиусах a₀
export const radial = (n, l, r) => {
  const rho = (2 * r) / n;
  return Math.pow(rho, l) * Math.exp(-rho / 2) * laguerre(n - l - 1, 2 * l + 1, rho);
};

// Действительные угловые функции (x, y, z — единичный вектор, «химические» оси)
const ANG = {
  "0,0": [() => 1, "s"],
  "1,0": [(x, y, z) => z, "p_z"],
  "1,1": [(x) => x, "p_x"],
  "1,-1": [(x, y) => y, "p_y"],
  "2,0": [(x, y, z) => 3 * z * z - 1, "d_z²"],
  "2,1": [(x, y, z) => x * z, "d_xz"],
  "2,-1": [(x, y, z) => y * z, "d_yz"],
  "2,2": [(x, y) => x * x - y * y, "d_x²−y²"],
  "2,-2": [(x, y) => x * y, "d_xy"],
  "3,0": [(x, y, z) => z * (5 * z * z - 3), "f_z³"],
  "3,1": [(x, y, z) => x * (5 * z * z - 1), "f_xz²"],
  "3,-1": [(x, y, z) => y * (5 * z * z - 1), "f_yz²"],
  "3,2": [(x, y, z) => z * (x * x - y * y), "f_z(x²−y²)"],
  "3,-2": [(x, y, z) => x * y * z, "f_xyz"],
  "3,3": [(x, y) => x * (x * x - 3 * y * y), "f_x(x²−3y²)"],
  "3,-3": [(x, y) => y * (3 * x * x - y * y), "f_y(3x²−y²)"],
};
export const angName = (l, m) => ANG[`${l},${m}`][1];

const POS = new THREE.Color(0x3a9cff), NEG = new THREE.Color(0xff7a45);

export function sampleOrbital(n, l, m, count = 16000, rand = Math.random) {
  const Y = ANG[`${l},${m}`][0];
  const rMax = 2.2 * n * n + 4 * n;
  const N = 1500;
  const cdf = new Float64Array(N + 1);
  for (let i = 1; i <= N; i++) {
    const r = (i / N) * rMax, R = radial(n, l, r);
    cdf[i] = cdf[i - 1] + r * r * R * R;
  }
  for (let i = 0; i <= N; i++) cdf[i] /= cdf[N];
  let yMax = 0;
  for (let i = 0; i < 4000; i++) {
    const v = randDir(rand); yMax = Math.max(yMax, Y(...v) ** 2);
  }
  yMax *= 1.05;
  const pos = new Float32Array(count * 3), col = new Float32Array(count * 3);
  for (let k = 0; k < count; k++) {
    // r из распределения
    const u = rand();
    let lo = 0, hi = N;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (cdf[mid] < u) lo = mid; else hi = mid; }
    const r = ((lo + (u - cdf[lo]) / (cdf[hi] - cdf[lo] || 1)) / N) * rMax;
    let v, y;
    do { v = randDir(rand); y = Y(...v); } while (rand() * yMax > y * y);
    const sign = Math.sign(y * radial(n, l, r)) || 1;
    // химические (x, y, z) → three.js (x, z, −y): ось z смотрит вверх
    pos[3 * k] = v[0] * r; pos[3 * k + 1] = v[2] * r; pos[3 * k + 2] = -v[1] * r;
    const c = sign > 0 ? POS : NEG;
    col[3 * k] = c.r; col[3 * k + 1] = c.g; col[3 * k + 2] = c.b;
  }
  return { pos, col, rMax };
}
function randDir(rand) {
  const z = 2 * rand() - 1, ph = 2 * Math.PI * rand(), s = Math.sqrt(1 - z * z);
  return [s * Math.cos(ph), s * Math.sin(ph), z];
}

// Точечное облако как объект сцены
export function createCloud(viewer) {
  const geo = new THREE.BufferGeometry();
  const c = document.createElement("canvas");
  c.width = c.height = 32;
  const g = c.getContext("2d");
  const grad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad; g.fillRect(0, 0, 32, 32);
  const mat = new THREE.PointsMaterial({
    size: 0.5, map: new THREE.CanvasTexture(c), vertexColors: true, transparent: true, opacity: 0.7,
    depthWrite: false, sizeAttenuation: true,
  });
  const pts = new THREE.Points(geo, mat);
  viewer.scene.add(pts);
  const nucleus = new THREE.Mesh(new THREE.SphereGeometry(0.25, 16, 12), new THREE.MeshBasicMaterial({ color: 0xff4d6d }));
  viewer.scene.add(nucleus);
  const axes = new THREE.Group();
  viewer.scene.add(axes);
  return {
    pts,
    set(n, l, m, count) {
      const s = sampleOrbital(n, l, m, count);
      geo.setAttribute("position", new THREE.BufferAttribute(s.pos, 3));
      geo.setAttribute("color", new THREE.BufferAttribute(s.col, 3));
      geo.computeBoundingSphere();
      mat.size = 0.18 + 0.12 * n;
      viewer.clear(axes);
      const L = Math.min(s.rMax, 2.2 * n * n + 2) * 0.8;
      const am = new THREE.LineBasicMaterial({ color: 0x8792b0, transparent: true, opacity: 0.35 });
      for (const d of [[1, 0, 0], [0, 1, 0], [0, 0, 1]]) {
        axes.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...d).multiplyScalar(-L), new THREE.Vector3(...d).multiplyScalar(L)]), am));
      }
      return s;
    },
  };
}

// Поверхность ψ(x, y) частицы в квадратном ящике, колеблющаяся во времени
export function createBox2D(viewer) {
  const S = 60, size = 6;
  const geo = new THREE.PlaneGeometry(size, size, S, S);
  geo.rotateX(-Math.PI / 2);
  const colors = new Float32Array(geo.attributes.position.count * 3);
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.45, metalness: 0.05 });
  const mesh = new THREE.Mesh(geo, mat);
  viewer.scene.add(mesh);
  const frameGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(size, 0.02, size));
  viewer.scene.add(new THREE.LineSegments(frameGeo, new THREE.LineBasicMaterial({ color: 0x9fb0d8 })));
  const wire = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.06 }));
  viewer.scene.add(wire);
  let nx = 1, ny = 2, prob = false, phase = 0;
  const p = geo.attributes.position;
  function update() {
    const amp = 1.6;
    const ct = prob ? 1 : Math.cos(phase);
    for (let i = 0; i < p.count; i++) {
      const x = (p.getX(i) / size + 0.5), z = (p.getZ(i) / size + 0.5);
      const psi = Math.sin(nx * Math.PI * x) * Math.sin(ny * Math.PI * z);
      const val = prob ? psi * psi : psi * ct;
      p.setY(i, amp * val);
      const c = psi >= 0 ? POS : NEG;
      const k = prob ? 0.35 + 0.65 * psi * psi : 0.35 + 0.65 * Math.abs(psi);
      colors[3 * i] = c.r * k; colors[3 * i + 1] = c.g * k; colors[3 * i + 2] = c.b * k;
    }
    p.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
    geo.computeVertexNormals();
  }
  update();
  viewer.onFrame((dt) => {
    if (prob || dt === 0) return;
    // частота пропорциональна энергии: ω ∝ nₓ² + nᵧ²
    phase += dt * 0.6 * (nx * nx + ny * ny) / 5;
    update();
  });
  return { set(a, b, pr) { nx = a; ny = b; prob = pr; update(); } };
}
