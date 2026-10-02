# 批次三 CP-06 实施与对账记录

CP-06：适用门、诊断与静态验证。

当前状态：`CP_RECONCILIATION=MATCHED`。fresh 独立 reviewer `/root/batch3_cp06_recheck_after_doris_keys` 完成 CP-06 三维对账，结论 `PASS`；此后只在本记录中登记 verdict 与字节指纹，没有修改生产代码、测试、脚本或计划。

## 适用门与 focused proof

| 执行面 | 入口/结果 | 当前证据 |
|---|---|---|
| Backend module boundaries | `scripts/verify --validate-only`：`R4_TDS_MQ_RED=PASS`、`R4_TDS_OUTBOX_RED=PASS`、`R4_TDS_APPROVED_RUNTIME_GREEN=PASS`、`R4_BACKEND_SELF_TEST=PASS` | `.runtime/batch3-cp06/validate-only-post-doris-closure.log` |
| Logging boundaries | 同一命令：terminal-binding 与 TDS 两个 red marker、`R4_LOGGING_SELF_TEST=PASS`、生产检查 `R4_LOGGING_BOUNDARIES=PASS` | `.runtime/batch3-cp06/validate-only-post-doris-closure.log` |
| Runtime environment keys | 当前字节：唯一策略与 Java 闭集均为 28 键，包含五个 Doris 键；门自测覆盖 policy/Java 遗漏、TDS Properties 与 Spring 绑定、YAML 映射、Stream Load 消费和 DEV runner 注入；`R5_RUNTIME_ENVIRONMENT_KEYS_SELF_TEST=PASS`，生产 `R5_RUNTIME_ENVIRONMENT_KEYS=PASS` | `.runtime/batch3-cp06/validate-only-post-doris-closure.log:262-283`；focused 命令输出记于本记录下方 |
| Code layout | `CODE_LAYOUT_SELF_TEST=PASS`；非法根、流程命名、Rive 符号链接及空目录反例均 PASS；`CODE_LAYOUT=PASS` | `.runtime/batch3-cp06/validate-only-post-doris-closure.log` |
| Database/query boundaries | `R4_DATABASE_BOUNDARIES=PASS`、`R4_DATABASE_QUERY_BOUNDARIES=PASS`、`R4_DATABASE_OPERATION_BUDGET=PASS` | `.runtime/batch3-cp06/validate-only-post-doris-closure.log`。查询门仍打印 2,331 条既有 `SQL_CONSTRUCTION_UNKNOWN` 诊断，状态为 `OPEN_UNTIL_CAPTURE_OR_REVIEW`；这是门的已知输出，不是本次 PASS 的业务闭合声明。 |
| 全仓 Spotless / UTF-8 行长 | TDS、业务 app、terminal-binding focused 检查 PASS；`apps/backend` UTF-8 行长扫描 0 超限；全仓 `spotlessCheck --continue` 在修复前只有 terminal-binding 一处格式失败 | `.runtime/batch3-cp06/repo-spotless-continue.log`；修复后同一 `scripts/verify --validate-only` 通过完整根 Spotless 聚合门 |
| ArchUnit / PMD / frontend 与 TER static | 同一 validate-only：Gradle ArchUnit、PMD、Spotless 完成；终端格式/模型/真实静态检查结束 `TERMINAL_STATIC=PASS` | `.runtime/batch3-cp06/validate-only-post-doris-closure.log` |
| 完整 validate-only | `scripts/verify --validate-only`：`R5_VERIFY_VALIDATE_ONLY=PASS`、`EXECUTED=46/46`、退出码 0；静态运行 cleanup=`NOT_APPLICABLE_STATIC_ONLY` | `.runtime/batch3-cp06/validate-only-post-doris-closure.log:904-949`。外层静态 verify 未发出专属 run ID；TER 子流程 ID=`ter-local-static-51178-1790901136577`，开始=`2026-10-02T00:32:16.577Z`、结束=`2026-10-02T00:35:46.352Z`。 |

CP-06 仅证明静态门与已列 focused proof；默认 `scripts/verify` 运行段、整批动态验收、跨 CP cleanup、13c、全批 6b 与整批 IMPLEMENTATION review 均不由本记录声称通过。

## 首败、根因与修正

### CP-06 独立对账 S-1 intake：`CONFIRMED`，已由主 agent 修复并经 fresh 复查

reviewer 指出批次三新增的 `V2S_TDS_DORIS_ENDPOINT`、`DATABASE`、`TABLE`、`USERNAME`、`PASSWORD` 没有进入环境键唯一闭集。主 agent 重开需求 R-12、详设 §9a.1、`CLOSED_CROSS_LAYER_SET_TEST_MUST_TRACK_POLICY` 与运行时配置 owning source 后，确认 finding 成立：策略和 Java 类均固定 23 项，TDS 门也只检查旧 `TdsRuntimeProperties`；此前的 green marker 没有覆盖 Doris。

最小修正同步了唯一策略、Java `CROSS_LAYER_KEYS` 与精确集合单测，使三处包含相同的 28 个键。`runtime-environment-keys` 门现在校验 Doris 五键、`TdsDorisProperties` 声明、`TdsSettingsConfiguration` 绑定、`application.yml` 字段映射、`TdsDorisStreamLoadClient` 属性消费，以及 `r5-dev-runner.mjs` 向 TDS 进程传值。自测在 scratch 副本中分别删除 Doris 策略键、Java 常量、配置绑定/字段、YAML 映射、消费者和 runner 注入并要求稳定闭集 marker；门仅验证键名与接线，不读取或打印任何凭据值。

