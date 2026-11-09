(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root && root.document) api.init(root.document);
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const normalize = value => String(value || '').normalize('NFKC').toLocaleLowerCase('ja').trim();
  const escape = value => String(value || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function filterEntries(entries, filters) {
    const words = normalize(filters.query).replace(/を探したい|を探す|を調べたい|を使いたい|を作りたい/g, '').split(/\s+/).filter(Boolean);
    return entries.filter(entry => (!filters.category || entry.category === filters.category) && words.every(word => normalize(entry.search).includes(word)))
      .slice().sort((a, b) => filters.order === 'old' ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date));
  }
  function renderCard(r) {
    const detail = (label, value) => value ? `<div><dt>${label}</dt><dd>${escape(value)}</dd></div>` : '';
    return `<article class="tool-card" data-archive-card><div class="tool-card-meta"><span>${escape(r.category)}</span><span>${escape(r.type)}</span><time datetime="${escape(r.date)}">${escape(r.date.replaceAll('-', '.'))}</time></div><h3>${escape(r.name)}</h3><p class="tool-card-summary">${escape(r.summary)}</p><dl>${detail('こんな場面に',r.use)}${detail('向いている人',r.audience)}${detail('導入前に',r.caution)}</dl><div class="tool-card-bottom"><p>${r.employee ? '推薦：'+escape(r.employee) : ''}${r.checked ? '　情報確認：'+escape(r.checked) : ''}</p><a href="${escape(r.url)}">詳細を見る <span aria-hidden="true">→</span></a></div></article>`;
  }
  function init(document) {
    const root = document.querySelector('[data-today-one-archive]');
    const data = document.querySelector('#tool-directory-data');
    if (!root || !data) return;
    let entries;
    try { entries = JSON.parse(data.textContent); } catch (_) { return; }
    const grid = root.querySelector('[data-archive-grid]'), search = root.querySelector('[data-archive-search]');
    const sort = root.querySelector('[data-archive-sort]'), reset = root.querySelector('[data-archive-reset]');
    const result = root.querySelector('[data-archive-result]'), empty = root.querySelector('[data-archive-empty]');
    const more = root.querySelector('[data-archive-more]'), chips = [...root.querySelectorAll('[data-category]')];
    let category = '', limit = 12;
    function update() {
      const matched = filterEntries(entries, {query:search.value, category, order:sort.value});
      grid.innerHTML = matched.slice(0, limit).map(renderCard).join('');
      result.textContent = `${matched.length}件中 ${Math.min(limit, matched.length)}件を表示`;
      empty.hidden = matched.length > 0;
      more.hidden = limit >= matched.length;
      chips.forEach(chip => { const active = chip.dataset.category === category; chip.classList.toggle('is-active', active); chip.setAttribute('aria-pressed', String(active)); });
    }
    search.addEventListener('input', () => { limit = 12; update(); });
    sort.addEventListener('change', () => { limit = 12; update(); });
    chips.forEach(chip => chip.addEventListener('click', () => { category = chip.dataset.category; limit = 12; update(); }));
    reset.addEventListener('click', () => { search.value = ''; sort.value = 'new'; category = ''; limit = 12; update(); search.focus(); });
    more.addEventListener('click', () => { limit += 12; update(); });
    update();
  }
  return { normalize, filterEntries, renderCard, init };
});
