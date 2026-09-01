# TER `kernel.base.runtime` 需求文档独立评审

```text
REVIEW_CYCLE_ID=TER_KERNEL_BASE_RUNTIME_REQUIREMENTS_2026_09_01
REVIEW_TARGET=DESIGN
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
reviewerInputChecklistPath=doc/review/platform/2026-09-01-v2s-terminal-kernel-base-runtime-requirements-review-claude.md#输入清单
blindReviewDeclaration=目标需求文档在独立源码推导固化后才打开；未采信作者结论、既有 verdict 或聊天中的事实判断
```

## 结论

```text
REVIEW_TARGET=DESIGN
ACTION_1_VARIANT=1-B 文档提取
VERDICT=NO-GO
M/S/N=6/2/0
L1_ENGINEERING=NO-GO: 现行 catalog 裁定、生命周期顺序、三类状态边界、visibility、远端快照语义与 request ledger 有界性尚未形成可同时实施的需求闭包。
L2_USER_VISIBLE=NOT_APPLICABLE_WITH_REASON: 本批是无用户可见界面的 kernel runtime 需求评审，不包含 Journey、页面或浏览器行为。
L3_UNVERIFIED=未运行测试、构建或动态环境；peer 正常有连接但永久不返回时的终止策略、visibility 产品边界、远端快照 owner/session/freshness 仍缺冻结输入。
SAME_ROOT_SCAN=PASS_WITH_FINDINGS: 已不截断扫描 runtime-shell-v2、execution-runtime、topology-runtime-v3、当前 TER contracts/platform-ports/state/runtime、规范正本及有效项目记忆。
DESIGN_GAPS=动态 catalog 与现行裁定冲突；生命周期事实顺序错误；命令进度/命令终态/请求终态三类状态混用；visibility 未覆盖公共本地入口；快照把整条替换误称合并且无 freshness；request ledger 无 retention；actor 超时后的副作用语义未定；local-only routeContext 的 wire 边界未写。
EVIDENCE_TIER=STATIC_SOURCE_ONLY: 当前仓与只读 POC 源码、规范和项目记忆；无测试、构建、设备或运行证据。
```

该需求尚不能进入详设。阻断不是因为能力“没人调用”，而是因为若按当前文字实施，会同时违反现行裁定、实现错误的生命周期与状态模型，并留下数条“门与测试全绿但 runtime 仍不成立”的路径。

## 方法与输入清单

### 读序

1. 未打开目标需求，先从 POC 与当前 TER 字节独立推导 runtime 的职责、模型、跨机路径、状态聚合、生命周期与缺陷。
2. 将独立推导固化后，才打开目标需求逐节对照。
3. formal verdict 由 fresh 独立子 agent 形成；作者会话只做源码交叉核验、去重和证据分级。
4. 全部否定式判断使用不截断搜索，并回到 owning source 逐行确认；未使用 `head` 截断全称结论。

### 输入清单

- `AGENTS.md`
- `PLATFORM-BLUEPRINT.md`
- `doc/platform/README.md`
- `doc/platform/roadmap-program-registry.json` 与所选 Roadmap 授权字段
- `CLAUDE.md`
- `doc/platform/review-standard.md`
- `doc/platform/terminal-coding-standard.md`
- `project-memory/index.md` 全部 kernel 及六维路由命中原文
- `project-memory/decisions/deterministic-context-only.md`
- `project-memory/decisions/terminal-architecture-and-stack-rulings.md`
- `project-memory/decisions/terminal-build-order-and-batches.md`
- `project-memory/operations/terminal-coding-standard.md`
- `doc/review/platform/2026-08-28-newposv1-package-analysis-claude/00-ter-build-order-claude.md`
- `apps/terminal/kernel/base/contracts/src/**`
- `apps/terminal/kernel/base/platform-ports/src/**`
- `apps/terminal/kernel/base/state/src/**`
- `apps/terminal/kernel/base/runtime/src/**`
- `../newPOSv1/1-kernel/1.1-base/runtime-shell-v2/src/**`
- `../newPOSv1/1-kernel/1.1-base/execution-runtime/src/**`
- `../newPOSv1/1-kernel/1.1-base/topology-runtime-v3/src/**`
- 在上述独立推导之后读取：`doc/plans/platform/2026-09-01-v2s-terminal-kernel-base-runtime-requirements-claude.md`

## 独立推导基线

### 1. 两个 POC runtime 是两个模型，不是简单重复

`runtime-shell-v2` 是“一条命令广播到多个 actor、逐 actor 结果聚合、request ledger、peer gateway、模块生命周期”的应用运行壳。actor 先按 order 排序，再由 `Promise.all` 并发执行；order 只决定启动顺序。

`execution-runtime` 是“一条 commandName 对一个 handler、洋葱 middleware、child dispatch、有界 journal”的执行内核。重复 handler 注册会失败，它没有多 actor 广播、peer target、request ledger 或模块生命周期。

因此最小合理方向是保留一个 shell actor 模型，吸收 middleware、错误归一化、命令作用域日志和 bounded journal；不能把两个生产 runtime 并存。目标文档这一总体方向成立。

### 2. 跨机相关共有三个不同粒度的形状，但并非三条都已生产闭合

1. 主动 peer command dispatch：本机先登记 request/command，再经 gateway 发单命令；远端终态作为 synthetic actor 结果回填。这条 POC 生产链已接。
2. request lifecycle snapshot：形状是整 request 快照。POC `sendRequestSnapshot` 只有接口与 socket 转发，未检出生产 producer；接收端写 topology 的 request-mirror slice，不写 runtime ledger。因此它不是已闭合的生产链。
3. command event：accepted/started/resultPatch/completed/failed 的远端命令级事件，用于 pending peer command 的进度与终态回传。

