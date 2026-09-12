import {cn} from '../vendor/cn';
import {semanticToneTokens} from '../theme/tokens';
import type {PrimitiveTone} from '../types/types';

export const toneClassName = (tone: PrimitiveTone, base: string): string => {
  const tokens = semanticToneTokens[tone];
  return cn(base, tokens.foreground, tokens.background, tokens.border);
};

export const toneForegroundClassName = (tone: PrimitiveTone, base: string): string =>
  cn(base, semanticToneTokens[tone].foreground);
