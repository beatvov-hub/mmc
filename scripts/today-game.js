(() => {
  const DAY_MS = 24 * 60 * 60 * 1000;
  const JST_SWITCH_OFFSET_MS = 60 * 60 * 1000;
  const DATA_URL = "src/data/workStories.json";

  const isGame = (work) => String(work?.category || "").includes("ゲーム");

  const gameWorks = (works) => works
    .filter((work) => work && typeof work.slug === "string" && isGame(work))
    .sort((left, right) => left.slug.localeCompare(right.slug, "en"));

  // UTC 23:00 is 08:00 in Japan. The offset makes that moment the day boundary.
  const todayGameIndex = (now = Date.now()) => Math.floor((now + JST_SWITCH_OFFSET_MS) / DAY_MS);

  const selectTodayGame = (works, now = Date.now()) => {
    const games = gameWorks(works);
    if (!games.length) {
      return null;
    }
    return games[todayGameIndex(now) % games.length];
  };

  const detailHref = (work) => `works/${encodeURIComponent(work.slug)}`;

  const render = (section, work) => {
    const category = section.querySelector("[data-today-game-category]");
    const title = section.querySelector("[data-today-game-title]");
    const summary = section.querySelector("[data-today-game-summary]");
    const link = section.querySelector("[data-today-game-link]");
    const playUrl = typeof work.publicUrl === "string" && work.publicUrl.trim();

    category.textContent = work.category;
    title.textContent = work.title;
    summary.textContent = work.summary;
    link.href = playUrl || detailHref(work);
    link.textContent = playUrl ? "遊んでみる" : "制作背景を見る";
    link.insertAdjacentHTML("beforeend", ' <span aria-hidden="true">→</span>');
    if (/^https?:\/\//.test(link.href)) {
      link.target = "_blank";
      link.rel = "noopener noreferrer";
    }
    section.hidden = false;
  };

  const init = async () => {
    const section = document.querySelector("#today-game");
    if (!section) {
      return;
    }

    try {
      const response = await fetch(DATA_URL, { headers: { Accept: "application/json" } });
      if (!response.ok) {
        return;
      }
      const works = await response.json();
      if (!Array.isArray(works)) {
        return;
      }
      const work = selectTodayGame(works);
      if (work) {
        render(section, work);
      }
    } catch {
      // The hidden section is intentionally left out when the data is unavailable.
    }
  };

  const api = { gameWorks, todayGameIndex, selectTodayGame };
  if (typeof module !== "undefined") {
    module.exports = api;
  }
  if (typeof document !== "undefined") {
    init();
  }
})();
