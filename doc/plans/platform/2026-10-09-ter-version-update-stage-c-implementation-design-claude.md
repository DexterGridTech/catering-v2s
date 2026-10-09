# TER 版本定义、完整更新与热更新：阶段 C 详设

## 0. 状态、原始目的与本轮授权

STATUS=REVIEWABLE_DRAFT；DESIGN_STATUS=EXTERNAL_REVIEWED_AUTHOR_REVISED；AUTHOR_SESSION=续接作者会话。
REVIEW_CYCLE_ID=ter-version-update-stage-c-design-2026-10-09；REVIEW_TARGET=DESIGN。
COST_SCOPE=常见主流程；不新增跨 App、协议分片/预算扩容、极端归档或通用恢复能力。
IMPLEMENTATION_AUTHORITY=false；DYNAMIC_AUTHORITY=false；DEXTER_IA_REVIEW=ACCEPTED@2026-10-09；DEXTER_WIREFRAME_REVIEW=ACCEPTED_IA_CONTENT@2026-10-09。

内部两轮已关闭：R1 NO-GO 0M/4S/2N，R2 NO-GO 0M/1S/2N，均只对应各报告冻结字节。R2 后作者仅修正权限名称、Journey 模板来源及两个按钮的事实矩阵，按 SELF_DECIDED 收口；此为R2后的历史作者处置，不是独立verdict。Dexter随后确认IA并明确追加两轮，本轮在原cycle记录R3/R4及显式轮次例外，不新建cycle，不授权实施。外部 Claude 对修订前六份 SHA 的结论为 GO_WITH_UNVERIFIED_UI、0M/0S/5N，见 `doc/review/platform/2026-10-09-ter-version-update-stage-c-external-design-review-claude.md`；本次只做作者处置，不重开内部审查，也不把旧 verdict 转成当前修订字节的独立 verdict。

Dexter 本轮指派：参考阶段 B 在途实现及其详设，完成 C 详设与计划，再给 Dexter 和另一位 Claude review。允许写本设计包及 review/intake；不修改需求、规范、记忆、A/B 文档、代码/依赖。不运行生成、编译、测试、verify、DEV、Web、设备、reset/seed。文档结构检查另行记录，不代表运行证明。

来源：正式需求 `doc/plans/platform/2026-10-05-ter-version-and-js-apk-update-formal-requirements-claude.md` 全文，尤其 R-06～15、§20.5；讨论稿 `2026-10-04-ter-version-and-js-apk-update-requirements-discussion-claude.md` 用户裁决；A 三设计文档前缀 `2026-10-06-ter-version-update-stage-a-`；B 三设计文档前缀 `2026-10-07-ter-version-update-stage-b-`。R-15 后续裁决覆盖旧双后台/TDS报告/无历史：运维管包，运营同页两 Tab 管规则和报告，CBS HTTP、每任务一行历史，仅主机。

Dexter 2026-10-09 追加边界：只满足常见主流程，不为极端情况增加机制；sample-terminal 与 sample-wallpaper-terminal **不得配对**。本轮直接裁决覆盖需求 R-07 中“不同 App 的副机”的旧句；需求正本本次只读。主副机独立升级指同 App 的两台机器可处于不同版本，不是跨 App 业务协作。作者删掉先前误推的兼容矩阵，不增加新 review cycle。

### 0.1 当前源码不是已验收前提

静态截面为 2026-10-09，Codex 正并行实现 B。附件保存具体锚点；实施前重开，不将行号/hash当长期规则。

| 接缝 | 当前静态事实 | C 处置与准入 |
| --- | --- | --- |
| A 固定核 | actual/embedded、FULL→HOT、boot/action、prepared release 在 owner/adapter 已存在 | 复用；A 最终接受范围仍由其交付 review 确定，C 不重建 loader/installer |
| B TER | 全规则分页、TDC grant/HTTP report、PONG补发已写入 source；显式接受 ruleRef | 不是自动择新；C 在相同核接调度 |
| B 规则时间 | 当前canonical/generated要求规则createdAtEpochMillis；RuleSummary/Artifact已有同名时间，但RuleSnapshotItem及其Service/edge仍未传规则createdAt，不能用artifact时间替代 | B_INTERFACE_OPEN；CP-01重开最终字段/分页构造与B出口，C才消费真实规则时间 |
| B 报告 | TER producer 已存在；截面未找到 CBS POST/report owner persistence；taskId 与 generated UUID 也需统一 | B_REPORT_OPEN；不因静态 consumer存在宣称闭环，不由 C 再造报告 owner |
| B 初次观察/快照重读 | 无任务 ready 实际版本报告、整快照变更重读在截面需核实 | B_BEHAVIOR_OPEN，按 B 最终退出判据关闭 |
| runtime/render | 双屏共享 Runtime；无统一最后点击事实 | C 新增 isolated fact 与统一承载采集 |
| topology | 规则未 sync；配对/HELLO 强制同 moduleName，protocol=1 | 保留同 App 身份检查；C 只增加同 App 规则投影和下载接缝 |
| automation | 当前唯一入口 terminal-automation，已有 A update case；无 C pair/policy suite | C 扩现有 driver，不调用退役入口 |

这些是设计输入与前置状态，不是对 Codex 在途 B 的交付 verdict。C 文档可现在完成；C 实施须 A/B 相关出口和接口差量收口。无 need-to-fix 授权传递到 B。

## 1. 问题、方案合理性与取舍

用户要的是：管理员只维护规则，主副机独立自动达到最新适用目标；FULL 持续邀请、HOT 按本机点击等待；真实运行结果可见。无需新管理界面、通用调度平台或双机共同提交。

| 可行路线 | 优点/代价 | 决定 |
| --- | --- | --- |
| 现有 update owner＋纯选择函数＋本机一次截止 timer | 最少事实，复用 A 执行核/B 供给；可以证伪竞态 | 采用 |
| 另建 scheduler/队列、按历史规则逐条执行 | 第二账本、抢占/回放复杂，违反唯一规则配对 | 拒绝 |
| React effect 驱动主机并复制执行结果给副机 | 少初始代码，但无页面漏启动、双机版本混淆 | 拒绝 |

只允许同 App 配对，复用现有 moduleName/protocol 检查，不扩任意 App 兼容矩阵。下载 peer 回包只传有限 grant/身份摘要，完整清单仍通过已校验 ZIP；不为 manifest 加第二 WS 分片协议。N/M 用同 owner 技术桥，不给每个 feature 加监听或忙闲判断。

## 2. CP 总览及实际退出

| CP | 完整阶段 | 出口 focused/静态事实（非整体验收） |
| --- | --- | --- |
| CP-01 | A/B 接口准入、固定 policy/context、比较与准入函数、生成同步 | 接口缺口关闭或具体 BLOCKED；真实目标/排序/同版本冲突/无规则零动作反例 |
| CP-02 | Runtime 最后点击、render 采集、foreground 技术桥与模块常驻生命周期 | 点击不吞、双屏共用、新 boot 播种、订阅无空窗、cleanup focused |
| CP-03 | 同 owner 自动选择、固定 N/M、FULL 邀请与 HOT deadline、跨启动续接 | flush/迟到/timer/UNKNOWN/ended-session 等反例；本机一次执行 |
| CP-04 | 规则投影、副机 context、同 App peer grant、下载校验接缝 | 本机事实不覆盖、同 App 不同版本/不同 App 拒绝、帧边界与身份反例 |
| CP-05 | 本机邀请呈现、两 integration 接线、唯一 driver 和全部场景源码 | UI/TestId 对账、场景真实触发/selector结果/owned cleanup 源码与 focused |
| CP-06 | seed/fixture/执行资源和跨阶段最终静态收敛 | 场景/数据/权限/预算清单、适用类型/编译/机械门、最终 source closure |

