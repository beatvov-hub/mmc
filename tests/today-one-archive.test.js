const test = require('node:test');
const assert = require('node:assert/strict');
const archive = require('../scripts/today-one-archive.js');

test('archive filters combine month, purpose and recommended employee', () => {
  const cards = [
    { dataset: { month: '2026-10', useCategory: 'AI活用・AI開発', employee: 'MMC-008' } },
    { dataset: { month: '2026-10', useCategory: '開発・テスト', employee: 'MMC-008' } },
    { dataset: { month: '2026-09', useCategory: 'AI活用・AI開発', employee: 'MMC-011' } }
  ];
  assert.equal(archive.applyFilters(cards, { month: '2026-10', useCategory: '', employee: '' }), 2);
  assert.deepEqual(cards.map(card => card.hidden), [false, false, true]);
  assert.equal(archive.applyFilters(cards, { month: '2026-10', useCategory: 'AI活用・AI開発', employee: 'MMC-008' }), 1);
  assert.deepEqual(cards.map(card => card.hidden), [false, true, true]);
  assert.equal(archive.applyFilters(cards, { month: '2025-01', useCategory: '', employee: '' }), 0);
  assert.deepEqual(cards.map(card => card.hidden), [true, true, true]);
});

test('archive filter controls update the result count and reset selections', () => {
  const fields = ['month', 'useCategory', 'employee'].map(name => ({
    dataset: { archiveFilter: name }, value: '', handlers: {},
    addEventListener(event, handler) { this.handlers[event] = handler; },
    focus() { this.focused = true; }
  }));
  const cards = [
    { dataset: { month: '2026-10', useCategory: 'AI活用・AI開発', employee: 'MMC-008' } },
    { dataset: { month: '2026-09', useCategory: '開発・テスト', employee: 'MMC-011' } }
  ];
  const result = { textContent: '' }, empty = { hidden: true }, reset = { handlers: {}, addEventListener(event, handler) { this.handlers[event] = handler; } };
  const archiveRoot = {
    querySelectorAll(selector) { return selector === '[data-archive-filter]' ? fields : cards; },
    querySelector(selector) { return selector === '[data-archive-result]' ? result : selector === '[data-archive-empty]' ? empty : reset; }
  };
  archive.init({ querySelector() { return archiveRoot; } });
  assert.equal(result.textContent, '2件を表示中');
  fields[0].value = '2026-10';
  fields[0].handlers.change();
  assert.equal(result.textContent, '1件を表示中');
  assert.equal(empty.hidden, true);
  fields[0].value = '2025-01';
  fields[0].handlers.change();
  assert.equal(result.textContent, '0件を表示中');
  assert.equal(empty.hidden, false);
  reset.handlers.click();
  assert.equal(result.textContent, '2件を表示中');
  assert.equal(fields[0].focused, true);
});
