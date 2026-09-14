---
title: TER Android persistKV/persistSecure 共用适配器完整性缺口分析与优化补齐需求正本
documentKind: GAP_ANALYSIS_AND_REQUIREMENTS
author: Codex
status: READY_FOR_DEXTER_AND_CLAUDE_REVIEW
reviewTarget: REQUIREMENTS
scope: apps/terminal/adapter/android/persist-kv（同时承载 persistKv 与 persistSecure 两种模式）
securityGoal: LOCAL_OBFUSCATION_ONLY
authority: Dexter 当前直接指派；本文不是详设、实施计划或实施授权
---

# TER Android persistKV 适配器完整性缺口分析与优化补齐需求正本

## 0. 文档性质、边界与真相源

本文只做三件事：

1. 解释当前 Android 终端日志中“看起来像 persistKV”的错误究竟能由什么证据支持；
2. 以当前仓内 owning source 评估 `apps/terminal/adapter/android/persist-kv` 的完整性、效率、健壮性和证据缺口；
3. 形成下一轮详设可以消费的需求边界、验收义务和 Dexter 待裁决项。

本轮产品目标已经明确收窄为：`persistSecure` 只需要避免存储文件被直接看懂，不要求抵抗 APK/数据提取、逆向、设备接管或密钥恢复。允许 `persistKv` 与 `persistSecure` 共用一个 Android/Kotlin adapter 和同一个底层 MMKV 能力；两者仍保留不同的逻辑 port、namespace 和 mode，避免普通 KV 被误当成 protected storage。本文不引入 Android Keystore、硬件绑定、密钥轮换或复杂迁移体系作为本轮前置。

本文不写详细设计，不写实施计划，不修改源码、测试、依赖或构建配置，也不授权重新运行 Android、Web、DEV、seed、UAT 或部署。

事实优先级固定为：当前仓内源码与契约 > 当前可定位的运行日志 > 当前已执行且可复现的测试证据 > 文档声称。旧 review、旧 handoff、README、注释和测试名称都不能替代行为证据。

证据档位必须分开写：

| 档位 | 本文含义 | 本文是否把它当作 Android persistKV 完整通过 |
|---|---|---|
| `static` | 当前源码、类型、装配、依赖和文档的逐行对账 | 否；只能证明形状或暴露静态缺口 |
| `focused` | JS/TS 适配器或纯函数的定向测试 | 否；不能证明 Kotlin、Expo bridge、MMKV 或重启 |
| `native` | Kotlin/Android 原生单测或编译证据 | 否；除非用例真实覆盖目标行为 |
| `Android` | 真实 APK、真实 Expo module、真实 MMKV 和设备/模拟器行为 | 只能证明被实际执行的场景 |
| `release` | 目标 ABI、minSdk、打包产物和发布构建 | 不能由 debug 或缓存 artifact 外推 |
| `Web` | Web dev-host 行为 | 不属于 Android persistKV 证据；不得相互升级 |
| `visual` | 像素/UI 视觉证据 | 与本适配器的 KV 正确性无关 |

当前本文没有重新运行 Android；历史日志的 Android 结论因此标为“历史 Android 证据”，当前字节的完整 Android 结论仍为 `UNVERIFIED_REQUIRES_EVIDENCE`。

## 1. 先给结论：错误归因与适配器质量是两个问题

### 1.1 当前“很多错误”不是普通 persistKV 读写失败，但属于同一持久化链路的未接入 protected mode

在现有 `/tmp/ter-cp7-android-all.log` 中：

- `persistKv` 的 descriptor 被记录为八项能力全部 `state: 'real', source: 'adapter'`（历史 Android 日志第 1208–1218 行）；
- MMKV 2.4.2 的 arm64 native library 成功加载、初始化并打开
  `catering-v2s.terminal.state.v1.sample-terminal-android`，随后成功读出 10 个 key-value（第 1555–1573 行）；
- 重复的 `E ReactNativeJS` 持久化错误实际写的是 `persistSecure.listKeys: adapter not injected` 和
  `protected storage baseline is unavailable`（第 1575–1664 行），其来源是 `sample-terminal` 明确注入的
  `unavailablePersistSecurePort`，不是 Android persistKV（`apps/terminal/assembly/android/sample-terminal/src/assembly/platformPorts.ts:19-31`）。

因此，当前可确认的最小结论是：历史运行中 persistKV 至少完成了 module 加载、MMKV 初始化和一次已有数据读取；历史日志中的重复持久化 error 主要是 protected storage 不可用路径。它没有证明 persistKV 八项方法都正确，也没有证明当前字节无 persistKV 缺陷。

即使某个复核环境无法读取上述 `/tmp` 日志，错误洪水的产生机制仍可由当前源码独立确认：`persistenceHydration.ts:76-104` 按 `storageKind` 遍历并对每个有条目的 kind 调 `listKeys`，`persistenceEngine.ts:445-466` 的 reset、`:306-378` 的 flush/migration 路径以及 `:495-520` 的 rebaseline 也会按 kind 访问端口；`unavailablePersistSecurePort` 的八项方法全部返回 unavailable。因此，源码可以确认“protected port 未接入会重复制造 unavailable/error”的机制，但不能在没有日志文件时继续声称某次历史运行的具体次数、时间或完整 error 文本。

因此，错误的直接根因不是普通 `persistKv` 的 MMKV 读写，而是当前 sample 仍把 protected storage 注入成 unavailable。由于本轮已经明确要求“同一 adapter 提供普通模式和简单混淆模式”，这条 protected mode 接入应纳入本轮需求闭环；不能再把它当成完全无关的外部问题。

这里的“共用一个 adapter”允许一个 Kotlin Expo module、一个 package 和一套底层 MMKV 辅助逻辑同时服务两种 mode；但 `persistKv` 与 `persistSecure` 仍必须是两个逻辑 port/wrapper、两个 namespace 或等价的可验证隔离域。不得把同一个 port 对象同时注入两处，因为当前 state runtime 明确拒绝 plain/protected 使用同一物理 port（`apps/terminal/kernel/base/state/src/foundations/createStateRuntime.ts:96-100`）。

本轮不把 protected mode 命名解释成强密码学保证。若未来要求抵抗设备文件提取或真正的密钥保密，必须另立需求和裁定；不得在本轮用“简单加密”一词暗示更强保证。

### 1.2 共用 adapter 当前是“普通模式形状已接线，protected mode 尚未接入，行为未闭合”

当前源码确实存在完整的八方法 TS/Kotlin 表面并接入 Android sample assembly 的普通 `persistKv`；但 protected `persistSecure` 仍由 unavailable 默认实现提供。以下行为缺口已经由当前源码直接确认：

- `timeoutMs` 在 JS 和 Kotlin 两侧都被接收/转发却没有任何截止、取消或 timed-out 产生逻辑；
- JS bridge 把 module 查找、方法不存在、bridge rejection、native 结果异常等所有异常压成同一个 `PERSIST_KV_BRIDGE_FAILED`，并无运行时结果形状验证；普通和混淆 mode 都会继承这个边界问题；
- Kotlin `writeMany` 逐项写入，后项失败时前项已经落地，但端口返回类型只有 `NoOutput`，没有部分提交收据；
- 现有 focused 用例只真正调用了 `read`、`write`、`clear` 和一个被 mock 的 `writeMany` 失败结果，没有执行 Kotlin/MMKV；
- 普通 state flush 当前逐条调用 `write`，`writeMany` 并不是现有刷盘路径的性能证明；
- 当前没有本轮新鲜的 Android 八方法、进程重启、并发、损坏数据、空间不足、超时、两种 mode 隔离或 release 证据。

