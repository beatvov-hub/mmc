"use strict";
const articles = [...document.querySelectorAll("[data-article]")];
const categoryButtons = [...document.querySelectorAll("[data-category]")];
const emptyState = document.querySelector("#empty-state");
const latestPanel = document.querySelector(".latest-panel");
const rankings = {
  hour: ["PowerToysに追加されたローカルAI機能を試してみた", "無料PDF編集ソフトの新定番を検証", "Claude CodeプラグインがUnityに対応", "GitLabの緊急パッチが公開", "Edge安定版がアップデート"],
  day: ["Windows 11の便利な新機能10選", "7-Zip最新版で変わったこと", "生成AIをPC作業で使うコツ", "無料バックアップソフト比較", "VS Codeおすすめ拡張機能"],
  week: ["最新版 定番フリーソフト30選", "Windowsを軽くする設定ガイド", "仕事に役立つAIツール特集", "安全なパスワード管理入門", "写真編集ソフト徹底比較"]
};

function renderRanking(period) {
  document.querySelector("#ranking-list").innerHTML = rankings[period].map((title, index) => `<li><span>${index + 1}</span><a href="#latest">${title}</a></li>`).join("");
}

categoryButtons.forEach(button => button.addEventListener("click", () => {
  categoryButtons.forEach(item => item.classList.toggle("active", item === button));
  const category = button.dataset.category;
  let count = 0;
  articles.forEach(article => {
    const visible = category === "all" || article.dataset.category.split(" ").includes(category);
    article.hidden = !visible;
    if (visible) count += 1;
  });
  emptyState.hidden = count > 0;
  document.querySelector("#latest").scrollIntoView({behavior: "smooth", block: "start"});
}));

document.querySelector("#show-all").addEventListener("click", event => {
  latestPanel.classList.toggle("expanded");
  event.currentTarget.textContent = latestPanel.classList.contains("expanded") ? "閉じる" : "一覧を見る";
});

document.querySelectorAll("[data-period]").forEach(button => button.addEventListener("click", () => {
  document.querySelectorAll("[data-period]").forEach(item => item.classList.toggle("active", item === button));
  renderRanking(button.dataset.period);
}));

document.querySelector(".site-search").addEventListener("submit", event => {
  event.preventDefault();
  const query = document.querySelector("#site-query").value.trim().toLowerCase();
  let count = 0;
  articles.forEach(article => {
    const visible = !query || article.textContent.toLowerCase().includes(query);
    article.hidden = !visible;
    if (visible) count += 1;
  });
  emptyState.hidden = count > 0;
  document.querySelector("#latest").scrollIntoView({behavior: "smooth", block: "start"});
});

renderRanking("hour");
