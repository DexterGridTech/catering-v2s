---
title: 后台性能整改批量商品状态结果 Journey 裁决
status: DEXTER_ACCEPTED
createdAt: 2026-08-22
decisionOwner: Dexter
programId: V2S_W0_W4_EXECUTION
implementationAuthority: false
---

# Journey 裁决：J-BPR-001 看清批量商品状态处理结果

<a id="backend-performance-batch-outcome-journey"></a>

## 1. 裁决元数据

```text
JOURNEY_ID=J-BPR-001
STATUS=DEXTER_ACCEPTED
SKILL_USED=cs-spec-to-plan@3f223891a0d93ce08a8c84829822d220399e0cdcb46153edac6d4b101613e6b4
DECISION_OWNER=Dexter
UI_BEARING=true
CORPUS_VERSION=project-memory/decisions/confirmed-business-language-corpus.md#G-05,#G-11
```

本文把已确认需求 B-03 至 B-05 落成 Journey 候选，并以当前 owning source 为准修正一处漂移：
当前 owner、contract 与 Modal 已经按请求顺序返回并展示逐项 `itemRef/ok/failureCode/version`、成功数和
失败数，不是“完全没有逐项报告”；真实缺口是响应没有权威商品编码、明确 outcome 与可直接展示的
业务原因，界面只能显示技术失败编码。该 finding 状态为 `PARTIALLY_CONFIRMED`。

## 2. 用户任务与成功结果

- **Actor**：总部或门店的商品资料维护者。
- **此刻任务**：用户在运营管理后台商品工作台选择多个商品，批量启用、停用或归档；部分商品可能因版本冲突、生命周期依赖或其他 owner 规则失败，用户需要立即知道哪些已成功、哪些未成功以及为什么。
- **成功结果**：
  1. 每个请求项都有且只有一个按请求顺序返回的结果，商品编码可识别；
  2. 独立成功项已经提交，独立失败项没有被伪装成整批失败；
  3. 界面显示“成功 N 项、失败 M 项”，并只在存在失败时列出失败商品与 owner 返回的业务原因；
  4. 成功后当前商品列表与分类/状态计数读回最新事实；失败项可由用户按原因修正后重新选择，不自动重试；
  5. 请求整体在执行前因授权、范围、请求形状或幂等冲突被拒时，显示整体 typed problem，不伪造逐项结果。
- **失败后仍成立的事实**：已成功项不回滚；失败项不留下成功状态或成功审计；浏览器不根据 HTTP 状态、旧列表或异常文本猜测结果，不显示 raw exception。

## 3. 逐 actor 前提链

| 前提 | 对谁 | 需要什么事实 | 来源类型（三选一） | 产生/确认位置 | 来源证据（文件+锚点） | 未满足时的行为 |
| --- | --- | --- | --- | --- | --- | --- |
| 身份 | 商品资料维护者 | 当前集团空间内已登录的运营账号 | `ESTABLISHED_SOURCE` | workspace IAM 会话 | `project-memory/decisions/confirmed-business-language-corpus.md#G-05` | 不进入商品工作台，不返回商品数据。 |
| 访问资格 | 商品资料维护者 | 当前数据节点可读，且具备该范围商品写能力 | `ESTABLISHED_SOURCE` | 页面准入、scope resolver、catalog owner command | `project-memory/decisions/confirmed-business-language-corpus.md#G-05A` | 无写能力不出现可执行批量入口；篡改请求由服务端拒绝。 |
| 入口数据 | 商品资料维护者 | 当前列表页上已选择 1 至 100 个可批量处理商品及各自最新版本 | `ESTABLISHED_SOURCE` | catalog list readback 与当前选择 | `apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogWorkbenchPage.tsx#const runBatchAction = useCallback` | 零项不提交；版本冲突只使对应项失败。 |
| 结果事实 | 商品资料维护者 | 与请求项一一对应的权威商品编码、结果、版本、失败编码与业务原因 | `IN_SCOPE_PRODUCED` | catalog owner 逐项事务与 batch receipt | `apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogOwnerService.java#private CatalogOwnerApi.CatalogItemBatchStatusTransitionReadback executeBatchStatusWithReceipt(` | 缺项、重复项或顺序漂移视为契约缺陷；不得由前端补齐为成功。 |
| 刷新事实 | 商品资料维护者 | 当前页商品状态与导航计数的最新 readback | `ESTABLISHED_SOURCE` | catalog item page 与 navigation task read | `apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogWorkbenchPage.tsx#const refresh = useCallback(() => {` | 结果 Modal 保留；刷新失败单独提示，不能改变已返回的批量结果。 |

