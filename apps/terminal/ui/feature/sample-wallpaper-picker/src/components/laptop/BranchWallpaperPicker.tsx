import {PrimitiveButton, PrimitiveContainer, PrimitiveLabel, PrimitiveScrollView} from '@catering-v2s/ui-base-primitives';
import {branchWallpaperOptionTestId, branchWallpaperPickerTestIds} from '../../foundations/wallpaperPickerTestIds';
import {useWallpaperPicker} from '../../hooks/useWallpaperPicker';
import {WallpaperOptionCards} from '../WallpaperOptionCards';

const thumbnailStyle = Object.freeze({width: 160, height: 96});
const rootStyle = Object.freeze({width: '100%', maxWidth: 960, alignSelf: 'center' as const});

/** Independent SLAVE/BRANCH page; it writes only the local wallpaper owner and has no logout control. */
export const BranchWallpaperPicker = () => {
  const picker = useWallpaperPicker();
  return (
    <PrimitiveContainer testID={branchWallpaperPickerTestIds.root} layout="transparent" style={rootStyle}>
      <PrimitiveLabel testID={branchWallpaperPickerTestIds.title}>选择本机壁纸</PrimitiveLabel>
      <PrimitiveScrollView testID={branchWallpaperPickerTestIds.optionsScroll} layout="transparent">
        <WallpaperOptionCards
          testID={branchWallpaperPickerTestIds.options}
          optionTestId={branchWallpaperOptionTestId}
          selected={picker.effective}
          onSelect={picker.selectOption}
          style={{flexShrink: 0}}
          cardStyle={{width: 220}}
          thumbnailStyle={thumbnailStyle}
        />
        <PrimitiveButton
          testID={branchWallpaperPickerTestIds.confirm}
          accessibilityLabel="确认本机壁纸"
          disabled={!picker.canConfirm}
          onPress={picker.confirm}
        >
          确认
        </PrimitiveButton>
        <PrimitiveButton
          testID={branchWallpaperPickerTestIds.exit}
          accessibilityLabel="退出选择"
          disabled={picker.requestInFlight}
          onPress={picker.exit}
        >
          退出选择
        </PrimitiveButton>
      </PrimitiveScrollView>
    </PrimitiveContainer>
  );
};
