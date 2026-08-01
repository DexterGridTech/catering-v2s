# catering-v2s R3 专项设计评审请求

```text
REVIEW_STATUS=BLOCKED
REVIEW_KIND=IMPLEMENTATION_FACING_DESIGN
PROGRAM_ID=V2S_W0_W4_EXECUTION
ROADMAP_STEP=R3
DESIGN_GRANULARITY_MANIFEST=doc/review/platform/2026-07-24-v2s-r3-design-granularity-manifest.json
ADVERSARIAL_REVIEW_REPORT=doc/review/platform/2026-07-24-v2s-r3-design-codex-adversarial-review.json
INDEPENDENT_CODEX_REVIEW=doc/review/platform/2026-07-24-v2s-r3-design-independent-codex-review.md
INDEPENDENT_REVIEW_RESOLUTION=doc/review/platform/2026-07-24-v2s-r3-design-independent-review-resolution.md
REVISED_DESIGN_INDEPENDENT_VERIFICATION=doc/review/platform/2026-07-24-v2s-r3-revised-design-independent-verification.md
REVISED_DESIGN_VERIFICATION_RESOLUTION=doc/review/platform/2026-07-24-v2s-r3-revised-design-verification-resolution.md
REVIEW_CYCLE_ID=R3-SPECIALIZED-DESIGN
CODEX_ADVERSARIAL_ROUNDS_COMPLETED=2
CODEX_ADVERSARIAL_ROUND_LIMIT=2
ROUND_FINAL_DECISION=SELF_DECIDED
DESIGN_SHA256=253045ba543a2ea319aeadb7e1c5fc785df4d81afc4563c2c9ca9bb5f57c8dbd
MANIFEST_SHA256=aeb5cabd4cdb3891c0166a469dfdd67bb67335c233358f37fa1c510475765e27
INDEPENDENT_CODEX_REVIEW_SHA256=91bef03d7db0b15e26732a0e4ffc78467f9bbf6bf4c3e4d985f9485ae98bbb49
INDEPENDENT_REVIEW_RESOLUTION_SHA256=dd618ce63695f4465eadcdc39e289e67b54060039e90d2bf0814409ead61da76
REVISED_DESIGN_INDEPENDENT_VERIFICATION_SHA256=71813494e28b1211acd52d7e476504569dced1627fa37cdad2a2149dc9c8f568
REVISED_DESIGN_VERIFICATION_RESOLUTION_SHA256=f83009d1abd5684e7cda9af42664eecced90ef41806853939a338a6483dc8bd7
ADVERSARIAL_REVIEW_SHA256=c9ff4bd35be692b4b88e4c34c147914720c19b2317822ba9b86c5a0096a2bfa7
BLOCKER_1=DEXTER_MUST_ACCEPT_R3_J01_OR_CHOOSE_ALTERNATIVE
CONTROL_PLANE_CHECKER=PASS
CLAUDE_REVIEW_HANDOFF_GATE=PASS
IMPLEMENTATION_PRECONDITION=DEXTER_ACCEPTS_AND_OWNS_GATE0_CHECKPOINT_COMMIT
```

## 背景

Dexter 只授权了 R3 专项设计，未授权 R3/W1 implementation、DEV、数据库或动态运行。Codex 已从冻结 ADR/manifest/Roadmap/standards/Heritage 形成路径级设计。round 1 fresh-context review 得出 `NO_GO(4 M / 2 S / 2 N)`，round 2 定向复核得出 `NO_GO(2 M / 3 S / 3 N)`；Codex 对两轮 finding 均逐条查证、寻找反例与比较更小修复，最终补齐 current-session 语义、Gate 0 checkpoint、deterministic browser-forgery contract、Jackson 3 与 migration 数量，并拒绝 role/capability 泛化、checkpoint service、缺 Fetch Metadata 一律拒绝、双 CSRF、`REQUIRES_NEW` 和伪造旧 snapshot。两轮后 Dexter 澄清必需仓内控制面由 Codex 自主维护，granularity checker 已通过 production/self-test/red controls，正式 Claude handoff gate 也已真实调用该 checker并 PASS，原 M-002 关闭。该 Codex cycle 保持 `SELF_DECIDED`，当前为 `NO_GO(1 M / 0 S / 2 N)`，不再启动第三轮 Codex 审查。

## 评审目标

待唯一产品 blocker 关闭、hash 重算且 handoff gate PASS 后，请 Claude 先独立构造自己认为最小且正确的 walking skeleton，再判断修订方案是否真正解决“一代理→一 app→一库→双 admin→登录+真实页面”目标，并独立验证 finding resolution 是否有全盘接受、证据不足武断或修复过度设计。

## 需阅读文件

