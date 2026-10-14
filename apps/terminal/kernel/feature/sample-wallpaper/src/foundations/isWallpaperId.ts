import type {WallpaperId} from '../types/types';

export const isWallpaperId = (value: unknown): value is WallpaperId =>
  value === 'none' || value === 'w1' || value === 'w2' || value === 'w3';
