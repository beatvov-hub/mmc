(function () {
  const cards = Array.from(document.querySelectorAll(".forensics-card-grid [data-forensics-card]"));
  const empty = document.querySelector("[data-forensics-empty]");
  const categorySelect = document.querySelector("[data-forensics-filter='category']");
  const levelSelect = document.querySelector("[data-forensics-filter='level']");
  const difficultySelect = document.querySelector("[data-forensics-filter='difficulty']");
  const searchInput = document.querySelector("[data-forensics-filter='search']");
  const resultsStatus = document.querySelector("[data-forensics-results]");
  const pagination = document.querySelector("[data-forensics-pagination]");
  const pageSize = Number(pagination && pagination.dataset.pageSize) || 9;
  let currentPage = 1;
  let filteredCards = cards.slice();

  function normalize(value) {
    return String(value || "").trim().toLowerCase();
  }

  function renderPagination(totalPages, visibleCount) {
    if (!pagination) return;
    pagination.innerHTML = "";
    pagination.hidden = totalPages <= 1;
    if (resultsStatus) {
      if (visibleCount === 0) {
        resultsStatus.textContent = "該当する事例はありません。";
      } else if (totalPages <= 1) {
        resultsStatus.textContent = `${visibleCount}件の事例を表示しています。`;
      } else {
        resultsStatus.textContent = `${visibleCount}件中 ${currentPage}/${totalPages}ページを表示しています。`;
      }
    }
    if (totalPages <= 1) return;

    function addButton(label, page, options) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = label;
      button.dataset.page = String(page);
      button.className = "forensics-page-button";
      if (options && options.current) {
        button.classList.add("is-current");
        button.setAttribute("aria-current", "page");
      }
      if (options && options.disabled) button.disabled = true;
      pagination.appendChild(button);
    }

    addButton("前へ", Math.max(1, currentPage - 1), { disabled: currentPage === 1 });
    for (let page = 1; page <= totalPages; page += 1) {
      addButton(String(page), page, { current: page === currentPage });
    }
    addButton("次へ", Math.min(totalPages, currentPage + 1), { disabled: currentPage === totalPages });
  }

  function applyFilters(options) {
    if (!cards.length) return;
    if (!options || options.resetPage !== false) currentPage = 1;
    const category = categorySelect ? categorySelect.value : "all";
    const level = levelSelect ? levelSelect.value : "all";
    const difficulty = difficultySelect ? difficultySelect.value : "all";
    const keyword = normalize(searchInput ? searchInput.value : "");
    filteredCards = cards.filter(function (card) {
      const haystack = normalize(card.dataset.searchText);
      return (category === "all" || card.dataset.category === category)
        && (level === "all" || card.dataset.level === level)
        && (difficulty === "all" || card.dataset.difficulty === difficulty)
        && (!keyword || haystack.includes(keyword));
    });

    cards.forEach(function (card) {
      card.hidden = true;
    });

    const visibleCount = filteredCards.length;
    const totalPages = Math.max(1, Math.ceil(visibleCount / pageSize));
    if (currentPage > totalPages) currentPage = totalPages;
    const start = (currentPage - 1) * pageSize;
    filteredCards.slice(start, start + pageSize).forEach(function (card) {
      card.hidden = false;
    });
    if (empty) empty.hidden = visibleCount !== 0;
    renderPagination(totalPages, visibleCount);
  }

  [categorySelect, levelSelect, difficultySelect, searchInput].forEach(function (control) {
    if (!control) return;
    control.addEventListener(control.tagName === "INPUT" ? "input" : "change", applyFilters);
  });
  if (pagination) {
    pagination.addEventListener("click", function (event) {
      const button = event.target.closest("[data-page]");
      if (!button || button.disabled) return;
      currentPage = Number(button.dataset.page) || 1;
      applyFilters({ resetPage: false });
      const searchSection = document.querySelector(".forensics-search-section");
      if (searchSection) searchSection.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }
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