所以本文不预先写正式 `GO/NO-GO`。它把“普通模式结构可见”“protected mode 尚未接入”“实现有缺口”“尚缺 Android 证据”和“需要 Dexter 选择的端口语义”分开交给 review。

## 2. 输入材料与当前字节核验范围

本次只读重开了以下材料和 owning source：

| 材料 | 用途 |
|---|---|
| `AGENTS.md`、`PLATFORM-BLUEPRINT.md`、`doc/platform/README.md`、当前 Roadmap 授权字段 | 恢复仓库边界、执行授权和 TER 约束 |
| `project-memory/index.md` 及本任务六维路由命中的 kernel/operations/pitfalls | 恢复 source-first、日志、证据、失败处置和 Android 截图边界 |
| `scripts/README.md`、`doc/platform/terminal-coding-standard.md` | 核对 TER 包、README、端口、持久化和事件/诊断规范 |
| `apps/terminal/kernel/base/platform-ports` | 核对 `StateStoragePort`、`PortResult`、不可用/失败/超时契约 |
| `apps/terminal/kernel/base/state`、`kernel/base/runtime` | 核对 hydration、flush、错误判定和真实 consumer 路径 |
| `apps/terminal/adapter/android/persist-kv` 全包 | 核对 JS bridge、Kotlin module、MMKV、package/test/docs |
| `apps/terminal/assembly/android/sample-terminal` | 核对 Android 接线和 persistSecure 邻接边界 |
| `doc/evidence/platform/terminal-skeleton/batch-1/cp4-adapter-codex.md` | 只作历史 provenance；它明确说 CP-4 未证明 native build/runtime |
| `/tmp/ter-cp7-android-all.log` 等历史 Android 日志 | 只作历史 Android 证据；不外推当前字节 |

历史 CP-4 记录的 `CP4_NATIVE_BUILD=UNVERIFIED`，且明确把 native runtime 和 persist-KV capability 留在 CP-4 范围外（`doc/evidence/platform/terminal-skeleton/batch-1/cp4-adapter-codex.md:12-31,292-297`）。它不能被后来的文档数字替换成“完整验证”。

## 3. 当前源码事实表

下表只陈述能从当前源码直接读出的事实；“事实”不等于“设计正确”，也不等于“运行通过”。

| ID | 状态 | 当前事实与精确位置 | 影响/边界 |
|---|---|---|---|
| F-01 | `CONFIRMED_STATIC` | `StateStoragePort` 暴露 `read/write/remove/readMany/writeMany/removeMany/listKeys/clear` 八项（`apps/terminal/kernel/base/platform-ports/src/types/storage.ts:3-21`）；Android TS native module 和 Kotlin module 均声明八项（`apps/terminal/adapter/android/persist-kv/src/implementations/androidPersistKv.ts:18-27`；`.../TerminalPersistKvModule.kt:7-92`） | 结构面完整，但只证明有方法名和类型；不证明每项行为 |
| F-02 | `CONFIRMED_STATIC` | Android sample assembly 把 `createAndroidPersistKvPort('sample-terminal-android')` 注入 `persistKv`，把 `persistSecure` 注入为 unavailable（`apps/terminal/assembly/android/sample-terminal/src/assembly/platformPorts.ts:17-31`） | 可解释历史 error 来源；当前要求是同一 adapter 提供第二种 mode，但两个逻辑 port 仍不能混为一谈 |
| F-03 | `CONFIRMED_ANDROID_HISTORICAL` | 历史日志记录 persistKv 八能力均 real/adapter，MMKV arm64 载入并读出 10 个值（`/tmp/ter-cp7-android-all.log:1208-1218,1555-1573`） | 只证明该次运行的一条加载/读取路径；不是八项完整 Android PASS |
| F-04 | `CONFIRMED_STATIC`（历史日志为可选佐证） | 当前源码中 `unavailablePersistSecurePort` 的八项方法全部返回 unavailable（`apps/terminal/kernel/base/platform-ports/src/defaults/unavailablePersistSecure.ts:6-13`）；若历史日志可读，同一日志还记录了 `persistSecure.listKeys: adapter not injected` 和 protected baseline unavailable（`/tmp/ter-cp7-android-all.log:1575-1664`） | 源码已确认 protected mode 未接入会在 hydrate/flush/reset/rebaseline 路径重复产生 unavailable/error；具体历史运行的次数和文本只有日志可读时才能确认；本轮应由共用 adapter 的第二种 mode 闭合，不能靠普通明文 KV 冒充 |
| F-05 | `CONFIRMED_STATIC` | `callNative` 每次操作重新 `requireNativeModule('TerminalPersistKv')`，捕获所有异常并返回固定 bridge failure（`androidPersistKv.ts:29-50`） | module/method 缺失、bridge rejection、native 异常和返回值损坏不可区分；重复查找效率和诊断均未定义 |
| F-06 | `CONFIRMED_STATIC` | JS 侧仅以 `PortResult<T>` TypeScript 类型承接 native 返回，没有运行时验证；state 层的 `isSucceeded` 只检查 `result.status === 'succeeded'`（`apps/terminal/kernel/base/state/src/foundations/persistencePrimitives.ts:133-136`） | malformed succeeded result 可能被当成成功继续消费；类型声明不是 bridge wire 校验 |
| F-07 | `CONFIRMED_STATIC` | `timeoutMs` 被传到每个 TS wrapper，但 Kotlin 参数命名为 `_timeoutMs` 且未使用；Kotlin `withStore` 也不产生 timed-out（`androidPersistKv.ts:56-70`；`TerminalPersistKvModule.kt:11-92`） | caller 以为有超时保护，实际 native 卡住时无明确边界；与 `PortTimedOut` 契约不闭合 |
| F-08 | `CONFIRMED_STATIC` | `writeMany` 在 `TerminalPersistKvModule.kt:55-72` 中按索引逐项 `encode`；中途 false/throw 直接返回，之前的 entry 不回滚；返回仍是 `NoOutput` | “原子批量”与“允许部分提交”两种语义都能从现状猜出；恢复策略和调用者可见收据没有冻结 |
| F-09 | `CONFIRMED_STATIC` | state hydrate 使用 `listKeys` 后过滤并调用 `readMany`（`persistenceHydration.ts:81-110`）；普通 persistence flush 的单项写入走 `write`（`persistenceEngine.ts:558-579`） | 批量 API 的存在不等于实际 flush 高效；当前 kernel consumer 全量清单见 F-19，优化归属必须与 state owner 分开，不应凭接口数量宣称高效 |
| F-10 | `CONFIRMED_STATIC` | 当前 JS 测试只对 `read`、`write` 做 opaque forwarding，对 `clear` 做一次 bridge throw，对 native mock 返回的 `writeMany` failure 做一次映射（`apps/terminal/adapter/android/persist-kv/test/androidPersistKv.test.ts:10-113`） | 其余方法、wire 形状、超时、初始化、Kotlin/MMKV、重启和故障注入均未被该测试执行 |
| F-11 | `CONFIRMED_STATIC` | Kotlin 只拒绝 `persistenceKey.isEmpty()`（`TerminalPersistKvModule.kt:98-106`）；namespace 是固定前缀加 UTF-8 percent encoding（`:120-137`） | 空白、长度、控制字符、键冲突、容量和跨版本迁移边界未形成需求或证据；编码是否对全部允许输入保持 injective 也未有测试 |
| F-12 | `CONFIRMED_STATIC` | `MMKV.initialize` 与 `mmkvWithID` 在 `initializationLock` 内首次初始化，`initialized` 是 module 实例内 Boolean；其它异常统一为 `PERSIST_KV_OPERATION_FAILED`（`TerminalPersistKvModule.kt:95-118`） | 有基本互斥，但 concurrent first call、初始化失败后行为、module 生命周期、context 暂不可用和重试语义未定义 |
| F-13 | `CONFIRMED_STATIC` | error 中固定 `retryable: true`；按 key 失败时把原始 key 放入 wire error（`TerminalPersistKvModule.kt:156-169`）。当前全仓生产代码中可定位到的 `retryable` 消费点只有 `createPowerStatusBridge.ts:32`，没有 persistKV 重试循环 | 这是错误契约和未来误用风险，不是当前已经观测到的 persistKV 重试洪水；key 可能承载不应出现在日志/错误面的业务标识，脱敏边界未证明 |
| F-14 | `CONFIRMED_STATIC` | `read` 先 `containsKey` 再 `decodeString`，存在但 decode 为 null 返回 typed failure；`readMany` 遇首个 decode null 即整个 batch failure（`TerminalPersistKvModule.kt:11-20,37-53`） | “损坏一个键时其它键是否可恢复”“batch 是全成败还是部分结果”尚未成为稳定契约 |
| F-15 | `CONFIRMED_STATIC` | `remove`、`removeMany`、`clear` 调 MMKV 删除/清空后直接 success；`listKeys` 返回当前 MMKV instance 的 `allKeys()`（`TerminalPersistKvModule.kt:74-92`） | 幂等性、排序、重复 key、clear 的精确范围和方法返回成功的 durability 含义都需要明确证明 |
| F-16 | `PARTIALLY_CONFIRMED` | package 固定 `com.tencent:mmkv:2.4.2`，AAR 本地缓存含 arm64-v8a/x86_64 native library（`apps/terminal/adapter/android/persist-kv/android/build.gradle:9-10`；本机缓存 artifact） | 只能证明依赖可定位、缓存含两个 ABI；未证明目标 release 的全链 Gradle、minSdk、ABI、R8、安装和启动 |
| F-17 | `PARTIALLY_CONFIRMED` | `lintOptions { abortOnError false }`，package `tsconfig` 只 include `src`，test 使用 Vitest node environment（`android/build.gradle:19-21`；`tsconfig.json:1-7`；`vitest.config.ts:1-10`） | lint/test 编译边界可能漏掉 native 和测试问题；是否违反当前 release 门须由详设和实际构建证据决定，本文不替它下结论 |
| F-18 | `UNVERIFIED_REQUIRES_EVIDENCE` | 当前没有新鲜 Android 运行、进程重启、并发、MMKV 文件损坏、空间不足、bridge timeout、模块缺失、release APK 证据 | 不能把历史 debug load/read 或当前源码形状扩写成完整实现接受 |
| F-19 | `CONFIRMED_STATIC` | 当前 kernel/base/state 的生产调用点清单为：`listKeys` 3 处（`persistenceHydration.ts:82`、`persistenceEngine.ts:449,504`）、`readMany` 2 处（`persistenceHydration.ts:108`、`persistenceEngine.ts:513`）、`write` 1 个集中调用点（`persistenceEngine.ts:564`）、`remove` 1 个集中调用点（`:586`）；直接生产调用点为 0 的是 `read`、`writeMany`、`removeMany`、`clear`。`persistenceEngine.ts:287-301,445-466` 只是逐键 flush/reset 循环，是未来批量化的候选 owner 路径，不是这些 batch 方法的当前 caller | 本轮不能把零消费者方法写成已有 workload 的一般性能闭环；它们仍需保持端口契约和静态可用形状，出现真实生产 caller 后再重开对应的一般行为、性能和失败语义。PKV-R01/R12/R13 的跨 mode/namespace 隔离反例是边界不变量的例外证明，不改变该 caller census |

