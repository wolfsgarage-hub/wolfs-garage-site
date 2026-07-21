// Public write actions: event submission, correction reports, organizer claims.
// POST /api/event-action  {action: 'submit'|'correction'|'claim', ...fields, hp}
// Everything lands in review queues — nothing here publishes directly.
// Durable rate limits + honeypot handling live in the database RPCs.
import { rpc, clientIp, localLimit } from './_wg.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'method_not_allowed' });
    return;
  }
  const ip = clientIp(req);
  if (!localLimit(ip, 20)) {
    res.status(429).json({ ok: false, error: 'rate_limited' });
    return;
  }
  const b = (req.body && typeof req.body === 'object') ? req.body : {};
  const s = function (v, max) { return String(v == null ? '' : v).slice(0, max); };

  try {
    let data;
    if (b.action === 'submit') {
      data = await rpc('wg_submit_event', {
        p_title: s(b.title, 120),
        p_date: s(b.date, 10),
        p_time_text: s(b.time_text, 60) || null,
        p_city: s(b.city, 80) || null,
        p_state: s(b.state, 2) || null,
        p_venue: s(b.venue, 150) || null,
        p_description: s(b.description, 1000) || null,
        p_link: s(b.link, 500) || null,
        p_email: s(b.email, 200) || null,
        p_hp: s(b.hp, 50) || null,
        p_flyer_url: s(b.flyer_url, 500) || null
      }, ip);
    } else if (b.action === 'flag') {
      data = await rpc('wg_flag_event', {
        p_slug: s(b.slug, 120),
        p_reason: s(b.reason, 30),
        p_detail: s(b.detail, 500) || null,
        p_hp: s(b.hp, 50) || null
      }, ip);
    } else if (b.action === 'correction') {
      data = await rpc('wg_submit_correction', {
        p_slug: s(b.slug, 120),
        p_kind: s(b.kind, 30),
        p_detail: s(b.detail, 1000) || null,
        p_contact: s(b.contact, 200) || null,
        p_hp: s(b.hp, 50) || null
      }, ip);
    } else if (b.action === 'claim') {
      data = await rpc('wg_claim_event', {
        p_slug: s(b.slug, 120),
        p_name: s(b.name, 100),
        p_email: s(b.email, 200),
        p_message: s(b.message, 1000) || null,
        p_evidence_url: s(b.evidence_url, 500) || null,
        p_hp: s(b.hp, 50) || null
      }, ip);
    } else {
      res.status(400).json({ ok: false, error: 'bad_action' });
      return;
    }
    res.setHeader('cache-control', 'no-store');
    res.status(200).json(data);
  } catch (e) {
    const status = e.status || 502;
    res.status(status).json({ ok: false, error: status === 429 ? 'rate_limited' : 'server_error' });
  }
}
