import type {RequestId, TimestampMs} from '@catering-v2s/kernel-base-contracts';
import type {NoOutput, PortError, PortResult} from './result';

export type ConnectorScalar = string | number | boolean | null;
export type ConnectorValue = ConnectorScalar | readonly ConnectorValue[] | ConnectorObject;
export interface ConnectorObject {
  readonly [key: string]: ConnectorValue;
}
export interface ConnectorChannelRef {
  readonly channelKey: string;
  readonly target?: string;
}
export interface ConnectorCallRequest<TPayload extends ConnectorObject> {
  readonly requestId: RequestId;
  readonly channel: ConnectorChannelRef;
  readonly action: string;
  readonly payload: TPayload;
  readonly timeoutMs: number;
}
export interface ConnectorCallResponse<TPayload extends ConnectorValue> {
  readonly requestId: RequestId;
  readonly payload: TPayload;
}
export interface ConnectorMessage<TPayload extends ConnectorValue> {
  readonly subscriptionId: string;
  readonly sequence: number;
  readonly receivedAt: TimestampMs;
  readonly payload: TPayload;
}
export type ConnectorError = PortError;
export interface ConnectorSubscriptionError {
  readonly subscriptionId: string;
  readonly error: ConnectorError;
}
export interface ConnectorSubscribeInput<TPayload extends ConnectorValue> {
  readonly channel: ConnectorChannelRef;
  readonly onMessage: (message: ConnectorMessage<TPayload>) => void;
  readonly onError: (error: ConnectorSubscriptionError) => void;
  readonly timeoutMs: number;
}
export interface ConnectorEvent<TPayload extends ConnectorValue> {
  readonly eventName: string;
  readonly receivedAt: TimestampMs;
  readonly payload: TPayload;
}
export interface ConnectorOnInput<TPayload extends ConnectorValue> {
  readonly eventName: string;
  readonly handler: (event: ConnectorEvent<TPayload>) => void;
  readonly onError: (error: ConnectorSubscriptionError) => void;
  readonly timeoutMs: number;
}
export interface ConnectorUnsubscribeInput {
  readonly subscriptionId: string;
  readonly timeoutMs: number;
}
export interface ConnectorSubscription {
  readonly subscriptionId: string;
}
export interface ConnectorPort {
  call<TRequest extends ConnectorObject, TResponse extends ConnectorValue>(
    input: ConnectorCallRequest<TRequest>,
  ): Promise<PortResult<ConnectorCallResponse<TResponse>>>;
  subscribe<TMessage extends ConnectorValue>(
    input: ConnectorSubscribeInput<TMessage>,
  ): Promise<PortResult<ConnectorSubscription>>;
  unsubscribe(input: ConnectorUnsubscribeInput): Promise<PortResult<NoOutput>>;
  on<TEvent extends ConnectorValue>(input: ConnectorOnInput<TEvent>): Promise<PortResult<ConnectorSubscription>>;
}
