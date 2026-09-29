(() => {
  const section = document.querySelector('[data-home-quiz-day]');
  const grid = section?.querySelector('[data-home-quiz-grid]');
  if (!section || !grid) return;

  function quizDay() {
    const now = new Date();
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23',
    }).formatToParts(now).reduce((result, part) => ({ ...result, [part.type]: part.value }), {});
    const day = new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day)));
    if (Number(parts.hour) < 6) day.setUTCDate(day.getUTCDate() - 1);
    return day.toISOString().slice(0, 10);
  }

  function previewCard(sourceCard) {
    const qualification = sourceCard.querySelector('.quiz-home-question-heading h3 a');
    const icon = sourceCard.querySelector('.quiz-icon');
    const title = sourceCard.querySelector('.quiz-question-block h4');
    const question = sourceCard.querySelector('.quiz-question-text');
    const link = sourceCard.querySelector('.quiz-question-permalink a');
    const metadata = [...sourceCard.querySelectorAll('.quiz-meta dd')];
    if (!qualification || !icon || !title || !question || !link) return null;

    const article = document.createElement('article');
    article.className = [...sourceCard.classList].filter((name) => name.startsWith('quiz-accent-')).concat('daily-quiz-teaser-card').join(' ');
    article.setAttribute('data-home-quiz-card', '');
    article.innerHTML = `
      <div class="daily-quiz-teaser-card__heading">
        <span class="daily-quiz-teaser-card__icon" aria-hidden="true"></span>
        <h3><a></a></h3>
      </div>
      <p class="daily-quiz-teaser-card__meta"><span></span><span></span></p>
      <p class="daily-quiz-teaser-card__question"></p>
      <a class="daily-quiz-teaser-card__link">今日の問題を解く →</a>`;
    article.querySelector('.daily-quiz-teaser-card__icon').textContent = icon.textContent;
    const qualificationLink = article.querySelector('h3 a');
    qualificationLink.textContent = qualification.textContent;
    qualificationLink.href = qualification.href;
    const meta = article.querySelectorAll('.daily-quiz-teaser-card__meta span');
    meta[0].textContent = metadata[0]?.textContent || '';
    meta[1].textContent = metadata[1]?.textContent || '';
    article.querySelector('.daily-quiz-teaser-card__question').textContent = question.textContent;
    const detailLink = article.querySelector('.daily-quiz-teaser-card__link');
    detailLink.href = link.href;
    return article;
  }

  async function refresh() {
    const day = quizDay();
    if (section.dataset.homeQuizDay === day) return;
    try {
      const response = await fetch('/quiz/daily-rotation.json', { cache: 'no-store' });
      const cards = (await response.json()).days?.[day];
      if (!response.ok || !cards) throw new Error('Daily rotation unavailable');
      const documentFragment = new DOMParser().parseFromString(`<div>${cards}</div>`, 'text/html');
      const previews = [...documentFragment.querySelectorAll('.quiz-home-question')].map(previewCard).filter(Boolean);
      if (!previews.length) throw new Error('Daily previews unavailable');
      grid.replaceChildren(...previews);
      section.dataset.homeQuizDay = day;
    } catch {
      // Keep the server-rendered preview when rotation data is unavailable.
    }
  }

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) refresh();
  });
  refresh();
})();
