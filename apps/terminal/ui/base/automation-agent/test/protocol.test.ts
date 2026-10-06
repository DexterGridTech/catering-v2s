import {describe, expect, it} from 'vitest';
import {
  AutomationAckBodySchema,
  AutomationCommandDispatchBodySchema,
  AutomationEnvelopeSchema,
  AutomationHelloBodySchema,
  AutomationSelectorReadBodySchema,
  AutomationWelcomeBodySchema,
  parseAutomationAgentConfig,
  parseAutomationDriverRequest,
  parseAutomationEnvelope,
} from '../src/foundations/protocol';

describe('automation protocol and endpoint configuration', () => {
  it('accepts a closed v1 envelope and rejects unknown fields and methods', () => {
    const valid = {protocolVersion: 1, sessionId: 's1', messageId: 'm1', type: 'hello', body: {}};
    expect(parseAutomationEnvelope(valid)).toEqual(valid);
    expect(() => parseAutomationEnvelope({...valid, secret: 'unexpected'})).toThrow(
      'AUTOMATION_PROTOCOL_INVALID_ENVELOPE',
    );
    expect(AutomationEnvelopeSchema.safeParse({...valid, type: 'eval'}).success).toBe(false);
    expect(parseAutomationEnvelope({...valid, type: 'ack', body: {ackMessageId: 'agent-1'}}).type).toBe('ack');
  });

  it('shares strict body schemas for handshake and Runtime requests', () => {
    const hello = {
      sessionToken: 'secret',
      runtimeId: 'runtime-1',
      localNodeId: 'node-1',
      appName: 'sample-terminal',
      buildVersion: 'build-1',
    };
    expect(AutomationHelloBodySchema.safeParse(hello).success).toBe(true);
    expect(AutomationHelloBodySchema.safeParse({...hello, extra: true}).success).toBe(false);
    expect(AutomationWelcomeBodySchema.safeParse({accepted: true, ackMessageId: 'hello-1'}).success).toBe(true);
    expect(AutomationWelcomeBodySchema.safeParse({accepted: true, ackMessageId: 'hello-1', extra: true}).success).toBe(
      false,
    );
    expect(AutomationAckBodySchema.safeParse({ackMessageId: 'message-1'}).success).toBe(true);
    expect(AutomationAckBodySchema.safeParse({ackMessageId: 'message-1', extra: true}).success).toBe(false);
    expect(AutomationSelectorReadBodySchema.safeParse({selectorName: 'runtime.value', argsTuple: []}).success).toBe(
      true,
    );
    expect(
      AutomationSelectorReadBodySchema.safeParse({selectorName: 'runtime.value', argsTuple: [], extra: true}).success,
    ).toBe(false);
    expect(AutomationCommandDispatchBodySchema.safeParse({commandName: 'sample.run', payload: {}}).success).toBe(true);
    expect(
      AutomationCommandDispatchBodySchema.safeParse({
        commandName: 'sample.run',
        payload: {},
        routeContext: {workspace: 'MAIN', extra: true},
      }).success,
    ).toBe(false);
  });

  it('rejects invalid driver request bodies before transport dispatch', () => {
    expect(() =>
      parseAutomationDriverRequest('selector.read', {selectorName: 'x', argsTuple: [], extra: true}),
    ).toThrow('AUTOMATION_PROTOCOL_INVALID_BODY:selector.read');
    expect(() => parseAutomationDriverRequest('command.dispatch', {commandName: 'x', payload: {}})).not.toThrow();
    expect(() => parseAutomationDriverRequest('controls.query', {filter: {}})).not.toThrow();
  });

  it('requires an explicit token and wss for non-loopback hosts without disclosing the URL secrets', () => {
    expect(() => parseAutomationAgentConfig({enabled: true, url: 'ws://127.0.0.1:19090', sessionToken: ''})).toThrow(
      'AUTOMATION_CONFIG_TOKEN_REQUIRED',
    );
    expect(() =>
      parseAutomationAgentConfig({enabled: true, url: 'ws://remote.example/path', sessionToken: 'secret'}),
    ).toThrow('AUTOMATION_CONFIG_REMOTE_REQUIRES_WSS');
    expect(() =>
      parseAutomationAgentConfig({
        enabled: true,
        url: 'wss://user:password@example.test/agent?token=x',
        sessionToken: 'secret',
      }),
    ).toThrow('AUTOMATION_CONFIG_URL_SECRET_FORBIDDEN');
    const accepted = parseAutomationAgentConfig({
      enabled: true,
      url: 'wss://example.test/automation',
      sessionToken: 'secret',
    });
    expect(accepted.addressDescription).toBe('wss://REMOTE_HOST/automation');
    expect(accepted.addressDescription).not.toContain('secret');
    expect(
      parseAutomationAgentConfig({enabled: true, url: 'ws://127.0.0.1:19090/automation', sessionToken: 'test-token'})
        .url,
    ).toBe('ws://127.0.0.1:19090/automation');
    expect(
      parseAutomationAgentConfig({enabled: false, url: 'ws://localhost:19090', sessionToken: ''}).addressDescription,
    ).toBe('DISABLED');
  });
});
