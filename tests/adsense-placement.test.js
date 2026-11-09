const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('scripts/adsense-placement.js', 'utf8');

async function run(path, enabled, groupEnabled = true, slot = '12345') {
  let appended = 0, pushed = 0;
  const main = { appendChild() { appended++; } };
  const make = () => ({ dataset: {}, style: {}, setAttribute() {}, append() {}, remove() {} });
  const config = { enabled, client: 'ca-pub-9855736132276938', groups: {
    home: { enabled: groupEnabled, slot }, work: { enabled: groupEnabled, slot },
    forensics: { enabled: groupEnabled, slot }, learning: { enabled: false, slot }
  } };
  const routes = { '/': 'home', '/works/example': 'work', '/ai-forensics/case-example': 'forensics', '/quiz/': 'learning' };
  const context = {
    location: { pathname: path },
    fetch: async url => ({ ok: true, json: async () => url.includes('config') ? config : routes }),
    document: { querySelector: selector => selector === 'main' ? main : null, createElement: make },
    MutationObserver: class { observe() {} disconnect() {} },
    window: { adsbygoogle: { push() { pushed++; } } }
  };
  await vm.runInNewContext(source, context);
  return { appended, pushed };
}

test('disabled and unconfigured settings produce no unit', async () => {
  assert.equal((await run('/', false)).appended, 0);
  assert.equal((await run('/', true, true, '')).appended, 0);
  assert.equal((await run('/', true, false)).appended, 0);
});

test('only exact permitted routes create one unit when enabled', async () => {
  for (const path of ['/', '/works/example', '/ai-forensics/case-example']) {
    assert.deepEqual(await run(path, true), { appended: 1, pushed: 1 });
  }
  for (const path of ['/quiz/', '/quiz/g-kentei/', '/works', '/works/example/play', '/ai-forensics/', '/lounge']) {
    assert.deepEqual(await run(path, true), { appended: 0, pushed: 0 });
  }
});
