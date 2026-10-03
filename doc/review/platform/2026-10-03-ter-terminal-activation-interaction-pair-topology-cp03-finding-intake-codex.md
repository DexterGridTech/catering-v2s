# TER 交互与双机拓扑专项 · CP-03 finding intake 与实施证据

## 范围与判定

- CP：CP-03「本机 admin 与服务配置」；不包含 CP-04 的断链业务遮罩/current-peer readiness，也不声称 UI/VM/DEV 已验证。
- 输入：正式需求 R-03、R-05、R-06、R-11、R-12；Journey/IA/交互详设与计划 §5；server-config、admin-shell、integration assembly 与 package dependency owners。
- 旧设计复评 S-1/N-1：接受已核实的文档修正，不重新解释 LMS 承载；testId 在设计稿中区分源码已有值与新组件的提案。实施后新增面板的 testId 已挂在实际控件/状态节点，源文档保留其设计时提案语义。
- 本阶段结果：`STEP_RECONCILIATION=MATCHED`。fresh 独立 reviewer `/root/cp03_reconciliation_r3` 对完整 CP-03 做了只读三维对账；S-CP03-1 修复后确认 MATCHED。该结论不代表整批 review 或动态验收通过。

## Finding intake / 根因处置

| 项                           | 独立重开后的判断                                                                                                        | 根因与最小处置                                                                                                                                                                                                        | 当前证据                                                                                                                                                |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| admin local open/close       | `CONFIRMED`：旧 host-primary-only 条件及 peer-intent 本地打开路径不满足 LMS secondary、slave LSP primary 的离线管理恢复 | 复用 `AdminLauncher` 手势、`AdminLayerFrame` 生命周期和现有 UI-state commands；移除仅限 host-primary 的 handler gate，打开/关闭使用本 runtime local target。没有新增可见入口或 peer command                           | admin-shell 61 tests + lint PASS；sample-console 60 tests 含非主机物理屏本机打开并到达登录层；sample-wallpaper-console 28 tests PASS                    |
| branch 配置来源/权限         | `CONFIRMED`：selector 以本机 package defaults fallback 会把未接收主机快照的 SLAVE 误显示为权威配置；fresh CP-03 对账另确认 owner 的四个公开写命令缺少 SLAVE 准入 | `selectServerConfiguration` 输出 `source=package-defaults \| host-sync`；分支在 host-sync 前显示等待，收到 projection 后只读展示；server-config owner 在读取角色后拒绝 SLAVE 的 select/set/clear/restore 命令。无第二配置 owner | panel 3 tests 覆盖未同步不泄漏本机默认和同步快照只读；server-config owner 当前 9 tests，新增真实 runtime SLAVE 直调四类命令并验证状态不变；lint/typecheck/test PASS |
| owner command 持久化失败语义 | `CONFIRMED`：仅由 command completed 不能推出持久化成功                                                                  | owner command 复用已有 `ActorExecutionContext.flushPersistence()`；返回 persisted/failed/unconfirmed/unchanged，失败不回滚已更新 effective config；validation rejection 不改状态。没有扩展全局 runtime 或添加恢复机制 | `kernel-base-server-config` tests 9/9、lint/typecheck PASS；失败断言读取 owner selector 验证 effective config 仍是新值                                  |
| address/proxy 管理 UI        | `CONFIRMED`：完整 URL 前缀沿每个 address 的 `baseUrl` 唯一持有，代理秘密不得回显                                        | 新增 `ui/base/server-config-panel` section，复用 InputScrollArea、`useInputField`、Primitive 和公开 server-config selector/commands。显示 effective readback；密码输入 secure 且默认空；分支无写控件                  | panel test 断言 DOM 不含默认代理密码原值；同步 SLAVE 展示 host URL 而不显示 package-local URL；typecheck/lint/test PASS                                 |
| package/skeleton 依赖闭包    | `CONFIRMED`：两个 integration package 增加了 panel dependency，skeleton graph 原先遗漏                                  | 修正两个 integration dependency declarations 与 `apps/terminal/skeleton-graph.ts` 相同依赖边；没有改 runtime owner dependency                                                                                         | 首次 `verify-static` 保留首败 `graph-comparison ... extra=["ui.base.server-config-panel"]`；修正后同门复验通过，完整终端静态入口 `TERMINAL_STATIC=PASS` |

### CP-03 独立对账 finding intake（S-CP03-1）

- 分类：`CONFIRMED`。正式需求 R-06 要求分机的 server-config 配置不能通过 UI 或业务 command 修改；详设 §5 CP-03 也将“branch 所有实际写操作与直接 command 均拒绝”列为可验收观察。界面只读并不能阻止同 runtime 中调用公开 command。
- owning source：`serverConfigActor.ts` 的 `select-space`、`set-server-override`、`clear-server-override`、`restore-server-defaults` 原来只校验 payload/state，没有检查 runtime 角色；四个 command 均公开且 target=local。无需猜测异步同步时序或改 dispatcher。
- 最小修正：四个 owner handler 在读取/修改配置前复用 `selectRuntimeInstanceMode(context.getState())`，只允许 `MASTER`；`SLAVE` 返回 owner 错误 `SERVER_CONFIG_HOST_ONLY`。hydration 校验与 host projection 应用仍是内部机制，不受此用户命令准入限制。
- 更小替代与边界：仅隐藏 panel 写控件不满足 R-06；仅在 integration 层拦截也无法约束本地其它调用方直接 dispatch 公开 command。未引入新 role store、同步框架或通用 dispatcher policy。
- 当前 proof：server-config focused test 新增一例，先通过 runtime role command 切到 `SLAVE`，再直接派发四个公开 command；四个均返回 `error` 且 owner slice 完全不变。该测试不替代 Expo Web/VM/DEV 证明。
- 独立结论：fresh CP-03 reviewer 确认 `STEP_RECONCILIATION=MATCHED`。初次报告把 integration assembly 写成错误前缀 `apps/terminal/apps/...`；reviewer 随后重开并更正为 `apps/terminal/ui/integration/...`，核实两套 assembly 均装配 panel、server-config owner、state slices，并将 selector snapshot provider 注入 transport adapter，MATCHED 结论保持。精确路径见下节。
- 剩余边界：Web、VM、DEV 与 V-01～V-20 仍 `NOT_RUN`。

