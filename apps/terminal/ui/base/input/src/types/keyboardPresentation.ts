import type {InputKeyboardSnapshot} from '../components/InputKeyboard';
import type {KeyboardHandoffTrack} from '../foundations/keyboardPresentation';
import type {LayoutRect} from '../foundations/scrollIntoView';

export type FrozenKeyboardLayer = Readonly<{
  readonly snapshot: InputKeyboardSnapshot;
  readonly translateY: number;
  /** Immutable identity retained when a visible layer is frozen for a new transition. */
  readonly layerKey: string;
}>;

export type KeyboardPresentation =
  | Readonly<{readonly phase: 'idle'}>
  | Readonly<{
      readonly phase: 'measure';
      readonly serial: number;
      readonly outgoing: readonly FrozenKeyboardLayer[];
      readonly incoming: InputKeyboardSnapshot;
      readonly kind: 'enter' | 'handoff';
      readonly startOffset: number;
      readonly targetOffset: number;
    }>
  | Readonly<{
      readonly phase: 'enter';
      readonly serial: number;
      readonly incoming: InputKeyboardSnapshot;
      readonly startOffset: number;
      readonly targetOffset: number;
      readonly settled: boolean;
    }>
  | Readonly<{readonly phase: 'display'; readonly active: InputKeyboardSnapshot}>
  | Readonly<{
      readonly phase: 'handoff';
      readonly serial: number;
      readonly outgoing: readonly FrozenKeyboardLayer[];
      readonly incoming: InputKeyboardSnapshot;
      readonly track: KeyboardHandoffTrack;
      readonly startOffset: number;
      readonly targetOffset: number;
      readonly settled: boolean;
    }>
  | Readonly<{
      readonly phase: 'exit';
      readonly serial: number;
      readonly outgoing: readonly FrozenKeyboardLayer[];
      readonly obstructionHeight: number;
      readonly startOffset: number;
    }>
  | Readonly<{
      readonly phase: 'reposition';
      readonly serial: number;
      readonly active: InputKeyboardSnapshot;
      readonly startOffset: number;
      readonly targetOffset: number;
    }>;

export type FocusTarget = Readonly<{
  readonly fieldId: string;
  readonly rect: LayoutRect;
  readonly offset: number;
  readonly revision: number;
}>;

export type PresentationTargetInput = Readonly<{
  readonly fieldId: string;
  readonly fallback: number;
}>;

export type ScheduledScrollStart = Readonly<{
  readonly fieldId: string;
  readonly start: () => void;
}>;

export type PresentationSample = Readonly<{
  readonly layers: readonly FrozenKeyboardLayer[];
  readonly offset: number;
}>;

export type FocusVisibilityFailure = Readonly<{
  readonly fieldId: string;
  readonly reason: string;
}>;
