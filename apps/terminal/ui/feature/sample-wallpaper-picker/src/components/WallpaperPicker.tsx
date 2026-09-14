import {useCallback} from 'react'
import {
  confirmWallpaperRequestedCommand,
  wallpaperOptionSelectedCommand,
} from '../features/commands/commands'
import {
  selectPendingWallpaperId,
  selectWallpaperId,
  type WallpaperId,
} from '@catering-v2s/kernel-feature-sample-wallpaper'
import {
  dispatchWithRequestId,
  useDispatchCommand,
  useUiStateSelector,
} from '@catering-v2s/ui-base-render'
import {
  PrimitiveButton,
  PrimitiveCard,
  PrimitiveContainer,
  PrimitiveGrid,
  PrimitiveImage,
  PrimitiveLabel,
  PrimitiveRadio,
  PrimitiveScrollView,
} from '@catering-v2s/ui-base-primitives'
import {assetsById} from '../foundations/assets'
import {wallpaperOptionTestId, wallpaperPickerTestIds} from '../foundations/wallpaperPickerTestIds'

const labels: Readonly<Record<WallpaperId, string>> = Object.freeze({
  none: '无壁纸',
  w1: '山景',
  w2: '湖景',
  w3: '海滩',
})

const wallpaperIds = Object.keys(assetsById) as WallpaperId[]

const thumbnailStyle = {width: 160, height: 96} as const

export const WallpaperPicker = () => {
  const confirmed = useUiStateSelector(selectWallpaperId)
  const pending = useUiStateSelector(selectPendingWallpaperId)
  const effective = pending ?? confirmed
  const dispatchCommand = useDispatchCommand()
  const canConfirm = pending !== undefined && pending !== confirmed

  const selectOption = useCallback((wallpaperId: WallpaperId) => {
    void dispatchWithRequestId({
      dispatchCommand,
      definition: wallpaperOptionSelectedCommand,
      payload: {wallpaperId},
    })
  }, [dispatchCommand])

  const confirm = useCallback(() => {
    if (!canConfirm) return
    void dispatchWithRequestId({
      dispatchCommand,
      definition: confirmWallpaperRequestedCommand,
      payload: {},
    })
  }, [canConfirm, dispatchCommand])

  return (
    <PrimitiveContainer testID={wallpaperPickerTestIds.root} layout="transparent">
      <PrimitiveLabel testID={wallpaperPickerTestIds.title}>选择屏幕壁纸</PrimitiveLabel>
      <PrimitiveScrollView testID={wallpaperPickerTestIds.optionsScroll} layout="transparent">
        <PrimitiveGrid
          testID={wallpaperPickerTestIds.options}
          accessibilityLabel="壁纸选项"
          accessibilityRole="tablist"
          style={{flexShrink: 0}}
        >
          {wallpaperIds.map(wallpaperId => {
            const source = assetsById[wallpaperId]
            const optionTestId = wallpaperOptionTestId(wallpaperId)
            return (
              <PrimitiveCard key={wallpaperId} testID={`${optionTestId}:card`}>
                <PrimitiveRadio
                  testID={optionTestId}
                  accessibilityLabel={labels[wallpaperId]}
                  selected={effective === wallpaperId}
                  onSelectedChange={() => selectOption(wallpaperId)}
                />
                {source === undefined ? null : (
                  <PrimitiveImage
                    testID={`${optionTestId}:thumbnail`}
                    accessibilityLabel={`${labels[wallpaperId]}缩略图`}
                    source={source}
                    layout="thumbnail"
                    resizeMode="contain"
                    style={thumbnailStyle}
                  />
                )}
                <PrimitiveLabel testID={`${optionTestId}:label`}>{labels[wallpaperId]}</PrimitiveLabel>
              </PrimitiveCard>
            )
          })}
        </PrimitiveGrid>
        <PrimitiveButton
          testID={wallpaperPickerTestIds.confirm}
          accessibilityLabel="确认壁纸"
          disabled={!canConfirm}
          onPress={confirm}
        >
          确认
        </PrimitiveButton>
      </PrimitiveScrollView>
    </PrimitiveContainer>
  )
}
