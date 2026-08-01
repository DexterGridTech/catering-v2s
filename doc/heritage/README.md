# Heritage 来源

`catering-v2s` 是当前产品与实施真相。旧仓只作为显式、带 hash 的只读 Heritage 来源，绝不成为 runtime、build 或治理 fallback。

- `doc/heritage/required-inventory.json` 是当前批准的独立分母；R1 的 23 项初始冻结先扩展为 26 项，现再冻结两份 owning 原文，当前分母为 28 项，仍不构成 runtime/build fallback；
- `doc/heritage/registry.json` 是目标仓当前 Heritage 登记；
- `catering-all-v2` 的 28 份 selected assets 是 byte-for-byte 冻结副本；其中 admin UI
  decision/standard 位于 `doc/heritage/frozen/catering-all-v2/` 下对应的 source-path 镜像，
  为交互工件与 UI 治理的可回溯原文链，不构成 runtime、build 或实现 fallback；
- `catering-all-v1`、`catering-server-v4`、`requirement-doc` 在 R1 不选择任何具体资产，只允许未来 decision 显式加入 path/hash；
- 所有来源都必须保持 `writeBack=false`、`runtimeFallback=false`、`buildFallback=false`；
- 发现旧仓内容漂移时立即 fail-closed，并在 v2s 新建 decision；禁止回写旧仓或用聊天摘要替代原文。

标准校验：

```bash
scripts/check/heritage-registry
scripts/check/heritage-registry --self-test
```
