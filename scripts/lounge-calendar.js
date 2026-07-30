const initializeLoungeCalendar = () => {
  const calendar = document.querySelector("[data-lounge-calendar]");
  if (!calendar) {
    return;
  }

  const panels = Array.from(calendar.querySelectorAll("[data-calendar-month]"));
  const monthSelect = calendar.querySelector("[data-calendar-select]");
  const monthTitle = calendar.querySelector("[data-calendar-title]");
  const previousButton = calendar.querySelector("[data-calendar-prev]");
  const nextButton = calendar.querySelector("[data-calendar-next]");

  if (!panels.length || !monthSelect || !monthTitle || !previousButton || !nextButton) {
    return;
  }

  const months = panels.map((panel) => panel.dataset.calendarMonth);
  let currentIndex = Math.max(0, months.indexOf(monthSelect.value));

  const showMonth = (index) => {
    currentIndex = Math.min(Math.max(index, 0), months.length - 1);
    const monthKey = months[currentIndex];
    const [year, month] = monthKey.split("-");

    panels.forEach((panel) => {
      panel.hidden = panel.dataset.calendarMonth !== monthKey;
    });

    monthSelect.value = monthKey;
    monthTitle.textContent = `${Number(year)}年${Number(month)}月`;
    calendar.setAttribute("aria-label", `${Number(year)}年${Number(month)}月のラウンジ更新カレンダー`);
    previousButton.disabled = currentIndex === 0;
    nextButton.disabled = currentIndex === months.length - 1;
  };

  previousButton.addEventListener("click", () => showMonth(currentIndex - 1));
  nextButton.addEventListener("click", () => showMonth(currentIndex + 1));
  monthSelect.addEventListener("change", () => showMonth(months.indexOf(monthSelect.value)));

  showMonth(currentIndex);
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeLoungeCalendar, { once: true });
} else {
  initializeLoungeCalendar();
}
