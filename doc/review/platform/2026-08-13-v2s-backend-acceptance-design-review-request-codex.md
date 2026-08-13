REVIEW_KIND=IMPLEMENTATION_FACING_DESIGN_WITH_DEXTER_INTERNAL_REVIEW_WAIVER
DESIGN_GRANULARITY_MANIFEST=doc/evidence/platform/2026-08-13-v2s-backend-acceptance-design-granularity-manifest.json
INTERNAL_ADVERSARIAL_REVIEW=DEXTER_EXPLICITLY_WAIVED_IN_FAVOR_OF_SINGLE_CLAUDE_DESIGN_REVIEW_2026-08-13
REVIEW_STATUS=CLOSED_BY_ROUND2_GO
CURRENT_AUTHORITY=DESIGN_ONLY_PAUSED_BY_DEXTER_AFTER_ROUND2_REMEDIATION

> 本文件保留为当时的评审请求。当前设计已按 Round 2 裁定完成整改；不发起第三轮 DESIGN review，
> 不激活实施或动态运行。

# Backend acceptance 统一后台测试能力：Claude DESIGN review request

## 背景

Dexter 要求把后台接口形状、业务功能、确定性数据库开销与 cleanup 收敛为唯一动态能力
`backend-acceptance`，以 current semantic HTTP operation 为可增长分母，彻底退役 P4/P5/196
等分立完成话术；seed 只负责 DEV 数据。Claude 对完整详设首轮给出 NO-GO（M=2/S=2/N=2）；
本轮已逐项独立复算并整改计量校准、full-mode 容量、11-owner provider 映射与 typed consumer
disposition，同时按 Dexter 补入不依赖聊天的 6+15+8 历史 seed finding 精确回放分母。

Dexter 明确要求完整详设形成前不提前做 Claude review；现在完整设计已形成，进入 Claude DESIGN
review cycle。cycle 内允许按 finding 整改与复核，不额外伪造 Codex 内部对抗 verdict；manifest
以 reviewException 如实记录。当前设计包未实施、未运行任何动态环境。若本 DESIGN 获 GO，
Dexter 已条件授权下一 implementation agent 立即建立一个 package，按 BA-U01→U06 连续实施、
执行 managed backend-acceptance 动态验收，并在最终 package exit 后进入 Claude 外部
IMPLEMENTATION review cycle；cycle 内允许按 finding 整改与复核。每个内部节点仍由实施 agent 最多做两轮 self-review；第二轮仍有 finding
时修复并做 focused mechanical proof 后继续，不发起第三轮或中途 Claude review。

## 评审目标

请独立判断修订需求、规范落点与整体详设能否让实施 agent 不凭名称、旧数量、测试类或聊天猜测，
而按唯一连续状态机完成：operation/scenario 准入，真实 HTTP 四维 harness，可配置隔离 lane，
不可自准入的变更联动与 BUG_FIX 红证，逐 owner 迁移，以及退役前后两次 fresh full 验收。

## 需阅读文件

- `doc/plans/platform/2026-08-12-v2s-unified-backend-test-capability-merged-requirements.md`：修订后的统一需求基线。
- `doc/plans/platform/2026-08-13-v2s-backend-acceptance-implementation-design-and-plan-codex.md`：BA-U01→U06 整体详设、连续状态机与失败回路。
- `doc/evidence/platform/2026-08-13-v2s-backend-acceptance-design-granularity-manifest.json`：逐 unit 文件面、顺序、六类 source 分母、禁止捷径与 discriminator。
- `doc/evidence/platform/2026-08-13-v2s-backend-acceptance-design-package-input.json`：authority、输入 hash 与独立复算事实。
- `doc/evidence/platform/2026-08-13-v2s-backend-acceptance-historical-seed-findings.json`：实施 agent 必须逐项关闭的 6 条结构回归、15 个 HTTP failure family 与 8 个 seed/fixture family。
- `doc/review/platform/2026-08-13-v2s-backend-acceptance-design-review-claude.md`：本轮 M=2/S=2/N=2 原 finding。
- `doc/review/platform/2026-08-13-v2s-backend-acceptance-design-review-intake-codex.md`：逐 finding 独立复算、处置与新增历史回放要求。
- `doc/evidence/platform/2026-08-13-v2s-backend-acceptance-design-authorization.md`：当前 design-only 边界、DESIGN GO 后的新包条件授权及两轮 self-review 上限。
- `doc/decisions/2026-08-13-v2s-backend-acceptance-standard.md`：唯一术语、四维完成声明、迁移与变更联动标准。
- `project-memory/operations/backend-acceptance.md`、`project-memory/operations/dev-command-separation.md`、`project-memory/routing-vocabulary.json`：未来 agent 的路由与运行边界。
- `.agents/skills/cs-managed-runtime-execution/SKILL.md`、`.agents/skills/cs-spec-to-plan/SKILL.md`、`.agents/skills/cs-systematic-debugging/SKILL.md`、`.agents/skills/cs-writing-plans/SKILL.md`：已去除旧固定数量/类分母并接入新准入、运行和 BUG_FIX 规则。