当前 TER contracts 又明确把 `CommandRouteContext` 标为 local-only，并把跨节点 command envelope 推迟。因此 runtime 可以冻结本地插槽或本地进度输入，但不得把 local-only context 或尚未存在的 wire envelope 偷渡为已冻结传输契约。

### 3. contracts 的义务与 runtime-owned 类型必须分开

contracts 的 `AppModuleCommandDescriptor` 是装配/内省清单；runtime 的可执行 command definition 才拥有 timeout、target、reentry、allow-no-actor 等执行策略。contracts 的 request snapshot、branded IDs 和 module descriptors 是 runtime 的消费输入，但 actor result、middleware context、mutable ledger record、command aggregate/query status、journal event 等应由 runtime 自己拥有，除非确有跨包共享或 wire 证据。

### 4. actor 排序、并行、超时与重入

- 排序只决定 `map` 的启动次序，不提供前一个 actor 已完成的 happens-before 保证。
- `Promise.race` 只停止等待，不取消 handler；超时后的 handler 仍可能继续调用 `dispatchAction`、platform ports、child dispatch、flush 或 request reset。
- POC 的重入键是 `(requestId, commandName, actorKey)`，实际含义是“同 request 下该 actor 已在运行”，不只是递归。
- POC peer pending map 在正常有连接但对端永不返回时没有自身 timeout；只有断连时批量 reject。

### 5. catalog POC 的确有覆盖缺陷，但 TER 的现行裁定先删除整项能力

POC 的启动顺序会在 hydrate 之后用 default 无护栏覆盖 remote/host 条目，作者对这个 POC 缺陷的源码推理成立。但当前 TER 的有效建设裁定已经删除动态 error/parameter catalog、两个 runtime slice、resolver、TDP bridge 与 topics。不能绕过该裁定，以“contracts 里还有三值 source”反推本批必须恢复已删除能力。

## Findings

### M-1 · §2.4、§5.9、§7.2、§8：恢复动态 catalog 与当前有效裁定直接冲突

**分类：CONFIRMED；事实类型：仓内有效裁定事实 + POC 外部事实 + 产品/范围判断。**  
**需 Dexter 裁决。**

**事实与证据：**

- 目标要求实现 error/parameter 两个 catalog slice、default/remote/host 覆盖、解析与持久化，并把它作为 runtime `owner` 的实质内容。
- 当前有效建设顺序正文与项目记忆已明确删除动态 catalog、两个 runtime slice、resolver、TDP bridge/topics；contracts 中保留类型不自动恢复被删除的产品能力。
- POC 的 default 覆盖 remote/host 缺陷确实存在，但“POC 能力实现有缺陷”不能推导出“TER 已重新批准该能力”。
- 若继续删除 catalog，骨架规格把 runtime 标为 `plannedKind: owner` 又失去 owner slice 依据；此时它更像 toolkit，或必须由另一个已批准 slice 重新证明 owner 身份。

**后果：**按目标实现会违反现行 owning decision；按现行裁定实现又会缺少目标交付物、测试与 `plannedKind: owner` 的成立依据。两条互斥实现都能从仓内材料自称正确，无法进入详设。

**最小修复：**由 Dexter 在两支中明确选择：

1. 保持现行裁定：从本需求删除 catalog slice、bootstrap、resolver、远端覆盖、持久化及其测试；同步把 runtime 的 `plannedKind` 改为 toolkit，除非另有真实 owner slice。
2. 实质性恢复动态 catalog：以新的 superseding decision 明确产品场景、owner、权限、TDP 输入、持久化/失效和测试边界，并同步更新建设裁定与项目记忆。

只引用 contracts 的 source 闭集不足，因为类型存在不等于功能已获授权。

### M-2 · §2.8、§5.11：把五个动作称为“四阶段”，且顺序不符合 POC 与当前 TER state 生命周期

**分类：CONFIRMED；事实类型：POC 外部事实 + 当前 TER 源码事实。**

**事实与证据：**

- 目标写 `preSetup → 恢复 state → 注册 catalog → install → initialize`，称为“四阶段”。这是五个动作。
- POC `runtimeLifecycle.start()` 的真实顺序是 state hydrate → module install → catalog bootstrap → initialize；`preSetup` 不在该 start 方法内。
- 当前 TER `createStateRuntime()` 在异步 factory 内完成 hydrate 后才暴露 store/runtime，runtime 不应再设计一个对已暴露 store 的二次“恢复 state”阶段。
- 目标“catalog 在 install 前”的依据与 owning source 相反。

**后果：**模块 install 的可用前置、catalog 能否读取 module definitions、state 对外可见时间都会被写反；实现者无法同时满足源码事实与需求文字。

**最小修复：**先按当前 TER 重新命名和冻结阶段。若 M-1 选择删除 catalog，最小形态是：外部/装配 preSetup（如仍需）→ await state runtime factory/hydrate → module install → initialize broadcast。若仍恢复 catalog，则必须说明它为何在 install 前可获得完整模块定义；否则保持 POC 的 install 后 bootstrap。不要用“四阶段”包住五个动作。

### M-3 · §2.3、§5.2、§7.1、§8.8：把三类状态的职责和值域混在一起，并错误要求 contracts 新增五态命令聚合

**分类：CONFIRMED；事实类型：POC 外部事实 + 当前 contracts 源码事实 + 类型边界推论。**

**事实与证据：**

- POC 的 actor 结果聚合 `CommandAggregateStatus` 是四个终态：completed/error/partial-failed/timed-out；`RUNNING` 属查询视图，不是聚合终态。
- 五态应是 runtime-owned 的 `CommandQueryStatus = running + 四终态`；Dexter 已裁定的 `RequestLifecycleStatus` 是请求级五态。
- 当前 TER 的六态 `CommandLifecycleStatus` 属 request snapshot 中单 command 的生命周期进度，不是 POC `CommandEventEnvelope.eventType`。POC wire command event 是 accepted/started/resultPatch/completed/failed，当前 TER 又没有 `CommandEventEnvelope`，因为跨节点 envelope 已推迟。
- 目标据此要求 contracts 新增“命令聚合五态”、导出 74→75，并把六态称为跨机事件线格式；两点均不由当前 owning source 支持。

