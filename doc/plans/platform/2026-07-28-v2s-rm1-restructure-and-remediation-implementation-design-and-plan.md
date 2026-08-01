---
title: RM1 restructure and remediation implementation-facing design and plan
status: PREPARED_FOR_INDEPENDENT_DESIGN_REVIEW
createdAt: 2026-07-28
programId: V2S_W0_W4_EXECUTION
designAuthority: doc/decisions/2026-07-28-v2s-rm1-implementation-facing-design-authorization.md
implementationAuthority: false
SKILL_USED: cs-writing-plans@72190a3937e8c95d2ae3d1ed1f4e519b82946b5b1d083fcdc8d9ccf7cce42b24
---

# RM1 重组与合规整改：实施详设与计划

## 1. 目标、边界与唯一执行模型

RM1 不扩张业务分母。它以问题清单的 57 个 `P-*` 条目、8 个 `ST-*` authority 条目和
R-22~R-30 的已裁决形状为输入，把已经存在的 R5 实现收敛到可验证的安全、owner、契约、
结构、前端与效率约束。唯一执行拓扑是：

```text
P0 → P3-A → P3-B → P3-C → P1 → P2 → P4 → P5 → P6 → P3-D → P7 → P8
```

上一包的 package-exit 真实 PASS（actual-file receipts 与 source 对账均闭合）才可开始下一包。
没有“并行铺开、末尾统一验门”的旁路；任何包内新增/修复门先在 scratchpad 真实变异验红，日常
入口只验证控制仍被引用且输出有效。

以下不在 RM1：MQ/outbox/TDP/内部 OpenAPI client、业务域增量、直接数据库 seed、旧已执行
migration 字节改写、R-26 标明的 18 个 legacy L2（仅以 P8 transfer artifact 结转 RM2）。

### 1.1 已完成实现盘点的使用方式

R5 已有 24 个 controller 的 `edge/<face>/<capability>` 归位、11 条 migration 和 JSONB 的
extension/role storage alignment。RM1 对它们逐条以当前字节为输入：保留符合本计划的结构，
若它们触及本计划的 owner/contract/security 项则新增式演进；不以历史 receipt 或“曾经 PASS”
替代本包的 actual-file 对账。

### 1.2 本计划的四个收敛点

1. **授权不是页面参数。** `x-consumer-faces` 派生 operation 面；每个写 operation 只有一个
   generated `CapabilityRequirement`，且 scope resolver 从 server 已读取的 target 事实派生，绝不
   从 `pageDesignKey`、前端常量、URL 文案或请求 body 推导。
2. **R-24 是单项命令。** 品牌授权没有整集合保存；POST/DELETE 各自是独立幂等命令，未知结果
   先 owner readback，再同 key 重放或显式停止。
3. **可见性不泄露。** 授权撤销 readback 不含 total count/`canRevoke`；领域 guard 对全部门店
   执行，Problem 只投影 actor 当前可见的 blocker，且不含隐藏数量提示。
4. **性能分母不是手写清单。** P4 先生成 canonical call-path ledger；任何预算、索引、批量 API、
   red mutation 都引用 ledger entry id，未枚举条目不能被“原 N 处”吞掉。

### 1.3 P3 post-change 写操作的唯一分母

P3-A 建立 `mutating-operation-inventory.json` 的 generator；它从 `contracts/openapi/**` 的 HTTP method、
`x-consumer-faces` 和 `x-required-capability` 动态派生**当前** mutating operations，键为
`{operationId,method,path,consumerFace}`。P3-A 的 exit 冻结 pre-P3-B snapshot；P3-B 在退役 PUT、
新增 POST/DELETE 后冻结 post-P3-B snapshot，并输出 exact `added/retired/unchanged` set diff。

- P3-A 唯一拥有 generator、CapabilityRequirement compiler、scope resolver 和 pre-snapshot 每项
  requirement/resolver/owner-recheck template。
- P3-B 唯一拥有 R-24 的 three-entry delta；每个 added operation 必须在 post snapshot 显式绑定
  P3-A template 的 requirement id、first-scope resolver、owner command 和 red fixture。P3-B 不使用任何
  固定写端点计数。
- P3-B exit 重跑 P3-A generator 对 post snapshot 的完整 A1/A2；任何 added/retired/unclassified entry、
  缺 requirement、缺 resolver、缺 owner recheck 或有第二 capability binding 都具名红。

因此本计划不使用“20”或其他手写计数作为完成判据；计数只是 snapshot 的可复算输出。

