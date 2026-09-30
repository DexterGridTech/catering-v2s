# 批次二 DESIGN 独立审查输入清单 · Round 1

```text
REVIEW_CYCLE_ID=TERMINAL-ACTIVATION-BATCH-2-DESIGN-2026-09-30
REVIEW_TARGET=DESIGN
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
INPUT_CHECKLIST_STATUS=INCOMPLETE_AFTER_REVIEWER_METHOD_AUDIT
```

本清单由主 agent 在 reviewer 的后置方法校准后据实更正。R1 reviewer 确认先从证伪立场形成候选问题，再读两份目标详设/计划并形成最终 verdict；未读取作者自评、作者 finding 处置或旧 review 结论。下表仅把 reviewer 明确报告的内容记为已读；没有逐项路径/结果记录的不得记成完整。Round 1 有下述输入记录缺口，Round 2 必须补全；这不重置 REVIEW_CYCLE 或轮次。

| 必需输入 | 路径、命令或会话材料 | reviewer 实际结果 |
|---|---|---|
| Codex 执行入口 | `AGENTS.md` 全文 | reviewer 报告已读；本清单未保留章节/行定位 |
| Claude 执行入口 | `CLAUDE.md` 全文 | reviewer 报告已读；本清单未保留章节/行定位 |
| Dexter 本轮任务与授权 | reviewer prompt 中复述的原始指派、范围及禁止项 | reviewer 报告已读；原始指派以本线程转达文本为准 |
| project-memory kernels | `project-memory/kernel/*.md`；须列出并逐份读取全集 | reviewer 后置补报已读 6 个：`01-workspace-and-authorization.md`、`02-service-shape-and-owner.md`、`03-transaction-data-and-dependencies.md`、`04-contract-consumer-and-admin.md`、`05-evidence-runtime-and-git.md`、`06-heritage-and-change.md`；初始 verdict 未附清单 |
| 六维 recall | `scripts/context/recall-memory --task-kind design --domain platform --consumer-face backend --owner platform --impact architecture --trigger task-start` | reviewer 后置补报命令；初始 verdict 未保留原始输出 |
| 全部路由命中与适用来源 | 记录 recall 输出的每个 `id/path`；打开每个命中文件及其 applicable `sourceRefs`/`assertionSources` 原文 | reviewer 后置补报完整 25 条 `id/path` 和 sourceRefs 清单（见下文）；catalog/UI 专项 refs 的逐份全文状态为 `UNKNOWN/NOT_RECORDED`，R1 有缺口 |
| business corpus | `project-memory/decisions/confirmed-business-language-corpus.md`；按规定词集专门搜索并记录命中/边界 | reviewer 后置提供命令 `rg -n '终端|terminal|激活|取消激活|凭证|设备|连接|长连接|server-config|terminal-data-client|WebSocket|代理' ...`；结果当前作者重放命中第 262 行“设备协议”负面边界，未命中上述 owner/协议的正向语义。另一方法校准消息指出初始记录未保留专门检索；Round 1 因此保留证据记录缺口，不能补报 `NO_CORPUS_ENTRY_MATCHED` |
| 审核对象全文 | `doc/plans/platform/2026-09-30-v2s-terminal-activation-batch-2-implementation-design-codex.md` | reviewer 在形成最终 verdict 前读取目标全文；未读取作者自评 |
| 审核对象全文 | `doc/plans/platform/2026-09-30-v2s-terminal-activation-batch-2-implementation-plan-codex.md` | reviewer 在形成最终 verdict 前读取目标全文；未读取作者自评 |
| 原始需求 | `doc/plans/platform/2026-09-25-v2s-terminal-activation-and-connection-requirements-claude.md` 全文；按原指派排序 | reviewer 报告按要求阅读；R1 未保留章节级回读记录 |
| 已接受 Journey | `doc/decisions/2026-09-26-v2s-terminal-activation-and-connection-journey.md` 全文 | reviewer 报告已读；Journey 48/54 的矛盾 finding 可回到当前源复现 |
| 已接受服务形态 decision | `doc/decisions/2026-09-26-v2s-terminal-activation-service-shape.md` 全文 | reviewer 报告已读；R1 未保留章节级记录 |
| 全部 decision 标题清单 | `find doc/decisions -maxdepth 1 -type f -name '*.md' -print | sort`；列全目录并识别相关 accepted decisions | reviewer 后置确认执行 inventory 命令并给出 10 个相关 decision；未保存全部 120 个标题，也未据全目录证明相关 accepted decision 筛查完整；输入清单不完整 |
| 治理/服务/验证/第三方相关 decisions | 任务点名文件及全目录命中的其他相关 decisions | reviewer 报告读了任务点名和路由命中的相关 decisions/templates；未证明全目录筛查完成 |
| 模板 | 四份 template，逐节评估 applicable/N/A | reviewer 后置补报 implementation-design-template §0–14 为 PRESENT，Journey template 为 APPLICABLE_AS_SOURCE，IA 与 UI interaction 为 NOT_APPLICABLE_WITH_REASON；implementation template 子节状态已列于其后置补充中。初始 verdict 未附逐节表 |
| 适用规范 | 本任务列出的治理、编码、review、acceptance 规范 | reviewer 报告已读相关规范；R1 未留逐文件/条款清单 |
| 批次一约束与结论 | 批次一详设、实施计划、最新实施 review 与 final review artifacts | reviewer 报告已读划给批次二的相关材料；R1 未留逐文件清单 |
| 共享协议 | `contracts/protocol/terminal-connection-protocol.json` 全文 | reviewer 报告已读；R1 未留章节定位 |
| 源码闭包 | 生成、acceptance、TER/TDS、DEV 与远端 runner 当前源码 | reviewer 报告做了静态核验并提出 DR1；R1 未保留完整 path inventory |
| 第三方官方依据 | 对当前解析情况与拟议版本按精确版本核对官方来源 | reviewer 后置补报 Node/Undici/Spring/HAProxy URL 清单（见下文）；Spring Boot readiness 一手 URL 包含 4.0.0-M3/4.2/latest，精确 4.1.0 依据待 Round 2 检验 |
| 写前/写后逐点阅读（适用时） | 原始需求、路由 memory、owning source、约束与复用能力 | reviewer 报告以来源核验为依据提出 DR1；没有逐点阅读轨迹，R1 不声称完整满足该项 |

