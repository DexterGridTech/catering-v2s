import type {DevicePort} from '@catering-v2s/kernel-base-platform-ports';
import type {TransportNetworkStatusBridge, TransportNetworkStatusDispatch} from '../types/runtimeControl';

/** Bridges optional device network observations into transport-owner commands only. */
export const createTransportNetworkStatusBridge = async (input: Readonly<{
  readonly device: DevicePort;
  readonly dispatchTransition: TransportNetworkStatusDispatch;
  readonly timeoutMs: number;
  readonly onObservationError?: (source: 'subscribe' | 'dispatch', code: string) => void;
}>): Promise<TransportNetworkStatusBridge> => {
  const initial = await input.device.getNetworkStatus({timeoutMs: input.timeoutMs});

  let disposed = false;
  let seeded = initial.status === 'succeeded';
  let lastConnected = initial.status === 'succeeded' ? initial.value.connected : undefined;
  let subscriptionId: string | undefined;
  let unsubscribePromise: Promise<void> | undefined;

  const subscription = await input.device.subscribeNetworkStatus({
    timeoutMs: input.timeoutMs,
    listener: event => {
      if (disposed) return;
      if (!seeded) {
        lastConnected = event.status.connected;
        seeded = true;
        return;
      }
      if (lastConnected === event.status.connected) return;
      lastConnected = event.status.connected;
      void input.dispatchTransition({connected: event.status.connected, observedAt: event.observedAt})
        .catch(() => input.onObservationError?.('dispatch', 'TRANSPORT_NETWORK_COMMAND_FAILED'));
    },
    onError: error => input.onObservationError?.('subscribe', error.code),
  });
  if (subscription.status !== 'succeeded') {
    return Object.freeze({installed: false, dispose: async () => undefined});
  }
  subscriptionId = subscription.value.subscriptionId;

  return Object.freeze({
    installed: true,
    dispose: (): Promise<void> => {
      disposed = true;
      const id = subscriptionId;
      if (id === undefined) return Promise.resolve();
      if (unsubscribePromise !== undefined) return unsubscribePromise;
      const current = (async (): Promise<void> => {
        const result = await input.device.unsubscribeNetworkStatus({subscriptionId: id, timeoutMs: input.timeoutMs});
        if (result.status !== 'succeeded') throw new Error('TRANSPORT_NETWORK_STATUS_UNSUBSCRIBE_FAILED');
        if (subscriptionId === id) subscriptionId = undefined;
      })();
      unsubscribePromise = current;
      void current.then(
        () => {
          if (unsubscribePromise === current) unsubscribePromise = undefined;
        },
        () => {
          if (unsubscribePromise === current) unsubscribePromise = undefined;
        },
      );
      return current;
    },
  });
};
