# TER automation-agent 正式需求 · Claude 评审请求

## 背景

本轮交付单元是 TER automation-agent 统一 UI 自动化的正式需求文档，被审对象的 sha256 为 `bc607783963ca82b46b8b7bd32f2625906948fa4bdb7fff002b7b85a5f2b9955`。目标是让一份旅途脚本同时跑 Expo Web 和原生 Android：定位、查询、真实触发控件，经 selector 订阅数据，发 command 并跟踪 requestId。

文档经过两轮 fresh 独立子 agent 盲审：

- R1：NO-GO，2M/12S/7N；
- R2：GO_WITH_UNVERIFIED_UI，0M/4S/13N，`ROUND_FINAL_DECISION=SELF_DECIDED`，本 cycle 已收口。

收口之后又有两次修订，都没有经过独立评审：

1. 作者落实 R2 的 finding，并做了上下文一致性自审；
2. Dexter 裁定 §7 的五个待决项（不并行、落盘脱敏、一次性顺序做完、忽略 Rive 草案、允许 HOT 打开开关），作者写入正文。

作者会话是续接会话，不是 fresh v2s-rooted 会话。

## 评审目标

请独立核验以下几点：

- 需求是否忠实落实了 Dexter 的全部裁定（文档 §0.2 逐字收录）；
- R-01～R-18 与仓内源码、规范、依赖方向是否成立；
- §3 的可行性准入闸与 §8 的执行顺序是否可执行、是否自洽；
- 方案本身是否合理：问题对不对、方案优不优、代价配不配。

## 需阅读文件

- `doc/plans/platform/2026-10-05-ter-automation-agent-formal-requirements-claude.md`：被审对象，正式需求正本。
- `doc/plans/platform/2026-10-05-ter-ui-automation-requirements-discussion-claude.md`：需求讨论稿，含 Dexter 原话、仓内事实、方案比较与第三方事实。其中部分旧表述已被正式稿取代。
- `doc/review/platform/2026-10-05-ter-automation-agent-formal-requirements-review-r1-claude.md`：第 1 轮独立盲审。
- `doc/review/platform/2026-10-05-ter-automation-agent-formal-requirements-review-r2-claude.md`：第 2 轮独立盲审，即收口轮。
- `doc/review/platform/2026-10-05-ter-automation-agent-formal-requirements-finding-intake-r1-claude.md`：作者对 R1 的处置。
- `doc/review/platform/2026-10-05-ter-automation-agent-formal-requirements-finding-intake-r2-claude.md`：作者对 R2 的处置与收口自审。
- `doc/platform/terminal-coding-standard.md`：TER 规范，重点是 §2-A、TR-03、TR-04、TR-08、TR-16、§4-C。
- `doc/plans/platform/2026-10-02-ter-terminal-activation-interaction-pair-topology-implementation-plan-codex.md`：Codex 在途批次，本专项须排在它之后。

## 独立核验重点

- **裁定是否忠实落实**：§0.2 的每一条原话，是否都落到对应的 R 或 §7 / §8，且没有被缩小或扩大。重点看下面这几条：
  - “每个包都登记 selector”被理解为“凡有 state selector 的包都登记”；
  - “不并行，等 codex 做完”被理解为整个专项在该批次之后才开始；
  - “不管几批要一次性顺序做完”。
- **R-05 selector 登记**：
  - “公开 selector”的定义能否机械判定，纯函数 helper 的排除是否成立；
  - 用 `terminal-invariants.json` 的 `publicExports` 作为门的分母是否可行；
  - 对照 `apps/terminal/kernel/base/runtime/src/types/module.ts` 核验模块契约的扩展面。
- **R-08、R-14 的依赖可行性**：
  - `ui/base/primitives` 没有任何依赖，而 render 依赖它。它能否同时承担注册接缝与 testID 构造函数？节点的 surface 归属从哪里来？
  - 注意 `ui.base.input:` 前缀本身符合新格式。
