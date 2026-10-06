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
export * from './foundations/protocol';
