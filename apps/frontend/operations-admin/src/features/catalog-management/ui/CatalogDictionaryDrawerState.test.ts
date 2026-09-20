// @vitest-environment jsdom
import {createElement, forwardRef, useEffect, useImperativeHandle, useRef, useState, type Ref} from 'react';
import {act, create, type ReactTestRenderer} from 'react-test-renderer';
import {describe, expect, it, vi} from 'vitest';
import {useDrawerFormLifecycle} from '@catering-v2s/admin-ui-foundation';
import {
  catalogConfigurationChangeNeedsConfirmation,
  catalogUnitStatusQuery,
  catalogUnitVoidControlState,
} from './dictionary/catalogDictionaryDrawerModel';

type Confirmation = {
  onOk?: () => void;
  onCancel?: () => void;
};

const modalState = vi.hoisted(() => ({confirmation: undefined as Confirmation | undefined}));

(globalThis as typeof globalThis & {IS_REACT_ACT_ENVIRONMENT: boolean}).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('antd', () => ({
  App: {
    useApp: () => ({
      modal: {
        confirm: (confirmation: Confirmation) => {
          modalState.confirmation = confirmation;
          return {destroy: () => undefined};
        },
      },
    }),
  },
}));

type LifecycleProbeHandle = {
  setDirty: (dirty: boolean) => void;
  setSubmitting: (submitting: boolean) => void;
  setReadback: (value: string) => void;
  requestClose: () => void;
  closeAfterSuccess: () => void;
  afterOpenChange: (visible: boolean) => void;
  snapshot: () => {dirty: boolean; submitting: boolean; readback: string; closedSessionKey: number};
};

const LifecycleProbe = forwardRef(function LifecycleProbe(
  {
    open,
    queryKey,
    onOpenChange,
    onSuccessClosed,
  }: {
    open: boolean;
    queryKey: string;
    onOpenChange: (open: boolean) => void;
    onSuccessClosed: () => void;
  },
  ref: Ref<LifecycleProbeHandle>,
) {
  const [readback, setReadback] = useState('EMPTY');
  const [observedQueryKey, setObservedQueryKey] = useState(queryKey);
  const lifecycle = useDrawerFormLifecycle({
    open,
    onOpenChange,
    dirtyMessage: '尚未保存的内容。',
    dirtyGuardTestIds: {confirm: {'data-testid': 'discard'}, cancel: {'data-testid': 'continue'}},
    diagnosticOperationId: 'catalog-lifecycle-probe',
    onSuccessClosed,
  });
  const resetRef = useRef(lifecycle.reset);
  resetRef.current = lifecycle.reset;

  useEffect(() => {
    setObservedQueryKey(queryKey);
    setReadback('EMPTY');
    resetRef.current();
  }, [queryKey]);

  useEffect(() => {
    if (!open) {
      setReadback('EMPTY');
    }
  }, [open]);

  useImperativeHandle(
    ref,
    () => ({
      setDirty: lifecycle.setDirty,
      setSubmitting: lifecycle.setSubmitting,
      setReadback,
      requestClose: lifecycle.requestClose,
      closeAfterSuccess: lifecycle.closeAfterSuccess,
      afterOpenChange: lifecycle.afterOpenChange,
      snapshot: () => ({
        dirty: lifecycle.dirty,
        submitting: lifecycle.submitting,
        readback: `${observedQueryKey}:${readback}`,
        closedSessionKey: lifecycle.closedSessionKey,
      }),
    }),
    [lifecycle, observedQueryKey, readback],
  );

  return createElement('output', {['data-query-key']: observedQueryKey}, `${observedQueryKey}:${readback}`);
});

describe('catalog configuration library change guard', () => {
  it('ignores dirty state owned by the parent product editor', () => {
    expect(
      catalogConfigurationChangeNeedsConfirmation({
        configurationLifecycleDirty: false,
        definitionDirtyMessage: undefined,
      }),
    ).toBe(false);
  });

  it('protects an unfinished configuration form or definition editor', () => {
    expect(
      catalogConfigurationChangeNeedsConfirmation({
        configurationLifecycleDirty: true,
        definitionDirtyMessage: undefined,
      }),
    ).toBe(true);
    expect(
      catalogConfigurationChangeNeedsConfirmation({
        configurationLifecycleDirty: false,
        definitionDirtyMessage: '未保存',
      }),
    ).toBe(true);
  });
});

describe('catalog unit void control', () => {
  it('does not send an already referenced unit into a predictable void rejection', () => {
    expect(catalogUnitVoidControlState({canWrite: true, isReferenced: true, isTransitioning: false})).toEqual({
      disabled: true,
      reason: '该计量单位正在使用，不能作废；可以停用。',
    });
  });

  it('keeps void available only for a writable, unreferenced and idle unit', () => {
    expect(catalogUnitVoidControlState({canWrite: true, isReferenced: false, isTransitioning: false})).toEqual({
      disabled: false,
    });
  });
});

