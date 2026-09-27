# 终端激活与长连接需求评审（Codex）

- 评审对象：`doc/plans/platform/2026-09-25-v2s-terminal-activation-and-connection-requirements-claude.md`
- 关联讨论：`doc/plans/platform/2026-09-25-v2s-terminal-activation-and-connection-requirements-analysis-claude.md`
- 关联门店终端需求：`doc/plans/platform/2026-09-23-v2s-store-terminal-management-requirements-claude.md`
- 日期：2026-09-26
- REVIEW_TARGET=DESIGN
- ACTION_1_VARIANT=1-B 文档提取
- REVIEW_CYCLE_ID=DEXTER_TRANSMITTED_CODEX_REVIEW_2026-09-26
- REVIEW_ROUND=1（Codex 与 Claude 经 Dexter 中转的 review；不设轮次上限）
- 范围：只做需求评审，只写本文件。未改需求正本、门店终端材料或其他文件；未执行测试、构建、backend-acceptance、DEV、reset、seed、L2、UAT、部署或数据操作。

## 1. 结论

```text
REVIEW_TARGET=DESIGN
ACTION_1_VARIANT=1-B 文档提取
VERDICT=NO-GO
M/S/N=0/4/0
L1_ENGINEERING=4 个已确认的 S finding；证据档位为静态源码/文档
L2_USER_VISIBLE=PASS_STATIC_FOR_REQUIREMENT：D-18 的只读目标及 V-U1 明确；不代表现有页面已更新或动态通过
L3_UNVERIFIED=未运行实际 UI/L2、backend-acceptance、多实例 harness、DEV 或动态故障注入
SAME_ROOT_SCAN=已扫描 R-12 暴露面/认证门、TER event bridge、state persistence owners、门店终端 D-36 同族条款
DESIGN_GAPS=R-12 门/上下文清单不完整；TR-11 command/actor 与播种去重未落入判据；V-T8 不足以证明 R-9.6 的全称清理要求
TEMPLATE_COVERAGE=Journey 模板逐节有；IA/交互/implementation-facing 详设模板对本需求文档均为阶段性 NOT_APPLICABLE，后续工件已被要求生成/更新
EVIDENCE_TIER=STATIC_SOURCE_ONLY
```

四项 finding 均为当前需求与仓内正本/源码之间的可复核缺口，不要求 Dexter 重作已作出的产品裁决。总体 **NO-GO，M/S/N=0/4/0**。

### 独立审查对照

- fresh 独立子 agent `/root/terminal_design_review`：`NO-GO`，`M/S/N=0/3/0`。它先独立形成 findings，之后才读 §11；三项 finding 分别落在 R-12 gate、已取消的 server-config memory 与 TR-11 网络事件桥。
- fresh TER transport 子域审查 `/root/ter_transport_review`：其限定子域结论为 `GO`，`M/S/N=0/2/0`；其中两项分别是 TR-11 bridge 判据和 V-T8 分母。主审逐条重开源码后，确认这两项与前三项合并去重，不影响本评审整体 NO-GO。
- 独立审查输入包括本需求 §0～§10、§12、§13，讨论稿 §1、§8，门店终端相关条款，项目入口/规范、四份模板和 owning source。主审遵守先读正本、后读 §11 的顺序。

## 2. Findings

### S-1 · R-12 少列认证安全门，终端凭证上下文的生成闭包也未写完整

- **位置**：需求 R-12、V-G1（§3.12、§4.6）；`operation-handler-bindings` 的终端凭证上下文扩展。
- **性质**：仓内事实 + 推论；状态：`CONFIRMED`。
- **证据**：
  - R-12 列出 code-layout、verify-gates、ArchUnit、platform-boundary-gates、四个生成器、operation-count policy/registry 和 module-dependency registry：`doc/plans/platform/2026-09-25-v2s-terminal-activation-and-connection-requirements-claude.md:378-393`。
  - 现行 gate `scripts/check/capability-invariants` 调用 `tools/capability-invariants/cli.mjs`：`scripts/check/capability-invariants:1-4`。解析 `x-consumer-faces` 后只区分 platform-super-admin、anonymous public 与 authenticated workspace：`tools/capability-invariants/cli.mjs:828-836`；resolver ID 和 authorization mode 也是闭集：`tools/capability-invariants/cli.mjs:883-919`。此 gate 未在 R-12 已知清单中。
  - `operation-handler-bindings.mjs` 不只使用 `CONTEXT_KINDS`：`COMMAND_CONTEXTS` 也是闭集，command/context、按 face 的约束、Java context 类型映射和 context 计数分别见 `scripts/generate/operation-handler-bindings.mjs:34-50,399-423,516-523,778-783`。
  - R-12 点名了该生成器与 `CONTEXT_KINDS`，但没有把这些关联映射/校验/输出写入清单或 V-G1 判据：`doc/plans/platform/2026-09-25-v2s-terminal-activation-and-connection-requirements-claude.md:387-393`。
