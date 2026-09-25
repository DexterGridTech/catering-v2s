# Roadmap 机制退役 IMPLEMENTATION 独立复审

REVIEW_TARGET=IMPLEMENTATION
REVIEW_CYCLE_ID=2026-09-25-roadmap-mechanism-retirement
REVIEW_ROUND=2
reviewerKind=INDEPENDENT_SUBAGENT
REVIEW_SCOPE=Roadmap 机制退役治理清理

## 首轮复审

结论：`NO-GO`，`M/S/N=0/1/1`。

- `S`：`contracts/policy/affected-l2-registry.json:240` 仍保留 “Roadmap status mutation” 的 active policy 文案。该文案不再依赖已退役机制，但会继续传播过期控制面概念。
- `N`：本地存在空父目录 `doc/roadmaps/`。

处置：将 policy 文案改为不授权 UAT、DEV seed/reset、动态环境、数据操作及当前任务授权/状态变更；移除空父目录。

## 第二轮独立复审

结论：`GO`（仅限本批 Roadmap 机制退役 IMPLEMENTATION 范围），`M/S/N=0/0/2`。

独立 reviewer 确认：

- 删除清单中的 registry、四个 Roadmap 文件、registry 工具、两个 retired checker、旧 kernel、transfer memory 与空目录均不存在；
- AGENTS、平台 README、session-start、agent-context、prompt-route、scripts/list 与四个 `.agents/skills` 已不再把退役机制作为当前授权源；
- 新 kernel、required-inventory、generated index 与六维查询一致，旧授权 assertion 与 transfer memory 不在 active memory；
- 受限残留只有新决定及其文件名引用、替代决定文件名引用、退役标签与冻结历史 `roadmapStep` 字段；
- `contracts/policy/affected-l2-registry.json:240` 已不再出现退役机制文案；
- 本批没有 UI-bearing 行为，动态环境未运行符合新决定静态-only 边界。

## 非阻断 notes

- `tools/capability-invariants/cli.mjs:8`：`provider-free-context` 与 `foundation-standard-actions` 仍因既有的 `scripts/lib/catalog-inventory-openapi.mjs` 依赖问题失败；该文件不属于本批 Roadmap 退役范围。
- `tools/verify-gates/verify.mjs:20,210`：`scripts/verify` 的当前首败是四个无关 store-terminal 文件的 `frontend-format`，未将该失败归因于本批治理清理。

