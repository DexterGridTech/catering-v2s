# catering-v2s AI 执行入口

`catering-v2s` 是 successor execution 仓，不是 `catering-all-v2` 的状态副本。任何会话都必须从本仓根开始，并按以下顺序恢复上下文：

1. 读取本文件与 `PLATFORM-BLUEPRINT.md`；
2. 读取 `doc/platform/README.md`，再从 `doc/platform/roadmap-program-registry.json` 选择显式 `programId`，只读取该程序 Roadmap 的 `CURRENT_*`；
3. 读取 `project-memory/index.md` 的全部 kernel，再用 `scripts/memory/query` 按六维路由读取全部命中原文；
4. 读取 `scripts/README.md` 和当前步骤明确引用的 decision、plan、contract 与 evidence；
5. 只有当前 Roadmap 的显式授权可以开始对应步骤。

## 不可突破的红线

- 一个业务 deployable；一个 PostgreSQL 数据库、多 owner schema、单一 Flyway history。
- 模块 owner 保有事实与命令主权；跨模块写只调用目标模块公开 command API，并加入同一 `REQUIRED` 事务。
- 跨 schema 读取只允许显式任务型 join；不得由 read edge 推导写入、锁、事务或 FK 权限。
- 初始不引入 MQ、通用 outbox、TDP、内部 OpenAPI client 或常态轮询。
- `x-consumer-faces` 是 HTTP 暴露面的单一真相；`platform-admin` 与 `operations-admin` 是两个独立 app。
- 术语固定：**运维管理后台 = platform-admin**，**运营管理后台 = operations-admin**；不得因“运维/运营”近似而互换、合并或据此改变 actor、session、URL、权限或 owner 边界。
- DEV start/restart 可执行 additive Flyway，但绝不 seed；reset/seed 是独立、显式、破坏性动作。
- **环境执行矩阵（Dexter 裁决，强制）**：DEV 与当前受管浏览器 L2 都在本机执行 Spring Boot、platform-admin、operations-admin 与 Playwright；它们只能经受管 tunnel 连接远端非生产 PostgreSQL/对象存储等中间件，不得在远端启动应用、Vite 或浏览器 runner。DEV 可长期运行但不得 seed；当前 L2 必须是一次性隔离命名空间、run-scoped manifest、本机进程/隧道回收和远端数据库/资产回收均有证据。只有后续获得单独授权的 UAT 才全量远端部署与执行；不得用本机 runtime 冒充 UAT，也不得把远端 Testcontainers 技术验证误称浏览器 L2。
- Heritage 仓只读，禁止 runtime/build fallback；偏差在本仓新增 decision，不回写旧仓。
- **能力命名而非流程命名**：流程/步骤/Journey ID（`R*`/`U*`/`J*`/`JG*`/`PKG*`/`G-*`）只允许出现在 `doc/`、evidence/review/memory 与 gate catalog 元数据；禁止进入 runtime 或测试的目录、包、文件、类名。依据冻结 Heritage `runtime-source-organization-must-not-follow-journey-ids.md@f88855cc3583026ad6edf7afb3e729c46705ea5f30fa7d635acd6784db9c236a`；代码目录约束仍由 `code-layout` 负责。
- 前端对每个获批 UI-bearing Journey 先按 `doc/decisions/2026-07-25-v2s-frontend-asset-carry-over-first.md` 盘点 all-v2 对应页面并以静态摹本/截图为线框基线；未来实现期页面、组件、shell 与 foundation 默认显式搬运，generated wire 按 v2s edge OpenAPI 重生成。该原则不授权实现，也不解除 Heritage 的只读、hash-bound、零 runtime/build fallback 边界。
- **共享前端 foundation 强制对接**：后续任何 UI 功能实现必须先检查并对接 `libraries/frontend/admin-ui-foundation` 已提供的能力；不得在 `apps/frontend/*` 重复实现同一共享行为、生命周期、Drawer surface、overlay lock、列表上下文、HTTP protocol、observability 或 automation primitive。App 继续拥有自己的 shell、router、store、baseApi、theme、generated API、业务 feature、业务文案和 Journey 行为；只有 foundation 未覆盖且经设计说明的能力才可留在 App 内。当前 R3 foundation 已复制但未接入，不构成 R3 业务闭环；后续 UI 功能接入时必须补对应 focused test/evidence。
- **AI 协作与仓库控制边界（强制）**：项目只有codex和Claude两个AI在Dexter的分工下协调，git的所有操作权都在Dexter身上，codex和Claude都不得在任何节点要求Dexter必须执行git动作，Dexter想不想git、想什么时候做都不影响任何设计和开发工作，后面codex和Claude都不得再提git的事情。规范原文与执行条款见 `doc/decisions/2026-07-25-v2s-agent-coordination-and-control-boundary.md`；不得以仓库控制动作阻断任何设计、实施、测试、评审、证据或收口工作。
- R3 backend 物理上保留并列 app 目录：`apps/backend/catering-business-server` 是当前唯一业务 deployable，`apps/backend/terminal-data-server` 是未来 TDP 的空占位；此边界由 `doc/decisions/2026-07-25-v2s-backend-app-layout-and-tdp-placeholder.md` 固化，不得在 R3 为 TDP 添加 runtime、契约、数据库、migration、seed 或业务代码。
- **Roadmap R 原子交付**：每个 `R` 都是一次性完整交付单元，必须按“该 R 一次性完成设计 → 该 R 一次性完成实施 → 该 R 全范围一次性完成复核”执行。不得把同一 `R` 按 Journey、模块、文件、App 或单项 gate 拆成独立设计确认、独立实施交付或独立复核；单项 gate 只能是该 R 统一交付中的内部证据。当前 R3 的统一复核范围是 R3-C01 + R3-TECH + U01-U07。
- 凡需 Dexter 转交 Claude 的评审，Codex 最终回复必须直接渲染可复制中文 brief：背景、目标、仓根相对路径、独立核验重点、`GO`/`NO-GO` 与 `M/S/N` 格式、授权边界；不得只给链接或说“请 review”。详见 `CLAUDE.md`、`doc/platform/claude-review-handoff-template.md` 与 `project-memory/operations/claude-review-handoff-standard.md`。
- R3–R6 及后续验证遵循 `doc/decisions/2026-07-24-v2s-verification-governance.md`：机器门只作一行可说清的机械判定并须有真实 red mutation；业务语义靠 fresh 独立对抗审查与 Claude review，产品取舍和 severity 归 Dexter；建门先过三问，交付超过半小时审阅量先切小，`scripts/verify` 必须保持分钟级。
- **compliance-control 控制面已退役（Dexter，2026-08-13）**：不得再要求或恢复 evidence 台账、package entry/exit、六类 source 分母、Pre/Post compliance hook、incremental receipt、hash-chain、P0/W0/P1、manifest Part B/C/D 或 `scripts/check/implementation-design-granularity`。实施仍须以原始需求、适用详设和真实源码为准，并用实际编译、类型、测试或运行结果判断行为。
- **实施节奏与逐点双读**：准备只做到当前待改点可执行、可复核所需的最小输入，不能以泛化准备替代实际修复。每一个实际变更点写入前，必须逐项重开对应 IA/原始业务条目、六维路由命中的全部项目记忆及 owning source、适用详设/设计约束和当前可复用源码；完成该点的 focused proof 后，必须用同一组原文逐项回读源码与证据，确认没有偏离用户任务、交互、owner 或约束。独立对抗 reviewer 也必须取得并逐点核查该前后双读留痕；缺项是 finding，不得以总览阅读、静态通过或后续 L2 代替。
- **已识别问题必须抽象并防再犯**：任何已确认的设计、实施、测试或验证问题都必须在关闭前抽象为通用失败模式、根因层、有限适用范围、反例边界与可复用最小解，并落到 project-memory、真实可运行的既有测试、明确 review checklist，或有具体反例的 `NOT_APPLICABLE_WITH_REASON`。用户点名的文件、字段、字符串或失败信号只能作为问题族入口；修改前必须完成同根扫描与反例查找，禁止单点修补。不得以 prompt intake、per-edit hook、receipt 或 package 枚举替代根因分析与亲验。
- R1 与 R2 已关闭，`V2S_FOUNDATION_READY=true`。Dexter 已暂停 `R3-J02` 的 implementation-facing 设计；其既有 selection/design/manifest/review/handoff 统一为 `PENDING_RECOVERY`，保留但不得继续用作 handoff、implementation 或“operations 已可真实登录”的依据。第一批与 `DESIGN_GOVERNANCE_BATCH_1_5` 已获 Claude GO，并于 2026-07-25 由 Dexter 接受；Batch 2 inventory 亦已由 Dexter 接受。Dexter 已接受 R3-C01 carry-over-first 线框，并授权一次性形成整个 R3 的 implementation-facing 详设与实施计划：C-01 是唯一业务 Journey，设计同时覆盖 R3-TECH、契约、脚本、后端、数据库、双 app 边界、测试与证据，冻结后经自审、Claude review；不得把 C-01 拆成新的逐文件确认门。Dexter 已进一步授权 R3 implementation；U01 Gate 0 已 PASS，后续 U02-U07 按已接受详设继续。该状态不恢复 J02/C-02；`R3-C02` 在 R3 的运营用户真实登录仍被删除。旧 `R3-J01` 是历史 `NO_GO`，不得复用审查轮次或作为实现入口。Codex 已自主补齐 D.1 `code-layout` 机械 gate 并使 R3 standards coverage PASS。

