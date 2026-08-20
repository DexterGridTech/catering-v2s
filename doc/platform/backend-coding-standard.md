# 后台编码规范 · 唯一权威

> **这是后台编码规范的唯一内容源。** 其他地方(项目记忆、skill、评审文档)**只放指针,不复述内容** ——
> 同一条规则写两处必然漂移。
>
> **规则只有一种写法:自带反例的禁止句。** 不写「应当避免过度设计」;
> 写「网络 I/O 不得出现在 `@Transactional` 方法内。**反例:** 方法带 `@Transactional` 且体内有 HTTP 调用」。
> 判断不了对错的句子不进本文。
>
> **上限**:本文超过"半小时读完",或门超过"分钟级",就是在重建刚退役的那套控制面。

---

## 0 · 怎么用这份文件

| | |
|---|---|
| **规则来源** | 2026-08-14 的一轮后台全量评审,33 条实例(M-01~12 / S-01~20 / N-01)归纳成十类 |
| **实例登记册** | `doc/review/platform/2026-08-14-v2s-backend-code-review-findings-claude.md` |
| **分流与批次** | `-backend-findings-triage-and-sequencing-claude.md` · `-part-one-coding-standards-batches-claude.md` · `-part-two-batches-claude.md` |
| **门的清单** | `tools/verify-gates/verify.mjs`(⛔ **门存在 ≠ 门生效**,必须在 command 列表里) |

**十类里只有四类能变成门。** 其余六类只能靠 review —— 这不是偷懒,是那六类的判据需要理解上下文,
做成关键词匹配就会变成"门全绿而功能是坏的"。

---

## 1 · 能变成门的四类

### 1-C · 契约声明必须传导到生成物

**规则**:契约里声明的类型约束,必须在生成物里表达为对应类型;不得声明了却生成成裸 `string`。

**反例**:OpenAPI 里 `format: uuid` 的字段,在生成的 Java / TS 里是 `String` / `string`。

**为什么**:声明了不传导,等于把类型系统关掉 —— 消费侧只能手搓字符串,编译器一个都拦不住。

**门**:`edge-codegen --check`

### 1-D · 错误不得伪造原因

**规则**:`catch` 之后不得丢弃 cause,也不得把捕获到的异常改写成不相干的原因。

**反例**:`catch (SQLException e) { throw new Problem("VALIDATION_ERROR", "参数不合法"); }` —— cause 丢了,原因也不是真的。

**为什么**:排障时看到的是伪造的原因,真因永远查不到。

**门**:PMD 单规则 `PreserveStackTrace`(⚠️ **只上这一条规则,不上整个 PMD 规则集** —— 规则集要 curate,三万行存量上会产出几百条待分诊)

### 1-H · 分层命名与 split package

**规则**:同一个包名不得跨 Gradle 模块出现。

**反例**:`src/main/java/.../catalog/application/` 与 `modules/catalog/src/main/java/.../catalog/application/` 同名。

**为什么**:split package 在模块化下是未定义行为,且让"这个类在哪个模块"无法从包名判断。

**门**:文件系统级判据(拆完后 `src/main` 与 `modules/*/src/main` 无同名包)

### 1-I · 格式

**规则**:排除生成物后,**>120 字符的行归零**。

**工具**:Spotless + palantir-java-format。

**排除范围**:`app/edge/generated/wire/` 下的签入生成文件、`build/generated/sources/**`。

**门**:`spotlessCheck`

⛔ **格式批必须单独成批,不与任何语义修改混提。** 且**排在所有以 `文件:行号` 为坐标的批次之后** ——
登记册整篇是行号坐标,一次全仓重排会让所有未处置条目的施工图作废。

**验收判据(自带反例)**:

| 判据 | 反例 |
|---|---|
| 格式化前后各编译一次,`javap -c -p` 去掉 `LineNumberTable` 后逐字节相同 | 有差异 → 改到了逻辑 |
| 重新跑一次代码生成后 `spotlessCheck` 仍绿 | 生成后变红 → 生成物没排全 |
| 排除生成物后 >120 字符归零 | 仍有长行 → target 路径没覆盖全 |

