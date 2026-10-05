# TER automation-agent 正式需求修复版 · 外部静态复评

```text
REVIEW_TARGET=DESIGN
ACTION_1_VARIANT=1-B 文档提取
reviewerKind=EXTERNAL_CLAUDE
SESSION_PROVENANCE=续接会话；从 catering-v2s 仓根重新读取当前需求、规范与 owning source；不冒充 fresh 子 agent 或动态验收
REVIEWED_OBJECT=doc/plans/platform/2026-10-05-ter-automation-agent-formal-requirements-claude.md
REVIEWED_SHA256=23247b33ac08dc59f661005aea043d4b9a50edbe5a324161ec327abc109602c0
VERDICT=NO-GO
M/S/N=0/2/1
L1_ENGINEERING=两项行为语义 finding、一项 API 示例 note；六项旧 finding 的源头修订 CLOSED
L2_USER_VISIBLE=当前需求文字静态复核；admin 状态行、真实输入、双屏行为尚未验证
L3_UNVERIFIED=F-1、F-2、F-4a、F-4b、R-17 前提链及 V-01～V-19；实现与运行全部 NOT_RUN
SAME_ROOT_SCAN=R-03/R-06/R-07/R-13/R-19，F-2/F-4b，V-03/V-06/V-07/V-13/V-19，以及全部九行 RxJS 用法表
DESIGN_GAPS=重连对 error/complete 的处理及 dispatch 超时后的观察结束条件，见 RX-S-1/RX-S-2
TEMPLATE_COVERAGE=正式需求适用输入已核对；四份后续设计模板逐节适用性见下表
EVIDENCE_TIER=当前仓内静态源码/文档 + RxJS 7.8.2 官方 tag 源码；无新实现或动态证明
AUTHORITY=只评当前正式需求；不重开已关闭内部 DESIGN cycle，不授权后续设计定稿、实施或运行
```

结论：六项旧问题已在当前需求源头关闭。新增 R-19 的内部依赖边界合理，但自动重连和 command 跟踪的示例存在可由源码证伪的行为缺口，因此本字节为 **NO-GO，0M/2S/1N**。不将它们描述为已发生的实现故障。

`review-standard.md:172` 对 L3 非空统一要求 `GO_WITH_UNVERIFIED_UI`，没有表达“已确认阻断与未验证并存”的组合。本次按 Dexter 的明确交审口径：阻断未关闭时 NO-GO；仅剩 UNVERIFIED 时才 GO_WITH_UNVERIFIED_UI。保留 L3 清单，不据它掩盖两项已确认问题；本轮不修改规范。

## 读法与独立性

- 先对当前需求、Runtime 真实调用链、实施模板和终端规范形成判断，再将旧评审与 intake 用作六项修订对照；作者分类和历史 verdict 均不是本轮证明。
- 原外部 NO-GO 对应 `bc607783…`；六项修订 intake 记载的对象为 `3c16668c…`。本轮对象另含 R-19/V-19，SHA 已亲自复算，不能沿用前两个字节的结论。
- 已使用本仓 `cs-review` 与 `cs-third-party-library-usage`。本次第三方语义以 RxJS **7.8.2 tag** 为依据，不以最新版本文档替代。该版本尚未在本仓安装或解析，不能称为当前实际依赖版本。
- 只用读取与哈希命令查看仓内材料；没有读取 `.runtime/`，没有生成、安装、编译、测试、verify 或任何动态环境动作。唯一写入为本评审文件。

## 方案合理性

问题正确：统一真实输入、控件定位、selector 观察和 command 执行反馈，直接对应 Dexter 对 TER 自动化的诉求。将 RxJS 加入 agent 是本轮明确裁定，不重新讨论是否允许这个库。

方案总体合理：RxJS 限于 agent/driver 内部，协议保持 JSON，跨包业务读取仍经按名 selector，业务动作仍经 Runtime command。没有把 Observable 暴露给业务包，没有引入 redux-observable 或第二执行账本，符合 TR-03、TR-11 和 R-12。driver 侧继续使用 WS 服务端库，与 RxJS 客户端职责相容。

