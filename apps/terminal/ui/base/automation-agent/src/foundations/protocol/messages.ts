import * as z from 'zod/mini';
import {
  ControlsActRequestSchema,
  ControlsBoundsRequestSchema,
  ControlsQueryRequestSchema,
  ControlsSubscribeRequestSchema,
  ControlsUnsubscribeRequestSchema,
} from './controls';
import type {AutomationMessageType} from './envelope';

const identifier = z.string().check(z.minLength(1), z.maxLength(160));
const routeContext = z.nullable(
  z.strictObject({
    workspace: z.optional(z.enum(['MAIN', 'BRANCH'])),
    instanceMode: z.optional(z.enum(['MASTER', 'SLAVE'])),
    displayMode: z.optional(z.enum(['PRIMARY', 'SECONDARY'])),
  }),
);

export const AutomationHelloBodySchema = z.strictObject({
  sessionToken: z.string().check(z.minLength(1)),
  runtimeId: identifier,
  localNodeId: identifier,
  appName: identifier,
  buildVersion: identifier,
});

export const AutomationWelcomeBodySchema = z.strictObject({
  accepted: z.literal(true),
  ackMessageId: identifier,
});

export const AutomationAckBodySchema = z.strictObject({ackMessageId: identifier});

export const AutomationRuntimeInfoBodySchema = z.union([z.null(), z.strictObject({})]);
export const AutomationSelectorReadBodySchema = z.strictObject({
  selectorName: identifier,
  argsTuple: z.array(z.unknown()),
});
export const AutomationSelectorSubscribeBodySchema = z.strictObject({
  subscriptionId: identifier,
  selectorName: identifier,
  argsTuple: z.array(z.unknown()),
});
export const AutomationSelectorUnsubscribeBodySchema = z.strictObject({subscriptionId: identifier});
export const AutomationCommandDispatchBodySchema = z.strictObject({
  commandName: identifier,
  payload: z.unknown(),
  requestId: z.optional(identifier),
  routeContext: z.optional(routeContext),
  routeIntent: z.optional(z.literal('peer-intent')),
  target: z.optional(z.enum(['local', 'peer'])),
});

export const automationDriverRequestTypes = [
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
] as const;
export type AutomationDriverRequestType = (typeof automationDriverRequestTypes)[number];

const requestBodySchemas = {
  'runtime.info': AutomationRuntimeInfoBodySchema,
  'selector.read': AutomationSelectorReadBodySchema,
  'selector.subscribe': AutomationSelectorSubscribeBodySchema,
  'selector.unsubscribe': AutomationSelectorUnsubscribeBodySchema,
  'command.dispatch': AutomationCommandDispatchBodySchema,
  'controls.query': ControlsQueryRequestSchema,
  'controls.subscribe': ControlsSubscribeRequestSchema,
  'controls.unsubscribe': ControlsUnsubscribeRequestSchema,
  'controls.bounds': ControlsBoundsRequestSchema,
  'controls.act': ControlsActRequestSchema,
} as const;

export const parseAutomationBody = (type: AutomationMessageType, value: unknown): unknown => {
  const schema =
    type === 'hello'
      ? AutomationHelloBodySchema
      : type === 'welcome'
        ? AutomationWelcomeBodySchema
        : type === 'ack'
          ? AutomationAckBodySchema
          : type in requestBodySchemas
            ? requestBodySchemas[type as AutomationDriverRequestType]
            : undefined;
  if (schema === undefined) return value;
  const parsed = schema.safeParse(value);
  if (parsed.success) return parsed.data;
  throw new Error(`AUTOMATION_PROTOCOL_INVALID_BODY:${type}`);
};

export const parseAutomationDriverRequest = (type: AutomationDriverRequestType, value: unknown): unknown =>
  parseAutomationBody(type, value);
