# TER surface 配置覆盖实施验证

```text
REVIEW_TARGET=IMPLEMENTATION
EVIDENCE_TIER=focused;static
IMPLEMENTATION_SCOPE=two Android package JSON files;two integration factories;two existing integration assembly tests;four README files
RUNTIME=NOT_RUN
OBSOLETE_V1_SOURCE_CLEANUP=NOT_NEEDED
```

## 实际改动文件

- `apps/terminal/assembly/android/sample-terminal/package.json`
- `apps/terminal/assembly/android/sample-wallpaper-terminal/package.json`
- `apps/terminal/assembly/android/sample-terminal/src/assembly/platformPorts.ts`
- `apps/terminal/assembly/android/sample-wallpaper-terminal/src/assembly/platformPorts.ts`
- `apps/terminal/ui/integration/sample-console/src/assembly/assembly.tsx`
- `apps/terminal/ui/integration/sample-wallpaper-console/src/assembly/assembly.tsx`
- `apps/terminal/ui/integration/sample-console/test/sampleAssembly.test.tsx`
- `apps/terminal/ui/integration/sample-wallpaper-console/test/sample2Assembly.test.tsx`
- `apps/terminal/ui/integration/sample-console/README.md`
- `apps/terminal/ui/integration/sample-wallpaper-console/README.md`
- `apps/terminal/assembly/android/sample-terminal/README.md`
- `apps/terminal/assembly/android/sample-wallpaper-terminal/README.md`

## 七条命令结果

### 1. sample-console typecheck

```text
COMMAND=yarn --cwd apps/terminal/ui/integration/sample-console typecheck
EXIT=0
RESULT=PASS
RAW_OUTPUT=(empty)
```

### 2. sample-wallpaper-console typecheck

```text
COMMAND=yarn --cwd apps/terminal/ui/integration/sample-wallpaper-console typecheck
EXIT=0
RESULT=PASS
RAW_OUTPUT=(empty)
```

### 3. sample-terminal typecheck

```text
COMMAND=yarn --cwd apps/terminal/assembly/android/sample-terminal typecheck
EXIT=0
RESULT=PASS
RAW_OUTPUT=(empty)
```

### 4. sample-wallpaper-terminal typecheck

```text
COMMAND=yarn --cwd apps/terminal/assembly/android/sample-wallpaper-terminal typecheck
EXIT=0
RESULT=PASS
RAW_OUTPUT=(empty)
```

### 5. sample-console owned test

```text
COMMAND=yarn --cwd apps/terminal/ui/integration/sample-console test
EXIT=0
RESULT=PASS

 RUN  v4.1.10 /Users/dexter/Documents/workspace/idea/catering-v2s/apps/terminal/ui/integration/sample-console


 Test Files  8 passed (8)
      Tests  38 passed (38)
   Start at  00:01:10
   Duration  1.98s (transform 2.72s, setup 771ms, import 3.22s, tests 2.11s, environment 0ms)

TERMINAL_PACKAGE_TEST=PASS kind=REAL_TESTS package=@catering-v2s/ui-integration-sample-console
```

### 6. sample-wallpaper-console owned test

```text
COMMAND=yarn --cwd apps/terminal/ui/integration/sample-wallpaper-console test
EXIT=0
RESULT=PASS

 RUN  v4.1.10 /Users/dexter/Documents/workspace/idea/catering-v2s/apps/terminal/ui/integration/sample-wallpaper-console


 Test Files  4 passed (4)
      Tests  15 passed (15)
   Start at  00:01:17
   Duration  1.17s (transform 1.04s, setup 186ms, import 1.49s, tests 806ms, environment 0ms)

TERMINAL_PACKAGE_TEST=PASS kind=REAL_TESTS package=@catering-v2s/ui-integration-sample-wallpaper-console
```

### 7. existing terminal static

