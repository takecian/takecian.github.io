// Optional real-browser integration and responsive checks. The default mode
// serves the static source through Playwright routing, without a local server.
// SCHOOL_FESTIVAL_TEST_BASE=https://takecian.github.io/ checks a deployed build.
// SCREENSHOT_DIR=/tmp/school-festival-screenshots saves desktop/mobile captures.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {chromium} = require('playwright');
// Keep this script dependency-light: the repository uses Playwright directly,
// without the separate @playwright/test runner.
const expect = locator => ({
  toBeVisible: () => locator.waitFor({state:'visible'}),
  toBeHidden: () => locator.waitFor({state:'hidden'}),
  async toHaveCount(expected) {
    const deadline = Date.now() + 5000;
    while (await locator.count() !== expected && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 25));
    assert.equal(await locator.count(), expected);
  }
});
const source = path.join(__dirname, '../static');
const core = require(path.join(source, 'school-festival-calendar/calendar.js'));
const data = JSON.parse(fs.readFileSync(path.join(source, 'school-festival-calendar/festivals.json'), 'utf8'));
const base = process.env.SCHOOL_FESTIVAL_TEST_BASE || 'http://school-festival.test/';
const routes = [
  {route:'high-school-festival-calendar', level:'high', other:'junior-high-school-festival-calendar'},
  {route:'junior-high-school-festival-calendar', level:'junior_high', other:'high-school-festival-calendar'}
];
const normalize = value => String(value || '').normalize('NFKC').toLocaleLowerCase('ja').trim();
const reservation = item => item.admission.reservation_policy === 'varies_by_visitor' ? 'varies' : item.admission.reservation_required === true ? 'required' : item.admission.reservation_required === false ? 'not_required' : 'unknown';
function matching(items, filters = {}) {
  return items.filter(item => (!filters.prefecture || item.prefecture === filters.prefecture)
    && (!filters.admission || item.admission.type === filters.admission)
    && (!filters.reservation || reservation(item) === filters.reservation)
    && normalize(filters.query).split(/\s+/).filter(Boolean).every(word => normalize([item.school_name,item.festival_name,item.prefecture].join(' ')).includes(word))
    && item.public_dates.some(day => (!filters.from || day >= filters.from) && (!filters.to || day <= filters.to)));
}
async function cardsMatch(page, items) {
  await expect(page.locator('.festival-card')).toHaveCount(items.length);
  const ids = await page.locator('.festival-card').evaluateAll(cards => cards.map(card => card.dataset.festivalId));
  assert.equal(new Set(ids).size, ids.length, 'Joint events must not duplicate within a view');
  assert.deepEqual(ids.sort(), items.map(item => item.id).sort());
}
async function reset(page) {
  if (!await page.locator('#reset').isDisabled()) await page.locator('#reset').click();
}
async function screenshot(page, filename) {
  if (!process.env.SCREENSHOT_DIR) return;
  fs.mkdirSync(process.env.SCREENSHOT_DIR, {recursive:true});
  await page.screenshot({path:path.join(process.env.SCREENSHOT_DIR, filename), fullPage:true});
}

