# 两个管理后台经营渠道体验问题族 · Claude 独立分析

- 日期:2026-08-20 · 评审:Claude · 会话:续接(非 fresh,已声明)
- `REVIEW_TARGET=RETROSPECTIVE_PROBLEM_FAMILY_AND_PREVENTION`
- 结论:**NO-GO(防复发分析未闭合)** · **M=1 · S=2 · N=3**
- ⚠️ **21 条现象本身绝大多数已修好**;NO-GO 针对的是**防复发**:同根扫描又漏了一处,
  且出问题最多的那个 App 的 UI 事实**零组件测试**。
- 本分析未读 Codex 的问题总结即形成结论(按 brief 要求)。

---

## 0 · 最重要的一条发现:文档密度不是防线

我把 21 条现象逐条回查 IA(`...-ia.md`)与交互工件(`...-ui-interaction.md`),实测命中次数:

| 现象 | IA 提及 | 交互工件提及 | 结果 |
|---|---:|---:|---|
| ⑮ **首列进详情** | **8** | **5** | ❌ **仍然做错** |
| ⑰ 模板编码 | 3 | 8 | ❌ 仍然做错 |
| ⑥ 属性/当前值/说明三列 | 2 | 1 | ❌ 仍然做错 |
| ② provider 详情进 Tab | 2 | 1 | ❌ 仍然做错 |
| ⑨ 左树右详情 | 1 | 1 | ❌ 仍然做错 |
| ㉑ 内部渠道创建即生效 | 1 | 0 | ❌ 仍然做错 |
| ⑤ 中文名称 | 1 | 0 | ❌ 仍然做错 |
| ① 按钮在 section header 右侧 | **0** | **0** | ❌ 从未写过 |
| ⑮ 详情/编辑两套 Drawer | **0** | **0** | ❌ 从未写过 |
| ⑲ 渠道编码手填 | **0** | **0** | ❌ 从未写过 |
| ⑯ browser route 不带 UUID | **0** | **0** | ❌ 从未写过 |

**「首列进详情」被写了 13 次,照样发错。** 这一条独力证伪了「写进文档就能防住」。

⇒ **问题族分成两类,修法完全不同**:
- **A 类(7 条)已写但没做到** —— 缺的不是文字,是**交付前有没有一个动作会碰到它**;
- **B 类(4 条)从未写过** —— 缺的是需求/IA 把"入口、控件位置、编码输入时机、路由形态"当成**同等级事实**。

把 B 类也写进文档,只会让它们变成第 8、9、10、11 条"写了 13 次仍然发错"。**A 类才是主要矛盾。**

## 1 · 21 条现象逐条判定

**证据边界**:全部为**静态源码核验**。本轮未启动 DEV/浏览器,凡涉及"当时到底怎么崩的""当时提示是否真的弹出",
一律标 `UNVERIFIED_REQUIRES_EVIDENCE`,不猜旧实现。

### platform-admin(现象 1–10)

| # | 现象 | 状态 | 当前源码事实 |
|---|---|---|---|
| 1 | 启停/刷新按钮在内容底部 | **CONFIRMED · 已修** | `ExternalSystemDetail.tsx:173-187`、`ProviderProfileDetail.tsx:120-134` 均改为 `Card extra`(header 右侧) |
| 2 | provider 基础详情在 Tab 外 | **CONFIRMED · 已修** | `ProviderProfileDetail.tsx:136-181` 两 Tab:`detail` 承载 Descriptions,`bindings` 承载列表 |
| 3 | 内部解释文字应删 | **CONFIRMED · 已修** | 两个详情组件内已无该段;`目录标记`作为字段保留,停用对象仍可读 |
| 4 | 需说明"新建绑定"业务准入 | **DEXTER_DECISION(部分)** | 见 §2 |
| 5 | 技术编码直接显示 | **PARTIALLY_CONFIRMED** | 契约已补全 `*DisplayName`(见下);**但一处未接**,见 S-1 |
| 6 | 能力属性应三列 | **CONFIRMED · 已修** | `ExternalSystemDetail.tsx:76-80` `属性/当前值/说明` |
| 7 | 能力当前值显示 `—` | **PARTIALLY_CONFIRMED** | 结构洞**已封**:`CheckedInCollaborationCatalogSource.java:131-132` 载入时强制 labels 覆盖 values;`scripts/check/external-collaboration-business-channel-contract.mjs:88,91` 静态同验;当前目录 7 个能力键集全对齐。**旧现象成因无法回溯** |
| 8 | 点 provider 崩溃 | **UNVERIFIED_REQUIRES_EVIDENCE** | 当前 `attributeValueOf/hasAttribute`(第 19-43 行)对 `additionalProperties` 形状做了防御,注释说明 generator 形状不稳。**旧崩溃栈无留痕,不猜** |
| 9 | 应与组织概览同为左树右详情 | **CONFIRMED · 已修且是真复用** | 与 `PlatformReadPage.tsx:481-533` 共用 `styles.css:74` 的 `platform-master-detail-*`,非另写一套 |
| 10 | 内部实现说明应删 | **CONFIRMED · 已修** | 页面内已无该句 |