项目 skill 的唯一真相根是 `.agents/skills/`；`.claude/skills` 只是同仓适配链接。禁止读取全局同名 skill 代替本仓 skill。Prompt hook 只推荐 skill，不查询或注入 memory/code；源码影响面只走 `rg`、源码和编译器。

任何 design、implementation、review 或 testing 会话仍须读取 `project-memory/decisions/deterministic-context-only.md` 并重开当前任务命中的原始材料；`contracts/policy/standards-coverage-matrix.json`、冻结 manifest 复算和 `scripts/check/standards-coverage` 不再是准入或交付要求。`project-memory/index.md` 是生成导航，不是规则 memory anchor。

自下一个 review cycle 起，所有 `REVIEW_TARGET=DESIGN` 与 `REVIEW_TARGET=IMPLEMENTATION` 对抗审查必须按 `doc/decisions/2026-07-25-v2s-independent-subagent-adversarial-review-governance.md` 由 fresh 独立子 agent 执行；作者会话只能在独立 verdict 后做辩证 intake 与处置，不得代写 verdict。子 agent 必须完整读取其最小输入清单，并先以证伪为立场形成 findings/verdict，再可对照作者材料。实施完成后仍须以 `REVIEW_TARGET=IMPLEMENTATION` 重开真实生产源码与用户行为 evidence；“按已批设计实现”不能豁免重新判断方案是否合理。UI 必须证明操作来自批准 Journey、符合用户任务且不存在更优路径；接口限制、旧文档模糊或产品歧义必须显式归因，涉及产品/Journey/页面操作时向 Dexter 求证。缺少独立子 agent 留痕的该轮不得 GO，也不得把 Claude 后续复核当作替代。

