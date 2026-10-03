import type {ContainerKey, DisplayMode, SurfaceForm} from '@catering-v2s/kernel-base-ui-state';
import type {RequestId} from '@catering-v2s/kernel-base-contracts';
import type {LoggerPort} from '@catering-v2s/kernel-base-platform-ports';
import type {ContentFailureReason, SystemFailureReason} from '../types/props';

export type RenderPartDiagnostic =
  | Readonly<{
      readonly event: 'container-empty';
      readonly data: Readonly<{
        readonly category: 'content';
        readonly reason: Extract<ContentFailureReason, 'container-empty'>;
        readonly partKey: null;
        readonly displayMode: DisplayMode;
        readonly containerKey: ContainerKey;
        readonly surfaceForm: SurfaceForm;
      }>;
    }>
  | Readonly<{
      readonly event: 'missing-catalog-entry';
      readonly data: Readonly<{
        readonly category: 'content';
        readonly reason: Extract<ContentFailureReason, 'missing-catalog-entry'>;
        readonly partKey: string;
        readonly displayMode: DisplayMode;
        readonly containerKey: ContainerKey | null;
        readonly surfaceForm: SurfaceForm;
      }>;
    }>
  | Readonly<{
      readonly event: 'missing-renderer';
      readonly data: Readonly<{
        readonly category: 'system';
        readonly reason: Extract<SystemFailureReason, 'missing-renderer'>;
        readonly partKey: string;
        readonly displayMode: DisplayMode;
        readonly rendererKey: string;
      }>;
    }>
  | Readonly<{
      readonly event: 'invalid-props-shape';
      readonly data: Readonly<{
        readonly category: 'content';
        readonly reason: Extract<ContentFailureReason, 'invalid-props'>;
        readonly partKey: string;
        readonly displayMode: DisplayMode;
        readonly containerKey: ContainerKey | null;
        readonly surfaceForm: SurfaceForm;
        readonly valueType: string;
      }>;
    }>
  | Readonly<{
      readonly event: 'incompatible-catalog-entry';
      readonly data: Readonly<{
        readonly category: 'content';
        readonly reason: Extract<ContentFailureReason, 'incompatible-catalog-entry'>;
        readonly partKey: string;
        readonly displayMode: DisplayMode;
        readonly containerKey: string | null;
        readonly surfaceForm: string;
      }>;
    }>;

export type RenderPartDiagnosticReporter = Readonly<{
  readonly report: (diagnostic: RenderPartDiagnostic) => void;
  readonly clearForPart: (partKey: string, displayMode: DisplayMode) => void;
}>;

export type RenderCommandDispatchDiagnostic = Readonly<{
  readonly event: 'command-dispatch-rejected';
  readonly commandName: string;
  readonly requestId: RequestId;
  readonly failure: 'promise-rejected' | 'partial-failed' | 'timed-out' | 'error';
}>;

export const reportRenderCommandDispatchRejection = (
  logger: LoggerPort,
  diagnostic: RenderCommandDispatchDiagnostic,
): void => {
  const input = {
    category: 'ui.base.render',
    event: diagnostic.event,
    context: {
      commandName: diagnostic.commandName,
      requestId: diagnostic.requestId,
    },
    data: {
      failure: diagnostic.failure,
    },
  };
  if (diagnostic.failure === 'promise-rejected') logger.error(input);
  else logger.warn(input);
};

const diagnosticIdentity = (diagnostic: RenderPartDiagnostic): string =>
  JSON.stringify([diagnostic.event, ...Object.values(diagnostic.data)]);

export const createRenderPartDiagnosticReporter = (logger: LoggerPort): RenderPartDiagnosticReporter => {
  const reported = new Map<string, Readonly<{partKey: string | null; displayMode: DisplayMode}>>();
  return Object.freeze({
    report: (diagnostic: RenderPartDiagnostic): void => {
      const identity = diagnosticIdentity(diagnostic);
      if (reported.has(identity)) return;
      reported.set(identity, {
        partKey: diagnostic.data.partKey,
        displayMode: diagnostic.data.displayMode,
      });
      logger.error({
        category: 'ui.base.render',
        event: diagnostic.event,
        data: diagnostic.data,
      });
    },
    clearForPart: (partKey: string, displayMode: DisplayMode): void => {
      for (const [identity, source] of reported) {
        if (source.partKey === partKey && source.displayMode === displayMode) reported.delete(identity);
      }
    },
  });
};