## 独立核验重点

1. operation denominator 是否同时校验 identity row exact equality 与 route/binding digest freshness，且新 operation 缺 scenario 六字段第一天 fail closed。
2. `P0/W0/O0` 是否在 package entry 不可变；exit `P1` 是否独立扫描 `P0 ∪ P1` 的存在性和全文件 hash；同包重生成 inventory 能否被拒绝。请独立复算当前 checked-in production Java 分母 571、anchor 覆盖 128、盲区 443，而不是沿用 129/442。
3. production surface 是否从 Gradle main/task/generator inputs 自动派生，而非一份必漏的共享基础设施路径清单；Java/resource/build/generator 未锚定变化是否统一提升 impacted ALL。
4. scenario 六字段、通用 contract oracle、确定性结构 metrics、accepted baseline 棘轮、KNOWN_UNCOVERED 只减不增和 P4 row 直接删除时机是否互相一致。
5. lane 是否可配置且每 lane 独立可写 namespace；一 lane 首败是否只停自身；admission 是否严格早于容器初始化；是否彻底排除时延/percentile 与 seed 性能基线。
6. BA-U01→U06 是否有无断点上下衔接：U03 deterministic bootstrap operation；U05 source-derived owner/provider exact list；U06 退役前 full PASS、退役、最终字节 post-retirement full PASS、package exit、再交 Claude。
7. 节点 self-review 最多两轮的规则是否既防无限循环，又在第二轮 finding 修复后继续实施；是否清楚区分内部 SR 与唯一外部 Claude IMPLEMENTATION review。
8. 25 类 scratchpad red mutation 是否都走 production validator，特别是 row-equal/digest-stale、uncovered 新增、W0 自准入、P0/P1 删除重命名、BUG_FIX pre 字节也绿、consumer 漏处置、lane 共享写空间、计量 sink 少计以及历史 finding 少行/伪处置/陈旧 proof。
9. 历史 replay 是否明确列出而非依赖聊天：6 条 CONNECTION 回归是否强制新增 regression；15 个 HTTP 与 8 个 non-route seed family 是否逐 findingId 要求 owning source、root cause、affected route 与 fresh route proof。

已独立只读复算：`operation-handler-bindings` 当前报 `BP_U02_ROUTE_SOURCE_DIGEST_DRIFT`；P4
ledger 为 28 row/26 callerSymbol/52 case；旧 runner laneCount 硬编码 3；checked-in Java 为
571/covered 128/blind 443，有效 compiled main 为 616/covered 129/blind 487。已运行
`scripts/check/project-memory`，含术语 alias 和真实 split-route mutation，PASS。没有运行
Testcontainers、DEV、L2、reset、seed 或浏览器。

## 期望结论

请给出明确 `GO` 或 `NO-GO`。如有 finding，请按 `M` / `S` / `N` 标注精确相对路径与行号、
受影响 unit/分母、根因、最小修复、反例，以及是否需要 Dexter 产品裁决。若 GO，请明确它是
上述条件授权的激活条件：下一 agent 按一个 implementation package 连续完成 BA-U01→U06、
内部每节点最多两轮 self-review、managed backend-acceptance 动态验收、最终 package exit，
然后再进入 Claude 外部 IMPLEMENTATION review cycle；实施完成前不提前送审，但 cycle 内不限制为单次结论。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请对 backend-acceptance 统一后台测试能力的整体 implementation-facing 详设做整改后定向复核。

背景：Dexter 要求把后台接口形状、业务功能、确定性数据库开销与 cleanup 收敛为唯一动态能力 backend-acceptance，以 current semantic HTTP operation 为可增长分母，退役 P4/P5/196 等分立完成话术；seed 只负责 DEV 数据。你对完整详设首轮给出的 NO-GO（M=2/S=2/N=2）已逐条独立复算：M-01、S-01、S-02 CONFIRMED，M-02 对 571/128/443 与容量结论 CONFIRMED、对“实际改动频率”和“所有模块无例外”两处边界作 PARTIALLY_CONFIRMED。四条已一次性整改；另外 Dexter 要求把 seed 曾暴露的具体问题写成实施 agent 不依赖聊天也能执行的清单，现已增加 hash-bound 6+15+8 finding catalog。

