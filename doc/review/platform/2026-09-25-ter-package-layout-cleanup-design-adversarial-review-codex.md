# TER 包布局整理 DESIGN 独立盲审与处置记录

> REVIEW_TARGET=DESIGN
> REVIEW_CYCLE_ID=`TER_PACKAGE_LAYOUT_CLEANUP_2026-09-24`
> REVIEW_ROUND=2
> REVIEW_ROUND_LIMIT=2
> reviewerKind=INDEPENDENT_SUBAGENT
> ROUND_FINAL_DECISION=SELF_DECIDED
> implementationAuthority=false

## 1. 输入与边界

本轮输入为当前字节的 v5 需求、方案、Codex implementation-facing 详设、实施计划、项目记忆指定条目、
`AGENTS.md`、TER coding standard、模板、前两份 Codex 评审及 Claude intake。独立 reviewer 只读检查，未修改
源码、测试、依赖、文档或构建产物，未运行 install/build/Web/Metro/Android/设备，未使用 computer use。

输入清单：

```text
doc/plans/platform/2026-09-24-ter-package-layout-cleanup-formal-requirements-claude.md
doc/plans/platform/2026-09-24-ter-package-layout-cleanup-solution-claude.md
doc/plans/platform/2026-09-25-ter-package-layout-cleanup-implementation-design-codex.md
doc/plans/platform/2026-09-25-ter-package-layout-cleanup-implementation-plan-codex.md
doc/review/platform/2026-09-25-ter-package-layout-cleanup-design-granularity-manifest-codex.json
AGENTS.md
doc/platform/terminal-coding-standard.md
project-memory/operations/terminal-coding-standard.md
project-memory/decisions/terminal-architecture-and-stack-rulings.md
project-memory/decisions/terminal-build-order-and-batches.md
project-memory/practices/ter-input-and-virtual-keyboard-usage.md
```

## 2. Round 1

fresh reviewer：Poincare，`agent_id=01a0d417-e368-78e0-9e36-c31fb52be67f`，只读 critic。

```text
VERDICT=NO-GO
M/S/N=3/2/0
```

Finding 1（M1，CONFIRMED）：CP-1/2/3 同时预期生成 workspace lock diff、又只运行
`yarn install --immutable`；Yarn 会在 lockfile 需要修改时 abort。证据为第一版计划 §2、CP-1/2/3 安装块及
当前 `yarn install --help`。处置：详设与计划统一为普通 `yarn install` 生成、`diff -u` 按本 CP allowed
hunk 对账、`yarn install --immutable` 复验，并写明 external version/未登记 hunk 立即停止。

Finding 2（M2，CONFIRMED）：CP-3 的 `find ... -print0 | xargs shasum` 会把目录传给 `shasum`。当前只读
执行 `shasum -a 256 apps/terminal/assembly` 复现 `Is a directory`。处置：目录用 `find -type d` 输出清单，
文件用 `find -type f -print0 | sort -z | xargs -0 shasum -a 256`。

Finding 3（M3，PARTIALLY_CONFIRMED）：AC-10 将 key 冻结推迟给实施者。处置：从当前 owning source 回读，
在详设与计划中冻结 `sample.auth.login`、`sample.wallpaper-console.waiting`、testID 与具体 actor/parts/component
行号；任何后续 source 变化必须先记 DESIGN_GAP/行为变化。

Finding 4（S1，CONFIRMED）：四个待下线包存在 ignored `.turbo/turbo-typecheck.log`，archive file set 只写
受控 source 文件。处置：CP-0 先写完整 ignored inventory，再精确清理四个 package-local `.turbo`，CP-1 archive
manifest 写 `ignoredInventoryRef`、清理前/归档时 ignored entries，恢复边界不使用 glob。

Finding 5（S2，CONFIRMED）：`darkMode` active corpus 零命中与 checker/test 负向 guard token 的证伪要求冲突。
处置：零残留只适用于 runtime/config/business-test corpus；checker/test guard 进入 AC-11，保留其诊断和 red mutation
能力。

