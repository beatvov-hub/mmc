const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function button() {
  const listeners = {};
  const attributes = {};
  const classes = new Set();
  return {
    hidden: false,
    attributes,
    classes,
    classList: {
      toggle(name, enabled) {
        if (enabled) classes.add(name);
        else classes.delete(name);
      },
    },
    setAttribute(name, value) { attributes[name] = value; },
    addEventListener(name, listener) { listeners[name] = listener; },
    click() { listeners.click?.(); },
  };
}

function quizWidget() {
  const choices = Array.from({ length: 4 }, button);
  const reveal = button();
  const answer = { hidden: true, attributes: {}, focused: false,
    setAttribute(name, value) { this.attributes[name] = value; },
    focus() { this.focused = true; },
  };
  return {
    choices, reveal, answer,
    querySelectorAll() { return choices; },
    querySelector(selector) {
      return selector === '[data-quiz-reveal]' ? reveal : answer;
    },
  };
}

test('複数の問題で選択と答えの表示が互いに独立する', () => {
  const widgets = [quizWidget(), quizWidget()];
  const source = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'daily-quiz.js'), 'utf8');
  vm.runInNewContext(source, {
    document: { querySelectorAll: () => widgets },
  });

  widgets[0].choices[1].click();
  assert.equal(widgets[0].choices[1].attributes['aria-pressed'], 'true');
  assert.equal(widgets[0].choices[0].attributes['aria-pressed'], 'false');
  assert.equal(widgets[1].choices[1].attributes['aria-pressed'], undefined);

  widgets[0].reveal.click();
  assert.equal(widgets[0].answer.hidden, false);
  assert.equal(widgets[0].reveal.hidden, true);
  assert.equal(widgets[0].answer.focused, true);
  assert.equal(widgets[1].answer.hidden, true);

  widgets[1].choices[2].click();
  widgets[1].reveal.click();
  assert.equal(widgets[1].choices[2].attributes['aria-pressed'], 'true');
  assert.equal(widgets[1].answer.hidden, false);
});
