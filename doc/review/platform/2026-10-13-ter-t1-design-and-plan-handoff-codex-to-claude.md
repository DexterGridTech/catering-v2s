# TER 重点代码结构 T1 详设与实施计划编写交接

## 背景

TER 重点代码结构 T1 正式需求已完成独立静态评审，当前结论为 `GO`，`M/S/N=0/0/0`；被评审需求 SHA-256 为 `b92a34101871a53341b334d02235bd301e03ebbebe840d39438302e21712443e`。需求评审报告为 `doc/review/platform/2026-10-13-ter-t1-requirements-review-codex.md`。

该结论仅说明需求静态可接受，不是详设 GO，也不授权源码实施或动态验证。此前需求评审 cycle 已关闭，本次不重开需求 cycle。

## 评审目标

请 Claude 按当前正式需求和已确认裁决，编写一套完整、可实施、可验收的 T1 详设与实施计划。完成后将当前文档交 Codex 做独立复核。设计应从实际用户/维护目标出发，重开真实 owning source，优先复用现成能力；逐项比较简单可行替代，避免目录数量目标、强制空文件、动态 catalog、超级 registry、重复事实或为假设中的未来场景增加框架。

## 需阅读文件

请从 `catering-v2s` 仓库根打开：

- `AGENTS.md`、`CLAUDE.md`、`PLATFORM-BLUEPRINT.md`、`doc/platform/README.md`、`scripts/README.md`：仓库边界与执行入口。
- `project-memory/index.md` 全部 kernel、`project-memory/decisions/deterministic-context-only.md`、六维路由命中的适用原文及 sourceRefs：项目设计约束。
- `doc/platform/terminal-coding-standard.md`、`doc/platform/foundation-charter.md`、`doc/platform/review-standard.md`、`doc/platform/implementation-task-template.md`、`doc/platform/third-party-library-usage-standard.md`：TER 边界、设计/实施模板与验证要求。
- `.agents/skills/cs-spec-to-plan/SKILL.md`：详设到实施计划的仓内工作流程；开始编写前先按该 skill 操作。
- `doc/decisions/templates/implementation-design-template.md`：详设模板。
- `doc/plans/platform/2026-10-13-ter-key-code-structure-t1-formal-requirements-codex.md`：本次设计唯一需求正本，R-01～R-17、V-01～V-18。
- `doc/plans/platform/2026-10-13-ter-key-code-structure-t1-requirements-discussion-claude.md`：用户原话及最终澄清，重点 §1、§11、§13.1。
- `doc/plans/platform/2026-10-13-ter-key-code-structure-t1-source-inventory-claude.json`：源码导航快照，仅供定位，不作为逐分支审计或运行证明。
- `doc/review/platform/2026-10-13-ter-t1-requirements-review-codex.md`：本轮需求静态评审及明确保留的详设义务。

## 独立核验重点

1. 对照每个包的实际业务职责、事实 owner、command/selector、actor、slice、错误和协议常量；盘点按逻辑与调用链完成，不能用文件数量、目录清单或行数替代语义判断。
2. 说明模块声明集中与 actor/slice/selector 具名定义如何协作；保留 actor 对并发、资源与生命周期的单一 owner，不强制一文件一 actor 或拆空文件。
3. 明确现有 Runtime/feature assembly 如何从显式加载模块取得定义，composition 仍负责哪些应用策略、依赖和外部输入；不得增加自动扫描、第二名单、超级 registry 或依赖环。
4. 明确 owner 声明的可同步全集与业务 required projection 的区别，逐项给出主副权威、失效、断链遮罩及 admin 恢复的可验收观察。
5. 闭合外部 HTTP/WS API 的 consumer owner、canonical 契约、生成和消费路径；跨包业务调用走 owner command/selector。TDC 仍是唯一 credential owner，transport 的 owner 定位不变；不得复制凭证或让 TDC 继续持有全业务 API 目录。认证执行窄接口须给出可落地方案。
6. 闭合 `package.json.serverSpaces` 到环境配置、server-config、transport 与 automation 的地址集合；取消已裁定的 One/Two 及旧四条上限，但不扩张当前 DEV 拓扑，也不新增服务发现。
7. 按事实 owner 标明 App/协议/原生版本、持久化键、更新任务、boot 和凭证的来源；区分合法恢复、解绑/换主与取消激活 root reset 的保留和清除行为。
8. 给出规范、canonical 输入、生成器、公开边界、README、测试与唯一 automation driver 的同步范围；R-01～R-17 与 V-01～V-18 逐项映射到设计位置、测试/场景 ID、执行档位及业务断言。尚未运行的项目保持 `NOT_RUN`，不得以计划冒充 PASS。
9. 对实际使用的第三方 API 或默认行为，按仓内规范核实实际解析版本与对应官方依据。若没有新增/变更第三方能力，写明 N/A 原因。

