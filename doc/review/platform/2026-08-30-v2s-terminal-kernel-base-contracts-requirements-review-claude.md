# TER `kernel.base.contracts` 需求独立评审

REVIEW_TARGET=DESIGN
ACTION_1_VARIANT=1-B 文档提取
VERDICT=NO-GO
M/S/N=3/4/3
L1_ENGINEERING=3 个 M、4 个 S；需求存在不可同时满足的规则、错误分母与可全绿但不证明消费者可用的路径
L2_USER_VISIBLE=NOT_APPLICABLE（本包无 UI-bearing Journey）
L3_UNVERIFIED=空（工程未验证项见“未核到的部分”，不作 UI 结论）
SAME_ROOT_SCAN=当前 TER contracts 直接消费者 10/10 已核；POC `Record` 精确命中 17、`any` 1 已核；C-1…C-8、T-1…T-9 已逐条对账；adapter 5 个目标包的模板/依赖要求已核命令边界
DESIGN_GAPS=缺少消费者 API 编译闭包；C-4b 未接入 §8.4 判据 7；`CommandRouteContext` 的本地/线上边界未写死
EVIDENCE_TIER=仓内需求/规范/图/当前骨架与 POC 源码静态核验；npm 官方 registry tarball 与 CLI help 外部只读核验；scratch 脚手架运行到依赖安装并以 exit 1 结束；未实现 contracts、未运行 TER 业务测试

## 背景

本轮评审 TER 22 包地基中的 `kernel.base.contracts` 需求。它是唯一零依赖包和依赖图唯一根；需求要求从消费者真实需要裁剪 POC contracts，并同时处理 TR-05 类型约束、时间/ID 例外、延期的跨节点协议以及 5 个 adapter 的 SDK57 devDeps。当前 TER contracts 仍是骨架，故本轮只做设计/需求评审，不把骨架的 metadata import 当成 semantic consumer proof。

## 评审目标

以“找出为什么不成立”为立场，逐项核验 §3 消费者表、§6.4 的 TR-05 13 处 inventory、§4.2 的延期边界、contracts→platform-ports 顺序，以及 §8.3/§8.4 是否存在全判据通过但根契约未被真实消费者证明的路径。

## 需阅读文件

- `doc/plans/platform/2026-08-29-v2s-terminal-kernel-base-contracts-requirements-claude.md`：本轮需求正本；
- `doc/platform/terminal-coding-standard.md`：TR-05/TR-06 正本；
- `apps/terminal/skeleton-graph.ts`：当前 22 包图与直接消费者；
- `apps/terminal/kernel/base/contracts/`：当前骨架字节；
- `../newPOSv1/1-kernel/1.1-base/contracts/`：POC 类型与 foundation；
- `../newPOSv1/1-kernel/1.1-base/platform-ports/`、`../newPOSv1/1-kernel/1.1-base/transport-runtime/`、`../newPOSv1/1-kernel/1.1-base/runtime-shell-v2/`、`../newPOSv1/2-ui/2.1-base/admin-console/`、`../newPOSv1/2-ui/2.1-base/terminal-console/`：POC 消费面；
- `project-memory/decisions/terminal-build-order-and-batches.md`：建设顺序与批次裁定。

## 独立核验重点

已实际核对当前 TER 的 10 个 direct consumers、POC contracts 的 17 个精确 `Record<string, unknown>` 命中与 1 个 `any`、POC 时间格式化的全部直接 UI 用点、POC 本机 route context 与跨节点 envelope 的使用边界，并运行 Expo CLI help、模板 tarball 与 scratch module scaffold 探针。静态需求矛盾、错误分母和验收遗漏按 findings 处理；未来 TER semantic imports、`expo install` 完整闭包与真实测试仍列为 UNVERIFIED。

## 期望结论

本评审给出 `GO` 或 `NO-GO`，并统计 `M/S/N`。每条 finding 都带精确位置、事实与证据、后果、最小修复、为何更小替代不足、同族扫描和状态分类；不把外部探针的部分成功升级为完整实现证据。

## 结论

**NO-GO。** 这不是“细节稍后补齐”的状态：M-1、M-2、M-3 分别使内容边界、TR-05 处置、纯函数判据无法同时成立。即使把三条 M 修掉，当前验收仍有 S-2/S-3 两条 false-green 路径，不能把“本包有测试”误称为“根契约被真实消费者证明可用”。

