# TER 版本定义、更新包与项目更新流程 · 需求讨论稿

状态：`PROPOSED_FOR_DEXTER`。日期：2026-10-04；最新收敛：2026-10-05。

本稿记录 Dexter 新需求、已确认裁决、当前仓内事实与尚待讨论的建议。§11.1 更新规则与前置包策略已由 Dexter 指定为唯一方案；整稿仍是需求讨论稿，不是完整正式需求、详设或实施授权。不联系正在实施 TDP 的 Codex，不修改其源码、计划、依赖或运行环境。本讨论仅修订本稿与审查记录；未运行生成、构建、测试、verify、DEV 或设备验证。

## 1. Dexter 原始目标与本次范围

Dexter 首轮希望 TER 后续同时支持（上传产物的最新定义见 §9～§10）：

1. JS 包更新：通过 CBS 上传 JS 类更新包，TER 下载并更新；Android adapter 增加 update 能力，继续使用 Hermes 执行 JS。
2. APK 整包更新：通过 CBS 上传 APK，TER 下载后交系统 installer 安装。

首轮先讨论 TER 版本的含义、唯一配置位置、实际运行版本的读取，以及 Hermes 更新的技术边界。随后 Dexter 扩展讨论到三类打包、CBS 两个管理后台、项目版本规则、TDP 分发、终端任务与版本上报，新增原话和分析见 §9～§15。此前“本次不讨论 CBS 下发”的范围已被本轮扩展取代，但仍不进入详设或实施。

Dexter 最新裁决：FULL 只立即执行，下载后提示安装，未安装按规则参数 N 提醒；HOT 可立即重启 JS，或在本机界面 M 时间无点击后重启。平台仍需如实处理安装确认／免确认结果，不承诺所有设备均免确认。已下发 port 的规则固定执行；每次 JS 启动最多执行一条规则，详见 §19。

## 2. 当前仓库事实

| 事实 | 当前来源 | 判断边界 |
| --- | --- | --- |
| TER 分 kernel、ui、adapter、application 四层；integration 不依赖 adapter | `doc/platform/terminal-coding-standard.md`；`project-memory/decisions/terminal-architecture-and-stack-rulings.md` | 更新接线需服从现有依赖方向 |
| 两个可运行 Android App 是 sample-terminal 与 sample-wallpaper-terminal，分别装配自己的 integration | `apps/terminal/application/android/*/package.json`、`src/assembly/platformPorts.ts` | 更新包首先属于具体 application，不是整个 monorepo |
| 两 App 的 package.json、app.json 均写 1.0.0；Gradle 又写 versionName 1.0.0、versionCode 1 | 各 application 的三个配置文件；sample-terminal `android/app/build.gradle:166-167` | 值相同只说明当前内容相同，不说明已有单一派生源 |
| 激活输入 appVersion 来自 application package.json.version | 两 App 的 `src/assembly/platformPorts.ts:21`；integration 再把值注入 TDC | JS 更新后不能据此推断物理 APK 的真实版本 |
| application 路径实际解析 Expo 57.0.18、RN 0.86.3、hermes-compiler 250829098.0.17 | 从 sample-terminal package.json 位置以 createRequire.resolve 读取安装包；与 yarn.lock 对照一致 | 未运行 Gradle 解析，未证明已安装 APK 中的 native Hermes artifact 坐标 |
| 两 App 的 Hermes 已启用，Gradle 采用 Expo export:embed，并指定 RN 对应 hermes compiler | 各 App `android/gradle.properties:42`、`android/app/build.gradle:47-60` | 构建配置事实，不是本轮字节码生成或执行证明 |
| expo-updates 没有被 application 解析到，锁文件也没有该包；manifest 明确 ENABLED=false | application 依赖解析、yarn.lock、两 App `AndroidManifest.xml:15` | 当前未接入可用的 Expo OTA 路径 |
| 旧 HotUpdatePort 定义下载、boot marker、active/rollback marker 与 confirmLoadComplete；Android 注入 unavailableHotUpdatePort | `kernel/base/platform-ports/src/types/hotUpdate.ts`；`application/base/android/src/foundations/androidPlatform.ts:54` | 只有接口／默认不可用接线，不是已实现的更新器；建议按 §17 替换能力模型 |
| 已有 appControl 的 ReactHost.reload | `application/base/android/android/src/main/java/com/catering/v2s/terminal/application/base/android/TerminalAppControlModule.kt:17` | reload 本身不选择新的 bundle，不能直接当成更新能力 |
| 单机双屏共享一个 ReactHost／Hermes VM／store，多 surface | 终端规范及 dual-screen 原生实现 | 一个 application 的 JS 更新会同时作用于该机两屏 |

之前 POC 的分析材料 `doc/review/platform/2026-08-28-newposv1-package-analysis-claude/a-03-assembly-mixc-catering-claude.md:80-96` 已区分 App、build、bundle、runtime 四类版本。可继承其概念区分，不搬运旧 targetPackages 台账或把历史更新实现视为本仓现状。

## 3. 已接受的版本模型

Dexter 本轮接受其余收敛建议，采用以下四字段和 application 发布单源。产品定义已接受；打包派生、实际读取和原生加载仍待实现与验证。

| 字段 | 含义 | 示例 | 何时变化／如何使用 |
| --- | --- | --- | --- |
| nativeVersion | APK 的用户可读版本，对应 Android versionName | 1.4.0 | 发布 APK 时选择；不能表示当前 OTA JS 内容 |
| nativeBuildNumber | APK 安装构建号，对应 Android versionCode | 104 | 每次发布新的 APK 增加；用于系统安装新旧判断 |
| bundleVersion | 当前 JS＋资源发布的可读版本 | 1.4.2 | 每次发布新的 JS 包变化；与 APK 版本分别保存 |
| runtimeVersion | JS 包所需原生运行环境的兼容标识 | native-r3 | 本期用显式字符串；原生兼容输入变化必须改变；按精确匹配使用，不作数值大小比较 |

