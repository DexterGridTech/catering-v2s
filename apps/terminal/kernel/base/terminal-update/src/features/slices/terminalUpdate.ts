import {createSlice, type PayloadAction} from '@reduxjs/toolkit';
import {defineStateRuntimeSlice} from '@catering-v2s/kernel-base-state';
import {moduleName} from '../../moduleName';
import type {TerminalUpdateRecentStatus, TerminalUpdateState, TerminalUpdateTask} from '../../types/terminalUpdate';

export const terminalUpdateSliceName = `${moduleName}.state` as const;
const initialState: TerminalUpdateState = Object.freeze({
  ruleSnapshot: Object.freeze({contextIdentity: null, selectedSpace: null, projectRef: null,
    collectionHash: null, items: Object.freeze([])}),
  ruleSnapshotStatus: Object.freeze({status: 'empty', errorCode: null}),
  currentTask: null,
  recentStatus: Object.freeze({taskId: null, state: 'idle', reason: null, changedAt: 0 as never,
    applicationId: null, ruleRef: null, fullArtifactRef: null, hotArtifactRef: null}),
  failedArtifactIds: Object.freeze([]),
  actualVersions: null,
  reportDescriptor: Object.freeze({
    bindingIdentity: null,
    contextIdentity: null,
    nextReportSequence: 1,
    pendingReports: Object.freeze({}),
    sendPaused: false,
    latestDeliveryFailure: null,
  }),
});

const definition = createSlice({
  name: terminalUpdateSliceName,
  initialState,
  reducers: {
    replaceRuleSnapshot: (
      state,
      action: PayloadAction<TerminalUpdateState['ruleSnapshot']>,
    ): TerminalUpdateState => ({...state, ruleSnapshot: action.payload}),
    replaceRuleSnapshotStatus: (
      state,
      action: PayloadAction<TerminalUpdateState['ruleSnapshotStatus']>,
    ): TerminalUpdateState => ({...state, ruleSnapshotStatus: action.payload}),
    replaceTask: (state, action: PayloadAction<TerminalUpdateTask | null>): TerminalUpdateState => ({
      ...state,
      currentTask: action.payload,
    }),
    replaceRecentStatus: (state, action: PayloadAction<TerminalUpdateRecentStatus>): TerminalUpdateState => ({
      ...state,
      recentStatus: action.payload,
    }),
    replaceFailedArtifactIds: (state, action: PayloadAction<readonly string[]>): TerminalUpdateState => ({
      ...state,
      failedArtifactIds: Object.freeze([...action.payload]),
    }),
    replaceActualVersions: (
      state,
      action: PayloadAction<TerminalUpdateState['actualVersions']>,
    ): TerminalUpdateState => ({...state, actualVersions: action.payload}),
    replaceReportDescriptor: (
      state,
      action: PayloadAction<TerminalUpdateState['reportDescriptor']>,
    ): TerminalUpdateState => ({...state, reportDescriptor: action.payload}),
  },
});

export const terminalUpdateRegistration = defineStateRuntimeSlice<TerminalUpdateState>({
  name: terminalUpdateSliceName,
  reducer: definition.reducer,
  persistIntent: 'owner-only',
  resetIntent: 'retain',
  persistence: [
    {kind: 'field', stateKey: 'ruleSnapshot', protection: 'plain', flushMode: 'immediate'},
    {kind: 'field', stateKey: 'currentTask', protection: 'plain', flushMode: 'immediate'},
    {kind: 'field', stateKey: 'recentStatus', protection: 'plain', flushMode: 'immediate'},
    {kind: 'field', stateKey: 'failedArtifactIds', protection: 'plain', flushMode: 'immediate'},
    {kind: 'field', stateKey: 'reportDescriptor', protection: 'plain', flushMode: 'immediate'},
  ],
  syncIntent: 'isolated',
});

export const terminalUpdateActions = definition.actions;
