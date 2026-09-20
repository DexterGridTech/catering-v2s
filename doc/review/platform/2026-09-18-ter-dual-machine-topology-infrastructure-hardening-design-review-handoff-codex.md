REVIEW_KIND=IMPLEMENTATION_FACING_DESIGN
REVIEW_TARGET=DESIGN
DESIGN_GRANULARITY_MANIFEST=doc/plans/platform/2026-09-18-ter-dual-machine-topology-infrastructure-hardening-design-granularity.json
ADVERSARIAL_REVIEW_REPORT=doc/review/platform/2026-09-18-ter-dual-machine-topology-infrastructure-hardening-design-adversarial-review-codex.json
REVIEW_STATUS=REQUESTED

## 背景

本轮交付是 TER 双机拓扑基建加固的 implementation-facing 详设与实施计划。上一轮 DESIGN review 的 2M/3S/3N 已逐条核验并修订；Dexter 明确要求详设把基建能力做充分测试覆盖。当前只修改了详设、实施计划、D-12 fixture 家族与交接文档，没有修改源码、测试、依赖、Gradle、构建产物或运行环境。D-12 保留权威业务 fixture，并新增只承接物理边界的多片、低压缩性和小载荷辅助 fixture；fflate 的最终字节/片数仍必须在 CP-0 实测。

本轮严格分三阶段：CP-0 先同步旧 CP-2 计划并完成分母/依赖预检；阶段一处理 R-1～R-7；阶段二处理 R-8～R-10 与 R-16 的压缩、分片、终态和副机应用层心跳；阶段三处理 R-11～R-15，R-15 必须最后。

## 评审目标

请独立判断详设与实施计划是否可以进入实现，重点确认：

1. D-1～D-15 是否逐项给出可执行、不可绕过的结论，D-15 是否真的作为第一实施步骤同步旧 CP-2；
2. R-5 是否只删除未接线 limiter，保留 selector/retry/connectionToken 形态和 identity failover，不新增 replaceServers/profile/多地址配置消费；
3. R-8～R-10 与 R-16 的 wire、压缩、分片、重组上限、typed failure、普通 peer-loss/reconnect 和应用层心跳是否闭合，且 payload 终态不会关闭 peer/session；
4. D-12 fixture 家族、D-6 阈值和 U-9 的 forced codec/raw fallback/red mutation 是否足以阻止恒等 codec、删除 codec、always raw、只用高度重复数据以及伪造单片边界；
5. U-1～U-18 是否每条都有真实执行体、业务 oracle 和对应 production red mutation，是否满足 Dexter 对“基建能力必须有充分测试覆盖”的要求；
6. D-4 选择 Kotlin JVM test source set 是否足以承接 R-2/R-3 与既有 HTTP/close/stats contract；
7. R-11～R-15 的八项真实 module-level 前置覆盖、测试 hash 冻结和 R-15 最后拆分是否可证伪；
8. 步骤级三维对账、全批三维对账、逐代码与详设逐行对账是否互不替代，任一 OPEN 是否阻止交付。

请不要把本次文档状态、D-12 fixture 的存在或作者自读当作实现/验收证据，也不要把没有执行的 focused、Kotlin、Android、设备、容量或 cleanup 结论写成 PASS。

## 需阅读文件

