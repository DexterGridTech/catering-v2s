const RUN_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export type AndroidAutomationBuildIdentity = Readonly<{
  readonly packageId: string;
  readonly applicationIdSuffix: string;
}>;

export type AndroidAutomationBuildType = 'debug' | 'release';

export const androidAutomationBuildIdentity = (
  runId: string,
  sample: 'console' | 'wallpaper' = 'console',
): AndroidAutomationBuildIdentity => {
  if (!RUN_UUID.test(runId)) throw new Error('TERMINAL_AUTOMATION_ANDROID_RUN_ID_INVALID');
  if (sample !== 'console' && sample !== 'wallpaper') throw new Error('TERMINAL_AUTOMATION_SAMPLE_INVALID');
  const suffix = `.terauto${runId.replaceAll('-', '').slice(-8).toLowerCase()}`;
  const basePackageId =
    sample === 'console' ? 'com.anonymous.sampleterminal' : 'com.catering.v2s.terminal.samplewallpaper';
  return Object.freeze({
    packageId: `${basePackageId}${suffix}`,
    applicationIdSuffix: suffix,
  });
};

export const androidAutomationGradleArguments = (
  applicationIdSuffix: string,
  runBuildDirectory: string,
  buildType: AndroidAutomationBuildType = 'debug',
): readonly string[] => {
  if (!/^\.terauto[a-f0-9]{8}$/u.test(applicationIdSuffix)) {
    throw new Error('TERMINAL_AUTOMATION_APPLICATION_ID_SUFFIX_INVALID');
  }
  if (!runBuildDirectory.startsWith('/') || runBuildDirectory.includes('\n')) {
    throw new Error('TERMINAL_AUTOMATION_ANDROID_BUILD_DIRECTORY_INVALID');
  }
  if (buildType !== 'debug' && buildType !== 'release') {
    throw new Error('TERMINAL_AUTOMATION_ANDROID_BUILD_TYPE_INVALID');
  }
  return Object.freeze([
    buildType === 'release' ? ':app:assembleRelease' : ':app:assembleDebug',
    '--no-daemon',
    '--console=plain',
    '--no-build-cache',
    '--rerun-tasks',
    '-PterDisableNativeDevSupport=true',
    `-PterAutomationApplicationIdSuffix=${applicationIdSuffix}`,
    `-PterAutomationBuildDir=${runBuildDirectory}`,
  ]);
};
