import type {RuntimeDeviceIdentity} from '@catering-v2s/ui-base-render';

export {normalizeDeviceIdentity} from '@catering-v2s/kernel-base-platform-ports';

export const ADMIN_PASSWORD_FALLBACK = '123456' as const;

export type TerminalDeviceIdentity = RuntimeDeviceIdentity;

export type AdminPasswordDerivationInput = Readonly<{
  readonly deviceId: string;
  readonly localDate: Date;
}>;

export type AdminPasswordVerificationInput = Readonly<{
  readonly identity: TerminalDeviceIdentity;
  readonly attempt: string;
  readonly localDate: Date | null;
}>;

const padTwo = (value: number): string => String(value).padStart(2, '0');

const localDateHour = (date: Date): string =>
  [
    String(date.getFullYear()).padStart(4, '0'),
    padTwo(date.getMonth() + 1),
    padTwo(date.getDate()),
    padTwo(date.getHours()),
  ].join('');

const isValidDate = (date: Date): boolean => !Number.isNaN(date.getTime());

export const deriveAdminPassword = ({deviceId, localDate}: AdminPasswordDerivationInput): string => {
  const normalizedDeviceId = deviceId.trim();
  if (normalizedDeviceId.length === 0) throw new Error('[ui-base-admin-shell] deviceId is required');
  if (!isValidDate(localDate)) throw new Error('[ui-base-admin-shell] localDate is invalid');

  const seed = `${normalizedDeviceId}${localDateHour(localDate)}`;
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 131 + seed.charCodeAt(index)) >>> 0;
  }
  const numeric = `${hash}${seed.length * 97}`;
  return numeric.slice(-6).padStart(6, '0');
};

const dateAtHourOffset = (date: Date, offset: number): Date => {
  const candidate = new Date(date.getTime());
  candidate.setHours(candidate.getHours() + offset);
  return candidate;
};

export const verifyAdminPassword = ({identity, attempt, localDate}: AdminPasswordVerificationInput): boolean => {
  if (identity.available === false || identity.deviceId === null) {
    return attempt === ADMIN_PASSWORD_FALLBACK;
  }
  const currentDate = localDate;
  const deviceId = identity.deviceId;
  if (deviceId === null || currentDate === null || !isValidDate(currentDate)) return false;
  return [-1, 0, 1].some(
    offset =>
      deriveAdminPassword({
        deviceId,
        localDate: dateAtHourOffset(currentDate, offset),
      }) === attempt,
  );
};
