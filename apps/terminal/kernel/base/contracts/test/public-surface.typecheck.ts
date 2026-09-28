import {
  createAppError,
  createCommandId,
  createConnectionId,
  createDispatchId,
  createEnvelopeId,
  createModuleErrorFactory,
  createModuleParameterFactory,
  createNodeId,
  createProjectionId,
  createRequestId,
  createRuntimeId,
  createRuntimeInstanceId,
  createSessionId,
  dependencyModuleNames,
  devDependencyModuleNames,
  isAppError,
  listDefinitions,
  moduleName,
  nowTimestampMs,
  renderErrorTemplate,
  runtimeIdPrefixes,
  type AppError,
  type AppModule,
  type AppModuleActorDescriptor,
  type AppModuleCommandDescriptor,
  type AppModuleDependency,
  type AppModuleKind,
  type AppModuleSliceDescriptor,
  type CommandId,
  type CommandLifecycleStatus,
  type CommandResultPatch,
  type CommandResultSnapshot,
  type CommandRouteContext,
  type ConnectionId,
  type CreateAppErrorContext,
  type CreateAppErrorInput,
  type DefineErrorInput,
  type DefineParameterInput,
  type DispatchId,
  type EnvelopeId,
  type ErrorCategory,
  type ErrorDefinition,
  type ErrorSeverity,
  type ErrorTemplateArguments,
  type ErrorTemplateValue,
  type ModuleErrorFactory,
  type ModuleParameterFactory,
  type NodeId,
  type ParameterDefinition,
  type ParameterDescriptor,
  type ParameterValueType,
  type ProjectionId,
  type RenderedErrorTemplate,
  type RequestCommandSnapshot,
  type RequestId,
  type RequestLifecycleSnapshot,
  type RequestLifecycleStatus,
  type ResolveTransportServerConfigOptions,
  type RuntimeIdKind,
  type RuntimeInstanceId,
  type SessionId,
  type TimestampMs,
  type TransportRequestContext,
  type TransportServerAddress,
  type TransportServerAddressOverride,
  type TransportServerConfig,
  type TransportServerConfigSpace,
  type TransportServerDefinition,
  type TransportServerOverride,
} from '@catering-v2s/kernel-base-contracts';

const appModuleWithoutPackageVersion: AppModule = {
  moduleName: 'kernel.base.contracts',
  kind: 'toolkit',
};

const requestId = createRequestId();
const commandId = createCommandId();
const acceptsCommandId = (_value: CommandId): void => undefined;
acceptsCommandId(commandId);
// @ts-expect-error F-2: brands from different ID kinds must not be interchangeable.
acceptsCommandId(requestId);

const timestamp = nowTimestampMs();
const nodeId = createNodeId();
const requestStatuses: readonly RequestLifecycleStatus[] = [
  'started',
  'completed',
  'partial-failed',
  'timed-out',
  'error',
];
// @ts-expect-error C-1: request status must stay inside the five-state closed union.
const invalidRequestStatus: RequestLifecycleStatus = 'accepted';
// @ts-expect-error C-1: command lifecycle status is the historical six-state per-command status, not the request aggregate.
const commandStatusAsRequestStatus: RequestLifecycleStatus = 'registered' satisfies CommandLifecycleStatus;

const lifecycleSnapshot: RequestLifecycleSnapshot<{readonly receiptId: string}> = {
  requestId,
  ownerNodeId: nodeId,
  rootCommandId: commandId,
  status: 'started',
  startedAt: timestamp,
  updatedAt: timestamp,
  commands: [],
  commandResults: [],
};
const routeContext: CommandRouteContext = {workspace: 'MAIN', instanceMode: 'MASTER', displayMode: 'PRIMARY'};
// @ts-expect-error C-2: workspace route is a closed local enum.
const invalidRouteWorkspace: CommandRouteContext = {workspace: 'store-01'};
// @ts-expect-error C-2: instanceMode route is a closed local enum.
const invalidRouteInstanceMode: CommandRouteContext = {instanceMode: 'primary'};
// @ts-expect-error C-2: displayMode route is a closed local enum.
const invalidRouteDisplayMode: CommandRouteContext = {displayMode: 'LEFT'};
const transportConfig: TransportServerConfig = {
  selectedSpace: 'default',
  spaces: [
    {
      name: 'default',
      servers: [{serverName: 'tdp', addresses: [{addressName: 'primary', baseUrl: 'https://example.invalid'}]}],
    },
  ],
};
const appError: AppError<{readonly itemId: string}> = {
  name: 'Missing',
  message: 'item A-1 is missing',
  key: 'catalog.missing',
  code: 'CATALOG_MISSING',
  category: 'BUSINESS',
  severity: 'MEDIUM',
  createdAt: timestamp,
  args: {itemId: 'A-1'},
  templateMissingKeys: [],
};
const parameterDefinition: ParameterDefinition<string> = {
  key: 'terminal.locale',
  name: 'Locale',
  defaultValue: 'en-US',
  valueType: 'string',
  validate: (value: unknown): value is string => typeof value === 'string',
};