```text
COMMAND=yarn --cwd apps/terminal verify:static
EXIT=1
RESULT=OPEN
TERMINAL_VERIFY_DEBUG {"schemaVersion":1,"event":"TERMINAL_VERIFY_DEBUG","runId":"ter-local-static-38099-1789484484151","phase":"verify-static.start","at":"2026-09-15T15:01:24.151Z","state":"START","cwd":"/Users/dexter/Documents/workspace/idea/catering-v2s","pid":38099,"node":"v24.13.0"}
TERMINAL_VERIFY_DEBUG {"schemaVersion":1,"event":"TERMINAL_VERIFY_DEBUG","runId":"ter-local-static-38099-1789484484151","phase":"subprocess.start","at":"2026-09-15T15:01:24.153Z","state":"START","label":"readability-model-test","command":"/usr/local/bin/node","args":["/Users/dexter/Documents/workspace/idea/catering-v2s/tools/terminal-readability/check-static.test.mjs"],"cwd":"/Users/dexter/Documents/workspace/idea/catering-v2s"}
TERMINAL_VERIFY_DEBUG {"schemaVersion":1,"event":"TERMINAL_VERIFY_DEBUG","runId":"ter-local-static-38099-1789484484151","phase":"subprocess.finish","at":"2026-09-15T15:01:25.040Z","state":"FINISH","label":"readability-model-test","command":"/usr/local/bin/node","status":1,"signal":null,"errorCode":null,"durationMs":887}
MODEL_TR_R02=PASS
MODEL_TR_R03=PASS
MODEL_TR_R04=PASS
MODEL_TR_R05=PASS
MODEL_TR_R06=PASS
MODEL_TR_R07=PASS
MODEL_RD12=PASS
MODEL_RD13=PASS
MODEL_RD14=PASS
MODEL_RD09_RD11=PASS
node:internal/modules/run_main:107
    triggerUncaughtException(
    ^

AssertionError [ERR_ASSERTION]: real descriptor attach sites must satisfy the protocol
+ actual - expected

+ [
  {
    file: 'apps/terminal/kernel/base/platform-ports/src/defaults/logger.ts',
    line: 6,
    message: 'descriptor attachment must be guarded by __DEV__',
    ruleId: 'RD-6'
  },
  {
    file: 'apps/terminal/kernel/base/platform-ports/src/defaults/unavailableAppControl.ts',
    line: 18,
    message: 'descriptor attachment must be guarded by __DEV__',
    ruleId: 'RD-6'
  },
  {
    file: 'apps/terminal/kernel/base/platform-ports/src/defaults/unavailableConnector.ts',
    line: 13,
    message: 'descriptor attachment must be guarded by __DEV__',
    ruleId: 'RD-6'
  },
  {
    file: 'apps/terminal/kernel/base/platform-ports/src/defaults/unavailableDevice.ts',
    line: 15,
    message: 'descriptor attachment must be guarded by __DEV__',
    ruleId: 'RD-6'
  },
  {
    file: 'apps/terminal/kernel/base/platform-ports/src/defaults/unavailableHotUpdate.ts',
    line: 16,
    message: 'descriptor attachment must be guarded by __DEV__',
    ruleId: 'RD-6'
  },
  {
    file: 'apps/terminal/kernel/base/platform-ports/src/defaults/unavailableLogUpload.ts',
    line: 10,
    message: 'descriptor attachment must be guarded by __DEV__',
    ruleId: 'RD-6'
  },
  {
    file: 'apps/terminal/kernel/base/platform-ports/src/defaults/unavailablePersistSecure.ts',
    line: 17,
    message: 'descriptor attachment must be guarded by __DEV__',
    ruleId: 'RD-6'
  },
  {
    file: 'apps/terminal/kernel/base/platform-ports/src/defaults/unavailableScript.ts',
    line: 12,
    message: 'descriptor attachment must be guarded by __DEV__',
    ruleId: 'RD-6'
  },
  {
    file: 'apps/terminal/kernel/base/platform-ports/src/defaults/unavailableTopologyHost.ts',
    line: 13,
    message: 'descriptor attachment must be guarded by __DEV__',
    ruleId: 'RD-6'
  },
  {
    file: 'apps/terminal/kernel/base/platform-ports/src/defaults/processMemoryStorage.ts',
    line: 56,
    message: 'descriptor attachment must be guarded by __DEV__',
    ruleId: 'RD-6'
  },
  {
    file: 'apps/terminal/adapter/android/device/src/implementations/androidDevice.ts',
    line: 109,
    message: 'descriptor attachment must be guarded by __DEV__',
    ruleId: 'RD-6'
  },
  {
    file: 'apps/terminal/adapter/android/persist-kv/src/implementations/androidPersistKv.ts',
    line: 269,
    message: 'descriptor attachment must be guarded by __DEV__',
    ruleId: 'RD-6'
  },
  {
    file: 'apps/terminal/ui/base/dev-host/src/implementations/webPlatform.ts',
    line: 48,
    message: 'descriptor attachment must be guarded by __DEV__',
    ruleId: 'RD-6'
  },
  {
    file: 'apps/terminal/ui/base/dev-host/src/implementations/webStorage.ts',
    line: 118,
    message: 'descriptor attachment must be guarded by __DEV__',
    ruleId: 'RD-6'
  }
]
- []

    at file:///Users/dexter/Documents/workspace/idea/catering-v2s/tools/terminal-readability/check-static.test.mjs:361:8
    at ModuleJob.run (node:internal/modules/esm/module_job:413:25)
    at async onImport.tracePromise.__proto__ (node:internal/modules/esm/loader:660:26)
    at async asyncRunEntryPointWithESMLoader (node:internal/modules/run_main:101:5) {
  generatedMessage: false,
  code: 'ERR_ASSERTION',
  actual: [
    {
      ruleId: 'RD-6',
      file: 'apps/terminal/kernel/base/platform-ports/src/defaults/logger.ts',
      line: 6,
      message: 'descriptor attachment must be guarded by __DEV__'
    },
    {
      ruleId: 'RD-6',
      file: 'apps/terminal/kernel/base/platform-ports/src/defaults/unavailableAppControl.ts',
      line: 18,
      message: 'descriptor attachment must be guarded by __DEV__'
    },
    {
      ruleId: 'RD-6',
      file: 'apps/terminal/kernel/base/platform-ports/src/defaults/unavailableConnector.ts',
      line: 13,
      message: 'descriptor attachment must be guarded by __DEV__'
    },
    {
      ruleId: 'RD-6',
      file: 'apps/terminal/kernel/base/platform-ports/src/defaults/unavailableDevice.ts',
      line: 15,
      message: 'descriptor attachment must be guarded by __DEV__'
    },
    {
      ruleId: 'RD-6',
      file: 'apps/terminal/kernel/base/platform-ports/src/defaults/unavailableHotUpdate.ts',
      line: 16,
      message: 'descriptor attachment must be guarded by __DEV__'
    },
    {
      ruleId: 'RD-6',
      file: 'apps/terminal/kernel/base/platform-ports/src/defaults/unavailableLogUpload.ts',
      line: 10,
      message: 'descriptor attachment must be guarded by __DEV__'
    },
    {
      ruleId: 'RD-6',
      file: 'apps/terminal/kernel/base/platform-ports/src/defaults/unavailablePersistSecure.ts',
      line: 17,
      message: 'descriptor attachment must be guarded by __DEV__'
    },
    {
      ruleId: 'RD-6',
      file: 'apps/terminal/kernel/base/platform-ports/src/defaults/unavailableScript.ts',
      line: 12,
      message: 'descriptor attachment must be guarded by __DEV__'
    },
    {
      ruleId: 'RD-6',
      file: 'apps/terminal/kernel/base/platform-ports/src/defaults/unavailableTopologyHost.ts',
      line: 13,
      message: 'descriptor attachment must be guarded by __DEV__'
    },
    {
      ruleId: 'RD-6',
      file: 'apps/terminal/kernel/base/platform-ports/src/defaults/processMemoryStorage.ts',
      line: 56,
      message: 'descriptor attachment must be guarded by __DEV__'
    },
    {
      ruleId: 'RD-6',
      file: 'apps/terminal/adapter/android/device/src/implementations/androidDevice.ts',
      line: 109,
      message: 'descriptor attachment must be guarded by __DEV__'
    },
    {
      ruleId: 'RD-6',
      file: 'apps/terminal/adapter/android/persist-kv/src/implementations/androidPersistKv.ts',
      line: 269,
      message: 'descriptor attachment must be guarded by __DEV__'
    },
    {
      ruleId: 'RD-6',
      file: 'apps/terminal/ui/base/dev-host/src/implementations/webPlatform.ts',
      line: 48,
      message: 'descriptor attachment must be guarded by __DEV__'
    },
    {
      ruleId: 'RD-6',
      file: 'apps/terminal/ui/base/dev-host/src/implementations/webStorage.ts',
      line: 118,
      message: 'descriptor attachment must be guarded by __DEV__'
    }
  ],
  expected: [],
  operator: 'deepStrictEqual',
  diff: 'simple'
}

Node.js v24.13.0
TERMINAL_VERIFY_DEBUG {"schemaVersion":1,"event":"TERMINAL_VERIFY_DEBUG","runId":"ter-local-static-38099-1789484484151","phase":"verify-static.finish","at":"2026-09-15T15:01:25.040Z","state":"FINISH","outcome":"FAIL","label":"readability-model-test","status":1}
TERMINAL_STATIC_FIRST_FAILURE:readability-model-test:exit=1
```