代价有边界：agent 随所有构建进入产物，所以新增库的 bundle 成本真实存在；文档已列为 F-4b 实测输入，当前没有数值证明。最小修正是改正三个用法表条目、明确生命周期语义，不是增加重连框架、持久账本、消息队列或新的安全控制面。`shareReplay` 的清理布局等交给详设，用已有会话退出要求约束即可。

## 六项旧 finding 关闭表

以下 CLOSED 指当前需求的语义修正，不代表专项实现或测试通过。

| 原 finding | 状态 | 当前源头证据与独立判断 |
|---|---|---|
| S-1 runtime 与连接身份混用 | CLOSED | 正式需求 R-03 `:126–132`、R-11 `:277`、F-2 `:462`、V-03 `:486` 均区分两种身份。`apps/terminal/kernel/base/runtime/src/application/createRuntime.ts:362` 创建 runtimeId，`:476–477` 公开该只读身份；断网恢复没有要求重建业务 Runtime。R-19 `:436` 也使用连接会话身份。 |
| S-2 F proof 与 CP 退出循环 | CLOSED | 正式需求 `:470–476` 分开首次动态前静态对账和 proof/修复完成后的完整 CP 退出对账，失败不提前 MATCHED。对应 `doc/platform/implementation-task-template.md:162`、`:173`、`:209`。§8 `:577–578` 的停止后续步骤不等于提前结束 CP 或提前给出退出结论；后续详设仍须落实具体 CP。 |
| S-3 只约束实施排期 | CLOSED | D-1 `:552`、开始条件 `:564` 明确详设和实施都在 Codex 在途批次完成之后，之前只允许需求静态评审，忠实于 §0.2 `:42`。 |
| N-1 分发前观察空窗 | CLOSED | R-07 `:198` 明确先订阅后分发，或证明无空窗的既有快照/订阅组合，`:207–208` 保留 journal 元数据例外与 selector 按名求值。`createRuntimeJournal.ts:21–23` 不回放；`createCommandDispatcher.ts:599` 同步产生开始事件。新表 `:438` 的观察终止错误另列 RX-S-2，不把旧修订说成未做。 |
| N-2 Web/Android 坐标术语 | CLOSED | R-09 `:237` 区分 viewport CSS 像素与目标 display 物理像素，只换算一次；F-1 `:461` 纳入 Web 非零滚动。此处没有声称 Android transform/density 已实测。 |
| N-3 wss 穷尽二选一 | CLOSED | §6 `:543` 改为非穷尽例举，包含按域信任指定 CA；R-04 `:142–151` 保留证书校验，U-3 `:560` 保留具体 RN/Android 行为待核。没有强制信任所有用户 CA。 |

全文扫描没有发现仍要求“断网恢复换 runtimeId”、只约束“实施在 Codex 之后”或穷尽二选一证书的现行要求；历史处置描述与被替换的旧问题不当作残留要求。

## 当前 findings

### RX-S-1 · `retry` 示例未闭合正常关闭后的自动重连

