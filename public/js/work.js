// Pointer tilt for the client phone screenshots. Fine pointers only.
import { prefersReducedMotion, qsa } from "./lib/dom.js";

const MAX_TILT_DEG = 8;

/** Pure: pointer position inside a rect -> tilt angles in degrees. */
export function tiltFor(rect, clientX, clientY, max = MAX_TILT_DEG) {
  const px = (clientX - rect.left) / rect.width - 0.5;
  const py = (clientY - rect.top) / rect.height - 0.5;
  return { x: (-py * max * 2).toFixed(2), y: (px * max * 2).toFixed(2) };
}

function applyTilt(el, tilt, glare) {
  el.style.setProperty("--tilt-x", `${tilt.x}deg`);
  el.style.setProperty("--tilt-y", `${tilt.y}deg`);
  el.style.setProperty("--glare", String(glare));
}

export function initTilt() {
  if (prefersReducedMotion() || !window.matchMedia("(pointer: fine)").matches) return;
  qsa("[data-tilt]").forEach((el) => {
    el.addEventListener("pointerenter", () => el.classList.add("is-tilting"));
    el.addEventListener("pointermove", (event) => {
      applyTilt(el, tiltFor(el.getBoundingClientRect(), event.clientX, event.clientY), 1);
    });
    el.addEventListener("pointerleave", () => {
      el.classList.remove("is-tilting");
      applyTilt(el, { x: 0, y: 0 }, 0);
    });
  });
}
