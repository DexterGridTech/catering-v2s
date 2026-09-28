import {useLayoutEffect, type RefObject} from 'react';
import {act, render, type RenderResult} from '@testing-library/react-native';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {PrimitiveInput, type PrimitiveInputHandle} from '@catering-v2s/ui-base-primitives';
import {ScrollView, TextInput, View} from 'react-native';
import {InputScrollArea} from '../src/components/InputScrollArea';
import {InputSurfaceFrame} from '../src/components/InputSurfaceFrame';
import {useInputField} from '../src/hooks/useInputField';
import {useInputKeyboardState, useInputScrollAncestor} from '../src/contexts/context';
import {
  advanceAnimatedTimingsForTests,
  setAnimatedTimingAutoFinishForTests,
} from '../../../../../../tools/terminal-shared/react-native-vitest-entry';
import {
  resetNativeTestRefFactory,
  setNativeTestRefFactory,
} from '../../../../../../tools/terminal-shared/rntl-native-test-host';
import {
  getRenderedByProps,
  queryRenderedByProps,
  queryRenderedByType,
  type RenderedTestInstance,
} from '../../../../../../tools/terminal-shared/rntl-rendered-tree';

vi.mock('react-native', async importOriginal => {
  const actual = await importOriginal<typeof import('react-native')>();
  const {withNativeTestHosts} = await import('../../../../../../tools/terminal-shared/rntl-native-test-host');
  return withNativeTestHosts(actual);
});

type InputRef = RefObject<PrimitiveInputHandle | null>;
type ScrollRequest = (keyboardHeight: number) => void;
type NativeTestNode = Omit<RenderedTestInstance, 'props'> &
  Readonly<{
    readonly props: Readonly<Record<string, unknown>> & {
      readonly onLayout: (event: unknown) => unknown;
      readonly onContentSizeChange: (width: number, height: number) => unknown;
      readonly onScroll: (event: unknown) => unknown;
      readonly onScrollEndDrag: (event: unknown) => unknown;
      readonly onFocus: (event: Readonly<{readonly nativeEvent: Readonly<Record<string, never>>}>) => unknown;
    };
  }>;

const getTestNode = (renderer: RenderResult, testID: string): NativeTestNode =>
  getRenderedByProps(renderer, {testID}) as NativeTestNode;
const queryTestNodes = (renderer: RenderResult, type: string): NativeTestNode[] =>
  queryRenderedByType(renderer, type) as NativeTestNode[];

const Field = ({onScrollReady}: Readonly<{readonly onScrollReady?: (request: ScrollRequest) => void}>) => {
  const field = useInputField({
    fieldId: 'scroll-field',
    testID: 'sample:scroll-field',
    accessibilityLabel: 'scroll-field',
    keyboardKind: 'virtual',
    layout: 'numeric',
  });
  const scrollAncestor = useInputScrollAncestor();
  const inputRef = field.inputProps.inputRef as InputRef;
  useLayoutEffect(() => {
    if (scrollAncestor === null || onScrollReady === undefined) return;
    onScrollReady(keyboardHeight => scrollAncestor('scroll-field', inputRef, keyboardHeight));
  }, [inputRef, onScrollReady, scrollAncestor]);
  return <PrimitiveInput {...field.inputProps} />;
};

const KeyboardStateProbe = ({
  onState,
}: Readonly<{readonly onState: (state: ReturnType<typeof useInputKeyboardState>) => void}>) => {
  onState(useInputKeyboardState());
  return null;
};

const measureIncomingKeyboard = async (renderer: RenderResult): Promise<void> => {
  const layer = getTestNode(renderer, 'ui.base.input:keyboard-layer-position:measure');
  await act(async () => {
    layer.props.onLayout({nativeEvent: {layout: {height: 246}}});
  });
};

const TEST_FRAME = {width: 960, height: 540} as const;

