# CP-01 finding intake 与证据记录

日期：2026-10-03（KST）  
范围：终端激活交互与双机拓扑优化专项，CP-01「package defaults 与 owner/sync 闭包」  
当前状态：fresh CP-01 阶段级三维对账 `MATCHED`，0 finding。implementation plan 仅更新 CP-01 状态行以记录 verdict；动态的 Expo Web、VM、DEV、adapter 与 V-01～V-20 仍未验证。

## Findings intake

| 项 | 分类 | 重开后的判断 | 最小修正与当前状态 |
| --- | --- | --- | --- |
| C1 · 四入口 `serverSpaces` 的默认与覆盖验证 | `CONFIRMED` | R-07 要求两个 integration 分别使用各自 package defaults；两个 Android application 显式传入各自 package defaults；不合并。原 CP-01 缺少 composition 层 default 与显式 fixture 的可观察证明。 | 两个 integration 的真实 assembly tests 均新增：省略参数时检查默认选中空间及空间全集；传入不同、唯一 fixture 时检查运行态只选择该 fixture 且 selector 只呈现该集合。两个 Android `platformPorts.ts` 当前直接把本包 `package.json.serverSpaces` 传给各自 integration，并各自 typecheck。为避免只给 app wrapper 增建测试框架，Android application 的最终运行期 defaults 另由计划 V-07 的受管 VM 场景实测；CP-01 不把 typecheck 冒充运行证据。owner 现有 focused tests 覆盖非法 defaults 拒绝及合法 hydration override 保留。 |
| C2 · README 对 defaults owner 与不合并规则说明不足 | `CONFIRMED` | 四入口 README 说明了 surfaces，却未解释 serverSpaces 的来源、注入与不合并边界；server-config README 的迭代指引还引用批次二旧位置。 | 更新两份 integration、两份 Android application 及 server-config README，明确每入口 package defaults、组合注入及 branch defaults 只作 topology projection。详见下列路径。 |
| C3 · 受影响证明缺少可复查原始输出与当前字节绑定 | `CONFIRMED` | 之前的汇总数字无法独立复读，不能单凭历史摘要关闭 CP。 | 对受影响测试和必要静态门生成当前 run 的原始日志，保存在 `apps/terminal/.runtime/activation-pair-cp01/`；本文件逐项摘录真实输出并绑定源码、文档、测试和日志 SHA-256。六维路由原始 JSON 也保存在同目录。 |
| fresh CP-01 R2 · invalid hydrated configuration 缺 focused proof | `CONFIRMED` | `R-07`要求合法已保存配置可恢复；CP-01步骤1要求证明合法 hydration override 不被 defaults 覆盖。owning actor 还显式清理无效 selectedSpace、service override 与代理秘密形状，但此前没有证明该路径的 owner test。 | 新增 `serverConfig.test.ts` hydration 反例：非法空间回默认、未知服务与无效代理口令条目被丢弃、合法 business override 保留，且日志断言 `selectedSpaceReset=true`、`droppedOverrideCount=2`。以真实 JSON 字节运行 server-config owner suite 7/7、lint 与 typecheck PASS。finding 已修正，fresh CP 阶段对账仍待完成。 |

### 修正路径

- Composition tests：
  - `apps/terminal/ui/integration/sample-console/test/sampleAssembly.test.tsx`（default 与显式 fixture）
  - `apps/terminal/ui/integration/sample-wallpaper-console/test/sample2Assembly.test.tsx`（default 与显式 fixture）
- Defaults 注入链：
  - `apps/terminal/ui/integration/sample-console/src/assembly/assembly.tsx:108-112`
  - `apps/terminal/ui/integration/sample-wallpaper-console/src/assembly/assembly.tsx:98-101`
  - `apps/terminal/application/android/sample-terminal/src/assembly/platformPorts.ts:10-18`
  - `apps/terminal/application/android/sample-wallpaper-terminal/src/assembly/platformPorts.ts:13-25`