每 CP focused 和修复完成后完整 CP fresh 三维对账 MATCHED 再进入下一 CP。**全 CP→全批 6b→整体验收→13c＋整批 implementation review**；CP-06 不等待后面的整体验收/cleanup/13c，动态结果不回流成为 CP-06 的首次出口。动态发现源码修复时只回到受影响 CP 差量及全批影响复核，不无变化重做旧对账。

## 3. 横切机制对照（固定行集）

| 机制 | 现成能力/规范 | 可证伪观察 | 形态/本批全集 |
| --- | --- | --- | --- |
| 读侧节点授权 | B terminal-update owner task read | [HTTP] 换项目/门店 grant 拒绝 | C不新增后台GET；供给/报告复用 B |
| 写授权与 grant 复核 | TDC MASTER-only认证；CBS issueGrant/content | [focused+HTTP] 旧 binding/换 peer不能拿新 grant | §8.6 全部主机/副机下载；不复制凭证 |
| 跨 owner 写与事务 | TR-01/09 actor dispatchAction | [静态] update不写runtime/topology/TDC slice | 点击、规则、任务、报告各 owner；无新事务 |
| 集合形态与分页 | B完整快照/hash分页 | [focused] 末页/空/跨hash不ready | 全项目规则，不按主机App先过滤 |
| 缓存失效 / 改完刷新什么 | currentRuleContext/Topology readiness | [focused] 旧连接/项目规则不可择新 | 未固定资格失效；固定任务不撤换 |
| RTK 数据读取与加载判定 | N/A：C不改两后台查询 | B RTK/foundation回归按影响选择 | TER selector不使用RTK |
| 同一事实只有一个住址 | terminal-update＋runtime＋native最小记录 | [focused] projection保留本机task/actual | 规则只权威MAIN，副机投影；无第二账本 |
| 失败可见且原因不得改写 | B finite reason映射/最近状态 | [focused] FULL成功HOT失败实际分列 | 无原始异常或伪success |
| owner错误到HTTP映射与注册处 | B catalog/error disposition | [HTTP] 403/409/422沿原操作；无新增op | C内部失败用具名typed结果，不改B error集 |
| 新owner审计三件套 | N/A：没有新CBS owner/业务写 | [静态] 没有新增audit表/路由 | B规则审计沿原模型，C不自建流水 |
| 幂等键构成与重放语义 | task/action/boot身份，Runtimerequest | [focused] 重复通知/两屏零第二准备 | taskId沿B最终契约，不重新计算替换旧task |
| 该用生成物不得手搓字符串 | canonical artifact/topic、generatedTDC | [类型] 最终schema/codegen消费一致 | 修改公共port/selector/invariants/README原子组 |
| 日志落点与脱敏字段 | AGENTS/observability | [focused] 日志无credential/grant/path/raw | policy/role/boot/action/pair/cleanup事件 |
| 迁移回填与可逆性 | state descriptor现有持久化 | [focused] A/B未fixed target没有policy不得自动猜值 | §10最小版本读取；不变造旧策略 |
| 前端共享行为 | TERui-state/render/primitives；Bfoundation | [组件] 仅一个local邀请、focus恢复 | 不重复Dialog/overlay/后台Drawer |
| 管理后台交互一致性 | B三交互工件、前端§3-K | [UI] 复用包页/规则报告Tab，不新增控件 | C变化限TER，B承载未变 |
| 候选/下拉数据源 | N/A：无新增候选 | [静态] 终端无规则选择器 | 管理选包/门店继续B |
| 编码与名称呈现 | B应用/版本事实、有限原因中文 | [组件] 不以ruleRef当标题 | 本机current→target、N分钟 |
| 会同时坏的东西原子组 | §9a路径组 | [类型/focused] 两App/port/default/adapter/consumer全对齐 | 全部公共面与driver场景 |

第三方行为及实际版本在附件 §3；不新增库。所有观察是未来计划，当前 NOT_RUN。

## 3a. UI/TestId 与动态脚本前置

UI_DESIGN_REVIEW=OPEN；TESTID_REVIEW=OPEN；L2_SCRIPT_ADMISSION=BLOCKED。

| case/action | 控件/动作 | owning source（计划） | TestIds唯一源 | 实际目标/观察 |
| --- | --- | --- | --- | --- |
| update.install-reminder/defer | 稍后click | ui/base/terminal-update-presentation/components/InstallInvitation.tsx | terminalUpdatePresentationTestIds.deferInstall | PrimitiveButton；request匹配本task，N重新计时 |
| update.install-reminder/install | 安装click | 同上 | confirmInstall | Button；flush/action/actual，不只request完成 |
| update.idle/click | 内容、admin、虚拟键盘、SECONDARY操作 | 既有sample/admin/input | 各包现有TestIds | 真实操作＋lastClick变化＋零吞操作 |
| update.pair/recover | 左上admin、取消配对/地址 | admin-shell/topology/server-config-panel | 原ownerTestIds | 本机恢复入口，不新增业务按钮 |
| update.supply-chain/admin | 上传、保存、规则新建/启停、报告Tab/详情/历史 | B两后台既有feature | B附件§9常量 | 标准容器，合法role/session，真实HTTP状态 |
| update.install-reminder/native | installer/来源设置/系统返回 | Android外部系统 | N/A:driver系统UI窄例外 | uiautomator语义身份，不读TER文本替代TestId |

UI/constant/真实节点 focused＋fresh复核齐备后才能写/修改动作 binding；任意变更重新 BLOCKED。TestId用createTestId(module,part,{element?,key?})、禁止cast。B现有控制面若无变动只核适用性，不复制同一表或重新L2全量。

**控制面全集**：唯一 `scripts/test/terminal-automation.mjs`、`tools/terminal-automation/src/{runner,managedRun,androidDevice,androidAutomationConnection,androidCleanupRecovery}.ts` 及对应 tests、既有Web/Android journey UI ports、同工具 `journeys/update.policy.test.ts`/`update.policy.android.test.ts`/`update.pair.android.test.ts`、共享 `journeys/updatePolicyJourney.ts`、既有 update supply/admin helper与fixture、`.agents/skills/cs-terminal-automation/SKILL.md`（仅API变动同步）、resource profile/health/format已有登记源。拟case为 update.auto-selection、update.idle、update.install-reminder、update.pair、update.supply-chain；case属于metadata，不进入目录/类名。参数与suite显式登记，未实现必须拒绝启动。

C不新增后台browser-L2 suite/八文件控制面；同DEV供给链复用 B 现行 §15.2a 的唯一 `scripts/test/terminal-automation.mjs` → `tools/terminal-automation/src/runner.ts` → `update.supply-chain`，后台与TER动作在同一父run内顺序执行。后台DOM操作复用 `terminalUpdateSupplyUi.ts` 的Playwright/helper，TER React控件走agent，系统安装/设置只用driver窄例外；不是两个入口或两个managed run的交接。父run拥有其新建browser/context/session及TER设备、reverse/forward、安装与绑定，统一预算、首败诊断和cleanup；DEV已有Vite/tunnel只借用，不停止或计作本run资源。CP-01重开B最终argv、helper、DEV来源与fixture交接，CP-05只扩同一入口的C自动选择断言，不新造runner。若实际需改后台控件或新增隔离L2，先回设计补完整控制面、单独授权，不用本节N/A逃过准入。

## 4. 各 CP 门控

