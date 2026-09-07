# v2s 销售菜单目标选择与细粒度沽清 fresh independent DESIGN review

```text
REVIEW_CYCLE_ID=R5-SM-TARGET-SELECTION-AVAILABILITY-DESIGN-20260907
REVIEW_TARGET=DESIGN
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
blindDeclaration=FRESH_READ_ONLY_PRE_AUTHOR_INTAKE
ROUND_FINAL_DECISION=SELF_DECIDED
```

## 1. 输入与边界

独立审查者仅只读重开当前仓库字节、原始需求、Journey、IA/交互/implementation-facing 详设、实施计划、相关标准和 owning source；未执行生产实现、契约生成、Flyway、DEV、reset/reseed、backend acceptance、browser L2、UAT 或 deployment。作者会话不代写本 verdict。

输入清单：

- `doc/decisions/2026-09-07-v2s-sales-menu-target-selection-availability-journey-amendment.md`
- `doc/plans/platform/2026-09-07-v2s-sales-menu-target-selection-availability-requirements-amendment.md`
- `doc/plans/platform/2026-09-07-v2s-sales-menu-target-selection-availability-interaction-design-codex.md`
- `doc/plans/platform/2026-09-07-v2s-sales-menu-target-selection-availability-implementation-design-codex.md`
- `doc/plans/platform/2026-09-07-v2s-sales-menu-target-selection-availability-implementation-plan-codex.md`
- `doc/plans/platform/2026-08-31-v2s-sales-menu-information-architecture-codex.md`
- `doc/decisions/templates/ia-design-template.md`
- `doc/decisions/templates/ui-interaction-design-template.md`
- `doc/platform/frontend-coding-standard.md`
- `doc/platform/foundation-charter.md`
- `doc/platform/review-standard.md`
- `doc/decisions/2026-07-25-v2s-independent-subagent-adversarial-review-governance.md`
- `apps/backend/catering-business-server/modules/sales-menu/src/main/java/com/catering/v2s/salesmenu/application/SalesMenuOwnerService.java`
- `apps/backend/catering-business-server/modules/sales-menu/src/main/java/com/catering/v2s/salesmenu/api/SalesMenuReadback.java`
- `contracts/openapi-source/sales-menu.schemas.json`
- `apps/frontend/operations-admin/src/features/sales-menu/ui/SalesMenuItemEditorDrawer.tsx`
- `apps/frontend/operations-admin/src/features/sales-menu/ui/SalesMenuPage.tsx`
- `apps/frontend/operations-admin/src/features/sales-menu/salesMenuTestIds.ts`

## 2. Round 1 independent verdict

```text
VERDICT=NO-GO
M=1
S=2
N=2
L1_ENGINEERING=FAIL: M-01/S-01/S-02
L2_USER_VISIBLE=FAIL: IA gap + operation record target semantics
L3_UNVERIFIED=backend acceptance/browser L2/DEV/reset/reseed/UAT not run
SAME_ROOT_SCAN=PASS: no same-date IA/information-architecture amendment found before author repair
```

### M-01 — 缺少本 Journey 的 IA 修订

`IMPLEMENTATION_DESIGN` 原先将 interaction 工件作为 `IA_REF`，没有覆盖 IA 模板要求的不可见维度、错误映射和 IA↔交互↔详设交叉对账。没有这些观察句，stale sole SKU、target tree 数据来源、失败刷新和权限拦截会在实现期被发明。

处置：作者新增 `doc/plans/platform/2026-09-07-v2s-sales-menu-target-selection-availability-ia-amendment.md`，覆盖四个受影响 IA-ID 的可见/不可见维度、错误映射、forbidden UI 和交叉对账，并把 implementation design 的 `IA_REF` 指向该工件。

### S-01 — option definition exact-set 未锁定

