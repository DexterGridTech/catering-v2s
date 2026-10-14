import {createSlice, type PayloadAction} from '@reduxjs/toolkit';
import {defineStateRuntimeSlice, type SyncValueEnvelope} from '@catering-v2s/kernel-base-state';
import type {TimestampMs} from '@catering-v2s/kernel-base-contracts';
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
      ...state,
      pendingWallpaperId: action.payload,
    }),
    confirmPending: (state): WallpaperState => {
      if (state.pendingWallpaperId === undefined) return state;
      const {pendingWallpaperId, ...current} = state;
      return {...current, wallpaperId: pendingWallpaperId};
    },
    clearPending: (state): WallpaperState => {
      const current = {...state} as {
        wallpaperId: WallpaperId;
        pendingWallpaperId?: WallpaperId;
        hostConfirmedWallpaperId?: WallpaperId | null;
      };
      delete current.pendingWallpaperId;
      return current as WallpaperState;
    },
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
  syncIntent: 'master-to-slave',
  sync: {
    kind: 'record',
    getEntries: (state: Readonly<WallpaperState>): Readonly<Record<string, SyncValueEnvelope>> => ({
      state: {
        value: {wallpaperId: state.wallpaperId},
        updatedAt: 0 as TimestampMs,
      },
    }),
    applyEntries: (
      state: Readonly<WallpaperState>,
      entries: Readonly<Partial<Record<string, SyncValueEnvelope>>>,
    ): WallpaperState => {
      const stateEntry = entries.state;
      const value = stateEntry?.value;
      const candidate = (value as Readonly<{wallpaperId?: unknown}> | undefined)?.wallpaperId;
      const hostConfirmedWallpaperId: WallpaperId | null =
        stateEntry === undefined || value === undefined || stateEntry.tombstone === true
          ? null
          : candidate === 'none' || candidate === 'w1' || candidate === 'w2' || candidate === 'w3'
            ? candidate
            : null;
      return {
        ...state,
        hostConfirmedWallpaperId,
      };
    },
  },
});

export const wallpaperActions = wallpaperSlice.actions;
