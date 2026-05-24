// Mailchimp subscriber export — streams audience as CSV
// Reads API key from MAILCHIMP_API_KEY env var (set in Vercel project settings)
// Audience ID is hardcoded — Wolf's Garage main list: b0d82514d3

const LIST_ID = 'b0d82514d3';

export default async function handler(req, res) {
  const key = process.env.MAILCHIMP_API_KEY;
  if (!key) {
    res.status(500).send('MAILCHIMP_API_KEY env var not set in Vercel.');
    return;
  }
  const dc = key.split('-').pop();
  if (!dc) {
    res.status(500).send('Malformed API key — missing datacenter suffix.');
    return;
  }

  try {
    const allMembers = [];
    let offset = 0;
    const pageSize = 1000;

    while (true) {
      const url = `https://${dc}.api.mailchimp.com/3.0/lists/${LIST_ID}/members` +
        `?count=${pageSize}&offset=${offset}` +
        `&fields=members.email_address,members.status,members.timestamp_subscribed,members.merge_fields,total_items`;

      const r = await fetch(url, {
        headers: { 'Authorization': `apikey ${key}` }
      });

      if (!r.ok) {
        const errText = await r.text();
        res.status(r.status).send(`Mailchimp API error (${r.status}): ${errText}`);
        return;
      }

      const data = await r.json();
      const members = data.members || [];
      allMembers.push(...members);

      if (allMembers.length >= (data.total_items || 0) || members.length < pageSize) break;
      offset += pageSize;
    }

    // Build CSV
    const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const header = ['email', 'status', 'subscribed_at', 'first_name', 'last_name'];
    const rows = [header.join(',')];
    for (const m of allMembers) {
      rows.push([
        escape(m.email_address),
        escape(m.status),
        escape(m.timestamp_subscribed),
        escape(m.merge_fields?.FNAME),
        escape(m.merge_fields?.LNAME)
      ].join(','));
    }
    const csv = rows.join('\n');

    const date = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="wolfsgarage-subscribers-${date}.csv"`);
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).send(csv);
  } catch (err) {
    res.status(500).send(`Server error: ${err?.message || String(err)}`);
  }
}
