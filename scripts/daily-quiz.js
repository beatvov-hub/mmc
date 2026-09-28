(() => {
  document.querySelectorAll('[data-quiz]').forEach((quiz) => {
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
  });
})();
