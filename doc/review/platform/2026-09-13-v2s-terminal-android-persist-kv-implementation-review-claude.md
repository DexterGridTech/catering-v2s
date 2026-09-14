# TER Android persistKV/persistSecure 实施独立复审 — Claude

```text
REVIEW_TARGET=IMPLEMENTATION
reviewerKind=CLAUDE_INDEPENDENT
VERDICT=NO-GO
M/S/N=1/0/1
EVIDENCE_TIER=static（源码逐行对账 + 变更集穷举 + 读取作者产出的测试报告）;未执行任何构建、测试或动态命令
```

## 0. 出处与方法

v2s-rooted 续接会话,非 fresh acceptance。按当前字节重开 owning source 与四份证据文件逐行核验。**我未执行任何构建、测试、Gradle、adb 或动态命令**——native/Android/release 的结果全部按作者自报处理。为核对"逐代码对账是否覆盖每个实际变更文件",我只读枚举了工作树的变更集合(不执行任何仓库控制动作)。

## 1. 结论

`NO-GO`,`1M / 0S / 1N`。

**实施本身,凡我能静态核验的部分,全部正确且与 D-01～D-12 的冻结文本一致。** 我逐条验过,没有发现任何代码缺陷,细节见 §2。

唯一的 M 不在代码,而在**交付闸**:逐代码对账声明 `RECONCILIATION=COMPLETE` 与 `OPEN_COUNT=0`,但有 **7 个本批实际改动的文件从未出现在对账表里**,其中一个是生产源码。实施计划 §5 第 1 条写的是"枚举实际变更的每个 source/test/package/Gradle/README/evidence 文件;**不得抽样**",第 6 条写的是任一 `OPEN` 不得交付。以本批自己定的规则,交付前置没有满足。

修复很小:补 7 行并逐行确认映射,不必然涉及改代码。

## 2. 逐项核验:brief 的十二个重点,十一项通过

| 核验点 | 结论 | 亲验依据 |
|---|---|---|
| 始终只有一个 adapter/module | **CONFIRMED** | `expo-module.config.json` 仍只注册一个 module;Kotlin 源码中 `: Module()` 子类**计数为 1** |
| mode 在 native 侧严格 closed-set 且无 fallback | **CONFIRMED** | `StorageMode.kt` 第 9-13 行 `resolve(...): StorageMode?`,两个 wireName 之外 `else -> null`;全模块无任何把未知 token 落到 PLAIN 的分支 |
| `PERSIST_KV_INVALID_MODE` 独立稳定 code | **CONFIRMED** | `TerminalPersistKvModule.kt` 第 284 行独立具名,未复用 `PERSIST_KV_OPERATION_FAILED`;JS 侧 `androidPersistKv.ts` 第 135 行同码 |
| invalid mode 在 store open 前 typed failure 且零写入 | **CONFIRMED** | `withStore` 第 123-124 行先 `resolve`、`null` 即 return;`openStore` 直到第 132 行才被调用。**invalid mode 路径上不存在任何 MMKV 交互** |
| plain/protected 使用不同 wrapper、namespace、descriptor | **CONFIRMED** | sample 第 23-24 行两次独立调用工厂 → 两个 frozen 对象;`namespaceId` 第 204-207 行按 mode 取不同前缀;descriptor 带 `port` 与 `mode` 两个字段 |
| `checkExist + marker` 能区分新空 namespace 与错钥 | **CONFIRMED** | `openStore` 第 171 行**在打开前** `MMKV.checkExist(namespace)` 取得不依赖 cryptKey 的存在性;第 178-184 行 `existing && marker != 期望值` → `PERSIST_KV_PROTECTED_KEY_MISMATCH`。新 namespace 走 `!existing` 分支写 marker。**这正是我上轮建议的"不持正确 key 也能读"的第三候选,组合成立** |
| `sync()` 覆盖所有写路径 | **CONFIRMED** | 六处:write(27)、remove(38)、writeMany(68)、removeMany(76)、clear(96)、marker 写入(191)。与 D-06 声称逐一对应 |
| 两个 port 均为真实生产注入 | **CONFIRMED** | `platformPorts.ts` 第 23-24 行 `persistKv` 与 `persistSecure` 各一次真实工厂调用,`unavailablePersistSecurePort` 已移除 |
| `StorageValidation` 是唯一 D-05 校验 owner | **CONFIRMED** | 六个带 key 的方法各自传入对应 validate 回调(entryKey/entry/keys/batch);`listKeys`/`clear` 无 key 故不需要。模块内**无重复的长度或上限校验**——仅有的两处 `isEmpty()` 是初始化与身份读取,不属 D-05 |
| public export / Gradle / package graph / README 同步 | **CONFIRMED** | `src/index.ts` 已导出 `AndroidPersistKvStorageMode` 类型;README 23:40、build.gradle 23:56 均已更新;`skeleton-graph.ts` 未变**是正确的**——adapter 未新增任何 workspace 依赖,protected 由同一 adapter 提供,不产生新边 |
| transcript 与当前字节一致 | **CONFIRMED（限于可静态核验部分）** | APK SHA-256 在 CP-4 证据与 transcript 两处一致;`DEVICE=emulator-5554`、`product:sdk_gtablet_arm64` **如实标为模拟器**;真实 logcat 含 `PERSIST_KV_PROTECTED_KEY_MISMATCH`;文件哈希前后对比 `restore_hash_match=true`;cleanup 精确到 package 与 PID,并明写未按端口或模糊命令名停进程 |
| 未执行边界未被写成 PASS | **CONFIRMED** | 真机、断电、内核崩溃、多进程、低存储、真实 identity rotation、逐 invalid vector 经 public bridge、Web/UI/visual 均登记为未执行 |

