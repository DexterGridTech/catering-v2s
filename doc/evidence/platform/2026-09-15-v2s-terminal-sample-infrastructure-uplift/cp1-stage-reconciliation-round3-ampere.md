# CP-1/B1 fresh 三维对账：Ampere

REVIEW_TARGET=IMPLEMENTATION
REVIEW_SCOPE=CP-1/B1 runtime self-declaration, boundary checker, primitives/input/render contracts
REVIEWER_KIND=INDEPENDENT_SUBAGENT
REVIEWER_ID=01a0a1c9-6968-78c1-8644-01699ccb4356
REVIEW_TIME=2026-09-15
BLIND_REVIEW=true
READ_ONLY=true
VERDICT=OPEN_NOT_MATCHED

## 输入与边界

fresh reviewer 从当前仓库读取 AGENTS、平台蓝图/README、Roadmap 授权、命中项目 memory、
scripts README、基础设施 v3.6 requirements/design/plan、CP-1/B1 owning source/tests/
invariants/evidence；不写文件、不做 Git、不执行动态、不采用旧报告作为源码事实。

## 结论

CP-1/B1 核心源码结构大体 MATCHED：runtime subset 自声明与消费、base 反向边界、共享
console extraction、image seam、透明容器、passive input observer、render readiness seam
和 public/type invariant 均有直接当前源码锚点；但阶段整体 OPEN。

## 首败与缺口

本轮首败是 package README 规范缺口：当前
`apps/terminal/ui/base/feature-assembly/README.md:1-14` 当时仍为英文简述，未覆盖
TR-10 要求的中文定位/作用/结构/用法及“在这个包上迭代时”一节。该 finding 已由主
Codex在本记录之后修复，需以新的 fresh CP-1 记录复核，不能把本记录直接升级为 MATCHED。

另一个阶段阻断是 B0 sample2 frozen/full acceptance 仍 OPEN；focused/static/既有 Android
supporting 不能替代该前置。

## 当前可复核锚点

- `apps/terminal/ui/integration/sample-console/src/assembly/assembly.tsx:40-47,83-116`
  与 wallpaper integration 均接入 adminShell parts、共享 console assembly、runtime module。
- `apps/terminal/ui/base/console-assembly/src/foundations/consoleAssembly.tsx:224-268,395-428`
  统一创建 catalog/runtime/ui-state/startup writer 并使用 AdminLauncher。
- `apps/terminal/ui/base/input/src/components/InputSurfaceFrame.tsx:139-175,205-239`
  使用普通 View 的 passive observer，不引入第二滚动管线。
- `apps/terminal/ui/base/render/src/components/ScreenReadyBoundary.tsx:47-150,188-190`
  ready 位于真实 part/layout boundary，failure page 不是 host fallback。
- `tools/terminal-skeleton/check-static.mjs:356-412`、`check-static.test.mjs:196-224,300-323`
  覆盖 runtime subset、dependency drift、base graph feature red mutation。

broken boundary：README/package invariant 与证据分母；核心源码尚不能代表阶段整体收口。
last known good：CP1 static/red evidence 对 runtime subset、root workspace、D1 和 base graph
negative mutation 的记录。

## 可复现核验

```bash
nl -ba apps/terminal/ui/base/feature-assembly/README.md | sed -n '1,120p'
nl -ba doc/platform/terminal-coding-standard.md | sed -n '401,429p'
node tools/terminal-skeleton/check-static.mjs
node tools/terminal-skeleton/check-static.test.mjs
```

