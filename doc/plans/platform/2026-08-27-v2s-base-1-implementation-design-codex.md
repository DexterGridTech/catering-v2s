SKILL_USED=cs-writing-plans@72190c88b2b5a67a96b91d66aa72b9161913e10e8769da3f28a226f4cc7b99d0

# base-1 整体重构 · implementation-facing 详设与实施计划（Codex 独立稿）

## 0 · 元数据、输入冻结与授权边界

```text
BUSINESS_SOURCE=doc/plans/platform/2026-08-27-v2s-base-1-requirements-claude.md@e157396ff03c3a4ef4b8d47c3b36640499fdfa505a9f111c67f07ed78aed7be4;doc/plans/platform/2026-08-27-v2s-base-1-appendix-cascade-and-members-claude.md@eac35a023a83209e6d9a473ad9bf4801bb56ae95cd87b70983e3931f87219a6c
JOURNEY_REFS=doc/decisions/2026-08-19-v2s-business-channel-management-journey.md;doc/decisions/2026-08-19-v2s-external-collaboration-platform-configuration-journey.md;doc/decisions/2026-08-20-v2s-catalog-attribute-and-order-option-library-journey.md;doc/decisions/2026-08-21-v2s-catalog-unit-model-journey.md;doc/decisions/2026-08-23-v2s-catalog-library-workbench-journey.md;doc/decisions/2026-07-28-v2s-rm1-ia-01-platform-otp-and-invitation-interaction.md;doc/decisions/2026-07-29-v2s-rm1-ia-04-operations-organization-and-contract-interaction.md;doc/decisions/2026-07-29-v2s-rm1-ia-05-operations-users-recovery-and-home-interaction.md
IA_REF=doc/plans/platform/2026-08-27-v2s-base-1-ia-design-codex.md
INTERACTION_REF=doc/decisions/2026-08-19-v2s-external-collaboration-and-business-channel-ui-interaction.md;doc/decisions/2026-08-20-v2s-catalog-attribute-and-order-option-library-ui-interaction.md;doc/decisions/2026-08-21-v2s-catalog-unit-model-ui-interaction.md;doc/decisions/2026-08-08-v2s-catalog-category-reference-interaction.md;doc/plans/platform/2026-08-23-v2s-catalog-library-workbench-interaction-design-codex.md
RULES=doc/platform/backend-coding-standard.md#1-J..1-N,2-H,2-I;project-memory/decisions/owner-read-model-and-lifecycle-standard.md;project-memory/practices/read-model-granularity.md;project-memory/practices/business-channel-list-scope-and-validity-display.md;project-memory/pitfalls/probe-narrower-than-criterion.md;project-memory/pitfalls/criterion-degraded-into-list.md
AUTHORIZED=产出 Codex 独立详设、IA 与实施计划
NOT_AUTHORIZED=生产代码;契约源与生成物;Flyway;测试或门;DEV;reset;seed;Testcontainers;backend-acceptance;L2;UAT;数据;部署;Git
IMPLEMENTATION_AUTHORITY=false
```

本稿未读取、未引用同日 Claude 独立详设。两份 2026-08-26 base-1 文档只保留历史留痕，
不构成输入。本稿中的源码行号只记录本次盘点证据；真正实施定位一律使用 §9b 唯一锚点。

### 0.1 当前不能由设计方代裁的三项

| ID | 仓内事实 | 两种候选理解 | 本稿倾向 | 状态 |
|---|---|---|---|---|
| `BASE1-D01` | 需求只新增属性/点单选项两个 transition，却退役分类 delete、单位 disable/delete；分类没有 transition，单位没有完整三态 transition。 | A 只新增两个，分类/单位失去生命周期命令；B 新增分类、单位、属性、点单选项四个 transition。 | B。否则裁定 1、2、3 在分类和单位上不可执行。 | `DEXTER_DECISION`；未裁不得冻结 operation delta。 |
| `BASE1-D02` | `workspace_account` 手机/登录 partial unique 排除 VOIDED；同一身份可有历史 VOIDED 与当前非 VOIDED。裁定 19 又要求遇 VOIDED 拒绝。 | A 只有 VOIDED 历史时视为 ABSENT 并允许新建；B 视为 VOIDED 并永久拒绝该身份。 | A 更符合“VOIDED 释放业务键”，但属于产品语义。 | `DEXTER_DECISION`；查询必须先确定性选择当前非 VOIDED，再处理历史。 |
| `BASE1-D03` | 父 `catalog_order_option_definition` 可释放 code；子 `catalog_order_option_definition_value` 无生命周期，仍有普通全局业务 code unique。 | A 父 VOIDED 后子 code 继续占用；B 同批扩展子 identity/lifecycle 释放策略。 | 不扩展模型前只能诚实保留子 code 占用，不能宣称整棵定义编码已释放。 | `DEXTER_DECISION`。 |

另外两项已知产品依赖保持开放：collaboration binding 在哪些场景构成阻断；菜单发布能力建成时
需要哪些维度处于可用状态。二者不得在本批固化成字段、枚举、DB 约束或 UI 禁用规则。

### 0.2 extension 第十三类是 JSON 逻辑对象，不是已删除业务对象

`V20260726_160000_000__extension_and_role_json_storage_alignment.sql` DROP 了旧物理
`extension_definition_field` 表，但把字段折叠进 `extension_definition.definitions JSONB`。
`ExtensionDefinitionReadback.Field.status`、`ExtensionDefinitionService.normalize`、平台字段配置 UI 与
集团初始化消费证明字段定义仍是可启用/停用的用户可见逻辑对象。故附件十三类结论成立；本批
不得恢复旧表，而应在 `ExtensionDefinition` 根 readback 返回 workspace status dimension，每个 JSON
field 继续返回 self status。

## 1 · 真实业务目标与方案比较

### 1.1 结构性问题

当前后端同时持有原始事实、面向单一页面的字符串装配、逐记录中文翻译和跨 owner 有效性
物化；相同事实被不同前端重复消费时又散落在多个接口。其结果是上游恢复不能自动恢复、前端
表达被后端句子绑死、隐藏字段 probe 会缩窄业务判据、三态对象仍被 delete/disable operation
分裂、VOIDED 无法可靠释放业务键、旧字段与生成链分母在实施末端才暴露漂移。

如果不做，至少会继续出现四种与业务相反的行为：停用渠道无法恢复；邀请静默复用停用账号；
标记删除后业务 code 仍被普通 unique 占用；前端为改变展示被迫修改 owner 契约或新增按屏接口。

### 1.2 方案比较

| 方案 | 结果 | 结论 |
|---|---|---|
| A · 仅删明显字符串与旧字段 | 不触及生命周期、索引、级联写和 operation 身份；旧根因仍在，stop reason 仍会永久阻断。 | 拒绝。 |
| B · 新建通用 read-model/字典/effective-status 服务并保留旧接口 | 新增跨域平台层、单值有效状态和长期兼容面；权限、失效和 owner 主权被集中层吞掉。 | 拒绝。 |
| C · owner 返回结构事实，既有 face 消费；三态和 partial business key 统一；短命契约切换窗口后删除旧面 | 不新增通用服务或字典 endpoint；每项事实仍由 owner 持有，前端拥有表达，最终不存在旧字段/旧 operation/级联物化。 | **采用。** |

我选了 C 而不是 A/B，因为 C 同时关闭数据、契约、owner、前端和验证分母，且没有引入新的
跨域 owner、通用抽象、单值有效状态或长期兼容层。

### 1.3 后端先闭环、前端后切换的契约窗口

后端闭环结束时必须同时满足：新结构字段、四态 readiness、四个 transition（待 D01 裁定）、
owner 判定与新 SQL 已成立；backend-acceptance 和相关静态门可独立通过；旧前端源码仍能类型检查。
为此只允许一个**不可部署、不可跨批保留的短命双投影窗口**：

1. 契约 source 先新增结构字段/新 operation，旧字段/旧 operation 暂不删除；统一生成 Java/TS。
2. owner 只产生一份权威结构事实；旧 DisplayName/summary/path 投影暂沿用原 mapper，禁止新增
   adapter、flag、v1 路径、fallback、双写或 DB 兼容列。
3. `stop_reasons` 是例外：新 owner 不再读写该列；短命旧字段只能由结构化 blocker 映射，且
   仅用于未切换前端的静态可编译 checkpoint，不授权部署或动态 DEV。
4. 后端 closure 的 acceptance 断言新结构事实和零级联写；旧投影只做 contract existence 检查，
   不再被接受为业务真相。
5. 前端 CP-F1/F2 全部切换到新结构后，CP-F3 在同一实施批删除旧字段、旧 mapper、旧 operation、
   旧 DB 列、旧测试和旧 seed 断言，再统一生成并重跑后端 closure 与前端 closure。

这个窗口不是最终架构，也不能单独交付或部署；任何旧消费仍存在就不得完成 CP-F3。这样既满足
“先后端整体验证再改前端”，也不会形成一个后端变更后前端立即无法编译的中间态。

## 2 · CP 总览

| CP | 主题 | owner | 主要输出 | 依赖 |
|---|---|---|---|---|
| CP-B0 | operation 数量单一人工 source | contract/tooling | 6 个 consumer 读取一个 count JSON；四个信号仍比较显式声明 | 无 |
| CP-B1 | 三态 DDL、回填、partial business keys | organization/workspace-IAM/business-channel/catalog | 两个新 Flyway；15 张主表状态，业务唯一键，失败前置 | B0；D02/D03 明确边界 |
| CP-B2 | 生命周期 owner/新 operation 闭环 | catalog/organization/workspace-IAM/business-channel | 四个 transition、VOIDED 终态、停用可编辑；旧五 command 不改语义并延迟到 F3 删除 | B0、B1、D01 |
| CP-B3 | 级联不落库与渠道自状态 | business-channel/collaboration/organization | 状态维度 readback、stop reason producer/consumer 退役、binding detach 不改自身状态 | B1；binding 未决只登记 |
| CP-B4 | 装配字段结构化与契约双投影窗口 | contract/各 owner/edge | Java/Stream/SQL 人读装配替换；结构字段写入 source；统一 codegen | B1-B3 |
| CP-B5 | 合同、角色邀请、账号四态准入 | organization/store-contract/workspace-IAM | create 前状态复核；`ACCOUNT_NOT_BINDABLE`；readiness 四态 | B1、B4、D02 |
| CP-B6 | 后端独立 closure | 全后端/tooling | focused、契约、static、backend-acceptance 均证明新 owner/契约 | B0-B5 |
| CP-F1 | generated TS 与跨 app presentation 基础 | 两前端/foundation | 结构类型、三个闭集字典、路径/邀请 URL helper | B6 |
| CP-F2 | 全部 handwritten consumer 切换 | 两前端 | 业务渠道、协作、邀请、合同、catalog、inventory、IAM/organization surface 切新事实 | F1 |
| CP-F3 | 最终退役与统一生成 | contract/backend/frontend/migration/memory | 删除旧字段、operation、mapper、SQL/常量/记忆旧义；operation counts 冻结最终值 | F2 |
| CP-F4 | 前端 focused/static closure | 两前端/tooling | component、architecture、codegen、OpenAPI、operation bindings 全绿 | F3 |
| CP-R | 全批三维对账后整体测试 | 主 agent + fresh 独立子 agent | 全批需求/详设IA/记忆逐条 MATCHED 后才允许整体测试 | B0-F4 |

## 3 · 横切机制对照表

