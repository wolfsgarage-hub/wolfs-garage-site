// Privacy-conscious analytics sink. Accepts an event NAME from an allowlist and
// nothing else: no form contents, emails, names, search terms, or coordinates.
// Counts land in the Vercel function log stream as [wg-analytics] lines.
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
  try {
    let body = req.body;
    if (typeof body === 'string') body = JSON.parse(body);
    name = String((body && body.e) || '').replace(/[^a-z0-9_]/gi, '').slice(0, 40);
  } catch (e) { /* malformed body -> ignored */ }
  if (ALLOWED.has(name)) console.log('[wg-analytics] ' + name);
  res.status(204).end();
}
