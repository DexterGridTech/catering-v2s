import {useCallback, useLayoutEffect, useMemo, useRef, useState} from 'react';
import {Animated, Easing, Platform, StyleSheet, View, type GestureResponderEvent, type LayoutChangeEvent} from 'react-native';
import {PrimitiveStatus, type PrimitiveNativeNode} from '@catering-v2s/ui-base-primitives';
import {SurfacePresentationOffsetProvider} from '@catering-v2s/ui-base-render';
import {useInputController, useInputKeyboardState, useInputPendingFocusCommit} from '../contexts/context';
import {InputSurfaceGeometryContext, type InputSurfaceGeometry} from '../contexts/InputSurfaceGeometryContext';
import {calculatePresentationOffsetY, type LayoutRect} from '../foundations/scrollIntoView';
import {InputProvider} from './InputProvider';
import {InputKeyboard, type InputKeyboardSnapshot} from './InputKeyboard';
import {handoffTrackOf, type KeyboardHandoffTrack} from '../foundations/keyboardPresentation';
import type {KeyboardCapacity, LocalFrameMetrics} from '../foundations/keyboardHeight';
import type {InputSurfaceFrameProps} from '../types/types';

const unsupportedMessageOf = (capacity: KeyboardCapacity): string => {
  switch (capacity) {
    case 'unsupported-width':
      return '当前输入区域宽度不足，请将窗口调整到至少 360 个逻辑单位后重试';
    case 'unsupported-horizontal':
      return '当前输入区域无法容纳按键，请将窗口调整到至少 360 个逻辑单位后重试';
    case 'unsupported-height':
      return '当前输入区域高度不足，请将窗口调整到至少 360 个逻辑单位宽度并增加高度后重试';
    default:
      return '当前窗口尺寸不足，请将窗口调整到至少 360 个逻辑单位后重试';
  }
};

export const InputSurfaceFrame = ({onMeasuredFrame, children}: InputSurfaceFrameProps) => {
  const [frameMetrics, setFrameMetrics] = useState<LocalFrameMetrics | null>(null);
  const lastMeasuredFrame = useRef<LocalFrameMetrics | null>(null);
  const surfaceRootRef = useRef<PrimitiveNativeNode | null>(null);
  const setSurfaceRoot = useCallback((node: unknown) => {
    surfaceRootRef.current = node as PrimitiveNativeNode | null;
  }, []);
  const handleSurfaceLayout = useCallback((event: LayoutChangeEvent) => {
    const {width, height} = event.nativeEvent.layout;
    const ready = Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0;
    const nextFrameMetrics: LocalFrameMetrics = {
      width,
      height,
      ready,
      orientation: width >= height ? 'landscape' : 'portrait',
    };
    const previous = lastMeasuredFrame.current;
    const changed = previous === null
      || previous.width !== nextFrameMetrics.width
      || previous.height !== nextFrameMetrics.height
      || previous.ready !== nextFrameMetrics.ready
      || previous.orientation !== nextFrameMetrics.orientation;
    if (!changed) return;
    lastMeasuredFrame.current = nextFrameMetrics;
    setFrameMetrics(nextFrameMetrics);
    onMeasuredFrame?.(nextFrameMetrics);
  }, [onMeasuredFrame]);

  return (
    <View ref={setSurfaceRoot} testID="ui.base.input:surface-frame" style={styles.frame} onLayout={handleSurfaceLayout}>
      <InputProvider frameMetrics={frameMetrics}>
        <InputSurfaceFrameContents frameMetrics={frameMetrics} surfaceRoot={surfaceRootRef.current}>
          {children}
        </InputSurfaceFrameContents>
      </InputProvider>
    </View>
  );
};

type FrozenKeyboardLayer = Readonly<{
  readonly snapshot: InputKeyboardSnapshot;
  readonly translateY: number;
}>;

type KeyboardPresentation =
  | Readonly<{readonly phase: 'idle'}>
  | Readonly<{
      readonly phase: 'measure';
      readonly serial: number;
      readonly outgoing: readonly FrozenKeyboardLayer[];
      readonly incoming: InputKeyboardSnapshot;
      readonly kind: 'enter' | 'handoff';
      readonly startOffset: number;
      readonly targetOffset: number;
    }>
  | Readonly<{
      readonly phase: 'enter';
      readonly serial: number;
      readonly incoming: InputKeyboardSnapshot;
      readonly startOffset: number;
      readonly targetOffset: number;
      readonly settled: boolean;
    }>
  | Readonly<{readonly phase: 'display'; readonly active: InputKeyboardSnapshot}>
  | Readonly<{
      readonly phase: 'handoff';
      readonly serial: number;
      readonly outgoing: readonly FrozenKeyboardLayer[];
      readonly incoming: InputKeyboardSnapshot;
      readonly track: KeyboardHandoffTrack;
      readonly startOffset: number;
      readonly targetOffset: number;
      readonly settled: boolean;
    }>
  | Readonly<{
      readonly phase: 'exit';
      readonly serial: number;
      readonly outgoing: readonly FrozenKeyboardLayer[];
      readonly obstructionHeight: number;
      readonly startOffset: number;
    }>
  | Readonly<{
      readonly phase: 'reposition';
      readonly serial: number;
      readonly active: InputKeyboardSnapshot;
      readonly startOffset: number;
      readonly targetOffset: number;
    }>;

