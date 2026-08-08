# 双后台名称（编号）视觉密度实施独立复核（Round 1）

REVIEW_TARGET=IMPLEMENTATION
REVIEW_CYCLE_ID=DUAL-ADMIN-NAME-CODE-DENSITY-20260805
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
ROUND_FINAL_DECISION=NOT_APPLICABLE
reviewerKind=INDEPENDENT_SUBAGENT

## 盲审声明

Fresh v2s-rooted independent subagent review。先独立读取生产源码、foundation、checker 和可执行结果，
以“找出实现为什么不成立”为立场形成 findings，之后才读取 focused proof 与 review input；未依赖作者口头说明。

## 用户任务

业务用户在双后台组织树、列表、详情 Drawer、下拉、审计标题和范围栏中阅读实体时，需要名称为主信息、编号可核对但视觉弱化，且名称/编号顺序与缺失值语义稳定。

## Dexter 立场

Dexter 要求复用 shared foundation、一次性覆盖两个独立后台、分钟级静态验证，不扩展 owner、契约、数据库、runtime、DEV/UAT、seed/reset 或业务语义。

## 替代方案

全局 CSS 或每页复制 span 改动表面更少，但依赖主题上下文、复制样式且允许新页面漂移，因此不选；foundation 的两个纯展示组件是更小且可审计的共享方案。

## 方案合理性

`NameCodeText` 保持名称主层级、编号使用 `var(--ant-font-size-sm)` 与 `var(--ant-color-text-tertiary)`；`NameCodePathText` 保持 `CODE name` 输入并输出名称在前。缺失值保留 `—`/单值语义。未发现 owner 绕行、后台合并或业务过度设计；checker 防回归判别力另见 S-01。

## UI 与交互

APPLICABLE：用户明确要求名称/编号视觉层级一致性，本包覆盖 Tree、ProTable/Table、Descriptions、Drawer、Tag、Select、Modal、audit title 和 data-scope context bar；不改变操作路径、权限或反馈语义。

## 最小输入与 hash

```text
AGENTS.md 4d64bfb2bb435326a13c2ccb7955dbbbef621259030693e64db3cbf6a0bd9fda
CLAUDE.md 8b12b36e0c852f3a55f40f29d3d21101b9acb113b969ff5f8a9c2152c2aec50f
PLATFORM-BLUEPRINT.md 3b90bd602eb682c4718d6c51f399501c34f804cddd96da82d59495e60b115a8d
doc/decisions/2026-08-05-v2s-dual-admin-name-code-density-standard.md c217590920af5c2a7d186aa1997ab9ddb46c7f3da926616dfd7cc5fe92a7add8
doc/plans/platform/2026-08-05-v2s-dual-admin-name-code-density-implementation-design.md 43ac46822747f24cf3a2ba6d7ab8e148193d79922756d5478e052dda790b8cb7
doc/review/platform/2026-08-05-v2s-dual-admin-name-code-density-focused-proof.json b6792544ce98874cb41ab9464e44c8556aedfc9ec310bf6f6695c0fae44d8be7
doc/review/platform/2026-08-05-v2s-dual-admin-name-code-density-independent-review-input.md 7f02c47c37888987789e6c60a66ab9b751ed5513c122c81a22434932b737c3a5
libraries/frontend/admin-ui-foundation/src/presentation/nameCode.ts 4913b9604c6c4810c339000c2ed16c764fe130be7792fab07b639d97f99f79dd
libraries/frontend/admin-ui-foundation/src/index.ts 9083452a13df699a7f9ec99b2ebf3c12c4b0736df5db03736ec5b6c5610eaf1e
scripts/check/name-code-density.mjs eeafe0f4d5d123ce7b73e134d392602ec6f51233f87236f8f89df09df99be314
```

`scripts/check/standards-coverage --phase R5` = `STANDARDS_COVERAGE=PASS`, `RULES=150`。已读取两后台全部生产 `.ts/.tsx` 与 foundation exports。

## 独立分母核验

