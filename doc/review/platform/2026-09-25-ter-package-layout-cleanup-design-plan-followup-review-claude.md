# TER 包布局整理 · 详设与实施计划 follow-up 评审（Claude）

```text
REVIEW_TARGET=DESIGN（follow-up，不是新的盲审轮次）
VERDICT=NO-GO
M/S/N=0/2/1
```

```text
评审对象（SHA-256 前 16 位）：
  doc/plans/platform/2026-09-25-ter-package-layout-cleanup-implementation-design-codex.md  c324de6961c7469d
  doc/plans/platform/2026-09-25-ter-package-layout-cleanup-implementation-plan-codex.md    fb3f8a60fe62401c
  doc/review/platform/2026-09-25-ter-package-layout-cleanup-design-review-handoff-codex.md  b7e293b976363df3
上轮评审：doc/review/platform/2026-09-25-ter-package-layout-cleanup-design-plan-review-claude.md（NO-GO 0/5/2）
EVIDENCE_TIER=仅静态：Claude 回读源码、检查器与 runner；未运行任何命令
SESSION=CONTINUED_SESSION（v2s 仓根，经上下文压缩续接，不是 fresh acceptance）
AUTHORITY=本评审不授权实施、安装、构建、Web、设备或任何数据操作
```

## 1. 上轮 7 处的核对结果

**已修好（5 处）**

- **S-2 AC-3**：
  - 四组 gate 与报文前缀唯一，并在检查器中真实存在：layering `check-static.mjs:197` 的 `P-5a reverse dependency ${layer}->${targetLayer} (…)`；skeleton `check-static.mjs:1174,1230` 的 `HYGIENE_FAILURE:scaffold metadata remains:`。
  - 补上了 ui→application；`plannedDependencies` 改由 AC-2(a) 零命中负责；表中不再有“或”。
- **S-4 记忆同步**：
  - 三份描述当前结构的记忆直接改为现状；
  - `terminal-build-order-and-batches` 只追加带日期的取代条目；
  - TR-16 锚点手工同步；
  - index 由生成命令产生（计划第 716–723 行）。
- **S-5 readability**：
  - 正好 11 行（详设第 222–232 行），每行都有目标参数对象或 helper、锁定行为的现有测试名，以及新增的 focused 测试；
  - TR-R03 与 TR-R06 仍单独处理。
- **N-1**：两份文档中已无本机绝对路径。
- **N-2**：SECONDARY 改为 `uiautomator dump --windows` 加 `<display id>` 分段解析，复用 runner 第 239–266 行的逻辑。

**基本修好，仍有残余（2 处）**，见 §2：
- S-1 AC-10：匿名态步骤、Web URL、JSON 类型、readiness 出处都已改对，但 W-2/D-2 的登出路径不存在。
- S-3 逐处分类：标识符 50 行、散文 28 行已列，但漏了两个入口文件和全部 README。

## 2. Findings

### S-1 · wallpaper App 没有产品内登出，D-2 的匿名态只能靠清除 App 数据 · CONFIRMED · DEXTER_DECISION

**仓内事实**
- 详设第 761–765 行的匿名态第 1 步写的是：“优先使用产品内 `sample.desk.member-list:logout` 登出，等待 W-1 的登录页，或 W-2 的 PRIMARY 登录页与 SECONDARY 等待页”。
- 这个登出按钮属于 member desk（`sample-member-desk/src/components/{laptop,mobile}/MemberList.tsx:30`）。wallpaper integration 只装了 staff-auth 与 wallpaper-picker（`sample-wallpaper-console/src/assembly/assembly.tsx:12-13,71-72,98-99`），界面上没有任何登出入口；仓内只有 actor 在处理 `logoutSucceededCommand`。
- 因此：
  - W-2（Web）可以退到第 2 步，清除 `sample-wallpaper-console-web` 持久化键，可以执行；
  - D-2（设备）若留有登录态，唯一路径就是第 3 步“清除 App 数据”。而第 3 步被定为“须 Dexter 单独授权，默认不执行”。