| 机制 | ① 现成能力/规范 | ② 如何验证 | ③ 无现成时的实现形态 | ④ 本批适用全集 |
|---|---|---|---|---|
| 读侧节点授权 | `contextScopedQueryArgs`;各 edge 既有 scope guard;backend standard §2-H | **acceptance** 跨 workspace/node 请求受影响 reads 全拒绝 | 保持 operation 身份中的静态授权目标，不接收客户端 targetType 决定权限 | 五类 user/invitation operations；catalog/inventory reads；project/store channel reads；platform workspace reads |
| 写授权与 grant 复核 | 各 owner `require*Access`/command grant；backend standard §2-H | **acceptance** 越权 command 零写且 typed reject | transition 复用被替代 delete/disable command 的 scope/capability，不靠 UI 隐藏 | 四个 catalog transition；channel/template edit/transition；contract create；invitation create/complete |
| 跨 owner 写与事务 | `@Transactional(REQUIRED)`；公开 command API；AGENTS 红线 | **focused+acceptance** 第二 owner 失败时第一 owner、receipt、audit 均回滚 | 单向 coordinator 先读并锁事实，再按公开 API 写；禁止跨 schema DML | contract create；invitation create/complete；channel binding；catalog definition/reference coordinator |
| 集合形态与分页 | foundation charter §1-J；`read-model-granularity.md` | **static** 无 fields/probe；**acceptance** paged 子集合不进 detail | owner 无参 read 返回全部非无界事实；参数只缩小，不揭示隐藏字段 | 22 catalog GET；五类 IAM ops；channels；organization path；contract items；history/ledger/SKU |
| 缓存失效 / 改完刷新什么 | generated RTK tag policy；`operationsContentTabRefreshSignal` | **focused** mutation 只触发 IA 指定 query | presentation helper 无缓存；新 transition 继承同 aggregate 旧 command 的 tag | channel/template；catalog category/definitions/unit；invitation；contract；collaboration；organization/IAM |
| RTK 数据读取与加载判定 | frontend standard §3-B | **component** 刷新保留 currentData，首次加载与刷新分离 | N/A | BASE1-IA-01..07 所有 query surface |
| 同一事实只有一个住址 | frontend standard §3-E | **static** 新结构事实不镜像到 local state/sessionStorage | 字典是静态模块；server facts 直接来自 generated query result | status dimensions、paths、contract items、catalog facts、readiness |
| 失败可见且原因不得改写 | frontend §3-D；backend §2-B/§1-D | **acceptance+component** owner code 到 UI 文案一一映射，失败保留草稿 | 未知 enum fail visible，不 raw-code fallback | ACCOUNT_NOT_BINDABLE、VOIDED 终态、role/store/tenant/channel/template 准入、unknown dictionary code |
| owner 错误到 HTTP 映射与注册处 | `ContractProblemAdvice` 与各 typed owner problem registry | **focused** 每个新/复用 problem 有 advice test | 实施前先找 existing identity；不存在才在 owning registry 增加，不在 edge catch 改写 | CP-B2/B3/B5 全部拒绝 |
| 幂等键构成与重放语义 | frontend §3-G；owner receipt；`WorkspaceInvitationService.canonical` | **focused** 同 key replay 不重复写，canonical reduce 保持字节不变 | 非人读复合串豁免，不按装配整改 | contract create；invitation create/complete；catalog commands |
| 该用生成物的地方不得手搓字符串 | backend §2-D | **static** route/token/binding 来自生成物，旧 handler 全无引用 | 只改唯一生成源后统一生成，不手改 generated | catalog operation、edge OpenAPI Java/TS、registry/bindings |
| 日志落点与脱敏字段 | AGENTS 日志硬约束；observability decision | **focused/static** problem 日志无 mobile/login/token/raw payload/status detail | 只记录 run/operation/owner/result/problem identity 和脱敏 ref | invitation、contract、transition、binding/stop-reason retirement |
| 迁移回填与可逆性 | Flyway 单 history；backend §1-M | **migration integration** 未知值/重复 key/ARCHIVED component 红 | forward-only；旧 migration 不改；目标 index 先建成功再 drop 旧 unique | §10 两个新 migration 的全部表/index |
| 前端共享行为 | `libraries/frontend/admin-ui-foundation` Drawer/list/form/nameCode/activeInvitationPageUrl | **component** focus、overlay、submission、path/link 统一 | foundation 无对应时先在 foundation 建纯 presentation helper，不在 app 复制 | 所有 Drawer/Modal；OrganizationPathNode；InvitationRouteFacts |
| 候选/下拉数据源 | owner candidate ops；IA 既有 candidate 规则 | **acceptance** DISABLED/VOIDED 不在新引用候选，既有值仍详情可见 | 不从当前列表筛选出候选，不用前端 status 猜权限 | role、template、category、attribute、order option、unit、collaboration binding |
| 编码与名称呈现 | foundation `presentation/nameCode.ts`；G-08/G-12 | **component** name 主、code 次；缺 name 不以 code 顶替 | 路径节点结构统一 `{ref,code,name,type}` | 所有 OrganizationPath、catalog path/reference/BOM/candidate、binding path |
| 会同时坏的东西是否原子 | foundation charter §5-C | **static+人工对账** §9a 同一行全分母同步 | 每个事实的 source/generated/owner/edge/frontend/test/seed 在一个 CP 完成 | §9a 18 个事实组 |

## 4 · 每个 CP 的门控与实施任务

### CP-B0 · operation 数量单一人工 source

- **输出**：新增 `contracts/policy/backend-performance-operation-counts.json`，人工声明
  `operations/reads/commands/commandsByFace.operationsAdmin/platformAdmin/public` 六个数。
- **消费者全集**：`scripts/generate/backend-performance-budget.mjs`、
  `scripts/generate/operation-handler-bindings.mjs`、
  `contracts/policy/backend-performance-cp05-calibration-report.json`、
  `scripts/test/r5-remote-testcontainers.mjs`、
  `scripts/test/backend-performance-operation-reconciliation.mjs`、
  `scripts/test/backend-performance-cp05-reclassification.mjs`。
- **失败条件**：任一 consumer 仍有独立 239/102/137/94/34/9；真实 operation 集合与人工声明
  不同却没有使四个现有 signal 失败；生成器自动改写 JSON。
- **不变量**：显式人工修改闸保留；run-level verifier 保留实测预算；不改 operation identity。
- **FORBID**：operation digest、decisionRef、从 OpenAPI 自动派生/写回、恢复 scenario performance
  verdict 或 accepted-baseline。
- **focused proof**：现有六 consumer test 使用同一 fixture；逐个将一个数减一，四个既有 signal 中
  对应 signal 必红。
- **RECALL**：requirements §4 拦截 1/裁定 17；appendix §2.6；acceptance-scenario-count-freeze memory。

### CP-B1 · 三态、回填与业务键

- **输出**：§10 的 `V20260827_010000_000__base1_three_state_lifecycle.sql`。
- **失败条件**：未知状态被静默映射；非 VOIDED 重复 business key 被迁移接受；VOIDED 仍占
  已列业务键；inventory definition index 被改；component ARCHIVED 被映射而非 fail closed。
- **不变量**：存储值只用 ENABLED/DISABLED/VOIDED；DRAFT→DISABLED，EFFECTIVE→ENABLED，
  ARCHIVED→VOIDED；identity/reference/receipt/display-order uniques 保留；旧 migration 不改。
- **FORBID**：`CREATE INDEX CONCURRENTLY`、默认值掩盖 null、兼容 status、改 inventory 两张
  `definition_status='ENABLED'` partial index/ON CONFLICT。
- **proof**：新增 `MasterDataLifecycleMigrationIntegrationTest` 证明每项回填/check/index predicate、
  duplicate fail、component ARCHIVED fail、inventory DDL byte-equivalent。
- **RECALL**：requirements §3/§5.1/§7.2/§7.3；owner lifecycle standard；§10。

### CP-B2 · 生命周期 owner 与新 operation

- **输出**：四个 transition operation（受 D01 约束）；organization、IAM、business-channel、catalog
  的新写侧接受 DISABLED 编辑，拒绝 VOIDED 编辑/转态；候选排除非 ENABLED。旧五 operation 在
  这一不可部署 checkpoint 只为旧前端保持原样存在，不修改语义、不新增 adapter，F3 原子删除。
- **失败条件**：分类或单位没有进入三态的新 command；旧 delete/disable 被偷偷改成软删 shim；
  `requireEditable` 仍把 DISABLED 拒绝；VOIDED 可以再转；既有未变引用被状态校验拒绝。
- **不变量**：新增引用复核 ENABLED；未改引用保存豁免；历史/audit 不过滤；物理删除只对
  aggregate 子行/清理流程保留。
- **FORBID**：保留 delete operation 改成软删；通用 fallback；将所有 `DELETE FROM` 改软删。
- **proof**：catalog transition route exact set、owner transition focused、backend-acceptance 三条独立行为：
  DISABLED 可编辑、VOIDED 终态、新引用拒绝但既有引用保存成功。
- **RECALL**：requirements 裁定 1-12、拦截 2、A-7；criterion-degraded-into-list pitfall。

### CP-B3 · 级联读时事实与 stop reason 退役

- **输出**：§7 状态维度结构；`business_channel.stop_reasons` 的 owner producer、DB read consumer 和
  cascade writer 删除；短命契约窗口只保留由结构 blocker 投影的旧 edge 字段；
  template/external/provider 恢复后无需清理写即可读到恢复事实；binding detach 不重写自身状态。
- **失败条件**：任何 cascade command 改下游自身 status；任何 stop reason 常量/字段/DML/live memory
  残留；owner 返回单值 effectiveStatus；管理编辑被上游状态单独阻断。
- **不变量**：对象只存自身状态；owner 返回各维状态；应用场景使用四行适用矩阵；总公司不阻断
  门店；binding 维度只返回事实，未裁场景不做组合。
- **FORBID**：新清除路径、级联状态列、JSON blocker sentence、CASCADE_* 兼容常量。
- **proof**：BusinessChannel acceptance 停用/恢复上游零下游 UPDATE；DB 列缺席；同一渠道自身
  状态未变；管理编辑成功；新增引用按已裁维度拒绝。
- **RECALL**：requirements §3.2；appendix §1；business-channel-list-scope-and-validity-display memory。

### CP-B4 · 结构化 read model 与短命双投影

- **输出**：§7 与 §9a 的结构字段；openapi source→materialized→Java/TS；Java/Stream/SQL 人读
  装配消失；三类例外原样保留；14 条按屏口径改为完整 read criterion。
- **失败条件**：后端仍传递本地闭集中文标签；path/summary 只删字段却无结构事实；fields probe
  决定 owner criterion；paged/history 子集合被塞入 detail；前端在此 CP 已被改。
- **不变量**：旧前端仍类型通过；新结构已经可由 backend-acceptance 断言；窗口不授权部署；
  `actorDisplayName` 等快照、安全脱敏、canonical/idempotency/string SQL placeholders 保留。
- **FORBID**：手改 generated、隐藏 fields、通用 JSON、接口按屏拆分、长期 deprecated 字段。
- **proof**：edge-codegen/OpenAPI/contract tests；新结构 HTTP oracle；旧 TS compile；assembly focused tests。
- **RECALL**：requirements §1/§2/§5 步骤一至三；两条 pitfall；appendix §2。

### CP-B5 · 新建准入与账号四态

- **输出**：contract create 在首写前锁定 store+tenant 并校验 ENABLED；invitation create 在首写前
  锁定全部 role 并校验 ENABLED；invitation create/complete 取得账号四态并按裁定拒绝；readiness
  contract 四态；登录/OTP 继续只选 ENABLED。
- **失败条件**：校验发生在 invitation/contract/audit INSERT 后；只加 `status='ENABLED'` 将停用
  账号误判 ABSENT；完成失败留下 COMPLETING；历史 VOIDED 被 unordered `result.next()` 选中。
- **不变量**：创建和完成均拒 DISABLED/VOIDED；`ACCOUNT_NOT_BINDABLE`/422；零 credential/
  assignment/intent；角色 identity 始终按 id；existing auth seven filters 保留。
- **FORBID**：用名称反查 role；把账号治理状态直接显示给公开用户；代裁 D02；虚构菜单 runtime。
- **proof**：§11 IAM/contract scenarios；transaction focused tests；typed problem advice tests。
- **RECALL**：requirements 裁定 13/16/19/20、§7.1/§7.2；G-07/G-08/G-09。

### CP-B6 · 后端独立 closure

- **顺序**：compile/generated exact set → focused owner/migration/edge → static gates →
  backend-acceptance。动态运行仍需 Dexter 另行授权，本计划只规定未来执行顺序。
- **完成定义**：§11 所列后端 focused 和 acceptance 对**新 operation/新结构**全通过；旧前端 typecheck
  与既有旧 route 仍成立；business/cleanup 分开。这只是短命契约窗口，旧五 command 尚未退役，
  因此不是 base-1 final runtime，不得部署或宣称整批完成。
- **禁止**：以静态结果冒充 acceptance；以历史 PASS 替代现跑；失败后盲目重跑。

### CP-F1 · 前端 presentation 基础

- **输出**：generated TS 新结构；operations `businessChannelCodeLabels.ts`、operations/platform
  `collaborationCodeLabels.ts`；foundation `OrganizationPathNode`/`NameCodePathText` 与
  `InvitationRouteFacts`/activeInvitationPageUrl。
- **失败条件**：同一字典在多个 component 复制；未知 code raw fallback；path string parser 继续是
  新数据主路径；helper 读取权限/scope/localStorage。
- **不变量**：实体 name 仍来自 owner；code 次级；字典 exhaustive；无网络接口。
- **proof**：字典成员 exact-set tests、foundation tests、generated type compile。

### CP-F2 · handwritten consumer 全切换

- **输出**：附录 C 的全部 consumer 使用结构事实；IA 的 testId、空态、加载、错误、focus 与失效行为。
- **失败条件**：任一 old field/old operation import；stop reason UI；effectiveStatus；本地镜像 server
  fact；目录树/十列/SKU 行变化；账号四态显示 raw enum。
- **不变量**：查看/编辑分离；DISABLED 可编辑；VOIDED 只读；候选与已有引用行为分开。
- **proof**：附录 D frontend focused；architecture searches old surface zero；不运行 L2 直到另获授权。

### CP-F3 · 最终退役

- **输出**：附录 B 退役清单全部删除；统一 codegen；最终 count source 人工改值并经四 signal 确认；
  `V20260827_010000_001__base1_business_channel_derived_facts.sql` drop stop_reasons；active memory 改写。
- **失败条件**：任何兼容字段、adapter、flag、sessionStorage、deprecated operation、旧 test/seed assertion；
  materialized schema 与 source 漂移；旧 operation handler/token 孤儿。
- **不变量**：final source/generated/runtime/test/seed 只有新形态；不手改 generated；旧 migration 保留。
- **proof**：retirement exact-zero searches + exact-set gates + same denominator re-read。

### CP-F4 与 CP-R

- **F4**：附录 D 前端 focused/static 全绿；generated/codegen/OpenAPI/operation bindings 全绿。
- **R**：先做 §13b 整体三维对账并关闭全部 OPEN，之后才进入整体 test；动态项均需新授权。

## 5 · operation / path / face / 集合形态

### 5.1 状态 transition 与退役 command

| 业务意图 | operationId | method/path | face | 集合形态 | 规模与增长驱动 |
|---|---|---|---|---|---|
| 分类转态 | `transitionOperationsCatalogCategoryStatus` | `POST /operations/catalog-inventory/categories/{categoryRef}/status` | operations-admin | 单对象 command/readback | 1 个 aggregate |
| 属性定义转态 | `transitionOperationsCatalogAttributeDefinitionStatus` | `POST /operations/catalog-inventory/attribute-definitions/{definitionRef}/status` | operations-admin | 单对象 command/readback | 1 个 aggregate |
| 点单选项定义转态 | `transitionOperationsCatalogOrderOptionDefinitionStatus` | `POST /operations/catalog-inventory/order-option-definitions/{definitionRef}/status` | operations-admin | 单对象 command/readback | 1 个 aggregate |
| 单位转态 | `transitionOperationsCatalogUnitStatus` | `POST /operations/catalog-inventory/units/{unitRef}/status` | operations-admin | 单对象 command/readback | 1 个 aggregate |

