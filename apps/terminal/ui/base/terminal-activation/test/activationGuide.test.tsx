import {render} from '@testing-library/react-native';
import {afterEach, describe, expect, it, vi} from 'vitest';
import * as renderHooks from '@catering-v2s/ui-base-render';
import {ActivationGuide} from '../src/components/ActivationGuide';

afterEach(() => vi.restoreAllMocks());

describe('ActivationGuide', () => {
  it('keeps the guide message while current-host activation is unknown', async () => {
    vi.spyOn(renderHooks, 'useUiStateSelector').mockReturnValue(null);
    const renderer = await render(<ActivationGuide message="请先在主机上完成设备激活" />);

    expect(renderer.getByText('请先在主机上完成设备激活')).toBeDefined();
    expect(renderer.queryByText('设备已激活成功')).toBeNull();
    await renderer.unmount();
  });

  it('shows success only for an active current-host projection', async () => {
    vi.spyOn(renderHooks, 'useUiStateSelector').mockReturnValue({
      activation: {
        status: 'active',
        terminalRef: 'terminal-1',
        storeRef: 'store-1',
        groupWorkspaceKey: 'workspace-1',
        bindingGeneration: 3,
      },
      connection: {status: 'stopped', addressName: null, nodeId: null, lastCloseReason: null},
      lastRttMs: null,
      currentPeerValue: true,
    });
    const renderer = await render(<ActivationGuide message="请先在主机上完成设备激活" />);

    expect(renderer.getByText('设备已激活成功')).toBeDefined();
    expect(renderer.queryByText('请先在主机上完成设备激活')).toBeNull();
    expect(renderer.queryByText('继续')).toBeNull();
    await renderer.unmount();
  });
});
