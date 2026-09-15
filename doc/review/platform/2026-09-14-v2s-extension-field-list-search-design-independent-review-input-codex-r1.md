# 扩展字段列表展示与类型化搜索：fresh 独立 DESIGN review 输入清单

```text
REVIEW_TARGET=DESIGN
REVIEW_CYCLE_ID=2026-09-14-v2s-extension-field-list-search-design
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
BLIND_REVIEW=true
AUTHOR_INTAKE=NOT_PROVIDED_BEFORE_VERDICT
```

这是给 fresh 独立只读 reviewer 的输入清单。reviewer 必须在读取作者自评、作者 finding intake 或处置材料之前，先以证伪为立场审查当前设计字节，形成 findings 与 verdict。reviewer 不得写入仓库，不得修改任何文档、契约、源码、测试或生成物。

## 1. 必读入口与授权

- `AGENTS.md`
- `CLAUDE.md`
- `PLATFORM-BLUEPRINT.md`
- `doc/platform/README.md`
- `doc/platform/roadmap-program-registry.json`
- registry 选出的 `doc/roadmaps/platform/2026-07-24-v2s-execution-roadmap.md`，只读取当前显式授权字段：`R5_IMPLEMENTATION_AUTHORIZED=true`、`R5_RUNTIME_AUTHORIZED=true`、`R5_SEED_RESET_AUTHORIZED=true`、`V2S_WRITE_AUTHORITY=true`、`V2S_SESSION_ENTRY_READY=true`、`V2S_FOUNDATION_READY=true`。Roadmap 历史状态叙述不是当前 task 指派。
- 当前 Dexter 直接授权边界：视觉 IA 已确认；五项 design finding 修复后进行本轮 fresh 独立 DESIGN 盲审；盲审通过后才进入 P1–P9 实施与受管 reset/DEV/seed。此轮不做第三轮 Claude DESIGN review。

## 2. Project memory 与六维 recall

- `project-memory/index.md` 全部 kernel 导航；`project-memory/kernel/*.md` 全部读取。
- 运行六维 recall，并读取所有命中路径和 `sourceRefs` 原文：

```sh
scripts/context/recall-memory \
  --task-kind implementation \
  --domain platform \
  --consumer-face platform-admin \
  --owner platform \
  --impact contract \
  --trigger implementation
```

- 另读 `project-memory/decisions/deterministic-context-only.md`，不得以 handoff、聊天摘要或旧 evidence 代替当前 source。

## 3. 当前设计对象（必须完整读取）

- `doc/plans/platform/2026-09-14-v2s-extension-field-list-search-requirements.md`
- `doc/decisions/2026-09-14-v2s-extension-field-list-search-journey.md`
- `doc/plans/platform/2026-09-14-v2s-extension-field-list-search-ia-design-codex.md`
- `doc/plans/platform/2026-09-14-v2s-extension-field-list-search-interaction-design-codex.md`
- `doc/plans/platform/2026-09-14-v2s-extension-field-list-search-implementation-design-codex.md`
- `doc/plans/platform/2026-09-14-v2s-extension-field-list-search-implementation-plan-codex.md`

重点从当前设计自行推导 expected set：8 host、12 screen、10 flat consumer、7 list operation、树 unchanged；`listDisplay`/`searchable` 独立；`ExtensionFieldType`、`ExtensionFilter`、`ExtensionFilterQuery` 共享组件；scalar wire 的 `value:string`；空数组与未携带条件的 revision 语义；active error set 的 operation augmentation；五表/100k/index/budget；P0–P9、P9 逐代码对账和实现授权边界。

## 4. 当前 owning source 与生成链

- `scripts/generate/edge-codegen.mjs`：`tsSchemaType`、`tsReachableComponentNames`、operation contract/check outputs。
- `scripts/generate/r5-edge-materialize.mjs`：`operationErrors`、`operationDocument`、`materializeComponents`、symbolic ref 转真实 `$ref`。
- `doc/plans/platform/2026-07-25-v2s-r5-edge-contract-implementation-catalog.json`：`errorSets`、`operationErrorAugmentations`、7 个 target operation 的 `queryParameters`、`componentFieldBaseline`、`componentOverrides`、component reference closure。
- `doc/plans/platform/2026-07-26-v2s-r5-error-code-disposition-catalog.json`：两个新增 code 的 ownership/metadata 正本与 `policy.operationClosedSet`。
- `contracts/openapi/components/extension/extension.schemas.json`：当前 materialized definition schema，确认 Heritage inline enum 和当前生成字节。
- 七个当前目标 operation：`getOperationsOrganizationBrands`、`getOperationsOrganizationTenants`、`getOperationsOrganizationHeadCompanies`、`getOperationsOrganizationStores`、`getOperationsContracts`、`getPlatformOrganizationOverviewPage`、`getPlatformContractOverviewPage`。
- `scripts/test/test-health-entry-runner.mjs`：当前真实 test-health entry runner；不存在的旧路径不得被当作 source。
- 相关 backend/frontend coding standard、`doc/platform/review-standard.md`、`doc/decisions/2026-07-24-v2s-verification-governance.md`、`doc/decisions/2026-07-25-v2s-independent-subagent-adversarial-review-governance.md`。

## 5. Blind 审查动作与输出

1. 先读入口、授权、memory、设计和 owning source；必须主动尝试证伪，不把作者材料的结论当 oracle。
2. 对每个 design 声明检查 source 可实现性、生成可达性、owner/consumer 闭包、错误码闭集、空值边界、UI/IA 一致性和 scope/非目标。
3. 特别检查 `ExtensionFilter` 是否存在合法 `type/properties/$ref/enum`，`ExtensionFilterQuery` 是否能由七个 parameter 进入 codegen reachable closure，`ExtensionFieldType` 是否有 active source 且替换两处 inline enum；检查七个 operation 是否各自有两个新增 error code 的明确 augmentation 方案；检查 `extensionFilters=[]` 是否不触发 revision。
4. 不得执行 reset、seed、DEV、backend acceptance、browser L2 或任何动态写入；设计 review 只读。
5. 产出独立报告（可写在 reviewer 返回结果中，不写仓库），必须包含：
   - `REVIEW_TARGET=DESIGN`
   - `REVIEW_CYCLE_ID`、`REVIEW_ROUND=1`、`REVIEW_ROUND_LIMIT=2`
   - `reviewerKind=INDEPENDENT_SUBAGENT`
   - 完整输入清单与 blind declaration
   - findings：`M/S/N` 编号、`CONFIRMED / PARTIALLY_CONFIRMED / REJECTED_WITH_EVIDENCE / UNVERIFIED_REQUIRES_EVIDENCE / DEXTER_DECISION`、依据文件/章节、反例、最小修复
   - `GO` 或 `NO-GO`；若仅因未获 L2 而不能证明用户可见行为，按 review standard 标明 `GO_WITH_UNVERIFIED_UI`，不得把静态证据升级为 L2 PASS。

## Blind declaration

`I received this checklist in a fresh subagent context, tried to falsify the reviewed design, and wrote my findings and verdict before reading the author self-review or author finding disposition.`

`I treated missing or substituted source anchors, generated reachability, per-operation closed error sets, empty-array semantics, and per-change evidence as findings when they could not be derived from current bytes. I did not treat a generator skeleton, prior Claude verdict, handoff, or static green result as proof of business completeness.`