目标：请独立核验这份需求与详设能否让后续 implementation agent 在 DESIGN GO 后建立一个 package，按 BA-U01→U06 连续完成静态实施、managed backend-acceptance 动态验收、退役前后两次 full 四维验证、最终 package exit，再进入外部 IMPLEMENTATION review cycle。实施完成前不得中途送审；cycle 内允许按 finding 整改与复核。每个实施节点由 agent 自己最多做两轮 self-review；第二轮仍有 finding 时修复并做 focused proof 后继续，不做第三轮内部自审。

请从 catering-v2s 仓库根阅读：
- doc/plans/platform/2026-08-12-v2s-unified-backend-test-capability-merged-requirements.md：修订需求基线；
- doc/plans/platform/2026-08-13-v2s-backend-acceptance-implementation-design-and-plan-codex.md：BA-U01→U06 整体详设、连续状态机与失败回路；
- doc/evidence/platform/2026-08-13-v2s-backend-acceptance-design-granularity-manifest.json：逐 unit 文件面、顺序、六类分母、禁止捷径与 discriminator；
- doc/evidence/platform/2026-08-13-v2s-backend-acceptance-design-package-input.json：authority、输入 hash 与独立复算事实；
- doc/evidence/platform/2026-08-13-v2s-backend-acceptance-historical-seed-findings.json：明确的 6 条结构回归、15 个 HTTP failure family 与 8 个 seed/fixture family 回放分母；
- doc/review/platform/2026-08-13-v2s-backend-acceptance-design-review-claude.md：你首轮的 M=2/S=2/N=2 finding；
- doc/review/platform/2026-08-13-v2s-backend-acceptance-design-review-intake-codex.md：Codex 逐条复算、整改与边界处置；
- doc/evidence/platform/2026-08-13-v2s-backend-acceptance-design-authorization.md：当前 design-only 边界、DESIGN GO 后的新包条件授权及两轮 self-review 上限；
- doc/decisions/2026-08-13-v2s-backend-acceptance-standard.md：唯一术语、四维完成声明、迁移与变更联动标准；
- project-memory/operations/backend-acceptance.md、project-memory/operations/dev-command-separation.md、project-memory/routing-vocabulary.json：未来 agent 的路由与运行边界；
- .agents/skills/cs-managed-runtime-execution/SKILL.md、.agents/skills/cs-spec-to-plan/SKILL.md、.agents/skills/cs-systematic-debugging/SKILL.md、.agents/skills/cs-writing-plans/SKILL.md：未来 agent 的执行规范。

请重点独立核验：一，operation row exact equality 与 projection digest freshness 是否分开校验，新 operation 缺六字段 scenario 是否当天 fail closed；二，变更门是否以 immutable entry P0/W0/O0 与 exit P1 独立扫描，能拒绝同包重生成 inventory 自准入，并对任何未锚定 production Java/resource/build/generator input 保守提升 impacted ALL；三，请自行复算 checked-in production Java 是否为 571、entry anchor 实际覆盖 128、盲区 443，不要采信旧 129/442；四，真实 HTTP 四维、确定性结构指标、accepted baseline、KNOWN_UNCOVERED、P4 删除和旧行为断言迁移是否一致且无性能时延/seed 混入；五，可配置隔离 lane、lane-local first failure、admission-before-init、BUG_FIX pre FAIL/post PASS 与 consumerFace 联动是否可执行；六，BA-U01→U06、每节点最多两轮 self-review、U06 退役前后两次 full 验证和最终 package exit 是否形成实施 agent 不会走偏的一条连续链；七，25 类 scratchpad mutation 是否真走 production validator且足以拒绝放宽；八，历史 catalog 是否把 6 条性能回归、15 个 HTTP 与 8 个 seed/fixture family 的 operation/signal/source/合法处置/证据逐项钉死，使不知聊天背景的实施 agent 也无法漏项。

烦请给出明确 GO 或 NO-GO。如有问题，请按 M / S / N 标注精确相对路径与行号、影响 unit/分母、根因、最小修复建议、反例，以及是否需要 Dexter 产品裁决。

授权边界：当前只评审静态 implementation-facing DESIGN；当前设计包未实施、未运行任何动态环境。若 DESIGN GO，它按 Dexter 已记录的条件授权激活下一 implementation package，仅允许 BA-U01→U06 与 managed backend-acceptance Testcontainers 动态验收；不授权 DEV、L2、reset、seed、浏览器、UAT、部署或手工 SQL，也不代表当前已有任何动态、业务、performance 或 cleanup 成功。谢谢。
```
