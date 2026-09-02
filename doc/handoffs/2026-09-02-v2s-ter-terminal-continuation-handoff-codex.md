# TER 终端工程跨会话交接

> 生成日期：2026-09-02（Asia/Seoul）  
> 交接角色：Codex `/root`，当前仓的主实施 agent  
> 工作仓：`/Users/dexter/Documents/workspace/idea/catering-v2s`  
> 文档用途：供新的 Codex 会话从当前仓字节、正本材料和证据继续工作；不是新的授权。

## 0. 接手原则

1. 先读当前仓根 `AGENTS.md`，再读 `PLATFORM-BLUEPRINT.md`、`doc/platform/README.md`、选定 Roadmap 的授权字段、`project-memory/index.md` 全部 kernel、六维路由命中的 memory 原文、`scripts/README.md`，然后再读当前任务的需求、详设、证据和 owning source。
2. `.agents/skills/` 是本仓 skill 正本，`.claude/skills` 只是适配链接。涉及 review、运行或写计划时，先读对应 `SKILL.md`，不要用全局同名 skill 代替。
3. 旧会话、作者自述、Claude 结论、报告里的数字都只是输入；接手时重新打开当前源码和原始材料。静态、typecheck、测试、TER-local verify、Metro export、设备、browser L2、DEV、seed、UAT、部署分别记档，不能互相升格。
4. Git 由 Dexter 完全控制。不要要求、建议或执行 Git 提交、分支、reset、checkout、清理等仓库控制动作；不要覆盖其他 agent 的工作树改动。
5. 任何产品语义、Journey、权限、范围或新出边问题先停下并请 Dexter 裁决；不要用“按需”“兼容”“先留着”自行扩大设计。

## 1. 工程背景与不可突破的边界

这是 `catering-v2s` successor execution 仓，不是 `catering-all-v2` 状态副本。TER（Terminal）是仓内 22 包的纵向骨架与后续 kernel/UI 能力建设线，采用 Expo/React Native/TypeScript 与 Expo Module adapter，仓级后端另有 agent 在实施，工作树可能很脏。

必须遵守的核心规范：

- TR-01：生产写入路径必须是 command → actor → `dispatchAction`；不要以 event bus、回调注册、effect 列表或包装器制造旁路。
- TR-02：失败必须可观察、typed、可区分；不可把排队、静默丢弃、无动作或未注入适配器报成成功。
- TR-03：读侧遵守受保护的 store/root 访问边界；不凭字符串门把能证明的范围扩大成不可证明的语义。
- TR-04：重启/持久化语义要用跨 runtime 实例的真实替身证明。
- TR-05：公开类型禁止 `any`、`Record<string, unknown>` 与双重 `as` 等逃逸，扫描面按正本执行。
- TR-06：时间/ID 例外只覆盖 `Date.now`、随机/ID 生成及正本点名的固有派生构造器；依赖时间的行为仍须假时钟精确断言。
- TR-08/09：端口是 kernel 访问外界的唯一入口；plannedKind、slice、跨包写和例外必须按正本边界处理。
- TR-10：每个 TER 包收口交中文 README，写定位、作用、结构、用法和“在这个包上迭代时”。
- TR-11（新增硬规则）：事件到业务逻辑只有事件 → command → actor → `dispatchAction` 一条路径；command 由能依赖 runtime 的一侧定义，低层 `platform-ports` 不能反向依赖 runtime；不得把写能力交给回调、effect 列表或事件总线。

其他硬边界：不做仓级 normal `scripts/verify`，不做 native/Gradle/真机/设备自动化、DEV、reset、seed、browser L2、UAT、部署或 EAS，除非 Dexter 另行授权。TER-local 自有 typecheck/test/static/export verify 可以按已批准包范围运行，但仍须保留原始输出、first failure、last known good、broken boundary、business 与 cleanup。

