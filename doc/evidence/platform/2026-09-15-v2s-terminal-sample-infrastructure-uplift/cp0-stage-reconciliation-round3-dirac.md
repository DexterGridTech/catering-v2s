# CP-0/B0 fresh 三维对账：Dirac

REVIEW_TARGET=IMPLEMENTATION
REVIEW_SCOPE=CP-0/B0 sample2 frozen acceptance + terminal static baseline
REVIEWER_KIND=INDEPENDENT_SUBAGENT
REVIEWER_ID=01a0a1c9-68fa-73b0-a147-0a6d6082cfe4
REVIEW_TIME=2026-09-15
BLIND_REVIEW=true
READ_ONLY=true
VERDICT=PARTIAL_NOT_MATCHED

## 输入与盲审边界

本轮 fresh reviewer 从当前仓库重新读取 AGENTS、平台蓝图/平台 README、Roadmap 授权、
project-memory 路由命中项、scripts README、sample2 requirements/design/plan、基础设施
v3.6 requirements/design/plan，以及当前 package/graph/source/evidence；不调用动态执行，
不写文件，不执行 Git，不把旧 review 或 handoff 当源码真相。

## 结论

- terminal static baseline：MATCHED（当前 R-E6 package-only 修复与静态边界可由源码和已有
  static record 支持）。
- sample2 frozen/full implementation acceptance：NOT_MATCHED。
- CP-0/B0 整体：NOT_MATCHED；因此不能把当前 B0 作为已关闭的基础设施开工前置。

## 证据与首败

- `doc/plans/platform/2026-09-14-v2s-terminal-sample-infrastructure-uplift-requirements-claude.md:463-467`
  明确 B1–B4 前置同时要求 sample2 实施验收通过和 terminal static baseline 全绿。
- `doc/plans/platform/2026-09-14-v2s-terminal-sample-infrastructure-uplift-implementation-plan-codex.md:66-82`
  将 B0 未满足任一项定义为 BLOCKED，不能用本批 U13 代替 sample2 acceptance。
- `doc/plans/platform/2026-09-13-v2s-terminal-sample2-wallpaper-requirements-claude.md:914-929,967-969`
  要求 A1–A9 中的真机截图/ROI、双屏、mobile 和完整 sample 回归旅途。
- `doc/evidence/platform/2026-09-15-v2s-terminal-sample-infrastructure-uplift/b0-sample2-focused-evidence.md:57-62`
  当前证据明确 Web、release、native-device、complete visual、complete A/F acceptance 仍 OPEN。
- 既有 sample2 CP7 Android 记录只支持 focused/Android/cleanup supporting proof，不外推为
  Web、release、native 真机、完整 visual 或完整矩阵。
- 当前字节的 `apps/terminal/ui/feature/sample-wallpaper-picker/package.json`、其
  `src/dependencies.ts` 和 `apps/terminal/skeleton-graph.ts` 已没有被 R-E6 删除的错误
  `kernel-base-platform-ports` devDependency；这是 static last known good，不是 full acceptance。

first failure：缺少当前 sample2 frozen/full acceptance proof。

broken boundary：证明停在 static/focused/supporting Android，尚未覆盖 sample2 要求的
release、native-device、visual、完整 A/F 及其他剩余矩阵。

last known good：R-E6 package-only 修复、picker focused/red 记录和部分 Android supporting
证据可回放；它们不能升级为 B0 acceptance。

## 可复现核验

```bash
nl -ba doc/plans/platform/2026-09-14-v2s-terminal-sample-infrastructure-uplift-requirements-claude.md | sed -n '463,467p'
nl -ba doc/plans/platform/2026-09-13-v2s-terminal-sample2-wallpaper-requirements-claude.md | sed -n '914,929p'
nl -ba doc/evidence/platform/2026-09-15-v2s-terminal-sample-infrastructure-uplift/b0-sample2-focused-evidence.md | sed -n '57,62p'
node tools/terminal-skeleton/check-static.mjs
```