## 独立审查步骤和结论

1. 仅依据本清单和原始输入，以“找出设计/计划为什么不成立”为立场执行 `REVIEW_TARGET=DESIGN` 动作 1-B：提取四份模板的逐节缺项、设计文档之间矛盾、所有无出处的数字/上界/枚举值。不得先读旧 reviewer 输出或作者 intake。
2. 完成全部 findings、固定 verdict block 与初始 `GO/NO-GO` 后，才可比较作者 self-review/处置材料；在结论里明确比较前后与差异。
3. 逐条 finding 重开 owning source、主动找反例，写 `CONFIRMED / PARTIALLY_CONFIRMED / REJECTED_WITH_EVIDENCE / UNVERIFIED_REQUIRES_EVIDENCE / DEXTER_DECISION`，并给出最小可验收修正。
4. 写清同族全集、静态/测试/未验证档位、`DESIGN_GAPS`；四份模板逐节填写 `PRESENT / MISSING / NOT_APPLICABLE_WITH_REASON`。
5. 不得运行 build、test、生成器、`scripts/verify`、DEV、reset、seed、L2、UAT 或部署；它们不在本轮授权内。

```text
blindReviewDeclaration=先从证伪立场独立提取缺项/矛盾/无出处的具体值，并形成 findings 与 verdict；之后才对照作者自评或 finding 处置。
authorMaterialReadAfterIndependentVerdict=true
methodCalibration=后置校准后更正：先从证伪立场形成候选问题，再读取 primary review targets 并形成 verdict；authorMaterialReadAfterIndependentVerdict 指未读作者自评/作者处置，不表示未读目标文档。全目录 decision inventory 未列清、相关 decision 筛查未证明完整；corpus 专项搜索的初始记录缺失且后置消息存在冲突，当前字节由作者重放核到第 262 行负面边界；不重置本轮数。
```

