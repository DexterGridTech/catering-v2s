# TER automation-agent 正式需求修复版 · Claude 外部静态复核

- 日期：2026-10-05。
- 被审对象：`doc/plans/platform/2026-10-05-ter-automation-agent-formal-requirements-claude.md`。
- 当前 SHA-256：`3c16668cd5b85456c1d89ee8f1f63432a090b8bbf8ba23b4a6a8f37fb9fd89fc`，本轮纯读取复算与交审一致。
- 前轮对象 SHA-256：`bc607783963ca82b46b8b7bd32f2625906948fa4bdb7fff002b7b85a5f2b9955`；其 NO-GO 保留，不回写。
- `reviewerKind=EXTERNAL_CLAUDE`。本评审是续接会话中的外部修复复核，不声称 fresh 子 agent 盲审，不重开内部 DESIGN cycle。
- 阅读方法：先重开修复版、现行模板和 owning source，独立推导身份、事件及阶段顺序；再核对前轮六项原文与作者 intake。作者的 CONFIRMED/采纳声明不替代本轮结论。
- 写入范围：只新增本文件。其余路径只读；没有运行生成、编译、测试、verify、DEV、Web、设备或数据操作，没有读取 `.runtime/`。

## 结论

```text
REVIEW_TARGET=DESIGN
ACTION_1_VARIANT=1-B 文档提取
VERDICT=GO_WITH_UNVERIFIED_UI
M/S/N=0/0/0
L1_ENGINEERING=PASS（本次需求修复的静态一致性）
L2_USER_VISIBLE=PASS（需求契约层）；呈现、点击与业务行为 NOT_RUN
L3_UNVERIFIED=F-1、F-2、F-4a、F-4b、R-17 最终前提链、V-01～V-18、版本行为/资源/脱敏/cleanup
SAME_ROOT_SCAN=六项逐源头及相邻要求核验，见关闭表与全文扫描
DESIGN_GAPS=本轮无新增阻断；后续详设输入和原规范表达缺口保留，见下文
TEMPLATE_COVERAGE=需求阶段输入有；四类后续工件逐节 NOT_APPLICABLE_TO_CURRENT_ARTIFACT
EVIDENCE_TIER=当前仓内静态事实＋官方资料；运行证明 NOT_RUN
```

前轮 **S-1/S-2/S-3/N-1/N-2/N-3 六项均 CLOSED**，未发现本次修订引入新的 M/S/N。这里的 CLOSED 是需求文字及验收契约关闭，不是 automation 实现或动态行为通过。

## 六项关闭情况

下表“需求”均指被审正式需求文件；后续小节列 owning source 的完整仓根相对路径。

| 前轮项 | 状态 | 当前精确位置 | 独立关闭依据 | 仍待实现证明 / Dexter 裁决 |
|---|---|---|---|---|
| S-1 Runtime 与连接身份混用 | CLOSED | 需求 R-03 `:119`～`:125`；R-11 `:269`；F-2 `:407`；V-03 `:431` | runtimeId 在 Runtime 重建时改变；每次 WS 连接生成新连接会话身份；订阅/推送按连接会话失效；断网恢复不得重建业务 Runtime。四处说法一致。 | 自动重连、旧推送失效仍 UNVERIFIED；无需新产品裁决。 |
| S-2 CP 对账顺序倒置 | CLOSED | 需求 §3 `:415`～`:421`；§8 `:513`～`:521` | 首次动态前先静态独立对账；F proof/失败修复完成后才做完整 CP 退出对账，MATCHED 后才能开下一 CP；不提前给退出 MATCHED。 | 具体批次/CP 与 proof oracle 由详设落实；无需新产品裁决。 |
| S-3 排期缩为只约束实施 | CLOSED | 需求 §0.2 `:42`；D-1 `:495`；§8 `:507` | 详设与实施都明确排在 Codex 在途批次之后；此前只允许本需求静态评审，明确禁止并行起草详设。 | 在途批次实际完成不由本轮判定；无需再裁决排期。 |
| N-1 同步事件观察空窗 | CLOSED | 需求 R-07 `:190`～`:200`；V-07 `:435` | 明确先订阅再分发，或可证明无空窗的既有快照/订阅组合；完整进展、最终结果及异常拒绝要求均保留。 | 同步拒绝、快速完成和迟到结果的真实 proof NOT_RUN；无需新产品裁决。 |
| N-2 Web 坐标歧义 | CLOSED | 需求 R-09 `:229`～`:233`；F-1 `:406`；V-09 `:437` | Web 明确 viewport CSS pixel，Android 明确目标 display 物理像素；禁止混用与重复换算；F-1 明确覆盖非零滚动。 | native transform/density/offset 和真实命中仍 UNVERIFIED；无需新产品裁决。 |
| N-3 证书方式错误二选一 | CLOSED | 需求 R-04 `:135`、`:141`；§6 `:486`；U-3 `:503` | 已改为“包括但不限于”，加入按域名信任随包指定 CA；不再把信任用户 CA 的代价推成所有非公共 CA 的必然代价；实际 RN 行为仍留详设核验。 | 实际版本、构建配置与 wss 行为 UNVERIFIED；事实更正无需产品裁决。 |

