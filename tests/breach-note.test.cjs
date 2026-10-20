const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const api = require('../static/breach-note/breach-note.js');
test('production contains verified public-source incidents', () => {
  const html = fs.readFileSync('static/breach-note/index.html','utf8');
  const data = JSON.parse(html.match(/<script id="breach-data" type="application\/json">(.*?)<\/script>/s)[1]);
  api.validateData(data);
  assert.ok(data.incidents.length >= 10);
  assert.equal(data.checkedAt, '2026-10-20');
  assert.ok(data.incidents.some(item => item.disclosedAt < '2026-01-01'));
  assert.ok(data.incidents.every(item => !/example\.com|テスト専用/.test(JSON.stringify(item))));
  assert.doesNotMatch(html, /BreachNote 2026|2026年の公表情報|現在、事例データは未登録/);
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

function productionData() {
  return JSON.parse(fs.readFileSync('static/breach-note/index.html','utf8').match(/<script id="breach-data" type="application\/json">(.*?)<\/script>/s)[1]);
}
test('multi-year records and year-visible dates are supported', () => {
  const data = productionData();
  assert.equal(api.validateData(data), data);
  assert.match(api.dateLabel(data.incidents.find(x => x.disclosedAt < '2026-01-01')), /20\d{2}\//);
  assert.equal(api.isDate('2024-02-29'), true);
  assert.equal(api.isDate('2023-02-29'), false);
});
test('invalid dates, unknown classifications, unsafe quantities and duplicate ids fail closed', () => {
  const source = productionData();
  for (const patch of [
    {dates:['2027-01-01'],disclosedAt:'2027-01-01',updatedAt:'2027-01-01'},
    {dates:['2024-02-30']}, {affectedRecords:Infinity}, {affectedRecords:NaN},
    {affectedRecords:-1}, {affectedRecords:1.5}, {causeCategory:'unknown'},
    {checkedAt:'2027-01-01'}, {officialUrl:'http://example.com'}, {sourceUrl:'javascript:alert(1)'}
  ]) assert.throws(() => api.validateData({...source,incidents:[{...source.incidents[0],...patch}]}));
  assert.throws(() => api.validateData({...source,incidents:[source.incidents[0],source.incidents[0]]}));
});
test('production filters and counts preserve records without summing incompatible units', () => {
  const {incidents} = productionData();
  assert.equal(api.filterIncidents(incidents).length, incidents.length);
  assert.equal([...api.causeCounts(incidents).values()].reduce((a,b) => a+b,0),incidents.length);
  for (const item of incidents) {
    assert.ok(api.filterIncidents(incidents,{query:item.organization,from:item.disclosedAt,to:item.disclosedAt}).includes(item));
    for (const date of item.dates) assert.ok(api.dayCounts(incidents).get(date) > 0);
  }
});

test('every displayed source link has a safe HTTPS target', () => {
  const sourcePage = fs.readFileSync('static/breach-note/sources.html','utf8');
  const links = [...sourcePage.matchAll(/href="(https:[^"]+)"/g)].map(x=>x[1]);
  assert.ok(links.length >= productionData().incidents.length);
  assert.ok(links.every(url => api.safeUrl(url)));
  assert.doesNotMatch(sourcePage, /href="(?:javascript:|http:)/);
});
test('qualified first-publication dates and inline script escaping remain explicit', () => {
  const data = productionData();
  const qualified = data.incidents.find(item => item.disclosedAtQualifier);
  assert.ok(qualified);
  assert.match(api.dateLabel(qualified), /確認済み公表/);
  assert.doesNotMatch(api.dateLabel(qualified), /初報/);
  const payload = fs.readFileSync('static/breach-note/index.html','utf8').match(/<script id="breach-data" type="application\/json">(.*?)<\/script>/s)[1];
  assert.equal(payload.includes('<'), false);
});
