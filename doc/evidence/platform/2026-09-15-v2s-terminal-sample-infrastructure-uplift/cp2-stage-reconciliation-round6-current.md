# CP2/B2 fresh independent three-dimensional reconciliation (current bytes)

SKILL_USED=cs-systematic-debugging@808fc5717aa88ad65efff312b11c186294d3e6ee301afb584e2f86599b137787
REVIEW_TARGET=IMPLEMENTATION_RECONCILIATION
REVIEW_CYCLE_ID=2026-09-15-v2s-terminal-sample-infrastructure-uplift-implementation
REVIEW_ROUND=6
reviewerKind=INDEPENDENT_SUBAGENT
REVIEW_SCOPE=CP2/B2
VERDICT=PARTIAL_OPEN_NOT_MATCHED
M_S_N=0/1/5
REVIEW_BOUNDARY=read-only;no test/build/Metro/Web/Android/device/dynamic

## Fresh reviewer conclusion

CP2 的 package/lock/graph/dependencies、R-E1、R-E2、native authority/resource/config source 形态、R-E3 ready source 形态，以及 S-NEW-1 修复后的 assembly rejection 路径大体对齐；但 R-S7 对“无 ready 的可判断 terminal failure”的覆盖仍未闭合。native/build/release/device/cleanup 仍为 OPEN。

## Evidence

- requirements v3.6 sha256 为 `40dcb600ca7555b4c636942348f6d3b47359fc8fba09d772f56ba0e3d5d64c99`，匹配授权前缀。
- 两个 App、`assembly.base.android`、graph、`src/dependencies.ts` 与 `yarn.lock` 已在 lock closure 后一致；见 `apps/terminal/skeleton-graph.ts:275-304`、两个 App `package.json`/`src/dependencies.ts` 与 `yarn.lock:1309-1369,7717-7728`。
- R-E1 source rule、同平台 adapter 放行与其余方向禁令见 `tools/terminal-skeleton/check-static.mjs:668-683,747-760`。
- 两个 `MainActivity.kt` 均在 `super.onCreate(null)` 前调用 `SplashScreenManager.registerOnActivity(this)`；manifest/style/native loading capability 与 `ScreenReadyBoundary` 形态已对账。
- S-NEW-1 修复的 focused/static 证据见 `s-new-1-repair-evidence.md`；本轮未以动态证据替代源码对账。

## Finding

### S-1 — PARTIALLY_CONFIRMED — R-S7 terminal failure 覆盖不完整

- 仓内事实：设计要求 assembly rejection、runtime start failure、host 长期未到、real part 持续 fallback 进入可判断 terminal failure 时调用 `hideOnce('startup-failure')` 并显示 render-owned failure page：详设 `:424-428`。
- 仓内事实：当前源码对 `surfaceHostAvailability === 'unavailable'`、runtime failed 及多种 resolved-part 失败有 failure page；见 `apps/terminal/ui/base/render/src/components/ScreenContainer.tsx:41-55,82-100`。
- 仓内事实：`container-empty` 当前只返回 fallback，不显示 failure page 或 hide splash；host pending 当前只显示 progressbar；见 `ScreenContainer.tsx:63-68`、`SurfaceHostController.tsx:102-122`。
- 仓内事实：adapter 仅在 identity mismatch、native unavailable event 或 snapshot error 时置为 `unavailable`；未见 pending timeout/long-term terminal-failure oracle；见 `apps/terminal/adapter/android/dual-screen/src/implementations/surfaceHost.ts:245-264,275-283`。
- 推论：PRIMARY host 一直 pending 或 container 长期 empty 时，源码没有进入 R-S7 failure page 的可观察路径；这不是仅缺动态证据，而是当前路径/设计边界缺口。
- 外部事实：本轮未联网复核外部 SDK 行为；此 finding 仅以仓内 v3.6/详设/当前源码为依据。
- 尚缺证据假设：若产品定义不要求对 indefinite pending/container-empty 进行终态失败处理，必须在需求解释或详设中明确收窄 R-S7 的适用范围；当前详设仍写作覆盖该类情形。

## Matched areas

- N-1：package.json ↔ yarn.lock ↔ graph ↔ src/dependencies 当前一致。
- N-2：R-E1 adapter 放行/跨平台禁令与当前依赖形态一致。
- N-3：R-E2/D-5/D-11/U6/U7 的 source/static shape 匹配；真实 native/build/release proof 仍 OPEN。
- N-4：R-E3 ready consumer 与 failure bridge 未在源码中混淆；release 时序仍 OPEN。
- N-5：S-NEW-1 assembly rejection 修复的源码/README/invariant/focused shape 未复现直接偏差。

## Reproduction (read-only)

```sh
sha256sum doc/plans/platform/2026-09-14-v2s-terminal-sample-infrastructure-uplift-requirements-claude.md
nl -ba apps/terminal/skeleton-graph.ts | sed -n '270,310p'
nl -ba yarn.lock | sed -n '1308,1378p;7717,7728p'
nl -ba tools/terminal-skeleton/check-static.mjs | sed -n '668,760p'
rg -n "hideOnce\\(|startup-failure|assembly-failure|StandaloneStartupFailurePage|renderFailurePage" apps/terminal/assembly/base/android apps/terminal/assembly/android/sample-terminal apps/terminal/assembly/android/sample-wallpaper-terminal apps/terminal/ui/base/render/src
```

## OPEN

- `dynamic`, `native/build`, `release`, `device`, `cleanup`: OPEN；本轮未运行动态命令。
- 该记录不能标记 CP2 为 `MATCHED`，直到 R-S7 的 pending/empty terminal-failure 边界被最小修复或由权威设计明确收窄并完成对应对账。

