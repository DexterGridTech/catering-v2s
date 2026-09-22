# TER UI 业务可读性 CP-3 implementation review

REVIEW_TARGET=IMPLEMENTATION
CP=CP-3
DATE=2026-09-23
REVIEWER_KIND=INDEPENDENT_SUBAGENT

## 独立 verdict 原文摘要

### Reviewer 1

`CP3_GATE=NO-GO`，`M/S/N=2/2/0`。第一失败边界是
`tools/terminal-sample2/run-sample2-frozen-journey.mjs` 的第二份 wallpaper label
dictionary；另指出 sample-wallpaper-console 的 `WaitingLaptop/WelcomeLaptop` 尚属
CP-4 命名迁移范围，以及 wallpaper root catalog export 无批准消费者。

### Reviewer 2

`CP3_GATE=GO`，`M/S/N=0/0/0`，`DESIGN_GAPS=无`。其审查范围为 feature production
scope，确认五个 runner consumer、14 logical/28 sibling parts、业务 failure policy
和 CP-4 integration boundary；dynamic/visual/cleanup 未验证。

## 主 agent intake 与处置

1. wallpaper runner finding：`CONFIRMED`。原 runner 维护独立中文标签。已新增
   `apps/terminal/ui/feature/sample-wallpaper-picker/src/foundations/wallpaperCatalogData.json`
   作为单一数据源，`wallpaperCatalog.ts` 提供类型化入口，runner 改为读取该 JSON；
   用户可见标签与 background 反向映射不变。
2. root public surface finding：`CONFIRMED`。`wallpaperIds`/`wallpaperLabels` 无生产
   消费者，已从 feature `src/index.ts` 与 `terminal-invariants.json` 移除。
3. integration suffix finding：`PARTIALLY_CONFIRMED` for CP-3 scope, `CONFIRMED`
   for overall plan. It remains an explicit CP-4 action and is not represented as closed
   in CP-3 evidence.
4. unrelated worktree finding：`CONFIRMED_AS_SCOPE_BOUNDARY`。CP-3 evidence 不把其他
   task 的 tokens、topology runner 或 integration test changes 当作本 CP 的证明。

## Fresh re-review findings after first remediation

### Reviewer 3

`CP3_GATE=NO-GO`，`M/S/N=1/0/1`。确认 runner label/public export 修复，但发现
`tools/terminal-sample2/check-behavior.mjs` 的 F-A2A/F-A2_SCROLL 仍指向已删除的
`components/WallpaperPicker.tsx`；已改为 laptop/mobile renderer targets。

### Reviewer 4

`CP3_GATE=NO-GO`，`M/S/N=2/2/0`。确认两个 CP-3 gate 级问题：

1. `sample-console/test/sampleAssembly.test.tsx` 用 component function name 的
   Laptop/Mobile 后缀作为 renderer 事实；已改为 partKey/surfaceForm/renderer binding
   断言。
2. wallpaper ID universe 仍由 assets 派生且 runner 有硬编码数组；已改为 JSON data 的
   ids/labels、typed catalog 的 ids-labels-assets exact-set guard、tool adapter 和
   runner 同源 ids。

该 reviewer 同时把 integration admin content timeout/login style drift 标为 CP-4 或
   admin integration 独立 OPEN；本记录不把它归因到 CP-3 hook/part 实现，但也不把
   integration 结果写成 PASS。

## 当前 gate

`CP3_GATE=GO`

## Final fresh review after latest remediation

### Reviewer 5

`CP3_GATE=GO`、`VERDICT=GO_WITH_UNVERIFIED_UI`、`M/S/N=0/0/0`。

确认五个 primary hook 的业务语义、14 logical/28 sibling parts、feature 旧入口负扫、
consumer metadata 断言、wallpaper JSON→typed catalog→tool adapter exact-set，以及当前
picker 与 CP4 laptop-only Waiting/Welcome mutation targets 均与当前字节一致。未做
Web/Android/native/device/visual/dynamic/cleanup。

### Reviewer 6

`CP3_GATE=GO`、`M/S/N=0/0/0`。

独立确认相关 base/feature/integration TypeScript diagnostics 为 0 error/0 warning，且
CP4 integration rename/mechanism consolidation 与 admin content timeout/login style drift
仍是独立后续边界，不构成 CP3 finding。

### Final disposition

CP-3 的最后阻断项是 `check-behavior.mjs` 对 Waiting/Welcome 的 mutation target 与当前
文件不一致；主 agent 已将其修为 `WaitingLaptop.tsx`/`WelcomeLaptop.tsx` 并重跑 syntax、
旧路径负扫及 CP3 focused/typecheck/static proof。两名 fresh reviewer 随后均 GO，CP-3
允许进入 CP-4；dynamic/visual/cleanup 仍未被本步骤 verdict 升格。

需要对上述修订重跑 wallpaper/render/integration focused proof、public invariant、
mutation target 负扫与全库 catalog 负扫，再交 fresh 独立 CP-3 reviewer。未完成前不
进入 CP-4。
