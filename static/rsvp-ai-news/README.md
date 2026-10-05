# Japanese RSVP / September 2026 AI brief

A standalone, dependency-free Japanese RSVP demonstration. Source files live in
`static/rsvp-ai-news/` on the Hugo source branch (`feature`). Hugo copies this
folder to `public/rsvp-ai-news/`; do not commit generated `public/` output here.
The eventual route is `/rsvp-ai-news/`. This change does not publish the site.

## Preview and test

- Repository preview: `hugo server -D`, then open `/rsvp-ai-news/`.
- Isolated preview: open `static/rsvp-ai-news/index.html` in a browser, or serve
  `static/` using an ordinary static HTTP server.
- Automated logic tests (Node 18+): `node --test tests/rsvp-reader.test.cjs`.
- Optional Chromium browser test: `node tests/rsvp-browser.cjs` (requires
  Playwright and Chromium; set `CHROMIUM_PATH` when needed).

## Reading behavior

The reader starts paused. Play/pause, restart, previous/next chunk, topic
selection, and a position slider are available. Space toggles playback;
left/right arrows step; R restarts. Native controls keep their normal keys.
Switching topics and seeking pause playback. Leaving the tab pauses playback.
After the final chunk's reading time, playback stops; replay starts at the start.

Japanese word boundaries come from `Intl.Segmenter`; a lightweight fallback is
included. Words are grouped into short chunks, with a maximum of eight base
characters plus trailing punctuation; unusually long words can be split.
The highlighted character stays centered. Rate is characters per minute, not
English WPM. The speed control spans 200–3000 characters per minute in
50-character steps, starting at 600. Chunk display time is proportional to
grapheme count, with a 160 ms minimum and additional punctuation pauses (140/300 ms). This is a UI
experiment, not a claim of improved reading speed or comprehension. Full text
and original sources remain available. No autoplay, animation, analytics,
external libraries, remote fonts, or persistence is used. Reduced-motion
preferences disable smooth scrolling. Fast-changing text is hidden from screen
readers; use the ordinary full text for accessible reading.

## Editorial scope

Six original Japanese summaries of official announcements dated September
1–30, 2026. Sources and date-verification links are stored in `news.js`.
Performance and cost figures are attributed to their publishers; availability
is described as announced, not as a promise of present access. Edit `news.js`
to update stories; text is rendered with `textContent`.

## Verification for this change

Node syntax checks, all seven logic tests, and a complete Hugo build pass.
The tests cover the speed-control limits and proportional timing changes during
active and paused playback at 3000 characters per minute. Browser regression
coverage includes the slider's native upper limit, but Chromium could not start
in this execution environment because OS socket creation was restricted.
No visual/mobile-browser pass is claimed.
