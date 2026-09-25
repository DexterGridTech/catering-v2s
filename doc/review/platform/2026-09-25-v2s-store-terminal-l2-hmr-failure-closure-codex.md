---
title: 门店终端 Browser L2 HMR 首败根因与关闭记录
status: CLOSED
reviewTarget: L2_FAILURE_FAMILY_CLOSURE
reviewerKind: MAIN_AGENT
date: 2026-09-25
---

# 结论

当前首败不是门店终端业务提交或 Drawer 生命周期的产品缺陷，而是受管 Browser L2 默认以 Vite dev 模式启动本机前端。Playwright 交互期间 Vite 发生 HMR/page reload，React 页面被卸载，打开的创建抽屉消失，后续 Tab 操作在没有 Drawer 的列表页上失败。

该失败族已完成根因修复：受管新 L2 run 默认使用静态 `vite preview` 构建；显式传入 `R5_L2_FRONTEND_MODE=dev` 在 readiness 入口 fail closed。旧状态的兼容读取仍保留，避免把历史清理路径误当成新 run 配置。

# 首败证据

- run：`l2-1790339462638-12195-f1d357dc-ffb5-49e8-ab07-7d43bf704244`
- case：`terminal-create-configuration`
- 失败位置：`apps/frontend/operations-admin/src/tests/l2/store-terminal.spec.ts` 第 1170 行
- 首败：`PLAYWRIGHT_ASSERTION`，`TERMINAL_FORM_TAB_BASIC` 不可见；最终 DOM 已回到同一列表 URL且没有 Drawer。
- 关联日志：同 run 的 `browser-debug-events.jsonl` 记录 `BROWSER_HTTP_FAILED`/`net::ERR_ABORTED`；`operations-admin-vite.refresh-1.log` 在业务动作窗口记录 `page reload` 与 HMR 更新。
- 结果：`business=NOT_RUN`、`cleanup=PASS`；没有 POST，也没有把该次 focused diagnostic 升格为业务通过。

# 根因边界

源码生命周期核对未发现业务代码在该动作窗口主动执行 `setEditor(undefined)`；事件流也没有配置保存请求。失败发生在前端进程重载之后，因此修复运行器的托管前端模式，而不是在 Drawer 中增加等待、恢复状态或重试分支。

# 修复与证明

| 变更 | 位置 | 证明 |
|---|---|---|
| 新 L2 默认 preview | `scripts/test/browser-l2-runtime.mjs` 的 `requestedFrontendMode` | 受管运行不再以 dev server 承载业务交互 |
| 显式 dev fail closed | 同上 | `L2_FRONTEND_MODE_HMR_UNSAFE` 红例；避免调用方通过环境变量恢复 HMR 风险 |
| 构造的 readiness manifest 默认 preview | `scripts/test/browser-l2-runtime.mjs` 的 `buildReadinessManifest` | 未显式传模式时产物仍反映无 HMR 运行形态 |
| 运行器单元回归 | `scripts/test/browser-l2-runtime.test.mjs` | 默认值、显式 preview 和显式 dev 拒绝均有断言 |

根因修复后的 focused Browser L2 已在受管 run `l2-1790340943671-64696-0212c85e-267b-43eb-a821-0dc38f9b36d7` 完成：`BUSINESS=NOT_RUN`（诊断模式语义）、`CLEANUP=PASS`，场景 `terminal-create-configuration` 为 PASS。随后在当前最终字节上重新建立 full run `l2-1790341343348-75445-b94d229e-08df-4582-9627-26f2bb65a55a`，六场景 `BUSINESS=PASS`、`CLEANUP=PASS`，source binding 为 1,926 个文件；因此本失败族已关闭。focused run 的 cleanup 会将 runtime state 置为 `FINISHED`，不能续跑 full；之后重新 readiness 是 runner 的正确生命周期，不是业务重试。

准入记录由 fresh 独立 reviewer Erdos 复核为 PASS；失败族 red test 还覆盖了 `status=FAIL/business=NOT_RUN` 的 focused 诊断结果，refresh 状态级 red test 覆盖 persisted `frontendMode=dev` 的 fail-closed 路径。旧 HMR run 仅保留为首败证据，不可复用。

`SKILL_USED=cs-systematic-debugging@808fc5717aa88ad65efff312b11c186294d3e6ee301afb584e2f86599b137787`
