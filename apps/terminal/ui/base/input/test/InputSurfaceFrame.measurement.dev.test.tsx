import {inputTestIds} from '../src/foundations/inputTestIds';
import {testId} from './testIds';
import {act, render, type RenderResult} from '@testing-library/react-native';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {StyleSheet, View} from 'react-native';
import {PrimitiveInput, PrimitivePinInput, type PrimitiveInputHandle} from '@catering-v2s/ui-base-primitives';
import {useSurfacePresentationOffset} from '@catering-v2s/ui-base-render';
import {InputSurfaceFrame} from '../src/components/InputSurfaceFrame';
import {useInputFieldKeyboardState, useInputKeyboardState, useInputScrollAncestor} from '../src/contexts/context';
import {useInputSurfaceGeometry} from '../src/contexts/InputSurfaceGeometryContext';
import {useInputField} from '../src/hooks/useInputField';
import type {InputFieldResult} from '../src/types/types';
import {
  advanceAnimatedTimingsForTests,
  setAnimatedTimingAutoFinishForTests,
} from '../../../../../../tools/terminal-shared/react-native-vitest-entry';
import {
  resetNativeTestRefFactory,
  setNativeTestRefFactory,
  type NativeTestRefFactory,
} from '../../../../../../tools/terminal-shared/rntl-native-test-host';
import {
  getRenderedByProps,
  getRenderedDescendantByProps,
  queryRenderedByProps,
  queryRenderedByType,
  type RenderedTestInstance,
} from '../../../../../../tools/terminal-shared/rntl-rendered-tree';
import type {ReactElement} from 'react';

vi.mock('react-native', async importOriginal => {
  const actual = await importOriginal<typeof import('react-native')>();
  const [{withNativeTestHosts}, reactRuntime] = await Promise.all([
    import('../../../../../../tools/terminal-shared/rntl-native-test-host'),
    import('react'),
  ]);
  return withNativeTestHosts(actual, reactRuntime);
});

type TestRenderer = RenderResult;
type TestNode = Omit<RenderedTestInstance, 'props'> & Readonly<{readonly props: Record<string, any>}>;
const getNode = (renderer: TestRenderer, testID: string): TestNode =>
  getRenderedByProps(renderer, {testID}) as TestNode;
const getDescendant = (root: RenderedTestInstance, testID: string): TestNode =>
  getRenderedDescendantByProps(root, {testID}) as TestNode;
const queryNodes = (renderer: TestRenderer, testID: string): TestNode[] =>
  queryRenderedByProps(renderer, {testID}) as TestNode[];
const queryNodesByType = (renderer: TestRenderer, type: string): TestNode[] =>
  queryRenderedByType(renderer, type) as TestNode[];
const renderWithTestRefs = async (element: ReactElement, factory: NativeTestRefFactory): Promise<TestRenderer> => {
  setNativeTestRefFactory(factory);
  return render(element);
};
const applySurfaceLayout = async (renderer: TestRenderer, width: number, height: number): Promise<void> => {
  await act(async () => {
    getNode(renderer, inputTestIds.node('surface-frame')).props.onLayout({nativeEvent: {layout: {width, height}}});
  });
};

const measureKeyboardLayers = async (renderer: TestRenderer): Promise<void> => {
  const measurementLayers = queryNodes(renderer, inputTestIds.node('keyboard-layer-position:measure'));
  for (const layer of measurementLayers) {
    const backdrop = getDescendant(layer, inputTestIds.node('virtual-keyboard:backdrop'));
    const layout = StyleSheet.flatten(backdrop.props.style) as Readonly<{
      readonly width: number;
      readonly height: number;
    }>;
    await act(async () => {
      layer.props.onLayout({nativeEvent: {layout}});
    });
  }
};

const finishKeyboardPresentation = async (renderer: TestRenderer): Promise<void> => {
  setAnimatedTimingAutoFinishForTests(true);
  for (let attempt = 0; attempt < 4; attempt += 1) {
    if (queryNodes(renderer, inputTestIds.node('keyboard-layer-position:measure')).length === 0) break;
    await measureKeyboardLayers(renderer);
    await act(async () => {
      advanceAnimatedTimingsForTests(1);
    });
  }
};

