import {configureStore} from '@reduxjs/toolkit';
import {operationsApi} from '../api/OperationsApi';
import {operationsScopeContextReducer} from './OperationsScopeContext';

export const operationsStore = configureStore({
  reducer: {
    [operationsApi.reducerPath]: operationsApi.reducer,
    operationsScopeContext: operationsScopeContextReducer,
  },
  middleware: getDefaultMiddleware => getDefaultMiddleware().concat(operationsApi.middleware),
});

export type OperationsRootState = ReturnType<typeof operationsStore.getState>;
