# 当前 package/lock 一致性首败

DATE=2026-09-15
STATUS=FIRST_FAILURE_RECORDED_REPAIR_IN_PROGRESS
SCOPE=static prerequisite, not dynamic runtime

## 首次核验

从仓库根执行：

```text
yarn install --immutable --mode=skip-build
```

Resolution 已完成，但 immutable post-resolution validation 失败，退出码为 1。
Yarn 明确报告当前 lockfile 会被修改，差异来自当前源码/包声明已新增或移入 lockfile
投影的依赖关系，包括：

- `assembly/base/android` 的 `expo-modules-core` peer；
- `ui/base/feature-assembly` 的 contracts/state workspace dependencies；
- `ui/base/test-support` 的 platform-ports workspace dependency；
- 两个 integration 对 `ui-base-test-support` 的 workspace dependency。

同时保留了既有 peer warning；本次首败的阻断信号是 `YN0028 The lockfile would have
been modified by this install`，不是把 warning 改写成 failure。

## 边界诊断

- `FIRST_FAILURE`：package.json / current workspace graph 已更新，但 yarn.lock 仍是旧投影；
- `BROKEN_BOUNDARY`：当前 package manifests → yarn.lock workspace resolution；
- `LAST_KNOWN_GOOD`：focused/static checker 在现有 node_modules 上通过，不能替代 immutable
  install 一致性；
- `CLEANUP`：本次 immutable 校验未启动 runtime、设备或受管环境。

## 处置与判定

使用当前 package.json 生成的锁文件修复机械投影，再重跑同一 immutable 命令。只有该命令
通过，才把安装一致性记为 PASS；peer warning 仍单独报告，不扩大为业务或动态结论。

## 最小修复与重验

主 agent 用当前 workspace manifests 执行了：

```text
yarn install --mode=skip-build
yarn install --immutable --mode=skip-build
```

第一条重新生成了当前 workspace resolution 的锁文件投影；第二条退出码为 0。
Yarn 仍报告既有 `YN0002`/`YN0086` peer warning，但不再报告 `YN0028`，因此本次
package/lock 一致性首败已修复。该核验没有启动 Metro、DEV、Android、设备、seed、UAT
或部署。
