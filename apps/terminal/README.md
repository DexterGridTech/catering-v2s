# TER 工作区

`@catering-v2s/terminal` 是 `apps/terminal/` 的 Yarn 工作区根和脚本聚合入口，不是运行时模块、业务 owner 或可供应用导入的代码包。具体职责由下级 `kernel/`、`adapter/`、`application/`、`ui/` workspace 包拥有；新增实现必须进入对应包，根目录只维护工作区级依赖与统一命令。

## 作用与边界

- 需要对 TER 子包执行统一类型检查、测试、lint、格式检查或骨架验证时，使用本工作区脚本。
- 业务状态、command、selector、平台端口实现、界面和应用装配都不属于本聚合包。
- 根 package 只依赖 workspace 共用的外部 store 与 React 版本；实际模块依赖在各 owning package 中声明。

## 结构

- `kernel/base/`：Runtime、state、通用端口及基础能力包。
- `kernel/feature/`：TER 业务 owner 与可复用业务能力包。
- `adapter/`：Android 等平台端口实现。
- `application/`：平台宿主与具体终端应用。
- `ui/base/`：跨 integration 复用的 UI foundation。
- `ui/feature/`：终端业务 UI feature。
- `ui/integration/`：将当前应用所需 owner、adapter 与 UI 组合为可运行应用。
- `skeleton-graph.ts`：工作区依赖图与机械验证所用的包关系事实。

## 用法

在仓库根运行以下工作区命令；它们仅作用于 TER 子包：

```sh
yarn --cwd apps/terminal typecheck
yarn --cwd apps/terminal test
```

需要检查包布局时运行 `yarn --cwd apps/terminal verify:static`。本聚合根不提供 JavaScript import API。

## 在这个包上迭代时

先判断变化的事实归哪个子包 owner，再在那个包内修改并执行其 owned checks。只有工作区依赖或跨包静态图变化才编辑根级清单；依赖图更新后运行 `yarn --cwd apps/terminal verify:static`。不要把根级 `typecheck`、`test` 或 `lint` 当作单个小改动的默认命令，按受影响包选择最窄的 owned 命令。
