import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const moduleSource = readFileSync(
  new URL('../android/app/src/main/java/com/aspen/yoinkit/YoutubeDlModule.kt', import.meta.url),
  'utf8',
);
const appSource = readFileSync(new URL('../App.js', import.meta.url), 'utf8');

test('native bridge scans media and downloads selected items', () => {
  assert.match(moduleSource, /fun analyzeLink\(url: String, promise: Promise\)/);
  assert.match(moduleSource, /"--dump-json"/);
  assert.match(moduleSource, /"--playlist-items"/);
  assert.match(moduleSource, /VideoPlaylistSelector\.outputTemplate/);
});

test('UI automatically analyzes links and exposes selectable slides', () => {
  assert.match(appSource, /YoutubeDlModule\.analyzeLink\(targetUrl\)/);
  assert.match(appSource, /'SLIDES'/);
  assert.match(appSource, /items: picked/);
});
