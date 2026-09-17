# `kernel.base.contracts` · 终端共享词汇表

| 字段 | 值 |
|---|---|
| npm 名 | `@catering-v2s/kernel-base-contracts` |
| moduleName | `kernel.base.contracts` |
| 层 | `kernel/base` |
| kind | `toolkit`（不拥有 slice，不注册 command） |
| 依赖 | **无**。这是整棵依赖树的根 |
| 被谁依赖 | 其余全部 TER 包 |

---

## 1 · 这个包是什么

**它是终端所有包共用的「词汇表」。** 一个类型放这里，判据只有一条：

> **它是包与包之间说话要用到的词，还是某个包内部的结构？**

是共享词汇 → 放这里；是某包内部结构 → 留在那个包里。
**不看有几个消费者** —— `AppModule` 今天只有 runtime 用，但它描述的是「一个模块长什么样」，
是所有包都要遵守的形状，所以它属于这里。

它也是 `TR-05` 规则句原文点名的两个包之一：
**这里的公开面不得出现 `Record<string, unknown>`、`any` 或双重 cast。**

## 2 · 它不是什么

| 不是 | 为什么 |
|---|---|
| 工具函数库 | 只放**协议**与生成协议实例所必需的最小构造器 |
| 业务模型 | 订单、菜品、门店这些是 feature 层的事 |
| 平台能力入口 | 那是 `kernel.base.platform-ports` |

⚠️ 本包**零外部依赖**，且只用 JS 运行时自带能力（`Date.now`、`crypto.randomUUID`）。
`TR-06` 禁止 `foundations/` 触达 store、网络与平台 API；
时间与随机数是该规则里**已明确写入的例外**，不得扩大解释。

---

## 3 · 目录结构

```text
src/
  moduleName.ts        moduleName 常量
  dependencies.ts      dependencyModuleNames / devDependencyModuleNames（骨架元数据）
  types/               纯类型，无运行时代码
    ids.ts             9 种 branded 运行时 ID + TimestampMs
    error.ts           错误协议：定义、模板与 AppError
    parameter.ts       参数协议：值类型、定义与描述符
    module.ts          AppModule 及其 command/actor/slice 描述符
    request.ts         请求与命令的生命周期状态与快照
    command.ts         CommandRouteContext（**仅本机路由，不得跨线**）
    display.ts          SurfaceForm 与显示形态闭集
    topology.ts         双机拓扑身份、操作、定位器与 wire 消息类型
    transport.ts       传输服务地址、配置空间与覆盖解析
  foundations/         极薄的运行时构造器
    runtimeId.ts       runtimeIdPrefixes + 9 个 createXxxId
    time.ts            nowTimestampMs
    errorTemplate.ts   renderErrorTemplate / createAppError / isAppError
    definition.ts      模块级错误与参数工厂 + listDefinitions
    topologyWire.ts    topology wire 的闭集 parser/serializer 与帧大小校验
  index.ts             **唯一公开面**，逐项显式导出，禁止 export *
test/
  contracts.test.ts             运行时行为断言
  public-surface.typecheck.ts   类型层夹具（@ts-expect-error），只进 tsc 不进 vitest
```

---

## 4 · 用法

### 4.1 运行时 ID：不同种类的 ID 互相不能传

```ts
import {createRequestId, createCommandId} from '@catering-v2s/kernel-base-contracts';
import type {RequestId} from '@catering-v2s/kernel-base-contracts';

const requestId = createRequestId();   // 形如 req_xxxxxxxxxxxxxxxx
const commandId = createCommandId();   // 形如 cmd_xxxxxxxxxxxxxxxx

const take = (id: RequestId) => id;
take(commandId);  // ← 编译报错。这正是 branded ID 的目的
```

九种 ID 的前缀集中在 `runtimeIdPrefixes`（`run`/`req`/`cmd`/`ses`/`nod`/`con`/`env`/`dsp`/`prj`），
**新增 ID 种类必须同时改 `RuntimeIdKind`、`runtimeIdPrefixes` 与工厂**，
`satisfies Record<RuntimeIdKind, string>` 会保证三者不漏。

### 4.2 模块级错误与参数：key 自动带 moduleName 前缀