type FocusTarget = Readonly<{
  readonly fieldId: string;
  readonly rect: LayoutRect;
  readonly offset: number;
  readonly revision: number;
}>;

type ScheduledScrollStart = Readonly<{
  readonly fieldId: string;
  readonly start: () => void;
}>;

type PresentationSample = Readonly<{
  readonly layers: readonly FrozenKeyboardLayer[];
  readonly offset: number;
}>;

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(maximum, Math.max(minimum, value));

const interpolateNumber = (progress: number, inputRange: readonly number[], outputRange: readonly number[]): number => {
  const segment = inputRange.findIndex((point, index) => index > 0 && point >= progress);
  if (segment < 0) return outputRange[outputRange.length - 1]!;
  const start = segment - 1;
  const span = inputRange[segment]! - inputRange[start]!;
  if (span <= 0) return outputRange[segment]!;
  const ratio = clamp((progress - inputRange[start]!) / span, 0, 1);
  return outputRange[start]! + (outputRange[segment]! - outputRange[start]!) * ratio;
};

const maxVisibleHeight = (layers: readonly FrozenKeyboardLayer[]): number =>
  Math.max(0, ...layers.map(layer => layer.snapshot.height - layer.translateY));

const samplePresentation = (
  presentation: KeyboardPresentation,
  progress: number,
  stableOffset: number,
): PresentationSample => {
  switch (presentation.phase) {
    case 'idle':
      return {layers: [], offset: stableOffset};
    case 'measure':
      return {layers: presentation.outgoing, offset: presentation.startOffset};
    case 'enter':
      return {
        layers: [{snapshot: presentation.incoming, translateY: presentation.incoming.height * (1 - progress)}],
        offset: presentation.startOffset + (presentation.targetOffset - presentation.startOffset) * progress,
      };
    case 'display':
      return {layers: [{snapshot: presentation.active, translateY: 0}], offset: stableOffset};
    case 'handoff':
      return {
        layers: [
          ...presentation.outgoing.map(layer => ({
            snapshot: layer.snapshot,
            translateY: layer.translateY + interpolateNumber(progress, presentation.track.inputRange, presentation.track.outgoingTranslateY),
          })),
          {
            snapshot: presentation.incoming,
            translateY: interpolateNumber(progress, presentation.track.inputRange, presentation.track.incomingTranslateY),
          },
        ],
        offset: interpolateNumber(progress, presentation.track.inputRange, presentation.track.offset),
      };
    case 'exit':
      return {
        layers: presentation.outgoing.map(layer => ({
          snapshot: layer.snapshot,
          translateY: layer.translateY + presentation.obstructionHeight * progress,
        })),
        offset: presentation.startOffset * (1 - progress),
      };
    case 'reposition':
      return {
        layers: [{snapshot: presentation.active, translateY: 0}],
        offset: presentation.startOffset + (presentation.targetOffset - presentation.startOffset) * progress,
      };
  }
};

const animatedInterpolation = (
  progress: Animated.Value,
  inputRange: readonly number[],
  outputRange: readonly number[],
): Animated.AnimatedInterpolation<number> => progress.interpolate({
  inputRange: [...inputRange],
  outputRange: [...outputRange],
  extrapolate: 'clamp',
});

const keyboardHeightKey = (layout: InputKeyboardSnapshot['layout'], width: number, expectedHeight: number): string =>
  `${layout}:${width}:${expectedHeight}`;

const webEventTargetOf = (event: unknown): unknown => {
  if (event === null || typeof event !== 'object') return null;
  const directTarget = (event as {readonly target?: unknown}).target;
  if (directTarget !== undefined && directTarget !== null) return directTarget;
  const nativeEvent = (event as {readonly nativeEvent?: unknown}).nativeEvent;
  if (nativeEvent === null || typeof nativeEvent !== 'object') return null;
  return (nativeEvent as {readonly target?: unknown}).target ?? null;
};

const isWebInputTarget = (event: unknown): boolean => {
  const target = webEventTargetOf(event);
  if (target === null || typeof target !== 'object') return false;
  const closest = (target as {readonly closest?: unknown}).closest;
  return typeof closest === 'function'
    && (closest as (selector: string) => unknown).call(target, 'input,textarea') !== null;
};

