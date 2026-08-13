REVIEW_KIND=IMPLEMENTATION_FACING_DESIGN_WITH_DEXTER_INTERNAL_REVIEW_WAIVER
DESIGN_GRANULARITY_MANIFEST=doc/review/platform/2026-08-12-v2s-per-edit-gate-control-plane-remediation-design-granularity-manifest.json
INTERNAL_ADVERSARIAL_REVIEW=DEXTER_EXPLICITLY_WAIVED_2026-08-12

# per-edit 门控制面自锁整改整体详设：Claude DESIGN review record

## 背景

当前 mandatory per-edit gate closure 的 command hash 与真实 SQL merge gate 漂移，`readActivePackage()` 已实测失败；普通 package 不允许修改 gate/closure，既有 recovery 又复用同一 mandatory gate 校验，形成真实控制面自锁。Claude 的修订需求已由 Codex 源码复证。Dexter 要求一次完成 P0–P3 整体详设、只做一轮 Claude 设计评审、GO 后一个串行实施批次和一轮实施后 review。

Dexter 已明确豁免本轮 Codex 内部对抗性 review，因此没有 subagent verdict，不能伪造 `ADVERSARIAL_REVIEW_REPORT`。本轮由 Claude 直接承担唯一外部 DESIGN review；Claude verdict 已为 `GO (M=0 / S=1 / N=1)`，两条非阻断 finding 已按 `doc/review/platform/2026-08-12-v2s-per-edit-gate-control-plane-remediation-design-author-intake-codex.md` 修订。设计仍为 `implementationAuthority: false`。

## 评审目标

请独立判断整体设计是否能在不放宽正常 package/hook、不中断最终态 gate、且不恢复已退役 after-hash exact-set 的前提下，按 P0→P1→P2→P3 一次实施：P0 解开并防止再次自锁；P1 让 FAIL 有痕且 changed-path/receipt 分母独立；P2 让六 archetype 唯一选择相关 profile 并在 exit 新鲜重跑；P3 只迁移有等价替代的源码锚点。

## 需阅读文件

- `doc/review/platform/2026-08-12-v2s-per-edit-gate-deadlock-remediation-requirements-claude.md`：权威整改需求与 P0–P3 顺序。
- `doc/plans/platform/2026-08-12-v2s-per-edit-gate-control-plane-remediation-implementation-design-codex.md`：整体 implementation-facing 详设与单批计划。
- `doc/review/platform/2026-08-12-v2s-per-edit-gate-control-plane-remediation-design-granularity-manifest.json`：五个 delivery unit、六类 package-exit source 分母与文件面。
- `doc/evidence/platform/2026-08-12-v2s-per-edit-gate-control-plane-remediation-design-authorization.md`：design-only 授权和固定实施节奏。
- `tools/compliance-control/cli.mjs`：`mandatoryGateProfiles`、active package validation/recovery、`deltaState`、hook PRE/POST、package exit owning source。
- `contracts/policy/mandatory-per-edit-gate-command-closure.json`：当前六 archetype 共用 profile 和漂移 hash。
- `scripts/check/backend-performance-sql-merge-coverage`：当前 profile command 与 P3 source-anchor 分母。

## 独立核验重点

1. P0-B0 是否诚实处理“逃生代码自己也写不进去”的鸡生蛋问题：首次 request 在仓外生成，bridge 只写 closure 与 active package 两个 exact target；后续 durable bootstrap 只在精确 hash-drift failure 可用，健康 package 调用必须红。
2. P1 的 ledger 是否真正独立于 receipt：changed paths 来自 `deltaState(root)`；linked PRE/terminal POST 与 receipt hash 可发现误删/误改；trim 共用 validator；未以任何形式恢复全局 after-hash exact-set；`.runtime` 只声明纪律边界而非安全边界。
3. P2 六映射是否合理且足够相关：backend-performance-static/backend-source/frontend-source/control-plane/design-only/runner-evidence 各恰好一个 profile；新增三个 adapter 是否保持最小、复用 existing owners；final exit 必须产生本次新鲜 gate receipt。
4. P3 的分母谓词能否有限复算，三种 disposition 是否覆盖且互斥；canonicalJson fail-closed 等无契约替代的实现纪律不会因“消灭源码锚点”被删除。
5. design create/update/retain/delete 面、五个 unit 顺序、六类 source compliance denominator、red mutations 与静态授权边界是否足够 implementation-ready；特别寻找会诱导实施者走向放宽 scope、第二套 catalog、历史 FAIL 覆盖或先删锚点的缺口。

