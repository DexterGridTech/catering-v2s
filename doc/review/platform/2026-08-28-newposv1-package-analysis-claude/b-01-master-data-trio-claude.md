# 主数据三包 · `organization-iam` / `catering-product` / `catering-store-operating`

> 三个包结构**逐字同构**，只有 topic 集合与 selector 不同。合并成一份文档，差异逐项标注。

| 包 | src 行数 | topic 数 | 被依赖 |
|---|---|---|---|
| **TER 批次** | **批 D · 延后** —— 业务主数据，且依赖 TDP |
| `@next/kernel-business-organization-iam-master-data` | **1,459 / 15 文件** | **26** | 4（另两个主数据包 + workbench + shell） |
| `@next/kernel-business-catering-product-master-data` | **866 / 14 文件** | **8** | 2（workbench + shell） |
| `@next/kernel-business-catering-store-operating-master-data` | **724 / 14 文件** | **4** | 2（workbench + shell） |

三包 test 均为 **46 行**（只有一个 `test/index.ts` 之类的壳，无实质 scenario）。

依赖：`contracts` · `runtime-shell-v2` · `state-runtime` · `tdp-sync-runtime-v2`
（org-iam 另被另两个包依赖，用于组织链路解析）。

> **TER 建设批次**见 [`00-ter-build-order-claude.md`](00-ter-build-order-claude.md)（Dexter 2026-08-28 裁定：地基优先，业务无关内容按依赖关系先建）。


## 1 · 作用与目的

**把 TDP 下发的 authoritative projection 转成终端本地 read model。**

`1.2-business` 层 README 的定位：
> 与具体业务域相关、但仍然平台无关、UI 无关的业务状态、command、actor、selector、projection/read-model 逻辑。

## 2 · 五文件同构结构

| 文件 | 职责 |
|---|---|
| `foundations/topics.ts` | topic 常量对象 + `topicList` + `topicSet` + `projectionKindByTopic` 映射 + `isXxxTopic` type guard |
| `foundations/decoder.ts` | wire envelope → 本地 record，**校验后返回 `{record?} \| {error?}`** |
| `features/slices/masterData.ts` | `byTopic` + `diagnostics` + `lastChangedAt` |
| `features/actors/masterDataActor.ts` | 监听 `tdpTopicDataChanged` → 过滤自己的 topic → decode → 写 slice |
| `selectors/index.ts` | 面向 UI 的查询（org-iam **489 行**、product 211、store-operating 157） |
| `application/moduleManifest.ts` | 声明 `tdpTopicInterests`（`category:'projection'`, `required:true`） |

## 3 · topic 清单（实测）

**organization-iam（26 个）**：
`org.*`：platform / region / project / tenant / brand / store / contract.active / business-entity / table / workstation
`iam.*`：identity-provider / role / permission / permission-group / role-template / feature-point /
platform-feature-switch / user.store-effective / user-role-binding.store-effective / resource-tag /
principal-group / group-member / group-role-binding.store-effective / authorization-session.active /
sod-rule / high-risk-policy

**catering-product（8 个）**：product-category / product / product-inheritance / brand-menu /
`menu.catalog` / price-rule / bundle-price-rule / channel-product-mapping

**catering-store-operating（4 个）**：`store.config` / `menu.availability` / availability-rule / saleable-stock

## 4 · decoder：值式错误 + 三重校验

```ts
if (!isOrganizationIamTopic(topic))                    return {error: `Unsupported topic ${topic}`}
if (change.operation === 'delete')                     return {record: {...tombstone: true}}
if (!isRecord(change.payload))                         return {error: 'Missing retained-state payload'}
if (envelope.schema_version !== 1)                     return {error: `Unsupported schema_version ...`}
if (envelope.projection_kind !== kindByTopic[topic])   return {error: `Unexpected projection_kind ...`}
if (!isRecord(envelope.data))                          return {error: 'Missing envelope.data'}
```

**四点值得记**：

1. **不抛异常，错误是返回值** —— 一条坏 projection 不会打断整批处理；
2. **校验 `schema_version`** —— 服务端换 schema 时终端明确拒绝而不是猜；
3. **校验 `projection_kind` 与 topic 匹配** —— 防止服务端把 A 的数据发到 B 的 topic；
4. **delete 显式产出 tombstone record**，不是从 map 里删掉 —— 对应 `1.2-business` README 的
   "删除必须有明确 tombstone 语义，不能只靠数组覆盖或 UI 过滤"。

## 5 · 【重要缺陷】主数据整块落盘 + 每次立即刷

三个包**逐字相同**：

```ts
persistIntent: 'owner-only',
syncIntent: 'master-to-slave',
persistence: [
    {kind: 'field', stateKey: 'byTopic',       flushMode: 'immediate'},
    {kind: 'field', stateKey: 'diagnostics',   flushMode: 'immediate'},
    {kind: 'field', stateKey: 'lastChangedAt', flushMode: 'immediate'},
],
sync: {kind: 'record', getEntries: ... `${topic}:${itemKey}` ...}
```

**同步是逐条的（`record`），持久化却是整块的（`field` on 整个 `byTopic`）。**

后果链（`推论`，推导链如下）：