**后果：**running 被写成终态、request snapshot 状态被冒充 wire event、runtime 内部状态被提前抬升为共享契约；未来 topology 接线仍会重新定义真实 wire shape。

**最小修复：**保持三个清楚边界：

1. contracts `CommandLifecycleStatus` 六态：仅用于现有 request snapshot command progress，暂不冒充 wire event。
2. runtime `CommandAggregateStatus` 四终态。
3. runtime `CommandQueryStatus` 五态，及 contracts `RequestLifecycleStatus` 五态。

只有 RequestLifecycleStatus 的已裁定扩容进入 contracts；不要因为 runtime 内部查询状态而自动把公开导出从 74 增到 75。若确需跨包共享命令查询态，另给真实消费者与边界证据。

### M-4 · §7 visibility：只拦 peer 仍让公共本地 dispatch 成为 internal 命令旁路

**分类：CONFIRMED；事实类型：POC 外部事实 + 当前 API 边界推论 + 产品语义判断。**  
**需 Dexter 裁决。**

**事实与证据：**

- POC 声明了 `public | internal`，但 dispatcher 未执行它；目标正确识别了这一缺陷。
- 目标只确定 peer 不得派发 internal，把 UI/automation/introspection 留作后续判断。
- runtime 的本地公共 `dispatchCommand` 本身就是共同入口；若不在 runtime 层定义 caller boundary，UI、automation、直接 module import 或未来调试入口仍可从本机发起 internal。候选不止文档列出的三类。

**后果：**peer 门绿并不意味着 internal 真正不可外部调用；权限语义被分散给尚未建立的上层调用方，internal 仍只是注释。

**最小修复：**冻结 runtime 层可执行语义，而非仅枚举 UI 产品入口。候选最小规则是：actor/runtime 内部管道可调用 internal；peer、UI、automation 与外部 introspection 不可调用；公共 dispatch 必须携带或由入口固化可信 caller class。若 Dexter 不批准 caller 分类，则本批不得声称 visibility 已执行，应把这项能力整体推迟而不是只做 peer 特例。

### M-5 · §2.3、§4.5、§5.7、§8.6：把整 request 替换误称“逐 command 合并”，且没有 freshness/conflict 规则

**分类：CONFIRMED；事实类型：POC 外部事实 + 失败路径推论。**  
**需 Dexter 裁决本批是否保留该入口。**

**事实与证据：**

- POC `applyRequestLifecycleSnapshot` 先把 `snapshot.commands` 映射成一个新 commands map，再直接 `records.set(snapshot.requestId, record)`；它不是按 commandId 与现有 record 合并。
- 实现没有比较 snapshot/request/command 的更新时间、revision、session 或 owner。
- 目标只要求 duplicate commandId 幂等，不能拦截旧整包覆盖新整包，更不能证明“重连全量、心跳增量”两种语义兼容。POC 也未证明 request snapshot 生产发送链已闭合。

**后果：**乱序旧快照可以把 completed/error/timed-out request 回退成 started；不同 session 的同 requestId 可能互相覆盖。当前判据全部通过仍会得到错误台账。

**最小修复：**右尺寸优先选择以下一支：

1. 推荐：本批推迟 request snapshot apply，把它与 topology/session 的真实 owner、顺序和重连语义一起设计；runtime 只保留本地 ledger 与 peer command result 插槽。
2. 若本批必须保留：明确快照是 authoritative full 还是 partial merge；冻结 owner/session/freshness source 与冲突规则，并覆盖 duplicate、out-of-order、terminal-not-regressed；只有显式允许 partial snapshot 才测试 partial merge。

只增加“同 commandId 重复两次”测试不足，因为失败根因是无版本的整条替换。

### M-6 · §4.4、§5.7、§8：request ledger 是无界 Map，违反 TR-07 的终端长期运行约束

**分类：CONFIRMED；事实类型：规范事实 + POC 外部事实 + 运行风险推论。**

**事实与证据：**

- 目标明确 journal 有界，却只说 request ledger 是“内存 + query/subscribe”，没有 Bounded 形态、数量/时间上限或淘汰语义。
- POC request records 与 listeners 都是 Map/Set，除 reset 外不会裁剪；execution journal 反而有默认 1000 条上限。
- TR-07 要求集合在设计期选择 One/Page/Cursor/Bounded/Detail，终端长运行不能依赖无界集合。

**后果：**门店终端越运行 records/command details 越大，query、subscription replay 与内存逐步退化；最终问题会表现为“越用越卡”，而不是一次明确失败。

**最小修复：**把 ledger 明确为 Bounded：running request 不按普通终态策略淘汰；terminal request 按最大数量或最大年龄裁剪；定义 query 已淘汰 request 的结果、subscriber 初始 replay 范围、reset 与 listener cleanup。测试覆盖超限淘汰、running 不被淘汰、淘汰后 query 与订阅行为。

### S-1 · §2.5③、§5.2、§8：actor 超时后的运行与副作用语义被识别，但未裁定、未交付、未测试

**分类：CONFIRMED；事实类型：POC 外部事实 + 运行语义推论。**  
**需 Dexter 裁决。**

**事实与证据：**

- 目标准确指出 `Promise.race` 不取消 handler，但只给“README 接受”或“超时后 dispatch 丢弃”两个方向，未选定。
- actor 持有的不只是 `dispatchAction`，还可能持有 platform ports、child dispatch、flush persistence、request reset。只包一层 dispatch 不能隔离所有晚到副作用。
- 静默丢弃 dispatch 又会制造“调用看似成功但状态没写”的 TR-02 类问题。

