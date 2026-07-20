// Server-rendered event detail page: /events/[slug] -> /api/event-page?slug=...
// Renders full HTML with OG tags + JSON-LD so individual public event pages
// stay indexable by normal search engines. Data comes from wg_get_event only —
// no private fields exist in that RPC's output.
import { rpc, clientIp, localLimit, esc } from './_wg.js';

const LOGO = 'https://res.cloudinary.com/dancaaglf/image/upload/w_96,h_96,c_fill,g_auto,f_png/v1782974224/og-wolf-logo.png';
const OG_IMG = 'https://res.cloudinary.com/dancaaglf/image/upload/b_rgb:0A0A0A,c_pad,w_1200,h_630,q_auto,f_jpg/v1782974224/og-wolf-logo.jpg';

const ACCESS_LABEL = {
  public_free: 'Free · open to the public',
  public_paid: 'Open to the public · admission applies',
  public_registration: 'Open to the public · registration required',
  public_waitlist: 'Open to the public · sold out / waitlist',
  unknown: 'See official source for attendance details',
  private: 'Private event'
};

function fmtDate(d) {
  if (!d) return '';
  const dt = new Date(d + 'T12:00:00Z');
  return dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).toUpperCase();
}

function statusBadge(evStatus, occStatus) {
  if (evStatus === 'canceled' || occStatus === 'canceled') return '<span class="badge badge-cancel">CANCELED</span>';
  if (evStatus === 'postponed' || occStatus === 'postponed') return '<span class="badge badge-cancel">POSTPONED</span>';
  if (occStatus === 'sold_out') return '<span class="badge badge-warn">SOLD OUT</span>';
  if (occStatus === 'rescheduled') return '<span class="badge badge-warn">RESCHEDULED</span>';
  return '';
}

