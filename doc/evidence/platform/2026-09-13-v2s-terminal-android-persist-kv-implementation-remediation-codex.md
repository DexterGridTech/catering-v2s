# TER Android persistKV / persistSecure 实施复审修复证据

```text
EVIDENCE_ID=TER_PKV_IMPLEMENTATION_REMEDIATION_20260913
DATE=2026-09-13
REVIEW_TARGET=IMPLEMENTATION
TRIGGER=Claude implementation review NO-GO 1M/0S/1N
SCOPE=M-01 reconciliation inventory + N-01 invalid-mode diagnostic ownership
AUTHORITY=existing Dexter implementation authorization
```

## 1. 修复范围

本次只处置既有复审已确认、且不需要 Dexter 新裁的两项：

- M-01：把 7 个被遗漏的 D-01 实际波及文件逐项加入逐代码 reconciliation。`assembly.tsx` 同时含上一批 admin-console dirty changes；本批只认删除 `storageTimeouts` 的那一行。
- N-01：`androidPersistKv.ts` 的非法 mode 路径不再调用 `logicalPortOf` 推导逻辑端口。公共 `PortFailure` 没有“无逻辑端口”枚举值，因此保留与 native 一致的现有中性 `persistKv` 槽位；原始字符串 token 以安全诊断描述进入稳定 invalid-mode failure message，非字符串值只保留其类型名。稳定 machine code 仍为 `PERSIST_KV_INVALID_MODE`，不改变有效 plain/protected 的端口映射。

该处理没有扩展全局 `PortFailure`、新增 adapter/module、改变 native wire 或引入第二套诊断契约；它只消除非法输入被误推导为 plain owner 的事实，并保持既有 result contract。

## 2. 有限变更集合核验

Claude 点名的 7 个 D-01 文件已逐个重开 diff，并已进入
`doc/evidence/platform/2026-09-12-v2s-terminal-android-persist-kv-implementation-reconciliation-codex.md`：

1. `apps/terminal/ui/integration/sample-console/src/assembly/assembly.tsx`
2. `apps/terminal/kernel/base/ui-state/test/acceptance.test.ts`
3. `apps/terminal/kernel/base/ui-state/test/content.test.ts`
4. `apps/terminal/kernel/base/ui-state/test/variableRuntime.test.ts`
5. `apps/terminal/ui/integration/sample-console/test/webStorage.test.ts`
6. `apps/terminal/ui/base/dev-host/test/webPlatform.test.ts`
7. `apps/terminal/ui/base/dev-host/test/webStorage.test.ts`

同根排除项：`apps/terminal/ui/integration/sample-console/test/support.ts` 的 diff 是显示信息 gate 与 plain/protected port 注入；它没有删除或新增 storage timeout。文件中既有的 `device.getDeviceInfo({timeoutMs})` 是 device port 的 timeout，不在 D-01 storage contract 内，故不应被误纳入。

## 3. N-01 owning source 与 focused 断言

当前 `apps/terminal/adapter/android/persist-kv/src/implementations/androidPersistKv.ts` 的链路为：

```text
unknown mode token
  -> isStorageMode
  -> valid: logicalPortOf(valid plain|protected) -> native call
  -> invalid: invalidModeFailure(raw token) without logicalPortOf
  -> stable PERSIST_KV_INVALID_MODE + safe token description + zero native call
```

`apps/terminal/adapter/android/persist-kv/test/androidPersistKv.test.ts` 的 runtime-invalid factory test 现在断言：

```text
port=persistKv               # existing neutral PortFailure slot, not inferred from token
error.code=PERSIST_KV_INVALID_MODE
error.message=persist-kv storage mode is invalid: future
nativeModule=not called
native.read=not called
```

这条 focused 断言证明 token 已进入诊断而非被静默归类；它不把 TypeScript union 当作 native 边界证明，也不外推 Android 行为。

## 4. 本次 fresh subprocess focused/typecheck 输出

四个命令分别在独立 shell subprocess 中执行；每个命令都是“typecheck 成功后再执行 test”，因此 test 输出前的零退出状态也覆盖了对应 typecheck。

### adapter

```text
COMMAND=yarn workspace @catering-v2s/adapter-android-persist-kv typecheck && yarn workspace @catering-v2s/adapter-android-persist-kv test
EXIT=0
Test Files  1 passed (1)
Tests  6 passed (6)
TERMINAL_PACKAGE_TEST=PASS kind=REAL_TESTS package=@catering-v2s/adapter-android-persist-kv
```

### ui-state

```text
COMMAND=yarn workspace @catering-v2s/kernel-base-ui-state typecheck && yarn workspace @catering-v2s/kernel-base-ui-state test
EXIT=0
Test Files  6 passed (6)
Tests  32 passed (32)
TERMINAL_PACKAGE_TEST=PASS kind=REAL_TESTS package=@catering-v2s/kernel-base-ui-state
```

### sample-console

```text
COMMAND=yarn workspace @catering-v2s/ui-integration-sample-console typecheck && yarn workspace @catering-v2s/ui-integration-sample-console test
EXIT=0
Test Files  7 passed (7)
Tests  34 passed (34)
TERMINAL_PACKAGE_TEST=PASS kind=REAL_TESTS package=@catering-v2s/ui-integration-sample-console
```

### dev-host

```text
COMMAND=yarn workspace @catering-v2s/ui-base-dev-host typecheck && yarn workspace @catering-v2s/ui-base-dev-host test
EXIT=0
Test Files  4 passed (4)
Tests  13 passed (13)
TERMINAL_PACKAGE_TEST=PASS kind=REAL_TESTS package=@catering-v2s/ui-base-dev-host
```

## 5. 失败、边界与未执行项

本次四个 remediation 命令均无 first failure；因此没有需要保留的失败日志或 last-known-good 迁移。此次 focused 重跑没有执行 Kotlin、Android、Web 浏览器、release、native device、真机、断电/内核崩溃、多进程、低存储、identity rotation 或 cleanup；这些档位仍沿用既有 evidence 中的实际状态，不能由本次 focused 结果升级。

`M-01` 的交付闸现在由逐文件表和本证据的有限扫描共同覆盖，`N-01` 的 owning source 与 focused assertion 已闭合；不存在需要 Dexter 新裁的产品或范围问题。修复后的当前字节尚需交 Claude 进行下一轮独立 implementation review。
