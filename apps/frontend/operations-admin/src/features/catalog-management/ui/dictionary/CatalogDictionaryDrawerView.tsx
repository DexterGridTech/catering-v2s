import {Alert, Button, Tag, Tooltip, Typography} from 'antd';
import {testId} from '@catering-v2s/admin-ui-foundation';
import {type ReactNode} from 'react';
import {catalogEnumLabel} from '../../model/catalogManifestLabels';
import {catalogTestIdControls, catalogTestIds} from '../../catalogTestIds';
import {CatalogDefinitionLibraries} from '../CatalogDefinitionLibraries';
import {CatalogConfigurationDrawerSurface} from '../CatalogConfigurationDrawerSurface';
import {CatalogDictionaryAtomModals} from '../CatalogDictionaryAtomModals';
import {CatalogSimpleDictionaryLibrary} from '../CatalogSimpleDictionaryLibrary';
import {CatalogSkuAttributeLibrary} from '../CatalogSkuAttributeLibrary';
import type {CatalogDictionaryDrawerViewModel, DictionaryRow} from './CatalogDictionaryDrawerState';
import type {FormValues} from './catalogDictionaryDrawerModel';
import {
  catalogUnitVoidControlState,
  deleteActionLabel,
  unitDimensionLabel,
  unitDimensionOptions,
  voidReason,
} from './catalogDictionaryDrawerModel';

function TypographyHint({text}: {text: string}) {
  return <Typography.Text type="secondary">{text}</Typography.Text>;
}

function StatusTag({manifest, value}: {manifest: Parameters<typeof catalogEnumLabel>[0]; value: string}) {
  return (
    <Tag color={value === 'ENABLED' ? 'green' : value === 'VOIDED' ? 'red' : 'orange'}>
      {catalogEnumLabel(manifest, 'dictionaryEntryStatus', value)}
    </Tag>
  );
}

function withMutationReason(content: ReactNode, disabled: boolean, reason?: string) {
  if (!disabled || !reason) return content;
  return (
    <Tooltip title={reason}>
      <span style={{display: 'inline-block'}}>{content}</span>
    </Tooltip>
  );
}

