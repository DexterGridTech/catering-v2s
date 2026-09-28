import {act, render, type RenderResult} from '@testing-library/react-native';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {PrimitiveButton, PrimitiveHeading, PrimitiveInput, PrimitivePinInput} from '@catering-v2s/ui-base-primitives';
import {useSurfaceFocusBoundary, type SurfaceFocusBoundaryListener} from '@catering-v2s/ui-base-render';
import {InputSurfaceFrame} from '../src/components/InputSurfaceFrame';
import {InputKeyboard} from '../src/components/InputKeyboard';
import {useInputField} from '../src/hooks/useInputField';
import {useInputSnapshot} from '../src/hooks/useInputSnapshot';
import {useInputController, useInputKeyboardState, useInputPendingFocusCommit} from '../src/contexts/context';
import type {InputController, InputFieldResult} from '../src/types/types';
import {Animated, StyleSheet} from 'react-native';
import {useRef, useState, type ReactElement} from 'react';
import {
  advanceAnimatedTimingsForTests,
  setAnimatedTimingAutoFinishForTests,
} from '../../../../../../tools/terminal-shared/react-native-vitest-entry';
import {
  resetNativeTestRefFactory,
  setNativeTestRefFactory,
  type NativeTestHostProps,
} from '../../../../../../tools/terminal-shared/rntl-native-test-host';
import {
  getRenderedByProps,
  getRenderedDescendantByProps,
  queryRenderedByProps,
  queryRenderedByType,
  queryRenderedTree,
  type RenderedTestInstance,
} from '../../../../../../tools/terminal-shared/rntl-rendered-tree';

vi.mock('react-native', async importOriginal => {
  const actual = await importOriginal<typeof import('react-native')>();
  const {withNativeTestHosts} = await import('../../../../../../tools/terminal-shared/rntl-native-test-host');
  return withNativeTestHosts(actual);
});

const TEST_FRAME = {width: 960, height: 540} as const;

type TestRenderer = RenderResult;
type NativeTestNode = Omit<RenderedTestInstance, 'props'> & Readonly<{readonly props: Record<string, any>}>;

const getNode = (renderer: TestRenderer, testID: string): NativeTestNode =>
  getNodeByProps(renderer, {testID}) as NativeTestNode;
const getNodeByProps = (renderer: TestRenderer, expected: Readonly<Record<string, unknown>>): NativeTestNode =>
  getRenderedByProps(renderer, expected) as NativeTestNode;
const queryNodesByProps = (renderer: TestRenderer, expected: Readonly<Record<string, unknown>>): NativeTestNode[] =>
  queryRenderedByProps(renderer, expected) as NativeTestNode[];
const queryNodes = (renderer: TestRenderer, type: unknown): NativeTestNode[] =>
  queryRenderedByType(renderer, type) as NativeTestNode[];
const getKeyboardKey = (renderer: TestRenderer, keyId: string): NativeTestNode => {
  const testID = `ui.base.input:virtual-keyboard:${keyId}`;
  const [node] = queryRenderedTree(
    renderer,
    candidate => typeof candidate.props.testID === 'string' && candidate.props.testID.startsWith(testID),
  );
  if (node === undefined) throw new Error(`Expected rendered keyboard key ${testID} was not found`);
  return node as NativeTestNode;
};
const textContent = (node: RenderedTestInstance): string =>
  node.children.map(child => (typeof child === 'string' ? child : textContent(child))).join('');

const applyLayout = async (
  renderer: TestRenderer,
  width: number = TEST_FRAME.width,
  height: number = TEST_FRAME.height,
): Promise<void> => {
  await act(async () => {
    getNode(renderer, 'ui.base.input:surface-frame').props.onLayout({
      nativeEvent: {layout: {width, height}},
    });
  });
};

const measureKeyboardLayers = async (renderer: TestRenderer): Promise<void> => {
  const measurementLayers = queryNodesByProps(renderer, {testID: 'ui.base.input:keyboard-layer-position:measure'});
  for (const layer of measurementLayers) {
    const backdrop = getRenderedDescendantByProps(layer, {testID: 'ui.base.input:virtual-keyboard:backdrop'});
    const layout = StyleSheet.flatten(backdrop.props.style) as Readonly<{
      readonly width: number;
      readonly height: number;
    }>;
    await act(async () => {
      (layer.props as Record<string, any>).onLayout({nativeEvent: {layout}});
    });
  }
};

const keyboardPositionLayers = (renderer: TestRenderer) =>
  queryNodes(renderer, 'AnimatedView').filter(
    layer =>
      typeof layer.props.testID === 'string' && layer.props.testID.startsWith('ui.base.input:keyboard-layer-position:'),
  );

const finishKeyboardPresentation = async (renderer: TestRenderer): Promise<void> => {
  setAnimatedTimingAutoFinishForTests(true);
  for (let attempt = 0; attempt < 4; attempt += 1) {
    if (queryNodesByProps(renderer, {testID: 'ui.base.input:keyboard-layer-position:measure'}).length === 0) break;
    await measureKeyboardLayers(renderer);
    await act(async () => {
      advanceAnimatedTimingsForTests(1);
    });
  }
};

const focusAndFinishKeyboard = async (renderer: TestRenderer, input: NativeTestNode): Promise<void> => {
  await act(async () => {
    input.props.onFocus({nativeEvent: {}});
  });
  await finishKeyboardPresentation(renderer);
};

const focusNativeHarnessAndFinish = (
  renderer: TestRenderer,
  harness: NativeFocusHarness,
  testID: string,
): Promise<void> =>
  (async () => {
    await act(async () => {
      harness.focus(testID);
    });
    await finishKeyboardPresentation(renderer);
  })();

const mount = async (
  element: ReactElement,
  size: Readonly<{readonly width: number; readonly height: number}> = TEST_FRAME,
): Promise<TestRenderer> => {
  setNativeTestRefFactory(() => measuredNodeMock());
  const renderer = await render(element);
  await applyLayout(renderer, size.width, size.height);
  return renderer;
};

type NativeInputMock = Readonly<{
  readonly focus: () => void;
  readonly blur: () => void;
  readonly measureLayout: (
    relativeToNativeNode: unknown,
    callback: (x: number, y: number, width: number, height: number) => void,
    onFail?: () => void,
  ) => void;
}>;

const measuredNodeMock = (): NativeInputMock => ({
  focus: () => undefined,
  blur: () => undefined,
  measureLayout: (_relativeToNativeNode, callback) => callback(0, 100, 120, 40),
});

afterEach(resetNativeTestRefFactory);

type NativeFocusHarness = Readonly<{
  readonly nativeRefFactory: (hostName: string, props: NativeTestHostProps) => unknown;
  readonly focus: (testID: string) => void;
  readonly blurActive: () => void;
  readonly isFocused: (testID: string) => boolean;
}>;

const createNativeFocusHarness = (): NativeFocusHarness => {
  const nodes = new Map<string, NativeInputMock>();
  let activeNode: NativeInputMock | null = null;

  const nativeRefFactory = (_hostName: string, props: NativeTestHostProps): unknown => {
    const testID = props.testID;
    if (typeof testID !== 'string' || !testID.startsWith('sample:owner-')) return measuredNodeMock();

    const node: NativeInputMock = {
      measureLayout: (_relativeToNativeNode, callback) => callback(0, 100, 120, 40),
      focus: () => {
        if (activeNode !== null && activeNode !== node) activeNode.blur();
        activeNode = node;
        (props.onFocus as ((event: unknown) => void) | undefined)?.({nativeEvent: {}});
      },
      blur: () => {
        const wasActive = activeNode === node;
        if (wasActive) activeNode = null;
        if (wasActive) (props.onBlur as ((event: unknown) => void) | undefined)?.({nativeEvent: {}});
      },
    };
    nodes.set(testID, node);
    return node;
  };

  return {
    nativeRefFactory,
    focus: testID => nodes.get(testID)?.focus(),
    blurActive: () => activeNode?.blur(),
    isFocused: testID => activeNode === nodes.get(testID),
  };
};

const focusableInputNodeMock = (_hostName: string, props: NativeTestHostProps): unknown => {
  if (typeof props.testID !== 'string' || !props.testID.startsWith('sample:complete-')) return measuredNodeMock();
  return {
    measureLayout: (
      _relativeToNativeNode: unknown,
      callback: (x: number, y: number, width: number, height: number) => void,
    ) => callback(0, 100, 120, 40),
    focus: () => {
      if (typeof props.onFocus === 'function') (props.onFocus as (event: unknown) => void)({nativeEvent: {}});
    },
    blur: () => {
      if (typeof props.onBlur === 'function') (props.onBlur as (event: unknown) => void)({nativeEvent: {}});
    },
  };
};

const mountWithFocusableInputs = async (element: ReactElement): Promise<TestRenderer> => {
  setNativeTestRefFactory(focusableInputNodeMock);
  const renderer = await render(element);
  await applyLayout(renderer);
  return renderer;
};