任何对抗审查 finding 都只是一条待验证输入。Codex 必须逐条重开 owning source/代码/evidence，外部漂移事实查官方一手资料或做可复现实验，主动找反例与适用边界，并标明 `CONFIRMED / PARTIALLY_CONFIRMED / REJECTED_WITH_EVIDENCE / UNVERIFIED_REQUIRES_EVIDENCE / DEXTER_DECISION`；不得全盘接受 reviewer，也不得在信息不全时武断裁决。修复建议还必须比较更小替代和阶段成本，拒绝因审查而过度设计；只有已确认部分可驱动修改，产品/Journey 歧义仍回 Dexter。

同一 `REVIEW_CYCLE_ID + REVIEW_TARGET + 批准范围` 的独立子 agent 对抗审查最多两轮：第一轮找盲点，第二轮定向核验并硬停止，作者基于独立 findings 与处置结果按既有 `SELF_DECIDED` 规则收口。换 reviewer/模型/文件名、措辞或局部修订不得重置轮次；只有 DESIGN→IMPLEMENTATION，或 Dexter 实质改变 Journey、批准范围、授权边界/目标，才建立并说明新 cycle。第二轮后禁止再召集第三轮；未决产品与权限事项直接交 Dexter。每轮产物必须声明 `REVIEW_CYCLE_ID`、`REVIEW_ROUND=1|2`、`REVIEW_ROUND_LIMIT=2`、`reviewerKind=INDEPENDENT_SUBAGENT`、输入清单路径与盲审声明，第二轮另声明 `ROUND_FINAL_DECISION=SELF_DECIDED`。本条仅自下一个 review cycle 生效，不重开已收口 cycle。

