import {PrimitiveContainer, PrimitiveStatus} from '@catering-v2s/ui-base-primitives';

/** Laptop-only secondary surface; mobile has no SECONDARY canvas by contract. */
export const WallpaperConsoleWaiting = () => (
  <PrimitiveContainer layout="transparent" style={{padding: 24}}>
    <PrimitiveStatus>等待店员登录</PrimitiveStatus>
  </PrimitiveContainer>
);
