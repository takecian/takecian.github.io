const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '../static/school-festival-calendar');
const core = require(path.join(root, 'calendar.js'));
const data = JSON.parse(fs.readFileSync(path.join(root, 'festivals.json'), 'utf8'));
const fixture = {id:'fixture-2026', school_name:'テスト中学校・高等学校', festival_name:'テスト祭', region:'関東', prefecture:'東京都', school_levels:['junior_high','high'], public_dates:['2026-11-01','2026-11-03'], official_url:'https://example.com/festival', reservation_url:null, sources:[{url:'https://example.com/festival',year_evidence:'2026年明記'}], checked_at:'2026-10-12', time_text:null, notes:null, admission:{type:'limited',eligible_visitors:'受験生と保護者',reservation_required:null,reservation_policy:'varies_by_visitor',reservation_text:'対象者による',reservation_deadline:null,deadline_text:null,reservation_window_text:null}};
const sample = events => ({schema_version:1, year:2026, updated_at:'2026-10-12T14:00:00+09:00',events});

test('canonical dataset has unique officially verified 2026 records for both levels', () => {
  assert.equal(core.validateData(data),data);
  assert(data.events.length >= 37);
  assert(core.forLevel(data.events,'high').length>0);
  assert(core.forLevel(data.events,'junior_high').length>0);
  assert(data.events.some(e => e.school_levels.length===2));
  for (const level of core.LEVELS) {
    const view=core.forLevel(data.events,level);
    assert.equal(new Set(view.map(e=>e.id)).size,view.length);
    assert(view.every(e=>e.school_levels.includes(level)));
  }
  assert.equal(new Set([...core.forLevel(data.events,'high'),...core.forLevel(data.events,'junior_high')].map(e=>e.id)).size,data.events.length);
});
test('one joint record is included once in each fixed school view, no artificial duplicates', () => {
  for (const level of core.LEVELS) assert.deepEqual(core.forLevel([fixture],level),[fixture]);
  assert.throws(()=>core.forLevel([fixture],'all'));
  assert.throws(()=>core.validateData(sample([fixture,fixture])));
  assert.throws(()=>core.validateData(sample([fixture,{...fixture,id:'different-id'}])));
});
test('actual public dates, not the enclosing range, determine filtering and counts', () => {
  assert(core.matches(fixture,{from:'2026-11-01',to:'2026-11-01'}));
  assert(core.matches(fixture,{from:'2026-11-03',to:'2026-11-03'}));
  assert(!core.matches(fixture,{from:'2026-11-02',to:'2026-11-02'}));
  assert(!core.matches(fixture,{from:'2026-11-04'}));
  assert(!core.matches(fixture,{to:'2026-10-31'}));
  assert.equal(core.dayCounts([fixture]).get('2026-11-02'),undefined);
  assert.equal(core.dayCounts([fixture]).get('2026-11-01'),1);
  assert.equal(core.dateLabel(fixture),'11/1（日）・11/3（火）');
});
test('prefecture, normalized terms, exact dates, admission and reservation compose with AND', () => {
  assert(core.matches(fixture,{prefecture:'東京都',query:'ﾃｽﾄ 中学',from:'2026-11-03',to:'2026-11-03',admission:'limited',reservation:'varies'}));
  for (const filters of [{prefecture:'大阪府'},{query:'テスト 不明'},{admission:'public'},{reservation:'not_required'}]) assert(!core.matches(fixture,filters));
  const before=data.events.map(e=>e.id);
  const result=core.filterFestivals(data.events);
  for (let i=1;i<result.length;i++) assert(result[i-1].public_dates[0]<=result[i].public_dates[0]);
  assert.deepEqual(data.events.map(e=>e.id),before);
});
test('advance registration, visitor-dependent rules and unknowns are not conflated', () => {
  const admission=fixture.admission;
  assert.equal(core.reservationCategory(admission),'varies');
  assert.equal(core.reservationLabel(admission),'予約は対象者による');
  assert.equal(core.reservationCategory({...admission,reservation_policy:'not_stated'}),'unknown');
  assert.equal(core.reservationLabel({...admission,reservation_policy:'recommended',reservation_required:false}),'事前登録推奨');
  assert.equal(core.reservationLabel({...admission,reservation_policy:'same_day_registration_available',reservation_required:false}),'当日登録可');
  assert.equal(core.reservationCategory({...admission,reservation_policy:'advance_required',reservation_required:true}),'required');
  assert.equal(core.reservationCategory({...admission,reservation_policy:'not_required',reservation_required:false}),'not_required');
  for (const event of data.events.filter(e=>e.admission.reservation_required===null)) assert(!core.matches(event,{reservation:'not_required'}));
});
test('malformed dates, unsafe links and missing admission facts are rejected', () => {
  for (const change of [
    {public_dates:['2025-11-01']},{public_dates:['2026-02-29']},{public_dates:['2026-11-03','2026-11-01']},
    {public_dates:['2026-11-01','2026-11-01']},{school_levels:['college']},{school_levels:['high','high']},
    {official_url:'javascript:alert(1)'},{reservation_url:'http://example.com/'},{sources:[]},
    {sources:[{url:'https://example.com/',year_evidence:null}]},{checked_at:'2026-10-13'},
    {admission:{...fixture.admission,reservation_required:'false'}},{admission:{...fixture.admission,reservation_policy:'advance_required',reservation_required:false}},{admission:{...fixture.admission,type:'everyone'}},
    {admission:{...fixture.admission,eligible_visitors:''}},{admission:{...fixture.admission,reservation_deadline:'2026-02-29'}}
  ]) assert.throws(()=>core.validateData(sample([{...fixture,...change}])));
});
test('URL restoration accepts known filters only and cannot control school level', () => {
  assert.deepEqual(core.readFilters('?prefecture=東京都&from=2026-11-01&to=2026-11-03&q=学校&admission=limited&reservation=varies&school_level=junior_high'),{prefecture:'東京都',from:'2026-11-01',to:'2026-11-03',query:'学校',admission:'limited',reservation:'varies'});
  assert.deepEqual(core.readFilters('?prefecture=unknown&from=2026-02-29&to=bad&admission=__proto__&reservation=no'),{prefecture:'',from:'',to:'',query:'',admission:'',reservation:''});
  assert.equal(core.readFilters('?q='+'a'.repeat(150)).query.length,100);
});

