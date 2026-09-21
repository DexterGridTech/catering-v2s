import {Button, Card, Segmented, Select, Space, Tooltip} from 'antd';
import {NameCodeText, testId} from '@catering-v2s/admin-ui-foundation';
import {catalogTestIdControls, catalogTestIds} from '../catalogTestIds';
import {catalogFieldWidth} from './catalogFieldWidths';

type Brand = {id: string; name: string; code: string};
type Props = {
  surface: 'store' | 'brand';
  view: 'TREE_TABLE' | 'TABLE_ONLY';
  onViewChange: (view: 'TREE_TABLE' | 'TABLE_ONLY') => void;
  brands: Brand[];
  brandRef?: string;
  brandsLoading: boolean;
  onBrandChange: (brandRef: string) => void;
  canWrite: boolean;
  canCreate: boolean;
  createUnavailableReason?: string;
  canBrandCopy: boolean;
  onOpenConfig: () => void;
  onOpenBrandCopy: () => void;
  onOpenCreate: () => void;
};

/** Pure first-level toolbar; all task and query state remains in the controller. */
export function CatalogWorkbenchToolbar({
  surface,
  view,
  onViewChange,
  brands,
  brandRef,
  brandsLoading,
  onBrandChange,
  canWrite,
  canCreate,
  createUnavailableReason,
  canBrandCopy,
  onOpenConfig,
  onOpenBrandCopy,
  onOpenCreate,
}: Props) {
  const createButton = (
    <Button type="primary" disabled={!canCreate} onClick={onOpenCreate} {...testId(catalogTestIds.control.createOpen)}>
      新建商品
    </Button>
  );
  return (
    <Card
      size="small"
      {...testId(catalogTestIds.surface.workbenchToolbar)}
      styles={{body: {display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap'}}}
    >
      <Space wrap>
        <Segmented
          value={view}
          options={[
            {
              label: <span {...testId(catalogTestIdControls.workbench.viewTree)}>树表视图</span>,
              value: 'TREE_TABLE',
            },
            {
              label: <span {...testId(catalogTestIdControls.workbench.viewTable)}>仅表格</span>,
              value: 'TABLE_ONLY',
            },
          ]}
          onChange={value => onViewChange(value as 'TREE_TABLE' | 'TABLE_ONLY')}
          {...testId(catalogTestIds.control.viewSwitch)}
        />
        {surface === 'brand' && (
          <Select
            value={brandRef}
            loading={brandsLoading}
            placeholder="选择已授权品牌"
            options={brands.map(brand => ({
              value: brand.id,
              label: <NameCodeText name={brand.name} code={brand.code} />,
            }))}
            optionRender={option => (
              <span {...testId(catalogTestIdControls.workbench.brandOption(String(option.value)))}>{option.label}</span>
            )}
            onChange={onBrandChange}
            style={catalogFieldWidth('regular')}
            {...testId(catalogTestIds.control.brandSwitch)}
          />
        )}
      </Space>
      <Space wrap>
        <Button onClick={onOpenConfig} {...testId(catalogTestIdControls.workbench.openConfig)}>
          商品元数据
        </Button>
        {surface === 'store' && canWrite && canBrandCopy && (
          <Button onClick={onOpenBrandCopy} {...testId(catalogTestIdControls.workbench.openBrandCopy)}>
            从品牌复制
          </Button>
        )}
        {canWrite &&
          (canCreate || !createUnavailableReason ? (
            createButton
          ) : (
            <Tooltip title={createUnavailableReason}>
              <span style={{display: 'inline-block'}}>{createButton}</span>
            </Tooltip>
          ))}
      </Space>
    </Card>
  );
}
