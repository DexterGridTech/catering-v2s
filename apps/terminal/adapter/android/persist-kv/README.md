# `@catering-v2s/adapter-android-persist-kv`

## 定位

本包是 TER Android 的本地键值存储适配器。它用一个 Expo module 和一套 Kotlin store
逻辑同时承载 `persistKv`（plain）与 `persistSecure`（protected）两个逻辑端口；它不是
state owner，也不解释 state JSON。

本批的 protected 目标是 **LOCAL_OBFUSCATION_ONLY**：避免落盘文件被直接按明文阅读，
不是 Keystore、硬件绑定、防逆向或防设备接管的机密性保证。

## 作用与用法

state 层负责 JSON 编码、canonicalize 和类型校验。本 adapter 只保存和取回不透明字符串，
不建 envelope，不调用 `JSON.parse`，不执行 `String(value)`，也不在 JS 侧加密。

assembly 必须显式选择 mode；不传默认值：

```ts
import {createAndroidPersistKvPort} from '@catering-v2s/adapter-android-persist-kv'

const persistenceKey = 'sample-terminal-android'
const persistKv = createAndroidPersistKvPort(persistenceKey, 'plain')
const persistSecure = createAndroidPersistKvPort(persistenceKey, 'protected')
```

两个返回对象是不同的 frozen `StateStoragePort` wrapper，分别报告 `persistKv/plain` 和
`persistSecure/protected` descriptor；它们共用同一个懒加载的 `TerminalPersistKv` native
module。protected 不能省略 mode、改用 plain、或失败后回退 plain。

## 存储隔离与身份

- plain 使用既有 `catering-v2s.terminal.state.v1.` 加 UTF-8 percent encoding 的 namespace。
- protected 使用独立版本 namespace `catering-v2s.terminal.state.protected.v1.`。
- protected 的 MMKV instance 使用 `MMKV.SINGLE_PROCESS_MODE` 与带 `cryptKey` 的重载；
  `cryptKey` 由 `Settings.Secure.ANDROID_ID` 在 Kotlin 端派生，原始身份材料不经过 JS、
  不写入日志，也不写入明文 metadata。
- 正常写入、删除和清理后调用 MMKV `sync()`，承诺到正常进程重启可恢复；不承诺断电或
  内核崩溃级耐久。
- protected 首次打开写入一个 adapter-owned 初始化 marker。打开前用 MMKV 的
  `checkExist(namespace)` 观察既有文件，再结合 marker 区分“新建空 namespace”和“已有
  文件但当前身份/key 不匹配”；不调用 `checkReSetCryptKey`，不自动 rekey，不迁移旧 v1，
  不清理旧 v1，不回退 plain。
- marker 是内部实现，不出现在 `listKeys`，`clear` 会保留它；保留 marker 之外的用户键
  仍由同一个 protected MMKV instance 管理。

## 八个端口能力和边界

`read`、`write`、`remove`、`readMany`、`writeMany`、`removeMany`、`listKeys`、`clear`
均从同一个 mode resolver 取得 namespace、身份和 MMKV instance。`read`/`readMany` 遇到
存在但不能解码为字符串的键返回 typed failure，不伪装成 missing；`listKeys` 不承诺顺序，
不返回内部 marker；`clear` 只清当前 mode 的用户键。

native 边界拒绝缺失、空值或未知 mode；persistence key、entry key、value 和 batch 都在
打开/写入前校验：分别为 128、256、1 MiB、512 的上限，且 key 非空、不得包含控制字符。
超限返回 typed invalid failure。state 的一般 workload 仍由 state owner 决定逐键或批量，
adapter 不把逐项循环宣称成 atomic batch receipt。

所有 private native result 都带 `port`、`mode`、`capability`；JS bridge 在映射到公共
`PortResult` 前验证完整 shape。bridge 失败、invalid mode、身份不可得、key mismatch、
解码失败和底层操作失败使用稳定 code 与按错误类型分类的 `retryable`，不把原始 key、value、
cryptKey、ANDROID_ID 或 throwable 放进 result/log。

## 结构

```text
src/
  implementations/androidPersistKv.ts  单一 JS bridge、wire validator、两个 mode wrapper
  index.ts                               唯一公共导出
android/
  .../TerminalPersistKvModule.kt         mode resolver、MMKV、身份、marker、八个 native 方法
test/
  androidPersistKv.test.ts               bridge、descriptor、wire 和 red mutation focused proof
```

native 注册仍只有 `TerminalPersistKv` 一个 module；MMKV 依赖固定为 `com.tencent:mmkv:2.4.2`。

## 迭代指引

先重开需求、详设、state/platform-ports contract 与当前 assembly，再改本包。存储格式、
namespace、身份策略、迁移或更强安全目标必须另立裁定；不得新增第二 adapter、第二 module、
第二 registry、fallback、复杂密码学或隐式兼容层。任何 native API 变更必须同步 JS private
wire validator、两个 descriptor、sample assembly、README 和对应 focused/Android evidence。

本包的 typecheck/focused proof 不等于 native、Android、release 或 cleanup 通过；每个档位必须
记录实际运行输出和 first failure，未运行必须明确标为 `NOT_RUN`。
