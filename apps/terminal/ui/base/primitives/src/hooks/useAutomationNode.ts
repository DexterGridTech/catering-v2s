import {useCallback, useContext, useRef} from 'react';
import type {GestureResponderEvent, LayoutChangeEvent} from 'react-native';
import {
  AutomationNodeSinkContext,
  AutomationSurfaceContext,
  type AutomationNodeDescription,
} from '../contexts/AutomationNodeContext';
import type {TestId} from '../foundations/testId';

export type UseAutomationNodeInput = Readonly<{
  readonly testID?: TestId;
  readonly role: string;
  readonly label?: string | null;
  readonly accessibilityState?: Readonly<Record<string, boolean | undefined>>;
  readonly value?: string | number | boolean | null;
  readonly semanticActions?: AutomationNodeDescription['semanticActions'];
}>;

let nextNodeId = 0;

export const useAutomationNode = (input: UseAutomationNodeInput) => {
  const sink = useContext(AutomationNodeSinkContext);
  const surface = useContext(AutomationSurfaceContext);
  const nodeInstanceIdRef = useRef<string | null>(null);
  const attachHostNode = useCallback(
    (hostNode: unknown | null): void => {
      if (sink === null || input.testID === undefined) return;
      if (hostNode === null) {
        const nodeInstanceId = nodeInstanceIdRef.current;
        if (nodeInstanceId !== null) sink.unregister(nodeInstanceId);
        return;
      }
      const nodeInstanceId = nodeInstanceIdRef.current ?? `automation-node-${++nextNodeId}`;
      nodeInstanceIdRef.current = nodeInstanceId;
      sink.register({
        nodeInstanceId,
        testID: input.testID,
        role: input.role,
        label: input.label ?? null,
        accessibilityState: input.accessibilityState ?? Object.freeze({}),
        value: input.value ?? null,
        surface,
        hostNode,
        semanticActions: input.semanticActions,
      });
    },
    [
      input.accessibilityState,
      input.label,
      input.role,
      input.semanticActions,
      input.testID,
      input.value,
      nodeInstanceIdRef,
      sink,
      surface,
    ],
  );
  const onLayout = useCallback(
    (event: LayoutChangeEvent): void => {
      if (sink === null || input.testID === undefined) return;
      const nodeInstanceId = nodeInstanceIdRef.current;
      if (nodeInstanceId === null) return;
      const {x, y, width, height} = event.nativeEvent.layout;
      sink.update(nodeInstanceId, {layout: Object.freeze({x, y, width, height})});
    },
    [input.testID, nodeInstanceIdRef, sink],
  );
  const onPressIn = useCallback(
    (event: GestureResponderEvent): void => {
      if (sink === null || input.testID === undefined) return;
      const nodeInstanceId = nodeInstanceIdRef.current;
      if (nodeInstanceId === null) return;
      const {pageX, pageY, locationX, locationY} = event.nativeEvent;
      sink.interaction(nodeInstanceId, {phase: 'press-in', pageX, pageY, locationX, locationY});
    },
    [input.testID, nodeInstanceIdRef, sink],
  );
  const onPressOut = useCallback(
    (event: GestureResponderEvent): void => {
      if (sink === null || input.testID === undefined) return;
      const nodeInstanceId = nodeInstanceIdRef.current;
      if (nodeInstanceId === null) return;
      const {pageX, pageY, locationX, locationY} = event.nativeEvent;
      sink.interaction(nodeInstanceId, {phase: 'press-out', pageX, pageY, locationX, locationY});
    },
    [input.testID, nodeInstanceIdRef, sink],
  );
  const onScroll = useCallback((): void => {
    if (sink === null || input.testID === undefined) return;
    sink.invalidateSurface(surface);
  }, [input.testID, sink, surface]);
  if (sink === null || input.testID === undefined) return null;
  return Object.freeze({attachHostNode, onLayout, onPressIn, onPressOut, onScroll});
};