- **R-09 坐标换算**：仓内先例是 `apps/terminal/ui/base/admin-shell/src/components/AdminLauncher.tsx:36-57`。需求只规定输出契约，算法留给详设，这样处理是否足够？两个 display id 的来源是否成立？
- **R-03、R-04、R-10 的连接与真实输入**：
  - 远端连接不依赖 adb 时，Android 只剩 agent 侧能力；
  - Web 两块 surface 同在一个 DOM 中，locator 须按 surface 限定；
  - 令牌只认证 App、不保护终端，这一点的表述是否准确。
- **R-15 TR-08 例外**：
  - 例外范围是否清楚；
  - 扫描门禁用词同步：`@catering-v2s/ui-base-automation` 是新包名的前缀；
  - `ter-vk://` harness 删除、`ter-failure://` 登记 HANDOFF，这两项处置是否恰当。
- **R-16 runner 删除**：
  - 判别式与清单是否完整，对照 `scripts/test/`、`tools/terminal-topology/`、`tools/terminal-sample2/`；
  - TR-04 重启持久化证明的回归空窗是否写清；
  - 受管运行能力迁移到 driver 的要求（R-13）是否充分。
- **R-17 首个旅途**：
  - 分母取 `tools/terminal-sample2/run-sample1-frozen-journey.mjs:39-45` 的双屏 case 集合是否正确；
  - 前提链（激活、DEV、店员凭据）标为 UNVERIFIED、交给详设，是否会把昂贵动作的授权问题推迟到实施期才暴露。
- **§3 与 §8**：
  - F-1、F-2、F-4a、F-4b 的判据是否都可执行、可证伪；
  - 进入条件与“动态前整体准入”的分工是否清楚；
  - “一次性顺序做完”与“F 闸不通过就停止”是否矛盾。
- **收口后的修订**：sha 依次从 `d96589…` 变为 `8106743…`，再变为 `bc60778…`。这两次修订没有独立 verdict，请特别检查它们是否引入了新的不一致。
- **建议的阅读顺序**：先读被审对象、讨论稿与仓内源码，独立形成结论，再读 R1、R2 与两份 intake 做对照。

已完成的事实：需求文档、两轮独立盲审、作者 intake 与一致性自审、Dexter 对全部待决项的裁定。

仍待处理：

- F-1、F-2、F-4 的可行性事实，以及 R-17 的前提链，都是 UNVERIFIED；
- 全部验收场景 V-01～V-18 为 NOT_RUN；
- 没有任何实现，也没有任何运行。

## 期望结论

请给出明确的 `GO` 或 `NO-GO`。若存在 UNVERIFIED 项，按 `doc/platform/review-standard.md` 给出 `GO_WITH_UNVERIFIED_UI`。

findings 用 `M` / `S` / `N` 标注，每项写明：

- 精确的文件与行号；
- 影响面；
- 最小修复建议；
- 是否需要 Dexter 产品裁决。

请区分仓内事实、外部事实、推论与产品判断，并单列一段“方案合理性”判断。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请协助评审本次 TER automation-agent 统一 UI 自动化正式需求。

背景：这份需求要让一份旅途脚本同时跑 Expo Web 和原生 Android，能定位、查询、真实触发控件，经 selector 订阅数据，并发送 command、跟踪 requestId。文档经过两轮 fresh 独立子 agent 盲审：R1 为 NO-GO（2M/12S/7N），R2 为 GO_WITH_UNVERIFIED_UI（0M/4S/13N），cycle 已收口。收口后又有两次修订，没有经过独立评审：一次是作者落实 R2 的 finding 并做一致性自审，一次是写入 Dexter 对五个待决项的裁定（不并行、落盘脱敏、一次性顺序做完、忽略 Rive 草案、允许 HOT 打开开关）。作者会话是续接会话。被审对象的 sha256 为 bc607783963ca82b46b8b7bd32f2625906948fa4bdb7fff002b7b85a5f2b9955。
目标：请独立核验需求是否忠实落实了 Dexter 的全部裁定（§0.2 逐字收录）；R-01～R-18 与仓内源码、规范、依赖方向是否成立；§3 的可行性准入闸与 §8 的执行顺序是否可执行、是否自洽；并判断方案本身是否合理。

