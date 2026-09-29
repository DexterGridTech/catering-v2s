# TER 第三方库用法整改实施代码复审请求（代码与测试）

## 背景

本批依据需求 v3.4 完成 TP-A1、TP-A3..A11、TP-B0..B5、TP-C1..C3、TP-D1..D4、TP-X1..X3 的实施。此前 Dexter 明确将剩余动态验证限制为 Web，并豁免 W5、W7、W8；W10 按 Dexter 指示跳过。此前独立复核、实施记录和动态证据仍按原有 OPEN/豁免口径保留。本次交付请求只针对当前代码与测试，不请求 Claude 复核运行证据或重新判断设备验收。

本轮对 Web、Android 与拓扑相关 runner/用例做了同根静态检查：21 个实际源文件语法检查通过，9 个定向测试文件覆盖 208 个测试。复核修正包括：进程身份必须绑定 `/proc/<pid>/stat` 行内 PID；ADB `cmdline` 精确匹配首 token；TP-A7 marker 窗口解析真实方向的 ping/pong，且不得因 logcat 行数截断丢掉起始标记；A11 的 system_server 正向读回也必须经过同一严格 pidof parser。最终命令实跑 208/208 PASS、0 skipped。首次合并运行揭示一条测试只匹配 system_server 调用的单行排版；生产调用是多行且顺序正确，已将断言改为检查 run 主体中的多行调用与首个 app run 顺序，最终整组复跑通过。此请求不要求 Claude 重跑命令。

## 评审目标

请仅对当前生产源码、测试用例、测试 runner 与相关配置做静态实施复审：逐 TP 对照 v3.4 详设判据，特别检查第三方 API 使用、边界/owner/失败语义、runner 的 false PASS/false FAIL、日志与设备身份绑定，以及新增测试是否真正守住生产调用路径。不要读取或评价 `.runtime`、`doc/evidence`、截图、设备运行或动态验收材料；不要把本次 208/208 定向 Node 测试单独等同整批通过。

## 需阅读文件

- `doc/plans/platform/2026-09-28-ter-third-party-usage-remediation-requirements-claude.md`：唯一需求输入，v3.4。
- `doc/plans/platform/2026-09-28-ter-third-party-usage-remediation-implementation-design-codex.md`：实现边界与逐 TP 判据。
- `doc/plans/platform/2026-09-28-ter-third-party-usage-remediation-implementation-plan-codex.md`：实现范围、文件/测试门与阶段顺序。
- `doc/platform/third-party-library-usage-standard.md`：第三方库版本与 API 核验规范。
- `doc/platform/terminal-coding-standard.md`：TER 的 TR-08、TR-10、TR-11、TR-16、TR-17 与 §7.1 约束。
- `doc/platform/frontend-coding-standard.md` 与 `doc/platform/backend-coding-standard.md`：前后端实现规范。
- `tools/terminal-topology/process-identity.mjs`、`tools/terminal-topology/heartbeat-window.mjs`、`tools/terminal-topology/run-dual-device.mjs`：本轮进程身份与 TP-A7 runner 修订及其生产使用点。
- `scripts/test/terminal-topology-runner-guards.test.mjs`、`scripts/test/terminal-topology-heartbeat-window.test.mjs`：本轮拓扑 runner 与心跳判据测试。
- `scripts/test/ter-persist-kv-prechange-android.mjs` 与 `scripts/test/ter-persist-kv-prechange-android.test.mjs`：A11 进程读回及 package cmdline 精确归属判据。
- `scripts/test/ter-admin-display-web.mjs`、`scripts/test/ter-admin-display-web-contract.mjs`、`scripts/test/ter-admin-display-web.test.mjs`：Web runner 与场景准入/断言代码；只审代码，不读取其运行产物。
- `scripts/test/ter-virtual-keyboard-android.mjs`、`tools/terminal-shared/run-owned-android-tests.mjs`、`tools/terminal-shared/vitest-json-report.mjs`、`scripts/test/terminal-owned-test-report.test.mjs`、`scripts/test/test-health-entry-runner.mjs` 及对应测试：Android runner、受管测试进程与报告边界。
- `scripts/test/terminal-ws-wire-client.mjs`、`scripts/test/terminal-ws-wire-client.test.mjs`：拓扑验证客户端的协议与诊断边界。
- 本轮定向 Node 测试文件：`scripts/test/ter-persist-kv-prechange-android.test.mjs`、`scripts/test/ter-admin-display-web.test.mjs`、`scripts/test/ter-virtual-keyboard-android.test.mjs`、`scripts/test/terminal-topology-device-identity.test.mjs`、`scripts/test/terminal-topology-heartbeat-window.test.mjs`、`scripts/test/terminal-topology-runner-guards.test.mjs`、`scripts/test/terminal-owned-test-report.test.mjs`、`scripts/test/test-health-entry-runner.test.mjs`、`scripts/test/terminal-ws-wire-client.test.mjs`。
- `apps/terminal` 中计划列出的生产改动、测试、package manifests 与配置：请按详设逐项定位并审查，不以本文路径清单替代完整范围。

## 独立核验重点