- **影响**：只加第四个 consumer face 和一个 context kind，可能仍被 capability-invariants 误分类为 workspace/public，或在 operation-handler-bindings 的 command context、Java 类型映射处失败。V-G1 目前只要求终端凭证解析器与 session resolver 两类安全红夹具，不能证明整条 context 生成链闭合。
- **最小修正（可验收）**：
  1. R-12 known-gates 明列 `scripts/check/capability-invariants` 与 `tools/capability-invariants/cli.mjs`，写清终端凭证模式/解析器相对 public 与 authenticated-workspace 的归属。
  2. R-12 将 `operation-handler-bindings` 的 `COMMAND_CONTEXTS`、按 face 校验、`contextTypeRef`、生成的 Java context 类型和 context 计数列为同步项。
  3. V-G1 增加反例：终端认证被解析为 workspace/session、激活接口引用 session resolver、错误 context 无法生成/校验时，各自使对应 gate 失败；正向终端凭证 context 可生成且解析到指定 resolver。
- **需要 Dexter 裁决**：否。D-4 已授权新终端面，R-12/V-G1 已确定安全要求；这是门清单与验收的补全。

### S-2 · 新 server-config owner 与 active 项目记忆中的“概念取消”矛盾未 supersede

- **位置**：R-11、R-12 的 memory supersede 清单。
- **性质**：仓内事实 + 推论；状态：`CONFIRMED`。
- **证据**：
  - 新需求要求新建有 slice、command、actor 和持久化能力的 `kernel/base/server-config`：`doc/plans/platform/2026-09-25-v2s-terminal-activation-and-connection-requirements-claude.md:332-352`。
  - 当前路由项目记忆状态为 `active`，taskKinds 包含 design/implementation/review：`project-memory/decisions/terminal-build-order-and-batches.md:1-12`；其“批 N 不建”仍写 `server-config（概念取消）`：`:28-30`。
  - R-12 的现有 memory supersede 列表列举 service-shape 与 distributed-topology 条目，没有列出 `terminal-build-order-and-batches.md`：需求 `:364-376`。
- **影响**：按新 R-11 建立 package 的详设/评审，仍会从 active 项目记忆读到“概念取消”，造成同仓要求互相否定和返工。
- **最小修正（可验收）**：R-12 的检索/处置全集必须显式包含该 active memory。以 D-11/D-16 和批次②的新决定为替代依据，删除或退役旧的“概念取消”句，或写出可路由的明确 supersede；完成后同一 memory 检索不得再命中一个仍生效的“server-config 不建”结论。
- **需要 Dexter 裁决**：否。D-11 已直接决定新建 server-config；当前缺的是清除/取代旧约束。退役条目可以彻底删除，但应保留可路由的新决定来源。

### S-3 · R-10.4 要求 transport 内转 command，却未满足 TR-11 的 actor、首事件播种与去重判据

- **位置**：R-10.4、V-T14、transport README/module owner 边界。
- **性质**：仓内事实 + 推论；状态：`CONFIRMED`。
- **证据**：
  - R-10.4 让 transport 订阅 network port 并“在 transport 内部转成 command”：`doc/plans/platform/2026-09-25-v2s-terminal-activation-and-connection-requirements-claude.md:326-330`。
  - TR-11 唯一合法路径是 event → command → consuming owner’s actor → dispatch；command 在可依赖 runtime 的消费方定义，端口不定义 command：`doc/platform/terminal-coding-standard.md:434-468`。端口事件桥首个事件只播种、同值去重，只有跃迁才派发：`:470-472`。
  - 当前 transport module 明确 `commands: []`、`actors: []`，注释写明不拥有 command/actor：`apps/terminal/kernel/base/transport/src/application/createTransportModule.ts:5-17`。README 也写明它“不是命令路由 owner”：`apps/terminal/kernel/base/transport/README.md:5-7`。
  - V-T14 只测重连等待中的恢复、已有尝试时不重复、unavailable fallback；没有首事件播种、同值去重或 command/actor 路由断言：需求 `:596-600`。
