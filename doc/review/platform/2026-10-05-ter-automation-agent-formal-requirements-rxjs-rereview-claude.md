# TER automation-agent 正式需求 · RxJS 修复版外部静态复核

```text
REVIEW_TARGET=DESIGN
ACTION_1_VARIANT=1-B 文档提取
reviewerKind=EXTERNAL_CLAUDE
SESSION_PROVENANCE=续接会话；当前仓根读取；不是 fresh 内部子 agent，也不是动态验收
REVIEWED_OBJECT=doc/plans/platform/2026-10-05-ter-automation-agent-formal-requirements-claude.md
REVIEWED_SHA256=e77f9df158f2fd5266fa12f0ea74900913455ce75fb2681cd7c75941ba400fd8
VERDICT=GO_WITH_UNVERIFIED_UI
M/S/N=0/0/0
L1_ENGINEERING=PASS（仅当前需求文字与源码/官方语义的静态一致性）
L2_USER_VISIBLE=静态要求无新增 finding；admin 状态行、Web/Android 真实输入及双屏行为均未验证
L3_UNVERIFIED=F-1、F-2、F-4a、F-4b、R-17 前提链，RxJS/driver ws 实际解析与装配，V-01～V-19
SAME_ROOT_SCAN=三项源头、R-03/R-06/R-07/R-19 九行用法表、F-2、V-03/V-06/V-07/V-19、§3/§7/§8/§9
DESIGN_GAPS=无新增阻断性需求缺口；具体 operator chain、退出期限、退避与资源释放布局仍按需求交详设
TEMPLATE_COVERAGE=四份后续工件模板逐节适用性见正文；本次不是详设定稿或 UI 工件验收
EVIDENCE_TIER=当前仓内静态源码/文档 + RxJS 7.8.2 官方 tag；实现/测试/动态运行 NOT_RUN
AUTHORITY=只评修复版正式需求；不重开内部 DESIGN cycle，不授权后续设计定稿、实施、依赖或运行
```

**结论：三项均 CLOSED，没有新增 finding，GO_WITH_UNVERIFIED_UI，0M/0S/0N。** 关闭的是需求源头的错误约定；没有证明 automation-agent 已实现、依赖已解析或动态行为已通过。

## 核验范围与读法

先读取当前 R-03、R-07、R-19 和 F/V 条款，再重开 Runtime timeout/late-event/journal/聚合路径与 RxJS 7.8.2 精确 tag，独立形成判断后对照旧报告、作者 intake。旧 NO-GO 对应 `23247b33…`，没有继承；作者 intake 的 CONFIRMED 也没有作为当前闭合证明。

使用本仓 `cs-review` 和 `cs-third-party-library-usage`。项目记忆仅用于导航，判断回到需求、适用规范与 owning source。本轮是 Dexter 中转的外部复核，没有新增第三轮内部 DESIGN 审查。

SHA 已亲自复算，匹配交审对象。仅使用读取、哈希和只读项目记忆查询；没有读取 `.runtime/`，没有安装依赖、生成、编译、测试、verify、启动环境或数据操作。只新增本评审文件，其余路径只读。

## 三项关闭情况

下表位置均针对当前字节；主文件简称“正式需求”，完整路径为 `doc/plans/platform/2026-10-05-ter-automation-agent-formal-requirements-claude.md`。

| 原 finding | 状态 | 当前源头、证据与独立判断 | 是否需 Dexter 裁决 |
|---|---|---|---|
| RX-S-1 正常关闭未重连 | CLOSED | 正式需求 R-03 `:133`、R-19 `:437`、F-2 `:463`、V-03 `:487` 一致要求远端 complete/error 恢复，本地主动关闭、开关关闭、销毁终止恢复；`:437` 准确区分 resetOnSuccess 收到值与 open。官方源码支持 retry/repeat 两条重订阅路径，详见下文。 | 不需要；落实既有自动恢复语义。 |
| RX-S-2 dispatch 返回即结束观察 | CLOSED | R-07 `:198–203`、R-19 `:439`、V-07 `:491` 明确 dispatch 返回不等于观察结束，继续推送 actor.late-completed/actor.late-error，直至有限观察期限或会话结束；多 actor 不在首个 actor 终态时停止。实际 journal 订阅必须先于 dispatch，defer 不自动保证顺序。 | 不需要；具体期限/释放链交详设，未新增永久观察。 |
| RX-N-1 throttleTime 参数位置 | CLOSED | R-19 `:435` 使用 `throttleTime(t, asyncScheduler, {leading: true, trailing: true})`。scheduler 在第二参数、配置在第三参数，与 7.8.2 签名一致；asyncScheduler 是内置实例，不违反 `:429` 的“不自定义 scheduler”。 | 不需要；API 示例修正。 |

