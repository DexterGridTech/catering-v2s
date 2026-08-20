REVIEW_CYCLE_ID=EXTERNAL_COLLABORATION_DESIGN_2026_08_19
REVIEW_TARGET=DESIGN
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
reviewerInputChecklist=doc/review/platform/2026-08-19-v2s-external-collaboration-and-business-channel-design-review-round-1-input-checklist.md
blindReviewDeclaration=HONORED
authorIntakeStatus=REPAIRING_FOR_ROUND_2

# Round 1 author intake

本 intake 在 fresh 独立 reviewer 返回完整 verdict 后编写。它逐条重开了规格、详设、串行计划、foundation、generator、acceptance 标准/catalog 与受管 seed executor；不把 reviewer 结论直接当作事实。

## 结论

Round 1 verdict：`NO-GO · M=3 · S=2 · N=3`；同一 review cycle 的 Round 2 必须定向复核以下修复，不能换文件名或换 reviewer 重置轮次。Round 1 reviewer 未修改文件、未执行 runtime/seed/L2/UAT/Git。

## Findings intake

| finding | intake | evidence/reasoning | action |
| --- | --- | --- | --- |
| F-M-001 descriptor fields | `CONFIRMED` | 冻结规格要求 `fieldKey/label/helpText/controlKind/optionSourceRef`；详设错误地把 `value` 当 descriptor 字段，并将 readonly kind 放宽为 primitive。foundation renderer 的 value 是独立输入，不替代 descriptor。 | 详设改为 `attributeDictionary` 五字段 + capability `attributeValues` read values；补 option-source/readonly red fixture。 |
| F-M-002 provider catalogStatus | `CONFIRMED` | 规格 §5.4 明确 provider profile 必有 `catalogStatus`；现详设 provider shape 缺失，但 readback 与 E-33 又要求 provider-level 状态。 | provider contract/read model/readback 补 `catalogStatus`，E-33 同时断言 system/provider 两级，仍不作为 gate。 |
| F-M-003 cross-owner command | `CONFIRMED` | 详设同时声明无 cascade command，又列 `cascadeDisableByExternalReference`；事务矩阵还引用未声明的 `markBindingDeleted`/`disableEnablement`。这是 owner API/edge matrix 的真实字面量冲突。 | 删除 cascade 命令；统一为已声明的 collaboration status/request-or-delete command，加 edge-only 的 `returnChannelToDraftAfterBindingDeletion` 与 `applyExternalStopReason` owner transition；不冻结 C-01。 |
| F-S-001 seed executor boundary | `CONFIRMED` | 受管组合 runner 当前固定 `[owner-command,catalog-inventory]`，详设只写 plan 没有 executor/父 manifest/report stage。用户授权包含本域 plan/executor implementation，但本轮不执行 seed。 | 详设/串行计划接入既有 complete seed runner，新增本域 stage、child manifest/report、business/cleanup/first-failure 汇总。 |
| F-S-002 operations mapping | `CONFIRMED` for design completeness; runtime behavior remains `UNVERIFIED_REQUIRES_EVIDENCE` | 当前详设只有聚合 operation table；既有 generator/manifest/OperationsOwnerScopeGrant 要求 requirement/resolver/owner recheck/typed problem/red fixture/context version。当前 generator key pattern 也不接受 `BC_PROJECT_EDIT`/`BC_STORE_EDIT`。 | 增加逐 operation source-of-truth 表；改成 `BC-BUSINESS-CHANNEL-PROJECT-EDIT` 与 `BC-BUSINESS-CHANNEL-STORE-EDIT`；显式要求 server-minted `expectedContextVersion` 和 grant extension。Round 2 只验证设计字段完整，实施期再用 generated/static proof 验证行为。 |
| F-N-001 serial acceptance owner | `CONFIRMED` | 当前 serial CP-08 仍把 contract validation 写成 `CatalogAcceptanceScenarios.java`，与详设已修复的 N-1 互相矛盾。 | 改为 CP-01 contract validator；两个新增 domain 文件只承接 14 条真实 HTTP business scenarios。 |
| F-N-002 typed problem count | `CONFIRMED` | 15 个 code 表已包含 `VERSION_CONFLICT`，IA 完成行却写成 `15 + VERSION_CONFLICT`，会被理解为 16。 | 改成 `15 total, including VERSION_CONFLICT`。 |
| F-N-003 input integrity/screen denominator | `CONFIRMED` | 复算得到 roadmap/source record 两个实际 hash，清单旧；IA 为 P1-P6/O1-O5 共 11 屏，清单写 10；active standard 还只列 5 个 group 而 catalog 已有 7 个。 | 刷新两个 hash、改 11 屏，并同步 active standard 到当前 7 个 plus 本批 2 个 domain group；重跑 checklist hash。 |

## Accepted no-finding set

Exact literals、G-10 platform route、E-33 PLANNED semantics、六项 C 与 `EXTERNAL_GRANT` nullable create、34 BR/BR-33 空号、双 app/face、platform capability boundary、两 operations writes、foundation reuse、58 projected acceptance count、无 provider shell/SPI/registry、真实 catalog-readback 方向、敏感字段/CAS/logging/cleanup 约束均未发现需要改变模型的 finding。

## Round 2 scope

Round 2 只验证上述修复后的字面量、source mapping、seed parent-stage 接入、acceptance domain placement、hash/分母与 accepted no-finding set；不新增第三轮，不将 Claude review 替代 independent round。
