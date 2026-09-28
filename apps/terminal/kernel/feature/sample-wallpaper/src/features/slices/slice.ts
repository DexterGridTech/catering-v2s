import {createSlice, type PayloadAction} from '@reduxjs/toolkit';
import {defineStateRuntimeSlice} from '@catering-v2s/kernel-base-state';
import {moduleName} from '../../moduleName';
import type {WallpaperId, WallpaperState} from '../../types/types';

export const wallpaperSliceName = `${moduleName}.selection` as const;

const initialState: WallpaperState = {
  wallpaperId: 'none',
};

const wallpaperSlice = createSlice({
  name: wallpaperSliceName,
  initialState,
  reducers: {
    setPending: (state, action: PayloadAction<WallpaperId>): WallpaperState => ({
      wallpaperId: state.wallpaperId,
      pendingWallpaperId: action.payload,
    }),
    confirmPending: (state): WallpaperState => {
      if (state.pendingWallpaperId === undefined) return state;
      return {wallpaperId: state.pendingWallpaperId};
    },
    clearPending: (state): WallpaperState => ({
      wallpaperId: state.wallpaperId,
    }),
  },
});

export const wallpaperStateRegistration = defineStateRuntimeSlice<WallpaperState>({
  name: wallpaperSliceName,
  reducer: wallpaperSlice.reducer,
  persistIntent: 'owner-only',
  persistence: [
    {kind: 'field', stateKey: 'wallpaperId'},
    {
      kind: 'field',
      stateKey: 'pendingWallpaperId',
      shouldPersist: value => value !== undefined,
    },
  ],
  syncIntent: 'isolated',
});

export const wallpaperActions = wallpaperSlice.actions;
