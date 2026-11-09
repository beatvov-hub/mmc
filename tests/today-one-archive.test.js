const test = require('node:test');
const assert = require('node:assert/strict');
const archive = require('../scripts/today-one-archive.js');
const entries = [
  {date:'2026-11-01',name:'Python Tool',category:'開発',search:'Python 調査 アキト'},
  {date:'2026-10-01',name:'Image Tool',category:'デザイン',search:'画像素材 ゲーム制作'},
  {date:'2026-09-01',name:'Search Tool',category:'調査',search:'調査 Python'}
];
test('search, category and order combine, including full width text', () => {
  assert.deepEqual(archive.filterEntries(entries,{query:'Ｐｙｔｈｏｎ',category:'調査',order:'new'}).map(e=>e.name),['Search Tool']);
  assert.deepEqual(archive.filterEntries(entries,{query:'調査',category:'',order:'old'}).map(e=>e.name),['Search Tool','Python Tool']);
  assert.equal(archive.filterEntries(entries,{query:'見つからない',category:'',order:'new'}).length,0);
  assert.deepEqual(archive.filterEntries(entries,{query:'画像素材を探したい',category:'',order:'new'}).map(e=>e.name),['Image Tool']);
  assert.equal(archive.filterEntries(entries,{query:'',category:'',order:'new'}).length,3);
});
test('card escapes content and links to its existing detail', () => {
  const card=archive.renderCard({name:'<tool>',date:'2026-11-01',category:'開発',type:'OSS',summary:'summary',url:'2026-11-01-tool',search:''});
  assert.match(card,/&lt;tool&gt;/); assert.match(card,/href="2026-11-01-tool"/);
});

test('controls update results, reset filters and expose more entries', () => {
  function control(value = '') { return { value, hidden:false, dataset:{}, handlers:{}, addEventListener(name,fn){this.handlers[name]=fn}, focus(){this.focused=true}, setAttribute(){}, classList:{toggle(){}} }; }
  const search=control(), sort=control('new'), reset=control(), more=control(), result=control(), empty=control();
  const all=control(), chip=control(); all.dataset.category=''; chip.dataset.category='調査';
  const grid={innerHTML:''}, lookup={'[data-archive-grid]':grid,'[data-archive-search]':search,'[data-archive-sort]':sort,'[data-archive-reset]':reset,'[data-archive-result]':result,'[data-archive-empty]':empty,'[data-archive-more]':more};
  const root={querySelector:s=>lookup[s],querySelectorAll:()=>[all,chip]};
  const populated=entries.map(e=>({...e,type:'OSS',summary:'example',url:'example'}));
  archive.init({querySelector:s=>s==='#tool-directory-data'?{textContent:JSON.stringify(populated)}:root});
  chip.handlers.click(); assert.equal(result.textContent,'1件中 1件を表示');
  search.value='ない'; search.handlers.input(); assert.equal(empty.hidden,false);
  reset.handlers.click(); assert.equal(result.textContent,'3件中 3件を表示'); assert.equal(empty.hidden,true); assert.equal(search.focused,true);
});