独立扫描确认 `platform-admin=10 files/28 producer sites`、`operations-admin=21 files/49 producer sites`，合计 31 文件/77 producer sites；覆盖 Tree、ProTable/Table、Descriptions、Drawer、Tag、Select、Modal、audit title 与 data-scope context bar。无生产 app 直接调用 `formatNameCode`/`formatCodeNamePath`，无 `${name}(${code})` 命中；ReactNode consumer 通过 typecheck。

## Checker 与红变异

```text
node scripts/check/name-code-density.mjs --self-test
NAME_CODE_DENSITY_SELF_TEST=PASS
RED_LEGACY_FORMATTER=PASS
RED_HAND_BUILT_NAME_CODE=PASS
node scripts/check/name-code-density.mjs
NAME_CODE_DENSITY=PASS
LEGACY_FORMATTER_CALLS=0
HAND_BUILT_NAME_CODE=0
```

额外 scratch probe 显示当前 hand-built 正则对 `${name} (${code})`、`${name} / ${code}` 和相邻 JSX name/code span 均返回 no match，形成 S-01。

## Typecheck / tests

```text
foundation typecheck PASS (exit 0)
platform-admin typecheck PASS (exit 0)
operations-admin typecheck PASS (exit 0)
foundation test PASS (3 files / 18 tests)
platform-admin Vitest excluding architecture PASS (42 files / 51 tests)
operations-admin Vitest excluding architecture PASS (28 files / 76 tests)
```

平台 architecture baseline 失败不计入本包 Vitest；focused proof 已将其与 changed-surface Vitest 分开。

## 审查意见复核

本轮无既有 finding disposition；所有结论均重开源码、foundation、checker 和测试。S-01 为 `CONFIRMED`，N-01 为 `CONFIRMED`；最小修复优先于新增 runtime 或 AST 基建。

## Findings

### S-01 — checker 未保护声明的 77 个 component producer 分母

- 状态：`CONFIRMED`，Priority Significant。
- `scripts/check/name-code-density.mjs` 只扫描旧 formatter 和一种精确 `${name}(${code})` 模板，未计算或验证 `NameCodeText`/`NameCodePathText` producer；对 `${name} (${code})`、`${name} / ${code}`、相邻 JSX name/code span 均漏检。
- 当前 31 文件/77 producer 实现经独立扫描正确，但未来 plain JSX/其他分隔符可绕过 gate 并获得假绿，无法兑现“所有视觉组合必须走 foundation”规范。
- 最小方向：机械枚举 component producer，并增加至少一种 plain producer red mutation；或明确收窄标准到 legacy helper/精确模板。不要新增 runtime/wrapper。

### N-01 — review input 缺少裸 `REVIEW_ROUND=1`

- 状态：`CONFIRMED`。
- `doc/review/platform/2026-08-05-v2s-dual-admin-name-code-density-independent-review-input.md` 有 `REVIEW_ROUND_LIMIT=2` 但没有 `REVIEW_ROUND=1`；本报告自行声明完整字段，不影响本轮源码结论。
- 最小方向：Round 2 前补一行元数据，不改生产代码。

## 闭环核验

源码 31/77、全部声明 surfaces、foundation export、typechecks、Vitest、standards coverage、checker self-test 和当前 source scan 已独立核对。runtime/business/cleanup 不在本包授权内，也未宣称 PASS。

## 实施代码核验

已重开全部生产 `.ts/.tsx`、foundation component/export，执行编译 typecheck、foundation tests、双后台 Vitest 与 red probes，并复查业务用户行为边界；未执行 backend、contract、database、runtime、seed/reset 或 Git。

## 结论

当前 producer 实现正确，但 machine gate 的防回归能力不足以保护“所有视觉组合必须使用共享组件”的标准。

```text
NO-GO | M=0 / S=1 / N=1
VERDICT=NO_GO
```

Round 2 仅可在 S-01 定向修复与 N-01 元数据修复后进行；cycle 最多两轮，禁止第三轮。

## Authorization boundary

本 verdict 仅覆盖双后台名称/编号展示、foundation presentation 组件、consumer replacements、checker 与静态测试证据；不授权 backend、OpenAPI/generated wire、database/migration、DEV/UAT、HTTP/L2、runtime、seed/reset 或 Git。