## 3. Round 2

fresh reviewer：Ramanujan，`agent_id=01a0d422-10bd-7bc1-8ee5-210e83b08f2a`，在 Round 1 修订后重新只读盲审。

独立结果（修订前）：

```text
REVIEW_TARGET=DESIGN
VERDICT=NO-GO
REVIEW_ROUND=2
REVIEW_ROUND_LIMIT=2
ROUND_FINAL_DECISION=SELF_DECIDED
M/S/N=0/3/0
```

### S-1：CP-2 子门清单低于硬要求（CONFIRMED）

证据：v5 AC-6 要求每一步三道门和全部子门全绿；修订前计划 CP-2 只列 typecheck/test/verify、startup
diagnostics、behavior，未显式列 skeleton、layering、ui-state、readability、native-projection、
production-bundle、image-compare、keyboard。处置已落在
`doc/plans/platform/2026-09-25-ter-package-layout-cleanup-implementation-plan-codex.md:354-380`：CP-2
现与 CP-1/CP-3 同样列出完整 AC-6 子门，另保留 startup/behavior 专属门。计划 §2/§3 的退出条件仍要求全部
子门 exit 0。

### S-2：AC-11 计划遗漏 active `doc/decisions/**`（CONFIRMED）

证据：v5 AC-11 明确要求覆盖仍生效的 `doc/decisions/**`，当前
`doc/decisions/2026-09-11-v2s-terminal-admin-console-journey-proposal-codex.md` 确有 assembly 命中；详设
已有分类原则，但计划文件集没有显式分母。处置已落在
`doc/plans/platform/2026-09-25-ter-package-layout-cleanup-implementation-plan-codex.md:623-641`：加入
“所有 active decision”及当前已知命中文件，并要求逐处进入 AC-11 表；历史 records 仍按 AC-12 不改写。

### S-3：CP-4 前置门与 CP-1/2/3 安装协议边界不清（CONFIRMED）

证据：修订前计划 §7.1 写“任何安装/构建/Web/设备阶段”都必须当前 CP 全绿；CP-1/2/3 又必须先安装再得到
当前 CP 全绿，按字面形成循环。处置已落在
`doc/plans/platform/2026-09-25-ter-package-layout-cleanup-implementation-plan-codex.md:44-46,487-500`：
§7.1 明确只适用于 CP-4 构建/Web/设备（及 CP-4 后再安装）；CP-1/2/3 staged install 只要求上一 CP MATCHED、
当前 source/file-set 快照和 lock protocol 已冻结，安装后再完整跑自身三道门与全部子门。这样没有放宽任何 v5
结束条件，只去掉自引用循环。

## 4. Round 2 后作者收口

Round 2 是本 DESIGN cycle 的最后一轮；不再开启第三轮。主 agent 对三条 finding 完成上述最小文档修订后，
重新逐行回读计划与详设，确认：

- CP-2 命令块与 CP-1/CP-3 子门集合一致；
- active file 分母明确包含 `doc/decisions/**`，且 AC-11/AC-8 共用逐处分类表；
- CP-1/2/3 staged install 与 CP-4 expensive-stage preflight 的边界互不循环；
- 第一轮五项修订仍保留：lock 生成/immutable 双阶段、目录/文件 checksum 分离、AC-10 具体 key、ignored archive
  记录、darkMode corpus 分类；
- `IMPLEMENTATION_AUTHORITY=false`、TR-08 `OPEN/OUT_OF_SCOPE`、TR-16 Web→device 与“本轮不实施”均未被改写。

作者最终处置：`SELF_DECIDED=READY_FOR_CLAUDE_REVIEW`。该自决不是把独立 reviewer 的修订前 NO-GO 改写为其原始
GO，而是记录已接受并完成的三条最小文档修复；独立 round 数仍为 2，后续由 Dexter/Claude 评审决定是否进入实施。