- 文档：
  - `apps/terminal/ui/integration/sample-console/README.md`
  - `apps/terminal/ui/integration/sample-wallpaper-console/README.md`
  - `apps/terminal/application/android/sample-terminal/README.md`
  - `apps/terminal/application/android/sample-wallpaper-terminal/README.md`
  - `apps/terminal/kernel/base/server-config/README.md`
- 阶段判据：`doc/plans/platform/2026-10-02-ter-terminal-activation-interaction-pair-topology-implementation-plan-codex.md` CP-01 步骤 1 与退出条件已区分 owner/composition focused proof、Android wrapper typecheck 与后续 V-07 application VM 运行期 proof。

## 实际 focused proof

本地 focused invocation group：历史 `CP01-FOCUSED-20261002T1708Z`，另有当前修复影响运行 `CP01-HYDRATION-20261003T0220+0900`。这是本地测试运行记录，不是 DEV/VM 受管 manifest。每项输出均另存于 `apps/terminal/.runtime/activation-pair-cp01/`；本地测试无 external process tree 或业务 cleanup。

| 执行面 | 命令 | 结果 | 原始输出文件 |
| --- | --- | --- | --- |
| server-config owner（历史 CP01 run） | `yarn --cwd apps/terminal/kernel/base/server-config test` | 6/6 PASS | `.runtime/activation-pair-cp01/server-config-test.log` |
| server-config owner（R2 finding 修复后，2026-10-03 02:20 KST） | `node ../../../../../tools/terminal-shared/run-owned-tests.mjs` | 7/7 PASS | `.runtime/activation-pair-cp01/server-config-hydration-test-r5.log` |
| server-config lint/typecheck（R2 finding 修复后，2026-10-03 02:20–02:21 KST） | `node ../../../../../tools/terminal-shared/run-owned-lint.mjs`; `node ../../../../../node_modules/typescript/bin/tsc --project tsconfig.json --noEmit` | lint PASS，16/16 inputs、0 errors/warnings；typecheck exit 0 | `.runtime/activation-pair-cp01/server-config-lint-after-hydration-r2.log`; `.runtime/activation-pair-cp01/server-config-typecheck-after-hydration.log` |
| topology projection | `yarn --cwd apps/terminal/kernel/base/topology test` | 40/40 PASS | `.runtime/activation-pair-cp01/topology-test.log` |
| topology typecheck/lint | `typecheck`; `lint` | PASS，17/17 lint inputs，0 errors，0 warnings | `.runtime/activation-pair-cp01/topology-typecheck.log`; `.runtime/activation-pair-cp01/topology-lint.log` |
| sample-console composition | `yarn --cwd apps/terminal/ui/integration/sample-console test` | 58/58 PASS；8 files | `.runtime/activation-pair-cp01/sample-console-test-rerun.log` |
| sample-wallpaper-console composition | `yarn --cwd apps/terminal/ui/integration/sample-wallpaper-console test` | 27/27 PASS；4 files | `.runtime/activation-pair-cp01/sample-wallpaper-console-test-final.log` |
| 两个 integration typecheck | 两包各自 `typecheck` | PASS，退出码 0，stdout/stderr 空 | `.runtime/activation-pair-cp01/sample-console-typecheck-rerun.log`; `.runtime/activation-pair-cp01/sample-wallpaper-console-typecheck-rerun.log` |
| 两个 Android application wrapper | 两包各自 `typecheck` | PASS，退出码 0，stdout/stderr 空 | `.runtime/activation-pair-cp01/sample-terminal-typecheck.log`; `.runtime/activation-pair-cp01/sample-wallpaper-terminal-typecheck.log` |
| terminal skeleton 门 | `node tools/terminal-skeleton/check-static.mjs` | 8 rule gates + 1 support check PASS；hygiene PASS | `.runtime/activation-pair-cp01/skeleton-static.log` |
| 两个新增 test source 格式 | `node_modules/.bin/prettier --check <两个测试文件>` | PASS | 执行输出见本报告所绑定的当前执行回合 |

关键原始输出：

