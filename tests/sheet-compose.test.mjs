// Weekend Sheet compose tests — run with: node --test tests/
// Contract per copy deck section 14 (grill decision 7) + brand lock:
// date-grouped show list, one line each, flyers, distance; no source names,
// no em dashes, no exclamation points, no emojis, no "FREE"; copper is text
// and hairlines only, never a fill.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { composeSheet } from '../api/_sheet-compose.js';

const fixture = JSON.parse(
  readFileSync(new URL('./fixtures/weekend-2026-08-28.json', import.meta.url), 'utf8')
);
const OPTS = { friday: '2026-08-28' };

test('subject follows the copy-deck pattern with top show and remainder count', () => {
  const s = composeSheet(fixture.results, OPTS);
  // 17 raw rows, minus the Langers double-listing = 16 real shows
  assert.equal(s.subject, 'This weekend: 9th Annual Taste of Motorsports + 15 more near you');
  assert.equal(s.count, 16);
});

test('same show from two sources is collapsed to one row (brand gate kill 1)', () => {
  const { html, count } = composeSheet(fixture.results, OPTS);
  const langers = (html.match(/Portland Cars (&amp;|and) Coffee/g) || []).length;
  assert.equal(langers, 1, 'Langers double-listing survived dedup');
  assert.equal(count, 16);
});

test('placeholder venue names never render (brand gate kill 2)', () => {
  const { html } = composeSheet(fixture.results, OPTS);
  assert.ok(!html.includes('(venue'), 'raw "(venue ...)" placeholder leaked');
  assert.ok(!html.includes('Brush Prairie, WA &middot; Brush Prairie'), 'city printed twice');
  assert.ok(!html.includes('Salem (venue TBD)'));
});

test('brand fonts lead every stack (brand gate kill 3)', () => {
  const { html } = composeSheet(fixture.results, OPTS);
  assert.ok(html.includes("'Oswald'"), 'headers must lead with Oswald');
  assert.ok(html.includes("'Work Sans'"), 'body must lead with Work Sans');
  assert.ok(!/font-family:Arial/.test(html), 'bare Arial-first stack found');
});

