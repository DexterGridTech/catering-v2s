# Implementation code↔design reconciliation (fresh current bytes)

SKILL_USED=cs-systematic-debugging@808fc5717aa88ad65efff312b11c186294d3e6ee301afb584e2f86599b137787
REVIEW_TARGET=IMPLEMENTATION_CODE_DESIGN_RECONCILIATION
REVIEW_CYCLE_ID=2026-09-15-v2s-terminal-sample-infrastructure-uplift-implementation
REVIEW_ROUND=5
reviewerKind=INDEPENDENT_SUBAGENT
REVIEW_SCOPE=all changed code/config/test/tool/evidence
VERDICT=PARTIAL_EVIDENCE_OPEN
CODE_DESIGN_M_S_N=0/0/0
EVIDENCE_DOC_OPEN_M_S_N=0/4/2
REVIEW_BOUNDARY=read-only;no test/build/Metro/Web/Android/device/dynamic

## Fresh reviewer conclusion

当前源码与 requirements v3.6、implementation-design、implementation-plan 没有发现已确认的
直接 code↔design mismatch；但交付级证据仍 OPEN，不能把 U8/U10/U13/Web/Android/release/
cleanup 写成 PASS。所有以下结论均只限当前源码、文档和证据路径的只读核对。

## Matched code/design areas

- D-1/D-3/D-4 的 AST boundary、full graph、runtime subset、exact `{moduleName}` descriptor
  和 optional/opaque/spread 反例：
  `tools/terminal-skeleton/graph-model.mjs:258-294`、
  `tools/terminal-skeleton/check-static.mjs:311-451`；graph active batch 2 与
  `apps/terminal/skeleton-graph.ts:73-94,206-243,275-303` 对齐。
- U7 是 asset bidirectional closure，U8 是 release cold-start；当前计划已分开：
  `doc/plans/platform/2026-09-14-v2s-terminal-sample-infrastructure-uplift-implementation-plan-codex.md:403-405`。
- U7 checker 的 app.json/assets/README/native splash registry 双向输入：
  `tools/terminal-sample2/check-native-projection.mjs:140-236`、
  `...:258-330,404-447`；两个 App 的 app asset README 与 native registry 当前可定位。
- U8 supporting 的 resolved real part/physical primary/host geometry 与六种 fallback 排除：
  `apps/terminal/ui/base/render/src/components/ScreenContainer.tsx:41-68,86-100`、
  `.../ScreenReadyBoundary.tsx:102-151`；native capability 与两 App before-super registration：
  `apps/terminal/assembly/base/android/src/foundations/nativeLoadingCapability.ts:1-23`、
  两个 `MainActivity.kt:15-18`。
- B4 只依赖 B1：计划 `...implementation-plan-codex.md:304-307` 与当前
  `apps/terminal/skeleton-graph.ts:162-204` 对齐；未发现 B2/B3 graph edge。
- D-12 classifier、base notice、feature identity、LayerStack 三 close path、picker child
  result/readback：`apps/terminal/ui/base/render/src/foundations/requestOutcome.ts:1-16`、
  `.../SystemFailureNotice.tsx:19-42`、
  `apps/terminal/ui/base/render/src/components/LayerStack.tsx:175-209`、
  `apps/terminal/ui/feature/sample-wallpaper-picker/src/features/actors/actors.ts:28-58`、
  `.../src/components/WallpaperPicker.tsx:86-124`。
- TR-08 production seam checker source exists and is scoped to release artifact scanning：
  `tools/terminal-sample2/check-production-bundle.mjs:8-17,69-93`。

## Evidence/doc-quality findings and disposition

### S-E1 — B0 sample2 frozen/full acceptance remains OPEN

事实：`doc/evidence/platform/2026-09-15-v2s-terminal-sample-infrastructure-uplift/b0-sample2-focused-evidence.md:57-62`
仍列 Web、release、native-device、complete visual 和完整 A/F 为 OPEN；这不是 code/design
mismatch，必须在获准动态阶段按 sample2 frozen matrix 补齐并分开记录 business/cleanup。

### S-E2 — U8 final release/mobile/dual cold-start remains OPEN

事实：`tools/terminal-sample2/run-u8-release-cold-start.mjs:14-29,306-355,376-427` 已有执行体，
但当前没有它产生的 release/device 记录；old `run-a9` 只作为 supporting probe，见
`doc/evidence/platform/2026-09-15-v2s-terminal-sample-infrastructure-uplift/s3-run-a9-probe.md:14-24`。

### S-E3 — U10/U13 full literal execution remains OPEN

事实：计划 PF-01..PF-10 位于 `...implementation-plan-codex.md:458-469`；当前 source/focused
支持部分路径，但没有完整执行 ledger，不能用 sample2 A/F tool 的输出替代。

### S-E4 — actual release APK scan remains OPEN

事实：checker source 存在，但尚无两 APK 的实际扫描输出；这是 checker source → artifact
proof 边界，而不是静态设计缺陷。

### N-E1 — evidence anchor drift (fixed in current saved record)

上一版 CP4 记录曾把 requestOutcome 指向已删除的 feature path；当前 round5 CP4 记录已改为
`apps/terminal/ui/base/render/src/foundations/requestOutcome.ts:1-16`。本 finding 仅保留为
证据修订轨迹，不再阻断源代码对账。

### N-E2 — plan prose/matrix wording drift (fixed)

计划 B4.3 原先写“壁纸没有更改，请重试”，而 PF-01 冻结矩阵写“操作没有完成，请重试”；
当前计划 `...implementation-plan-codex.md:354-357` 已按 PF-01 统一，实际 source 与矩阵一致。

## First failure / broken boundary / last known good

- `FIRST_FAILURE`：交付证据边界仍缺 B0 frozen/full、U8 release/device、U10/U13 full matrix、
  APK scan；不是已确认的 source/design mismatch。
- `BROKEN_BOUNDARY`：source/static/focused support → complete dynamic/literal/release/cleanup
  evidence。
- `LAST_KNOWN_GOOD`：当前 shared console、runtime identity、feature skeleton、notice/picker
  child handling、native source projection、U7/U8 plan mapping 均与设计可对账。

## Reproduction (read-only)

```sh
nl -ba doc/plans/platform/2026-09-14-v2s-terminal-sample-infrastructure-uplift-requirements-claude.md | sed -n '500,523p'
nl -ba doc/plans/platform/2026-09-14-v2s-terminal-sample-infrastructure-uplift-implementation-design-codex.md | sed -n '468,555p'
nl -ba doc/plans/platform/2026-09-14-v2s-terminal-sample-infrastructure-uplift-implementation-plan-codex.md | sed -n '394,410p;441,469p;487,528p'
nl -ba tools/terminal-skeleton/check-static.mjs | sed -n '300,455p'
nl -ba tools/terminal-sample2/check-native-projection.mjs | sed -n '140,236p;258,330p;404,447p'
```

## Scope note

fresh reviewer 未写文件、未运行 test/build/Metro/Web/Android/device/dynamic；本记录不是
implementation acceptance，也不构成 GO。动态前须另有当前 whole-scope 3D record，交付前
还须有实际 code↔design ledger 与各档位证据。
