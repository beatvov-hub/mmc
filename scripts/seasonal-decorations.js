(function () {
  "use strict";

  // Midnight in Japan, from October 31 through November 30, 2026.
  const events = {
    autumn2026: {
      start: Date.UTC(2026, 9, 30, 15),
      end: Date.UTC(2026, 10, 30, 15),
      stylesheet: "../styles/seasonal-decorations.css?v=autumn2026"
    }
  };

  function isActive(event, now) { return now >= event.start && now < event.end; }
  function previewMode(location) {
    if (!/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname)) return null;
    const mode = new URLSearchParams(location.search).get("mmcSeason");
    return ["off", "autumn", "reduced"].includes(mode) ? mode : null;
  }
  if (typeof module !== "undefined" && module.exports) module.exports = { events, isActive, previewMode };
  if (typeof document === "undefined") return;

  const script = document.currentScript;
  const event = events.autumn2026;
  const preview = previewMode(window.location);
  const header = document.querySelector(".site-header");
  if (!script || !header || window.__mmcSeasonalInitialized) return;
  window.__mmcSeasonalInitialized = true;
  let root = null, stylesheet = null, endTimer = null, resizeFrame = null;

  function leaf(className) {
    return `<svg class="mmc-seasonal__leaf ${className}" viewBox="0 0 100 110" aria-hidden="true"><path d="M50 91 39 78 23 79 28 65 10 54 26 48 21 30 39 36 50 9 61 36 79 30 74 48 90 54 72 65 77 79 61 78Z" fill="currentColor" stroke="#9e5430" stroke-width="2" stroke-linejoin="round"/><path d="M50 101V38M50 80 31 57M50 80 69 57" fill="none" stroke="#fff1d0" stroke-opacity=".65" stroke-width="2" stroke-linecap="round"/></svg>`;
  }

  function createDecoration() {
    const layer = document.createElement("div");
    layer.id = "mmc-seasonal-decorations";
    layer.className = "mmc-seasonal";
    layer.setAttribute("aria-hidden", "true");
    layer.innerHTML = `<div class="mmc-seasonal__rail mmc-seasonal__rail--left"><div class="mmc-seasonal__top">${leaf("leaf-a")}${leaf("leaf-b")}</div><div class="mmc-seasonal__bottom">${leaf("leaf-c")}${leaf("leaf-d")}${leaf("leaf-e")}</div></div><div class="mmc-seasonal__rail mmc-seasonal__rail--right"><div class="mmc-seasonal__top">${leaf("leaf-f")}${leaf("leaf-g")}</div><div class="mmc-seasonal__bottom">${leaf("leaf-h")}${leaf("leaf-i")}${leaf("leaf-j")}</div></div>`;
    const garland = document.createElement("div");
    garland.className = "mmc-seasonal__garland";
    garland.setAttribute("aria-hidden", "true");
    garland.innerHTML = `<svg viewBox="0 0 390 30" preserveAspectRatio="none" aria-hidden="true"><path d="M0 3Q195 24 390 3" fill="none" stroke="#b8875c" stroke-width="1.5"/><g fill="#b85236"><path d="m37 7 5 6 6-2-2 6-4 5-4-5-2-6Z"/><path d="m145 17 5 5 5-2-1 5-4 4-4-4-1-5Z"/><path d="m282 14 5 5 5-2-1 5-4 4-4-4-1-5Z"/></g><g fill="#d49a47"><path d="m90 13 5 5 5-2-1 5-4 4-4-4-1-5Z"/><path d="m214 18 5 5 5-2-1 5-4 4-4-4-1-5Z"/><path d="m346 8 5 5 5-2-1 5-4 4-4-4-1-5Z"/></g></svg>`;
    header.appendChild(garland);
    document.body.appendChild(layer);
    root = layer;
  }

  function updateRails() {
    if (!root || window.innerWidth <= 760) return;
    const candidates = [...document.querySelectorAll("main, main .page-width, main .page-hero, main .content-section, main .card-section, main .hero-content, main .lounge-board, main .feature-section, main .mission-card, main .news-section, main .today-words, main .today-one-teaser, main .today-game, main .daily-quiz-teaser, main .works-grid, main .lounge-hero, main .lounge-today, main .lounge-archive")]
      .map((element) => element.getBoundingClientRect())
      .filter((rect) => rect.width > 200 && rect.width < window.innerWidth - 40);
    const left = candidates.length ? Math.min(...candidates.map((rect) => rect.left)) : 0;
    const right = candidates.length ? Math.min(...candidates.map((rect) => window.innerWidth - rect.right)) : 0;
    root.querySelector(".mmc-seasonal__rail--left").hidden = left < 125;
    root.querySelector(".mmc-seasonal__rail--right").hidden = right < 125;
  }
  function show() {
    if (root) return;
    stylesheet = document.createElement("link");
    stylesheet.rel = "stylesheet";
    stylesheet.href = new URL(event.stylesheet, script.src).href;
    stylesheet.dataset.mmcSeasonalStyle = "";
    document.head.appendChild(stylesheet);
    createDecoration();
    updateRails();
  }
  function hide() {
    if (!root) return;
    root.remove();
    header.querySelector(".mmc-seasonal__garland")?.remove();
    stylesheet?.remove();
    root = null;
    stylesheet = null;
  }
  function sync() {
    if (preview === "off" || (!preview && !isActive(event, Date.now()))) hide();
    else show();
    clearTimeout(endTimer);
    if (!preview && Date.now() < event.end) {
      const next = Date.now() < event.start ? event.start : event.end;
      endTimer = setTimeout(sync, Math.min(next - Date.now() + 20, 2147483647));
    }
  }
  if (preview === "reduced") document.documentElement.classList.add("mmc-seasonal-reduced");
  window.addEventListener("resize", () => {
    if (resizeFrame) cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(updateRails);
  }, { passive: true });
  document.addEventListener("visibilitychange", () => { if (!document.hidden) sync(); });
  sync();
})();
