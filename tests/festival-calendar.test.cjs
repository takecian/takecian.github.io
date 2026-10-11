const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '../static/festival-calendar');
const core = require(path.join(root, 'calendar.js'));
const data = JSON.parse(fs.readFileSync(path.join(root, 'festivals.json'), 'utf8'));
const fixture = {id:'test', name:'テスト祭', university:'テスト大学', campus:'本部キャンパス', prefecture:'東京都', dates:['2026-11-01','2026-11-03'], startDate:'2026-11-01', endDate:'2026-11-03', officialUrl:'https://example.com/', sourceUrl:'https://example.com/dates', checkedAt:'2026-10-11'};

test('dataset has expanded official-sourced coverage across 8 regions', () => {
  assert.equal(core.validateData(data), data);
  assert(data.festivals.length >= 150);
  assert(new Set(data.festivals.map(x => x.university)).size >= 90);
  assert(new Set(data.festivals.map(x => x.prefecture)).size >= 43);
  assert.equal(new Set(data.festivals.map(x => x.region)).size, 8);
  assert.equal(core.PREFECTURES.length, 47);
  assert.match(data.scope, /網羅するものではありません/);
});
test('named university coverage includes former imperial universities and major private universities', () => {
  const universities = new Set(data.festivals.map(item => item.university));
  for (const university of [
    '北海道大学', '東北大学', '東京大学', '名古屋大学', '京都大学', '大阪大学', '九州大学',
    '東京科学大学', '一橋大学', '国際基督教大学', '早稲田大学', '慶應義塾大学', '上智大学',
    '東京理科大学', '明治大学', '青山学院大学', '立教大学', '中央大学', '法政大学',
    '関西大学', '関西学院大学', '同志社大学', '立命館大学',
    '國學院大學', '成蹊大学', '武蔵大学', '明治学院大学', '東洋大学',
    '神戸大学', '横浜国立大学', '横浜市立大学', '東京都立大学', '大阪公立大学',
    '名古屋市立大学', '名古屋工業大学', '東京学芸大学', '東京農工大学'
  ]) assert(universities.has(university), `Missing university: ${university}`);
  assert(core.filterFestivals(data.festivals, {query:'ICU'}).some(item => item.university === '国際基督教大学'));
  assert(core.filterFestivals(data.festivals, {query:'科学大'}).some(item => item.university === '東京科学大学'));
});
test('documented snapshot counts match the actual dataset', () => {
  const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
  const universities = new Set(data.festivals.map(item => item.university)).size;
  const prefectures = new Set(data.festivals.map(item => item.prefecture)).size;
  assert(readme.includes(`contains ${data.festivals.length}\nfestivals from ${universities} universities in ${prefectures} prefectures`));
});
test('newly requested university campuses retain their confirmed 2026 dates', () => {
  const expected = {
    'science-tokyo-koudaisai-2026': ['2026-10-10', '2026-10-11'],
    'science-tokyo-ochanomizusai-2026': ['2026-10-17', '2026-10-18'],
    'icu-fes-2026': ['2026-10-11', '2026-10-12'],
    'tus-kagurazaka-2026': ['2026-11-20', '2026-11-21'],
    'tus-noda-2026': ['2026-11-20', '2026-11-21'],
    'tus-katsushika-2026': ['2026-11-20', '2026-11-21'],
    'kwansei-shingetsusai-sanda-2026': ['2026-10-24', '2026-10-25'],
    'kwansei-shingetsusai-uegahara-2026': ['2026-11-07', '2026-11-08'],
    'kwansei-shingetsusai-seiwa-2026': ['2026-11-14', '2026-11-15']
  };
  for (const [id, dates] of Object.entries(expected)) {
    const item = data.festivals.find(item => item.id === id);
    assert(item, `Missing campus festival: ${id}`);
    assert.deepEqual(item.dates, dates, id);
    for (const day of dates) assert(core.matches(item, {prefecture:item.prefecture, from:day, to:day, query:item.university}), id);
  }
});
test('Hoshi festival retains its verified 2026 dates and source', () => {
  const event = data.festivals.find(item => item.id === 'hoshiyakufes-2026');
  assert.deepEqual(event.dates, ['2026-10-24', '2026-10-25']);
  assert.equal(event.sourceUrl, 'https://www.hoshi.ac.jp/admission/opencampus/');
  for (const day of event.dates) assert(core.filterFestivals(data.festivals, {prefecture:'東京都',from:day,to:day}).some(item => item.id === event.id));
});
test('Todai May Festival excludes the officially cancelled day', () => {
  const event = data.festivals.find(item => item.id === 'utokyo-mayfes-2026');
  assert.deepEqual(event.dates, ['2026-05-17']);
  assert(!core.matches(event, {from:'2026-05-16', to:'2026-05-16'}));
  assert(core.matches(event, {from:'2026-05-17', to:'2026-05-17'}));
  assert.equal(event.sourceUrl, 'https://www.u-tokyo.ac.jp/focus/ja/articles/z0508_00144.html');
  assert.match(event.notes, /16日の全企画中止/);
});
test('public page has no raw JSON download links and retains the data-backed calendar', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert(!html.includes('掲載データ（JSON）'));
  assert(!/<a\b[^>]*href=["']festivals\.json["']/i.test(html));
  assert(html.includes('id="checked-at"'));
  assert(fs.readFileSync(path.join(root, 'app.js'), 'utf8').includes("fetch('festivals.json'"));
});
test('all records retain official sources and distinct university-campus events', () => {
  const identities = new Set();
  for (const item of data.festivals) {
    assert(['大学公式', '実行委員会公式', '大学公式・実行委員会公式'].includes(item.sourceType), item.id);
    assert(item.region && typeof item.region === 'string', item.id);
    assert.match(item.id, /^[a-z0-9]+(?:-[a-z0-9]+)*-2026$/, item.id);
    assert.deepEqual(item.dates, [...item.dates].sort(), item.id);
    assert(item.checkedAt <= data.checkedAt, item.id);
    const identity = [item.university, item.campus, item.startDate, item.endDate].join('|');
    assert(!identities.has(identity), `Duplicate campus festival: ${identity}`);
    identities.add(identity);
    for (const source of item.additionalSources || []) assert(core.safeUrl(source), item.id);
  }
});
test('inclusive single-day and range matching checks actual days, including nonconsecutive festivals', () => {
  assert(core.matches(fixture, {from:'2026-11-01',to:'2026-11-01'}));
  assert(core.matches(fixture, {from:'2026-11-03',to:'2026-11-03'}));
  assert(!core.matches(fixture, {from:'2026-11-02',to:'2026-11-02'}));
  assert(core.matches(fixture, {from:'2026-10-31',to:'2026-11-02'}));
  assert(!core.matches(fixture, {from:'2026-11-04'}));
  assert(!core.matches(fixture, {to:'2026-10-31'}));
});
test('prefecture, dates and normalized search compose with AND', () => {
  assert(core.matches(fixture, {prefecture:'東京都',from:'2026-11-03',to:'2026-11-03',query:'ﾃｽﾄ 本部'}));
  assert(!core.matches(fixture, {prefecture:'大阪府',query:'テスト'}));
  assert(!core.matches(fixture, {prefecture:'東京都',query:'テスト 存在しない'}));
  const matching = core.filterFestivals(data.festivals, {prefecture:'東京都',from:'2026-11-01',to:'2026-11-03'});
  assert(matching.length > 0);
  assert(matching.every(x => x.prefecture === '東京都' && x.dates.some(d => d >= '2026-11-01' && d <= '2026-11-03')));
});
test('sorting is deterministic and does not mutate the dataset', () => {
  const before = data.festivals.map(x => x.id);
  const result = core.filterFestivals([...data.festivals].reverse());
  for (let i=1;i<result.length;i++) assert(result[i-1].startDate <= result[i].startDate);
  assert.deepEqual(data.festivals.map(x=>x.id), before);
});
test('calendar is Monday-first and has complete rows for edge months', () => {
  for (let month=1;month<=12;month++) {
    const cells=core.monthCells(2026,month);
    assert.equal(cells.length%7,0);
    assert.equal(cells.filter(Boolean).length,new Date(Date.UTC(2026,month,0)).getUTCDate());
  }
  assert.equal(core.monthCells(2026,11)[6],'2026-11-01');
  assert.equal(core.monthCells(2026,6)[0],'2026-06-01');
  assert.equal(core.monthCells(2026,2).filter(Boolean).length,28);
});
test('calendar counts actual occurrences and dates format without timezone shifts', () => {
  const counts=core.dayCounts([fixture,fixture]);
  assert.equal(counts.get('2026-11-01'),2);assert.equal(counts.get('2026-11-02'),undefined);
  assert.equal(core.shortDate('2026-11-01'),'11/1（日）');
  assert.equal(core.dateLabel(fixture),'11/1（日）・11/3（火）');
  assert.equal(core.dateLabel({...fixture,dates:['2026-11-01','2026-11-02']}),'11/1（日） – 11/2（月）');
});
test('Japan today advances at JST midnight regardless of runtime timezone', () => {
  assert.equal(core.japanToday(new Date('2026-10-10T14:59:59Z')),'2026-10-10');
  assert.equal(core.japanToday(new Date('2026-10-10T15:00:00Z')),'2026-10-11');
});
test('date and URL validation reject invalid dates and executable URLs', () => {
  for (const date of ['2026-02-29','2026-13-01','2026-2-1','oops']) assert(!core.isDate(date));
  assert(core.isDate('2024-02-29'));
  for (const url of ['javascript:alert(1)','data:text/html,x','http://example.com/','https://secret@example.com/']) assert.equal(core.safeUrl(url),null);
  assert.equal(core.safeUrl('https://example.com/x'),'https://example.com/x');
  assert.throws(()=>core.validateData({...data,festivals:[{...fixture,dates:['2026-02-29']}]}));
  assert.throws(()=>core.validateData({...data,festivals:[fixture,fixture]}));
});
test('URL filter restoration accepts only known prefectures and valid dates', () => {
  assert.deepEqual(core.readFilters('?prefecture=東京都&from=2026-11-01&to=2026-11-03&q=早稲田'),{prefecture:'東京都',from:'2026-11-01',to:'2026-11-03',query:'早稲田'});
  assert.deepEqual(core.readFilters('?prefecture=foo&from=2026-02-29&to=nope'),{prefecture:'',from:'',to:'',query:''});
  assert.equal(core.readFilters('?q='+'a'.repeat(150)).query.length,100);
});

// Exercise the production app with a minimal, dependency-free DOM. Browser
// layout and native input behavior are covered separately by the browser test.
async function setup({search='', failures=0, payload=data}={}) {
  const elements={}; let active=null; const windowEvents={};
  class Element {
    constructor(tag='div'){this.tagName=tag.toUpperCase();this.children=[];this.attributes={};this.listeners={};this.value='';this.disabled=false;this.hidden=false;this.dataset={};this.textContent='';this.className='';}
    append(...nodes){this.children.push(...nodes);}
    replaceChildren(...nodes){this.children=[...nodes];}
    get firstChild(){return this.children[0];}
    setAttribute(name,value){this.attributes[name]=String(value);}
    addEventListener(name,fn){(this.listeners[name] ||= []).push(fn);}
    fire(name){return Promise.all((this.listeners[name]||[]).map(fn=>fn({target:this,preventDefault(){}})));}
    focus(){active=this;}
    querySelector(selector){const date=selector.match(/data-date="([^"]+)"/)[1];return this.children.find(x=>x.dataset.date===date);}
  }
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  for(const match of html.matchAll(/<([a-z]+)[^>]*\bid="([^"]+)"[^>]*>/g)) elements[match[2]]=new Element(match[1]);
  const document={getElementById:id=>elements[id],createElement:tag=>new Element(tag)};
  const location={href:'https://example.com/festival-calendar/'+search,search};
  const history={replaceState(_state,_unused,url){location.href=String(url);location.search=new URL(url).search;}};
  let requests=0;
  const window={FestivalCalendar:core,location,history,addEventListener(name,fn){windowEvents[name]=fn;}};
  const context=vm.createContext({window,document,URL,URLSearchParams,Date,Map,Set,console,fetch:async()=>{requests++;if(requests<=failures)throw new Error('network unavailable');return {ok:true,json:async()=>payload};}});
  vm.runInContext(fs.readFileSync(path.join(root,'app.js'),'utf8'),context);
  await new Promise(resolve=>setImmediate(resolve));
  return {e:elements,window,events:windowEvents,active:()=>active,requests:()=>requests};
}
test('app loads records, source links, all prefectures and coverage; no executable markup',async()=>{
  const {e}=await setup();assert.equal(e['festival-list'].children.length,data.festivals.length);assert.equal(e.prefecture.children.length,48);assert.equal(e.loading.hidden,true);assert.equal(e.content.hidden,false);assert.equal(e.coverage.textContent,`${data.festivals.length}学園祭 / ${new Set(data.festivals.map(x=>x.prefecture)).size}都道府県を掲載`);
  const all=[];const walk=node=>{all.push(node);node.children.forEach(walk);};e['festival-list'].children.forEach(walk);
  assert(all.filter(x=>x.tagName==='A').every(x=>x.href.startsWith('https:')&&x.rel==='noopener noreferrer'));
  assert(!fs.readFileSync(path.join(root,'app.js'),'utf8').includes('innerHTML'));
});
test('every festival renders its own dates and verified official/source URLs', async () => {
  const {e} = await setup();
  for (const item of data.festivals) {
    const card = e['festival-list'].children.find(node => node.dataset.festivalId === item.id);
    assert(card, item.id);
    assert.equal(card.children.find(node => node.className === 'festival-date').textContent, core.dateLabel(item), item.id);
    const links = card.children.find(node => node.className === 'card-links').children;
    assert.equal(links[0].href, core.safeUrl(item.officialUrl), item.id);
    assert.equal(links[0].rel, 'noopener noreferrer', item.id);
    assert.equal(links.length, item.sourceUrl === item.officialUrl ? 1 : 2, item.id);
    if (links.length === 2) assert.equal(links[1].href, core.safeUrl(item.sourceUrl), item.id);
  }
});
test('every populated prefecture renders its full coverage and each university is searchable',async()=>{
  const {e}=await setup();
  for (const prefecture of new Set(data.festivals.map(item => item.prefecture))) {
    e.prefecture.value=prefecture; await e.prefecture.fire('change');
    const expected=data.festivals.filter(item => item.prefecture===prefecture);
    assert.equal(e['festival-list'].children.length,expected.length,prefecture);
    const option=e.prefecture.children.find(item => item.value===prefecture);
    assert.equal(option.textContent,`${prefecture}（${expected.length}件）`);
  }
  await e.reset.fire('click');
  for (const university of new Set(data.festivals.map(item => item.university))) {
    e.query.value=university; await e.query.fire('input');
    assert(e['festival-list'].children.length>0,university);
  }
});
test('UI filters combine, preserve other criteria on date clear, and reset completely',async()=>{
  const {e,window}=await setup();e.prefecture.value='東京都';await e.prefecture.fire('change');const tokyo=core.filterFestivals(data.festivals,{prefecture:'東京都'}).length;assert.equal(e['festival-list'].children.length,tokyo);
  e.from.value='2026-11-01';e.to.value='2026-11-03';await e.from.fire('change');assert.equal(e['festival-list'].children.length,core.filterFestivals(data.festivals,{prefecture:'東京都',from:'2026-11-01',to:'2026-11-03'}).length);assert.match(window.location.search,/from=2026-11-01/);
  await e['clear-dates'].fire('click');assert.equal(e.prefecture.value,'東京都');assert.equal(e['festival-list'].children.length,tokyo);
  e.query.value='存在しない学園祭';await e.query.fire('input');assert.equal(e.empty.hidden,false);
  await e['empty-reset'].fire('click');assert.equal(e['festival-list'].children.length,data.festivals.length);assert.equal(e.prefecture.value,'');assert.equal(e.query.value,'');assert.equal(window.location.search,'');
});
test('inverted range shows accessible error and recovers on reset',async()=>{
  const {e}=await setup();e.from.value='2026-11-03';e.to.value='2026-11-01';await e.to.fire('change');assert.equal(e['filter-error'].hidden,false);assert.equal(e.to.attributes['aria-invalid'],'true');assert.equal(e['festival-list'].children.length,0);assert.equal(e.empty.hidden,true);
  await e.reset.fire('click');assert.equal(e['filter-error'].hidden,true);assert.equal(e['festival-list'].children.length,data.festivals.length);
});
test('month navigation does not filter; day click selects single day and retains focus',async()=>{
  const {e,active}=await setup({search:'?from=2026-11-01&to=2026-11-03'});const previousCount=e['festival-list'].children.length;await e['next-month'].fire('click');assert.equal(e['month-title'].textContent,'2026年 12月');assert.equal(e['festival-list'].children.length,previousCount);assert.equal(e['next-month'].disabled,true);
  await e['previous-month'].fire('click');const day=e.calendar.children.find(x=>x.dataset.date==='2026-11-01');await day.fire('click');assert.equal(e.from.value,'2026-11-01');assert.equal(e.to.value,'2026-11-01');assert.equal(active().dataset.date,'2026-11-01');assert.equal(active().attributes['aria-pressed'],'true');
});
test('shared URL and browser popstate restore form values and matching month',async()=>{
  const {e,window,events}=await setup({search:'?prefecture=東京都&from=2026-11-01&to=2026-11-03'});assert.equal(e.prefecture.value,'東京都');assert.equal(e['month-title'].textContent,'2026年 11月');window.location.search='?prefecture=北海道';events.popstate();assert.equal(e.prefecture.value,'北海道');assert.equal(e.from.value,'');assert(e['festival-list'].children.length>0);
});
test('failed load displays retry; successful retry does not duplicate handlers',async()=>{
  const {e,requests}=await setup({failures:1});assert.equal(e['load-error'].hidden,false);await e.retry.fire('click');assert.equal(e['load-error'].hidden,true);assert.equal(e['festival-list'].children.length,data.festivals.length);assert.equal(e.prefecture.listeners.change.length,1);assert.equal(requests(),2);
});
test('malformed data is not silently shown as a valid empty calendar',async()=>{
  const {e}=await setup({payload:{...data,festivals:[]}});assert.equal(e['load-error'].hidden,false);assert.equal(e['festival-list'].children.length,0);
});
