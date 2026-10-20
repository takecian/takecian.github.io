(function (root) {
  'use strict';

  const CAUSE_CATEGORIES = [
    'Web・APIの脆弱性',
    '機器・ソフトウェアの脆弱性',
    'ランサムウェア攻撃',
    'サプライチェーン・委託先',
    '不正ログイン・認証不備',
    'マルウェア感染',
    '設定不備・人的ミス',
    '内部不正・情報持ち出し'
  ];

  const SECTORS = [
    'IT・クラウド・SaaS',
    'EC・小売・飲食',
    '金融・保険',
    '交通・モビリティ・インフラ',
    'エンタメ・メディア',
    '製造・建設・その他',
    '医療・教育・公的機関'
  ];

  const REGIONS = ['国内', '海外'];

  const SCALES = [
    {id: '1m_plus', label: '100万件以上', min: 1000000},
    {id: '100k_plus', label: '10万件以上', min: 100000},
    {id: '10k_plus', label: '1万件以上', min: 10000},
    {id: 'under_10k', label: '1万件未満・件数非公表', min: 0}
  ];

  const IMPACT_STATUSES = [
    '漏えい確認',
    '漏えいのおそれ',
    '調査の結果漏えいなし',
    '調査で漏えい未確認'
  ];

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
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
    } catch (_) {
      return null;
    }
  }

  function validateData(data) {
    if (!data || !Number.isInteger(data.year) || data.year < 2000 || data.year > 2100 || !isDate(data.checkedAt) || !Array.isArray(data.incidents) || !data.incidents.length) {
      throw new Error('Invalid breach dataset');
    }
    const ids = new Set();
    for (const item of data.incidents) {
      if (
        !item ||
        !['id', 'organization', 'service', 'title', 'causeCategory', 'sector', 'region', 'scaleLabel', 'impactStatus', 'summary', 'causeDetail', 'sourceType'].every(
          key => typeof item[key] === 'string' && item[key].trim()
        ) ||
        ids.has(item.id) ||
        !CAUSE_CATEGORIES.includes(item.causeCategory) ||
        !SECTORS.includes(item.sector) ||
        !REGIONS.includes(item.region) ||
        !IMPACT_STATUSES.includes(item.impactStatus) ||
        !Number.isSafeInteger(item.affectedRecords) ||
        item.affectedRecords < 0 ||
        !Array.isArray(item.dates) ||
        !item.dates.length ||
        !Array.isArray(item.leakedData) ||
        !item.leakedData.length ||
        item.leakedData.some(x => typeof x !== 'string' || !x.trim()) ||
        !Array.isArray(item.learnings) ||
        item.learnings.length < 2 ||
        item.learnings.some(x => typeof x !== 'string' || !x.trim()) ||
        !isDate(item.checkedAt) || item.checkedAt > data.checkedAt ||
        !safeUrl(item.officialUrl) ||
        !safeUrl(item.sourceUrl)
      ) {
        throw new Error(`Invalid incident record: ${item && item.id}`);
      }
      if (item.dates.some(date => !isDate(date) || date > item.checkedAt) || new Set(item.dates).size !== item.dates.length) {
        throw new Error(`Invalid incident dates: ${item.id}`);
      }
      const dates = [...item.dates].sort();
      if (item.disclosedAt !== dates[0] || item.updatedAt !== dates[dates.length - 1]) {
        throw new Error(`Incident disclosedAt/updatedAt does not match dates: ${item.id}`);
      }
      if (item.technical !== undefined) {
        const tech = item.technical;
        const nonempty = value => typeof value === 'string' && !!value.trim();
        if (!tech || !['entryPoint', 'vulnerability', 'exfiltration', 'unknowns', 'interpretation'].every(key => nonempty(tech[key])) ||
          !Array.isArray(tech.attackFlow) || !tech.attackFlow.length || !tech.attackFlow.every(nonempty) ||
          !Array.isArray(tech.sources) || !tech.sources.length || !tech.sources.every(source => source && nonempty(source.title) && safeUrl(source.url) && nonempty(source.locator) && (source.date === null || isDate(source.date) && source.date <= item.checkedAt))) {
          throw new Error(`Invalid technical explanation: ${item.id}`);
        }
      }
      ids.add(item.id);
    }
    return data;
  }

  function normalize(value) {
    return String(value || '').normalize('NFKC').toLocaleLowerCase('ja').trim();
  }

  function matchesScale(item, scaleId) {
    if (!scaleId) return true;
    if (scaleId === '1m_plus') return item.affectedRecords >= 1000000;
    if (scaleId === '100k_plus') return item.affectedRecords >= 100000;
    if (scaleId === '10k_plus') return item.affectedRecords >= 10000;
    if (scaleId === 'under_10k') return item.affectedRecords < 10000;
    return true;
  }

  function matches(item, filters = {}) {
    if (filters.cause && item.causeCategory !== filters.cause) return false;
    if (filters.sector && item.sector !== filters.sector) return false;
    if (filters.region && item.region !== filters.region) return false;
    if (filters.scale && !matchesScale(item, filters.scale)) return false;

    const words = normalize(filters.query).split(/\s+/).filter(Boolean);
    if (words.length) {
      const haystack = normalize(
        [
          item.organization,
          item.service,
          item.title,
          item.causeCategory,
          item.sector,
          item.region,
          item.scaleLabel,
          item.summary,
          item.causeDetail,
          ...(item.leakedData || []),
          ...(item.learnings || []),
          ...(item.tags || []),
          ...(item.technical ? [item.technical.entryPoint, item.technical.vulnerability, ...item.technical.attackFlow, item.technical.exfiltration, item.technical.unknowns, item.technical.interpretation] : [])
        ].join(' ')
      );
      if (!words.every(word => haystack.includes(word))) return false;
    }

    return item.dates.some(date => (!filters.from || date >= filters.from) && (!filters.to || date <= filters.to));
  }

  function filterIncidents(items, filters = {}) {
    return items
      .filter(item => matches(item, filters))
      .sort((a, b) => b.disclosedAt.localeCompare(a.disclosedAt) || b.affectedRecords - a.affectedRecords || a.organization.localeCompare(b.organization, 'ja'));
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
    for (const item of items) {
      for (const date of item.dates) {
        counts.set(date, (counts.get(date) || 0) + 1);
      }
    }
    return counts;
  }

  function causeCounts(items) {
    const counts = new Map(CAUSE_CATEGORIES.map(category => [category, 0]));
    for (const item of items) {
      counts.set(item.causeCategory, (counts.get(item.causeCategory) || 0) + 1);
    }
    return counts;
  }

  function shortDate(date) {
    const value = new Date(`${date}T00:00:00Z`);
    return `${value.getUTCFullYear()}/${value.getUTCMonth() + 1}/${value.getUTCDate()}（${'日月火水木金土'[value.getUTCDay()]}）`;
  }

  function dateLabel(item) {
    const dates = [...item.dates].sort();
    if (dates.length === 1) return `公表：${shortDate(dates[0])}`;
    return `${item.disclosedAtQualifier ? '確認済み公表' : '初報'}：${shortDate(dates[0])} / 続報：${shortDate(dates[dates.length - 1])}`;
  }

  function formatCount(records) {
    if (!records || records <= 0) return '件数非公表・調査中';
    if (records >= 10000) {
      const man = Math.round((records / 10000) * 10) / 10;
      return `約${man.toLocaleString('ja-JP')}万件`;
    }
    return `${records.toLocaleString('ja-JP')}件`;
  }

  function readFilters(search) {
    const params = new URLSearchParams(search);
    const cause = params.get('cause') || '';
    const sector = params.get('sector') || '';
    const region = params.get('region') || '';
    const scale = params.get('scale') || '';
    const from = params.get('from') || '';
    const to = params.get('to') || '';
    return {
      cause: CAUSE_CATEGORIES.includes(cause) ? cause : '',
      sector: SECTORS.includes(sector) ? sector : '',
      region: REGIONS.includes(region) ? region : '',
      scale: SCALES.some(s => s.id === scale) ? scale : '',
      from: isDate(from) ? from : '',
      to: isDate(to) ? to : '',
      query: (params.get('q') || '').slice(0, 100)
    };
  }

  const api = {
    CAUSE_CATEGORIES,
    SECTORS,
    REGIONS,
    SCALES,
    IMPACT_STATUSES,
    isoDate,
    isDate,
    japanToday,
    safeUrl,
    validateData,
    normalize,
    matchesScale,
    matches,
    filterIncidents,
    monthCells,
    dayCounts,
    causeCounts,
    shortDate,
    dateLabel,
    formatCount,
    readFilters
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.BreachNote = api;
})(typeof window !== 'undefined' ? window : globalThis);
