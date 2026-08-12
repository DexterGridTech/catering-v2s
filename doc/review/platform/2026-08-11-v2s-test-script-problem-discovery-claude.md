# 测试脚本问题发现报告（Claude 独立扫描）

- 会话出处：fresh v2s-rooted 会话。本报告为唯一写入；扫描与复跑均只读，`.runtime` 复查无新增文件。
- 方法：先立分母再看内容——枚举全部测试面（**318 个测试文件**），做机械反模式扫描，再**实际复跑**可在本机运行的层，用真实失败而不是推测定性。
- 环境事实（影响可跑性判断）：本机 **docker 不可用**、**仓内无 `gradlew`**、`gradle` 不在 PATH。故 Java 层与 Testcontainers 层**未复跑**，相关结论仅来自静态阅读，已在每条中标注。

---

## 0. 结论摘要

问题**不是散落的小错**，而是集中在一处：**前端单元测试层整体不是行为测试，而是"读组件源码断言子串"的文本 grep 层**。72 个 vitest 文件里 65 个读源码文本，**0 个渲染任何组件**，全仓没有 `@testing-library` / `jsdom` / `happy-dom`，也没有 vitest environment 配置。这一条同时解释了 Dexter 说的两件事：

1. **一到测试就 fail** —— 今天实测的 4 个失败**全部**是源码拼写变了，没有一个是行为坏了；
2. **测试挡不住真 bug** —— 上一轮 `.data.data` 那个会在运行期抛 TypeError 的缺陷，穿过了全部 72 个前端测试。

其余各层反而是健康的：`scripts/` 下 133 个 node 测试全绿，L2（Playwright）是真行为测试且零硬等待，Java 层 116 个测试里只有 5 个读源码，seed dry-run 通过。**整改火力应集中在前端单元测试层，且主要动作是下线删除而不是修**。

---

## 1. 分母与实测

| 层 | 文件数 | 本次是否复跑 | 结果 |
|---|---|---|---|
| 前端 vitest（`.test.ts/.tsx`） | 72 | 是 | operations-admin **2 失败**/109；platform-admin 51 全过 |
| 前端架构（`tests/architecture/*.test.mjs`） | 12 | 是 | **2 失败** |
| 前端 feature 层 `.test.mjs` | 4 | — | **两个 runner 都不跑** |
| L2（Playwright `.spec.ts`） | 20 | 否（需浏览器与环境） | 静态阅读：健康 |
| `scripts/**` node 测试 | 133 个用例 | 是 | **全绿** |
| `scripts/check` 门 | 61 | 抽样复跑 5 个 | 全绿，红控制有效 |
| Java（`src/test/java`） | 116 | 否（无 docker/gradle） | 静态阅读：20 个依赖容器、5 个读源码 |
| seed | — | 是（dry-run） | `R5_SEED_DRY_RUN=PASS; SCENARIOS=32; FIXTURES=16` |

机械反模式扫描（318 文件全量）：**无 `@Disabled`/`.skip`/`.only`/`todo`，无 tautology 断言，仅 1 个文件有空 catch**。形态层面很干净——问题在"断言的是什么"，不在"怎么写的"。

---

## 2. 发现与处置

### M-01｜前端 58 个 feature UI 测试用源码文本冒充 UI 测试 —— **处置：本次下线删除**

**事实**：72 个 vitest 文件中 65 个用 `readFileSync`/`readFile(` 读取被测组件的**源码文本**，再用 `toContain` 断言字符串。按角色分：`features/**/ui/` **58 个**、`app/` 7 个。全仓 `render(` / `screen.` / `@testing-library` 命中数为 **0**；`node_modules` 下无 `@testing-library`、无 `jsdom`、无 `happy-dom`；两个 App 均无 vitest environment 配置。

**典型**（`operations-admin/src/features/store-management/ui/StoreManagementPage.test.tsx:54-56`）：

```ts
expect(drawer).toContain('disabled={!ready}');
expect(drawer).toContain('扩展字段加载失败，请关闭后重新进入。');
expect(drawer).toContain('extensionValues: serializedExtensionVa…');
```

**影响面**：
- 这类断言**只要重命名一个局部变量、调整 JSX 换行、抽出一个子组件就红**，而组件行为完全没变。今天 operations-admin 的 2 个失败正是如此。
- 反向更严重：它**证明不了任何行为**。上一轮 `productionTagsQuery.data?.data.data.entries` 会在运行期抛 TypeError，58 个"UI 测试"无一能发现——因为没有一个真的把组件跑起来。
- 维护成本是负收益：每次重构都要改一遍字符串，改完仍然没有行为保障。

