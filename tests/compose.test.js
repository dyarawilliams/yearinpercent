import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { composePost } from '../src/compose.js';

describe('composePost', () => {
  it('includes percent label, bar, and message', () => {
    const result = composePost({
      now: new Date(Date.UTC(2025, 0, 1)),
      timeZone: 'UTC',
      templates: ['Test message.'],
      random: () => 0,
      config: {
        progressBar: { length: 10, filledChar: '█', emptyChar: '░' },
      },
    });

    assert.equal(result.percentLabel, '0.00');
    assert.equal(result.bar, '░░░░░░░░░░');
    assert.equal(result.message, 'Test message.');
    assert.match(result.text, /2025 is 0\.00% complete/);
    assert.equal(result.text, '2025 is 0.00% complete\n░░░░░░░░░░\nTest message.');
    assert.equal(result.text.match(/%/g).length, 1);
    assert.match(result.text, /Test message\./);
  });

  it('works at mid-year with consistent rounding', () => {
    const result = composePost({
      now: new Date(2024, 5, 30, 12, 0, 0, 0), // leap year mid-ish
      templates: ['Keep going.'],
      random: () => 0,
    });
    assert.match(result.percentLabel, /^\d+\.\d{2}$/);
    assert.ok(result.text.includes(result.percentLabel));
    assert.ok(result.text.includes(result.bar));
  });
});
