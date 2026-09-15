# DESIGN round 1 finding intake（主 agent 处置记录）

```text
REVIEW_TARGET=DESIGN
REVIEW_CYCLE_ID=2026-09-14-v2s-extension-field-list-search-design
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
reviewerKind=AUTHOR_INTAKE_ONLY
SOURCE_VERDICT=doc/review/platform/2026-09-14-v2s-extension-field-list-search-design-independent-review-verdict-codex-r1.md
STATUS=REPAIR_REQUIRED
AUTHORITY=IMPLEMENTATION_PREPARATION_ONLY
```

## 1. Intake boundary

本文件是主 agent 在 fresh 独立 reviewer verdict 之后的辩证 intake，不是独立 verdict，也不替代 reviewer 原文。主 agent 逐条重开当前需求、六份设计材料、active edge catalog、materializer、codegen 和当前 runner；只对有当前字节依据的部分修复。Reviewer 的 `L3_UNVERIFIED` 是后续实施/受管验证的证据缺口，不是本轮静态 DESIGN 的 GO 条件，也不把未运行的 L2/backend acceptance/DEV/seed 误报为 PASS。

## 2. Finding disposition

| finding | 判定 | 当前字节依据 | 处置 |
| --- | --- | --- | --- |
| M-1 `definitionRevision` contract 与校验顺序未闭合 | `CONFIRMED` | 详设只给 `extensionFilters` 形态；需求第 7.2 已规定 JSON shape/长度/条件数与 definition snapshot 的关系；计划第 4.1/owner 顺序没有 `definitionRevision` 的 exact parameter schema，也没有缺失 revision、malformed+stale 的优先级 | 详设和计划增加七个 operation 共用的 exact OpenAPI query parameter：`required=false`、`integer`、`int64`、`minimum=0`；同步所有业务材料的判定顺序：授权/context → raw query decode/长度/shape/条件数 → 非空缺 revision typed invalid → 读取 snapshot/比较 revision → 聚合语义 invalid → Page。空数组/未携带不读、不比 revision |
| M-2 `ExtensionFilter.value` wire 类型冲突 | `CONFIRMED` | 需求第 6.2 的 NUMBER/BOOLEAN 行把 UI 形态写成 transport value；详设和 codegen 可达链已固定 `value: string` | 采用较小且已与 M-01 修复一致的 scalar wire string 方案；需求、IA、交互、详设、计划明确区分 UI typed draft 与 wire string，并写明 owner 按 `type` 解码；不引入 typed union |
| S-1 acceptance scenario 表损坏 | `CONFIRMED` | 详设第 15 节含字面 `\\n|`，导致 scenario 行无法独立提取 | 拆成 8 个真实 Markdown 行，保留现有 owner、request 与 business oracle |
| S-2 视觉/授权状态残留 | `CONFIRMED` | 需求第 14.1 仍写 low-fi 待确认和 R3 false；Journey 第 8 节仍写待接受，其他材料又已记录 Dexter 视觉确认 | 统一为视觉已确认、R5 当前授权字段可见、fresh DESIGN round 2 是实施前独立门；保留实现前 `IMPLEMENTATION_AUTHORITY=false` / `RUNTIME_AUTHORITY=NONE`，删除本任务内 R3/待视觉确认 stale 文案，不提前宣告 implementation/runtime 授权 |
| N-1 多行示例使用单反引号 | `CONFIRMED` | 详设第 6.1/6.2 与部分状态块使用单反引号包裹多行 | query/JSON/可复制命令改为 fenced code block；不把单行 inline code 改成块 |

## 3. 根因抽象与防再犯

本轮 findings 的共同根因是“跨文档契约闭包与状态台账没有由可执行 source anchor 约束”：参数被语义引用但没有完整 schema/顺序，UI typed draft 与 wire 表达混写，Markdown 结构破坏 scenario 分母，视觉确认与授权状态分散且残留历史 R3 文本。后续实施和 P9 必须把每个参数、生成链、validation branch、scenario 行和授权状态同时回读 requirements、Journey、IA、interaction、详设、plan 与 owning source；任一只在单文档出现、无法由生成器或当前 source 验证的事实均不得记为 MATCHED。

## 4. Round 2 进入条件

round 2 前必须完成：

1. `definitionRevision` exact schema、缺失/非法/空数组顺序在需求、Journey、IA、interaction、详设、plan 逐项同步；
2. wire string 语义闭合，所有 NUMBER/BOOLEAN 的“transport”歧义消除；
3. acceptance scenario 表真实行可读，且无字面 `\\n|`；
4. 六份材料无本任务相关的 R3 false、待视觉确认或互相冲突状态；
5. 多行 query/JSON/命令示例可直接复制；
6. focused static proof 通过后，由新的 fresh 独立只读 subagent 执行 `REVIEW_ROUND=2` 定向盲审。未通过 round 2 不得进入 P1–P9。
