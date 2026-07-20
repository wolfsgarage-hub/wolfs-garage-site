// Public event search API.
// GET  /api/events?zip=97217&radius=50&from=&to=&category=&sort=&page=1
// GET  /api/events?state=OR            (statewide)
// GET  /api/events?categories=1        (filter option list)
// POST /api/events  {lat, lng, radius, from, to, category, sort, page}
//   Device-location searches use POST so coordinates never appear in URLs,
//   access logs, or shared CDN caches. Coordinates are rounded client-side.
import { rpc, clientIp, localLimit } from './_wg.js';

export default async function handler(req, res) {
  const ip = clientIp(req);
  if (!localLimit(ip, 90)) {
    res.status(429).json({ ok: false, error: 'rate_limited' });
    return;
  }

  let q;
  if (req.method === 'GET') {
    q = req.query || {};
  } else if (req.method === 'POST') {
    q = (req.body && typeof req.body === 'object') ? req.body : {};
  } else {
    res.status(405).json({ ok: false, error: 'method_not_allowed' });
    return;
  }

  try {
    if (req.method === 'GET' && q.categories) {
      const data = await rpc('wg_event_categories', {}, ip);
      res.setHeader('cache-control', 's-maxage=3600, stale-while-revalidate=86400');
      res.status(200).json({ ok: true, categories: data });
      return;
    }

    const lat = parseFloat(q.lat), lng = parseFloat(q.lng);
    const radius = parseInt(q.radius, 10);
    const page = parseInt(q.page, 10);
    const args = {
      p_zip: /^\d{5}$/.test(String(q.zip || '')) ? String(q.zip) : null,
      p_lat: (req.method === 'POST' && isFinite(lat) && Math.abs(lat) <= 90) ? lat : null,
      p_lng: (req.method === 'POST' && isFinite(lng) && Math.abs(lng) <= 180) ? lng : null,
      p_radius_miles: [25, 50, 100, 250].indexOf(radius) >= 0 ? radius : 50,
      p_state: /^[A-Za-z]{2}$/.test(String(q.state || '')) ? String(q.state).toUpperCase() : null,
      p_from: /^\d{4}-\d{2}-\d{2}$/.test(String(q.from || '')) ? String(q.from) : null,
      p_to: /^\d{4}-\d{2}-\d{2}$/.test(String(q.to || '')) ? String(q.to) : null,
      p_category: /^[a-z0-9-]{2,40}$/.test(String(q.category || '')) ? String(q.category) : null,
      p_sort: ['soonest', 'closest', 'newest'].indexOf(q.sort) >= 0 ? q.sort : 'soonest',
      p_page: (isFinite(page) && page >= 1 && page <= 10) ? page : 1
    };

    const data = await rpc('wg_search_events', args, ip);
    if (args.p_lat == null) {
      res.setHeader('cache-control', 's-maxage=120, stale-while-revalidate=600');
    } else {
      res.setHeader('cache-control', 'private, no-store');
    }
    res.status(200).json(data);
  } catch (e) {
    const status = e.status || 502;
    res.status(status).json({ ok: false, error: status === 429 ? 'rate_limited' : 'server_error' });
  }
}