```text
TERMINAL_PACKAGE_TEST_MODE_START package=@catering-v2s/kernel-base-server-config mode=PROD
JSON report written to /var/folders/1v/twwzy2r94y76bp582x48cy0c0000gn/T/ter-vitest--catering-v2s-kernel-base-server-config-sRu402/results.json
VITEST_RUN_END reason=passed unhandled=0
TERMINAL_PACKAGE_TEST_MODE=PASS package=@catering-v2s/kernel-base-server-config mode=PROD files=2 tests=7 allowedDevSkips=0
TERMINAL_PACKAGE_TEST=PASS kind=REAL_TESTS package=@catering-v2s/kernel-base-server-config
```

```text
TERMINAL_PACKAGE_LINT=PASS {"packageName":"@catering-v2s/kernel-base-server-config","packagePath":"apps/terminal/kernel/base/server-config","expectedFiles":16,"actualFiles":16,"errors":0,"warnings":0,"elapsedMs":1198}
```

```text
TERMINAL_PACKAGE_TEST_MODE_START package=@catering-v2s/kernel-base-server-config mode=PROD
JSON report written to /var/folders/1v/twwzy2r94y76bp582x48cy0c0000gn/T/ter-vitest--catering-v2s-kernel-base-server-config-9Yo6Yp/results.json
VITEST_RUN_END reason=passed unhandled=0
TERMINAL_PACKAGE_TEST_MODE=PASS package=@catering-v2s/kernel-base-server-config mode=PROD files=2 tests=6 allowedDevSkips=0
TERMINAL_PACKAGE_TEST=PASS kind=REAL_TESTS package=@catering-v2s/kernel-base-server-config
```

```text
TERMINAL_PACKAGE_TEST_MODE_START package=@catering-v2s/kernel-base-topology mode=PROD
JSON report written to /var/folders/1v/twwzy2r94y76bp582x48cy0c0000gn/T/ter-vitest--catering-v2s-kernel-base-topology-1iAKWT/results.json
VITEST_RUN_END reason=passed unhandled=0
TERMINAL_PACKAGE_TEST_MODE=PASS package=@catering-v2s/kernel-base-topology mode=PROD files=1 tests=40 allowedDevSkips=0
TERMINAL_PACKAGE_TEST=PASS kind=REAL_TESTS package=@catering-v2s/kernel-base-topology
```

```text
TERMINAL_PACKAGE_TEST_MODE_START package=@catering-v2s/ui-integration-sample-console mode=PROD
JSON report written to /var/folders/1v/twwzy2r94y76bp582x48cy0c0000gn/T/ter-vitest--catering-v2s-ui-integration-sample-console-2HGN47/results.json
VITEST_RUN_END reason=passed unhandled=0
TERMINAL_PACKAGE_TEST_MODE=PASS package=@catering-v2s/ui-integration-sample-console mode=PROD files=8 tests=58 allowedDevSkips=0
TERMINAL_PACKAGE_TEST=PASS kind=REAL_TESTS package=@catering-v2s/ui-integration-sample-console
```

```text
TERMINAL_PACKAGE_TEST_MODE_START package=@catering-v2s/ui-integration-sample-wallpaper-console mode=PROD
JSON report written to /var/folders/1v/twwzy2r94y76bp582x48cy0c0000gn/T/ter-vitest--catering-v2s-ui-integration-sample-wallpaper-console-oYtqp9/results.json
VITEST_RUN_END reason=passed unhandled=0
TERMINAL_PACKAGE_TEST_MODE=PASS package=@catering-v2s/ui-integration-sample-wallpaper-console mode=PROD files=4 tests=27 allowedDevSkips=0
TERMINAL_PACKAGE_TEST=PASS kind=REAL_TESTS package=@catering-v2s/ui-integration-sample-wallpaper-console
```

```text
RULE_GATES=8
SUPPORT_CHECKS=1
RULE_GRAPH_COMPARISON=PASS
RULE_TRIPLE_NAMING=PASS
RULE_DEPENDENCY_DIRECTION=PASS
RULE_DEPENDENCY_DECLARATION_COMPLETENESS=PASS
RULE_RUNTIME_DEPENDENCY_CONTRACT=PASS
RULE_TR01_REDUCER_BOUNDARY=PASS
RULE_STATE_RESET_RETENTION_ONLY=PASS
RULE_KERNEL_PLATFORM_INDEPENDENCE=PASS
SCAFFOLD_HYGIENE=PASS
```

