SKILL_USED=cs-writing-plans@72190c88b2b5a67a96b91d66aa72b9161913e10e8769da3f28a226f4cc7b99d0

---
title: TER Android persistKV / persistSecure 共用适配器实现详设
documentKind: IMPLEMENTATION_DESIGN
status: IMPLEMENTATION_COMPLETE_PENDING_INDEPENDENT_REVIEW
sourceRequirements: doc/plans/platform/2026-09-12-v2s-terminal-android-persist-kv-gap-analysis-and-requirements-codex.md
implementationAuthority: true
---

# 0. 文档身份、授权和事实边界

```text
BUSINESS_SOURCE=doc/plans/platform/2026-09-12-v2s-terminal-android-persist-kv-gap-analysis-and-requirements-codex.md
JOURNEY_REFS=N/A；本批是 Android 本地持久化 adapter，不承载 UI Journey
IA_REF=N/A；无页面 IA
INTERACTION_REF=N/A；无用户界面交互
AUTHORIZED=按本详设与实施计划实施 persistKV/persistSecure 共用 Android adapter，并执行 CP-0～CP-4；不扩范围
NOT_AUTHORIZED=后台 DEV / seed / UAT / 部署 / 其他产品范围；仓库控制仍由 Dexter 负责
IMPLEMENTATION_AUTHORITY=true（Dexter 2026-09-12 直接授权；仅限本批）
```

本文把需求正本落成 implementation-facing 契约。Dexter 已冻结 §12 的十二项决定并授权按本详设/计划实施；CP-0 source freeze 与 CP-1～CP-4 实际执行记录已经完成。所有 dynamic evidence 仍按档位分别记录，不能由本授权或静态材料代替；最终独立 implementation review 仍未完成。

这是非 UI 的本地 adapter：没有 UI、L2、页面定位、testId、视觉验收或 Web 通过矩阵。它也不是 HTTP API，因此没有 business acceptance route、数据库迁移或业务 seed。

## 0.1 采用的输入和当前静态基线

本详设只把下列材料当作设计输入，当前源码事实必须在实施前再次按符号重开：

- 需求正本：`doc/plans/platform/2026-09-12-v2s-terminal-android-persist-kv-gap-analysis-and-requirements-codex.md`，当前修复了 PKV-R01 的两个 port 引用正断言与 PKV-R15 的测试名称/实际断言面要求；作者处置表仍不是质量证明。
- 当前 Kotlin owning source：`apps/terminal/adapter/android/persist-kv/android/src/main/java/com/catering/v2s/terminal/adapter/android/persistkv/TerminalPersistKvModule.kt`。
- 当前 JS owning source：`apps/terminal/adapter/android/persist-kv/src/implementations/androidPersistKv.ts`。
- 当前 port contract：`apps/terminal/kernel/base/platform-ports/src/types/result.ts`、`apps/terminal/kernel/base/platform-ports/src/types/storage.ts`。
- 当前装配入口：`apps/terminal/assembly/android/sample-terminal/src/assembly/platformPorts.ts`、`apps/terminal/assembly/android/sample-terminal/package.json`。
- 当前 native 注册与 MMKV 依赖：`apps/terminal/adapter/android/persist-kv/expo-module.config.json`、`apps/terminal/adapter/android/persist-kv/android/build.gradle`。
- 当前包说明与测试：`apps/terminal/adapter/android/persist-kv/README.md`、`apps/terminal/adapter/android/persist-kv/test/androidPersistKv.test.ts`。

CP-0 的实施前静态基线曾是：Kotlin module 已暴露八个 storage AsyncFunction，但 success wire 缺少完整 port/capability，failure/unavailable 的逻辑 port 固定为 `persistKv`；JS 每次 operation 都重新 resolve module，factory 只有 plain 语义的一个 port。该段只保留为变更前事实，不能覆盖后续实施字节；实施后的 declaration → transfer → consumption 以第 13b 节和最终 reconciliation 为准。`persistenceHydration.ts`、`persistenceEngine.ts` 和 `createStateRuntime.ts` 的 caller/同对象拒绝仍以当前源码为准，不能用本段替代 caller census。

本机已静态核对实际解析到的 MMKV 2.4.2 artifact：

```text
artifact=/Users/dexter/.gradle/caches/9.3.1/transforms/2d0ebcb5a705b36df192f148cae3e63f/transformed/mmkv-2.4.2-api.jar
MMKV.mmkvWithID(String, int, String): MMKV
MMKV.cryptKey(): String
MMKV.reKey(String): boolean
MMKV.reKey(String, boolean): boolean
MMKV.checkReSetCryptKey(String): void
MMKV.checkReSetCryptKey(String, boolean): void
```

这证明 artifact 有能力和精确重载形状，不单独证明真实文件已加密/混淆、Android 已 load、release 已打包或重启已读回。实现复用了 `mmkvWithID(..., SINGLE_PROCESS_MODE, cryptKey)` 和 `sync()`；为满足错误 key 与新建 namespace 的可区分性，实际采用 `MMKV.checkExist(namespace)` 加 adapter-owned protected marker，而不是调用会改变 key 状态的 rekey 路径。行为结论仍只以 CP-1/CP-4 evidence 为准。

# 1. 业务目标、范围与方案选择

## 1.1 真正要解决的问题

Android 终端当前把 `persistSecure` 接到 unavailable port，而 state hydration、flush、reset 或 rebaseline 按 storage kind 访问它时会产生可见的 unavailable/error。产品目标不是建立强安全存储，而是让 protected mode 的落盘表示不再能被直接打开文件的人按明文阅读，同时保留 state owner 对 opaque string 的所有权。

本批必须得到一个共享的 Android adapter/module：

1. `persistKv` 和 `persistSecure` 由同一套 Expo module、同一套 Kotlin store helper、同一套 JS bridge 产生；
2. 两个 public port 是不同的 frozen wrapper，具有不同的逻辑 port/mode descriptor；
3. plain 与 protected 的 key、namespace、clear/list/read 边界可观察隔离，禁止 protected 失败后静默回 plain；
4. protected mode 使用 MMKV `cryptKey` 能力作为默认技术路线，不手写第二套变换；
5. 适配器不解析 state JSON，不改变 state engine 的 owner、逐键 flush 或 reset 归属；
6. 所有失败有 typed result，诊断不泄漏原始 key、value、身份材料或密码；
7. 证据按 static、focused、native、Android、release、cleanup 分档，任何一档不向另一档升级。

## 1.2 方案比较

