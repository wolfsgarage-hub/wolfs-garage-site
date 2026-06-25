# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## ⚠️ Sister-repo sync contract (READ THIS FIRST)

This site does **not** stand alone. It has a counterpart admin app —
**`wolfsgarage-hub/Wolfs-admin`** (cloned locally alongside this repo at
`../Wolfs-admin`) — and the two share a single backend:

- the same Firebase project `wolfs-garage-directory` (Auth + Firestore);
- the same Firestore collections and document shapes (`pack_photos`, `events`,
  business listings, …) and their `status` workflow (`pending` → approved);
- the same Cloudinary account/preset/folder (`dancaaglf` / `wolfs-garage`);
- the same `ADMIN_EMAILS` allowlist and the same Mailchimp audience.

The public **site** is the *producer / consumer* surface: visitors submit and
view content. The **admin app** is the *control / moderation* surface: an admin
reviews, approves, configures, and exports that same data.

**THE RULE — site features and admin features ship together.**
If a change here does any of the following, it almost certainly requires a
matching change in `Wolfs-admin`:
- introduces a new Firestore collection, field, or `status` value;
- changes how submitted content is shaped, validated, or moderated;
- adds a new content type (gallery / events / listings / etc.);
- touches shared config (Cloudinary preset or folder, `ADMIN_EMAILS`,
  Mailchimp wiring).
The matching change is typically a moderation queue, an editor field, a pending
counter, an export, or a config input on the admin side.

**Required of every session:** before treating a feature change as done, open
`../Wolfs-admin` and check whether it needs a corresponding change. If it does,
say so explicitly and do **both** — never silently ship one half. (Past breakage
came from exactly this: a change landed on one app and never reached the other.)
If both halves can't be done in one session, leave an explicit written TODO in
the other repo's commit message / CLAUDE.md naming the missing counterpart.

## Repository shape

This is a **single-file static site**. Everything ships out of `index.html` (~2,100 lines): HTML markup, all CSS in a `<style>` block, all JS in trailing `<script>` blocks. There is no build step, no package manager, no test suite, no linter. To preview locally, open `index.html` in a browser or serve the directory with any static server (e.g. `python3 -m http.server`). Deployment is via Vercel; pushes to the deployed branch publish the site.

Other tracked files:
- `vercel.json` — redirects only. `/directory`, `/directory/*`, `/pages/hot-rodder-directory`, `/pages/hot-rodder-directory/*`, and `/pack` all forward to `https://wolfs-garage-community.vercel.app` (a separate repo). These are the only wiring for inbound short URLs (incl. printed booth handouts) — edit carefully.
- `assets/pistons.svg` — the only loose asset on disk. Appears to be **orphaned**: no reference from `index.html`. Don't assume deleting it is safe without checking, but don't assume it's live either.
- `README.md` — one-line description.

## Verifying changes

There is no test suite, no linter, no type-check, and no preview build. The only way to verify a change is to open `index.html` in a browser (or `python3 -m http.server` + visit `localhost:8000`) and exercise the affected feature. After UI/asset changes, also sanity-check: favicon, hero wolf image, pin decorations on each section, gallery load (signed-out + signed-in), and the upload form. Vercel auto-deploys pushed branches; the production URL is `https://wolfsgarage.com`.

## How assets work (important)

Images are **base64-inlined into a single JS object** named `WG_ASSETS` defined around line ~1222 of `index.html`. The HTML references them with sentinel strings like `WG_ASSET_WOLF`, `WG_ASSET_PIN01`, etc. This is why `index.html` is ~1.2 MB and why the `Read` tool will reject reading it whole — always use `offset`/`limit` or `grep`/`awk` line ranges, and filter out base64 noise (`grep -v "data:image\|base64"`) when searching.

Two swap scripts rewrite the sentinels at runtime:
1. **Primary** (lines ~1223–1245, runs on `DOMContentLoaded`) — recursively walks `document.head` and `document.body`, swaps `src` / `href` / `content` attributes whose value equals a `WG_ASSET_*` token, and swaps inline `style.backgroundImage` containing one. This is what makes the favicon `<link rel="icon" href="WG_ASSET_WOLF">` work.
2. **Secondary fallback** (lines ~1897–1910, near the bottom of `<body>`) — narrower; only re-checks `<img src>` and `<a href>`. Labeled "FIX" in a comment; treat it as a safety net, not the source of truth.

