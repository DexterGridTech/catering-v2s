---
title: 后台性能整改批量商品状态结果交互工件
status: DEXTER_WIREFRAME_ACCEPTED
createdAt: 2026-08-22
journeyId: J-BPR-001
consumerFace: operations-admin
implementationAuthority: false
---

# 交互工件：J-BPR-001 看清批量商品状态处理结果

<a id="backend-performance-batch-outcome-interaction"></a>

## 1. 工件元数据

```text
JOURNEY_DECISION=doc/decisions/2026-08-22-v2s-backend-performance-batch-outcome-journey.md#backend-performance-batch-outcome-journey
BUSINESS_REQUIREMENT_SOURCE=doc/plans/platform/2026-08-22-v2s-backend-performance-remediation-requirements-claude.md#5-8-批量流转逐项尽力--明确报告dexter-2026-08-22-裁定
BUSINESS_PROBLEM=批量状态操作部分失败时，用户只能看到技术失败编码，无法判断哪些商品需要处理以及失败原因
BUSINESS_USER_OR_OWNER=总部或门店商品资料维护者；catalog owner
CURRENT_TASK=批量启用、停用或归档商品并看清每项实际结果
SUCCESS_OUTCOME=界面显示成功数、失败数以及失败商品的业务原因，关闭后列表和导航计数读回最新事实
UI_BEARING=true
SKILL_USED=cs-spec-to-plan@3f223891a0d93ce08a8c84829822d220399e0cdcb46153edac6d4b101613e6b4
DEXTER_WIREFRAME_REVIEW=ACCEPTED@2026-08-22
DEXTER_HIFI_REVIEW=NOT_REQUIRED
CONSUMER_FACE=operations-admin
```

### Screen: BPR-01 批量状态确认与结果 Modal

```text
CONSUMER_FACE=operations-admin
UI_SURFACE=Modal
HOST_AND_ENTRY=/operations/{groupWorkspaceKey}/catalog/store-items 或 /catalog/brand-items；商品列表选中 1 至 100 项后，从“批量操作”选择“批量改状态”或“批量归档”
ACTOR=总部或门店商品资料维护者
BUSINESS_SCENARIO=用户要让多个商品进入同一目标状态，同时接受个别商品因自身规则失败
BUSINESS_GOAL=提交前看清动作和数量；提交后不离开当前工作台即可看清成功数、失败数和每个失败商品的业务原因
USER_VISIBLE_COPY=“批量改状态”“批量归档”“目标状态”“启用”“停用”“将归档 N 个商品”“取消”“执行”“正在处理，请稍候…”“批量操作完成”“成功 N 项，失败 M 项”“以下 M 个商品未处理成功”“商品编码”“失败原因”“关闭”“批量操作未执行”
TECHNICAL_BOUNDARY=itemRef、expectedVersion、outcome、problemCode、version、receipt requestId 不作为用户字段；reason 必须是 owner 返回的脱敏业务文案；请求级 typed problem 与逐项结果是两种互斥响应
FOUNDATION_PRIMITIVE=useOverlayLock,createContentIdempotencyKey,testId
CONTAINER_LAYOUT=使用 Ant Design Modal 的现有商品工作台宽度基线；Header/Footer 与摘要不得横向溢出；结果列表是 Modal body 内唯一滚动容器且最大高度不超过 50vh，页面本身不因 Modal 内容滚动；失败原因列可换行，商品编码列保持一行并省略显示完整 tooltip
```

## 2. Interaction map

| 顺序 | 前提 | route / 屏幕 | 用户目的 | 可见信息与可操作项 | server/owner readback | 成功去向 | 失败/退出恢复 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 商品工作台可写且已选择 1 至 100 项 | 商品工作台 | 选择批量状态动作 | “批量操作”→“批量改状态/批量归档” | 当前列表的 itemRef/code/version | 打开 BPR-01 确认态 | 零项时入口不可执行；取消保持列表不变 |
| 2 | BPR-01 确认态 | BPR-01 | 核对目标状态和数量 | 目标状态、归档警告、取消、执行 | 无新增 readback | 进入 submitting | 表单未满足不提交 |
| 3 | 正在提交 | BPR-01 | 等待权威结果 | “正在处理，请稍候…”；关闭和重复提交禁用 | `batchTransitionOperationsCatalogItemStatus` | 进入全成功或部分失败结果态 | request-level typed problem 进入整体失败态；未知结果不伪造逐项项 |
| 4A | 所有项成功 | BPR-01 | 确认完成 | “批量操作完成”“成功 N 项，失败 0 项”“关闭” | N 条 `SUCCEEDED` 与新版本 | 关闭并保留刷新后的当前列表位置 | 刷新失败不改写批量结果，页面单独提示可刷新 |
| 4B | 至少一项失败 | BPR-01 | 找出失败商品和原因 | 汇总；仅失败项表格：商品编码、失败原因；“关闭” | 每项权威 code/outcome/problemCode/reason/version | 关闭；成功项已刷新，失败项保持原状态 | 不自动重试；用户按原因处理后重新选择 |
| 4C | 请求整体未执行 | BPR-01 | 理解为何没有开始 | “批量操作未执行”及 typed problem detail；“取消/重试执行” | request-level typed problem | 修正前提后重试或取消 | 不显示伪造的成功/失败数量 |