动态运行规则：长运行前做 run-scoped 资源预检；PID 必须带受控 start token（远端还需 host、boot id、start ticks）；日志要结构化、脱敏、可关联；30 秒以上动态运行每 30 秒报告，非动态等待每 60 秒报告；无新日志是诊断信号，不得盲等或延长 timeout 冒充修复。

外网下载约定：Google 官方源使用本机会话代理 `127.0.0.1:7890`；Aliyun 源直连。不要为绕过供应链/age gate 更换包管理器或关闭保护。

## 2. 交接时的固定读序

新会话实际接手任何动作前按以下顺序恢复：

1. `/Users/dexter/Documents/workspace/idea/catering-v2s/AGENTS.md`
2. `/Users/dexter/Documents/workspace/idea/catering-v2s/PLATFORM-BLUEPRINT.md`
3. `doc/platform/README.md`、`doc/platform/roadmap-program-registry.json` 及当前 program 的显式授权字段（Roadmap 不提供当前步骤真相）
4. `project-memory/index.md` 全部 kernel；用 `scripts/memory/query` 按六维命中并读 `deterministic-context-only.md`、terminal 架构/stack rulings、review/observability/verification governance 等原文
5. `scripts/README.md`
6. 当前 owner 包的 requirements、implementation design/plan、HANDOFF、evidence、review request、当前源码和工具 checker
7. 动手前、动每个点后都双读同一组正本与 owning source；完成 CP 后且进入下一 CP 前必须由 fresh 独立子 agent 做三维（需求、详设/计划、project memory/标准）证伪式对账；全部 CP 完成后进入整体测试前再做一次全范围对账。

## 3. TER 总体进度（已完成部分）

### 3.1 骨架

- TER skeleton 已建成 22 个包：批一 14、批二 8；assembly 入口闭包 22/22，无孤儿、环或层级反向边。
- skeleton、contracts、platform-ports、state、runtime 等包的设计/实施经历多轮独立 review；“静态 GO”不等于 native、设备或生产能力已证明。
- 入口可达规则是静态结构规则：bootstrap 的直接 workspace imports、exact-set、无动态 import/require/深层路径；不得用 `dependencies.ts` 旁路冒充入口可达。

### 3.2 已完成的基础包

- `kernel.base.contracts`：需求、详设、实施与复核已完成；当前已知公开面快照为 69，含 branded ID、错误协议、descriptor/command 等共享词汇。再次接手要从当前字节复核，不把旧数字当实时事实。
- `kernel.base.platform-ports`：端口层已实现并复核；当前已知公开面快照为 125。默认端口、四态/五态结果、统一脱敏漏斗、typed unavailable、surfaceKey→containerKey 命名修正等已落地。
- `kernel.base.state`：持久化/同步实现已完成并复核；当前已知证据为约 67 条用例、公开面 56 的历史快照。要点是 list/read 一次、逐 key 差量提交、baseline unknown 写栅栏、blocked 后一次有界 rebaseline、preloadedState hydrate、前缀 reset、全量 sync snapshot；record entry 是独立提交单元，不承诺整份 record 原子性。
- `kernel.base.runtime`：单元 A（运行时骨架）与单元 B（request ledger）均已实施，A 经三轮静态 implementation review，B 经设计/实施复核。A 的结构已修复：资源释放 finally、订阅登记、signal ref、统一 aggregate、payload 校验、反向 command declaration 检查、brand 绑定等。B 的台账是两个单写者 slice，读取侧合并；状态在 selector/reselect 动态计算，不存派生状态；单边状态按该边计算（Dexter 裁定）。

### 3.3 门缺陷整改线（历史背景）

曾有 TER gate defect registry（D-1…D-24）及单元 A/B 的整改设计/实施。已确认的原则包括：invariant 迁移不能被合法公开面变化作废；D-4 用 package-owned marker/contract 防止“删测试也绿”；D-6 的持久化退役必须由行为门接管；统一 AST 收集器要覆盖 import type、export type、ImportTypeNode、字面量 require、动态 import。该线不是当前 display-context 的下一步授权，勿自行继续或重开仓级 normal verify。

