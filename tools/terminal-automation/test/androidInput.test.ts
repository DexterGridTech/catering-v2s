import {describe, expect, it, vi} from 'vitest';
import {buildAndroidTapArguments, createAndroidInput, summarizeAndroidDisplayInputs} from '../src/androidInput.js';
import type {AndroidDisplayMapping} from '../src/displayMapping.js';
import {createClickPacer} from '../src/clickPacer.js';

const mapping: AndroidDisplayMapping = {
  primary: {
    logicalDisplayId: 0,
    surfaceFlingerDisplayId: '4619827259835644672',
    logicalSize: {width: 2560, height: 1600},
    surfaceSize: {width: 2560, height: 1600},
    rotation: 0,
  },
  secondary: {
    logicalDisplayId: 2,
    surfaceFlingerDisplayId: '11529215047789101945',
    logicalSize: {width: 1280, height: 720},
    surfaceSize: {width: 1280, height: 720},
    rotation: 0,
  },
};

describe('buildAndroidTapArguments', () => {
  it('uses the logical ID for input rather than the SurfaceFlinger capture ID', () => {
    expect(buildAndroidTapArguments('emulator-5554', mapping, 'secondary', 420, 318)).toEqual([
      '-s',
      'emulator-5554',
      'shell',
      'input',
      '-d',
      '2',
      'tap',
      '420',
      '318',
    ]);
  });

  it('rejects non-integer coordinates and malformed serials before command creation', () => {
    expect(() => buildAndroidTapArguments('emulator-5554', mapping, 'primary', 2.5, 1)).toThrow(
      'TERMINAL_AUTOMATION_ANDROID_COORDINATE_INVALID',
    );
    expect(() => buildAndroidTapArguments('serial;rm', mapping, 'primary', 2, 1)).toThrow(
      'TERMINAL_AUTOMATION_ANDROID_SERIAL_INVALID',
    );
  });

  it('does not issue a secondary tap for a single-display shape', () => {
    const mobile: AndroidDisplayMapping = {primary: mapping.primary, secondary: null};
    expect(() => buildAndroidTapArguments('emulator-5554', mobile, 'secondary', 2, 1)).toThrow(
      'TERMINAL_AUTOMATION_ANDROID_SURFACE_NOT_AVAILABLE',
    );
  });
});

