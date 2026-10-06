import {useUiStateSelector} from '@catering-v2s/ui-base-render';
import {PrimitiveContainer, PrimitiveImage} from '@catering-v2s/ui-base-primitives';
import {selectHostConfirmedWallpaperId} from '@catering-v2s/kernel-feature-sample-wallpaper';
import {assetsById} from '../foundations/assets';
import {wallpaperLabels} from '../foundations/wallpaperCatalog';
import {wallpaperContentTestIds} from '../foundations/wallpaperPickerTestIds';

/** Read-only LMS content: MASTER uses its owner value; SLAVE uses the current peer projection. */
export const HostWallpaperDisplay = () => {
  const wallpaperId = useUiStateSelector(selectHostConfirmedWallpaperId);
  if (wallpaperId === null || wallpaperId === undefined) return null;
  const source = assetsById[wallpaperId];
  return (
    <PrimitiveContainer
      testID={wallpaperContentTestIds.hostDisplay}
      layout="transparent"
      style={{flex: 1, minHeight: 0}}
    >
      {source === undefined ? null : (
        <PrimitiveImage
          testID={wallpaperContentTestIds.hostDisplayImage}
          accessibilityLabel={`主机已确认壁纸：${wallpaperLabels[wallpaperId]}`}
          layout="background"
          source={source}
          resizeMode="cover"
        />
      )}
    </PrimitiveContainer>
  );
};
