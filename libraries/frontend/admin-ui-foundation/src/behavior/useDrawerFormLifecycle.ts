import {App} from 'antd';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useDirtyFormLock, useOverlayLock} from '../overlay/overlayLock';

export type DirtyGuardTestIds = {
  confirm: Record<string, string>;
  cancel: Record<string, string>;
};

export type DrawerLifecycleDiagnosticEvent = {
  operationId?: string;
  operationInstanceId: string;
  phase:
    | 'OPEN_OBSERVED'
    | 'CLOSE_REQUESTED'
    | 'SUCCESS_CLOSE_REQUESTED'
    | 'CONTROLLED_CLOSE_OBSERVED'
    | 'CLOSE_CONFIRMED'
    | 'SUCCESS_FEEDBACK_DISPATCHED';
  outcome: 'OPEN' | 'CLOSE_REQUESTED' | 'SUCCESS_PENDING' | 'CLOSED' | 'SUCCESS_DISPATCHED';
};

export type DrawerFormLifecycleOptions = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dirtyMessage?: string;
  dirtyGuardTestIds?: DirtyGuardTestIds;
  onSuccessClosed?: () => void;
  /**
   * Emits lifecycle-only diagnostics. The payload deliberately contains no
   * form values, server response, credential, or user-entered identifiers.
   */
  onDiagnosticEvent?: (event: DrawerLifecycleDiagnosticEvent) => void;
  diagnosticOperationId?: string;
  idempotencyKey?: boolean;
};

export type DrawerFormLifecycleResult = {
  readonly dirty: boolean;
  setDirty: (dirty: boolean) => void;
  readonly submitting: boolean;
  setSubmitting: (submitting: boolean) => void;
  reset: () => void;
  /**
   * Clears the current draft/operation state while keeping the Drawer open
   * observation intact. Controllers use this for in-drawer context changes;
   * the visual-close callback remains the only place that performs a full
   * lifecycle reset.
   */
  resetPreservingOpen: () => void;
  requestClose: () => void;
  handleOpenChange: (open: boolean) => void;
  closeAfterSuccess: () => void;
  afterOpenChange: (visible: boolean) => void;
  /**
   * Incremented only after the Drawer has visually finished closing. A
   * DrawerForm may use it as a React key when `destroyOnHidden` cannot be
   * enabled without suppressing that close confirmation.
   */
  readonly closedSessionKey: number;
  getIdempotencyKey: () => string;
  markBusinessIntentChanged: () => void;
};