同根范围限定为“跨层运行时键新增时，政策闭集、Java 镜像、TDS 配置绑定/消费和受管启动注入必须一起变化”；不新增通用配置框架，也不把单侧测试变量强行塞入该闭集。复核依据：需求 `R-12` 的冻结计数与闭集条款；详设 §9a.1 明确新增 Doris 键进唯一配置闭集；project memory `operations/test-closed-loop.md` 要求精确集合消费者随权威策略同步；`practices/gate-four-pieces.md` 要求真实红变异、合法写法负控制及反例边界。

本轮 focused 输出（敏感值未输出）：

```text
R5_RUNTIME_ENVIRONMENT_KEYS=PASS
CROSS_LAYER_KEYS=28
JAVA_KEYS=28
R5_RUNTIME_ENVIRONMENT_KEYS_POLICY_RED=PASS
R5_RUNTIME_ENVIRONMENT_KEYS_JAVA_RED=PASS
R5_RUNTIME_ENVIRONMENT_KEYS_TDS_CONFIG_RED=PASS
R5_RUNTIME_ENVIRONMENT_KEYS_SCRIPT_RED=PASS
R5_RUNTIME_ENVIRONMENT_KEYS_SINGLE_SIDED_NEGATIVE=PASS
R5_RUNTIME_ENVIRONMENT_KEYS_SELF_TEST=PASS
BUILD SUCCESSFUL in 3s (:apps:backend:catering-business-server:modules:foundation:test --tests RuntimeEnvironmentKeysTest)
BUILD SUCCESSFUL in 2s (:apps:backend:catering-business-server:modules:foundation:spotlessCheck)
```

`tools/verify-gates/cli.mjs` 首次 Prettier 检查失败，原因是新加入的门/夹具数组格式未对齐；按仓内 Prettier formatter 修复后，完整 validate-only 的 Prettier 门通过。该格式首败与原有 `backend-spotless-check` 首败均保留，未将其改写为从未失败。

第一次最终 `scripts/verify --validate-only` 在 `backend-spotless-check` 失败，输出 `TerminalBindingOwnerPersistence.java` 的字符串连接布局差异。根因是本次先检查了 TDS 和业务 app 的局部 Spotless 范围，漏掉根 `spotlessCheck` 通过 subprojects 聚合的 terminal-binding 模块；局部门 PASS 不足以代表聚合门分母闭合。

修正只按 formatter 给出的两行布局调整 `notifyRevoked` 的 JSON 字符串拼接。修正前后编译类的 `javap -c -p` SHA-256 都是 `4ed2b81d2bdfe995c7ab657e2d49f20679ef214acc9fe6b0b6d067a31b72887a`；`:apps:backend:catering-business-server:modules:terminal-binding:compileJava` 与该模块 `spotlessCheck` PASS。全仓 `spotlessCheck --continue` 诊断的唯一失败即此模块；修复后完整 validate-only 聚合 Spotless PASS。

本次执行经验：复发的失败族必须按失败入口的完整聚合分母诊断；窄模块 focused PASS 只能覆盖该模块。遇到聚合门首败，先以聚合入口诊断全部子项目，再用原聚合门复验归零，避免逐模块试错。

此前 line-limit 与 TDS/业务 app 格式差异也在本 CP 关闭：按项目 UTF-8 120-byte 上限修复所有 15 条超限行；formatter 后重新编译并逐类对比受影响生产/测试 class 的 `javap -c -p`，前后哈希分别一致（业务 app=`a2e15f7e27a472455eb00f2e3323f390f41172a60d8d63bbcd258f65df6c3f31`；TDS=`17a2a1642a2805d03bbe0e58f1ec6ba3531f9ff54bb978ebc361067276ff5456`，详见 `.runtime/batch3-cp06-bytecode/`）。TDS 与业务 app 的 focused `spotlessCheck`、业务 `compileTestJava` 均 PASS。

## 当前 CP 状态与后置项

- fresh 独立三维对账：`PASS` / `CP06_RECONCILIATION=MATCHED`，reviewer=`/root/batch3_cp06_recheck_after_doris_keys`。其逐项证据覆盖需求 R-12/V-G1、详设 §9a.1、运行时配置 owning source、静态门输出与 CP-06 退出范围；未将 validate-only 提升为动态 PASS。该结论适用于本记录下列四个文件指纹及所列证据。
- 当前字节指纹：`contracts/policy/runtime-environment-keys.json`=`1f72a49d1b349f5cea190f19f979927550f3cb91e3db9266dfdb4f6407a8a39e`；`RuntimeEnvironmentKeys.java`=`f49ef4d071c3bd2bec2cfb0fe08910b1bed321c9bffc80b21336970490ad89fd`；`RuntimeEnvironmentKeysTest.java`=`e15f13eae5a0b61b0da3ee78ce99aea262833aba2b5d6a6bca3a9b9a22b4bbd6`；`tools/verify-gates/cli.mjs`=`a77905c59ba1a4d6425a84c2cddd42f840e98fdc069b288d5acff3bcad450257`。
- 当前字节 validate-only 最终 PASS，退出码 0，46/46；默认 `scripts/verify` 的运行段按详设留到全批 6b 后的批次级整体验收，当前为 `NOT_RUN`。
- `S-1` 已确认并由主 agent 修复；fresh reviewer 已验证策略、Java 精确集合、测试、TDS 声明/绑定/YAML/消费者与 runner 注入同步，且 gate red fixtures 会拒绝各遗漏形态。
- `backend-spotless-check` 首败已保留于 `.runtime/batch3-cp06/validate-only.log`；terminal-binding 聚合诊断见 `.runtime/batch3-cp06/repo-spotless-continue.log`。不得将首败删除或表述为从未发生。
- CP-01～CP-06 现均有各自的 fresh 阶段级三维对账记录；下一步是单独做全批 6b。全批 6b 未匹配前，不进入批次级整体验收。