test('pinstripe hairlines run under the header, between day sections and above the footer (kill 4)', () => {
  const { html } = composeSheet(fixture.results, OPTS);
  const redLines = (html.match(/background:#CC0000;/g) || []).length;
  // one pair leading each of the 3 day groups (Friday's doubles as the
  // under-header stripe) plus one pair above the footer
  assert.equal(redLines, 4, `expected 4 red hairlines, got ${redLines}`);
  assert.ok(html.indexOf('background:#CC0000;') < html.indexOf('FRIDAY'), 'header must sit above the first stripe');
});

test('only the four canonical hexes appear', () => {
  const { html } = composeSheet(fixture.results, OPTS);
  assert.ok(!/#a8a399/i.test(html), 'undocumented fifth color');
});

test('AM/PM is normalized uppercase and time text is not an operations manual', () => {
  const { html } = composeSheet(fixture.results, OPTS);
  assert.ok(!/\d(:\d\d)?\s(am|pm)\b/.test(html), 'lowercase am/pm leaked');
  assert.ok(!html.includes('close when full'), 'overloaded time text not truncated');
});

test('flyer thumbs use a non-cropping transform', () => {
  const { html } = composeSheet(fixture.results, OPTS);
  assert.ok(html.includes('c_limit'), 'flyers must not be cropped (clipped text risk)');
  assert.ok(!html.includes('c_fill,q_auto,f_auto'), 'c_fill crop still present');
});

test('single-event weekend drops the "+ N more" tail', () => {
  const one = composeSheet([fixture.results[0]], OPTS);
  assert.match(one.subject, /^This weekend: .+ near you$/);
  assert.ok(!one.subject.includes('+ 0 more'));
});

test('empty weekend composes nothing (a skipped week is silent)', () => {
  const s = composeSheet([], OPTS);
  assert.equal(s.count, 0);
  assert.equal(s.html, null);
});

test('body is date-grouped Friday through Sunday', () => {
  const { html } = composeSheet(fixture.results, OPTS);
  assert.ok(html.includes('FRIDAY'));
  assert.ok(html.includes('SATURDAY'));
  assert.ok(html.includes('SUNDAY'));
  // groups appear in weekend order
  assert.ok(html.indexOf('FRIDAY') < html.indexOf('SATURDAY'));
  assert.ok(html.indexOf('SATURDAY') < html.indexOf('SUNDAY'));
});

test('every surviving event links to its own wolfsgarage.com event page', () => {
  const { html } = composeSheet(fixture.results, OPTS);
  const norm = (t) => String(t || '').toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]/g, '');
  for (const e of fixture.results) {
    const linked = html.includes(`https://wolfsgarage.com/events/${e.slug}`);
    const twin = fixture.results.some(
      (o) => o.slug !== e.slug && o.local_date === e.local_date && norm(o.title) === norm(e.title) &&
        html.includes(`https://wolfsgarage.com/events/${o.slug}`)
    );
    assert.ok(linked || twin, `missing event-page link for ${e.slug}`);
  }
});

test('never renders where a listing came from', () => {
  const { html, subject, previewText } = composeSheet(fixture.results, OPTS);
  const all = html + subject + previewText;
  const norm = (s) => s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9 ]/g, '');
  for (const e of fixture.results) {
    // A source named after the organizer (a club listing its own cruise) is not
    // attribution; its words legitimately appear as the event title.
    const selfNamed = e.source_name && (norm(e.title).includes(norm(e.source_name)) || norm(e.source_name).includes(norm(e.title)));
    if (e.source_name && !selfNamed) assert.ok(!all.includes(e.source_name), `leaked source_name: ${e.source_name}`);
    if (e.source_url) {
      const host = new URL(e.source_url).host;
      assert.ok(!all.includes(host), `leaked source host: ${host}`);
    }
  }
  assert.ok(!/eventbrite|carcruisefinder|getoutgarage/i.test(html));
});

test('banned-on-sight list stays out of subject, preview and body text', () => {
  const { html, subject, previewText } = composeSheet(fixture.results, OPTS);
  const all = html + subject + previewText;
  assert.ok(!all.includes('—'), 'em dash found');
  assert.ok(!all.includes('!'), 'exclamation point found');
  assert.ok(!/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(all), 'emoji found');
  assert.ok(!all.includes('FREE'), '"FREE" as a selling word');
});

test('copper is text and hairlines only, never a fill', () => {
  const { html } = composeSheet(fixture.results, OPTS);
  assert.ok(!/background[^;>]*C8922A/i.test(html), 'copper used as a background');
  assert.ok(!/bgcolor="#C8922A"/i.test(html), 'copper used as a cell fill');
});

test('flyer thumbnails render only for events that have one, plus the real logo', () => {
  const { html } = composeSheet(fixture.results, OPTS);
  const imgs = html.match(/<img /g) || [];
  const withFlyer = fixture.results.filter((e) => e.flyer_url).length;
  assert.equal(imgs.length, withFlyer + 1, 'expected one img per flyer plus the logo');
  assert.ok(html.includes('og-wolf-logo'), 'real wolf logo missing from lockup');
});

test('footer carries the forward line pointing at the signup block', () => {
  const { html } = composeSheet(fixture.results, OPTS);
  assert.ok(html.includes('Forwarded this'));
  assert.ok(html.includes('https://wolfsgarage.com/#connect'));
});

test('titles are HTML-escaped', () => {
  const { html } = composeSheet(fixture.results, OPTS);
  assert.ok(html.includes('Horsepower &amp; Happiness'));
  assert.ok(!html.includes('Horsepower & Happiness<'));
});

test('each row carries venue, city, time and distance', () => {
  const { html } = composeSheet(fixture.results, OPTS);
  const first = fixture.results[0];
  assert.ok(html.includes(first.venue_name.replace(/&/g, '&amp;')) || html.includes(first.venue_name));
  assert.ok(html.includes(`${Math.round(first.distance_miles)} mi`));
});
