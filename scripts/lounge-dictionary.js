(() => {
  "use strict";

  const DATA_URL = "src/data/loungeDictionary.json";
  const SAMPLE_COUNT = 3;
  const SAMPLE_STORAGE_KEY = "loungeDictionary:lastSamples";

  const isString = (value) => typeof value === "string" && value.trim() !== "";

  const validateData = (data) => {
    if (!data || !Array.isArray(data.categories) || !Array.isArray(data.entries)) {
      return null;
    }

    const categories = data.categories.filter((category) => (
      category &&
      isString(category.id) &&
      isString(category.title) &&
      isString(category.description)
    ));
    const categoryIds = new Set(categories.map((category) => category.id));
    const entries = data.entries.filter((entry) => (
      entry &&
      isString(entry.id) &&
      categoryIds.has(entry.category) &&
      isString(entry.quote) &&
      isString(entry.context) &&
      isString(entry.speaker) &&
      isString(entry.date) &&
      isString(entry.time) &&
      isString(entry.href)
    ));

    return categories.length > 0 && entries.length > 0
      ? { categories, entries }
      : null;
  };

  const shuffle = (items) => {
    const shuffled = [...items];
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const target = Math.floor(Math.random() * (index + 1));
      [shuffled[index], shuffled[target]] = [shuffled[target], shuffled[index]];
    }
    return shuffled;
  };

  const readPreviousSampleIds = () => {
    try {
      const stored = JSON.parse(sessionStorage.getItem(SAMPLE_STORAGE_KEY) || "[]");
      return Array.isArray(stored) ? stored : [];
    } catch {
      return [];
    }
  };

  const pickSamples = (entries) => {
    const count = Math.min(SAMPLE_COUNT, entries.length);
    const previousIds = readPreviousSampleIds();
    const previousSignature = [...previousIds].sort().join("|");
    let selected = shuffle(entries).slice(0, count);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const signature = selected.map((entry) => entry.id).sort().join("|");
      if (signature !== previousSignature || entries.length <= count) {
        break;
      }
      selected = shuffle(entries).slice(0, count);
    }

    try {
      sessionStorage.setItem(
        SAMPLE_STORAGE_KEY,
        JSON.stringify(selected.map((entry) => entry.id))
      );
    } catch {
      // Random display still works when session storage is unavailable.
    }

    return selected;
  };

  const formatDateTime = (entry) => `${entry.date.replaceAll("-", ".")} ${entry.time}`;

  const createSample = (entry, categoryTitle) => {
    const article = document.createElement("article");
    const label = document.createElement("span");
    const quote = document.createElement("blockquote");
    const context = document.createElement("p");
    const meta = document.createElement("small");

    label.textContent = categoryTitle;
    quote.textContent = `「${entry.quote}」`;
    context.textContent = entry.context;
    meta.textContent = `${entry.speaker}・${formatDateTime(entry)}`;
    article.append(label, quote, context, meta);
    return article;
  };

  const renderSamples = (data) => {
    const container = document.querySelector(".lounge-dictionary-samples");
    if (!container) {
      return;
    }

    const categoryTitles = new Map(
      data.categories.map((category) => [category.id, category.title])
    );
    const fragment = document.createDocumentFragment();
    pickSamples(data.entries).forEach((entry) => {
      fragment.append(createSample(entry, categoryTitles.get(entry.category) || "ラウンジの言葉"));
    });
    container.replaceChildren(fragment);
  };

  const createDictionaryEntry = (entry) => {
    const article = document.createElement("article");
    const quote = document.createElement("blockquote");
    const context = document.createElement("p");
    const footer = document.createElement("footer");
    const speaker = document.createElement("strong");
    const source = document.createElement("a");

    article.className = "dictionary-entry";
    quote.textContent = `「${entry.quote}」`;
    context.textContent = entry.context;
    speaker.textContent = entry.speaker;
    source.href = entry.href;
    source.textContent = `${formatDateTime(entry)}の記録`;
    footer.append(speaker, source);
    article.append(quote, context, footer);
    return article;
  };

  const createDictionaryCategory = (category, entries) => {
    const section = document.createElement("section");
    const header = document.createElement("header");
    const title = document.createElement("h2");
    const description = document.createElement("p");
    const list = document.createElement("div");

    section.className = "dictionary-category";
    section.id = category.id;
    section.setAttribute("aria-labelledby", `${category.id}-title`);
    header.className = "dictionary-category-header";
    title.id = `${category.id}-title`;
    title.textContent = category.title;
    description.textContent = category.description;
    list.className = "dictionary-entry-list";
    entries.forEach((entry) => list.append(createDictionaryEntry(entry)));
    header.append(title, description);
    section.append(header, list);
    return section;
  };

  const renderDictionary = (data) => {
    const nav = document.querySelector(".dictionary-jump-nav");
    const categories = Array.from(document.querySelectorAll(".dictionary-category"));
    const back = document.querySelector(".dictionary-back");
    if (!nav || categories.length === 0 || !back) {
      return;
    }

    const navFragment = document.createDocumentFragment();
    data.categories.forEach((category) => {
      const link = document.createElement("a");
      link.href = `#${category.id}`;
      link.textContent = category.title;
      navFragment.append(link);
    });
    nav.replaceChildren(navFragment);

    const categoryFragment = document.createDocumentFragment();
    data.categories.forEach((category) => {
      const entries = data.entries.filter((entry) => entry.category === category.id);
      if (entries.length > 0) {
        categoryFragment.append(createDictionaryCategory(category, entries));
      }
    });
    categories.forEach((category) => category.remove());
    back.before(categoryFragment);
  };

  document.addEventListener("DOMContentLoaded", () => {
    fetch(DATA_URL)
      .then((response) => {
        if (!response.ok) {
          throw new Error("Failed to load lounge dictionary.");
        }
        return response.json();
      })
      .then(validateData)
      .then((data) => {
        if (!data) {
          throw new Error("Invalid lounge dictionary data.");
        }
        renderSamples(data);
        renderDictionary(data);
      })
      .catch(() => {
        // Keep the static HTML as a readable fallback.
      });
  });
})();
