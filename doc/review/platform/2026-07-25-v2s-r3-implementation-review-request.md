REVIEW_KIND=IMPLEMENTATION
REVIEW_TARGET=IMPLEMENTATION
REVIEW_SCOPE=R3-WHOLE-IMPLEMENTATION
REVIEW_CYCLE_ID=R3-C01-IMPLEMENTATION-20260725
CODEX_SELF_REVIEW=doc/review/platform/2026-07-25-v2s-r3-implementation-codex-self-review-round-2.md

## 背景

R3 implementation 已按 Dexter 接受的 C-01 与 R3-TECH 全范围详设完成。C-01 是唯一业务 Journey：受部署期外部受控前提约束的 platform-admin 访问既有集团空间，查看列表/详情，输入独立商业集团编码和名称初始化，并取得 owner readback。`operations-admin` 在 R3 只证明独立 app 的静态边界，不证明真实登录、session 或运营业务。

本轮还落实了 backend 的并列 App 物理结构：`apps/backend/catering-business-server` 是 R3 当前唯一业务 deployable；`apps/backend/terminal-data-server` 是未来 TDP 的空占位，不含 runtime、endpoint、database、migration、generated wire、seed 或业务代码。C-01 三份 all-v2 对应源文件已按源哈希冻结并登记为 Heritage 31 项分母的一部分。

本次结构修订进一步按 all-v2 对齐：仓根 `settings.gradle.kts` / `build.gradle.kts` 统一声明 `:apps:backend:*` 与 `:libraries:backend:*`，`apps/backend` 仅保留两个并列 App，不再是独立 Gradle 根。三个共享 backend owner library 位于仓根 `libraries/backend/{platform-access,platform-workspace,organization}`。该迁移只改变工程根与共享库物理归属；C-01 行为、契约、数据库、两个 App 边界和 TDP 排除范围均保持不变。最新 fresh walking skeleton run 为 `20260725T074601Z-69293`，business 与 cleanup 均 PASS。

按 Dexter 要求，v2 的 `libraries/frontend/admin-ui-foundation` 已原样复制到 v2s 的 `libraries/frontend/admin-ui-foundation`，共 16 个文件、双侧 hash 一致；它当前只是未接入的 shared foundation inventory，不被两个 App import，不改变 R3 静态边界，也不作为 C-01 业务行为证据。后续是否接入由新的真实消费者与 focused evidence 决定。

## 评审目标

请在 R3 全部实现完成后，一次性独立核验真实生产源码、契约、数据库迁移、双 app 边界、测试、evidence 和 fresh walking skeleton 是否共同证明已批准的 R3 全范围（R3-C01 + R3-TECH），重点确认：

- backend 并列 App 结构没有把未来 TDP 偷带入 R3，也没有把 shared modules 误当成第二业务 deployable；
- owner command、同事务写入、单 PostgreSQL/单 Flyway history、RLS/审计/幂等和 typed Problem 语义闭环；
- OpenAPI、server route face registry、platform-admin generated wire 与 operations-admin empty receipt 字节一致；
- platform-admin 页面操作严格是 list → detail → 独立编码/名称初始化 → owner readback；operations-admin 没有业务 endpoint、登录或 session 假闭环；
- runner 的 positive/negative 结果与 business/cleanup 分账可信，测试证据没有用 mock-only 结果冒充真实链路。

## 需阅读文件

