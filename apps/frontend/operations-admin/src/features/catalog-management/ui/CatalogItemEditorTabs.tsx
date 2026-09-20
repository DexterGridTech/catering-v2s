import {Space, Tabs, Tooltip, Typography} from 'antd';
import type {CatalogDetail} from '../model/catalogModel';
import {catalogEditorTabIsAllowed, catalogEditorTabLabel} from '../model/catalogTabLabels';
import {draftSection} from '../model/catalogItemEditorDraftAdapters';
import type {CatalogItemDraftSectionState} from '../model/useCatalogItemDraft';
import type {CatalogItemEditorSectionProps} from './CatalogItemEditorSectionProps';
import {CatalogItemEditorSectionAssembler} from './CatalogItemEditorSectionAssembler';
import {catalogItemTabTestId} from '../catalogTestIds';

/**
 * The only editor tab renderer. It consumes typed section adapters from the
 * workspace state hook; it never owns server facts or recoverable draft state.
 */
export function CatalogItemEditorTabs({
  detail,
  activeTab,
  sectionState,
  sectionProps,
  onActiveTabChange,
}: {
  detail: NonNullable<CatalogDetail>;
  activeTab: string;
  sectionState: CatalogItemDraftSectionState;
  sectionProps: Omit<CatalogItemEditorSectionProps, 'tabKey'>;
  onActiveTabChange: (tabKey: string) => void;
}) {
  return (
    <Tabs
      tabPosition="left"
      activeKey={activeTab}
      onChange={onActiveTabChange}
      items={detail.tabs
        .filter(tab => tab.visible && catalogEditorTabIsAllowed(tab.tabKey))
        .map(tab => ({
          key: tab.tabKey,
          label:
            tab.disabled && tab.reason ? (
              <Tooltip title={tab.reason}>
                <span
                  data-testid={catalogItemTabTestId(tab.tabKey)}
                  data-active={activeTab === tab.tabKey ? 'true' : 'false'}
                >
                  {catalogEditorTabLabel(tab.tabKey)}
                </span>
              </Tooltip>
            ) : (
              <Space
                size={4}
                data-testid={catalogItemTabTestId(tab.tabKey)}
                data-active={activeTab === tab.tabKey ? 'true' : 'false'}
              >
                <span>{catalogEditorTabLabel(tab.tabKey)}</span>
                {sectionState.dirtySections[draftSection(tab.tabKey)] && (
                  <Typography.Text type="warning" aria-label="本页有未保存内容">
                    未保存
                  </Typography.Text>
                )}
                {sectionState.sectionErrors[draftSection(tab.tabKey)] && (
                  <Typography.Text type="danger" aria-label="本页有待修正内容">
                    待修正
                  </Typography.Text>
                )}
              </Space>
            ),
          disabled: tab.disabled,
          children: <CatalogItemEditorSectionAssembler {...sectionProps} tabKey={tab.tabKey} />,
        }))}
    />
  );
}
