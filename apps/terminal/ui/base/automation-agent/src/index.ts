export {moduleName, moduleKind} from './moduleName';
export {dependencyModuleNames, devDependencyModuleNames} from './dependencies';
export {createAutomationAgentModule} from './application/createAutomationAgentModule';
export type {CreateAutomationAgentModuleInput} from './application/createAutomationAgentModule';
export {createAutomationNodeRegistry} from './foundations/registry/createAutomationNodeRegistry';
export type {
  AutomationNodeRecord,
  AutomationNodeRegistry,
  AutomationNodeRegistryActResult,
  AutomationNodeRegistryEvent,
} from './foundations/registry/createAutomationNodeRegistry';
export {
  AutomationEnvelopeSchema,
  automationMessageTypes,
  parseAutomationEnvelope,
  describeAutomationAddress,
  parseAutomationAgentConfig,
  AutomationAckBodySchema,
  AutomationCommandDispatchBodySchema,
  AutomationHelloBodySchema,
  AutomationRuntimeInfoBodySchema,
  AutomationSelectorReadBodySchema,
  AutomationSelectorSubscribeBodySchema,
  AutomationSelectorUnsubscribeBodySchema,
  AutomationWelcomeBodySchema,
  automationDriverRequestTypes,
  parseAutomationBody,
  parseAutomationDriverRequest,
  AutomationControlFilterSchema,
  ControlsActRequestSchema,
  ControlsBoundsRequestSchema,
  ControlsQueryRequestSchema,
  ControlsSubscribeRequestSchema,
  ControlsUnsubscribeRequestSchema,
} from './foundations/protocol';
export type {
  AutomationEnvelope,
  AutomationHello,
  AutomationMessageType,
  AutomationAgentConfig,
  NormalizedAutomationAgentConfig,
  AutomationDriverRequestType,
  AutomationControlFilter,
} from './foundations/protocol';
