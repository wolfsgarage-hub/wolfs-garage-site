// Serves John's task-list JSON from Google Drive to the admin app.
//
// Why this exists: the admin (raw.githack.com) cannot read the Drive file
// directly - Google sends no CORS headers on any Drive download URL - so it used
// four free public CORS relays. All four went down at once, breaking PULL FROM
// CLOUD. This replaces them with our own server-side fetch: no CORS problem
// server-to-server, and no dependency on strangers' free services.
//
// SECURITY: the Drive file id is fixed here, not taken from the request, so this
// endpoint cannot be turned into an open proxy for arbitrary URLs/files. It only
// ever returns this one public list file.
import { clientIp, localLimit } from './_wg.js';

const DRIVE_FILE_ID = '17V4bhj5UQMgSO6b8tMUeDA9nTDw8r2-l';
const DRIVE_URL = 'https://drive.google.com/uc?export=download&id=' + DRIVE_FILE_ID;

// The admin is served from raw.githack.com; allow that and our own origin.
const ALLOWED_ORIGINS = new Set([
  'https://raw.githack.com',
  'https://wolfsgarage.com',
  'https://www.wolfsgarage.com'
]);

function setCors(req, res) {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'content-type');
}

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'GET') { res.status(405).json({ ok: false, error: 'method' }); return; }

  // Flood backstop, matching the sibling endpoints. IP is an in-process bucket
  // key only - never stored, never logged.
  if (!localLimit(clientIp(req), 60)) { res.status(429).json({ ok: false, error: 'rate_limited' }); return; }

  try {
    const upstream = await fetch(DRIVE_URL, { redirect: 'follow' });
    if (!upstream.ok) { res.status(502).json({ ok: false, error: 'drive_' + upstream.status }); return; }
    const text = await upstream.text();

    // Validate it is the JSON we expect before handing it on. Drive occasionally
    // returns an HTML interstitial instead of the file; parsing guards against
    // shipping that to the admin as if it were data.
    let data;
    try { data = JSON.parse(text); }
    catch (e) {
      const m = text.match(/\{[\s\S]*\}/);
      if (m) { try { data = JSON.parse(m[0]); } catch (e2) { /* fall through */ } }
    }
    if (!data || typeof data !== 'object' || !Array.isArray(data.items)) {
      res.status(502).json({ ok: false, error: 'unexpected_payload' });
      return;
    }

    // Short cache: the list changes rarely and the admin polls on demand.
    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=60');
    res.status(200).json(data);
  } catch (e) {
    res.status(502).json({ ok: false, error: 'fetch_failed' });
  }
}
