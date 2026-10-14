import {useState} from 'react';
import {createRequestId, type RequestId} from '@catering-v2s/kernel-base-contracts';

export const useTrackedRequest = (): Readonly<{
  readonly requestId: RequestId | null;
  readonly start: () => RequestId;
  readonly finish: (requestId: RequestId) => void;
}> => {
  const [requestId, setRequestId] = useState<RequestId | null>(null);
  const start = (): RequestId => {
    const next = createRequestId();
    setRequestId(next);
    return next;
  };
  const finish = (finishedRequestId: RequestId): void => {
    setRequestId(current => (current === finishedRequestId ? null : current));
  };
  return Object.freeze({requestId, start, finish});
};
