# `@next/assembly-android-mixc-catering-assembly-rn84`

| 字段 | 值 |
|---|---|
| **TER 批次** | **批 F · F10** —— 薄壳形态原样继承；`targetPackages` 须由依赖图算出 |
| 路径 | `4-assembly/android/mixc-catering-assembly-rn84` |
| 规模 | src **15 行**（只有 `generated/releaseInfo.ts`）+ `App.tsx` **30 行**；test **4,991 行**；Kotlin **232 行** |
| runtime 依赖 | 仅 **2 个 `@next` 包**：`host-runtime-rn84` · `ui-integration-catering-shell`（另有 react / react-native / react-redux / redux / qrcode-svg / svg） |
| 状态 | 活跃；**"assembly 越薄越好"这条真的做到了** |

> **TER 建设批次**见 [`00-ter-build-order-claude.md`](00-ter-build-order-claude.md)（Dexter 2026-08-28 裁定：地基优先，业务无关内容按依赖关系先建）。


## 1 · `App.tsx` 全文 30 行

```ts
export default createHostApp({
    RootScreen,
    createShellModule: createCateringShellModule,
    extraKernelModules: createCateringBusinessModules(),
    productConfig: {
        productId: 'mixc-catering',
        moduleName: 'assembly.android.mixc-catering-rn84',
        appRegistryName: 'MixcCateringAssemblyRN84',
        logTag: 'assembly.android.mixc-catering-rn84.boot',
        releaseInfo,
        adbSocketDebugEnabled: true,
        activationCapability: {
            supportedProfileCodes: ['KERNEL_BASE_ANDROID_POS'],
            supportedTemplateCodes: ['KERNEL_BASE_ANDROID_POS_STANDARD'],
            supportedCapabilities: ['android.rn84', 'product.mixc-catering', 'profile.kernel-base-android-pos'],
        },
    },
})
```

**没有一行业务逻辑，没有一行状态机，没有一个 slice。**
这是 `layered-runtime-communication-standard.md` 里"Thin Assembly Is A Hard Constraint"的达成状态。

## 2 · Kotlin 侧 232 行，其中两个是一行子类

```kotlin
class MainActivity : com.next.hostruntimern84.MainActivity()
class SecondaryActivity : com.next.hostruntimern84.SecondaryActivity()
```

`MainApplication.kt` 提供 `ReactApplication.reactHost`，
另有两个测试（`AppRestartManagerTest` / `ReactLifecycleGateTest`）。

## 3 · 【发现】测试 4,991 行 ≫ 源码 45 行

19 个 spec 文件，实际测的**几乎全是 `host-runtime-rn84` 的行为**：

```
assembly-create-app.spec.ts            assembly-platform-ports.spec.ts
assembly-bootstrap-runtime.spec.ts     assembly-native-wrappers.spec.ts
assembly-automation-dispatcher.spec.ts assembly-automation-host-config.spec.ts
assembly-admin-console-config.spec.ts  assembly-admin-console-automation.spec.tsx
assembly-report-terminal-version.spec  assembly-report-app-load-complete.spec
assembly-resolve-topology-launch.spec  assembly-standalone-slave-topology.spec
assembly-state-storage.spec.ts         assembly-topology-input.spec.ts
assembly-runtime-module.spec.ts        assembly-ui-automation-runtime.spec.tsx
assembly-live-admin-loop.spec.tsx      assembly-adb-socket-debug-config.spec
metro-config.spec.ts
```

⇒ **测试写在了被测代码的下游包里。**
`host-runtime-rn84` 自己 `test` 目录为空（`a-02` §5.1），
它的行为验证全部寄居在 assembly。

**为什么会这样（推论）**：assembly 是唯一能把 native wrapper、platform ports、
RN 环境凑齐的地方，所以"能跑起来的测试"自然长在这里。
但结果是**包的测试归属与包的代码归属不一致**。

## 4 · release manifest

```json
{
  "appId": "assembly-android-mixc-catering-rn84",
  "assemblyVersion": "1.0.0", "buildNumber": 8,
  "bundleVersion": "1.0.0+ota.25",
  "runtimeVersion": "android-mixc-catering-rn84@1.0",
  "channel": "production", "minSupportedAppVersion": "1.0.0",
  "targetPackages": { …22 个包及版本… },
  "git": {"commit": "...", "branch": "main"},
  "artifacts": {"bundle": {"path", "size": 3194824, "sha256", "modifiedAt"},
                "sourceMap": {"size": 11739457, "sha256", ...}}
}
```

