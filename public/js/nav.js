// Header behavior (scroll progress, hide on scroll down, active section) and
// the full-screen menu. Each init function owns one piece of the header.
import { animate, createTimeline, stagger, svg, utils } from "./vendor/anime.esm.min.js";
import { every, prefersReducedMotion, qs, qsa } from "./lib/dom.js";

const HIDE_AFTER_PX = 480;

/** Pure: scroll position -> header state. */
export function headerState(scrollY, lastY, maxScroll, menuOpen) {
  const goingDown = scrollY > lastY;
  return {
    progress: maxScroll > 0 ? Math.min(1, Math.max(0, scrollY / maxScroll)) : 0,
    scrolled: scrollY > 8,
    hidden: !menuOpen && goingDown && scrollY > HIDE_AFTER_PX,
  };
}

export function initHeader(header, isMenuOpen) {
  const progress = qs("[data-progress]", header);
  let lastY = window.scrollY;
  let queued = false;

  const update = () => {
    queued = false;
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    const state = headerState(window.scrollY, lastY, maxScroll, isMenuOpen());
    lastY = window.scrollY;
    progress.style.setProperty("--progress", state.progress.toFixed(4));
    header.classList.toggle("is-scrolled", state.scrolled);
    header.classList.toggle("is-hidden", state.hidden);
  };
  window.addEventListener("scroll", () => {
    if (queued) return;
    queued = true;
    window.requestAnimationFrame(update);
  }, { passive: true });
  header.addEventListener("focusin", () => header.classList.remove("is-hidden"));
  update();
}

function moveIndicator(indicator, link) {
  if (link === null) {
    indicator.style.setProperty("--indicator-opacity", "0");
    return;
  }
  indicator.style.setProperty("--indicator-x", `${link.offsetLeft}px`);
  indicator.style.setProperty("--indicator-width", `${link.offsetWidth}px`);
  indicator.style.setProperty("--indicator-opacity", "1");
}

/** Highlights the nav link for the section in the middle of the viewport. */
export function initActiveSection(nav) {
  const links = qsa("[data-nav-link]", nav);
  const indicator = qs("[data-nav-indicator]", nav);
  const byId = new Map(links.map((link) => [link.hash.slice(1), link]));
  let current = null;

  const setCurrent = (link) => {
    links.forEach((l) => l.removeAttribute("aria-current"));
    if (link !== null) link.setAttribute("aria-current", "true");
    current = link;
    moveIndicator(indicator, link);
  };

  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) setCurrent(byId.get(entry.target.id) ?? null);
      else if (current === byId.get(entry.target.id)) setCurrent(null);
    }
  }, { rootMargin: "-45% 0px -50% 0px" });
  qsa("main > section[id]").forEach((section) => observer.observe(section));

  links.forEach((link) => link.addEventListener("pointerenter", () => moveIndicator(indicator, link)));
  nav.addEventListener("pointerleave", () => moveIndicator(indicator, current));
}

function okcTime() {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date());
}

/** Returns tabbable elements inside the open menu, plus the toggle. */
function focusables(menu, toggle) {
  return [toggle, ...qsa("a[href], button:not([disabled])", menu)];
}