四条须由 `BASE1-D01` 接受后冻结。退役 operationId：
`deleteOperationsCatalogCategory`、`deleteOperationsCatalogUnit`、
`disableOperationsCatalogUnit`、`deleteOperationsCatalogAttributeDefinition`、
`deleteOperationsCatalogOrderOptionDefinition`。

### 5.2 22 个 catalog GET 的独立审计与收敛建议

| operationId | 形态/授权 | 结论 |
|---|---|---|
| `getOperationsCatalogWorkbenchContext` | bounded context，HEAD_COMPANY/STORE | 保留 |
| `getOperationsCatalogNavigation` | bounded tree，HEAD_COMPANY/STORE | 保留 |
| `getOperationsCatalogItems` | Page，HEAD_COMPANY/STORE | 保留 |
| `getOperationsCatalogItem` | Detail，HEAD_COMPANY/STORE | 保留 |
| `getOperationsLocalCatalogCopyCandidates` | bounded task candidates，STORE only | 保留 |
| `getOperationsBrandCatalogCopyCandidates` | bounded task candidates，STORE only | 保留 |
| `getOperationsCatalogShapeManifest` | bounded static shape，HEAD_COMPANY/STORE | 保留；若 enumLabels 本批退役则只删字段 |
| `getOperationsCatalogCategoryCandidates` | bounded tree candidates，HEAD_COMPANY/STORE | 保留 |
| `getOperationsCatalogItemSkus` | approved lazy child Page，HEAD_COMPANY/STORE | 保留 |
| `getOperationsCatalogDictionary` | bounded dictionary，HEAD_COMPANY/STORE | 保留 |
| `listOperationsCatalogAttributeDefinitions` | bounded library，HEAD_COMPANY/STORE | 保留 |
| `listOperationsCatalogOrderOptionDefinitions` | bounded library，HEAD_COMPANY/STORE | 保留 |
| `listOperationsCatalogUnits` | bounded library，HEAD_COMPANY/STORE | 保留 |
| `getOperationsInventoryTargets` | Page，STORE only | 保留 |
| `getOperationsInventoryTarget` | Detail，STORE only；已含 changeSummary/diagnostics availability | 保留 |
| `getOperationsInventoryTargetChangeSummary` | bounded summary，STORE only；与 current detail 重复 | **建议退役**，consumer 改读 current detail |
| `getOperationsInventoryTargetBusinessHistory` | unbounded Page，STORE only | 保留 |
| `getOperationsInventoryTargetConsumptionReferences` | Page，STORE only | 保留 |
| `getOperationsInventoryTargetLedger` | unbounded Page，STORE only | 保留 |
| `getOperationsInventoryTargetDiagnostics` | task detail，STORE only | 保留；不能把诊断内容塞进 current |
| `getOperationsInventoryConsumptionTargetCandidates` | bounded candidates，HEAD_COMPANY/STORE | 保留 |
| `getOperationsProductionTags` | bounded owner entities，HEAD_COMPANY/STORE | 保留 |

收敛建议仅删除 `getOperationsInventoryTargetChangeSummary`，因为 current view 已拥有同一 bounded
事实；其他读在授权、分页、失效或任务边界上不同。该建议须在合并稿中由 Dexter 接受后冻结。
ORG/IAM 的 21 个静态授权 operation 不合并，禁止客户端 `targetType` 决定授权目标。

### 5.3 operation count 预算（只在 D01 与 GET 建议均接受时成立）

短命新增四 transition、旧五 command 尚未删时：243 operations / 102 reads / 141 commands /
operations-admin commands 98 / platform-admin commands 34 / public commands 9。

最终再删五旧 command 和一个重复 GET：237 operations / 101 reads / 136 commands /
operations-admin commands 93 / platform-admin commands 34 / public commands 9。

这些值是设计推论，不替代实施期从真实 operation exact set 复算和 Dexter 的显式人工修改；D01 或
GET 取舍改变时必须停止并重新计算全部六个数。

## 6 · 跨 owner 写矩阵

| policy | 第一个 owner command/read lock | 第二个 owner command | 事务 | 失败回滚事实 |
|---|---|---|---|---|
| 新建合同准入 | organization `StoreContractLookup` 锁 store+tenant 并返各自 status | store-contract create | 同一 REQUIRED | contract、extension、receipt、audit 全零写 |
| 创建邀请角色准入 | workspace-IAM 锁全部 role 并校验 ENABLED；确定性账号 lookup | workspace-IAM invitation/intent create | 同一 REQUIRED | invitation、intent、audit 全零写 |
| 完成邀请账号准入 | workspace-IAM 锁 invitation 与当前账号 identity | credential/account/assignment writes | 同一 REQUIRED | COMPLETING 回滚，credential、assignment、audit 零写 |
| 新建渠道绑定 | business-channel read channel/template status dimensions | collaboration binding create；必要时 channel attach API | edge coordinator 的 REQUIRED | binding、channel attach、audit 全零写 |
| catalog definition/reference | catalog definition status read/lock | catalog aggregate save；需要 inventory 时用公开 API | 既有 REQUIRED coordinator | 新引用失败时 aggregate/BOM/receipt 全回滚；未改引用不调用新引用校验 |

## 7 · 声明—传递—消费矩阵

| fact/机制 | declaration | transfer | consumption | proof |
|---|---|---|---|---|
| lifecycle | DB `status` 三值 + OpenAPI enum | owner readback→edge generated | 管理 UI、自身终态、候选 | migration+acceptance+component |
| status dimensions | owner-specific status structs，不含合取值 | edge `StatusDimensionFact[]`/typed fields | blockers 与 action policy | acceptance 上游恢复零下游写 |
| extension field status | JSON member `Field.status` + root workspace dimension | `ExtensionDefinitionReadback`→wire `ExtensionDefinition` | field management 与 initialization | owner/edge/component/L2 design |
| stop reason retirement | 无 declaration | 无 transfer | 无 consumer | exact-zero source/schema/DB/UI/tests |
| account presence | `ABSENT/ENABLED/DISABLED/VOIDED` | `accountExists` enum in two public schemas | public invitation adapter exhaustive | four-state acceptance |
| organization path | `{nodeRef,code,name,nodeType}[]` | generated Java/TS | foundation NameCodePathText | edge+foundation tests |
| catalog paths/facts | typed node/tag/attribute/option/reference/unit structs | catalog unique generator→OpenAPI→TS | catalog list/detail/governance/inventory | generator+component+L2 design |
| closed-code labels | enum code only | generated TS code | three frontend dictionary modules | exhaustive dictionary tests |
| entity name | owner entity name/code | typed entity | name primary/code secondary | component tests |
| invitation route | groupWorkspaceKey+token facts | generated wire | foundation URL helper | focused copy-link test |
| contract items | typed item list + nullable phaseName | ContractOverviewItem | PlatformReadPage/detail | edge+component |
| collection shape | IA §2-8 exact shapes | cursor/page/filter only where listed §5 | server total; no client slice/drain | static+acceptance |
| authorization | operation identity + edge guard + owner recheck | context/grant，不传 display | owner decision | cross-scope acceptance |
| cache invalidation | IA navigationAndRefresh | generated tag policy/refresh signal | exact affected queries | focused spies |
| error mapping | typed owner problems | ContractProblemAdvice registry | UI business copy | advice+component |
| logs/privacy | no mobile/login/token/raw payload | operation/owner/problem only | diagnostics | static log assertion |

## 8 · 业务规则 → owner 判定点

| 规则 | owner 判定点 |
|---|---|
| 三态存储与转换 | 各 owner transition service + §10 CHECK；禁止 edge 自行转换 |
| DISABLED 可编辑 | 各 aggregate update 的 current row guard 只拒 VOIDED |
| VOIDED 终态 | transition/update owner 在锁后拒绝任何写；read/history 仍可见 |
| 新引用只用 ENABLED | 引用变化分支的 target owner status recheck；未变 ref 不进入该分支 |
| 候选只列可用 | candidate owner query；前端不从列表筛选 |
| 级联不落库 | 每个 owner 只写 self status；read coordinator 返回各维事实 |
| 管理编辑不因祖先阻断 | update owner 只查 self terminal + changed references |
| 历史不按当前状态丢事实 | history/audit/snapshot query 不加 lifecycle filter |
| 新建合同 | `ContractCommandService` 首写前调用增强的 `StoreContractLookup` |
| 创建邀请角色 | `WorkspaceInvitationService.createWithFacts` invitation INSERT 前锁定角色 |
| 账号不可绑定 | create/complete 两处确定性 account presence lookup |
| 登录/OTP | 既有 login/OTP owner 保持 `status='ENABLED'` |
| 渠道绑定 | coordinator 首个 collaboration write 前消费 channel/template status；具体组合待 Dexter |
| 菜单发布 | 本批无 runtime；未来能力设计必须引用需求裁定 13 |
| DisplayName/summary/path | owning read service 返回结构事实；前端 presentation 负责业务文案 |
| 安全脱敏 | owning edge 在返回前脱敏；前端不能接触原值 |
| 时点快照 | owning write 冻结，history read 原样返回 |
| 非人读复合串 | canonical/idempotency/SQL placeholders 原样保留 |

## 9 · owner API 与消费者清单

| owner 方法/目标 API | 精确消费者 |
|---|---|
| `BusinessChannelOwnerApi` channel/template status-dimension read | `ExternalCollaborationBusinessChannelCoordinator`; `OperationsBusinessChannelController` |
| `WorkspaceStatusLookup.requireStatus`（新增 raw fact；`isEnabled` 由它比较） | 十三类 workspace 直属 lifecycle read assemblers，包括 `ExtensionDefinitionService` |
| 删除 `BusinessChannelCommandApi.applyExternalStopReason` | 无替代 caller；`ExternalCollaborationBusinessChannelCoordinator` 直接删除调用 |
| binding detach command（保留） | collaboration delete-binding coordinator；只清 binding ref/version，不写 channel self status |
| enhanced `StoreContractLookup` | `ContractCommandService` |
| workspace role locked readiness | `WorkspaceInvitationService.createWithFacts` 内部 owner path |
| account presence locked lookup | `WorkspaceInvitationService.createWithFacts`; `completeReadyInvitation`; `publicReadiness` |
| four catalog `transitionStatus` | `OperationsCatalogInventoryController` generated handlers |
| structured catalog readbacks | `OperationsCatalogInventoryController` JsonNode pass-through；contract generator |
| structured organization path | workspace invitation/user/account mappers；external collaboration mapper |

零 caller 的 `BusinessChannelCommandApi.applyExternalStopReason`、旧 delete/disable owner methods、旧
Catalog operation handlers/tokens/bindings和 coordinator dead `requireEditable` helper 在 CP-F3 删除。

## 9a · 实施前全链同步变更清单

| 变更事实 | 契约 / 唯一生成源 / 生成物 | backend owner / edge / migration | frontend model / surface / state | focused / static / HTTP / L2 | fixture / seed | 结论 |
|---|---|---|---|---|---|---|
| operation count | `backend-performance-operation-counts.json`;六 consumer | N/A：不改变业务 owner | N/A：前端只受 generated operation 集影响 | budget/binding/reconciliation/reclassification tests | N/A：seed 不读 count | 同步修改 |
| 生命周期三态 | 各 OpenAPI enum；catalog P1 generator；Java/TS generated | §10 migration；organization/workspace-IAM/business-channel/catalog owners | organization/IAM/channel/catalog/unit surfaces | migration/owner/acceptance；organization/IAM/catalog/channel L2 | R5 owner-command、catalog、collaboration/channel seed | 同步修改；generated 派生 |
| 四个 transition 与五删 | catalog edge contract/placement/tag/assertion；OpenAPI/registries/bindings/Java/TS | catalog owner/controller/handlers/tokens | category controller、dictionary state、definition libraries | route exact-set、acceptance、budget/static、catalog L2 | catalog seed executor | 同步修改；D01 冻结后执行 |
| stop reason 整体退役 | business-channel source/materialized `BusinessChannelView`;Java/TS | §10 第二 migration；API/policy/owner/coordinator/mapper | `BusinessChannelDetailDrawer` | owner/edge/acceptance；business-channel L2 | collaboration/channel seed | 删除，不留 generated/compat |
| status dimensions | business-channel/collaboration/organization/workspace schemas；Java/TS | 各 owner readback、edge mappers | channel/collaboration/organization/IAM surfaces | owner/edge/acceptance/component | R5+collaboration seed | 同步新增；禁止 effectiveStatus |
| extension field workspace dimension | `extension.schemas.json`;edge root;generated Java/TS | `WorkspaceStatusLookup`;`WorkspaceAdministrationService`;`ExtensionDefinitionService`;wire mapper | ExtensionsPage；ExtensionDefinitionEditDrawer；CommercialGroupInitializationDrawer | extension owner/edge/component/acceptance/L2 | R5 extension definition seed | JSON field self status + root workspace dimension；不恢复旧表 |
| 12 个代码闭集字段 | business-channel/collaboration source/materialized；Java/TS | mapper translation 删除；static catalog translation 删除 | 三个 dictionary modules + 全 consumer | contract/focused/dictionary exact-set/L2 | external-platform-catalog seed/source | 后端字段删除、前端字典新增 |
| static catalog 46 翻译点 | `external-platform-catalog.json` + schema | `CheckedInCollaborationCatalogSource`、owner/readback/mapper | platform/operations collaboration dictionary | source test、owner test、component | 同一 checked-in source | 删除翻译值；保留业务实体名 |
| organization paths | workspace/collaboration schemas；Java/TS | invitation/account/user/collaboration queries+mappers | invitation/account/user/binding consumers；foundation nameCode | edge/foundation/component/acceptance/L2 | R5 invitation seed | string→typed node array |
| invitation URL | workspace schemas；Java/TS | two invitation read services/mappers | invitation detail/panels；foundation helper | owner/edge/foundation/component/L2 | R5 invitation seed | string→route facts；canonical reduce N/A 保留 |
| account presence | two public schemas；Java/TS | `WorkspaceInvitationService`;`PublicInvitationController` | public flow adapter | public flow owner/edge/typed problem/acceptance/L2 | R5 account/invitation seed | boolean→four-state enum |
| role invitation admission | candidate/create schemas只需现有 role ref/status；无新 display | WorkspaceInvitationService locked check | create drawer role candidate/error | owner/acceptance/L2 | R5 roles/invitations | owner behavior 同步；无新 operation |
| contract phase/items | contract schema；Java/TS | contract owner；PlatformContractOverviewController | PlatformReadPage/detail；operations contract surfaces | owner/edge/acceptance/component/L2 | R5 contract seed | phase nullable；itemSummary 删除 |
| contract create admission | typed problem schema/registry（按 owning source 决定） | Organization StoreContractLookup；ContractCommandService | ContractCreateDrawer | focused/advice/acceptance/L2 | R5 store/tenant/contract seed | 同步新增 owner check |
| catalog assembly fields | catalog read-model JSON/edge contract/P1+P3 generators/OpenAPI/Java/TS | CatalogOwnerService；edge pass-through | catalogModel + list/detail/editor/governance/category | generator/owner/component/acceptance/catalog L2 | catalog fixture/seed/L2 fixture | string fields→typed facts |
| inventory conversion assembly | inventory shards/P1 generator/TS | inventory owner readbacks | InventoryDetailDrawer | owner/component/acceptance/catalog L2 | catalog inventory seed/L2 fixture | conversion string→unit facts；structured aggregates保留 |
| 14 个 screen criterion | edge-contract+assertion matrix unique generated inputs | owner methods必须返回完整 criterion | 不新增 fields/probe state | generator/static/acceptance | N/A：不改变业务 fixture shape | 文案与逻辑同步改写 |
| composite ARCHIVED dead value | catalog schemas/generator/Java/TS | §10 CHECK；CatalogOwnerService 两查询 | 不再显示 ARCHIVED option | migration/owner/acceptance/component | catalog fixture/seed/L2 fixture | fail-closed 后清除语义 |
| active memory/standards | backend standard、foundation charter、4 memories、corpus G-08 | N/A runtime | N/A | 人工三维对账 | N/A | 同批改写冲突旧义 |

