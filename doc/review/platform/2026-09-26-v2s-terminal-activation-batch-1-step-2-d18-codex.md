# 批次一实施步骤 2 · D-18 对账记录

```text
STEP=IMPLEMENTATION_PLAN_STEP_2
SCOPE=D-18 store-terminal UI and create/edit form contracts
REVIEW_TARGET=STEP_RECONCILIATION
AUTHOR=MAIN_AGENT
STEP_STATUS=MATCHED
CURRENT_REVIEWER=/root/d18_step2_current
CURRENT_REVIEW_VERDICT=MATCHED
CURRENT_REVIEW_SCOPE=CURRENT_GENERATED_REQUEST_BYTES_AND_FOCUSED_PROOFS
```

## 目标与原文依据

需求 R-8.4 将终端设备类型定为创建后不可修改；V-U1 要求编辑态来自当前详情、只读显示，创建仍可选类型。门店终端 IA 的 TER-E01 与交互工件 D-18 overlay 已收敛为：编辑态只读 `Typography.Text`，不渲染输入/选择器/禁用选择器或解释文案；更新契约最终不含 `deviceType`，旧额外字段由 controller `strictBody` 拒绝且不改变配置与版本，不增 owner 专属错误码。对应源：

- `doc/plans/platform/2026-09-25-v2s-terminal-activation-and-connection-requirements-claude.md:274-277,896-902`
- `doc/plans/platform/2026-09-23-v2s-store-terminal-management-ia-codex.md:18-20,75-83`
- `doc/plans/platform/2026-09-23-v2s-store-terminal-management-ui-interaction-design-codex.md:3-5,369,397-412`
- `doc/plans/platform/2026-09-24-v2s-store-terminal-management-implementation-design-codex.md:5-7,445,459`
- `doc/plans/platform/2026-09-24-v2s-store-terminal-management-implementation-plan-codex.md:5-7,33,53`
- `doc/platform/frontend-coding-standard.md` §3-K；`project-memory/practices/drawer-form-lifecycle.md`；`project-memory/practices/frontend-capability-lookup.md`；`project-memory/practices/ui-visible-business-language-and-dynamic-aggregate-layout.md`
- Current implementation details and this step's exact execution boundary are recorded in `doc/plans/platform/2026-09-26-v2s-terminal-activation-and-connection-implementation-plan-codex.md:25` and detailed design `:368-369`.

## 六维路由与逐点双读留痕

编辑前与实现后均重新执行了以下六维 memory 路由，并逐项重开命中项与 owning source；每次路由都返回 6 个 kernel。前端路由返回 30 项（6 kernel + 24 routed）；后端 owner 路由返回 10 项（6 kernel + 4 routed），相对前端路由新增的唯一项为 `project-memory/practices/backend-capability-lookup.md`。

```bash
scripts/memory/query --task-kind implementation --domain admin-ui --consumer-face operations-admin --owner frontend-platform --impact architecture --trigger implementation
scripts/memory/query --task-kind implementation --domain backend --consumer-face operations-admin --owner backend --impact owner --trigger implementation
```

两次回读的 source set：

```text
project-memory/decisions/confirmed-business-language-corpus.md
project-memory/decisions/http-crud-efficiency-design-redlines.md
project-memory/decisions/owner-read-model-and-lifecycle-standard.md
project-memory/kernel/01-workspace-and-authorization.md
project-memory/kernel/02-service-shape-and-owner.md
project-memory/kernel/03-transaction-data-and-dependencies.md
project-memory/kernel/04-contract-consumer-and-admin.md
project-memory/kernel/05-evidence-runtime-and-git.md
project-memory/kernel/06-heritage-and-change.md
project-memory/operations/business-corpus-adoption-and-read-policy.md
project-memory/operations/implementation-source-reread-discipline.md
project-memory/pitfalls/browser-route-data-scope-drift.md
project-memory/pitfalls/catalog-code-rule-invention.md
project-memory/pitfalls/designing-from-conversation-not-system.md
project-memory/pitfalls/invisible-dimension-drifts-at-implementation.md
project-memory/pitfalls/owner-boundary-reverse-inference.md
project-memory/practices/backend-acceptance-route-fixture-oracle-integrity.md
project-memory/practices/business-channel-list-scope-and-validity-display.md
project-memory/practices/cache-invalidation-granularity.md
project-memory/practices/collection-boundary-modes.md
project-memory/practices/content-tab-unified-refresh-lifecycle.md
project-memory/practices/drawer-form-lifecycle.md
project-memory/practices/external-collaboration-readback-display-and-detail-surface.md
project-memory/practices/failure-condition-names-the-wrong-shape.md
project-memory/practices/frontend-capability-lookup.md
project-memory/practices/ordering-only-for-consumer-facing.md
project-memory/practices/read-model-granularity.md
project-memory/practices/set-interaction-not-n-times-single.md
project-memory/practices/ui-visible-business-language-and-dynamic-aggregate-layout.md
project-memory/practices/detail-drawer-action-menu.md
project-memory/practices/backend-capability-lookup.md
```