```ts
import {createModuleErrorFactory, createModuleParameterFactory} from '@catering-v2s/kernel-base-contracts';

const defineError = createModuleErrorFactory('kernel.base.runtime');
const defineParameter = createModuleParameterFactory('kernel.base.runtime');

export const commandTimeout = defineError('commandTimeout', {
  name: 'CommandTimeout',
  defaultTemplate: '命令 {commandName} 超时（{timeoutMs}ms）',
  category: 'SYSTEM',    // ErrorCategory 是闭集，见下
  severity: 'HIGH',      // ErrorSeverity 是闭集，见下
});
// commandTimeout.key === 'kernel.base.runtime.commandTimeout'

export const maxRetries = defineParameter.number('maxRetries', {
  name: '最大重试次数',
  defaultValue: 3,
});
```

⇒ **key 由工厂拼，不要手写字符串。** 手写就会出现两个模块撞 key 而没人发现。
参数工厂有 `string` / `number` / `boolean` / `json` 四支，`json` 支持自带 `decode` 与 `validate`。

两个闭集**不要自己发明取值**：
`ErrorCategory` = `BUSINESS` · `VALIDATION` · `AUTHENTICATION` · `AUTHORIZATION` ·
`NETWORK` · `DATABASE` · `EXTERNAL_API` · `SYSTEM` · `UNKNOWN`；
`ErrorSeverity` = `LOW` · `MEDIUM` · `HIGH` · `CRITICAL`。
不够用时是**改这里的联合类型并补测试**，不是在某个包里塞一个字符串绕过去。

### 4.3 错误实例：模板缺参不静默

```ts
import {createAppError} from '@catering-v2s/kernel-base-contracts';

const error = createAppError(commandTimeout, {
  args: {commandName: 'order.submit'},   // 少给了 timeoutMs
  context: {requestId, commandId},
});

error.templateMissingKeys;  // ['timeoutMs'] —— 缺参被记录下来，不是悄悄渲染成空串
```

`createAppError(definition, input?)` 会盖 `createdAt`
（这是 `TR-06` 例外里**唯一**允许的派生取值），`code` 缺省回退到 `key`。
判别用 `isAppError(value)`，不要用 `instanceof` —— `AppError` 是普通对象，不是 `Error` 子类。
`AppError` 面向跨包边界的运行期/业务错误；构造期程序员错误应直接抛 `Error`，保留调用栈并炸掉装配。

### 4.4 模块声明

`AppModule.kind` 是**必填**的（`owner` / `toolkit`），与 `TR-09` 对应：
声明 `owner` 才允许拥有 slice，`toolkit` 不得有。

### 4.5 双机拓扑协议词汇

`SurfaceForm`、拓扑身份/角色、定位器和 `TopologyWireMessage` 是跨 contracts、transport、topology
与 Android adapter 共享的闭集词汇，统一从本包导出。`parseTopologyWireMessage` 与
`serializeTopologyWireMessage` 对消息类型、`protocolVersion`、嵌套 error 的 exact keys、方向和
帧大小执行 fail-closed 校验；调用方不得在自己的包里复制 union 或用未校验的 JSON 直通运行边界。

---

## 5 · 在这个包上迭代时

**加东西之前先过这三关：**

1. **它是共享词汇吗？** 只有本包用不到、只有一个包用得到、而且描述的是那个包**内部**的结构 —— 不要放进来。
2. **形状够具体吗？** `Record<string, unknown>` 与 `any` 会被 `TR-05` 门直接拦下。
   字典型数据要给出值的闭合联合（参考 `platform-ports` 的 `LogValue` 写法）。
3. **公开面对得上吗？** 新导出必须**同时**加进 `src/index.ts` 与静态门的 expected 清单
   （`tools/terminal-contracts/check-static.mjs`），两边是精确相等比对，**漏一处门就红**。
   ⚠️ 门里的清单**不得从源码自动派生**，否则多导出永远抓不到。

**改类型之后必做**：

```bash
yarn workspace @catering-v2s/kernel-base-contracts typecheck
```

```bash
yarn workspace @catering-v2s/kernel-base-contracts test
```

```bash
node tools/terminal-contracts/check-static.mjs
```

⚠️ `tsconfig.json` 的 `include` **必须包含 `test/**`**，否则
`public-surface.typecheck.ts` 里的 `@ts-expect-error` 不会被求值，负向夹具会全部假绿。
这个坑本包踩过一次，改 tsconfig 时不要改回去。

**加负向夹具的写法**：在 `test/public-surface.typecheck.ts` 里写一行会编译失败的用法，
上面挂 `@ts-expect-error`。验证它真的有效的办法是**删掉那行注释，typecheck 必须变红**。