**D-01 的传导我另做了穷举**:`StateStoragePort` 八个方法签名**零 `timeoutMs`**;`StateStorageTimeoutPolicy`、`storageTimeouts`、`readMs`/`writeMs`/`resetMs` 在生产代码中**全仓零残留**,没有留下无人消费的死配置;其他端口(script、connector、hotUpdate、appControl、logUpload)的 timeout 未被误删。

**自报数字我独立复核了两个**:adapter 测试文件实为 **6 个 `it(`**,与"6/6"一致;native 测试报告 XML 显示 `StorageModeResolverTest` 2 例、`StorageValidationTest` 5 例,合计 7,`failures=0 skipped=0`,与"5 + 2 = 7/7"**一致**,且用例名是实质描述不是占位。⚠️ 这两份 XML 是**作者那次运行的产物,我读取但未复跑**。

## 3. M finding

```text
[M-01] 逐代码对账遗漏 7 个本批实际变更文件（含生产源码），OPEN_COUNT=0 无法成立
状态：CONFIRMED
严重级别：M
证据档位：static
位置：doc/evidence/platform/2026-09-12-v2s-terminal-android-persist-kv-implementation-reconciliation-codex.md 第 4 行 `RECONCILIATION=COMPLETE`、第 9 行 `OPEN_COUNT=0`；对照实施计划 §5 第 1 条与第 6 条
失败场景：我把对账表点名的文件集合（37 个 apps/terminal 路径）与工作树实际变更集合做差集，再按 mtime 限定到本批实施窗口（09-12 23:00 起），得到 7 个**已改动但从未进入对账表**的文件：

  apps/terminal/ui/integration/sample-console/src/assembly/assembly.tsx（23:27，生产源码）
  apps/terminal/kernel/base/ui-state/test/acceptance.test.ts（23:28）
  apps/terminal/kernel/base/ui-state/test/content.test.ts（23:28）
  apps/terminal/kernel/base/ui-state/test/variableRuntime.test.ts（23:28）
  apps/terminal/ui/integration/sample-console/test/webStorage.test.ts（23:28）
  apps/terminal/ui/base/dev-host/test/webPlatform.test.ts（23:31）
  apps/terminal/ui/base/dev-host/test/webStorage.test.ts（23:31）

我逐个看了 diff 内容以确认归属，不是靠 mtime 推断：三个 ui-state 测试各删一行 `storageTimeouts`；两个 dev-host 测试与 sample-console 的 webStorage 测试各删若干 `timeoutMs: 50`；`assembly.tsx` 删除 `storageTimeouts: {readMs: 2_000, writeMs: 2_000, resetMs: 5_000}`。**七个全部是 D-01 的直接波及，确属本批。**

需要单独说明 `assembly.tsx`：它的工作树 diff 混有三组改动——`surfaceForm` 由可选改必填、`bindSurfaceHostIdentity` 新增 rejection handler、`AdminLauncher` 改为包裹 content，这三组是上一批 admin console 的遗留脏文件；只有 `storageTimeouts` 那一行属本批。但该文件确实被本批编辑过，因此必须出现在对账表里并带明确的范围声明，否则读者无法判断本批对它做了什么。这恰恰是对账表存在的理由。
影响面：交付闸本身。实施计划 §5 第 1 条明写"枚举实际变更的每个 source/test/package/Gradle/README/evidence 文件；**不得抽样**"，第 6 条明写任一 `OPEN` 不得把 implementation 交给 Dexter/Claude review。7 个未被枚举的文件在对账语义下只能是 `OPEN`，因此 `OPEN_COUNT=0` 与 `RECONCILIATION=COMPLETE` 当前**不成立**，本批自己定的交付前置没有满足。

这不是代码缺陷。我看过这 7 个文件的全部改动内容，都是 D-01 的正确波及，没有发现错误。问题在于：一份漏掉生产源码的对账表，无法承担"证明没有遗漏"这个唯一职责。
最小修复方向：把这 7 个文件补进对账表，每行按 §5 第 2 条给出 file 加 unique symbol、需求 ID（D-01）、design anchor、三维行为对照与证据档位；`assembly.tsx` 那行须明确区分"本批改动"与"上一批遗留脏内容"。补完后重跑受影响包的 focused 测试并重新出具 `OPEN_COUNT`。
为什么更小的替代不足：在对账表加一句"其余变更为 D-01 机械波及，不逐项列出"就是 §5 第 1 条点名禁止的抽样；把它们归入"unrelated dirty preservation"也不对——它们不是遗留脏文件，是本批亲手改的，`assembly.tsx` 甚至同时兼有两种身份，正需要逐行说清。
是否需要 Dexter 裁决：否。补齐对账属既有交付纪律。
```