## 2. 共同控制链与六类 package-exit 对账

每包产出 `doc/evidence/platform/rm1/<package>/package-exit.json`，并由既有 compliance-control
验证下列六类 source 分母；每项含 `sourcePath`、selector/anchor、applicability、`missingEntryFails=true`。

| ID | source 分母 | owning source | 共同判定 |
| --- | --- | --- | --- |
| D1 | PROJECT_MEMORY_ASSERTION_OCCURRENCES | `project-memory` 路由命中原文 | 每个命中 assertion 逐项 `APPLICABLE` 或有具体反例的 N/A |
| D2 | APPROVED_ASSERTIONS | 本计划 §4 的 issueId 行 | 每个本包 issueId 的 exit assertion 均闭合 |
| D3 | FORBIDDEN_PSEUDO_FIXES | 本计划 §5 禁止项 + candidate Roadmap | 禁止项扫描为零或明确非生产反例 |
| D4 | DETAIL_DESIGN_COMPLETION_AND_INCREMENTAL_CRITERIA | 本计划 §3 单元 + §6 包 exit | actual changed-files 与 incremental receipt 非空集合精确相等 |
| D5 | OWNED_SURFACE_AND_PAGE_KEYS | R5 carry-over manifest、已接受 Journey/interaction | UI 单元逐 surface/pageKey 处置；非 UI 单元显式 N/A |
| D6 | DUE_STANDARDS_RULE_IDS | `contracts/policy/standards-coverage-matrix.json` | phase 的每个 due rule 指向 gate/checklist/evidence；未知 phase 必须红 |

`PENDING` 不是合法状态。hook 不读取 prompt 正文、不注入上下文；它只是实际文件集记录和
disposition 的机械闸口，不替代 D1/D2 的语义审查。包 exit 之前先对全部 actual changed-files 做
full compliance scan；测试只能在静态对账 PASS 后开始。

## 3. 串行 delivery units

### RM1-P0｜控制先行与状态诚实

**输入/范围：** P-C1、P-C2、P-C3-PRE、P-C5、P-X2、P-X5、P-X6、ST-7；控制源码、hook、
matrix/registry 收敛，不改业务 contract/runtime。当前 Roadmap 状态 owner 只登记矛盾，不代写
Dexter 的 `CURRENT_*`。

**实施顺序：** (1) 让 hook invocation canary、actual receipt 集合与 full scan fail-closed；
(2) 修 self-test 自我豁免、被引用 gate `exit 0`、硬编码 secret/分母/object-key、伪门；
(3) 建立 P3-A 的 capability invariant checker skeleton 和 P4 canonical-ledger scanner，但不
把后续业务结果伪称绿；(4) 以动态派生重扫 current tree，而非“15 条”静态数字。

**红证据：** 删除 PostToolUse invocation、清空 incrementalChecks、替换被引用 gate 为 exit 0、
注入非 dev object key、删除 registry phase、从 D1 `owningSourceSet[]` 删除一个按 frontmatter
应命中的 memory source、以及把 `create` 标到一个已存在的具体路径，分别须以精确原因红。

**exit：** P0 所有控制为 `ACTIVE_RED_VERIFIED`；D1 的 expected set 由 `project-memory/index.json`
中每份 active memory 的六维 frontmatter 逐 unit 动态派生，并与 `owningSourceSet[]` 做 exact
path+hash+selector equality；`create` 只允许当前不存在的具体路径，已存在路径只能为 `update` /
`retain` / `delete`。ST-7 receipt 独立关闭；P3/P4 控制仅证明能验红，不声称业务条目已完成。

### RM1-P3-A｜三层 scope 与 generated capability requirement

**输入/范围：** P-D0、P-D0b、P-D0c、P-D2、P-D6、P-N1、P-R7、P-X4。所有 contracts 先于
consumer；owner command 仍保有第三层不变量。建立 `contracts/registry/iam-org-governance-manifest.json`
作为**新增权威 contract source**，不得称它为现存来源。

**精确形状：**

- operation `x-required-capability` 是一个 `CapabilityRequirement`（一个 requirement id）；codegen
  生成 server catalog、operations catalog 和 typed resolver registry。`ORG_NODE_EDIT` 由 server
  读取 node type 后映射既有 REGION/PROJECT edit capability；client 不提交 target type 来选权限。
- resolver 输入为 authenticated workspace session、server-resolved resource type/id、assignment node；
  输出为 `ALLOW|DENY` 和第一层 owner query predicate。拒绝“先查全量、后过滤”、“pageKey 推导
  capability/目标”、“scope 仅用于显示”。
