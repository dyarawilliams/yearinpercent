import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { renderProgressBar } from '../src/progressBar.js';

describe('renderProgressBar', () => {
  it('renders empty bar at 0%', () => {
    assert.equal(renderProgressBar(0, { length: 10 }), '░░░░░░░░░░');
  });

  it('renders full bar at 100%', () => {
    assert.equal(renderProgressBar(100, { length: 10 }), '██████████');
  });

  it('rounds filled segments consistently with percentage', () => {
    // 50% of 20 = 10 filled
    assert.equal(renderProgressBar(50, { length: 20 }), '██████████░░░░░░░░░░');
  });

  it('respects custom characters', () => {
    assert.equal(
      renderProgressBar(50, { length: 4, filledChar: '#', emptyChar: '-' }),
      '##--'
    );
  });

  it('clamps out-of-range values', () => {
    assert.equal(renderProgressBar(-5, { length: 5 }), '░░░░░');
    assert.equal(renderProgressBar(150, { length: 5 }), '█████');
  });
});
