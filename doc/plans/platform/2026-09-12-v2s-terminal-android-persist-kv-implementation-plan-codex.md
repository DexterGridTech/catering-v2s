---
title: TER Android persistKV / persistSecure 共用适配器实施计划
documentKind: IMPLEMENTATION_PLAN
status: IMPLEMENTATION_COMPLETE_PENDING_INDEPENDENT_REVIEW
sourceRequirements: doc/plans/platform/2026-09-12-v2s-terminal-android-persist-kv-gap-analysis-and-requirements-codex.md
sourceDesign: doc/plans/platform/2026-09-12-v2s-terminal-android-persist-kv-implementation-design-codex.md
implementationAuthority: true
---

# 0. 身份、授权和当前状态

```text
PLAN_STATUS=IMPLEMENTATION_COMPLETE_PENDING_INDEPENDENT_REVIEW
BUSINESS_SOURCE=doc/plans/platform/2026-09-12-v2s-terminal-android-persist-kv-gap-analysis-and-requirements-codex.md
DESIGN_SOURCE=doc/plans/platform/2026-09-12-v2s-terminal-android-persist-kv-implementation-design-codex.md
AUTHORIZED=按本计划实施 persistKV/persistSecure 共用 Android adapter，并执行 CP-0～CP-4；不扩范围
NOT_AUTHORIZED=后台 DEV / seed / UAT / 部署 / 其他产品范围；仓库控制仍由 Dexter 负责
IMPLEMENTATION_AUTHORITY=true（Dexter 2026-09-12 直接授权；仅限本批）
CODE_DESIGN_RECONCILIATION=MATCHED_ALL_LISTED_FILES
```

本文件是当前已获授权的执行顺序。CP-0 source freeze 已完成，CP-1～CP-4 已按固定顺序执行并分别记录。任何动态档位仍只以实际运行结果为准，不由计划、历史结论或静态 artifact 代替；最终独立 implementation review 尚未完成。

本批没有 UI/L2、HTTP、数据库或 seed。`Web=NOT_APPLICABLE_WITH_REASON` 对 Android adapter 不构成任何 Android/native/release 证据；`visual=NOT_APPLICABLE_WITH_REASON` 也不代表 UI 通过。

# 1. 执行原则和输入闭包

实施前主 agent 必须重新读取以下材料，不能依赖本计划的摘要：

1. `AGENTS.md`、`PLATFORM-BLUEPRINT.md`、`doc/platform/README.md`、当前 Roadmap 授权字段；
2. `project-memory/index.md` 与六维 memory query 命中的全部原文；
3. `doc/platform/scripts/README.md`（若实际仓路径为 `scripts/README.md`，以仓内入口为准）；
4. requirements、design、终端 Android coding/observability/review 规范；
5. 所有 current-byte owning source 和当前 run/evidence（若存在），优先 source 不采信作者处置表；
6. 本批实际 dirty worktree，保护 Dexter/其他任务已有变更，只在精确 anchor 上修改。

每一个实际变更点遵循：

```text
前读：需求条款 + 详设 anchor + 相关 memory + owning source
实施：主 agent 唯一写入；同一事实只保留一个 owner
focused proof：让对应 red mutation 失败，再以正向控制闭合
后读：用同一组原文逐点复核行为、形态、动作、结果、失败/恢复、数据来源和证据档位
阶段对账：fresh 独立子 agent 只读三维对账；finding 必须修复并重审
```

子 agent 不得写文件、跑动态命令或替代主 agent 编码。每个 CP 后的独立审查是步骤证据，不是本批最终正式 review；整个实现完成后还必须重新进行一次整批 fresh implementation adversarial review。

# 2. 前置条件和阻断清单

## 2.1 CP-0 必须先关闭的决定

以下 12 项来自需求 §7，Dexter 已在设计 §12 逐项冻结；计划不改写其语义。实施前必须把它们逐项对到账位，任何 source/设计引用漂移仍阻断 CP-1：

