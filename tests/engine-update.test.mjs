import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const moduleSource = readFileSync(
  new URL('../android/app/src/main/java/com/aspen/yoinkit/YoutubeDlModule.kt', import.meta.url),
  'utf8',
);

test('initialization refreshes yt-dlp from the stable channel', () => {
  assert.match(moduleSource, /updateYoutubeDL\([^,]+, YoutubeDL\.UpdateChannel\._STABLE\)/);
  assert.match(moduleSource, /putString\("version",/);
  assert.match(moduleSource, /putString\("updateWarning",/);
});
