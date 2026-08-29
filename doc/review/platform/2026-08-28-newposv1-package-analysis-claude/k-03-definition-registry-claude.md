# `@next/kernel-base-definition-registry`

| 字段 | 值 |
|---|---|
| **TER 批次** | **批 N · 整包取消**（Dexter 2026-08-28 裁定：不再从 store 动态取值）——约 200/356 行随 catalog 消失，剩余 55 行不足以成包；职责四分见 `00-ter-build-order` §4B.8。⚠️ 本文 §7 的"整包继承"建议**已作废**，下文保留分析作为证据 |
| 路径 | `1-kernel/1.1-base/definition-registry` |
| 规模 | src **356 行 / 11 文件**；test **381 行**（测试比源码多） |
| 依赖 | `@next/kernel-base-contracts` |
| 被依赖 | 声明 2 个包；源码实际 import **仅 1 个**（`runtime-shell-v2`） |
| 状态 | 活跃、健康、边界干净 |

> **TER 建设批次**见 [`00-ter-build-order-claude.md`](00-ter-build-order-claude.md)（Dexter 2026-08-28 裁定：地基优先，业务无关内容按依赖关系先建）。

## 1 · 作用与目的

**error / parameter 定义的注册与解析层。** 它回答两个问题：

1. 这个 key 有没有被重复定义？（注册表）
2. 静态定义 + 远端 catalog 覆盖 + decode + validate + fallback，最终值是什么、从哪来？（解析器）

README 定位："decode/validate/fallback 只有一个实现。"

## 2 · 公开面

- `createKeyedDefinitionRegistry<T>(kind)` —— 泛型注册表
- `createDefinitionRegistryBundle()` —— 产出 `{errors, parameters}` 两个注册表
- `resolveAppError` / `resolveErrorDefinitionByKey`
- `resolveParameter` / `resolveParameterByKey`
- `createDefinitionResolverBundle(registries, snapshots)` —— 把注册表与 catalog 快照绑定成四个无参解析函数

## 3 · 关键实现

### 3.1 注册表：重复 key 直接抛

```ts
if (definitions.has(definition.key)) {
    throw new Error(`[${kind}] duplicated definition key: ${definition.key}`)
}
```

`getOrThrow(key)` 找不到也抛。`snapshot()` 返回 `Object.freeze` 的普通对象。
**注册期就发现 key 冲突**，而不是运行到那条错误才发现两个模块抢同一个 key。

### 3.2 参数解析：三态 source + valid 标志

```ts
无 catalog 条目            → {value: defaultValue, source: 'default',          valid: true}
catalog 有值、decode+validate 通过 → {value: decoded,      source: 'catalog',          valid: true}
catalog 有值、validate 不过        → {value: defaultValue, source: 'catalog-fallback', valid: false}
catalog 有值、decode 抛           → {value: defaultValue, source: 'catalog-fallback', valid: false}
```

decode 分类型：
- `number`：`Number(raw)`，`NaN` 抛（**不会把 `NaN` 当成合法数字**）
- `boolean`：接受 `true/false/1/0/'true'/'false'/'1'/'0'`（大小写与空白归一），其余抛
- `json`：字符串则 `JSON.parse`，否则原样
- `string`：`String(raw)`
- 定义自带 `decode` 时优先用它

### 3.3 错误解析：模板三级来源

`catalogEntry.template` → `definition.defaultTemplate` → `appError.message`，
每级对应一个 `source` 值（`catalog` / `definition-default` / `app-error`）。

`resolveErrorDefinitionByKey` 里有一条显式一致性检查：

```ts
if (input.appError.key !== input.key) throw new Error('appError.key mismatch: ...')
```

**key 不一致时显式失败，不静默用其中一个。**

## 4 · 依赖关系

- **出边**：只有 `contracts`。
- **入边**：只有 `runtime-shell-v2`（它把 bundle 装进 runtime，业务模块通过 `context.resolveParameter` 间接用）。

这个入边数是**设计意图**而非冷落：README 明确"runtime-shell 和业务模块不需要自己解释 catalog"，
所以只应有一个消费者。

## 5 · 优点

1. **"静态定义 vs 动态覆盖"只有一个解析实现。** 这是 POC 里少见的、真正把横切逻辑收敛干净的一处。
2. **解析结果自带 `source` 与 `valid`。** "为什么这个超时是 60 秒"永远可回答：是默认值、是远端下发、还是远端下发的值非法被退回。
   多数系统在这里只给一个数字。
3. **decode 失败不抛给调用方，而是退回默认值并标 `valid: false`。**
   远端下发一个坏值不会让终端崩，但也不会被静默当成正常。
4. **重复 key 注册期抛错**，把"两个模块抢同一个 error key"从运行期问题变成启动期问题。
5. **测试比源码多**（381 vs 356），且覆盖的是 decode/validate/fallback 的边界值。
6. **零平台依赖**，纯函数为主，可在 node 里完整测。

## 6 · 缺点 / 风险

1. **`valid: false` 只是返回值上的一个字段，没有任何强制观测。**
   调用方拿到 `resolveParameter(...).value` 就用了，不看 `valid`。
   实测 `engineConfig.ts` 等调用点都只取 `.value` —— 也就是说
   **远端下发一个非法参数，终端会静默用默认值，现场看不到任何信号**。
   解析层做对了，但没人接那个信号。
2. **`json` 类型的 decode 只做 `JSON.parse`，不做 schema 校验。**
   `validate` 是可选的，业务不写就等于没有。
3. **`resolveParameterByKey` 用 `getOrThrow`**，key 打错时抛的是普通 `Error` 而不是 `AppError`，
   逃出了整个错误协议体系。
4. **注册表是进程内 Map，无命名空间隔离。** 两个 runtime 实例共享一个 bundle 时会互相看见
   （当前一进程一 runtime，不是问题；TER 若真做"一个 VM 两个逻辑 runtime"就会是问题）。

## 7 · 重构到 TER 的优化方向

| # | 动作 | 理由 |
|---|---|---|
| 1 | ~~**整包继承**~~ ⛔ **已作废（见首表）**：Dexter 2026-08-28 裁定不再从 store 动态取值，本包**整包取消**，职责四分见 `00-ter-build-order` §4B.8。下方各行同样作废，保留仅作证据 | 原理由：decode/validate/fallback 单一实现 + source/valid 可观测 |
| 2 | **`valid: false` 必须产生一条 warn 级结构化日志**，而不是只作返回值字段 | 否则"远端下发非法参数"在现场不可见（当前实测无人读该字段） |
| 3 | `json` 参数**要求必须提供 `validate`**（类型层强制，不是约定） | 否则 json 参数等于无校验 |
| 4 | key 未注册改抛 **`AppError`** 而不是原生 `Error` | 保持错误协议闭合 |
| 5 | TER 若采用"一个 VM 多个逻辑 runtime"，注册表需按 runtime 实例隔离 | 当前是进程内单例 |
| 6 | 考虑把 **catalog 快照的来源与时间**一并带进 `ResolvedParameter` | 现在只知道 `source: 'catalog'`，不知道是哪次下发、什么时候 |

## 8 · 证据档位

全部 `已亲验`：`foundations/registry.ts`、`supports/resolve.ts`、`types/registry.ts`、`types/definition.ts` 全文读过。
"无人读 `valid` 字段"为 `已亲验`（`engineConfig.ts` 等调用点实测只取 `.value`），
但穷举范围限于 `1-kernel`，未扫 `2-ui`/`3-adapter`——故该条按 `推论` 对待，TER 落地前应复算全仓分母。