| 项 | Dexter 冻结值 | 实施约束 |
|---|---|---|
| D-01 | timeout | 从 `StateStoragePort` 与 native operation 删除；不做 deadline/cancellation。 |
| D-02 | plain/protected timeout policy | 随 D-01 消失；state 若保留全局预算则两 mode 共用。 |
| D-03 | readMany 损坏项 | 整批失败。 |
| D-04 | listKeys 顺序/重复 | adapter 不承诺顺序；state 不依赖偶然顺序。 |
| D-05 | key/size/batch 限制 | persistenceKey 128、entry key 256、单值 1 MiB、单批 512；非空/无控制字符；超限 typed invalid；namespace 总量本批无硬上限，归 state owner。 |
| D-06 | durability level | 正常进程重启可恢复；不承诺断电/内核崩溃；实际 MMKV sync/msync 方式须实证。 |
| D-07 | retryable/diagnostic fields | 按错误类型分类；终止恒 true；无 persistKV retry consumer，不伪造重试。 |
| D-08 | `SINGLE_PROCESS_MODE` 边界 | 保持；本批不支持多进程。 |
| D-09 | identity、变化、版本 marker | `Settings.Secure.ANDROID_ID`；不可得/不匹配 typed unavailable/failure；禁止自动 rekey；protected v1 marker/namespace 冻结。 |
| D-10 | old v1 lifecycle | 不迁移、不清理、不 fallback；plain 留 plain，protected 用全新 namespace。 |
| D-11 | sample protected logging/hydrate/wiring | 真实 protected port、正常日志等级、不用 plain 掩盖；阻断 CP-3。 |
| D-12 | release API/ABI/debug/release/fault matrix | 阻断 CP-4；按实际 API/ABI/debug/release/低存储/损坏文件证据收口。 |

`D-09`/`D-10` 已写入 design §12；实施仍必须以 owning source 和真实证据核对 `ANDROID_ID`、protected v1 namespace、不可得/不匹配和无 fallback 行为。

## 2.2 已确认但仍需运行验证的输入

- MMKV 2.4.2 artifact 提供 `mmkvWithID(String,int,String)` 和 `cryptKey/reKey/checkReSetCryptKey`；这是 static artifact evidence。
- 当前 module 的 Android registration、八个 AsyncFunction、`SINGLE_PROCESS_MODE`、plain v1 namespace、JS factory、sample injection 均是 source anchors，不是行为 PASS。
- state codec 在 kernel state owner；adapter 不解析 opaque string。

# 3. 固定顺序、gate 与状态

顺序固定为 `CP-0 → CP-1 → CP-2 → CP-3 → CP-4`。CP-1、CP-2、CP-3 不并行，因为每一步都改变下一步的输入契约。每一阶段必须有单独 focused proof、阶段三维对账和独立只读审查；后一步不得吸收前一步 OPEN。

