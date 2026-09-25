import {readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';

const pageSource = readFileSync(new URL('./StoreTerminalPage.tsx', import.meta.url), 'utf8');
const detailSource = readFileSync(new URL('./StoreTerminalDetail.tsx', import.meta.url), 'utf8');
const drawerSource = readFileSync(new URL('./StoreTerminalFormDrawer.tsx', import.meta.url), 'utf8');
const printerSource = readFileSync(new URL('./TerminalPrinterEditor.tsx', import.meta.url), 'utf8');
const functionSource = readFileSync(new URL('./TerminalFunctionEditor.tsx', import.meta.url), 'utf8');
const sceneSource = readFileSync(new URL('./TerminalSceneEditor.tsx', import.meta.url), 'utf8');
const modelSource = readFileSync(new URL('../model/storeTerminalModel.ts', import.meta.url), 'utf8');
const readModelSource = readFileSync(new URL('../model/useStoreTerminalReadModel.ts', import.meta.url), 'utf8');
const commandsSource = readFileSync(new URL('../model/storeTerminalCommands.ts', import.meta.url), 'utf8');
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
    expect(detailSource).toContain('AdminDetailActionLabel');
    expect(detailSource).toContain('testIdValue={storeTerminalTestIds.statusAction(status)}');
    expect(detailSource).toContain('triggerRef={statusTriggerRef}');
    expect(pageSource).toContain('const statusTriggerRef = useRef<HTMLButtonElement | null>(null);');
    expect(pageSource).toContain('const statusAfterOpenChange = useCallback((visible: boolean) =>');
    expect(pageSource).toContain('afterOpenChange: statusAfterOpenChange');
    expect(pageSource).toContain('trigger.focus()');
  });

  it('keeps the two-tab drawer and puts scenes inside each function', () => {
    expect(drawerSource).toContain("formTab('basic')");
    expect(drawerSource).toContain("formTab('functions')");
    expect(drawerSource).not.toContain('Steps');
    expect(drawerSource).not.toContain('formNext');
    expect(drawerSource).not.toContain('formBack');
    expect(drawerSource).toContain('>打印机信息</Typography.Title>');
    expect(drawerSource).toContain('>功能与范围</Typography.Title>');
    expect(functionSource).toContain('打印场景');
    expect(sceneSource).toContain("name={[index, 'scenes', scene.key, 'printerKeys']}");
    expect(sceneSource).not.toContain('<Input type="hidden" />');
    expect(sceneSource).not.toContain('value={sceneValue.printerKeys}');
    expect(sceneSource).not.toContain('data-debug-printer-keys');
    expect(sceneSource).not.toContain("form.setFieldValue(['functions', index, 'scenes', scene.key, 'printerKeys']");
    expect(sceneSource).not.toContain('onChange={(next: string[]) => {');
    expect(sceneSource).not.toContain("form.getFieldValue(['functions', index, 'scenes', scene.key])");
    expect(sceneSource).toContain('const displayPrinterKeys = scenePrinterKeysForDisplay(currentScene?.printerKeys);');
    expect(sceneSource).toContain('printerKeys: displayPrinterKeys.keys');
    expect(printerSource).toContain("name={[index, 'brandKey']}");
    expect(printerSource).toContain("name={[index, 'modelKey']}");
    expect(printerSource).toContain("name={[index, 'ref']}");
    expect(printerSource).toContain("name={[index, 'clientKey']}");
    expect(functionSource).toContain("name={[index, 'selectedRangeKeys']}");
    expect(functionSource).toContain("name={[index, 'ref']}");
    expect(functionSource).toContain("name={[index, 'clientKey']}");
    expect(functionSource).toContain("Form.useWatch(['functions', index, 'functionKey'], form)");
    expect(functionSource).toContain('shouldUpdate={(previous, next) => previous.functions?.[index]?.scenes');
    expect(functionSource).toContain("form.getFieldValue(['functions', index, 'scenes'])");
    expect(functionSource).toContain("name={[index, 'scenes', scene.key, 'selected']}");
    expect(functionSource).not.toContain('onChange={() => onValuesChange()}');
    expect(functionSource).not.toContain('const storedFunction =');
    expect(sceneSource).toContain("Form.useWatch(['functions', index, 'scenes', scene.key], form)");
    expect(printerSource).toContain("Form.useWatch(['printers', index, 'modelKey'], form)");
    expect(source).not.toContain("name={['printers', index,");
    expect(source).not.toContain("name={['functions', index,");
    expect(source).not.toContain('主打印机');
    expect(source).not.toContain('备打印机');
    expect(sceneSource).toContain('allowedPaperSpecKeys');
    expect(sceneSource).toContain('纸规格不匹配');
    expect(sceneSource).toContain('场景配置读取失败，请重新选择');
    expect(drawerSource).toContain('Modal.confirm');
    expect(printerSource).toContain('unbindPrinter');
    expect(functionSource).not.toContain('replaceScenes');
    expect(functionSource).toContain('selectedScenes');
    expect(functionSource).toContain('scenePicker');
    expect(functionSource).toContain('functionType');
    expect(functionSource).not.toContain('storeTerminalTestIds.functionSelect');
    expect(functionSource).toContain('rangeOption');
    expect(functionSource).toContain('candidateCacheKey');
    expect(sceneSource).toContain('sceneOrderType');
    expect(drawerSource).toContain('form.scrollToField');
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
    expect(functionSource).toContain('normalizeCandidateSelection');
    expect(functionSource).toContain("form.setFieldValue(['functions', index, 'tableAreaAll'], patch.tableAreaAll)");
    expect(functionSource).toContain("form.setFieldValue(['functions', index, 'tableAreaRefs'], patch.tableAreaRefs)");
    expect(functionSource).toContain(
      "form.setFieldValue(['functions', index, 'productionTagAll'], patch.productionTagAll)",
    );
    expect(functionSource).toContain(
      "form.setFieldValue(['functions', index, 'productionTagRefs'], patch.productionTagRefs)",
    );
    expect(functionSource).not.toContain("form.getFieldValue('functions')");
    expect(functionSource).not.toContain('functions.map((item, itemIndex)');
    expect(functionSource).toContain('全部桌台区');
    expect(functionSource).toContain('全部生产标签');
    expect(modelSource).toContain('clientKey');
    expect(modelSource).toContain('printerClientKey');
    expect(modelSource).toContain('modelOptionsForBrandAndConnection');
    expect(modelSource).toContain('connectionOptionsForBrand');
    expect(pageSource).toContain('drawerLifecycle.getIdempotencyKey()');
    expect(pageSource).not.toContain('existingTerminalRefs');
    expect(source).toContain('onValuesChange={handleValuesChange}');
  });

  it('derives repeatable mutation keys and does not create a page-private recovery state machine', () => {
    expect(commandsSource).toContain('createContentIdempotencyKey');
    expect(commandsSource).toMatch(
      /OPERATIONS_ADMIN_OPERATION_IDS\.putOperationsStoreTerminal,\s*\{\s*path,\s*body,\s*\}/,
    );
    expect(commandsSource).toMatch(/OPERATIONS_ADMIN_OPERATION_IDS\.postOperationsStoreTerminalStatus,\s*\{/);
    expect(pageSource).not.toContain('recoveryPending');
    expect(pageSource).not.toContain('unknownMutationAttempt');
    expect(pageSource).not.toContain('statusResultUnknown');
    expect(pageSource).not.toContain("errorCode: 'PLATFORM_COMMON");
    expect(pageSource).not.toContain("associatedId: 'frontend-");
    expect(pageSource).toContain('onRetry: () => void form.submit()');
  });

  it('keeps every terminal collection request within the contract page-size bound', () => {
    expect(readModelSource).not.toContain('pageSize: 50');
    expect(readModelSource.match(/pageSize: STORE_TERMINAL_PAGE_SIZE/g)).toHaveLength(3);
  });

  it('never derives dynamic child control identity from Form.List position', () => {
    expect(modelSource).toContain('export function requireTerminalIdentity(');
    expect(drawerSource).toContain('const identity = terminalFunctionIdentity(currentFunction);');
    expect(drawerSource).toContain("requireTerminalIdentity(identity, 'function')");
    expect(drawerSource).toContain('const printerIdentity = terminalPrinterIdentity(currentPrinter);');
    expect(drawerSource).toContain("requireTerminalIdentity(printerIdentity, 'printer')");
    expect(sceneSource).toContain("requireTerminalIdentity(terminalPrinterIdentity(printer), 'printer')");
    expect(sceneSource).toContain('requireTerminalIdentity');
    expect(drawerSource).not.toContain('function-${field.key}');
    expect(drawerSource).not.toContain('pending-function-${field.key}');
    expect(drawerSource).not.toContain('pending-printer-${field.key}');

    const functionFallbackMutation = drawerSource.replace(
      'const identity = terminalFunctionIdentity(currentFunction);',
      'const identity = terminalFunctionIdentity(currentFunction) || `function-${field.key}`;',
    );
    const printerFallbackMutation = drawerSource.replace(
      'const printerIdentity = terminalPrinterIdentity(currentPrinter);',
      'const printerIdentity = terminalPrinterIdentity(currentPrinter) || `printer-${field.key}`;',
    );
    expect(functionFallbackMutation).toContain('function-${field.key}');
    expect(printerFallbackMutation).toContain('printer-${field.key}');
    expect(() => {
      expect(functionFallbackMutation).not.toContain('function-${field.key}');
    }).toThrow();
    expect(() => {
      expect(printerFallbackMutation).not.toContain('printer-${field.key}');
    }).toThrow();
  });

  it('fails closed when a scene printer binding is empty, unknown, or stale', () => {
    expect(modelSource).toContain('export function resolveTerminalPrinter(');
    expect(modelSource).toContain('const printer = resolveTerminalPrinter(printerKey, printers);');
    expect(modelSource).toContain('TERMINAL_SCENE_PRINTER_IDENTITY_MISSING');
    expect(modelSource).toContain('TERMINAL_SCENE_PRINTER_IDENTITY_INVALID');
    expect(modelSource).toContain('const rawPrinterKeys: unknown = value?.printerKeys;');
    expect(modelSource).toContain('const printerKeys = scenePrinterKeys(rawPrinterKeys);');

    const resolverMutation = modelSource.replace(
      'const printer = resolveTerminalPrinter(printerKey, printers);',
      'const printer = printers[0];',
    );
    expect(() => {
      expect(resolverMutation).toContain('const printer = resolveTerminalPrinter(printerKey, printers);');
    }).toThrow();
    const filterMutation = modelSource.replace(
      'const printerKeys = scenePrinterKeys(rawPrinterKeys);',
      'const printerKeys = stringValues(rawPrinterKeys);',
    );
    expect(() => {
      expect(filterMutation).toContain('const printerKeys = scenePrinterKeys(rawPrinterKeys);');
    }).toThrow();
    const normalizeFilterMutation = modelSource.replace(
      'printerKeys: preserveScenePrinterKeys(scene?.printerKeys),',
      'printerKeys: stringValues(scene?.printerKeys),',
    );
    expect(() => {
      expect(normalizeFilterMutation).toContain('printerKeys: preserveScenePrinterKeys(scene?.printerKeys),');
    }).toThrow();
  });

  it('does not let selection changes duplicate refresh-signal reads', () => {
    expect(readModelSource).toContain('const lastContentTabRefreshVersion = useRef<number | undefined>(undefined);');
    expect(readModelSource).toContain(
      'if (contentTabRefreshVersion === 0 || contentTabRefreshVersion === lastContentTabRefreshVersion.current) return;',
    );
    expect(readModelSource).toContain('lastContentTabRefreshVersion.current = contentTabRefreshVersion;');
  });

  it('keeps candidate page acceptance on stable foundation callbacks', () => {
    expect(readModelSource).toContain('const acceptAreaCandidatePage = areaCandidates.acceptPage;');
    expect(readModelSource).toContain('const acceptTagCandidatePage = tagCandidates.acceptPage;');
    expect(readModelSource).not.toContain('areaCandidates.acceptPage(');
    expect(readModelSource).not.toContain('tagCandidates.acceptPage(');
    expect(readModelSource).toContain('[acceptAreaCandidatePage, areaCandidatesQuery.currentData]');
    expect(readModelSource).toContain('[acceptTagCandidatePage, tagCandidatesQuery.currentData]');
  });

  it('defers create candidate reads until configuration is opened', () => {
    expect(pageSource).toContain('const [editorConfigurationOpen, setEditorConfigurationOpen] = useState(false);');
    expect(pageSource).toContain("editorOpen: Boolean(editor) && (editor?.mode === 'edit' || editorConfigurationOpen)");
    expect(pageSource).toContain(
      'const openEditorConfiguration = useCallback(() => setEditorConfigurationOpen(true), []);',
    );
    expect(pageSource).toContain('onConfigurationOpen: openEditorConfiguration');
    expect(drawerSource).toContain('onConfigurationOpen();');
    expect(drawerSource).toContain('const editorKey = editor');
    expect(drawerSource).toContain('}, [editorKey, editorMode, onConfigurationOpen]);');
    expect(drawerSource).toContain("formTab('basic')");
    expect(drawerSource).toContain("formTab('functions')");
    expect(drawerSource).not.toContain('setStep(');
    expect(drawerSource).not.toContain('sectionItems');
    expect(drawerSource).toContain('const storedFunctions = storedValues.functions');
    expect(drawerSource).toContain('const functionValues = Array.isArray(storedFunctions)');
    expect(drawerSource).toContain('Array.isArray(watchedFunctions)');
    expect(drawerSource).toContain('watchedFunctions.filter((value): value is StoreTerminalFormValues');
    expect(drawerSource).toContain(
      'const storedValues = form.getFieldsValue(true) as Partial<StoreTerminalFormValues>',
    );
    expect(drawerSource).toContain('const storedPrinters = storedValues.printers');
    expect(drawerSource).toContain('const nextPrinter = newTerminalPrinter();');
    expect(drawerSource).toContain("form.setFieldValue(['printers', nextIndex, 'clientKey'], nextPrinter.clientKey)");
    expect(drawerSource).toContain('const rawPrinterValues = Array.isArray(storedPrinters)');
    expect(drawerSource).toContain('normalizeTerminalPrinterForm');
    expect(functionSource).toContain('printerValues: readonly TerminalPrinterForm[]');
    expect(functionSource).toContain("form.getFieldValue(['functions', index, 'functionKey'])");
  });

  it('keeps a newly added function row mounted across the Form.List registration window', () => {
    expect(drawerSource).toContain(
      "const pendingFunctionsRef = useRef(new Map<number, StoreTerminalFormValues['functions'][number]>());",
    );
    expect(drawerSource).toContain('const pendingFunction = pendingFunctionsRef.current.get(field.name);');
    expect(drawerSource).toContain('pendingFunctionsRef.current.set(nextIndex, next);');
    expect(drawerSource).toContain('normalizeTerminalFunctionForm(storedFunction)');
    expect(drawerSource).toContain('normalizeTerminalFunctionForm(pendingFunction)');
  });

  it('submits the preserved aggregate draft when only one function editor is mounted', () => {
    expect(drawerSource).toContain('const handleFinish = () => {');
    expect(drawerSource).toContain('handleStoreTerminalFormFinish(form, onFinish);');
    expect(drawerSource).toContain('export function preservedTerminalFormValues(');
    expect(drawerSource).toContain('export function handleStoreTerminalFormFinish(');
    expect(drawerSource).toContain('onFinish={handleFinish}');
    expect(drawerSource).not.toContain('onFinish={onFinish}');
  });

  it('registers the controlled function key in the submitted Form.List row', () => {
    expect(functionSource).toContain("<Form.Item name={[index, 'functionKey']} hidden>");
  });
});
