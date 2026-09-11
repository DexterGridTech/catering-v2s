# Independent subagent adversarial review input checklist（Round 2）

```text
REVIEW_TARGET=DESIGN
REVIEW_CYCLE_ID=BC-20260910-DINE-IN-EXTERNAL-IMPLEMENTATION-DESIGN
REVIEW_ROUND=2
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
ROUND_PURPOSE=定向核验 Round 1 M-01/S-01/S-02 修复
IMPLEMENTATION_AUTHORITY=false
RUNTIME_EXECUTION=NOT_RUN
ROUND_FINAL_DECISION=REQUIRED_FROM_REVIEWER
```

## 定向输入

Round 1 原始报告：

- `doc/review/platform/2026-09-10-v2s-business-channel-dine-in-external-access-implementation-design-independent-review-round1-codex.md`

作者处置：

- `doc/review/platform/2026-09-10-v2s-business-channel-dine-in-external-access-implementation-design-round1-author-intake-codex.md`

本轮修订后的当前材料：

- `doc/decisions/2026-09-10-v2s-business-channel-dine-in-external-access-journey-amendment.md`
- `doc/decisions/2026-09-10-v2s-business-channel-dine-in-external-access-ui-interaction-design-codex.md`
- `doc/decisions/2026-09-10-v2s-business-channel-dine-in-external-access-ia-amendment-codex.md`
- `doc/plans/platform/2026-09-10-v2s-business-channel-dine-in-external-access-implementation-design-codex.md`
- `doc/plans/platform/2026-09-10-v2s-business-channel-dine-in-external-access-implementation-plan-codex.md`

## 必须重新核验的 owning source

- `contracts/collaboration/external-platform-catalog.schema.json`
- `contracts/collaboration/external-platform-catalog.json`
- `contracts/openapi-source/collaboration.schemas.json`
- `apps/backend/catering-business-server/modules/collaboration/src/main/java/com/catering/v2s/collaboration/application/CheckedInCollaborationCatalogSource.java`
- `apps/backend/catering-business-server/modules/collaboration/src/main/java/com/catering/v2s/collaboration/application/CollaborationBindingPolicy.java`
- `apps/backend/catering-business-server/modules/collaboration/src/main/java/com/catering/v2s/collaboration/application/CollaborationOwnerService.java`
- `apps/frontend/operations-admin/src/features/business-channel/model/collaborationCodeLabels.ts`
- `apps/frontend/operations-admin/src/features/business-channel/ui/BusinessChannelTemplateDrawer.tsx`
- `apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/BusinessChannelAcceptanceScenarios.java`

## Round 2 只能回答的三个问题

1. M-01：固定的 provider descriptor 是否已经给出 schema/runtime 可接受的全部字段，并且 `EXTERNAL_GRANT + LOCAL_ONLY + PLANNED` 的解释没有偷偷引入新的 adapter、授权或菜单产品语义；D-04 的 platform closure 是否因此可执行。
2. S-01：label 是否只有现有 `collaborationCodeLabels.ts` 一个 UI code-map 来源，且没有要求不存在的 contract displayNames 或 raw enum 文案。
3. S-02：正向 acceptance 是否明确 provider code 与 `dineInForm=null`，provider 缺失是否独立覆盖 no-write。

## 不得改变的反例边界

- 外部 DINE_IN 不得出现 POS、QR、KIOSK；不得把 TAKEAWAY 当作 DINE_IN。
- 仅 STORE 可用；PROJECT external DINE_IN 必须 typed reject/no-write。
- 外部 DINE_IN 不得进入销售菜单候选或 direct qualification；O5 全渠道读取与 SALES_MENU 读取必须分开。
- 本轮只读，不写文件、不运行动态环境；不得把旧 cycle 的报告当作本 cycle 结论。

## 本轮输出格式

必须先以证伪立场读取当前字节，再输出：

```text
REVIEW_TARGET=DESIGN
REVIEW_CYCLE_ID=BC-20260910-DINE-IN-EXTERNAL-IMPLEMENTATION-DESIGN
REVIEW_ROUND=2
REVIEW_ROUND_LIMIT=2
ROUND_FINAL_DECISION=SELF_DECIDED
reviewerKind=INDEPENDENT_SUBAGENT
VERDICT=GO 或 NO-GO
M/S/N=x/y/z
EVIDENCE_TIER=STATIC_SOURCE_REVIEW_ONLY
RUNTIME_EXECUTION=NOT_RUN
```

若任何一个定向 finding 仍成立，必须给出精确路径、后果和最小修复；若全部闭合，明确说明已核验三项修复及保留的 POS/QR/KIOSK、STORE-only、SALES_MENU 隔离边界。