const mountWithNativeGeometry = async (
  scrollTo: (options: Readonly<{readonly y: number; readonly animated?: boolean}>) => void,
  contentHeight = 900,
): Promise<
  Readonly<{
    readonly renderer: RenderResult;
    readonly requestScroll: {readonly current: ScrollRequest | null};
    readonly keyboardState: {current: ReturnType<typeof useInputKeyboardState> | null};
  }>
> => {
  const requestScroll = {current: null as ScrollRequest | null};
  const keyboardState = {current: null as ReturnType<typeof useInputKeyboardState> | null};
  const surfaceRootNode = {};
  const contentNativeNode = {};
  const onScrollReady = (request: ScrollRequest) => {
    requestScroll.current = request;
  };
  setNativeTestRefFactory((hostName, props) => {
    if (hostName === 'View' && props.testID === 'ui.base.input:surface-frame') return surfaceRootNode;
    if (props.testID === 'sample:scroll-field') {
      return {
        measureInWindow: () => {
          throw new Error('window coordinates must not drive scroll delta');
        },
        measureLayout: (
          relativeToNativeNode: unknown,
          callback: (x: number, y: number, width: number, height: number) => void,
        ) => {
          expect(relativeToNativeNode).toBe(contentNativeNode);
          callback(0, 530, 100, 40);
        },
        focus: () => undefined,
        blur: () => undefined,
      };
    }
    if (props.testID === 'sample:scroll-area' && hostName === 'ScrollView') {
      return {
        measureInWindow: () => {
          throw new Error('window coordinates must not drive scroll delta');
        },
        measureLayout: (
          relativeToNativeNode: unknown,
          callback: (x: number, y: number, width: number, height: number) => void,
        ) => {
          expect(relativeToNativeNode).toBe(surfaceRootNode);
          callback(40, 80, 300, 270);
        },
        getInnerViewRef: () => contentNativeNode,
        getInnerViewNode: () => {
          throw new Error('numeric content node must not be used');
        },
        scrollTo,
      };
    }
    return {};
  });
  const renderer = await render(
    <View testID="sample:scaled-host" style={{transform: [{scaleX: 1.25}, {scaleY: 0.5}]}}>
      <InputSurfaceFrame>
        <InputScrollArea testID="sample:scroll-area">
          <Field onScrollReady={onScrollReady} />
        </InputScrollArea>
        <KeyboardStateProbe
          onState={state => {
            keyboardState.current = state;
          }}
        />
      </InputSurfaceFrame>
    </View>,
  );
  await act(async () => {
    getTestNode(renderer, 'ui.base.input:surface-frame').props.onLayout({
      nativeEvent: {layout: TEST_FRAME},
    });
  });
  const scrollView = queryTestNodes(renderer, 'ScrollView').find(node => node.props.testID === 'sample:scroll-area')!;
  await act(async () => {
    scrollView.props.onLayout({nativeEvent: {layout: {x: 0, y: 0, width: 300, height: 270}}});
    scrollView.props.onContentSizeChange(300, contentHeight);
    scrollView.props.onScroll({nativeEvent: {contentOffset: {y: 100}}});
  });
  return {renderer, requestScroll, keyboardState};
};

afterEach(resetNativeTestRefFactory);

