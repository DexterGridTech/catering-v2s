# CP1/B1 当前源码 fresh 三维对账

## Metadata

- `REVIEW_TARGET=IMPLEMENTATION_RECONCILIATION`
- `REVIEW_CYCLE_ID=2026-09-15-v2s-terminal-sample-infrastructure-uplift-implementation`
- `REVIEW_ROUND=4`
- `reviewerKind=INDEPENDENT_SUBAGENT`
- reviewer：fresh independent verifier（agent `01a0a1de-bfe6-7f42-af4f-83c7c6ab1732`）
- scope：requirements v3.6、design、plan、project memory、current B1 source；只读，不运行 test/build/dynamic，不写文件。

## Verdict

`OPEN` / `NOT_MATCHED`，`M/S/N=1/1/0`。

## Findings

### M-1 — affected README census 未全量满足 TR-10

当前 `ui.base.feature-assembly` README 已覆盖中文定位/作用/结构/用法/迭代边界，但 B1 affected package census 仍包含：

- `apps/terminal/kernel/feature/sample-member-registry/README.md:1`：英文短说明，缺 TR-10 要求的中文结构与“在这个包上迭代时”。
- `apps/terminal/kernel/feature/sample-staff-session/README.md:1`：同样缺失。

因此 B1 的 README/package/source 三维对账不能 `MATCHED`。这是文档内容缺口，不是凭“README 文件存在”闭合。

### S-1 — U1 不属于 B1 closure

需求与计划将 U1 明确放在 B3 收口；B1 只稳定 runtime dependency contract，不能用当前 sample-console factory 把 U1 提前判作 B1 证据。

## Current source support

- 五个 owner factory 当前消费各自 `runtimeModuleDependencyNames` subset，未发现生产 `optional: true`、whole-array fake 或旧 descriptor 伪造。
- `apps/terminal/ui/base/feature-assembly/src/index.ts:44-99` 提供真实 RuntimeModule normalization 与可撤销 registration。
- 详设 D-4 与计划 B1.1–B1.6 分别位于 `doc/plans/platform/2026-09-14-v2s-terminal-sample-infrastructure-uplift-implementation-design-codex.md:317-362` 与 `...implementation-plan-codex.md:162-190`。

## First failure / broken boundary / last known good

- **first failure**：affected package README 内容未满足 TR-10。
- **broken boundary**：源码/factory 与 package README 的一致性边界；文件存在不能代替内容对账。
- **last known good**：runtime subset/source/factory 形态与已有 skeleton/red mutation 记录支持，但不覆盖未闭合 README 和 B0 admission。

## Reproduction

```sh
nl -ba apps/terminal/kernel/feature/sample-member-registry/README.md | sed -n '1,120p'
nl -ba apps/terminal/kernel/feature/sample-staff-session/README.md | sed -n '1,120p'
nl -ba apps/terminal/ui/base/feature-assembly/README.md | sed -n '1,120p'
nl -ba doc/platform/terminal-coding-standard.md | sed -n '401,430p'
```