| CP | 可证伪失败条件 | 不变量 / FORBID | 比例验证/形态理由 | RECALL |
| --- | --- | --- | --- | --- |
| 01 | B未闭合字段却开始真实C；用JS实际pub比FULL嵌入身份；先runtime过滤丢可FULL规则 | A/B读回准入；不得修B或用fixture冒充真实供给 | 类型＋纯选择反例；复用已有比较核而非第二版比较 | reqR01/06/09；A§14；B§8/接口；当前源 |
| 02 | 页面未挂载不订阅；任一屏点击被吞；旧boot时间继承 | isolated/runtime actor唯一写；不得逐按钮effect或业务callback | 模块/组件fake timer＋同原动作断言 | reqR07/12；TR01/03/11；SurfaceRoot/Runtime资源 |
| 03 | 新通知抢固定任务；同boot领取第二条；N重新commitUNKNOWN；M绕过flush | 同核、持久policy、一次截止；不得等待上限/坏包重试 | owner时序/持久化失败、native sessionfocused | reqR09～14；A核/port；本稿§8 |
| 04 | 全slice投影覆盖副机task；删除同App身份检查；grant过64KiB | 只规则projection；同App资格；副机无secret/report | 双runtime focused＋真实codec/frame＋nativeZIPexpectation | reqR07/15；state/topology/TDC/Preparer |
| 05 | 旧runner/假selector完成替代真实操作；邀请重复或挡admin | ui仅selector/command；driver唯一owned | UITestIdfocused、runner自测、同清单双端 | IA/UI、automation正式需求/skill、§3a |
| 06 | 未授权reset/seed；动态结果回流CP退出；旧proof称current | seed只来源契约；CP与6b动态顺序；不得全仓无关verify | 相关类型/机械门、资源cleanupfocused，静态场景读回 | scriptsREADME、实施模板6c、§10b/11 |

## 5. operation / path / face / 规模

C不新建CBS operation或权限。报告状态/原因优先消费 B 出口已闭合的 canonical/Flyway；若最终数据库约束尚不支持，按 §10 增加唯一具名差量迁移，不再绝对承诺“无迁移”。使用B canonical/generated：项目完整snapshot、issueTerminalUpdateDownloadGrant、content、submitTerminalUpdateReport以及两后台包/规则/项目报告页/detail/history。具体HTTP路径与errorSetRef以B当前canonical为正本，CP-01用附件路径重开核对，不能猜新URL。

规则本地集合规模继承B分页/技术字节限制与完整hash；不增加业务条数上限。projection含context的完整序列化沿既有8MiB技术边界，见附件§4；不假设HTTP上界天然可同步，也不提前扩协议预算。每机器一fixed task、一N或M截止timer、一次inflight grant，下载复用A有限尝试。项目/后台报告历史增长归B数据库；C没有历史删除/配额/轮询。

## 6. 引入事实、关系与生命周期

| 事实 | 唯一owner/住址 | 持久/同步/失效 |
| --- | --- | --- |
| lastLocalInteractionAt + revision | Runtime新增isolated slice | ephemeral、不sync，新JS初始化now；revision每click加1仅为本机竞态身份 |
| presentation availability | update adapter技术观察→owner command | ephemeral、本机；foreground且可呈现；系统pending额外由readAction判定 |
| currentTask.bootId（既有字段） | currentTask 内执行 boot 事实 | 持久/isolated；执行前 flush 更新，旧动作确认不更新；无第二名额账本 |
| FULL/HOT policy | 固定task.target.strategy | 持久、isolated；nSeconds/hotStrategy/mSeconds来自所选B规则并在port前flush |
| installation invitation | update owner presentation事实，UI只读 | ephemeral、local；taskId/actionId/boot关联；每机一份 |
| reminder deadline / idle schedule | update owner运行资源 | 一个timer、epoch/runtime关联；durable lastInviteAt可随task保存，background仅due；M时间不持久 |
| project rule projection | update slice record sync中的单一rule entry | MAIN权威、SLAVE只读；只快照＋非秘密context，不含task/actual/policy执行/路径/报告 |
| fixed origin | task内 context/pair origin | 持久；标起始空间/项目/门店/绑定generation或pair身份，不为其续接重选 |
| scoped download grant | MAIN TDC HTTP返回→update peer command结果→branch attempt参数 | 临时、零slice持久/零sync；ZIP digest＋工件摘要，过期重取同artifact |

不改TR-09 retain范围：update owner已批准持久currentTask/recentStatus/failedArtifactIds；B报告descriptor按其最终批准语义。C规则投影不得借retain保留取消激活后的旧资格；root reset时清rule资格/报告上下文，固定本机task按批准retain语义处理。Runtime点击/presentation/timer仍清除。规则projection apply只覆盖规则字段，不覆盖localtask/actual/failed/report。retained slice reset机制按slice，任何新根级reset调用仍需重新评审例外。

## 7. 跨层事实与机制矩阵

| 链路 | 唯一事实 / 机制 | 错误边界 |
| --- | --- | --- |
| CBS→PG通知→TDS/TDC→MAIN规则 | B topic时间＋完整HTTPsnapshot/hash | 通知不是规则正文；页/hash失败不ready |
| MAIN→BRANCH | 既有record sync + connection/revision readiness | 旧连接/应用失败/空projection不可用；空完整集合ready=无规则 |
| Runtime/render→update | 本机interaction command＋selector、一次截止timer | 重复/旧runtime时钟不修改任务；原操作保留 |
| auto→固定task→UpdatePort | 当前实际readFacts、比较、双读资格、flush | preport失效零native；fixed后不替换 |
| FULL/系统→新boot | A action/session、installed embedded、APK signer事实 | pending/unknown零重复，取消等待；新boot优先HOT |
| HOT→newJS/boot确认 | A Host/file loader＋nativeT＋PRIMARY | M不计入T；迟到boot不确认候选 |
| BRANCH→MAIN→CBS grant→BRANCH下载 | peer command身份＋MASTERcredential；compact result | 凭证不下行，换peer迟到结果无效；大manifest不进wire |
| MAIN→CBS HTTP→运营报告 | B owner pending/task sequence/receipt | 报告不阻塞更新；副机拒绝且不代报 |

## 8. 精确行为设计

### 8.1 纯选择、实际比较与port前重读

从当前**完整ready快照**筛选项目/门店scope、local applicationId、android；不先按runtime筛除需要FULL的目标。createdAtEpochMillis DESC；同时间按规范UUID 16字节/小写hex DESC（不用localeCompare），与B SQL一致。只取第一项，不对兼容拒绝/坏工件自动回退次新。ALL包含未来同项目新门店，STORE_REFS严格成员。

读UpdatePort实际版本；actual不全/读失败输出明确reason与零port，不拿目标/主机投影补actual。复用nextArtifact现有准入函数：FULL用installed＋embedded identity，HOT用当前actual runtime/js/pub；semver三整数排序、同JS异publication拒绝、APK不降，最终JS不降；FULL中间内嵌较旧只限已经证明兼容的配对目标。

候选只运行态 `{ruleRef,collectionHash,contextIdentity,localBoot,roleGeneration}`，不落第二队列。await actual/target后和首次port前重读上述完整identity；context/规则资格变更则丢候选并合并唤醒一次，不使用陈旧target。每模块一inflight evaluator，桥仅在selector必要事实变化发内部 evaluate command；自身dispatchAction引起重复通知不得死循环。

判定无规则/已达到/不需更新：零prepare/apply，无伪fixed task；公开selection selector可见理由，后续真实规则/资格变化仍可判断。首次准备前保存固定task/策略/原actual/boot，再flush。此时成功固定才占本boot名额；之后任何失败本boot也不领下一规则。

### 8.2 固定任务与跨启动

以native `actual.bootId` 为本机JS boot权威，不以Runtime role/surface/requestId重建名额。已有task先reconcile；不得通过selector变化accept第二条。目标保留B规则createdAt、完整FULL/HOT摘要、N/M和源identity；新规则/停用/role/断链不修改固定字段。

