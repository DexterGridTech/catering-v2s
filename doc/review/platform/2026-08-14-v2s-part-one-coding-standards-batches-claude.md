# 第一部分 · 通用编码规范 · 批次安排 · **v2(已过一轮独立盲审,按更小方案重写)**

- **来源**:`2026-08-14-v2s-backend-code-review-findings-claude.md`(问题登记册)、`2026-08-14-v2s-backend-findings-triage-and-sequencing-claude.md`(分流)。
- **形态**:承第零批 v3 裁定——**只写缺陷事实、批次边界与验收判据,不写实施手法**。
- **审查状态**:v1 交 fresh 独立子 agent 两阶段盲审(阶段一禁读本文与分流文档、自行排批次,阶段二攻击),verdict **`NO-GO`,2 M / 9 S / 5 N**。**两条 M 均经 Claude 复核成立,本 v2 按盲审给出的更小方案重写。**
- **本文不授权实施。**

---

## 0. v1 → v2:砍掉了什么

盲审的核心指控:**这个计划本身对当前阶段过度设计**——三个自建 checker + 四个新工具,换一批规模不可知的增量发现,与刚刚退役 11070 行控制面的裁决方向相反。**Claude 复核后完全接受。**

| v1 | v2 | 复核依据 |
|---|---|---|
| 6 个批次 | **3 批 + 1 收尾** | 见下 |
| 3 个自建 checker(1-C 承载侧 / 1-D catch 扫描 / 1-A 参数一致性) | **0 个** | 1-C 在 1.2 之后冗余;1-D **有现成 PMD 规则**;1-A 只剩很窄的结构检查,不值一个 checker |
| 4 个新外部工具 | **1 个**(Spotless,且只在收尾批) | 见 §3 工具核实 |
| 10 条规范类目 | **不再作为类目表** | 规范由实例产生,写在修完之后,不需要类目脚手架 |
| **1.4 规范扫描批** | **取消** | 它**没有任何自己的缺陷**:所列"已知实例"M-11 / S-19 / S-02 在第零批,M-04 / M-09 / S-11b 在第三部分,S-03 / M-01 在第二部分,**一条不剩**。v1 自己写了"规模事先不可知" |
| **1.6 拆文件批** | **取消** | `CatalogOwnerService` 的体量是 M-03 / M-09 / M-10 / S-01 的**症状**;建模批之前拆等于固化错接缝,建模整改后还得再拆一遍。这与 Dexter「不想止血式的改」一致 |
| **1-J 新规则**(新增抽象若单实现须书面说明) | **取消** | 实测 38 个顶层接口 **33 个在 `api` 包**——那正是跨模块唯一合法通道、仓内 ArchUnit 规则赖以成立的装置。该规则会精准打在做对的地方。剔除 `api` 后触发集只剩 3–4 个,其中 `TimeProvider` 还是登记册 §4 点名表扬的 |

**净效果**:批次 6→3(+1 收尾),自建 checker 3→0,新工具 4→1,而 **M-01 / M-08 / S-02 / S-06~S-10 / S-16 / S-17 的修复一条不少**。

---

## 1. 一条必须先纠正的错误论证(v1 的旗舰,是空转的)

v1 在两处写:

> `noClasses().that().areAnnotatedWith(Transactional.class).should().accessClassesThat().resideInAPackage("io.minio..")` —— **M-01 会在测试期当场被逮住**

**这条规则永远绿,抓不到 M-01。两重原因,均已亲验:**

1. **选择集为空。** ArchUnit 的 `classes().that().areAnnotatedWith(...)` 只匹配**类级**注解。实测手写生产代码 **562 处 `@Transactional`,零个在类级**——`PlatformAssetService` 是 `public class PlatformAssetService implements ...`,注解全在方法上。
2. **改成 `methods()` 也抓不到。** `PlatformAssetService` 对 `io.minio` **零静态依赖**(全文零命中);全仓唯一 import `io.minio` 的是 `MinioAssetObjectStorage.java`,而**那个类没有 `@Transactional`**。事务方法调的是同包接口 `AssetObjectStorage`,ArchUnit 的依赖图基于**静态声明类型**,接口→实现这条边不在图上。

**结论:ArchUnit 在 1-E(事务边界)上是零,不是"半条门"。** 这是 v1 对 ArchUnit 唯一的实证支撑,现予撤销。

