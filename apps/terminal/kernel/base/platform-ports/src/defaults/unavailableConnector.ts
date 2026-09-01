import type {NoOutput, PortResult, PortUnavailable} from '../types/result';
import type {ConnectorCallRequest, ConnectorCallResponse, ConnectorObject, ConnectorPort, ConnectorSubscribeInput, ConnectorSubscription, ConnectorUnsubscribeInput, ConnectorValue} from '../types/connector';

const unavailable = (capability: string): PortUnavailable => ({
  status: 'unavailable',
  port: 'connector',
  capability,
  reason: 'ADAPTER_NOT_INJECTED',
  message: `connector.${capability}: adapter not injected`,
});

export const unavailableConnectorPort: ConnectorPort = {
  call: async <TRequest extends ConnectorObject, TResponse extends ConnectorValue>(_input: ConnectorCallRequest<TRequest>): Promise<PortResult<ConnectorCallResponse<TResponse>>> => unavailable('call'),
  subscribe: async <TMessage extends ConnectorValue>(_input: ConnectorSubscribeInput<TMessage>): Promise<PortResult<ConnectorSubscription>> => unavailable('subscribe'),
  unsubscribe: async (_input: ConnectorUnsubscribeInput): Promise<PortResult<NoOutput>> => unavailable('unsubscribe'),
  on: async <TEvent extends ConnectorValue>(_input: Parameters<ConnectorPort['on']>[0]): Promise<PortResult<ConnectorSubscription>> => unavailable('on'),
};