沿 A currentTask，不新增独立名额账本。既有 `TerminalUpdateTask.bootId` 就是执行 boot，不新增 executionBootId 或迁移字段：在本 boot 第一次准备/应用前随固定事实 flush；只读回、确认旧动作不得覆写它。S1 固定并执行 FULL；S2 确认 FULL 后续接 HOT，执行前把 task.bootId 更新为 S2；S3 确认 S2 的 HOT/旧任务最终成功，保留最近状态/报告后释放旧 task，允许在 S3 固定一条新规则。若 task.bootId 等于当前 boot，无论成功或失败均本 boot 不再领取；旧 boot 的终态确认不是本 boot 执行。复用同任务 release/confirm 流程，C 修改 A 接缝但不把 A 当前覆写 bootId 的行为当成 R-09 正确判据。failedArtifactIds 禁同坏工件重入，UNKNOWN 回读同 action、不重复提交；无等待超时或手工重试。



现有 `terminalUpdateActor.ts` 的全部 task.bootId 写/读点按以下处置（行号是当前截面导航，实施按符号重开）：

| 当前点 | C 最小处置 |
| --- | --- |
| executeNextArtifact L673/L677 | 不再只在 null 时写；本 boot 首次真正 prepare/apply 前，若 task.bootId 与权威 actual.bootId 不同，更新既有字段并 flush；originalBundleVersion 仍保留最初值。无权威 boot 或 flush 失败零 port |
| selected=null 成功 L710 | 删除确认时覆写，保留 task 原执行 boot；已达到本身不是一次 prepare/apply |
| FULL 成功续 HOT L969 | 只把任务恢复 fixed，保留原执行 boot；到本 boot 首次 HOT prepare/apply 时才写本 boot并 flush，不由纯 FULL 确认占名额 |
| action 结果 L1006 | 删除成功或失败确认对 task.bootId 的覆写；action.bootId 仍用于 action 身份核验，不能替代任务执行 boot |
| accept 固定任务 L1194 | 初始 null 表示尚未执行；首次 port 前写权威执行 boot并 flush，无新字段 |
| 终态释放 L900–905 | 沿既有 task.bootId 非空且不同于 actual.bootId 判定；同执行 boot 不释放，继任 boot 的纯确认后可释放 |

已有 prepared 工件直接 apply、ENDED_NOT_INSTALLED 再提交以及 FULL→HOT 续接，同样经过这一个“本 boot 首次 port 前更新＋flush”接缝；不只修首次下载路径。focused 覆盖 S1 执行/S2 续接/S3 纯确认、同 boot 重复、prepared 跨 boot、无 boot/flush 失败，零第二名额账本。

### 8.3 点击、M和调度

Runtime新增公开 `recordLocalInteractionCommand`（payload只runtimeIdentity，时间由actor取现有clock，不让外部填未来时间），`selectLastLocalInteraction`（time＋revision）。新Runtime安装初始化now；ephemeral/isolate/resetclear。render SurfaceRoot 的统一输入起点捕获：统一使用现有RN/RNW View的onStartShouldSetResponderCapture观察起点并返回false；保留原responder/propagation，不preventDefault、不抢responder。admin/keyboard若有SurfaceRoot外承载，补其**共同承载点**一次，不能逐键/按钮接线；CP-02枚举实际portal并测试。

单机两屏共享一Runtime；双机不投影点击。HOT准备完成后，IMMEDIATE→flush→同prepared apply；IDLE→deadline=本机lastClick＋mSeconds×1000。若准备已耗过M且无新点击，可以立即到期；新JS初始化时间不能沿旧idle缓存。timer只发送内部 `terminalUpdateDeadlineCommand({taskId,bootId,scheduleGeneration})`，actor到期重新读task/prepared/actual、lastClick/revision；到期与点击同刻，先到的apply也须在提交前再次核对revision，变化则重排。

每本机最多一个当前策略timer；新click取消旧timer并增加generation；background/resume重新计算，不承诺后台精准执行、无轮询/闹钟。HOT立即策略不受点击阻断；M不检查店员、订单、HTTP或配对业务busy。N/M上界沿B分钟1～1440、API秒60～86400，乘1000至ms不会超过常见timer整数范围；使用当前Runtime资源生命周期释放。计时沿现有 clock，剩余等待用 max(0,deadline−now)；不建设壁钟异常检测/时钟服务。

### 8.4 FULL初次与N提醒

准备完成后先flush，沿A `applyPrepared` **立即且仅一次**调用native，由平台决定静默或系统确认。不能先强制一个业务按钮剥夺静默能力。C本机React邀请用于已有waiting-user任务的再邀请；初次权限/系统确认沿A路径。若平台首次无法呈现，保留due，前台处理。

新增typed UpdatePort技术读取/观察presentation及 `presentInstallerConfirmation({taskId,actionId,publicationId})`：只恢复当前精确pending系统Intent，不重commit；当前action已ended-not-installed/user-cancelled则owner可在用户再次确认后新建同工件action，继续existing fixed task。没有action/session可证明时保持UNKNOWN，不能盲创建。native方法读回身份/权限/session、返回typed result；不能由native挑规则或计N。

owner 首次等待记录 lastInviteAt/nextDue；“稍后”或系统用户取消仍同 task 下次 N。统一四类 readback：

| 实际 native 事实 | N 到期且本机前台的动作 |
| --- | --- |
| known pending-user：当前 action/session 匹配、exact confirmation 可恢复、目前不在显示 | 允许本机再邀请；用户“安装”只恢复该 session 的精确 Intent，零 prepare/commit |
| 安装中或本次系统确认正在显示 | 不叠第二邀请，不重复 commit；由技术状态变化后再核对 |
| UNKNOWN：session 尚在但无法判断，或无法证明确认可恢复 | 仅回读同 action，不盲创建新 session |
| 用户取消/ended-not-installed，已确认 session 结束且版本未达到 | waiting-user；N 后邀请，用户确认才沿原 prepared 工件创建新 action/session |

后台只留 due，回前台先 readFacts/readAction。C 将原 native foreground 自主呈现接缝统一成技术事件→owner command→上述处理，native 仅核身份并呈现指定确认，不再与 owner 的 N 各自调度。可呈现由 Activity resumed＋本次确认发起/离开事实提供，无法判定则 unavailable，不建系统全局窗口扫描或 OEM 恢复框架。

首次真正installer动作与再次提交前都flush本机durable facts；失败零commit。提示本身不把prepared目录/URL/grant放UI；双屏只物理PRIMARY可呈现。安装后manual启动仍允许；不保证自动拉起。

### 8.5 常驻模块、selector与foreground

createTerminalUpdateModule：先建立Runtime subscribeState/port技术订阅并registerResource/AsyncResource；再播种本机presentation与当前事实，发initialize/reconcile/evaluate command。技术事件桥首值播种、同值去重、跃迁发本包command（TR-11），不回调业务actor、不写slice。初始化显式owner command承接播种；状态读取与订阅无空窗，revision/identity再次核验。

桥观察规则资格/context/local actual/role/配对ready/lastClick/presentation（不是整个state序列化），按有关事实去重；定时callback只command。dispose取消timer/inflight观察/退订，异步失败进入Runtime cleanup聚合、保留身份可重试，旧Runtime完成不改新task。ui-base presentation仅消费selector/发command，无timer/HTTP/版本排序。

呈现复用 render alert tier，新增有限 placement scope local-primary，取 isHostPrimaryDisplay 与本机 MAIN/BRANCH 的 PRIMARY route context。SLAVE/VICE 业务仍逻辑 SECONDARY，但邀请不得读取 MAIN 投影；沿 openLayer/closeLayer 打开 ephemeral 层（既有 serializeLayer 已不持久/不同步）。业务 interlock 不隐藏本机 alert，admin tier 优先；render 无 update owner 依赖，uiCatalog 登记普通 part，不新平台/tier。控件/布局唯一见 UI §1/3。

