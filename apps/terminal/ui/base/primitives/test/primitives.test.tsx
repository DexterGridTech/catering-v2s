import {derivedPrimitiveTestId, primitiveTestId} from './testIds';
import {createRef, useState} from 'react';
import {act, render, type RenderResult} from '@testing-library/react-native';
import {Platform, StyleSheet, View} from 'react-native';
import {setPlatformOSForTests} from '../../../../../../tools/terminal-shared/react-native-vitest-entry';
import Svg, {Path} from 'react-native-svg';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {
  PrimitiveButton,
  PrimitiveActions,
  PrimitiveBadge,
  PrimitiveContainer,
  PrimitiveDisclosure,
  PrimitiveDropdownSelect,
  PrimitiveEmptyState,
  PrimitiveForm,
  PrimitiveGrid,
  PrimitiveInlineAlert,
  PrimitiveList,
  PrimitiveSegmentedControl,
  PrimitiveSpinner,
  PrimitiveHeading,
  PrimitiveInput,
  PrimitiveImage,
  PrimitiveKeyboardBackdrop,
  PrimitiveKeyboardSurface,
  type PrimitiveInputHandle,
  PrimitiveLabel,
  PrimitivePinInput,
  type PrimitiveNativeNode,
  PrimitivePressOption,
  PrimitiveRatioBar,
  PrimitiveScrollView,
  type PrimitiveScrollViewHandle,
  PrimitiveStatus,
  PrimitiveSurfaceMap,
  PrimitiveText,
} from '../src/index';
import {baseLayout, baseTokens} from '../src/theme/tokens';
import {primitiveIconPaths, RnrSvgIcon} from '../src/foundations/nativeSlots';
import {
  resetNativeTestRefFactory,
  setNativeTestRefFactory,
  withNativeTestHosts,
} from '../../../../../../tools/terminal-shared/rntl-native-test-host';
import {getRenderedNode, queryRenderedTree} from '../../../../../../tools/terminal-shared/rntl-rendered-tree';

const {useNativeVariableMock} = vi.hoisted(() => ({useNativeVariableMock: vi.fn(() => undefined)}));
vi.mock('../src/foundations/nativeVariable', () => ({useNativeVariable: useNativeVariableMock}));

vi.mock('react-native', async importOriginal => {
  const actual = await importOriginal<typeof import('react-native')>();
  const [{withNativeTestHosts}, reactRuntime] = await Promise.all([
    import('../../../../../../tools/terminal-shared/rntl-native-test-host'),
    import('react'),
  ]);
  return withNativeTestHosts(actual, reactRuntime);
});

const mount = async (element: React.ReactElement): Promise<RenderResult> => render(element);
const hostNodes = (result: RenderResult, type: string) => queryRenderedTree(result, node => node.type === type);
const hostNode = (result: RenderResult, type: string, testID: string) =>
  getRenderedNode(result, node => node.type === type && node.props.testID === primitiveTestId(testID));

afterEach(resetNativeTestRefFactory);

