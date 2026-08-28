// Weekend Sheet composer — pure HTML assembly. No network, no secrets, no I/O.
// Copy contract: copy deck section 14 (grill decision 7). Brand lock: black bg,
// red + bone, copper as TEXT AND HAIRLINES ONLY. No em dashes, no exclamation
// points, no emojis, no "FREE", no source names anywhere in the rendered sheet.
// Underscore prefix keeps Vercel from deploying this as its own function.

const BG = '#0A0A0A';
const RED = '#CC0000';
const BONE = '#F5F1E8';
const COPPER = '#C8922A';
const DIM = '#a8a399';
const LOGO =
  'https://res.cloudinary.com/dancaaglf/image/upload/w_96,h_96,c_fill,g_auto,f_png/v1782974224/og-wolf-logo.png';

const DAYS = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Banned-on-sight scrub for data-sourced text (titles, venues, times): the
// sheet never ships an em dash or an exclamation point, whatever a source
// calendar typed.
function clean(s) {
  return String(s == null ? '' : s)
    .replace(/—/g, '-')
    .replace(/–/g, '-')
    .replace(/!/g, '')
    .trim();
}

function ymd(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function addDays(dateStr, n) {
  const dt = ymd(dateStr);
  dt.setDate(dt.getDate() + n);
  const p = (x) => String(x).padStart(2, '0');
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`;
}

function dayHeading(dateStr) {
  const dt = ymd(dateStr);
  return `${DAYS[dt.getDay()]} &middot; ${MONTHS[dt.getMonth()]} ${dt.getDate()}`;
}

function thumb(url) {
  if (typeof url === 'string' && url.includes('res.cloudinary.com') && url.includes('/upload/')) {
    return url.replace('/upload/', '/upload/w_160,h_120,c_fill,q_auto,f_auto/');
  }
  return url;
}

function pickTop(rows) {
  return [...rows].sort(
    (a, b) =>
      (b.flyer_url ? 1 : 0) - (a.flyer_url ? 1 : 0) ||
      (a.distance_miles ?? 9999) - (b.distance_miles ?? 9999) ||
      String(a.local_date).localeCompare(String(b.local_date))
  )[0];
}

function hairlines() {
  return (
    `<tr><td colspan="2" style="height:2px;line-height:2px;font-size:0;background:${RED};">&nbsp;</td></tr>` +
    `<tr><td colspan="2" style="height:1px;line-height:1px;font-size:0;background:${BONE};">&nbsp;</td></tr>`
  );
}

function eventRow(e) {
  const link = `https://wolfsgarage.com/events/${e.slug}`;
  const bits = [];
  if (e.venue_name) bits.push(esc(clean(e.venue_name)));
  if (e.city) bits.push(esc(clean(e.city)) + (e.state && e.state !== 'OR' ? ', ' + esc(e.state) : ''));
  if (e.local_time_text) bits.push(esc(clean(e.local_time_text)));
  if (typeof e.distance_miles === 'number') bits.push(`${Math.round(e.distance_miles)} mi`);

  const flyerCell = e.flyer_url
    ? `<td width="110" valign="top" style="padding:12px 12px 12px 0;">` +
      `<a href="${esc(link)}"><img src="${esc(thumb(e.flyer_url))}" width="110" alt="${esc(clean(e.title))} flyer" style="display:block;width:110px;height:auto;border:1px solid ${COPPER};"/></a></td>`
    : '';

  return (
    `<tr><td colspan="2" style="padding:0;">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>` +
    flyerCell +
    `<td valign="top" style="padding:12px 0;">` +
    `<a href="${esc(link)}" style="color:${BONE};text-decoration:none;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:bold;line-height:1.3;">${esc(clean(e.title))}</a>` +
    `<div style="color:${DIM};font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.5;padding-top:2px;">${bits.join(' &middot; ')}</div>` +
    `</td></tr></table></td></tr>`
  );
}

// results: rows from wg_search_events (already filtered to the weekend window).
// opts.friday: 'YYYY-MM-DD' of the sheet's Friday.
export function composeSheet(results, opts) {
  const friday = opts.friday;
  const weekend = [friday, addDays(friday, 1), addDays(friday, 2)];
  const rows = (results || []).filter((e) => weekend.includes(e.local_date));
  const count = rows.length;

  if (count === 0) {
    return { subject: null, previewText: null, html: null, count: 0, topTitle: null };
  }

  const top = pickTop(rows);
  const topTitle = clean(top.title);
  const subject =
    count > 1
      ? `This weekend: ${topTitle} + ${count - 1} more near you`
      : `This weekend: ${topTitle} near you`;
  const previewText = `${count} ${count === 1 ? 'show' : 'shows'} near Portland this weekend.`;

  const fEnd = ymd(weekend[2]);
  const fStart = ymd(friday);
  const range =
    fStart.getMonth() === fEnd.getMonth()
      ? `${MONTHS[fStart.getMonth()]} ${fStart.getDate()}-${fEnd.getDate()}`
      : `${MONTHS[fStart.getMonth()]} ${fStart.getDate()} - ${MONTHS[fEnd.getMonth()]} ${fEnd.getDate()}`;

  let body = '';
  for (const day of weekend) {
    const dayRows = rows
      .filter((e) => e.local_date === day)
      .sort((a, b) => (a.distance_miles ?? 9999) - (b.distance_miles ?? 9999));
    if (!dayRows.length) continue;
    body +=
      `<tr><td colspan="2" style="padding:22px 0 4px;color:${COPPER};font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:bold;letter-spacing:3px;">${dayHeading(day)}</td></tr>` +
      dayRows.map(eventRow).join('');
  }

  const html =
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${BG};"><tr><td align="center" style="padding:24px 12px;">` +
    `<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:100%;background:${BG};">` +
    // header — wordmark left, real wolf logo upper right
    `<tr><td valign="middle" style="padding:0 0 14px;">` +
    `<div style="color:${BONE};font-family:Arial,Helvetica,sans-serif;font-size:26px;font-weight:bold;letter-spacing:4px;">THE WEEKEND SHEET</div>` +
    `<div style="color:${COPPER};font-family:Arial,Helvetica,sans-serif;font-size:12px;letter-spacing:2px;padding-top:4px;">${range} &middot; WITHIN 100 MILES OF PORTLAND</div>` +
    `</td><td width="72" align="right" valign="top" style="padding:0 0 14px;">` +
    `<a href="https://wolfsgarage.com"><img src="${LOGO}" width="56" height="56" alt="Wolf&#39;s Garage" style="display:block;border:0;"/></a></td></tr>` +
    hairlines() +
    body +
    `<tr><td colspan="2" style="height:18px;line-height:18px;font-size:0;">&nbsp;</td></tr>` +
    hairlines() +
    // footer — text lockup plus the forward line, nothing else
    `<tr><td colspan="2" align="center" style="padding:18px 0 4px;color:${BONE};font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:bold;letter-spacing:3px;">WOLF&#39;S GARAGE &middot; PORTLAND, OREGON</td></tr>` +
    `<tr><td colspan="2" align="center" style="padding:0 0 24px;color:${DIM};font-family:Arial,Helvetica,sans-serif;font-size:12px;">Forwarded this? <a href="https://wolfsgarage.com/#connect" style="color:${COPPER};text-decoration:underline;">Get your own sheet.</a></td></tr>` +
    `</table></td></tr></table>`;

  return { subject, previewText, html, count, topTitle };
}
