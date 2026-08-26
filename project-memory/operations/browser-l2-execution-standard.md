---
id: operations.browser-l2-execution-standard
title: 浏览器 L2 执行规范的唯一内容源在 doc/platform，项目记忆只做路由
type: operation
status: active
layer: routed
scope: every managed browser L2 design, implementation, testing, review, and runtime execution
createdAt: 2026-08-25
taskKinds: ["design", "implementation", "testing", "review", "runtime-management"]
domains: ["admin-ui", "platform", "contract", "backend"]
consumerFaces: ["platform-admin", "operations-admin"]
owners: ["frontend-platform", "platform", "contract", "backend"]
impacts: ["runtime", "evidence", "cleanup", "contract"]
triggers: ["task-start", "implementation", "review", "runtime", "failure"]
assertions: ["BROWSER_L2_STANDARD_SINGLE_SOURCE", "BROWSER_L2_MANAGED_ISOLATED_TOPOLOGY", "BROWSER_L2_SOURCE_OF_TRUTH_CHAIN", "BROWSER_L2_CASE_PROGRESS_AND_JOIN", "BROWSER_L2_FRESH_ROOT_CAUSE_RECOVERY"]
sourceRefs: ["doc/platform/browser-l2-execution-standard.md"]
---

# 受管浏览器 L2 执行

浏览器 L2 的唯一内容源是 `doc/platform/browser-l2-execution-standard.md`；本文件只负责将后续
agent 路由到该正本，不复制正文。

- `BROWSER_L2_STANDARD_SINGLE_SOURCE`：不得新建第二个 runner、fixture catalogue、locator/case registry
  或测试专用 API；扩展现有声明与生成链。
- `BROWSER_L2_MANAGED_ISOLATED_TOPOLOGY`：当前 L2 是本机 Spring/Vite/Playwright 加每 run 隔离远端
  namespace，不用 DEV seed、不等同 DEV/Testcontainers/UAT，动态执行须单独授权。
- `BROWSER_L2_SOURCE_OF_TRUTH_CHAIN`：blueprint/P1 candidate/readiness binding/testId/operation registry/
  fixture descriptor 各自只有一个住址；不得手写 active list、selector、endpoint、fixture 或 timeout。
- `BROWSER_L2_CASE_PROGRESS_AND_JOIN`：每 case 必须可见 START/COMPLETE 与剩余量，且有 case/action/testId
  到 request/completion/DB section 的脱敏 join；business 与本机/远端 cleanup 分账。
- `BROWSER_L2_FRESH_ROOT_CAUSE_RECOVERY`：首败先诊断；根因修复后 fresh run，不得延时、删 case、降 oracle、
  复用旧 namespace/session/readiness 或用静态/DEV/Testcontainers 替代。