任何一格的路径在实施前搜索出现新成员，都必须先加入本表对应行，不能先改主程序。实施后用
同一行逐格回读；旧测试、fixture、seed 或 runtime consumer 仍消费退役事实即 CP 未完成。

## 9b · 变更定位（唯一锚点）

| 目标 | 唯一锚点；实施前必须用 `rg -n -F` 证明单命中 |
|---|---|
| count source consumer | `EXPECTED_COUNTS`、`EXPECTED_OPERATION_COUNT`、`expectedReads`、`expectedCommandsByFace` 各文件内现存声明 |
| BusinessChannel edit guard | `private static void requireEditable(` |
| stop reason command | `applyExternalStopReason(` |
| template cascade | `cascadeTemplateStop(` |
| binding detach | `returnChannelToDraftAfterBindingDeletion(`；重命名为语义正确的 detach method |
| invitation create | `createWithFacts(` |
| invitation complete | `completeReadyInvitation(` |
| account boolean helper | `accountExists(` 返回 boolean 的唯一 helper |
| contract create | `createSubmission(` 与第一次 INSERT 之间的 policy read |
| StoreContract lookup | `record StoreContractContext(` |
| composite filters | `status <> 'ARCHIVED'` 在 CatalogOwnerService 的两处生产 query |
| catalog old handlers | 五个 exact operationId 字面量 |
| invitation canonical exception | `private static String canonical(`，必须证明未改 |
| extension reduce deviation | `reduce((first, second)` in `ExtensionDefinitionService`；本批不改，见 §12 |

## 10 · 数据迁移

### 10.1 migration 文件

| migration | 加/改什么 | 旧行回填 | 唯一事实理由 | 回滚 |
|---|---|---|---|---|
| `apps/backend/catering-business-server/src/main/resources/db/migration/V20260827_010000_000__base1_three_state_lifecycle.sql` | 状态 CHECK、回填、status 列、business partial unique、SKU predicates、composite dead value | 下表逐表固定 | Dexter 三态裁定与已有值语义 | forward-only；任一 precondition/DDL 失败整事务回滚 |
| `apps/backend/catering-business-server/src/main/resources/db/migration/V20260827_010000_001__base1_business_channel_derived_facts.sql` | `DROP COLUMN business_channel.business_channel.stop_reasons` | 无 | 级联不是存储事实，列和所有 producer 已先退役 | forward-only；旧 migration 不改 |

### 10.2 状态表、列、CHECK 与回填全集

| schema.table | 列 | 当前集合 | 精确回填 | 目标约束 |
|---|---|---|---|---|
| `organization.organization_node` | `status` | ENABLED/DISABLED | 无 | `ck_organization_node_status CHECK (status IN ('ENABLED','DISABLED','VOIDED'))` |
| `organization.brand` | `status` | ENABLED/DISABLED | 无 | `ck_brand_status` 同三值 |
| `organization.tenant` | `status` | ENABLED/DISABLED | 无 | `ck_tenant_status` 同三值 |
| `organization.head_company` | `status` | ENABLED/DISABLED | 无 | `ck_head_company_status` 同三值 |
| `organization.store` | `status` | ENABLED/DISABLED | 无 | `ck_store_status` 同三值 |
| `workspace_iam.workspace_account` | `status` | ENABLED/DISABLED | 无 | `ck_workspace_account_status` 同三值 |
| `workspace_iam.workspace_role` | `status` | ENABLED/DISABLED | 无 | `ck_workspace_role_status` 同三值 |
| `business_channel.business_channel_template` | `status` | ENABLED/DISABLED | 无 | `business_channel_template_status_check` 同三值 |
| `business_channel.business_channel` | `status` | DRAFT/EFFECTIVE/DISABLED | `DRAFT→DISABLED`;`EFFECTIVE→ENABLED`;`DISABLED→DISABLED` | `business_channel_status_check` 同三值 |
| `catalog.unit_definition` | `status` | ENABLED/DISABLED | 无 | `unit_definition_status_check` 同三值 |
| `catalog.catalog_category` | `status` | 已是三值 | 无 | 现有三值 CHECK 保持；需求所称“两值”不作为实施事实 |
| `catalog.catalog_item` | `status` | DRAFT/ENABLED/DISABLED/ARCHIVED/VOIDED | `DRAFT→DISABLED`;`ARCHIVED→VOIDED` | `catalog_item_status_check` 同三值 |
| `catalog.catalog_sku` | `status` | ENABLED/DISABLED/ARCHIVED/VOIDED | `ARCHIVED→VOIDED` | `catalog_sku_status_check` 同三值 |
| `catalog.catalog_attribute_definition` | 新增 `status` | 无 | nullable add→全量 ENABLED→NOT NULL | `ck_catalog_attribute_definition_status` 同三值 |
| `catalog.catalog_order_option_definition` | 新增 `status` | 无 | nullable add→全量 ENABLED→NOT NULL | `ck_catalog_order_option_definition_status` 同三值 |
| `catalog.catalog_composite_component` | `status` | ENABLED/DISABLED/ARCHIVED | 存在 ARCHIVED 立即抛错；零行后不回填 | CHECK 只含 ENABLED/DISABLED |

精确回填语句：

```sql
UPDATE business_channel.business_channel
SET status = CASE status
  WHEN 'DRAFT' THEN 'DISABLED'
  WHEN 'EFFECTIVE' THEN 'ENABLED'
  WHEN 'DISABLED' THEN 'DISABLED'
END
WHERE status IN ('DRAFT', 'EFFECTIVE', 'DISABLED');

UPDATE catalog.catalog_item
SET status = CASE status
  WHEN 'DRAFT' THEN 'DISABLED'
  WHEN 'ARCHIVED' THEN 'VOIDED'
  ELSE status
END
WHERE status IN ('DRAFT', 'ARCHIVED');

UPDATE catalog.catalog_sku
SET status = 'VOIDED'
WHERE status = 'ARCHIVED';

ALTER TABLE catalog.catalog_attribute_definition ADD COLUMN status VARCHAR(16);
UPDATE catalog.catalog_attribute_definition SET status = 'ENABLED' WHERE status IS NULL;
ALTER TABLE catalog.catalog_attribute_definition ALTER COLUMN status SET NOT NULL;

ALTER TABLE catalog.catalog_order_option_definition ADD COLUMN status VARCHAR(16);
UPDATE catalog.catalog_order_option_definition SET status = 'ENABLED' WHERE status IS NULL;
ALTER TABLE catalog.catalog_order_option_definition ALTER COLUMN status SET NOT NULL;
```

实施时 `ADD COLUMN` 必须先确认现库列不存在；存在但 shape 不同即停机，不使用 `IF NOT EXISTS`
掩盖漂移。其他表不执行数据 UPDATE，只替换 CHECK，因为存量值已经是 ENABLED/DISABLED。

### 10.3 普通业务 unique → partial unique 全集

统一 predicate 是 `status <> 'VOIDED'`；nullable channel code 另保留 `IS NOT NULL`。

| 表 | drop | create（列顺序沿用现约束） |
|---|---|---|
| `organization_node` | `uq_organization_node_code` | `ux_organization_node_active_code(workspace_uuid,group_workspace_key,node_type,code) WHERE status <> 'VOIDED'` |
| `brand` | `uq_brand_code` | `ux_brand_active_code(workspace_uuid,group_workspace_key,code) WHERE status <> 'VOIDED'` |
| `brand` | `uq_brand_normalized_name` | `ux_brand_active_name(workspace_uuid,group_workspace_key,lower(btrim(name))) WHERE status <> 'VOIDED'` |
| `tenant` | `uq_tenant_code` | `ux_tenant_active_code(workspace_uuid,group_workspace_key,code) WHERE status <> 'VOIDED'` |
| `tenant` | `uq_tenant_credit_code` | `ux_tenant_active_credit_code(workspace_uuid,group_workspace_key,credit_code) WHERE status <> 'VOIDED'` |
| `tenant` | `uq_tenant_normalized_name` | `ux_tenant_active_name(workspace_uuid,group_workspace_key,lower(btrim(name))) WHERE status <> 'VOIDED'` |
| `head_company` | `uq_head_company_code` | `ux_head_company_active_code(workspace_uuid,group_workspace_key,code) WHERE status <> 'VOIDED'` |
| `head_company` | `uq_head_company_credit_code` | `ux_head_company_active_credit_code(workspace_uuid,group_workspace_key,credit_code) WHERE status <> 'VOIDED'` |
| `head_company` | `uq_head_company_normalized_name` | `ux_head_company_active_name(workspace_uuid,group_workspace_key,lower(btrim(name))) WHERE status <> 'VOIDED'` |
| `store` | `uq_store_code` | `ux_store_active_code(workspace_uuid,group_workspace_key,code) WHERE status <> 'VOIDED'` |
| `store` | `uq_store_normalized_name` | `ux_store_active_name(workspace_uuid,group_workspace_key,lower(btrim(name))) WHERE status <> 'VOIDED'` |
| `workspace_account` | `uq_workspace_mobile` | `ux_workspace_account_active_mobile(workspace_uuid,group_workspace_key,mobile_normalized) WHERE status <> 'VOIDED'` |
| `workspace_account` | `uq_workspace_login` | `ux_workspace_account_active_login(workspace_uuid,group_workspace_key,login_name_normalized) WHERE status <> 'VOIDED'` |
| `workspace_role` | `uq_workspace_role_name` | `ux_workspace_role_active_name(workspace_uuid,group_workspace_key,name) WHERE status <> 'VOIDED'` |
| `business_channel_template` | `uq_business_channel_template_project_code` | `ux_business_channel_template_active_project_code(workspace_uuid,group_workspace_key,project_ref,template_code) WHERE template_code IS NOT NULL AND status <> 'VOIDED'` |
| `business_channel` | `uq_business_channel_group_channel_code` | `ux_business_channel_active_group_code(workspace_uuid,group_workspace_key,channel_code) WHERE channel_code IS NOT NULL AND status <> 'VOIDED'` |
| `catalog_category` | `catalog_category_data_node_ref_brand_ref_code_key` | `ux_catalog_category_active_code(data_node_ref,brand_ref,code) WHERE status <> 'VOIDED'` |
| `catalog_attribute_definition` | ordinary unique + `ix_catalog_attribute_definition_scope_code` | `ux_catalog_attribute_definition_active_code(data_node_ref,brand_ref,code) WHERE status <> 'VOIDED'` |
| `catalog_order_option_definition` | `uq_catalog_order_option_definition_scope_code` | `ux_catalog_order_option_definition_active_code(data_node_ref,brand_ref,code) WHERE status <> 'VOIDED'` |
| `unit_definition` | `unit_definition_data_node_ref_brand_ref_code_key` | `ux_catalog_unit_definition_active_code(data_node_ref,brand_ref,code) WHERE status <> 'VOIDED'` |

实施前仍必须从被 drop 约束的 `pg_get_constraintdef`/owning migration 回读列序；若运行时约束定义
与上表不一致，触发 §13 停机，不按文档覆盖真实 DDL。

保留 `uq_*_workspace_ref`、`uq_catalog_order_option_definition_scope_ref`、PK/FK support unique、
receipt/idempotency unique、子集合 display-order unique。

### 10.4 已有 partial index 与明确不动项

