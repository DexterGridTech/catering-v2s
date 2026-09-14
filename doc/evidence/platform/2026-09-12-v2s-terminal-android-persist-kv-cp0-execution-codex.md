# TER Android persistKV / persistSecure CP-0 执行记录

```text
RUN_DATE=2026-09-12
RUN_KIND=STATIC_CP0_SOURCE_FREEZE
AUTHORITY=Dexter direct implementation authorization, limited to persistKV/persistSecure plan
CP=CP-0
GATE=READY
BUSINESS=READY
CLEANUP=N/A (no long-running process, device, or temporary runtime started)
```

## 输入与边界

- 需求正本：`doc/plans/platform/2026-09-12-v2s-terminal-android-persist-kv-gap-analysis-and-requirements-codex.md`。
- 详设：`doc/plans/platform/2026-09-12-v2s-terminal-android-persist-kv-implementation-design-codex.md`。
- 实施计划：`doc/plans/platform/2026-09-12-v2s-terminal-android-persist-kv-implementation-plan-codex.md`。
- owning source：Kotlin `TerminalPersistKvModule`、TS `androidPersistKv.ts`、`StateStoragePort`、state hydration/engine、Android sample `platformPorts.ts`。
- 本步只做静态 source freeze、artifact signature 和 caller census；没有修改源码、没有构建、没有启动 Android/Web/DEV/seed/UAT/deploy。
- Android sample 的 `platformPorts.ts` 在本步前已有其他任务 dirty change；后续只在其 persist injection seam 做窄修改，保留其他 dirty boundary。

## Dexter 冻结值

设计 §12 已记录十二项：删除 StateStoragePort/native `timeoutMs`；`readMany` 单项损坏整批失败；`listKeys` 不承诺顺序；key/value/batch 上限为 128/256/1 MiB/512 且超限 typed invalid；正常进程重启可恢复但不承诺断电/内核崩溃；retryable 按错误类型、终止恒 true；`SINGLE_PROCESS_MODE` 且不支持多进程；protected 使用 `Settings.Secure.ANDROID_ID`、不可得/不匹配 typed unavailable/failure 且禁止自动 rekey；plain v1 不迁移、不清理、不 fallback；sample 使用真实 protected port；release 矩阵阻断 CP-4。

唯一仍需在 CP-1 实证的工程前置不是产品决策：不能把错误 key 打开的既有 protected 文件误判成新空 namespace。当前实现采用受控文件存在性 `MMKV.checkExist(namespace)` 与 adapter-owned protected marker 的组合；不调用可能改变数据的 `checkReSetCryptKey`/rekey 路径。CP-1/CP-4 记录该组合的真实结果；protected namespace 内单独 marker 不合格。

## 当前字节静态结果

### MMKV artifact

实际解析 artifact：

`/Users/dexter/.gradle/caches/9.3.1/transforms/2d0ebcb5a705b36df192f148cae3e63f/transformed/mmkv-2.4.2-api.jar`

`javap -public -s com.tencent.mmkv.MMKV` 输出确认：

```text
public static final int SINGLE_PROCESS_MODE;
public static MMKV mmkvWithID(String, int, String);
public native String cryptKey();
public boolean reKey(String);
public boolean reKey(String, boolean);
public void checkReSetCryptKey(String);
public void checkReSetCryptKey(String, boolean);
public void sync();
public void async();
```

这是 artifact 的 static capability/signature 证据，不是 MMKV 实际加密、错钥匙检测、sync 耐久或 Android module load 的行为证据。

### state production caller census

当前 state source 直接调用点：

- `listKeys`：`persistenceEngine.ts:449`、`:504`；`persistenceHydration.ts:82`。
- `readMany`：`persistenceEngine.ts:513`；`persistenceHydration.ts:108`。
- `write`：`persistenceEngine.ts:564`。
- `remove`：`persistenceEngine.ts:586`。
- `read`、`writeMany`、`removeMany`、`clear`：当前 state production source 零直接调用点。

这些结果不把 state 的逐键循环误记为 batch caller；R01/R12/R13 的隔离反例仍可在后续 proof 中调用所需方法。

### dirty boundary

CP-0 目标路径当前状态：

```text
M apps/terminal/assembly/android/sample-terminal/src/assembly/platformPorts.ts
?? doc/plans/platform/2026-09-12-v2s-terminal-android-persist-kv-implementation-design-codex.md
?? doc/plans/platform/2026-09-12-v2s-terminal-android-persist-kv-implementation-plan-codex.md
```

目标 adapter source、kernel storage type/state source 在 CP-0 尚未改动；后续实施变更必须逐文件加入 reconciliation。

## CP-0 后置动作

CP-0 已达到进入 CP-1 的静态准入。后续 CP-1～CP-4 已按计划串行完成，实际结果分别见同日期的 CP-1、CP-2、CP-3、CP-4 执行记录；本文件只保留 CP-0 当时的 source-freeze 事实，不把它升级为行为证据。
