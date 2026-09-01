# 商品作废 BOM 引用语义：fresh independent DESIGN review

REVIEW_CYCLE_ID=CATALOG_ITEM_VOID_BOM_REFERENCE_DESIGN_20260830
REVIEW_TARGET=DESIGN
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
BLIND_REVIEW=TRUE
INDEPENDENT_BASELINE_FROZEN=true
ROUND_FINAL_DECISION=OPEN_FOR_AUTHOR_INTAKE
INDEPENDENT_REVIEW=NO-GO
M=1
S=3
N=0

## 记录说明

本文件由主 agent 按 fresh 独立子 agent 的原文最终消息逐字转录保存。该子 agent 的执行边界为只读，不能自行写入 review 文件；主 agent 未代写其 verdict，也未把本文件当作作者自审结论。以下内容是独立子 agent 的原文结果。

## 独立审查原文

Dexter，静态盲审已完成，但我没有写入报告文件：当前系统给我的 Critic 边界是只读，明确禁止写/编辑文件，所以我不能创建或更新该 review 文件。

状态：**NO-GO / REJECT，M/S/N = 1/3/0**

关键阻断如下：

1. **M：active/history/scope 查询口径自相矛盾**
   - 设计要求“只按 subject active target refs 判断 inbound BOM”，同时又要求“active BOM 命中 disabled subject target 时 fail closed”。这两者不能靠同一个 active-only 集合实现。
   - 影响：某个 active BOM 若指向 subject 的 disabled target，可能被漏判，导致 item 被错误 void。
   - 最小修复：明确拆成 `ownedTargetRefsAllStatus` 与 `ownedActiveTargetRefs` 两组；active BOM 命中 active target 才产生 `USED_BY_INVENTORY_BOM`，命中 disabled/unknown target 必须产生 invariant/fail-closed 诊断。

2. **S：verification 顺序存在文件间矛盾**
   - implementation design 写成 `scripts/verify --validate-only` 先于生成链；implementation plan 与既有 serial plan 则是 generator/source 更新和生成校验先于 validate-only。
   - 影响：执行者可能用旧 generated 输出验证，或者在 contract/generator/frontend 未同步前得到误导性结果。
   - 最小修复：统一为“contract/generator/source 更新及生成校验 → `scripts/verify --validate-only` → focused tests → backend acceptance → L2/seed”。

3. **S：backend acceptance 仍有退役的 80-cap / budget 上限阴影**
   - 当前仓库规则已明确 backend acceptance scenario 总数不设上限，但待审设计仍说“不改变 CP05 或任何预算上限”，且依赖的旧 08-22 设计里仍有 77→80 的历史表述。
   - 影响：执行者可能为保旧 cap 压缩 A/B/SKU/batch/rollback 覆盖。
   - 最小修复：改为“不新增 HTTP/generated operation budget；backend acceptance scenario count has no total cap, coverage follows business oracle”。

4. **S：batch A+B 同批语义未冻结**
   - 设计把 same-batch A owns BOM to B 的处理留成 `DEXTER_DECISION`/默认不自释放，但 batch mutation 又在实施范围内。
   - 影响：执行者需要猜测同批 A 退休后 B 是否可 void，可能造成 detail/mutation/batch 不同源。
   - 最小修复：冻结为 fail-closed/no same-batch release，或明确 CP-03 batch change 在 Dexter 决策前不得实施。

我实际完成了输入文件顺序阅读、项目 memory 路由、当前 owning source 抽样核验、以及待审四份材料最后阅读；没有触碰源码、生成物、seed、L2、DEV 或运行环境。

## 第二轮最终独立审查原文

REVIEW_CYCLE_ID=CATALOG_ITEM_VOID_BOM_REFERENCE_DESIGN_20260830
REVIEW_TARGET=DESIGN
REVIEW_ROUND=2
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
BLIND_REVIEW=TRUE
ROUND_FINAL_DECISION=SELF_DECIDED
VERDICT=GO_WITH_UNVERIFIED_UI
M/S/N=0/0/0

Dexter，结论：**GO**。按仓内 review-standard 的 UI/dynamic 表达，完整 verdict 是：**GO_WITH_UNVERIFIED_UI**。这是设计可实施结论，不代表 seed/L2/DEV/动态已验证。

**Justification**：第 1 轮 NO-GO 的四个核心缺口已在当前修订材料中闭合，且与当前 owning source 可实施路径一致：

- all-status target 分流已明确：`ownedTargetRefsAllStatus`、`ownedActiveTargetRefs`、`ownedDisabledTargetRefs` 分开，active BOM 命中 disabled target 或 unknown mapping 均 typed fail closed；own BOM owner/self-reference 不再当 inbound blocker。
- 验证顺序已统一为 contract/source + owning generator 先行，然后 `scripts/verify --validate-only`，再 focused tests、backend acceptance、L2、seed/readback。
- backend acceptance 已明确“场景总数不设历史 80 条 cap”，同时“不新增 HTTP operation / 不改变 operation budget”边界清楚。
- batch-start graph 已冻结为同批 A/B 不拓扑释放；未获裁决前 CP-03 batch 语义不实施。
- `DISABLED` immutable sibling 已作为 auto-retirement 的必要同根边界纳入 owner、contract/generator、tests、seed/L2 change surface，未越权成 DEV/seed/L2 执行。

**反例构造结果**：我构造了“B 的 active inbound BOM row 指向 B 的 disabled target”“A 自有 BOM self-reference”“legacy option material resolver 读到 disabled target”“同批 A/B 先作废 A 后释放 B”等反例。当前修订计划都要求 fail closed、own-definition retirement、resolver parity test、或 batch 未裁决不实施；未发现“所有计划判据通过仍会错误放行/阻断/删除历史”的反例。

**实际核对路径**：`doc/platform/review-standard.md`、相关 project memory、`contracts/policy/catalog-inventory-reference-path-matrix.json`、inventory/catalog owner 与 coordinator、generator、operations-admin model/label/view，以及四份当前待审修订材料。

**未核边界**：未运行 DEV/reset/seed/L2/backend acceptance/focused tests；未写文件；未修改源码或生成物。
