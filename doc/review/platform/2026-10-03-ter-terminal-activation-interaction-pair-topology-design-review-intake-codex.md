# 终端激活交互与双机拓扑优化专项 · Claude finding intake

```text
REVIEW_ORIGIN=DEXTER_RELAYED_EXTERNAL_REVIEW
SOURCE_REVIEW=doc/review/platform/2026-10-03-ter-terminal-activation-interaction-pair-topology-design-review-claude.md
SOURCE_VERDICT=NO-GO；M/S/N=0/6/1（只绑定来源评审 §1 所列旧字节）
INTAKE_OWNER=CODEX_MAIN_AGENT
INTAKE_VERDICT=不替代独立复评；当前设计包待 Dexter/Claude 复评
EVIDENCE_TIER=静态文档与 owning source 核验；无动态验证
```

## 1 · Intake 边界与方法

Claude 的 finding 是待核验输入，不自动成为事实、severity 或修复授权。本 intake 由主 agent 逐项重开正式需求、被审设计、实际 owning source 与适用规范，主动找反例和更小方案后形成。S/N 编号沿用来源评审，便于追踪；本文件不是新的独立 verdict，也不重开已关闭的内部 DESIGN cycle。严重度仍由 Dexter 决定。

来源评审的六份输入哈希及其旧字节 verdict 保留在 `doc/review/platform/2026-10-03-ter-terminal-activation-interaction-pair-topology-design-review-claude.md:24-31`，该历史文件未修改。下文“修订后设计”指 Journey、IA、交互工件、详设和计划的当前字节；它们尚未获独立复评。正式需求和需求讨论未修改。

## 2 · Findings intake 与处置

### S-1 · 主机壁纸页必须有独立店员登出

- **Classification：CONFIRMED**。
- **原 finding 与判据**：来源评审 §2 S-1。正式需求 `doc/plans/platform/2026-10-02-ter-terminal-activation-interaction-and-pair-topology-formal-requirements-codex.md:214-222` 规定 MMP/LMP 主端工作台可登出、LSP 不提供登出；需求讨论 §9 用户原话在 `doc/plans/platform/2026-10-02-ter-terminal-activation-interaction-and-pair-topology-requirements-discussion-claude.md:531-532`。
- **重新核验的事实与反例**：当前壁纸组件 `apps/terminal/ui/feature/sample-wallpaper-picker/src/components/laptop/WallpaperPicker.tsx:19-67` 仅选择/确认壁纸，`apps/terminal/ui/feature/sample-wallpaper-picker/src/foundations/wallpaperPickerTestIds.ts:3-12` 无登出动作。既有 `logoutCommand` 已公开于 `apps/terminal/kernel/feature/sample-staff-session/src/features/commands/commands.ts:17-20`。因此“退出选择”作为页面导航不是登出；反例是 LSP 规范上明确不提供 logout，不能把按钮加到它的独立页面。
- **影响**：若只保留退出选择，MMP/LMP 壁纸阶段无法结束店员 session，违反批准流程。
- **最小修正及更小替代**：修订后的 Journey §3.6、交互工件 SAMPLE-07-MMP/SAMPLE-08-LMP、详设屏幕/command 映射和计划 CP-05 明确各有真实登出按钮、testId、复用 `logoutCommand`、selector 确认成功和失败留在当前 session/page；LMP 的退出选择仍是单独导航。LSP 不加 logout。更小的“只加导航或复用退出按钮”无法改变 staff owner 状态，故不满足需求。
- **Dexter 裁决**：不需要新裁决；不新增“结束业务页”产品行为。
- **当前状态**：文档已修订，未实施、未运行。

### S-2 · 双机 LMS 的 host pending 投影与确认回传

- **Classification：CONFIRMED**。
- **原 finding 与判据**：来源评审 §2 S-2。需求 R-09a `...formal-requirements-codex.md:224-234` 要求 LMP 有 LMS 时由 LMS 确认，且两端 pending 独立；规范 `doc/platform/terminal-coding-standard.md:951-966` 区分单机 LMS `MASTER+SECONDARY` 与双机 LMS `SLAVE+VICE`。
- **重新核验的事实与反例**：当前 slice `apps/terminal/kernel/feature/sample-member-registry/src/features/slices/slice.ts:33-54` 将整个 `MemberState` 放进 master-to-slave 同步；当前 LMS 消费 `selectPendingMember` 并 dispatch 决策的路径见 `apps/terminal/ui/feature/sample-member-desk/src/hooks/useCustomerMember.ts:25-74`。单机 LMS 可直接共享 MASTER runtime，是不能误扩到双机的反例；双机 LMS 的 VICE 屏幕需收到具 operation identity 的主机待确认项，且不得覆盖 SLAVE 自己的 branch pending。
- **影响**：仅同步 confirmed list 时，双机 LMS 无法显示和决定待确认记录；整状态投影又可能覆盖本地 pending。
- **最小修正及更小替代**：修订后的 Journey/IA、详设 §7 与计划 CP-04/05 区分两种 LMS 承载：单机 `MASTER+SECONDARY` 本地读 host pending；双机由 `SLAVE+VICE` 读取绑定当前 peer 的 `hostPendingProjection`（含 operationId），确认/拒绝显式 `target=peer` 回到 MASTER owner；投影更新 members 与 host projection 时保留 `branchPending`。只增加所需投影边界，不新建同步/仲裁框架。仅改页面文案或继续只同步 confirmed list 均无法满足 VICE 的业务确认。
- **Dexter 裁决**：不需要；按已批准双机内容与确认位置执行。
- **当前状态**：文档已修订，未实施、未运行。