### operations-admin(现象 11–21)

| # | 现象 | 状态 | 当前源码事实 |
|---|---|---|---|
| 11 | 选 POS 仍提示"请选择到店点餐形式" | **UNVERIFIED_REQUIRES_EVIDENCE** | 当前 `BusinessChannelTemplateDrawer.tsx:228-233` 条件渲染 + 第 185-186 行切换订单类型时清值,形状正确;**旧版本行为不可回溯** |
| 12 | "到店渠道只能使用内部接入"说明应删 | **CONFIRMED · 已修** | 文案已删;校验保留在 `BusinessChannelPolicy.java:36-37` `DINE_IN_MUST_BE_INTERNAL` |
| 13 | 页标题与 Tab 重复 | **CONFIRMED · 已修** | `ProjectBusinessChannelPage.tsx` 无重复大标题 |
| 14 | section 文案 | **CONFIRMED · 已修** | 第 100 行「经营渠道模板」、第 174 行「项目主体经营渠道」 |
| 15 | 首列进详情 + 详情/编辑两套 Drawer | **CONFIRMED · 已修** | `BusinessChannelList.tsx:175-181` 首列=渠道名称且 `onClick→onOpenDetail`;Drawer 已拆为 Detail/Edit/Create/Binding/TemplateDetail/Template 六个 |
| 16 | browser URL 含数据节点 UUID | **CONFIRMED · 已修 + 已建门** | `pageRegistry.tsx:52` `routeSegment: 'business-channels/project'\|'business-channels/store'`;`business-channel-scope.test.mjs` **fresh 跑 4/4 通过**,含"恢复数据节点路由的红变异被拒" |
| 17 | 模板编码手填/判重/不可改 | **CONFIRMED · 已修** | `BusinessChannelTemplateDrawer.tsx:119` `templateCode` 入 create body;编辑分支(第 104-111 行)只传 `templateName` |
| 18 | 渠道名称应为首列 | **CONFIRMED · 已修** | 同 15 |
| 19 | 渠道编码手填 | **CONFIRMED · 已修** | `BusinessChannelCreateDrawer.tsx:134` 必填输入 |
| 20 | 内部渠道显示"待外部授权回填" | **CONFIRMED · 已修** | `BusinessChannelDetailDrawer.tsx:178` 限定 `authenticationKind==='EXTERNAL_GRANT'` 才显示 |
| 21 | 内部渠道显示"草稿" | **CONFIRMED · 已修 + 已回填** | 策略改为 INTERNAL 创建即生效;`V20260819_230000_004__business_channel_internal_effective_repair.sql` 只提升「无绑定 + 无停用原因 + 模板启用」的历史行,条件收得住 |

## 2 · 现象 4 的独立回答:什么情况下可以新建绑定

Dexter 已明确**这不是权限问题**。从冻结规格与 owner 源码独立推导,准入是**三层业务条件**:

1. **provider 在当前集团空间已启用** —— 未启用 `PROVIDER_NOT_ENABLED`(`BusinessChannelPolicy.java` 外部分支);
2. **目标节点类型在 provider 的 `bindableNodeTypes` 内** —— 否则 `NODE_TYPE_NOT_BINDABLE`;
3. **按 `authenticationKind` 分三态**(`CollaborationBindingPolicy.java:31-56`):
   - `EXTERNAL_GRANT`:必须给 `capabilityClass` 且在 `businessScope` 内;`externalOwnerId` **可空**,创建后落 `PENDING_AUTHORIZATION`,由适配器回调回填才生效;
   - `INTERNAL_MAPPING`:`externalOwnerId` **必填**,创建即 `EFFECTIVE`;
   - `NO_MAPPING`:`externalOwnerId` **禁止**,创建即 `EFFECTIVE`。

