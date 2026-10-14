import {
  closeLayerCommand,
  showScreenCommand,
} from '@catering-v2s/kernel-base-ui-state';
import type {ActorExecutionContext} from '@catering-v2s/kernel-base-runtime';
import type {CommandRouteContext} from '@catering-v2s/kernel-base-contracts';
import {selectTopologyFacts} from '@catering-v2s/kernel-base-topology';
import {selectRuntimeInstanceMode} from '@catering-v2s/kernel-base-runtime';
import {selectHostPendingMember} from '@catering-v2s/kernel-feature-sample-member-registry';

export const primary = 'PRIMARY' as const;
export const secondary = 'SECONDARY' as const;
export const main = 'main' as const;

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

export const hasSecondarySurface = (context: ActorExecutionContext): boolean => {
  const facts = selectTopologyFacts(context.getState());
  return facts?.hasTopologySecondarySurface === true;
};

export const isBranchWorkspace = (context: ActorExecutionContext): boolean => {
  const facts = selectTopologyFacts(context.getState());
  return facts?.instanceMode === 'SLAVE' && facts.displayRole === 'CHIEF';
};

export const memberListPart = (context: ActorExecutionContext): string =>
  isBranchWorkspace(context) ? 'sample.desk.branch.member-list' : 'sample.desk.member-list';

export const memberPart = (context: ActorExecutionContext, part: string): string =>
  isBranchWorkspace(context) ? `sample.desk.branch.${part}` : `sample.desk.${part}`;

export const show = (
  input: Readonly<{
    context: ActorExecutionContext;
    displayMode: typeof primary | typeof secondary;
    partKey: string;
    props?: Readonly<Record<string, string>>;
    routeContext?: CommandRouteContext;
  }>,
) => {
  const payload = {
    displayMode: input.displayMode,
    containerKey: main,
    partKey: input.partKey,
    ...(input.routeContext?.workspace === undefined ? {} : {workspace: input.routeContext.workspace}),
    ...(input.props === undefined ? {} : {props: input.props}),
  };
  const dispatch =
    input.routeContext === undefined
      ? input.context.dispatchCommand(showScreenCommand, payload)
      : input.context.dispatchCommand(showScreenCommand, payload, {routeContext: input.routeContext});
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

export const closePrimaryLayer = (context: ActorExecutionContext, layerId: string) =>
  context.dispatchCommand(closeLayerCommand, {displayMode: primary, layerId});

export const returnToList = async (context: ActorExecutionContext, secondarySurface: boolean): Promise<void> => {
  await show({context, displayMode: primary, partKey: memberListPart(context)});
  if (isBranchWorkspace(context)) return;
  if (secondarySurface) await show({context, displayMode: secondary, partKey: 'sample.desk.customer-welcome'});
};

export const returnToForm = async (context: ActorExecutionContext): Promise<void> => {
  await show({context, displayMode: primary, partKey: memberPart(context, 'member-form')});
};

export const isSlaveRuntime = (context: ActorExecutionContext): boolean =>
  selectRuntimeInstanceMode(context.getState()) === 'SLAVE';

export const selectDeskHostPendingMember = (context: ActorExecutionContext) =>
  selectHostPendingMember(context.getState());
