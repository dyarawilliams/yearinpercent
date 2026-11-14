import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { pickMessage, loadTemplates, weekNumber } from '../src/message.js';

describe('message', () => {
  it('loads templates from config', () => {
    const templates = loadTemplates();
    assert.ok(Array.isArray(templates));
    assert.ok(templates.length > 1);
  });

  it('config templates have no duplicates', () => {
    const templates = loadTemplates();
    assert.equal(new Set(templates).size, templates.length);
  });

  it('weeks run Monday to Sunday', () => {
    const tz = 'America/New_York';
    const mon = weekNumber(new Date('2026-11-09T15:00:00Z'), tz);
    const sun = weekNumber(new Date('2026-11-15T15:00:00Z'), tz);
    const nextMon = weekNumber(new Date('2026-11-16T15:00:00Z'), tz);
    assert.equal(mon, sun);
    assert.equal(nextMon, mon + 1);
  });

  it('uses the local date in the given timezone', () => {
    // 03:00 UTC Monday is still Sunday evening in New York.
    const d = new Date('2026-11-16T03:00:00Z');
    assert.equal(weekNumber(d, 'America/New_York') + 1, weekNumber(d, 'UTC'));
  });

  it('same week gives the same line', () => {
    const t = ['a', 'b', 'c'];
    const opts = (iso) => ({ now: new Date(iso), timeZone: 'UTC' });
    assert.equal(pickMessage(t, opts('2026-11-09T12:00:00Z')), pickMessage(t, opts('2026-11-13T12:00:00Z')));
  });

  it('rotates through every line before repeating, across a year boundary', () => {
    const t = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
    const start = Date.UTC(2026, 11, 4, 14); // Friday Dec 4 2026
    const seen = [];
    for (let i = 0; i < t.length; i++) {
      seen.push(pickMessage(t, { now: new Date(start + i * 7 * 86_400_000), timeZone: 'UTC' }));
    }
    assert.equal(new Set(seen).size, t.length);
    const next = pickMessage(t, { now: new Date(start + t.length * 7 * 86_400_000), timeZone: 'UTC' });
    assert.equal(next, seen[0]);
  });

  it('consecutive weeks follow file order', () => {
    const t = ['a', 'b', 'c'];
    const now = new Date('2026-11-13T14:00:00Z');
    const i = t.indexOf(pickMessage(t, { now, timeZone: 'UTC' }));
    const later = new Date(now.getTime() + 7 * 86_400_000);
    assert.equal(pickMessage(t, { now: later, timeZone: 'UTC' }), t[(i + 1) % t.length]);
  });

  it('falls back when templates are empty', () => {
    const msg = pickMessage([]);
    assert.ok(typeof msg === 'string' && msg.length > 0);
  });
});