## 失败诊断

```text
FIRST_FAILURE=readability-model-test / RD-6 descriptor protocol assertion
LAST_KNOWN_GOOD=yarn --cwd apps/terminal/ui/integration/sample-wallpaper-console test (EXIT=0)
BROKEN_BOUNDARY=tools/terminal-readability/check-static.test.mjs:361;the checker exits before any later terminal-static checks
CAUSALITY=the 14 reported files are outside this implementation scope and none was modified by this batch
ACTION=not retried;no unrelated descriptor source was changed under the current authorization
STATUS=OPEN_BASELINE_FAILURE
```

## v1 作废文件核对

复核时以下 v1 规划路径均不存在，因此没有删除动作：

- `tools/terminal-surface-config`
- `apps/terminal/ui/base/render/src/foundations/terminalSurfaces.ts`
- `apps/terminal/ui/base/render/test/terminalSurfaces.test.ts`
- `apps/terminal/assembly/android/sample-terminal/src/application`
- `apps/terminal/assembly/android/sample-wallpaper-terminal/src/application`
- `apps/terminal/assembly/android/sample-terminal/vitest.config.ts`
- `apps/terminal/assembly/android/sample-wallpaper-terminal/vitest.config.ts`
- `apps/terminal/assembly/android/sample-terminal/test`
- `apps/terminal/assembly/android/sample-wallpaper-terminal/test`

```text
OBSOLETE_V1_SOURCE_CLEANUP=NOT_NEEDED
```

## 明确未修改边界

- 两个 integration `test-expo/App.tsx`；
- 两个 Android App 的 `tsconfig.json` 与 `App.tsx`；
- `apps/terminal/ui/base/dev-host`、`apps/terminal/assembly/base/android`、物理 host 测量；
- Web/Metro/Android 构建、设备、DEV、seed、UAT、部署及 Git。
