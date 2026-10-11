(function (root) {
  'use strict';
  const PREFECTURES = ['北海道','青森県','岩手県','宮城県','秋田県','山形県','福島県','茨城県','栃木県','群馬県','埼玉県','千葉県','東京都','神奈川県','新潟県','富山県','石川県','福井県','山梨県','長野県','岐阜県','静岡県','愛知県','三重県','滋賀県','京都府','大阪府','兵庫県','奈良県','和歌山県','鳥取県','島根県','岡山県','広島県','山口県','徳島県','香川県','愛媛県','高知県','福岡県','佐賀県','長崎県','熊本県','大分県','宮崎県','鹿児島県','沖縄県'];
  const pad = value => String(value).padStart(2, '0');
  const isoDate = (year, month, day) => `${year}-${pad(month)}-${pad(day)}`;
  function isDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }
  function japanToday(now = new Date()) {
    return new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
  }
  function safeUrl(value) {
    try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? url.href : null; }
    catch (_) { return null; }
  }
  function validateData(data) {
    if (!data || data.year !== 2026 || !isDate(data.checkedAt) || !Array.isArray(data.festivals) || !data.festivals.length) throw new Error('Invalid festival dataset');
    const ids = new Set();
    for (const item of data.festivals) {
      if (!item || !['id','name','university','campus','prefecture'].every(key => typeof item[key] === 'string' && item[key].trim()) || ids.has(item.id) || !PREFECTURES.includes(item.prefecture) || !Array.isArray(item.dates) || !item.dates.length || !isDate(item.checkedAt) || !safeUrl(item.officialUrl) || !safeUrl(item.sourceUrl)) throw new Error('Invalid festival record');
      if (item.dates.some(date => !isDate(date) || !date.startsWith('2026-')) || new Set(item.dates).size !== item.dates.length) throw new Error('Invalid festival dates');
      const dates = [...item.dates].sort();
      if (item.startDate !== dates[0] || item.endDate !== dates[dates.length - 1]) throw new Error('Festival range does not match dates');
      ids.add(item.id);
    }
    return data;
  }
  function normalize(value) { return String(value || '').normalize('NFKC').toLocaleLowerCase('ja').trim(); }
  function matches(item, filters = {}) {
    if (filters.prefecture && item.prefecture !== filters.prefecture) return false;
    const words = normalize(filters.query).split(/\s+/).filter(Boolean);
    const haystack = normalize([item.university, item.name, item.campus, item.prefecture].join(' '));
    if (!words.every(word => haystack.includes(word))) return false;
    return item.dates.some(date => (!filters.from || date >= filters.from) && (!filters.to || date <= filters.to));
  }
  function filterFestivals(items, filters = {}) {
    return items.filter(item => matches(item, filters)).sort((a, b) => a.startDate.localeCompare(b.startDate) || a.name.localeCompare(b.name, 'ja'));
  }
  function monthCells(year, month) {
    const offset = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7;
    const total = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const cells = Array(offset).fill(null);
    for (let day = 1; day <= total; day += 1) cells.push(isoDate(year, month, day));
    while (cells.length % 7) cells.push(null);
    return cells;
  }
  function dayCounts(items) {
    const counts = new Map();
    for (const item of items) for (const date of item.dates) counts.set(date, (counts.get(date) || 0) + 1);
    return counts;
  }
  function shortDate(date) {
    const value = new Date(`${date}T00:00:00Z`);
    return `${value.getUTCMonth() + 1}/${value.getUTCDate()}（${'日月火水木金土'[value.getUTCDay()]}）`;
  }
  function dateLabel(item) {
    const dates = [...item.dates].sort();
    const consecutive = dates.every((date, index) => !index || new Date(`${date}T00:00:00Z`) - new Date(`${dates[index - 1]}T00:00:00Z`) === 86400000);
    return dates.length === 1 ? shortDate(dates[0]) : consecutive ? `${shortDate(dates[0])} – ${shortDate(dates[dates.length - 1])}` : dates.map(shortDate).join('・');
  }
  function readFilters(search) {
    const params = new URLSearchParams(search);
    const prefecture = params.get('prefecture') || '';
    const from = params.get('from') || '';
    const to = params.get('to') || '';
    return {prefecture: PREFECTURES.includes(prefecture) ? prefecture : '', from: isDate(from) ? from : '', to: isDate(to) ? to : '', query: (params.get('q') || '').slice(0, 100)};
  }
  const api = {PREFECTURES, isoDate, isDate, japanToday, safeUrl, validateData, matches, filterFestivals, monthCells, dayCounts, shortDate, dateLabel, readFilters};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.FestivalCalendar = api;
})(typeof window !== 'undefined' ? window : globalThis);
