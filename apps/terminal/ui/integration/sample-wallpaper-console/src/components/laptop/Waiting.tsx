import {PrimitiveContainer, PrimitiveStatus} from '@catering-v2s/ui-base-primitives';

/** Laptop-only secondary surface; mobile has no SECONDARY canvas by contract. */
export const WallpaperConsoleWaiting = () => (
  <PrimitiveContainer testID="sample.wallpaper-console.waiting" layout="transparent" style={{padding: 24}}>
    <PrimitiveStatus testID="sample.wallpaper-console.waiting:message">等待店员登录</PrimitiveStatus>
  </PrimitiveContainer>
);
