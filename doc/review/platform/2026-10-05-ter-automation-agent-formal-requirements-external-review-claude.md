# TER automation-agent 正式需求 · Claude 外部静态评审

- 日期：2026-10-05。
- 被审对象：`doc/plans/platform/2026-10-05-ter-automation-agent-formal-requirements-claude.md`。
- 被审 SHA-256：`bc607783963ca82b46b8b7bd32f2625906948fa4bdb7fff002b7b85a5f2b9955`，本轮纯读取复算一致。
- 身份：`reviewerKind=EXTERNAL_CLAUDE`；这是续接会话，不声称 fresh 会话或独立子 agent 盲审。
- 阅读顺序：先读当前需求、讨论稿、规范及对应源码，形成反例；随后对照 R1/R2 与 intake。历史 verdict 和作者分类不作当前结论依据。
- 授权：静态评审；只新增本评审文件，其余路径只读。没有执行生成、编译、测试、verify、DEV、设备或数据操作，没有读取 `.runtime/`。
- 原内部 DESIGN cycle 不重开；本报告不是其第三轮。

```text
REVIEW_TARGET=DESIGN
ACTION_1_VARIANT=1-B 文档提取
VERDICT=NO-GO
M/S/N=0/3/3
L1_ENGINEERING=S-1、S-2；N-1、N-2、N-3
L2_USER_VISIBLE=需求契约与场景来源静态核对；呈现及真实输入未验证
L3_UNVERIFIED=F-1、F-2、F-4a、F-4b、R-17 最终前提链、V-01～V-18、设备/权限/资源与 cleanup
SAME_ROOT_SCAN=见各 finding 与逐项核验表
DESIGN_GAPS=见“设计缺口与模板覆盖”；不就地增设产品要求
TEMPLATE_COVERAGE=需求阶段适用性逐节核对；后续四类工件未交付，不冒充模板通过
EVIDENCE_TIER=当前仓内静态事实＋官方资料；运行证明 NOT_RUN
```

结论由三个当前已知 S 决定，不能因同时存在未验证项而写成 GO。`review-standard.md:172` 的“L3 非空只能 GO_WITH_UNVERIFIED_UI”与“已知阻断＋未验证同时存在”的表达冲突，本报告显式保留此规范缺口。若已知阻断关闭且没有新问题，剩余未验证项应对应 `GO_WITH_UNVERIFIED_UI`，仍不代表实施或运行授权。

## 方案合理性

目标合理：把查询、订阅、command 观察统一放在 Runtime 一侧，把 Web/Android 的真实输入放在 driver 一侧，能够减少两套旅途脚本的业务重复。复用现有 dispatcher、journal、selector 和 render surface，比另造业务状态镜像、command 执行账本或平台 getter 更简单。

总体依赖方向可成立：primitives 提供不依赖 Runtime 的注册接缝和 testID 构造能力；render 注入 surface 信息；assembly 接入 agent；driver 负责真实点击及受管生命周期。没有理由仅因现有 SurfaceContext 位于 render 就否定方案，但详设须写出声明、注入、消费路径，不能让 primitives 反向 import render 或 kernel。

代价主要在控件覆盖、surface 坐标及旧 runner 行为迁移，文档已承认并安排 F 闸。F-1 等失败时停下报告，与“按顺序连续完成”不矛盾：前者是明确的失败边界，后者没有授权绕过失败。这些未知项不要求现在补动态证明。保留 output contract、把测量算法交给详设，符合当前需求阶段的尺度。

本报告的修正均为身份、顺序或文案收敛；不建议增加第二账本、通用恢复框架、额外平台端口、PKI 工程或重新跑历史评审。

## Findings

### S-1 · 断网重连被要求改变真实 Runtime 身份，与现有身份契约冲突

