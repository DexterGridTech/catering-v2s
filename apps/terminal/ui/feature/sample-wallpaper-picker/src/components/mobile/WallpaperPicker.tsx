import {
  PrimitiveButton,
  PrimitiveContainer,
  PrimitiveLabel,
  PrimitiveScrollView,
} from '@catering-v2s/ui-base-primitives';
import {wallpaperOptionTestId, wallpaperPickerTestIds} from '../../foundations/wallpaperPickerTestIds';
import {useWallpaperPicker} from '../../hooks/useWallpaperPicker';
import {WallpaperOptionCards} from '../WallpaperOptionCards';

const thumbnailStyle = Object.freeze({width: 120, height: 72});
const rootStyle = Object.freeze({width: '100%', paddingHorizontal: 8, gap: 3});

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
          style={{flexDirection: 'column', flexShrink: 0}}
          cardStyle={{width: '100%', flexDirection: 'row', alignItems: 'center'}}
          thumbnailStyle={thumbnailStyle}
        />
        <PrimitiveButton
          testID={wallpaperPickerTestIds.confirm}
          accessibilityLabel="确认壁纸"
          disabled={!picker.canConfirm}
          onPress={picker.confirm}
          style={{width: '100%'}}
        >
          确认
        </PrimitiveButton>
        <PrimitiveButton
          testID={wallpaperPickerTestIds.logout}
          accessibilityLabel="店员登出"
          disabled={picker.requestInFlight}
          onPress={picker.logout}
          style={{width: '100%'}}
        >
          店员登出
        </PrimitiveButton>
      </PrimitiveScrollView>
    </PrimitiveContainer>
  );
};