**ArchUnit 仍然有用,但不在这里**:它现有的 9 条依赖方向规则(`BackendModuleBoundariesTest`,196 行)是真在跑的;**跨模块 `.application` import 那条(实测 238 处,388 处走 `.api` 作对照)在 S-16 拆包之前写了也是空转**,而其中 114 处指向 `workspace/iam/application`——正是 split package 之一。真要加,是 238 处既存违规待处置,不是"只加一条规则"。**本部分不安排。**

---

## 2. 三批 + 一收尾

### 2.1 【1.1】删除批 —— 最先做

**内容**:S-06。`OperationsCatalogInventoryController` 的 `command(...)` 桥接(405 行的文件里只出现一次,就是自己的声明,零调用点);`CatalogInventoryCoordinator` 第 190–232 行约 24 个 `@Transactional public JsonNode xxx(CommandRequest)` 一行门面,及其下 `execute` → `executeWorkspaceCommand` → `dispatchWorkspaceCommand` 整条链。

**为什么排第一**:纯删除、零设计负担;**先删再抽**,否则 1.3 会去抽将死的代码。两批的文件集确有交叠——`CatalogInventoryCoordinator` 既是删除目标,又含 S-08 的 owner 守卫标识。

**⚠️ 不要按命名启发式删。** 登记册原文的配对已被证伪:`stageAsset` 与 `stageWorkspaceAsset` **两个都是死的**。**按可达性删,清单现算。**

**可达性怎么算**:IDE 的 Find Usages 即可——**门是编译器,删错编译期就红**。
**不要**为此搭 headless 管线:IntelliJ 的 `inspect.sh` 需要关闭正在运行的 IDEA 实例、写 profile XML、配 project SDK、索引整个多模块工程。**既然门是编译器,候选清单交互式查就够**;搭管线正是"分钟级零基建"要滤掉的。

**验收判据(自带反例)**

| 判据 | 反例 |
|---|---|
| 删除后编译通过、既有测试全绿且**未被修改** | 编译失败(删到了活的);或测试被改动 |
| 删除清单由**可达性**产出 | 清单里出现"名字带 legacy 所以删"这类理由 |
| 本批**只有删除** | diff 里出现新增或修改的方法体 |

---

### 2.2 【1.2】生成链批 —— 解锁第三部分

**内容**:契约 `contracts/openapi/**` 声明 `"format": "uuid"` 223 处;生成的 TS 中带 uuid 语义 **0**;生成的 Java 中 `UUID xxxRef` **0**、`String xxxRef` **150**;生产代码手写 `UUID.fromString` **119 处**,其中 25 处所在文件完全无 `catch (IllegalArgumentException|RuntimeException)`。

**两个 generator 的丢弃点(盲审实测,已复核)**:`scripts/generate/edge-codegen.mjs` 第 426–429 行 `if (schema.type === "string" || Array.isArray(schema.enum)) return "String";`;`scripts/generate/catalog-inventory-p1.mjs` 第 1323–1326 行只对 `format === "binary"` 分叉,uuid 落到 `"String"`。

**顺序硬要求**:**必须在第三部分 3-7(前端六条必 422 的提交路径)之前**。反过来就是手工修 119 处症状。

**⚠️ 一个 v1 漏掉的行为变化(盲审提出,应写进本批)**:`String → UUID` 之后,解析失败点从 owner 上移到 Jackson 反序列化,**错误码会从 422 变成 400**。契约的错误码与前端的错误处理要同步,否则是把一个缺陷换成另一个。

**⚠️ 契约侧还有一个更大的洞**:盲审实测 `contracts/openapi/**` 共 **436 个 `*Ref` 属性,274 个根本没有声明 `format: uuid`**(典型形态 `{"type":"string","description":"design-bound field"}`),它们**全部来自 `catalog-inventory-p1.mjs` 的 `stringField(...)`**。所以"契约声明了而生成物丢掉"只是一半,**另一半是契约自己就没声明**——修复点同样落在这个 generator,**归本批,不另立批次**。

**验收判据(自带反例)**