## 3. v2 对应页面盘点

| screen id | 对应关系 | all-v2 Heritage path@SHA-256 | 静态基线 / 摹本标注 | 差异及原因 |
| --- | --- | --- | --- | --- |
| BPR-01 | `NO_V2_COUNTERPART` | 在 `../catering-all-v2/apps` 与 `../catering-all-v2/libraries` 对“批量改状态/批量归档/批量操作/batchTransition/CatalogBatch”静态检索均为 0 命中 | `doc/plans/platform/wireframes/2026-08-22-v2s-backend-performance-batch-outcome.svg`；基线来自当前 v2s `CatalogWorkbenchPage.tsx` 的既有 Modal | 保留当前 Modal、逐项汇总和同步流程；只把技术失败编码改为 owner 业务原因，并把成功/失败状态压缩为更适合最多 100 项的结果层级。原因：当前实现补全，而非新造页面 |

## 4. 低保真线框

### Screen: BPR-01 批量状态确认与结果 Modal

唯一视觉工件：`doc/plans/platform/wireframes/2026-08-22-v2s-backend-performance-batch-outcome.svg`。左侧为确认态；右侧为最需要证伪的部分失败结果态。全成功态退化为右侧摘要且不显示失败表格；请求整体失败态沿用确认面显示 typed problem，不显示逐项汇总。

#### Surface ownership 自检

| screen id | 声明 UI_SURFACE | 线框可见元素分母 | 每项是否属于当前 surface | USER_VISIBLE_COPY 可见项是否全有位置 | 结论 |
| --- | --- | --- | --- | --- | --- |
| BPR-01 | Modal | 标题、数量说明、目标状态、归档提示、取消、执行、提交态、结果摘要、失败项表格、关闭、整体失败提示 | 是；商品列表与全局 shell 不画入 Modal | 是 | PASS |

### 4.1 表单控件依赖图

| 用户可见控件 | 控件形态/搜索方式 | owner 候选或初始值来源 | 上游依赖与可用条件 | 变更后的级联清理/重载 | 可选项约束 | loading/empty/failed | 提交时 owner 再核验 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 目标状态 | 固定 Select | catalog 生命周期固定词表 | 仅“批量改状态”确认态出现；已有选择项才可执行 | 改变值只替换本次 targetStatus，不改选择集合 | 本批只呈现启用、停用；归档用独立危险动作 | submitting 禁用；无候选不适用 | owner 对每项当前状态、版本、依赖与写能力复核 |

`SEARCH_CAPABILITY_DENOMINATOR=BPR-01:NOT_APPLICABLE_WITH_REASON`：本 Journey 不寻找或选择增长型业务对象；商品集合来自用户在宿主列表的既有选择，目标状态是固定完整词表，结果表只展示本次 receipt，不新增搜索或客户端筛选。

### 4.2 mutation 字段事实矩阵

`FORM_MUTATION_DENOMINATOR=2`：`STATUS` 与 `ARCHIVE` 两个真实 command variant。

| 业务字段或 command 事实 | 用户可见文案/控件 | 分类 | 原始业务来源 | request 取值与唯一来源 | 变更、级联与校验 | command owner 最终复核 | 冲突/失败恢复 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| dataNodeRef | 不显示 | `HIDDEN_OWNER_FACT` | Journey 前提链 | 当前 operations scope 的 opaque ref | scope 改变即关闭 Modal 并清空选择 | resolver + owner scope | 请求级 typed problem |
| targetStatus（STATUS） | “目标状态”Select | `EDITABLE` | Journey §2 | 用户选择 `ENABLED/DISABLED` | submitting 后锁定 | owner 生命周期规则 | 逐项失败保留 owner reason |
| targetStatus（ARCHIVE） | “将归档 N 个商品” | `FIXED_READONLY` | Journey §4 | 固定 `ARCHIVED` | 不可改写 | owner 生命周期规则 | 逐项失败保留 owner reason |
| items[].itemRef | 不显示 | `HIDDEN_OWNER_FACT` | 当前列表选择 | 选中行最新 readback | 1..100、不得重复 | owner 范围与身份 | 整体 validation problem |
| items[].expectedVersion | 不显示 | `HIDDEN_OWNER_FACT` | 当前列表选择 | 选中行最新 version | 与 itemRef 成对，不由浏览器递增 | owner CAS | 对应项 `FAILED`，reason 可见 |
| Idempotency-Key | 不显示 | `HIDDEN_OWNER_FACT` | frontend standard §3-G | `createContentIdempotencyKey(operationId, body)` | 同一业务意图稳定；意图改变重算 | receipt owner | mismatch 走整体 typed problem |

