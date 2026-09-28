import {describe, expect, it} from 'vitest';
import {getSurfaceDeclarations, readTerminalSurfaces, surfaceFormForOrientation, terminalSurfaces} from '../src';

describe('sample-console terminal surface adapter', () => {
  it('exposes the package defaults without duplicating the shared parser matrix', () => {
    expect(terminalSurfaces).toEqual({
      orientations: {
        landscape: {
          PRIMARY: {width: 1280, height: 720},
          SECONDARY: {width: 1280, height: 720},
        },
        portrait: {PRIMARY: {width: 360, height: 640}},
      },
    });
    expect(getSurfaceDeclarations(terminalSurfaces, 'laptop')).toBe(terminalSurfaces.orientations.landscape);
    expect(getSurfaceDeclarations(terminalSurfaces, 'mobile')).toBe(terminalSurfaces.orientations.portrait);
    expect(surfaceFormForOrientation('landscape')).toBe('laptop');
    expect(surfaceFormForOrientation('portrait')).toBe('mobile');
  });

  it('retains the sample-console error prefix at the package adapter boundary', () => {
    expect(() => readTerminalSurfaces({orientations: {}})).toThrow(
      /\[sample-console\].*landscape surfaces are required/,
    );
  });
});
