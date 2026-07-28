(() => {
  const tabs = Array.from(document.querySelectorAll("[data-director-tab]"));
  const panels = Array.from(document.querySelectorAll("[data-director-panel]"));
  if (!tabs.length || !panels.length) return;

  const activate = (name, { focus = false, updateHash = true } = {}) => {
    const activeTab = tabs.find((tab) => tab.dataset.directorTab === name) || tabs[0];
    const activeName = activeTab.dataset.directorTab;

    tabs.forEach((tab) => {
      const selected = tab === activeTab;
      tab.classList.toggle("is-active", selected);
      tab.setAttribute("aria-selected", String(selected));
      tab.tabIndex = selected ? 0 : -1;
    });
    panels.forEach((panel) => {
      panel.hidden = panel.dataset.directorPanel !== activeName;
    });

    if (focus) activeTab.focus();
    activeTab.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
    if (updateHash) history.replaceState(null, "", `#${activeName}`);
  };

  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => activate(tab.dataset.directorTab));
    tab.addEventListener("keydown", (event) => {
      let next = index;
      if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
      else if (event.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
      else if (event.key === "Home") next = 0;
      else if (event.key === "End") next = tabs.length - 1;
      else return;
      event.preventDefault();
      activate(tabs[next].dataset.directorTab, { focus: true });
    });
  });

  activate(window.location.hash.slice(1), { updateHash: false });
})();
