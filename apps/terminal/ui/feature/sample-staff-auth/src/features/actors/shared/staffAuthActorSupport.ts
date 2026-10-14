import type {ActorExecutionContext} from '@catering-v2s/kernel-base-runtime';
import {isCurrentWorkspaceOwnedByInstance, showScreenCommand} from '@catering-v2s/kernel-base-ui-state';
import {selectDisplayRole} from '@catering-v2s/kernel-base-display-context';

export const primaryDisplayMode = 'PRIMARY' as const;

export const isContentOwner = (context: ActorExecutionContext): boolean =>
  isCurrentWorkspaceOwnedByInstance(context.getState());

export const showLoginStage = (context: ActorExecutionContext): Promise<unknown> => {
  const route = context.command.routeContext;
  if (
    route === null ||
    route.displayMode === undefined ||
    route.workspace === undefined ||
    route.instanceMode === undefined
  )
    return Promise.reject(new Error('[sample-staff-auth] login stage route context is incomplete'));

  const partKey =
    route.instanceMode === 'MASTER'
      ? route.displayMode === 'PRIMARY'
        ? 'sample.auth.login'
        : route.displayMode === 'SECONDARY' && route.workspace === 'MAIN'
          ? 'sample.auth.guide.lms'
          : null
      : route.displayMode === 'PRIMARY' &&
          route.workspace === 'BRANCH' &&
          selectDisplayRole(context.getState()) === 'CHIEF'
        ? 'sample.auth.guide.lsp'
        : route.displayMode === 'SECONDARY' && route.workspace === 'MAIN'
          ? 'sample.auth.guide.lms'
          : null;
  if (partKey === null) return Promise.reject(new Error('[sample-staff-auth] login stage route is unavailable'));
  return context.dispatchCommand(
    showScreenCommand,
    {workspace: route.workspace, displayMode: route.displayMode, containerKey: 'main', partKey},
    {routeContext: route},
  );
};
