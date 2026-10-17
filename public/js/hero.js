// Hero globe: a dotted Earth with requests leaving Oklahoma City for
// Cloudflare edge cities. Geometry lives in lib/globe.js; this module only
// draws and schedules frames.
import {
  arcPoints,
  cameraAngles,
  EDGE_CITIES,
  fibonacciSphere,
  globeLayout,
  isVisible,
  latLonToVec,
  OKC,
  packetProgress,
  project,
  rotate,
} from "./lib/globe.js";
import { prefersReducedMotion } from "./lib/dom.js";

const DOT_COUNT = 1100;
const ARC_SEGMENTS = 48;
const TRAIL = 10;
const TRAVEL_MS = 2200;
const REST_MS = 3200;
const MAX_DPR = 2;

const COLORS = {
  dot: "148, 163, 194",
  arc: "243, 128, 32",
  packet: "251, 173, 65",
  city: "79, 139, 255",
  okc: "243, 128, 32",
  label: "232, 236, 244",
};

export function createScene() {
  const okc = latLonToVec(OKC.lat, OKC.lon);
  const cities = EDGE_CITIES.map((city) => latLonToVec(city.lat, city.lon));
  return {
    dots: fibonacciSphere(DOT_COUNT),
    okc,
    cities,
    arcs: cities.map((city) => arcPoints(okc, city, ARC_SEGMENTS)),
  };
}

function transform(points, angles, layout) {
  return points.map((p) => {
    const r = rotate(p, angles.yaw, angles.pitch);
    return { ...project(r, layout.cx, layout.cy, layout.radius), visible: isVisible(r) };
  });
}

