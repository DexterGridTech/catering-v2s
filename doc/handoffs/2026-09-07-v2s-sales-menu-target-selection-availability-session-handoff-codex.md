# catering-v2s 销售菜单目标选择与细粒度沽清 · 新会话 handoff

```text
HANDOFF_KIND=SESSION_CONTEXT_RECOVERY
HANDOFF_STATUS=READY_FOR_NEW_SESSION
DATE=2026-09-07
REPOSITORY=/Users/dexter/Documents/workspace/idea/catering-v2s
CURRENT_TASK=R5-SM-TARGET-SELECTION-AVAILABILITY-IMPLEMENTATION
CURRENT_PHASE=IMPLEMENTATION_AUTHORIZED_AFTER_INDEPENDENT_ROUND_2_AUTHOR_REPAIR
IMPLEMENTATION_AUTHORITY=true
INDEPENDENT_SUBAGENT_REVIEW=ROUND_2_COMPLETE_NO_GO_AUTHOR_REPAIRED
DYNAMIC_EXECUTION=NOT_RUN_FOR_THIS_FEATURE
DEV_STATUS=CLOSED_WITH_CLEANUP_PASS
```

> 本文是跨会话恢复导航，不是事实正本，也不产生新的实施、运行、reset、seed、浏览器或部署授权。新会话必须按本文读序重新读取当前仓库字节、正本材料和 owning source。

## 1. 当前项目背景

`catering-v2s` 是 successor execution 仓，不是 `catering-all-v2` 的状态副本。当前平台的硬边界是：

- 一个业务 deployable：`apps/backend/catering-business-server`。
- `apps/backend/terminal-data-server` 只是未来 TDP 空占位；当前不得为它增加 runtime、契约、数据库、migration、seed 或业务代码。
- 一个 PostgreSQL 数据库、多 owner schema、单一 Flyway history。
- 模块 owner 保有事实和命令主权；跨模块写只能调用目标模块公开 command API，并在同一 `REQUIRED` 事务中完成。
- 跨 schema 读取只能是明确任务型 join，不能由 read edge 推导写入、锁、事务或 FK 权限。
- `x-consumer-faces` 是 HTTP 暴露面的单一真相。
- `platform-admin` 是运维管理后台，`operations-admin` 是运营管理后台；两者是独立 app，不得因中文近似而合并 actor、session、URL、权限或 owner。
- 所有 UI 功能先检查并复用 `libraries/frontend/admin-ui-foundation`；App 自己拥有 shell、router、store、baseApi、theme、generated API、业务 feature 和 Journey 行为。
- OpenAPI 手写 source 是契约正本，generated 输出不可手改。
- Git 始终由 Dexter 控制；agent 不得要求、提醒或建议任何 Git 动作。
- 主 agent 唯一写入代码、测试、脚本、契约、seed 和文档；独立 agent 只读审查、对账和报告 finding。

## 2. 新会话必读顺序

### 2.1 仓根入口和授权

在任何设计、实施、review 或动态运行之前，按以下顺序重新读取：

1. `AGENTS.md`
2. `PLATFORM-BLUEPRINT.md`
3. `doc/platform/README.md`
4. `doc/platform/roadmap-program-registry.json`
5. registry 选出的当前 Roadmap：`doc/roadmaps/platform/2026-07-24-v2s-execution-roadmap.md`
6. Roadmap 只读授权字段（`R*_AUTHORIZED`、`V2S_*`、`GIT_OWNER` 等），不要从历史 `CURRENT_*` 字段推断当前任务。
7. `scripts/README.md`
8. `CLAUDE.md`

当前 registry 的 program 是 `V2S_W0_W4_EXECUTION`。Roadmap 有全局 R5 授权记录；本任务的直接事实还包括 Dexter 2026-09-07 在会话中的实施授权。四份设计/计划工件已写入该授权，但 fresh independent subagent blind review 仍是写生产代码前的强制门。

### 2.2 项目记忆

项目记忆唯一入口是 `project-memory/index.md`。它是生成导航，不是规则正本；必须先读全部 kernel：

- `project-memory/kernel/01-workspace-and-roadmap.md`
- `project-memory/kernel/02-service-shape-and-owner.md`
- `project-memory/kernel/03-transaction-data-and-dependencies.md`
- `project-memory/kernel/04-contract-consumer-and-admin.md`
- `project-memory/kernel/05-evidence-runtime-and-git.md`
- `project-memory/kernel/06-heritage-and-change.md`

