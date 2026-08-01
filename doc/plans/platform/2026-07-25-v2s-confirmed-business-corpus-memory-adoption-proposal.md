---
title: 已确认业务语料的项目记忆纳入方案（待审）
status: ACCEPTED_BY_DEXTER_2026-07-25
createdAt: 2026-07-25
programId: V2S_W0_W4_EXECUTION
roadmapContext: R3_SPECIALIZED_DESIGN
implementationAuthority: false
projectMemoryMutation: authorized_for_unit_a_and_b_only
---

# 已确认业务语料的项目记忆纳入方案（待审）

## 1. 本次要解决的业务任务

未来设计、contract、UI 和实施人员必须先知道同一业务事实叫什么、不是什
么、不能从什么推导出什么，才能避免把技术名或旧实现臆想成用户任务。当前已
经由 grill 确认了 G-01 至 G-12；Dexter 的要求是先把这批可复用结论安全沉淀，
把未覆盖的领域作为一个可恢复的旁支，而不是为了“语料完整”继续追问。

Dexter 已于 2026-07-25 接受本方案的其余内容，并授权仅执行 Unit A/B；未来何时恢复
grill 完全由 Dexter 按进展决定，不设自动触发或排期。该接受不接受剩余领域的产品语
义，不重开 R3-J01，也不授权 R3/W1、contract、数据库、代码、DEV/seed/reset、动态
运行或 Git。

## 2. 输入、范围与权威序

### 2.1 冻结输入

| 输入 | SHA-256 / 状态 | 用途 |
| --- | --- | --- |
| `doc/review/platform/2026-07-24-v2s-cross-generation-business-corpus-draft.md` | `4422ed54b3c693b6f44031ad0a17660a39ce86a4f7387abdd072ef0f8068bbb0` / 待审 | G-01–G-12、出处、显式修订、待裁决项的唯一候选来源 |
| `doc/review/platform/2026-07-25-v2s-confirmed-business-corpus-record.md` | `4546c82a0f023779b93761c120b7fcafb7f3f04c1da274059d4fb485ba16bd94` / 待审 | 仅 G-01–G-12 的可读提升候选；不含 08–22 未确认内容 |
| `doc/review/platform/2026-07-24-v2s-cross-generation-business-corpus-review-claude.md` | 已交付 | Claude S-1/N-3 等的独立审阅与修订依据 |
| `doc/review/platform/2026-07-24-v2s-business-glossary-independent-draft-claude.md` | 草稿 | Claude 未受 Codex 草稿锚定的交叉基准 |

### 2.2 权威与解释纪律

接受后的业务语言权威次序固定为：Dexter 明示 grill 裁决/接受的 corpus 条目
> all-v2 现行裁决和模块规范 > V6 正式领域文档 > v4/v1 历史交叉印证。历史材料
只能解释改名或否决，绝不回填为 v2s 当前真相。跨层冲突、未定义生命周期和没有
来源的业务动作一律保持 `待裁决` / `UNVERIFIED`，由 Dexter 决定；agent 不选边。

“已共识”只表示本批业务语言被 Dexter 确认可作为当前语料；它不是实现授权，
也不会把技术映射、schema、OpenAPI 字段、页面、权限、动态状态影响或历史文档
改写一并接受。

## 3. 方案比较与推荐

| 方案 | 好处 | 风险 | 结论 |
| --- | --- | --- | --- |
| A. 只保留 review 草稿 | 零额外维护 | 后续 agent 不会由 memory route 找到，容易重新造词 | 不选 |
| B. 整份跨代草稿原样复制进 project-memory | 一次性“全” | 把 Source ledger、历史漂移、未确认 08–22 域和临时审阅材料误升为 current truth，记忆膨胀 | 不选 |
| C. 以一份精简 canonical corpus 为 anchor，原草稿保留出处，另设 parked intake | 已确认语义可被确定性路由；未决项不伪装为答案；未来按域恢复 | 首次需维护三份小文档及 inventory route | **推荐** |

推荐 C 的成本小于重复发生的“workspace/业务事实混同”返工：canonical 文档只含
接受条目、禁推、状态和精确出处；详尽跨代证据仍留 review 草稿，不制造第二份
全域史料。不会为语义创建关键词 checker——语义判断继续由 fresh review 与 Claude
承担，符合验证治理。

## 4. 接受后才执行的文件落点