**后果：**命令已记录 timed-out 后，actor 仍可能写 store、调用 native port、发子命令或请求 reset；相同测试在快慢机器上可能产生不同最终状态。

**最小修复：**在需求阶段选择并冻结可观察语义。可选方案不止两种：

1. observational timeout：超时只是调用方停止等待，late completion/side effect 被允许且必须结构化记录；
2. runtime-mediated fence：超时后所有 runtime 提供的写入口返回 typed failure/抛明确错误，不静默丢弃；外部 port 副作用仍需声明不可撤销边界；
3. cooperative AbortSignal：作为协作式取消，明确 actor 忽略 signal 时不保证停止；
4. staging actor writes until success：隔离最强但代价最高，当前阶段需证明收益。

选择后必须有超时后的 late dispatch/child/reset/port 边界测试；只写 README 不足。

### S-2 · §2.3、§4.5、§5.8：未承接 `CommandRouteContext` 的 local-only 契约，未来 gateway 容易直接跨 wire

**分类：CONFIRMED；事实类型：当前 contracts 源码事实 + 边界风险推论。**

**事实与证据：**

- 当前 contracts 注释明确：`CommandRouteContext` 是本地路由上下文，在 dedicated serialization/compatibility review 前不得跨 wire。
- 目标延续 POC peer gateway 概念，又把六态生命周期称作远端线格式，却没有写 routeContext 在 runtime gateway 的截断/转换边界。
- 当前 TER 尚无已批准的 command dispatch/event wire envelope。

**后果：**详设可能直接复刻 POC，把 local-only context 放进未来 topology envelope，绕过专门的兼容性与隐私审查。

**最小修复：**明确 runtime gateway 只消费本地 route context；传输半边不得复用它。未来 topology 必须映射到另一个经过专门审查的 wire-safe context。若本批需要 remote progress 输入，定义 runtime-local 输入类型并注明它不是 transport envelope。

## “全部判据通过但 runtime 仍没建成”的路径

1. **旧快照回退：**重复快照幂等测试全绿，但较旧 snapshot 整条覆盖较新的 terminal request。
2. **超时后晚写：**聚合正确返回 timed-out，测试全绿；后台 actor 随后仍 dispatch、发子命令或 request reset。
3. **无界增长：**所有功能测试与 bounded journal 测试全绿，但 request Map 长期开机无限增长。
4. **错误 authority 下的正确实现：**catalog 覆盖与持久化测试全绿，但实现的是现行裁定已经删除的产品能力。
5. **internal 本地旁路：**peer 对 internal 的拒绝测试全绿，但公共本地 dispatch 仍可被 UI/automation/直接模块调用。

## 对目标重点问题的直接回答

- **§2.3 三条路径：**三种形状属实，但只有主动 peer dispatch 是生产闭合链；request snapshot 发送与 runtime ledger 接收并未闭合。本批“只做合并半边”仍过宽，至少要推迟无 session/freshness 的 request snapshot apply。
- **§2.5 timeout：**“接受”与“丢 dispatch”不穷尽，且后者只挡 Redux 写；还存在 observational、runtime-wide fence、cooperative cancellation、staging。需 Dexter 决定语义。
- **§2.4 catalog 覆盖：**POC 推理成立；但它先被现行 TER 裁定删除，因此不能作为本批恢复能力的依据。
- **§7.1 三个枚举：**三种概念不能合并，但值域应是六态 snapshot progress、四态 command terminal aggregate、五态 command query、五态 request aggregate；目标把 command aggregate 写成五态并抬到 contracts 不成立。
- **visibility：**本批只做 peer 不足；应在 runtime 公共入口冻结 caller boundary，或整体推迟，不应交给多个未来调用者分别猜。
- **模块阶段：**当前文字不成立；preSetup 不在 POC start 内，catalog 真实顺序在 install 后，当前 TER state 又已把 hydrate 收进 async factory。
- **latest-wins：**`screenState`、`overlayState`、`uiVariableState` 都存在 updatedAt 比较，证明产品上存在新旧值竞争，但不足以证明必须抽象成 state 基础能力。当前 state 的 authoritative directional sync 裁定不应在 runtime 批擅自重开；保留为后续真实消费者批次的重新判断项是合适的。

## 独立推导出来、目标文档没有的内容

1. **request ledger retention 是一等设计问题。**目标给 journal 上限，却遗漏更大的 request/command 明细 Map；这是长期 POS 最现实的退化面。
2. **request snapshot POC 并未生产闭合。**有接口和接收镜像不等于 runtime ledger 已接线；不能把未闭合遗产当作必须继承的事实。
3. **peer pending 正常无响应没有 timeout。**断连会 reject，但连接保持时对端沉默可以永久挂起；后续 topology 接线必须与 runtime timeout 边界一起处理。
4. **`autoStart` 若沿用 POC 的 `void start()` 会违反 TR-02。**最小方案是不提供 fire-and-forget autoStart，要求装配方 await 明确的 start 结果；本需求尚未写这条。
5. **journal 与 ledger 必须由同一个状态转换 owner 派生。**否则命令事件日志与 request 查询会形成两套事实；需求虽说两者都建，但未明确单一 transition source。

这次确实从过去的“砍太多”摆到了局部“留太多”：动态 catalog 是已被裁定删除的能力；无 session/freshness 的 request snapshot merge 与尚不存在的 remote command event wire shape 也被过早拉进本批。另一方面，bounded ledger、visibility 的本地入口边界和 timeout 后副作用反而保留得不够。这不是简单删减数量，而是应保留已证明的本地 runtime 核心，推迟依赖 topology/session/wire 语义的半成品。

## 已确认成立、无需因本轮 finding 回退的部分