const InputSurfaceFrameContents = ({
  frameMetrics,
  surfaceRoot,
  children,
}: Readonly<{
  readonly frameMetrics: LocalFrameMetrics | null;
  readonly surfaceRoot: PrimitiveNativeNode | null;
  readonly children?: InputSurfaceFrameProps['children'];
}>) => {
  const state = useInputKeyboardState();
  const controller = useInputController();
  const commitPendingFocus = useInputPendingFocusCommit();
  const progress = useRef(new Animated.Value(0)).current;
  const animationRef = useRef<ReturnType<typeof Animated.timing> | null>(null);
  const presentationSerialRef = useRef(0);
  const presentationRef = useRef<KeyboardPresentation>({phase: 'idle'});
  const [presentation, setPresentation] = useState<KeyboardPresentation>({phase: 'idle'});
  const [presentationOffsetY, setPresentationOffsetY] = useState(0);
  const presentationOffsetRef = useRef(0);
  const focusTargetRef = useRef<FocusTarget | null>(null);
  const [focusTarget, setFocusTarget] = useState<FocusTarget | null>(null);
  const focusReadyFieldRef = useRef<string | null>(null);
  const measuredHeightsRef = useRef(new Map<string, number>());
  const measuredGeometryKeyRef = useRef<string | null>(null);
  const [measuredHeightRevision, setMeasuredHeightRevision] = useState(0);
  const [focusVisibilityFailure, setFocusVisibilityFailure] = useState<Readonly<{readonly fieldId: string; readonly reason: string}> | null>(null);
  const [scheduledScrollRevision, setScheduledScrollRevision] = useState(0);
  const scheduledScrollStartRef = useRef<ScheduledScrollStart | null>(null);
  const setPresentationState = useCallback((next: KeyboardPresentation) => {
    presentationRef.current = next;
    setPresentation(next);
  }, []);
  const assignPresentationOffset = useCallback((offset: number) => {
    presentationOffsetRef.current = offset;
    setPresentationOffsetY(previous => Math.abs(previous - offset) <= 0.001 ? previous : offset);
  }, []);
  const nextPresentationSerial = useCallback((): number => {
    presentationSerialRef.current += 1;
    return presentationSerialRef.current;
  }, []);
  const scheduleScrollAtPresentationStart = useCallback((fieldId: string, start: () => void) => {
    scheduledScrollStartRef.current = {fieldId, start};
    setScheduledScrollRevision(value => value + 1);
  }, []);
  const cancelScheduledScroll = useCallback((fieldId: string) => {
    if (scheduledScrollStartRef.current?.fieldId !== fieldId) return;
    scheduledScrollStartRef.current = null;
    setScheduledScrollRevision(value => value + 1);
  }, []);
  const startScheduledScrollFor = useCallback((fieldId: string) => {
    const scheduled = scheduledScrollStartRef.current;
    if (scheduled === null) return;
    scheduledScrollStartRef.current = null;
    if (scheduled.fieldId === fieldId) scheduled.start();
  }, []);
  const setFocusTargetState = useCallback((fieldId: string, rect: LayoutRect, offset: number) => {
    const previous = focusTargetRef.current;
    const unchanged = previous?.fieldId === fieldId
      && Math.abs(previous.offset - offset) <= 0.5
      && Math.abs(previous.rect.x - rect.x) <= 0.5
      && Math.abs(previous.rect.y - rect.y) <= 0.5
      && Math.abs(previous.rect.width - rect.width) <= 0.5
      && Math.abs(previous.rect.height - rect.height) <= 0.5;
    if (unchanged) return;
    focusReadyFieldRef.current = null;
    const next = {fieldId, rect, offset, revision: (previous?.revision ?? 0) + 1};
    focusTargetRef.current = next;
    setFocusTarget(next);
  }, []);
  const pendingFieldId = state.blockedCapacity === null ? state.blockedFieldId : null;
  const presentationFieldId = state.owner === 'virtual' && state.visible ? state.activeFieldId : pendingFieldId;
  const keyboardHeightKeyValue = keyboardHeightKey(state.layout, state.frameWidth, state.height);
  const measuredKeyboardHeight = measuredHeightsRef.current.get(keyboardHeightKeyValue);
  const keyboardHeight = measuredKeyboardHeight ?? state.height;
  const desiredSnapshot = useMemo<InputKeyboardSnapshot | null>(() => {
    if (presentationFieldId === null || keyboardHeight <= 0 || state.frameWidth <= 0) return null;
    const isPending = pendingFieldId === presentationFieldId && state.owner !== 'virtual';
    return {
      fieldId: presentationFieldId,
      layout: state.layout,
      height: keyboardHeight,
      frameWidth: state.frameWidth,
      shift: isPending ? false : state.shift,
      hasNextField: state.hasNextField,
    };
  }, [keyboardHeight, pendingFieldId, presentationFieldId, state.frameWidth, state.hasNextField, state.layout, state.owner, state.shift]);
  const desiredSignature = desiredSnapshot === null
    ? null
    : `${desiredSnapshot.fieldId}|${desiredSnapshot.layout}|${desiredSnapshot.frameWidth}|${desiredSnapshot.height}|${desiredSnapshot.shift}|${desiredSnapshot.hasNextField}`;
  const targetOffsetFor = useCallback((fieldId: string, fallback: number): number =>
    focusTargetRef.current?.fieldId === fieldId ? focusTargetRef.current.offset : fallback,
  []);
  const freezeVisibleLayers = useCallback((current: KeyboardPresentation, value: number): PresentationSample =>
    samplePresentation(current, clamp(value, 0, 1), presentationOffsetRef.current),
  []);
  const beginMeasure = useCallback((incoming: InputKeyboardSnapshot, outgoing: readonly FrozenKeyboardLayer[]) => {
    const startOffset = presentationOffsetRef.current;
    setPresentationState({
      phase: 'measure',
      serial: nextPresentationSerial(),
      outgoing,
      incoming,
      kind: outgoing.length === 0 ? 'enter' : 'handoff',
      startOffset,
      targetOffset: targetOffsetFor(incoming.fieldId, startOffset),
    });
  }, [nextPresentationSerial, setPresentationState, targetOffsetFor]);
  const beginExit = useCallback((outgoing: readonly FrozenKeyboardLayer[], startOffset: number) => {
    scheduledScrollStartRef.current = null;
    const obstructionHeight = maxVisibleHeight(outgoing);
    if (obstructionHeight <= 0) {
      assignPresentationOffset(0);
      setPresentationState({phase: 'idle'});
      return;
    }
    setPresentationState({
      phase: 'exit',
      serial: nextPresentationSerial(),
      outgoing,
      obstructionHeight,
      startOffset,
    });
  }, [assignPresentationOffset, nextPresentationSerial, setPresentationState]);
  const retargetPresentation = useCallback((desired: InputKeyboardSnapshot | null) => {
    const current = presentationRef.current;
    if (current.phase === 'measure') {
      if (desired === null) beginExit(current.outgoing, current.startOffset);
      else beginMeasure(desired, current.outgoing);
      return;
    }
    if (current.phase === 'exit' && desired === null) return;
    const freeze = (value: number) => {
      const sampled = freezeVisibleLayers(current, value);
      const visible = sampled.layers.filter(layer => layer.snapshot.height - layer.translateY > 0.001);
      assignPresentationOffset(sampled.offset);
      if (desired === null) beginExit(visible, sampled.offset);
      else beginMeasure(desired, visible);
    };
    const isAnimating = current.phase === 'enter'
      || current.phase === 'handoff'
      || current.phase === 'exit'
      || current.phase === 'reposition';
    if (isAnimating) {
      animationRef.current?.stop();
      animationRef.current = null;
      progress.stopAnimation(value => freeze(value));
      return;
    }
    const sampled = freezeVisibleLayers(current, 1);
    if (desired === null) beginExit(sampled.layers, sampled.offset);
    else beginMeasure(desired, sampled.layers);
  }, [assignPresentationOffset, beginExit, beginMeasure, freezeVisibleLayers, progress]);
  const reportFocusVisibilityFailure = useCallback((fieldId: string, reason: string) => {
    const activeVirtualField = state.owner === 'virtual' && state.activeFieldId === fieldId;
    const pendingField = state.blockedFieldId === fieldId && state.blockedCapacity === null;
    if (!activeVirtualField && !pendingField) return;
    focusReadyFieldRef.current = null;
    setFocusVisibilityFailure({fieldId, reason});
    if (activeVirtualField) controller.blurField(fieldId);
    else {
      controller.dismissActiveField();
      controller.blurField(fieldId);
    }
  }, [controller, state.activeFieldId, state.blockedCapacity, state.blockedFieldId, state.owner]);
  const reportFocusVisibilitySuccess = useCallback((fieldId: string) => {
    focusReadyFieldRef.current = fieldId;
    setFocusVisibilityFailure(previous => previous?.fieldId === fieldId ? null : previous);
    const current = presentationRef.current;
    if ((current.phase === 'enter' || current.phase === 'handoff') && current.settled && current.incoming.fieldId === fieldId) {
      const pending = state.owner === 'none'
        && state.blockedFieldId === fieldId
        && state.blockedCapacity === null;
      const alreadyActive = state.owner === 'virtual' && state.activeFieldId === fieldId;
      if ((pending && commitPendingFocus(fieldId)) || alreadyActive) {
        assignPresentationOffset(current.targetOffset);
        setPresentationState({phase: 'display', active: current.incoming});
      }
    }
  }, [assignPresentationOffset, commitPendingFocus, setPresentationState, state.activeFieldId, state.blockedCapacity, state.blockedFieldId, state.owner]);
  const presentFocusRect = useCallback((fieldId: string, rect: LayoutRect): number => {
    const activeVirtualField = state.owner === 'virtual' && state.visible && state.activeFieldId === fieldId;
    const pendingVirtualField = state.owner === 'none' && state.blockedFieldId === fieldId && state.blockedCapacity === null;
    if (
      frameMetrics?.ready !== true
      || (!activeVirtualField && !pendingVirtualField)
      || keyboardHeight <= 0
    ) return presentationOffsetRef.current;
    const nextOffset = calculatePresentationOffsetY(rect, frameMetrics.height, keyboardHeight);
    setFocusTargetState(fieldId, rect, nextOffset);
    return nextOffset;
  }, [frameMetrics, keyboardHeight, setFocusTargetState, state.activeFieldId, state.blockedCapacity, state.blockedFieldId, state.owner, state.visible]);
  const geometry = useMemo<InputSurfaceGeometry>(() => ({
    surfaceRoot,
    surfaceWidth: frameMetrics?.width ?? 0,
    surfaceHeight: frameMetrics?.height ?? 0,
    keyboardHeight: desiredSnapshot?.height ?? 0,
    presentationOffsetY,
    presentFocusRect,
    scheduleScrollAtPresentationStart,
    cancelScheduledScroll,
    reportFocusVisibilityFailure,
    reportFocusVisibilitySuccess,
  }), [
    frameMetrics?.height,
    frameMetrics?.width,
    desiredSnapshot?.height,
    presentFocusRect,
    presentationOffsetY,
    scheduleScrollAtPresentationStart,
    cancelScheduledScroll,
    reportFocusVisibilityFailure,
    reportFocusVisibilitySuccess,
    surfaceRoot,
  ]);
  const showUnsupportedNotice =
    state.blockedFieldId !== null && state.blockedCapacity !== null && state.blockedCapacity !== 'unmeasured';
  const touchStartRef = useRef<Readonly<{readonly pageX: number; readonly pageY: number}> | null>(null);

  const rememberSurfaceTouchStart = useCallback((event: GestureResponderEvent) => {
    const {pageX, pageY} = event.nativeEvent;
    touchStartRef.current = Number.isFinite(pageX) && Number.isFinite(pageY) ? {pageX, pageY} : null;
  }, []);

  const dismissFromSurfaceTouchEnd = useCallback((event: GestureResponderEvent) => {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    const {pageX, pageY} = event.nativeEvent;
    const distance = start === null || !Number.isFinite(pageX) || !Number.isFinite(pageY)
      ? null
      : Math.hypot(pageX - start.pageX, pageY - start.pageY);
    const shouldDismiss = distance !== null && distance <= 8;
    if (shouldDismiss) controller.dismissActiveField();
  }, [controller]);

  const dismissFromSurfaceClick = useCallback((event: unknown) => {
    if (isWebInputTarget(event)) return;
    if (state.activeFieldId === null && state.blockedFieldId !== null && state.blockedCapacity === null) {
      return;
    }
    controller.dismissActiveField();
  }, [controller, state.activeFieldId, state.blockedCapacity, state.blockedFieldId]);
  const finishPendingPresentation = useCallback((incoming: InputKeyboardSnapshot, targetOffset: number): boolean => {
    const pending = state.owner === 'none'
      && state.blockedFieldId === incoming.fieldId
      && state.blockedCapacity === null;
    const alreadyActive = state.owner === 'virtual' && state.activeFieldId === incoming.fieldId;
    if (!pending && !alreadyActive) return false;
    if (pending && focusReadyFieldRef.current !== incoming.fieldId) return false;
    if (pending && !commitPendingFocus(incoming.fieldId)) return false;
    assignPresentationOffset(targetOffset);
    setPresentationState({phase: 'display', active: incoming});
    return true;
  }, [assignPresentationOffset, commitPendingFocus, setPresentationState, state.activeFieldId, state.blockedCapacity, state.blockedFieldId, state.owner]);
  const onKeyboardLayout = useCallback((snapshot: InputKeyboardSnapshot) => (event: LayoutChangeEvent) => {
    const {height} = event.nativeEvent.layout;
    if (!Number.isFinite(height) || height <= 0) return;
    const current = presentationRef.current;
    if (current.phase !== 'measure' || current.incoming.fieldId !== snapshot.fieldId) return;
    const geometryKey = `${snapshot.frameWidth}:${frameMetrics?.height ?? 0}`;
    if (measuredGeometryKeyRef.current !== geometryKey) {
      measuredHeightsRef.current.clear();
      measuredGeometryKeyRef.current = geometryKey;
    }
    const key = keyboardHeightKey(snapshot.layout, snapshot.frameWidth, state.height);
    const previous = measuredHeightsRef.current.get(key);
    if (previous === undefined || Math.abs(previous - height) > 0.5) {
      measuredHeightsRef.current.set(key, height);
      setMeasuredHeightRevision(value => value + 1);
    }
    const pending = state.owner === 'none' && state.blockedFieldId === snapshot.fieldId && state.blockedCapacity === null;
    if (Math.abs(current.incoming.height - height) > 0.5 && pending && !controller.preflightFocusTarget(snapshot.fieldId)) {
      reportFocusVisibilityFailure(snapshot.fieldId, 'keyboard-height-preflight-changed');
      return;
    }
    const incoming = {...current.incoming, height};
    const targetOffset = targetOffsetFor(incoming.fieldId, current.targetOffset);
    const focusTarget = focusTargetRef.current;
    if (focusTarget?.fieldId === incoming.fieldId && frameMetrics !== null) {
      setFocusTargetState(
        incoming.fieldId,
        focusTarget.rect,
        calculatePresentationOffsetY(focusTarget.rect, frameMetrics.height, height),
      );
    }
    const resolvedTargetOffset = targetOffsetFor(incoming.fieldId, targetOffset);
    if (current.kind === 'enter') {
      setPresentationState({
        phase: 'enter',
        serial: nextPresentationSerial(),
        incoming,
        startOffset: current.startOffset,
        targetOffset: resolvedTargetOffset,
        settled: false,
      });
    } else {
      const outgoingHeight = maxVisibleHeight(current.outgoing);
      setPresentationState({
        phase: 'handoff',
        serial: nextPresentationSerial(),
        outgoing: current.outgoing,
        incoming,
        track: handoffTrackOf({
          outgoingHeight,
          incomingHeight: height,
          outgoingOffset: current.startOffset,
          incomingOffset: resolvedTargetOffset,
        }),
        startOffset: current.startOffset,
        targetOffset: resolvedTargetOffset,
        settled: false,
      });
    }
  }, [controller, frameMetrics, nextPresentationSerial, reportFocusVisibilityFailure, setFocusTargetState, setPresentationState, state.blockedCapacity, state.blockedFieldId, state.height, state.owner, targetOffsetFor]);

  useLayoutEffect(() => {
    if (state.activeFieldId !== null) {
      setFocusVisibilityFailure(previous => previous !== null && previous.fieldId !== state.activeFieldId ? null : previous);
    }
    const current = presentationRef.current;
    if (current.phase === 'measure') {
      if (desiredSnapshot === null) retargetPresentation(null);
      else if (
        current.incoming.fieldId !== desiredSnapshot.fieldId
        || current.incoming.layout !== desiredSnapshot.layout
        || current.incoming.frameWidth !== desiredSnapshot.frameWidth
        || Math.abs(current.incoming.height - desiredSnapshot.height) > 0.5
      ) retargetPresentation(desiredSnapshot);
      return;
    }
    const transitioning = current.phase === 'enter'
      || current.phase === 'handoff'
      || current.phase === 'exit'
      || current.phase === 'reposition';
    if (transitioning) {
      const expectedFieldId = current.phase === 'enter' || current.phase === 'handoff'
        ? current.incoming.fieldId
        : current.phase === 'reposition'
          ? current.active.fieldId
          : null;
      const expectedSignature = current.phase === 'enter' || current.phase === 'handoff'
        ? `${current.incoming.fieldId}|${current.incoming.layout}|${current.incoming.frameWidth}|${current.incoming.height}`
        : null;
      const actualSignature = desiredSnapshot === null
        ? null
        : `${desiredSnapshot.fieldId}|${desiredSnapshot.layout}|${desiredSnapshot.frameWidth}|${desiredSnapshot.height}`;
      const matches = desiredSnapshot !== null
        && desiredSnapshot.fieldId === expectedFieldId
        && (expectedSignature === null || expectedSignature === actualSignature);
      if (current.phase === 'exit' && desiredSnapshot === null) return;
      if (!matches) retargetPresentation(desiredSnapshot);
      else if (current.phase === 'enter' || current.phase === 'handoff') {
        const targetOffset = targetOffsetFor(desiredSnapshot.fieldId, current.targetOffset);
        if (Math.abs(targetOffset - current.targetOffset) > 0.5) retargetPresentation(desiredSnapshot);
      }
      return;
    }
    if (desiredSnapshot === null) {
      if (current.phase === 'display') beginExit([{snapshot: current.active, translateY: 0}], presentationOffsetRef.current);
      return;
    }
    if (current.phase === 'idle') {
      beginMeasure(desiredSnapshot, []);
      return;
    }
    if (current.phase !== 'display') return;
    const sameDimensions = current.active.layout === desiredSnapshot.layout
      && current.active.frameWidth === desiredSnapshot.frameWidth
      && Math.abs(current.active.height - desiredSnapshot.height) <= 0.5;
    if (!sameDimensions) {
      beginMeasure(desiredSnapshot, [{snapshot: current.active, translateY: 0}]);
      return;
    }
    if (current.active.fieldId !== desiredSnapshot.fieldId) {
      const targetOffset = targetOffsetFor(desiredSnapshot.fieldId, presentationOffsetRef.current);
      if (focusTargetRef.current?.fieldId === desiredSnapshot.fieldId) {
        setPresentationState({
          phase: 'reposition',
          serial: nextPresentationSerial(),
          active: desiredSnapshot,
          startOffset: presentationOffsetRef.current,
          targetOffset,
        });
      } else setPresentationState({phase: 'display', active: desiredSnapshot});
      return;
    }
    const targetOffset = targetOffsetFor(desiredSnapshot.fieldId, presentationOffsetRef.current);
    if (Math.abs(targetOffset - presentationOffsetRef.current) > 0.5) {
      setPresentationState({
        phase: 'reposition',
        serial: nextPresentationSerial(),
        active: desiredSnapshot,
        startOffset: presentationOffsetRef.current,
        targetOffset,
      });
    } else if (
      current.active.shift !== desiredSnapshot.shift
      || current.active.hasNextField !== desiredSnapshot.hasNextField
    ) setPresentationState({phase: 'display', active: desiredSnapshot});
  }, [
    beginExit,
    beginMeasure,
    desiredSignature,
    desiredSnapshot,
    focusTarget?.revision,
    measuredHeightRevision,
    nextPresentationSerial,
    retargetPresentation,
    setPresentationState,
    state.activeFieldId,
    targetOffsetFor,
  ]);

  const animationPhase = presentation.phase;
  const animationSerial = 'serial' in presentation ? presentation.serial : null;
  useLayoutEffect(() => {
    const current = presentationRef.current;
    if (current.phase === 'display') startScheduledScrollFor(current.active.fieldId);
    else if (current.phase === 'enter' || current.phase === 'handoff') startScheduledScrollFor(current.incoming.fieldId);
    else if (current.phase === 'reposition') startScheduledScrollFor(current.active.fieldId);
    else if (current.phase === 'exit' || current.phase === 'idle') scheduledScrollStartRef.current = null;
  }, [presentation.phase, scheduledScrollRevision, startScheduledScrollFor]);
  useLayoutEffect(() => {
    if (
      presentation.phase !== 'enter'
      && presentation.phase !== 'handoff'
      && presentation.phase !== 'exit'
      && presentation.phase !== 'reposition'
    ) return;
    animationRef.current?.stop();
    animationRef.current = null;
    progress.setValue(0);
    const serial = presentation.serial;
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: 250,
      easing: Easing.inOut(Easing.quad),
      useNativeDriver: Platform?.OS !== 'web',
    });
    animationRef.current = animation;
    if (presentation.phase === 'enter' || presentation.phase === 'handoff') {
      startScheduledScrollFor(presentation.incoming.fieldId);
    } else if (presentation.phase === 'reposition') {
      startScheduledScrollFor(presentation.active.fieldId);
    }
    animation.start(({finished}) => {
      if (!finished) return;
      const current = presentationRef.current;
      if (!('serial' in current) || current.serial !== serial) return;
      animationRef.current = null;
      if (current.phase === 'enter' || current.phase === 'handoff') {
        if (!current.settled) {
          setPresentationState({...current, settled: true});
          finishPendingPresentation(current.incoming, current.targetOffset);
        }
      } else if (current.phase === 'exit') {
        assignPresentationOffset(0);
        setPresentationState({phase: 'idle'});
      } else if (current.phase === 'reposition') {
        assignPresentationOffset(current.targetOffset);
        setPresentationState({phase: 'display', active: current.active});
      }
    });
  }, [
    animationPhase,
    animationSerial,
    assignPresentationOffset,
    finishPendingPresentation,
    progress,
    setPresentationState,
    startScheduledScrollFor,
  ]);

  useLayoutEffect(() => () => {
    animationRef.current?.stop();
    progress.stopAnimation();
    scheduledScrollStartRef.current = null;
  }, [progress]);

  const animatedOffset = useMemo((): number | Animated.AnimatedInterpolation<number> => {
    switch (presentation.phase) {
      case 'enter':
      case 'reposition':
        return animatedInterpolation(progress, [0, 1], [presentation.startOffset, presentation.targetOffset]);
      case 'handoff':
        return animatedInterpolation(progress, presentation.track.inputRange, presentation.track.offset);
      case 'exit':
        return animatedInterpolation(progress, [0, 1], [presentation.startOffset, 0]);
      default:
        return presentationOffsetY;
    }
  }, [presentation, presentationOffsetY, progress]);

  const renderedLayers = useMemo(() => {
    type RenderedLayer = Readonly<{
      readonly snapshot: InputKeyboardSnapshot;
      readonly translateY: number | Animated.AnimatedInterpolation<number>;
      readonly interactive?: boolean;
      readonly hidden?: boolean;
      readonly suffix?: string;
      readonly onLayout?: (event: LayoutChangeEvent) => void;
    }>;
    const layer = (
      snapshot: InputKeyboardSnapshot,
      translateY: number | Animated.AnimatedInterpolation<number>,
      options: Omit<RenderedLayer, 'snapshot' | 'translateY'> = {},
    ): RenderedLayer => ({snapshot, translateY, ...options});
    switch (presentation.phase) {
      case 'idle': return [] as RenderedLayer[];
      case 'measure': return [
        ...presentation.outgoing.map((item, index) => layer(item.snapshot, item.translateY, {suffix: `outgoing-${index}`})),
        layer(presentation.incoming, presentation.incoming.height, {
          hidden: true,
          suffix: 'measure',
          onLayout: onKeyboardLayout(presentation.incoming),
        }),
      ];
      case 'enter': return [layer(
        presentation.incoming,
        animatedInterpolation(progress, [0, 1], [presentation.incoming.height, 0]),
      )];
      case 'display': return [layer(presentation.active, 0, {
        interactive: state.visible && state.activeFieldId === presentation.active.fieldId,
        onLayout: onKeyboardLayout(presentation.active),
      })];
      case 'handoff': return [
        layer(presentation.incoming, animatedInterpolation(progress, presentation.track.inputRange, presentation.track.incomingTranslateY)),
        ...presentation.outgoing.map((item, index) => layer(
          item.snapshot,
          animatedInterpolation(
            progress,
            presentation.track.inputRange,
            presentation.track.outgoingTranslateY.map(shift => item.translateY + shift),
          ),
          {suffix: `outgoing-${index}`},
        )),
      ];
      case 'exit': return presentation.outgoing.map((item, index) => layer(
        item.snapshot,
        animatedInterpolation(progress, [0, 1], [item.translateY, item.translateY + presentation.obstructionHeight]),
        {suffix: `outgoing-${index}`},
      ));
      case 'reposition': return [layer(presentation.active, 0, {
        interactive: state.visible && state.activeFieldId === presentation.active.fieldId,
        onLayout: onKeyboardLayout(presentation.active),
      })];
    }
  }, [onKeyboardLayout, presentation, progress, state.activeFieldId, state.visible]);

  const hitShield = useMemo(() => {
    switch (presentation.phase) {
      case 'measure': {
        const height = maxVisibleHeight(presentation.outgoing);
        return height > 0 ? {height, translateY: 0} : null;
      }
      case 'enter': {
        const height = presentation.incoming.height;
        return {height, translateY: animatedInterpolation(progress, [0, 1], [height, 0])};
      }
      case 'handoff': {
        const height = Math.max(maxVisibleHeight(presentation.outgoing), presentation.incoming.height);
        return {
          height,
          translateY: animatedInterpolation(
            progress,
            presentation.track.inputRange,
            presentation.track.obstructionHeight.map(value => height - value),
          ),
        };
      }
      case 'exit': {
        const height = presentation.obstructionHeight;
        return {height, translateY: animatedInterpolation(progress, [0, 1], [0, height])};
      }
      default: return null;
    }
  }, [presentation, progress]);

  const surfaceInteractionProps = typeof document === 'undefined'
      ? {
        onTouchStart: rememberSurfaceTouchStart,
        onTouchEnd: dismissFromSurfaceTouchEnd,
      }
    : {
        onClick: dismissFromSurfaceClick,
      };
  const consumeKeyboardAreaTouch = useCallback(() => true, []);
  const finishKeyboardAreaTouch = useCallback((event: GestureResponderEvent) => event.stopPropagation(), []);

  return (
    <InputSurfaceGeometryContext.Provider value={geometry}>
      <SurfacePresentationOffsetProvider offset={animatedOffset}>
        {/* Passive touch/click observation keeps ScrollView and business descendants' responder negotiation intact. */}
        <View
          testID="ui.base.input:surface-content"
          style={styles.content}
          {...surfaceInteractionProps}
        >
          {children}
          {showUnsupportedNotice ? (
            <PrimitiveStatus testID="ui.base.input:unsupported-size">
              {unsupportedMessageOf(state.blockedCapacity)}
            </PrimitiveStatus>
          ) : null}
        </View>
      </SurfacePresentationOffsetProvider>
      {frameMetrics?.ready === true ? (
        <View
          testID="ui.base.input:keyboard-overlay"
          style={[styles.keyboardOverlay, {pointerEvents: Platform?.OS === 'web' ? 'none' : 'box-none'}]}
        >
          {renderedLayers.map((item, index) => {
            const interactive = item.interactive === true
              && presentation.phase !== 'enter'
              && presentation.phase !== 'handoff'
              && presentation.phase !== 'exit'
              && presentation.phase !== 'measure';
            return (
              <Animated.View
                key={`${item.snapshot.fieldId}:${item.snapshot.layout}:${item.suffix ?? 'active'}:${index}`}
                testID={`ui.base.input:keyboard-layer-position:${item.suffix ?? 'active'}`}
                accessibilityElementsHidden={!interactive || item.hidden === true}
                importantForAccessibility={interactive ? 'auto' : 'no-hide-descendants'}
                onLayout={item.onLayout}
                style={[
                  styles.keyboardLayer,
                  {width: item.snapshot.frameWidth, pointerEvents: interactive ? 'auto' : 'none', transform: [{translateY: item.translateY}], opacity: item.hidden ? 0 : 1},
                ]}
              >
                <InputKeyboard snapshot={item.snapshot} interactive={interactive} testIDSuffix={item.suffix} />
              </Animated.View>
            );
          })}
          {hitShield !== null ? (
            <Animated.View
              testID="ui.base.input:keyboard-hit-shield"
              accessible={false}
              onStartShouldSetResponder={consumeKeyboardAreaTouch}
              onMoveShouldSetResponder={consumeKeyboardAreaTouch}
              onResponderTerminationRequest={() => false}
              onResponderRelease={finishKeyboardAreaTouch}
              {...(typeof document === 'undefined'
                ? {}
                : {onClick: (event: Readonly<{readonly stopPropagation: () => void}>) => event.stopPropagation()})}
              style={[styles.keyboardHitShield, {height: hitShield.height, pointerEvents: 'auto', transform: [{translateY: hitShield.translateY}]}]}
            />
          ) : null}
        </View>
      ) : null}
      {focusVisibilityFailure !== null ? (
        <View style={[styles.focusVisibilityError, {pointerEvents: 'none'}]}>
          <PrimitiveStatus testID="ui.base.input:focus-visibility-error">
            焦点框无法完整显示，请调整窗口尺寸或退出输入
          </PrimitiveStatus>
        </View>
      ) : null}
    </InputSurfaceGeometryContext.Provider>
  );
};

const styles = StyleSheet.create({
  frame: {
    flex: 1,
    width: '100%',
  },
  content: {
    flex: 1,
    width: '100%',
  },
  keyboardOverlay: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    left: 0,
    top: 0,
    zIndex: 1001,
    elevation: 1001,
  },
  keyboardLayer: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'stretch',
  },
  keyboardHitShield: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 1,
    elevation: 1,
    backgroundColor: 'transparent',
  },
  focusVisibilityError: {
    position: 'absolute',
    top: 8,
    left: 8,
    right: 8,
    zIndex: 1002,
    elevation: 1002,
  },
});
