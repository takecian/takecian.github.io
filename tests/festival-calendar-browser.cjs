// Optional real-browser integration and visual checks. No server is required:
// the default test URL is fulfilled from the source directory using Playwright.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {chromium} = require('playwright');
const source = path.join(__dirname, '../static/festival-calendar');
const core = require(path.join(source, 'calendar.js'));
const data = JSON.parse(fs.readFileSync(path.join(source, 'festivals.json'),'utf8'));
(async () => {
  const browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless:true, args:['--no-sandbox']});
  try {
    const page = await browser.newPage({viewport:{width:1365,height:1050}});
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    const base=process.env.FESTIVAL_TEST_URL || 'http://festival.test/festival-calendar/';
    if (!process.env.FESTIVAL_TEST_URL) await page.route('http://festival.test/festival-calendar/**',async route=>{
      const name=path.basename(new URL(route.request().url()).pathname)||'index.html';
      const filename=new URL(route.request().url()).pathname.endsWith('/')?'index.html':name;
      const contentType={'.html':'text/html','.css':'text/css','.js':'application/javascript','.json':'application/json'}[path.extname(filename)];
      if (!contentType) return route.fulfill({status:404,body:'Not found'});
      await route.fulfill({status:200,contentType,body:fs.readFileSync(path.join(source,filename))});
    });
    await page.goto(base);await page.locator('#content').waitFor({state:'visible'});
    assert.equal(await page.locator('.festival-card').count(),data.festivals.length);
    assert.equal(await page.locator('#prefecture option').count(),48);
    await page.locator('#prefecture').selectOption('東京都');
    await page.locator('#from').fill('2026-11-01');await page.locator('#to').fill('2026-11-03');await page.locator('#to').blur();
    assert.equal(await page.locator('.festival-card').count(),core.filterFestivals(data.festivals,{prefecture:'東京都',from:'2026-11-01',to:'2026-11-03'}).length);
    const beforeMonth=await page.locator('.festival-card').count();await page.locator('#next-month').click();assert.equal(await page.locator('.festival-card').count(),beforeMonth);await page.locator('#previous-month').click();
    await page.locator('[data-date="2026-11-01"]').click();assert.equal(await page.locator('#from').inputValue(),'2026-11-01');assert.equal(await page.locator('#to').inputValue(),'2026-11-01');
    assert.equal(await page.evaluate(()=>document.activeElement.dataset.date),'2026-11-01');
    await page.locator('#clear-dates').click();assert.equal(await page.locator('#prefecture').inputValue(),'東京都');
    await page.locator('#query').fill('存在しない学園祭');assert(await page.locator('#empty').isVisible());await page.locator('#empty-reset').click();assert.equal(await page.locator('.festival-card').count(),35);
    await page.locator('#from').fill('2026-11-03');await page.locator('#to').fill('2026-11-01');await page.locator('#to').blur();assert(await page.locator('#filter-error').isVisible());assert.equal(await page.locator('#to').getAttribute('aria-invalid'),'true');await page.locator('#reset').click();
    await page.goto(base+'?prefecture='+encodeURIComponent('東京都')+'&from=2026-11-01&to=2026-11-03');await page.locator('#content').waitFor({state:'visible'});assert.equal(await page.locator('#prefecture').inputValue(),'東京都');assert.equal(await page.locator('#month-title').textContent(),'2026年 11月');
    await page.locator('#reset').click();
    if(process.env.SCREENSHOT_DIR){fs.mkdirSync(process.env.SCREENSHOT_DIR,{recursive:true});await page.screenshot({path:path.join(process.env.SCREENSHOT_DIR,'festival-desktop.png'),fullPage:true});}
    for(const width of [320,390,640,768,1024,1365]){
      await page.setViewportSize({width,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),`horizontal overflow at ${width}px`);
      await page.locator('#prefecture').selectOption('東京都');assert(await page.locator('.festival-card').count()>0);await page.locator('#reset').click();
    }
    await page.setViewportSize({width:390,height:844});
    if(process.env.SCREENSHOT_DIR)await page.screenshot({path:path.join(process.env.SCREENSHOT_DIR,'festival-mobile.png'),fullPage:true});
    await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await page.locator('.festival-card').first().evaluate(el=>getComputedStyle(el).transitionDuration),'0s');
    assert.deepEqual(errors,[]);
    console.log('PASS real-browser filters, date overlap, clear/reset, no results, invalid range, deep links, calendar focus, 320–1365px overflow, reduced motion, no JS errors');
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exit(1);});
