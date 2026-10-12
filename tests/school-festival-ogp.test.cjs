const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

// Point SCHOOL_FESTIVAL_OGP_ROOT at Hugo's full output directory to repeat the
// same checks against the generated site. No JavaScript or network is needed.
const root = process.env.SCHOOL_FESTIVAL_OGP_ROOT || path.join(__dirname, '../static');
const data = JSON.parse(fs.readFileSync(path.join(root, 'school-festival-calendar/festivals.json'), 'utf8'));
const routes = [
  {route:'high-school-festival-calendar', level:'high', label:'高校'},
  {route:'junior-high-school-festival-calendar', level:'junior_high', label:'中学'}
];
const attributes = tag => Object.fromEntries([...tag.matchAll(/([\w:-]+)="([^"]*)"/g)].map(match => [match[1], match[2]]));

for (const {route, level, label} of routes) {
  const directory = path.join(root, route);
  const html = fs.readFileSync(path.join(directory, 'index.html'), 'utf8');
  const head = html.match(/<head>([\s\S]*?)<\/head>/i)[1];
  const metas = [...head.matchAll(/<meta\b[^>]*>/gi)].map(match => attributes(match[0]));
  const base = `https://takecian.github.io/${route}/`;
  function meta(key, attribute = 'property') {
    const matches = metas.filter(tag => tag[attribute] === key);
    assert.equal(matches.length, 1, `${route}: ${key} must appear exactly once`);
    assert(matches[0].content, `${route}: ${key} cannot be blank`);
    return matches[0].content;
  }
  test(`${route}: crawlers receive complete, school-specific static metadata`, () => {
    const title = head.match(/<title>([^<]+)<\/title>/)[1];
    assert.equal(title, `${label}学園祭・文化祭カレンダー ${data.year} | takecian`);
    assert.equal(meta('og:title'), title);
    assert.equal(meta('og:description'), meta('description', 'name'));
    assert(meta('og:description').includes(`${data.year}年の${label}`));
    assert.equal(meta('og:type'), 'website');
    assert.equal(meta('og:url'), base);
    assert.equal(meta('og:locale'), 'ja_JP');
    assert.equal(meta('og:site_name'), `${label}学園祭・文化祭カレンダー | takecian`);
    assert.match(html, /<html\b[^>]*\blang="ja"[^>]*\bprefix="og: https:\/\/ogp.me\/ns#"/);
    const canonicals = [...head.matchAll(/<link\b[^>]*>/gi)].map(match => attributes(match[0])).filter(tag => tag.rel === 'canonical');
    assert.deepEqual(canonicals, [{rel:'canonical', href:base}]);
    assert.equal(new URL(meta('og:url')).search, '');
    assert.equal(meta('twitter:card', 'name'), 'summary_large_image');
    for (const key of ['title','description','image','image:alt']) assert.equal(meta(`twitter:${key}`, 'name'), meta(`og:${key}`), key);
  });
  test(`${route}: absolute share image exists and is a local lightweight 1200×630 PNG`, () => {
    const imageUrl = new URL(meta('og:image'));
    assert.equal(imageUrl.href, base + 'og-image.png');
    assert.equal(imageUrl.protocol, 'https:');
    assert.equal(imageUrl.search, '');
    assert.equal(meta('og:image:secure_url'), imageUrl.href);
    assert.equal(meta('og:image:type'), 'image/png');
    assert.equal(meta('og:image:width'), '1200');
    assert.equal(meta('og:image:height'), '630');
    assert(meta('og:image:alt').includes(`${label}学園祭・文化祭カレンダー ${data.year}`));
    const png = fs.readFileSync(path.join(directory, 'og-image.png'));
    assert.deepEqual([...png.subarray(0, 8)], [137,80,78,71,13,10,26,10]);
    assert.equal(png.toString('ascii', 12, 16), 'IHDR');
    assert.equal(png.readUInt32BE(16), 1200);
    assert.equal(png.readUInt32BE(20), 630);
    assert(png.length < 1_000_000, 'Keep the share image lightweight');
    const svg = fs.readFileSync(path.join(directory, 'assets/og-image.svg'), 'utf8');
    assert(svg.includes(`${label}学園祭・文化祭カレンダー ${data.year}`));
    assert(svg.includes(`takecian.github.io/${route}/`));
    assert(!/<script\b|<foreignObject\b|<image\b|\b(?:href|src)=/i.test(svg));
  });
  test(`${route}: fixed school-level route loads shared assets and accessible labelled filters`, () => {
    assert.equal(attributes(html.match(/<body\b[^>]*>/)[0])['data-school-level'], level);
    const links = [...html.matchAll(/<(?:link|script)\b[^>]*>/gi)].map(match => attributes(match[0]));
    for (const entry of links.filter(entry => entry.src || entry.rel === 'stylesheet')) {
      const url = new URL(entry.src || entry.href, base);
      assert.equal(url.origin, new URL(base).origin);
      assert(fs.existsSync(path.join(root, url.pathname)), `${route}: missing ${url.pathname}`);
      if (entry.src) assert(/\bdefer(?:\s|>)/.test(html.match(new RegExp(`<script[^>]+src="${entry.src.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*>`))[0]));
    }
    const scripts = links.filter(entry => entry.src).map(entry => new URL(entry.src, base).pathname);
    assert.deepEqual(scripts, ['/festival-calendar/calendar.js','/school-festival-calendar/calendar.js','/school-festival-calendar/app.js']);
    for (const id of ['prefecture','from','to','query','admission','reservation']) {
      assert(html.includes(`for="${id}"`), `${id} has a label`);
      assert.match(html, new RegExp(`<(?:input|select)\\b[^>]*id="${id}"[^>]*\\bdisabled`));
    }
    assert.match(html, /<noscript>[\s\S]*JavaScript[\s\S]*<\/noscript>/);
    assert(!/<a\b[^>]*href="[^"#]*\.json(?:[?#][^"]*)?"/.test(html), 'Do not expose a raw data-download link');
    const navigation = html.match(/<nav\b[^>]*class="calendar-types wrap"[\s\S]*?<\/nav>/)[0];
    for (const item of ['festival-calendar', ...routes.map(item => item.route)]) assert(navigation.includes(`href="/${item}/"`));
    const current = [...navigation.matchAll(/<a\b[^>]*>/g)].map(match => attributes(match[0])).filter(entry => entry['aria-current'] === 'page');
    assert.deepEqual(current, [{href:`/${route}/`, 'aria-current':'page'}]);
    assert(!fs.existsSync(path.join(directory, 'festivals.json')), 'There must not be a second copy of the canonical dataset');
  });
}

test('school routes use one canonical data request, and retain distinct social images', () => {
  const app = fs.readFileSync(path.join(root, 'school-festival-calendar/app.js'), 'utf8');
  const fetches = [...app.matchAll(/fetch\(['"]([^'"]+)['"]/g)].map(match => match[1]);
  assert.deepEqual(fetches, ['../school-festival-calendar/festivals.json']);
  const hashes = routes.map(({route}) => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, route, 'og-image.png'))).digest('hex'));
  assert.notEqual(hashes[0], hashes[1], 'Each school level needs its own readable share artwork');
});
