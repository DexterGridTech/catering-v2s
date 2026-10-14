import type {LogEvent} from '@catering-v2s/kernel-base-platform-ports';
import type {LoggerBinding} from '@catering-v2s/kernel-base-platform-ports';

const writeStructuredEvent = (event: LogEvent): void => {
  const line = JSON.stringify(event);
  if (event.level === 'debug') console.debug(line);
  else if (event.level === 'info') console.info(line);
  else if (event.level === 'warn') console.warn(line);
  else console.error(line);
};

export const androidStructuredLoggerBinding: LoggerBinding = Object.freeze({
  kind: 'sink',
  write: writeStructuredEvent,
});
