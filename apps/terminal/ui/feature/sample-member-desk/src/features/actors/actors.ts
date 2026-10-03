import {
  clearLayersCommand,
  closeLayerCommand,
  isCurrentWorkspaceOwnedByInstance,
  openLayerCommand,
  selectLayers,
  showScreenCommand,
} from '@catering-v2s/kernel-base-ui-state';
import {
  defineActor,
  onCommand,
  type ActorDefinition,
  type ActorExecutionContext,
} from '@catering-v2s/kernel-base-runtime';
import {
  logoutCommand as staffLogoutCommand,
} from '@catering-v2s/kernel-feature-sample-staff-session';
import {
  memberConfirmedCommand as registryMemberConfirmedCommand,
  memberPendingCommand as registryMemberPendingCommand,
  memberRejectedCommand as registryMemberRejectedCommand,
  memberWithdrawnCommand as registryMemberWithdrawnCommand,
  selectHostPendingMember,
  selectPendingMember,
  withdrawMemberCommand as registryWithdrawMemberCommand,
} from '@catering-v2s/kernel-feature-sample-member-registry';
import {selectTopologyFacts} from '@catering-v2s/kernel-base-topology';
import {
  deskSystemFailureDismissedCommand,
  deskSystemFailureObservedCommand,
  memberDraftDiscardedCommand,
  memberFormCancelledCommand,
  memberFormOpenedCommand,
  memberRegistrationAbandonedCommand,
  memberRegistrationRetryRequestedCommand,
  memberSubmissionWithdrawnCommand,
  startMemberDeskCommand,
} from '../commands/commands';
import {moduleName} from '../../moduleName';

const primary = 'PRIMARY' as const;
const secondary = 'SECONDARY' as const;
const main = 'main' as const;

const navigationLog = (
  context: ActorExecutionContext,
  event: string,
  data: Readonly<Record<string, string | boolean | number | null>>,
): void => {
  context.platformPorts.logger.info({
    category: 'sample.member-desk.navigation',
    event,
    message:
      event === 'show-screen-failed'
        ? `Member desk navigation failed: ${data.errorCode ?? data.errorType ?? 'unknown'}`
        : 'Member desk navigation decision observed',
    data,
  });
};

const readErrorField = (error: unknown, field: string): string | null => {
  if (typeof error !== 'object' || error === null) return null;
  const value = (error as Record<string, unknown>)[field];
  return typeof value === 'string' ? value : null;
};

const boundedErrorMessage = (error: unknown): string | null => {
  const message = readErrorField(error, 'message');
  if (message === null) return null;
  if (/(password|passcode|otp|token|cookie|authorization|phone|address|ip)/i.test(message)) return '[redacted]';
  return message.slice(0, 160);
};

const navigationErrorData = (error: unknown): Readonly<Record<string, string | null>> => ({
  errorType: error instanceof Error ? error.name : typeof error,
  errorName: readErrorField(error, 'name'),
  errorCode: readErrorField(error, 'code'),
  errorKey: readErrorField(error, 'key'),
  errorCategory: readErrorField(error, 'category'),
  errorMessage: boundedErrorMessage(error),
});

const hasSecondarySurface = (context: ActorExecutionContext): boolean => {
  const facts = selectTopologyFacts(context.getState());
  return facts?.hasTopologySecondarySurface === true;
};

const isBranchWorkspace = (context: ActorExecutionContext): boolean => {
  const facts = selectTopologyFacts(context.getState());
  return facts?.instanceMode === 'SLAVE' && facts.displayRole === 'CHIEF';
};

const memberListPart = (context: ActorExecutionContext): string =>
  isBranchWorkspace(context) ? 'sample.desk.branch.member-list' : 'sample.desk.member-list';

const show = (
  input: Readonly<{
    context: ActorExecutionContext;
    displayMode: typeof primary | typeof secondary;
    partKey: string;
    props?: Readonly<Record<string, string>>;
  }>,
) => {
  const dispatch = input.context.dispatchCommand(showScreenCommand, {
    displayMode: input.displayMode,
    containerKey: main,
    partKey: input.partKey,
    ...(input.props === undefined ? {} : {props: input.props}),
  });
  return dispatch.then(
    result => {
      navigationLog(input.context, 'show-screen-result', {
        displayMode: input.displayMode,
        partKey: input.partKey,
        status: result.status,
      });
      return result;
    },
    error => {
      navigationLog(input.context, 'show-screen-failed', {
        displayMode: input.displayMode,
        partKey: input.partKey,
        status: 'rejected',
        ...navigationErrorData(error),
      });
      throw error;
    },
  );
};