| 判据 | 反例 |
|---|---|
| **红夹具**:把业务编码塞进 `*Ref` 字段**必须编译不过** | 只断言"重新生成后还能编译" —— 那是存在性判据,测不到东西 |
| 契约里 `*Ref` 属性**全部**声明了 `format: uuid` | 仍有 `*Ref` 是裸 `{"type":"string"}` |
| 119 处手写转换中**绝大多数已删除或简化** | 原样保留 → 只加了类型没改消费侧,收益没兑现 |
| 错误码变化(422→400)**已同步到契约与前端** | 契约仍写 422 而实际返回 400 |
| `edge-codegen --check` 仍绿 | 生成物漂移 |

**明确不指定**:Java/TS 各映射到什么类型;25 处无 catch 怎么收口;generator 怎么改。

**明确不做**:不为 1-C 建"契约约束声明数 vs 生成物承载数"的比对门。**本批做完,编译器就是门**,而 `edge-codegen.mjs` 第 875 行的 `--check` 已经逐字节钉死了 253 个签入生成物。再建计数门是已退役控制面的**分母判据**形态,零增量。

---

### 2.3 【1.3】抽取与收紧批 —— 依赖 1.1

**内容**:S-07 audit history 六模块同构 · S-08 owner 守卫与 JSON 工具复制 3–5 处 · S-09 SHA-256 十三个 helper / 十七处计算点(两处手搓 Hex,同包已在用 `HexFormat`)· S-17 十五个邀请 Operation(组内差异一个枚举常量)· S-05 生产类型里的测试专用成员。

**S-10 从本批拆出单列。** 它改的是**已落库回执的物理格式**(Dexter 已裁定:不做兼容、清库),那是**数据操作**不是代码抽取,评审时必须能与纯代码抽取分开看。

**合并边界(Dexter 四条,缺一即不动)**:无业务语义、无状态、可单独单测、抽走后任何 owner 都不少一条业务规则。
**明确不该合并的五类**见登记册 §5;**反面对照**:`CreateOperationsOrganization*` 六个虽同名式,组内差异 12–36 行 / 共 20–39 行,**携带真实 per-scope 逻辑,不要合**。

**⚠️ CPD 的真实能力(v1 的宣称不成立,盲审实测,已复核其推理)**

v1 写"S-07 / S-08 / S-09 / S-10 / S-17 全是人工翻出来的,CPD 几秒能列全"。实际:

| finding | CPD 能不能抓 |
|---|---|
| S-07 | **能**,两份 `projection` 逐行相同,约 192 token |
| S-10 | **能**,约 130 token 相同串 |
| S-08 | 大概能(未实测) |
| **S-09** | **结构上不能**。缺陷是"该用 `HexFormat` 却手搓",要和**另一种实现**比;CPD 是 duplicate detector,没有这个能力 |
| **S-17** | **不能,且会给出误导性命中**。阈值 100 时报的是那 15 个文件共享的 **package + import 头**(约 115 token),业务主体只有约 60 token。`Cancel` 族每文件才 4 行 |

且 `--minimum-tokens` **官方无默认值**,**阈值本身就是 curate 成本**——v1 的"零 curate,只有一个参数"把唯一的成本说成了没有成本。

**结论:CPD 作一次性发现的辅助手段,不设门,不作为本批清单的权威来源。** 人工清单仍是下限;CPD 的补充价值主要在 S-07/S-08/S-10 这类整段复制。

**验收判据(自带反例)**

| 判据 | 反例 |
|---|---|
| 每处合并能逐条对上四条边界 | 任一处说不清"抽走后哪个 owner 不少规则" |
| 抽出的工具类**有独立单测** | 只有调用方的集成测试覆盖它 |
| S-05 修复后生产 `@Service` **无法被构造成半 null 实例** | 伸缩构造器仍在,或 `default` 方法体仍抛 `UnsupportedOperationException` |
| **未触碰**登记册 §5 那五类 | 五类中任一被合并 |
| S-10 **单独提交** | 与代码抽取混在同一次改动里 |

---

### 2.4 【收尾】格式 —— **排在所有以登记册坐标为输入的批次之后**

**这不是与前三批并列的第四批,是整个 backlog 做完之后的一次性收尾动作。**

**为什么必须排最后(v1 标"无依赖"是错的)**:**登记册整篇是 `文件:行号` 坐标,那是后面每一批唯一的施工图。一次全仓重排会同时作废全部坐标。** 而坐标**已经在漂**——登记册记 S-01 的反向优先级在 `CatalogOwnerService.java:2699`,**本会话实测已在 `:2750`**(Codex 正在实施第零批)。