- `doc/plans/platform/2026-07-25-v2s-r3-whole-scope-implementation-design.md`：已接受 R3 全范围详设与 U02-U07 实施分母；
- `doc/platform/README.md`、`doc/platform/active-document-index.json`、`doc/platform/roadmap-program-registry.json`：仓内规范入口、active document 导航与 program resolver；
- `doc/decisions/2026-07-25-v2s-roadmap-r-unit-atomic-delivery-rule.md`：每个 R 一次性设计、实施、整体复核的交付规则；
- `doc/decisions/2026-07-25-v2s-frontend-foundation-consumption-rule.md`：后续 UI 功能必须优先消费 shared foundation 的规范；
- `doc/review/platform/2026-07-25-v2s-r3-whole-scope-design-granularity-manifest.json`：批准的粒度、Part B/C/D 对照入口；
- `doc/review/platform/2026-07-25-v2s-r3-whole-scope-design-review-claude.md`：设计期独立评审结论；
- `doc/review/platform/2026-07-25-v2s-r3-whole-scope-design-n-fix-recheck-claude.md`：设计期 N 修订复核；
- `doc/review/platform/2026-07-25-v2s-r3-whole-scope-manifest-chapter-hit-map.md`：章节级命中对照；
- `contracts/policy/standards-coverage-matrix.json`：R3 standards coverage 分母；
- `settings.gradle.kts`、`build.gradle.kts`、`apps/backend/catering-business-server/**`、`apps/backend/terminal-data-server/**`：对齐 all-v2 的仓根 Gradle 多项目与并列 App 运行边界；
- `libraries/backend/platform-access/**`、`libraries/backend/platform-workspace/**`、`libraries/backend/organization/**`：edge context、task read、owner command；
- `libraries/frontend/admin-ui-foundation/**`：已复制的未接入 shared foundation inventory；请核对双侧 hash、无两个 App import、不得把它当作 R3 Journey 实现证明；
- `apps/backend/catering-business-server/src/main/resources/db/migration/V20260725_170000_000__r3_platform_workspace_and_organization.sql`：单 migration、schema、RLS、FK、audit、idempotency；
- `contracts/openapi/**`、`scripts/generate/r3-edge-codegen.mjs`、`apps/backend/catering-business-server/src/main/resources/generated/**`、`apps/frontend/*/src/app/api/generated/**`：契约与生成闭环；
- `apps/frontend/platform-admin/**`、`apps/frontend/operations-admin/**`、`tools/r3-frontend-boundaries/cli.mjs`：双前端行为与静态边界；
- `scripts/run/r3-walking-skeleton`、`doc/evidence/platform/r3-u02-skeleton-evidence.json`、`doc/evidence/platform/r3-u03-contract-codegen-evidence.json`、`doc/evidence/platform/r3-u04-backend-owner-migration-evidence.json`、`doc/evidence/platform/r3-u05-u06-frontend-boundary-evidence.json`、`doc/evidence/platform/r3-u07-testing-walking-skeleton-evidence.json`：可复跑命令与 evidence；
- `doc/heritage/registry.json`、`doc/heritage/required-inventory.json`、`doc/heritage/frozen/catering-all-v2/apps/frontend/platform-admin/src/features/workspace-management/ui/**`：三份 C-01 源原文冻结与双侧哈希证据；
- `doc/review/platform/2026-07-25-v2s-r3-implementation-codex-self-review-round-2.md`：Codex implementation 第二轮定向自审与最终自决。

## 独立核验重点

请从仓根执行并独立解释结果：

- `scripts/check/standards-coverage --phase R3`、`scripts/check/heritage-registry`、`scripts/check/code-layout`；
- `scripts/check/r3-edge-codegen`、`scripts/check/r3-contract-face --post-gate-0`、`scripts/check/r3-production-conformity --post-gate-0`、`scripts/check/r3-flyway-layout --post-gate-0`；
- `scripts/check/module-dependency-registry`、`scripts/check/r3-frontend-boundaries`；
- `gradle --offline clean test bootJar --no-daemon`；
- `npm test --prefix apps/frontend/platform-admin`、`npm test --prefix apps/frontend/operations-admin` 及两个 app 的 build；
- `.runtime/r3/20260725T074601Z-69293/run-manifest.json`：`business=PASS`、`cleanup=PASS`，并对应 positive/negative HTTP 结果。

请特别主动寻找反例：TDP placeholder 是否被误启动、operations-admin 是否存在隐性业务请求、初始化是否允许同一空间多商业集团、同 idempotency key 不同 payload 是否被错误重放、缺失/伪造 edge context 是否能进入 controller、Heritage frozen bytes 是否与源仓漂移。

## 期望结论

请给出明确 `GO` 或 `NO-GO`。如有问题，请按 `M` / `S` / `N` 标注精确文件与行号、影响面、最小修复建议，以及是否需要 Dexter 产品或范围裁决；请不要把未来 TDP 或 R3-J02/C-02 恢复建议当作本轮实现要求。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请在 R3 全部实现完成后，对 catering-v2s 的 R3 全范围 implementation 做一次统一的 fresh 独立复核。

背景：R3 已按 Dexter 接受的 C-01 与 R3-TECH 全范围详设完成实现与证据。C-01 只证明 platform-admin 在部署期外部受控身份和既有集团空间前提下，执行 list → detail → 输入独立商业集团编码/名称 → initialize → owner readback；operations-admin 只证明独立静态边界。backend 物理上是并列的 apps/backend/catering-business-server（R3 当前唯一业务 deployable）与 apps/backend/terminal-data-server（未来 TDP 空占位，R3 不含 runtime/endpoint/database/migration/generated wire/seed/业务代码）。

