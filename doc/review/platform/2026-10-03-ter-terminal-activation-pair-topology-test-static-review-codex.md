# TER 激活与双机拓扑专项：待测内容静态复核

## 范围与结论

本轮由主 agent 对当前 Web A 受管入口、Android 测试底座、会员 owner 状态及 V-01～V-20 执行矩阵做静态复核。结论：已确认并处置两类测试可靠性问题；Android 专项业务 runner 尚未实现，故整批测试静态审查仍为 `OPEN`，不得据此启动终端业务验收或宣称 A+B 已覆盖。

## 已确认并修复

1. **A-13a 会员列表回读可能误通过。** Web runner 原先只读第一行并用包含匹配，不能排除多行、重复行或排序差异。`scripts/test/ter-admin-display-web-contract.mjs` 现要求读取所有行、行数严格为 1 且唯一行全文与预期合成姓名/电话完全相等；`scripts/test/ter-admin-display-web.mjs` 使用此 oracle，证据只保留行数和匹配结果，不保留姓名、电话。相应 red/positive tests 在 `scripts/test/ter-admin-display-web.test.mjs`。
2. **Android 测试 manifest 授权字段不承认本专项。** `scripts/test/ter-virtual-keyboard-android.mjs` 现在只接受固定授权值集合；原 CP-4 默认行为保留，本专项需显式提供其授权值。未知授权值有红例。
3. **终端表单输入缺少可脱敏的业务输入/readback。** Android 底座现仅接受有限 `value-key` 与有限 visible-text expectation；通过虚拟键盘键逐字输入，输入字段必须初始为空，键盘可见性在有界轮询中确认，完成后在内存中精确比对。manifest 与结构化日志只写 key、resource-id、字符数和布尔结果。会员姓名与电话按 run id 合成，避免跨 run 固定值碰撞；不接受 CLI 任意字符串。
   会员列表回读现限定到指定 display，要求恰有一条完整合成姓名/电话匹配，并拒绝非法 display id；反例覆盖重复行、错误电话和 expectation 注入，回读结果不含姓名/电话。
4. **V-12/V-13 的原清理判据没有 owner 实现路径。** `sample-member-registry` 仅持有已确认会员追加与待确认撤销；会员字段由 `persistIntent: owner-only` 持久化，公开 owner command 没有删除已确认会员的操作。直接改 slice/存储会绕过 owner；增加测试删除 command 会扩大生产语义。因此详设与计划已改为：确认成功的会员是预期业务结果，作为 retained business outcome 按 run 标识记录；只清理未完成 pending、runtime 与 peer projection。运行日志/manifest不得持有合成姓名或电话。
5. **Android 口令输入不应由 UI dump 回读明文。** 店员 passcode 输入组件设置 `secureTextEntry: true`。底座对该 key 现在只记录安全的派发计数与 `OWNER_OUTCOME_REQUIRED`；必须由真实登录成功/失败状态确认，输入动作本身不记业务 PASS。结构测试把 runner 使用的 testID 与 owning UI source 对齐。
6. **已激活成功文案是瞬态，不可要求 runner 等待页面停留。** 正式交互规定成功后 integration 立刻按 owner selector 路由。Android visible-text helper 仅保留稳定的状态页断言，拒绝把激活成功瞬态文案列为可运行时等待的 expectation。

## 本轮新增静态核验与修正