- platform admin OTP 手机号、token receipt、Problem mapping、session invalidation 只经 IAM owner
  public API 和 typed Problem 演进；响应永不含 `testCode`。

**测试：** 每个写 operation 缺/多 requirement、伪造 pageKey、scope 外 target、owner 内二次拒绝、
未映射 exception、OTP 响应重现 testCode 均有 focused negative fixture；外层协调器 `REQUIRED`，
跨 owner 写只走 public command API。

**exit：** A1/A2、scope resolver coverage、P-D0b/D2/D6/N1/R7/X4 的 source assertions 全闭合；
P3-B 依赖其 generated source，而不是复制 capability 字符串。

### RM1-P3-B｜写端点、R-24 单项授权、receipt 与 FK

**输入/范围：** P-D1、P-D3、P-D4、P-D5、P-B1、P-B2、商业集团初始化 replay、R-24 backend。
先 contract，再 owner command/readback，再 additive migration，再 edge/controller/test；已执行 migration
绝不改写。

**R-24 exact design：**

- retire replace PUT；新增 POST/DELETE，一个 `BC-ORG-HEAD-COMPANY-BRAND` requirement。
- P3-B **先**将 receipt unique identity 演进为 `(workspace_uuid,idempotency_key)`，同一 key/hash
  重放固定 `204 acknowledgement`；重复 POST 不产生第二行，DELETE 不存在 `404`，不重组当前集合。
- owner 在同一 `REQUIRED` command 内做单行 add/remove、owner-local audit、receipt；审计动作为
  `..._ADDED`/`..._REMOVED`，不再 `..._REPLACED`。
- 加 `store(head_company_id,brand_id)` → authorization 的 additive composite FK；前置对账若非零
  必须 typed stop 并列出行，不能清洗。`MATCH SIMPLE` 保留 null head-company 语义。
- 隐藏引用不下发：readback 仅有 `authorizedAtEpochMillis`；撤销 Problem 允许最多 20 个当前 actor
  可见 `{id,code,name}`，无 total、`hasAdditional`、`referencingStoreCount`、`canRevoke`。无可见
  blocker 时是同一 generic typed conflict，UI 不预禁用。

**receipt/FK linearization protocol（每个 P3-B command 一致）：**

1. 在 `REQUIRED` 内以 `(workspace_uuid,idempotency_key)` 获取 receipt；命中时先比较 immutable
   request hash：相同 hash 直接回放持久化 acknowledgement，不同 hash 返回 typed idempotency conflict。
2. 未命中时先尝试插入 `IN_PROGRESS` receipt（唯一约束是线性化点）；duplicate-key race 后重新读取：
   相同 hash 等待/读取同一 receipt 的 terminal acknowledgement，不同 hash typed conflict。不得用
   `SELECT ... FOR UPDATE` 锁一个不存在的行来伪装此协议。
3. 成为唯一 creator 的事务执行 owner invariant、单行 command、audit、terminal receipt；任何 domain
   failure 把 receipt 写为确定的 typed failure，未知 transport 只允许同 key 查询/replay。
4. 并发 store create 与 authorization remove 的竞争由同一 owner command 的 reference check + composite
   FK 双层防护处理：FK/unique 原始异常必须在 transaction boundary 转成闭集 typed conflict，payload 仍只
   投影当前 actor 可见 blockers；不得泄露 constraint/hidden store 信息。

必须在真实并发 fixture 上验红：同 key 同 hash 两请求只产生一个 terminal receipt；同 key 异 hash 红；
store-create/remove interleaving 不返回 raw SQL、不会产生悬挂引用，且隐藏引用不改变 payload 形状。

**exit：** A3；post-P3-B mutating-operation snapshot 的 exact set 中每项都有 requirement、first scope、
owner invariant 与红夹具绑定；P-D1/D3/D4/D5/B1/B2
及 replay audit；R-24 POST/DELETE contract/backend/migration/test 全闭合。P3-D 只能消费 adapter。

### RM1-P3-C｜context/access endpoint 去 pageKey 推导

**输入/范围：** P-D0c 的 5 个 `PG-IAM-*` endpoint。它不再承担 P-X1/P-D3 migration。

**实施顺序：** server 从 role assignment 得到 resource type/id，再经 P3-A resolver 将 assignment
node 限制注入 owner query；workspace-iam 通过公开 task API 获得组织路径，不直读 organization schema；
删除 request `pageDesignKey` 和所有 fallback。测试覆盖 group/region/project/head-company/store 与
scope 外 node；每条均证明不是仅 type 匹配而遗漏 service-node 祖先范围。

