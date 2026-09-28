import {createContext, useContext} from 'react';
import type {PrimitiveNativeNode} from '@catering-v2s/ui-base-primitives';
import type {LayoutRect} from '../foundations/scrollIntoView';

export type InputSurfaceGeometry = Readonly<{
  readonly surfaceRoot: PrimitiveNativeNode | null;
  readonly surfaceWidth: number;
  readonly surfaceHeight: number;
  readonly keyboardHeight: number;
  readonly presentationOffsetY: number;
  readonly presentFocusRect: (fieldId: string, rect: LayoutRect) => number;
  readonly scheduleScrollAtPresentationStart: (fieldId: string, start: () => void) => void;
  readonly cancelScheduledScroll: (fieldId: string) => void;
  readonly reportFocusVisibilityFailure: (fieldId: string, reason: string) => void;
  readonly reportFocusVisibilitySuccess: (fieldId: string) => void;
}>;

export const InputSurfaceGeometryContext = createContext<InputSurfaceGeometry | null>(null);

export const useInputSurfaceGeometry = (): InputSurfaceGeometry | null => useContext(InputSurfaceGeometryContext);