## 期望结论

请交付详设、实施计划、必要的 design-cycle 审查与 finding disposition，并明确残留 OPEN/NOT_RUN。设计包完成后交 Codex 复核；复核请明确给出 `GO` 或 `NO-GO` 及 `M/S/N`。Findings 应包含准确的设计/源码位置、事实与推论、触发条件、影响、最小修正及是否需要 Dexter 裁决。需求评审的 GO 不得当作详设或实现通过。

## 可直接复制给 Claude 的话术

```text
您好 Claude，请按以下授权编写《TER重点代码结构T1优化》的详设与实施计划，完成后交 Codex 复核。

背景：T1 正式需求的独立静态评审结论为 GO，M/S/N=0/0/0；当前需求 SHA-256 为 b92a34101871a53341b334d02235bd301e03ebbebe840d39438302e21712443e。需求评审报告是 doc/review/platform/2026-10-13-ter-t1-requirements-review-codex.md。此前需求 DESIGN cycle 已关闭，本次不重开该 cycle。该 GO 只针对需求静态可接受，不是详设 GO，也不授权实现或动态验证。

目标：请按仓内 cs-spec-to-plan skill 和项目规范，基于正式需求、最终用户澄清与当前真实源码，完成一套完整、简单、可实施、可验收的详设和实施计划；完成后将当前字节交 Codex 做复核。优先复用现有 owner、Runtime、state、command/selector、生成器和唯一 automation driver。对实现形态比较更小替代，避免为假设需求增加框架。

请从 catering-v2s 仓库根阅读：
- AGENTS.md、CLAUDE.md、PLATFORM-BLUEPRINT.md、doc/platform/README.md、scripts/README.md：项目入口、边界与执行纪律。
- project-memory/index.md 的全部 kernel、project-memory/decisions/deterministic-context-only.md，以及六维路由命中的适用原文和 sourceRefs：设计约束。
- doc/platform/terminal-coding-standard.md、doc/platform/foundation-charter.md、doc/platform/review-standard.md、doc/platform/implementation-task-template.md、doc/platform/third-party-library-usage-standard.md：编码、设计、计划与验证规范。
- .agents/skills/cs-spec-to-plan/SKILL.md：详设与实施计划编写流程；动笔前先按该 skill 操作。
- doc/decisions/templates/implementation-design-template.md：详设模板。
- doc/plans/platform/2026-10-13-ter-key-code-structure-t1-formal-requirements-codex.md：T1 正式需求，R-01～R-17、V-01～V-18。
- doc/plans/platform/2026-10-13-ter-key-code-structure-t1-requirements-discussion-claude.md：用户原话与答复，重点 §1、§11、§13.1。
- doc/plans/platform/2026-10-13-ter-key-code-structure-t1-source-inventory-claude.json：源码导航快照，不是语义审计或运行证明。
- doc/review/platform/2026-10-13-ter-t1-requirements-review-codex.md：本次需求评审、当前结论和详设义务。

请重点闭合：全包逐逻辑责任盘点；模块声明与具名 actor/slice/selector 定义的边界；Runtime 和 feature assembly 的现成模块加载与定义派生能力；owner 可同步全集和业务 required projections；消费包拥有外部 API 的 canonical→生成→消费链及 TDC 唯一凭证 owner 的窄认证执行接口；serverSpaces 到 server-config、transport 和 automation 的可变地址链；App/协议/原生版本、持久化、任务、boot、凭证及 root reset 的事实住址；规范、生成器、公开边界、README、测试和唯一 automation driver 的更新范围。

R-01～R-17、V-01～V-18 必须逐项映射到详设与测试/场景 ID、执行档位和实际业务断言。保留用户已确认的 owner 与边界；不得增加动态 catalog、超级 registry、重复同步名单、凭证副本、服务发现或强制空文件。现有 DEV 拓扑保持不变。任何未运行项标 NOT_RUN；详设和计划中不能写成运行 PASS。若发现必须改变已确认业务语义，明确列出候选方案与影响，交 Dexter 裁决。

请按项目治理完成适用的设计审查与逐项 finding disposition，不重开需求评审 cycle。交付详设、实施计划、设计审查/处置记录、未决项及可供复核的当前文件清单。完成后请将这些文件交 Codex 复核，并请求 Codex 给出 GO/NO-GO 与 M/S/N。

授权边界：本次只授权编写 T1 详设、实施计划及其设计审查/处置文档；不授权修改正式需求、源码、测试、脚本、规范、依赖，不授权生成、构建、测试、verify、DEV、Web、Android/设备、reset/seed、L2、UAT、部署或实施。需求静态 GO 不自动扩大本授权。谢谢。
```