**exit：** 五个 endpoint 无 pageKey；每个都有 public task API trace、target+ancestor predicate、
scope-out negative test；P3-A/B 的实际 changed-file receipts 不漂移。

### RM1-P1｜authority source ledger

**输入/范围：** ST-2/3/4/6/8/9/11 的唯一 authority source 与每个消费者机械追溯。
P1 只关 ST-3/4/8；ST-9 实作 P5，ST-2/6/11 实作 P6。禁用“出现次数=1”。

**exit：** ledger exact seven-ID set，含 authority path、consumer paths、generator relation；P1 不
把尚未改变的 P5/P6 consumers 伪称关闭。

### RM1-P2｜单部署结构与 User rename

**输入/范围：** P-A1、P-Q6、P-C3-POST、R-23。第一动作是产出 rename denominator freeze artifact：
搜索根、大小写变体、generated/active docs、排除集合 E、当时 hashes；在它存在前不得写任何
“共 N 处”。随后能力归位到单 deployable 的 module/edge structure，`Membership`→`User` 纯重命名
例外可改方法/record/service 名但不得改变行为。

**exit：** eight-form set equality 在 `repo \ E` 为零；active docs/contract policy 不可排除；
`affected-l2` 以新布局重跑，P-C3-PRE 与 POST 是不同 receipt，不能合并；并同时满足正分母
assertion（逐 module source-file count 与合计均非零、冻结为 rename receipt 的可复算输出）、8 个
Flyway integration-test location 相对前缀对新目录深度的精确对账、`walk()/walkFiles()` 输入根不存在
必须具名 FAIL、以及 `budget()` 扫描根扩宽/缩窄的红变异。禁止以空遍历绿灯证明跨 owner read 强制仍在生效。

### RM1-P4｜性能的 canonical ledger 与 batch public API

**输入/范围：** P-E1/2/3/5/6/7/8/9、P-R8。分六个串行子单元：

1. P4-A 生成 N+1 ledger：每项有 call-path、owner、test class、fixture bound、budget、red mutation；
   以扫描结果 exact set，禁止“原 6 处”。
2. P4-B 由 organization owner 提供 batch public read API，替换五处 workspace callers；禁止跨 schema
   direct read。
3. P4-C 用一条 additive migration 建 7 个精确索引，逐索引绑定 query/explain assertion。
4. P4-D 角色 JSON 解析移回 Java、session request-scope cache。
5. P4-E foundation drawer lifecycle memo 化，三个 consumers regression。
6. P4-F 真分页、read-one、bundle、write-after-readback 的其余 ledger entries。

**P4-A scanner contract：** roots 固定为 `apps/**/src/main`、`libraries/**/src/main`、对应 test roots；
identity 是 `callerSymbol → queryBoundarySymbol → mechanism`，其中 query boundary 是 JDBC query/update、
repository public read、object-store I/O 或跨 owner task API。分类只有 callback/mapper、stream/loop、
extractor、unbounded full-read、repeated client refresh；排除集合仅限纯 ResultSet 字段读取、纯 JSON 解析和
已在 source 指定 `@BatchBounded` 的内部 helper，且每个排除必须有 path+reason+owner。scanner 输出的
ledger schema 固定 `{id,roots,identity,classification,owner,testClass,fixture,budget,disposition}`；P4-B–F
只能消费该 id。除删除 ledger 行之外，向 production root 注入一条可识别 query edge 也必须使 derived
set 变化并精确红，证明 scanner 不只是校验自己写出的列表。

**exit：** ledger exact current scan set；每项有 1/100 对照或明确 bounded fixture、预算和真实 red;
P-R8 的 ResultSetExtractor 内 query 为零。

### RM1-P5｜前端基础架构

**输入/范围：** P-E4、P-Q2/3/4/9、P-R1/2/3/4/5/6、ST-9。先 foundation，再两个 app thin consumer；
不得将 shared HTTP/context/overlay/observability 回复制 app。

**实施顺序：** generated endpoint 统一 RTK base、401 fan-out/reset/abort、request generation guard、
error boundary、page retention/retry、query context memo、eslint libraries + react-hooks，再替换 feature
调用。每一项由 generated catalog/route registry 而非手写 string 驱动。

**exit：** ST-9 ledger trace；所有 listed frontend finding 的 static architecture assertions 和 focused
tests；foundation import direction、page retry/401/error boundary 有 red fixture。