const mountWithNodeMock = async (
  element: ReactElement,
  nativeRefFactory: (hostName: string, props: NativeTestHostProps) => unknown,
): Promise<TestRenderer> => {
  setNativeTestRefFactory(nativeRefFactory);
  const renderer = await render(element);
  await applyLayout(renderer);
  return renderer;
};

const Field = ({
  fieldId,
  testID,
  nativeLess = false,
  layout = 'numeric',
  focusScopeId,
  onReady,
}: Readonly<{
  readonly fieldId: string;
  readonly testID: string;
  readonly nativeLess?: boolean;
  readonly layout?: 'full' | 'alpha' | 'numeric' | 'financial';
  readonly focusScopeId?: string;
  readonly keyboardKind?: 'virtual';
  readonly onReady: (result: InputFieldResult) => void;
}>) => {
  const result = useInputField({
    fieldId,
    testID,
    accessibilityLabel: fieldId,
    keyboardKind: 'virtual',
    layout,
    nativeLess,
    focusScopeId,
  });
  onReady(result);
  if (nativeLess) {
    return (
      <PrimitivePinInput
        testID={testID}
        accessibilityLabel={fieldId}
        cellTestIDPrefix={`${testID}:digit`}
        length={6}
        measureRef={result.visibleAnchorRef}
        onPress={result.focus}
        value=""
      />
    );
  }
  return <PrimitiveInput {...result.inputProps} />;
};

const SessionField = ({
  fieldId,
  onReady,
}: Readonly<{
  readonly fieldId: string;
  readonly onReady: (result: InputFieldResult) => void;
}>) => {
  const result = useInputField({
    fieldId,
    testID: `sample:${fieldId}`,
    accessibilityLabel: fieldId,
    keyboardKind: 'virtual',
    layout: 'full',
    nativeLess: true,
  });
  onReady(result);
  return (
    <PrimitivePinInput
      testID={`sample:${fieldId}`}
      accessibilityLabel={fieldId}
      cellTestIDPrefix={`sample:${fieldId}:digit`}
      length={6}
      measureRef={result.visibleAnchorRef}
      onPress={result.focus}
      value=""
    />
  );
};

const ControllerProbe = ({onReady}: Readonly<{readonly onReady: (controller: InputController) => void}>) => {
  onReady(useInputController());
  return null;
};

const PendingFocusCommitProbe = ({
  onReady,
}: Readonly<{readonly onReady: (commit: (fieldId: string) => boolean) => void}>) => {
  onReady(useInputPendingFocusCommit());
  return null;
};

const BoundaryProbe = ({onReady}: Readonly<{readonly onReady: (listener: SurfaceFocusBoundaryListener) => void}>) => {
  onReady(useSurfaceFocusBoundary());
  return null;
};

const SnapshotProbe = ({
  onReady,
}: Readonly<{readonly onReady: (capture: () => ReturnType<ReturnType<typeof useInputSnapshot>>) => void}>) => {
  onReady(useInputSnapshot());
  return null;
};

const RenderCountingField = ({
  fieldId,
  testID,
  onRender,
}: Readonly<{
  readonly fieldId: string;
  readonly testID: string;
  readonly keyboardKind?: 'virtual';
  readonly onRender: (count: number) => void;
}>) => {
  const renderCountRef = useRef(0);
  renderCountRef.current += 1;
  onRender(renderCountRef.current);
  const result = useInputField({
    fieldId,
    testID,
    accessibilityLabel: fieldId,
    keyboardKind: 'virtual',
    layout: 'numeric',
  });
  return <PrimitiveInput {...result.inputProps} />;
};

const StateProbe = ({
  onState,
}: Readonly<{readonly onState: (state: ReturnType<typeof useInputKeyboardState>) => void}>) => {
  onState(useInputKeyboardState());
  return (
    <PrimitiveButton testID="sample:decision" onPress={() => undefined}>
      继续
    </PrimitiveButton>
  );
};

const PassiveKeyboardHarness = () => {
  const [revision, setRevision] = useState(0);
  return (
    <>
      <InputKeyboard
        snapshot={{
          fieldId: 'passive',
          layout: 'numeric',
          height: 246,
          frameWidth: 960,
          shift: false,
          hasNextField: false,
        }}
        interactive={false}
        testIDSuffix={String(revision)}
      />
      <PrimitiveButton
        testID="sample:rerender-passive"
        onPress={() => {
          setRevision(value => value + 1);
        }}
      >
        重绘
      </PrimitiveButton>
    </>
  );
};

