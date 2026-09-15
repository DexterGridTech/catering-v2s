# 扩展字段列表展示与类型化搜索：实施前 finding intake

```text
REVIEW_TARGET=DESIGN
REVIEW_CYCLE_ID=2026-09-14-v2s-extension-field-list-search-design
REVIEW_ROUND=PRE_IMPLEMENTATION_INTAKE
reviewerKind=AUTHOR_INTAKE_ONLY
STATUS=REPAIR_REQUIRED
AUTHORITY=IMPLEMENTATION_PREPARATION_ONLY
```

本文件是主 agent 对 Dexter 转交的第二轮 Claude DESIGN finding 的事实 intake，不是独立 reviewer verdict，也不把 handoff、聊天摘要或旧证据当作当前事实正本。所有判定均以当前仓库字节、生成器和活动 edge catalog 为准。修复完成后仍需 fresh、只读、盲审的独立 DESIGN reviewer；本文件不得作为该 reviewer 的结论输入。

## 1. 当前事实与核验边界

| finding | 当前判定 | 当前 owning source | 证据 | 最小修复 |
| --- | --- | --- | --- | --- |
| `M-01` | `CONFIRMED` | `scripts/generate/edge-codegen.mjs#tsSchemaType`、`#tsReachableComponentNames`；implementation design §6.2 | `tsSchemaType` 对无 `type` 的 schema 走 `R5_EDGE_TS_SCHEMA_UNSUPPORTED`；当前 query 是裸 string，不引用逻辑 component，导致 `ExtensionFilter` 不在可达链 | `ExtensionFilter.value` 改为 `type:string`；新增 scalar `ExtensionFilterQuery`，七个 query parameter 通过 active catalog symbolic ref 引用它，并在该 component 的 vendor extension 中保留 `ExtensionFilter[]` 的 `$ref` 逻辑形态；生成链只生成/消费 generated type，不手写 HTTP DTO |
| `N-01` | `CONFIRMED` | implementation design §14.1、implementation plan §2.1/§7.1、`scripts/test/test-health-entry-runner.mjs` | 仓内真实 runner 文件为 `scripts/test/test-health-entry-runner.mjs`，`scripts/test/test-health.mjs` 不存在 | 两份材料统一改为真实路径 |
| `N-02` | `CONFIRMED` | active edge catalog `componentFieldBaseline`/`componentOverrides`；生成的 extension schema | `ExtensionFieldType` 未出现在 active component baseline；`ExtensionDefinition` 与 update request 的 type enum 当前由 heritage schema/override inline 提供；详设引用了不存在的共享 component | 在 active catalog 增加 `ExtensionFieldType`；通过 v2s component override 将两个 definition type 属性改成 `$ref`，不改写 hash-locked Heritage source；生成物由 materializer/codegen 派生 |
| `N-03` | `CONFIRMED` | `scripts/generate/r5-edge-materialize.mjs#operationErrors`、active edge catalog `errorSets`/`operationErrorAugmentations`、error disposition catalog `policy.operationClosedSet` | 七个目标 operation 的 `errorSetRef` 均为 `AUTHZ_READ`；该 set 只有五个既有读取错误码且不含两个新增码；活动机制是 base set + per-operation augmentation，旧 disposition catalog 只负责 code ownership/metadata | 两个 code 进入 disposition catalog；active edge catalog 为七个目标 operation 各登记 `[EXTENSION_DEFINITION_REVISION_STALE, EXTENSION_FILTER_INVALID]` augmentation；不扩大 `AUTHZ_READ`，不新增 `OperationsApiProblem` |
| `N-04` | `CONFIRMED` | requirements §6.3/§7.1、IA、interaction、implementation design §6.2/§6.3 | 当前材料只说明“没有扩展条件”可省略 revision，没有把语法存在但零元素的 `extensionFilters=[]` 归入该语义 | 明确未携带或解码为空数组均等价于无扩展条件：可省略 `definitionRevision`，owner 不做 revision 比对；非空数组才要求并比较 |

## 2. N-03 的普通业务读接口裁决

当前实现链并不从 `doc/plans/platform/2026-07-26-v2s-r5-error-code-disposition-catalog.json` 直接读取 operation closed set。真实 materializer 先从 `doc/plans/platform/2026-07-25-v2s-r5-edge-contract-implementation-catalog.json` 读取 `errorSets`、`operationErrorAugmentations` 和可选的 `operationErrorSelectionRules`，再将结果写入每个 path 的 `x-error-codes`；disposition catalog 提供 code 的 ownership/metadata。普通业务读 operation 若新增 owner 业务错误，必须进入该活动链。

本批七个目标 operation 均为 `AUTHZ_READ` base set，分别是：

- `getOperationsOrganizationBrands`
- `getOperationsOrganizationTenants`
- `getOperationsOrganizationHeadCompanies`
- `getOperationsOrganizationStores`
- `getOperationsContracts`
- `getPlatformOrganizationOverviewPage`
- `getPlatformContractOverviewPage`

因此采用 operation-scoped augmentation，而不是修改全局 `AUTHZ_READ`。实施 focused proof 必须检查 materialized 七个 path 的 `x-error-codes` 和两个 consumer face 的 generated code closure，且逐 operation 记录 source → materializer → generated 的证据。

## 3. 共同根因族与防再犯

这五个 finding 不是五个孤立拼写错误，属于“设计声明没有闭合到当前生成/执行 source”的同一问题族，分为四个可复用根因层：

1. **生成契约可达性**：逻辑 schema 既要合法可生成，还要从 operation parameter 或 response 进入 reachable component closure；裸 string、文档片段和未达路径都不能替代 generated chain。
2. **活动 source 锚点漂移**：计划中的文件名、目录和 registry 键必须由当前 owning source 复核；旧路径不能作为 P9 对账锚点。
3. **共享语义的唯一引用**：type enum、wire scalar 与 logical payload 必须在 active catalog 中有唯一共享 component，并以真实 `$ref` 进入 materializer；hash-locked Heritage 只读，偏差用 v2s override 表达。
4. **请求状态的空值/缺席区分**：未携带、空数组、非空数组、非法数组必须分别定义是否触发 revision、校验和 owner query，不能以“可选”概括。

防再犯落点：implementation design §6.2/§6.3、plan §4.1/§4.2、活动 catalog 的 component/parameter/error augmentation、`edge-codegen`/`r5-edge-materialize` focused check，以及 P9 逐代码与详设对账。实施后任何 component、parameter、error code、test anchor 或空值语义没有 source-to-generated-to-consumer 链的项均不得标记 `MATCHED`。

## 4. 当前处置状态

```text
M-01=CONFIRMED_REPAIR_DESIGN_REQUIRED
N-01=CONFIRMED_REPAIR_DESIGN_REQUIRED
N-02=CONFIRMED_REPAIR_DESIGN_REQUIRED
N-03=CONFIRMED_REPAIR_DESIGN_REQUIRED
N-04=CONFIRMED_REPAIR_DESIGN_REQUIRED
OPEN=5
AUTHOR_VERDICT=NOT_A_REVIEW_VERDICT
NEXT_GATE=FRESH_INDEPENDENT_DESIGN_REVIEW
```
