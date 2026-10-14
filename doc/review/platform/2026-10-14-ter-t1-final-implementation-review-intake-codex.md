# TER T1 · 最终整批实施 review intake

`REVIEW_TARGET=IMPLEMENTATION_FINDING_INTAKE`
`SOURCE_REVIEW=/root/t1_final_implementation_review`
`FINAL_REVIEW=/root/t1_final_implementation_rereview`
`FINAL_13C_REVIEW=/root/t1_final_13c_rereview`

## 范围与证据边界

Fresh 独立 reviewer 对当前 T1 源码与交付记录给出 `NO-GO`、`M/S/N=0/2/0`。其两项 finding 是主 agent 核验输入，不是本 intake 的结论。主 agent 已重开正式需求 R-10/R-14、Android application exports、package invariants、两 App 的 README 和实际调用者，按当前字节独立处置。

## Findings

### S-1 · 逐代码对账和交审 brief 引用了旧的最新运行

**Disposition：CONFIRMED。**

原 13c 把 `15cf417a-3f23-466a-a203-998ce1c296a8` 写成当前最新缺口关闭运行，交审 brief 也重复该陈述；当前 CP-06 evidence 已记录后续 pair wrapper 修复及两次通过：console pair `d6d95c6b-c637-41b3-95bd-2c2e6d9a2124`、wallpaper pair `052c705d-a073-47b1-8cb2-717ddb48d1d1`。这使交付材料没有覆盖最终 changed lines 和最新动态证据。

**最小修正：**同步 13c、交审 brief 的 current/latest 与 last-pass、V-16/V-17 摘要和 pair 差量文件范围；保留旧 run 为其原场景的有效历史证据，不重跑未受影响验证。

### S-2 · Wallpaper Android application 根导出内部 assembly factory

**Disposition：CONFIRMED。**

正式需求 R-10 要求 application 输入聚焦模块加载、平台端口、surface 和真实外部输入，并规定 assembly 只绑定公开能力；R-14 要求按职责和依赖方向拆分，不新增仅作转发的公共层。当前 `apps/terminal/application/android/sample-wallpaper-terminal/src/index.ts` 导出 `createSampleWallpaperTerminalAssembly`，`terminal-invariants.json.publicExports` 和 README 也将其声明为根 API。相同目录中的 App 从包内 `src/assembly/platformPorts.ts` 导入该 factory；仓内搜索没有发现包外调用。对照 `sample-terminal`，其 `src/index.ts`、invariants 和 README 均只公开 module/dependency 元数据，assembly 留在 App 内部。

reviewer 的根 API 不一致判断成立。最小修正是删除 wallpaper app 根 barrel/invariants/README 中的 factory 公共声明，保留 App 的包内 factory import 与运行装配，不增测试 seam、fallback 或新装配机制。

## 修复与当前验证

- 已从 wallpaper app `src/index.ts`、`terminal-invariants.json.publicExports` 和 README 根 API 描述中移除 `createSampleWallpaperTerminalAssembly`；同根扫描确认 factory 仍只有该 App 的包内调用，没有已知外部消费者。
- `node tools/terminal-skeleton/check-static.mjs`：PASS，13 个 RULE gate、support check、graph comparison、scaffold hygiene 均 PASS。
- `yarn --cwd apps/terminal/application/android/sample-wallpaper-terminal typecheck`：PASS。
- 未重跑动态场景：导出面收窄不改变 App 内运行路径；已通过 pair runs 与当前源码的适用性不变。
- 13c fresh 独立差量复核现为 `MATCHED`；最终字节 fresh 独立整批 `REVIEW_TARGET=IMPLEMENTATION` 复核为 `GO`、`M/S/N=0/0/0`。两份结论与范围记录见 `doc/review/platform/2026-10-14-ter-t1-final-independent-review-codex.md`。

## 当前结论边界

本 intake 是主 agent 对外部 finding 的事实判断和处置，不是独立 review verdict。原 fresh review 的 `NO-GO 0/2/0` 保留为历史 verdict；不得覆写为 GO。修复后 fresh 独立 reviewer 对当前最终字节给出 `GO 0/0/0`；该结论不升级未运行范围或历史证据。
