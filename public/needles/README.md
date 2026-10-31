# NEEDLES Track Jacket Archive

Standalone static page: `public/needles/index.html`. All runtime assets are relative.

## Repository and publishing

This repository stores generated HTML directly. No package.json, site generator configuration, build scripts, GitHub Actions workflows, AGENTS.md, or repository-specific skills were found in the checkout or relevant ancestor directories. Existing pages are at the repository root, and the pre-existing `public/` directory is also committed static content (it is not a build input automatically copied to root).

With root-based GitHub Pages hosting, the page URL will be `https://takecian.github.io/public/needles/`. A host configured to serve `public/` directly would instead use `/needles/`. Hosting settings were not changed. No existing pages were edited. Push/deployment is not part of this change.

## Data

Edit `data.json`; no build step is required. One record represents one confirmed colorway. Keep `id` unique. `season: null` explicitly means unverified. `modelCode` is the manufacturer code; `retailerCode` is separately labelled and must not be substituted for it.

Initial coverage: 21 colorways, all Track Jacket - Poly Smooth.

- 2025SS: QV305A Ivory, QV305B Sax, QV305C Purple (MOONLOID official store).
- 2025AW: RW314A Brown, RW314B Green, RW314C Red (andPheb official store).
- 2026SS: SX404A Rust, SX404B Green, SX404C Charcoal (andPheb official store). Nepenthes Japanese announcement calls the last color Black; the product's Charcoal label is preserved with a note.
- 2026AW: TY349A Navy, TY349B Purple, TY349C Black (NEPENTHES official store).
- B’2nd: retailer code 7856255222, Black / Light Brown / Blue / Navy (official Japanese labels preserved). The official description explicitly says 2026 AW B’2nd EXCLUSIVE COLLECTION, despite also containing summer prose.
- L.H.P: retailer code 7846252250, Black × White / Black × Charcoal / White / Black × Purple; season and manufacturer code unverified.
- BEAVER: retailer code 7816252236, Charcoal; season and manufacturer code unverified. This is a confirmed subset, not a full color count.

The request said HLP; the official store identifies itself as L.H.P/LHP. These records are included under the actual official name, without asserting that HLP necessarily meant LHP. H.L.N.A is not inferred or included.

## Images and source restrictions

Every record has an official product source link. The 12 regular images are externally referenced; image files are not redistributed in this repository. This is not a declaration of reuse permission. The source owners retain copyright. 2025AW/2026SS use on-model photographs, explicitly labelled in the UI and JSON; 2025SS/2026AW show the product front. Parent research visually verified all 12, and the page's browser checks confirmed all 12 load.

mix.tokyo terms (`https://mix.tokyo/policies/terms-of-service`), checked 2026-10-31 through its own policy tool, restrict content use outside private use, publication and scraping in Article 20(6)(7)(10), and unauthorized reproduction/secondary use in Article 22. Therefore all nine mix.tokyo colorways use `imagePolicy: restricted`; the renderer makes no image request for those records. Four B’2nd image URLs observed before the restriction was known remain in source metadata only. LHP and BEAVER image URLs were not further extracted after the restriction was found. The official link is available on every card. Image permission or an explicitly licensed source would be needed to fill these photo cards.

A shell download from mix.tokyo failed at the transport layer (curl code 56). Browser page/official WebMCP data were accessible, not an access-denial bypass. No remote content was modified.

## Local checks

From the repository root, run `python3 -m http.server 8765 --bind 127.0.0.1` and open `/public/needles/`.

Verified in the browser on 2026-10-31:

- 21 total cards, 12 regular image URLs load; no restricted image requests.
- Season filter: 2025SS yields 3; L.H.P store filter yields 4.
- Search with no matches shows a clear empty state; reset restores the set.
- Keyboard Tab advances from season to collection filter; all native controls, visible focus styles, skip link, and descriptive alt text provided.
- 390 × 844 mobile viewport has no horizontal overflow (scrollWidth = innerWidth = 390); desktop at 1280 renders three columns.
- A temporary fixture with a missing image showed the fallback and preserved the official link. Fixture removed after verification.
- JS syntax (`node --check public/needles/app.js`), JSON schema essentials/unique IDs and `git diff --check` checked. There is no existing build/test command to run.

Limitations: official external images may later disappear; source links remain. Season/filter coverage is intentionally incomplete for exclusives. No attempt was made to infer missing seasons from retailer SKU numbers.
