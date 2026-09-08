---
title: 受管 browser L2 远端后端拓扑与 DEV/backend-acceptance 入口统一
status: DEXTER_ACCEPTED
createdAt: 2026-09-08
decisionOwner: Dexter
scope: managed-browser-l2, dev, backend-acceptance, remote-runtime
---

# 背景

仓库原有 `scripts/test/browser-l2-runtime.mjs` 仍在 `startLocalRuntime` 中本地启动
Spring Boot，并通过 SSH 转发 PostgreSQL 与 asset 端口。这个实现与 Dexter 已冻结的环境裁决冲突：
DEV、backend acceptance 与 browser L2 的后端都必须在受信远端非生产主机运行；本机只承载
platform-admin、operations-admin 的 Vite（browser L2 另承载本机 Playwright），本机不得运行 Java，
也不得建立 PostgreSQL tunnel。

这不是单个端口或文案问题，而是执行边界、进程 owner、数据库/asset namespace 绑定、诊断日志和
cleanup 链的同根问题。若只删除本地 `bootRun` 而不补远端 Java 的身份、readiness、日志采集和根清理，
失败时仍无法证明真实后端拓扑，也无法恢复半启动 run。

# 决策

browser L2 采用与 DEV 相同的远端 Java owning capability，但保持 browser L2 自己的每-run 隔离资源和
fixture 生命周期：

1. `scripts/dev/r5-dev-runner.mjs` 是远端 Java 的 owning source，导出资源预检、源同步、启动、readiness、
   日志采集、停止和 root cleanup；`scripts/dev/r5-remote-java-runtime.mjs` 是无 CLI 副作用的共享能力入口。
2. `scripts/test/browser-l2-runtime.mjs` 只通过 HTTP/asset tunnel 访问远端 Java。远端先从受管候选集中
   预检一个未占用的 HTTP 端口，Java 以该端口启动，tunnel 绑定该端口和远端 `127.0.0.1:19000`，不转发 PostgreSQL。
3. browser L2 为远端 Java 生成受管 `r5-dev-*` remote run id/root，先做远端资源预检和源码同步，再启动
   Java；Java 使用本 run 数据库 URL、diagnostic run id、asset object prefix 和远端结果目录。
4. readiness/runtime/execution/cleanup manifest 必须保留 host、fingerprint、allowlist、remote root、远端 HTTP port、
   remote resource snapshot、PID/PGID、boot id、process start ticks、command digest、remote readiness、
   remote diagnostic paths 和本地采集的 remote log path；这些信息不得包含密码、token、OTP 或 cookie。
5. 正常结束和异常恢复都先采集远端日志/诊断，再按精确 remote identity 停止 Java、删除 remote root，
   再清理本 run 数据库/asset；本地只停止 runner 所拥有的 tunnel/Vite/Playwright tree。
6. 失败必须保留 `business`、`cleanup`、`firstFailure`、`lastKnownGood`、`brokenBoundary`；远端 artifact
   采集失败不能覆盖更早的业务首败，但必须进入 manifest 并阻止 business PASS。

# 受管调用

动态运行只能从仓根调用既有 browser L2 入口，不能手动启动 Spring、Vite、Playwright、SSH tunnel、
数据库、对象存储或 fixture SQL：

```bash
node scripts/test/browser-l2-runtime.mjs readiness
# 继续该专题既有的 P1 生成链，不手改 generated output
node scripts/test/browser-l2-runtime.mjs finalize
node scripts/test/browser-l2-runtime.mjs run
```

readiness 失败且 cleanup 未通过时，只能用同一 run 的 readiness manifest 做恢复：

```bash
node scripts/test/browser-l2-runtime.mjs cleanup <same-run-readiness-manifest.json>
```

reset、seed、DEV start/stop/restart、backend acceptance 和 UAT 仍是独立授权边界；本决策不自动授权
任何破坏性数据动作或动态 browser L2 执行。

# 验证要求

静态/ focused proof 至少覆盖：共享远端 Java 模块可安全 import、runner self-test、browser L2 runner
无 `startLocalRuntime`/`ports.db`/`ports.spring`/本地 `bootRun`、只存在 HTTP/asset forwarding、
manifest/cleanup 保留远端 identity 与日志路径、远端 Java cleanup 发生在 namespace cleanup 之前。

动态 L2 只有在后续受管运行中同时满足 `business=PASS` 与 `cleanup=PASS` 才能报告 PASS；必须实际读取
remote tunnel/backend log，并单列首败、last known good、broken boundary。当前这次代码修正本身不声称
已完成动态 browser L2、DEV、backend acceptance、reset 或 seed。

# Owning files

- `scripts/dev/r5-dev-runner.mjs`
- `scripts/dev/r5-remote-java-runtime.mjs`
- `scripts/test/browser-l2-runtime.mjs`
- `scripts/test/browser-l2-runtime.test.mjs`
- `doc/platform/browser-l2-execution-standard.md`
- `scripts/README.md`
- `AGENTS.md`
- `PLATFORM-BLUEPRINT.md`
- `.agents/skills/cs-managed-runtime-execution/SKILL.md`