- 保留 `ux_catalog_item_active_code ... WHERE status <> 'VOIDED'`。
- 保留 `ux_catalog_sku_active_code ... WHERE status <> 'VOIDED'`。
- `ux_catalog_sku_default_per_item` 改为 `WHERE is_default AND status <> 'VOIDED'`。
- `ux_catalog_sku_variant_digest_per_item` 改为 `WHERE status <> 'VOIDED'`。
- 不改 `stock_target_definition_status_check`、`stock_bom_definition_status_check`、
  `ux_inventory_stock_target_active_identity ... WHERE definition_status='ENABLED'`、
  `ux_inventory_stock_bom_active_identity ... WHERE definition_status='ENABLED'` 和三处同 predicate
  `ON CONFLICT`。

### 10.5 迁移 SQL 顺序与失败条件

1. 对每表检查未知 status；命中即 `RAISE EXCEPTION`，异常只含表/约束，不记录业务行。
2. 检查 component ARCHIVED；非零即失败，不做 UPDATE。
3. 执行显式 status 回填；检查 null 为零。
4. 按每个目标 key 对 `status <> 'VOIDED'` 集合做 duplicate query；账号手机/登录分别检查。
5. drop 旧 CHECK，add 新 CHECK；新增 status 列完成 NOT NULL。
6. 在 Flyway 事务内先创建目标 partial unique；全部成功后 drop 对应普通 unique/index。
7. 改 SKU 两 predicate；再次查询 predicate 与目标 exact match。
8. 第二 migration 只在所有 stop reason runtime producer/consumer 已退役的同一 CP drop column。

## 10b · seed 数据

### 10b.1 受影响 seed 全集

| seed 文件 | 影响 | 处置 |
|---|---|---|
| `doc/plans/platform/2026-07-25-v2s-r5-full-dev-seed-fixture-contract.json` | role/account/organization/contract/invitation 状态 | 每类主数据覆盖 ENABLED/DISABLED/VOIDED；邀请完成发生在账号停用前；禁止复用停用账号 |
| `scripts/dev/profiles/r5-full.json` | R5 seed profile 引用 | 同步新 fixture identity，不新增隐式 seed |
| `scripts/dev/r5-seed-plan.mjs` | owner command 顺序 | create→必要绑定→transition；不调用五个退役 operation |
| `scripts/dev/owner-command-seed-executor.mjs` | 旧 command/account flow | 切 transition；账号停用后不再邀请 |
| `scripts/dev/r5-complete-seed-executor.mjs` | parent orchestration | 将 collaboration/business-channel child 明确纳入或明确独立执行；本稿建议纳入，使 R5 full 真正覆盖该域 |
| `contracts/policy/catalog-inventory-fixture-catalog.json` | DRAFT/ARCHIVED、summary/path/relation fixtures | 三态；结构 facts；删除旧装配断言 |
| `contracts/policy/catalog-inventory-media-assets.json` | catalog refs | 仅当 fixture ref 变化时同步；资产二进制不变 |
| `scripts/dev/profiles/catalog-inventory.json` | catalog seed profile | 同步新 fixture refs/operation IDs |
| `scripts/dev/catalog-inventory-seed-plan.mjs` | delete/disable commands | 四 transition；D01 未裁时停 |
| `scripts/dev/catalog-inventory-seed-executor.mjs` | 120-171,1083-1087,1252,2536,2705-2718,2838,2858-2939 旧形态 | 删除 summary/path/relation old fields；switch transition；三态 |
| `contracts/collaboration/external-platform-catalog.json` | 46 translation positions | 删除 code-defined translation，只保留 codes 与业务实体名 |
| `scripts/dev/external-collaboration-business-channel-seed-plan.mjs` | cascade/old status | upstream disable/restore 不写 channel self status；DISABLED editable；VOIDED terminal |
| `scripts/dev/external-collaboration-business-channel-seed-executor.mjs` | stop reason/old status operations | 删除 stop reason assertions，切新结构 readback |
| `contracts/policy/catalog-inventory-l2-case-blueprint.json` | archived-only fixture | 改 VOIDED terminal fixture；保持它是 L2 fixture 不是 DEV seed |
| `scripts/test/browser-l2-catalog-fixture.mjs` | L2 fixture materialization | 新 contract facts/operation IDs |
| `scripts/test/catalog-inventory-l2-fixture.mjs` | L2 catalog data | 同上 |

### 10b.2 新功能与旧功能调整

- **新增分支**：每类主数据至少各一 ENABLED/DISABLED/VOIDED；上游 DISABLED 后下游自身状态不变；
  上游恢复后自动可用；不可绑定账号 create/complete；DISABLED role；store/tenant create reject；
  VOIDED business code reuse。
- **旧形状退役**：DRAFT/ARCHIVED、stop reason、五个旧 operation、boolean accountExists、字符串
  path/summary/relation/conversion、static catalog 翻译字段全部从 seed assertion 删除。
- **D02/D03**：账号只有 VOIDED 历史时的 seed 和点单选项父子同 code 重建 fixture 在裁定前不得写成
  PASS 预期；必须作为 blocked fixture 记录。

### 10b.3 static tests 与边界

同步 `scripts/dev/owner-command-seed-executor.test.mjs`、`r5-complete-seed-executor.test.mjs`、
`catalog-inventory-seed-executor.test.mjs`、`scripts/test/seed-report.test.mjs`、
`catalog-inventory-seed-identity.test.mjs`、`catalog-inventory-definition-seed.test.mjs`、
`catalog-inventory-query-envelope.test.mjs`。acceptance fixture 仍在各 `*AcceptanceScenarios.java` 内，
不作为 DEV seed。此节只设计，不授权 reset/seed。

## 11 · 验收场景设计

### 11.1 新增/改写 backend-acceptance 场景

| scenario id | owner file | identity | fixture | request | businessOracle |
|---|---|---|---|---|---|
| `iam.disabled-account-invitation-create-rejected` | `IamAcceptanceScenarios.java` | inviter + DISABLED/VOIDED account | 同 mobile/login 的两种账号态 | 五类 create invitation 中代表性 owner command；静态 exact-set 证明同 helper 覆盖五类 | 422 `ACCOUNT_NOT_BINDABLE`; invitation/intent/audit row delta=0 |
| `iam.disabled-account-invitation-complete-rejected` | 同上 | ready invitation，随后账号转 DISABLED/VOIDED | 两个竞态分支 | public complete | 422；invitation 非 COMPLETING；credential/assignment/audit delta=0 |
| `iam.disabled-role-invitation-create-rejected` | 同上 | DISABLED 与 VOIDED role | invitation ref 指向不可用 role | create invitation | typed 422；任何 invitation write 前拒绝 |
| `iam.invitation-readiness-account-presence-status` | 同上 | ABSENT/ENABLED/DISABLED/VOIDED | 四个独立 identity；另有历史 VOIDED+当前 ENABLED | verify/save readiness | response enum exact；当前非 VOIDED 胜过历史；D02 分支按裁定 |
| `contract.disabled-store-or-tenant-create-rejected` | `CommercialContractAcceptanceScenarios.java` | contract editor | ENABLED/DISABLED/VOIDED store×tenant 最小判别矩阵 | create contract | 任一 required owner 非 ENABLED 即 typed 422；contract/extension/audit=0 |
| `business-channel.upstream-status-read-time-recovery` | `BusinessChannelAcceptanceScenarios.java` | project/store channel editor | template/external/provider 各 disable→restore | read channel before/after | channel self status/version 不因上游变；blocker 出现/消失；无 stop column/DML |
| `business-channel.disabled-edit-voided-terminal` | 同上 | channel/template editor | DISABLED 与 VOIDED objects | update/transition/new reference/existing reference save | DISABLED edit+enable 成功；VOIDED拒绝；new ref拒绝；unchanged ref成功 |
| `catalog.lifecycle-transition-and-code-release` | `CatalogAcceptanceScenarios.java` | catalog editor | category/unit/attribute/option/item/SKU 三态 | four transition + create same business code | old five routes absent；VOIDED parent code 按 D03 边界；new ref 唯一 |
| `catalog.structured-read-model-facts` | 同上 | catalog reader | item with path/tags/SKU attrs/options/refs/inventory conversion | list/detail/SKU/inventory GET | response has typed facts；old summary/path-label/relation-label fields absent |
| `collaboration.structured-code-and-path-facts` | `CollaborationAcceptanceScenarios.java` | platform collaboration admin | system/profile/binding with full codes/path | catalog/list/detail | business entity names + raw enum codes + node array；12 DisplayName 字段无 |

现有场景必须改写而不重复新增：

- BusinessChannel：`business-channel.cascade-and-draft`、`double-source-and-manual-stop`、
  `store-template-scope`、`disabled-store-create`、`planned-provider-candidate`、
  `cross-node-read-authorization`、`same-store-two-owner-ids`。
- Catalog：`catalog.code-release-voided-not-archived`、`category-relation-integrity`、
  `dictionary-rename-and-void`、`attribute-definition-delete-cascade`、
  `order-option-definition-delete-cascade`、`unit-list-boolean-query-and-status-filter`、
  `item-create-draft-category`、`tag-navigation`、`item-sku-page-contract`、
  `shape-manifest-fields-project-through-http`。
- IAM：`iam.public-invitation-view`、`iam.public-invitation-lifecycle`、
  `iam.cancelled-invitation-is-terminal`、`pagination.workspace-iam-page-owner-boundary`、
  `pagination.workspace-user-candidates-db-page`。
- Contract：`contract.lifecycle-preserves-fields`、`stale-edit-preserves-fixed-bindings`、
  `invalidation-updates-store-derived-status`、`pagination.contract-page-owner-boundary`。
- Organization：`org.project-state-and-readback`、`org.store-state-and-derived-status`、
  `org.business-entity-fields-and-status`、`pagination.organization-page-owner-boundary`。
- Collaboration：`collaboration.catalog-readback`、`planned-profile-enablement`、
  `bindable-node-candidates`、`binding-page-searches-node-name`、
  `provider-binding-edit-policy`、`logical-delete-retains-row`。

### 11.2 focused、contract 与 static 文件全集

Backend migration/lifecycle/catalog：

- 新增 `apps/backend/catering-business-server/src/test/java/database/MasterDataLifecycleMigrationIntegrationTest.java`。
- `modules/catalog/src/test/java/com/catering/v2s/catalog/api/CatalogOwnerTypesTest.java`
- `modules/catalog/src/test/java/com/catering/v2s/catalog/application/CatalogBatchStatusTransitionIntegrationTest.java`
- `CatalogCategoryOwnerIntegrationTest.java`
- `CatalogDictionaryReorderIntegrationTest.java`
- `CatalogInventoryDisplayFactsTest.java`
- `CatalogPageQueryContractTest.java`
- `modules/workspace-iam/src/test/java/com/catering/v2s/workspace/iam/application/WorkspaceIamIndexMigrationIntegrationTest.java`
- `WorkspaceRoleServiceTest.java`
- `WorkspaceAccountPlatformReceiptTest.java`
- `modules/organization/src/test/java/com/catering/v2s/organization/application/OrganizationOwnerServiceTest.java`
- `apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/edge/operations/cataloginventory/OperationsCatalogInventoryControllerRouteTest.java`
- `apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/BackendAcceptanceTest.java`
- `BackendPerformanceOperationCoverage.java`

BusinessChannel/collaboration：

- `modules/business-channel/src/test/java/com/catering/v2s/businesschannel/application/BusinessChannelOwnerContractTest.java`
- `BusinessChannelCommandQueryTest.java`
- `BusinessChannelPolicyTest.java`
- `modules/collaboration/src/test/java/com/catering/v2s/collaboration/application/CollaborationOwnerContractTest.java`
- `CheckedInCollaborationCatalogSourceTest.java`
- `src/test/java/com/catering/v2s/app/edge/operations/businesschannel/OperationsBusinessChannelControllerScopeTest.java`
- `src/test/java/com/catering/v2s/app/edge/platform/externalcollaboration/PlatformExternalCollaborationControllerTest.java`

Contract/IAM：

- `modules/organization/src/test/java/com/catering/v2s/organization/application/BusinessEntityStoreContractQueryTest.java`
- `modules/store-contract/src/test/java/com/catering/v2s/contract/application/ContractCommandServiceTest.java`
- `src/test/java/com/catering/v2s/app/edge/operations/contract/OperationsContractControllerScopeAndCandidateTest.java`
- `src/test/java/com/catering/v2s/app/edge/platform/contract/PlatformContractOverviewControllerTest.java`
- `modules/workspace-iam/src/test/java/com/catering/v2s/workspace/iam/application/WorkspaceInvitationPublicFlowTest.java`
- `src/test/java/com/catering/v2s/app/edge/publicentry/invitation/PublicInvitationControllerTest.java`
- `src/test/java/com/catering/v2s/app/edge/operations/access/OperationsWorkspaceInvitationServerScopeTest.java`
- `src/test/java/com/catering/v2s/workspace/iam/application/operations/OperationsWorkspaceInvitationOperationTest.java`
- `src/test/java/edge/problem/ContractProblemAdviceTypedOwnerMappingTest.java`
- `src/test/java/com/catering/v2s/app/bootstrap/ManagedInvitationBootstrapTest.java`

Frontend focused/static：

- operations business channel architecture：`business-channel-owner-binding-collection.test.mjs`、
  `business-channel-scope.test.mjs`、`business-channel-table-sorting.test.mjs`、`static-boundary.test.mjs`。
- platform collaboration：`OwnerBindingDetailDrawer.test.ts`、`OwnerBindingList.test.ts`、
  `external-collaboration-collection.test.mjs`。
- catalog：`catalogDefinitionForm.test.ts`、`catalogManifestLabels.test.ts`、
  `catalogItemSaveRequest.test.ts`、`useCatalogConfigLibrary.test.ts`、
  `CatalogDictionaryDrawerState.test.ts`、`CatalogItemDrawer.test.tsx`、
  `CatalogItemGovernanceView.test.tsx`、`CatalogItemListTable.test.tsx`、
  `CatalogManagementPage.test.tsx`、`CatalogUserVisibleCopy.test.tsx`、
  `CatalogWorkbenchNavigationTree.test.tsx`。