| 方案 | 内容 | 结论 |
|---|---|---|
| A | 保持 `persistSecure` unavailable，仅修日志或让 state 忽略 | 拒绝。它不解决 protected caller 的真实失败，且会把问题伪装成可接受降级。 |
| B | 新建第二个 Android adapter/Expo module，或引入 Keystore、硬件绑定、轮换和迁移框架 | 拒绝。重复 native/bridge/namespace 责任；超出“文件不可直接看懂”的目标，增加当前阶段故障面。 |
| C | 一个 Expo module + 一个 Kotlin mode resolver/store helper + 一个 JS bridge + 两个显式 mode wrapper；protected 使用 MMKV `cryptKey` | **推荐采用**。它复用现有 module、MMKV、StateStoragePort 和 sample assembly，隔离在 mode/namespace/descriptor 中表达，不引入第二套存储。 |
| D | 在 JS 侧做 base64/hex/反转等变换，或把 protected 值写到 Web/process-memory fallback | 拒绝。纯编码仍可直接还原，且不满足 Android 文件边界；fallback 会制造“写成功但重启丢失/明文落盘”的隐形状态。 |

本详设选择 C，是因为 A 留下现有错误，B 为当前收益引入不必要安全与迁移复杂度，D 不能满足“文件不应被直接看懂”且破坏 native owner；C 是能够复用已解析 MMKV 能力、保留现有 port contract、把隔离和失败可见性收在同一 adapter 的最小方案。

## 1.3 本批明确不做

- 不建立强密码学、Keystore、硬件绑定、密钥轮换、用户认证或攻击者模型；`LOCAL_OBFUSCATION_ONLY` 不等于防逆向、防 root 或机密性保证。
- 不改变 `StateStoragePort` 的八方法公共语义，不新增第二个 registry、第二个 input/storage pipeline 或 state codec。
- 不替 state engine 把逐键 `write/remove` 改成批量；`writeMany` 的 atomic/partial 语义只有出现真实生产 caller 后再由 Dexter 裁定。
- 不为 zero-caller 方法伪造一般 workload 证据；但 R01/R12/R13 的隔离反例仍必须调用需要的 `read/listKeys/clear` 方法。
- 不新增 UI、页面、Web storage 或视觉验收；Web 不在本 adapter 通过矩阵。

# 2. 设计总览与 CP 分层

## 2.1 推荐的内部形状

```
sample assembly
  ├─ createAndroidPersistKvPort(persistenceKey, "plain")    -> persistKv wrapper
  └─ createAndroidPersistKvPort(persistenceKey, "protected") -> persistSecure wrapper
             │             （两个 frozen object，不共享 port object）
             └─ lazy cached TerminalPersistKv native module
                         │
                         └─ Kotlin StorageModeResolver
                              ├─ plain: existing v1 namespace + no cryptKey
                              └─ protected: versioned protected namespace + MMKV cryptKey
```

JS factory 的 mode 参数必须显式且无默认值，建议签名为 `createAndroidPersistKvPort(persistenceKey, mode: 'plain' | 'protected')`。这样漏传 protected 不能静默得到 plain。若最终实现选择返回一对 ports 的 convenience helper，也必须由它调用同一个显式 mode factory，不能复制一套操作实现。

Kotlin 侧每个 method 接收 mode 或等价的闭合 mode token，由同一 `StorageModeResolver` 计算：logical port、mode、namespace、cryptKey 是否存在和 capability。plain 保留现有 `catering-v2s.terminal.state.v1.` 映射；protected 使用冻结的独立、带版本的 `catering-v2s.terminal.state.protected.v1.` namespace。旧 v1 文件不迁移、不清理、不 fallback。

mode token 是跨 JS/Expo/Kotlin 边界的运行时输入，不得只依赖 TypeScript union。`StorageModeResolver` 必须把合法集合冻结为精确的 `plain` 与 `protected`；缺失、null、空字符串、未知字符串或未来新增但尚未登记的 token，必须在打开 MMKV 之前返回带 `PERSIST_KV_INVALID_MODE`（或经 Dexter 冻结的等价稳定 code）的 typed failure。任何 `else`、`default` 或“未知即 plain”的分支都被禁止；错误输入不得初始化、写入、清理或改变任何 namespace。JS 侧也必须在未进入 native operation 前拒绝运行时非法值，但 native 仍必须独立 fail closed，以防 bridge 绕过编译期类型。

protected store 的默认调用形状是 `MMKV.mmkvWithID(namespaceId, MMKV.SINGLE_PROCESS_MODE, cryptKey)`；plain 继续使用无 cryptKey 的现有重载。cryptKey 使用既有 `TerminalDeviceModule` 同源的 `Settings.Secure.ANDROID_ID` 派生；材料不可得或与既有 protected 文件不匹配时返回 typed unavailable/failure，禁止自动 rekey。简单可逆本批不要求额外 hash/Keystore；不得因为“安全”名义重新造一套变换。

## 2.2 CP 总览

| CP | 目标 | 依赖 | 当前状态 | 进入下一 CP 的门 |
|---|---|---|---|---|
| CP-0 | 冻结 §12 十二项决定、确认 artifact/API、重开 source | 无 | `READY_TO_EXECUTE` | 十二项均有明确值；artifact signature、caller census 与 dirty boundary 无矛盾；无行为 PASS 声称 |
| CP-1 | Kotlin mode resolver、MMKV 初始化、namespace/cryptKey、八方法 mode 传递 | CP-0 | `MATCHED` | native helper 正反例、D-05 validation、隔离/marker/wrong-key/restart 证据；D-05 每项 public bridge invalid input 未逐一运行，边界保持明确 |
| CP-2 | JS bridge、lazy module cache、private wire validator、两个 frozen wrapper/descriptor | CP-1 | `MATCHED` | malformed wire、mode/port mismatch、module 缺失、输入/error red mutation；focused evidence 已记录 |
| CP-3 | sample 两个 port 生产接线、README、静态包闭包 | CP-2 | `MATCHED` | 同一 assembly 的 descriptor/wrapper 对账；无 `unavailablePersistSecurePort`；README 回读源码 |
| CP-4 | focused/native/Android/release 证据与整批对账 | CP-3 | `MATCHED` | 实际输出、日志、first failure、last known good、cleanup 与逐代码 reconciliation 已记录；独立 review 待进行 |

CP-0 是实现前的 source freeze；Dexter 的实施授权已存在，但 CP-1 至 CP-3 仍按数据流顺序串行；CP-4 不能用计划代替实际证据。

# 3. 固定机制对账

以下固定机制行来自详设模板，不能删除。对本地 adapter 不适用的行明确写 `N/A`，不能用空白伪装覆盖。