async function setup({level='high', search='', failures=0, payload=data, httpError=false, date='2026-10-12T05:00:00Z'}={}) {
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
  const route=level==='junior_high'?'junior-high-school-festival-calendar':'high-school-festival-calendar';
  const html=fs.readFileSync(path.join(root,'../',route,'index.html'),'utf8');
  for(const match of html.matchAll(/<([a-z]+)[^>]*\bid="([^"]+)"[^>]*>/g)) elements[match[2]]=new Element(match[1]);
  const document={body:{dataset:{schoolLevel:level}},getElementById:id=>elements[id],createElement:tag=>new Element(tag)};
  const location={href:'https://example.com/'+route+'/'+search,search};
  let writes=0;
  const history={replaceState(_state,_unused,url){writes++;location.href=String(url);location.search=new URL(url).search;}};
  let requests=0;const requestedUrls=[];
  const window={SchoolFestivalCalendar:{...core,japanToday:()=>core.japanToday(new Date(date))},location,history,addEventListener(name,fn){windowEvents[name]=fn;}};
  const context=vm.createContext({window,document,URL,URLSearchParams,Date,Map,Set,console,fetch:async(url)=>{requests++;requestedUrls.push(url);if(requests<=failures)throw new Error('network unavailable');return {ok:!httpError,status:500,json:async()=>payload};}});
  vm.runInContext(fs.readFileSync(path.join(root,'app.js'),'utf8'),context);
  await new Promise(resolve=>setImmediate(resolve));
  return {e:elements,window,events:windowEvents,active:()=>active,requests:()=>requests,writes:()=>writes,requestedUrls};
}
function descendants(node){return [node,...node.children.flatMap(descendants)];}
const contents = node => [node.textContent,...node.children.map(contents)].join(' ');
for (const level of core.LEVELS) {
  test(`${level}: fixed school view loads canonical data and correct distinct coverage`,async()=>{
    const {e,requestedUrls}=await setup({level,search:'?school_level=college'});
    const expected=core.forLevel(data.events,level);
    assert.equal(e['festival-list'].children.length,expected.length);
    assert.equal(e.coverage.textContent,`${expected.length}件 / ${new Set(expected.map(e=>e.prefecture)).size}都道府県を掲載`);
    assert.equal(e.prefecture.children.length,48);
    assert.deepEqual(requestedUrls,['../school-festival-calendar/festivals.json']);
    assert.equal(e.loading.hidden,true);assert.equal(e.content.hidden,false);
    for (const prefecture of core.PREFECTURES) assert.equal(e.prefecture.children.find(e=>e.value===prefecture).textContent,`${prefecture}（${expected.filter(e=>e.prefecture===prefecture).length}件）`);
  });
  test(`${level}: all cards preserve eligibility, reservations, dates and safe official links`,async()=>{
    const {e}=await setup({level});
    for (const item of core.forLevel(data.events,level)) {
      const card=e['festival-list'].children.find(n=>n.dataset.festivalId===item.id);
      const nodes=descendants(card);const all=contents(card);
      assert(all.includes(item.school_name));assert(all.includes(item.festival_name));assert(all.includes(core.dateLabel(item)));
      assert(all.includes(item.admission.eligible_visitors));assert(all.includes(item.admission.reservation_text));assert(all.includes(item.checked_at.replaceAll('-','/')));
      assert.equal(nodes.find(n=>n.className==='official-link').href,core.safeUrl(item.official_url));
      assert(nodes.filter(n=>n.tagName==='A').every(n=>n.href.startsWith('https:')&&n.rel==='noopener noreferrer'));
      if(item.school_levels.length>1) assert(all.includes('中高合同'));
    }
  });
}
test('UI combines admission and reservation, updates URL and resets all criteria',async()=>{
  const {e,window}=await setup();
  e.admission.value='public';e.reservation.value='not_required';await e.admission.fire('change');
  assert.equal(e['festival-list'].children.length,core.filterFestivals(core.forLevel(data.events,'high'),{admission:'public',reservation:'not_required'}).length);
  assert(window.location.search.includes('admission=public'));assert(window.location.search.includes('reservation=not_required'));
  e.from.value='2026-10-01';e.to.value='2026-11-01';await e.to.fire('change');
  await e['clear-dates'].fire('click');assert.equal(e.admission.value,'public');assert.equal(e.reservation.value,'not_required');
  await e.reset.fire('click');assert.equal(e.admission.value,'');assert.equal(e.reservation.value,'');assert.equal(window.location.search,'');
});
test('empty results and inverted dates recover accessibly on reset',async()=>{
  const {e,active}=await setup();e.query.value='存在しない';await e.query.fire('input');assert.equal(e.empty.hidden,false);
  await e['empty-reset'].fire('click');assert.equal(active(),e.prefecture);assert.equal(e['festival-list'].children.length,core.forLevel(data.events,'high').length);
  e.from.value='2026-11-03';e.to.value='2026-11-01';await e.to.fire('change');assert.equal(e['filter-error'].hidden,false);assert.equal(e.to.attributes['aria-invalid'],'true');assert.equal(e.empty.hidden,true);assert.equal(e['festival-list'].children.length,0);
  await e.reset.fire('click');assert.equal(e['filter-error'].hidden,true);assert.equal(e.to.attributes['aria-invalid'],'false');
});
test('monthly counts reflect non-date filters and day selection preserves keyboard focus',async()=>{
  const {e,active}=await setup({search:'?from=2026-11-01&admission=public&reservation=not_required'});
  const expected=core.dayCounts(core.filterFestivals(core.forLevel(data.events,'high'),{admission:'public',reservation:'not_required'}));
  for(const cell of e.calendar.children.filter(n=>n.dataset.date)) assert.equal(cell.children[1].textContent,expected.get(cell.dataset.date)?String(expected.get(cell.dataset.date)):'');
  const before=e['festival-list'].children.length;await e['next-month'].fire('click');assert.equal(e['month-title'].textContent,'2026年 12月');assert.equal(e['festival-list'].children.length,before);assert.equal(e['next-month'].disabled,true);
  await e['previous-month'].fire('click');await e.calendar.children.find(n=>n.dataset.date==='2026-11-03').fire('click');assert.equal(e.from.value,'2026-11-03');assert.equal(e.to.value,'2026-11-03');assert.equal(active().dataset.date,'2026-11-03');assert.equal(active().attributes['aria-pressed'],'true');
});
test('deep links and popstate restore criteria without adding history entries',async()=>{
  const {e,events,window,writes}=await setup({search:'?from=2026-09-01&admission=limited&reservation=varies'});
  assert.equal(e['month-title'].textContent,'2026年 9月');assert.equal(e.admission.value,'limited');assert.equal(e.reservation.value,'varies');assert.equal(writes(),0);
  window.location.search='?prefecture=東京都&admission=public';events.popstate();assert.equal(e.from.value,'');assert.equal(e.reservation.value,'');assert.equal(e.admission.value,'public');assert.equal(writes(),0);
});
test('past deadline is qualified, and upcoming deadline never implies live availability',async()=>{
  const event={...fixture,admission:{...fixture.admission,reservation_required:true,reservation_policy:'advance_required',reservation_deadline:'2026-10-11',deadline_text:'2026年10月11日 正午まで'}};
  const {e}=await setup({payload:sample([event])});const all=contents(e['festival-list']);assert(all.includes('記載の締切日を経過'));assert(all.includes('2026年10月11日 正午まで'));assert(!all.includes('受付中'));
  const next=await setup({payload:sample([{...event,admission:{...event.admission,reservation_deadline:'2026-11-01'}}])});assert(!contents(next.e['festival-list']).includes('記載の締切日を経過'));assert(!contents(next.e['festival-list']).includes('受付中'));
});
test('JST current and past status derives from public dates, not a saved status field',async()=>{
  const event={...fixture,public_dates:['2026-10-12'],temporal_status:'past'};
  const {e}=await setup({payload:sample([event]),date:'2026-10-11T15:01:00Z'});assert(contents(e['festival-list']).includes('本日公開'));
  const after=await setup({payload:sample([event]),date:'2026-10-12T15:01:00Z'});assert(contents(after.e['festival-list']).includes('開催終了'));
});
test('failure, retry and malformed payloads never silently display a valid empty list',async()=>{
  const {e,requests}=await setup({failures:1});assert.equal(e['load-error'].hidden,false);assert.equal(e.content.hidden,true);await e.retry.fire('click');assert.equal(e['load-error'].hidden,true);assert.equal(e.admission.listeners.change.length,1);assert.equal(requests(),2);
  for (const options of [{httpError:true},{payload:sample([])},{level:'college'}]) { const result=await setup(options);assert.equal(result.e['load-error'].hidden,false);assert.equal(result.e.content.hidden,true); }
});
test('data strings are rendered as text and cannot inject executable markup',async()=>{
  const name='<img src=x onerror=alert(1)>';
  const {e}=await setup({payload:sample([{...fixture,festival_name:name}])});assert.equal(e['festival-list'].children[0].children.find(n=>n.tagName==='H3').textContent,name);
  assert(!fs.readFileSync(path.join(root,'app.js'),'utf8').includes('innerHTML'));
});

