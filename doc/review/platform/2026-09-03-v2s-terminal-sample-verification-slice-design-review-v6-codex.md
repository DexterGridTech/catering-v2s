# TER sample 验证切片 v6 需求复评（Codex）

```text
REVIEW_CYCLE_ID=2026-09-03-TER-SAMPLE-VERIFICATION-SLICE-DESIGN-01
REVIEW_ROUND=2
REVIEW_ROUND_LIMIT=2
ROUND_FINAL_DECISION=SELF_DECIDED
REVIEW_TARGET=DESIGN
ACTION_1_VARIANT=1-B 文档提取 + owning source 只读证伪
reviewerKind=INDEPENDENT_SUBAGENT
BLIND_REVIEW_REQUIRED=true
VERDICT=NO-GO
M/S/N=1/4/0
L1_ENGINEERING=findings
L2_USER_VISIBLE=findings
L3_UNVERIFIED=未运行测试、Expo Web、真实 Android 或任何动态环境；用户可见行为仍未验证
EVIDENCE_TIER=STATIC_SOURCE_REVIEW
```

## 评审范围与结论

评审对象是 `doc/plans/platform/2026-09-03-v2s-terminal-sample-verification-slice-requirements-claude.md` v6，结合 display-context owning requirement、当前 display-context/runtime 源码、TR-12 正本与 project-memory 指针做源代码优先复核。本轮没有修改需求、源码、测试或依赖。

W-7 的新方案成立：当前四个 display-context actor 已经是异步读取模式，v6 也清楚区分了宿主启动时的一次挂载决策与业务 actor 后续按命令各自实时读取；没有发现必须同步获取屏数的业务场景。D-2、D-3 作为不阻塞项的判断成立。S-4 的 `TER_KERNEL_UI_FEATURE_ONE_TO_MANY` 已收紧为单句指针，实际 memory 条目也只剩该指针。

但模块组装数量仍然自相矛盾，需求尚不能作为无猜测的详设基线，因此本轮 `NO-GO`。

## Findings

### M-1：`input.modules` 数量仍未对齐

状态：`CONFIRMED`。

原主张：v6 声称 §6.2a 的组装顺序与 §6.7 的九项 modules 清单是同一份数据。

反证：

- §6.2a 第 598–607 行实际列出 3 个 base descriptor、`displayContextModule`、`uiStateModule`、2 个 kernel feature module、2 个 ui feature module，算术和为 **9 项**。
- 同节第 608 行却写成“共八项传入 `input.modules`；`kernel.base.runtime` 自动加入第九项”。
- §6.7 第 867–879 行与 S-10 第 1073 行都按 **9 项显式 input module，另加 runtime 自动模块**书写。
- 当前 `apps/terminal/kernel/base/runtime/src/application/createRuntime.ts:190-196` 是 `[internalModule, ...input.modules]` 后立即解析；`apps/terminal/kernel/base/runtime/src/foundations/resolveModuleOrder.ts:37-43` 对缺失依赖直接抛错。因此实际是 9 项 `input.modules`、10 项含 runtime internal module 的 declared modules。

后果：实施者若遵循第 608 行会漏掉一个 descriptor；若遵循九项清单又违反同一节的数量声明。此处不是历史叙述差异，而是组装无法无猜测落地的硬矛盾。

最小修复：把第 608 行改为“共九项传入 `input.modules`；`kernel.base.runtime` 自动加入第十项”，并把 §6.7 标题明确成“`input.modules` 九项／运行时 declared modules 十项”。同时把“缺一即 `start()` 抛错”改成与源码一致的“缺失依赖在 `createRuntime(...)` 构造阶段直接抛错”，见 S-4。

### S-1：D-4 的非阻塞分类正确，但“零冲突”旧句仍未软化

状态：`CONFIRMED`，非阻塞但仍需文档同步。

原主张：v6 说已把 W-7 与 owner 约束的“零冲突”措辞软化为 D-4。

反证：v6 第 128 行仍保留“W-7 变成三个导出、零状态，与 owner 正式约束零冲突”；同一文档第 403–413 行又明确指出 owner 正式需求第 320–325 行把消费范围写窄为“只在 `setRuntimeInstanceMode` 的准入判据里读一次”，并登记 D-4。owner 文档后段第 501–505 行及当前四个 actor 则支持处理命令时实时读取的更宽模式。

最小修复：将第 128 行改为“行为形态不冲突，但 owner 正式文字存在 D-4 表述缺口”，并保留 D-4 为不阻塞项；后续由 Dexter 同步 owner 正式需求第 325 行。若 owner 文档暂不改，IA/详设必须显式引用 v6 对该旧窄句的覆盖关系。

### S-2：session restore 拆命令后，领域事件计数仍是旧口径

状态：`CONFIRMED`，不影响命令名称已列全，但会污染清单与验收口径。

反证：§6.3 第 639–643 行列出 5 条实际领域事件命令：`loginSucceededCommand`、`loginFailedCommand`、`logoutSucceededCommand`、`sessionRestoredAuthenticatedCommand`、`sessionRestoredAnonymousCommand`；第 645 行仍写“四条领域事件命令”。§7.1 标题第 975 行仍写“三条领域事件”，但第 979–983 行实际列出同样的 5 条。

