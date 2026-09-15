# `ui.base.feature-assembly`

## 定位

`ui.base.feature-assembly` 是 `ui/feature` owner 共用的 module/assembly 结构工具包，
不是业务 feature、App assembly 或 runtime state owner。

## 作用

它负责把 feature 自己提供的 owner 定义规范化为真实 `RuntimeModule`。
业务 operation、part identity、state、用户文案和 testID 仍由各自 feature 保有；该包不
创建这些事实，也不使用 descriptor、optional dependency 或完整依赖数组伪造运行期模块。

## 结构

- `src/moduleName.ts`：公开模块身份。
- `src/dependencies.ts`：workspace runtime 依赖声明。
- `src/index.ts`：导出 `createFeatureAssemblyModule`、`createFeatureAssembly` 及公共类型。
- `terminal-invariants.json`：公开面与包边界不变量。
- `test/featureAssembly.test.ts`：模块 owner 校验与依赖快照测试。

## 用法

feature 先提供自己的模块工厂，再交给本包的 assembly 工厂：

```ts
const assembly = createFeatureAssembly({
  parts,
  createModule: createSampleWallpaperPickerModule,
})

const module = assembly.createModule()
void module
```

`createFeatureAssemblyModule` 只接受 `moduleName` 以 `ui.feature.` 开头且 `kind` 为
`owner` 的真实 `RuntimeModule`，并返回冻结的依赖、command、actor 和 slice 列表。

## 在这个包上迭代时

先同步详设 D-13A、计划 B4 与 feature owner 的 dependency census，再检查
`package.json`、`src/dependencies.ts`、graph、public exports 和 README。新增能力必须
保持 base 不反向依赖 feature/integration/App，并为“未把真实运行期模块交给 resolver
确实缺模块”保留 focused red mutation；改完至少运行本包 typecheck/test 和对应的
terminal static checker。不要把业务身份、全量依赖数组或不可撤销的测试替身搬进这里。