目标：请一次性核验 R3 全范围（R3-C01 + R3-TECH）的真实源码、OpenAPI/codegen、owner/事务/migration、双 app 边界、Heritage 冻结、测试、evidence 和 fresh walking skeleton；C-01 是 R3 唯一业务 Journey，但不是本次单独复核范围，必须与 R3-TECH 及 U01-U07 一起判断。重点寻找 TDP 越界、operations 假闭环、owner/幂等/权限负向遗漏、generated drift、Heritage hash drift 和 business/cleanup evidence 误报。

请从 catering-v2s 仓库根阅读：
- doc/plans/platform/2026-07-25-v2s-r3-whole-scope-implementation-design.md：已接受详设与 U02-U07 分母；
- doc/review/platform/2026-07-25-v2s-r3-whole-scope-design-granularity-manifest.json：批准粒度与 Part B/C/D 对照；
- doc/review/platform/2026-07-25-v2s-r3-whole-scope-design-review-claude.md、doc/review/platform/2026-07-25-v2s-r3-whole-scope-manifest-chapter-hit-map.md：设计期独立 review 与章节命中；
- settings.gradle.kts、build.gradle.kts、apps/backend/catering-business-server/**、apps/backend/terminal-data-server/**：仓根 Gradle 多项目、并列 App 与 TDP placeholder 边界；
- libraries/backend/{platform-access,platform-workspace,organization}/** 与 apps/backend/catering-business-server/src/main/resources/db/migration/V20260725_170000_000__r3_platform_workspace_and_organization.sql：edge、owner、事务、schema、RLS、audit、idempotency；
- libraries/frontend/admin-ui-foundation/**：按 v2 原样复制的 16 文件 shared foundation inventory；请核对双侧 hash 且确认两个 App 当前均未 import，不把它当作 R3 业务闭环；
- contracts/openapi/**、scripts/generate/r3-edge-codegen.mjs、apps/frontend/{platform-admin,operations-admin}/**：契约、生成闭环与双前端行为；
- doc/heritage/{registry.json,required-inventory.json}、doc/heritage/frozen/catering-all-v2/apps/frontend/platform-admin/src/features/workspace-management/ui/**：C-01 Heritage 原文冻结及双侧哈希；
- scripts/run/r3-walking-skeleton、.runtime/r3/20260725T074601Z-69293/run-manifest.json、doc/evidence/platform/r3-u02-skeleton-evidence.json、doc/evidence/platform/r3-u03-contract-codegen-evidence.json、doc/evidence/platform/r3-u04-backend-owner-migration-evidence.json、doc/evidence/platform/r3-u05-u06-frontend-boundary-evidence.json、doc/evidence/platform/r3-u07-testing-walking-skeleton-evidence.json：可复跑命令和 evidence；
- doc/review/platform/2026-07-25-v2s-r3-implementation-codex-self-review-round-2.md：Codex implementation 第二轮定向自审。

请重点独立核验：scripts/check/standards-coverage --phase R3、scripts/check/heritage-registry、scripts/check/code-layout、scripts/check/r3-edge-codegen、scripts/check/r3-contract-face --post-gate-0、scripts/check/r3-production-conformity --post-gate-0、scripts/check/r3-flyway-layout --post-gate-0、scripts/check/module-dependency-registry、scripts/check/r3-frontend-boundaries、`gradle --offline clean test bootJar --no-daemon`，以及两个前端的 npm test/build。请确认仓根 Gradle project path 为 `:apps:backend:catering-business-server` / `:apps:backend:terminal-data-server` / `:libraries:backend:*`，并重新执行 fresh walking skeleton，核对 business=PASS 与 cleanup=PASS。请主动找反例，不要只复述 Codex 结论。

烦请针对 R3 全范围给出明确 GO 或 NO-GO；如有问题，请按 M / S / N 标注精确文件与行号、影响面、最小修复建议，以及是否需要 Dexter 产品或范围裁决。请不要恢复 R3-J02/C-02，不要把未来 TDP 做成 R3 实现要求。

授权边界：本次结论只决定已批准 R3 全范围（R3-C01 + R3-TECH）implementation 是否可进入最终接受；不授权新增 Journey、恢复 J02/C-02、实现 TDP 或改变 operations-admin 的 R3 静态边界。谢谢。
```
