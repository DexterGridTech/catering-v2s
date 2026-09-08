import {act, create} from 'react-test-renderer';
import {useCallback, useState} from 'react';
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
        letters: ['text-a'],
        actions: ['shift', 'text-z', 'backspace', 'complete'],
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
    renderer!.root.findByProps({testID: 'ui.base.input:virtual-keyboard:complete'}).props.onPress();
    expect(onKey).toHaveBeenCalledWith({kind: 'complete', hasNextField: false});
    act(() => {
      renderer!.unmount();
    });
  });

  it('renders numeric and financial bottom keys on aligned three-column grids', () => {
    const renderLayout = (layout: 'numeric' | 'financial') => {
      let renderer: ReturnType<typeof create> | undefined;
      act(() => {
        renderer = create(
          <VirtualKeyboard
            layout={layout}
            height={219}
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
    const numericZeroColumn = numeric.root.findByProps({
      testID: 'ui.base.input:virtual-keyboard:segment:grid:0',
    });
    const numericActionColumn = numeric.root.findByProps({
      testID: 'ui.base.input:virtual-keyboard:segment:grid:1',
    });
    expect(numericZeroColumn.findByProps({testID: 'ui.base.input:virtual-keyboard:text-0'})).toBeDefined();
    expect(numericActionColumn.findByProps({testID: 'ui.base.input:virtual-keyboard:backspace'})).toBeDefined();
    expect(numericActionColumn.findByProps({testID: 'ui.base.input:virtual-keyboard:complete'})).toBeDefined();
    expect(numericZeroColumn.props.style.at(-1)).toMatchObject({width: 2 * 310 + 8, flexDirection: 'row', gap: 8});
    expect(numericActionColumn.props.style.at(-1)).toMatchObject({width: 310, flexDirection: 'row', gap: 8});
    expect(numeric.root.findByProps({testID: 'ui.base.input:virtual-keyboard'}).props.style.at(-1)).toMatchObject({
      height: 219,
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
