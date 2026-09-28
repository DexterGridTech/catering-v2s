import type {Reducer, UnknownAction} from '@reduxjs/toolkit';
import type {StateRuntimeSliceDescriptor, StateRuntimeSliceRegistration} from './slice';

export type WorkspaceKey = 'MAIN' | 'BRANCH';

export interface WorkspaceStateKeys {
  readonly MAIN: string;
  readonly BRANCH: string;
}

export interface WorkspaceRouteContext {
  readonly workspace: WorkspaceKey;
}

export interface CreateWorkspaceActionDispatcherInput {
  readonly routeContext: WorkspaceRouteContext;
  readonly dispatch: (action: UnknownAction) => unknown;
}

export interface ToWorkspaceStateDescriptorsInput<TState extends object> {
  readonly baseName: string;
  readonly reducers: Readonly<Record<WorkspaceKey, Reducer<TState>>>;
  readonly createDescriptor: (
    workspace: WorkspaceKey,
    sliceName: string,
    reducer: Reducer<TState>,
  ) => StateRuntimeSliceDescriptor<TState>;
}
