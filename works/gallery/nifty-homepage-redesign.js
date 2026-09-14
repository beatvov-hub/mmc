"use strict";
const stories = [...document.querySelectorAll("[data-story]")];
const emptyNews = document.querySelector(".empty-news");

function filterNews(category) {
  let count = 0;
  stories.forEach(story => {
    const visible = category === "all" || story.dataset.category === category;
    story.hidden = !visible;
    if (visible) count += 1;
  });
  emptyNews.hidden = count > 0;
}

document.querySelectorAll("[data-news]").forEach(button => button.addEventListener("click", () => {
  document.querySelectorAll("[data-news]").forEach(item => item.classList.toggle("active", item === button));
  filterNews(button.dataset.news);
}));

const search = document.querySelector(".portal-search");
search.addEventListener("submit", event => {
  event.preventDefault();
  const query = document.querySelector("#portal-query").value.trim().toLowerCase();
  let count = 0;
  stories.forEach(story => {
    const visible = !query || story.textContent.toLowerCase().includes(query);
    story.hidden = !visible;
    if (visible) count += 1;
  });
  emptyNews.hidden = count > 0;
  document.querySelector("#news").scrollIntoView({behavior: "smooth", block: "start"});
});

document.querySelectorAll("[data-search]").forEach(button => button.addEventListener("click", () => {
  document.querySelector("#portal-query").value = button.dataset.search;
  search.requestSubmit();
}));