| 步骤 | owner/范围 | 精确源锚 | gate（必须可证伪） | 阶段对账 | 当前 |
|---|---|---|---|---|---|
| CP-0 决策锁与 source freeze | 主 agent 只读准备；按 Dexter 冻结值落位 | requirements §7；design §12；MMKV artifact；Kotlin `withStore`/`namespaceId`；TS `createAndroidPersistKvPort`/`callNative` | 12 项决定、artifact signature、caller census 与 dirty boundary 已重开 | 三维逐项对账；任何引用漂移为 OPEN | MATCHED |
| CP-1 native mode/store | Kotlin module、mode resolver、validation、MMKV 初始化和结果 helpers | `TerminalPersistKvModule` 的 `definition`、`withStore`、`namespaceId`、`success/failure/unavailable` 与 `StorageValidation` | mode fail-closed、namespace/cryptKey、sync、mismatch、隔离、重启、D-05 native boundary 和 item 16 red mutation 已有实际结果；D-05 public bridge invalid input 未逐一运行且在 evidence 明列 | native/Android evidence + reconciliation | MATCHED |
| CP-2 bridge/wrappers | JS native type、validator、cache、两个 frozen ports | `androidPersistKv.ts` 的 `NativePersistKvModule`、`callNative`、factory、descriptor symbol | six focused tests 覆盖 malformed/mismatch/cache/wrapper/typed failure，实际结果已记录 | focused evidence + reconciliation | MATCHED |
| CP-3 sample/package/README | 生产 assembly、包图、README、公共导出、无关 dirty preservation | `platformPorts.ts` 的 `createPlatformPorts`、adapter `src/index.ts`、package/graph/README/registration | static/typecheck gate、真实接线和 README 回读已记录 | static/typed evidence + reconciliation | MATCHED |
| CP-4 evidence/closure | tests/evidence only after implementation | adapter test、release artifact、Android logs、exact cleanup | 每档实际执行；business/cleanup 分离；first failure、last known good、未跑边界与 reconciliation 已记录 | CP-4 evidence + full reconciliation | MATCHED |

# 4. 步骤执行细则

## 4.1 CP-0：决策锁与现状重开

1. 重开 requirements PKV-R01–R18、F-19 caller census、§7 十二项；逐项记录 Dexter 的最终值/owner/生效边界。
2. 用当前 artifact 重新确认 `MMKV.mmkvWithID(String, int, String)` 的 exact signature；如果实际解析 artifact 改变，保留 first failure，回到 design 重新比选，不手写密码学替代。
3. 重开 Kotlin/TS/kernel/sample source，画出 mode → namespace/cryptKey → private wire → public descriptor → state owner 的 source-to-consumer 链。
4. 生成一份 implementation-scoped change inventory，包含所有计划修改文件、anchor、需求 ID、证据档位和现有 dirty 状态。
5. Gate 结果只能是 `READY` 或 `BLOCKED`；CP-0 已在 source freeze 与 artifact/caller/dirty 对账完成后记为 MATCHED，后续实现和证据按固定顺序执行。

最小解理由：CP-0 只把已冻结事实绑定到当前 source/依赖边界，不先新增抽象或测试框架；先做 source freeze 可避免把 D-01～D-12 的语义散落到不同 owner。

## 4.2 CP-1：Kotlin mode resolver 和 MMKV

计划动作（只有 CP-0 READY 后）：

- 在同一 `TerminalPersistKvModule` owner 内引入最小闭合 mode/config resolver；八个 AsyncFunction 只通过它得到 store，不复制 plain/protected 分支。
  - plain 使用现有 v1 namespace 映射；protected 使用冻结的 `catering-v2s.terminal.state.protected.v1.` 和 `MMKV.mmkvWithID(id, SINGLE_PROCESS_MODE, cryptKey)`。
- 复用现有 initialization lock/application context boundary；明确 concurrent first call、context unavailable、init failure retry、module recreation；不新增第二 init service。
- native success/unavailable/failure private wire 包含 logical port、mode、capability 及安全字段；结果 helper 不把异常吞成 success，不写 raw key/value/cryptKey/identity。
- 保持 state value opaque；不在 Kotlin adapter 加 JSON/envelope；不改变 state engine 的 flush/reset。
  - 删除 `timeoutMs` 后同步所有 `StateStoragePort` consumer；对 key/size/batch 做 D-05 typed invalid 校验；`readMany` 单项损坏整批失败，`listKeys` 不承诺顺序；无一般 caller 的 `writeMany/removeMany/clear` 不伪造 workload/atomic/receipt，隔离反例按要求保留。

