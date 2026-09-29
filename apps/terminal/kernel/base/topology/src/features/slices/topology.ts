import {createSlice, type PayloadAction} from '@reduxjs/toolkit';
import {defineStateRuntimeSlice} from '@catering-v2s/kernel-base-state';
import type {SurfaceForm, TopologyIdentity, TopologyLocator} from '@catering-v2s/kernel-base-contracts';
import type {TopologyHostState} from '@catering-v2s/kernel-base-platform-ports';
import {topologySliceName} from '../../selectors/selectTopologyState';
import type {TopologyState} from '../../types/state';

export type CreateTopologyStateInput = Readonly<{
  readonly nodeId: string;
  readonly displayName: string;
  readonly surfaceForm: SurfaceForm;
}>;

const createInitialState = (input: CreateTopologyStateInput): TopologyState =>
  Object.freeze({
    nodeId: input.nodeId,
    displayName: input.displayName,
    surfaceForm: input.surfaceForm,
    displayCount: null,
    masterLocator: null,
    peerIdentity: null,
    hostAddress: null,
    peerReachable: false,
    peerConnectionRevision: 0,
    hostDesired: false,
    hostReconcileRevision: 0,
    hostActual: 'stopped',
    hostErrorCode: null,
    payloadFailure: null,
    revision: 0,
    repairPending: false,
  });

const topologySlice = createSlice({
  name: topologySliceName,
  // This slice is a reducer/action definition template. Runtime instances
  // replace the seed with the input-specific state in createTopologySlice.
  initialState: createInitialState({
    nodeId: 'topology-action-template',
    displayName: 'topology action template',
    surfaceForm: 'laptop',
  }),
  reducers: {
    setDisplayCount: (state, action: PayloadAction<number | null>): TopologyState => ({
      ...state!,
      displayCount: action.payload,
    }),
    setMasterLocator: (state, action: PayloadAction<TopologyLocator>): TopologyState => ({
      ...state!,
      masterLocator: action.payload,
    }),
    clearMasterLocator: (state): TopologyState => ({
      ...state!,
      masterLocator: null,
      peerIdentity: null,
      peerReachable: false,
    }),
    setHostAddress: (state, action: PayloadAction<NonNullable<TopologyState['hostAddress']>>): TopologyState => ({
      ...state!,
      hostAddress: action.payload,
    }),
    clearHostAddress: (state): TopologyState => ({...state!, hostAddress: null}),
    setPeerIdentity: (state, action: PayloadAction<TopologyIdentity>): TopologyState => ({
      ...state!,
      peerIdentity: action.payload,
    }),
    clearPeerIdentity: (state): TopologyState => ({...state!, peerIdentity: null, peerReachable: false}),
    setPeerReachable: (state, action: PayloadAction<boolean>): TopologyState => ({
      ...state!,
      peerReachable: action.payload,
    }),
    bumpPeerConnectionRevision: (state): TopologyState => ({
      ...state!,
      peerConnectionRevision: state!.peerConnectionRevision + 1,
    }),
    setHostDesired: (state, action: PayloadAction<boolean>): TopologyState => ({
      ...state!,
      hostDesired: action.payload,
      hostReconcileRevision: state!.hostReconcileRevision + 1,
    }),
    setHostStatus: (
      state,
      action: PayloadAction<Readonly<{state: TopologyHostState; errorCode?: string | null}>>,
    ): TopologyState => ({
      ...state!,
      hostActual: action.payload.state,
      hostErrorCode: action.payload.errorCode ?? null,
    }),
    setPayloadFailure: (state, action: PayloadAction<TopologyState['payloadFailure']>): TopologyState => ({
      ...state!,
      payloadFailure: action.payload,
    }),
    clearPayloadFailure: (state): TopologyState => ({...state!, payloadFailure: null}),
    setRepairPending: (state, action: PayloadAction<boolean>): TopologyState => ({
      ...state!,
      repairPending: action.payload,
    }),
    bumpRevision: (state): TopologyState => ({...state!, revision: state!.revision + 1}),
  },
});

export const createTopologySlice = (input: CreateTopologyStateInput) => {
  const initialState = createInitialState(input);
  return defineStateRuntimeSlice<TopologyState>({
    name: topologySliceName,
    reducer: (state, action) => topologySlice.reducer(state ?? initialState, action) as TopologyState,
    persistIntent: 'owner-only',
    persistence: [
      {kind: 'field', stateKey: 'nodeId'},
      {kind: 'field', stateKey: 'masterLocator'},
      {kind: 'field', stateKey: 'hostDesired'},
    ],
    syncIntent: 'isolated',
  });
};

export const topologyActions = topologySlice.actions;