### 8.6 规则投影、副机context与下载

沿当前update slice**record sync**只导出规则snapshot＋空间/项目/门店/主机非秘密bindinggeneration；applyEntries只修改该entry，保留副机currentTask/recent/failed/actual/report。MAIN权威；SLAVE不向主机写规则。删除/空集合用明确empty/tombstone语义，不能保留旧资格。两个composition同步列表登记同一update entry。

MAIN上下文仍本机active、store/project当前flushed；BRANCH不伪造active/flushed，使用当前pair connection的必要projection readiness（server-config、非秘密activation、store组织、rules）＋值身份一致。每机器local application/native用于相同算法；规则完整项目，不按MAIN App过滤。失联/新连接projection未到/失败则禁止新固定；不把规则暂缺加入所有业务interlock，业务门继续按其自身必要投影。

副机不能本地用TDC MASTER-only grant。update新增公开 `requestPeerTerminalUpdateSourceCommand`，副机显式target=peer，只向当前MAIN发，MAIN handler重验当前pair/peer identity、project/store/space和请求的固定rule/artifact身份，再dispatch既有TDC grant command；MASTER credential仅由TDC注入CBS三头。只返回判别式 compact `{artifactRef,kind,artifactIdentity,zipSha256,relativeContentPath,grant,expiresAt,apk?}`；FULL 的 apk 是现有 grant.manifest.apk 中有界的 `{path,sha256,certificateSha256}`，HOT 不带 apk，零凭证/完整manifest。完整信封经现有64KiB/depth/string约束，超限明确失败；不截断、不新建command分片。

现有 prepare input 增加 typed trusted summary 分支，沿同 Preparer、extractFull/extractHot/validateFull，区分包格式：

- HOT：流式验完整 ZIP 摘要，再读取 ZIP 内现有 `terminal-update-publication.json`，核 summary 的 App/runtime/native/js/publication/minimumFull；entry/files 使用已有清单与文件校验。
- FULL：ZIP 只有单个 APK，**没有 ZIP-level manifest**。summary 带现有 apk.path/sha/certificate，extractFull 按文件名/大小/摘要解出 APK，validateFull 校验 package、native build/version、signer。FULL summary 只重建既有 artifact 的 `platform/applicationId/nativeVersion/nativeBuildNumber/apk` 字段供 extractFull/validateFull 使用；ZIP SHA 与 APK SHA 都来自 CBS 固定身份，不再解析未安装 APK 内的 publication metadata。主机/副机复用同一校验，不改 builder 格式、不加 parser。安装后 beginBoot/readFacts 读取已安装 APK metadata 的原路径仍保留，不能将本项简化扩大到 boot 身份。

完整 files 不进入 peer result；主机沿同 summary 入口可复用，测试完整 manifest 仅既有 typed fixture。只有准备和身份校验成功才返回 preparedId/可加载资格，不因摘要缺失绕过验证。CBS grant 仍权威复核固定工件与当前 binding/project/store；规则停用从最新集合消失不使旧固定目标自动失效，MAIN 不要求它仍在“最新启用集合”，不重新择新。scope/relative path/网络 prefix 消费当前配置；空间变化使原固定来源不匹配则拒绝，不跨空间下载。

grant只在当前attempt内，迟到结果需taskId/artifact/pairconnection/origin匹配；过期有限重取同工件。断链不换fixed目标，无法合法重新取得grant按已有有限故障语义；已prepared本机后续仍按A核可执行。报告显式local且MASTER/active/binding匹配，BRANCH不peer转报告。

### 8.7 同 App 配对与不同版本保护

保留 HELLO/pairByHost 的真实 moduleName 和现有 protocol 检查，不建立跨 App 矩阵，不为 C 的规则字段/具名 command 单独升级 protocol。console↔console、wallpaper↔wallpaper 各自沿已有业务投影/peer owner；console↔wallpaper 或反向明确拒绝配对。本轮直接裁决覆盖旧需求 R-07 的不同 App 句。

| 配对/实例 | 原业务和本机更新呈现 |
| --- | --- |
| MASTER/MAIN，本机 PRIMARY/SECONDARY | 原 LMP/LMS；仅物理 PRIMARY 本机安装邀请，SECONDARY 不重复 |
| 同 App SLAVE/VICE，BRANCH 物理 PRIMARY、逻辑业务 SECONDARY | 原 LMS 主机业务投影；本机更新层使用 BRANCH/PRIMARY 上下文，不能复用主机更新邀请 |
| 同 App SLAVE/CHIEF，BRANCH 物理 PRIMARY | 原 LSP 本地功能和既有 peer owner；本机更新层仍 BRANCH/PRIMARY |
| 同 App 配对失联或协议不兼容 | 既有业务保护；本机 admin 仍可恢复；无当前 projection 不接新规则，固定任务不换目标 |
| 不同 App | 配对请求拒绝，保持原本机角色/页面；不以新遮罩或本地业务 fallback 偷开配对 |

各机 actual/点击/任务独立；实际协议不兼容沿原 typed 拒绝和业务 interlock，不用 runtimeVersion 冒充 topology 协议。不协商任意 feature，不改变既有 VICE/CHIEF 确认流程。

### 8.8 报告、日志与清理

B HTTP/PONG/队列/error分类保持。报告 current canonical 已有 WAITING_USER/DOWNLOADING/VERIFYING/INSTALLING/APPLYING_HOT/SUCCEEDED/FAILED/CANCELLED/UNKNOWN；C 仅新增 WAITING_IDLE（等待闲时）和 ADMISSION_REJECTED（准入拒绝），以及 reason INCOMPATIBLE/WOULD_DOWNGRADE/FAILED_ARTIFACT。邀请等待使用 WAITING_USER；纯无规则/已达到不造历史。无 fixed task 的拒绝按 B 的 taskId=null 最近观察报告；FULL 成功 HOT 失败仍 FAILED/HOT_APPLY_FAILED，actual APK/JS 与 target 事实显示部分成功，不新建 PARTIAL 任务状态。CP-01 必须读回 B 最终 terminal_report 的 state/reason 持久化形状，以及 taskId=null 但 recent 非空的允许条件；该出口未闭合不能先生成/发送新值，具名差量迁移条件见 §10。未分类保留 B UNKNOWN。canonical→materialize→codegen→所有消费者与运营中文同组，运维没有报告页，不新增其页面。每fixed task一行历史，原taskId/sequence稳定；无task只有actual观察按B入口，不造历史task。main-only报告，真实部分成功不得覆盖为最终目标成功。

必要事件：selection（no-rule/reached/rejected/fixed）、policy-wait、deadline-stale、invitation、grant、prepare/apply、boot-reconcile、projection-invalid、dispose/cleanup。关联task/action/boot/runtime/pairgeneration，不记录点击内容坐标、credential、代理秘密、grant/URL、absolute路径/rawpayload。cleanup分别断言timer/订阅、prepared/staging、runnerPID/starttoken/reverse/forward/APK，只删自身资源；active/安装未知session/其他run资源不删。

## 9. owner API、调用者与公开面

