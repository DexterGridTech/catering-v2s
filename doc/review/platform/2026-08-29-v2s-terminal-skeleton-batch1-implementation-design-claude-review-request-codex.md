# TER 骨架批一 implementation-facing 详设与实施计划 · Claude review request

```text
REVIEW_STATUS=READY
REVIEW_KIND=IMPLEMENTATION_FACING_DESIGN
DELIVERY_SCOPE=TER_SKELETON_BATCH1_14_PACKAGES
INTERNAL_REVIEW_CYCLE_ID=TER_SKELETON_BATCH1_DESIGN_20260829
INTERNAL_REVIEW_ROUNDS=2/2
INTERNAL_FINAL_SELF_DECISION=GO_FOR_CLAUDE_REVIEW
```

## 背景

TER 骨架需求已经过 Codex 两轮 review、Claude 全量处置与 Dexter 接受。Dexter 已授权形成详设、实施计划
和批一实施，但要求两份设计材料先交 Claude 独立评审。本次只交付 Codex 的 implementation-facing 详设与
实施计划，没有创建任何 TER 包，也没有开始批一实施。

Codex 内部 fresh 独立审查 R1 为 `NO-GO M/S/N=0/3/1`，R2 为 `NO-GO 0/1/0`。确认项已全部按
owning source 最小修复；两轮上限后作者记录 `FINAL_SELF_DECISION=GO_FOR_CLAUDE_REVIEW`。该自决不是
Claude 结论，不能作为本轮评审证据。

## 评审目标

请以“找出为什么这两份设计仍不能直接实施”为立场，独立确认：批一 14 包的建设顺序与边界是否完整、
脚手架阻断是否诚实且可复跑、规格/声明/import/入口/tsc/Metro 是否形成最小真实闭包、Turbo 与仓级 verifier
是否可按当前源码接线，以及是否仍存在全部判据通过但骨架没有真正建成的路径。

## 需阅读文件

- `AGENTS.md`：仓内执行、审查与授权边界；
- `PLATFORM-BLUEPRINT.md`：平台目标与终端位置；
- `CLAUDE.md`：共同设计原则、右尺寸标尺与 findings 处置规则；
- `doc/plans/platform/2026-08-29-v2s-terminal-skeleton-requirements-claude.md`：已接受需求正本；
- `doc/plans/platform/2026-08-29-v2s-terminal-skeleton-implementation-design-codex.md`：待评详设；
- `doc/plans/platform/2026-08-29-v2s-terminal-skeleton-implementation-plan-codex.md`：待评实施计划；
- `doc/platform/terminal-coding-standard.md`：TR-01 至 TR-09、三重命名、依赖方向与骨架例外正本；
- `doc/platform/frontend-coding-standard.md`：TER 引用的前端规范正本；
- `project-memory/decisions/terminal-architecture-and-stack-rulings.md`：架构与技术栈裁定；
- `project-memory/decisions/terminal-build-order-and-batches.md`：22 包与两批顺序；
- `project-memory/operations/terminal-coding-standard.md`：规范路由指针；
- `doc/decisions/templates/implementation-design-template.md`：详设固定结构；
- `doc/review/platform/2026-08-29-v2s-terminal-skeleton-batch1-design-independent-review-codex.md`：内部 R1 原始 verdict；
- `doc/review/platform/2026-08-29-v2s-terminal-skeleton-batch1-design-independent-review-r2-codex.md`：内部 R2 原始 verdict；
- `package.json`、`.yarnrc.yml`、`tools/verify-gates/verify.mjs`：当前 workspace、age gate 与仓级 verifier 事实。

## 独立核验重点

1. 不采信作者 self-decision，先从需求、规范、记忆和当前源码建立独立基线。
2. `create-expo-module` 完整闭包是否仍诚实标为 `UNVERIFIED_REQUIRES_EVIDENCE`；固定官方
   `create-expo-module@57.0.1` + `expo-module-template@57.0.1 --source` 的候选命令、阻断和替代路径是否足够，
   以及 scratch 成功有没有被错误升级为 adapter 入仓完成。
3. assembly 是否真正固定为 `create-expo-app@4.0.0` +
   `expo-template-blank-typescript@57.0.18 --no-install`；raw template 的 Expo/RN 偏差、后续 `expo install`
   版本源、npm age gate 与规范化步骤之间有没有循环或必须猜的地方。
4. `skeleton-graph.ts` 是否只有一处规格、完整 22 节点、批一投影 14；package path/npm name 是否应派生；
   dependency/devDependency、孤儿、闭包与 batch 过滤是否可机械实现而不复制第二张图。
5. 真实入口是否严格为 `index.ts -> App.tsx -> skeletonBootstrap.ts`；bootstrap 的本地 `./index`
   是否确实代表 assembly package root，且不误算 package self-edge；其余 13 个 npm root 是否全部被值消费，
   删任一 import 是否必红。
6. 四个 Turbo 聚合脚本的固定 filters 是否可用；typecheck 的 CP-1/2/3/4/5 分母 0/7/12/13/14，
   最终 dry-run 的 typecheck/test/lint/clean exact-set 14/1/0/0 是否与脚手架 scripts 和“不跑 test”边界一致，
   并且不会触发 `apps/frontend/*`、`libraries/frontend/*` 或聚合包递归。
7. 图比对、逐包 tsc 与 assembly Android export 三条是否足以阻断 false-green；特别检查
   dependencies.ts 的真实 package-root import、UI peer/devDependency 解析、Metro 只证明入口可达集合的边界。
8. `verify:static` 与 `verify` 的 marker 契约是否匹配 `tools/verify-gates/verify.mjs` 的真实 static/runtime
   行为；六道门是否各有 red+green control，TR-01 空过是否没有被冒充为已生效。