### RM1-P6｜UI carry-over、OTP 与 work context

**输入/范围：** P-Q1/5/7、P-U1/2/3/4/5、ST-2/6/11。以 22 surface/25 pageDesignKey current manifest
逐一 CARRY/ADAPT/NOT_CARRIED；对每个 UI-bearing change 复用已接受 v2 baseline。操作历史严格使用
已接受的 Master–Detail Modal，不新增列表操作列、不改 Drawer。

**前置产品工件：** P-U3（集团空间页写能力修正）、P-U4（work-context switcher）、平台 OTP 登录与
邀请 UI retirement 是行为/交互变更。实施前分别补 RM1 interaction amendment（目标、states、failure、
v2 difference），由 Dexter 一次看图接受；未接受的 unit 只能维持 `PREPARED_FOR_DECISION`，不得实现。

**exit：** A4/A5；OTP response 无 testCode 的 contract/codegen/controller 三重闭合；每 surface 有
manifest disposition；ST-2/6/11 的 authority trace；所有 new UI behavior 有 test contract，不把
R-26 legacy L2 defer 扩大到新行为。

### RM1-P3-D｜R-24 final UI

**输入/范围：** P3-B action adapter 的视觉绑定。新的 interaction amendment 先获 Dexter 线框接受：
列表展示授权时间；每次 add/remove 都是单项动作；无“保存整个集合”；确定失败只回滚该项，未知
结果按 P3-B readback/replay；撤销 conflict 显示可见 blockers 或 generic reason。P3-D 不改 contract、
owner、migration 或另写 adapter。

**exit：** zero PUT、zero bulk-save path、每 UI action 恰一条 command、readback 后更新；重跑 A1-A5
且 RM1-P3-D contract diff 为空。

### RM1-P7｜死代码、DEV/seed 形状

**输入/范围：** P-Q8、P-X7、P-X8 和已登记 seed executor/fixture obligations。删除只在 current-tree
枚举中仍存在且无 consumer 的 dead code；yaml 以 YAML parser 处理；DEV issuer 取代 production OTP
testCode；seed 仅在未来已获 DEV/seed 授权时执行，不在本设计或本包动态运行。

**exit：** named dead-code denominator exact；no production consumer；seed fixture contract 不再依赖
`PROPOSED_REVIEW_ONLY`；所有 DEV secrets/logs 脱敏。

### RM1-P8｜本轮 changed-path review 与 RM2 transfer artifact

**输入/范围：** P-C4、57 P-ID 逐行对账、P0 receipt + P1 seven-ST ledger + P2–P7 actual changed-path
union。P8 不补造 historical red proof。

**exit：** transfer manifest exact three IDs `HED-1-CR05-CR06-COMPILE-TEST-RECEIPT`、
`HED-2-ACTIVE-RED-VERIFIED-NO-MUTATION-ARTIFACT`、`HED-3-SURFACE-21-OF-22-ZERO-L2`，并有缺项、未知、
重复、wrong successor、字段失真四类 red；只能声明 artifact ready，不能称 RM2 已接收。

P7 与 P8 是两个独立 delivery unit：P7 exit PASS 后才派生 P8 的 changed-path union；P8 不能借用
P7 receipt、也不能提前把 transfer artifact 当 P7 的 cleanup。两者各有独立 six-denominator disposition。

## 4. 57 项七列执行表

表中 `red` 是 implementation 时的 scratchpad real mutation；`exit` 是该条在 owning package exit
必须写入的可机械断言。所有 path 均相对仓根，`+` 表示新增式文件而非已存在承诺。