独立对账证据路径更正：

- `apps/terminal/ui/integration/sample-console/src/assembly/assembly.tsx:71,133-166`
- `apps/terminal/ui/integration/sample-wallpaper-console/src/assembly/assembly.tsx:106,120-152`
- `apps/terminal/kernel/base/server-config/src/features/slices/serverConfig.ts:57,72`

上述路径确认 panel/owner 的实际装配及 host-to-slave state sync 投影；前述无效 `apps/terminal/apps/...` 引用不作为证据。

## 当前字节 proof

| 命令/执行面                                                                                              | 当前结果                                                                                                                                                                                                                                           |
| -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `yarn workspace @catering-v2s/ui-base-server-config-panel lint`                                          | `PASS`，6/6源码文件，0 error/warning                                                                                                                                                                                                               |
| `yarn workspace @catering-v2s/ui-base-server-config-panel typecheck`                                     | `PASS`                                                                                                                                                                                                                                             |
| `yarn workspace @catering-v2s/ui-base-server-config-panel test`                                          | `PASS`，1 file / 3 tests                                                                                                                                                                                                                           |
| `yarn workspace @catering-v2s/kernel-base-server-config lint && ... typecheck && ... test`              | `PASS`，lint 0 error/warning，typecheck PASS；2 files / 9 tests，含 `SLAVE` 直接命令拒绝与 owner state unchanged 反例                                                                                                                              |
| `yarn workspace @catering-v2s/ui-base-admin-shell test && ... lint`                                      | `PASS`，19 files / 61 tests；lint 0 error/warning                                                                                                                                                                                                  |
| `yarn workspace @catering-v2s/ui-integration-sample-console lint && ... typecheck && ... test`           | `PASS`；lint 0 error/warning；8 files / 60 tests                                                                                                                                                                                                   |
| `yarn workspace @catering-v2s/ui-integration-sample-wallpaper-console lint && ... typecheck && ... test` | `PASS`；lint 0 error/warning；4 files / 28 tests                                                                                                                                                                                                   |
| `node tools/terminal-skeleton/verify-static.mjs`                                                         | `PASS`，run id `ter-local-static-69006-1790972089978`，最终 `TERMINAL_STATIC=PASS`；包含格式、readability、skeleton、contracts、platform-ports、state、runtime、display-context、ui-state、render、layering model/real static。完整运行约 4 分钟。 |

CP-03 S-CP03-1 修正后 focused proof（本地包测试，不是 Expo Web/VM/DEV 运行）：

- `yarn workspace @catering-v2s/kernel-base-server-config lint && yarn workspace @catering-v2s/kernel-base-server-config typecheck && yarn workspace @catering-v2s/kernel-base-server-config test`：`PASS`；lint 16/16、0 errors/warnings；typecheck exit 0；Vitest 2 files / 9 tests。真实 runtime 切到 `SLAVE` 后，直接 dispatch `select-space`、`set-server-override`、`clear-server-override`、`restore-server-defaults` 均返回 `error`，server-config owner slice 与调用前相同。
- `yarn workspace @catering-v2s/ui-integration-sample-console test`：`PASS`；8 files / 60 tests。
- `yarn workspace @catering-v2s/ui-integration-sample-wallpaper-console test`：`PASS`；4 files / 28 tests。
- 本修正不新增受管运行、DEV、Expo Web、VM、adapter 或 V-01～V-20 证明；上述均保持原 NOT_RUN 状态。

## 首败和根因

1. 首轮 panel test 因 effect 依赖 selector 每次创建的新对象而持续重新设 draft；`selectServerConfiguration` 为派生 view，service/addresses/proxy 对象 identity 不稳定。改为以不含密码的 effective config 值序列化 key，再 memoize draft source；当前面板测试完成且无重复 effect。
2. 首轮 sample-console suite 命中三处测试输入漂移：dependency roster未列新面板、part catalog 的旧数组边界/顺序假设不再成立、原“非主机屏不显示 admin”断言与本需求本机恢复相反。分别按实际 package graph、partKey前缀、真实 catalog 顺序修正。
3. `theme.test` 原本没有模拟 React Native View 的 `measureInWindow` native ref；新行为使本机 launcher 在有效非主机屏可见，Node 测试 host 不具备平台 ref。测试按本仓 `rntl-native-test-host` 正规工厂模拟 View 测量，不在生产代码添加虚构坐标或 fallback。
4. `verify-static` 首次失败后已按实际 package dependency source 更新 skeleton graph；同一 static proof 在新字节通过，红夹具均恢复。没有把首败改写为 PASS。

## 未运行 / OPEN

- CP-03 阶段级三维对账：`MATCHED`；该状态仅覆盖 CP-03 当前实施输入及 focused evidence。
- Expo Web、DEV、VM、设备 adapter、V-01～V-20：`NOT_RUN`。
- Browser L2、reset、seed、UAT、部署：范围外 / 未授权。
- 没有任何受管环境或 cleanup 结果声称为 PASS。
