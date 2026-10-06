import {inputTestIds} from '../src/foundations/inputTestIds';
import {act, fireEvent, render, type RenderResult} from '@testing-library/react-native';
import {useCallback, useState} from 'react';
import {StyleSheet} from 'react-native';
import {describe, expect, it, vi} from 'vitest';
import {deriveTestId} from '@catering-v2s/ui-base-primitives';
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
      hasNextField={false}
      onKey={onKey}
    />
  );
};

describe('VirtualKeyboard render boundary', () => {
  it('exposes the same interaction readiness used by the real key handlers', async () => {
    let renderer: RenderResult | undefined;
    await act(async () => {
      renderer = await render(
        <VirtualKeyboard
          layout="numeric"
          height={250}
          frameWidth={TEST_FRAME_WIDTH}
          cellWidth={310}
          interactive={false}
          shift={false}
          hasNextField={false}
          onKey={() => undefined}
        />,
      );
    });

    const key = renderer!.getByTestId(inputTestIds.node('virtual-keyboard:text-1'));
    expect(key.props.disabled).toBe(true);
    expect(key.props.accessibilityState.disabled).toBe(true);

    await act(async () => {
      renderer!.rerender(
        <VirtualKeyboard
          layout="numeric"
          height={250}
          frameWidth={TEST_FRAME_WIDTH}
          cellWidth={310}
          interactive
          shift={false}
          hasNextField={false}
          onKey={() => undefined}
        />,
      );
    });

    const interactiveKey = renderer!.getByTestId(inputTestIds.node('virtual-keyboard:text-1'));
    expect(interactiveKey.props.disabled).toBe(false);
    expect(interactiveKey.props.accessibilityState.disabled).toBe(false);
    await act(async () => {
      await renderer!.unmount();
    });
  });

  it('owns a semantic surface background instead of inheriting the host background', async () => {
    let renderer: RenderResult | undefined;
    await act(async () => {
      renderer = await render(
        <VirtualKeyboard
          layout="numeric"
          height={250}
          frameWidth={TEST_FRAME_WIDTH}
          cellWidth={310}
          shift={false}
          hasNextField={false}
          onKey={() => undefined}
        />,
      );
    });

    const keyboard = renderer!.getByTestId(inputTestIds.node('virtual-keyboard'));
    expect(keyboard.props.className).toContain('bg-keyboard-surface');
    expect(keyboard.props.className).not.toContain('rounded-');
    expect(StyleSheet.flatten(keyboard.props.style)).toMatchObject({
      height: 250,
      width: TEST_FRAME_WIDTH,
      borderRadius: 0,
    });
    await act(async () => {
      await renderer!.unmount();
    });
  });

  it('selects the platform surface-dismiss boundary at render time', async () => {
    const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
    try {
      let nativeRenderer: RenderResult | undefined;
      await act(async () => {
        nativeRenderer = await render(
          <VirtualKeyboard
            layout="numeric"
            height={250}
            frameWidth={TEST_FRAME_WIDTH}
            cellWidth={310}
            shift={false}
            hasNextField={false}
            onKey={() => undefined}
          />,
        );
      });
      const nativeKeyboard = nativeRenderer!.getByTestId(inputTestIds.node('virtual-keyboard'));
      expect(typeof nativeKeyboard.props.onTouchEnd).toBe('function');
      expect(nativeKeyboard.props.onClick).toBeUndefined();
      await act(async () => {
        await nativeRenderer!.unmount();
      });

      Object.defineProperty(globalThis, 'document', {configurable: true, value: {}});
      let webRenderer: RenderResult | undefined;
      await act(async () => {
        webRenderer = await render(
          <VirtualKeyboard
            layout="numeric"
            height={250}
            frameWidth={TEST_FRAME_WIDTH}
            cellWidth={310}
            shift={false}
            hasNextField={false}
            onKey={() => undefined}
          />,
        );
      });
      const webKeyboard = webRenderer!.getByTestId(inputTestIds.node('virtual-keyboard'));
      expect(typeof webKeyboard.props.onClick).toBe('function');
      expect(webKeyboard.props.onTouchEnd).toBeUndefined();
      await act(async () => {
        await webRenderer!.unmount();
      });
    } finally {
      if (originalDocument === undefined) {
        delete (globalThis as {document?: unknown}).document;
      } else {
        Object.defineProperty(globalThis, 'document', originalDocument);
      }
    }
  });

  it('keeps ordinary key handlers stable while the parent updates', async () => {
    let renderer: RenderResult | undefined;
    await act(async () => {
      renderer = await render(<KeyboardHarness />);
    });
    const firstKey = renderer!.getByTestId(inputTestIds.node('virtual-keyboard:text-1'));
    const firstOnPress = firstKey.props.onPress;
    await fireEvent.press(firstKey);
    const secondKey = renderer!.getByTestId(inputTestIds.node('virtual-keyboard:text-1'));
    expect(secondKey.props.onPress).toBe(firstOnPress);
    await act(async () => {
      await renderer!.unmount();
    });
  });

  it.each([
    [
      'full',
      {
        digits: ['text-1'],
        letters: ['text-q'],
        actions: ['shift', 'text-a', 'text-z', 'backspace', 'complete', 'space'],
      },
    ],
    [
      'alpha',
      {
        letters: ['text-q'],
        actions: ['shift', 'text-a', 'space', 'text-z', 'backspace', 'complete'],
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
  ] as const)('renders %s rows through complete regions and stable key IDs', async (layout, regionKeys) => {
    let renderer: RenderResult | undefined;
    await act(async () => {
      renderer = await render(
        <VirtualKeyboard
          layout={layout}
          height={320}
          frameWidth={TEST_FRAME_WIDTH}
          cellWidth={100}
          shift={false}
          hasNextField={false}
          onKey={() => undefined}
        />,
      );
    });

    for (const [region, keys] of Object.entries(regionKeys)) {
      const regionNode = renderer!.getByTestId(inputTestIds.node(`virtual-keyboard:region:${region}`));
      expect(regionNode).toBeDefined();
      for (const key of keys) {
        expect(renderer!.getByTestId(inputTestIds.node(`virtual-keyboard:${key}`))).toBeDefined();
      }
    }
    const renderedRegions = Object.keys(regionKeys).flatMap(region =>
      renderer!.getAllByTestId(inputTestIds.node(`virtual-keyboard:region:${region}`)),
    );
    expect(renderedRegions).toHaveLength(Object.keys(regionKeys).length);
    await act(async () => {
      await renderer!.unmount();
    });
  });

  it('binds complete to the live next-field result instead of the layout definition', async () => {
    const onKey = vi.fn();
    let renderer: RenderResult | undefined;
    await act(async () => {
      renderer = await render(
        <VirtualKeyboard
          layout="numeric"
          height={250}
          frameWidth={TEST_FRAME_WIDTH}
          cellWidth={310}
          shift={false}
          hasNextField={false}
          onKey={onKey}
        />,
      );
    });
    const complete = renderer!.getByTestId(inputTestIds.node('virtual-keyboard:complete'));
    expect(renderer!.getByTestId(inputTestIds.node('virtual-keyboard:complete'))).toBeDefined();
    expect(renderer!.getByTestId(deriveTestId(inputTestIds.node('virtual-keyboard:complete'), 'icon')!)).toBeDefined();
    expect(complete.props.accessibilityLabel).toBe('回车');
    const backspace = renderer!.getByTestId(inputTestIds.node('virtual-keyboard:backspace'));
    expect(renderer!.getByTestId(deriveTestId(inputTestIds.node('virtual-keyboard:backspace'), 'icon')!)).toBeDefined();
    expect(backspace.props.accessibilityLabel).toBe('删除');
    await fireEvent.press(complete);
    expect(onKey).toHaveBeenCalledWith({kind: 'complete', hasNextField: false});
    await act(async () => {
      await renderer!.unmount();
    });
  });

  it('updates letter keycaps and the full space label from the one-shot Shift state', async () => {
    let renderer: RenderResult | undefined;
    await act(async () => {
      renderer = await render(
        <VirtualKeyboard
          layout="full"
          height={168}
          frameWidth={960}
          cellWidth={92}
          shift={false}
          hasNextField={false}
          onKey={() => undefined}
        />,
      );
    });
    expect(renderer!.getByText('q')).toBeDefined();
    expect(renderer!.getByText('SHIFT')).toBeDefined();
    expect(renderer!.getByText('SPACE')).toBeDefined();
    expect(renderer!.getByTestId(inputTestIds.node('virtual-keyboard:complete'))).toBeDefined();
    await act(async () => {
      await renderer!.unmount();
    });

    const renderCase = async (shift: boolean) => {
      let nextRenderer: RenderResult | undefined;
      await act(async () => {
        nextRenderer = await render(
          <VirtualKeyboard
            layout="alpha"
            height={168}
            frameWidth={TEST_FRAME_WIDTH}
            cellWidth={92}
            shift={shift}
            hasNextField={false}
            onKey={() => undefined}
          />,
        );
      });
      const label = nextRenderer!.getByText(shift ? 'Q' : 'q').props.children;
      await act(async () => {
        await nextRenderer!.unmount();
      });
      return label;
    };

    expect(await renderCase(true)).toBe('Q');
    expect(await renderCase(false)).toBe('q');
  });

  it('uses symbol modifiers on compact mobile-width surfaces', async () => {
    let renderer: RenderResult | undefined;
    await act(async () => {
      renderer = await render(
        <VirtualKeyboard
          layout="alpha"
          height={168}
          frameWidth={360}
          cellWidth={32}
          shift={false}
          hasNextField={false}
          onKey={() => undefined}
        />,
      );
    });
    expect(renderer!.getByText('⇧')).toBeDefined();
    await act(async () => {
      await renderer!.unmount();
    });
  });

  it('uses financial symbols for presentation while preserving ASCII edit semantics', async () => {
    const onKey = vi.fn();
    let renderer: RenderResult | undefined;
    await act(async () => {
      renderer = await render(
        <VirtualKeyboard
          layout="financial"
          height={250}
          frameWidth={360}
          cellWidth={100}
          shift={false}
          hasNextField={false}
          onKey={onKey}
        />,
      );
    });
    const minus = renderer!.getByTestId(inputTestIds.node('virtual-keyboard:text--'));
    const dot = renderer!.getByTestId(inputTestIds.node('virtual-keyboard:text-.'));
    expect(renderer!.getByText('−')).toBeDefined();
    expect(renderer!.getByText('·')).toBeDefined();
    await fireEvent.press(minus);
    await fireEvent.press(dot);
    expect(onKey).toHaveBeenNthCalledWith(1, {kind: 'text', text: '-'});
    expect(onKey).toHaveBeenNthCalledWith(2, {kind: 'text', text: '.'});
    await act(async () => {
      await renderer!.unmount();
    });
  });

  it('uses the same visible full Shift symbol as the inserted key payload', async () => {
    const symbols = [':', '/', '.', '?', '&', '=', '-', '_', '%', '+'];
    const digits = '1234567890';
    const onKey = vi.fn();
    let renderer: RenderResult | undefined;
    await act(async () => {
      renderer = await render(
        <VirtualKeyboard
          layout="full"
          height={246}
          frameWidth={1280}
          cellWidth={118}
          shift={true}
          hasNextField={false}
          onKey={onKey}
        />,
      );
    });

    for (const [index, symbol] of symbols.entries()) {
      const key = renderer!.getByTestId(inputTestIds.node(`virtual-keyboard:text-${digits[index]}`));
      expect(renderer!.getByText(symbol)).toBeDefined();
      await fireEvent.press(key);
      expect(onKey).toHaveBeenNthCalledWith(index + 1, {kind: 'text', text: symbol});
    }
    const space = renderer!.getByTestId(inputTestIds.node('virtual-keyboard:space'));
    expect(renderer!.getByText('SPACE')).toBeDefined();
    expect(space.props.accessibilityLabel).toBe('空格');
    await fireEvent.press(space);
    expect(onKey).toHaveBeenLastCalledWith({kind: 'space'});
    await act(async () => {
      await renderer!.unmount();
    });
  });

  it('renders one-shot Shift selection through the primitive recipe', async () => {
    let renderer: RenderResult | undefined;
    await act(async () => {
      renderer = await render(
        <VirtualKeyboard
          layout="alpha"
          height={168}
          frameWidth={TEST_FRAME_WIDTH}
          cellWidth={92}
          shift={true}
          hasNextField={false}
          onKey={() => undefined}
        />,
      );
    });
    const shift = renderer!.getByTestId(inputTestIds.node('virtual-keyboard:shift'));
    const shiftButton = renderer!.getByTestId(inputTestIds.node('virtual-keyboard:shift'));
    expect(shift.props.accessibilityState).toMatchObject({selected: true});
    expect(shiftButton.props.className).toContain('border-keyboard-focus');
    await act(async () => {
      await renderer!.unmount();
    });
  });

  it('renders numeric and financial bottom keys on aligned three-column grids', async () => {
    const renderLayout = async (layout: 'numeric' | 'financial') => {
      let renderer: RenderResult | undefined;
      await act(async () => {
        renderer = await render(
          <VirtualKeyboard
            layout={layout}
            height={244}
            frameWidth={TEST_FRAME_WIDTH}
            cellWidth={310}
            shift={false}
            hasNextField={false}
            onKey={() => undefined}
          />,
        );
      });
      return renderer!;
    };

    const numeric = await renderLayout('numeric');
    const numericBackspaceColumn = numeric.getByTestId(inputTestIds.node('virtual-keyboard:segment:grid:0'));
    const numericZeroColumn = numeric.getByTestId(inputTestIds.node('virtual-keyboard:segment:grid:1'));
    const numericCompleteColumn = numeric.getByTestId(inputTestIds.node('virtual-keyboard:segment:grid:2'));
    expect(numeric.getByTestId(inputTestIds.node('virtual-keyboard:backspace'))).toBeDefined();
    expect(numeric.getByTestId(inputTestIds.node('virtual-keyboard:text-0'))).toBeDefined();
    expect(numeric.getByTestId(inputTestIds.node('virtual-keyboard:complete'))).toBeDefined();
    expect(numericBackspaceColumn.props.style.at(-1)).toMatchObject({width: 310, flexDirection: 'row', gap: 8});
    expect(numericZeroColumn.props.style.at(-1)).toMatchObject({width: 310, flexDirection: 'row', gap: 8});
    expect(numericCompleteColumn.props.style.at(-1)).toMatchObject({width: 310, flexDirection: 'row', gap: 8});
    expect(numeric.getByTestId(inputTestIds.node('virtual-keyboard')).props.style.at(-1)).toMatchObject({
      height: 244,
    });
    await act(async () => {
      await numeric.unmount();
    });

    const financial = await renderLayout('financial');
    const financialSymbolColumn = financial.getByTestId(inputTestIds.node('virtual-keyboard:segment:grid:0'));
    const financialZeroColumn = financial.getByTestId(inputTestIds.node('virtual-keyboard:segment:grid:1'));
    const financialActionColumn = financial.getByTestId(inputTestIds.node('virtual-keyboard:segment:grid:2'));
    expect(financial.getByTestId(inputTestIds.node('virtual-keyboard:text--'))).toBeDefined();
    expect(financial.getByTestId(inputTestIds.node('virtual-keyboard:text-.'))).toBeDefined();
    expect(financial.getByTestId(inputTestIds.node('virtual-keyboard:text-0'))).toBeDefined();
    expect(financial.getByTestId(inputTestIds.node('virtual-keyboard:backspace'))).toBeDefined();
    expect(financial.getByTestId(inputTestIds.node('virtual-keyboard:complete'))).toBeDefined();
    expect(financialSymbolColumn.props.style.at(-1)).toMatchObject({width: 310, flexDirection: 'row', gap: 8});
    expect(financialZeroColumn.props.style.at(-1)).toMatchObject({width: 310, flexDirection: 'row', gap: 8});
    expect(financialActionColumn.props.style.at(-1)).toMatchObject({width: 310, flexDirection: 'row', gap: 8});
    await act(async () => {
      await financial.unmount();
    });
  });
});
