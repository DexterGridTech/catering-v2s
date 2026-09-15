import {useCallback, useRef} from 'react'
import {
  confirmWallpaperRequestedCommand,
  wallpaperSystemFailureObservedCommand,
  wallpaperOptionSelectedCommand,
  type WallpaperSystemFailurePhase,
  type WallpaperSystemOperation,
} from '../features/commands/commands'
import {selectPendingWallpaperId, selectWallpaperId, type WallpaperId} from '@catering-v2s/kernel-feature-sample-wallpaper'
import {
  classifyRequestResult,
  dispatchWithRequestId,
  useDispatchCommand,
  useRenderContext,
  useRequestInFlight,
  useTrackedRequest,
  useUiStateSelector,
} from '@catering-v2s/ui-base-render'
import type {
  CommandDefinition,
  CommandDispatchResult,
} from '@catering-v2s/kernel-base-runtime'
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

type JsonValue = null | boolean | number | string | readonly JsonValue[] | {readonly [key: string]: JsonValue}
const thumbnailStyle = {width: 160, height: 96} as const

const phaseFromActorResult = (result: CommandDispatchResult | undefined): WallpaperSystemFailurePhase => {
  const phase = result?.actorResults
    .map(actor => actor.error?.details?.phase)
    .find(value => value === 'before-write' || value === 'after-write')
  return phase === 'before-write' || phase === 'after-write' ? phase : 'unknown-write-phase'
}

export const WallpaperPicker = () => {
  const confirmed = useUiStateSelector(selectWallpaperId)
  const pending = useUiStateSelector(selectPendingWallpaperId)
  const effective = pending ?? confirmed
  const dispatchCommand = useDispatchCommand()
  const request = useTrackedRequest()
  const requestInFlight = useRequestInFlight(request.requestId)
  const actionInFlight = useRef(false)
  const canConfirm = pending !== undefined && pending !== confirmed && !requestInFlight

  const observeSystemFailure = useCallback(async (
    operation: WallpaperSystemOperation,
    phase: WallpaperSystemFailurePhase,
  ): Promise<void> => {
    try {
      await dispatchWithRequestId({
        dispatchCommand,
        definition: wallpaperSystemFailureObservedCommand,
        payload: {operation, phase},
      })
    } catch (_error) {
      // useDispatchCommand has already emitted the structured rejection diagnostic.
    }
  }, [dispatchCommand])

  const runAction = useCallback(async <TPayload extends JsonValue>({
    definition,
    payload,
    operation,
  }: Readonly<{
    definition: CommandDefinition<TPayload>
    payload: TPayload
    operation: WallpaperSystemOperation
  }>): Promise<CommandDispatchResult | undefined> => {
    if (actionInFlight.current || requestInFlight) return undefined
    actionInFlight.current = true
    const requestId = request.start()
    try {
      const result = await dispatchWithRequestId({
        dispatchCommand,
        definition,
        payload,
        requestId,
      })
      const outcome = classifyRequestResult(result)
      if (outcome !== 'running') request.finish(requestId)
      if (outcome === 'system-failure') {
        await observeSystemFailure(operation, phaseFromActorResult(result))
      }
      return result
    } catch (_error) {
      request.finish(requestId)
      await observeSystemFailure(operation, 'unknown-write-phase')
      return undefined
    } finally {
      actionInFlight.current = false
    }
  }, [dispatchCommand, observeSystemFailure, request, requestInFlight])

  const selectOption = useCallback((wallpaperId: WallpaperId) => {
    return runAction({
      definition: wallpaperOptionSelectedCommand,
      payload: {wallpaperId},
      operation: 'select',
    })
  }, [runAction])

  const confirm = useCallback(() => {
    if (!canConfirm || pending === undefined) return undefined
    return runAction({
      definition: confirmWallpaperRequestedCommand,
      payload: {},
      operation: 'confirm',
    })
  }, [canConfirm, pending, runAction])

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
