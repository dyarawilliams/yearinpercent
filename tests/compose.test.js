import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { composePost } from '../src/compose.js';

describe('composePost', () => {
  it('is percent headline + message, no text bar', () => {
    const result = composePost({
      now: new Date(Date.UTC(2025, 0, 1)),
      timeZone: 'UTC',
      templates: ['Test message.'],
      random: () => 0,
      config: {},
    });

    assert.equal(result.percentLabel, '0.00');
    assert.equal(result.year, 2025);
    assert.equal(result.message, 'Test message.');
    assert.equal(result.text, '2025 is 0.00% complete\nTest message.');
    assert.equal(result.text.match(/%/g).length, 1);
    assert.doesNotMatch(result.text, /[█░]/);
  });

  it('fallback text matches the original format: percent, bar, message', () => {
    const result = composePost({
      now: new Date(Date.UTC(2025, 0, 1)),
      timeZone: 'UTC',
      templates: ['Test message.'],
      random: () => 0,
      config: { progressBar: { length: 10, filledChar: '█', emptyChar: '░' } },
    });
    assert.equal(result.bar, '░░░░░░░░░░');
    assert.equal(result.fallbackText, '2025 is 0.00% complete\n░░░░░░░░░░\nTest message.');
    assert.equal(result.fallbackText.match(/%/g).length, 1);
  });

  it('works at mid-year with 2-decimal label', () => {
    const result = composePost({
      now: new Date(2024, 5, 30, 12, 0, 0, 0),
      templates: ['Keep going.'],
      random: () => 0,
    });
    assert.match(result.percentLabel, /^\d+\.\d{2}$/);
    assert.equal(result.text, `${result.year} is ${result.percentLabel}% complete\nKeep going.`);
    assert.equal(result.fallbackText, `${result.year} is ${result.percentLabel}% complete\n${result.bar}\nKeep going.`);
    assert.equal([...result.bar].length, 20);
  });
});