本 Journey 不用 seed、默认账号或 fixture 替代 actor 前提。

## 4. 任务边界、非目标与禁推

- **范围内动作**：商品工作台选择多项；打开批量状态/归档 Modal；确认目标状态；提交；查看成功/失败汇总和失败商品原因；关闭结果并读回列表。
- **非目标**：改变批量改分类/标签的业务语义；整批原子；自动修复失败项；自动重试；增加批量任务中心、导出或后台异步队列；让用户查看 DB 预算、事务或诊断 section。
- **禁推**：HTTP 200 不等于每项成功；一项失败不等于后续项跳过；技术 `problemCode` 不等于用户文案；当前列表里的商品编码不能替代 receipt 的权威身份；页面可选不替代 owner 的版本、状态、范围与生命周期复核。
- **禁止伪修复**：不把部分失败改成整体 4xx/5xx；不吞掉失败原因；不展示 raw exception；不以 fallback 合成缺失结果；不为降连接数把逐项事务改成整批事务。

## 5. Corpus 命中与冲突

| 术语/关系 | 现行 corpus 来源 | 本 Journey 如何使用 | 冲突/未知 | Dexter 裁决是否必要 |
| --- | --- | --- | --- | --- |
| 运营用户、实时任职与写能力 | `project-memory/decisions/confirmed-business-language-corpus.md#G-05,#G-05A` | operations-admin 承载商品维护任务，owner 终判范围和写能力。 | 无。 | 否 |
| 商品与生命周期 | `project-memory/decisions/confirmed-business-language-corpus.md#G-11` | 商品编码是用户识别项；状态变化是 catalog owner 事实。 | 无。 | 否 |
| 逐项尽力 | 已确认需求 §5.8 B-03 至 B-05 | 每项独立事务，失败不回滚已成功项且继续尝试其余项。 | 需求同时列出 `SKIPPED`，但当前实现和“继续尝试其余项”没有可执行的 skipped 条件。 | **是：见 §7。** |

## 6. UI 适用性与后续工件

`UI_BEARING=true`。只有界面把部分成功与失败商品、原因和刷新边界呈现给用户，逐项尽力才是完整的用户任务，而不只是内部事务形态。

对应交互候选为 `doc/decisions/2026-08-22-v2s-backend-performance-batch-outcome-ui-interaction.md`，低保真图为 `doc/plans/platform/wireframes/2026-08-22-v2s-backend-performance-batch-outcome.svg`。Dexter 看图并裁定 §7 前，不进入 IA 或 implementation-facing design。

## 7. Dexter 裁决

- **裁决**：接受。Dexter 于 2026-08-22 回复“IA确认”，接受本 Journey、低保真交互与下述 outcome 收敛。
- **精确范围**：operations-admin 商品工作台的批量状态与批量归档结果；保留当前逐项尽力和同步 Modal。
- **已知前提**：所有合法请求项继续逐项尝试；当前源码只有成功/失败，没有跳过分支。
- **未决项**：无。`SKIPPED` 不进入本批 contract；逐项 outcome 只保留 `SUCCEEDED | FAILED`，请求级前置失败仍走整体 typed problem。
- **后续允许动作**：继续 IA、implementation-facing design 与 serial plan；仍不授权实施或运行。
