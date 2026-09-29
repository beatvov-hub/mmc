(() => {
  function bindQuiz(quiz) {
    const choices = quiz.querySelectorAll('[data-quiz-choice]');
    const reveal = quiz.querySelector('[data-quiz-reveal]');
    const answer = quiz.querySelector('[data-quiz-answer]');

    choices.forEach((choice) => {
      choice.addEventListener('click', () => {
        choices.forEach((item) => {
          const selected = item === choice;
          item.classList.toggle('is-selected', selected);
          item.setAttribute('aria-pressed', String(selected));
        });
      });
    });

    reveal?.addEventListener('click', () => {
      if (!answer) return;
      answer.hidden = false;
      reveal.hidden = true;
      answer.setAttribute('tabindex', '-1');
      answer.focus({ preventScroll: true });
    });
  }

  document.querySelectorAll('[data-quiz]').forEach(bindQuiz);

  const section = document.querySelector?.('[data-daily-day]');
  if (!section) return;
  const grid = section.querySelector('[data-daily-rotation]');
  const label = section.querySelector('[data-daily-date-label]');
  if (!grid || !label) return;

  const hour = 60 * 60 * 1000;
  let retryTimer;
  // Tokyo is UTC+9 throughout the year; subtracting six hours gives UTC+3.
  function quizDay() {
    return new Date(Date.now() + 3 * hour).toISOString().slice(0, 10);
  }

  async function refresh() {
    const day = quizDay();
    if (section.getAttribute('data-daily-day') === day) return;
    try {
      const response = await fetch('/quiz/daily-rotation.json', { cache: 'no-store' });
      if (!response.ok) throw new Error('Daily rotation unavailable');
      const cards = (await response.json()).days?.[day];
      if (!cards) throw new Error('Daily rotation missing for this date');
      grid.innerHTML = cards;
      grid.querySelectorAll('[data-quiz]').forEach(bindQuiz);
      const [year, month, date] = day.split('-').map(Number);
      label.textContent = `TODAY / ${year}年${month}月${date}日`;
      section.setAttribute('data-daily-day', day);
      clearTimeout(retryTimer);
    } catch {
      clearTimeout(retryTimer);
      retryTimer = setTimeout(refresh, 60 * 1000);
    }
  }

  function scheduleNextDay() {
    const day = quizDay();
    const nextSixTokyo = Date.parse(`${day}T00:00:00Z`) + 21 * hour;
    setTimeout(() => {
      refresh();
      scheduleNextDay();
    }, Math.max(1000, nextSixTokyo - Date.now()));
  }

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) refresh();
  });
  refresh();
  scheduleNextDay();
})();