const closePrimaryLayer = (context: ActorExecutionContext, layerId: string) =>
  context.dispatchCommand(closeLayerCommand, {displayMode: primary, layerId});

const returnToList = async (context: ActorExecutionContext, secondarySurface: boolean): Promise<void> => {
  await show({context, displayMode: primary, partKey: memberListPart(context)});
  if (isBranchWorkspace(context)) return;
  if (secondarySurface) await show({context, displayMode: secondary, partKey: 'sample.desk.customer-welcome'});
};

const returnToForm = async (context: ActorExecutionContext): Promise<void> => {
  await show({context, displayMode: primary, partKey: 'sample.desk.member-form'});
};

export const createDeskNavigationActor = (): ActorDefinition =>
  defineActor(moduleName, 'desk-navigation', [
    onCommand(startMemberDeskCommand, async context => {
      if (!isCurrentWorkspaceOwnedByInstance(context.getState())) return null;
      const route = context.command.routeContext;
      const isMainCustomerSurface =
        route?.workspace === 'MAIN' &&
        route.displayMode === 'SECONDARY' &&
        (route.instanceMode === 'MASTER' || route.instanceMode === 'SLAVE');
      if (isMainCustomerSurface) {
        const pendingMember = selectHostPendingMember(context.getState());
        await show({
          context,
          displayMode: secondary,
          partKey: pendingMember === null ? 'sample.desk.customer-welcome' : 'sample.desk.customer-member',
          ...(pendingMember === null ? {} : {props: {mode: 'confirm'}}),
        });
        return null;
      }
      await show({context, displayMode: primary, partKey: memberListPart(context)});
      if (route === null && !isBranchWorkspace(context) && hasSecondarySurface(context))
        await show({context, displayMode: secondary, partKey: 'sample.desk.customer-welcome'});
      return null;
    }),
  ]);

export const createDeskFormActor = (): ActorDefinition =>
  defineActor(moduleName, 'desk-form', [
    onCommand(memberFormOpenedCommand, async context => {
      if (!isCurrentWorkspaceOwnedByInstance(context.getState())) return null;
      await show({
        context,
        displayMode: primary,
        partKey: isBranchWorkspace(context) ? 'sample.desk.branch.member-form' : 'sample.desk.member-form',
      });
      return null;
    }),
  ]);

export const createDeskPendingActor = (): ActorDefinition =>
  defineActor(moduleName, 'desk-pending', [
    onCommand(registryMemberPendingCommand, async context => {
      if (!isCurrentWorkspaceOwnedByInstance(context.getState())) return null;
      if (selectPendingMember(context.getState())?.operationId !== context.command.payload.operationId) return null;
      if (isBranchWorkspace(context)) {
        await show({context, displayMode: primary, partKey: 'sample.desk.branch.customer-member'});
        return null;
      }
      const secondarySurface = hasSecondarySurface(context);
      if (secondarySurface) {
        await show({context, displayMode: primary, partKey: 'sample.desk.member-list'});
        await context.dispatchCommand(openLayerCommand, {
          displayMode: primary,
          layerId: 'sample.desk.waiting-confirm',
          partKey: 'sample.desk.waiting-confirm',
        });
        await show({context, displayMode: secondary, partKey: 'sample.desk.customer-member', props: {mode: 'confirm'}});
        return null;
      }
      await show({
        context,
        displayMode: primary,
        partKey: 'sample.desk.customer-member',
        props: {mode: 'handheld-confirm'},
      });
      return null;
    }),
    onCommand(memberSubmissionWithdrawnCommand, async context => {
      if (!isCurrentWorkspaceOwnedByInstance(context.getState())) return null;
      await context.dispatchCommand(registryWithdrawMemberCommand, {operationId: context.command.payload.operationId});
      return null;
    }),
  ]);

export const createDeskConfirmedActor = (): ActorDefinition =>
  defineActor(moduleName, 'desk-confirmed', [
    onCommand(registryMemberConfirmedCommand, async context => {
      if (!isCurrentWorkspaceOwnedByInstance(context.getState())) return null;
      const pending = selectPendingMember(context.getState());
      if (pending !== null && pending.operationId !== context.command.payload.memberId) return null;
      const secondarySurface = hasSecondarySurface(context);
      await returnToList(context, secondarySurface);
      if (secondarySurface) {
        await closePrimaryLayer(context, 'sample.desk.waiting-confirm');
      }
      return null;
    }),
  ]);