CP-1 focused/native gate：

  - 正向：plain/protected 同 key 写入，各自读回；正常进程重启读回；同一 mode 的 remove/clear 按决定生效；D-06 的实际 MMKV durability API 行为有日志和结果。
  - red：同 namespace、cryptKey 缺失、模式错、缺失/未知 mode token 走 `else/default`、invalid mode 抛未分类异常或被转成 missing；所有 invalid mode 必须在 store open 前 typed failure 且零 namespace write。另测“identity 缺失返回 missing”和“cryptKey mismatch 返回 missing”这两种错误实现；正向断言必须是 typed unavailable/failure，不能把两者当作 missing。再测初始化失败 sticky、clear 误清另一 namespace、decode null→missing、异常→success、D-05 native validation 每个边界均 typed；public Expo bridge 的逐项 invalid vector 仍单独登记未执行。
  - cryptKey compatibility gate：当前实现以 `MMKV.checkExist(namespace)` 作为加密外的既有文件信号，再用 adapter-owned protected marker 验证当前 cryptKey；新建 namespace 写 marker 并 `sync()`，既有文件但 marker 解不出时返回 `PERSIST_KV_PROTECTED_KEY_MISMATCH`。仅在 protected namespace 内的 marker 不合格，必须与文件存在性组合；不得用 missing、自动 rekey 或新 key 继续。
  - native test harness 必须先查现有依赖/runner；不因计划自动新增 Gradle test dependency。若没有可复用 harness，记录精确缺口并在当前授权范围内用最小 existing Android proof；仍不可运行才按真实硬约束记录，不能把未跑档位写成 PASS。

CP-1 后读和独立审查：逐行对照 requirements PKV-R01/R03/R04/R06–R12/R14/R18、design §2–§4/§7、memory ownership/claim-vs-behavior/observability。fresh reviewer 只读；任何 OPEN 由主 agent 修复后再审。

## 4.3 CP-2：JS bridge、validator 和两个 wrapper

计划动作：

- 将 factory 改为显式 mode；不提供会默认为 plain 的可选 mode。
- 保留一个 `NativePersistKvModule` operation table；以 `requireNativeModule` lazy cache 共享 module object。成功 lookup 可缓存，失败 lookup 不缓存失败结果。
- 将 native 返回当 `unknown` 处理，由私有 validator 验证闭合 status、expected logical port、mode、capability、value、completedAt、error；验证通过后映射为现有 kernel `PortResult`。不为全局 `PortSucceeded` 扩散 Android-only 字段，除非 CP-0 重新裁定。
- 根据 mode 生成两个独立 frozen `StateStoragePort`；descriptor 的 port/mode/state/source/capabilities 正确。调用数组/字符串仍由既有 `StateStoragePort` 类型传入，adapter 不 parse/serialize state value。
  - 删除 `StateStoragePort` 和 native operation 的 `timeoutMs` 传递；同步所有 consumer；不得保留“参数存在但没有语义”的中间态。retryable 按错误类型实现，终止恒 true。

CP-2 focused gate：

- 每个实际 method 至少有 success、typed unavailable/failure、malformed wire 的断言；没有 production caller 的一般 workload 仍标 static-only，但 mode/namespace 专门反例不免除。
- red：unknown status、缺字段、wrong mode/port/capability、wrong read value、bridge exception、same wrapper object、protected descriptor unavailable、失败缓存。
- 必须有一次 mutation 验证：让 validator 绕过或把 mode 改错时测试红；把两个 wrapper 合成同 object 时 descriptor/identity test 红。
- 测试名称必须与 assertion surface 一致；名称写 `every operation` 就必须逐 operation 断言，否则按未覆盖。

CP-2 后读和独立审查：对照 design §2.1、§3 固定机制、§4.3、§7 matrix、requirements PKV-R03/R04/R13/R15/R18；不以 fake native 结果外推 Android registration。

## 4.4 CP-3：sample 生产接线、包图和 README

计划动作：