## 4. N finding

```text
[N-01] invalid mode 的失败被标成 plain 端口，诊断指向错误 owner
状态：CONFIRMED
严重级别：N
证据档位：static
位置：apps/terminal/adapter/android/persist-kv/src/implementations/androidPersistKv.ts 第 222 行 `logicalPortOf`，第 234 行与第 130 行 `invalidModeFailure`
失败场景：`logicalPortOf = (mode) => mode === 'protected' ? 'persistSecure' : 'persistKv'`。工厂第 234 行对**任何**非 `'protected'` 的输入（含非法值）都得到 `'persistKv'`，于是 `invalidModeFailure(portName, capability)` 把失败标成 plain 端口。若调用方本意是构造 protected（例如从非类型化 JS 传入 `'Protected'`），日志与结果会指向 persistKv，排查时被带到错误的 owner。
影响面：仅诊断可读性。**无数据风险**——该路径不触碰 MMKV，且 TypeScript 在仓内阻止非法值，只有未类型化调用方或未来第三个 mode 才可达。PKV-R14 要求诊断能区分 port 与 mode，此处与之轻微不符。
最小修复方向：`invalidModeFailure` 不接受推导出的 port，改为携带原始 `modeToken` 并使用一个不绑定具体逻辑端口的标识（native 侧第 278 行的 `invalidMode` 已经是这个形态，JS 侧对齐即可）。
是否需要 Dexter 裁决：否。
```

## 5. 被推翻的作者结论

**无。** 我核过的每一条自报事实都成立,包括 "adapter 6/6"、"5 个 D-05 校验测试加 2 个 mode 测试共 7/7"、APK hash、`sync()` 六处覆盖、`checkExist + marker` 的区分机制、两个 port 真实注入。

**我上一轮的 `N-01`(marker 放在 protected namespace 内可能无法区分)已在实施中解决**:实现用 `MMKV.checkExist` 在打开前取得不依赖 cryptKey 的存在性信号,再用 namespace 内 marker 判断 key 正确性,两者组合正是我建议的方向。该 note 撤回。

## 6. 未执行的证据档位

- **static**：本评审的全部结论,来自源码与文档对账、变更集穷举、以及读取作者产出的测试报告 XML。**我未执行任何命令。** 作者自报的 typecheck、skeleton gate 与 `git diff --check` 按自报处理。
- **focused**：作者自报 adapter 6/6、kernel 既有测试通过。我核了用例数与用例名,**未复跑**。
- **native**：作者自报 Kotlin 编译通过、7/7。我从 `testDebugUnitTest` 的 XML 独立核了 2 + 5 与 `failures=0`,**未复跑**;该 XML 是作者那次运行的产物。
- **Android**：作者自报模拟器上 release module load、双 mode hydrate、隔离、错钥 mismatch、恢复通过。transcript 内容自洽且如实标注为 `emulator-5554`。**我未执行,不外推真机。**
- **release**：作者自报 `assembleRelease` 与安装通过,APK hash 两处一致。**我未复算该 hash**(未取得 APK)。
- **cleanup**：作者自报精确 package、临时文件、probe namespace、PID、root 状态已清理,transcript 有对应输出。**我未验证设备现状。**
- **仍为 `UNVERIFIED_REQUIRES_EVIDENCE` 的边界**：Android 真机、断电、内核崩溃、多进程、低存储、真实 identity rotation、每个 D-05 invalid vector 经 public Expo bridge 的逐项验证、Web/UI/visual。这些**不得**由 native helper、模拟器结果、测试数量或计划内容替代;当前文档对它们的登记正确。

## 7. 授权边界

本文是对当前实施的独立评审输入,**不自动成为新权威**。不授权扩范围、改需求、Web、DEV、seed、UAT、部署或任何 Roadmap step。

`M-01` 与 `N-01` 均在既有批准边界内可自主处置,**不需要 Dexter 裁决**。`M-01` 修复后应重新出具对账与 `OPEN_COUNT`,再按既定流程交 Dexter 与我复核;在此之前,按本批自己的 §5 第 6 条,implementation 不具备交付条件。
