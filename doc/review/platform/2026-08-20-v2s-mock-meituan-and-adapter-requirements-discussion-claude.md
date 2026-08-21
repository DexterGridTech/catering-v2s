# mock-meituan 与真实适配器 · 需求讨论稿

- 日期:2026-08-20 · 作者:Claude · 状态:**讨论稿,等 Dexter 裁决后才写需求规格**
- 提出人:Dexter。要求:建 mock-meituan、建真实 adapter 对接它,把**授权、解除授权、
  拉取菜单、拉取团购券、同步菜单**这些**交易前**链路打通,供后续渠道菜单使用。

> ⚠️ **本稿 v2 更正了 v1 的错误结论。** v1 只读了 `meituan-facing-route-manifest.js`(32 条),
> 据此判断"授权/解除授权缺失"。**这是错的** —— 按 all-v1 的设计,授权与解绑**本来就不是美团 OpenAPI**,
> 而是 mock 的开发者控制台能力,所以不在那份 Meituan-facing 清单里。
> 读 `docs/scenario-coverage-matrix.md` 与实际 admin 路由后更正如下。

---

## 1 · all-v1 的 mock-meituan 到底有什么(已亲验)

`mocks/meituan` 是完整子项目:Node + Express + React + SQLite,自带 admin-web、
接口目录同步、黑盒测试、UAT seed、evidence。文档定义 **6 个场景**,每个场景分
「官方接口」与「mock-only 开发者控制台能力」两层。

**三份清单要分清,混了就会得出错结论:**

| 清单 | 是什么 | 数量 |
|---|---|---|
| 接口目录 | 从美团公开文档抓取的定义 | 32 |
| Meituan-facing 实现清单 | 真正模拟美团 OpenAPI 的路由 | 32 |
| **admin / mock-auth 实现** | **开发者控制台与授权门户,不是美团 API** | **40+** |

## 2 · 你点名的五件事 vs mock 实际有的(更正版)

| 你说的 | mock 现状 | 判断 |
|---|---|---|
| **授权** | **完整实现**:`/admin/auth-sessions` + `/validate-shop` + `/agree` + `/cancel`;文档另设计了 `/mock-auth/authorize` 授权门户(v4 跳转式)。状态机 `SHOP_CREATED→AUTH_SESSION_STARTED→SHOP_VALIDATED→AUTHORIZED`,含 `AUTH_CANCELED` | ✅ **有** |
| **解除授权** | **已实现** `/admin/auth-sessions/revoke`;状态 `AUTHORIZED→AUTH_REVOKED` | ✅ **有**(但形态要注意,见 Q2) |
| **拉取菜单** | `menu` 组 6 条已实现(另有 3 条官方接口已定义未实现) | ✅ **有** |
| **拉取团购券** | `tuangou/coupon/querySetMealList` = **团单/套餐映射查询**,已实现;`/admin/deals` 管理团单与**菜单映射** | ✅ **有** |
| **同步菜单(推送)** | 场景 2 明写 **`P0` for read/query;`P1` for write/sync**,`food/save`、`batchsave` 只在文档目录、**未实现** | ❌ **唯一真缺的一件** |

⇒ **五件事里四件现成,只有"同步菜单(推送)"要新建。** 与 v1 稿的结论相反。

**另有一件我没点名但对我们很关键的**:mock 实现了完整**回调机制** ——
`/admin/callbacks/dispatch` · `/replay` · `/failed-attempts`。
v2s 的适配器要靠回调回填 `authorizationRef` 与 `externalOwnerId`,这套现成可用。

**还有一条与 v2s 高度吻合的设计**:mock 要求
「外卖店铺和团购店铺**即使映射到同一个 v4 内部 Store,也必须是两个不同外部店铺对象**」——
这正是 v2s 的 E-25/BR-29(万象城海底捞:一门店多渠道多绑定)。两边模型对得上。

## 3 · v2s 侧现状

- `MEITUAN` 在册,`catalogStatus=PLANNED`(语义 = 适配器未部署);能力 `GROUP_BUY`/`TAKEAWAY`/`TAKEAWAY_DELIVERY`;
  `MEITUAN_ISV_A`(scope 仅 TAKEAWAY)、`MEITUAN_ISV_B`(TAKEAWAY+GROUP_BUY),
  **均为 `EXTERNAL_GRANT` + `REQUIRES_ADAPTER_UNBIND`**。
- **适配器零实现**,全仓无出站 HTTP、无 mock。
- **BR-32**:主程序不直连外部;适配器**绝不读主库**,自有独立 schema 独立账号;
  主程序不得解析平台载荷、不得拼装解绑 URL 或签名。
- **§5.6 两段式解绑**:主程序请求解绑 → 适配器返回①已完成②需用户操作③失败;
  第二段适配器通知成功后才回填 `externalRevokedAt`。
- `apps/backend/` 有并列目录先例,但 `terminal-data-server` 是**空占位**,无活的第二进程。

---

## 4 · 要你裁的问题(v1 的 8 个已被仓内材料与 Dexter 指正答掉 4 个,现存 4 个)

### Q1 · mock 要不要连 admin-web(React UI)一起搬?
admin API(40+ 路由)是链路必需;**admin-web 是可选的可视化层**。

