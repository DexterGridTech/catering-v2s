# `kernel.base.topology` · TER 双机拓扑 owner

## 定位

这是 `owner` 包，拥有本节点的稳定身份、配对 locator、宿主 desired/actual、peer identity/reachability
和拓扑操作资格。它依赖 contracts、display-context、platform-ports、runtime、state 与 transport；UI
只通过它提供的 selector/capability 读取，不持有 Runtime、原生 port 或 raw state。

它不是 screenPart catalog owner、业务 members owner、传输协议字段 owner，也不决定 member 命令的业务
写入者。物理屏幕事实仍由 `kernel.base.display-context`/`DevicePort` 提供。

## 作用与边界

判别式是：凡是“本节点是否已配对、宿主是否应运行、拓扑操作是否可用、拓扑连接是否可达”的事实与
策略放在这里；凡是“实际屏数”读 display-context，“帧字段与方向”读 contracts，“帧 session”交
transport，“members 内容”交 sample-member-registry。

`hasTopologySecondarySurface` 只表示“本机双屏，或本节点为 MASTER 且已配对”，不读取
`peerReachable`，所以掉线不会把副屏语义退化为手持确认。命令仍经过 event → command → actor → owner
slice；接收侧必须把跨机请求归一为本地执行，避免回环。

## 结构

```text
src/
  application/        topology RuntimeModule 与依赖装配
  features/           commands、actors、topology slice
  foundations/        operation eligibility 与 secondary 纯谓词
  selectors/          topology state/facts 的只读读取面
  types/              topology 本地 state
  index.ts            唯一公开面
```

## 用法

```ts
import {createTopologyModule, evaluateTopologyOperation} from '@catering-v2s/kernel-base-topology'

const module = createTopologyModule({displayName: 'TER', surfaceForm: 'laptop'})
const eligibility = evaluateTopologyOperation({
  operation: 'pair',
  surfaceForm: 'laptop',
  displayCount: 1,
  instanceMode: 'MASTER',
  displayRole: 'CHIEF',
  paired: false,
  peerReachable: false,
})
```

调用方只能消费 `allowed` 与 `reasonCode`；不可用文案由 `topologyReasonMessages` 映射，不能自己用
`paired`/`peerReachable` 重组允许性。

## 在这个包上迭代时

1. 新增拓扑字段先确认唯一 owner；公共协议字段同步 contracts parser/vector/invariant，连接机制同步
   transport，不能在此复制 union。
2. `peerReachable` 只能影响送达状态和提示，不得进入 secondary 语义；新增 operation 必须补 operation
   focused test，并测试自然捷径会红。
3. 改完运行本包 typecheck、owned test、contracts static；改 graph/package 时同步 workspace、invariant、
   census 和本 README，并回读真实装配。
4. 任何 native host 起停都由 topology lifecycle actor 通过 typed port 触发；测试 fixture 不得直接持有
   `TopologyHostPort.start`。
