import type {RuntimeStatus} from '@catering-v2s/kernel-base-runtime';
import type {RenderProviderProps} from '../types/props';

type RuntimeStateRoot = ReturnType<RenderProviderProps['stateSource']['getState']>;

export type RenderSnapshot = Readonly<{
  readonly status: RuntimeStatus;
  readonly root: RuntimeStateRoot | undefined;
}>;

export type RenderSnapshotReader = Readonly<{
  readonly getSnapshot: () => RenderSnapshot;
}>;

export const createRenderSnapshotReader = (stateSource: RenderProviderProps['stateSource']): RenderSnapshotReader => {
  let unavailableSnapshot: RenderSnapshot | undefined;
  let startedRoot: RuntimeStateRoot | undefined;
  let startedSnapshot: RenderSnapshot | undefined;

  const getSnapshot = (): RenderSnapshot => {
    const status = stateSource.getStatus();
    if (status !== 'started') {
      if (unavailableSnapshot?.status === status) return unavailableSnapshot;
      unavailableSnapshot = Object.freeze({status, root: undefined});
      return unavailableSnapshot;
    }

    const root = stateSource.getState();
    if (startedSnapshot !== undefined && startedRoot === root) return startedSnapshot;
    startedRoot = root;
    startedSnapshot = Object.freeze({status, root});
    return startedSnapshot;
  };

  return Object.freeze({getSnapshot});
};