- foundation/path：`libraries/frontend/admin-ui-foundation/src/foundation.test.ts`、operations
  `static-boundary.test.mjs`。
- tooling：`scripts/test/frontend-idempotency-boundary.test.mjs`、
  `frontend-transport-cache-lifecycle.test.mjs`、`backend-performance-budget.test.mjs`、
  `catalog-inventory-query-envelope.test.mjs`、`catalog-p3-model-migration.test.mjs`、
  `catalog-inventory-rtk-tag-generation.test.mjs`。
- static gates：`scripts/check/edge-codegen`、`openapi-contracts`、`contract-face`、
  `operation-handler-bindings`、`frontend-architecture`、
  `external-collaboration-business-channel-contract`。

### 11.3 Browser L2 设计（不授权执行）

Catalog 唯一链：`contracts/policy/catalog-inventory-l2-case-blueprint.json`、
`catalog-inventory-l2-scenarios.json`、`catalog-inventory-l2-execution.json`、
`catalog-inventory-l2-locators.json`、`scripts/generate/catalog-inventory-p1.mjs`、
`apps/frontend/operations-admin/src/tests/l2/catalog-inventory.spec.ts`、
`scripts/test/browser-l2-runtime.mjs`。

受影响 case：`CI-L2-001-04`、`CI-L2-001-05`、`CI-L2-004-01`、`CI-L2-006-01`、
`CI-L2-006-02`、`CI-L2-007-01`、`CI-L2-007-02`、`CI-L2-007-03`、
`CI-L2-007-04`、`CI-L2-007-05`、`CI-L2-007-06`、`CI-L2-007-07`、
`catalog-view-success`、`catalog-view-failure`、`catalog-view-recovery`、
`catalog-edit-success`、`catalog-edit-failure`、`catalog-edit-recovery`、
`catalog-config-success`、`catalog-config-failure`、`catalog-config-recovery`、
`catalog-governance-success`、`catalog-governance-failure`、`catalog-governance-recovery`。

现有非 catalog specs：operations `business-entity-management.spec.ts`、
`organization-hierarchy.spec.ts`、`store-management.spec.ts`、`contract-management.spec.ts`、
`invitation-acceptance.spec.ts`、`user-management.spec.ts`；platform `role-management.spec.ts`、
`workspace-account-management.spec.ts`、`organization-overview.spec.ts`、
`contract-overview.spec.ts`、`extension-field-management.spec.ts`。

新增 specs：
`apps/frontend/operations-admin/src/tests/l2/business-channel-management.spec.ts` 与
`apps/frontend/platform-admin/src/tests/l2/external-collaboration-management.spec.ts`。

每个受影响 case 必须覆盖 success/failure/recovery，立即输出当前 case、完成数、剩余数和阶段；
business 与 cleanup 分开。L2 不在本次设计授权内，未来须单独授权。

## 12 · 未决与受控延期

| 项目 | 当前状态 | 本批允许 | 本批禁止 |
|---|---|---|---|
| D01 四 transition | Dexter 未裁 | 合并稿列出源码反例与推荐 B | 按需求原两条直接实施导致分类/单位无命令 |
| D02 only-VOIDED account identity | Dexter 未裁 | lookup 确定性优先当前非 VOIDED；测试两候选 | 将历史 VOIDED 随机当当前；前端猜 |
| D03 option child code | Dexter 未裁 | 如实保留子 code 占用或另批模型设计 | 宣称整个定义 code 已释放 |
| binding 阻断场景 | Dexter 未裁 | 返回各维事实；首写前预留 policy 判点 | 固化 effectiveStatus/problem/UI disable |
| menu publication | capability 不存在 | 记忆/未来准入引用 | 虚构 operation、owner、test |
| error message 全量前端化 | 原则内、后续批 | 保持现有 typed problem 边界 | 扩大 base-1 删除全部 message |
| ExtensionDefinitionService reduce | 已证实进入 audit UI 的人读复合串，但原需求标为可选偏差 | 登记后续结构化 audit change design | 在无审计模型裁定下删除/改变历史呈现 |
| catalog shapeManifest enumLabels | 可选偏差 | 若合并稿接受，纳入同一字典/contract/consumer分母 | 单独临时改、保留两套字典 |
| 三处作废版本修订日期 | 文档卫生 | 合并时修正 active 正本 provenance | 视为 runtime blocker |

## 13 · 停机条件

必须单条交回 Dexter：D01-D03 任一未裁却已进入实施；binding/menu 需要固化场景；目标 partial
unique 的列与 owning DDL 不同；composite 存量 ARCHIVED 非零；非 VOIDED business key 有重复；
old frontend 无法在短命双投影窗口 typecheck；新增 transition 必须改变既有授权 face；满足业务不变量
必须修改 inventory definition indexes；合同/邀请校验无法在首写前完成；任何上游数字与真实 exact set
不符。

不得以兼容层、fallback、默认值、隐藏字段、静默数据修复、放宽门、增加 timeout 或缩小分母绕过。
报告必须给原文事实、两个候选理解和倾向理由。

## 13b · 实施节奏 · 三维对账

### 13b.1 三个维度

| 维 | 每次必须重开的对象 |
|---|---|
| 一 · 需求 | 两份冻结 BUSINESS_SOURCE；本 CP 对应裁定、明确不做和反例 |
| 二 · 详设与 IA | 本稿 CP 条款、§9a 分母、§9b owning source、IA-ID 与既有交互/Journey |
| 三 · 项目记忆 | 六维 route 本 CP 命中的全部原文；至少含 owner lifecycle、read granularity、business-channel validity、两条 pitfall |

### 13b.2 每个 CP 的强制时点

CP-B0、B1、B2、B3、B4、B5、B6、F1、F2、F3、F4 各自完成 focused proof 后、进入下一
CP 前：主 agent 按同一 §9a 分母回读；随后 fresh 独立子 agent 对行为、形态、动作、关系、位置、
用户文案、限制、state/control、失败/恢复、可访问性/焦点、数据源/失效边界做三维证伪式对账。
逐条输出 `MATCHED/OPEN`。任一 OPEN 由主 agent 做同根修复，再由另一 fresh 子 agent 复查；未
MATCHED 不进入下一 CP。步骤级对账不产出整批 GO/NO-GO，不消耗正式 review 轮次。

### 13b.3 整体时点

F4 完成后、任何整体测试之前，对全批重新逐条走三个维度，不把阶段结果拼接成整体结果。必须
特别反查：短命旧字段是否全退役；后一步是否推翻前一步 owner 判定；IA 字典/路径/失效是否与
final contract 一致；测试/fixture/seed 是否仍消费旧事实；最终 count 与 operation exact set 是否相等。
全部 MATCHED 后才可申请整体测试授权。完成后仍需正式 `REVIEW_TARGET=IMPLEMENTATION` fresh
独立对抗 review；二者互不替代。

## 14 · 交付前自查

| 检查 | 本稿状态 |
|---|---|
| §3 行完整 | 已填 17 行，无整组 N/A |
| §3 ④ 全集 | 每行指向明确事实组；精确物理成员在附录 A-E |
| §7 机制行 | collection/auth/cache/error/log 均有跨层行 |
| 详设 ↔ IA | 需在 fresh review 后把 IA `CROSS_CHECK_WITH_DESIGN` 更新为 PASS |
| seed 全集与两类改动 | §10b 已列 15 个 source/plan/executor/fixture + static tests |
| 计数 | operation 数值明确绑定 D01+GET 建议；未伪称已冻结 |
| 阶段/整体三维对账 | §13b 固定两个时点和 fresh reviewer |
| 证据档位 | focused/static/acceptance/L2 分开；本次均未执行 |

```text
DESIGN_STATUS=INDEPENDENT_DRAFT_PENDING_FRESH_RECONCILIATION
IMPLEMENTATION_AUTHORITY=false
DYNAMIC_EVIDENCE=NONE_NOT_AUTHORIZED
```

## 附录 A · 契约、生成链与 operation 全集

### A.1 Edge OpenAPI

- root：`contracts/openapi/edge.openapi.json`
- path shards：
  `operations-admin/business-channel.paths.json`、`operations-admin/workspace-access.paths.json`、
  `platform-admin/external-collaboration.paths.json`、`platform-admin/contract-overview.paths.json`、
  `platform-admin/workspace-access.paths.json`、`public/invitation-acceptance.paths.json`，均位于
  `contracts/openapi/paths/` 对应 face 目录。
- source/materialized：`contracts/openapi-source/business-channel.schemas.json` →
  `contracts/openapi/components/business-channel/business-channel.schemas.json`；
  `contracts/openapi-source/collaboration.schemas.json` →
  `contracts/openapi/components/collaboration/collaboration.schemas.json`；
  `contracts/openapi/components/contract/contract.schemas.json`；
  `contracts/openapi/components/workspace-iam/workspace-access.schemas.json`。
- workspace access 的唯一 accepted catalog source：
  `doc/plans/platform/2026-07-25-v2s-r5-edge-contract-implementation-catalog.json`，由
  `scripts/generate/r5-edge-materialize.mjs` materialize。
- codegen：`scripts/generate/edge-codegen.mjs`。
- generated Java：`BusinessChannelTemplateView`、`BusinessChannelView`、`ExternalSystemView`、
  `ProviderProfileView`、`OwnerBindingView`、`ContractOverviewItem`、
  `PlatformWorkspaceInvitation`、`WorkspaceInvitation`、`WorkspaceAccountAssignmentsItem`、
  `WorkspaceUserAssignmentsItem`、`WorkspaceInvitationCandidatePageOrganizationsItem`、
  `PublicInvitationCredentialResponse`、`PublicInvitationReadiness`。
- generated TS 八文件：platform `platform-edge.ts/.rtk.ts`；operations
  `operations-edge.ts/.rtk.ts`、`public-edge.ts/.rtk.ts`、
  `catalog-inventory-edge.ts/.rtk.ts`。

Edge mapper/controller 全集：

- `BusinessChannelWireMapper`、`OperationsBusinessChannelController`
- `ExternalCollaborationWireMapper`、`PlatformExternalCollaborationController`
- `PlatformContractOverviewController`
- `OperationsWorkspaceUserController`、`PlatformWorkspaceAccountController`
- `WorkspaceInvitationCandidatePageWireMapper`、`WorkspaceInvitationWireMapper`、
  `PlatformWorkspaceInvitationWireMapper`、`PublicInvitationController`
- `OperationsCatalogInventoryController`（JsonNode pass-through 反例，字段 owner 在 generator/owner）。

当前 `bindingStatus`/`bindingStatusDisplayName` 只存在 materialized component/generated/mapper，
不在 `contracts/openapi-source/business-channel.schemas.json`。CP-B4 必须先把 raw `bindingStatus`
补到 source，再由唯一 materializer/codegen 生成；`bindingStatusDisplayName` 不补 source，final 直接从
materialized/generated/mapper 删除。不得继续把 materialized component 当手工正本。

### A.2 Catalog/inventory 唯一生成链

- generators：`scripts/generate/catalog-inventory-p1.mjs`、
  `scripts/generate/catalog-inventory-p3-frontend.mjs`
- inputs：`contracts/catalog/catalog-inventory-edge-contract.json`、
  `catalog-inventory-edge-placement.json`、`catalog-inventory-rtk-tag-policy.json`、
  `catalog-inventory-read-models.json`、
  `contracts/policy/catalog-inventory-assertion-matrix.json`、
  `catalog-inventory-design-byte-coverage.json`
- OpenAPI：`contracts/openapi/catalog-inventory.openapi.json`；components
  `catalog-workbench.schemas.json`、`catalog-item.schemas.json`、`catalog-dictionary.schemas.json`、
  `inventory-common.schemas.json`、`inventory-command.schemas.json`、`inventory-workbench.schemas.json`
- generated：`contracts/catalog/CatalogInventoryEdgeWire.java`；catalog TS/RTK；build generated
  `CatalogCategoryReadback`、`CatalogItemDetail`、`CatalogItemSkuPage`、`InventoryTargetCurrentView`
- registries/bindings：`catalog-inventory-edge-route-registry.json`、`edge-route-face-registry.json`、
  `capability-operation-registry.json`、`contracts/registry/operation-handler-bindings.json`、
  `contracts/registry/generated/operation-handler-bindings/catalog.json`、`index.json`、
  generated `CatalogOperationBindings.java`、`BackendPerformanceM1CommandExecutionBindings.java`
- binding generators：`operation-handler-bindings.mjs`、
  `backend-performance-m1-command-execution-bindings.mjs`

### A.3 Structured-field operationId 全集

- `stopReasons`/status dimensions：`getOperationsProjectBusinessChannels`、
  `getOperationsStoreBusinessChannels`、`createOperationsBusinessChannel`、
  `getOperationsBusinessChannelDetail`、`updateOperationsBusinessChannel`、
  `transitionOperationsBusinessChannelStatus`。
- account presence：`verifyPublicInvitationOtp`、`savePublicInvitationCredentials`。
- contract phase/items：`getPlatformContractOverviewPage`、`getPlatformContractOverviewDetail`。
- invitation route facts：platform `getWorkspaceInvitations/createWorkspaceInvitation/
  getWorkspaceInvitation/cancelWorkspaceInvitation/reissueWorkspaceInvitation`；operations 的
  Group、Region、Project、HeadCompany、Store 各 list/create/cancel/reissue，共 25 个 operation。
- invitation candidate path：platform `getWorkspaceInvitationCandidates`；operations 五个
  `getOperationsWorkspace{Group|Region|Project|HeadCompany|Store}InvitationCandidates`。
- account/user organization path：platform `getWorkspaceAccounts/getWorkspaceAccount/
  transitionWorkspaceAccountStatus`；operations 五类 `getOperationsWorkspace*User`、五类
  `getOperationsWorkspace*UserAccount`、五类 `revokeOperationsWorkspace*UserAssignment`。
