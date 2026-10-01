# 批次二 CP-03 · TDS endpoint path 传递修复与 focused proof

日期：2026-10-01。作者：Codex 主 agent。范围：CP-03 中因 CP-06 联调闭包重读发现的协议 endpoint path 传递缺口；本记录不是 CP-03 三维 verdict，不替代 fresh reviewer `MATCHED`。

## 规则与影响面

需求 R-4.1 与 `contracts/protocol/terminal-connection-protocol.json` 将 TDS endpoint 定为 `/tdp/{groupWorkspaceKey}/ws`。原 client actor 已持有凭证中的 `groupWorkspaceKey`，但调用通用 `transport.start` 时没有传路径；Transport adapter 因而无法仅凭服务 origin 建立正确握手。不得让 transport 解释 TDS 消息或直接读取 `server-config`。最小修复为 client 按协议构造 origin-relative path，通过通用 start 参数不透明传给 network adapter；adapter 将其与选定地址 origin 合并。transport 只拒绝可能逃逸 origin 的格式。

改动同步了：

- `terminal-data-client` connect actor 将 `/tdp/${encodeURIComponent(groupWorkspaceKey)}/ws` 放入 `endpointPathAndQuery`。
- 通用 `TransportStartInput` 与 `TransportNetworkAdapter.connect` 增加可选 opaque route 字段；connection owner 在每次新地址尝试时传递，不解析业务语义。
- focused tests 分别断言 client→transport route 生成、transport→adapter route 透传、query 原样透传，并拒绝 protocol path 可能逃逸 origin 的闭集反例：`//host`、absolute URL、反斜杠、fragment、control character。
- 批次二详设 CP-03、实施计划 CP-03 与 `transport/README.md` 同步 path owner、注入 adapter 拼装职责及禁止覆盖 origin 的边界。

未引入 transport 对 workspace key/TDS 路径的业务解析，也未改变 `server-config` 的 address-origin 所有权、重连语义或代理秘密路径。

## 证明

六维项目记忆查询：

```text
scripts/memory/query --task-kind implementation --domain platform --consumer-face backend --owner platform --impact architecture --trigger implementation
PROJECT_MEMORY_ROUTE=implementation/platform/backend/platform/architecture/implementation
PROJECT_MEMORY_MATCHES=30
PROJECT_MEMORY_PATH_SHA_SET=2056aecf8050006f7fac6988795a0ad670f999f9eb29f74a814cc3fff7a4dacc
```

查询同时验证六个 kernel、全部匹配条目的 sourceRef 与 anchor。相关回读包含 terminal architecture/stack rulings、terminal coding standard、implementation source reread discipline、deterministic-context-only、owner boundaries、transport owner source。需求与协议回读确认路径模板没有随实现更改。

Focused proof 为本机 package owned suites，不是 managed run，不产生受管 run id，也不证明 DEV/真实业务验收：

```text
yarn workspace @catering-v2s/kernel-base-terminal-data-client test
TERMINAL_PACKAGE_TEST_MODE=PASS package=@catering-v2s/kernel-base-terminal-data-client mode=PROD files=6 tests=17 allowedDevSkips=0
TERMINAL_PACKAGE_TEST=PASS kind=REAL_TESTS package=@catering-v2s/kernel-base-terminal-data-client

yarn workspace @catering-v2s/kernel-base-transport test
TERMINAL_PACKAGE_TEST_MODE=PASS package=@catering-v2s/kernel-base-transport mode=PROD files=8 tests=41 allowedDevSkips=0
TERMINAL_PACKAGE_TEST=PASS kind=REAL_TESTS package=@catering-v2s/kernel-base-transport

yarn workspace @catering-v2s/kernel-base-transport lint
TERMINAL_PACKAGE_LINT=PASS package=@catering-v2s/kernel-base-transport files=19 errors=0 warnings=0
```

追加的 endpoint-path focused suite 原始日志：`.runtime/review/terminal-activation-batch-2-cp03-focused/endpoint-path-origin-escape-tests.log`，SHA-256 `812d8b86e725f502d4676897b94d26f08b92cf4b9aaae529ea0cf0ae6409744e`；该当前字节 package suite 为 8 files/41 tests PASS。适用记忆的再次路由为 `implementation/platform/backend/platform/runtime/implementation`，命中 15 条，六 kernel 与所有命中 sourceRef/anchor 已由本会话 memory 查询复核。

