import {PrimitiveContainer, PrimitiveStatus} from '@catering-v2s/ui-base-primitives';

/** Laptop-only secondary surface; mobile has no SECONDARY canvas by contract. */
export const WallpaperConsoleWelcome = () => (
  <PrimitiveContainer testID="sample.wallpaper-console.welcome" layout="transparent" style={{padding: 24}}>
    <PrimitiveStatus testID="sample.wallpaper-console.welcome:message">欢迎，请等待店员操作</PrimitiveStatus>
  </PrimitiveContainer>
);
