# Claude 复核请求：第二包 Journey + 受管运行 implementation

Dexter 已授权关闭第一包并进入第二包。请对当前 implementation 做独立终审，结论使用 `GO/NO-GO — M/S/N`。

## 范围

- RP-07：品牌列表统一 `queryText`，契约 → generated wire → edge → owner → operations-admin；核对 `trim/lower` 归一化、名称/编码匹配、空值与无结果、分页总数，以及是否仍有旧 `name/code` 站点。
- RP-08：operations-admin 13 个有限 `FORM_DRAWER` 的 mask、关闭图标、Esc、`onClose/requestClose`、footer cancel 是否全部受同一 `lifecycle.submitting` 控制；品牌授权 Drawer 不得保留第二套 submitting truth。
- RP-10：远端 host 只能来自仓内 allowlist，指纹/版本/维护者/轮换日必须全量 readback；所有直接消费者是否统一走 helper，是否仍有自行 hash 或 fallback host。
- RP-11：runner/diagnostic/joint L2 是否按受控 PGID/process tree 做 identity 校验与空树 readback；leader-dead/child-alive red fixture 是否真实失败并保留 `firstFailure/lastKnownGood/brokenBoundary`；stale-lock/failure path 是否 cleanup fail-closed。

## 重点证据

- 设计与此前独立设计终审：`doc/plans/platform/2026-08-05-v2s-whole-engineering-second-package-implementation-design.md`、`doc/review/platform/2026-08-05-v2s-whole-engineering-second-package-design-review-round2.md`
- focused proof：`doc/review/platform/2026-08-05-v2s-whole-engineering-second-package-focused-proof.json`
- business：`doc/evidence/platform/2026-08-05-v2s-whole-engineering-second-package-business.json`
- cleanup：`doc/evidence/platform/2026-08-05-v2s-whole-engineering-second-package-cleanup.json`
- managed L2 report：`.runtime/r5/joint-local-l2/rm1p6-joint-local-l2-1785931623610-45615-0bbb7341/evidence/terminal-report.json`
- owner focused（round-2 N-01 receipt 刷新后的最终证据）：`.runtime/r5/evidence/remote-testcontainers/r5-tc-1785932579123-66408`
- edge focused：`.runtime/r5/evidence/remote-testcontainers/r5-tc-1785931261770-38001`
- implementation exit：`doc/evidence/platform/2026-08-05-v2s-whole-engineering-second-package-exit.json`

## 独立核验要求

请先盲审当前生产源码与真实 evidence，再对照作者材料；不要把静态 PASS 当作 runtime PASS。重点检查 RP-07/RP-08/RP-10/RP-11 的全量分母、重复实现、owner readback、日志关联、cleanup 与 scope 漂移。对每个 finding 给出 `CONFIRMED / PARTIALLY_CONFIRMED / REJECTED_WITH_EVIDENCE / UNVERIFIED_REQUIRES_EVIDENCE`，并排序说明根因、影响与最小修复方向。

实现独立终审 round-1 的 M-01/M-02/M-03 已完成修复；round-2 的唯一 N-01（receipt 仍指向旧 owner run）已用上述 fresh owner focused evidence 刷新并关闭。请以当前源码、fresh receipt、business/cleanup evidence 重新判断，输出最终 `GO/NO-GO — M/S/N`，不要把历史 round-2 的旧指针结论重复计入。

## 授权边界

仅授权第二包 RP-07/RP-08/RP-10/RP-11 的 implementation 与本机 managed runtime 的 business/cleanup evidence 复核；不授权 UAT、远端启动 app/Vite/browser、数据库/migration、额外 seed/reset、deployment 或 Git 操作。当前 package 的 DEV 运行已受控停止，L2 使用一次性隔离 namespace，cleanup 必须单独判定。
