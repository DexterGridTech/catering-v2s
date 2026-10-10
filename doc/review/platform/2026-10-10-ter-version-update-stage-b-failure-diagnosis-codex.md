SKILL_USED=cs-systematic-debugging@808fc5717aa88ad65efff312b11c186294d3e6ee301afb584e2f86599b137787

# TER 阶段 B 首败与 focused 修复记录

## 范围

记录 terminal-update 包测试中“实际版本已读取，但执行期 UNKNOWN 没有进入持久任务报告”的失败族。该记录不代表 CP-04 差量对账、全批 6b、后端验收、DEV、管理后台或真机验收通过。

## 首败与根因

首次 `yarn workspace @catering-v2s/kernel-base-terminal-update test` 的首个相关失败是 persisted CBS snapshot 场景没有看到预期 APK SHA 报告字段；同一运行还出现两个基于旧 `readFacts` 调用计数的 fixture 断言失败。修正后再次运行时，同一报告断言仍失败，因此冻结该失败族并回到 owning source，而不是换场景重试。

根因位于 `apps/terminal/kernel/base/terminal-update/src/features/actors/terminalUpdateActor.ts`：接受目标前的新 application identity preflight 已取得实际版本信息，但 `executeNextArtifact` 随后的 `readFacts` 若失败，只派发内存 `recentStatus=UNKNOWN` 并返回，没有经 `writeTask` 建立/持久化 UNKNOWN 任务与待发报告。调用方因此不能在后续 PONG 中提交真实报告。相邻的缺少原始 bundle version 或 boot identity 分支也曾仅返回 UNKNOWN，具有相同的持久闭包缺口。

## 最小修正与有限分母

- application identity preflight 的成功结果沿既有 `replaceActualVersions` 状态路径保存；报告从该已读取的实际事实形成，不创建第二份版本账本。
- `executeNextArtifact` 的三种早期 UNKNOWN 分支（actual facts 读取失败、原始 bundle/boot 事实缺失、持久任务缺少原始 bundle version）统一先调用现有 `writeTask`；持久化失败显式返回 `persistence-failed`，不假称报告已排队。
- 删除调用方仅更新内存 `recentStatus` 的重复包装，直接消费 `executeNextArtifact` 的持久化结果，避免同一分支出现两个状态来源。
- 本次同根扫描分母为 `executeNextArtifact` 内全部早期 UNKNOWN 返回点；逐项确认三处均先执行持久写入。作用边界仅是阶段 B 固定任务执行前的 UNKNOWN/报告路径，不改变目标接受拒绝、下载授权、FULL/HOT 顺序或阶段 C 行为。

## focused 证明

- `yarn workspace @catering-v2s/kernel-base-terminal-update typecheck`：PASS，exit 0。
- `yarn workspace @catering-v2s/kernel-base-terminal-update test`：PASS，2 个测试文件、43 项测试，package runner 返回 exit 0；runner 的退出判定包含其自有测试临时资源清理。
- 新/改测试直接断言：snapshot 路径在目标 preflight 读到实际 APK SHA、后续 actual-facts 读取失败时，current task 保持固定目标且 pending report 的 actual SHA 与真实预读一致、状态为 UNKNOWN。持久化失败仍不暴露 target，并允许后续调用正常恢复。
- 两项额外失败为测试替身的 `readFacts` 调用次数未计入新的 identity preflight；按真实调用顺序更新 fixture 后，同一 focused suite 通过，没有通过放宽生产断言解决。

## 当前证据边界

本记录所述 focused test/typecheck 是本轮当前源码的包级证据，不是 backend-acceptance BUSINESS、DEV 或端到端设备证据。失败的完整命令输出由该轮工具输出保留；本记录不为更早的历史运行追加成功状态。CP-04 fresh delta reconciliation、其后必要的动态验收及 Stage B 最终 review 仍分别独立。

## 同批后续首败：CBS 完整工件流被异步超时截断

### 首败与根因