7. **Android 屏幕 oracle 与失败证据**。为避免脚本执行成功却没确认目标业务面，增加有限 screen expectation（activation、staff login、member list/form/customer confirmation、wallpaper 与 activation admin），按目标逻辑屏幕逐个查找已核对的 testID；错屏、缺控件、重复节点和非法 expectation 有 focused 反例。`assert-business-screen` 复用受管 manifest/device/app/display 身份路径，不接受任意 oracle。文本与屏幕断言都先将脱敏结果写入 `businessChecks`、事件日志和 manifest，再以稳定错误码失败，避免首败未留下断言证据。相应静态源核验对照实际 UI owner；screen oracle 本身只证明控件在目标屏存在，不代替点击后的业务 owner 状态断言。
8. **静态测试夹具漏列 owner 常量文件。** 首次 focused 运行仅 `terminal business screen expectations are anchored to current UI owners` 失败；失败原因为该断言的 source fixture 未读取 `useStaffLogin.ts` 中定义的操作员与口令 testID 常量，而非生产屏幕缺控件。补入 owning source 后，以同一个单测复验通过；后续补充 wait-boundary 与失败证据断言后，当前全文件结果为 103/103 PASS。保留首次失败；后续 test result 绑定当前字节。
9. **CORS 异常消息断言 finding 已被当前字节反证。** 复核 `EdgeWebConfigurationTest.java:67-70` 可见 `assertThrows` 后单独 `assertEquals("TERMINAL_BROWSER_CORS_REQUIRES_NON_PRODUCTION", configuredProductionError.getMessage())`，对应生产抛错在 `EdgeWebConfiguration.java:80-84`。故“只断言类型”在当前字节为 `REJECTED_WITH_EVIDENCE`，不改测试。
10. **主机与副机页面 oracle 混用。** 当前 owning UI 明确区分 branch member list / branch wallpaper picker 与 host 页面；原 screen catalog 却只有通用会员/壁纸期望，壁纸还把“主机店员登出”作为所有壁纸页的必需控件。这会把合法 LSP 判红，也不能证实 LSP 没有 logout。现已按 host-mobile、host-laptop、slave 和 branch 页面拆分固定 expectation；expectation 同时检查必需控件与禁止控件，并加入“副机页面泄漏 host 页面/logout”反例。
11. **业务页面等待不受底层命令超时约束，异常路径不留 screen wait 结果。** `wait-business-screen` 的20秒循环调用 `uiDump`，而 `runManaged` 原先无默认命令超时；uiautomator/adb 卡住时循环 deadline 不生效，且异常会跳过 wait 结果写入。现已给受管子命令设60秒默认上限，页面 dump/read/remove 以8秒单命令上限且受20秒剩余 deadline 截短；等待读失败会先记录脱敏 failureCode、尝试数与耗时，再返回非零。该界限含已声明的owned-process终止/cleanup时间，不宣称严格20秒墙钟结束。
12. **受管命令输出超限原先静默截断。** `runManaged` 原先只保存 `maxBytes` 前缀，命令仍可能记为 PASS，损坏 JSON/日志读取证据。现将 timeout 与最大输出字节在子进程启动前校验；默认输出上限24 MiB、硬上限128 MiB，任何 stdout/stderr 截断都成为 `VK_ANDROID_COMMAND_OUTPUT_TRUNCATED`，manifest 明确 `outputTruncated=true`，命令不能记 PASS。
13. **Android 业务日志原来无法按结构采集。** `androidPlatform.ts` 通过默认 console binding 把对象直接传给 `console.info`；锁定的 React Native 0.86.3 console 实现先将对象格式化为开发者可读文本，Android runner却把 logcat 内容直接 `JSON.parse`。此外，`LogEvent.timestamp` 是 `TimestampMs` 数值，旧投影器用 `Date.parse(number)` 会拒绝它。现由 Android 专属 sink 对已经过 `sanitizeLogEvent` 的事件输出单行 JSON；runner按数值毫秒时间戳校窗，并要求 `commandId`、事件必需字段及 HTTP 成功/拒绝的 request/correlation id 存在，未知字段只投影丢弃。锁定版本依据为仓内解析包 `apps/terminal/node_modules/react-native/package.json` 与 `ReactCommon/jsinspector-modern/tests/prelude.js.h` / `Libraries/Utilities/RCTLog.js`。
14. **Android logger 使用生产字段但测试投影夹具与响应断言有缺口。** 日志投影夹具原先用 ISO 字符串及简化 ID，未覆盖生产 `TimestampMs` 和 `cmd_/req_` ID 形状；补为真实日志 epoch 行、数值 timestamp、command/request/correlation ID，并加入缺 commandId、敏感状态和字符串 timestamp 反例。首次 rerun保留了1条断言失败：Android transport identity 测试的 expected object 漏了生产结果已有的 `contentType`，回到 owning adapter 确认为测试 expected 不完整，未改生产行为。
15. **业务日志时间窗需绑定设备日志时钟，且读取结果不能伪装业务 PASS。** 静态核对发现runner只核验结构化事件timestamp，而解析后的logcat epoch行时间未参与窗口判断；如果输入窗口和device clock未对齐，可能接纳窗口外事件或丢掉本次事件。现加入受管`business-clock`动作，按被绑定设备`date +%s`读取epoch ms；投影同时要求logcat行时间与结构化事件时间都落入同一窗口，并以`CAPTURED`描述日志采集本身。focused tests加入窗口外行时间及无epoch行反例。
16. **失败路径的业务诊断要在非零退出前落manifest。** 会员列表owner回读在`uiDump`/解析抛错时原先没有`businessChecks`失败项；现记录脱敏failureCode、行/匹配数和耗时后再非零退出。此前全文件108/108通过绑定于会员fixture改动前的字节；当前全文件结果需在静态复核和后续夹具更新完成后重跑。
17. **会员夹具身份与 A-Web 当前字节需重新绑定。** A-13a 原 runner 曾固定使用 `Web Guest` / `0100000001`，与 Android 底座的 run-scoped 输入不一致并可能跨 run 碰撞。现由 `scripts/test/terminal-business-fixtures.mjs` 根据 run id 生成小写姓名与手机号，Web 和 Android 共用该函数；Web source inventory 也包含该 helper、stage aggregator 及测试输入。纯 oracle 测试改用同一类 run-scoped fixture。旧 A-Web manifests 的 source hash 不匹配当前字节，必须重跑完整 11 行并重新聚合后，才能开始终端阶段。

