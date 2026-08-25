(function () {
  const tabList = document.querySelector("[data-faq-tabs]");
  const panels = Array.from(document.querySelectorAll("[data-faq-panel]"));
  if (!tabList || panels.length === 0) return;

  const tabs = Array.from(tabList.querySelectorAll("[data-faq-tab]"));
  const panelFor = (id) => panels.find((panel) => panel.id === id);
  const tabFor = (id) => tabs.find((tab) => tab.dataset.faqTab === id);

  function select(id, { focus = false } = {}) {
    const selectedPanel = panelFor(id);
    const selectedTab = tabFor(id);
    if (!selectedPanel || !selectedTab) return false;

    document.documentElement.classList.add("faq-tabs-ready");
    tabs.forEach((tab) => {
      const active = tab === selectedTab;
      tab.setAttribute("aria-selected", String(active));
      tab.tabIndex = active ? 0 : -1;
    });
    panels.forEach((panel) => {
      panel.hidden = panel !== selectedPanel;
    });
    if (focus) selectedTab.focus();
    return true;
  }

  function categoryFromHash() {
    const hash = decodeURIComponent(window.location.hash.slice(1));
    if (!hash) return null;
    if (panelFor(hash)) return hash;
    const item = document.getElementById(hash);
    return item ? item.closest("[data-faq-panel]")?.id || null : null;
  }

  const initialCategory = categoryFromHash() || panels[0].id;
  select(initialCategory);

  tabList.addEventListener("click", (event) => {
    const tab = event.target.closest("[data-faq-tab]");
    if (!tab) return;
    const id = tab.dataset.faqTab;
    if (select(id, { focus: true })) history.replaceState(null, "", `#${id}`);
  });

  tabList.addEventListener("keydown", (event) => {
    const currentIndex = tabs.indexOf(document.activeElement);
    if (currentIndex < 0) return;
    let nextIndex = null;
    if (event.key === "ArrowRight") nextIndex = (currentIndex + 1) % tabs.length;
    if (event.key === "ArrowLeft") nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = tabs.length - 1;
    if (nextIndex === null) return;
    event.preventDefault();
    const id = tabs[nextIndex].dataset.faqTab;
    select(id, { focus: true });
    history.replaceState(null, "", `#${id}`);
  });

  window.addEventListener("hashchange", () => {
    const id = categoryFromHash();
    if (id) select(id);
  });
})();
