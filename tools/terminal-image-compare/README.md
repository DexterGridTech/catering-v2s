# TER 图片比较工具

这是 sample2 动态证据使用的独立支持工具，不属于 TER runtime、package graph 或 Android 生命周期。它只读取两张同尺寸、8-bit、非隔行 RGB/RGBA PNG 和一份显式 JSON metadata，输出壁纸 ROI 的 `changedFraction`、`P95`、`meanAbsDiff` 与 `changedCellFraction`。

## Metadata

```json
{
  "canvasRect": {"x": 0, "y": 0, "width": 1280, "height": 800},
  "roiRect": {"x": 0, "y": 0, "width": 1280, "height": 800},
  "maskRects": [{"x": 20, "y": 20, "width": 240, "height": 96}],
  "minUnmaskedFraction": 0.25
}
```

`canvasRect` 是固定的 8×8 网格坐标系，不随变化像素或 mask 外接矩形移动。ROI 是 `roiRect` 中排除 `maskRects` 后的像素集合；`roiRect` 至少覆盖 canvas 的 20%，mask 与 canvas 的交并面积最多占 80%，否则失败关闭。对每个网格格子，未被 mask 且位于 ROI 的像素占格子完整面积低于固定的 `0.25` 时，该格子同时从分子和分母剔除；不会用它制造“整张图只变一角也通过”的结果。metadata 必须写 `minUnmaskedFraction: 0.25`，其他值或省略都失败关闭。`changedCellFraction` 比较参与格子的平均 max-channel absolute difference 是否大于 4。

## 使用

```text
node compare.mjs before.png after.png metadata.json
```

工具遇到尺寸不同、unsupported PNG、缺少 ROI/mask metadata 或没有有效格子时失败关闭。`test/compare.test.mjs` 使用仓内已知 PNG 覆盖 unchanged/changed、尺寸不一致和阈值变异红夹具。