⚠️ `catalogStatus=PLANNED` **不是**准入条件(E-33);门店停用**不阻断**新建(BR-31)。

**需 Dexter 裁决的只有一件**:这三层条件要不要**在 P6 界面上主动告知用户**(例如新建按钮旁写明"需先启用该接入档案"),
还是维持"提交后返回 typed problem"。当前是后者。**这是产品语义,不是工程问题。**

## M-1 · 防复发不对称:出问题最多的 App,UI 事实零组件测试

**事实(实测)**:

| App | feature | 架构测试 | **组件测试** |
|---|---|---|---|
| platform-admin | external-collaboration | `external-collaboration-collection.test.mjs`(4 条) | `OwnerBindingList.test.ts` · `OwnerBindingDetailDrawer.test.ts` |
| operations-admin | business-channel | `business-channel-scope.test.mjs`(4 条) | **零**(`ui/*.test.*` 无匹配) |

**21 条现象里 11 条出自 operations-admin**,而该 feature 的六个 Drawer、两个页面、一个列表**没有任何组件级测试**。
现象 15/17/18/19/20 全部属于"点一下才知道对不对"的事实,现在**只有人能发现**。

对照:platform-admin 侧同类事实有两个组件测试,且 `external-collaboration-collection.test.mjs` 已把
「服务端 Page + 服务端 total」「刷新走 foundation 生命周期」「共用 master/detail 不复制」变成门 ——
**这三条正是上一轮 M-2/S-1 的固化**,做得对。

⇒ **同一批交付,两个 App 的防线厚度差一整层。** 这是「只修用户点名的那一端」的又一次实例。

**最小修复**:为 operations-admin 的 `BusinessChannelList` 与 `BusinessChannelDetailDrawer` 补组件测试,
至少断言:**首列 dataIndex 是 `channelName` 且其 onClick 打开详情**;**内部接入渠道详情不出现"待外部授权回填"**。
**可复验反例**:把首列 `dataIndex` 改回 `channelCode`,或去掉 `authenticationKind` 判断 —— 测试必须转红。
**不需 Dexter 裁决。**

## S-1 · 「contract 补中文名称」只接了一半,同根漏一处

**位置**:`apps/frontend/platform-admin/src/features/external-collaboration/ui/ExternalSystemDetail.tsx:218`

```
{key: 'catalog', label: '目录标记', children: system.catalogStatus === 'AVAILABLE' ? '可用' : '计划中'}
```

**仓内事实**:`contracts/openapi-source/collaboration.schemas.json` 的 `ExternalSystemView`
**required 里就有 `catalogStatusDisplayName`**;同一 feature 的 `ProviderProfileDetail.tsx:163` 正确使用了
`profile.catalogStatusDisplayName`。全仓 `catalogStatusDisplayName` **只被引用 1 次**。

⇒ 同一个枚举、同一个 feature、**两个真相来源**,其中一个是前端自造的 label map ——
正是现象 5 要求消灭的形态。违反前端规范 §3-A(同一件事只能有一种写法)与 §3-E(同一事实只有一个住址)。

**影响面**:今天用户看到的中文是对的(**不是可见缺陷**),但契约改文案时该处不跟随,且它是"前端可以自己拼 label"的活样板。

**最小修复**:改用 `system.catalogStatusDisplayName`。
**可复验反例**:把契约里该字段的中文改成别的,断言页面跟随变化 —— 当前不会变。
**同根扫描**:operations-admin 侧已全量走 `*DisplayName`(`ProjectBusinessChannelPage.tsx:148,158`、
`StoreBusinessChannelPage.tsx:121,126`),**该端无同类问题**;`enablementStatus` 的"已启用/已停用"
四处前端直译属二值 UI 状态,契约未提供 displayName,**不计入本条**。
**不需 Dexter 裁决。**

## S-2 · B 类四条现象暴露:需求/IA 没把"入口与控件位置"当成同等级事实

现象 ①(按钮位置)、⑮后半(详情/编辑两套 Drawer)、⑲(渠道编码输入时机)、⑯(路由形态)
在 IA 与交互工件里**命中数均为 0**。

这不是"作者忘了写",是**模板里没有它们的位置**:冻结规格逐条定义了领域对象、BR、UC、状态机,
而"这个动作从哪进""控件放在 header 还是 footer""编码谁填、什么时候填""路由带不带数据节点"
不在任何一张必填表里。

⚠️ **但修法不是"再加四行文字"** —— 见 §0:写 13 次的那条也没防住。正确修法见 §3。