## 4. 缺口族：失败场景、影响与最小补齐方向

本节将单点事实抽象成可复用的问题族。每个问题族都要求后续修复同时补行为和反例证据，不接受只改文案、只增加存在性断言或只把日志级别调低。

### G-01 · 同一 adapter 的两种 mode 没有形成可区分的 port 边界

- 状态：`CONFIRMED_STATIC`（历史 Android 日志可作为附加证据；不可读时不影响下述源码机制结论）。
- 失败场景：同一个底层 adapter 只提供 plain mode，sample 仍把 protected port 接成 unavailable；state hydration 和 flush 反复对 protected storage 调 `listKeys`，console 出现 error。另一个危险反例是直接把 plain port 复用给 protected consumer，错误看似消失但 protected 语义被抹掉。
- 影响：当前 error 无法闭合；或普通数据与混淆数据落入同一逻辑空间，`clear`/读取范围和恢复语义发生串扰。
- 最小补齐方向：同一个 Kotlin/Expo adapter 提供 plain 与 local-obfuscation 两种 mode；JS 创建两个不同的逻辑 port/wrapper 和隔离 namespace，sample 的 `persistSecure` 改接第二种 mode。不得把同一个 port 对象同时注入两处，也不得以普通明文 KV 冒充 protected mode。
- 本轮不设计独立 secure package、Keystore 或强密码学体系；只冻结“共用实现、逻辑隔离、弱混淆保证”的边界。

### G-02 · timeout 形状存在、行为不存在

- 状态：`CONFIRMED`（`StateStorageCall.timeoutMs`、TS wrapper 和 Kotlin `_timeoutMs` 逐行核对）。
- 失败场景：native module 永不 resolve，caller 设置 `timeoutMs=50`；当前实现持续等待，既不返回 `timed-out`，也不产生可区分诊断。
- 影响：启动 hydrate、flush 或 reset 可能长期挂起；state 层的 degraded/blocked 机制无法按时间边界接管。
- 最小补齐方向：由 Dexter 选择“真正执行 deadline/cancellation”或“移除/重定义 port timeout 契约”；不能继续接受一个被静默忽略的参数。

### G-03 · bridge 结果不是封闭的运行时协议

- 状态：`CONFIRMED`（TS 类型与 state `isSucceeded` 的实际判定）。
- 失败场景：native 返回 `{status:'succeeded'}`、错误的 `port`、缺少 `value`、未知 `status` 或错误 shape；当前 JS 直接透传，state 可能只看 status 就当成功，或让坏数据在更远处抛错。
- 影响：根因被推迟并改写；“成功但没有完成名义动作”违反 TER `TR-02`。
- 最小补齐方向：在唯一 bridge 边界定义并验证闭合 result shape；无效 wire 必须转为 typed failure/timed-out，不得让 malformed success 穿过。

### G-04 · JS bridge 同码且 retryable 恒真；当前 persistKV 无生产重试消费者

- 状态：`CONFIRMED_STATIC`（`androidPersistKv.ts:29-50`、`TerminalPersistKvModule.kt:114-117,156-169`）；当前没有 persistKV 的生产重试循环，`retryable` 风险目前是契约潜在误用而非已观测的活动洪水。
- 失败场景：module 未安装、方法不存在、context 未就绪、bridge rejection 或 native 结果异常在 JS 侧都被压为 `PERSIST_KV_BRIDGE_FAILED`；Kotlin 虽有多个 code，但所有 failure 都写成 `retryable=true`。
- 影响：当前调用方缺少稳定的重试/阻断/提示分类；未来若任何 consumer 依赖该字段，坏 key、损坏文件或不可恢复错误可能被错误重试并放大日志和延迟。这个风险不能写成当前已有 persistKV retry flood。
- 最小补齐方向：按真实失败类定义稳定 code、可重试性和安全诊断字段；保留必要上下文但不输出 raw throwable、值、口令、token、cookie、手机号或未经脱敏的标识。

