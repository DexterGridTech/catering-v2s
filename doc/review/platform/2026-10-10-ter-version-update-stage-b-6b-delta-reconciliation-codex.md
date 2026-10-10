# TER 阶段 B 当前字节 6b 差量对账

`REVIEW_SCOPE=STAGE_B_BATCH_6B_DELTA`
`VERDICT=MATCHED`
`M/S/N=0/0/0`
`REVIEWER=FRESH_INDEPENDENT_READ_ONLY_SUBAGENT`
`DYNAMIC_ACCEPTANCE=NOT_RUN_BY_THIS_REVIEW`

## 范围与旧证据边界

本记录覆盖既有整批 6b 后的两个当前字节差量：CP-04 的 terminal-update actor UNKNOWN 报告持久化修正，以及 CBS 流式下载异步请求超时配置。旧全批 6b 对未变化的范围仍适用；本差量 verdict 不代替动态验收、DEV、backend-acceptance、管理后台、设备更新、13c 或最终整批 IMPLEMENTATION review。

## 独立差量结论

Fresh reviewer 对需求、阶段 B 详设/计划/Journey/IA、命中项目记忆与当前 owning source 做只读核验，结论 `MATCHED`。其报告指出：

- `apps/terminal/kernel/base/terminal-update/src/features/actors/terminalUpdateActor.ts:737` 的早期 actual-facts UNKNOWN 分支经现有 `writeTask` 保留任务与待发报告；相应测试验证当前目标与真实 APK SHA 报告事实保留。该修改仍只复用现有 task/report slice。
- `apps/backend/catering-business-server/src/main/resources/application.yaml:1-5` 将 Spring MVC 异步请求超时设为 `130s`，符合阶段 B 计划 CP-04 的明确值。`TerminalUpdateDownloadController` 使用 `StreamingResponseBody`，成功仍需通过完整 body 长度、ZIP SHA-256 和流完成日志判定，HTTP 200 不等于成功。
- 对照当前解析图：`org.springframework.boot:spring-boot-webmvc:4.1.0` 解析到 `org.springframework:spring-webmvc:7.0.8`（`./gradlew :apps:backend:catering-business-server:dependencyInsight --dependency spring-webmvc --configuration runtimeClasspath`，BUILD SUCCESSFUL）。Spring Boot `v4.1.0` 官方 `WebMvcProperties.Async.requestTimeout` 将该配置定义为异步请求超时；同标签 `WebMvcAutoConfiguration` 将 `Duration` 转为毫秒并调用 MVC `setDefaultTimeout`。对应 Spring Framework `v7.0.8` 的 `AsyncSupportConfigurer` 说明该超时覆盖 Servlet 异步处理窗口。依据：[Boot v4.1.0 WebMvcProperties.java](https://raw.githubusercontent.com/spring-projects/spring-boot/v4.1.0/module/spring-boot-webmvc/src/main/java/org/springframework/boot/webmvc/autoconfigure/WebMvcProperties.java)、[Boot v4.1.0 WebMvcAutoConfiguration.java](https://raw.githubusercontent.com/spring-projects/spring-boot/v4.1.0/module/spring-boot-webmvc/src/main/java/org/springframework/boot/webmvc/autoconfigure/WebMvcAutoConfiguration.java)、[Framework v7.0.8 AsyncSupportConfigurer.java](https://raw.githubusercontent.com/spring-projects/spring-framework/v7.0.8/spring-webmvc/src/main/java/org/springframework/web/servlet/config/annotation/AsyncSupportConfigurer.java)。

该独立 verdict 仅闭合当前设计/源码三维差量；设置值对实际 DEV 完整流的效果仍待动态证明。

## 历史首败与剩余运行证明

- 首败保留在 `.runtime/terminal-automation/15edb639-bbad-43e5-841d-bd40aa3ed0ad/runner.log`：`TERMINAL_AUTOMATION_UPDATE_SCENARIO_ASSERTIONS_NOT_OBSERVED`，business `FAIL`，cleanup `PASS`。设备端下载声明大小为 `37,731,300` 字节；流中断时读取约 `16,785,107` 字节，随后出现 `InterruptedIOException`，期待的 `INSTALLER_AWAITING_READBACK` 未发生。
- 同一受管 DEV run 的 `.runtime/r5/dev/r5-dev-1791546571506-89576-b2015453-814a-4a99-942e-f74c31d51cd4/business-server.log` 记录 `AsyncRequestTimeoutException`，其 `/content` 请求在约 30 秒处被 MVC 判超时；edge 完成日志约 `30,580ms` 且状态 200。该 status 只表示响应开始，不能证明下载完整。
- 最小修正是在配置 owner 设置 130 秒，覆盖 Android 现有 120 秒下载期限；Android 客户端 deadline 未放宽。当前字节尚无针对完整 37,731,300 字节流的重新运行，不能声明修复已动态通过。

## 当前准入

该对账满足在整体动态验收前要求的当前字节 6b 差量门。动态仍应先生成当前字节 run-owned 工件并完成完整 `r5-full` seed dry-run；之后再按批准的受管流程执行 backend acceptance、reset/start/seed、后台供给链及单机双屏设备场景。每项业务结果和 cleanup 分开记录。