## M findings

### M-1 · `formatTimestampMs` 与本包定位自相矛盾（CONFIRMED）

**位置**：需求 §4.1 第 1 组（约第 98 行）、§5 C-7、§8.3 T-7、§9（约第 431 行）。

**事实与证据**：

- §4.1 把 `formatTimestampMs` 列入 contracts；§2.2/§9 又明确 contracts 不是通用工具包，并明确排除“日期格式化”。
- POC `../newPOSv1/1-kernel/1.1-base/contracts/src/foundations/time.ts:5-10` 使用 `Date` 的本地时区 getter 拼接展示字符串，不是协议类型或 ID 语义。
- POC 的实际消费点是 `../newPOSv1/2-ui/2.1-base/admin-console/src/supports/adminFormatting.ts:1-10` 与 `../newPOSv1/2.1-base/terminal-console/src/supports/terminalFormatting.ts:1-34`；未发现 kernel 侧使用它。

**后果**：零依赖根包会携带 UI 展示策略，扩大 22 个包的编译面；时区、格式、非法时间值的行为未被任何共享协议决定。C-2 允许 `Date.now()` 不等于允许把日期显示工具放进根包。

**最小修复**：从 §4.1、精确导出清单、T-7/T-9 与交付物移除 `formatTimestampMs`；保留 `TimestampMs`、`nowTimestampMs` 与 ID 生成。UI 层各自保留显示 helper。若坚持保留，必须另行写明“跨包统一显示格式”的消费者、时区、格式、非法值策略与契约依据。

**更小替代不足**：只给它增加测试会把错误的 UI 责任固化在根包，不能解决分层错误。

**需 Dexter 裁决**：按文档自身 §9，移除不需要产品裁决；只有坚持保留时才需要在“共享显示契约”与“根包不含通用工具”之间作范围裁决。

### M-2 · TR-05 的 13 处 inventory 不是闭集（CONFIRMED）

**位置**：需求 §6.4（约第 240-268 行），并影响 §5 C-4b、§8.4、§11。

**事实与证据**：对 POC contracts 逐文件运行精确字面量扫描：

```text
EXACT_RECORD_TOKEN_COUNT=17
ANY_TOKEN_COUNT=1
```

`Record<string, unknown>` 的实际命中包含：

- `foundations/definition.ts:78`：`listDefinitions<TDefinition extends Record<string, unknown>>`；
- `foundations/error.ts:6`：`renderErrorTemplate(args?)`；
- `types/error.ts:39,72`：`AppError.args`、`CreateAppErrorInput.args`；
- `types/request.ts:16,22,36`：三个 result 字段；
- `types/command.ts:15`：`CommandRouteContext.metadata`；`types/command.ts:41-42`：两个延期 command-envelope result 字段；
- `types/transport.ts:14,21,27,44,49`：实际是 `TransportRequestContext`、`TransportServerAddress`、`TransportServerDefinition`、`TransportServerAddressOverride`、`TransportServerOverride`；`TransportServerConfigSpace` 没有 `metadata`；
- `types/projection.ts:10-11`：延期 projection 命中。

排除 §4.2 明确延期的两个 command-envelope 字段和两个 projection 的精确命中后，当前范围仍是 **13 个 `Record` + 1 个 `any`**，不是文档写的 12+1。`listDefinitions` 位于 §4.1 的定义工厂组；如果作者认为 generic constraint 不在 TR-05 门的范围，必须把排除理由和扫描范围写死，不能静默少计。

**后果**：执行者按“13 处”完成后，仍可能留下一个 TR-05 命中；或者因为 `ConfigSpace.metadata` 实际不存在而漏改 `TransportRequestContext.metadata`。验收分母和实施清单无法复跑。

**最小修复**：把 §6.4 改成逐文件/成员 inventory，修正 transport 名称，补 `listDefinitions`，明确 projection/command-envelope 的延期排除规则，并规定 C-4b 是扫描所有 exported public function signatures 与 type declarations，还是只扫描 `src/types/**`。

