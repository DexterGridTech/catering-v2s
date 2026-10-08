import {describe, expect, it} from 'vitest';
import {projectAndroidTransportFailureLog} from '../src/androidAppDiagnostics.js';

describe('Android transport failure diagnostics', () => {
  it('retains safe error and cause codes while omitting arbitrary message and URL data', () => {
    const line = `W/ReactNativeJS (123): ${JSON.stringify({
      category: 'transport.connection',
      event: 'transport.connection.connect-candidate-failed',
      level: 'warn',
      data: {
        addressName: 'haproxy-entry-one',
        revision: 4,
        connectionToken: 8,
        errorName: 'Error',
        errorCode: 'ECONNREFUSED',
        causeName: 'Error',
        causeCode: 'EHOSTUNREACH',
        message: 'https://user:secret@example.invalid/private',
      },
    })}`;

    const projected = projectAndroidTransportFailureLog(line);

    expect(projected).toMatchObject({
      event: 'transport.connection.connect-candidate-failed',
      addressName: 'haproxy-entry-one',
      configRevision: '4',
      connectionToken: 8,
      transportErrorName: 'Error',
      transportErrorCode: 'ECONNREFUSED',
      transportCauseName: 'Error',
      transportCauseCode: 'EHOSTUNREACH',
    });
    expect(JSON.stringify(projected)).not.toContain('secret');
    expect(JSON.stringify(projected)).not.toContain('example.invalid');
  });
});