**CSS-rule limitation:** Neither script rewrites `url(WG_ASSET_*)` inside `<style>` blocks or stylesheets — only inline `style="background-image:..."` attributes. Putting a token in a CSS rule will silently 404. Use inline style or `<img>` instead.

To add a new image: add a new `WG_ASSET_<NAME>` key to the `WG_ASSETS` object (base64 data URI as the value), then reference `WG_ASSET_<NAME>` as an `<img src=...>` or in inline `style="background-image:url(WG_ASSET_<NAME>)"`. The OG/Twitter image is served from the Shopify CDN; loose image files generally should not be added.

**Favicon exception:** `<link rel="icon">` and `<link rel="apple-touch-icon">` (head, ~line 23–24) hold the **literal `data:image/png;base64,...` URI inline**, not a `WG_ASSET_*` token. Browsers request the favicon before `DOMContentLoaded` fires, so the swap script can't reach it in time — the token would 404 on first visit. If you ever regenerate the wolf logo, update `WG_ASSETS["WG_ASSET_WOLF"]` **and** both `<link>` hrefs together.

## Runtime integrations

Configured inline near line ~1916 of `index.html`:
- **Firebase (compat SDK v10.7.1, CDN-loaded)** — Auth + Firestore. Shares the `wolfs-garage-directory` Firebase project with the community app. Used for pack gallery uploads, business listings, and the account modal. `auth.setPersistence(LOCAL)` keeps users signed in across sessions.
- **Cloudinary** — unsigned uploads (`CLOUDINARY_CLOUD = "dancaaglf"`, preset `wolfs-garage`, folder `wolfs-garage-gallery`). Uploads happen client-side; Firestore stores only the resulting URL + metadata.
- **Mailchimp** — newsletter signup form posts to `us2.list-manage.com`. Canonical email backend; do not reintroduce other providers.
- **Shopify storefront** — the "wares" section (lines ~1453–1458) embeds product cards by hand: Shopify CDN image URLs and `shop.wolfsgarage.com/products/...` deep links, hard-coded inline. There is no API call; if a product is renamed, unlisted, or its image URL changes on Shopify, the card breaks silently. Treat this section as manually maintained.
- `ADMIN_EMAILS` is a hard-coded allowlist that auto-approves gallery uploads (`isWolf: true`) and unlocks admin UI. Update both `ADMIN_EMAILS` and `ADMIN_EMAIL` together. Note: Firestore security rules and the Cloudinary upload preset live **outside this repo** — the client-side checks (`MAX_UPLOAD_SIZE`, mime allowlist, `status: pending`) are the only enforcement visible here, so treat the upload form as security-sensitive.

## Sections & layout

Section anchors inside `<main id="main">`: `hero` (`#top`), `directory`, `gallery`, `about`, `bulletin`, `tools`, `wares`, `calendar`, `social`, `join`, `archive`, then footer. Modals (`#bizModal`, `#modal`), search overlay, and toast live at the very end of the body. Nav links + footer links should match these IDs.

## Versioning convention

Bump the version in **all three** places on user-facing changes:
1. `<meta name="site-version" content="1.XX">` near the top of `<head>`.
2. The `console.log('%cWolf\'s Garage site v1.XX', ...)` line immediately after `<body>` opens (around line ~1221).
3. The commit message prefix, e.g. `v1.33 - <short description>`. Look at `git log --oneline` for the pattern; commits are written in that exact style.

## Editing this file with Claude tools

- Never `Read` `index.html` without `offset`/`limit` — the embedded base64 blows past the token limit.
- To locate something: `grep -an "<pattern>" index.html | grep -v "data:image\|base64" | head`.
- To view a range: `awk 'NR==<start>,NR==<end>' index.html` (or `Read` with `offset`+`limit`), and again filter out base64 lines if they fall inside the range.
- Prefer `Edit` with enough surrounding context to make the `old_string` unique; the file has many repeated style fragments.

## Working branch

Development for Claude Code sessions happens on `claude/init-project-A3mQL` (per session config). Commit and push there; do not push to `main` or open PRs unless explicitly asked.