| issueId | unit | owning paths | concrete action | red mutation | exit assertion | deferred reason |
| --- | --- | --- | --- | --- | --- |
| P-A1 | P2 | `apps/backend/**`, `libraries/backend/**`, module registry | 单 deployable 能力归位，保留 owner API | 把 edge 反向 import owner internals | only allowed edge→public API imports | — |
| P-B1 | P3-B | `workspace-access.paths.yaml`, invitation service/tests | enum/transition 与写入闭集对齐 | 写入非 enum status | typed rejection + closed enum | — |
| P-B2 | P3-B | store contract/controller/service/tests | 启停字段、command/readback 同源 | 前后端反向 status fixture | status transition E2E focused pass | — |
| P-C1 | P0 | frontend control CLI | 删除 self-test bypass | `--self-test` inject violation | exact violation reason | — |
| P-C2 | P0 | standards-coverage/check fixtures | 被引用 gate 真实执行 | replace referenced gate `exit 0` | dependency hash/exit checked | — |
| P-C3 | P0,P2 | affected-l2 registry/layout | PRE 动态对账；POST 重组后重跑 | remove an L2 mapping | PRE/POST each fail closed | — |
| P-C4 | P8 | `doc/evidence/platform/rm1/transfer-manifest.json` | three-ID transfer artifact | each of four invalid variants | exact canonical set | historical evidence only |
| P-C5 | P0 | page registry control | production pageRegistry reachability | remove registered route | registered surface unreachable | — |
| P-D0 | P3-A/B | OpenAPI paths, resolver, owner commands | requirement + first scope + owner invariant | scope-out write returns 2xx | post-P3-B inventory exact set: each entry has requirement/resolver/owner recheck/red fixture; added/retired/unchanged fully classify; unclassified=0 | — |
| P-D0b | P3-A | platform IAM schema/session/OTP | authenticated mobile shape | login without valid mobile | typed auth failure, no fallback | — |
| P-D0c | P3-C | workspace access paths/controllers/task APIs | delete pageKey authority chain | client pageKey changes result | target/scope server-derived | — |
| P-D1 | P3-B | invitation receipts/service | retain hashed/minimal token facts only | raw token readback | no raw token query/replay | — |
| P-D2 | P3-A | Problem schemas/advice/tests | map all typed exceptions | remove one mapping | named problem mapping failure | — |
| P-D3 | P3-B | extension/asset receipt schema/services | workspace-scoped receipt concurrency | two concurrent same-key writes | one canonical receipt/replay | — |
| P-D4 | P3-B | platform asset service/receipt/ref count | ref-safe rollback deletion | two references then rollback one | shared object persists | — |
| P-D5 | P3-B | asset upload service/client | release DB before object I/O + timeout | hold connection fixture | bounded/no held transaction | — |
| P-D6 | P3-A | auth/session/Problem controls | close remaining security six | each listed security mutation | named control catches | — |
| P-E1 | P4-C | migration/query tests | seven query-bound indexes | drop an index | explain/index assertion fails | — |
| P-E2 | P4-F | organization overview reads/tests | server pagination + batch paths | 100-row fixture query count | bounded SQL independent of N | — |
| P-E3 | P4-D | WorkspaceRole service/session | Java JSON parse + request cache | force DB JSON expansion | no per-request expansion | — |
| P-E4 | P5 | foundation lifecycle/consumer tests | stable memoized lifecycle | remove memo | drawer repeat-request test fails | — |
| P-E5 | P4-F | listed reads/frontend refresh | pagination/readback/bundle fixes | one per ledger row | each ledger row budgeted | — |
| P-E6 | P4-B | workspace user/member read + org API | batch 4 fixed reads | 100 members / 3 assignments | ≤ documented fixed query budget | — |
| P-E7 | P4-F | overview task read | detail-by-id, real page | page=100 fixture | no full-list materialization | — |
| P-E8 | P4-B | assignment candidates/invitations | shared batch path resolver | remove batch resolver | query budget red | — |
| P-E9 | P4-A | `tools/performance/**` + ledger | canonical current scan ledger | delete a current ledger row | set equality failure | — |
| P-N1 | P3-A | platform OTP paths/UI amendment | platform mobile OTP capability | OTP response testCode | schema/codegen/controller triple red | UI amendment required |
| P-Q1 | P6 | audit/password shared foundation | shared Modal/Drawer primitives | reintroduce face copy | foundation import rule red | — |
| P-Q2 | P5 | page refresh helpers/features | one refresh/readback policy | add direct load bypass | architecture test red | — |
| P-Q3 | P5 | contextScopedQueryArgs/consumers | non-identity scope projection | replace with identity call | consumer coverage red | — |
| P-Q4 | P5 | shell query context/store | memoized stable context | remove `useMemo` | duplicate request red | — |
| P-Q5 | P6 | all 22 feature roots | model + locators convention | delete locator | registry/locator assertion red | — |
| P-Q6 | P2 | `business-page/model.ts`, routing | move to routing/state owner | deep import old path | layout gate red | — |
| P-Q7 | P6 | all feature entrypoints | uniform barrel policy | deep import a closed feature | import boundary red | — |
| P-Q8 | P7 | duplicate expandPath/tsconfig | one utility/one config source | restore duplicate | exact duplicate scan red | — |
| P-Q9 | P5 | eslint config/libraries | lint foundation + hooks rule | remove plugin/ignore library | lint fixture red | — |
| P-R1 | P5 | RTK base/session store | 401 reset/fan-out/abort | simulated 401 | state cleared/navigation policy | — |
| P-R2 | P5 | platform page components | empty/error/loading distinct | error result fixture | no permanent spinner | — |
| P-R3 | P5 | `PlatformReadPage` | retain prior page on error | failed page transition | prior data/page retained | — |
| P-R4 | P5 | async state helpers | generation guard | late response fixture | stale response ignored | — |
| P-R5 | P5 | app roots | ErrorBoundary | child throws | fallback/recovery visible | — |
| P-R6 | P5 | logout/session clear | local clear despite remote failure | logout endpoint fail | local session cleared | — |
| P-R7 | P3-A | workspace user task read | account-id relation, not mobile | changed mobile fixture | historical link stable | — |
| P-R8 | P4-F | hierarchy extractors | no query inside extractor | reintroduce query | static/query test red | — |
| P-U1 | P6 | generated error catalog/transports | 106 typed message mapping | fixed Chinese fallback | code mapping assertion red | — |
| P-U2 | P6 | platform shell/context | selected workspace global source | local duplicate selection | one authority trace red | — |
| P-U3 | P6 | group workspace features/amendment | correct read/write roles | swap capability fixture | action visibility/403 red | interaction required |
| P-U4 | P6 | operations shell/amendment | work-context selection behavior | invalid depth/dirty switch | state table test red | interaction required |
| P-U5 | P6 | page manifest/features | remaining UI disposition | omit a surface row | 22/25 coverage red | — |
| P-X1 | P3-B | receipt migrations/services | workspace receipt identity before commands | key collision across workspace | scoped replay only | — |
| P-X2 | P0 | security config | no hard-coded secret | scan injected secret | precise security red | — |
| P-X3 | P5 | eslint config | hooks coverage | remove hooks plugin | lint red | — |
| P-X4 | P3-A | auth/session invalidation | deleted/disabled session behavior | revoked session request | 401/reset red | — |
| P-X5 | P0 | asset object-key policy | environment-derived allowed prefix | non-dev valid prefix | no dev hardcode | — |
| P-X6 | P0 | verify gates | remove regex pseudo-gates | mutation only docs | gate not false-pass | — |
| P-X7 | P7 | boundary gate parser | YAML parser | non-JSON YAML | valid parse/semantic check | — |
| P-X8 | P7 | edge verifier/callers | delete dead verifier or wire production use | no caller after chosen disposition | consumer exact set | — |