| 公开/内部面 | 调用者 | 语义 |
| --- | --- | --- |
| recordLocalInteractionCommand / selectLastLocalInteraction（runtime新增） | render共同承载 / update owner | 本机点击事实；无更新策略 |
| evaluateTerminalUpdateCommand（update内部） | 常驻selector桥 | 最新候选判断；不能外部绕过准入 |
| terminalUpdateDeadlineCommand / terminalUpdatePresentationChangedCommand（内部） | 一次timer / port技术桥 | identity核验后actor写状态 |
| confirmTerminalUpdateInstallCommand / deferTerminalUpdateInstallCommand（公开local） | presentation实际按钮 | 同fixed task的邀请行为，不手工坏包重试 |
| requestPeerTerminalUpdateSourceCommand（公开peer） | BRANCH update actor→MAIN同owner | 临时grant摘要，不传完整manifest或credential |
| selectTerminalUpdateSelection / selectTerminalUpdatePresentation（新增） | UI/automation | 有限状态/原因；JSON，不泄漏secret |
| accept/reconcile/confirmBoot及原五selectors | 既有同owner/PRIMARY/automation | 继续原职责；自动候选经相同固定核 |
| UpdatePort技术观察/恢复确认/summary prepare | update owner桥/nativeadapter | typed unavailable/failed；不定义command、不反向依赖runtime |

新增public每项至少一生产caller和automation注册；无zero-caller入口。改包根、README、terminal-invariants publicExports/selector registry与tests同批；不再新建流程名包或helper总线。

### 9a. 原子组与唯一锚点

1. runtime `types`、新增 `features/slices/localInteraction.ts`/command/actor/selector、application install/index、两integration依赖/invariants；render SurfaceRoot/必要外部portal；同组tests。
2. update `types/terminalUpdate.ts`、slice/actor/module/commands/selectors/index/README；platform-ports `types/update.ts` 与defaultUnavailable、adapter/android/update TS桥/Kotlin Runtime/Module/Preparer，application provider、boot/版本focused。
3. topology 现有 stateSync/controller/peer 与 update record entry、两 integration assembly 的更新 readiness reader；保留 moduleName/protocol 和原业务投影不变；相关 codec/pair/late-result tests。
4. 新 ui/base/terminal-update-presentation 标准包、TestIds、组件/局部presentation actor、两assembly uiCatalog、render 既有 alert 层的 local-primary placement scope、相关UItests。业务owner决定due，UIactor只placement，无第二策略。
5. automation唯一runner/managedRun/显式case与suite、共享policyJourney和两端harness/pairharness、fixtures、androidDevice/Android connection/cleanup recovery 的 pair forward＋reverse 及对应 tests、资源profile/run根登记、health/format、skill/API变动同步；B后台helper引用不复制。
6. 报告有限 state/reason 新增：canonical report schema/catalog/error disposition→materialize→edge-codegen→terminal generation→CBS/两后台/TDC/update consumers；无generated手改；若 B 最终数据库约束不支持新值，含 §10 的具名现有表差量迁移及 owner persistence/acceptance 同组。C不新增operation/schema owner。

每组实际编辑顺序：公共 type/canonical→producer/owner→adapter/default→两个 composition/UI/driver consumer→exports/README/registry→整组 typecheck 与 focused。允许组内未完成时出现类型错误，但不以兼容 fallback 求临时绿；只有整组实际 proof 完成才记 PASS，当前没有执行任何编译。

### 9b. 唯一正本

业务判据正式需求R条目＋本稿§8；可见文案UI§4；state字段/typed端口所属code types；HTTP/schema在B canonical；topology协议在contracts；TestIds附件§5；seed key r5-full fixture契约；受管生命周期terminal-automation。附件行号用于导航，不用于symbol存在性机械门。

## 10. 数据、持久化与迁移

报告持久化准入先在 CP-01 读回 B 最终 `terminal_report` 的实际 schema/table、state/reason 列类型及 CHECK、owner 映射，并核 taskId=null 时 recent 非空是否合法。WAITING_IDLE/ADMISSION_REJECTED 和 INCOMPATIBLE/WOULD_DOWNGRADE/FAILED_ARTIFACT 优先消费 B 出口同一份 canonical/Flyway，不在本轮改 B。若 B 最终仍缺数据库约束支持，C 在 CBS 唯一 Flyway history 增加具名 `apps/backend/catering-business-server/src/main/resources/db/migration/V<实际下一版本>__terminal_update_report_policy_states.sql`（数字版本 CP-01 按实际 inventory 分配），只调整该现有报告表必要状态/原因及 null-task recent 约束，不建新表/账本；若现有列无此约束，则明确 N/A_WITH_REASON、零 SQL 迁移，只闭合 canonical/owner/映射。任一分支都要证明新值与 no-task 最近观察能写回/读回，taskId=null 不生成任务历史。C新fixed policy只取B规则明确N/M，不从当前新规则补旧task。B最终交接须不存在未终结的真实fixture任务，或提供其原规则参数的可信readback；任一旧durable fixed task缺N/M且无法恢复原policy，实施停在CP-01，请Dexter决定该具体既存task处置，不擅自清task/坏包或默认M/N。这是有限既存接缝，不长留兼容层。

现有slice record projection只序列化规则事实；应在实际state flush/reload与双机投影测试证明后再决定是否独立descriptor，不能增加第二份规则事实。lastClick/revision/presentation/timer永不持久。rootreset保留按A/B批准descriptor，C资格即时失效。

## 10b. seed、fixture与合法操作

### 10b.1 来源及不可假造

唯一输入 `doc/plans/platform/2026-07-25-v2s-r5-full-dev-seed-fixture-contract.json`，`stableFixtures.organization.storeTerminals` 按 key：dual/MAIN=term-front，mobile/BRANCH=term-handheld；activation code运行内读取，不复制到JSON/argv/manifest。共享terminal遵“一时一个受管run”；REQUIRE_INACTIVE，only matching manifest.deviceId＝读回bound_device_id才可cancel。

### 10b.2 覆盖规模

不加独立C seed终端；复用现有项目/门店/账号。业务测试造少量规则：ALL旧/新、指定当前store、另一App、disabled、同timestamp稳定tie，FULL-only和FULL/HOT。正常N=5、M=10分钟；focused虚拟时间推进边界，真实设备至少一次按正式最小1分钟等待，不改服务器时间或用隐藏M=0规则。同 App pair 用两指定设备各自的 publication/本机数据；两个 App 分别跑同 App 配对，不互配。

### 10b.3 角色与路径

platform管理员从managed DEV account reader读账号/secret，仅处理同空间包上传解析→保存；operations 写 actor=r5-account-multi-role（seed key account-multi-role），密码只由 V2S_SEED_OPERATIONS_DEFAULT_PASSWORD 的既有 reader 临时读取；shell 选 asg-multi-group 的 GROUP 任职，再选 project-river 的 PROJECT 数据节点，验证页面授权和 MANAGE_PROJECT_TERMINAL_VERSION，报告沿其读 scope。不得沿激活 fixture 的 PROJECT任职/STORE节点冒充规则写资格；店员只执行终端安装/系统设置，不代替后台管理员。主机TDC认证，不给副机独立terminal credential。每场景fixture表在§11；scope/权限缺失则停止fixture准备，不默认seed临时admin。

### 10b.4 reset/seed授权

本轮无reset/seed权限，B已有授权不继承。未来C若需要数据库reset，先由Dexter明确授权，再按全CP MATCHED/全批6b/适用§3a准入/当前字节完整seed dry-run/身份预算进入；reset→DEV start→完整seed顺序独立记录，不以DEV restart隐式seed。若复用已健康DEV/fixture，则不为了C多做reset。

### 10b.5 文件全集与清理

seed契约及其当前scripts/dev seed实现不增C分支；预计只在tools/terminal-automation/fixtures与既有backend-acceptance FixtureSetup合法命令写run fixture。若需要修改seed模型，先回设计列canonical/data/运行文件，不能藏到runner。

fixturecleanup：run创建规则停用/包stage释放通过原owner；不删除已提交更新历史；旧artifact/asset按B允许的owned生命周期；终端cancel仅owneridentity匹配；安装APP/base恢复按assignedserial与run-owned标记，未知installer/session保留并报cleanupFAIL，不全局rm/按端口kill。

### 10b.6 执行资源