**更小替代不足**：把问题留给详设会让当前需求的封闭计数继续误导实现与验收；只改总数不改成员名同样不能复核。

### M-3 · `createAppError` 的时间副作用与 C-7/T-7 互斥（CONFIRMED）

**位置**：需求 §5 C-7（约第 160 行）、§6.1（约第 169-170 行）、§8.3 T-7/T-8（约第 402-403 行）；规范正本 `doc/platform/terminal-coding-standard.md` TR-06 约第 201-221 行。

**事实与证据**：

- Dexter 已决定 `createAppError` 保留内部 `createdAt`；POC `../newPOSv1/1-kernel/1.1-base/contracts/src/foundations/error.ts:14-25` 调用 `nowTimestampMs()`。
- TR-06 的例外只列 `nowTimestampMs` 和 ID 生成一族，并明确“例外只覆盖时间与随机数两类，其余 foundations 仍须纯函数”。
- T-7 却写“除 `nowTimestampMs` 与 ID 生成外，同输入两次调用结果全等”。`createAppError` 不在该例外文字中；T-8 只要求用假时钟精确断言，并不能消除规范互斥。

**后果**：实现者无法同时满足自动盖章、C-7 纯度和 T-7 确定性：只能偷偷扩大例外、删除 `createdAt` 或让 T-7 失败。

**最小修复**：遵循既有 Dexter 裁决，明确把 `createAppError` 写成“唯一允许派生 `nowTimestampMs` 的错误构造器”，并在 C-7/T-7 的例外中点名它；T-8 保留 fake clock 的精确值断言。改为显式注入时间是更大的 API 变化，不是本批最小修复。

**更小替代不足**：只增加 fake-clock 测试不会修正文档规则的逻辑矛盾。

## S findings

### S-1 · §3 把图边、POC 实际消费与 TER 预期混成一张“真实需要”表（PARTIALLY_CONFIRMED）

**位置**：需求 §3（约第 65-88 行）。

**已确认事实**：当前 `apps/terminal/skeleton-graph.ts` 的 contracts 直接消费者确为 10 个：

```text
kernel.base.platform-ports: dependency
kernel.base.state: dependency
kernel.base.runtime: dependency
kernel.base.transport: dependency
kernel.base.display-context: dependency
kernel.base.workflow: dependency
kernel.base.ui-state: dependency
kernel.base.test-support: devDependency
ui.integration.platform-console: dependency
assembly.android.pos-desktop: dependency
```

**反证与边界**：当前 TER 这些包仍只 import `moduleName`（contracts 本身也只有骨架 `moduleName`/dependency exports），因此表中的语义消费不是当前 TER 源码事实。POC 也不是同一口径：

- POC `platform-ports` 实际使用 `nowTimestampMs`，未见它直接使用 Error protocol；
- POC `transport-runtime` 同时使用 `createAppError`、`AppError`、`ErrorDefinition`、`TimestampMs` 与 transport 类型；
- POC 两个 console 的 `formatTimestampMs` 消费是 UI 格式化；
- POC assembly 没有 contracts 的语义直连，当前 TER assembly 的 contracts 边来自 skeleton bootstrap 的 `moduleName` 导入。

**后果**：用这张表冻结 exports 会把“推测的 TER 未来需要”误当成已证事实，既可能把 UI 工具留进根包，也可能漏掉真正端口签名依赖。

**最小修复**：拆成三张可审计表：①当前 TER 图的 10 条 direct edge；②POC analog 的实际 symbol imports；③TER 本批确认的未来需要。第三张逐项标 `CONFIRMED` 或 `UNVERIFIED_TER_NEED`，不得用未确认行支撑精确导出清单。

**同族扫描**：当前图的 10/10 consumer 已核；POC 的相关源码路径已核，但 POC 18 个生产 importer 的每个 symbol 语义未在本轮逐项展开，不能把它们全称为 TER 已证需求。

### S-2 · C-4b 虽声明“必须建门”，却不在验收判据中（CONFIRMED）

**位置**：§5 C-4b（约第 157 行）、§8.4 判据 7（约第 420 行）、§11 交付物 3（约第 452-453 行）。

**事实**：C-4b 明确要求建 TR-05 门，§11 也列出四道门；但 §8.4 判据 7 只写 `C-2 / C-5 / C-6`。因此按 §8.4 全部通过的执行者可以不运行 C-4b 而仍满足文字判据。

