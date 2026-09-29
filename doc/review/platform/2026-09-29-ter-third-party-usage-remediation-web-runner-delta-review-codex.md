# TER 第三方库整改 Web runner 增量复核

REVIEW_TARGET=IMPLEMENTATION
REVIEW_SCOPE=本轮新增 screen-error-member-journey runner 分支及两份 W4 Web 运行证据；不复判全批次
VERDICT=GO
M/S/N=0/0/0
reviewerKind=INDEPENDENT_SUBAGENT
reviewer=01a0ed25-adba-7190-b14d-48427687a3b1

## 核验范围与限制

Fresh reviewer 只读检查 `scripts/test/ter-admin-display-web.mjs` 中的 `screen-error-member-journey`，并检查以下 run 的 manifest、日志、截图及 source digest：

- `.runtime/ter-admin-display/ter-remediation-webonly-final-w4-screen-member-list-20260929-01/`
- `.runtime/ter-admin-display/ter-remediation-webonly-final-w4-screen-member-form-20260929-01/`

未运行 Web、设备、构建、测试或动态命令。该结论仅针对本轮新增 runner 分支与两份已落盘证据，不代表全批实现验收通过，不覆盖 W4 全部 screen/layer 分母、native resetRuntime、设备行为或其他未验证项。

## 结论与证据

| 判据 | 结论 | 证据 |
|---|---|---|
| 场景 fail-closed 范围 | MATCHED | runner 仅允许 `sample-console`，failure owner 限于 `screen:main:sample.desk.member-list` 与 `screen:main:sample.desk.member-form`，`scripts/test/ter-admin-display-web.mjs:235-245`。 |
| 生产消费者旅途与 owner 导航 | MATCHED | runner 以产品登录路径提交 `A001` / `1111`；member-form 分支先由 member-list empty action 导航。`scripts/test/ter-admin-display-web.mjs:250-265`。日志分别记录 list run owner `sample.desk.member-list`（`...w4-screen-member-list.../expo-web.log:97`）与 form run owner `sample.desk.member-form`（`...w4-screen-member-form.../expo-web.log:120`）。 |
| 唯一错误提示按钮 | MATCHED | runner 断言可见“知道了”恰好一个并点击它，`scripts/test/ter-admin-display-web.mjs:267-273`；组件只有一个 dismiss button，`apps/terminal/ui/base/render/src/components/SystemFailureNotice.tsx:29-44`。 |
| reset command/actor 与 Web unavailable | MATCHED | UI 派发 command，runtime actor 调用 `appControl.resetRuntime`，`SystemFailureBoundary.tsx:110-124`、`resetRuntimeAfterSystemFailureActor.ts:22-48`。两个日志均记录 `runtime.system-failure.reset-unavailable` 与 `portStatus=unavailable`，未伪报重启成功。 |
| 错误持续时管理入口 | MATCHED | runner 在 dismiss/unavailable 后操作 launcher 并验证登录层仍可用，`scripts/test/ter-admin-display-web.mjs:274-282`；两份 manifest 均记录 `adminLauncherRemainedUsable=true`，见各自 `run-manifest.json:72`。截图显示入口可见、底层错误遮罩仍在。 |
| 两份运行与摘要绑定 | MATCHED | 两个 manifest 均 `phase=COMPLETE`、`business=PASS`、`cleanup=PASS`、`firstFailure=null`、`cleanupReadback=[]`，source digest 均为 `8db24f9b556871aba86f4cd80cc98987701b1263502ec6dd68ee7af0c16e570e`。reviewer 从 manifest `sourceFiles` 重算当前字节并匹配；资源预检均 `STATUS=PASS`。 |

## 限制说明

审查工具对 runner 报告 0 error，但 `tsc skipped: no tsconfig found`，因此不是完整 TypeScript 检查结论。本增量审查结论不声称其他 Web 场景、native/device、拓扑、W4 全分母、全量视觉或业务验收已经通过；这些边界继续按主复核请求登记。