describe('catalog unit status query', () => {
  it.each(['ENABLED', 'DISABLED', 'VOIDED'] as const)('forwards %s without widening the filter', status => {
    expect(catalogUnitStatusQuery(status)).toEqual({status});
  });

  it('does not invent a status for the unfiltered management list', () => {
    expect(catalogUnitStatusQuery(undefined)).toEqual({});
  });
});

describe('catalog drawer lifecycle behavior pinning', () => {
  it('mounts, reopens, resets query-local readback, and guards dirty discard/continue', async () => {
    const ref = {current: null as LifecycleProbeHandle | null};
    const closeRequests: boolean[] = [];
    let renderer: ReactTestRenderer;

    await act(async () => {
      renderer = create(
        createElement(LifecycleProbe, {
          open: false,
          queryKey: 'scope-a',
          onOpenChange: open => closeRequests.push(open),
          onSuccessClosed: () => undefined,
          ref,
        }),
      );
    });
    expect(ref.current?.snapshot()).toMatchObject({dirty: false, submitting: false, readback: 'scope-a:EMPTY'});

    await act(async () => {
      renderer.update(
        createElement(LifecycleProbe, {
          open: true,
          queryKey: 'scope-a',
          onOpenChange: open => closeRequests.push(open),
          onSuccessClosed: () => undefined,
          ref,
        }),
      );
    });
    await act(async () => ref.current?.afterOpenChange(true));
    await act(async () => {
      ref.current?.setReadback('server-readback');
      ref.current?.setDirty(true);
    });
    expect(ref.current?.snapshot()).toMatchObject({dirty: true, readback: 'scope-a:server-readback'});

    await act(async () => ref.current?.requestClose());
    expect(closeRequests).toEqual([]);
    expect(modalState.confirmation).toBeDefined();
    await act(async () => modalState.confirmation?.onCancel?.());
    expect(ref.current?.snapshot().dirty).toBe(true);

    await act(async () => ref.current?.requestClose());
    await act(async () => modalState.confirmation?.onOk?.());
    expect(closeRequests).toEqual([false]);

    await act(async () => {
      renderer.update(
        createElement(LifecycleProbe, {
          open: false,
          queryKey: 'scope-a',
          onOpenChange: open => closeRequests.push(open),
          onSuccessClosed: () => undefined,
          ref,
        }),
      );
    });
    await act(async () => ref.current?.afterOpenChange(false));
    expect(ref.current?.snapshot()).toMatchObject({dirty: false, readback: 'scope-a:EMPTY'});

    await act(async () => {
      renderer.update(
        createElement(LifecycleProbe, {
          open: true,
          queryKey: 'scope-a',
          onOpenChange: open => closeRequests.push(open),
          onSuccessClosed: () => undefined,
          ref,
        }),
      );
    });
    await act(async () => ref.current?.setReadback('stale-scope-a'));
    await act(async () => {
      renderer.update(
        createElement(LifecycleProbe, {
          open: true,
          queryKey: 'scope-b',
          onOpenChange: open => closeRequests.push(open),
          onSuccessClosed: () => undefined,
          ref,
        }),
      );
    });
    expect(ref.current?.snapshot().readback).toBe('scope-b:EMPTY');
    renderer!.unmount();
  });

  it('does not allow a pending submission to close, and dispatches success only after visual close', async () => {
    const ref = {current: null as LifecycleProbeHandle | null};
    const closeRequests: boolean[] = [];
    const success: string[] = [];
    let renderer: ReactTestRenderer;

    await act(async () => {
      renderer = create(
        createElement(LifecycleProbe, {
          open: true,
          queryKey: 'scope-a',
          onOpenChange: open => closeRequests.push(open),
          onSuccessClosed: () => success.push('closed'),
          ref,
        }),
      );
    });
    await act(async () => ref.current?.afterOpenChange(true));
    await act(async () => ref.current?.setSubmitting(true));
    await act(async () => ref.current?.requestClose());
    expect(closeRequests).toEqual([]);
    await act(async () => ref.current?.closeAfterSuccess());
    expect(closeRequests).toEqual([false]);

    await act(async () => {
      renderer.update(
        createElement(LifecycleProbe, {
          open: false,
          queryKey: 'scope-a',
          onOpenChange: open => closeRequests.push(open),
          onSuccessClosed: () => success.push('closed'),
          ref,
        }),
      );
    });
    await act(async () => ref.current?.afterOpenChange(false));
    expect(success).toEqual(['closed']);
    expect(ref.current?.snapshot()).toMatchObject({dirty: false, submitting: false});
    renderer!.unmount();
  });
});
