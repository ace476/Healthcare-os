'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { parseLocalIST } = require('../lib/time-utils');

test('converts an India-local timestamp to UTC correctly', () => {
  assert.equal(parseLocalIST('2026-11-09T10:30').toISOString(), '2026-11-09T05:00:00.000Z');
});

test('rejects malformed timestamps', () => {
  assert.equal(parseLocalIST('09-11-2026 10:30'), null);
  assert.equal(parseLocalIST('not-a-date'), null);
  assert.equal(parseLocalIST(null), null);
});

test('rejects impossible calendar dates', () => {
  assert.equal(parseLocalIST('2026-02-30T10:30'), null);
  assert.equal(parseLocalIST('2026-13-01T10:30'), null);
});

test('rejects invalid clock times', () => {
  assert.equal(parseLocalIST('2026-11-09T24:30'), null);
  assert.equal(parseLocalIST('2026-11-09T10:60'), null);
});
