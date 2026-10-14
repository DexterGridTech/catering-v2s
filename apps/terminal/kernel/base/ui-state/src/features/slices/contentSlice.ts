import {createSlice, type PayloadAction, type UnknownAction} from '@reduxjs/toolkit';
import type {DisplayMode} from '@catering-v2s/kernel-base-display-context';
import type {WorkspaceKey} from '@catering-v2s/kernel-base-state';
import type {LayerEntry, ScreenPlacement, UiContentState} from '../../types/content';
import {
  contentStateSliceName,
  createInitialContentState,
  readClearLayersPayload,
  readCloseLayerPayload,
  readOpenLayerPayload,
  readRemoveScreenPayload,
  readShowPayload,
} from '../../foundations/workspaceSlices';

type MutableContentState = {
  contentSets: Record<
    DisplayMode,
    {
      containers: Record<string, ScreenPlacement>;
      layers: LayerEntry[];
    }
  >;
};

type ContentCaseReducers = {
  readonly showScreen: (state: MutableContentState, action: PayloadAction<unknown>) => void;
  readonly removeScreen: (state: MutableContentState, action: PayloadAction<unknown>) => void;
  readonly openLayer: (state: MutableContentState, action: PayloadAction<unknown>) => void;
  readonly closeLayer: (state: MutableContentState, action: PayloadAction<unknown>) => void;
  readonly clearLayers: (state: MutableContentState, action: PayloadAction<unknown>) => void;
};

const reducers: ContentCaseReducers = {
  showScreen: (state, action): void => {
    const payload = readShowPayload(action.payload);
    if (payload === undefined) return;
    state.contentSets[payload.displayMode].containers[payload.containerKey] = payload.placement;
  },
  removeScreen: (state, action): void => {
    const payload = readRemoveScreenPayload(action.payload);
    if (payload === undefined) return;
    delete state.contentSets[payload.displayMode].containers[payload.containerKey];
  },
  openLayer: (state, action): void => {
    const payload = readOpenLayerPayload(action.payload);
    if (payload === undefined) return;
    const contentSet = state.contentSets[payload.displayMode];
    if (contentSet.layers.some(layer => layer.layerId === payload.layer.layerId)) return;
    contentSet.layers.push(payload.layer);
  },
  closeLayer: (state, action): void => {
    const payload = readCloseLayerPayload(action.payload);
    if (payload === undefined) return;
    const contentSet = state.contentSets[payload.displayMode];
    const index = contentSet.layers.findIndex(layer => layer.layerId === payload.layerId);
    if (index < 0) return;
    contentSet.layers.splice(index, 1);
  },
  clearLayers: (state, action): void => {
    const payload = readClearLayersPayload(action.payload);
    if (payload === undefined) return;
    const contentSet = state.contentSets[payload.displayMode];
    contentSet.layers.splice(0, contentSet.layers.length);
  },
};

type GeneratedContentSlice = Readonly<{
  readonly reducer: (state: UiContentState | undefined, action: UnknownAction) => UiContentState;
  readonly actions: Readonly<Record<string, (payload: unknown) => UnknownAction>>;
}>;

type CreateContentSliceInput = Readonly<{
  readonly name: string;
  readonly initialState: UiContentState;
  readonly reducers: ContentCaseReducers;
}>;

const createTypedSlice = createSlice as (input: CreateContentSliceInput) => GeneratedContentSlice;

export const createContentSlice = (name: string): GeneratedContentSlice =>
  createTypedSlice({name, initialState: createInitialContentState(), reducers});

export const createContentWorkspaceSlice = (workspace: WorkspaceKey): GeneratedContentSlice =>
  createContentSlice(contentStateSliceName(workspace));
