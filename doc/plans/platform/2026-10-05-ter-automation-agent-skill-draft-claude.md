---
title: cs-terminal-automation 项目skill草案
status: DESIGN_DRAFT_NOT_INSTALLED
implementationAuthority: false
---

# cs-terminal-automation（实施时落 .agents/skills/cs-terminal-automation/SKILL.md）

本文件现在只是设计附件；以下API/命令是待实现契约，不得当作现有能力运行。定稿必须按实际协议同步。

## 1. 使用前

读当前AGENTS、TER规范、批准Journey/IA与本场景授权。只用当前受管入口，确认源码冻结、设备/App/display身份、日志/资源预算。先Expo Web再Android，同一场景清单。不能自行reset/seed/L2。
构建输入 `terminalAutomation.enabled/url/sessionToken` 在package.json；关为no-op，开使用全部能力。不是runtime开关，不能通过环境变量静默override。HOT bundle可以按新常量重启生效。

## 2. 连接

App主动WS；localhost本地，其他地址wss+证书。driver验证token但这不保护终端。Android由driver按serial管理reverse设备19090→本run所属host listener；已有映射冲突不能覆盖。hello中的runtimeId与每次重连sessionId分别记录，不重用旧订阅。
计划入口：`scripts/test/terminal-automation --phase journey --platform web|android --shape mobile|dual`。起run前看manifest，结束cleanup。

## 3. 全部能力（拟公开普通Promise/JSON接口，无Observable）

```ts
const controls = await driver.controls.query({surface: 'PRIMARY', testID: ids.submit});
if (controls.length !== 1) throw new Error('EXPECTED_EXACTLY_ONE_NODE');
const [node] = controls;
if (node === undefined) throw new Error('NODE_MISSING');
const value = await driver.selector.read('kernel.base.runtime.selectRuntimeInstanceMode', []);
const subscription = await driver.selector.subscribe('kernel.feature.sample-member-registry.selectMembers', []);
const tracking = await driver.command.dispatch({name: commandName, payload, requestId});
const bounds = await driver.controls.bounds({nodeInstanceId: node.nodeInstanceId});
await driver.input.press({node: node, bounds}); // 平台内部真实输入，结果real
await driver.controls.act({nodeInstanceId: node.nodeInstanceId, action: 'press'}); // semantic
await subscription.close();
await tracking.close();
```

订阅回调/Promise读取adapter只在driver公开面，RxJS在内部实现。不要从array[0]掩盖ambiguous：query必须校验恰好一节点，否则明确失败。
selector初值立即到达，改变才推，参数是原函数state之后的tuple；undefined等不能JSON化时推NON_JSON_VALUE值状态，订阅不结束，后续JSON继续到达；求值抛错、超预算、会话结束才终止，显式close释放。新包用Runtime定义函数登记root导出StateRoot selector；删除一登记机械门红，不靠名字。
command先观察再dispatch，dispatch返回与late观察结束不同；同步拒绝/多actor/超时/late-error都可见，观察120秒或session结束；断线不重发。
控件query/subscribe观察出现、消失、state、pressIn/out；bounds是该display已换算坐标。旧revision/卸载要重查，不能盲目再点。real由Playwright/ADB，semantic调用原callback，报告分列。
runtime.info给descriptor/selector/command元数据与身份，不提供fullState。协议无eval/scripts。

## 4. 等待与旅途

业务旅途的激活前提由 `await driver.fixtures.ensureActivated({shape: 'mobile'})`（双屏用 `dual`）显式提供；这是拟实现的普通 Promise API。它按 seed 契约 key（mobile=term-handheld、dual=term-front）读取激活码，只存在内存；复用共享 operations fixture、REQUIRE_INACTIVE/本driver身份回收、TDC activateTerminalCommand，等待 activation.status=active、currentPeerValue=true 与门店绑定核验。返回非秘密身份，失败停止业务；不创建数据、不自动seed、不与其他受管运行并行。纯连接/几何脚本不调用它。非MASTER且投影不可用的 activation view 是 null（合法JSON），不得当作激活成功或NON_JSON。
真实点击产生的 request 不由脚本传入 requestId，统一使用 driver 的薄封装：

