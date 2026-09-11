import {readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';

const read = (relativePath: string) => readFileSync(new URL(relativePath, import.meta.url), 'utf8');
const drawerSource = read('./BusinessChannelTemplateDrawer.tsx');
const pickerSource = read('./BusinessChannelTemplateStorePickerModal.tsx');
const detailSource = read('./BusinessChannelTemplateDetailDrawer.tsx');
const channelDetailSource = read('./BusinessChannelDetailDrawer.tsx');
const projectPageSource = read('./ProjectBusinessChannelPage.tsx');
const storePageSource = read('./StoreBusinessChannelPage.tsx');
const createSource = read('./BusinessChannelCreateDrawer.tsx');
const listSource = read('./BusinessChannelList.tsx');
const testIdsSource = read('../../../app/automation/businessChannelTemplateTestIds.ts');
const openingTagContaining = (source: string, componentName: string, marker: string) => {
  const markerIndex = source.indexOf(marker);
  if (markerIndex < 0) return '';
  const openingTagStart = source.lastIndexOf(`<${componentName}`, markerIndex);
  const openingTagEnd = source.indexOf('>', markerIndex);
  return source.slice(openingTagStart, openingTagEnd + 1);
};

describe('business-channel template visibility static admission', () => {
  it('keeps the app-owned TestId bindings explicit for static admission', () => {
    expect(drawerSource).toContain('businessChannelTemplateTestIds.visibilityScopeGroup');
    expect(drawerSource).toContain('businessChannelTemplateTestIds.visibilityScopeAllOption');
    expect(drawerSource).toContain('businessChannelTemplateTestIds.visibilityScopeSelectedOption');
    expect(drawerSource).toContain('businessChannelTemplateTestIds.visibleStoreAdd');
    expect(drawerSource).toContain('businessChannelTemplateTestIds.visibleStoreRemove(store.storeRef)');
    expect(drawerSource).toContain('businessChannelTemplateTestIds.visibleStoreVoidedTag(store.storeRef)');
    expect(drawerSource).toContain('businessChannelTemplateTestIds.visibleStoreEditReadRetry');
    expect(drawerSource).toContain('businessChannelTemplateTestIds.submit');
    expect(drawerSource).toContain('businessChannelTemplateTestIds.cancel');
    expect(drawerSource).toContain('businessChannelTemplateTestIds.templateForm');
    expect(drawerSource).toContain('businessChannelTemplateTestIds.externalDineInInfo');
    expect(drawerSource).toContain('businessChannelTemplateTestIds.providerOption(String(option.value))');
    expect(detailSource).not.toContain('businessChannelTemplateTestIds.externalDineInDetail');
    expect(channelDetailSource).toContain('businessChannelTemplateTestIds.externalDineInDetail');
    expect(channelDetailSource).toContain('providerCapabilityForOrderKind(nextTemplate.orderKind)');
    expect(channelDetailSource).toContain('channel.ownerNodeType');
    expect(channelDetailSource).toContain('外部系统不使用 POS、扫码或自助机点餐形式');
    expect(channelDetailSource).toContain('外部渠道不在本平台销售菜单范围内');
    expect(drawerSource).toContain('当前没有可用的外部到店点餐接入档案');
    expect(drawerSource).toContain('businessChannelTemplateTestIds.accessKindInternal');
    expect(drawerSource).toContain('businessChannelTemplateTestIds.accessKindExternal');
    expect(drawerSource).toContain('businessChannelTemplateTestIds.orderKindDineIn');
    expect(drawerSource).toContain('businessChannelTemplateTestIds.dineInFormPos');
    expect(drawerSource).toContain('businessChannelTemplateTestIds.providerReadProblem');
    expect(drawerSource).toContain('BusinessChannelTemplateStorePickerModal');
    expect(pickerSource).toContain('businessChannelTemplateTestIds.visibleStorePickerModal');
    expect(pickerSource).toContain('businessChannelTemplateTestIds.visibleStorePickerSearch');
    expect(pickerSource).toContain('businessChannelTemplateTestIds.visibleStorePickerList');
    expect(pickerSource).toContain('businessChannelTemplateTestIds.visibleStorePickerOption(storeRef)');
    expect(pickerSource).toContain('businessChannelTemplateTestIds.visibleStorePickerReadRetry');
    expect(pickerSource).toContain('businessChannelTemplateTestIds.visibleStorePickerCancel');
    expect(pickerSource).toContain('businessChannelTemplateTestIds.visibleStorePickerConfirm');
    expect(pickerSource).toContain('useOverlayLock(open)');
    expect(pickerSource).toContain('setDraftStores(selectedStores.map(store => ({...store})))');
    expect(pickerSource).toContain('onConfirm(draftStores.map(store => ({...store})))');
    expect(pickerSource).toContain('maskClosable={!disabled}');
    expect(pickerSource).not.toContain('mask={{');
    expect(
      openingTagContaining(pickerSource, 'Modal', 'businessChannelTemplateTestIds.visibleStorePickerModal'),
    ).toMatch(/^<Modal[\s>]/);
    expect(
      openingTagContaining(pickerSource, 'Input', 'businessChannelTemplateTestIds.visibleStorePickerSearch'),
    ).toMatch(/^<Input[\s>]/);
    expect(
      openingTagContaining(
        pickerSource,
        'Checkbox',
        'businessChannelTemplateTestIds.visibleStorePickerOption(storeRef)',
      ),
    ).toMatch(/^<Checkbox[\s>]/);
    expect(
      openingTagContaining(pickerSource, 'Button', 'businessChannelTemplateTestIds.visibleStorePickerReadRetry'),
    ).toMatch(/^<Button[\s>]/);
    expect(
      openingTagContaining(pickerSource, 'Button', 'businessChannelTemplateTestIds.visibleStorePickerCancel'),
    ).toMatch(/^<Button[\s>]/);
    expect(
      openingTagContaining(pickerSource, 'Button', 'businessChannelTemplateTestIds.visibleStorePickerConfirm'),
    ).toMatch(/^<Button[\s>]/);
    expect(drawerSource).not.toContain('visibleStoreCandidateSearch');
    expect(drawerSource).not.toContain('visibleStoreCandidateAdd');
    expect(drawerSource).not.toContain('visibleStoreCandidateReadRetry');
    expect(detailSource).toContain('businessChannelTemplateTestIds.visibleStoreReadRetry');
    expect(detailSource).toContain('businessChannelTemplateTestIds.visibleStorePage');
    expect(projectPageSource).toContain('businessChannelTemplateTestIds.templateScopeSummary');
    expect(storePageSource).toContain('businessChannelTemplateTestIds.storeTemplateCandidateTable');
    expect(storePageSource).not.toContain("title: '门店可见范围'");
    expect(storePageSource).not.toContain('storeVisibilityScope');
    expect(storePageSource).not.toContain('templateScopeSummary');
    for (const columnTitle of ['模板名称', '模板编码', '接入类型', '订单类型']) {
      expect(storePageSource).toContain(`title: '${columnTitle}'`);
    }
    expect(listSource).toContain('businessChannelTemplateTestIds.storeTemplateCandidateCreate');
    expect(createSource).toContain('businessChannelTemplateTestIds.storeTemplateSelect');
    expect(createSource).toContain('onStale?.()');
    expect(storePageSource).toContain('onStale={() => templateRefreshSignal.publish()}');
    expect(testIdsSource).not.toContain('business-channel-template-form-submit');
  });

  it('keeps final-set save and owner read boundaries in the form source', () => {
    expect(drawerSource).toContain('readAllBusinessChannelTemplateVisibleStores');
    expect(drawerSource).toContain('desiredScope');
    expect(drawerSource).toContain('finalVisibleStoreRefs');
    expect(drawerSource).toContain('storeVisibilityScope: desiredScope');
    expect(pickerSource).toContain("storeStatus: 'ENABLED'");
    expect(drawerSource).toContain('storePickerOpen');
    expect(drawerSource).toContain('onCandidateScroll={event => organizationCandidates.onPopupScroll(event)}');
    expect(detailSource).toContain("'NON_VOIDED'");
    expect(detailSource).toContain('范围变更只影响新建渠道选择，已创建渠道不受影响。');
  });
});
