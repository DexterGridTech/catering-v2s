import {readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';

const deviceModule = readFileSync(
  new URL(
    '../../../../adapter/android/device/android/src/main/java/com/catering/v2s/terminal/adapter/android/device/TerminalDeviceModule.kt',
    import.meta.url,
  ),
  'utf8',
);
const dualScreenModule = readFileSync(
  new URL(
    '../../../../adapter/android/dual-screen/android/src/main/java/com/catering/v2s/terminal/adapter/android/dualscreen/TerminalDualScreenActivityHandler.kt',
    import.meta.url,
  ),
  'utf8',
);

describe('native display selection source contract', () => {
  it('keeps only the default display and explicitly declared presentation displays', () => {
    expect(
      /\.filter\s*\{\s*it\.displayId == Display\.DEFAULT_DISPLAY \|\| it\.flags and Display\.FLAG_PRESENTATION != 0\s*\}/.test(
        deviceModule,
      ),
    ).toBe(true);
    expect(
      /\.filter\s*\{\s*it\.displayId == Display\.DEFAULT_DISPLAY \|\| it\.flags and Display\.FLAG_PRESENTATION != 0\s*\}/.test(
        dualScreenModule,
      ),
    ).toBe(true);
  });
});
