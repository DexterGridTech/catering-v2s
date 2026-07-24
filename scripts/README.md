# catering-v2s 标准动作

本目录是 v2s 仓内动作的唯一入口。已关闭的 R1 只建立了 AI-first/control-plane 静态底座；当前仍不提供 DEV、seed、reset、migration、application 或业务 runtime。

## 开始任务

```bash
scripts/context/agent-context health
scripts/context/recall-memory \
  --task-kind review --domain platform \
  --consumer-face backend --owner platform \
  --impact governance --trigger task-start
```

必须逐个打开 recall 返回的 kernel/routed 原文。代码结构只用：

```bash
scripts/context/recall-code --query '<exact symbol or text>'
```

## R1 检查

```bash
scripts/check/project-memory
scripts/check/agent-lifecycle
scripts/check/provider-free-context
scripts/check/foundation-standard-actions
scripts/check/roadmap-program-registry
scripts/check/module-dependency-registry --require-empty
scripts/check/handoff-debt
scripts/check/heritage-registry
```

每个 checker 的 `--self-test` 运行其 clean/red controls。R1 聚合：

```bash
scripts/check/r1-closure --pre-transfer
scripts/check/r1-closure --final
```

`--pre-transfer` 只证明 implementation 与 prepared transfer 输入就绪；`--final` 还必须看到 Registry-last owner、immutable receipt 与 post-transfer closure。两者均不授权 R2/W1。

R1 aggregate 的 exact path allowlist 只裁决 immutable R1 baseline。R2 或后续步骤产生新路径后，不得把 `r1-closure --final` 对当前 worktree 的预期失败误报为 R1 历史 evidence 失效；当前步骤必须验证 immutable R1 hash 链、`roadmap-control-plane-transfer` 与本步骤自己的 denominator。

## Standards coverage

```bash
scripts/check/standards-coverage --phase R2
scripts/check/standards-coverage --self-test
```

`contracts/policy/standards-coverage-matrix.json` 精确覆盖冻结 manifest Part B-D 的 150 个结构单元。R2 允许尚未到期的 `PLANNED`；进入 R3/R4 closure 时必须传入对应 phase，到期仍未接线即 FAIL。active gate/fixture 引用必须真实存在；机器不能判定的规则必须绑定矩阵内 review checklist。

## Codex hooks 客户端兼容性

`CODEX_CLI_VERSION_CHANGED` 是重跑原生 hooks parser probe 的精确触发事实。触发后必须从 v2s 根执行一次 `codex exec --ephemeral --json --dangerously-bypass-hook-trust` 的只读入口 probe，扫描完整 event stream 是否出现 `failed to parse hooks config`，并记录 client version、命令、错误信号与退出码；客户端可能在 event 中报告解析失败但进程仍退出 `0`，禁止只看 exit code。`scripts/check/agent-lifecycle` 继续承担确定性 schema、命令与 red-fixture 门，不能代替客户端 probe。

该触发器是 AI 控制面兼容性维护规则，不是生产化欠账；`HANDOFF.md` 继续只保存冻结的七项生产化欠账，不得为此扩成第二 Roadmap。

## Roadmap

只从 `doc/platform/roadmap-program-registry.json` 按显式 `programId` 解析。`PREPARED_NON_AUTHORITATIVE` 不得被当作 current owner；只有 `ACTIVE` 且 transfer receipt/current hash readback 全部通过时才可发现。

## Runtime 与 Git

- R1 不启动受管或非受管动态资源；
- 若未来存在 `.runtime/agent-sessions/<sessionId>.json`，Stop 只检查该 session 与其显式 `managedRunIds`；
- `start/restart` 未来必须迁移 schema 但不得 seed；`seed/reset` 始终独立；
- 不执行 Git stage、commit、push；Git 归 Dexter。
