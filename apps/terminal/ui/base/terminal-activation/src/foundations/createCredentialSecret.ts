const BASE64_URL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

/** Produces the 43-character unpadded base64url value required by terminal-data-client. */
export const createCredentialSecret = async (): Promise<string> => {
  const {getRandomBytesAsync} = await import('expo-crypto');
  const bytes = await getRandomBytesAsync(32);
  let result = '';
  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index]!;
    const hasSecond = index + 1 < bytes.length;
    const hasThird = index + 2 < bytes.length;
    const second = hasSecond ? bytes[index + 1]! : 0;
    const third = hasThird ? bytes[index + 2]! : 0;
    const value = (first << 16) | (second << 8) | third;
    result += BASE64_URL[(value >>> 18) & 63]!;
    result += BASE64_URL[(value >>> 12) & 63]!;
    if (hasSecond) result += BASE64_URL[(value >>> 6) & 63]!;
    if (hasThird) result += BASE64_URL[value & 63]!;
  }
  return result;
};
