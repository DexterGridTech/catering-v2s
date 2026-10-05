# TER automation-agent 最新正式需求 · RxJS 修复与 R-20 外部静态复评

```text
REVIEW_TARGET=DESIGN
ACTION_1_VARIANT=1-B 文档提取
reviewerKind=EXTERNAL_CLAUDE
SESSION_PROVENANCE=续接会话；从 catering-v2s 当前需求及 owning source 独立复核，不冒充 fresh 子 agent
REVIEWED_OBJECT=doc/plans/platform/2026-10-05-ter-automation-agent-formal-requirements-claude.md
REVIEWED_SHA256=2d2f1cef329c1df5fd1c454544079edbbe3acd6e2d2155db8d42703dfcef1d36
VERDICT=GO_WITH_UNVERIFIED_UI
M/S/N=0/0/3
L1_ENGINEERING=未发现阻断；三项 RxJS finding CLOSED；R-20 职责和可实施方向成立，三项非阻断文字建议见正文
L2_USER_VISIBLE=只核对需求约定；admin 状态行、真实输入、双屏、连接与订阅行为未验证
L3_UNVERIFIED=F-1、F-2、F-4a、F-4b、R-17 前提链；V-01～V-20 全部 NOT_RUN；新依赖未安装或解析
SAME_ROOT_SCAN=三项 RxJS 的正文/用法表/F/V；R-20 三组必选与三项可选、明确不用清单、V-20、非目标、成本和退出条件
DESIGN_GAPS=无新增需求级阻断；具体协议 schema、依赖解析、恢复管线与验收展开仍为后续详设工作
TEMPLATE_COVERAGE=四份后续工件模板逐节适用性见正文；当前对象是正式需求，不是详设定稿
EVIDENCE_TIER=当前仓内静态源码/文档与锁文件；RxJS 7.8.2 官方 tag；其他库官方资料/源码，版本匹配限制逐项披露
AUTHORITY=仅完成本需求静态评审；不重开内部 DESIGN cycle，不授权详设定稿、实施、规范修订、依赖变更或运行
```

**结论：GO_WITH_UNVERIFIED_UI，0M/0S/3N。** 三项 RxJS 问题已在需求源头关闭。R-20 对实际手写负担的划分合理，未发现需要改变产品语义的阻断；三处措辞应收敛，但不要求因此增加框架、依赖或验证批次。此结论不是专项实现或动态验收通过。

## 独立核验范围

- 以当前需求、Dexter 原话、TER 规范、技术栈裁定与 Runtime 源码推导行为，再对照上一轮 RxJS 评审和 intake；作者处置声明不作为独立证明。
- 使用本仓 `cs-review`、`cs-third-party-library-usage`。对有精确版本的 RxJS 核验官方 7.8.2 tag；R-20 尚无本专项依赖图，官方能力与仓内旧锁项分别判断，不把官方 master 或 npm 快照称为新包实际解析版本。
- 仅执行读取、搜索、SHA 校验及官方网页读取。未安装、生成、编译、测试、verify，未读 `.runtime/`，未启动任何动态环境。唯一写入为本评审文件；保留旧报告。

## 三项关闭情况

下表的 CLOSED 仅表示需求约定关闭，不表示行为测试通过。当前路径均从仓根打开。

| Finding | 状态 | 当前源头与独立核验 |
|---|---|---|
| RX-S-1 正常关闭不重连 | CLOSED | 正式需求 R-03 `:140`、R-19 `:445`、F-2 `:507`、V-03 `:531` 同时要求远端 complete/error 恢复、本地主动关闭/停用/销毁停止恢复。表中明确 resetOnSuccess 收到值才重置，不等于 open。RxJS 7.8.2 WebSocketSubject `:327–339`、retry `:98–110` 和 repeat `:143–156` 支持该区分。retry/repeat 组合或关闭归一化均可实现；具体重建和停止管线仍须详设与 proof。 |
| RX-S-2 dispatch 返回即结束观察 | CLOSED | 正式需求 R-07 `:205–209`、R-19 `:447`、V-07 `:535` 明确实际 journal 订阅先于 dispatch；分发返回不等于观察结束，超时 actor 迟到事件继续观察至有限期限或会话结束，多 actor 不因首个终态结束。`apps/terminal/kernel/base/runtime/src/foundations/createCommandActorDispatcher.ts:323–327`、`:413–423`、`:448–461` 证明超时后执行继续；`createCommandDispatcher.ts:631–680` 汇集 actor 结果并可先返回。 |
| RX-N-1 throttleTime 参数位置 | CLOSED | 正式需求 R-19 `:443` 使用 `throttleTime(t, asyncScheduler, {leading: true, trailing: true})`，符合 7.8.2 签名，配置位于第三参数。默认 trailing=false 的提示正确。auditTime 保留为详设候选，不冒充与 leading 初值完全等价。 |

