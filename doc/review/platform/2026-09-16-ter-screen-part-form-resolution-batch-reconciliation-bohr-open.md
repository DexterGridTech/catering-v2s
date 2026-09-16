# TER screenPart B 批全范围三维对账：Bohr

```text
REVIEW_TARGET=WHOLE_BATCH_RECONCILIATION
REVIEWER_KIND=INDEPENDENT_SUBAGENT
REVIEWER=Bohr
AGENT_ID=01a0a9a4-1a3e-7dc1-bf5d-ccf87c6c64f6
VERDICT=OPEN
READ_ONLY=true
```

## 结论

B 批源码主体以及 B-2/B-3 的布局、可访问性、焦点、README 和公共面逐项对账为 `MATCHED`。B-1/U-12 仍为 `OPEN`：`useAdminSections` 的行为测试可能在加入 `surfaceForm` 分支后保持通过，现有证据只有“red mutation 已定义但未执行”，没有可复核的 AST 执行体与真实 RED/restored 记录。因此本次 B 批全范围不能收口为 `MATCHED`。

## 已核对为 MATCHED 的范围

- `apps/terminal/ui/base/admin-shell/src/hooks/useAdminSections.ts`：hook 接收已经投影的 catalog/context，当前源码未读取或分支 `surfaceForm`。
- `apps/terminal/ui/base/admin-shell/src/foundations/adminSectionSelection.ts`：本包局部选择闭包只转交 catalog/context。
- `apps/terminal/ui/base/admin-shell/src/parts/parts.ts`：四组 stable `partKey` 均有 laptop/mobile sibling，form 与 renderer key 不相交。
- `apps/terminal/ui/base/admin-shell/src/components/AdminShellFrame.tsx`、`AdminShell.tsx`、`AdminShellLaptop.tsx`、`AdminShellMobile.tsx`：shared root、laptop master-detail、mobile wrap 与 per-form fallback 的 owner 对齐详设。
- `apps/terminal/ui/base/render/src/components/LayerStack.tsx`、`apps/terminal/ui/base/admin-shell/test/adminLayout.test.ts`：旧全屏居中/padding 已移除，结构 focused proof 未冒充真实视觉。
- `apps/terminal/ui/base/admin-shell/src/components/AdminSectionNavigationLaptop.tsx`、`AdminSectionNavigation.tsx`、`apps/terminal/ui/base/primitives/src/components/PrimitiveForms.tsx`、`PrimitiveHeading.tsx`：button/tablist/tab/selected/header live-region 与当前 B-3 约束一致。
- `apps/terminal/ui/base/admin-shell/src/components/AdminLayer.tsx`、`apps/terminal/ui/base/render/src/components/LayerStack.tsx`、相关 integration/render focused tests：close/back/focus scope owner 未被重复实现。
- `apps/terminal/ui/base/admin-shell/src/index.ts`、`terminal-invariants.json`、`test/publicSurface.test.ts` 及 README：form-specific orchestration 未泄漏到公共面，示例可回源码核对。
- `doc/evidence/platform/2026-09-16-ter-screen-part-form-resolution-cp5a-execution-codex.md`、`cp5b-execution-codex.md`、`cp5c-execution-codex.md` 与 `hooke`/`planck`/`pascal` fresh 步骤记录：仅报告 static/focused，不冒充 native/Web/visual/device。

## OPEN finding：B-1/U-12 AST 与红变异

**来源与 owning source**

- 需求/详设要求 `useAdminSections` 及其本包局部依赖闭包不读取或分支 `surfaceForm`，并由 AST/focused 执行体承接：`doc/plans/platform/2026-09-16-ter-screen-part-form-resolution-implementation-plan-codex.md` 的 B-1、`doc/plans/platform/2026-09-16-ter-screen-part-form-resolution-implementation-design-codex.md` 的 D-8/U-12。
- owner：`apps/terminal/ui/base/admin-shell` / CP-5a B-1。

**证伪反例**

若在 `useAdminSections` 或本包局部 helper 中加入 `context.surfaceForm` 分支，但仍让当前行为 fixture 得到相同 selection，`apps/terminal/ui/base/admin-shell/test/adminSections.test.tsx` 的行为测试可能仍全绿；这会把 form 分支偷偷回流到 hook。

**现有证据缺口**

`doc/evidence/platform/2026-09-16-ter-screen-part-form-resolution-cp5a-execution-codex.md` 只记录 negative control “defined; not applied”，没有 AST 检查文件，也没有真实 production mutation 的 RED/restored 输出。

**最小修复**

新增 admin-shell 自有 focused/static AST test，遍历 `useAdminSections.ts` 及本包 local dependency closure，语义化拒绝 `surfaceForm` 的 property/element access、destructuring 或 executable identifier 使用；然后在生产 hook 中做一次会改变传递给 selector 的 form 选择的临时 mutation，运行 admin-shell owned test 记录 RED，恢复源码后再次运行并记录 restored PASS。跨包 helper 仍维持 review-only，不新建跨包 checker。

没有运行测试、构建或动态；native/Android/Web/visual/device 继续 OPEN。
