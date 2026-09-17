# catering-v2s AI 执行入口

`catering-v2s` 是 successor execution 仓，不是 `catering-all-v2` 的状态副本。任何会话都必须从本仓根开始，并按以下顺序恢复上下文：

1. 读取本文件与 `PLATFORM-BLUEPRINT.md`；
2. 读取 `doc/platform/README.md`，再从 `doc/platform/roadmap-program-registry.json` 选择显式 `programId`，读取该程序 Roadmap 的**授权字段**(`R*_AUTHORIZED` 与 `V2S_*` 就绪标志)。⚠️ Roadmap 的职责已于 2026-08-19 收窄为**授权记录**，`CURRENT_STEP`/`CURRENT_NEXT_ACTION` 等状态字段已删除；「当前在做什么」的真相源是 Dexter 在会话中的直接指派，不得从 Roadmap 推断；
3. 读取 `project-memory/index.md` 的全部 kernel，再用 `scripts/memory/query` 按六维路由读取全部命中原文；
4. 读取 `scripts/README.md` 和当前步骤明确引用的 decision、plan、contract 与 evidence；
5. 只有当前 Roadmap 的显式授权可以开始对应步骤。
# 核心思想
* 以第一性原理思考问题。理解需求背后的真实目标，而不是直接套用已有模式或技术方
* 优先解决本质问题，避免为假设中的未来需求提前设计复杂系统
* 在保证长期可维护性的前提下，选择当前最简单、可靠、清晰的实现方案

