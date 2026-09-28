import type {NoOutput, PortResult} from '../types/result';
import type {
  ConnectorCallRequest,
  ConnectorCallResponse,
  ConnectorObject,
  ConnectorPort,
  ConnectorSubscribeInput,
  ConnectorSubscription,
  ConnectorUnsubscribeInput,
  ConnectorValue,
} from '../types/connector';
import {createUnavailable} from './createUnavailable';

const PORT_DESCRIPTOR_KEY = Symbol.for('catering-v2s.platform-ports.descriptor');
export const unavailableConnectorPort: ConnectorPort = {
  call: async <TRequest extends ConnectorObject, TResponse extends ConnectorValue>(
    _input: ConnectorCallRequest<TRequest>,
  ): Promise<PortResult<ConnectorCallResponse<TResponse>>> => createUnavailable('connector', 'call'),
  subscribe: async <TMessage extends ConnectorValue>(
    _input: ConnectorSubscribeInput<TMessage>,
  ): Promise<PortResult<ConnectorSubscription>> => createUnavailable('connector', 'subscribe'),
  unsubscribe: async (_input: ConnectorUnsubscribeInput): Promise<PortResult<NoOutput>> =>
    createUnavailable('connector', 'unsubscribe'),
  on: async <TEvent extends ConnectorValue>(
    _input: Parameters<ConnectorPort['on']>[0],
  ): Promise<PortResult<ConnectorSubscription>> => createUnavailable('connector', 'on'),
};

Object.defineProperty(unavailableConnectorPort, PORT_DESCRIPTOR_KEY, {
  value: Object.freeze({
    port: 'connector',
    capabilities: Object.freeze(
      ['call', 'subscribe', 'unsubscribe', 'on'].map(capability =>
        Object.freeze({capability, state: 'unavailable' as const, source: 'default' as const}),
      ),
    ),
  }),
  enumerable: false,
  writable: false,
  configurable: false,
});