(async () => {
  const browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless:true, args:['--no-sandbox']});
  try {
    const context = await browser.newContext({viewport:{width:1365,height:1050}, locale:'ja-JP', timezoneId:'Asia/Tokyo', serviceWorkers:'block'});
    if (!process.env.SCHOOL_FESTIVAL_TEST_BASE) {
      await context.route('http://school-festival.test/**', async route => {
        const pathname = decodeURIComponent(new URL(route.request().url()).pathname);
        const relative = pathname.endsWith('/') ? `${pathname}index.html` : pathname;
        const filename = path.resolve(source, '.' + relative);
        if (!filename.startsWith(source + path.sep) || !fs.existsSync(filename) || !fs.statSync(filename).isFile()) return route.fulfill({status:404,body:'Not found'});
        const contentType = {'.html':'text/html; charset=utf-8','.css':'text/css','.js':'application/javascript','.json':'application/json','.png':'image/png','.svg':'image/svg+xml'}[path.extname(filename)] || 'application/octet-stream';
        await route.fulfill({status:200,contentType,body:fs.readFileSync(filename)});
      });
    }
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    for (const {route, level, other} of routes) {
      const items = data.events.filter(item => item.school_levels.includes(level));
      const url = new URL(`${route}/`, base).href;
      const requests = [];
      const recordRequest = request => { if (new URL(request.url()).pathname.endsWith('.json')) requests.push(new URL(request.url()).pathname); };
      page.on('request', recordRequest);
      await page.goto(url);
      await expect(page.locator('#content')).toBeVisible();
      assert.deepEqual(requests, ['/school-festival-calendar/festivals.json']);
      page.off('request', recordRequest);
      assert.equal(await page.locator('body').getAttribute('data-school-level'), level);
      await cardsMatch(page, items);
      await expect(page.locator('#prefecture option')).toHaveCount(48);
      assert.equal(await page.locator('.calendar-types a[aria-current="page"]').getAttribute('href'), `/${route}/`);
      assert.equal(await page.locator('#coverage').textContent(), `${items.length}件 / ${new Set(items.map(item => item.prefecture)).size}都道府県を掲載`);
      for (const item of items) {
        const card = page.locator(`[data-festival-id="${item.id}"]`);
        assert.equal(await card.locator('.festival-date').textContent(), `公開日${core.dateLabel(item)}`);
        const detail = await card.locator('.admission-details').textContent();
        assert(detail.includes(item.admission.eligible_visitors), item.id);
        assert(detail.includes(item.admission.reservation_text), item.id);
        for (const field of ['deadline_text','reservation_window_text']) {
          if (item.admission[field]) assert(detail.includes(item.admission[field]), `${item.id}: preserve ${field}`);
        }
        assert.equal(await card.locator('.admission-tag').textContent(), core.ADMISSION[item.admission.type]);
        assert.equal(await card.locator('.reservation-tag').textContent(), core.reservationLabel(item.admission));
        assert.equal(await card.locator('.joint-tag').count(), Number(item.school_levels.length > 1));
        assert.equal(await card.locator('.official-link').getAttribute('href'), core.safeUrl(item.official_url));
        const unavailable = item.sources.filter(source => source.available === false);
        if (unavailable.length) {
          assert.equal(await card.locator('.source-caveat').count(), 1);
          const hrefs = await card.locator('a').evaluateAll(links => links.map(link => link.href));
          for (const source of unavailable) assert(!hrefs.includes(core.safeUrl(source.url)), `${item.id}: omit known unavailable link`);
        }
        for (const link of await card.locator('a').all()) {
          assert((await link.getAttribute('href')).startsWith('https://'));
          assert.equal(await link.getAttribute('rel'), 'noopener noreferrer');
        }
      }
      for (const admission of Object.keys(core.ADMISSION)) {
        await page.locator('#admission').selectOption(admission);
        await cardsMatch(page, items.filter(item => item.admission.type === admission));
      }
      await reset(page);
      for (const value of ['required','not_required','varies','unknown']) {
        await page.locator('#reservation').selectOption(value);
        await cardsMatch(page, items.filter(item => reservation(item) === value));
        if (value === 'unknown') assert.equal(await page.locator('.reservation-tag.not_required').count(), 0);
      }
      await reset(page);
      const sample = items.find(item => reservation(item) === 'required') || items[0];
      const day = sample.public_dates[0];
      const filters = {prefecture:sample.prefecture, from:day, to:day, admission:sample.admission.type, reservation:reservation(sample), query:sample.school_name};
      await page.locator('#prefecture').selectOption(filters.prefecture);
      await page.locator('#admission').selectOption(filters.admission);
      await page.locator('#reservation').selectOption(filters.reservation);
      await page.locator('#from').fill(day);
      await page.locator('#to').fill(day);
      await page.locator('#to').blur();
      await page.locator('#query').fill(filters.query);
      await cardsMatch(page, matching(items, filters));
      assert(new URL(page.url()).searchParams.get('admission') === filters.admission);
      const countBeforeNavigation = await page.locator('.festival-card').count();
      const forward = !await page.locator('#next-month').isDisabled();
      await page.locator(forward ? '#next-month' : '#previous-month').click();
      assert.equal(await page.locator('.festival-card').count(), countBeforeNavigation);
      await page.locator(forward ? '#previous-month' : '#next-month').click();
      await page.locator(`[data-date="${day}"]`).focus();
      await page.keyboard.press('Enter');
      assert.equal(await page.evaluate(() => document.activeElement.dataset.date), day);
      assert.equal(await page.locator(`[data-date="${day}"]`).getAttribute('aria-pressed'), 'true');
      await page.locator('#clear-dates').click();
      for (const field of ['prefecture','admission','reservation','query']) assert.equal(await page.locator(`#${field}`).inputValue(), filters[field]);
      await cardsMatch(page, matching(items, {...filters,from:'',to:''}));
      await page.locator('#query').fill('存在しない学園祭テスト');
      await expect(page.locator('#empty')).toBeVisible();
      await page.locator('#empty-reset').click();
      await cardsMatch(page, items);
      assert.equal(await page.locator('#admission').inputValue(), '');
      assert.equal(await page.locator('#reservation').inputValue(), '');
      assert.equal(new URL(page.url()).search, '');
      await page.locator('#from').fill('2026-11-03');
      await page.locator('#to').fill('2026-11-01');
      await page.locator('#to').blur();
      await expect(page.locator('#filter-error')).toBeVisible();
      assert.equal(await page.locator('#to').getAttribute('aria-invalid'), 'true');
      await expect(page.locator('#empty')).toBeHidden();
      await reset(page);

      const search = new URLSearchParams({prefecture:sample.prefecture,from:day,to:day,admission:sample.admission.type,reservation:reservation(sample),q:sample.school_name,level:'university',school_level:level === 'high' ? 'junior_high' : 'high'});
      await page.goto(url + '?' + search);
      await expect(page.locator('#content')).toBeVisible();
      await cardsMatch(page, matching(items, filters));
      assert.equal(await page.locator('#month-title').textContent(), `2026年 ${Number(day.slice(5,7))}月`);
      const filteredUrl = page.url();
      await page.locator(`.calendar-types a[href="/${other}/"]`).click();
      await expect(page.locator('#content')).toBeVisible();
      const otherLevel = level === 'high' ? 'junior_high' : 'high';
      await cardsMatch(page, data.events.filter(item => item.school_levels.includes(otherLevel)));
      await page.goBack();
      await expect(page.locator('#content')).toBeVisible();
      assert.equal(page.url(), filteredUrl);
      await cardsMatch(page, matching(items, filters));
      await page.goto(url + '?admission=bogus&reservation=nope&from=2026-02-29&prefecture=nope');
      await expect(page.locator('#content')).toBeVisible();
      await cardsMatch(page, items);
      for (const field of ['admission','reservation','from','prefecture']) assert.equal(await page.locator(`#${field}`).inputValue(), '');

      // Keep captures readable while exercising the longest admission content.
      const longest = [...items].sort((a,b) => JSON.stringify(b.admission).length - JSON.stringify(a.admission).length)[0];
      await page.locator('#query').fill(longest.school_name);
      await screenshot(page, `${route}-desktop.png`);
      for (const width of [320,390,640,768,1024,1365]) {
        await page.setViewportSize({width,height:844});
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${route}: horizontal overflow at ${width}px`);
        for (const id of ['prefecture','from','to','query','admission','reservation']) {
          const box = await page.locator(`#${id}`).boundingBox();
          assert(box && box.width > 0 && box.x >= 0 && box.x + box.width <= width, `${route}: ${id} outside ${width}px viewport`);
        }
        if (width === 320 || width === 390) await screenshot(page, `${route}-mobile-${width}.png`);
      }
      await page.setViewportSize({width:390,height:844});
      await page.emulateMedia({reducedMotion:'reduce'});
      assert.equal(await page.locator('.festival-card').first().evaluate(node => getComputedStyle(node).transitionDuration), '0s');
      await page.emulateMedia({reducedMotion:'no-preference'});
      await page.setViewportSize({width:1365,height:1050});
    }

    // Interrupted loads and repeated retry clicks must recover with one request.
    const jsonUrl = new URL('school-festival-calendar/festivals.json', base).href;
    let attempts = 0;
    const failureRoute = async route => {
      attempts++;
      if (attempts === 1) return route.fulfill({status:503,body:'Temporarily unavailable'});
      await new Promise(resolve => setTimeout(resolve, 100));
      await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
    };
    await page.route(jsonUrl, failureRoute);
    await page.goto(new URL('high-school-festival-calendar/', base).href);
    await expect(page.locator('#load-error')).toBeVisible();
    await expect(page.locator('#content')).toBeHidden();
    await page.evaluate(() => { document.getElementById('retry').click(); document.getElementById('retry').click(); });
    await expect(page.locator('#content')).toBeVisible();
    assert.equal(attempts, 2);
    await cardsMatch(page, data.events.filter(item => item.school_levels.includes('high')));
    await page.unroute(jsonUrl, failureRoute);
    await page.route(jsonUrl, route => route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({...data,events:[]})}));
    await page.reload();
    await expect(page.locator('#load-error')).toBeVisible();
    await expect(page.locator('#content')).toBeHidden();
    assert.deepEqual(errors, []);
    console.log('PASS both routes, canonical JSON, no joint duplicates, exact admission/unknown filters, dates, keyboard focus, reset/deep links/Back, load/retry, 320–1365px overflow, reduced motion, no JS errors');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exit(1); });