- 在 `sample-terminal/src/assembly/platformPorts.ts` 的既有 injection seam 中，以同一 factory 显式生成 plain `persistKv` 与 protected `persistSecure`。
- 移除该 seam 对 `unavailablePersistSecurePort` 的生产接线；不删 kernel default，因为其他平台/无 adapter 的 typed unavailable 仍可能需要。
- 不覆盖该文件中 Dexter/其他任务已有的无关 dirty changes；写入前记录 exact diff boundary。
- 同步检查 `src/index.ts` 的公共导出；factory 签名、mode 类型或 convenience helper 必须从 package entry 可用。
- 重新检查 `package.json`、`dependencies.ts`、`skeleton-graph.ts`、`expo-module.config.json`、Gradle namespace/dependency，确保仍是一个 adapter/module、依赖集合闭合。
- 更新包根中文 README：定位、owner/toolkit、目录、真实 factory 签名、两个 mode、八方法、opaque state、SINGLE_PROCESS、local-only 边界、无 storage timeout、错误/重启和 evidence 边界、禁止 fallback、测试档位和迭代指引；示例逐个回源码核对。

CP-3 gate：

- static：two port references different；descriptor mode/state/source/capabilities correct；sample no unavailable protected binding；`src/index.ts` public export 与实现一致；package graph/registration exact。
- red：把 protected 重新接 unavailable、把两个 mode 指向 plain、把 README 示例改回旧签名、删 registration method、加第二 module/registry，机器或 focused contract 必须红。
- 不把 static injection 记 Android module load PASS；真实 load 留 CP-4。

CP-3 后读和独立审查：对照 requirements PKV-R13/R16/R17/R18、design §3/§4.4/§9a、terminal coding standard TR-10 与 module ownership；全 MATCHED 才能进入 CP-4。

## 4.5 CP-4：证据收集和整批收口

CP-4 只能在 CP-0–CP-3 gates 和阶段对账全 MATCHED 后执行。每个动态 run 必须有受管 manifest、受控 process/device identity、log path、first failure、last known good、broken boundary、business result 和 cleanup result；不以 exit code/port/等待时间代替。

| 档位 | 实际要证明 | 当前授权/状态 |
|---|---|---|
| static | 八方法、module registration、factory/descriptor、mode/namespace constants、package/Gradle/README、caller census | 已运行；CP-3 与 skeleton gate 输出 |
| focused | JS validator、cache、two wrapper、typed error、隔离专门 red fixture | 已运行；adapter 6/6，mock 不升级 native |
| native | Kotlin mode resolver、MMKV overload、init/error/corruption/log redaction | Kotlin compile/unit 与真实 MMKV probe 已运行，边界见 CP-1/CP-4 |
| Android | real Expo module load、sample protected hydrate、plain/protected isolation、restart、known sentinel/mismatch | 已在 `emulator-5554` 运行；真机/多进程等未升级 |
| release | clean dependency resolution、API/minSdk/ABI、R8、install、autolink/module load | release build/install/module load 已运行 |
| Web | Android adapter Web behavior | `NOT_APPLICABLE_WITH_REASON`，不代替 Android |
| visual | 本批无 UI | `NOT_APPLICABLE_WITH_REASON` |
| cleanup | 每个动态环境、设备、日志、临时文件和进程归属清理 | CP-4 exact cleanup PASS |

protected 文件表示的验证只证明“受控已知 sentinel 不以可直接阅读的明文出现在受控存储表示，且真实 MMKV 可重启读回”；不得宣称抗逆向、密钥保密或强安全。若文件格式/压缩使直接 bytes 观测不可复现，保留 first failure 并向 Dexter说明可证据边界，不用纯函数结果替代。

# 5. 逐代码与详设对账（交付硬闸）

实施完成后、整体测试和人类 review 之前，主 agent 必须完成一份新的 `CODE_DESIGN_RECONCILIATION`，不是引用本计划或阶段总览。它必须：