## First failures retained

- 首次新增测试 typecheck 曾报 `TS2532` 与 `TS2339`：直接取索引 state slice 的可选 object 属性不满足 TypeScript 类型。修正为 assertion library 的结构匹配；同一测试目录后续 typecheck 退出码 0，两个 composition suites 后续分别 58/58、27/27 PASS。首败原输出保留在 `.runtime/activation-pair-cp01/sample-console-typecheck.log`。
- 首次 Prettier check 指出 `sample2Assembly.test.tsx` 排版不符；使用项目已安装 Prettier 格式化该单文件，随后两新增测试文件 Prettier check PASS，wallpaper composition suite 27/27 PASS。
- R2 hydration proof 的第一次 owner test 未通过：夹具使用了 `json:` 前缀，但 `apps/terminal/kernel/base/state/src/foundations/persistenceCodec.ts:119-149` 当前编码/解码是原始 JSON 字符串；该夹具字节被 decoder 拒绝，不能据此判断 server-config owner 行为。按当前 codec 修正夹具后，同一 focused proof 通过；保留失败日志 `.runtime/activation-pair-cp01/server-config-hydration-test-final.log`（首次运行）；中间失败留在 `server-config-hydration-test-r2.log`、`-r3.log`、`-r4.log`。另一次 `pnpm` 调用由项目 Yarn 配置拒绝，未启动测试，输出保留于 `.runtime/activation-pair-cp01/server-config-hydration-test.log`。

不得将这些 focused 结果升级为 Expo Web、Android/VM、DEV、adapter、V-01～V-20 或最终整体验收 PASS。

## 当前字节绑定

源与测试 SHA-256：

```text
doc/plans/platform/2026-10-02-ter-terminal-activation-interaction-pair-topology-implementation-plan-codex.md  84adcb1f259c640bf80601d3e5b66f4f3f724730c6cbe0a071f66ab7ba9d90dd
apps/terminal/kernel/base/server-config/test/serverConfig.test.ts  0e67fc1ff6eea8b0f80772dfe3da4eda6acaf97617ca7955623aa30527968f10
apps/terminal/kernel/base/server-config/src/application/createServerConfigModule.ts  94f76635c8754b41660df57bbe15b76134775f6b01c363027773f8af54b2b061
apps/terminal/kernel/base/topology/test/topology.test.ts  2ad84d3619993bf5bd96054fd99f9d8ec4f99fd57e456ad7890e4b9d45a9dd50
apps/terminal/ui/integration/sample-console/src/assembly/assembly.tsx  285ee64822c1e36de81dd8877195a671ef2504aa0e3a18e2c507e7ff2a3987dc
apps/terminal/ui/integration/sample-console/test/sampleAssembly.test.tsx  76d5eac527040d1eec790f553803a0a72255e7f06722c6ec8ad06c01a2322333
apps/terminal/ui/integration/sample-wallpaper-console/src/assembly/assembly.tsx  0e595d08bf97a17c36b40ebaeae6fd26d85d488d7724fb4cb16473eaba6e039d
apps/terminal/ui/integration/sample-wallpaper-console/test/sample2Assembly.test.tsx  e833dcc7a8e91092895e007c824b3794d3f5588bec7edb822d4a6ab69d6a3b6b
apps/terminal/application/android/sample-terminal/src/assembly/platformPorts.ts  f2f9f7cf02a588095be80531d545929d98d5eae46f8376c478245e306fd5fb20
apps/terminal/application/android/sample-wallpaper-terminal/src/assembly/platformPorts.ts  28c20d346cff8284f6626967cbbc2710b0509ada2045f1a4dc3e2bcb31da6d7c
apps/terminal/ui/integration/sample-console/README.md  e7376f35c8723526ebeefaa143e33bab23a4b7066bd288ed2071e29206ba6b4d
apps/terminal/ui/integration/sample-wallpaper-console/README.md  4d480434b19c8c6bc2092efddb689cf3a8433141e2045e6496f4cab9595fd2b9
apps/terminal/application/android/sample-terminal/README.md  fc1a2e97ef7c70b378ba03195ce50152b26cec032219ef9286537ba376360365
apps/terminal/application/android/sample-wallpaper-terminal/README.md  b45f59d85c7be9e8091004d99633f40e1aaf1711e3f57f71732eb4b65267c0ea
apps/terminal/kernel/base/server-config/README.md  f08b4c2e4badc4a8a971ed2b7e8e38a9e07c7a15ffd4b2a7ac8a8ad30c50140c
```

