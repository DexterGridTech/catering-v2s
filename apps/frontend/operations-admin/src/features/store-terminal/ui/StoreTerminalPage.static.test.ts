import {readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';

const pageSource = readFileSync(new URL('./StoreTerminalPage.tsx', import.meta.url), 'utf8');
const detailSource = readFileSync(new URL('./StoreTerminalDetail.tsx', import.meta.url), 'utf8');
const drawerSource = readFileSync(new URL('./StoreTerminalFormDrawer.tsx', import.meta.url), 'utf8');
const printerSource = readFileSync(new URL('./TerminalPrinterEditor.tsx', import.meta.url), 'utf8');
const functionSource = readFileSync(new URL('./TerminalFunctionEditor.tsx', import.meta.url), 'utf8');
const sceneSource = readFileSync(new URL('./TerminalSceneEditor.tsx', import.meta.url), 'utf8');
const modelSource = readFileSync(new URL('../model/storeTerminalModel.ts', import.meta.url), 'utf8');
const source = [pageSource, detailSource, drawerSource, printerSource, functionSource, sceneSource, modelSource].join(
  '\n',
);

describe('store terminal IA static trace', () => {
  it('keeps the approved main/detail surface and hides activation code from the list', () => {
    expect(pageSource).toContain('gridTemplateColumns');
    expect(pageSource).toContain('新建终端');
    expect(pageSource).toContain('StoreTerminalDetailView');
    expect(pageSource).not.toContain('activationCode');
    expect(detailSource).toContain('激活码');
    expect(detailSource).not.toContain('copyable');
    expect(detailSource).toContain('areaReferences');
  });

  it('keeps the create/edit sequence and puts scenes inside each function', () => {
    expect(drawerSource).toContain("title: '基本信息'");
    expect(drawerSource).toContain("title: '打印机、功能与范围'");
    expect(drawerSource).toContain('formSectionNav');
    expect(drawerSource).toContain('>打印机信息</Typography.Title>');
    expect(drawerSource).toContain('>功能与范围</Typography.Title>');
    expect(functionSource).toContain('打印场景');
    expect(sceneSource).toContain("name={['functions', index, 'scenes', scene.key, 'printerKeys']}");
    expect(source).not.toContain('主打印机');
    expect(source).not.toContain('备打印机');
    expect(sceneSource).toContain('allowedPaperSpecKeys');
    expect(sceneSource).toContain('纸规格不匹配');
    expect(drawerSource).toContain('Modal.confirm');
    expect(printerSource).toContain('unbindPrinter');
    expect(functionSource).toContain('replaceScenes');
    expect(functionSource).toContain('selectedScenes');
    expect(functionSource).toContain('scenePicker');
    expect(functionSource).toContain('functionSelect');
    expect(functionSource).toContain('rangeOption');
    expect(functionSource).toContain('candidateCacheKey');
    expect(sceneSource).toContain('sceneOrderType');
    expect(drawerSource).toContain('scrollIntoView');
    expect(drawerSource).toContain('deviceTypeOption');
    expect(drawerSource).toContain('value.description');
    expect(modelSource).toContain('storeTerminalDeviceTypeDescriptions');
    expect(pageSource).toContain('创建后，在这里查看详情');
    expect(detailSource).toContain('emptyDescription');
    expect(drawerSource).toContain('functionOrdinal');
    expect(drawerSource).toContain('selectedFunctionIdentity');
    expect(drawerSource).toContain('functionList');
    expect(drawerSource).toContain('nextFunctionIdentityAfterRemoval');
    expect(drawerSource).toContain('gridTemplateColumns');
    expect(printerSource).toContain('validatePrinterSceneReferences');
    expect(pageSource).toContain('useDrawerFormLifecycle');
    expect(pageSource).toContain('getIdempotencyKey');
    expect(pageSource).toContain('ResizeObserver');
    expect(pageSource).toContain('contentWidth <= 992');
    expect(drawerSource).not.toContain('window.confirm');
  });

  it('uses contract-driven multi-select ranges and stable child identity', () => {
    expect(functionSource).toContain('mode="multiple"');
    expect(functionSource).toContain("const ALL = '__ALL__'");
    expect(functionSource).toContain('全部桌台区');
    expect(functionSource).toContain('全部生产标签');
    expect(modelSource).toContain('clientKey');
    expect(modelSource).toContain('printerClientKey');
    expect(modelSource).toContain('modelOptionsForBrandAndConnection');
    expect(modelSource).toContain('connectionOptionsForBrand');
    expect(pageSource).toContain('original idempotency key');
    expect(pageSource).not.toContain('existingTerminalRefs');
    expect(source).toContain('onValuesChange={handleValuesChange}');
  });
});
