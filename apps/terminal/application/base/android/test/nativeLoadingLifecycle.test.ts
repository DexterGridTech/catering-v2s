import {readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';

const moduleSource = readFileSync(
  new URL(
    '../android/src/main/java/com/catering/v2s/terminal/application/base/android/TerminalNativeLoadingModule.kt',
    import.meta.url,
  ),
  'utf8',
);
const registrySource = readFileSync(
  new URL(
    '../android/src/main/java/com/catering/v2s/terminal/application/base/android/TerminalNativeLoadingRegistry.kt',
    import.meta.url,
  ),
  'utf8',
);

describe('native loading Application lifecycle ownership', () => {
  it('keeps JS-facing operations asynchronous and free of blocking waits', () => {
    expect(/AsyncFunction\("beginHide"\) Coroutine/.test(moduleSource)).toBe(true);
    expect(/AsyncFunction\("releaseHide"\) Coroutine/.test(moduleSource)).toBe(true);
    expect(/runBlocking\b|CountDownLatch|Thread\.sleep\s*\(|\.get\s*\(/.test(moduleSource)).toBe(false);
  });

  it('keeps Activity callbacks process-owned across Expo module destruction and removes only destroyed Activities', () => {
    expect(/OnCreate\s*\{[\s\S]*?TerminalNativeLoadingRegistry::registerApplication/.test(moduleSource)).toBe(true);
    expect(/OnDestroy\s*\{/.test(moduleSource)).toBe(false);
    expect(/onActivityDestroyed\(activity: Activity\)[\s\S]*?removeOnMain\(activity\)/.test(registrySource)).toBe(true);
    expect(/registeredApplication === application/.test(registrySource)).toBe(true);
    expect(/registerActivityLifecycleCallbacks\(lifecycleCallbacks\)/.test(registrySource)).toBe(true);
    expect(
      /registeredApplication\?\.unregisterActivityLifecycleCallbacks\(lifecycleCallbacks\)/.test(registrySource),
    ).toBe(true);
  });
});