## 4. 当前主线：kernel.base.display-context

### 4.1 当前范围与设计

当前包已按 `DC-P0` 到 `DC-P5` 实施，范围为：

- `displayRole` slice 与持久化派生；
- 三条 command/actor 路径（切 display role、启动校验、runtime role changed 后重置）；
- 五个纯函数与 selector；
- `getDisplayInfo` 端口桥接，v1 只冻结 `displayCount`；
- 电源状态 command 桥：首事件播种、同值去重、dispatch tail 串行、双层 catch、空 subscriptionId 视为无效、release 幂等；
- 单屏/多屏及畸形端口结果 fail-closed；VICE 写路径各自实时调用 `getDisplayInfo`；CHIEF 是安全侧；
- TR-11 post-commit 角色变化 command：runtime 提交角色后派发，display-context 自己定义 actor 处理；不再保留 `roleChangeEffects`/action-returning effect 方案；
- 模块工厂、README、kind 迁移、display-context → platform-ports 合法依赖边及 TER-local 接线。

唯一明确 deferred：transport 尚无 activation/activated 契约，因此第 4.6 条“已激活主机不得切 SLAVE”暂不建。不能用 display-context 反向定义 transport 契约。

Dexter 还裁定：v1 无独立 UI 确认步；未来若有确认，确认动作自己也是 command。`displayCount` 语义冻结为已连接物理屏数，不含虚拟屏/投屏，必须为正整数；缺失、零、非整数、大于一按畸形/非成功处理。角色切换和启动校验均不可把 unavailable 或 malformed 当放行。

### 4.2 已完成的 finding 修复

本轮静态 implementation review 报告的处理状态：

- S-1 已闭合：在 `apps/terminal/kernel/base/display-context/test/behavior.test.ts` 的 A-3 里加入直接的多屏 switchDisplayRole 用例。场景是 SLAVE + PRIMARY route + 目标 VICE + `displayCount=2`，断言命令/actor error、角色仍 CHIEF、端口被调用及 `multiple-physical-displays` policy boundary。
- S-1 定向 red/green 变异已实际跑过：把 `src/foundations/displayDerivation.ts:31` 的 `displayCount !== 1` 临时改为 `< 0`，测试失败为 `expected 'error' to be 'completed'`；恢复后 focused test 通过（1 passed、21 skipped、约 313ms）。
- S-2 采用“登记生产 teardown 欠账”路径：`registerResource` 目前只有 test-only `releaseRuntimeForTest` drain；Runtime 无 production stop/dispose/shutdown，生产 native subscription 依赖进程退出回收。没有自行扩建生产 teardown。
- N-1 已闭合：`src/application/createPowerStatusBridge.ts` 尾部注释改为事实描述：registry 仅由 test-only release 排空；生产无 stop/dispose，进程退出回收；disposer 在未来生命周期存在前有意未使用。
- `apps/terminal/kernel/base/display-context/HANDOFF.md` 已登记同一 teardown 欠账。
- N-2 仅登记：persistDisplayRole 软失败可能在重启后回到 CHIEF，结果带 `persistenceStatus`，当前无消费者；不在本轮再扩机制。
- N-3 仅登记：MASTER 下 eligibility 拒绝 role change 是当前语义；runtime role reset 走独立 actor，不把该谓词当清理入口。

### 4.3 当前新鲜证据

证据文件：

- `/Users/dexter/Documents/workspace/idea/catering-v2s/doc/evidence/platform/2026-09-02-v2s-terminal-kernel-base-display-context-s1-s2-n1-recheck-evidence-codex.md`
- `/Users/dexter/Documents/workspace/idea/catering-v2s/doc/evidence/platform/2026-09-02-v2s-terminal-kernel-base-display-context-implementation-evidence-codex.md`

给 Claude 的复核 brief：

