const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {JSDOM} = require('jsdom');
const base = 'static/breach-note/';
const html = fs.readFileSync(base+'index.html','utf8');
function boot(source=html, query='') {
  const dom = new JSDOM(source, {url:'https://takecian.github.io/breach-note/'+query,runScripts:'outside-only'});
  dom.window.eval(fs.readFileSync(base+'breach-note.js','utf8'));
  dom.window.eval(fs.readFileSync(base+'app.js','utf8'));
  return dom;
}
test('production renders all 13 technical explanations and safe source links', () => {
  const dom=boot(), d=dom.window.document;
  assert.equal(d.querySelectorAll('.incident').length,13);
  assert.equal(d.querySelectorAll('.technical').length,13);
  assert.equal(d.querySelectorAll('.technical .attack-flow').length,13);
  for (const panel of d.querySelectorAll('.technical')) {
    for (const text of ['侵入口・アクセスの起点','悪用された弱点・権限','取得・持ち出しの方法と確認範囲','分かっていないこと','一般論・編集上の整理']) assert.ok(panel.textContent.includes(text));
    for (const a of panel.querySelectorAll('a')) assert.match(a.href,/^https:\/\//);
  }
  dom.window.close();
});
test('technical search, filter reset and browser-history restore work', () => {
  const dom=boot(html,'?q=Microsoft%20365'), w=dom.window, d=w.document;
  assert.ok(d.querySelectorAll('.incident').length >= 1);
  assert.ok(d.querySelector('#incidents').textContent.includes('JAXA'));
  d.querySelector('#query').value='存在しない技術用語xyz';
  d.querySelector('#query').dispatchEvent(new w.Event('input',{bubbles:true}));
  assert.equal(d.querySelectorAll('.incident').length,0);
  d.querySelector('#filters').dispatchEvent(new w.Event('reset',{bubbles:true,cancelable:true}));
  assert.equal(d.querySelectorAll('.incident').length,13);
  w.history.replaceState(null,'','?q=銀のさら');w.dispatchEvent(new w.PopStateEvent('popstate'));
  assert.equal(d.querySelectorAll('.incident').length,1);
  assert.match(d.querySelector('.technical').textContent,/ハッシュ/);
  dom.window.close();
});
test('technical strings render as text rather than markup', () => {
  const data=JSON.parse(html.match(/<script id="breach-data" type="application\/json">(.*?)<\/script>/s)[1]);
  data.incidents[0].technical.entryPoint='<img src=x onerror=alert(1)>';
  const source=html.replace(/(<script id="breach-data" type="application\/json">).*?(<\/script>)/s,(_,a,b)=>a+JSON.stringify(data).replace(/</g,'\\u003c')+b);
  const dom=boot(source), d=dom.window.document;
  assert.equal(d.querySelectorAll('.technical img').length,0);
  assert.ok(d.querySelector('#incidents').textContent.includes('<img src=x onerror=alert(1)>'));
  dom.window.close();
});
