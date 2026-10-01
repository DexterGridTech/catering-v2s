# 终端激活与长连接 · 批次二 CP-06 focused proof

日期：2026-10-01。作者：Codex 主 agent。当前 `CP06_RECONCILIATION=MATCHED`，fresh 独立只读 reviewer 为 `/root/cp06_current_bytes_recheck`。本记录和阶段 verdict 只覆盖 CP-06，不代表整批 6b、整批动态验收或最终 implementation review。

## CP-06 范围与阶段边界

CP-06 完成 V 判据到场景/执行入口映射、DEV acceptance 场景与 runner 的实现，以及本 CP focused proof。完整 CP-06 对账完成后，另做整批 6b；6b MATCHED 后才进入整体动态验收。动态业务结果、临时资源 cleanup、13c、最终 `REVIEW_TARGET=IMPLEMENTATION` 和 Claude handoff 属于 CP-06 退出后的批次级验收与交付收口。

本 CP 仍有真实远端 DEV、WebSocket、backend-acceptance 和 cleanup 证据待整体动态阶段产生。下文 local PASS 不提升为受管业务 PASS。

## 本地 focused proof

| 入口 | 结果 | 范围与边界 |
|---|---|---|
| `node --check scripts/test/terminal-client-dev-acceptance.mjs` | PASS，exit 0 | runner 语法；不启动远端或测试场景 |
| `node --check scripts/test/terminal-client-dev-acceptance.test.mjs` | PASS，exit 0 | runner 测试文件语法 |
| `node --test scripts/test/terminal-client-dev-acceptance.test.mjs` | PASS，11/11，0 failed，约 59 ms | catalog 唯一映射、零匹配/重复/错文件变红、cleanup 读取回归等本地测试 |
| `node scripts/test/terminal-client-dev-acceptance.mjs --self-test` | PASS；`CATALOG=5`、`VITEST_SELECTION=PASS`、`ZERO_MATCH_RED=PASS`；Node `v24.13.0`、Vitest `4.1.10`、Undici `8.11.2` | 真实调用锁定解析的 Vitest `list --json=<OS temp path>`，验证 5 个 scenario 的唯一 test/fullName/file 选择；另证零匹配返回红；不启动 DEV 或 acceptance test |
| `yarn workspace @catering-v2s/kernel-base-terminal-data-client typecheck` | PASS，exit 0 | TDC TypeScript 类型检查；不执行 DEV 场景 |
| `scripts/verify --validate-only` | PASS；49/49；run `ter-local-static-66911-1790810769241`；log SHA-256 `38f2523dfa7c6b3b7d49c7029179d01deb3b3bdb6dd156f9f5a6482e6f00c4a4` | CP-06 静态入口门；不启动默认远端 Testcontainers suites；最终 `CLEANUP=NOT_APPLICABLE_STATIC_ONLY` |

上述命令输出由本会话命令结果记录；本 CP 目录未留各命令的独立 stdout 文件，因此不伪称有 transcript hash。reviewer 独立核验了当前源码、这些 focused 结果边界及场景分母，但没有重跑命令。

### 场景与清理闭环

- 锁定 Vitest 4.1.10 的 `list` 结果逐一匹配 catalog 中五个场景的唯一 `fullName` 与测试文件；零匹配通过实际 CLI 的非零结果证伪。重复匹配、错误文件由 `assertVitestListResult` focused tests 证伪。
- JSON 清单路径通过单个 `--json=<绝对临时路径>` 参数写入新建 OS 临时目录，最后删除临时目录；不把输出路径放在 scenario 文件位置，避免 CLI 可选参数误消费 positional file。
- `cancelByOperations` 通过真实业务 owner HTTP 取消后，再经公开 HTTP 详情读取同一 `terminalRef`，断言 binding 已为 `INACTIVE`。readback 失败或未变为 inactive 会进入允许的 cleanup failure 标记；仅全部 fixture/node/client cleanup 无失败时才报告场景 fixture cleanup PASS。
- current acceptance 分母由 `acceptance.vitest.config.ts` 的 `acceptance/**/*.test.ts` 得出，共 5 个 `it(...)`，catalog 五项均一一覆盖。目录与文件闭包见 fresh CP-06 reviewer 报告。

## 误用、恢复和防复发

诊断期间曾调用 `vitest list ... --json acceptance/multiInstanceIsolation.test.ts`。Vitest 将 `--json` 后的文件名解释为 JSON 输出文件，覆盖了该 acceptance 源文件。立即停止后续执行，从本地 Codex 会话文件变更历史恢复原始源内容，再应用本 CP 所需 cleanup readback 修复；当前文件不是仅靠生成物或历史运行结果宣称恢复。当前 focused suite 与实际 `vitest list` proof 已在修复字节上通过，fresh CP-06 reviewer 重新读取了当前文件。

