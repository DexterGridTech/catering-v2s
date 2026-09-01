import type {TimestampMs} from '../types/ids';

export const nowTimestampMs = (): TimestampMs => Date.now();
