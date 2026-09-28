/// <reference path="../types/assets.d.ts" />

import type {ImageSourcePropType} from 'react-native';
import type {WallpaperId} from '@catering-v2s/kernel-feature-sample-wallpaper';
import w1Asset from '../../assets/w1.jpg';
import w2Asset from '../../assets/w2.jpg';
import w3Asset from '../../assets/w3.jpg';

export type WallpaperPickerAsset = ImageSourcePropType | undefined;

export const assetsById: Readonly<Record<WallpaperId, WallpaperPickerAsset>> = Object.freeze({
  none: undefined,
  w1: w1Asset,
  w2: w2Asset,
  w3: w3Asset,
});
