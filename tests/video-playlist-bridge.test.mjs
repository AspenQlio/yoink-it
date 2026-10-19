import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const moduleSource = readFileSync(
  new URL('../android/app/src/main/java/com/aspen/yoinkit/YoutubeDlModule.kt', import.meta.url),
  'utf8',
);
const appSource = readFileSync(new URL('../App.js', import.meta.url), 'utf8');

test('native bridge scans media and downloads selected items', () => {
  assert.match(moduleSource, /fun analyzeLink\(url: String/);
  assert.match(moduleSource, /"--dump-json"/);
  assert.match(moduleSource, /"--force-ipv4"/);
  assert.match(moduleSource, /"--playlist-items"/);
  assert.match(moduleSource, /VideoPlaylistSelector\.outputTemplate/);
  assert.match(moduleSource, /payload\.putString\("url", canonicalUrl\)/);
  assert.match(moduleSource, /payload\.putString\("thumbnail", bestThumbnail\(json\)\)/);
  assert.match(moduleSource, /if \(parsed\.isEmpty\(\)\)/);
  assert.match(moduleSource, /result\.putInt\("count", parsed\.size\)/);
});

test('UI automatically analyzes links and exposes selectable slides', () => {
  assert.match(appSource, /YoutubeDlModule\.analyzeLink\(targetUrl/);
  assert.match(appSource, /items: picked/);
  assert.match(appSource, /entry\?\.url \|\| entry\?\._query/);
  assert.match(appSource, /entry\.thumbnail/);
  assert.match(appSource, /logHistory\.slice\(0, 2\)/);
  assert.match(appSource, /lower\.includes\('tt\.site'\)/);
});
