(function () {
  'use strict';
  const core = window.SchoolFestivalCalendar;
  const $ = id => document.getElementById(id);
  const fields = {prefecture: $('prefecture'), from: $('from'), to: $('to'), query: $('query'), admission: $('admission'), reservation: $('reservation')};
  const today = core.japanToday();
  const level = document.body.dataset.schoolLevel;
  let data;
  let month = today.startsWith('2026-') ? Number(today.slice(5, 7)) : 10;
  let bound = false;
  let loading = false;

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function filters() { return Object.fromEntries(Object.entries(fields).map(([key, node]) => [key, node.value])); }
  function applyFilters(values) { for (const [key, node] of Object.entries(fields)) node.value = values[key] || ''; }
  function focusMonth(values) {
    const date = values.from || values.to;
    if (date && date.startsWith('2026-')) month = Number(date.slice(5, 7));
  }
  function writeUrl(values) {
    const url = new URL(window.location.href);
    for (const [key, parameter] of [['prefecture','prefecture'],['from','from'],['to','to'],['query','q'],['admission','admission'],['reservation','reservation']]) {
      if (values[key]) url.searchParams.set(parameter, values[key]);
      else url.searchParams.delete(parameter);
    }
    // Replace rather than pushing a browser-history entry for each keystroke.
    try { window.history.replaceState(null, '', url); } catch (_) { /* Filtering works even when history is restricted. */ }
  }
  function sourceLink(url, text, className) {
    const link = element('a', className, text);
    link.href = core.safeUrl(url);
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.setAttribute('aria-label', `${text}（新しいタブで開きます）`);
    return link;
  }
  function card(item) {
    const article = element('article', 'festival-card');
    article.dataset.festivalId = item.id;
    const top = element('div', 'card-top');
    top.append(element('span', 'prefecture-tag', item.prefecture));
    if (item.public_dates.includes(today)) top.append(element('span', 'status-tag ongoing', '本日公開'));
    else if (item.public_dates[item.public_dates.length - 1] < today) top.append(element('span', 'status-tag', '開催終了'));
    const dates = element('p', 'festival-date');
    dates.append(element('span', 'date-kind', '公開日'), element('span', '', core.dateLabel(item)));
    article.append(top, dates, element('p', 'school-name', item.school_name), element('h3', '', item.festival_name));
    if (item.time_text) article.append(element('p', 'event-time', item.time_text));
    const badges = element('div', 'event-meta');
    badges.append(element('span', 'admission-tag', core.ADMISSION[item.admission.type]), element('span', `reservation-tag ${core.reservationCategory(item.admission)}`, core.reservationLabel(item.admission)));
    if (item.school_levels.length > 1) badges.append(element('span', 'joint-tag', '中高合同'));
    article.append(badges);
    const details = element('dl', 'admission-details');
    const addDetail = (label, value, className) => { details.append(element('dt', '', label), element('dd', className, value)); };
    addDetail('来場対象', item.admission.eligible_visitors);
    addDetail('事前予約', item.admission.reservation_text);
    const deadline = item.admission.reservation_deadline;
    const deadlineText = item.admission.deadline_text;
    const windowText = item.admission.reservation_window_text;
    const passed = deadline && deadline < today;
    if (windowText && windowText !== deadlineText) addDetail('受付期間', windowText);
    if (deadlineText || deadline) addDetail(windowText === deadlineText ? '申込・締切' : '申込締切', `${deadlineText || deadline.replaceAll('-', '/')}${passed ? '（記載の締切日を経過）' : ''}`, passed ? 'deadline-passed' : '');
    else if (!windowText && core.reservationCategory(item.admission) !== 'not_required') addDetail('申込・締切', '公式案内でご確認ください');
    article.append(details);
    if (item.notes) article.append(element('p', 'event-note', Array.isArray(item.notes) ? item.notes.join(' ') : item.notes));
    if (item.sources.some(source => source.available === false)) article.append(element('p', 'event-note source-caveat', '過去の公式告知の一部は現在閲覧できません。掲載日程は確認時点の記録です。'));
    const links = element('div', 'card-links');
    links.append(sourceLink(item.official_url, '公式案内 ↗', 'official-link'));
    if (item.reservation_url && item.reservation_url !== item.official_url) links.append(sourceLink(item.reservation_url, '申込案内 ↗', 'reservation-link source-link'));
    const urls = new Set([item.official_url, item.reservation_url]);
    for (const source of item.sources) {
      if (source.available !== false && !urls.has(source.url)) { links.append(sourceLink(source.url, '補足の公式情報 ↗', 'source-link')); urls.add(source.url); }
    }
    article.append(links, element('p', 'source-check', `公式発表を確認：${item.checked_at.replaceAll('-', '/')}`));
    return article;
  }
  function renderCalendar(values) {
    $('month-title').textContent = `2026年 ${month}月`;
    $('previous-month').disabled = month === 1;
    $('next-month').disabled = month === 12;
    const counts = core.dayCounts(core.filterFestivals(data.events, {...values, from:'', to:''}));
    const cells = core.monthCells(2026, month).map(date => {
      if (!date) { const blank = element('span', 'calendar-blank'); blank.setAttribute('aria-hidden', 'true'); return blank; }
      const count = counts.get(date) || 0;
      const selected = (values.from || values.to) && (!values.from || date >= values.from) && (!values.to || date <= values.to);
      const button = element('button', `calendar-day${count ? ' has-events' : ''}${selected ? ' is-selected' : ''}${date === today ? ' is-today' : ''}`);
      button.type = 'button';
      button.dataset.date = date;
      button.setAttribute('aria-pressed', selected ? 'true' : 'false');
      button.setAttribute('aria-label', `2026年${core.shortDate(date)}、${count}件開催${date === today ? '、今日' : ''}`);
      if (date === today) button.setAttribute('aria-current', 'date');
      button.append(element('span', 'day-number', String(Number(date.slice(8)))), element('span', 'day-count', count ? String(count) : ''));
      button.addEventListener('click', () => {
        fields.from.value = date;
        fields.to.value = date;
        render();
        // Re-rendering must not leave keyboard focus on the document body.
        $('calendar').querySelector(`[data-date="${date}"]`).focus({preventScroll: true});
      });
      return button;
    });
    $('calendar').replaceChildren(...cells);
  }
  function render(updateUrl = true) {
    const values = filters();
    const invalid = Boolean(values.from && values.to && values.from > values.to);
    const items = invalid ? [] : core.filterFestivals(data.events, values);
    $('filter-error').hidden = !invalid;
    $('filter-error').textContent = invalid ? '終了日は開始日と同じ日か、それより後の日付を指定してください。' : '';
    fields.to.setAttribute('aria-invalid', invalid ? 'true' : 'false');
    $('result-count').textContent = invalid ? '—' : `${items.length}件`;
    const conditions = [values.prefecture || '全国', values.from && values.to && values.from === values.to ? core.shortDate(values.from) : [values.from ? core.shortDate(values.from) + 'から' : '', values.to ? core.shortDate(values.to) + 'まで' : ''].filter(Boolean).join(' '), values.query ? `「${values.query}」` : '', core.ADMISSION[values.admission] || '', ({required:'要事前予約',not_required:'事前予約不要',varies:'予約は対象者による',unknown:'予約は要確認'})[values.reservation] || ''].filter(Boolean);
    $('result-summary').textContent = invalid ? '日付の条件を確認してください。' : `${conditions.join(' · ')} / ${items.length}件の学園祭・文化祭${!values.from && !values.to ? '（開催終了を含む）' : ''}`;
    $('festival-list').replaceChildren(...items.map(card));
    $('empty').hidden = invalid || items.length > 0;
    $('clear-dates').disabled = !values.from && !values.to;
    $('reset').disabled = !Object.values(values).some(Boolean);
    renderCalendar(values);
    if (updateUrl) writeUrl(values);
  }
  function reset() { applyFilters({}); render(); }
  function bind() {
    $('filters').addEventListener('submit', event => event.preventDefault());
    for (const field of [fields.prefecture, fields.admission, fields.reservation]) field.addEventListener('change', () => render());
    fields.query.addEventListener('input', () => render());
    for (const field of [fields.from, fields.to]) field.addEventListener('change', () => { focusMonth(filters()); render(); });
    $('reset').addEventListener('click', reset);
    $('empty-reset').addEventListener('click', () => { reset(); fields.prefecture.focus(); });
    $('clear-dates').addEventListener('click', () => { fields.from.value = ''; fields.to.value = ''; render(); });
    $('previous-month').addEventListener('click', () => { month = Math.max(1, month - 1); renderCalendar(filters()); });
    $('next-month').addEventListener('click', () => { month = Math.min(12, month + 1); renderCalendar(filters()); });
    window.addEventListener('popstate', () => { const values = core.readFilters(window.location.search); applyFilters(values); focusMonth(values); render(false); });
    bound = true;
  }
  async function load() {
    if (loading) return;
    loading = true;
    $('loading').hidden = false;
    $('load-error').hidden = true;
    try {
      const response = await fetch('../school-festival-calendar/festivals.json', {cache: 'no-cache'});
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const canonical = core.validateData(await response.json());
      data = {...canonical, events:core.forLevel(canonical.events, level)};
      const prefectures = new Set(data.events.map(item => item.prefecture));
      fields.prefecture.replaceChildren(element('option', '', '全国すべて'));
      fields.prefecture.firstChild.value = '';
      for (const name of core.PREFECTURES) {
        const count = data.events.filter(item => item.prefecture === name).length;
        const option = element('option', '', `${name}（${count}件）`);
        option.value = name;
        fields.prefecture.append(option);
      }
      for (const field of Object.values(fields)) field.disabled = false;
      fields.query.maxLength = 100;
      $('coverage').textContent = `${data.events.length}件 / ${prefectures.size}都道府県を掲載`;
      $('checked-at').textContent = String(data.updated_at).slice(0,10).replaceAll('-', '/');
      $('checked-at').dateTime = String(data.updated_at).slice(0,10);

      const values = core.readFilters(window.location.search);
      applyFilters(values);
      focusMonth(values);
      if (!bound) bind();
      $('content').hidden = false;
      render(false);
    } catch (error) {
      $('content').hidden = true;
      $('load-error').hidden = false;
      $('checked-at').textContent = 'データを読み込めませんでした';
    } finally {
      $('loading').hidden = true;
      loading = false;
    }
  }
  $('retry').addEventListener('click', load);
  load();
})();
