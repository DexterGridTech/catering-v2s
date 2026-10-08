import {mkdirSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {expect, it} from 'vitest';
import {createAndroidDisplayCapture} from '../src/androidCapture.ts';
import {createAndroidSystemUi} from '../src/androidSystemUi.ts';

it('manually reads the authorized Android system screen', async () => {
  const serial = 'emulator-5560';
  const systemUi = createAndroidSystemUi({adbPath: 'adb', serial});
  const capture = createAndroidDisplayCapture({adbPath: 'adb', serial, shape: 'mobile'});
  const hierarchy = await systemUi.readHierarchy();
  const screenshot = await capture.capture('primary');
  const screenshotPath = path.resolve('../../.runtime/terminal-automation/manual-system-screen.png');
  mkdirSync(path.dirname(screenshotPath), {recursive: true});
  writeFileSync(screenshotPath, screenshot);
  const visible = [...hierarchy.matchAll(/<node\b[^>]*>/gu)].map(match => {
    const tag = match[0];
    const attribute = (name: string): string => tag.match(new RegExp(`${name}="([^"]*)"`, 'u'))?.[1] ?? '';
    return {text: attribute('text'), description: attribute('content-desc'), package: attribute('package'), clickable: attribute('clickable')};
  }).filter(node => node.text || node.description);
  process.stdout.write(`MANUAL_ANDROID_SCREEN path=${screenshotPath} bytes=${screenshot.length}\n`);
  process.stdout.write(`MANUAL_ANDROID_UI=${JSON.stringify(visible)}\n`);
  expect(hierarchy).toContain('<hierarchy');
  expect(screenshot.length).toBeGreaterThan(0);
});
