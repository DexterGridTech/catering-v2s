import {PrimitiveContainer, PrimitiveStatus} from '@catering-v2s/ui-base-primitives'

export const WallpaperConsoleWaiting = () => (
  <PrimitiveContainer testID="sample.wallpaper-console.waiting" layout="transparent">
    <PrimitiveStatus testID="sample.wallpaper-console.waiting:message">等待店员登录</PrimitiveStatus>
  </PrimitiveContainer>
)