所有长运行与动态环境必须使用未来受管 `scripts/` 入口；业务结果与 cleanup 分开，cleanup 非 PASS 不得完成。首败先保留并读取日志，同一 signal 第二次尝试前必须完成边界诊断，禁止用延长 timeout、轮询或魔法等待冒充修复。完整 Heritage 标准冻结于 `doc/heritage/frozen/catering-all-v2/project-memory/decisions/logging-and-debugging-foundation-standard.md`；本条只是压缩入口，不能缩减该标准的 run-scoped manifest、脱敏结构化日志和 `LOG_NOT_AVAILABLE` 处置要求。

**运行资源预算（硬约束）**：每个受管长运行启动前必须只按 run-scoped manifest 的明确所有权做资源预检：本机 PID 必须同时匹配 OS start token；远端 PID 必须同时匹配 host、boot id 与 start ticks。历史受管 tree 仍存活或其 RSS 超出已声明预算时拒绝新 run；不得按端口、命令名猜测归属或杀未知进程。远端 Testcontainers 还必须预检 `org.testcontainers=true` 容器/卷为空，运行中把资源观察写入 manifest/heartbeat，残留资源即 cleanup FAIL。仅当前 runner 明确拥有的 process tree 可受控停止；business PASS 不放宽 cleanup。

**日志、诊断与验收（硬约束）**：所有脚本、业务代码与支撑代码必须在实际运行边界具备统一、结构化、脱敏且可关联的必要日志/诊断能力，用于问题追踪、执行阶段和效率判断；禁止以 audit、异常 response、exit code、测试名称或临时输出替代。受管执行必须有阶段、受控 process identity、log path 和 cleanup 结果；测试/动态验证必须实际读取日志，判定 first failure、last known good、broken boundary、business 与 cleanup。无新日志是诊断信号，不得以等待、延长 timeout 或盲目重试掩盖。安全敏感路径不得记录 password/hash、OTP、token、cookie、Authorization、手机号、登录名、原始 IP 或 raw payload。已发现的范围外日志缺口必须在当前工作中补齐，无需另向 Dexter 申请日志授权；仍须遵守 owner、隐私和适用详设。规范原文见 `doc/decisions/2026-07-29-v2s-observability-and-acceptance-standard.md`。

**后台统一测试能力（当前止损范围）**：唯一机器标识是 `backend-acceptance`。当前已实现并运行 18 条 IAM、ORG、商业合同和 asset 真实场景：在真实 HTTP 与真实容器中，以手写 fixture、请求和非 `response.ok` 的业务断言输出分离的 `CONTRACT`、`BUSINESS` 与仅供人工比较的 DB 调用数；请求观测还必须使用真实 route registry 的 operationId/routeTemplate。新增业务场景前必须先读主动规范 `doc/decisions/2026-08-14-v2s-backend-acceptance-business-scenario-standard.md`，并只在对应的 `*AcceptanceScenarios.java` 中扩展，不能把业务断言堆回入口类。原 196 个 provider 壳、共享 SPI 与 scenario registry 已下线删除，不再是测试入口或覆盖依据。PERFORMANCE/CLEANUP verdict、accepted-baseline、known-uncovered、自动分母/精确集合、lane/并行/心跳/work-stealing、calibration 与 correctnessCases 均已退役；后续按需扩充真正需要的 operation，总数不超过 80 条。

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
