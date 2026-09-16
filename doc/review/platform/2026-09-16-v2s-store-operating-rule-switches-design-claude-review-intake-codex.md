# 门店经营规则开关 · Claude DESIGN review finding intake 与修订记录

REVIEW_TARGET=DESIGN  
REVIEW_CHANNEL=CODEX_CLAUDE  
REVIEW_CYCLE_ID=2026-09-16-store-operating-rule-switches-design  
REVIEW_ROUND=N  
reviewerKind=CLAUDE_EXTERNAL_REVIEW  
AUTHOR_INTAKE=MAIN_AGENT  
SOURCE_REVIEW_VERDICT=NO-GO  
SOURCE_REVIEW_M_S_N=1/2/2  
AUTHORIZATION=document writing + read-only source inspection  
EXECUTION_THIS_TURN=NO_PRODUCTION_CODE; NO_CODEGEN; NO_BUILD; NO_TEST; NO_RUNTIME

## 1. 处置原则

本记录只记录经 Dexter 中转的 Claude 当前字节静态 DESIGN review 的 intake 与修订，不改写 Claude 原始 verdict，也不把作者处置当作独立 review 结论。所有 finding 先重开 owning source、当前详设与相关 IA/interaction/Journey，再按 `CONFIRMED`、`PARTIALLY_CONFIRMED`、`REJECTED_WITH_EVIDENCE`、`UNVERIFIED_REQUIRES_EVIDENCE` 或 `DEXTER_DECISION` 处置；本轮五条均确认成立，已在文档授权内修订。

## 2. Finding 处置

| ID | 当前判定 | 当前根因与证据 | 文档修订 | 最小性判断 |
| --- | --- | --- | --- | --- |
| M-01 | `CONFIRMED`；仓内事实 | 旧方案把三个 consumer host 指向从 session ambient Store 派生的 profile；`getOperationsStoreProfile` 的契约没有 selected Store 参数。既有显式详情 operation 在 `contracts/openapi/paths/operations-admin/store-management.paths.json:530-622` 声明 `storeId`，`OperationsStoreManagementController.detail` 在 `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/organization/OperationsStoreManagementController.java:206-215` 接收该标识，`scopedReadStore` 在同文件 `:283-287` 通过 `resolveSelectedProjectScope` 复核。 | Journey、IA、interaction、详设 §4.2/§7.2/§8/§11、计划 P0/P5/P6/P9 统一为 `getOperationsOrganizationStore` 显式 Store detail；`storeId=queryContext.scopeRef`；GROUP/REGION/PROJECT 以祖先路径可读，STORE 仅自身；历史 profile 调用者不在本批。 | 复用已有 owner detail operation，不新增 endpoint、缓存事实或权限模型；只改本批三个 host 的事实住址，避免扩大历史 profile 调用者范围。 |
| S-01 | `CONFIRMED`；仓内事实/契约边界 | strict generated values schema 的 root/unknown/missing/type 形态可在 owner 前被 schema/Jackson 拒绝，不能统一承诺业务 422 和首项聚焦。 | 详设 §3.3、IA §4/§7/§8、interaction §3.3/§10、计划 P2/P9 明确：schema/binding 结构错误返回既有 400、显示既有契约反馈且不承诺聚焦；schema 通过后 owner 语义/声明不变量错误才返回 `ORGANIZATION_STORE_OPERATING_RULES_INVALID` 422；仅在 problem 带 rule key 时聚焦首项；parent false + child true 合法。 | 保留 `additionalProperties=false` 与 12-key required 的严格契约，不增加 relaxed schema 或重复校验层；只把拒绝归属和 UI 承诺写清。 |
| S-02 | `CONFIRMED`；仓内事实/需求与详设不一致 | 需求闭集为 BOOLEAN/NUMBER/STRING，NUMBER 默认 0 且当前无实例；旧详设/计划只覆盖 BOOLEAN/STRING。 | 详设 §3.1-§3.2、计划 P1 明确三成员闭集、默认值 `false/0/空字符串`、当前 11 BOOLEAN + 1 STRING + 0 NUMBER，并加入 NUMBER 类型/默认值不匹配与合法生成覆盖要求；当前 wire 仍只生成实际 12 个键。 | 仅补齐生成器声明和验证 oracle，不提前增加 NUMBER 实例、页面控件或数据库字段。 |
| N-01 | `CONFIRMED`；仓内事实/算术核对 | 两个新错误码加入后，disposition closure 应从 77/77/155 变为 79/79/157。 | 计划 P2 文件清单和完成判据点名 `doc/plans/platform/2026-07-26-v2s-r5-error-code-disposition-catalog.json` 的三个 closure 字段，要求实现后实测复核 `79/79/157`。当前不改 catalog，因为实施未获授权。 | 只补遗漏的闭环计数与复核，不提前生成错误码或修改运行源码。 |
| N-02 | `CONFIRMED`；架构/回归风险 | P3 同时改 audit-model、common wire、organization 四类生产者/读者和两个 app reader，属于共享契约变更；仅写 Store 正向判据不足以保护既有审计行。 | 计划 P3 完成判据增加既有审计 JSON/行可读取、固定字段标签、历史分页/读取授权与四类实体生产者/读者无回归。 | 不收窄到 Store，也不增加第二审计模型；只把共享契约回归要求提升为显式完成门。 |

## 3. 额外一致性修订

需求正本 §4.6 原有“4 份拷贝”与 §4.3 的“至少 11 处、仅 3 处受生成链保护”不一致。本轮将其改为“多个不受生成链保护的位置存在人工同步负担”，不再引入一个与当前枚举冲突的快照数字。该修订不改变业务范围、12 项树或本轮 mapping。

## 4. 未改变的事实与边界

- mapping 仍以 `contracts/registry/operation-handler-bindings.json` 的 source hash `13d8477b5fb813485072fa14fae9cbaedb502d28078ef129837de5af05d7ee57` 为正本；269、88、33、3、52、181 的既有分类未修改。
- 本批三个 host 只改为消费显式 Store detail；不改既有 `getOperationsStoreProfile` 的其他历史调用者。
- 12 项仍为 11 个 BOOLEAN + 1 个 STRING，两个根，最大深度四层；NUMBER 只是闭集预声明，当前实例为零。
- 本轮没有生产代码、契约生成物、migration、seed、测试、构建、reset、DEV、backend acceptance、browser L2、UAT 或 deploy。

## 5. 本记录状态

修订后的文档已可供 Claude 重新从当前字节独立审查；本记录不是 GO，也不替代后续 Claude verdict。当前仍为 `DESIGN_REVIEW_PENDING`，实施授权仍为 `false`。
