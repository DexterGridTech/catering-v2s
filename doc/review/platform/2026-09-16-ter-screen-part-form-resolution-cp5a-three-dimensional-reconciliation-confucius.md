# TER screenPart 机型解析 · CP-5a 步骤级三维对账（第二次）

```text
REVIEW_TARGET=STEP_RECONCILIATION
REVIEW_SCOPE=CP-5a / B-1 / R-10b,R-12,R-13,R-14 partial
REVIEWER_KIND=INDEPENDENT_SUBAGENT
REVIEWER=Confucius
REVIEWER_ID=01a0a97d-f28a-7d83-8a28-72bc5f25dbcf
TESTS_RUN=NO; read-only reconciliation
VERDICT=OPEN
```

## Finding

首次 scope drift 已退回，公共 `AdminLayer` 已恢复零参数，B-2 layout 未提前落入；但
`useAdminSections` 仍在 hook 内把无效/空请求回落到 `sections[0]`。这与 R-14 要求
“hook 返回 raw selection、fallback 由 laptop/mobile component 决定”不符。

## 处置边界

本记录保留为第二次真实 finding。主 agent 将 hook 改为只返回 raw requested selection，
由两个 form-specific wrapper 各自决定 fallback；修复后由新的 fresh reviewer Hooke 复查。
