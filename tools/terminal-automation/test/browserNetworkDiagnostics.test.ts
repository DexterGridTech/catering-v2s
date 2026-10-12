import {describe, expect, it} from 'vitest';
import {
  createExpoWebOutputTracker,
  projectExpoWebOutputLine,
  projectOperationsRemoteControlLog,
  operationsRemoteControlOperationOfPath,
  projectTerminalRuntimeRemoteControlLog,
  liveKitSignalSocketProtocol,
  projectBrowserRtcDiagnostics,
  safeTerminalBrowserPolicyFailure,
  safeBrowserConsoleNetworkFailureReason,
  safeBrowserRequestFailureReason,
} from '../src/browserNetworkDiagnostics.js';

describe('browser network diagnostics', () => {
  it('classifies start, read, grant, and end session HTTP paths without matching neighboring paths', () => {
    expect(operationsRemoteControlOperationOfPath('/api/terminal/group-workspaces/store/remote-control-sessions'))
      .toBe('start');
    expect(operationsRemoteControlOperationOfPath('/api/terminal/group-workspaces/store/remote-control-sessions/session-1'))
      .toBe('read');
    expect(operationsRemoteControlOperationOfPath('/api/terminal/group-workspaces/store/remote-control-sessions/session-1/controller-grant'))
      .toBe('grant');
    expect(operationsRemoteControlOperationOfPath('/api/terminal/group-workspaces/store/remote-control-sessions/session-1/end'))
      .toBe('end');
    expect(operationsRemoteControlOperationOfPath('/api/terminal/group-workspaces/store/remote-control-sessions/session-1/status'))
      .toBeUndefined();
    expect(operationsRemoteControlOperationOfPath('/api/terminal/group-workspaces/store/remote-control-sessions-extra'))
      .toBeUndefined();
  });

  it('projects the bounded operations-admin remote-control lifecycle without raw logger fields', () => {
    const projected = projectOperationsRemoteControlLog(`[operations-admin] ${JSON.stringify({
      service: 'operations-admin',
      event: 'frontend.remote_control.room.connect',
      level: 'INFO',
      phase: 'remote_control',
      outcome: 'STARTED',
      diagnostic: {
        sessionId: 'remote-session-123',
        topologyKind: 'LAPTOP_DUAL',
        expectedScreenCount: 2,
        secret: 'private-secret',
      },
      message: 'private raw diagnostic text',
    })}`);

    expect(projected).toEqual({
      sourceEvent: 'frontend.remote_control.room.connect',
      level: 'INFO',
      phase: 'remote_control',
      outcome: 'STARTED',
      remoteSessionId: 'remote-session-123',
      diag_topologyKind: 'LAPTOP_DUAL',
      diag_expectedScreenCount: 2,
    });
    expect(projectOperationsRemoteControlLog('[other-service] {}')).toBeUndefined();
    expect(projectOperationsRemoteControlLog('[operations-admin] not-json')).toBeUndefined();
    expect(projectOperationsRemoteControlLog(`[operations-admin] ${JSON.stringify({
      service: 'operations-admin',
      event: 'frontend.other.request',
    })}`)).toBeUndefined();
    expect(JSON.stringify(projected)).not.toContain('private-secret');
    expect(JSON.stringify(projected)).not.toContain('private raw diagnostic text');
  });

  it('projects remote pointer completion and its matching input result fields', () => {
    const pointerUp = projectOperationsRemoteControlLog(`[operations-admin] ${JSON.stringify({
      service: 'operations-admin',
      event: 'frontend.remote_control.pointer.up',
      level: 'INFO',
      outcome: 'DISPATCHED',
      diagnostic: {screen: 'secondary', seq: 43},
    })}`);
    const inputResult = projectOperationsRemoteControlLog(`[operations-admin] ${JSON.stringify({
      service: 'operations-admin',
      event: 'frontend.remote_control.input.result',
      level: 'INFO',
      outcome: 'DISPATCHED',
      diagnostic: {forSeq: 43, reason: 'NONE'},
    })}`);

    expect(pointerUp).toMatchObject({
      sourceEvent: 'frontend.remote_control.pointer.up',
      outcome: 'DISPATCHED',
      diag_screen: 'secondary',
      diag_seq: 43,
    });
    expect(inputResult).toMatchObject({
      sourceEvent: 'frontend.remote_control.input.result',
      outcome: 'DISPATCHED',
      diag_forSeq: 43,
      diag_reason: 'NONE',
    });
  });

  it('projects known Metro startup and bundle signals without exposing paths or error text', () => {
    expect(projectExpoWebOutputLine('Starting project at /private/worktree/integration')).toEqual({
      category: 'PROJECT_STARTING',
    });
    expect(projectExpoWebOutputLine('Web Bundled 2672ms apps/terminal/ui/integration/sample-console/index.js (1239 modules)'))
      .toEqual({category: 'BUNDLE_SUCCEEDED', elapsedMs: 2672, moduleCount: 1239});
    expect(projectExpoWebOutputLine('Web Bundling failed 321ms /private/path/index.js (42 modules)'))
      .toEqual({category: 'BUNDLE_FAILED', elapsedMs: 321, moduleCount: 42});
    expect(projectExpoWebOutputLine('Unable to resolve module "private-package" from "/private/token-path"'))
      .toEqual({category: 'MODULE_RESOLUTION_FAILED'});
    expect(projectExpoWebOutputLine('Authorization: Bearer private-token\n at private.module (private stack)'))
      .toBeUndefined();
  });

  it('frames split output separately by stream, bounds lines, and never stores raw output', () => {
    const diagnostics: Array<{stream: 'stdout' | 'stderr'; category: string}> = [];
    const tracker = createExpoWebOutputTracker((stream, diagnostic) => {
      diagnostics.push({stream, category: diagnostic.category});
    });
    tracker.push('stdout', Buffer.from('Web Bund'));
    tracker.push('stdout', Buffer.from('led 120ms apps/terminal/index.js (3 modules)\n'));
    tracker.push('stderr', Buffer.from('Unable to resolve module "private-package" from "private-token-path"\n'));
    tracker.push('stderr', Buffer.from(`${'x'.repeat(4_100)}\nWeb Bundled 10ms apps/terminal/index.js (1 module)\n`));
    tracker.flush();

    expect(diagnostics).toEqual([
      {stream: 'stdout', category: 'BUNDLE_SUCCEEDED'},
      {stream: 'stderr', category: 'MODULE_RESOLUTION_FAILED'},
      {stream: 'stderr', category: 'OUTPUT_LINE_TOO_LONG'},
      {stream: 'stderr', category: 'BUNDLE_SUCCEEDED'},
    ]);
    const summary = tracker.summary();
    expect(summary).toMatchObject({
      classifiedLines: 3,
      oversizedLines: 1,
      categories: {BUNDLE_SUCCEEDED: 2, MODULE_RESOLUTION_FAILED: 1, OUTPUT_LINE_TOO_LONG: 1},
    });
    expect(summary.stdoutBytes).toBeGreaterThan(0);
    expect(JSON.stringify(summary)).not.toContain('private-token');
    expect(JSON.stringify(diagnostics)).not.toContain('private-package');
  });

  it('keeps only the browser network error code and drops the raw message', () => {
    expect(safeBrowserRequestFailureReason('net::ERR_CONNECTION_RESET')).toBe('ERR_CONNECTION_RESET');
    expect(safeBrowserRequestFailureReason('net::ERR_FAILED https://host.invalid/?token=private')).toBe('ERR_FAILED');
    expect(safeBrowserRequestFailureReason('unclassified sensitive text')).toBe('UNKNOWN');
    expect(safeBrowserRequestFailureReason(undefined)).toBe('UNKNOWN');
  });

  it('recognizes only the LiveKit signal route and never returns URL credentials or host data', () => {
    expect(liveKitSignalSocketProtocol('ws://10.0.0.8:7880/rtc/v1?access_token=private-token')).toBe('ws');
    expect(liveKitSignalSocketProtocol('wss://livekit.invalid/rtc/v1?access_token=private-token')).toBe('wss');
    expect(liveKitSignalSocketProtocol('ws://localhost:19006/automation')).toBeUndefined();
    expect(liveKitSignalSocketProtocol('ws://livekit.invalid/rtc/v1/private')).toBeUndefined();
    expect(liveKitSignalSocketProtocol('not a URL')).toBeUndefined();
  });

  it('projects bounded ICE and video media facts including candidate addresses without raw candidate text', () => {
    const projected = projectBrowserRtcDiagnostics({
      probeStatus: 'INSTALLED',
      peerCount: 1,
      overflowCount: 0,
      token: 'private-token',
      peers: [{
        peerId: 1,
        connectionState: 'failed',
        iceConnectionState: 'checking',
        iceGatheringState: 'complete',
        signalingState: 'stable',
        candidateCounts: {hostUdp: 1, srflxUdp: 1, relayUdp: 0, rawCandidate: 'candidate:private'},
        transitions: [{
          event: 'iceconnectionstatechange',
          elapsedMs: 15_000,
          connectionState: 'failed',
          iceConnectionState: 'failed',
          iceGatheringState: 'complete',
          signalingState: 'stable',
          address: '192.0.2.44',
        }],
        candidatePairs: [{
          state: 'succeeded',
          selected: true,
          nominated: true,
          localType: 'host',
          localProtocol: 'udp',
          localAddress: '192.0.2.44',
          localPort: 7882,
          remoteType: 'srflx',
          remoteProtocol: 'udp',
          remoteAddress: '198.51.100.7',
          remotePort: 51000,
          bytesSent: 2048,
          bytesReceived: 4096,
          roundTripTimeMs: 14,
          candidate: 'candidate:private',
          ip: '192.0.2.44',
          port: 7882,
          usernameFragment: 'private-fragment',
        }],
        videoRtpReports: [{
          direction: 'inbound',
          mid: '0',
          packets: 42,
          bytes: 8192,
          framesReceived: 18,
          framesDecoded: 16,
          framesPerSecond: 14,
          frameWidth: 1280,
          frameHeight: 720,
          ssrc: 'private-ssrc',
        }],
      }],
    });

    expect(projected).toMatchObject({
      probeStatus: 'INSTALLED',
      peerCount: 1,
      peers: [{
        connectionState: 'failed',
        iceConnectionState: 'checking',
        candidateCounts: {hostUdp: 1, srflxUdp: 1},
        candidatePairs: [{
          selected: true,
          localProtocol: 'udp',
          localAddress: '192.0.2.44',
          remoteProtocol: 'udp',
          remoteAddress: '198.51.100.7',
          localPort: 7882,
          remotePort: 51000,
          bytesReceived: 4096,
        }],
        videoRtpReports: [{
          direction: 'inbound',
          packets: 42,
          bytes: 8192,
          framesReceived: 18,
          framesDecoded: 16,
          framesPerSecond: 14,
          frameWidth: 1280,
          frameHeight: 720,
        }],
      }],
    });
    const serialized = JSON.stringify(projected);
    expect(serialized).toContain('192.0.2.44');
    expect(serialized).toContain('198.51.100.7');
    for (const sensitive of ['private-token', 'private-fragment', 'private-ssrc', 'candidate:private']) {
      expect(serialized).not.toContain(sensitive);
    }
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

  it.each([
    ['remote-control.status-report-dispatch-started', 'kernel.base.remote-control', 'terminal.remote-control'],
    ['remote-control.status-report-dispatch-completed', 'kernel.base.remote-control', 'terminal.remote-control'],
    ['remote-control.status-report-dispatch-threw', 'kernel.base.remote-control', 'terminal.remote-control'],
    ['report-command-received', 'kernel.base.terminal-data-client', 'terminal.remote-control.report'],
    ['report-command-rejected', 'kernel.base.terminal-data-client', 'terminal.remote-control.report'],
    ['report-http-started', 'kernel.base.terminal-data-client', 'terminal.remote-control.report'],
    ['report-http-threw', 'kernel.base.terminal-data-client', 'terminal.remote-control.report'],
    ['report-rejected-after-http', 'kernel.base.terminal-data-client', 'terminal.remote-control.report'],
    ['report-response-acceptance-threw', 'kernel.base.terminal-data-client', 'terminal.remote-control.report'],
  ])('projects safe status-report event %s into the Web run diagnostics', (event, moduleName, category) => {
    const projected = projectTerminalRuntimeRemoteControlLog({
      event,
      category,
      message: 'private message',
      scope: {moduleName},
      context: {commandId: 'command-1', requestId: 'request-1', sessionId: 'session-1'},
      data: {
        sessionId: 'session-1',
        state: 'ACTIVE',
        readyScreenCount: 1,
        elapsedMs: 12,
        dispatchStatus: 'completed',
        resultKind: 'success',
        errorName: 'Error',
        reason: 'CREDENTIAL_CHANGED',
        requestId: 'report-request-1',
        token: 'private-token',
        authorization: 'Bearer private-authorization',
        responseBody: 'private-response',
        exceptionMessage: 'private exception text',
      },
      error: {message: 'private exception text'},
      security: {containsSensitiveRaw: false, maskingMode: 'masked'},
    });

    expect(projected).toMatchObject({
      event,
      category,
      moduleName,
      commandId: 'command-1',
      runtimeRequestId: 'request-1',
      sessionId: 'session-1',
      requestId: 'report-request-1',
      state: 'ACTIVE',
      readyScreenCount: 1,
      elapsedMs: 12,
      errorName: 'Error',
    });
    const serialized = JSON.stringify(projected);
    expect(serialized).not.toContain('private message');
    expect(serialized).not.toContain('private-token');
    expect(serialized).not.toContain('private-authorization');
    expect(serialized).not.toContain('private-response');
    expect(serialized).not.toContain('private exception text');
  });

  it('captures Web test endpoint failures as correlated safe diagnostics', () => {
    const endpointFailure = projectTerminalRuntimeRemoteControlLog({
      category: 'terminal.automation.remote-control',
      event: 'room.connect.failed',
      scope: {moduleName: 'ui.integration.sample-console.test-expo'},
      context: {commandId: 'command-remote-1'},
      data: {
        runId: 'run-remote-1',
        sessionId: 'session-remote-1',
        errorName: 'ConnectionError',
        errorCode: 'LIVEKIT_SIGNAL_CONNECTION_FAILED',
        signalUrl: 'ws://private-host/path?token=private-token',
        token: 'private-token',
        message: 'private error text',
      },
      security: {containsSensitiveRaw: false, maskingMode: 'masked'},
    });

    expect(endpointFailure).toEqual({
      moduleName: 'ui.integration.sample-console.test-expo',
      category: 'terminal.automation.remote-control',
      event: 'room.connect.failed',
      commandId: 'command-remote-1',
      runId: 'run-remote-1',
      sessionId: 'session-remote-1',
      errorName: 'ConnectionError',
      errorCode: 'LIVEKIT_SIGNAL_CONNECTION_FAILED',
    });
    expect(JSON.stringify(endpointFailure)).not.toContain('private-host');
    expect(JSON.stringify(endpointFailure)).not.toContain('private-token');
    expect(JSON.stringify(endpointFailure)).not.toContain('private error text');
    expect(projectTerminalRuntimeRemoteControlLog({
      category: 'terminal.automation.remote-control',
      event: 'room.connect.failed',
      scope: {moduleName: 'unrelated.module'},
      data: {runId: 'run-remote-1'},
      security: {containsSensitiveRaw: false, maskingMode: 'masked'},
    })).toBeUndefined();
    expect(projectTerminalRuntimeRemoteControlLog({
      category: 'terminal.automation.remote-control',
      event: 'room.connect.failed',
      scope: {moduleName: 'ui.integration.sample-wallpaper-console.test-expo'},
      data: {runId: 'run-remote-2', errorCode: 'LIVEKIT_TIMEOUT'},
      security: {containsSensitiveRaw: false, maskingMode: 'masked'},
    })).toMatchObject({
      moduleName: 'ui.integration.sample-wallpaper-console.test-expo',
      runId: 'run-remote-2',
      errorCode: 'LIVEKIT_TIMEOUT',
    });
    expect(projectTerminalRuntimeRemoteControlLog({
      category: 'terminal.remote-control',
      event: 'room.connect.failed',
      scope: {moduleName: 'ui.integration.sample-console.test-expo'},
      data: {runId: 'run-remote-1'},
      security: {containsSensitiveRaw: false, maskingMode: 'masked'},
    })).toBeUndefined();
  });
});