然后按六维路由执行 memory recall。当前 review/恢复场景可用：

```bash
scripts/context/recall-memory \
  --task-kind review \
  --domain platform \
  --consumer-face operations-admin \
  --owner product \
  --impact governance \
  --trigger task-start
```

如果任务类型改变，仍须提供完整六维参数，并使用与实际任务匹配的值。不要只用 `--help` 或缺省路由；缺少维度会 fail closed。

本轮已经命中的主要 memory 原文包括：

- `project-memory/decisions/confirmed-business-language-corpus.md`
- `project-memory/decisions/deterministic-context-only.md`
- `project-memory/decisions/independent-subagent-adversarial-review.md`
- `project-memory/operations/backend-acceptance.md`
- `project-memory/operations/business-corpus-adoption-and-read-policy.md`
- `project-memory/operations/business-corpus-parked-domain-intake.md`
- `project-memory/operations/dev-command-separation.md`
- `project-memory/operations/phase-retrospective-and-systemic-repair.md`
- `project-memory/pitfalls/check-repo-before-authoring.md`
- `project-memory/pitfalls/criterion-degraded-into-list.md`
- `project-memory/pitfalls/analysis-ruler-and-scope-discipline.md`
- `project-memory/decisions/terminal-architecture-and-stack-rulings.md`

命中 memory 后还要回读每个 `sourceRefs`；memory 是导航和约束索引，不替代当前源码或当前设计。

### 2.3 开发规范和治理材料

必须按任务需要读取：

- 后端：`doc/platform/backend-coding-standard.md`
- 前端：`doc/platform/frontend-coding-standard.md`
- 共享基础设施：`doc/platform/foundation-charter.md`、`libraries/frontend/admin-ui-foundation/`
- review：`doc/platform/review-standard.md`
- review/Claude 协作：`doc/platform/claude-review-handoff-template.md`、`project-memory/operations/claude-review-handoff-standard.md`
- 独立对抗审查：`doc/decisions/2026-07-25-v2s-independent-subagent-adversarial-review-governance.md`
- 验证治理：`doc/decisions/2026-07-24-v2s-verification-governance.md`
- agent 控制边界：`doc/decisions/2026-07-25-v2s-agent-coordination-and-control-boundary.md`
- 动态执行：`project-memory/operations/dev-command-separation.md`、`.agents/skills/cs-managed-runtime-execution/SKILL.md`

合规 control 面已经退役；不要恢复或要求 `scripts/check/standards-coverage`、`implementation-design-granularity`、evidence 台账、package/hash-chain 等退役控制来替代真实源码、编译、测试或运行证据。

## 3. 当前正在做的需求

### 3.1 需求背景

当前销售菜单把“Catalog 商品的全部候选事实”错误地当成“本 SalesItem 的全部销售目标”，又把“SalesItem 人工状态”错误地当成所有目标共用的状态。结果是：

1. 同一个 Catalog 商品虽然已有多个 SKU 和 SKU 挂牌价能力，但编辑器不能选择 SKU 子集，无法建立“同商品 128G 销售项”和“同商品 256G 销售项”。
2. 普通商品的 Catalog 选项只有只读投影，SalesItem 没有自己的选项值选择快照，无法只暴露部分选项。
3. 人工沽清只有 `(salesItemRef, channelRef)` 维度，不能只沽清一个 SKU 或一个点单选项值。
4. `Catalog` 中 `SKU.status=DISABLED` 的 SKU 不应进入顾客菜单候选，也不能通过直接 HTTP 引用或发布校验进入销售菜单。

### 3.2 目标语义

- SKU 销售项保存一个非空、由当前 `ENABLED` SKU 构成的 SKU 子集，并为每个已选 SKU 保存独立菜单挂牌价。
- 普通商品按选项组保存被本销售项暴露的选项值子集；Catalog 仍拥有选项定义、顺序、模式、默认值和加价事实。
- 同一 Catalog 商品可以在同一菜单中存在多个 SalesItem，各自绑定不同目标子集。
- 人工沽清目标至少区分 `ITEM`、`SKU`、`ORDER_OPTION_VALUE`；库存自动不可售、SalesItem 人工沽清、SKU/选项值人工沽清是并列事实，不互相恢复或级联覆盖。
- 候选层只暴露 `ENABLED` SKU；`DISABLED`、`VOIDED` 均不是候选。owner 的保存和发布必须再次校验，不能只依赖 UI 过滤。
- 对已保存但后来失效的目标，不能静默删除；应以失效修复状态读回并要求用户移除或替换。已发布快照在 Catalog 后续变成 `DISABLED` 时是否自动改变，仍是单独的产品决策，不得自行补语义。