## 5. 禁止伪修复

- 不把 capability/scope 决定留给 pageKey、action string、URL 或前端 body；不把动态 resolver 简化成
  “有任意 capability 即通过”。
- 不用总数、`canRevoke`、`hasAdditional` 或不同错误码侧信道披露不可见门店；不为 UI 便利弱化
  owner 的全局引用不变量。
- 不以 static scan、self-test、历史 evidence 或 receipt 自报替代 actual changed-file set equality。
- 不用手写 M/S 编号、旧“原 6 处”或当前计数作性能分母。
- 不复制 foundation、手写 generated operation/capability string、手改 generated wire、把 UI multi-action
  循环伪装成单项授权。
- 不在 P3-D 改 contract/owner/adapter；不在 P8 补写历史 red proof；不在 P7 执行 DEV/seed。

## 6. 包级完成判定与执行计划

| package | predecessor | first action | static completion | test/evidence completion | stop condition |
| --- | --- | --- | --- | --- | --- |
| P0 | — | dynamic current-tree control inventory | controls ACTIVE_RED_VERIFIED | all listed mutations exact red | any unverified hook invocation |
| P3-A | P0 | contract requirement/resolver source | A1/A2 and scope map exact | focused security negatives | unresolved target-to-scope mapping |
| P3-B | P3-A | receipt identity contract/migration precondition | A3 and owner public traces | replay/FK/asset/security tests | migration precondition nonzero |
| P3-C | P3-B | remove pageKey request shape | all five target predicates | scope hierarchy negatives | no public task API |
| P1 | P3-C | seven-ID ledger | authority/consumer exact sets | ledger parser red variants | any consumer lacks trace |
| P2 | P1 | rename denominator freeze artifact | eight-form rename/layout exact | compile/static boundary evidence | dynamic denominator drift |
| P4 | P2 | canonical N+1 ledger | ledger and all subunit contracts | bounded fixture/query tests | an unowned current call path |
| P5 | P4 | foundation base rules | authority traces + architecture scan | UI focused tests | shared behavior reimplemented app-side |
| P6 | P5 | UI amendments accepted + 22/25 map | A4/A5 + ST trace | per behavior tests | required Dexter interaction absent |
| P3-D | P6 | bind P3-B adapter | no contract diff, UI assertions | one-command/recovery tests | any bulk-save path |
| P7 | P3-D | dynamic dead-code inventory | exact consumers/fixture sources | static fixture evidence | DEV/seed action requested without authority |
| P8 | P7 | actual changed-path union | 57+ST/receipt exact mapping | all reviews/checklists evidence | any item PENDING or historical claim |