| 固定机制 | 本批设计 |
|---|---|
| 读侧节点授权 | `N/A`：没有 HTTP read node、grant 或后台 actor；本地读由已经注入的 `StateStoragePort` owner 调用，不能据此新增权限层。 |
| 写授权与 grant 复核 | `N/A`：没有 grant/actor；是否允许 state 写由 kernel state owner 保持，adapter 只执行 typed storage operation。 |
| 跨 owner 写与事务 | `N/A`：没有跨模块 DB 写和事务；不得在 adapter 内引入 transaction/outbox。 |
| 集合形态与分页 | `StateStoragePort` 的 `readonly` key/entry 数组是唯一集合形态；本地 KV 不分页。重复 key、顺序、上限由 §7 第 4/5 项冻结，不由 Kotlin 偶然循环决定。 |
| 缓存失效 / 改完刷新什么 | MMKV 是 adapter 的 source；不新增 application cache。state hydration/flush 的刷新仍由 state owner；module cache 只缓存 native module 引用，不缓存 key/value。 |
| RTK 数据读取与加载判定 | `N/A`：无 RTK、页面加载或 UI 数据读取。 |
| 同一事实只有一个住址 | state JSON 编码事实只在 kernel state owner；adapter 只保存 opaque string。mode、namespace、cryptKey policy 只在 Kotlin resolver/受控 JS descriptor 传递，不在 sample 另建 registry。 |
| 失败可见且原因不得改写 | private native wire 必须是闭合 `succeeded/unavailable/failed`；JS 先验证 port/mode/capability/shape 再映射 public `PortResult`。异常不得变 success，protected 失败不得改成 plain 或 missing。storage adapter 不再有 timeout 状态。 |
| owner 错误到 HTTP 的映射与注册处 | `N/A`：没有 HTTP。native/bridge error 仍须有 stable code、retryable 和安全 message。 |
| 幂等键构成与重放语义 | `N/A`：没有 request/idempotency key 或网络重放；remove/clear 的重复调用语义需按 §7 第 3/6/7 项落为 typed contract，不用“通常幂等”含糊带过。 |
| 该用生成物的地方不得手搓字符串 | 无 OpenAPI/generated client；module name 和 port names 复用已有常量/类型。namespace 前缀只在 resolver 一个 owner 处定义，禁止 JS、Kotlin、sample 各写一份。 |
| 日志落点与脱敏字段 | 在已有 TER logging 规范允许的 module/bridge boundary 记录 operation、phase、logical port、mode、capability、分类 code、retryable、受控 correlation context；禁止 password、value、raw key、cryptKey、身份材料、token、cookie 和 raw throwable。result 仍是主可观察 contract，日志不能替代它。 |
| 迁移回填与可逆性 | 本批无 DB migration、无自动 copy/fallback；plain v1 保持现状，protected v1 使用全新 namespace，旧 v1 不迁移、不清理、不 fallback。 |
| 前端共享行为 | `N/A`：无前端 UI；不要把 admin foundation 机制引入 adapter。 |
| 候选/下拉数据源 | `N/A`：无 UI 候选数据。 |
| 编码与名称呈现 | `N/A`：无用户界面名称呈现；storage key 仍是 opaque input，不能由 adapter `JSON.stringify`、`String(value)` 或自定义 envelope。 |
| 会同时坏的东西是否已声明为原子组 | mode token、namespace/cryptKey resolver、Kotlin 八方法 wire、JS validator、两个 descriptor、sample 接线、README 和对应证明是一个原子实现组；任一未同步不得交付 protected mode。 |

## 3.1 UI/L2 固定行

```text
UI_DESIGN_REVIEW=NOT_APPLICABLE_WITH_REASON：本批无 UI、Journey、IA 或用户交互
TESTID_REVIEW=NOT_APPLICABLE_WITH_REASON：本批无可测 UI 控件
L2_SCRIPT_ADMISSION=BLOCKED：Web/L2 不在 Android adapter 通过矩阵，也未获运行授权
```

# 4. CP 详设、失败构造与证据

每个 CP 都必须先构造“恶意但合规”的 red mutation；只有能够让 mutation 变红，才可把对应 proof 记为可证伪。CP-1～CP-4 的实际结果分别见 `doc/evidence/platform/2026-09-12-v2s-terminal-android-persist-kv-cp1-execution-codex.md` 至 `cp4-execution-codex.md`；独立 implementation review 尚未发生。

## 4.1 CP-0：决定和 source freeze

- 失败构造：把已删除的 storage timeout 继续留成无语义参数、把 protected identity 直接写死、把 old v1 文件静默当 protected、把 `writeMany` 逐项循环叫 atomic；任何一种都应在决策表或 gate 中被阻断。
- 不变量：§7 的 12 项有明确 owner/值/恢复边界；MMKV artifact API 已有静态证据但行为仍标待运行；当前 caller census 与 state owner 不被设计文字替换。
- 禁止：用推荐项冒充 Dexter decision；用历史 Android 日志、mock、README 或数字计数关闭行为项。
- 证明：static：决策锁、API signature、source symbol；无 focused/native/Android/release 结果。CP-0 的“通过”只表示材料可进入实施，不表示 adapter 行为 PASS。

## 4.2 CP-1：Kotlin mode 和 MMKV store

- 失败构造：mode 被忽略；缺失/未知 mode token 走 `else/default` 落到 plain；两个 mode 同 namespace；protected `cryptKey` 为空后调用 plain overload；身份不可得返回 missing；初始化失败后永久静默；重复 `clear` 影响另一个 namespace；异常 catch 后返回 success；`readMany` 中一个损坏值被伪装 missing。
- 不变量：mode→logical port/namespace/cryptKey 是单一 resolver；plain v1 namespace 不变；protected 使用独立 versioned namespace 和带 cryptKey 的 MMKV 实例；`SINGLE_PROCESS_MODE` 的边界显式；每个 operation 返回正确 capability/status；失败不会改变另一 mode。
- 禁止：手写第二套 XOR/base64 变换；protected→plain fallback；清空全部 MMKV 目录；在 adapter 内改变 state JSON 或批量 owner；把 `NoOutput` 解释成 atomic receipt。
- 证明：native pure/helper tests（若现有 Gradle harness 可复用）必须有正反向量；未知/缺失 mode token 必须在 store open 前得到 typed failure，且没有 namespace write；真实 Android 必须 load module、写同 key 两 mode、反向 read missing、list/clear 隔离、重启读回；failure/cleanup 分开。`writeMany` 一般行为在无 caller 时保持 static-only，但隔离专门反例可调用 `clear/listKeys/read`。
- 形状理由：mode resolver 只有一个 owner，两个 MMKV 实例用明确 namespace/cryptKey，最小化重复与漂移；不引入第二 module 或通用加密框架。
- 记忆回读：`claim-versus-behavior`、`negative-universal-claim`、`module-call-boundary-ownership`、`cross-boundary-string-agreement`、`test-closed-loop`。

