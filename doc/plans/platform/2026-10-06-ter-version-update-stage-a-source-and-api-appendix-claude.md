---
title: TER 更新阶段 A 源码与官方 API 附件
status: STATIC_SOURCE_ONLY
---

# 当前源码与官方依据

## 1. 静态来源，不是运行证据

读取日期：2026-10-06。本轮没有读任何 `.runtime/` 运行产物。

| 仓内 source | 本轮确认的事实 | 设计消费 |
| --- | --- | --- |
| 两 App 的 package.json、android/app/build.gradle、MainApplication.kt | package.version=1.0.0；Gradle versionCode/versionName 仍写死；Host 由 Expo factory 缓存 | CP-01 单源、CP-03 接缝 |
| kernel/base/platform-ports/src/types/hotUpdate.ts | 旧七方法 marker 接口 | 替换 UpdatePort，不保留兼容别名 |
| application/base/android/src/foundations/androidPlatform.ts | hotUpdate 默认不可用 | 接入真实 Android adapter |
| application/base/android/android/.../TerminalAppControlModule.kt | 只 reload，不切换工件 | 复用 Host 的受控 reload |
| application/base/android/android/.../TerminalNativeLoadingRegistry.kt | Activity gate/token；已隐藏和失败可 hide | 单独建立 update boot identity；不以 hide 代替确认 |
| ui/base/integration-assembly/src/foundations/integrationAssembly.tsx | PRIMARY real-ready 与内容错误分离 | confirmBoot 唯一接线 |
| kernel/base/runtime/src/types/module.ts、state/src/types/persistence.ts | flushPersistence 可返回失败；资源注册/状态订阅 | 首次固定和应用前显式检查 flush 结果 |
| ui/base/automation-agent/src/application/runtimeRequestHandler.ts | journal 先订阅再 dispatch；selector 按注册名求值；重连会话 | A 使用真实 command/selector，不传包正文 |
| tools/terminal-automation/src/androidBuild.ts | 一个 run 的 applicationId 后缀和受管构建根 | FULL/HOT 全链在同 run 保持包名和签名 |
| tools/terminal-automation/src/runner.ts、managedRun.ts | 当前 phase 闭集还无 update | 扩展当前 driver；不是已存在 update runner |
| node_modules/expo-modules-autolinking/src/platforms/android/android.ts:96–123 | 扫描 *Package.kt/java，import Expo Package/BasePackage，生成 packages | 新 TerminalUpdatePackage 注册 Host handler，实施时检查实际生成列表 |
| apps/terminal/node_modules/expo-asset/src/Asset.ts:171–204、PlatformUtils.ts | 未安装 expo-updates 时 fromModule 使用 RN resolveAssetSource | file bundle root 的资源相对解析路线；不造 ExpoUpdates 假模块 |

以上省略包前缀的路径均在 `apps/terminal/`；精确修改路径在详设 §9a，不能把表中简称用于 checker 输入。

## 2. 解析版本与官方依据

