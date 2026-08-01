import {configureStore} from '@reduxjs/toolkit';
import {operationsApi} from '../api/OperationsApi';

export const operationsStore = configureStore({
  reducer: {[operationsApi.reducerPath]: operationsApi.reducer},
  middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(operationsApi.middleware),
});

export type OperationsRootState = ReturnType<typeof operationsStore.getState>;