## R1 后置补报的 recall、decision 与官方源索引

`id/path` 清单：

```text
decisions.confirmed-business-language-corpus -> project-memory/decisions/confirmed-business-language-corpus.md
decisions.deterministic-context-only -> project-memory/decisions/deterministic-context-only.md
decisions.http-crud-efficiency-design-redlines -> project-memory/decisions/http-crud-efficiency-design-redlines.md
decisions.independent-subagent-adversarial-review -> project-memory/decisions/independent-subagent-adversarial-review.md
decisions.owner-read-model-and-lifecycle-standard -> project-memory/decisions/owner-read-model-and-lifecycle-standard.md
kernel.contract-admin -> project-memory/kernel/04-contract-consumer-and-admin.md
kernel.evidence-runtime -> project-memory/kernel/05-evidence-runtime-and-git.md
kernel.heritage-change -> project-memory/kernel/06-heritage-and-change.md
kernel.service-owner -> project-memory/kernel/02-service-shape-and-owner.md
kernel.transaction-data -> project-memory/kernel/03-transaction-data-and-dependencies.md
kernel.workspace-authorization -> project-memory/kernel/01-workspace-and-authorization.md
operations.business-corpus-adoption-and-read-policy -> project-memory/operations/business-corpus-adoption-and-read-policy.md
operations.business-corpus-parked-domain-intake -> project-memory/operations/business-corpus-parked-domain-intake.md
operations.backend-readability-refactor -> project-memory/operations/backend-readability-refactor.md
pitfalls.designing-from-conversation-not-system -> project-memory/pitfalls/designing-from-conversation-not-system.md
pitfalls.invisible-dimension-drifts-at-implementation -> project-memory/pitfalls/invisible-dimension-drifts-at-implementation.md
pitfalls.platform-detail-reverse-inference -> project-memory/pitfalls/platform-detail-reverse-inference.md
practices.backend-capability-lookup -> project-memory/practices/backend-capability-lookup.md
practices.collection-boundary-modes -> project-memory/practices/collection-boundary-modes.md
practices.ordering-only-for-consumer-facing -> project-memory/practices/ordering-only-for-consumer-facing.md
operations.terminal-coding-standard -> project-memory/operations/terminal-coding-standard.md
decisions.terminal-architecture-and-stack-rulings -> project-memory/decisions/terminal-architecture-and-stack-rulings.md
decisions.terminal-build-order-and-batches -> project-memory/decisions/terminal-build-order-and-batches.md
practices.ter-input-and-virtual-keyboard-usage -> project-memory/practices/ter-input-and-virtual-keyboard-usage.md
practices.third-party-library-official-source-verification -> project-memory/practices/third-party-library-official-source-verification.md
```

Post-review reviewer message reported the following union of applicable `sourceRefs`/`assertionSources`; it did not map each path back to a recall row or mark which catalog/UI refs were opened, so this is a route index and not proof of complete source review:

