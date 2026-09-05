# `@catering-v2s/adapter-android-persist-kv`

本包把 Android MMKV 接到 kernel 的 `StateStoragePort`。state 层已经负责
`JSON.stringify`、canonicalize 和类型校验，因此本 adapter 只保存和取回不透明字符串：
不建 envelope，不调用 typed API，不执行 `String(value)`、`JSON.parse` 或类型推断。

## 存储隔离

Kotlin 进程内只初始化一次 MMKV 根目录。每个 `persistenceKey` 都映射到独立实例，ID 为
固定的 `catering-v2s.terminal.state.v1.` 前缀加 UTF-8 百分号编码后缀；空 key 拒绝，
不同 key 不共享实例，进程重开后同一 key 仍解析到同一实例。实例使用
`MMKV.SINGLE_PROCESS_MODE`，与 TER 的单进程、单 VM、单 store carrier 一致。

本批固定依赖 `com.tencent:mmkv:2.4.2` 静态 artifact，写在本 adapter 自己的
`android/build.gradle`。不引入 JS 侧 `react-native-mmkv`，也不使用 `mmkv-shared`。
当前目标设备为 64 位且本机 Expo/RN Gradle 解析出的 minSdk 24、NDK 27.1.12297006
满足本批选型；将来 ABI 或 API 21–22 设备进入范围时必须重新评估。

## 八个端口落点

`read` 先用 `containsKey`，再用 `decodeString`；存在但不能解码为字符串是 typed failure，
不能伪装成 missing。`write` 只用 `encode(String, String)` 并检查 boolean 结果；
`remove` 用 `removeValueForKey`；批量读写保持输入顺序且首个写失败不报告整批成功；
`removeMany` 用 `removeValuesForKeys`；`listKeys` 只列当前实例；`clear` 只调用当前实例
的 `clearAll`。每个桥接失败都转为带静态 code/operation 的 typed failure；按 key 失败时，
wire error 还带失败的 key（`writeMany` 对 `encode` 返回 false 或抛异常的首个 entry 都返回其 key），
不把原始异常或原始值送入日志。

结构：

- `src/androidPersistKv.ts`：lazy native binding，按 persistenceKey 绑定完整 `StateStoragePort`；
- `android/.../TerminalPersistKvModule.kt`：MMKV 初始化、实例隔离与八个方法；
- `test/androidPersistKv.test.ts`：opaque string 与 typed bridge failure proof。

迭代指引：任何存储格式变化都必须先由 state codec 与 namespace 方案另立裁定；adapter
不得私自解释既有字符串，也不得以新增 fallback 隐藏真实存储失败。