**处置建议：58 个 feature-ui 文件本次下线删除**，不建议原地修。理由：
- "修"意味着引入 jsdom + testing-library 并逐个重写为渲染测试，那是一项独立的、体量不小的新建设，混进本次整改会把范围撑爆；
- 这 58 个文件删除后**行为覆盖并不真的下降**（它们本来就没覆盖行为），真实的 UI 行为保障在 20 个 L2 spec 上，那层是健康的；
- 保留它们的唯一效果是继续制造假红。

**需要 Dexter 裁决的一点**：是否接受"前端单元层暂时留空、UI 行为保障完全依赖 L2"。若接受，就按上述删除；若不接受，请把"引入 jsdom + testing-library 重写渲染测试"单列为一个后续工作项，本次仍先删除假测试，避免带着假绿继续跑。**这是本报告唯一需要产品/范围裁决的项。**

### M-02｜当前 2 个红的前端测试，红因与行为无关 —— **处置：随 M-01 删除**

- `operations-admin/src/features/store-management/ui/StoreManagementPage.test.tsx:56`
- `operations-admin/src/features/catalog-management/ui/CatalogManagementPage.test.tsx:152`

两处均为源码子串断言。属 M-01 的实例，不单独修。

### M-03｜4 个测试文件两个 runner 都不跑 —— **处置：本次下线删除，并补 runner 分母断言**

**事实**：`package.json` 的测试命令是
`node --test src/tests/architecture/*.test.mjs && vitest run src --exclude "**/*.mjs" --exclude "**/*.spec.ts"`。
`node --test` 的 glob **只覆盖 `src/tests/architecture/`**，vitest 又把 `**/*.mjs` 全排除。于是以下 4 个文件**没有任何 runner 执行**，且全仓**零引用**：

- `platform-admin/src/features/workspace-iam/ui/AccountsPage.test.mjs`
- `platform-admin/src/features/workspace-iam/ui/RolesPage.test.mjs`
- `platform-admin/src/features/extension-management/ui/ExtensionsPage.test.mjs`
- `platform-admin/src/features/authentication/ui/PlatformPasswordChangeDrawer.test.mjs`

**影响面**：永不执行 = 永不失败 = 制造"有测试"的假象；且它们与同目录的 `.test.tsx` 内容重叠。

**处置**：删除这 4 个文件；同时把 runner glob 改为 `src/**/*.test.mjs`，或加一条断言"磁盘上的 `.test.mjs` 集合 == runner 实际执行集合"，防止再次出现孤儿。后者满足右尺寸三问（反复发生、纯机械、成本远小于返工）。

### M-04｜2 条架构断言钉死实现拼写 —— **处置：删除这 2 条断言，文件其余保留**

`platform-admin` 架构测试当前 2 红，失败断言是：

- `assert.match(source, /\.\.\.\(field\.key \? \{key: field\.key\} : \{\}\)/)` —— 钉死 `...(field.key ? {key: field.key} : {})` 的**精确源码拼写**；
- `assert.match(source, /gridTemplateColumns/)` —— 只要求源码里出现这个 CSS 属性名。

**要区分对待**：同批 23 条架构断言里绝大多数是**边界/契约**断言（"不得引入某依赖"、"必须消费生成的 RTK"、"红变异必须被拒"），那类用源码扫描是**恰当**的，属机器门的正当用法，应保留。只有上面这 2 条是**实现拼写**断言，与业务边界无关，重构必红。

**处置**：删除这 2 条断言。若确实要保住其意图（扩展字段 key 传递、栅格布局），应下沉到 L2 行为断言，而不是在源码里找字符串。

### S-01｜失败诊断被整份源码淹没 —— **处置：修正**

架构测试用 `assert.match(整个文件内容, /regex/)`，失败时 Node 把 **actual 打印为整份源码**——本次实测一条失败输出超过 2 万字符，把真正的失败点冲掉。这与本程序此前"first-failure 证据丢失"是同一族问题。

**最小修复**：断言前先定位到相关片段再匹配，或改用带 message 的自定义断言只输出命中上下文。

### S-02｜Testcontainers 入口硬编码 Homebrew 绝对路径 —— **处置：修正**

