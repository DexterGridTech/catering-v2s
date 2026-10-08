import {describe, expect, it} from 'vitest';
import {createAndroidSystemUi, findAndroidSystemUiButton} from '../src/androidSystemUi.ts';

const xml = (nodes: string): string => `<hierarchy rotation="0">${nodes}</hierarchy>`;

describe('Android system UI installer controls', () => {
  it('selects exactly one enabled clickable button and decodes XML text', () => {
    expect(findAndroidSystemUiButton(xml(
      '<node package="com.android.packageinstaller" text="Install &amp; update" enabled="true" clickable="true" bounds="[2,4][22,34]" />',
    ), ['Install & update'])).toMatchObject({
      label: 'Install & update', packageName: 'com.android.packageinstaller', bounds: {left: 2, top: 4, right: 22, bottom: 34},
      targetClass: 'UNKNOWN', labelClass: 'UNKNOWN', ancestorDistance: 0,
      targetClickable: true, targetEnabled: true, stateSource: 'unknown',
    });
  });

  it('selects a same-labeled system control only from the expected package', () => {
    const hierarchy = xml(
      '<node package="com.anonymous.sampleterminal" text="Settings" enabled="true" clickable="true" bounds="[1,2][21,32]" />' +
      '<node package="com.google.android.packageinstaller" text="Update" enabled="true" clickable="true" bounds="[3,4][23,34]" />',
    );
    expect(findAndroidSystemUiButton(hierarchy, ['Update', 'Settings'], ['com.google.android.packageinstaller']))
      .toMatchObject({label: 'Update', packageName: 'com.google.android.packageinstaller'});
    expect(() => findAndroidSystemUiButton(hierarchy, ['Settings'], ['com.google.android.packageinstaller']))
      .toThrow('BUTTON_MATCH_COUNT_0');
  });

  it('matches Android system labels without depending on the ROM text casing', () => {
    const hierarchy = xml(
      '<node package="com.android.packageinstaller" text="UPDATE" enabled="true" clickable="true" bounds="[1,2][21,32]" />',
    );
    expect(findAndroidSystemUiButton(hierarchy, ['Install', 'Update'], ['com.android.packageinstaller']))
      .toMatchObject({label: 'Update', packageName: 'com.android.packageinstaller'});
  });

  it('matches Chinese Android installer labels while retaining the canonical action name', () => {
    const hierarchy = xml(
      '<node package="com.android.settings" class="com.android.settingslib.widget.MainSwitchPreference" ' +
      'clickable="true" enabled="true" bounds="[1,2][101,42]">' +
      '<node class="android.widget.TextView" text="允许来自此来源的应用" clickable="false" enabled="true" ' +
      'bounds="[8,8][80,28]" />' +
      '<node class="android.widget.Switch" checkable="true" clickable="false" enabled="true" ' +
      'checked="false" bounds="[80,8][98,28]" />' +
      '<node package="com.android.settings" text="sample-terminal" enabled="true" />' +
      '</node>',
    );
    expect(findAndroidSystemUiButton(
      hierarchy,
      ['Install', 'Update', 'Settings', 'Allow from this source'],
      ['com.android.settings'],
    )).toMatchObject({
      label: 'Allow from this source',
      checked: false,
      targetClass: 'com.android.settingslib.widget.MainSwitchPreference',
      stateSource: 'switch-descendant',
    });
  });

  it('uses the nearest owning package when a system button node omits its package attribute', () => {
    const hierarchy = xml(
      '<node package="com.google.android.packageinstaller">' +
      '<node text="Update" enabled="true" clickable="true" bounds="[3,4][23,34]" />' +
      '</node>',
    );
    expect(findAndroidSystemUiButton(hierarchy, ['Update'], ['com.google.android.packageinstaller']))
      .toMatchObject({label: 'Update', packageName: 'com.google.android.packageinstaller'});

    const explicitlyForeignNode = xml(
      '<node package="com.google.android.packageinstaller">' +
      '<node package="com.anonymous.sampleterminal" text="Update" enabled="true" clickable="true" bounds="[3,4][23,34]" />' +
      '</node>',
    );
    expect(() => findAndroidSystemUiButton(explicitlyForeignNode, ['Update'], ['com.google.android.packageinstaller']))
      .toThrow('BUTTON_MATCH_COUNT_0');
  });

  it('uses the nearest clickable Settings preference ancestor for a non-clickable title node', () => {
    expect(findAndroidSystemUiButton(xml(
      '<node class="com.android.settingslib.widget.MainSwitchPreference" clickable="true" enabled="true" ' +
      'bounds="[1,2][101,42]">' +
      '<node class="android.widget.TextView" text="Allow from this source" clickable="false" enabled="true" ' +
      'checkable="false" checked="false" bounds="[8,8][80,28]" />' +
      '<node class="android.widget.Switch" checkable="true" clickable="true" enabled="true" ' +
      'checked="false" bounds="[80,8][98,28]" />' +
      '</node>',
    ), ['Allow from this source'])).toMatchObject({
      label: 'Allow from this source',
      bounds: {left: 80, top: 8, right: 98, bottom: 28},
      checked: false,
      targetClass: 'android.widget.Switch',
      labelClass: 'android.widget.TextView',
      ancestorDistance: 1,
      targetClickable: true,
      targetEnabled: true,
      stateSource: 'switch-descendant',
    });
  });

  it('does not treat a non-checkable text node checked=false as the setting state', () => {
    const result = findAndroidSystemUiButton(xml(
      '<node class="android.view.View" clickable="true" enabled="true" bounds="[0,10][720,100]">' +
      '<node class="android.widget.TextView" text="Allow from this source" checkable="false" checked="false" ' +
      'enabled="true" bounds="[10,20][200,60]" />' +
      '</node>',
    ), ['Allow from this source']);
    expect(result).not.toHaveProperty('checked');
    expect(result.stateSource).toBe('unknown');
  });

  it('fails closed on missing, ambiguous, disabled, malformed and oversized controls', () => {
    expect(() => findAndroidSystemUiButton(xml(''), ['Install'])).toThrow('BUTTON_MATCH_COUNT_0');
    expect(() => findAndroidSystemUiButton(xml(
      '<node text="Install" enabled="true" clickable="true" bounds="[0,0][2,2]" />' +
      '<node text="Install" enabled="true" clickable="true" bounds="[3,3][5,5]" />',
    ), ['Install'])).toThrow('BUTTON_MATCH_COUNT_2');
    expect(() => findAndroidSystemUiButton(xml(
      '<node text="Install" enabled="false" clickable="true" bounds="[0,0][2,2]" />',
    ), ['Install'])).toThrow('BUTTON_NOT_ACTIONABLE_LABEL_INSTALL');
    expect(() => findAndroidSystemUiButton(xml(
      '<node text="Install" enabled="true" clickable="true" bounds="[0,0][0,2]" />',
    ), ['Install'])).toThrow('BOUNDS_INVALID');
    expect(() => findAndroidSystemUiButton(xml('x'.repeat(2 * 1024 * 1024 + 1)), ['Install'])).toThrow('HIERARCHY_INVALID');
  });

  it('detects the Android Settings source-permission page when reached directly from PackageInstaller', async () => {
    const hierarchy = xml(
      '<node package="com.android.settings" text="Install unknown apps" enabled="true" />' +
      '<node package="com.android.settings" text="Disabled by admin" enabled="true" />' +
      '<node package="com.android.settings" text="Allow from this source" class="android.widget.TextView" ' +
      'enabled="true" clickable="false" bounds="[8,8][80,28]">' +
      '<node class="android.view.View" enabled="false" clickable="true" checkable="true" ' +
      'bounds="[1,2][11,12]" />' +
      '</node>',
    );
    expect(() => findAndroidSystemUiButton(hierarchy, ['Allow from this source'], ['com.android.settings']))
      .toThrow('BUTTON_NOT_ACTIONABLE_LABEL_ALLOW_FROM_THIS_SOURCE_PACKAGE_COM_ANDROID_SETTINGS');
    const ui = createAndroidSystemUi({
      adbPath: '/sdk/platform-tools/adb',
      serial: 'emulator-5554',
      runTextCommand: async () => hierarchy,
    });
    await expect(ui.waitForButton(['Allow from this source'], 1000, undefined, ['com.android.settings']))
      .rejects.toThrow('PAGE_NODES_4');
    await expect(ui.waitForButton(['Allow from this source'], 1000, undefined, ['com.android.settings']))
      .rejects.toThrow('DISABLED_BY_ADMIN_TEXT_1');
  });

  it('accepts the Android Settings source-permission control when PackageInstaller opens it directly', async () => {
    const ui = createAndroidSystemUi({
      adbPath: '/sdk/platform-tools/adb',
      serial: 'emulator-5554',
      runTextCommand: async () => xml(
        '<node package="com.android.settings" text="Allow from this source" class="android.widget.Switch" ' +
        'checkable="true" enabled="true" clickable="true" checked="false" bounds="[1,2][11,12]" />',
      ),
    });
    await expect(ui.waitForButton(['Allow from this source'], 1000, undefined, ['com.android.settings']))
      .resolves.toMatchObject({label: 'Allow from this source', checked: false});
  });

  it('requires the Settings source-permission page to identify the app being installed', async () => {
    const ui = createAndroidSystemUi({
      adbPath: '/sdk/platform-tools/adb',
      serial: 'emulator-5554',
      runTextCommand: async () => xml(
        '<node package="com.android.settings" text="Another app" class="android.widget.TextView" enabled="true" />' +
        '<node package="com.android.settings" text="Allow from this source" class="android.widget.Switch" ' +
        'checkable="true" enabled="true" clickable="true" checked="false" bounds="[1,2][11,12]" />',
      ),
    });
    await expect(ui.waitForButton(['Allow from this source'], 1000, undefined, ['com.android.settings'], {
      label: 'Allow from this source', text: 'sample-terminal',
    }))
      .rejects.toThrow('TERMINAL_AUTOMATION_ANDROID_SYSTEM_UI_CONTEXT_TEXT_MISSING');
  });

  it('checks the app identity for the Settings page even when waiting for other installer controls too', async () => {
    const ui = createAndroidSystemUi({
      adbPath: '/sdk/platform-tools/adb',
      serial: 'emulator-5554',
      runTextCommand: async () => xml(
        '<node package="com.android.settings" text="Another app" class="android.widget.TextView" enabled="true" />' +
        '<node package="com.android.settings" text="Allow from this source" class="android.widget.TextView" ' +
        'enabled="true" clickable="false" />',
      ),
    });
    await expect(ui.waitForButton(['Install', 'Update', 'Settings', 'Allow from this source'], 1000,
      undefined, ['com.android.packageinstaller', 'com.android.settings'], {
        label: 'Allow from this source', text: 'sample-terminal',
      })).rejects.toThrow('TERMINAL_AUTOMATION_ANDROID_SYSTEM_UI_CONTEXT_TEXT_MISSING');
  });

  it('does not require Settings context while the PackageInstaller confirmation is visible', async () => {
    const ui = createAndroidSystemUi({
      adbPath: '/sdk/platform-tools/adb',
      serial: 'emulator-5554',
      runTextCommand: async () => xml(
        '<node package="com.android.packageinstaller" text="Install" class="android.widget.Button" ' +
        'enabled="true" clickable="true" bounds="[1,2][11,12]" />',
      ),
    });
    await expect(ui.waitForButton(['Install', 'Update', 'Settings', 'Allow from this source'], 1000,
      undefined, ['com.android.packageinstaller', 'com.android.settings'], {
        label: 'Allow from this source', text: 'sample-terminal',
      })).resolves.toMatchObject({label: 'Install', packageName: 'com.android.packageinstaller'});
  });

  it('leaves Android system UI untouched when its full-screen education notice is absent', async () => {
    const calls: string[][] = [];
    const ui = createAndroidSystemUi({
      adbPath: '/sdk/platform-tools/adb',
      serial: 'emulator-5554',
      runTextCommand: async (_adb, args) => {
        calls.push([...args]);
        return xml('<node package="com.android.packageinstaller" text="Update" enabled="true" ' +
          'clickable="true" bounds="[10,20][30,60]" />');
      },
    });

    await expect(ui.acknowledgeImmersiveModeEducation()).resolves.toBe(false);
    expect(calls).toEqual([
      ['-s', 'emulator-5554', 'exec-out', 'uiautomator', 'dump', '--compressed', '/dev/stdout'],
    ]);
  });

  it('acknowledges the exact SystemUI full-screen education notice using fresh bounds', async () => {
    const calls: string[][] = [];
    const hierarchy = xml(
      '<node package="com.android.systemui" text="Viewing full screen" enabled="true">' +
      '<node package="com.android.systemui" text="Got it" class="android.widget.Button" ' +
      'enabled="true" clickable="true" bounds="[10,20][30,60]" />' +
      '</node>',
    );
    const ui = createAndroidSystemUi({
      adbPath: '/sdk/platform-tools/adb',
      serial: 'emulator-5554',
      runTextCommand: async (_adb, args) => {
        calls.push([...args]);
        return args.includes('dump') ? hierarchy : '';
      },
    });

    await expect(ui.acknowledgeImmersiveModeEducation()).resolves.toBe(true);
    expect(calls).toEqual([
      ['-s', 'emulator-5554', 'exec-out', 'uiautomator', 'dump', '--compressed', '/dev/stdout'],
      ['-s', 'emulator-5554', 'exec-out', 'uiautomator', 'dump', '--compressed', '/dev/stdout'],
      ['-s', 'emulator-5554', 'shell', 'input', 'tap', '20', '40'],
    ]);
  });

  it('does not acknowledge same-labeled UI owned by another package', async () => {
    const calls: string[][] = [];
    const ui = createAndroidSystemUi({
      adbPath: '/sdk/platform-tools/adb',
      serial: 'emulator-5554',
      runTextCommand: async (_adb, args) => {
        calls.push([...args]);
        return xml(
          '<node package="com.example.other" text="Viewing full screen" enabled="true">' +
          '<node package="com.example.other" text="Got it" enabled="true" clickable="true" ' +
          'bounds="[10,20][30,60]" />' +
          '</node>',
        );
      },
    });

    await expect(ui.acknowledgeImmersiveModeEducation()).resolves.toBe(false);
    expect(calls.some(args => args.includes('tap'))).toBe(false);
  });

  it('refuses to tap if the SystemUI notice disappears before the fresh click check', async () => {
    const calls: string[][] = [];
    let hierarchyRead = 0;
    const ui = createAndroidSystemUi({
      adbPath: '/sdk/platform-tools/adb',
      serial: 'emulator-5554',
      runTextCommand: async (_adb, args) => {
        calls.push([...args]);
        if (!args.includes('dump')) return '';
        hierarchyRead += 1;
        return hierarchyRead === 1
          ? xml(
            '<node package="com.android.systemui" text="Viewing full screen" enabled="true">' +
            '<node package="com.android.systemui" text="Got it" class="android.widget.Button" ' +
            'enabled="true" clickable="true" bounds="[10,20][30,60]" />' +
            '</node>',
          )
          : xml('<node package="com.android.packageinstaller" text="Update" enabled="true" ' +
            'clickable="true" bounds="[10,20][30,60]" />');
      },
    });

    await expect(ui.acknowledgeImmersiveModeEducation()).rejects.toThrow(
      'TERMINAL_AUTOMATION_ANDROID_SYSTEM_UI_BUTTON_MATCH_COUNT_0',
    );
    expect(calls.some(args => args.includes('tap'))).toBe(false);
  });

  it('uses the selected Android serial and taps the unique button center', async () => {
    const calls: string[][] = [];
    const ui = createAndroidSystemUi({
      adbPath: '/sdk/platform-tools/adb',
      serial: 'emulator-5554',
      runTextCommand: async (_adb, args) => {
        calls.push([...args]);
        return xml('<node text="Open" enabled="true" clickable="true" bounds="[10,20][30,60]" />');
      },
    });
    const button = await ui.waitForButton(['Open'], 1000);
    await ui.tapButton(button);
    expect(calls).toEqual([
      ['-s', 'emulator-5554', 'exec-out', 'uiautomator', 'dump', '--compressed', '/dev/stdout'],
      ['-s', 'emulator-5554', 'exec-out', 'uiautomator', 'dump', '--compressed', '/dev/stdout'],
      ['-s', 'emulator-5554', 'shell', 'input', 'tap', '20', '40'],
    ]);
  });

  it('waits for a package-bounded native button and clicks its freshly resolved bounds', async () => {
    const calls: string[][] = [];
    const ui = createAndroidSystemUi({
      adbPath: '/sdk/platform-tools/adb',
      serial: 'emulator-5560',
      runTextCommand: async (_adb, args) => {
        calls.push([...args]);
        if (args.includes('dump')) {
          return xml('<node package="com.google.android.packageinstaller" text="Update" ' +
            'class="android.widget.Button" enabled="true" clickable="true" bounds="[10,20][30,60]" />');
        }
        return '';
      },
    });

    const clicked = await ui.clickButton({
      labels: ['Update'],
      timeoutMs: 1_000,
      allowedPackagePrefixes: ['com.google.android.packageinstaller'],
    });

    expect(clicked).toMatchObject({label: 'Update', packageName: 'com.google.android.packageinstaller'});
    expect(calls).toEqual([
      ['-s', 'emulator-5560', 'exec-out', 'uiautomator', 'dump', '--compressed', '/dev/stdout'],
      ['-s', 'emulator-5560', 'exec-out', 'uiautomator', 'dump', '--compressed', '/dev/stdout'],
      ['-s', 'emulator-5560', 'shell', 'input', 'tap', '20', '40'],
    ]);
  });

  it('rechecks the expected app identity on the fresh hierarchy before clicking a native control', async () => {
    const calls: string[][] = [];
    let hierarchyReads = 0;
    const ui = createAndroidSystemUi({
      adbPath: '/sdk/platform-tools/adb',
      serial: 'emulator-5560',
      runTextCommand: async (_adb, args) => {
        calls.push([...args]);
        if (!args.includes('dump')) return '';
        hierarchyReads += 1;
        const appLabel = hierarchyReads === 1 ? 'sample-terminal' : 'another-terminal';
        return xml(
          `<node package="com.google.android.packageinstaller" text="${appLabel}">` +
          '<node text="Update" class="android.widget.Button" enabled="true" clickable="true" bounds="[10,20][30,60]" />' +
          '</node>',
        );
      },
    });

    await expect(ui.clickButton({
      labels: ['Update'],
      timeoutMs: 1_000,
      allowedPackagePrefixes: ['com.google.android.packageinstaller'],
      expectedContext: {label: 'Update', text: 'sample-terminal'},
    })).rejects.toThrow('TERMINAL_AUTOMATION_ANDROID_SYSTEM_UI_CONTEXT_TEXT_MISSING');
    expect(calls.filter(args => args.includes('tap'))).toHaveLength(0);
  });

  it('summarizes the active native screen without retaining visible text', async () => {
    const ui = createAndroidSystemUi({
      adbPath: '/sdk/platform-tools/adb',
      serial: 'emulator-5554',
      runTextCommand: async () => xml(
        '<node package="com.android.packageinstaller" text="Update" enabled="true" clickable="true" ' +
        'bounds="[1,2][11,12]" />' +
        '<node package="com.android.packageinstaller" text="fixture-secret-text" enabled="true" />',
      ),
    });
    const summary = await ui.readScreenSummary();
    expect(summary).toContain('INSTALLER_NODES_2');
    expect(summary).toContain('UPDATE_TEXT_1');
    expect(summary).not.toContain('fixture-secret-text');
  });

  it('taps the visible switch side when Android exposes source permission as a full-width checked row', async () => {
    const calls: string[][] = [];
    const ui = createAndroidSystemUi({
      adbPath: '/sdk/platform-tools/adb',
      serial: 'emulator-5554',
      runTextCommand: async (_adb, args) => {
        calls.push([...args]);
        return xml(
          '<node package="com.android.settings" class="android.view.View" checkable="true" checked="false" ' +
          'clickable="true" enabled="true" bounds="[0,760][720,879]">' +
          '<node class="android.widget.TextView" text="Allow from this source" checkable="false" ' +
          'clickable="false" enabled="true" bounds="[48,790][470,850]" />' +
          '</node>',
        );
      },
    });
    const button = await ui.waitForButton(['Allow from this source'], 1000, undefined, ['com.android.settings']);
    await ui.tapButton(button);
    expect(button).toMatchObject({stateSource: 'target', targetClass: 'android.view.View', checked: false});
    expect(calls.at(-1)).toEqual([
      '-s', 'emulator-5554', 'shell', 'input', 'tap', '661', '819',
    ]);
  });

  it('re-resolves a native button immediately before tapping instead of using stale bounds', async () => {
    const calls: string[][] = [];
    let hierarchyReads = 0;
    const ui = createAndroidSystemUi({
      adbPath: '/sdk/platform-tools/adb',
      serial: 'emulator-5554',
      runTextCommand: async (_adb, args) => {
        calls.push([...args]);
        if (args.includes('exec-out')) {
          hierarchyReads += 1;
          return hierarchyReads === 1
            ? xml('<node package="com.android.packageinstaller" text="Update" enabled="true" clickable="true" bounds="[1,2][21,32]" />')
            : xml('<node package="com.android.packageinstaller" text="Update" enabled="true" clickable="true" bounds="[101,202][141,262]" />');
        }
        return '';
      },
    });
    const observed = await ui.waitForButton(['Update'], 1000, undefined, ['com.android.packageinstaller']);
    await ui.tapButton(observed);
    expect(calls.at(-1)).toEqual(['-s', 'emulator-5554', 'shell', 'input', 'tap', '121', '232']);
    expect(hierarchyReads).toBe(2);
  });

  it('sets an Android system toggle through one driver action and verifies the resulting state', async () => {
    const calls: string[][] = [];
    let state: boolean = false;
    const hierarchy = (): string => xml(
      '<node package="com.android.settings" class="android.view.View" checkable="true" checked="' + state + '" ' +
      'clickable="true" enabled="true" bounds="[0,760][720,879]">' +
      '<node class="android.widget.TextView" text="Allow from this source" clickable="false" enabled="true" />' +
      '</node>',
    );
    const ui = createAndroidSystemUi({
      adbPath: '/sdk/platform-tools/adb',
      serial: 'emulator-5554',
      runTextCommand: async (_adb, args) => {
        calls.push([...args]);
        if (args.includes('exec-out')) return hierarchy();
        if (args.includes('tap')) state = true;
        return '';
      },
    });
    const result = await ui.setChecked({
      labels: ['Allow from this source'],
      checked: true,
      timeoutMs: 1000,
      allowedPackagePrefixes: ['com.android.settings'],
      expectedContext: {label: 'Allow from this source', text: 'Allow from this source'},
    });
    expect(result.checked).toBe(true);
    expect(calls.filter(args => args.includes('tap'))).toHaveLength(1);
  });

  it('reads the source permission switch state and reports only an allowlisted hierarchy summary on timeout', async () => {
    const hierarchy = xml(
      '<node package="com.android.settings" text="Allow from this source" class="android.widget.Switch" ' +
      'checkable="true" enabled="true" clickable="true" checked="false" bounds="[1,2][11,12]" />' +
      '<node text="sensitive-account-label" enabled="true" clickable="true" bounds="[1,2][11,12]" />',
    );
    const ui = createAndroidSystemUi({
      adbPath: '/sdk/platform-tools/adb',
      serial: 'emulator-5554',
      runTextCommand: async () => hierarchy,
    });
    await expect(ui.waitForButton(['Allow from this source'], 1000)).resolves.toMatchObject({
      label: 'Allow from this source',
      checked: false,
    });
    await expect(ui.waitForButton(['Install'], 10)).rejects.toThrow('SETTINGS_NODES_1');
    await expect(ui.waitForButton(['Install'], 10)).rejects.toThrow('PACKAGE_COM_ANDROID_SETTINGS_1');
    await expect(ui.waitForButton(['Install'], 10)).rejects.toThrow('CHECKABLE_SWITCHES_1_ENABLED_CHECKABLE_SWITCHES_1');
    await expect(ui.waitForButton(['Install'], 10)).rejects.toThrow('CLICKABLE_CHECKABLE_SWITCHES_1');
    await expect(ui.waitForButton(['Install'], 10)).rejects.not.toThrow('sensitive-account-label');
  });

  it('does not infer installer completion from a visible app package alone', async () => {
    const ui = createAndroidSystemUi({
      adbPath: '/sdk/platform-tools/adb',
      serial: 'emulator-5554',
      runTextCommand: async () => xml('<node package="com.example.targetapp" text="Existing screen" enabled="true" />'),
    });
    await expect(ui.waitForButton(['Done', 'Open'], 1)).rejects.toThrow(
      'TERMINAL_AUTOMATION_ANDROID_SYSTEM_UI_BUTTON_TIMEOUT_',
    );
  });

  it('keeps polling after one unavailable hierarchy sample and succeeds when the system window appears', async () => {
    let attempts = 0;
    const ui = createAndroidSystemUi({
      adbPath: '/sdk/platform-tools/adb',
      serial: 'emulator-5554',
      runTextCommand: async () => {
        attempts += 1;
        if (attempts === 1) {
          return {stdout: 'Success\n', stderr: ''};
        }
        return xml('<node package="com.android.packageinstaller" text="Install" enabled="true" clickable="true" bounds="[1,2][21,32]" />');
      },
    });
    await expect(ui.waitForButton(['Install'], 1_000, undefined, ['com.android.packageinstaller']))
      .resolves.toMatchObject({label: 'Install'});
    expect(attempts).toBe(2);
  });

  it('keeps polling after uiautomator exits nonzero for a missing accessibility root', async () => {
    let attempts = 0;
    const ui = createAndroidSystemUi({
      adbPath: '/sdk/platform-tools/adb',
      serial: 'emulator-5554',
      runTextCommand: async () => {
        attempts += 1;
        if (attempts === 1) {
          const error = new Error('sensitive-window-label') as Error & {
            code: number;
            stdout: string;
            stderr: string;
          };
          error.code = 1;
          error.stdout = 'UI hierchary dumped to: /dev/stdout';
          error.stderr = 'ERROR: null root node returned; sensitive-window-label';
          throw error;
        }
        return xml('<node package="com.android.packageinstaller" text="Update" enabled="true" clickable="true" bounds="[1,2][21,32]" />');
      },
    });
    await expect(ui.waitForButton(['Update'], 1_000, undefined, ['com.android.packageinstaller']))
      .resolves.toMatchObject({label: 'Update'});
    expect(attempts).toBe(2);
  });

  it('reports safe command failure facts without exposing process output', async () => {
    const ui = createAndroidSystemUi({
      adbPath: '/sdk/platform-tools/adb',
      serial: 'emulator-5554',
      runTextCommand: async () => {
        const error = new Error('sensitive-window-label') as Error & {
          code: string;
          stdout: string;
          stderr: string;
          signal: string | null;
          killed: boolean;
        };
        error.code = 'ETIMEDOUT';
        error.stdout = 'sensitive output';
        error.stderr = 'sensitive error';
        error.signal = 'SIGTERM';
        error.killed = true;
        throw error;
      },
    });
    await expect(ui.readHierarchy()).rejects.toThrow(
      'TERMINAL_AUTOMATION_ANDROID_SYSTEM_UI_COMMAND_FAILED_CODE_ETIMEDOUT_SIGNAL_SIGTERM_KILLED_1_' +
      'STDOUT_BYTES_16_STDERR_BYTES_15_STDERR_NULL_ROOT_0_STDERR_IDLE_TIMEOUT_0_STDERR_DEVICE_OFFLINE_0',
    );
    await expect(ui.readHierarchy()).rejects.not.toThrow('sensitive');
  });

  it('reports a bounded timeout when every hierarchy sample is unavailable', async () => {
    let attempts = 0;
    const ui = createAndroidSystemUi({
      adbPath: '/sdk/platform-tools/adb',
      serial: 'emulator-5554',
      runTextCommand: async () => {
        attempts += 1;
        return {stdout: 'Success\n', stderr: ''};
      },
    });
    await expect(ui.waitForButton(['Install'], 1)).rejects.toThrow(
      'TERMINAL_AUTOMATION_ANDROID_SYSTEM_UI_BUTTON_TIMEOUT_HIERARCHY_UNAVAILABLE_NO_HIERARCHY_' +
      'TERMINAL_AUTOMATION_ANDROID_SYSTEM_UI_DUMP_NOT_FOUND_STDOUT_BYTES_8_STDERR_BYTES_0_',
    );
    expect(attempts).toBeGreaterThan(0);
  });

  it('cancels a losing installer-button wait when another completion signal wins', async () => {
    const controller = new AbortController();
    const ui = createAndroidSystemUi({
      adbPath: '/sdk/platform-tools/adb',
      serial: 'emulator-5554',
      runTextCommand: async () => xml('<node package="com.android.settings" text="Settings" enabled="true" />'),
    });
    const waiting = ui.waitForButton(['Done', 'Open'], 1_000, controller.signal);
    controller.abort();
    await expect(waiting).rejects.toThrow('TERMINAL_AUTOMATION_ANDROID_SYSTEM_UI_WAIT_CANCELLED');
  });

  it('returns from the already-enabled Settings screen using the selected device', async () => {
    const calls: string[][] = [];
    const ui = createAndroidSystemUi({
      adbPath: '/sdk/platform-tools/adb',
      serial: 'emulator-5554',
      runTextCommand: async (_adb, args) => {
        calls.push([...args]);
        return '';
      },
    });
    await ui.pressBack();
    expect(calls).toEqual([['-s', 'emulator-5554', 'shell', 'input', 'keyevent', 'KEYCODE_BACK']]);
  });

  it('reports safe output-shape diagnostics without exposing hierarchy or stderr text', async () => {
    const ui = createAndroidSystemUi({
      adbPath: '/sdk/platform-tools/adb',
      serial: 'emulator-5554',
      runTextCommand: async () => ({stdout: 'UI hierchary dumped to: /dev/stdout', stderr: 'ERROR: null root node returned; sensitive-window-label'}),
    });
    await expect(ui.readHierarchy()).rejects.toThrow(
      'TERMINAL_AUTOMATION_ANDROID_SYSTEM_UI_DUMP_NOT_FOUND_STDOUT_BYTES_35_STDERR_BYTES_54_STDOUT_XML_START_0_STDOUT_XML_END_0_STDERR_NULL_ROOT_1_STDERR_IDLE_TIMEOUT_0_STDOUT_DUMP_ANNOUNCED_1_STDERR_DUMP_ANNOUNCED_0',
    );
    await expect(ui.readHierarchy()).rejects.not.toThrow('sensitive-window-label');
  });
});
