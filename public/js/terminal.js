// Terminal replay in the "How it works" section. Content is read from the
// static markup, so the terminal reads correctly without JavaScript.
import { animate } from "./vendor/anime.esm.min.js";
import { prefersReducedMotion, qs } from "./lib/dom.js";

const TYPE_MS_PER_CHAR = 26;
const LINE_PAUSE_MS = 280;

/** Pure-ish read: splits the code element into lines of {className, text}. */
export function readLines(code) {
  const lines = [[]];
  for (const node of code.childNodes) {
    const className = node.nodeType === Node.ELEMENT_NODE ? node.className : "";
    node.textContent.split("\n").forEach((part, i) => {
      if (i > 0) lines.push([]);
      if (part !== "") lines[lines.length - 1].push({ className, text: part });
    });
  }
  return lines;
}

function segmentNode(segment) {
  if (segment.className === "") return document.createTextNode(segment.text);
  const span = document.createElement("span");
  span.className = segment.className;
  span.textContent = segment.text;
  return span;
}

function isTyped(line) {
  const first = line[0];
  return first !== undefined && (first.className === "t-prompt" || first.text.startsWith(">"));
}

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function typeText(node, text) {
  const counter = { n: 0 };
  await animate(counter, {
    n: text.length,
    duration: text.length * TYPE_MS_PER_CHAR,
    ease: "linear",
    modifier: Math.round,
    onUpdate: () => { node.textContent = text.slice(0, counter.n); },
  });
}

async function playLine(code, cursor, line) {
  if (!isTyped(line)) {
    await wait(LINE_PAUSE_MS);
    code.insertBefore(lineFragment(line), cursor);
    return;
  }
  const [prompt, ...rest] = line;
  code.insertBefore(segmentNode(prompt), cursor);
  const typed = document.createTextNode("");
  code.insertBefore(typed, cursor);
  await wait(LINE_PAUSE_MS);
  await typeText(typed, rest.map((s) => s.text).join(""));
}

function lineFragment(line) {
  const fragment = document.createDocumentFragment();
  line.forEach((segment) => fragment.append(segmentNode(segment)));
  return fragment;
}

export function initTerminal(root) {
  const code = qs("code", root);
  const button = qs("[data-terminal-replay]", root);
  const lines = readLines(code);
  const reduce = prefersReducedMotion();

  button.addEventListener("click", async () => {
    button.disabled = true;
    const cursor = document.createElement("span");
    cursor.className = "t-cursor";
    code.replaceChildren(cursor);
    for (const [i, line] of lines.entries()) {
      if (i > 0) code.insertBefore(document.createTextNode("\n"), cursor);
      if (reduce) code.insertBefore(lineFragment(line), cursor);
      else await playLine(code, cursor, line);
    }
    button.disabled = false;
  });
}

export function initTerminalAll() {
  const root = qs("[data-terminal]");
  if (root !== null) initTerminal(root);
}