| 目标文件（均为未来动作） | 内容与边界 | route / owner |
| --- | --- | --- |
| `project-memory/decisions/confirmed-business-language-corpus.md` | G-01–G-12 的 canonical 业务词条；每条保留 `TERM_ID`、主叫法、定义、边界、禁推、状态、Dexter 日期、source refs、历史映射和未决项。文件头附人工自查用的命中词干索引（主叫法、英文名、历史别名、禁用词），不得复制未确认 08–22 域。 | `design/implementation/review/testing`；`platform/contract/admin-ui`；owner `product` |
| `project-memory/operations/business-corpus-adoption-and-read-policy.md` | 本方案第 5–7 节的读取、引用、冲突、更新与审查纪律；明确它不授权实现。 | `design/implementation/review`；`platform/contract/admin-ui`；owner `product` |
| `project-memory/operations/business-corpus-parked-domain-intake.md` | G-13 起的旁支台账：域、触发、未问问题、来源、状态、恢复方法；初始登记 V6 08–22 与 01–07 的未确认残余为 `PARKED_UNVERIFIED`。 | `design/review`；`product`；trigger `task-start/review` |
| `project-memory/required-inventory.json` | 为上述三份 anchor 增加确定性 route、assertion、sourceRefs；随后运行 index build，不能手改 `project-memory/index.md`。 | memory infrastructure |

第一份是业务语义来源；第二份是“如何使用它”的操作规则；第三份只记录未来工作，
不含任何未确认答案。不得把它们放进 kernel：不是每个纯工具或无关文档任务都需要
读取整份餐饮业务语料。

## 5. agent 何时必须读、读多少、如何留痕

### 5.1 触发矩阵

| 未来工作 | 必读内容 | 为什么 |
| --- | --- | --- |
| 任一 R3+ Journey、业务设计、contract 设计、UI 设计、implementation、业务代码 review、业务测试，且涉及 G-01–G-12 的任一对象/关系/禁推 | canonical corpus + adoption policy + 对应条目的 source refs | 避免由 API、表或旧 UI 反推业务 |
| 跨域任务（例如门店×合同×商品×库存，或角色×可视数据节点×门店） | 上述文件中所有命中的条目；必要时同时回读原草稿对应 G 结论 | 禁止只读本域而漏读关联禁推 |
| V6 08–22 或尚未覆盖概念第一次进入计划、Journey、contract、UI 或实现 | parked intake + 对应 V6 正式来源 + 原草稿相关段；先恢复 grill，未得 Dexter 结论不得设计成产品事实 | 本批没有确认那些域，不能用“还没问到”代替答案 |
| 只改机械格式、无业务含义的工具、日志、文档链接 | 不强制读取 canonical corpus | 防止无关任务被重记忆拖慢 |

每个适用任务仍先运行 `scripts/context/recall-memory` 的六维路由并逐个打开返回的
anchor；开始时人工对照 canonical 文件头的命中词干索引，任务标题、用户对象、动作
或已知历史别名命中即回读相应条目。无命中不等于“没有业务语义”：跨域关系、模糊
产品任务和新概念仍须按本矩阵判断并在不确定时进入 parked intake。该索引只是定位
入口，不决定 route、授权、结论或实现，更不是关键词式语义 checker。计划/设计/审
查文档应写出命中 `TERM_ID` 或 `G-xx` 及 source ref；不要求在每一行业务代码旁堆注释。

### 5.2 最小行为约束

1. 新 UI 操作必须有已确认业务任务或批准 Journey；没有时列候选、标明歧义来源，交 Dexter，不能由接口现状补答案。
2. contract、schema、技术名与业务词之间没有明示映射时，保留技术映射待裁决；不得因 canonical 名称存在就擅自物化字段或对象。
3. 条目中的“不得推导”是设计和审查的必查反例；例如品牌授权不产生门店可见性，库存提示不直接改菜单，启用/停用不等于营业。
4. 当前确定的显式修订必须在未来 materialization 时被重新读到：`workspaceKey → groupWorkspaceKey`、货号二元结构、任职撤销、合同衍生状态、商品价格归属等；本次不执行这些迁移。
5. business corpus 不取代 owner/transaction/contract/routing/standards rules；与现行更高层裁决不一致时停止并登记冲突。

## 6. parked 旁支的恢复机制

旁支状态为 `PARKED_UNVERIFIED`，不是 Roadmap 任务，也不排期。其恢复触发是未来一
个已获授权的业务域确实需要 V6 08–22 的概念、需要 01–07 中未被 G-01–G-12 覆盖的
残余概念，或该域与 G-01–G-12 发生产品语义冲突。

初始 parked 台账必须分两栏登记，均只记录问题与来源、不预置答案：

- `08–22 FUTURE DOMAINS`：每个未确认 V6 域按域登记；
- `01–07 UNCONFIRMED RESIDUALS`：至少登记 V6 02 的 `StoreOperationType`（实体还是枚举）
  与 `OrgScope`，以及 V6 03 中轻合同以外的商业关系实体群（如项目管理/参与方关系、
  合同空间约定、营销参与协议及权益类型接受行）。其正式来源是 V6 02/03 域；不能由
  现有 G-02/G-04/G-09 的局部结论推出其产品模型。

恢复时按一个小域批次执行：

