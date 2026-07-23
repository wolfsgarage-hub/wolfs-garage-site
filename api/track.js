// Privacy-conscious analytics sink. Accepts an event NAME from an allowlist and
// nothing else: no form contents, emails, names, search terms, or coordinates.
// Counts land in analytics.hits via the wg_track_hit RPC (and in the function
// log stream as [wg-analytics] lines for spot checks).
import { rpc } from './_wg.js';

const ALLOWED = new Set([
  'hero_find_event_click',
  'hero_directory_click',
  'shop_outbound_click',
  'event_search',
  'directory_search',
  'event_submission_start',
  'event_submission_complete',
  'business_listing_start',
  'business_listing_complete',
  'account_created',
  'newsletter_opt_in',
  'community_submission_start',
  'community_submission_complete'
]);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false });
    return;
  }
  let name = '';
  let version = '';
  try {
    let body = req.body;
    if (typeof body === 'string') body = JSON.parse(body);
    name = String((body && body.e) || '').replace(/[^a-z0-9_]/gi, '').slice(0, 40);
    version = String((body && body.v) || '').replace(/[^0-9a-z.\-]/gi, '').slice(0, 16);
  } catch (e) { /* malformed body -> ignored */ }
  if (ALLOWED.has(name)) {
    console.log('[wg-analytics] ' + name);
    // Durable store. Failure here must never break the 204 contract:
    // analytics is best-effort, the visitor's request always succeeds.
    // No IP is forwarded - analytics must never carry a visitor identifier.
    try {
      await rpc('wg_track_hit', { p_event: name, p_version: version });
    } catch (e) {
      console.log('[wg-analytics] store_failed: ' + (e && e.message ? e.message : 'unknown'));
    }
  }
  res.status(204).end();
}
