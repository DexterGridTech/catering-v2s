import type {UnknownAction} from '@reduxjs/toolkit';
import type {
  CreateWorkspaceActionDispatcherInput,
  ToWorkspaceStateDescriptorsInput,
  WorkspaceKey,
  WorkspaceRouteContext,
  WorkspaceStateKeys,
} from '../types/workspace';
import type {StateRuntimeSliceRegistration} from '../types/slice';
import {
  createPartitionedActionDispatcher,
  createPartitionedStateKeys,
  toPartitionedStateDescriptors,
} from './partitioned';

const isWorkspaceKey = (value: unknown): value is WorkspaceKey => value === 'MAIN' || value === 'BRANCH';

const requireWorkspaceRouteContext = (routeContext: WorkspaceRouteContext | null | undefined): WorkspaceKey => {
  const workspace = routeContext?.workspace;
  if (!workspace) {
    throw new Error('[createWorkspaceActionDispatcher] routeContext.workspace is required');
  }
  if (!isWorkspaceKey(workspace)) {
    throw new Error(`[createWorkspaceActionDispatcher] invalid routeContext.workspace: ${String(workspace)}`);
  }
  return workspace;
};

const requireActionType = (action: UnknownAction): string => {
  const actionType = action?.type;
  if (typeof actionType !== 'string') {
    throw new Error(`[createWorkspaceActionDispatcher] invalid action type: ${String(actionType)}`);
  }
  const slashIndex = actionType.lastIndexOf('/');
  if (slashIndex <= 0 || slashIndex === actionType.length - 1) {
    throw new Error(`[createWorkspaceActionDispatcher] invalid action type: ${actionType}`);
  }
  return actionType;
};

export const createWorkspaceStateKeys = (baseName: string): WorkspaceStateKeys => {
  if (typeof baseName !== 'string' || baseName.trim().length === 0) {
    throw new Error('[createWorkspaceStateKeys] baseName is required');
  }
  return createPartitionedStateKeys(baseName, ['MAIN', 'BRANCH']);
};

export const createWorkspaceActionDispatcher = (
  input: CreateWorkspaceActionDispatcherInput,
): ((action: UnknownAction) => unknown) => {
  const workspace = requireWorkspaceRouteContext(input.routeContext);
  if (typeof input.dispatch !== 'function') {
    throw new Error('[createWorkspaceActionDispatcher] dispatch is required');
  }

  const dispatchPartitioned = createPartitionedActionDispatcher<WorkspaceKey, UnknownAction>({
    selectPartition: () => workspace,
    dispatch: input.dispatch,
  });

  return (action: UnknownAction): unknown => {
    const actionType = requireActionType(action);
    const slashIndex = actionType.lastIndexOf('/');
    const sliceType = actionType.slice(0, slashIndex);
    const actionName = actionType.slice(slashIndex + 1);
    return dispatchPartitioned(partition => ({
      ...action,
      type: `${sliceType}.${partition}/${actionName}`,
    }));
  };
};

export const toWorkspaceStateDescriptors = <TState extends object>(
  input: ToWorkspaceStateDescriptorsInput<TState>,
): readonly StateRuntimeSliceRegistration[] => {
  if (typeof input.createDescriptor !== 'function') {
    throw new Error('[toWorkspaceStateDescriptors] createDescriptor is required');
  }
  const keys = createWorkspaceStateKeys(input.baseName);
  const workspaces: readonly WorkspaceKey[] = ['MAIN', 'BRANCH'];
  return toPartitionedStateDescriptors({
    keys: workspaces,
    stateKeys: keys,
    createDescriptor: (workspace, stateKey) => {
      const reducer = input.reducers?.[workspace];
      if (typeof reducer !== 'function') {
        throw new Error(`[toWorkspaceStateDescriptors] reducer is required for ${workspace}`);
      }
      const descriptor = input.createDescriptor(workspace, stateKey, reducer);
      if (descriptor.name !== stateKey) {
        throw new Error(`[toWorkspaceStateDescriptors] descriptor name mismatch for ${workspace}`);
      }
      return descriptor;
    },
  });
};