### G-05 · 批量写的部分提交没有契约，但当前没有生产 caller

- 状态：`CONFIRMED_STATIC`（Kotlin 循环写入路径）；当前 `writeMany` 没有直接生产 caller，原子/部分语义不在本批 workload 裁决范围。
- 失败场景：未来三项 `writeMany` 中第三项 `encode=false`；前两项已经写入，结果却只有一个失败对象，调用方不知道应重试整批、重写前两项还是回滚。当前 state flush 仍走集中 `write`，不能把这个未来场景描述成现行 state 故障。
- 影响：一旦有 consumer 采用 `writeMany`，状态快照可能混合新旧版本；现在的影响是契约提前未冻结，而不是已经发生的 batch 恢复风险。
- 最小补齐方向：在真实 caller 进入前保持 static-only；出现 caller 后再由该 owner 与 Dexter 决定全批原子或部分提交，并把已提交/未提交边界纳入契约和恢复语义。不能继续以 `NoOutput` 加一句“首个失败”冒充完整批量语义。

### G-06 · 初始化生命周期和并发边界未闭合

- 状态：`CONFIRMED_STATIC` 说明当前只实现了一个 synchronized 区段；完整行为为 `UNVERIFIED_REQUIRES_EVIDENCE`。
- 失败场景：多个 JS 调用同时首次进入；application context 暂不可用后恢复；`MMKV.initialize` 抛出一次异常后下一次调用；module 被重新创建但 MMKV 已初始化。
- 影响：可能重复初始化、永久落入错误状态、误报 unavailable 或把初始化失败当普通 operation failure。
- 最小补齐方向：定义“一次初始化”的生命周期、并发一致性、失败后的可恢复性和 context 不可用策略，并以真实并发/失败注入证明。

### G-07 · namespace/key 与设备绑定混淆边界未冻结

- 状态：`PARTIALLY_CONFIRMED`；编码机制存在，但合法输入域、mode 隔离、设备身份变化和迁移策略未定义。
- 失败场景：两个不同输入生成相同 namespace；空白/过长/control key 进入 MMKV；混淆 key 变化后旧值被静默当作 missing；或 secure mode 误读 plain namespace。
- 影响：跨 assembly/mode 数据串读、重启后状态丢失或不可诊断的恢复失败。
- 最小补齐方向：冻结 persistenceKey/key 合法域、plain/protected namespace 隔离、设备身份不可得/变化时的 typed failure 或明确清空策略；在 Dexter 决定前不得自行更换 namespace 或加明文 fallback。具体身份字段和简单可逆变换留给详设，不把它升级为强安全设计。

### G-08 · “写成功”与真正耐久的边界未定义

- 状态：`UNVERIFIED_REQUIRES_EVIDENCE`，不是当前源码已经证明的 bug。
- 失败场景：`encode` 返回 true 后进程立即被杀；下一次独立 runtime 读取不到刚写值，或清空/删除在 crash 后只完成一半。
- 影响：state 层可能把内存层成功当成重启后必然恢复，业务会在重启后静默回到旧状态。
- 最小补齐方向：明确 success 的耐久保证、允许的 crash window 和不保证的边界，再用独立进程/应用重启的正反断言证明；不以 MMKV API 名称或一次 debug read 代替。

### G-09 · 并发、顺序和单进程声明未被证实

- 状态：当前显式使用 `SINGLE_PROCESS_MODE` 是 `CONFIRMED_STATIC`；其余为 `UNVERIFIED_REQUIRES_EVIDENCE`。
- 失败场景：并发写同 key、write 与 remove 交错、同一批次重复 key、多个异步 bridge 调用交错完成。
- 影响：最后写入者、输入顺序、读到的状态和错误收据不明确；调用方误以为跨进程安全。
- 最小补齐方向：冻结 TER 的单进程适用边界以及每种交错的结果语义；若不支持多进程，必须明确拒绝/不承诺，不添加隐形锁或第二套队列而未证明收益。

### G-10 · “有 batch API”不等于“当前 workload 高效”

- 状态：`CONFIRMED_STATIC` 暴露出 hydration 与 flush 的不同调用形态；性能结论为 `UNVERIFIED_REQUIRES_EVIDENCE`。
- 失败场景：当前 state owner 在 hydrate 使用 `listKeys/readMany`，但 flush/reset 仍分别逐条 `write/remove`；若把 state owner 的逐键循环误归因成 adapter 的 batch 缺陷，可能无授权修改 kernel，或加入复杂缓存/无条件批量后让单条低延迟写变成大批等待。反过来，若真实 key 数增长，逐条 bridge 往返也可能成为瓶颈。
- 影响：可能用额外复杂度换来没有实际收益的优化，或把启动/刷盘延迟藏在“成功”之后；本轮必须把 adapter 完整性和 state owner 的批量化机会分开。
- 最小补齐方向：以 F-19 的真实 caller census 为边界；本批 persistKV 只证明现有调用形态和自身方法能力，不改 state engine。只有 state owner 获得单独范围并确认真实瓶颈后，才分别测 single/batch 的 latency、吞吐、内存和失败放大；不得用 batch API 数量宣称高效。

### G-11 · 测试只证明 mock wrapper，不证明 Android adapter

- 状态：`CONFIRMED_STATIC`（测试源码）+ `UNVERIFIED_REQUIRES_EVIDENCE`（native/Android）。
- 失败场景：JS 测试中 fake native 正确返回，真实 Expo module 注册错误、Kotlin 参数映射错误、MMKV 文件损坏或 ABI 不匹配；所有 focused 用例仍绿。
- 影响：会把 bridge 入口内的逻辑覆盖误报成设备行为覆盖。
- 最小补齐方向：按证据档位补最小但真实的 red mutation：TS wire、Kotlin method/result、Android module load/eight operations/restart/failure/concurrency；每档单独报告，不互相升级。

### G-12 · 包装与 release 兼容性不是缓存 artifact 能证明的

- 状态：`PARTIALLY_CONFIRMED`。
- 失败场景：debug 模拟器 arm64 能加载，但目标 x86_64、不同 minSdk、R8、clean Gradle 或 release packaging 中 module/native lib 未被包含。
- 影响：开发机“能打开”与用户安装包不可交换。
- 最小补齐方向：把受支持 API/ABI、clean build、安装启动、module autolinking 和 release artifact 作为独立证据；当前不因本机缓存存在而扩写支持范围。

### G-13 · “不等于明文”不足以证明文件不能被直接看懂

- 状态：`CONFIRMED_REQUIREMENT_GAP`。
- 失败场景：protected mode 将明文做 base64、hex、字符串反转或 UTF-16 重编码后写入；结果不等于原始明文，却仍可被标准工具直接还原，当前单一“不等于明文”判据会放行。
- 影响：实现可以形式上满足 `LOCAL_OBFUSCATION_ONLY` 的文字，却没有达到“存储文件不应被直接看懂”的真实目标。
- 最小补齐方向：详设必须先核对已解析的 MMKV 2.4.2 artifact 是否提供带 `cryptKey` 的实例 API；若提供，优先复用该现有能力，避免手写密码学。若确实不可用，才提出一套命名、可复现、非纯编码/重排的 Kotlin 端可逆变换，并用已知向量证明读回与文件表示边界。若采用本机身份材料派生参数，必须用两个不同身份输入证明相同明文产生不同 protected 表示；无论采用哪种实现，都不得用“只是不等于明文”的存在性断言收口。

