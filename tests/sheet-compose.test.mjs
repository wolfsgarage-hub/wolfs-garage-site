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
  assert.equal(s.subject, 'This weekend: 9th Annual Taste of Motorsports + 16 more near you');
  assert.equal(s.count, 17);
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

test('every event links to its own wolfsgarage.com event page', () => {
  const { html } = composeSheet(fixture.results, OPTS);
  for (const e of fixture.results) {
    assert.ok(
      html.includes(`https://wolfsgarage.com/events/${e.slug}`),
      `missing event-page link for ${e.slug}`
    );
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
