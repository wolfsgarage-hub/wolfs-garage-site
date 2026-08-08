// Serves a Google Calendar iCal (.ics) feed to the admin's calendar sync.
//
// Same reason as api/cloud-lists.js: the admin (raw.githack.com) cannot fetch the
// feed directly - Google sends no CORS headers - so it leaned on free public CORS
// relays that all went down. This fetches the feed server-side and returns it
// with CORS for the admin.
//
// SECURITY: unlike cloud-lists (one fixed file), the calendar URL is user-supplied
// by John in the admin config, so this MUST NOT be an open proxy. The url is
// accepted ONLY if it is https and the host is exactly calendar.google.com with an
// iCal path. Anything else is refused, so this cannot be used to fetch arbitrary
// hosts or internal addresses (SSRF).
import { clientIp, localLimit } from './_wg.js';

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

// Only a Google Calendar iCal feed. Returns the validated URL string or null.
function validCalendarUrl(raw) {
  if (!raw || raw.length > 500) return null;
  let u;
  try { u = new URL(raw); } catch (e) { return null; }
  if (u.protocol !== 'https:') return null;
  if (u.hostname !== 'calendar.google.com') return null;
  if (!u.pathname.startsWith('/calendar/ical/')) return null;
  return u.toString();
}

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'GET') { res.status(405).json({ ok: false, error: 'method' }); return; }
  if (!localLimit(clientIp(req), 60)) { res.status(429).json({ ok: false, error: 'rate_limited' }); return; }

  const url = validCalendarUrl(req.query && req.query.url);
  if (!url) { res.status(400).json({ ok: false, error: 'bad_url' }); return; }

  try {
    const upstream = await fetch(url, { redirect: 'follow' });
    if (!upstream.ok) { res.status(502).json({ ok: false, error: 'cal_' + upstream.status }); return; }
    const text = await upstream.text();
    if (!text.includes('BEGIN:VCALENDAR')) { res.status(502).json({ ok: false, error: 'not_ical' }); return; }
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300');
    res.status(200).send(text);
  } catch (e) {
    res.status(502).json({ ok: false, error: 'fetch_failed' });
  }
}
