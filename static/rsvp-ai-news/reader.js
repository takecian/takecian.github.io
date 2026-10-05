/* Dependency-free Japanese RSVP reader. No network, analytics, or persisted data. */
(function () {
  'use strict';
  const graphemes = text => typeof Intl !== 'undefined' && Intl.Segmenter
    ? [...new Intl.Segmenter('ja', { granularity: 'grapheme' }).segment(text)].map(x => x.segment)
    : Array.from(text);

  function segmentJapanese(text) {
    const words = typeof Intl !== 'undefined' && Intl.Segmenter
      ? [...new Intl.Segmenter('ja', { granularity: 'word' }).segment(text)].map(x => x.segment)
      : text.match(/[一-龯々〆ヵヶ]+[ぁ-ゖ]*|[ぁ-ゖ]+|[ァ-ヺー]+|[A-Za-z0-9.]+|[^\s]/gu) || [];
    const chunks = [];
    let pending = '';
    const flush = () => { if (pending) chunks.push(pending); pending = ''; };
    for (const word of words) {
      if (/^\s+$/.test(word)) { flush(); continue; }
      if (/^[、。！？!?，,：:；;」』）)]$/.test(word)) { pending += word; flush(); continue; }
      const characters = graphemes(word);
      if (graphemes(pending).length + characters.length > 8) flush();
      while (characters.length > 8) { chunks.push(characters.splice(0, 8).join('')); }
      pending += characters.join('');
      if (graphemes(pending).length >= 6) flush();
    }
    flush();
    // Punctuation belongs to the preceding chunk, never flashes on its own.
    return chunks.reduce((out, chunk) => {
      if (/^[、。！？!?，,：:；;」』）)]+$/.test(chunk) && out.length) out[out.length - 1] += chunk;
      else out.push(chunk);
      return out;
    }, []);
  }
  const duration = (chunk, speed) => Math.max(160, graphemes(chunk).length * 60000 / speed) + (/[。！？!?]$/.test(chunk) ? 300 : /[、，,：:；;]$/.test(chunk) ? 140 : 0);
  if (typeof module !== 'undefined' && module.exports) module.exports = { segmentJapanese, duration, graphemes };
  if (typeof document === 'undefined') return;

  const $ = id => document.getElementById(id);
  const news = window.AI_NEWS || [];
  let chunks = [], index = 0, playing = false, timer = null, completed = false;
  let dueAt = 0, pausedTime = null;
  const speed = () => Number($('speed').value);
  const fullDuration = () => duration(chunks[index].text, speed());
  const status = text => { $('state').textContent = text; };

  function render() {
    const current = chunks[index];
    if (!current) return;
    const chars = graphemes(current.text);
    const pivot = Math.min(Math.floor(chars.length / 2), chars.length - 1);
    $('before').textContent = chars.slice(0, pivot).join('');
    $('focus').textContent = chars[pivot];
    $('after').textContent = chars.slice(pivot + 1).join('');
    $('topic').textContent = current.title;
    $('position').textContent = `${index + 1} / ${chunks.length} まとまり`;
    $('seek').value = index;
    $('seek').setAttribute('aria-valuetext', `${index + 1} / ${chunks.length}：${current.text}`);
    const remaining = completed ? 0 : chunks.slice(index).reduce((total, chunk) => total + duration(chunk.text, speed()), 0);
    $('remaining').textContent = `残り約 ${Math.ceil(remaining / 1000)} 秒`;
    $('previous').disabled = index === 0;
    $('next').disabled = index === chunks.length - 1;
    $('play').textContent = playing ? 'Ⅱ 一時停止' : completed ? '↺ もう一度読む' : index > 0 || pausedTime !== null ? '▶ 続きから読む' : '▶ 読み始める';
    $('play').setAttribute('aria-pressed', String(playing));
  }
  function schedule(delay) {
    clearTimeout(timer);
    dueAt = performance.now() + delay;
    timer = setTimeout(() => {
      timer = null;
      if (!playing) return;
      if (index === chunks.length - 1) {
        playing = false; completed = true; pausedTime = null; status('読み終わりました'); render(); return;
      }
      index++; pausedTime = null; render(); schedule(fullDuration());
    }, delay);
  }
  function pause() {
    if (playing) pausedTime = Math.max(0, dueAt - performance.now());
    playing = false; clearTimeout(timer); timer = null;
    status(completed ? '読み終わりました' : '一時停止'); render();
  }
  function play() {
    if (!chunks.length) return;
    if (playing) { pause(); return; }
    if (completed) { index = 0; completed = false; pausedTime = null; }
    playing = true; status('再生中'); render(); schedule(pausedTime ?? fullDuration());
  }
  function move(target) {
    pause(); index = Math.max(0, Math.min(chunks.length - 1, target)); completed = false; pausedTime = null;
    status(index === 0 ? '準備完了' : '一時停止'); render();
  }
  function selectArticle() {
    pause();
    const stories = $('article').value === 'all' ? news : news.filter(item => item.id === $('article').value);
    chunks = stories.flatMap(item => segmentJapanese(`${item.title}。${item.body}`).map(text => ({ text, title: item.title })));
    index = 0; completed = false; pausedTime = null;
    $('seek').max = Math.max(0, chunks.length - 1);
    status(chunks.length ? '準備完了' : '記事を読み込めませんでした');
    $('play').disabled = !chunks.length;
    render();
  }
  for (const [i, item] of news.entries()) {
    const option = document.createElement('option'); option.value = item.id; option.textContent = `${String(i + 1).padStart(2, '0')} / ${item.title}`; $('article').append(option);
    const article = document.createElement('article'); article.className = 'story';
    const meta = document.createElement('div'); meta.className = 'story-meta';
    const date = document.createElement('time'); date.dateTime = item.date; date.textContent = item.date.replaceAll('-', '.');
    const category = document.createElement('span'); category.textContent = item.category;
    const read = document.createElement('button'); read.type = 'button'; read.textContent = 'この話題を読む ↗'; read.setAttribute('aria-label', `${item.title}をリーダーに表示`);
    read.addEventListener('click', () => { $('article').value = item.id; selectArticle(); $('reader-title').scrollIntoView({ block: 'start' }); $('play').focus({ preventScroll: true }); });
    meta.append(date, category, read);
    const content = document.createElement('div');
    const heading = document.createElement('h3'); heading.textContent = item.title;
    const body = document.createElement('p'); body.textContent = item.body;
    const source = document.createElement('a'); source.textContent = `出典：${item.sourceTitle} ↗`; source.href = item.sourceUrl; source.rel = 'noopener noreferrer'; source.target = '_blank';
    content.append(heading, body, source); article.append(meta, content); $('stories').append(article);
  }
  $('play').addEventListener('click', play);
  $('restart').addEventListener('click', () => move(0));
  $('previous').addEventListener('click', () => move(index - 1));
  $('next').addEventListener('click', () => move(index + 1));
  $('seek').addEventListener('input', () => move(Number($('seek').value)));
  $('article').addEventListener('change', selectArticle);
  let oldSpeed = speed();
  $('speed').addEventListener('input', () => {
    const fraction = playing ? Math.max(0, dueAt - performance.now()) / duration(chunks[index].text, oldSpeed) : pausedTime === null ? 1 : pausedTime / duration(chunks[index].text, oldSpeed);
    $('speed-value').replaceChildren(document.createTextNode(`${speed()} `));
    const unit = document.createElement('small'); unit.textContent = '文字 / 分'; $('speed-value').append(unit);
    if (chunks.length) { pausedTime = Math.min(1, fraction) * fullDuration(); if (playing) schedule(pausedTime); }
    oldSpeed = speed(); render();
  });
  document.addEventListener('keydown', event => {
    if (event.repeat || event.altKey || event.ctrlKey || event.metaKey || /^(INPUT|SELECT|TEXTAREA|BUTTON|A)$/.test(event.target.tagName) || event.target.isContentEditable) return;
    if (event.code === 'Space') { event.preventDefault(); play(); }
    else if (event.key === 'ArrowLeft') { event.preventDefault(); move(index - 1); }
    else if (event.key === 'ArrowRight') { event.preventDefault(); move(index + 1); }
    else if (event.key.toLowerCase() === 'r') { event.preventDefault(); move(0); }
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden && playing) pause(); });
  selectArticle();
})();
