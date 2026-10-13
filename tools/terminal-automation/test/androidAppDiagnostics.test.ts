import {describe, expect, it} from 'vitest';
import {
  collectAndroidRemoteControlDiagnostics,
  collectAndroidRuntimeFailureDiagnostics,
  projectAndroidAutomationConnectionLog,
  projectAndroidAutomationSelectorFailureLog,
  projectAndroidTerminalDataReadLog,
  projectAndroidTerminalHeartbeatLog,
  projectAndroidTerminalTopicSubscriptionLog,
  projectAndroidTransportFailureLog,
  projectAndroidTerminalUpdateReportLog,
  projectTerminalAutomationAppEvent,
} from '../src/androidAppDiagnostics.js';

describe('Android remote-control native diagnostics', () => {
  it('keeps bounded native capture facts with stream, window, and track correlation identities', () => {
    const diagnostics = collectAndroidRemoteControlDiagnostics([
      'I/TerminalRemote( 1234): event=video-track-created streamId=stream-123 surfaceKey=PRIMARY windowIdentity=window-primary trackId=track-123 generation=3 width=1280 height=720',
      'I/TerminalRemote( 1234): event=main-operation operation=touch-dispatch surfaceKey=PRIMARY queueWaitMs=3167 mainWorkMs=2',
      'I/TerminalRemote( 1234): event=touch-window-dispatch surfaceKey=PRIMARY action=UP elapsedMs=1',
      'I/TerminalRemote( 1234): event=touch-window-dispatch surfaceKey=PRIMARY action=CANCEL elapsedMs=2',
      'I/TerminalRemoteCapture( 1234): event=capturer-initialized surfaceKey=PRIMARY windowIdentity=window-primary generation=3',
      'I/Other( 1234): event=unrelated',
    ].join('\n'));

    expect(diagnostics).toEqual({
      lineCount: 5,
      eventKinds: ['video-track-created', 'main-operation', 'touch-window-dispatch', 'capturer-initialized'],
      events: [
        {
          event: 'video-track-created',
          fields: {
            streamId: 'stream-123',
            surfaceKey: 'PRIMARY',
            windowIdentity: 'window-primary',
            trackId: 'track-123',
            generation: 3,
            width: 1280,
            height: 720,
          },
        },
        {event: 'main-operation', fields: {operation: 'touch-dispatch', surfaceKey: 'PRIMARY', queueWaitMs: 3167, mainWorkMs: 2}},
        {event: 'touch-window-dispatch', fields: {surfaceKey: 'PRIMARY', action: 'UP', elapsedMs: 1}},
        {event: 'touch-window-dispatch', fields: {surfaceKey: 'PRIMARY', action: 'CANCEL', elapsedMs: 2}},
        {event: 'capturer-initialized', fields: {surfaceKey: 'PRIMARY', windowIdentity: 'window-primary', generation: 3}},
      ],
    });
  });

  it('collects Android remote owner, port-event, and LiveKit adapter lifecycle boundaries', () => {
    const lines = [
      `I/ReactNativeJS (123): ${JSON.stringify({
        category: 'terminal.remote-control',
        event: 'remote-control.peer-join-command-rejected',
        context: {commandId: 'join-command', requestId: 'join-request'},
        data: {sessionId: 'session-1', reason: 'STATUS_PROJECTION_NOT_READY', resultStatus: 'rejected'},
      })}`,
      `I/ReactNativeJS (123): ${JSON.stringify({
        category: 'terminal.remote-control',
        event: 'remote-control.peer-endpoint-join-completed',
        context: {commandId: 'master-command', requestId: 'master-request'},
        data: {sessionId: 'session-1', dispatchStatus: 'completed', actorStatus: 'completed', actorResultCount: 1, resultStatus: 'rejected'},
      })}`,
      `I/ReactNativeJS (123): ${JSON.stringify({
        category: 'terminal.remote-control',
        event: 'remote-control.screen-ready-sent',
        context: {commandId: 'command-1', requestId: 'request-1'},
        data: {sessionId: 'session-1', endpointId: 'endpoint-1', screen: 'main', seq: 4},
      })}`,
      `I/ReactNativeJS (123): ${JSON.stringify({
        category: 'terminal.remote-control',
        event: 'remote-control.start-command-received',
        data: {
          sessionIdValid: true,
          mode: 'MASTER',
          activationStatus: 'active',
          connectionStatus: 'connected',
          connectedSessionMatches: true,
          topologyKind: 'LAPTOP_PAIRED',
          paired: true,
          peerModuleName: 'ui.integration.sample-console',
          peerReachable: true,
          stateSyncConnectionReady: true,
        },
      })}`,
      `I/ReactNativeJS (123): ${JSON.stringify({
        category: 'terminal.remote-control.port-event',
        event: 'port-event-queued',
        data: {eventType: 'screen-ready', sessionId: 'session-1'},
      })}`,
      `I/ReactNativeJS (123): ${JSON.stringify({
        category: 'terminal.remote-control.port-event',
        event: 'port-event-started',
        data: {eventType: 'screen-ready', sessionId: 'session-1', queueWaitMs: 7},
      })}`,
      `I/ReactNativeJS (123): ${JSON.stringify({
        category: 'remote-control.adapter',
        event: 'remote-control.adapter.room-connected',
        data: {sessionId: 'session-1', screenCount: 2},
      })}`,
      `W/ReactNativeJS (123): ${JSON.stringify({
        category: 'terminal.remote-control.port-event',
        event: 'port-event-dispatch-threw',
        data: {eventType: 'screen-ready', errorName: 'TypeError'},
      })}`,
      `I/ReactNativeJS (123): ${JSON.stringify({
        category: 'remote-control.adapter',
        event: 'remote-control.adapter.session-begin-failed',
        data: {sessionId: 'session-1', reason: 'TypeError'},
      })}`,
    ].join('\n');

    const output = collectAndroidRuntimeFailureDiagnostics(lines);

    expect(output).toContain('remote-control.peer-join-command-rejected');
    expect(output).toContain('remote-control.peer-endpoint-join-completed');
    expect(output).toContain('STATUS_PROJECTION_NOT_READY');
    expect(output).toContain('"actorResultCount":1');
    expect(output).toContain('remote-control.screen-ready-sent');
    expect(output).toContain('remote-control.start-command-received');
    expect(output).toContain('"activationStatus":"active"');
    expect(output).toContain('"connectedSessionMatches":true');
    expect(output).toContain('"peerModuleName":"ui.integration.sample-console"');
    expect(output).toContain('"stateSyncConnectionReady":true');
    expect(output).toContain('port-event-queued');
    expect(output).toContain('port-event-started');
    expect(output).toContain('"queueWaitMs":7');
    expect(output).toContain('remote-control.adapter.room-connected');
    expect(output).toContain('port-event-dispatch-threw');
    expect(output).toContain('remote-control.adapter.session-begin-failed');
    expect(output).toContain('"sessionId":"session-1"');
    expect(output).toContain('"screenCount":2');
    expect(output).toContain('"errorName":"TypeError"');
    expect(output).not.toContain('payload');
  });

  it('collects TDC remote-control registration and report owner boundaries on Android', () => {
    const lines = [
      `I/ReactNativeJS (123): ${JSON.stringify({
        category: 'terminal.remote-control.register',
        event: 'register-completed',
        context: {commandId: 'register-command', requestId: 'register-request'},
        data: {sessionId: 'session-1', resultKind: 'success', status: 201, grantCount: 2, elapsedMs: 12},
      })}`,
      `I/ReactNativeJS (123): ${JSON.stringify({
        category: 'terminal.remote-control.report',
        event: 'report-completed',
        context: {commandId: 'report-command', requestId: 'report-request'},
        data: {
          sessionId: 'session-1',
          state: 'ACTIVE',
          resultKind: 'failure',
          failureCategory: 'transport',
          code: 'HTTP_TIMEOUT',
          status: 503,
          remainingLeaseMs: 8123,
          readyScreenCount: 2,
          elapsedMs: 400,
        },
      })}`,
    ].join('\n');

    const output = collectAndroidRuntimeFailureDiagnostics(lines);
    expect(output).toContain('register-completed');
    expect(output).toContain('report-completed');
    expect(output).toContain('"commandId":"report-command"');
    expect(output).toContain('"failureCategory":"transport"');
    expect(output).toContain('"remainingLeaseMs":8123');
  });

  it('collects TDC remote-command execution decisions and dispatch outcomes on Android', () => {
    const lines = [
      `I/ReactNativeJS (123): ${JSON.stringify({
        category: 'terminal.remote-control.execution',
        event: 'remote-command.rejected',
        context: {commandId: 'command-1', requestId: 'request-1'},
        data: {
          remoteOperationId: 'remote-operation-1',
          commandKind: 'START_REMOTE_CONTROL',
          bindingGeneration: 3,
          sessionReady: false,
          hasCredential: true,
          credentialGenerationMatches: true,
          errorCode: 'REMOTE_SESSION_NOT_READY',
          credential: 'must-not-be-copied',
        },
      })}`,
      `I/ReactNativeJS (123): ${JSON.stringify({
        category: 'terminal.remote-control.execution',
        event: 'remote-command.dispatch-completed',
        context: {commandId: 'command-2'},
        data: {
          remoteOperationId: 'remote-operation-2',
          commandKind: 'START_REMOTE_CONTROL',
          bindingGeneration: 3,
          sessionReady: true,
          hasCredential: true,
          credentialGenerationMatches: true,
          dispatchStatus: 'timed-out',
          actorResultCount: 1,
          hasPendingActor: true,
          token: 'must-not-be-copied',
        },
      })}`,
    ].join('\n');

    const output = collectAndroidRuntimeFailureDiagnostics(lines);
    expect(output).toContain('remote-command.rejected');
    expect(output).toContain('remote-command.dispatch-completed');
    expect(output).toContain('"remoteOperationId":"remote-operation-1"');
    expect(output).toContain('"errorCode":"REMOTE_SESSION_NOT_READY"');
    expect(output).toContain('"dispatchStatus":"timed-out"');
    expect(output).toContain('"hasPendingActor":true');
    expect(output).not.toContain('must-not-be-copied');
  });
});