三项修订都保持原本 owner 与协议边界；不需要再增加修正。本轮没有 PARTIALLY 或 OPEN 的旧 finding。

## 官方语义与 Runtime 反例核验

### 重连

RxJS 7.8.2 的 WebSocketSubject 在 `wasClean` 时 complete，否则 error；retry 处理 error，repeat 处理 complete。二者组合可以覆盖两种远端关闭；将需要恢复的关闭统一转成可重试信号也可行。后一思路必须排除本地停用，当前正文已经明确这个限制。[WebSocketSubject 精确 tag](https://github.com/ReactiveX/rxjs/blob/7.8.2/src/internal/observable/dom/WebSocketSubject.ts#L327-L339)，[retry 精确 tag](https://github.com/ReactiveX/rxjs/blob/7.8.2/src/internal/operators/retry.ts#L98-L110)，[repeat 精确 tag](https://github.com/ReactiveX/rxjs/blob/7.8.2/src/internal/operators/repeat.ts#L124-L164)

resetOnSuccess 在流收到 next 时重置计数，不是 WebSocket 握手成功回调。R-19 已改正这一事实，并将 open 或消息时机的选型交给详设，不再承诺两者等价。[retry 的计数重置](https://github.com/ReactiveX/rxjs/blob/7.8.2/src/internal/operators/retry.ts#L100-L108)

静态可接受的是方案语义与合法 API，不是任意组合顺序都正确。后续详设须给出唯一的连接 owner、停止信号及退避布局：停止必须取消整个恢复管线及其等待，不能只 complete 某次 socket 后又被 repeat 重启。R-03/R-19 已要求终止恢复，F-2/V-03 已有停用反例；本轮不把尚未实现的错误布局记成 finding。

### 迟到事件与多 actor

- `apps/terminal/kernel/base/runtime/src/foundations/createCommandActorDispatcher.ts:323–327` 产生 timeout record；`:448–461` 在返回超时后继续等待实际执行；`:413–423` 发出迟到完成/错误事件。
- `apps/terminal/kernel/base/runtime/src/foundations/createCommandDispatcher.ts:631–644` 等待各 actor 当前结果，`:655–680` 汇聚并返回 dispatch 结果。因此 dispatch 已返回而 actor 稍后才完成是真实可达路径。
- `apps/terminal/kernel/base/runtime/src/types/journal.ts:46–51` 声明两种迟到事件，基础字段 `:5–14` 带 requestId/commandId/runtimeId。需求复用 journal 观察这些事件成立，不需要第二账本。
- `apps/terminal/kernel/base/runtime/src/foundations/aggregateCommandStatus.ts:16–21` 表明“有 actor 超时”不必让 aggregate status 恰好为 timed-out：与成功混合可为 partial-failed，与其他失败混合可为 error。当前 R-07 要求观察所有超时 actor 的迟到事件，R-19 写的是“有 actor 超时”，没有把条件限定为 aggregate status。详设应按 actor 记录/事件判断，不把括号中的 timed-out 示例误实现成仅检查聚合字段。这是读取当前要求的边界说明，不新增条件。
- 有限观察期限或会话结束能在 agent 一侧释放 journal 订阅，不要求 Runtime 终止已执行 actor，也不承诺期限外/断线后补报。具体期限、结束表达与资源释放交详设；本次未验证。

`createRuntimeJournal.ts:21–23` 只登记监听者，不回放；`createCommandDispatcher.ts:599` 同步发开始事件。defer 只把 factory 调用推迟到自身订阅时，不建立 journal 优先订阅关系。当前 R-07 `:198` 与 R-19 `:439` 对“实际订阅先于分发”的要求正确。[defer 精确 tag](https://github.com/ReactiveX/rxjs/blob/7.8.2/src/internal/observable/defer.ts#L51-L54)

### selector 节流

7.8.2 的签名是 duration、scheduler、config；默认 scheduler 为 asyncScheduler，默认 trailing=false。当前示例合法且显式开启 trailing，保留“不丢最后一次值”的主要求；auditTime 候选没有取代初值和尾值验收。[throttleTime 精确 tag](https://github.com/ReactiveX/rxjs/blob/7.8.2/src/internal/operators/throttleTime.ts#L44-L60)

没有运行高频 selector proof，不能把合法调用写成 V-06/V-19 PASS。

## 同根扫描与方案合理性

已核对三条修订行及其余六行 RxJS 用法表。全文查询没有残留 takeWhile“收到最终结果为止”的现行停止规则、两参数 throttleTime 配置调用，或“只用 retry 即可覆盖所有关闭”的肯定要求。R-19 对 retry 限制的说明和 §9 对旧 findings 的历史描述是正确保留，不能误判为残留要求。

相邻条款继续一致：

- R-19 `:421–425` 只允许 agent/driver 内部使用 RxJS，公开 API 与 wire 仍保持既有形态；TR-03 的 selector 读路径、TR-11 的业务 command/actor 写路径和 R-12 不执行动态脚本未被改写。
- R-03 `:127–132` 仍区分 runtimeId 与每次连接身份；F-2/V-03 没有要求断网时重建业务 Runtime。
- §3 `:471–477` 保留首次动态前静态对账与 proof 后 CP 完整退出两个时点；§7 D-1 `:553`、§8 `:565` 仍约束详设和实施均排在 Codex 在途批次之后。
- `shareReplay`/takeUntil/Promise 等既有用法方向未被本次改动扩张；具体上游 teardown、notifier 信号和平台动作 cleanup 仍由详设满足会话释放要求，本次不假定存在泄漏，也不增加恢复框架。

**方案合理性**：三处修订直接解决既有反例，成本是有限文档语义与合法 API 用法，范围相称。RxJS 仍用于内部流处理，既有 Runtime 继续拥有 command 执行与 journal，不增加业务事件总线、持久观察账本或通用恢复系统。生产 bundle 增量仍需要实测；不能因语义闭合就认为代价已被量化。

## 模板适用性与未验证项

本次为正式需求修复版，不是新 Journey/IA/UI/详设工件交付。

| 模板逐节范围 | 当前判断 |
|---|---|
| Journey §1～§7（元数据、任务、actor、边界、corpus、UI、裁决） | 需求保留目标、来源、裁决和 R-17 前提输入；完整 Journey 各节 NOT_APPLICABLE_TO_CURRENT_ARTIFACT。 |
| IA §1～§6（维度、加载、共用、错误、对账、完成） | admin 状态行 IA 仍按 R-04 交详设；各节 NOT_APPLICABLE_TO_CURRENT_ARTIFACT。 |
| UI §1～§10，含 §1.1/§1.2、线框/状态/owner/合理性等 | 没有提交新的 UI 工件；各节 NOT_APPLICABLE_TO_CURRENT_ARTIFACT，不声称逐屏通过。 |
| implementation design §0～§14，含 CP、§3a、§9a/9b、§10b、§11a、§13b/13c | 当前只提供详设输入，具体连接/观察链、预算、场景与 cleanup 留待授权后的详设；各节 NOT_APPLICABLE_TO_CURRENT_ARTIFACT，不以需求 GO 代替详设 review。 |

| 证据档位/范围 | 状态 |
|---|---|
| 当前文字、真实 Runtime 源码、RxJS 7.8.2 精确 tag | 静态已核对；不等于专项实现通过。 |
| 当前编译/测试已证 | 无，本轮未运行。 |
| F-1 | UNVERIFIED：测量、transform、Presentation/density、双屏真实输入与容差。 |
| F-2 | UNVERIFIED：具体连接实现、正常/异常恢复、主动停用、新旧身份与订阅失效。 |
| F-4a/F-4b | UNVERIFIED：关闭 no-op、静态页一致、注册/查询开销、agent/RxJS bundle 增量。 |
| R-17 前提链 | UNVERIFIED：在途最终源码、合法激活/店员 fixture、环境与 DEV/seed 准入。 |
| RxJS / driver ws | RxJS 无本仓解析项；ws 7.5.13/8.21.3 仅是既有锁项，不证明新 driver 已声明或实际解析。没有安装/解析新依赖，相关运行适配 OPEN。 |
| V-01～V-19 | 全部 NOT_RUN；表列 W/A/F 仅为计划执行面。 |
| 生成、编译、测试、verify、Web/Android/VM/DEV、reset/seed、L2、UAT、部署、business/cleanup | 本轮全部 NOT_RUN；没有引用历史运行冒充当前 PASS。 |

当前不存在需要 Dexter 追加产品裁决的 finding。批准的静态复核任务已完成；GO_WITH_UNVERIFIED_UI 仅针对该 SHA 的需求，不授权详设定稿、实施、规范修改、新增依赖或任何运行。既有不并行裁定和后续独立评审要求继续有效。