function page(title, body, meta) {
  return '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">'
    + '<meta name="viewport" content="width=device-width,initial-scale=1">'
    + '<title>' + esc(title) + '</title>'
    + (meta || '')
    + '<link rel="icon" type="image/png" href="' + LOGO + '">'
    + '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
    + '<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Oswald:wght@400;500;600;700&family=Work+Sans:wght@400;500;600&family=Special+Elite&display=swap" rel="stylesheet">'
    + '<style>'
    + ':root{--bg:#0A0A0A;--red:#CC0000;--bone:#F5F1E8;--copper:#C8922A;--panel:#141414;--panel-2:#1c1c1c;--border:rgba(245,241,232,.08);--border-strong:rgba(245,241,232,.18)}'
    + '*{box-sizing:border-box;margin:0;padding:0}'
    + 'body{background:var(--bg);color:var(--bone);font-family:"Work Sans",sans-serif;line-height:1.55}'
    + 'a{color:var(--copper);text-decoration:none}a:hover{text-decoration:underline}'
    + '.pin{height:3px;background:repeating-linear-gradient(90deg,var(--red) 0 16px,transparent 16px 20px,var(--bone) 20px 23px,transparent 23px 27px);opacity:.85}'
    + 'header{display:flex;align-items:center;justify-content:space-between;padding:14px 18px;max-width:920px;margin:0 auto}'
    + '.wordmark{font-family:"Bebas Neue",sans-serif;font-size:1.5rem;letter-spacing:.12em;color:var(--bone)}'
    + '.wordmark span{color:var(--red)}'
    + 'header img{width:44px;height:44px;border-radius:50%}'
    + 'main{max-width:920px;margin:0 auto;padding:22px 18px 60px}'
    + 'h1{font-family:"Bebas Neue",sans-serif;font-size:clamp(1.8rem,6vw,3rem);letter-spacing:.06em;line-height:1.05;margin:10px 0 6px}'
    + '.meta-line{font-family:"Oswald",sans-serif;text-transform:uppercase;letter-spacing:.1em;font-size:.95rem;color:var(--red);margin-bottom:4px}'
    + '.copper{color:var(--copper)}'
    + '.panel{background:var(--panel);border:1px solid var(--border);border-left:4px solid var(--red);padding:18px;margin:16px 0}'
    + '.panel h2{font-family:"Oswald",sans-serif;text-transform:uppercase;letter-spacing:.12em;font-size:1rem;margin-bottom:10px;color:var(--bone)}'
    + '.kv{display:grid;grid-template-columns:130px 1fr;gap:6px 14px;font-size:.95rem}'
    + '.kv dt{color:var(--copper);font-family:"Oswald",sans-serif;text-transform:uppercase;font-size:.78rem;letter-spacing:.1em;padding-top:2px}'
    + '.badge{display:inline-block;font-family:"Oswald",sans-serif;font-size:.72rem;letter-spacing:.12em;padding:3px 9px;border:1px solid var(--border-strong);margin-right:6px;text-transform:uppercase}'
    + '.badge-cancel{background:var(--red);color:var(--bone);border-color:var(--red)}'
    + '.badge-warn{border-color:var(--copper);color:var(--copper)}'
    + '.badge-ok{color:var(--bone)}'
    + '.btn-red{display:inline-block;background:var(--red);color:var(--bone);font-family:"Oswald",sans-serif;text-transform:uppercase;letter-spacing:.12em;padding:12px 26px;border:none;cursor:pointer;font-size:.9rem}'
    + '.btn-ghost{display:inline-block;background:none;color:var(--bone);font-family:"Oswald",sans-serif;text-transform:uppercase;letter-spacing:.12em;padding:11px 22px;border:1px solid var(--border-strong);cursor:pointer;font-size:.85rem}'
    + '.occ{padding:8px 0;border-bottom:1px solid var(--border);font-size:.95rem}'
    + '.occ:last-child{border-bottom:none}'
    + '.typewriter{font-family:"Special Elite",monospace;font-size:.82rem;color:var(--copper)}'
    + 'form label{display:block;font-family:"Oswald",sans-serif;font-size:.78rem;text-transform:uppercase;letter-spacing:.1em;color:var(--copper);margin:10px 0 4px}'
    + 'form input,form select,form textarea{width:100%;padding:10px 12px;background:rgba(0,0,0,.5);border:1px solid var(--border-strong);color:var(--bone);font-family:"Work Sans",sans-serif;font-size:.95rem}'
    + '.hpfield{position:absolute;left:-5000px;opacity:0;height:1px;overflow:hidden}'
    + '.formmsg{margin-top:10px;font-size:.9rem;color:var(--copper);display:none}'
    + 'footer{max-width:920px;margin:0 auto;padding:18px;font-size:.8rem;color:rgba(245,241,232,.5)}'
    + '@media(max-width:560px){.kv{grid-template-columns:1fr}.kv dt{padding-top:8px}}'
    + '</style></head><body>'
    + '<header><a class="wordmark" href="/">WOLF’S <span>GARAGE</span></a>'
    + '<a href="/"><img src="' + LOGO + '" alt="Wolf’s Garage wolf logo"></a></header>'
    + '<div class="pin"></div>'
    + '<main>' + body + '</main>'
    + '<div class="pin"></div>'
    + '<footer>Wolf’s Garage · Portland, OR · <a href="/events">All events</a> · <a href="/directory">Hot Rodder Directory</a> · <a href="/">Home</a></footer>'
    + '</body></html>';
}

