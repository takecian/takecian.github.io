const assert = require('node:assert/strict');
const {segmentJapanese, duration, graphemes} = require('../static/rsvp-ai-news/reader.js');
for(const text of ['日本語を読みます。速さを変えます！','Claude Fable 5.1とMythos 5.1を発表。','長い工程を伴うソフトウェア開発。','👨‍👩‍👧‍👦が読む。']) {
 const chunks=segmentJapanese(text); assert.equal(chunks.join(''),text.replace(/\s/g,'')); assert(chunks.every(x=>! /^[、。！？]+$/.test(x)));
}
assert(duration('読む。',600)>duration('読む',600));assert(duration('読む',200)>duration('読む',1000));assert.equal(graphemes('👨‍👩‍👧‍👦').length,1);
console.log('PASS segmentation, Unicode, punctuation, duration');
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1365,height:1050}}); const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('file://'+__dirname+'/../static/rsvp-ai-news/index.html');
 await page.clock.install();
 assert.equal(await page.locator('.story').count(),6);assert.equal(await page.locator('#play').getAttribute('aria-pressed'),'false');
 const speed=page.locator('#speed');
 assert.equal(await speed.getAttribute('max'),'3000');
 assert.equal(await speed.getAttribute('min'),'200');
 assert.equal(await speed.getAttribute('step'),'50');
 assert.equal(await speed.inputValue(),'600');
 await speed.focus();await page.keyboard.press('End');
 assert.equal(await speed.inputValue(),'3000');
 assert((await page.locator('#speed-value').textContent()).includes('3000'));
 await page.keyboard.press('ArrowRight');assert.equal(await speed.inputValue(),'3000');
 await speed.evaluate(el=>{el.value='3050';el.dispatchEvent(new Event('input',{bubbles:true}));});
 assert.equal(await speed.inputValue(),'3000');
 await page.keyboard.press('Home');assert.equal(await speed.inputValue(),'200');
 await speed.fill('600');
 const initial=await page.locator('#position').textContent();await page.clock.fastForward(5000);assert.equal(await page.locator('#position').textContent(),initial);
 await page.locator('#play').click();await page.clock.fastForward(300);await page.locator('#play').click();const paused=await page.locator('#position').textContent();await page.clock.fastForward(3000);assert.equal(await page.locator('#position').textContent(),paused);
 await page.locator('#play').click();await page.clock.fastForward(2000);assert.notEqual(await page.locator('#position').textContent(),paused);
 await page.locator('#speed').fill('3000');assert((await page.locator('#speed-value').textContent()).includes('3000'));await page.clock.fastForward(3000);
 await page.locator('#restart').click();assert.equal(await page.locator('#position').textContent(),initial);assert.equal(await page.locator('#play').getAttribute('aria-pressed'),'false');
 await page.locator('#next').click();assert.notEqual(await page.locator('#position').textContent(),initial);await page.locator('#previous').click();assert.equal(await page.locator('#position').textContent(),initial);
 await page.locator('#article').selectOption('gpt-6-astra');assert((await page.locator('#topic').textContent()).includes('Astra'));
 const max=await page.locator('#seek').getAttribute('max');await page.locator('#seek').fill(max);await page.locator('#play').click();await page.clock.fastForward(5000);assert.equal(await page.locator('#state').textContent(),'読み終わりました');assert.equal(await page.locator('#play').getAttribute('aria-pressed'),'false');await page.locator('#play').click();assert((await page.locator('#position').textContent()).startsWith('1 /'));
 await page.locator('#restart').click();await page.locator('h1').click();await page.keyboard.press('Space');assert.equal(await page.locator('#play').getAttribute('aria-pressed'),'true');await page.keyboard.press('Space');assert.equal(await page.locator('#play').getAttribute('aria-pressed'),'false');await page.keyboard.press('ArrowRight');assert((await page.locator('#position').textContent()).startsWith('2 /'));await page.keyboard.press('r');assert((await page.locator('#position').textContent()).startsWith('1 /'));
 await page.locator('#article').selectOption('all');await page.locator('#speed').fill('600');
 await page.screenshot({path:__dirname+'/desktop.png',fullPage:true});
 for(const width of [320,390,768]) {await page.setViewportSize({width,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));}
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:__dirname+'/mobile.png',fullPage:true});
 await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await page.evaluate(()=>getComputedStyle(document.documentElement).scrollBehavior),'auto');
 assert.deepEqual(errors,[]);console.log('PASS no autoplay, six articles, play/pause/resume, live speed, restart, prev/next, selection, seek, end/replay, keyboard, 320/390/768px overflow, reduced motion, no JS errors');
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
