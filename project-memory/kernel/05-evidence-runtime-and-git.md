---
id: kernel.evidence-runtime
status: active
layer: kernel
taskKinds: ["all"]
domains: ["all"]
consumerFaces: ["all"]
owners: ["all"]
impacts: ["all"]
triggers: ["all"]
assertions: ["LOG_FIRST_RETRY","BUSINESS_CLEANUP_SEPARATE","DEV_START_NO_SEED","NO_GIT_WRITE","OBSERVABILITY_REQUIRED_FOR_ACCEPTANCE","RUN_SCOPED_LOG_READ_REQUIRED","OUT_OF_SCOPE_OBSERVABILITY_REPAIR_NO_EXTRA_AUTH"]
sourceRefs: ["doc/decisions/2026-07-24-v2s-single-deployable-modular-monolith-service-shape.md","doc/decisions/2026-07-29-v2s-observability-and-acceptance-standard.md","doc/heritage/frozen/catering-all-v2/project-memory/decisions/logging-and-debugging-foundation-standard.md","doc/plans/platform/2026-07-24-v2s-carryover-manifest-claude.md","doc/roadmaps/platform/2026-07-24-v2s-execution-roadmap.md"]
---
# Evidence, runtime and repository-control kernel

- `LOG_FIRST_RETRY`: 首败必须保留并读取 run-scoped 日志；同一 signal 第二次尝试前完成诊断。完整结构化/脱敏/`LOG_NOT_AVAILABLE` 标准回读冻结 Heritage 原文，不以本 kernel 压缩条目替代。
- `BUSINESS_CLEANUP_SEPARATE`: business 与 cleanup 分开判定，cleanup 非 PASS 不得完成。
- `DEV_START_NO_SEED`: DEV start/restart 不得 seed。
- `NO_GIT_WRITE`: 仓库控制权始终由 Dexter 自主决定；Codex 与 Claude 不得要求、提醒、催促、等待、索取或暗示 Dexter 执行任何仓库控制动作，且不得以此阻断设计或开发。
- `OBSERVABILITY_REQUIRED_FOR_ACCEPTANCE`: 脚本、业务代码与支撑代码的实际运行边界必须有统一、结构化、脱敏、可关联的必要诊断；audit、Problem response、exit code、测试名称或临时输出都不能替代。安全敏感路径不记录凭据、OTP、token/cookie、手机号/登录名、原始 IP 或 raw payload。
- `RUN_SCOPED_LOG_READ_REQUIRED`: 受管运行开始即保留 run-scoped manifest、阶段/心跳、受控 process identity 和日志路径；测试/动态验证必须读取日志并区分 first failure、last known good、broken boundary、business 与 cleanup。无新日志必须诊断，不能靠等待、延长 timeout 或盲目重试收口。
- `OUT_OF_SCOPE_OBSERVABILITY_REPAIR_NO_EXTRA_AUTH`: 已识别的日志/诊断缺口即使位于 feature 原 change surface 外，也须在当前工作补齐，无需另向 Dexter 索取日志授权；业务语义、owner、数据、公开协议、Roadmap 和 package-exit 的既有边界不因此放宽。