- **位置**：正式需求 R-03，`doc/plans/platform/2026-10-05-ter-automation-agent-formal-requirements-claude.md:120`、`:121`、`:122`；R-11 同文件 `:266`；F-2 `:404`。
- **性质/证据**：仓内事实。R-03 将 App 重启、JS reload、断网恢复并列，要求以新的 runtime 身份建立新会话；R-11 又明确该身份就是 `runtime.runtimeId`。`apps/terminal/kernel/base/runtime/src/application/createRuntime.ts:362` 只在 Runtime 创建时生成 ID，`:477` 将该值公开；`apps/terminal/kernel/base/runtime/src/types/runtime.ts:44` 将它声明为只读。
- **反例**：只断开、恢复 automation WS，App 与业务 Runtime 均未重建。真实 runtimeId 应保持，连接却必须新建。按现文不能同时满足 R-03 和 R-11；若为了满足它重建业务 Runtime，自动化网络故障会干扰正常业务。
- **影响**：F-2 oracle、旧订阅失效及旧响应关联依据不明确，详设容易误改业务生命周期。
- **最小可验收修正**：区分真实 `runtimeId` 与 automation 连接会话身份。Runtime 重建才改变前者；每次重新建立 WS 会话改变后者，旧订阅与消息按后者失效。同步 R-03、R-11、F-2 的文字；不用新增业务 Runtime 仲裁或重置机制。
- **同根扫描**：R-03、R-11、F-2、§8 第一步；不能只改 R-03。
- **Dexter 裁决**：不需要新的产品裁决，属于既有身份与“网络失败不得影响 App”目标的最小一致化。

### S-2 · CP 的最终 MATCHED 被放在其 focused proof 之前

- **位置**：正式需求 §3“进入条件”，同文件 `:412`；关联 `:413`、`:414`、§8 `:506`～`:514`。
- **性质/证据**：仓内规范冲突。`:412` 明说 F-1/F-2/F-4 是“所在 CP 内”的 focused proof，却要求该 CP 阶段三维对账 MATCHED 后才运行。`doc/platform/implementation-task-template.md:162` 要求完整 CP 的工作、focused proof 与修复完成后，开始下一 CP 前做完整 CP 独立对账；AGENTS.md 同一规则也明确这一顺序。
- **反例**：先给 CP-01 最终 MATCHED，随后 F-1 动态证明失败，CP 实际尚未完成。若保持 MATCHED，则其输入遗漏 proof；若立即撤回重做，则需求把最终退出门变成了临时准入，产生不必要的重复和身份歧义。
- **影响**：§3 闸与实施阶段退出条件无法按现文字一致执行。
- **最小可验收修正**：把首次动态前的静态准入与“完整 CP 退出 MATCHED”分开命名。F proof 在 CP 内完成，失败先修复；完整 CP 对账检查其实际 proof 后才允许下一 CP。保留模板 `:173` 的首次动态前静态复核要求，不把它误称为已完成 CP 的最终对账，也不另给每个文件或动作增设关卡。
- **相邻约束**：§8 允许多批，不能据此直接判定“步骤 4/5 与步骤 7 必然构成循环”。但详设必须明确批准批次与 CP 范围，把该批全部 CP、全批 6b、该批最终验收按序绑定；早期旅途 proof 与最终验收须区分，不能靠给同一运行换名字规避进入条件。
- **同根扫描**：F-1/F-2/F-4、§3 两层准入、§8 连续执行；R-17 涉及 DEV/seed 时还须遵守 `:414` 的额外准入。
- **Dexter 裁决**：不需要产品裁决。若打算改变既有阶段治理，应明确交回治理侧，不能从本需求暗中推导例外。

### S-3 · “整个专项排在 Codex 之后”被缩窄为只约束实施