describe('InputScrollArea', () => {
  it('forwards a presentation-only trailing content inset to the shared scroll primitive', async () => {
    const renderer = await render(
      <InputScrollArea testID="sample:scroll-padding" contentPaddingBottom={64}>
        <View testID="sample:scroll-child" />
      </InputScrollArea>,
    );
    const scrollView = queryTestNodes(renderer, 'ScrollView').find(
      node => node.props.testID === 'sample:scroll-padding',
    )!;
    expect(scrollView.props.contentContainerStyle).toEqual({gap: 12, paddingBottom: 64});
    await renderer.unmount();
  });

  it('uses content-local coordinates when a scaled host has a non-zero scroll offset', async () => {
    const scrollTo = vi.fn();
    const {renderer, requestScroll} = await mountWithNativeGeometry(scrollTo);
    expect(
      (getTestNode(renderer, 'sample:scaled-host').props.style as {readonly transform: unknown}).transform,
    ).toEqual([{scaleX: 1.25}, {scaleY: 0.5}]);
    const scrollView = queryTestNodes(renderer, 'ScrollView').find(node => node.props.testID === 'sample:scroll-area')!;
    expect(requestScroll.current).not.toBeNull();
    const input = queryTestNodes(renderer, 'TextInput').find(node => node.props.testID === 'sample:scroll-field')!;
    try {
      setAnimatedTimingAutoFinishForTests(false);
      await act(async () => {
        input.props.onFocus({nativeEvent: {}});
      });
      await measureIncomingKeyboard(renderer);
      await act(async () => {
        requestScroll.current!(100);
      });
      expect(scrollTo).toHaveBeenLastCalledWith({y: 300, animated: true});
      const requestedOffset = scrollTo.mock.calls.at(-1)?.[0]?.y;
      expect(requestedOffset).toBe(300);
      await act(async () => {
        scrollView.props.onScroll({nativeEvent: {contentOffset: {y: requestedOffset}}});
      });
      await act(async () => {
        advanceAnimatedTimingsForTests(1);
      });
    } finally {
      setAnimatedTimingAutoFinishForTests(true);
      await act(async () => {
        await renderer.unmount();
      });
    }
  });

  it('starts exactly one animated scroll request with the measured keyboard entrance and commits after readback', async () => {
    const scrollTo = vi.fn();
    const {renderer, keyboardState} = await mountWithNativeGeometry(scrollTo);
    const input = queryTestNodes(renderer, 'TextInput').find(node => node.props.testID === 'sample:scroll-field')!;
    const scrollView = queryTestNodes(renderer, 'ScrollView').find(node => node.props.testID === 'sample:scroll-area')!;

    try {
      setAnimatedTimingAutoFinishForTests(false);
      await act(async () => {
        input.props.onFocus({nativeEvent: {}});
      });
      expect(scrollTo).not.toHaveBeenCalled();
      expect(keyboardState.current).toMatchObject({activeFieldId: null, owner: 'none'});

      const measureLayer = getTestNode(renderer, 'ui.base.input:keyboard-layer-position:measure');
      await act(async () => {
        measureLayer.props.onLayout({nativeEvent: {layout: {height: 246}}});
      });
      expect(scrollTo).toHaveBeenCalledTimes(1);
      expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({animated: true}));
      expect(keyboardState.current).toMatchObject({activeFieldId: null, owner: 'none'});

      const requestedOffset = scrollTo.mock.calls[0]?.[0]?.y;
      expect(requestedOffset).toEqual(expect.any(Number));
      await act(async () => {
        scrollView.props.onScroll({nativeEvent: {contentOffset: {y: requestedOffset}}});
      });
      await act(async () => {
        advanceAnimatedTimingsForTests(1);
      });
      expect(keyboardState.current).toMatchObject({activeFieldId: 'scroll-field', owner: 'virtual'});
      expect(scrollTo).toHaveBeenCalledTimes(1);
    } finally {
      setAnimatedTimingAutoFinishForTests(true);
      await act(async () => {
        await renderer.unmount();
      });
    }
  });

  it('keeps readback pending at keyboard animation completion until the final scroll event proves visibility', async () => {
    const scrollTo = vi.fn();
    const {renderer, keyboardState} = await mountWithNativeGeometry(scrollTo);
    const input = queryTestNodes(renderer, 'TextInput').find(node => node.props.testID === 'sample:scroll-field')!;
    const scrollView = queryTestNodes(renderer, 'ScrollView').find(node => node.props.testID === 'sample:scroll-area')!;

    try {
      setAnimatedTimingAutoFinishForTests(false);
      await act(async () => {
        input.props.onFocus({nativeEvent: {}});
      });
      const measureLayer = getTestNode(renderer, 'ui.base.input:keyboard-layer-position:measure');
      await act(async () => {
        measureLayer.props.onLayout({nativeEvent: {layout: {height: 246}}});
      });
      expect(scrollTo).toHaveBeenCalledTimes(1);
      const requestedOffset = scrollTo.mock.calls[0]?.[0]?.y;
      expect(requestedOffset).toEqual(expect.any(Number));
      await act(async () => {
        scrollView.props.onScroll({nativeEvent: {contentOffset: {y: Math.max(0, requestedOffset - 20)}}});
      });
      await act(async () => {
        advanceAnimatedTimingsForTests(1);
      });
      expect(keyboardState.current).toMatchObject({activeFieldId: null, owner: 'none'});
      expect(queryRenderedByProps(renderer, {testID: 'ui.base.input:focus-visibility-error'})).toHaveLength(0);
      await act(async () => {
        scrollView.props.onScroll({nativeEvent: {contentOffset: {y: requestedOffset}}});
      });
      expect(keyboardState.current).toMatchObject({activeFieldId: 'scroll-field', owner: 'virtual'});
    } finally {
      setAnimatedTimingAutoFinishForTests(true);
      await act(async () => {
        await renderer.unmount();
      });
    }
  });

  it('settles an invisible readback from a terminal drag event even when no onScroll arrives', async () => {
    const scrollTo = vi.fn();
    const {renderer, keyboardState} = await mountWithNativeGeometry(scrollTo, 550);
    const input = queryTestNodes(renderer, 'TextInput').find(node => node.props.testID === 'sample:scroll-field')!;
    const scrollView = queryTestNodes(renderer, 'ScrollView').find(node => node.props.testID === 'sample:scroll-area')!;

    try {
      setAnimatedTimingAutoFinishForTests(false);
      await act(async () => {
        input.props.onFocus({nativeEvent: {}});
      });
      const measureLayer = getTestNode(renderer, 'ui.base.input:keyboard-layer-position:measure');
      await act(async () => {
        measureLayer.props.onLayout({nativeEvent: {layout: {height: 246}}});
      });
      expect(scrollTo).toHaveBeenCalledTimes(1);
      await act(async () => {
        scrollView.props.onScrollEndDrag({
          nativeEvent: {
            contentOffset: {y: 100},
            velocity: {y: 0},
          },
        });
      });
      expect(keyboardState.current).toMatchObject({activeFieldId: null, owner: 'none'});
      expect(getTestNode(renderer, 'ui.base.input:focus-visibility-error').props.children).toBe(
        '焦点框无法完整显示，请调整窗口尺寸或退出输入',
      );
    } finally {
      setAnimatedTimingAutoFinishForTests(true);
      await act(async () => {
        await renderer.unmount();
      });
    }
  });

  it('uses one bounded watchdog when neither scroll readback nor a terminal event arrives', async () => {
    vi.useFakeTimers();
    const scrollTo = vi.fn();
    const {renderer, keyboardState} = await mountWithNativeGeometry(scrollTo, 550);
    const input = queryTestNodes(renderer, 'TextInput').find(node => node.props.testID === 'sample:scroll-field')!;

    try {
      setAnimatedTimingAutoFinishForTests(false);
      await act(async () => {
        input.props.onFocus({nativeEvent: {}});
      });
      const measureLayer = getTestNode(renderer, 'ui.base.input:keyboard-layer-position:measure');
      await act(async () => {
        measureLayer.props.onLayout({nativeEvent: {layout: {height: 246}}});
      });
      expect(scrollTo).toHaveBeenCalledTimes(1);
      await act(async () => {
        vi.advanceTimersByTime(1_500);
      });
      expect(keyboardState.current).toMatchObject({activeFieldId: null, owner: 'none'});
      expect(getTestNode(renderer, 'ui.base.input:focus-visibility-error').props.children).toBe(
        '焦点框无法完整显示，请调整窗口尺寸或退出输入',
      );
    } finally {
      setAnimatedTimingAutoFinishForTests(true);
      vi.useRealTimers();
      await act(async () => {
        await renderer.unmount();
      });
    }
  });

  it('accepts a half-unit readback difference when the field is fully visible', async () => {
    const scrollTo = vi.fn();
    const {renderer, keyboardState} = await mountWithNativeGeometry(scrollTo);
    const input = queryTestNodes(renderer, 'TextInput').find(node => node.props.testID === 'sample:scroll-field')!;
    const scrollView = queryTestNodes(renderer, 'ScrollView').find(node => node.props.testID === 'sample:scroll-area')!;

    try {
      setAnimatedTimingAutoFinishForTests(false);
      await act(async () => {
        input.props.onFocus({nativeEvent: {}});
      });
      const measureLayer = getTestNode(renderer, 'ui.base.input:keyboard-layer-position:measure');
      await act(async () => {
        measureLayer.props.onLayout({nativeEvent: {layout: {height: 246}}});
      });
      const requestedOffset = scrollTo.mock.calls[0]?.[0]?.y;
      expect(requestedOffset).toEqual(expect.any(Number));
      await act(async () => {
        scrollView.props.onScroll({nativeEvent: {contentOffset: {y: requestedOffset - 0.4}}});
      });
      await act(async () => {
        advanceAnimatedTimingsForTests(1);
      });
      expect(keyboardState.current).toMatchObject({activeFieldId: 'scroll-field', owner: 'virtual'});
    } finally {
      setAnimatedTimingAutoFinishForTests(true);
      await act(async () => {
        await renderer.unmount();
      });
    }
  });

  it('releases focus and shows recovery when the scroll clamp is reached but the field remains clipped', async () => {
    const scrollTo = vi.fn();
    const {renderer, requestScroll, keyboardState} = await mountWithNativeGeometry(scrollTo, 550);
    const input = queryTestNodes(renderer, 'TextInput').find(node => node.props.testID === 'sample:scroll-field')!;
    const scrollView = queryTestNodes(renderer, 'ScrollView').find(node => node.props.testID === 'sample:scroll-area')!;

    await act(async () => {
      input.props.onFocus({nativeEvent: {}});
    });
    await act(async () => {
      requestScroll.current!(246);
    });
    await measureIncomingKeyboard(renderer);
    expect(scrollTo).toHaveBeenLastCalledWith({y: 280, animated: true});
    await act(async () => {
      scrollView.props.onScroll({nativeEvent: {contentOffset: {y: 280}}});
    });

    expect(getTestNode(renderer, 'ui.base.input:focus-visibility-error').props.children).toBe(
      '焦点框无法完整显示，请调整窗口尺寸或退出输入',
    );
    expect(keyboardState.current).toMatchObject({activeFieldId: null, owner: 'none'});
    await act(async () => {
      await renderer.unmount();
    });
  });

  it('does not require a scroll ancestor when a field is focused', async () => {
    setNativeTestRefFactory((hostName, props) =>
      props.testID === 'sample:scroll-field'
        ? {
            focus: () => undefined,
            blur: () => undefined,
            measureLayout: (
              _relative: unknown,
              callback: (x: number, y: number, width: number, height: number) => void,
            ) => callback(0, 0, 120, 40),
          }
        : {},
    );
    const renderer = await render(
      <InputSurfaceFrame>
        <Field />
      </InputSurfaceFrame>,
    );
    await act(async () => {
      getTestNode(renderer, 'ui.base.input:surface-frame').props.onLayout({
        nativeEvent: {layout: TEST_FRAME},
      });
    });
    const input = queryTestNodes(renderer, 'TextInput').find(node => node.props.testID === 'sample:scroll-field')!;
    await act(async () => {
      input.props.onFocus({nativeEvent: {}});
    });
    await renderer.unmount();
  });
});