## 源码、规范与反例回读

### 身份：S-1

`apps/terminal/kernel/base/runtime/src/application/createRuntime.ts:362` 在 Runtime 创建时生成 ID，`:477` 将其公开；`apps/terminal/kernel/base/runtime/src/types/runtime.ts:44` 是只读属性。当前需求没有要求 automation WS 断网时修改此字段。

`createRuntime.ts:335`～`:350` 的既有 root reset 在同一 Runtime 内重新 initialize，没有重新生成 runtimeId。当前修订也没有把 root reset、普通 reconnect 当作 Runtime 重建。F-2 与 V-03 分别规定“断网恢复 ID 不变”及“新连接会话、旧订阅失效”，前轮反例已被源头排除。尚未实现的新连接身份不能写成源码事实。

### 阶段：S-2

`doc/platform/implementation-task-template.md:162` 要求完整 CP 的修改、focused proof 与修复完成后做阶段退出对账；`:173` 要求首次动态前完成 fresh 独立三维对账。修复版 §3 的两道关分别对应这两个时点，没有将前一关称为完整 CP 已完成。

F proof 失败在当前 CP 内修复，与 §8 `:520`“停止后续步骤并报告 Dexter”一致：修复当前 CP 不等于进入下一 CP。如果失败证明方案本身不成立，§3 `:402` 仍要求报告 Dexter 决定方案/范围；不能借“CP 内修复”自行降级通过 F 闸。

模板 `:209` 的 6b 要在全批 CP 完成后、整体测试前；`:212`～`:217` 的动态前整体准入约束 L2/reset/seed。需求 `:420`～`:421` 没有把 F focused proof冒充整体验收，也保留 R-17 实际涉及 DEV/seed 时的适用准入。后续详设需绑定每个批准批次的 CP、6b、focused 与最终验收，但这属于已声明的详设义务，不是本轮新增阻断或新对账框架。

### 事件：N-1

`apps/terminal/kernel/base/runtime/src/foundations/createRuntimeJournal.ts:21`～`:23` 只登记监听器，不回放；`:27` 的历史记录有界。`apps/terminal/kernel/base/runtime/src/foundations/createCommandDispatcher.ts:599` 发出 started 后，`:631`～`:644` 即进入 actor 调度。先建观察再 dispatch 可覆盖这一同步起点；需求不再要求反向顺序。

对未启动 Runtime、未知 command 等没有 journal 事件的拒绝，`apps/terminal/kernel/base/runtime/src/application/createRuntime.ts:465`～`:469` 会抛出；dispatcher 缺 requestId 拒绝见 `createCommandDispatcher.ts:513`～`:525`。修复版 R-07 `:197` 独立要求将任何分发异常转换为明确拒绝推送，因此“无空窗 journal 观察”没有被误写成所有拒绝都必须有 journal 记录。

R-07 `:199` 的 journal 元数据例外与 `:200` 的执行 selector 按名求值仍明确分开；没有新增账本或跨过 R-06 直接读 state。快照加订阅不是天然无空窗，当前需求要求证明才可采用，具体证明留给详设与实施。

### 坐标、证书：N-2/N-3

