// No dependencies: exercise the production script with a minimal DOM and fake clock.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.join(__dirname, '../static/rsvp-ai-news');
const { segmentJapanese, duration, graphemes } = require(path.join(root, 'reader.js'));
function setup(segmenter = true) {
  class Element {
    constructor(tag = 'DIV') { this.tagName = tag; this.value = ''; this.children = []; this.listeners = {}; this.attributes = {}; this.textContent = ''; }
    addEventListener(name, fn) { this.listeners[name] = fn; }
    append(...children) { this.children.push(...children); }
    replaceChildren(...children) { this.children = children; }
    setAttribute(name, value) { this.attributes[name] = value; }
    scrollIntoView() {} focus() {}
    fire(name, extra = {}) { this.listeners[name]?.({ target: this, preventDefault() {}, ...extra }); }
  }
  const els = {};
  for (const id of ['article','speed','speed-value','state','word','before','focus','after','topic','position','seek','remaining','previous','next','play','restart','stories','reader-title']) els[id] = new Element();
  els.article.value = 'all'; els.speed.value = '600';
  const listeners = {};
  const document = { getElementById: id => els[id], createElement: tag => new Element(tag.toUpperCase()), createTextNode: text => ({textContent:text}), addEventListener: (name, fn) => listeners[name] = fn, hidden: false };
  let now = 0, nextId = 0; const timers = new Map();
  const context = vm.createContext({ window: {}, document, Intl: segmenter ? Intl : {}, performance: { now: () => now }, setTimeout: (fn, delay) => { timers.set(++nextId,{fn,at:now+delay});return nextId; }, clearTimeout: id => timers.delete(id) });
  vm.runInContext(fs.readFileSync(path.join(root,'news.js'),'utf8'),context);
  vm.runInContext(fs.readFileSync(path.join(root,'reader.js'),'utf8'),context);
  function tick(ms) { const end=now+ms; for(;;) {const entry=[...timers].sort((a,b)=>a[1].at-b[1].at)[0];if(!entry || entry[1].at>end)break;now=entry[1].at;timers.delete(entry[0]);entry[1].fn();} now=end; }
  return {els, tick, timers, listeners, document};
}
test('Japanese segmentation preserves characters; Unicode and punctuation timing',()=>{
  for(const text of ['日本語を読みます。速さを変えます！','Claude Fable 5.1とMythos 5.1を発表。','長い工程を伴うソフトウェア開発。','👨‍👩‍👧‍👦が読む。']) {const chunks=segmentJapanese(text);assert.equal(chunks.join(''),text.replace(/\s/g,''));assert(chunks.every(x=>! /^[、。！？]+$/.test(x)));}
  assert(duration('読む。',600)>duration('読む',600));assert(duration('読む',200)>duration('読む',1000));assert.equal(graphemes('👨‍👩‍👧‍👦').length,1);
});
test('no autoplay; pause/resume preserves remaining time; no duplicate timers',()=>{
 const {els:e,tick,timers}=setup();assert.equal(e.stories.children.length,6);const initial=e.position.textContent;tick(5000);assert.equal(e.position.textContent,initial);e.play.fire('click');assert.equal(timers.size,1);tick(200);e.play.fire('click');assert.equal(timers.size,0);tick(5000);assert.equal(e.position.textContent,initial);e.play.fire('click');tick(2000);assert.notEqual(e.position.textContent,initial);assert.equal(timers.size,1);
});
test('live speed, next/previous, restart and article selection reset safely',()=>{
 const {els:e,tick,timers}=setup();const initial=e.position.textContent;e.play.fire('click');e.speed.value='1400';e.speed.fire('input');assert.equal(timers.size,1);tick(1000);e.restart.fire('click');assert.equal(e.position.textContent,initial);assert.equal(timers.size,0);e.next.fire('click');assert(e.position.textContent.startsWith('2 /'));e.previous.fire('click');assert.equal(e.position.textContent,initial);e.article.value='gpt-6-astra';e.article.fire('change');assert(e.topic.textContent.includes('Astra'));assert(e.position.textContent.startsWith('1 /'));
});
test('seek to final chunk, automatic stop, replay, hidden-tab pause, keyboard',()=>{
 const {els:e,tick,timers,listeners,document}=setup();e.seek.value=e.seek.max;e.seek.fire('input');e.play.fire('click');tick(5000);assert.equal(e.state.textContent,'読み終わりました');assert.equal(timers.size,0);e.play.fire('click');assert(e.position.textContent.startsWith('1 /'));document.hidden=true;listeners.visibilitychange();assert.equal(timers.size,0);document.hidden=false;
 const key = (key,code=key,tag='BODY')=>listeners.keydown({key,code,target:{tagName:tag},preventDefault(){}});key(' ','Space');assert.equal(timers.size,1);key(' ','Space');assert.equal(timers.size,0);key('ArrowRight');assert(e.position.textContent.startsWith('2 /'));key('r');assert(e.position.textContent.startsWith('1 /'));key(' ','Space','INPUT');assert.equal(timers.size,0);
});
test('fallback works without Intl.Segmenter',()=>{const {els:e,tick}=setup(false);e.play.fire('click');tick(2000);assert(!e.position.textContent.startsWith('1 /'));});