- `AGENTS.md`、`PLATFORM-BLUEPRINT.md`
- `doc/roadmaps/platform/2026-07-24-v2s-execution-roadmap.md`
- `doc/decisions/2026-07-24-v2s-r3-specialized-design-authorization.md`
- `doc/decisions/2026-07-24-v2s-single-deployable-modular-monolith-service-shape.md`
- `doc/plans/platform/2026-07-24-v2s-carryover-manifest-claude.md`
- `contracts/policy/standards-coverage-matrix.json`
- `doc/plans/platform/2026-07-24-v2s-r3-walking-skeleton-implementation-design.md`
- `doc/review/platform/2026-07-24-v2s-r3-design-granularity-manifest.json`
- `doc/review/platform/2026-07-24-v2s-r3-design-codex-adversarial-review.json`
- `doc/review/platform/2026-07-24-v2s-r3-design-codex-self-review.md`
- `doc/review/platform/2026-07-24-v2s-r3-design-independent-codex-review.md`
- `doc/review/platform/2026-07-24-v2s-r3-design-independent-review-resolution.md`
- `doc/review/platform/2026-07-24-v2s-r3-revised-design-independent-verification.md`
- `doc/review/platform/2026-07-24-v2s-r3-revised-design-verification-resolution.md`
- `doc/review/platform/2026-07-24-v2s-implementation-design-granularity-codex-self-review.md`

## 独立核验重点

1. 方案合理性：为何 platform workspace directory 比 `/me`/health、双业务 Journey 或 operations 空工作台更合适；
2. Gate 0：readiness→Dexter immutable checkpoint commit→descendant proof→post-U02/U03 production conformity 是否既保留先门后代码、又避免空树 artifact 假绿；
3. owner/transaction/schema：三个 module、一个 judgment edge、一个 FK edge、同一 `REQUIRED` 与单一 history 是否无越权；
4. security：Nginx 覆盖头、edge credential、server-managed canonical origin、filter 顺序、strict Origin + conditional Fetch Metadata、无 CORS allow header、两 principal/cookie/session/owner 分离、dummy hash/双桶是否完整；
5. contract/consumer：8/5/3 operation closure、双 current-session 最小 schema/401/unavailable 语义、server registry、两 app generated slice 与 reachable type 是否有假绿；
6. UI：exact workspaceKey lookup→0/1 result→只读详情、失败态与 operations 不造假页面是否符合真实任务；是否仍需 Dexter 改选；
7. version/Heritage：只使用冻结 Part C 行为样板，未复制不适用拓扑；deferred version set 是否在实现前有硬门；
8. evidence：proxy-only、fresh PG/login/readback、business/cleanup、zero resources 与五命令分权。

## 期望结论

在产品 blocker 关闭前请勿给正式 GO。关闭后请给明确 `GO` 或 `NO-GO`，findings 按 `M` / `S` / `N` 标注精确路径、影响、最小修复与是否需要 Dexter 产品裁决。即使 GO，也只表示设计可供 Dexter 接受与另行授权 implementation。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请在下述产品 blocker 关闭后，从 catering-v2s 仓根独立评审 R3 implementation-facing 专项设计。

背景：Dexter 当前只授权设计，未授权 R3/W1 implementation、DEV、数据库、动态运行或 Git 写入。Codex 的候选是 platform-admin 登录后按已知 workspaceKey 核验工作区状态/基础事实；operations-admin 只完成独立登录/session 恢复与非空 generated slice。Codex 已完成同一 DESIGN cycle 的两轮对抗审查并 SELF_DECIDED；必需 granularity checker 已通过 production/self-test/red controls，当前唯一 M 是产品入口尚未接受，不再启动第三轮 Codex review。
目标：请先独立推导你认为最小且正确的 walking skeleton，再判断该方案的问题选择、复杂度、owner/transaction/schema/security/contract/双 admin/UI/evidence 闭环是否合理，并复核独立 finding resolution 是否证据充分、有没有全盘接受或过度设计。

请从仓库根阅读 doc/plans/platform/2026-07-24-v2s-r3-walking-skeleton-implementation-design.md、doc/review/platform/2026-07-24-v2s-r3-design-granularity-manifest.json、两轮 Codex review 及其两个 resolution，并按评审请求回读 AGENTS.md、Roadmap、冻结 ADR/manifest 与 standards matrix。

请重点独立核验：R3-J01 是否是正确产品入口；Gate 0 readiness/checkpoint/descendant/conformity 是否可执行；一个 app/一库/三 owner schema/一 history 是否成立；两 principal 与两个 admin 是否真正独立且 refresh-safe；8/5/3 face/generated closure 是否有假绿；typed denial、canonical-origin/conditional-fetch-metadata browser policy、proxy-only fresh business 与 cleanup oracle 是否充分。

烦请给出明确 GO 或 NO-GO；如有问题请按 M / S / N 标注精确路径、影响、最小修复及是否需要 Dexter 裁决。
授权边界：GO 只表示专项设计可供 Dexter 接受并另行授权 implementation；不授权应用代码、contract、migration、DEV、seed/reset、数据库、动态运行、Git 或 WALKING_SKELETON_READY。谢谢。
```