describe('createAndroidInput', () => {
  it('rediscovers the actual IDs before each tap and sends the logical ID to input', async () => {
    const calls: string[][] = [];
    const onClickCadence = vi.fn();
    const logical = [
      'Display id 0: DisplayInfo{"Internal", real 2560 x 1600, uniqueId "primary", rotation 0, flags=FLAG_DEFAULT}',
      'Display id 2: DisplayInfo{"Presentation", real 1280 x 720, uniqueId "secondary", rotation 0, flags=FLAG_PRESENTATION}',
    ].join('\n');
    const surfaceFlinger = [
      'Display 4619827259835644672 (HWC display 0, primary, "Internal")',
      'activeMode={id=1, resolution=2560x1600}',
      'Virtual Display 11529215047789101945',
      'name="Presentation"',
      'activeMode={id=2, resolution=1280x720}',
    ].join('\n');
    const input = createAndroidInput({
      adbPath: '/android/sdk/platform-tools/adb',
      serial: 'emulator-5554',
      shape: 'dual',
      onClickCadence,
      runCommand: async (_adbPath, args) => {
        calls.push([...args]);
        if (args.at(-1) === 'display') return logical;
        if (args.includes('--displays')) return surfaceFlinger;
        return '';
      },
    });

    const mapping = await input.discoverDisplays();
    await input.tap('secondary', 420, 318);
    expect(onClickCadence).toHaveBeenCalledExactlyOnceWith(expect.any(Number));

    expect(mapping.secondary).toEqual({
      logicalDisplayId: 2,
      surfaceFlingerDisplayId: '11529215047789101945',
      logicalSize: {width: 1280, height: 720},
      surfaceSize: {width: 1280, height: 720},
      rotation: 0,
    });
    expect(calls).toEqual([
      ['-s', 'emulator-5554', 'shell', 'dumpsys', 'display'],
      ['-s', 'emulator-5554', 'shell', 'dumpsys', 'SurfaceFlinger', '--displays'],
      ['-s', 'emulator-5554', 'shell', 'dumpsys', 'display'],
      ['-s', 'emulator-5554', 'shell', 'dumpsys', 'SurfaceFlinger', '--displays'],
      ['-s', 'emulator-5554', 'shell', 'input', '-d', '2', 'tap', '420', '318'],
    ]);
    expect(JSON.stringify(calls.at(-1))).not.toContain('11529215047789101945');
  });

  it('maps a registered surface-local bound through that display window and density before tapping', async () => {
    const calls: string[][] = [];
    const onClickCadence = vi.fn();
    const logical = [
      'Display id 0: DisplayInfo{"Internal", real 2560 x 1600, uniqueId "primary", rotation 0, flags=FLAG_DEFAULT}',
      'Display id 2: DisplayInfo{"Presentation", real 1280 x 720, uniqueId "secondary", rotation 0, flags=FLAG_PRESENTATION}',
    ].join('\n');
    const surfaceFlinger = [
      'Display 4619827259835644672 (HWC display 0, primary, "Internal")',
      'activeMode={id=1, resolution=2560x1600}',
      'Virtual Display 11529215047789101945',
      'name="Presentation"',
      'activeMode={id=2, resolution=1280x720}',
    ].join('\n');
    const host =
      'I/TerminalDualScreen( 456): event=secondary-presentation-window-post-layout displayIndex=1 displayId=2 ' +
      'leftPx=12 topPx=24 widthPx=1280 heightPx=720 density=1.33125';
    const surfaceSnapshot =
      'I/TerminalDualScreen( 456): event=surface-host-snapshot-ready surfaceKey=SECONDARY generation=1 displayId=2 ' +
      'windowIdentity=secondary currentWidthPx=1280 currentHeightPx=720 surfaceDensity=2.0';
    const input = createAndroidInput({
      adbPath: '/android/sdk/platform-tools/adb',
      serial: 'emulator-5554',
      shape: 'dual',
      onClickCadence,
      runCommand: async (_adbPath, args) => {
        calls.push([...args]);
        if (args.at(-1) === 'display') return logical;
        if (args.includes('--displays')) return surfaceFlinger;
        if (args.includes('logcat')) return `${host}\n${surfaceSnapshot}`;
        return '';
      },
    });

    await input.tapBounds('secondary', {x: 10, y: 20, width: 100, height: 50});
    expect(onClickCadence).toHaveBeenCalledExactlyOnceWith(expect.any(Number));

    expect(calls.at(-1)).toEqual(['-s', 'emulator-5554', 'shell', 'input', '-d', '2', 'tap', '132', '114']);
    expect(calls.some(call => call.includes('11529215047789101945'))).toBe(false);
  });

  it('discovers the current display after waiting for the shared click interval', async () => {
    let releaseFirstClick!: () => void;
    let firstClickStarted!: () => void;
    const firstStarted = new Promise<void>(resolve => (firstClickStarted = resolve));
    const firstClickGate = new Promise<void>(resolve => (releaseFirstClick = resolve));
    const clickPacer = createClickPacer(1);
    const firstClick = clickPacer.run(async markClickStarted => {
      markClickStarted();
      firstClickStarted();
      await firstClickGate;
    });
    await firstStarted;

    const calls: string[][] = [];
    let displayAvailable = false;
    const input = createAndroidInput({
      adbPath: '/android/sdk/platform-tools/adb',
      serial: 'emulator-5554',
      shape: 'mobile',
      clickPacer,
      runCommand: async (_adbPath, args) => {
        calls.push([...args]);
        if (args.at(-1) === 'display') {
          return displayAvailable
            ? 'Display id 0: DisplayInfo{"Internal", real 2560 x 1600, uniqueId "primary", rotation 0, flags=FLAG_DEFAULT}'
            : '';
        }
        if (args.includes('--displays')) {
          return 'Display 4619827259835644672 (HWC display 0, primary, "Internal")\nactiveMode={id=1, resolution=2560x1600}';
        }
        return '';
      },
    });

    const tapping = input.tap('primary', 30, 40);
    expect(calls).toHaveLength(0);
    displayAvailable = true;
    releaseFirstClick();
    await tapping;
    await firstClick;

    expect(calls.at(-1)).toEqual(['-s', 'emulator-5554', 'shell', 'input', '-d', '0', 'tap', '30', '40']);
  });
});

describe('summarizeAndroidDisplayInputs', () => {
  it('reports sanitized logical roles and surface geometry for display-shape failures', () => {
    const logical = [
      'Logical Displays: size=4',
      '  Display 0:',
      '    mBaseDisplayInfo=DisplayInfo{"Built-in", displayId 0, FLAG_DEFAULT, real 1920 x 1080, rotation 0, type INTERNAL, uniqueId "private-local-id"}',
      '  Display 1:',
      '    mBaseDisplayInfo=DisplayInfo{"Secure", displayId 1, FLAG_SECURE, real 1920 x 1080, rotation 0, type VIRTUAL, uniqueId "private-secure-id"}',
      '  Display 2:',
      '    mBaseDisplayInfo=DisplayInfo{"Private", displayId 2, FLAG_PRIVATE, real 1920 x 1080, rotation 0, type VIRTUAL, uniqueId "private-display-id"}',
      '  Display 3:',
      '    mBaseDisplayInfo=DisplayInfo{"Presentation", displayId 3, FLAG_PRESENTATION, real 1920 x 1080, rotation 0, type EXTERNAL, uniqueId "private-presentation-id"}',
    ].join('\n');
    const surfaces = [
      'Display 0',
      '  connectionType=Internal',
      '  name="Built-in"',
      '  activeMode={id=0, resolution=1920x1080}',
      'Display 1',
      '  connectionType=External',
      '  name="External"',
    ].join('\n');

    const summary = summarizeAndroidDisplayInputs(logical, surfaces);

    expect(summary).toContain(
      'logicalCount=4 logical=[0:DEFAULT:internal:1920x1080,1:SECURE:virtual:1920x1080,2:PRIVATE:virtual:1920x1080,3:PRESENTATION:external:1920x1080]',
    );
    expect(summary).toContain('surfaceCount=2 surface=[0:internal:1920x1080,1:external:geometry-unparsed]');
    expect(summary).not.toContain('private-');
    expect(summary).not.toContain('Built-in');
  });
});
