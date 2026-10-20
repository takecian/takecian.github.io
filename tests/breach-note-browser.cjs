const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {chromium} = require('playwright');
const api = require('../static/breach-note/breach-note.js');
const root = path.resolve(__dirname, '../static');
// Synthetic data is restricted to the intercepted test response.
const record = {
  id: 'test-only', organization: 'テスト企業', service: 'TEST API', title: '<img src=x onerror=alert(1)>',
  causeCategory: api.CAUSE_CATEGORIES[0], sector: api.SECTORS[0], region: '国内',
  scaleLabel: '10万件（テスト）', affectedRecords: 100000, impactStatus: '漏えいのおそれ',
  summary: 'テスト専用データ', causeDetail: '認証のテスト', sourceType: 'テスト資料',
  dates: ['2026-01-01','2026-02-02'], disclosedAt: '2026-01-01', updatedAt: '2026-02-02',
  leakedData: ['メールアドレス'], learnings: ['テスト項目1','テスト項目2'],
  checkedAt: '2026-02-03', officialUrl: 'https://example.com/official', sourceUrl: 'https://example.com/source'
};
(async () => {
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox']});
  try {
    let data = {year:2026,checkedAt:null,incidents:[]};
    let missingHelpers = false;
    const context = await browser.newContext();
    await context.route('https://breach.test/**', route => {
      const url = new URL(route.request().url());
      const name = path.resolve(root, '.' + (url.pathname.endsWith('/') ? url.pathname + 'index.html' : url.pathname));
      if (!name.startsWith(root + path.sep) || !fs.existsSync(name) || (missingHelpers && name.endsWith('/breach-note.js'))) return route.fulfill({status:404, body:''});
      let body = fs.readFileSync(name);
      if (name.endsWith('/index.html') && data !== undefined) body = body.toString().replace(/(<script id="breach-data" type="application\/json">).*?(<\/script>)/s, (_, start, end) => start + (typeof data === 'string' ? data : JSON.stringify(data).replace(/</g, '\\u003c')) + end);
      return route.fulfill({body, contentType: {'.html':'text/html; charset=utf-8','.js':'application/javascript','.css':'text/css'}[path.extname(name)]});
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('https://breach.test/breach-note/');
    assert.match(await page.locator('#message').innerText(), /まだ登録されていません/);
    assert.match(await page.locator('#coverage').innerText(), /まだ登録されていません/);
    assert.equal(await page.locator('#cause option').count(), api.CAUSE_CATEGORIES.length + 1);
    assert.equal(await page.locator('link[rel=canonical]').getAttribute('href'), 'https://takecian.github.io/breach-note/');
    await page.locator('#from').fill('2026-05-01');
    await page.locator('#to').fill('2026-04-01');
    assert.equal(await page.locator('#date-error').isVisible(), true);
    await page.locator('button[type=reset]').click();
    assert.equal(await page.locator('#date-error').isVisible(), false);
    assert.equal(new URL(page.url()).search, '');
    for (const width of [375, 1280]) {
      await page.setViewportSize({width,height:900});
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      if (process.env.SCREENSHOT_DIR) {
        fs.mkdirSync(process.env.SCREENSHOT_DIR, {recursive:true});
        await page.screenshot({path:path.join(process.env.SCREENSHOT_DIR, `breach-note-${width}.png`),fullPage:true});
      }
    }
    data = {year:2026, checkedAt:'2026-02-03', incidents:[record]};
    await page.goto('https://breach.test/breach-note/?q=ＴＥＳＴ%20API&from=2026-02-02&to=2026-02-02&scale=100k_plus');
    assert.equal(await page.locator('.incident').count(), 1);
    assert.equal(await page.locator('.incident img').count(), 0);
    assert.equal(await page.locator('.incident h3').innerText(), record.title);
    await page.locator('#scale').selectOption('1m_plus');
    assert.equal(await page.locator('.incident').count(), 0);
    assert.match(await page.locator('#message').innerText(), /一致する事例はありません/);
    await page.locator('button[type=reset]').click();
    await page.locator('summary').click();
    assert.equal(await page.locator('.incident a').first().getAttribute('href'), record.officialUrl);
    await page.locator('#query').fill('test 無関係');
    assert.equal(await page.locator('.incident').count(), 0);
    await page.goto('https://breach.test/breach-note/?cause=unknown&from=bad');
    assert.equal(await page.locator('.incident').count(), 1);
    assert.equal(await page.locator('#cause').inputValue(), '');
    for (const malformed of ['{invalid', {year:2026,checkedAt:null,incidents:[record]}, {year:2026,checkedAt:'2026-02-03',incidents:[{...record,officialUrl:'javascript:alert(1)'}]}]) {
      data = malformed;
      await page.reload();
      assert.match(await page.locator('#message').innerText(), /読み込めませんでした/);
      assert.equal(await page.locator('#query').isDisabled(), true);
    }
    data = undefined;
    await page.goto('https://breach.test/breach-note/');
    const production = JSON.parse(fs.readFileSync(path.join(root,'breach-note/index.html'),'utf8').match(/<script id="breach-data" type="application\/json">(.*?)<\/script>/s)[1]);
    assert.equal(await page.locator('.incident').count(), production.incidents.length);
    assert.match(await page.locator('#result-count').innerText(), new RegExp(`登録 ${production.incidents.length}件`));
    await page.locator('.incident summary').first().click();
    assert.match(await page.locator('.incident .meta').first().innerText(), /20\d{2}\//);
    assert.equal(await page.locator('.technical').count(), production.incidents.length);
    assert.match(await page.locator('.technical').first().innerText(), /侵入口・アクセスの起点/);
    assert.match(await page.locator('.technical').first().innerText(), /分かっていないこと/);
    assert.match(await page.locator('.technical').first().innerText(), /一般論・編集上の整理/);
    assert.ok(await page.locator('.technical-sources a').count() >= production.incidents.length);
    for (const width of [375,1280]) {
      await page.setViewportSize({width,height:900});
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    }
    if (process.env.SCREENSHOT_DIR) await page.screenshot({path:path.join(process.env.SCREENSHOT_DIR, 'breach-note-populated.png'),fullPage:true});
    await page.locator('#query').fill(production.incidents[0].organization);
    assert.ok(await page.locator('.incident').count() >= 1);
    await page.locator('button[type=reset]').click();
    assert.equal(await page.locator('.incident').count(), production.incidents.length);
    missingHelpers = true;
    await page.reload();
    assert.match(await page.locator('#message').innerText(), /読み込めませんでした/);
    assert.deepEqual(errors, []);
    const nojs = await browser.newContext({javaScriptEnabled:false});
    await nojs.route('**/*', route => route.fulfill({body:fs.readFileSync(path.join(root,'breach-note/index.html')),contentType:'text/html'}));
    const plain = await nojs.newPage();
    await plain.goto('https://breach.test/');
    assert.match(await plain.locator('noscript').innerText(), /JavaScript が必要/);
    console.log('PASS: empty/data/error states, filters, URL restore/reset, safe rendering, responsive layout, no-JS fallback');
  } finally { await browser.close(); }
})().catch(error => {console.error(error);process.exitCode = 1;});
