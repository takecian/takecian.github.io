const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const api = require('../static/breach-note/breach-note.js');
test('production starts without fabricated incidents or check date', () => {
  const html = fs.readFileSync('static/breach-note/index.html','utf8');
  const data = JSON.parse(html.match(/<script id="breach-data" type="application\/json">(.*?)<\/script>/s)[1]);
  assert.deepEqual(data, {year:2026,checkedAt:null,incidents:[]});
  assert.match(html, /https:\/\/takecian.github.io\/breach-note\//);
  for (const name of ['app.js','breach-note.js','style.css']) assert.ok(fs.existsSync('static/breach-note/'+name));
});
test('existing filters use AND words, follow-up dates and inclusive thresholds', () => {
  const item = {organization:'Test Company',service:'API',title:'',summary:'',causeDetail:'',causeCategory:api.CAUSE_CATEGORIES[0],sector:api.SECTORS[0],region:'国内',affectedRecords:100000,dates:['2026-01-01','2026-02-01'],disclosedAt:'2026-01-01'};
  assert.equal(api.matches(item,{query:'ＴＥＳＴ API',from:'2026-02-01',to:'2026-02-01',scale:'100k_plus'}),true);
  assert.equal(api.matches(item,{query:'TEST missing'}),false);
  assert.equal(api.matches(item,{scale:'1m_plus'}),false);
  assert.equal(api.matches(item,{scale:'under_10k'}),false);
  assert.equal(api.matches({...item,affectedRecords:0},{scale:'under_10k'}),true);
});
test('invalid URLs and query values are rejected', () => {
  assert.equal(api.safeUrl('javascript:alert(1)'),null);
  assert.equal(api.safeUrl('https://user:pass@example.com'),null);
  assert.deepEqual(api.readFilters('?cause=invalid&scale=invalid&from=2026-02-30'),{cause:'',sector:'',region:'',scale:'',from:'',to:'',query:''});
});
test('October diary is draft', () => {
  assert.match(fs.readFileSync('content/posts/2026-10-31_diary.md','utf8'),/^draft: true$/m);
});
