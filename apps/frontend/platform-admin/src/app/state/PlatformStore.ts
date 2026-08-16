import {configureStore} from '@reduxjs/toolkit';
import {platformApi} from '../api/PlatformApi';

export const platformStore = configureStore({
  reducer: {[platformApi.reducerPath]: platformApi.reducer},
  middleware: getDefaultMiddleware => getDefaultMiddleware().concat(platformApi.middleware),
});

export type PlatformRootState = ReturnType<typeof platformStore.getState>;