- 受管运行 `15edb639-bbad-43e5-841d-bd40aa3ed0ad` 的业务为 `FAIL`、runner cleanup 为 `PASS`，首败标记是 `TERMINAL_AUTOMATION_UPDATE_SCENARIO_ASSERTIONS_NOT_OBSERVED`。它已保留；没有在相同字节上盲目重跑。
- `runner.log` 显示真实 UI 供给链完成规则创建、启用与 grant，但工件正文下载只读到约 16.8 MB，后续 `InterruptedIOException`，最终状态为 `NATIVE_UPDATE_OPERATION_FAILED`，而不是完整下载后应有的 `INSTALLER_AWAITING_READBACK`。服务端宣告总大小为 `37,731,300` 字节；因此 HTTP 200 和响应头都不能作为成功证据。
- 同一受管 DEV 的 `business-server.log` 明确记录 `AsyncRequestTimeoutException`。`TerminalUpdateDownloadController` 以 `StreamingResponseBody` 流式传输，而 `application.yaml` 当时未配置 `spring.mvc.async.request-timeout`；服务端默认异步处理超时在约 30 秒触发，edge 请求结束状态 200 仅表示 MVC 请求生命周期结束，不能证明已写完完整 body。

### 最小修正与第三方依据

- 当前 `apps/backend/catering-business-server/src/main/resources/application.yaml` 设置 `spring.mvc.async.request-timeout: 130s`，大于 Android `TerminalUpdateArtifactPreparer` 现有 120 秒 `callTimeout`。没有延长客户端 timeout，也没有变更压缩/工件预算或另建下载机制。
- 当前依赖解析命令 `./gradlew :apps:backend:catering-business-server:dependencyInsight --dependency spring-webmvc --configuration runtimeClasspath` 返回 Spring Boot Web MVC `4.1.0` 和 Spring MVC `7.0.8`，`BUILD SUCCESSFUL`。精确上游依据：Boot `v4.1.0` `WebMvcProperties.Async.requestTimeout` 定义超时属性，`WebMvcAutoConfiguration` 将 `Duration` 转成毫秒并交给 `AsyncSupportConfigurer.setDefaultTimeout`；Framework `v7.0.8` API 说明 Servlet 异步生命周期的 timeout 范围。[Boot properties](https://raw.githubusercontent.com/spring-projects/spring-boot/v4.1.0/module/spring-boot-webmvc/src/main/java/org/springframework/boot/webmvc/autoconfigure/WebMvcProperties.java)、[Boot MVC auto-configuration](https://raw.githubusercontent.com/spring-projects/spring-boot/v4.1.0/module/spring-boot-webmvc/src/main/java/org/springframework/boot/webmvc/autoconfigure/WebMvcAutoConfiguration.java)、[Framework API](https://raw.githubusercontent.com/spring-projects/spring-framework/v7.0.8/spring-webmvc/src/main/java/org/springframework/web/servlet/config/annotation/AsyncSupportConfigurer.java)。

### 当前证明与待验证边界

新的独立 CP-04 差量对账与整批 6b 差量对账均为 `MATCHED`。本修正仍没有新的真实 DEV 完整流证据；待运行需同时确认 server `STREAMED` 的精确长度/hash、runner `BODY_END` 的完整字节数/hash、Android 完整 ZIP 摘要与 installer readback，以及业务和 cleanup。重复验收前必须使用当前源码构建/重启 DEV 和当前发布物，并保持唯一受管运行。

### taskId 首败修复后暴露的报告日期断言

- 受管 console run `182f0840-39e9-4776-a737-893579b2bb1e` 保留为 `BUSINESS=FAIL / CLEANUP=PASS`。taskId 改为 UUID 后，报告 POST 返回 200、CBS receipt 将 pending 从 1 降至 0；实际 FULL→HOT 更新和安装读回均成功。最终断言失败在后台报告行日期文本：运行时显示 `2026年10月10日`，runner 却只接受 `YYYY-MM-DD`。
- 根因是 runner 忽略产品已有的 `formatCanonicalDateTime` 格式：`libraries/frontend/admin-ui-foundation/src/time/formatCanonicalDateTime.ts` 使用 `Intl.DateTimeFormat('zh-CN', {dateStyle:'medium', ...})`，其既有单测断言为 `2026年1月2日`；运营页面报告行直接调用该格式化函数。产品显示与详设的报告读回要求一致，错误在验收 helper 的日期模式。
- 最小修正：`tools/terminal-automation/journeys/terminalUpdateSupplyUi.ts` 将该断言改为接受中文年月日格式。保留终端名、版本、状态、规则/工件身份与详情/历史等内容断言，不放宽业务断言、不改产品 UI。
- 这是被首败阻断后暴露的独立 runner 断言缺陷，不是报告投递/更新业务失败。相同 managed case 的当前字节复验尚待执行；不得以首败中的其他通过片段代替最终场景 PASS。
