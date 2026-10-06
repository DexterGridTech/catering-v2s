import {describe, expect, it} from 'vitest';
import {resolveDisplayMapping} from '../src/displayMapping.js';

const logicalDual = [
  'Display id 0: DisplayInfo{"Internal", real 2560 x 1600, uniqueId "primary", rotation 0, flags=FLAG_DEFAULT}',
  'Display id 2: DisplayInfo{"Presentation", real 1280 x 720, uniqueId "secondary", rotation 0, flags=FLAG_PRESENTATION}',
].join('\n');

const virtualSurfaceDual = [
  'Display 4619827259835644672 (HWC display 0, primary, "Internal")',
  'activeMode={id=1, resolution=2560x1600}',
  'Virtual Display 11529215047789101945',
  'name="Presentation"',
  'activeMode={id=2, resolution=1280x720}',
].join('\n');

const currentAndroidDualLogical = [
  'Display id 0: DisplayInfo{"Built-in Screen", real 1920 x 1080, uniqueId "local:4619827259835644672", rotation 0, flags=FLAG_SECURE, type INTERNAL}',
  'Display id 2: DisplayInfo{"Emulator 2D Display", real 1920 x 1080, uniqueId "virtual:com.android.emulator.multidisplay:1234562", rotation 0, flags=FLAG_PRESENTATION, type VIRTUAL}',
].join('\n');

const currentAndroidDumpsysLogical = [
  'Logical Displays: size=2',
  '  Display 0:',
  '    mDisplayId=0',
  '    mBaseDisplayInfo=DisplayInfo{"Built-in Screen", displayId 0, displayGroupId 0, FLAG_SECURE, FLAG_SUPPORTS_PROTECTED_BUFFERS, FLAG_TRUSTED, real 1920 x 1080, rotation 0, type INTERNAL, uniqueId "local:4619827259835644672"}',
  '    mOverrideDisplayInfo=DisplayInfo{"Built-in Screen", displayId 0, displayGroupId 0, FLAG_SECURE, real 1920 x 1080, rotation 0, type INTERNAL, uniqueId "local:4619827259835644672"}',
  '  Display 2:',
  '    mDisplayId=2',
  '    mBaseDisplayInfo=DisplayInfo{"Emulator 2D Display", displayId 2, displayGroupId 0, FLAG_PRESENTATION, FLAG_SHOULD_SHOW_SYSTEM_DECORATIONS, FLAG_TRUSTED, real 1920 x 1080, rotation 0, type VIRTUAL, uniqueId "virtual:com.android.emulator.multidisplay:1234562"}',
  '    mOverrideDisplayInfo=DisplayInfo{"Emulator 2D Display", displayId 2, displayGroupId 0, FLAG_PRESENTATION, real 1920 x 1080, rotation 0, type VIRTUAL, uniqueId "virtual:com.android.emulator.multidisplay:1234562"}',
  '  DeviceStateToLayoutMap:',
].join('\n');

const currentAndroidDualSurface = [
  'Display 4619827259835644672',
  '    connectionType=Internal',
  '    name="EMU_display_0"',
  '    activeMode={id=0, resolution=1920x1080}',
  'Virtual Display 11529215049470555743',
  '    name="Emulator 2D Display"',
].join('\n');