Web contract 的 viewport/CSS pixel 及非零滚动，符合官方对 bounding box 与 `getBoundingClientRect` 坐标的说明。[Playwright 官方资料](https://playwright.dev/docs/api/class-locator#locator-bounding-box)

Android 官方网络安全配置确有按 domain 信任资源内指定 CA 的方式；当前非穷尽列举与该事实一致。[Android 官方资料](https://developer.android.com/privacy-and-security/security-config)

这些资料只支持术语/候选方式更正，不证明本仓尚未实现的坐标计算或最终 RN WebSocket 配置可用。R-04 的非 localhost 必须 wss、校验证书，以及 U-3 的版本核验义务仍保留。

## 全文与相邻条款扫描

对当前正式需求全文搜索以下七项旧表述，各为 **0 处**：`新的 runtime 身份`、`分发后订阅`、`Web 端返回页面坐标`、`要么使用公共 CA`、`本专项实施在 Codex`、`本专项才开始实施`、`MATCHED 之后、下一 CP 开工之前运行`。这是当前目标文件的文字扫描，不是全仓门通过。

并逐项回读对应的新表述：

- 身份：R-03、R-11、F-2、V-03 四处，以及“连接失败不得影响 App”的边界一致。
- 时序：§3 两道关、§8 连续执行、F 闸失败停止后续步骤一致；“一次性做完”没有变成越过失败或当前授权的许可。
- 排期：§0.2 原话、D-1、§8 开始条件一致；当前静态评审是明确获授权的动作，不代表可以先写详设。
- command：R-07 无空窗观察、journal 例外、selector 按名求值、异常拒绝、V-07 完整进展一致。
- 坐标：R-09、F-1、V-09、R-10 surface 限定的 Web locator 与 Android display 输入没有因修订互换。
- 连接面：R-04、§6 证书候选、U-3 官方版本/实际行为核验一致。

当前文件包含 18 个 R 要求标题、18 条 V 验收行；V-03 已跟随身份修正。数量核对只用于确认本次没有漏删需求行，不代替每条验收的实际运行。

历史 NO-GO 在 §9 `:530` 被标为外部前轮结果，作者声明修订并指向 intake；未把作者修订声明写成独立 GO。intake 的两版哈希与本轮复算一致，其 N-3“作者未再打开官方页”的边界属实，本轮已独立查官方资料。

## 方案合理性与设计缺口

方案仍对准“一份旅途两端跑、能真实输入、能观察数据与指令”的目标。六项修订复用了既有 Runtime、journal、selector 及当前阶段治理，没有增加第二执行账本、业务 Runtime 重建、平台端口或通用恢复体系。坐标算法和容量/性能依据留给详设，有 F 闸证伪，尺度合理。

本轮没有新增需要 Dexter 产品裁决的事项。前轮提到的 review-standard 对“已知阻断与 L3 同时存在”缺少表达，是规范侧历史缺口；本轮已知 findings 关闭，仅剩未验证，故可直接使用 GO_WITH_UNVERIFIED_UI，不需为本次修改规范。

四类模板的本轮适用性：

| 模板逐节范围 | 状态 |
|---|---|
| Journey §1 元数据、§2 用户任务、§3 actor 前提、§4 边界、§5 corpus、§6 UI 适用/一致性、§7 裁决 | 需求有相应输入；正式 Journey 各节为后续交付，NOT_APPLICABLE_TO_CURRENT_ARTIFACT。 |
| IA §1、§2.1/§2.2 及 load 行为、§3 共用规则、§4 错误映射、§5 对账、§6 完成判定 | R-04 留有 admin 可见项与工件义务；完整 IA 各节尚未提交，NOT_APPLICABLE_TO_CURRENT_ARTIFACT。 |
| UI §1/§1.1/§1.2、§2 interaction、§3 Heritage、§4 线框及控件/字段/搜索子节、§5 状态边界、§6 合理性、§7 owner、§8 历史槽位、§9 demo、§10 看图结论 | 本轮是需求修复，没有提交这些 UI 工件；各节 NOT_APPLICABLE_TO_CURRENT_ARTIFACT，不恢复退役控制面。 |
| 详设 §0/§1、§2～§4、§5～§9b、§10/§10b、§11/§11a、§12/§13/§13b/§13c、§14 | 目标、约束、V 行与顺序是现有需求输入；完整 CP、接口/owner、迁移/N/A、预算、场景及交付门仍须后续详设，各节 NOT_APPLICABLE_TO_CURRENT_ARTIFACT。 |

没有把未来模板尚未填写转换为本轮新增 finding，也没有把其 N/A 当作未来详设免填许可。

## 尚未验证

| 项目 | 本轮判定 |
|---|---|
| 六项需求修复、相邻文字、对应 Runtime/journal/dispatcher 行为与模板顺序 | 静态已确认；不是新 automation 实现证明。 |
| F-1 | UNVERIFIED：双屏缩放、Presentation/density/offset、四角与中心真实输入、Web 非零滚动；容差依赖详设。 |
| F-2 | UNVERIFIED：自动重连、新连接身份、旧订阅/消息隔离、Runtime 重建场景及双机连接。 |
| F-4a/F-4b | UNVERIFIED：关闭 no-op、开关构建渲染一致、设备注册/查询性能及有依据的预算。 |
| R-17 前提链 | UNVERIFIED：在途批次完成后的实际入口、合法激活/店员 fixture、DEV 与 seed 是否需要及其准入。 |
| 第三方与受管执行 | OPEN：最终实际解析版本与对应官方行为、证书部署、生命周期迁移、资源预算、日志/截图脱敏、business/cleanup。官方资料查证没有替代这些运行证明。 |
| V-01～V-18、生成/编译/测试/verify、Web/Android/VM/DEV、reset/seed/L2/UAT/部署 | 全部 NOT_RUN；本轮没有新运行记录，也未继承历史运行为当前 PASS。 |

本次放行仅针对该 SHA 的需求静态复核；不授权详设定稿、实施、规范修订、依赖或任何动态操作。