## 4.3 CP-2：JS bridge 与两个 wrapper

- 失败构造：fake native 少 port/capability、返回错误 mode、unknown status、成功缺 `completedAt`、read value 类型错、module 缺方法、module resolve 失败被吞成 success、异常永远标 retryable、每次调用重复 resolve；两个 factory 返回同一个 object 或 protected descriptor 仍为 unavailable。
- 不变量：private native wire 闭合且按 capability 验证；bridge module lazy cache 只缓存成功 module，不缓存失败；public wrapper 的 mode、logical port、source、state、八项 capability 正确；plain/protected object 引用不同；opaque value 原样转发。
- 禁止：直接 `as PortResult` 绕过 validator；复制第二份 native call table；用 port object 不同替代 namespace 行为；在 JS 侧 base64 或解析 JSON；protected bridge 失败转 plain。
- 证明：focused tests 必须使用真实 wrapper 调用 fake native，并对 malformed/red mutation 变红；测试名称必须与断言面一致，不能用“every operation”只断言一个 operation。module lookup/cache 的测试应区分成功缓存、失败可重试和两 wrapper 共用模块对象；这不证明真实 Expo registration。
- 形状理由：private wire 可带 bridge 所需的 port/mode/capability，而不把 Android 专属字段扩散到所有 kernel `PortSucceeded`；映射到现有 public `PortResult` 前完成验证，避免扩大全局 kernel contract。
- 记忆回读：`claim-versus-behavior`、`gate-four-pieces`、`implementation-source-reread-discipline`。

## 4.4 CP-3：sample 接线和 README

- 失败构造：sample 仍注入 `unavailablePersistSecurePort`；两 port 使用同一个 wrapper；protected descriptor 伪装 plain；README 示例调用不存在的签名；Kotlin namespace 和 JS descriptor 各自漂移；package graph 漏 module registration/依赖。
- 不变量：`platformPorts.ts` 仅以共用 factory 的两个显式 mode 生成 `persistKv`/`persistSecure`；两个引用和 descriptor 不同；同一 Expo module registration；README 写明 local-only、单进程、八方法、错误/重启和 evidence 边界；package/skeleton graph 与实际依赖集合一致。
- 禁止：新建 `persistSecure` 第二 adapter、第二 registry、sample 专属加密、fallback 或把 README 当行为证据。
- 证明：static/typed 对账；sample assembly 的 focused contract 或 Android real wiring；README 示例逐一回源码；不把静态 injection 当 module load/Android behavior PASS。
- 形状理由：只改既有 injection seam，不改 state engine 或 business assembly owner；保留 sample 作为真实 protected consumer，避免测试夹具自证。
- 记忆回读：`cross-boundary-string-agreement`、`module-call-boundary-ownership`、`terminal-coding-standard`。

## 4.5 CP-4：分层证据和整批收口

- 失败构造：把 focused mock 当 Android；把 debug 缓存 artifact 当 release；只看 exit code 不读日志；cleanup 未完成仍报业务 PASS；历史证据覆盖不同字节仍被复用。
- 不变量：每个 evidence entry 指明档位、source/build identity、fresh session、日志、first failure、last known good、broken boundary、business、cleanup；未运行写 `NOT_RUN/OPEN`；N-2 等未证项不因算术或计划关闭。
- 禁止：以“按详设实现”代替整批 review；以 test count、README、static graph 或 `typecheck` 升级行为/视觉/Android/release。
- 证明：先逐 CP 做三维对账，再做整批三维对账；当前实现已由主 agent 完成证据收集与对账，fresh independent subagent 已做只读 adversarial review，正式 implementation review 仍需交 Dexter/Claude。CP-4 证据见对应文件。
- 形状理由：证据分层是当前 Android/native 风险的最小可审计边界，不引入旧 compliance-control 台账。
- 记忆回读：`verification-governance`、`test-closed-loop`、`implementation-source-reread-discipline`、`deterministic-context-only`。

# 5. Operation / caller / collection scale

本批不是 HTTP operation，故模板中的 route、actor、分页和 DB operation 表对本 adapter 为 `N/A`。仍需保留 storage method 的真实 caller 事实：

| storage method | 当前 production caller 口径 | 本批设计处理 |
|---|---|---|
| `read` | 当前 caller census 需以 `rg`/源码复核；不因 Kotlin 暴露即声称有 caller | 保留 API；若仍 zero-caller，一般 workload 为 static-only，隔离反例可调用。 |
| `write` | `persistenceEngine` 的逐键写路径是现有 production owner 候选 | 必须证明真实 wrapper/native wire；不改 state owner 的逐键策略。 |
| `remove` | `persistenceEngine` 的逐键删除路径是现有 production owner 候选 | 同上，定义幂等/失败边界前不改实现。 |
| `readMany` | hydration/engine caller 需以当前 census 复核 | 保留 opaque entries；D-3 未决决定损坏项策略。 |
| `writeMany` | 当前没有一般 production workload caller；state 的逐键循环不是它的 caller | 不宣称 atomic/receipt/性能；按 PKV-R10 延期，出现真实 caller 后再裁。 |
| `removeMany` | 当前没有一般 production workload caller | static-only；隔离反例可调用以证明范围。 |
| `listKeys` | hydration/engine caller 需以当前 census 复核 | namespace isolation、排序/重复规则受 §7 第 4/5 项约束。 |
| `clear` | 当前没有一般 production workload caller | static-only；R12 隔离反例必须调用并证明另一 mode/namespace 仍可读。 |
| factory/assembly | `sample-terminal` 的 `platformPorts.ts` 是真实注入 seam | CP-3 以两个 wrapper 和 descriptor 为对象，不造 catalog 夹具。 |

实施前必须重新生成一份带 exact path/symbol 的 caller census；本表的“候选”不是当前实现证明，也不能偷换 state engine 的 per-key loop 为 `writeMany` caller。

# 6. Cross-owner write / transaction matrix

```text
N/A_WITH_REASON=本批只有 Android 本地 MMKV adapter，没有 PostgreSQL、HTTP、跨 owner command、事务、锁或 DB schema。
OWNER_BOUNDARY=kernel state 继续拥有 JSON/state 事实与写入时机；Android adapter 只拥有 native storage encoding/namespace/mode 结果。
FORBIDDEN=不得把 state persistenceEngine 的批量化、reset、重试或业务恢复逻辑顺手收进 adapter。
```

