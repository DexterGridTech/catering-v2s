# Roadmap 机制退役 IMPLEMENTATION 静态复审请求

REVIEW_TARGET=IMPLEMENTATION
REVIEW_SCOPE=Roadmap 机制退役治理清理的 follow-up 静态复审
PRIOR_REVIEW=NO-GO,M/S/N=0/1/5

## 背景

Dexter 已裁定退役并删除 Roadmap 机制，当前任务与授权只来自 Dexter 在会话中的明确指派。Claude 上一轮
静态复审指出 6 处问题：入口文件仍冻结 backend-acceptance 的过期范围，heritage kernel 的 sourceRefs
指向无关决定，`scripts/list` 仍输出 R1 状态，scripts README 仍有欠账计数，active document index 仍把
已退役矩阵标为 active，以及两个冻结证据中的 `V2S_W0_W4_EXECUTION` 尚未登记。本轮已按授权修订入口
文档、项目记忆、脚本和保留清单；不改业务代码、运行期行为、依赖、构建配置或动态环境。

## 评审目标

请只对当前治理文件和脚本字节做独立 IMPLEMENTATION 静态复审，确认：

1. 入口文件只表达 backend-acceptance 的自动发现规则，不冻结场景数量、业务域或场景文件清单；同根入口残留已同步收敛；
2. `kernel.heritage-change`、`required-inventory.json` 与生成 index 的三个 Heritage assertion 均以 `AGENTS.md` 为 owning source；
3. `scripts/list` 不再输出 R1 阶段状态，保留的脚本仍是可执行的静态命令目录；
4. active document index 不再把已退役的 standards coverage matrix 标为 active enforcement；
5. 两个 `V2S_W0_W4_EXECUTION` 只作为冻结证据兼容字段保留，并已在新决定中登记；
6. 本轮没有误改历史 review/plan/evidence、带 R 编号的历史 decision 或冻结证据源文件。

## 需阅读文件

- `doc/decisions/2026-09-25-v2s-roadmap-mechanism-retirement.md`：本批替代口径、删除清单与保留清单；
- `AGENTS.md`、`CLAUDE.md`、`PLATFORM-BLUEPRINT.md`、`HANDOFF.md`：入口规则与 backend-acceptance 口径；
- `doc/platform/README.md`、`doc/platform/active-document-index.json`：平台入口与 active document 导航；
- `scripts/README.md`、`scripts/list`、`scripts/hooks/session-start`、`scripts/check/agent-lifecycle`：脚本目录、入口输出与静态门；
- `project-memory/kernel/06-heritage-and-change.md`、`project-memory/required-inventory.json`、`project-memory/index.md`、`project-memory/index.json`：Heritage source/assertion 与生成索引；
- `contracts/policy/frontend-asset-carryover-manifest.json`、`tools/platform-boundary-gates/cli.mjs`：保留的冻结证据程序标识；
- `doc/review/platform/2026-09-25-v2s-roadmap-mechanism-retirement-implementation-static-review-claude.md`：上一轮 finding 与验收要求。

## 独立核验重点

1. 用 `rg` 检查 `AGENTS.md`、`CLAUDE.md`、`PLATFORM-BLUEPRINT.md`、`HANDOFF.md`、`doc/platform`、`scripts/README.md`、`scripts/list`：backend-acceptance 不再出现过期场景数量/业务域/场景文件清单，欠账没有冻结数量，R 编号只作为规则或历史/命令标识，不作为当前进度或授权状态；
2. 核对 `project-memory/kernel/06-heritage-and-change.md` 三个 assertion 的 sourceRefs 为 `AGENTS.md`，required-inventory 的三个 assertionSources 与 generated index 一致，并确认 `AGENTS.md` 的 owning anchor 确实包含三条断言；
3. 运行 `scripts/memory/build-index --check`、`scripts/check/project-memory`、`scripts/check/agent-lifecycle`，确认新 index 与入口 hook 同步；
4. 确认 `scripts/list` 保留静态命令目录且无 Roadmap checker 条目；确认 `doc/platform/active-document-index.json` 不再含 `standards-coverage-matrix`/`ACTIVE_ENFORCEMENT_TRACE`；
5. 检查 `V2S_W0_W4_EXECUTION` 的两个源文件位置与新决定登记一致；源文件本身应保持不改；
6. 本轮不要求 Web、Android、DEV、L2、seed、reset、UAT、虚拟机或真机运行。

## 当前静态结果

