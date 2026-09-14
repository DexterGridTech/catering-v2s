// @vitest-environment jsdom
import {createElement, forwardRef, useEffect, useImperativeHandle, useRef, useState, type Ref} from 'react';
import {act, create, type ReactTestRenderer} from 'react-test-renderer';
import {describe, expect, it, vi} from 'vitest';
import {testId, useDrawerFormLifecycle} from '@catering-v2s/admin-ui-foundation';
import {catalogTestIds} from '../../catalogTestIds';
import {LOCAL_COPY_SCOPE_VALUES} from './localCatalogCopyModel';
import {copyScopeTabKey} from './localCatalogCopyModel';

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

type LocalCopyLifecycleProbeHandle = {
  setDirty: (dirty: boolean) => void;
  setSubmitting: (submitting: boolean) => void;
  setProblem: (problem: string | undefined) => void;
  setReadback: (value: string) => void;
  requestClose: () => void;
  afterOpenChange: (visible: boolean) => void;
  snapshot: () => {
    dirty: boolean;
    submitting: boolean;
    readback: string;
    problem: string;
    queryKey: string;
  };
};

const LocalCopyLifecycleProbe = forwardRef(function LocalCopyLifecycleProbe(
  {
    open,
    queryKey,
    onOpenChange,
  }: {
    open: boolean;
    queryKey: string;
    onOpenChange: (open: boolean) => void;
  },
  ref: Ref<LocalCopyLifecycleProbeHandle>,
) {
  const [readback, setReadback] = useState('EMPTY');
  const [problem, setProblem] = useState<string>();
  const lifecycle = useDrawerFormLifecycle({
    open,
    onOpenChange,
    dirtyMessage: '本库复制检查影响和选择尚未提交。',
    dirtyGuardTestIds: {
      confirm: testId(catalogTestIds.static.localCopyDirtyDiscard),
      cancel: testId(catalogTestIds.static.localCopyDirtyContinue),
    },
    diagnosticOperationId: 'local-catalog-copy',
  });
  const resetRef = useRef(lifecycle.reset);
  resetRef.current = lifecycle.reset;

  useEffect(() => {
    setReadback('EMPTY');
    setProblem(undefined);
    resetRef.current();
  }, [queryKey]);

  useEffect(() => {
    if (!open) {
      setReadback('EMPTY');
      setProblem(undefined);
    }
  }, [open]);

  useImperativeHandle(
    ref,
    () => ({
      setDirty: lifecycle.setDirty,
      setSubmitting: lifecycle.setSubmitting,
      setProblem,
      setReadback,
      requestClose: lifecycle.requestClose,
      afterOpenChange: lifecycle.afterOpenChange,
      snapshot: () => ({
        dirty: lifecycle.dirty,
        submitting: lifecycle.submitting,
        readback,
        problem: problem ?? 'NONE',
        queryKey,
      }),
    }),
    [lifecycle, problem, queryKey, readback],
  );

  return createElement('output', {['data-query-key']: queryKey}, `${queryKey}:${readback}:${problem ?? 'NONE'}`);
});

describe('local copy model', () => {
  it('maps every declared scope to a visible catalog tab and fails closed for an unknown scope', () => {
    for (const scope of LOCAL_COPY_SCOPE_VALUES) expect(copyScopeTabKey(scope)).toBeTruthy();
    expect(() => copyScopeTabKey('UNKNOWN' as never)).toThrow('UNSUPPORTED_LOCAL_COPY_SCOPE');
  });
});

describe('local copy drawer lifecycle behavior pinning', () => {
  it('resets query-local readback on unmount/re-open and guards dirty discard versus continue', async () => {
    const ref = {current: null as LocalCopyLifecycleProbeHandle | null};
    const closeRequests: boolean[] = [];
    let renderer: ReactTestRenderer;

    await act(async () => {
      renderer = create(
        createElement(LocalCopyLifecycleProbe, {
          open: false,
          queryKey: 'scope-a',
          onOpenChange: open => closeRequests.push(open),
          ref,
        }),
      );
    });
    expect(ref.current?.snapshot()).toMatchObject({
      dirty: false,
      submitting: false,
      readback: 'EMPTY',
      queryKey: 'scope-a',
    });

    await act(async () => {
      renderer.update(
        createElement(LocalCopyLifecycleProbe, {
          open: true,
          queryKey: 'scope-a',
          onOpenChange: open => closeRequests.push(open),
          ref,
        }),
      );
    });
    await act(async () => ref.current?.afterOpenChange(true));
    await act(async () => {
      ref.current?.setReadback('copy-readback');
      ref.current?.setProblem('NONE');
      ref.current?.setDirty(true);
    });
    expect(ref.current?.snapshot()).toMatchObject({dirty: true, readback: 'copy-readback'});

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
        createElement(LocalCopyLifecycleProbe, {
          open: false,
          queryKey: 'scope-a',
          onOpenChange: open => closeRequests.push(open),
          ref,
        }),
      );
    });
    await act(async () => ref.current?.afterOpenChange(false));
    expect(ref.current?.snapshot()).toMatchObject({dirty: false, readback: 'EMPTY'});

    await act(async () => {
      renderer.update(
        createElement(LocalCopyLifecycleProbe, {
          open: true,
          queryKey: 'scope-a',
          onOpenChange: open => closeRequests.push(open),
          ref,
        }),
      );
      ref.current?.setReadback('stale-copy');
    });
    await act(async () => {
      renderer.update(
        createElement(LocalCopyLifecycleProbe, {
          open: true,
          queryKey: 'scope-b',
          onOpenChange: open => closeRequests.push(open),
          ref,
        }),
      );
    });
    expect(ref.current?.snapshot()).toMatchObject({queryKey: 'scope-b', readback: 'EMPTY', problem: 'NONE'});
    renderer!.unmount();
  });

  it('keeps a real copy error visible while pending work cannot close the drawer', async () => {
    const ref = {current: null as LocalCopyLifecycleProbeHandle | null};
    const closeRequests: boolean[] = [];
    let renderer: ReactTestRenderer;

    await act(async () => {
      renderer = create(
        createElement(LocalCopyLifecycleProbe, {
          open: true,
          queryKey: 'scope-a',
          onOpenChange: open => closeRequests.push(open),
          ref,
        }),
      );
    });
    await act(async () => {
      ref.current?.setProblem('复制检查未完成，请稍后重试。');
      ref.current?.setSubmitting(true);
    });
    expect(ref.current?.snapshot()).toMatchObject({problem: '复制检查未完成，请稍后重试。', submitting: true});
    await act(async () => ref.current?.requestClose());
    expect(closeRequests).toEqual([]);

    await act(async () => ref.current?.setSubmitting(false));
    await act(async () => ref.current?.setDirty(false));
    await act(async () => ref.current?.requestClose());
    expect(closeRequests).toEqual([false]);
    renderer!.unmount();
  });
});