## N 级(3 条)

- **N-1** `ProviderProfileDetail.tsx:93` 把 `adminDrawerSurfaceProps` 展开在**非 Drawer** 的内联详情面板上。
  该 props 是 Drawer surface 契约,用在 Card 内容区属语义误用,当前无可见后果,建议移除或换用详情面 props。
- **N-2** `ExternalCollaborationPage.tsx:137` 的 `<span hidden>{String(locked)}</span>` 是为消 lint 而渲染
  `useOverlayLock()` 返回值。建议改为真正消费它(锁定时禁用树交互)或不取返回值。
- **N-3** brief 中三个路径写错:`src/OperationsApp.tsx`(实为 `src/app/OperationsApp.tsx`)、
  `modules/businesschannel`(实为 `modules/business-channel`)。不影响结论,但下轮交接前应校准。

## 3 · 防复发:问题族 → 最小防线 → 落点 → 红例

**设计原则**(由 §0 推出):**只有"交付前必然会碰到它"的东西才算防线。** 再写一遍文档不算。

| 问题族 | 最小防线 | 落点 | 红例(必须能打红) | 边界/成本 |
|---|---|---|---|---|
| 首列入口、Tab 位置、详情/编辑 Drawer | **组件测试断言首列 dataIndex + onClick 目标** | `features/*/ui/*.test.ts` | 首列改回编码列 ⇒ 转红 | 每个列表 1 条,分钟级。**这是本轮唯一能挡住 13 次文档没挡住的东西** |
| 枚举中文显示 | **扫描:UI 层禁止出现 `xxx === 'ENUM' ? '中' : '文'`,凡契约有 `*DisplayName` 必须用** | 架构测试 | `ExternalSystemDetail:218` 当前即可打红 | 已有 `business-copy-boundary.test.mjs` 样板,扩一条即可 |
| 能力值 `—` 语义 | **已闭**:载入门 + 契约检查双验 labels 覆盖 values | 后端 + `scripts/check` | 目录删一个 label ⇒ 载入抛错 | 无新增成本,**保持** |
| 条件字段/状态机(POS、内部/外部、生效) | **owner typed policy 为唯一真相 + 前端只做条件渲染**,禁止前端复制规则 | `BusinessChannelPolicy` + 组件测试 | 前端加一条与 owner 不同的校验 ⇒ 需能被发现 | 当前形状已对,补测试即可 |
| 模板/渠道编码 | **需求阶段固定四件:谁填、何时填、唯一性 scope、可否改** | 详设模板 §5 增列 | 编码列改回自动生成 ⇒ 转红 | 已实现,补测试锁住 |
| browser route / data scope | **已闭且是最佳样板**:架构测试含红变异 | `business-channel-scope.test.mjs` | 恢复 UUID 路由 ⇒ 4 条测试转红 | **21 条里唯一被机器挡住的一条** |
| 两个 App / PROJECT-STORE sibling | **同族全集清单进详设**(已在新模板 §3 ④ 列) | `implementation-design-template.md` | 全集写"举例"而非清单 ⇒ review 打回 | 已落地,本轮 M-1 即它的第一个反例 |
| 静态 vs 浏览器证据边界 | **观察句标证据档位,选能证伪的最低档**(已在新 IA 模板 §2.2) | `ia-design-template.md` | 观察句写成只能靠浏览器做 ⇒ review 打回 | 已落地 |

**明确区分:**
- **真正降低漏项的**:组件测试(首列/条件显示)、枚举扫描、架构测试红变异 —— 三者都**会在交付前被跑到**;
- **只增台账不提升正确性的**:再写一份"UI 检查清单"文档、在 IA 里第 14 次强调首列 —— ⛔ 不做;
- **需 Dexter 裁决的**:只有现象 4 的"准入条件是否前置告知用户";
- **按现有规范即可执行的**:S-1 改一行、M-1 补两个组件测试、N-1/N-2 清理。

## 4 · 授权边界

本轮为**静态独立分析**:未执行 reset、seed、DEV、L2、UAT、浏览器或任何 Git 动作;
唯二运行的是只读检查 —— `node --test business-channel-scope.test.mjs`(4/4 通过)与既有静态门。
`NO-GO` 仅表示**问题族与防复发分析尚未闭合**,不表示当前实现被否决,也不授权任何实施、数据或发布动作。
现象 4 的产品语义、以及是否接受"组件测试作为 UI 事实防线"的成本,仍由 Dexter 裁定。
