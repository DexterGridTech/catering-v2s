import type {AutomationDriverServer} from './server.js';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Reads the device identity supplied by the app's production DevicePort. */
export const readApplicationDeviceId = async (server: AutomationDriverServer, sessionId: string): Promise<string> => {
  const response = await server.request(sessionId, 'runtime.info', null);
  if (response.type === 'error') {
    const code = isRecord(response.body) && typeof response.body.code === 'string' ? response.body.code : 'UNKNOWN';
    throw new Error(`TERMINAL_AUTOMATION_RUNTIME_INFO_FAILED:${code}`);
  }
  if (response.type !== 'response' || !isRecord(response.body) || !isRecord(response.body.result)) {
    throw new Error('TERMINAL_AUTOMATION_RUNTIME_INFO_INVALID');
  }
  const identity = response.body.result.deviceIdentity;
  if (
    !isRecord(identity) ||
    identity.available !== true ||
    typeof identity.deviceId !== 'string' ||
    !/^[A-Za-z0-9:._-]{1,128}$/u.test(identity.deviceId)
  ) {
    throw new Error('TERMINAL_AUTOMATION_APPLICATION_DEVICE_ID_UNAVAILABLE');
  }
  return identity.deviceId;
};