结果集合不是可编辑从属集合：顺序和分母严格等于请求 `items`；用户不能增删、排序或改写结果。部分失败态只在视觉上过滤显示失败项，完整 receipt 仍由前端保留用于分母、刷新与自动化断言。

## 5. 状态与边界表

| 屏幕/动作 | initial/loading | validation | submitting | success | conflict/denied | timeout/unknown | owner/face 边界 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| BPR-01/确认 | 显示选择数量与目标状态 | 选择项 1..100；STATUS 有目标状态 | 控件、关闭和重复执行均锁定，显示处理中 | 切换到结果态，不自动关闭 | 请求级失败显示“批量操作未执行”；逐项拒绝进入结果态 | 不生成逐项结果，保留 Modal 并提示刷新后再决定是否重试 | operations-admin 仅组装当前选择；catalog owner 终判 |
| BPR-01/结果 | 只消费本次 receipt | 结果数、顺序、identity 必须与请求一致，否则作为协议错误 | N/A | 全成功只显示摘要；部分失败显示失败表格 | reason 原样显示，problemCode 只用于诊断/自动化 | 结果已返回后刷新失败不改写 receipt | owner 产生 outcome/reason/version；前端不得根据 status code 推导 |

## 6. 逐操作任务合理性

| 操作 | 批准 Journey 来源 | 用户为何此时操作 | 是否有更短路径 | 不选替代的理由 | 约束归因（产品/owner/contract/旧文档） | Dexter 裁决是否必要 |
| --- | --- | --- | --- | --- | --- | --- |
| 选择“批量改状态” | Journey §4 | 为已选商品设置同一启用/停用状态 | 否 | 列表行内逐项点击更慢且看不到批次结果 | 产品 + 现有 UI | 否 |
| 选择“批量归档” | Journey §4 | 对已选商品执行明确危险动作 | 否 | 与普通状态 Select 混合会弱化危险提示 | 产品 + 现有 UI | 否 |
| 取消 | Journey §4 | 不执行本次意图 | 是 | 关闭即取消是最短路径 | Modal lifecycle | 否 |
| 执行 | Journey §2 | 提交一次权威批量命令 | 否 | 逐项浏览器请求不能提供一个 receipt，也无法安全证明完整分母 | owner/contract | 否 |
| 关闭结果 | Journey §2 | 看完结果后返回当前列表 | 是 | 自动关闭会让部分失败原因瞬间消失 | 产品 | 否 |
| `SKIPPED` | Journey §5、§7 | 当前没有可执行用户动作或业务条件 | N/A | 不画入口、不画结果；逐项尽力继续处理剩余项 | Dexter 已裁定不进入本批 contract | 否 |

## 7. Face / owner 对齐矩阵

| 屏幕/动作 | consumer face | 页面准入 | server operation | owner readback / command | 不可由前端替代的判定 |
| --- | --- | --- | --- | --- | --- |
| BPR-01/执行状态或归档 | operations-admin | 商品工作台准入 + 当前写能力 | `batchTransitionOperationsCatalogItemStatus` | catalog owner batch command + ordered receipt | 当前 scope、每项身份/版本/状态/依赖、逐项事务结果、失败原因 |
| BPR-01/关闭后刷新 | operations-admin | 同上 | `getOperationsCatalogItems`; `getOperationsCatalogNavigation` | catalog owner task read | 最新状态、版本、导航计数；不能用本地 patch 冒充 readback |

## 8. Manifest B.4/B.5 命中对照

| manifest 条文 | 本 Journey 的命中或不适用理由 | 遵循方式 / 待 Dexter 裁决 | Heritage 原文（冻结路径@hash） |
| --- | --- | --- | --- |
| B.4 管理后台 runtime 与状态边界 | Modal overlay、单一 server fact、generated transport、提交锁和精确刷新均适用 | 复用 foundation；结果不镜像成第二个业务真相 | `doc/heritage/frozen/catering-all-v2/project-memory/decisions/admin-frontend-runtime-architecture-must-not-follow-journey-ids.md@7db367e97931fe2f1292e620e8364f667ed9663a5fbb1e09f6d48a03448f41c6` |
| B.5 批量状态结果 | all-v2 无对应业务 screen，不能继承旧交互 | 使用当前 v2s Modal 作为静态基线；逐项结果仅 `SUCCEEDED/FAILED` | `NO_V2_COUNTERPART`，检索范围与结果见 §3 |

## 9. 高保真静态 demo

`NOT_REQUIRED`：这是现有 Modal 的信息层级补全，不是新交互范式；低保真两态足以裁决。

## 10. Dexter 看图结论

- 看图日期：2026-08-22。
- 低保真线框结论：`ACCEPTED`。Dexter 回复“IA确认”。
- 高保真 demo 结论：`NOT_REQUIRED`。
- 修改意见/已接受的操作顺序：接受确认态→submitting→全成功/部分失败/整体未执行；接受只显示失败项明细；接受不引入 `SKIPPED`。
- 允许进入 implementation-facing design：是。
