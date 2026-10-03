# 终端激活交互与双机拓扑优化专项 · 当前字节 Claude 复评请求

## 背景

Claude 外部静态设计评审对其当时绑定的六份输入作出 `NO-GO`，`M/S/N=0/6/1`，见 `doc/review/platform/2026-10-03-ter-terminal-activation-interaction-pair-topology-design-review-claude.md`。Codex 主 agent 已按 finding intake 规则重开原需求、设计和 owning source；六项 S 与 N-1 均独立核验为 `CONFIRMED`，按最小范围修订了 Journey、IA、交互工件、详设与计划，处置见 `doc/review/platform/2026-10-03-ter-terminal-activation-interaction-pair-topology-design-review-intake-codex.md`。

这是对当前修订字节的 Dexter 转交外部静态复评，不重开已关闭的内部 DESIGN cycle，也不冒充第三轮内部审查。来源评审的原始 verdict 和旧哈希保留；它们绑定旧字节，不是当前字节的 verdict。当前复评必须先独立读原需求、真实 owning source 与适用规范，再阅读 intake 和历史评审。

两个本轮直接产品答复已成为设计输入：

1. 已激活时仅显示“设备已激活成功”，不加按钮或计时；integration 随后按当前 selector 让业务包接管路由。
2. 激活后即使管理员切换服务空间，取消激活请求始终使用当前选中的服务空间；若该空间拒绝旧凭证，保留凭证并显示 owner 拒绝，不静默切回旧空间。

当前待评设计包 SHA-256（供复评绑定；请独立复算）：

| 文件 | 当前 SHA-256 |
| --- | --- |
| `doc/decisions/2026-10-02-ter-terminal-activation-interaction-pair-topology-journey-codex.md` | `ac08eb35322d6834cbe41e6dfaeb7893609561507dc60854e98a6f4ca1b9f098` |
| `doc/decisions/2026-10-02-ter-terminal-activation-interaction-pair-topology-ia-codex.md` | `d3f3ff4c3244e2e8849fa25b6b8baae8c7ccd6d4f97655f1f5f56cb4f2fdca11` |
| `doc/decisions/2026-10-02-ter-terminal-activation-interaction-pair-topology-ui-interaction-codex.md` | `50fcc8046349e183310be3d2121cef87cbc8720b5262997ec802b32db6b4446f` |
| `doc/plans/platform/2026-10-02-ter-terminal-activation-interaction-pair-topology-implementation-design-codex.md` | `a1554cd50626163774f5009e488e43144b60abddce09b2ba331160ecdf6a09a1` |
| `doc/plans/platform/2026-10-02-ter-terminal-activation-interaction-pair-topology-implementation-plan-codex.md` | `2a12d8a0180ea5be76d9e5c263a0f471bdb162e28140b979eab35d6ec2ddc79f` |

正式需求、讨论稿和来源评审在本轮未改。它们的评审输入身份见历史来源评审 §1；历史哈希不应被改写成上述当前字节的身份。

## 评审目标

请对当前完整设计包作独立、证伪式静态复评：确认修订是否真正闭合原六项 S 和 N-1，是否在 Journey、IA、线框、详设、计划及需求之间一致，是否存在最小修正之外的新矛盾、漏项、越界或实施不可执行点。不要把作者 intake 的 `CONFIRMED` 或结构计数当成评审结论，也不要沿用来源评审对旧 SHA 的 verdict。

## 需阅读文件

