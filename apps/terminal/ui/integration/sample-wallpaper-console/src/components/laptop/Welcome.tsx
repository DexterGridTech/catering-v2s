import {PrimitiveContainer, PrimitiveStatus} from '@catering-v2s/ui-base-primitives';

/** Laptop-only secondary surface; mobile has no SECONDARY canvas by contract. */
export const WallpaperConsoleWelcome = () => (
  <PrimitiveContainer layout="transparent" style={{padding: 24}}>
    <PrimitiveStatus>欢迎，请等待店员操作</PrimitiveStatus>
  </PrimitiveContainer>
);