## 5. 优化补齐需求

以下是需求，不是实现步骤。实现可选择不同内部机制，但必须满足行为、边界和证据义务。每条的“最小可证伪要求”是未来 review 的必要输入，不是允许用一条存在性测试代替行为测试。

### PKV-R01 · 共用 adapter、分离 mode 与安全目标

`persistKv` 与 `persistSecure` 可以共用一个 Android/Kotlin adapter、一个 Expo module 和一套底层 MMKV 辅助逻辑。两者必须仍是两个逻辑 port/wrapper、两个可验证隔离的 namespace 或等价 mode；不能把同一个 port 对象同时注入 plain/protected 两处。

本轮 `persistSecure` 的目标仅是 `LOCAL_OBFUSCATION_ONLY`：避免存储文件被直接看懂，不承诺抵抗 APK/数据提取、逆向、设备接管或密钥恢复。允许在 Kotlin 边界对 opaque string 做简单可逆混淆/加密，并使用稳定的本机身份材料派生同一设备上的转换参数；具体字段和算法由详设选择，不在需求阶段引入 Keystore、硬件绑定、密钥轮换或复杂迁移体系。详设准入时必须先核对实际解析到的 MMKV 2.4.2 artifact 是否已有带 `cryptKey` 的实例 API；若确有，应优先复用，不能无理由手写同类转换。

本轮不为密码、OTP、token、cookie、Authorization、密钥或其他任何数据类别提供“真正保密”的承诺；如果未来需要强安全，必须另立需求，不能把本 mode 的结果当作替代。最小可证伪要求：plain mode 写入保持原始 opaque string 语义；protected mode 必须使用已命名且可复现的非纯编码/重排可逆变换，持久化表示不能直接等于明文或只是 base64、hex、反转、UTF-16 等标准表示变换；同一设备/安装重启后能按同一 mode 读回；若变换参数采用本机身份材料，则两个不同身份输入下相同明文的 protected 表示必须不同；mode/身份材料不可用或变化时必须 typed failure/unavailable，不能静默当作 missing 或退回明文。

最小隔离证明不能只比较两个 JS port 对象：同一 key 在一种 mode 写入后，另一种 mode 的 `read` 必须返回 missing，两个 mode 的 `listKeys` 不能包含对方的 key；实现必须使用不同的物理 namespace identity 或等价的可观察隔离边界。实施/验证必须正面断言 plain 与 protected 的两个 port 引用不是同一对象，并分别断言各自 descriptor 的 mode、state、source 正确；port 对象不相同只是必要条件，不是 mode 隔离的充分证明。

### PKV-R02 · 八项方法的闭合语义

八项方法必须都满足 `StateStoragePort` 的输入/输出契约：

- `read` 必须区分不存在与存在但值为空字符串；
- `write` 必须区分名义动作完成与仅受理/未落地；
- `remove` 必须冻结不存在 key 的幂等结果；
- `readMany` 必须冻结输入顺序、重复 key、空数组以及单个 decode failure 对整批的影响；
- `writeMany` 必须冻结输入顺序、重复 key、空数组和部分失败结果；
- `removeMany` 必须冻结不存在 key、重复 key 和空数组行为；
- `listKeys` 必须冻结范围、是否排序、是否允许重复以及与 state 层过滤的责任；
- `clear` 只能作用于目标 persistence namespace，并冻结幂等和返回成功的含义。

任何未写入本条的批量/顺序语义都不能在详设或实施中自行猜定，必须进入 Dexter 决策表。当前生产 caller census 见 F-19：`listKeys` 有 3 处、`readMany` 有 2 处、`write` 与 `remove` 各有 1 个集中调用点；`read`、`writeMany`、`removeMany`、`clear` 当前没有直接生产调用点。对这四个零消费者方法，本批只要求其一般独立方法语义的 static contract、导出/descriptor 形状和禁止误接线的静态核验，不把它们写成已有 workload 的 focused/native/Android 行为或性能闭环；一旦出现真实生产 caller，必须先重开相应行为、失败语义和性能证据。例外是 PKV-R01/R12/R13 明确要求的跨 mode/namespace 隔离边界证明：它可以在专门的 focused/native/Android 反例中调用 `read`、`listKeys` 或 `clear`，但这只是验证 adapter 的隔离不变量，不把这些调用计入 production caller census，也不构成 batch workload。

### PKV-R03 · bridge wire 必须运行时封闭

JS/native 边界必须验证 `PortResult` 的完整 shape，而不能把 TypeScript 泛型当作运行时验证。成功结果必须具有与 capability 对应的合法 value、`completedAt` 和 `port/capability` 事实；失败、不可用、超时必须是可区分且闭合的联合成员。未知 status、缺字段、错误类型、错误 port/capability 都必须变成 typed failure，不能穿过 state 层。

最小可证伪要求：对每一项 result 形状至少有一个合法正例和一个 malformed red mutation；重点包括 `{status:'succeeded'}` 缺 value、未知 status、错误 capability 和 `read` 的非法 value state。

### PKV-R04 · 错误分类和 retryable 语义

必须区分：

1. 适配器/模块不可用；
2. 参数或契约拒绝；
3. bridge 传输失败；
4. MMKV 初始化/文件/编码/容量/底层操作失败；
5. 调用达到截止时间。

每类必须有稳定 code、对应 capability、是否可重试的规则和安全诊断字段。`retryable` 不得所有路径恒为 true。原始 throwable、原始 value、敏感 key 和其他 PII 不得出现在日志或 wire message；若业务 key 需要诊断，必须有明确脱敏规则。本批当前未发现 persistKV 的生产重试消费者，因此这里首先是 bridge/typed contract 义务和潜在误用防线，不得把它表述成已有的 persistKV 重试洪水；证据至少要到 static 与 typed 层，真实 retry 行为需在出现 consumer 后按其 owner 重开。

### PKV-R05 · timeout 必须是真实语义

必须在以下二者中由 Dexter 选定其一：

- `timeoutMs` 是实际执行截止时间，超时返回 `PortTimedOut`，并定义 native 操作超时后是否仍可能在后台完成；
- 端口不承诺 timeout，移除或重新命名该参数并同步所有 consumer。

不得继续保留“接受 timeout 参数但不执行 deadline/cancellation”的中间状态。若底层无法取消，仍必须明确 caller 可观察的超时与迟到结果边界，不能假装取消成功。

### PKV-R06 · 初始化与 module 生命周期

必须定义并证明：MMKV 初始化的生命周期单位、application context 不可用时的结果、并发首次调用、初始化失败后的下一次调用、module 重建以及已初始化状态的可复用性。初始化不能以一次失败后永久静默坏掉，也不能在并发下让一个调用看到假成功、另一个调用看到不同的初始化事实。

### PKV-R07 · namespace、key 与本机身份材料边界

必须冻结：

- persistenceKey 和 entry key 的允许字符、空白、控制字符、长度和总量边界；
- namespace 映射的 injective 性和跨进程重启稳定性；
- 不同 persistenceKey、plain/protected mode、不同 assembly 的隔离；
- protected mode 使用的本机身份材料在同一设备/安装重启期间可重现；材料不可得或变化时的 typed 结果；
- schema/version 变化的迁移、拒绝或清理策略。

当前 `v1` namespace 不得在没有裁定的情况下改名、加 fallback 或把旧文件当新格式吞掉。plain 与 protected mode 不得共享会导致明文/混淆误读的实例。输入拒绝和身份材料不可用必须是 typed failure/unavailable，不得抛出未分类异常或返回 missing。旧 namespace 的保留、迁移、拒绝或清理必须在首次改变 namespace/version 前明确 owner 与生命周期，不能让旧 MMKV 文件成为无人认领的隐性状态。

