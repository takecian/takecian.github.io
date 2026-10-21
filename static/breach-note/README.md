# BreachNote

Source: `static/breach-note/`; published path: `/breach-note/`.
Hugo copies this standalone page and assets without a content template.

The inline `breach-data` JSON in `index.html` contains researched public-source
summaries. `year` is the dataset edition year, not an incident-year restriction.
`checkedAt` is the actual source-check date. Historical incidents are supported.
The initial selection focuses on Japanese organizations; it is not exhaustive.

## Data conventions

- Keep `disclosedAt` / `updatedAt` equal to the first / last dates in `dates`.
  These are verified publication dates, not intrusion or discovery dates. Explain
  in the summary when the first-ever announcement is not independently verified.
- Distinguish confirmed leakage, possible access/exposure, and no leak found.
- `affectedRecords` is the numeric scope for filtering, not a uniform unit or a
  confirmed leakage total. `scaleLabel` must state people/accounts/records,
  possible/maximum counts, and important overlap. Never sum these numbers.
  Use 0 only as the existing unknown-count sentinel, with an explicit unknown
  label; this is not a claim of zero harm. Actual confirmed zero leakage is
  described in the status/summary, independently from the population at risk.
- Prefer the latest verified final estimate; document major revisions and do not
  mix estimates from separate announcements. Use conservative cause categories.
- Link actual official HTTPS notices in `officialUrl` and `sourceUrl`; preserve
  supporting notice dates and scope in the source register. Do not use fabricated
  records, private leaked data, or copied article text.
- `learnings` are editorial prevention ideas, not source quotations or proof of
  which safeguards were absent. The UI labels this distinction.
- Escape `<` as `\u003c` in inline JSON. Incident text uses `textContent`; URLs are
  HTTPS-only without embedded credentials. Validate data before publishing.

Helpers implement AND keyword matching, inclusive date ranges (any verified
initial/follow-up date), minimum numeric thresholds, and newest-first ordering.
Unknown counts remain in the “under 10k / undisclosed” group.

Run `node --test tests/breach-note.test.cjs` for source/data/helper checks.
Run `node tests/breach-note-browser.cjs` for browser checks (Playwright/Chromium).
Synthetic fixtures are intercepted only in the test browser, never published.

Build with Hugo into a temporary directory to inspect changes. Only publish when
explicitly authorized. Preserve unrelated legacy production files, especially
404.html and old calendars. The October diary remains draft and its previously
unpublished output must not be reintroduced. Do not use the deploy script's
unconditional force push; verify the latest master and update with a guarded
fast-forward from its real parent.

## Technical explanations

Each researched incident has a `technical` object with `entryPoint`,
`vulnerability`, `attackFlow` (ordered statements), `exfiltration`, `unknowns`,
`interpretation`, and `sources` (title, HTTPS URL, publication date or null,
and section/page locator). The flow is a source-supported sequence, not a
reconstruction of undisclosed attack steps. Distinguish a reported inference
from a confirmed fact inside its wording. Do not invent product names, CVEs,
privilege escalation, tools, data extraction methods, or exact chronology.
`interpretation` is explicitly labeled general technical explanation, not an
incident finding. A misconfiguration or insider case need not involve an
external intrusion or software vulnerability. Search includes technical text.

Technical UI regression: `node --test tests/breach-note-dom.cjs` uses jsdom 30
as a development-only test dependency (not shipped to the browser). Install it
in a separate test tools directory and set `NODE_PATH` to that directory's
`node_modules` when running the test. Run the existing Playwright browser test
as well for layout and real keyboard interaction; DOM tests do not replace it.

## 2026 six-month coverage expansion

The October 21, 2026 edition adds primary-verified disclosures and substantive
follow-ups from April 21 through October 21, 2026. Keep the earlier historical
records for comparison. The research pass covers each calendar-month segment
and multiple industries, including accidental disclosure and loss, not only
cyberattacks. This is a curated public-source register, never a complete national
incident census. `sources.html#coverage-methodology` describes the scope,
deduplication, excluded categories and count limitations.

The optional `coverage` object records `from`, `to`, `checkedAt`, `periodTotal`,
`firstVerifiedPublicationInPeriod`, `olderWithFollowupsInPeriod` and
`exhaustive: false`. The validator recomputes incident counts from the verified
publication dates. These counts do not add affected persons or records. A
month's count means the first **verified publication** of a registered case,
not necessarily the occurrence month or the true first announcement.

Use `調査中・原因不明` when the published evidence does not establish a cause.
An account suspension, password reset, software update, new EDR deployment or
other response is not proof that a particular account, software flaw or machine
was the initial entry point. Likewise, remote-control software in a support scam
is not automatically malware. Distinguish absence of confirmed leakage from a
positive final conclusion of no leakage.

`status` is an independent URL/filter key for the confirmation status. The
recent-period shortcut includes follow-up publication dates by the same rules as
the date inputs. Source links and technical panels remain available for every
record. Each record keeps its own source-check date; adding new records does not
claim that every historical source was rechecked that day.
