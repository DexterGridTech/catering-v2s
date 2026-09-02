# TER `kernel.base.display-context` IMPLEMENTATION review request

## 背景

Dexter 已授权按已 GO 的详设与实施计划完成 `DC-P0`～`DC-P5`。本批只覆盖
`kernel.base.display-context`、为 `DevicePort.getDisplayInfo` 所需的 platform-ports 端口/invariant 变更、
TER-local static/verify、README/HANDOFF 与实施证据；不包含下一个 owner 包、单元 B、workspace scoping、
native/Gradle/设备、DEV、seed、reset、browser L2、UAT、部署或仓级 normal verify。

请以 `REVIEW_TARGET=IMPLEMENTATION` 重新打开当前源码与新鲜证据，独立判断实现是否真正解决目标，
不要把“按已批设计实现”当作豁免。重点检查是否仍存在“所有门与测试通过但用户真实场景仍坏”的路径。

## 输入材料

- 需求：`doc/plans/platform/2026-09-01-v2s-terminal-kernel-base-display-context-requirements-claude.md`
  - SHA-256：`e29965294f465d139e920ac8aefad524e50a9716bd25a03838c81cf84e989684`
- 详设：`doc/plans/platform/2026-09-02-v2s-terminal-kernel-base-display-context-implementation-design-codex.md`
- 实施计划：`doc/plans/platform/2026-09-02-v2s-terminal-kernel-base-display-context-implementation-plan-codex.md`
- 实施证据：`doc/evidence/platform/2026-09-02-v2s-terminal-kernel-base-display-context-implementation-evidence-codex.md`
- 当前源码：`apps/terminal/kernel/base/display-context/`、`apps/terminal/kernel/base/platform-ports/`、
  `apps/terminal/kernel/base/runtime/`、`apps/terminal/skeleton-graph.ts`
- 门与接线：`tools/terminal-display-context/`、`tools/terminal-skeleton/verify-static.mjs`、
  `tools/terminal-skeleton/verify.test.mjs`、四个 TER package `terminal-invariants.json`
- 规范与记忆：`doc/platform/terminal-coding-standard.md`（TR-01/TR-02/TR-04/TR-09/TR-10/TR-11）、
  `project-memory/decisions/terminal-architecture-and-stack-rulings.md` 及当前路由命中的项目记忆。

## 已实施内容

1. `DC-P0`：runtime 角色写入提交后派发 runtime-owned `runtimeInstanceModeChanged` command；display-context
   作为第二 actor consumer；child command 使用 5 秒 timeout；`registerResource` 接入 runtime resource registry。
2. `DC-P1`：新增 `DisplayInfo.displayCount` 与 `DevicePort.getDisplayInfo(DeviceCall)`，同步默认端口、root export
   与 platform invariant；platform-ports 公开面 125、DevicePort 方法 6。
3. `DC-P2/P3`：displayRole owner slice、4 commands、5 actors、派生函数、selector、hydrate/startup 校验、
   运行期 VICE 前置、持久化和 post-commit role actor；display-context 公开面 17。
4. `DC-P4`：电源首事件播种、同值去重、串行 dispatch tail、订阅/取消订阅 success/non-succeeded/reject
   受控诊断、resource release 幂等；`onApplicationReset` 不定义，生产 stop/dispose 欠账已登记。
5. `DC-P5`：4 道 display static rule + support、TER-local verifier 接线、中文 README 与 HANDOFF。

## 新鲜验证输出

### Package focused proof

```text
kernel-base-runtime: 13 test files / 78 tests PASS
kernel-base-platform-ports: 4 test files / 16 tests PASS
kernel-base-display-context: 4 test files / 55 tests PASS
TERMINAL_PACKAGE_TEST=PASS kind=REAL_TESTS（以上三个包）
```

### Display static model/red vectors

```text
DISPLAY_CONTEXT_RED_PUBLIC=display-context-public-surface:FAIL,display-context-owner-kind:PASS,display-context-restart-positive:PASS,display-context-no-display-index-in-slice:PASS;support=PASS
DISPLAY_CONTEXT_RED_OWNER_KIND=display-context-public-surface:PASS,display-context-owner-kind:FAIL,display-context-restart-positive:PASS,display-context-no-display-index-in-slice:PASS;support=PASS
DISPLAY_CONTEXT_RED_RESTART=display-context-public-surface:PASS,display-context-owner-kind:PASS,display-context-restart-positive:FAIL,display-context-no-display-index-in-slice:PASS;support=PASS
DISPLAY_CONTEXT_RED_SLICE_SHAPE=display-context-public-surface:PASS,display-context-owner-kind:PASS,display-context-restart-positive:PASS,display-context-no-display-index-in-slice:FAIL;support=PASS
DISPLAY_CONTEXT_MODEL_CLEANUP=PASS
TERMINAL_DISPLAY_CONTEXT_STATIC_MODEL_TEST=PASS
DISPLAY_CONTEXT_RULE_GATES=4
DISPLAY_CONTEXT_SUPPORT_CHECKS=1
DISPLAY_CONTEXT_SUPPORT=PASS
TERMINAL_DISPLAY_CONTEXT_STATIC=PASS
```

