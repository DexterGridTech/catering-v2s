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

export type KeyboardKind = 'system' | 'virtual';

type InputFieldOptionsBase = Readonly<{
  readonly fieldId: string;
  readonly testID: string;
  readonly accessibilityLabel?: string;
  readonly editable?: boolean;
  readonly initialValue?: string;
  readonly initialSelection?: PrimitiveInputSelection;
  readonly maxLength?: number;
  readonly secureTextEntry?: boolean;
}>;

export type InputFieldOptions =
  | (InputFieldOptionsBase &
      Readonly<{
        readonly keyboardKind: 'system';
        readonly layout?: never;
      }>)
  | (InputFieldOptionsBase &
      Readonly<{
        readonly keyboardKind: 'virtual';
        readonly layout: KeyboardLayout;
      }>);

export type InputFieldResult = Readonly<{
  readonly inputProps: PrimitiveInputProps;
  readonly captureInputSnapshot: () => InputSnapshot;
  readonly focus: () => void;
  readonly blur: () => void;
  readonly complete: () => void;
}>;

export type InputSurfaceFrameProps = Readonly<{
  readonly children?: ReactNode;
  readonly imeInset?: number;
  readonly onMeasuredFrame?: (frame: LocalFrameMetrics) => void;
}>;

export type InputProviderProps = Readonly<{
  readonly frameMetrics: LocalFrameMetrics | null;
  readonly children?: ReactNode;
  readonly imeInset?: number;
}>;

export type InputFieldController = Readonly<{
  readonly fieldId: string;
  readonly token: InputRegistrationToken;
  readonly keyboardKind: KeyboardKind;
  readonly layout: KeyboardLayout;
  readonly maxLength?: number;
  readonly inputRef: RefObject<PrimitiveInputHandle | null>;
  readonly applyKey: (key: KeyboardKey) => EditResult;
  readonly getEditState: () => EditState;
}>;

export type InputFieldRegistration = Readonly<{
  readonly fieldId: string;
  readonly value: string;
  readonly selection: PrimitiveInputSelection;
  readonly keyboardKind: KeyboardKind;
  readonly layout: KeyboardLayout;
  readonly maxLength?: number;
  readonly inputRef: RefObject<PrimitiveInputHandle | null>;
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
      readonly keyboardKind: KeyboardKind;
      readonly layout: KeyboardLayout;
      readonly maxLength?: number;
    }>,
  ) => void;
  readonly handleFocus: (fieldId: string) => void;
  readonly handleBlur: (fieldId: string) => void;
  readonly blurField: (fieldId: string) => void;
  readonly dismissActiveField: () => void;
  readonly preflightFocusTarget: (fieldId: string) => boolean;
  readonly focusField: (fieldId: string) => void;
  readonly completeField: (fieldId: string) => void;
  readonly captureInputSnapshot: () => InputSnapshot;
  readonly handleKeyboardKey: (key: KeyboardKey) => void;
}>;

export type InputKeyboardState = Readonly<{
  readonly activeFieldId: string | null;
  readonly owner: 'none' | KeyboardKind;
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
  readonly imeInset: number;
  readonly shift: boolean;
  readonly capsLock: boolean;
}>;

export type InputFieldKeyboardState = Readonly<{
  readonly activeFieldId: string | null;
  readonly owner: 'none' | KeyboardKind;
  readonly height: number;
  readonly visible: boolean;
  readonly contentTooSmall: boolean;
  readonly imeInset: number;
}>;