单run覆盖主/副两session可并行观察但不启动另一个managedrun；设备serial/display标识显式输入，不依列表顺序。manifest非秘密记录host/boot/starttoken、terminalkey/ref/store/device与pair/session/app/build身份；grant/凭证正文零落盘。扩现有资源门的profile与run根，启动前拒绝未知/既存Android build树，退出精确清理run-owned build/APK/ZIP/prepared staging/browser/reverse/forward/process，留小结果与首败日志。



[已定·本轮不执行] Dexter 的设备矩阵采用交叉覆盖，共 **4 个设备 run**：console 真机单机双屏；wallpaper mobile 安卓虚拟机；console 同 App 两安卓虚拟机配对；wallpaper 同 App 两安卓虚拟机配对。两个 integration 的 Web 先分别完成非 adapter 清单（另计 2 个 Web 执行计划），然后按上述四个设备 run 顺序，最后 13c。run 数指无失败的计划基数，不包含修复后有依据的 focused 重验。

manifest 每 device 具名 `deviceRole`：PHYSICAL_DUAL、MOBILE_EMULATOR、PAIR_MASTER_EMULATOR、PAIR_SLAVE_EMULATOR；分别记录显式 serial、applicationId、API、物理 display 映射、业务 surfaceForm 和本机 Runtime/session 身份。禁止以列表顺序选设备；pair 两 serial 必须不同。配对虚拟机两端都是 laptop 单物理 PRIMARY；复用 driver 现有单 display 映射（shape=mobile 的映射能力），但 pair case 的 application surfaceForm 明确为 laptop，不能沿目前 shape→mobile 构建注入；新增这一 case 分支而非新增设备模型。普通 wallpaper mobile case 仍 mobile。CP-01 核设备 API≥29、installer/来源设置可用、真实 dual 的两个 display、虚拟机单屏与 laptop 配对资格，CBS HTTP/TDS 使用已有 reverse 接缝；缺任何能力停 CP-01 报具名缺口，不换设备方案或减分母。

### 10b.6.1 双虚拟机配对的最小网络通路（计划）

复用唯一 driver/Android 资源生命周期，不新造 pair runner、不恢复 tools/terminal-topology。从本仓 `kernel/base/contracts/topology-transport.config.json` 与 native host readback 取 port/basePath（当前 43172 与 /terminal-topology，仅为截面），两端一致，MASTER 先启动真实 TerminalTopologyServer。拓扑 pairByHost 只接受裸 host，HTTP status 和 WS 都消费该固定 port/basePath，不接任意 URL/新端口参数。

1. 通过参数数组调用既有 adb 子进程能力：`adb -s MASTER_SERIAL forward --no-rebind tcp:TOPOLOGY_PORT tcp:TOPOLOGY_PORT`。宿主端口沿现有拓扑固定端口，因为 pairByHost 不接受 port 参数；启动前该宿主端口与 forward 没有未知占用，冲突即停止，不覆盖或临时改业务端口。创建后立即以 serial/local/remote、runId 登记并 `forward --list` 精确读回。
2. 副机沿既有配对 UI/command 填裸 `10.0.2.2`（安卓模拟器访问宿主 loopback 的地址）；owner 仍沿固定 port/basePath 拼 HTTP `/status` 和 WS `/ws`。该路径不需要在 SLAVE topology port 建 reverse，因此不会与它配对前自身 MASTER host 冲突，不需要额外 stop-host/绕过准入 command。副机按既有 pair→SLAVE 生命周期切换，两个 agent WS 与 CBS/资产/TDS 的现有 reverse 接缝不改。
3. 路径为 SLAVE→宿主 `10.0.2.2:TOPOLOGY_PORT`→MASTER forward→MASTER native host。各设备 CBS/资产 reverse、主机 TDS reverse 仍按既有管理；副机不建立 TDS 会话。HTTP identity、HELLO 和 state apply/readiness 成功才做业务/更新断言；映射存在不等于配对成功。网络不可达或当前平台不支持该路径，停在具体能力/网络边界，不临时换 Wi-Fi 自动发现、启动第二代理或缩矩阵。
4. 同一父 run 注册两 session、两 App 进程/日志与新增 forward及既有reverse，更新现有 profile/run 根预算与诊断。部分 setup 失败也回收已取得的资源，保留 first failure。cleanup 先断两端 session/本 run reverse，再删 MASTER 本 run forward；逐项核 serial/local/remote 仍与 manifest 相同，变化则不删并 cleanup FAIL，已不存在可记 released。只用对应 `--remove`，禁止 remove-all、杀全局 adb server或删其他 run。读回零本 run 映射、两端原有资源不变，cleanup 非 PASS 不交付。

ADB/模拟器实际版本与官方依据见附件 §3；以上是设计推论与未来验证，不是现有 driver 已支持或网络已跑通。配对需要的 adapter 行为列 F→双虚拟机 P＋H；不补 Web topology 模拟。

## 11. 可执行场景与业务oracle

均为 **拟新增/扩展场景，NOT_RUN**；公共名是case metadata，不作为文件/类名。F=owned unit/组件/typed/codec；W=Expo Web integration；D=console 真机双屏／wallpaper mobile 虚拟机上的 application；P=每 App 一组双安卓虚拟机真实 topology；H=真实CBS HTTP/PG/资产。Web fixture port只automation-enabled，生产Web unavailable，不把Web模拟native作为真实更新。

| 场景 | fixture/actions | 必须业务断言 | 执行/cleanup |
| --- | --- | --- | --- |
| update.auto-selection | 6规则fixture；通过Bproduction供给/空/disabled/同time；当前actual variants | 最新tuple、ALL未来store、不同App、zeroaction、sameJS冲突、不暗降/找旧 | F→W→D；清run规则/APP |
| update.fixed | 两屏ready并发、读取期间换context、fixed后停用新规则/断链 | flush失败零prepare；一个task/boot；fixedtarget不变，nextboot才新rule | F→W→D/P；timer/subscription cleanup |
| update.idle | HOT IDLE，内容/admin/键盘/SECONDARY真实点击，边界timer；immediate对照 | 最后点击M、原业务动作仍成功、两机隔离，新boot等待，flush失败zeroapply | F→W→D/P；无遗留timer |
| update.install-reminder | FULL初次apply、系统取消/稍后、N、后台/前台/pending/unknown/session消失 | 可silent不额外阻断；samefixedN、zero重复commit、准确真实actual | F→W策略→Dnative；未知session不乱删 |
| update.full-hot | 两App合法B包规则，APK1/JS3→APK2/embeddedJS4→HOT5（含IDLE） | 同task/N-M固定、真实两重启/实际身份、同boot不第二rule | H+W非native→D；ownedZIP/APK/build/APP |
| update.pair | 两个App分别sameApp、不同版本、fullrules投影、失联/re-pair（不同 App 检查仅静态＋既有 focused） | 各自App规则/versions/task/click、公共投影、业务保护/admin、本机state未覆盖、仅MAINreport | F 双 Runtime codec/投影 apply→双虚拟机 P＋H；TR-16 adapter 例外，Web topologyHost unavailable；两设备/reverse/forward/peergrant |
| update.grant | 当前paired同App副机工件、过期/换peer/空间、较大文件清单 | compactwire完整≤64KiB；ZIP/内APK摘要与已有 FULL 身份校验，HOT 清单分支校验；zerocredential/manifest wire；不重选 | F/codec+H+D；grant只attempt、精确preparedrelease |
| update.report | 无taskactual、waiting/partialsuccess/failed、HTTP retry/PONG、BRANCH | CBS同task单历史，最终actual非target，旧binding拒绝、副机无row，pending不挡update | F+H+D/P；保留CBS历史，不伪cleanup删除 |
| update.supply-chain | build→platform上传/解析/保存→operations新建/启用→MAIN自动FULL/HOT→运营报告详情/历史 | 两后台scope/session/标准控件、真实规则自动而非accept fixture、actual匹配、历史task同一行 | 同DEVproductionbrowser＋console 真机双屏；wallpaper mobile 虚拟机核同供给/报告主流程；P 按配对适用子断言；Bhelper复用 |
| update.cleanup | 首败、dispose、staging/browser/dualdevice资源不匹配 | business与cleanup分别；unknown资源不动、FAIL不得完成 | F＋runnerowned readback |

