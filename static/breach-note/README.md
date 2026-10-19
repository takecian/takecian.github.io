# BreachNote

Source: `static/breach-note/`; published path: `/breach-note/`.
Hugo copies this standalone page and assets without a content template.

The page uses the existing `breach-note.js` helpers for options, query normalization,
AND keyword matching, inclusive date ranges (any initial/follow-up date), minimum
record-count thresholds, and ordering. Unknown record counts remain in the
“under 10k / undisclosed” group, not a claim of zero impact.

No incident research or example incidents are included. The inline `breach-data`
JSON in `index.html` starts with `year: 2026`, `checkedAt: null`, `incidents: []`.
This exact empty state is supported by the UI; populated data must pass the
existing `BreachNote.validateData` schema. Only add verified records with real
source/official HTTPS links and actual check dates. Escape `<` as `\u003c` in inline
JSON so record text cannot terminate its script element. The UI uses textContent
for incident text and renders no HTML from the data. Do not add test fixtures to
production data.

Run `node --test tests/breach-note.test.cjs` for source/helper checks.
Run `node tests/breach-note-browser.cjs` for browser checks (Playwright and Chromium required). They use only synthetic
fixtures intercepted in the test browser, never production records.

Build with Hugo into a temporary directory to inspect changes. Do not run
`Scripts/deploy.sh` unless production publication is explicitly authorized.
Changing the October diary to `draft: true` excludes it from normal future builds;
it does not remove the already deployed page. A production rebuild/deployment
must also remove stale output, rather than merely copy files over it.