已运行的静态事实：`scripts/check/standards-coverage --phase BACKEND_PERFORMANCE_FINAL_CLOSURE` PASS（R5/150 rules）；granularity checker self-test PASS；CLI 的 `mandatory-per-edit-gate-self-test` PASS。因 Dexter 明确豁免 Codex 内部 review，当前没有可供 `--review` 参数使用的独立 verdict，故未把“manifest+review PASS”伪报为已完成；Claude verdict 与 author intake 已 hash-bound 在 manifest 中。

## 期望结论

请给出明确 `GO` 或 `NO-GO`，并按 `M` / `S` / `N` 报告。每条 finding 请附相对路径与行号、受影响 unit/分母、根因、最小修复、反例，以及是否需要 Dexter 产品/范围裁决。若 GO，请明确其只表示 implementation-facing DESIGN 可按一个串行 package 实施。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请协助评审 per-edit 门控制面自锁整改的整体 implementation-facing 详设。

背景：mandatory per-edit gate closure 的 commandSha256 与真实 SQL merge gate 已漂移，readActivePackage() 实测失败；普通 package 不允许修改 gate/closure，既有 recovery 又复用同一失败校验，形成真实控制面自锁。你提供的修订需求已经 Codex 源码复证。Dexter 要求一次完成 P0–P3 整体详设，只做这一轮 Claude DESIGN review；GO 后按 P0→P1→P2→P3 一个串行 package 实施，再做一轮 IMPLEMENTATION review。Dexter 本轮已明确豁免 Codex 内部对抗性 review，因此不存在也不得伪造 subagent verdict。

目标：请独立核验该设计能否不放宽正常 package/hook、不恢复已退役 after-hash exact-set，并真正闭合四层根因：P0 首次 exact bridge 与 durable bootstrap；P1 独立 changed-path ledger、结构化 FAIL receipt 与全 exit mode 校验；P2 六 archetype 一对一 profile 及 final exit 新鲜重跑；P3 source-anchor 有限 disposition 和加法优先迁移。

请从 catering-v2s 仓库根阅读：
- doc/review/platform/2026-08-12-v2s-per-edit-gate-deadlock-remediation-requirements-claude.md：权威整改需求；
- doc/plans/platform/2026-08-12-v2s-per-edit-gate-control-plane-remediation-implementation-design-codex.md：整体详设与单批计划；
- doc/review/platform/2026-08-12-v2s-per-edit-gate-control-plane-remediation-design-granularity-manifest.json：五个 unit、六类 exit 分母和文件面；
- doc/evidence/platform/2026-08-12-v2s-per-edit-gate-control-plane-remediation-design-authorization.md：design-only 授权；
- tools/compliance-control/cli.mjs、contracts/policy/mandatory-per-edit-gate-command-closure.json、scripts/check/backend-performance-sql-merge-coverage：真实 owning sources。

请重点独立核验：一，P0-B0 仓外 request 加两个 exact target 是否是不可再缩小且可恢复的鸡生蛋解，durable bootstrap 是否在健康 package 时 fail-closed；二，P1 是否以 deltaState 而非 receipt 派生分母，删除/编辑 FAIL receipt 与 trim 绕过是否真红，同时没有恢复全局 after-hash exact-set；三，六 archetype/profile/command/适用面/final-exit mapping 是否完整、相关、没有第二套事实；四，P3 的 source-anchor denominator 是否有限可复算，双源/行为/保留三分法是否会误删 canonicalJson fail-closed 等实现纪律；五，文件面、红变异、六类 source 分母和串行顺序是否足够让实施不走偏。

烦请给出明确 GO 或 NO-GO。如有问题，请按 M / S / N 标注精确相对路径与行号、影响 unit/分母、根因、最小修复建议、反例，以及是否需要 Dexter 产品裁决。

授权边界：本轮只评审静态 implementation-facing DESIGN。GO 只表示可等待 Dexter 后续明确 implementation authority，再以一个 package 按 P0→P1→P2→P3 串行实施；不授权当前实施，不授权 Testcontainers、DEV、L2、reset、seed、浏览器、UAT、部署或手工 SQL，也不代表动态、业务、cleanup 或性能成功。谢谢。
```