```ts
await driver.fixtures.ensureActivated({shape: 'mobile'});
const observed = await driver.requests.observeUiAction(
  {workspace: 'MAIN', displayMode: 'PRIMARY', commandName: commandName},
  async () => {
    const nodes = await driver.controls.query({surface: 'PRIMARY', testID: ids.submit});
    if (nodes.length !== 1) throw new Error('EXPECTED_EXACTLY_ONE_NODE');
    const [submitNode] = nodes;
    if (submitNode === undefined) throw new Error('NODE_MISSING');
    const bounds = await driver.controls.bounds({nodeInstanceId: submitNode.nodeInstanceId});
    await driver.input.press({node: submitNode, bounds});
  },
);
// observed.requestId / observed.view 是真实账本身份及结果；还须断言业务 selector。
```

observeUiAction 在动作前先建立 selectRequestExecutionViews(workspace) 订阅并确认首值，再读一次基线，合并已见requestId；动作后只匹配新的requestId、workspace及rootCommandIds对应commands的commandName/displayMode。候选不唯一明确失败，不猜第一条；选中后转精确 selectRequestExecutionView(requestId) 订阅并消费初值，覆盖快速完成。请求结果与业务selector都要断言；finally释放订阅，迟到结果等待沿用120秒/会话结束上限，不重执行。这只是 driver tools 内观察封装，不发第二业务指令、不复制Runtime账本。`ids`、`commandName` 由本场景公开常量确定；实施定稿须提供具体import及期望结果，草案示例当前不可运行。

driver内部用RxJS firstValueFrom/filter/timeout/race，先订阅后动作；外部旅途消费普通Promise/事件接口。禁固定sleep与轮询。每步同时断言visible part、selector、request；只看「成功」不够。
真实业务登录/顾客输入/确认走real，虚拟键盘逐键，最后显式submit。semantic/directcommand只准备fixture，报告注明。
testID由唯一构造 `createTestId(moduleName, part, {element?, key?})` 返回强类型TestId；props/转发保持强类型，literal或拼接传强类型props在typecheck报红，构造文件外不得as TestId；直接RN元素另由全生产TSX的testID/testId属性定点checker检查，不能赋给TestId即门红（包括 `<View testID="x">`），不做跨组件流分析；surface不放ID；fixture使用同一常量源，不能散写旧ID。新包漏登记/literal红例按skeleton入口验证。

## 5. 故障排查

连不上：先读本run日志/config校验/证书/精确reverse身份，不扩大权限。token错不落原token。
坐标偏：查surface/display双ID、密度/原点/scroll/layoutRevision，不能多乘scale补偿。
没推送：先确认是否同session、是否selector有效JSON、是否本来没变化；看subscription error，不直接读fullState。
迟到结果：看requestId+actorKey+最后deadline，不能重执行。
旧会话：注销旧subscriptions；新hello后明确重建，不能自动重放业务command。
首败立即停止后续业务动作，诊断/cleanup允许继续；落盘只metadata，敏感值/原始IP/payload/异常/截图先脱敏；无法安全截图写明确原因而非raw图。

## 6. 验收方式

fresh agent只读本skill，在只读报告给出完整可运行旅途文件全文与完整W→mobile VM命令行，覆盖selector订阅、command跟踪、真实点击。main仅逐字转录与执行，不改任何一个字符；必要改字即记skill缺口，先修skill后换新的fresh重新生成。运行结果交回同一fresh核对，保存全文/命令相等核验。fresh不写文件、不执行；不豁免main唯一写入。草案目前API/命令尚未实现，实施定稿必须给完整import、driver fixture/订阅使用方式、授权内运行输入与CLI，不能要求fresh自行猜源码。
实际API、参数、CLI、错误码与此草案不一致时，必须随实现修订skill；缺项不能完成交付。
