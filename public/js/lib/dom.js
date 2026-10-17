// Small DOM helpers. Query helpers are pure reads; splitChars is the only
// function here that mutates, and only the element it is given.

export function qs(selector, root = document) {
  return root.querySelector(selector);
}

export function qsa(selector, root = document) {
  return Array.from(root.querySelectorAll(selector));
}

export function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function makeSpan(className, text) {
  const span = document.createElement("span");
  span.className = className;
  if (text !== undefined) span.textContent = text;
  return span;
}

/**
 * Wraps each character of an element's text in span.char (grouped in
 * span.word so lines only break between words). Screen readers get the
 * original text from a visually hidden copy. Uses textContent only.
 * Returns the char spans.
 */
export function splitChars(element) {
  const text = element.textContent.trim();
  const visual = makeSpan("split");
  visual.setAttribute("aria-hidden", "true");
  const chars = [];
  text.split(/\s+/).forEach((word, index) => {
    if (index > 0) visual.append(" ");
    const wordSpan = makeSpan("word");
    for (const ch of word) {
      const charSpan = makeSpan("char", ch);
      chars.push(charSpan);
      wordSpan.append(charSpan);
    }
    visual.append(wordSpan);
  });
  element.replaceChildren(makeSpan("visually-hidden", text), visual);
  return chars;
}

/** Runs fn every interval ms. Returns a stop function. */
export function every(ms, fn) {
  fn();
  const id = window.setInterval(fn, ms);
  return () => window.clearInterval(id);
}
