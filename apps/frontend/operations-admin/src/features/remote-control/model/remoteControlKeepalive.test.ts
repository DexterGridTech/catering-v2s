import {afterEach, describe, expect, it, vi} from 'vitest';
import {
  remoteControlKeepaliveIntervalMs,
  remoteControlKeepaliveTimeoutMs,
  startRemoteControlKeepalive,
} from './remoteControlKeepalive';

describe('remote-control controller keepalive', () => {
  afterEach(() => vi.useRealTimers());

  it('sends immediately and every five seconds, accepting only recent probes from required endpoints', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const sendProbe = vi.fn();
    const onFailure = vi.fn();
    const keepalive = startRemoteControlKeepalive({
      endpointIdentities: ['master-endpoint', 'slave-endpoint'],
      sendProbe,
      onFailure,
    });

    expect(sendProbe).toHaveBeenCalledTimes(1);
    expect(keepalive.hasAcknowledgedAllEndpoints()).toBe(false);
    const firstProbe = sendProbe.mock.calls[0]?.[0] as string;
    expect(keepalive.acknowledge('unlisted-endpoint', firstProbe)).toBe(false);
    expect(keepalive.acknowledge('master-endpoint', '00000000-0000-4000-8000-000000000099')).toBe(false);
    expect(keepalive.acknowledge('master-endpoint', firstProbe)).toBe(true);
    expect(keepalive.hasAcknowledgedAllEndpoints()).toBe(false);
    expect(keepalive.acknowledge('slave-endpoint', firstProbe)).toBe(true);
    expect(keepalive.hasAcknowledgedAllEndpoints()).toBe(true);

    await vi.advanceTimersByTimeAsync(remoteControlKeepaliveIntervalMs);
    expect(sendProbe).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(remoteControlKeepaliveIntervalMs);
    expect(sendProbe).toHaveBeenCalledTimes(3);
    const thirdProbe = sendProbe.mock.calls[2]?.[0] as string;
    expect(keepalive.acknowledge('master-endpoint', firstProbe)).toBe(false);
    expect(keepalive.acknowledge('master-endpoint', thirdProbe)).toBe(true);
    expect(onFailure).not.toHaveBeenCalled();

    keepalive.stop();
    expect(keepalive.hasAcknowledgedAllEndpoints()).toBe(false);
    await vi.advanceTimersByTimeAsync(remoteControlKeepaliveIntervalMs * 2);
    expect(sendProbe).toHaveBeenCalledTimes(3);
  });

  it('ends when one required endpoint has no matched acknowledgement for fifteen seconds', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const sendProbe = vi.fn();
    const onFailure = vi.fn();
    const keepalive = startRemoteControlKeepalive({
      endpointIdentities: ['master-endpoint', 'slave-endpoint'],
      sendProbe,
      onFailure,
    });
    await vi.advanceTimersByTimeAsync(remoteControlKeepaliveIntervalMs * 2);
    const latestProbe = sendProbe.mock.calls[2]?.[0] as string;
    expect(keepalive.acknowledge('master-endpoint', latestProbe)).toBe(true);
    expect(keepalive.hasAcknowledgedAllEndpoints()).toBe(false);

    await vi.advanceTimersByTimeAsync(remoteControlKeepaliveIntervalMs);
    expect(sendProbe).toHaveBeenCalledTimes(3);
    expect(onFailure).toHaveBeenCalledWith('ACK_TIMEOUT', 1);
  });

  it('does not let a late acknowledgement revive a timed-out session', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const sendProbe = vi.fn();
    const onFailure = vi.fn();
    const keepalive = startRemoteControlKeepalive({
      endpointIdentities: ['master-endpoint'],
      sendProbe,
      onFailure,
    });
    const probe = sendProbe.mock.calls[0]?.[0] as string;

    await vi.advanceTimersByTimeAsync(remoteControlKeepaliveTimeoutMs);
    expect(keepalive.acknowledge('master-endpoint', probe)).toBe(false);
    expect(onFailure).toHaveBeenCalledTimes(1);
  });
});