- doc/plans/platform/2026-09-18-ter-dual-machine-topology-infrastructure-hardening-requirements-claude.md：需求 R-1～R-16、D-1～D-15、U-1～U-18；
- doc/plans/platform/2026-09-18-ter-dual-machine-topology-infrastructure-hardening-implementation-design-codex.md：详设、传输形态、失败边界、D 项结论和测试覆盖；
- doc/plans/platform/2026-09-18-ter-dual-machine-topology-infrastructure-hardening-implementation-plan-codex.md：CP-0～CP-4、D-15 首步、U 矩阵、三层对账和交付闸门；
- doc/plans/platform/2026-09-18-ter-dual-machine-topology-infrastructure-hardening-design-granularity.json：范围、门控和设计状态；
- doc/review/platform/2026-09-18-ter-dual-machine-topology-infrastructure-hardening-design-adversarial-review-codex.json：独立子 agent 审查状态，当前为 OPEN，不是 verdict；
- doc/plans/platform/fixtures/ter-dual-machine-members-fixture-manifest.json：D-12 权威/辅助 fixture 的职责、hash 和 canonical members 分母；
- doc/plans/platform/fixtures/ter-dual-machine-members-capacity-fixture.json：权威业务 fixture，U-8/U-9 主数据源；
- doc/plans/platform/fixtures/ter-dual-machine-members-multi-chunk-stress-fixture.json：多片/重组/延迟写入辅助 fixture；
- doc/plans/platform/fixtures/ter-dual-machine-members-low-compressibility-fixture.json：compression-not-beneficial 辅助 fixture；
- doc/plans/platform/fixtures/ter-dual-machine-members-small-raw-fixture.json：below-threshold 辅助 fixture；
- doc/plans/platform/2026-09-17-ter-dual-machine-topology-implementation-plan-codex.md：待由 D-15 在实施首步同步的旧 CP-2；
- apps/terminal/kernel/base/contracts/src/foundations/topologyWire.ts：wire parser/serializer 与当前帧边界；
- apps/terminal/kernel/base/contracts/src/types/topology.ts：wire/status/error 类型；
- apps/terminal/kernel/base/transport/src/foundations/createTopologySession.ts：session、发送、接收和心跳接线 owner；
- apps/terminal/kernel/base/transport/src/foundations/createTransportHeartbeat.ts：应用层心跳 controller；
- apps/terminal/kernel/base/transport/src/foundations/resolveTransportServerAddresses.ts：必须保留的多地址选择/failover owner；
- apps/terminal/kernel/base/transport/src/foundations/createTransportRetryController.ts：必须保留的 retry owner；
- apps/terminal/kernel/base/topology/src/application/createTopologyModule.ts：R-11～R-15 行为与拆分 owner；
- apps/terminal/kernel/base/topology/test/topology.test.ts：R-15 前必须补齐并冻结的真实 module-level coverage；
- apps/terminal/assembly/base/android/android/src/main/java/com/catering/v2s/terminal/assembly/base/android/TerminalTopologyServer.kt：R-2/R-3 host owner；
- apps/terminal/assembly/base/android/android/build.gradle：D-4 JVM test source set 边界；
- apps/terminal/adapter/android/dual-screen/android/src/main/java/com/catering/v2s/terminal/adapter/android/dualscreen/TerminalDualScreenActivityHandler.kt：D-3/U-4 恢复 owner；
- HANDOFF.md：R-1 外部事实和 CVE 条件化登记目标；
- doc/decisions/templates/implementation-design-template.md：详设模板；
- doc/platform/claude-review-handoff-template.md：交接格式正本；
- project-memory/operations/verification-governance.md：机器门、red mutation、证据与交付边界；
- project-memory/operations/claude-review-handoff-standard.md：评审交接规范。

## 独立核验重点

1. 以当前源码字节重算行号和分母；重点检查 D-15 是否先消除旧 CP-2 中与 R-5 相反的 limiter/full generic transport 指令。
2. 反例核对 R-5：selector 被收窄、identity failover 被改变、只删源文件不删 export/invariant/README/test 时，U-5 是否一定变红。
3. 反例核对 D-12/U-9：权威 570-member fixture 是否仍是 U-8/U-9 主数据源；low-compressibility 与 small-raw 是否分别有真实 raw fallback 执行体；multi-chunk 是否在 CP-0 用实际 fflate 达到至少 4 片；恒等 codec、删除 codec、always raw 是否各自可证伪。
4. 反例核对 D-13/R-16：payload deterministic failure 是否只锁 slice/revision/checksum；new revision、new session、transient chunk timeout 的解除语义是否不同；心跳超时是否走普通 peer-loss/reconnect，且分片期间 control ping/pong 不饿死。
5. 核对 D-4：JVM tests 是否覆盖 lastPongAt 可见性、动态 address、bind/role/timeout 和旧 HTTP/close/stats contract；不能以人工 checklist冒充机器门。
6. 核对 R-11～R-15：八项 tests 是否真的驱动 createTopologyModule；测试 hash 是否在拆分前冻结；拆分后能否一行不改并捕获 force/cancel/disconnect/revision 行为；取消是否按并发在途 commandId 集合而非单槽。
7. 逐条检查 U-1～U-18 的 executor、oracle、档位和 red mutation，明确仍是设计阶段 OPEN 的外部/设备事实；特别检查 U-13 是否证明 send failure 不污染 membersSyncRevision。
8. 检查三阶段不可并行、R-15 最后、CP-3 全批三维对账先于整体测试，以及逐代码与详设对账不得被其他门替代；确认阶段一删除 limiter 不会在阶段二被换名重建为控制队列。
9. 检查本轮没有源码/测试/依赖/构建/设备授权，没有绝对路径，没有把设计 fixture/hash写成容量承诺或 acceptance PASS；`state-full`→`state-full-chunk`（含 total=1）是否已登记为 INV-1 C-3。

## 期望结论

请给出明确 GO 或 NO-GO，并报告 M/S/N 数量。每条 finding 请区分仓内事实、推论、外部事实和尚缺证据，给出精确相对路径/符号/行号、owning source、适用条件、可绕过反例、最小修复建议及是否需要 Dexter 裁决。

本轮对象是 DESIGN：GO 只表示详设与实施计划可以进入下一步评审/实施决策，不表示源码实现、测试、Android、设备、release、visual、Web、cleanup 或 implementation acceptance PASS。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请协助独立评审 TER 双机拓扑基建加固的 implementation-facing 详设与实施计划。

背景：上一轮 DESIGN review 的 2M/3S/3N 已逐条核验并修订；Dexter 明确要求“基建能力必须有充分的测试覆盖”。本轮只交付详设、实施计划、D-12 fixture family 和交接文档，源码、测试、依赖、构建、设备和动态证据均未执行。权威业务 fixture 仍承担 U-8/U-9 的业务主数据，辅助 fixture 只覆盖多片、低压缩性和小载荷物理分支；fflate 的最终片数与分支结果必须在 CP-0 实测。详设和计划把工作分为三个严格串行阶段，CP-0 的第一步必须同步旧 CP-2 计划，R-15 必须最后。