const focusAndFinishKeyboard = async (renderer: TestRenderer, input: TestNode): Promise<void> => {
  await act(async () => {
    input.props.onFocus({nativeEvent: {}});
  });
  await finishKeyboardPresentation(renderer);
};

const Field = ({onReady}: Readonly<{readonly onReady: (field: InputFieldResult) => void}>) => {
  const field = useInputField({
    fieldId: 'measurement-field',
    testID: testId('sample:measurement-field'),
    accessibilityLabel: 'measurement-field',
    keyboardKind: 'virtual',
    layout: 'numeric',
  });
  onReady(field);
  return <PrimitiveInput {...field.inputProps} />;
};

const NativeLessPinField = ({
  onReady,
  onOffset,
}: Readonly<{
  readonly onReady: (field: InputFieldResult) => void;
  readonly onOffset: (offset: unknown) => void;
}>) => {
  const field = useInputField({
    fieldId: 'measurement-pin',
    testID: testId('sample:measurement-pin'),
    keyboardKind: 'virtual',
    layout: 'numeric',
    nativeLess: true,
  });
  onReady(field);
  const visibleAnchorRef = field.visibleAnchorRef;
  onOffset(useSurfacePresentationOffset());
  return (
    <PrimitivePinInput
      testID={testId('sample:measurement-pin-root')}
      cellTestIDPrefix={testId('sample:measurement-pin')}
      value={field.inputProps.value ?? ''}
      length={6}
      measureRef={visibleAnchorRef}
      onPress={field.focus}
    />
  );
};

const FieldWithPresentationProbe = ({
  onOffset,
  onRoot,
  onInputHandle,
  onFieldState,
  onScrollAncestor,
}: Readonly<{
  readonly onOffset: (offset: unknown) => void;
  readonly onRoot: (root: unknown) => void;
  readonly onInputHandle: (handle: unknown) => void;
  readonly onFieldState: (state: ReturnType<typeof useInputFieldKeyboardState>) => void;
  readonly onScrollAncestor: (scrollAncestor: ReturnType<typeof useInputScrollAncestor>) => void;
}>) => {
  const field = useInputField({
    fieldId: 'presentation-field',
    testID: testId('sample:presentation-field'),
    keyboardKind: 'virtual',
    layout: 'numeric',
  });
  onRoot(useInputSurfaceGeometry()?.surfaceRoot);
  const inputRef = field.inputProps.inputRef;
  onInputHandle(
    inputRef !== null && inputRef !== undefined && typeof inputRef === 'object' && 'current' in inputRef
      ? inputRef.current
      : null,
  );
  onFieldState(useInputFieldKeyboardState());
  onScrollAncestor(useInputScrollAncestor());
  onOffset(useSurfacePresentationOffset());
  return <PrimitiveInput {...field.inputProps} />;
};

const PositionedField = ({
  fieldId,
  onOffset,
}: Readonly<{
  readonly fieldId: string;
  readonly onOffset: (offset: unknown) => void;
}>) => {
  const field = useInputField({
    fieldId,
    testID: testId(`sample:${fieldId}`),
    keyboardKind: 'virtual',
    layout: 'numeric',
  });
  onOffset(useSurfacePresentationOffset());
  return <PrimitiveInput {...field.inputProps} />;
};

const KeyboardStateProbe = ({
  onState,
}: Readonly<{readonly onState: (state: ReturnType<typeof useInputKeyboardState>) => void}>) => {
  onState(useInputKeyboardState());
  return null;
};

const mountNativeLessPin = async (pinRoot: unknown) => {
  let field: InputFieldResult | undefined;
  let keyboardState: ReturnType<typeof useInputKeyboardState> | null = null;
  const renderer = await renderWithTestRefs(
    <InputSurfaceFrame>
      <NativeLessPinField
        onReady={value => {
          field = value;
        }}
        onOffset={() => undefined}
      />
      <KeyboardStateProbe
        onState={state => {
          keyboardState = state;
        }}
      />
    </InputSurfaceFrame>,
    (hostName, props) => {
      if (hostName === 'View' && props.testID === testId(inputTestIds.node('surface-frame'))) return {};
      if (props.testID === testId('sample:measurement-pin-root')) return pinRoot;
      return {};
    },
  );
  await applySurfaceLayout(renderer, 960, 800);
  return {renderer, getField: () => field, getKeyboardState: () => keyboardState};
};