- 对 TP-A1、TP-A3..A11、TP-B0..B5、TP-C1..C3、TP-D1..D4、TP-X1..X3，逐项回到详设判据与当前生产实现；同族消费者与测试不得抽样。
- 检查 RNTL v14 setup/lifecycle/cleanup、原生 Gradle 测试入口、真实 production registry socket 测试、persist-kv 命名空间迁移、错误边界/重启 command、遮挡输入与焦点 owner、ReactEditText 长按菜单、键盘配置和动态导入。
- 重点证伪本轮 runner 测试是否能抓住：stat 行 PID 缺失/不匹配、package 名只出现在 cmdline 后续参数、TP-A7 将合法心跳误判为业务流量或把断连/重连误判为 PASS、marker 外旧日志污染窗口判定。
- 检查新断言是否绑定真实生产调用，而非只断言 helper 存在、字符串出现或 fixture 自洽；寻找可让错误实现仍然变绿的反例。
- 只评价代码和测试。动态状态边界仅作上下文：W5/W7/W8 是 Dexter 豁免，W10 跳过；其余未由 Web 可证的原生/拓扑项不在本次代码复审中升级为通过。208/208 仅为本轮定向 Node 用例结果，不代表整批验收通过。

## 期望结论

请给出明确 `GO` 或 `NO-GO` 与 `M/S/N=x/y/z`。每项 finding 请注明详设位置与实现/测试精确路径和行号、可复现反例或影响、最小修复建议，以及是否需要 Dexter 裁决。若只覆盖局部，应明确列出未审范围，不得把局部结论写成整批结论。

## 可直接复制给 Claude 的话术

```text
您好 Claude，请对 TER 第三方库用法整改当前实现做一次只看代码与测试的静态复审。

背景：本批依据需求 v3.4 实施 TP-A1、TP-A3..A11、TP-B0..B5、TP-C1..C3、TP-D1..D4、TP-X1..X3。Dexter 已将剩余动态验证限定为 Web，豁免 W5/W7/W8，并指示 W10 跳过。本轮先全面静态复核相关测试脚本与用例，再集中运行；当前最终定向 Node 测试集为 208/208 PASS（9 个文件，0 skipped）。此请求不要求审查动态证据或设备验收。

目标：请独立审查当前生产代码、测试、runner 与配置是否符合需求/详设，重点找遗漏、false PASS/false FAIL、断言未绑定生产调用、第三方 API 误用及同根缺陷。请只读代码和规范，不读取 `.runtime`、`doc/evidence`、截图或运行产物；不需要运行命令。

请从 catering-v2s 仓库根阅读：
- `doc/plans/platform/2026-09-28-ter-third-party-usage-remediation-requirements-claude.md`：唯一需求输入，v3.4；
- `doc/plans/platform/2026-09-28-ter-third-party-usage-remediation-implementation-design-codex.md`：详设判据；
- `doc/plans/platform/2026-09-28-ter-third-party-usage-remediation-implementation-plan-codex.md`：范围与验收计划；
- `doc/platform/third-party-library-usage-standard.md`、`doc/platform/terminal-coding-standard.md`、`doc/platform/frontend-coding-standard.md`、`doc/platform/backend-coding-standard.md`：适用规范；
- `tools/terminal-topology/process-identity.mjs`、`tools/terminal-topology/heartbeat-window.mjs`、`tools/terminal-topology/device-identity.mjs`、`tools/terminal-topology/run-dual-device.mjs` 及 `scripts/test/terminal-topology-runner-guards.test.mjs`、`scripts/test/terminal-topology-heartbeat-window.test.mjs`、`scripts/test/terminal-topology-device-identity.test.mjs`：拓扑进程身份、TP-A7 与动态 AVD 发现判据；
- `scripts/test/ter-persist-kv-prechange-android.mjs`、`scripts/test/ter-persist-kv-prechange-android.test.mjs`：A11 进程身份读回与测试；
- `scripts/test/ter-admin-display-web.mjs`、`scripts/test/ter-admin-display-web-contract.mjs`、`scripts/test/ter-admin-display-web.test.mjs`、`scripts/test/ter-virtual-keyboard-android.mjs`、`tools/terminal-shared/run-owned-android-tests.mjs`、`tools/terminal-shared/vitest-json-report.mjs`、`scripts/test/terminal-ws-wire-client.mjs` 与本轮定向 Node 测试文件：相关 runner 与用例；
- 测试文件：`scripts/test/ter-persist-kv-prechange-android.test.mjs`、`scripts/test/ter-admin-display-web.test.mjs`、`scripts/test/ter-virtual-keyboard-android.test.mjs`、`scripts/test/terminal-topology-device-identity.test.mjs`、`scripts/test/terminal-topology-heartbeat-window.test.mjs`、`scripts/test/terminal-topology-runner-guards.test.mjs`、`scripts/test/terminal-owned-test-report.test.mjs`、`scripts/test/test-health-entry-runner.test.mjs`、`scripts/test/terminal-ws-wire-client.test.mjs`。
- `apps/terminal` 内详设点名的生产源码、测试、配置与 package 文件：请从详设完整枚举，不要抽样。

请重点核验：每条 TP 的代码实现与同根消费者；测试断言是否能让错误实现变红；stat 行 PID 缺失/错配、cmdline 后续参数伪装包名、心跳合法 ping/pong 与非心跳活动的区分、marker 外旧日志对 TP-A7 窗口的污染；以及 RNTL lifecycle、原生测试入口、socket/持久化/输入焦点/错误恢复等详设判据。对运行证据、截图、设备和 `.runtime`/`doc/evidence` 内容不要作判断。

烦请给出明确 `GO` 或 `NO-GO`，并列出 `M/S/N=x/y/z`。每条 finding 请附详设与实现/测试的精确路径和行号、影响或反例、最小修复建议及是否需要 Dexter 裁决；若未覆盖整批代码，请明确写出未审范围。

授权边界：本次仅请求只读静态代码与测试复审，不授权任何源码改动、安装、构建、测试、Web/设备/虚拟机动态运行；本复审结论也不把 W10 或任何豁免/未运行项改判为 PASS。谢谢。
```
