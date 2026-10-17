// Pure geometry for the hero globe. No DOM, no state: numbers in, numbers out.

const DEG = Math.PI / 180;

export const OKC = { name: "Oklahoma City", lat: 35.4676, lon: -97.5164 };

// Cities where Cloudflare runs edge locations.
export const EDGE_CITIES = [
  { name: "Dallas", lat: 32.7767, lon: -96.797 },
  { name: "Denver", lat: 39.7392, lon: -104.9903 },
  { name: "Chicago", lat: 41.8781, lon: -87.6298 },
  { name: "Los Angeles", lat: 34.0522, lon: -118.2437 },
  { name: "Seattle", lat: 47.6062, lon: -122.3321 },
  { name: "New York", lat: 40.7128, lon: -74.006 },
  { name: "Miami", lat: 25.7617, lon: -80.1918 },
  { name: "Toronto", lat: 43.6532, lon: -79.3832 },
  { name: "Mexico City", lat: 19.4326, lon: -99.1332 },
  { name: "Bogotá", lat: 4.711, lon: -74.0721 },
  { name: "São Paulo", lat: -23.5505, lon: -46.6333 },
  { name: "Buenos Aires", lat: -34.6037, lon: -58.3816 },
  { name: "London", lat: 51.5074, lon: -0.1278 },
  { name: "Madrid", lat: 40.4168, lon: -3.7038 },
  { name: "Frankfurt", lat: 50.1109, lon: 8.6821 },
  { name: "Honolulu", lat: 21.3069, lon: -157.8583 },
  { name: "Anchorage", lat: 61.2181, lon: -149.9003 },
];

export function latLonToVec(lat, lon) {
  const phi = lat * DEG;
  const lambda = lon * DEG;
  return { x: Math.cos(phi) * Math.sin(lambda), y: Math.sin(phi), z: Math.cos(phi) * Math.cos(lambda) };
}

/** Evenly spaced points on a unit sphere (Fibonacci lattice). */
export function fibonacciSphere(count) {
  const golden = Math.PI * (3 - Math.sqrt(5));
  return Array.from({ length: count }, (_, i) => {
    const y = 1 - (i / (count - 1)) * 2;
    const radius = Math.sqrt(1 - y * y);
    const theta = golden * i;
    return { x: Math.cos(theta) * radius, y, z: Math.sin(theta) * radius };
  });
}

/** Rotate around Y by yaw, then around X by pitch (radians). */
export function rotate(v, yaw, pitch) {
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const x1 = v.x * cy + v.z * sy;
  const z1 = -v.x * sy + v.z * cy;
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  return { x: x1, y: v.y * cp - z1 * sp, z: v.y * sp + z1 * cp };
}

/** Orthographic projection to screen space. */
export function project(v, cx, cy, radius) {
  return { x: cx + v.x * radius, y: cy - v.y * radius, z: v.z };
}

/** True when a rotated point is not hidden behind the sphere. */
export function isVisible(v) {
  return v.z > 0 || v.x * v.x + v.y * v.y > 1;
}

function dot(a, b) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

/** Spherical interpolation between unit vectors. */
export function slerp(a, b, t) {
  const omega = Math.acos(Math.min(1, Math.max(-1, dot(a, b))));
  if (omega < 1e-6) return a;
  const s = Math.sin(omega);
  const ka = Math.sin((1 - t) * omega) / s;
  const kb = Math.sin(t * omega) / s;
  return { x: a.x * ka + b.x * kb, y: a.y * ka + b.y * kb, z: a.z * ka + b.z * kb };
}

/** Points along a great-circle arc, lifted off the surface toward the middle. */
export function arcPoints(a, b, segments) {
  const omega = Math.acos(Math.min(1, Math.max(-1, dot(a, b))));
  const lift = 0.04 + omega * 0.12;
  return Array.from({ length: segments + 1 }, (_, i) => {
    const t = i / segments;
    const p = slerp(a, b, t);
    const h = 1 + lift * Math.sin(Math.PI * t);
    return { x: p.x * h, y: p.y * h, z: p.z * h };
  });
}

/** Where to draw the globe for a given viewport size. */
export function globeLayout(width, height) {
  if (width < 820) {
    return { cx: width * 0.5, cy: height * 0.3, radius: Math.min(width * 0.62, height * 0.36) };
  }
  return { cx: width * 0.7, cy: height * 0.54, radius: Math.min(height * 0.44, width * 0.33) };
}

/** Camera angles that keep Oklahoma City near the front, with a slow sway. */
export function cameraAngles(timeMs, pointerX, pointerY) {
  const sway = Math.sin(timeMs * 0.00011) * 0.55;
  return {
    yaw: -OKC.lon * DEG + sway + pointerX * 0.3,
    pitch: OKC.lat * DEG * 0.7 + pointerY * 0.12,
  };
}

/** Packet progress 0..1 for arc i at time t, or -1 while the arc is resting. */
export function packetProgress(timeMs, index, travelMs, restMs) {
  const cycle = travelMs + restMs;
  const local = (timeMs + index * 977) % cycle;
  return local < travelMs ? local / travelMs : -1;
}