export const createDeskRejectedActor = (): ActorDefinition =>
  defineActor(moduleName, 'desk-rejected', [
    onCommand(registryMemberRejectedCommand, async context => {
      if (!isCurrentWorkspaceOwnedByInstance(context.getState())) return null;
      if (selectPendingMember(context.getState())?.operationId !== context.command.payload.operationId) return null;
      await context.dispatchCommand(openLayerCommand, {
        displayMode: primary,
        layerId: 'sample.desk.registry-notice',
        partKey: 'sample.desk.registry-notice',
        props: {reasonCode: context.command.payload.reasonCode},
      });
      if (hasSecondarySurface(context)) {
        await show({context, displayMode: secondary, partKey: 'sample.desk.customer-welcome'});
      } else {
        await show({context, displayMode: primary, partKey: 'sample.desk.member-form'});
      }
      return null;
    }),
  ]);

export const createDeskNoticeActor = (): ActorDefinition =>
  defineActor(moduleName, 'desk-notice', [
    onCommand(memberFormCancelledCommand, async context => {
      if (!isCurrentWorkspaceOwnedByInstance(context.getState())) return null;
      const secondarySurface = hasSecondarySurface(context);
      if (context.command.payload.dirty) {
        await context.dispatchCommand(openLayerCommand, {
          displayMode: primary,
          layerId: 'sample.desk.discard-confirm',
          partKey: 'sample.desk.discard-confirm',
          props: {intent: 'cancel-form'},
        });
        return null;
      }
      await returnToList(context, secondarySurface);
      return null;
    }),
    onCommand(memberDraftDiscardedCommand, async context => {
      if (!isCurrentWorkspaceOwnedByInstance(context.getState())) return null;
      await closePrimaryLayer(context, 'sample.desk.discard-confirm');
      if (context.command.payload.intent === 'logout') {
        await context.dispatchCommand(staffLogoutCommand, {});
        return null;
      }
      await returnToList(context, hasSecondarySurface(context));
      return null;
    }),
    onCommand(memberRegistrationRetryRequestedCommand, async context => {
      if (!isCurrentWorkspaceOwnedByInstance(context.getState())) return null;
      await closePrimaryLayer(context, 'sample.desk.registry-notice');
      const secondarySurface = hasSecondarySurface(context);
      if (secondarySurface) await closePrimaryLayer(context, 'sample.desk.waiting-confirm');
      await returnToForm(context);
      return null;
    }),
    onCommand(memberRegistrationAbandonedCommand, async context => {
      if (!isCurrentWorkspaceOwnedByInstance(context.getState())) return null;
      const pending = selectPendingMember(context.getState());
      if (pending === null) return null;
      await context.dispatchCommand(registryWithdrawMemberCommand, {operationId: pending.operationId});
      await closePrimaryLayer(context, 'sample.desk.registry-notice');
      const secondarySurface = hasSecondarySurface(context);
      if (secondarySurface) await closePrimaryLayer(context, 'sample.desk.waiting-confirm');
      await returnToList(context, secondarySurface);
      return null;
    }),
    onCommand(registryMemberWithdrawnCommand, async context => {
      if (!isCurrentWorkspaceOwnedByInstance(context.getState())) return null;
      const pending = selectPendingMember(context.getState());
      if (pending !== null && pending.operationId !== context.command.payload.operationId) return null;
      const hasWithdrawConfirmation = selectLayers(context.getState(), primary).some(
        layer => layer.layerId === 'sample.desk.withdraw-confirm',
      );
      const secondarySurface = hasSecondarySurface(context);
      if (!hasWithdrawConfirmation && secondarySurface) return null;
      if (secondarySurface) {
        await closePrimaryLayer(context, 'sample.desk.withdraw-confirm');
        await closePrimaryLayer(context, 'sample.desk.waiting-confirm');
        await show({context, displayMode: secondary, partKey: 'sample.desk.customer-welcome'});
      }
      await returnToForm(context);
      return null;
    }),
  ]);

export const createDeskSystemNoticeActor = (): ActorDefinition =>
  defineActor(moduleName, 'desk-system-notice', [
    onCommand(deskSystemFailureObservedCommand, async context => {
      if (!isCurrentWorkspaceOwnedByInstance(context.getState())) return null;
      const hasNotice = selectLayers(context.getState(), primary).some(
        layer => layer.layerId === 'sample.desk.system-notice',
      );
      if (hasNotice) return null;
      await context.dispatchCommand(openLayerCommand, {
        displayMode: primary,
        layerId: 'sample.desk.system-notice',
        partKey: 'sample.desk.system-notice',
        props: {operation: context.command.payload.operation},
        persistence: 'ephemeral',
      });
      return null;
    }),
    onCommand(deskSystemFailureDismissedCommand, async context => {
      if (!isCurrentWorkspaceOwnedByInstance(context.getState())) return null;
      await closePrimaryLayer(context, 'sample.desk.system-notice');
      return null;
    }),
  ]);
