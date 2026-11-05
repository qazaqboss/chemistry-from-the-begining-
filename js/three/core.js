// Общий 3D-просмотрщик: сцена, камера, свет, вращение мышью,
// пауза вне экрана, адаптация к размеру и теме.
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

export { THREE };

const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function createViewer(container, opts = {}) {
  const {
    camera: camPos = [0, 2, 10],
    target = [0, 0, 0],
    fov = 40,
    autoRotate = true,
    autoRotateSpeed = 0.8,
    zoom = true,
    minDistance = 2,
    maxDistance = 60,
    clipping = false,
  } = opts;

  const wrap = document.createElement("div");
  wrap.className = "viewer";
  container.appendChild(wrap);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.localClippingEnabled = clipping;
  wrap.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(fov, 1, 0.05, 500);
  camera.position.set(...camPos);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(...target);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enableZoom = zoom;
  controls.enablePan = false;
  controls.minDistance = minDistance;
  controls.maxDistance = maxDistance;
  controls.autoRotate = autoRotate && !reduced();
  controls.autoRotateSpeed = autoRotateSpeed;
  // На телефоне не мешаем прокрутке страницы одним пальцем
  controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_ROTATE };
  renderer.domElement.style.touchAction = "pan-y";
  controls.addEventListener("start", () => { controls.autoRotate = false; });

  // Свет: мягкий общий + ключевой + контровой
  scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x1a1f33, 1.1));
  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(5, 8, 6);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x88aaff, 1.0);
  rim.position.set(-6, -2, -5);
  scene.add(rim);

  const frameFns = new Set();
  let visible = true;
  let running = true;
  let raf = 0;
  const clock = new THREE.Clock();

  function resize() {
    const w = wrap.clientWidth || 300;
    const h = wrap.clientHeight || 300;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(wrap);
  resize();

  const io = new IntersectionObserver((entries) => {
    visible = entries[0].isIntersecting;
    if (visible) loop();
  });
  io.observe(wrap);

  let elapsed = 0;
  function loop() {
    cancelAnimationFrame(raf);
    if (!running || !visible) return;
    raf = requestAnimationFrame(loop);
    const dt = Math.min(clock.getDelta(), 0.05);
    const speed = reduced() ? 0 : 1;
    elapsed += dt * speed;
    for (const fn of frameFns) fn(dt * speed, elapsed);
    controls.update();
    renderer.render(scene, camera);
  }
  loop();

  const api = {
    THREE, scene, camera, renderer, controls, wrap,
    onFrame(fn) { frameFns.add(fn); return () => frameFns.delete(fn); },
    renderOnce() { controls.update(); renderer.render(scene, camera); },
    clear(group) {
      group.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) [].concat(o.material).forEach((m) => m.dispose());
      });
      group.clear();
    },
    dispose() {
      running = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      controls.dispose();
      scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) [].concat(o.material).forEach((m) => m.dispose());
      });
      renderer.dispose();
      renderer.forceContextLoss?.();
      wrap.remove();
    },
  };
  activeViewers.add(api);
  return api;
}

// Все живые просмотрщики — чтобы роутер мог их закрыть при смене страницы
export const activeViewers = new Set();
export function disposeAllViewers() {
  for (const v of activeViewers) v.dispose();
  activeViewers.clear();
}

// ---------- Общие материалы и примитивы ----------

const sphereGeoCache = new Map();
export function sphereGeo(r, seg = 32) {
  const key = r.toFixed(3) + ":" + seg;
  if (!sphereGeoCache.has(key)) sphereGeoCache.set(key, new THREE.SphereGeometry(r, seg, Math.round(seg * 0.75)));
  return sphereGeoCache.get(key).clone();
}

export function glossy(color, extra = {}) {
  return new THREE.MeshPhysicalMaterial({
    color, roughness: 0.32, metalness: 0.05, clearcoat: 0.6, clearcoatRoughness: 0.25, ...extra,
  });
}

export function glowSprite(color = 0x66ccff, size = 1, opacity = 0.9) {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d");
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.25, "rgba(255,255,255,0.6)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  const mat = new THREE.SpriteMaterial({ map: tex, color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending });
  const s = new THREE.Sprite(mat);
  s.scale.setScalar(size);
  return s;
}

// Текстовая метка-спрайт (для подписей в 3D)
export function textSprite(text, { color = "#ffffff", bg = "rgba(10,14,30,0.75)", size = 0.5, font = 600 } = {}) {
  const c = document.createElement("canvas");
  const g = c.getContext("2d");
  const fs = 48;
  g.font = `${font} ${fs}px Manrope, system-ui, sans-serif`;
  const w = Math.ceil(g.measureText(text).width) + 32;
  c.width = w; c.height = fs + 24;
  g.font = `${font} ${fs}px Manrope, system-ui, sans-serif`;
  if (bg) {
    g.fillStyle = bg;
    const r = 18;
    g.beginPath();
    g.roundRect(0, 0, c.width, c.height, r);
    g.fill();
  }
  g.fillStyle = color;
  g.textBaseline = "middle";
  g.fillText(text, 16, c.height / 2 + 2);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false });
  const s = new THREE.Sprite(mat);
  s.scale.set(size * c.width / c.height, size, 1);
  s.renderOrder = 10;
  return s;
}

// Цилиндр между двумя точками (связь)
export function bondMesh(a, b, radius, material) {
  const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b);
  const len = va.distanceTo(vb);
  const geo = new THREE.CylinderGeometry(radius, radius, len, 20, 1);
  const m = new THREE.Mesh(geo, material);
  m.position.copy(va).add(vb).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.clone().sub(va).normalize());
  return m;
}

export const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const clamp01 = (t) => Math.max(0, Math.min(1, t));