最小修复：将第 645 行改为“五条具体领域事件命令”，将 §7.1 标题改为“五条领域事件命令的监听者”。如果想保留“事件家族”的统计，必须同时明确“四类事件家族、五条具体命令”，不能继续用“三条/四条”混写。

### S-3：S-15 把三枚 layer-only part 写成四枚

状态：`CONFIRMED`。

反证：§6.5 第 741–744 行的 `sample.auth.notice`，以及 §6.6 第 784–791 行的 `sample.desk.waiting-confirm`、`sample.desk.registry-notice`，是全部 8 个 sample part 中唯一 `containerKeys: []` 的三枚。`sample.desk.customer-member` 是 `containerKeys: ['main']`，且 §4.4 明确它在单屏确认态占满 PRIMARY，不是 layer-only part。S-15 第 1079 行却要求“四个层部件”。

最小修复：将 S-15 改为“三个 layer-only part”，并把三个 `partKey` 直接列出；这样用例不会要求实现者寻找不存在的第四枚部件。

### S-4：缺失 module 的抛错时机写错

状态：`CONFIRMED`。

原主张：§6.7 第 867 行写“缺一即 `start()` 抛错”。

反证：当前 `createRuntime` 在构造函数体内第 190 行组成 `declaredModules`，第 196 行调用 `resolveModuleOrder`，早于返回 `Runtime`；缺失依赖由 `resolveModuleOrder.ts:37-43` 当场抛出。因此没有机会先拿到 runtime 再调用 `start()`。

最小修复：将 §6.7 的失败条件和 S-10 负向夹具改为包裹 `createRuntime(...)` 的构造阶段；成功路径仍断言返回后的 `runtime.status === 'started'`。不要把这条事实改成 start 阶段行为。

## 已核对且不重新提出的事项

- 上一轮 M-1 的处理方向成立：不为 owner 文档的旧窄句改造 W-7；W-7 继续使用三个无状态导出，D-4 只作为 owner 文档精确化欠账。
- 上一轮 M-3 的共享清单方向成立，但必须先修复上面的 9/8 算术矛盾，修后才能称为两处同一口径。
- W-7 的宿主一次读取与 actor 后续读取是两次独立求值，见 v6 第 385–397、896–903 行；未发现必须同步读取的场景。进入 IA 时应具体说明 Expo 的异步 bootstrap 如何发生在 `SurfaceRoot` 挂载前，不得把异步读取写进需要同步返回 React element 的组件函数；这属于实现接缝澄清，当前不单独计为 M。
- D-2 的 README 反例与 D-3 的 base descriptor 长期归属都已明确标为不阻塞，且本轮不需改变 sample 的行为方案。
- 上一轮 S-4 的 project-memory 处理已闭合：`project-memory/decisions/terminal-architecture-and-stack-rulings.md:36` 只有 `见 ... TR-12`，与 v6 第 140 行一致。
- 独立审查中提出的“`createCommandDispatcher.ts` 未写完整目录”不构成 finding：当前 `apps/terminal` 下该文件只有 `apps/terminal/kernel/base/runtime/src/foundations/createCommandDispatcher.ts` 一处，路径无歧义。

## Same-root scan

- module 数量：已核对 §6.2a、§6.7、S-10 及 `createRuntime`/`resolveModuleOrder`，9 项 input 与 runtime internal 的 10 项总数冲突仅此一处，但为 M-1。
- session restore 命令：已核对 §6.3 命令表、§6.5/§6.6 actor 表、§7.1 监听者表、§7.2 链路表；具体命令没有漏掉，残留的是三条/四条统计文字。
- part 容器归属：已核对两个 ui/feature 的全部 8 个 part；layer-only 只有 3 个，S-15 的“四个”是唯一计数错误。
- W-7 时序：已核对正式 owner 第 320–325、487–505 行、四个 actor 与 v6 第 370–413、896–903 行；宿主启动读与命令处理读没有被重新混成一次。
- memory pointer：已核对 assertion 注册表、memory 条目和 v6 §2.4；没有发现第二份新加的 TR-12 规则复述。

## Unverified inventory

- 静态已证：上述文档矛盾、当前 runtime 的 module 解析阶段、当前 display-context 的 actor 异步读取、当前 memory 指针形态。
- 测试已证：本轮没有运行任何测试，因此没有测试已证项目。
- 无人验证：真实 sample 组装、Expo Web 的挂载、单双屏旅途、React/Android 用户可见结果、全部 red mutation 与测试收集结果。

## Authorization boundary

本轮只完成需求 review。`NO-GO` 仅表示 v6 需修订 M-1 后再进入详设；不授权修改需求、源码、测试、依赖，不授权详设、实施、DEV、seed、L2、UAT 或部署。

按仓内 review governance，本文件仍记录为该 cycle 的 `REVIEW_ROUND=2/2` 与 `ROUND_FINAL_DECISION=SELF_DECIDED`；这不是对后续所有需求讨论的永久禁止，但同一 cycle/target/批准范围不能伪造第三轮，除非 Dexter 实质改变目标、范围或授权。
