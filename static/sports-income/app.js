/* Dependency-free UI and data rules. Also exported for Node tests. */
(function(root){
'use strict';
const leagues={NPB:'NPB',MLB:'MLB'};
const kinds={salary:'年俸（契約上の額）','scheduled-payment':'当年支払予定','deferred-compensation':'繰延額','posting-fee':'ポスティング料（球団間）','conditional-bonus':'条件付きボーナス','signing-bonus':'契約金（一時金）','multi-year-total':'複数年契約総額','sponsorship':'スポンサー収入','total-income':'総年収'};
const statuses={official:'公式発表',estimated:'報道などから推測',undisclosed:'金額未公表',unknown:'確認できず'};
const precisions={exact:'点推定・記載額','lower-bound':'下限情報',undisclosed:'数値非公開'};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=s=>String(s).normalize('NFKC').toLowerCase().replace(/\s+/g,' ').trim();
function valid(data){
 if(data?.schemaVersion!==2||!Array.isArray(data.players))throw Error('schema');
 const ids=new Set();
 const sources=s=>Array.isArray(s)&&s.length>0&&s.every(x=>typeof x.title==='string'&&/^https?:\/\//.test(x.url)&&/^\d{4}-\d{2}-\d{2}$/.test(x.checkedAt));
 for(const p of data.players){
  if(!/^[a-z0-9-]+$/.test(p.id)||ids.has(p.id)||p.sport!=='baseball'||!leagues[p.league]||!p.name||!Array.isArray(p.records)||!Array.isArray(p.events))throw Error('player');ids.add(p.id);
  for(const r of p.records){
   if(!kinds[r.kind]||!statuses[r.status]||!precisions[r.precision]||!/^\d{4}$/.test(String(r.year))||!r.season||!r.team||!['JPY','USD'].includes(r.currency)||!sources(r.sources))throw Error('record');
   if(r.precision==='undisclosed'?r.amount!==null:!(Number.isFinite(r.amount)&&r.amount>=0))throw Error('amount');
   if(r.status==='undisclosed'&&r.precision!=='undisclosed')throw Error('status');
   if(r.precision==='lower-bound'&&!['gt','gte'].includes(r.bound))throw Error('bound');
   if(r.kind==='multi-year-total'&&(!r.period||!r.period.start||!r.period.end))throw Error('period');
  }
  for(const e of p.events)if(!e.date||!e.label||!e.team||!sources(e.sources))throw Error('event');
 }
 return data;
}
function filter(players,q,league,team){const terms=norm(q).split(' ').filter(Boolean);return players.filter(p=>(!league||p.league===league)&&(!team||teams(p).includes(team))&&terms.every(t=>norm([p.name,p.reading||'',p.nameEn||'',...teams(p)].join(' ')).includes(t)));}
function teams(p){return [...new Set([...p.records,...p.events].map(r=>r.team))];}
const number=new Intl.NumberFormat('ja-JP',{maximumFractionDigits:20,useGrouping:false});
function money(value,currency){const units=currency==='USD'?['ドル','万ドル','億']:['円','万円','億'];const oku=Math.floor(value/100000000),man=(value%100000000)/10000;return oku?number.format(oku)+units[2]+(man?number.format(man)+units[1]:units[0]):number.format(value/10000)+units[1];}
function note(text){return String(text||'')
 .replace(/確認した公式資料に年俸の数値なし。|年俸非公開と報道。/g,'金額未公表。')
 .replace('契約継続は検索インデックスで確認。本文未取得のため金額の記載有無は未確認。','契約継続。')
 .replace('公式契約継続発表を確認。資料中に年俸の数値なし。','公式発表・契約継続。金額未公表。')
 .replace('公式の契約発表を確認。資料中に年俸の数値なし。','公式発表。金額未公表。')
 .replace(/経歴は検索インデックスによる確認。本文未取得。|検索インデックスによる確認。|クラブ告知は5月28日、PR TIMES掲載は5月29日。/g,'')
 .replace(/報道推定/g,'報道などから推測')
 .replace(/([0-9][0-9,]*)万円/g,(_,v)=>money(Number(v.replace(/,/g,''))*10000,'JPY'));}
function metricLabel(r){return r.kind==='salary'?'年俸（契約上の年額）':kinds[r.kind];}
function displayNote(text){return note(text).split('。').filter(sentence=>! /後払い|繰延|当年|支払予定|2034|2043/.test(sentence)).join('。');}
function recordLabel(r){return r.precision==='lower-bound'?'下限額':statuses[r.status];}
function eventLabel(e){return e.sources.some(s=>s.kind==='official'&&!String(s.access).includes('検索インデックス'))?'公式発表':'契約情報';}
function amount(r){if(r.precision==='undisclosed')return r.status==='unknown'?'確認できず':'未公表';return money(r.amount,r.currency)+(r.precision==='lower-bound'?(r.bound==='gt'?'超':'以上'):'');}
// Points are grouped by currency. Missing years, lower bounds and unpublished values break lines.
function series(records,currency,kind='salary'){const rows=records.filter(r=>r.kind===kind&&r.currency===currency).sort((a,b)=>a.year-b.year);return rows.map((r,i)=>({r,connect:i>0&&r.precision==='exact'&&rows[i-1].precision==='exact'&&Number(r.year)===Number(rows[i-1].year)+1}));}
// Keep each observation intact; group by season, affiliation and currency without summing.
const tableKinds=['salary','signing-bonus','conditional-bonus','multi-year-total','sponsorship','total-income'];
function annualRows(records){const groups=new Map();for(const r of records){if(!tableKinds.includes(r.kind))continue;const key=JSON.stringify([r.year,r.season,r.team,r.currency]);if(!groups.has(key))groups.set(key,{year:r.year,season:r.season,team:r.team,currency:r.currency,cells:{}});const cells=groups.get(key).cells;(cells[r.kind]||=[]).push(r);}return [...groups.values()].sort((a,b)=>Number(a.year)-Number(b.year)||a.season.localeCompare(b.season)||a.team.localeCompare(b.team)||a.currency.localeCompare(b.currency));}
function yearBasis(row){const bonus=row.cells['signing-bonus'];if(bonus?.some(r=>r.amount!==null)&&!row.cells.salary)return '契約時点（支払年不明）';return '契約対象年度';}
const api={valid,filter,amount,series,teams,note,recordLabel,eventLabel,metricLabel,annualRows,yearBasis,displayNote};if(typeof module!=='undefined')module.exports=api;
if(typeof document==='undefined')return;
const $=id=>document.getElementById(id);let db;let lastFocus=null;
function chart(records,kind='salary'){
 const salaries=records.filter(r=>r.kind===kind);
 if(!salaries.some(r=>r.precision==='exact'))return '<p class="meta">この項目をグラフに表示できる金額データはありません。下限・未公表情報は下の値表をご覧ください。</p>';
 return [...new Set(salaries.map(r=>r.currency))].map(currency=>{
 const points=series(salaries,currency,kind);const exact=points.filter(p=>p.r.precision==='exact');if(!exact.length)return '';
 const years=[...new Set(points.map(p=>Number(p.r.year)))].sort((a,b)=>a-b);const min=years[0],max=years.at(-1);const peak=Math.max(...exact.map(p=>p.r.amount));
 const x=y=>60+(Number(y)-min)/Math.max(1,max-min)*600;const y=a=>210-a/(peak||1)*160;
 let lines='',dots='';points.forEach((p,i)=>{if(p.r.precision!=='exact')return;const r=p.r;if(p.connect)lines+=`<line x1="${x(points[i-1].r.year)}" y1="${y(points[i-1].r.amount)}" x2="${x(r.year)}" y2="${y(r.amount)}" stroke="#096853" stroke-width="3"/>`;dots+=`<circle cx="${x(r.year)}" cy="${y(r.amount)}" r="5" fill="#096853"><title>${esc(r.season)} ${esc(currency)} ${esc(metricLabel(salaries[0]))} ${esc(amount(r))} / ${esc(recordLabel(r))}</title></circle>`;});
 return `<p class="meta">${esc(currency)}${currency==='JPY'?' · 億円・万円表示':' · 億ドル・万ドル表示'} · ${esc(metricLabel(salaries[0]))}。報道などから推測した額は確定収入を意味しません。</p><svg class="chart" viewBox="0 0 720 260" role="img" aria-label="${esc(currency)} ${esc(metricLabel(salaries[0]))}の年度別グラフ。金額は下の表に記載。未公表と下限、欠けた年は接続しません。"><line x1="60" y1="210" x2="680" y2="210" stroke="#a6b7ae"/><text x="10" y="215">${esc(money(0,currency))}</text><text x="10" y="30">${esc(money(peak,currency))}</text>${lines}${dots}${years.map(v=>`<text x="${x(v)}" y="240" text-anchor="middle">${v}</text>`).join('')}</svg>`;
 }).join('');
}
function list(){
 const q=$('query').value,s=$('league').value,t=$('team').value;
 const items=filter(db.players,q,s,t);$('count').textContent=`${items.length} 人を表示 / 登録 ${db.players.length} 人`;
 $('cards').innerHTML=items.map(p=>`<a class="card" href="#player=${encodeURIComponent(p.id)}" data-player="${p.id}"><span class="tag">${esc(leagues[p.league])}</span><h3>${esc(p.name)}</h3><p>${esc(teams(p).join(' / '))}</p><p>年俸・契約記録 ${p.records.filter(r=>tableKinds.includes(r.kind)).length} 件</p><p class="open">契約の歩みを見る →</p></a>`).join('');
 $('empty').hidden=items.length>0;$('empty').textContent=db.players.length?'条件に一致する選手はいません。検索語や絞り込みを変更してください。':'検証済みデータはまだ登録されていません。確認できた少数のサンプルから順次掲載します。';
 const url=new URL(location.href);for(const [key,value]of [['q',q],['league',s],['team',t]])value?url.searchParams.set(key,value):url.searchParams.delete(key);history.replaceState(null,'',url);
}
function table(p){const year=$('year').value;const rows=annualRows(p.records).filter(r=>!year||String(r.year)===year);const columns=tableKinds.filter(kind=>p.records.some(r=>r.kind===kind));
 const cell=(items,kind)=>!items?'<span class="missing" aria-label="掲載記録なし">—</span>':items.map(r=>`<div class="cell-record">${r.displayMetricLabel?`<small>${esc(metricLabel(r))}</small>`:''}<div class="amount">${esc(amount(r))}</div><small>${esc(recordLabel(r))}</small>${r.period?`<small>期間 ${esc(r.period.start)}〜${esc(r.period.end)} · 契約総額</small>`:''}<small>${esc(displayNote(r.note))}</small></div>`).join('');
 $('values').innerHTML=rows.length?`<p class="meta" id="table-help">横スクロール・左右矢印キーで各項目を確認できます。合計は算出しません。— は掲載記録なし（0や該当なしとは断定しません）。契約金は記録のある年だけ表示し、受領額とは断定しません。</p><div class="table-wrap" tabindex="0" role="region" aria-label="年度別の報酬一覧（横スクロール）" aria-describedby="table-help"><table class="annual-table"><caption>同じ年度・シーズンの報酬を1行に表示（所属・通貨が異なる場合は別行）</caption><thead><tr><th scope="col">年度 / シーズン</th>${columns.map(k=>`<th scope="col">${esc(kinds[k])}</th>`).join('')}<th scope="col">所属（記録時点）</th></tr></thead><tbody>${rows.map(row=>`<tr data-year="${esc(row.year)}"><th scope="row">${esc(row.season)}<small>${esc(row.currency)}</small><small>${esc(yearBasis(row))}</small></th>${columns.map(k=>`<td data-kind="${esc(k)}">${cell(row.cells[k],k)}</td>`).join('')}<td>${esc(row.team)}</td></tr>`).join('')}</tbody></table></div>`:'<p>この年度の金額記録はありません。</p>';
}

function route(){
 const id=new URLSearchParams(location.hash.slice(1)).get('player');const p=db.players.find(p=>p.id===id);
 $('browse').hidden=!!p;$('detail').hidden=!p;if(!p){if(id){$('empty').hidden=false;$('empty').textContent='指定された選手は登録されていません。';}if(lastFocus){document.querySelector(`[data-player="${lastFocus}"]`)?.focus();lastFocus=null;}return;}
 lastFocus=p.id;$('player').innerHTML=`<div class="player-head"><span class="tag">${esc(leagues[p.league])}</span><h2 id="player-name" tabindex="-1">${esc(p.name)}</h2><p class="meta">${esc(teams(p).join(' / '))} · 所属は各記録の時点</p></div><div class="panel"><h3>年俸の推移</h3><div id="graph">${chart(p.records)}</div></div><div class="panel"><h3>年度別の金額</h3><label>表示年度<select id="year"><option value="">すべての年度</option>${[...new Set(annualRows(p.records).map(r=>r.year))].sort().map(y=>`<option>${esc(y)}</option>`).join('')}</select></label><div id="values"></div></div><div class="panel"><h3>加入・ドラフト・契約の履歴</h3>${p.events.length?p.events.map(e=>`<div class="record"><p><strong>${esc(e.date)} · ${esc(e.label)}</strong></p><p>${esc(e.team)}</p><p>${esc(displayNote(e.note))}</p><p class="meta">${esc(eventLabel(e))}</p></div>`).join(''):'<p>確認できた加入・ドラフト情報はまだありません。</p>'}</div>`;
 $('year').addEventListener('change',()=>table(p));table(p);$('player-name').focus();
}
async function init(){try{
 const res=await fetch('data.json');if(!res.ok)throw Error('fetch');db=valid(await res.json());
 $('coverage').textContent=`NPB・MLB / ${db.players.length} 人の検証サンプル`;$('checked').textContent=db.checkedAt?`最終確認 ${db.checkedAt}`:'データ確認中';
 const url=new URL(location.href);$('query').value=url.searchParams.get('q')||'';$('league').value=url.searchParams.get('league')||'';
 $('team').innerHTML+=[...new Set(db.players.flatMap(teams))].sort().map(t=>`<option value="${esc(t)}">${esc(t)}</option>`).join('');$('team').value=url.searchParams.get('team')||'';
 $('filters').addEventListener('input',list);$('filters').addEventListener('submit',e=>e.preventDefault());$('filters').addEventListener('reset',()=>setTimeout(list,0));addEventListener('hashchange',route);list();route();
 }catch(e){$('empty').hidden=false;$('empty').textContent='データを読み込めませんでした。時間をおいて再読み込みしてください。';$('count').textContent='読み込みエラー';$('filters').querySelectorAll('input,select,button').forEach(e=>e.disabled=true);}}
 init();
})(typeof globalThis==='undefined'?this:globalThis);
