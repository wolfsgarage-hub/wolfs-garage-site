// Serves a trimmed product list from the Shopify storefront to the homepage.
//
// Why this exists: the homepage's Wolf Wares cards were hardcoded (names,
// prices, images), so every Shopify change silently drifted from the site.
// Shopify's public /products.json sends no CORS headers, so the page cannot
// read it client-side; this endpoint fetches it server-side and returns only
// the fields the cards need. The page keeps its hardcoded cards as the
// fallback when this endpoint is unreachable.
//
// SECURITY: the upstream URL is fixed here, not taken from the request, so
// this endpoint cannot be used as an open proxy. It only ever returns the
// public product feed of our own store.
import { clientIp, localLimit } from './_wg.js';

const SHOP_URL = 'https://shop.wolfsgarage.com/products.json?limit=12';

const ALLOWED_ORIGINS = new Set([
  'https://wolfsgarage.com',
  'https://www.wolfsgarage.com'
]);

// Module-scope cache: Shopify products change rarely; one upstream hit per
// warm lambda per 10 minutes is plenty.
let cache = { at: 0, body: null };
const CACHE_MS = 10 * 60 * 1000;

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
  if (!localLimit(clientIp(req), 60)) { res.status(429).json({ ok: false, error: 'rate_limited' }); return; }

  res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=3600');

  if (cache.body && Date.now() - cache.at < CACHE_MS) {
    res.status(200).json(cache.body);
    return;
  }

  try {
    const upstream = await fetch(SHOP_URL, { headers: { accept: 'application/json' } });
    if (!upstream.ok) { res.status(502).json({ ok: false, error: 'shop_' + upstream.status }); return; }
    const data = await upstream.json();
    if (!data || !Array.isArray(data.products)) {
      res.status(502).json({ ok: false, error: 'unexpected_payload' });
      return;
    }
    const products = data.products
      .filter(p => p && p.handle && Array.isArray(p.variants) && p.variants.length)
      .slice(0, 8)
      .map(p => ({
        title: String(p.title || '').slice(0, 80),
        url: 'https://shop.wolfsgarage.com/products/' + encodeURIComponent(p.handle),
        price: String((p.variants[0] && p.variants[0].price) || ''),
        image: p.images && p.images[0] && typeof p.images[0].src === 'string' ? p.images[0].src : ''
      }));
    if (!products.length) { res.status(502).json({ ok: false, error: 'empty_feed' }); return; }
    const body = { ok: true, products };
    cache = { at: Date.now(), body };
    res.status(200).json(body);
  } catch (err) {
    res.status(502).json({ ok: false, error: 'fetch_failed' });
  }
}
