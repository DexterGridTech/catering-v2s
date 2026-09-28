import {createElement} from 'react';
import {render} from '@testing-library/react-native';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {createRendererCatalog, type RenderRuntimeFacts, type SurfaceContextValue} from '@catering-v2s/ui-base-render';
import type {AdminSectionBindingInput} from '../src/hooks/useAdminSectionBinding';

const {info, logger} = vi.hoisted(() => {
  const info = vi.fn();
  return {info, logger: {info}};
});

vi.mock('@catering-v2s/ui-base-render', async importOriginal => {
  const actual = await importOriginal<typeof import('@catering-v2s/ui-base-render')>();
  return {
    ...actual,
    useRenderContext: () => ({logger}),
  };
});

import {useAdminSectionBinding} from '../src/hooks/useAdminSectionBinding';

const input: AdminSectionBindingInput = {
  selectedSection: undefined,
  rendererCatalog: createRendererCatalog([]),
  runtimeFacts: {} as RenderRuntimeFacts,
  surface: {displayMode: 'PRIMARY'} as SurfaceContextValue,
  surfaceForm: 'laptop',
};

const Probe = ({revision}: Readonly<{readonly revision: number}>) => {
  useAdminSectionBinding(input);
  return createElement('admin-binding-probe', {revision});
};

describe('useAdminSectionBinding render purity', () => {
  beforeEach(() => info.mockClear());

  it('does not log section binding on unrelated renders', async () => {
    const renderer = await render(createElement(Probe, {revision: 0}));
    expect(info).toHaveBeenCalledTimes(1);
    expect(info.mock.calls[0]?.[0]).toMatchObject({event: 'admin.section-content-rendered'});

    await renderer.rerender(createElement(Probe, {revision: 1}));
    expect(info).toHaveBeenCalledTimes(1);
    await renderer.unmount();
  });
});