- shell actor 模型与 execution middleware/normalization/journal 的单 runtime 合并方向。
- actor order 只保证启动顺序，不保证完成顺序。
- reset 采用“actor 请求，命令完成后执行”的两段式。
- 本批不做 transport、session、reconnect 与具体 middleware。
- `dispatchAction` 只交给 actor，作为 TR-01 的关键执行边界。
- request ledger 不进 Redux、不持久化；这不等于它可以无界。
- command journal 必须有界。

## 未核边界

- 未运行任何测试、构建、typecheck、Expo、设备或动态命令；本轮授权禁止动态运行。
- 未用真实 topology/transport 验证网络乱序、重连、peer 永久无响应与 session 更换；相关结论均来自静态 shape 与缺失边界，已按 UNVERIFIED/需裁决表达。
- 未查外部平台或库文档；本轮 verdict 不依赖会漂移的外部事实。
- 本批非 UI，IA 与 browser L2 均 `NOT_APPLICABLE_WITH_REASON`。

## 最小收口顺序

1. Dexter 先裁定 catalog 是否继续删除，并同步 runtime `plannedKind`。
2. 修正生命周期顺序与 state async factory 边界。
3. 分开 command progress、command aggregate/query 与 request aggregate 类型；撤销无证据的 contracts 75 导出主张。
4. 裁定 visibility caller boundary 与 timeout 后副作用语义。
5. 决定 request snapshot apply 是推迟还是补齐 owner/session/freshness；补 request ledger retention。
6. 写死 local-only routeContext 与未来 wire-safe context 的转换边界。

在上述 M 闭合前，需求不得进入详设或实施。

---

# Round 2/2 · 定向复核（hard stop）

```text
REVIEW_CYCLE_ID=TER_KERNEL_BASE_RUNTIME_REQUIREMENTS_2026_09_01
REVIEW_TARGET=DESIGN
REVIEW_ROUND=2
REVIEW_ROUND_LIMIT=2
ROUND_FINAL_DECISION=SELF_DECIDED
reviewerKind=INDEPENDENT_SUBAGENT
reviewerInputChecklistPath=doc/review/platform/2026-09-01-v2s-terminal-kernel-base-runtime-requirements-review-claude.md#round-22-输入与方法
blindReviewDeclaration=fresh reviewer 未采信 Round 1 verdict 或作者处置结论；先回到当前 owning source 与 Dexter 冻结输入，再对当前 909 行目标逐条证伪
```

## Round 2 结论

```text
REVIEW_TARGET=DESIGN
ACTION_1_VARIANT=1-B 文档提取
VERDICT=NO-GO
M/S/N=6/3/1
L1_ENGINEERING=NO-GO: catalog 范围仍互斥；双 slice 的 writer-role、同 command 合并、restart/persist 语义未闭合；actor timeout 与非 JSON return 仍有静默错态路径。
L2_USER_VISIBLE=NOT_APPLICABLE_WITH_REASON: 本批是 kernel runtime 需求，不包含 UI/IA/Journey 或浏览器表面；request selector 的业务可读性作为 L1 contract 评审，不冒充 L2 运行证明。
L3_UNVERIFIED=未运行 typecheck、测试、构建或动态环境；type alias 对 StateJsonObject 的判断为静态源码推导；角色翻转、跨机同步与 restart 均无运行证据。
SAME_ROOT_SCAN=已核目标全文全部 catalog/ledger/sync/visibility/timeout/eviction/status 命中；已重开 current contracts/state、TR-01/TR-02/TR-04/TR-07/TR-09、build-order owning source，以及 POC dispatcher/ledger/topology command path。
DESIGN_GAPS=M-1 至 M-6 均在进入详设前必须由正文闭合或取得明确 Dexter 决策；S-1 至 S-3 需在 SELF_DECIDED intake 一并清理。
EVIDENCE_TIER=STATIC_SOURCE_ONLY: 当前仓字节、项目记忆、只读 POC 源码；无动态或用户可见行为证明。
```

本轮是同一 cycle 的第二轮硬上限，不再发起第三轮。六条 M 均是“不修不能进详设”的阻断项。

## Round 2 输入与方法

- fresh 独立子 agent 重新读取 `AGENTS.md`、蓝图、review standard、terminal 正本、deterministic context、verification governance、TER 架构与建设顺序记忆。
- 回源 current `contracts`、`platform-ports`、`state`、runtime skeleton，以及只读 POC `runtime-shell-v2`、`execution-runtime`、`topology-runtime-v3`。
- Dexter 本轮五条新裁定作为冻结输入，但作者对裁定的推论、§9 处置状态和 Round 1 结论均未直接采信。
- 主 agent 对 fresh findings 逐条做辩证 intake；未全盘接受 reviewer 的 severity，并补查 §5.1 全新双 slice 形状的同根问题。
- 本轮未运行任何动态命令、测试或构建；除本 review 文件外，仓内其余路径只读。

## Round 2 Findings

### M-1 · §2.4、§6、§7.2、§9：catalog 的当前范围仍互斥，且“查无裁定”的前提驳回不成立

**分类：CONFIRMED；事实类型：当前 owning decision + 文档内部矛盾。阻断详设：是。**

**事实与证据：**

- Dexter 新裁定与 §6 都写“catalog 本批不做”。
- §7.2 却仍写 catalog source/解析优先级是 runtime 的“实现义务”，§2.4 也保留 TER 应实现 bootstrap、覆盖与持久化的要求。
- §9 声称全仓查无“动态 catalog 已删除”裁定。实际 owning source
  `doc/review/platform/2026-08-28-newposv1-package-analysis-claude/00-ter-build-order-claude.md`
  §2 的 F1b 行明确写“动态 catalog 不做了”，§4B.8 又逐项删除 runtime 两个 catalog slice、
  resolver 的 catalog 查找、systemCatalogBridgeActor 与两个 TDP topic。