describe('input provider', () => {
  it('keeps the content full-size and the keyboard overlay above render layers', async () => {
    const renderer = await mount(<InputSurfaceFrame />);
    const contentStyle = StyleSheet.flatten(
      getNodeByProps(renderer, {testID: 'ui.base.input:surface-content'}).props.style,
    ) as Record<string, any>;
    const overlayStyle = StyleSheet.flatten(
      getNodeByProps(renderer, {testID: 'ui.base.input:keyboard-overlay'}).props.style,
    ) as Record<string, any>;

    expect(contentStyle).toMatchObject({flex: 1, width: '100%'});
    expect(contentStyle).not.toHaveProperty('height');
    expect(overlayStyle).toMatchObject({position: 'absolute', right: 0, bottom: 0, left: 0});
    expect(overlayStyle.zIndex).toBeGreaterThan(1000);
    expect(overlayStyle.elevation).toBeGreaterThan(1000);
    await act(() => {
      renderer.unmount();
    });
  });

  it('keeps independent keyboard widths on two surfaces in the same React tree', async () => {
    setNativeTestRefFactory(() => measuredNodeMock());
    const renderer = await render(
      <>
        <InputSurfaceFrame>
          <Field fieldId="primary-width" testID="sample:primary-width" onReady={() => undefined} />
        </InputSurfaceFrame>
        <InputSurfaceFrame>
          <Field fieldId="secondary-width" testID="sample:secondary-width" onReady={() => undefined} />
        </InputSurfaceFrame>
      </>,
    );
    const frames = queryNodesByProps(renderer, {testID: 'ui.base.input:surface-frame'});
    await act(async () => {
      frames[0]!.props.onLayout({nativeEvent: {layout: {width: 1280, height: 800}}});
      frames[1]!.props.onLayout({nativeEvent: {layout: {width: 360, height: 720}}});
    });
    const primary = queryNodes(renderer, 'TextInput').find(node => node.props.testID === 'sample:primary-width')!;
    const secondary = queryNodes(renderer, 'TextInput').find(node => node.props.testID === 'sample:secondary-width')!;
    await focusAndFinishKeyboard(renderer, primary);
    await focusAndFinishKeyboard(renderer, secondary);
    const keyboards = queryNodes(renderer, 'View').filter(
      node => node.props.testID === 'ui.base.input:virtual-keyboard',
    );
    expect(keyboards.map(node => (StyleSheet.flatten(node.props.style) as Record<string, any>).width)).toEqual([
      1280, 360,
    ]);
    await act(async () => {
      await renderer.unmount();
    });
  });

  it('clears one-shot Shift when the active field session changes', async () => {
    let firstField: InputFieldResult | undefined;
    let secondField: InputFieldResult | undefined;
    let keyboardState: ReturnType<typeof useInputKeyboardState> | undefined;
    const onState = (state: ReturnType<typeof useInputKeyboardState>) => {
      keyboardState = state;
    };
    const renderer = await mount(
      <InputSurfaceFrame>
        <StateProbe onState={onState} />
        <SessionField
          fieldId="shift-first"
          onReady={result => {
            firstField = result;
          }}
        />
        <SessionField
          fieldId="shift-second"
          onReady={result => {
            secondField = result;
          }}
        />
      </InputSurfaceFrame>,
    );

    await act(() => {
      firstField!.focus();
    });
    await finishKeyboardPresentation(renderer);
    const shift = getNodeByProps(renderer, {testID: 'ui.base.input:virtual-keyboard:shift'});
    await act(() => {
      shift.props.onPress();
    });
    expect(keyboardState?.shift).toBe(true);

    await act(() => {
      secondField!.focus();
    });
    await finishKeyboardPresentation(renderer);
    expect(keyboardState?.activeFieldId).toBe('shift-second');
    expect(keyboardState?.shift).toBe(false);

    await act(() => {
      firstField!.focus();
    });
    await finishKeyboardPresentation(renderer);
    expect(keyboardState?.activeFieldId).toBe('shift-first');
    expect(keyboardState?.shift).toBe(false);
    await act(() => {
      renderer.unmount();
    });
  });

  it('does not render or commit a virtual keyboard before the frame is measured', async () => {
    let state: ReturnType<typeof useInputKeyboardState> | undefined;
    setNativeTestRefFactory(() => measuredNodeMock());
    const renderer = await render(
      <InputSurfaceFrame>
        <StateProbe
          onState={value => {
            state = value;
          }}
        />
        <Field fieldId="unmeasured" testID="sample:unmeasured" keyboardKind="virtual" onReady={() => undefined} />
      </InputSurfaceFrame>,
    );

    expect(getNodeByProps(renderer, {testID: 'sample:decision'})).toBeDefined();
    expect(queryNodesByProps(renderer, {testID: 'ui.base.input:virtual-keyboard'})).toHaveLength(0);
    expect(state?.capacity).toBe('unmeasured');
    const input = queryNodes(renderer, 'TextInput').find(node => node.props.testID === 'sample:unmeasured')!;
    await act(async () => {
      input.props.onFocus({nativeEvent: {}});
    });
    expect(state?.activeFieldId).toBeNull();
    expect(queryNodesByProps(renderer, {testID: 'ui.base.input:virtual-keyboard'})).toHaveLength(0);

    await applyLayout(renderer);
    await focusAndFinishKeyboard(renderer, input);
    expect(state?.activeFieldId).toBe('unmeasured');
    expect(getNodeByProps(renderer, {testID: 'ui.base.input:virtual-keyboard'})).toBeDefined();
    await act(async () => {
      await renderer.unmount();
    });
  });

  it('clears a virtual owner when a resize makes the active layout infeasible', async () => {
    let state: ReturnType<typeof useInputKeyboardState> | undefined;
    const renderer = await mount(
      <InputSurfaceFrame>
        <StateProbe
          onState={value => {
            state = value;
          }}
        />
        <Field fieldId="resized" testID="sample:resized" keyboardKind="virtual" onReady={() => undefined} />
      </InputSurfaceFrame>,
    );
    const input = queryNodes(renderer, 'TextInput').find(node => node.props.testID === 'sample:resized')!;
    await focusAndFinishKeyboard(renderer, input);
    expect(getNodeByProps(renderer, {testID: 'ui.base.input:virtual-keyboard'})).toBeDefined();

    try {
      setAnimatedTimingAutoFinishForTests(false);
      await applyLayout(renderer!, 360, 300);
      expect(state?.owner).toBe('none');
      expect(getNodeByProps(renderer!, {testID: 'ui.base.input:unsupported-size'})).toBeDefined();
      expect(getNodeByProps(renderer!, {testID: 'ui.base.input:keyboard-layer-position:outgoing-0'})).toBeDefined();
      expect(getNodeByProps(renderer!, {testID: 'ui.base.input:keyboard-hit-shield'})).toBeDefined();
      await act(() => {
        advanceAnimatedTimingsForTests(0.5);
      });
      expect(getNodeByProps(renderer!, {testID: 'ui.base.input:keyboard-layer-position:outgoing-0'})).toBeDefined();
      await act(() => {
        advanceAnimatedTimingsForTests(1);
      });
      expect(keyboardPositionLayers(renderer!)).toHaveLength(0);
    } finally {
      setAnimatedTimingAutoFinishForTests(true);
      await act(() => {
        renderer!.unmount();
      });
    }
  });

  it('retains the outgoing keyboard while its exit transition runs after the owner clears', async () => {
    let controller: InputController | undefined;
    let state: ReturnType<typeof useInputKeyboardState> | undefined;
    const renderer = await mount(
      <InputSurfaceFrame>
        <ControllerProbe
          onReady={value => {
            controller = value;
          }}
        />
        <StateProbe
          onState={value => {
            state = value;
          }}
        />
        <Field fieldId="exit-transition" testID="sample:exit-transition" onReady={() => undefined} />
      </InputSurfaceFrame>,
    );
    const input = queryNodes(renderer, 'TextInput').find(node => node.props.testID === 'sample:exit-transition')!;

    try {
      await focusAndFinishKeyboard(renderer, input);
      expect(queryNodesByProps(renderer, {testID: 'ui.base.input:virtual-keyboard'}).length).toBeGreaterThan(0);

      setAnimatedTimingAutoFinishForTests(false);
      await act(() => {
        controller!.dismissActiveField();
      });

      expect(state?.owner).toBe('none');
      expect(state?.visible).toBe(false);
      expect(getNodeByProps(renderer, {testID: 'ui.base.input:virtual-keyboard:outgoing-0'})).toBeDefined();
      expect(getNodeByProps(renderer, {testID: 'ui.base.input:keyboard-layer-position:outgoing-0'})).toBeDefined();
      expect(getNodeByProps(renderer, {testID: 'ui.base.input:keyboard-hit-shield'})).toBeDefined();
      await act(() => {
        advanceAnimatedTimingsForTests(0.5);
      });
      expect(state?.owner).toBe('none');
      expect(getNodeByProps(renderer, {testID: 'ui.base.input:virtual-keyboard:outgoing-0'})).toBeDefined();
      expect(
        (
          getNodeByProps(renderer, {testID: 'ui.base.input:keyboard-layer-position:outgoing-0'}).props
            .style as readonly unknown[]
        ).some(style => (style as {pointerEvents?: string} | null)?.pointerEvents === 'none'),
      ).toBe(true);
      expect(getNodeByProps(renderer, {testID: 'ui.base.input:keyboard-hit-shield'})).toBeDefined();
      await act(() => {
        advanceAnimatedTimingsForTests(1);
      });
      expect(queryNodesByProps(renderer, {testID: 'ui.base.input:keyboard-layer-position:outgoing-0'})).toHaveLength(0);
    } finally {
      setAnimatedTimingAutoFinishForTests(true);
      await act(() => {
        renderer.unmount();
      });
    }
  });

  it('keeps frozen outgoing and incoming snapshots layered and input-blocked during a different-layout handoff', async () => {
    let state: ReturnType<typeof useInputKeyboardState> | undefined;
    const renderer = await mount(
      <InputSurfaceFrame>
        <StateProbe
          onState={value => {
            state = value;
          }}
        />
        <Field fieldId="handoff-a" testID="sample:handoff-a" layout="alpha" onReady={() => undefined} />
        <Field fieldId="handoff-b" testID="sample:handoff-b" layout="full" onReady={() => undefined} />
      </InputSurfaceFrame>,
    );
    const input = (testID: string) => queryNodes(renderer, 'TextInput').find(node => node.props.testID === testID)!;

    try {
      await focusAndFinishKeyboard(renderer, input('sample:handoff-a'));
      await act(() => {
        getNodeByProps(renderer, {testID: 'ui.base.input:virtual-keyboard:shift'}).props.onPress();
      });
      expect(textContent(getNodeByProps(renderer, {testID: 'ui.base.input:virtual-keyboard:text-a'}))).toBe('A');
      setAnimatedTimingAutoFinishForTests(false);
      const target = input('sample:handoff-b');
      await act(() => {
        target.props.onPressIn({stopPropagation: () => undefined});
      });
      expect(state?.owner).toBe('none');
      expect(state?.activeFieldId).toBeNull();
      expect(state?.blockedFieldId).toBe('handoff-b');
      expect(state?.blockedCapacity).toBeNull();

      await act(() => {
        target.props.onFocus({nativeEvent: {}});
      });
      expect(state?.owner).toBe('none');
      expect(state?.activeFieldId).toBeNull();
      await measureKeyboardLayers(renderer);
      expect(queryNodesByProps(renderer, {testID: 'ui.base.input:virtual-keyboard'}).length).toBeGreaterThan(0);
      const positionLayers = keyboardPositionLayers(renderer);
      expect(positionLayers.map(layer => layer.props.testID)).toEqual([
        'ui.base.input:keyboard-layer-position:active',
        'ui.base.input:keyboard-layer-position:outgoing-0',
      ]);
      expect(
        textContent(getNodeByProps(renderer, {testID: 'ui.base.input:virtual-keyboard:text-a:outgoing-0'})).trim(),
      ).toBe('A');
      expect(textContent(getNodeByProps(renderer, {testID: 'ui.base.input:virtual-keyboard:text-1'}))).toBe('1');
      const shield = getNodeByProps(renderer, {testID: 'ui.base.input:keyboard-hit-shield'});
      expect(shield.props.style).toEqual(expect.arrayContaining([expect.objectContaining({pointerEvents: 'auto'})]));
      expect(shield.props.onStartShouldSetResponder()).toBe(true);
      expect(shield.props.onMoveShouldSetResponder()).toBe(true);
      expect(shield.props.onResponderTerminationRequest()).toBe(false);
      expect(
        positionLayers.every(layer =>
          (Array.isArray(layer.props.style) ? layer.props.style : [layer.props.style]).some(
            (style: unknown) => (style as {pointerEvents?: string} | null)?.pointerEvents === 'none',
          ),
        ),
      ).toBe(true);
      await act(() => {
        advanceAnimatedTimingsForTests(0.4);
      });
      expect(state?.owner).toBe('none');
      expect(
        textContent(getNodeByProps(renderer, {testID: 'ui.base.input:virtual-keyboard:text-a:outgoing-0'})).trim(),
      ).toBe('A');
      expect(getNodeByProps(renderer, {testID: 'ui.base.input:virtual-keyboard:text-1'})).toBeDefined();
      expect(getNodeByProps(renderer, {testID: 'ui.base.input:keyboard-hit-shield'})).toBeDefined();
      await act(() => {
        advanceAnimatedTimingsForTests(1);
      });
      expect(state?.activeFieldId).toBe('handoff-b');
      expect(state?.owner).toBe('virtual');
      expect(queryNodesByProps(renderer, {testID: 'ui.base.input:virtual-keyboard'}).length).toBeGreaterThan(0);
    } finally {
      setAnimatedTimingAutoFinishForTests(true);
      await act(() => {
        renderer.unmount();
      });
    }
  });

  it('retargets an in-flight handoff to the latest pending field without committing the stale target', async () => {
    let state: ReturnType<typeof useInputKeyboardState> | undefined;
    const renderer = await mount(
      <InputSurfaceFrame>
        <StateProbe
          onState={value => {
            state = value;
          }}
        />
        <Field fieldId="retarget-a" testID="sample:retarget-a" layout="alpha" onReady={() => undefined} />
        <Field fieldId="retarget-b" testID="sample:retarget-b" layout="full" onReady={() => undefined} />
        <Field fieldId="retarget-c" testID="sample:retarget-c" layout="financial" onReady={() => undefined} />
      </InputSurfaceFrame>,
    );
    const input = (testID: string) => queryNodes(renderer, 'TextInput').find(node => node.props.testID === testID)!;
    const renderedKeyboardCount = () =>
      queryNodes(renderer, 'View').filter(node => node.props.testID === 'ui.base.input:virtual-keyboard').length;
    const requestFocus = async (testID: string): Promise<void> => {
      const target = input(testID);
      await act(() => {
        target.props.onPressIn({stopPropagation: () => undefined});
      });
      await act(() => {
        target.props.onFocus({nativeEvent: {}});
      });
    };

    try {
      await focusAndFinishKeyboard(renderer, input('sample:retarget-a'));
      setAnimatedTimingAutoFinishForTests(false);
      await requestFocus('sample:retarget-b');
      await measureKeyboardLayers(renderer);
      expect(state?.blockedFieldId).toBe('retarget-b');
      await act(() => {
        advanceAnimatedTimingsForTests(0.4);
      });

      await requestFocus('sample:retarget-c');
      expect(state?.owner).toBe('none');
      expect(state?.activeFieldId).toBeNull();
      expect(state?.blockedFieldId).toBe('retarget-c');
      expect(
        queryNodesByProps(renderer, {testID: 'ui.base.input:keyboard-layer-position:measure'}).length,
      ).toBeGreaterThan(0);
      await measureKeyboardLayers(renderer);
      await act(() => {
        advanceAnimatedTimingsForTests(1);
      });

      expect(state?.activeFieldId).toBe('retarget-c');
      expect(state?.owner).toBe('virtual');
      expect(state?.layout).toBe('financial');
      expect(state?.blockedFieldId).toBeNull();
      expect(renderedKeyboardCount()).toBe(1);
    } finally {
      setAnimatedTimingAutoFinishForTests(true);
      await act(() => {
        renderer.unmount();
      });
    }
  });

  it('keeps frozen keyboard layer identities unique across rapid A-to-B-to-A-to-C retargets', async () => {
    let state: ReturnType<typeof useInputKeyboardState> | undefined;
    const duplicateKeyError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const renderer = await mount(
      <InputSurfaceFrame>
        <StateProbe
          onState={value => {
            state = value;
          }}
        />
        <Field fieldId="rapid-a" testID="sample:rapid-a" layout="alpha" onReady={() => undefined} />
        <Field fieldId="rapid-b" testID="sample:rapid-b" layout="full" onReady={() => undefined} />
        <Field fieldId="rapid-c" testID="sample:rapid-c" layout="financial" onReady={() => undefined} />
      </InputSurfaceFrame>,
    );
    const input = (testID: string) => queryNodes(renderer, 'TextInput').find(node => node.props.testID === testID)!;
    const requestFocus = async (testID: string): Promise<void> => {
      const target = input(testID);
      await act(() => {
        target.props.onPressIn({stopPropagation: () => undefined});
      });
      await act(() => {
        target.props.onFocus({nativeEvent: {}});
      });
    };
    const assertLayerKeysUnique = (): void => {
      const keys = keyboardPositionLayers(renderer).map(layer => layer.props.nativeID);
      expect(keys.every(key => typeof key === 'string' && key.length > 0)).toBe(true);
      expect(new Set(keys).size).toBe(keys.length);
    };

    try {
      await focusAndFinishKeyboard(renderer, input('sample:rapid-a'));
      setAnimatedTimingAutoFinishForTests(false);

      await requestFocus('sample:rapid-b');
      assertLayerKeysUnique();
      await measureKeyboardLayers(renderer);
      await act(() => {
        advanceAnimatedTimingsForTests(0.2);
      });
      assertLayerKeysUnique();

      await requestFocus('sample:rapid-a');
      assertLayerKeysUnique();
      await measureKeyboardLayers(renderer);
      await act(() => {
        advanceAnimatedTimingsForTests(0.2);
      });
      assertLayerKeysUnique();

      await requestFocus('sample:rapid-c');
      expect(state?.blockedFieldId).toBe('rapid-c');
      assertLayerKeysUnique();
      await measureKeyboardLayers(renderer);
      await act(() => {
        advanceAnimatedTimingsForTests(1);
      });

      assertLayerKeysUnique();
      expect(keyboardPositionLayers(renderer)).toHaveLength(1);
      expect(
        duplicateKeyError.mock.calls.filter(([message]) => /same key|duplicate key/i.test(String(message))),
      ).toHaveLength(0);
    } finally {
      setAnimatedTimingAutoFinishForTests(true);
      duplicateKeyError.mockRestore();
      await act(() => {
        renderer.unmount();
      });
    }
  });

  it('does not restart an in-flight presentation when pending ownership commits in the same serial', async () => {
    let commitPendingFocus: ((fieldId: string) => boolean) | undefined;
    const resetSpy = vi.spyOn(Animated.Value.prototype, 'setValue');
    const renderer = await mount(
      <InputSurfaceFrame>
        <PendingFocusCommitProbe
          onReady={value => {
            commitPendingFocus = value;
          }}
        />
        <Field fieldId="same-serial" testID="sample:same-serial" onReady={() => undefined} />
      </InputSurfaceFrame>,
    );
    const input = queryNodes(renderer, 'TextInput').find(node => node.props.testID === 'sample:same-serial')!;

    try {
      setAnimatedTimingAutoFinishForTests(false);
      await act(() => {
        input.props.onFocus({nativeEvent: {}});
      });
      await measureKeyboardLayers(renderer);
      resetSpy.mockClear();

      await act(() => {
        expect(commitPendingFocus?.('same-serial')).toBe(true);
      });
      expect(resetSpy.mock.calls.filter(([value]) => value === 0)).toHaveLength(0);
      await act(() => {
        advanceAnimatedTimingsForTests(1);
      });
    } finally {
      setAnimatedTimingAutoFinishForTests(true);
      resetSpy.mockRestore();
      await act(() => {
        renderer.unmount();
      });
    }
  });

  it('keeps a rendered key handler stable across keyboard measurement', async () => {
    const renderer = await mount(
      <InputSurfaceFrame>
        <Field fieldId="stable-layer" testID="sample:stable-layer" layout="full" onReady={() => undefined} />
      </InputSurfaceFrame>,
    );
    const input = queryNodes(renderer, 'TextInput').find(node => node.props.testID === 'sample:stable-layer')!;
    const keyboardNode = () => getKeyboardKey(renderer, 'text-a');

    try {
      setAnimatedTimingAutoFinishForTests(false);
      await act(() => {
        input.props.onFocus({nativeEvent: {}});
      });
      const beforeMeasure = keyboardNode();
      expect(beforeMeasure).toBeDefined();
      await measureKeyboardLayers(renderer);
      const afterMeasure = keyboardNode();
      expect(afterMeasure).toBe(beforeMeasure);
      expect(afterMeasure?.props.onPress).toBe(beforeMeasure?.props.onPress);
    } finally {
      setAnimatedTimingAutoFinishForTests(true);
      await act(() => {
        renderer.unmount();
      });
    }
  });

  it('keeps a passive keyboard available after parent rerenders', async () => {
    const renderer = await mount(
      <InputSurfaceFrame>
        <PassiveKeyboardHarness />
      </InputSurfaceFrame>,
    );
    const keyboardKey = () => getKeyboardKey(renderer, 'text-1');
    expect(keyboardKey().props.onPress).toEqual(expect.any(Function));
    const rerender = getNodeByProps(renderer, {testID: 'sample:rerender-passive'});
    await act(() => {
      rerender.props.onPress();
    });
    expect(keyboardKey().props.onPress).toEqual(expect.any(Function));
    await act(() => {
      renderer.unmount();
    });
  });

  it('cancels an in-flight handoff from its sampled geometry and removes the overlay only after exit', async () => {
    let controller: InputController | undefined;
    let state: ReturnType<typeof useInputKeyboardState> | undefined;
    const renderer = await mount(
      <InputSurfaceFrame>
        <ControllerProbe
          onReady={value => {
            controller = value;
          }}
        />
        <StateProbe
          onState={value => {
            state = value;
          }}
        />
        <Field fieldId="cancel-a" testID="sample:cancel-a" layout="alpha" onReady={() => undefined} />
        <Field fieldId="cancel-b" testID="sample:cancel-b" layout="full" onReady={() => undefined} />
      </InputSurfaceFrame>,
    );
    const input = (testID: string) => queryNodes(renderer, 'TextInput').find(node => node.props.testID === testID)!;

    try {
      await focusAndFinishKeyboard(renderer, input('sample:cancel-a'));
      setAnimatedTimingAutoFinishForTests(false);
      const target = input('sample:cancel-b');
      await act(() => {
        target.props.onPressIn({stopPropagation: () => undefined});
      });
      await act(() => {
        target.props.onFocus({nativeEvent: {}});
      });
      await measureKeyboardLayers(renderer);
      await act(() => {
        advanceAnimatedTimingsForTests(0.4);
      });
      await act(() => {
        controller!.dismissActiveField();
      });

      expect(state?.owner).toBe('none');
      expect(state?.activeFieldId).toBeNull();
      expect(state?.blockedFieldId).toBeNull();
      expect(queryNodesByProps(renderer, {testID: 'ui.base.input:keyboard-hit-shield'})).toHaveLength(1);
      expect(
        queryNodesByProps(renderer, {testID: 'ui.base.input:keyboard-layer-position:outgoing-0'}).length,
      ).toBeGreaterThan(0);
      await act(() => {
        advanceAnimatedTimingsForTests(0.5);
      });
      expect(queryNodesByProps(renderer, {testID: 'ui.base.input:keyboard-hit-shield'})).toHaveLength(1);
      await act(() => {
        advanceAnimatedTimingsForTests(1);
      });
      expect(keyboardPositionLayers(renderer)).toHaveLength(0);
      expect(queryNodesByProps(renderer, {testID: 'ui.base.input:keyboard-hit-shield'})).toHaveLength(0);
    } finally {
      setAnimatedTimingAutoFinishForTests(true);
      await act(() => {
        renderer.unmount();
      });
    }
  });

  it('keeps same-layout focus and Shift changes on one keyboard without a hidden measurement layer', async () => {
    let state: ReturnType<typeof useInputKeyboardState> | undefined;
    const renderer = await mount(
      <InputSurfaceFrame>
        <StateProbe
          onState={value => {
            state = value;
          }}
        />
        <Field fieldId="stable-a" testID="sample:stable-a" layout="full" onReady={() => undefined} />
        <Field fieldId="stable-b" testID="sample:stable-b" layout="full" onReady={() => undefined} />
      </InputSurfaceFrame>,
    );
    const input = (testID: string) => queryNodes(renderer, 'TextInput').find(node => node.props.testID === testID)!;
    const renderedKeyboardCount = () =>
      queryNodes(renderer, 'View').filter(node => node.props.testID === 'ui.base.input:virtual-keyboard').length;

    await focusAndFinishKeyboard(renderer, input('sample:stable-a'));
    const target = input('sample:stable-b');
    await act(() => {
      target.props.onPressIn({stopPropagation: () => undefined});
    });
    await act(() => {
      target.props.onFocus({nativeEvent: {}});
    });
    await finishKeyboardPresentation(renderer);
    expect(state?.activeFieldId).toBe('stable-b');
    expect(renderedKeyboardCount()).toBe(1);
    expect(queryNodesByProps(renderer, {testID: 'ui.base.input:keyboard-layer-position:measure'})).toHaveLength(0);

    await act(() => {
      getNodeByProps(renderer, {testID: 'ui.base.input:virtual-keyboard:shift'}).props.onPress();
    });
    expect(state?.shift).toBe(true);
    expect(textContent(getNodeByProps(renderer, {testID: 'ui.base.input:virtual-keyboard:text-a'}))).toBe('A');
    expect(renderedKeyboardCount()).toBe(1);
    expect(queryNodesByProps(renderer, {testID: 'ui.base.input:keyboard-layer-position:measure'})).toHaveLength(0);
    await act(() => {
      renderer.unmount();
    });
  });

  it('keeps the first virtual focus pending until its keyboard has been measured and entered', async () => {
    let state: ReturnType<typeof useInputKeyboardState> | undefined;
    const renderer = await mount(
      <InputSurfaceFrame>
        <StateProbe
          onState={value => {
            state = value;
          }}
        />
        <Field fieldId="initial-pending" testID="sample:initial-pending" onReady={() => undefined} />
      </InputSurfaceFrame>,
    );
    const input = queryNodes(renderer, 'TextInput').find(node => node.props.testID === 'sample:initial-pending')!;

    try {
      await act(() => {
        input.props.onFocus({nativeEvent: {}});
      });
      expect(state?.owner).toBe('none');
      expect(state?.activeFieldId).toBeNull();
      expect(state?.blockedFieldId).toBe('initial-pending');
      expect(state?.blockedCapacity).toBeNull();
      await finishKeyboardPresentation(renderer);
      expect(state?.owner).toBe('virtual');
      expect(state?.activeFieldId).toBe('initial-pending');
      expect(state?.visible).toBe(true);
    } finally {
      await act(() => {
        renderer.unmount();
      });
    }
  });

  it('keeps virtual input local, renders the dock, and captures the typed value', async () => {
    let field: InputFieldResult | undefined;
    const renderer = await mount(
      <InputSurfaceFrame>
        <Field
          fieldId="age"
          testID="sample:age"
          keyboardKind="virtual"
          onReady={value => {
            field = value;
          }}
        />
      </InputSurfaceFrame>,
    );
    const input = () => queryNodes(renderer, 'TextInput').find(node => node.props.testID === 'sample:age')!;

    await focusAndFinishKeyboard(renderer, input());
    expect(getNodeByProps(renderer, {testID: 'ui.base.input:virtual-keyboard'})).toBeDefined();

    const one = getNodeByProps(renderer, {testID: 'ui.base.input:virtual-keyboard:text-1'});
    await act(() => {
      one.props.onPress();
    });
    expect(input().props.value).toBe('1');
    expect(field?.captureInputSnapshot()).toEqual({
      revision: 1,
      fields: {age: {value: '1', selection: {start: 1, end: 1}}},
    });
    await act(() => {
      renderer.unmount();
    });
  });

  it('commits virtual keyboard state when a native-less field has no ref', async () => {
    let field: InputFieldResult | undefined;
    let state: ReturnType<typeof useInputKeyboardState> | undefined;
    const renderer = await mount(
      <InputSurfaceFrame>
        <StateProbe
          onState={value => {
            state = value;
          }}
        />
        <Field
          fieldId="native-less"
          testID="sample:native-less"
          nativeLess
          onReady={value => {
            field = value;
          }}
        />
      </InputSurfaceFrame>,
    );

    expect(field?.inputProps.inputRef).toBeNull();
    await act(() => {
      field?.focus();
    });
    await finishKeyboardPresentation(renderer);
    expect(state?.activeFieldId).toBe('native-less');
    expect(state?.owner).toBe('virtual');
    expect(getNodeByProps(renderer, {testID: 'ui.base.input:virtual-keyboard'})).toBeDefined();
    await act(() => {
      renderer.unmount();
    });
  });

  it('exposes the same synchronous snapshot boundary without subscribing to values', async () => {
    let capture: (() => ReturnType<ReturnType<typeof useInputSnapshot>>) | undefined;
    const renderer = await mount(
      <InputSurfaceFrame>
        <SnapshotProbe
          onReady={value => {
            capture = value;
          }}
        />
        <Field fieldId="snapshot" testID="sample:snapshot" keyboardKind="virtual" onReady={() => undefined} />
      </InputSurfaceFrame>,
    );
    const input = queryNodes(renderer, 'TextInput').find(node => node.props.testID === 'sample:snapshot')!;
    await focusAndFinishKeyboard(renderer, input);
    const one = getNodeByProps(renderer, {testID: 'ui.base.input:virtual-keyboard:text-1'});
    await act(() => {
      one.props.onPress();
    });
    expect(capture?.()).toEqual({
      revision: 1,
      fields: {snapshot: {value: '1', selection: {start: 1, end: 1}}},
    });
    await act(() => {
      renderer.unmount();
    });
  });

  it('keeps the virtual dock as the only keyboard owner across field changes', async () => {
    const ready: Record<string, InputFieldResult> = {};
    const renderer = await mount(
      <InputSurfaceFrame>
        <Field
          fieldId="virtual"
          testID="sample:virtual"
          keyboardKind="virtual"
          onReady={value => {
            ready.virtual = value;
          }}
        />
        <Field
          fieldId="second"
          testID="sample:second"
          keyboardKind="virtual"
          onReady={value => {
            ready.second = value;
          }}
        />
      </InputSurfaceFrame>,
    );
    const input = (testID: string) => queryNodes(renderer, 'TextInput').find(node => node.props.testID === testID)!;

    await focusAndFinishKeyboard(renderer, input('sample:virtual'));
    expect(getNodeByProps(renderer, {testID: 'ui.base.input:virtual-keyboard'})).toBeDefined();
    await focusAndFinishKeyboard(renderer, input('sample:second'));
    expect(
      queryNodes(renderer, 'View').filter(node => node.props.testID === 'ui.base.input:virtual-keyboard'),
    ).toHaveLength(1);
    await act(() => {
      renderer.unmount();
    });
  });

  it('keeps native focus while switching between virtual fields', async () => {
    const focusHarness = createNativeFocusHarness();
    const renderer = await mountWithNodeMock(
      <InputSurfaceFrame>
        <Field fieldId="owner-virtual" testID="sample:owner-virtual" keyboardKind="virtual" onReady={() => undefined} />
        <Field fieldId="owner-second" testID="sample:owner-second" keyboardKind="virtual" onReady={() => undefined} />
      </InputSurfaceFrame>,
      focusHarness.nativeRefFactory,
    );

    await focusNativeHarnessAndFinish(renderer, focusHarness, 'sample:owner-virtual');
    expect(
      queryNodes(renderer, 'View').filter(node => node.props.testID === 'ui.base.input:virtual-keyboard'),
    ).toHaveLength(1);
    expect(focusHarness.isFocused('sample:owner-virtual')).toBe(true);

    await focusNativeHarnessAndFinish(renderer, focusHarness, 'sample:owner-second');
    expect(
      queryNodes(renderer, 'View').filter(node => node.props.testID === 'ui.base.input:virtual-keyboard'),
    ).toHaveLength(1);
    expect(focusHarness.isFocused('sample:owner-second')).toBe(true);

    await focusNativeHarnessAndFinish(renderer, focusHarness, 'sample:owner-virtual');
    expect(
      queryNodes(renderer, 'View').filter(node => node.props.testID === 'ui.base.input:virtual-keyboard'),
    ).toHaveLength(1);
    expect(focusHarness.isFocused('sample:owner-virtual')).toBe(true);
    expect(
      queryNodes(renderer, 'View').filter(node => node.props.testID === 'ui.base.input:virtual-keyboard'),
    ).toHaveLength(1);

    await focusNativeHarnessAndFinish(renderer, focusHarness, 'sample:owner-second');
    expect(
      queryNodes(renderer, 'View').filter(node => node.props.testID === 'ui.base.input:virtual-keyboard'),
    ).toHaveLength(1);
    expect(focusHarness.isFocused('sample:owner-second')).toBe(true);
    await act(() => {
      renderer.unmount();
    });
  });

  it('preserves the first pointer focus when preflight switches between virtual fields', async () => {
    const focusHarness = createNativeFocusHarness();
    let state: ReturnType<typeof useInputKeyboardState> | undefined;
    const renderer = await mountWithNodeMock(
      <InputSurfaceFrame>
        <StateProbe
          onState={value => {
            state = value;
          }}
        />
        <Field
          fieldId="owner-first-pointer"
          testID="sample:owner-first-pointer"
          keyboardKind="virtual"
          onReady={() => undefined}
        />
        <Field
          fieldId="owner-virtual-pointer"
          testID="sample:owner-virtual-pointer"
          keyboardKind="virtual"
          onReady={() => undefined}
        />
      </InputSurfaceFrame>,
      focusHarness.nativeRefFactory,
    );
    const virtualInput = queryNodes(renderer, 'TextInput').find(
      node => node.props.testID === 'sample:owner-virtual-pointer',
    )!;

    await focusNativeHarnessAndFinish(renderer, focusHarness, 'sample:owner-first-pointer');
    expect(state?.owner).toBe('virtual');
    const stopPropagation = vi.fn();
    await act(() => {
      virtualInput.props.onPressIn?.({stopPropagation});
    });
    expect(stopPropagation).toHaveBeenCalledTimes(1);
    await focusNativeHarnessAndFinish(renderer, focusHarness, 'sample:owner-virtual-pointer');
    expect(focusHarness.isFocused('sample:owner-virtual-pointer')).toBe(true);
    expect(state?.activeFieldId).toBe('owner-virtual-pointer');
    expect(state?.owner).toBe('virtual');
    expect(getNodeByProps(renderer, {testID: 'ui.base.input:virtual-keyboard'})).toBeDefined();
    await act(() => {
      renderer.unmount();
    });
  });

  it('uses the same preflight before programmatic focus-next across virtual fields', async () => {
    const focusHarness = createNativeFocusHarness();
    const ready: Record<string, InputFieldResult> = {};
    let state: ReturnType<typeof useInputKeyboardState> | undefined;
    const renderer = await mountWithNodeMock(
      <InputSurfaceFrame>
        <StateProbe
          onState={value => {
            state = value;
          }}
        />
        <Field
          fieldId="complete-owner-first"
          testID="sample:owner-first-pointer-next"
          keyboardKind="virtual"
          onReady={value => {
            ready.first = value;
          }}
        />
        <Field
          fieldId="complete-owner-virtual"
          testID="sample:owner-virtual-pointer-next"
          keyboardKind="virtual"
          onReady={value => {
            ready.virtual = value;
          }}
        />
      </InputSurfaceFrame>,
      focusHarness.nativeRefFactory,
    );

    await focusNativeHarnessAndFinish(renderer, focusHarness, 'sample:owner-first-pointer-next');
    await act(() => {
      ready.first.complete();
    });
    await finishKeyboardPresentation(renderer);
    expect(focusHarness.isFocused('sample:owner-virtual-pointer-next')).toBe(true);
    expect(state?.activeFieldId).toBe('complete-owner-virtual');
    expect(state?.owner).toBe('virtual');
    expect(getNodeByProps(renderer, {testID: 'ui.base.input:virtual-keyboard'})).toBeDefined();
    await act(() => {
      renderer.unmount();
    });
    vi.restoreAllMocks();
  });

  it('keeps virtual ownership when native blur is only the no-IME side effect', async () => {
    let field: InputFieldResult | undefined;
    const renderer = await mount(
      <InputSurfaceFrame>
        <Field
          fieldId="virtual-native-blur"
          testID="sample:virtual-native-blur"
          keyboardKind="virtual"
          onReady={value => {
            field = value;
          }}
        />
      </InputSurfaceFrame>,
    );
    const input = queryNodes(renderer, 'TextInput').find(node => node.props.testID === 'sample:virtual-native-blur')!;
    await focusAndFinishKeyboard(renderer, input);
    expect(getNodeByProps(renderer, {testID: 'ui.base.input:virtual-keyboard'})).toBeDefined();

    await act(() => {
      input.props.onBlur();
    });
    expect(getNodeByProps(renderer, {testID: 'ui.base.input:virtual-keyboard'})).toBeDefined();

    await act(() => {
      field?.blur();
    });
    expect(queryNodesByProps(renderer, {testID: 'ui.base.input:virtual-keyboard'})).toHaveLength(0);
    await act(() => {
      renderer.unmount();
    });
  });

  it('dismisses the active keyboard when the surface content is pressed outside an input', async () => {
    const renderer = await mount(
      <InputSurfaceFrame>
        <Field
          fieldId="outside-dismiss"
          testID="sample:outside-dismiss"
          keyboardKind="virtual"
          onReady={() => undefined}
        />
        <PrimitiveHeading testID="sample:outside-dismiss:title">标题</PrimitiveHeading>
      </InputSurfaceFrame>,
    );
    const input = queryNodes(renderer, 'TextInput').find(node => node.props.testID === 'sample:outside-dismiss')!;
    await focusAndFinishKeyboard(renderer, input);
    expect(getNodeByProps(renderer, {testID: 'ui.base.input:virtual-keyboard'})).toBeDefined();

    const keyboard = getNodeByProps(renderer, {testID: 'ui.base.input:virtual-keyboard'}) as unknown as Readonly<{
      readonly props: Readonly<{
        readonly onTouchEnd?: (event: Readonly<{readonly stopPropagation: () => void}>) => void;
      }>;
    }>;
    const stopKeyboardPropagation = vi.fn();
    keyboard.props.onTouchEnd?.({stopPropagation: stopKeyboardPropagation});
    expect(stopKeyboardPropagation).toHaveBeenCalledTimes(1);
    expect(getNodeByProps(renderer, {testID: 'ui.base.input:virtual-keyboard'})).toBeDefined();

    const content = getNodeByProps(renderer, {testID: 'ui.base.input:surface-content'}) as unknown as Readonly<{
      readonly props: Readonly<{
        readonly onTouchStart?: (
          event: Readonly<{readonly nativeEvent: Readonly<{readonly pageX: number; readonly pageY: number}>}>,
        ) => void;
        readonly onTouchEnd?: (
          event: Readonly<{readonly nativeEvent: Readonly<{readonly pageX: number; readonly pageY: number}>}>,
        ) => void;
      }>;
    }>;
    const stopInputPropagation = vi.fn();
    input.props.onTouchEnd?.({stopPropagation: stopInputPropagation});
    expect(stopInputPropagation).toHaveBeenCalledTimes(1);
    await act(() => {
      content.props.onTouchStart?.({nativeEvent: {pageX: 10, pageY: 20}});
      content.props.onTouchEnd?.({nativeEvent: {pageX: 10, pageY: 20}});
    });
    expect(queryNodesByProps(renderer, {testID: 'ui.base.input:virtual-keyboard'})).toHaveLength(0);
    await act(() => {
      renderer.unmount();
    });
  });

  it('does not let business surface dismissal clear a non-business scoped field', async () => {
    let field: InputFieldResult | undefined;
    let controller: InputController | undefined;
    const renderer = await mount(
      <InputSurfaceFrame>
        <Field
          fieldId="admin-scoped-field"
          testID="sample:admin-scoped-field"
          nativeLess
          focusScopeId="admin.console"
          onReady={value => {
            field = value;
          }}
        />
        <ControllerProbe
          onReady={value => {
            controller = value;
          }}
        />
        <PrimitiveHeading testID="sample:admin-scoped-field:title">标题</PrimitiveHeading>
      </InputSurfaceFrame>,
    );

    await act(() => {
      controller?.activateFocusScope('admin.console');
      field?.focus();
    });
    await finishKeyboardPresentation(renderer);
    expect(getNodeByProps(renderer, {testID: 'ui.base.input:virtual-keyboard'})).toBeDefined();

    const content = getNodeByProps(renderer, {testID: 'ui.base.input:surface-content'}) as unknown as Readonly<{
      readonly props: Readonly<{
        readonly onTouchStart?: (
          event: Readonly<{readonly nativeEvent: Readonly<{readonly pageX: number; readonly pageY: number}>}>,
        ) => void;
        readonly onTouchEnd?: (
          event: Readonly<{readonly nativeEvent: Readonly<{readonly pageX: number; readonly pageY: number}>}>,
        ) => void;
      }>;
    }>;
    await act(() => {
      content.props.onTouchStart?.({nativeEvent: {pageX: 10, pageY: 20}});
      content.props.onTouchEnd?.({nativeEvent: {pageX: 10, pageY: 20}});
    });
    expect(getNodeByProps(renderer, {testID: 'ui.base.input:virtual-keyboard'})).toBeDefined();

    await act(() => {
      field?.blur();
    });
    expect(queryNodesByProps(renderer, {testID: 'ui.base.input:virtual-keyboard'})).toHaveLength(0);
    await act(() => {
      renderer.unmount();
    });
  });

  it('keeps the active keyboard during a surface swipe', async () => {
    const renderer = await mount(
      <InputSurfaceFrame>
        <Field fieldId="surface-swipe" testID="sample:surface-swipe" keyboardKind="virtual" onReady={() => undefined} />
        <PrimitiveHeading testID="sample:surface-swipe:title">标题</PrimitiveHeading>
      </InputSurfaceFrame>,
    );
    const input = queryNodes(renderer, 'TextInput').find(node => node.props.testID === 'sample:surface-swipe')!;
    await focusAndFinishKeyboard(renderer, input);
    expect(getNodeByProps(renderer, {testID: 'ui.base.input:virtual-keyboard'})).toBeDefined();

    const content = getNodeByProps(renderer, {testID: 'ui.base.input:surface-content'}) as unknown as Readonly<{
      readonly props: Readonly<{
        readonly onTouchStart?: (
          event: Readonly<{readonly nativeEvent: Readonly<{readonly pageX: number; readonly pageY: number}>}>,
        ) => void;
        readonly onTouchEnd?: (
          event: Readonly<{readonly nativeEvent: Readonly<{readonly pageX: number; readonly pageY: number}>}>,
        ) => void;
      }>;
    }>;
    await act(() => {
      content.props.onTouchStart?.({nativeEvent: {pageX: 10, pageY: 20}});
      content.props.onTouchEnd?.({nativeEvent: {pageX: 40, pageY: 20}});
    });
    expect(getNodeByProps(renderer, {testID: 'ui.base.input:virtual-keyboard'})).toBeDefined();
    await act(() => {
      renderer.unmount();
    });
  });

  it('keeps virtual selection under the native input while text changes', async () => {
    let capture: (() => ReturnType<ReturnType<typeof useInputSnapshot>>) | undefined;
    const renderer = await mount(
      <InputSurfaceFrame>
        <SnapshotProbe
          onReady={value => {
            capture = value;
          }}
        />
        <Field
          fieldId="virtual-selection"
          testID="sample:virtual-selection"
          keyboardKind="virtual"
          onReady={() => undefined}
        />
      </InputSurfaceFrame>,
    );
    const input = queryNodes(renderer, 'TextInput').find(node => node.props.testID === 'sample:virtual-selection')!;
    expect(input.props.selection).toEqual({start: 0, end: 0});
    await focusAndFinishKeyboard(renderer, input);
    await act(() => {
      input.props.onChangeText('1');
    });
    await act(() => {
      input.props.onChangeText('12');
    });
    expect(input.props.value).toBe('12');
    expect(input.props.selection).toEqual({start: 0, end: 0});
    await act(() => {
      input.props.onSelectionChange({nativeEvent: {selection: {start: 2, end: 2}}});
    });
    expect(capture?.()).toEqual({
      revision: 1,
      fields: {'virtual-selection': {value: '12', selection: {start: 2, end: 2}}},
    });
    await act(() => {
      renderer.unmount();
    });
  });

  it('stops an input press from bubbling into surface dismissal', async () => {
    const renderer = await mount(
      <InputSurfaceFrame>
        <Field
          fieldId="press-boundary"
          testID="sample:press-boundary"
          keyboardKind="virtual"
          onReady={() => undefined}
        />
      </InputSurfaceFrame>,
    );
    const input = queryNodes(renderer, 'TextInput').find(node => node.props.testID === 'sample:press-boundary')!;
    const stopPropagation = vi.fn();
    await act(() => {
      input.props.onPressIn?.({stopPropagation});
    });
    expect(stopPropagation).toHaveBeenCalledTimes(1);
    await act(() => {
      renderer.unmount();
    });
  });

  it('stops a web input click from bubbling into surface dismissal', async () => {
    const originalDocument = (globalThis as typeof globalThis & {readonly document?: unknown}).document;
    Object.defineProperty(globalThis, 'document', {configurable: true, value: {}});
    try {
      const renderer = await mount(
        <InputSurfaceFrame>
          <Field
            fieldId="web-press-boundary"
            testID="sample:web-press-boundary"
            keyboardKind="virtual"
            onReady={() => undefined}
          />
        </InputSurfaceFrame>,
      );
      const input = queryNodes(renderer, 'TextInput').find(node => node.props.testID === 'sample:web-press-boundary')!;
      const stopPropagation = vi.fn();
      await act(() => {
        input.props.onClick?.({stopPropagation});
      });
      expect(stopPropagation).toHaveBeenCalledTimes(1);
      await act(() => {
        renderer.unmount();
      });
    } finally {
      Object.defineProperty(globalThis, 'document', {configurable: true, value: originalDocument});
    }
  });

  it('protects only the pending field from web surface dismissal', async () => {
    const originalDocument = (globalThis as typeof globalThis & {readonly document?: unknown}).document;
    Object.defineProperty(globalThis, 'document', {configurable: true, value: {}});
    let state: ReturnType<typeof useInputKeyboardState> | undefined;
    try {
      const renderer = await mount(
        <InputSurfaceFrame>
          <StateProbe
            onState={value => {
              state = value;
            }}
          />
          <Field
            fieldId="web-pending-target"
            testID="sample:web-pending-target"
            keyboardKind="virtual"
            onReady={() => undefined}
          />
        </InputSurfaceFrame>,
      );
      const input = queryNodes(renderer, 'TextInput').find(node => node.props.testID === 'sample:web-pending-target')!;
      const content = getNodeByProps(renderer, {testID: 'ui.base.input:surface-content'}) as unknown as Readonly<{
        readonly props: Readonly<{readonly onClick?: (event: unknown) => void}>;
      }>;
      await act(() => {
        input.props.onFocus?.();
      });
      expect(state?.blockedFieldId).toBe('web-pending-target');
      const pendingTarget = {
        getAttribute: (name: string) => (name === 'data-testid' ? 'sample:web-pending-target' : null),
        closest: (selector: string) => (selector === 'input,textarea' ? pendingTarget : null),
      };
      await act(() => {
        content.props.onClick?.({nativeEvent: {target: pendingTarget}});
      });
      expect(state?.blockedFieldId).toBe('web-pending-target');
      expect(state?.owner).toBe('none');
      await act(() => {
        content.props.onClick?.({nativeEvent: {target: {}}});
      });
      expect(state?.blockedFieldId).toBeNull();
      expect(state?.owner).toBe('none');
      await act(() => {
        renderer.unmount();
      });
    } finally {
      Object.defineProperty(globalThis, 'document', {configurable: true, value: originalDocument});
    }
  });

  it('routes the real complete key to the next field and closes on the final field', async () => {
    const firstState: {current: ReturnType<typeof useInputKeyboardState> | null} = {current: null};
    const renderer = await mountWithFocusableInputs(
      <InputSurfaceFrame>
        <StateProbe
          onState={value => {
            firstState.current = value;
          }}
        />
        <Field
          fieldId="complete-first"
          testID="sample:complete-first"
          keyboardKind="virtual"
          onReady={() => undefined}
        />
        <Field
          fieldId="complete-second"
          testID="sample:complete-second"
          keyboardKind="virtual"
          onReady={() => undefined}
        />
      </InputSurfaceFrame>,
    );
    const first = queryNodes(renderer, 'TextInput').find(node => node.props.testID === 'sample:complete-first')!;
    await focusAndFinishKeyboard(renderer, first);
    expect(firstState.current?.hasNextField).toBe(true);
    await act(() => {
      getNodeByProps(renderer, {testID: 'ui.base.input:virtual-keyboard:complete'}).props.onPress();
    });
    expect(firstState.current?.activeFieldId).toBe('complete-second');
    expect(firstState.current?.owner).toBe('virtual');
    expect(getNodeByProps(renderer, {testID: 'ui.base.input:virtual-keyboard'})).toBeDefined();
    await act(() => {
      renderer.unmount();
    });

    const finalState: {current: ReturnType<typeof useInputKeyboardState> | null} = {current: null};
    const finalRenderer = await mountWithFocusableInputs(
      <InputSurfaceFrame>
        <StateProbe
          onState={value => {
            finalState.current = value;
          }}
        />
        <Field
          fieldId="complete-final"
          testID="sample:complete-final"
          keyboardKind="virtual"
          onReady={() => undefined}
        />
      </InputSurfaceFrame>,
    );
    const final = queryNodes(finalRenderer, 'TextInput').find(node => node.props.testID === 'sample:complete-final')!;
    await focusAndFinishKeyboard(finalRenderer, final);
    expect(finalState.current?.hasNextField).toBe(false);
    await act(() => {
      getNodeByProps(finalRenderer, {testID: 'ui.base.input:virtual-keyboard:complete'}).props.onPress();
    });
    expect(finalState.current?.activeFieldId).toBeNull();
    expect(finalState.current?.owner).toBe('none');
    expect(queryNodesByProps(finalRenderer, {testID: 'ui.base.input:virtual-keyboard'})).toHaveLength(0);
    await act(() => {
      finalRenderer.unmount();
    });
  });

  it('does not rerender an idle field for a key pressed into another field', async () => {
    const renders: Record<string, number> = {};
    const renderer = await mount(
      <InputSurfaceFrame>
        <RenderCountingField
          fieldId="active-render-counter"
          testID="sample:active-render-counter"
          keyboardKind="virtual"
          onRender={count => {
            renders.active = count;
          }}
        />
        <RenderCountingField
          fieldId="idle-render-counter"
          testID="sample:idle-render-counter"
          keyboardKind="virtual"
          onRender={count => {
            renders.idle = count;
          }}
        />
      </InputSurfaceFrame>,
    );
    const input = queryNodes(renderer, 'TextInput').find(node => node.props.testID === 'sample:active-render-counter')!;
    await focusAndFinishKeyboard(renderer, input);
    const idleBeforeKey = renders.idle;
    const one = getNodeByProps(renderer, {testID: 'ui.base.input:virtual-keyboard:text-1'});
    await act(() => {
      one.props.onPress();
    });
    expect(renders.idle).toBe(idleBeforeKey);
    expect(renders.active).toBeGreaterThan(idleBeforeKey);
    await act(() => {
      renderer.unmount();
    });
  });

  it('reports a typed capacity failure while preserving the decision action', async () => {
    let state: ReturnType<typeof useInputKeyboardState> | undefined;
    const renderer = await mount(
      <InputSurfaceFrame>
        <StateProbe
          onState={value => {
            state = value;
          }}
        />
        <Field fieldId="too-small" testID="sample:too-small" keyboardKind="virtual" onReady={() => undefined} />
      </InputSurfaceFrame>,
      {width: 320, height: 300},
    );
    const input = queryNodes(renderer, 'TextInput').find(node => node.props.testID === 'sample:too-small')!;
    await focusAndFinishKeyboard(renderer, input);
    expect(state?.blockedCapacity).toBe('unsupported-width');
    expect(state?.visible).toBe(false);
    expect(getNodeByProps(renderer, {testID: 'sample:decision'})).toBeDefined();
    expect(getNodeByProps(renderer, {testID: 'ui.base.input:unsupported-size'}).props.children).toContain(
      '至少 360 个逻辑单位',
    );
    expect(queryNodesByProps(renderer, {testID: 'ui.base.input:virtual-keyboard'})).toHaveLength(0);
    await act(() => {
      renderer.unmount();
    });
  });

  it('blocks covered business writes, keeps the active layer field writable, and never restores prior native focus', async () => {
    let boundary: SurfaceFocusBoundaryListener | undefined;
    let controller: InputController | undefined;
    let businessField: InputFieldResult | undefined;
    let overlayField: InputFieldResult | undefined;
    let snapshot: (() => ReturnType<ReturnType<typeof useInputSnapshot>>) | undefined;
    let keyboardState: ReturnType<typeof useInputKeyboardState> | undefined;
    const focusHarness = createNativeFocusHarness();
    const renderer = await mountWithNodeMock(
      <InputSurfaceFrame>
        <BoundaryProbe
          onReady={value => {
            boundary = value;
          }}
        />
        <ControllerProbe
          onReady={value => {
            controller = value;
          }}
        />
        <SnapshotProbe
          onReady={value => {
            snapshot = value;
          }}
        />
        <StateProbe
          onState={value => {
            keyboardState = value;
          }}
        />
        <Field
          fieldId="owner-business"
          testID="sample:owner-business"
          onReady={value => {
            businessField = value;
          }}
        />
        <Field
          fieldId="owner-overlay"
          testID="sample:owner-overlay"
          focusScopeId="admin.console"
          onReady={value => {
            overlayField = value;
          }}
        />
      </InputSurfaceFrame>,
      focusHarness.nativeRefFactory,
    );
    const businessInput = businessField?.inputProps;
    const overlayInput = overlayField?.inputProps;
    if (businessInput === undefined || overlayInput === undefined)
      throw new Error('input field props were not registered');
    const businessChange = businessInput.onChangeText;
    const businessSelection = businessInput.onSelectionChange;
    const overlayChange = overlayInput.onChangeText;
    if (businessChange === undefined || businessSelection === undefined || overlayChange === undefined) {
      throw new Error('input field event callbacks were not registered');
    }
    await focusNativeHarnessAndFinish(renderer, focusHarness, 'sample:owner-business');
    await act(() => {
      businessChange('business-before');
    });
    expect(snapshot?.().fields['owner-business']?.value).toBe('business-before');
    expect(getNodeByProps(renderer, {testID: 'ui.base.input:virtual-keyboard'})).toBeDefined();

    await act(() => {
      boundary?.('suspend');
    });
    expect(focusHarness.isFocused('sample:owner-business')).toBe(false);
    expect(queryNodesByProps(renderer, {testID: 'ui.base.input:virtual-keyboard'})).toHaveLength(0);
    await act(() => {
      businessChange('covered-write');
      businessSelection({nativeEvent: {selection: {start: 0, end: 0}}});
    });
    expect(snapshot?.().fields['owner-business']?.value).toBe('business-before');

    await act(() => {
      controller?.activateFocusScope('admin.console');
    });
    await focusNativeHarnessAndFinish(renderer, focusHarness, 'sample:owner-overlay');
    await act(() => {
      overlayChange('overlay-write');
    });
    expect(snapshot?.().fields['owner-overlay']?.value).toBe('overlay-write');

    await act(() => {
      controller?.activateFocusScope('business');
      boundary?.('restore');
    });
    expect(focusHarness.isFocused('sample:owner-business')).toBe(false);
    expect(focusHarness.isFocused('sample:owner-overlay')).toBe(false);
    expect(keyboardState?.activeFieldId).toBeNull();
    expect(keyboardState?.owner).toBe('none');
    expect(queryNodesByProps(renderer, {testID: 'ui.base.input:virtual-keyboard'})).toHaveLength(0);
    await act(() => {
      renderer.unmount();
    });
  });
});