- **影响**：实现可在订阅回调里直接启动 retry 而通过当前 V-T14，却违反 TR-11；或者派发 initial/current 状态引起一次多余重连，也仍能通过。现有 README 边界也会与新要求冲突。
- **最小修正（可验收）**：
  1. 明确 transport 消费网络端口并在 runtime module 中拥有 transport 机制 command/actor；订阅桥只播种、去重并 dispatch command，重连仅由 actor 处理。若选择另一个消费方包，须明确 command/actor 的 owning package 和依赖方向，且不得由端口或回调直接触发重连。
  2. V-T14 覆盖：首事件只播种；同值重复事件派发 0 个 command；只有 unavailable→available 跃迁且正在等待时派发 1 个 command 并立即尝试、重置节奏；尝试进行中不重复；无端口时按原节奏；所有 retry 均经 actor。
  3. README 更新为 transport 拥有传输机制 command/actor，但不拥有终端业务重连策略。
- **需要 Dexter 裁决**：否。D-26 已把机制交给 transport，TR-11 已规定事件通路；无需新增产品决定。

### S-4 · V-T8 的抽样 owner 不足以证明 R-9.6 的“其余 owner 全部清空”

- **位置**：R-9.6、V-T8、§8 第 13 条。
- **性质**：仓内事实 + 推论；状态：`CONFIRMED`。
- **证据**：
  - R-9.6 要求除 server-config 外的 owner 持久化全部清空：`doc/plans/platform/2026-09-25-v2s-terminal-activation-and-connection-requirements-claude.md:280-286`；§8 第 13 条要求 state 按 owner 声明保留范围并修 TR-09：`:728`。
  - V-T8 只要求“至少再装一个”真实持久化 owner，并读回“另装的那个” owner：需求 `:578-586`。
  - 当前至少有多个生产 owner 持久化形态：topology 的字段条目 `apps/terminal/kernel/base/topology/src/features/slices/topology.ts:75-80`；display-role `apps/terminal/kernel/base/display-context/src/features/slices/displayRole.ts:41-49`；runtime instance mode `apps/terminal/kernel/base/runtime/src/features/slices/runtimeInstanceMode.ts:30-38`；ui-state workspace records `apps/terminal/kernel/base/ui-state/src/foundations/workspaceSlices.ts:609-625` 与 dynamic variables `apps/terminal/kernel/base/ui-state/src/foundations/variableSlices.ts:132-140`。
  - state 当前 reset 枚举并删除 namespace keys，成功后才 root reset：`apps/terminal/kernel/base/state/src/foundations/persistenceEngine.ts:441-472`。D-16 新增 owner 保留范围后，必须证明未被保留的完整 owner 集合都仍被清除。
- **影响**：只抽测 topology 或 display-context 中的一个，不能排除另一个 owner 或另一种 persistence descriptor 被误列为保留；核心取消激活清理承诺会缺少可证伪的验收。
- **最小修正（可验收）**：V-T8 列出当前运行时实际装配的全部持久化 owner/descriptor 作为封闭分母，给每项非默认持久化值；重置并重启后逐项读回，只有 server-config 保留，其余全部回初始值/无持久化 key。分母至少覆盖当前不同 descriptor 形态及 storage kind，并纳入本批新增的 terminal identity、server-config；失败场景继续逐项确认 server-config 保留。若详设证明通用引擎性质可覆盖所有 owner，可用“descriptor 全集的保留声明检查 + 每种 descriptor/storage kind 的实际 reset 反例”替代逐 owner 重复场景，但不可继续用“至少一个 owner”代表全称要求。
- **需要 Dexter 裁决**：否。D-16 已选择只保留 server-config，本文 §10 已作同样写法；这是测试分母与证明强度问题。

## 3. 需要 Dexter 裁决的事项

**无新增产品/范围裁决。** D-1、D-4、D-11、D-16、D-20、D-25、D-26 已覆盖本轮相关产品取舍。

TDS 依赖图不是待 Dexter 拍板的问题，需求已授权详设比较。当前事实和推荐如下：