请从 catering-v2s 仓库根阅读：
- doc/plans/platform/2026-10-05-ter-automation-agent-formal-requirements-claude.md：被审对象；
- doc/plans/platform/2026-10-05-ter-ui-automation-requirements-discussion-claude.md：讨论稿，含 Dexter 原话、仓内事实与方案比较；
- doc/review/platform/2026-10-05-ter-automation-agent-formal-requirements-review-r1-claude.md、doc/review/platform/2026-10-05-ter-automation-agent-formal-requirements-review-r2-claude.md：两轮独立盲审；
- doc/review/platform/2026-10-05-ter-automation-agent-formal-requirements-finding-intake-r1-claude.md、doc/review/platform/2026-10-05-ter-automation-agent-formal-requirements-finding-intake-r2-claude.md：作者处置与收口自审；
- doc/platform/terminal-coding-standard.md：TER 规范，重点是 §2-A、TR-03、TR-04、TR-08、TR-16、§4-C；
- doc/plans/platform/2026-10-02-ter-terminal-activation-interaction-pair-topology-implementation-plan-codex.md：Codex 在途批次，本专项须排在它之后。
建议先读被审对象、讨论稿与仓内源码，独立形成结论，再读 R1、R2 与两份 intake 做对照。

请重点独立核验：
1. 裁定是否忠实落实，尤其是三处理解：“每个包都登记 selector”理解为凡有 state selector 的包都登记；“等 codex 做完”理解为整个专项排在它之后；“一次性顺序做完”。
2. R-05：“公开 selector”的定义能否机械判定，用 terminal-invariants.json 的 publicExports 作为门的分母是否可行，对照 apps/terminal/kernel/base/runtime/src/types/module.ts 看契约扩展面。
3. R-08、R-14：ui/base/primitives 没有任何依赖，而 render 依赖它，它能否同时承担注册接缝与 testID 构造函数，节点的 surface 归属从哪里来。
4. R-09：只规定输出契约、算法交给详设是否足够；仓内先例见 apps/terminal/ui/base/admin-shell/src/components/AdminLauncher.tsx:36-57；两个 display id 的来源。
5. R-03、R-04、R-10：远端连接不依赖 adb 时 Android 只剩 agent 侧能力；Web 上 locator 须按 surface 限定；令牌只认证 App、不保护终端的表述是否准确。
6. R-15：TR-08 例外的范围；扫描门禁用词同步；ter-vk:// 与 ter-failure:// 的处置。
7. R-16：runner 判别式与清单是否完整；TR-04 重启证明的回归空窗；受管运行能力迁移到 driver 的要求（R-13）是否充分。
8. R-17：分母取 tools/terminal-sample2/run-sample1-frozen-journey.mjs:39-45 的双屏 case 是否正确；前提链（激活、DEV、店员凭据）留给详设，是否会把昂贵动作的授权问题推迟到实施期。
9. §3 与 §8：F-1、F-2、F-4a、F-4b 的判据是否可执行、可证伪；进入条件与“动态前整体准入”的分工；“一次性顺序做完”与“F 闸不通过就停止”是否矛盾。
10. 收口后的两次修订（sha d96589… → 8106743… → bc60778…）没有独立 verdict，请检查它们是否引入了新的不一致。
已完成：需求文档、两轮独立盲审、作者 intake 与自审、Dexter 对全部待决项的裁定。仍待处理：F-1、F-2、F-4 与 R-17 前提链为 UNVERIFIED，V-01～V-18 全部 NOT_RUN，没有任何实现与运行。

烦请给出明确 `GO` 或 `NO-GO`；若有 UNVERIFIED 项，按 doc/platform/review-standard.md 给出 GO_WITH_UNVERIFIED_UI。如有问题，请按 `M` / `S` / `N` 标注精确文件与行号、影响面、最小修复建议，以及是否需要 Dexter 产品裁决；请区分仓内事实、外部事实、推论与产品判断，并单列一段“方案合理性”判断。

授权边界：本次 GO/NO-GO 只针对这份需求文档的静态评审，不授权详设定稿、实施、规范修订、新增依赖、构建、DEV、设备或任何数据操作；评审期间只可在 doc/review/platform/ 下写一份文件名以 -claude 结尾的评审交付物，其余路径只读。谢谢。
```

交付前执行：

```bash
scripts/check/claude-review-handoff --file doc/review/platform/2026-10-05-ter-automation-agent-formal-requirements-review-request-claude.md
```
