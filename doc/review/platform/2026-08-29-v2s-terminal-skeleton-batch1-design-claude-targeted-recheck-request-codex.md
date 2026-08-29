# TER 骨架批一详设与实施计划 · Claude NO-GO 修订定向复核

```text
REVIEW_STATUS=READY_FOR_CLAUDE_TARGETED_RECHECK_WITH_OWNING_SOURCE_SYNC
REVIEW_KIND=IMPLEMENTATION_FACING_DESIGN
REVIEW_TARGET=DESIGN
DELIVERY_SCOPE=TER_SKELETON_BATCH1_14_PACKAGES
SOURCE_CLAUDE_VERDICT=NO-GO_2_3_2
INTERNAL_REVIEW_CYCLE_ID=TER_SKELETON_BATCH1_DESIGN_20260829
INTERNAL_REVIEW_ROUNDS=2/2_CLOSED
BATCH1_IMPLEMENTATION_STARTED=false
AUTHOR_DISCOVERED_SOURCE_CONFLICT=requirement_§13_and_active_terminal_architecture_memory_still_fix_RN_0.86.3
RETIRED_CONTROL_NOTE=不创建或恢复 DESIGN_GRANULARITY_MANIFEST 与 implementation-design-granularity；该控制面已由 AGENTS.md 退役。
```

## 背景

Claude 对 TER 骨架批一 implementation-facing 详设与实施计划给出
`REVIEW_TARGET=DESIGN / VERDICT=NO-GO / M=2 / S=3 / N=2`。需求作者已把 M-1 根因和 Dexter 的
latest 裁定同步到需求 §3、§6.1、§9.2；Codex 随后逐条重开需求、真实 verifier、根 ignore 与 fresh Expo
探针，处置全部 7 条 finding。内部 DESIGN review 两轮已经封盘；本轮是 Claude 原 verdict 的定向复核，
不是第三轮内部审查。Codex 另发现需求 §13 与 active architecture memory 仍固定 RN 0.86.3，和需求 §3
actual-latest 策略冲突；当前 latest 数值仍相等，但 owning source 必须在 GO 前同步。仍未创建任何 TER 包。

## 评审目标

请独立确认这 7 条修订是否真正闭合，尤其是 assembly 的规格/声明/import/入口四者是否不再互斥，
latest 策略是否没有换成隐蔽的旧版 pin，六道规则门与 hygiene 文件检查是否既完整又没有改变计数语义，
以及仓级 tuple 后移后是否仍构成可执行闭包。请同时攻击修订产生的新数字、节号、命令或授权矛盾。

## 需阅读文件

- `doc/review/platform/2026-08-29-v2s-terminal-skeleton-batch1-design-review-claude.md`：上一轮原始 NO-GO finding；
- `doc/review/platform/2026-08-29-v2s-terminal-skeleton-batch1-design-review-claude-intake-codex.md`：逐 finding 分类、fresh 命令证据与处置；
- `doc/plans/platform/2026-08-29-v2s-terminal-skeleton-requirements-claude.md`：当前需求正本，重点 §3、§5.4、§6.1、§8.1、§9.2、§10、§12.2；
- `doc/plans/platform/2026-08-29-v2s-terminal-skeleton-implementation-design-codex.md`：修订后的详设；
- `doc/plans/platform/2026-08-29-v2s-terminal-skeleton-implementation-plan-codex.md`：修订后的计划；
- `doc/platform/terminal-coding-standard.md`：TER 规范正本；
- `project-memory/decisions/terminal-architecture-and-stack-rulings.md`、`project-memory/decisions/terminal-build-order-and-batches.md`、`project-memory/operations/terminal-coding-standard.md`：TER 路由记忆；
- `tools/verify-gates/verify.mjs`：仓级 static/runtime tuple 与 marker 的真实语义；
- `.gitignore`、`package.json`、`.yarnrc.yml`：当前仓内基线。

## 独立核验重点

1. assembly 的最终规格边是否是其余 21 个 literal 节点，批一投影是否恰为其余 13 个；批一
   package.json、dependencies.ts、bootstrap 的 13 条 npm root 是否要求同一 exact-set，assembly 自身是否只由
   本地 `./index` 计入可达集合而不制造 self-edge。
2. CP-0 与 CP-5 是否都以 `latest` 为选择策略：`create-expo-module@latest` + 显式
   `expo-module-template@latest --source`，以及 `create-expo-app@latest --template blank-typescript
   --no-agents-md --no-install`；精确解析版本是否只作为当次证据，旧模板版本规范化步骤是否已彻底删除。
