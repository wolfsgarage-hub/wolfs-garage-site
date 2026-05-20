# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository shape

This is a **single-file static site**. Everything ships out of `index.html` (~2,100 lines): HTML markup, all CSS in a `<style>` block, all JS in trailing `<script>` blocks. There is no build step, no package manager, no test suite, no linter. To preview locally, open `index.html` in a browser or serve the directory with any static server (e.g. `python3 -m http.server`). Deployment is via Vercel; pushes to the deployed branch publish the site.

Other tracked files:
- `vercel.json` — redirects only. `/directory`, `/directory/*`, `/pages/hot-rodder-directory`, `/pages/hot-rodder-directory/*`, and `/pack` all forward to `https://wolfs-garage-community.vercel.app` (a separate repo). Keep this in sync when adding new short URLs.
- `assets/pistons.svg` — the only loose asset on disk. Every other image is inlined (see below).
- `README.md` — one-line description.

## How assets work (important)

Images are **base64-inlined into a single JS object** named `WG_ASSETS` defined around line ~1222 of `index.html`. The HTML/CSS reference them with sentinel strings like `WG_ASSET_WOLF`, `WG_ASSET_PIN01`, etc. On page load, a small IIFE near the bottom of the file walks `img[src^="WG_ASSET_"]` and `a[href^="WG_ASSET_"]` and rewrites them to the corresponding data URI. This is why `index.html` is ~1.2 MB and why the `Read` tool will reject reading it whole — always use `offset`/`limit` or `grep`/`awk` line ranges, and filter out base64 noise (`grep -v "data:image\|base64"`) when searching.

To add a new image: add a new `WG_ASSET_<NAME>` key to the `WG_ASSETS` object, then reference `WG_ASSET_<NAME>` as an `<img src=...>` or in inline CSS. Do not commit loose image files unless there's a specific reason (favicon/OG image, which live on the Shopify CDN).

## Runtime integrations

Configured inline near line ~1916 of `index.html`:
- **Firebase (compat SDK v10.7.1, CDN-loaded)** — Auth + Firestore. Shares the `wolfs-garage-directory` Firebase project with the community app. Used for pack gallery uploads, business listings, and the account modal. `auth.setPersistence(LOCAL)` keeps users signed in across sessions.
- **Cloudinary** — unsigned uploads (`CLOUDINARY_CLOUD = "dancaaglf"`, preset `wolfs-garage`, folder `wolfs-garage-gallery`). Uploads happen client-side; Firestore stores only the resulting URL + metadata.
- **Mailchimp** — newsletter signup form posts to `us2.list-manage.com`. Canonical email backend; do not reintroduce other providers.
- `ADMIN_EMAILS` is a hard-coded allowlist that auto-approves gallery uploads (`isWolf: true`) and unlocks admin UI. Update both `ADMIN_EMAILS` and `ADMIN_EMAIL` together.

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