- `project-memory/decisions/terminal-build-order-and-batches.md` 的 sourceRefs 正指向该 owning source；
  作者只读 `TER_FOUNDATION_FIRST_THREE_BATCHES` 的压缩包清单，没有继续打开 assertion source 正文，因而形成假阴性。

**后果：**实现者仍可引用 §7.2 恢复当前明确不做的 catalog；同时 §9 把真实 owning source 误标为不存在，会继续污染后续 authority 判断。

**最小修复：**

1. 承认 Round 1 M-1 的 owning-source 前提为 `CONFIRMED`，更正 §9。
2. 删除 §2.4 中 TER catalog 要求；POC 缺陷可保留为历史分析，但明确本批不承接。
3. 把 §7.2 改为“contracts 遗留/未来类型说明，本批 runtime 不消费、不解析、不落 slice”；不得再写“当前实现义务”。
4. §8 明确本批不新增任何 catalog runtime consumer。

只在 §6 写“不做”不足，因为后文更具体的“实现义务”仍会驱动相反实施。

### M-2 · §5.1.1、§5.1.4b：两个单写者 slice 缺少 writer-role 的来源、生命周期与翻转协议

**分类：DEXTER_DECISION；事实类型：当前 state 能力事实 + 架构/产品语义。阻断详设：是。**

**事实与证据：**

- current state 只在 descriptor 上静态记录 `master-to-slave` / `slave-to-master`；
  `createFullSyncPayload` 与 `applyAuthoritativeSync` 不判断当前机器角色，真正“只能写哪一份”必须由 runtime/topology 另行执行。
- 当前 contracts 只有 local-only 的开放字符串 `CommandRouteContext.instanceMode?: string`，没有 runtime-owned 闭集角色类型，也没有 role-change API。
- 目标只说“当前 instanceMode 相符的 slice 可写”，没有说明角色由谁注入、在一个 runtime 生命周期内是否可变、翻转如何停写旧 slice/启写新 slice。
- §5.1.4b 又由作者自行判断“翻转丢在途记录可接受”，并明确若 Dexter 不接受才换设计；这不是已经取得的产品裁决。
- 若两端 replica 都是新鲜的，角色交接未必丢数据；若副屏断开后以陈旧 replica 升主，才会被 authoritative 覆盖。损失取决于 handoff/freshness，不是无条件事实。

**后果：**静态测试可以分别以固定 MASTER/SLAVE 全绿，真实角色切换时仍可能双写、停写、由陈旧副本接管，或让 running request 无状态消失。selector、journal 与淘汰语义都无法给出确定答案。

**最小修复：**由 Dexter 冻结一条右尺寸 transition：

- 最简单候选是“角色在单个 runtime 实例生命周期内不可变；翻转必须停止旧 runtime，完成有界 handoff/选择 authority 后，以新角色重建 runtime”。
- 若必须热切换，则需求必须定义 role-change command、旧 writer fence、authority freshness、running request 的 terminal/abandoned 结果、journal 事件和 selector 查询结果。
- 无论选哪支，都要定义闭集角色类型及 create/start 输入来源，不得依赖开放的 local routeContext string。

仅写“可能丢，通常重来”不足，因为它既未被 Dexter 接受，也没有可测试 transition。

### M-3 · §5.1.2、§8：同一 commandId 的两侧记录无法按当前单对象形状无损合并

**分类：CONFIRMED；事实类型：目标类型形状 + POC 外部事实 + 合并推论。阻断详设：是。**

**事实与证据：**

- 目标要求同一 commandId 两侧都保留，并把 `actorResults` 取并集，但合并结果仍只有一个
  `CommandExecutionRecord`。
- 两侧除 actorResults 外还各有单值字段：`target`、`allowNoActor`、`startedAt`、`completedAt`、
  `parentCommandId`、`commandName`。目标没有定义一致性约束或取值规则。
- POC 的真实 peer 路径已给出反例：发起侧记录 `target:'peer'`；接收侧通过
  `createRemoteCommandDefinition` 以默认 local 执行。同一 commandId 的 target 本来就可能不同，
  started/completed 时间也天然不同。
- `allowNoActor` 又是命令聚合输入；随意选一侧会直接改变零 actor 的 completed/error 结果。
- §8 的“actorResults 并集 + startedAt 保序”没有回答这些字段，也没有 node-scoped identity。

**后果：**实现者只能静默挑 MASTER、SLAVE、最早或最晚的一份；不同实现会给相同事实算出不同 command/request 状态。现有 happy-path 合并测试全绿也抓不到冲突字段。

**最小修复：**二选一：

1. 推荐保持事实不丢：以 commandId 分组，但保留 node-scoped execution observations，增加 executorNodeId；selector 在组上聚合，不把两侧压成一个单值 command record。
2. 若坚持单对象：逐字段冻结规则；身份字段不一致必须 typed conflict，startedAt/completedAt 明确 min/max，target 与 allowNoActor 明确取哪一个 authority，并以 nodeId+actorKey 去重。

只写“actorResults 取并集”不足，因为冲突恰好发生在并集之外的单值字段。

### M-4 · §2.5③：actor timeout 仍是推荐方案，不是已冻结运行语义

**分类：DEXTER_DECISION；事实类型：POC 源码事实 + 当前未决项。阻断详设：是。**

**事实与证据：**

- 文档仍写“四选一，我推荐 runtime 栅栏”，并明确 `DEXTER_DECISION` 与“未裁决前详设不得开工”。
- runtime fence 只能拦 runtime-owned dispatch/child/reset/ledger/journal，不能撤销已发生的 platform port 副作用；这条边界写得诚实，但不是决策本身。
- §8 只明确列出 peer gateway 永不 resolve 的 timeout，没有把 actor late dispatch、child、reset 与 late transition 作为完成判据。

**后果：**详设无法判断 timed-out 后 actor 的 late runtime calls 是 typed rejection、仅记录还是仍生效；ledger/journal 可能已终态后再次变化。