test('known unavailable supplementary sources keep provenance without a broken visitor link',async()=>{
  const event={...fixture,sources:[...fixture.sources,{url:'https://example.com/removed',available:false,year_evidence:'2026 official article, no longer available'}]};
  assert.equal(core.validateData(sample([event])).events[0],event);
  const {e}=await setup({payload:sample([event])});
  assert(!descendants(e['festival-list']).some(n=>n.tagName==='A'&&n.href==='https://example.com/removed'));
  assert(contents(e['festival-list']).includes('過去の公式告知の一部は現在閲覧できません'));
  assert(descendants(e['festival-list']).some(n=>n.tagName==='A'&&n.href===fixture.official_url));
});

test('distinct registration opening windows and deadlines are both displayed, exact duplicates once',async()=>{
  const event={...fixture,admission:{...fixture.admission,reservation_window_text:'2026年8月21日から受付',deadline_text:'締切日未確認'}};
  const {e}=await setup({payload:sample([event])});const card=contents(e['festival-list']);assert(card.includes('2026年8月21日から受付'));assert(card.includes('締切日未確認'));
  const duplicate='2026年9月1日から10月1日まで';
  const second=await setup({payload:sample([{...event,admission:{...event.admission,reservation_window_text:duplicate,deadline_text:duplicate}}])});
  assert.equal(contents(second.e['festival-list']).split(duplicate).length-1,1);
});
