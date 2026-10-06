import {describe, expect, it, vi} from 'vitest';
import {buildAndroidCaptureArguments, createAndroidDisplayCapture} from '../src/androidCapture.js';
import type {AndroidDisplayMapping} from '../src/displayMapping.js';

const displays =
  'Display id 0: DisplayInfo{"Internal Screen", real 1920 x 1080, FLAG_DEFAULT} uniqueId "local:0" rotation 0\n' +
  'Display id 2: DisplayInfo{"TER Secondary", real 1280 x 720, FLAG_PRESENTATION} uniqueId "virtual:42" rotation 0';
const surfaces =
  'Display 0 (HWC display 0, primary, "Internal")\n' +
  '    connectionType=Internal\n' +
  '    name="Internal"\n' +
  '    displayModes={id=0, resolution=1920x1080}\n' +
  'Virtual Display 4294967298\n' +
  '    name="TER Secondary"\n' +
  '    activeMode={id=0, resolution=1280x720}';
const createPngHeader = (width: number, height: number): Buffer => {
  const bytes = Buffer.alloc(33);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(bytes, 0);
  bytes.writeUInt32BE(13, 8);
  bytes.write('IHDR', 12, 'ascii');
  bytes.writeUInt32BE(width, 16);
  bytes.writeUInt32BE(height, 20);
  bytes[24] = 8;
  bytes[25] = 6;
  return bytes;
};
const png = createPngHeader(1280, 720);

describe('Android display capture', () => {
  it('routes screencap through the SurfaceFlinger identity without numeric coercion', () => {
    const mapping: AndroidDisplayMapping = Object.freeze({
      primary: Object.freeze({
        logicalDisplayId: 0,
        surfaceFlingerDisplayId: '0',
        logicalSize: {width: 1920, height: 1080},
        surfaceSize: {width: 1920, height: 1080},
        rotation: 0,
      }),
      secondary: Object.freeze({
        logicalDisplayId: 2,
        surfaceFlingerDisplayId: '4294967298',
        logicalSize: {width: 1280, height: 720},
        surfaceSize: {width: 1280, height: 720},
        rotation: 0,
      }),
    });
    expect(buildAndroidCaptureArguments('emulator-5554', mapping, 'secondary')).toEqual([
      '-s',
      'emulator-5554',
      'exec-out',
      'screencap',
      '-d',
      '4294967298',
      '-p',
    ]);
  });

  it('rediscovers both display identity namespaces and validates binary PNG output', async () => {
    const runTextCommand = vi.fn(async (_adbPath: string, args: readonly string[]) =>
      args.includes('display') ? displays : surfaces,
    );
    const runBinaryCommand = vi.fn(async () => png);
    const capture = createAndroidDisplayCapture({
      adbPath: '/usr/bin/adb',
      serial: 'emulator-5554',
      shape: 'dual',
      runTextCommand,
      runBinaryCommand,
    });

    await expect(capture.capture('secondary')).resolves.toBe(png);
    expect(runTextCommand).toHaveBeenCalledTimes(2);
    expect(runBinaryCommand).toHaveBeenCalledExactlyOnceWith('/usr/bin/adb', [
      '-s',
      'emulator-5554',
      'exec-out',
      'screencap',
      '-d',
      '4294967298',
      '-p',
    ]);
  });

  it('rejects a non-PNG capture and a missing secondary display', async () => {
    const runTextCommand = vi.fn(async (_adbPath: string, args: readonly string[]) =>
      args.includes('display') ? displays.split('\n')[0] : surfaces.split('\n').slice(0, 4).join('\n'),
    );
    const runBinaryCommand = vi.fn(async () => Buffer.from('not-png'));
    const capture = createAndroidDisplayCapture({
      adbPath: '/usr/bin/adb',
      serial: 'emulator-5554',
      shape: 'mobile',
      runTextCommand,
      runBinaryCommand,
    });

    await expect(capture.capture('primary')).rejects.toThrow('TERMINAL_AUTOMATION_ANDROID_SCREENSHOT_NOT_PNG');
    await expect(capture.capture('secondary')).rejects.toThrow('TERMINAL_AUTOMATION_ANDROID_SURFACE_NOT_AVAILABLE');
    expect(runBinaryCommand).toHaveBeenCalledTimes(1);
  });

  it('rejects a PNG captured from the wrong display size', async () => {
    const runTextCommand = vi.fn(async (_adbPath: string, args: readonly string[]) =>
      args.includes('display') ? displays : surfaces,
    );
    const capture = createAndroidDisplayCapture({
      adbPath: '/usr/bin/adb',
      serial: 'emulator-5554',
      shape: 'dual',
      runTextCommand,
      runBinaryCommand: async () => createPngHeader(1920, 1080),
    });
    await expect(capture.capture('secondary')).rejects.toThrow(
      'TERMINAL_AUTOMATION_ANDROID_SCREENSHOT_DIMENSION_MISMATCH',
    );
  });
});