| 项 | 当前读取版本/状态 | 精确官方依据及能证明的范围 |
| --- | --- | --- |
| expo | apps/terminal/node_modules/expo/package.json =57.0.18；gitHead c3739f09b6a7620729ce7e305e88a2ec8bc79c3c | [ExpoReactHostFactory](https://raw.githubusercontent.com/expo/expo/c3739f09b6a7620729ce7e305e88a2ec8bc79c3c/packages/expo/android/src/main/java/expo/modules/ExpoReactHostFactory.kt)：L37–69 的 getJSBundleFile 在 loader 每次访问时重新计算；assets:// 明确走 asset loader，其余走 file loader；缓存 Host 不妨碍这一个公开接缝 |
| expo-modules-core | 57.0.14；gitHead c300d2cc60c9e684e64f48d9bc90ea18a571d01d | [ReactNativeHostHandler](https://raw.githubusercontent.com/expo/expo/c300d2cc60c9e684e64f48d9bc90ea18a571d01d/packages/expo-modules-core/android/src/main/java/expo/modules/core/interfaces/ReactNativeHostHandler.java)：公开 getJSBundleFile，非私有反射 |
| React Native | 0.86.3，仓内 package/source | [ReactHostImpl v0.86.3](https://github.com/facebook/react-native/blob/v0.86.3/packages/react-native/ReactAndroid/src/main/java/com/facebook/react/runtime/ReactHostImpl.kt)：精确 tag 公开源码，新实例读取 delegate loader；本轮访问该官方链接重定向至 react/react-native 同 tag，原组织名不能据此判为失效。仍需非 dev 原生 proof；[AssetSourceResolver v0.86.3](https://raw.githubusercontent.com/facebook/react-native/v0.86.3/packages/react-native/Libraries/Image/AssetSourceResolver.js) L100–135 分别走 Android 文件 drawable 路径与 APK res 标识，不证明字体实际可用 |
| hermes-compiler | root node_modules 250829098.0.17 | native Maven Hermes 解析尚未运行，不能据 NPM 号承诺 bytecode 兼容；CP-01 保存编译器版本和 CP-03 实际 native 解析/加载核对 |
| Android SDK | RN gradle/libs.versions.toml 静态默认 min24/target36/compile36；不是实际 Gradle 解析证明 | [PackageInstaller](https://developer.android.com/reference/android/content/pm/PackageInstaller)、[setRequireUserAction](https://developer.android.com/reference/android/content/pm/PackageInstaller.SessionParams#setRequireUserAction(int))：需用户动作、abort/失败及静默条件；运行设备/API/管理模式仍 OPEN |
| APK安装来源授权前置 | `REQUEST_INSTALL_PACKAGES` 由 android-update adapter manifest 声明；本仓 `update.artifacts` 最终 APK 检查 `aapt dump permissions` | [PackageManager.canRequestPackageInstalls](https://developer.android.com/reference/android/content/pm/PackageManager#canRequestPackageInstalls())要求 target O+ 与该权限；[AAPT2 dump permissions](https://developer.android.com/tools/aapt2#dump)读取最终APK权限；AOSP [ExternalSourcesDetails](https://android.googlesource.com/platform/packages/apps/Settings/%2B/master/src/com/android/settings/applications/appinfo/ExternalSourcesDetails.java)显示系统/设备限制或非潜在来源会禁用来源开关。权限在APK中不等于当前设备已允许安装；API 36设备策略状态仍未确认 |
| installer commit 判定 | [SessionInfo.isCommitted()](https://developer.android.com/reference/android/content/pm/PackageInstaller.SessionInfo#isCommitted()) 官方标为 API29 新增；本阶段 FULL 设备最低 API 已由 Dexter 裁定为29 | true 表示该 session 调用过 commit，false 只证明未调用，合法续接还须核验 session 状态；未知状态不重复 commit、不抢占或删除未知 session |
| AtomicFile | Android 框架 API | [AtomicFile](https://developer.android.com/reference/android/util/AtomicFile)：单文件原子替换；不提供跨 slice/文件事务或并发互斥，调用者仍须串行 |
| Commons Compress | 新候选 org.apache.commons:commons-compress:1.28.0，未安装/解析 | [1.28 ZIP 官方说明](https://commons.apache.org/proper/commons-compress/zip.html)、[ZipFile 固定 tag](https://github.com/apache/commons-compress/blob/rel/commons-compress-1.28.0/src/main/java/org/apache/commons/compress/archivers/zip/ZipFile.java)、[ZipArchiveEntry 固定 tag](https://github.com/apache/commons-compress/blob/rel/commons-compress-1.28.0/src/main/java/org/apache/commons/compress/archivers/zip/ZipArchiveEntry.java)：先 central directory、读取 Unix 属性拒绝 symlink；Android desugaring/transitives OPEN |

选择 Commons Compress 是避免手写 ZIP central directory/Unix 属性解析；不能用 ZipInputStream 假称已检测符号链接。
仅使用 STORED/DEFLATED、UTF-8、单卷、无加密；拒绝不支持的压缩类型。生成端选择两App既有Gradle wrapper 9.3.1的Zip任务，显式UTF-8/STORED或DEFLATED/duplicate reject/可复现时间与顺序，不新增Node ZIP库。官方[9.3.1 Zip源码](https://raw.githubusercontent.com/gradle/gradle/v9.3.1/subprojects/core/src/main/java/org/gradle/api/tasks/bundling/Zip.java)已读取；wrapper不是实际执行证明。Node schema校验复用root已声明安装Ajv8.20.0，选Draft7并strict/no coercion/no defaults；[8.20.0源码](https://raw.githubusercontent.com/ajv-validator/ajv/v8.20.0/lib/ajv.ts)已读取。新artifact生成器只支持本清单有限shape，不造通用schema平台。
官方来源只证明接口/源码语义，不证明本仓 APK、文件资源、签名、重启、恢复或性能已经可用。

## 3. 需要实际证明的前置

F-LOAD：Expo handler 确实注册；embedded 的 assets:// bundle+res 以及 HOT 的 file root 分别证明实际 HBC、图片、字体离线可用；同 Host reload 精确加载选包。embedded 不需要复制到文件目录，HOT 缺失不得默退默认 assets。
F-INSTALL：目标 API 和企业签名的真实 installer 可用；silent 资格由 OS 读回，不能承诺所有设备静默。
最低 FULL API 已裁定为29；本批只实现及验证 API≥29，不实现 API24～28 兼容分支。F-LOAD 前的 CP-01 打包门还须绑定最终签名APK实际bundle摘要与发布树入口，并核对资源清单/res名称映射；签名metadata不能代替实际字节检查，AAPT转换drawable不作原始字节相等比较。
F-BOOT：JS 错误/停顿时独立 native deadline 工作，同 Activity 新 boot 隔离旧确认，最多恢复一次。
F-COMPAT：旧内嵌 JS 和上一成功包实际读取新数据；发布声明不是运行证明。
F-BUDGET：双屏启动耗时和 scratch/RSS、ZIP 限额支持目标设备。
当前均 OPEN/NOT_RUN。实施不得把这些留到最终整体验收才第一次验证；CP-01/03/04 分别优先验证，失败时保留首败并修原 owning path。

补充：Expo onWillCreateReactInstance仅在cached Host初建调用；每context完成监听可用于绑定核对，不能拿它启动覆盖load前的T。getJSBundleFile不是boot生成器。

## 4. 本轮外部 findings 的源码复核边界

- `apps/terminal/node_modules/expo/android/src/main/java/expo/modules/ExpoReactHostFactory.kt:37–69` 与固定 commit 官方源码一致：loader getter 支持 assets:// 与 file 两条分支；本轮未改 node_modules、未构建 APK。
- `apps/terminal/node_modules/react-native/Libraries/Image/AssetSourceResolver.js:100–135` 区分 file 与 APK res；此静态依据支持移除 embedded 复制步骤，不替代图片/字体/Hermes 的实际离线证明。
- `apps/terminal/kernel/base/terminal-data-client/src/features/actors/terminalDataClientActor.ts:198–200` 当前 dispatchOfflineReset 在 L199 发起 TERMINAL_ACTIVATION_CANCELLED；外部评审及裁决的 L193 是先前位置，符号/原因一致。`apps/terminal/kernel/base/topology/src/features/actors/actors.ts:430–436、563–567` 的角色切换 flush 后 resetRuntime 为 JS 重载，不清 state。TR-09 精确例外已批准但规范未改，见详设§12。
- `doc/plans/platform/2026-10-05-ter-automation-agent-formal-requirements-claude.md:271` 允许不在 React 树内的界面使用 driver 内 uiautomator 窄例外；本包仅列安装、来源设置和只读 native failure Text，React 节点仍走 agent。
- installedApkIdentity、ENDED_NOT_INSTALLED、BUSY_UNKNOWN 出口、Web fixture 构建隔离是本轮修订后的拟实现协议，不是当前源码已具备或动态已通过的事实。安装 session/query/foreground 行为须由 CP-03/04 反例证明；瞬时无回调、查询失败不证明 session 已结束。
- `apps/terminal/kernel/base/state/src/foundations/createStateRuntime.ts:80–84` 的retain按slice.resetIntent过滤，不读取reset原因；当前生产调用仅 `apps/terminal/kernel/base/terminal-data-client/src/features/actors/terminalDataClientActor.ts:199`，测试中的其他调用不属生产集合。未来新增生产触发点必须重新评审TR-09例外，规范同步和字段focused/red仍NOT_RUN。