# 7. 声明 → 传递 → 消费矩阵

每一项都必须有 declaration、transfer、consumption；缺一项是 implementation review finding。表内的 `OPEN` 是当前设计阶段边界，不是已通过。

| 事实 | declaration | transfer | consumption | 证据档位 |
|---|---|---|---|---|
| mode（plain/protected） | JS factory 的显式 union；Kotlin resolver 的闭合 token | 每个 native method 的 mode 参数/等价结构 | 选择 logical port、namespace、cryptKey 重载、descriptor/result 校验 | static + focused + native/Android |
| logical port | `persistKv`/`persistSecure` 现有 PlatformPortName | sample `platformPorts.ts` 与 private wire | public descriptor、failure/unavailable、state runtime 注入 | static + focused + Android |
| MMKV `cryptKey` 能力 | MMKV 2.4.2 artifact 的 `mmkvWithID(String,int,String)` | Kotlin protected ModeConfig | protected MMKV instance 创建；plain 不传 key | static artifact + native + Android |
| identity material | PKV-R01/§7-9；既有 device `ANDROID_ID` | Kotlin 本地读取/derive，不经 JS raw value | protected cryptKey；不可得/变化 typed result | static + native + Android |
| namespace/version | PKV-R07、§7-10；plain v1 保留，protected `catering-v2s.terminal.state.protected.v1.` | Kotlin namespace resolver | MMKV instance、list/clear scope、旧文件不迁移/清理/fallback | static + Android |
| capability | 现有 StateStoragePort 八方法与 native registration | JS operation table、Kotlin `capability` field | validator、descriptor、sample runtime | static + focused + Android |
| result status | PKV-R03/R04；private closed wire union | Kotlin map → Expo bridge → TS unknown | validator → public `PortResult`; invalid wire = bridge failure | focused + native + Android |
| storage deadline | PKV-R05；D-01 已删除 | JS/native method 均无该参数 | 所有 consumer 不再传递或模拟 storage timeout | static + focused/native/Android |
| error/retryable | PKV-R04/§7-7 | Kotlin classification → JS mapping | state caller观察 typed error；不得改变为 missing/success | static + focused + native/Android |
| opaque state value | kernel state codec | `string` 原样过 bridge/MMKV | state owner decode；adapter不解析 | static + focused + Android |
| initialization lifecycle | PKV-R06；existing `initializationLock` 是 source anchor | Kotlin module/application context | one process module/store operation；失败后重试边界 | static + native + Android |
| SINGLE_PROCESS_MODE | PKV-R09/§7-8；当前 MMKV mode | Kotlin `mmkvWithID` | 明确拒绝/不宣称多进程 | static + Android/release |
| logging/redaction | TER observability standard + PKV-R14 | module/bridge structured safe fields | log reader/acceptance evidence；不写 raw sensitive data | static + native/Android/release |
| release support | PKV-R17/§7-12 | Gradle dependency/module registration/artifact | clean install/load/ABI/API/R8 result | static + release；当前 OPEN |

# 8. Business rule → owner 判定

```text
N/A_WITH_REASON=本批没有业务规则、actor、授权、HTTP 或数据库事实；state owner 的业务恢复和写入策略不属于 Android adapter。
OWNER=kernel state 继续决定何时 hydrate/flush/reset；adapter 仅返回 storage result。
```

# 9. Owner API 与 consumer 清单

adapter owner 的 public API 仍是 `StateStoragePort` 八方法，不因 zero caller 删除。实现阶段必须以 current-byte census 修正下表的 caller 数量；下面明确当前设计不将“未来候选”误写成 caller。

| API | 生产/测试 consumer | 设计约束 |
|---|---|---|
| `read` | JS wrapper；生产 caller 以 census 复核；R01/R13 隔离反例 | protected/plain 不能串读；missing 不掩盖 identity/bridge error。 |
| `write` | `persistenceEngine` 逐键 owner 候选；sample 注入间接消费 | 只保存 opaque string；不在 adapter 改 JSON/flush。 |
| `remove` | `persistenceEngine` 逐键 owner 候选 | 重复删除/失败受未决规则约束。 |
| `readMany` | hydration/engine 候选；JS wrapper | 一项损坏的批语义为 §7-3 OPEN。 |
| `writeMany` | 当前无一般 production caller | 不做 atomic/receipt/性能承诺；出现 caller 后新裁。 |
| `removeMany` | 当前无一般 production caller | 一般语义 static-only；专门隔离反例可用。 |
| `listKeys` | hydration/engine 候选；R12/R13 隔离反例 | 只返回目标 instance keys；排序/重复由 §7-4。 |
| `clear` | 当前无一般 production caller；R12 隔离反例 | 只清目标 instance，另一 mode 读回必须成立。 |
| factory | `sample-terminal/src/assembly/platformPorts.ts` | 必须显式传 mode，两个 object 不同且 descriptor 正确。 |
| native registration | `expo-module.config.json` + Kotlin `Name("TerminalPersistKv")` | 一个 module、一个 registration；不得为 protected 新建 module。 |

# 9a. 完整同步变更面

“完整”指设计预期会变更或必须重新对账的文件面，不表示当前已经修改。实施时不允许只抽样其中一行。

