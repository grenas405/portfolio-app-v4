// The page's one orchestrated moment: the intro curtain (first visit per
// session) followed by the hero reveal.
import { createTimeline, stagger, utils } from "./vendor/anime.esm.min.js";
import { prefersReducedMotion, qs, qsa, splitChars } from "./lib/dom.js";

const OPEN_AT = 1150;
const SEEN_KEY = "pmd:intro-seen";

function markIntroSeen() {
  try {
    window.sessionStorage.setItem(SEEN_KEY, "1");
  } catch {
    // Storage blocked: the intro may replay next visit, which is harmless.
  }
}

function addCurtain(timeline, intro) {
  const line = qs("[data-intro-line]", intro);
  const beam = qs("[data-intro-beam]", intro);
  const panels = qsa(".intro__panel", intro);
  timeline
    .add(line, { opacity: [0, 1], translateY: [24, 0], duration: 700 }, 0)
    .add(beam, { scaleX: [0, 1], duration: 700, ease: "inOutExpo" }, 450)
    .add(line, { opacity: 0, translateY: -12, duration: 300, ease: "inQuad" }, 1000)
    .add(panels[0], { translateY: "-100%", duration: 1000, ease: "inOutQuart" }, OPEN_AT)
    .add(panels[1], { translateY: "100%", duration: 1000, ease: "inOutQuart" }, OPEN_AT)
    .add(beam, { opacity: 0, duration: 500, ease: "outQuad" }, OPEN_AT)
    .call(() => document.documentElement.classList.remove("has-intro"), OPEN_AT + 1000);
}

function bindSkip(timeline, intro) {
  const skip = () => {
    if (timeline.currentTime < OPEN_AT) timeline.seek(OPEN_AT);
  };
  intro.addEventListener("pointerdown", skip, { once: true });
  window.addEventListener("keydown", skip, { once: true });
}

export function runIntro() {
  const root = document.documentElement;
  const chars = qsa("[data-split]").flatMap(splitChars);
  const items = qsa("[data-hero-item]");
  const globe = qs("[data-globe]");
  const intro = qs("[data-intro]");
  const hasIntro = root.classList.contains("has-intro");

  if (prefersReducedMotion()) {
    root.classList.remove("motion-pending", "has-intro");
    return;
  }

  utils.set(chars, { opacity: 0, translateY: "0.5em" });
  utils.set(items, { opacity: 0, translateY: 16 });
  utils.set(globe, { opacity: 0 });
  root.classList.remove("motion-pending");

  const start = hasIntro ? OPEN_AT : 0;
  const timeline = createTimeline({ defaults: { ease: "outExpo" } });
  if (hasIntro) {
    addCurtain(timeline, intro);
    bindSkip(timeline, intro);
    markIntroSeen();
  }
  timeline
    .add(globe, { opacity: [0, 1], duration: 1800, ease: "outQuad" }, start + 100)
    .add(chars, { opacity: [0, 1], translateY: ["0.5em", "0em"], duration: 1000, delay: stagger(24) }, start + 200)
    .add(items, { opacity: [0, 1], translateY: [16, 0], duration: 900, delay: stagger(110) }, start + 750);
}
