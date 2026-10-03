import {
  PrimitiveButton,
  PrimitiveContainer,
  PrimitiveLabel,
  PrimitiveScrollView,
} from '@catering-v2s/ui-base-primitives';
import {wallpaperOptionTestId, wallpaperPickerTestIds} from '../../foundations/wallpaperPickerTestIds';
import {useWallpaperPicker} from '../../hooks/useWallpaperPicker';
import {WallpaperOptionCards} from '../WallpaperOptionCards';

const thumbnailStyle = Object.freeze({width: 160, height: 96});
const rootStyle = Object.freeze({width: '100%', maxWidth: 960, alignSelf: 'center' as const});

export const WallpaperPicker = () => {
  const picker = useWallpaperPicker();
  return (
    <PrimitiveContainer testID={wallpaperPickerTestIds.root} layout="transparent" style={rootStyle}>
      <PrimitiveLabel testID={wallpaperPickerTestIds.title}>选择屏幕壁纸</PrimitiveLabel>
      <PrimitiveScrollView testID={wallpaperPickerTestIds.optionsScroll} layout="transparent">
        <WallpaperOptionCards
          testID={wallpaperPickerTestIds.options}
          optionTestId={wallpaperOptionTestId}
          selected={picker.effective}
          onSelect={picker.selectOption}
          style={{flexShrink: 0}}
          cardStyle={{width: 220}}
          thumbnailStyle={thumbnailStyle}
        />
        <PrimitiveButton
          testID={wallpaperPickerTestIds.confirm}
          accessibilityLabel="确认壁纸"
          disabled={!picker.canConfirm}
          onPress={picker.confirm}
        >
          确认
        </PrimitiveButton>
        <PrimitiveButton
          testID={wallpaperPickerTestIds.exit}
          accessibilityLabel="退出选择"
          disabled={picker.requestInFlight}
          onPress={picker.exit}
        >
          退出选择
        </PrimitiveButton>
        <PrimitiveButton
          testID={wallpaperPickerTestIds.logout}
          accessibilityLabel="店员登出"
          disabled={picker.requestInFlight}
          onPress={picker.logout}
        >
          店员登出
        </PrimitiveButton>
      </PrimitiveScrollView>
    </PrimitiveContainer>
  );
};