- `AGENTS.md`、`CLAUDE.md`：授权、审查与协作边界。
- `doc/platform/review-standard.md`、`doc/platform/terminal-coding-standard.md`：设计与 TER 行为适用规范。
- `project-memory/operations/claude-review-finding-intake.md`：Claude finding 由主 agent 核验的职责边界；本文档只供理解已完成 intake，不代替独立复评。
- `doc/plans/platform/2026-10-02-ter-terminal-activation-interaction-and-pair-topology-formal-requirements-codex.md`：正式需求与 R/V 判据。
- `doc/plans/platform/2026-10-02-ter-terminal-activation-interaction-and-pair-topology-requirements-discussion-claude.md`：Dexter 原话与裁决，尤其 §9。
- `doc/review/platform/2026-10-03-ter-terminal-activation-interaction-pair-topology-design-review-claude.md`：此前评审及旧输入哈希；不得把旧 verdict 外推到新字节。
- `doc/review/platform/2026-10-03-ter-terminal-activation-interaction-pair-topology-design-review-intake-codex.md`：Codex 的 finding classification、证据及处置，仅作待核材料。
- `doc/decisions/2026-10-02-ter-terminal-activation-interaction-pair-topology-journey-codex.md`：当前 Journey。
- `doc/decisions/2026-10-02-ter-terminal-activation-interaction-pair-topology-ia-codex.md`：当前 IA。
- `doc/decisions/2026-10-02-ter-terminal-activation-interaction-pair-topology-ui-interaction-codex.md`：当前线框、逐屏字段与控件工件。
- `doc/plans/platform/2026-10-02-ter-terminal-activation-interaction-pair-topology-implementation-design-codex.md`：当前详设与 V-01～V-20 映射。
- `doc/plans/platform/2026-10-02-ter-terminal-activation-interaction-pair-topology-implementation-plan-codex.md`：当前 CP 实施和验证计划。
- `apps/terminal/ui/feature/sample-wallpaper-picker/src/components/laptop/WallpaperPicker.tsx`、`apps/terminal/ui/feature/sample-wallpaper-picker/src/foundations/wallpaperPickerTestIds.ts`、`apps/terminal/kernel/feature/sample-staff-session/src/features/commands/commands.ts`：壁纸页与既有登出 command。
- `apps/terminal/kernel/feature/sample-member-registry/src/features/slices/slice.ts`、`apps/terminal/ui/feature/sample-member-desk/src/hooks/useCustomerMember.ts`：会员事实投影与确认入口。
- `apps/terminal/kernel/base/terminal-data-client/src/features/actors/terminalDataClientActor.ts`、`apps/terminal/kernel/base/transport/src/foundations/resolveTransportServerAddresses.ts`、`apps/terminal/kernel/base/server-config/src/types/serverConfig.ts`、`apps/terminal/kernel/base/server-config/src/features/actors/serverConfigActor.ts`、`contracts/policy/terminal-client-generation.json`：当前 route、owner、地址与配置行为。
- `doc/decisions/templates/ui-interaction-design-template.md`：逐屏 mutation 字段矩阵要求。

## 独立核验重点

1. **S-1**：MMP/LMP 壁纸页是否有实际 staff logout 动作、准确 testId、调用既有 `logoutCommand`、owner readback/失败路径；退出选择是否仍是独立导航；LSP 是否仍无 logout。
2. **S-2**：单机 LMS `MASTER+SECONDARY` 与双机 LMS `SLAVE+VICE` 是否清楚区分；host pending projection 是否足以显示与确认；回 MASTER owner 的 `target=peer`、operationId 和拒绝路径是否完整；projection 是否绝不覆盖 branch-local pending。
3. **S-3**：四个 ACT screen 是否只在显式请求且当前已激活时显示规定成功文案；是否无按钮/计时；持续业务 selector 路由与断链/未就绪遮罩优先级是否无歧义。用户明确接受 integration 将业务路由接管，因此不应再要求 CTA 或延时。
4. **S-4**：canonical full route → terminal-only suffix generation policy → generated 参数/query → client command → composition 注入 server-config provider → transport adapter 拼到当前 `addresses[].baseUrl` 的职责是否闭合；普通后台及其他 consumer 路由是否保持完整；client 是否完全不读配置/解析集团编码；groupWorkspaceKey/storeRef/generation 是否仅来自成功响应、取消路径terminalRef是否仅由client credential内部填入。特别核验 Dexter 已选择“取消激活始终使用当前选中的服务空间”，并核对拒绝后的凭证保留行为。
5. **S-5/S-6**：validation refusal、effective memory update、persistence failure 和 projection sync failure 的可观察结果是否互不混淆；是否没有默认 rollback；ADMIN-02 是否只有每个地址的 `addressName/baseUrl/timeoutMs`，没有第二份独立 prefix 输入。
6. **N-1**：逐屏 mutation 表是否符合八列模板，输入 dependency/command 分母/testId 是否与 screen roster 一致，LSP 壁纸 ID 是否为 branch namespace，20 行场景表的 business oracle 与 cleanup 是否分列。
7. 横跨设计包逐条核对需求 R-01～R-16 与 V-01～V-20、三包职责、四面/实例、代理秘密、LSP 独立页、sample 流程和 TR-16 Web→VM 顺序；只接受能指到当前字节的结论。需要 Dexter 决定的产品歧义请具体指出，不得替 Dexter改写需求。

