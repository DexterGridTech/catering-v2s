# TER T1 CP-03 实施对账输入

## 范围与状态

- CP：03，API 消费 ownership；另列 CP-02 仅受本轮影响的 activation module 声明差量。
- 状态：CP-03 完整阶段经 fresh 独立三维对账为 `MATCHED`；本记录另跟踪 CP-02 的 activation public-export 差量，差量独立复核仍待完成。
- 判据：T1 正式需求 R-14/R-15，详设 §5、§6、§7、§8.4、§8.5、§11a/V-06～V-08/V-17，以及计划 CP-03。
- 业务语义、owner 和数据持久化未扩展；没有新增产品裁决。

## 已核验的确认问题与最小处置

1. 私有 generated client 的边界过去只由静态导入检查覆盖部分 package-name 路径。真实实现需同时拒绝 foreign owner 的根导出、深路径、相对路径、tsconfig alias、re-export、dynamic import 与 `require`，且不能由 TDC 重新暴露业务 API。已将检查加入既有 `graph-comparison`，没有建立第二个 semantic gate；`tools/terminal-skeleton/check-static.test.mjs` 增加各形态的失败夹具。
2. skeleton graph 中个别 package dependency 与当前 package manifest / 实际模块 import 不一致，导致 clean static baseline 被拒绝。已按当前 owning source 与包 manifest 修齐声明，没有削弱 checker。
3. `ui.base.terminal-activation` 实际拥有 activation route actor，但 module kind 仍登记为 toolkit；其声明的 Runtime 模块依赖也滞后于当前 actor/UI 的实际消费。已登记为 owner、声明实际运行依赖，并将 `moduleKind` 从包根导出，与 terminal-invariants 的 public export 清单一致。原 focused test 仍断言旧的单项依赖；按实际模块声明更新断言，没有改业务行为。

## 当前字节 focused proof

| 范围 | 执行 | 结果 |
|---|---|---|
| skeleton 静态门及 red/restore suite | `node --check tools/terminal-skeleton/check-static.mjs && node tools/terminal-skeleton/check-static.test.mjs` | 退出码 0；末行 `TERMINAL_SKELETON_MODEL_TEST=PASS`。新增 foreign generated-client 和 public-root 泄漏夹具均产生预期拒绝。 |
| terminal-activation | `yarn workspace @catering-v2s/ui-base-terminal-activation typecheck` | 退出码 0。 |
| console integration | `yarn workspace @catering-v2s/ui-integration-sample-console typecheck` | 退出码 0。 |
| wallpaper integration | `yarn workspace @catering-v2s/ui-integration-sample-wallpaper-console typecheck` | 退出码 0。 |
| terminal-activation focused tests | `yarn workspace @catering-v2s/ui-base-terminal-activation test` | 退出码 0；10 tests PASS。第一次运行发现旧依赖断言失败；修正测试预期后同一 focused suite PASS。 |
| package invariant model | `node tools/terminal-shared/package-invariants.test.mjs` | 退出码 0；`TERMINAL_PACKAGE_INVARIANT_MODEL_TEST=PASS`。 |

## Fresh CP-03 review 差量 intake 与修复

主 agent 重开正式需求 R-14/R-15、详设 §5～§8/§11b、CP-03 计划、`TR-10` 与下列 owning source 后，确认 fresh reviewer 提出的四项差量成立，处置如下：

1. **CONFIRMED — TDC README 对 server-config selector 的描述过宽且持久化措辞过时。** `selectTerminalHttpContext.ts` 只通过 `selectServerConfigServiceContext` 读取当前服务的 `selectedSpace`、`serviceRevision`，并未读取 server-config state/storage/address/proxy；凭证 descriptor 明确使用 `protection: 'plain'`。README 已改为准确说明窄 selector 边界、composition→transport 的地址/代理路径，以及明文 owner-only 凭证持久化与获准凭证投影。
2. **CONFIRMED — terminal-update workspace dependency 漏记。** `package.json`/`src/dependencies.ts` 已包含 `kernel.base.terminal-data-client`，README 依赖表未列。README 现分列 workspace 依赖和 Runtime 模块依赖，并说明 update owner 内部 generated client 通过 TDC 公开 command/context selector 执行 CBS 请求。
3. **CONFIRMED — remote-control README 未满足 TR-10 的实际用法说明。** 当前包已拥有 public commands/selectors、内部生成 API、`createOwnerHttpClient`、装配输入与资源释放；原 README 只概述职责和 DEV 地址，缺结构、调用边界和迭代说明。已补中文结构及用法，明确 private generated client→TDC→transport 边界、调用方不绕过 actor、模块资源释放和地址交由 composition/adapter。
4. **CONFIRMED — owner-flow fixture 测试未验证 apply 后的 `readFacts()`。** fixture 的 owner-flow apply 会把当前实际版本更新为准备的 artifact，但原 identity 测试使用默认 fixed 场景，未证明该链。测试现显式选择 `update.owner-flow`，并使用与 embedded artifact 不同的 FULL/HOT publicationId；在每次 apply 与 action readback 后断言 `readFacts().actual.publicationId` 等于本次源 artifact，保留实际 FULL/HOT 身份差异。