**现状(实测,排除生成物)**:手写生产文件 **313**、代码 **30772 行**、>120 字符 **5207 行**、>200 字符 **1881**。仓内 **Java 侧零格式化/静态检查工具**(前端根目录另有 `eslint.config.mjs`)。

**工具:Spotless + palantir-java-format。** `spotlessCheck` 是**本部分唯一新增的门**。

**⚠️ v1 的选型理由要改,前置条件要补**:

- v1 写"GJF 对 records / switch 表达式 / text block 处理较差"——**无一手来源,且结构上不成立**:palantir 是 GJF 的 fork,共用 javac 内部解析器,解析层缺陷会被继承。**唯一站得住的理由是"120 列 vs 硬编码 100 列"。**
- **v1 完全没提落地前置条件**:GJF 官方明文 JDK 16+ 需要六条 `--add-exports=jdk.compiler/...`;palantir 的 Java 21 支持要求 **Gradle daemon 本身跑 21**,而本仓 `build.gradle.kts` 用的是 **toolchain 21**——**toolchain 只管编译 JVM,不保证 daemon JVM 是 21**。这一条能让 `spotlessApply` 在别人机器上直接起不来。
- **"零 curate"只对 formatter 规则成立,对接进构建不成立。**

**排除范围(v1 漏了一路)**:`src/main/java/.../app/edge/generated/wire/` 下 **253 个签入生成文件**;**以及 `build/generated/sources/**`** —— `build.gradle.kts` 第 48–51 行把两个生成目录注册成 `java.srcDir`(当前 45 个 `.java`),而 Spotless 官方说明 target「usually inferred automatically from the java source sets」,会把它们吃进来。v1 只数了 `src/` 下那 257 个。

**排除会不会造成"45% 生产代码永不格式化"**:**不会**。按文件数 45%,但按行数生成物只占约 8%(约 2700 行 / 33562),且没人读。

**同批一起做**:S-16 split package(6 个包名跨 Gradle 模块重复,已亲验**共用不承重**——app 侧引用的 module 侧类全是 `public`,零 FQN 冲突);S-18 扩展名(`contracts/openapi/` 下 62 个 `.yaml` 首字符是 `{`)——**S-18 与 1.2 动 generator 时一并处理更省**。

**验收判据(自带反例)**

| 判据 | 反例 |
|---|---|
| **格式化前后各编译一次,`javap -c -p` 输出去掉 `LineNumberTable` 后逐字节相同** | 有差异 → 改到了逻辑。**v1 的判据"diff 只含格式变更"在 30k 行 diff 上不可判定,已作废** |
| **重新跑一次代码生成后 `spotlessCheck` 仍绿** | 生成后变红 → 生成物没排全(注意 `build/generated/sources/**`) |
| 排除生成物后 >120 字符的行归零 | 仍有长行 → target 路径没覆盖全 |
| S-16 拆完后 `src/main` 与 `modules/*/src/main` 无同名包 | 仍有共用包名 |
| **本批之前,登记册里所有以行号为坐标的条目已处置或已重新定位** | 有未处置条目仍以旧行号为施工图 |

**明确不建议上的**:Checkstyle / PMD 规则集 / Error Prone 默认检查——价值在规则集,规则集要 curate,3 万行存量上会产出几百条待分诊告警。**门是分钟级的,为它做的分诊不是。**
**唯一例外**:若要覆盖 1-D(错误不得伪造原因),**PMD 已有现成规则 `PreserveStackTrace`**,官方描述与 1-D 定义一字不差,且正中 S-02。**要它就开这一条 rule,不要自建 checker。**

---

## 3. 规范怎么写(取代 v1 的"类目表"与"扫描批")

**规范由实例产生,写在修完之后**——这是 v1 §0.1 自己论证过的,但 v1 又为它建了一个批次和三个 checker,自相矛盾。**v2 取消那个批次:每修完一条缺陷,在同一个规范文件里补一段,含那次的实例与反例。**

**能变成门的,门就是规范**(不再单独写句子):

| 规范 | 门 |
|---|---|
| 契约声明必须传导到生成物 | **1.2 做完后编译器即是门** + `edge-codegen --check` |
| 错误不得伪造原因 | **PMD `PreserveStackTrace`** 单规则 |
| 格式 | `spotlessCheck` |
| 分层命名(包名跨模块) | S-16 拆完后可由文件系统级判据检查 |

