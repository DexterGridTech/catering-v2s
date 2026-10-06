import {useUiStateSelector} from '@catering-v2s/ui-base-render';
import {PrimitiveImage} from '@catering-v2s/ui-base-primitives';
import {selectWallpaperId, type WallpaperId} from '@catering-v2s/kernel-feature-sample-wallpaper';
import {assetsById} from '../foundations/assets';

import {wallpaperLabels} from '../foundations/wallpaperCatalog';
import {wallpaperContentTestIds} from '../foundations/wallpaperPickerTestIds';

export const WallpaperBackground = () => {
  const wallpaperId = useUiStateSelector(selectWallpaperId);
  const source = wallpaperId === undefined ? undefined : assetsById[wallpaperId as WallpaperId];
  if (source === undefined) return null;
  return (
    <PrimitiveImage
      testID={wallpaperContentTestIds.background}
      accessibilityLabel={`当前壁纸：${wallpaperLabels[wallpaperId as WallpaperId]}`}
      layout="background"
      source={source}
      resizeMode="cover"
    />
  );
};
