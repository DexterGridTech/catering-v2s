# TER Android persistKV / persistSecure CP-3 执行记录

```text
RUN_DATE=2026-09-13
RUN_KIND=TER_ANDROID_PERSIST_KV_CP3_SAMPLE_WIRING_STATIC
CP=CP-3
AUTHORITY=Dexter direct implementation authorization
GATE=MATCHED
BUSINESS=MATCHED_FOR_PRODUCTION_WIRING
CLEANUP=PASS（本 CP 仅静态/typecheck，无长驻运行态）
FRESH_SUBPROCESS=yes；独立 reviewer 未执行本记录命令
```

## 实际输出

```text
yarn workspace @catering-v2s/assembly-android-sample-terminal typecheck
PASS

node tools/terminal-skeleton/check-static.mjs
RULE_GATES=6
SUPPORT_CHECKS=1
RULE_GRAPH_COMPARISON=PASS
RULE_TRIPLE_NAMING=PASS
RULE_DEPENDENCY_DIRECTION=PASS
RULE_DEPENDENCY_DECLARATION_COMPLETENESS=PASS
RULE_TR01_REDUCER_BOUNDARY=PASS
RULE_KERNEL_PLATFORM_INDEPENDENCE=PASS
SCAFFOLD_HYGIENE=PASS
```

## 当前字节核验

- `apps/terminal/assembly/android/sample-terminal/src/assembly/platformPorts.ts` 的真实生产接线以同一 `createAndroidPersistKvPort` 生成 `persistKv(..., 'plain')` 与 `persistSecure(..., 'protected')`。
- `unavailablePersistSecurePort` 已从该 seam 消失；没有为 protected 创建第二个 adapter 或 Expo module。
- `apps/terminal/adapter/android/persist-kv/src/index.ts` 与实现同步导出 factory/mode type。
- `expo-module.config.json` 仍只注册 `TerminalPersistKv`；Gradle 只复用 `com.tencent:mmkv:2.4.2` 和为 native unit test 增加的 JUnit。
- package exports 仍指向 `./src/index.ts`；skeleton graph 的 adapter→platform-ports、sample→adapter 方向和声明集合通过静态门。
- adapter README 是中文，示例与当前 factory 签名、两个 mode、八方法、SINGLE_PROCESS、sync、marker mismatch、local-only 边界一致；不把 local obfuscation 写成强安全。

## CP-3 结论

生产接线、公共导出、module registration、包图、Gradle 依赖和 README 的静态/typed gate 为 MATCHED。真实 release autolink/module load 不由本记录代替，见 CP-4。