更小替代：仅写 review intake 不会消除 README 当前误导，也不能证明 owner-flow 平台事实与 artifact 关联；本修正只触及三份 README、一处已有测试和其 fixture 输入，没有新增 abstraction、账本或运行机制。

| 当前字节 proof | 执行 | 结果 |
|---|---|---|
| terminal-update focused tests | `yarn workspace @catering-v2s/kernel-base-terminal-update test` | 退出码 0；`files=3 tests=59 allowedDevSkips=0`。 |
| terminal-update typecheck | `yarn workspace @catering-v2s/kernel-base-terminal-update typecheck` | 退出码 0。 |
| terminal-update lint | `yarn workspace @catering-v2s/kernel-base-terminal-update lint` | 首次发现新增 fixture helper 的未使用泛型；删除无用泛型后重跑，退出码 0，`errors=0 warnings=0`。 |

README 与源码按当前 TDC selector/持久化 descriptor、terminal-update package/runtime dependencies、remote-control 根导出/private generated API 和 owner module resource registrations逐项对读。四项均为工程修正，不涉及产品裁决。

## CP-03 与 CP-02 差量的独立对账结果

Fresh reviewer 对完整 CP-03 当前字节给出 `CP-03=MATCHED`。同次复核指出 CP-02 terminal-activation package invariant 把包内 `createTerminalActivationParts` 标成 public，但根 barrel 无该导出。主 agent 回读 R-13/R-15、详设 §5/§11a 与所有当前调用者后确认该符号只由 package 内的 `createTerminalActivationModule` 和同包测试使用，因此这是 publicExports 声明过宽；已从 invariant 移除，没有增加不必要的根导出。

随后对 CP-02 export 差量的 fresh reviewer 确认 `src/index.ts` 真实导出 `createCredentialSecret`，并由两个 integration assembly 消费，但 invariant 起初漏列。主 agent 重开 R-13/R-15、CP-02计划与 §11a/V-18、terminal-activation 根 barrel、两个 integration assembly、package invariant checker 和直接测试后确认该遗漏成立；已在 `apps/terminal/ui/base/terminal-activation/terminal-invariants.json` 登记该真实根导出。`createTerminalActivationParts` 仍保持包内私有。没有扩大 public API 或另建声明表。

受影响差量 proof：`yarn workspace @catering-v2s/ui-base-terminal-activation test` 最新退出码 0（3 files/11 tests）；`typecheck` 退出码 0；`lint` 退出码 0，errors=0/warnings=0；`node tools/terminal-shared/package-invariants.test.mjs` 退出码 0，`TERMINAL_PACKAGE_INVARIANT_MODEL_TEST=PASS`。包 invariant 模型门只校验清单形状，不比较当前根 barrel；因此沿用 admin-shell 已有 `publicSurface` 测试形态，在本包 `activationPackage.test.ts` 加入 TypeScript module export 与 `publicExports` 精确相等断言，防止同根漂移重发。此前 fresh reviewer 对仅有清单修正的字节给出差量 `MATCHED`；加入回归断言后的 CP-02 差量需要 fresh reviewer 再确认，目前复核待完成。此前 CP-02 全阶段 `MATCHED` 只在未变范围继续有效。

此前 CP-03 owner/client focused proof（当前源码未被之后修改影响，结果按原范围引用）：TDC 62/62、terminal-update 59/59、automation-agent 74/74、store-basic 21/21、project-basic 13/13、remote-control 34/34；terminal client generator `--write`/`--check` 与 `scripts/test/terminal-client-generation.test.mjs` PASS。它们不等同于 Web、DEV 或整批动态验收。

## 当前未执行范围

- CP-03 fresh 独立三维对账：`MATCHED`。
- CP-02 terminal-activation public-export 差量：`MATCHED`。Fresh reviewer `/root/t1_cp02_delta_r1` 核对当前根 barrel 的12项导出、`terminal-invariants.json` 与新增 TypeScript exact-surface regression test，并确认两个 integration 仅使用包根 API、无生产 deep import。reviewer 未运行测试；当前执行结果仅引用上文主 agent focused proof。该结论关闭此回归测试加入后的精确导出差量，不替代 CP-02 原完整阶段 MATCHED 的既有范围。
- 整批 6b、全批业务动态验收及后续 CP：尚未进入。
- `update.owner-flow` 业务动态场景：按 CP-03/CP-05/CP-06 接缝留待计划阶段执行；本记录不将 fixture 或单测写成真实 CBS 业务闭环。
- 未受影响的历史 CP-01/CP-02 MATCHED 继续保留原范围；terminal-activation module owner/dependency 已在原 CP-03 receipt 记录，本轮仅补 publicExports 差量复核。
