import type {TerminalTopicKey} from '@catering-v2s/kernel-base-terminal-data-client';

export const organizationTopicKeys = ['PROJECT', 'REGION', 'COMMERCIAL_GROUP'] as const satisfies readonly TerminalTopicKey[];
export const terminalUpdateTopicKey = 'TERMINAL_UPDATE_RULES' as const satisfies TerminalTopicKey;
