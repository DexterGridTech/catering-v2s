# CP2/B2 fresh independent three-dimensional reconciliation (current bytes)

SKILL_USED=cs-systematic-debugging@808fc5717aa88ad65efff312b11c186294d3e6ee301afb584e2f86599b137787
REVIEW_TARGET=IMPLEMENTATION_RECONCILIATION
REVIEW_CYCLE_ID=2026-09-15-v2s-terminal-sample-infrastructure-uplift-implementation
REVIEW_ROUND=5
reviewerKind=INDEPENDENT_SUBAGENT
REVIEW_SCOPE=CP2/B2
VERDICT=PARTIAL_OPEN_NOT_MATCHED
M_S_N=0/1/0
REVIEW_BOUNDARY=read-only;no test/build/Metro/Web/Android/device/dynamic

## Fresh reviewer conclusion

CP2/B2 的 native source、asset closure、PRIMARY/fallback 和 B2→B3 顺序大体与需求/详设/计划
匹配，但当前 `yarn.lock` 与 package/link 目标不闭合，故 CP2 不能标记 `MATCHED`。这是
当前静态 artifact mismatch，不是单纯缺动态证据；修复后需重新 fresh CP2 对账。

## Finding

### S-1 — yarn.lock 与 B2 package/link 目标不闭合

当前 App package 只直接依赖 `assembly-base-android` 与各自 integration：
`apps/terminal/assembly/android/sample-terminal/package.json:11-12`、
`apps/terminal/assembly/android/sample-wallpaper-terminal/package.json:11-12`；graph
也只连接 `assembly.base.android` 与 integration：`apps/terminal/skeleton-graph.ts:275-303`。
但 `yarn.lock:1309-1320,1336-1347` 的两个 App entry 仍直接列出 adapter 与
`kernel-base-platform-ports`，而 `yarn.lock:1363-1370` 的 `assembly-base-android` entry
又漏掉当前 package.json 声明的 adapter dependencies。package.json/graph/source 已向
R-E1 目标移动，lock/link artifact 仍是旧 closure，不能作为 B2 package/link proof。

**first failure**：当前 CP2 source 对账首个实质失败是 lock entry 与 package/graph 不一致。
**broken boundary**：package.json/graph/source → package-manager lock/link artifact。
**last known good**：native Activity/theme/resource、App identity、U7 asset registry、
R-E1 source/graph 方向本身可读且大体匹配。

## Matched current source/design areas

- R-E1/U5：`apps/terminal/skeleton-graph.ts:293-303` 与
  `apps/terminal/assembly/base/android/src/dependencies.ts:1-12` 允许 assembly.base.android
  依赖 platform-ports 与同平台 adapter；App source/package 未直接 import adapter。
- R-E2/D-5：两个 MainActivity 在 `super.onCreate(null)` 前调用
  `SplashScreenManager.registerOnActivity(this)`；见两个 `MainActivity.kt:12,16-17`。
- required native loading capability：`apps/terminal/kernel/base/platform-ports/src/types/nativeLoading.ts:7-15`、
  `apps/terminal/assembly/base/android/src/foundations/nativeLoadingCapability.ts:4-20`、
  `.../AndroidTerminalApp.tsx:7-18`。
- R-E3/R-S7 source shape：`apps/terminal/ui/base/render/src/components/ScreenReadyBoundary.tsx:118-175`、
  `.../ScreenContainer.tsx:71-100`，resolved real part 才可能 ready，fallback 进入 failure page。
- U6/U7 native identity/asset closure：两个 App 的 app.json、Gradle、settings、Kotlin package、
  strings、assets README 与 native-resource-registry 当前输入可对账，checker source 位于
  `tools/terminal-sample2/check-native-projection.mjs:140-236,258-330,404-447`。
- D-11 six root configs：两 App 的 babel/tsconfig/global/nativewind-env 与 base config
  一致，metro/tailwind 差异在需求允许集合内；需修复 lock 后再 fresh 复核。
- B2/B3 order：计划 `...implementation-plan-codex.md:217-219` 保持 B2 provider/native，
  B3 consumer/ready；U8 final 仍不在 CP2 提前关闭。

## Evidence boundary

本轮未运行 test/build/Metro/Web/Android/device/dynamic；U8 release、native/aapt2、cleanup
仍为 OPEN。该缺口不替代 S-1 静态 lock mismatch，S-1 修复后需要新的 CP2 记录。

## Reproduction (read-only)

```sh
rg -n "@catering-v2s/adapter-android|@catering-v2s/kernel-base-platform-ports" apps/terminal/assembly/android/sample-terminal apps/terminal/assembly/android/sample-wallpaper-terminal
nl -ba yarn.lock | sed -n '1309,1378p'
nl -ba apps/terminal/skeleton-graph.ts | sed -n '275,303p'
rg -n "SplashScreenManager|registerOnActivity|super\\.onCreate|setTheme" apps/terminal/assembly/android/*/android/app/src/main/java/**/*.kt
rg -n "Theme\\.App\\.SplashScreen|windowSplashScreen|postSplashScreenTheme" apps/terminal/assembly/android/*/android/app/src/main/res/values/styles.xml
```

## Scope note

fresh reviewer 只读且没有运行动态；本记录不是实现验收。锁文件修复后必须重新取得 CP2
fresh reconciliation，再考虑全批动态准入。