### S-3 · 四面显式激活交互的已激活状态与路由

- **Classification：CONFIRMED**。
- **原 finding 与判据**：来源评审 §2 S-3。正式需求 R-03 `...formal-requirements-codex.md:106-119` 规定显式请求且已激活时四面显示“设备已激活成功”。
- **重新核验的事实与反例**：来源评审指出旧 Journey/IA/交互稿未给这条分支可见落点；状态页已有 active 文案不是显式 `needToActivateTerminalCommand` 入口，不能作为替代。当前用户已明确答复：只显示“设备已激活成功”；不加按钮或计时；正常由 integration 发起请求并由业务包接管页面。
- **影响**：没有分支定义会让实现自行选择留页、加 CTA、加延时或跳转，产生不一致行为。
- **最小修正及更小替代**：四个 ACT screen 只补 active success 状态，并明确它没有按钮/计时，integration 按当前 owner selector 把阶段路由给业务包；断链/同步未就绪 mask 优先。对应已在 Journey §3、IA `IA-ACT-01..04`、交互 ACT-01..04、详设 R-03/CP-02/V-02 与计划步骤 1 写明。无需新 screen、自动计时或“继续”动作；这些更大方案都违背已确认交互或增加状态。
- **Dexter 裁决**：本轮用户回复已明确行为，无剩余产品问题。
- **当前状态**：文档已修订，未实施、未运行。

### S-4 · generated 后缀、当前配置前缀与凭证身份来源

- **Classification：CONFIRMED**。
- **原 finding 与判据**：来源评审 §2 S-4。正式需求 R-04/R-07/R-08 `...formal-requirements-codex.md:121-140,181-205` 要求配置 prefix + generated suffix，并禁止 client/transport 解析集团编码重建完整路由。
- **重新核验的事实与反例**：当前 `apps/terminal/kernel/base/terminal-data-client/src/features/actors/terminalDataClientActor.ts:155-184` 负责序列化 generated descriptor 路径和 query、调用 transport；`:327-365` 仍把 `groupWorkspaceKey` 放入 request 并从 pending 写入凭证。`contracts/policy/terminal-client-generation.json:1-19` 当前没有 operation suffix 选择。地址配置字段是 `addresses[].baseUrl`，见 `apps/terminal/kernel/base/server-config/src/types/serverConfig.ts:34-43`；通用地址解析由 `apps/terminal/kernel/base/transport/src/foundations/resolveTransportServerAddresses.ts:21-47,69-80` 提供。反例是后台与其他 consumer 仍须保留 canonical full route，不能全局把生成 API 改成 suffix。
- **影响**：旧文档把 prefix 拼接、集团标识和 client 责任混写；实施者可能让 client 越权读配置、重建业务身份，或改变无关 consumer 路由。
- **最小修正及更小替代**：Journey/IA、详设 §3/§6/§7、计划步骤 1a 与 CP-02 已统一为：canonical full route 保留；terminal consumer policy 仅为 activation/cancel 两个 operation 派生 suffix；generated client 序列化 operation 参数/query；composition 注入 server-config provider 给 transport network adapter；adapter 使用**当前选中的服务空间**的 `addresses[].baseUrl` 并追加 suffix；client command 不收 config key/URL/prefix、不读取 config selector/state；凭证中的 groupWorkspaceKey/terminalRef/storeRef/generation 只从验证成功响应取值。Dexter 已明确取消激活始终使用当前选中服务空间；若服务端拒绝旧凭证，保留凭证并显示 owner 原因，不静默回退。更小的“只改 UI 不改生成与执行边界”不能消除 client 传入集团标识的路径，也无法保证其他 consumer 不变。
- **Dexter 裁决**：不需要新裁决；“始终使用当前选中的服务空间”为当前会话直接裁定。
- **当前状态**：文档已修订，生成和请求路径未实施/验证。

### S-5 · 配置校验、effective、持久化和同步状态分开