requirements 已要求每个当前 Catalog definition 都有 entry、optional 显式空数组合法、required 至少一个值，但原 implementation design/验收没有锁定 missing/extra/duplicate definition 的 owner 行为。可反例是只提交 required definition 而省略 optional definition，导致 snapshot 无法区分显式零选择和未快照。

处置：requirements、IA、implementation design、implementation plan 均新增 exact-set 判定和反例要求：DIRECT 的 definitionRef 集合必须与 Catalog 当前集合 exact 相等；optional 只有显式空数组才写 0-value group snapshot；缺失/额外/重复均 typed reject，无 child partial write。

### S-02 — operation record 缺少 child target 可解释身份

原 readback/contract 只有 `targetRef`。同一 published item 下 SKU 与 option value 的历史操作无法仅凭当前 snapshot 稳定解释，尤其 publish 清理 child current 后会失去反查依据。

处置：requirements、IA、implementation design、implementation plan 将 operation record/readback 的 `targetKind` 与脱敏 resolved target display snapshot 固定为同一 target identity 的审计字段；后续实现必须同步 contract、owner、migration、edge、frontend 和 acceptance，不新增平行 operation。

### N-01 — UI surface 未逐项声明 foundation primitive

Drawer 与 status Modal 的 surface contract 原先没有逐屏 `FOUNDATION_PRIMITIVE`。

处置：interaction 工件补齐：Drawer 使用 `adminWideDrawerSurfaceProps`、`useDrawerFormLifecycle`、`testId`；Modal 使用 `useSubmissionLifecycle`、`useOverlayLock`、`testId`；实现时必须有对应 import/消费。

### N-02 — testId review 状态与 OPEN 分母冲突

`TESTID_REVIEW=READY_FOR_IMPLEMENTATION` 与同节 action 全部 `OPEN`、L2 blocked 互相矛盾。

处置：改为 `TESTID_DESIGN_DENOMINATOR=READY`、`TESTID_IMPLEMENTATION_REVIEW=OPEN`；实现并完成 focused/static proof 前继续保持 `L2_SCRIPT_ADMISSION=BLOCKED`。

## 3. Author intake boundary

以上 finding 均为 `CONFIRMED` 或 `PARTIALLY_CONFIRMED`，不引入新的产品/Journey/权限裁决，也不扩大 Catalog admittedShapes、TDP、deployment 或 UAT 范围。作者在 round 1 verdict 后只修改设计输入，不修改生产代码；待 round 2 定向核验确认上述修订闭合后，才可按 Dexter 已给出的实现授权进入 CP-00。

## 4. Round 2 independent verdict

```text
REVIEW_CYCLE_ID=R5-SM-TARGET-SELECTION-AVAILABILITY-DESIGN-20260907
REVIEW_TARGET=DESIGN
REVIEW_ROUND=2
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
blindDeclaration=FRESH_CURRENT_BYTE_TARGETED_RECHECK
ROUND_FINAL_DECISION=SELF_DECIDED
VERDICT=NO-GO
M/S/N=0/1/0
```

Round 2 对 round 1 修订逐项重读：M-01 IA amendment、S-02 operation target identity、N-01 foundation primitive、N-02 testId denominator 均以当前字节证据关闭。S-01 的 owner exact-set、optional explicit empty、required minimum 已关闭，但验收矩阵仍未把三个 definition exact-set red mutation 写成独立 HTTP 输入，故保留一个 `S-01` partial finding；未执行动态验证继续归入 `L3_UNVERIFIED`，不是本轮设计 finding。

作者处置：该缺口不需要新的产品、Journey 或权限决策；按 `SELF_DECIDED` 规则在 implementation design 与 plan 中补入 `missing-definition`、`extra-definition`、`duplicate-definition` 的真实 HTTP request、typed reject 和 no-write oracle。不得召集第三轮；补丁完成后，实施入口记录为 `ROUND_2_COMPLETE_NO_GO_AUTHOR_REPAIRED`，并保留 reviewer 的原始 `NO-GO`，不将其改写为 reviewer `GO`。