### TER-local verifier

命令：`yarn workspace @catering-v2s/terminal verify:static` 与
`yarn workspace @catering-v2s/terminal verify`，均退出码 0。

```text
TERMINAL_STATIC=PASS
TERMINAL_TURBO_DRY_TYPECHECK=PASS packages=22 tasks=22 executable=22
TERMINAL_TURBO_DRY_TEST=PASS packages=22 tasks=22 executable=10
TERMINAL_TEST_MARKERS=PASS real=5 noTests=5
Android Bundled 3504ms apps/terminal/assembly/android/pos-desktop/index.ts (730 modules)
TERMINAL_VERIFY_CLEANUP=PASS
TERMINAL_VERIFY=PASS
```

Expo export 只证明 Metro/JS 打包与入口消费闭包，不证明 native、Gradle、autolinking、真实设备或 adapter
能力；本轮没有运行仓级 `scripts/verify`。

## Independent reconciliation status

- P0 fresh：GO，M/S/N=0/0/0，静态只读。
- P1 fresh：GO，M/S/N=0/0/0，静态只读。
- P2 fresh：GO，M/S/N=0/0/0，静态只读。
- P3 修复后 fresh：GO，M/S/N=0/0/0，静态只读。
- P4 修复后 fresh：GO，M/S/N=0/0/0；核对 subscribe/unsubscribe 五种失败分支及诊断保真，未运行命令。
- 全部 CP 完成后的 fresh 全范围三维对账：GO，M/S/N=0/0/0。

## 请重点独立核验

1. `runtimeInstanceModeChanged` 是否确实 post-commit、child timeout 不回滚父 role，且 display actor 为第二消费者。
2. `DevicePort.getDisplayInfo` 的 125/6 公开面与端口形状是否精确同步，count-only 语义是否按需求执行。
3. 所有写入 `VICE` 的路径是否实时读取并 fail-closed；CHIEF 恢复是否不依赖屏数；hydrate 是否在 started/UI 可渲染前完成。
4. 电源 bridge 是否首事件只 seed、同值去重、跃迁串行、subscription reject 不阻断 install，unsubscribe 的
   failed/timed-out/unavailable/reject 是否保留对应诊断字段；是否仍有“空实现却返回成功”的路径。
5. 55 条 focused tests 是否真实观察 actor、最终 slice、端口调用和诊断，而不是只观察 fixture 局部变量。
6. 四道 machine gate 的每个 red vector 是否目标独红且其余 PASS；TER-local verifier 是否消费 display marker、
   test owners 是否 REAL=5/NO_TEST=5。
7. README/HANDOFF 是否登记 `onApplicationReset` 不存在、生产无 stop/dispose、batch-1 默认端口和未证明边界。
8. 独立构造新的“全部判据绿但 display role、电源顺序、重启或资源释放仍错误”的反例。

## 结论格式

请返回：

```text
REVIEW_TARGET=IMPLEMENTATION
VERDICT=GO 或 NO-GO
M=<major> S=<significant> N=<note>
```

每条 finding 必须给出精确路径/行号、仓内事实或推论、可证伪失败条件、最小修复，以及
`CONFIRMED / PARTIALLY_CONFIRMED / REJECTED_WITH_EVIDENCE / UNVERIFIED_REQUIRES_EVIDENCE / DEXTER_DECISION`。
请把 dynamic/native/Gradle/device/browser L2/DEV/seed/reset/UAT/deploy 明确标为
`UNVERIFIED_REQUIRES_EVIDENCE`，不要将 TER-local 或 Expo export 升级为这些证明。

## 授权边界

本 brief 只请求 IMPLEMENTATION review，不授权修改源码、继续单元 B、开始下一个 owner 包、运行仓级 normal
verify、native/Gradle/设备、DEV、seed、reset、browser L2、UAT、部署或数据操作。任何产品/Journey 范围
决策仍交 Dexter；发现实现与需求/详设不符时请指出，不要自行扩大范围。