## 4. 当前设计材料与真实状态

按此顺序读取当前设计：

1. `doc/decisions/2026-09-07-v2s-sales-menu-target-selection-availability-journey-amendment.md`
2. `doc/plans/platform/2026-09-07-v2s-sales-menu-target-selection-availability-requirements-amendment.md`
3. `doc/plans/platform/2026-09-07-v2s-sales-menu-target-selection-availability-interaction-design-codex.md`
4. `doc/plans/platform/2026-09-07-v2s-sales-menu-target-selection-availability-implementation-design-codex.md`
5. `doc/plans/platform/2026-09-07-v2s-sales-menu-target-selection-availability-implementation-plan-codex.md`
6. `doc/review/platform/2026-09-07-v2s-sales-menu-target-selection-availability-design-review-request.md`
7. `doc/review/platform/2026-09-07-v2s-sales-menu-target-selection-availability-design-review-claude.md`

这些文件当前都是设计/review材料，关键状态如下：

- Journey：`DEXTER_ACCEPTED`，`DEXTER_REVIEW=ACCEPTED_FOLLOWUP_2026-09-07`，`IMPLEMENTATION_AUTHORITY=true`。
- 需求、交互、实施设计：已写入 `IMPLEMENTATION_AUTHORITY=true`；交互 `DEXTER_WIREFRAME_REVIEW=ACCEPTED_2026-09-07`。
- 实施计划：`READY_FOR_IMPLEMENTATION_PENDING_INDEPENDENT_SUBAGENT_REVIEW`，`DYNAMIC_EXECUTION=NOT_RUN`。
- Claude 已经完成第一轮静态 DESIGN review，结论是 `NO-GO`，finding 为 `M=1, S=3, N=1`；没有运行 DEV、Testcontainers、reset/reseed、backend acceptance、浏览器 L2 或 UAT。
- Dexter 已确认并写入 `S-1`：`DISABLED` SKU 不可作为销售菜单候选、保存或发布目标；该决定尚未把整份设计升级为 GO。
- Claude follow-up DESIGN review 已完成（M=0/S=2/N=1，S-1 已吸收）；Dexter 已裁决 optional 零选择、无 detach event、无混合 shape、普通选项 supersede，并授权本 Journey 实施。仍须按项目治理完成 fresh 独立子 agent 盲审/对账；该 review 不再开启第三轮设计评审，也不能被 Claude 结果替代。
- Claude 原报告不能改写；后续复审要新建/更新 review request 并保留原始 NO-GO 证据。

### 4.1 Claude 第一轮留下的未闭合项

- `M-1`：fixture 只有一个 `ENABLED` SKU，却要求验证两个不相交的非空 SKU 子集；实施前需在 owning Catalog fixture/seed 增加第二个 `ENABLED` SKU，并保留 `DISABLED`、`VOIDED` 负例。
- `S-1`：旧报告指出 `DISABLED` 可选；现在已有 Dexter 决策和设计修订，但尚待 follow-up review 验证契约、owner、UI、seed/test 是否全闭合。
- `S-2`：没有 required option group fixture，无法证明必选选项组不允许空选择；需要在 owning fixture/seed 中构造 required group 并补正反场景。
- `S-3`：交互设计没有完整枚举新增选择控件的唯一 `*TestIds.ts` 绑定；需补齐真实动作节点、case/action 对应关系，再写 L2。
- `N-1`：多态 `target_ref` 的 FK/删除语义需要明确覆盖 `ITEM` target、DML 和 published snapshot 删除/读回边界。

## 5. 需要亲验的 owning source

当前只读根因定位如下，不能把这些定位当作已修复：

- `apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogOwnerService.java`
  - `salesMenuSkuFacts(...)` 当前只跳过 `VOIDED`，需要改为 SalesMenu 任务投影只暴露 `ENABLED`；不要改变通用 Catalog SKU 管理语义。
- `apps/backend/catering-business-server/modules/sales-menu/src/main/java/com/catering/v2s/salesmenu/application/SalesMenuOwnerService.java`
  - 更新校验和 `authoritativeSkuRows(...)` 需要统一要求 `ENABLED`。
  - 发布校验已有/需保持 `ENABLED` 复核，不能只依赖 candidate projection。
