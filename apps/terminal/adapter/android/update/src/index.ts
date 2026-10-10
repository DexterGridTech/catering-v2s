import {requireNativeModule} from 'expo-modules-core';
import {AppState} from 'react-native';
export {moduleName} from './moduleName';
export {dependencyModuleNames, devDependencyModuleNames} from './dependencies';
import type {
  PortResult,
  UpdateAction,
  UpdateActionInput,
  UpdateCall,
  UpdateFacts,
  UpdatePort,
  UpdatePresentation,
  UpdatePresentationListener,
  PrepareUpdateArtifactInput,
  UpdateInstallerConfirmationResult,
  UpdateInstallerConfirmationTrigger,
} from '@catering-v2s/kernel-base-platform-ports';

type NativeUpdateModule = Readonly<{
  readFacts: () => Promise<UpdateFacts>;
  prepareArtifact: (
    downloadUrl: string,
    timeoutMs: number,
    expectedSha256: string,
    artifactJson: string,
    kind: 'full' | 'hot',
    downloadGrant: string | null,
    proxy: Readonly<Record<string, unknown>> | null,
  ) => Promise<Readonly<{preparedId: string}>>;
  applyPrepared: (taskId: string, actionId: string, preparedId: string, kind: 'full' | 'hot') => Promise<UpdateAction>;
  readAction: (taskId: string, actionId: string) => Promise<UpdateAction | null>;
  presentInstallerConfirmation: (
    taskId: string,
    actionId: string,
    publicationId: string,
    trigger: UpdateInstallerConfirmationTrigger,
  ) => Promise<UpdateInstallerConfirmationResult>;
  confirmBoot: (bootToken: string, publicationId: string) => Promise<Readonly<{confirmed: true}>>;
  releasePrepared: (preparedId: string) => Promise<Readonly<{released: boolean}>>;
}>;

const native = (): NativeUpdateModule => requireNativeModule<NativeUpdateModule>('TerminalUpdate');
const failed = <TValue>(capability: string, code = 'NATIVE_UPDATE_OPERATION_FAILED'): PortResult<TValue> =>
  Object.freeze({
    status: 'failed',
    port: 'update',
    capability,
    error: Object.freeze({
      code,
      message: 'native update operation failed',
      retryable: true,
    }),
  });

const nativeFailureCode = (error: unknown): string => {
  if (error instanceof Error && /^TERMINAL_UPDATE_[A-Z0-9_]{1,96}$/u.test(error.message)) return error.message;
  return 'NATIVE_UPDATE_OPERATION_FAILED';
};

const invoke = async <TValue>(capability: string, operation: () => Promise<TValue>): Promise<PortResult<TValue>> => {
  try {
    return Object.freeze({
      status: 'succeeded',
      value: await operation(),
      completedAt: Date.now() as Extract<PortResult<TValue>, {status: 'succeeded'}>['completedAt'],
    });
  } catch (error) {
    return failed(capability, nativeFailureCode(error));
  }
};

const toUpdatePresentation = (state: string | null | undefined): UpdatePresentation => {
  if (state === 'active') return 'foreground';
  if (state === 'background' || state === 'inactive') return 'background';
  return 'unknown';
};

const resolveDownloadUrl = (baseUrl: string, sourcePath: string): string => {
  if (
    !sourcePath.startsWith('/') ||
    sourcePath.startsWith('//') ||
    sourcePath.includes('\\') ||
    /(?:^|\/)\.\.?\//u.test(sourcePath)
  )
    throw new Error('TERMINAL_UPDATE_SOURCE_PATH_INVALID');
  const origin = new URL(baseUrl);
  const resolved = new URL(sourcePath, origin);
  if (
    (origin.protocol !== 'http:' && origin.protocol !== 'https:') ||
    resolved.origin !== origin.origin ||
    resolved.username !== '' ||
    resolved.password !== '' ||
    resolved.hash !== ''
  )
    throw new Error('TERMINAL_UPDATE_SOURCE_ORIGIN_INVALID');
  return resolved.toString();
};

/** Composition supplies the current server-config snapshot to each prepare call. */
export const createAndroidUpdatePort = (): UpdatePort =>
  Object.freeze({
    readPresentation: async (_input: UpdateCall) =>
      invoke('readPresentation', async () => toUpdatePresentation(AppState.currentState)),
    subscribePresentation: (listener: UpdatePresentationListener) => {
      if (!AppState.isAvailable) return () => undefined;
      const subscription = AppState.addEventListener('change', state => listener(toUpdatePresentation(state)));
      return () => subscription.remove();
    },
    readFacts: async (_input: UpdateCall) => invoke('readFacts', () => native().readFacts()),
    prepareArtifact: async (input: PrepareUpdateArtifactInput) =>
      invoke('prepareArtifact', async () => {
        const address = input.network.addresses[0];
        if (address === undefined) throw new Error('TERMINAL_UPDATE_SERVER_ADDRESS_MISSING');
        const prepared = await native().prepareArtifact(
          resolveDownloadUrl(address.baseUrl, input.sourcePath),
          input.timeoutMs,
          input.expectedSha256,
          JSON.stringify(input.artifact),
          input.kind,
          input.downloadGrant ?? null,
          input.network.proxy === undefined
            ? null
            : (input.network.proxy as unknown as Readonly<Record<string, unknown>>),
        );
        return Object.freeze({preparedId: prepared.preparedId, artifact: input.artifact});
      }),
    applyPrepared: async (input: UpdateActionInput) =>
      invoke('applyPrepared', () => native().applyPrepared(input.taskId, input.actionId, input.preparedId, input.kind)),
    readAction: async (input: UpdateCall & Readonly<{taskId: string; actionId: string}>) =>
      invoke('readAction', () => native().readAction(input.taskId, input.actionId)),
    presentInstallerConfirmation: async (
      input: UpdateCall & Readonly<{
        taskId: string;
        actionId: string;
        publicationId: string;
        trigger: UpdateInstallerConfirmationTrigger;
      }>,
    ) =>
      invoke('presentInstallerConfirmation', () =>
        native().presentInstallerConfirmation(input.taskId, input.actionId, input.publicationId, input.trigger),
      ),
    confirmBoot: async (input: UpdateCall & Readonly<{bootToken: string; publicationId: string}>) =>
      invoke('confirmBoot', () => native().confirmBoot(input.bootToken, input.publicationId)),
    releasePrepared: async (input: UpdateCall & Readonly<{preparedId: string}>) =>
      invoke('releasePrepared', () => native().releasePrepared(input.preparedId)),
  });