afterEach(resetNativeTestRefFactory);

describe('InputSurfaceFrame measured frame owner', () => {
  it('starts unmeasured, reports the actual pointer frame, and deduplicates equal layouts', async () => {
    const measurements: Array<{width: number; height: number; ready: boolean; orientation: string}> = [];
    let field: InputFieldResult | undefined;
    const surfaceRoot = {};
    const renderer = await renderWithTestRefs(
      <InputSurfaceFrame
        onMeasuredFrame={frame => {
          measurements.push(frame);
        }}
      >
        <Field
          onReady={value => {
            field = value;
          }}
        />
      </InputSurfaceFrame>,
      (hostName, props) => {
        if (hostName === 'View' && props.testID === testId(inputTestIds.node('surface-frame'))) return surfaceRoot;
        if (props.testID === testId('sample:measurement-field')) {
          return {
            measureLayout: (
              relativeTo: unknown,
              callback: (x: number, y: number, width: number, height: number) => void,
            ) => {
              expect(relativeTo).toBe(surfaceRoot);
              callback(0, 300, 100, 40);
            },
            focus: () => undefined,
            blur: () => undefined,
          };
        }
        return {};
      },
    );
    expect(queryNodes(renderer, inputTestIds.node('virtual-keyboard'))).toHaveLength(0);
    const frame = getNode(renderer, inputTestIds.node('surface-frame'));
    await act(() => {
      frame.props.onLayout({nativeEvent: {layout: {width: 360, height: 640}}});
      frame.props.onLayout({nativeEvent: {layout: {width: 360, height: 640}}});
    });
    expect(measurements).toEqual([{width: 360, height: 640, ready: true, orientation: 'portrait'}]);
    await act(() => {
      frame.props.onLayout({nativeEvent: {layout: {width: 420, height: 700}}});
    });
    expect(measurements).toEqual([
      {width: 360, height: 640, ready: true, orientation: 'portrait'},
      {width: 420, height: 700, ready: true, orientation: 'portrait'},
    ]);
    const input = queryNodesByType(renderer, 'TextInput').find(
      node => node.props.testID === testId('sample:measurement-field'),
    )!;
    await focusAndFinishKeyboard(renderer, input);
    expect(getNode(renderer, inputTestIds.node('virtual-keyboard'))).toBeDefined();
    await act(() => {
      field?.blur();
    });
    await act(async () => {
      await renderer.unmount();
    });
  });

  it('measures an ordinary focused field against the unshifted surface root and applies one centered offset', async () => {
    const surfaceRoot = {};
    let presentationOffset: unknown = null;
    let measuredRoot: unknown = null;
    let inputHandle: unknown = null;
    let fieldState: ReturnType<typeof useInputFieldKeyboardState> | null = null;
    let scrollAncestor: ReturnType<typeof useInputScrollAncestor> | null = null;
    let keyboardState: ReturnType<typeof useInputKeyboardState> | null = null;
    const measureFocusedField = vi.fn(
      (relativeTo: unknown, callback: (x: number, y: number, width: number, height: number) => void) => {
        expect(relativeTo).toBe(surfaceRoot);
        callback(0, 600, 100, 40);
      },
    );
    const renderer = await renderWithTestRefs(
      <InputSurfaceFrame>
        <FieldWithPresentationProbe
          onOffset={offset => {
            presentationOffset = offset;
          }}
          onRoot={root => {
            measuredRoot = root;
          }}
          onInputHandle={handle => {
            inputHandle = handle;
          }}
          onFieldState={state => {
            fieldState = state;
          }}
          onScrollAncestor={ancestor => {
            scrollAncestor = ancestor;
          }}
        />
        <KeyboardStateProbe
          onState={state => {
            keyboardState = state;
          }}
        />
      </InputSurfaceFrame>,
      (hostName, props) => {
        if (hostName === 'View' && props.testID === testId(inputTestIds.node('surface-frame'))) return surfaceRoot;
        if (props.testID === testId('sample:presentation-field')) {
          return {
            measureInWindow: () => {
              throw new Error('window coordinates must not drive field geometry');
            },
            measureLayout: measureFocusedField,
            focus: () => undefined,
            blur: () => undefined,
          };
        }
        return {};
      },
    );
    await applySurfaceLayout(renderer, 960, 800);
    expect(measuredRoot).toBe(surfaceRoot);
    const input = queryNodesByType(renderer, 'TextInput').find(
      node => node.props.testID === testId('sample:presentation-field'),
    )!;
    const nativeInputHandle = inputHandle as PrimitiveInputHandle;
    nativeInputHandle.measureLayout(surfaceRoot as never, vi.fn());
    expect(measureFocusedField).toHaveBeenCalledTimes(1);
    measureFocusedField.mockClear();
    await focusAndFinishKeyboard(renderer, input);
    expect(keyboardState).toMatchObject({activeFieldId: 'presentation-field', owner: 'virtual', visible: true});
    expect(fieldState).toMatchObject({
      activeFieldId: 'presentation-field',
      owner: 'virtual',
      visible: true,
      height: 246,
    });
    expect(scrollAncestor).toBeNull();
    expect(inputHandle).toEqual(expect.objectContaining({measureLayout: expect.any(Function)}));
    // Pending-focus preflight and the committed active phase each verify the same root-local frame.
    expect(measureFocusedField).toHaveBeenCalledTimes(2);
    expect(presentationOffset).toBe(-246);
    await act(async () => {
      await renderer.unmount();
    });
  });

  it('recomputes the next field from its unshifted root-local position without subtracting the old offset', async () => {
    const surfaceRoot = {};
    let presentationOffset: unknown = 0;
    const renderer = await renderWithTestRefs(
      <InputSurfaceFrame>
        <PositionedField
          fieldId="first-positioned"
          onOffset={offset => {
            presentationOffset = offset;
          }}
        />
        <PositionedField
          fieldId="second-positioned"
          onOffset={offset => {
            presentationOffset = offset;
          }}
        />
      </InputSurfaceFrame>,
      (hostName, props) => {
        if (hostName === 'View' && props.testID === testId(inputTestIds.node('surface-frame'))) return surfaceRoot;
        if (props.testID === testId('sample:first-positioned') || props.testID === testId('sample:second-positioned')) {
          const y = props.testID === testId('sample:first-positioned') ? 600 : 400;
          return {
            measureLayout: (
              relativeTo: unknown,
              callback: (x: number, y: number, width: number, height: number) => void,
            ) => {
              expect(relativeTo).toBe(surfaceRoot);
              callback(0, y, 100, 40);
            },
            focus: () => undefined,
            blur: () => undefined,
          };
        }
        return {};
      },
    );
    await applySurfaceLayout(renderer, 960, 800);
    const first = queryNodesByType(renderer, 'TextInput').find(
      node => node.props.testID === testId('sample:first-positioned'),
    )!;
    const second = queryNodesByType(renderer, 'TextInput').find(
      node => node.props.testID === testId('sample:second-positioned'),
    )!;
    await focusAndFinishKeyboard(renderer, first);
    expect(presentationOffset).toBe(-246);
    await focusAndFinishKeyboard(renderer, second);
    expect(presentationOffset).toBe(-143);
    await act(async () => {
      await renderer.unmount();
    });
  });

  it('measures a native-less PIN from its actual Pressable root against the unshifted surface', async () => {
    const surfaceRoot = {};
    const measureCard = vi.fn(() => {
      throw new Error('PIN geometry must not use the surrounding card');
    });
    const cardRoot = {measureLayout: measureCard};
    let field: InputFieldResult | undefined;
    let pinY = 400;
    const measurePin = vi.fn(
      (relativeTo: unknown, callback: (x: number, y: number, width: number, height: number) => void) => {
        expect(relativeTo).toBe(surfaceRoot);
        callback(0, pinY, 120, 40);
      },
    );
    const pinRoot = {
      measureLayout: measurePin,
      measureInWindow: () => {
        throw new Error('PIN geometry must not use window coordinates');
      },
    };
    let presentationOffset: unknown = null;
    const renderer = await renderWithTestRefs(
      <InputSurfaceFrame>
        <View testID={testId('sample:pin-card')}>
          <NativeLessPinField
            onReady={value => {
              field = value;
            }}
            onOffset={offset => {
              presentationOffset = offset;
            }}
          />
        </View>
      </InputSurfaceFrame>,
      (hostName, props) => {
        if (hostName === 'View' && props.testID === testId(inputTestIds.node('surface-frame'))) return surfaceRoot;
        if (hostName === 'View' && props.testID === testId('sample:pin-card')) return cardRoot;
        if (props.testID === testId('sample:measurement-pin-root')) return pinRoot;
        return {};
      },
    );
    await applySurfaceLayout(renderer, 960, 800);
    const pin = queryNodesByType(renderer, 'Pressable').find(
      node => node.props.testID === testId('sample:measurement-pin-root'),
    )!;
    await act(() => {
      pin.props.onPress();
    });
    await finishKeyboardPresentation(renderer);
    expect(measurePin).toHaveBeenCalledTimes(2);
    expect(field?.visibleAnchorRef?.current).toBe(pinRoot);
    expect(measureCard).not.toHaveBeenCalled();
    expect(measurePin.mock.calls[0]?.[0]).toBe(surfaceRoot);
    expect(measurePin.mock.calls[0]?.[1]).toEqual(expect.any(Function));
    expect(presentationOffset).toBe(-143);
    pinY = 300;
    await act(() => {
      getNode(renderer, inputTestIds.node('surface-frame')).props.onLayout({
        nativeEvent: {layout: {width: 800, height: 800}},
      });
    });
    await finishKeyboardPresentation(renderer);
    // The resize invalidates the prior geometry generation and forces a fresh measurement.
    expect(measurePin).toHaveBeenCalledTimes(3);
    expect(presentationOffset).toBe(-43);
    await act(async () => {
      await renderer.unmount();
    });
  });

  it('releases a native-less PIN field and shows recovery when its measured bounds are invalid', async () => {
    const invalidPinRoot = {
      measureLayout: (
        _relativeTo: unknown,
        callback: (x: number, y: number, width: number, height: number) => void,
      ) => {
        callback(0, 400, 0, 40);
      },
    };
    const {renderer, getField, getKeyboardState} = await mountNativeLessPin(invalidPinRoot);
    const before = getField()!.captureInputSnapshot();
    const pin = queryNodesByType(renderer, 'Pressable').find(
      node => node.props.testID === testId('sample:measurement-pin-root'),
    )!;

    await act(() => {
      pin.props.onPress();
    });

    expect(getNode(renderer, inputTestIds.node('focus-visibility-error:invalid-focus-rectangle')).props.children).toBe(
      '焦点框无法完整显示，请调整窗口尺寸或退出输入',
    );
    expect(getKeyboardState()).toMatchObject({activeFieldId: null, owner: 'none'});
    expect(getField()!.captureInputSnapshot().fields).toEqual(before.fields);
    await act(async () => {
      await renderer.unmount();
    });
  });

  it('releases a native-less PIN field and shows recovery when its visible anchor is unavailable', async () => {
    const {renderer, getField, getKeyboardState} = await mountNativeLessPin(null);
    const before = getField()!.captureInputSnapshot();
    const pin = queryNodesByType(renderer, 'Pressable').find(
      node => node.props.testID === testId('sample:measurement-pin-root'),
    )!;

    await act(() => {
      pin.props.onPress();
    });

    expect(
      getNode(renderer, inputTestIds.node('focus-visibility-error:visible-anchor-unavailable')).props.children,
    ).toBe('焦点框无法完整显示，请调整窗口尺寸或退出输入');
    expect(getKeyboardState()).toMatchObject({activeFieldId: null, owner: 'none'});
    expect(getField()!.captureInputSnapshot().fields).toEqual(before.fields);
    await act(async () => {
      await renderer.unmount();
    });
  });
});