### PKV-R08 · 普通持久化与弱混淆的重启边界

必须明确“write succeeded”保证的是内存接受、MMKV 文件写入还是正常独立进程重启可恢复；`remove` 和 `clear` 同理。普通 mode 与 protected mode 都必须验证正常重启后的正向读回和不应串读的反向断言。本文不要求 crash durability、硬件密钥保护或对提取者保密；如果实现存在 crash window，必须写明而不能暗示强保证。

### PKV-R09 · 并发、顺序和单进程适用范围

必须冻结单进程 `SINGLE_PROCESS_MODE` 的适用边界，不得宣称多进程安全。必须定义同 key 并发、write/remove 交错、批内重复 key、跨调用完成顺序和读取时点的可观察结果。所有不支持的范围要显式返回/记录，不得静默靠偶然调度决定。

### PKV-R10 · batch 语义不能只写“更快”

只有在出现真实生产 caller、且该 caller 要采用 `writeMany` 时，才必须由 Dexter 决定 `writeMany` 是：

- 全批原子；或
- 允许部分提交，并暴露已提交/未提交边界及可恢复语义。

在该 caller 出现前，不把 `writeMany` 视为本批必须裁决的 workload；但任何实现仍不得把逐项 `encode` 宣称为 atomic，也不得把 `NoOutput` 宣称为完整批量 receipt。`readMany` 的首个损坏值、`removeMany` 的幂等和重复 key 也必须有相同等级的定义。

效率要求只接受 measured budget：至少分别测单项和批量在当前 state hydrate/flush 形态下的 latency、吞吐、内存和失败放大；未发现真实瓶颈时不新增通用 cache、第二条队列或重复持久化系统。

### PKV-R11 · 损坏、类型和底层异常

当前 state codec 负责 JSON，adapter 只保存 opaque string；这一分工必须保留。存在 key 但不能以 string 解码时不得伪装成 missing。必须定义单 key 损坏对其它 key 的影响、MMKV 文件无效/截断、底层 encode false、空间不足和 native exception 的结果；修复不得以“清空全部 namespace”作为默认恢复。

### PKV-R12 · list/clear 的范围和副作用

`listKeys`、`removeMany`、`clear` 只能影响目标 MMKV instance/namespace，不得触碰其他 persistenceKey 或 persistSecure。`clear` 虽当前没有 production caller，仍须作为 namespace 隔离不变量的一部分在专门反例中证明清空后其它 namespace 仍可读；这不等于为零消费者方法建立一般 workload 证据。state 层的 prefix filtering 也不得掩盖 adapter 越界。

### PKV-R13 · 共用 adapter 的双 mode 生产接线与 descriptor 一致

module registration、JS export、assembly injection 和 descriptor 的八项能力必须与实际可调用方法集合一致。一个 adapter 可以同时产生 plain/protected 两个 wrapper，但 descriptor 必须能表达二者各自的 mode/state/source，不能把 protected mode 仍标成 unavailable，也不能把一个 plain wrapper 伪装成 protected。缺 module、缺方法、错误 namespace 或 mode 不匹配的结果必须在可观测边界失败。

### PKV-R14 · 诊断必须可追因且不制造错误洪水

adapter/state/assembly 的日志必须能区分 operation、phase、port、mode、capability、失败类别、重试性和受控上下文，并遵守 TER 脱敏要求。protected mode 已纳入本 adapter 后，sample 不应再因本来应由该 mode 承载的 protected entry 而重复记录 `adapter not injected`；真正的 mode/身份材料/底层失败仍必须可见。调低日志级别不能替代修复真实失败。

### PKV-R15 · 测试与证据档位必须分层

未来交付必须分别提供：

- `static`：八方法、注册、descriptor、依赖/ABI 声明、namespace 约束；
- `focused`：对当前有生产 caller 的 wrapper 做 wire shape、输入拒绝、timeout mapping、错误分类和实际 batch 反例；本批无生产 caller 的 `read/writeMany/removeMany/clear` 的一般方法语义只做 R02 规定的 static-only 核验，但 R01/R12/R13 的跨 mode/namespace 隔离反例仍必须调用所需方法，不能用 mock 行为冒充本批 consumer 证据；
- `native`：对当前有生产 caller 的 Kotlin 方法做 MMKV 结果、初始化/异常/文件边界证明；零消费者方法只有在首次获得 caller 后才扩展一般 native 行为证明，但隔离不变量所需的专门 native 反例不豁免；
- `Android`：真实 Expo module load、当前 caller 所覆盖的方法、隔离、空值、并发、进程重启、故障注入和日志；零消费者的 `read/writeMany/removeMany/clear` 不在本批一般八方法 Android 行为分母内，但 R01/R12/R13 的跨 mode/namespace 隔离反例仍需在真实边界证明，出现 caller 后再扩展一般行为分母；
- `release`：clean 构建、目标 ABI/minSdk、安装、module autolinking 和 release artifact；
- `cleanup`：每次动态运行的目标 PID/设备、日志、临时文件和资源清理结果。

focused test 直接调 `props`/fake native、历史 MMKV load、README 文字或测试数量，都不能升级为 Android 或 release 证据。
测试名称必须与实际断言面一致；名称声称“every operation”而只断言一个 operation，按未覆盖处理。

### PKV-R16 · README 必须和行为一致

遵守 `TR-10`：包根中文 README 必须说明一个共用 adapter 如何提供 plain/protected 两种 mode、各自定位和非定位、owner/toolkit、目录职责、真实公开用法、八项方法语义、单进程范围、`LOCAL_OBFUSCATION_ONLY` 的安全边界、失败/重试/timeout 语义、测试档位和迭代边界。README 不能把简单混淆写成强安全，也不能把未执行的 native/runtime/restart 行为写成既成事实；示例必须与实际导出签名一致。测试名称必须与实际断言面一致；名称声称“every operation”而只断言一个 operation，按未覆盖处理。

### PKV-R17 · 支持范围必须由 release 证据决定

必须声明并验证支持的 Android API、ABI、debug/release 构建、R8/压缩、clean dependency resolution 和安装启动。当前本地 AAR 缓存中存在 arm64-v8a/x86_64 只可作为静态依赖线索，不是 release 支持证明。

### PKV-R18 · 不得引入跨 mode 的隐形 fallback 或第二套存储

plain/protected 可以共享同一个 adapter 和底层 MMKV 能力，但 protected mode 失败时不得静默切换到 plain namespace、process-memory、Web Storage、另一个未声明的 MMKV namespace 或自建 registry；否则 state 层无法知道“写成功但重启丢失”或“数据已失去混淆”。任何 fallback、迁移、清理和替换方案都必须在另一个 Dexter 裁定中明确授权，并保留 typed failure/恢复边界。

## 6. 需求与证据覆盖矩阵

这是后续详设的输入矩阵，不是当前实现的通过表。

