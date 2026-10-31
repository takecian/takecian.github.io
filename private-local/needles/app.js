'use strict';
const $ = id => document.getElementById(id);
let records = [];
const seasonLabel = value => value || 'シーズン未確認';
function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  if (className) node.className = className;
  return node;
}
function officialLink(url, label) {
  const a = element('a', label, 'source');
  a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer';
  return a;
}
function card(item) {
  const article = element('article', '', 'card');
  const picture = element('div', '', 'picture');
  const fallback = element('div', '', 'placeholder');
  fallback.append(element('strong', item.store === 'NEEDLES' ? item.modelCode : item.store));
  fallback.append(element('span', item.downloadStatus === 'manual-required' ? '手元に保存した画像を追加できます' : 'ローカル画像が見つかりません'));
  picture.append(fallback);
  if (item.imageUrl && item.imagePolicy !== 'restricted') {
    const img = element('img'); img.alt = `${item.store} ${seasonLabel(item.season)} ${item.color} ${item.model}`;
    img.loading = 'lazy'; img.decoding = 'async'; img.referrerPolicy = 'no-referrer';
    img.addEventListener('load', () => { fallback.hidden = true; });
    img.addEventListener('error', () => { img.hidden = true; fallback.hidden = false; });
    img.src = item.imageUrl; picture.append(img);
  }
  const top = element('div', '', 'card-top');
  top.append(element('span', seasonLabel(item.season)), element('span', item.kind === 'standard' ? '通常モデル' : `${item.store} 別注`, 'badge'));
  article.append(picture, top, element('h3', item.color), element('p', item.model, 'model'), element('p', item.modelCode ? `品番 ${item.modelCode}` : `販売店品番 ${item.retailerCode}`, 'model'));
  if (item.note) article.append(element('p', item.note, 'note'));
  if (item.downloadStatus === 'manual-required') {
    const label = element('label', '保存済み画像を選ぶ（この閲覧中のみ）', 'manual');
    const input = element('input'); input.type = 'file'; input.accept = 'image/jpeg,image/png,image/webp';
    input.addEventListener('change', () => { const file = input.files[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => { const img = picture.querySelector('img'); img.src = reader.result; img.hidden = false; }; reader.readAsDataURL(file); });
    label.append(input); article.append(label);
  }
  article.append(officialLink(item.sourceUrl, `${item.sourceName || item.store} 公式出典 ↗`));
  if(item.seasonSourceUrl && item.seasonSourceUrl !== item.sourceUrl) article.append(officialLink(item.seasonSourceUrl, 'シーズンの出典 ↗'));
  return article;
}
function render() {
  const q = $('query').value.trim().toLocaleLowerCase();
  const filtered = records.filter(item => (!$('season').value || (item.season || 'unknown') === $('season').value) && (!$('kind').value || item.kind === $('kind').value) && (!$('store').value || item.store === $('store').value) && (!q || [item.color,item.modelCode,item.retailerCode,item.store,item.model].join(' ').toLocaleLowerCase().includes(q)));
  $('grid').replaceChildren(...filtered.map(card));
  $('count').textContent = `${filtered.length} / ${records.length} 配色`;
  $('empty').hidden = filtered.length > 0;
}
$('filters').addEventListener('submit', e => e.preventDefault());
$('filters').addEventListener('input', render);
$('filters').addEventListener('reset', () => setTimeout(render, 0));
const data = window.NEEDLES_DATA;
records = data.records;
[...new Set(records.map(item => item.store))].forEach(store => {const option = element('option', store); option.value = store; $('store').append(option);});
$('updated').textContent = `確認日 ${data.checkedAt} · 非公開ローカル版`;
render();
