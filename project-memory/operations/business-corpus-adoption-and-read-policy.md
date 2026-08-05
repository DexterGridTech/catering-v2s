---
id: operations.business-corpus-adoption-and-read-policy
status: active
layer: routed
taskKinds: ["design","implementation","review","testing"]
domains: ["all"]
consumerFaces: ["all"]
owners: ["all"]
impacts: ["all"]
triggers: ["task-start","implementation","review"]
assertions: ["BUSINESS_CORPUS_MEMORY_PROMOTION_AUTHORIZED","BUSINESS_CORPUS_READ_POLICY"]
sourceRefs: ["doc/decisions/2026-07-25-v2s-confirmed-business-corpus-memory-adoption.md"]
---

# Business corpus adoption and read policy

## Before related work

For a business design, Journey, contract, UI, implementation, review or test, first run the normal
six-dimension memory recall. Read `decisions.confirmed-business-language-corpus` and this policy
when the task has a candidate business object, actor, relation, action, state, historical alias or
forbidden inference from G-01 to G-12. Use the corpus head index only to find entries; it does not
make a semantic decision and an index miss does not waive this policy.

For cross-domain work, read every matching entry. A task document records the relevant `G-xx`/
`TERM_ID` and source reference, rather than scattering boilerplate through each code line. Purely
mechanical formatting, tooling, logs and link-only work do not require the corpus.

## What the corpus constrains

- Business terms, prohibited inferences and explicitly recorded pending decisions constrain design
  language and user-facing text before technical names, schemas, APIs or old UI are chosen.
- A corpus term does not materialize a schema/API/contract, approve a Journey, authorize a UI,
  determine an owner or grant R3/W1/runtime authority.
- When current higher authority conflicts, stop, reopen sources and record the conflict; agent
  convenience cannot select a product meaning.
- Future materialization reopens the relevant full G entry, including its explicit revisions such
  as `workspaceKey → groupWorkspaceKey`, contract goods-code pair, assignment revocation and
  product-price boundary.

## Review discipline

Business review tests the user task and alternatives, not merely name consistency. “不得推导” is a
required counterexample: for example, brand authorization is not Store visibility, inventory hint
does not directly change a menu, and Store enablement is not operating status. Semantic judgment
remains fresh adversarial review and Claude/Dexter decision; do not create a keyword checker.

## G-05A authorization implementation discipline

凡涉及 workspace 读取、写操作、关联详情、搜索候选、角色节点或 capability 的设计、
实现、review 与测试，必须重开 corpus 的 `G-05A`。先分类主对象读取、关联事实读取、
关联候选和写操作，再选择范围谓词或写 grant；不得将“可读取”误写为“有 capability”，
也不得因主对象可读而跳过写 capability 或 owner recheck。

机械控制由 `tools/capability-invariants/cli.mjs` 执行：非写 OpenAPI operation 与 registry
requirement 不得携带 capability、capability mapping 或 owner recheck；operations edge 的
`@GetMapping` 不得解析 capability 或调用 capability helper；每条规则保留真实 red
mutation。生成器只向 workspace-IAM capability catalog 投影写 requirement。主对象与关联
候选的语义区分不能由关键词诚实判断，故 review 必须逐项证明主对象存在角色节点范围
谓词，而关联 readback/candidate 仅有工作空间、状态、查询和业务关系谓词。

每个写路径还须证明 server-resolved actual target、edge grant handoff、owner first-query
recheck 与 stale/wrong-target receipt replay 反例；不得用 UI 隐藏按钮、客户端字段或
controller 预读替代 owner 核验。

## Authority boundary

This policy was promoted only by the 2026-07-25 Dexter decision. It does not authorize new grill
questions, G-13+, R3/W1 implementation, contract/database/code/runtime work or Git writes.