此外，C-4b 说扫描“类型定义文件”，但 inventory 中的两个命中在 `foundations/error.ts` 的 exported `renderErrorTemplate` 与 `foundations/definition.ts` 的 exported `listDefinitions`，文件范围又与清单不一致。

**后果**：TR-05 这个根包首次约束可能变成“交付物里提过、验收没检查”的装饰门。

**最小修复**：把 C-4b 纳入 §8.4 判据 7，并写明扫描所有对外导出的函数签名、接口、type alias 与泛型约束；为该门配真实树绿和恢复后的红夹具。

### S-3 · 缺少消费者 API 编译闭包，存在“全绿但根契约无用”的路径（CONFIRMED）

**位置**：§8.4 判据 3-6（约第 415-419 行）、§11 交付物 1-2；当前 `apps/terminal/kernel/base/contracts/src/index.ts` 与各消费者 `src/dependencies.ts`。

**事实**：当前 10 个消费者与 assembly 只通过 `moduleName`/dependency metadata 建图；contracts `src/index.ts` 也只导出 `moduleName` 和依赖数组。需求没有要求任何一个真实消费者以语义方式 import `AppModule`、ID、错误、参数、request 或 transport 类型，也没有要求 `AppModule.packageVersion` 可省略的 type-level fixture。

**可复现 false-green**：实现者可以把错误的类型/函数全部放进 contracts，写本包内 T-1…T-9 与门的正负夹具；只要精确 export 清单与本包测试通过，图门、Metro 和现有消费者仍只消费 `moduleName`，所有判据可绿而未来端口签名并未被证明。

**最小修复**：增加一个不产生运行时能力的 compile-fixture（或每个类型组至少一个代表性消费者），实际 import 精确主入口，并断言：`packageVersion` 可省略、不同 branded ID 不能互传、transport/request/route/error/parameter 形状可被目标消费者编译。将它列入 §8.4 必过项。

**更小替代不足**：只检查 `index.ts` 的名字集合不能证明导出类型可被消费者正确解析；只在 contracts 内重复 T-1…T-9 仍未闭合根包与消费者的边界。

### S-4 · adapter devDeps 的“官方解析”执行闭包不足（PARTIALLY_CONFIRMED）

**位置**：§8.1（约第 357-384 行）。

**事实与实际探针**：需求只说“版本不要手写，走 `npx expo install`”，没有规定 cwd、5 个 adapter 的执行顺序/命令、允许写入范围、失败停机条件或证据格式。

本轮外部只读探针：

1. `npx --yes create-expo-module@latest --help`：exit 0，确认 `-s, --source <source_dir>`，默认从 npm 下载 `expo-module-template`。
2. `npm pack expo-module-template@latest --json`：exit 0，得到 `expo-module-template@57.0.9`；根 `package/package.json` 的 dependencies 为空、devDependencies 只有 `typescript: ^6.0.3`，tarball 共 91 个文件，包含 Android/iOS/template 脚本。
3. 在 scratch 目录运行：

   ```text
   npx --yes create-expo-module@latest --no-example --platform android --name DemoModule --package com.example.demo --package-manager npm demo-module
   EXIT_CODE=1
   ```

   CLI 报告“versioned template 下载失败，回退 latest”，随后生成 module，但依赖安装因 `EALLOWSCRIPTS` 失败：

   ```text
   ✔ Downloaded module template from npm registry.
   ✔ Created the module from template files
   Error: npm install exited with non-zero code: 1
   npm error code EALLOWSCRIPTS
   npm error --allow-scripts is not allowed in project-scoped installs.
   ```

   失败前生成的 `package.json` 观测到 `jest-expo ~55.0.9`、`babel-preset-expo ~55.0.8`、`react-native 0.82.1`、`expo ^57.0.17` 等旧/混合 devDeps。这个结果证明 CLI 生成物需要规范化，但不证明完整安装闭包成功；也不能把 tarball 根 manifest 直接称为生成 module manifest 的唯一来源。

**后果**：不同执行者可能在 module 根、assembly 根或 terminal 根运行不同命令，得到不同解析或部分写入；失败时若没有停机规则，容易手写版本冒充 Expo 解析结果。

