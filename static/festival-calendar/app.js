(function () {
  'use strict';
  const core = window.FestivalCalendar;
  const $ = id => document.getElementById(id);
  const fields = {prefecture: $('prefecture'), from: $('from'), to: $('to'), query: $('query')};
  const today = core.japanToday();
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
    for (const [key, parameter] of [['prefecture','prefecture'],['from','from'],['to','to'],['query','q']]) {
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
    if (item.dates.includes(today)) top.append(element('span', 'status-tag ongoing', '本日開催'));
    else if (item.endDate < today) top.append(element('span', 'status-tag', '開催終了'));
    const dates = element('p', 'festival-date', core.dateLabel(item));
    const title = element('h3', '', item.name);
    const campus = element('p', 'campus', item.campus);
    article.append(top, dates, element('p', 'university', item.university), title, campus);
    if (item.notes) article.append(element('p', 'event-note', Array.isArray(item.notes) ? item.notes.join(' ') : item.notes));
    const links = element('div', 'card-links');
    links.append(sourceLink(item.officialUrl, '公式サイト ↗', 'official-link'));
    if (item.sourceUrl !== item.officialUrl) links.append(sourceLink(item.sourceUrl, '日程の出典 ↗', 'source-link'));
    article.append(links, element('p', 'source-check', `公式発表を確認：${item.checkedAt.replaceAll('-', '/')}`));
    return article;
  }
  function renderCalendar(values) {
    $('month-title').textContent = `2026年 ${month}月`;
    $('previous-month').disabled = month === 1;
    $('next-month').disabled = month === 12;
    const counts = core.dayCounts(core.filterFestivals(data.festivals, {prefecture: values.prefecture, query: values.query}));
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
    const items = invalid ? [] : core.filterFestivals(data.festivals, values);
    $('filter-error').hidden = !invalid;
    $('filter-error').textContent = invalid ? '終了日は開始日と同じ日か、それより後の日付を指定してください。' : '';
    fields.to.setAttribute('aria-invalid', invalid ? 'true' : 'false');
    $('result-count').textContent = invalid ? '—' : `${items.length}件`;
    const conditions = [values.prefecture || '全国', values.from && values.to && values.from === values.to ? core.shortDate(values.from) : [values.from ? core.shortDate(values.from) + 'から' : '', values.to ? core.shortDate(values.to) + 'まで' : ''].filter(Boolean).join(' '), values.query ? `「${values.query}」` : ''].filter(Boolean);
    $('result-summary').textContent = invalid ? '日付の条件を確認してください。' : `${conditions.join(' · ')} / ${items.length}件の学園祭${!values.from && !values.to ? '（開催終了を含む）' : ''}`;
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
    fields.prefecture.addEventListener('change', () => render());
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
      const response = await fetch('festivals.json', {cache: 'no-cache'});
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      data = core.validateData(await response.json());
      const prefectures = new Set(data.festivals.map(item => item.prefecture));
      fields.prefecture.replaceChildren(element('option', '', '全国すべて'));
      fields.prefecture.firstChild.value = '';
      for (const name of core.PREFECTURES) {
        const count = data.festivals.filter(item => item.prefecture === name).length;
        const option = element('option', '', `${name}（${count}件）`);
        option.value = name;
        fields.prefecture.append(option);
      }
      for (const field of Object.values(fields)) field.disabled = false;
      fields.query.maxLength = 100;
      $('coverage').textContent = `${data.festivals.length}学園祭 / ${prefectures.size}都道府県を掲載`;
      $('checked-at').textContent = data.checkedAt.replaceAll('-', '/');
      $('checked-at').dateTime = data.checkedAt;
      if (data.scope) $('scope').textContent = data.scope;
      const values = core.readFilters(window.location.search);
      applyFilters(values);
      focusMonth(values);
      if (!bound) bind();
      $('content').hidden = false;
      render(false);
    } catch (error) {
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
