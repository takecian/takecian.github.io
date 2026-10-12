(function (root) {
  'use strict';
  const base = typeof module !== 'undefined' && module.exports ? require('../festival-calendar/calendar.js') : root.FestivalCalendar;
  const LEVELS = ['junior_high', 'high'];
  const ADMISSION = {public:'一般来場可', prospective_students:'受験生向け', related_only:'関係者限定', limited:'来場条件あり', unclear:'来場条件は要確認'};
  const RESERVATIONS = ['required','not_required','varies','unknown'];
  const RESERVATION_POLICIES = {advance_required:true, not_required:false, recommended:false, same_day_registration_available:false, varies_by_visitor:null, not_stated:null, unknown:null};
  const text = value => typeof value === 'string' && value.trim().length > 0;
  const optionalText = value => value == null || typeof value === 'string';
  function validateData(data) {
    if (!data || data.schema_version !== 1 || data.year !== 2026 || !base.isDate(String(data.updated_at).slice(0,10)) || !Array.isArray(data.events) || !data.events.length) throw new Error('Invalid school festival dataset');
    const ids = new Set();
    const identities = new Set();
    for (const item of data.events) {
      if (!item || !['id','school_name','festival_name','prefecture','region'].every(key => text(item[key])) || !/^[a-z0-9-]+$/.test(item.id) || ids.has(item.id) || !base.PREFECTURES.includes(item.prefecture)) throw new Error('Invalid school festival record');
      if (!Array.isArray(item.school_levels) || !item.school_levels.length || item.school_levels.some(level => !LEVELS.includes(level)) || new Set(item.school_levels).size !== item.school_levels.length) throw new Error('Invalid school levels');
      if (!Array.isArray(item.public_dates) || !item.public_dates.length || item.public_dates.some(date => !base.isDate(date) || !date.startsWith('2026-')) || new Set(item.public_dates).size !== item.public_dates.length || item.public_dates.join() !== [...item.public_dates].sort().join()) throw new Error('Invalid public dates');
      if (!base.safeUrl(item.official_url) || (item.reservation_url != null && !base.safeUrl(item.reservation_url)) || !base.isDate(item.checked_at) || item.checked_at > String(data.updated_at).slice(0,10)) throw new Error('Invalid school festival source');
      if (!Array.isArray(item.sources) || !item.sources.length || item.sources.some(source => !source || !base.safeUrl(source.url) || (source.available != null && typeof source.available !== 'boolean')) || !item.sources.some(source => text(source.year_evidence))) throw new Error('Missing 2026 official evidence');
      const a = item.admission;
      if (!a || !Object.hasOwn(ADMISSION, a.type) || !text(a.eligible_visitors) || ![true,false,null].includes(a.reservation_required) || !text(a.reservation_text) || !optionalText(a.reservation_window_text) || !optionalText(a.deadline_text) || (a.reservation_deadline != null && !base.isDate(a.reservation_deadline))) throw new Error('Invalid admission conditions');
      if (!Object.hasOwn(RESERVATION_POLICIES, a.reservation_policy) || RESERVATION_POLICIES[a.reservation_policy] !== a.reservation_required) throw new Error('Contradictory reservation policy');
      if (!optionalText(item.time_text) || !(optionalText(item.notes) || (Array.isArray(item.notes) && item.notes.every(text)))) throw new Error('Invalid visitor notes');
      const identity = [item.school_name, item.festival_name, item.public_dates.join(',')].join('|');
      if (identities.has(identity)) throw new Error('Duplicate school festival');
      identities.add(identity); ids.add(item.id);
    }
    return data;
  }
  function forLevel(items, level) {
    if (!LEVELS.includes(level)) throw new Error('Unknown school level');
    return items.filter(item => item.school_levels.includes(level));
  }
  function reservationCategory(admission) {
    if (admission.reservation_policy === 'varies_by_visitor') return 'varies';
    return admission.reservation_required === true ? 'required' : admission.reservation_required === false ? 'not_required' : 'unknown';
  }
  function reservationLabel(admission) {
    if (admission.reservation_policy === 'recommended') return '事前登録推奨';
    if (admission.reservation_policy === 'same_day_registration_available') return '当日登録可';
    return {required:'事前予約が必要', not_required:'事前予約不要', varies:'予約は対象者による', unknown:'予約は要確認'}[reservationCategory(admission)];
  }
  function normalize(value) { return String(value || '').normalize('NFKC').toLocaleLowerCase('ja').trim(); }
  function matches(item, filters = {}) {
    if (filters.prefecture && item.prefecture !== filters.prefecture) return false;
    if (filters.admission && item.admission.type !== filters.admission) return false;
    if (filters.reservation && reservationCategory(item.admission) !== filters.reservation) return false;
    const haystack = normalize([item.school_name,item.festival_name,item.prefecture].join(' '));
    if (!normalize(filters.query).split(/\s+/).filter(Boolean).every(word => haystack.includes(word))) return false;
    return item.public_dates.some(date => (!filters.from || date >= filters.from) && (!filters.to || date <= filters.to));
  }
  function filterFestivals(items, filters = {}) {
    return items.filter(item => matches(item, filters)).sort((a,b) => a.public_dates[0].localeCompare(b.public_dates[0]) || a.school_name.localeCompare(b.school_name,'ja') || a.id.localeCompare(b.id));
  }
  function dayCounts(items) {
    const counts = new Map();
    for (const item of items) for (const date of item.public_dates) counts.set(date, (counts.get(date) || 0) + 1);
    return counts;
  }
  function dateLabel(item) { return base.dateLabel({dates:item.public_dates}); }
  function readFilters(search) {
    const params = new URLSearchParams(search);
    const reservation = params.get('reservation') || '';
    const admission = params.get('admission') || '';
    return {...base.readFilters(search), admission:Object.hasOwn(ADMISSION, admission) ? admission : '', reservation:RESERVATIONS.includes(reservation) ? reservation : ''};
  }
  const api = {...base, LEVELS, ADMISSION, RESERVATIONS, validateData, forLevel, reservationCategory, reservationLabel, matches, filterFestivals, dayCounts, dateLabel, readFilters};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SchoolFestivalCalendar = api;
})(typeof window !== 'undefined' ? window : globalThis);
