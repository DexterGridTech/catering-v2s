import type {FixedUpdateTarget, UpdateTargetSourceProvider} from '@catering-v2s/kernel-base-terminal-update';

/**
 * Supplies the run-scoped update descriptor used only by the managed Android
 * automation build. Product update policy remains in the terminal-update owner.
 */
export const createAndroidAutomationUpdateTargetSourceProvider = (): UpdateTargetSourceProvider | undefined => {
  const targetUrl = process.env.EXPO_PUBLIC_TER_AUTOMATION_UPDATE_TARGET_URL;
  if (process.env.EXPO_PUBLIC_TER_AUTOMATION_BUILD !== 'true' || targetUrl === undefined) return undefined;
  const runId = process.env.EXPO_PUBLIC_TER_AUTOMATION_RUN_ID;
  const applicationId = process.env.EXPO_PUBLIC_TER_AUTOMATION_ANDROID_PACKAGE_ID;
  const revision = process.env.EXPO_PUBLIC_TER_AUTOMATION_UPDATE_REVISION ?? 'default';
  if (!runId || !applicationId) throw new Error('TERMINAL_AUTOMATION_UPDATE_SOURCE_CONFIG_INCOMPLETE');
  if (!/^[a-z0-9-]{1,32}$/u.test(revision)) throw new Error('TERMINAL_AUTOMATION_UPDATE_REVISION_INVALID');
  const url = new URL(targetUrl);
  if (
    url.protocol !== 'http:' ||
    url.hostname !== '127.0.0.1' ||
    url.username ||
    url.password ||
    url.hash ||
    url.search
  ) {
    throw new Error('TERMINAL_AUTOMATION_UPDATE_TARGET_URL_INVALID');
  }
  const descriptorUrl = new URL(url);
  descriptorUrl.searchParams.set('revision', revision);
  // The fixed task survives an APK replacement, while this adapter is recreated
  // with the new JS runtime. Rebuild run-owned paths from build identity.
  const sourcePaths = new Map<string, string>([
    [`full-${runId}`, '/full.zip'],
    [`hot-${runId}`, '/hot.zip'],
  ]);
  const provider: UpdateTargetSourceProvider = {
    readTarget: async (selectionContext: FixedUpdateTarget['selectionContext']) => {
      if (selectionContext.selectedSpace !== 'development' || selectionContext.contextIdentity !== runId) return null;
      const response = await fetch(descriptorUrl.toString());
      if (!response.ok) return null;
      const bytes = await response.arrayBuffer();
      if (bytes.byteLength > 256 * 1024) throw new Error('TERMINAL_AUTOMATION_UPDATE_TARGET_TOO_LARGE');
      const value: unknown = JSON.parse(new TextDecoder().decode(bytes));
      if (typeof value !== 'object' || value === null || !('target' in value) || !('sourcePaths' in value)) return null;
      const document = value as {target?: FixedUpdateTarget; sourcePaths?: Record<string, unknown>};
      if (
        document.target === undefined ||
        document.target.applicationId !== applicationId ||
        document.target.ruleRef !== `automation-${runId}` ||
        typeof document.sourcePaths !== 'object' ||
        document.sourcePaths === null ||
        Array.isArray(document.sourcePaths)
      )
        return null;
      for (const source of [document.target.full, document.target.hot]) {
        if (source === null) continue;
        const sourcePath = document.sourcePaths[source.sourceRef];
        const expectedPath = sourcePaths.get(source.sourceRef);
        if (
          typeof sourcePath !== 'string' ||
          !sourcePath.startsWith('/') ||
          sourcePath.startsWith('//') ||
          sourcePath.includes('\\') ||
          /(?:^|\/)\.\.?\//u.test(sourcePath) ||
          sourcePath !== expectedPath
        )
          return null;
      }
      return document.target;
    },
    resolveSourcePath: (sourceRef: string) => sourcePaths.get(sourceRef) ?? null,
  };
  return Object.freeze(provider);
};
