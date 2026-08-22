# 后台接口性能整改 · Information Architecture

```text
IA_SCOPE=IA-BPR-01
BUSINESS_SOURCE=doc/plans/platform/2026-08-22-v2s-backend-performance-remediation-requirements-claude.md
JOURNEY_REFS=doc/decisions/2026-08-22-v2s-backend-performance-batch-outcome-journey.md
UI_INTERACTION_REF=doc/decisions/2026-08-22-v2s-backend-performance-batch-outcome-ui-interaction.md
IMPLEMENTATION_DESIGN_REF=doc/plans/platform/2026-08-22-v2s-backend-performance-remediation-implementation-design-codex.md
DEXTER_WIREFRAME_REVIEW=ACCEPTED@2026-08-22
IMPLEMENTATION_AUTHORITY=false
```

## 1 · IA-BPR-01 · 商品批量状态流转结果

### 1.1 可见维度

| 维度 | 已确认取值 |
|---|---|
| `businessTask` | 用户一次选择多个商品执行启用、停用或作废后，准确知道成功多少、失败多少、哪些失败以及 owner 给出的原因，并能继续处理失败项。 |
| `actorAndScenario` | 集团总部或门店中具备商品状态写权限的运营人员，在商品列表多选后发起批量状态流转。 |
| `entryAndSurface` | `/operations/:workspaceCode/catalog/store-items` 现有商品工作台；从批量操作按钮打开现有 Modal，不新增页面、详情页或审计入口。 |
| `controlType` | 确认态：目标状态、选中数、取消/确认；提交态：原 Modal 内 loading 且禁止重复提交；完成态：成功 N 项、失败 M 项，失败时仅列失败商品编码与 owner 原因；请求级失败保留确认上下文并显示 typed problem。 |
| `validationAndError` | 选择为空、重复商品、请求 identity 不完整在提交前阻断；单项业务失败进入正常 2xx receipt 的失败项；请求级授权、scope、幂等冲突、非法目标状态走整体 typed problem。前端不得把 owner reason 改写为“操作失败”。 |
| `accessibilityAndTestId` | Modal 有可读标题；提交中按钮 `aria-busy`;结果总数以文字和图标共同表达，不只靠颜色；失败列表可键盘滚动。保留现有 catalog workbench testId 词根，新增 `catalog-batch-outcome-summary`、`catalog-batch-outcome-failures`、`catalog-batch-outcome-close`，不使用 Journey/规则编号。 |
| `emptyLoadingErrorStates` | 批量入口只在选中至少一项时可提交；提交中不清空已选商品；全部成功时不渲染空失败列表；请求级失败保留选中项和目标状态供重试；关闭 Modal 才清空本次结果与草稿。 |
| `containerBehaviorUnderLoad` | 与交互稿逐字一致：Modal 不溢出视口；摘要与底部操作区固定可见，失败列表区域独立纵向滚动，最大高度 `50vh`；长编码单行省略并提供完整文本提示，reason 允许换行；列表列按失败商品行对齐，不做左右双栏。达到请求上限 100 项且全部失败时仍只滚动失败区。 |

### 1.2 不可见维度与最低证据档位

| 维度 | 可执行观察 |
|---|---|
| `stateAndPermission` | `[backend-acceptance]` 用仅获授权 A 数据节点的运营身份，对 B 节点调用 `batchTransitionOperationsCatalogItemStatus`，整体返回 scope/authorization typed problem，A/B 商品状态与版本均不变；用无状态写 grant 的身份调用同一 operation，全部写入为零。`[静态]` edge 仍只调用 catalog owner command，owner 在每项事务内复核版本与当前状态。 |
| `navigationAndRefresh` | `[组件 focused test]` receipt 通过严格 identity 校验后，只让当前 `getOperationsCatalogItems` 查询和 `getOperationsCatalogNavigation` 失效/重取；不重取 workspace context、shape manifest、tag dictionary 或单位库。刷新失败时 Modal 仍保留权威 receipt 并提示列表刷新失败，不把命令降格为失败。请求级失败与 receipt 协议失败均不触发刷新。 |
| `collectionShapeAndScale` | `Bounded`。request.items 与 response.results 均为 1–100，硬上限来自现有批量请求约束；结果必须与规范化请求项严格同序、同身份、同数量。`[owner focused test]` 构造 100 项部分失败验证完整结果；重复、缺失、额外、乱序 receipt 任一种都使协议校验变红；101 项在 owner 写前拒绝。前端只渲染失败子集 0–100，不分页、不客户端 slice。 |
| `dataSourceAndCascade` | 结果唯一来自 catalog owner 的 canonical receipt；`itemCode`、`outcome`、`problemCode`、`reason`、`version` 不由前端补造。`[focused test]` owner 返回缺少一项或未知 itemRef 时，前端进入协议错误，不产生 `RESULT_UNKNOWN` 伪结果；合法 receipt 后列表与导航读取 owner 最新事实。 |
| `forbiddenUI` | `[静态 + focused test]` DOM 与文案不得出现 `itemRef`、数据库操作数、section、connection、transaction、receipt key、raw exception、SQL、token/cookie/Authorization；不得出现 `SKIPPED`、审计入口、整批回滚承诺、笼统“操作失败”替代 owner reason。逐个字符串出现即缺陷。 |