根因是 `--json` 接受可选路径，且 CLI 把紧随其后的 positional 文件参数消费为输出路径。修复后的 runner 始终把 JSON 路径与选项写成一个 `--json=<absolute path>` argv 项，输出仅进入唯一 OS temp directory，并在 `finally` 删除；`--json` 选项置于被测文件 positional 参数之前。该路径由 runner self-test 实际执行覆盖，避免未来维护者重现源文件覆盖。

## Fresh 三维对账

历史 reviewer `/root/cp06_recheck` 曾给出 `MATCHED`，但随后另一位 reviewer 按当时计划中 CP-06 必须执行 default `scripts/verify` 与全量 `terminal-verify` 的文字指出入口/阶段矛盾，并给出 `OPEN`。主 agent 重开 owning source 后确认：default verify 会启动受管远端 Testcontainers suites，full `terminal-verify` 会执行 TER package suites；两者在 CP/6b 之前运行违反既定动态顺序。详设与计划已同步改为 CP-06 只运行 `scripts/verify --validate-only` 与 CP focused proofs，default verify 和 full terminal verify 移至全批 6b 之后。旧 verdict 不再作为当前 CP-06 收口依据，须由 fresh reviewer 按修订后的边界复核。

`scripts/verify --validate-only` 的当前静态入口证明为 `PASS`、`EXECUTED=49/49`，run `ter-local-static-66911-1790810769241`，transcript 位于 `.runtime/review/terminal-activation-batch-2-cp06/scripts-verify-validate-only-r6.log`。该模式的 `CLEANUP=NOT_APPLICABLE_STATIC_ONLY`；它不证明受管业务或运行时 cleanup。

CP-06 当前源摘要文件 `.runtime/review/terminal-activation-batch-2-cp06/current-source-sha256-r2.txt` 覆盖 27 个规格、源码和入口文件；`shasum -a 256 -c` 当前为 27/27 `OK`，manifest SHA-256 `a74e9258e0dcc9e54874d893fd80fde6644fca9aab995417524b13cb6be6e00b`。对 CP-06 的新 fresh 独立 reviewer 尚待完成前，不将历史 `MATCHED` 作为当前字节 verdict。

Fresh reviewer `/root/cp06_current_bytes_recheck` 按当前需求、详设/计划、项目规范、脚本 owning source 与 focused proof 独立重开 CP-06，返回 `CP06_RECONCILIATION=MATCHED`、`M/S/N=0/0/0`。Reviewer 确认当前 CP-06 出口为场景/runner 接线、focused proof、`scripts/verify --validate-only` 静态入口和本 CP 对账；default `scripts/verify`、full `terminal-verify`、整批动态验收、cleanup、13c 与最终 implementation review 均明确留在 CP-06 退出之后。当前静态入口 transcript 为 49/49 PASS；27 项当前源摘要为 27/27 OK。Reviewer 未运行构建、测试或受管环境。

## 当前字节摘要

CP-04 阶段收口后，详设和计划只改了 CP-04 的异步关停日志判据。CP-06 对应章节与实现未改；以下共享文档摘要刷新到当前字节，整批 6b 会对全批当前字节独立复核。

| 文件 | SHA-256 |
|---|---|
| `apps/terminal/kernel/base/terminal-data-client/acceptance/devScenarios.test.ts` | `77b434a9b152ec2cec132397f27b41cd67ab09c2e4e9cd9e1381366a1ff3b589` |
| `scripts/test/terminal-client-dev-acceptance.mjs` | `7a5ecd9a085ab339ea81886fdb731c1bac91511ea59fda7ac941ebabc4fac49c` |
| `scripts/test/terminal-client-dev-acceptance.test.mjs` | `09482101be32056fdf1e596aa5ecaf7dc055ef45445920e6774e7f2c0151317f` |
| `doc/plans/platform/2026-09-30-v2s-terminal-activation-batch-2-implementation-design-codex.md` | `499e1be6d80357ff4bea94cd56263e5a77d3231af1c388e1fd77ec25f19f57ec` |
| `doc/plans/platform/2026-09-30-v2s-terminal-activation-batch-2-implementation-plan-codex.md` | `635f4c3c076ed8d3acfd9a801ed40246efd5638dbc4bc16df85a4857e4ea5f61` |

## 动态状态

当前字节上的最新运行：无受管运行；整体动态验收尚未启动。

最后一次通过：`scripts/verify --validate-only`，run `ter-local-static-66911-1790810769241`，2026-10-01 08:29:37 KST，当前源码字节；静态模式 cleanup 不适用。default `scripts/verify`、full `terminal-verify`、远端 DEV、V-E1/E2/E5/E6、V-S15、backend-acceptance、Expo Web、reset、DEV start、seed 仍为 `NOT_RUN`，不得推定通过。
