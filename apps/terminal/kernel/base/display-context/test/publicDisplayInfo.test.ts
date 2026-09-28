import {describe, expect, it} from 'vitest';
import {readDisplayFacts, readDisplayInfo, resolveSecondarySurfaceAvailable} from '../src/index';
import {FakeDevicePort, succeeded, unavailable} from './testSupport';

describe('display info public seam', () => {
  it('reads the public tri-state result and applies the unknown-to-single fallback', async () => {
    const device = new FakeDevicePort();
    device.displayCount = 2;

    const valid = await readDisplayInfo(device);
    expect(valid).toEqual({status: 'valid', displayCount: 2});
    expect(resolveSecondarySurfaceAvailable(valid)).toBe(true);

    device.displayResults.push(unavailable('getDisplayInfo'));
    const unavailableResult = await readDisplayInfo(device);
    expect(unavailableResult.status).toBe('unavailable');
    expect(resolveSecondarySurfaceAvailable(unavailableResult)).toBe(false);

    device.displayResults.push(succeeded({displayCount: 0}));
    const malformed = await readDisplayInfo(device);
    expect(malformed.status).toBe('malformed');
    expect(resolveSecondarySurfaceAvailable(malformed)).toBe(false);
  });

  it('preserves real surface facts without copying non-current dimensions or status', async () => {
    const device = new FakeDevicePort();
    device.displayResults.push(
      succeeded({
        displayCount: 2,
        surfaces: [
          {
            displayId: 2,
            role: 'secondary',
            logicalSize: {width: 1024, height: 768},
            physicalSize: null,
            readiness: 'ready',
          },
          {
            displayId: 0,
            role: 'primary',
            logicalSize: {width: 1280, height: 800},
            physicalSize: {width: 1920, height: 1080},
            readiness: 'ready',
          },
        ],
      }),
    );

    const facts = await readDisplayFacts(device);

    expect(facts).toEqual({
      status: 'ready',
      physicalDisplayCount: 2,
      currentSurfaceKey: null,
      surfaces: [
        {
          surfaceKey: 'PRIMARY',
          displayIndex: 0,
          present: true,
          role: 'primary',
          logicalSize: {width: 1280, height: 800},
          physicalSize: {width: 1920, height: 1080},
          readiness: 'ready',
        },
        {
          surfaceKey: 'SECONDARY',
          displayIndex: 1,
          present: true,
          role: 'secondary',
          logicalSize: {width: 1024, height: 768},
          physicalSize: null,
          readiness: 'ready',
        },
      ],
      reasonCode: null,
    });
    expect(facts.surfaces[1]?.physicalSize).toBeNull();
    expect(facts.surfaces[1]?.readiness).toBe('ready');
  });

  it('fails closed when the adapter omits the surface collection or changes its count', async () => {
    const device = new FakeDevicePort();

    const notProvided = await readDisplayFacts(device);
    expect(notProvided).toEqual(
      expect.objectContaining({
        status: 'unavailable',
        physicalDisplayCount: 1,
        reasonCode: 'DISPLAY_FACTS_NOT_PROVIDED',
        surfaces: [],
      }),
    );

    device.displayResults.push(
      succeeded({
        displayCount: 2,
        surfaces: [
          {
            displayId: 0,
            role: 'primary',
            logicalSize: {width: 1280, height: 800},
            physicalSize: null,
            readiness: 'ready',
          },
        ],
      }),
    );
    const mismatched = await readDisplayFacts(device);
    expect(mismatched).toEqual(
      expect.objectContaining({
        status: 'malformed',
        physicalDisplayCount: 2,
        reasonCode: 'DISPLAY_FACTS_SURFACE_COUNT_UNSUPPORTED',
      }),
    );
  });
});
