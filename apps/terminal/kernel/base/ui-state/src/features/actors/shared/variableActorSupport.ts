import {createWorkspaceActionDispatcher, type WorkspaceKey} from '@catering-v2s/kernel-base-state';
import {selectRuntimeInstanceMode, type ActorExecutionContext} from '@catering-v2s/kernel-base-runtime';
import {resolveWorkspace, selectDisplayRole} from '@catering-v2s/kernel-base-display-context';
import {readVariableState, type VariableStateFamily} from '../../../foundations/variableSlices';
type PayloadRecord = Readonly<Record<string, unknown>>;

const readRecord = (value: unknown): PayloadRecord | undefined =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as PayloadRecord) : undefined;

const requireRecord = (value: unknown, commandName: string): PayloadRecord => {
  const record = readRecord(value);
  if (record === undefined) throw new Error(`[ui-state] ${commandName} payload must be an object`);
  return record;
};

const requireExactKeys = (value: object, keys: readonly string[], label: string): void => {
  const actual = Reflect.ownKeys(value);
  if (actual.length !== keys.length || keys.some(key => !actual.includes(key))) {
    throw new Error(`[ui-state] ${label} fields are invalid`);
  }
};

const currentWorkspace = (context: ActorExecutionContext): WorkspaceKey => {
  const state = context.getState();
  return resolveWorkspace({
    instanceMode: selectRuntimeInstanceMode(state),
    displayRole: selectDisplayRole(state),
  });
};

type VariableAction =
  | ReturnType<VariableStateFamily['actions']['setUiVariables']>
  | ReturnType<VariableStateFamily['actions']['clearUiVariables']>;

const dispatchVariableAction = (
  context: ActorExecutionContext,
  family: VariableStateFamily,
  action: VariableAction,
): Readonly<{readonly workspace: WorkspaceKey; readonly changed: boolean}> => {
  const workspace = currentWorkspace(context);
  const before = readVariableState(context.getState(), family.stateKeys, workspace);
  const dispatch = createWorkspaceActionDispatcher({
    routeContext: {workspace},
    dispatch: context.dispatchAction,
  });
  dispatch(action);
  const after = readVariableState(context.getState(), family.stateKeys, workspace);
  return Object.freeze({workspace, changed: after !== before});
};

export default Object.freeze({dispatchVariableAction, readRecord, requireExactKeys, requireRecord});
