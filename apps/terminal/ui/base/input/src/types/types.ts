import type {RefObject, ReactNode} from 'react';
import type {
  PrimitiveInputHandle,
  PrimitiveInputProps,
  PrimitiveInputSelection,
  PrimitiveInputSelectionChangeEvent,
} from '@catering-v2s/ui-base-primitives';
import type {EditResult, EditState, KeyboardKey} from '../foundations/editText';
import type {KeyboardCapacity, LocalFrameMetrics} from '../foundations/keyboardHeight';
import type {KeyboardLayout} from '../foundations/keyboardLayout';
import type {InputRegistrationToken, InputSnapshot} from '../foundations/snapshot';

export type {KeyboardLayout} from '../foundations/keyboardLayout';
export type {InputSnapshot, InputRegistrationToken} from '../foundations/snapshot';

export type InputDiagnosticValue =
  | string
  | number
  | boolean
  | null
  | readonly InputDiagnosticValue[]
  | Readonly<{readonly [key: string]: InputDiagnosticValue}>;

export type InputDiagnostic = Readonly<{
  readonly event: string;
  readonly data: Readonly<Record<string, InputDiagnosticValue>>;
}>;

export type InputDiagnosticReporter = (diagnostic: InputDiagnostic) => void;

export type InputKeyboardPlacement = 'surface' | 'field';

export type InputKeyboardProps = Readonly<{
  /**
   * The layout owner for the shared keyboard. `surface` is docked by
   * InputSurfaceFrame; `field` is rendered by the consumer at its local
   * field/card position. Both placements use the same InputProvider owner.
   */
  readonly placement: InputKeyboardPlacement;
}>;

type InputFieldOptionsBase = Readonly<{
  readonly fieldId: string;
  readonly testID: string;
  readonly accessibilityLabel?: string;
  readonly editable?: boolean;
  readonly initialValue?: string;
  readonly initialSelection?: PrimitiveInputSelection;
  readonly maxLength?: number;
  readonly secureTextEntry?: boolean;
  readonly nativeLess?: boolean;
  readonly focusScopeId?: string;
  readonly keyboardPlacement?: InputKeyboardPlacement;
}>;

export type InputFieldOptions = InputFieldOptionsBase & Readonly<{
  readonly keyboardKind: 'virtual';
  readonly layout: KeyboardLayout;
}>;

export type InputFieldResult = Readonly<{
  readonly inputProps: PrimitiveInputProps;
  readonly captureInputSnapshot: () => InputSnapshot;
  readonly focus: () => void;
  readonly blur: () => void;
  readonly complete: () => void;
}>;

export type InputSurfaceFrameProps = Readonly<{
  readonly children?: ReactNode;
  readonly onMeasuredFrame?: (frame: LocalFrameMetrics) => void;
  readonly onDiagnostic?: InputDiagnosticReporter;
}>;

export type InputProviderProps = Readonly<{
  readonly frameMetrics: LocalFrameMetrics | null;
  readonly children?: ReactNode;
  readonly onDiagnostic?: InputDiagnosticReporter;
}>;

export type InputFieldController = Readonly<{
  readonly fieldId: string;
  readonly token: InputRegistrationToken;
  readonly keyboardKind: 'virtual';
  readonly layout: KeyboardLayout;
  readonly maxLength?: number;
  readonly inputRef: RefObject<PrimitiveInputHandle | null> | null;
  readonly focusScopeId: string;
  readonly keyboardPlacement: InputKeyboardPlacement;
  readonly applyKey: (key: KeyboardKey) => EditResult;
  readonly getEditState: () => EditState;
}>;

export type InputFieldRegistration = Readonly<{
  readonly fieldId: string;
  readonly value: string;
  readonly selection: PrimitiveInputSelection;
  readonly keyboardKind: 'virtual';
  readonly layout: KeyboardLayout;
  readonly maxLength?: number;
  readonly inputRef: RefObject<PrimitiveInputHandle | null> | null;
  readonly focusScopeId: string;
  readonly keyboardPlacement: InputKeyboardPlacement;
  readonly applyKey: (key: KeyboardKey) => EditResult;
  readonly getEditState: () => EditState;
}>;

export type InputController = Readonly<{
  readonly registerField: (registration: InputFieldRegistration) => InputRegistrationToken;
  readonly unregisterField: (token: InputRegistrationToken) => void;
  readonly updateValue: (token: InputRegistrationToken, value: string) => void;
  readonly updateSelection: (token: InputRegistrationToken, selection: PrimitiveInputSelection) => void;
  readonly updateFieldConfig: (
    token: InputRegistrationToken,
    config: Readonly<{
      readonly keyboardKind: 'virtual';
      readonly layout: KeyboardLayout;
      readonly maxLength?: number;
      readonly focusScopeId: string;
      readonly keyboardPlacement: InputKeyboardPlacement;
    }>,
  ) => void;
  readonly handleFocus: (fieldId: string) => void;
  readonly handleBlur: (fieldId: string) => void;
  readonly blurField: (fieldId: string) => void;
  readonly dismissActiveField: () => void;
  readonly preflightFocusTarget: (fieldId: string) => boolean;
  readonly focusField: (fieldId: string) => void;
  readonly completeField: (fieldId: string) => void;
  readonly activateFocusScope: (scopeId: string) => void;
  readonly captureInputSnapshot: () => InputSnapshot;
  readonly handleKeyboardKey: (key: KeyboardKey) => void;
}>;

export type InputKeyboardState = Readonly<{
  readonly activeFieldId: string | null;
  readonly owner: 'none' | 'virtual';
  readonly keyboardPlacement: InputKeyboardPlacement;
  readonly layout: KeyboardLayout;
  readonly capacity: KeyboardCapacity;
  readonly blockedFieldId: string | null;
  readonly blockedCapacity: KeyboardCapacity | null;
  readonly height: number;
  readonly contentHeight: number;
  readonly frameWidth: number;
  readonly cellWidth: number;
  readonly rowCount: number;
  readonly hasNextField: boolean;
  readonly visible: boolean;
  readonly contentTooSmall: boolean;
  readonly revision: number;
  readonly shift: boolean;
  readonly capsLock: boolean;
}>;

export type InputFieldKeyboardState = Readonly<{
  readonly activeFieldId: string | null;
  readonly owner: 'none' | 'virtual';
  readonly height: number;
  readonly visible: boolean;
  readonly contentTooSmall: boolean;
}>;