| 事实/行为 | 预期 owning path / unique anchor | 变更/对账内容 | 依赖 | 当前 |
|---|---|---|---|---|
| mode public API | `apps/terminal/adapter/android/persist-kv/src/implementations/androidPersistKv.ts` / `createAndroidPersistKvPort` | mode union、显式参数、两个 wrapper、descriptor | CP-0 | MATCHED |
| lazy module cache | 同上 / `callNative` | 成功 module lazy cache；失败不永久缓存；单一 operation table | CP-0 | MATCHED |
| private native wire | 同上 / `NativePersistKvModule` 与 validator | unknown wire runtime validation；port/mode/capability 绑定；安全映射 public result；JS 非法 factory mode 不先推导逻辑端口，稳定 invalid code 携带安全 token 诊断 | CP-0 | MATCHED |
| Kotlin mode resolver | `apps/terminal/adapter/android/persist-kv/android/src/main/java/com/catering/v2s/terminal/adapter/android/persistkv/TerminalPersistKvModule.kt` / `withStore`、`namespaceId` | mode→port/namespace/key；八 method 同一 resolver | CP-1 | MATCHED |
| Kotlin validation owner | `apps/terminal/adapter/android/persist-kv/android/src/main/java/com/catering/v2s/terminal/adapter/android/persistkv/StorageValidation.kt` / `StorageValidation` | D-05 persistence/entry/value/batch 边界、控制字符和 protected marker 保留键共用校验；typed error 先于 store open | CP-1 | MATCHED |
| protected MMKV | 同上 / `MMKV.mmkvWithID` 调用点 | cryptKey overload；不可得/变化 typed boundary；不回 plain | CP-0, CP-1 | MATCHED |
| plain namespace | 同上 / `namespaceId` | 保留当前 v1，版本变更不得无裁定 | CP-0 | MATCHED |
| initialization | 同上 / `initializationLock`、`initialized` | application context、并发首次调用、失败重试、module 重建语义 | CP-0, CP-1 | MATCHED |
| result helpers | 同上 / `success`、`failure`、`unavailable`、`noOutput` | private wire 完整 mode/port/capability；retryable/PII 规则 | CP-0, CP-1 | MATCHED |
| storage deadline | `apps/terminal/kernel/base/platform-ports/src/types/storage.ts`、JS/native signatures | 删除 `timeoutMs` 并同步全部 consumer；不做 deadline/cancel | CP-0, CP-2 | MATCHED |
| sample injection | `apps/terminal/assembly/android/sample-terminal/src/assembly/platformPorts.ts` / `createPlatformPorts` input | `persistKv` plain、`persistSecure` protected；移除 unavailable binding；保留既有无关 dirty changes | CP-2 | MATCHED |
| public export surface | `apps/terminal/adapter/android/persist-kv/src/index.ts` / package public entry | factory 签名、mode 类型导出与实现同步；不能只改内部实现而让 package entry 漏能力 | CP-2, CP-3 | MATCHED |
| package/module graph | `apps/terminal/adapter/android/persist-kv/package.json`、`dependencies.ts`、`apps/terminal/skeleton-graph.ts`、sample package | 仍一个 adapter/module；依赖集合与 registration 一致 | CP-3 | MATCHED |
| Gradle/MMKV | `apps/terminal/adapter/android/persist-kv/android/build.gradle` | 复用 2.4.2；仅在证据/编译需要时变更依赖，禁止随意升级 | CP-1 | MATCHED |
| README | `apps/terminal/adapter/android/persist-kv/README.md` | 中文 TR-10：定位、mode 用法、八方法、边界、失败、重启、证据、迭代 | CP-3 | MATCHED |
| focused bridge tests | `apps/terminal/adapter/android/persist-kv/test/androidPersistKv.test.ts` | 两 wrapper、wire malformed、module cache、mode/descriptor、typed errors；标题与 assertion 面一致 | CP-2 | MATCHED |
| native validation tests | `apps/terminal/adapter/android/persist-kv/android/src/test/java/com/catering/v2s/terminal/adapter/android/persistkv/StorageValidationTest.kt` | D-05 每个 native helper 边界的正反断言；不冒充 public Expo bridge | CP-1 | native 5/5 + D-05 value-limit red mutation，MATCHED |
| native/Android tests/evidence | `doc/evidence/platform/2026-09-12-v2s-terminal-android-persist-kv-cp1-execution-codex.md`、`cp4-execution-codex.md`、`cp4-raw-transcript-codex.md` | MMKV mode、isolation、restart、mismatch、fault/log 的已执行范围；未执行项保持明确 | CP-1, CP-4 | MATCHED |
| release evidence | `doc/evidence/platform/2026-09-12-v2s-terminal-android-persist-kv-cp4-execution-codex.md`、`cp4-raw-transcript-codex.md` | release build、API/ABI、R8/autolink、module load/install 与 hash 绑定 | CP-4 | MATCHED |
| state engine | `apps/terminal/kernel/base/state/src/foundations/persistenceEngine.ts`、`persistenceHydration.ts` | **不变更**；仅重开 caller/契约对账 | CP-0 | NO_CHANGE_REQUIRED |
| kernel port type | `apps/terminal/kernel/base/platform-ports/src/types/result.ts`、`storage.ts` | **默认不变更**；private wire bridge-only fields 不扩散全局 | CP-0, CP-2 | NO_CHANGE_REQUIRED |
| seed/database/UI/Web | N/A | 不属于本批 | 无 | N/A |

# 10. Data migration / namespace lifecycle

| 对象 | 现状 | 设计 |
|---|---|---|
| PostgreSQL/业务数据 | 不存在 | `N/A`：无数据库 migration。 |
| plain v1 MMKV namespace | 当前 `catering-v2s.terminal.state.v1.` | 保持，不自动改名、不把旧值当 protected。 |
| protected namespace | 当前没有确认已存在的 production namespace | 使用冻结的 `catering-v2s.terminal.state.protected.v1.`；不迁移、不清理、不 fallback。 |
| old v1 data | 可能存在 plain 文件 | 本批不自动 copy、不 fallback、不删除；若需迁移必须另有 owner、窗口、失败/回滚和清理裁定。 |
| cryptKey identity change | 使用 `Settings.Secure.ANDROID_ID`；不可得或不匹配 | typed unavailable/failure；禁止自动 rekey、missing 或 plain fallback。 |

protected store 打开时还必须具备“当前 cryptKey 与既有受保护文件匹配”的可检测性；不能只要求结果是 typed，就把无法区分的空 namespace 当作身份变化。当前实现采用 `MMKV.checkExist(namespace)` 作为加密外的既有文件信号，再用 adapter-owned protected marker 验证当前 cryptKey 能读到受保护 namespace；新建 namespace 先写 marker 并 `sync()`，既有文件但 marker 解不出则返回稳定 `PERSIST_KV_PROTECTED_KEY_MISMATCH`。仅放在 protected namespace 内的 marker 本身不合格，必须与 pre-open 文件存在性组合，因为错误 key 同样读不到它。不得自动 rekey、创建新 key 或回退 plain；该组合的 Android 实证结果记录在 CP-1/CP-4 evidence。

这不是复杂迁移设计的遗漏；D-10 已明确旧 v1 不迁移、不清理、不 fallback。可检测性是保护已有文件的工程前置，必须在 CP-1 通过实证闭合，不能被空 namespace 或 plain fallback 掩盖。

## 10b. Seed 设计

```text
SEED=N/A_WITH_REASON
本批是本地 Android adapter，不创建业务事实、账户、菜单或数据库记录；不得 seed。
```

# 11. 非 HTTP 场景与 acceptance design

虽然没有 HTTP acceptance，以下场景是本批实现落到对应真实档位的行为场景；实际结果见 CP-1～CP-4 evidence。未执行档位仍明确列在 CP-4 的 broken boundary 中。

