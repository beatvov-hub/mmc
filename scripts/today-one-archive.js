(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root && root.document) api.init(root.document);
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function matchesFilters(entry, filters) {
    return (!filters.month || entry.month === filters.month) &&
      (!filters.useCategory || entry.useCategory === filters.useCategory) &&
      (!filters.employee || entry.employee === filters.employee);
  }

  function applyFilters(cards, filters) {
    let visible = 0;
    for (const card of cards) {
      const show = matchesFilters(card.dataset, filters);
      card.hidden = !show;
      if (show) visible++;
    }
    return visible;
  }

  function init(document) {
    const archive = document.querySelector("[data-today-one-archive]");
    if (!archive) return;
    const fields = [...archive.querySelectorAll("[data-archive-filter]")];
    const cards = [...archive.querySelectorAll("[data-archive-card]")];
    const result = archive.querySelector("[data-archive-result]");
    const empty = archive.querySelector("[data-archive-empty]");
    const filters = () => Object.fromEntries(fields.map(field => [field.dataset.archiveFilter, field.value]));
    const update = () => {
      const visible = applyFilters(cards, filters());
      if (result) result.textContent = `${visible}件を表示中`;
      if (empty) empty.hidden = visible > 0;
    };
    fields.forEach(field => field.addEventListener("change", update));
    const reset = archive.querySelector("[data-archive-reset]");
    if (reset) reset.addEventListener("click", () => {
      fields.forEach(field => { field.value = ""; });
      update();
      fields[0]?.focus();
    });
    update();
  }

  return { applyFilters, init, matchesFilters };
});