- binding path：`getPlatformProviderProfileBindings`、`getPlatformOwnerBindingDetail`、
  `updatePlatformOwnerBinding`、`deletePlatformOwnerBinding`、`createPlatformOwnerBinding`、
  `getOperationsOwnerBindingDetail`、`createOperationsOwnerBinding`、
  `deleteOperationsOwnerBinding`。
- catalog structured fields：`getOperationsCatalogNavigation`、`getOperationsCatalogItems`、
  `getOperationsCatalogItem`、`getOperationsCatalogItemSkus`、四个 category commands、
  `getOperationsInventoryTargets`、`getOperationsInventoryTarget`、
  `countOperationsInventoryTarget`、`increaseOperationsInventoryTarget`、
  `adjustOperationsInventoryTarget`、`updateOperationsInventoryTargetConfiguration`。

### A.4 14 条旧按屏 criterion

`contracts/catalog/catalog-inventory-edge-contract.json` 与
`contracts/policy/catalog-inventory-assertion-matrix.json` 各自 operations index 3、29、30、31、32、
33、34 的 `/logicSteps/1/action`，对应 item detail、inventory current/change summary/business
history/consumption references/ledger/diagnostics。两份共 14 条，全部从“approved detail section”
改为“owner 返回该业务 criterion 的全部非无界事实；分页子集合保持独立 operation”。

## 附录 B · 最终退役清单

### B.1 operation 与 runtime

- 五个 old operationId、HTTP route、controller method、operation handler、owner delete/disable method、
  command token、operation binding、generated binding、RTK hook、seed/test invocation 全删。
- 若 §5.2 收敛建议获批，`getOperationsInventoryTargetChangeSummary` 的 route、handler、hook、
  registry/binding、test/seed consumer 全删，事实由 current target readback 单源提供。
- BusinessChannel `requireEditable` 七个 live call 按 CP-B2 替换后删除 helper；coordinator dead helper 删除。

### B.2 stop reason 全链

- DB live column；旧 migration只留历史。
- contract source/materialized required/properties：`stopReasons`、`stopReasonDisplayNames`；Java/TS。
- `BusinessChannelReadback.Channel.stopReasons`；`BusinessChannelCommandApi.applyExternalStopReason`
  及 overload/command type。
- `BusinessChannelPolicy.MANUAL/CASCADE_TEMPLATE/CASCADE_EXTERNAL`。
- owner projections、insert/readback、transition blockers、manual DML、external apply、reason accumulate、
  template cascade 与 caller。
- `ExternalCollaborationBusinessChannelCoordinator` external system/provider transition cascade calls。
- `BusinessChannelWireMapper`；`BusinessChannelDetailDrawer`；owner/edge/acceptance/seed assertions。
- active memory 中“同事务停用下游/追加 CASCADE/读已物化 stopReasons”的旧义。

### B.3 12 个代码闭集 DisplayName 字段

Business-channel 七个：`accessKindDisplayName`、`operatorKindDisplayName`、`orderKindDisplayName`、
`dineInFormDisplayName`、`statusDisplayName`、`ownerNodeTypeDisplayName`、
`bindingStatusDisplayName`。

Collaboration 五个：`authenticationKindDisplayName`、`unbindKindDisplayName`、
`catalogStatusDisplayName`、`capabilityClassDisplayName`、`statusDisplayName`。

保留实体名字：`externalSystemDisplayName`、`providerDisplayName`、`bindingDisplayName`、
`productionDisplayName`。保留快照 `actorDisplayName` 与其他已证明时点快照。

### B.4 人读装配与旧字段

- paths：invitation/candidate/account/user `organizationPath` string；binding `nodeDisplayPath` string。
- invitation `invitationPageUrl` server string。
- contract `itemSummary`；`phaseName` 保留 nullable raw fact。
- catalog `categoryPathLabels`、`tagSummary`、`skuDimensionSummary`、
  `specificationOrOptionSummary`、`attributeSummary`、`preparationSummary`、`relationLabel`、
  `blockingReferenceLabels`。
- inventory `conversionSummary` 仅在证实是人读字符串的 occurrences 删除并换 typed unit facts；
  `skuSummary`、`inventoryDeductionSummary`、`changeSummary` 保留结构化聚合。
- checked-in external catalog 46 个翻译位置及 schema properties。
- 所有 old mapper helper、generated fields、frontend imports、test/fixture/seed assertions。

### B.5 `requireEditable` 七个 live call 的逐点替换

Owning file：
`apps/backend/catering-business-server/modules/business-channel/src/main/java/com/catering/v2s/businesschannel/application/BusinessChannelOwnerService.java`。

| 当前源码位置 | 业务角色 | 目标 |
|---|---|---|
| 当前约第 511 行 | template 自身 edit | `requireNotVoided(current.status())` |
| 当前约第 649 行 | create channel 新引用 template | `requireEnabledReference(template.status())` |
| 当前约第 736 行 | channel 锁前 self edit | 终态保护，锁后仍权威复核 |
| 当前约第 767 行 | channel 锁后 self edit | `requireNotVoided(current.status())` |
| 当前约第 769 行 | unchanged existing template reference | 删除 status 校验 |
| 当前约第 868 行 | channel transition | current VOIDED 拒绝；DISABLED↔ENABLED 允许 |
| 当前约第 870 行 | transition 时 unchanged template reference | 删除 status 校验 |

删除当前约第 1465 行旧 helper。删除
`ExternalCollaborationBusinessChannelCoordinator` 当前约第 310 行零 caller 同名 helper。
实施用 §9b 锚点定位，不用这些行号写入。

## 附录 C · 前端 handwritten consumer 与目标类型全集

### C.1 business-channel / collaboration

| 输入 | consumer | 目标 |
|---|---|---|
| template code/display fields | `BusinessChannelTemplateDetailDrawer.tsx`、`BusinessChannelTemplateDrawer.tsx`、`ProjectBusinessChannelPage.tsx`、`StoreBusinessChannelPage.tsx`、`BusinessChannelDetailDrawer.tsx` | `accessKind/operatorKind/orderKind/dineInForm/status` + `businessChannelCodeLabels.ts` |
| channel owner/status display | `BusinessChannelDetailDrawer.tsx`、`BusinessChannelList.tsx`、`BusinessChannelBindingDrawer.tsx` | `ownerNodeType/status` + 同字典 |
| collaboration display fields | platform `ExternalSystemDetail.tsx`、`ProviderProfileDetail.tsx`、`OwnerBindingDetailDrawer.tsx`、`OwnerBindingList.tsx`；operations 三个 BusinessChannel drawers | raw codes + 两 app 的 `collaborationCodeLabels.ts` |
| stop reason | `BusinessChannelDetailDrawer.tsx` | 删除；`StatusDimensionFact[]` + `BlockingDimensionFact[]` |
| binding node path | `OwnerBindingDetailDrawer.tsx`、`OwnerBindingList.tsx`、`OwnerBindingFormDrawer.tsx` | `OrganizationPathNode[]` |

完整路径前缀分别是：
`apps/frontend/operations-admin/src/features/business-channel/ui/` 与
`apps/frontend/platform-admin/src/features/external-collaboration/ui/`。

### C.2 workspace-IAM / invitation / foundation

| 输入 | consumer | 目标 |
|---|---|---|
| candidate path | operations `WorkspaceInvitationCreateDrawer.tsx`、`WorkspaceInvitationPanel.tsx`；platform `AccountsPage.tsx`、`PlatformInvitationPanel.tsx` | `OrganizationPathNode[]` |
| targetOrganizationPath | operations `WorkspaceInvitationDetailDrawer.tsx`、`WorkspaceInvitationPanel.tsx`、`PublicInvitationEntry.tsx`；platform `PlatformInvitationPanel.tsx` | typed node array |
| assignment path | operations `WorkspaceUserDetailDrawer.tsx`、`WorkspaceUserRevokeModal.tsx`；platform `AccountsPage.tsx`、`WorkspaceAccountDetailDrawer.tsx`、`WorkspaceAccountActionModal.tsx` | typed node array |
| path renderer | `libraries/frontend/admin-ui-foundation/src/presentation/nameCode.ts`、`src/index.ts` | `NameCodePathText({nodes})`; all consumers switch before string parser delete |
| invitationPageUrl | operations `WorkspaceInvitationDetailDrawer.tsx`、`WorkspaceInvitationPanel.tsx`；platform `PlatformInvitationPanel.tsx`；foundation `activeInvitationPageUrl.ts` | `InvitationRouteFacts={groupWorkspaceKey,invitationToken}` |
| accountExists boolean | generated `public-edge.ts` and public flow adapter | `AccountPresenceStatus` exhaustive |
| role lifecycle | platform `RolesPage.tsx`、`RoleDetailDrawer.tsx`、`RoleStatusModal.tsx`、`RoleEditDrawer.tsx` | `LifecycleStatus`; DISABLED edit; VOIDED terminal |
| account lifecycle | platform `AccountsPage.tsx`、account drawers/modal；operations `WorkspaceUserPage.tsx` | lifecycle + candidate exclusion |
| organization lifecycle | operations structure/business-entity/store pages、detail/status modals | `selfStatus` + `statusDimensions` |

### C.3 catalog / inventory / contract

| old field/action | consumer | target |
|---|---|---|
| categoryPathLabels | `model/catalogModel.ts`; `CatalogItemBasicEditor/View/CreateDrawer/EditorSectionAssembler/ListTable`; category controller | `categoryPath: {categoryRef,code,name}[]` |
| tagSummary | `catalogModel.ts`; `CatalogItemListTable.tsx` | `tags:{tagRef,code,name}[]` |
| skuDimensionSummary | 同上 | typed definition/value facts |
| specificationOrOptionSummary | 同上 | `specificationFacts` + `orderOptionFacts` |
| attributeSummary | 同上 | `attributeFacts` |
| preparationSummary | 同上 | `preparationFacts={productionTag,profile,skuVariation}` |
| relationLabel | `catalogModel.ts`; `CatalogItemGovernanceEditor.tsx`; `CatalogItemGovernanceView.tsx` | `BusinessReference{referenceKind,referenceRef,code,name,direction}[]` |
| blockingReferenceLabels | `catalogModel.ts`; `CatalogCategoryActionModal.tsx` | typed references + count |
| category delete | `useCatalogCategoryActionController.tsx` | category transition VOIDED |
| unit disable/delete | `CatalogDictionaryDrawerState.tsx` | unit transition three states |
| attribute/option delete | `CatalogDefinitionLibraries.tsx` | definition transition VOIDED |
| lifecycle model | `catalogModel.ts`; dictionary/definition libs/navigation tree/item view | `LifecycleStatus` three values |
| itemSummary | platform `PlatformReadPage.tsx` | typed contract items |
| phaseName | platform PlatformReadPage/detail；operations ContractManagementPage/detail/create/edit | nullable fact + frontend empty copy |

Catalog path prefix：`apps/frontend/operations-admin/src/features/catalog-management/`；contract paths：
platform `features/organization-contract-overview/ui/`、operations `features/contract-management/ui/`。

### C.4 已证实但不纳入本批的 Extension deviation

`ExtensionDefinitionService` 的 reduce 产出 `key|label|type|required;...` 并进入 audit fieldDefinitions；
`PlatformAuditHistoryModal.tsx` 与 `OperationsAuditHistoryModal.tsx` 显示 raw 值。它不是“用户可见性未知”。
本批没有已批准的 structured audit-change contract，按 §12 登记延期，不得把它误归非人读豁免。

## 附录 D · testId exact set

### D.1 business-channel

既有：`project-business-channel-page`、`project-business-channel-template-list`、
`project-business-channel-template-retry`、`project-business-channel-template-open-detail-${templateRef}`、
`business-channel-template-create`、`business-channel-template-form`、
`business-channel-template-form-cancel`、`business-channel-template-form-submit`、
`business-channel-template-access-kind`、`business-channel-template-operator-kind`、
`business-channel-template-order-kind`、`business-channel-template-dine-in-form`、
`business-channel-template-provider`、`business-channel-template-detail`、
`business-channel-template-detail-edit`、`business-channel-template-detail-status`、
`store-business-channel-page`、`store-business-channel-template-list`、
`store-business-channel-template-retry`、`${ownerNodeType.toLocaleLowerCase()}-business-channel-list`、
`${listKey}-business-channel-open-detail-${channelRef}`、`${listKey}-business-channel-create`、
`${listKey}-business-channel-retry`、`${ownerNodeType.toLocaleLowerCase()}-business-channel-create`、
`${ownerNodeType.toLocaleLowerCase()}-business-channel-create-cancel`、
`${ownerNodeType.toLocaleLowerCase()}-business-channel-create-submit`、
`${ownerNodeType.toLocaleLowerCase()}-business-channel-template-select`、`business-channel-detail`、
`business-channel-edit-open`、`business-channel-edit`、`business-channel-edit-cancel`、
`business-channel-edit-submit`、`business-channel-binding`、`business-channel-status`、
`owner-binding-external-owner-id`。

新增：`business-channel-status-dimensions`、
`business-channel-status-dimension-${type}-${ref}`、`business-channel-blocker-${type}-${ref}`。

### D.2 external collaboration

`platform-external-system-detail`、`platform-external-system-detail-error`、
`platform-external-system-enable`、`platform-external-system-disable`、
`platform-provider-profile-detail`、`platform-provider-profile-detail-loading`、
`platform-provider-profile-detail-error`、`platform-provider-profile-enable`、
`platform-provider-profile-disable`、`platform-provider-profile-tabs`、
`platform-owner-binding-table`、`platform-owner-binding-name-filter`、
`platform-owner-binding-node-filter`、`platform-owner-binding-detail-${bindingRef}`、
`platform-owner-binding-filter-submit`、`platform-owner-binding-filter-reset`、
`platform-owner-binding-create`、`platform-owner-binding-detail-drawer`、
`platform-owner-binding-detail-loading`、`platform-owner-binding-detail-error`、
`platform-owner-binding-edit`、`platform-owner-binding-delete`、
`platform-owner-binding-form-drawer`、`platform-owner-binding-form-error`、
`platform-owner-binding-name`、`platform-owner-binding-node-type`、
`platform-owner-binding-node`、`platform-owner-binding-external-owner`、
`platform-owner-binding-submit`。

