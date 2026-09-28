import {render, type RenderResult} from '@testing-library/react-native';
import {afterEach, describe, expect, it, vi} from 'vitest';
import * as renderHooks from '@catering-v2s/ui-base-render';
import {DisplayContextSectionLaptop} from '../src/components/sections/DisplayContextSectionLaptop';
import type {AdminSectionProps} from '../src/types/adminSection';
import {adminTestIds} from '../src/foundations/adminTestIds';

const context = {
  catalogEntry: {title: '运行状态'},
  runtimeFacts: {
    environmentMode: 'development',
    debugMode: {enabled: false, source: 'default'},
    deviceIdentity: {available: false, deviceId: null},
    platformPortCapabilities: [],
  },
  surface: {surfaceForm: 'laptop', displayMode: 'PRIMARY', hostLogicalSize: null},
  commandBoundary: {},
} as unknown as AdminSectionProps['context'];

const renderSection = async (status: 'created' | 'started'): Promise<RenderResult> => {
  vi.spyOn(renderHooks, 'useRenderStatus').mockReturnValue(status);
  vi.spyOn(renderHooks, 'useUiStateSelector').mockReturnValue(undefined);
  return render(<DisplayContextSectionLaptop context={context} />);
};

afterEach(() => vi.restoreAllMocks());

describe('DisplayContextSection lifecycle boundary', () => {
  it('uses runtime status for lifecycle unavailability', async () => {
    const renderer = await renderSection('created');

    expect(renderer.getByTestId(adminTestIds.runtime.overallStatus)).toBeDefined();
    expect(renderer.getByTestId(adminTestIds.runtime.displayFactsError)).toBeDefined();
    await renderer.unmount();
  });

  it('keeps missing display data distinct from runtime unavailability after start', async () => {
    const renderer = await renderSection('started');

    expect(renderer.getByTestId(adminTestIds.runtime.overallStatus)).toBeDefined();
    expect(renderer.getAllByTestId(adminTestIds.runtime.displayFactsError).length).toBeGreaterThan(0);
    await renderer.unmount();
  });
});