1. 枚举实际变更的每个 source/test/package/Gradle/README/evidence 文件；不得抽样；
2. 对每一处实际代码变更记录 file + unique symbol/line、requirements ID、design §/anchor、实际行为和证据档位；
3. 逐代码核对 declaration → transfer → consumption，mode、logical port、namespace、cryptKey、timeout、error、descriptor、sample wiring、README 和 logging 的单一 owner；
4. 逐条核对需求中的动作、结果、状态、失败/恢复、禁止事项和 zero-caller 边界；
5. 只允许两种结果：`MATCHED` 或 `OPEN`。不得使用 `PASS_BY_PLAN`、`ASSUMED`、`COVERED_BY_COUNT`、`NOT_RELEVANT` 逃避；不适用必须有具体 reason；
6. 任一 `OPEN`、未读日志、未跑档位、未完成 cleanup 或未解决的 Dexter decision，均不得把 implementation 交给 Dexter/Claude review。

预期对账表模板：

| # | 实际 file + symbol | 需求 ID | 详设 anchor | 三维行为对照 | 证据档位/会话 | 结果 |
|---|---|---|---|---|---|---|
| 1 | `<actual>` | `<PKV-R..>` | `<§/anchor>` | declaration/transfer/consumption 全匹配 | `<tier, fresh?>` | `MATCHED`/`OPEN` |

本表的实际逐文件结果在 `doc/evidence/platform/2026-09-12-v2s-terminal-android-persist-kv-implementation-reconciliation-codex.md`；所有列出的结果均为 `MATCHED`，未跑的证据边界在 CP-4 明列，未被折算为 PASS。

# 6. 失败处理、回滚边界和最小修复纪律

- 测试/runner 失败：保留原始输出和日志，先诊断 root cause、first failure、last known good、broken boundary；修复 owning source 后只重跑受影响的 focused proof，再按阶段对账。
- MMKV/artifact/API 不一致：不切换到手写加密或第二 module；回到 CP-0，重新核对 dependency resolution 和 design decision。
- Android module load 失败：检查 registration、package graph、Gradle artifact、ABI/API 和日志；不以 fake native 或等待掩盖。
- protected 读回失败：区分 identity/namespace/cryptKey/初始化/文件损坏/bridge wire；不得 fallback plain，也不得 clear 全部数据。
- cleanup 失败：业务结果与 cleanup 分离，cleanup 未 PASS 即动态 run 未关闭；只停止 manifest 明确拥有且 identity 匹配的资源。
- 任何设计方向冲突：停止在精确决策点，向 Dexter 给出已完成 source/log 证据、最小选项和影响；不自行扩范围。

修复必须保持最小：优先修复同一 owner 的根因、复用 MMKV/现有 module/现有 port contract；不得为了一个 red fixture 新增通用缓存、第二队列、第二 registry、密码学框架或迁移层。

# 7. 证据和 review 交付格式

实施结束后交付材料必须至少包含：

- 实际 `CODE_DESIGN_RECONCILIATION`，所有项仅 `MATCHED/OPEN`；
- CP-0–CP-4 各自 gate 输出、fresh session 标记和阶段对账；CP-4 另附与 release hash 绑定的脱敏原始 transcript；
- A/PKV 条款到实际证据的映射，注明 static/focused/native/Android/release/cleanup；
- zero-caller 的 `read/writeMany/removeMany/clear` 一般 workload 仍是 static-only 的事实，以及 R01/R12/R13 专门隔离反例；
- MMKV 2.4.2 实际 API/依赖 artifact 证据与真实 module/load 的区别；
- Android restart、known sentinel 文件边界、identity vector、plain/protected isolation、fault/log redaction 结果；
- N-2 或任何仍未跑的项明确 `UNVERIFIED_REQUIRES_EVIDENCE`，不得用算术、测试数量或计划替代；
- business 与 cleanup 分离，动态资源清理结果；
- 实际未完成项和下一步，不以“计划如此”代替“实际如此”。

