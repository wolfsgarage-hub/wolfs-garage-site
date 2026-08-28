// Weekend Sheet drafter — composes the Friday email from the events pipeline
// and creates a Mailchimp DRAFT campaign. IT NEVER SENDS AND NEVER SCHEDULES:
// the only send path is John pressing Send inside Mailchimp after review
// (EMAILS = DRAFTS ONLY). A weekend with no events drafts nothing; a skipped
// week is silent by design (copy deck section 14).
//
//   GET  /api/sheet-draft?status=1   public: was this week drafted yet
//   GET  /api/sheet-draft?dry=1      auth'd: compose only, writes nothing
//   GET|POST /api/sheet-draft        auth'd: create the draft (idempotent per Friday)
//
// Auth: sha256(x-wg-token) must equal TOKEN_SHA256 — the same shared token the
// github-proxy uses (SECRETS.md section 13). Only the hash lives in this public
// repo, same pattern as github-proxy v9.
import { createHash } from 'node:crypto';
import { rpc, clientIp, localLimit } from './_wg.js';
import { composeSheet } from './_sheet-compose.js';

const TOKEN_SHA256 = '24d43c3b9b560f231d23d6470a7482af505b557f0ec0038b74631ce0cac95018';
const LIST_ID = 'b0d82514d3'; // Wolf's Garage main audience (us2)
const REPLY_TO = 'wolfsgaragenw@gmail.com';
const ZIP = '97217';
const RADIUS = 100;

function tokenOk(req) {
  const t = req.headers['x-wg-token'];
  if (typeof t !== 'string' || !t) return false;
  return createHash('sha256').update(t, 'utf8').digest('hex') === TOKEN_SHA256;
}

// The sheet's Friday, computed in the events' own timezone. Run on a Friday it
// targets that day; any other day it targets the Friday ahead.
function sheetFriday(now) {
  const la = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short'
  }).formatToParts(now || new Date());
  const get = (t) => la.find((p) => p.type === t).value;
  const dow = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'));
  const base = new Date(Date.UTC(+get('year'), +get('month') - 1, +get('day')));
  base.setUTCDate(base.getUTCDate() + ((5 - dow + 7) % 7));
  return base.toISOString().slice(0, 10);
}

function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function mcBase() {
  const key = process.env.MAILCHIMP_API_KEY;
  if (!key) return null;
  const dc = key.split('-').pop();
  if (!dc) return null;
  return { key, dc, root: `https://${dc}.api.mailchimp.com/3.0` };
}

async function mc(base, method, path, body) {
  const r = await fetch(base.root + path, {
    method,
    headers: { 'Authorization': `apikey ${base.key}`, 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await r.text();
  let data = null;
  try { data = JSON.parse(text); } catch (e) { /* non-JSON body */ }
  if (!r.ok) {
    const err = new Error(((data && (data.detail || data.title)) || text || 'mailchimp_error').slice(0, 300));
    err.status = r.status;
    throw err;
  }
  return data;
}

async function findExisting(base, title) {
  // Drafts are few; scan the most recent campaigns for this week's title.
  const d = await mc(base, 'GET',
    `/campaigns?count=100&sort_field=create_time&sort_dir=DESC&fields=campaigns.id,campaigns.web_id,campaigns.status,campaigns.settings.title`);
  return (d.campaigns || []).find((c) => c.settings && c.settings.title === title) || null;
}

async function fetchWeekend(friday, ip) {
  const from = friday, to = addDays(friday, 2);
  const all = [];
  for (let page = 1; page <= 3; page++) {
    const d = await rpc('wg_search_events', {
      p_zip: ZIP, p_lat: null, p_lng: null, p_radius_miles: RADIUS, p_state: null,
      p_from: from, p_to: to, p_category: null, p_sort: 'soonest', p_page: page
    }, ip);
    all.push(...(d.results || []));
    if (!d.capped && all.length >= (d.total || 0)) break;
    if (!(d.results || []).length) break;
  }
  return all;
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'method_not_allowed' });
    return;
  }
  const ip = clientIp(req);
  if (!localLimit(ip, 30)) {
    res.status(429).json({ ok: false, error: 'rate_limited' });
    return;
  }
  const q = req.query || {};
  const friday = sheetFriday();
  const title = `weekend-sheet-${friday}`;

  try {
    if (q.status) {
      // Public probe: nothing here an outsider can use — just "drafted or not".
      const base = mcBase();
      if (!base) { res.status(200).json({ ok: false, error: 'not_configured' }); return; }
      const existing = await findExisting(base, title);
      res.setHeader('cache-control', 'no-store');
      res.status(200).json({ ok: true, week: friday, drafted: !!existing, web_id: existing ? existing.web_id : null });
      return;
    }

    if (!tokenOk(req)) {
      res.status(401).json({ ok: false, error: 'unauthorized' });
      return;
    }

    const results = await fetchWeekend(friday, ip);
    const sheet = composeSheet(results, { friday });

    if (q.dry) {
      res.status(200).json({ ok: true, dry: true, week: friday, count: sheet.count, subject: sheet.subject, preview_text: sheet.previewText, html: sheet.html });
      return;
    }

    if (sheet.count === 0) {
      // A skipped week is silent, never an apology email.
      res.status(200).json({ ok: true, week: friday, skipped: 'no_events', count: 0 });
      return;
    }

    const base = mcBase();
    if (!base) { res.status(500).json({ ok: false, error: 'not_configured' }); return; }

    const existing = await findExisting(base, title);
    if (existing) {
      res.status(200).json({
        ok: true, week: friday, drafted: true, created: false, count: sheet.count, subject: sheet.subject,
        edit_url: `https://${base.dc}.admin.mailchimp.com/campaigns/edit?id=${existing.web_id}`
      });
      return;
    }

    const campaign = await mc(base, 'POST', '/campaigns', {
      type: 'regular',
      recipients: { list_id: LIST_ID },
      settings: {
        subject_line: sheet.subject,
        preview_text: sheet.previewText,
        title,
        from_name: "Wolf's Garage",
        reply_to: REPLY_TO,
        auto_footer: false
      }
    });
    await mc(base, 'PUT', `/campaigns/${campaign.id}/content`, {
      html: `<!doctype html><html><body style="margin:0;padding:0;background:#0A0A0A;">${sheet.html}</body></html>`
    });
    // Deliberately no call to /actions/send or /actions/schedule — ever.

    res.status(200).json({
      ok: true, week: friday, drafted: true, created: true, count: sheet.count, subject: sheet.subject,
      edit_url: `https://${base.dc}.admin.mailchimp.com/campaigns/edit?id=${campaign.web_id}`
    });
  } catch (e) {
    res.status(e.status && e.status >= 400 && e.status < 600 ? 502 : 500)
      .json({ ok: false, error: String(e.message || e).slice(0, 300) });
  }
}