---

## 2 · 只能靠 review 的六类

### 2-A · 同类路径一致性

**规则**:一组承担同一职责的路径,其**安全与并发处理必须一致**。

**反例**:六个同族端点,其中三个不传 scope;同一张表的多条 UPDATE 路径,只有一条加锁。

**为什么**:不一致的那一条就是漏洞入口,而且因为"其他几条是对的"而极难被发现。

**实例**:M-11 根因 · S-19 · M-09

### 2-B · 失败必须可见

**规则**:任何"**什么都没做**"的路径不得返回成功。

**反例**:超过上限静默截断第 5001 项后返回 200;复制九个 section 里七个是空操作,却报 `skipped` 为空;
告警条件写了但永久静默。

**为什么**:用户以为做了,实际没做,而且没有任何信号。这类缺陷不会被任何门抓到。

**实例**:M-04 静默截断 · M-09 静默空操作 · S-11b 空操作报成功 · S-03 告警永久静默

### 2-C · 事务边界

**规则**:**网络 I/O 不得出现在 `@Transactional` 方法内。**

**反例**:方法带 `@Transactional`,体内有 HTTP 调用或跨服务 owner 调用。

⚠️ **ArchUnit 抓不到**:根因是写路径跨四层各带 `@Transactional`,**任何单一位置都看不出网络 I/O 落在事务里** ——
必须顺着调用链读。

**实例**:M-01

### 2-D · 该用生成物却手搓字符串

**规则**:凡生成物已提供类型的地方,不得手写字符串字面量。

**反例**:生成物已有 `operationId` 常量,消费侧仍写 `"getOperationsCatalogItem"` 字符串。

**关系**:这一类**依赖 1-C** —— 先修 generator 让类型传导,119 个手写点会自己变红。**顺序不能倒。**

**实例**:M-08 消费侧

### 2-E · 不重复造轮子

**规则**:同一职责的工具代码不得多份并存。

**✅ 2026-08-16 更正 —— 原文写反了,且错误地署了 Dexter 的名。**

原文是「只接受工具类合并,不接受为消除少量重复而造抽象」,并标注「Dexter 已裁」。
**Dexter 的实际立场恰恰相反**:「该抽象到 foundation 的需要抽象,现在这个阶段不抽象,
后面走的会更乱」「我一直一直很反对重复造轮子,有的造的一样有的造的还有缺陷」。
那句「Dexter 已裁」是我把自己的判断署了他的名,**已撤回**。

**现行规则**:横切关注点(幂等回执、锁助手、事务样板)**必须统一提供,不得各 owner 自实现**。

**反例(实测,不是假设)**:
- 8 个 `*CommandReceiptService`,918 行,**约 95% 逐字相同**
- 11 张回执表用了 **6 种 scope-key 约定**
- 并发语义三家不同:catalog 的回执写入带 `ON CONFLICT ... DO NOTHING`,
  inventory 与 production **没有** ⇒ 两个请求同时首次使用同一幂等键时,
  catalog 正确重放,另两家抛 `DuplicateKeyException` 且无 advice 处理 → **用户拿到 500**
- 三个跨 owner 锁常量在 catalog 与 inventory 手工复制,源码注释写着
  「Must stay byte-for-byte compatible」—— **唯一强制力就是这句注释**,全仓零门

**根因不是纪律,是位置**:`modules/foundation` **没有 JDBC 依赖**,回执与锁助手无处安放。
一个尽职的工程师在这个约束下唯一能做的就是复制。**先给 foundation 加 JDBC 依赖,
再谈"不要重复"才有意义。**

⚠️ **仍然不该合并的**:形似而语义不同的。反面对照:六个 `CreateOperationsOrganization*`
组内差异 12–36 行 / 共 20–39 行 —— 那是**六件不同的事**,不是一件事的六份拷贝。
判别口径:**逐字节相同或近乎相同 ⇒ 抽;语义不同只是形似 ⇒ 不抽。**

