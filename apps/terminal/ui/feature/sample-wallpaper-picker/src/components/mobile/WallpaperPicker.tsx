import {
  PrimitiveButton,
  PrimitiveCard,
  PrimitiveContainer,
  PrimitiveGrid,
  PrimitiveImage,
  PrimitiveLabel,
  PrimitiveRadio,
  PrimitiveScrollView,
} from '@catering-v2s/ui-base-primitives';
import {assetsById} from '../../foundations/assets';
import {wallpaperOptionTestId, wallpaperPickerTestIds} from '../../foundations/wallpaperPickerTestIds';
import {useWallpaperPicker} from '../../hooks/useWallpaperPicker';
import {wallpaperIds, wallpaperLabels} from '../../foundations/wallpaperCatalog';

const thumbnailStyle = Object.freeze({width: 120, height: 72});
const rootStyle = Object.freeze({width: '100%', paddingHorizontal: 8, gap: 3});

export const WallpaperPicker = () => {
  const picker = useWallpaperPicker();
  return (
    <PrimitiveContainer testID={wallpaperPickerTestIds.root} layout="transparent" style={rootStyle}>
      <PrimitiveLabel testID={wallpaperPickerTestIds.title}>选择屏幕壁纸</PrimitiveLabel>
      <PrimitiveScrollView testID={wallpaperPickerTestIds.optionsScroll} layout="transparent">
        <PrimitiveGrid
          testID={wallpaperPickerTestIds.options}
          accessibilityLabel="壁纸选项"
          accessibilityRole="tablist"
          style={{flexDirection: 'column', flexShrink: 0}}
        >
          {wallpaperIds.map(wallpaperId => {
            const source = assetsById[wallpaperId];
            const optionTestId = wallpaperOptionTestId(wallpaperId);
            return (
              <PrimitiveCard
                key={wallpaperId}
                testID={`${optionTestId}:card`}
                style={{width: '100%', flexDirection: 'row', alignItems: 'center'}}
              >
                <PrimitiveRadio
                  testID={optionTestId}
                  accessibilityLabel={wallpaperLabels[wallpaperId]}
                  selected={picker.effective === wallpaperId}
                  onSelectedChange={() => picker.selectOption(wallpaperId)}
                />
                {source === undefined ? null : (
                  <PrimitiveImage
                    testID={`${optionTestId}:thumbnail`}
                    accessibilityLabel={`${wallpaperLabels[wallpaperId]}缩略图`}
                    source={source}
                    layout="thumbnail"
                    resizeMode="contain"
                    style={thumbnailStyle}
                  />
                )}
                <PrimitiveLabel testID={`${optionTestId}:label`}>{wallpaperLabels[wallpaperId]}</PrimitiveLabel>
              </PrimitiveCard>
            );
          })}
        </PrimitiveGrid>
        <PrimitiveButton
          testID={wallpaperPickerTestIds.confirm}
          accessibilityLabel="确认壁纸"
          disabled={!picker.canConfirm}
          onPress={picker.confirm}
          style={{width: '100%'}}
        >
          确认
        </PrimitiveButton>
      </PrimitiveScrollView>
    </PrimitiveContainer>
  );
};
