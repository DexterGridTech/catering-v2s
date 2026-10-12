# TER 阶段 C · R4 review finding intake

日期：2026-10-11。输入：`doc/review/platform/2026-10-11-ter-version-update-stage-c-implementation-rereview-r4-claude.md`。本记录只处置 R4 的一项 S 与一项 N；不重写整批 Stage C verdict，不把既有或局部结果升级为修复后整批动态 PASS。

## R4-S-1 · 共享装配调用旧的 catalog context 签名

- **Disposition：`CONFIRMED`，已修复。**
- **判据与事实：** R4 引用 Stage C 详设 §8.5 的 PRIMARY/SECONDARY route context 判据。当前 `createCatalogContext(root, input)` 第二参数是对象 `{displayMode, surfaceForm, workspaceOverride?}`；旧调用把 displayMode 字符串传入，解构后丢失 displayMode 和 surfaceForm。
- **最小修正：** `apps/terminal/ui/base/integration-assembly/src/foundations/integrationAssembly.tsx` 现传入 `createCatalogContext(root, {displayMode, surfaceForm: input.surfaceForm})`。没有加 fallback 或新路由层。
- **反例与覆盖：** `test/terminalSurfaces.test.ts` 用真实共享 assembly 分别调用 PRIMARY 与 SECONDARY `createRouteContext`，断言 displayMode、workspace 和 instanceMode 有效。两套 sample integration 仍复用此共享 assembly，保持各自现有上下文接线。
- **同根处置：** `createCatalogContext` 其余使用点均按对象签名调用；render owner 与其测试不变。
- **局部证明：** `yarn workspace @catering-v2s/ui-base-integration-assembly test`：7 files / 21 tests PASS；同包 `typecheck` PASS。测试类型残余也已最小同步：`partSelection.test.ts` raw renderer binding 补 `placementScope: 'workspace'`；`runtimeOwner.test.ts` 收窄 `createSurface` 返回元素 props 类型；新增 route assertion 用窄 props 类型保留 `ReactNode` 以外的实际组件字段。
- **剩余：** 未运行 integration Expo Web、Android、设备或完整 Stage C 动态矩阵；这些保持原证据边界。

## R4-N-1 · 诊断标记把“找到”误写为计数

- **Disposition：`CONFIRMED`，已修复。**
- **判据与事实：** Stage C 详设要求报告读回诊断与实际观察相符。当前历史读取在命中目标后即停止，`currentTaskMatches=1` 不能证明全历史匹配数或唯一性。
- **最小修正：** `tools/terminal-automation/journeys/terminalUpdateSupplyUi.ts` 的最终诊断字段改为 `currentTaskFound=1`，与页级日志 `taskFound` 语义一致；不扫描全历史、不增加重复检测。
- **验证：** 对该日志字段作当前源码搜索确认只剩 `currentTaskFound=1`，不再有 `currentTaskMatches`；本轮未运行浏览器/Android Journey。
- **剩余：** 标记表达查找成功，不承担 CBS 唯一性证明。

## 差量状态与未执行范围

R4 所列两个 finding 均在当前源码差量关闭。未重跑 Stage C CP、6b、13c、六个历史 Web/设备 run、backend-acceptance、DEV 或全量 verify。历史归档的业务与 runner cleanup 状态保留原范围；Android diagnostics 与 backend-acceptance DEV 自动恢复问题仍按原文区分。当前定向证明仅覆盖上述生产/测试差量。

本次授权同时要求在阶段 C 差量闭合后立即进入远程控制实施，因此不把另一轮 Stage C 整批复评设为远控启动前置；后续远控 CP、6b、整体验收与交付审查仍按远控当前计划执行。

## 差量独立复核

- `REVIEW_TARGET=IMPLEMENTATION`
- `REVIEW_SCOPE=Stage C R4 两项差量修复`
- `VERDICT=GO`
- `M/S/N=0/0/0`
- fresh 只读 reviewer 确认共享装配的 PRIMARY/SECONDARY route context 调用已符合当前对象签名，测试覆盖对应真实装配；报告汇总标记已表达“找到目标”而非未测量的匹配数量。
- 该 verdict 只覆盖 R4 两项差量，不覆盖 Stage C 整批 CP/6b/13c，也不代表修复后 Web、设备或 backend 动态 PASS。复核未运行测试、构建或动态环境。
