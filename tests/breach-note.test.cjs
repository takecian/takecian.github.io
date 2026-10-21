const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const api = require('../static/breach-note/breach-note.js');
test('production contains verified public-source incidents', () => {
  const html = fs.readFileSync('static/breach-note/index.html','utf8');
  const data = JSON.parse(html.match(/<script id="breach-data" type="application\/json">(.*?)<\/script>/s)[1]);
  api.validateData(data);
  assert.ok(data.incidents.length >= 10);
  assert.equal(data.checkedAt, '2026-10-21');
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
  assert.deepEqual(api.readFilters('?cause=invalid&scale=invalid&from=2026-02-30'),{cause:'',status:'',sector:'',region:'',scale:'',from:'',to:'',query:''});
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
  ]) assert.throws(() => api.validateData({...source,coverage:undefined,incidents:[{...source.incidents[0],...patch}]}));
  assert.throws(() => api.validateData({...source,coverage:undefined,incidents:[source.incidents[0],source.incidents[0]]}));
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

test('Ride On Express preserves possible scope, record units and publication chronology', () => {
  const item = productionData().incidents.find(x => x.id === 'ride-on-express-2026-ransomware');
  assert.ok(item);
  assert.equal(item.impactStatus, '漏えいのおそれ');
  assert.equal(item.affectedRecords, 6500000);
  assert.match(item.scaleLabel, /最大約650万件.*確定件数ではない/);
  assert.equal(item.disclosedAt, '2026-10-07');
  assert.deepEqual(item.dates, ['2026-10-07','2026-10-08','2026-10-09','2026-10-13']);
  assert.match(item.summary, /10月13日.*可能性/);
  assert.match(item.summary, /カード情報は含まれない/);
  assert.equal(api.filterIncidents(productionData().incidents, {query:'銀のさら',scale:'1m_plus'}).length, 1);
  const sources = fs.readFileSync('static/breach-note/sources.html','utf8');
  for (const url of [item.officialUrl,item.sourceUrl,'https://www.rideonexpresshd.co.jp/news/2026/10/post-484.html']) assert.ok(sources.includes(url));
});

test('all production incidents provide sourced technical explanations without changing impact units', () => {
  const data = productionData();
  assert.ok(data.incidents.length > 13);
  for (const item of data.incidents) {
    assert.ok(item.technical, item.id);
    assert.ok(item.technical.attackFlow.length >= 2);
    assert.ok(item.technical.sources.length >= 1);
    assert.ok(item.technical.unknowns.length > 10);
    assert.ok(item.technical.interpretation.length > 10);
  }
  assert.equal(api.validateData(data), data);
});
test('technical text is searchable and unsafe or incomplete technical records fail closed', () => {
  const data = productionData();
  const item = data.incidents[0];
  assert.equal(api.matches({...item,technical:{...item.technical,entryPoint:'technical-search-unique'}}, {query:'technical-search-unique'}), true);
  for (const patch of [{entryPoint:''}, {attackFlow:[]}, {sources:[]}, {sources:[{title:'Invalid',url:'javascript:alert(1)',date:null,locator:'test'}]}]) {
    assert.throws(() => api.validateData({...data,coverage:undefined,incidents:[{...item,technical:{...item.technical,...patch}}]}));
  }
  const app = fs.readFileSync('static/breach-note/app.js','utf8');
  assert.doesNotMatch(app, /innerHTML\s*=/);
  assert.match(app, /分かっていないこと/);
  assert.match(app, /一般論・編集上の整理/);
});

test('confirmation status filters remain separate from scale and cause', () => {
  const data=productionData();
  for (const status of api.IMPACT_STATUSES) {
    const expected=data.incidents.filter(item=>item.impactStatus===status);
    assert.equal(api.filterIncidents(data.incidents,{status}).length,expected.length);
    assert.equal(api.readFilters('?status='+encodeURIComponent(status)).status,status);
  }
  assert.equal(api.readFilters('?status=untrusted').status,'');
  assert.ok(api.CAUSE_CATEGORIES.includes('調査中・原因不明'));
});

test('historical examples and six-month coverage remain separate and correctly counted', () => {
  const data=productionData();
  const originals=["kadokawa-2024-ransomware", "ntt-west-group-2023-insider", "line-yahoo-2023-unauthorized-access", "jaxa-2023-2024-unauthorized-access", "toyota-2023-cloud-exposure", "casio-2024-ransomware", "benesse-2014", "japan-pension-service-2015", "haj-2016", "uniqlo-gu-2019", "paypay-merchant-server-2020", "amagasaki-usb-2022", "ride-on-express-2026-ransomware"];
  for (const id of originals) assert.ok(data.incidents.some(item=>item.id===id),id);
  assert.equal(data.coverage.from,'2026-04-21');
  assert.equal(data.coverage.to,'2026-10-21');
  assert.equal(data.coverage.exhaustive,false);
  const inPeriod=api.filterIncidents(data.incidents,{from:data.coverage.from,to:data.coverage.to});
  assert.equal(data.coverage.periodTotal,inPeriod.length);
  for (const item of data.incidents.filter(item=>!originals.includes(item.id))) {
    assert.ok(inPeriod.includes(item),item.id);
    assert.equal(item.checkedAt,'2026-10-21');
    assert.ok(item.technical.sources.every(source=>source.date===null || source.date<=item.checkedAt));
  }
  for (const patch of [{periodTotal:0},{firstVerifiedPublicationInPeriod:-1},{olderWithFollowupsInPeriod:999},{from:'2026-10-22'},{to:'2026-10-22'},{exhaustive:true}]) {
    assert.throws(()=>api.validateData({...data,coverage:{...data.coverage,...patch}}));
  }
  const sourcePage=fs.readFileSync('static/breach-note/sources.html','utf8');
  assert.match(sourcePage,/id="coverage-methodology"/);
  assert.match(sourcePage,/全件網羅を保証しません/);
  assert.match(sourcePage,/全事例の被害人数は合算しません/);
  for (const item of data.incidents.filter(item=>!originals.includes(item.id))) {
    assert.ok(sourcePage.includes(item.officialUrl.replace(/&/g,'&amp;')),item.id+' official URL');
    assert.ok(sourcePage.includes(item.sourceUrl.replace(/&/g,'&amp;')),item.id+' source URL');
  }
});

test('later corrections retain the original measurement units and unknown totals', () => {
  const {incidents}=productionData();
  const byId=id=>incidents.find(item=>item.id===id);
  const kddi=byId('kddi-isp-mail-2026');
  assert.equal(kddi.affectedRecords,12231954);
  assert.match(kddi.scaleLabel,/7,616,173.*内数/);
  assert.equal(byId('moneyforward-2026-github').affectedRecords,0);
  assert.match(byId('moneyforward-2026-github').scaleLabel,/合算不可/);
  assert.equal(byId('estore-shopserve-2026').affectedRecords,23356000);
  assert.equal(byId('epark-peakmanager-2026').affectedRecords,22180000);
  assert.match(byId('epark-peakmanager-2026').scaleLabel,/人数ではない/);
  assert.equal(byId('seiho-contract-inquiry-2026').affectedRecords,27407);
  assert.match(byId('seiho-contract-inquiry-2026').scaleLabel,/重複除外/);
  assert.equal(byId('sakura-2026-sales-system').affectedRecords,1360563);
  assert.match(byId('sakura-2026-sales-system').scaleLabel,/アカウント/);
  assert.equal(byId('aflac-2026-web-query').affectedRecords,4400000);
});