describe('TER Stage C owner log projection', () => {
  it('correlates project and update lifecycle without retaining raw owner data', () => {
    const projected = projectTerminalAutomationAppEvent({
      category: 'terminal.update.lifecycle',
      event: 'artifact-prepare-returned',
      level: 'info',
      message: 'must not be copied',
      context: {commandId: 'cmd-123', requestId: 'request-456'},
      data: {
        taskId: 'task-789',
        artifactKind: 'hot',
        portStatus: 'succeeded',
        elapsedMs: 37,
        downloadGrant: 'private-grant',
        sourcePath: '/private/path',
        url: 'https://user:secret@example.invalid/payload',
      },
    });
    expect(projected).toMatchObject({
      category: 'terminal.update.lifecycle',
      event: 'artifact-prepare-returned',
      commandId: 'cmd-123',
      requestId: 'request-456',
      taskId: 'task-789',
      artifactKind: 'hot',
      portStatus: 'succeeded',
      elapsedMs: 37,
    });
    const serialized = JSON.stringify(projected);
    for (const forbidden of ['must not be copied', 'private-grant', '/private/path', 'secret', 'example.invalid']) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it('projects project-basic owner failures and rejects unregistered events', () => {
    expect(
      projectTerminalAutomationAppEvent({
        category: 'terminal.project-basic.read',
        event: 'owner-read-completed',
        context: {requestId: 'req-1'},
        data: {
          operationId: 'terminalReadProject',
          dispatchStatus: 'completed',
          resultKind: 'failure',
          errorCode: 'UPSTREAM_UNAVAILABLE',
          elapsedMs: 9,
        },
      }),
    ).toMatchObject({
      category: 'terminal.project-basic.read',
      event: 'owner-read-completed',
      requestId: 'req-1',
      operationId: 'terminalReadProject',
      errorCode: 'UPSTREAM_UNAVAILABLE',
      elapsedMs: 9,
    });
    expect(
      projectTerminalAutomationAppEvent({category: 'terminal.update.lifecycle', event: 'unregistered', data: {}}),
    ).toBeNull();
  });

  it('retains safe project-basic update rejection reason codes', () => {
    expect(
      projectTerminalAutomationAppEvent({
        category: 'terminal.project-basic.read',
        event: 'terminal-update-requested',
        context: {requestId: 'req-update-1'},
        data: {
          resultStatus: 'rejected',
          reasonCode: 'TARGET_CHANGED',
          candidatePresent: true,
          elapsedMs: 21,
          target: {secret: 'must-not-be-copied'},
        },
      }),
    ).toMatchObject({
      category: 'terminal.project-basic.read',
      event: 'terminal-update-requested',
      requestId: 'req-update-1',
      resultStatus: 'rejected',
      reasonCode: 'TARGET_CHANGED',
      candidatePresent: true,
      elapsedMs: 21,
    });
  });

  it('collects the fixed-task failure events with safe codes and no owner payloads', () => {
    const events = [
      {
        category: 'terminal.update.lifecycle',
        event: 'target-admission-rejected',
        data: {
          reasonCode: 'TARGET_CONTEXT_MISMATCH',
          message: 'private diagnostic',
          grant: 'private-grant',
          url: 'https://private.example.invalid/download',
          credential: 'private-credential',
          payload: {activationCode: 'private-payload'},
          path: '/private/workspace/file',
        },
      },
      {
        category: 'terminal.update.lifecycle',
        event: 'target-revalidation-rejected',
        data: {
          phase: 'before-commit',
          reasonCode: 'TARGET_CHANGED',
          candidatePresent: true,
          targetValid: true,
          targetMatches: false,
          ruleMatches: true,
          collectionMatches: false,
          target: {secret: 'must-not-be-copied'},
        },
      },
      {
        category: 'terminal.project-basic.read',
        event: 'rules-snapshot-failed',
        data: {
          reasonCode: 'SNAPSHOT_COLLECTION_CHANGED',
          elapsedMs: 17,
          message: 'private diagnostic',
          payload: {ruleBody: 'private-payload'},
        },
      },
      {
        category: 'terminal.project-basic.read',
        event: 'topic-notification-accept-failed',
        data: {
          topicKey: 'TERMINAL_UPDATE_RULES',
          dispatchStatus: 'failed',
          resultStatus: 'rejected',
          message: 'private diagnostic',
          grant: 'private-grant',
        },
      },
    ];
    const output = collectAndroidRuntimeFailureDiagnostics(
      events.map(event => `I/ReactNativeJS (123): ${JSON.stringify(event)}`).join('\n'),
    );

    expect(output).toContain('"event":"target-admission-rejected"');
    expect(output).toContain('"reasonCode":"TARGET_CONTEXT_MISMATCH"');
    expect(output).toContain('"event":"target-revalidation-rejected"');
    expect(output).toContain('"phase":"before-commit"');
    expect(output).toContain('"collectionMatches":false');
    expect(output).toContain('"event":"rules-snapshot-failed"');
    expect(output).toContain('"reasonCode":"SNAPSHOT_COLLECTION_CHANGED"');
    expect(output).toContain('"elapsedMs":17');
    expect(output).toContain('"event":"topic-notification-accept-failed"');
    expect(output).toContain('"topicKey":"TERMINAL_UPDATE_RULES"');
    expect(output).toContain('"dispatchStatus":"failed"');
    expect(output).toContain('"resultStatus":"rejected"');
    for (const forbidden of [
      'private diagnostic',
      'private-grant',
      'private.example.invalid',
      'private-credential',
      'private-payload',
      '/private/workspace/file',
    ]) {
      expect(output).not.toContain(forbidden);
    }
  });

  it('projects a deferred fixed-task context with safe readiness and reason fields', () => {
    const projected = projectTerminalAutomationAppEvent({
      category: 'terminal.update.lifecycle',
      event: 'fixed-task-context-not-ready',
      level: 'info',
      context: {commandId: 'command-resume'},
      data: {
        taskId: 'task-fixed',
        artifactKind: 'hot',
        contextReady: false,
        reasonCode: 'UPDATE_CONTEXT_NOT_READY',
        secret: 'must-not-leak',
      },
    });

    expect(projected).toMatchObject({
      event: 'fixed-task-context-not-ready',
      taskId: 'task-fixed',
      artifactKind: 'hot',
      contextReady: false,
      reasonCode: 'UPDATE_CONTEXT_NOT_READY',
    });
    expect(JSON.stringify(projected)).not.toContain('must-not-leak');
  });

  it('captures primary-ready continuation state with only safe lifecycle fields', () => {
    const received = projectTerminalAutomationAppEvent({
      category: 'terminal-update.primary-ready',
      event: 'terminal-update.primary-ready-received',
      data: {contentReady: true, taskPhase: 'fixed', actionPending: 0, secret: 'must-not-leak'},
    });
    const continued = projectTerminalAutomationAppEvent({
      category: 'terminal-update.primary-ready',
      event: 'terminal-update.primary-ready-continuation-result',
      data: {taskId: 'task-safe', dispatchStatus: 'completed', secret: 'must-not-leak'},
    });

    expect(received).toMatchObject({
      category: 'terminal-update.primary-ready',
      event: 'terminal-update.primary-ready-received',
      contentReady: true,
      taskPhase: 'fixed',
      actionPending: 0,
    });
    expect(continued).toMatchObject({
      event: 'terminal-update.primary-ready-continuation-result',
      taskId: 'task-safe',
      dispatchStatus: 'completed',
    });
    expect(JSON.stringify([received, continued])).not.toContain('must-not-leak');
  });

  it('retains report-descriptor persistence outcome without exposing binding or report bodies', () => {
    const projected = projectTerminalAutomationAppEvent({
      category: 'terminal.update.lifecycle',
      event: 'report-descriptor-persist-failed',
      level: 'warn',
      context: {commandId: 'cmd-report', requestId: null},
      data: {
        nextReportSequence: 7,
        pendingReportCount: 1,
        sendPaused: true,
        bindingIdentityPresent: true,
        contextIdentityPresent: true,
        persistenceStatus: 'failed',
        elapsedMs: 11,
        bindingIdentity: 'private-binding',
        pendingReports: {report: 'private-body'},
      },
    });

    expect(projected).toMatchObject({
      category: 'terminal.update.lifecycle',
      event: 'report-descriptor-persist-failed',
      commandId: 'cmd-report',
      nextReportSequence: 7,
      pendingReportCount: 1,
      sendPaused: true,
      bindingIdentityPresent: true,
      contextIdentityPresent: true,
      persistenceStatus: 'failed',
      elapsedMs: 11,
    });
    const serialized = JSON.stringify(projected);
    expect(serialized).not.toContain('private-binding');
    expect(serialized).not.toContain('private-body');
  });

  it('projects paired topology and admin lifecycle without the peer address or connection identity', () => {
    const topology = projectTerminalAutomationAppEvent({
      category: 'topology.peer',
      event: 'topology.peer.hello-accepted-accepted',
      context: {commandId: 'pair-command'},
      data: {
        localMode: 'SLAVE',
        messageType: 'hello-accepted',
        connectionId: 'private-connection',
        peerHost: '10.0.2.2',
      },
    });
    const admin = projectTerminalAutomationAppEvent({
      category: 'admin.topology',
      event: 'admin.topology-operation-completed',
      data: {operation: 'pair', status: 'completed', reasonCode: 'TOPOLOGY_PAIRED', host: '10.0.2.2'},
    });
    expect(topology).toMatchObject({category: 'topology.peer', localMode: 'SLAVE', messageType: 'hello-accepted'});
    expect(admin).toMatchObject({category: 'admin.topology', operation: 'pair', status: 'completed'});
    const serialized = JSON.stringify([topology, admin]);
    expect(serialized).not.toMatch(/private-connection|10\.0\.2\.2/u);
  });

  it('projects topology state-transfer progress while dropping connection identity and slice contents', () => {
    const applied = projectTerminalAutomationAppEvent({
      category: 'topology.peer',
      event: 'topology.peer.state-full-applied',
      data: {
        sliceName: 'terminal.project-basic',
        direction: 'master-to-slave',
        revision: 7,
        changed: true,
        syncEntryCount: 4,
        primaryContainerCount: 2,
        secondaryContainerCount: 1,
        primaryPartKey: 'private-primary-part',
        secondaryPartKey: 'private-secondary-part',
        peerHost: '10.0.2.2',
        connectionId: 'private-connection',
        credentialSecret: 'private-secret',
      },
    });
    const failed = projectTerminalAutomationAppEvent({
      category: 'topology.peer',
      event: 'topology.peer.state-full-transfer-failed',
      data: {reason: 'TOPOLOGY_REASSEMBLY_TIMEOUT', deterministic: false, transferId: 'private-transfer'},
    });

    expect(applied).toMatchObject({
      category: 'topology.peer',
      event: 'topology.peer.state-full-applied',
      sliceName: 'terminal.project-basic',
      direction: 'master-to-slave',
      revision: 7,
      changed: true,
      syncEntryCount: 4,
      primaryContainerCount: 2,
      secondaryContainerCount: 1,
    });
    expect(failed).toMatchObject({
      event: 'topology.peer.state-full-transfer-failed',
      resultReason: 'TOPOLOGY_REASSEMBLY_TIMEOUT',
      deterministic: false,
    });
    const serialized = JSON.stringify([applied, failed]);
    for (const forbidden of [
      'private-primary-part',
      'private-secondary-part',
      '10.0.2.2',
      'private-connection',
      'private-secret',
      'private-transfer',
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it('captures allowlisted Runtime owner and topology events from Android logcat without addresses or payloads', () => {
    const logs = [
      `I/ReactNativeJS (123): ${JSON.stringify({
        category: 'topology.peer',
        event: 'topology.peer.hello-accepted-accepted',
        data: {localMode: 'SLAVE', messageType: 'hello-accepted', connectionId: 'opaque-id', peerHost: '10.0.2.2'},
      })}`,
      `I/ReactNativeJS (123): ${JSON.stringify({
        category: 'terminal.project-basic.read',
        event: 'terminal-update-requested',
        context: {requestId: 'request-safe-1'},
        data: {dispatchStatus: 'completed', resultKind: 'success', selectedCredential: 'private-secret'},
      })}`,
    ].join('\n');
    const output = collectAndroidRuntimeFailureDiagnostics(logs);
    expect(output).toContain('topology.peer.hello-accepted-accepted');
    expect(output).toContain('terminal-update-requested');
    expect(output).toContain('"localMode":"SLAVE"');
    for (const forbidden of ['10.0.2.2', 'opaque-id', 'private-secret']) expect(output).not.toContain(forbidden);
  });
});

describe('Android terminal rule chain diagnostics', () => {
  it('projects topic subscription outcomes without owner or credential identity', () => {
    const line = `I/ReactNativeJS (123): ${JSON.stringify({
      category: 'terminal.data.topic-subscription',
      event: 'terminal-topic-subscribe.persist.readback',
      level: 'info',
      data: {
        topicKey: 'TERMINAL_UPDATE_RULES',
        resultStatus: 'persisted',
        matchingSubscriptionPresent: true,
        persistedSubscriptionCount: 3,
        ownerRef: 'private-owner-ref',
        terminalRef: 'private-terminal-ref',
        credentialSecret: 'private-secret',
      },
    })}`;

    const projected = projectAndroidTerminalTopicSubscriptionLog(line);
    expect(projected).toMatchObject({
      category: 'terminal.data.topic-subscription',
      event: 'terminal-topic-subscribe.persist.readback',
      topicKey: 'TERMINAL_UPDATE_RULES',
      resultStatus: 'persisted',
      matchingSubscriptionPresent: true,
      persistedSubscriptionCount: 3,
    });
    expect(JSON.stringify(projected)).not.toContain('private-owner-ref');
    expect(JSON.stringify(projected)).not.toContain('private-terminal-ref');
    expect(JSON.stringify(projected)).not.toContain('private-secret');
  });

  it('projects generated HTTP read stage and classified response without request data', () => {
    const line = `I/ReactNativeJS (123): ${JSON.stringify({
      category: 'terminal.data.read',
      event: 'terminal-read-http.response',
      level: 'info',
      data: {
        operationId: 'terminalReadProjectUpdateRuleSnapshotPage',
        elapsedMs: 42,
        resultKind: 'success',
        status: 200,
        pathParameters: {projectRef: 'private-project-ref'},
        query: {collectionHash: 'private-hash'},
        Authorization: 'Terminal private-secret',
      },
    })}`;

    const projected = projectAndroidTerminalDataReadLog(line);
    expect(projected).toMatchObject({
      category: 'terminal.data.read',
      event: 'terminal-read-http.response',
      operationId: 'terminalReadProjectUpdateRuleSnapshotPage',
      elapsedMs: 42,
      resultKind: 'success',
      status: 200,
    });
    expect(JSON.stringify(projected)).not.toContain('private-project-ref');
    expect(JSON.stringify(projected)).not.toContain('private-hash');
    expect(JSON.stringify(projected)).not.toContain('private-secret');
  });
});

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

describe('Android terminal heartbeat diagnostics', () => {
  it('keeps PONG and local consumer outcomes while omitting arbitrary payload fields', () => {
    const line = `I/ReactNativeJS (123): ${JSON.stringify({
      category: 'terminal.connection.heartbeat',
      event: 'heartbeat-consumer-completed',
      level: 'info',
      data: {
        dispatchStatus: 'completed',
        consumerCount: 1,
        actorStatus: 'completed',
        resultStatus: 'context-not-ready',
        terminalRef: 'private-terminal-ref',
        credentialSecret: 'private-secret',
      },
    })}`;

    const projected = projectAndroidTerminalHeartbeatLog(line);
    expect(projected).toMatchObject({
      category: 'terminal.connection.heartbeat',
      event: 'heartbeat-consumer-completed',
      dispatchStatus: 'completed',
      consumerCount: 1,
      actorStatus: 'completed',
      resultStatus: 'context-not-ready',
    });
    expect(JSON.stringify(projected)).not.toContain('private-terminal-ref');
    expect(JSON.stringify(projected)).not.toContain('private-secret');
  });
});

describe('Android terminal update report diagnostics', () => {
  it('retains safe report correlation identifiers while filtering arbitrary secrets', () => {
    const line = `I/ReactNativeJS (123): ${JSON.stringify({
      category: 'terminal.update.report',
      event: 'report-submit-completed',
      level: 'info',
      data: {
        resultKind: 'success',
        status: 200,
        reportSequence: 3,
        reportState: 'SUCCEEDED',
        reportReason: 'NONE',
        taskIdPresent: true,
        receiptTaskIdPresent: true,
        receiptTaskMatchesPayload: true,
        receiptSequenceMatchesPayload: true,
        receiptOutcome: 'ACCEPTED',
        reportId: '44444444-4444-4444-8444-444444444444',
        taskId: '55555555-5555-4555-8555-555555555555',
        requestId: 'req-stage-c-7',
        correlationId: 'corr-stage-c-7',
        credentialSecret: 'private-secret',
      },
    })}`;

    const projected = projectAndroidTerminalUpdateReportLog(line);
    expect(projected).toMatchObject({
      category: 'terminal.update.report',
      event: 'report-submit-completed',
      level: 'info',
      attemptNumber: 3,
      reportState: 'SUCCEEDED',
      reportReason: 'NONE',
      taskIdPresent: true,
      receiptTaskIdPresent: true,
      receiptTaskMatchesPayload: true,
      receiptSequenceMatchesPayload: true,
      receiptOutcome: 'ACCEPTED',
      reportId: '44444444-4444-4444-8444-444444444444',
      taskId: '55555555-5555-4555-8555-555555555555',
      requestId: 'req-stage-c-7',
      correlationId: 'corr-stage-c-7',
    });
    expect(JSON.stringify(projected)).not.toContain('private-secret');
    expect(
      projectAndroidTerminalUpdateReportLog(line.replace('44444444-4444-4444-8444-444444444444', 'private-report-id')),
    ).not.toHaveProperty('reportId');
    expect(
      projectAndroidTerminalUpdateReportLog(line.replace('"reportReason":"NONE"', '"reportReason":"PRIVATE_REASON"')),
    ).not.toHaveProperty('reportReason');
  });

  it('projects report task identity comparisons without exposing the task identity', () => {
    const projected = projectTerminalAutomationAppEvent({
      category: 'terminal.update.lifecycle',
      event: 'report-submit-started',
      data: {
        taskIdPresent: true,
        taskMatchesCurrentTask: true,
        taskMatchesRecentStatus: false,
      },
    });
    expect(projected).toMatchObject({
      taskIdPresent: true,
      taskMatchesCurrentTask: true,
      taskMatchesRecentStatus: false,
    });
    expect(JSON.stringify(projected)).not.toContain('private-task-id');
  });

  it('keeps report IDs in the shared Web and Android app-event projection', () => {
    const projected = projectTerminalAutomationAppEvent({
      category: 'terminal.update.report',
      event: 'report-submit-completed',
      data: {
        reportId: '44444444-4444-4444-8444-444444444444',
        taskId: '55555555-5555-4555-8555-555555555555',
        correlationId: 'corr-stage-c-7',
      },
    });
    expect(projected).toMatchObject({
      reportId: '44444444-4444-4444-8444-444444444444',
      taskId: '55555555-5555-4555-8555-555555555555',
      correlationId: 'corr-stage-c-7',
    });
  });
});

describe('Android automation connection diagnostics', () => {
  it('retains close code and session identity without retaining address or arbitrary data', () => {
    const line = `I/ReactNativeJS (123): ${JSON.stringify({
      category: 'automation.connection',
      event: 'connection.closed',
      level: 'info',
      data: {
        address: 'ws://user:secret@example.invalid/private',
        sessionId: 'runtime-session-123',
        code: 1006,
        reason: 'arbitrary server text',
      },
    })}`;

    expect(projectAndroidAutomationConnectionLog(line)).toEqual({
      category: 'automation.connection',
      event: 'connection.closed',
      level: 'info',
      sessionId: 'runtime-session-123',
      closeCode: 1006,
    });
    expect(collectAndroidRuntimeFailureDiagnostics(line)).not.toContain('secret');
    expect(collectAndroidRuntimeFailureDiagnostics(line)).not.toContain('example.invalid');
  });

  it('retains the bounded send-window failure marker and a safe close reason code', () => {
    const lines = [
      `W/ReactNativeJS (123): ${JSON.stringify({
        category: 'automation.connection',
        event: 'outbound.window.limit',
        level: 'warn',
        data: {
          sessionId: 'runtime-session-123',
          address: 'ws://secret.example.invalid',
          reason: 'UNACKNOWLEDGED_WINDOW_FULL',
          limitBytes: 1_048_576,
          messageBytes: 900_000,
          pendingBytes: 800_000,
          pendingMessages: 4,
          messageType: 'event',
          pendingMessageType: 'event',
          messageIdFamily: 'runtime-event',
          pendingMessageIdFamily: 'runtime-event',
        },
      })}`,
      `I/ReactNativeJS (123): ${JSON.stringify({
        category: 'automation.connection',
        event: 'connection.closed',
        level: 'info',
        data: {sessionId: 'runtime-session-123', code: 1000, reasonCode: 'WINDOW_LIMIT'},
      })}`,
    ].join('\n');

    const projected = collectAndroidRuntimeFailureDiagnostics(lines);

    expect(projected).toContain('"event":"outbound.window.limit"');
    expect(projected).toContain('"limitReason":"UNACKNOWLEDGED_WINDOW_FULL"');
    expect(projected).toContain('"limitBytes":1048576');
    expect(projected).toContain('"messageBytes":900000');
    expect(projected).toContain('"pendingBytes":800000');
    expect(projected).toContain('"pendingMessages":4');
    expect(projected).toContain('"messageType":"event"');
    expect(projected).toContain('"pendingMessageIdFamily":"runtime-event"');
    expect(projected).toContain('"reasonCode":"WINDOW_LIMIT"');
    expect(projected).not.toContain('secret.example.invalid');
  });
});

describe('Android automation selector diagnostics', () => {
  it('retains selector failure phase and budget without selector arguments or values', () => {
    const line = `W/ReactNativeJS (123): ${JSON.stringify({
      category: 'automation.selector',
      event: 'selector.evaluation.failed',
      level: 'warn',
      data: {
        selectorName: 'kernel.base.runtime.selectRequestExecutionCandidates',
        failureCode: 'SELECTOR_SERIALIZATION_BUDGET_EXCEEDED',
        phase: 'json-validation',
        elapsedMs: 9.25,
        budgetMs: 8,
        argsTuple: ['sensitive-value'],
        selectorValue: 'private-payload',
      },
    })}`;

    const projected = projectAndroidAutomationSelectorFailureLog(line);

    expect(projected).toMatchObject({
      category: 'automation.selector',
      event: 'selector.evaluation.failed',
      selectorName: 'kernel.base.runtime.selectRequestExecutionCandidates',
      failureCode: 'SELECTOR_SERIALIZATION_BUDGET_EXCEEDED',
      phase: 'json-validation',
      elapsedMs: 9.25,
      budgetMs: 8,
    });
    expect(JSON.stringify(projected)).not.toContain('sensitive-value');
    expect(JSON.stringify(projected)).not.toContain('private-payload');
  });
});