9. adapter/assembly 原始树的保留、删除、改写和最终形状是否逐项可执行；是否误删脚手架 test helper、
   手写 native 配置，或把 Android Gradle/Kotlin、真实 22 包、实际 Turbo task、实际 verify 时长说成已证明。
10. 整体是否右尺寸：这些工具是证明骨架关系所需的最小集合，而不是新的 governance/control plane；
    有没有更小且不丢失反证能力的方案。

## 期望结论

请给出明确 `GO` 或 `NO-GO`，并汇总 `M/S/N` 数量。每条 finding 请包含精确文件与行号、仓内事实或
外部事实/推论/`UNVERIFIED` 分类、可证伪失败条件、后果、最小修复，以及为什么更小修复不足。
如涉及供应链保护、产品范围或授权扩大，请单列“需 Dexter 裁决”并给候选选项。请明确列出实际运行的
命令、退出码和与文档不符的输出，以及没有核到的部分。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请协助独立评审 TER 骨架批一的 implementation-facing 详设与实施计划。

背景：TER 骨架需求已经过 Codex review、你的处置与 Dexter 接受。Dexter 已授权 Codex 形成详设、实施计划和批一实施，但要求设计材料先交你独立评审。本轮只评两份设计材料；尚未创建 TER 包，也未开始批一实施。Codex 内部 fresh 审查 R1 为 NO-GO（M/S/N=0/3/1），R2 为 NO-GO（0/1/0）；确认项已修复并在两轮上限后自决为 GO_FOR_CLAUDE_REVIEW。请不要把该自决当作你的证据。

目标：请以“找出为什么它仍不能直接实施”为立场，独立核验批一 14 包的顺序与边界、脚手架可复跑阻断、22 节点规格到 14 节点投影、依赖声明与真实 import、assembly 入口可达集合、逐包 tsc、Metro、Turbo 过滤、两条 verifier 及 marker 契约是否形成右尺寸且无 false-green 的闭包。

请从 catering-v2s 仓库根阅读：
- AGENTS.md、PLATFORM-BLUEPRINT.md、CLAUDE.md；
- doc/plans/platform/2026-08-29-v2s-terminal-skeleton-requirements-claude.md（已接受需求）；
- doc/plans/platform/2026-08-29-v2s-terminal-skeleton-implementation-design-codex.md（待评详设）；
- doc/plans/platform/2026-08-29-v2s-terminal-skeleton-implementation-plan-codex.md（待评计划）；
- doc/platform/terminal-coding-standard.md、doc/platform/frontend-coding-standard.md；
- project-memory/decisions/terminal-architecture-and-stack-rulings.md；
- project-memory/decisions/terminal-build-order-and-batches.md；
- project-memory/operations/terminal-coding-standard.md；
- doc/decisions/templates/implementation-design-template.md；
- doc/review/platform/2026-08-29-v2s-terminal-skeleton-batch1-design-independent-review-codex.md（内部 R1 原始 verdict）；
- doc/review/platform/2026-08-29-v2s-terminal-skeleton-batch1-design-independent-review-r2-codex.md（内部 R2 原始 verdict）；
- package.json、.yarnrc.yml、tools/verify-gates/verify.mjs（当前事实）。

请重点独立核验：
1. create-expo-module 完整闭包仍是 UNVERIFIED_REQUIRES_EVIDENCE，固定 CLI/template source 的候选命令不能替代 CP-0 仓内证据，也不能提前解除 adapter 阻断；
2. create-expo-app 已固定到 4.0.0 与 template 57.0.18，但 raw Expo ~57.0.16/RN 0.86.2 与目标 ~57.0.18/0.86.3 不同；expo install 版本源、age gate、UI peer/devDependency 与规范化顺序是否可复跑且无循环；
3. skeleton-graph.ts 是否是唯一规格、完整 22 节点并正确投影批一 14；图门是否从 package.json 与全部 TS import 派生事实，而非维护第二张图；
4. index.ts → App.tsx → skeletonBootstrap.ts 是否真可达；bootstrap 用本地 ./index 纳入 assembly root、用 13 个 npm root 纳入其余包是否正确，且不会制造 package self-edge；
5. Turbo 固定 filters 与 staged typecheck 分母 0/7/12/13/14 是否成立；最终 typecheck/test/lint/clean dry-run exact-set 14/1/0/0 是否与“adapter test 保留但本批不跑”一致，并严格排除 frontend、library 与聚合包递归；
6. 图比对、逐包 tsc、入口可达 Metro export、六门正负控制及 verify:static/verify marker 是否共同堵住 false-green；expo export 是否没有越界证明 native；
7. adapter/assembly 规范化保留/删除表是否可执行，Android Gradle/Kotlin、真实 22 包、Turbo 实际任务列表、verify 实际时长等 UNVERIFIED 是否都被诚实保留；
8. 整体是否为证明骨架关系所需的最小机制，有无更小且不损失反证能力的替代。

烦请给出明确 GO 或 NO-GO，并汇总 M/S/N 数量。每条 finding 请带精确文件与行号、事实类别（仓内事实/外部事实/推论/UNVERIFIED）、可证伪失败条件、影响面、最小修复及为何更小方案不足；需产品、供应链或授权选择时单列“需 Dexter 裁决”。同时请列出实跑命令与退出码、文档不符项，以及未核到部分。

授权边界：你的 GO 只表示这两份详设与实施计划可作为 Dexter 已授权的 Codex 批一实施输入；在 GO 前 Codex 不开始创建包。它不授权批二、任何包能力实现、Android Gradle/Kotlin 构建、真机、DEV、reset、seed、浏览器 L2、UAT、部署或 EAS，也不要求你实施任何改动。谢谢。
```