## 2 · 共用信息架构规则

1. 本批唯一 UI-bearing surface 是 IA-BPR-01；L1 拓扑、L2 门和 P0–P5 指标均不形成运营界面。
2. 服务端事实不镜像进长期本地 state：Modal 只持有当前命令 receipt/草稿，商品列表和导航继续由 RTK query 持有。
3. `currentData` 保留旧列表，`isFetching` 只表现刷新；保存后不得清空整页再显示全屏 loading。
4. 每项 outcome 只有 `SUCCEEDED | FAILED`。合法同状态 no-op 是 `SUCCEEDED`；请求级前置失败不构造逐项结果。
5. B-06 不新增审计语义。receipt 只证明本次/重放命令结果，不在 UI 命名为“审计记录”。
6. 失败原因由 owner 提供经过脱敏的业务文案；前端可布局、不可改义、拼接 raw exception 或用本地字典覆盖。

## 3 · 错误语义与界面映射

### 3.1 请求级 typed problem

| problem code / 类别 | HTTP | 业务规则映射 | 触发界面/owner | 用户可见处理 |
|---|---:|---|---|---|
| `VALIDATION_ERROR` | 422 | 空请求、超 100、重复项、非法目标状态或请求结构不合法 | Modal 提交 / catalog owner | Modal 顶部显示 owner 文案；保留选择与目标状态，不刷新。 |
| `SCOPE_FORBIDDEN` / `AUTHORIZATION_FORBIDDEN` | 403 | 身份无节点或状态写权限 | edge + catalog owner | 显示无权操作；关闭后回到当前列表，不泄露目标项事实。 |
| `NOT_FOUND` | 404 | 请求级 scope/context 所需事实不存在 | edge / owner | 显示 owner 文案，不构造失败项。 |
| `IDEMPOTENCY_MISMATCH` | 409 | 同一幂等键对应不同 canonical request | receipt owner | 显示“请求内容已变化，请重新提交”；不刷新、不复用旧 receipt。 |
| `CATALOG_BATCH_RESULT_PROTOCOL_INVALID`（新增内部消费错误） | 客户端协议错误 | receipt 项数/身份/顺序/outcome/条件字段不符合契约 | frontend decoder | 显示“批量结果校验失败，请刷新后重试”；不补造结果、不自动重发写命令。该错误不得把 raw payload 写入 DOM/日志。 |

### 3.2 每项失败 problem

每项失败仍在 2xx canonical receipt 内；`problemCode` 使用 catalog owner 已登记 problem 闭集，`reason` 为 owner 的脱敏业务文案。适用于当前状态流转控制流的全集如下；未来 owner 闭集增加成员时由生成契约穷尽消费，不由前端手写分支。

| problem code / 类别 | item outcome | 触发条件 | 用户可见处理 |
|---|---|---|---|
| `VERSION_CONFLICT` | `FAILED` | expectedVersion 与项事务内当前版本不一致 | 失败列表显示商品编码与“商品版本已变化”；成功项不回滚。 |
| `VOIDED_RECORD_IMMUTABLE` | `FAILED` | 已作废商品被请求改为其他状态 | 显示 owner reason。 |
| `VALIDATION_ERROR` | `FAILED` | 启用前必填事实不完整、shape/SKU 约束不满足或目标转换非法 | 显示精确 owner reason，不归并成一种文案。 |
| `NOT_FOUND` / `SCOPE_FORBIDDEN` | `FAILED` | 某一项在事务内不可见或已不存在 | 只显示商品编码与 owner reason，不显示 itemRef 或跨 scope 事实。 |
| 其他已登记 catalog typed problem | `FAILED` | owner 在项事务内拒绝 | 原样显示脱敏 reason；缺少 reason 即协议缺陷，不回退本地字典。 |

出现 `FAILED` 却没有非空 `problemCode`/`reason`，或 `SUCCEEDED` 却携带失败字段，均为红夹具，不为它编造新的 HTTP 业务 code。

## 4 · 交叉对账

| 检查 | 结果 |
|---|---|
| IA ↔ Journey | IA-BPR-01 对应 `J-BPR-001` 的确认、提交、逐项结果与继续处理步骤；一致。 |
| IA ↔ 交互工件 | Modal 五态、只列失败项、失败区滚动、关闭清理、刷新语义与交互稿一致。 |
| IA ↔ 详设 | 详设 §3、§5、§7、§11 必须逐字使用：`Bounded 1–100`、`SUCCEEDED \| FAILED`、严格同序同身份同数量、只刷新商品列表和导航、不新增审计语义。 |
| 计数 | IA-ID 实际 1 个；UI route/operation 各 1 条。 |

```text
IA_DIMENSIONS=IA-BPR-01 两组维度逐项齐全
INVISIBLE_DIMENSIONS_AS_OBSERVATIONS=是
FORBIDDEN_UI=explicit
TYPED_PROBLEMS=请求级5类 + 每项5类映射
CROSS_CHECK_WITH_DESIGN=COMPLETE
DEXTER_WIREFRAME_REVIEW=ACCEPTED@2026-08-22
IA_STATUS=DEXTER_ACCEPTED_AND_CROSS_CHECKED;不构成 implementation authorization
```