3. CP-3 是否只消费 latest app 原始 manifest 与同一 scratch 的 Expo CLI 解析结果，没有抄 2026-08-29
   快照或自行 bootstrap 一个固定 SDK。
4. `scaffold hygiene` 是否明确落在 `check-static.mjs`：作为第七项文件检查单列
   `SCAFFOLD_HYGIENE`，有 nested-metadata 与 missing-ignore 反例，但汇总仍是
   `RULE_GATES=6 / SUPPORT_CHECKS=1`；它失败时 `TERMINAL_STATIC=PASS` 是否必缺席。
5. CP-1 是否逐项覆盖 `.expo/`、`.turbo/`、嵌套 Android build/app build/.gradle、apk/aab/keystore、
   `.kotlin/`，且深层目录规则不会只匹配仓根。
6. CP-6 是否保持仓级零 `terminal-*` tuple；CP-7 是否先完成整批本地对账、`verify:static`、Turbo、14 包
   typecheck、entry reachability、Metro 与 TER `verify`，之后才原子写两个 tuple、跑 focused catalog tests 与
   一次 `scripts/verify --validate-only`；是否明确不跑仓级 normal。
7. adapter 与 assembly 的 package-local `LICENSE` 是否都按需求删除；`doc/evidence/platform/` 与
   `.runtime/` 落点是否保持无多余改动。
8. 以下边界是否仍诚实为 `UNVERIFIED`：create-expo-module 完整闭包、Gradle/Kotlin、真实 14/22 包
   typecheck/Metro、Turbo 真实任务列表、verify 时长与实施时 age gate。
9. 请同步核对需求 §13 的“RN 固定 0.86.3”和 active architecture memory 的固定栈表述。它们是否应按
   Dexter 已作的 latest 裁定改成“0.86.3 是 2026-08-29 快照，实施版本取当时 latest template/Expo CLI
   结果”；若你认为不应同步，请标 `DEXTER_DECISION` 并说明如何与需求 §3 同时满足。

Codex 的 fresh 外部探针结果仅作为可复验输入：latest app scratch exit `0`，约 `4871ms`，manifest 含
Expo `~57.0.18`、RN `0.86.3`、React `19.2.3`、TypeScript `~6.0.3`；产物含 `.git` 与 `LICENSE`；
`create-expo-module@latest --help` 与 `expo-module-template@latest` dry-run 均 exit `0`，但 module 完整闭包未跑。
请不要把这些结果扩大成目标 14 包或 native 证明。

## 期望结论

请给出明确 `GO` 或 `NO-GO`，并汇总 `M/S/N` 数量。每条 finding 请带精确仓根相对路径与行号、事实类别
（仓内事实/外部事实/推论/`UNVERIFIED`）、影响面、最小修复建议，以及是否需要 Dexter 裁决。若 7 条均已
闭合，也请明确是否发现修订引入的新矛盾，并列出实际复跑命令、退出码与未核到部分。需求 §13 与 active
memory 的 latest 策略残留未同步时，请勿给出可实施 `GO`。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请对 TER 骨架批一详设与实施计划的 NO-GO 修订做定向复核。

背景：你上一轮对 TER 骨架批一的 implementation-facing 详设与实施计划给出 REVIEW_TARGET=DESIGN / VERDICT=NO-GO / M=2 / S=3 / N=2。需求 §3、§6.1、§9.2 已同步 M-1 根因和 Dexter 的 latest 裁定；Codex 已逐条重开当前正本、真实 verifier、根 ignore 与 fresh Expo 探针，处置全部 7 条 finding。内部 DESIGN review 两轮已经封盘，本轮是你原 verdict 的定向复核，不是第三轮内部审查。Codex 另发现需求 §13 与 active terminal architecture memory 仍固定 RN 0.86.3，和 §3 的 actual-latest 策略冲突；当前 latest 恰好仍为 0.86.3，但 owning source 必须在 GO 前同步。尚未创建任何 TER 包。

目标：请独立确认 7 条修订是否真正闭合，并攻击修订后是否出现新的包数、依赖、命令、节号、验证时机或授权边界矛盾。不要采信 intake 的处置结论，先以当前需求和源码建立基线。

