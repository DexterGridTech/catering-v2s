import {nowTimestampMs} from '@catering-v2s/kernel-base-contracts';
import {defineActor, onCommand, type ActorDefinition} from '@catering-v2s/kernel-base-runtime';
import type {StateRoot} from '@catering-v2s/kernel-base-state';
import {moduleName} from '../../moduleName';
import {openLayerCommand} from '../../declarations/commands';
import {readContentState} from '../../foundations/workspaceSlices';
import {contentActions} from '../slices/contentActions';
import {isUiCatalogEntryAvailable} from '../../foundations/catalog';
import type {SurfaceForm, UiCatalog} from '../../types/catalog';
import {completeUiStateWrite} from './completeWrite';
import {
  assertContentWriteOwnership,
  createLayerPartUnavailableError,
  currentCatalogContext,
  currentWorkspace,
  dispatchContentAction,
  normalizeOpenLayerPayload,
} from './shared/contentActorSupport';

export const createOpenLayerActor = (
  input: Readonly<{
    readonly catalog: UiCatalog;
    readonly selectSurfaceForm: (root: StateRoot) => SurfaceForm;
  }>,
): ActorDefinition =>
  defineActor(moduleName, 'open-layer', [
    onCommand(openLayerCommand, async context => {
      const payload = normalizeOpenLayerPayload(context.command.payload);
      const state = context.getState();
      const catalogContext = currentCatalogContext({
        state,
        displayMode: payload.displayMode,
        selectSurfaceForm: input.selectSurfaceForm,
        workspaceOverride: payload.workspace,
      });
      const entry = input.catalog.byPartKey[payload.partKey];
      if (entry === undefined || !isUiCatalogEntryAvailable(entry, null, catalogContext)) {
        throw createLayerPartUnavailableError(context, {
          partKey: payload.partKey,
          catalog: input.catalog,
          catalogContext,
        });
      }
      const workspace = payload.workspace ?? currentWorkspace(context);
      assertContentWriteOwnership(context, workspace);
      const current = readContentState(context.getState(), workspace);
      if (current.contentSets[payload.displayMode].layers.some(layer => layer.layerId === payload.layerId)) {
        context.platformPorts.logger.warn({
          category: 'ui-state',
          event: 'ui-state.layer.duplicate-rejected',
          message: 'Duplicate UI layer id rejected',
          data: {workspace, displayMode: payload.displayMode, hasLayerId: true},
        });
        throw new Error('[ui-state] duplicate layerId');
      }
      return completeUiStateWrite(
        context,
        dispatchContentAction(
          context,
          contentActions.openLayer(
            Object.freeze({
              ...payload,
              openedAt: nowTimestampMs(),
            }),
          ),
          payload.workspace,
        ),
        'content',
      );
    }),
  ]);
