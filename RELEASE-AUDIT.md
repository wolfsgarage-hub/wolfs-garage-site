# RELEASE AUDIT — wolfs-garage-site v1.48 (branch v145-reskin-preview)

Target: index.html + api/mailchimp-subscribers.js + vercel.json (release candidate for wolfsgarage.com).
Auditor: Claude (release engineer / QA / adversarial reviewer). Session: 2026-07-05.
Verification environment: Windows 11, Chrome (claude-in-chrome), local serve via python http.server :8123, live prod probes read-only.

## PROJECT UNDERSTANDING
- Single-page static site (~490KB index.html incl. base64 art) + 1 Vercel serverless fn + vercel.json redirects (/directory → community app, /pack, legacy /pages/*).
- No package.json/build/tests/linter. Deterministic checks = node --check per inline script (HR-007), custom static analyzer (dup ids, anchor targets, placeholder copy, undefined onclick handlers, external URL inventory), behavioral unit test for the API fn.
- Stack: Firebase compat 10.7.1 (project wolfs-garage-directory: events/pack_photos/wolf_photos/bulletins, email+password auth), Cloudinary unsigned uploads, Google Maps JS (bulletin/event zip geocode), Shopify links, Mailchimp signup + export fn.
- Deploy: Vercel project wolfsgarage; production = main (pre-reskin build); candidate = this branch.

## GATES
| # | Gate | Status | Evidence |
|---|------|--------|----------|
| G1 | Inline scripts node --check | PASS | 2 blocks, 0 failures (re-run on v1.48) |
| G2 | API fn syntax + auth-gate behavior | PASS | node --check OK; 6/6 unit cases (401 fail-closed incl. token-unset + wrong key; header + query accepted) |
| G3 | Anchor hrefs resolve | PASS | 10 unique anchors, all match ids |
| G4 | No duplicate DOM ids | PASS | lbHeartCount x3 in source = 1 static + 2 JS template strings that REPLACE it; ≤1 in DOM at runtime (false positive) |
| G5 | No placeholder/dev copy | PASS | 6× "coming soon" are intentional design copy (tool line, YouTube) |
| G6 | External links respond | PASS | 15 URLs HEAD-checked 200 incl. og:image (113KB jpg), campaign archive, privacy policy. Known exception: prod TOS page 404s → TOS link NOT restored (see D-007) |
| G7 | Assets load | PASS | 0 empty-src imgs after fix; no failed image loads; base64 art renders (screenshots) |
| G8 | OG/meta/favicon | PASS | og:title/desc/image(1200×630)/alt/type/url/site_name + twitter card verified in head; favicon + apple-touch 200 |
| G9 | Brand lock | PASS (visual, desktop) | black/red/bone/copper only (forbidden-color grep clean — "sage" hits were err.message substrings); Bebas/Oswald/Work Sans/Special Elite loaded; pinstripe divider visible; copper = text only. NOTE: logo sits upper-LEFT (matches John-approved v1.45/46 layout; ops doc says upper-right — flagged, not changed) |
| G10 | No JS exceptions on load | PASS | only console entries: Maps RefererNotAllowedMapError (localhost not on key allowlist — expected off-domain) + loading=async perf warning |
| G11 | No unexplained network failures | PASS | one Firestore Listen 503 = normal long-poll rotation, auto-recovered; all others 200 |
| G12 | Responsive matrix | PARTIAL | 13 @media blocks (900/860/700/640/520) + prefers-reduced-motion present; desktop 1512w: no overflow-x. TRUE device-viewport testing NOT AVAILABLE (extension pins renderer at 1170×619; resize_window ineffective). Binding mobile check per WG rules = John's phone-Chrome approval of the preview |
| G13 | Critical journeys | PASS (to auth wall) | see TESTING PERFORMED |
| G14 | v1.47 hardware-back scroll fix | PASS | event lightbox: open → history.back() → display none, body.overflow restored, scroll works (1975→2375). Gallery lightbox: open (img loaded) → X-close → overflow restored. Regression re-run on v1.48: PASS |
| G15 | Adversarial security | PASS in candidate | D-001 fixed+unit-tested; XSS: all user-content sinks escaped (events title/date/flyer via escapeHtml; bulletins via bltEscape; comments author+text via galleryEscape); Firebase config public-by-design; Maps key referer-restricted (verified: rejects unauthorized origins); Firestore rules scoped (anon unfiltered read 403, approved-only read OK) |
| G16 | Feature parity w/ production | PASS | 50/50 function names match (only prod-build internals `processNode` asset-rewriter + `window.open` regex artifact absent); zip filters, LIST YOUR EVENT, bulletin geocode, archive, event lightbox all present + working; Privacy Policy link restored (D-006) |
| G17 | Final diff clean | PASS | see git diff summary in release report; no secrets, no temp files (RELEASE-AUDIT.md intentionally included) |

## DEFECTS
### D-001 — CRITICAL — /api/mailchimp-subscribers leaked full audience PII unauthenticated — FIXED (candidate)
- Repro: GET https://www.wolfsgarage.com/api/mailchimp-subscribers → 200 text/csv, real subscriber emails+names. LIVE ON PROD NOW.
- Root cause: no auth check in handler.
- Fix: fail-closed gate — EXPORT_TOKEN env var must exist AND match ?key= or x-export-key header, else 401. Unit-tested 6/6.
- ACTION REQUIRED (John): set EXPORT_TOKEN in Vercel project settings; new export URL = /api/mailchimp-subscribers?key=<token>. PROD REMAINS EXPOSED UNTIL THIS RELEASE (or an emergency patch) DEPLOYS.

### D-002 — HIGH — Maps key rejects www.wolfsgarage.com (prod, external config) — OPEN, not repo-fixable
- RefererNotAllowedMapError on www.wolfsgarage.com → bulletin/event zip geocode dead for www visitors.
- Fix location: Google Cloud console → Maps key referer allowlist → add www.wolfsgarage.com/*.
- Repo-side degradation verified GRACEFUL in candidate: geocoder-null path shows "Pick a distance to filter." / keeps bulletins listed, no crash.

### D-003 — HIGH — "clicked to list an event, kicked back to home page" (Mac, prod) — ROOT-CAUSED; CURED BY THIS RELEASE
- Reproduced on prod: fresh load → click LIST YOUR EVENT (#eventSubmitZone) → hash set but viewport stays at top (pageY 0, zone 8343px below). Prod page never reaches document-idle (45s timeout ×3) — perpetually-loading 2.4MB build cancels/never-runs smooth anchor scrolls; window-level scroll APIs also intermittently no-op'd during load.
- Candidate: same journey verified working (click → submit zone on screen, screenshot ss_01469zjk6; loads to idle).
- No further code change needed; shipping the reskin fixes it.

### D-004 — v1.46 hardware-back scroll lock — FIXED in v1.47 (commit dccdd78), verified this session (G14).

### D-005 — LOW — 3 lightbox <img src=""> caused phantom self-requests — FIXED (removed empty src attributes).

### D-006 — MEDIUM — Newsletter Archive cards styled clickable (cursor:pointer+hover) but dead; Privacy Policy link dropped vs prod — FIXED (cards → Mailchimp public campaign archive, verified 200 with real campaigns; Privacy Policy restored in footer Connect column, verified 200).

### D-007 — LOW — Terms of Service page 404s on Shopify (prod footer links to it today) — OPEN, needs John
- https://shop.wolfsgarage.com/policies/terms-of-service → 404. TOS link intentionally NOT restored in candidate to avoid a dead link. John: publish TOS in Shopify admin, then add the link back.

## TESTING PERFORMED
- Static: node --check ×3 runs (2 inline blocks + api fn); custom analyzer (ids/anchors/placeholders/handlers/URLs); forbidden-color grep; feature-parity fn diff vs prod; @media inventory.
- API: 6-case behavioral unit test of auth gate (mock req/res).
- HTTP: 15 external URLs + og:image + campaign archive + privacy policy + prod api endpoint + Firestore REST (anon scoping) + Cloudinary preset probe (no asset created).
- Browser (Chrome, localhost:8123, desktop 1170×619 effective viewport): load ×4; console + network capture; scroll/overflow probes; LIST YOUR EVENT anchor journey (screenshot); event lightbox open/hardware-back/X-close; gallery lightbox open (Firestore img verified loaded)/close; heart count read; account modal open/close (email required enforced); event zip filter + bulletin zip with geocoder down; archive links; footer links; live-data render of 12 events + 6 pack photos + 1 wolf pick + 1 bulletin.
- Browser (prod, read-only): D-001 repro, D-003 repro ×2 (JS click + trusted click), scroll-container probes, console capture.
- NOT performed (prohibited/unavailable): account creation, sign-in, authenticated submits (event/photo/bulletin/comment), live Firestore writes, Mailchimp form submission, real purchases, Mac Safari, true mobile viewports.

## REMAINING LIMITATIONS
1. Authenticated flows verified only to the auth wall (WG hands-off-live rule + no-account-creation rule). Firestore CREATE rules for events by non-admin users remain UNVERIFIED — if the rules lack an events-create clause, submissions fail with "Submit failed: Missing or insufficient permissions" (D-003's reporter never got past the anchor bug, so this is still a possible second bug behind it). 30-second check for John in Firebase console → Firestore → rules.
2. True mobile viewport rendering unverified this session (tooling limit) — covered by John's phone-Chrome preview approval, which is mandatory before production anyway.
3. EXPORT_TOKEN + MAILCHIMP_API_KEY env state in Vercel not inspectable from sandbox.
4. Mac Safari untested (no Mac available).
