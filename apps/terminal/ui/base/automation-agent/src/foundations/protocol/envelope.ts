import * as z from 'zod/mini';

const identifier = z.string().check(z.minLength(1), z.maxLength(160));

export const automationMessageTypes = [
  'hello',
  'welcome',
  'error',
  'runtime.info',
  'selector.read',
  'selector.subscribe',
  'selector.unsubscribe',
  'command.dispatch',
  'controls.query',
  'controls.subscribe',
  'controls.unsubscribe',
  'controls.bounds',
  'controls.act',
  'response',
  'event',
  'ack',
] as const;

export const AutomationEnvelopeSchema = z.strictObject({
  protocolVersion: z.literal(1),
  sessionId: identifier,
  messageId: identifier,
  type: z.enum(automationMessageTypes),
  body: z.unknown(),
});

export type AutomationMessageType = (typeof automationMessageTypes)[number];
export type AutomationEnvelope = Readonly<{
  readonly protocolVersion: 1;
  readonly sessionId: string;
  readonly messageId: string;
  readonly type: AutomationMessageType;
  readonly body: unknown;
}>;

export type AutomationHello = Readonly<{
  readonly protocolVersion: 1;
  readonly sessionId: string;
  readonly messageId: string;
  readonly type: 'hello';
  readonly body: Readonly<{
    readonly sessionToken: string;
    readonly runtimeId: string;
    readonly localNodeId: string;
    readonly appName: string;
    readonly buildVersion: string;
  }>;
}>;

export const parseAutomationEnvelope = (value: unknown): AutomationEnvelope => {
  const parsed = AutomationEnvelopeSchema.safeParse(value);
  if (!parsed.success) throw new Error('AUTOMATION_PROTOCOL_INVALID_ENVELOPE');
  return parsed.data;
};