- `scripts/memory/build-index`：PASS，`ENTRIES=83 KERNEL=6 ROUTED=77`；
- `scripts/memory/build-index --check`：PASS，`ENTRIES=83 KERNEL=6 ROUTED=77`；
- `scripts/check/project-memory`：PASS；
- `scripts/check/agent-lifecycle`：PASS；
- `scripts/check/claude-review-handoff`：PASS。

## 期望结论

请给出明确的 `GO` 或 `NO-GO`，并使用 `M` / `S` / `N` 逐条列出精确路径与行号、影响面、最小修复建议，以及是否需要 Dexter 产品或范围裁决。不要把历史材料中的 Roadmap 字样、冻结证据字段或无关的既有 frontend-format/capability-invariants 问题误判为本轮当前入口缺陷。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请对 TER/v2s「Roadmap 机制退役」治理清理做一次 REVIEW_TARGET=IMPLEMENTATION 静态复审。

背景：你上一轮复审结论为 NO-GO，M/S/N=0/1/5。本轮已按 Dexter 授权修复 6 处：入口文件的 backend-acceptance 口径改为自动发现规则并移除过期场景范围/域清单/文件清单；kernel.heritage-change 与 required-inventory/index 改由 AGENTS.md 作为 owning source；scripts/list 去除 R1 阶段状态；scripts/README 删除欠账计数；active document index 删除 standards-coverage-matrix 的 active enforcement 条目；新决定登记两个冻结证据中的 V2S_W0_W4_EXECUTION。未修改业务代码、运行期行为、依赖、构建配置或动态环境。

目标：请独立确认上述 6 处修订与当前入口、项目记忆、脚本和冻结证据边界一致，且没有把历史材料或无关问题误改为当前治理状态。

请从 catering-v2s 仓库根阅读：
- doc/decisions/2026-09-25-v2s-roadmap-mechanism-retirement.md：本批替代口径、删除清单与保留清单；
- AGENTS.md、CLAUDE.md、PLATFORM-BLUEPRINT.md、HANDOFF.md：入口规则与 backend-acceptance 口径；
- doc/platform/README.md、doc/platform/active-document-index.json：平台入口与 active document 导航；
- scripts/README.md、scripts/list、scripts/hooks/session-start、scripts/check/agent-lifecycle：脚本目录、入口输出与静态门；
- project-memory/kernel/06-heritage-and-change.md、project-memory/required-inventory.json、project-memory/index.md、project-memory/index.json：Heritage source/assertion 与生成索引；
- contracts/policy/frontend-asset-carryover-manifest.json、tools/platform-boundary-gates/cli.mjs：保留的冻结证据程序标识；
- doc/review/platform/2026-09-25-v2s-roadmap-mechanism-retirement-implementation-static-review-claude.md：上一轮 finding 与验收要求。

请重点独立核验：
1. AGENTS.md、CLAUDE.md、PLATFORM-BLUEPRINT.md、HANDOFF.md、doc/platform、scripts/README.md、scripts/list 中是否不再冻结 backend-acceptance 的场景数量、业务域或场景文件清单，是否不再有欠账计数或 R 阶段进度/授权状态；保留下来的 R 编号只能是规则、历史或命令标识；
2. kernel.heritage-change 的三个 assertion 是否都由 AGENTS.md 的确实 owning anchor 支撑，required-inventory 与 generated index 是否一致；
3. scripts/memory/build-index --check、scripts/check/project-memory、scripts/check/agent-lifecycle 是否通过；
4. scripts/list 是否仍可执行且没有 Roadmap checker 条目，active index 是否移除 standards-coverage-matrix/ACTIVE_ENFORCEMENT_TRACE；
5. V2S_W0_W4_EXECUTION 是否只保留在两个冻结证据源文件，并在新决定中登记，且源文件本身未被改写；
6. 历史 review、plan、evidence、带 R 编号的旧 decision 与其它冻结字段是否保持原样。

请给出明确 GO 或 NO-GO，并按 M/S/N=x/y/z 逐条给出精确路径、行号、事实/反例、影响面、最小修复建议及是否需要 Dexter 裁决。

授权边界：本次只覆盖 Roadmap 机制退役的治理文档、项目记忆、脚本目录、active index 与冻结字段登记；不授权业务代码、运行期行为、依赖、构建、Web、Android、DEV、L2、seed、reset、UAT、虚拟机或真机运行，也不授权修复无关 frontend-format/capability-invariants 问题。谢谢。
```
