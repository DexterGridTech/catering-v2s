import type {PortResult} from '../types/result';
import type {
  UpdateAction,
  UpdateActionInput,
  UpdateCall,
  UpdateFacts,
  UpdatePort,
  UpdatePresentationListener,
  UpdatePresentation,
  UpdateInstallerConfirmationResult,
  UpdatePreparedArtifact,
  UpdateSource,
} from '../types/update';
import {createUnavailable} from './createUnavailable';

const PORT_DESCRIPTOR_KEY = Symbol.for('catering-v2s.platform-ports.descriptor');
export const unavailableUpdatePort: UpdatePort = {
  readPresentation: async (_input: UpdateCall): Promise<PortResult<UpdatePresentation>> =>
    createUnavailable('update', 'readPresentation'),
  subscribePresentation: (_listener: UpdatePresentationListener) => () => undefined,
  readFacts: async (_input: UpdateCall): Promise<PortResult<UpdateFacts>> => createUnavailable('update', 'readFacts'),
  prepareArtifact: async (_input: UpdateCall & UpdateSource): Promise<PortResult<UpdatePreparedArtifact>> =>
    createUnavailable('update', 'prepareArtifact'),
  applyPrepared: async (_input: UpdateActionInput): Promise<PortResult<UpdateAction>> =>
    createUnavailable('update', 'applyPrepared'),
  readAction: async (
    _input: UpdateCall & Readonly<{taskId: string; actionId: string}>,
  ): Promise<PortResult<UpdateAction | null>> => createUnavailable('update', 'readAction'),
  presentInstallerConfirmation: async (): Promise<PortResult<UpdateInstallerConfirmationResult>> =>
    createUnavailable('update', 'presentInstallerConfirmation'),
  confirmBoot: async (
    _input: UpdateCall & Readonly<{bootToken: string; publicationId: string}>,
  ): Promise<PortResult<Readonly<{confirmed: true}>>> => createUnavailable('update', 'confirmBoot'),
  releasePrepared: async (
    _input: UpdateCall & Readonly<{preparedId: string}>,
  ): Promise<PortResult<Readonly<{released: boolean}>>> => createUnavailable('update', 'releasePrepared'),
};

Object.defineProperty(unavailableUpdatePort, PORT_DESCRIPTOR_KEY, {
  value: Object.freeze({
    port: 'update',
    capabilities: Object.freeze(
      [
        'readPresentation',
        'subscribePresentation',
        'readFacts',
        'prepareArtifact',
        'applyPrepared',
        'readAction',
        'presentInstallerConfirmation',
        'confirmBoot',
        'releasePrepared',
      ].map(
        capability => Object.freeze({capability, state: 'unavailable' as const, source: 'default' as const}),
      ),
    ),
  }),
  enumerable: false,
  writable: false,
  configurable: false,
});