function trapFocus(event, menu, toggle) {
  if (event.key !== "Tab") return;
  const items = focusables(menu, toggle);
  const first = items[0];
  const last = items[items.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

/** Pure: center of an element as viewport percentages. */
export function originPercent(rect, width, height) {
  return {
    x: `${(((rect.left + rect.width / 2) / width) * 100).toFixed(2)}%`,
    y: `${(((rect.top + rect.height / 2) / height) * 100).toFixed(2)}%`,
  };
}

function openTimeline(parts) {
  const { backdrop, links, aside, shapes } = parts;
  return createTimeline({ defaults: { ease: "outExpo" } })
    .add(backdrop, { "--menu-radius": ["0%", "150%"], duration: 900, ease: "inOutQuart" }, 0)
    .add(shapes, { draw: ["0 0", "0 1"], duration: 1600, delay: stagger(90), ease: "inOutSine" }, 200)
    .add(links, { translateY: ["110%", "0%"], opacity: [0, 1], duration: 900, delay: stagger(60) }, 380)
    .add(aside, { opacity: [0, 1], translateY: [20, 0], duration: 800 }, 650);
}

function closeTimeline(parts) {
  const { backdrop, links, aside } = parts;
  return createTimeline({ defaults: { ease: "inQuart" } })
    .add(aside, { opacity: 0, duration: 250 }, 0)
    .add(links, { translateY: "-110%", opacity: 0, duration: 380, delay: stagger(30) }, 0)
    .add(backdrop, { "--menu-radius": "0%", duration: 650, ease: "inOutQuart" }, 220);
}

export function initMenu(header) {
  const menu = qs("[data-menu]");
  const toggle = qs("[data-menu-toggle]", header);
  const label = qs("[data-menu-label]", toggle);
  const clock = qs("[data-okc-clock]", menu);
  const outside = [qs("main"), qs(".site-footer")];
  const parts = {
    backdrop: qs("[data-menu-backdrop]", menu),
    links: qsa("[data-menu-link]", menu),
    aside: qs("[data-menu-aside]", menu),
    shapes: svg.createDrawable(qsa("[data-menu-globe] > *", menu)),
  };
  const reduce = prefersReducedMotion();
  const state = { open: false, busy: false, stopClock: () => {} };

  const onKeydown = (event) => {
    if (event.key === "Escape") close();
    else trapFocus(event, menu, toggle);
  };

  const setOpenAttributes = (open) => {
    state.open = open;
    toggle.setAttribute("aria-expanded", String(open));
    label.textContent = open ? "Close" : "Menu";
    header.classList.toggle("is-menu-open", open);
    document.body.classList.toggle("is-locked", open);
    outside.forEach((el) => el.toggleAttribute("inert", open));
  };

  async function open() {
    if (state.open || state.busy) return;
    state.busy = true;
    const origin = originPercent(toggle.getBoundingClientRect(), window.innerWidth, window.innerHeight);
    parts.backdrop.style.setProperty("--menu-x", origin.x);
    parts.backdrop.style.setProperty("--menu-y", origin.y);
    menu.hidden = false;
    setOpenAttributes(true);
    state.stopClock = every(15000, () => { clock.textContent = okcTime(); });
    document.addEventListener("keydown", onKeydown);
    parts.links[0].focus({ preventScroll: true });
    if (!reduce) await openTimeline(parts);
    state.busy = false;
  }

  async function close() {
    if (!state.open || state.busy) return;
    state.busy = true;
    document.removeEventListener("keydown", onKeydown);
    if (!reduce) await closeTimeline(parts);
    menu.hidden = true;
    utils.set(parts.backdrop, { "--menu-radius": "150%" });
    setOpenAttributes(false);
    state.stopClock();
    toggle.focus({ preventScroll: true });
    state.busy = false;
  }

  toggle.addEventListener("click", () => (state.open ? close() : open()));
  parts.links.forEach((link) => link.addEventListener("click", async (event) => {
    event.preventDefault();
    await close();
    const target = qs(link.hash);
    if (target === null) return;
    target.scrollIntoView({ behavior: reduce ? "auto" : "smooth" });
    history.replaceState(null, "", link.hash);
  }));

  return () => state.open;
}

/** Subtle magnetic pull on the header buttons, fine pointers only. */
export function initMagnetic(elements) {
  if (prefersReducedMotion() || !window.matchMedia("(pointer: fine)").matches) return;
  elements.forEach((el) => {
    el.addEventListener("pointermove", (event) => {
      const rect = el.getBoundingClientRect();
      const x = (event.clientX - rect.left - rect.width / 2) * 0.25;
      const y = (event.clientY - rect.top - rect.height / 2) * 0.35;
      animate(el, { translateX: x, translateY: y, duration: 400, ease: "outQuad" });
    });
    el.addEventListener("pointerleave", () => {
      animate(el, { translateX: 0, translateY: 0, duration: 700, ease: "outElastic(1, .5)" });
    });
  });
}
