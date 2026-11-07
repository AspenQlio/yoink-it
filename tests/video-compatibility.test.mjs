import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const moduleSource = readFileSync(
  new URL('../android/app/src/main/java/com/aspen/yoinkit/YoutubeDlModule.kt', import.meta.url),
  'utf8',
);
const selectorSource = readFileSync(
  new URL('../android/app/src/main/java/com/aspen/yoinkit/VideoFormatSelector.kt', import.meta.url),
  'utf8',
);

test('video downloads prioritize H.264 and AAC for Instagram Stories compatibility', () => {
  assert.match(moduleSource, /VideoFormatSelector\.FORMAT_SORT/);
  assert.match(moduleSource, /VideoFormatSelector\.formatFor\(quality\)/);
  assert.match(moduleSource, /"--recode-video", "mp4"/);
  assert.match(selectorSource, /vcodec:h264/);
  assert.match(selectorSource, /acodec:m4a/);
  assert.match(selectorSource, /vcodec\^=avc1/);
});
