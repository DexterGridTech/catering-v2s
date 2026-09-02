import type {PlatformPortName, PortUnavailable} from '../types/result';

export const createUnavailable = (
  port: PlatformPortName,
  capability: string,
): PortUnavailable => ({
  status: 'unavailable',
  port,
  capability,
  reason: 'ADAPTER_NOT_INJECTED',
  message: `${port}.${capability}: adapter not injected`,
});
