import {createSlice, type PayloadAction} from '@reduxjs/toolkit';
import type {WorkspaceScopeContext} from '../api/generated/operations-edge';

/**
 * App-owned mirror of the owner-confirmed retained data-node selections.
 * It deliberately has no persistence or authorization decisions: the session-entry
 * readback remains the sole truth and every select command is owner revalidated.
 */
export type OperationsScopeContextState = {
  context: WorkspaceScopeContext | null;
};

const initialState: OperationsScopeContextState = {context: null};

const scopeContext = createSlice({
  name: 'operationsScopeContext',
  initialState,
  reducers: {
    replaceOwnerScopeContext: (state, action: PayloadAction<WorkspaceScopeContext | null>) => {
      state.context = action.payload;
    },
    clearOwnerScopeContext: state => {
      state.context = null;
    },
  },
});

export const {replaceOwnerScopeContext, clearOwnerScopeContext} = scopeContext.actions;
export const operationsScopeContextReducer = scopeContext.reducer;