- **位置**：正式需求 §0.2，同文件 `:42`；D-1 `:488`；开始条件 `:500`。
- **性质/证据**：当前交审输入与文档解释不一致。原话逐字收录“不并行，等 codex 做完”；本次 Dexter 交审重点进一步明确解释为“整个专项排在它之后”。D-1 与开始条件却只写“实施”在后，未约束后续详设。
- **反例/推论**：执行者可以据 D-1 在 Codex 在途修改 owner/runner 时并行定稿 automation 详设，再声称实施没有并行。这样既违反本次明确的排期含义，也容易冻结尚未完成的 runner 清单与依赖事实。
- **影响**：排期与设计基线漂移；R-16、R-17 要复用的当前入口可能再次变化。
- **最小可验收修正**：将 D-1、§8 开始条件统一为本专项后续详设与实施均排在在途专项完成之后；本次明确获授权的需求静态评审单列为当前动作，不推导并行详设授权。
- **同根扫描**：原话、D-1、开始条件、R-16 在途新增 runner 纳入要求。D-3 的后续连续执行只规定开始后的节奏，不覆盖 D-1。
- **Dexter 裁决**：落实本次已明确解释不需再裁决；若作者希望并行详设，才需要另行申请改变排期。

### N-1 · “分发后订阅”存在同步事件观察空窗

- **位置**：正式需求 R-07，同文件 `:187`～`:197`；V-07 的执行进展断言。
- **性质/证据**：仓内事实与措辞歧义。`apps/terminal/kernel/base/runtime/src/foundations/createCommandDispatcher.ts:599` 在首次 actor 等待前发出 `command.started`，`:631`～`:644` 启动本地 actor；`apps/terminal/kernel/base/runtime/src/foundations/createRuntimeJournal.ts:21`～`:23` 的 subscribe 不回放已有事件，`:27` 的记录又有界。
- **反例**：literal 按“dispatch 调用后再 journal.subscribe”实现，会遗漏 command 开始，快 actor 的早期事件也可能遗漏。现有 list/执行 selector 组合可弥补，因此不把它升级为方案不可实现的 S。
- **影响**：V-07 可能仅证明最终结果，而漏掉需求明确列出的进展。
- **最小可验收修正**：将文字改为“建立对该 requestId 的无空窗观察后分发，或使用可证明无空窗的既有快照/订阅组合”；详设包含同步快速完成、同步拒绝的反例。继续复用 journal/selector，不新增执行账本。
- **同根扫描**：受理、command/actor 开始、即时拒绝、迟到结果与退订。没有要求未提交的实现现在通过这些测试。
- **Dexter 裁决**：不需要。

### N-2 · Web 坐标“页面坐标”的单位与原点没有收紧