describe('ui primitives', () => {
  it('keeps the form host native-transparent and prevents browser submit defaults', async () => {
    const nativeRenderer = await mount(
      <PrimitiveForm>
        <View testID={primitiveTestId('sample:form-child')} />
      </PrimitiveForm>,
    );
    expect(nativeRenderer.getByTestId(primitiveTestId('sample:form-child'))).toBeDefined();
    expect(queryRenderedTree(nativeRenderer, node => node.type === 'form')).toHaveLength(0);

    const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
    try {
      Object.defineProperty(globalThis, 'document', {configurable: true, value: {}});
      const onSubmit = vi.fn();
      const browserRenderer = await mount(
        <PrimitiveForm onSubmit={onSubmit}>
          <View testID={primitiveTestId('sample:web-form-child')} />
        </PrimitiveForm>,
      );
      const form = getRenderedNode(browserRenderer, node => node.type === 'form');
      const preventDefault = vi.fn();
      const submit = form.props.onSubmit as (event: {readonly preventDefault: () => void}) => void;
      submit({preventDefault});
      expect(preventDefault).toHaveBeenCalledTimes(1);
      expect(onSubmit).toHaveBeenCalledTimes(1);
      await act(async () => {
        await browserRenderer.unmount();
      });
    } finally {
      if (originalDocument === undefined) delete (globalThis as {document?: unknown}).document;
      else Object.defineProperty(globalThis, 'document', originalDocument);
    }
    expect(Object.getOwnPropertyDescriptor(globalThis, 'document')).toEqual(originalDocument);
  });

  it('renders addressable native controls with required testIDs', async () => {
    const renderer = await mount(
      <PrimitiveContainer testID={primitiveTestId('sample:root')}>
        <PrimitiveHeading testID={primitiveTestId('sample:heading')}>标题</PrimitiveHeading>
        <PrimitiveLabel testID={primitiveTestId('sample:label')} nativeID="sample:label">
          姓名
        </PrimitiveLabel>
        <PrimitiveInput testID={primitiveTestId('sample:input')} accessibilityLabel="姓名" value="Alice" />
        <PrimitiveText testID={primitiveTestId('sample:text')}>内容</PrimitiveText>
        <PrimitiveStatus testID={primitiveTestId('sample:status')}>状态</PrimitiveStatus>
        <PrimitiveActions testID={primitiveTestId('sample:actions')} />
        <PrimitiveScrollView testID={primitiveTestId('sample:scroll')}>
          <PrimitiveText testID={primitiveTestId('sample:scroll:text')}>可滚动内容</PrimitiveText>
        </PrimitiveScrollView>
        <PrimitiveButton testID={primitiveTestId('sample:button')}>确定</PrimitiveButton>
      </PrimitiveContainer>,
    );

    expect(baseTokens.container).toContain('bg-canvas');
    expect(baseTokens.text).toContain('leading-6');
    expect(baseTokens.heading).toContain('leading-7');
    expect(baseTokens.label).toContain('leading-5');
    expect(baseTokens.status).toContain('leading-6');
    const container = hostNode(renderer, 'View', 'sample:root');
    expect(container.props.className).toBe('flex-1 bg-canvas p-6 gap-4');
    expect(renderer.getByTestId(primitiveTestId('sample:root'))).toBeDefined();
    const heading = hostNode(renderer, 'Text', 'sample:heading');
    expect(heading.props.accessibilityRole).toBe('header');
    expect(heading.props.accessibilityLiveRegion).toBe('polite');
    expect(renderer.getByTestId(primitiveTestId('sample:label'))).toBeDefined();
    expect(renderer.getByTestId(primitiveTestId('sample:label')).props.nativeID).toBe('sample:label');
    expect(renderer.getByTestId(primitiveTestId('sample:input'))).toBeDefined();
    expect(renderer.getByTestId(primitiveTestId('sample:text'))).toBeDefined();
    expect(renderer.getByTestId(primitiveTestId('sample:status'))).toBeDefined();
    expect(renderer.getByTestId(primitiveTestId('sample:actions'))).toBeDefined();
    const scrollView = hostNode(renderer, 'ScrollView', 'sample:scroll');
    expect(scrollView.props.className).toBe('w-full flex-1 bg-canvas');
    expect(scrollView.props.contentContainerStyle).toEqual({gap: baseLayout.scrollContentGap});
    expect(scrollView.props.scrollEventThrottle).toBe(16);
    expect(renderer.getByTestId(primitiveTestId('sample:scroll'))).toBeDefined();
    expect(baseTokens.button).toContain('bg-action');
    const button = hostNode(renderer, 'Pressable', 'sample:button');
    expect(button.props.className).toBe('self-start min-h-12 rounded-md bg-action px-4 py-3');
    expect(renderer.getByTestId(primitiveTestId('sample:button'))).toBeDefined();
    expect(hostNodes(renderer, 'View').length).toBeGreaterThan(0);
    expect(hostNodes(renderer, 'Text').length).toBeGreaterThan(0);
    expect(hostNodes(renderer, 'TextInput').length).toBeGreaterThan(0);
    expect(hostNodes(renderer, 'ScrollView').length).toBeGreaterThan(0);
    expect(hostNodes(renderer, 'Text').every(node => node.props.allowFontScaling === false)).toBe(true);
    expect(hostNodes(renderer, 'TextInput').every(node => node.props.allowFontScaling === false)).toBe(true);
  });

  it('keeps surface, content, card, and centered layouts presentation-only', async () => {
    const renderer = await mount(
      <PrimitiveContainer testID={primitiveTestId('sample:layout-root')} layout="centered">
        <PrimitiveContainer testID={primitiveTestId('sample:layout-content')} layout="content" bounded />
        <PrimitiveContainer testID={primitiveTestId('sample:layout-card')} layout="card" bounded />
      </PrimitiveContainer>,
    );

    const byTestID = (testID: string) => renderer.queryByTestId(primitiveTestId(testID));
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
    expect(byTestID('sample:layout-card')?.props.className).not.toContain(baseTokens.containerElevated);

    const elevatedRenderer = await mount(
      <PrimitiveContainer testID={primitiveTestId('sample:elevated-card')} layout="card" bounded elevated />,
    );
    const elevatedView = hostNode(elevatedRenderer, 'View', 'sample:elevated-card');
    expect(elevatedView.props.className).toBe(
      `${baseTokens.containerCard} ${baseTokens.containerBoundedCard} ${baseTokens.containerElevated}`,
    );
    await act(async () => {
      await elevatedRenderer.unmount();
    });
    await act(async () => {
      await renderer.unmount();
    });
  });

  it('forwards an optional trailing content inset without changing the viewport contract', async () => {
    const renderer = await mount(
      <PrimitiveScrollView testID={primitiveTestId('sample:scroll-padding')} contentPaddingBottom={64}>
        <PrimitiveText testID={primitiveTestId('sample:scroll-padding:text')}>内容</PrimitiveText>
      </PrimitiveScrollView>,
    );
    const scrollView = hostNode(renderer, 'ScrollView', 'sample:scroll-padding');
    expect(scrollView.props.contentContainerStyle).toEqual({gap: baseLayout.scrollContentGap, paddingBottom: 64});
    expect(scrollView.props.horizontal).not.toBe(true);
    await act(async () => {
      await renderer.unmount();
    });
  });

  it('renders a masked pin input with stable cells and explicit elevated interaction guards', async () => {
    const onPress = vi.fn();
    const onTouchEnd = vi.fn();
    const onClick = vi.fn();
    const renderer = await mount(
      <PrimitivePinInput
        testID={primitiveTestId('sample:pin')}
        cellTestIDPrefix={primitiveTestId('sample:pin')}
        accessibilityLabel="输入动态口令"
        value="12"
        length={6}
        focusedIndex={2}
        onPress={onPress}
        onTouchEnd={onTouchEnd}
        onClick={onClick}
      />,
    );
    const pressable = hostNode(renderer, 'Pressable', 'sample:pin');
    expect(pressable.props.onPress).toBe(onPress);
    expect(pressable.props.onTouchEnd).toBe(onTouchEnd);
    expect(pressable.props.onClick).toBeUndefined();
    expect(renderer.getByTestId(derivedPrimitiveTestId('sample:pin', 'cells')!)).toBeDefined();
    expect(renderer.getByTestId(derivedPrimitiveTestId('sample:pin', 'digit', '0')!).props.children).toBe('*');
    expect(renderer.getByTestId(derivedPrimitiveTestId('sample:pin', 'digit', '1')!).props.children).toBe('*');
    expect(renderer.getByTestId(derivedPrimitiveTestId('sample:pin', 'digit', '2')!).props.children).toBe('');
    expect(hostNodes(renderer, 'View').some(node => node.props.className === baseTokens.pinCellFocused)).toBe(true);
    await act(async () => {
      (pressable.props.onPress as (() => void) | undefined)?.();
    });
    expect(onPress).toHaveBeenCalledTimes(1);
    await act(async () => {
      await renderer.unmount();
    });

    vi.stubGlobal('document', {});
    const browserRenderer = await mount(
      <PrimitivePinInput
        testID={primitiveTestId('sample:browser-pin')}
        cellTestIDPrefix={primitiveTestId('sample:browser-pin')}
        value=""
        length={6}
        onTouchEnd={onTouchEnd}
        onClick={onClick}
      />,
    );
    const browserPressable = hostNode(browserRenderer, 'Pressable', 'sample:browser-pin');
    expect(browserPressable.props.onClick).toBe(onClick);
    expect(browserPressable.props.onTouchEnd).toBeUndefined();
    await act(async () => {
      await browserRenderer.unmount();
    });
    vi.unstubAllGlobals();
  });

  it('forwards the PIN measurement ref to the actual interactive root', async () => {
    const measureRef = createRef<Pick<PrimitiveInputHandle, 'measureLayout'>>();
    const pinHost = {measureLayout: vi.fn()};
    const pinProps = {
      testID: primitiveTestId('sample:measured-pin'),
      cellTestIDPrefix: primitiveTestId('sample:measured-pin'),
      value: '',
      length: 6,
      measureRef,
    };
    setNativeTestRefFactory((hostName, props) =>
      hostName === 'Pressable' && props.testID === primitiveTestId('sample:measured-pin') ? pinHost : null,
    );
    const renderer = await mount(<PrimitivePinInput {...pinProps} />);
    const pressable = hostNode(renderer, 'Pressable', 'sample:measured-pin');
    expect(pressable).toBeDefined();
    expect(measureRef.current).toBe(pinHost);
    const relativeTo = {} as PrimitiveNativeNode;
    const measured = vi.fn();
    measureRef.current?.measureLayout(relativeTo, measured);
    expect(pinHost.measureLayout.mock.calls).toEqual([[relativeTo, measured]]);
    await act(async () => {
      await renderer.unmount();
    });
  });

  it('keeps the scroll viewport opaque by default and supports an explicit transparent variant', async () => {
    const renderer = await mount(
      <>
        <PrimitiveScrollView testID={primitiveTestId('sample:scroll-opaque')}>
          <PrimitiveText testID={primitiveTestId('sample:scroll-opaque:text')}>内容</PrimitiveText>
        </PrimitiveScrollView>
        <PrimitiveScrollView testID={primitiveTestId('sample:scroll-transparent')} layout="transparent">
          <PrimitiveText testID={primitiveTestId('sample:scroll-transparent:text')}>内容</PrimitiveText>
        </PrimitiveScrollView>
      </>,
    );

    const scrollView = (testID: string) => hostNode(renderer, 'ScrollView', testID);
    expect(scrollView('sample:scroll-opaque').props.className).toBe(baseTokens.scroll);
    expect(scrollView('sample:scroll-transparent').props.className).toBe('w-full flex-1');
    await act(async () => {
      await renderer.unmount();
    });
  });

  it('renders a background image through the shared image seam and keeps missing sources empty', async () => {
    const renderer = await mount(
      <PrimitiveContainer testID={primitiveTestId('sample:transparent')} layout="transparent">
        <PrimitiveImage
          testID={primitiveTestId('sample:background')}
          layout="background"
          source={{uri: 'wallpaper.jpg'}}
        />
        <PrimitiveImage testID={primitiveTestId('sample:missing')} layout="background" />
      </PrimitiveContainer>,
    );

    const transparent = hostNode(renderer, 'View', 'sample:transparent');
    expect(transparent.props.className).toBe(baseTokens.containerTransparent);
    const image = hostNode(renderer, 'Image', 'sample:background');
    expect(image.props.className).toBe(baseTokens.imageBackground);
    expect(image.props.resizeMode).toBe('cover');
    expect(image.props.source).toEqual({uri: 'wallpaper.jpg'});
    expect(renderer.queryAllByTestId('sample:missing')).toHaveLength(0);
    await act(async () => {
      await renderer.unmount();
    });
  });

  it('supports keyboard cell variants without exposing styling to consumers', async () => {
    const onPress = vi.fn();
    const renderer = await mount(
      <PrimitiveButton testID={primitiveTestId('sample:key')} accessibilityLabel="1" onPress={onPress} variant="key">
        1
      </PrimitiveButton>,
    );

    const button = hostNode(renderer, 'Pressable', 'sample:key');
    expect(button.props.className).toBe(baseTokens.keyboardKey);
    expect(button.props.style).toBeUndefined();
    await act(async () => {
      (button.props.onPressIn as (() => void) | undefined)?.();
    });
    const pressedButton = hostNode(renderer, 'Pressable', 'sample:key');
    expect(pressedButton.props.className).toContain('border-2 border-keyboard-focus');
    expect(pressedButton.props.style).toEqual({opacity: 0.78, transform: [{scale: 0.985}]});
    await act(async () => {
      (pressedButton.props.onPressOut as (() => void) | undefined)?.();
    });
    const releasedButton = hostNode(renderer, 'Pressable', 'sample:key');
    expect(releasedButton.props.style).toBeUndefined();
    await act(async () => {
      (releasedButton.props.onPress as (() => void) | undefined)?.();
    });
    expect(onPress).toHaveBeenCalledTimes(1);
    await act(async () => {
      await renderer.unmount();
    });
  });

  it('shows the theme focus outline for every pressed keyboard key and action', async () => {
    const renderer = await mount(
      <>
        <PrimitiveButton
          testID={primitiveTestId('sample:pressed-key')}
          accessibilityLabel="1"
          onPress={() => undefined}
          variant="key"
        >
          1
        </PrimitiveButton>
        <PrimitiveButton
          testID={primitiveTestId('sample:pressed-action')}
          accessibilityLabel="删除"
          onPress={() => undefined}
          variant="key-action"
        >
          删除
        </PrimitiveButton>
      </>,
    );

    const pressable = (testID: string) => hostNode(renderer, 'Pressable', testID);
    expect(pressable('sample:pressed-key').props.className).not.toContain('border-2 border-keyboard-focus');
    expect(pressable('sample:pressed-action').props.className).not.toContain('border-2 border-keyboard-focus');

    await act(async () => {
      (pressable('sample:pressed-key').props.onPressIn as (() => void) | undefined)?.();
      (pressable('sample:pressed-action').props.onPressIn as (() => void) | undefined)?.();
    });

    expect(pressable('sample:pressed-key').props.className).toContain('border-2 border-keyboard-focus');
    expect(pressable('sample:pressed-action').props.className).toContain('border-2 border-keyboard-focus');

    await act(async () => {
      (pressable('sample:pressed-key').props.onPressOut as (() => void) | undefined)?.();
      (pressable('sample:pressed-action').props.onPressOut as (() => void) | undefined)?.();
    });

    expect(pressable('sample:pressed-key').props.className).not.toContain('border-2 border-keyboard-focus');
    expect(pressable('sample:pressed-action').props.className).not.toContain('border-2 border-keyboard-focus');
    await act(async () => {
      await renderer.unmount();
    });
  });

  it('does not subscribe keyboard buttons to login gradient variables', async () => {
    useNativeVariableMock.mockClear();
    const renderer = await mount(
      <>
        <PrimitiveButton
          testID={primitiveTestId('sample:keyboard-key')}
          accessibilityLabel="1"
          onPress={() => undefined}
          variant="key"
        >
          1
        </PrimitiveButton>
        <PrimitiveButton
          testID={primitiveTestId('sample:keyboard-action')}
          accessibilityLabel="删除"
          onPress={() => undefined}
          variant="key-action"
        >
          删除
        </PrimitiveButton>
      </>,
    );

    expect(useNativeVariableMock).not.toHaveBeenCalled();
    await act(async () => {
      await renderer.unmount();
    });

    useNativeVariableMock.mockClear();
    const loginRenderer = await mount(
      <PrimitiveButton
        testID={primitiveTestId('sample:login-primary')}
        accessibilityLabel="登录"
        appearance="login-primary"
        onPress={() => undefined}
      >
        登录
      </PrimitiveButton>,
    );
    expect(useNativeVariableMock).toHaveBeenCalledTimes(2);
    await act(async () => {
      await loginRenderer.unmount();
    });

    useNativeVariableMock.mockClear();
    const adminRenderer = await mount(
      <PrimitiveButton
        testID={primitiveTestId('sample:admin-primary')}
        accessibilityLabel="开启主机服务"
        appearance="admin-primary"
        onPress={() => undefined}
      >
        开启主机服务
      </PrimitiveButton>,
    );
    expect(useNativeVariableMock).toHaveBeenCalledWith('--color-admin-action-start');
    expect(useNativeVariableMock).toHaveBeenCalledWith('--color-admin-action-end');
    await act(async () => {
      await adminRenderer.unmount();
    });
  });

  it('renders the semantic keyboard surface and selected modifier recipe', async () => {
    const stopNative = vi.fn();
    const renderer = await mount(
      <PrimitiveKeyboardSurface
        testID={primitiveTestId('sample:keyboard-surface')}
        onTouchEnd={stopNative}
        onClick={() => undefined}
      >
        <PrimitiveButton
          testID={primitiveTestId('sample:selected-key')}
          accessibilityLabel="Shift"
          variant="key-action"
          selected
        >
          ⇧
        </PrimitiveButton>
      </PrimitiveKeyboardSurface>,
    );
    const surface = hostNode(renderer, 'View', 'sample:keyboard-surface');
    const selected = hostNode(renderer, 'Pressable', 'sample:selected-key');
    expect(surface.props.className).toBe(baseTokens.keyboardDock);
    expect(typeof surface.props.onTouchEnd).toBe('function');
    expect(surface.props.onClick).toBeUndefined();
    expect(baseTokens.keyboardAction).toContain('bg-keyboard-action');
    expect(baseTokens.keyboardActionSelected).toContain('bg-keyboard-action');
    expect(baseTokens.keyboardDock).not.toMatch(/(?:^|\s)rounded/);
    const surfaceStyle = StyleSheet.flatten(surface.props.style);
    expect(surfaceStyle).not.toHaveProperty('borderRadius');
    expect(surfaceStyle).toMatchObject({boxShadow: '0px 8px 9px rgba(0, 0, 0, 0.28)', elevation: 8});
    expect(surfaceStyle).not.toHaveProperty('shadowColor');
    expect(surfaceStyle).not.toHaveProperty('shadowOffset');
    expect(surfaceStyle).not.toHaveProperty('shadowOpacity');
    expect(surfaceStyle).not.toHaveProperty('shadowRadius');
    expect(selected.props.className).toBe(baseTokens.keyboardActionSelected);
    expect(selected.props.accessibilityState).toMatchObject({selected: true});
    await act(async () => {
      (surface.props.onTouchEnd as ((event: {readonly stopPropagation: () => void}) => void) | undefined)?.({
        stopPropagation: stopNative,
      });
    });
    expect(stopNative).toHaveBeenCalledTimes(1);
    await act(async () => {
      await renderer.unmount();
    });
  });

  it('provides a full-width semantic backdrop for an inset keyboard dock', async () => {
    const renderer = await mount(
      <PrimitiveKeyboardBackdrop testID={primitiveTestId('sample:keyboard-backdrop')} style={{height: 219}} />,
    );
    const backdrop = hostNode(renderer, 'View', 'sample:keyboard-backdrop');
    expect(backdrop.props.className).toBe(baseTokens.keyboardBackdrop);
    expect(StyleSheet.flatten(backdrop.props.style)).toEqual({height: 219});
    await act(async () => {
      await renderer.unmount();
    });
  });

  it('restores the document stub after selecting the browser keyboard boundary', async () => {
    const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
    try {
      Object.defineProperty(globalThis, 'document', {configurable: true, value: {}});
      const stopWeb = vi.fn();
      const renderer = await mount(
        <PrimitiveKeyboardSurface
          testID={primitiveTestId('sample:web-keyboard-surface')}
          onTouchEnd={() => undefined}
          onClick={event => event.stopPropagation()}
        />,
      );
      const surface = hostNode(renderer, 'View', 'sample:web-keyboard-surface');
      expect(surface.props.onTouchEnd).toBeUndefined();
      expect(typeof surface.props.onClick).toBe('function');
      (surface.props.onClick as ((event: {readonly stopPropagation: () => void}) => void) | undefined)?.({
        stopPropagation: stopWeb,
      });
      expect(stopWeb).toHaveBeenCalledTimes(1);
      await act(async () => {
        await renderer.unmount();
      });
    } finally {
      if (originalDocument === undefined) {
        delete (globalThis as {document?: unknown}).document;
      } else {
        Object.defineProperty(globalThis, 'document', originalDocument);
      }
    }
    expect(Object.getOwnPropertyDescriptor(globalThis, 'document')).toEqual(originalDocument);
  });

  it('passes input presentation props and the real focus seam to TextInput', async () => {
    const onChangeText = () => undefined;
    const onSelectionChange = vi.fn();
    const onFocus = vi.fn();
    const onBlur = vi.fn();
    const inputRef = createRef<PrimitiveInputHandle>();
    const renderer = await mount(
      <PrimitiveInput
        testID={primitiveTestId('sample:input-contract')}
        maxLength={3}
        onChangeText={onChangeText}
        onSelectionChange={onSelectionChange}
        selection={{start: 1}}
        onFocus={onFocus}
        onBlur={onBlur}
        inputRef={inputRef}
      />,
    );
    const input = hostNode(renderer, 'TextInput', 'sample:input-contract');
    expect(input.props.maxLength).toBe(3);
    expect(input.props.onChangeText).toBe(onChangeText);
    expect(input.props.selection).toEqual({start: 1, end: 1});
    expect(input.props.accessibilityRole).toBeUndefined();
    expect(input.props.showSoftInputOnFocus).toBe(false);
    expect(input.props.contextMenuHidden).toBe(true);
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
    await act(async () => {
      await renderer.unmount();
    });
  });

  it('cancels the browser context menu at the shared TextInput slot', async () => {
    const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
    Object.defineProperty(globalThis, 'document', {configurable: true, value: {}});
    try {
      const renderer = await mount(<PrimitiveInput testID={primitiveTestId('sample:context-menu')} />);
      const input = hostNode(renderer, 'TextInput', 'sample:context-menu');
      const preventDefault = vi.fn();
      expect(typeof input.props.onContextMenu).toBe('function');
      (input.props.onContextMenu as (event: Readonly<{readonly preventDefault: () => void}>) => void)({preventDefault});
      expect(preventDefault).toHaveBeenCalledTimes(1);
      await act(async () => {
        await renderer.unmount();
      });
    } finally {
      if (originalDocument === undefined) {
        delete (globalThis as {document?: unknown}).document;
      } else {
        Object.defineProperty(globalThis, 'document', originalDocument);
      }
    }
  });

  it('reports a measurement failure when the native input lacks measureLayout', async () => {
    const inputRef = createRef<PrimitiveInputHandle>();
    const onFail = vi.fn();
    const callback = vi.fn();
    const measureInWindow = vi.fn();
    setNativeTestRefFactory(hostName => (hostName === 'TextInput' ? {measureInWindow} : {}));
    const renderer = await mount(
      <PrimitiveInput testID={primitiveTestId('sample:missing-measure-layout')} inputRef={inputRef} />,
    );

    inputRef.current!.measureLayout({} as never, callback, onFail);

    expect(callback).not.toHaveBeenCalled();
    expect(onFail).toHaveBeenCalledTimes(1);
    expect(measureInWindow).not.toHaveBeenCalled();
    await act(async () => {
      await renderer.unmount();
    });
  });

  it('reports a measurement failure when the native input ref is unavailable', async () => {
    const inputRef = createRef<PrimitiveInputHandle>();
    const onFail = vi.fn();
    setNativeTestRefFactory(hostName => (hostName === 'TextInput' ? null : {}));
    const renderer = await mount(
      <PrimitiveInput testID={primitiveTestId('sample:missing-native-input')} inputRef={inputRef} />,
    );

    inputRef.current!.measureLayout({} as never, vi.fn(), onFail);

    expect(onFail).toHaveBeenCalledTimes(1);
    await act(async () => {
      await renderer.unmount();
    });
  });

  it('forwards generic scroll measurement and offset observation without business props', async () => {
    const scrollRef = createRef<PrimitiveScrollViewHandle>();
    const onScrollOffsetChange = vi.fn();
    const onScrollEndDrag = vi.fn();
    const onMomentumScrollEnd = vi.fn();
    const onContentHeightChange = vi.fn();
    const nativeMeasureLayout = vi.fn();
    const measureInWindow = vi.fn();
    setNativeTestRefFactory(hostName =>
      hostName === 'ScrollView' ? {measureLayout: nativeMeasureLayout, measureInWindow} : {},
    );
    const renderer = await mount(
      <PrimitiveScrollView
        ref={scrollRef}
        testID={primitiveTestId('sample:scroll-contract')}
        onContentHeightChange={onContentHeightChange}
        onScrollOffsetChange={onScrollOffsetChange}
        onScrollEndDrag={onScrollEndDrag}
        onMomentumScrollEnd={onMomentumScrollEnd}
      >
        <PrimitiveText testID={primitiveTestId('sample:scroll-contract:text')}>内容</PrimitiveText>
      </PrimitiveScrollView>,
    );
    const scrollView = hostNode(renderer, 'ScrollView', 'sample:scroll-contract');
    expect(scrollRef.current).toEqual(
      expect.objectContaining({
        getContentNativeNode: expect.any(Function),
        measureLayout: expect.any(Function),
        measureInWindow: expect.any(Function),
        scrollTo: expect.any(Function),
      }),
    );
    const relativeToNativeNode = {} as never;
    const onLayout = vi.fn();
    const onFail = vi.fn();
    scrollRef.current!.measureLayout(relativeToNativeNode, onLayout, onFail);
    expect(nativeMeasureLayout).toHaveBeenCalledWith(relativeToNativeNode, onLayout, onFail);
    const onScroll = scrollView.props.onScroll as (event: {
      readonly nativeEvent: {readonly contentOffset: {readonly y: number}};
    }) => void;
    onScroll({nativeEvent: {contentOffset: {y: 42}}});
    expect(onScrollOffsetChange).toHaveBeenCalledWith(42);
    const onScrollEndDragHandler = scrollView.props.onScrollEndDrag as (event: {
      readonly nativeEvent: {
        readonly contentOffset: {readonly y: number};
        readonly velocity: {readonly y: number};
      };
    }) => void;
    onScrollEndDragHandler({nativeEvent: {contentOffset: {y: 40}, velocity: {y: 0}}});
    expect(onScrollEndDrag).toHaveBeenCalledWith(40, 0);
    const onMomentumScrollEndHandler = scrollView.props.onMomentumScrollEnd as (event: {
      readonly nativeEvent: {readonly contentOffset: {readonly y: number}};
    }) => void;
    onMomentumScrollEndHandler({nativeEvent: {contentOffset: {y: 41}}});
    expect(onMomentumScrollEnd).toHaveBeenCalledWith(41);
    expect(scrollView.props.onContentSizeChange).toEqual(expect.any(Function));
    const onContentSizeChange = scrollView.props.onContentSizeChange as (width: number, height: number) => void;
    await act(async () => {
      onContentSizeChange(280, 960);
    });
    expect(onContentHeightChange).toHaveBeenCalledWith(960);
    await act(async () => {
      await renderer.unmount();
    });
  });

  it('rejects an empty addressability key', async () => {
    expect(() => primitiveTestId(' ')).toThrow('testID');
  });

  it('keeps text accessibility roles within feedback semantics', async () => {
    const renderer = await mount(
      <PrimitiveContainer testID={primitiveTestId('sample:role-root')}>
        <PrimitiveText testID={primitiveTestId('sample:alert')} accessibilityRole="alert">
          提示
        </PrimitiveText>
        <PrimitiveText testID={primitiveTestId('sample:status')} accessibilityRole="status">
          状态
        </PrimitiveText>
      </PrimitiveContainer>,
    );

    const textByTestID = (testID: string) => hostNode(renderer, 'Text', testID);
    expect(textByTestID('sample:alert')?.props.role).toBe('alert');
    expect(textByTestID('sample:status')?.props.role).toBe('status');
    await act(async () => {
      await renderer.unmount();
    });
  });

  it('rejects control roles at the PrimitiveText type boundary', async () => {
    const invalidRole = (
      // @ts-expect-error PrimitiveText only accepts feedback roles; controls use dedicated primitives.
      <PrimitiveText testID={primitiveTestId('sample:invalid-role')} accessibilityRole="button">
        错误
      </PrimitiveText>
    );
    void invalidRole;
  });

  it('keeps busy actions inert and exposes semantic interactive state', async () => {
    const onPress = vi.fn();
    const onValueChange = vi.fn();
    const renderer = await mount(
      <PrimitiveContainer testID={primitiveTestId('sample:state-root')}>
        <PrimitiveButton testID={primitiveTestId('sample:busy')} accessibilityLabel="保存" busy onPress={onPress}>
          保存
        </PrimitiveButton>
        <PrimitiveSegmentedControl
          testID={primitiveTestId('sample:segments')}
          accessibilityLabel="诊断分区"
          items={[
            {value: 'one', label: '一'},
            {value: 'two', label: '二'},
          ]}
          selectedValue="one"
          onValueChange={onValueChange}
        />
        <PrimitiveSpinner testID={primitiveTestId('sample:spinner')} accessibilityLabel="加载中" />
        <PrimitiveInlineAlert testID={primitiveTestId('sample:alert')} tone="error">
          失败
        </PrimitiveInlineAlert>
        <PrimitiveEmptyState testID={primitiveTestId('sample:empty')} accessibilityLabel="空列表">
          暂无数据
        </PrimitiveEmptyState>
        <PrimitiveBadge testID={primitiveTestId('sample:badge')} tone="ok">
          可用
        </PrimitiveBadge>
      </PrimitiveContainer>,
    );

    const busy = hostNode(renderer, 'Pressable', 'sample:busy');
    await act(async () => {
      (busy.props.onPress as () => void)();
    });
    expect(onPress).not.toHaveBeenCalled();
    expect(busy.props.accessibilityState).toMatchObject({disabled: true, busy: true});
    expect(hostNodes(renderer, 'Text').some(node => node.props.children === '保存')).toBe(true);

    const second = renderer.getByTestId(derivedPrimitiveTestId('sample:segments', 'item', 'two')!);
    await act(async () => {
      (second.props.onPress as () => void)();
    });
    expect(onValueChange).toHaveBeenCalledWith('two');
    expect(renderer.getByTestId(primitiveTestId('sample:spinner'))).toBeDefined();
    expect(hostNode(renderer, 'View', 'sample:alert').props.accessibilityRole).toBe('alert');
    expect(renderer.getByTestId(primitiveTestId('sample:empty'))).toBeDefined();
    expect(renderer.getByTestId(primitiveTestId('sample:badge'))).toBeDefined();
  });

  it('exposes tab semantics for bounded navigation primitives', async () => {
    const renderer = await mount(
      <PrimitiveGrid testID={primitiveTestId('sample:tablist')} accessibilityLabel="分区" accessibilityRole="tablist">
        <PrimitivePressOption
          testID={primitiveTestId('sample:tab')}
          accessibilityLabel="第一节"
          accessibilityRole="tab"
          selected
        >
          第一节
        </PrimitivePressOption>
      </PrimitiveGrid>,
    );

    const tablist = hostNode(renderer, 'View', 'sample:tablist');
    const tab = hostNode(renderer, 'Pressable', 'sample:tab');
    expect(tablist.props.accessibilityRole).toBe('tablist');
    expect(tablist.props.accessibilityLabel).toBe('分区');
    expect(tab.props.accessibilityRole).toBe('tab');
    expect(tab.props['aria-selected']).toBe(true);
    expect(tab.props.accessibilityState).toMatchObject({selected: true});
    await act(async () => {
      await renderer.unmount();
    });
  });

  it('keeps the admin navigation native Pressable class stable across selection updates', async () => {
    const AdminNavigationHarness = () => {
      const [selected, setSelected] = useState(false);
      return (
        <PrimitivePressOption
          testID={primitiveTestId('sample:admin-navigation-option')}
          accessibilityLabel="运行状态"
          selected={selected}
          variant="admin-nav"
          icon="monitor"
          onPress={() => setSelected(true)}
        >
          运行状态
        </PrimitivePressOption>
      );
    };
    const renderer = await mount(<AdminNavigationHarness />);
    const initialPressable = hostNode(renderer, 'Pressable', 'sample:admin-navigation-option');
    const initialClassName = initialPressable.props.className;
    expect(initialClassName).toBe(baseTokens.adminNavItem);

    await act(async () => {
      (initialPressable.props.onPress as () => void)();
    });

    const selectedPressable = hostNode(renderer, 'Pressable', 'sample:admin-navigation-option');
    expect(selectedPressable.props.className).toBe(initialClassName);
    expect(selectedPressable.props.accessibilityState).toMatchObject({selected: true});
    const selectedSurface = renderer.getByTestId(
      derivedPrimitiveTestId('sample:admin-navigation-option', 'selected-surface')!,
    );
    expect(selectedSurface.props.className).toBe(baseTokens.adminNavItemSelected);
    await act(async () => {
      await renderer.unmount();
    });
  });

  it('renders a non-empty SVG path from the primitives icon set', async () => {
    setPlatformOSForTests('web');
    try {
      expect(Platform.OS).toBe('web');
      const renderer = await mount(
        <RnrSvgIcon testID={primitiveTestId('sample:icon')} accessibilityLabel="信息" path={primitiveIconPaths.info} />,
      );
      const svg = renderer.getByTestId(primitiveTestId('sample:icon'));
      const path = getRenderedNode(renderer, node => node.type === Path);
      expect(svg.props.accessibilityLabel).toBe('信息');
      expect(svg.props.accessible).toBeUndefined();
      expect(path.props.d).toBe(primitiveIconPaths.info);
      expect(String(path.props.d).length).toBeGreaterThan(0);
      await act(async () => {
        await renderer.unmount();
      });
    } finally {
      setPlatformOSForTests('android');
    }
  });

  it('keeps dropdown, disclosure, ratio, and surface-map behavior controlled by callers', async () => {
    const onExpandedChange = vi.fn();
    const Probe = () => {
      const [open, setOpen] = useState(false);
      const [value, setValue] = useState('runtime');
      return (
        <>
          <PrimitiveDropdownSelect
            testID={primitiveTestId('sample:dropdown')}
            accessibilityLabel="选择页面"
            options={[
              {value: 'runtime', label: '运行状态'},
              {value: 'topology', label: '双机拓扑'},
            ]}
            value={value}
            open={open}
            onOpenChange={setOpen}
            onValueChange={setValue}
          />
          <PrimitiveDisclosure
            testID={primitiveTestId('sample:disclosure')}
            accessibilityLabel="展开端口"
            label="连接"
            summary="2 项"
            summaryTestID={primitiveTestId('sample:disclosure:count')}
            status="已声明"
            statusTestID={primitiveTestId('sample:disclosure:status')}
            triggerTestID={primitiveTestId('sample:disclosure:expand')}
            expanded={false}
            onExpandedChange={onExpandedChange}
          >
            <PrimitiveText testID={primitiveTestId('sample:disclosure:body')}>详情</PrimitiveText>
          </PrimitiveDisclosure>
          <PrimitiveRatioBar
            testID={primitiveTestId('sample:ratio')}
            accessibilityLabel="端口比例"
            total={4}
            segments={[
              {key: 'available', label: '可用', value: 2, tone: 'ok'},
              {key: 'unavailable', label: '不可用', value: 1, tone: 'warn'},
              {key: 'undeclared', label: '未声明', value: 1, tone: 'neutral'},
            ]}
          />
          <PrimitiveSurfaceMap
            testID={primitiveTestId('sample:surface-map')}
            accessibilityLabel="显示屏"
            direction="row"
            surfaces={[
              {
                key: 'PRIMARY',
                label: '当前屏',
                roleLabel: '主屏',
                current: true,
                present: true,
                aspectRatio: 2,
                insideLabels: ['已就绪'],
                outsideLabels: ['备用'],
                logicWidthLabel: '逻辑长：1920',
                logicHeightLabel: '逻辑高：960',
                physicalWidthLabel: '物理长：2560',
                physicalHeightLabel: '物理高：1440',
                statusLabel: '已就绪',
                statusTone: 'ok',
              },
              {
                key: 'SECONDARY',
                label: '副屏',
                roleLabel: '副屏',
                current: false,
                present: true,
                aspectRatio: 1.5,
                insideLabels: ['设备显示区域：1280×720', '已就绪'],
                outsideLabels: [],
                logicWidthLabel: '逻辑分辨率宽：1280',
                logicHeightLabel: '逻辑分辨率高：800',
                physicalWidthLabel: '物理长：1920',
                physicalHeightLabel: '物理高：1080',
              },
            ]}
          />
        </>
      );
    };
    const renderer = await mount(<Probe />);
    const trigger = renderer.getByTestId(derivedPrimitiveTestId('sample:dropdown', 'trigger')!);
    expect(trigger.props.accessibilityState).toMatchObject({expanded: false});
    await act(async () => {
      (trigger.props.onPress as () => void)();
    });
    expect(renderer.getByTestId(derivedPrimitiveTestId('sample:dropdown', 'menu')!)).toBeDefined();
    await act(async () => {
      (
        renderer.getByTestId(derivedPrimitiveTestId('sample:dropdown', 'option', 'topology')!).props
          .onPress as () => void
      )();
    });
    expect(
      renderer.getByTestId(derivedPrimitiveTestId('sample:dropdown', 'trigger')!).props.accessibilityState,
    ).toMatchObject({expanded: false});
    expect(renderer.queryAllByTestId(derivedPrimitiveTestId('sample:disclosure', 'content')!)).toHaveLength(0);
    expect(renderer.getByTestId(primitiveTestId('sample:disclosure:expand'))).toBeDefined();
    expect(renderer.getByTestId(primitiveTestId('sample:disclosure:status'))).toBeDefined();
    expect(renderer.getByTestId(primitiveTestId('sample:disclosure:count'))).toBeDefined();
    await act(async () => {
      (renderer.getByTestId(primitiveTestId('sample:disclosure:expand')).props.onPress as () => void)();
    });
    expect(onExpandedChange).toHaveBeenCalledWith(true);
    expect(
      hostNodes(renderer, 'View').filter(
        node => node.props.testID === derivedPrimitiveTestId('sample:ratio', 'segment', 'available'),
      ),
    ).toHaveLength(1);
    expect(
      renderer.getByTestId(derivedPrimitiveTestId('sample:ratio', 'segment', 'undeclared')!).props.className,
    ).toContain(baseTokens.adminRatioSegmentUndeclared);
    expect(
      renderer.getByTestId(derivedPrimitiveTestId('sample:surface-map', 'surface', 'PRIMARY')!).props.style,
    ).toEqual(expect.objectContaining({aspectRatio: 2, width: '100%', minWidth: 176, maxWidth: 320, height: 160}));
    expect(
      renderer.getByTestId(derivedPrimitiveTestId('sample:surface-map', 'surface-logic-width', 'PRIMARY')!).props
        .className,
    ).toBe(baseTokens.adminSurfaceMapLogicWidth);
    expect(
      renderer.getByTestId(derivedPrimitiveTestId('sample:surface-map', 'surface-logic-height', 'PRIMARY')!).props
        .className,
    ).toBe(baseTokens.adminSurfaceMapLogicHeight);
    expect(
      renderer.getByTestId(derivedPrimitiveTestId('sample:surface-map', 'surface-outside', 'PRIMARY:0')!).props
        .className,
    ).toBe(baseTokens.adminSurfaceMapPhysicalWidth);
    expect(
      renderer.getByTestId(derivedPrimitiveTestId('sample:surface-map', 'surface-outside', 'PRIMARY:1')!).props
        .className,
    ).toBe(baseTokens.adminSurfaceMapPhysicalHeight);
    expect(baseTokens.adminSurfaceMapLogicWidth).toContain('left-0 right-0 top-2');
    expect(baseTokens.adminSurfaceMapLogicHeight).toContain('right-2 top-1/2');
    expect(baseTokens.adminSurfaceMapPhysicalWidth).toContain('top-0');
    expect(baseTokens.adminSurfaceMapPhysicalHeight).toContain('left-full top-1/2');
    expect(
      renderer.getByTestId(derivedPrimitiveTestId('sample:surface-map', 'surface-card', 'PRIMARY')!).props
        .accessibilityLabel,
    ).toBeDefined();
    expect(
      renderer.getByTestId(derivedPrimitiveTestId('sample:surface-map', 'surface-inside', 'SECONDARY:0')!).props
        .children,
    ).toBeDefined();
    expect(
      renderer.getByTestId(derivedPrimitiveTestId('sample:surface-map', 'surface', 'SECONDARY')!).props.className,
    ).toContain(baseTokens.adminSurfaceMapRect);
    expect(
      renderer.getByTestId(derivedPrimitiveTestId('sample:surface-map', 'surface-logic-width', 'SECONDARY')!).props
        .children,
    ).toBeDefined();
    expect(
      renderer.getByTestId(derivedPrimitiveTestId('sample:surface-map', 'surface-inside', 'SECONDARY:1')!).props
        .children,
    ).toBeDefined();
  });

  it('renders a visible invalid state when ratio segments do not conserve the total', async () => {
    const renderer = await mount(
      <PrimitiveRatioBar
        testID={primitiveTestId('sample:invalid-ratio')}
        accessibilityLabel="端口比例"
        total={4}
        segments={[{key: 'available', label: '可用', value: 1, tone: 'ok'}]}
      />,
    );
    expect(renderer.getByTestId(derivedPrimitiveTestId('sample:invalid-ratio', 'invalid')!)).toBeDefined();
    expect(
      renderer.queryAllByTestId(derivedPrimitiveTestId('sample:invalid-ratio', 'segment', 'available')!),
    ).toHaveLength(0);
  });

  it('keeps the full list data while bounding mounted rows across scroll transitions', async () => {
    const data = Array.from({length: 100}, (_value, index) => `row-${index}`);
    const renderer = await mount(
      <PrimitiveList
        testID={primitiveTestId('sample:list')}
        data={data}
        rowHeight={10}
        getItemKey={item => item}
        renderItem={item => (
          <PrimitiveText testID={primitiveTestId(`sample:list:content:${item}`)}>{item}</PrimitiveText>
        )}
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
    const list = () =>
      hostNodes(renderer, 'VirtualizedList')
        .map(node => node as unknown as VirtualizedListProbe)
        .find(node => node.props.testID === primitiveTestId('sample:list'))!;
    expect(list().props.getItemCount(data)).toBe(100);
    expect(list().props.className).toBe(baseTokens.list);

    const observeWindow = async (offsetY: number) => {
      await act(async () => {
        (
          list().props.onScroll as (event: {
            readonly nativeEvent: {readonly contentOffset: {readonly y: number}};
          }) => void
        )({
          nativeEvent: {contentOffset: {y: offsetY}},
        });
      });
      const renderItem = list().props.renderItem as (input: {readonly item: string; readonly index: number}) => unknown;
      const rendered = data
        .map((item, index) => renderItem({item, index}))
        .filter(node => {
          const testID = (node as {readonly props?: Readonly<Record<string, unknown>>} | null)?.props?.testID;
          return typeof testID === 'string' && testID.startsWith('test.ui.base.primitives:derived:row:');
        }) as Array<{
        readonly props?: Readonly<Record<string, unknown>>;
      }>;
      expect(rendered.length).toBeLessThanOrEqual(24);
      return rendered;
    };

    const head = (await observeWindow(0)) as Array<{readonly props?: Readonly<Record<string, unknown>>}>;
    expect(head.some(node => node.props?.testID === derivedPrimitiveTestId('sample:list', 'row', 'row-0'))).toBe(true);
    for (const offsetY of [10, 80, 160, 320, 480, 640, 800, 900]) await observeWindow(offsetY);
    const tail = (await observeWindow(900)) as Array<{readonly props?: Readonly<Record<string, unknown>>}>;
    expect(tail.some(node => node.props?.testID === derivedPrimitiveTestId('sample:list', 'row', 'row-99'))).toBe(true);
    await act(async () => {
      await renderer.unmount();
    });
  });
});