目标：请独立核验 D-1～D-15、R-5/R-16、D-12 fixture family/U-9、D-4、R-11～R-15 的边界，以及 U-1～U-18 是否都有真实执行体、业务 oracle 和 production red mutation，并判断是否满足充分测试覆盖。请把 fixture 的 node-zlib 预览与 CP-0 必须完成的 fflate 实测分开，不要把设计阶段 hash/预览写成 runtime 或容量 PASS。

评审对象：
- doc/plans/platform/2026-09-18-ter-dual-machine-topology-infrastructure-hardening-implementation-design-codex.md
- doc/plans/platform/2026-09-18-ter-dual-machine-topology-infrastructure-hardening-implementation-plan-codex.md

请从仓库根阅读：
- doc/plans/platform/2026-09-18-ter-dual-machine-topology-infrastructure-hardening-requirements-claude.md：需求 R-1～R-16、D-1～D-15、U-1～U-18；
- doc/plans/platform/2026-09-17-ter-dual-machine-topology-implementation-plan-codex.md：D-15 要在实施首步同步的旧 CP-2；
- doc/plans/platform/fixtures/ter-dual-machine-members-fixture-manifest.json：D-12 fixture family manifest；
- doc/plans/platform/fixtures/ter-dual-machine-members-capacity-fixture.json：权威业务 fixture；
- doc/plans/platform/fixtures/ter-dual-machine-members-multi-chunk-stress-fixture.json：多片压力 fixture；
- doc/plans/platform/fixtures/ter-dual-machine-members-low-compressibility-fixture.json：低压缩性 fixture；
- doc/plans/platform/fixtures/ter-dual-machine-members-small-raw-fixture.json：小载荷 raw fixture；
- apps/terminal/kernel/base/contracts/src/foundations/topologyWire.ts、apps/terminal/kernel/base/contracts/src/types/topology.ts：wire/parser/type 现状；
- apps/terminal/kernel/base/transport/src/foundations/createTopologySession.ts、createTransportHeartbeat.ts、resolveTransportServerAddresses.ts、createTransportRetryController.ts：session、R-16、R-5 保留能力；
- apps/terminal/kernel/base/topology/src/application/createTopologyModule.ts、apps/terminal/kernel/base/topology/test/topology.test.ts：R-11～R-15 真实行为与拆分前置；
- apps/terminal/assembly/base/android/android/src/main/java/com/catering/v2s/terminal/assembly/base/android/TerminalTopologyServer.kt、apps/terminal/assembly/base/android/android/build.gradle：D-4 JVM 测试承接；
- doc/plans/platform/2026-09-18-ter-dual-machine-topology-infrastructure-hardening-design-granularity.json、doc/review/platform/2026-09-18-ter-dual-machine-topology-infrastructure-hardening-design-adversarial-review-codex.json：范围和独立审查状态；
- project-memory/operations/verification-governance.md、project-memory/operations/claude-review-handoff-standard.md：机器门、证据和交接边界。

请重点独立核验：
1. D-15 是否真的是第一实施步骤，旧 CP-2 是否还残留与 R-5 相反的 limiter/full generic transport 指令；
2. R-5 是否只删除未接线 limiter，保留 selector/retry/connectionToken 及 identity failover，且没有用 export/README 冒充消费；
3. D-12/U-9 是否按 manifest 使用权威业务 fixture 与三个辅助 fixture：forced codec、compression-not-beneficial、below-threshold、封闭 raw fallback 和三种 production red mutation 是否各自可证伪；multi-chunk 的实际 fflate 片数是否满足要求；
4. D-13/R-16 是否把 payload terminal 与普通 peer-loss/reconnect 完全隔离，且分片期间 control heartbeat 不饿死；
5. D-4 的 Kotlin JVM test source set 是否能覆盖新旧 host contract；
6. U-1～U-18 是否逐条有真实执行体、业务 oracle 和对应 red mutation，是否达到 Dexter 要求的充分测试覆盖；U-13 是否覆盖发送失败后 revision 不变，U-16 是否覆盖并发交叉取消；
7. R-15 前八项真实 module-level coverage、测试 hash 冻结、拆分后一行不改，以及三阶段/三层对账门是否可证伪。

请给出明确 GO 或 NO-GO，并报告 M/S/N 数量。每条 finding 请区分仓内事实、推论、外部事实和尚缺证据，给出精确相对路径/符号/行号、owning source、适用条件、可绕过反例、最小修复建议及是否需要 Dexter 裁决。

授权边界：本次是 DESIGN review，只评审详设、实施计划、fixture 与交付门；不授权修改源码、测试、依赖、脚本或构建产物，不授权 Web、Metro、Android、设备、DEV、seed、UAT、部署或 implementation acceptance。当前独立子 agent 审查记录为 OPEN，不得把它当作 verdict；本次 review 也不得把设计文档状态写成 implementation PASS。
```
