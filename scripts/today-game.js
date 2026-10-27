(() => {
  const DAY_MS = 24 * 60 * 60 * 1000;
  const JST_SWITCH_OFFSET_MS = 60 * 60 * 1000;
  const DATA_URL = "src/data/workStories.json";

  const isGame = (work) => String(work?.category || "").includes("ゲーム");

  const playableUrl = (work) => {
    const url = typeof work?.publicUrl === "string" ? work.publicUrl.trim() : "";
    const status = String(work?.statusLabel || "");
    const label = String(work?.publicLabel || "");
    if (!url || url.startsWith("#") || !status.includes("公開中") || /開発中|未公開|非公開|準備中/.test(status) || !/遊ぶ|プレイ/.test(label)) return "";
    try {
      const parsed = new URL(url, "https://mainichi-miru.com/");
      if (!/^https?:$/.test(parsed.protocol) || parsed.username || parsed.password) return "";
      if (parsed.hostname === "mainichi-miru.com" && (parsed.pathname === "/" || /^\/(?:works|news)(?:\/|$)/.test(parsed.pathname))) return "";
      return url;
    } catch {
      return "";
    }
  };

  const gameWorks = (works) => works
    .filter((work) => work && typeof work.slug === "string" && isGame(work) && playableUrl(work))
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

  const render = (section, work) => {
    const category = section.querySelector("[data-today-game-category]");
    const title = section.querySelector("[data-today-game-title]");
    const summary = section.querySelector("[data-today-game-summary]");
    const link = section.querySelector("[data-today-game-link]");
    const playUrl = playableUrl(work);

    category.textContent = work.category;
    title.textContent = work.title;
    summary.textContent = work.summary;
    link.href = playUrl;
    link.textContent = "遊んでみる";
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

    const showEmpty = (message) => {
      section.querySelector(".today-game-card").hidden = true;
      const empty = section.querySelector("[data-today-game-empty]");
      empty.textContent = message;
      empty.hidden = false;
    };

    try {
      const response = await fetch(DATA_URL, { headers: { Accept: "application/json" } });
      if (!response.ok) {
        throw new Error("Game data unavailable");
      }
      const works = await response.json();
      if (!Array.isArray(works)) {
        throw new Error("Invalid game data");
      }
      const work = selectTodayGame(works);
      if (work) {
        render(section, work);
      } else {
        showEmpty("現在ご案内できるゲームはありません。");
      }
    } catch {
      showEmpty("ゲーム情報を読み込めませんでした。作品一覧からご覧ください。");
    }
  };

  const api = { gameWorks, playableUrl, todayGameIndex, selectTodayGame };
  if (typeof module !== "undefined") {
    module.exports = api;
  }
  if (typeof document !== "undefined") {
    init();
  }
})();