type ItemArguments = Readonly<{itemId: string}>;
const typedError: AppError<ItemArguments> = appError;
const typedErrorInput: CreateAppErrorInput<ItemArguments> = {args: {itemId: 'A-1'}};
renderErrorTemplate<ItemArguments>('item ${itemId}', {itemId: 'A-1'});
// @ts-expect-error F-4: AppError args must preserve the declared value type.
const invalidTypedError: AppError<ItemArguments> = {...appError, args: {itemId: 1}};
// @ts-expect-error F-4: CreateAppErrorInput args must preserve the declared value type.
const invalidTypedErrorInput: CreateAppErrorInput<ItemArguments> = {args: {itemId: 1}};
// @ts-expect-error F-4: renderErrorTemplate args must preserve the declared value type.
renderErrorTemplate<ItemArguments>('item ${itemId}', {itemId: 1});

const resultPatch: CommandResultPatch<{readonly receiptId: string}> = {
  commandId,
  result: {receiptId: 'R-1'},
  patchedAt: timestamp,
};
const resultSnapshot: CommandResultSnapshot<{readonly receiptId: string}> = {
  commandId,
  result: {receiptId: 'R-1'},
};
const requestCommandSnapshot: RequestCommandSnapshot<{readonly receiptId: string}> = {
  commandId,
  ownerNodeId: nodeId,
  sourceNodeId: nodeId,
  targetNodeId: nodeId,
  commandName: 'printReceipt',
  status: 'completed',
  result: {receiptId: 'R-1'},
  updatedAt: timestamp,
};
// @ts-expect-error F-4: CommandResultPatch result must preserve its declared object type.
const invalidResultPatch: CommandResultPatch<{readonly receiptId: string}> = {...resultPatch, result: {receiptId: 1}};
const invalidResultSnapshot: CommandResultSnapshot<{readonly receiptId: string}> = {
  ...resultSnapshot,
  // @ts-expect-error F-4: CommandResultSnapshot result must preserve its declared object type.
  result: {receiptId: 1},
};
const invalidRequestCommandSnapshot: RequestCommandSnapshot<{readonly receiptId: string}> = {
  ...requestCommandSnapshot,
  // @ts-expect-error F-4: RequestCommandSnapshot result must preserve its declared object type.
  result: {receiptId: 1},
};

const definitions = {
  text: {key: 'text', value: 'ready'},
  count: {key: 'count', value: 1},
} as const;
const preservedDefinitions = listDefinitions(definitions);
type PreservedDefinition = (typeof preservedDefinitions)[number];
// @ts-expect-error F-4: listDefinitions must retain the value union rather than widen to object.
const invalidPreservedDefinition: PreservedDefinition = {key: 'other', value: false};

void [
  moduleName,
  dependencyModuleNames,
  devDependencyModuleNames,
  runtimeIdPrefixes,
  createRuntimeId,
  createRuntimeInstanceId,
  createRequestId,
  createCommandId,
  createSessionId,
  createNodeId,
  createConnectionId,
  createEnvelopeId,
  createDispatchId,
  createProjectionId,
  nowTimestampMs,
  renderErrorTemplate,
  createAppError,
  isAppError,
  createModuleErrorFactory,
  createModuleParameterFactory,
  listDefinitions,
  appModuleWithoutPackageVersion,
  lifecycleSnapshot,
  routeContext,
  transportConfig,
  appError,
  parameterDefinition,
  typedError,
  typedErrorInput,
  resultPatch,
  resultSnapshot,
  requestCommandSnapshot,
  preservedDefinitions,
  requestStatuses,
];

type PublicTypes = [
  TimestampMs,
  RuntimeInstanceId,
  RequestId,
  CommandId,
  SessionId,
  NodeId,
  ConnectionId,
  EnvelopeId,
  DispatchId,
  ProjectionId,
  RuntimeIdKind,
  ErrorCategory,
  ErrorSeverity,
  ErrorDefinition,
  ErrorTemplateValue,
  ErrorTemplateArguments,
  RenderedErrorTemplate,
  AppError,
  CreateAppErrorContext,
  CreateAppErrorInput,
  ParameterValueType,
  ParameterDefinition,
  ParameterDescriptor,
  DefineErrorInput,
  DefineParameterInput<string>,
  ModuleErrorFactory,
  ModuleParameterFactory,
  AppModuleKind,
  AppModuleDependency,
  AppModuleCommandDescriptor,
  AppModuleActorDescriptor,
  AppModuleSliceDescriptor,
  AppModule,
  CommandLifecycleStatus,
  RequestLifecycleStatus,
  CommandResultPatch,
  CommandResultSnapshot,
  RequestCommandSnapshot,
  RequestLifecycleSnapshot,
  CommandRouteContext,
  TransportRequestContext,
  TransportServerAddress,
  TransportServerDefinition,
  TransportServerConfigSpace,
  TransportServerConfig,
  TransportServerAddressOverride,
  TransportServerOverride,
  ResolveTransportServerConfigOptions,
];

declare const publicTypes: PublicTypes;
void publicTypes;
void invalidTypedError;
void invalidTypedErrorInput;
void invalidResultPatch;
void invalidResultSnapshot;
void invalidRequestCommandSnapshot;
void invalidPreservedDefinition;
void invalidRequestStatus;
void commandStatusAsRequestStatus;
void invalidRouteWorkspace;
void invalidRouteInstanceMode;
void invalidRouteDisplayMode;