| 需求 | `static` | `focused` | `native` | `Android` | `release` | 当前状态 |
|---|---|---|---|---|---|---|
| PKV-R01/R07/R12/R18 数据分类、隔离、namespace、禁止 fallback | 必须 | 反例 | 可选 | 重启/跨 namespace | 可选 | 部分已有静态线索；语义和行为 OPEN |
| PKV-R02 当前有生产 caller 的 `listKeys/readMany/write/remove` | 方法集合与调用点 | 真实 caller 的正反向量 | 对应 native 方法 | 真实 module 全路径 | 不适用 | static 已列清单；行为未闭合 |
| PKV-R02 当前无生产 caller 的 `read/writeMany/removeMany/clear` | 导出、descriptor、禁止误接线 | 本批不要求 | 本批不要求 | 本批不要求 | 不适用 | `static-only`；出现真实 caller 后重开行为/性能语义 |
| PKV-R03 bridge wire 封闭性 | shape/closed set | malformed/red mutation | native 异常映射 | bridge 故障 | 不适用 | 当前存在缺口 |
| PKV-R04 错误分类与 retryable | code/typed shape/脱敏静态检查 | 当前只到 typed contract；出现 consumer 后再做行为反例 | 当前只到 typed/native mapping 形状 | 出现真实 consumer/bridge 场景后再做 | 不适用 | 当前无 persistKV retry consumer；不得写成现行重试行为 |
| PKV-R05 timeout | 参数/结果形状 | hung promise/timeout mapping | native deadline boundary | 真实 bridge 卡顿/迟到结果 | 不适用 | 当前确认未实现 |
| PKV-R06/R09 初始化、并发、单进程 | 静态锁/模式 | fake concurrent calls | native concurrency | 真实并发/模块生命周期 | 不适用 | 未证实 |
| PKV-R08 耐久性 | 只能声明边界 | 不足以替代 | 可作辅助 | 独立进程/应用重启 | 可选 | 当前无本轮证据 |
| PKV-R10 批量原子/部分提交与性能 | API shape | 有真实 caller 后再做 red mutation/预算 | 有真实 caller 后再做 native failure | 有真实 caller 后再做 batch/readback | 可选 | 当前无 batch caller；不在本批裁 workload |
| PKV-R11 损坏/空间/底层异常 | error code shape | fake malformed | native fault | 真实文件/设备故障 | 可选 | 未证实 |
| PKV-R13/R16 接线、descriptor、README | 必须 | consumer contract | module registration | APK autolink/load | release packaging | 形状多数存在，内容需重审 |
| PKV-R14 诊断与脱敏 | 日志字段扫描 | error vector | native logs | 真实日志读取 | release logs | 当前可见 secure 噪声；KV 边界未闭合 |
| PKV-R15/R17 证据与兼容性 | 证据清单 | 测试执行 | Kotlin/Gradle | APK/device | clean release | 当前 Android/release OPEN |

Web 不进入这张 Android adapter 的通过矩阵；Web 的 storage 行为不得替代 native/Android 证据。

## 7. 必须由 Dexter 先裁的事项

以下事项会改变 kernel 端口或业务恢复语义，本文不替 Dexter 偷选；本机身份材料/简单混淆作为本轮目标方向已经接受，不再把强安全方案作为前置：

1. `timeoutMs` 是实际 deadline/cancellation，还是从 `StateStoragePort` 删除/重定义；底层不能取消时允许什么迟到结果。
2. plain/protected 是否共用同一套 timeout policy；当前 state 只有全局 `readMs/writeMs/resetMs`，若不需要 mode 差异则默认共用，若要拆分必须说明收益与 owner。
3. `readMany` 单项损坏是整批失败、逐项返回 failure，还是跳过并记录；这会决定 state hydration 的恢复行为。
4. `listKeys` 是否要求稳定排序，重复输入/重复输出如何处理；state 层过滤与 adapter namespace 的最终责任边界。
5. persistenceKey、entry key 的允许字符、空白、长度、单值大小、批量大小和总 namespace 大小。
6. “写成功”需要保证到哪一级：内存接受、文件写入、正常进程重启恢复，还是更强的 crash durability。
7. `PERSIST_KV_*` 各类错误的 retryable 规则和哪些诊断字段可安全暴露；当前 persistKV 没有生产重试消费者，不得把潜在契约误用写成现行行为。
8. 当前单进程 `SINGLE_PROCESS_MODE` 是否是本批永久边界；不支持多进程时的明确用户/调用方表现。
9. protected mode 使用哪一个稳定本机身份字段、身份材料变化后的表现，以及简单可逆变换的版本标记；不要求引入 Keystore 或密钥轮换。
10. `v1` namespace/version 变化时旧 MMKV 文件由谁保留、迁移、拒绝或清理，以及生命周期何时结束；不得留下无人认领的旧文件。
11. 当前 sample 中 protected mode 的日志等级、hydrate 条件和共用 adapter 接线；不得用 plain KV 掩盖 protected mode 失败。
12. release 支持的 Android API、ABI、debug/release 构建组合，以及是否需要真实低存储/损坏文件测试。

## 8. 不属于本需求的内容

- 不在本文实现 Android adapter、Kotlin module、JS bridge、state engine 或 sample assembly；
- 不写详设中的类、线程、缓存、锁、目录和具体测试脚本；
- 不整体替换 MMKV；同一 MMKV adapter 的 plain/protected mode 是本轮允许且优先的最小方向；
- 不把 `persistSecure` 的 local obfuscation 写成强密码学安全，也不在本轮引入 Keystore、硬件绑定、密钥轮换或复杂迁移；
- 不给 protected mode 造 plain-text fallback；
- 不把历史 CP-4、历史 Android load/read、focused mock、typecheck 或 README 文字升级为完整 Android/release/visual acceptance；
- 不启动后台 DEV、seed、UAT、部署或任何未被本次需求直接授权的动态环境。

## 9. 本轮 Claude review 的作者侧处置记录

以下只是对 Claude review 的作者侧 intake，不是把 Claude 的 verdict 改写成通过，也不替 Dexter 产生新的产品裁决：

| finding | 当前处置 | 结果落点 |
|---|---|---|
| M-02 mode namespace 隔离不足 | `CONFIRMED`；补充跨 mode `read` 必须 missing、`listKeys` 不得串 key、物理 namespace identity 或等价可观察隔离边界；单纯不同 port 对象仍标为非充分条件 | PKV-R01、PKV-R12、PKV-R13 |
| S-01 “不等于明文”判据太弱 | `CONFIRMED`；禁止纯编码/重排，要求命名的可复现非纯编码/重排变换；详设先核 MMKV 2.4.2 `cryptKey`，若存在优先复用；身份派生方案补双身份向量 | G-13、PKV-R01 |
| S-02 retryable 影响面过度陈述 | `PARTIALLY_CONFIRMED`；保留 JS bridge 恒定 `retryable=true` 的契约缺口，但记录当前没有 persistKV 生产重试消费者，不再称为现行 retry flood；Kotlin 多 code 与 JS 汇总分开表述 | F-13、G-04、PKV-R04、§7 |
| N-01 缺少 port identity 判据 | `CONFIRMED`；补静态/typed 断言：两个 port 引用不同，descriptor 的 mode/state/source 各自正确；同时注明它不能替代 M-02 的跨 mode 行为证明 | PKV-R01 |
| N-02 测试标题超出实际断言面 | `CONFIRMED`；补“测试名称必须与实际断言面一致，名实不符按未覆盖处理” | PKV-R15 |
| 零消费者方法与 state 批量化归属 | `CONFIRMED_STATIC`；新增 F-19 完整 caller census；`read/writeMany/removeMany/clear` 的一般方法语义本批 static-only，但 R01/R12/R13 的跨 mode/namespace 隔离不变量仍保留专门反例；state engine 的批量化机会不归 adapter 本批实施 | F-19、G-05、G-10、PKV-R02、PKV-R10、§6 |
| 文档遗漏 namespace 生命周期与 mode timeout 关系 | `CONFIRMED_REQUIREMENT_GAP`；加入 Dexter 决策项，不静默替选 | PKV-R07、§7 |