- **位置**：正式需求 R-09，同文件 `:226`；F-1 `:403`。
- **性质/证据**：术语歧义。Web contract 同时写“页面坐标”与 `getBoundingClientRect` 一致，容易把 document 坐标与 viewport 坐标混用。Playwright 官方文档将 bounding box 定义为主 frame viewport 坐标，并说明滚动会影响其值；这支持坐标区分，不证明本仓尚未实现的 agent。[官方依据](https://playwright.dev/docs/api/class-locator#locator-bounding-box)
- **反例**：页面已有非零滚动，再把 scroll offset 加到 viewport 矩形，真实点击发生偏移；把 CSS pixel 当物理 pixel 也可能重复缩放。
- **影响**：Web/Android output contract 的两种坐标系容易被误合并。
- **最小可验收修正**：Web 明确为 viewport CSS pixel 矩形；Android 为目标 display 的物理像素。详设 F-1 纳入非零滚动/相应坐标条件，换算只做一次，不引入新的测量框架。
- **同根扫描**：R-09、F-1、R-10 Web 输入；Android 的 transform/density 仍独立为 OPEN。
- **Dexter 裁决**：不需要。

### N-3 · wss 证书方案被错误写成穷尽二选一

- **位置**：正式需求 §6，同文件 `:479`；关联 R-04 `:132`、U-3 `:496`。
- **性质/证据**：官方外部事实。Android 官方 Network Security Configuration 支持针对 domain 信任内置 `@raw/my_ca`，不必二选一“公共 CA”或“信任用户 CA”。后者会扩大信任面的代价不能推成所有非公共 CA 方案的必然代价。[官方依据](https://developer.android.com/privacy-and-security/security-config)
- **影响**：详设可能为实现一个受管测试连接而错误扩大生产信任，或误认为只有公共域名才可行。
- **最小可验收修正**：改为非穷尽例举，补充按域信任指定 CA 的候选；具体 RN WebSocket transport、Android target 与构建配置适用性仍按实际版本核验。无需在本需求选定 CA 部署方案或新增 PKI 能力。
- **同根扫描**：R-04、§6 代价、U-3；“开关打开的终端须信任控制地址”的已接受风险没有因此消失。
- **Dexter 裁决**：更正事实不需要；日后若具体方案改变信任范围，再明确说明代价。

## 逐项核验与已确认事实

下表的“成立”仅指需求约束与现有源码支持的静态可行性，不指实现完成。

| 范围 | 独立判断与证据 |
|---|---|
| §0.2 全部裁定 | 原话已收录。落盘脱敏、连续顺序完成、忽略 Rive 草案、允许 HOT 打开开关均已进入 R-13/§5/§7/§8；“不并行”的范围见 S-3。没有据这些裁定增加运行授权。 |
| R-01/R-02 | kernel agent、ui agent、primitives 接缝与 assembly 的方向可成立；统一编入构建、配置控制开关是已接受成本。不能因本轮静态接受配置而声称关闭状态 no-op 已证明。 |
| R-05/R-06 | “公开 selector”已限定为模块根导出的 StateRoot 求值函数，排除了纯 helper；有 state selector 的模块登记，不等于无 state 的工具包强行登记。`runtime/src/types/module.ts:84`～`:108` 当前没有 selector 定义/descriptor 槽位，需求承认要扩展。 |
| publicExports 分母 | `tools/terminal-runtime/check-static.mjs:583`～`:594` 用 TypeScript checker 对导出集合与 publicExports 做 exact-set 比较。以这类元数据导航，再以类型/定义识别 state selector，能够形成机械门；publicExports 本身并不自动知道哪些导出是 selector。详设仍须盘点模块及参数/返回值，不能用名字含 select 的文本扫描代替。 |
| R-07 | 复用现有 command dispatcher、journal 与 selectRequestExecutionView 可行；异常转拒绝、journal 元数据例外已明确。观察顺序须按 N-1 收紧。 |
| R-08/R-14 | primitives 没有工作区依赖，仍有 React/RN 等外部依赖；这里不能把“零工作区依赖”误读为没有任何第三方依赖。接缝与纯 testID 构造函数可以放在 primitives；render 对 primitives 的依赖不需反转。 |
| surface 来源 | `apps/terminal/ui/base/render/src/components/SurfaceRoot.tsx:81`～`:105` 已有 surfaceIdentity/displayMode 等上下文值，`:158`～`:162` 包裹子树。render 向下层接缝注入 surface 是可行的详设方向，当前 SurfaceContext 位置本身不要求 primitives import render。注册代码及关闭 no-op 尚未实现。 |
| R-09 | `AdminLauncher.tsx:36`～`:57` 是现有测量先例，不是祖先 transform、Presentation density 正确性的实测证明。只规定 contract、把算法留给详设合理；当前反例是 N-2 的坐标术语。 |
| 两个 display ID | 需求正确区分逻辑 input displayId 与 SurfaceFlinger screencap ID。`scripts/test/ter-virtual-keyboard-android.mjs:5797`、`:5799` 已分别记录；R-09 没有把 displayIndex 冒充物理 ID。driver 复用现有解析可行，最终映射仍未验证。 |
| R-03/R-04/R-10 | 没有 adb 的远端连接只能用 agent 侧能力，不能称为 Android 真实输入；Web locator 要按 surface 限定。令牌由 App 发给 server，故不构成 App 对 server 的额外认证；可信控制地址及非 localhost TLS 是明确前提。身份问题见 S-1，证书二选一问题见 N-3。 |
| R-11/R-12 | descriptor 元数据与 state selector 路径有区分。任意已注册 command、未来 scripts.execute 能力及敏感 selector 原样协议返回是明确接受的范围，不新增 payload 校验或重复安全层。 |
| R-13 | 受管 identity、资源预检、日志脱敏、首败、business/cleanup 要迁移到 driver 已写入要求。不能据此认为实际迁移已闭合；详设须把旧入口真实能力逐项落到新入口。 |
| R-15 | TR-08 例外限定 agent/注册接缝；未来规范、扫描禁词及 T12/README 等同步列出。两个 application 仍有 `ter-vk://controlled/full` harness，需求明确最后移除。ter-failure 不在本期新能力中，保留需要后续闭合的失败族而非冒充已覆盖。 |
| R-16 | runner 按 UI/device 业务行为判别，协议/机械检查不据目录名误删；在途新增 runner 要重新盘点。TR-04 旧重启证明的回归空窗已披露，不能把旧 proof 改称新 agent proof；本期没有要求无关场景全部重写。 |
| R-17 分母 | `tools/terminal-sample2/run-sample1-frozen-journey.mjs:39`～`:45` 排除 dual hand-back 与 keyboard-alpha-probe，留下 normal、reject-retry、abandon、withdraw、render-smoke 五类。需求分母与此一致；不能把 mobile case 塞回双屏分母。 |
| R-17 前提链 | 部分静态可确认：`sample-console/src/application/module.ts:96`～`:107` 的路由依赖激活与店员状态，未激活不能直接走旧成员旅途。最后在途源码、合法激活 fixture、DEV/凭据准备仍需详设核实。不能等实施遇到失败才决定授权；需求已要求核实，本轮不要求启动 DEV 或 seed。 |
| R-18 | skill 先随详设起草、最后 fresh 可用性验收合理。未来执行仍要守主 agent 唯一写入与受管运行授权；“只读过 skill”是可用性 oracle，不是免读 AGENTS/授权的例外。 |
| F 闸与§8 | F-1 五点命中、F-2 失效/重订阅、F-4a 关闭 no-op 与 Web 独立静态页比较、F-4b 性能预算都可写成可证伪判据。容差和预算可交详设给依据；不要凭本轮静态分析设数字。顺序缺陷见 S-2。 |

## 历史评审及收口后修订

- R1 的 `NO-GO 2/12/7`、R2 的 `GO_WITH_UNVERIFIED_UI 0/4/13` 只属于各自输入字节；本轮未继承。
- R2 审阅 SHA 为 `d96589865d83f6a31bebf0b994811e98371f19a7ff04cc84338096ae253cd982`；其 intake 修订记录为 `8106743a79f155f83baa92cf3fa1d57b5a6e703482781d215d40789a4c6dce74`；当前另有 Dexter 五项裁定后的 `bc607…` 字节。当前需求 §9 如实声明后续修订未获独立 verdict。
- 旅途先沿用现有 testID、再重建回归、最后删除 runner；F-4 分为 no-op/静态页与性能；bounds 保留输出契约；journal 元数据例外；全部分发异常转拒绝；两个 display ID 来源等，当前文字有实际收敛。
- 历史建议并不自动正确。F proof 与完整 CP MATCHED 的顺序仍须按现行治理重开核对，不能因 R2 曾建议这种写法就免审。
- 五项后续裁定没有恢复 Rive 或限制 HOT；落盘敏感信息与协议原样返回已分开。新发现的范围缩窄见 S-3。

## 设计缺口与模板覆盖

这次被审对象是正式需求，不是 Journey、IA、交互工件或 implementation-facing 详设。缺少这些未来交付物的模板槽位，不作为本需求的额外 S，也不声称已完成模板验收。

| 模板与逐节范围 | 本轮适用性 |
|---|---|
| Journey §1 元数据、§2 用户任务、§3 actor 前提、§4 边界、§5 corpus、§6 UI 适用/后台一致性、§7 裁决 | 需求 §0/§1、R-17、§5、§0.3、R-04/§7 有对应需求输入；正式 Journey 的逐 actor 前提与 admin 操作仍是后续工件，NOT_APPLICABLE_TO_CURRENT_ARTIFACT。 |
| IA §1、§2.1/§2.2 可见/不可见维度及 load 行为、§3 共用规则、§4 错误映射、§5 交叉对账、§6 完成判定 | 仅 R-04 admin 状态/地址构成待详设 UI 输入；完整 IA 未提交。各节 NOT_APPLICABLE_TO_CURRENT_ARTIFACT，不以需求表替代。 |
| UI §1/§1.1/§1.2、§2 interaction、§3 Heritage 盘点、§4 线框及控件/字段/搜索子节、§5 状态边界、§6 合理性、§7 face/owner、§8 历史槽位、§9 可选 demo、§10 看图裁决 | 未来 admin/UI 交互须按当时适用规范制作；本次无线框/控件工件，NOT_APPLICABLE_TO_CURRENT_ARTIFACT。已退役的控制面槽位不能借模板恢复。 |
| 详设 §0/§1、§2～§4、§5～§9b、§10/§10b、§11/§11a、§12/§13/§13b/§13c、§14 | 当前需求含目标/比较、执行顺序、模块边界、V 映射与停机原则，属于详设输入；逐 CP owner/接口、容量、具体生命周期、迁移/seed/N/A、场景映射及对账安排未交付，NOT_APPLICABLE_TO_CURRENT_ARTIFACT。S-1/S-2/N-1 不应留到实现时猜。 |

当前正本须补的是上述 findings 的有限语义，不是再建完整模板台账。后续详设特别要闭合：selector 判别与注册路径、session 生命周期、primitives 接缝/surface 注入、bounds 版本依据、受管 runner 能力迁移与 R-17 准备路径。

另有规范侧缺口：`review-standard.md:172` 未表达“已知 NO-GO finding 与 L3 未验证同时存在”；`implementation-task-template.md:162` 的完整 CP 退出与 `:173` 的首次动态前静态准入应在设计里明确区分。这些不授权本轮修改规范，不额外扩大产品需求。

## 未验证与证据限制

| 类别 | 本轮状态及边界 |
|---|---|
| 当前需求与 owning source | 静态已读；该 SHA 的文字与现有接口核对。没有 automation-agent 新实现通过证明。 |
| F-1 | UNVERIFIED：transform 是否已计入、Presentation offset/density、双屏真实点击及容差；AdminLauncher 只是源码先例。RN 0.86 官方测量资料说明窗口测量 API，未替本专项证明这些条件。[官方资料](https://reactnative.dev/docs/0.86/the-new-architecture/layout-measurements) |
| F-2 | UNVERIFIED：重连、Runtime 重建、双机连接、旧订阅与迟到消息失效；先修 S-1 再让详设定义 oracle。 |
| F-4a/F-4b | UNVERIFIED：关闭 no-op、静态页一致、设备注册/查询开销与预算。 |
| R-17 | PARTIALLY_CONFIRMED：现有路由及 case 来源静态确认；最终 fixture、运行环境、合法凭据与是否需 seed 尚未定稿。 |
| 第三方版本与依据 | 锁文件静态入口可定位 Playwright 1.61.1、RN 0.86.3、RNW 0.21.2；本轮没有依赖解析/安装命令证明，不能把公开最新版资料视为全部实际版本行为的闭包。详设需按最终实际解析版本再核。Android CA 官方事实用于更正 N-3，不等于本仓 RN wss 路径已测。 |
| V-01～V-18 | 全部 NOT_RUN。表内 W/A/F 是计划执行面，不是当前通过记录。 |
| 生成/编译/测试/verify、Web/Android/VM/DEV、数据准备、日志脱敏/资源/cleanup | 本轮均 NOT_RUN；没有引用历史运行升级为当前 PASS。 |

本轮没有新增产品方案竞争需要 Dexter 选择。建议先做六项最小文字修正，再判断需求静态放行；其后步骤仍由 Dexter 单独授权。