### D.3 IAM / invitation

- roles：`workspace-role-table`、`workspace-role-filter-name`、
  `workspace-role-filter-service-node-type`、`workspace-role-filter-status`、
  `workspace-role-filter-submit`、`workspace-role-filter-reset`、`workspace-role-detail-${id}`、
  `workspace-role-detail-drawer`、`workspace-role-edit`、`workspace-role-transition-status`、
  `workspace-role-status-confirm`、`workspace-role-status-cancel`。
- accounts：`workspace-account-table`、`workspace-account-query-mobile`、
  `workspace-account-query-login-name`、`workspace-account-query-status`、
  `workspace-account-query-organization-type`、`workspace-account-query-organization`、
  `workspace-account-query-role`、`workspace-account-query-submit`、
  `workspace-account-query-reset`、`workspace-account-detail-${id}`、
  `workspace-account-detail-drawer`、`workspace-account-transition-status`、
  `workspace-account-action-confirm`、`workspace-account-action-cancel`。
- platform invitation：`platform-invitation-table`、`platform-invitation-detail-${id}`、
  `platform-invitation-entry-${id}`、`platform-invitation-create-open`、
  `platform-invitation-create-submit`、`platform-invitation-mobile`、
  `platform-invitation-target-type`、`platform-invitation-target`、`platform-invitation-roles`、
  `platform-invitation-query-organization-type`、`platform-invitation-query-organization`、
  `platform-invitation-query-role`、`platform-invitation-query-status`、
  `platform-invitation-query-submit`、`platform-invitation-query-reset`。
- operations invitation：`operations-workspace-invitation-table`、
  `operations-workspace-invitation-open-detail`、`operations-workspace-invitation-entry-${id}`、
  `operations-workspace-invitation-create-open`、`operations-workspace-invitation-detail-drawer`、
  `operations-workspace-invitation-link`、`operations-workspace-invitation-copy-link`、
  `operations-workspace-invitation-query-organization`、
  `operations-workspace-invitation-query-role`、`operations-workspace-invitation-query-status`、
  `operations-workspace-invitation-query-submit`、`operations-workspace-invitation-query-reset`。
- public：`public-invitation-accept`、`public-invitation-mobile`、
  `public-invitation-send-otp`、`public-invitation-otp`、`public-invitation-verify`、
  `public-invitation-user-name`、`public-invitation-login-name`、
  `public-invitation-password`、`public-invitation-save`、`public-invitation-complete`、
  `public-invitation-terminal-login`；新增 `public-invitation-account-not-bindable`。

### D.4 organization / catalog

- organization：`operations-organization-status`、`operations-organization-status-modal`、
  `operations-organization-status-confirm`、`operations-business-entity-detail-drawer`、
  `operations-business-entity-detail-edit`、`operations-business-entity-detail-status`、
  `operations-business-entity-status-modal`、`operations-business-entity-status-confirm`、
  `operations-business-entity-filter-status-${kind}`、`operations-store-page`、
  `operations-store-table`、`operations-store-open-detail-${id}`、
  `operations-store-filter-status`、`operations-store-detail-drawer`、
  `operations-store-detail-edit`、`operations-store-detail-status`、
  `operations-store-status-modal`、`operations-store-status-confirm`。
- catalog authoritative file：`apps/frontend/operations-admin/src/features/catalog-management/catalogTestIds.ts`。
  保留 `catalog-item-status-enable/disable`，退役 `catalog-item-status-archive`，新增
  `catalog-item-status-void`；保留 `catalog-category-task-modal/impact/submit`；保留
  `catalog-config-drawer/library-${hex(libraryKey)}/definition-editor/save`，退役
  `catalog-config-delete`，新增 `catalog-config-transition-status`；保留
  `catalog-dictionary-status-change-modal/row-${hex(libraryKey)}-${hex(code)}/
  action-${hex(libraryKey)}-${hex(code)}-${hex(action)}`、
  `catalog-attribute-definition-list`、`catalog-order-option-definition-list`、
  `catalog-governance-result`、`catalog-sku-rows`。

## 附录 E · 前端闭集字典与 checked-in catalog 成员

### E.1 enum dictionary members

- access：`INTERNAL=内部接入`、`EXTERNAL=外部接入`。
- operator/owner node：`PROJECT=项目`、`STORE=门店`。
- order：`DINE_IN=到店点餐`、`TAKEAWAY=外卖`、`GROUP_BUY=团购`。
- dine-in form：`POS=POS`、`QR=扫码`、`KIOSK=自助机`；null/empty 使用明确“未配置”，不映射“未知”。
- lifecycle：`ENABLED=启用`、`DISABLED=停用`、`VOIDED=标记删除`。
- binding requirement：`NOT_REQUIRED=无需绑定`、`UNBOUND=未绑定`、`BOUND=已绑定`。
- authentication：`EXTERNAL_GRANT=需要外部平台授权`、`INTERNAL_MAPPING=内部主体映射`、
  `NO_MAPPING=无需主体映射`。
- unbind：`LOCAL_ONLY=本地解除绑定`、`REQUIRES_ADAPTER_UNBIND=需外部平台解除授权`。
- catalog status：`PLANNED=计划中`、`AVAILABLE=可用`。
- capability class：`MASTER_DATA_SYNC=主数据同步`、`MEMBER_BENEFIT=用户与权益`、
  `GROUP_BUY=团购`、`TAKEAWAY=外卖`、`INVENTORY_SYNC=库存`、
  `TAKEAWAY_DELIVERY=外卖配送`、`ORDER_SYNC=订单同步`。
- collaboration binding：`PENDING_AUTHORIZATION=待授权`、`EFFECTIVE=有效`、`INVALID=无效`、
  `DELETED=已删除`。
- organization node type：`COMMERCIAL_GROUP=集团`、`REGION=大区`、`PROJECT=项目`、
  `HEAD_COMPANY=总公司`、`STORE=门店`。
- provider business scope：`TAKEAWAY=外卖`、`GROUP_BUY=团购`、`ORDER_SYNC=订单同步`、
  `MEMBER_BENEFIT=用户与权益`。
- capability attribute value：`GROUP_BUY_MAPPING_DIRECTION.EXTERNAL_TO_INTERNAL=外部映射到内部`、
  `GROUP_BUY_MAPPING_DIRECTION.INTERNAL_TO_EXTERNAL=内部映射到外部`、
  `MENU_COLLABORATION_DIRECTION.PULL_ONLY=仅拉取外部菜单`。
- attribute definition presentation：`groupBuyMappingDirection` 的 label/help/control/source 为
  “团购商品映射方向”/“团购商品由外部映射到内部，还是由内部映射到外部”/
  `readonlySummary`/`GROUP_BUY_MAPPING_DIRECTION`；`menuCollaborationDirection` 为
  “菜单协作方向”/“只拉取外部菜单，还是支持将本地菜单推送到外部平台”/
  `readonlySummary`/`MENU_COLLABORATION_DIRECTION`。这些是前端静态 presentation metadata，
  不继续由后端 catalog 逐项下发。

所有字典以 source contract enum exact set 为输入；此中文是当前 accepted business language，合并时若
语料正本不同，以语料正本替换标签，不得遗漏成员或显示 raw code。

### E.2 checked-in collaboration catalog 的 46 个翻译位置

Source：`contracts/collaboration/external-platform-catalog.json`；schema：同目录
`external-platform-catalog.schema.json`。

- `/externalSystems/{0,1,2,3}/catalogStatusDisplayName`：4。
- `/externalSystems/0/capabilities/{0,1,2}/attributeValueLabels`：3。
- `/externalSystems/1/capabilities/{0,1}/attributeValueLabels`：2。
- `/externalSystems/2/capabilities/0/attributeValueLabels`：1。
- `/externalSystems/3/capabilities/0/attributeValueLabels`：1。
- `/providerProfiles/{0..6}` 每项五个：`businessScopeDisplayNames`、
  `bindableNodeTypeDisplayNames`、`authenticationKindDisplayName`、`unbindKindDisplayName`、
  `catalogStatusDisplayName`：35。

Provider 顺序：`MEITUAN_ISV_A`、`MEITUAN_ISV_B`、`ELEME_OPEN`、
`SHOPPING_MALL_ERP_DEFAULT`、`MEMBERSHIP_COUPON_GROUP`、`MEMBERSHIP_COUPON_PROJECT`、
`MEMBERSHIP_COUPON_STORE`。

Runtime consumers：`CheckedInCollaborationCatalogSource`、`CollaborationCatalogSource`、
`CollaborationOwnerService`、`CollaborationReadback`、`ExternalCollaborationWireMapper`。
删除翻译后 schema、source、owner readback、mapper、generated contract、前端 consumer、focused tests、
seed 必须同一 CP 同步。

### E.3 超出“12 个字段”但由同一判据必然覆盖的成员

需求的 12 个字段是逐记录 `DisplayName` 身份，不是全部翻译 payload。独立源码盘点还命中
`businessScopeDisplayNames`、`bindableNodeTypeDisplayNames`、`attributeValueLabels`，以及
`attributeDictionary` 内 `label/helpText/controlKind/optionSourceRef`。它们同样由 checked-in code
闭集决定、不是业务自定义实体，若只删 12 个字段，后端仍在逐记录返回展示决定，原则未闭环。
因此本稿把这四类纳入 CP-B4/F1/F3；这是有源码反例的范围补全，不新增 operation。若合并稿决定
不纳入，必须明确把它们登记为后续批而不能声称 static-catalog 退役完成。

## 附录 F · 状态维度分母与四类适用矩阵

### F.1 十二条真实维度关系

| 对象 | 独立维度来源 | 关系 | readback 要求 |
|---|---|---|---|
| `catalog.catalog_sku` | `catalog.catalog_item` | FK | SKU self status + item `{ref,type=ITEM,status}` |
| `catalog.catalog_composite_component` | `catalog.catalog_item` | FK | component self status + item dimension |
| `catalog.catalog_composite_component` | `catalog.catalog_sku` | FK | component self status + SKU dimension |
| `catalog.catalog_category` | ancestor categories | `parent_category_ref` self tree | self + every ancestor `{ref,type=CATEGORY,status}` |
| `organization.organization_node` | ancestor organization nodes | `parent_id` self tree | self + every region/project ancestor dimension |
| `organization.store` | project organization node | FK | store self + project dimension |
| `organization.store` | tenant | FK | store self + tenant dimension |
| `organization.store` | brand | FK | store self + brand dimension |
| `business_channel.business_channel` | template | non-FK `template_ref` | channel self + template dimension |
| `business_channel.business_channel_template` | owning project | non-FK `project_ref` | template self + project dimension；project 的祖先继续展开 |
| `business_channel.business_channel` | target project/store | non-FK `target_node_type/target_node_ref` | channel self + target dimension；target=STORE 时继续 project/tenant/brand |
| `business_channel.business_channel` | external system；provider profile | cross-owner coordinator lookup | channel self + system/profile dimensions；不写 cascade state |

`organization.store.head_company_id` 明确不构成门店阻断维度；创建门店时品牌授权准入仍保留。总公司
自身 IAM 访问链仍返回总公司状态。Collaboration binding status 必须作为渠道独立维度返回，但它在
哪些场景阻断仍是 Dexter 未决项。

### F.2 workspace status 的十二类直属对象

`platform_workspace.group_workspace.status` 必须作为下列每类对象的独立 dimension 返回：

1. `organization.organization_node`
2. `organization.brand`
3. `organization.tenant`
4. `organization.head_company`
5. `organization.store`
6. `workspace_iam.workspace_account`
7. `workspace_iam.workspace_role`
8. `business_channel.business_channel`
9. `business_channel.business_channel_template`
10. `collaboration.external_system_enablement`
11. `collaboration.owner_binding`
12. `collaboration.provider_profile_enablement`

取事实应由一个既有 workspace owner lookup/read mechanism 统一提供；各域不得各写一条 SQL 直接读
`platform_workspace`。实施前若仓内不存在符合 owner 边界的统一 lookup，触发 §13 停机并设计最小
公开 read API，不得跨 schema 常态 join。

`extension.extension_definition_field` 是已 DROP 历史表；现存 `extension_definition` 无 lifecycle，
按 §0.2 排除，不进入 owner lookup 分母。

剔除：`platform_otp_grant`、`platform_password_recovery_flow`、`platform_session`、
`platform_command_receipt`、inventory `stock_target/stock_bom definition_status`。

### F.3 四类适用矩阵（逐字业务含义）

| 场景 | 组合方式 | owner/consumer 分工 |
|---|---|---|
| 候选查询、新增引用、真实业务准入、下游消费 | 要求该场景全部相关维度可用 | owner 返回事实；场景 policy 在首写/消费前判断；candidate owner 在 query 过滤 |
| 管理列表与详情 | 返回 self 与全部 `{ref,type,status}` | UI 显示 self，并逐项说明 blocker；不合并单值 |
| 管理编辑、重新启用、未改引用保存 | 只看 self；新增或改变引用的那一项另走新引用规则 | self owner 终态保护；changed-ref branch 才查 target |
| 历史、审计、快照、幂等回执 | 不受任何当前维度影响 | 不加 lifecycle filter，不修改冻结快照，不丢 replay |

### F.4 非 FK 同根扫描

实施 CP-B3 前逐 owner 搜索 `*_ref`/`*_code` 跨模块读取、coordinator lookup、readback assembler 和
状态条件；命中新的“两侧有 lifecycle 且场景可用性参考对方”的关系，先补 F.1/F.2 和 §9a，再
实施。附件不是穷尽免责条款；新增成员不允许等测试暴露。
