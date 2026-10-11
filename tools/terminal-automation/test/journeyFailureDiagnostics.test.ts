import {afterEach, describe, expect, it, vi} from 'vitest';
import {createJourneyFailureDiagnostics} from '../src/journeyFailureDiagnostics.js';

afterEach(() => vi.unstubAllEnvs());

describe('journey failure diagnostics', () => {
  it('reports the current step, request identity, and whitelisted push metadata without payloads', () => {
    vi.stubEnv('TERMINAL_AUTOMATION_RUN_ID', 'run-diagnostic-1');
    const listener = vi.fn();
    const line = vi.fn();
    const diagnostics = createJourneyFailureDiagnostics({
      server: {onMessage: (_sessionId: string, next: (message: never) => void) => {
        listener.mockImplementation(next);
        return () => undefined;
      }} as never,
      sessionId: 'session-1',
      write: line,
    });

    diagnostics.markStep('kernel.feature.sample-staff-session.login');
    diagnostics.requestStarted('request-1');
    listener({
      type: 'event',
      body: {
        requestId: 'request-1',
        sequence: 2,
        event: {kind: 'actor.started', commandId: 'command-1', actorKey: 'sample.actor', payload: 'secret-payload'},
        value: {phone: '01012345678', passcode: '1111'},
      },
    });
    diagnostics.report(new Error('TERMINAL_AUTOMATION_SELECTOR_FAILED raw-sensitive-value'));

    const report = line.mock.calls.map(call => call[0] as string).find(value => value.includes('TERMINAL_AUTOMATION_JOURNEY_FAILURE'));
    expect(report).toBeDefined();
    expect(report).toContain('TERMINAL_AUTOMATION_JOURNEY_FAILURE');
    expect(report).toContain('kernel.feature.sample-staff-session.login');
    expect(report).toContain('request-1');
    expect(report).toContain('actor.started');
    expect(report).toContain('NOT_SAVED_REDACTION_UNAVAILABLE');
    expect(report).not.toContain('secret-payload');
    expect(report).not.toContain('01012345678');
    expect(report).not.toContain('1111');
    expect(report).not.toContain('raw-sensitive-value');
    const json = report?.slice('TERMINAL_AUTOMATION_JOURNEY_FAILURE '.length) ?? '';
    const parsed = JSON.parse(json) as {at?: unknown; runId?: unknown};
    expect(parsed.runId).toBe('run-diagnostic-1');
    expect(typeof parsed.at).toBe('string');
    expect(new Date(parsed.at as string).toISOString()).toBe(parsed.at);
    diagnostics.close();
  });

  it('removes a request from the pending context after its terminal result', () => {
    const line = vi.fn();
    const diagnostics = createJourneyFailureDiagnostics({
      server: {onMessage: () => () => undefined} as never,
      sessionId: 'session-1',
      write: line,
    });
    diagnostics.requestStarted('request-1');
    diagnostics.requestFinished('request-1');
    diagnostics.report(new Error('TERMINAL_AUTOMATION_FAILED'));
    expect(line.mock.calls.map(call => call[0] as string).at(-1)).toContain('"inProgressRequestIds":[]');
    diagnostics.close();
  });

  it('records actual selector push metadata without serializing the selector value', () => {
    const listener = vi.fn();
    const line = vi.fn();
    const diagnostics = createJourneyFailureDiagnostics({
      server: {onMessage: (_sessionId: string, next: (message: never) => void) => {
        listener.mockImplementation(next);
        return () => undefined;
      }} as never,
      sessionId: 'session-1',
      write: line,
    });

    listener({
      type: 'event',
      body: {
        subscriptionId: 'sub-1',
        sequence: 7,
        valueState: 'JSON',
        value: {phone: '01012345678', memberName: 'sensitive'},
      },
    });
    diagnostics.report(new Error('TERMINAL_AUTOMATION_SELECTOR_FAILED'));

    const report = line.mock.calls.map(call => call[0] as string).find(value => value.includes('TERMINAL_AUTOMATION_JOURNEY_FAILURE'));
    expect(report).toBeDefined();
    expect(report).toContain('"subscriptionId":"sub-1"');
    expect(report).toContain('"sequence":7');
    expect(report).toContain('"selectorValueState":"JSON"');
    expect(report).not.toContain('01012345678');
    expect(report).not.toContain('sensitive');
    diagnostics.close();
  });

  it('writes safe progress immediately for steps, requests, and selector changes', () => {
    const listener = vi.fn();
    const line = vi.fn();
    const diagnostics = createJourneyFailureDiagnostics({
      server: {onMessage: (_sessionId: string, next: (message: never) => void) => {
        listener.mockImplementation(next);
        return () => undefined;
      }} as never,
      sessionId: 'session-1',
      write: line,
    });

    diagnostics.markStep('terminal-update.apply');
    diagnostics.requestStarted('request-1');
    listener({
      type: 'event',
      body: {
        requestId: 'request-1',
        sequence: 4,
        selectorName: 'terminal-update.selectStatus',
        subscriptionId: 'sub-1',
        valueState: 'JSON',
        value: {taskId: 'private-task', status: 'succeeded'},
      },
    });
    diagnostics.requestFinished('request-1');

    const output = line.mock.calls.map(call => call[0] as string).join('\n');
    expect(output).toContain('step.started');
    expect(output).toContain('request.observer.started');
    expect(output).toContain('runtime.push');
    expect(output).toContain('request.observer.finished');
    expect(output).toContain('terminal-update.selectStatus');
    expect(output).toContain('"sequence":4');
    expect(output).not.toContain('private-task');
    expect(output).not.toContain('succeeded');
    diagnostics.close();
  });
});
