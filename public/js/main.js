// Entry point. Starts each feature on its own so one failure cannot take
// down the rest of the page.
import { initCompareAll } from "./compare.js";
import { initContact } from "./contact.js";
import { initGlobe } from "./hero.js";
import { runIntro } from "./intro.js";
import { qs, qsa } from "./lib/dom.js";
import { initActiveSection, initHeader, initMagnetic, initMenu } from "./nav.js";
import { initTerminalAll } from "./terminal.js";
import { initTilt } from "./work.js";

function start(name, fn) {
  try {
    return fn();
  } catch (error) {
    console.error(`[${name}] failed to start`, error);
    return undefined;
  }
}

function main() {
  const header = qs("[data-header]");
  start("intro", runIntro);
  start("globe", () => initGlobe(qs("[data-globe]")));
  const isMenuOpen = start("menu", () => initMenu(header)) ?? (() => false);
  start("header", () => initHeader(header, isMenuOpen));
  start("active-section", () => initActiveSection(qs(".primary-nav", header)));
  start("magnetic", () => initMagnetic(qsa(".site-header .button, [data-menu-toggle]")));
  start("compare", initCompareAll);
  start("terminal", initTerminalAll);
  start("tilt", initTilt);
  start("contact", initContact);
}

main();
