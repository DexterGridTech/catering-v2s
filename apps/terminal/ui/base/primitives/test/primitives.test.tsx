import {createRef} from 'react';
import {act, create, type TestInstance, type ReactTestRenderer} from 'react-test-renderer';
import {Image, Pressable, ScrollView, Text, TextInput, View, VirtualizedList} from 'react-native';
import Svg, {Path} from 'react-native-svg';
import {describe, expect, it, vi} from 'vitest';
import {
  PrimitiveButton,
  PrimitiveActions,
  PrimitiveBadge,
  PrimitiveContainer,
  PrimitiveEmptyState,
  PrimitiveGrid,
  PrimitiveInlineAlert,
  PrimitiveList,
  PrimitiveSegmentedControl,
  PrimitiveSpinner,
  PrimitiveHeading,
  PrimitiveInput,
  PrimitiveImage,
  type PrimitiveInputHandle,
  PrimitiveLabel,
  PrimitivePressOption,
  PrimitiveScrollView,
  type PrimitiveScrollViewHandle,
  PrimitiveStatus,
  PrimitiveText,
} from '../src/index';
import {baseLayout, baseTokens} from '../src/theme/tokens';
import {primitiveIconPaths, RnrSvgIcon} from '../src/vendor/slots';

const mount = (element: Parameters<typeof create>[0]): ReactTestRenderer => {
  let renderer: ReactTestRenderer | undefined;
  act(() => {
    renderer = create(element);
  });
  return renderer!;
};

const createWithNodeMock = create as unknown as (
  element: Parameters<typeof create>[0],
  options: Readonly<{readonly createNodeMock: (element: TestInstance) => unknown}>,
) => ReactTestRenderer;

