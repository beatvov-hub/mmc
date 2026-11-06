(function () {
  "use strict";
  const section = document.querySelector("#profile-conversation-history[data-member-slug]");
  const script = document.currentScript;
  if (!section || !script) return;
  const list = section.querySelector("ol");
  if (!list) return;

  fetch(new URL("../lounge/member-conversations.json", script.src))
    .then((response) => {
      if (!response.ok) throw new Error("Conversation index unavailable");
      return response.json();
    })
    .then((index) => {
      const entries = Array.isArray(index[section.dataset.memberSlug]) ? index[section.dataset.memberSlug] : [];
      const eligible = entries.filter((entry) => {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.date) || !/^[\w-]+$/.test(entry.id)) return false;
        const time = /^\d{1,2}:\d{2}$/.test(entry.time) ? entry.time.padStart(5, "0") : "00:00";
        return Date.parse(`${entry.date}T${time}:00+09:00`) <= Date.now();
      });
      for (let i = eligible.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [eligible[i], eligible[j]] = [eligible[j], eligible[i]];
      }
      const selected = eligible.slice(0, 3);
      if (!selected.length) {
        const item = document.createElement("li");
        item.textContent = "参加した過去の会話はまだありません。";
        list.replaceChildren(item);
        return;
      }
      const items = selected.map((entry) => {
        const item = document.createElement("li");
        const link = document.createElement("a");
        link.href = new URL(`../lounge-archive/${entry.date}#${entry.id}`, script.src).href;
        const time = document.createElement("time");
        time.dateTime = `${entry.date}T${entry.time.padStart(5, "0")}`;
        time.textContent = `${entry.date.replaceAll("-", ".")} ${entry.time}`;
        const title = document.createElement("strong");
        title.textContent = entry.title;
        const description = document.createElement("span");
        description.textContent = entry.description;
        link.append(time, title, description);
        item.appendChild(link);
        return item;
      });
      list.replaceChildren(...items);
    })
    .catch(() => { /* Keep the existing links when the index cannot be loaded. */ });
})();
