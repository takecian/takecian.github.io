# 高校・中学 学園祭・文化祭カレンダー 2026

Two separate audience-facing pages in the existing Hugo/GitHub Pages site:

- `/festival-calendar/`: existing university calendar (156 records unchanged)
- `/high-school-festival-calendar/`: high-school festivals
- `/junior-high-school-festival-calendar/`: junior-high-school festivals

Hugo copies the source folders under `static/` unchanged. The new pages use
`school-festival-calendar/app.js`, `calendar.js`, styles and one canonical
`festivals.json`. They reuse the existing calendar's date helpers and base
styles without changing its application or dataset. Do not edit generated
`public/` files or run `Scripts/deploy.sh` without separate deployment approval.

## Data and counting

`festivals.json` is the single source of truth for both school pages. Every
record describes one festival with exact, officially confirmed 2026 public
visitor dates. Internal-only school days, preparation and cleanup days are not
public dates. Multiple/nonconsecutive public days remain one event. The UI
matches exact dates, not the enclosing start/end interval.

A joint junior/senior festival has one canonical record with
`school_levels: ["junior_high", "high"]`. It appears once in each applicable
view. Neither a school name containing both levels nor a visitor's age alone
establishes that a festival belongs to both school levels. Page coverage,
prefecture options, results and day counts are derived from the fixed page
view. Adding the two page totals is not a unique-festival count.

The current snapshot contains 59 unique festivals: 52 in the high-school view
and 40 in the junior-high-school view, with 33 shared records, across 18
prefectures (checked 2026-10-12). Counts are calculated from the dataset in the UI.

The dataset is a selected, verified list and does not claim nationwide or
prefecture-wide completeness. Past events remain searchable. Sources can
change after the recorded check date. A known-unavailable historical source can
retain its evidence in the dataset with `available: false`; the UI skips that
supplemental link and keeps the live official link. No visible JSON download link or
individual event-detail pages are provided.

## Admission semantics

Admission type is `public`, `prospective_students`, `related_only`, `limited`,
or `unclear`. The UI always shows `eligible_visitors` beside it. General
admission may still require registration, identification, tickets or other
conditions. The broad badge never replaces the detailed official conditions.

`reservation_required` refers to **advance** reservation and is true, false or
null. `reservation_policy` preserves distinctions including:

- `advance_required`: advance booking is needed
- `not_required`: advance booking is not needed
- `recommended`: advance registration recommended, not compulsory
- `same_day_registration_available`: same-day registration available
- `varies_by_visitor`: requirements depend on the admission route
- `not_stated` / `unknown`: not confirmed

Visitor-dependent rules appear as 「対象者による」 and are not treated as unknown.
Neither null nor visitor-dependent requirements enter the 「事前予約不要」 filter.
Being reservation-free does not imply unrestricted admission. Exact registration
windows and deadlines remain text so lotteries, school-year-specific windows,
cutoff times and separate programme bookings are not simplified away.
`reservation_deadline` is optional and is populated only for a verified exact
date. After that date, the UI says the stated deadline date has passed; it does
not infer real-time sold-out/open status or cutoff times from the date alone.

## Interaction and accessibility

Date/prefecture/keyword/admission/reservation filters combine with AND. Keyword
matching supports Unicode width normalization and multiple space-separated
terms. Blank date bounds are open. Inverted ranges show an inline alert and an
invalid-field state. Reset, date-only reset, no-results, network failure and
retry states are available.

The Monday-first calendar includes non-date filter conditions; switching months
does not change the list. Clicking a day sets both date bounds and restores
keyboard focus after rendering. Current-day/past-event badges use Japan time.
The URL parameters `prefecture`, `from`, `to`, `q`, `admission`, and `reservation`
are shareable. The page's school level cannot be changed through query params.
History edits use replaceState; popstate restores the form without creating
new entries. All 47 prefectures remain selectable, including zero-coverage ones.

No external JavaScript, fonts, analytics, cookies, geolocation or browser
storage are used. Data is validated before display. Text uses textContent and
only credential-free HTTPS official links are accepted; new tabs have
`noopener noreferrer`.

## Social previews

Each page has its own static title, description, canonical URL, Open Graph and
Twitter large-image metadata in its HTML head. They work without JavaScript.
Its original editable SVG is `assets/og-image.svg` and the committed 1200×630
PNG is `og-image.png`; no remote artwork is loaded. Render an updated SVG with:

```sh
inkscape static/high-school-festival-calendar/assets/og-image.svg \
  --export-type=png \
  --export-filename=static/high-school-festival-calendar/og-image.png \
  --export-width=1200 --export-height=630
```

Repeat for `junior-high-school-festival-calendar`. Change year, HTML descriptions,
artwork and data together. Filter URLs share the page's unfiltered social card.
University social metadata and artwork are preserved.

## Checks

```sh
node --check static/school-festival-calendar/calendar.js
node --check static/school-festival-calendar/app.js
node --test tests/festival-calendar*.test.cjs tests/school-festival*.test.cjs tests/rsvp-reader.test.cjs
hugo --destination /tmp/school-festival-build
SCHOOL_FESTIVAL_OGP_ROOT=/tmp/school-festival-build node --test tests/school-festival-ogp.test.cjs
FESTIVAL_OGP_ROOT=/tmp/school-festival-build/festival-calendar node --test tests/festival-calendar-ogp.test.cjs
node tests/school-festival-browser.cjs
```

The browser suite requires Playwright/Chromium and is a separate stage from the
unit/DOM tests. It covers native controls, responsive overflow, keyboard focus,
back/forward, failures/retry and screenshots when supported. If browser launch
is blocked by the executor, disclose it; a successful DOM suite is not visual QA.
Serve `static/` or run `hugo server -D` for manual preview; file:// fetching is not
supported. Source tests do not authorize merge or deployment.