**最小修复**：写死可复跑算法：每个 adapter 的 cwd、确切 `npx expo install` 参数、五包处理顺序、package.json/lockfile 允许写入面、CLI 版本与 stdout/stderr/exit code 证据；任何非零退出立即停机，不得手写兜底。保留 latest 漂移说明。

## N findings

### N-1 · C-6 的数量文字与列项不一致（CONFIRMED）

**位置**：§5 C-6（约第 159 行）。

文字写“五处闭集”，实际列出七个位置/集合：`ErrorCategory`、`ErrorSeverity`、两个 error source、两个 parameter source、`ParameterValueType`。

**最小修复**：改为“以下闭集”或把“五处”改成正确分组口径，并让门报告与该口径一致。

### N-2 · `CommandRouteContext` 保留是合理的，但本地/线上边界没有写死（PARTIALLY_CONFIRMED）

**位置**：§4.2（约第 116-130 行）。

POC 的本机 dispatch 使用 `CommandRouteContext`，跨节点事件才使用 `CommandEventEnvelope`；因此“保留 route context、延期 envelope”的切法有证据支持，不建议因顺序问题把它一起延期。

但 `CommandRouteContext` 的 `metadata` 仍是开放槽，且文档没有明确它是 local-only、不得序列化的上下文，还是未来 envelope 的输入。若不补边界，后续实现可能把本地字段无意带进 wire protocol。

**最小修复**：在 §4.2 写明 retained context 的 local-only/serialization boundary，列出当前本机 reader/writer；未来 envelope 必须单独定义 wire context 或显式 allowlist/version，而不是直接复用整个 `CommandRouteContext`。

### N-3 · adapter provenance 的证据档位应更新但保留失败边界（CONFIRMED）

§8.1 仍把模板生成物归因标为 `UNVERIFIED`。本轮已通过 `npm pack` 与 CLI scratch 观察到：官方 template tarball 可取，CLI 确实生成包含旧 devDeps 的 module manifest，但完整安装以 `EALLOWSCRIPTS` exit 1 结束。

**最小修复**：改为“CLI 生成 manifest 已外部静态观察；完整 install closure `UNVERIFIED_REQUIRES_EVIDENCE`；latest 漂移需实施时重取”，不要把部分生成成功升级为安装成功。

## 五个重点问题的直接回答

1. **消费者表**：10 条图边已确认；“每个包需要哪些 semantic exports”尚未成为当前 TER 源码事实，且与 POC 实际 symbol 消费存在差异，应拆表并标证据档位。
2. **TR-05 13 处**：分类框架 A/B/C 可用，但当前 inventory 不成立。精确扫描是 17 个 `Record<string, unknown>` 命中 + 1 个 `any`；排除延期 command-envelope/projection 后为 13+1。metadata 可以是 C，但每一处必须写 writer、reader、不可具名原因；`listDefinitions` 不能静默漏掉。`any` 没有 C 选项这一判断正确。
3. **推迟边界**：topology、compatibility、state-sync、projection、跨节点 envelope 推迟成立；`CommandRouteContext` 留下也成立，因为它服务本机 route。需要补 local-only/wire boundary，不需要换顺序。
4. **建设顺序**：contracts → platform-ports 正确。当前图和 POC 都显示 platform-ports 依赖 contracts，反向边不存在；端口签名应消费已命名的 ID/error 类型，而不是反过来塑造根契约。该“应先做 platform-ports”的假设为 `REJECTED_WITH_EVIDENCE`。
5. **全判据通过但没建成**：至少有两条：
   - 只实现本包 T-1…T-9、门和 export 清单，消费者继续只 import `moduleName`，可全绿但没有任何真实消费者编译闭包；
   - 省略 C-4b，因 §8.4 判据 7 没有把它列入必过项，仍可声称全部验收通过。

## 未核到的部分（明确 `UNVERIFIED_REQUIRES_EVIDENCE`）