function drawAtmosphere(ctx, layout) {
  const { cx, cy, radius } = layout;
  const glow = ctx.createRadialGradient(cx, cy, radius * 0.85, cx, cy, radius * 1.25);
  glow.addColorStop(0, "rgba(79, 139, 255, 0.10)");
  glow.addColorStop(1, "rgba(79, 139, 255, 0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(cx, cy, radius * 1.25, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(148, 163, 194, 0.18)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.stroke();
}

function drawDots(ctx, dots, angles, layout, dpr) {
  const size = 1.8 * dpr;
  for (const dot of dots) {
    const r = rotate(dot, angles.yaw, angles.pitch);
    if (r.z <= 0) continue;
    const p = project(r, layout.cx, layout.cy, layout.radius);
    ctx.fillStyle = `rgba(${COLORS.dot}, ${(0.12 + r.z * 0.6).toFixed(3)})`;
    ctx.fillRect(p.x - size / 2, p.y - size / 2, size, size);
  }
}

function drawArc(ctx, points, dpr) {
  ctx.strokeStyle = `rgba(${COLORS.arc}, 0.22)`;
  ctx.lineWidth = dpr;
  ctx.beginPath();
  let drawing = false;
  for (const p of points) {
    if (!p.visible) {
      drawing = false;
      continue;
    }
    if (drawing) ctx.lineTo(p.x, p.y);
    else ctx.moveTo(p.x, p.y);
    drawing = true;
  }
  ctx.stroke();
}

function drawPacket(ctx, points, progress, dpr) {
  const head = Math.round(progress * ARC_SEGMENTS);
  for (let i = Math.max(1, head - TRAIL); i <= head; i++) {
    const a = points[i - 1];
    const b = points[i];
    if (!a.visible || !b.visible) continue;
    const strength = 1 - (head - i) / TRAIL;
    ctx.strokeStyle = `rgba(${COLORS.packet}, ${(strength * 0.95).toFixed(3)})`;
    ctx.lineWidth = (0.8 + strength * 1.6) * dpr;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  const tip = points[head];
  if (!tip.visible) return;
  ctx.fillStyle = `rgba(${COLORS.packet}, 1)`;
  ctx.shadowColor = `rgba(${COLORS.packet}, 0.9)`;
  ctx.shadowBlur = 12 * dpr;
  ctx.beginPath();
  ctx.arc(tip.x, tip.y, 2.2 * dpr, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
}

function drawCity(ctx, point, arriving, dpr) {
  if (!point.visible || point.z <= 0) return;
  ctx.fillStyle = `rgba(${COLORS.city}, ${arriving ? 1 : 0.75})`;
  ctx.beginPath();
  ctx.arc(point.x, point.y, (arriving ? 3.2 : 2.2) * dpr, 0, Math.PI * 2);
  ctx.fill();
}

function drawOkc(ctx, point, timeMs, dpr) {
  if (point.z <= 0) return;
  const phase = (timeMs % 2000) / 2000;
  ctx.strokeStyle = `rgba(${COLORS.okc}, ${(1 - phase) * 0.8})`;
  ctx.lineWidth = 1.5 * dpr;
  ctx.beginPath();
  ctx.arc(point.x, point.y, (5 + phase * 18) * dpr, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = `rgba(${COLORS.okc}, 1)`;
  ctx.shadowColor = `rgba(${COLORS.okc}, 0.9)`;
  ctx.shadowBlur = 16 * dpr;
  ctx.beginPath();
  ctx.arc(point.x, point.y, 4.5 * dpr, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = `rgba(${COLORS.label}, 0.95)`;
  ctx.font = `600 ${12 * dpr}px Inter, system-ui, sans-serif`;
  ctx.fillText("Oklahoma City", point.x + 12 * dpr, point.y - 10 * dpr);
}

/** Draws one frame. Reads its inputs; touches nothing but the canvas. */
export function drawFrame(ctx, scene, frame) {
  const { width, height, dpr, timeMs, pointer } = frame;
  const layout = globeLayout(width, height);
  const angles = cameraAngles(timeMs, pointer.x, pointer.y);
  ctx.clearRect(0, 0, width, height);
  drawAtmosphere(ctx, layout);
  drawDots(ctx, scene.dots, angles, layout, dpr);

  const cities = transform(scene.cities, angles, layout);
  scene.arcs.forEach((arc, i) => {
    const points = transform(arc, angles, layout);
    drawArc(ctx, points, dpr);
    const progress = packetProgress(timeMs, i, TRAVEL_MS, REST_MS);
    if (progress >= 0) drawPacket(ctx, points, progress, dpr);
    drawCity(ctx, cities[i], progress > 0.9, dpr);
  });
  drawOkc(ctx, transform([scene.okc], angles, layout)[0], timeMs, dpr);
}

function sizeCanvas(canvas) {
  const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
  const width = Math.round(canvas.clientWidth * dpr);
  const height = Math.round(canvas.clientHeight * dpr);
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
  return { width, height, dpr };
}

/** Starts the globe. Pauses when the hero is off screen. */
export function initGlobe(canvas) {
  const ctx = canvas.getContext("2d");
  if (ctx === null) return;
  const scene = createScene();
  const reduce = prefersReducedMotion();
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  let size = sizeCanvas(canvas);
  let running = false;
  let frameId = 0;

  const render = (timeMs) => {
    pointer.x += (pointer.tx - pointer.x) * 0.05;
    pointer.y += (pointer.ty - pointer.y) * 0.05;
    drawFrame(ctx, scene, { ...size, timeMs, pointer });
  };
  const loop = (timeMs) => {
    render(timeMs);
    if (running) frameId = window.requestAnimationFrame(loop);
  };
  const start = () => {
    if (running || reduce) return;
    running = true;
    frameId = window.requestAnimationFrame(loop);
  };
  const stop = () => {
    running = false;
    window.cancelAnimationFrame(frameId);
  };

  new ResizeObserver(() => {
    size = sizeCanvas(canvas);
    if (!running) render(1400);
  }).observe(canvas);

  new IntersectionObserver(([entry]) => (entry.isIntersecting ? start() : stop())).observe(canvas);

  if (window.matchMedia("(pointer: fine)").matches) {
    window.addEventListener("pointermove", (event) => {
      pointer.tx = event.clientX / window.innerWidth - 0.5;
      pointer.ty = event.clientY / window.innerHeight - 0.5;
    }, { passive: true });
  }

  render(1400);
}
