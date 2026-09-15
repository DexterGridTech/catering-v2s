# fresh 独立 DESIGN review input round 2

```text
REVIEW_TARGET=DESIGN
REVIEW_CYCLE_ID=2026-09-14-v2s-extension-field-list-search-design
REVIEW_ROUND=2
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
BLIND_REVIEW=true
AUTHOR_INTAKE=NOT_PROVIDED_BEFORE_VERDICT
```

## 1. 角色与边界

你是本 cycle 的 fresh 独立只读 DESIGN reviewer。请在形成 verdict 前不要读取主 agent 的 finding intake、修复处置或任何作者自评文件；可以读取上一轮独立 reviewer 的原文作为待核验线索，但必须重新以证伪立场核对当前 bytes。不得写文件，不得执行 reset、seed、DEV、backend acceptance、browser L2 或其他动态动作。请区分静态设计结论和未运行的动态证据，不把后者报为 PASS。

## 2. 必读输入

1. `AGENTS.md`、`CLAUDE.md`、`PLATFORM-BLUEPRINT.md`、`doc/platform/README.md`、active Roadmap 的授权字段；
2. `project-memory/index.md` 全部 kernel，并按六维 recall 命中读取全部原文；
3. `scripts/README.md`、`project-memory/decisions/deterministic-context-only.md`、适用 backend/frontend coding/verification/review 标准；
4. 当前需求：`doc/plans/platform/2026-09-14-v2s-extension-field-list-search-requirements.md`；
5. 当前 Journey/IA/interaction/implementation design/implementation plan：
   - `doc/decisions/2026-09-14-v2s-extension-field-list-search-journey.md`
   - `doc/plans/platform/2026-09-14-v2s-extension-field-list-search-ia-design-codex.md`
   - `doc/plans/platform/2026-09-14-v2s-extension-field-list-search-interaction-design-codex.md`
   - `doc/plans/platform/2026-09-14-v2s-extension-field-list-search-implementation-design-codex.md`
   - `doc/plans/platform/2026-09-14-v2s-extension-field-list-search-implementation-plan-codex.md`
6. owning source：
   - `scripts/generate/edge-codegen.mjs`
   - `scripts/generate/r5-edge-materialize.mjs`
   - `doc/plans/platform/2026-07-25-v2s-r5-edge-contract-implementation-catalog.json`
   - `doc/plans/platform/2026-07-26-v2s-r5-error-code-disposition-catalog.json`
   - `scripts/test/test-health-entry-runner.mjs`
   - 当前 extension definition contract/owner、七个目标 list operation、foundation/app source（按 rg/source 复核）
7. round 1 独立原文（只作待核验线索）：`doc/review/platform/2026-09-14-v2s-extension-field-list-search-design-independent-review-verdict-codex-r1.md`。

## 3. Round 1 定向复核重点

请重新证伪以下五个已修复点及其同根反例：

- M-1：七个 operation 是否都有 `extensionFilters` 和 `definitionRevision` 的精确 OpenAPI query contract；`required=false`、`integer/int64/minimum=0` 是否一致；未携带/空数组、malformed/shape/length、非空缺 revision、stale revision、revision 相等后的 semantic validation 顺序是否在需求、Journey、IA、交互、详设、计划与 owning source 之间一致；
- M-2：NUMBER/BOOLEAN 的 UI typed draft 与 `ExtensionFilter.value` wire string 是否在六份材料、generated-chain 前提、owner parser/predicate 和 invalid oracle 中唯一且无 JSON number/boolean 传输歧义；
- S-1：详设 acceptance scenario 表是否每个 scenario id 都是独立可读的真实 Markdown 行，是否仍存在字面 `\\n|`，分母/owner/request/oracle 是否完整；
- S-2：视觉 IA 已确认，但 implementation/runtime 是否仍正确保持在 round 2 独立门之后；本任务材料是否残留待视觉确认、R3 状态或其他会误导执行者的历史授权文本；
- N-1：query/JSON/command 等多行示例是否使用 fenced code block，能否复制且没有单反引号包多行；

同时不要只核对上述五点：主动寻找会让实施者猜测的其它 contract、owner、scope、tree unchanged、8/12/10/7 分母、error augmentation、foundation、seed 顺序或授权缺口。发现问题必须给出当前文件/行或 symbol、反例、severity 和最小修复；找不到问题也要说明核验路径。

## 4. Verdict 格式

先声明 fresh blind review，之后输出：

```text
REVIEW_TARGET=DESIGN
REVIEW_CYCLE_ID=2026-09-14-v2s-extension-field-list-search-design
REVIEW_ROUND=2
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
BLIND_DECLARATION=...
VERDICT=GO 或 NO-GO
M/S/N=x/y/z
ROUND_FINAL_DECISION=SELF_DECIDED
```

每条 finding 标明 `CONFIRMED`、`PARTIALLY_CONFIRMED`、`REJECTED_WITH_EVIDENCE` 或 `UNVERIFIED_REQUIRES_EVIDENCE`，并区分 L1 engineering、L2 user-visible、L3 dynamic unverified。round 2 是本 DESIGN cycle 的最终独立轮次；不得建议第三轮。若仍有产品/Journey 歧义，明确交回 Dexter，不得擅自放宽范围或授权。