**最小修复：**Dexter 明确选择语义。若采用推荐支，写死：runtime-owned late effects 全部 typed reject 并记录；port side effect 明确不可撤销且不得声称已取消。§8 增四类 late-effect 正反断言。

README 的诚实声明只能说明 port 边界，不能替代 runtime-owned 行为决策。

### M-5 · §5.1.3：actor return 的 JSON-safe 校验没有失败语义

**分类：CONFIRMED；事实类型：当前 state contract + POC actor 类型 + TR-02。阻断详设：是。**

**事实与证据：**

- Dexter 要求 actor return 作为中间结果入台账；目标说“JSON-safe 校验后”写进 `StateJsonValue`。
- current state codec/sync 明确拒绝 NaN、Infinity、undefined、循环对象等非 JSON-safe 值。
- POC actor return 是宽形状，运行期仍可能返回 Date、函数、循环对象或非有限数字。
- 目标没有说明校验失败时 actor 是 error、result 被丢弃，还是 command 仍 completed。

**后果：**实现可以静默丢 result 而继续 completed，所有类型夹具全绿，但 Dexter 要求的中间结果没有被记录；也可能直到同步/持久化时才失败。两者都违反 TR-02。

**最小修复：**handler 公开返回类型收窄为 `StateJsonValue | void`，同时保留运行期校验；运行期发现非法值时该 actor 必须失败，request 聚合进入 error/partial-failed，journal 记录脱敏原因，不得 completed。§8 增非 JSON return red case。

仅靠 `type` 可赋给 `StateJsonValue` 的编译夹具不足，它验证的是记录类型，不是 actor 的真实返回值。

### M-6 · §5.1、§5.1.5：两个 slice 的 restart/persist 语义未决定，淘汰后的可判别查询还隐含第二个无界集合

**分类：DEXTER_DECISION + CONFIRMED；事实类型：current state descriptor contract + TR-04/TR-07 + 产品恢复语义。阻断详设：是。**

**事实与证据：**

- `StateRuntimeSliceDescriptor` 必须在 `persistIntent:'never'` 与 `owner-only` 中选择；目标完整定义了 sync，却全文没有决定两个 request slice 的 persistIntent。
- 若 `never`，进程/设备重启会丢失半小时窗口内的 request 过程；若 `owner-only`，必须定义两份 local/replica 的恢复、TR-04 restart 测试及角色翻转后的 authority。两支产品行为不同，详设不能自行猜。
- §5.1.5 又要求删掉记录后，query 仍区分“从未存在”与“已淘汰”。要做到这一点必须保留 evicted requestId marker。
- marker 若永久保留会重新形成无界集合；若也淘汰，则第二次淘汰后两者再次不可区分。目标没有声明 marker 的 Bounded 形态与可判别时间窗口。

**后果：**实现者可任选重启丢失或恢复；也可用无界 tombstone set 让所有测试短期全绿，却重新违反 M-6/TR-07 的原始目标。

**最小修复：**

1. Dexter 决定 request history 的 restart 语义，并据此钉死两个 descriptor 的 persistIntent。
2. 若 query 必须区分 expired，声明一个 bounded eviction-marker 形态及其保留时间/容量；超过该窗口后允许归一为 not-found，或改为不承诺永久区分。
3. persistence 与 marker 的正反恢复/上界进入 §8。

只把记录本身设半小时 TTL 不足，因为“已淘汰”的证明载体仍需要自己的生命周期。

### S-1 · §7 visibility：总体规则已闭合，但 `visibility?` 默认值与 no-request internal → public child 边界未写

**分类：PARTIALLY_CONFIRMED；事实类型：current contracts 可选字段 + 调用矩阵缺口。**

**事实与证据：**

- Dexter 的三条规则已足以避免 Round 1 那种泛化 caller taxonomy；这一处不再维持 M 级。
- 但 contracts 的 `visibility` 是可选字段，POC 默认 `public`，目标没有钉 TER 的 undefined 语义。
- actor full entry 可发子命令；当一个无 request 的 internal actor 发 public child 时，不能继承 requestId。目标没有明确必须 typed reject 或要求调用者显式提供已有 requestId。

**后果：**实现若把 undefined 当 internal，普通未声明 visibility 的命令可以无 request 绕过台账；无 request internal 也可能产生无 request public child。

**最小修复：**写死 `visibility ?? 'public'`；补四格规则：external/public 必须显式 request；internal 有 request 时 public child 可继承；internal 无 request 时 public child 必须显式提供合法 requestId，否则 typed reject；UI/automation/peer 永远不能走 internal entry。补两条 red fixture。

无需新增复杂 caller class；围绕 visibility、入口和 requestId 三项即可。

### S-2 · §2.3、§7.1、§9：`CommandLifecycleStatus` 仍被描述成跨机 wire event

**分类：CONFIRMED；事实类型：当前 contracts + POC 外部事实 + 文档残留。**

**事实与证据：**

- §9 已承认 POC `CommandEventEnvelope.eventType` 是 accepted/started/resultPatch/completed/failed，和六态不同。
- current contracts 的六态只被 `RequestCommandSnapshot.status` 使用。
- §2.3 与 §7.1 表仍写六态是“路径丙线格式/对端告诉我走到哪”，与本轮已撤销 CommandEventEnvelope 的范围冲突。

**后果：**实施者可能恢复一条已明确不建的 wire event path，或给六态错误的序列化责任。

**最小修复：**把六态描述为现有 request command snapshot/progress 类型；明确本批不定义 `CommandEventEnvelope`，不把六态当 wire event。

只在 §9 记录自我更正不足，错误陈述仍住在实现者会引用的主章节。

### S-3 · §5.1.5：淘汰一律“另发 internal command”比 TR-01 所需范围更宽