- **A** 全搬(含 React admin-web)
- **B** 只搬 mock server + admin API + seed,**不搬 UI**,要看数据用 API/日志
- **C** 先 B,不够用再补

**我建议 C。** 成本差一倍以上,而打通链路不需要 UI。

### ~~Q2 · 解除授权~~ —— **已作废(Dexter 2026-08-20 指出我读错了规格)**

我曾把「美团没有 ISV 可调的解绑接口」当成「与 §5.6 第一段对不上」。**这是错的**,
而且规格 §5.6 末尾那条 ❌ 反例写的正是这个错误(「读了美团文档后,提议主程序按跳转+回调实现解绑」)。

**正解:主程序不知道、也不需要知道平台怎么解绑。** 它只申请解绑、记 `unbindRequestedAt`、进入解绑中;
适配器按平台规则决定返回①②③,美团走**②需用户自行操作 + 不透明载荷**,主程序**原样展示不解析**。
`REQUIRES_ADAPTER_UNBIND` 告诉主程序的只是「**不能本地直接删、可能要等**」,不是「要跳转」。

⇒ **两边模型完全一致,mock 现成可用:**

| v2s §5.6 | mock 对应物 |
|---|---|
| 第一段:适配器返回②+载荷 | 适配器自行生成引导载荷,**mock 无需任何接口** |
| 第二段:用户在平台侧操作 | `/admin/auth-sessions/revoke` |
| 第二段:适配器先收到再通知主程序 | `/admin/callbacks/dispatch` · `/replay` · `/failed-attempts` |

all-v1 把 revoke 做成控制台能力而非 Meituan-facing API,正是因为现实中它就不是 ISV 调的接口 —— 与 v2s 模型吻合。

### Q3 · "同步菜单"是推还是拉?(唯一真缺的一件)
mock 只有拉,推是 `P1` 未做。你说"后面做渠道菜单用得上",听起来是推。

- **A** 只做拉(我方只读美团菜单)
- **B** 只做推(我方菜单 → 美团)
- **C** 双向

**必须你明确。** 它决定要给 mock 新建多少 Meituan-facing 路由(`food/save`、`food/batchsave`、
`foodCat/update` 等),以及适配器的写方向。

### Q4 · 适配器部署形态(影响整个工程结构)
BR-32 要"独立 schema 独立账号、绝不读主库";charter §1-A 是"一个业务 deployable、一个库"。

- **A** 独立进程 + **独立数据库**(最贴 BR-32,破"一个库")
- **B** 独立进程 + 同库**独立 schema + 独立账号**(满足 BR-32 实质,保住一个库)
- **C** 主进程内模块(**违反"不直连外部"的进程边界**,不建议)

**我建议 B。** A/B 之争是架构裁定,归你。

### Q5 · 本批边界与 `catalogStatus`
你说"**交易前**"。mock 的 `order-receive`(4 条)与 `order-status-sync`(6 条)共 10 条,
**我按"不在本批"理解,请确认。**

另:`MEITUAN` 现为 `PLANNED`。本批做完对接的是 mock 不是真美团 ——
`catalogStatus` 保持 `PLANNED` 还是翻 `AVAILABLE`?
**我建议保持 `PLANNED`**;若要区分"已对接 mock",需要新枚举值,而 E-33 刚裁定过该字段语义,**加值要你同意**。

---

## 5 · 已被仓内材料答掉、不再问你的(v1 稿里问过)

| v1 的问题 | 仓内答案 |
|---|---|
| 授权要 mock 到哪一层? | 两层都有:`/admin/auth-sessions/*` 供自动化,`/mock-auth/authorize` 门户供人工。照搬即可 |
| "拉取团购券"指哪个? | `querySetMealList` = 团单/套餐映射,**已实现**;`/admin/deals` 管理团单与菜单映射 |
| 解除授权 mock 有没有? | 有 `/admin/auth-sessions/revoke`;剩下的不确定性收敛为 Q2 |

## 6 · 我自己定的(列出让你否决,不必回答)

| 项 | 决定 | 理由 |
|---|---|---|
| mock 技术栈 | Node + Express + SQLite | 与 all-v1 同形,独立进程不污染 Java 主 deployable |
| mock 放哪 | 仓内 `mocks/meituan/` | 与 all-v1 同构,便于对照 |
| 接口保真度 | 路径/参数/响应信封照抄 all-v1 已实现部分 | 它已按公开文档对齐,重造只会引入偏差 |
| 适配器语言 | Java,与主服务同栈 | 要消费主程序 owner command 协议 |
| 回调机制 | 复用 mock 已有的 `/admin/callbacks/*` | 现成,且正是适配器回填所需 |

## 7 · 我不知道也不猜的

- ~~真实美团有无 ISV 可调的解绑接口~~ —— **本就不该问**:那是平台细节,由适配器吸收,主程序无感知
- **菜单推送的字段映射**(Q3 若选 B/C)—— 我方 SalesCollection ↔ 美团 food 结构,
  那是**渠道菜单那一批**的核心,本批只需打通调用,不该在此定

## 8 · 边界

本稿是讨论稿,不是需求规格。你裁完 Q1–Q5 我再写正式需求。
未修改任何生产代码、契约、数据库;heritage 仓 `catering-all-v1` 全程只读。