四类版本被明确分开：
`assemblyVersion`（App 版本）· `buildNumber`（构建号）·
`bundleVersion`（JS 包版本，带 `+ota.25`）· `runtimeVersion`（原生运行时兼容标识）。

**热更新的兼容判断靠 `runtimeVersion` + `minSupportedAppVersion`**，
而不是靠 App 版本 —— 这是对的。

### 4.1 一处不一致

`targetPackages` 里列了 **`@next/kernel-base-execution-runtime`** 与
**`@next/kernel-base-host-runtime`** —— 这两个包**零 import**（`k-04` / `k-05`）。

⇒ manifest 的 `targetPackages` **不是从实际依赖图算出来的**，
所以它声明"这次发布包含这两个包"，而 bundle 里其实没有它们的代码。

## 5 · 优点

1. **30 行 App.tsx**（§1）。这是全仓最值得直接继承的一条形态。
2. **Kotlin 侧两个一行子类**（§2）—— 产品壳不重写宿主机制。
3. **runtime 依赖只有 2 个 `@next` 包**，业务全部经 shell 收口。
4. **release manifest 把四类版本分开**（§4），热更新兼容判断有明确依据。
5. **manifest 带 bundle 与 sourceMap 的 sha256 + size + mtime**，
   发布产物可校验。
6. **`activationCapability` 在产品配置里声明**（支持的 profile / template / capability），
   服务端据此判断这台终端能激活成什么。这是产品差异的正确表达位置。
7. **`metro-config.spec.ts`** —— 连打包器配置都有测试。

## 6 · 缺点 / 风险

1. **§3 的测试归属错位**：4,991 行测试测的是上游包。
2. **§4.1 的 manifest 与实际依赖不一致**，且没有机制发现。
3. **`metro.config.js` 的自定义 resolver**（`FIX-13`）：
   强制把 `react` / `react-native` / `@react-native*` / `@react-navigation*`
   解析到 assembly 本地 `node_modules`，因为仓库根 hoist 了 RN 0.77 而这里要 RN84。
   **根因在依赖版本策略，解法落在打包器**，且只对 Metro 生效
   （tsc / vitest / eslint 看到的仍是 hoist 后的版本）。
4. **包名 `mixc-catering-assembly-rn84`**：产品名 + 框架版本 + 一个多余的 `assembly`
   （目录已经在 `4-assembly/android/` 下了）。`FIX-02`。
5. **`adbSocketDebugEnabled: true` 硬编码在产品配置里**，
   而不是按构建变体决定（`FIX-14` 的同一形态）。

## 7 · 重构到 TER 的优化方向

| # | 动作 | 理由 |
|---|---|---|
| 1 | **30 行 App.tsx 的形态整体继承**，并作为 TER assembly 的硬上限 | §5.1；这是"越薄越好"能被验证的形态 |
| 2 | **测试迁回被测包**：`host-runtime` 的行为测试放 `host-runtime`，assembly 只留组合与打包测试 | §6.1 |
| 3 | **`targetPackages` 从实际依赖图生成**，并加校验 | §6.2；顺带能发现零消费者的包（`FIX-11`） |
| 4 | **删掉 metro 自定义 resolver**，从版本策略上根除（全工作区单一 RN/React 版本，由 Expo 版本矩阵统一） | `FIX-13` |
| 5 | **包名去掉框架版本与冗余段** | `FIX-02` |
| 6 | **`adbSocketDebugEnabled` 改由构建变体决定** | `FIX-14` |
| 7 | **四类版本分离的 manifest 形态整体继承**，Expo 下映射到 `runtimeVersion` / `expo-updates` 的对应概念 | §5.4 |
| 8 | **Electron assembly 按同一形态建**（Dexter 已裁定先建空目录） | 讨论稿 §7.1 |

## 8 · 证据档位

`已亲验`：`App.tsx` 全文、`index.js` 全文、`package.json`（scripts + dependencies）、
`release.manifest.json` 全文、`AndroidManifest.xml` 全文、Kotlin 文件清单与两个一行子类、
19 个 spec 文件名与总行数、`metro.config.js` 全文。
`推论`：§3 的"为什么测试长在这里"。
**未逐行读**：19 个 spec 的内容（4,991 行）。