1. `byTopic` 是 `Record<topic, Record<itemKey, record>>` —— **26 个 topic × N 条商品/组织记录，一个 storage key**；
2. `flushMode: 'immediate'` ⇒ 任意一条 projection 变化都立即触发刷盘；
3. `state-runtime` 的 flush **重写全部持久化条目**（见 `k-06` §6.2，不做差量）
   ⇒ **一次商品改价 → 重写整个主数据 blob + 其它所有 slice 的持久化条目**；
4. 终端主数据规模越大，这条越贵。

⚠️ **这正是 `KEEP-04`（按条目落盘、避免整块 blob）要防的形态，而机制就在手边**
（`kind: 'record'` 已经被同一个 descriptor 用在 `sync` 上）。
持久化没用它，是**用错了自己已有的能力**。

## 6 · 优点

1. **三包结构逐字同构** —— 新增一个业务域主数据只需照抄五个文件、换 topic 集合。
   这是"功能模块化"最直接的收益。
2. **decoder 的三重校验 + 值式错误**（§4）。对照 `FIX-19`（workflow 远程定义 `as any` 零校验），
   同一个团队在这里做对了。
3. **tombstone 显式**，删除是一条记录而不是一次 map 删除，重启后仍能区分"没下发过"与"被删了"。
4. **`diagnostics` 字段持久化** —— 现场排查"这个商品为什么没有"时有据可查，
   对应 README 的"read model 应保留 diagnostics"。
5. **`tdpTopicInterests` 正确声明**（`required: true`），
   与 `FIX-19` 里 workflow 的漏声明形成对照 —— 说明机制是好的，只是没有门守着。
6. **`syncIntent: 'master-to-slave'`** —— 副屏不自己拉主数据，跟主屏走。
7. **selector 层承担 UI 友好查询**，slice 只存原始 record —— 读写职责分开。

## 7 · 缺点 / 风险

1. **§5 的整块落盘 + 立即刷盘**。三包同错，是本层最重要的缺陷。
2. **三包 test 均为 46 行的壳，无实质 scenario。**
   而 `1.2-business` README 明确要求"新增 projection 必须有测试覆盖 snapshot、incremental、delete、diagnostics"。
   **要求写了，没执行。**
3. **`organization-iam` 的 `selectors/index.ts` 489 行 + `types/index.ts` 405 行**，
   占该包 1,459 行的 61%。26 个 topic 的类型与查询堆在两个文件里。
4. **`organization-iam` 被另两个主数据包依赖**（解析组织链路），
   business 包之间产生了依赖 —— README 说"避免业务包之间形成循环"，当前不是循环，
   但已经是链式依赖，方向靠自觉。
5. **`updatedAt: Date.now()` 在 decoder 里生成**，是本机墙钟。
   它进入 sync 的 `SyncValueEnvelope.updatedAt`，在 authoritative 模式下只作变化检测，
   不影响正确性（见 `FIX-05` 更正），但会因时钟偏差造成多余重发。
6. **`scopeType ?? 'UNKNOWN'` / `scopeId ?? 'UNKNOWN'` 兜底**：
   缺失作用域时写入 `'UNKNOWN'` 字面量而不是拒绝或告警，会静默产生一条作用域错误的记录。

## 8 · 重构到 TER 的优化方向

| # | 动作 | 理由 |
|---|---|---|
| 1 | **持久化改 `kind: 'record'`，按 `topic:itemKey` 一条一个 key** | 修 §5，机制现成（`sync` 已经这么用了） |
| 2 | **`flushMode` 改 `debounced`**，只有关键字段（如游标）用 immediate | 主数据不需要每条立即落盘 |
| 3 | **五文件同构结构整体继承**，作为 TER 新增业务域主数据的模板 | §6.1 |
| 4 | **decoder 的三重校验 + 值式错误整体继承**，并作为 TER"外部数据入口"的标准形态 | §4，且是 `FIX-19` 的正面对照 |
| 5 | **补 projection 测试**：snapshot / incremental / delete / 坏 envelope / diagnostics 五条 | README 已要求，未执行（§7.2） |
| 6 | **`scopeType/scopeId` 缺失改为 decoder 拒绝 + 记 diagnostics**，不写 `'UNKNOWN'` | 静默错误数据比拒绝更难查（§7.6） |
| 7 | **org-iam 按 `org.*` / `iam.*` 拆成两个包** | 26 topic、两个 projection_kind，本来就是两件事（§7.3） |
| 8 | **主数据规模量级要先量出来**，再决定是否需要 SQLite | Dexter 已裁定 SQLite 等真实业务；量级是那个决策的输入 |
| 9 | 业务包之间的依赖方向补进依赖门 | §7.4 |

## 9 · 证据档位

`已亲验`：三包的 `topics.ts`（topic 清单逐条读出）、`decoder.ts`（org-iam 全文，另两包结构对照）、
三包的 slice descriptor（`persistence` / `sync` 逐字对比）、`moduleManifest.ts`、
文件清单与行数、被依赖数。
`推论`：§5 的后果链（结合 `k-06` §6.2 的全量重写行为推出），**未做运行验证**。
**未逐行读**：三包的 `masterDataActor.ts`（各 ~158 行）、`selectors/index.ts`（org-iam 489 行）。