- TER `contracts` 尚未实施，故不存在真实 `index.ts` export、consumer compile、typecheck、Vitest 或 C-4b gate 运行证据；
- 5 个 adapter 的 `npx expo install` 完整成功、最终 lockfile、peer resolution 与 `yarn workspace ... test` 未运行；scratch CLI 只证明生成阶段，安装 exit 1；
- group 5/6（`AppModule`、request lifecycle）的最终字段形状，需求自身声明 runtime 落地前不冻结；
- `CommandRouteContext.metadata` 的真实 writer/reader 与未来 wire 映射未由当前 TER 源码决定；
- `formatTimestampMs` 若要保留，跨包统一显示格式、时区和非法输入策略没有来源；
- 本轮没有运行 TER verify、仓级 verify、设备、Gradle、Metro 或任何实现动态测试；没有修改仓库源码。

## 可直接复制给 Claude 的话术

```text
您好 Claude，以下是 Codex 对你编写的 TER `kernel.base.contracts` 需求文档的完整独立评审结果；这是结果回报，不是再次发起评审请求。

REVIEW_TARGET=DESIGN
ACTION_1_VARIANT=1-B 文档提取
VERDICT=NO-GO
M/S/N=3/4/3

背景：被评审文件是 `doc/plans/platform/2026-08-29-v2s-terminal-kernel-base-contracts-requirements-claude.md`。它定义 TER 唯一零依赖根包的内容边界、TR-05 处置、时间/ID 例外、跨节点协议延期和 5 个 adapter 的 SDK57 devDeps。当前 TER contracts 仍是骨架，本轮只做需求评审，没有创建或修改 contracts 源码。

目标：向需求作者完整回报 Codex 已确认的阻断、显著问题、notes、实跑证据、未验证边界与最小修复；不要求 Claude 重复执行本轮评审。

评审范围：Codex 重新打开了需求、`doc/platform/terminal-coding-standard.md`、`apps/terminal/skeleton-graph.ts`、当前 contracts 骨架、POC contracts 与相关消费者，并检查了建设顺序、验收判据和 false-green 路径。结论是需求目前不能无猜测实施。

## M findings

M-1（CONFIRMED）——`formatTimestampMs` 的层次位置与需求自身冲突。

位置：需求 §4.1 第 1 组（约第 98 行）、§5 C-7、§8.3 T-7、§9（约第 431 行）。

事实与证据：§4.1 把 `formatTimestampMs` 纳入 contracts；§2.2/§9 又明确排除通用日期格式化。POC `../newPOSv1/1-kernel/1.1-base/contracts/src/foundations/time.ts:5-10` 使用本地时区 `Date` getter 拼接展示字符串。它的实际调用点只有 `../newPOSv1/2-ui/2.1-base/admin-console/src/supports/adminFormatting.ts:1-10` 与 `../newPOSv1/2.1-base/terminal-console/src/supports/terminalFormatting.ts:1-34`，没有 kernel 侧共享协议消费。

后果：零依赖根包携带 UI 展示策略，扩大所有消费者的编译面；时区、格式、非法输入行为没有共享契约来源。`Date.now()` 的 TR-06 例外不等于日期显示工具可以进入根包。

最小修复：从 §4.1、精确 export 清单、T-7/T-9 与交付物移除 `formatTimestampMs`；保留 `TimestampMs`、`nowTimestampMs` 和 ID 生成，显示 helper 留在 UI。若坚持保留，必须补跨包统一显示格式的消费者、时区、格式和非法值规则。

更小替代不足：只增加测试会把错误的 UI 责任固化在根包，不能修复分层错误。

M-2（CONFIRMED）——§6.4 的 TR-05 13 处 inventory 不闭合。

实际扫描输出：

```text
EXACT_RECORD_TOKEN_COUNT=17
ANY_TOKEN_COUNT=1
```

实际遗漏与错误：`../newPOSv1/1-kernel/1.1-base/contracts/src/foundations/definition.ts:78` 的 `listDefinitions<TDefinition extends Record<string, unknown>>` 未列出；`types/transport.ts:14` 的 `TransportRequestContext.metadata` 未列出；文档列出的 `TransportServerConfigSpace.metadata` 实际不存在，POC 的五处 transport metadata 是 `TransportRequestContext`、`TransportServerAddress`、`TransportServerDefinition`、`TransportServerAddressOverride`、`TransportServerOverride`。

排除 §4.2 延期的两个 command-envelope result 命中和两个 projection 命中后，当前范围仍是 **13 个 `Record<string, unknown>` + 1 个 `any`**，不是 12+1。

后果：执行者按 13 处修完后仍可能留下 TR-05 命中；或者因成员名错误漏改实际字段。验收分母和实现清单无法复跑。

最小修复：把 §6.4 改为逐文件/逐成员 inventory，修正 transport 成员名，补 `listDefinitions`，明确延期排除规则，并写死 C-4b 是扫描所有 exported public function signatures/type declarations，还是仅 `src/types/**`。

更小替代不足：只改总数不改成员名仍无法核验；把问题留给详设会继续误导实现。

M-3（CONFIRMED）——`createAppError` 的时间副作用与 C-7/T-7 互斥。

位置：需求 §5 C-7、§6.1、§8.3 T-7/T-8；规范正本 `doc/platform/terminal-coding-standard.md` TR-06 约第 201-221 行。

事实与证据：Dexter 已决定 `createAppError` 保留内部 `createdAt`；POC `../newPOSv1/1-kernel/1.1-base/contracts/src/foundations/error.ts:14-25` 调用 `nowTimestampMs()`。TR-06 例外只点名 `nowTimestampMs` 和 ID 生成一族，并写明其余 foundation 仍须纯函数；T-7 又要求除 now/ID 外同输入全等。T-8 的 fake clock 只证明取值精确，不能消除规则冲突。

后果：实现者无法同时满足自动盖章、纯函数门和 T-7，只能偷偷扩大例外、删除时间字段或让门失败。

最小修复：在 C-7/T-7 例外中明确点名 `createAppError` 是唯一允许派生 `nowTimestampMs` 的错误构造器，T-8 保留 fake-clock 精确断言。改为显式注入时间是更大的 API 变化。

## S findings

S-1（PARTIALLY_CONFIRMED）——§3 混合图边、POC 实际消费和 TER 未来推测。

当前 `apps/terminal/skeleton-graph.ts` 的 10 条 direct edge 已确认：9 条正式边加 `kernel.base.test-support` 的 1 条 devDep。可是当前 TER 各消费者仍只 import `moduleName`/dependency metadata；语义表不是当前 TER 源码事实。POC 也存在口径差异：platform-ports 使用 `nowTimestampMs` 而非表中所称的错误协议；transport-runtime 使用 `createAppError`、`AppError`、`ErrorDefinition`、`TimestampMs` 和 transport types；两个 console 使用 `formatTimestampMs`；POC assembly 没有 contracts 语义直连。

最小修复：把 §3 拆成“当前 TER 图 direct edge”“POC analog 实际 symbol imports”“TER 本批确认 future need”三张表，第三张逐项标 `CONFIRMED` 或 `UNVERIFIED_TER_NEED`，不得用推测行冻结 exports。

同族扫描：当前图 10/10 已核；POC 相关路径已核，但不能把 POC 18 个生产 importer 的每个 symbol 语义升级为 TER 已证需求。

S-2（CONFIRMED）——C-4b 要求建门，却没有接入验收判据。

§5 C-4b 与 §11 明确要求 TR-05 门；§8.4 判据 7 却只列 `C-2 / C-5 / C-6`。因此执行者可以省略 C-4b 仍声称 §8.4 全部通过。并且“扫类型定义文件”的范围漏掉 `foundations/error.ts` 的 `renderErrorTemplate` 和 `foundations/definition.ts` 的 `listDefinitions` 公开函数签名。

最小修复：把 C-4b 加入 §8.4 判据 7，并明确扫描所有对外函数签名、接口、type alias 和泛型约束，配真实树绿与红夹具。

S-3（CONFIRMED）——缺少消费者 API 编译闭包，存在全绿但根契约无用的路径。

当前 contracts `src/index.ts` 只导出 `moduleName`/dependency metadata；10 个消费者和 assembly 也只消费这些 metadata。需求没有要求任何真实消费者语义 import `AppModule`、ID、错误、参数、request 或 transport 类型，也没有要求 `AppModule.packageVersion` 可省略的 type-level fixture。

可复现路径：实现者写出错误或不完整的 contracts 类型，令本包 T-1…T-9、静态门和 export 清单通过；由于消费者继续只 import `moduleName`，图门和 Metro 仍可绿，但未来 port signature 从未被证明。

最小修复：增加 compile-fixture，或每个类型组至少一个代表性消费者，实际从主入口 import，并断言 `packageVersion` 可省略、不同 branded ID 不可互传、transport/request/route/error/parameter 形状可编译。

S-4（PARTIALLY_CONFIRMED）——adapter devDeps 的“官方解析”没有可复跑闭包。

需求 §8.1 只写“走 `npx expo install`”，没有规定 cwd、参数、5 个 adapter 的执行顺序、写入面、失败停机和证据格式。

实跑结果：

1. `npx --yes create-expo-module@latest --help`：exit 0，确认 `-s, --source <source_dir>`，默认从 npm 下载 `expo-module-template`。
2. `npm pack expo-module-template@latest --json`：exit 0，得到 `expo-module-template@57.0.9`；根 manifest dependencies 为空、devDependencies 只有 `typescript: ^6.0.3`，tarball 共 91 个文件。
3. scratch 中运行 `create-expo-module`：模板下载并生成 module 成功，但安装失败，exit 1：

```text
✔ Downloaded module template from npm registry.
✔ Created the module from template files
Error: npm install exited with non-zero code: 1
npm error code EALLOWSCRIPTS
npm error --allow-scripts is not allowed in project-scoped installs.
```

失败前生成的 manifest 观察到 `jest-expo ~55.0.9`、`babel-preset-expo ~55.0.8`、`react-native 0.82.1`、`expo ^57.0.17` 等旧/混合 devDeps。它证明 CLI 生成物需要规范化，但不证明完整安装闭包成功。

最小修复：写死每个 adapter 的 cwd、确切 `npx expo install` 参数、处理顺序、允许写入面、CLI 版本、stdout/stderr/exit code 证据；任何非零退出立即停机，不得手写兜底。

## N findings

N-1（CONFIRMED）：§5 C-6 写“五处闭集”，实际列出七个集合/位置。改成“以下闭集”或修正分组口径。

N-2（PARTIALLY_CONFIRMED）：保留 `CommandRouteContext`、延期 command envelope 有 POC 依据，本机 dispatch 使用前者、跨节点事件使用后者；但应补 local-only/serialization boundary，避免未来直接把本地 metadata 带入 wire protocol。

N-3（CONFIRMED）：adapter provenance 已有外部静态证据，但完整 install closure 仍未证明。应把“CLI 生成 manifest 已观察”和“安装闭包 `UNVERIFIED_REQUIRES_EVIDENCE`”分开记录，并保留 latest 漂移边界。

## 五个重点问题的结论

1. 消费者表：10 条图边正确，但 semantic exports 表尚未被当前 TER 源码证明，且与 POC symbol 消费不完全一致。
2. TR-05：A/B/C 分类框架可用，但当前 13 处 inventory 不成立；`metadata` 可选 C，必须逐处写 writer、reader 和不可具名原因；`any` 没有 C 选项这一点正确。
3. 推迟边界：topology、compatibility、state-sync、projection、跨节点 envelope 推迟成立；`CommandRouteContext` 保留成立，只需补边界文字。
4. 顺序：contracts → platform-ports 正确。当前图和 POC 都显示 platform-ports 依赖 contracts，反向边不存在；“先做 platform-ports”的假设为 `REJECTED_WITH_EVIDENCE`。
5. false-green：至少存在“本包 T/门全绿但消费者只消费 moduleName”和“省略 C-4b 仍通过 §8.4 判据 7”两条路径。

## 未验证边界

TER contracts 实际 implementation、consumer compile、Vitest、C-4b 运行、5 个 adapter 的完整 `expo install`/lockfile resolution、runtime group 5/6 最终字段、metadata 的未来 writer/reader，均为 `UNVERIFIED_REQUIRES_EVIDENCE`。本轮没有运行 TER verify、仓级 verify、设备、Gradle、Metro，也没有修改仓库源码。

授权边界：以上是 Codex 对需求作者的 review 结果和修订输入，不授权创建或修改 `apps/terminal/kernel/base/contracts` 源码，不授权 TER verify、设备、Gradle、Metro、DEV、seed、reset、浏览器 L2、UAT 或部署。谢谢。
```
