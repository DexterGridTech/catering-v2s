# CP4/B4 fresh independent three-dimensional reconciliation (current bytes)

SKILL_USED=cs-systematic-debugging@808fc5717aa88ad65efff312b11c186294d3e6ee301afb584e2f86599b137787
REVIEW_TARGET=IMPLEMENTATION_RECONCILIATION
REVIEW_CYCLE_ID=2026-09-15-v2s-terminal-sample-infrastructure-uplift-implementation
REVIEW_ROUND=5
reviewerKind=INDEPENDENT_SUBAGENT
REVIEW_SCOPE=CP4/B4
VERDICT=PARTIAL_OPEN_NOT_MATCHED
M_S_N=0/3/1
REVIEW_BOUNDARY=read-only;no test/build/Metro/Web/Android/device/dynamic

## Fresh reviewer conclusion

CP4/B4 当前源码形态多数与 requirements/design/plan 对齐，但不能标记
`MATCHED`：PF-01..PF-10、U10/U12/U13 的当前执行证据、release/APK 生产面证据和
全批动态准入前置仍未闭合。旧记录中的结论不作当前证据。

## Matched current source

- B4 只依赖 B1：`doc/plans/platform/2026-09-14-v2s-terminal-sample-infrastructure-uplift-implementation-plan-codex.md:304-306`、`apps/terminal/skeleton-graph.ts:89-93,176-188`。
- `ui.base.feature-assembly` 的能力模块与可撤销 registration 当前存在：
  `apps/terminal/ui/base/feature-assembly/src/index.ts:5-9,29-39,60-96`。
- `AUTHENTICATION` 仍走 business 分类：
  `apps/terminal/ui/base/render/src/foundations/requestOutcome.ts:1-16`。
- picker 两跳、child result、写入相位与 system notice 接线当前存在：
  `apps/terminal/ui/feature/sample-wallpaper-picker/src/features/actors/actors.ts:28-58,90-104`、
  `.../src/components/WallpaperPicker.tsx:86-124`、`.../src/foundations/writePhase.ts:12-30`。
- system notice 使用 base body、五项 identity、ephemeral layer：
  `apps/terminal/ui/base/render/src/components/SystemFailureNotice.tsx:19-42`、
  `apps/terminal/ui/feature/sample-wallpaper-picker/src/components/WallpaperSystemNotice.tsx:28-32`、
  `.../actors/actors.ts:90-104`。
- sample1 auth/desk identities 与 sample2 picker identity 保持独立：
  `apps/terminal/ui/feature/sample-staff-auth/src/parts/parts.ts:36-55`、
  `apps/terminal/ui/feature/sample-member-desk/src/parts/parts.ts:106-123`、
  `apps/terminal/ui/feature/sample-wallpaper-picker/src/parts/parts.ts:21-40`。
- 当前计划的 U7 已为 native asset-reference closure，U8 为 release cold-start：
  `doc/plans/platform/2026-09-14-v2s-terminal-sample-infrastructure-uplift-implementation-plan-codex.md:403-405`。

## Findings

### S-1 — PF matrix execution remains open

**事实**：PF-01..PF-10 是计划要求的完整 U13 失败注入矩阵，见
`doc/plans/platform/2026-09-14-v2s-terminal-sample-infrastructure-uplift-implementation-plan-codex.md:458-469`；当前
`pickerSystemFailure.test.ts:175-305` 只显示部分 before/after-write 覆盖，不能证明
PF-06 cold restart、PF-07 三条 close path、PF-08 business/no-pending、PF-09 duplicate/
two-feature notice、PF-10 retry success 全部已执行通过。

**边界**：source/focused test shape → 当前 PF-01..PF-10 execution ledger；必须补真实
执行输出，不能把 `tools/terminal-sample2/check-behavior.mjs` 的 A/F 结果当 U13 证据。

### S-2 — U12 cold-restart/lifecycle proof remains open

**事实**：ephemeral serializer/parser 与 notice identity 有源码支撑，但当前
`apps/terminal/ui/integration/sample-wallpaper-console/test/sample2Assembly.test.tsx:244-301`
没有 notice 已打开后 cold restart 不恢复的完整执行记录；三条 close path 也未由本轮
完整执行证据证明。

### S-3 — U10 literal journey evidence remains open

**事实**：当前源码未发现 sample1 identity 漂移，但 S1-01..S1-14、WP-01..WP-09 的
完整正常旅途没有本轮执行结果。U10 不能由 source readback 或旧 A/F 输出替代。

### N-1 — keep A/F and U13 ledgers separate

`check-behavior.mjs` 是 sample2 A/F mutation tool，不是 PF-01..PF-10 专用门；两类
结果必须在 evidence 中分栏报告。

## Dynamic-admission blockers observed by reviewer

- `M-1`：当前 whole-scope record 仍是 `OPEN_NO-GO_FOR_DYNAMIC_ADMISSION`，不是 MATCHED。
- `M-2`：B0 sample2 frozen/full acceptance 仍缺 Web/release/native-device/visual/full matrix
  closure，不能作为前置通过。
- `S-4`：U8 release/mobile/dual cold-start 与 production APK scan 执行结果尚不存在。

## First failure / broken boundary / last known good

- `FIRST_FAILURE`：完整 PF-01..PF-10、U10、U12、U13 当前执行证据缺失，CP4 无法升级为 MATCHED。
- `BROKEN_BOUNDARY`：当前 source/static/focused support → 完整 failure/normal matrix →
  release/native/Android/Web/APK/cleanup proof。
- `LAST_KNOWN_GOOD`：B4 feature factory、requestOutcome、notice identity/ephemeral、picker
  child-result/readback 的当前源码形态可对账；仅代表 source/focused support。

## Reproduction (read-only)

```sh
nl -ba doc/plans/platform/2026-09-14-v2s-terminal-sample-infrastructure-uplift-implementation-plan-codex.md | sed -n '399,472p'
nl -ba apps/terminal/ui/feature/sample-wallpaper-picker/src/features/actors/actors.ts | sed -n '1,130p'
nl -ba apps/terminal/ui/feature/sample-wallpaper-picker/test/pickerSystemFailure.test.ts | sed -n '160,315p'
nl -ba apps/terminal/ui/integration/sample-wallpaper-console/test/sample2Assembly.test.tsx | sed -n '230,315p'
rg -n "VERDICT|OPEN|NO-GO|PF-01|U13|release|cold" doc/evidence/platform/2026-09-15-v2s-terminal-sample-infrastructure-uplift
```

## Scope note

本记录是 fresh 只读三维对账，不是实现验收；reviewer 未运行任何 test/build/dynamic。
动态证据缺失保持 OPEN，不得由本记录或后续 Claude review 改写为 PASS。