- 契约正本、generated API、Flyway、SalesMenu owner、Catalog owner、permission/error catalog、frontend model/drawer/status modal、各自 `*TestIds.ts`、backend acceptance scenario、L2 blueprint、Catalog fixture 和 sales-menu seed 都属于同一 change surface，实施时必须逐项列出并同步。
- 任何生产代码变更前，先重新读取对应需求条目、IA/交互详设、路由 memory、开发规范和 owning source；focused proof 后再用同一组原文逐项回读。

### 5.1 本批明确登记的 handoff 欠账

- `CATALOG_ADMITTED_SHAPES_BACKEND_ENFORCEMENT`：Catalog `catalog-item-editor-manifest.json` 已声明 SKU 与 order-options 的 `admittedShapes` 互斥，但 Catalog Java 后端目前未执行该声明；本批不修改 Catalog owner。触发后需另行形成 Catalog decision、implementation、review 与直接 HTTP owner rejection evidence。本批 SalesMenu owner 只负责 shape-aware 的显式失败，不得静默丢弃 option facts。

## 6. Skill 使用路由

项目 skill 唯一真相根是 `.agents/skills/`；`.claude/skills` 只是适配链接。按动作使用：

- 新会话、设计、实施、review、testing：`.agents/skills/cs-memory-recall/SKILL.md`；先做六维 recall，再读命中的原文和 sourceRefs。
- 用户要求把需求变成详设/实施计划：`.agents/skills/cs-spec-to-plan/SKILL.md`，需要写计划时再读 `.agents/skills/cs-writing-plans/SKILL.md`。
- 任何 Codex 或 Claude review、review request、GO/NO-GO、finding intake：`.agents/skills/cs-review/SKILL.md`。
- 需要找精确 owner symbol、生成源、fixture 或调用链：`.agents/skills/cs-code-structure-recall/SKILL.md`。
- 发现 API/能力/fixture 看似缺失：`.agents/skills/cs-semantic-source-reconciliation/SKILL.md`，先解决语义和 owner，不要自行造 fallback。
- 遇到 bug、失败或重复错误：`.agents/skills/cs-systematic-debugging/SKILL.md` 与 `.agents/skills/cs-failure-recall/SKILL.md`；先保留首败、读日志并判断 broken boundary，不靠延长 timeout 或盲重试。
- 任何 DEV start/restart/stop、reset、seed、backend acceptance、浏览器 L2、UAT：`.agents/skills/cs-managed-runtime-execution/SKILL.md`；先读 manifest、资源预算和授权，再使用受管 `scripts/`。

不要因“看起来像前端”直接调用普通浏览器/Playwright skill 绕过项目的 managed runtime、testId、L2 blueprint 和授权规则。

## 7. DEV、远端测试和清理规则

### 7.1 DEV 拓扑

```text
TOPOLOGY=REMOTE_JAVA_LOCAL_VITE_REMOTE_NON_PRODUCTION_MIDDLEWARE
JAVA_APPLICATION=REMOTE_TRUSTED_NON_PRODUCTION_HOST
WEB_APPLICATIONS=LOCAL_HOST
MIDDLEWARE=REMOTE_NON_PRODUCTION
TRANSPORT=MANAGED_HTTP_AND_ASSET_SSH_TUNNEL
```

- DEV 的 Java 在受信远端非生产主机，PostgreSQL/对象存储在同侧；本机只运行两个 Vite：`platform-admin`、`operations-admin`。
- 只允许受管 HTTP/asset tunnel；禁止本机 Java fallback、PostgreSQL tunnel、远端 Vite、远端浏览器。
- `scripts/dev/start`、`scripts/dev/restart` 只启动/重启，不 seed；可加载 additive Flyway。
- `scripts/dev/reset` 是独立、显式、破坏性动作，只能针对 manifest-owned 的精确远端非生产 DB/namespace。
- `scripts/dev/seed --profile r5-full` 是独立显式动作，必须走 owner HTTP/readback；不允许 seed-on-start、手写 SQL、直接 psql 或 Docker 猜测。
- 当前不要重启 DEV，也不要 reset/reseed；等待 Claude review 和 Dexter 的实施指令。

### 7.2 backend acceptance、浏览器 L2、UAT

