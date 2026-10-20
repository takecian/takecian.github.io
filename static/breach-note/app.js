(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const message = $('message');
  function showMessage(text) { message.textContent = text; message.hidden = false; }
  try {
    const api = window.BreachNote;
    if (!api) throw new Error('Missing BreachNote helpers');
    const data = JSON.parse($('breach-data').textContent);
    // The initial page intentionally has no research data or claimed check date.
    const empty = data && Number.isInteger(data.year) && data.checkedAt === null && Array.isArray(data.incidents) && data.incidents.length === 0;
    if (!empty) api.validateData(data);
    const items = data.incidents;
    const form = $('filters');
    const controls = ['cause', 'sector', 'region', 'scale', 'from', 'to', 'query'];
    function element(tag, text, className) {
      const node = document.createElement(tag);
      if (text !== undefined) node.textContent = text;
      if (className) node.className = className;
      return node;
    }
    for (const [id, options] of Object.entries({cause: api.CAUSE_CATEGORIES, sector: api.SECTORS, region: api.REGIONS, scale: api.SCALES})) {
      for (const option of options) {
        const node = element('option', typeof option === 'string' ? option : option.label);
        node.value = typeof option === 'string' ? option : option.id;
        $(id).append(node);
      }
    }
    function restore() {
      const filters = api.readFilters(location.search);
      for (const id of controls) $(id).value = filters[id];
    }
    function card(item) {
      const article = element('article', undefined, 'incident');
      const tags = element('div', undefined, 'tags');
      for (const label of [item.impactStatus, item.causeCategory, item.sector, item.region]) tags.append(element('span', label, 'tag'));
      article.append(tags, element('h3', item.title), element('p', `${item.organization} / ${item.service}`), element('p', `${api.dateLabel(item)} · ${item.scaleLabel}`, 'meta'), element('p', item.summary));
      const details = element('details');
      details.append(element('summary', '技術解説・原因・学び・出典を読む'));
      const dl = element('dl');
      for (const [label, value] of [['原因', item.causeDetail], ['対象データ', item.leakedData.join('、')]]) dl.append(element('dt', label), element('dd', value));
      details.append(dl);
      if (item.technical) {
        const tech = item.technical;
        const section = element('section', undefined, 'technical');
        section.append(element('h4', '技術解説'), element('p', '公表資料で確認できる内容と、一般的な仕組みの解説を分けています。未公表の手口を推測で補っていません。', 'meta'));
        const facts = element('dl');
        for (const [label, value] of [['侵入口・アクセスの起点', tech.entryPoint], ['悪用された弱点・権限', tech.vulnerability]]) facts.append(element('dt', label), element('dd', value));
        section.append(facts, element('h5', '公表資料から追える流れ'));
        const flow = element('ol', undefined, 'attack-flow');
        for (const step of tech.attackFlow) flow.append(element('li', step));
        section.append(flow);
        const outcome = element('dl');
        for (const [label, value] of [['取得・持ち出しの方法と確認範囲', tech.exfiltration], ['分かっていないこと', tech.unknowns]]) outcome.append(element('dt', label), element('dd', value));
        section.append(outcome, element('h5', '仕組みの解説（一般論・編集上の整理）'), element('p', tech.interpretation), element('h5', '技術解説の根拠'));
        const refs = element('ul', undefined, 'technical-sources');
        for (const source of tech.sources) {
          const li = element('li');
          const link = element('a', source.title);
          link.href = api.safeUrl(source.url);
          li.append(link, element('span', `（${source.date || '公表日未確認'}） ${source.locator}`));
          refs.append(li);
        }
        section.append(refs); details.append(section);
      }
      details.append(element('h4', '対策のヒント（編集部の整理）'));
      const list = element('ul');
      for (const learning of item.learnings) list.append(element('li', learning));
      details.append(list);
      for (const [label, url] of [['公式発表', item.officialUrl], [item.sourceType + '（出典）', item.sourceUrl]]) {
        const p = element('p');
        const a = element('a', label);
        a.href = api.safeUrl(url);
        p.append(a); details.append(p);
      }
      details.append(element('p', `確認日：${item.checkedAt}`, 'meta'));
      article.append(details);
      return article;
    }
    function render(syncUrl = false) {
      const filters = Object.fromEntries(controls.map(id => [id, $(id).value]));
      const invalid = !!(filters.from && filters.to && filters.from > filters.to);
      $('date-error').hidden = !invalid;
      for (const id of ['from', 'to']) $(id).setAttribute('aria-invalid', String(invalid));
      if (syncUrl) {
        const url = new URL(location.href);
        for (const id of controls) {
          const key = id === 'query' ? 'q' : id;
          if (filters[id]) url.searchParams.set(key, filters[id]); else url.searchParams.delete(key);
        }
        history.replaceState(null, '', url);
      }
      $('incidents').replaceChildren();
      if (invalid) {
        $('result-count').textContent = '期間を確認してください';
        showMessage('日付の範囲を修正すると、事例を表示します。');
        return;
      }
      const results = api.filterIncidents(items, filters);
      $('result-count').textContent = `${results.length}件 / 登録 ${items.length}件`;
      message.hidden = results.length > 0;
      if (!items.length) showMessage('事例データはまだ登録されていません。調査・確認済みの情報を追加するまで、事例は表示されません。');
      else if (!results.length) showMessage('条件に一致する事例はありません。検索条件を変更してください。');
      $('incidents').append(...results.map(card));
    }
    $('coverage').textContent = items.length ? `登録 ${items.length}件 · データ確認日：${data.checkedAt}` : '事例データはまだ登録されていません。';
    form.addEventListener('submit', event => event.preventDefault());
    form.addEventListener('input', () => render(true));
    form.addEventListener('change', () => render(true));
    form.addEventListener('reset', event => {
      event.preventDefault();
      for (const id of controls) $(id).value = '';
      render(true);
    });
    window.addEventListener('popstate', () => { restore(); render(); });
    restore(); render();
  } catch (error) {
    $('incidents').replaceChildren();
    $('result-count').textContent = '';
    $('coverage').textContent = 'データを読み込めませんでした。';
    for (const control of $('filters').elements) control.disabled = true;
    showMessage('事例データを読み込めませんでした。時間をおいてページを再読み込みしてください。');
    console.error('BreachNote initialization failed:', error);
  }
})();
