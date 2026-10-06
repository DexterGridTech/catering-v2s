import * as z from 'zod/mini';

const identifier = z.string().check(z.minLength(1), z.maxLength(160));
const revision = z.number().check(z.int(), z.gte(0));

export const AutomationControlFilterSchema = z.strictObject({
  testID: z.optional(identifier),
  surface: z.optional(z.enum(['HOST', 'PRIMARY', 'SECONDARY'])),
  displayIndex: z.optional(z.nullable(z.number().check(z.int(), z.gte(0)))),
  role: z.optional(identifier),
  label: z.optional(z.string().check(z.maxLength(512))),
});

export const ControlsQueryRequestSchema = z.strictObject({filter: AutomationControlFilterSchema});
export const ControlsSubscribeRequestSchema = z.strictObject({
  subscriptionId: identifier,
  filter: AutomationControlFilterSchema,
});
export const ControlsUnsubscribeRequestSchema = z.strictObject({subscriptionId: identifier});
export const ControlsBoundsRequestSchema = z.strictObject({nodeInstanceId: identifier, layoutRevision: revision});
export const ControlsActRequestSchema = z.strictObject({
  nodeInstanceId: identifier,
  layoutRevision: revision,
  action: z.enum(['press', 'changeText']),
  value: z.optional(z.string().check(z.maxLength(4096))),
});

export type AutomationControlFilter = z.infer<typeof AutomationControlFilterSchema>;