当前文档与实施证据已达到 implementation-facing 交付状态，但不在此处提前宣布最终独立 review 的 GO。Android 真机、断电/内核崩溃、多进程、低存储、真实 identity rotation、逐项 D-05 public bridge invalid input 与 visual 仍按证据边界保留未执行；它们不属于本批已批准的实现矩阵。

# 8. 当前交付自检

```text
DESIGN_SOURCE_READ=YES
REQUIREMENTS_ADMISSION_FIXES_RECHECKED=YES
MMKV_CRYPTKEY_SIGNATURE_STATIC_CONFIRMED=YES
DEXTER_DECISIONS_RESOLVED=YES (12 FROZEN_BY_DEXTER)
SOURCE_IMPLEMENTATION=COMPLETE_FOR_APPROVED_SCOPE
CODE_DESIGN_RECONCILIATION=MATCHED_ALL_LISTED_FILES
FOCUSED=PASS_6_ADAPTER_TESTS_PLUS_KERNEL_TESTS
NATIVE=PASS_KOTLIN_COMPILE_AND_5_D05_VALIDATION_PLUS_2_MODE_UNIT_TESTS_PLUS_MMKV_PROBE
ANDROID=PASS_RELEASE_MODULE_LOAD_ISOLATION_MISMATCH_RESTART_SCENARIOS
RELEASE=PASS_APP_ASSEMBLE_RELEASE_INSTALL_AND_MODULE_LOAD
WEB=NOT_APPLICABLE_WITH_REASON
VISUAL=NOT_APPLICABLE_WITH_REASON
CLEANUP=PASS_EXACT_PROCESS_FILES_SETTINGS_AND_ADB_STATE
DELIVERY_STATUS=IMPLEMENTATION_COMPLETE_PENDING_INDEPENDENT_REVIEW
CLAUDE_REVIEW_REMEDIATION=M-01/S-01/S-02_APPLIED_TO_DESIGN_AND_PLAN
CURRENT_BYTES_AFTER_REMEDIATION=REOPENED_AND_RECONCILED_BY_MAIN_AGENT
```

本计划没有提出 Git 操作，没有要求后台 DEV/seed/UAT/deploy；本批源码、测试、Gradle、README 和证据已按授权实施，运行资源按 CP-4 exact cleanup 收口。

# 9. 本轮 review 的修订边界

Claude 的 `NO-GO, 1M / 2S / 0N` 经过当前字节重开后，三条均为 `CONFIRMED`，并已按最小范围同步：

- mode 入参：详设 §2.1、CP-1 gate 和 item 16 red fixture 现在要求 runtime closed-set、typed invalid、store open 前零写入，禁止任何 `else/default` 落到 plain；
- cryptKey：详设 §10 和计划 CP-1 现在采用 `MMKV.checkExist(namespace)` + adapter-owned protected marker 的组合；它在 CP-1/CP-4 以错误文件与新建 namespace 的实证关闭，不调用自动 rekey；
- public export：详设 §9a 和计划 CP-3 现在显式包含 `apps/terminal/adapter/android/persist-kv/src/index.ts` 的 public export surface。
- invalid mode diagnostics：Claude implementation review 的 N-01 已按当前公共 `PortFailure` 契约最小修复；JS 非法 mode 不再经 `logicalPortOf` 推导端口，保留与 native 一致的中性 `persistKv` 槽位并把安全 token 描述写入 `PERSIST_KV_INVALID_MODE` message；adapter 6/6 与受影响三个 workspace 的 focused/typecheck remediation 输出见 `doc/evidence/platform/2026-09-13-v2s-terminal-android-persist-kv-implementation-remediation-codex.md`。

Dexter 已授权 implementation；本计划只把冻结决策与可执行边界落位，不把任何静态材料扩写为 behavior evidence。CP-0～CP-4、实际证据和全量对账已完成；当前实现仍需交 Dexter 与 Claude 做独立 implementation review。