- `node --test scripts/test/ter-virtual-keyboard-android.test.mjs`：此前某字节上曾有 `108/108 PASS`；其后共享会员 fixture 与对应反例有修改，该结果现仅为历史证据。该 proof只覆盖Android低层runner解析/输入、screen oracle、命令超时/输出上界与失败证据，不是Android application业务验收。
- `yarn --cwd apps/terminal/application/base/android test`：修正adapter expected中的`contentType`后，当前包`7 files / 12 tests PASS`。先前错误的pnpm命令被项目包管理器配置拒绝，未启动测试，不计入PASS/FAIL。
- Web A：stage ID `web-a-1791021504646-071d6f18-c362-48db-8605-b05fca0bffd9`，11 个旧字节场景历史上均 `business=PASS / cleanup=PASS / sourceStable=PASS`；其 source fingerprint 与当前 Web 源不同，该结果不覆盖当前字节，须重跑全部 11 行。
- Web A-13a 的 exact-row oracle focused suite 48/48 PASS 是此前字节证据；纯 oracle fixture 已改为 run-scoped 输入，当前 focused suite `NOT_RUN`。

## 仍为 OPEN 的静态项

- 实施计划明确要求 `scripts/test/ter-terminal-interaction-android.mjs` 为专项业务 runner；当前文件不存在。Android 底座只管理设备、APK、tunnel 和有限 UI 操作，不能作为业务验收入口。
- 按 Dexter 最新要求，新 runner只编排本专项已列的场景步骤并复用 `ter-virtual-keyboard-android.mjs`；不新增通用 orchestration 框架。服务端对本次 fixture 的数据/日志作直接、有限的结果核对，同时保留 run-scoped 身份、首败和 cleanup 记录；CLI 成功或屏幕节点存在不等于业务 PASS。
- V-01/V-08/V-09/V-12/V-15/V-16/V-17 等双机行必须确认两台设备身份、pair/peer 投影和业务读回；单机或旧 `run-dual-device` 结果不能替代本专项双机 business proof。
- 当前 Android app 业务路径、命令完成后的 owner selector readback、激活/取消 request id 与后端 `REQUEST_COMPLETED` 关联、TDS 连接日志关联尚无本专项场景 runner，因此均为 `NOT_RUN`。
- 新增 Android 单行 JSON logger 和低层 event projector 仍须纳入完整终端 runner，实际验证前端 requestId/correlationId与后端`REQUEST_COMPLETED`的同请求唯一关联、owner selector readback、三个TDS节点事件及日志脱敏；当前这些端到端关联仍为 `NOT_RUN`。

## 证据边界

本文件是实施期主 agent 静态 review 记录，不是 independent `REVIEW_TARGET=IMPLEMENTATION` verdict、CP/6b/13c 对账、Android/Web 新运行许可或整批 GO。上面的 `PASS` 仅绑定所述执行面与当时字节。