“共用 adapter”仍是本轮最小方案，但“共用实现”不等于“共用同一个 port、同一个 namespace 或隐藏 fallback”。`LOCAL_OBFUSCATION_ONLY` 仍只表示文件不应被直接看懂，不构成完整安全接受。

## 10. 请 Dexter 转交 Claude 的独立 review brief

Dexter，请将下列 brief 连同本文交给 Claude。Claude 的任务是独立评审需求，不是替本文作者自审，也不是实施授权。

---

你好 Claude，

请对当前仓库中的需求正本做独立 review：

`doc/plans/platform/2026-09-12-v2s-terminal-android-persist-kv-gap-analysis-and-requirements-codex.md`

背景：当前 Android 终端出现大量 console error，初步怀疑 persistKV。当前源码已经确认 sample 的 `persistSecure` 仍接入 `unavailablePersistSecurePort`，state hydrate/flush/reset/rebaseline 会按 storage kind 访问端口；历史 Android evidence（若当前复核环境能读取）还曾记录 MMKV load/read 与 protected unavailable。请不要把历史归因当作权威：先以 `unavailablePersistSecurePort`、`persistenceHydration.ts` 和 `persistenceEngine.ts` 的源码路径确认“未接入会制造 unavailable/error”的机制，日志只能作为该次运行的附加 Android evidence；若日志文件不存在，明确标为无法复核，不要编造历史次数或文本。

新的产品目标是：`persistKv` 与 `persistSecure` 共用一个 adapter，protected mode 只需避免存储文件被直接看懂，不要求抵抗 APK/数据提取。允许 Kotlin 端简单可逆混淆/加密；不引入 Keystore、硬件绑定、密钥轮换或复杂迁移作为本轮前置。但请独立判断“简单加密”是否真的避免了直接可读：base64、hex、字符串反转和 UTF-16 重编码不能因为“不等于明文”就算通过。若解析到的 MMKV 2.4.2 artifact 确有 `cryptKey` 实例 API，请评估复用它是否是更小的方案，不要未经证据声称该 API 当前可用。

评审范围只有：

- 当前 Android 共用 persistKV/persistSecure adapter 的事实与缺口是否准确；
- F-19 的 production caller census 是否准确：`listKeys` 3 处、`readMany` 2 处、`write` 与 `remove` 各 1 个集中调用点；`read`、`writeMany`、`removeMany`、`clear` 当前为 0 处；是否错误把 state engine 的未来批量化机会归给 adapter；
- PKV-R01 至 PKV-R18 是否在不过度设计的前提下解决了普通 mode 完整性、protected mode 本地混淆、效率和健壮性的真实问题；其中零消费者方法是否已明确为本批 static-only，而不是伪造完整行为证据；
- 哪些条款把存在字段偷换成能力，把 mock/focused 偷换成 native/Android，把“正确/一致/持久化”写成没有参照物的空话；
- 八项方法、timeout、错误分类、batch 部分提交、初始化并发、namespace/迁移、durability、损坏/空间、脱敏、性能和 release 支持是否闭合；
- persistSecure 当前 unavailable 错误是否应由共用 adapter 的第二种 mode 闭合，哪些事项仍属于 state consumer、批量化或日志 owner；
- 两个 mode 的隔离判据是否足够：不同 port 对象只是必要条件，是否还必须证明同 key 跨 mode read 为 missing、两侧 listKeys 不串 key、namespace identity 或等价隔离边界可观察；
- 共用一个 adapter、两个 wrapper/namespace、Kotlin 端简单混淆是否是足够小的方案；哪些看似简单的明文 fallback/静默会掩盖真实故障；
- 文档是否诚实地把 `LOCAL_OBFUSCATION_ONLY` 与真正的加密安全区分开，是否错误引入 Keystore、硬件绑定或复杂迁移；
- `retryable=true` 的影响面是否被准确描述：请核对全仓生产 consumer；若没有 persistKV 重试消费者，应把它写成潜在契约风险而不是现行重试洪水；
- namespace/version 生命周期、旧 MMKV 文件的 owner、以及 plain/protected timeout 是否共用当前全局 `readMs/writeMs/resetMs`，是否仍遗漏必须先回答的语义和证据档位。

必须重开并核对的 owning source 至少包括：

- `apps/terminal/adapter/android/persist-kv/src/implementations/androidPersistKv.ts:18-84`
- `apps/terminal/adapter/android/persist-kv/android/src/main/java/com/catering/v2s/terminal/adapter/android/persistkv/TerminalPersistKvModule.kt:7-169`
- `apps/terminal/adapter/android/persist-kv/test/androidPersistKv.test.ts:10-113`
- `apps/terminal/kernel/base/platform-ports/src/types/storage.ts:3-21`
- `apps/terminal/kernel/base/platform-ports/src/types/result.ts:17-64`
- `apps/terminal/kernel/base/state/src/foundations/persistenceHydration.ts:81-140`
- `apps/terminal/kernel/base/state/src/foundations/persistenceEngine.ts:306-378,558-678`
- `apps/terminal/kernel/base/display-context/src/application/createPowerStatusBridge.ts:32`（核对 `retryable` 的实际 production consumer）
- `apps/terminal/assembly/android/sample-terminal/src/assembly/platformPorts.ts:17-31`
- `apps/terminal/adapter/android/persist-kv/README.md:1-36`
- `apps/terminal/kernel/base/platform-ports/src/defaults/unavailablePersistSecure.ts:6-13`
- `doc/platform/terminal-coding-standard.md` 中 TR-02、TR-04、TR-10 及适用端口规则
- `/tmp/ter-cp7-android-all.log:1208-1218,1555-1664`（只作历史 Android evidence）

请为每条 finding 标注以下之一：`CONFIRMED`、`PARTIALLY_CONFIRMED`、`REJECTED_WITH_EVIDENCE`、`UNVERIFIED_REQUIRES_EVIDENCE`、`DEXTER_DECISION`。每条必须给出仓根相对路径与行号/唯一符号、失败场景、影响面、最小修复方向、是否需要 Dexter 裁决，并区分 static、focused、native、Android、release、Web evidence。

输出必须包括：

1. `GO` 或 `NO-GO`；
2. `M/S/N` 三档计数；
3. 被你推翻的本文作者结论清单；
4. 本轮范围内本文仍漏掉的问题清单；
5. 明确声明未执行的动态档位，不得把历史 Android 日志、focused mock、typecheck、README 或静态接线扩写成完整 Android/release acceptance；
6. 明确指出哪些 finding 是共用 adapter/protected mode 范围内的问题，哪些仍是 persistSecure consumer/state 日志 owner 的邻接问题；不要把“共享底层实现”误判为“两个 port 可以合并成一个对象”。

本文只授权需求 review，不授权详设、实施、源码/测试/依赖修改、动态环境、DEV、seed、UAT 或部署。请以当前字节为准，不采信作者自报覆盖数字。

---

## 11. 当前交付状态

`STATUS=READY_FOR_DEXTER_AND_CLAUDE_REVIEW`

本次 Claude finding 处置只修改了本文，没有修改 persistKV 源码、测试、依赖、构建配置或运行环境；当前 worktree 另有既存的 `apps/terminal/assembly/android/sample-terminal/README.md` 与 `platformPorts.ts` 变更，不属于本次文档处置，不能被本文状态误读为 persistKV 已实施。本文没有标成需求 GO，也没有把任何未执行的 Android/native/release/visual 档位标成 PASS。正式结论留给 Dexter/Claude 的独立 review。
