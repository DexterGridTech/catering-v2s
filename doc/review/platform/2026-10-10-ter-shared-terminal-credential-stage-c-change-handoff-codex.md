# TER 阶段 C 主副机共享终端凭证变更交接

REVIEW_TARGET=DESIGN_CHANGE_HANDOFF
SOURCE_REVIEW_CYCLE=TER_SHARED_TERMINAL_CREDENTIAL_CHANGE_2026-10-10
SOURCE_REVIEW_ROUNDS=2/2

## 背景

Dexter 指出阶段 C 当前“副机向主机取 grant、由主机代副机请求 CBS”的设计过度复杂。产品意图是：副机是主机所代表终端的一部分，主机激活取得 terminal credential 后，通过已配对状态同步把 credential state 同步给副机；两端行为均代表同一个 terminal，但来自不同物理设备。凭证不加密。副机后续应能用同步到的凭证直接向 CBS 发业务请求，不应逐次向主机领取 grant。

本文档是本次需求变更说明稿，经内部两轮独立静态对抗复核后的交接输入。正式需求正本和阶段 C 设计/计划尚未因本交接自动改变；不得将作者文稿或内部复核误称为已接受的正式正本或实现证据。

## 评审目标

请依据下列提案修订阶段 C 详设与实施计划，保持现有 owner 边界和最小实现：由 TDC 持有并管理同一 credential；仅将 credential 字段通过已配对的 MASTER→SLAVE state-sync 投影；副机本地持久化该相同凭证值，并由自身 TDC command/网络配置直接调用 CBS。删除 MASTER→SLAVE 逐次 grant 中转链路。不得将 CBS 为 artifact 下载签发的现有短期 download grant 与 MASTER 中转 grant 混为一谈。

请在 D/P 中逐项修订：凭证 owner/同步范围/持久化；主副端 TDC command 和 selector 权限；CBS operation 全集及真实请求链；取消激活、新 generation、解绑与重连后的同步闭包；测试和 CP/验收映射；原 MASTER-only gate 与 peer grant 相关条款。只变更 D/P，不实施源码或运行验收。若 formal requirement 需要同步，给出准确条文提案与差异，等待需求正本的正式维护流程，不把 D/P 与正本的不一致藏起来。

## 需阅读文件

- `doc/plans/platform/2026-10-10-ter-shared-terminal-credential-requirements-change-proposal-codex.md`：本次 Dexter 产品输入与建议的完整说明稿。
- `doc/plans/platform/2026-10-05-ter-version-and-js-apk-update-formal-requirements-claude.md`：现行 R-07/R-08、R-15 与阶段边界；当前与本次输入存在的语义差异。
- `doc/plans/platform/2026-10-09-ter-version-update-stage-c-implementation-design-claude.md`：阶段 C 详设，含当前 credential/grant 方案、owner 与验收判据。
- `doc/plans/platform/2026-10-09-ter-version-update-stage-c-implementation-plan-claude.md`：CP 顺序、动态验证与交付映射。
- `doc/decisions/2026-10-09-ter-update-automatic-execution-and-pair-journey-claude.md`、`doc/decisions/2026-10-09-ter-update-automatic-execution-and-pair-ia-claude.md`：配对拓扑、两端职责和页面边界。
- `apps/terminal/kernel/base/terminal-data-client/src/types/client.ts`、`apps/terminal/kernel/base/terminal-data-client/src/features/slices/terminalDataClient.ts`、`apps/terminal/kernel/base/terminal-data-client/src/features/actors/terminalDataClientActor.ts`：credential 类型、slice persistence/sync/protection 及 CBS command gate。
- `apps/terminal/kernel/base/terminal-data-client/src/features/slices/terminalClientStatusProjection.ts`、`apps/terminal/kernel/base/topology/src/application/createTopologyStateSyncController.ts`、`apps/terminal/kernel/base/topology/src/application/createTopologyModule.ts`：现有有限投影机制及其可复用边界。
- `apps/terminal/kernel/base/terminal-data-client/src/generated/terminalApi.ts`：当前 CBS terminal operation catalog。
- `apps/backend/catering-business-server/modules/terminal-binding/src/main/java/com/catering/v2s/terminalbinding/api/TerminalCredentialVerificationApi.java`、`apps/backend/catering-business-server/modules/terminal-binding/src/main/java/com/catering/v2s/terminalbinding/application/TerminalCredentialDecision.java`：CBS 认证字段及绑定 deviceId 判定。
- `apps/terminal/adapter/android/persist-kv/android/src/main/java/com/catering/v2s/terminal/adapter/android/persistkv/TerminalPersistKvModule.kt`：Android plain/protected persistence 实际映射。
- `doc/platform/terminal-coding-standard.md`：TER owner、command/selector、持久化与拓扑约束。
- `doc/review/platform/2026-10-10-ter-shared-terminal-credential-change-review-r1-codex.md`、`doc/review/platform/2026-10-10-ter-shared-terminal-credential-change-review-r2-codex.md`、`doc/review/platform/2026-10-10-ter-shared-terminal-credential-change-intake-r1-codex.md`：内部两轮审查记录和主 agent disposition；供追溯，不替代本次独立判断。

