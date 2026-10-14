# TER T1 · 13c 逐代码与详设对账记录

`REVIEW_TARGET=IMPLEMENTATION_SOURCE_RECONCILIATION`
`GATE=13c`
`STATUS=MATCHED`

## 范围和结论

主 agent 已按实施计划逐项读回当前改动、目标文件、真实调用者、生成/静态消费者、README 与 automation driver。CP-01～CP-05 与其跨 CP 接缝沿用当前字节未受影响的全批 6b R3 `MATCHED` 结论；CP-06 最后两项 Android pair 运行已加入当前证据链。此次最终 fresh reviewer 发现的 wallpaper application 根 API 多余 assembly export 已从包根声明与文档删除。

Fresh 独立 reviewer `/root/t1_final_13c_rereview` 已对当前记录、最后差量源码和运行证据逐项复核，结论 `MATCHED`。范围、证据与逐代码读回见下文及 `doc/review/platform/2026-10-14-ter-t1-final-independent-review-codex.md`。该结论只关闭本次 13c 差量，不替代独立整批实施 review。

## 当前字节差量逐代码读回

1. **Android pair surface 接线**
   - `apps/terminal/application/android/sample-terminal/App.tsx` 和 `apps/terminal/application/android/sample-wallpaper-terminal/App.tsx` 仅在 automation 构建变量通过有限枚举校验后，采用测试 `surfaceForm` 覆盖 adapter launch option；普通构建仍使用 adapter 的真实形态。
   - 两个 app README 分别说明 automation override 与普通设备形态；该变量不是生产配置或新的运行时业务选项。
   - `apps/terminal/application/base/android/config/tsconfig.json` 的 `allowImportingTsExtensions` 服务于 source-only TypeScript direct ESM loading；`server-config` resolver 的 `.ts` 相对 import 与受管 runner 实际入口一致。
   - Console 与 wallpaper Android pair 的最新运行分别是 `d6d95c6b-c637-41b3-95bd-2c2e6d9a2124` 和 `052c705d-a073-47b1-8cb2-717ddb48d1d1`，均 `business=PASS`、`diagnostics=PASS`、`cleanup=PASS`。两个 manifest 的 `firstFailure=null`、`lastKnownGood=cleanup`。

2. **Wallpaper application public API 收窄**
   - `apps/terminal/application/android/sample-wallpaper-terminal/src/index.ts` 仅再导出 `moduleName`、`dependencyModuleNames`、`devDependencyModuleNames`。
   - `terminal-invariants.json.publicExports` 与实际 barrel 保持一致；README 说明 `createSampleWallpaperTerminalAssembly` 仅供本包 `App.tsx` 内部调用。
   - `App.tsx` 对包内 `src/assembly/platformPorts.ts` 的 import 保留，运行装配没有改变。与 console Android app 的 root API 形状一致。
   - `node tools/terminal-skeleton/check-static.mjs`：13 个 RULE gate、support check、graph comparison 与 scaffold hygiene PASS。
   - `yarn --cwd apps/terminal/application/android/sample-wallpaper-terminal typecheck`：PASS。

3. **前序批次结论与动态证据**
   - 全批 6b：`doc/review/platform/2026-10-14-ter-t1-implementation-6b-r3-reconciliation-codex.md` 为 `MATCHED`；此次仅引用未被后续改动影响的 CP-01～CP-05 和跨 CP 范围。
   - CP-06 全部细节及 §11a 逐项结果见 `doc/review/platform/2026-10-14-ter-t1-cp06-dynamic-evidence-codex.md`。不把单个 pair 运行扩张成其他执行面的证据。
   - 未重跑完整 `scripts/verify`、L2、reset/seed、UAT 或生产部署；它们不是此次公开 API 收窄的受影响证明。

## 当前运行状态

- 当前字节上的最新运行：`052c705d-a073-47b1-8cb2-717ddb48d1d1`，2026-10-14 00:47:46–00:53:05 UTC，wallpaper Android `update.pair`，business/diagnostics/cleanup 均 PASS。
- 最后一次通过：同一 run，与当前 App surface 差量字节一致；随后仅删除 wallpaper assembly factory 的包根导出并同步 invariants/README，未改变 Android App 内运行路径。该静态公开面修正由上述 skeleton gate 和 wallpaper typecheck 覆盖。
- Console Android `update.pair`：`d6d95c6b-c637-41b3-95bd-2c2e6d9a2124`，2026-10-14 00:42:16–00:47:36 UTC，business/diagnostics/cleanup 均 PASS。

## 13c 状态

**MATCHED**。Fresh 独立 reviewer 核验了 pair surface 接线、wallpaper application 根导出、manifest/cleanup 证据和未受影响 6b 范围。无 OPEN；整批实施 verdict 由同一最终字节上的独立 `REVIEW_TARGET=IMPLEMENTATION` 另行给出。
