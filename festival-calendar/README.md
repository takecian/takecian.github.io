# 学園祭カレンダー 2026

Dependency-free Japanese university festival calendar. Hugo copies this source
folder (`static/festival-calendar/` on `feature`) to `public/festival-calendar/`.
The public route will be `/festival-calendar/` after the normal, separately
authorized GitHub Pages deployment. Do not edit generated `public/` files.

## Preview and checks

Run `hugo server -D` and open `/festival-calendar/`, or serve `static/` with a
static HTTP server. Opening `index.html` through `file://` is not supported,
because the page loads `festivals.json` with `fetch`.

- `node --test tests/festival-calendar.test.cjs tests/rsvp-reader.test.cjs`
- `node --check static/festival-calendar/calendar.js`
- `node --check static/festival-calendar/app.js`
- `node tests/festival-calendar-browser.cjs` (requires Playwright and Chromium;
  supports `CHROMIUM_PATH`, `FESTIVAL_TEST_URL`, and `SCREENSHOT_DIR`)
- `hugo` (build only; **do not** run `Scripts/deploy.sh` without deployment approval)

No production dependencies, analytics, third-party scripts, remote fonts,
location requests, cookies, or local-storage persistence are used.

## Behavior

The initial list includes all published 2026 records, including finished events,
sorted by start date. Choose any of 47 prefectures; counts show current dataset
coverage, not all festivals that exist. Date filters are inclusive. Blank start
or end dates are open bounds, and a festival matches only if an actual date in
its `dates` array falls within the requested range. Split/nonconsecutive dates
do not falsely match the intervening days. Combining prefecture, date, and
keyword filters uses AND. Search matches university, festival, campus and
prefecture, with Unicode width normalization and space-separated terms.

The Monday-first monthly calendar shows daily counts for the selected prefecture
and keyword. It intentionally ignores the date filter so neighboring days remain
discoverable. Changing months does not filter the list. Clicking a day sets both
date fields to that day and preserves keyboard focus. Previous/next month stays
within the dataset year. Current day and ongoing/finished status use Japan time.

Filters are reflected in `?prefecture=…&from=YYYY-MM-DD&to=YYYY-MM-DD&q=…` for
shareable URLs. Edits replace the current history entry; back/forward restores
URL filters without generating an entry on every keystroke. Invalid ranges show
an inline error. Reset, date-only reset, no-results, load error and retry states
are included. Content is created with `textContent`; only HTTPS source URLs are
accepted, and new-tab links include `noopener noreferrer`.

## Data maintenance

`festivals.json` is the single source of truth. The current snapshot contains 156
festivals from 95 universities in 43 prefectures across eight broad regions,
verified on 2026-10-11. The JSON file is loaded by the app, but the public page
does not show a raw-data download link.
Coverage includes all seven former imperial universities, Science Tokyo,
Hitotsubashi, ICU, Waseda, Keio, Sophia, Tokyo University of Science, MARCH,
Kansai, Kwansei Gakuin, Doshisha and Ritsumeikan, alongside other universities.
Separate campus festivals are included when their dates can be verified.
It is **not** a complete nationwide directory. Record sources are universities
or their festival committees, not guessed annual dates. Spring/earlier autumn
events remain available and display a finished badge. Follow the source links
to check access rules, exact opening times, and possible changes before visiting.

Each record includes a unique `id`, `university`, `name`, `campus`, `prefecture`,
`region`, `startDate`, `endDate`, exact `dates`, `officialUrl`, `sourceUrl`,
`sourceType`, `checkedAt`, and optional `notes`. Add only dates confirmed for the
stated year. `startDate`/`endDate` must equal the first/last actual date. Keep notes
short; mention admission limits or separate venue dates when relevant. Update
both record and dataset check dates after re-verifying. Distinct campus
festivals are separate records; the university count uses unique university
names. Never include preparation or cleanup dates as festival dates.

The tests enforce a minimum expanded coverage and validate all records, source
URLs, unique university-campus date ranges, displayed prefecture counts and
university searches. UI expectations derive from the dataset so new verified
records do not require changing hard-coded list sizes. Update the snapshot
counts above when adding or removing records.

This page does not automatically monitor official announcements. Moving to a
new year requires updating the dataset and the explicit year in the UI and
validation. Source URLs can change after the recorded verification date.