- `store-terminal` 目前依赖 organization、catalog、foundation、audit-model：`apps/backend/catering-business-server/modules/store-terminal/build.gradle.kts:5-9`；catalog 还依赖 asset：`apps/backend/catering-business-server/modules/catalog/build.gradle.kts:14-18`。
- TDS 仍是无 runtime/route/contract 的占位：`apps/backend/terminal-data-server/README.md:1-6`、`apps/backend/terminal-data-server/build.gradle.kts:1-5`。因此现在不能证明未来依赖无环。
- 我建议详设把“独立 binding owner + 窄判定 API”作为优先比较方案，并与“binding 放入 store-terminal”逐条比较。前者较可能满足 TDS 不装入 asset/object-storage 等无关配置；详设仍必须画出实际 COMMAND 依赖图，证明跨 owner 事务/终端读取和写入方向无环。TDS-own binding 与 D-1“绑定/凭证归业务后端、TDS 只做 WebSocket”不相容，不建议列为等价方案。
- 这是实现位置的技术选择，不需要新 Dexter 裁决；不把上述推荐当作已验证的依赖图。

## 4. 核过且成立的事实

### 4.1 R-12：大部分门清单准确，缺口集中在 S-1

已逐一核对 R-12 当前列项：

- 已准确列入：`code-layout`、`verify-gates`、ArchUnit、`platform-boundary-gates`、四个 face-sensitive generator、operation-count policy 与 registry、module-dependency registry；证据为目标需求 `doc/plans/platform/2026-09-25-v2s-terminal-activation-and-connection-requirements-claude.md:378-389`，以及 `tools/code-layout/cli.mjs:80,277`、`tools/verify-gates/cli.mjs:702`、`tools/platform-boundary-gates/cli.mjs:84`、`apps/backend/catering-business-server/src/test/java/architecture/BackendModuleBoundariesTest.java:54,156`、`scripts/policy/backend-performance-operation-counts.mjs:9,36-47`、`contracts/policy/backend-performance-operation-counts.json:9-12`、`tools/module-dependency-registry/check.mjs:18,94-105`。
- 第四 face 的 operation count policy 将未知字段拒绝，预算 registry 当前只有三面字段；R-12 已把 policy 与 registry 列为改写项。生成链包括 `edge-codegen`、`r5-edge-materialize`、`edge-operation-projections`、`operation-handler-bindings`，四者当前均有三面闭集。
- 不应因性能控制面其他部分已退役而漏改上述 run-level operation count policy；CLAUDE.md 明确 run-level budget verifier 仍生效：`CLAUDE.md:54-58`。

结论：R-12 的主要门和计数政策判断准确，但 S-1 的认证门及 generator context 闭包必须补齐。

### 4.2 绑定 owner 放置、TDS 依赖环：需求层正确延期，不可宣称当前已证明

§8 第 1 条要求比较 store-terminal 与独立 binding owner，并明确 TDS 最小装配集合、对象存储配置隔离和 COMMAND 依赖无环：`doc/plans/platform/2026-09-25-v2s-terminal-activation-and-connection-requirements-claude.md:691-696`。由于 TDS 没有 runtime 源码，当前不能从 repository 证明某一方案无环；这是详设必须交付的图与判据，而不是本轮需求 blocker。

### 4.3 TER：无限重试归 transport、网络端口形态可落地；TR-11 缺口见 S-3

- R-10.3 明确把无限重试机制放 transport、停止策略留给使用方，并给出 backoff、jitter、地址轮转及等待就绪时限：需求 `:314-325`。
- 该方向与 transport 负责帧/传输、由 topology/runtime 负责业务策略的现有边界相容；但 README 的 bounded retry 与 no-never-give-up 表述需按 R-10.3 改写，命令路由边界还需按 S-3 修订：`apps/terminal/kernel/base/transport/README.md:5-20`。
- 新 network port 可按现有 registry/default/unavailable/export 流程扩展：`apps/terminal/kernel/base/platform-ports/README.md:219-228`、`apps/terminal/kernel/base/platform-ports/src/types/platformPorts.ts:34-48`、`apps/terminal/kernel/base/platform-ports/src/defaults/createUnavailable.ts:1-12`。D-25 本期只做端口/default、不做真实 Android/Web adapter，需求有明确说明：`:326-330`、`:640-642`。
- D-16 的保留范围必然要求修订 TR-09 的例外正文；需求 §8 第 13 条已经要求修改，方向正确。未发现需改 TR-09 之外的其他 TR-09～TR-11 规则；TR-11 事件 bridge 缺口见 S-3。

