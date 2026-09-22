import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export function base32(bytes: Buffer): string {
  let bits = 0,
    value = 0,
    result = '';
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      result += ALPHABET[(value >>> bits) & 31];
    }
  }
  if (bits > 0) result += ALPHABET[(value << (5 - bits)) & 31];
  return result;
}

// RFC 6238 / RFC 4226: 30-second steps, HMAC-SHA1, six-digit authenticator codes.
export function totp(secret: Buffer, step: number, digits = 6): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const digest = createHmac('sha1', secret).update(counter).digest();
  const offset = digest[digest.length - 1]! & 15;
  return String((digest.readUInt32BE(offset) & 0x7fffffff) % 10 ** digits).padStart(digits, '0');
}
export function verifyTotp(
  secret: Buffer,
  code: string,
  lastUsedStep: number,
  now = Date.now(),
): number | null {
  if (!/^\d{6}$/.test(code)) return null;
  const current = Math.floor(now / 30000);
  for (const step of [current, current - 1, current + 1]) {
    if (step > lastUsedStep && timingSafeEqual(Buffer.from(totp(secret, step)), Buffer.from(code)))
      return step;
  }
  return null;
}
export function tokenHash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
export function sealSecret(secret: Buffer, key: Buffer, identityId: string): string {
  const nonce = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, nonce);
  cipher.setAAD(Buffer.from(`trackroster:mfa:v1:${identityId}`));
  const ciphertext = Buffer.concat([cipher.update(secret), cipher.final()]);
  return [
    'v1',
    nonce.toString('base64url'),
    cipher.getAuthTag().toString('base64url'),
    ciphertext.toString('base64url'),
  ].join('.');
}
export function openSecret(value: string, key: Buffer, identityId: string): Buffer {
  const [version, nonce, tag, ciphertext] = value.split('.');
  if (version !== 'v1' || !nonce || !tag || !ciphertext)
    throw new Error('Invalid encrypted MFA secret');
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(nonce, 'base64url'));
  decipher.setAAD(Buffer.from(`trackroster:mfa:v1:${identityId}`));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, 'base64url')), decipher.final()]);
}
