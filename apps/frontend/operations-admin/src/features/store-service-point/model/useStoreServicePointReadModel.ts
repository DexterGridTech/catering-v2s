import {useMemo} from 'react';
import {useCursorStack} from '@catering-v2s/admin-ui-foundation';
import {operationsRtk} from '../../../app/api/OperationsTransport';
import type {StoreServicePoint} from '../../../app/api/generated/operations-edge';
import {operationsAdminRtkRequest} from '../../../app/api/generated/operations-edge.rtk';
import {wireUuid} from '../../../app/api/wireUuid';
import type {OperationsPageProps} from '../../../app/routing/model';
import {STORE_SERVICE_POINT_PAGE_SIZE} from './storeServicePointModel';

type StoreServicePointReadModelProps = {
  queryContext: OperationsPageProps['queryContext'];
  gateReady: boolean;
  selectedAreaRef?: string;
  detailTarget?: StoreServicePoint;
  qrEditOpen: boolean;
};

const emptyUuid = '' as StoreServicePoint['storeRef'];

export function useStoreServicePointReadModel({
  queryContext,
  gateReady,
  selectedAreaRef,
  detailTarget,
  qrEditOpen,
}: StoreServicePointReadModelProps) {
  const storeRef = queryContext.scopeRef;
  const storeWireRef = storeRef ? wireUuid(storeRef) : emptyUuid;
  const scopeReady = Boolean(storeRef);

  const areaCursor = useCursorStack({resetKey: `${queryContext.groupWorkspaceKey}:${storeRef ?? ''}`});
  const areasRequest = useMemo(
    () =>
      operationsAdminRtkRequest.getOperationsStoreServicePointAreas(
        {groupWorkspaceKey: queryContext.groupWorkspaceKey, storeRef: storeWireRef},
        {query: {cursor: areaCursor.cursor, pageSize: STORE_SERVICE_POINT_PAGE_SIZE}},
      ),
    [areaCursor.cursor, queryContext.groupWorkspaceKey, storeWireRef],
  );
  const areasQuery = operationsRtk.useGetOperationsStoreServicePointAreasQuery(areasRequest, {
    skip: !gateReady || !scopeReady,
  });
  const areas = useMemo(() => areasQuery.currentData?.items ?? [], [areasQuery.currentData]);
  const selectedArea = areas.find(area => area.areaRef === selectedAreaRef);

  const pointCursor = useCursorStack({
    resetKey: `${queryContext.groupWorkspaceKey}:${storeRef ?? ''}:${selectedAreaRef ?? ''}`,
  });
  const pointsRequest = useMemo(
    () =>
      operationsAdminRtkRequest.getOperationsStoreServicePoints(
        {
          groupWorkspaceKey: queryContext.groupWorkspaceKey,
          storeRef: storeWireRef,
          areaRef: selectedAreaRef ? wireUuid(selectedAreaRef) : emptyUuid,
        },
        {query: {cursor: pointCursor.cursor, pageSize: STORE_SERVICE_POINT_PAGE_SIZE}},
      ),
    [pointCursor.cursor, queryContext.groupWorkspaceKey, selectedAreaRef, storeWireRef],
  );
  const pointsQuery = operationsRtk.useGetOperationsStoreServicePointsQuery(pointsRequest, {
    skip: !gateReady || !scopeReady || !selectedAreaRef,
  });
  const points = pointsQuery.currentData?.items ?? [];

  const qrRequest = useMemo(
    () =>
      operationsAdminRtkRequest.getOperationsStoreQrConfiguration(
        {groupWorkspaceKey: queryContext.groupWorkspaceKey, storeRef: storeWireRef},
        {},
      ),
    [queryContext.groupWorkspaceKey, storeWireRef],
  );
  const qrQuery = operationsRtk.useGetOperationsStoreQrConfigurationQuery(qrRequest, {
    skip: !gateReady || !scopeReady,
  });
  const qrConfiguration = qrQuery.currentData;

  const extensionDefinitionRequest = useMemo(
    () =>
      operationsAdminRtkRequest.getOperationsOrganizationBusinessEntityExtensionDefinition(
        {groupWorkspaceKey: queryContext.groupWorkspaceKey},
        {query: {expectedContextVersion: queryContext.expectedContextVersion, entityType: 'SERVICE_POINT'}},
      ),
    [queryContext.expectedContextVersion, queryContext.groupWorkspaceKey],
  );
  const extensionDefinitionQuery = operationsRtk.useGetOperationsOrganizationBusinessEntityExtensionDefinitionQuery(
    extensionDefinitionRequest,
    {skip: !gateReady || !scopeReady},
  );
  const extensionDefinition = extensionDefinitionQuery.currentData;

  const candidateRequest = useMemo(
    () =>
      operationsAdminRtkRequest.getOperationsStoreQrChannelCandidates(
        {groupWorkspaceKey: queryContext.groupWorkspaceKey, storeRef: storeWireRef},
        {},
      ),
    [queryContext.groupWorkspaceKey, storeWireRef],
  );
  const candidateQuery = operationsRtk.useGetOperationsStoreQrChannelCandidatesQuery(candidateRequest, {
    skip: !qrEditOpen || !gateReady || !scopeReady,
  });

  const detailRequest = useMemo(
    () =>
      operationsAdminRtkRequest.getOperationsStoreServicePoint(
        {
          groupWorkspaceKey: queryContext.groupWorkspaceKey,
          storeRef: storeWireRef,
          servicePointRef: detailTarget ? wireUuid(detailTarget.pointRef) : emptyUuid,
        },
        {},
      ),
    [detailTarget, queryContext.groupWorkspaceKey, storeWireRef],
  );
  const detailQuery = operationsRtk.useGetOperationsStoreServicePointQuery(detailRequest, {
    skip: !detailTarget || !gateReady || !scopeReady,
  });
  const detailValue =
    detailQuery.currentData && detailTarget && detailQuery.currentData.pointRef === detailTarget.pointRef
      ? detailQuery.currentData
      : detailTarget;

  return {
    storeRef,
    storeWireRef,
    scopeReady,
    areaCursor,
    areas,
    selectedArea,
    areasQuery,
    pointCursor,
    points,
    pointsQuery,
    qrConfiguration,
    qrQuery,
    extensionDefinition,
    extensionDefinitionQuery,
    candidateQuery,
    detailValue,
    detailQuery,
    refetchAreas: areasQuery.refetch,
    refetchPoints: pointsQuery.refetch,
    refetchQr: qrQuery.refetch,
  };
}

export type StoreServicePointReadModel = ReturnType<typeof useStoreServicePointReadModel>;