- backend acceptance：`scripts/test/backend-acceptance`，真实 HTTP、真实受管远端容器/服务和手写 fixture；在对应 `*AcceptanceScenarios.java` 扩展真实业务场景，输出分离的 `CONTRACT`、`BUSINESS`、信息性 `DB_OPERATIONS`。
- backend acceptance 一旦获授权且当前 DEV manifest 正在运行，必须先记录 `DEV_WAS_RUNNING=true` 并用 `scripts/dev/stop` 清理；测试 business 和 cleanup 都 PASS 后才可按规则恢复 DEV。当前没有该授权，不得自行运行。
- 浏览器 L2 不是 DEV/UAT：本机 Spring Boot、本机两个 Web、本机 Playwright，经每次运行隔离的远端非生产 middleware namespace；必须按 `contracts/policy/sales-menu-l2-case-blueprint.json` 和唯一 `*TestIds.ts` testId 操作。
- UAT 只有单独授权后才能全量远端执行；不得拿 DEV、L2 或 Testcontainers 技术验证冒充 UAT。
- 所有动态运行都必须读取 run-scoped manifest 和日志，保留 `firstFailure`、`lastKnownGood`、`brokenBoundary`；业务结果和 cleanup 结果分开报告。
- 进程归属必须同时匹配 manifest identity 与 OS start token；远端还要匹配 host、boot id、start ticks。绝不按端口、命令名或模糊 PID 杀进程。

### 7.3 当前 DEV 已关闭证据

本会话已经执行并完成受管 DEV stop：

- manifest：`.runtime/r5/terminal-r5-dev-1788778863915-8842-0b46c27c-4faf-44ed-838c-fb0338ddf4ab.json`
- `business.status=PASS`
- `cleanup.status=PASS`
- `failedProcessCount=0`
- `remoteJava=PASS`
- `remoteJavaStop=STOPPED`
- `lastKnownGood=REMOTE_AND_LOCAL_PROCESS_EXIT`
- stop 后再次确认：active manifest 不存在、port lock owner 不存在、受管本机 PID 9346/9589/9595 均不存在。

这只证明 DEV 收束完成，不证明本需求已实现或动态验证通过。新会话不要重复 stop，也不要根据端口猜测并杀其他进程。

## 8. 新会话下一步

1. 先按第 2 节重开入口、memory、规范和 current bytes；把本 handoff 仅当导航。
2. 读取第 4 节全部销售菜单设计和 Claude follow-up，确认四项 Dexter 裁决、五项实施前条件与独立 review 入口已写回当前字节。
3. 完成当前 cycle 的 fresh independent subagent blind review；在 verdict 留痕前不写生产代码。
4. review 通过/处置后，按实施计划从契约正本开始；每个 CP 做步骤级三维对账，全部 CP 后做整批三维对账。
5. 实施完成后再按授权逐项运行 focused/static、backend acceptance、reset/reseed、DEV、浏览器 L2，并分别收集 business/cleanup 证据；当前不执行任何动态动作。

## 9. 给新 agent 的硬停止条件

- 看到本文件，必须先完成 fresh independent review gate，之后才可按当前 Dexter 授权写本 Journey 生产代码。
- 不得把 Roadmap 单独解释成授权来源；当前实现授权来自 Dexter 会话裁决并受本 Journey 范围约束。
- 不得把旧 Claude NO-GO 改写成 GO，也不得把静态设计通过写成动态验证通过。
- 不得跳过 fresh independent subagent review；同一 review cycle 最多两轮，不能换文件名/措辞重置轮次；本轮不再开启第三轮设计评审。
- 不得因为候选过滤已设计就省略 owner save/publish revalidation。
- 不得把 Catalog 后续 `DISABLED` 的已发布快照行为自行定案；该点仍需 Dexter 产品决策。
- 当前不运行 DEV、reset、seed、backend acceptance、浏览器 L2、UAT 或部署；实现授权包含后续受管验证范围，但每项动态动作仍必须按脚本、manifest 与 cleanup 条件执行。
- 不得清理、回退或覆盖工作区内与本需求无关的既有 dirty changes。

## 10. 一句话状态

当前是：**销售菜单“SKU/选项子集选择 + 目标级人工沽清 + DISABLED SKU 不可选”已由 Claude follow-up 完成设计复核，Dexter 已裁决四项产品边界并授权本 Journey 实施；四份工件已更新，当前唯一实施前门是 fresh independent subagent blind review；DEV 已按受管流程关闭且 business/cleanup 均 PASS。**
