import {createRemoteControlUuid} from './remoteControlIdentity';

export const remoteControlKeepaliveIntervalMs = 5_000;
export const remoteControlKeepaliveTimeoutMs = 15_000;

export type RemoteControlKeepaliveFailure = 'ACK_TIMEOUT' | 'SEND_FAILED';

export type RemoteControlKeepalive = Readonly<{
  acknowledge: (participantIdentity: string, probeId: string) => boolean;
  stop: () => void;
}>;

export function startRemoteControlKeepalive(input: Readonly<{
  endpointIdentities: readonly string[];
  sendProbe: (probeId: string) => void | Promise<void>;
  onFailure: (failure: RemoteControlKeepaliveFailure, missingEndpointCount: number) => void;
  now?: () => number;
}>): RemoteControlKeepalive {
  const now = input.now ?? Date.now;
  const endpointIdentities = [...new Set(input.endpointIdentities)];
  const lastAcknowledgedAt = new Map(endpointIdentities.map(identity => [identity, now()]));
  const recentProbeIds: string[] = [];
  let active = true;
  let timer: ReturnType<typeof setInterval> | undefined;

  const stop = () => {
    if (!active) return;
    active = false;
    if (timer !== undefined) clearInterval(timer);
    timer = undefined;
    recentProbeIds.length = 0;
  };
  const fail = (failure: RemoteControlKeepaliveFailure, missingEndpointCount: number) => {
    if (!active) return;
    stop();
    input.onFailure(failure, missingEndpointCount);
  };
  const send = () => {
    if (!active) return;
    const probeId = createRemoteControlUuid();
    recentProbeIds.push(probeId);
    if (recentProbeIds.length > 2) recentProbeIds.shift();
    try {
      void Promise.resolve(input.sendProbe(probeId)).catch(() => fail('SEND_FAILED', endpointIdentities.length));
    } catch {
      fail('SEND_FAILED', endpointIdentities.length);
    }
  };
  const tick = () => {
    if (!active) return;
    const currentTime = now();
    const missingEndpointCount = endpointIdentities.filter(identity =>
      currentTime - (lastAcknowledgedAt.get(identity) ?? currentTime) >= remoteControlKeepaliveTimeoutMs,
    ).length;
    if (missingEndpointCount > 0) {
      fail('ACK_TIMEOUT', missingEndpointCount);
      return;
    }
    send();
  };
  const hasExpiredAckWindow = () => endpointIdentities.some(identity =>
    now() - (lastAcknowledgedAt.get(identity) ?? now()) >= remoteControlKeepaliveTimeoutMs,
  );
  const acknowledge = (participantIdentity: string, probeId: string): boolean => {
    if (!active || !lastAcknowledgedAt.has(participantIdentity) || !recentProbeIds.includes(probeId)) return false;
    if (hasExpiredAckWindow()) {
      const missingEndpointCount = endpointIdentities.filter(identity =>
        now() - (lastAcknowledgedAt.get(identity) ?? now()) >= remoteControlKeepaliveTimeoutMs,
      ).length;
      fail('ACK_TIMEOUT', missingEndpointCount);
      return false;
    }
    lastAcknowledgedAt.set(participantIdentity, now());
    return true;
  };

  timer = setInterval(tick, remoteControlKeepaliveIntervalMs);
  send();
  return Object.freeze({acknowledge, stop});
}