```text
doc/decisions/2026-07-25-v2s-confirmed-business-corpus-memory-adoption.md
doc/plans/platform/2026-08-23-v2s-catalog-identification-production-guidance-formal-requirements-codex.md
doc/plans/platform/2026-08-23-v2s-catalog-library-workbench-interaction-design-codex.md
doc/plans/platform/2026-08-23-v2s-catalog-library-ui-experience-formal-requirements-codex.md
doc/plans/platform/2026-08-23-v2s-catalog-library-workbench-ia-design-codex.md
doc/plans/platform/2026-07-24-v2s-carryover-manifest-claude.md
doc/review/platform/2026-08-13-v2s-compliance-control-retirement-decision-claude.md
doc/decisions/2026-09-25-v2s-roadmap-mechanism-retirement.md
doc/evidence/platform/rm1/p6/rm1p6-u13-all-http-crud-efficiency-remediation-design.md
PLATFORM-BLUEPRINT.md
doc/decisions/2026-08-10-v2s-m1-extension-submission-and-command-readback-decision.md
doc/evidence/platform/rm1/p6/rm1p6-extension-hosts-u26-implementation-amendment.md
doc/platform/backend-coding-standard.md
doc/decisions/2026-08-12-v2s-public-invitation-resumption-state-machine.md
doc/review/platform/2026-08-16-v2s-backend-standards-conformance-review-claude.md
doc/review/platform/2026-08-22-v2s-backend-performance-root-cause-analysis-claude.md
doc/review/platform/2026-08-22-v2s-backend-performance-remediation-design-review-claude.md
doc/plans/platform/2026-08-22-v2s-backend-performance-remediation-implementation-design-codex.md
doc/platform/implementation-task-template.md
doc/decisions/2026-07-25-v2s-independent-subagent-adversarial-review-governance.md
doc/platform/review-standard.md
doc/plans/platform/2026-08-27-v2s-base-1-requirements-claude.md
doc/decisions/2026-07-24-v2s-single-deployable-modular-monolith-service-shape.md
doc/decisions/2026-07-24-v2s-solution-reasonableness-review-policy.md
doc/heritage/frozen/catering-all-v2/project-memory/decisions/logging-and-debugging-foundation-standard.md
doc/decisions/2026-07-29-v2s-observability-and-acceptance-standard.md
AGENTS.md
doc/platform/foundation-charter.md
doc/decisions/templates/ia-design-template.md
doc/decisions/templates/implementation-design-template.md
doc/review/platform/2026-08-18-v2s-external-collaboration-and-business-channel-spec-claude.md
doc/platform/terminal-coding-standard.md
doc/review/platform/2026-08-28-newposv1-package-analysis-claude/00-ter-build-order-claude.md
doc/plans/platform/2026-08-29-v2s-terminal-skeleton-requirements-claude.md
doc/platform/third-party-library-usage-standard.md
```

R1 official URL supplement:

```text
https://raw.githubusercontent.com/nodejs/undici/v8.11.2/package.json
https://github.com/nodejs/undici/blob/v8.11.2/lib/web/websocket/connection.js
https://github.com/nodejs/undici/blob/v8.11.2/lib/web/websocket/permessage-deflate.js
https://github.com/nodejs/node/blob/v22.23.3/deps/undici/src/package.json
https://docs.spring.io/spring-boot/4.0.0-M3/api/java/org/springframework/boot/availability/ReadinessState.html
https://docs.spring.io/spring-boot/4.2/reference/actuator/endpoints.html
https://docs.spring.io/spring-boot/reference/actuator/endpoints.html
https://cdn.haproxy.com/documentation/haproxy-configuration-manual/new/latest/
https://cdn.haproxy.com/documentation/haproxy-configuration-tutorials/reliability/health-checks/
https://docs.haproxy.org/3.4/configuration.html
```

R2 must independently map every current recall `id/path` to its relevant sourceRefs/assertionSources, record which source files were read, repeat the corpus search, list all `doc/decisions` titles before selecting relevant full-text reads, and verify exact-version official claims against the cited version.

R1 decision files reviewer reported opening: `2026-07-24-v2s-verification-governance.md`, `2026-07-25-v2s-design-governance-batch-1.md`, `2026-07-25-v2s-agent-coordination-and-control-boundary.md`, `2026-07-25-v2s-independent-subagent-adversarial-review-governance.md`, `2026-08-14-v2s-backend-acceptance-business-scenario-standard.md`, `2026-09-25-v2s-roadmap-mechanism-retirement.md`, the two terminal decisions, `2026-09-28-ter-third-party-usage-remediation.md`, and `2026-09-29-v2s-terminal-activation-cp05-baseline-296.md`. R1 did not preserve a complete title inventory.
