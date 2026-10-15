(function () {
  "use strict";

  // Explicit UTC instants corresponding to midnight in Asia/Tokyo (UTC+09:00).
  // Add future events here; the rendering branch below supplies their artwork.
  const events = {
    halloween2026: {
      start: Date.UTC(2026, 9, 14, 15),
      end: Date.UTC(2026, 9, 31, 15),
      stylesheet: "../styles/seasonal-decorations.css"
    }
  };

  function isActive(event, now) {
    return now >= event.start && now < event.end;
  }

  function previewMode(location) {
    if (!/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname)) return null;
    const mode = new URLSearchParams(location.search).get("mmcSeason");
    return ["off", "halloween", "reduced"].includes(mode) ? mode : null;
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { events, isActive, previewMode };
  }
  if (typeof document === "undefined") return;

  const script = document.currentScript;
  const event = events.halloween2026;
  const preview = previewMode(window.location);
  const header = document.querySelector(".site-header");
  if (!script || !header || window.__mmcSeasonalInitialized) return;
  window.__mmcSeasonalInitialized = true;

  let root = null;
  let stylesheet = null;
  let endTimer = null;
  let resizeFrame = null;

  function svg(name, className) {
    return `<svg class="${className}" viewBox="0 0 140 140" aria-hidden="true"><use href="#mmc-seasonal-${name}"></use></svg>`;
  }

  const symbols = `<svg class="mmc-seasonal__symbols" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <defs>
      <symbol id="mmc-seasonal-pumpkin" viewBox="0 0 140 140">
        <path d="M69 34c1-14 8-22 19-24-7 9-9 17-7 25" fill="none" stroke="#426746" stroke-width="8" stroke-linecap="round"/>
        <path d="M73 37c15-10 28-3 34 7 24-3 31 22 26 44-5 29-30 46-62 46S13 117 7 88C2 64 11 42 34 44c11-13 25-15 39-7Z" fill="#e7782f" stroke="#a94e2a" stroke-width="3"/>
        <path d="M35 44C19 69 25 108 43 126M71 38c-10 27-11 65 0 94m35-88c16 23 11 61-7 83" fill="none" stroke="#f6a049" stroke-width="6" opacity=".85"/>
        <g fill="#79401e"><path d="m37 75 12-11 9 15-20 2Zm69 0L94 64l-9 15 20 2Z"/><path d="M44 98q27 23 54 0l-7 18q-21 15-40 0Z"/></g>
      </symbol>
      <symbol id="mmc-seasonal-pumpkin-face" viewBox="0 0 140 140"><g fill="#ffe09a"><path d="m37 75 12-11 9 15-20 2Zm69 0L94 64l-9 15 20 2Z"/><path d="M44 98q27 23 54 0l-7 18q-21 15-40 0Z"/></g></symbol>
      <symbol id="mmc-seasonal-ghost" viewBox="0 0 140 140">
        <path d="M25 111V62c0-29 19-48 45-48s45 19 45 48v49l-17-8-12 11-17-9-16 11-13-12Z" fill="#fff8ee" stroke="#c9b7d7" stroke-width="4" stroke-linejoin="round"/>
        <ellipse cx="54" cy="67" rx="5" ry="7" fill="#30233f"/><ellipse cx="85" cy="67" rx="5" ry="7" fill="#30233f"/>
        <path d="M64 86q6 7 13 0" fill="none" stroke="#30233f" stroke-width="4" stroke-linecap="round"/>
        <circle cx="40" cy="82" r="7" fill="#f4c1bd" opacity=".65"/><circle cx="100" cy="82" r="7" fill="#f4c1bd" opacity=".65"/>
      </symbol>
      <symbol id="mmc-seasonal-bat" viewBox="0 0 140 140">
        <path d="M70 57c-9-16-25-23-44-21l-8-13-3 21-12 8 11 4c-3 16 4 27 18 30-2-15 8-23 21-15l17 22 17-22c13-8 23 0 21 15 14-3 21-14 18-30l11-4-12-8-3-21-8 13c-19-2-35 5-44 21Z" fill="#7650a4" stroke="#423054" stroke-width="4" stroke-linejoin="round"/>
        <circle cx="62" cy="65" r="3" fill="#ffd36b"/><circle cx="78" cy="65" r="3" fill="#ffd36b"/>
      </symbol>
      <symbol id="mmc-seasonal-star" viewBox="0 0 140 140"><path d="m70 12 15 41 43 17-43 15-15 43-15-43-43-15 43-17Z" fill="#ffd36b"/></symbol>
      <symbol id="mmc-seasonal-leaf" viewBox="0 0 140 140"><path d="M20 91C28 38 73 24 119 22c-8 52-38 87-88 93L20 91Z" fill="#dd9141"/><path d="M24 111Q65 68 115 28" fill="none" stroke="#a86a35" stroke-width="5"/></symbol>
    </defs>
  </svg>`;

  function createDecoration() {
    const layer = document.createElement("div");
    layer.id = "mmc-seasonal-decorations";
    layer.className = "mmc-seasonal";
    layer.setAttribute("aria-hidden", "true");
    layer.innerHTML = `${symbols}
      <div class="mmc-seasonal__rail mmc-seasonal__rail--left">
        <div class="mmc-seasonal__top">${svg("bat", "mmc-seasonal__bat")}${svg("star", "mmc-seasonal__star mmc-seasonal__star--one")}${svg("star", "mmc-seasonal__star mmc-seasonal__star--two")}</div>
        <div class="mmc-seasonal__bottom">${svg("pumpkin", "mmc-seasonal__pumpkin mmc-seasonal__pumpkin--large")}${svg("pumpkin-face", "mmc-seasonal__pumpkin mmc-seasonal__pumpkin--large mmc-seasonal__face")}${svg("leaf", "mmc-seasonal__leaf mmc-seasonal__leaf--one")}${svg("leaf", "mmc-seasonal__leaf mmc-seasonal__leaf--two")}</div>
      </div>
      <div class="mmc-seasonal__rail mmc-seasonal__rail--right">
        <div class="mmc-seasonal__top">${svg("bat", "mmc-seasonal__bat mmc-seasonal__bat--right")}</div>
        <div class="mmc-seasonal__bottom">${svg("ghost", "mmc-seasonal__ghost")}${svg("pumpkin", "mmc-seasonal__pumpkin mmc-seasonal__pumpkin--small")}${svg("pumpkin-face", "mmc-seasonal__pumpkin mmc-seasonal__pumpkin--small mmc-seasonal__face")}${svg("star", "mmc-seasonal__star mmc-seasonal__star--right")}</div>
      </div>`;
    const garland = document.createElement("div");
    garland.className = "mmc-seasonal__garland";
    garland.setAttribute("aria-hidden", "true");
    garland.innerHTML = `<svg viewBox="0 0 390 30" preserveAspectRatio="none" aria-hidden="true">
      <path d="M0 3Q195 26 390 3" fill="none" stroke="#7650a4" stroke-width="2"/>
      <path d="m14 6 22 2-12 17Zm42 5 22 2-13 16Zm42 4 22 1-13 15Zm42 2 22 1-12 14Zm42 2 22 0-11 13Zm42-1 22-1-10 14Zm42-3 22-2-10 16Zm42-5 22-2-10 17Zm42-5 22-2-11 17Z" fill="#f28c28"/>
      <path d="m35 9 21 3-12 17Zm42 5 21 2-12 14Zm42 3 21 1-12 13Zm42 2 21 0-11 13Zm42 0 21-1-10 14Zm42-2 21-2-10 15Zm42-4 21-3-10 17Zm42-5 21-3-11 17Z" fill="#7650a4"/>
      <circle cx="195" cy="19" r="7" fill="#f28c28"/><path d="M195 12v-3m-4 12 2 2 2-2 2 2 2-2" stroke="#30233f" stroke-width="1.5" fill="none"/>
      <path d="M279 8q-6-7-13-4l-5-3v6l-5 4 6 1q-1 7 5 8 1-7 7-4l5 5 5-5q6-3 7 4 6-1 5-8l6-1-5-4V1l-5 3q-7-3-13 4Z" fill="#30233f"/>
      <path d="m93 2 1 4 4 1-4 1-1 4-1-4-4-1 4-1Zm208 0 1 4 4 1-4 1-1 4-1-4-4-1 4-1Z" fill="#ffd36b"/>
    </svg>`;
    header.appendChild(garland);
    document.body.appendChild(layer);
    root = layer;
  }

  function updateRails() {
    if (!root || window.innerWidth <= 760) return;
    const candidates = [...document.querySelectorAll("main, main .page-width, main .page-hero, main .content-section, main .card-section, main .hero-content, main .lounge-board, main .feature-section, main .mission-card, main .news-section, main .today-words, main .today-one-teaser, main .today-game, main .daily-quiz-teaser, main .works-grid, main .lounge-hero, main .lounge-today, main .lounge-archive")]
      .map((element) => element.getBoundingClientRect())
      .filter((rect) => rect.width > 200 && rect.width < window.innerWidth - 40);
    // A page without a measurable central content area gets no side decorations.
    const left = candidates.length ? Math.min(...candidates.map((rect) => rect.left)) : 0;
    const right = candidates.length ? Math.min(...candidates.map((rect) => window.innerWidth - rect.right)) : 0;
    root.querySelector(".mmc-seasonal__rail--left").hidden = left < 148;
    root.querySelector(".mmc-seasonal__rail--right").hidden = right < 148;
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