官方依据：[WebSocketSubject 7.8.2](https://github.com/ReactiveX/rxjs/blob/7.8.2/src/internal/observable/dom/WebSocketSubject.ts#L327-L339)、[retry 7.8.2](https://github.com/ReactiveX/rxjs/blob/7.8.2/src/internal/operators/retry.ts#L98-L110)、[repeat 7.8.2](https://github.com/ReactiveX/rxjs/blob/7.8.2/src/internal/operators/repeat.ts#L143-L156)、[throttleTime 7.8.2](https://github.com/ReactiveX/rxjs/blob/7.8.2/src/internal/operators/throttleTime.ts#L53-L60)。

`defer` 仅推迟工厂执行到订阅，不能证明另一条 journal 流已经订阅；当前文字准确。`createRuntimeJournal.ts:21–23` 不回放旧事件，`createCommandDispatcher.ts:599` 同步发出 command.started。`types/journal.ts:46–51` 保留迟到事件类型。有限观察期限没有被冒充 Runtime 内置期限，明确交详设决定。

全文未发现现行要求仍使用 takeWhile“收到最终结果为止”、两参数配置的 throttleTime 或只用 retry 处理所有关闭。历史问题介绍中的这些词不算残留要求。

## R-20 的可行性与代价

| 范围 | 静态判断、依据及边界 |
|---|---|
| adbkit / driver，需求 `:478` | 设备列表和 reverse 可以复用库 API；shell 接受参数数组，可执行 input -d 与 dumpsys display。官方 DeviceClient 的 screencap() 不接 display 参数，不能把它当成多屏截图接口；需求已允许个别调用用 adb 参数数组补齐，所以不构成可达性阻断。shell 返回流，display 输出仍需 driver 有限解析，不会因采用库而消失。官方 master 的 package.json 标为 3.3.9，但未证明本仓将来安装的完整解析图。依据：[官方 README](https://github.com/DeviceFarmer/adbkit#deviceshellcommand)、[DeviceClient 源码](https://github.com/DeviceFarmer/adbkit/blob/master/src/adb/DeviceClient.ts#L171-L213)、[screencap 源码](https://github.com/DeviceFarmer/adbkit/blob/master/src/adb/DeviceClient.ts#L270-L285)。 |
| zod / agent 与 driver，需求 `:479` | 统一协议信封的运行时校验与类型推导是一段真实手写负担；只用于协议、不进入各业务 selector 参数描述，能保持依赖方向。`zod/mini` 官方提供 parse/safeParse 与按使用量裁剪，但其体积示例不是本工程 bundle 证明。一次定义两端共用可以在 agent/driver 既有范围内实现，不需另建通用 schema 平台；不要据此为 command payload 新增业务形状校验（R-07 `:217–219`、非目标 `:554`）。依据：[Zod Mini 官方说明](https://zod.dev/packages/mini)。 |
| pixelmatch + pngjs / driver，需求 `:480`、F-4a `:508` | PNG 解码与像素比较职责互补，官方 pixelmatch 示例直接组合两库。限于开关关闭的静态页一致性证明；遮罩、同尺寸输入和阈值依据仍须详设，不把它升级成通用视觉回归平台。依据：[pixelmatch 官方 API 与组合示例](https://github.com/mapbox/pixelmatch#example-usage)、[pngjs 官方 API](https://github.com/pngjs/pngjs#sync-api)。 |
| 可选 dequal、pino、execa，需求 `:486–488` | 可以按实际实现负担选择，不要求三者全装。JSON 值比较需要避免仅因对象键顺序而产生推送；dequal 是小的既有候选。结构化脱敏和受管资源回收仍由 R-13/AGENTS 约束；库不能替代 owner 与 cleanup 判定。execa 的版本/配置说明见 N-2。 |
| ws / driver，R-19 `:459–461` | RxJS webSocket 是客户端，driver 使用 ws 服务端再接入 RxJS 事件流合理，不需要用 adbkit、zod 或 RxJS 替代 WS 服务端。既有 ws 锁项不是新 driver 已声明的证明。 |
| 明确不用，需求 `:492–498` | 不引全 state 调试面、扩展 JSON 序列化、第二 ID 库或通用 RPC 框架，与现有边界一致。Flipper 理由应理解为内置集成已移除，不推断所有手工集成都不存在；不选它仍合理。Appium 的 full-tool 不选与 §3 `:502` 的“失败后交 Dexter 决定改方案”不冲突，后者不是当前授权 fallback。 |
| playwright 与 Vitest，需求 `:497` | 已重开 T-7 正本：`doc/review/platform/2026-08-28-newposv1-package-analysis-claude/00-ter-build-order-claude.md:824` 确为“单一测试 runner：vitest”，不是仅从笼统记忆推导。使用 playwright 浏览器控制库和 Vitest 旅途 runner 可分工；没有要求替换两个 admin 的 Playwright Test。新 driver 具体包版本、运行生命周期与超时仍未验证。 |

仓内锁项静态定位：`yarn.lock:14786`/`:14793` 为 zod 4.4.3/3.25.76，`:11585` 为 pngjs 3.4.0，`:6864` 为 dequal 2.0.3，`:7718` 为 execa 5.1.1，`:3328` 为 @playwright/test 1.61.1。当前 apps/terminal 与 tools 的 package.json 搜索没有上述新依赖声明。没有执行依赖解析；需求表的其他 npm latest、发布日期和可选版本不作为本轮实际解析或全部版本匹配证明。

## 非阻断 findings

### N-1 · V-20 的 agent 新增依赖范围应加限定

- **位置/证据**：正式需求 `doc/plans/platform/2026-10-05-ter-automation-agent-formal-requirements-claude.md:548` 写“agent 中只有 zod 这一项新增”；同文件 R-19 `:423` 强制 agent 声明 rxjs，R-20 `:486` 又允许 agent 选 dequal。
- **性质**：仓内文字事实；对验收读法的歧义推论，CONFIRMED。不是依赖已泄漏的实现事实。
- **触发/影响**：把 V-20 当作 agent 全部新增依赖的限制，会误拒 rxjs；即使限定为 R-20，仍可能误拒已允许的 dequal。三个“库”实际是三组能力、四个 package，也应明确而非用模糊数量判断。
- **最小修正**：改成“R-20 必选依赖中，agent 仅引 zod；R-19 的 rxjs 与 R-20 明确允许且在详设记录的可选依赖另计；adbkit、pixelmatch、pngjs 仅在 driver”。V-20 展开时核对实际使用，不仅声明；沿用 V-05/V-07 的协议错误路径和 F-4a，不新增第二套 gate。
- **严重度过滤**：正文职责和可行最小组合清楚，不需改变方案或用户裁定，故记 N。需要 Dexter 裁决：否。
- **同根扫描**：核对 R-20 必选三组、可选三项、R-19 依赖、§5 与§6。其余两项可选均在 driver；其余必选的放置无同类矛盾。

### N-2 · execa 不能无条件被描述为自带完整进程树回收

- **位置/证据**：同文件 R-20 `:488` 写“带进程树回收”，同时列旧锁项 5.1.1 与候选最新版本。R-13 `:308–313` 要求受控身份、资源回收及既有 lifecycle 迁移。
- **性质**：官方精确旧版本源码事实 + 对未限定版本/配置的表述建议，CONFIRMED；不宣称未来选定版本不支持树回收。
- **证据/反例**：仓内 5.1.1 的 cleanup 调 spawned.kill，不遍历后代；直接套用该锁项并等待父进程结束，不能证明 Expo/Gradle 后代全部退出。[execa 5.1.1 kill.js](https://github.com/sindresorhus/execa/blob/v5.1.1/lib/kill.js#L87-L98)。官方当前文档已有 killDescendants，但须显式配置且仍有进程组逃逸等限制；这个当前文档不能替代候选 10.0.1 或最终解析版本的依据。[官方 descendant termination](https://github.com/sindresorhus/execa/blob/main/docs/termination.md#killing-descendant-processes)
- **影响**：库收益说明易被读成选择 execa 后就不需要迁移受管 tree ownership/cleanup。
- **最小修正**：将用途改为“子进程执行与终止辅助；进程树回收按选定版本/配置核实，并复用既有受管身份与 cleanup”。不引新清理框架；不把未知进程交给库杀。
- **严重度过滤**：库是可选，R-13 仍明确要求真实 cleanup，没有授权绕过；当前没有漏杀实现或运行，故记 N。需要 Dexter 裁决：否。
- **同根扫描**：已核对 R-13、R-19 不能简化 lifecycle 的 `:458`、V-13 `:541` 和 execa fallback；其余要求保留实际回收责任。

### N-3 · “不做视觉比对”应注明 F-4a 的有限例外

- **位置/证据**：同文件 §5 `:558` 禁止视觉比对，R-20 `:480` 和 F-4a `:508` 又明确要求 pixelmatch 比较开关两构建静态截图。
- **性质**：仓内文字冲突，CONFIRMED；预期范围可从更具体条款直接推导。
- **影响**：按非目标字面裁剪验收时可能删掉 F-4a；反向也可能误把有限比对扩成全旅途视觉平台。
- **最小修正**：写成“不做通用视觉回归；仅保留 F-4a 的开关静态页像素比较”。不增加截图场景或产品行为。
- **严重度过滤**：F-4a 的范围、库和排除项已明确，收敛一句即可，故记 N。需要 Dexter 裁决：否。
- **同根扫描**：现行正式需求的视觉比对约定只有该非目标、R-20 与 F-4a；后两处一致。讨论稿的旧非目标以正式需求为准，不要求回写旧评审。

## 方案合理性

问题正确：库选择服务于既有“真实输入、定位、selector 观察、command 跟踪”的成本，不增加业务能力或远端脚本执行面。

方案合理：RxJS 管内部流，adbkit 管 ADB 操作，zod 管协议消息，pixelmatch/pngjs 管一个有限渲染不变断言。各项对应已有手写负担；driver 能承担的工具留在 driver，业务包不暴露 Observable 或 zod 描述。更小路线是暂不选可选库，复用既有脱敏、进程身份与 cleanup；确有少量深比较负担再按详设选择 dequal，无需创造通用平台。

代价相称但尚未量化：agent、rxjs 和 zod 会进入所有生产产物，这是已披露的真实代价；F-4b 的 automation-agent 总增量应包含全部所选 agent 依赖，不能只报 RxJS 一项。官方 Zod Mini 示例尺寸不替代本工程实测。三项 N 均是范围或能力说明，不构成借评审扩张实施的理由。

## 模板覆盖与设计缺口

当前为正式需求修复版，没有提交 Journey、IA、UI 或详设工件，不能以模板名称要求现在越权定稿。逐节适用性如下；后续具体 schema、管线、CP 和用例是授权后详设输入，不是本轮缺整节 finding。

| 模板逐节范围 | 当前判断 |
|---|---|
| Journey §1、§2、§3、§4、§5、§6（含6.1）、§7 | 各节 NOT_APPLICABLE_TO_CURRENT_ARTIFACT；需求 §0/§2/§7 已保留目标、原话、边界和裁定。 |
| IA §1、§2（含2.1/2.2/2.1.1）、§3、§4、§5、§6 | 各节 NOT_APPLICABLE_TO_CURRENT_ARTIFACT；admin 状态行 IA 仍是后续工件。 |
| UI §1（含1.1/1.2）、§2、§3、§4（含逐屏 roster/输入/搜索）、§5、§6、§7、§8、§9、§10 | 各节 NOT_APPLICABLE_TO_CURRENT_ARTIFACT；本轮不声称线框、屏幕或交互已通过。退役控制项不会恢复为准入门。 |
| Implementation design §0、§1、§2、§3、§3a、§4、§5、§6、§7、§8、§9、§9a、§9b、§10、§10b、§11、§11a、§12、§13、§13b、§13c、§14 | 各节 NOT_APPLICABLE_TO_CURRENT_ARTIFACT；R-19/R-20 给选型和来源要求，具体实施与验收须后续授权展开。 |

§3 `:515–518` 的首次动态前静态对账与 CP 完整退出仍分开；§7 `:599`/§8 `:611` 继续约束详设和实施均排在 Codex 在途批次之后。新增 R-20 没有删除这些条件，未发现六项旧问题回归。

## 未验证与完成边界

| 证据档位/项目 | 本轮状态 |
|---|---|
| 当前需求、Runtime、锁文件与官方源码 | 静态已核对；没有继承历史 GO 或作者 intake verdict。 |
| 编译/类型/测试已证 | 无。 |
| F-1 | UNVERIFIED：bounds、缩放、密度、副屏真实输入及容差。 |
| F-2 | UNVERIFIED：具体重连、主动退出、新旧会话身份与订阅释放。 |
| F-4a/F-4b | UNVERIFIED：关闭 no-op、有限静态像素比较、设备开销与所有 agent 依赖的 bundle 增量。 |
| R-17 前提链 | UNVERIFIED：最终在途源码、合法激活/店员 fixture、环境、DEV/seed 准入。 |
| RxJS、ws、R-20 全部拟用库 | 本专项未安装/解析；所选精确版本、Metro/Node 适配和实际调用仍 OPEN。官方能力存在性不等于仓内接线或最终版本证明。 |
| V-01～V-20 | 全部 NOT_RUN；W/A/F 只是计划执行面。 |
| 生成、构建、测试、verify、Web/Android/VM、DEV、reset/seed、L2、UAT、部署、business/cleanup | 本轮全部 NOT_RUN；不引用历史运行冒充当前 PASS。 |

当前静态评审批准任务已完成，无需追加 Dexter 产品裁决。本结论仅针对记录的 SHA；不授权详设定稿、实施、修改规范或依赖、任何动态运行，也不重开内部 DESIGN cycle。