## 独立核验重点

1. 从 Dexter 原话独立判断“凭证不得加密”是否涵盖 credential 的本地持久化与配对 payload；区分“不加密”与现行日志脱敏要求。不要增设访问控制或加密 envelope。
2. 确认只同步 TDC credential state，不把连接、心跳、topic subscription、pending activation、各设备更新任务/实际版本或报告队列一并复制。
3. 核验主机激活仍是 bootstrap，副机在有凭证后可直连 CBS。把 TDC terminal-authenticated CBS command catalog 逐项分类；提案列出九个 `terminalRead*` 和 `issueTerminalUpdateArtifactDownloadGrant` 为两端可用，`activateTerminal` 为 MASTER bootstrap，`submitTerminalUpdateReport` 按现行 R-15 保持 MASTER-only。请对照 owner 与用户所说“副机行为代表同一个 terminal”，明确 `cancelTerminalActivation` 是否两端可发起及取消后的双端 state 结果；不要默默留给实现者猜。
4. 明确 CBS credential 中的绑定 `deviceId` 继续使用 master 激活时的绑定身份；副机物理 device/runtime identity 仍本地独立。不要把副机物理 deviceId 替换认证字段、创建第二 binding 或声称 CBS 可据此识别物理来源。
5. 逐条区分：删除 MASTER→SLAVE peer grant relay；保留副机直接调用 CBS 的 `issueTerminalUpdateArtifactDownloadGrant`（若当前接口要求）及之后工件下载授权。保持不涉及副机 TDS 连接、TDS session、跨节点业务协议或阶段外功能。
6. 同步 D/P 的正常、拒绝、重连、取消激活、旧 generation 与凭证清理判据；CP、三维对账及测试映射不得环回或将静态文案写成运行 PASS。
7. 独立检查正式需求 R-08 与本次 Dexter 输入的差异。当前提案说明 R-07/R-08 需要由正本维护者后续同步；请明确 D/P 修订与正式需求待同步项，勿自行将未接受提案宣称为正本已改。

## 期望结论

请对修订后的阶段 C 详设/计划给出 `GO` 或 `NO-GO` 与 `M/S/N`，区分已证实设计、文档提案和 `NOT_RUN` 实现/动态验证。每项 finding 提供准确路径与行号、影响、最小修复及是否需要 Dexter 产品裁决。此次任务只要求设计文档变更，不要求实现，也不要求动态 evidence。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请根据 Dexter 的主副机共享终端凭证裁决，修订《TER 版本定义、完整更新与热更新》阶段 C 的详设与实施计划。

背景：阶段 C 当前设计让副机通过主机逐次取得 grant；Dexter 明确表示副机是主机所代表终端的一部分，主机激活取得凭证后，应通过配对把凭证 state 同步给副机；副机所有行为代表同一个 terminal、但来自不同 device；凭证不得加密，副机应能拿该凭证直接向 CBS 发业务请求，不能每次都依赖主机 grant。本需求变更说明稿已完成两轮独立静态对抗复核，R1 的 R-13/R-15 编号误引已修正。该稿是本次产品输入，不是已同步的正式需求正本。

