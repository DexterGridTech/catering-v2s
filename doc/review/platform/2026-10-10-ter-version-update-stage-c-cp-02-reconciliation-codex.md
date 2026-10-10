# TER 版本更新阶段 C CP-02 阶段级三维对账

REVIEW_TARGET=CP_STAGE_RECONCILIATION
CP=CP-02
REVIEWER_KIND=FRESH_INDEPENDENT_SUBAGENT
RESULT=MATCHED
OPEN=0

## 核验范围

- 需求：`doc/plans/platform/2026-10-05-ter-version-and-js-apk-update-formal-requirements-claude.md` R-07/R-12。
- 详设与计划：`doc/plans/platform/2026-10-09-ter-version-update-stage-c-implementation-design-claude.md` §8.3、§9a；`doc/plans/platform/2026-10-09-ter-version-update-stage-c-implementation-plan-claude.md` CP-02。
- 项目记忆：六维路由 `implementation/platform/platform-admin/platform/architecture/implementation`；命中 `project-memory/operations/terminal-coding-standard.md`，其正本为 `doc/platform/terminal-coding-standard.md`。记忆 SHA-256：`f6075eef915ee931932e3ee734113d764128630c5af0689762bfe503c0802704`；正本 SHA-256：`d2304e3ab46e119c837627c8acc4000d33a4f8892f60b7627555a0279ca67bd2`。
- 生产接缝：Runtime local-interaction slice/actor/command/selector 与 `src/index.ts`；`SurfaceRoot` responder capture；integration assembly；UpdatePort presentation bridge、Android adapter、terminal-update actor；console 与 wallpaper assembly。

## 主 agent 的差量修复与 focused proof

初次独立对账发现 Runtime `src/index.ts` 已公开导出 `recordLocalInteractionCommand` 和 `selectLastLocalInteraction`，但 `terminal-invariants.json` 的 `publicExports` 未登记。已在 [terminal-invariants.json](../../../../apps/terminal/kernel/base/runtime/terminal-invariants.json) 补入这两个真实公开符号，没有改产品 API 或增加新能力。

当前字节执行结果：

- `node tools/terminal-runtime/check-static.mjs`：5 个 Runtime rule gates 全部 PASS；`RUNTIME_SUPPORT_EXPORTS=PASS`；`TERMINAL_RUNTIME_STATIC=PASS`。
- `yarn workspace @catering-v2s/ui-base-integration-assembly test`：PROD，7 个文件、20 个测试 PASS；runner 退出 0。
- `yarn workspace @catering-v2s/ui-integration-sample-wallpaper-console test`：PROD，6 个文件、40 个测试 PASS；runner 退出 0。

上述 package test 使用 owned runner；没有运行 Expo Web、Android、DEV 或其他动态环境。

## 独立结论

Fresh 子 agent 复核了 CP-02 的需求、详设/计划、相关项目记忆及 owning source，并核对以上由主 agent 提供的当前字节 proof 输出。结论 `CP-02_RECONCILIATION=MATCHED`，`OPEN=0`。独立核验确认：Runtime command/selector、actor、ephemeral isolated slice 与 invariant 对齐；render 捕获起点后返回 `false`；单机双 surface 共用 Runtime；presentation 先订阅再读取并由 owner command 投递；Android `AppState` adapter 有退订；两 sample assembly 使用 project-basic 候选和 terminal-update 公开 command 接缝。

边界：该 CP 结论不代表 CP-03～CP-06、整批 6b、动态/Web/设备验收或最终实现 review 已通过。

## CP-02 当前字节差量：cleanup 失败闭包

在首次对账后按计划复核 `disposefailure` 判据时，发现原记录未提供 UpdatePort presentation 退订失败经 Runtime 释放链传播的直接反例。仅有一般资源 registry 失败测试不足以证明该生产接缝，因此在现有 owner 测试增加一例：

- `apps/terminal/kernel/base/terminal-update/test/terminalUpdate.test.ts:979–993` 的测试令 `subscribePresentation` 返回会抛错的退订函数，调用真实 `runtime.start()`，再经 `releaseRuntimeForTestAsync` 释放；断言错误以 `RUNTIME_RESOURCE_RELEASE_FAILED` 暴露且退订只调用一次。
- owning source：`apps/terminal/kernel/base/terminal-update/src/application/createTerminalUpdateModule.ts:192–203` 登记 presentation 与 state cleanup；`apps/terminal/kernel/base/runtime/src/foundations/createRuntimeResourceRegistry.ts:37–50` 聚合并报告释放失败。
- focused 命令：`TERMINAL_TEST_DEV_MODE=false ../../../../../node_modules/.bin/vitest run --root "$PWD" --config vitest.config.ts test/terminalUpdate.test.ts -t "surfaces a presentation unsubscribe failure through Runtime cleanup"`，工作目录为 `apps/terminal/kernel/base/terminal-update`。Vitest 4.1.10：1 passed、46 skipped、0 failed，耗时 390 ms。
- `yarn workspace @catering-v2s/kernel-base-terminal-update typecheck`：PASS（测试文件包含在该包 `tsconfig.json`）；同包 owned lint：PASS，11/11 文件、0 error、0 warning，1461 ms。
- 本次 Vitest 产生的包内 `node_modules/.vite` 已按精确路径清理；仅在该目录非符号链接且唯一内容为 `.vite` 时移除，`VITEST_CACHE_CLEANUP=PASS`。

CP-02 其余实现与既有 focused proof 未因本差量改变，沿用上文明确列出的字节与范围。Fresh 独立子 agent `/root/stagec_cp02_reconcile_delta` 对完整 CP-02（需求、详设/计划、项目规范及 owning source）复核当前字节，专门确认上述失败闭包后结论为 `MATCHED`，`OPEN=0`。此差量未运行 Expo Web、Android 或 DEV，也不把 CP 结论升级为整批 6b 或动态验收通过。