| 场景 | 最小输入 | 真实断言 | 档位 |
|---|---|---|---|
| `persist-kv-mode-isolation` | 同一 persistenceKey、同一 key、plain/protected 两 wrapper | 两侧写入不互读；listKeys 不交叉；clear 一侧后另一侧仍读回；两个 descriptor/port object 不同 | focused 专门反例 + native/Android |
| `persist-kv-protected-restart` | protected 写入已知 sentinel，关闭并重新启动 sample/应用 | module load 成功；protected 重启读回；plain 不能读到；受控文件 artifact 不直接出现可读 sentinel；不宣称强密码学 | Android |
| `persist-kv-plain-compatibility` | 既有 plain v1 write/read/remove/clear | 当前 plain caller 行为不被 protected 接线破坏；v1 文件不被误当新格式 | focused + Android |
| `persist-kv-bridge-wire` | fake native 正常/失败/unavailable/malformed/unknown capability | 每个 public method 的 private wire shape、mode/port/capability mismatch、invalid value 均按 typed bridge failure；测试名称覆盖实际 operation | focused |
| `persist-kv-initialization` | 并发首次调用、context unavailable、初始化抛错后再调用、module recreate | 只有一致 initialized outcome；失败不永久静默；不出现假 success | native + Android |
| `persist-kv-corrupt-read` | 已存在但不能 string decode 的 key/受控文件故障 | 不返回 missing；readMany 策略按 §7-3；不清空全部 namespace | native + Android |
| `persist-kv-protected-identity` | 两个 identity 向量、缺失/变化向量 | 两身份保护表示不同；不可得/变化 typed；不 fallback；实际 key 不进日志 | native + Android |
| `persist-kv-single-process-boundary` | 同进程并发/交错，非支持多进程边界 | 单进程语义按决策；不宣称多进程安全 | focused + Android |
| `persist-kv-sample-hydrate` | sample 的真实 protected port 注入，restart/hydrate | 不再出现 protected `ADAPTER_NOT_INJECTED`；state owner 仍控制 hydrate；错误分类可读 | Android |
| `persist-kv-release-load` | clean release build、目标 API/ABI、R8/安装 | module autolink/load、八 method registration、artifact/ABI 支持有实际输出 | release |

## 11.1 Red fixtures 清单

后续测试必须能让下列变异失败；否则不能声称对应判据可证伪：

1. plain/protected 返回同一个 port object；
2. protected mode 误用 plain namespace 或无 cryptKey overload；
3. protected 失败静默回 plain；
4. private success 缺 port/capability/mode/completedAt；
5. unknown status/capability/额外错误字段未被拒绝；
6. module lookup 每次重复，或第一次失败后永久缓存失败；
7. `read` decode null 被改成 missing；
8. `clear` 错清另一 mode；
9. 删除 timeout 决策后，`StateStoragePort` 或 native method 仍保留无语义的 `timeoutMs`；
10. retryable 对所有错误恒为 true；
11. raw key/value/cryptKey/identity 出现在日志；
12. 测试名声称覆盖 every operation，实际只断言单一 operation；
13. `writeMany` 逐项成功一半却被标成 atomic/no-output receipt；
14. README 示例仍调用单参数 factory 或把 local obfuscation 写成 secure secret；
15. release registration 缺 method、ABI 或 R8 后 module 不可 load。
16. 从 native 边界传入缺失、空或未知 mode token；实现用 `else/default` 当 plain；断言返回 typed invalid-mode failure，且在 failure 前没有 MMKV namespace 的初始化、写入、clear 或其它状态改变。

# 12. Dexter 已冻结的十二项决定

| # | 决策 | 当前设计推荐/影响 | 状态 |
|---|---|---|---|
| 1 | `timeoutMs` | 从 `StateStoragePort` 与 native operation 删除；不做 deadline/cancellation | `FROZEN_BY_DEXTER` |
| 2 | plain/protected timeout policy | 随 D-01 消失；若 state 侧保留全局预算，两 mode 共用且不拆分 | `FROZEN_BY_DEXTER` |
| 3 | `readMany` 单项损坏策略 | 整批失败 | `FROZEN_BY_DEXTER` |
| 4 | `listKeys` 顺序 | adapter 不承诺顺序；state 不依赖 MMKV 偶然顺序 | `FROZEN_BY_DEXTER` |
| 5 | key/size/batch 边界 | persistenceKey 128、entry key 256、单值 1 MiB、单批 512；非空/无控制字符；超限 typed invalid；namespace 总量本批无硬上限，归 state owner | `FROZEN_BY_DEXTER` |
| 6 | durability | 保证正常进程重启可恢复；不承诺断电或内核崩溃；CP-1/CP-4 实证 MMKV API 是否需要显式 sync/msync | `FROZEN_BY_DEXTER` |
| 7 | retryable/diagnostic fields | 按错误类型分类；终止恒 true；无 persistKV retry consumer，不伪造重试行为 | `FROZEN_BY_DEXTER` |
| 8 | `SINGLE_PROCESS_MODE` | 保持；本批不支持多进程，调用方不得假设跨进程可见 | `FROZEN_BY_DEXTER` |
| 9 | protected identity | 使用 `Settings.Secure.ANDROID_ID`；不可得/不匹配 typed unavailable/failure；禁止自动 rekey；版本标记随 protected namespace 前缀冻结 | `FROZEN_BY_DEXTER` |
| 10 | old plain v1 namespace lifecycle | 不迁移、不清理、不 fallback；plain 留 plain，protected 使用全新 namespace | `FROZEN_BY_DEXTER` |
| 11 | sample protected logging/hydrate/wiring | 真实 protected port、正常日志等级、不用 plain 掩盖 protected failure；阻断 CP-3 | `FROZEN_BY_DEXTER` |
| 12 | release matrix | 阻断 CP-4；API/ABI/debug/release/低存储/损坏文件按实际可运行矩阵记录 | `FROZEN_BY_DEXTER` |

十二项已冻结；CP-1 仍不得跳过 key mismatch 可检测性、D-06 durability 实证和 source-level closed-set 校验。

# 13. 停止条件与问题处理

可以继续做的失败必须按“保留 first failure → 读真实日志/输出 → 定位 root cause/broken boundary → 最小修复 → focused re-verification”处理。失败不是 PASS，也不是自动停工。

只有以下情况可以把当前交付停在 `OPEN/BLOCKED` 并向 Dexter 提问：

- §7 的产品/契约选择未给出，且继续会替其改变身份、迁移、批量或恢复语义；
- 受支持环境的硬约束真实成立，例如目标 Android/运行设备无法启动、所需 artifact/网络不可达且没有仓内替代；必须保留日志和 cleanup 证据；
- 实施发现当前需求与“共用 adapter、local obfuscation only、不新增第二套存储”的设计初衷实质冲突；不得自行改方向。

