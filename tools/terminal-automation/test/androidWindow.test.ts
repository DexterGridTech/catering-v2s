import {describe, expect, it} from 'vitest';
import {androidTapPoint, mapAndroidLogicalBoundsToPhysical, resolveSurfaceWindow} from '../src/androidWindow.js';
import type {AndroidDisplayTarget} from '../src/displayMapping.js';

const target: AndroidDisplayTarget = {
  logicalDisplayId: 2,
  surfaceFlingerDisplayId: '11529215047789101945',
  logicalSize: {width: 1280, height: 720},
  surfaceSize: {width: 1280, height: 720},
  rotation: 0,
};

const host =
  'I/TerminalDualScreen(  456): event=secondary-presentation-window-post-create displayIndex=1 displayId=2 ' +
  'leftPx=17 topPx=31 widthPx=1280 heightPx=720 densityDpi=213 density=1.33125 logicalWidth=961 logicalHeight=540';
const snapshot =
  'I/TerminalDualScreen( 456): event=surface-host-snapshot-ready surfaceKey=SECONDARY generation=1 displayId=2 ' +
  'windowIdentity=secondary currentWidthPx=1280 currentHeightPx=720 surfaceDensityDpi=320 surfaceDensity=2.0';

describe('Android surface window coordinates', () => {
  it('uses the newest window snapshot for the selected logical display', () => {
    const older = host.replace('leftPx=17', 'leftPx=3');
    expect(resolveSurfaceWindow(`${older}\n${host}\n${snapshot}`, 'secondary', target)).toEqual({
      displayIndex: 1,
      displayId: 2,
      leftPx: 17,
      topPx: 31,
      widthPx: 1280,
      heightPx: 720,
      surfaceDensity: 2,
    });
  });

  it('rejects a window from a different display identity instead of using it as a fallback', () => {
    expect(() =>
      resolveSurfaceWindow(`${host.replace('displayId=2', 'displayId=0')}\n${snapshot}`, 'secondary', target),
    ).toThrow('TERMINAL_AUTOMATION_SURFACE_WINDOW_FACTS_INVALID');
    expect(() => resolveSurfaceWindow(host, 'secondary', target)).toThrow(
      'TERMINAL_AUTOMATION_SURFACE_HOST_SNAPSHOT_NOT_READY',
    );
    expect(() => resolveSurfaceWindow(snapshot, 'secondary', target)).toThrow(
      'TERMINAL_AUTOMATION_SURFACE_WINDOW_NOT_OBSERVED',
    );
  });

  it('applies the selected surface density once and keeps the tap point inside the native viewport', () => {
    const window = resolveSurfaceWindow(`${host}\n${snapshot}`, 'secondary', target);
    const physical = mapAndroidLogicalBoundsToPhysical({x: 10.5, y: 20, width: 100, height: 50}, window);
    expect(physical).toEqual({x: 38, y: 71, width: 200, height: 100});
    expect(androidTapPoint(physical, window)).toEqual({x: 138, y: 121});
  });

  it('rejects a tap target too small for the configured inward margin', () => {
    const window = resolveSurfaceWindow(`${host}\n${snapshot}`, 'secondary', target);
    const physical = mapAndroidLogicalBoundsToPhysical({x: 1, y: 1, width: 4, height: 4}, window);
    expect(() => androidTapPoint(physical, window)).toThrow('TERMINAL_AUTOMATION_ANDROID_TAP_TARGET_TOO_SMALL');
  });

  it('places calibration points at the requested inward fractions and rejects invalid fractions', () => {
    const window = resolveSurfaceWindow(`${host}\n${snapshot}`, 'secondary', target);
    const physical = mapAndroidLogicalBoundsToPhysical({x: 10, y: 20, width: 100, height: 50}, window);
    expect(androidTapPoint(physical, window, {x: 0, y: 0})).toEqual({x: 42, y: 76});
    expect(androidTapPoint(physical, window, {x: 1, y: 1})).toEqual({x: 232, y: 166});
    expect(() => androidTapPoint(physical, window, {x: 1.1, y: 0.5})).toThrow(
      'TERMINAL_AUTOMATION_ANDROID_TAP_POSITION_INVALID',
    );
  });
});
