import type {DeskSystemOperation, DraftDiscardIntent, RegistryNoticeReason} from '../declarations/commands';

export type DeskSystemNoticeProps = Readonly<{readonly operation: DeskSystemOperation}>;
export type DiscardConfirmProps = Readonly<{readonly intent: DraftDiscardIntent}>;
export type RegistryNoticeProps = Readonly<{readonly reasonCode: RegistryNoticeReason}>;