- `/Users/dexter/Documents/workspace/idea/catering-v2s/doc/review/platform/2026-09-02-v2s-terminal-kernel-base-display-context-implementation-recheck-review-request-codex.md`
- 原实施 review brief：`/Users/dexter/Documents/workspace/idea/catering-v2s/doc/review/platform/2026-09-02-v2s-terminal-kernel-base-display-context-implementation-review-request-codex.md`

fresh 独立子 agent 的只读三维复核：

~~~text
REVIEW_TARGET=IMPLEMENTATION
SCOPE=TER_DISPLAY_CONTEXT_S1_S2_N1_RECHECK
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
VERDICT=GO
M=0 S=0 N=0
~~~

TER-local 新鲜输出（不含仓级 normal verify）：

~~~text
yarn workspace @catering-v2s/kernel-base-display-context typecheck
yarn workspace @catering-v2s/kernel-base-display-context test
exit 0
4 test files / 55 tests passed
TERMINAL_PACKAGE_TEST=PASS kind=REAL_TESTS package=@catering-v2s/kernel-base-display-context
~~~

~~~text
yarn workspace @catering-v2s/terminal verify:static
exit 0
TERMINAL_STATIC=PASS
run=ter-local-static-91731-1788308466425
~~~

~~~text
yarn workspace @catering-v2s/terminal verify
exit 0
TERMINAL_STATIC=PASS
TERMINAL_TURBO_DRY_TYPECHECK=PASS packages=22 tasks=22 executable=22
TERMINAL_TURBO_DRY_TEST=PASS packages=22 tasks=22 executable=10
TERMINAL_TURBO_DRY_LINT=PASS packages=22 tasks=22 executable=0
TERMINAL_TURBO_DRY_CLEAN=PASS packages=22 tasks=22 executable=0
TERMINAL_TEST_MARKERS=PASS real=5 noTests=5
Android Bundled 1656ms apps/terminal/assembly/android/pos-desktop/index.ts (730 modules)
TERMINAL_VERIFY_CLEANUP=PASS
TERMINAL_VERIFY=PASS
run=ter-local-92410-1788308509561
~~~

补充事实：`multiple-physical-displays` 当前在 display-context test 目录出现两次；`DIST_ABSENT`；最初一次从仓根跑 Vitest 的 “No test files found” 是 cwd 错误，不是实现失败，随后按包目录正确重跑。

### 4.4 仍未证明/不可升格的边界

- Claude 尚未返回 follow-up implementation recheck；上面的 fresh subagent 是独立静态检查，不替代 Claude 的新鲜复核。
- TER-local static/typecheck/test/export/Metro 只证明 JS/结构/测试闭包；不能证明 native、Gradle、autolinking、真实 adapter 能力、真机/模拟器用户行为。
- 电源生产订阅没有 Runtime teardown；这是已登记欠账，不得自行扩展为生产 stop/dispose。
- `displayCount` 只冻结 v1 字段；activation gate deferred，需 transport 先提供正本契约。
- `persistDisplayRole` 的软失败和重启后的安全回退已知但无当前消费者；不要在未授权范围内补持久化策略。
- 不能宣称浏览器、双屏、杀进程重启、设备自动化、DEV、seed、reset、UAT、部署或 EAS 已证明。

## 5. 相关文件与源码入口

显示上下文：

- 包根：`apps/terminal/kernel/base/display-context/`
- 入口：`apps/terminal/kernel/base/display-context/src/index.ts`
- 行为测试：`apps/terminal/kernel/base/display-context/test/behavior.test.ts`
- 派生：`apps/terminal/kernel/base/display-context/src/foundations/displayDerivation.ts`
- 电源桥：`apps/terminal/kernel/base/display-context/src/application/createPowerStatusBridge.ts`
- 包交接：`apps/terminal/kernel/base/display-context/HANDOFF.md`
- 需求正本：`doc/plans/platform/2026-09-01-v2s-terminal-kernel-base-display-context-requirements-claude.md`
- 详设/计划：查当前目录下对应 `*-codex.md` 文件，以文件当前字节为准。

