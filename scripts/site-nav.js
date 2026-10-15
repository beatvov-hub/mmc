(function () {
  const header = document.querySelector(".site-header");
  if (!header) return;

  const toggle = header.querySelector(".nav-toggle");
  const nav = header.querySelector(".global-nav");
  const compactAt = 24;
  const mobileQuery = window.matchMedia("(max-width: 760px)");

  function setCompact() {
    header.classList.toggle("is-compact", window.scrollY > compactAt);
  }

  function closeMenu() {
    header.classList.remove("nav-open");
    if (toggle) {
      toggle.setAttribute("aria-expanded", "false");
      toggle.setAttribute("aria-label", "メニューを開く");
    }
  }

  function toggleMenu() {
    const isOpen = header.classList.toggle("nav-open");
    toggle.setAttribute("aria-expanded", String(isOpen));
    toggle.setAttribute("aria-label", isOpen ? "メニューを閉じる" : "メニューを開く");
  }

  setCompact();
  window.addEventListener("scroll", setCompact, { passive: true });

  if (toggle && nav) {
    toggle.addEventListener("click", toggleMenu);
    nav.addEventListener("click", function (event) {
      if (event.target.closest("a")) closeMenu();
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") closeMenu();
    });
    mobileQuery.addEventListener("change", function (event) {
      if (!event.matches) closeMenu();
    });
  }

  // The shared navigation script is present on the site's generated pages.
  // Keep seasonal features separate from the navigation and load them once.
  if (!document.querySelector('script[data-mmc-seasonal]')) {
    const seasonal = document.createElement("script");
    seasonal.src = new URL("seasonal-decorations.js", document.currentScript.src).href;
    seasonal.defer = true;
    seasonal.dataset.mmcSeasonal = "";
    document.head.appendChild(seasonal);
  }
})();
