import {describe, expect, it} from 'vitest';
import {
  isForwardedExpoWebConsoleLine,
  projectTerminalRuntimeRemoteControlLog,
  safeTerminalBrowserPolicyFailure,
  safeBrowserConsoleNetworkFailureReason,
  safeBrowserRequestFailureReason,
} from '../src/browserNetworkDiagnostics.js';

describe('browser network diagnostics', () => {
  it('suppresses raw Expo Web console lines while preserving Metro build output', () => {
    const rawConsole = 'Web  INFO  {"event":"remote-control.session-registration-rejected","token":"private-token","body":"private-body"}';
    expect(isForwardedExpoWebConsoleLine(rawConsole)).toBe(true);
    expect(isForwardedExpoWebConsoleLine('Web Bundled 1320ms node_modules/expo/AppEntry.js'))
      .toBe(false);
    expect(isForwardedExpoWebConsoleLine('Web  ERROR Error: private exception text')).toBe(true);
  });

  it('keeps only the browser network error code and drops the raw message', () => {
    expect(safeBrowserRequestFailureReason('net::ERR_CONNECTION_RESET')).toBe('ERR_CONNECTION_RESET');
    expect(safeBrowserRequestFailureReason('net::ERR_FAILED https://host.invalid/?token=private')).toBe('ERR_FAILED');
    expect(safeBrowserRequestFailureReason('unclassified sensitive text')).toBe('UNKNOWN');
    expect(safeBrowserRequestFailureReason(undefined)).toBe('UNKNOWN');
  });

  it('classifies a CORS console failure without retaining URLs or origins', () => {
    const message =
      "Access to fetch at 'http://host.invalid/api/terminal/group-workspaces/private/remote-control-sessions/id/registration' from origin 'http://localhost:19006' has been blocked by CORS policy";
    expect(safeBrowserConsoleNetworkFailureReason(message)).toBe('CORS_BLOCKED');
    expect(safeBrowserConsoleNetworkFailureReason('Failed to execute unrelated script')).toBeUndefined();
  });

  it('identifies CORS failures on both terminal remote-control POST paths without retaining request data', () => {
    const consoleMessage =
      "Access to fetch at 'http://host.invalid/api/terminal/group-workspaces/private/remote-control-sessions/id/status' from origin 'http://localhost:19006' has been blocked by CORS policy";
    const failure = safeTerminalBrowserPolicyFailure(
      'http://host.invalid/api/terminal/group-workspaces/private/remote-control-sessions/id/status',
      consoleMessage,
    );

    expect(failure).toEqual({operation: 'remote-control.status', reason: 'CORS_BLOCKED'});
    expect(JSON.stringify(failure)).not.toContain('host.invalid');
    expect(JSON.stringify(failure)).not.toContain('private');
    expect(
      safeTerminalBrowserPolicyFailure(
        'http://host.invalid/api/terminal/group-workspaces/private/remote-control-sessions/id/registration',
        consoleMessage,
      ),
    ).toEqual({operation: 'remote-control.registration', reason: 'CORS_BLOCKED'});
    expect(
      safeTerminalBrowserPolicyFailure(
        'http://host.invalid/api/terminal/group-workspaces/private/remote-control-sessions/id/status',
        'Failed to execute unrelated script',
      ),
    ).toBeUndefined();
  });

  it('projects only safe correlated remote-control Runtime events', () => {
    const projected = projectTerminalRuntimeRemoteControlLog({
      category: 'terminal.remote-control.register',
      event: 'register-completed',
      message: 'do not retain arbitrary text',
      scope: {moduleName: 'kernel.base.terminal-data-client'},
      context: {commandId: 'command-1', requestId: 'runtime-request-1', sessionId: 'session-1'},
      data: {
        sessionId: 'session-1',
        resultKind: 'failure',
        failureCategory: 'delivered-failure',
        code: 'HTTP_DELIVERED_FAILURE',
        status: 500,
        requestId: 'edge-request-1',
        correlationId: 'edge-correlation-1',
        responseBody: 'private-response',
        token: 'private-token',
        authorization: 'Bearer private-secret',
      },
      error: {message: 'private exception body'},
      security: {containsSensitiveRaw: false, maskingMode: 'masked'},
    });

    expect(projected).toEqual({
      moduleName: 'kernel.base.terminal-data-client',
      category: 'terminal.remote-control.register',
      event: 'register-completed',
      commandId: 'command-1',
      runtimeRequestId: 'runtime-request-1',
      sessionId: 'session-1',
      resultKind: 'failure',
      failureCategory: 'delivered-failure',
      code: 'HTTP_DELIVERED_FAILURE',
      status: 500,
      requestId: 'edge-request-1',
      correlationId: 'edge-correlation-1',
    });
    const serialized = JSON.stringify(projected);
    expect(serialized).not.toContain('private-response');
    expect(serialized).not.toContain('private-token');
    expect(serialized).not.toContain('private-secret');
    expect(serialized).not.toContain('private exception');
    expect(projectTerminalRuntimeRemoteControlLog({
      category: 'terminal.remote-control.register',
      event: 'register-completed',
      scope: {moduleName: 'unrelated.module'},
      security: {containsSensitiveRaw: false},
    })).toBeUndefined();
    expect(projectTerminalRuntimeRemoteControlLog({
      category: 'terminal.remote-control.register',
      event: 'unapproved-event',
      scope: {moduleName: 'kernel.base.terminal-data-client'},
      security: {containsSensitiveRaw: false},
    })).toBeUndefined();
    expect(projectTerminalRuntimeRemoteControlLog({
      category: 'terminal.remote-control.register',
      event: 'register-completed',
      scope: {moduleName: 'kernel.base.terminal-data-client'},
      security: {containsSensitiveRaw: false, maskingMode: 'unverified'},
    })).toBeUndefined();
  });

  it('preserves whitelisted endpoint, screen and gesture failure facts without payloads', () => {
    const endpointFailure = projectTerminalRuntimeRemoteControlLog({
      category: 'terminal.remote-control',
      event: 'remote-control.endpoint-preparation-rejected',
      scope: {moduleName: 'kernel.base.remote-control'},
      context: {commandId: 'command-2'},
      data: {
        sessionId: 'session-2',
        stage: 'local-screen-read',
        mode: 'MASTER',
        reason: 'unavailable',
        rawPayload: 'private-payload',
      },
      security: {containsSensitiveRaw: false, maskingMode: 'masked'},
    });
    expect(endpointFailure).toMatchObject({
      event: 'remote-control.endpoint-preparation-rejected',
      sessionId: 'session-2',
      stage: 'local-screen-read',
      mode: 'MASTER',
      reason: 'unavailable',
    });
    expect(JSON.stringify(endpointFailure)).not.toContain('private-payload');

    const gestureCancelled = projectTerminalRuntimeRemoteControlLog({
      category: 'terminal.remote-control',
      event: 'remote-control.input-gesture-cancelled',
      scope: {moduleName: 'kernel.base.remote-control'},
      data: {
        sessionId: 'session-2',
        screen: 'main',
        reason: 'STALE_STREAM',
        forSeq: 17,
        acknowledged: false,
        token: 'private-token',
      },
      security: {containsSensitiveRaw: false, maskingMode: 'masked'},
    });
    expect(gestureCancelled).toMatchObject({
      event: 'remote-control.input-gesture-cancelled',
      sessionId: 'session-2',
      screen: 'main',
      reason: 'STALE_STREAM',
      forSeq: 17,
      acknowledged: false,
    });
    expect(JSON.stringify(gestureCancelled)).not.toContain('private-token');

    const screenInvalidated = projectTerminalRuntimeRemoteControlLog({
      category: 'terminal.remote-control',
      event: 'remote-control.screen-invalidated',
      scope: {moduleName: 'kernel.base.remote-control'},
      data: {sessionId: 'session-2', screen: 'secondary', generation: 9},
      security: {containsSensitiveRaw: false, maskingMode: 'masked'},
    });
    expect(screenInvalidated).toMatchObject({
      event: 'remote-control.screen-invalidated',
      sessionId: 'session-2',
      screen: 'secondary',
      generation: 9,
    });

    expect(projectTerminalRuntimeRemoteControlLog({
      category: 'terminal.remote-control',
      event: 'remote-control.report-failed',
      scope: {moduleName: 'kernel.base.remote-control'},
      data: {sessionId: 'session-2', state: 'ENDED', dispatchStatus: 'completed'},
      security: {containsSensitiveRaw: false, maskingMode: 'masked'},
    })).toMatchObject({state: 'ENDED', dispatchStatus: 'completed'});
  });
});