以下不能作为停止或完成理由：测试一次失败、超时、mock 不足、未读日志、动态环境未启动、token/预算接近、历史 verdict、静态通过或“计划已经写好”。

## 13.1 当前可处理与不可处理

| 项目 | 当前判断 |
|---|---|
| MMKV cryptKey 能力/精确签名 | 已有本机静态 artifact 证据；实现仍需 native/Android 行为验证。 |
| 需求两处准入缺口 | 已写入 PKV-R01/PKV-R15；设计仍需 Claude/Dexter review。 |
| §12 十二项决定 | Dexter 已冻结；CP-0 需完成当前字节 source freeze，CP-1 起按冻结文本实施。 |
| 当前 Kotlin/TS 行为 | 以实施后的 owning source、测试输出和 Android/release evidence 为准；历史 baseline 不替代当前证据。 |
| Android/release/cleanup | 当前分别由 CP-4 evidence 记录；cleanup 已 PASS；未取得的真机/断电/多进程等边界仍不升级。 |

# 13b. 三维 reconciliation

每个 CP 结束时和整批交付前都必须逐条重读三维材料：

| 维度 | 必须逐项对账 |
|---|---|
| 需求 | PKV-R01–R18、F/G 条款、§7 决策、证据档位和 no-fallback/no-overclaim |
| 详设/IA | 本文的 mode 数据流、owner、动作/结果、失败/恢复、namespace、README、test/evidence 约束；本批无 UI IA |
| 项目记忆/规范 | deterministic context、terminal coding、ownership、claim-vs-behavior、negative universal、test closed-loop、verification/observability |

每一处实现改动必须先对这三维做前读，完成对应 focused proof 后再后读；后读发现任一偏差即 `OPEN`，不得累积到最终 review。阶段 reconciliation 不产生整批 GO；全部实施完成后仍要有一次独立整批 reconciliation。

# 14. 设计自检与交付状态

```text
REQUIREMENTS_ADMISSION_FIXES=STATIC_RECHECKED
MMKV_CRYPTKEY_ARTIFACT=STATIC_CONFIRMED
DEXTER_DECISIONS=FROZEN_12
IMPLEMENTATION_AUTHORITY=true
SOURCE_MODIFIED_BY_THIS_DESIGN=false
FOCUSED_RUN=PASS_6_ADAPTER_TESTS_PLUS_KERNEL_TESTS
NATIVE_RUN=PASS_KOTLIN_COMPILE_AND_5_D05_VALIDATION_PLUS_2_MODE_UNIT_TESTS_PLUS_MMKV_PROBE
ANDROID_RUN=PASS_RELEASE_MODULE_LOAD_ISOLATION_MISMATCH_RESTART_SCENARIOS
RELEASE_RUN=PASS_APP_ASSEMBLE_RELEASE_AND_INSTALL
CLEANUP=PASS_EXACT_PROCESS_FILES_SETTINGS_AND_ADB_STATE
CODE_DESIGN_RECONCILIATION=MATCHED_ALL_LISTED_FILES
OVERALL_DESIGN_STATUS=IMPLEMENTATION_COMPLETE_PENDING_INDEPENDENT_REVIEW
```

自检问题：

- 是否仍只有一个 Android module/adapter/store owner？是，推荐形状如此；需实施静态 gate 复核。
- 是否把 `persistSecure` 当成与 `persistKv` 同一个 port object？否；设计明确要求两个 frozen wrapper。
- 是否把 artifact signature 当行为证据？否；单独标 static artifact。
- 是否替 Dexter 选择 timeout、identity、旧 namespace、readMany、retryable、release？否；均按 §12 `FROZEN_BY_DEXTER` 原样落地。
- 是否把 zero-caller 的方法删掉或伪造 workload？否，保留 API，按 PKV-R02 分层。
- 是否引入 UI、Web、seed、数据库、state engine 批量化或复杂安全迁移？否。
- 是否已经实施、构建或运行？已实施、构建并完成当前授权内的 focused/native/Android/release 运行；结果与边界见 CP-1～CP-4 evidence，独立 implementation review 尚未完成。

实施计划引用本文的 CP、anchor、red fixture、证据档位和三维 reconciliation；它不把本详设或 requirements GO 当作行为证据。

# 15. 本轮独立 review finding 处置登记

以下是对 `doc/review/platform/2026-09-12-v2s-terminal-android-persist-kv-design-review-claude.md` 的作者侧 dialectical intake，不是把 Claude 的历史 verdict 改写成通过。三条 finding 已重新打开当前详设、计划与 owning source 后确认；本节修订后的字节没有被该轮历史 review 重新复核，后续必须重新送 review。

| finding | 独立重开结论 | 最小落点 | 预防落点 |
|---|---|---|---|
| M-01 mode 入参没有 runtime fail-closed | `CONFIRMED`：`src/index.ts` 的 TS union 不能跨 Expo bridge；详设原文只规定合法映射，未规定缺失/未知输入 | §2.1 增加 exact closed-set、typed invalid、store open 前拒绝、禁止 `else/default` 落 plain；§4.2、CP-1 gate 和 §11.1 item 16 同步 | `explicit review checklist`：CP-1/CP-2 的 inbound enum boundary red mutation |
| S-01 cryptKey 错配不可检测 | `CONFIRMED`：§10 原来只规定不应返回 missing，没有规定如何区分错误 key 与新空 namespace；artifact 中的 `checkReSetCryptKey` 仅是符号存在，不是行为证明 | §10 增加 compatibility detection 前置；当前实现使用 `checkExist` + versioned marker，并在 CP-4 实证新 namespace、错误 key 与不可解文件 | `explicit review checklist`：protected open 的 existing-file/key-mismatch vs fresh-namespace counterexample；CP-4 已记录 |
| S-02 public export surface 漏在完整变更面 | `CONFIRMED`：当前 `src/index.ts` 导出 factory，factory 签名/类型变化会改变 package public entry；原 §9a 与 CP-3 未列该文件 | §9a 增 public export row；计划 CP-3 增 `src/index.ts` 源锚、动作和 gate | `explicit review checklist`：package entry 与 internal implementation 的全量变更面对账 |

Dexter 已冻结 §12 十二项并授权实施；本轮 note 只把“错误 key 与新空 namespace 必须可区分”的 non-encrypted pre-open signal 写入 CP-1 准入，没有新增产品语义。源码、测试、依赖、构建和当前授权内的 dynamic evidence 已记录；最终独立 implementation review 仍待 Dexter/Claude。
