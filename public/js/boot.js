// Runs synchronously in <head> before first paint. Sets the classes that
// decide whether the intro curtain and hero reveal play. Nothing else.
(function boot(root) {
  root.classList.remove("no-js");
  root.classList.add("js");
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce) return;
  root.classList.add("motion-pending");
  try {
    if (window.sessionStorage.getItem("pmd:intro-seen") === null) root.classList.add("has-intro");
  } catch (error) {
    // Storage blocked: skip the intro rather than replaying it on every page view.
  }
})(document.documentElement);
