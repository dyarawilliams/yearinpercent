import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { pickMessage, loadTemplates } from '../src/message.js';

describe('message', () => {
  it('loads templates from config', () => {
    const templates = loadTemplates();
    assert.ok(Array.isArray(templates));
    assert.ok(templates.length > 1);
  });

  it('picks deterministically with injected random', () => {
    const templates = ['alpha', 'beta', 'gamma'];
    assert.equal(pickMessage(templates, () => 0), 'alpha');
    assert.equal(pickMessage(templates, () => 0.99), 'gamma');
  });

  it('falls back when templates are empty', () => {
    const msg = pickMessage([]);
    assert.ok(typeof msg === 'string' && msg.length > 0);
  });
});
