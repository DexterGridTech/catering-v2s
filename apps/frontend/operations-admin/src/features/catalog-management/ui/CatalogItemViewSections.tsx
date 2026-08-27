import type {CatalogDetail} from '../model/catalogModel';
import {catalogViewTabLabel} from '../model/catalogTabLabels';
import type {CatalogManifest} from '../model/catalogItemSurfaceTypes';
import {EmptySection} from './CatalogItemReadOnlyPresenters';
import {CatalogItemAttributesView} from './CatalogItemAttributesView';
import {CatalogItemBasicView} from './CatalogItemBasicView';
import {CatalogItemCompositeView} from './CatalogItemCompositeView';
import {CatalogItemGovernanceView} from './CatalogItemGovernanceView';
import {CatalogItemIdentifiersView} from './CatalogItemIdentifiersView';
import {CatalogItemInventoryBomView} from './CatalogItemInventoryBomView';
import {CatalogItemOrderOptionsView} from './CatalogItemOrderOptionsView';
import {CatalogItemProductionView} from './CatalogItemProductionView';
import {CatalogItemSkuSpecificationsView} from './CatalogItemSkuSpecificationsView';
type Detail = NonNullable<CatalogDetail>;
export function CatalogItemViewTabContent({
  tabKey,
  detail,
  manifest,
  onNavigateTab,
  onOpenReferencedItem,
}: {
  tabKey: string;
  detail: Detail;
  manifest?: CatalogManifest;
  onNavigateTab: (key: string) => void;
  onOpenReferencedItem: (itemCode: string) => void;
}) {
  if (tabKey === 'basic')
    return <CatalogItemBasicView detail={detail} manifest={manifest} onNavigateTab={onNavigateTab} />;
  if (tabKey === 'identifiers') return <CatalogItemIdentifiersView detail={detail} />;
  if (tabKey === 'sku-specifications-pricing')
    return <CatalogItemSkuSpecificationsView detail={detail} manifest={manifest} />;
  if (tabKey === 'attributes') return <CatalogItemAttributesView detail={detail} />;
  if (tabKey === 'order-options') return <CatalogItemOrderOptionsView detail={detail} />;
  if (tabKey === 'production-prompts')
    return <CatalogItemProductionView detail={detail} onNavigateTab={onNavigateTab} />;
  if (tabKey === 'inventory-bom') return <CatalogItemInventoryBomView detail={detail} />;
  if (tabKey === 'composite-content') return <CatalogItemCompositeView detail={detail} />;
  if (tabKey === 'governance')
    return (
      <CatalogItemGovernanceView detail={detail} manifest={manifest} onOpenReferencedItem={onOpenReferencedItem} />
    );
  return <EmptySection text={`${catalogViewTabLabel(tabKey)}尚未维护`} />;
}
