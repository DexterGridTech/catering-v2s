# Round 1 finding intake：到店点餐允许外部接入 implementation-facing 详设

```text
REVIEW_TARGET=DESIGN
REVIEW_CYCLE_ID=BC-20260910-DINE-IN-EXTERNAL-IMPLEMENTATION-DESIGN
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
AUTHOR_INTAKE=AFTER_INDEPENDENT_VERDICT
IMPLEMENTATION_AUTHORITY=false
RUNTIME_EXECUTION=NOT_RUN
```

## 处置原则

Round 1 原始报告见 `doc/review/platform/2026-09-10-v2s-business-channel-dine-in-external-access-implementation-design-independent-review-round1-codex.md`。以下是主 agent 在重新读取 reviewer 指定 owning source、当前设计和现有闭集语义后的处置，不改写 reviewer 原始 verdict。

## M-01：provider descriptor 未达到可执行级

- 独立状态：`CONFIRMED`；最小修复已完成，等待 Round 2 定向复核。
- 修复：固定 checked-in profile 为 `STORE_OWNED_MINI_PROGRAM` / `STORE_OWNED_MINI_PROGRAM_DINE_IN`；system capability 与 provider scope 均为 `DINE_IN`；bindable node 只为 `STORE`；`authenticationKind=EXTERNAL_GRANT`；`unbindKind=LOCAL_ONLY`；system/provider `catalogStatus=PLANNED`；workspace provider enablement 由既有 owner command 设为 `ENABLED`。
- 依据：这些取值都来自当前既有闭集，`EXTERNAL_GRANT + LOCAL_ONLY` 已有 external provider 形态；`PLANNED` 按既有设计只是目录信息，不是候选硬门；不新增认证、解绑、adapter 或外部菜单语义。
- 边界：该 profile 是本平台“门店自有点单小程序”类别的 checked-in 配置身份，不声称瑞幸或任何具体第三方已有网络 adapter；D-04 的完整闭包只覆盖本平台 catalog、enablement、候选、模板/渠道、binding、readback 与销售菜单隔离。
- 已同步：Journey amendment、implementation design、implementation plan；seed/acceptance 计划要求精确 provider、enablement 和 readback。

## S-01：UI/contract label 来源不唯一

- 独立状态：`CONFIRMED`；最小修复已完成，等待 Round 2 定向复核。
- 修复：contract 继续提供 machine code 与现有 displayName；operations-admin 既有 `collaborationCodeLabels.ts` 是唯一业务 code label map，本批只在其中补 `DINE_IN`，由 generated type 与 `closedCodeLabel` 约束；不新增 `businessScopeDisplayNames` 或第二份字典。
- 已同步：implementation design、IA amendment、UI interaction design、implementation plan。

## S-02：正向 acceptance provider 写成 null

- 独立状态：`CONFIRMED`；最小修复已完成，等待 Round 2 定向复核。
- 修复：正向场景明确 `providerCode=STORE_OWNED_MINI_PROGRAM_DINE_IN`、`dineInForm=null`；新增 provider 缺失负向场景，要求 typed failure 与 no-write/readback。

## 未改变的边界

- 外部 DINE_IN 不显示、不选择、不提交 POS/QR/KIOSK；只由 DINE_IN provider capability 表达。
- D-02 只允许 STORE；PROJECT external DINE_IN 仍 typed reject 且 no-write。
- O5 通用门店渠道读取包含外部 DINE_IN；SALES_MENU 读取与 direct qualification 仍只认 STORE + INTERNAL + DINE_IN/TAKEAWAY。
- 本轮及修复期间未修改生产代码、contract、migration、test、seed；未执行 DEV、reset、seed、backend acceptance、browser L2 或 UAT。
