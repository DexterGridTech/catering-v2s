# TER 更新阶段 C CP-05 阶段对账

```text
DATE=2026-10-11
CP=CP-05
RESULT=MATCHED
REVIEWER_KIND=FRESH_INDEPENDENT_SUBAGENT
REVIEWER=/root/cp05_final_reconcile_1011
SCOPE=场景矩阵与唯一 runner 对应、供给链 sample/shape 路由、两 integration/admin-shell 接线、pair 资源接缝及中文 README；不含整批 6b、动态验收或 13c
```

## 范围与主 agent 处置

CP-05 对账单位是完整 CP，不按单文件拆门。fresh reviewer 对照正式需求、阶段 C 详设/计划、项目约束及当前 owning source，独立结论为 `MATCHED`。同轮两个历史 CP-05 审查对 case 分母有不同解释；后者 `/root/cp05_final_reconcile_1011` 基于当前文档与源码，确认当前方案：验收矩阵行是断言归组，不是独立 CLI case。该判断与 Dexter“两个主要 Journey 跑通、避免增加 runner”的范围一致。

处置后的可执行 CLI case 只有 `update.supply-chain` 与 `update.pair`。供给链只接受已批准组合 Android `console/dual` 和 Android `wallpaper/mobile`；矩阵细项映射到具名 Journey 断言或 owner focused test，未实现的矩阵行 ID 在 CLI 入口 fail closed。runner 通过 `TERMINAL_AUTOMATION_SAMPLE` 把选择传入 supply-chain suite，suite 按 sample 使用匹配的 App、包身份、设备形态及 fixture。

本轮 finding intake 为 `doc/review/platform/2026-10-11-ter-version-update-stage-c-cp05-case-intake-codex.md`。第一处 CLI/断言分母不一致判为 `CONFIRMED`，通过收敛为两条真实入口修正；要求每个验收行各建 CLI case 判为 `REJECTED_WITH_EVIDENCE`，因为那会复制入口且与当前用户范围不符。此前 wallpaper/mobile 无法从唯一 runner 启动判为 `CONFIRMED`，以同一 runner 精确允许两种批准组合修复。解析器先前的 TypeScript `string | undefined` 类型错误已记录并修复为已校验 sample union。

## 当前字节证据

- `tools/terminal-automation/src/runner.ts`：case 登记、参数校验与 `isSupportedSupplyChainRun` 使用同一批准组合；不支持组合在资源分配前拒绝。
- `tools/terminal-automation/test/runner.test.ts`：正例覆盖 console/dual、wallpaper/mobile；反例覆盖 console/mobile、wallpaper/dual、Web，以及七个矩阵标签作为 CLI case 被拒绝。
- `tools/terminal-automation/journeys/update.android.test.ts`：读取显式 sample，贯穿 App/package identity、fixture、artifact 和设备形态。
- `tools/terminal-automation/journeys/update.pair.android.test.ts` 与 Android harness：保留两个不同 Runtime、同 App 投影、peer inactive/stopped、topology forward 的受管身份和 cleanup。
- `apps/terminal/ui/base/admin-shell`：server-config panel 与安装提醒位于现有 admin-shell；两 integration 只做装配。
- 本次只读核对 `apps/terminal` 下排除 `.expo` 与 `node_modules` 后的 45 个 README，45 个均含中文；按包含 `package.json` 的目录口径 38 个，38 个均有 README 且包含中文。该清点不涵盖依赖或 Expo 生成目录。

## 当前字节 focused proof 与边界

```text
yarn workspace @catering-v2s/terminal-automation test test/runner.test.ts
PASS — 1 file, 48 tests

yarn workspace @catering-v2s/terminal-automation typecheck
PASS — exit 0

yarn prettier --check tools/terminal-automation/src/runner.ts tools/terminal-automation/test/runner.test.ts doc/plans/platform/2026-10-09-ter-version-update-stage-c-implementation-design-claude.md doc/plans/platform/2026-10-09-ter-version-update-stage-c-implementation-plan-claude.md doc/review/platform/2026-10-11-ter-version-update-stage-c-cp05-case-intake-codex.md
PASS — all matched files use Prettier code style
```

上面的 runner/type/format 检查只证明当前 CP-05 局部源码。fresh reviewer 未执行命令。阶段 C Expo Web、DEV、Android console/dual、wallpaper/mobile、两组同 App pair、业务与 cleanup 在这些 proof 中均未运行。

受管历史记录中，2026-10-09 的 console/dual `update.supply-chain`（run `83d2878b-a672-4af9-8b6b-3f82cf4cf0c0`）和 wallpaper/dual（run `5a051c3a-c1e4-46d2-8dab-bb87210e4042`）有业务与 cleanup PASS；它们是旧 runner/旧字节证据，且 wallpaper/dual 不等于当前批准的 wallpaper/mobile 组合，故不能替代当前执行面证明。

**CP-05：MATCHED。** 此阶段结论不是全批 6b、动态验收、13c 或最终 `REVIEW_TARGET=IMPLEMENTATION` verdict。

## README 差量复核

随后发现 `scripts/README.md` 的 Stage C runner 说明重复两次。主 agent 删除重复段，只保留 `scripts/README.md:104` 的单段说明；该行仍准确列出两个真实 CLI case、两个获准的供给链 sample/shape、矩阵行是断言而非额外 case，以及本入口不执行 reset/seed。

Fresh 独立 reviewer `/root/cp05_delta_cp06_reconcile_1011` 对 README 差量给出 `CP05_DELTA=MATCHED`。该 reviewer 没有执行命令；README 仅有说明性差量，不影响 runner 或测试字节，既有 runner focused proof 可复用。未因文档去重重跑测试。

## 状态

当前字节上的最新运行：`yarn workspace @catering-v2s/terminal-automation test test/runner.test.ts`；2026-10-11；PASS，1 file / 48 tests。

最后一次通过：同一 run；2026-10-11；PASS；与当前 CP-05 runner/test 字节一致。没有当前字节的 CP-05 动态运行。