## 实施选择与当前边界

- 将创建/编辑提交值拆为 `StoreTerminalCreateFormValues` 与 `StoreTerminalEditFormValues`；二者共享 configuration shape。Ant Design 子编辑器使用 editor-only `StoreTerminalFormValues`，不得把它直接作为写命令类型。
- 创建态 `deviceType` 控件留在 `StoreTerminalDeviceTypeField`；编辑态从 `editor.terminal.deviceType` 显示 `Typography.Text`，不放进 edit Form store。函数候选同样从 owner detail 的设备类型读取。
- `replaceStoreTerminal` 接收 edit values，content-idempotency 投影不含设备类型。当前 OpenAPI replacement schema、生成 Java/TypeScript DTO 与更新 body 均不含 `deviceType`；controller `strictBody` 只允许 `name`、`configuration`、`expectedVersion`，seed 更新请求也不带该字段。不得在 consumer 中从 owner detail 再补设备类型。
- `terminalDraftMatchesFormValues` 不再把设备类型当可编辑 draft 比较，并对缺失/畸形 printers/functions 数组 fail closed。
- 复用既有 `adminWideDrawerSurfaceProps` 与 `useDrawerFormLifecycle`，没有新建 foundation 能力。

## 首败与当前 focused proof

首败保留：

1. 第一轮操作类型检查报新 create/edit FormInstance 泛型在共享 Ant Design 组件的路径推导不成立，并揭示生成的 replace 请求仍要求 `deviceType`。
2. 第一轮 focused tests 有 5 项失败：畸形 edit draft 被当作空集合；命令测试的 foundation mock 漏了原有 `LIFECYCLE_LABELS`；3 个静态 trace 仍检查旧 Drawer 位置与旧 callback/幂等表达式。

主 agent 按 owning source 修正为共享编辑器 Form store + 独立提交类型；增加缺失数组校验；局部 mock 保留真实模块导出；静态断言移至新的字段组件和独立 create/edit Form。随后按当前字节复验：

| Proof                                                                                                  | 结果                     | 证据                                                                                          |
| ------------------------------------------------------------------------------------------------------ | ------------------------ | --------------------------------------------------------------------------------------------- |
| `yarn format:check`                                                                                    | PASS                     | 2026-09-26 20:21 KST，所有格式匹配                                                            |
| `yarn workspace @catering-v2s/operations-admin typecheck`                                              | PASS                     | 2026-09-26 20:22 KST，exit 0                                                                  |
| focused Vitest：模型、命令、只读字段 render、aggregate submit、页面静态 trace、L2 action-node 静态绑定 | PASS，6 files / 44 tests | 2026-09-26 20:22 KST，exit 0；`StoreTerminalFormSubmit` 有既有 react-test-renderer / act 警告 |
| DEV / backend-acceptance / TDS / L2 / reset / seed                                                     | NOT_RUN                  | 本步骤不启动受管运行                                                                          |

以上是本步前后双读与验证证据，不是批次整体对账或整批 GO。

## Fresh 独立步骤级三维对账

- Earlier reviewer：`/root/step2_d18_reconcile`（fresh、只读，当时 verdict `MATCHED`）。该次审查在 R5 materialize/codegen 更新 replacement DTO 之前完成；其“生成 request 暂需 `deviceType`”陈述只适用于当时字节，不能代表当前状态。
- Earlier scope: 该次对账核对了需求 R-8.4/V-U1、IA/交互 TER-E01、当时详设/计划 Step 2、model/drawer/command/render test、`drawer-form-lifecycle` 与前端规范。
- Earlier limits: 不是整批对账、整批 `GO`、浏览器 L2 或后端 strictBody 的 PASS；当时生成契约的 `deviceType` 暂存字段由后续 owning codegen 正确移除。

## Current-byte refresh · 2026-09-26

- Reviewer：`/root/d18_step2_current`（fresh、只读、当前字节）；`STEP_RECONCILIATION=MATCHED`。
- 独立核对覆盖：需求 R-8.4/V-U1 与已取代的旧门店终端需求 D-36；IA/交互 TER-E01；详设与当前计划；model/form/drawer/command；OpenAPI schema、生成 Java/TS DTO、controller strict-body 闭集、seed 更新调用；command、真实 render markup 与页面静态 trace。
- Current focused proof 由主 agent 执行并记录：command test 1/1；`StoreTerminalPage.static.test.ts` 14/14；operations-admin typecheck exit 0；`yarn format:check` PASS。Reviewer 没有重新运行测试、脚本、生成器、构建或动态环境。
- Current verdict 仅证明 D-18 Step 2 与当前源码/生成物一致；旧 review 的契约暂存描述已被上面当前字节覆盖。后端真实 HTTP strict-body/no-write、L2 与整批对账仍留在计划后续步骤，不由此 MATCHED 推导为 PASS。