export function useDrawerFormLifecycle({
  open,
  onOpenChange,
  dirtyMessage,
  dirtyGuardTestIds,
  onSuccessClosed,
  onDiagnosticEvent,
  diagnosticOperationId,
  idempotencyKey: idempotencyEnabled = false,
}: DrawerFormLifecycleOptions): DrawerFormLifecycleResult {
  const latestOptions = useRef({
    open,
    onOpenChange,
    dirtyMessage,
    dirtyGuardTestIds,
    onSuccessClosed,
    onDiagnosticEvent,
    diagnosticOperationId,
    idempotencyEnabled,
  });
  latestOptions.current = {
    open,
    onOpenChange,
    dirtyMessage,
    dirtyGuardTestIds,
    onSuccessClosed,
    onDiagnosticEvent,
    diagnosticOperationId,
    idempotencyEnabled,
  };
  const {modal} = App.useApp();
  useOverlayLock(open);
  const [dirty, setDirty] = useState(false);
  useDirtyFormLock(open && dirty);
  const [submitting, setSubmitting] = useState(false);
  const [closedSessionKey, setClosedSessionKey] = useState(0);
  const dirtyRef = useRef(dirty);
  const submittingRef = useRef(submitting);
  const closedSessionKeyRef = useRef(closedSessionKey);
  dirtyRef.current = dirty;
  submittingRef.current = submitting;
  closedSessionKeyRef.current = closedSessionKey;
  const idempotencyKey = useRef<string | undefined>(undefined);
  const bypassClose = useRef(false);
  const dirtyGuardOpen = useRef(false);
  const dirtyGuardRef = useRef<{destroy: () => void} | undefined>(undefined);
  const pendingSuccess = useRef(false);
  const observedOpen = useRef(false);
  const diagnosticOperationInstanceId = useRef<string | undefined>(undefined);
  const latestControlledOpen = useRef(open);
  const previouslyControlledOpen = useRef(open);
  latestControlledOpen.current = open;

  useEffect(
    () => () => {
      dirtyGuardRef.current?.destroy();
      dirtyGuardRef.current = undefined;
      dirtyGuardOpen.current = false;
    },
    [],
  );

  const diagnostic = useCallback(
    (phase: DrawerLifecycleDiagnosticEvent['phase'], outcome: DrawerLifecycleDiagnosticEvent['outcome']) => {
      if (!diagnosticOperationInstanceId.current) {
        const suffix = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
        diagnosticOperationInstanceId.current = `${latestOptions.current.diagnosticOperationId ?? 'drawer'}:${suffix}`;
      }
      latestOptions.current.onDiagnosticEvent?.({
        operationId: latestOptions.current.diagnosticOperationId,
        operationInstanceId: diagnosticOperationInstanceId.current,
        phase,
        outcome,
      });
    },
    [],
  );

  // DrawerForm may mount closed and later replay that initial closed callback
  // after its controlled `open` prop has become true. The controlled state is
  // authoritative: record the open transition here, then ignore such stale
  // callbacks until the parent has actually closed the Drawer.
  useEffect(() => {
    if (open && !observedOpen.current) {
      observedOpen.current = true;
      diagnostic('OPEN_OBSERVED', 'OPEN');
    }
    if (!open && previouslyControlledOpen.current) diagnostic('CONTROLLED_CLOSE_OBSERVED', 'CLOSE_REQUESTED');
    previouslyControlledOpen.current = open;
  }, [diagnostic, open]);

  const getIdempotencyKey = useCallback(() => {
    if (!idempotencyKey.current) idempotencyKey.current = `ui-${crypto.randomUUID()}`;
    return idempotencyKey.current;
  }, []);

  const markBusinessIntentChanged = useCallback(() => {
    if (latestOptions.current.idempotencyEnabled) idempotencyKey.current = undefined;
  }, []);

  const resetState = useCallback((preserveOpen: boolean) => {
    // A context reset can happen while the dirty confirmation is still open.
    // Destroy that confirmation before clearing lifecycle state so an old
    // modal callback cannot close a newly mounted context.
    dirtyGuardRef.current?.destroy();
    dirtyGuardRef.current = undefined;
    setDirty(false);
    setSubmitting(false);
    idempotencyKey.current = undefined;
    bypassClose.current = false;
    dirtyGuardOpen.current = false;
    pendingSuccess.current = false;
    if (!preserveOpen) observedOpen.current = false;
  }, []);
  const reset = useCallback(() => resetState(false), [resetState]);
  const resetPreservingOpen = useCallback(() => resetState(true), [resetState]);

  const requestClose = useCallback(() => {
    if (submittingRef.current) return;
    if (!dirtyRef.current || bypassClose.current) {
      bypassClose.current = false;
      diagnostic('CLOSE_REQUESTED', 'CLOSE_REQUESTED');
      latestOptions.current.onOpenChange(false);
      return;
    }
    // AntD Drawer can report one user close through both `onClose` and
    // `onOpenChange(false)`. They are the same close intent, not two reasons
    // to ask the user twice whether to discard their draft.
    if (dirtyGuardOpen.current) return;
    dirtyGuardOpen.current = true;
    const confirmation = modal.confirm({
      title: '放弃当前填写内容？',
      content: latestOptions.current.dirtyMessage ?? '已填写的内容不会保存。',
      okText: '放弃并关闭',
      cancelText: '继续编辑',
      okButtonProps: latestOptions.current.dirtyGuardTestIds?.confirm,
      cancelButtonProps: latestOptions.current.dirtyGuardTestIds?.cancel,
      onOk: () => {
        dirtyGuardRef.current = undefined;
        dirtyGuardOpen.current = false;
        bypassClose.current = true;
        resetPreservingOpen();
        diagnostic('CLOSE_REQUESTED', 'CLOSE_REQUESTED');
        latestOptions.current.onOpenChange(false);
      },
      onCancel: () => {
        dirtyGuardRef.current = undefined;
        dirtyGuardOpen.current = false;
      },
    });
    dirtyGuardRef.current = confirmation;
  }, [diagnostic, modal, resetPreservingOpen]);

  const closeAfterSuccess = useCallback(() => {
    pendingSuccess.current = true;
    bypassClose.current = true;
    setDirty(false);
    diagnostic('SUCCESS_CLOSE_REQUESTED', 'SUCCESS_PENDING');
    latestOptions.current.onOpenChange(false);
  }, [diagnostic]);

  const consumePendingSuccess = useCallback(() => {
    if (!pendingSuccess.current) return;
    pendingSuccess.current = false;
    diagnostic('SUCCESS_FEEDBACK_DISPATCHED', 'SUCCESS_DISPATCHED');
    latestOptions.current.onSuccessClosed?.();
    setDirty(false);
    setSubmitting(false);
    idempotencyKey.current = undefined;
    bypassClose.current = false;
  }, [diagnostic]);

  const handleOpenChange = useCallback((nextOpen: boolean) => {
    if (nextOpen && !latestOptions.current.open) {
      latestOptions.current.onOpenChange(true);
    }
  }, []);

  const afterOpenChange = useCallback(
    (visible: boolean) => {
      if (visible) {
        if (observedOpen.current) return;
        observedOpen.current = true;
        diagnostic('OPEN_OBSERVED', 'OPEN');
        return;
      }
      if (latestControlledOpen.current) return;
      // Ant Design may report an initial closed state while a DrawerForm is
      // mounted. It is not the successful close transition and must not consume
      // a later pending success before the parent has actually closed the Drawer.
      if (observedOpen.current) {
        diagnostic('CLOSE_CONFIRMED', 'CLOSED');
        consumePendingSuccess();
        // Keep the mounted form alive until Ant Design has confirmed the visual
        // close. Remounting only now clears its local draft without allowing a
        // ProComponents destroy-on-hide path to bypass `afterOpenChange(false)`.
        setClosedSessionKey(current => current + 1);
      }
      observedOpen.current = false;
      diagnosticOperationInstanceId.current = undefined;
    },
    [consumePendingSuccess, diagnostic],
  );

  return useMemo(
    () => ({
      get dirty() {
        return dirtyRef.current;
      },
      setDirty,
      get submitting() {
        return submittingRef.current;
      },
      setSubmitting,
      reset,
      resetPreservingOpen,
      requestClose,
      handleOpenChange,
      closeAfterSuccess,
      afterOpenChange,
      get closedSessionKey() {
        return closedSessionKeyRef.current;
      },
      getIdempotencyKey,
      markBusinessIntentChanged,
    }),
    [
      afterOpenChange,
      closeAfterSuccess,
      getIdempotencyKey,
      handleOpenChange,
      markBusinessIntentChanged,
      requestClose,
      reset,
      resetPreservingOpen,
    ],
  );
}
