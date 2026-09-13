"use strict";
const form = document.querySelector("#search-form");
const word = document.querySelector("#word");
const destinations = {
  meaning: {url: "https://www.weblio.jp/content/", note: "言葉の意味や解説を調べます。", placeholder: "調べたい言葉を入力"},
  synonym: {url: "https://thesaurus.weblio.jp/content/", note: "類語や言い換えを調べます。", placeholder: "言い換えたい言葉を入力"},
  english: {url: "https://ejje.weblio.jp/content/", note: "英単語の意味や日本語の英訳を調べます。", placeholder: "英語または日本語を入力"}
};
function selectDictionary(value) {
  const radio = form.querySelector(`input[value="${value}"]`);
  if (!radio) return;
  radio.checked = true;
  word.placeholder = destinations[value].placeholder;
  document.querySelector("#search-note").textContent = destinations[value].note + "検索結果は本家Weblioで開きます。";
}
form.addEventListener("change", event => {
  if (event.target.name === "dictionary") selectDictionary(event.target.value);
});
word.addEventListener("input", () => word.setCustomValidity(""));
form.addEventListener("submit", event => {
  event.preventDefault();
  const query = word.value.trim();
  if (!query) {
    word.setCustomValidity("調べたい言葉を入力してください。");
    word.reportValidity();
    return;
  }
  const selected = form.querySelector('input[name="dictionary"]:checked').value;
  window.location.assign(destinations[selected].url + encodeURIComponent(query));
});
document.querySelectorAll("[data-select]").forEach(button => {
  button.addEventListener("click", () => {
    selectDictionary(button.dataset.select);
    form.scrollIntoView({block: "center", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth"});
    word.focus({preventScroll: true});
  });
});
document.querySelectorAll("[data-word]").forEach(button => {
  button.addEventListener("click", () => {
    if (button.dataset.dictionary) selectDictionary(button.dataset.dictionary);
    word.value = button.dataset.word;
    word.setCustomValidity("");
    form.requestSubmit();
  });
});