测试后逐项回读原需求 R-4.1、协议 endpoint、两侧 tests/caller/consumer、CP-03 详设与计划、README、项目记忆相关锚点。当前代码仍需由 fresh CP-03 reviewer 对需求、详设与 IA（本批无 UI-bearing IA，N/A）和项目记忆规范独立对账。

## 当前字节摘要

| 文件 | SHA-256 |
|---|---|
| `apps/terminal/kernel/base/terminal-data-client/src/features/actors/terminalDataClientActor.ts` | `b5f57c66f278dc0d77bd01e6523fffdbc6768b64a6fc413ba2b4d578581648ed` |
| `apps/terminal/kernel/base/terminal-data-client/test/terminalDataClientActor.test.ts` | `55b6744f2e500c86cca6cf2d618c4fca406d0af0cd5aecfc719365be351c1236` |
| `apps/terminal/kernel/base/transport/src/types/runtimeControl.ts` | `f57ead8e8fb980010dcd40c803dd03b9d5fcb5ca628ec4a4b34b86c0098895f1` |
| `apps/terminal/kernel/base/transport/src/foundations/createTransportConnectionOwner.ts` | `6bbb8968627689b88c228db308e0fafc1221f34ff4d171e462d25f4149731af0` |
| `apps/terminal/kernel/base/transport/test/connectionOwner.test.ts` | `979a5a4459a86686246250bba21d407a05b239ae9f7099a723f8fba6518f70b7` |
| `apps/terminal/kernel/base/transport/README.md` | `19238ce4131a1217ae90d83e300a776bab6ed13e4321d93dd89d532bf45d6dff` |
| 批次二详设 | `4b516340da6e34134c1101cb9118bd8dd749ee8eb712285cd1ce930ce95fbe4a` |
| 批次二实施计划 | `3882a990c829d43247184ee80b5a29cf064328894b454f277a81bbae93a42d12` |
| 原需求正本 | `d5547971f87cf9041e162734de910db5a116d026faf91a73aaa9487e8d62ff28` |
| 共享 TDS 协议 | `e5a6c77d0f1872b0b8fa9bdcbd38fda123176e6cac7c00d817ca8628ef8193b8` |

**证据限制**：仅以上本地 focused package tests/lint 为 PASS。CP-03 整阶段、transport-adapter 真实 handshake、Node V-E、DEV、全批 6b、backend-acceptance、scripts/verify、远端资源/cleanup 仍为 `OPEN` / `NOT_RUN`，不得据此声称批次完成。

## Fresh finding intake：endpoint-path 反例范围

Fresh CP-03 reviewer `/root/cp06_reconciliation` 确认 `CP03-OPEN-1`：生产 validator 会拒绝非 `/` 起始、`//`、反斜杠、`#`、控制字符和 absolute URL，但原 focused test 只覆盖 `//host`，不足以满足 CP-03 计划要求的全闭集反例。分类：`CONFIRMED`（测试证明范围缺口；未发现生产逻辑错误）。

最小修复仅扩展现有 owner test：有效 `/tdp/aurora/ws?x=1` 必须不改写地传到 adapter；逐一断言 `//attacker.invalid/ws`、`https://attacker.invalid/ws`、`/tdp\\workspace/ws`、`/tdp/workspace/ws#fragment` 与含 NUL 的 path 均以 `TRANSPORT_ENDPOINT_PATH_INVALID` 拒绝，且 invalid paths 不触发额外 adapter connect。实现的拒绝集合未扩大，也不让 transport 解释 TDS 消息或业务字段。

测试后已回读需求 R-4.1、协议 endpoint、validator 与 adapter caller、三包职责、CP-03 详设/计划和命中记忆。此处只记录主 agent 修复及 focused proof；fresh CP-03 当前字节三维结论尚待 reviewer 返回，不把本段升级为 `MATCHED`。本次 focused 输出不是受管 run，不代表 V-E 或 DEV 通过。
