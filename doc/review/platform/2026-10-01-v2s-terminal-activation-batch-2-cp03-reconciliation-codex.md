# 终端激活与长连接 · 批次二 CP-03 三维对账

日期：2026-10-01。当前 fresh 独立只读 reviewer `/root/cp03_manifest_recheck` 给出 `CP03_RECONCILIATION=MATCHED`，`M/S/N=0/0/0`。此前 reviewer `/root/cp02_recheck` 的 MATCHED 因详设/计划摘要过期而重开；当前 reviewer 已按更新后的 137 项摘要和当前 source 独立重查。

## 本次对账范围

对当前字节的 terminal-data-client、transport、platform-ports、server-config 注入边界、TER 包依赖图、对应 focused tests/proof、批次二需求与 CP-03 详设/计划、项目记忆及 TR-09～TR-16 做需求/详设与 IA/项目记忆规范三维对账。无 UI-bearing IA 的部分按批次设计标记 N/A；本轮未运行新的测试、构建、verify 或受管运行。

## 当前字节绑定

| 输入 | SHA-256 |
|---|---|
| 需求正本 | `d5547971f87cf9041e162734de910db5a116d026faf91a73aaa9487e8d62ff28` |
| 批次二详设（current） | `fdf3a26fe218e90ce509c6cbe65083df2f6a0e5f781aee37efdfa948a19ce485` |
| 批次二实施计划（current） | `de4f22cc72aab1b0ebef89f1038370d20895e8107abe769ee7963d4a83f9a8f2` |
| CP-03 current source manifest | `8049e092ee8d28893d2f60f450a18f7c9b710b991cd3fe397f073fc26839d25d` |
| transport endpoint test | `979a5a4459a86686246250bba21d407a05b239ae9f7099a723f8fba6518f70b7` |

修复文档摘要后，manifest `shasum -a 256 -c` 为 `137/137` 项当前字节匹配。endpoint path focused 证明仍为既有记录：有效 `/tdp/aurora/ws?x=1` 原样透传；`//host`、绝对 URL、反斜杠、fragment 和 NUL 控制字符均以 `TRANSPORT_ENDPOINT_PATH_INVALID` 拒绝，且无额外 adapter connect。既有 focused log 记录 transport package 8 files/41 tests PASS；该历史 focused 结果不表示本轮重新运行，也不证明 Web/Node/DEV/backend-acceptance 或远端 cleanup。随后 fresh 独立 reviewer 对本轮 CP-03 范围返回 `CP03=MATCHED`、`M/S/N=0/0/0`；这是静态阶段对账结论，不新增动态证据。

## 三维结果

- **需求维**：terminal-data-client 独占终端凭证、激活/取消 command、TDS 业务协议与 selectors；server-config 拥有地址/代理及代理密码；composition 注入网络配置；transport 只持有通用通信机制与连接可靠性。
- **详设/计划维**：CP-03 对 transport opaque endpoint path、连接/重试边界、DevicePort 网络状态桥与三包依赖的要求，与当前实现和 focused proof 一致。
- **项目记忆/规范维**：owner 权限、终端凭证隔离、TR-09～TR-16 与 source-reread/test-closed-loop 约束均未发现偏离。

Fresh reviewer 另确认 terminal-data-client 持有凭证与 TDS protocol，transport 不依赖 server-config/client 且不解析 TDS 消息；DevicePort 网络状态只经 transport 通用 command 进入 owner；selector 不暴露秘密。详见当前独立复核回复及 `.runtime/review/terminal-activation-batch-2-cp03-focused/` 下的当前字节 manifest/proof。

最新复核确认 current manifest SHA-256=`8049e092ee8d28893d2f60f450a18f7c9b710b991cd3fe397f073fc26839d25d`，137/137 `OK`。CP-03 manifest 未列入整个 `server-config/**` 子树；reviewer 按 CP-03 相关边界直接读了 `selectServerConfiguration`、`networkAdapter` 与对应测试，判断阶段核对足够。CP-03 继续只声明当前 source/static reconciliation，不声明任何动态 runtime 通过。

## 证据边界

CP-03 的 fresh 当前复核为 `MATCHED`；另一次批次级 6b fresh 三维对账也返回 `MATCHED`，详见 `2026-10-01-v2s-terminal-activation-batch-2-6b-reconciliation-codex.md`。两项均为静态对账，不升级本机 focused checks 为动态证据，也不代表 Expo Web、Node 真实网络、DEV、backend-acceptance、L2、reset、seed、远端资源或 cleanup 通过。
