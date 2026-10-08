import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../App.js', import.meta.url), 'utf8');

test('output destinations use complete names', () => {
  assert.match(appSource, /label: 'DOWNLOADS', value: 'Downloads'/);
  assert.match(appSource, /label: 'MUSIC', value: 'Music'/);
  assert.match(appSource, /label: 'MOVIES', value: 'Movies'/);
  assert.doesNotMatch(appSource, /label: '(DL|MSC|VID)'/);
});