- 上一批键盘设备运行的首败，正是 wallpaper 设备已处于登录态。

**影响**：不事先决定，D-2 很可能记为 OPEN，AC-10 无法收口，本批也就不能按“全部完成”结束。

**需 Dexter 选一项**
- **(a) 推荐**：现在就授权 D-2 前置步骤。仅在单机双屏虚拟机上，对 sample-wallpaper-terminal 执行一次清除 App 数据；仅当启动后不是匿名态时执行，并记录清除前后的状态。这台是测试设备，被清除的只是 sample App 的数据。
- **(b)**：不授权，接受 D-2 在设备端记为 OPEN。

**最小修复**：
- 详设与计划注明，产品内登出只适用于 W-1/D-1；
- W-2 走清除持久化键，D-2 走 Dexter 选定的路径。

### S-2 · 逐处分类漏了 AGENTS.md、CLAUDE.md 和全部 README · CONFIRMED · 需 Dexter 裁决：否

**仓内事实**
- 28 行散文表（详设第 633–660 行）没有以下内容：
  - `AGENTS.md:53`（“再到虚拟机或真机运行 `assembly` 包”）；
  - `CLAUDE.md:49`（“再上设备跑 `assembly`”）。
  - 两处都是 TR-16 的转述，属于层义，必须改。详设 §9.1 的原则表写了要改，但逐行表没有收录。
- `apps/terminal/**/README.md` 中含 assembly 一词的有 84 行，一行也没进表。其中很多是层义，例如 sample-terminal README 的 12 处、sample-wallpaper-console README 第 12 行的 “Android assembly”。
- 需求 PL-R01 把各包 README 列入正本范围，AC-11 要求逐处分类。
- README 中不带引号的散文，AC-2 的任何扫描都抓不到。

**影响**：按现表实施，两个入口文件与大量 README 会残留旧层名，与 TR-10“README 必须准确”冲突。

**最小修复**：逐行表补上这两行，以及 84 行 README 命中，逐行标类别、处置与理由。

### N-1 · darkMode 红测试的报文前缀没有写死 · CONFIRMED

- 详设 §9.3 中 darkMode 那一行的报文前缀写作 `Error: ... darkMode ...`，不是确定的前缀。
- 最小修复：写出 D-6 之后 `check-native-projection.mjs` 实际的报错文本前缀。

## 3. 核实成立（本轮新增内容）

- **AC-10**：
  - W-1 的 URL 为 `?surfaceForm=mobile`。W-2 的双屏预览通过选择 `sample-wallpaper-console:test-expo:surface-mode:dual` 进入，该 testID 来自 `dev-host/src/components/testExpoApp.tsx:634`，文档也写明“不存在 dual URL 参数”。
  - 持久化键 `sample-console-web`、`sample-wallpaper-console-web` 与 `test-expo/App.tsx:11` 一致。
  - JSON 类型与 `startupDiagnosticsWriter.ts:13-20` 一致。
  - readiness 出处改为 `getStartupReadiness`。
- **S-3**：50 行标识符与我先前实测的 50 处一致；`assemblyPromises` 归为装配义，符合其含义（createAssembly 返回的 promise）；第 974 行保留。
- **CP-0 至 CP-4**：锁文件协议、三道门与全部子门、逐代码对账、`TR-08=OPEN` 的边界，与上轮一致，没有被本轮修订破坏。

## 4. 方案合理性

方向与主体不变，本轮修订没有引入新的设计问题。剩下的 S-2 是分类表覆盖面问题；S-1 需要 Dexter 给一个授权决定，文档里写一行即可。

UI 自问：NOT_APPLICABLE 成立。

## 5. 结论与下一步

- Dexter 对 S-1 选 (a) 或 (b)。
- Codex 补齐 S-2 与 N-1，并按 Dexter 的选择改写 S-1 的前置步骤。
- 这几处都是局部补写，修完后是否再交 Claude 复审，由 Dexter 决定。本评审不授权实施。