**只能靠 review 的,写句子,由实例产生**:

- **同类路径一致性** —— 一组承担同一职责的路径,其安全与并发处理必须一致。实例:M-11 六个端点三个不传 scope;S-19 同表 UPDATE 有的带 version 有的不带;M-09 owner 写的键集与复制读的键集对不上;**S-01 同一对象两处优先级相反**。
- **失败必须可见** —— 任何"什么都没做"的路径不得返回成功。实例:M-04 静默截断第 5001 项;M-09 局部复制 7/9 空操作且 `skipped` 恒空;S-11b 裸 `ON CONFLICT` 报成功;S-03 告警永久静默。**这一条没有任何门,只能 review 时逐条问「这个分支什么都没做的时候,调用方怎么知道」。**
- **事务边界** —— 网络 I/O 不得在 `@Transactional` 内。实例:M-01。**ArchUnit 抓不到(见 §1),只能 review。**

**载体**:一个规范文件是唯一权威;门只实现其中机器能便宜验的子集;skill 与项目记忆只放指针。
**上限**:总量超过"半小时读完"、门超过"分钟级",就是在重建刚退役的那套控制面。

---

## 4. 一条必须补进来的遗漏

**S-01 的三对方向相反的优先级,v1 六个批次一个都没装。**

- 它**不是**建模问题的一部分,是纯代码一致性缺陷,**今天可达**;
- 亲验仍在:`CatalogOwnerService.java:2750` 的 `firstText(sku, "code", "skuCode")` 落在 `skuStructureFingerprint` 内(注释自称 *Stable product compatibility bit*),而同文件另外五处是相反顺序;
- 登记册已论证该指纹的消费者是**硬判定**——不等就 `BLOCKED` + `STRUCTURE_INCOMPATIBLE`,**直接拒绝复制**。

**按缺陷修,归"同类路径一致性"的实例,不要推给第三部分建模批**——那等于让一条今天会产生错误业务判定的缺陷,搭上一个可能不发生的大批次。**建议并入 1.3 或单独一条。**

---

## 5. 批次依赖

```
1.1 删除批
   └→ 1.3 抽取与收紧批        必须在后:否则会去抽将死的代码

1.2 生成链批
   ├→ 第三部分 3-7(前端六条)  必须在后:否则是手工修 119 处症状
   └→ 收尾批的 S-18 扩展名     同时动 generator 更省

S-01(补进,见 §4)          今天可达,不依赖建模批

收尾 · 格式批                **必须排在所有以登记册行号为坐标的批次之后**
                             (含第二、第三部分),否则一次重排作废全部坐标
```

**三批的规模都不预先承诺**:清单由可达性分析与实际扫描产出,人工清单只是下限。

---

## 6. 审查记录与授权边界

**盲审 verdict `NO-GO`(2 M / 9 S / 5 N),Claude 亲验复核后全部或部分接受。** 其中三条由 Claude 独立复核确认:

1. **ArchUnit 事务规则空转** —— 562 处 `@Transactional` 零个在类级;`PlatformAssetService` 对 `io.minio` 零静态依赖;唯一 import 者 `MinioAssetObjectStorage` 无 `@Transactional`。**两重全部成立。**
2. **1-J 打在正确架构上** —— 38 个顶层接口 **33 个在 `api` 包**。
3. **坐标已在漂** —— S-01 从登记册记的 `:2699` 漂到实测 `:2750`。

**盲审自述未覆盖**:本机无 gradle / spotless / PMD / Spectral / IntelliJ,**所有工具行为结论来自官方文档一手来源**,CPD 的 token 数来自其自写的近似 Java 词法器(非 PMD 本体),**相对关系余量较薄(头 115 > 阈值 100 > 主体 60),建议实施方用真 CPD 复测**;未读分流文档,故跨部分排序未能确认;S-08 的重复面未逐文件实测;238 处跨域 import 未逐条判定是否违规。

**Claude 亲验状态**:格式统计、生成物位置与数量、`@Transactional` 的类级/方法级分布、`io.minio` 的依赖面、顶层接口与 `api` 包分布、S-01 的当前行号——本会话实测。**工具的 API、版本号与实际行为未验证。**

**按两轮硬上限,本 v2 尚可再过一轮;若不过则以 `SELF_DECIDED` 收口。** 批次范围与时机由 Dexter 裁定。
