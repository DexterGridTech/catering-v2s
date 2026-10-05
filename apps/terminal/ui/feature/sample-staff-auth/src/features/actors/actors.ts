import {
  clearLayersCommand,
  closeLayerCommand,
  createUiVariableWrite,
  openLayerCommand,
  selectLayers,
  setUiVariablesCommand,
  showScreenCommand,
  isCurrentWorkspaceOwnedByInstance,
} from '@catering-v2s/kernel-base-ui-state';
import {
  defineActor,
  onCommand,
  type ActorDefinition,
  type ActorExecutionContext,
} from '@catering-v2s/kernel-base-runtime';
import {
  loginFailedCommand,
  loginSucceededCommand,
  logoutSucceededCommand,
} from '@catering-v2s/kernel-feature-sample-staff-session';
import {selectDisplayRole} from '@catering-v2s/kernel-base-display-context';
import {
  authNoticeDismissedCommand,
  authSystemFailureDismissedCommand,
  authSystemFailureObservedCommand,
  needToLoginStaffCommand,
} from '../commands/commands';
import {moduleName} from '../../moduleName';
import {operatorNameVariable} from '../variables/variables';

const primary = 'PRIMARY' as const;

const isContentOwner = (context: ActorExecutionContext): boolean =>
  isCurrentWorkspaceOwnedByInstance(context.getState());

const showLoginStage = (context: ActorExecutionContext): Promise<unknown> => {
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

export const createAuthResultActor = (): ActorDefinition =>
  defineActor(moduleName, 'auth-result', [
    onCommand(loginFailedCommand, async context => {
      if (!isContentOwner(context)) return null;
      await context.dispatchCommand(openLayerCommand, {
        displayMode: primary,
        layerId: 'sample.auth.notice',
        partKey: 'sample.auth.notice',
        props: {reasonCode: context.command.payload.reasonCode},
      });
      return null;
    }),
  ]);

export const createAuthNavigationActor = (): ActorDefinition =>
  defineActor(moduleName, 'auth-navigation', [
    onCommand(needToLoginStaffCommand, async context => {
      if (!isContentOwner(context)) return null;
      await showLoginStage(context);
      return null;
    }),
    onCommand(logoutSucceededCommand, async context => {
      if (!isContentOwner(context)) return null;
      await context.dispatchCommand(clearLayersCommand, {displayMode: primary});
      return null;
    }),
    onCommand(loginSucceededCommand, async context => {
      if (!isContentOwner(context)) return null;
      await context.dispatchCommand(setUiVariablesCommand, {
        entries: [createUiVariableWrite(operatorNameVariable, context.command.payload.operatorName)],
      });
      await context.dispatchCommand(clearLayersCommand, {displayMode: primary});
      return null;
    }),
  ]);

export const createAuthNoticeActor = (): ActorDefinition =>
  defineActor(moduleName, 'auth-notice', [
    onCommand(authNoticeDismissedCommand, async context => {
      if (!isContentOwner(context)) return null;
      await context.dispatchCommand(closeLayerCommand, {
        displayMode: primary,
        layerId: 'sample.auth.notice',
      });
      return null;
    }),
  ]);

export const createAuthSystemNoticeActor = (): ActorDefinition =>
  defineActor(moduleName, 'auth-system-notice', [
    onCommand(authSystemFailureObservedCommand, async context => {
      if (!isContentOwner(context)) return null;
      const hasNotice = selectLayers(context.getState(), primary).some(
        layer => layer.layerId === 'sample.auth.system-notice',
      );
      if (hasNotice) return null;
      await context.dispatchCommand(openLayerCommand, {
        displayMode: primary,
        layerId: 'sample.auth.system-notice',
        partKey: 'sample.auth.system-notice',
        props: {operation: context.command.payload.operation},
        persistence: 'ephemeral',
      });
      return null;
    }),
    onCommand(authSystemFailureDismissedCommand, async context => {
      if (!isContentOwner(context)) return null;
      await context.dispatchCommand(closeLayerCommand, {
        displayMode: primary,
        layerId: 'sample.auth.system-notice',
      });
      return null;
    }),
  ]);