### 4.4 §4 执行面与批次：当前有明确区分，动态能力尚待详设计实现

- 批次①只有设备类型不可修改、后台编辑抽屉和门店终端 L2 重准入；批次②包含业务主链路、TDS、TER 包、transport/state、network port 与 backend acceptance；批次③加入 Doris 与多节点：需求 `:50-61`。
- TER 行为明确限定 node tests，且不接入 UI/integration/application；这与 Dexter 原始需求“暂不做 UI 包，只做 node 测试”一致。node 测试不冒充 TR-16 的 Expo Web；后续接 UI 或上设备再按 TR-16：讨论稿 `:24-36`，需求 `:263-276`，规范 `doc/platform/terminal-coding-standard.md:655-682`。
- V-B7/V-S 等业务断言指定 backend-acceptance；V-E1/V-E2/V-E5 指定受管 DEV 双端脚本；V-T 测试为 node；V-U1 为 focused+L2：需求 `:400-407`、`:541-626`。没有发现把 node test 当 DEV 或把 batch③ Doris 判据提前到 batch② 的要求。
- 当前 `scripts/test/backend-acceptance` 只启动一个 `BackendAcceptanceTest`；测试类是单个 `@SpringBootTest(RANDOM_PORT)` 和一个 PostgreSQL/MinIO 容器：`scripts/test/backend-acceptance:75-79`、`apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/BackendAcceptanceTest.java:67-72,616-625,654-661`。所以两个业务实例 + TDS 当前不能原样执行，但 R-14 §8#14 已把实例方式、资源回收、故障注入及 run-level verifier 共存列为详设准入：需求 `:400-407`、`:729-742`。这是待详设定型，现有源码未证明不可能。
- 故障注入清单覆盖本需求明列的丢响应/迟到、认证竞态、握手延迟、时钟偏差、监听断开、PostgreSQL/Doris 故障、进程强杀、事件循环阻塞、内存上界和优雅关闭；R-14 要求逐项说明环境侧还是生产 test seam，并由 R-READ-10 声明 seam 覆盖边界：需求 `:729-742`、`doc/platform/backend-coding-standard.md:463-470`。V-T5/V-T7 已明确 client 可控 clock/random：需求 `:564-569`。其他 seam 不宜在需求层预定；详设要逐项选可复现的最小手段。未发现这份清单缺少当前条款引用的故障种类。

### 4.5 门店终端交叉引用：D-36 与新批次边界匹配，旧 IA/UI 是待同步事实

- 门店终端需求 R-1.4、V-1、V-16 与 §6.3 第 2、5 条都已明确标注被新裁决取代：`doc/plans/platform/2026-09-23-v2s-store-terminal-management-requirements-claude.md:333,442-445,573,588,661`。
- 新需求 R-8.4 将创建后设备类型不可修改归到批次①；V-B12 把未激活部分留批次①、已激活回归放批次②；V-U1 与 §8 第12条安排编辑抽屉只读和既有 L2 更新：新需求 `:258-261`、`:467`、`:622-626`、`:720-727`。
- 既有 IA/UI 工件仍有“设备类型可改”的旧文本：`doc/plans/platform/2026-09-23-v2s-store-terminal-management-ia-codex.md:76-77`、`doc/plans/platform/2026-09-23-v2s-store-terminal-management-ui-interaction-design-codex.md:256-257,279`。新需求 §13.5 明确要求在本需求批次①修订 IA 与交互工件后再写详设：新需求 `:1195-1201`。因此这是已声明的批次①同步工作，不是把修改转回门店终端当前批次；本轮没有改这些文件。

## 5. 方案合理性

总体方案没有显示过度设计，符合 Dexter 原始目标与已裁决方向：