`scripts/test/r5-remote-testcontainers.mjs:32`：

```js
const gradleHome = process.env.V2S_GRADLE_HOME ?? '/opt/homebrew/Cellar/gradle/9.7.0/libexec';
```

**这是全仓唯一的机器特定绝对路径**（我扫过 `scripts/test`、`scripts/dev`、`tools`）。gradle 一升版本这个默认值就静默失效；仓内又**没有 `gradlew` wrapper**，本机 `gradle` 也不在 PATH，所以换一台机器/升一次版就"一跑测试就 fail"。

**说明公平性**：该脚本设计上是 ssh 到受信远端执行，本机没有 docker/gradle **不是**缺陷；缺陷只在这个硬编码默认值和缺 wrapper。

**最小修复**：去掉硬编码默认值，缺 `V2S_GRADLE_HOME` 时 fail-closed 报明确错误码；或在仓内提供 gradle wrapper。

### S-03｜无 Docker 时 20 个 Testcontainers 测试硬失败且无可读指引 —— **处置：修正**

116 个 Java 测试中 20 个依赖 Testcontainers，全仓**没有任何 `assumeTrue` / `Assumptions` / `@EnabledIf` / `DockerClientFactory` 前置探测**。环境缺 Docker 时抛的是容器栈底层异常，不是一句"Docker 未就绪"。

**注**：fail-closed 本身是对的（不该悄悄跳过），问题只在**错误信息不可读**，会把环境问题误判成代码问题——这正是之前排障成本高的一部分。

**最小修复**：入口处探测一次，缺 Docker 时抛 typed 错误码并指明需要什么。

### N-01｜`BackendPerformanceTestcontainers196Test.java` 有 6 处空 catch —— **处置：修正**

全量扫描下这是**唯一**有空 catch 的测试文件。未复跑（无 docker），仅静态发现。

### N-02｜L2 spec 向运行目录追加进度日志 —— **处置：保留，无需改**

`operations-admin/src/tests/l2/catalog-inventory.spec.ts:35` 用 `appendFileSync` 写进度，但路径由 `V2S_RUNTIME_DIR` 控制，未污染仓库。记录以备 Codex 报告交叉核对。

---

## 3. 健康层（建议不要动，避免整改误伤）

- **`scripts/**` 的 133 个 node 用例全绿**，其中大量是 fail-closed 断言与红变异（如 `RED_SOURCE_SUBSTITUTION`、`RED_LITERAL_SOURCE`、`RED_STALE_EXIT_STATE`），是真控制。
- **L2 层（20 个 spec）是真行为测试**：Playwright 驱动、locator 来自 `contracts/policy/*-locator-bindings.json` 契约、**零 `waitForTimeout`/硬 sleep**。UI 行为保障应继续压在这一层。
- **`r5-joint-remote-l2.mjs` 的 spec 清单 20 条与磁盘 20 条相等**，且有目录相等性检查，分母是守住的。
- **Java 层 116 个测试中仅 5 个读源码**，其余是正常单元测试，结构无系统性问题（未复跑）。
- **seed dry-run 通过**，分母显式（32 scenarios / 16 fixtures / 7 stages）。

---

## 4. 建议的整改顺序

1. 先删（M-01 的 58 个、M-03 的 4 个、M-04 的 2 条断言）——删完立刻能得到一个"红即真红"的测试基线；
2. 再修 runner glob 分母断言（M-03 后半）与 S-01 诊断截断；
3. 最后修 S-02 / S-03 的环境入口，让"环境没就绪"和"代码坏了"在输出上一眼可分；
4. `N-01` 顺手清。

**不建议**在本次整改里同时引入 jsdom + testing-library 重写前端渲染测试——那是新建设，应在删除假测试、基线变干净之后单独立项，否则会把"下线"和"新建"混成一次大改，重蹈范围失控。

---

## 5. 边界声明

- 本报告仅覆盖**静态阅读 + 本机可复跑层**。Java 116 个测试、20 个 Testcontainers 测试、20 个 L2 spec **本次未实际执行**，其结论均为静态判断，已在对应条目标注；不得据此宣称这三层已验证通过。
- 未运行 DEV、reset、真实 seed、L2 浏览器或任何动态负载；不构成动态、业务或性能结论。
- 除 `M-01` 末尾那一项范围裁决外，其余处置均在 Codex 既有批准边界内可自主执行。