export default async function handler(req, res) {
  const ip = clientIp(req);
  if (!localLimit(ip, 120)) { res.status(429).send('Too many requests'); return; }
  const slug = String((req.query && req.query.slug) || '').slice(0, 120);
  res.setHeader('content-type', 'text/html; charset=utf-8');

  if (!/^[a-z0-9-]{3,120}$/.test(slug)) {
    res.status(404).send(page('Event not found — Wolf’s Garage',
      '<h1>EVENT NOT FOUND</h1><p>That listing doesn’t exist or was removed.</p><p style="margin-top:16px"><a class="btn-red" href="/events">BROWSE ALL EVENTS</a></p>'));
    return;
  }

  let data;
  try {
    data = await rpc('wg_get_event', { p_slug: slug }, ip);
  } catch (e) {
    res.status(e.status === 429 ? 429 : 502).send(page('Wolf’s Garage Events',
      '<h1>HOLD ON</h1><p>' + (e.status === 429 ? 'Too many requests — give it a minute.' : 'Something went wrong loading this event. Try again shortly.') + '</p>'));
    return;
  }
  if (!data || data.ok !== true) {
    res.status(404).send(page('Event not found — Wolf’s Garage',
      '<h1>EVENT NOT FOUND</h1><p>That listing doesn’t exist or was removed.</p><p style="margin-top:16px"><a class="btn-red" href="/events">BROWSE ALL EVENTS</a></p>'));
    return;
  }

  const e = data.event, occ = data.occurrences || [], rel = data.related || [];
  const nextOcc = occ.find(function (o) { return o.local_date >= new Date().toISOString().slice(0, 10); }) || occ[occ.length - 1] || null;
  const cityState = [e.city, e.state].filter(Boolean).join(', ');
  const desc = (e.summary || ('Automotive event in ' + cityState + '.')).slice(0, 300);

  const ld = {
    '@context': 'https://schema.org', '@type': 'Event',
    name: e.title, description: desc,
    url: 'https://wolfsgarage.com/events/' + e.slug,
    eventStatus: 'https://schema.org/' + (e.event_status === 'canceled' ? 'EventCancelled' : e.event_status === 'postponed' ? 'EventPostponed' : 'EventScheduled'),
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode'
  };
  if (nextOcc) { ld.startDate = nextOcc.starts_at; if (nextOcc.ends_at) ld.endDate = nextOcc.ends_at; }
  if (e.venue_name) {
    ld.location = { '@type': 'Place', name: e.venue_name, address: { '@type': 'PostalAddress', streetAddress: e.venue_address || undefined, addressLocality: e.venue_city || e.city || undefined, addressRegion: e.venue_state || e.state || undefined, postalCode: e.venue_zip || undefined, addressCountry: 'US' } };
  }
  if (e.organizer_name) ld.organizer = { '@type': 'Organization', name: e.organizer_name, url: e.organizer_website || undefined };
  if (e.registration_url) ld.offers = { '@type': 'Offer', url: e.registration_url };

  const meta = '<meta name="description" content="' + esc(desc) + '">'
    + '<link rel="canonical" href="https://wolfsgarage.com/events/' + esc(e.slug) + '">'
    + '<meta property="og:title" content="' + esc(e.title) + '">'
    + '<meta property="og:description" content="' + esc(desc) + '">'
    + '<meta property="og:type" content="website">'
    + '<meta property="og:url" content="https://wolfsgarage.com/events/' + esc(e.slug) + '">'
    + '<meta property="og:image" content="' + (e.flyer_url ? esc(e.flyer_url) : OG_IMG) + '">'
    + '<script type="application/ld+json">' + JSON.stringify(ld).replace(/</g, '\\u003c') + '</script>';

  const mapsQ = encodeURIComponent([e.venue_name, e.venue_address, e.venue_city || e.city, e.venue_state || e.state, e.venue_zip].filter(Boolean).join(', '));
  const occHtml = occ.length
    ? occ.map(function (o) {
        return '<div class="occ">' + fmtDate(o.local_date)
          + (o.local_time_text ? ' · ' + esc(o.local_time_text) : '')
          + ' ' + statusBadge(null, o.status)
          + (o.note ? '<div class="typewriter">' + esc(o.note) + '</div>' : '') + '</div>';
      }).join('')
    : '<div class="occ">Dates listed at the official source.</div>';

  const relHtml = rel.length
    ? '<div class="panel"><h2>More events nearby</h2>' + rel.map(function (r) {
        return '<div class="occ"><a href="/events/' + esc(r.slug) + '">' + esc(r.title) + '</a> — ' + fmtDate(r.local_date) + ' · ' + esc([r.city, r.state].filter(Boolean).join(', ')) + '</div>';
      }).join('') + '</div>'
    : '';

  const body =
    '<p class="meta-line"><a href="/events" style="color:var(--red)">← ALL EVENTS</a></p>'
    + '<h1>' + esc(e.title) + '</h1>'
    + '<p class="meta-line">' + (nextOcc ? fmtDate(nextOcc.local_date) : '') + (cityState ? ' · <span class="copper">' + esc(cityState) + '</span>' : '') + '</p>'
    + '<p>' + statusBadge(e.event_status, nextOcc && nextOcc.status)
    + (e.verification === 'organizer_verified' ? '<span class="badge badge-ok">ORGANIZER VERIFIED</span>' : e.verification === 'source_verified' ? '<span class="badge badge-ok">SOURCE VERIFIED</span>' : '')
    + (e.claimed ? '<span class="badge badge-ok">CLAIMED</span>' : '')
    + (e.is_recurring ? '<span class="badge badge-ok">RECURRING</span>' : '') + '</p>'
    + (e.summary ? '<div class="panel"><p>' + esc(e.summary) + '</p></div>' : '')
    + '<div class="panel"><h2>When</h2>' + occHtml
    + (e.series_rule ? '<p class="typewriter" style="margin-top:8px">Series: ' + esc(e.series_rule) + '</p>' : '')
    + '<p class="typewriter" style="margin-top:8px">Times shown in venue local time (' + esc(e.timezone || 'America/Los_Angeles') + ')</p></div>'
    + '<div class="panel"><h2>Where</h2><dl class="kv">'
    + (e.venue_name ? '<dt>Venue</dt><dd>' + esc(e.venue_name) + '</dd>' : '')
    + (e.venue_address ? '<dt>Address</dt><dd>' + esc(e.venue_address) + (e.venue_city ? ', ' + esc(e.venue_city) : '') + (e.venue_state ? ', ' + esc(e.venue_state) : '') + ' ' + esc(e.venue_zip || '') + '</dd>' : (cityState ? '<dt>Area</dt><dd>' + esc(cityState) + '</dd>' : ''))
    + '</dl>'
    + (mapsQ ? '<p style="margin-top:12px"><a class="btn-ghost" href="https://www.google.com/maps/search/?api=1&query=' + mapsQ + '" target="_blank" rel="noopener">GET DIRECTIONS</a></p>' : '')
    + '</div>'
    + '<div class="panel"><h2>Attending</h2><dl class="kv">'
    + '<dt>Access</dt><dd>' + esc(ACCESS_LABEL[e.access_type] || ACCESS_LABEL.unknown) + '</dd>'
    + (e.admission ? '<dt>Admission</dt><dd>' + esc(e.admission) + '</dd>' : '')
    + (e.organizer_name ? '<dt>Organizer</dt><dd>' + esc(e.organizer_name) + (e.organizer_website ? ' · <a href="' + esc(e.organizer_website) + '" target="_blank" rel="noopener">website</a>' : '') + '</dd>' : '')
    + '</dl>'
    + (e.registration_url ? '<p style="margin-top:12px"><a class="btn-red" href="' + esc(e.registration_url) + '" target="_blank" rel="noopener">TICKETS / REGISTRATION</a></p>' : '')
    + '</div>'
    + '<div class="panel"><h2>Source</h2>'
    + '<p>' + (e.source_url ? 'Facts gathered from <a href="' + esc(e.source_url) + '" target="_blank" rel="noopener">' + esc(e.source_name || 'the official source') + '</a>.' : 'Community-submitted listing.')
    + (e.official_url && e.official_url !== e.source_url ? ' Official page: <a href="' + esc(e.official_url) + '" target="_blank" rel="noopener">link</a>.' : '') + '</p>'
    + (e.last_verified_at ? '<p class="typewriter" style="margin-top:6px">Last verified ' + esc(String(e.last_verified_at).slice(0, 10)) + '</p>' : '')
    + '<p class="typewriter" style="margin-top:6px">Always confirm with the organizer before making the drive.</p></div>'
    + '<div class="panel"><h2>Are you the organizer?</h2>'
    + '<p>Claim this event to correct details, add official links, update registration, or mark it canceled or postponed.</p>'
    + '<form id="claimForm" style="margin-top:6px">'
    + '<label>Your name</label><input name="name" maxlength="100" required>'
    + '<label>Email</label><input name="email" type="email" maxlength="200" required>'
    + '<label>Proof you’re the organizer (official page, post, etc.)</label><input name="evidence_url" maxlength="500" placeholder="https://">'
    + '<label>Message</label><textarea name="message" rows="3" maxlength="1000"></textarea>'
    + '<div class="hpfield"><label>Leave this empty</label><input name="hp" tabindex="-1" autocomplete="off"></div>'
    + '<p style="margin-top:12px"><button class="btn-red" type="submit">CLAIM THIS EVENT</button></p>'
    + '<p class="formmsg" id="claimMsg"></p></form></div>'
    + '<div class="panel"><h2>See something wrong?</h2>'
    + '<form id="fixForm">'
    + '<label>What’s wrong</label><select name="kind" required>'
    + '<option value="wrong_date">Wrong date</option><option value="wrong_time">Wrong time</option>'
    + '<option value="wrong_venue">Wrong venue</option><option value="wrong_address">Wrong address</option>'
    + '<option value="duplicate">Duplicate listing</option><option value="canceled">Event canceled</option>'
    + '<option value="postponed">Event postponed</option><option value="broken_link">Broken link</option>'
    + '<option value="unauthorized_media">Unauthorized image</option><option value="other">Other</option></select>'
    + '<label>Details</label><textarea name="detail" rows="3" maxlength="1000"></textarea>'
    + '<label>Contact (optional)</label><input name="contact" maxlength="200">'
    + '<div class="hpfield"><label>Leave this empty</label><input name="hp" tabindex="-1" autocomplete="off"></div>'
    + '<p style="margin-top:12px"><button class="btn-ghost" type="submit">REPORT CORRECTION</button></p>'
    + '<p class="formmsg" id="fixMsg"></p></form></div>'
    + relHtml
    + '<div class="panel"><h2>Make a day of it</h2><p>Check the <a href="/directory">Hot Rodder Directory</a> for automotive businesses worth a stop near this event.</p></div>'
    + '<script>'
    + 'function wgPost(form,action,extra,msgEl){form.addEventListener("submit",async function(ev){ev.preventDefault();'
    + 'var fd=new FormData(form),body={action:action,slug:' + JSON.stringify(e.slug) + '};fd.forEach(function(v,k){body[k]=v;});Object.assign(body,extra||{});'
    + 'var m=document.getElementById(msgEl);m.style.display="block";m.textContent="Sending...";'
    + 'try{var r=await fetch("/api/event-action",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});'
    + 'var d=await r.json();'
    + 'if(d.ok){m.textContent="Got it. Wolf reviews these personally — thanks for keeping the calendar straight.";form.reset();}'
    + 'else{m.textContent=r.status===429?"Too many requests — try again in a bit.":"Could not send. Check required fields and try again.";}'
    + '}catch(err){m.textContent="Network hiccup — try again.";}});}'
    + 'wgPost(document.getElementById("claimForm"),"claim",null,"claimMsg");'
    + 'wgPost(document.getElementById("fixForm"),"correction",null,"fixMsg");'
    + '</script>';

  res.setHeader('cache-control', 's-maxage=300, stale-while-revalidate=3600');
  res.status(200).send(page(e.title + ' — Automotive Events — Wolf’s Garage', body, meta));
}
