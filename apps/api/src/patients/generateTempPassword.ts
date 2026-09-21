import { randomBytes } from 'node:crypto';

// Same ambiguity-free alphabet as the health ID, for the same reason: a
// field worker reads this aloud or writes it on a paper slip, and a
// patient who mistypes O for 0 has no inbox to reset it from.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function generateTempPassword(): string {
  const bytes = randomBytes(8);
  let password = '';
  for (const byte of bytes) {
    password += ALPHABET[byte % ALPHABET.length];
  }
  return password;
}