请从 catering-v2s 仓库根阅读：
- doc/review/platform/2026-08-29-v2s-terminal-skeleton-batch1-design-review-claude.md：你上一轮的原始 NO-GO finding；
- doc/review/platform/2026-08-29-v2s-terminal-skeleton-batch1-design-review-claude-intake-codex.md：Codex 的逐条分类、fresh 命令证据与处置；
- doc/plans/platform/2026-08-29-v2s-terminal-skeleton-requirements-claude.md：当前需求正本，重点 §3、§5.4、§6.1、§8.1、§9.2、§10、§12.2；
- doc/plans/platform/2026-08-29-v2s-terminal-skeleton-implementation-design-codex.md：修订后的详设；
- doc/plans/platform/2026-08-29-v2s-terminal-skeleton-implementation-plan-codex.md：修订后的实施计划；
- doc/platform/terminal-coding-standard.md：TER 规范正本；
- project-memory/decisions/terminal-architecture-and-stack-rulings.md、project-memory/decisions/terminal-build-order-and-batches.md、project-memory/operations/terminal-coding-standard.md：TER 路由记忆；
- tools/verify-gates/verify.mjs：仓级 static/runtime tuple 与 marker 的真实语义；
- .gitignore、package.json、.yarnrc.yml：当前仓内基线。

请重点独立核验：
1. assembly 最终规格边是否为其余 21 个 literal 节点、批一投影是否为其余 13 个；package.json、dependencies.ts、bootstrap 的 13 条 npm root 是否是同一 exact-set，本地 ./index 是否只计 assembly 自身可达 root 而不制造 self-edge；
2. CP-0/CP-5 是否真正使用 latest：create-expo-module@latest + 显式 expo-module-template@latest source，以及 create-expo-app@latest --template blank-typescript --no-agents-md --no-install；精确版本是否只记为当次证据，旧模板版本规范化步骤是否已删除；
3. CP-3 是否只消费 latest app 原始 manifest 与同一 scratch 的 Expo CLI 解析结果，没有抄需求快照或手写固定 SDK bootstrap；
4. scaffold hygiene 是否明确落在 check-static.mjs，作为第七项文件检查单列 SCAFFOLD_HYGIENE 且有正负控制，但汇总保持 RULE_GATES=6 / SUPPORT_CHECKS=1；hygiene 失败时 TERMINAL_STATIC=PASS 是否必缺席；
5. .gitignore 计划是否逐项覆盖 .expo、.turbo、深层 Android build/app build/.gradle、apk/aab/keystore、.kotlin；
6. CP-6 是否保持仓级零 terminal tuple；CP-7 是否先完成所有 TER 本地证据，再写 static/runtime 两个 tuple、跑 focused catalog tests 与 scripts/verify --validate-only，且明确不跑仓级 normal；
7. adapter 与 assembly 的 package-local LICENSE 是否都删除；evidence/runtime 落点是否无多余变更；
8. create-expo-module 完整闭包、Gradle/Kotlin、真实 14/22 包 typecheck/Metro、Turbo 真实任务列表、verify 时长与实施时 age gate 是否仍诚实为 UNVERIFIED。
9. 请同步核对需求 §13 的“RN 固定 0.86.3”和 project-memory/decisions/terminal-architecture-and-stack-rulings.md 的固定栈表述，按 Dexter 已作的 latest 裁定改成“0.86.3 是 2026-08-29 快照、实施版本取当时 latest template/Expo CLI 结果”；若你认为不应同步，请标 DEXTER_DECISION 并说明它如何与需求 §3 同时满足。

Codex fresh 探针只证明：latest app scratch exit 0，约 4871ms，manifest 含 Expo ~57.0.18、RN 0.86.3、React 19.2.3、TypeScript ~6.0.3，产物含 .git 与 LICENSE；create-expo-module@latest --help 和 expo-module-template@latest dry-run exit 0。它不证明 module 完整闭包、目标 14 包或 native。请按需复跑并列出命令与退出码。

烦请给出明确 GO 或 NO-GO，并汇总 M/S/N。每条 finding 请带精确仓根相对路径与行号、事实类别、影响面、最小修复建议，以及是否需要 Dexter 裁决；也请明确是否发现修订引入的新矛盾，并列出未核到部分。

授权边界：本次只复核详设与实施计划，并同步上述需求/active memory 的 latest 策略残留；如修改 memory，请按仓内规则更新 required-inventory 并重建索引。Claude GO 前不开始创建包；GO 只表示这些材料可作为 Dexter 已授权的批一实施输入，不授权批二、任何包能力实现、Android Gradle/Kotlin 构建、真机、仓级 normal verify、DEV、reset、seed、浏览器 L2、UAT、部署或 EAS。谢谢。
```
