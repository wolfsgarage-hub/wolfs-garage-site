// Event sitemap: /sitemap-events.xml -> /api/sitemap-events (rewrite in vercel.json).
// Lists every public event page (/events/<slug>) that still has a date today or
// later, so search engines and AI answer engines can find the server-rendered
// event pages. Data comes from the wg_sitemap_events RPC: slug, last update and
// next date only, all of it already public on the event pages themselves.
// If the database is unreachable this answers 503 (crawlers retry later and keep
// the last good copy) instead of serving an empty list.
import { rpc, clientIp, localLimit } from './_wg.js';

const ORIGIN = 'https://www.wolfsgarage.com';

function xmlEsc(s) {
  return String(s).replace(/[<>&'"]/g, function (c) {
    return { '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c];
  });
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.status(405).send('Method not allowed');
    return;
  }
  if (!localLimit(clientIp(req), 30)) {
    res.setHeader('retry-after', '120');
    res.status(429).send('Too many requests');
    return;
  }

  let data;
  try {
    data = await rpc('wg_sitemap_events', {}, clientIp(req));
  } catch (e) {
    res.setHeader('retry-after', '600');
    res.setHeader('cache-control', 'no-store');
    res.status(503).send('Sitemap temporarily unavailable');
    return;
  }

  const rows = (data && data.ok && Array.isArray(data.events)) ? data.events : [];
  const parts = ['<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'];
  for (const r of rows) {
    if (!r || !/^[a-z0-9-]{3,120}$/.test(String(r.slug || ''))) continue;
    parts.push('<url><loc>' + ORIGIN + '/events/' + xmlEsc(r.slug) + '</loc>'
      + (r.lastmod ? '<lastmod>' + xmlEsc(r.lastmod) + '</lastmod>' : '')
      + '</url>');
  }
  parts.push('</urlset>');

  res.setHeader('content-type', 'application/xml; charset=utf-8');
  // Edge-cache for an hour; events publish nightly, so this stays fresh enough.
  res.setHeader('cache-control', 's-maxage=3600, stale-while-revalidate=86400');
  res.status(200).send(parts.join('\n'));
}
