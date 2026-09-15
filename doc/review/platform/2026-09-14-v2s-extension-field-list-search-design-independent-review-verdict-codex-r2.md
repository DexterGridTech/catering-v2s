# 扩展字段列表展示与类型化搜索 DESIGN 独立复审 round 2

EVIDENCE=INDEPENDENT_REVIEWER_REPORT_PRESERVED
REVIEW_TARGET=DESIGN
REVIEW_CYCLE_ID=2026-09-14-v2s-extension-field-list-search-design
REVIEW_ROUND=2
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
BLIND_DECLARATION=我在形成 verdict 前未读取作者 finding intake、作者处置记录或作者自评；仅读取 round 1 独立 verdict 作为待核验线索，并重新按当前 bytes 以证伪立场审查。
VERDICT=NO-GO
M/S/N=0/1/1
ROUND_FINAL_DECISION=SELF_DECIDED

## Justification

当前设计已修复 round 1 的两个 M 类核心阻断：`definitionRevision` 两参数 schema 与所有分支顺序已经可执行，UI typed draft 与 wire string 唯一语义也已收敛；scenario 表、视觉确认、implementation/runtime 边界基本可核验。但 round 2 仍发现一个用户可见列顺序矛盾会让实施者猜测，另有 fenced code block 格式问题未完全修复。因此最终 DESIGN 轮次给出 `NO-GO`，但不建议第三轮；后续应由作者按 `SELF_DECIDED` 修正并收口。

## Findings

- `S-R2-1 CONFIRMED [L2_USER_VISIBLE]`：配置表列顺序仍冲突。需求文档规定固定顺序为：`字段名称｜字段类型｜是否列表展示｜是否可搜索｜是否必填｜是否启用｜选项`；但 interaction design 仍写成“两列紧跟‘是否必填’之后、‘是否启用’之前”。实施者无法判断两个新增列应在“是否必填”之前还是之后。最小修正：把 interaction design 的列顺序改为与 requirements 完全一致，并在 implementation plan 的配置表步骤中复述唯一顺序。

- `N-1 PARTIALLY_CONFIRMED [L1_ENGINEERING]`：fenced code block 问题只修了一部分。implementation design 的命令示例已是 fenced block；但 implementation plan 仍有多处单反引号跨行或缩进代码块模板，例如 metadata 区、P6/P9 record template、最终状态块。最小修正：统一替换为 ```text fenced code blocks。

## Round 1 directed checks

- `M-1 REJECTED_WITH_EVIDENCE [L1/L2]`：`definitionRevision` 两参数 exact schema 与分支顺序已足够明确。当前 requirements、journey、IA、interaction、implementation design、implementation plan 均表达：`extensionFilters` 为 JSON string query，逻辑 schema 为 `ExtensionFilter[]`；`definitionRevision` 为 optional `integer/int64/minimum 0`；空/缺 filters 不读取 revision，非空 filters 先做 syntax/shape，再校验 revision 缺失/非法，再读 definition snapshot，再判 stale，再做语义校验与 AND Page。

- `M-2 REJECTED_WITH_EVIDENCE [L1/L2]`：UI typed draft 与 wire string 语义已收敛。当前材料明确 UI 内部可用 typed draft，wire 层 `ExtensionFilter.value` 唯一为 string，NUMBER/BOOLEAN/SELECT/DATETIME/TEXT 均按 string 编码进入 query，不再有 JSON number/boolean 的实现歧义。

- `S-1 REJECTED_WITH_EVIDENCE [L1]`：scenario 表已是真实 Markdown 行。未再发现 literal `\\n|` 破坏表格的问题。

- `S-2 REJECTED_WITH_EVIDENCE [L1/L3]`：视觉确认和运行边界已清楚。当前材料一致声明低保真视觉已确认；implementation/runtime/backend acceptance/browser L2/seed/reset 均仍在 round 2 之后或无授权状态。未发现 stale “待视觉”文本或把 runtime 误报为已执行的问题。

## Proactive checks

- 8/12/10/7/tree：8 个 host、12 个 IA 位置、10 个 flat list surfaces、7 个 operation、tree 不参与本次筛选，当前材料总体一致；未发现新的 9-operation active denominator。
- owner/page/raw wire：7 个 operation 的 path、catalog identity、generated reachability 链路均有现有 source 可承接；设计要求 page owner query、raw wire string、UI typed draft 分层，未发现核心猜测点。
- error augmentation：设计使用 operation-scoped augmentation 增加 extension filter/revision 错误，不污染 `AUTHZ_READ` baseline，方向成立。
- generated reachable chain：`x-v2s-logical-schema` 下 `$ref` 可被 generator 递归 reachability 扫描触达，设计可执行。
- foundation：设计要求复用 `admin-ui-foundation` drawer/list/query lifecycle，未发现绕开 foundation 的新增抽象要求。
- seed：设计只授权 seed 脚本/source 修改，不授权执行 seed；definition → values → revision change 顺序明确。
- authorization：本轮为只读 DESIGN review；未执行 reset/seed/DEV/backend acceptance/browser L2 或任何动态动作。

## Stop condition

round 2 是最终 DESIGN review 轮次。当前 verdict 为 `NO-GO`，原因限于上述 1 个 S 与 1 个 N；不再建议第三轮独立 DESIGN review。