## 7. UI decision queue and review boundary

Existing accepted R5 carry-over UI and accepted operation-history Modal are sufficient inputs. Before P6/P3-D
implementation, however, this plan requires a **single RM1 UI amendment bundle** for: platform OTP login,
invitation retirement/replacement, group-workspace page action correction, operations work-context switcher, and
R-24 single-action authorization list. Each amendment must state v2 baseline, state table, typed errors, owner
readback, foundation primitive, and low-fi wireframe. Dexter reviews those wires together; no new UX is inferred
from current code. This is a design prerequisite, not an implementation authorization.

### 7.1 Amendment IDs and re-freeze rule

P6/P3-D are explicitly `BLOCKED_FOR_INTERACTION_ACCEPTANCE`, not implementation-ready, until all applicable
artifacts exist and Dexter accepts their low-fi wires:

| amendment ID | required artifact | covers | affected unit |
| --- | --- | --- | --- |
| `RM1-IA-01` | `doc/decisions/2026-07-28-v2s-rm1-platform-otp-and-invitation-interaction-amendment.md` | platform OTP and invitation replacement/retirement | RM1-P6 |
| `RM1-IA-02` | `doc/decisions/2026-07-28-v2s-rm1-operations-context-and-workspace-interaction-amendment.md` | group-workspace actions and work-context switcher | RM1-P6 |
| `RM1-IA-03` | `doc/decisions/2026-07-28-v2s-rm1-brand-authorization-interaction-amendment.md` | one-item add/remove list, recovery and blocker display | RM1-P3-D |

Each artifact must bind task, state table, generated operation, owner readback, typed failures, v2 difference,
foundation primitive and a unique low-fi screen anchor. Upon Dexter acceptance, the affected design section and
manifest unit must be re-frozen with artifact path+hash+unique anchor. The amendment establishes a **narrow new
review cycle** only for that artifact and the explicitly bound P6/P3-D subsection; it cannot change any other
unit, remove or relabel a pre-existing open finding, or re-freeze any old design bytes. Every still-open finding
from this cycle is an exact input subset of the amendment cycle. No UI implementation is allowed merely because
this plan names an amendment ID.

## 8. Review protocol

This design is `REVIEW_TARGET=DESIGN`, cycle `RM1-WHOLE-SCOPE-DESIGN-2026-07-28`. A fresh independent subagent
first receives `doc/review/platform/2026-07-28-v2s-rm1-design-input-checklist.json`, attempts falsification,
and writes round 1. The author may only intake after that verdict. At most a round 2 final verification follows;
then Claude receives Part B/C/D chapter maps and the Chinese handoff. No implementation begins from this document.

### 8.1 D1/D5 owning-source set contract

P0 extends the existing granularity checker; it does not create a new gate category. Every delivery-unit
source-compliance entry must carry `owningSourceSet[]` alongside its legacy binding, and P0 requires exact
path+hash+selector equality rather than accepting one non-empty summary path. For D1, the expected set is
derived from every active `project-memory/index.json` entry whose six-dimensional frontmatter route matches
the unit's declared route; an `all` member is a match, not an optional convenience. A missing member, an
extra unrelated member, a hash/selector drift, or an unresolvable route is a named failure.

- D1 is every routed `project-memory` hit reopened for the unit; the incremental-hook memory is one member,
  never the full denominator.
- D5 is explicit N/A plus term source for a non-UI unit. For a UI unit it is the carry-over manifest plus every
  accepted Journey/interaction source governing that surface; U09/U10 remain blocked until their IA artifact is
  accepted and hash-bound.

Red mutations remove a routed-memory member, substitute an unrelated path, omit one governing interaction,
declare a UI unit N/A, or declare `create` for an existing concrete path. Each must fail with the unit and
denominator name. Until P0 activates this extension, no package may claim source-compliance exit PASS.