## 期望结论

请给明确的 `GO` 或 `NO-GO` 与 `M/S/N` 数量。每条 finding 写当前仓根相对路径与精确章节/行号、classification 或可核事实、反例/边界、影响、最小可验收修正、是否需要 Dexter 产品裁决。若维持 GO，应说明七项的证据为何闭合；若有未验证项，按实际证据层级保留 `NOT_RUN`，不能从设计或旧运行推 PASS。

## 可直接复制给 Claude 的话术

```text
您好 Claude，请对《终端激活交互与双机拓扑优化专项》当前修订设计包做一轮独立静态复评。

背景：你此前的外部静态设计评审为 NO-GO，M/S/N=0/6/1，见 `doc/review/platform/2026-10-03-ter-terminal-activation-interaction-pair-topology-design-review-claude.md`。Codex 主 agent 已按 finding intake 规则逐条重开需求、规范和 owning source，将六项 S 与 N-1 均确认并作最小文档修订，记录在 `doc/review/platform/2026-10-03-ter-terminal-activation-interaction-pair-topology-design-review-intake-codex.md`。本请求是当前字节的 Dexter 转交外部复评；不重开已关闭的内部 DESIGN cycle，也不构成第三轮内部审查。请独立判断，不继承旧 verdict 或作者的 classification。

目标：独立复核当前完整设计包，证伪或确认 S-1～S-6、N-1 已闭合，并检查修订后的需求一致性、owner边界、可执行性和证据限制。

Dexter 本轮直接确认两条设计输入：已激活时仅显示“设备已激活成功”，不加按钮/计时，由 integration 随后把路由交给业务包；取消激活一律使用当前选中的服务空间，若服务端拒绝旧凭证则保留凭证、显示 owner 拒绝，不静默切回原空间。

请从 catering-v2s 仓根阅读正式需求、讨论稿 §9、适用规范、来源评审与当前 finding intake，并独立重开当前 owning source。复评文档如下：
- Journey：`doc/decisions/2026-10-02-ter-terminal-activation-interaction-pair-topology-journey-codex.md`
- IA：`doc/decisions/2026-10-02-ter-terminal-activation-interaction-pair-topology-ia-codex.md`
- 交互线框：`doc/decisions/2026-10-02-ter-terminal-activation-interaction-pair-topology-ui-interaction-codex.md`
- 详设：`doc/plans/platform/2026-10-02-ter-terminal-activation-interaction-pair-topology-implementation-design-codex.md`
- 实施计划：`doc/plans/platform/2026-10-02-ter-terminal-activation-interaction-pair-topology-implementation-plan-codex.md`
- 逐项来源、旧哈希边界和作者处置：`doc/review/platform/2026-10-03-ter-terminal-activation-interaction-pair-topology-design-review-intake-codex.md`

请重点复核 S-1 壁纸 MMP/LMP staff logout 与 LSP 无 logout；S-2 单机与 SLAVE+VICE 双机 LMS 的 host pending projection、确认回 MASTER 和 branchPending 隔离；S-3 四个 ACT 的显式 active-success、integration 路由及断链遮罩优先级；S-4 canonical→terminal suffix generation→client 参数→composition provider→transport adapter 前缀消费及凭证身份来源；S-5 配置拒绝/内存生效/持久化失败/同步失败分支；S-6 ADMIN-02 每个地址唯一 baseUrl prefix；N-1 所有逐屏矩阵、command/testId 分母和验收表列。

请从实际需求和源码寻找反例，检查同根条款及 Journey、IA、线框、详设、计划是否一致。请给出 `GO` 或 `NO-GO` 与 `M/S/N`；每项问题须附当前文件及精确位置、事实/反例、影响、最小可验收修正和是否需 Dexter 裁决。不要将作者 intake 当作独立 verdict。

证据边界：本轮只有静态文档修订与结构核对。专项源码、UI、V-01～V-20、Expo Web、VM/device、adapter、业务行为及 cleanup 均未运行（NOT_RUN）；不把旧字节评审或历史运行推成当前 PASS。

授权边界：本次只请做静态设计复评，不授权改需求/Journey产品语义、源码、测试、依赖、生成、构建、测试运行、verify、DEV、reset/seed、L2、UAT 或部署。若发现产品/Journey歧义，请只列具体问题与候选方案交Dexter裁决。谢谢。
```