**实例**:S-07 · S-08 · S-09 · S-10 · S-17
⚠️ S-10 切换会改已落库回执的物理格式,**需单独裁定**。

### 2-F · 过度设计

**规则**:新增抽象若只有单一实现,须书面说明理由;死代码按**可达性**删,不按命名启发式删。

**反例**:按名字配对删除"看起来是旧版"的方法 —— 已被证伪的实例:`stageAsset` 与 `stageWorkspaceAsset` **两个都是死的**。

**为什么**:按命名猜会删错;而"新增抽象"这条不适用于 `api` 包 ——
实测 38 个顶层接口 33 个在 `api` 包,**那正是跨模块唯一合法的耦合点**,不是过度设计。

**实例**:S-06(是删除不是重构)· S-04 · S-05

### 2-G · 浏览器 URL 不构成 API owner 授权

**规则**:API 资源路径可以携带 `projectRef`、`storeRef` 等 owner ref 来选择业务聚合，
但 edge 必须从已认证会话解析允许的数据节点，并在每个读写入口复核 path/body 中的 owner ref。
浏览器页面 URL 只定位工作空间与页面，不能成为服务端授权输入，也不能因为前端已校验而省略 edge 复核。

**反例**:项目/门店经营渠道页把节点 UUID 放进浏览器 URL；若 controller 只调用
`requireWorkspaceRead` 后直接执行 `/projects/{projectRef}/business-channels` 或
`/stores/{storeRef}/business-channels`，用户改 URL 即可把另一节点 ref 传入查询，形成跨节点读取入口。

**最小解**:保留 API 的资源路径和生成契约；在 controller 统一走
`resolveSelectedProjectScope`、`requireScopedStore`、owner aggregate readback 等服务端复核，
并为项目列表、门店列表、渠道详情、绑定详情分别保留跨节点拒绝测试。前端稳定路由修复不能替代后端授权。

**反例边界**:这条不要求把 API 的 owner ref 从契约中删除，也不要求把所有资源 URL 改成无 ID 的形式；
它只禁止把 browser URL、query context 或 body 的客户端 ref 直接当作授权结论。读取真实 owner 事实后再把其 ref
交给 capability/grant 或 owner command，是可接受的实现。

---

## 3 · 执行顺序(有依赖,不能乱排)

```
2-F(删死代码)
   └→ 2-E(工具类合并)        必须在后:否则会去合并将死的代码
1-C / 2-D(改 generator + 全量重生成)
   └→ 前端消费侧修正           必须在后:先修 generator,前端错路自己变红
2-A / 2-B / 2-C(写规范 + 按规范扫一遍)
1-I(格式批)                  ⛔ 必须单独成批;必须排在所有行号坐标批次之后
1-H(split package)           与 1-I 同批,同属机械改动
```

---

## 4 · 明确不上的

**Checkstyle / PMD 完整规则集 / Error Prone 默认检查** —— 价值在规则集,规则集要 curate,
三万行存量上会产出几百条待分诊。**唯一例外是 1-D 的 `PreserveStackTrace` 单规则。**

---

## 5 · 维护约定

⚠️ **通用工作纪律见 `frontend-coding-standard.md` §4**(那一节不是前端专属):
`4-A` 否定式全称命题必须穷举后才能写 · `4-B` finding 必须带真实业务场景
· `4-D` 动手写新规则/新方案/新裁决前先查仓内有没有。
⛔ 内容只维护一份,本处只放指针。


- **本文是唯一内容源。** 新增或修改规则只改本文。
- **别处只放指针**:`project-memory/`、skill、评审文档一律只写"见本文",不复述规则内容。
- **新规则由实例产生**,写在修完之后 —— 没有实例的规则不进本文。
- **每条规则必须自带反例**,否则它不是规范,是口号。