**分类：PARTIALLY_CONFIRMED；事实类型：规范事实 + 右尺寸判断。**

**事实与证据：**

- timer 不能直接 dispatch reducer action；timer 触发时必须发 internal command，这一半成立。
- 但若详设选择“每次已有 ledger 写入顺带清理”，当前 command 的唯一 transition/reducer 更新本身已经在 runtime 白名单和 command 路径内；再发一条嵌套 cleanup command 不是 TR-01 必需，还会给 journal 增加噪声并引入重入/排序问题。

**后果：**二选一看似开放，实际把 write-triggered 方案也强制成额外 command，增加无收益复杂度。

**最小修复：**按触发点分别写：timer 触发必须 dispatch internal cleanup command；write-triggered 可在同一 ledger transition 内原子删过期终态，不另发命令。两支都不得由任意 foundation 直接裸 dispatch。

### N-1 · §8 的“合并 selector 五种组合”实际列了六种

**分类：CONFIRMED；事实类型：文档计数。**

“只有一侧、两侧都有、同 commandId、终态+running、零 actor allowNoActor=true、零 actor allowNoActor=false”是六种，不是五种。最小修复是改为六种并在详设逐条给 case ID；不要把 true/false 压成一条而丢掉反向分支。

## 对作者重点问题的结论

### 双 slice 是否比 Map + request 专用同步更简单

**方向成立，但当前形状尚不能实施。**它复用 current state 的 record authoritative sync，避免 request 专用 snapshot/event 合并器，也保住两侧单写者；这比 POC Map + 专用跨机机制更小。阻断不在“要不要双 slice”，而在 writer role/handoff（M-2）、同 command 跨节点事实形状（M-3）与 restart/persist（M-6）尚未冻结。

### 四个记录必须用 type、不能用 interface

**静态判断成立。**current `StateJsonObject` 是索引签名 interface；对象 type alias 在已知属性均为 `StateJsonValue` 时可获得隐式索引兼容，而可声明合并的 interface 不获得该隐式签名。四个记录都应使用 type alias，并保留 typecheck fixture。由于本轮禁止 typecheck，此项证据档位仍是 STATIC_SOURCE_ONLY，不能声称已实跑。

### 角色翻转丢记录是否可以只写明

**不可以由作者自行接受。**而且“必然丢”也不是完整事实：replica 新鲜且 handoff 有序时可保留；断开、陈旧副本升主时才可能丢。应先由 Dexter 裁 transition/损失边界，再写 README。

### runtime timeout fence

**推荐方向合理，诚实声明 port 副作用围不住也是必要条件，但仍不够。**还必须取得 Dexter 决策，并把 runtime-owned late effects 的 typed rejection 和 transition/journal 行为写成完成判据。

### 淘汰与 TR-01

timer 触发必须经 internal command；write-triggered 可以复用当前 command 的同一 transition，不必人为再造嵌套命令。running 不淘汰方向成立，但角色翻转和 expired marker 生命周期必须先闭合。

## Round 1 6M/2S 闭合复算

| Round 1 finding | Round 2 判断 |
|---|---|
| M-1 catalog | **未闭合**：结果“不做”已裁，但 owning source 被误驳，主章节仍写实现义务（Round 2 M-1） |
| M-2 lifecycle | **闭合**：当前 TER 三阶段与显式 await 已改正；preSetup 如实 UNVERIFIED |
| M-3 状态类型 | **部分闭合**：contracts 75 主张已撤；六态 wire 解释仍残留（Round 2 S-2） |
| M-4 visibility | **部分闭合**：三条原始语义已冻结；默认值与 no-request child 缺口见 S-1 |
| M-5 snapshot merge | **闭合原 finding**：专用 snapshot/event 路径本批删除；新双 slice 合并自身另有 M-3 |
| M-6 unbounded ledger | **部分闭合**：record TTL/running 边界已补；persist 与 eviction marker 见 M-6 |
| S-1 actor timeout | **未闭合**：仍是待 Dexter 裁决（Round 2 M-4） |
| S-2 local-only routeContext | **闭合**：同步投影排除 payload/routeContext，§6 明确未来 wire-safe 类型 |

## 新的 false-green 路径

1. 固定 MASTER/SLAVE 的测试全绿，但真实 role flip 时两个 writer 同时写或陈旧 replica 接权威。
2. 合并测试只断言 actorResults 并集，target/allowNoActor/timestamps 冲突被静默选边，聚合仍错。
3. record type fixture 全绿，actor 运行期返回循环对象后 result 被静默丢弃而 command completed。
4. terminal TTL 测试全绿，evicted requestId marker 永久累积，系统仍无界。
5. 两个 slice sync 测试全绿，但 persistIntent 被任意选成 never，重启后半小时过程全部丢失。
6. public missing-request 门只测显式 public；undefined visibility 被当成 internal，或 no-request internal actor 发出 public child 绕过台账。
7. §6 不建 catalog 的测试全绿，但 executor 按 §7.2 又实现了 resolver/catalog consumer。

## SELF_DECIDED 收口要求

本轮是 Round 2 hard stop，不得再开启第三轮或更换 reviewer 重置 cycle。作者应做辩证 intake：

1. 六条 M 全部闭合或交 Dexter 作明确产品/运行语义裁决；任一未决都不得进入详设。
2. 三条 S 与一条 N 在同一次正文修订中清理，避免把已知歧义带入计划。
3. 按 `ROUND_FINAL_DECISION=SELF_DECIDED` 自行收口，并逐条说明接受、部分接受或有证据驳回；不得把本 review 自动当作产品裁决。

## 授权边界

本轮只评审需求文档。`NO-GO` 不授权详设、实施、修改 TER 源码或 contracts、动态运行、设备、DEV、seed、reset、浏览器 L2、UAT 或部署。静态判断不证明同步、角色翻转、restart 或用户可见 selector 行为已运行成立。