Selected raw output SHA-256：

```text
server-config-test.log  15cd4f198909fbeca102332ad794d1d08364360c342f7bc679fcc3525c507d37
server-config-hydration-test-r5.log  356bf9d954ef8c04f78f60d8a03dd5c9a167e1f6984d6f198e04fb8ad2f118f3
server-config-lint-after-hydration-r2.log  a0852ba1e3295ae131a6d6ca1a4e439ff67d0f0004b057dc89d494ca762ff43f
server-config-typecheck-after-hydration.log  e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
topology-test.log  ada4f54a9597ad7e9d2fbbd3b7c16b7d8cc05f3d03366e36fbe93e14a40bde82
sample-console-test-rerun.log  dba0821d1f5be344e70a2e0bb772d61ac13a9fa87a7b3721c0f683dc6731b27f
sample-wallpaper-console-test-final.log  1e13c10db5af35162807561b29a8af7d6886b38ce11ac234f798bfedc96ce0b5
sample-console-typecheck-rerun.log  e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
sample-wallpaper-console-typecheck-rerun.log  e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
sample-terminal-typecheck.log  e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
sample-wallpaper-terminal-typecheck.log  e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
topology-typecheck.log  e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
topology-lint.log  3ba202e36d91207817c25268b58dc00e08304b73bbee76881bec58d796207012
skeleton-static.log  3445518abedc842edad53caa3072633503324abc59c43f72258ec9e2133b848d
prettier-check.log  17aa973d3f004560237d9a95171210b0671deff23d61628eecf7322ff5938f20
memory-route-platform.json  73993370a57a0be157c29cbbb98efe55a64ef68b79ca9bf56198b1bfc5c3f54e
memory-route-backend.json  f447df644c6b3160041f1eb973566a4ee18c5e0fcb50c554e19824087206e3d7
```

源计划 SHA-256：该计划在本报告较早时的摘要为 `f2c29411b7271d158da8a0c30d250c4fb2935f7072c1b62bcb33cff0a82fde36`；fresh reviewer 对应此版判据。对账返回后，计划仅更新 CP-01 状态单元格为 `MATCHED`，未改动判据。请以当前 `sha256sum` 获取最新摘要。其它原始日志及路线文件同样保存在 `apps/terminal/.runtime/activation-pair-cp01/`。

## 未验证与下一步

- fresh CP-01 reviewer `STEP_RECONCILIATION=MATCHED`、0 finding；完整 verdict 与依据如下。implementation plan 随后仅把 CP-01 状态更新为 `MATCHED`，不改变已复核判据。
- application Android 实际消费 package defaults 的证明放在 V-07 当前字节 VM 场景；Expo Web、所有 VM topology、adapter 行为、DEV 业务运行、cleanup 与 V-01～V-20 均未由本报告证明。
- 无 reset、seed、Browser L2 或部署运行授权；本报告没有进入这些执行面。

## Fresh CP-01 reconciliation

```text
STEP_RECONCILIATION=MATCHED
FINDINGS=0
```

Fresh reviewer 独立核对 R-06/R-07、CP-01 退出条件、IA、defaults owner/四入口注入、invalid hydration 行为和 focused evidence；确认 R2 hydration finding 已由当前 owner test 关闭，README 与哈希证据可复查，未把 VM/Web/DEV 结果误报为 PASS。对账边界仅 CP-01，不替代全批6b、整批动态验收或最终实施 review。