describe('resolveDisplayMapping', () => {
  it('keeps logical input ID separate from the SurfaceFlinger capture ID', () => {
    expect(resolveDisplayMapping('dual', logicalDual, virtualSurfaceDual)).toEqual({
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
    });
  });

  it('maps by display facts rather than SurfaceFlinger output order', () => {
    const reversed = [
      'Virtual Display 11529215047789101945',
      'name="Presentation"',
      'activeMode={id=2, resolution=1280x720}',
      'Display 4619827259835644672 (HWC display 0, primary, "Internal")',
      'activeMode={id=1, resolution=2560x1600}',
    ].join('\n');

    expect(resolveDisplayMapping('dual', logicalDual, reversed)).toEqual({
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
    });
  });

  it('uses Android default logical display ID and the logical dimensions when a virtual surface omits modes', () => {
    expect(resolveDisplayMapping('dual', currentAndroidDualLogical, currentAndroidDualSurface)).toMatchObject({
      primary: {
        logicalDisplayId: 0,
        surfaceFlingerDisplayId: '4619827259835644672',
      },
      secondary: {
        logicalDisplayId: 2,
        surfaceFlingerDisplayId: '11529215049470555743',
        logicalSize: {width: 1920, height: 1080},
        surfaceSize: {width: 1920, height: 1080},
      },
    });
  });

  it('parses Android Logical Displays blocks from current dumpsys output', () => {
    expect(resolveDisplayMapping('dual', currentAndroidDumpsysLogical, currentAndroidDualSurface)).toMatchObject({
      primary: {
        logicalDisplayId: 0,
        surfaceFlingerDisplayId: '4619827259835644672',
      },
      secondary: {
        logicalDisplayId: 2,
        surfaceFlingerDisplayId: '11529215049470555743',
      },
    });
  });

  it('resolves one physical external SurfaceFlinger display for a presentation logical display', () => {
    const physicalSurfaceDual = [
      'Display 0',
      '    connectionType=Internal',
      '    name="Primary display"',
      '    displayModes={id=0, resolution=2560x1600}',
      'Display 1',
      '    connectionType=External',
      '    name="Secondary display"',
      '    displayModes={id=0, resolution=1280x720}',
    ].join('\n');

    expect(resolveDisplayMapping('dual', logicalDual, physicalSurfaceDual)).toEqual({
      primary: {
        logicalDisplayId: 0,
        surfaceFlingerDisplayId: '0',
        logicalSize: {width: 2560, height: 1600},
        surfaceSize: {width: 2560, height: 1600},
        rotation: 0,
      },
      secondary: {
        logicalDisplayId: 2,
        surfaceFlingerDisplayId: '1',
        logicalSize: {width: 1280, height: 720},
        surfaceSize: {width: 1280, height: 720},
        rotation: 0,
      },
    });
  });

  it('rejects an ambiguous secondary instead of selecting by output order', () => {
    const ambiguousSurface = `${virtualSurfaceDual}\nVirtual Display 99999999999999999999\nname="Other"\nactiveMode={id=3, resolution=640x480}`;

    expect(() => resolveDisplayMapping('dual', logicalDual, ambiguousSurface)).toThrow(
      'TERMINAL_AUTOMATION_SECONDARY_DISPLAY_AMBIGUOUS',
    );
  });

  it('rejects an unclassified active display instead of silently ignoring it', () => {
    const unexpectedSurface = `${virtualSurfaceDual}\nDisplay 9000000000000000001\n  name="Unclassified"\n  displayModes={id=0, resolution=640x480}`;

    expect(() => resolveDisplayMapping('dual', logicalDual, unexpectedSurface)).toThrow(
      'TERMINAL_AUTOMATION_DUAL_SHAPE_MISMATCH',
    );
  });

  it('rejects duplicate logical IDs and missing primary identity', () => {
    expect(() =>
      resolveDisplayMapping('dual', `${logicalDual}\n${logicalDual.split('\n')[0]}`, virtualSurfaceDual),
    ).toThrow('TERMINAL_AUTOMATION_LOGICAL_DISPLAY_AMBIGUOUS');
    expect(() => resolveDisplayMapping('dual', logicalDual.split('\n')[1], virtualSurfaceDual)).toThrow(
      'TERMINAL_AUTOMATION_PRIMARY_DISPLAY_UNPROVEN',
    );
  });

  it('rejects extra display identities for a mobile runtime', () => {
    expect(() => resolveDisplayMapping('mobile', logicalDual, virtualSurfaceDual)).toThrow(
      'TERMINAL_AUTOMATION_MOBILE_SHAPE_MISMATCH',
    );
  });

  it('retains large SurfaceFlinger IDs as text and exposes per-display geometry and rotation', () => {
    const rotated = logicalDual.replace('uniqueId "secondary", rotation 0', 'uniqueId "secondary", rotation 1');
    const mapping = resolveDisplayMapping('dual', rotated, virtualSurfaceDual);
    expect(mapping.secondary).toMatchObject({
      logicalDisplayId: 2,
      surfaceFlingerDisplayId: '11529215047789101945',
      logicalSize: {width: 1280, height: 720},
      surfaceSize: {width: 1280, height: 720},
      rotation: 1,
    });
  });

  it('rejects missing geometry and a non-decimal SurfaceFlinger ID', () => {
    expect(() =>
      resolveDisplayMapping('dual', logicalDual, virtualSurfaceDual.replace('resolution=2560x1600', 'resolution=0x0')),
    ).toThrow('TERMINAL_AUTOMATION_SURFACE_DISPLAY_SIZE_MISSING');
    expect(() =>
      resolveDisplayMapping('dual', logicalDual, virtualSurfaceDual.replace('11529215047789101945', 'virtual-id')),
    ).toThrow('TERMINAL_AUTOMATION_SURFACE_DISPLAY_PARSE_FAILED');
  });
});
