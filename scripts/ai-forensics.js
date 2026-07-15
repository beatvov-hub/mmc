(function () {
  const cards = Array.from(document.querySelectorAll(".forensics-card-grid [data-forensics-card]"));
  const empty = document.querySelector("[data-forensics-empty]");
  const categorySelect = document.querySelector("[data-forensics-filter='category']");
  const levelSelect = document.querySelector("[data-forensics-filter='level']");
  const difficultySelect = document.querySelector("[data-forensics-filter='difficulty']");
  const searchInput = document.querySelector("[data-forensics-filter='search']");

  function normalize(value) {
    return String(value || "").trim().toLowerCase();
  }

  function applyFilters() {
    if (!cards.length) return;
    const category = categorySelect ? categorySelect.value : "all";
    const level = levelSelect ? levelSelect.value : "all";
    const difficulty = difficultySelect ? difficultySelect.value : "all";
    const keyword = normalize(searchInput ? searchInput.value : "");
    let visibleCount = 0;

    cards.forEach(function (card) {
      const haystack = normalize(card.dataset.searchText);
      const matchesCategory = category === "all" || card.dataset.category === category;
      const matchesLevel = level === "all" || card.dataset.level === level;
      const matchesDifficulty = difficulty === "all" || card.dataset.difficulty === difficulty;
      const matchesKeyword = !keyword || haystack.includes(keyword);
      const visible = matchesCategory && matchesLevel && matchesDifficulty && matchesKeyword;
      card.hidden = !visible;
      if (visible) visibleCount += 1;
    });

    if (empty) empty.hidden = visibleCount !== 0;
  }

  [categorySelect, levelSelect, difficultySelect, searchInput].forEach(function (control) {
    if (!control) return;
    control.addEventListener(control.tagName === "INPUT" ? "input" : "change", applyFilters);
  });
  applyFilters();

  const questionBlocks = Array.from(document.querySelectorAll("[data-forensics-question]"));
  questionBlocks.forEach(function (block) {
    const checkboxes = Array.from(block.querySelectorAll("input[type='checkbox'][data-choice-id]"));
    const button = block.querySelector("[data-check-answer]");
    const result = block.querySelector("[data-answer-result]");
    const recommended = new Set((block.dataset.recommended || "").split(",").filter(Boolean));

    function updateResult() {
      const selected = new Set(checkboxes.filter(function (item) { return item.checked; }).map(function (item) { return item.dataset.choiceId; }));
      checkboxes.forEach(function (item) {
        const card = item.closest("[data-choice-card]");
        if (!card) return;
        card.classList.remove("is-recommended", "is-selected-only", "is-avoid");
        if (recommended.has(item.dataset.choiceId)) {
          card.classList.add("is-recommended");
        } else if (selected.has(item.dataset.choiceId)) {
          card.classList.add("is-avoid");
        }
        if (selected.has(item.dataset.choiceId) && recommended.has(item.dataset.choiceId)) {
          card.classList.add("is-selected-only");
        }
      });
      if (result) {
        result.hidden = false;
        result.focus({ preventScroll: true });
      }
    }

    if (button) {
      button.addEventListener("click", function () {
        if (!checkboxes.some(function (item) { return item.checked; })) {
          if (result) {
            result.hidden = false;
            result.querySelector("[data-answer-empty]").hidden = false;
            result.focus({ preventScroll: true });
          }
          return;
        }
        if (result) {
          const emptyNote = result.querySelector("[data-answer-empty]");
          if (emptyNote) emptyNote.hidden = true;
        }
        updateResult();
      });
    }

    checkboxes.forEach(function (item) {
      item.addEventListener("change", function () {
        if (result && !result.hidden) updateResult();
      });
    });
  });
})();
