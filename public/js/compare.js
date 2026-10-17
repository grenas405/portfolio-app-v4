// "Typical agency" vs "One person" switch in the paradigm section.
import { createTimeline, stagger } from "./vendor/anime.esm.min.js";
import { prefersReducedMotion, qs, qsa } from "./lib/dom.js";

/** Pure: the text each row shows for a mode. */
export function valuesFor(cells, mode) {
  return cells.map((cell) => cell.dataset[mode] ?? "");
}

function swapText(cells, values) {
  cells.forEach((cell, i) => { cell.textContent = values[i]; });
}

export function initCompare(root) {
  const options = qsa("[data-compare-option]", root);
  const cells = qsa("dd[data-agency]", root);
  const reduce = prefersReducedMotion();
  root.dataset.mode = "pedro";
  let busy = false;

  const select = async (mode) => {
    if (busy || root.dataset.mode === mode) return;
    busy = true;
    options.forEach((o) => o.setAttribute("aria-pressed", String(o.dataset.compareOption === mode)));
    const values = valuesFor(cells, mode);
    if (reduce) {
      swapText(cells, values);
      root.dataset.mode = mode;
      busy = false;
      return;
    }
    await createTimeline()
      .add(cells, { opacity: 0, translateY: -10, filter: "blur(4px)", duration: 220, delay: stagger(30), ease: "inQuad" })
      .call(() => { swapText(cells, values); root.dataset.mode = mode; })
      .add(cells, { opacity: [0, 1], translateY: [12, 0], filter: ["blur(4px)", "blur(0px)"], duration: 600, delay: stagger(45), ease: "outExpo" });
    busy = false;
  };

  options.forEach((option) => option.addEventListener("click", () => select(option.dataset.compareOption)));
}

export function initCompareAll() {
  const root = qs("[data-compare]");
  if (root !== null) initCompare(root);
}