- 原始目标明确是 A/B/C 打通，设备凭激活码激活、建立 WebSocket、心跳/重连、取消激活；同一原始需求明确“暂不做 UI，只做 node 测试”且本期必须用真实双端脚本联动：讨论稿 `:20-36`、`:311-328`。因此不把 node client 接入 UI/application 不构成本期目标偏离。
- 把 HTTP 激活与取消激活留在已有业务后端、TDS 只负责 WebSocket，复用已有授权/审计/幂等/HTTP acceptance 能力，比在 WebFlux/TDS 重造后台面更直接，符合 D-1：需求 `:63-69`；讨论稿 `:295-343`。
- 无限重连由 transport 提供机制，调用方决定停止；指数/线性退避、随机量和网络恢复端口降低同步重试风险，且 D-25 把真实 Android/Web 网络 adapter 延后，避免本期为端口引入平台实现。已接受的代价是默认/unavailable port 下实际设备可能等到下一次重试，最长 5 分钟；需求 §6 第19条已说明：`:326-330`、`:672`。
- 不引入 MQ、通用 outbox 或常态轮询；TDS 与 PostgreSQL 单 Flyway history；Doris/多节点延到有可行性证据后。整体批次和当前 KISS/维护边界相称。
- 真实风险主要落在 S-1～S-4 及下一阶段详设：模块依赖、异步故障语义、多个服务进程和测试资源。需求已明确将验收 harness/故障注入列入详设，而不是在当前源码不存在时假称可行。

## 6. 模板逐节覆盖（DESIGN 必填）

被审对象是需求文档内嵌的 Journey 裁决要素，不是 IA、交互工件或 implementation-facing 详设。§13 已标明对照 Journey 模板，且因写入边界将其内嵌；§13.5 又明确 UI 工件要在批次①更新：`doc/plans/platform/2026-09-25-v2s-terminal-activation-and-connection-requirements-claude.md:1126-1208`。

| 模板 | 逐节对照 | 判定 |
|---|---|---|
| Journey decision | §1 元数据、§2 用户任务/结果、§3 actor 前提链、§4 范围/非目标/禁推、§5 corpus 命中、§6 UI 适用性/后续工件、§6.1 管理后台交互要求、§7 Dexter 裁决均可在需求 §13.1–§13.6 找到 | 有 |
| IA design | §1；§2、§2.1、§2.2、§2.1.1；§3–§6 | 本文非 IA 工件，阶段性 NOT_APPLICABLE；UI-bearing 的 IA 更新已列入批次① |
| UI interaction design | §1、§1.1、§1.2、§1.2.1；§2–§10；Screen、L2/testId roster、表单依赖/字段矩阵、搜索协议、状态与边界、逐操作合理性、Face/owner 矩阵、Manifest 对照、demo/看图结论 | 本文非交互工件，阶段性 NOT_APPLICABLE；批次①须更新既有 IA/交互工件并按 §6.1 使用前端规范 |
| implementation-facing design | §0–§3、§3a、§4–§9、§9a–§9b、§10、§10b.1–§10b.6、§11–§14、§13b–§13c | 本文不是详设，且 `DESIGN_AUTHORIZATION=无`：需求 `:3-8`；均为阶段性 NOT_APPLICABLE |

未发现需求文档冒充已完成 IA、交互或实现详设；阶段性 N/A 不表示后续豁免这些模板。

## 7. 没能核的项目

1. 没有运行任何测试、构建或环境。特别是两个业务实例 + TDS 的 harness、真实 WebSocket、DEV、故障注入、cleanup 和预算 verifier 共存都没有动态证据。
2. TDS 当前只有 placeholder README/build.gradle，无法核 binding owner 的最终依赖图、启动配置或 COMMAND 环；需详设提供图和可验证边界。
3. 当前 UI/IA 文件仍保留可编辑设备类型的旧形态；本需求承诺在批次①同步，实际改动与 L2 结果未在本轮验证。
4. `LISTEN/NOTIFY` 队列写满导致通知事务提交失败在需求 §8 第6条标为 `UNVERIFIED`，本轮未查外部权威资料：`doc/plans/platform/2026-09-25-v2s-terminal-activation-and-connection-requirements-claude.md:703-707`。
5. 项目 memory 自动路由健康检查曾因治理文档的字面 heading anchor 与当前 heading 不一致返回 `PROJECT_MEMORY=FAIL`；我手动复读了本轮相关 active memory 原文，特别是 `project-memory/decisions/terminal-build-order-and-batches.md`，但不能把自动路由状态写成 PASS。该健康问题不属于需求 finding。
6. 其他平台 adapter 真实实现、后续 UI/API 页面与设备侧操作入口不在本需求范围；按 Dexter 原始需求本期 node-only，不据此要求启动 TR-16 动态验证。

## 8. 最终处置建议

先修 S-1～S-4 对应的需求判据/R-12 supersede 清单，再进入三批详设。除此之外，本轮没有要求重做已裁决的产品选择，也没有把后续 batch①门店终端同步工作移回原门店终端批次。