Android 的 versionCode 和 versionName 有不同用途，前者用于升级／降级判定，后者用于显示。[Android 官方版本说明](https://developer.android.com/studio/publish/versioning)。runtimeVersion 用于原生层与更新包的兼容匹配，不能仅以“新包版本更大”代替。[Expo runtime versions](https://docs.expo.dev/eas-update/runtime-versions/)。

还需 application identity／平台作为适用范围：不同 Android package 的包不能互装，也不能因 runtimeVersion 相同而混用 JS 产品包。ABI、minSdk、签名等由 APK 元数据表达，不额外发明“版本”。更新清单需要不可变工件身份及资产 hash；两者是身份／完整性信息，不是第五个可读版本。不因未采用的更新库而强制增加它的 updateId。

不建议给每个 kernel、feature、ui 包单独建立终端更新版本。当前 Metro 输出 application 的完整依赖闭包；运行中逐 workspace 替换会额外引入依赖兼容和模块生命周期问题。本期最小单位建议为一个 application 的完整 JS＋资源包，初期不要求增量补丁。

### 3.1 示例

| 发布动作 | 已安装 nativeVersion／build | runtimeVersion | 实际运行 bundleVersion |
| --- | --- | --- | --- |
| 安装初始 APK | 1.4.0／104 | native-r3 | 1.4.0（APK 内嵌） |
| 应用一次 JS 更新 | 1.4.0／104 | native-r3 | 1.4.1 |
| 再应用一次 JS 更新 | 1.4.0／104 | native-r3 | 1.4.2 |
| 发布包含新原生能力的 APK | 1.5.0／105 | native-r4 | 1.5.0（新 APK 内嵌） |

后两列的关系不是要求版本数字相等。bundleVersion 本期采用三个非负整数的稳定版本 `major.minor.patch`，依次按整数比较；不增加预发布或 build metadata 排序。发布选择不能使用字符串字典序或规则创建时间代替代码版本比较。规则选择与前置采用 §11.1，启动失败恢复采用 §19.4；技术接线仍 OPEN。

## 4. 版本定义在哪里

每个 `apps/terminal/application/android/<app>/package.json` 拥有本 application 的发布输入，与已有 terminalSurfaces、serverSpaces 的 application 输入位置一致。共享包只拥有解析／映射能力，不拥有某个产品的版本值。

候选示例（不修改现有文件）：

```json
{
  "version": "1.4.0",
  "terminalRelease": {
    "nativeBuildNumber": 104,
    "bundleVersion": "1.4.2",
    "runtimeVersion": "native-r3"
  }
}
```

- 顶层 version 作为 nativeVersion 的唯一发布输入。
- app config／Gradle 消费该输入，分别派生 expo.version、android.versionCode 和实际 APK 版本，禁止再手工保持三处相等。
- JS export 由同一 application 入口产生 bundleVersion 元数据及目标 runtimeVersion；APK 构建记录它内嵌的 bundleVersion。
- 更新工件记录该源声明的 runtimeVersion 字符串。
- 当前仓库维护原生 Android 工程，单改 app.json 不会自动改变所有 Gradle／manifest 入口；后续实施必须让这些真实入口消费该源，不以配置文件存在冒充接线完成。

本期采用较小的显式 runtimeVersion 字符串方案：RN／Hermes、原生模块、共享 application/base/android 或影响 JS 兼容的 adapter 输入变化时必须审查并更新标识；APK 构建号变化本身不要求改变兼容标识。接受手工漏改风险，通过发布审查核对本次原生差异，不新增全仓指纹生成工程或第五套版本。

Expo fingerprint 暂作为后续自动化候选，不是本期需求或实施前置。若以后采用，必须先证明它覆盖本仓实际原生输入且稳定，再替换唯一标识来源；不保留两套权威。[Expo runtime 策略说明](https://docs.expo.dev/eas-update/runtime-versions/)。

### 4.1 运行时读什么

必须区分“这次产物想发布什么”与“此设备现在实际运行什么”：

1. 已安装 nativeVersion／nativeBuildNumber 从 Android 安装包事实读取；不能从可 OTA 替换的 package.json import 推断。
2. 运行中的 bundleVersion 从当前已加载 JS 更新的元数据读取；不能把已下载／待应用包的版本提前写成当前版本。
3. runtimeVersion 从实际 native 兼容元数据取得，运行工件身份从实际加载描述取得；使用内嵌包时报告其身份，不编造某个未接入更新库的 updateId。
4. 上层通过 owner selector 消费版本事实，更新操作通过 owner command；adapter 的平台方法只是承接命令的技术边界。

现有激活 appVersion 的语义需要在正式需求中明确。当前它只有一个字符串，无法表达物理 APK 与运行 JS 的组合。本稿不擅自修改 TDC／CBS 契约；建议后续保留其现有兼容语义并评估独立的 nativeVersion、bundleVersion、runtimeVersion 事实，而不是让 OTA 悄悄改变它代表的含义。

## 5. Hermes 如何参与 JS 更新

Hermes 执行 JS／字节码；它不负责下载更新、校验发布、选包或回退。生产更新应理解为“下载新的 application bundle，随后让宿主重新创建／加载 JS Runtime”，不是开发期 Fast Refresh，也不是在运行中的全局对象上 eval 一份完整 App。

编译链的候选是 application 入口 → Metro／Expo export → 与目标 RN／Hermes 对应的 compiler → Hermes bytecode＋依赖资源。Expo 官方说明 export 能产生 Hermes 字节码；Hermes 字节码格式可能随引擎变化，因此 RN／Hermes 变化必须进入 runtimeVersion 边界。[Expo Hermes 文档](https://docs.expo.dev/guides/using-hermes/)。本轮仅确认本地 compiler 解析版本；目标 APK 实际 native Hermes 与 compiler 的对应仍待实施期解析和验证。

### 5.1 当前保留的候选：复用 Expo／RN 本地加载能力，由 update adapter 承接 ZIP

Dexter 已澄清：**ZIP 用于把更新描述与实际内容共同封装，供 CBS 解析与校验；TER 下载后可以解压实际内容，再调用对应更新方法。** 不要求更新库直接接受 ZIP。FULL 解出 APK 后交 installer；HOT 解出 bundle／bytecode、资源及加载所需元数据后交加载能力。§11.1 的唯一业务策略本身不排斥更新库；筛选依据是它能否消费实际内容、加载精确目标并服从自定义生效时机。

保留当前 Expo 57.0.18／RN 0.86.3／Hermes，不为更新更换应用框架。候选由 `adapter/android/update` 承接下载、解包、校验和本地加载；application/base/android 对接现有 Expo ReactHost，两 App 各自提供身份与发布输入。原生层只执行 owner 确定的目标和生效命令，不另行按 latest 选业务包。

当前 Expo factory 接受本地 bundle 路径，且提供 `ReactNativeHostHandler.getJSBundleFile` hook；RN 的 `JSBundleLoader.createFileLoader` 可从文件加载。它们是可复用的**源码能力**，不是本仓已经接好的更新器。Factory 缓存单一 ReactHost，不能靠重复调用 factory 并传入新路径来声称已换包；需在实际启动／重载链路读取当前已批准的本地加载描述，保留既有 Expo 生命周期和双屏 Host。[Expo 57.0.18 factory 源码](https://raw.githubusercontent.com/expo/expo/c3739f09b6a7620729ce7e305e88a2ec8bc79c3c/packages/expo/android/src/main/java/expo/modules/ExpoReactHostFactory.kt)、[同版 host hook](https://raw.githubusercontent.com/expo/expo/c3739f09b6a7620729ce7e305e88a2ec8bc79c3c/packages/expo-modules-core/android/src/main/java/expo/modules/core/interfaces/ReactNativeHostHandler.java)、[RN 0.86.3 file loader](https://raw.githubusercontent.com/facebook/react-native/v0.86.3/packages/react-native/ReactAndroid/src/main/java/com/facebook/react/bridge/JSBundleLoader.kt)。

最小候选链：

```text
§12 取得规则快照，owner 选定最新适用规则及其不可变 FULL／HOT 身份
→ 必要时完成 FULL，重启后回读 native／runtime，优先继续同一固定规则的 HOT
→ update adapter 下载指定 HOT ZIP，安全解包并校验全部文件
→ 记录待应用包，当前 active 包继续运行
→ owner 对 HOT 依据立即／M 时间无点击策略发送应用 command
→ 原生持久选择目标，在受控重启／reload 时加载它
→ 新 Runtime 及资源实际可用后，回读运行身份并完成任务
```

文件加载只解决 bundle 入口。图片／字体的路径映射、完整包发布与激活的原子性、冷启动选包、启动失败边界，以及新 Runtime 如何确认加载，均须后续验证。旧 HotUpdatePort 建议按 §17 替换为更新能力端口，marker 作为 adapter 内部实现细节；不得保留两套下载器、active marker 或恢复 owner。只做本功能所需的启动选包和失败恢复，不扩成通用更新框架，也不假定普通 JS 能挽救尚未成功启动的坏 bundle。

### 5.2 从当前候选中剔除的路径

| 路径 | 剔除原因 | 边界 |
| --- | --- | --- |
| 假定 expo-updates 直接导入 ZIP，或解压后直接传目录 | 已核验公开 API 没有对应入口；解压本身不会增加库的本地导入能力 | ZIP 原样输入并非需求；只剔除未经支持的调用方式，不凭这一点排除整个库 |
| 默认 check／fetch／reload latest，直接作为规则执行器 | 没有证明它始终加载该规则指定的精确 HOT，也未闭合下载后待闲时与冷启动缓存选择 | 禁止让库的发布时间／缓存选择覆盖 owner 的规则决定 |
| 私有 Expo update DB 导入、修改库内部选包状态 | 无当前可验证的公开接线依据，增加私有协议依赖与维护成本 | 不保留为“也许可行”的实现候选 |
| 运行中 eval 完整 App、逐 workspace 替换 | 不满足完整应用依赖与生命周期闭包 | 热更新仍是完整 JS＋资源，按策略重建 Runtime |

`expo-updates` 当前未安装。仅为审查候选，检查官方 `expo-updates@57.0.24` 发布源码；它不是仓内解析版本，也不是已选依赖。公开 fetch 从更新服务获取包，reload 不接收任意 ZIP 路径或目标 updateId。[候选版本公开 API](https://raw.githubusercontent.com/expo/expo/ad1efa3fa5802156660198ba5d787f91014d8df3/packages/expo-updates/src/Updates.ts)。其官方协议是 manifest＋assets，并有最新已保存更新的加载规则；可以自托管，但不能未经证明当作本需求的直接 ZIP 加载器。[Expo Updates v1 协议](https://docs.expo.dev/technical-specs/expo-updates-1/)。

此次澄清关闭 ZIP 用途问题。现有 Expo／RN 本地文件加载路径能承接解压后的入口文件，继续保留为技术候选；它仍需证明资源映射与启动接线。expo-updates 不因 ZIP 封装而被整体排除，但“解压后传目录即可更新”仍没有公开接口依据，因此暂不列为已闭合的本地加载候选。若后续核验其公开支持路径满足精确工件、资源及生效策略，可以再纳入；不得为选库擅自增加 CBS 的第二套分发协议、修改私有数据库或关闭保护措施。

## 6. JS／APK 各自的生效边界

- JS：可更新业务 TS/JS、UI、样式及受支持资源；无法增添 APK 未提供的原生模块、修改 Kotlin／Manifest／权限、替换 native Hermes。原生改动需要 APK。
- 单机双屏：共享同一 VM，不能让 LMP 与 LMS 各自运行不同 JS 包。重载时两屏的临时内存状态及 native surface 生命周期都需要考虑。
- 双机双屏：主副机是两个实际安装实例，各自有本地 APK／JS 版本。业务 slice 同步不代表软件更新。不得把主机版本直接同步后当成副机已升级；各机独立升级，协议不兼容时保护双机业务并保留 admin；共同执行逻辑见 §19。
- 更新不等于 root reset：不应为换 bundle 清凭证、服务配置或业务持久化。下载／重载接受、真实启动、成功恢复必须区分，重载后的 JS 代码不能依赖旧 Runtime 继续执行确认逻辑。本文“重启”暂指 TER 应用／JS Runtime，不主动推导重启 Android 操作系统。
- 回退不是无条件安全：新 JS 若已执行不兼容的持久化迁移，旧 JS 可能无法使用数据。原生启动保护不能被说成所有业务错误都自动回滚；未采用 expo-updates 时也不能声称继承了它的恢复能力。本期不建议新建通用恢复框架，正式需求需定义可回退的数据边界。
- APK：安装目标必须与现有 application 的包身份、系统兼容及签名关系一致，新发布使用更高 versionCode；普通安装不能假设可自动回装低 build 的旧 APK。[Android 版本规则](https://developer.android.com/studio/publish/versioning)、[Android 签名规则](https://developer.android.com/studio/publish/app-signing)。
- 自动下载与免确认安装是两项能力。系统 PackageInstaller 可能要求用户操作；具体是否免确认取决于系统版本、installer／自更新身份、权限和设备管理条件，当前未验证。[PackageInstaller.SessionParams](https://developer.android.com/reference/android/content/pm/PackageInstaller.SessionParams)。此事实不反对双更新需求，只要求将成功语义说清。

本轮已按 §9～§15 讨论 CBS 包管理、项目规则与分发；未确认的灰度、跨机升级协调及逐屏 UI 不提前扩张。也不把单一 runtimeVersion 扩成网络协议版本、持久化 schema 版本等万能兼容号。

## 7. 已收敛方向与待证明接线

1. **JS 生效策略（Dexter 已确认）**：更新逻辑由其自定义，可选立即重启或闲时重启。不在版本机制中绑定一种规则；版本及下载能力只报告适用性、待应用包与实际加载包，不自行判断业务是否空闲。最新 FULL／HOT 策略及 N／M 参数已在 §19 明确，技术接线留详设。
2. **runtimeVersion 来源**：本期采用 §4 的显式兼容标识；自动 fingerprint 不作前置。标识与实际原生输入一致、HOT 真正可加载仍需证明。
3. **APK 自动更新含义（本轮已明确）**：TER 自己判断需确认还是可静默安装，具体成功分支以系统 installer 结果为准，见 §13；不承诺无条件无人值守安装。
4. **对外版本上报（本轮已明确）**：连接 TDS 时上报所有版本信息，由 CBS 保存供两后台查看，见 §14；现有 appVersion 契约的保留／扩展方式尚未设计。

## 8. 未来最低验证边界（非本轮运行授权）

正式详设需覆盖：不同 application 拒绝；热更新要求的 native runtime 不匹配拒绝、完整更新可更换 runtime；完整资产下载／失败不改变 active；下载与真实加载版本分离；单机双屏一起重载；离线启动使用完整可用包；新包启动失败与数据回退边界；APK 系统确认／拒绝／成功身份回读；主副各自版本的真实读取。

纯版本映射和 command/selector 可在 Expo Web／focused 层验证；真实 Hermes bytecode 启动、native 更新选包与系统安装必须在安装的 application 上验证。Expo Web、Expo Go 或 Metro 开发 reload 不能证明这些 native 能力。

本轮证据：当前源码／配置／安装包解析及官方文档。全部新增更新能力、fingerprint 覆盖、APK installer 行为、双屏重载恢复、native 依赖解析及动态验收均为 `OPEN / NOT_RUN`。

## 9. 本轮整体流程原话与确认输入

以下是 Dexter 2026-10-04 本轮直接描述，按含义记录，不将候选字段伪装为裁决：

1. 开发人员从 application 打包，分三类：**安装包**为 APK，用于首次安装、应用商店等；**完整更新**与**热更新**为 ZIP，上传 CBS 用于下发。各 application 的 package.json 需提供完整打包脚本。
2. CBS 运维管理员通过 **platform-admin（运维管理后台）**管理更新包，按集团空间隔离。添加时上传 ZIP，系统自动识别完整／热更新及版本信息；内容合规则入库。
3. CBS 业务管理员通过 **operations-admin（运营管理后台）**，凭项目终端版本管理权限，按项目维护多条版本规则。规则包含适用门店、更新策略及更新包；最新裁决已移除原“用途／终端类型”维度，本期不定义或筛选该维度。FULL／HOT 策略以 §19 为准。
4. 项目规则通过 TDP 下发给当前项目所有终端。终端按门店、application／平台等排除不适用规则，不按用途／终端类型筛选，对适用规则按时间排序，需要更新时生成任务，执行下载、校验等动作。原话包含 runtime 筛选；按后续 §11.1 裁决，runtime 在选定规则后结合其最小完整包判断可达性，不能提前丢弃可经 FULL 达到的 HOT。
5. 完整更新时由 TER 判断是否需要用户确认或可静默安装。
6. TDC 连接 TDS 时上报所有版本信息到 CBS，以供运维／运营人员查看。
7. 保留前轮裁决：立即重启、闲时重启等由 Dexter 自定义更新策略控制，版本机制不固定一种生效规则。
8. Dexter 后续明确将“热更新包关联最小完整更新包；规则携带两者；TER 只取最新适用规则，按需先完整更新、成功后再热更新”作为唯一指定方案，不再列为候选，见 §11.1。
9. Dexter 澄清 ZIP 是供 CBS 将更新描述与实际内容共同解析校验的工件封装；TER 下载后可以解压出实际内容，再调用对应更新方法，不要求更新方法直接接受 ZIP。
10. Dexter 已确认主副机更新机制：主机经 TDP 获取规则并通过 state 同步到副机；副机复用 Runtime 常驻 state 订阅，通过 selector 读取规则变化，再发送本包 command 驱动本机更新任务。无需页面常驻，不新增轮询、事件总线或常驻服务，具体链路见 §12.2。
11. Dexter 确认本期采用企业分发／允许自更新的渠道；Google Play 不在本期范围。目标 Android 版本及设备管理环境仍需明确。
12. Dexter 确认本期禁止主动降级。管理员发布旧版本不能触发主动回退；坏包启动失败后的技术恢复与主动降级分开；后续接受的有限恢复见 §19.4。
13. Dexter 确认主副机独立升级；配对协议不兼容时阻断双机业务并保留 admin 恢复入口。不建设必须两机共同完成才生效的协调升级机制。
14. 2026-10-04 后续六项裁决：规则只能新建／启用／停用、按创建时间；FULL 后旧内嵌 JS 继续 HOT；FULL 立即＋N 提醒，HOT 立即或 M 时间无点击；下发 port 后固定执行、每次 JS 启动最多一条规则；主副通过本机 Runtime selector 使用统一逻辑。当时尚未确定的 HOT 恢复建议，后续接受为 §19.4 的有限启动保护。
15. Dexter 对前述两个具体边界确认：闲时判断采用简单方法，不为滚动／拖动／键盘等增加复杂识别；FULL 内嵌 JS 较旧且需要继续 HOT 时，规则须明确提供兼容目标 HOT，缺少则拒绝启用。点击采集方向后续按 §19.3 收敛。
16. Dexter 确认副机只是主机扩展，CBS／TDS 不知道副机存在，副机版本不需上报，删除作者的副机转报候选；同次关于“终端类型”的说法已由下一条更正取代。
17. Dexter 更正：此前不是指台式／手持两个设备类型；本期先移除“用途／终端类型”这一规则维度，待另行明确后再增加。也不以功能配置或机型候选代替该维度。
18. 2026-10-05，Dexter 接受其余收敛建议，并要求全稿复查是否有过度设计。产品方向与技术证据分开：四字段／发布单源、有限失败处理、Runtime／render 简单点击采集及启动失败恢复已接受；没有授权实现或运行。成本收缩及未决事实来源见 §20。
19. 同日，Dexter 确认 FULL／HOT 应当配对，并接受 CBS 校验规则声明的配对、TER 根据本机真实版本补充执行准入的分工。CBS 不需要取得副机版本或全体终端的实时版本，见 §20.3。

这扩展了讨论范围，不改变正在实施的 TDP 批次，不要求 Codex 中断、修改其批准范围或顺手新增这些能力。

## 10. 三类打包与更新包身份

### 10.1 建议的最小定义

| 类别 | 产物 | 候选内容 | 使用位置 | 确认状态 |
| --- | --- | --- | --- | --- |
| 安装包 | `.apk` | 完整 native＋内嵌 JS／资源 | 初次安装／分发渠道 | APK 与用途已确认 |
| 完整更新 | `.zip` | 更新清单＋完整签名 APK | 上传 CBS；下载解包后交 installer | Dexter 已确认“完整 APK＋更新清单” |
| 热更新 | `.zip` | 更新清单＋完整 JS／Hermes bytecode＋资源 | 上传 CBS；匹配已安装 runtime 后应用 | ZIP 已确认；具体库适配与资产布局待核验 |

建议完整更新复用安装包的同一个 APK 工件，再封装 ZIP；不分别重建两份内容可能不同的 APK。安装包虽主要用于初始化，系统并不会因其用途命名而禁止它升级已有同身份应用。

ZIP 是工件封装格式，更新执行输入是校验后的实际内容。CBS 校验描述与内容一致；TER 下载后同样校验并解包，FULL 把 APK 交系统安装，HOT 把 bundle／bytecode、资源及元数据交相应加载能力。不能因工件扩展名是 ZIP 而要求系统 installer 或 JS 更新 API 原生支持 ZIP。

这里“热更新”先指不替换原生 APK 的 JS 更新，不要求在运行中逐模块替换；按已确认策略重启加载。不将“热更新”解释为增量差分，初期建议输出自包含 JS 与资源。

### 10.2 打包脚本与清单

建议每个 application 的 package.json 公开三个能力脚本，例如 `package:installation`、`package:full-update`、`package:hot-update`（候选名，不是已存在命令）。共享打包逻辑复用仓内工具，App 只提供身份与 §4 的发布输入。当前两个 App 只有运行／lint／typecheck 等脚本，尚没有这三个发布入口。

ZIP 内建议有一个可机器读取的清单，最小表达：

- 清单格式版本、工件不可变身份、包类型 `FULL`／`HOT`；由此识别类型，不猜文件名。
- application 身份、平台；完整更新携带实际 APK 的 nativeVersion、nativeBuildNumber、目标 runtimeVersion、内嵌 bundleVersion。
- 热更新携带 bundleVersion、**要求的 runtimeVersion**、不可变工件身份及完整资产映射；不依赖某个尚未采用更新库的私有格式。
- 若热更新还要求具体 APK 版本／构建条件，清单应显式声明，不能要求 TER 从 JS 版本数字猜出依赖。如何用 runtime 与必要的 nativeBuildNumber 条件精确表达，在后续正式需求确定。
- 内容文件的路径、长度、摘要，以及必要的平台适用事实；时间只说明发布事实，不替代版本比较或完整性校验。

完整更新清单的 runtime 是**安装后的目标**；热更新清单的 runtime 是**当前原生环境必须满足的条件**，两者不能共用一个“必须等于当前 runtime”的过滤逻辑。

CBS 校验清单与 ZIP 正文、实际 APK 元数据一致，不能只信清单声明。ZIP 路径需禁止越界／符号链接逃逸；解包与资产校验须有技术资源边界。摘要用于校验字节一致性，不应被说成发布者身份认证。

### 10.3 CBS 包管理边界

集团空间由当前管理员已验证上下文决定，不由上传清单自报。同一开发工件可以在不同空间各自登记，但该空间的规则只能引用该空间内已验证可用的包。

候选存储分工：复用现有 asset 的对象存储及生命周期，增加具名更新 ZIP 上传能力；当前 `PlatformAssetService.java:1115-1165` 仅允许图像／mp4，不能声称 ZIP 已可直接上传。CBS 终端更新 owner 管理工件类型、解析版本、可用性和项目规则；模块形状留详设，不另建存储平台。已登记工件字节及身份不原位替换，新的内容作为新工件登记。

platform-admin 用自身管理身份／owner 授权；operations-admin 的规则写入使用项目范围 capability 和 owner 重核。这两套身份不能合并，也不能把“终端版本管理权限”顺手加成 GET 读取权限。新 capability 尚未加入当前 canonical IAM catalog。

## 11. 项目终端版本规则：建议补充的维度

项目与集团空间是规则归属。更新包关联、最新规则选择及前置执行采用 §11.1 已确认方案；其他未明确确认的补充字段仍标为建议，不能将整表一并视为裁决。

| 维度 | 建议 | 理由／边界 |
| --- | --- | --- |
| 门店范围 | 项目下全部门店，或指定门店 refs；一种明确模式 | 已确认需要门店条件；空列表不得含糊表示全选 |
| application／平台 | 必须匹配工件的 application identity 与平台 | 同一项目可能运行不同 App；不能只靠门店匹配 |
| 当前版本与依赖前提 | 热更新核对要求的 runtime 与已声明 APK 前提；完整更新核对 APK 身份、安装兼容和升级关系 | 完整更新允许换 runtime；当前未满足的热更新可能经完整更新后满足，不能提前丢掉 |
| 更新策略 | FULL 仅立即；HOT 立即或本机无点击 M 时间；FULL 未安装按 N 时间提醒 | N／M 是规则参数；立即不绕过系统确认，详见 §19 |
| 工件选择 | 完整更新规则引用一个完整包；热更新规则同时提供热更新包与其最小完整包身份 | 同空间、同 application／平台；版本取自包，不手填复制 |
| 规则生命周期 | 只能新建、启用、停用，不能编辑 | 内容改变必须新建规则，不增加独立发布／作废流程 |
| 时间 | 服务端创建时间用于优先选择 | 启停不改变创建时间；同时间稳定次序待详设明确 |
| 说明 | 管理员填写发布目的／变更说明 | 有助于解释更新；不另建优先级／灰度引擎 |

本期移除“用途／终端类型”规则维度，不新增该字段、控件、契约或匹配逻辑，也不按台式／手持或六类功能配置替代筛选。APK 的 ABI、最低系统要求、签名与 application 身份等仍作工件安装兼容检查，不属于新增业务筛选维度。

候选规则只引用真实组织与终端配置。服务器负责项目／空间隔离和工件可用性，终端负责用自己的真实运行事实筛选；不能以“终端会过滤”替代服务端越权防线。

### 11.1 更新规则与前置包的唯一指定方案（Dexter 已确认）

Dexter 明确反例：当前 **APK 1／JS 3**；一条完整更新规则目标 **APK 2／JS 4**；最新热更新规则目标 **JS 5，但依赖 APK 2**。不能只拿最新 JS 5 直接升级。此前作者“仅选最新一条，执行一个包”的建议已撤回，不作为已确认规则。

按这个反例，正确的执行依赖是：

```text
当前 APK 1／JS 3
→ 完整更新包：安装 APK 2，并加载其内嵌 JS 4
→ 重启后读回实际 APK／JS／runtime，恢复固定规则并核验其工件与执行身份
→ 热更新包：在所需 APK 2／runtime 已满足后加载 JS 5
→ 最终 APK 2／JS 5
```

Dexter 已指定唯一方案：管理员添加热更新包时指定其**最小完整更新包**；项目规则同时表达这个完整包与热更新包。TER 在范围匹配后只取最新适用规则，当前 APK 低于最小完整包时先完整更新，成功后再热更新。这里是“最小”，不是“最新完整包”。本条为已确认需求裁决，不再列为候选，不授权实施。

登记时由 CBS 核验最小完整包与热包属于同一 application／平台／空间，且完整包的目标 runtime 满足热包要求。关联固定到不可变完整包身份，不随着后来上传新完整包自动改变。项目规则选择热包时带出该关联，避免在两个管理面重复维护不同前置；下发规则同时携带两个包身份和必要元数据。

Dexter 已确认该配对校验使用 CBS 可得的静态工件事实；TER 在首次平台动作前用本机真实 APK／JS／runtime 补充准入，不要求 CBS 证明所有设备的当前版本。服务端配对不合规则拒绝登记／启用；配对合法但本机实际不兼容或会造成主动降级，则本机拒绝执行。具体边界见 §20.3。

一条规则自带前置与最终目标，TER 不从其他规则推断完整包路径。此前“跨多条规则寻找前置完整包”“所有适用规则按时间依次执行”及“仅取最新包而跳过前置”均不保留为执行方案。采用 **FULL → HOT** 两段，不引入通用依赖图或任意多跳更新框架；只有完整更新目标时执行 FULL 一段。

指定方案的执行判据如下：

| 当前设备 | 最新适用规则中的最小完整包／热包 | 处理 |
| --- | --- | --- |
| APK 1／JS 3 | APK 2／JS 4 ＋ HOT JS 5（runtime R2） | 完整更新到 APK 2，读回成功及 runtime 后，再应用 JS 5 |
| APK 2／JS 4，runtime R2 | 同上 | 跳过完整包，应用 JS 5 |
| APK 3，runtime 仍满足 R2 | 同上 | 若无其他已声明限制，跳过完整包，只判断 JS 是否需更新 |
| APK 3，runtime R3，不满足 R2 | 同上 | 不能应用 JS 5，也不自动降到 APK 2；报告不兼容，需要匹配 R3 的规则／包 |
| 已达到兼容的目标 JS | 同上 | 不重复应用同一个目标；本期禁止主动降级 |

**“达到最小 APK 版本”是必要前提，不足以独自证明热更新兼容。** native 版本比较使用同 application 的 nativeBuildNumber／Android versionCode；执行热更新还核对其要求的 runtimeVersion 与其他明确声明的原生条件，不能按 versionName 字符串或仅按数值大于最小值放行。高版本 APK 若更换了原生环境，不保证仍兼容旧热包。

先按项目／门店／application／平台等范围取得适用规则，再按服务端创建时间取最新一条；不得在此之前以“当前 runtime 不匹配”为由删掉可以通过该规则自带完整包满足前置的目标。当前高 APK 却不兼容、或关联完整包不可用时，报告明确原因，不暗中改选旧规则或回退。任何改变这一执行选择的需求须由 Dexter 另行明确裁决。

不默认让较窄门店规则压过较新全项目规则；若希望例外规则优先，需明确改变选择语义，不能隐含在范围大小中。

创建时间同值时需稳定且无歧义的处理；建议按不可变规则身份形成固定次序，具体规则留详设收敛，不先设计优先级体系。启用／停用不改变创建时间。

本期禁止通过新规则主动降低 APK 或 JS；HOT 启动失败采用 §19.4 的有限技术恢复。APK 升级关系由 nativeBuildNumber 判断；bundleVersion 按 §3 的数值三段比较，不能把新规则等同代码升级。普通 Android 安装受 versionCode 降级限制。[Android 官方版本规则](https://developer.android.com/studio/publish/versioning)。

规则排序解决的是**选哪个目标**，不是**代码版本大小**。新发布规则仍可能指向旧包；终端不能因此主动降级，须报告目标不适用或已达到目标的实际原因，具体状态在详设收敛。

完整更新还需约定安装后运行 JS 的目标：APK 内嵌 bundle 与该设备旧下载缓存可能同 runtime；不能未经判断让旧缓存覆盖新目标，也不能声称安装成功必然已运行清单内 JS。这是更新器选包／实际启动回读问题，不应增加第二套业务版本权威。

## 12. TDP → TER 规则与更新任务的候选链路

### 12.1 分发规则，不在 WebSocket 传 ZIP

建议复用 TDP B 的数据变化机制：新增项目规则 topic，ownerRef 为 projectRef；终端取得项目规则完整快照，后续变更通过 TDP 唤醒，再 HTTP 查询最新完整规则。初次／重连需核对当前快照，不能只等未来变更。这是候选新增 topic，不改动 Codex 当前 11 topic 的实施分母。

TDP 负责通知及身份路由，HTTP／既有资产能力负责规则正文与文件下载。这样仍实现“项目规则下发所有项目终端”的业务目标，同时不把大列表或 ZIP 硬塞入既有 65,536 字节单消息限制；规则多时的读取方式需保证快照完整，不能静默截断。

本功能适合声明目标规则的持久状态，不默认映射成一次在线远程 command：更新希望终端稍后重连也知道目标，而既有 TDP C 远程执行只接受在线、不离线补发。管理员临时触发一次运维动作若以后需要，再另行设计。

### 12.2 主副机与 owner（更新驱动机制已由 Dexter 确认）

候选：TER 更新 owner（位置待详设）负责规则、任务及 command／selector；Android update adapter 执行下载、实际版本读取、加载及系统安装技术动作。TDC 不解释门店／更新优先级，不持第二份更新业务状态；transport 也不承担这些业务。runtime 重建、平台回调和下载／安装结果进入 owner 的 command，读取状态只走 selector。

**已确认机制**：配对副机仍不能独立连接 TDS。主机通过 TDP 通知／HTTP 获取项目规则，经更新 owner command 应用到规则 state，再使用既有 topology state 同步投影到副机。两端各自按**本机真实 APK／JS／runtime**匹配并管理本机任务；同步的是规则，不把主机任务进度、active 包或主机版本当成副机的本地执行事实。

副机更新 owner 在模块安装阶段通过既有 Runtime `subscribeState` 常驻监听，通过 owner 公开 selector 读取同步规则和本机状态。selector 只做纯读，检测到相关变化后发送本包的更新任务重算 command，由 actor 复核并创建或继续本机任务；仅尚未下发 port 的候选可失效；订阅回调不直接写 slice，也不直接下载／安装。此机制随模块／Runtime 生命周期存在，不依赖 React 页面是否挂载；卸载时由既有资源管理退订。

```text
主机 TDP 通知 → HTTP 查询规则 → 更新 owner command 保存规则
→ topology 同步规则 state → 副机本地 store 应用投影
→ Runtime state 订阅通知 → selector 读取并比较相关输入
→ 副机更新 owner 的重算 command → actor 管理本机任务
→ 按本机 native／runtime 与规则执行 FULL → HOT 或所需单段
```

监听必须包括以下闭合点：

- **启动恢复**：先建立订阅，再检查一次已有 state；副机重启后已有持久规则也能进入任务复核，不只等待下一次同步。监听规则及其适用上下文、角色／配对状态和必要的本机版本；不能只监听规则正文而漏掉这些前提变化。
- **去重与并发复核**：比较相关输入，合并重复通知；actor 在首次下发 port 前重新读取 selector，核验规则来源、服务空间／项目、适用规则与本机版本，避免排队期间使用旧候选。已下发后改为核验固定工件及本机执行前提，不因角色／配对／规则变化替换目标。重复同步不重复创建同一目标任务，也不无限重试失败任务。
- **唯一写入边界**：主机规则为权威，副机不自行改规则；副机只通过自己的 command 写本机任务与执行结果。本机版本从实际安装／加载上下文读取，不能用同步来的主机凭证或版本推导。

静态复用依据：`kernel/base/runtime/src/foundations/createRuntimeLifecycle.ts:48-49` 将模块 state 订阅接到 store，`createStateSubscription.ts:12-13` 负责订阅及资源注册；`kernel/base/state/src/foundations/createStateRuntime.ts:256-263` 通过 store dispatch 应用同步投影；`kernel/feature/sample-member-registry/src/application/module.ts:63-118` 已有副机 selector 读取、command 驱动、启动检查与退订的实际用例。以上是当前源码依据，不是本专项更新功能的运行证明。

Dexter 已明确副机版本不向 CBS／TDS 上报，也不经主机转报；副机只是主机扩展，服务端没有副机对象。各机独立升级，协议不兼容时阻断双机业务、保留 admin；不协调完成，也不共享下载。主副采用同一本机判断逻辑，已下发 port 后固定执行，断链／解配对不换目标；未下发时核验规则来源。提醒／断链的具体呈现留后续设计。

主机同步的是本项目规则快照，不能先按主机自己的 application／版本过滤后才同步；副机需要依据本机事实独立选规则。项目／空间读取权限仍由服务端核验，“完整快照”不表示能取得其他项目的规则。

### 12.3 一台设备的任务边界

建议流程：

```text
主机激活／连接恢复，取得当前项目与配置事实
→ 主机取最新项目规则快照并订阅 TDP 规则变化
→ 主机自己处理；同步规则给已配对副机
→ 副机常驻监听规则 state，以 selector 读取并通过本包 command 复核；启动时也检查已有 state
→ 各机筛选范围规则并取最新一条；使用该规则携带的最小完整包与热包确定阶段
→ 持久化一个本机更新任务（规则身份、必要的完整包阶段、目标热更新阶段）
→ 固定并持久记录当前规则，再下发 port 下载／校验；FULL 立即提示安装，HOT 依据立即／M 时间无点击进入应用
→ 有必要完整阶段：installer 安装／等待确认，重启并读回实际 native／JS／runtime
→ 重启后优先恢复同一固定规则，核验身份和热更新前提，再执行其 HOT；不改选较新规则
→ 只有热更新或只有完整更新时，仅执行需要的阶段
→ 最终重启／加载后读取实际运行身份并完成任务
→ 本机记录实际执行结果；仅已激活终端（双机时为主机）经 TDC 报本机版本，副机不报 CBS／TDS
```

Dexter 定义 HOT 闲时为本机界面 M 时间没有点击动作，由统一点击事实与 selector 判断；不再增加业务忙闲条件。FULL 没有闲时策略，下载后立即提示安装，未安装按 N 提醒。下载、持久化及重启恢复边界见 §19。

候选可观察状态：下载中、校验中、待应用、等待用户安装确认、应用／安装中、成功、失败；这不是冻结的代码枚举。无适用规则或已经达到目标不产生空任务。

任务需在应用重启后可恢复，保存必要阶段与目标身份；前置失败不执行 HOT。“download 完成”“installer 接受”“reload 请求接受”均不等于真实目标运行成功。重复通知不重复建任务或无限重试。有限重试、终态失败释放及不提供手工重试按 §19.1/§21.1；不是常态恢复队列。

规则下发 port 前按最新启用规则选择；下发之后固定身份，停用或新规则不抢占。重启后只续接未终结的固定任务；已终态失败不再占用后继启动，但保留失败事实并禁止自动重试同一失败工件。取消激活／服务配置变化不授予越权下载；失效权限导致明确失败，不在同一启动暗换其他目标。

## 13. 完整更新：TER 判断静默或用户确认

FULL 只有立即策略：下载完成后提示安装，未安装按规则 N 提醒；实际安装是否需要系统确认仍由平台决定。HOT 才有立即／闲时策略。立即不表示绕过系统确认，也不要求安装后自动前台启动。

Android adapter 可根据系统 API、安装来源／自更新身份、权限等判断候选执行方式，但**最终以 PackageInstaller 的实际结果为准**；若返回 `STATUS_PENDING_USER_ACTION`，进入等待确认并展示系统提供的确认流程，而不是反复提交或报成功。拒绝、取消与失败需返回 owner 的可观察结果。自更新可能终止旧进程，启动后的任务回读不能依赖旧 JS 回调存活。

Android 官方明确存在无需用户操作的条件，且要求安装方始终准备处理用户确认分支。当前尚未实现或验证目标设备上的 installer 能力，不按品牌／是否 root 等粗略条件承诺静默。[PackageInstaller.SessionParams 官方依据](https://developer.android.com/reference/android/content/pm/PackageInstaller.SessionParams)。

## 14. 已激活终端本机版本的连接上报与后台查看

Dexter 已确认已激活终端的 TDC 连接 TDS 时向 CBS 上报本机完整版本。双机时仅主机上报；副机不连接 TDS，不上报也不由主机代报，CBS／TDS 不感知配对副机。建议在认证身份建立后的 ready 阶段提交事实，具体认证消息扩展或独立报告消息在详设选择；版本读取失败不默认使终端激活或 TDS 连接失败，需保留“未取得／未知”与原因。

最小实际运行报告建议包括 application identity、平台、nativeVersion、nativeBuildNumber、bundleVersion、runtimeVersion，以及可获得的实际更新工件身份。连接上下文关联 terminalRef、deviceId、当前 binding generation；服务端记录收到时间，不拿客户端时钟作为“最新在线报告”的唯一依据。具体 API／存储 owner 待详设；CBS 业务事实仍由 CBS owner 写 PostgreSQL，不把版本事实塞进仅承载连接历史的 Doris。

版本的唯一终端事实来自 native／实际 JS 加载上下文；更新 owner 通过 selector 供 TDC 组装报告。TDC 不用激活时 appVersion、同步主机版本或“待下载目标版本”充当当前运行版本。

副机只在本地读取 APK／JS／runtime 事实用于自己的更新判断与恢复，不建立服务端登记、配对委托认证、版本报告、主机转报或服务端副机库存。主机仅报告自己的实际版本，不能把副机版本混入主机报告。主副协议兼容与断链保护仍由既有本地 topology 能力判断。

连接时及主机实际更新成功后刷新主机本机事实，副机完成后仅记录本地事实。本期后台只查看最后上报的主机实际版本及时间，不展示任务进度、不扩展远程硬件证明。离线时最后报告不保证设备此刻仍是该版本。

platform-admin 按空间查看，operations-admin 按当前项目可读范围查看；保留两套授权边界，项目规则写 capability 不自动成为版本 GET 的 read capability。本期不新增永久版本流水／任务审计模块；既有必要日志和安全审计不因此移除。

## 15. 当前确认状态与证据边界

| 项目 | 本轮状态 |
| --- | --- |
| 三类产物、两后台职责、集团空间隔离、项目多规则、TDP 分发、完整版本上报 | Dexter 已明确需求输入 |
| FULL 立即＋N 提醒；HOT 立即或无点击 M 后重启 | Dexter 已明确；本机点击统计与 state 恢复能力仍需实现／验证 |
| 完整更新 ZIP＝完整 APK＋清单 | Dexter 已确认 |
| APK 1／JS 3 → 完整 APK 2／JS 4 → 依赖 APK 2 的 JS 5 | Dexter 已明确必须考虑前置；不得直接执行最新 JS 包 |
| 热包关联最小完整包，规则携带两者、取最新适用规则后按需 FULL → HOT | Dexter 已明确为唯一指定方案；不再保留候选或跨规则依赖方案 |
| 新建／启用／停用、不可编辑，以创建时间排序 | Dexter 已确认；同时间稳定次序留详设 |
| 更新规则的用途／终端类型 | Dexter 已明确本期移除，待以后明确需求再增加；不再保留字段确认或多用途匹配待决项 |
| 主机取得规则并同步；副机常驻订阅／selector／command 驱动本机任务 | Dexter 已确认；复用 Runtime 与 topology，各机读取自己的真实版本，见 §12.2 |
| 主副统一用本机 Runtime selector 判断；下发后固定执行 | Dexter 已确认各机独立；副机版本仅本地使用，不报服务端，不把断链当作换规则理由 |
| 直接 ZIP 更新的技术路径 | 保留 Expo／RN／Hermes＋Android 本地加载候选；expo-updates 直接 ZIP 导入与默认 latest 路径已剔除，见 §5 |
| ZIP 用途及终端消费方式 | Dexter 已确认：描述＋内容一起封装供 CBS 校验；TER 下载后可解包，再调用对应更新方法；不要求库直接接收 ZIP |
| 当前 TDP 认证只有 appVersion，尚无本稿四字段报告与更新 topic | 静态契约事实；当前 TDP 正在实施，源码快照不作其完成结论 |
| CBS 上传解析／权限／规则、TER 打包／下载／安装／恢复／版本报告 | 尚未实施，全部 NOT_RUN |

本轮已撤回“优先 expo-updates，不行再自研”的未经闭合建议。当前保留候选先复用仓内已存在框架的本地文件加载入口，新增范围限定在更新所需的平台接线；具体端到端能力仍为 OPEN。§16 记录保留项及其证据，不将源码 API 的存在写成热更新成功。

技术筛选不得把“无 ZIP 导入 API”扩大成“无法实现本需求”：需继续核对解压后的实际内容能否由公开支持的接口加载。对于 expo-updates，目前未证明本地内容导入路径；对整个库的结论是未闭合，不能仅因封装格式断言不兼容。

本轮只读现有仓内材料、核对官方资料并修订本讨论稿。没有生成、安装依赖、编译、测试、verify、DEV、reset／seed、设备或后台动态运行，没有联系正在实施的 Codex。后续正式需求、Journey／IA、详设、实施范围和动态执行面须另行明确。

## 16. 唯一方案下保留的技术候选与前提

| 能力 | 保留候选 | 必须满足的前提／尚未证明事项 |
| --- | --- | --- |
| 安装包与 FULL 打包 | 当前 Expo／Gradle Android 构建链；FULL 复用同一个签名 APK 后封 ZIP | 实际三脚本、清单派生与工件一致性尚未实现 |
| HOT 构建 | 当前 Metro／Expo export＋对应 Hermes compiler，完整 JS／bytecode＋资源 ZIP | 必须与实际 APK 的 native Hermes 配对；不能仅看 compiler 包版本 |
| HOT 本地加载 | 当前 Expo host hook／RN file loader＋Android update adapter | 精确选择工件、资源映射、冷启动及重载接线待证明；只传路径或调用 reload 不构成闭环 |
| 解包／摘要 | Android／JVM 标准 ZIP 与摘要能力，构建侧优先复用现有打包能力 | 路径、解压资源边界与全部文件校验仍需实现；无需先添加一个通用更新 SDK |
| FULL 安装 | Android PackageInstaller | 同 application、兼容签名和 versionCode；处理系统确认、拒绝及重启回读，不保证所有设备静默 |
| runtime 兼容标识 | 本期显式手工 runtime 标识 | 核对实际原生输入；自动 fingerprint 后移，不将 native build ≥ 最小值当成兼容证明 |
| 规则与任务 | 现有 owner command／selector、持久化能力、TDP 通知＋HTTP 数据／资产读取 | 一条规则的 FULL→HOT、重启续接；不加跨规则依赖图或第二版本事实源 |

标准 ZIP 的 API 依据见 [Android ZipInputStream](https://developer.android.com/reference/java/util/zip/ZipInputStream)；系统安装依据见 [Android PackageInstaller](https://developer.android.com/reference/android/content/pm/PackageInstaller)。它们提供技术原语，不提供业务选包、任务恢复或完整性策略。

版本依据：仓内已解析 `expo@57.0.18`、`react-native@0.86.3`、`hermes-compiler@250829098.0.17`；Expo 57.0.18 官方 npm 发布元数据对应 gitHead `c3739f09b6a7620729ce7e305e88a2ec8bc79c3c`，§5 链接核对这个提交而非默认分支。候选 expo-updates 57.0.24 对应 `ad1efa3fa5802156660198ba5d787f91014d8df3`，只用于核验其公开接口并剔除未经支持的路线，不代表装入依赖图。实际 native Hermes／更新 adapter／installer／资源加载均未运行，本轮结论仅为候选筛选。

## 17. 旧 HotUpdatePort 如何适配当前流程（能力建议，不冻结接口）

### 17.1 当前缺口与最小调整方向

当前 `kernel/base/platform-ports/src/types/hotUpdate.ts:57-64` 的七个方法，只表达下载和 boot／active／rollback marker 的读写。缺少 FULL 的平台安装、实际 APK／runtime 读取及安装观察；下载输入没有明确 FULL／HOT 和 application／runtime 身份。`confirmLoadComplete` 仅收 timeout，没有当前加载目标与启动身份，不能明确关联一次确认。`resetRequestId` 把旧 marker 与 Runtime reset 联系起来，不应据此把更新等同业务 root reset。

源码搜索未发现生产 owner 调用这些旧更新方法；生产接线仍为 Android／Web 的 unavailableHotUpdatePort，其他命中主要是装配、导出、默认实现和测试。因此应基于当前需求替换旧定义，不为没有落地的旧流程长期保留兼容层。这里建议能力名称 **`UpdatePort`**、平台键 **`update`**，统一承接 FULL／HOT 的更新平台动作；具体方法及类型名留待正式详设，不在本讨论稿修改源码。

### 17.2 owner 与平台端口的职责

| 归属 | 保有的事实／逻辑 |
| --- | --- |
| 更新 owner | 规则 state、最新适用规则选择、FULL→HOT 阶段、本机任务持久化、FULL 安装提醒、HOT 立即／无点击判定、首次下发准入与固定任务续接、业务失败处理及版本报告触发 |
| UpdatePort／Android adapter | 实际安装与加载身份读取、指定工件下载／校验／解包、原生持久选包、受控 HOT 加载、FULL 系统安装及技术观察 |
| adapter 内部启动记录 | 在 JS 启动前必须可读的目标工件／入口、启动身份、加载确认与必要失败记录；不是另一套规则、任务或业务状态 |

两类持久信息各有作用：owner 保存“这条规则当前做到哪一阶段”，原生保存“下一次应加载哪个已校验入口及这次实际加载什么”。重启后 owner 用平台事实复核自己的任务，不能用任务目标充当实际版本。副机使用相同端口作用于本机；主机同步规则，不同步原生入口路径、prepared handle 或本机执行状态。

### 17.3 建议公开的最小能力

| 候选能力名 | 输入／输出含义 | 成功边界 |
| --- | --- | --- |
| `readSnapshot` | 读本机实际 application、nativeVersion／build、runtime、运行 bundle／工件，以及与当前平台应用动作关联的必要技术状态 | 只报告实际安装／加载事实；未知明确标出。包含恢复任务所需的观察，不复制整个 owner 任务 |
| `preparePackage` | 输入单个已选工件的下载地址、身份、FULL／HOT 类型、长度／摘要及期望清单；完成下载、校验、解包，返回带身份的 prepared handle／验证元数据 | 全部实际内容校验完成才成功；不改 active，不自行取 latest，不在 HOT 准备阶段提前认定 FULL 前置已满足 |
| `applyHotUpdate` | 输入已准备 HOT 的 handle、工件身份与本次平台操作身份；核验实际 application／runtime，持久选包并触发受控重载 | 通常先 accepted；真实后继 Runtime 加载目标才构成任务成功，不再额外调用另一套更新重启接口 |
| `installFullUpdate` | 输入已准备 FULL 的 handle、工件身份与操作身份；核验 APK，交系统 installer 并处理确认分支 | 受理、等待用户操作、安装完成与目标运行均须区分。owner 启动后回读成功，才继续 HOT |
| `confirmHotUpdateLoad` | 新 Runtime 完成约定初始化后，携带操作身份、工件身份和平台提供的本次启动身份确认 | 只能确认本次实际加载目标；旧 Runtime 或迟到确认不能确认另一个包。不等同全部业务／长期健康通过 |
| `discardPreparedPackage` | 释放指定操作拥有且不再使用的下载／解包资源；仍在准备时须受控停止并清理，具体取消形状待详设 | 不删 active／正在启动引用的内容，不承诺撤回已提交的系统安装；清理失败可观察 |
| `subscribeObservations`／`unsubscribeObservations` | 订阅平台安装确认、失败／完成及必要加载技术观察，仅回传只读身份与数据 | 模块 install 建桥，把观察翻译为本包 command；退订归 Runtime 资源生命周期，不向业务回调传写能力 |

prepared handle 指向 adapter 已验证且持久可定位的内容；owner 不传任意目录／entryFile 让平台直接执行，后续每次应用仍核对 handle 与清单、文件身份。FULL 与 HOT 清单的 runtime 含义遵循 §10.2：FULL 是目标 runtime，可以不同于当前 runtime；HOT 应用时必须兼容实际已安装 runtime。

沿用现有 `PortResult`／`PortActionResult` 的 succeeded／accepted／failed／timed-out／unavailable 语义，不为更新另建一套结果协议。回调是 adapter 到本包 command 的技术桥，业务指令仍由 command 发送，跨包读取只用 selector。readSnapshot 是 owner 向平台回读事实，不成为其他 feature 绕过 selector 的读取入口。

动作身份沿用本机任务已有身份，并关联当前阶段、不可变工件与平台启动／安装动作；避免新增平行任务账本。观察应先订阅再发动作，模块启动及从系统确认界面返回时回读 snapshot，覆盖旧 Runtime 已退出而未收到回调的情况；不增加常态轮询。端口超时表示该调用没有及时得到结论，不保证系统安装已取消，owner 必须依据观察／回读判断，不能因此盲目重复提交。

### 17.4 旧定义的处置与复用边界

| 旧公开面 | 建议处置 |
| --- | --- |
| `downloadPackage` | 改为 FULL／HOT 共用的 `preparePackage`；把实际清单、资源校验与解包成功边界明确 |
| `writeBootMarker`／`clearBootMarker` | 不再对 owner 暴露 marker 写法，由 HOT 应用及原生启动选择内部管理 |
| `readBootMarker`／`readActiveMarker`／`readRollbackMarker` | 收敛为实际运行／平台动作 snapshot；底层是否用 marker 文件、库存储或其他具名技术记录由已核验方案决定 |
| `confirmLoadComplete` | 改为带实际工件与启动身份的 `confirmHotUpdateLoad`，禁止无目标确认 |
| `maxLaunchFailures`／`healthCheckTimeoutMs` | 不让普通调用任意指定恢复框架策略；所需最小启动保护和数据回退边界在正式需求／详设明确，当前不冻结默认次数／期限 |
| `resetRequestId` | 更新动作按任务／工件／启动身份关联，不借 root reset 清凭证或业务数据；普通 appControl 的 Runtime 重载能力仍独立保留 |

`AppControlPort.resetRuntime` 已有普通 Runtime 控制消费者，不删除、不把其所有调用改成更新。HOT 的原生实现可复用实际重载能力，但对外应用流程由 UpdatePort 统一完成“选定目标＋重载”，避免业务层依次写 marker／调用 reset 造成中间态。平台事件桥复用现有只读订阅→command 模式，不增加事件总线。

后续实施应一并修改 platform-ports 的类型／显式导出、PlatformPorts 与 bindings 键、PlatformPortName、不可用默认与 descriptor、factory、README、terminal-invariants、Android／Web 装配及现有测试替身。搜索结果中的旧 method／hotUpdate key 全部需闭合；不能仅改接口名而保留遗漏的默认方法或假装 adapter 已可用。Web 对原生能力明确 unavailable；Web 可以验证 owner 流程，不能据此证明实际 APK／Hermes 更新。

§17 只是与已确认流程匹配的能力建议。尚未修改任何端口／adapter／测试源码，未运行构建或更新。接口最终数量、技术观察类型和原生接线须依据选定技术的实际公开能力在详设收敛，避免先冻结无法实现的承诺。

## 18. 闭包复查：尚需讨论与官方证据（2026-10-04）

### 18.1 当前结论与已闭合范围

**核心产品方向已收敛，技术端到端可行性尚未证明。** 本节按 2026-10-05 接受收敛建议及 FULL／HOT 配对裁决更新状态：产品已确认不等于技术已通过。D-04 的两端校验分工已确认，见 §20.3；目标 Android 验收环境仍须在实施授权时明确。

下面 D 项区分已确认方向和残余问题，E 项记录技术依据及验证工作。历史官方资料核查不替代本仓运行证明；没有实施或动态运行授权。

### 18.2 已确认方向与残余输入

| 编号 | 问题／具体反例及确认状态 | 已确认规则或最小建议（未确认部分不作裁决） |
| --- | --- | --- |
| D-01（部分已确认） | Dexter 已确认企业分发／允许自更新渠道，Google Play 不在本期范围；目标 Android／设备管理环境尚未明确 | 列出目标 Android 环境，不宣称一套 APK 更新行为适用于所有商店或设备 |
| D-02（已确认） | 四版本字段、application package.json 单源及禁止主动降级 | bundleVersion 数值三段比较，本期显式 runtime 标识；fingerprint 后移。运行事实读取仍 OPEN |
| D-03（已确认主体） | 规则只能新建／启用／停用、不能编辑，按创建时间；用途／终端类型维度已移除 | 只从启用规则中选择；同时间固定次序留详设，不新增用途枚举／匹配模型。已下发 port 的规则不因停用而中止 |
| D-04（已确认） | FULL／HOT 配对；需要续接却缺兼容 HOT 则拒绝启用 | CBS 校验声明的静态配对，TER 用本机真实版本核验兼容／禁止降级；不获取副机版本或盘点全体设备。完整任务不能仅凭 APK 安装完成判成功 |
| D-05（已确认） | FULL 立即＋N 提醒；HOT 立即／无点击 M 重启 | Runtime 保存本机点击事实，render 统一采集；具体 handler、单位和提示留详设，不新增后台提醒服务 |
| D-06（已确认） | 固定执行、每次 JS 启动最多一条规则；有限失败处理 | 未终结时续接原规则；终态失败释放后继启动，同工件不自动重试，见 §19.1 |
| D-07（已确认执行边界） | 主副机统一通过本机 Runtime selector 判断升级，各自独立；已下发 port 的任务固定执行 | 断链不改选已固定目标，不新增双机协调；实际缺文件／权限时仍明确失败。协议不兼容保护已确认，不用 runtimeVersion 冒充网络协议版本 |
| D-08（已确认方向） | 最小原生启动保护、兼容旧目标有限恢复 | 只覆盖本次启动失败窗口及所影响的持久字段；具体原生接线及 T 仍 OPEN，不做全量 state 快照或历史兼容矩阵 |
| D-09（已确认） | 副机不报版本；主机连接及更新成功刷新本机报告 | 后台仅最后报告，不扩展任务进度／永久流水；复用空间／项目读取授权，不增加与规则写 capability 对称的读取权限 |

发布者身份与工件完整性边界：APK 使用兼容签名，HOT 使用经 CBS 授权通路取得、绑定不可变工件的期望摘要；ZIP 自带摘要不能自证来源。本期不新增 HOT 发布签名／PKI／审批平台；实际授权下载、完整内容校验及安装验签仍需证明。

### 18.3 已取得的官方依据与残余证据

| 编号 | 本轮已取得的依据 | 不能据此证明的事项／下一步 |
| --- | --- | --- |
| E-01 渠道 | Google Play 官方政策明确 Play 分发应用不能通过 Play 以外机制自更新；VM／解释执行代码另有规则 | Dexter 已排除本期 Google Play 渠道，该政策不构成本期阻断，也不是 Android PackageInstaller 的技术禁用；其他实际分发渠道仍按其条件判断 |
| E-02 安装 | Android `SessionParams.setRequireUserAction` 给出免确认条件并要求处理 `STATUS_PENDING_USER_ACTION`；自更新身份是条件之一，不是唯一条件 | 目标设备是否满足、权限／安装来源／targetSdk 及 OEM 结果待验证。当前 App 源 manifest 未见该更新权限与接收链，不能报现有 App 已能安装 |
| E-03 安装后启动 | `ACTION_MY_PACKAGE_REPLACED` 可收到自身替换通知；Android 限制后台启动 Activity | 不承诺自动拉起。Dexter 已接受必要时用户手动启动，再续接同一规则；实现须证明下次启动读回，而非为自动拉起引入设备管理服务 |
| E-04 本地加载与资源 | §5 的精确版本 Expo／RN 文件加载入口成立；本轮新增核对 `expo-asset@57.0.15` 的官方源码，发现其 localAssets 映射来自 ExpoUpdates native module，未启用时不能假定该映射自动存在 | 不代表离开 expo-updates 就无法加载资源。须证明所选本地加载路线的 require 图片、字体与其他实际资源寻址，特别是离线启动；不可只测无资源 hello bundle 就宣称整 application 可更新 |
| E-05 fingerprint（后移） | 当前解析 `@expo/fingerprint@0.20.11`，gitHead 为 `c3739f09b6a7620729ce7e305e88a2ec8bc79c3c`；源码有 bare／autolinking／extraSources 输入 | 本期不用自动 fingerprint；覆盖及稳定性仍 OPEN，不作需求前置。显式标识仍须核对实际原生兼容变化 |
| E-06 Hermes | 官方说明 bytecode 与 Hermes 版本相关，RN／Hermes 变化须进入兼容边界；本地 compiler 已读到版本 | 实际 Gradle 选中的 native Hermes 未解析、目标 APK 未证明能执行生成字节码。后续只对具体配对版本验证，不凭 npm compiler 包号充当 engine 号 |
| E-07 APK 工件检查 | 官方 apksigner 支持验签与证书读取；系统升级依赖签名／包身份及版本关系 | CBS 需要复用实际工具／库解析 APK 并核对清单、签名、平台输入；SDK 工具实际解析版本、服务端可用性与 ZIP 故障边界未核验，不自己发明 APK 验签器 |
| E-08 持久化／资源及网络 | state／Runtime／topology、现有网络配置／代理和对象存储生命周期可复用；§17 区分任务与原生加载事实 | 当前 `TerminalNetworkModule.kt:173-186` 将限长响应读为 UTF-8 文本，不能直接下载 APK／ZIP。需复用网络底座增加流式文件能力，并核验磁盘／解包边界、URL 到期及中断；不另建网络配置、下载平台或持久请求队列 |

官方一手出处：

- E-01：[Google Play Device and Network Abuse](https://support.google.com/googleplay/android-developer/answer/16559646?hl=en)。这是已确认的渠道限制，不是对未指定渠道的泛化合规要求。
- E-02：[Android SessionParams 安装确认规则](https://developer.android.com/reference/android/content/pm/PackageInstaller.SessionParams#setRequireUserAction(int))。目标 API／实际设备未知，不把参考页所有条件原样当作本仓已满足。
- E-03：[Android 自身替换广播](https://developer.android.com/reference/android/content/Intent#ACTION_MY_PACKAGE_REPLACED)、[后台 Activity 启动限制](https://developer.android.com/guide/components/activities/secure-bal)。广播和启动限制分别核验，不承诺自动前台恢复。
- E-04：[expo-asset 57.0.15 LocalAssets](https://raw.githubusercontent.com/expo/expo/c300d2cc60c9e684e64f48d9bc90ea18a571d01d/packages/expo-asset/src/LocalAssets.ts)、[同版 PlatformUtils](https://raw.githubusercontent.com/expo/expo/c300d2cc60c9e684e64f48d9bc90ea18a571d01d/packages/expo-asset/src/PlatformUtils.ts)。已与安装包源码及 gitHead 对照；这只说明映射来源，不证明候选路线不可能。
- E-05：[fingerprint 0.20.11 bare 输入](https://raw.githubusercontent.com/expo/expo/c3739f09b6a7620729ce7e305e88a2ec8bc79c3c/packages/@expo/fingerprint/src/sourcer/Bare.ts)、[配置／默认忽略规则](https://raw.githubusercontent.com/expo/expo/c3739f09b6a7620729ce7e305e88a2ec8bc79c3c/packages/@expo/fingerprint/src/Options.ts)、[extraSources 等类型](https://raw.githubusercontent.com/expo/expo/c3739f09b6a7620729ce7e305e88a2ec8bc79c3c/packages/@expo/fingerprint/src/Fingerprint.types.ts)。SDK 页面只作导航，精确版本依据使用这组提交源码。
- E-06：[Expo Hermes 官方说明](https://docs.expo.dev/guides/using-hermes/)。通用 bytecode 兼容说明不能替代 Gradle native artifact 的实际解析。
- E-07：[Android apksigner 官方工具](https://developer.android.com/tools/apksigner)、[应用签名与升级关系](https://developer.android.com/studio/publish/app-signing)。本轮没有调用工具或验签 APK。

### 18.4 不需扩大产品范围即可补齐的闭合要求

1. **先有更新原生基线**：当前 App 注入 unavailableHotUpdatePort，旧 APK 没有凭空获得 installer／本地启动选择的能力。首个可管理版本必须包含实际 native update 接线；已有旧 APK 至少经一次外部分发／安装升级到该基线，不能靠 HOT 给旧 APK 新增原生方法。
2. **初始化与订阅不留空窗**：复用 TDP 已接受的首次 HTTP→应用／持久化→登记本地 topic 时间→服务端差异核对，以及具体通知接受确认。快照读取到登记之间的变化必须由该核对闭合，不能擅自改成“只等广播”，也不必为它新建事件缓存。实际新规则 topic 仍需在后续批准范围设计；TDP 原始时间同值及离线通知限制仍存在，不能宣称规则投递有超出 TDP 的保证。
3. **同一工件全链身份**：上传校验、规则引用、下载、prepared handle、平台动作、后继 Runtime 和报告关联同一不可变目标。签名 URL 过期可重新取得该工件的下载输入；不因重试转成另一个最新包。
4. **FULL 成功与最终成功分开**：FULL 已成功但 HOT 失败，报告实际 APK／当前 JS及未完成阶段；不回填成旧 APK，也不报完整目标成功。内嵌 JS 比原 HOT 旧时继续 HOT 已确认；需要续接却缺少兼容 HOT 的规则按 D-04 拒绝启用。
5. **两机及两屏边界**：主机投影完整项目规则、各机统一用本机 Runtime selector 独立筛选和执行；单机双屏共享 Host 只更新一次。主副错开协议不兼容时保护双机业务并保留 admin，不新增多个 runtime 或把同步 state 当成软件复制。
6. **有限验证，不以网上证据冒充通过**：后续详设至少包含纯版本／规则与任务的 Web 验证，以及有资源 HOT 离线启动、错误 runtime 拒绝、实际 FULL 安装确认／拒绝／成功与重启续接、进程中断恢复、旧确认隔离、双屏及主副错开反例。实际 adapter 行为必须在安装 application 的 Android 环境证明；目前所有这些项目为 NOT_RUN。

前轮取得官方资料；本轮重开全文、来源及独立成本审查，仅主 agent 修订文档。没有运行更新器、生成、构建、测试、verify、DEV 或设备环境，没有联系 Codex。产品残余与技术 OPEN 分开，不把未知项变成新增机制。


## 19. 六项最新裁决与有限恢复建议（2026-10-04）

§19 汇总已确认裁决及 2026-10-05 接受的收敛建议，覆盖旧的“编辑／发布时间”“FULL 闲时”“下载中切换规则”“双机协调”表述。回退与点击采集方向已接受，技术接线和运行证据仍 OPEN。

### 19.1 规则选择、固定执行与跨启动续接（Dexter 已确认）

1. 规则只能新建、启用和停用，不可编辑；以服务端创建时间排序。更改范围、包或 N／M 要新建规则，不改变旧规则内容或排序。尚未下发 port 时从启用的适用规则选择最新一条。
2. 规则一旦下发 port 就执行到底；不能因新规则、旧规则停用、配对断链而换目标。owner 在首次准备前先成功持久化规则快照、FULL／HOT 工件身份与必要参数，再调用 port；失败则不下发。固定指完整规则，不是仅当前 ZIP。
3. 每次 JS 启动最多执行一条规则；不是每个页面、Surface、模块 install 或角色变化各有一个名额。一次规则可以跨 FULL 与 HOT 两次 JS 启动，不把两段算成两个不同规则；首次 FULL 后，下一启动优先续接其 HOT，不改选最新规则。
4. 执行更新后都要重启：FULL 为安装后的新应用启动（可由用户手动启动）；HOT 为受控 JS 重启。同一启动不能完成一个规则后继续执行另一规则；后继启动读回／报告已完成事实后，才允许新规则进入执行。
5. 更新依据统一来自本机 Runtime selector，不由主／副身份决定另一套更新流程。主机从 TDP 获取规则，副机从同步 state 取得规则；之后共享相同判断逻辑，各自使用本机真实版本、本机点击事实和本机任务。单机双屏共用一个 JS 启动与一个执行名额。
6. “执行到底”表示任务未终结时不切换固定目标，不表示忽略失败或无限重试。仅暂时读取／下载故障做有限重试，次数／期限留详设；校验不通过、明确安装失败、重试耗尽或 HOT 已回退则保留准确原因并进入失败终态。不能把结果未知当明确失败，也不能重复提交仍在进行的 installer。
7. 失败终态解除后继启动的执行占用：同一 JS 启动不改选另一条规则；下一次启动可选择新的适用规则。失败的规则／工件不因广播或启停自动再试；发布不同修复工件可进入新任务。Dexter 2026-10-05 确认本期不增加手工重试能力，取代此前人工诊断后显式重试的候选承诺；不提供失败工件重试/清除失败标记入口，不新增恢复队列、任务看板或自动重启循环。
8. FULL 等用户安装／手动启动、HOT 等 M 无点击仍是等待态，不能以“更新慢”宣告失败让新规则抢占。待安装提醒仅在应用可呈现时执行，后台／系统确认界面不重复弹窗；回到应用核对状态与提醒期限，不增加后台闹钟或常驻服务。

示例：启动 S1 选择规则 R（FULL APK2＋HOT JS5）并固定 → 安装 APK2 → 用户启动 S2 → 恢复 R 并应用 JS5 → JS 重启 S3 → 确认实际 JS5、报告 R 完成 → 若有新的适用规则，再选择。S2 不能被刚出现的新规则抢占。

### 19.2 FULL、HOT 与 N／M（Dexter 已确认）

- **FULL**：只有立即更新，不提供闲时选项。下载／校验完成后弹窗提示用户安装；未安装每 N 时间再次提醒。实际交系统安装并观察结果，不重复提交正在处理的安装会话；待用户手动启动也不能假报后续 HOT 已执行。N 是规则参数，明确单位及正数校验留正式需求／详设。
- **HOT**：下载／校验完成后，立即策略就是立即重启 JS；闲时策略就是本机界面连续 M 时间无点击后重启。M 是规则参数，不追加“订单为空／店员登出／业务无请求”等未经裁决的闲时条件。下载前等待不算应用成功。
- **FULL→HOT**：APK 安装后内嵌 JS 比原 HOT 旧，应继续 HOT。HOT 必须兼容安装后的实际 runtime；不能盲目加载旧 native runtime 的缓存。Dexter 已确认：需要该续接的规则须明确携带兼容目标 HOT，而非搜索另一条规则；没有兼容目标 HOT 则拒绝启用。后续设计明确比较与校验输入，不把尚未实现的校验写成当前能力。
- **state 恢复**：接受 UI／业务基于 state 恢复的产品目标，但 state 不等于全部自动持久化。现有 `ui-state` 区分 durable／ephemeral，`state` 按字段配置持久化；React useState、正在执行的 request／Promise、原生回调不因 store 存在而保留。更新任务必须持久化，重启前调用既有 flush 并读取结果；需要恢复的 UI／业务字段由原 owner 声明。flush 失败不能假称可恢复；不为更新做 root reset 或复制一套 store。

### 19.3 最后点击时间放在哪里（方向已接受，接线 OPEN）

扩展已有 **`kernel/base/runtime` 的本机状态** 保存一个 lastInteraction 时间事实及公开 selector；不新建单独 idle 包，不把 M／更新规则放进点击统计能力。该字段本机隔离、不随主副 state 同步，JS 启动时初始化为当前时间，避免恢复旧时间后一启动就立即判闲。

采集接在 **`ui/base/render` 的 SurfaceRoot／统一 surface 承载边界**，通过 Runtime 定义的 command 更新事实；涵盖屏幕内容、层、admin 及虚拟键盘点击，不要求每个 feature 按钮重复调用。单机双屏任一屏点击更新同一时间；双机各自采集。采集不能抢占 responder、吞掉原点击，也不记录坐标／输入正文等无关内容。

现有来源：`ui/base/render/src/components/SurfaceRoot.tsx` 统一承载 content／layers；`ui/base/input/src/components/InputSurfaceFrame.tsx` 有局部触摸处理，但不代表全机点击；`kernel/base/runtime/src/features/slices/runtimeInstanceMode.ts` 已有本机 isolated state。当前搜索未找到通用 lastInteraction owner，以上是复用方向，不是已存在 API。

RN 0.86.3 精确源码声明 touch／responder capture 等入口：[ViewPropTypes](https://raw.githubusercontent.com/facebook/react-native/v0.86.3/packages/react-native/Libraries/Components/View/ViewPropTypes.js)。pointer 接口在源码仍标为实验性，不据此承诺 Web／Android 同一 handler 必然覆盖。详设需核验普通触屏、Web 点击、虚拟键盘、admin overlay 和双屏；独立 native Modal／系统 installer 不在同一 React 树时要明确其边界。必要的桥仍发同一个 command，不新增事件机制。

Dexter 要求简单判断，不为闲时增加大量逻辑。最小做法是统一界面入口观察实际点击／触摸开始并记录最后时间，M 时间未再收到该动作即可判闲；虚拟键盘上的点击自然计入。不另外识别滚动、拖动、物理键盘活动、业务繁忙或全系统输入，不建设交互监测框架。采用一次截止定时：新点击重设截止，到时 actor 再用本机 selector 核对，避免点击与定时重启竞态；不常态轮询。进程挂起／恢复的时钟边界在具体接线时说明，不新增产品策略。

### 19.4 HOT 坏包怎么判断与回退（方向已接受，接线 OPEN）

仅做 **启动失败保护**，不建设“自动判断所有业务 BUG”的框架：

| 信号 | 建议处理 | 不可推导 |
| --- | --- | --- |
| 下载／摘要／解包／runtime／必要资源校验失败 | 拒绝应用，保留当前包 | 尚未切换，无需回退，也不等于当前 App 有问题 |
| 新 HOT 加载失败、初始化发生致命错误，或约定启动期限内不能完成启动确认 | 在原生层保留失败身份；有兼容且数据可回读的上一成功包时，有限回退并重启 | 超时是“未获启动确认”，不能直接证明包代码错误；进程被系统杀掉／断电也不能一律归咎坏包 |
| 已确认成功启动，后来业务异常、HTTP 失败、断链、某页面出错 | 正常错误边界／日志处理，发布修复包 | 不自动回退，避免普通网络／业务问题触发软件降级 |

启动确认建议只包含：实际目标工件／启动身份匹配、Runtime 初始化及必须的 state hydration 完成、既有物理 PRIMARY 首屏完成布局且没有启动阻断；具体复用 §19.5，不另建所有页面健康检查。不能依赖 CBS／TDS 在线或某个业务 HTTP 成功；不能仅以 bundle 下载／开始执行就确认。不得“等所有将来 surface 永远成功”或设置长期业务健康打分。确切现有启动信号与期限留详设核验。

保护要在新 JS 之前可执行的原生层，不靠坏包自己的 JS timer 救自己。只保留上一成功且当前 native runtime 兼容的目标作为候选；FULL 改变 runtime 后，旧 HOT 若不兼容不能回用。APK 内嵌 JS 是否作为唯一兼容恢复目标须检查实际版本与数据，不自动宣称始终安全；不自动降 APK。

回退后同一失败工件不得被同一规则立即再次加载，保留与 application／工件／runtime 关联的失败记录。管理员启停旧规则不清掉该事实；记录为失败／已回退；主机可上报本机实际版本，副机仅保留本地事实，发布修复工件才有新的执行目标。按 Dexter 2026-10-05 裁决，本期不提供原失败工件手工重试；后继启动只能选择不同修复工件，不自动循环。

**数据兼容是回退前提**：只核对本次 HOT 从加载到启动确认窗口内可能修改的持久字段，保证指定的上一成功恢复目标仍可读。新 JS 可能在首屏前写数据，“尚未显示”不证明安全。无需兼容全部历史包／全部 state；不复制 store、不新增通用迁移管理。确认启动成功后不再自动回退，不要求无限期维护旧包可读。破坏性修改应通过明确的 FULL 升级路径安排，但 FULL 也不自动证明数据安全；不满足恢复条件则不自动加载旧包，采用向前修复，不宣称具备安全回退。

官方 [Expo error recovery 说明](https://docs.expo.dev/eas-update/error-recovery/) 同样提示回退可能被不兼容持久状态阻止，并将恢复限定为避免启动损坏的最后保护。这是风险与方案比较依据，不是本仓采用 expo-updates 的证明；其具体 timer／捕获规则不直接复制成本仓要求。实际 RN／Expo 原生错误捕获、启动观察和恢复接线仍 OPEN，必须按本仓解析版本核验，不能只依据通用页声称端口已实现。

本节仅修订讨论稿；没有修改 Runtime／render／adapter／测试源码，没有运行生成、编译、测试、verify、DEV 或设备更新。


### 19.5 复用现有 splash／首屏就绪链作为启动确认（Dexter 提议，静态核验）

**可复用现有成功就绪链，不能把“splash 已隐藏”单独等同 HOT 成功。** 当前源码链：

`ui/base/render.ScreenReadyBoundary` 的物理 PRIMARY 首屏布局＋host 几何已就绪 → `integration-assembly.onPrimarySurfaceReady` → 既有 startup-ready command／启动必要条件 → `nativeLoadingCapability.hideOnce('startup-ready')` → native `beginHide`／按 Activity identity `releaseHide` → Expo splash 隐藏。

- `ScreenReadyBoundary.tsx:230-289` 的 readyInput 携带 contentFailure，integration `integrationAssembly.tsx:611-631` 区分 primaryRealReady 与 primaryContentFailure。渲染失败内容也能经该链释放 splash。
- `ScreenReadyBoundary.tsx:101-128` 的 StartupFailurePage 另外调用 `hideOnce('startup-failure')`，目的是让错误页面可见。它必须继续隐藏 splash，但不能确认更新成功。
- `application/base/android/src/foundations/nativeLoadingCapability.ts:34-43` 按 Activity token 释放原生 gate 后调用 Expo hide；原生 registry 的 token 是 Activity identity，不是工件／JS 启动 identity。
- `TerminalNativeLoadingRegistry.kt:100-102` 的 2 秒期限约束 main-thread operation；不是“从 bundle 启动等待 JS 就绪”的期限。当前静态源码没有本提议所需的启动 watchdog／自动回退闭环。

最小调整建议：沿用 PRIMARY 首屏成功的既有通路，在 `contentFailure == null`、现有启动必要条件满足及正常 native 释放成功后，确认当前 HOT 的工件＋本次 JS 启动身份；失败页只释放视觉遮罩。原生 update 启动选包路径在实际加载该目标时开始有界确认期限 T，收到本次匹配成功确认则结束；超时按启动失败进入 §19.4 的有限恢复，不要求坏 JS timer 存活，也不另做业务健康评分。

T 与 FULL 未安装提醒 N 是不同用途，不能共用。T 不从下载开始，不包含等待用户安装或等待用户手动启动的时间；HOT reload 即使复用同一 Activity、splash 早已隐藏，也必须建立新的 JS 启动身份及等待确认，不能因 `alreadyHidden` 沿用上次成功。旧 Runtime 的迟到确认不能清除新启动的等待。

超时证明“本次启动没有按期完成”，不证明全部业务 BUG、网络错误或任意进程退出都由包导致。真正选择旧包前仍需当前 native runtime 与持久数据兼容，回退后仍需防止同一坏工件循环加载。当前只确认可复用源码路径；原生加载／重载接线、成功／失败／超时／迟到确认与恢复均未实现或运行。


### 19.6 移除终端类型维度与副机服务端边界（Dexter 已确认）

本期更新规则不包含“用途／终端类型”维度，后续只有 Dexter 明确新的定义与范围后才增加；不新增多用途匹配，也不以设备类型／功能配置替代。配对副机仅是主机扩展，CBS／TDS 不知道其存在，不登记副机、不保存副机版本、不由主机代报。主机取得规则并同步，副机仍通过同一本机 Runtime selector 读取本地实际版本、独立更新；本地版本事实不是服务端报告。主机连接报告仅包含主机本机实际版本。

## 20. 全稿成本收敛（2026-10-05）

### 20.1 本期不建设的内容

不做自动 runtime 指纹工程、逐 workspace／增量更新、跨规则依赖图、跨机下载共享／协调提交、通用忙闲监测、全部 state 快照／历史兼容矩阵、任务进度后台／永久流水、独立 PKI／审批平台、后台提醒服务或通用恢复队列。§17 能力表是边界说明，不冻结七方法接口；具体形状由真实原生方案收敛。各机独立下载，复用配置、代理和网络底座；本地只保存当前任务、必要失败身份和加载选择事实，不建平行账本。

### 20.2 不能为省成本删掉的闭环

固定 FULL→HOT 跨启动目标、完整文件校验与原生兼容检查、实际本地 bundle／资源加载、installer 确认及结果回读、既有持久字段 flush、原生有限启动保护，均直接支撑已确认需求。首屏保护只复用 PRIMARY 成功链＋本次工件／启动身份＋期限 T；失败页隐藏 splash 不算成功。它们尚未实现，不能把“已有 reload／asset”说成低成本现成更新器。

### 20.3 FULL／HOT 配对与两端校验分工（Dexter 已确认）

含 HOT 的规则必须关联其最小 FULL，固定到不可变工件身份。CBS 登记／启用时校验同 application／平台／空间、FULL 目标 runtime 与 HOT 要求匹配，以及声明的更新目标闭包。声明需要续接却缺少兼容 HOT，拒绝启用；不从其他规则搜索前置。不要求所有 FULL-only 规则额外携带 HOT，仍保留 §11.1 的单段完整更新。

TER 在首次 port 动作前用本机实际 APK／JS／runtime 核验：需要时按固定规则先 FULL 后 HOT；满足前置则跳过 FULL。配对合法不代表所有设备可执行；本机不兼容、目标会导致主动降级，或 FULL 内嵌 JS 较旧且未提供必要 HOT 续接时，拒绝执行并给出原因，不暗选旧规则或较低版本。

边界反例：FULL 内嵌 JS4，主机最后报告 JS3，副机实际 JS5但不上报。CBS 不用该旧报告证明所有设备无需续接；副机依据本机 JS5 拒绝会主动降级的 FULL-only 目标。两端各据可得事实拒绝，不引入副机上报、全体在线盘点或新增设备可见性系统。

独立审查及主 agent 处置见 `doc/review/platform/2026-10-05-ter-version-and-js-apk-update-simplicity-review-claude.md`。本轮仅修订讨论稿及记录，新增更新能力全部 OPEN／NOT_RUN；不构成正式详设 GO、实施或运行授权。

## 21. 外部参考评审与新增裁决（2026-10-05）

Dexter 提供另一会话的 NO-GO 0M/7S/5N 作为参考，明确“仅供你参考，你觉得有价值的地方可以吸收”。主 agent 自行重开正式需求、既有裁决和相关源码，不继承该 severity/verdict；原独立评审按其旧 SHA 保留。本节记录新输入，正式收敛正本仍为 `doc/plans/platform/2026-10-05-ter-version-and-js-apk-update-formal-requirements-claude.md`。

### 21.1 Dexter 直接确认

1. FULL 用户在系统安装确认中点取消：“继续等待，按 N 提醒（推荐）”。取消不把工件标坏或使固定任务失败；仍进行/未知会话不重复提交。签名/文件/兼容等技术失败另行分类。
2. HOT 回退数据兼容采用发布纪律：“采用发布纪律（推荐）”。候选 HOT 启动确认前的持久写入必须保持指定上一成功包可读，不做破坏性迁移；发布测试证明，原生不猜业务 schema。不新增兼容目标列表或通用迁移框架。
3. 原工件人工重试：“确认不增加手工重试的能力。”不提供重试/清除失败标记入口；失败后发布不同修复工件。用户取消仍属等待，终态前有限下载重试仍保留。
4. 在最后报告增加最近更新状态：“增加最近状态（推荐）”。只保存规则/工件、阶段、等待或失败原因及状态时间，复用 owner 已有事实；在线变化或下一次 ready 送同一份报告，后台只读，不新增历史流水或任务看板；副机仍不上报。

### 21.2 吸收的闭合要求与保留边界

- FULL 内嵌旧 JS 的中间启动也要能读原运行 JS 的持久数据与固定任务；不能用最终 HOT 会更新成功掩盖中间崩溃。A 要给支持来源及真实发布测试证据，当前不把流程改成预下载 HOT 后直接首启，也不绕过 M 策略。
- 同 runtime/同 bundleVersion 只凭数值不能认定同一内容。安装包未登记为 FULL 时本机也须能核验实际 JS/资源内容身份，冲突拒绝，身份不明不假称已达到。
- A 比较 reload 与可靠整进程重启/冷启动入口，不预设哪个必然更简单；整进程自动拉起、双屏、持久回读仍需证明。没有运行任何探针。
- 固定后停用/新修复不能撤回；FULL 等安装或 HOT 等 M 可以长期阻挡后续规则。这是已有裁决的实际后果，本轮只补明，不擅自加等待上限或抢占。
- “全部门店”是当前项目动态范围，含后来新增门店；指定 refs 不自动扩张。主机报告的 ready 与成功触发沿同一入口合并，不建重复上报管道。
- A/B 是真实可验收能力，C 才闭合完整自动更新产品。FULL 纵切也是可行替代，再发带 HOT 原生能力的 APK 不是技术阻断；当前保留风险优先 A/B/C，诚实说明其交付价值与工作量，不借场景计数证明成本小。
- HOT 未引入独立代码签名的信任风险登记到 `HANDOFF.md` 的需求阶段边界；不追加 PKI。A 的 Android 固定目标测试触发通路仍 OPEN，不能将 Runtime dispatchCommand 的存在当成设备注入能力已经实现。

人工重试产品项已按 Dexter 确认关闭：本期不提供该能力；本轮未新增手工页面、后门 command、源代码、测试、依赖或运行证据。详见外部参考 intake 文件。