目标：请仅修订阶段 C 详设与实施计划，使 TDC 仍是唯一凭证 owner，MASTER 是激活 bootstrap 与凭证权威来源，通过既有同 App 配对 state-sync 只同步 credential 字段；SLAVE 收到并持久化同一明文 credential 后，使用自己的 TDC command 和网络配置直接请求 CBS。删除 MASTER→SLAVE 的逐次 grant 中转。CBS 对 artifact 下载所签发的短期 download grant 与 MASTER 中转 grant 是不同机制：不得因为删除后者就删掉仍需要的前者。

请从 catering-v2s 仓库根阅读：
- doc/plans/platform/2026-10-10-ter-shared-terminal-credential-requirements-change-proposal-codex.md：本次产品输入及具体建议；
- doc/plans/platform/2026-10-05-ter-version-and-js-apk-update-formal-requirements-claude.md：现行需求和 R-15 主机版本报告边界；
- doc/plans/platform/2026-10-09-ter-version-update-stage-c-implementation-design-claude.md：当前阶段 C 详设；
- doc/plans/platform/2026-10-09-ter-version-update-stage-c-implementation-plan-claude.md：CP、验收与交付顺序；
- doc/decisions/2026-10-09-ter-update-automatic-execution-and-pair-journey-claude.md 与 doc/decisions/2026-10-09-ter-update-automatic-execution-and-pair-ia-claude.md：配对及两端职责；
- apps/terminal/kernel/base/terminal-data-client/src/types/client.ts、apps/terminal/kernel/base/terminal-data-client/src/features/slices/terminalDataClient.ts、apps/terminal/kernel/base/terminal-data-client/src/features/actors/terminalDataClientActor.ts：复核 credential owner、slice 与 command gate；
- apps/terminal/kernel/base/terminal-data-client/src/features/slices/terminalClientStatusProjection.ts、apps/terminal/kernel/base/topology/src/application/createTopologyStateSyncController.ts、apps/terminal/kernel/base/topology/src/application/createTopologyModule.ts：复核现有 state-sync 接线；
- apps/terminal/kernel/base/terminal-data-client/src/generated/terminalApi.ts、apps/backend/catering-business-server/modules/terminal-binding/src/main/java/com/catering/v2s/terminalbinding/api/TerminalCredentialVerificationApi.java、apps/backend/catering-business-server/modules/terminal-binding/src/main/java/com/catering/v2s/terminalbinding/application/TerminalCredentialDecision.java：复核 operation catalog、认证字段与 binding deviceId 判定；
- apps/terminal/adapter/android/persist-kv/android/src/main/java/com/catering/v2s/terminal/adapter/android/persistkv/TerminalPersistKvModule.kt：复核 plain/protected 持久化行为；
- doc/review/platform/2026-10-10-ter-shared-terminal-credential-change-review-r1-codex.md、doc/review/platform/2026-10-10-ter-shared-terminal-credential-change-review-r2-codex.md、doc/review/platform/2026-10-10-ter-shared-terminal-credential-change-intake-r1-codex.md：内部复核与处置记录。

请重点独立核验：凭证同步只投影 credential、不复制 TDC 全 slice；“不加密”同时适用于配对 payload 和 TDC 本地凭证持久化，但不等于放弃现有日志脱敏；副机请求使用 credential 内 master binding deviceId，不能替换为副机物理 deviceId；逐项列清 terminal-authenticated CBS commands 的 caller，尤其明确 cancelTerminalActivation 的副机行为及解绑结果；activateTerminal 仍为 MASTER bootstrap；submitTerminalUpdateReport 仍按 R-15 主机-only，除非明确提出产品变更；副机不因此获得 TDS 连接；如需同步正式需求 R-07/R-08，请列出确切文本差异和正本维护动作，不把当前提案写成已接受需求。

请给出修订后设计包的明确 GO 或 NO-GO 与 M/S/N。Finding 请列精确文件/行号、事实与推论、影响、最小修复及是否需 Dexter 裁决。区分设计文档、未同步正本项和实现/动态 NOT_RUN。

授权边界：本次只要求修订阶段 C 详设与实施计划及必要的直接设计映射；不授权源码/测试实施、生成、编译、构建、测试、verify、DEV、reset/seed、L2、UAT、部署或阶段外功能。正式需求正本不得因本稿被默认为已修改或已接受。谢谢。
```