TER-local 工具：

- `tools/terminal-skeleton/`
- `tools/terminal-contracts/`
- `tools/terminal-platform-ports/`
- `tools/terminal-state/`
- `tools/terminal-runtime/`
- `tools/terminal-display-context/`
- `apps/terminal/skeleton-graph.ts`
- `apps/terminal/package.json` 与 TER-local `verify`/`verify:static` 脚本

项目规范与 memory：

- `doc/platform/terminal-coding-standard.md`
- `project-memory/decisions/terminal-architecture-and-stack-rulings.md`
- `project-memory/decisions/deterministic-context-only.md`
- `doc/platform/claude-review-handoff-template.md`
- `project-memory/operations/claude-review-handoff-standard.md`

## 6. 下一步（当前交接点）

1. 保持当前 repository bytes 稳定，等待并接收 Claude 对 `2026-09-02-v2s-terminal-kernel-base-display-context-implementation-recheck-review-request-codex.md` 的复核；不要把等待误写成源码完成，也不要主动开始下一个 owner 包。
2. Claude 返回后，逐条回源核验其 finding；若无新缺陷，形成实现收口交付给 Dexter。若有 finding，按既有授权与停机条件处理，不自行扩大范围。
3. 若 Dexter 授权下一个步骤，先重新读取当前需求/详设/计划/项目记忆和当前源码；不得从本 handoff 的旧快照直接实施。
4. 任何新代码步骤都要先做 focused proof，随后由 fresh 独立子 agent 做逐项三维对账；所有步骤完成、整体测试之前再做一次全范围对账。

## 7. Claude handoff 规则

需要转交 Claude 时，最终回复必须直接给可复制中文 brief，至少包含：背景、`REVIEW_TARGET`、`REVIEW_CYCLE_ID`、`REVIEW_ROUND`、`REVIEW_ROUND_LIMIT`、`reviewerKind=INDEPENDENT_SUBAGENT`、仓根相对路径、当前证据与源码路径、独立核验重点、`GO/NO-GO` 与 `M/S/N` 格式、`CONFIRMED/PARTIALLY_CONFIRMED/REJECTED_WITH_EVIDENCE/UNVERIFIED_REQUIRES_EVIDENCE/DEXTER_DECISION` 档位、授权边界。不得只贴链接或说“请 review”。

display-context follow-up 的当前 brief 已经存在，下一会话不应另造一个互相冲突的 cycle；使用其路径并保持当前 `REVIEW_CYCLE_ID`/round 口径。

## 8. 进展汇报格式

任何持续超过五分钟的 task，在 commentary 中每 <=5 分钟报告一次；动态运行超过 30 秒每 30 秒报告。严格使用六行：

~~~text
GOAL：整体 GOAL 是什么；无 active goal 时写“无”。
TASK：当前 task 的明确目标，以及“无漂移”或实际漂移及处置。
DONE：本 task 已真实完成的内容；无则写“无”。
ON：正在做的具体动作，以及其是否符合当前执行要求。
NEXT：完成手头动作后的具体下一步。
LEFT：当前task剩余X%待完成，当前goal剩余Y%待完成。
~~~

`LEFT` 行除两个百分比外不得增加文字。阶段性结果只能放 commentary；只有批准完成条件、明确需要 Dexter 决策、或受控阻断已完成根因定位且无安全下一步时才能发送 final。

## 9. 一句话接手摘要

TER 22 包骨架及 contracts/platform-ports/state/runtime 已完成；display-context DC-P0…DC-P5 已实施，S-1 的多屏 VICE 行为缺口已用真实红绿变异闭合，S-2 生产 teardown 欠账已登记，N-1 注释已修，TER-local 新鲜 verify 全绿。当前唯一正确动作是保持字节稳定、等待 Claude follow-up recheck，然后把结果交 Dexter；任何新 owner、native、设备、DEV、seed、reset、browser L2、UAT、部署或仓级 normal verify 都需要新的明确授权。


