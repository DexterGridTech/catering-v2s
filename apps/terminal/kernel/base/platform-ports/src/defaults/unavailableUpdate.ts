import type {PortResult} from '../types/result';
import type {
  UpdateAction,
  UpdateActionInput,
  UpdateCall,
  UpdateFacts,
  UpdatePort,
  UpdatePreparedArtifact,
  UpdateSource,
} from '../types/update';
import {createUnavailable} from './createUnavailable';

const PORT_DESCRIPTOR_KEY = Symbol.for('catering-v2s.platform-ports.descriptor');
export const unavailableUpdatePort: UpdatePort = {
  readFacts: async (_input: UpdateCall): Promise<PortResult<UpdateFacts>> => createUnavailable('update', 'readFacts'),
  prepareArtifact: async (_input: UpdateCall & UpdateSource): Promise<PortResult<UpdatePreparedArtifact>> =>
    createUnavailable('update', 'prepareArtifact'),
  applyPrepared: async (_input: UpdateActionInput): Promise<PortResult<UpdateAction>> =>
    createUnavailable('update', 'applyPrepared'),
  readAction: async (
    _input: UpdateCall & Readonly<{taskId: string; actionId: string}>,
  ): Promise<PortResult<UpdateAction | null>> => createUnavailable('update', 'readAction'),
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
      ['readFacts', 'prepareArtifact', 'applyPrepared', 'readAction', 'confirmBoot', 'releasePrepared'].map(
        capability => Object.freeze({capability, state: 'unavailable' as const, source: 'default' as const}),
      ),
    ),
  }),
  enumerable: false,
  writable: false,
  configurable: false,
});