export function CatalogDictionaryDrawerView({viewModel}: {viewModel: CatalogDictionaryDrawerViewModel}) {
  const {
    open,
    queryContext,
    canWrite,
    presentation,
    onAfterClose,
    configLibrary,
    setSelectedEntryRef,
    currentLibrary,
    isDefinitionLibrary,
    kind,
    editNameForm,
    editUnitForm,
    problem,
    setProblem,
    editingEntry,
    setEditingEntry,
    editingUnit,
    setEditingUnit,
    statusChange,
    setStatusChange,
    creatingKind,
    selectedAttributeRef,
    setDefinitionDirtyMessage,
    headers,
    isProduction,
    isUnit,
    simpleLibraryFilter,
    dictionaryCursor,
    attributeValuesCursor,
    productionCursor,
    lifecycle,
    requestConfigClose,
    manifest,
    dictionaryQuery,
    unitQuery,
    attributeValuesQuery,
    productionQuery,
    createEntryState,
    createTagState,
    updateEntryState,
    transitionEntryState,
    updateTagState,
    transitionTagState,
    createUnitState,
    updateUnitState,
    transitionUnitState,
    dictionaryData,
    attributeValuesData,
    productionData,
    openNameEdit,
    openUnitEdit,
    saveUnit,
    saveName,
    openStatusChange,
    changeStatus,
    deleteDictionaryEntry,
    rows,
    attributeValueRows,
    selectedAttribute,
    unitReadProblem,
    isSkuAttributeManagement,
    readOnlyReason,
    activeEntityLabel,
    activeEntityDescription,
    createLabel,
    creationKind,
    creationForm,
    codeFieldLabel,
    nameFieldLabel,
    creationTitle,
    creationFormTestId,
    submitCreation,
    openCreate,
    dismissCreate,
    changeLibrary,
  } = viewModel;
  return (
    <CatalogConfigurationDrawerSurface
      open={open}
      lifecycle={lifecycle}
      currentLibrary={currentLibrary}
      onSelectLibrary={changeLibrary}
      onRequestClose={requestConfigClose}
      onAfterClose={onAfterClose}
      presentation={presentation}
    >
      {problem && !creatingKind && !editingEntry && !statusChange && (
        <Alert
          type="error"
          showIcon
          title="字典操作未完成"
          description={problem}
          style={{marginBottom: 16}}
          {...testId(catalogTestIds.static.dictionaryProblem)}
        />
      )}
      {unitReadProblem && !problem && (
        <Alert
          type="error"
          showIcon
          title="计量单位读取失败"
          description={unitReadProblem}
          action={
            <Button type="link" onClick={() => void unitQuery.refetch()}>
              重试
            </Button>
          }
          style={{marginBottom: 16}}
          {...testId(catalogTestIds.static.unitReadProblem)}
        />
      )}
      {isDefinitionLibrary && (
        <CatalogDefinitionLibraries
          open={open}
          kind={currentLibrary === 'ATTRIBUTES' ? 'ATTRIBUTES' : 'ORDER_OPTIONS'}
          scopeRef={queryContext.scopeRef}
          headers={headers}
          canWrite={canWrite}
          definitionEditor={configLibrary.definitionEditor}
          onOpenDefinitionEditor={configLibrary.openDefinitionEditor}
          onCloseDefinitionEditor={configLibrary.closeDefinitionEditor}
          onEditorDirtyChange={setDefinitionDirtyMessage}
        />
      )}
      {!isDefinitionLibrary && isSkuAttributeManagement && (
        <CatalogSkuAttributeLibrary
          attributes={rows}
          selectedAttributeRef={selectedAttributeRef}
          selectedAttribute={selectedAttribute}
          attributeValues={attributeValueRows}
          canWrite={canWrite}
          attributesLoading={dictionaryQuery.isLoading || dictionaryQuery.isFetching}
          attributeValuesLoading={attributeValuesQuery.isLoading || attributeValuesQuery.isFetching}
          onSelectAttribute={setSelectedEntryRef}
          onCreateAttribute={() => openCreate('SKU_ATTRIBUTE')}
          onCreateValue={() => openCreate('SKU_ATTRIBUTE_VALUE')}
          renderStatus={value => <StatusTag manifest={manifest} value={value} />}
          renderVoidReason={attribute => {
            const reason = voidReason((attribute as DictionaryRow).voidAvailability);
            return reason ? <Typography.Text type="secondary">暂不能删除：{reason}</Typography.Text> : undefined;
          }}
          renderAttributeActions={attribute => {
            const row = attribute as DictionaryRow;
            const disabled = !canWrite || !row.voidAvailability?.canVoid;
            return (
              <>
                {row.status !== 'VOIDED' &&
                  withMutationReason(
                    <Button
                      type="link"
                      disabled={!canWrite}
                      onClick={() => openNameEdit(row)}
                      {...testId(catalogTestIdControls.config.action('SKU_ATTRIBUTE', row.code, 'edit'))}
                    >
                      编辑名称
                    </Button>,
                    !canWrite,
                    readOnlyReason,
                  )}
                {row.status !== 'VOIDED' &&
                  withMutationReason(
                    <Button
                      type="link"
                      disabled={!canWrite}
                      onClick={() => openStatusChange(row)}
                      {...testId(catalogTestIdControls.config.action('SKU_ATTRIBUTE', row.code, 'change-status'))}
                    >
                      {row.status === 'ENABLED' ? '停用' : '启用'}
                    </Button>,
                    !canWrite,
                    readOnlyReason,
                  )}
                {row.status !== 'VOIDED' &&
                  withMutationReason(
                    <Button
                      type="link"
                      danger
                      disabled={disabled}
                      onClick={() => deleteDictionaryEntry(row)}
                      {...testId(catalogTestIdControls.config.action('SKU_ATTRIBUTE', row.code, 'delete'))}
                    >
                      {deleteActionLabel(row.voidAvailability)}
                    </Button>,
                    disabled,
                    canWrite ? voidReason(row.voidAvailability) : readOnlyReason,
                  )}
              </>
            );
          }}
          renderValueActions={value => {
            const row = value as DictionaryRow;
            const disabled = !canWrite || !row.voidAvailability?.canVoid;
            return (
              <>
                {row.status !== 'VOIDED' &&
                  withMutationReason(
                    <Button
                      type="link"
                      disabled={!canWrite}
                      onClick={() => openNameEdit(row, 'SKU_ATTRIBUTE_VALUE')}
                      {...testId(catalogTestIdControls.config.action('SKU_ATTRIBUTE_VALUE', row.code, 'edit'))}
                    >
                      编辑名称
                    </Button>,
                    !canWrite,
                    readOnlyReason,
                  )}
                {row.status !== 'VOIDED' &&
                  withMutationReason(
                    <Button
                      type="link"
                      disabled={!canWrite}
                      onClick={() => openStatusChange(row, 'SKU_ATTRIBUTE_VALUE')}
                      {...testId(catalogTestIdControls.config.action('SKU_ATTRIBUTE_VALUE', row.code, 'change-status'))}
                    >
                      {row.status === 'ENABLED' ? '停用' : '启用'}
                    </Button>,
                    !canWrite,
                    readOnlyReason,
                  )}
                {row.status !== 'VOIDED' &&
                  withMutationReason(
                    <Button
                      type="link"
                      danger
                      disabled={disabled}
                      onClick={() => deleteDictionaryEntry(row, 'SKU_ATTRIBUTE_VALUE')}
                      {...testId(catalogTestIdControls.config.action('SKU_ATTRIBUTE_VALUE', row.code, 'delete'))}
                    >
                      {deleteActionLabel(row.voidAvailability)}
                    </Button>,
                    disabled,
                    canWrite ? voidReason(row.voidAvailability) : readOnlyReason,
                  )}
              </>
            );
          }}
          attributesPagination={{
            state: dictionaryCursor,
            nextCursor: dictionaryData?.cursor,
            testIdPrefix: catalogTestIds.static.skuAttributesPagination,
          }}
          attributeValuesPagination={{
            state: attributeValuesCursor,
            nextCursor: attributeValuesData?.cursor,
            testIdPrefix: catalogTestIds.static.skuAttributeValuesPagination,
          }}
        />
      )}
      {!isDefinitionLibrary && !isSkuAttributeManagement && (
        <CatalogSimpleDictionaryLibrary
          entityLabel={activeEntityLabel}
          libraryKey={kind}
          description={activeEntityDescription}
          rows={rows}
          filter={simpleLibraryFilter}
          canWrite={canWrite}
          isUnit={isUnit}
          isProduction={isProduction}
          loading={
            isUnit
              ? unitQuery.isLoading || unitQuery.isFetching
              : isProduction
                ? productionQuery.isLoading || productionQuery.isFetching
                : dictionaryQuery.isLoading || dictionaryQuery.isFetching
          }
          createLabel={createLabel}
          onCreate={() => openCreate(kind)}
          renderStatus={value => <StatusTag manifest={manifest} value={value} />}
          renderUnitDimension={value => unitDimensionLabel(value as FormValues['unitDimension'])}
          renderActions={simpleRow => {
            const row = simpleRow as DictionaryRow;
            if (isUnit) {
              const control = catalogUnitVoidControlState({
                canWrite,
                isReferenced: row.isReferenced,
                isTransitioning: transitionUnitState.isLoading,
              });
              return (
                <>
                  {row.status !== 'VOIDED' &&
                    withMutationReason(
                      <Button
                        type="link"
                        disabled={!canWrite}
                        onClick={() => (row.isReferenced ? openNameEdit(row) : openUnitEdit(row))}
                        {...testId(catalogTestIdControls.config.action('UNIT', row.code, 'edit'))}
                      >
                        {row.isReferenced ? '编辑名称' : '编辑单位'}
                      </Button>,
                      !canWrite,
                      readOnlyReason,
                    )}
                  {row.status !== 'VOIDED' &&
                    withMutationReason(
                      <Button
                        type="link"
                        danger={row.status === 'ENABLED'}
                        disabled={!canWrite}
                        onClick={() => openStatusChange(row)}
                        {...testId(catalogTestIdControls.config.action('UNIT', row.code, 'change-status'))}
                      >
                        {row.status === 'ENABLED' ? '停用' : '启用'}
                      </Button>,
                      !canWrite,
                      readOnlyReason,
                    )}
                  {row.status !== 'VOIDED' &&
                    withMutationReason(
                      <Button
                        type="link"
                        danger
                        disabled={control.disabled}
                        onClick={() => deleteDictionaryEntry(row, 'UNIT')}
                        {...testId(catalogTestIdControls.config.action('UNIT', row.code, 'delete'))}
                      >
                        删除
                      </Button>,
                      control.disabled,
                      control.reason,
                    )}
                </>
              );
            }
            const reason = canWrite ? voidReason(row.voidAvailability) : readOnlyReason;
            const canVoid = !canWrite || !row.voidAvailability?.canVoid;
            return (
              <>
                {row.status !== 'VOIDED' &&
                  withMutationReason(
                    <Button
                      type="link"
                      disabled={!canWrite}
                      onClick={() => openNameEdit(row)}
                      {...testId(catalogTestIdControls.config.action(kind, row.code, 'edit'))}
                    >
                      编辑名称
                    </Button>,
                    !canWrite,
                    readOnlyReason,
                  )}
                {row.status !== 'VOIDED' &&
                  withMutationReason(
                    <Button
                      type="link"
                      disabled={!canWrite}
                      onClick={() => openStatusChange(row)}
                      {...testId(catalogTestIdControls.config.action(kind, row.code, 'change-status'))}
                    >
                      {row.status === 'ENABLED' ? '停用' : '启用'}
                    </Button>,
                    !canWrite,
                    readOnlyReason,
                  )}
                {row.status !== 'VOIDED' &&
                  withMutationReason(
                    <Button
                      type="link"
                      danger
                      disabled={canVoid}
                      onClick={() => deleteDictionaryEntry(row)}
                      {...testId(catalogTestIdControls.config.action(kind, row.code, 'delete'))}
                    >
                      {deleteActionLabel(row.voidAvailability)}
                    </Button>,
                    canVoid,
                    reason,
                  )}
              </>
            );
          }}
          pagination={
            isUnit
              ? undefined
              : {
                  state: isProduction ? productionCursor : dictionaryCursor,
                  nextCursor: isProduction ? productionData?.cursor : dictionaryData?.cursor,
                  testIdPrefix: isProduction
                    ? catalogTestIds.static.productionTagsPagination
                    : catalogTestIds.static.dictionaryPagination,
                }
          }
        />
      )}
      <CatalogDictionaryAtomModals
        canWrite={canWrite}
        problem={problem}
        creatingKind={creatingKind}
        creationTitle={creationTitle}
        creationKind={creationKind}
        creationForm={creationForm}
        creationFormTestId={creationFormTestId}
        creationSubmitting={
          createEntryState.isLoading || createTagState.isLoading || createUnitState.isLoading || lifecycle.submitting
        }
        nameFieldLabel={nameFieldLabel}
        codeFieldLabel={codeFieldLabel}
        unitDimensionOptions={unitDimensionOptions}
        onCreationValuesChange={() => lifecycle.setDirty(true)}
        onCancelCreate={() => creatingKind && dismissCreate(creatingKind)}
        onSubmitCreate={submitCreation}
        editingEntry={editingEntry}
        editNameForm={editNameForm}
        nameSaveLoading={updateEntryState.isLoading || updateTagState.isLoading || updateUnitState.isLoading}
        renderStatus={value => <StatusTag manifest={manifest} value={value} />}
        onSaveName={() => void saveName()}
        onCancelName={() => {
          editNameForm.resetFields();
          setProblem(undefined);
          setEditingEntry(undefined);
        }}
        editingUnit={editingUnit}
        editUnitForm={editUnitForm}
        unitSaveLoading={updateUnitState.isLoading}
        onSaveUnit={() => void saveUnit()}
        onCancelUnit={() => {
          editUnitForm.resetFields();
          setProblem(undefined);
          setEditingUnit(undefined);
        }}
        statusChange={statusChange}
        statusSaveLoading={
          transitionEntryState.isLoading || transitionTagState.isLoading || transitionUnitState.isLoading
        }
        onChangeStatus={() => void changeStatus()}
        onCancelStatus={() => {
          setProblem(undefined);
          setStatusChange(undefined);
        }}
      />
      {!canWrite && <TypographyHint text="当前账号没有编辑商品库能力，只读查看字典。" />}
    </CatalogConfigurationDrawerSurface>
  );
}