1. 读取 parked entry、V6 术语表、该域正式文档和相关现行 all-v2 决策；只把 v4/v1 用作解释性印证。
2. 形成不超过审阅者约半小时的候选问题清单，逐题编号 `G-13` 以后；每题给出业务语言、关系、反例、出处与 `已共识/待裁决`。
3. Dexter 逐题裁决；将原话、来源与禁推追加进 review draft，不静默润色为实现需求。
4. 重新请求 Claude 独立 review；仅 Claude 复核和 Dexter 接受后的条目才进入 canonical corpus，并更新 parked 台账。

不得为了“补齐 22 域”设置通用研究项目，不得借此扩张当前授权或重启 R3。

## 7. 接受后的最小交付序列与验收

### Unit A：生成 canonical corpus

- owner：Codex（文档）；输入：冻结草稿、已确认语料记录、Claude review、Dexter 接受语句。
- 内容基准：逐条以冻结草稿 `§7.1–§7.12` 的 G 结论**全文**为准，包含限定词、历史映射、
  显式修订和待裁决；record 仅是提升集合目录，绝不能作为删节后的内容来源。
- 产物：`confirmed-business-language-corpus.md`；只收 G-01–G-12，逐条保留状态与来源。
- failure controls：一条无来源不得变成结论；一个待裁决不得写成已共识；G-13+ 不得提前出现。
- evidence：逐条与冻结草稿核对、source link 可打开、Dexter acceptance recorded。

### Unit B：接入 deterministic memory route

- owner：Codex（控制面）；输入：Unit A accepted bytes。
- 产物：read policy、parked intake、`required-inventory.json` 条目和生成的 index。
- failure controls：route 不命中适用设计任务、无关机械任务被强制命中、手工编辑 generated index、把语义做成 checker，任一均为 finding。
- evidence：运行 `scripts/check/project-memory`、`scripts/memory/build-index`、三组 `scripts/context/recall-memory` smoke（命中 G-01–G-12 的设计任务；命中 parked 08–22 的首次设计任务；命中 01–07 residual 的首次设计任务）。

### Unit C：交接与后续域维护

- owner：Dexter 决定产品语义；Claude 独立审阅；Codex 只维护已接受 bytes 和正确 route。
- evidence：Claude handoff checker PASS；每次新增 G 条目都有新 source hash、状态、Dexter 接受及 Claude review 记录。

上述 Unit 在本次都**不执行**；当前交付只是此方案、G-12 更新和 Claude review 请求。

## 8. 风险与反例

| 风险 | 反例 / 后果 | 控制 |
| --- | --- | --- |
| 记忆成为第二份全域需求文档 | 未确认的 V6 08–22 被 agent 当作已裁决 | canonical 与 parked 分离，禁止复制 Source ledger |
| 只做词表，不写边界 | 把总公司品牌授权当成门店可见范围 | 强制记录禁推和关系，而非中英翻译 |
| 路由过宽 | 改脚本也要读几十页业务语料，最终被绕过 | 只对业务设计/实施/review/testing 且术语命中时 route |
| 路由过窄 | 未来 UI 从历史页面反推“当前身份/查看范围” | G-01–G-12 业务任务、UI、contract、review 都触发 |
| 词干索引被误作语义门 | “没有关键词”被当作无需业务判断 | 明定为人工定位入口；无命中不产生否定结论，不接入 checker |
| Claude finding 被机械接纳 | 为 S-1 修一大套权限物化或改写 heritage | finding 逐项重开证据、找反例、只采已确认的最小修订 |
| “记忆已写入”被误读为实现许可 | 从业务词直接推 schema / R3 页面 | 每个 anchor 重申 authority boundary；Roadmap 授权独立检查 |

## 9. Codex 对抗式自审绑定

本方案的 `REVIEW_TARGET=DESIGN`、第一轮自审在
`doc/review/platform/2026-07-25-v2s-confirmed-business-corpus-memory-adoption-codex-self-review.md`。
它审的是“沉淀方式是否服务 Dexter 的长期业务共识”，不是 G-01–G-12 的产品语义重新
裁决。Claude 的 `GO_FOR_DEXTER_ACCEPTANCE(0 M / 0 S / 3 N)` 已逐条辩证处置并落为
最小修订，第二轮及 `SELF_DECIDED` 收口见
`doc/review/platform/2026-07-25-v2s-confirmed-business-corpus-memory-adoption-codex-review-resolution.md`；
不得再为同一方案启动第三轮 Codex 对抗审查。

## 10. 请求 Dexter 与 Claude 评审的决定

请确认或修订：

1. 是否接受推荐方案 C 及三个 future memory anchors 的职责划分；
2. canonical corpus 的触发矩阵是否足以防遗忘且没有把无关任务变慢；
3. G-01–G-12 是否恰好是本次允许提升的集合；
4. parked 08–22 的“按域触发、逐题 grill、再经 Claude+Dexter”机制是否合适；
5. 接受后是否授权执行第 7 节 Unit A/B（仍不含任何业务实现）。
