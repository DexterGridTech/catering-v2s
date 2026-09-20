import {act, create} from 'react-test-renderer';
import {useCallback, useState} from 'react';
import {Pressable, StyleSheet, View} from 'react-native';
import {describe, expect, it, vi} from 'vitest';
import {VirtualKeyboard} from '../src/components/VirtualKeyboard';

const TEST_FRAME_WIDTH = 960;

const KeyboardHarness = () => {
  const [, setParentRevision] = useState(0);
  const onKey = useCallback(() => {
    setParentRevision(value => value + 1);
  }, []);
  return (
    <VirtualKeyboard
      layout="numeric"
      height={250}
      frameWidth={TEST_FRAME_WIDTH}
      cellWidth={310}
      shift={false}
      capsLock={false}
      hasNextField={false}
      onKey={onKey}
    />
  );
};

describe('VirtualKeyboard render boundary', () => {
  it('owns a semantic surface background instead of inheriting the host background', () => {
    let renderer: ReturnType<typeof create> | undefined;
    act(() => {
      renderer = create(
        <VirtualKeyboard
          layout="numeric"
          height={250}
          frameWidth={TEST_FRAME_WIDTH}
          cellWidth={310}
          shift={false}
          capsLock={false}
          hasNextField={false}
          onKey={() => undefined}
        />,
      );
    });

    const keyboard = renderer!.root.findAllByType(View).find(node => node.props.testID === 'ui.base.input:virtual-keyboard')!;
    expect(keyboard.props.className).toContain('bg-keyboard-surface');
    expect(StyleSheet.flatten(keyboard.props.style)).toMatchObject({height: 250, width: TEST_FRAME_WIDTH});
    act(() => {
      renderer!.unmount();
    });
  });

  it('selects the platform surface-dismiss boundary at render time', () => {
    const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
    try {
      let nativeRenderer: ReturnType<typeof create> | undefined;
      act(() => {
        nativeRenderer = create(
          <VirtualKeyboard
            layout="numeric"
            height={250}
            frameWidth={TEST_FRAME_WIDTH}
            cellWidth={310}
            shift={false}
            capsLock={false}
            hasNextField={false}
            onKey={() => undefined}
          />,
        );
      });
      const nativeKeyboard = nativeRenderer!.root.findAllByType(View).find(node => node.props.testID === 'ui.base.input:virtual-keyboard')!;
      expect(typeof nativeKeyboard.props.onTouchEnd).toBe('function');
      expect(nativeKeyboard.props.onClick).toBeUndefined();
      act(() => { nativeRenderer!.unmount(); });

      Object.defineProperty(globalThis, 'document', {configurable: true, value: {}});
      let webRenderer: ReturnType<typeof create> | undefined;
      act(() => {
        webRenderer = create(
          <VirtualKeyboard
            layout="numeric"
            height={250}
            frameWidth={TEST_FRAME_WIDTH}
            cellWidth={310}
            shift={false}
            capsLock={false}
            hasNextField={false}
            onKey={() => undefined}
          />,
        );
      });
      const webKeyboard = webRenderer!.root.findAllByType(View).find(node => node.props.testID === 'ui.base.input:virtual-keyboard')!;
      expect(typeof webKeyboard.props.onClick).toBe('function');
      expect(webKeyboard.props.onTouchEnd).toBeUndefined();
      act(() => { webRenderer!.unmount(); });
    } finally {
      if (originalDocument === undefined) {
        delete (globalThis as {document?: unknown}).document;
      } else {
        Object.defineProperty(globalThis, 'document', originalDocument);
      }
    }
  });

  it('keeps ordinary key handlers stable while the parent updates', () => {
    let renderer: ReturnType<typeof create> | undefined;
    act(() => {
      renderer = create(<KeyboardHarness />);
    });
    const firstKey = renderer!.root.findByProps({testID: 'ui.base.input:virtual-keyboard:text-1'});
    const firstOnPress = firstKey.props.onPress;
    act(() => {
      firstKey.props.onPress();
    });
    const secondKey = renderer!.root.findByProps({testID: 'ui.base.input:virtual-keyboard:text-1'});
    expect(secondKey.props.onPress).toBe(firstOnPress);
    act(() => {
      renderer!.unmount();
    });
  });

  it.each([
    [
      'full',
      {
        digits: ['text-1'],
        letters: ['text-q'],
        actions: ['caps', 'shift', 'text-a', 'text-z', 'backspace', 'complete'],
      },
    ],
    [
      'alpha',
      {
        letters: ['text-q'],
        actions: ['caps', 'text-a', 'shift', 'text-z', 'backspace', 'complete'],
      },
    ],
    [
      'numeric',
      {
        digits: ['text-1'],
        actions: ['text-0', 'backspace', 'complete'],
      },
    ],
    [
      'financial',
      {
        digits: ['text-1'],
        actions: ['text--', 'text-0', 'text-.', 'backspace', 'complete'],
      },
    ],
  ] as const)('renders %s rows through complete regions and stable key IDs', (layout, regionKeys) => {
    let renderer: ReturnType<typeof create> | undefined;
    act(() => {
      renderer = create(
        <VirtualKeyboard
          layout={layout}
          height={320}
          frameWidth={TEST_FRAME_WIDTH}
          cellWidth={100}
          shift={false}
          capsLock={false}
          hasNextField={false}
          onKey={() => undefined}
        />,
      );
    });

    for (const [region, keys] of Object.entries(regionKeys)) {
      const regionNode = renderer!.root.findByProps({testID: `ui.base.input:virtual-keyboard:region:${region}`});
      expect(regionNode).toBeDefined();
      for (const key of keys) {
        expect(regionNode.findByProps({testID: `ui.base.input:virtual-keyboard:${key}`})).toBeDefined();
      }
    }
    const renderedRegions = Object.keys(regionKeys).flatMap(region =>
      renderer!.root.findAllByProps({testID: `ui.base.input:virtual-keyboard:region:${region}`}),
    );
    expect(renderedRegions).toHaveLength(Object.keys(regionKeys).length);
    act(() => {
      renderer!.unmount();
    });
  });

  it('binds complete to the live next-field result instead of the layout definition', () => {
    const onKey = vi.fn();
    let renderer: ReturnType<typeof create> | undefined;
    act(() => {
      renderer = create(
        <VirtualKeyboard
          layout="numeric"
          height={250}
          frameWidth={TEST_FRAME_WIDTH}
          cellWidth={310}
          shift={false}
          capsLock={false}
          hasNextField={false}
          onKey={onKey}
        />,
      );
    });
    const complete = renderer!.root.findByProps({testID: 'ui.base.input:virtual-keyboard:complete'});
    expect(complete.props.children).toBe('COMPLETE');
    expect(complete.props.icon).toBe('keyboard-enter');
    expect(complete.props.accessibilityLabel).toBe('回车');
    const backspace = renderer!.root.findByProps({testID: 'ui.base.input:virtual-keyboard:backspace'});
    expect(backspace.props.icon).toBe('keyboard-backspace');
    expect(backspace.props.children).toBe('BACKSPACE');
    expect(backspace.props.accessibilityLabel).toBe('删除');
    complete.props.onPress();
    expect(onKey).toHaveBeenCalledWith({kind: 'complete', hasNextField: false});
    act(() => {
      renderer!.unmount();
    });
  });

  it('updates letter keycaps when CAPS or SHIFT changes the case mode', () => {
    let renderer: ReturnType<typeof create> | undefined;
    act(() => {
      renderer = create(
        <VirtualKeyboard
          layout="alpha"
          height={168}
          frameWidth={960}
          cellWidth={92}
          shift={false}
          capsLock={false}
          hasNextField={false}
          onKey={() => undefined}
        />,
      );
    });
    expect(renderer!.root.findByProps({testID: 'ui.base.input:virtual-keyboard:text-q'}).props.children).toBe('q');
    expect(renderer!.root.findByProps({testID: 'ui.base.input:virtual-keyboard:caps'}).props.children).toBe('CAPS');
    expect(renderer!.root.findByProps({testID: 'ui.base.input:virtual-keyboard:shift'}).props.children).toBe('SHIFT');
    expect(renderer!.root.findByProps({testID: 'ui.base.input:virtual-keyboard:complete'}).props.children).toBe('COMPLETE');
    act(() => { renderer!.unmount(); });

    const renderCase = (capsLock: boolean, shift: boolean) => {
      let nextRenderer: ReturnType<typeof create> | undefined;
      act(() => {
        nextRenderer = create(
          <VirtualKeyboard
            layout="alpha"
            height={168}
            frameWidth={TEST_FRAME_WIDTH}
            cellWidth={92}
            shift={shift}
            capsLock={capsLock}
            hasNextField={false}
            onKey={() => undefined}
          />,
        );
      });
      const label = nextRenderer!.root.findByProps({testID: 'ui.base.input:virtual-keyboard:text-q'}).props.children;
      act(() => { nextRenderer!.unmount(); });
      return label;
    };

    expect(renderCase(true, false)).toBe('Q');
    expect(renderCase(false, true)).toBe('Q');
    expect(renderCase(true, true)).toBe('q');
  });

  it('uses symbol modifiers on compact mobile-width surfaces', () => {
    let renderer: ReturnType<typeof create> | undefined;
    act(() => {
      renderer = create(
        <VirtualKeyboard
          layout="alpha"
          height={168}
          frameWidth={360}
          cellWidth={32}
          shift={false}
          capsLock={false}
          hasNextField={false}
          onKey={() => undefined}
        />,
      );
    });
    expect(renderer!.root.findByProps({testID: 'ui.base.input:virtual-keyboard:caps'}).props.children).toBe('⇪');
    expect(renderer!.root.findByProps({testID: 'ui.base.input:virtual-keyboard:shift'}).props.children).toBe('⇧');
    act(() => { renderer!.unmount(); });
  });

  it('uses financial symbols for presentation while preserving ASCII edit semantics', () => {
    const onKey = vi.fn();
    let renderer: ReturnType<typeof create> | undefined;
    act(() => {
      renderer = create(
        <VirtualKeyboard
          layout="financial"
          height={250}
          frameWidth={360}
          cellWidth={100}
          shift={false}
          capsLock={false}
          hasNextField={false}
          onKey={onKey}
        />,
      );
    });
    const minus = renderer!.root.findByProps({testID: 'ui.base.input:virtual-keyboard:text--'});
    const dot = renderer!.root.findByProps({testID: 'ui.base.input:virtual-keyboard:text-.'});
    expect(minus.props.children).toBe('−');
    expect(dot.props.children).toBe('·');
    minus.props.onPress();
    dot.props.onPress();
    expect(onKey).toHaveBeenNthCalledWith(1, {kind: 'text', text: '-'});
    expect(onKey).toHaveBeenNthCalledWith(2, {kind: 'text', text: '.'});
    act(() => { renderer!.unmount(); });
  });

  it('renders persistent modifier selection through the primitive recipe', () => {
    let renderer: ReturnType<typeof create> | undefined;
    act(() => {
      renderer = create(
        <VirtualKeyboard
          layout="alpha"
          height={168}
          frameWidth={TEST_FRAME_WIDTH}
          cellWidth={92}
          shift={true}
          capsLock={true}
          hasNextField={false}
          onKey={() => undefined}
        />,
      );
    });
    const caps = renderer!.root.findByProps({testID: 'ui.base.input:virtual-keyboard:caps'});
    const shift = renderer!.root.findByProps({testID: 'ui.base.input:virtual-keyboard:shift'});
    const capsButton = renderer!.root.findAllByType(Pressable).find(node => node.props.testID === 'ui.base.input:virtual-keyboard:caps')!;
    const shiftButton = renderer!.root.findAllByType(Pressable).find(node => node.props.testID === 'ui.base.input:virtual-keyboard:shift')!;
    expect(caps.props.selected).toBe(true);
    expect(capsButton.props.className).toContain('border-keyboard-focus');
    expect(shift.props.selected).toBe(true);
    expect(shiftButton.props.className).toContain('border-keyboard-focus');
    act(() => { renderer!.unmount(); });
  });

  it('renders numeric and financial bottom keys on aligned three-column grids', () => {
    const renderLayout = (layout: 'numeric' | 'financial') => {
      let renderer: ReturnType<typeof create> | undefined;
      act(() => {
        renderer = create(
          <VirtualKeyboard
            layout={layout}
            height={244}
            frameWidth={TEST_FRAME_WIDTH}
            cellWidth={310}
            shift={false}
            capsLock={false}
            hasNextField={false}
            onKey={() => undefined}
          />,
        );
      });
      return renderer!;
    };

    const numeric = renderLayout('numeric');
    const numericBackspaceColumn = numeric.root.findByProps({
      testID: 'ui.base.input:virtual-keyboard:segment:grid:0',
    });
    const numericZeroColumn = numeric.root.findByProps({
      testID: 'ui.base.input:virtual-keyboard:segment:grid:1',
    });
    const numericCompleteColumn = numeric.root.findByProps({
      testID: 'ui.base.input:virtual-keyboard:segment:grid:2',
    });
    expect(numericBackspaceColumn.findByProps({testID: 'ui.base.input:virtual-keyboard:backspace'})).toBeDefined();
    expect(numericZeroColumn.findByProps({testID: 'ui.base.input:virtual-keyboard:text-0'})).toBeDefined();
    expect(numericCompleteColumn.findByProps({testID: 'ui.base.input:virtual-keyboard:complete'})).toBeDefined();
    expect(numericBackspaceColumn.props.style.at(-1)).toMatchObject({width: 310, flexDirection: 'row', gap: 8});
    expect(numericZeroColumn.props.style.at(-1)).toMatchObject({width: 310, flexDirection: 'row', gap: 8});
    expect(numericCompleteColumn.props.style.at(-1)).toMatchObject({width: 310, flexDirection: 'row', gap: 8});
    expect(numeric.root.findByProps({testID: 'ui.base.input:virtual-keyboard'}).props.style.at(-1)).toMatchObject({
      height: 244,
    });
    act(() => {
      numeric.unmount();
    });

    const financial = renderLayout('financial');
    const financialSymbolColumn = financial.root.findByProps({
      testID: 'ui.base.input:virtual-keyboard:segment:grid:0',
    });
    const financialZeroColumn = financial.root.findByProps({
      testID: 'ui.base.input:virtual-keyboard:segment:grid:1',
    });
    const financialActionColumn = financial.root.findByProps({
      testID: 'ui.base.input:virtual-keyboard:segment:grid:2',
    });
    expect(financialSymbolColumn.findByProps({testID: 'ui.base.input:virtual-keyboard:text--'})).toBeDefined();
    expect(financialSymbolColumn.findByProps({testID: 'ui.base.input:virtual-keyboard:text-.'})).toBeDefined();
    expect(financialZeroColumn.findByProps({testID: 'ui.base.input:virtual-keyboard:text-0'})).toBeDefined();
    expect(financialActionColumn.findByProps({testID: 'ui.base.input:virtual-keyboard:backspace'})).toBeDefined();
    expect(financialActionColumn.findByProps({testID: 'ui.base.input:virtual-keyboard:complete'})).toBeDefined();
    expect(financialSymbolColumn.props.style.at(-1)).toMatchObject({width: 310, flexDirection: 'row', gap: 8});
    expect(financialZeroColumn.props.style.at(-1)).toMatchObject({width: 310, flexDirection: 'row', gap: 8});
    expect(financialActionColumn.props.style.at(-1)).toMatchObject({width: 310, flexDirection: 'row', gap: 8});
    act(() => {
      financial.unmount();
    });
  });
});
