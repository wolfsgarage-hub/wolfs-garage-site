// Shared helpers for Wolf's Garage event API functions.
// The Supabase anon key below is a PUBLIC client-safe key by design: the anon
// role has zero table access and can only execute the wg_* RPCs, which enforce
// pagination caps, radius/date bounds, rate limits, and published-only rows in
// SQL. All real protection lives in the database, not in this key.
const SUPABASE_URL = 'https://pcqoivjzcokgdtlvoona.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBjcW9pdmp6Y29rZ2R0bHZvb25hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4MjM3NzgsImV4cCI6MjA5NDM5OTc3OH0.yp8ypvsFewABuCjLpewEocY-8vBUjz6gmLLHofYTzbo';

export function clientIp(req) {
  const xf = req.headers['x-forwarded-for'];
  const ip = (typeof xf === 'string' && xf.split(',')[0].trim()) ||
    req.headers['x-real-ip'] || (req.socket && req.socket.remoteAddress) || 'unknown';
  return String(ip).slice(0, 64);
}

// Per-instance backstop limiter. The durable limits are in Postgres; this just
// sheds obvious floods before they cost a database round trip.
const buckets = new Map();
export function localLimit(ip, max) {
  const win = Math.floor(Date.now() / 60000);
  const key = ip + ':' + win;
  const n = (buckets.get(key) || 0) + 1;
  buckets.set(key, n);
  if (buckets.size > 5000) buckets.clear();
  return n <= (max || 90);
}

export async function rpc(name, args, ip) {
  const r = await fetch(SUPABASE_URL + '/rest/v1/rpc/' + name, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'apikey': ANON_KEY,
      'authorization': 'Bearer ' + ANON_KEY,
      'wg-client-ip': ip || 'unknown'
    },
    body: JSON.stringify(args)
  });
  const text = await r.text();
  let data = null;
  try { data = JSON.parse(text); } catch (e) { /* non-JSON error body */ }
  if (!r.ok) {
    const msg = (data && (data.message || data.hint)) || text || 'rpc_error';
    const err = new Error(msg.slice(0, 300));
    err.status = /rate_limited/.test(msg) ? 429 : 502;
    throw err;
  }
  return data;
}

export function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