- **位置**：正式需求 R-19 用法表 `doc/plans/platform/2026-10-05-ter-automation-agent-formal-requirements-claude.md:436`；判据为 R-03 `:129–133`、F-2 `:462`。
- **性质/分类**：外部官方源码事实 + 对文档示例的静态反例；CONFIRMED，不是本仓已运行故障。
- **证据**：RxJS 7.8.2 `WebSocketSubject` 在 `wasClean` 关闭时发 complete，其他关闭才发 error；`retry` 只重订阅 error，complete 直接结束。另外 `resetOnSuccess` 在收到 next 时重置计数，不等于 socket open。[WebSocketSubject 7.8.2 源码](https://github.com/ReactiveX/rxjs/blob/7.8.2/src/internal/observable/dom/WebSocketSubject.ts#L327-L339)，[retry 7.8.2 源码](https://github.com/ReactiveX/rxjs/blob/7.8.2/src/internal/operators/retry.ts#L98-L110)
- **触发条件/反例**：driver 正常关闭连接后重新可用；若按表仅组合 `webSocket` 与 `retry`，订阅会 complete，不会自动建新连接。若按“连接成功后重置”理解示例，握手成功但尚未收到业务消息时，计数又不会按预期重置。
- **影响**：F-2 的断开服务端后恢复路径可能永久停在离线；新连接身份和重新订阅无法发生。
- **最小可验收修正**：用法表明确自动恢复须覆盖远端 complete 与 error；本地主动关闭/开关关闭/销毁必须终止恢复。可用既有 RxJS repeat/retry 组合或有限的关闭分类，不指定新增管理器。明确退避重置按 open 还是按收到消息，不能把 `resetOnSuccess` 写成 open hook。详设 F-2 写入正常关闭后恢复、异常断开后恢复、主动停用不重连的反例。
- **同根范围**：已核对 R-03、会话退订条目 `:435`、F-2、V-03。身份要求本身正确；修正只针对关闭/重置语义，不要求跨会话保留旧业务订阅。
- **Dexter 裁决**：不需要；这是落实已接受的自动重连要求。

### RX-S-2 · 收到 dispatch 结果即结束观察会漏掉迟到完成/出错

- **位置**：正式需求 R-19 用法表同文件 `:438`；与 R-07 `:198–202` 冲突。对应 owning source 为 `apps/terminal/kernel/base/runtime/src/foundations/createCommandActorDispatcher.ts:323–327`、`:448–461`、`:413–423`；`createCommandDispatcher.ts:631–670`。
- **性质/分类**：仓内源码事实 + API 终止语义 + 静态失效推论；CONFIRMED。
- **证据**：actor 超时先返回 timeout record，实际执行继续，并在稍后产生 `actor.late-completed` 或 `actor.late-error`。dispatcher 可先返回 `CommandDispatchResult`，其中允许 `timed-out`（`runtime/src/types/execution.ts:26`、`:40–45`）。RxJS `takeWhile` 的 inclusive 只额外发出触发结束的那一条，随后 complete，不继续观察。[takeWhile 7.8.2 源码](https://github.com/ReactiveX/rxjs/blob/7.8.2/src/internal/operators/takeWhile.ts#L53-L60)
- **触发条件/反例**：actor 先超时，dispatch Promise 给出结果，合并流依表在此结束；actor 此后才成功或出错。需求 `:200` 要求推送的迟到事件已无订阅者。多 actor 命令也不能在首个 actor 的终态时停止整条 request 观察。
- **影响**：R-07 宣称的执行过程不完整；driver 会把“分发已经返回”误当成“之后不再有结果”。
- **最小可验收修正**：删去“收到最终结果为止”这个含混停止条件，区分 dispatch 返回与 request 的观察结束。有超时 actor 时，保留对已分发执行的迟到事件观察，直至详设明确的有限观察结束或连接会话结束；复用现有 journal/执行读模型，不建第二账本。详设 V-07 应包含“先超时返回、后实际完成/错误”和多 actor 反例，说明结束条件及超出观察范围的表达。
- **无空窗相邻检查**：`defer` 只是推迟分发到订阅时，不自动证明 journal 已订阅；创建 cold Observable 与订阅它不同。R-07 已写正确约束，详设须让 journal 的实际订阅先于 dispatch 分支执行。`merge`/`defer` 本身可用，不另计一项“不许用 merge”的 finding。[defer 7.8.2 源码](https://github.com/ReactiveX/rxjs/blob/7.8.2/src/internal/observable/defer.ts#L51-L54)
- **同根范围**：R-07、R-19 command 条目、V-07、driver 等待/失败报告。无超时且所有 actor 已终结时可正常释放；不要求永久观察或重连后补报 automation 请求。
- **Dexter 裁决**：不需要；迟到完成/错误已经是明确需求，有限期限与退出实现由详设落实。

### RX-N-1 · `throttleTime` 配置放错参数位置

- **位置**：正式需求 R-19 用法表同文件 `:434`，相邻判据 R-06 `:190`、V-06 `:489`。
- **性质/分类**：官方 API 签名事实；CONFIRMED。
- **证据**：7.8.2 第二参数是 scheduler，第三参数才是 leading/trailing 配置。当前 `throttleTime(t, {leading: true, trailing: true})` 不是合法重载。默认 trailing=false 的提示本身正确。[throttleTime 7.8.2 源码](https://github.com/ReactiveX/rxjs/blob/7.8.2/src/internal/operators/throttleTime.ts#L44-L60)
- **影响**：照抄示例会类型失败；若绕过类型，配置会被当成 scheduler。不会实现宣称的尾值保留。
- **最小修正**：改为 `throttleTime(t, undefined, {leading: true, trailing: true})`，或使用默认内置 scheduler 的合法三参数形式；不需要自定义 scheduler。保留 auditTime 候选，具体初值/尾值验证放在 V-06/V-19。
- **严重度过滤**：主要求“不丢最后一次值”已经清楚，表还有 auditTime 候选，修复仅一处参数，因此记 N，不据这处笔误单独阻断整个方案。
- **同根范围/Dexter 裁决**：已核对九行用法表及正文对 throttle 的引用；未发现第二处相同错误。无需产品裁决。

## R-19 其余边界与 API 核验

| 范围 | 静态判断与限制 |
|---|---|
| 版本与依赖 | 7.8.2 官方 package.json 的生产依赖仅 `tslib ^2.1.0`；本仓 `yarn.lock:13761` 解析 tslib 2.8.1，但没有 rxjs 解析项。推荐版本可作为详设输入，不能声称新包依赖已解析或实际复用了同一 tslib。[7.8.2 package.json](https://github.com/ReactiveX/rxjs/blob/7.8.2/package.json#L153-L155) |
| 内部使用/公开 API | `:420–424` 禁止 RxJS 进入业务依赖、公开 API 或 Runtime 接管层；`:423` 的“任何包”覆盖 agent/driver 自身，V-19 的较短表述没有推翻它。JSON wire、command/selector 路径与 TR-03/TR-11/R-12 相容。 |
| 九行用法表 | selector、重连、command 三行问题已列。其余六行的方向可行，不是实现完成：断开退订、多路消息、节点事件、条件等待、最后值缓存、Promise 平台动作接入仍须详设闭合具体生命周期。 |
| 会话释放 | `takeUntil` 必须收到 notifier 的 next；仅 complete notifier 不终止 source。文档尚无这种错误实现，故不是新增 finding；详设按 `:427/:435` 与 V-19 明确销毁信号和 teardown 即可。[takeUntil 7.8.2 源码](https://github.com/ReactiveX/rxjs/blob/7.8.2/src/internal/operators/takeUntil.ts#L44-L47) |
| 最后值缓存 | `shareReplay(1)` 默认 refCount=false，下游全部退订不保证上游释放。但若会话终止作用于共享上游，仍能满足要求；不能仅凭这个例子判定发生泄漏。详设采用会话作用域及正确释放布局，或 refCount=true 的有限缓存即可，不新增缓存 owner。[shareReplay 7.8.2 源码](https://github.com/ReactiveX/rxjs/blob/7.8.2/src/internal/operators/shareReplay.ts#L154-L170) |
| driver 等待 | filter 后 timeout(first) 与 firstValueFrom 的组合方向正确；空完成/连接结束/超时须转成 driver 的明确结果。firstValueFrom 收到首值会退订，不证明包装的底层 Promise 自动取消。[firstValueFrom 7.8.2 源码](https://github.com/ReactiveX/rxjs/blob/7.8.2/src/internal/firstValueFrom.ts#L55-L72) |
| WS 客户端与服务端 | `webSocket` 默认取全局 WebSocket、允许注入 ctor 的事实成立；实际 RN/Web TLS 仍待验证。driver 服务端复用 ws 合理。本仓锁项为 7.5.13/8.21.3（`yarn.lock:14633/:14648`）；`tools/terminal-topology/run-dual-device.mjs:10/:3592` 已使用 ws 客户端，这仅证明库已有使用，不冒充现有 automation WS 服务端。 |
| API 存在与工程适配 | 7.8.2 的公开入口支持表内核心符号；导出存在不等于自定义 JSON 比较、合并流顺序、RN bundling 或资源释放已经正确。具体 operator chain 与反例由后续详设/实现按对应版本完成。[7.8.2 公开入口](https://github.com/ReactiveX/rxjs/blob/7.8.2/src/index.ts) |

没有把 RxJS 当成测量、testID、primitives 接缝或受管生命周期的替代品；R-19 `:444–449` 明确保留这些工作。没有要求把全部 RxJS operators 都纳入本期。

## 模板覆盖与后续设计缺口

本次对象是正式需求，四份模板是后续工件要求，不要求现在补出完整详设。

| 模板逐节范围 | 本轮覆盖/适用性 |
|---|---|
| Journey §1～§7（任务、actor 前提、边界、corpus、UI 适用、裁决） | 需求 §0/§1、R-04/R-17、§5/§7 提供输入；正式 Journey 尚未提交，NOT_APPLICABLE_TO_CURRENT_ARTIFACT。 |
| IA §1～§6（可见/不可见维度、加载、共用规则、错误、交叉对账、完成） | R-04 只声明共享 admin 状态行；页面归属/文案/testID 待详设工件，不在本轮声称完整，NOT_APPLICABLE_TO_CURRENT_ARTIFACT。 |
| UI §1～§10，含 §1.1/§1.2、线框、状态、合理性、owner、历史/demo | 需求提供显示范围与真实/语义动作定义，无 UI 工件交付；NOT_APPLICABLE_TO_CURRENT_ARTIFACT，不恢复已退役台账。 |
| implementation design §0～§14，含 CP、§3a、§9a/§9b、§10b、§11a、§13b/§13c | 需求含目标、范围、owner 约束、F/V、顺序；完整接口、operator chain、预算、场景/cleanup、迁移与准入尚待详设，NOT_APPLICABLE_TO_CURRENT_ARTIFACT。RX-S-1/RX-S-2 是当前用法约定的矛盾，应先修源头，不能留给实现猜。 |

其余后续设计事项：selector 登记的机械判别、surface 注入、display 坐标依据、受管 runner 迁移、R-17 合法激活/登录/DEV 前提、RxJS 产物体积及销毁顺序。它们已被需求交给后续阶段，本轮不重复列为额外 S。

## 未验证清单与授权结束核对

| 档位 | 本轮结论 |
|---|---|
| 静态可确认 | 当前 SHA、六项文字修订、Runtime 现有身份/journal/timeout/late-event 源码、RxJS 7.8.2 的上述官方语义、依赖边界与计划顺序。 |
| 测试已证 | 无；本轮没有运行测试，没有引用历史运行作当前 PASS。 |
| F-1 | UNVERIFIED：双屏测量、transform、Presentation/density、真实点击及容差。 |
| F-2 | UNVERIFIED：实际 Web/Android 重连与新旧会话失效；RX-S-1 先修文字，未运行测试。 |
| F-4a/F-4b | UNVERIFIED：关闭 no-op、静态页一致、bundle 增量、注册/查询/推送性能。 |
| R-17 前提链 | UNVERIFIED：最终在途批次字节、合法激活与店员 fixture、DEV/seed 需求及单独授权。 |
| 新依赖与平台 | 未安装/解析 RxJS 或新增 driver ws dependency；RN/Web 编译适配、TLS、设备行为均 OPEN。官方 tag 核对不是本仓运行证明。 |
| V-01～V-19 | 全部 NOT_RUN；W/A/F 是计划执行面。 |
| 生成/编译/测试/verify、DEV、reset/seed、设备、L2/UAT/部署及 cleanup | 全部 NOT_RUN/本轮不授权。不存在本次动态 business 或 cleanup PASS。 |

本轮独立复评交付已完成。两项 S 和一项 N 均可做有限文字修正，不需要新的产品选择；修复后才可判断是否只剩 UNVERIFIED 并给出 GO_WITH_UNVERIFIED_UI。任何后续详设、实施或运行继续由 Dexter 单独授权，且仍遵守当前“不并行，等 Codex 做完”的裁定。
