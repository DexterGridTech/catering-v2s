import {describe, expect, it} from 'vitest';
import {platformHttpProtocol} from './http/platformHttpProtocol';
import {contextScopedQueryArgs} from './list/contextScopedQueryArgs';
import {updateDirtyRegistrations, updateOpenRegistrations} from './overlay/overlayLock';
import {adminDrawerSurfaceProps} from './overlay/drawerSurface';
import {createAsyncGenerationGuard} from './behavior/asyncGeneration';
import {AdminErrorBoundary} from './behavior/AdminErrorBoundary';
import {createRefreshSignal} from './behavior/refreshSignal';
import {serializeJsonOrMultipartBody} from './http/wireRequestBody';

describe('admin UI foundation contract and lifecycle primitives', () => {
  it('exposes the generated shared HTTP protocol without local aliases', () => {
    expect(platformHttpProtocol.CORRELATION_ID).toBeTruthy();
    expect(platformHttpProtocol.REQUEST_ID).toBeTruthy();
    expect(new Set(Object.values(platformHttpProtocol)).size).toBe(Object.keys(platformHttpProtocol).length);
  });

  it('keeps server cache arguments scoped by the owner-confirmed context', () => {
    expect(contextScopedQueryArgs({page: 2}, {groupWorkspaceKey: 'space-a', identityKey: 'assignment-a', expectedContextVersion: 7}))
      .toEqual({page: 2, groupWorkspaceKey: 'space-a', identityKey: 'assignment-a', expectedContextVersion: 7});
  });

  it('holds the shell lock until every registered overlay closes', () => {
    const first = updateOpenRegistrations(new Set(), 'drawer-a', true);
    const both = updateOpenRegistrations(first, 'modal-b', true);
    const secondOnly = updateOpenRegistrations(both, 'drawer-a', false);
    expect([...secondOnly]).toEqual(['modal-b']);
    expect(updateOpenRegistrations(secondOnly, 'modal-b', false).size).toBe(0);
    expect(updateOpenRegistrations(secondOnly, 'modal-b', true)).toBe(secondOnly);
  });

  it('keeps a separate dirty-form lock so shell switches stay blocked until drafts are resolved', () => {
    const first = updateDirtyRegistrations(new Set(), 'form-a', true);
    const both = updateDirtyRegistrations(first, 'form-b', true);
    const secondOnly = updateDirtyRegistrations(both, 'form-a', false);
    expect([...secondOnly]).toEqual(['form-b']);
    expect(updateDirtyRegistrations(secondOnly, 'form-b', false).size).toBe(0);
    expect(updateDirtyRegistrations(secondOnly, 'form-b', true)).toBe(secondOnly);
  });

  it('freezes the cross-admin Drawer surface contract', () => {
    expect(adminDrawerSurfaceProps.styles?.body?.overflowY).toBe('auto');
    expect(adminDrawerSurfaceProps.styles?.body?.minHeight).toBe(0);
    expect(adminDrawerSurfaceProps.styles?.footer?.justifyContent).toBe('flex-end');
    expect(adminDrawerSurfaceProps.styles?.footer?.position).toBe('sticky');
  });

  it('rejects a late async response after a newer request generation begins', () => {
    const guard = createAsyncGenerationGuard();
    const first = guard.begin();
    const second = guard.begin();
    expect(guard.isCurrent(first)).toBe(false);
    expect(guard.isCurrent(second)).toBe(true);
    guard.invalidate();
    expect(guard.isCurrent(second)).toBe(false);
  });

  it('normalizes a thrown non-Error value before rendering recovery UI', () => {
    const state = AdminErrorBoundary.getDerivedStateFromError({title: 'untyped transport failure'});
    expect(state.error).toBeInstanceOf(Error);
    expect(state.error?.message).toBe('Unexpected UI error');
  });

  it('notifies each app-owned read model exactly once after a successful write', () => {
    const signal = createRefreshSignal();
    let notifications = 0;
    const unsubscribe = signal.subscribe(() => { notifications += 1; });
    const before = signal.snapshot();
    signal.publish();
    expect(signal.snapshot()).toBe(before + 1);
    expect(notifications).toBe(1);
    unsubscribe();
    signal.publish();
    expect(notifications).toBe(1);
  });

  it('uses JSON media type for generated JSON bodies while preserving multipart and explicit headers', () => {
    const jsonHeaders = new Headers();
    expect(serializeJsonOrMultipartBody({name: 'Aurora'}, jsonHeaders)).toBe('{"name":"Aurora"}');
    expect(jsonHeaders.get('Content-Type')).toBe('application/json');
    const explicitHeaders = new Headers({'Content-Type': 'application/problem+json'});
    serializeJsonOrMultipartBody({name: 'Aurora'}, explicitHeaders);
    expect(explicitHeaders.get('Content-Type')).toBe('application/problem+json');
    const multipartHeaders = new Headers();
    expect(serializeJsonOrMultipartBody({file: new Blob(['x'], {type: 'text/plain'})}, multipartHeaders)).toBeInstanceOf(FormData);
    expect(multipartHeaders.has('Content-Type')).toBe(false);
  });
});