- **Classification：CONFIRMED**。
- **原 finding 与判据**：来源评审 §2 S-5。正式需求 R-06 `...formal-requirements-codex.md:156-170` 明确 command 返回不等于持久化完成，须准确表示已生效与未落盘。
- **重新核验的事实与反例**：`apps/terminal/kernel/base/server-config/src/features/actors/serverConfigActor.ts:230-252` 在 command 内生成并 dispatch 新 effective state；clear/restore 同样派生新 state，见 `:254-294`。所以“提交前校验拒绝、没有状态变化”是不同分支的反例，不能推出“已更新 effective 后持久化失败也自动回滚”。
- **影响**：UI 若一律显示旧 effective，会和 owner 当前内存配置/后续请求使用的地址不一致；增加默认回滚还会引入需求未规定的第二状态恢复语义。
- **最小修正及更小替代**：Journey、IA、交互 ADMIN-02/03、详设 CP-03/§5a/V-06/V-08 与计划 CP-03 分开写：validation refusal = 不 dispatch、effective 不变、保留草稿；effective 已更新但 persistence 失败 = 保持新 effective、显示“未持久化”；sync 失败 = host effective 仍权威，branch 旧投影不标为 current、保持 not-ready。三者分别从 owner selectors/readback 观察。无需新增回滚/补偿框架；回滚方案不比准确展示更小。
- **Dexter 裁决**：不需要；按需求现有语义。
- **当前状态**：文档已修订，未实施/验证持久化或同步故障路径。

### S-6 · ADMIN-02 每个地址的 baseUrl 是唯一 prefix 事实

- **Classification：CONFIRMED**。
- **原 finding 与判据**：来源评审 §2 S-6。R-06～R-08 `...formal-requirements-codex.md:156-205` 依赖现有配置类型，并要求完整服务 URL 前缀。
- **重新核验的事实与反例**：`apps/terminal/kernel/base/server-config/src/types/serverConfig.ts:34-43` 的 address 只有 `addressName`、`baseUrl`、`timeoutMs`，没有独立 global prefix 字段。多个候选地址各自拥有完整 baseUrl 是合法模型，不是第二个全局输入。
- **影响**：同时输入一个全局 prefix 和多个地址 URL 会让调用方无法确定实际被消费的值。
- **最小修正及更小替代**：IA、交互 ADMIN-02 的线框/roster/依赖图/mutation matrix、详设 §3a/配置事实表、计划 CP-03 已合并成每个 `addresses[].baseUrl` 一项；“完整 URL 前缀”仅作该字段说明，不另设 `url-prefix` 控件/testId/state。保留每地址的 name/baseUrl/timeoutMs。保留独立字段的方案需要新 owner fact 且与当前 schema 无法保存，不是更小替代。
- **Dexter 裁决**：不需要；沿用现有地址模型。
- **当前状态**：文档已修订，未实施。

### N-1 · 逐屏 mutation 表、依赖图、command 分母和场景表一致性

- **Classification：CONFIRMED**。
- **原 finding 与判据**：来源评审 §2 N-1；模板 `doc/decisions/templates/ui-interaction-design-template.md:274-276` 要求八列逐屏 mutation 字段矩阵。
- **重新核验的事实与反例**：当前 UI 工件含 26 个唯一 `### Screen`、26 个 mutation matrix；修订后每矩阵八列、合计 62 行。AUTH 两个登录页依赖图补齐口令输入；会员工作台命令分母包含 `memberFormOpenedCommand` 且新增 ID 使用 `member-list:add`；LSP 壁纸使用 branch picker TestIds；详设 20 个 V 场景表有七列，其中 businessOracle 与 cleanup 分列。只读/无 mutation screen 保留 N/A 行，不伪造 command。
- **影响**：列或分母遗漏会造成实施和控件测试实际覆盖面不一致，但无需新增业务机制。
- **最小修正及更小替代**：交互工件逐屏补齐八列，按模板字段填写；表单依赖图与 roster/mutation denominator 使用同一控件和 command；详设验收矩阵分开业务断言及清理。静态计数复核命令/观察为：26 个 screen heading、26 个 mutation matrix、每表 8 列/62 数据行、20 个 V 场景行/7 列。无需新 checker 或重复 source of truth。
- **Dexter 裁决**：不需要。
- **当前状态**：文档已修订并做静态结构核对；没有执行 UI、Web、VM/device 或场景测试。

## 3 · 当前修订包与证据边界

修订文件：

- `doc/decisions/2026-10-02-ter-terminal-activation-interaction-pair-topology-journey-codex.md`
- `doc/decisions/2026-10-02-ter-terminal-activation-interaction-pair-topology-ia-codex.md`
- `doc/decisions/2026-10-02-ter-terminal-activation-interaction-pair-topology-ui-interaction-codex.md`
- `doc/plans/platform/2026-10-02-ter-terminal-activation-interaction-pair-topology-implementation-design-codex.md`
- `doc/plans/platform/2026-10-02-ter-terminal-activation-interaction-pair-topology-implementation-plan-codex.md`

本轮不修改正式需求、需求讨论、源码、测试、依赖、生成物或执行入口。设计修订与静态结构检查不构成实现验证。V-01～V-20、Expo Web、四种 VM topology/device、adapter、业务行为及 cleanup 均为 `NOT_RUN`；本轮没有运行生成、构建、测试、`scripts/verify`、DEV、reset/seed、L2、UAT 或部署。

作者 intake 对六项 S 和 N-1 均为 `CONFIRMED`；不存在等待 Dexter 的产品语义问题。此处不输出新 `GO/NO-GO` verdict；当前字节须由 Dexter 转交 Claude 独立复评。来源评审的 `NO-GO, M/S/N=0/6/1` 仅绑定其 §1 的旧输入哈希，不因本文件或修订声明变更。
