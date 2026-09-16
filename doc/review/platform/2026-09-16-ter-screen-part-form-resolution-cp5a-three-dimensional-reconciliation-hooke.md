# TER screenPart 机型解析 · CP-5a 步骤级三维对账

```text
REVIEW_TARGET=STEP_RECONCILIATION
REVIEW_SCOPE=CP-5a / B-1 / R-10b,R-12,R-13,R-14 partial
REVIEWER_KIND=INDEPENDENT_SUBAGENT
REVIEWER=Hooke
REVIEWER_ID=01a0a981-c570-77d2-b6ba-fbd542fa0104
TESTS_RUN=NO; read-only reconciliation
VERDICT=MATCHED
```

## 结论

CP-5a 当前源码与需求、详设/IA、实施计划及 terminal 标准匹配。此前两份 CP-5a
对账记录发现的提前版式/a11y scope drift 与 hook fallback owner 已在当前字节中修复；
本记录不把 focused 结果当作独立对账的替代。

## 三维核验

- 需求 R-10/R-14 要求四个 admin key 形成普通 `Laptop`/`Mobile` renderer、保持
  `partKey`/`layerId`/`testID`、共享一个不读取或分支 `surfaceForm` 的 hook，并由 form
  component 决定 selected fallback：
  `doc/plans/platform/2026-09-16-ter-screen-part-form-resolution-requirements-claude.md`。
- implementation design §12.7、D-8、D-9 将 B-1 限定为组件分化与 raw selection hook，
  将 full layout、a11y/public surface 留给 B-2/B-3：
  `doc/plans/platform/2026-09-16-ter-screen-part-form-resolution-implementation-design-codex.md`。
- implementation plan B-1/B-2/B-3 与步骤级三维对账纪律保持同一边界：
  `doc/plans/platform/2026-09-16-ter-screen-part-form-resolution-implementation-plan-codex.md`。
- TR-14 的普通 basename review-only 约束适用于当前 component 文件，未引入 Metro
  platform resolver：`doc/platform/terminal-coding-standard.md`。

## 当前源码事实

- `apps/terminal/ui/base/admin-shell/src/parts/parts.ts` 的四个 admin key 各有两个
  sibling，分别绑定不同的 `Laptop`/`Mobile` component identity；`parts.test.ts` 锁住 8
  条、form 不相交、rendererKey/component 唯一及归一化语义字段一致。
- `apps/terminal/ui/base/admin-shell/src/hooks/useAdminSections.ts` 只保存 raw
  `requestedPartKey`，不在 hook 中选择首项、不读取/分支 `surfaceForm`。
- `AdminShellLaptop.tsx:5-17` 与 `AdminShellMobile.tsx:5-17` 各自实现有效选择或首项
  fallback，并把结果交给包内 `AdminShellFrame`；fallback 没有回到 hook 或共享纯函数。
- `AdminLayer.tsx:23-75` 的内部 frame 保留认证态、关闭 command、卸载清理与 focus
  scope；公共 `AdminLayer` 仍为零参数，`index.ts` 未导出 form-specific renderer 或
  private frame。
- `AdminShellFrame.tsx:65-87` 当前仍是旧 `layout="card"`/`layout="content"` 结构；
  `LayerStack.tsx` 的旧 center/padding 仍待 B-2，故 B-2 full layout 未提前落入 CP-5a。
- `adminIdentity.ts` 与 `adminTestIds.ts` 的 identity/testID source 未漂移。

## 反例核验

未发现以下反例：hook 读取 `surfaceForm`；公共 `AdminLayer`/`AdminShell` 增加 prop；
form-specific renderer 泄漏到 public surface；fallback 由 hook 承担；partKey/layerId/
testID 漂移；B-2 full layout 或 B-3 a11y/public-surface 改动提前实现。

## 证据边界

本次独立对账不运行 test/build/runtime/device/Web/Metro/Android/DEV/seed/UAT/deploy，
也不采信 evidence 自报数字。CP-5a focused/typecheck 结果在
`doc/evidence/platform/2026-09-16-ter-screen-part-form-resolution-cp5a-execution-codex.md`；
B-2/B-3、动态与视觉证据仍由后续步骤承担。
