# TER Android persistKV / persistSecure CP-2 执行记录

```text
RUN_DATE=2026-09-13
RUN_KIND=TER_ANDROID_PERSIST_KV_CP2_FOCUSED_BRIDGE
CP=CP-2
AUTHORITY=Dexter direct implementation authorization
GATE=MATCHED
BUSINESS=MATCHED_FOR_FOCUSED_BRIDGE_SCENARIOS
CLEANUP=PASS（本 CP 无长驻进程；测试 runner 退出）
FRESH_SUBPROCESS=yes；独立 reviewer 未执行本记录命令
```

## 实际输出

```text
yarn workspace @catering-v2s/adapter-android-persist-kv typecheck
PASS

yarn workspace @catering-v2s/adapter-android-persist-kv test
Test Files  1 passed (1)
Tests       6 passed (6)
TERMINAL_PACKAGE_TEST=PASS kind=REAL_TESTS package=@catering-v2s/adapter-android-persist-kv
```

六个 focused case 的实际断言面：

1. module lookup 第一次抛错时返回 typed bridge failure，第二次重新 lookup 成功；没有永久缓存失败，也没有 storage timeout 参数。
2. `plain` 与 `protected` wrapper 引用不同、均 frozen，descriptor 分别为 `persistKv/plain` 与 `persistSecure/protected`，调用共用同一 native module cache。
3. 八个 capability 全部从同一 mode boundary 转发，opaque string 原样传递。
4. 缺 value、port/mode/capability 不匹配、未知 status 和带多余敏感字段的 private wire 都被 `PERSIST_KV_INVALID_RESULT` 拒绝。
5. runtime-invalid mode 在 native lookup 前返回 `PERSIST_KV_INVALID_MODE`，native module 和 method 均零调用。
6. native promise rejection 映射为 `PERSIST_KV_BRIDGE_FAILED`，protected 结果仍带 `persistSecure` 语义。

这些是 fake-native focused proof，不外推 Expo registration、MMKV 文件行为或 Android durability。真实 module load 和文件行为在 CP-4 另行记录。

## 与详设的传递/消费对账

`createAndroidPersistKvPort` 只在 adapter 内定义 mode→logical port，`callNative` 使用同一个 lazy module，`parseNativeResult` 在进入公共 `PortResult` 前验证完整 private wire；`src/index.ts` 导出 factory 和 mode type。sample 的真实消费点是 CP-3 的 `platformPorts.ts`，不是本测试中的夹具 port。

## CP-2 结论

当前 focused bridge gate 为 MATCHED。它只证明 JS bridge 的运行时封闭、cache、wrapper/descriptor 和 typed mapping；不提升任何 native、Android、release 或 visual 档位。

