const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// Inspect the source HTML as a social crawler does: without executing app.js.
// FESTIVAL_OGP_ROOT can point at Hugo's output to repeat the same checks there.
const root = process.env.FESTIVAL_OGP_ROOT || path.join(__dirname, '../static/festival-calendar');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const head = html.match(/<head>([\s\S]*?)<\/head>/i)[1];
const data = JSON.parse(fs.readFileSync(path.join(root, 'festivals.json'), 'utf8'));
const BASE = 'https://takecian.github.io/festival-calendar/';
const attributes = tag => Object.fromEntries([...tag.matchAll(/([\w:-]+)="([^"]*)"/g)].map(match => [match[1], match[2]]));
const metas = [...head.matchAll(/<meta\b[^>]*>/gi)].map(match => attributes(match[0]));
function meta(key, attribute = 'property') {
  const matches = metas.filter(tag => tag[attribute] === key);
  assert.equal(matches.length, 1, `${key} must appear exactly once in the static head`);
  assert(matches[0].content, `${key} cannot be blank`);
  return matches[0].content;
}

test('calendar has complete, static Open Graph metadata for the production URL', () => {
  const title = head.match(/<title>([^<]+)<\/title>/)[1];
  assert.equal(title, `学園祭カレンダー ${data.year} | takecian`);
  assert.equal(meta('og:title'), title);
  assert.equal(meta('og:description'), meta('description', 'name'));
  assert.match(meta('og:description'), new RegExp(`${data.year}年`));
  assert.equal(meta('og:type'), 'website');
  assert.equal(meta('og:url'), BASE);
  assert.equal(meta('og:locale'), 'ja_JP');
  assert.equal(meta('og:site_name'), '学園祭カレンダー | takecian');
  assert.match(html, /<html\b[^>]*\blang="ja"[^>]*\bprefix="og: https:\/\/ogp.me\/ns#"/);
  const canonicals = [...head.matchAll(/<link\b[^>]*>/gi)].map(match => attributes(match[0])).filter(tag => tag.rel === 'canonical');
  assert.equal(canonicals.length, 1);
  assert.equal(canonicals[0].href, BASE);
  assert.equal(new URL(meta('og:url')).search, '');
});

test('Twitter large-image card uses the same title, description, image and alt text', () => {
  assert.equal(meta('twitter:card', 'name'), 'summary_large_image');
  for (const key of ['title','description','image','image:alt']) {
    assert.equal(meta(`twitter:${key}`, 'name'), meta(`og:${key}`), key);
  }
});

test('share image uses absolute HTTPS and points to a valid local 1200×630 PNG', () => {
  const imageUrl = new URL(meta('og:image'));
  assert.equal(imageUrl.href, BASE + 'og-image.png');
  assert.equal(imageUrl.protocol, 'https:');
  assert.equal(imageUrl.search, '');
  assert.equal(meta('og:image:secure_url'), imageUrl.href);
  assert.equal(meta('og:image:type'), 'image/png');
  assert.equal(meta('og:image:width'), '1200');
  assert.equal(meta('og:image:height'), '630');
  assert.match(meta('og:image:alt'), /学園祭カレンダー/);
  const png = fs.readFileSync(path.join(root, 'og-image.png'));
  assert.deepEqual([...png.subarray(0, 8)], [137,80,78,71,13,10,26,10]);
  assert.equal(png.toString('ascii', 12, 16), 'IHDR');
  assert.equal(png.readUInt32BE(16), Number(meta('og:image:width')));
  assert.equal(png.readUInt32BE(20), Number(meta('og:image:height')));
  assert(png.length < 1_000_000, 'Keep the share image lightweight');
});

test('editable share artwork is local and has no scripts or external images', () => {
  const svg = fs.readFileSync(path.join(root, 'assets/og-image.svg'), 'utf8');
  assert(svg.includes(`学園祭カレンダー ${data.year}`));
  assert(!/<script\b|<foreignObject\b|<image\b|\b(?:href|src)=/i.test(svg));
});