授权时确认设备可用与签名安装渠道。C不同于B临时验证收敛：B单机双屏真机范围不自动覆盖C，C按 §10b.6 已裁定交叉覆盖及 TR-16 规划两 integration Web→真机双屏→mobile 虚拟机→两组同 App 双虚拟机配对；未获授权的执行面保持NOT_AUTHORIZED，不缩分母报全专项PASS。

## 11a. R/V逐条承接，不重复无变化旧验证

| 需求 | C实现或前置 | 场景 |
| --- | --- | --- |
| R01～03 | A/B真实工件/版本/打包前置；C summaryprepare影响A身份/校验 | auto-selection/grant/full-hot；未影响打包重用适用A/Bproof |
| R04～05 | B包库/规则/权限不新增 | supply-chain真实管理动作；B未变化owner proof可复用 |
| R06 | §8.1/8.2 | auto-selection/full-hot |
| R07 | §8.5/6/7 | fixed/pair/grant |
| R08 | §6/7/9 | 全部source调用链 |
| R09 | §8.1/2/3 | fixed/full-hot |
| R10 | A有限重试＋§8.4未知等待 | install-reminder/grant/cleanup |
| R11 | §8.4 | install-reminder/full-hot |
| R12 | §8.3/4 | idle/full-hot |
| R13～14 | A加载/保护复用＋Csummaryinput差量 | grant/full-hot；A未变化T/rollback proof仅按scope复用 |
| R15后续裁决 | §8.8，B报告契约 | report/supply-chain/pair |

| V | C子断言/场景（均NOT_RUN；A/B复用≠本轮新PASS） |
| --- | --- |
| 01 | A两App三产物identity；supply-chain使用真实相同产物，未改builder不整批重跑 |
| 02 | auto-selection/grant拒错App/runtime；A native baseline复用 |
| 03 | B合规上传/配对及grant真实identity；supply-chain不新增极端parser |
| 04 | C改summary输入的普通有效/坏摘要/相对path focused；既定恶意ZIP/symlink/bomb专项按A/B范围NOT_COVERED，不宣称全V04PASS |
| 05 | supply-chain与grant跨space/project拒绝；B原权限proof沿scope |
| 06 | supply-chain不编辑规则，N/M秒分钟读回；B创建/启停focused复用 |
| 07 | auto-selection全部tuple/scope/无规则零动作 |
| 08 | full-hot真实2次启动finalidentity |
| 09 | auto-selection实际build/runtime/samepub及no-downgrade |
| 10 | A/B配对及中间数据兼容为前置；full-hot真实续接，不新增任意schema备份 |
| 11 | B完整分页/topic；C fixed/pair首次/重复/重连与空projection |
| 12 | pair/模块focused无页面、已有state、退订failure、本机state隔离 |
| 13 | pair 同 App 双虚拟机版本独立/H仅MAINrow/协议保护admin；不同 App 拒绝仅静态读回与既有 focused，不进设备分母 |
| 14 | fixed持久化fail、队列双读、停用/断链与双屏one |
| 15 | full-hot优先续接、每boot一次执行、S3确认旧结果后可择新 |
| 16 | install-reminder取消/ended/pending/unknown/technicalfailure |
| 17 | grant/auto-selection有限故障/权限/failedArtifact/no手工retry |
| 18 | install-reminder初次immediate＋N、background/sysUi/resume |
| 19 | idle全部点击/两屏/双机/deadline竞态 |
| 20 | idle/full-hot新boot播种、flushfailure、本机ownerdurable读回 |
| 21 | A真实离线image/font/Hermes适用proof；C各App后继加载验actual，不声称新engineproof |
| 22 | A进程中断proof复用；C waiting-policy/pair当前context与actual续接 |
| 23 | A boot/hydration/failedpage/T；C不拿TDPready当boot确认 |
| 24 | A同Host新boot/旧token隔离；C module/timer旧boot不推进 |
| 25 | A发布纪律/有限rollback前置；CfailedArtifact阻重入 |
| 26 | A已确认不rollback；C断链只资格/业务保护不随意回滚 |
| 27 | full-hot/report实际部分成功，pair副机仅local |
| 28 | report真实HTTP/PONG/ready/lateidentity，B无taskactual接缝先闭合 |
| 29 | R15后续裁决覆盖旧文：运营两Tab enabled终端、任务历史；supply-chain/report，运维不加报告页 |
| 30 | cleanup＋全链脱敏必要日志/owned资源 |

## 12. OPEN与设计准入

- OPEN-B：§0.1具体接口/行为，C implementation前由B收口，不要求Codex并行实施时马上切task。
- OPEN-A：最终实施review/真实native范围及当前summaryprepare改动影响，CP-01确认；FULL最低API≥29按Dexter已裁决，不再询问。
- UI：Dexter已确认C的IA内容（含当前低保真安装再邀请）；真实呈现/可访问性/控件行为仍NOT_RUN，不推成UI动态通过。外部 review 旧字节已获 GO_WITH_UNVERIFIED_UI；本次作者修订不是当前字节独立 verdict，单独实施授权仍未获得。
- OPEN-NATIVE：foreground/presentation桥、pendingIntent重复保护、summaryZIP校验的当前解析版本和API focused NOT_RUN。
- OPEN-PAIR：同App规则投影、下载command与实际driver双设备能力NOT_RUN，须按§8.7/10b.6.1准确落地，新增 forward/reverse、pair laptop 单屏和预算/清理仍未实现；不把主副独立升级变成同步升级。
- 所有F/W/D/P/H/cleanup及生成/编译/verify为NOT_RUN，依赖官方文档仅说明API，不证明装配；本轮不读.runtime。

## 13. 停止边界与实施顺序

仅未来明确C授权后执行。无A/B相关出口、真实credential/fixture/设备身份、依赖依据时停在受影响点；IA内容已确认，实施改变邀请内容时须重新确认。报具体事实/候选，不靠假fixture改变业务。

每实际变更逐点双读＋focused；完整CP fresh三维MATCHED→下一CP；全部CP→独立全批6b MATCHED→适用UI/TestId/资源/seed准入→真实整体验收。昂贵动态失败按failureCategory第二次冻结该族推进，保留首败/lastgood/日志根因、同focused复验后继续；不盲重试、加等待、缩范围或要求Dexter重复授权。

### 13c. 逐代码与详设对账

实施交付前fresh只读审查覆盖本批全部新增/修改/删除符号与其真实caller、两App/port/defaults/contracts/state/driver/UI/fixture/生成消费者，逐条对本稿§8/9、IA/UI、原需求/记忆。缺判据记DESIGN_GAPS。对账MATCHED/OPEN，不替代整批IMPLEMENTATION GO/NO-GO；已完成无变化CP只核影响，不重复整CP。变更后的动态适用范围准确说明，不把A/B旧PASS称currentbyte。

## 14. 模板与交付自检

Journey/IA/UI/template各槽位见各文；本稿§3固定行、§3a控制全集、§4逐CP、§5既有HTTP、§6事实、§7矩阵、§9原子组/锚点、§10bseed/角色、§11/11a场景、§12OPEN、§13阶段/6b/13c均已显式填写。独立review仍须证伪内容而非看标题判PASS。设计自审/结构检查不能代写独立verdict。