describe('ui primitives', () => {
  it('renders addressable native controls with required testIDs', () => {
    const renderer = mount(
      <PrimitiveContainer testID="sample:root">
        <PrimitiveHeading testID="sample:heading">标题</PrimitiveHeading>
        <PrimitiveLabel testID="sample:label" nativeID="sample:label">
          姓名
        </PrimitiveLabel>
        <PrimitiveInput testID="sample:input" accessibilityLabel="姓名" value="Alice" />
        <PrimitiveText testID="sample:text">内容</PrimitiveText>
        <PrimitiveStatus testID="sample:status">状态</PrimitiveStatus>
        <PrimitiveActions testID="sample:actions" />
        <PrimitiveScrollView testID="sample:scroll">可滚动内容</PrimitiveScrollView>
        <PrimitiveButton testID="sample:button">确定</PrimitiveButton>
      </PrimitiveContainer>,
    );

    expect(baseTokens.container).toContain('bg-canvas');
    expect(baseTokens.text).toContain('leading-6');
    expect(baseTokens.heading).toContain('leading-7');
    expect(baseTokens.label).toContain('leading-5');
    expect(baseTokens.status).toContain('leading-6');
    const container = renderer.root.findAllByProps({testID: 'sample:root'}).find(node => node.type === View)!;
    expect(container.props.className).toBe('flex-1 bg-canvas p-6 gap-4');
    expect(renderer.root.findByProps({testID: 'sample:root'})).toBeDefined();
    const heading = renderer.root.findAllByProps({testID: 'sample:heading'}).find(node => node.type === Text)!;
    expect(heading.props.accessibilityRole).toBe('header');
    expect(heading.props.accessibilityLiveRegion).toBe('polite');
    expect(renderer.root.findByProps({testID: 'sample:label'})).toBeDefined();
    expect(renderer.root.findByProps({testID: 'sample:label'}).props.nativeID).toBe('sample:label');
    expect(renderer.root.findByProps({testID: 'sample:input'})).toBeDefined();
    expect(renderer.root.findByProps({testID: 'sample:text'})).toBeDefined();
    expect(renderer.root.findByProps({testID: 'sample:status'})).toBeDefined();
    expect(renderer.root.findByProps({testID: 'sample:actions'})).toBeDefined();
    const scrollView = renderer.root.findAllByProps({testID: 'sample:scroll'}).find(node => node.type === ScrollView)!;
    expect(scrollView.props.className).toBe('w-full flex-1 bg-canvas');
    expect(scrollView.props.contentContainerStyle).toEqual({gap: baseLayout.scrollContentGap});
    expect(scrollView.props.scrollEventThrottle).toBe(16);
    expect(renderer.root.findByProps({testID: 'sample:scroll'})).toBeDefined();
    expect(baseTokens.button).toContain('bg-action');
    const button = renderer.root.findAllByProps({testID: 'sample:button'}).find(node => node.type === Pressable)!;
    expect(button.props.className).toBe('self-start min-h-12 rounded-md bg-action px-4 py-3');
    expect(renderer.root.findByProps({testID: 'sample:button'})).toBeDefined();
    expect(renderer.root.findAllByType(View).length).toBeGreaterThan(0);
    expect(renderer.root.findAllByType(Text).length).toBeGreaterThan(0);
    expect(renderer.root.findAllByType(TextInput).length).toBeGreaterThan(0);
    expect(renderer.root.findAllByType(ScrollView).length).toBeGreaterThan(0);
    expect(renderer.root.findAllByType(Text).every(node => node.props.allowFontScaling === false)).toBe(true);
    expect(renderer.root.findAllByType(TextInput).every(node => node.props.allowFontScaling === false)).toBe(true);
    act(() => {
      renderer.unmount();
    });
  });

  it('keeps surface, content, card, and centered layouts presentation-only', () => {
    const renderer = mount(
      <PrimitiveContainer testID="sample:layout-root" layout="centered">
        <PrimitiveContainer testID="sample:layout-content" layout="content" bounded />
        <PrimitiveContainer testID="sample:layout-card" layout="card" bounded />
      </PrimitiveContainer>,
    );

    const byTestID = (testID: string) => renderer.root.findAllByProps({testID}).find(node => node.type === View);
    expect(byTestID('sample:layout-root')?.props.className).toBe(baseTokens.containerCentered);
    expect(byTestID('sample:layout-content')?.props.className).toBe(
      `${baseTokens.containerContent} ${baseTokens.containerBoundedContent}`,
    );
    expect(byTestID('sample:layout-card')?.props.className).toBe(
      `${baseTokens.containerCard} ${baseTokens.containerBoundedCard}`,
    );
    expect(byTestID('sample:layout-content')?.props.style).toEqual({flex: 1, minHeight: 0});
    expect(byTestID('sample:layout-card')?.props.style).toEqual({
      maxHeight: '100%',
      minHeight: 0,
      overflow: 'hidden',
    });
    act(() => {
      renderer.unmount();
    });
  });

  it('keeps the scroll viewport opaque by default and supports an explicit transparent variant', () => {
    const renderer = mount(
      <>
        <PrimitiveScrollView testID="sample:scroll-opaque">内容</PrimitiveScrollView>
        <PrimitiveScrollView testID="sample:scroll-transparent" layout="transparent">内容</PrimitiveScrollView>
      </>,
    );

    const scrollView = (testID: string) => renderer.root
      .findAllByType(ScrollView)
      .find(node => node.props.testID === testID)!;
    expect(scrollView('sample:scroll-opaque').props.className).toBe(baseTokens.scroll);
    expect(scrollView('sample:scroll-transparent').props.className).toBe('w-full flex-1');
    act(() => { renderer.unmount(); });
  });

  it('renders a background image through the shared image seam and keeps missing sources empty', () => {
    const renderer = mount(
      <PrimitiveContainer testID="sample:transparent" layout="transparent">
        <PrimitiveImage testID="sample:background" layout="background" source={{uri: 'wallpaper.jpg'}} />
        <PrimitiveImage testID="sample:missing" layout="background" />
      </PrimitiveContainer>,
    );

    const transparent = renderer.root.findAllByType(View).find(node => node.props.testID === 'sample:transparent')!;
    expect(transparent.props.className).toBe(baseTokens.containerTransparent);
    const image = renderer.root.findAllByType(Image).find(node => node.props.testID === 'sample:background')!;
    expect(image.props.className).toBe(baseTokens.imageBackground);
    expect(image.props.resizeMode).toBe('cover');
    expect(image.props.source).toEqual({uri: 'wallpaper.jpg'});
    expect(renderer.root.findAllByType(Image).filter(node => node.props.testID === 'sample:missing')).toHaveLength(0);
    act(() => {
      renderer.unmount();
    });
  });

  it('supports keyboard cell variants without exposing styling to consumers', () => {
    const onPress = vi.fn();
    const renderer = mount(
      <PrimitiveButton testID="sample:key" accessibilityLabel="1" onPress={onPress} variant="key">
        1
      </PrimitiveButton>,
    );

    const button = renderer.root.findAllByType(Pressable).find(node => node.props.testID === 'sample:key')!;
    expect(button.props.className).toBe(baseTokens.keyboardKey);
    expect(button.props.style).toBeUndefined();
    act(() => {
      (button.props.onPressIn as (() => void) | undefined)?.();
    });
    const pressedButton = renderer.root.findAllByType(Pressable).find(node => node.props.testID === 'sample:key')!;
    expect(pressedButton.props.style).toEqual({opacity: 0.78, transform: [{scale: 0.985}]});
    act(() => {
      (pressedButton.props.onPressOut as (() => void) | undefined)?.();
    });
    const releasedButton = renderer.root.findAllByType(Pressable).find(node => node.props.testID === 'sample:key')!;
    expect(releasedButton.props.style).toBeUndefined();
    act(() => {
      (releasedButton.props.onPress as (() => void) | undefined)?.();
    });
    expect(onPress).toHaveBeenCalledTimes(1);
    act(() => {
      renderer.unmount();
    });
  });

  it('passes input presentation props and the real focus seam to TextInput', () => {
    const onChangeText = () => undefined;
    const onSelectionChange = vi.fn();
    const onFocus = vi.fn();
    const onBlur = vi.fn();
    const inputRef = createRef<PrimitiveInputHandle>();
    const renderer = mount(
      <PrimitiveInput
        testID="sample:input-contract"
        maxLength={3}
        onChangeText={onChangeText}
        onSelectionChange={onSelectionChange}
        selection={{start: 1}}
        onFocus={onFocus}
        onBlur={onBlur}
        inputRef={inputRef}
      />,
    );
    const input = renderer.root.findAllByType(TextInput).find(node => node.props.testID === 'sample:input-contract')!;
    expect(input.props.maxLength).toBe(3);
    expect(input.props.onChangeText).toBe(onChangeText);
    expect(input.props.selection).toEqual({start: 1, end: 1});
    expect(input.props.accessibilityRole).toBeUndefined();
    expect(input.props.showSoftInputOnFocus).toBe(false);
    expect(inputRef.current).toEqual(
      expect.objectContaining({
        focus: expect.any(Function),
        blur: expect.any(Function),
        measureLayout: expect.any(Function),
        measureInWindow: expect.any(Function),
      }),
    );

    const focusProps = input.props as Readonly<{
      readonly onFocus: (event: unknown) => void;
      readonly onBlur: (event: unknown) => void;
    }>;
    focusProps.onFocus({nativeEvent: {}});
    focusProps.onBlur({nativeEvent: {}});
    expect(onFocus).toHaveBeenCalledTimes(1);
    expect(onBlur).toHaveBeenCalledTimes(1);

    const selectionEvent = {nativeEvent: {selection: {start: 2, end: 3}}};
    const changeProps = input.props as Readonly<{
      readonly onSelectionChange: (event: typeof selectionEvent) => void;
    }>;
    changeProps.onSelectionChange(selectionEvent);
    expect(onSelectionChange).toHaveBeenCalledWith(selectionEvent);
    act(() => {
      renderer.unmount();
    });
  });

  it('reports a measurement failure when the native input lacks measureLayout', () => {
    const inputRef = createRef<PrimitiveInputHandle>();
    const onFail = vi.fn();
    const callback = vi.fn();
    const measureInWindow = vi.fn();
    let renderer: ReactTestRenderer | undefined;
    act(() => {
      renderer = createWithNodeMock(
        <PrimitiveInput testID="sample:missing-measure-layout" inputRef={inputRef} />,
        {createNodeMock: () => ({measureInWindow})},
      );
    });

    inputRef.current!.measureLayout({} as never, callback, onFail);

    expect(callback).not.toHaveBeenCalled();
    expect(onFail).toHaveBeenCalledTimes(1);
    expect(measureInWindow).not.toHaveBeenCalled();
    act(() => {
      renderer!.unmount();
    });
  });

  it('reports a measurement failure when the native input ref is unavailable', () => {
    const inputRef = createRef<PrimitiveInputHandle>();
    const onFail = vi.fn();
    let renderer: ReactTestRenderer | undefined;
    act(() => {
      renderer = mount(<PrimitiveInput testID="sample:missing-native-input" inputRef={inputRef} />);
    });

    inputRef.current!.measureLayout({} as never, vi.fn(), onFail);

    expect(onFail).toHaveBeenCalledTimes(1);
    act(() => {
      renderer!.unmount();
    });
  });

  it('forwards generic scroll measurement and offset observation without business props', () => {
    const scrollRef = createRef<PrimitiveScrollViewHandle>();
    const onScrollOffsetChange = vi.fn();
    const renderer = mount(
      <PrimitiveScrollView ref={scrollRef} testID="sample:scroll-contract" onScrollOffsetChange={onScrollOffsetChange}>
        内容
      </PrimitiveScrollView>,
    );
    const scrollView = renderer.root
      .findAllByType(ScrollView)
      .find(node => node.props.testID === 'sample:scroll-contract')!;
    expect(scrollRef.current).toEqual(
      expect.objectContaining({
        getContentNativeNode: expect.any(Function),
        measureInWindow: expect.any(Function),
        scrollTo: expect.any(Function),
      }),
    );
    const onScroll = scrollView.props.onScroll as (event: {
      readonly nativeEvent: {readonly contentOffset: {readonly y: number}};
    }) => void;
    onScroll({nativeEvent: {contentOffset: {y: 42}}});
    expect(onScrollOffsetChange).toHaveBeenCalledWith(42);
    act(() => {
      renderer.unmount();
    });
  });

  it('rejects an empty addressability key', () => {
    expect(() => mount(<PrimitiveText testID=" ">内容</PrimitiveText>)).toThrow('testID');
  });

  it('keeps text accessibility roles within feedback semantics', () => {
    const renderer = mount(
      <PrimitiveContainer testID="sample:role-root">
        <PrimitiveText testID="sample:alert" accessibilityRole="alert">
          提示
        </PrimitiveText>
        <PrimitiveText testID="sample:status" accessibilityRole="status">
          状态
        </PrimitiveText>
      </PrimitiveContainer>,
    );

    const textByTestID = (testID: string) =>
      renderer.root.findAllByType(Text).find(node => node.props.testID === testID);
    expect(textByTestID('sample:alert')?.props.role).toBe('alert');
    expect(textByTestID('sample:status')?.props.role).toBe('status');
    act(() => {
      renderer.unmount();
    });
  });

  it('rejects control roles at the PrimitiveText type boundary', () => {
    const invalidRole = (
      // @ts-expect-error PrimitiveText only accepts feedback roles; controls use dedicated primitives.
      <PrimitiveText testID="sample:invalid-role" accessibilityRole="button">
        错误
      </PrimitiveText>
    );
    void invalidRole;
  });

  it('keeps busy actions inert and exposes semantic interactive state', () => {
    const onPress = vi.fn();
    const onValueChange = vi.fn();
    const renderer = mount(
      <PrimitiveContainer testID="sample:state-root">
        <PrimitiveButton testID="sample:busy" accessibilityLabel="保存" busy onPress={onPress}>
          保存
        </PrimitiveButton>
        <PrimitiveSegmentedControl
          testID="sample:segments"
          accessibilityLabel="诊断分区"
          items={[{value: 'one', label: '一'}, {value: 'two', label: '二'}]}
          selectedValue="one"
          onValueChange={onValueChange}
        />
        <PrimitiveSpinner testID="sample:spinner" accessibilityLabel="加载中" />
        <PrimitiveInlineAlert testID="sample:alert" tone="error">失败</PrimitiveInlineAlert>
        <PrimitiveEmptyState testID="sample:empty" accessibilityLabel="空列表">暂无数据</PrimitiveEmptyState>
        <PrimitiveBadge testID="sample:badge" tone="ok">可用</PrimitiveBadge>
      </PrimitiveContainer>,
    );

    const busy = renderer.root.findAllByType(Pressable).find(node => node.props.testID === 'sample:busy')!;
    act(() => { (busy.props.onPress as () => void)(); });
    expect(onPress).not.toHaveBeenCalled();
    expect(busy.props.accessibilityState).toMatchObject({disabled: true, busy: true});

    const second = renderer.root.findByProps({testID: 'sample:segments:two'});
    act(() => { (second.props.onPress as () => void)(); });
    expect(onValueChange).toHaveBeenCalledWith('two');
    expect(renderer.root.findByProps({testID: 'sample:spinner'})).toBeDefined();
    expect(renderer.root.findAllByType(View).find(node => node.props.testID === 'sample:alert')?.props.accessibilityRole).toBe('alert');
    expect(renderer.root.findByProps({testID: 'sample:empty'})).toBeDefined();
    expect(renderer.root.findByProps({testID: 'sample:badge'})).toBeDefined();
    act(() => { renderer.unmount(); });
  });

  it('exposes tab semantics for bounded navigation primitives', () => {
    const renderer = mount(
      <PrimitiveGrid testID="sample:tablist" accessibilityLabel="分区" accessibilityRole="tablist">
        <PrimitivePressOption
          testID="sample:tab"
          accessibilityLabel="第一节"
          accessibilityRole="tab"
          selected
        >
          第一节
        </PrimitivePressOption>
      </PrimitiveGrid>,
    );

    const tablist = renderer.root.findAllByType(View).find(node => node.props.testID === 'sample:tablist')!;
    const tab = renderer.root.findAllByType(Pressable).find(node => node.props.testID === 'sample:tab')!;
    expect(tablist.props.accessibilityRole).toBe('tablist');
    expect(tablist.props.accessibilityLabel).toBe('分区');
    expect(tab.props.accessibilityRole).toBe('tab');
    expect(tab.props['aria-selected']).toBe(true);
    expect(tab.props.accessibilityState).toMatchObject({selected: true});
    act(() => { renderer.unmount(); });
  });

  it('renders a non-empty SVG path from the primitives icon set', () => {
    const renderer = mount(
      <RnrSvgIcon
        testID="sample:icon"
        accessibilityLabel="信息"
        path={primitiveIconPaths.info}
      />,
    );
    const svg = renderer.root.findAllByType(Svg).find(node => node.props.testID === 'sample:icon')!;
    const path = renderer.root.findByType(Path);
    expect(svg.props.accessibilityLabel).toBe('信息');
    expect(path.props.d).toBe(primitiveIconPaths.info);
    expect(String(path.props.d).length).toBeGreaterThan(0);
    act(() => { renderer.unmount(); });
  });

  it('keeps the full list data while bounding mounted rows across scroll transitions', () => {
    const data = Array.from({length: 100}, (_value, index) => `row-${index}`);
    const renderer = mount(
      <PrimitiveList
        testID="sample:list"
        data={data}
        rowHeight={10}
        getItemKey={item => item}
        renderItem={item => <PrimitiveText testID={`sample:list:content:${item}`}>{item}</PrimitiveText>}
      />,
    );
    type VirtualizedListProbe = {
      readonly props: Readonly<{
        readonly testID?: string;
        readonly className?: string;
        readonly getItemCount: (items: readonly string[]) => number;
        readonly onScroll: (event: {readonly nativeEvent: {readonly contentOffset: {readonly y: number}}}) => void;
        readonly renderItem: (input: {readonly item: string; readonly index: number}) => unknown;
      }>;
    };
    const list = () => renderer.root.findAllByType(VirtualizedList)
      .map(node => node as unknown as VirtualizedListProbe)
      .find(node => node.props.testID === 'sample:list')!;
    expect(list().props.getItemCount(data)).toBe(100);
    expect(list().props.className).toBe(baseTokens.list);

    const observeWindow = (offsetY: number) => {
      act(() => {
        (list().props.onScroll as (event: {readonly nativeEvent: {readonly contentOffset: {readonly y: number}}}) => void)({
          nativeEvent: {contentOffset: {y: offsetY}},
        });
      });
      const renderItem = list().props.renderItem as (input: {readonly item: string; readonly index: number}) => unknown;
      const rendered = data.map((item, index) => renderItem({item, index})).filter(node => {
        const testID = (node as {readonly props?: Readonly<Record<string, unknown>>} | null)?.props?.testID;
        return typeof testID === 'string' && testID.startsWith('sample:list:row:');
      }) as Array<{
        readonly props?: Readonly<Record<string, unknown>>
      }>;
      expect(rendered.length).toBeLessThanOrEqual(24);
      return rendered;
    };

    const head = observeWindow(0) as Array<{readonly props?: Readonly<Record<string, unknown>>}>;
    expect(head.some(node => String(node.props?.testID).endsWith(':row-0'))).toBe(true);
    for (const offsetY of [10, 80, 160, 320, 480, 640, 800, 900]) observeWindow(offsetY);
    const tail = observeWindow(900) as Array<{readonly props?: Readonly<Record<string, unknown>>}>;
    expect(tail.some(node => String(node.props?.testID).endsWith(':row-99'))).toBe(true);
    act(() => { renderer.unmount(); });
  });
});