# 简洁与设计原则
* 遵循KISs(Keep It Simple,Stupid)原则:优先选择简单直接的实现，避免不必要的复杂度。
* 遵循DRY(Don't Repeat Yourself)原则:避免重复逻辑，但不要为了消除少量重复而创建过度抽象。
* 遵循SOLID思想:保持职责清晰、降低模块耦合，提高代码可维护性和扩展能力。

# 架构原则
* 不要为了保持向后兼容而长期保留废弃方案。优先删除过时代码，而不是增加兼容层、fallback或临时迁移逻辑
* 不要进行未经验证的架构设计。避免提前引入抽象、配置和间接层。
* 永远不要用未来可能需要的复杂性，牺牲当前产品的可用性。

# 代码质量原则
* 保持模块职责明确，避免一个模块承担过多职责。
* 优先使用成熟、稳定、维护良好的第三方库，而不是重复造轮子。
* 使用项目已有依赖解决问题之前，不要随意新增依赖。
* 在引入新方案前，先检查已有代码、依赖、文档和能力。
* 避免为了“看起来更优雅”而增加实际复杂度。
* 后台编码规范唯一正本见 [`doc/platform/backend-coding-standard.md`](doc/platform/backend-coding-standard.md)；前端编码规范唯一正本见 [`doc/platform/frontend-coding-standard.md`](doc/platform/frontend-coding-standard.md)。本文件只保留执行入口与边界，不复制两份规范正文。

# 工程决策原则
* 优先选择长期可维护的方案，而不是只能临时运行的解决方案。
* 代码应该服务于业务目标，而不是为了展示技术复杂度
* 如果简单方案已经满足需求，不要主动升级为复杂方案。
* **业务准确性优先于 DB 效率与预算数字**：不得为降低 SQL/DB 操作数而删除、合并或弱化业务事实、owner 复核、事务、幂等回放、并发锁、typed problem、审计或权威 readback；当逐事件证明现有闭包正确、优化收益小于安全改造成本时，可由 Dexter，或由 Dexter 在当前实施授权与详设中明确委托的实施 agent，以精确 operation-scoped `decisionRef` 放宽单一 operation 的预算。该例外有且仅有双重准入：一是不削弱任何业务事实；二是证明通用能力和既有可复用能力已实际复用，不存在以重复实现、遗漏抽象或可消除 owner fan-out 换取的计数。实施 agent 自主记录必须声明 `authority=IMPLEMENTATION_AGENT`，历史 Dexter grouped 记录声明 `authority=DEXTER`；机器门拒绝实施 agent authority 的多 operation scope。记录必须写明这两项证明、事实、替代方案、成本与适用边界，并保留未经明确裁决的上调 red mutation；不得用于线性批量预算、operation 身份/数量、契约/模型或未决产品语义；DB 门不得成为正确业务无法交付的阻断借口。

## 不可突破的红线

- 一个业务 deployable；一个 PostgreSQL 数据库、多 owner schema、单一 Flyway history。
- 模块 owner 保有事实与命令主权；跨模块写只调用目标模块公开 command API，并加入同一 `REQUIRED` 事务。
- 跨 schema 读取只允许显式任务型 join；不得由 read edge 推导写入、锁、事务或 FK 权限。
- 初始不引入 MQ、通用 outbox、TDP、内部 OpenAPI client 或常态轮询。
- `x-consumer-faces` 是 HTTP 暴露面的单一真相；`platform-admin` 与 `operations-admin` 是两个独立 app。
- 术语固定：**运维管理后台 = platform-admin**，**运营管理后台 = operations-admin**；不得因“运维/运营”近似而互换、合并或据此改变 actor、session、URL、权限或 owner 边界。
- DEV start/restart 可执行 additive Flyway，但绝不 seed；reset/seed 是独立、显式、破坏性动作。
- **环境执行矩阵（Dexter 裁决，强制）**：DEV、backend acceptance 与当前受管浏览器 L2 的 Spring/Java 后端均在受信远端非生产主机运行，并与 PostgreSQL/对象存储同侧；本机只运行 platform-admin、operations-admin 两个 Vite（browser L2 另由本机 Playwright 驱动），经受管 tunnel 仅转发远端 Java HTTP 与浏览器直连所需的资产端口。禁止 PostgreSQL tunnel、本机 Java fallback、远端 Vite 或远端浏览器。DEV 可长期运行但不得 seed；browser L2 仍使用每 run 隔离的远端数据库/asset namespace，并分别证明远端 Java、HTTP/asset tunnel、本机 Vite/Playwright 及两侧 cleanup。只有后续获得单独授权的 UAT 才全量远端部署与执行；不得用 DEV/L2 冒充 UAT，也不得把远端 Testcontainers 技术验证误称浏览器 L2。若受管 runner 尚未实现对应远端后端拓扑，必须 fail closed，不得继续使用已退役的本机 Java + PostgreSQL tunnel 形态。
- Heritage 仓只读，禁止 runtime/build fallback；偏差在本仓新增 decision，不回写旧仓。
- **能力命名而非流程命名**：流程/步骤/Journey ID（`R*`/`U*`/`J*`/`JG*`/`PKG*`/`G-*`）只允许出现在 `doc/`、evidence/review/memory 与 gate catalog 元数据；禁止进入 runtime 或测试的目录、包、文件、类名。依据冻结 Heritage `runtime-source-organization-must-not-follow-journey-ids.md@f88855cc3583026ad6edf7afb3e729c46705ea5f30fa7d635acd6784db9c236a`；代码目录约束仍由 `code-layout` 负责。
- 前端对每个获批 UI-bearing Journey 先按 `doc/decisions/2026-07-25-v2s-frontend-asset-carry-over-first.md` 盘点 all-v2 对应页面并以静态摹本/截图为线框基线；未来实现期页面、组件、shell 与 foundation 默认显式搬运，generated wire 按 v2s edge OpenAPI 重生成。该原则不授权实现，也不解除 Heritage 的只读、hash-bound、零 runtime/build fallback 边界。
- **共享前端 foundation 强制对接**：后续任何 UI 功能实现必须先检查并对接 `libraries/frontend/admin-ui-foundation` 已提供的能力；不得在 `apps/frontend/*` 重复实现同一共享行为、生命周期、Drawer surface、overlay lock、列表上下文、HTTP protocol、observability 或 automation primitive。App 继续拥有自己的 shell、router、store、baseApi、theme、generated API、业务 feature、业务文案和 Journey 行为；只有 foundation 未覆盖且经设计说明的能力才可留在 App 内。当前 R3 foundation 已复制但未接入，不构成 R3 业务闭环；后续 UI 功能接入时必须补对应 focused test/evidence。
- **可编辑 Drawer 的 dirty ownership**：dirty、关闭确认和“请先保存/放弃修改”提示只能由承载表单的 `useDrawerFormLifecycle` 统一管理；`Form.Item`、Switch/Input/Tree 节点及其他子控件不得自建 dirty、close guard 或用户提示。Shell 只能消费 foundation 的 `locked` 阻断导航/上下文切换，不得把 `dirtyLocked` 渲染成第二个常驻提示。详细判据见 `doc/platform/frontend-coding-standard.md` §3-K-2 与 `project-memory/practices/drawer-form-lifecycle.md`。
- **AI 协作与仓库控制边界（强制）**：项目只有codex和Claude两个AI在Dexter的分工下协调，git的所有操作权都在Dexter身上，codex和Claude都不得在任何节点要求Dexter必须执行git动作，Dexter想不想git、想什么时候做都不影响任何设计和开发工作，后面codex和Claude都不得再提git的事情。规范原文与执行条款见 `doc/decisions/2026-07-25-v2s-agent-coordination-and-control-boundary.md`；不得以仓库控制动作阻断任何设计、实施、测试、评审、证据或收口工作。
- R3 backend 物理上保留并列 app 目录：`apps/backend/catering-business-server` 是当前唯一业务 deployable，`apps/backend/terminal-data-server` 是未来 TDP 的空占位；此边界由 `doc/decisions/2026-07-25-v2s-backend-app-layout-and-tdp-placeholder.md` 固化，不得在 R3 为 TDP 添加 runtime、契约、数据库、migration、seed 或业务代码。
- **Roadmap R 原子交付**：每个 `R` 都是一次性完整交付单元，必须按“该 R 一次性完成设计 → 该 R 一次性完成实施 → 该 R 全范围一次性完成复核”执行。不得把同一 `R` 按 Journey、模块、文件、App 或单项 gate 拆成独立设计确认、独立实施交付或独立复核；单项 gate 只能是该 R 统一交付中的内部证据。当前 R3 的统一复核范围是 R3-C01 + R3-TECH + U01-U07。
- 凡需 Dexter 转交 Claude 的评审，Codex 最终回复必须直接渲染可复制中文 brief：背景、目标、仓根相对路径、独立核验重点、`GO`/`NO-GO` 与 `M/S/N` 格式、授权边界；不得只给链接或说“请 review”。详见 `CLAUDE.md`、`doc/platform/claude-review-handoff-template.md` 与 `project-memory/operations/claude-review-handoff-standard.md`。
- R3–R6 及后续验证遵循 `doc/decisions/2026-07-24-v2s-verification-governance.md`：机器门只作一行可说清的机械判定并须有真实 red mutation；业务语义靠 fresh 独立对抗审查与 Claude review，产品取舍和 severity 归 Dexter；建门先过三问，交付超过半小时审阅量先切小，`scripts/verify` 必须保持分钟级。
- **compliance-control 控制面已退役（Dexter，2026-08-13）**：不得再要求或恢复 evidence 台账、package entry/exit、六类 source 分母、Pre/Post compliance hook、incremental receipt、hash-chain、P0/W0/P1、manifest Part B/C/D 或 `scripts/check/implementation-design-granularity`。实施仍须以原始需求、适用详设和真实源码为准，并用实际编译、类型、测试或运行结果判断行为。
- **实施节奏、逐点双读与步骤级独立对账**：准备只做到当前待改点可执行、可复核所需的最小输入，不能以泛化准备替代实际修复。每一个实际变更点写入前，必须逐项重开对应 IA/原始业务条目、六维路由命中的全部项目记忆及 owning source、适用详设/设计约束和当前可复用源码；完成该点的 focused proof 后，必须用同一组原文逐项回读源码与证据，确认没有偏离用户任务、交互、owner 或约束。长任务按 CP 或其他已批准实施步骤推进时，**主 agent 只负责设计与代码/文档实施；当前步骤结束且开始下一步骤前，必须由 fresh 独立子 agent 对当前步骤完成逐项三维对账与证伪式审查**（三维＝需求文档、详设与 IA、项目记忆里的设计规范，缺一维即未完成）。该步骤级审查逐条比较行为、形态、动作、关系、位置、用户可见文案、限制、状态/控制、失败/恢复、可访问性/焦点、数据来源/失效边界；任一不一致必须由主 agent 修复并接受新的独立复查，禁止把偏移累积到全链测试或最终 review 再发现。**全部步骤完成后、进入整体测试之前，还必须对全批范围再做一次逐条三维对账**；它不是阶段对账的汇总，跨步骤偏移只有整体对账能发现。⛔ 本应在开发阶段解决的问题不得留给测试发现。步骤级对账不产出整批 `GO`/`NO-GO`，本身不设轮次上限；整批 `REVIEW_TARGET=IMPLEMENTATION` 对抗 review 仍必须由 fresh 独立子 agent 执行，不设轮次上限但必须依据详设文档。独立审查者必须取得并逐点核查该前后双读留痕；缺项是 finding，不得以总览阅读、静态通过或后续 L2 代替。
- **主 agent 唯一编码与文件写入（强制）**：所有代码、测试、依赖、脚本与文档的新增、修改、删除只能由主 agent 完成。子 agent 的职责仅限只读静态 review、源码/文档对账与报告 finding；不得调用会写入文件的工具，不得代写实现或测试，不得以“并行实现”替代主 agent 的编码责任。主 agent 必须在接受子 agent 结果前核对工作区是否有非主 agent 写入，并由主 agent 处理全部修复。
- **已识别问题必须抽象并防再犯**：任何已确认的设计、实施、测试或验证问题都必须在关闭前抽象为通用失败模式、根因层、有限适用范围、反例边界与可复用最小解，并落到 project-memory、真实可运行的既有测试、明确 review checklist，或有具体反例的 `NOT_APPLICABLE_WITH_REASON`。用户点名的文件、字段、字符串或失败信号只能作为问题族入口；修改前必须完成同根扫描与反例查找，禁止单点修补。不得以 prompt intake、per-edit hook、receipt 或 package 枚举替代根因分析与亲验。
- R1 与 R2 已关闭，`V2S_FOUNDATION_READY=true`。Dexter 已暂停 `R3-J02` 的 implementation-facing 设计；其既有 selection/design/manifest/review/handoff 统一为 `PENDING_RECOVERY`，保留但不得继续用作 handoff、implementation 或“operations 已可真实登录”的依据。第一批与 `DESIGN_GOVERNANCE_BATCH_1_5` 已获 Claude GO，并于 2026-07-25 由 Dexter 接受；Batch 2 inventory 亦已由 Dexter 接受。Dexter 已接受 R3-C01 carry-over-first 线框，并授权一次性形成整个 R3 的 implementation-facing 详设与实施计划：C-01 是唯一业务 Journey，设计同时覆盖 R3-TECH、契约、脚本、后端、数据库、双 app 边界、测试与证据，冻结后经自审、Claude review；不得把 C-01 拆成新的逐文件确认门。Dexter 已进一步授权 R3 implementation；U01 Gate 0 已 PASS，后续 U02-U07 按已接受详设继续。该状态不恢复 J02/C-02；`R3-C02` 在 R3 的运营用户真实登录仍被删除。旧 `R3-J01` 是历史 `NO_GO`，不得复用审查轮次或作为实现入口。Codex 已自主补齐 D.1 `code-layout` 机械 gate 并使 R3 standards coverage PASS。

项目 skill 的唯一真相根是 `.agents/skills/`；`.claude/skills` 只是同仓适配链接。禁止读取全局同名 skill 代替本仓 skill。Prompt hook 只推荐 skill，不查询或注入 memory/code；源码影响面只走 `rg`、源码和编译器。

任何 design、implementation、review 或 testing 会话仍须读取 `project-memory/decisions/deterministic-context-only.md` 并重开当前任务命中的原始材料；`contracts/policy/standards-coverage-matrix.json`、冻结 manifest 复算和 `scripts/check/standards-coverage` 不再是准入或交付要求。`project-memory/index.md` 是生成导航，不是规则 memory anchor。

自下一个 review cycle 起，所有 `REVIEW_TARGET=DESIGN` 与 `REVIEW_TARGET=IMPLEMENTATION` 对抗审查必须按 `doc/decisions/2026-07-25-v2s-independent-subagent-adversarial-review-governance.md` 由 fresh 独立子 agent 执行；作者会话只能在独立 verdict 后做辩证 intake 与处置，不得代写 verdict。子 agent 必须完整读取其最小输入清单，并先以证伪为立场形成 findings/verdict，再可对照作者材料。实施完成后仍须以 `REVIEW_TARGET=IMPLEMENTATION` 重开真实生产源码与用户行为 evidence；“按已批设计实现”不能豁免重新判断方案是否合理。UI 必须证明操作来自批准 Journey、符合用户任务且不存在更优路径；接口限制、旧文档模糊或产品歧义必须显式归因，涉及产品/Journey/页面操作时向 Dexter 求证。缺少独立子 agent 留痕的该轮不得 GO，也不得把 Claude 后续复核当作替代。

任何对抗审查 finding 都只是一条待验证输入。Codex 必须逐条重开 owning source/代码/evidence，外部漂移事实查官方一手资料或做可复现实验，主动找反例与适用边界，并标明 `CONFIRMED / PARTIALLY_CONFIRMED / REJECTED_WITH_EVIDENCE / UNVERIFIED_REQUIRES_EVIDENCE / DEXTER_DECISION`；不得全盘接受 reviewer，也不得在信息不全时武断裁决。修复建议还必须比较更小替代和阶段成本，拒绝因审查而过度设计；只有已确认部分可驱动修改，产品/Journey 歧义仍回 Dexter。

轮次上限按 Dexter 2026-09-14 裁定区分，正本见 `doc/decisions/2026-07-25-v2s-independent-subagent-adversarial-review-governance.md` 第 1 节。`REVIEW_TARGET=DESIGN`（agent 自己的需求、详设或实施计划）的独立子 agent 对抗审查，同一 `REVIEW_CYCLE_ID + REVIEW_TARGET + 批准范围` 最多两轮：第一轮找盲点，第二轮定向核验并硬停止，作者基于独立 findings 与处置结果按既有 `SELF_DECIDED` 规则收口。换 reviewer/模型/文件名、措辞或局部修订不得重置轮次；只有 Dexter 实质改变 Journey、批准范围、授权边界/目标，才建立并说明新 cycle。第二轮后禁止再召集第三轮；未决产品与权限事项直接交 Dexter。DESIGN 每轮产物必须声明 `REVIEW_CYCLE_ID`、`REVIEW_ROUND=1|2`、`REVIEW_ROUND_LIMIT=2`、`reviewerKind=INDEPENDENT_SUBAGENT`、输入清单路径与盲审声明，第二轮另声明 `ROUND_FINAL_DECISION=SELF_DECIDED`。以下三类不设轮次上限：实施完成后整批 `REVIEW_TARGET=IMPLEMENTATION` 对抗审查必须依据详设文档，每条 finding 写明详设位置与实现位置，详设中找不到判据的问题记入 `DESIGN_GAPS` 交回设计侧，`NO-GO` 修复后交新的 fresh 独立子 agent 复审；实施过程中的实施结果对账（步骤级、整体三维、交付前逐代码与详设）`OPEN` 修复后复查直到 `MATCHED`；Codex 与 Claude 之间经 Dexter 中转的 review 由 Dexter 决定轮次。这三类只把 `REVIEW_ROUND=N` 当序号，不写 `REVIEW_ROUND_LIMIT` 或 `ROUND_FINAL_DECISION`。不重开已收口 cycle。

所有长运行与动态环境必须使用未来受管 `scripts/` 入口；业务结果与 cleanup 分开，cleanup 非 PASS 不得完成。首败先保留并读取日志，同一 signal 第二次尝试前必须完成边界诊断，禁止用延长 timeout、轮询或魔法等待冒充修复。完整 Heritage 标准冻结于 `doc/heritage/frozen/catering-all-v2/project-memory/decisions/logging-and-debugging-foundation-standard.md`；本条只是压缩入口，不能缩减该标准的 run-scoped manifest、脱敏结构化日志和 `LOG_NOT_AVAILABLE` 处置要求。

**Testcontainers 与 DEV 生命周期联动（Dexter 裁决，强制）**：一旦某次受管 Testcontainers/backend-acceptance 运行本身已获授权，若运行前存在由当前 DEV manifest 明确拥有且 identity 匹配的 DEV 环境，则该授权同时、无条件包含先经受管 `scripts/dev/stop` 关闭该 DEV；无需再次向 Dexter 申请。必须先记录 `DEV_WAS_RUNNING=true`，且 DEV stop 的 cleanup PASS 后才能启动 Testcontainers。只有 Testcontainers 的 business 与 cleanup 均 PASS，才经受管 `scripts/dev/start` 重新启动 DEV，使其加载当前最新代码；原先没有 DEV 则测试后不得擅自启动，测试失败也不得自动重启。此联动不授权 reset、seed、浏览器 L2、UAT 或按端口/名称停止未知进程；DEV restart 仍绝不 seed，stop/test/restart 各自保留 first failure、last known good、broken boundary、business 与 cleanup 证据，restart 失败时整项动态收口不得报完成。

**运行资源预算（硬约束）**：每个受管长运行启动前必须只按 run-scoped manifest 的明确所有权做资源预检：本机 PID 必须同时匹配 OS start token；远端 PID 必须同时匹配 host、boot id 与 start ticks。历史受管 tree 仍存活或其 RSS 超出已声明预算时拒绝新 run；不得按端口、命令名猜测归属或杀未知进程。远端 Testcontainers 还必须预检 `org.testcontainers=true` 容器/卷为空，运行中把资源观察写入 manifest/heartbeat，残留资源即 cleanup FAIL。仅当前 runner 明确拥有的 process tree 可受控停止；business PASS 不放宽 cleanup。

**日志、诊断与验收（硬约束）**：所有脚本、业务代码与支撑代码必须在实际运行边界具备统一、结构化、脱敏且可关联的必要日志/诊断能力，用于问题追踪、执行阶段和效率判断；禁止以 audit、异常 response、exit code、测试名称或临时输出替代。受管执行必须有阶段、受控 process identity、log path 和 cleanup 结果；测试/动态验证必须实际读取日志，判定 first failure、last known good、broken boundary、business 与 cleanup。无新日志是诊断信号，不得以等待、延长 timeout 或盲目重试掩盖。安全敏感路径不得记录 password/hash、OTP、token、cookie、Authorization、手机号、登录名、原始 IP 或 raw payload。已发现的范围外日志缺口必须在当前工作中补齐，无需另向 Dexter 申请日志授权；仍须遵守 owner、隐私和适用详设。规范原文见 `doc/decisions/2026-07-29-v2s-observability-and-acceptance-standard.md`。

**后台统一测试能力（当前止损范围）**：唯一业务机器标识是 `backend-acceptance`；它在真实 HTTP 与真实容器中，以手写 fixture、请求和非 `response.ok` 的业务断言输出分离的 `CONTRACT`、`BUSINESS` 与场景信息性 `DB_OPERATIONS`。新增业务场景前必须先读主动规范 `doc/decisions/2026-08-14-v2s-backend-acceptance-business-scenario-standard.md`，并只在对应的 `*AcceptanceScenarios.java` 中扩展；**总数不设上限**（Dexter 2026-08-27 裁定去除原 80 条约束），不能把业务断言堆回入口类。原 196 provider/旧 scenario performanceCriterion、accepted-baseline、lane/并行等继续退役。Dexter 2026-08-22 单独恢复 generated 238-operation budget 与 run-level verifier；239 是 base-1 CP-B0 的历史基线，不是当前 active denominator。该 verifier 复用 production HTTP completion events，但不新增或替代业务 scenario、不参与单场景 `CONTRACT`/`BUSINESS`、不复活旧 provider/registry 控制面，性能 business 与资源 cleanup 另行报告。

## 协作进度与结束闸门

- **持续任务进展汇报（硬约束）**：任何持续超过五分钟的 task 必须在 `commentary` 主动汇报；首次汇报及之后任意两次相邻汇报的间隔均不得超过五分钟。不得闷头执行，不得只写“继续中”或无可核对内容的泛化状态。每次必须完整使用以下六行格式：

  ```text
  GOAL：整体 GOAL 是什么；无 active goal 时写“无”。
  TASK：当前 task 的明确目标，以及“无漂移”或实际漂移及处置。
  DONE：本 task 已真实完成的内容；无则写“无”。
  ON：正在做的具体动作，以及其是否符合当前执行要求。
  NEXT：完成手头动作后的具体下一步。
  LEFT：当前task剩余X%待完成，当前goal剩余Y%待完成。
  ```

  `LEFT` 行是固定字面模板：除 `X`、`Y` 两个百分比数值外不得增删、替换或追加任何文字；无 active goal 时仍按当前受管 goal/reporting context 填报。动态受管运行超过 30 秒仍按既有规则每 30 秒报告；非动态 agent、外部工具或评审等待仍每 60 秒报告并按既有停滞诊断规则处置；多个规则同时适用时以更严格的间隔为准。发生材料性完成、范围漂移、阻断或受控停止时，不能等到下一个周期，必须立即按同一格式补报；最终回复仍须自包含，不得把 progress 报告当作完成证据。

- **连续执行与结束回复闸门（硬约束）**：存在 active goal 或未完成 current task 时，阶段性结果、命令返回、进度汇报、单项 gate PASS/FAIL、子任务完成或等待下一条受管命令都只能使用 `commentary`，并必须在同一执行回合继续推进。`final` 只能在且仅在以下三种可审计状态发送：(1) 当前 task 的批准完成条件、business 与 cleanup evidence 均已关闭；(2) 继续执行确实需要 Dexter 的产品/范围/外部授权决策，并已给出准确问题与已完成的只读核查；(3) 受控阻断已按停滞纪律完成日志/PID/runner 根因定位，且不存在安全的下一步。发送前必须显式核对 active goal、current task 的剩余项、下一条具体动作与上述三种结束条件；任一仍有可执行动作即禁止结束回复。不得把“向用户汇报”或“等待工具输出”误判为 task 结束。仓库控制动作不构成 agent 的完成条件或阻断条件。
