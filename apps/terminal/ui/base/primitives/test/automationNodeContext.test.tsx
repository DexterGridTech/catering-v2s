import {primitiveTestId} from './testIds';
import {
  AutomationNodeProvider,
  AutomationSurfaceProvider,
  useAutomationNode,
  type AutomationNodeSink,
} from '../src/index';
import {render} from '@testing-library/react-native';
import {
  RnrActivityIndicator,
  RnrImage,
  RnrPressable,
  RnrTextInput,
  RnrVirtualizedList,
} from '../src/foundations/nativeSlots';
import {describe, expect, it, vi} from 'vitest';

describe('automation node registration seam', () => {
  it('registers the mounted native node with its surface and reports layout and real press coordinates', async () => {
    const sink: AutomationNodeSink = {
      register: vi.fn(),
      update: vi.fn(),
      unregister: vi.fn(),
      invalidateSurface: vi.fn(),
      interaction: vi.fn(),
    };
    const scope = Object.freeze({surface: 'SECONDARY' as const, displayIndex: 1, layoutRevision: 4});
    const result = await render(
      <AutomationNodeProvider sink={sink}>
        <AutomationSurfaceProvider scope={scope}>
          <RnrPressable
            testID={primitiveTestId('automation:probe')}
            accessibilityRole="button"
            accessibilityLabel="Probe"
            onPressIn={() => undefined}
          />
        </AutomationSurfaceProvider>
      </AutomationNodeProvider>,
    );
    const view = result.getByTestId(primitiveTestId('automation:probe'));
    const node = vi.mocked(sink.register).mock.calls[0]?.[0];
    expect(node).toMatchObject({testID: primitiveTestId('automation:probe'), role: 'button', surface: scope});
    expect(node?.hostNode).toBeDefined();

    (view.props.onLayout as (event: unknown) => void)({nativeEvent: {layout: {x: 3, y: 5, width: 80, height: 40}}});
    (view.props.onPressIn as (event: unknown) => void)({
      nativeEvent: {pageX: 10, pageY: 20, locationX: 7, locationY: 15},
    });
    expect(sink.update).toHaveBeenCalledWith(node?.nodeInstanceId, {layout: {x: 3, y: 5, width: 80, height: 40}});
    expect(sink.interaction).toHaveBeenCalledWith(node?.nodeInstanceId, {
      phase: 'press-in',
      pageX: 10,
      pageY: 20,
      locationX: 7,
      locationY: 15,
    });

    await result.unmount();
    expect(sink.unregister).toHaveBeenCalledWith(node?.nodeInstanceId);
  });

  it('does not register non-interactive primitives when no automation lookup is needed', async () => {
    const sink: AutomationNodeSink = {
      register: vi.fn(),
      update: vi.fn(),
      unregister: vi.fn(),
      invalidateSurface: vi.fn(),
      interaction: vi.fn(),
    };
    const rendered = await render(
      <AutomationNodeProvider sink={sink}>
        <RnrActivityIndicator accessibilityLabel="Loading" />
        <RnrImage accessibilityLabel="Brand" source={{uri: 'memory://brand'}} />
        <RnrVirtualizedList
          data={[]}
          getItem={(items, index) => items[index]}
          getItemCount={items => items.length}
          renderItem={() => null}
        />
      </AutomationNodeProvider>,
    );

    expect(sink.register).not.toHaveBeenCalled();
    await rendered.unmount();
  });

  it('keeps the node instance identity when its host ref is detached and reattached', async () => {
    const sink: AutomationNodeSink = {
      register: vi.fn(),
      update: vi.fn(),
      unregister: vi.fn(),
      invalidateSurface: vi.fn(),
      interaction: vi.fn(),
    };
    const scope = Object.freeze({surface: 'PRIMARY' as const, displayIndex: 0, layoutRevision: 0});
    let attachHostNode: ((hostNode: unknown | null) => void) | undefined;
    const Probe = ({label}: Readonly<{label: string}>) => {
      attachHostNode = useAutomationNode({
        testID: primitiveTestId('automation:stable'),
        role: 'button',
        label,
      })?.attachHostNode;
      return null;
    };
    const rendered = await render(
      <AutomationNodeProvider sink={sink}>
        <AutomationSurfaceProvider scope={scope}>
          <Probe label="before" />
        </AutomationSurfaceProvider>
      </AutomationNodeProvider>,
    );
    const firstAttach = attachHostNode;
    firstAttach?.({measureInWindow: () => undefined});
    const firstId = vi.mocked(sink.register).mock.calls[0]?.[0].nodeInstanceId;
    firstAttach?.(null);
    firstAttach?.({measureInWindow: () => undefined});

    expect(vi.mocked(sink.register).mock.calls.at(-1)?.[0].nodeInstanceId).toBe(firstId);
    await rendered.unmount();
  });

  it('exposes the existing press and text-change callbacks as semantic actions', async () => {
    const sink: AutomationNodeSink = {
      register: vi.fn(),
      update: vi.fn(),
      unregister: vi.fn(),
      invalidateSurface: vi.fn(),
      interaction: vi.fn(),
    };
    const onPress = vi.fn();
    const onChangeText = vi.fn();
    const rendered = await render(
      <AutomationNodeProvider sink={sink}>
        <RnrPressable testID={primitiveTestId('automation:press')} onPress={onPress} />
        <RnrTextInput testID={primitiveTestId('automation:text')} value="before" onChangeText={onChangeText} />
      </AutomationNodeProvider>,
    );

    const pressNode = vi
      .mocked(sink.register)
      .mock.calls.find(([node]) => node.testID === primitiveTestId('automation:press'))?.[0];
    const textNode = vi
      .mocked(sink.register)
      .mock.calls.find(([node]) => node.testID === primitiveTestId('automation:text'))?.[0];
    pressNode?.semanticActions?.press?.();
    textNode?.semanticActions?.changeText?.('after');

    expect(onPress).toHaveBeenCalledOnce();
    expect(onChangeText).toHaveBeenCalledExactlyOnceWith('after');
    await rendered.unmount();
  });
});
