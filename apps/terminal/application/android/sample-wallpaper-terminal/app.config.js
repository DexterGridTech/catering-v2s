const app = require('./app.json').expo;
const packageJson = require('./package.json');
const release = packageJson.terminalRelease;
const automationSuffix = process.env.TERMINAL_AUTOMATION_ANDROID_APPLICATION_ID_SUFFIX;
if (automationSuffix !== undefined && !/^\.terauto[a-f0-9]{8}$/u.test(automationSuffix)) {
  throw new Error('TERMINAL_AUTOMATION_APPLICATION_ID_SUFFIX_INVALID');
}
const automationBuildNumber = process.env.TERMINAL_AUTOMATION_FULL_NATIVE_BUILD_NUMBER;
const automationBundleVersion = process.env.TERMINAL_AUTOMATION_UPDATE_BUNDLE_VERSION;
const buildRelease = {
  ...release,
  ...(automationBuildNumber === undefined ? {} : {nativeBuildNumber: Number(automationBuildNumber)}),
  ...(automationBundleVersion === undefined ? {} : {bundleVersion: automationBundleVersion}),
};
if (
  automationBuildNumber !== undefined &&
  (!Number.isSafeInteger(buildRelease.nativeBuildNumber) || buildRelease.nativeBuildNumber < release.nativeBuildNumber)
) {
  throw new Error('TERMINAL_AUTOMATION_UPDATE_NATIVE_BUILD_NUMBER_INVALID');
}
if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/u.test(buildRelease.bundleVersion)) {
  throw new Error('TERMINAL_AUTOMATION_UPDATE_BUNDLE_VERSION_INVALID');
}

module.exports = {
  expo: {
    ...app,
    version: packageJson.version,
    runtimeVersion: buildRelease.runtimeVersion,
    android: {
      ...app.android,
      ...(automationSuffix === undefined ? {} : {package: `${app.android.package}${automationSuffix}`}),
      versionCode: buildRelease.nativeBuildNumber,
    },
    extra: {
      ...app.extra,
      terminalRelease: buildRelease,
    },
  },
};
